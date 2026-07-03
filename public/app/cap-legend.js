/* app/cap-legend.js — the 🔑 LEGEND capability: a live map of "what we serve".
 * Loaded lazily by ensureCap('legend') on first 🔑 click (rarely opened → dogfoods on-demand loading).
 * CAP_CATALOGUE = the capability → features catalogue (keep TRUE to what's built; honesty rule). The panel
 * shows each capability's LOAD kind (eager / lazy / planned) with LIVE state from Core's CAP_LOADED, and every
 * feature's status (done / partial / backlog). Core keeps only the gated stub (openLegend/closeLegend/_legendOpen).
 * Update this whenever a capability or feature lands. Mirrors the catalogue in project-capability-modularisation. */

const CAP_CATALOGUE = [
  { id:'core', name:'Core — Mailbox', icon:'📥', load:'eager',
    blurb:'The lean always-on shell every role starts with. Loaded with app.html.',
    features:[
      {n:'Mailbox lists — Task / Order / Drafts / Trash / Archive', s:'done'},
      {n:'Read & advance — open a chit, mark read/unread, single-step advance', s:'done'},
      {n:'Compose — author a chit (line items, attachments, delivery, live summary)', s:'done'},
      {n:'Assign — single push, bulk, pool pull, hat-gate', s:'done'},
      {n:'Disputes — raise multi-party, resolve, filter, dispute-tagged messages', s:'done'},
      {n:'Relations — Suppliers, Catalogue, Network', s:'done'},
      {n:'Message centre + Notifications bell (derived from state_log)', s:'partial'},
    ]},
  { id:'admin', name:'Admin', icon:'⚙️', load:'lazy',
    blurb:'Loads on first open of MIS / Profile / Settings.',
    features:[
      {n:'MIS dashboard (client-side rollup — summary endpoint pending)', s:'partial'},
      {n:'Profile — entity + actor variants', s:'done'},
      {n:'Settings — assignment model + auto-assign on receipt', s:'done'},
      {n:'Governance — 7-layer stub', s:'partial'},
    ]},
  { id:'workforce', name:'Co-assists — Workforce', icon:'🧑‍🤝‍🧑', load:'lazy',
    blurb:'Loads on first open of Co-assists. Grows into leave / shift / wage.',
    features:[
      {n:'Create + invite (OTP) → set-PIN → PIN login', s:'done'},
      {n:'Re-invite / Reset-PIN lifecycle', s:'done'},
      {n:'Hats (view/act/audit/mis/manager) + assignability gate', s:'done'},
      {n:'Leave-cover (buddy pairs) + concurrency check', s:'done'},
      {n:'Duty / Break shift', s:'done'},
      {n:'Deactivate / reactivate / remove — full binding cleanup', s:'done'},
      {n:'Roster tabs + covers badges', s:'done'},
      {n:'Leave calendar · shift rotation · wage / salary', s:'backlog'},
      {n:'Non-human actor types (connector / iot / ai) auth', s:'backlog'},
    ]},
  { id:'help', name:'Help & Assistant', icon:'💡', load:'lazy',
    blurb:'Loads on first “?” or 💬 — help is not always called, so it stays out of the runtime payload.',
    features:[
      {n:'Per-screen “?” help overlays', s:'done'},
      {n:'Floating assistant — library-backed Q&A (honest, tiered, degrades never breaks)', s:'done'},
      {n:'Tier-1 LLM over the /api/assist proxy', s:'backlog'},
    ]},
  { id:'legend', name:'Legend (this map)', icon:'🔑', load:'lazy',
    blurb:'You are here. The live capability/feature catalogue — loads on demand.',
    features:[ {n:'Capability → feature map with load + status', s:'done'} ]},
  // ── Planned capabilities (not built yet) — so the map also shows what is coming ──
  { id:'relations-x', name:'Relations (extract)', icon:'🔗', load:'planned',
    blurb:'Suppliers / Catalogue / Network to move OUT of Core into their own lazy cap.',
    features:[ {n:'cap-relations extraction', s:'backlog'} ]},
  { id:'employee', name:'Employee / HR', icon:'🗂️', load:'planned',
    blurb:'People-management layer above co-assist basics — hours, pay, shifts, roster.',
    features:[ {n:'Working hours · pay · roster', s:'backlog'} ]},
  { id:'api-service', name:'API as a service', icon:'🔌', load:'planned',
    blurb:'Machine-auth + OpenAPI so other systems connect. Design specced (prioritised).',
    features:[
      {n:'M2M auth — OAuth2 client-credentials / API key + scopes', s:'backlog'},
      {n:'OpenAPI 3.1 + /docs + uniform envelope + /v1', s:'backlog'},
      {n:'Webhooks + per-key metering', s:'backlog'},
    ]},
];

