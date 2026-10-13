# Owner actions — compliance acts no code can do

Each row is an ORGANISATIONAL act: a person must do it, and nothing in the product shows it as done until then. The product side of each
row is named so you can see what is waiting on you. Source: `docs/research/COMPLIANCE-OBLIGATIONS-2026-10.md` (CO0). Rounds CO2 and CO3
add their own sections below this one.

## CO1 · privacy (13 Oct 2026)

| # | Do this | Why (law) | Owed | What the product does once it is done | Done (date · who) |
|---|---|---|---|---|---|
| O1 | **Run migrations `b306_party_contact_pref.sql` and `b307_privacy_request.sql`** (chitbridge-api/migrations, Supabase SQL editor, as postgres), then the check query at the foot of each | — | now | Consent rows and the request register switch on; until then those routes answer "not migrated yet" (503) | |
| O2 | **Publish a privacy policy / notice** (India SPDI r.4; Australia APP 1 + an AU section naming India as where data sits; UAE PDPL). Have a lawyer read it. Give it a version, e.g. `2026-11-01`, and set env `PRIVACY_NOTICE_VERSION` on Railway | SPDI Rules 2011 r.4 · DPDP s.5 · APP 1, 5, 8 · PDPL Art.4 | **today** (SPDI) | Every consent row records the notice version; `GET /api/privacy/facts` says it is in force | |
| O3 | **Name a grievance / privacy officer** with an e-mail and phone; set env `PRIVACY_CONTACT` (e.g. `Name · privacy@… · +91…`) | SPDI r.5(9) (one month) · IT Intermediary Rules r.3(2) · DPDP s.8(9) | **today** (SPDI) | The facts answer shows it; requests are logged in the register with their due date | |
| O4 | **Ask a lawyer the open questions**: is ChitBridge an intermediary (IN-12)? may we hold an encrypted full Aadhaar (IN-16)? UAE Executive Regulation status and India's adequacy for UAE transfers (AE-4, AE-8)? DIFC / ADGM shops? AU small-business opt-in (s.6EA)? | CO0 §7 open questions | before May 2027 | The register's clocks change if the answers do (`lib/privacy.js` `DUE_DAYS`) | |
| O5 | **Sign data-processing agreements** with Supabase, Railway, Vercel, Resend, Meta, Anthropic, OpenAI (as each is used); keep the signed copies | DPDP s.8(2) · APP 8.1 / s.16C · PDPL Art.8, 22–23 | before selling outside India | The Standards row "who holds your data" moves to In force | |
| O6 | **Write a DPA template for shops** (shop = controller, ChitBridge = processor), with transfer clauses for AU and UAE shops | DPDP s.8(2) · APP 8 · PDPL Art.23 | before the first AU / UAE shop | — | |
| O7 | **Sign off the RoPA and DPIA drafts** (`docs/compliance/ROPA.md`, `DPIA.md`) — read, correct, date | PDPL Art.7, 21 · ISO/IEC 27701 | before the first UAE shop | The Standards row moves to In force | |
| O8 | **Tick the ◐ citations** in CO0 §2–4: open each official link once and confirm the rule says what the row says | — | before any privacy row says In force | Rows can move to In force | |
| O9 | **Region facts not in the repo**: confirm the Railway region (env `RAILWAY_REGION` — also on `/health`) and the Vercel region; tell the build so `lib/privacy.js` `FACTS` can state them | APP 8 · PDPL Art.22 | soon | The facts answer stops saying "not stated" | |

**Not built in CO1, waiting on a screen** (the API is there): a party's consent block in the CRM record, the privacy-request register
screen, and a live call to `/api/privacy/facts` from the Standards page. The round-trip budget marks these routes `awaiting_client`
since 13 Oct — the api test fails on 27 Oct if no screen calls them by then. Also not built: the per-person export file (today the CRM
record + timeline routes ARE the access summary) and erase-a-person (large; dry-run first, like b171).
