/* app/cap-legend.js — the 🔑 LEGEND capability: a live map of "what we serve".
 * Loaded lazily by ensureCap('legend') on first 🔑 click (rarely opened → dogfoods on-demand loading).
 * CAP_CATALOGUE = the capability → features catalogue (keep TRUE to what's built; honesty rule). The panel
 * shows each capability's LOAD kind (eager / lazy / planned) with LIVE state from Core's CAP_LOADED, and every
 * feature's status (done / partial / backlog). Core keeps only the gated stub (openLegend/closeLegend/_legendOpen).
 * Update this whenever a capability or feature lands. Mirrors the catalogue in project-capability-modularisation. */

// maturity 1-5 (CB Capability Maturity Model): 1 Proven · 2 Packaged · 3 Itemised&Isolated · 4 Governed · 5 Productized.
const CAP_CATALOGUE = [
  { id:'core', name:'Core — Mailbox', icon:'📥', load:'eager', maturity:2, target:3,
    blurb:'The lean always-on shell every role starts with. Loaded with app.html.',
    features:[
      {n:'Mailbox lists — Task / Order / Drafts / Trash / Archive', s:'done'},
      {n:'Read & advance — open a chit, mark read/unread, single-step advance', s:'done'},
      {n:'Compose — author a chit (line items, attachments, delivery, live summary)', s:'done'},
      {n:'Assign — single push, bulk, pool pull, hat-gate', s:'done'},
      {n:'Disputes — per-party scoped raise/resolve, filter, tagged messages (→ own cap-dispute toggle at L3)', s:'done'},
      {n:'Relations — Suppliers, Catalogue, Network', s:'done'},
      {n:'Message centre + Notifications bell (derived from state_log)', s:'partial'},
    ]},
  { id:'admin', name:'Admin', icon:'⚙️', load:'lazy', maturity:2, target:3,
    blurb:'Loads on first open of MIS / Profile / Settings.',
    features:[
      {n:'MIS dashboard (client-side rollup — summary endpoint pending)', s:'partial'},
      {n:'Profile — entity + actor variants', s:'done'},
      {n:'Settings — assignment model + auto-assign on receipt', s:'done'},
      {n:'Governance — 7-layer stub', s:'partial'},
    ]},
  { id:'workforce', name:'Co-assists — Workforce', icon:'🧑‍🤝‍🧑', load:'lazy', maturity:2, target:3,
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
  { id:'connector', name:'Connector / IoT', icon:'🛰️', load:'lazy', maturity:1, target:2,
    blurb:'Non-human co-assist actors (connector/iot) that emit + handle Device Signal chits over the rail. Blueprint b55 = the schema; a capability toggle gates it. L1 = one signal crosses A→B by hand; L5 = real devices, governed + billed.',
    features:[
      {n:'Device Signal blueprint minted via the unified path (b55)', s:'done'},
      {n:'Emit a signal → a Device Signal chit A→B; receiver log/ack', s:'partial'},
      {n:'connector / iot actor type in co-assist', s:'partial'},
      {n:'Per-entity capability toggle (UI + API gated)', s:'backlog'},
      {n:'Adapter seam → real device (MQTT/HTTP), rules/AI, metering', s:'backlog'},
    ]},
  { id:'help', name:'Assistant', icon:'💬', load:'eager', maturity:1, target:3,
    blurb:'One context-sensitive Assistant (engine in Core). Q&A is served from the DB (GET /api/assist/questions) — nothing static in the frontend; the same store feeds the AI when wired.',
    features:[
      {n:'Context-sensitive Q&A per screen — served from the DB', s:'done'},
      {n:'Honest tiered answer (deterministic library floor → LLM)', s:'done'},
      {n:'Tier-1 LLM over the /api/assist proxy', s:'backlog'},
    ]},
  { id:'legend', name:'Legend (this map)', icon:'🔑', load:'lazy', maturity:2, target:2,
    blurb:'You are here. The live capability/feature catalogue — loads on demand.',
    features:[ {n:'Capability → feature map with load + status + maturity', s:'done'} ]},
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

/* ── LIFECYCLE tab — requirements traceability (BR→SR→FR→Test). Mirrors C:\dev\TRACEABILITY.md.
 *    st: ok = verified-live · built = built, runtime-unverified (human gate) · todo = backlog. ── */
const TRACE_MATRIX = [
  { area:'Dispute (the USP)', br:'Two parties resolve a disagreement confidentially & per-party, no third party sees it.',
    sr:'Per-party scoping (participant roster + visibility predicate) + per-party resolution on the isolated rail.',
    rows:[
      { id:'FR-D1', fr:'Only the raiser can resolve', test:'Non-raiser resolve → 403', st:'built' },
      { id:'FR-D2', fr:'Dispute message visible to participants only', test:'3rd entity sees nothing', st:'built' },
      { id:'FR-D3', fr:'Entity-name + who-raised attribution', test:'Message shows entity + raiser', st:'built' },
      { id:'FR-D4', fr:'Dispute [raised]/[resolved] + colour', test:'Resolve → badge flips green', st:'built' },
      { id:'FR-D5', fr:'Composer can reply AS a dispute', test:'Toggle → stored is_dispute', st:'built' },
      { id:'FR-D6', fr:'Close disputed = warn (allow); archive = block', test:'Close → warning; archive → 409', st:'built' },
      { id:'FR-D7', fr:'dispute_id referential integrity', test:'FK to chit_disputes (b58)', st:'ok' },
    ]},
  { area:'Connector (IoT / ERP)', br:'External systems exchange records over the rail, processing then FORGETTING raw payloads (receipt-only).',
    sr:'Connector = first-class actor (identities row) + connections; capability-gated (API-enforced); per-connection retention.',
    rows:[
      { id:'FR-C1', fr:'Create connector actor → shows in Co-assists', test:'Create → lists + visible', st:'todo' },
      { id:'FR-C2', fr:'Add endpoint (direction, ref, retention)', test:'Add → endpoint shows', st:'todo' },
      { id:'FR-C3', fr:'Enable/disable endpoint (kill switch)', test:'Toggle → state flips', st:'todo' },
      { id:'FR-C4', fr:'Emit signal → chit lands in Task', test:'Emit → received co-held', st:'built' },
      { id:'FR-C5', fr:'Routes capability-gated (403 if off)', test:'Capability off → 403', st:'built' },
    ]},
  { area:'Foundation — RLS isolation', br:'Every entity\'s data is its own — a governance leveler, same isolation solo→multinational.',
    sr:'Postgres RLS: app = cb_app (NOBYPASSRLS); withEntity() sets app.current_entity; 6 tables enforce rls_entity.',
    rows:[
      { id:'FR-F1', fr:'Entity reads only its own rows', test:'rls-context-test → cross-read = 0', st:'ok' },
      { id:'FR-F2', fr:'Cross-entity write only via governed fns', test:'chit_deliver rejects bad sender', st:'ok' },
      { id:'FR-F3', fr:'Schema reproducible + change-controlled', test:'Baseline rebuilds prod on scratch DB', st:'todo' },
    ]},
  { area:'Core — the mailbox rail', br:'Parties exchange sealed, co-held shared records ("chits") with a clear lifecycle.',
    sr:'Two-copy chit keyed (chit_id, entity_id, direction); one status enum; append-only state_log; seal = schema snapshot.',
    rows:[
      { id:'FR-M1', fr:'Compose → deliver co-held chit', test:'Send → both copies, right direction', st:'built' },
      { id:'FR-M2', fr:'Advance status (direction-scoped) + logged', test:'Advance → state_log + badge', st:'built' },
      { id:'FR-M3', fr:'Assign (push/bulk/pool, hat-gated)', test:'Assign → bound, gate respected', st:'built' },
    ]},
];

/* ── SECURITY tab — verified from code/package-lock 2026-07-05. lvl: strong ✓ · partial ◐ · gap ○ ── */
const SEC_POSTURE = [
  { area:'In transit', lvl:'strong', what:'TLS everywhere — HTTPS on web (Vercel) + API (Railway); TLS to Postgres (Supabase).', raise:'DB uses rejectUnauthorized:false (encrypted, cert NOT verified) — pin the cert to fully close MITM.' },
  { area:'At rest', lvl:'partial', what:'Provider disk encryption (Supabase/AWS, AES-256). No app/column-level encryption — payloads, messages, PII (GSTN/address/phone) are plaintext in Postgres, protected by RLS + disk crypto.', raise:'Add column-level encryption (pgcrypto/pgsodium) for PII + chit payloads.' },
  { area:'Auth secrets', lvl:'strong', what:'PINs & passwords bcrypt-hashed (bcryptjs). JWT HS256, server-side only, never in browser, boot-time secret guard. OTP is ephemeral (6-digit, expiring) + attempt-capped + rate-limited.', raise:'Hash/short-TTL OTP is fine; consider rotating JWT to asymmetric (RS256) for multi-service.' },
  { area:'Perimeter', lvl:'strong', what:'helmet security headers + express-rate-limit (auth + assist brute-force blunting).', raise:'Add per-account lockout metrics + WAF at the edge.' },
  { area:'Access control', lvl:'strong', what:'RLS entity isolation LIVE — cb_app is NOSUPERUSER NOBYPASSRLS; every query scoped by app.current_entity.', raise:'Extend RLS beyond the 6 Direct tables (identities/messages/disputes are app-scoped carve-outs).' },
  { area:'Secrets & audit', lvl:'gap', what:'Secrets in Railway env vars, not a vault/KMS. No external pen-test yet (so security honestly ≤ L4).', raise:'Move secrets to a KMS/vault; commission an external pen-test → the L5 gate.' },
];

function _lbTabBar(){
  const tab=(typeof _lbTab!=='undefined')?_lbTab:'edge';
  const btn=(id,label)=>`<button onclick="setLbTab('${id}')" style="border:0;background:none;cursor:pointer;padding:7px 12px;font-size:12.5px;font-weight:${tab===id?'700':'500'};color:${tab===id?'var(--ink)':'var(--grey)'};border-bottom:2px solid ${tab===id?'var(--accent,#3F66A6)':'transparent'}">${label}</button>`;
  return `<div style="display:flex;gap:2px;border-bottom:1px solid var(--line);padding:0 8px;flex-wrap:wrap">${btn('edge','🎯 The edge')}${btn('cap','⬢ Capabilities')}${btn('life','🔀 Lifecycle')}${btn('sec','🔒 Security')}${btn('real','🔬 Reality')}</div>`;
}
function setLbTab(t){ _lbTab=t; _openLegendImpl(); }

function _lifeTabHtml(){
  const SS={ ok:['#2f8f5b','✅'], built:['#a9791f','◐'], todo:['#9aa3a7','○'] };
  const row=(r)=>{ const [c,ic]=SS[r.st]||SS.todo;
    return `<div style="display:flex;gap:8px;align-items:flex-start;font-size:11.5px;padding:3px 0;border-bottom:1px dashed var(--line)"><span style="color:${c};flex:none">${ic}</span><span class="mono" style="flex:none;color:var(--grey);width:46px">${esc(r.id)}</span><span style="flex:1">${esc(r.fr)}</span><span style="flex:1;color:var(--grey)">${esc(r.test)}</span></div>`; };
  const grp=(g)=>`<div style="border:1px solid var(--line);border-radius:11px;padding:12px 13px;margin-bottom:11px">
      <div style="font-family:'Space Grotesk';font-weight:700;font-size:13px;margin-bottom:4px">${esc(g.area)}</div>
      <div style="font-size:11px;color:var(--grey);margin-bottom:2px"><b>BR:</b> ${esc(g.br)}</div>
      <div style="font-size:11px;color:var(--grey);margin-bottom:8px"><b>SR:</b> ${esc(g.sr)}</div>
      <div style="display:flex;gap:8px;font-size:10px;color:var(--grey);font-weight:700;padding-bottom:2px"><span style="width:54px">&nbsp;</span><span style="flex:1">FUNCTIONAL (FR)</span><span style="flex:1">TEST</span></div>
      ${g.rows.map(row).join('')}
    </div>`;
  return `<div style="padding:12px 13px;max-height:70vh;overflow:auto">
    <div style="font-size:11.5px;color:var(--grey);margin-bottom:10px">How we work the lifecycle: every behaviour traces <b>Business → System → Functional → Test</b>. <span style="color:#2f8f5b">✅ verified-live</span> · <span style="color:#a9791f">◐ built, needs a live run</span> · <span style="color:#9aa3a7">○ backlog</span>.</div>
    ${TRACE_MATRIX.map(grp).join('')}
    <div style="font-size:10.5px;color:var(--grey);text-align:center;padding-top:2px">Most rows are ◐ — built + parse/boot-checked; each ✅ needed a human live-run or a script. Automated tests turn ◐ → ✅ at scale.</div>
  </div>`;
}

function _secTabHtml(){
  const LV={ strong:['#2f8f5b','✓ strong'], partial:['#a9791f','◐ partial'], gap:['#c0453b','○ gap'] };
  const row=(s)=>{ const [c,lbl]=LV[s.lvl]||LV.gap;
    return `<div style="border:1px solid var(--line);border-radius:11px;padding:11px 13px;margin-bottom:9px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-family:'Space Grotesk';font-weight:700;font-size:13px">${esc(s.area)}</span><span style="margin-left:auto;font-size:10.5px;font-weight:800;color:${c}">${lbl}</span></div>
      <div style="font-size:11.5px;color:var(--ink);line-height:1.45;margin-bottom:4px">${esc(s.what)}</div>
      <div style="font-size:10.5px;color:var(--grey);line-height:1.4"><b>Raise it:</b> ${esc(s.raise)}</div>
    </div>`; };
  return `<div style="padding:12px 13px;max-height:70vh;overflow:auto">
    <div style="font-size:11.5px;color:var(--grey);margin-bottom:10px">What protects your data today (verified from code, 2026-07-05). Honest levels: <span style="color:#2f8f5b">✓ strong</span> · <span style="color:#a9791f">◐ partial</span> · <span style="color:#c0453b">○ gap</span>.</div>
    ${SEC_POSTURE.map(row).join('')}
    <div style="font-size:10.5px;color:var(--grey);text-align:center;padding-top:2px">Encryption in transit (TLS) is solid; at-rest is provider disk-level (not per-column) and there is no external pen-test yet — so security is honestly capped ≤ L4 until audited.</div>
  </div>`;
}

/* ── EDGE tab — positioning hypothesis vs alternatives (NOT a scoreboard; our dot is a TARGET) ── */
function _edgeTabHtml(){
  const pt=(x,y,label,hl)=>'<div style="position:absolute;left:'+x+'%;bottom:'+y+'%;transform:translate(-50%,50%);text-align:center;z-index:2">'
    +'<div style="width:'+(hl?15:10)+'px;height:'+(hl?15:10)+'px;border-radius:50%;margin:0 auto;background:'+(hl?'#3F66A6':'#9aa3a7')+';'+(hl?'box-shadow:0 0 0 5px rgba(63,102,166,.16)':'')+'"></div>'
    +'<div style="font-size:9.5px;margin-top:3px;white-space:nowrap;color:'+(hl?'#2b4a72':'var(--grey)')+';font-weight:'+(hl?'700':'500')+'">'+esc(label)+'</div></div>';
  const stage=(l,s,k)=>{ const on=k==='now', nx=k==='next', dn=k==='done';
    const bg=on?'#eef3fb':(nx?'#fff':'#f6f6f4'), bd=on?'#3F66A6':'var(--line)', col=on?'#2b4a72':(dn?'#8a8f98':'var(--ink)');
    return '<div style="border:1px solid '+bd+';background:'+bg+';border-radius:8px;padding:5px 8px;text-align:center;min-width:66px">'
      +'<div style="font-size:9.5px;font-weight:700;color:'+col+'">'+(dn?'✓ ':'')+esc(l)+'</div>'
      +'<div style="font-size:8px;color:var(--grey)">'+esc(s)+'</div></div>'; };
  const arrow=()=>'<span style="color:var(--grey);font-size:10px">→</span>';
  const _mk=(v)=>{ const m={y:['#2f8f5b','✓'],p:['#a9791f','~'],n:['#c0453b','✗']}, c=m[v]||m.n; return '<span style="color:'+c[0]+';font-weight:700">'+c[1]+'</span>'; };
  const crow=(n,a,b,c,d,hl)=>'<tr style="'+(hl?'background:#eef3fb;':'')+'border-top:1px solid var(--line)"><td style="text-align:left;padding:4px;font-weight:'+(hl?'700':'500')+';color:'+(hl?'#2b4a72':'var(--ink)')+'">'+n+'</td><td style="text-align:center;padding:4px">'+_mk(a)+'</td><td style="text-align:center;padding:4px">'+_mk(b)+'</td><td style="text-align:center;padding:4px">'+_mk(c)+'</td><td style="text-align:center;padding:4px">'+_mk(d)+'</td></tr>';
  return '<div style="padding:14px 16px;max-height:70vh;overflow:auto">'
    +'<div style="font-size:11.5px;color:var(--grey);margin-bottom:8px">Where we aim vs the alternatives. <b>This is a positioning hypothesis</b> — our dot is a <b>target</b> (we are early/unproven); the others are established.</div>'
    +'<div style="position:relative;height:270px;margin:22px 34px 30px;border-left:1.5px solid var(--line);border-bottom:1.5px solid var(--line)">'
      +'<div style="position:absolute;left:50%;top:0;bottom:0;border-left:1px dashed var(--line)"></div>'
      +'<div style="position:absolute;top:50%;left:0;right:0;border-top:1px dashed var(--line)"></div>'
      +'<div style="position:absolute;right:4px;top:4px;font-size:9px;color:#8fae86;font-weight:700;text-align:right">governed<br>+ accessible<br>= the gap</div>'
      + pt(15,84,'Email · chat · sheets',false)
      + pt(84,15,'ServiceNow · SAP · EDI',false)
      + pt(68,27,'Blockchain B2B',false)
      + pt(80,80,'Chit & Bridge',true)
      +'<div style="position:absolute;left:-2px;bottom:-22px;font-size:10px;color:var(--grey)">weak ← <b>governance &amp; trust</b> → strong</div>'
      +'<div style="position:absolute;left:-24px;top:-16px;font-size:10px;color:var(--grey)">↑ accessible / leveling</div>'
    +'</div>'
    +'<div style="font-size:11px;color:var(--ink);line-height:1.5">'
      +'<b>The edge:</b> the top-right — <b>enterprise-grade governance a small player can actually use</b> — is empty. Email is accessible but ungoverned; SAP/ServiceNow/EDI are governed but heavy &amp; costly; blockchain B2B is trust-heavy but hard. We aim at <b>governed AND leveling</b>: a solo trader transacts on the same rail as a multinational.'
    +'</div>'
    +'<div style="margin-top:16px"><div style="font-size:11px;font-weight:700;color:var(--ink);margin-bottom:5px">Communication lens — two-way between entities</div>'
      +'<div style="font-size:10.5px;color:var(--grey);margin-bottom:6px">Two-way exists elsewhere; being two-way <i>and</i> peer <i>and</i> governed <i>and</i> affordable does not.</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:10.5px">'
        +'<tr style="color:var(--grey);font-weight:700;font-size:9.5px"><td style="text-align:left;padding:3px 4px">Channel</td><td style="padding:3px 4px">2-way</td><td style="padding:3px 4px">Peer</td><td style="padding:3px 4px">Governed</td><td style="padding:3px 4px">Affordable</td></tr>'
        + crow('Email','y','y','n','y',false)
        + crow('Slack Connect / Teams','y','p','n','y',false)
        + crow('EDI','y','n','p','n',false)
        + crow('Ariba / Coupa / Tradeshift','y','n','p','n',false)
        + crow('Blockchain B2B','y','y','y','n',false)
        + crow('Chit &amp; Bridge','y','y','y','p',true)
      +'</table>'
      +'<div style="font-size:9.5px;color:var(--grey);margin-top:5px">✓ yes · ~ partial · ✗ no. Ours is the only row combining <b>governed + peer + two-way</b> (all real/built); <b>affordability is the aim</b>, not yet proven — hence the ~.</div>'
    +'</div>'
    +'<div style="font-size:10.5px;color:var(--grey);text-align:center;padding-top:10px;border-top:1px solid var(--line);margin-top:14px">Closest analog: <b>ServiceNow</b> — one records/workflow facility, many classified lifecycles (ITSM/HR/dev). It proves the model has takers — and it won by starting <i>narrow</i> (an ITIL desk) then generalizing. Our claimed differentiator vs it: accessibility &amp; cost for the small player.</div>'
    +'<div style="border:1px solid var(--line);border-radius:10px;padding:11px 12px;margin-top:14px;background:#faf9f6">'
      +'<div style="font-size:11px;font-weight:700;color:#8a6d1f;margin-bottom:5px">🧭 Critic&rsquo;s lens (we hold ourselves to it)</div>'
      +'<div style="font-size:10.8px;color:var(--ink);line-height:1.5">The honest risk: the <b>model is ahead of adoption</b> — elegant &ne; adopted. The proof that counts is <b>one real user on one blueprint</b>, not a better diagram. As a <b>concept/POC this existed for years</b>; as a <b>product it is ~2 weeks old</b> — so it is early <i>by timeline</i>, and we name what is unproven rather than oversell it.</div>'
    +'</div>'
    +'<div style="margin-top:13px"><div style="font-size:11px;font-weight:700;color:var(--ink);margin-bottom:6px">Path to confident validation</div>'
      +'<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">'
        + stage('Concept / POC','years','done') + arrow()
        + stage('Product build','~2 wks · now','now') + arrow()
        + stage('One test lifecycle','prove it works','next') + arrow()
        + stage('Volume test','scale','') + arrow()
        + stage('Pen test','security','') + arrow()
        + stage('External validation','confident sign-off','')
      +'</div></div>'
    +'<div style="font-size:10.5px;color:var(--grey);margin-top:11px"><b>First taker?</b> The one who feels the gap most — a small supplier who needs credible, governed dealings with a large buyer, or a service desk wanting ITIL-grade handling without ServiceNow cost.</div>'
  +'</div>';
}

/* ── REALITY tab — full-honesty writedown: where each edge stands + how we EARN it ── */
function _realTabHtml(){
  const S={ real:['#2f8f5b','LIVE'], built:['#a9791f','BUILT · unverified'], part:['#a9791f','PARTIAL'], aim:['#c0453b','ASPIRATION'] };
  const row=(claim,st,now,earn)=>{ const [c,lbl]=S[st]||S.aim;
    return '<div style="border:1px solid var(--line);border-radius:10px;padding:11px 12px;margin-bottom:9px">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px"><span style="font-size:12px;font-weight:700">'+esc(claim)+'</span><span style="margin-left:auto;font-size:9px;font-weight:800;color:'+c+';white-space:nowrap">'+lbl+'</span></div>'
      +'<div style="font-size:10.6px;color:var(--ink);line-height:1.45;margin-bottom:3px"><b>Now:</b> '+esc(now)+'</div>'
      +'<div style="font-size:10.4px;color:var(--grey);line-height:1.4"><b>To earn it:</b> '+esc(earn)+'</div></div>'; };
  return '<div style="padding:14px 16px;max-height:70vh;overflow:auto">'
    +'<div style="font-size:11.5px;color:var(--grey);margin-bottom:10px">Full honesty — for each edge, where we genuinely stand and what it takes to <b>earn</b> that level. Nothing counts as done until a human proved it (our review-gate rule).</div>'
    + row('Governed peer two-way (the communication edge)','built','Two-copy co-held chit, messages both ways, per-party dispute threads — the rail exists in the product.','Run one live A↔B loop with a real user; then volume-test it.')
    + row('Multitenant isolation (RLS)','real','Live in prod — the app runs as a non-superuser role that cannot bypass RLS; a script verified cross-entity read = 0.','Commission an external pen-test to move from self-verified to attested (the L5 gate).')
    + row('Sealed co-held record + provenance','part','Freeze-at-send + an append-only state log exist.','Add an immutability / tamper test proving history cannot be rewritten.')
    + row('Dispute confidentiality (the USP)','built','Per-party roster + scoped visibility + per-party resolve — built.','The pending multi-party live pass: a 3rd entity must see nothing.')
    + row('Governed + accessible (the quadrant)','aim','The rail is governed; affordability/ease for a solo player is designed, not proven.','One real small-player user completes a real loop cheaply — the decisive wedge.')
    + row('Self-measuring maturity (this Legend)','part','An honest hand-authored scoreboard (these very tabs).','Wire it to real Delivery Records + test results so it reads automatically (the L4 step).')
    +'<div style="font-size:10.4px;color:var(--grey);text-align:center;padding-top:9px;border-top:1px solid var(--line);margin-top:6px">The ladder that earns all of it: <b>one test lifecycle → volume → pen-test → external validation.</b> Concept: years · Product: ~2 weeks. Early by timeline, honest by choice.</div>'
  +'</div>';
}

function _openLegendImpl(){
  let host=document.getElementById("lbhost");
  if(!host){ host=document.createElement('div'); host.id='lbhost'; document.body.appendChild(host); }  // pre-auth: create the host if the app shell isn't mounted (shareable /#/legend)
  _legendOpen=true;
  if(typeof _lbTab==='undefined') _lbTab='edge';   // open on the comparison (the hook) — then people explore the rest
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
  const matBadge=(c)=>{ if(!c.maturity) return ''; const t=(c.target&&c.target>c.maturity)?`→L${c.target}`:''; return `<span title="Capability maturity — 1 Proven · 2 Packaged · 3 Itemised · 4 Governed · 5 Productized" style="font-size:10px;font-weight:800;color:#4b3b8f;background:#efeaf9;border:1px solid #cabdf0;border-radius:6px;padding:1px 7px">L${c.maturity}${t}</span>`; };
  const featRow=(f)=>{ const [col,ic]=SC[f.s]||SC.backlog;
    return `<div style="display:flex;gap:7px;align-items:flex-start;font-size:12px;color:var(--ink);padding:3px 0;line-height:1.4"><span style="color:${col};flex:none">${ic}</span><span>${esc(f.n)}</span></div>`; };
  const card=(c)=>`<div style="border:1px solid var(--line);border-radius:11px;padding:11px 13px;margin-bottom:10px;background:${c.load==='planned'?'#faf9f5':'#fff'}">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px"><span style="font-size:15px">${c.icon}</span><span style="font-family:'Space Grotesk';font-weight:700;font-size:13.5px">${esc(c.name)}</span><span style="margin-left:auto;display:flex;gap:6px;align-items:center">${matBadge(c)}${loadBadge(c)}</span></div>
    <div style="font-size:11.5px;color:var(--grey);margin-bottom:8px;line-height:1.45">${esc(c.blurb)}</div>
    ${c.features.map(featRow).join('')}
  </div>`;
  const capBody=`
    <div style="padding:11px 13px 6px;font-size:11.5px;color:var(--grey);border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:10px;align-items:center">
      <span><b style="color:var(--ink)">${built}</b> live capabilities · <b style="color:var(--ink)">${nf}</b> features</span>
      <span style="margin-left:auto">Status: <span style="color:#2f8f5b">✅ done ${d}</span> · <span style="color:#a9791f">◐ partial ${p}</span> · <span style="color:#9aa3a7">○ backlog ${b}</span></span>
    </div>
    <div style="padding:12px 13px;max-height:70vh;overflow:auto">${CAP_CATALOGUE.map(card).join('')}
      <div style="font-size:10.5px;color:var(--grey);text-align:center;padding-top:4px">Load: <b>always on</b> ships with the app · <b>lazy</b> loads on first use · <b>planned</b> not built yet. · <b>L1–5</b> maturity: 1 Proven · 2 Packaged · 3 Itemised · 4 Governed · 5 Productized (→ = target). Kept true to the code.</div>
    </div>`;
  const body = (_lbTab==='life') ? _lifeTabHtml() : (_lbTab==='sec') ? _secTabHtml() : (_lbTab==='edge') ? _edgeTabHtml() : (_lbTab==='real') ? _realTabHtml() : capBody;
  const titles = { cap:'capabilities &amp; features', life:'lifecycle &amp; traceability', sec:'security posture', edge:'positioning &amp; edge', real:'reality &amp; how we earn it' };
  host.innerHTML=`<div class="notifover" onclick="closeLegend()"><div class="notifpanel" style="max-width:660px;width:95vw;border-radius:14px;overflow:hidden" onclick="event.stopPropagation()">
    <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:linear-gradient(180deg,#f7f9fc,#fff);border-bottom:1px solid var(--line)">
      <span style="font-size:18px">🔑</span>
      <div style="line-height:1.15"><div style="font-family:'Space Grotesk';font-weight:700;font-size:15px;color:var(--ink)">What we serve</div><div style="font-size:10.5px;color:var(--grey)">${titles[_lbTab]||titles.cap}</div></div>
      <button onclick="closeLegend()" style="margin-left:auto;border:0;background:none;cursor:pointer;font-size:17px;color:var(--grey)" aria-label="Close">✕</button>
    </div>
    ${_lbTabBar()}
    ${body}
  </div></div>`;
}
