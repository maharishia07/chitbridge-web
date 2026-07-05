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
    ? open.map(function(p){ return '<button class="'+b+'" onclick="resolveDispute(\''+chitId+'\',\''+disputeId+'\',\''+p.entity_id+'\',\''+encodeURIComponent(p.display_name||'party')+'\')">Resolve '+nm(p.display_name,'party')+'</button>'; }).join('')
    : '<button class="'+b+'" onclick="resolveDispute(\''+chitId+'\',\''+disputeId+'\')">Resolve</button>';
  return inner;
}

/* Opponent label from the viewer's side: the parties (targets) excluding self; if the viewer IS the
 * target (so no party chip is theirs), the opponent is the raiser. Used by the per-dispute thread chips. */
function disputeOppLabel(d){
  var p=disputeParties(d);
  if(p.length) return p.map(function(x){ return x.display_name||'party'; }).join(', ');
  return nm(d.raised_by_display_name,'party');
}
/* ── Per-dispute thread filter chips — the "manage each group separately" control. Keyed on dispute_id
 *    (the identifier already on every chit_messages row). Renders ONLY when 2+ disputes are open; with 0/1
 *    Core's single ⚑ Disputes button suffices. "All" clears the selection; each chip narrows the thread to
 *    that one dispute AND (via setMsgDisp) binds the composer reply to the SAME dispute — so read-thread and
 *    reply-thread never diverge (closes the "reply lands in the first dispute" ambiguity). */
function disputeFilterChips(c, sel, f){
  var od=((c&&c.disputes)||[]).filter(function(d){ return d.status==='open'; });
  if(od.length<2) return '';
  var allOn=(f==='dispute'&&!sel);
  var chips=od.map(function(d){
    var on=(f==='dispute'&&String(sel)===String(d.dispute_id));
    var lb=disputeOppLabel(d); if(lb.length>16) lb=lb.slice(0,15)+'…';
    return '<button class="'+(on?'on disp':'')+'" onclick="setMsgDisp(\''+d.dispute_id+'\')">⚑ '+esc(lb)+'</button>';
  }).join('');
  return '<button class="'+(allOn?'on disp':'')+'" onclick="setMsgDisp(\'\')">⚑ All</button>'+chips;
}

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

/* msgBubble → the header badge for a dispute message: ⚑ Dispute [raised] (red) / [resolved] (green).
 * '' for a non-dispute message, so Core falls back to its normal external/internal + type badges. */
function disputeBadge(m){
  if(!m||!m.isDispute) return '';
  return /^\[resolved\]/i.test(String(m.body||''))
    ? '<span class="mbadge disp ok">⚑ Dispute [resolved]</span>'
    : '<span class="mbadge disp">⚑ Dispute [raised]</span>';
}
/* mapApiMsg → split the trailing "— actor@entity" provenance a dispute message carries into a byline.
 * Returns {by, body}; on a plain message (or no marker) by=null and body is unchanged. */
function disputeByline(body){
  var b=body||''; if(!b) return { by:null, body:b };
  var mm=b.match(/\s+[—-]\s+(\S+@.+?)\s*$/);
  if(mm) return { by:mm[1].trim(), body:b.slice(0,mm.index).replace(/\s+$/,'') };
  return { by:null, body:b };
}
/* messagesTab → the dispute thread filter. Returns the filtered list when f==='dispute' (all dispute
 * messages, narrowed to one dispute group when a chip is selected); undefined = "not mine, Core handles
 * all/internal/external as usual". */
function disputeFilterMsgs(visible, f, sel){
  if(f!=='dispute') return undefined;
  var s=(visible||[]).filter(function(m){ return m.isDispute; });
  if(sel) s=s.filter(function(m){ return String(m.disputeId)===String(sel); });
  return s;
}
/* doSendMessage → when the composer is in dispute mode, stamp the outgoing message: attach is_dispute +
 * the SELECTED (else first open) dispute_id and append the acting actor's "— name@entity" provenance.
 * Mutates mb in place, returns the decorated text; no-op returning body when not in dispute mode. */
