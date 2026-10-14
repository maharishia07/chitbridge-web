/* app/cap-dispute.js — the DISPUTE capability (the USP), lazy-loaded via ensureCap('dispute').
 *
 * WHY LAZY + GATED: dispute is an itemised, opt-in capability (BRD-dispute BR-D6). An entity that
 * doesn't hold 'dispute' never loads this file and sees no dispute nav / banner / composer toggle /
 * advanced-search option. Core loads it once, on the /me capabilities check, only when opted in.
 *
 * WHY IT LIVES HERE (not Core): everything dispute-specific is in ONE module — the screen, the raise/
 * resolve flow, the on-record banner, the composer toggle, and the shared roster renderers — so the
 * behaviour has a single home and can't drift across surfaces.
 *
 * DEPENDS on Core globals (shared, NOT duplicated here): api, modal/closeModal, esc, nm (name+fallback),
 * val, toast, MSG, openChit, UI/SESSION, lazyWrap, menuAssist, cap, chitIsSelf (self/opponent — actor
 * resolves to its parent entity), and the EP rows dispute/disputes/resolveDispute/disputeQueue.
 */

/* ── Shared roster renderers — ONE definition, used by BOTH the banner and the Disputes screen (was
 *    duplicated in two places, hence wrong-name/scope drift). A "party" = a dispute_participants row
 *    with role='party'; we exclude the viewer via chitIsSelf so you never see yourself as an opponent. */
function disputeParties(d){ return (d.participants||[]).filter(function(p){ return p.role==='party' && !chitIsSelf(p.entity_id,p.display_name); }); }
function disputeChips(parties, chipCls){
  return parties.map(function(p){ var done=p.dispute_status==='resolved';
    return '<span class="'+(chipCls||'dpchip')+(done?' ok':'')+'">'+nm(p.display_name,'party')+(done?' ✓':'')+'</span>'; }).join('');
}
/* Resolve buttons — only the OPEN parties, only shown to the raiser (caller decides via `show`). One
 * button per party (per-party resolution, BR-D3); if no per-party split, a single chit-wide Resolve. */
function disputeResolveBtns(parties, chitId, disputeId, show, btnCls){
  if(!show) return '';
  var open=parties.filter(function(p){ return p.dispute_status!=='resolved'; });
  var b=btnCls||'db-res';
  var inner = open.length
    ? open.map(function(p){ return '<button class="'+b+'" data-testid="dispute-resolve-open" onclick="resolveDispute(\''+chitId+'\',\''+disputeId+'\',\''+p.entity_id+'\',\''+encodeURIComponent(p.display_name||'party')+'\')">Resolve '+nm(p.display_name,'party')+'</button>'; }).join('')
    : '<button class="'+b+'" data-testid="dispute-resolve-open" onclick="resolveDispute(\''+chitId+'\',\''+disputeId+'\')">' + tx('Resolve') + '</button>';
  return inner;
}

/* (disputeOppLabel + disputeFilterChips removed 2026-07-05 — the general-thread per-dispute chips are
 *  superseded by the Open|Closed dispute panel + per-dispute rooms below.) */

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * MESSAGING + LIST HOOKS — 2nd lazy pass (2026-07-05). Every dispute-specific branch that used to
 * live inside Core's msgBubble / mapApiMsg / messagesTab / doSendMessage / row-cell now lives HERE.
 * Core calls each via (typeof fn==='function'), so a customer — or Core before this module finishes
 * loading — degrades to plain messaging with ZERO dispute knowledge. cap-dispute loads for every
 * non-customer on boot, so these resolve wherever a dispute message can surface.
 * RULE (Athi): from here on, ALL dispute behaviour lands in THIS file only — Core stays dispute-blind.
 * These five are the "messaging helper API" a message-type capability plugs into (badge / byline /
 * filter / send-decorator / row-cell); a future cap could register the same way.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* mapApiMsg → split the trailing "— actor@entity" provenance a dispute message carries into a byline.
 * Returns {by, body}; on a plain message (or no marker) by=null and body is unchanged. */
function disputeByline(body){
  var b=body||''; if(!b) return { by:null, body:b, kind:null };
  var by=null;
  var mm=b.match(/\s+[—-]\s+(\S+@.+?)\s*$/);                                        // actor provenance "— name@entity" → byline (KEEP: shows as "· by …")
  if(mm){ by=mm[1].trim(); b=b.slice(0,mm.index).replace(/\s+$/,''); }
  var kind=null;
  var pm=b.match(/^\[(resolved|quality|quantity|delivery|payment|docs|other)\]\s*/i);   // dispute prefix → strip (the badge already says it)
  if(pm){ kind=/resolved/i.test(pm[1])?'resolved':'raised'; b=b.slice(pm[0].length); }
  return { by:by, body:b, kind:kind };
}
/* list row → the one-glance dispute count: N open (red) · M resolved (green); '' when neither. */

/* ── Advanced-search dispute filter (was inline in Core toolbar + adv modal). The ⚠ N chip surfaces on
 *    task/order lists when open disputes exist (or the filter is on); toggling adds dispute='open' to
 *    UI.adv. dispSearchRow = the checkbox inside the advanced-search modal. Core calls both via typeof,
 *    so a customer / dispute-blind Core just omits them.
 *    NOTE (FR-D12): a stricter hasCap('dispute') gate is deliberately NOT applied — a non-opted entity can
 *    still be a dispute TARGET and needs to find the disputed record. Revisit if opt-in must fully hide it. */
function dispChipHtml(){
  if(["task","order"].indexOf(UI.folder)<0) return '';
  var n=UI.disputeOpen||0, on=(UI.adv||{}).dispute; if(!n && !on) return '';
  return '<button class="advbtn'+(on?' on':'')+'" style="color:var(--disp);border-color:#f0c9c6'+(on?';background:var(--danger-tint)':'')+'" onclick="event.stopPropagation();toggleDisputeFilter()" title="Chits with an open dispute">⚠ '+n+'</button>';
}
function toggleDisputeFilter(){ var a=UI.adv||{}; if(a.dispute){delete a.dispute;}else{a.dispute='open';} UI.adv=a; UI.sel=null; UI.detail=null; renderApp(); }
function dispSearchRow(a){ a=a||{}; return '<div class="advrow"><label>' + tx('Dispute') + '</label><label class="advchk"><input type="checkbox" id="adv_disp" '+(a.dispute?'checked':'')+'> ⚠ Only open disputes</label></div>'; }

/* ── On-record DISPUTE PANEL (was the banner) — the USP as a self-contained space ON the chit.
 *    Open|Closed tabs; each dispute is a selectable row that expands into its OWN ROOM: reason + its own
 *    message thread (only THIS dispute's messages) + an external-only compose + raiser resolve. A CLOSED
 *    dispute keeps its thread READ-ONLY (messages live forever — chit_messages are never deleted and stay
 *    visible to participants regardless of status). 1 or many disputes = identical interaction: pick → room.
 *    Dispute messaging is external-only (participant-scoped); internal team notes use the normal Messages tab. */
