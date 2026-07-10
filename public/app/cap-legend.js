/* app/cap-legend.js — the 🔑 LEGEND capability: a live map of "what we serve".
 * Loaded lazily by ensureCap('legend') on first 🔑 click (rarely opened → dogfoods on-demand loading).
 * CAP_CATALOGUE = the capability → features catalogue (keep TRUE to what's built; honesty rule). The panel
 * shows each capability's LOAD kind (eager / lazy / planned) with LIVE state from Core's CAP_LOADED, and every
 * feature's status (done / partial / backlog). Core keeps only the gated stub (openLegend/closeLegend/_legendOpen).
 * Update this whenever a capability or feature lands. Mirrors the catalogue in project-capability-modularisation. */

// TWO AXES per capability (SPEC-governance-in-legend.md):
//   maturity 1-5 (what it DOES): 1 Proven · 2 Packaged · 3 Itemised&Isolated · 4 Governed · 5 Productized.
//   gov 1-5 (how it's GOVERNED): 1 declared · 2 designed · 3 enforced+isolated · 4 governed+provable · 5 audited/certified.
//   gov RIDES ON the capability — governedUnder (the cascade layer) · governedBy (mechanisms in force) · govGap (= the L4 lever).
//   RULE: gov usually LAGS maturity, and that lag IS the distance to L4. gov:null → N/A (nothing to govern; static/read-only).
const CAP_CATALOGUE = [
  { id:'core', name:'Core — Governance rail', icon:'🛤️', load:'eager', maturity:2, target:3,
    gov:3, govTarget:4, governedUnder:'the constitution + the RLS isolation floor',
    governedBy:['RLS entity isolation (FORCE, per-copy)','append-only state_log','governed delivery fns (SECURITY DEFINER)'],
    govGap:['governed provenance is thin','seal / version-freeze not tamper-tested'],
    blurb:'The governance RAIL, in the familiar form of a mailbox — the lean always-on shell every role starts with (loaded with app.html). As easy as an inbox; governed underneath.',
    features:[
      {n:'The tracks + lists — Task (coming to you) · Order (going from you) · Drafts · Trash · Archive', s:'done'},
      {n:'Read & advance — open a chit and move it through its statuses (open · act · close · reopen): single-step, governed, stamped on the append-only log', s:'done'},
      {n:'Compose — load a wagon: author a chit = your business (line items, attachments, delivery, live summary)', s:'done'},
      {n:'Assign to your co-assists (the crew) — human, and machine: IoT · ERP · AI: single push · bulk · pool pull · hat-gated', s:'done'},
      {n:'Disputes — the private siding, extracted to its own lazy Disputes capability (Core is dispute-blind, 2026-07-05)', s:'done'},
      {n:'Relations — your network: Suppliers · Catalogue · Network (reachable destinations — public map, private yards)', s:'done'},
      {n:'Retention & auto-purge — per-record retention period → governed auto-delete (settled-only · hold-aware · keep a receipt) + cold-archive (specified — backlog)', s:'backlog'},
      {n:'Message — a first-class subject, per-copy scoping: INTERNAL (single copy, private to the entity + its co-assists) · EXTERNAL (replicated to each participant entity) · DISPUTE (to the roster only — one or more participants)', s:'done'},
      {n:'Notifications bell + message centre (derived from state_log)', s:'partial'},
    ]},
  { id:'dispute', name:'Disputes — the USP', icon:'⚑', load:'lazy', maturity:3, target:4,
    gov:3, govTarget:4, governedUnder:'the constitution (per-copy confidential scoping)',
    governedBy:['per-copy chit_disputes (FORCE RLS)','roster-scoped delivery (chit_dispute_deliver)','raiser-only resolution'],
    govGap:['governed provenance → L4','frontend module live-run'],
    blurb:'The confidential, per-party dispute rail — its own lazy, capability-gated module (cap-dispute.js); Core is dispute-blind. HARDENED PER-COPY (b68, 2026-07-08): each party holds its OWN chit_disputes copy (FORCE RLS), dispute_participants retired, dispute messages replicated to the roster only. L3 (itemised & isolated) is now PROVEN by automated regression (dispute-scope 7/0 — a chit party NOT in the dispute sees nothing). L4 gate = governed provenance + the frontend module live-run.',
    features:[
      {n:'Per-party scoped raise / resolve (raiser-only) + duplicate guard (Model A — SPEC-dispute)', s:'done'},
      {n:'Per-ENTITY dispute copies + roster-scoped messages — PROVEN (b68, dispute-scope 7/0)', s:'done'},
      {n:'On-record banner — ALL concurrent disputes under one roof (multi-party count header)', s:'done'},
      {n:'Per-dispute threading keyed on dispute_id (filter chips + composer binds to the selection)', s:'done'},
      {n:'Dispute [raised]/[resolved] badges · entity-name + actor byline · dispute-mode composer', s:'done'},
      {n:'List-row count — ⚑ N open · M resolved at a glance', s:'done'},
      {n:'Advanced-search dispute filter (chip + modal) + capability-gated nav', s:'done'},
      {n:'Live-run of the lazy FRONTEND module (Athi) → locks the UI at L3', s:'partial'},
      {n:'Automated regression suite (dispute-scope/regression) — DONE; governed provenance → L4', s:'partial'},
    ]},
  { id:'admin', name:'Admin', icon:'⚙️', load:'lazy', maturity:2, target:3,
    gov:1, govTarget:4, governedUnder:'the 7-layer governance stub only',
    governedBy:['settings surface (assignment model)'],
    govGap:['the whole cascade is a STUB — declared, not enforced'],
    blurb:'Loads on first open of MIS / Profile / Settings.',
    features:[
      {n:'MIS dashboard (client-side rollup — summary endpoint pending)', s:'partial'},
      {n:'Profile — entity + actor variants', s:'done'},
      {n:'Settings — assignment model + auto-assign on receipt', s:'done'},
      {n:'Governance — 7-layer stub', s:'partial'},
    ]},
  { id:'workforce', name:'Co-assists', icon:'🧑‍🤝‍🧑', load:'lazy', maturity:2, target:3,
    gov:2, govTarget:3, governedUnder:'hats + the assignability gate',
    governedBy:['hat capability gate','assignability check','leave-cover concurrency guard'],
    govGap:['governed role provenance (who granted a hat, when)'],
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
      {n:'Non-human co-assist types (connector / IoT / AI) auth', s:'backlog'},
    ]},
  { id:'connector', name:'Connector · IoT / ERP', icon:'🛰️', load:'lazy', maturity:2, target:3,
    gov:2, govTarget:3, governedUnder:'the capability-gate + per-connection retention policy',
    governedBy:['capability-gated routing (403 if off)','receipt-only retention (process-then-forget)','per-connection kill switch'],
    govGap:['governed fleets (allowlisted devices, per-device control)','real-ERP pilot'],
    blurb:'Non-human actors — a Pi (IoT) or a system (ERP) — that exchange chits over the rail, managed INSIDE Co-assists (one panel, same shell as people). A Pi holds its connection string; its devices/endpoints are connections under it. b62 = connection-string schema + provisioning + cascading health; device-key ingest = the Pi authenticates with its OWN ActorKey. ✅ L1→L2 CLEARED 2026-07-06 — a real Raspberry Pi 4 read its CPU temp, authenticated by its ActorKey, went live + delivered a co-held chit. ✅ ERP TRANSFER MODE LIVE 2026-07-08 — process-then-forget: receipt-only (hash + outcome), never the raw payload; owner test-cycle + receipt ledger (harness 23/0, b69). L3 = governed fleets (registered devices, per-device control) + a real-ERP pilot; L5 = billed at scale.',
    features:[
      {n:'Connector = a co-assist grouped by SITE; connection string on it (b62)', s:'done'},
      {n:'Devices/endpoints per Pi (own bridge_id + config); enable/disable; add inline', s:'done'},
      {n:'Provisioning — CB-issued ActorKey (shown once) + Regenerate; push/pull; ERP base-url + auth-ref', s:'done'},
      {n:'Cascading health (Pi offline → devices no-signal) + ping / Test-connection', s:'done'},
      {n:'MERGED into Co-assists — click a Pi → device cockpit (sticky-top icons + scroll)', s:'done'},
      {n:'Device-key INGEST — Pi auths with its own ActorKey → heartbeat live + co-held signal chit (real Pi verified)', s:'done'},
      {n:'ERP process-then-forget — receipt-only (hash+outcome, never raw payload) + idempotent + cockpit test-cycle & receipt ledger (harness 23/0, b69)', s:'done'},
      {n:'Registered fleets — allowlisted devices, per-device governance / metering (L3)', s:'backlog'},
      {n:'AI actor cockpit — sibling of the Pi cockpit (prompt / guardrails / activity)', s:'backlog'},
    ]},
  { id:'catalogue', name:'Catalogue — source-governed distribution', icon:'🏬', load:'lazy', maturity:3, target:4,
    gov:2, govTarget:4, governedUnder:'the source@v blueprint (cascades from the source entity)',
    governedBy:['version-freeze (chit pins the version)','source-rule enforcement (distributor cannot override)','resolve-at-mint seal','two-class RLS (share-read reference · per-copy handoff)'],
    govGap:['tighten-only enforcement test','plan-ceiling / quota'],
    blurb:'The storefront rail: a SOURCE (brand) authors its catalogue + experience + rules ONCE, and that governance TRAVELS to any distributor that serves it — the item always runs under the SOURCE, never the host. CB provides INFORMATION + the governed rail only (catalogue, order-as-chit, penetration heatmap, nearest-distributor INFO); next-level ERP does logistics (receipt-only handoff). Live-verified 2026-07-10 (Athi applied b75–b84 + confirmed the storefront). Stones 1–6b + visualize-apply + spin-the-globe, all live. Held at L3 (no tighten-only enforcement test, no metering/plan-ceiling → the L4 gate is not cleared).',
    features:[
      {n:'Source-as-entity — a brand AUTHORS its own catalogue source + experience + formatting (owner-gated); the item runs under the source, not the host (b78)', s:'done'},
      {n:'Source RULES enforced at order — the distributor CANNOT override (e.g. min-order set by the brand); stamped governed{} on each order line (b78)', s:'done'},
      {n:'Multi-source in one distributor — items namespaced by source, each runs under its own source@v; a mixed cart splits per source', s:'done'},
      {n:'Container model — a mutable product pointer over IMMUTABLE write-once versions; enhance moves the pointer, every chit PINS the exact version it saw (verifiable forever) (b80)', s:'done'},
      {n:'Regional scatter ("spin the globe") — resolve-at-mint into a SEALED regional blueprint (currency · units · language · jurisdiction); runtime is O(1) dereference (b81)', s:'done'},
      {n:'Multilingual storefront — UI labels per region language (en/es/zh/ja/fr/de/ta/hi); 11 regions live incl. Tamil TN + Hindi HI (b83 + b84)', s:'done'},
      {n:'Consent location → AGGREGATE-only penetration heatmap — structurally no customer PII (no customer-id column); owner-gated read (b79)', s:'done'},
      {n:'ERP handoff — receipt-only (refs + routing + sha256, never the raw payload), process-then-forget; per-distributor RLS (b82)', s:'done'},
      {n:'Visualize-apply — "see it on your wall": a cheap client-side recolor loop today; real vision model behind the same UI later', s:'partial'},
      {n:'Real FX · metering / plan-ceiling · real-ERP adapter behind the seam — the L4→L5 gate', s:'backlog'},
    ]},
  { id:'help', name:'Assistant', icon:'💬', load:'eager', maturity:1, target:3,
    gov:null, governedUnder:'— static / read-only Q&A (nothing to govern)',
    blurb:'One context-sensitive Assistant (engine in Core). Q&A is served from the DB (GET /api/assist/questions) — nothing static in the frontend; the same store feeds the AI when wired.',
    features:[
      {n:'Context-sensitive Q&A — page-aware to the SUB-VIEW (context chain: cockpit / dispute / chit → parent → nav), served from the DB', s:'done'},
      {n:'Honest tiered answer (deterministic library floor → LLM)', s:'done'},
      {n:'Tier-1 LLM over the /api/assist proxy', s:'backlog'},
    ]},
  { id:'legend', name:'Legend (this map)', icon:'🔑', load:'lazy', maturity:2, target:2,
    gov:null, governedUnder:'— read-only map (nothing to govern)',
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
      { id:'FR-D2', fr:'Dispute message visible to participants only', test:'dispute-scope.js: 3rd chit-party sees 0 (7/0)', st:'ok' },
      { id:'FR-D3', fr:'Entity-name + who-raised attribution', test:'Message shows entity + raiser', st:'built' },
      { id:'FR-D4', fr:'Dispute [raised]/[resolved] + colour', test:'Resolve → badge flips green', st:'built' },
      { id:'FR-D5', fr:'Composer can reply AS a dispute', test:'Toggle → stored is_dispute', st:'built' },
      { id:'FR-D6', fr:'Close disputed = warn (allow); archive = block', test:'Close → warning; archive → 409', st:'built' },
      { id:'FR-D7', fr:'Per-entity dispute copies (nothing shared)', test:'b68: own copy per party; cross-entity FK dropped', st:'ok' },
    ]},
  { area:'Connector (IoT / ERP)', br:'External systems exchange records over the rail, processing then FORGETTING raw payloads (receipt-only).',
    sr:'Connector = first-class actor (identities row) + connections; capability-gated (API-enforced); per-connection retention.',
    rows:[
      { id:'FR-C1', fr:'Create connector actor → shows in Co-assists', test:'Create → lists + visible', st:'todo' },
      { id:'FR-C2', fr:'Add endpoint (direction, ref, retention)', test:'Add → endpoint shows', st:'todo' },
      { id:'FR-C3', fr:'Enable/disable endpoint (kill switch)', test:'Toggle → state flips', st:'todo' },
      { id:'FR-C4', fr:'Emit signal → chit lands in Task', test:'lifecycle-iot 45/0 + real Pi: received co-held', st:'ok' },
      { id:'FR-C5', fr:'Routes capability-gated (403 if off)', test:'Capability off → 403', st:'built' },
      { id:'FR-C6', fr:'ERP process-then-forget: receipt-only, raw payload never stored, idempotent', test:'erp-connector.js 23/0: hash+outcome kept, no raw payload, retry=1 effect, RLS-isolated', st:'ok' },
    ]},
  { area:'Catalogue — source-governed distribution', br:'A brand governs the experience + rules of its catalogue, and that governance TRAVELS to any distributor that serves it — the item always runs under the source; CB does information + governed rail only, ERP does logistics.',
    sr:'Source-as-entity authors catalogue_source (experience/rules); governance resolves from source@v not host; container = mutable pointer over immutable versions (each chit pins the version); regional resolve-at-mint sealed; two-class RLS (catalogue = share-read reference, erp_handoff = per-copy WITH RLS); penetration structurally PII-free (b75-b84).',
    rows:[
      { id:'FR-K1', fr:'Brand authors its own source + experience (owner-gated)', test:'source-entity.js 6/0 — owner stamped, experience read back', st:'ok' },
      { id:'FR-K2', fr:'Source rule enforced at order; distributor cannot override', test:'source-rules.js 3/0 — below-min → 422 "set by <source>"', st:'ok' },
      { id:'FR-K3', fr:'Multi-source per-source governance in one distributor', test:'multi-source.js 6/0 — same finish name, different source rule', st:'ok' },
      { id:'FR-K4', fr:'Enhance moves the pointer; a pinned chit still resolves its original version', test:'container-model 8/0 + container-wiring 6/0 — v1 pinned resolves after v2', st:'ok' },
      { id:'FR-K5', fr:'Spin the globe — region resolves currency/units/language/jurisdiction, sealed', test:'regional-scatter.js 8/0 — IN/MX/US/EU + sealed cache-hit', st:'ok' },
      { id:'FR-K6', fr:'Penetration is aggregate-only (no customer PII)', test:'penetration.js 6/0 — owner-gated, no customer-id column', st:'ok' },
      { id:'FR-K7', fr:'ERP handoff receipt-only (no raw payload), per-distributor RLS', test:'erp-handoff.js 7/0 — hash+status, RLS-isolated', st:'ok' },
      { id:'FR-K8', fr:'Catalogue / blueprint structural conformance', test:'conform-check.js 10/0', st:'ok' },
      { id:'FR-K9', fr:'Storefront renders region language + visualize-apply', test:'MANUAL — Athi storefront confirm 2026-07-10 (frontend, human-gated)', st:'built' },
    ]},
  { area:'Foundation — RLS isolation', br:'Every entity\'s data is its own — a governance leveler, same isolation solo→multinational.',
    sr:'Postgres RLS: app = cb_app (NOBYPASSRLS); withEntity() sets app.current_entity; ALL entity-data tables enforce FORCE rls_entity, per-copy (b48-b68).',
    rows:[
      { id:'FR-F1', fr:'Entity reads only its own rows', test:'regression suite: non-participant sees 0 across all tables', st:'ok' },
      { id:'FR-F2', fr:'Cross-entity write only via governed fns', test:'chit_deliver rejects bad sender', st:'ok' },
      { id:'FR-F3', fr:'Schema reproducible + change-controlled', test:'Baseline rebuilds prod on scratch DB', st:'todo' },
    ]},
  { area:'Core — the mailbox rail', br:'Parties exchange sealed, co-held REPLICATED records ("chits") — each holds its own copy, nothing shared.',
    sr:'Per-entity copy keyed (chit_id, entity_id, direction); every related table per-copy too (messages/attachments/disputes); append-only state_log; seal = schema snapshot.',
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
  { area:'Access control', lvl:'strong', what:'RLS entity isolation LIVE + per-copy — cb_app is NOSUPERUSER NOBYPASSRLS; every query scoped by app.current_entity; ALL entity tables FORCE-RLS (b48-b68).', raise:'DONE 2026-07-08 — RLS now covers folder/attachments/messages/disputes too (per-copy); only identities is the deliberate directory carve-out. Next: external pen-test → L5.' },
  { area:'Secrets & audit', lvl:'gap', what:'Secrets in Railway env vars, not a vault/KMS. No external pen-test yet (so security honestly ≤ L4).', raise:'Move secrets to a KMS/vault; commission an external pen-test → the L5 gate.' },
];