function disputeDecorateSend(mb, body){
  if(!UI.msgAsDispute) return body;
  var txt=SESSION.actorId ? (body+"  — "+(SESSION.name||"actor")+"@"+(SESSION.entity||"")) : body;
  var dl=((UI.detail&&UI.detail.disputes)||[]);
  var od=UI.msgDispSel
    ? dl.find(function(d){ return String(d.dispute_id)===String(UI.msgDispSel)&&(d.status||'open')==='open'; })
    : dl.find(function(d){ return (d.status||'open')==='open'; });
  if(od){ mb.is_dispute=true; mb.dispute_id=od.dispute_id; }
  mb.message_text=txt;
  return txt;
}
/* list row → the one-glance dispute count: N open (red) · M resolved (green); '' when neither. */
function dispCell(c){
  var o=(c&&c.dispOpen)||0, r=(c&&c.dispResolved)||0; if(!o&&!r) return '';
  var p=[];
  if(o) p.push('<b style="color:var(--disp)">⚑ '+o+' open</b>');
  if(r) p.push('<span style="color:#3c8a52">✓ '+r+' resolved</span>');
  return '<span class="rowdisp" style="font-size:11px">'+p.join(' <span style="color:var(--line)">·</span> ')+'</span>';
}

/* ── On-record banner (was inline in Core detailInner) — the USP surfaced ON the chit.
 *    MULTI-PARTY: renders ALL concurrent open disputes on one record "under one roof" — e.g. on an A→B,C chit
 *    the viewer B may be party to BOTH an A↔B dispute AND a B↔C dispute; both show at once (previously only
 *    od[0] rendered, so the second was hidden until the first resolved). Each dispute is its own block with its
 *    own parties + raiser-only resolve; a count header shows how many are locked. */
function disputeBannerRow(c, d){
  var parties=disputeParties(d);                                          // the opponent(s) — self excluded
  var mine=chitIsSelf(d.raised_by_entity_id, d.raised_by_display_name);   // only the raiser resolves (BR-D3)
  var chips=disputeChips(parties, 'dpchip');
  var res=disputeResolveBtns(parties, c.id, d.dispute_id, mine, 'db-res');
  return '<div class="db-drow" style="padding:7px 0 2px;border-top:1px dashed #f0c9c6">'
    +'<div class="db-row"><span class="db-cat">'+esc(cap(d.category||''))+'</span>'+(parties.length?'<span style="font-size:11.5px;color:var(--grey)">with '+chips+'</span>':'')+'</div>'
    +'<div class="db-reason">'+esc(d.reason||'')+'</div>'
    +'<div class="db-meta">raised by '+nm(d.raised_by_display_name,'—')+'</div>'
    +'<div class="db-acts"><button onclick="setDtab(\'messages\');setMsgDisp(\''+d.dispute_id+'\')">Open this thread →</button>'+res+'</div>'
    +'</div>';
}
function disputeBanner(c){
  var od=((c&&c.disputes)||[]).filter(function(d){ return d.status==='open'; });
  if(!od.length) return '';
  var proof=c.proof==='ok'?'<span class="db-proof">⚖️ both-signed record</span>':'';
  var head=od.length>1                                                    // count header only when >1 (multi-party)
    ? '<div class="db-row"><span class="db-tag">⚑ '+od.length+' disputes open on this record</span>'+proof+'</div>'
    : '<div class="db-row"><span class="db-tag">⚑ Open dispute</span>'+proof+'</div>';
  var rows=od.map(function(d){ return disputeBannerRow(c,d); }).join('');   // each block deep-links to its OWN thread
  return '<div class="dispbanner">'+head+rows+'</div>';
}

/* ── Composer "reply in the dispute" toggle (was inline in Core messagesTab). Only on an open-dispute
 *    chit and never for a customer; posts the reply as is_dispute against the open dispute (FR-D6). */
function disputeToggleHtml(c, isCust){
  var openDisp=((c&&c.disputes)||[]).find(function(d){ return (d.status||'open')==='open'; });
  if(isCust||!openDisp){ UI.msgAsDispute=false; return ''; }
  return '<button class="msgfbtn'+(UI.msgAsDispute?' on':'')+'" style="margin:2px 0 4px" onclick="toggleMsgDispute()">⚑ '
    +(UI.msgAsDispute?'Posting as DISPUTE reply — click to stop':'Reply in the dispute')+'</button>';
}
function toggleMsgDispute(){ UI.msgAsDispute=!UI.msgAsDispute; paintDetail(); }

/* ── Disputes screen (the opt-in queue, BR-D4): every disputed record, split raised-by-you / against-you,
 *    each card reusing the shared roster renderers. Loaded lazily; the nav is capability-gated. */