/* Pick a dispute from the dropdown → its ROOM opens as an overlay over the detail pane; ✕ closes it.
 * Nothing open by default (UI.dispSel=null). One room at a time — 1 or N disputes look identical. */
function disputeSelect(did){
  UI.dispSel=did||null; UI.dispCompose=false; UI.dispFiles=[];
  var dp=document.getElementById('detailpane'); if(dp) dp.style.position='relative';   // anchor the absolute overlay to the pane
  paintDetail();
}
function disputeClose(){ UI.dispSel=null; UI.dispCompose=false; UI.dispFiles=[]; paintDetail(); }
function dispOpp(d){ var p=disputeParties(d); return p.length?p.map(function(x){ return x.display_name||'party'; }).join(', '):nm(d.raised_by_display_name,'party'); }
function dispOptGroup(list, label){
  if(!list.length) return '';
  return '<optgroup label="'+label+'">'+list.map(function(d){
    return '<option value="'+esc(d.dispute_id)+'"'+(String(UI.dispSel)===String(d.dispute_id)?' selected':'')+'>'+esc(cap(d.category||'')+' · with '+dispOpp(d)+' · '+(d.status==='open'?'● open':'✓ resolved'))+'</option>';
  }).join('')+'</optgroup>';
}
/* the DETAIL dropdown (always shown when disputes exist) + the overlay when one is picked */
function disputeBanner(c){
  var all=((c&&c.disputes)||[]);
  var open=all.filter(function(d){ return d.status==='open'; });
  var closed=all.filter(function(d){ return d.status!=='open'; });
  if(!open.length && !closed.length) return '';
  var proof=c.proof==='ok'?'<span class="db-proof">' + tx('⚖️ both-signed record') + '</span>':'';
  var head='<div class="db-row"><span class="db-tag">⚑ '+(open.length?open.length+' dispute'+(open.length>1?'s':'')+' open on this record':'Disputes (resolved)')+'</span>'+proof+'</div>';
  var dd='<select onchange="disputeSelect(this.value)" style="width:100%;margin-top:9px;padding:10px 12px;border:1px solid #e5c9c6;border-radius:9px;font-size:var(--fs-2);background:var(--card);color:var(--on-card);cursor:pointer">'
    +'<option value="">— select a dispute to open —</option>'+dispOptGroup(open,'OPEN')+dispOptGroup(closed,'CLOSED')+'</select>';
  var sel=UI.dispSel?all.filter(function(d){ return String(d.dispute_id)===String(UI.dispSel); })[0]:null;   // stale id (other chit) → no overlay
  return '<div class="dispbanner">'+head+dd+'</div>'+(sel?disputeOverlay(c, sel, open, closed):'');
}
/* the overlay frame over the detail pane: header + ✕, a dropdown to switch, and the room */
function disputeOverlay(c, d, open, closed){
  var proof=c.proof==='ok'?'<span class="db-proof">' + tx('⚖️ both-signed record') + '</span>':'';
  var dd='<select onchange="disputeSelect(this.value)" style="width:100%;margin-bottom:12px;padding:8px 11px;border:1px solid #e5c9c6;border-radius:9px;font-size:var(--fs-2);background:var(--card);color:var(--on-card);cursor:pointer">'
    +dispOptGroup(open,'OPEN')+dispOptGroup(closed,'CLOSED')+'</select>';
  return '<div style="position:absolute;inset:0;background:var(--card);display:flex;flex-direction:column;z-index:30;color:var(--on-card)">'
    +'<div style="display:flex;align-items:center;gap:8px;padding:13px 16px;border-bottom:1px solid var(--line);background:var(--danger-tint);color:var(--on-card)">'
      +'<span style="font-weight:700;color:var(--disp);font-size:var(--fs-3)">⚑ '+esc(cap(d.category||''))+'</span>'+proof
      +'<button onclick="aiDisputeSummary(\''+c.id+'\',\''+d.dispute_id+'\')" title="AI summarises this dispute neutrally — it does not decide it" style="margin-inline-start:auto;border:1px solid var(--purple);background:var(--purple-tint);color:var(--purple);border-radius:9px;padding:6px 11px;cursor:pointer;font-size:var(--fs-2)">' + tx('✨ Summarize') + '</button>'
      +'<button onclick="disputeClose()" style="margin-inline-start:8px;border:1px solid var(--line);background:var(--card);border-radius:9px;padding:6px 12px;cursor:pointer;font-size:var(--fs-2);color:var(--on-card)">' + tx('✕ Close') + '</button></div>'
    +'<div style="padding:15px 16px;overflow:auto;flex:1">'+dd+disputeRoomBox(c,d)+'</div></div>';
}
// AI dispute summary — invoked, neutral, INFORMATIONAL (resolve stays human, raiser-only). Reuses the global _aiMd (app.html).
async function aiDisputeSummary(chitId, disputeId){
  var c=UI.detail; if(!c){ if(typeof toast==='function')toast('Open the dispute first'); return; }
  var d=((c.disputes)||[]).filter(function(x){ return String(x.dispute_id)===String(disputeId); })[0]; if(!d) return;
  if(typeof modal!=='function'||typeof _aiMd!=='function'){ if(typeof toast==='function')toast('AI unavailable here'); return; }
  var msgs=((c.dispMsgs||{})[d.dispute_id]||[]);   /* the room's rows as CBThread listed them (rtMountAll onList) */
  var ctx={ category:d.category, status:d.status, raised_by:d.raised_by_display_name, subject:c.code,
    thread:msgs.map(function(m){ return { from:(m.sender_display_name||m.from||''), text:(m.message_text||m.body||'') }; }) };
  modal('<div class="mhd"><div class="t">' + tx('✨ Summarize dispute') + '</div></div><div class="mbody" style="padding:16px"><div id="adbody" style="font-size:var(--fs-2);color:var(--grey)">✨ Summarizing — neutral &amp; factual…</div></div>', true);
  try{
    var res=await fetch(CFG.API_BASE+'/api/governance/ai-draft',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+SESSION.token},body:JSON.stringify({skill_id:'dispute-summary',context:ctx})});
    var j=await res.json();
    if(!res.ok||!j||!j.draft) throw new Error((j&&j.message)||(res.status===503?'AI is not connected on this environment.':'Summary failed'));
    var html='<style>'+(typeof _AI_MDCSS!=='undefined'?_AI_MDCSS:'')+'</style>'
      +'<div style="font-size:var(--fs-1);color:var(--purple);background:var(--blue-tint-bg);border:1px solid #ddd4f5;border-radius:9px;padding:8px 11px;margin-bottom:12px;line-height:1.5">🤖 <b>AI summary — neutral, informational.</b> It does not decide the dispute. '+(j.usage?('<span style="color:var(--grey)">· $'+j.usage.est_cost_usd+'</span>'):'')+'</div>'
      +'<div class="amddoc" style="background:var(--card);border:1px solid var(--line);border-radius:9px;padding:15px 17px;max-height:56vh;overflow:auto;color:var(--on-card)">'+_aiMd(j.draft)+'</div>'
      +'<div style="margin-top:12px;text-align:end"><button onclick="closeModal()" style="font-size:var(--fs-2);font-weight:700;border:1px solid var(--line);background:var(--card);border-radius:9px;padding:9px 16px;cursor:pointer;color:var(--on-card)">' + tx('Done') + '</button></div>';
    var b=document.getElementById('adbody'); if(b)b.innerHTML=html;
  }catch(e){ var b2=document.getElementById('adbody'); if(b2)b2.innerHTML='<div style="font-size:var(--fs-2);color:var(--warn-2);background:var(--warn-tint);border:1px solid #f0dcae;border-radius:9px;padding:10px 12px">'+esc((e&&e.message)||'Summary failed')+'</div>'; }
}
// AI resolution wording — invoked, neutral DRAFT; the raiser still decides whether to resolve (human gate holds). Reuses global aiRun.
function aiResolutionSuggest(chitId, disputeId){
  var c=UI.detail; if(!c||typeof aiRun!=='function') return;
  var d=((c.disputes)||[]).filter(function(x){ return String(x.dispute_id)===String(disputeId); })[0]; if(!d) return;
  var msgs=((c.dispMsgs||{})[d.dispute_id]||[]);   /* the room's rows as CBThread listed them (rtMountAll onList) */
  aiRun('resolution-suggest', { category:d.category, raised_by:d.raised_by_display_name, subject:c.code,
    thread:msgs.map(function(m){ return { from:(m.sender_display_name||m.from||''), text:(m.message_text||m.body||'') }; }) }, {title:'✨ Suggested resolution wording'});
}
/* one dispute's room: participants · own message wall (latest first, attachments) · New-message (text+attach) · Resolve */
function disputeRoomBox(c, d){
  var readonly=d.status!=='open';
  var mine=chitIsSelf(d.raised_by_entity_id, d.raised_by_display_name);
  var parties=disputeParties(d);
  var st=readonly?'<span style="color:var(--ok-2);font-size:var(--fs-1);font-weight:700">' + tx('✓ resolved') + '</span>':'<span style="color:var(--disp);font-size:var(--fs-1);font-weight:700">' + tx('● open') + '</span>';
  var resolve=readonly?'':disputeResolveBtns(parties, c.id, d.dispute_id, mine, 'db-res');
  var suggestBtn=(readonly||typeof aiRun!=='function')?'':'<button onclick="aiResolutionSuggest(\''+c.id+'\',\''+d.dispute_id+'\')" title="AI suggests neutral resolution wording — you decide whether to resolve" style="font-size:var(--fs-1);font-weight:700;border:1px solid var(--purple);background:var(--purple-tint);color:var(--purple);border-radius:6px;padding:5px 10px;cursor:pointer">' + tx('✨ Suggest wording') + '</button>';
  var resolveWrap=(resolve||suggestBtn)?'<span style="display:inline-flex;gap:6px;flex-wrap:wrap">'+suggestBtn+resolve+'</span>':'';
  var roster=[nm(d.raised_by_display_name,'—')+' (raiser)'].concat(parties.map(function(p){ return nm(p.display_name,'party'); })).join(' · ');
  var to=parties.length?parties.map(function(p){ return p.display_name||'party'; }).join(", "):'participants';
  /* ⭐ R02 — the room's thread IS CBThread (app/rail-thread.js), mounted by app.html's rtMountAll after the paint: dispute-scoped
     (is_dispute + dispute_id, external only — the roster's audience), read-only once resolved; the test ids the dispute specs drive. */
  var host='<div data-rt="'+esc(JSON.stringify({chit_id:c.id, dispute_id:d.dispute_id, channel:'external', readOnly:readonly, party:to, ids:{text:'dispute-room-input', send:'dispute-room-send'}}))+'" data-testid="rt-disp"></div>';
  return '<div style="border:1px solid #f0c9c6;border-radius:12px;padding:13px 14px">'
    +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="db-cat">'+esc(cap(d.category||''))+'</span>'
      +(parties.length?'<span style="font-size:var(--fs-2);color:var(--grey)">with '+disputeChips(parties,'dpchip')+'</span>':'')
      +'<span style="margin-inline-start:auto;display:inline-flex;gap:9px;align-items:center">'+st+resolveWrap+'</span></div>'
    +'<div style="font-size:var(--fs-2);color:var(--grey-2);margin:10px 0 2px">Participants: <b>'+esc(roster)+'</b></div>'
    +'<div style="display:flex;align-items:center;margin:13px 0 7px"><span style="font-size:var(--fs-2);font-weight:700;color:var(--grey-2)">' + tx('Messages · latest first') + '</span></div>'
    +'<div style="max-height:420px;overflow:auto">'+host+'</div></div>';
}
/* Composer "reply in the dispute" toggle + per-dispute filter chips REMOVED 2026-07-05 — dispute messaging
 * moved INTO each dispute's room (see disputeRoom/sendDisputeMsg above). The general Messages tab is now
 * normal (Internal/External only, dispute messages hidden). Dispute channel = external-only, in the room. */