/* ── FOUNDATIONS — the SECOND axis: what the subject STANDS ON. Capabilities need only WORK; a foundation needs
 *    EVIDENCE, so each carries a PROOF. Ladder (security flavor): L1 exists · L2 clean mechanism · L3 enforced &
 *    isolated · L4 governed & provable · L5 audited/certified. Mirrors C:\dev\FOUNDATIONS-SCORECARD.md. ── */
const FOUNDATION_CATALOGUE = [
  { name:'Multitenant isolation (RLS)', icon:'🔒', level:4, target:5,
    what:'App connects as cb_app (NOSUPERUSER NOBYPASSRLS); EVERY entity-data table has FORCE RLS + an rls_entity policy; every query runs on withEntity(app.current_entity); cross-entity writes ONLY via SECURITY DEFINER fns.',
    proof:'Live regression suite (100+ assertions across regression / dispute-scope / actor / lifecycle-iot / erp) — a non-participant reads 0. Live in prod since 2026-07-04; per-copy hardened 2026-07-08 (b48–b69).' },
  { name:'Sealed co-held record (the rail)', icon:'📜', level:3, target:4,
    what:'A chit is delivered as per-entity REPLICATED copies (nothing shared) + an append-only state_log; delivery via chit_deliver / chit_message_deliver / chit_dispute_deliver.',
    proof:'regression.js — per-copy delivery, cross-entity isolation, and INDEPENDENT delete (one party deletes; the other party’s copy survives).' },
  { name:'Transaction atomicity', icon:'⚛️', level:3, target:4,
    what:'The per-copy fan-out is ALL-OR-NOTHING: a SECURITY DEFINER delivery fn writes every participant’s copy inside ONE transaction, so a mid-fan-out failure leaves NO partial copies. Dispute + timeline commit together (INV-2); the ERP path uses a receipt-as-lock for exactly-once.',
    proof:'chit_deliver / chit_dispute_deliver are single-statement definer calls (one tx); the regression suite never observes a partial delivery; erp-connector.js proves receipt-lock idempotency (retry = one receipt, one effect).' },
  { name:'Dispute confidentiality (the USP)', icon:'⚑', level:3, target:4,
    what:'Per-copy: each party holds its OWN chit_disputes copy (b68, FORCE RLS); dispute_participants retired; dispute messages replicated to the roster ONLY.',
    proof:'dispute-scope.js — a 3-party chit + a targeted dispute → the chit party NOT in the dispute sees 0 (7/0).' },
  { name:'Governance cascade', icon:'🏛️', level:2, target:4,
    what:'Constitution + version-freeze + provenance; unified mint path (b47). Tighten-only intent across the 7 governance layers.',
    proof:'To build: tighten-only enforcement test + provenance on minted entities (design specced, not yet enforced).' },
];

