# Owner actions — compliance acts code cannot do

Organisational acts from `docs/research/COMPLIANCE-OBLIGATIONS-2026-10.md`. None is done until the owner ticks it with a date and where
the proof is kept. The Standards register (`public/app/cap-standards.js`) shows these rows as Partly or Planned until then.
Other compliance rounds (CO1 privacy, CO3 records) add their own sections below.

## CO2 · security controls (2026-10-13)
| ✔ | Action | Why (rule) | Proof to keep |
|---|---|---|---|
| ☐ | **Run `chitbridge-api/migrations/b303_state_log_append_only.sql`** (Supabase SQL editor, as postgres), steps 1–3 | Chit history append-only (ISO 27001 A.8.15; Companies Act r.3(1) spirit) | Step 3 output: `update_grant_must_be_0 = 0`, `delete_guard_must_be_1 = 1` |
| ☐ | **Set `CB_ALERT_WEBHOOK`** on Railway (an on-call channel's incoming webhook), then raise one test critical | Wakes a person inside the CERT-In 6 h clock | Screenshot of the alert arriving |
| ☐ | **Register a CERT-In point of contact** (name, designation, phone, e-mail) | CERT-In Directions 2022, dir.(iii) ◐ | CERT-In acknowledgement |
| ☐ | **Logs kept 180 days (≥ 1 year advised) in India** — ship Railway logs to a sink in an Indian region, or move the API's region | CERT-In dir.(iv) 180 days in India ◐; DPDP Rules r.6(1)(e) 1 year (May 2027) ◐. Today the API runs in **Singapore** (`public/app.html`, API_BASE note) | Sink config + a sample line ≥ 180 days old |
| ☐ | **Clocks synced to NIC/NPL NTP** (or a provider statement that the host clock tracks them) | CERT-In dir.(i) ◐ | Provider statement / config |
| ☐ | **Lawyer-checked notice wording** for India (Board + person), Australia (OAIC + person), UAE (Data Office + person) | DPDP s.8(6) · Privacy Act s.26WK · PDPL Art.9 | Signed templates in a private folder |
| ☐ | **First tabletop drill** of `INCIDENT-RUNBOOK.md`; record it in `INCIDENT-REGISTER.md` | K5 evidence; SOC 2 CC7.4 / ISO 27001 5.24 | The register row |
| ☐ | **Watch the report-only CSP** for a week (browser console on the live site), then ask for it to be enforced | Threat model F1 | List of violations seen |
| ☐ | **Decide owner MFA** (second sign-in step) — a build round, needed before any ATO lodging (DSP framework) | ISO 27001 A.8.5; ATO DSP OSF ◐ | The decision + round name |
| ☐ | **Confirm open legal questions** 1–7 of CO0 §7 with a lawyer (intermediary status, UAE Executive Regulation, AU coverage) | — | Written advice |
