# Illustration pack (concept)

A set of standalone SVG illustrations for Chit & Bridge — **one file per subject**.
Each subject maps to a single screen or domain event. Changing a screen's art means
editing **only that one `.svg`**; nothing else in the app moves. That's the whole point
of doing it subject-by-subject.

## Review
Open `/illustrations/` in the running web app (it serves `index.html`, a gallery driven
by `manifest.json`). Concept only — **nothing is wired into the app yet.**

## Subjects
| File | Subject | Maps to |
|---|---|---|
| `status-update.svg`  | Status update    | Status tab header · state-change confirmation |
| `message-update.svg` | Message update   | Messages tab · internal vs external |
| `dispute-flag.svg`   | Dispute flag     | Dispute raised · disputes queue |
| `attachment.svg`     | Attachment       | Attachments section · empty attachments |
| `chit-bridged.svg`   | Chit bridged     | Onboarding · send-success (two co-held copies) |
| `compose-author.svg` | Compose / author | Compose empty · compose help |
| `draft.svg`          | Draft            | Drafts folder (empty) |
| `archive-sunset.svg` | Archive (sunset) | Archive folder · sunset model |
| `priority-sla.svg`   | Priority / SLA   | Priority badge · delivery / SLA-ISL |
| `forward.svg`        | Forward          | Forward confirmation (new thread) |
| `empty-inbox.svg`    | Empty list       | Any list with no rows yet |
| `no-results.svg`     | No results       | Search / advanced-filter empty |

## Shared visual language
- viewBox `0 0 480 320`, flat, line+fill.
- Recurring motifs: the **chit card**, the **bridge**, the **edge** (dashed).
- Palette is in `manifest.json` (`style.palette`) — blue `#3F66A6`, gold `#C08A2E`,
  green `#3E8A5F`, red `#C2473F`, panel `#F7F4EE`.

## Adding / changing a subject
1. Add or edit one `*.svg` (keep the viewBox and palette).
2. Add/adjust its row in `manifest.json` (`file`, `title`, `where`).
The gallery picks it up automatically — no other file changes.