/* ── SUBJECT tab — the core reframe: the sealed co-held record is a SUBJECT (a noun), not a functionality. The
 *    capabilities are lifecycles (verbs) that act ON it. The clearest contrast is a shared-document tool. ── */
function _subjectTabHtml(){
  const vs=(them,us)=>'<tr style="border-top:1px solid var(--line)"><td style="padding:6px 9px;color:var(--grey);vertical-align:top">'+them+'</td><td style="padding:6px 9px;color:var(--ink);font-weight:600;vertical-align:top">'+us+'</td></tr>';
  const g=(t,m,alt)=>'<div style="display:flex;gap:10px;padding:6px 10px;font-size:11px;'+(alt?'background:#f6f9fd;':'')+'"><span style="flex:0 0 122px;font-weight:700;color:#2b4a72">'+t+'</span><span style="color:var(--ink);line-height:1.45">'+m+'</span></div>';
  return '<div style="padding:14px 16px;overflow:visible">'
    // RAIL — the hero picture (public asset; scalable vector)
    +'<img src="/rail-metaphor.svg" alt="Chit &amp; Bridge — a governed rail: two tracks (Task, Order), wagon = your business, private yards, dispute siding, network" loading="lazy" style="width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:12px;background:#fff"/>'
    +'<div style="border:1px solid #cbd8ec;background:linear-gradient(180deg,#f6f9fe,#fff);border-radius:13px;padding:14px 16px;margin:10px 0 14px">'
      +'<div style="font-family:\'Space Grotesk\';font-weight:800;font-size:18px;color:var(--ink)">Chit &amp; Bridge is a governed rail</div>'
      +'<div style="font-size:12.5px;color:var(--ink);line-height:1.55;margin-top:6px"><b>Content-neutral, governance-absolute.</b> You decide <b>what</b> moves between two entities — the business defines that; we guarantee that <b>whatever moves is governed</b>. A train can\'t leave the track.</div>'
      +'<div style="font-size:12px;color:#2b4a72;background:#eef3fb;border:1px solid #cfe0f4;border-radius:9px;padding:8px 11px;margin-top:10px">🧭 <b>As easy as a mailbox</b> for the end user — zero learning curve. The mailbox is how it <i>feels</i>; the rail is what it <i>is</i>.</div>'
    +'</div>'
    +'<div style="font-size:11px;font-weight:700;color:var(--ink);margin-bottom:5px">The subject — the sealed, co-held record <span style="color:var(--grey);font-weight:600">(the &ldquo;chit&rdquo;)</span></div>'
    +'<div style="font-size:12px;color:var(--ink);line-height:1.55;margin-bottom:11px">Each item is a <b>governed obligation, replicated per party</b> — your own sealed copy, disputable on divergence. It is the <b>noun</b> everything else acts on; the capabilities are the <b>verbs</b>. Two tracks — <b>Task</b> (coming to you) and <b>Order</b> (going from you) — carry it; the <b>wagon is your business</b>, and the rail never opens it.</div>'
    +'<div style="font-size:11px;font-weight:700;color:var(--ink);margin-bottom:5px">Why it isn&rsquo;t just email — or a shared workspace</div>'
    +'<table style="width:100%;border-collapse:collapse;font-size:11px;border:1px solid var(--line);border-radius:8px;overflow:hidden">'
      +'<tr style="background:#f4f4f2;color:var(--grey);font-weight:700;font-size:10px"><td style="padding:6px 9px">Them</td><td style="padding:6px 9px">Chit &amp; Bridge — the governed rail</td></tr>'
      + vs('<b>Email:</b> carries anything, guarantees nothing','Every item <b>sealed, isolated, disputable</b>')
      + vs('<b>Confluence:</b> one shared document','N sealed copies — one per party')
      + vs('Edit-in-place, last-writer-wins','Append-only; atomic per-copy fan-out')
      + vs('Access control = who may see it','Isolation = you only ever hold YOUR copy')
      + vs('Divergence is a merge conflict','Divergence is a DISPUTE — a private siding')
    +'</table>'
    +'<div style="font-size:11px;font-weight:700;color:var(--ink);margin:14px 0 5px">Rail glossary — the whole vocabulary in one place</div>'
    +'<div style="border:1px solid var(--line);border-radius:10px;overflow:hidden">'
      + g('🛤️ Rail','governance itself — the track a train cannot leave', false)
      + g('Two tracks','Task (coming to you) · Order (going from you)', true)
      + g('Wagon / bogie','your business — the form you define; the rail never opens it', false)
      + g('Cargo','your data inside the wagon — never inspected', true)
      + g('Private yard','your isolated copy (RLS) — your wagons, yours alone', false)
      + g('Travel together','coupled on the journey, yet each keeps its own wagon (co-held AND per-copy)', true)
      + g('Signals','statuses — open · act · close · reopen; governed, stamped on the log', false)
      + g('Service','a scheduled multi-stop run (vs a one-hop parcel = a goods order)', true)
      + g('Private siding','a dispute — confidential, per-party; the network runs past', false)
      + g('Network','reachable destinations — public map, private yards', true)
      + g('Crew','co-assists: human · IoT · ERP · AI — same rail, same rules', false)
      + g('Roam the bogies','one connection, many facilities — never tied to one', true)
    +'</div>'
    +'<div style="font-size:10.5px;color:var(--grey);margin-top:11px;line-height:1.5">We <b>replicate ownership</b> instead of <b>sharing access</b> — and it still feels like an inbox. See <b>🧱 Foundations</b> for the proofs, and <b>⬢ Capabilities</b> for the lifecycles built on it.</div>'
  +'</div>';
}