function disputesScreen(){ return '<div style="padding:14px;max-width:760px;margin:0 auto"><div class="sec" style="font-size:15px;margin-bottom:3px;display:flex;align-items:center;gap:9px">⚖️ Disputes<button onclick="openAssist(\'disputes\')" title="About this screen" style="border:1px solid var(--line);background:#fff;color:#3F66A6;border-radius:50%;width:22px;height:22px;font-weight:800;cursor:pointer;font-size:13px;line-height:1;flex:none">?</button></div><div style="font-size:11px;color:var(--grey);margin-bottom:10px">Explore <b onclick="openAssist(\'disputes\')" style="cursor:pointer;color:#3F66A6">?</b> to know more about this screen.</div><div id="disprows"><div class="loadwrap"><span class="spin"></span> loading…</div></div></div>'; }
async function loadDisputes(){
  var host=document.getElementById("disprows"); if(!host)return;
  try{ var q=await api("disputeQueue"); var mine=q.my_disputes||[], other=q.other_disputes||[];
    // card(): one dispute; canResolve = the "raised by you" side (raiser-only resolve, BR-D3).
    var card=function(d,canResolve){
      var parties=disputeParties(d);
      var roster=parties.length?'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px">'+parties.map(function(p){ return '<span class="optchip '+(p.dispute_status==='resolved'?'on':'brk')+'">'+nm(p.display_name,'party')+' · '+(p.dispute_status==='resolved'?'✓ resolved':'open')+'</span>'; }).join('')+'</div>':'';
      var btns=disputeResolveBtns(parties, d.chit_id, d.dispute_id, canResolve && d.status==='open', 'composebtn');
      var resolveRow=btns?'<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">'+btns+'</div>':'';
      return '<div class="card" style="border:1px solid var(--line);border-radius:11px;padding:12px;margin-bottom:9px">'
        +'<div style="display:flex;justify-content:space-between;gap:8px"><b>'+esc(d.auto_subject||d.purpose||'chit')+'</b><span class="optchip '+(d.status==='open'?'brk':'on')+'">'+esc(d.status)+'</span></div>'
        +'<div style="font-size:13px;color:var(--ink);margin:5px 0"><b>'+esc(cap(d.category||''))+'</b> — '+esc(d.reason||'')+'</div>'
        +'<div style="font-size:11.5px;color:var(--grey)">raised by '+nm(d.raised_by_display_name,'—')+' · '+esc(d.scope||'')+(d.resolution_note?(' · ✓ '+esc(d.resolution_note)):'')+'</div>'
        +roster+resolveRow+'</div>';
    };
    host.innerHTML = menuAssist('disputes')+'<div class="sec" style="font-size:12px;color:var(--grey);margin:4px 0">Raised by you ('+mine.length+')</div>'+lazyWrap('dm', mine, function(d){return card(d,true);}, '<div style="color:var(--grey);font-size:13px;padding:6px">None.</div>')
      +'<div class="sec" style="font-size:12px;color:var(--grey);margin:14px 0 4px">Against you / awaiting ('+other.length+')</div>'+lazyWrap('do', other, function(d){return card(d,false);}, '<div style="color:var(--grey);font-size:13px;padding:6px">None.</div>');
  }catch(e){ host.innerHTML='<div class="empty"><div class="t">Couldn\'t load disputes</div><div>'+esc(e.message)+'</div></div>'; }
}

/* ── Raise flow (FR-D1): candidates = everyone on the chit except me (chitIsSelf); ticking parties makes
 *    it a TARGETED dispute (only those parties see it, BR-D2); none ticked = chit-wide. */
