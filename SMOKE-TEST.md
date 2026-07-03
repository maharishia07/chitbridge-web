# Chit & Bridge — Smoke Test Checklist

Goal: confirm **every screen loads and every icon/button is usable** (renders + responds, no console error).
Deep functionality comes after. Run through this on return; tick PASS/FAIL and note anything odd.

## 0. Deploy note (do this first)
The frontend is now **multi-file**. All of these must ship together (they're loaded by `/app.html`):
- `public/app/core.js`  (existing)
- `public/app/helpers.js`  ← **new**
- `public/app/cap-admin.js`  ← **new** (lazy-loaded on demand)

If `app.html` deploys without the two new files, MIS/Profile/Settings will show "Loading…" forever and helpers (money/escaping) break. Ship the whole `public/app/` folder.

## 1. Capability-loading smoke test (the modularisation itself)
- [ ] Open **MIS** → shows "Loading…" for a beat → stat grid renders. (Network tab: `cap-admin.js` fetched once.)
- [ ] Open **Profile** → loads (now also from `cap-admin`). Fields populate.
- [ ] Open **Settings** → loads; governance 7-layer block + auto-assign card render.
- [ ] Re-open MIS/Profile/Settings → **instant**, `cap-admin.js` NOT re-fetched.
- [ ] Open **Task / Order** (Core) → render immediately, no "Loading…" flash, no regression.
- [ ] Hard-refresh on MIS (deep link) → still resolves (loader fires on boot).

## 2. Per-screen icon check
### Top bar (every screen)
- [ ] ☰ hamburger (mobile) toggles menu · [ ] ⓘ about opens help · [ ] 💬 messages opens · [ ] 🔔 notifications opens · [ ] status control · [ ] sign-out

### Task (received) — the heavy toolbar
- [ ] List rows render with flags/priority/accents · [ ] row click opens detail
- [ ] State tabs (Open / Act / Close) show `nn/mmmm` counts · [ ] tick/select mode toggles, checkboxes visible
- [ ] 🔍 search · [ ] ▾ advanced filter opens · [ ] ⚠ dispute chip (if any open) filters
- [ ] Toolbar: status-move · assign · **dispute ⚑** (single chit → party checklist) · archive/delete (per deletion policy) · legend/key
- [ ] Advance status → cursor moves to next (email-style) · [ ] voice/aria announce fires
- [ ] Unassigned/Assigned pool toggle

### Order (sent)
- [ ] List renders · [ ] detail opens · [ ] same toolbar behaves · [ ] no assign (sent side) as expected

### Drafts / Trash / Archive
- [ ] Drafts list · open · edit/send · delete→trash
- [ ] Trash: only **permanent-delete** + **restore** + select tick visible · restore works · purge works
- [ ] Archive: unarchive works · sent/received can't be hard-deleted (policy)

### Disputes
- [ ] Screen loads (raised-by-you / against-you) · [ ] Resolve opens note modal · [ ] resolve works

### Suppliers
- [ ] List (preferred first) · [ ] add by name (autocomplete) / User ID / email · [ ] select → detail
- [ ] mark preferable · [ ] nickname/notes edit+save · [ ] remove · [ ] "compose their chit" opens compose (supplier-locked)

### Catalogue
- [ ] Product list + search · [ ] select → detail (view/edit) · [ ] + New product · [ ] save persists · [ ] delete

### Co-assists
- [ ] Roster list (active/inactive filter) · [ ] select → detail · [ ] + New (invite modal, hat picker)
- [ ] shift toggle · re-invite (OTP) · reset PIN · edit (hat + leave-cover delegate) save · status actions

### Network
- [ ] Loads (or "not in model" register CTA) · [ ] model showcase buttons (demo) · [ ] create branch flow · [ ] connect/approve/decline/suspend/resume/disconnect buttons render

### MIS / Profile / Settings
- [ ] (covered in §1) numbers render · profile save · settings save · auto-assign save · delegate save

### Compose (from + New / nav / supplier / forward)
- [ ] Opens wide modal · [ ] recipient autocomplete · [ ] To/CC/For roles · [ ] line items from catalogue · [ ] attachments · [ ] tabs (items/attach/delivery/summary) · [ ] draggable divider · [ ] save draft · [ ] send · [ ] minimise/resume pill

## 3. If something fails
Note the screen + icon + console error. Most likely causes after this change:
- "Loading…" stuck → the cap file didn't deploy (see §0).
- A button does nothing / ReferenceError → a function that should be eager got moved, or vice-versa. Tell me the function name; it's a one-line CAP_OF / placement fix.

---
Status of the work behind this test is in the final chat summary + memory (`project-capability-modularisation`, `project-grounding-standing`).