/* ── FOUNDATIONS tab — the trust floor as maturity + PROOF (core hardening + atomicity now first-class). ── */
function _foundTabHtml(){
  const lvlBadge=(l,t)=>{ const tt=(t&&t>l)?('→L'+t):''; return '<span title="Foundation maturity — L1 exists · L2 clean mechanism · L3 enforced+isolated · L4 governed+provable · L5 audited/certified" style="font-size:10px;font-weight:800;color:#1f6f4a;background:#e7f4ee;border:1px solid #bfe0cf;border-radius:6px;padding:1px 7px">L'+l+tt+'</span>'; };
  const card=(f)=>'<div style="border:1px solid var(--line);border-radius:11px;padding:11px 13px;margin-bottom:10px">'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:15px">'+f.icon+'</span><span style="font-family:\'Space Grotesk\';font-weight:700;font-size:13.5px">'+esc(f.name)+'</span><span style="margin-left:auto">'+lvlBadge(f.level,f.target)+'</span></div>'
    +'<div style="font-size:13px;color:var(--ink);line-height:1.5;margin-bottom:6px">'+esc(f.what)+'</div>'
    +'<div style="font-size:12px;color:var(--grey);line-height:1.5;background:#f7f9fc;border:1px solid var(--line);border-radius:8px;padding:8px 10px"><b style="color:#2f8f5b">PROOF:</b> '+esc(f.proof)+'</div>'
  +'</div>';
  return '<div style="padding:12px 13px;overflow:visible">'
    +'<div style="font-size:13px;color:var(--grey);margin-bottom:10px">What the <b>subject</b> stands on — the trust floor. A capability needs only to WORK; a <b>foundation needs EVIDENCE</b>, so each carries the PROOF that makes its level evident, not asserted. Ladder: L1 exists · L2 clean mechanism · L3 enforced &amp; isolated · L4 governed &amp; provable · L5 audited/certified.</div>'
    +FOUNDATION_CATALOGUE.map(card).join('')
    +'<div style="font-size:10.5px;color:var(--grey);text-align:center;padding-top:2px">Security foundations are honestly capped <b>≤ L4</b> until an external pen-test exists — that’s the L5 gate.</div>'
  +'</div>';
}