/* ── Disputes screen (the opt-in queue, BR-D4): every disputed record, split raised-by-you / against-you,
 *    each card reusing the shared roster renderers. Loaded lazily; the nav is capability-gated. */
function disputesScreen(){ return '<div style="padding:14px;max-width:760px;margin:0 auto"><div class="sec" style="font-size:var(--fs-3);margin-bottom:3px;display:flex;align-items:center;gap:9px">' + tx('⚖️ Disputes') + '<button onclick="openAssist(\'disputes\')" title="About this screen" style="border:1px solid var(--line);background:var(--card);color:var(--blue);border-radius:50%;width:22px;height:22px;font-weight:800;cursor:pointer;font-size:13px;line-height:1;flex:none">?</button></div><div style="font-size:var(--fs-1);color:var(--grey);margin-bottom:10px">' + txf('Explore {q} to know more about this screen.', { q: '<b onclick="openAssist(\'disputes\')" style="cursor:pointer;color:var(--blue)">?</b>' }) + '</div><div id="disprows"><div class="loadwrap"><span class="spin"></span> loading…</div></div></div>'; }
/**
 * ── ⭐⭐ THE DISPUTE QUEUE — the one list where "how long has this been open" is the question ────────────────────
 *
 * ⚠️⚠️ THE TWO SECTIONS ARE A MODE, NOT A FILTER, and they stay. "Raised by you" and "Against you" are two
 * different jobs — one you are pursuing, one you are answering — and collapsing them into a dropdown would make
 * a person choose a side before seeing that they have work on both. The controls sit ABOVE both and narrow
 * both, so a search for "damaged" shows what you raised and what was raised against you, still separated.
 *
 * ⚠️ OLDEST FIRST IS THE DEFAULT, and it is the server's own order — deliberately, because it is the opposite
 * of every other list here. Everywhere else the newest thing is the interesting one; in a dispute queue the
 * OLDEST open item is the one rotting, and putting it at the bottom is how it stays there.
 */
