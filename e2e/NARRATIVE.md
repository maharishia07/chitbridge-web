# The e2e suite, as a story — what each test proves and why it matters

*Read this alongside the run. When the suite executes (Saturday), each test produces a **trace** — a screen-by-screen
filmstrip. This doc is the narration for that filmstrip: what you're watching, what it proves, and where it sits in the
whole.*

---

## The global scale — what the whole suite is for

The product was built **area by area, and never independently verified** — the honest risk was "it works as a concept but
isn't gated and flowed." This suite is that verification: **a real browser, driven like a human, clicking through the actual
screens** — so a *backend-green / frontend-broken* mismatch cannot hide.

The **north star** it ladders toward: *a person can walk, screen by screen, a **verified → gated → minted** path for two
different entities, each landing in a working app.* That is "I can see what I have." Every test below is one rung of that
ladder — or one room of the house it lives in.

The spine everything hangs off is **the chit** — one shared, signed record between two parties. Almost every test ends by
putting something *onto the rail* (a chit) or operating on it. So the story is: **be born (mint) → set up your world
(catalogue, suppliers, co-assists) → transact (chit, storefront, capture) → be helped (assistant) — all governed, all
verifiable.**

---

## The tests, one by one

### 0 · `redproof` — *"prove the suite can fail before you trust a single green."*
- **What it is:** a test that is GREEN normally and RED when run with `CB_REDPROOF=1` (it then looks for a deliberately
  broken locator).
- **What we're achieving:** trust in the instrument itself. A test that *can't* fail proves nothing — so before counting
  any module "done", we show the suite genuinely catches a broken screen.
- **Global fit:** the foundation. It's why every green below is meaningful.

### 1 · `onboarding` — *"a business is born through the real front door."*
- **What it is:** the mint flow, screen by screen — Welcome → pick a role + vertical → Register (name, email) → verify with
  an OTP → land in the app.
- **What we're achieving:** proof that a human can actually *create an entity* by clicking, not by running a script. This
  is the entrance to everything.
