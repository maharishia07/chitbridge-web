# Owner actions — compliance acts no code can do

Each row is an organisational act: done only when the owner does it and records the date + evidence here. Never ticked by a build round.
Source: `docs/research/COMPLIANCE-OBLIGATIONS-2026-10.md`. Rounds add their own section; do not reorder others'.

## CO3 · record-keeping (2026-10-13)
| ☐ | Act | Why (law) | Evidence to keep |
|---|---|---|---|
| ☐ | Run `chitbridge-api/migrations/b305_records_floor.sql` (Supabase SQL editor, as postgres); paste P1–P4 output here | Companies Act s.128(5) · CGST s.36 · r.3(1) audit trail | P1 = 0 · P2 '9 years' · P3 5 rows `O` · P4 0 rows |
| ☐ | Confirm in the Supabase dashboard: plan, **daily backup on**, backup region = ap-south-1, PITR on/off, backup retention days | Companies (Accounts) Rules r.3(5): daily backup on servers in India | Screenshot of Database › Backups, dated |
| ☐ | Do one restore drill (restore a backup to a scratch project; count `journal_entry` rows against live) and log the date | r.3(5) / ISO 27001 A.8.13 | Drill date · rows matched |
| ☐ | Record the Railway (api) region and its log retention | r.3(5)–(6) facts; CERT-In 180-day logs (CO2) | Railway settings screenshot |
| ☐ | Approve (or not) a Settings sheet "for your ROC filing" (provider name · IP/cloud address · server location); until then the facts live in api `docs/compliance/RECORD-KEEPING.md` §3 | r.3(6): companies file these every year | Athi's yes/no |
| ☐ | A lawyer/CA ticks the ◐ citations used by the four CO3 Standards rows (IN s.128(5)/s.36, r.3(5)–(6), AU s.382-5/s.286, AE TPL/CT Art.56) | the CO0 doc §0: ◐ needs one human check | Name + date per row |
| ☐ | Queue the engines change: `reg-in` `retentionYears: 8`; `reg-au` / `reg-ae` note 7 years for companies / corporate tax | per-country precision of the floor | the engines round that ships it |