var _DISP = { mine: [], other: [], loaded: false };

function dispCtl(){
  var all = _DISP.mine.concat(_DISP.other);
  var cats = [];
  all.forEach(function(d){ if (d.category && cats.indexOf(d.category) < 0) cats.push(d.category); });
  cats.sort();
  return listCtl('disputes', {
    rows: function(){ return _DISP.mine.concat(_DISP.other); },
    text: function(d){ return [d.auto_subject, d.purpose, d.category, d.reason, d.raised_by_display_name,
                               d.scope, d.resolution_note].filter(Boolean).join(' '); },
    noun: tx('dispute'), plural: tx('disputes'),
    filters: [
      /* ⭐ OPEN FIRST, because a resolved dispute is a record and an open one is work. */
      { key: 'status', label: tx('Status'), all: tx('Open and resolved'),
        options: [{ v: 'open', label: tx('Still open') }, { v: 'resolved', label: tx('Resolved') }],
        match: function(d, v){ return v === 'open' ? d.status === 'open' : d.status !== 'open'; } },
    ].concat(cats.length > 1 ? [{ key: 'category', label: tx('Kind'), all: tx('Every kind'),
        options: cats.map(function(c){ return { v: c, label: cap(c) }; }),
        match: function(d, v){ return d.category === v; } }] : []),
    sorts: [
      { key: 'old', label: tx('Oldest first'),
        cmp: function(a, b){ return Date.parse(a.created_at || 0) - Date.parse(b.created_at || 0); } },
      { key: 'new', label: tx('Newest first'),
        cmp: function(a, b){ return Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0); } },
      { key: 'kind', label: tx('By kind'),
        cmp: function(a, b){ return String(a.category || '').localeCompare(String(b.category || '')); } },
    ],
    repaint: function(){ paintDisputes(); },
  });
}

/** one dispute, as a card. canResolve = the "raised by you" side (raiser-only resolve, BR-D3). */
function dispCardHTML(d, canResolve){
  var parties=disputeParties(d);
  var roster=parties.length?'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px">'+parties.map(function(p){ return '<span class="optchip '+(p.dispute_status==='resolved'?'on':'brk')+'">'+nm(p.display_name,'party')+' · '+(p.dispute_status==='resolved'?'✓ resolved':'open')+'</span>'; }).join('')+'</div>':'';
  var btns=disputeResolveBtns(parties, d.chit_id, d.dispute_id, canResolve && d.status==='open', 'composebtn');
  var resolveRow=btns?'<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">'+btns+'</div>':'';
  return '<div class="card" data-testid="disp-card" style="border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:9px">'
    +'<div style="display:flex;justify-content:space-between;gap:8px"><b>'+esc(d.auto_subject||d.purpose||'chit')+'</b><span class="optchip '+(d.status==='open'?'brk':'on')+'">'+esc(d.status)+'</span></div>'
    +'<div style="font-size:var(--fs-2);color:var(--ink);margin:5px 0"><b>'+esc(cap(d.category||''))+'</b> — '+esc(d.reason||'')+'</div>'
    +'<div style="font-size:var(--fs-1);color:var(--grey)">raised by '+nm(d.raised_by_display_name,'—')+' · '+esc(d.scope||'')+(d.resolution_note?(' · ✓ '+esc(d.resolution_note)):'')+'</div>'
    +roster+resolveRow+'</div>';
}

/**
 * ⭐ PAINT, SEPARATE FROM LOAD. Every control repaints; none of them refetches. Asking the server again because
 * somebody typed a letter is how a search box becomes slow enough to feel broken.
 * [[feedback-loader-never-repaints-open-form]]
 */
function paintDisputes(){
  var host=document.getElementById("disprows"); if(!host) return;
  dispCtl();
  var matched=listCtlView('disputes').matched;
  var inSet={}; matched.forEach(function(d){ inSet[d.dispute_id]=1; });
  var mine=_DISP.mine.filter(function(d){ return inSet[d.dispute_id]; });
  var other=_DISP.other.filter(function(d){ return inSet[d.dispute_id]; });
  /* ⚠️ the sections keep the ENGINE's order, not the server's — filter() above preserves _DISP order, so each
     section is re-ordered here to match whatever sort is chosen. */
  var pos={}; matched.forEach(function(d,i){ pos[d.dispute_id]=i; });
  var byOrder=function(a,b){ return pos[a.dispute_id]-pos[b.dispute_id]; };
  mine.sort(byOrder); other.sort(byOrder);
  var none='<div style="color:var(--grey);font-size:var(--fs-2);padding:6px">None.</div>';
  host.innerHTML = menuAssist('disputes')
    + '<div style="margin:2px 0 4px;font-size:var(--fs-1);color:var(--grey)" id="disp_count">' + listCtlCountHTML('disputes') + '</div>'
    + listCtlToolbarHTML('disputes')
    + '<div class="sec" style="font-size:var(--fs-2);color:var(--grey);margin:12px 0 4px">' + tx('Raised by you') + ' (' + mine.length + ')</div>'
    + lazyWrap('dm', mine, function(d){ return dispCardHTML(d, true); }, none)
    + '<div class="sec" style="font-size:var(--fs-2);color:var(--grey);margin:14px 0 4px">' + tx('Against you / awaiting') + ' (' + other.length + ')</div>'
    + lazyWrap('do', other, function(d){ return dispCardHTML(d, false); }, none);
}

async function loadDisputes(){
  var host=document.getElementById("disprows"); if(!host)return;
  try{
    var q=await api("disputeQueue");
    _DISP.mine=q.my_disputes||[]; _DISP.other=q.other_disputes||[]; _DISP.loaded=true;
    /* ⚠️ a fresh read is a fresh list: whatever was revealed of the old one means nothing about this one */
    try{ if(LAZY){ delete LAZY['dm']; delete LAZY['do']; } }catch(_){}
    paintDisputes();
  }catch(e){ host.innerHTML=scrErr(e, tx('disputes'), 'loadDisputes()'); }
}

/* ── Raise flow (FR-D1): candidates = everyone on the chit except me (chitIsSelf); ticking parties makes
 *    it a TARGETED dispute (only those parties see it, BR-D2); none ticked = chit-wide. */