- **Global fit:** the first half of the north star — the "**minted**" step. (The "verified → gated" steps slot in here as
  Q3's gate lands; the spec is written to grow into them.)

### 2 · `flow` — *"two different businesses, same engine — 'sell tea, therefore sell anything'."*
- **What it is:** mint **two distinct entities** back to back.
- **What we're achieving:** the headline demonstration — the *same generic engine* mints two different businesses, each
  landing in a working app. It's the Definition of Done for the 2-day window.
- **Global fit:** the whole north star in one test. Everything else supports this.

### 3 · `smoke` — *"every room in the house has working lights."*
- **What it is:** after minting, click into **every menu item** (task, order, folders, network, suppliers, customers,
  catalogue, trade-ready, co-assists, MIS, disputes, profile, settings, assistant) and **every toolbar icon**, asserting
  each renders.
- **What we're achieving:** breadth — nothing in the panel is silently broken. This is the "we've *seen* each part works"
  pass you asked for.
- **Global fit:** the safety net under all the deep tests. If a screen won't even load, its module test can't be trusted.

### 4 · `chits` — *"the core act: create a signed record, watch it travel, advance its state."*
- **What it is:** Compose a self-chit (add yourself, a subject, a line item) → **Send** → it appears in **Order** (sent);
  then open the received copy in **Task** and **advance its status**.
- **What we're achieving:** the heart of the product — Create, Read, Update on a real chit. A self-chit is a real chit: one
  copy sent, one received, same thread.
- **Global fit:** this is the **rail** itself working. Every other transaction (storefront, capture, supplier order) ends
  up as one of these.

### 5 · `catalogue` — *"what you sell — created, read, changed, removed."*
- **What it is:** **full CRUD** on a product — add it → see it in view → edit the price → delete it (accepting the confirm).
- **What we're achieving:** the worked example that *every* CRUD operation actually persists, not just Create. The same
  pattern proves out suppliers, chits, co-assists.
- **Global fit:** your catalogue is the source of line items for chits and the storefront — so this feeds the rail.

### 6 · `suppliers` — *"who you buy from — added across a real trust boundary."*
- **What it is:** mint entity A, mint entity B, then **B adds A** as a supplier by A's email → edit → remove.
- **What we're achieving:** CRUD that spans **two entities** — proving the relationship is real and cross-boundary, not a
  local note. (This is the first test that needs *two* real identities.)
- **Global fit:** suppliers are where "Compose an order to them" begins — the buy side of the rail.

### 7 · `coassists` — *"who — and what — acts for you: people, IoT, ERP, AI."*
- **What it is:** open the "new co-assist" wizard and prove **every type path is reachable** — Human, IoT device, ERP/API,
  AI agent — then create a human (an invite is issued).
- **What we're achieving:** the answer to "does it cover IoT and ERP?" — yes, each is a real type in one wizard. A person,
  a Raspberry Pi, an SAP system, and an AI agent are all *co-assists* on the same rail.
- **Global fit:** this is the "workforce" of an entity — the actors whose every action becomes a chit you can see and
  dispute. (Driving a *live* IoT/ERP device is the deeper `connector` test.)

### 8 · `capture` — *"meet businesses where they already are: WhatsApp / email → a chit."*
- **What it is:** open the Intake surface → log in → **simulate an inbound WhatsApp message** → it lands in the inbox as a
  capture (then AI structures it and you confirm → chit).
- **What we're achieving:** proof of the **inbound front door**. A customer's WhatsApp order becomes a draft chit without
  them ever logging in — the "coherence, not rip-and-replace" play.
- **Global fit:** the alternative entrance to the rail (vs. Compose). Same destination — a governed chit — different door.
  *Real* WhatsApp/email transport needs a provider wired; the pipeline itself is what this proves.

### 9 · `storefront` — *"your customer orders, and a signed record comes back to you."*
- **What it is:** open a public shop → pick a finish → order (qty, contact) → OTP → **Place order**.
- **What we're achieving:** the customer-facing side end to end — an order placed by a stranger becomes a **two-copy chit**
  (customer ↔ shop), server-repriced and governed.
- **Global fit:** the sell side of the rail, from outside the system in. Closes the loop: catalogue → storefront → chit.

### 10 · `helpdesk` — *"ask, and be answered — honestly."*
- **What it is:** open the assistant → ask a question → a deterministic library answer appears.
- **What we're achieving:** the help layer works without over-promising (the real LLM is a stub; the honest library floor
  answers). The KB publish→serve-live half is a skeleton (needs a helpdesk-type entity).
- **Global fit:** the support surface that rides on every screen — and the first *productised* vertical.

### 11 · `connector` — *"the deep IoT/ERP operations: a device pings, a system sends, a receipt is kept."*
- **What it is (skeleton):** under a created IoT gateway / ERP system — add a device, **ping** it live, run an **ERP-test**
  (a receipt appears), delete it.
- **What we're achieving:** the *operational* proof of IoT/ERP (beyond the wizard). It's a skeleton because it needs a
  connector-capability entity + a real gateway first — setup, not code.
- **Global fit:** the deepest rung — machines and systems acting on the rail, process-then-forget, receipt-kept.

---

## What "all green" means

When every runnable test is green (with the trace to watch), you've proven — **screen by screen, as a human would** — that
a business can be **minted**, **set up** (catalogue, suppliers, co-assists incl. IoT/ERP/AI), **transact** (chits,
storefront, capture from WhatsApp/email), and **be helped** — all on the governed rail, all verifiable. Two entities do it
side by side. That is the north star made visible: **"I can see what I have."**

The two remaining skeletons (live IoT/ERP device ops; helpdesk KB publish) are *setup*-gated, not *code*-gated — they light
up the moment a connector-enabled entity and a helpdesk entity exist.