/* ── GOVERNANCE STACK tab — the full architecture, universe → chit (the governance-stack.svg). ── */
function _stackTabHtml(){
  return '<div style="padding:12px 13px">'
    +'<div style="font-size:12px;color:var(--grey);margin-bottom:9px;line-height:1.55">The full governance stack — <b>universe → chit</b>, one spine. Every value is an <b>attribute (data)</b> the engine reads; nothing governance lives in code. Colour: <span style="color:#2f8f5b;font-weight:700">proven live</span> · <span style="color:#8a6d1f;font-weight:700">vision / design</span>. Spinning a new platform (e.g. AWS · Mexico · service-desk) = one row.</div>'
    +'<img src="/governance-stack.svg" alt="Chit &amp; Bridge governance stack — universe to chit" loading="lazy" style="width:100%;height:auto;border:1px solid var(--line);border-radius:12px;background:#fff"/>'
  +'</div>';
}

function _lbTabBar(){
  const tab=(typeof _lbTab!=='undefined')?_lbTab:'subject';
  const btn=(id,label)=>`<button onclick="setLbTab('${id}')" style="border:0;background:none;cursor:pointer;padding:8px 15px;font-size:13.5px;font-weight:${tab===id?'700':'500'};color:${tab===id?'var(--ink)':'var(--grey)'};border-bottom:2px solid ${tab===id?'var(--accent,#3F66A6)':'transparent'}">${label}</button>`;
  return `<div style="display:flex;gap:2px;border-bottom:1px solid var(--line);padding:0 8px;flex-wrap:wrap">${btn('subject','📜 The subject')}${btn('found','🧱 Foundations')}${btn('stack','🏛️ Governance stack')}${btn('work','⬡ Work patterns')}${btn('cap','⬢ Capabilities')}${btn('edge','🎯 The edge')}${btn('life','🔀 Lifecycle')}${btn('sec','🔒 Security')}${btn('real','🔬 Reality')}</div>`;
}
function setLbTab(t){ _lbTab=t; _openLegendImpl(); }
var _lbFontScale; try{ _lbFontScale=parseFloat(localStorage.getItem('cb_lb_fs'))||1; }catch(_){ _lbFontScale=1; }
function lbFont(d){ _lbFontScale=Math.max(0.85,Math.min(1.6,(_lbFontScale||1)+d*0.1)); try{ localStorage.setItem('cb_lb_fs',_lbFontScale); }catch(_){} var b=document.getElementById('lbbody'); if(b) b.style.zoom=_lbFontScale; }

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
  return `<div style="padding:12px 13px;overflow:visible">
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
  return `<div style="padding:12px 13px;overflow:visible">
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
  return '<div style="padding:14px 16px;overflow:visible">'
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
    +'<div style="margin-top:16px"><div style="font-size:11px;font-weight:700;color:var(--ink);margin-bottom:5px">Distribution lens — the same edge, a second domain</div>'
      +'<div style="font-size:10.5px;color:var(--grey);margin-bottom:6px">Source-governed distribution competes with catalogue/commerce tools, not email. A brand&rsquo;s governance <b>rides to any distributor</b>; CB carries the <b>information + rules</b>, ERP does the logistics — no marketplace lock-in, no logistics grab.</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:10.5px">'
        +'<tr style="color:var(--grey);font-weight:700;font-size:9.5px"><td style="text-align:left;padding:3px 4px">Channel</td><td style="padding:3px 4px">Gov travels</td><td style="padding:3px 4px">Neutral</td><td style="padding:3px 4px">Info-only</td><td style="padding:3px 4px">Dispute</td></tr>'
        + crow('Brand storefront (Shopify)','n','n','n','n',false)
        + crow('Marketplace / distributor portal','p','n','n','n',false)
        + crow('PIM (Salsify / Akeneo)','p','y','y','n',false)
        + crow('EDI / ERP distribution','p','n','n','n',false)
        + crow('Chit &amp; Bridge','y','y','y','p',true)
      +'</table>'
      +'<div style="font-size:9.5px;color:var(--grey);margin-top:5px">Cols: <b>Gov travels</b> to the distributor · <b>Neutral</b> = distributor-neutral, no host lock · <b>Info-only</b> = no logistics grab · <b>Dispute</b> = per-copy. Only CB combines governance-travels + neutral + information-only (built + harness-verified) — but <b>not yet adopted by a real brand+distributor pair</b>, so it&rsquo;s a target, not a trophy.</div>'
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
  return '<div style="padding:14px 16px;overflow:visible">'
    +'<div style="font-size:11.5px;color:var(--grey);margin-bottom:10px">Full honesty — for each edge, where we genuinely stand and what it takes to <b>earn</b> that level. Nothing counts as done until a human proved it (our review-gate rule).</div>'
    + row('Governed peer two-way (the communication edge)','built','Per-entity co-held copies, messages both ways, per-party dispute threads — ALL replicated per-copy (nothing shared), proven by the regression suite.','Run one live A↔B loop with a real user; then volume-test it.')
    + row('Multitenant isolation (RLS)','real','Live in prod, PER-COPY across ALL entity tables — cb_app cannot bypass RLS; the regression suite proves a non-participant reads 0 (100+ assertions).','Commission an external pen-test to move from self-verified to attested (the L5 gate).')
    + row('Sealed co-held record + provenance','part','Freeze-at-send + an append-only state log exist.','Add an immutability / tamper test proving history cannot be rewritten.')
    + row('Dispute confidentiality (the USP)','real','Per-COPY: each party owns its dispute; messages scoped to the roster — PROVEN (dispute-scope 7/0: in a 3-party chit the non-dispute party sees 0).','Human live-run of the dispute UI; then external pen-test.')
    + row('Governed + accessible (the quadrant)','aim','The rail is governed; affordability/ease for a solo player is designed, not proven.','One real small-player user completes a real loop cheaply — the decisive wedge.')
    + row('Self-measuring maturity (this Legend)','part','An honest hand-authored scoreboard (these very tabs).','Wire it to real Delivery Records + test results so it reads automatically (the L4 step).')
    +'<div style="font-size:10.4px;color:var(--grey);text-align:center;padding-top:9px;border-top:1px solid var(--line);margin-top:6px">The ladder that earns all of it: <b>one test lifecycle → volume → pen-test → external validation.</b> Concept: years · Product: ~2 weeks. Early by timeline, honest by choice.</div>'
  +'</div>';
}