async function quickDispute(){ var ids=(typeof needTarget==='function'?needTarget():[]); if(!ids.length)return;
  if(ids.length>1){ toast("Raise a dispute on one chit at a time — each is its own matter."); return; }
  var id=ids[0]; MODALS.disp={id, parties:[]};
  var partyRows='';
  try{ var r=await api("chit",{params:{id}}); var h=(r&&r.header)||r||{}; var seen={};
    var parties=(h.all_recipients||[]).filter(function(x){ return x&&x.entity_id&&!chitIsSelf(x.entity_id,x.display_name)&&!seen[x.entity_id]&&(seen[x.entity_id]=1); });
    MODALS.disp.parties=parties;
    if(parties.length){ partyRows='<div style="font-size:12px;color:var(--grey);margin:9px 0 3px">Between which parties? <span style="color:#9aa3ad">(none ticked = everyone involved)</span></div>'+parties.map(function(p){ return '<label style="display:flex;gap:8px;align-items:center;padding:3px 0;font-size:13px;cursor:pointer"><input type="checkbox" class="dispparty" value="'+p.entity_id+'"> '+nm(p.display_name,'party')+' <span style="font-size:10px;color:var(--grey);text-transform:uppercase">'+esc(p.role||'')+'</span></label>'; }).join(''); }
  }catch(_){}
  modal('<div class="mhd"><div class="t">⚑ Raise dispute</div></div><div class="mbody"><div style="font-size:12px;color:var(--grey);margin-bottom:7px">Pick a category and give a reason (min 10 characters). The parties you select are notified and carry the dispute status.</div><select id="dispcat" style="width:100%;margin-bottom:8px;padding:8px;border:1px solid var(--line);border-radius:6px"><option value="quality">Quality</option><option value="quantity">Quantity</option><option value="delivery">Delivery</option><option value="payment">Payment</option><option value="docs">Docs</option><option value="other" selected>Other</option></select>'+partyRows+'<textarea id="dispreason" placeholder="e.g. Quantity short by 2 units — please replace"></textarea></div><div class="mfoot"><button onclick="closeModal()">Cancel</button><button class="danger" onclick="confirmDispute()">Raise dispute</button></div>');
}
async function confirmDispute(){ var id=MODALS.disp.id; var el=document.getElementById('dispreason'); var reason=(el?el.value:"").trim(); var cat=(document.getElementById('dispcat')||{}).value||'other';
  if(reason.length<10){ toast("Reason must be at least 10 characters"); return; }
  var parties=[].slice.call(document.querySelectorAll('.dispparty:checked')).map(function(e){return e.value;});
  closeModal();
  var body={category:cat,reason}; if(parties.length)body.participant_entity_ids=parties;
  try{ var _dr2=await api("dispute",{params:{id},body}); if(_dr2&&_dr2.warning)toast(_dr2.warning); var i=UI.rows.findIndex(function(x){return x.id===id;}); if(i>=0)UI.rows[i].dispute=true; }catch(e){ toast(MSG.fail("raise the dispute", e)); return; }
  if(typeof refreshRollup==='function')refreshRollup(); toast(MSG.disputeRaised(1)); if(typeof announce==='function')announce('Dispute raised');
  if(UI.sel===id){ UI.dtab='messages'; await openChit(id); } else { renderApp(); }
}

/* ── Resolve flow (BR-D3): raiser-only; per party (partyId) or chit-wide (no partyId). */
function resolveDispute(chitId, disputeId, partyId, partyNameEnc){
  var partyName=partyNameEnc?decodeURIComponent(partyNameEnc):'';
  var who=partyName?'<div style="font-size:12px;color:var(--grey);margin-bottom:8px">Resolving with <b>'+esc(partyName)+'</b>. Any other parties stay open until you resolve them too.</div>':'';
  modal('<div class="mhd"><div class="t">Resolve dispute'+(partyName?' — '+esc(partyName):'')+'</div></div><div class="mbody">'+who+'<label class="fl">Resolution note (required)</label><textarea id="resnote" placeholder="How was this resolved…"></textarea><div class="err" id="res_err"></div></div><div class="mfoot"><button onclick="closeModal()">Cancel</button><button class="pri" onclick="submitResolve(\''+chitId+'\',\''+disputeId+'\',\''+(partyId||'')+'\')">Resolve</button></div>');
}
async function submitResolve(chitId, disputeId, partyId){
  var note=val("resnote"); var err=document.getElementById("res_err"); if(err)err.textContent="";
  if(!note){ if(err)err.textContent="A resolution note is required."; return; }
  var body={resolution_note:note}; if(partyId)body.target_entity_id=partyId;
  try{ await api("resolveDispute",{params:{id:chitId,disputeId},body}); closeModal(); toast(MSG.disputeResolved());
    if(document.getElementById("disprows"))loadDisputes();
    if(UI.sel===chitId){ var i=UI.rows.findIndex(function(x){return x.id===chitId;}); if(i>=0)UI.rows[i].dispute=false; await openChit(chitId); } }
  catch(e){ if(err)err.textContent=e.message; }
}