function _openLegendImpl(){
  const host=document.getElementById("lbhost"); if(!host)return; _legendOpen=true;
  const LOADED=(typeof CAP_LOADED!=='undefined')?CAP_LOADED:{};
  const SC={ done:['#2f8f5b','✅'], partial:['#a9791f','◐'], backlog:['#9aa3a7','○'] };
  // tallies across every feature
  let d=0,p=0,b=0,nf=0; CAP_CATALOGUE.forEach(c=>c.features.forEach(f=>{ nf++; if(f.s==='done')d++; else if(f.s==='partial')p++; else b++; }));
  const built=CAP_CATALOGUE.filter(c=>c.load!=='planned').length;
  const loadBadge=(c)=>{
    if(c.load==='eager')  return `<span style="font-size:10px;font-weight:700;color:#2f8f5b;background:#e8f4ee;border:1px solid #bfe0cf;border-radius:6px;padding:1px 7px">always on</span>`;
    if(c.load==='planned')return `<span style="font-size:10px;font-weight:700;color:#7a5e22;background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:6px;padding:1px 7px">planned</span>`;
    const on=!!LOADED[c.id];
    return `<span style="font-size:10px;font-weight:700;color:${on?'#345488':'#8a8f98'};background:${on?'#eef3fb':'#f4f4f2'};border:1px solid ${on?'#cfe0f4':'var(--line)'};border-radius:6px;padding:1px 7px">lazy · ${on?'loaded ✓':'on demand'}</span>`;
  };
  const featRow=(f)=>{ const [col,ic]=SC[f.s]||SC.backlog;
    return `<div style="display:flex;gap:7px;align-items:flex-start;font-size:12px;color:var(--ink);padding:3px 0;line-height:1.4"><span style="color:${col};flex:none">${ic}</span><span>${esc(f.n)}</span></div>`; };
  const card=(c)=>`<div style="border:1px solid var(--line);border-radius:11px;padding:11px 13px;margin-bottom:10px;background:${c.load==='planned'?'#faf9f5':'#fff'}">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px"><span style="font-size:15px">${c.icon}</span><span style="font-family:'Space Grotesk';font-weight:700;font-size:13.5px">${esc(c.name)}</span><span style="margin-left:auto">${loadBadge(c)}</span></div>
    <div style="font-size:11.5px;color:var(--grey);margin-bottom:8px;line-height:1.45">${esc(c.blurb)}</div>
    ${c.features.map(featRow).join('')}
  </div>`;
  host.innerHTML=`<div class="notifover" onclick="closeLegend()"><div class="notifpanel" style="max-width:600px;width:95vw" onclick="event.stopPropagation()">
    <div class="notifhd">🔑 What we serve — capabilities &amp; features<button onclick="closeLegend()" style="margin-left:auto;border:0;background:none;cursor:pointer;font-size:15px;color:var(--grey)" aria-label="Close">✕</button></div>
    <div style="padding:11px 13px 6px;font-size:11.5px;color:var(--grey);border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:10px;align-items:center">
      <span><b style="color:var(--ink)">${built}</b> live capabilities · <b style="color:var(--ink)">${nf}</b> features</span>
      <span style="margin-left:auto">Status: <span style="color:#2f8f5b">✅ done ${d}</span> · <span style="color:#a9791f">◐ partial ${p}</span> · <span style="color:#9aa3a7">○ backlog ${b}</span></span>
    </div>
    <div style="padding:12px 13px;max-height:70vh;overflow:auto">${CAP_CATALOGUE.map(card).join('')}
      <div style="font-size:10.5px;color:var(--grey);text-align:center;padding-top:4px">Load: <b>always on</b> ships with the app · <b>lazy</b> loads on first use · <b>planned</b> not built yet. Kept true to the code.</div>
    </div>
  </div></div>`;
}