async function quickDispute(idArg, opt){ var ids=idArg?[idArg]:(typeof needTarget==='function'?needTarget():[]); if(!ids.length)return;
  if(ids.length>1){ toast("Raise a dispute on one chit at a time — each is its own matter."); return; }
  var id=ids[0]; MODALS.disp={id, parties:[], back:!!(opt&&opt.back)};
  var partyRows='';
  try{ var r=await api("chit",{params:{id}}); var h=(r&&r.header)||r||{}; var seen={};
    var parties=(h.all_recipients||[]).filter(function(x){ return x&&x.entity_id&&!chitIsSelf(x.entity_id,x.display_name)&&!seen[x.entity_id]&&(seen[x.entity_id]=1); });
    MODALS.disp.parties=parties;
    if(parties.length){ partyRows='<div style="font-size:var(--fs-2);color:var(--grey);margin:9px 0 3px">Between which parties? <span style="color:#9aa3ad">(none ticked = everyone involved)</span></div>'+parties.map(function(p){ return '<label style="display:flex;gap:8px;align-items:center;padding:3px 0;font-size:var(--fs-2);cursor:pointer"><input type="checkbox" class="dispparty" value="'+p.entity_id+'"> '+nm(p.display_name,'party')+' <span style="font-size:var(--fs-1);color:var(--grey);text-transform:uppercase">'+esc(p.role||'')+'</span></label>'; }).join(''); }
  }catch(_){}
  modal('<div class="mhd"><div class="t">' + tx('⚑ Raise dispute') + '</div></div><div class="mbody"><div style="font-size:var(--fs-2);color:var(--grey);margin-bottom:7px">Pick a category and give a reason (min 10 characters). The parties you select are notified and carry the dispute status.</div><select id="dispcat" data-testid="dispute-category" style="width:100%;margin-bottom:8px;padding:8px;border:1px solid var(--line);border-radius:6px"><option value="quality">' + tx('Quality') + '</option><option value="quantity">' + tx('Quantity') + '</option><option value="delivery">' + tx('Delivery') + '</option><option value="payment">' + tx('Payment') + '</option><option value="docs">' + tx('Docs') + '</option><option value="other" selected>' + tx('Other') + '</option></select>'+partyRows+'<textarea id="dispreason" data-testid="dispute-reason" oninput="window.CBOffline&&CBOffline.saveDraft(\'disp.reason.'+id+'\',this.value)" placeholder="e.g. Quantity short by 2 units — please replace">'+esc((window.CBOffline&&CBOffline.loadDraft('disp.reason.'+id))||'')+'</textarea></div><div class="mfoot"><button onclick="closeModal()">' + tx('Cancel') + '</button><button class="danger" data-testid="dispute-raise" onclick="confirmDispute()">' + tx('Raise dispute') + '</button></div>');
}
async function confirmDispute(){ var id=MODALS.disp.id, back=!!MODALS.disp.back; var el=document.getElementById('dispreason'); var reason=(el?el.value:"").trim(); var cat=(document.getElementById('dispcat')||{}).value||'other';
  if(reason.length<10){ toast("Reason must be at least 10 characters"); return; }
  var parties=[].slice.call(document.querySelectorAll('.dispparty:checked')).map(function(e){return e.value;});
  closeModal();
  var body={category:cat,reason}; if(parties.length)body.participant_entity_ids=parties;
  try{ var _dr2=await api("dispute",{params:{id},body}); if(window.CBOffline)CBOffline.clearDraft('disp.reason.'+id); if(_dr2&&_dr2.warning)toast(_dr2.warning); var i=UI.rows.findIndex(function(x){return x.id===id;}); if(i>=0)UI.rows[i].dispute=true; }catch(e){ toast(MSG.fail("raise the dispute", e)); return; }
  if(typeof refreshRollup==='function')refreshRollup(); toast(MSG.disputeRaised(1)); if(typeof announce==='function')announce('Dispute raised');
  if(back && typeof openChitSheet==='function'){ openChitSheet(id); return; }   /* raised from the chit sheet: back to the sheet, the page behind untouched */
  if(UI.sel===id){ UI.dtab='messages'; await openChit(id); } else { renderApp(); }
}

