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

/* ── Advanced-search dispute filter (was inline in Core toolbar + adv modal). The ⚠ N chip surfaces on
 *    task/order lists when open disputes exist (or the filter is on); toggling adds dispute='open' to
 *    UI.adv. dispSearchRow = the checkbox inside the advanced-search modal. Core calls both via typeof,
 *    so a customer / dispute-blind Core just omits them.
 *    NOTE (FR-D12): a stricter hasCap('dispute') gate is deliberately NOT applied — a non-opted entity can
 *    still be a dispute TARGET and needs to find the disputed record. Revisit if opt-in must fully hide it. */
function dispChipHtml(){
  if(["task","order"].indexOf(UI.folder)<0) return '';
  var n=UI.disputeOpen||0, on=(UI.adv||{}).dispute; if(!n && !on) return '';
  return '<button class="advbtn'+(on?' on':'')+'" style="color:#b4453f;border-color:#f0c9c6'+(on?';background:#fbeceb':'')+'" onclick="event.stopPropagation();toggleDisputeFilter()" title="Chits with an open dispute">⚠ '+n+'</button>';
}
function toggleDisputeFilter(){ var a=UI.adv||{}; if(a.dispute){delete a.dispute;}else{a.dispute='open';} UI.adv=a; UI.sel=null; UI.detail=null; renderApp(); }
function dispSearchRow(a){ a=a||{}; return '<div class="advrow"><label>Dispute</label><label class="advchk"><input type="checkbox" id="adv_disp" '+(a.dispute?'checked':'')+'> ⚠ Only open disputes</label></div>'; }

/* ── On-record DISPUTE PANEL (was the banner) — the USP as a self-contained space ON the chit.
 *    Open|Closed tabs; each dispute is a selectable row that expands into its OWN ROOM: reason + its own
 *    message thread (only THIS dispute's messages) + an external-only compose + raiser resolve. A CLOSED
 *    dispute keeps its thread READ-ONLY (messages live forever — chit_messages are never deleted and stay
 *    visible to participants regardless of status). 1 or many disputes = identical interaction: pick → room.
 *    Dispute messaging is external-only (participant-scoped); internal team notes use the normal Messages tab. */