/* ── WORK PATTERNS tab — each pattern is a minted governed JOURNEY, framed by the higher objective it achieves.
 *    Mirrors C:\dev\SPEC-work-patterns.md + the rail map. Authored (like the other tabs); the live registry is
 *    WORK_PATTERNS in Core — keep in sync when patterns change. ── */
function _workTabHtml(){
  const R='var(--accent,#3F66A6)';
  const seal=t=>`<span style="font-size:10.5px;color:#2f8f5b;background:#e7f3ec;border-radius:5px;padding:1px 7px">🔒 ${t}</span>`;
  const lic =t=>`<span style="font-size:10.5px;color:#7a5e22;background:var(--gold-soft,#f4eeda);border:1px solid var(--gold-line,#e0d4a8);border-radius:5px;padding:1px 7px">🎫 ${t}</span>`;
  const knob=t=>`<span style="font-size:10.5px;color:#9a6d1a;background:#f7efdd;border-radius:5px;padding:1px 7px">✎ ${t}</span>`;
  const up  =t=>`<span style="font-size:10.5px;color:var(--grey)">↑ ${t}</span>`;
  const chain=t=>`<span style="font-size:10.5px;color:${R};background:#eef3fb;border-radius:5px;padding:1px 7px">${t}</span>`;
  const stage=(t,d,tag)=>`<span style="display:inline-flex;flex-direction:column;background:#f6f8fb;border:1px solid var(--line);border-radius:8px;padding:5px 9px;vertical-align:top;max-width:158px"><b style="font-size:11px">${esc(t)}${tag?` <span style="font-family:'Space Mono';font-size:8.5px;color:${R};background:#eef3fb;border-radius:4px;padding:0 4px">${tag}</span>`:''}</b>${d?`<span style="color:var(--grey);font-size:10px;line-height:1.35;margin-top:2px">${d}</span>`:''}</span>`;
  const arr=`<span style="color:var(--grey);font-size:11px;padding:0 1px">→</span>`;
  const journey=(icon,name,sub,stages)=>`<div style="border:1px solid var(--line);border-radius:11px;padding:11px 13px;margin-bottom:10px"><div style="font-weight:700;font-size:12.5px;margin-bottom:8px">${icon} ${name} <span style="color:var(--grey);font-weight:500">— ${sub}</span></div><div style="display:flex;flex-wrap:wrap;gap:6px;align-items:stretch">${stages.join(arr)}</div></div>`;
  const line=o=>`<div style="border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:11px">
    <div style="display:flex;align-items:center;gap:9px">
      <span style="width:30px;height:30px;border-radius:8px;display:grid;place-items:center;font-size:15px;background:#eef3fb;border:1px solid var(--line)">${o.icon}</span>
      <span style="font-family:'Space Grotesk';font-weight:700;font-size:14.5px">${esc(o.name)}</span>
      <span style="font-family:'Space Mono';font-size:11px;color:${R};background:#eef3fb;border:1px solid var(--line);border-radius:6px;padding:1px 6px">${esc(o.pid)}</span>
      <span style="margin-left:auto;font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:${o.live?'#2f8f5b':'#8a8f98'};border:1px ${o.live?'solid #bfe0cf':'dashed #c2c6cc'};border-radius:5px;padding:1px 6px">${o.live?'Live':'Designed'}</span>
    </div>
    <div style="font-size:13px;color:var(--ink);background:#eef3fb;border-left:3px solid ${R};border-radius:0 8px 8px 0;padding:7px 11px;margin:9px 0 8px;line-height:1.5"><b style="font-family:'Space Mono';font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:${R};margin-right:7px">Achieves</b>${o.obj}</div>
    <div style="font-size:11.5px;color:var(--grey);margin-bottom:8px;line-height:1.55">${o.flow}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">${o.chips.join('')}</div>
  </div>`;
  const lines=[
    { icon:'🛰️', name:'IoT signal', pid:'iot-signal@v1', live:true,
      obj:'Turns a <b>physical event into a governed, owned, actionable record</b> — an exception can\'t be lost, missed, or denied.',
      flow:'Device telemetry (ActorKey) → <b>resolve</b> folder·assignee·copy → seal · file · assign · notify → <b>Task-only signal chit</b> → escalation (SMS · AI · robot →∞)',
      chips:[seal('Copy · Task-only'),seal('Isolation · per-copy'),lic('Connector · ≤25 devices'),up('health · last-seen · exceptions/day')] },
    { icon:'✉️', name:'Send a chit', pid:'send-chit@v1', live:true,
      obj:'Two entities <b>transact on a sealed, co-held record neither can unilaterally rewrite</b> — trust without a middleman.',
      flow:'Line items / terms (compose) → <b>deliver co-held</b> copies → advance signals (open→act→close) → co-held record → invoice · dispute · forward',
      chips:[seal('Isolation · per-copy (RLS)'),knob('self-copy: both / order / task'),lic('Core · unlimited'),up('delivered · status advances')] },
    { icon:'⚑', name:'Raise a dispute', pid:'raise-dispute@v1', live:true,
      obj:'Resolves disagreement <b>confidentially and per-party, with no third party</b> — the relationship survives the conflict. <i>The USP.</i>',
      flow:'Reason / category (a party) → <b>private siding</b> → raiser resolves its own → resolution (per-party copies) → roster only',
      chips:[seal('Confidentiality · roster-only'),lic('Dispute · included'),up('raised · resolved · open count')] },
    { icon:'🧾', name:'The commercial run', pid:'order → invoice → receipt', live:false,
      obj:'Carries a <b>whole trade — request to proof — with unbroken provenance at every hop</b>.',
      flow:'order → delivery_note → invoice → payment → receipt — each hop\'s <b>output is the next hop\'s input</b>',
      chips:[chain('Purposes today · pattern-ize next')] },
  ];
  const spine=[['Constitution','base@v1'],['↳ Capability','connector@v1'],['↳ Work-pattern','iot-signal@v1'],['↳ Chit','stamped']].map((s,i)=>`<div style="flex:1 1 118px;min-width:110px;padding:9px 11px;${i?'border-left:1px solid var(--line)':''};${i===3?'background:#eef3fb':''}"><div style="font-family:'Space Mono';font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--grey)">${s[0]}</div><div style="font-weight:700;font-size:13px;${i===3?'color:'+R:''}">${s[1]}</div></div>`).join('');
  const notif=[
    ['🏢 Entity','a copy delivered to Task / Order','mailbox lists; entity-scoped RLS'],
    ['🧑 Actor','assigned / visible change — delivery·status·message·dispute','per-actor <b>unread</b> + bell + message centre'],
    ['🛰️ IoT','<i>emits</i>, doesn\'t receive','auto-file to folder + assign to resolved actor (+ optional email); health in cockpit'],
    ['🔌 ERP','a handoff receipt lands','receipt ledger, per-distributor RLS; process-then-forget'],
    ['🤖 AI','a proposal to authorize','human authorize → confirm (in-loop)'],
    ['🛍️ Customer','order confirmation','OTP on the order — not a full mailbox'],
  ].map(r=>`<tr style="border-top:1px solid var(--line)"><td style="padding:7px 9px;font-weight:600;white-space:nowrap;vertical-align:top">${r[0]}</td><td style="padding:7px 9px;color:var(--ink);vertical-align:top">${r[1]}</td><td style="padding:7px 9px;color:var(--grey);vertical-align:top">${r[2]}</td></tr>`).join('');
  return `<div style="padding:13px 15px;overflow:visible">
    <div style="font-size:12.5px;color:var(--grey);line-height:1.6;margin-bottom:12px">A work pattern isn't a form — it's a <b style="color:var(--ink)">governed journey</b>: a minted, version-frozen blueprint a chit runs end-to-end, stamped with everything that governed it. Each is framed by the <b style="color:var(--ink)">higher objective it achieves</b> — no outcome → not a work pattern; the flow shows how.</div>
    <div style="display:flex;flex-wrap:wrap;border:1px solid var(--line);border-radius:11px;overflow:hidden;margin-bottom:16px">${spine}</div>
    ${lines.map(line).join('')}
    <div style="border:1px solid ${R};background:linear-gradient(180deg,#eef3fb,var(--bg,#fff));border-radius:13px;padding:14px 16px;margin:6px 0 16px">
      <div style="font-family:'Space Grotesk';font-weight:800;font-size:15px;color:${R}">A catalogue is a contract, not a list</div>
      <div style="font-size:13px;color:var(--ink);background:#fff;border-left:3px solid ${R};border-radius:0 8px 8px 0;padding:7px 11px;margin:9px 0;line-height:1.5"><b style="font-family:'Space Mono';font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:${R};margin-right:7px">Achieves</b>Extends a <b>brand's governance to every customer through any distributor</b> — control without custody.</div>
      <div style="font-size:12.5px;color:var(--ink);line-height:1.55">The source's governance amalgamated into one construct that <b>travels</b>: the order runs under the source's minted rules wherever served, the distributor <b>can't override</b>, and the chit <b>freezes the exact version</b> seen. Bogie line-up public (browse), cargo private (order), source rules = the sealed wagon-spec that binds every yard.</div>
    </div>
    <div style="font-family:'Space Grotesk';font-weight:700;font-size:14px;margin:14px 0 8px">The journeys that travel</div>
    ${journey('🏷️','Source journey','a brand\'s governance reaches every customer, through any distributor',[
      stage('Author','brand writes its source — experience + rules, owner-gated','b78'),
      stage('Cascade','to every distributor that references it'),
      stage('Travel','item runs under source@v; distributor can\'t override'),
      stage('Order','the chit freezes the exact version seen','container@v'),
      stage('Penetration','aggregate heatmap back to the brand — no PII','b79'),
    ])}
    ${journey('🧬','Schema journey','the wagon\'s shape is version-frozen, provenance kept',[
      stage('Define','the entity owns its schema — the wagon shape'),
      stage('Freeze at send','snapshot the governing schema@v'),
      stage('Travel','the frozen schema rides with every copy'),
      stage('Pin','the chit records schema@version — verifiable forever'),
    ])}
    <div style="font-family:'Space Grotesk';font-weight:700;font-size:14px;margin:16px 0 7px">Notifications — who gets told, and how</div>
    <div style="overflow-x:auto;border:1px solid var(--line);border-radius:11px"><table style="width:100%;border-collapse:collapse;font-size:11.5px;min-width:520px"><tr style="background:#eef3fb"><td style="padding:6px 9px;font-family:'Space Mono';font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--grey)">Crew</td><td style="padding:6px 9px;font-family:'Space Mono';font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--grey)">Notified by</td><td style="padding:6px 9px;font-family:'Space Mono';font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--grey)">Handled</td></tr>${notif}</table></div>
    <div style="font-size:10.5px;color:var(--grey);line-height:1.55;margin-top:11px">Mechanism: per-actor unread = <b>chit_reads</b> vs <b>chit_status.updated_at</b>; bell + centre from the append-only <b>state_log</b>; cross-entity delivery only via the SECURITY DEFINER fns. · <b>Honest:</b> 3 patterns minted+live; the commercial run is real as purposes (not pattern-ized); AI &amp; customer rows are designed.</div>
  </div>`;
}