/* ── Resolve flow (BR-D3): raiser-only; per party (partyId) or chit-wide (no partyId). */
function resolveDispute(chitId, disputeId, partyId, partyNameEnc){
  var partyName=partyNameEnc?decodeURIComponent(partyNameEnc):'';
  var who=partyName?'<div style="font-size:var(--fs-2);color:var(--grey);margin-bottom:8px">Resolving with <b>'+esc(partyName)+'</b>. Any other parties stay open until you resolve them too.</div>':'';
  modal('<div class="mhd"><div class="t">Resolve dispute'+(partyName?' — '+esc(partyName):'')+'</div></div><div class="mbody">'+who+'<label class="fl">' + tx('Resolution note (required)') + '</label><textarea id="resnote" data-testid="dispute-resolve-note" oninput="window.CBOffline&&CBOffline.saveDraft(\'disp.resolve.'+disputeId+'\',this.value)" placeholder="How was this resolved…">'+esc((window.CBOffline&&CBOffline.loadDraft('disp.resolve.'+disputeId))||'')+'</textarea><div class="err" id="res_err"></div></div><div class="mfoot"><button onclick="closeModal()">' + tx('Cancel') + '</button><button class="pri" data-testid="dispute-resolve-submit" onclick="submitResolve(\''+chitId+'\',\''+disputeId+'\',\''+(partyId||'')+'\')">' + tx('Resolve') + '</button></div>');
}
async function submitResolve(chitId, disputeId, partyId){
  var note=val("resnote"); var err=document.getElementById("res_err"); if(err)err.textContent="";
  if(!note){ if(err)err.textContent="A resolution note is required."; return; }
  var body={resolution_note:note}; if(partyId)body.target_entity_id=partyId;
  try{ var _rr=await api("resolveDispute",{params:{id:chitId,disputeId},body}); if(window.CBOffline)CBOffline.clearDraft('disp.resolve.'+disputeId); closeModal(); toast(MSG.disputeResolved());
    if(document.getElementById("disprows"))loadDisputes();
    if(UI.sel===chitId){ var i=UI.rows.findIndex(function(x){return x.id===chitId;});
      // FULLY resolved → 0 open, but bump the resolved count so openChit STILL fetches disputes (else the Closed
      // dispute + its wall vanish). Partial (per-party) resolve leaves dispute=true, so the fetch already fires.
      if(i>=0 && _rr && _rr.status==='resolved'){ UI.rows[i].dispute=false; UI.rows[i].dispResolved=(UI.rows[i].dispResolved||0)+1; }
      await openChit(chitId); } }
  catch(e){ if(err)err.textContent=e.message; }
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * ⭐ CBDispute — THE DISPUTE CAPABILITY IN A SMALL APP (T3-DISPUTES-ASSIST, 14 Oct: CB Tasks & Orders › Disputes; a dispute is work).
 *
 * The SAME capability as the workshop screen above, carried by this file so there is one home for dispute behaviour — but drawn the
 * small app's way, needing none of the workshop's globals (UI · modal · listCtl · lazyWrap · chitIsSelf):
 *   mount(el)          the list — CBList, server-paged (GET /chits/disputes/queue ?status · side · q · sort · page · limit): search,
 *                      filters (Where it is · Side), sort (oldest first — the queue's own rule, above), the pager, the count. A row opens
 *                      the CHIT SHEET (CBSheet.open — the one chit popup), never a page of its own.
 *   inSheet(el, id)    the chit sheet's dispute section (chit-sheet.js gives it a place): each dispute with whom · why · where it stands,
 *                      its own room (CBThread, dispute-scoped), Resolve and Raise — shown always, greyed WITH the server's sentence
 *                      (GET /chits/:id/disputes → actions.raise · disputes[].actions.resolve, api lib/dispute-may). Who a dispute may name
 *                      is the server's (raise_parties); "with whom" is the server's (others) — the page decides nothing.
 * Every write goes through CBAction (M64): Raise (POST /chits/:id/disputes) · Resolve (PUT …/resolve, per party or all).
 * REUSE: CBList (list-ctl.js) · CBSheet (chit-sheet.js) · CBThread (rail-thread.js) · CBAction (accounts-shell.js) · CBTasks.actRow
 *   (cap-tasks.js) · disputeByline (above) · CB_DISPUTE_EP (accounts-shell.js) · CBLocale.date.
 * Flow (docs/process/flows.json, rows added this round): DSP step 1 · raise (mount · raise) · DSP step 2 · resolve (inSheet · resolve).
 * NEW PATH (rule 4): the workshop's list (paintDisputes) and forms (quickDispute · resolveDispute) are app.html modals over its globals and
 *   ask nothing of the server; lifting them would have meant shimming six globals into every small app. The workshop keeps them; moving
 *   app.html onto CBDispute is the next step (named in the PR).
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';
  var DP = { el: null, rows: [], total: 0, page: 1, limit: 50, counts: null, q: '', filt: { status: 'open' }, sort: 'old', list: null, focus: null };
  var SH = { id: null, el: null, data: null, err: null, raising: false, talk: {}, threads: {} };
  var KIND = { quality: 'Quality', quantity: 'Quantity', delivery: 'Delivery', payment: 'Payment', docs: 'Documents', other: 'Other' };

  function T(s) { return typeof root.tx === 'function' ? root.tx(s) : s; }
  function $(id) { return root.document.getElementById(id); }
  function say(lvl, msg) { if (typeof root.cblog === 'function') root.cblog(lvl, msg); }
  function call(key, o) { if (typeof EP !== 'undefined' && root.CB_DISPUTE_EP) for (var k in root.CB_DISPUTE_EP) if (!EP[k]) EP[k] = root.CB_DISPUTE_EP[k]; return root.api(key, o); }
  function kindWord(c) { return T(KIND[c] || 'Other'); }
  function dayWord(ts) { if (!ts) return ''; try { return root.CBLocale.date(ts, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { say('warn', 'dispute date unreadable: ' + ts); return String(ts).slice(0, 10); } }
  function withWord(d) { return (d.others || []).map(function (p) { return p.display_name || T('a party'); }).join(', ') || T('everyone on the chit'); }
  function actRow(id, label, may, extra, cls) { return root.CBTasks.actRow(id, label, may, extra, cls); }
  function failWords(e, what) {
    if (e && e.status === 403) return T('This sign-in cannot open disputes');
    return T("Couldn't read") + ' ' + T(what) + '. ' + T('Check the connection and try again.');
  }

  /* ── the list (DSP step 1 · the queue) ── */
  function query() {
    var q = { status: DP.filt.status || 'all', sort: DP.sort, page: DP.page, limit: DP.limit };
    if (DP.filt.side) q.side = DP.filt.side;
    if (DP.q) q.q = DP.q;
    return q;
  }
  function listLoad() {
    return call('disputeQueue', { query: query() }).then(function (j) {
      j = j || {};
      if (j.code === 'DISPUTES_NOT_SET_UP') return listFail(null, T('Disputes are not set up on this server yet.'));
      DP.rows = Array.isArray(j.rows) ? j.rows : []; DP.total = j.total == null ? DP.rows.length : Number(j.total); DP.counts = j.counts || null;
      if (!DP.list) listMount(); else DP.list.refresh({ rows: function () { return DP.rows; } });
      bar();
    }, function (e) { say('error', 'disputes: the queue could not be read — ' + ((e && e.message) || e)); listFail(e); });
  }
  function listFail(e, words) {
    if (!DP.el) return;
    if (DP.list) { try { DP.list.destroy(); } catch (x) { say('warn', 'disputes: list teardown — ' + x.message); } DP.list = null; }
    DP.el.innerHTML = '<div class="empty" data-testid="dp-fail"><div class="t">' + esc(words || failWords(e, 'the disputes')) + '</div>'
      + '<button type="button" class="act" id="dp_retry" data-testid="dp-retry">' + esc(T('Try again')) + '</button></div>';
    $('dp_retry').onclick = function () { mount(DP.el); };
  }
  function bar() {
    var b = $('dp_bar'); if (!b) return;
    var c = DP.counts;
    b.innerHTML = c ? '<span class="tk-count" data-testid="dp-count"><b>' + esc(c.open) + '</b> ' + esc(T('open')) + ' · ' + esc(c.resolved) + ' ' + esc(T('resolved')) + '</span>' : '';
  }
  function pages() { return Math.max(1, Math.ceil(DP.total / DP.limit)); }
  function pagerHTML() {
    if (DP.total <= DP.limit) return '';
    var n = pages();
    return '<div class="tk-act dp-pager" data-testid="dp-pager"><button type="button" class="act quiet" data-dp-page="-1" data-testid="dp-prev"' + (DP.page <= 1 ? ' disabled' : '') + '>‹ ' + esc(T('Back')) + '</button>'
      + '<span class="sub" data-testid="dp-page">' + esc(T('Page')) + ' ' + DP.page + ' ' + esc(T('of')) + ' ' + n + '</span>'
      + '<button type="button" class="act quiet" data-dp-page="1" data-testid="dp-next"' + (DP.page >= n ? ' disabled' : '') + '>' + esc(T('Next')) + ' ›</button></div>';
  }
  function whereCell(d) {
    var open = d.status === 'open';
    return '<span class="tag ' + (open ? 'amber' : 'green') + '" data-testid="dp-word-' + esc(d.dispute_id) + '">' + esc(T(open ? 'Open' : 'Resolved')) + '</span> '
      + '<span class="sub">' + esc(T(d.mine ? 'You raised' : 'Against you')) + '</span>';
  }
  function cols() {
    return [
      { key: 'what', label: T('What'), prio: 1, w: 240, html: true, value: function (d) { return d.auto_subject || ''; },
        cell: function (d) { return '<b>' + esc(d.auto_subject || d.purpose || T('Chit')) + '</b> <span class="sub">' + esc(kindWord(d.category)) + '</span>'; } },
      { key: 'where', label: T('Where it is'), prio: 2, w: 190, html: true, cell: whereCell, value: function (d) { return d.status; } },
      { key: 'with', label: T('With'), prio: 3, w: 170, cell: withWord, value: withWord },
      { key: 'why', label: T('Why'), prio: 4, w: 260, cell: function (d) { return d.reason || ''; } },
      { key: 'when', label: T('Raised on'), prio: 5, w: 130, cell: function (d) { return dayWord(d.created_at); } },
      { key: 'note', label: T('How it ended'), prio: 6, w: 220, cell: function (d) { return d.resolution_note || ''; } }
    ];
  }
  function listMount() {
    var host = $('dp_list'); if (!host) return;
    DP.list = root.CBList.mount(host, {
      key: 'disputes', t: T, rows: function () { return DP.rows; }, id: function (d) { return d.dispute_id; }, rowTid: function (d) { return 'dp-row-' + d.dispute_id; },
      columns: cols(), defaultCols: ['what', 'where', 'with'],
      filters: [
        { key: 'status', label: T('Where it is'), all: T('Open and resolved'), options: [{ v: 'open', label: T('Still open') }, { v: 'resolved', label: T('Resolved') }] },
        { key: 'side', label: T('Side'), all: T('Both sides'), options: [{ v: 'mine', label: T('Raised by you') }, { v: 'against', label: T('Against you') }] }
      ],
      sorts: [{ key: 'old', label: T('Oldest first') }, { key: 'new', label: T('Newest first') }],
      preset: { filt: { status: 'open' } },
      remote: { filters: true, total: function () { return DP.total; }, foot: pagerHTML,
        onQuery: function (q) {
          DP.q = String(q.q || '').trim(); DP.filt = q.filt || {}; if (q.sort && q.sort.key) DP.sort = q.sort.key === 'new' ? 'new' : 'old';
          DP.page = 1; listLoad();
        } },
      onOpen: function (d) { open(d); },
      empty: { title: T(DP.filt.status === 'open' ? 'No open disputes' : 'No disputes here') }
    });
  }
  /** a row → the chit sheet, with this dispute's room open (the sheet's dispute section reads the focus) */
  function open(d) {
    DP.focus = { chit: d.chit_id, dispute: d.dispute_id };
    if (root.CBSheet && root.CBSheet.open) return root.CBSheet.open(d.chit_id);
    say('error', 'disputes: the chit sheet is not on this page');
  }
  function mount(el) {
    DP.el = el; DP.page = 1;
    if (DP.list) { try { DP.list.destroy(); } catch (x) { say('warn', 'disputes: list teardown — ' + x.message); } DP.list = null; }
    el.innerHTML = '<div class="tk-top" id="dp_bar" data-testid="dp-bar"></div><div class="tk-list" id="dp_list" data-testid="dp-list"><div class="loadwrap"><span class="spin"></span> ' + esc(T('Loading')) + '</div></div>';
    $('dp_list').innerHTML = '';
    el.onclick = function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-dp-page]') : null;
      if (!b || b.disabled) return;
      DP.page = Math.min(pages(), Math.max(1, DP.page + Number(b.getAttribute('data-dp-page')))); listLoad();
    };
    return listLoad();
  }

  /* ── the chit sheet's section (DSP step 1 · raise · DSP step 2 · resolve) ── */
  function inSheet(el, id) {
    SH = { id: id, el: el, data: null, err: null, raising: false, talk: {}, threads: {} };
    if (DP.focus && DP.focus.chit === id) SH.talk[DP.focus.dispute] = true;
    sheetRead();
  }
  function sheetRead() {
    var id = SH.id, el = SH.el;
    return call('disputes', { params: { id: id } }).then(function (j) {
      if (SH.id !== id) return; SH.data = j || { disputes: [] }; SH.err = null; sheetPaint();
    }, function (e) {
      if (SH.id !== id) return; say('error', 'disputes: this chit\'s disputes could not be read — ' + ((e && e.message) || e)); SH.err = failWords(e, 'the disputes on this chit'); sheetPaint();
    }).then(function () { return el; });
  }
  function disputeHTML(d) {
    var k = esc(d.dispute_id);
    return '<div class="tk-panel" data-testid="dp-one-' + k + '">'
      + '<div class="tk-line-top"><b>' + esc(kindWord(d.category)) + '</b> ' + whereCell(d) + '</div>'
      + '<div class="sub" data-testid="dp-with-' + k + '">' + esc(T('With')) + ' ' + esc(withWord(d)) + ' · ' + esc(T('raised by')) + ' ' + esc(d.raised_by_display_name || '') + ' · ' + esc(dayWord(d.created_at)) + '</div>'
      + '<div data-testid="dp-why-' + k + '">' + esc(d.reason || '') + '</div>'
      + (d.resolution_note ? '<div class="sub">✓ ' + esc(d.resolution_note) + '</div>' : '')
      + '<div class="tk-line-acts">' + actRow('dp_res_' + k, T('Resolve'), (d.actions && d.actions.resolve) || { ok: false, say: T('Resolve is not answered for this dispute') })
      + '<div class="tk-act"><button type="button" class="act quiet" id="dp_talk_' + k + '" data-testid="dp_talk_' + k + '">' + esc(T(SH.talk[d.dispute_id] ? 'Hide messages' : 'Messages')) + '</button></div></div>'
      + '<div id="dp_rmore_' + k + '"></div>'
      + '<div id="dp_room_' + k + '" data-testid="dp-room-' + k + '"' + (SH.talk[d.dispute_id] ? '' : ' hidden') + '></div></div>';
  }
  function raiseHTML() {
    var parties = (SH.data && SH.data.raise_parties) || [];
    return '<div class="tk-panel" data-testid="dp-raise-form"><label class="sub" for="dp_cat">' + esc(T('What is wrong?')) + '</label>'
      + '<select class="inp" id="dp_cat" data-testid="dp-cat">' + Object.keys(KIND).map(function (c) { return '<option value="' + c + '"' + (c === 'other' ? ' selected' : '') + '>' + esc(kindWord(c)) + '</option>'; }).join('') + '</select>'
      + '<label class="sub" for="dp_reason">' + esc(T('Say what happened (at least 10 letters)')) + '</label>'
      + '<textarea class="inp" id="dp_reason" data-testid="dp-reason" rows="3" maxlength="1000"></textarea>'
      + (parties.length ? '<div class="sub">' + esc(T('Between which parties? None ticked = everyone on the chit.')) + '</div>' + parties.map(function (p, i) {
          return '<label class="sub"><input type="checkbox" class="dp-party" value="' + esc(p.entity_id) + '" data-testid="dp-party-' + i + '"> ' + esc(p.display_name || T('a party')) + '</label>'; }).join('') : '')
      + '<button type="button" class="act" id="dp_raise_go" data-testid="dp-raise-go">' + esc(T('Raise dispute')) + '</button></div>';
  }
  function sheetPaint() {
    var el = SH.el; if (!el) return;
    Object.keys(SH.threads).forEach(function (k) { try { SH.threads[k].destroy(); } catch (x) { say('warn', 'disputes: room teardown — ' + x.message); } });
    SH.threads = {};
    var keep = $('dp_out') ? $('dp_out').textContent : '';
    var h = '<div class="cs-sec">' + esc(T('Disputes')) + '</div>';
    if (SH.err) h += '<div class="cs-mute" data-testid="dp-sheet-fail">' + esc(SH.err) + ' <button type="button" class="act quiet" id="dp_sheet_retry">' + esc(T('Try again')) + '</button></div>';
    else if (!SH.data) h += '<div class="cs-mute">' + esc(T('Reading…')) + '</div>';
    else {
      var ds = SH.data.disputes || [];
      h += ds.length ? ds.map(disputeHTML).join('') : '<div class="sub" data-testid="dp-none">' + esc(T('No dispute on this chit.')) + '</div>';
      h += actRow('dp_raise', T('⚑ Raise a dispute'), (SH.data.actions && SH.data.actions.raise) || { ok: false, say: T('Raise is not answered for this chit') }) + (SH.raising ? raiseHTML() : '');
    }
    h += '<div id="dp_out" class="tk-out" role="status" data-testid="dp-out">' + esc(keep) + '</div>';
    el.innerHTML = h;
    var rt = $('dp_sheet_retry'); if (rt) rt.onclick = function () { SH.err = null; sheetPaint(); sheetRead(); };
    if (!SH.data) return;
    var rb = $('dp_raise'); if (rb && !rb.disabled) rb.onclick = function () { raiseAsk(); };
    var go = $('dp_raise_go'); if (go) go.onclick = function () { raise(go); };
    (SH.data.disputes || []).forEach(function (d) {
      var k = d.dispute_id, r = $('dp_res_' + k), t = $('dp_talk_' + k);
      if (r && !r.disabled) r.onclick = function () { resolveAsk(d); };
      if (t) t.onclick = function () { SH.talk[k] = !SH.talk[k]; sheetPaint(); };
      if (SH.talk[k]) room(d);
    });
  }
  /** one dispute's room: CBThread, dispute-scoped (the roster's audience), read-only once resolved — mounted only when asked for */
  function room(d) {
    var box = $('dp_room_' + d.dispute_id); if (!box || !root.CBThread) return;
    SH.threads[d.dispute_id] = root.CBThread.mount(box, { chit_id: SH.id, dispute_id: d.dispute_id, channel: 'external', readOnly: d.status !== 'open', party: withWord(d),
      context: { host: 'tasks-dispute' }, decorate: typeof disputeByline === 'function' ? disputeByline : undefined });   /* CBThread hands decorate the message TEXT */
  }
  function raiseAsk() { SH.raising = true; sheetPaint(); var r = $('dp_reason'); if (r) { r.focus(); if (r.scrollIntoView) r.scrollIntoView({ block: 'center' }); } }
  function changed() { return sheetRead().then(function () { if (DP.el && root.document.body.contains(DP.el)) return listLoad(); }); }
  function raise(btn) {
    var reason = String(($('dp_reason') || {}).value || '').trim(), cat = ($('dp_cat') || {}).value || 'other';
    if (reason.length < 10) { $('dp_out').textContent = T('Say a little more — at least 10 letters.'); return; }
    var parties = [].slice.call(SH.el.querySelectorAll('.dp-party:checked')).map(function (x) { return x.value; });
    var body = { category: cat, reason: reason }; if (parties.length) body.participant_entity_ids = parties;
    return root.CBAction.run(btn, function () { return call('dispute', { params: { id: SH.id }, body: body }); },
      { key: 'dp-raise-' + SH.id, failed: T("The dispute didn't go through"), out: 'dp_out',
        outcome: function (r) { SH.raising = false; $('dp_out').textContent = T('Dispute raised. The other side is told.') + (r && r.warning ? ' ' + r.warning : ''); changed(); } });
  }
  function resolveAsk(d) {
    var host = $('dp_rmore_' + d.dispute_id); if (!host) return;
    var open = (d.others || []).filter(function (p) { return p.role === 'party' && p.dispute_status !== 'resolved'; });
    host.innerHTML = '<div class="tk-panel">'
      + (open.length > 1 ? '<label class="sub" for="dp_rwho">' + esc(T('With whom?')) + '</label><select class="inp" id="dp_rwho" data-testid="dp-rwho"><option value="">' + esc(T('Everyone still open')) + '</option>'
        + open.map(function (p) { return '<option value="' + esc(p.entity_id) + '">' + esc(p.display_name || T('a party')) + '</option>'; }).join('') + '</select>' : '')
      + '<label class="sub" for="dp_rnote">' + esc(T('How was it settled?')) + '</label><textarea class="inp" id="dp_rnote" data-testid="dp-rnote" rows="2" maxlength="1000"></textarea>'
      + '<button type="button" class="act" id="dp_rgo" data-testid="dp-rgo">' + esc(T('Resolve')) + '</button></div>';
    $('dp_rnote').focus();
    $('dp_rgo').onclick = function () {
      var note = String($('dp_rnote').value || '').trim(), who = $('dp_rwho') ? $('dp_rwho').value : '';
      if (!note) { $('dp_out').textContent = T('Say how it was settled first.'); return; }
      var body = { resolution_note: note }; if (who) body.target_entity_id = who;
      root.CBAction.run($('dp_rgo'), function () { return call('resolveDispute', { params: { id: SH.id, disputeId: d.dispute_id }, body: body }); },
        { key: 'dp-resolve-' + d.dispute_id, failed: T("That didn't resolve it"), out: 'dp_out',
          outcome: function (r) { $('dp_out').textContent = r && r.fully_resolved === false ? T('Resolved with them. Still open for the others.') : T('Resolved.'); changed(); } });
    };
  }

  /* sheet: false until a page opts in (tasks.html sets it) — the chit sheet then paints inSheet; app.html's sheet keeps the workshop's own form */
  root.CBDispute = { mount: mount, reload: listLoad, inSheet: inSheet, raise: raiseAsk, sheet: false, EP: root.CB_DISPUTE_EP };
})(typeof window !== 'undefined' ? window : globalThis);