function setDispTab(t){ UI.dispTab=t; UI.dispRoom=null; paintDetail(); }
function toggleDispRoom(did){ UI.dispRoom=(String(UI.dispRoom)===String(did))?null:did; paintDetail(); }
function disputeBanner(c){
  var all=((c&&c.disputes)||[]);
  var open=all.filter(function(d){ return d.status==='open'; });
  var closed=all.filter(function(d){ return d.status!=='open'; });
  if(!open.length && !closed.length) return '';
  var tab=UI.dispTab||'open';
  if(tab==='closed' && !closed.length) tab='open';
  if(tab==='open'   && !open.length)   tab='closed';
  var list=(tab==='open')?open:closed;
  var proof=c.proof==='ok'?'<span class="db-proof">⚖️ both-signed record</span>':'';
  var pill=function(t,label,n,on){ return '<button onclick="setDispTab(\''+t+'\')" style="border:1px solid '+(on?'#d98a84':'var(--line)')+';background:'+(on?'#fbeceb':'#fff')+';color:'+(on?'#b4453f':'var(--grey)')+';font-weight:'+(on?'700':'500')+';border-radius:7px;padding:2px 10px;font-size:11.5px;cursor:pointer">'+label+' '+n+'</button>'; };
  var head='<div class="db-row" style="align-items:center"><span class="db-tag">⚑ Disputes</span>'+proof
    +'<span style="margin-left:auto;display:inline-flex;gap:6px">'+pill('open','Open',open.length,tab==='open')+pill('closed','Closed',closed.length,tab==='closed')+'</span></div>';
  var expanded=UI.dispRoom||(list.length===1?list[0].dispute_id:null);   // single → auto-open; many → pick one
  var rows=list.length
    ? list.map(function(d){ return disputeRow(c,d,String(expanded)===String(d.dispute_id)); }).join('')
    : '<div style="font-size:12px;color:var(--grey);padding:8px 2px">No '+tab+' disputes.</div>';
  return '<div class="dispbanner">'+head+rows+'</div>';
}
/* one dispute = a clickable header that expands into its room (accordion — one at a time) */
function disputeRow(c, d, isOpen){
  var parties=disputeParties(d);
  var chips=disputeChips(parties, 'dpchip');
  var resolved=d.status!=='open';
  var stPill=resolved?'<span style="color:#3c8a52;font-size:11px;font-weight:700">✓ resolved</span>'
                     :'<span style="color:#b4453f;font-size:11px;font-weight:700">● open</span>';
  var hdr='<div onclick="toggleDispRoom(\''+d.dispute_id+'\')" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:7px 0">'
    +'<span style="color:var(--grey);width:12px;flex:none">'+(isOpen?'▾':'▸')+'</span>'
    +'<span class="db-cat">'+esc(cap(d.category||''))+'</span>'
    +(parties.length?'<span style="font-size:11.5px;color:var(--grey)">with '+chips+'</span>':'')
    +'<span style="margin-left:auto">'+stPill+'</span></div>';
  return '<div style="border-top:1px dashed #f0c9c6">'+hdr+(isOpen?disputeRoom(c,d,resolved):'')+'</div>';
}
/* the room: reason + (resolution note if closed) + THIS dispute's thread + external compose (open only) + resolve */
function disputeRoom(c, d, readonly){
  var mine=chitIsSelf(d.raised_by_entity_id, d.raised_by_display_name);
  var parties=disputeParties(d);
  var msgs=(typeof disputeFilterMsgs==='function')?(disputeFilterMsgs((c.msgs||[]),'dispute',d.dispute_id)||[]):[];
  var thread=msgs.length?msgs.map(function(m){ return (typeof msgBubble==='function')?msgBubble(m):''; }).join('')
    :'<div style="font-size:12px;color:var(--grey);padding:6px 2px">No messages in this dispute yet.</div>';
  var reason='<div class="db-reason">'+esc(d.reason||'')+'</div><div class="db-meta" style="margin-bottom:6px">raised by '+nm(d.raised_by_display_name,'—')+'</div>';
  var resnote=(readonly&&d.resolution_note)?'<div style="font-size:12px;color:#2f7a45;background:#eef7f0;border:1px solid #cde7d4;border-radius:8px;padding:6px 9px;margin-bottom:6px">✓ Resolution: '+esc(d.resolution_note)+'</div>':'';
  var to=parties.length?esc(parties.map(function(p){ return p.display_name||'party'; }).join(", ")):'participants';
  var compose=readonly?'':'<div style="display:flex;gap:6px;align-items:flex-end;margin-top:8px">'
    +'<textarea id="droom-'+d.dispute_id+'" placeholder="Reply to this dispute — '+to+' will see this" style="flex:1;min-height:44px;border:1px solid var(--line);border-radius:8px;padding:7px;font:inherit;font-size:13px;resize:vertical"></textarea>'
    +'<button onclick="sendDisputeMsg(\''+c.id+'\',\''+d.dispute_id+'\')" style="border:none;background:#b4453f;color:#fff;border-radius:8px;padding:9px 13px;font-weight:600;cursor:pointer;white-space:nowrap">Send ↔</button></div>';
  var res=readonly?'':disputeResolveBtns(parties, c.id, d.dispute_id, mine, 'db-res');
  return '<div style="padding:2px 0 10px 20px">'+reason+resnote
    +'<div style="border:1px solid var(--line);border-radius:9px;padding:6px;background:#fbfbfa;max-height:280px;overflow:auto">'+thread+'</div>'
    +compose+(res?'<div class="db-acts" style="margin-top:8px">'+res+'</div>':'')+'</div>';
}
/* external-only send scoped to THIS dispute (its own compose box → is_dispute + dispute_id, no channel toggle) */
async function sendDisputeMsg(chitId, disputeId){
  var el=document.getElementById('droom-'+disputeId); var body=(el?el.value:'').trim();
  if(!body){ toast('Type a reply first.'); return; }
  var txt=SESSION.actorId?(body+"  — "+(SESSION.name||"actor")+"@"+(SESSION.entity||"")):body;
  var mb={ thread_type:'external', message_text:txt, msg_type:'info', is_dispute:true, dispute_id:disputeId };
  busyShow('Sending…');
  try{ await api("sendMsg",{params:{id:chitId},body:mb}); }catch(e){ busyHide(); toast(MSG.fail("send the reply", e)); return; }
  UI.dispRoom=disputeId;                                  // keep this room open after posting
  try{ await openChit(chitId, true); }catch(_){}
  busyHide(); paintDetail();
  toast('Reply sent');
}

/* Composer "reply in the dispute" toggle + per-dispute filter chips REMOVED 2026-07-05 — dispute messaging
 * moved INTO each dispute's room (see disputeRoom/sendDisputeMsg above). The general Messages tab is now
 * normal (Internal/External only, dispute messages hidden). Dispute channel = external-only, in the room. */

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