function _openLegendImpl(){
  let host=document.getElementById("lbhost");
  if(!host){ host=document.createElement('div'); host.id='lbhost'; document.body.appendChild(host); }  // pre-auth: create the host if the app shell isn't mounted (shareable /#/legend)
  _legendOpen=true;
  if(typeof _lbTab==='undefined') _lbTab='subject';   // open on THE SUBJECT (the conceptual anchor) — the sealed co-held record everything else acts on
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
    return `<div style="display:flex;gap:8px;align-items:flex-start;font-size:13px;color:var(--ink);padding:4px 0;line-height:1.45"><span style="color:${col};flex:none">${ic}</span><span>${esc(f.n)}</span></div>`; };
  // GOVERNANCE BAND — the SECOND axis: gov maturity + what governs it + the L4 gap (SPEC-governance-in-legend.md).
  const govChips=(arr,col,bg,bd)=>(arr||[]).map(x=>`<span style="font-size:10px;color:${col};background:${bg};border:1px solid ${bd};border-radius:5px;padding:1px 6px">${esc(x)}</span>`).join(' ');
  const govBand=(c)=>{
    if(c.load==='planned') return '';                        // planned → nothing to govern yet
    if(c.gov==null && !c.governedUnder) return '';
    const na=(c.gov==null);
    const t=(c.govTarget&&c.govTarget>c.gov)?`→L${c.govTarget}`:'';
    const badge=na
      ? `<span style="font-size:9.5px;font-weight:800;color:#8a8f98;background:#f0f0ee;border:1px solid var(--line);border-radius:6px;padding:1px 7px">gov · N/A</span>`
      : `<span title="Governance maturity — 1 declared · 2 designed · 3 enforced+isolated · 4 governed+provable · 5 audited/certified" style="font-size:9.5px;font-weight:800;color:#1f6f4a;background:#e7f4ee;border:1px solid #bfe0cf;border-radius:6px;padding:1px 7px">gov · L${c.gov}${t}</span>`;
    const under=c.governedUnder?`<span style="font-size:10.5px;color:var(--grey)">under <b style="color:#2f6f4a;font-weight:600">${esc(c.governedUnder)}</b></span>`:'';
    const mech=(c.governedBy&&c.governedBy.length)?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">${govChips(c.governedBy,'#1f6f4a','#eef6f0','#cfe4d7')}</div>`:'';
    const gap=(c.govGap&&c.govGap.length)?`<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:5px"><span style="font-size:9px;font-weight:700;color:#8a6d1f">to L${c.govTarget||4}:</span>${govChips(c.govGap,'#8a6d1f','#fbf6e9','#e8dab4')}</div>`:'';
    return `<div style="border:1px solid #d7e6dc;background:#f6faf7;border-radius:8px;padding:7px 9px;margin:0 0 9px">
      <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">${badge}${under}</div>${mech}${gap}
    </div>`;
  };
  const card=(c)=>`<div style="border:1px solid var(--line);border-radius:11px;padding:11px 13px;margin-bottom:10px;background:${c.load==='planned'?'#faf9f5':'#fff'}">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px"><span style="font-size:15px">${c.icon}</span><span style="font-family:'Space Grotesk';font-weight:700;font-size:13.5px">${esc(c.name)}</span><span style="margin-left:auto;display:flex;gap:6px;align-items:center">${matBadge(c)}${loadBadge(c)}</span></div>
    <div style="font-size:12.5px;color:var(--grey);margin-bottom:8px;line-height:1.5">${esc(c.blurb)}</div>
    ${govBand(c)}
    ${c.features.map(featRow).join('')}
  </div>`;
  const capBody=`
    <div style="padding:11px 13px 6px;font-size:11.5px;color:var(--grey);border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:10px;align-items:center">
      <span><b style="color:var(--ink)">${built}</b> live capabilities · <b style="color:var(--ink)">${nf}</b> features</span>
      <span style="margin-left:auto">Status: <span style="color:#2f8f5b">✅ done ${d}</span> · <span style="color:#a9791f">◐ partial ${p}</span> · <span style="color:#9aa3a7">○ backlog ${b}</span></span>
    </div>
    <div style="padding:12px 13px;overflow:visible">${CAP_CATALOGUE.map(card).join('')}
      <div style="font-size:10.5px;color:var(--grey);text-align:center;padding-top:4px">Load: <b>always on</b> ships with the app · <b>lazy</b> loads on first use · <b>planned</b> not built yet. · <b>L1–5</b> maturity: 1 Proven · 2 Packaged · 3 Itemised · 4 Governed · 5 Productized (→ = target). Kept true to the code.</div>
      <div style="font-size:10.5px;color:var(--grey);text-align:center;padding-top:3px">🏛️ <b>Governance rides on each capability</b> — the green band is the SECOND axis: <b>gov L1–5</b> (1 declared · 2 designed · 3 enforced+isolated · 4 governed+provable · 5 audited) <b>under</b> its cascade layer, with the amber <b>“to L4”</b> gap. Gov usually LAGS maturity — that lag IS the distance to L4. <b>N/A</b> = static/read-only, nothing to govern.</div>
    </div>`;
  const body = (_lbTab==='subject') ? _subjectTabHtml() : (_lbTab==='found') ? _foundTabHtml() : (_lbTab==='stack') ? _stackTabHtml() : (_lbTab==='life') ? _lifeTabHtml() : (_lbTab==='sec') ? _secTabHtml() : (_lbTab==='edge') ? _edgeTabHtml() : (_lbTab==='real') ? _realTabHtml() : (_lbTab==='work') ? _workTabHtml() : capBody;
  const titles = { subject:'the subject — the sealed co-held record', found:'foundations — the trust floor + proof', stack:'the governance stack — universe → chit', cap:'capabilities &amp; features', life:'lifecycle &amp; traceability', sec:'security posture', edge:'positioning &amp; edge', real:'reality &amp; how we earn it', work:'work patterns — the governed journeys' };
  host.innerHTML=`<div class="notifover" onclick="closeLegend()"><div class="notifpanel" style="position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;border-radius:0;overflow:hidden;display:flex;flex-direction:column;background:#fff" onclick="event.stopPropagation()">
    <div style="display:flex;align-items:center;gap:12px;padding:16px 20px;background:linear-gradient(180deg,#f7f9fc,#fff);border-bottom:1px solid var(--line);flex:none">
      <span style="font-size:22px">🔑</span>
      <div style="line-height:1.15"><div style="font-family:'Space Grotesk';font-weight:700;font-size:19px;color:var(--ink)">What we serve</div><div style="font-size:12.5px;color:var(--grey)">${titles[_lbTab]||titles.cap}</div></div>
      <div style="margin-left:auto;display:flex;align-items:center;gap:6px">
        <button onclick="lbFont(-1)" title="Smaller text" style="border:1px solid var(--line);background:none;cursor:pointer;font-size:12px;font-weight:700;color:var(--grey);border-radius:6px;width:27px;height:27px;line-height:1;padding:0">A−</button>
        <button onclick="lbFont(1)" title="Larger text" style="border:1px solid var(--line);background:none;cursor:pointer;font-size:15px;font-weight:700;color:var(--ink);border-radius:6px;width:27px;height:27px;line-height:1;padding:0">A+</button>
        <button onclick="closeLegend()" style="border:0;background:none;cursor:pointer;font-size:26px;line-height:1;color:var(--grey);margin-left:4px" aria-label="Close">✕</button>
      </div>
    </div>
    <div style="flex:none">${_lbTabBar()}</div>
    <div style="flex:1;overflow:auto;min-height:0"><div id="lbbody" style="max-width:1040px;margin:0 auto;zoom:${(typeof _lbFontScale!=='undefined'?_lbFontScale:1)}">${body}</div></div>
  </div></div>`;
}
