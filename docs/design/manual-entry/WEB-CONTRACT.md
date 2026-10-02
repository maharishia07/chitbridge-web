# ＋ Entry — what the page asks of the API (web side, `public/app/cap-entry.js`)

The page holds no rules and computes no money. The stand-in in `e2e/manual-entry.cjs` is the executable form of this file; the API
(chitbridge-api `cloud/manual-entry-api`) must answer in these shapes, or this page and that branch each get one small adapter.
**Assumed — not read from the API repo (out of scope for this task). Check against the real routes before merging.**

| Call | Page sends | Page reads |
|---|---|---|
| `GET /api/books/events` | – | `events[]`: `id`, `group`, `icon`, `label`, `narration` (prefill), `kind` (`'journal'` for the free journal), `route {m,p}` (where Save posts), `fields[]` — each `{key, kind, label?, step?, side?, options?, required?}`; kinds: `party · ledger · bank · asset_class · loan · amount · date · paid_by · doc_no · photo · narration · lines · text · choice`. 403 → "not allowed" card. |
| `POST /api/books/preview` | `{event, <field keys>…, amount_minor, date, narration, lines?[{code, side:'dr'\|'cr', amount_minor}]}`; for the date check only `{event, date, check:'date'}` | `{currency, voucher{series:'MJ', kind}, narration, lines[{code,name,dr_minor,cr_minor,type:'personal\|real\|nominal',rule,rate?,party_name?}], balanced:true\|false, refusals[{code,message,fix{label,step,focus}}], warnings[…same]}`. With `check:'date'` only `refusals` is read (`PERIOD_LOCKED`). |
| `POST <event.route.p>` (default `POST /api/books/entries`) | the preview body + `client_ref` (one per sheet, reused on retry) + `attachment{name,type,data}` (data-URL, optional) | `{entry_id, entry_no}` |
| `POST /api/books/entries/:id/reverse` | `{client_ref}` | `{entry_no}` of the mirror |
| `GET /api/books/daybook` rows | – | existing; a row offers Reverse when it has `entry_id` and neither `reversed_by` nor `reversal_of` |

Save is enabled only when `balanced === true` and `refusals` is empty. Parties come from the existing `/dues` read (`BK.dues`), ledgers
from `/accounts` (grouped by the Ledgers view's own `bkLtModel`), banks from its "Cash & bank" group unless the event lists `options`.
