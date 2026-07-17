# e2e Coverage — every capability & subfunction: covered or not

*The systematic map. Legend: ✅ a spec exercises it · ◐ tagged/skeleton (needs setup or is key-gated) · ☐ not covered
(the screen LOADS via `smoke`, but the operation isn't driven). Goal: turn every ☐ into ✅.*
*Note: `smoke` proves EVERY menu screen renders — so "☐" below means the *operation* isn't tested, not that the screen is broken.*

---

## Covered end-to-end ✅
| Capability | Subfunctions | Spec |
|---|---|---|
| **Onboarding / mint** | register · verify(OTP) · pick vertical · land in app | onboarding, flow(×2) |
| **Catalogue / products** | **create · read · update · delete** (full CRUD) | catalogue |
| **Suppliers** | add · edit · remove (cross-entity) | suppliers |
| **Chits** | compose · **send** · read(open) · advance status · mark-unread | chits |
| **Disputes (USP)** | raise · resolve · **targeted (A&B, C excluded) · per-party resolve** (3-entity, live) | disputes |
| **Messages** | internal note · external message (channel toggle) | messages |
| **Co-assists** | create(human) · reach every type (human/IoT/ERP/AI) | coassists |
| **Capture (WhatsApp/email)** | simulate inbound → inbox | capture |
| **Storefront (public)** | browse · order-start(OTP) · login-verify · order-confirm | storefront |
| **Helpdesk / assistant** | open · ask → deterministic answer | helpdesk |
| **All screens load** | every menu item + toolbar icon renders | smoke |
| **(the instrument)** | RED-proof — a test can fail on a break | redproof |

## Partial / skeleton ◐ (needs setup or a key)
| Capability | Subfunction | Why ◐ | Where |
|---|---|---|---|
| Disputes (USP) | private **room** message (A↔B only) | one more assertion on the 3-entity test | disputes (room step) |
| Messages | **internal-stays-internal privacy** | needs 2 entities (A→B) | messages (skeleton) |
| Capture | AI structure → create chit | needs `ANTHROPIC_API_KEY` | capture (skeleton) |
| Helpdesk | KB publish → serve live | needs a helpdesk-type entity | helpdesk (skeleton) |
| Connectors (IoT/ERP) | add-device · **ping · erp-test** · regen · delete | needs a connector-capability entity + a gateway | connector (skeleton) |
| Chits | void | backend pending (todo) | tagged `chit-void` |

## NOT covered ☐ — the gaps to fill (screen loads; operation not driven)
| Capability | Subfunctions to cover | Notes |
|---|---|---|
| **Chits — lifecycle** | priority · star · archive · unarchive · trash/delete · restore · purge · assign-bulk · attachments | mostly untagged; delete = bulk-select/trash flow |
| **Co-assists — manage** | assign / unassign a chit · break/on-shift · deactivate/reactivate · edit · leave-cover delegate · reset PIN · regenerate invite | roster row + edit not tagged |
| **Network / Connections** | request · accept/reject · register node · claim · connect edge · approve/decline · suspend/resume/disconnect | whole screen untested (loads only) |
| **Folders** | create · rename · delete · move-chit-into | untested |
| **Trade-ready / readiness** | gather a clearance · verify (KYB) · lanes · supplier passport / confidence | untested; verify needs a KYB provider |
| **Customers / CRM** | list / read · segment | read-only screen; untested |
| **Profile / Settings / Vault** | save profile · save settings · **save vault** (identity/reg/banking) | untested (vault has offline-draft only) |
| **MIS** | read the metrics rollup | read-only; untested |
| **Auth (secondary)** | actor PIN login · set-PIN · change-PIN | only entity OTP tested |
| **Governance layers** | 7-layer view / boilerplate adopt | backend-only today (UI is a stub) — out of e2e scope until wired |

---

## Priority to close the ☐ (recommended order)
1. **Disputes USP (3-entity)** + **Messages privacy (2-entity)** — the differentiators; make the skeletons real (needs a multi-entity fixture that captures each entity's login).
2. **Chit lifecycle** — priority/star/archive/trash/restore/assign (tag the row actions + bulk bar; high-frequency ops).
3. **Co-assist management** — assign/edit/deactivate (the roster side, beyond create).
4. **Network / Connections** — request→accept (the "connect with another business" core).
5. **Folders**, **Readiness**, **Profile/Settings/Vault** — CRUD on each (testids partly exist for vault).
6. **Connector cockpit** + **Helpdesk KB** — once a connector-enabled + a helpdesk entity exist.

## Multi-entity fixture (the one enabler most gaps need)
Several gaps (dispute USP, message privacy, connections, cross-entity chits) need **more than one signed-in entity in a
test**. The enabler: extend `mintEntity()` to also capture each entity's **bridge/User ID**, and add a helper to switch
sessions (or run parallel browser contexts). Build that once → it unblocks the USP proofs and the connection flows.
