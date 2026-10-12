# CA1b · the PR #143 report (the runner's token cannot edit or comment on the PR — the coordinator posts this as the PR body)

CA1 wrote the practice door from the Xero HQ / QBOA / MYOB baseline; **CA1b reworks it on our construct** (owner, 2026-10-13: better, not copied). Docs only, same branch: REQUIREMENT.md gains §0 (what was theirs and was removed · each CA job rebuilt on ours · the incumbents' complaints removed by design); FLOW.md + the C2V rows in flows.json (steps request · grant · ask · end; process-map passes); mock.html (Clients · Replies · People · Practice; checked in Chromium at 390 and 1366: no sideways scroll, head ≤ 20 % / 30 %, notices fold on a phone); CA2-BUILD.md re-split. Guards pass.

**The 5 biggest "better because":**
1. **Better than Xero HQ Client insights** because the row says which month is **sealed** (locked · pack hash-chained · client acknowledged) and what the **nightly recompute** named, dated on the row — not cached ratios refreshed hourly.
2. **Better than QBOA Ask client / Xero Ask** because a question is a **message on the chit** the client already holds; the thread's turn says who owes a reply — no request object, no due date to vanish, no history to lose (`msg_type = 'query'` already exists; CA1's `due` / `answered_at` keys are dropped).
3. **Better than all three** because an editor can ask the client's **supplier** from the client's seat (the external thread on the same chit) — and most "what was this?" questions never start, since the bill arrived as a chit with its lines frozen.
4. **Better than MYOB Practice** because the BAS figures name the three acknowledged packs they rest on — the sign-off trail is the record, printable by construction; and a read-only person sees every refused button greyed WITH the server's sentence and *Ask the client* beside it.
5. **Better than QBO / Xero invites** because the grant moves by the rail's own verbs (send · accept · reject · end): four states, no 14-day expiry, one button ends every session within 60 s, every client with a Ledger appears, every open is listed to the client by name.

**Owner questions before CA2 (rephrased):**
1. The anchor for a MONTH's question (no chit): the month's **pack** as a message subject beside `chit_id` (recommended — the question and the acknowledgement sit on one record), or CA1's minted review chit?
2. The dashboard reads the nightly recompute, dated on every row, with *Check now* per row as a recompute (one trip) — accepted that figures are nightly, the rail live?
3. Bank: the client's device posts **counts of statement lines with no chit** (never the lines) → allow the counts-only post, or no Bank column?

⚠️ CA2's migration takes the next free number (b299 is M210's).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
