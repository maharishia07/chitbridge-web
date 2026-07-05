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
  var b=String(m.body||'');
  // Only the RAISE and the RESOLUTION carry a badge. The backend prefixes the raise with "[category]" and the
  // resolution with "[resolved]"; ordinary replies have no prefix → no badge, just the sender + message.
  if(/^\[resolved\]/i.test(b)) return '<span class="mbadge disp ok">⚑ Dispute [resolved]</span>';
  if(/^\[(quality|quantity|delivery|payment|docs|other)\]/i.test(b)) return '<span class="mbadge disp">⚑ Dispute [raised]</span>';
  return '<span></span>';   // truthy-but-empty so msgBubble shows no int/ext fallback badge — just the reply
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
/* Pick a dispute from the dropdown → its ROOM opens as an overlay over the detail pane; ✕ closes it.
 * Nothing open by default (UI.dispSel=null). One room at a time — 1 or N disputes look identical. */
function disputeSelect(did){
  UI.dispSel=did||null; UI.dispCompose=false; UI.dispFiles=[];
  var dp=document.getElementById('detailpane'); if(dp) dp.style.position='relative';   // anchor the absolute overlay to the pane
  paintDetail();
}
function disputeClose(){ UI.dispSel=null; UI.dispCompose=false; UI.dispFiles=[]; paintDetail(); }
function disputeToggleCompose(){ UI.dispCompose=!UI.dispCompose; if(!UI.dispCompose)UI.dispFiles=[]; paintDetail(); }
function dispOpp(d){ var p=disputeParties(d); return p.length?p.map(function(x){ return x.display_name||'party'; }).join(', '):nm(d.raised_by_display_name,'party'); }
function dispOptGroup(list, label){
  if(!list.length) return '';
  return '<optgroup label="'+label+'">'+list.map(function(d){
    return '<option value="'+d.dispute_id+'"'+(String(UI.dispSel)===String(d.dispute_id)?' selected':'')+'>'+esc(cap(d.category||'')+' · with '+dispOpp(d)+' · '+(d.status==='open'?'● open':'✓ resolved'))+'</option>';
  }).join('')+'</optgroup>';
}
/* the DETAIL dropdown (always shown when disputes exist) + the overlay when one is picked */
function disputeBanner(c){
  var all=((c&&c.disputes)||[]);
  var open=all.filter(function(d){ return d.status==='open'; });
  var closed=all.filter(function(d){ return d.status!=='open'; });
  if(!open.length && !closed.length) return '';
  var proof=c.proof==='ok'?'<span class="db-proof">⚖️ both-signed record</span>':'';
  var head='<div class="db-row"><span class="db-tag">⚑ '+(open.length?open.length+' dispute'+(open.length>1?'s':'')+' open on this record':'Disputes (resolved)')+'</span>'+proof+'</div>';
  var dd='<select onchange="disputeSelect(this.value)" style="width:100%;margin-top:9px;padding:10px 12px;border:1px solid #e5c9c6;border-radius:9px;font-size:13px;background:#fff;color:#1e2226;cursor:pointer">'
    +'<option value="">— select a dispute to open —</option>'+dispOptGroup(open,'OPEN')+dispOptGroup(closed,'CLOSED')+'</select>';
  var sel=UI.dispSel?all.filter(function(d){ return String(d.dispute_id)===String(UI.dispSel); })[0]:null;   // stale id (other chit) → no overlay
  return '<div class="dispbanner">'+head+dd+'</div>'+(sel?disputeOverlay(c, sel, open, closed):'');
}
/* the overlay frame over the detail pane: header + ✕, a dropdown to switch, and the room */
function disputeOverlay(c, d, open, closed){
  var proof=c.proof==='ok'?'<span class="db-proof">⚖️ both-signed record</span>':'';
  var dd='<select onchange="disputeSelect(this.value)" style="width:100%;margin-bottom:12px;padding:8px 11px;border:1px solid #e5c9c6;border-radius:9px;font-size:12.5px;background:#fff;color:#1e2226;cursor:pointer">'
    +dispOptGroup(open,'OPEN')+dispOptGroup(closed,'CLOSED')+'</select>';
  return '<div style="position:absolute;inset:0;background:#fff;display:flex;flex-direction:column;z-index:30">'
    +'<div style="display:flex;align-items:center;gap:8px;padding:13px 16px;border-bottom:1px solid var(--line);background:#fdf0ef">'
      +'<span style="font-weight:700;color:#b4453f;font-size:14px">⚑ '+esc(cap(d.category||''))+'</span>'+proof
      +'<button onclick="disputeClose()" style="margin-left:auto;border:1px solid var(--line);background:#fff;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12.5px">✕ Close</button></div>'
    +'<div style="padding:15px 16px;overflow:auto;flex:1">'+dd+disputeRoomBox(c,d)+'</div></div>';
}
/* one dispute's room: participants · own message wall (latest first, attachments) · New-message (text+attach) · Resolve */
function disputeRoomBox(c, d){
  var readonly=d.status!=='open';
  var mine=chitIsSelf(d.raised_by_entity_id, d.raised_by_display_name);
  var parties=disputeParties(d);
  var st=readonly?'<span style="color:#2f7a45;font-size:11.5px;font-weight:700">✓ resolved</span>':'<span style="color:#b4453f;font-size:11.5px;font-weight:700">● open</span>';
  var resolve=readonly?'':disputeResolveBtns(parties, c.id, d.dispute_id, mine, 'db-res');
  var resolveWrap=resolve?'<span style="display:inline-flex;gap:6px">'+resolve+'</span>':'';
  var roster=[nm(d.raised_by_display_name,'—')+' (raiser)'].concat(parties.map(function(p){ return nm(p.display_name,'party'); })).join(' · ');
  var msgs=(typeof disputeFilterMsgs==='function')?(disputeFilterMsgs((c.msgs||[]),'dispute',d.dispute_id)||[]):[];
  msgs=msgs.slice().reverse();   // latest first (the wall)
  var thread=msgs.length?msgs.map(function(m){ return (typeof msgBubble==='function')?msgBubble(m):''; }).join('')
    :'<div style="font-size:12px;color:var(--grey);padding:6px 2px">No messages in this dispute yet.</div>';
  var to=parties.length?esc(parties.map(function(p){ return p.display_name||'party'; }).join(", ")):'participants';
  var newBtn=readonly?'':'<button onclick="disputeToggleCompose()" style="margin-left:auto;border:1px solid var(--line);background:#fff;border-radius:8px;padding:5px 11px;font-size:12px;cursor:pointer">'+(UI.dispCompose?'✕ Cancel':'✏️ New message')+'</button>';
  var compose=(!readonly&&UI.dispCompose)?disputeComposeBox(c,d,to):'';
  return '<div style="border:1px solid #f0c9c6;border-radius:11px;padding:13px 14px">'
    +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="db-cat">'+esc(cap(d.category||''))+'</span>'
      +(parties.length?'<span style="font-size:12px;color:var(--grey)">with '+disputeChips(parties,'dpchip')+'</span>':'')
      +'<span style="margin-left:auto;display:inline-flex;gap:9px;align-items:center">'+st+resolveWrap+'</span></div>'
    +'<div style="font-size:12px;color:#5a6066;margin:10px 0 2px">Participants: <b>'+esc(roster)+'</b></div>'
    +'<div style="display:flex;align-items:center;margin:13px 0 7px"><span style="font-size:12px;font-weight:700;color:#5a6066">Messages · latest first</span>'+newBtn+'</div>'
    +compose
    +'<div style="border:1px solid var(--line);border-radius:9px;background:#fbfbfa;padding:6px;max-height:340px;overflow:auto">'+thread+'</div></div>';
}
function disputeComposeBox(c, d, to){
  return '<div style="border:1px solid #e5c9c6;border-radius:9px;padding:9px;margin-bottom:10px;background:#fffdfd">'
    +'<div style="font-size:11px;color:#b4453f;font-weight:700;margin-bottom:6px">New message to '+to+'</div>'
    +'<textarea id="droom-'+d.dispute_id+'" placeholder="Message — '+to+' will see this" style="width:100%;box-sizing:border-box;min-height:46px;border:1px solid var(--line);border-radius:8px;padding:7px;font:inherit;font-size:13px;resize:vertical"></textarea>'
    +'<div style="display:flex;align-items:center;gap:8px;margin-top:7px;flex-wrap:wrap">'
      +'<label style="border:1px solid var(--line);background:#fff;border-radius:8px;padding:6px 11px;font-size:12px;cursor:pointer">📎 Attach<input type="file" multiple style="display:none" onchange="disputeAddFiles(this.files);this.value=\'\'"></label>'
      +'<span id="dispfiles">'+disputeFileChips()+'</span>'
      +'<button onclick="sendDisputeMsg(\''+c.id+'\',\''+d.dispute_id+'\')" style="margin-left:auto;background:#b4453f;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-weight:600;cursor:pointer">Send ↔</button></div></div>';
}
function disputeFileChips(){ return (UI.dispFiles||[]).map(function(f,i){ return '<span style="display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line);border-radius:7px;padding:2px 7px;font-size:11px;background:#fff;margin-right:4px">📎 '+esc(f.name.length>18?f.name.slice(0,18)+'…':f.name)+' <span onclick="disputeDelFile('+i+')" style="cursor:pointer;color:#9aa3a7">✕</span></span>'; }).join(''); }
function disputeAddFiles(files){ UI.dispFiles=UI.dispFiles||[]; for(var i=0;i<files.length;i++){ var f=files[i]; if(f.size>6*1024*1024){ toast(f.name+' is over 6MB — skipped.'); continue; } UI.dispFiles.push(f); } var el=document.getElementById('dispfiles'); if(el)el.innerHTML=disputeFileChips(); }
function disputeDelFile(i){ (UI.dispFiles||[]).splice(i,1); var el=document.getElementById('dispfiles'); if(el)el.innerHTML=disputeFileChips(); }
/* external-only send scoped to THIS dispute (is_dispute + dispute_id) + attach staged files by message_id */
async function sendDisputeMsg(chitId, disputeId){
  var el=document.getElementById('droom-'+disputeId); var body=(el?el.value:'').trim();
  if(!body){ toast('Type a message first.'); return; }
  var txt=SESSION.actorId?(body+"  — "+(SESSION.name||"actor")+"@"+(SESSION.entity||"")):body;
  var mb={ thread_type:'external', message_text:txt, msg_type:'info', is_dispute:true, dispute_id:disputeId };
  busyShow('Sending…'); var mid=null;
  try{ var mr=await api("sendMsg",{params:{id:chitId},body:mb}); mid=mr&&mr.message_id; }catch(e){ busyHide(); toast(MSG.fail("send the message", e)); return; }
  if(mid && (UI.dispFiles||[]).length){ busyShow('Attaching '+UI.dispFiles.length+' file(s)…'); for(var i=0;i<UI.dispFiles.length;i++){ try{ await attUpload(chitId, UI.dispFiles[i], {message_id:mid}); }catch(e){ toast('Attachment failed.'); } } }
  UI.dispFiles=[]; UI.dispCompose=false; UI.dispSel=disputeId;   // keep this room open after posting
  try{ await openChit(chitId, true); }catch(_){}
  busyHide(); paintDetail(); toast('Message sent');
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
  try{ var _rr=await api("resolveDispute",{params:{id:chitId,disputeId},body}); closeModal(); toast(MSG.disputeResolved());
    if(document.getElementById("disprows"))loadDisputes();
    if(UI.sel===chitId){ var i=UI.rows.findIndex(function(x){return x.id===chitId;});
      // FULLY resolved → 0 open, but bump the resolved count so openChit STILL fetches disputes (else the Closed
      // dispute + its wall vanish). Partial (per-party) resolve leaves dispute=true, so the fetch already fires.
      if(i>=0 && _rr && _rr.status==='resolved'){ UI.rows[i].dispute=false; UI.rows[i].dispResolved=(UI.rows[i].dispResolved||0)+1; }
      await openChit(chitId); } }
  catch(e){ if(err)err.textContent=e.message; }
}
