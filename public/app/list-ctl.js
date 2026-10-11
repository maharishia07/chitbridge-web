/**
 * ── ⭐⭐⭐ CBList — THE LIST CONTROL, AS A SELF-SUSTAINING UNIT ───────────────────────────────────────────────────────
 *
 * Athi, 2026-10-02: *"can we keep it as a control so it can be used anywhere … with its own ui/ux and as a self
 * sustaining unit"* · *"whenever such type of control established anywhere, it is a must that column adjustable should
 * be there, and also, the scrolling should be allowed only below the column header … create a control in place so i
 * don't need to repeat."*   docs/design/list-control/PLAN.md is the contract; docs/design/list-standard/index.html is the
 * FROZEN look (the pass mark); public/list-lab.html is this file on a bare page.
 *
 * ONE FILE, ONE GLOBAL: `window.CBList`. Nothing else is exported and NOTHING IS READ FROM THE PAGE: not its escaping, its
 * translator, its toast, its storage prefix, its stylesheet. A page that lacks every global it used to supply still gets a
 * working list (e2e/list-unit.cjs); a page that makes this file reach for one fails e2e/list-unit-breaks.cjs.
 *
 *   CBList.mount(el, { key, rows, columns, view, group, filters, sorts, search, next, actions, bulk, onOpen,
 *                      head:{ title, period, notices, slot(el) }, t, store, ... }) → { refresh, destroy }
 *
 * THE AVATAR SLOT: `head.slot(el)` is called with an empty span at the END of the title row (pushed to the far edge) every time the
 * title row is drawn — a page with no chrome of its own mounts CBAvatar there, and the head stays three rows. The unit draws the span
 * and reads nothing from the page: what goes in it is the page's business.
 *
 * WHAT A PAGE DECLARES: its columns (key · label · prio · w · num · sort · cell(row)), its grouping, filters, sorts, notices,
 * period, what a row opens to (`next`), row actions and bulk operations. WHAT THE UNIT OWNS, FOR EVERY LIST, AND NO LIST
 * CAN OPT OUT OF: the three-row head, ADJUSTABLE COLUMNS (drag, touch, ← → in 8 px, double-click resets, never narrower than
 * the label, remembered), ONLY THE ROWS SCROLL (the head is fixed, the rows fill the rest of the window, the column header
 * is sticky inside the one scroller), the ⚙ chooser (Shown / Available / Reset), ▤ grid / ☰ lines, ⇣ / ⇡ expand all (when
 * the list has a next level), phone cards (a container query, not the page width), lazy rows (50 at a time, the count is the
 * true one), the four states (loading under a kept header · empty · no match + Clear · could not load + Try again),
 * keyboard (↑ ↓ Enter · Esc · ← → on a column edge) and ARIA.
 *
 * ESCAPING IS ITS OWN JOB: every value painted here goes through this file's `esc`. A column renders trusted markup only if it
 * says so (`html: true`), and `next(row)` is trusted markup by contract: the page that builds it escapes its own data.
 *
 * SERVER-PAGED LISTS (Platform): pass `remote:{ total, onQuery(q), foot() }`. The unit then neither filters nor sorts: it draws
 * the page it was given in its own look, asks the page's pager for the next one through `onQuery`, and paints `foot()` below.
 */
(function (root) {
  'use strict';
  if (root.CBList) return;

  /* ── its own words: every string is written here in English and goes through the host's translator (opts.t) when one is given (see T) ── */
  /* ── its own escaping ── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function plain(h) { return String(h == null ? '' : h).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim(); }

  /* ── its own memory: browser storage under its own prefix, an in-memory fallback when storage throws ── */
  var MEM = {};
  function lsGet(k) { try { var v = root.localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch (_) { return MEM[k] === undefined ? null : MEM[k]; } }
  function lsSet(k, v) { MEM[k] = v; try { root.localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }

  /* ── the look: injected ONCE (#cblist_css), design tokens only, a fallback for every one, so a bare page renders right ── */
  var CSS = [
    '.cbl{--cl-page:var(--page,var(--paper,#FCFAF5));--cl-card:var(--card,#FFFFFF);--cl-panel:var(--panel,#F3EFE6);--cl-line:var(--line,#DDD6C6);--cl-soft:var(--line-soft,#E6E0D2);--cl-hair:var(--hair,#F0ECE2);',
    '--cl-ink:var(--ink,#1D1B16);--cl-muted:var(--muted,#5E594D);--cl-faint:var(--faint,#8A8374);--cl-ghost:var(--ghost,#A8A295);',
    '--cl-gband:color-mix(in srgb,var(--cl-blue) 13%,var(--cl-page));--cl-zebra:var(--zebra,color-mix(in srgb,var(--cl-ink) 9%,var(--cl-card)));--cl-hov:color-mix(in srgb,var(--cl-blue) 8%,var(--cl-card));',
    '--cl-green:var(--green,#16693F);--cl-amber-t:var(--amber-t,#FDF3DC);--cl-amber-b:var(--amber-b,#EFD39A);--cl-amber-i:var(--amber-i,#7A5205);',
    '--cl-red-t:var(--red-t,#FBEAE3);--cl-red-b:var(--red-b,#E7B9A8);--cl-red-i:var(--red-i,#8E3517);',
    '--cl-blue:var(--blue,#2F74C9);--cl-blue-t:var(--blue-t,#E4EEFA);--cl-blue-b:var(--blue-b,#B9D2EF);--cl-blue-i:var(--blue-i,#174A87);',
    '--cl-shadow:var(--shadow,0 10px 28px rgba(29,27,22,.16));--cl-ui:var(--f-ui,"IBM Plex Sans","Segoe UI",system-ui,sans-serif);--cl-display:var(--f-display,"Bricolage Grotesque","Segoe UI",system-ui,sans-serif);--cl-num:var(--f-num,"IBM Plex Mono",ui-monospace,"Cascadia Mono",monospace);',
    'display:flex;flex-direction:column;min-width:0;min-height:0;box-sizing:border-box;position:relative;background:var(--cl-page);color:var(--cl-ink);font:calc(15px * var(--k,1))/1.45 var(--cl-ui);container-type:inline-size;container-name:screen;text-align:start;letter-spacing:normal;text-transform:none}',
    '.cbl *,.cbl *::before,.cbl *::after{box-sizing:border-box}',
    '.cbl button,.cbl select,.cbl input{font:inherit;color:inherit}.cbl button{cursor:pointer;min-height:0;line-height:1.3}',
    '.cbl :focus-visible{outline:2px solid var(--cl-blue);outline-offset:2px}',
    '.cbl .cbl-num{font-family:var(--cl-num);font-variant-numeric:tabular-nums}',
    /* row 1 · the title row */
    '.cbl .cbl-title{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;padding:8px 20px 6px;border-bottom:1px solid var(--cl-soft);background:var(--cl-page)}',
    '.cbl .cbl-title h1{font:800 calc(24px * var(--k,1))/1.1 var(--cl-display);margin:0;letter-spacing:-.01em;text-wrap:balance;color:var(--cl-ink)}',
    '.cbl .cbl-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--cl-line);background:var(--cl-card);border-radius:999px;padding:3px 10px;margin:0;font-size:calc(13.5px * var(--k,1));white-space:nowrap}',
    '.cbl .cbl-title .cbl-chip{white-space:normal;max-width:100%;min-width:0;text-align:start;border-radius:14px;line-height:1.3}',
    '.cbl .cbl-chip.period{font-family:var(--cl-num);font-size:calc(13px * var(--k,1))}',
    '.cbl .cbl-chip.warn{background:var(--cl-amber-t);border-color:var(--cl-amber-b);color:var(--cl-amber-i);font-weight:600}',
    '.cbl .cbl-chip.bad{background:var(--cl-red-t);border-color:var(--cl-red-b);color:var(--cl-red-i);font-weight:600}',
    '.cbl .cbl-chip.warn::before,.cbl .cbl-chip.bad::before{content:"⚠"}',
    '.cbl button.cbl-chip.warn::after,.cbl button.cbl-chip.bad::after{content:"›";opacity:.7}',
    /* row 2 · tools */
    '.cbl .cbl-tools{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px;padding:6px 20px 8px;background:var(--cl-page)}',
    '.cbl .cbl-search{flex:1 1 200px;min-width:0;display:flex;align-items:center;gap:6px;border:1px solid var(--cl-line);background:var(--cl-card);border-radius:9px;padding:0 10px;height:34px}',
    '.cbl .cbl-search input{border:0;outline:0;background:none;flex:1;min-width:0;font-size:calc(14px * var(--k,1));padding:0;margin:0;height:auto;box-shadow:none}',
    '.cbl .cbl-search:focus-within{border-color:var(--cl-blue)}',
    '.cbl .cbl-tbtn{height:34px;display:inline-flex;align-items:center;gap:5px;border:1px solid var(--cl-line);background:var(--cl-card);border-radius:9px;padding:0 10px;font-size:calc(13.5px * var(--k,1));white-space:nowrap;margin:0}',
    '.cbl .cbl-tbtn[aria-pressed="true"],.cbl .cbl-tbtn.on{border-color:var(--cl-blue-b);background:var(--cl-blue-t);color:var(--cl-blue-i);font-weight:600}',
    '.cbl .cbl-tbtn .badge{background:var(--cl-blue);color:var(--cl-card);border-radius:999px;font-size:calc(11px * var(--k,1));padding:0 6px;font-weight:700}',
    '.cbl .cbl-glab{font-size:calc(12px * var(--k,1));color:var(--cl-muted);white-space:nowrap;margin-inline-end:-2px}',
    '@media (max-width:1100px){.cbl .cbl-tools{gap:5px 6px;padding-inline:12px}.cbl .cbl-seg button{padding:0 6px}.cbl .cbl-count{padding:0 2px}.cbl .cbl-search{flex-basis:170px}}',
    /* GROUP as one labelled dropdown ("Group ▾ None"): opts.group.as = 'select' */
    '.cbl .cbl-gsel{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--cl-line);background:var(--cl-card);border-radius:9px;height:34px;padding:0 6px 0 10px;margin:0}',
    '.cbl .cbl-gsel .cbl-glab{margin:0;font-weight:600}',
    '.cbl .cbl-gsel select{border:0;background:none;height:30px;padding:0 2px;font-size:calc(13.5px * var(--k,1));font-weight:600;color:var(--cl-ink);cursor:pointer;max-width:170px}',
    '.cbl .cbl-gsel:focus-within{border-color:var(--cl-blue)}',
    /* SAVED VIEWS as tabs above the tools row: one tap sets the list's own filters (no second filter engine) */
    '.cbl .cbl-views{display:flex;align-items:center;gap:6px;padding:2px 20px 6px;background:var(--cl-page);overflow-x:auto;scrollbar-width:none}',
    '.cbl .cbl-views::-webkit-scrollbar{display:none}',
    '.cbl .cbl-vtab{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;height:30px;border:1px solid var(--cl-line);background:var(--cl-card);border-radius:999px;padding:0 12px;font-size:calc(13px * var(--k,1));font-weight:600;white-space:nowrap;margin:0;color:var(--cl-ink)}',
    '.cbl .cbl-vtab .n{font-family:var(--cl-num);font-size:calc(11.5px * var(--k,1));color:var(--cl-muted);font-weight:500}',
    '.cbl .cbl-vtab[aria-selected="true"]{background:var(--cl-ink);border-color:var(--cl-ink);color:var(--cl-page)}',
    '.cbl .cbl-vtab[aria-selected="true"] .n{color:var(--cl-page)}',
    /* a column heading's own filter (opts.columns[].hfilter = a filter key) */
    '.cbl .cbl-hf{border:0;background:none;padding:0 2px;margin:0;color:var(--cl-blue-i);font-size:calc(11px * var(--k,1));line-height:1;cursor:pointer;border-radius:5px;min-width:18px;height:20px}',
    '.cbl .cbl-hf.on{background:var(--cl-blue-t);font-weight:800}',
    '.cbl .cbl-pop.hf{position:absolute;inset-inline-end:auto;min-width:170px;padding:6px;text-transform:none;letter-spacing:normal}',
    '.cbl .cbl-pop.hf button{display:block;width:100%;text-align:start;border:0;background:none;border-radius:7px;padding:6px 10px;font-size:calc(13.5px * var(--k,1));color:var(--cl-ink)}',
    '.cbl .cbl-pop.hf button:hover{background:var(--cl-hov)}',
    '.cbl .cbl-pop.hf button[aria-checked="true"]{background:var(--cl-blue-t);color:var(--cl-blue-i);font-weight:700}',
    /* an action that this login may not do stays on screen, greyed, with its sentence */
    '.cbl .cbl-act{display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px}',
    '.cbl .cbl-btn:disabled{opacity:.55;cursor:not-allowed}',
    '.cbl .cbl-why{font-size:calc(11.5px * var(--k,1));color:var(--cl-muted);max-width:26ch;line-height:1.3}',
    '.cbl .cbl-seg{display:inline-flex;border:1px solid var(--cl-line);border-radius:9px;overflow:hidden;background:var(--cl-card);height:34px}',
    '.cbl .cbl-seg button{border:0;background:none;padding:0 10px;font-size:calc(13.5px * var(--k,1));border-inline-start:1px solid var(--cl-soft);margin:0;border-radius:0}',
    '.cbl .cbl-seg button:first-child{border-inline-start:0}',
    '.cbl .cbl-seg button[aria-pressed="true"]{background:var(--cl-ink);color:var(--cl-page);font-weight:600}',
    '.cbl .cbl-ico{width:34px;justify-content:center;padding:0}',
    '.cbl .cbl-count{font-family:var(--cl-num);font-size:calc(13px * var(--k,1));color:var(--cl-muted);padding:0 4px;white-space:nowrap}',
    '.cbl .cbl-fchips{display:flex;flex-wrap:wrap;gap:6px;width:100%}.cbl .cbl-fchips:empty{display:none}',
    '.cbl .cbl-fchip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--cl-blue-b);background:var(--cl-blue-t);color:var(--cl-blue-i);border-radius:999px;padding:1px 4px 1px 10px;font-size:calc(12.5px * var(--k,1))}',
    '.cbl .cbl-fchip button{border:0;background:none;color:inherit;width:20px;height:20px;border-radius:50%;padding:0}',
    '.cbl .cbl-anchor{position:relative}',
    '.cbl .cbl-pop{position:absolute;top:calc(100% + 6px);inset-inline-end:0;z-index:20;background:var(--cl-card);border:1px solid var(--cl-line);border-radius:12px;box-shadow:var(--cl-shadow);padding:10px 12px;min-width:220px;max-height:min(70vh,480px);overflow:auto;font-size:calc(13.5px * var(--k,1));text-transform:none;font-weight:400;letter-spacing:normal;color:var(--cl-ink)}',
    '.cbl .cbl-pop.left{inset-inline-end:auto;inset-inline-start:0}',
    '.cbl .cbl-notes{display:flex;flex-direction:column;align-items:flex-start;gap:6px}',
    '.cbl .cbl-pop h4{margin:4px 0 6px;font-size:calc(11px * var(--k,1));letter-spacing:.07em;text-transform:uppercase;color:var(--cl-faint);font-weight:700}',
    '.cbl .cbl-pop .f{display:grid;grid-template-columns:80px 1fr;align-items:center;gap:8px;margin:6px 0}',
    '.cbl .cbl-pop select{border:1px solid var(--cl-line);border-radius:7px;background:var(--cl-card);padding:3px 6px}',
    '.cbl .cbl-preset{display:grid;gap:2px}',
    '.cbl .cbl-preset button{text-align:start;border:0;background:none;border-radius:7px;padding:5px 8px}',
    '.cbl .cbl-preset button[aria-pressed="true"]{background:var(--cl-blue-t);color:var(--cl-blue-i);font-weight:600}',
    '.cbl .cbl-custom{display:flex;gap:6px;align-items:center;margin-top:6px;font-size:calc(13px * var(--k,1))}',
    '.cbl .cbl-custom input{border:1px solid var(--cl-line);border-radius:7px;padding:2px 6px;background:var(--cl-card);font-family:var(--cl-num);font-size:calc(12.5px * var(--k,1));width:128px}',
    '.cbl .cbl-btn{border:1px solid var(--cl-line);background:var(--cl-card);border-radius:9px;padding:3px 10px;font-size:calc(13px * var(--k,1));font-weight:500}',
    '.cbl .cbl-acts{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}',
    '.cbl .cbl-colrow{display:flex;align-items:center;gap:6px;padding:2px 0}',
    '.cbl .cbl-colrow label{flex:1 1 auto!important;display:flex!important;flex-direction:row!important;align-items:center!important;gap:7px!important;padding:3px 8px;border-radius:6px;cursor:pointer;white-space:nowrap;margin:0;font-weight:400}',
    '.cbl .cbl-colrow label:has(input:checked){background:var(--cl-blue-t);color:var(--cl-blue-i);font-weight:600}',
    '.cbl .cbl-colrow input{accent-color:var(--cl-blue);width:14px;height:14px}',
    '.cbl .cbl-mv{width:24px;height:24px;border:1px solid var(--cl-line);background:var(--cl-card);border-radius:6px;padding:0;font-size:calc(12px * var(--k,1));flex:0 0 auto}',
    '.cbl .cbl-mv:disabled{opacity:.3;cursor:default}.cbl .cbl-mvsp{width:24px;flex:0 0 auto}',
    '.cbl .cbl-noroom{font-size:calc(11.5px * var(--k,1));color:var(--cl-amber-i);margin-inline-start:4px}',
    /* row 3 · the column header + the rows: ONE scroll area, the header sticky inside it */
    '.cbl .cbl-list{flex:1;min-height:0;overflow:auto;border-top:1px solid var(--cl-line);background:var(--cl-card);container-type:inline-size;container-name:list;overscroll-behavior:contain}',
    '.cbl .cbl-grid{display:grid;min-width:max-content}.cbl .cbl-grid.cbl-lines{min-width:0}',
    '.cbl .cbl-hdr{position:sticky;top:0;z-index:5;display:grid;background:var(--cl-panel);border-bottom:1.5px solid var(--cl-line)}',
    '.cbl .cbl-hc{position:relative;display:flex;align-items:center;gap:4px;padding:7px 12px;font-size:calc(12px * var(--k,1));font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--cl-muted);white-space:nowrap;min-width:0;user-select:none}',
    '.cbl .cbl-hc.r{justify-content:flex-end}',
    '.cbl .cbl-hc .sort{border:0;background:none;padding:0;font:inherit;color:inherit;letter-spacing:inherit;text-transform:inherit;display:inline-flex;gap:3px;align-items:center}',
    '.cbl .cbl-hc .arrow{color:var(--cl-blue);font-size:calc(11px * var(--k,1))}',
    '.cbl .cbl-rz{position:absolute;inset-inline-end:-4px;top:0;bottom:0;width:9px;cursor:col-resize;z-index:2;border:0;background:none;padding:0;touch-action:none}',
    '.cbl .cbl-rz::after{content:"";position:absolute;inset-inline-start:4px;top:6px;bottom:6px;width:1px;background:var(--cl-line)}',
    '.cbl .cbl-rz:hover::after,.cbl .cbl-rz:focus-visible::after,.cbl .cbl-rz.drag::after{width:3px;inset-inline-start:3px;background:var(--cl-blue)}',
    '.cbl .cbl-row{display:grid;align-items:center;border-bottom:1px solid var(--cl-hair);cursor:pointer;position:relative}',
    /* ZEBRA (Athi, 2026-10-09): every other data row, one shade from a theme token (--zebra, else the ink mixed 4% into the card, so every theme keeps its contrast); a group head, the hover row and the selected row stay distinct; a multi-line row is ONE stripe */
    '.cbl .cbl-row.z,.cbl .cbl-lrec.z{background:var(--cl-zebra)}',
    '.cbl .cbl-row:hover{background:var(--cl-hov)}',
    '.cbl .cbl-row.sel{background:var(--cl-blue-t);box-shadow:inset 0 0 0 2px var(--cl-blue)}',
    '.cbl .cbl-cell{padding:8px 12px;min-width:0;overflow-wrap:break-word;word-break:normal}',
    '.cbl .cbl-cell.r{text-align:end}',
    '.cbl .cbl-cell.mono{font-family:var(--cl-num);font-variant-numeric:tabular-nums;font-size:calc(13.5px * var(--k,1))}',
    '.cbl .cbl-cell.strong{font-weight:700}',
    '.cbl .cbl-lead{padding:8px 0 8px 12px;display:flex;align-items:center}',
    '.cbl .cbl-tw{display:inline-block;width:14px;color:var(--cl-faint);transition:transform .15s}',
    '.cbl .cbl-open>.cbl-cell>.cbl-tw,.cbl .cbl-open .cbl-tw{transform:rotate(90deg)}',
    '.cbl .cbl-link{color:var(--cl-blue);text-decoration:underline;text-underline-offset:2px;font-family:var(--cl-num);font-size:calc(13.5px * var(--k,1))}',
    '.cbl .cbl-dim{color:var(--cl-faint)}',
    '.cbl .cbl-group{position:sticky;top:var(--cl-hdr-h,35px);z-index:3;display:flex;flex-wrap:wrap;gap:2px 8px;align-items:baseline;padding:6px 12px;background:var(--cl-gband);color:var(--cl-ink);border-top:1px solid var(--cl-line);border-bottom:1px solid var(--cl-line);border-inline-start:4px solid var(--cl-blue);font-size:calc(12px * var(--k,1));text-transform:uppercase;letter-spacing:.04em}',
    '.cbl .cbl-row.ing>:first-child{padding-inline-start:28px}.cbl .cbl-lrec.ing{padding-inline-start:28px}',
    '.cbl .cbl-group b{font-weight:700}.cbl .cbl-group .fig{font-family:var(--cl-num);font-size:calc(12px * var(--k,1));color:var(--cl-ink);text-transform:none;letter-spacing:0}',
    '.cbl .cbl-next{background:var(--cl-page);border-bottom:1px solid var(--cl-soft);padding:6px 12px 10px 38px;cursor:default;overflow-wrap:break-word;word-break:normal}',
    '.cbl .cbl-next .gist{color:var(--cl-muted);font-size:calc(13px * var(--k,1));margin-bottom:6px}',
    /* ☰ lines */
    '.cbl .cbl-lrec{border-bottom:1px solid var(--cl-hair);padding:8px 12px;cursor:pointer}',
    '.cbl .cbl-lrec:hover{background:var(--cl-hov)}',
    '.cbl .cbl-lrec.sel{background:var(--cl-blue-t);box-shadow:inset 0 0 0 2px var(--cl-blue)}',
    '.cbl .cbl-lline{display:flex;gap:4px 10px;align-items:baseline}',
    '.cbl .cbl-lflow{flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:2px 0}',
    '.cbl .cbl-lflow > span:not(:last-child)::after{content:"·";color:var(--cl-ghost);margin:0 7px}',
    '.cbl .cbl-lamt{font-family:var(--cl-num);font-weight:700;white-space:nowrap}',
    '.cbl .cbl-lgist{color:var(--cl-muted);font-size:calc(13px * var(--k,1));padding-inline-start:22px;margin-top:1px}',
    /* states */
    '.cbl .cbl-state{padding:44px 20px;text-align:center;color:var(--cl-muted)}',
    '.cbl .cbl-state .big{font:700 calc(18px * var(--k,1)) var(--cl-display);color:var(--cl-ink);margin-bottom:4px}',
    '.cbl .cbl-state .cbl-btn{margin-top:10px}',
    '.cbl .cbl-end{text-align:center;padding:12px 10px;font:calc(12px * var(--k,1)) var(--cl-num);color:var(--cl-muted)}',
    '.cbl .cbl-end button{margin-inline-end:8px;border:1px solid var(--cl-blue);background:var(--cl-blue);color:var(--cl-card);border-radius:9px;padding:5px 11px;font-weight:700}',
    '.cbl .cbl-skel{height:36px;margin:8px 12px;border-radius:8px;background:linear-gradient(90deg,var(--cl-hair),var(--cl-panel),var(--cl-hair));background-size:200% 100%;animation:cbl-sk 1.2s infinite linear}',
    '@keyframes cbl-sk{to{background-position:-200% 0}}',
    '@media (prefers-reduced-motion: reduce){.cbl .cbl-skel{animation:none}.cbl .cbl-tw{transition:none}}',
    '.cbl .cbl-foot{padding:8px 12px;border-top:1px solid var(--cl-soft)}',
    '.cbl .cbl-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    /* a phone, or any narrow pane: one card per row, label : value, nothing sideways (a container query, not the page width) */
    '@container list (max-width: 620px){',
    '.cbl .cbl-grid{min-width:0}.cbl .cbl-hdr{display:none}',
    '.cbl .cbl-row{display:flex;flex-wrap:wrap;gap:0 10px;padding:8px 12px;margin:8px 10px;border:1px solid var(--cl-line);border-radius:12px;background:var(--cl-card)}',
    '.cbl .cbl-row .cbl-cell{padding:2px 0}',
    '.cbl .cbl-row .cbl-cell[data-l]:not([data-l=""])::before{content:attr(data-l) " ";color:var(--cl-faint);font-size:calc(11px * var(--k,1));letter-spacing:.05em;text-transform:uppercase;margin-inline-end:4px;font-family:var(--cl-ui);font-weight:600}',
    '.cbl .cbl-row .cbl-cell.first{width:100%;font-weight:600}.cbl .cbl-row .cbl-cell.amt{margin-inline-start:auto}',
    '.cbl .cbl-row .cbl-lead{position:absolute;inset-inline-end:8px;top:6px;padding:0}',
    '.cbl .cbl-next{margin:-6px 10px 8px;border-radius:0 0 12px 12px;padding-inline-start:14px}',
    '.cbl .cbl-lline{flex-wrap:wrap}.cbl .cbl-lamt{margin-inline-start:auto}.cbl .cbl-lflow{flex:1 1 100%;order:2}',
    '}',
    '@container screen (max-width: 640px){',
    '.cbl .cbl-title{padding:8px 16px 6px;gap:5px 8px}.cbl .cbl-tools{padding:6px 16px;gap:6px}.cbl .cbl-title h1{font-size:calc(21px * var(--k,1))}.cbl .cbl-search{flex-basis:100%}',
    '.cbl .cbl-pop,.cbl .cbl-pop.left{position:fixed;inset-inline:8px;top:auto;bottom:8px;max-height:min(70%,520px);min-width:0;z-index:30}',
    '.cbl .cbl-chip{font-size:calc(12px * var(--k,1));padding:3px 9px}.cbl .cbl-chip.period{font-size:calc(12px * var(--k,1))}.cbl .cbl-seg button,.cbl .cbl-tbtn{padding:0 8px}.cbl .cbl-ico{padding:0}',
    '}'
  ].join('\n');
  function injectCss() {
    var d = root.document;
    if (!d || !d.head || d.getElementById('cblist_css')) return;
    var s = d.createElement('style'); s.id = 'cblist_css'; s.textContent = CSS.replace(/\.cbl(?![\w-])/g, '.cbl:not(#_)'); d.head.appendChild(s);
  }

  /* ── small helpers ── */
  function px(w, dflt) { if (typeof w === 'number') return w; var m = /(\d+(?:\.\d+)?)\s*px/.exec(String(w || '')); return m ? parseFloat(m[1]) : (dflt || 140); }
  function val(x) { return typeof x === 'function' ? safe(x, undefined) : x; }
  function safe(fn, dflt) { try { var v = fn(); return v === undefined ? dflt : v; } catch (_) { return dflt; } }
  function cmpVals(a, b) {
    var na = typeof a === 'number' ? a : parseFloat(String(a).replace(/[^\d.\-]/g, '')), nb = typeof b === 'number' ? b : parseFloat(String(b).replace(/[^\d.\-]/g, ''));
    if (typeof a === 'number' || (isFinite(na) && isFinite(nb) && /^[\s\d.,\-−₹$€£]+$/.test(String(a)) && /^[\s\d.,\-−₹$€£]+$/.test(String(b)))) { return (na || 0) - (nb || 0); }
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }

  var INST = [];                /* every live mount; pruned when its element leaves the document */
  var STATE = {};               /* key → the choices that must survive a repaint (search, filters, open rows) */
  var DRAG = null;

  function prune() {
    INST = INST.filter(function (I) {
      if (I.dead) return false;
      if (!root.document.documentElement.contains(I.el)) { teardown(I); return false; }
      return true;
    });
  }
  function teardown(I) {
    I.dead = true; try { if (I.io) I.io.disconnect(); } catch (_) {} clearTimeout(I.qt);
    try { var lb = I.el.querySelector(':scope > .cbl-list'); if (lb && lb.__cblRO) lb.__cblRO.disconnect(); } catch (_) {}
    (I.off || []).forEach(function (x) { try { I.el.removeEventListener(x[0], x[1]); } catch (_) {} }); I.off = [];
  }

  /* ═════ MOUNT ═════ */
  function mount(el, o) {
    if (!el || !o) return null;
    injectCss();
    prune();
    var key = String(o.key || el.id || 'list');
    el.innerHTML = '';
    if (el.__cbl) { teardown(el.__cbl); INST = INST.filter(function (x) { return x !== el.__cbl; }); }
    var I = { el: el, o: o, key: key, pop: null, limit: 50, nextCache: {}, dead: false };
    var R = STATE[key] || (STATE[key] = { q: '', filt: {}, open: {}, allOpen: false, sel: {}, selMode: false, gcol: {}, hl: null });
    I.r = R;
    /* a host may open the list already narrowed (a link from another page: Home's Suppliers -> the CRM list of suppliers): opts.preset = { filt:{ key: value } } replaces the remembered filters */
    if (o.preset && o.preset.filt) { R.filt = {}; Object.keys(o.preset.filt).forEach(function (k) { R.filt[k] = o.preset.filt[k]; }); }
    I.s = loadChoices(I);
    el.__cbl = I;
    el.classList.add('cbl');
    el.setAttribute('data-cbl', key);
    wire(I);
    INST.push(I);
    paintAll(I);
    var api = {
      refresh: function (x) { return refresh(I, x); },
      destroy: function () { teardown(I); INST = INST.filter(function (y) { return y !== I; }); if (el.__cbl === I) { el.__cbl = null; el.innerHTML = ''; el.classList.remove('cbl'); } },
      el: el,
      state: function () { return { cols: I.s.cols.slice(), widths: JSON.parse(JSON.stringify(I.s.widths)), view: I.s.view, group: I.s.group, sort: I.s.sort, q: R.q, filt: JSON.parse(JSON.stringify(R.filt)) }; }
    };
    I.api = api;
    return api;
  }

  /* the choices a person made, remembered per list key: through opts.store when the host gives one, else under our own prefix */
  function skey(I) { return 'cblist.' + (I.o.scope ? I.o.scope + '.' : '') + I.key; }
  function loadChoices(I) {
    var o = I.o, saved = null;
    if (o.store && typeof o.store.get === 'function') saved = safe(function () { return o.store.get(I.key); }, null);
    else saved = lsGet(skey(I));
    saved = (saved && typeof saved === 'object') ? saved : {};
    var s = { cols: Array.isArray(saved.cols) && saved.cols.length ? saved.cols.slice() : null, widths: (saved.widths && typeof saved.widths === 'object') ? saved.widths : {},
      view: saved.view === 'lines' || saved.view === 'grid' ? saved.view : (o.view === 'lines' ? 'lines' : 'grid'), group: saved.group || (o.group && o.group.default) || null,
      sort: saved.sort && saved.sort.key ? saved.sort : null };
    return s;
  }
  function saveChoices(I) {
    var s = I.s, v = { cols: s.cols, widths: s.widths, view: s.view, group: s.group, sort: s.sort };
    if (I.o.store && typeof I.o.store.set === 'function') safe(function () { I.o.store.set(I.key, v); });
    else lsSet(skey(I), v);
  }

  /* the host's words, else ours; never a raw key */
  function T(I, s, vars) {
    var r = s;
    if (I.o.t) { r = safe(function () { return I.o.t(s); }, s); if (typeof r !== 'string' || !r) r = s; }
    if (vars) Object.keys(vars).forEach(function (k) { r = r.split('{' + k + '}').join(vars[k]); });
    return r;
  }

  /* ═════ the data: rows → matched → ordered → grouped items ═════ */
  function allRows(I) { var r = typeof I.o.rows === 'function' ? safe(function () { return I.o.rows(); }, []) : I.o.rows; return Array.isArray(r) ? r : []; }
  function rid(I, row, i) { var v = I.o.id ? I.o.id(row) : row && row.id; return String(v == null ? 'r' + i : v); }
  function columns(I) { return (typeof I.o.columns === 'function' ? I.o.columns() : I.o.columns) || []; }
  function pinned(I) { return columns(I).filter(function (c) { return c.pin === 'end'; }); }
  function choosable(I) { return columns(I).filter(function (c) { return c.pin !== 'end'; }); }
  function topKey(I) {
    var cs = choosable(I), best = null;
    cs.forEach(function (c) { if (best == null || (c.prio || 99) < (best.prio || 99)) best = c; });
    return best ? best.key : null;
  }
  function defaultCols(I) {
    var cs = choosable(I), keys = cs.map(function (c) { return c.key; });
    if (Array.isArray(I.o.defaultCols) && I.o.defaultCols.length) return I.o.defaultCols.filter(function (k) { return keys.indexOf(k) >= 0; });
    var byPrio = cs.slice().sort(function (a, b) { return (a.prio || 99) - (b.prio || 99); }).slice(0, 3).map(function (c) { return c.key; });
    return keys.filter(function (k) { return byPrio.indexOf(k) >= 0; });
  }
  /* the shown columns, in the person's order: stale keys dropped, the top column always present, then any pinned (the amount) at the end */
  function shownKeys(I) {
    var keys = choosable(I).map(function (c) { return c.key; }), set = (I.s.cols || defaultCols(I)).filter(function (k) { return keys.indexOf(k) >= 0; });
    if (!set.length) set = defaultCols(I);
    var top = topKey(I); if (top && set.indexOf(top) < 0) set = [top].concat(set);
    return set;
  }
  /* in card mode (a narrow container) a page may cap the fields a card carries: the highest-priority ones stay, the rest are NAMED in the chooser */
  function noRoomKeys(I) {
    var keys = shownKeys(I), max = I.o.cardMax;
    if (!I.card || !max || keys.length <= max) return [];
    var by = {}; columns(I).forEach(function (c) { by[c.key] = c; });
    var keep = keys.slice().sort(function (a, b) { return ((by[a] || {}).prio || 99) - ((by[b] || {}).prio || 99); }).slice(0, max);
    return keys.filter(function (k) { return keep.indexOf(k) < 0; });
  }
  function shownCols(I) {
    var by = {}, out = noRoomKeys(I); columns(I).forEach(function (c) { by[c.key] = c; });
    return shownKeys(I).filter(function (k) { return out.indexOf(k) < 0; }).map(function (k) { return by[k]; }).filter(Boolean).concat(pinned(I));
  }
  function minW(I, c) { return Math.max(64, String(c.label || c.key).length * 9 + 40); }
  function widthOf(I, c) { var w = I.s.widths[c.key]; if (typeof w !== 'number') w = Math.max(px(c.w, 140), minW(I, c)); return Math.max(minW(I, c), w); }
  function leadOn(I) { return !!(I.o.lead && safe(function () { return I.o.lead.on(); }, false)) || (I.o.bulk && I.o.bulk.length && I.r.selMode); }
  function template(I, cols) { return (leadOn(I) ? '34px ' : '') + cols.map(function (c) { return widthOf(I, c) + 'px'; }).join(' '); }
  function remote(I) { return !!I.o.remote; }

  function sortOf(I, cols) {
    var st = I.s.sort, sorts = I.o.sorts || [], e = null, dir = 1, cmp = null;
    if (st) {
      dir = st.dir === -1 ? -1 : 1;
      for (var i = 0; i < sorts.length; i++) if (sorts[i].key === st.key) { e = sorts[i]; break; }
      if (e) cmp = e.cmp;
      else {
        var col = null; columns(I).forEach(function (c) { if (!col && sortId(c) === st.key) col = c; });
        if (col) cmp = function (a, b) { return cmpVals(sortVal(col, a), sortVal(col, b)); };
      }
    } else if (sorts[0] && sorts[0].cmp) cmp = sorts[0].cmp;
    return cmp ? { cmp: cmp, dir: dir } : null;
  }
  /* the sort in force: the page's own (a server-sorted list), else the person's, else the first declared */
  function curSort(I) {
    if (I.o.sortNow) return safe(function () { return I.o.sortNow(); }, null);
    return I.s.sort || (sortOf(I) && (I.o.sorts || [])[0] ? { key: I.o.sorts[0].key, dir: 1 } : null);
  }
  function sortId(c) { return c.sort === true ? c.key : (c.sort ? String(c.sort) : null); }
  function sortVal(c, row) { if (c.value) return safe(function () { return c.value(row); }, ''); var v = safe(function () { return c.cell(row); }, ''); return c.html ? plain(v) : v; }

  /* a filter choice the data no longer offers (a new date range) is dropped, never left hiding everything */
  function cleanFilters(I) {
    (I.o.filters || []).forEach(function (f) {
      var v = I.r.filt[f.key], opts = fopts(f);
      if (v && opts.length && !opts.some(function (x) { return x.v === v; })) delete I.r.filt[f.key];
    });
  }
  function matched(I) {
    var rows = allRows(I), R = I.r;
    if (remote(I)) return { all: rows, rows: rows };
    var q = String(R.q || '').trim().toLowerCase(), fl = I.o.filters || [];
    var out = rows.filter(function (row) {
      if (q) {
        var text = I.o.search ? safe(function () { return I.o.search(row); }, '') : columns(I).map(function (c) { return sortVal(c, row); }).join(' ');
        if (String(text || '').toLowerCase().indexOf(q) < 0) return false;
      }
      for (var i = 0; i < fl.length; i++) { var v = R.filt[fl[i].key]; if (v && !safe(function () { return fl[i].match ? fl[i].match(row, v) : row[fl[i].key] === v; }, true)) return false; }
      return true;
    });
    var srt = sortOf(I);
    if (srt) { var d = srt.dir; out = out.slice().sort(function (a, b) { return srt.cmp(a, b) * d; }); }
    return { all: rows, rows: out };
  }
  function groupMode(I) { var g = I.o.group; if (!g) return null; var opts = g.options || []; var m = I.s.group; if (m && opts.length && !opts.some(function (x) { return x[0] === m; })) m = null; return m || g.default || (opts[0] && opts[0][0]) || 'on'; }
  /* the rows (and, with a grouping, their group lines) in order: a group is ONE head and all its rows, groups in order of first appearance */
  function itemsOf(I, rows) {
    var g = I.o.group, mode = groupMode(I);
    if (!g || !g.by || mode === 'none') return rows.map(function (r, i) { return { row: r, id: rid(I, r, i) }; });
    var buckets = {}, order = [], loose = [];
    rows.forEach(function (r, i) {
      var k = safe(function () { return g.by(r, mode); }, null), it = { row: r, id: rid(I, r, i), g: k ? String(k[1]) : null };
      if (!k) { loose.push(it); return; }
      var key = String(k[1]);
      if (!buckets[key]) { buckets[key] = { label: k[0], rows: [], items: [] }; order.push(key); }
      buckets[key].rows.push(r); buckets[key].items.push(it);
    });
    if (g.order) order.sort(function (x, y) { return g.order.indexOf(x) - g.order.indexOf(y); });
    var items = [];
    order.forEach(function (key) {
      var bk = buckets[key], fig = g.fig ? safe(function () { return g.fig(bk.rows, mode, key); }, '') : T(I, '{n} shown', { n: bk.rows.length });
      items.push({ group: bk.label, gkey: key, fig: fig });
      bk.items.forEach(function (it) { items.push(it); });
    });
    return items.concat(loose);
  }
  function isOpen(I, id) { var R = I.r; return R.allOpen ? !R.open[id + '#closed'] : !!R.open[id]; }
  function hasNext(I) { return !!(I.o.next || (I.o.actions && I.o.actions.length)); }

  /* ═════ painting ═════ */
  function paintAll(I) { cleanFilters(I); paintTitle(I); paintTools(I); paintList(I); fit(I); }
  function $(I, sel) { return I.el.querySelector(sel); }

  function head(I) { return typeof I.o.head === 'function' ? safe(function () { return I.o.head(); }, null) : I.o.head; }
  function paintTitle(I) {
    var h = head(I), box = $(I, ':scope > .cbl-title');
    if (!h || !(h.title || h.period || h.slot || (h.notices && h.notices.length) || (h.chips && h.chips.length))) { if (box) box.remove(); return; }
    if (!box) { box = root.document.createElement('div'); box.className = 'cbl-title'; box.setAttribute('data-cbl-part', 'title'); I.el.insertBefore(box, I.el.firstChild); }
    var out = '';
    if (h.title) out += '<h1>' + esc(h.title) + '</h1>';
    if (h.period) {
      var p = h.period;
      out += '<span class="cbl-anchor"><button type="button" class="cbl-chip period" data-cbl-pop="period" aria-haspopup="dialog" aria-expanded="' + (I.pop === 'period') + '" data-testid="cbl-period-' + esc(I.key) + '">' + esc(p.label || '') + ' ▾</button>'
        + (I.pop === 'period' ? periodPop(I, p) : '') + '</span>';
    }
    var chips = h.chips || [], notes = h.notices || [], chipHTML = function (c) { return '<span class="cbl-chip"' + (c.tid ? ' data-testid="' + esc(c.tid) + '"' : '') + '>' + esc(c.text) + '</span>'; };
    var noteHTML = function (n, i) { return '<button type="button" class="cbl-chip ' + esc(n.cls === 'bad' ? 'bad' : 'warn') + '" data-notice="' + i + '"' + (n.tid ? ' data-testid="' + esc(n.tid) + '"' : '') + '>' + esc(n.text) + '</button>'; };
    /* a narrow container folds the strip and the notices into ONE chip that opens them: the head stays within its 30% of a phone */
    I.narrow = I.el.clientWidth > 0 && I.el.clientWidth <= 640;
    if (I.narrow && chips.length + notes.length > 1) {
      var bad = notes.some(function (n) { return n.cls === 'bad'; });
      out += '<span class="cbl-anchor"><button type="button" class="cbl-chip ' + (notes.length ? (bad ? 'bad' : 'warn') : '') + '" data-cbl-pop="notes" aria-haspopup="dialog" aria-expanded="' + (I.pop === 'notes') + '" data-testid="cbl-notes-' + esc(I.key) + '">'
        + esc(T(I, notes.length ? '{n} notices' : '{n} details', { n: chips.length + notes.length })) + ' ▾</button>'
        + (I.pop === 'notes' ? '<div class="cbl-pop left" role="dialog" aria-label="' + esc(T(I, 'Notices')) + '" data-testid="cbl-notes-pop-' + esc(I.key) + '"><div class="cbl-notes">' + chips.map(chipHTML).join('') + notes.map(noteHTML).join('') + '</div></div>' : '') + '</span>';
    } else {
      out += chips.map(chipHTML).join('') + notes.map(noteHTML).join('');
    }
    if (typeof h.slot === 'function') out += '<span class="cbl-slot" data-cbl-part="slot" style="margin-inline-start:auto;display:flex;align-items:center;gap:8px"></span>';
    box.innerHTML = out;
    if (typeof h.slot === 'function') { var sl = box.querySelector(':scope > .cbl-slot'); if (sl) safe(function () { h.slot(sl); }); }
  }
  function periodPop(I, p) {
    var presets = p.presets || [], val = I.pv || p.value;
    return '<div class="cbl-pop left" role="dialog" aria-label="' + esc(T(I, 'Period')) + '"><h4>' + esc(T(I, 'Period')) + '</h4><div class="cbl-preset">'
      + presets.map(function (x) { return '<button type="button" data-period="' + esc(x[0]) + '" aria-pressed="' + (val === x[0]) + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>'
      + (val === 'custom' ? '<div class="cbl-custom"><input data-cbl-from type="date" value="' + esc((p.custom && p.custom.from) || '') + '" aria-label="' + esc(T(I, 'From')) + '"> → <input data-cbl-to type="date" value="' + esc((p.custom && p.custom.to) || '') + '" aria-label="' + esc(T(I, 'To')) + '"></div>' : '')
      + '</div>';
  }

  function activeFilters(I) { return (I.o.filters || []).filter(function (f) { return I.r.filt[f.key]; }); }
  function countText(I, m) {
    var t = T(I, '{n} shown', { n: m.rows.length });
    if (remote(I)) { var tot = val(I.o.remote.total); if (tot != null && tot !== m.rows.length) t += ' ' + T(I, 'of') + ' ' + tot; }
    else if (m.rows.length !== m.all.length) t += ' ' + T(I, 'of') + ' ' + m.all.length;
    return t;
  }
  function fopts(f) { return (f.options || []).map(function (x) { return typeof x === 'object' ? x : { v: x, label: x }; }); }
  function paintTools(I) {
    paintViews(I);
    var box = $(I, ':scope > .cbl-tools');
    if (!box) { box = root.document.createElement('div'); box.className = 'cbl-tools'; box.setAttribute('data-cbl-part', 'tools'); box.setAttribute('role', 'toolbar'); box.setAttribute('aria-label', T(I, 'View')); var l = $(I, ':scope > .cbl-list'); I.el.insertBefore(box, l); }
    var o = I.o, R = I.r, s = I.s, m = matched(I), fn = activeFilters(I).length, k = esc(I.key), sorts = sortChoices(I);
    var tids = o.tids || {}, tl = o.tools || {}, h = tl.search === false ? '' : '<div class="cbl-search"><span aria-hidden="true">🔍</span><input type="search" data-cbl-q id="cbl-q-' + k + '" data-testid="listctl-search-' + k + '" placeholder="' + esc(o.searchHint || T(I, 'Search')) + '" value="' + esc(R.q) + '" aria-label="' + esc(T(I, 'Search')) + '"></div>';
    if (!remote(I) && ((o.filters && o.filters.length) || sorts.length > 1)) {
      h += '<span class="cbl-anchor"><button type="button" class="cbl-tbtn' + (fn ? ' on' : '') + '" data-cbl-pop="filt" id="cbl-filt-' + k + '" data-testid="cbl-filters-' + k + '" aria-haspopup="dialog" aria-expanded="' + (I.pop === 'filt') + '">' + esc(T(I, 'Filters')) + ' ▾' + (fn ? ' <span class="badge">' + fn + '</span>' : '') + '</button>' + (I.pop === 'filt' ? filtPop(I, sorts) : '') + '</span>';
    }
    var g = o.group, gm = groupMode(I);
    if (g && g.as === 'select' && (g.options || []).length > 1) {
      h += '<label class="cbl-gsel" data-testid="cbl-group-' + k + '"' + (g.tips && g.tips[gm] ? ' title="' + esc(T(I, g.tips[gm])) + '"' : '') + '><span class="cbl-glab" data-testid="cbl-glab-' + k + '">' + esc(T(I, 'Group')) + '</span><select data-gsel id="cbl-gsel-' + k + '" data-testid="' + esc(g.tid ? g.tid + '-group' : 'cbl-gsel-' + k) + '" aria-label="' + esc(T(I, 'Group by')) + '">'
        + g.options.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (gm === x[0] ? ' selected' : '') + (g.tips && g.tips[x[0]] ? ' title="' + esc(T(I, g.tips[x[0]])) + '"' : '') + '>' + esc(T(I, x[1])) + '</option>'; }).join('') + '</select></label>';
    } else if (g && (g.options || []).length > 1) h += '<span class="cbl-glab" data-testid="cbl-glab-' + k + '">' + esc(T(I, 'Group by')) + '</span><span class="cbl-seg" role="group" aria-label="' + esc(T(I, 'Group by')) + '" data-testid="cbl-group-' + k + '">' + g.options.map(function (x) { return '<button type="button" data-group="' + esc(x[0]) + '"' + (g.tid ? ' data-testid="' + esc(g.tid) + '-group-' + esc(x[0]) + '"' : '') + ' aria-pressed="' + (gm === x[0]) + '">' + esc(T(I, x[1])) + '</button>'; }).join('') + '</span>';
    if (hasNext(I)) h += '<button type="button" class="cbl-tbtn cbl-ico" data-cbl-exp data-testid="' + esc(R.allOpen ? (tids.collapse || 'cbl-expand-' + k) : (tids.expand || 'cbl-expand-' + k)) + '" title="' + esc(T(I, R.allOpen ? 'Collapse all' : 'Expand all')) + '" aria-label="' + esc(T(I, R.allOpen ? 'Collapse all' : 'Expand all')) + '" aria-pressed="' + !!R.allOpen + '">' + (R.allOpen ? '⇡' : '⇣') + '</button>';
    h += '<span class="cbl-seg" role="group" aria-label="' + esc(T(I, 'View')) + '"><button type="button" data-view="grid" data-testid="view-grid-' + k + '" title="' + esc(T(I, 'Grid: columns')) + '" aria-label="' + esc(T(I, 'Grid: columns')) + '" aria-pressed="' + (s.view === 'grid') + '">▤</button><button type="button" data-view="lines" data-testid="view-lines-' + k + '" title="' + esc(T(I, 'Lines: one line per record')) + '" aria-label="' + esc(T(I, 'Lines: one line per record')) + '" aria-pressed="' + (s.view === 'lines') + '">☰</button></span>';
    h += '<span class="cbl-anchor"><button type="button" class="cbl-tbtn cbl-ico" data-cbl-pop="cols" id="cbl-cols-' + k + '" data-testid="cols-btn-' + k + '" title="' + esc(T(I, 'Choose columns')) + '" aria-label="' + esc(T(I, 'Choose columns')) + '" aria-haspopup="dialog" aria-expanded="' + (I.pop === 'cols') + '">⚙</button>' + (I.pop === 'cols' ? colsPop(I) : '') + '</span>';
    if (o.csv !== false && tl.csv !== false) h += '<button type="button" class="cbl-tbtn cbl-ico" data-cbl-csv data-testid="' + esc(tids.csv || 'cbl-csv-' + k) + '" title="' + esc(T(I, 'Download CSV')) + '" aria-label="' + esc(T(I, 'Download CSV')) + '">⬇</button>';
    if (o.bulk && o.bulk.length) h += '<button type="button" class="cbl-tbtn' + (R.selMode ? ' on' : '') + '" data-cbl-selmode data-testid="cbl-select-' + k + '" aria-pressed="' + !!R.selMode + '">☑ ' + esc(T(I, 'Select')) + '</button>';
    h += '<span class="cbl-count" id="cbl-count-' + k + '" data-testid="' + esc(tids.count || (I.key + '-count')) + '" aria-live="polite">' + esc(countText(I, m)) + '</span>';
    if (o.bulk && o.bulk.length && R.selMode) {
      var n = selectedRows(I).length;
      h += '<span class="cbl-acts" style="margin:0" data-testid="cbl-bulk-' + k + '"><button type="button" class="cbl-btn" data-cbl-selall>' + esc(T(I, 'Select all shown')) + '</button>' + o.bulk.map(function (b) { return '<button type="button" class="cbl-btn" data-bulk="' + esc(b.id) + '"' + (n ? '' : ' disabled') + '>' + esc(T(I, b.label)) + ' (' + n + ')</button>'; }).join('') + '</span>';
    }
    h += '<div class="cbl-fchips">' + activeFilters(I).map(function (f) {
      var ov = fopts(f).filter(function (x) { return x.v === R.filt[f.key]; })[0];
      return '<span class="cbl-fchip">' + esc(f.label || f.key) + ': ' + esc(ov ? ov.label : R.filt[f.key]) + '<button type="button" data-unfilt="' + esc(f.key) + '" aria-label="' + esc(T(I, 'Remove {x} filter', { x: f.label || f.key })) + '">×</button></span>';
    }).join('') + '</div>';
    if (I.pop && String(I.pop).indexOf('hf:') === 0) h += hfPop(I);
    var ae = root.document.activeElement, keepId = ae && box.contains(ae) ? ae.id : '', ss = null, se = null;
    if (keepId && ae.setSelectionRange) { try { ss = ae.selectionStart; se = ae.selectionEnd; } catch (_) {} }
    box.innerHTML = h;
    if (keepId) { var back = box.querySelector('#' + cssId(keepId)); if (back) { back.focus(); if (ss != null) { try { back.setSelectionRange(ss, se); } catch (_) {} } } }
  }
  /* the saved views: tabs that set the list's own filters. A tab is lit when the filters in force are exactly its own. */
  function viewMatches(I, v, row) {
    var fl = I.o.filters || [], ok = true;
    Object.keys(v.filt || {}).forEach(function (fk) {
      var f = fl.filter(function (x) { return x.key === fk; })[0];
      if (f && ok && !safe(function () { return f.match ? f.match(row, v.filt[fk]) : row[fk] === v.filt[fk]; }, true)) ok = false;
    });
    return ok;
  }
  function viewOn(I, v) {
    var a = I.r.filt, b = v.filt || {}, ka = Object.keys(a).filter(function (k) { return a[k]; }), kb = Object.keys(b);
    return ka.length === kb.length && kb.every(function (k) { return a[k] === b[k]; });
  }
  function paintViews(I) {
    var vs = I.o.views && I.o.views.items, box = $(I, ':scope > .cbl-views');
    if (!vs || !vs.length || remote(I)) { if (box) box.remove(); return; }
    if (!box) {
      box = root.document.createElement('div'); box.className = 'cbl-views'; box.setAttribute('data-cbl-part', 'views'); box.setAttribute('role', 'tablist'); box.setAttribute('aria-label', T(I, 'Views'));
      var tl = $(I, ':scope > .cbl-tools'), l = $(I, ':scope > .cbl-list'); I.el.insertBefore(box, tl || l);
    }
    var rows = allRows(I), vt = I.o.views.tid || 'views';
    box.innerHTML = vs.map(function (v) {
      var n = rows.filter(function (r) { return viewMatches(I, v, r); }).length, on = viewOn(I, v);
      return '<button type="button" role="tab" class="cbl-vtab" data-view-tab="' + esc(v.key) + '" aria-selected="' + on + '" data-testid="' + esc(vt) + '-' + esc(v.key) + '"' + (v.tip ? ' title="' + esc(T(I, v.tip)) + '"' : '') + '>' + esc(T(I, v.label)) + ' <span class="n">' + n + '</span></button>';
    }).join('');
  }
  /* the filter behind a column heading: a small menu of that filter's own choices (the same state as Filters ▾) */
  function hfPop(I) {
    var fk = String(I.pop).slice(3), f = (I.o.filters || []).filter(function (x) { return x.key === fk; })[0]; if (!f) return '';
    var at = I.hfAt || { l: 8, t: 100 }, cur = I.r.filt[fk] || '';
    return '<div class="cbl-pop hf" role="menu" aria-label="' + esc(f.label || fk) + '" data-testid="cbl-hf-pop-' + esc(fk) + '" style="left:' + Math.round(at.l) + 'px;top:' + Math.round(at.t) + 'px">'
      + '<button type="button" role="menuitemradio" aria-checked="' + (!cur) + '" data-hfv="" data-hfk="' + esc(fk) + '">' + esc(f.all || T(I, 'Any')) + '</button>'
      + fopts(f).map(function (x) { return '<button type="button" role="menuitemradio" aria-checked="' + (cur === x.v) + '" data-hfv="' + esc(x.v) + '" data-hfk="' + esc(fk) + '" data-testid="cbl-hf-' + esc(fk) + '-' + esc(x.v) + '">' + esc(x.label) + '</button>'; }).join('') + '</div>';
  }
  function sortChoices(I) {
    var out = [], seen = {};
    (I.o.sorts || []).forEach(function (x) { out.push({ id: x.key, label: x.label || x.key }); seen[x.key] = 1; });
    columns(I).forEach(function (c) { var id = sortId(c); if (id && !seen[id]) { out.push({ id: id, label: c.label || c.key }); seen[id] = 1; } });
    return out;
  }
  function filtPop(I, sorts) {
    var R = I.r, st = I.s.sort, cur = st ? st.key : ((I.o.sorts || [])[0] && I.o.sorts[0].key);
    return '<div class="cbl-pop left" role="dialog" aria-label="' + esc(T(I, 'Filters')) + '" data-testid="cbl-filters-pop-' + esc(I.key) + '"><h4>' + esc(T(I, 'Filters')) + '</h4>'
      + (I.o.filters || []).map(function (f) {
        return '<div class="f"><span id="cbl-fl-' + esc(I.key) + '-' + esc(f.key) + '">' + esc(f.label || f.key) + '</span><select aria-labelledby="cbl-fl-' + esc(I.key) + '-' + esc(f.key) + '" data-filt="' + esc(f.key) + '" id="cbl-f-' + esc(I.key) + '-' + esc(f.key) + '" data-testid="listctl-filter-' + esc(f.key) + '"><option value="">' + esc(f.all || T(I, 'Any')) + '</option>'
          + fopts(f).map(function (x) { return '<option value="' + esc(x.v) + '"' + (R.filt[f.key] === x.v ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</select></div>';
      }).join('')
      + (sorts.length > 1 ? '<div class="f"><span id="cbl-sl-' + esc(I.key) + '">' + esc(T(I, 'Sort by')) + '</span><select aria-labelledby="cbl-sl-' + esc(I.key) + '" data-cbl-sort id="cbl-sort-' + esc(I.key) + '" data-testid="listctl-sort-' + esc(I.key) + '">' + sorts.map(function (x) { return '<option value="' + esc(x.id) + '"' + (cur === x.id ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</select></div>' : '')
      + '<div class="cbl-acts"><button type="button" class="cbl-btn" data-cbl-clearf>' + esc(T(I, 'Clear all')) + '</button></div></div>';
  }
  function colsPop(I) {
    var all = choosable(I), shown = shownKeys(I), by = {}, top = topKey(I); all.forEach(function (c) { by[c.key] = c; });
    var rest = all.filter(function (c) { return shown.indexOf(c.key) < 0; }), k = esc(I.key), nr = noRoomKeys(I);
    function row(c, i, on) {
      return '<div class="cbl-colrow">' + (on ? '<button type="button" class="cbl-mv" data-mv="' + esc(c.key) + '" data-d="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="' + esc(T(I, 'Move {x} left', { x: c.label })) + '" title="' + esc(T(I, 'Move {x} left', { x: c.label })) + '">←</button>' : '<span class="cbl-mvsp"></span>')
        + '<label' + (c.key === top ? ' title="' + esc(T(I, 'Always shown — it names the row')) + '"' : '') + '><input type="checkbox" data-col="' + esc(c.key) + '" data-testid="cols-' + k + '-' + esc(c.key) + '"' + (on ? ' checked' : '') + (c.key === top ? ' disabled' : '') + '> ' + esc(c.label || c.key) + (on && nr.indexOf(c.key) >= 0 ? ' <span class="cbl-noroom" data-testid="cols-noroom-' + esc(c.key) + '">' + esc(T(I, 'hidden — no room')) + '</span>' : '') + '</label>'
        + (on ? '<button type="button" class="cbl-mv" data-mv="' + esc(c.key) + '" data-d="1"' + (i === shown.length - 1 ? ' disabled' : '') + ' aria-label="' + esc(T(I, 'Move {x} right', { x: c.label })) + '" title="' + esc(T(I, 'Move {x} right', { x: c.label })) + '">→</button>' : '<span class="cbl-mvsp"></span>') + '</div>';
    }
    return '<div class="cbl-pop" role="dialog" aria-label="' + esc(T(I, 'Choose columns')) + '" data-testid="cols-menu-' + k + '"><h4>' + esc(T(I, 'Shown — in this order')) + '</h4>'
      + shown.map(function (kk, i) { return by[kk] ? row(by[kk], i, true) : ''; }).join('')
      + (rest.length ? '<h4>' + esc(T(I, 'Available')) + '</h4>' + rest.map(function (c) { return row(c, 0, false); }).join('') : '')
      + '<div class="cbl-acts"><button type="button" class="cbl-btn" data-cbl-resetcols data-testid="cols-reset-' + k + '">' + esc(T(I, 'Reset to the standard columns')) + '</button></div></div>';
  }

  /* the rows area: header (sticky) + rows, or one of the four states */
  function paintList(I) {
    var box = $(I, ':scope > .cbl-list');
    if (!box) { box = root.document.createElement('div'); box.className = 'cbl-list'; box.setAttribute('tabindex', '0'); box.setAttribute('data-cbl-part', 'list'); I.el.appendChild(box); }
    box.setAttribute('aria-label', T(I, 'Rows'));
    if (!box.__cblScroll) { box.__cblScroll = true; box.addEventListener('scroll', function () { if (I.o.onScroll) safe(function () { I.o.onScroll(box); }); }, { passive: true }); }
    I.card = box.clientWidth > 0 && box.clientWidth <= 620;
    if (!box.__cblRO && root.ResizeObserver) { box.__cblRO = new root.ResizeObserver(function () { if (I.dead) return; var c = box.clientWidth > 0 && box.clientWidth <= 620; if (c !== I.card) { paintTools(I); paintList(I); } }); try { box.__cblRO.observe(box); } catch (_) {} }
    var keepTop = box.scrollTop, o = I.o, R = I.r, s = I.s, cols = shownCols(I), tpl = template(I, cols);
    if (I.io) { try { I.io.disconnect(); } catch (_) {} I.io = null; }
    I.el.classList.toggle('tbllines', s.view === 'lines');
    var state = typeof o.state === 'function' ? o.state() : o.state;
    var hdr = headerHTML(I, cols, tpl, state === 'loading');
    var h = '';
    if (state === 'loading') { box.innerHTML = '<div class="cbl-grid" role="grid" aria-busy="true">' + (s.view === 'grid' ? hdr : '') + '</div>' + new Array(7).join('<div class="cbl-skel"></div>'); setHdrH(I, box); return; }
    if (state === 'error') {
      /* ⚠️ a caller may hand a plain SENTENCE (cap-finance did). A string has a native .sub() method (String.prototype.sub),
         so er.sub printed "function sub() { [native code] }" on screen. A string is the title; only an object has parts. */
      var er = val(o.error); er = (typeof er === 'string') ? { title: er } : (er || {});
      box.innerHTML = '<div class="cbl-state" role="alert" data-testid="cbl-error-' + esc(I.key) + '"><div class="big">' + esc(er.title || T(I, 'The list could not load.')) + '</div>' + esc(er.sub || T(I, 'Nothing was lost. Try again in a moment.')) + '<br><button type="button" class="cbl-btn" data-cbl-retry>' + esc(T(I, 'Try again')) + '</button></div>';
      return;
    }
    var m = matched(I), items = itemsOf(I, m.rows);
    if (!m.rows.length) {
      var narrowed = (R.q && String(R.q).trim()) || activeFilters(I).length;
      if (m.all.length && narrowed && !remote(I)) {
        box.innerHTML = '<div class="cbl-state" data-testid="cbl-nomatch-' + esc(I.key) + '"><div class="big">' + esc(T(I, 'Nothing matches.')) + '</div>' + esc(R.q ? '“' + R.q + '” ' + T(I, 'matches nothing here.') : T(I, 'These filters match nothing here.')) + '<br><button type="button" class="cbl-btn" data-cbl-clear>' + esc(T(I, 'Clear search and filters')) + '</button></div>';
      } else if (remote(I) && narrowed) {
        box.innerHTML = '<div class="cbl-state" data-testid="cbl-nomatch-' + esc(I.key) + '"><div class="big">' + esc(T(I, 'Nothing matches.')) + '</div>' + esc(R.q ? '“' + R.q + '” ' + T(I, 'matches nothing here.') : T(I, 'These filters match nothing here.')) + '<br><button type="button" class="cbl-btn" data-cbl-clear>' + esc(T(I, 'Clear search and filters')) + '</button></div>' + footHTML(I);
      } else {
        var em = val(o.empty); em = (typeof em === 'string') ? { title: em } : (em || {});   /* same trap as er above */
        box.innerHTML = '<div class="cbl-state" data-testid="cbl-empty-' + esc(I.key) + '"><div class="big">' + esc(em.title || T(I, 'Nothing recorded yet.')) + '</div>' + esc(em.sub || '') + '</div>' + footHTML(I);
      }
      return;
    }
    /* the rows that can be drawn: a collapsed group's rows are not among them (so a collapsed group never leaves a "show more" behind) */
    items = items.filter(function (x) { return x.group != null || !(x.g != null && R.gcol[x.g]); });
    var drawn = 0, zi = 0, total = items.filter(function (x) { return x.group == null; }).length, limit = I.limit;
    if (limit > total) limit = I.limit = Math.max(50, Math.min(limit, total));
    var body = '';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.group != null) {
        zi = 0;   /* the stripe starts again under each group head */
        var shut = !!R.gcol[it.gkey], gt = o.group && o.group.tid;
        body += '<div class="cbl-group" role="button" tabindex="0" aria-expanded="' + !shut + '" data-g="' + esc(it.gkey) + '"' + (gt || o.group.headTid ? ' data-testid="' + esc(o.group.headTid ? o.group.headTid(it.gkey) : gt + '-ghead-' + esc(it.gkey)) + '"' : '') + ' style="cursor:pointer"><span class="cbl-tw" aria-hidden="true">' + (shut ? '▸' : '▾') + '</span><b>' + esc(it.group) + '</b> <span class="fig"' + (gt ? ' data-testid="' + esc(gt) + '-gsum-' + esc(it.gkey) + '"' : '') + '>' + esc(it.fig) + '</span></div>';
        continue;
      }
      if (!remote(I) && drawn >= limit) break;
      drawn++;
      var zb = (zi++ % 2) === 1;   /* ZEBRA: the 2nd, 4th … data row of the list (or of its group) */
      body += s.view === 'grid' ? rowHTML(I, it, cols, tpl, zb) : lineHTML(I, it, cols, zb);
    }
    var end;
    if (!remote(I) && drawn < total) end = '<div class="cbl-end" data-cbl-sentinel data-testid="cbl-more-' + esc(I.key) + '"><button type="button" data-cbl-more>' + esc(T(I, '↓ Show {n} more', { n: Math.min(50, total - drawn) })) + '</button> <span>' + drawn + ' ' + esc(T(I, 'of')) + ' ' + total + '</span></div>';
    else end = remote(I) ? '' : '<div class="cbl-end" data-testid="cbl-end-' + esc(I.key) + '">' + total + ' · ' + esc(T(I, 'end of list')) + '</div>';
    box.innerHTML = '<div class="cbl-grid' + (s.view === 'lines' ? ' cbl-lines' : '') + '" role="grid" aria-rowcount="' + total + '">' + (s.view === 'grid' ? hdr : '') + body + '</div>' + end + footHTML(I);
    setHdrH(I, box);
    box.scrollTop = keepTop;
    if (!remote(I) && drawn < total) {
      var sent = box.querySelector('[data-cbl-sentinel]');
      if (sent && root.IntersectionObserver) {
        try { I.io = new root.IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { I.limit += 50; paintList(I); } }, { root: box, rootMargin: '0px' }); I.io.observe(sent); } catch (_) {}
      }
    }
    var cnt = $(I, '.cbl-count'); if (cnt) cnt.textContent = countText(I, m);
    resolveNext(I);
  }
  function footHTML(I) { var f = I.o.remote && I.o.remote.foot; var v = f ? safe(function () { return f(); }, '') : ''; return v ? '<div class="cbl-foot" data-testid="cbl-foot-' + esc(I.key) + '">' + v + '</div>' : ''; }
  function setHdrH(I, box) { var h = box.querySelector('.cbl-hdr'); box.style.setProperty('--cl-hdr-h', (h ? h.offsetHeight : 0) + 'px'); }

  function headerHTML(I, cols, tpl, plainHead) {
    var st = curSort(I);
    var lead = leadOn(I) ? '<div class="cbl-hc" role="columnheader" aria-label="' + esc(T(I, 'Select')) + '"></div>' : '';
    return '<div class="cbl-hdr lhead" role="row" style="grid-template-columns:' + tpl + '">' + lead + cols.map(function (c) {
      var id = sortId(c), sorted = !!(st && id && st.key === id), r = !!(c.num || c.pin === 'end'), label = esc(c.label || c.key);
      return '<div class="cbl-hc lhcell' + (r ? ' r' : '') + (id ? ' sortable' : '') + '" role="columnheader" aria-sort="' + (sorted ? (st.dir === -1 ? 'descending' : 'ascending') : 'none') + '">'
        + (id ? '<button type="button" class="sort"' + (plainHead ? ' disabled tabindex="-1"' : ' data-sort="' + esc(id) + '"') + '>' + label + ' <span class="arrow">' + (sorted ? (st.dir === -1 ? '▼' : '▲') : '⇅') + '</span></button>' : label)   /* the loading header keeps the SAME boxes (its buttons are just inert), so it does not change height when the rows arrive */
        + (c.hfilter && !remote(I) ? '<button type="button" class="cbl-hf' + (I.r.filt[c.hfilter] ? ' on' : '') + '"' + (plainHead ? ' disabled tabindex="-1"' : ' data-hf="' + esc(c.hfilter) + '"') + ' data-testid="cbl-hf-' + esc(c.hfilter) + '" aria-haspopup="menu" aria-expanded="' + (I.pop === 'hf:' + c.hfilter) + '" aria-label="' + esc(T(I, 'Filter {x}', { x: c.label || c.key })) + '" title="' + esc(T(I, 'Filter {x}', { x: c.label || c.key })) + '">' + (I.r.filt[c.hfilter] ? '●' : '▾') + '</button>' : '')
        + (plainHead ? '' : '<button type="button" class="cbl-rz colrz" data-rz="' + esc(c.key) + '" aria-label="' + esc(T(I, 'Resize {x} column (arrow keys)', { x: c.label || c.key })) + '" title="' + esc(T(I, 'Drag to resize · double-click resets')) + '"></button>') + '</div>';
    }).join('') + '</div>';
  }
  function cellOf(I, c, row) { var v = safe(function () { return c.cell ? c.cell(row) : row[c.key]; }, ''); if (v == null) v = ''; return c.html ? String(v) : esc(v); }
  function rowAttrs(I, row, id) {
    var a = '', o = I.o, at = o.rowAttrs ? safe(function () { return o.rowAttrs(row); }, null) : null;
    if (at) Object.keys(at).forEach(function (k) { if (/^[a-z][a-z0-9\-]*$/i.test(k) && !/^on/i.test(k)) a += ' ' + k + '="' + esc(at[k]) + '"'; });
    var tid = o.rowTid ? safe(function () { return o.rowTid(row); }, '') : '';
    return (tid ? ' data-testid="' + esc(tid) + '"' : '') + a;
  }
  function rowHTML(I, it, cols, tpl, zb) {
    var row = it.row, id = it.id, R = I.r, nx = hasNext(I), open = nx && isOpen(I, id), o = I.o;
    var cls = (o.rowClass ? safe(function () { return o.rowClass(row); }, '') : '') + (R.hl === id && o.hl !== false ? ' sel' : '') + (zb ? ' z' : '') + (it.g != null ? ' ing' : '');
    var cells = cols.map(function (c, i) {
      var amt = c.pin === 'end';
      return '<div class="cbl-cell lcell' + (i === 0 ? ' first' : '') + (amt ? ' r mono strong amt' : '') + (c.num && !amt ? ' r mono' : '') + (c.mono ? ' mono' : '') + '" data-l="' + esc(i === 0 ? '' : (c.label || '')) + '" role="gridcell"'
        + (c.tid ? ' data-testid="' + esc(safe(function () { return c.tid(row); }, '')) + '"' : '') + '>'
        + (i === 0 && nx ? '<span class="cbl-tw" data-caret role="button" aria-label="' + esc(T(I, open ? 'Collapse' : 'Expand')) + '" aria-expanded="' + !!open + '">▸</span>' : '') + cellOf(I, c, row) + '</div>';
    }).join('');
    var lead = leadOn(I) ? '<div class="cbl-lead" role="gridcell">' + leadCell(I, row, id) + '</div>' : '';
    var out = '<div class="cbl-row lrow grow' + (open ? ' cbl-open open' : '') + (cls ? ' ' + esc(cls) : '') + '" role="row" data-row="' + esc(id) + '" tabindex="0"' + (nx ? ' aria-expanded="' + !!open + '"' : '') + ' style="grid-template-columns:' + tpl + '"' + rowAttrs(I, row, id) + '>' + lead + cells + '</div>';
    if (open) out += nextHTML(I, row, id);
    return out;
  }
  function leadCell(I, row, id) {
    if (I.o.lead && safe(function () { return I.o.lead.on(); }, false)) return safe(function () { return I.o.lead.cell(row); }, '');
    return '<input type="checkbox" data-selrow="' + esc(id) + '"' + (I.r.sel[id] ? ' checked' : '') + ' aria-label="' + esc(T(I, 'Select')) + '">';
  }
  function lineHTML(I, it, cols, zb) {
    var row = it.row, id = it.id, nx = hasNext(I), open = nx && isOpen(I, id), o = I.o, pin = cols.filter(function (c) { return c.pin === 'end'; })[0];
    var cls = (o.rowClass ? safe(function () { return o.rowClass(row); }, '') : '') + (I.r.hl === id && o.hl !== false ? ' sel' : '') + (zb ? ' z' : '') + (it.g != null ? ' ing' : '');
    var flow = cols.filter(function (c) { return c.pin !== 'end'; }).map(function (c) {
      var v = cellOf(I, c, row), t = plain(v);
      if (!t || t === '—') return '';
      return '<span class="cbl-fl lcell' + (c.mono ? ' cbl-num' : '') + '" data-l="' + esc(c.label || '') + '"' + (c.tid ? ' data-testid="' + esc(safe(function () { return c.tid(row); }, '')) + '"' : '') + '>' + v + '</span>';
    }).join('');
    var gist = o.gist ? safe(function () { return o.gist(row); }, '') : '';
    var lead = leadOn(I) ? '<span class="cbl-lead" style="padding:0 8px 0 0">' + leadCell(I, row, id) + '</span>' : '';
    var out = '<div class="cbl-lrec lrow' + (open ? ' cbl-open open' : '') + (cls ? ' ' + esc(cls) : '') + '" role="row" data-row="' + esc(id) + '" tabindex="0"' + (nx ? ' aria-expanded="' + !!open + '"' : '') + rowAttrs(I, row, id) + '><div class="cbl-lline">' + lead
      + (nx ? '<span class="cbl-tw" data-caret role="button" aria-label="' + esc(T(I, open ? 'Collapse' : 'Expand')) + '" aria-expanded="' + !!open + '">▸</span>' : '') + '<span class="cbl-lflow">' + flow + '</span>'
      + (pin ? '<span class="cbl-lamt">' + cellOf(I, pin, row) + '</span>' : '') + '</div>' + (gist ? '<div class="cbl-lgist"' + (o.gistTid ? ' data-testid="' + esc(o.gistTid(row)) + '"' : '') + '>' + esc(gist) + '</div>' : '') + '</div>';
    if (open) out += nextHTML(I, row, id);
    return out;
  }
  /* what a row opens to: the page's markup (trusted by contract), then the row actions the unit draws itself */
  function nextHTML(I, row, id) {
    var o = I.o, inner = '';
    if (o.next) {
      if (I.nextCache[id] !== undefined) inner = I.nextCache[id];
      else {
        var v = safe(function () { return o.next(row, { view: I.s.view, id: id }); }, '');
        if (v && typeof v.then === 'function') {
          inner = o.nextPending ? safe(function () { return o.nextPending(row); }, '') : '<span class="cbl-dim">' + esc(T(I, 'Reading…')) + '</span>';   /* nextPending: the card's own shape while its answer is on the way, so it does not change height */
          I.pending = I.pending || {}; I.pending[id] = v;
        } else { inner = v == null ? '' : String(v); }
      }
    }
    var acts = (o.actions || []).filter(function (a) { return !a.when || safe(function () { return a.when(row); }, true); });
    return '<div class="cbl-next" role="row" data-next="' + esc(id) + '"><div role="cell">' + inner + '</div>'
      + (acts.length ? '<div class="cbl-acts">' + acts.map(function (a) {
        var why = a.why ? safe(function () { return a.why(row); }, '') : '';   /* the page asks the server's answer for this login; a sentence = refused, shown greyed with it */
        var btn = '<button type="button" class="cbl-btn" data-act="' + esc(a.id) + '" data-actrow="' + esc(id) + '"' + (a.tid ? ' data-testid="' + esc(a.tid) + '"' : '') + (why ? ' disabled aria-disabled="true" title="' + esc(why) + '"' : '') + '>' + (a.icon ? esc(a.icon) + ' ' : '') + esc(T(I, a.label)) + '</button>';
        return why ? '<span class="cbl-act">' + btn + '<span class="cbl-why"' + (a.tid ? ' data-testid="' + esc(a.tid) + '-why"' : '') + '>' + esc(why) + '</span></span>' : btn;
      }).join('') + '</div>' : '') + '</div>';
  }
  function resolveNext(I) {
    var p = I.pending; if (!p) return; I.pending = null;
    Object.keys(p).forEach(function (id) {
      p[id].then(function (html) {
        I.nextCache[id] = html == null ? '' : String(html);
        if (I.dead) return;
        var n = I.el.querySelector('.cbl-next[data-next="' + (root.CSS && root.CSS.escape ? root.CSS.escape(id) : id) + '"] > div'); if (n) n.innerHTML = I.nextCache[id];
      }, function () { I.nextCache[id] = '<span class="cbl-dim">' + esc(T(I, 'The list could not load.')) + '</span>'; if (!I.dead) paintList(I); });
    });
  }
  function selectedRows(I) { var ids = I.r.sel; return allRows(I).filter(function (r, i) { return ids[rid(I, r, i)]; }); }

  /* the rows area fills the rest of the window: from its top edge to the bottom of the viewport, recalculated on resize */
  function fit(I) {
    if (I.o.fill === false || !I.el.getBoundingClientRect) return;
    var top = I.el.getBoundingClientRect().top, h = Math.max(300, Math.floor(root.innerHeight - top - (I.o.bottom == null ? 8 : I.o.bottom)));
    I.el.style.height = h + 'px';
  }

  /* ═════ actions ═════ */
  function persistRepaint(I, whole) { saveChoices(I); if (whole) paintAll(I); else paintList(I); }
  function resetLimit(I) { I.limit = 50; }
  function query(I, why, sort, now) {
    if (!remote(I)) return false;
    clearTimeout(I.qt);
    var go = function () { safe(function () { I.o.remote.onQuery({ why: why || 'search', q: I.r.q, filt: JSON.parse(JSON.stringify(I.r.filt)), sort: sort || curSort(I), group: I.s.group }); }); };
    if (now) go(); else I.qt = setTimeout(go, 250);
    return true;
  }
  function refresh(I, x) {
    if (I.dead) return;
    if (Array.isArray(x)) I.o.rows = x;
    else if (x && typeof x === 'object') { Object.keys(x).forEach(function (k) { if (k === 'remote' && I.o.remote) Object.assign(I.o.remote, x.remote); else I.o[k] = x[k]; }); }
    I.nextCache = {};
    paintAll(I);
  }
  function setQ(I, v) { I.r.q = v; resetLimit(I); if (query(I)) { var c = $(I, '.cbl-count'); return; } paintList(I); }
  function toggleRow(I, id, focus) {
    var R = I.r; R.hl = id;
    if (R.allOpen) R.open[id + '#closed'] = !R.open[id + '#closed']; else R.open[id] = !R.open[id];
    var keep = I.el.querySelector('.cbl-list'), top = keep ? keep.scrollTop : 0;
    paintList(I); if (keep) { var k2 = $(I, ':scope > .cbl-list'); if (k2) k2.scrollTop = top; }
    if (focus) refocusRow(I, id);
  }
  function refocusRow(I, id) { var n = I.el.querySelector('[data-row="' + (root.CSS && root.CSS.escape ? root.CSS.escape(id) : id) + '"]'); if (n) n.focus(); }
  function rowById(I, id) { var all = allRows(I), r = null; all.forEach(function (x, i) { if (r == null && rid(I, x, i) === id) r = x; }); return r; }
  function openRow(I, id, ev) {
    var row = rowById(I, id); if (!row) return;
    I.r.hl = id;
    if (I.o.onOpen) { safe(function () { I.o.onOpen(row, ev); }); return; }
    if (hasNext(I)) toggleRow(I, id, ev && ev.type === 'keydown');
  }
  function closePop(I, refocus) {
    if (!I.pop) return; var was = I.pop; I.pop = null; I.pv = null; paintTitle(I); paintTools(I);
    if (refocus) { var b = I.el.querySelector('[data-cbl-pop="' + was + '"]'); if (b) b.focus(); }
  }
  function togglePop(I, name) { I.pop = I.pop === name ? null : name; paintTitle(I); paintTools(I); var pop = I.el.querySelector('.cbl-pop'); if (pop) { var f = pop.querySelector('select,input:not([disabled]),button:not([disabled])'); if (f && name !== 'period') f.focus(); } }

  function csv(I) {
    var m = matched(I), cols = shownCols(I);
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [cols.map(function (c) { return q(c.label || c.key); }).join(',')];
    m.rows.forEach(function (r) { lines.push(cols.map(function (c) { var v = safe(function () { return c.cell ? c.cell(r) : r[c.key]; }, ''); return q(c.html ? plain(v) : v); }).join(',')); });
    return lines.join('\r\n');
  }
  function download(I) {
    if (typeof I.o.csv === 'function') { safe(function () { I.o.csv(matched(I).rows, shownCols(I), csv(I)); }); return; }
    try {
      var b = new root.Blob(['﻿' + csv(I)], { type: 'text/csv;charset=utf-8' }), u = root.URL.createObjectURL(b), a = root.document.createElement('a');
      a.href = u; a.download = I.key + '.csv'; root.document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { root.URL.revokeObjectURL(u); }, 2000);
    } catch (_) {}
  }

  /* ═════ events: one set of delegated listeners on the mount element, so it dies with it ═════ */
  function wire(I) {
    var el = I.el;
    /* every listener is remembered so teardown can remove it: a list mounted again on the same element must not leave the old one answering too */
    I.off = [];
    var on = function (type, fn) { var h = function (ev) { if (!I.dead) fn(ev); }; el.addEventListener(type, h); I.off.push([type, h]); };
    on('click', function (ev) { onClick(I, ev); });
    on('input', function (ev) { var t = ev.target; if (t.hasAttribute && t.hasAttribute('data-cbl-q')) { setQ(I, t.value); } });
    on('change', function (ev) { onChange(I, ev); });
    on('keydown', function (ev) { onKey(I, ev); });
    on('pointerdown', function (ev) { onPointerDown(I, ev); });
    on('dblclick', function (ev) { var b = ev.target.closest && ev.target.closest('[data-rz]'); if (!b) return; delete I.s.widths[b.getAttribute('data-rz')]; saveChoices(I); paintList(I); refocusRz(I, b.getAttribute('data-rz')); });
  }
  function refocusRz(I, k) { var b = I.el.querySelector('[data-rz="' + k + '"]'); if (b) b.focus(); }
  function onClick(I, ev) {
    var t = ev.target; if (!t.closest) return;
    var b = t.closest('button,[data-row],input[type=checkbox],select'), R = I.r, s = I.s, o = I.o;
    var pop = t.closest('.cbl-pop');
    var hcell = t.closest('.cbl-hc');
    if (hcell && !t.closest('.cbl-rz') && !t.closest('[data-sort]') && !t.closest('[data-hf]') && I.el.contains(hcell)) { var sbtn = hcell.querySelector('[data-sort]'); if (sbtn) { sbtn.click(); return; } }
    var gh = t.closest('[data-g]');
    if (gh && I.el.contains(gh) && !(b && b.hasAttribute('data-row'))) { if (I.pop) { I.pop = null; paintTitle(I); paintTools(I); } R.gcol[gh.getAttribute('data-g')] = !R.gcol[gh.getAttribute('data-g')]; paintList(I); var g2 = I.el.querySelector('[data-g="' + cssId(gh.getAttribute('data-g')) + '"]'); if (g2) g2.focus(); return; }
    if (!b) { if (I.pop && !pop) closePop(I); return; }
    if (b.hasAttribute('data-rz')) return;
    if (b.hasAttribute('data-cbl-pop')) { togglePop(I, b.getAttribute('data-cbl-pop')); return; }
    if (b.hasAttribute('data-hf')) {
      var er = I.el.getBoundingClientRect(), br = b.getBoundingClientRect();
      I.hfAt = { l: Math.max(4, Math.min(br.left - er.left, er.width - 190)), t: br.bottom - er.top + 4 };
      togglePop(I, 'hf:' + b.getAttribute('data-hf')); paintList(I); return;
    }
    if (b.hasAttribute('data-hfv')) {
      var hk = b.getAttribute('data-hfk'), hv = b.getAttribute('data-hfv');
      if (hv) R.filt[hk] = hv; else delete R.filt[hk];
      I.pop = null; resetLimit(I); if (query(I)) { paintTools(I); paintList(I); } else paintAll(I); return;
    }
    if (b.hasAttribute('data-view-tab')) {
      var vw = ((o.views && o.views.items) || []).filter(function (x) { return x.key === b.getAttribute('data-view-tab'); })[0];
      if (vw) { R.filt = {}; Object.keys(vw.filt || {}).forEach(function (fk) { R.filt[fk] = vw.filt[fk]; }); I.pop = null; resetLimit(I); paintAll(I); }
      return;
    }
    if (I.pop && !pop) { /* any other click outside the popover closes it, then does its own job */ I.pop = null; paintTitle(I); paintTools(I); }
    var d = b.dataset || {};
    if (b.hasAttribute('data-period')) { var pp = head(I).period; if (pp) { I.pv = d.period; if (d.period !== 'custom') { I.pop = null; I.pv = null; } safe(function () { pp.onPick(d.period, null); }); paintTitle(I); paintTools(I); } return; }
    if (d.notice != null) { var n = (head(I).notices || [])[+d.notice]; if (I.pop === 'notes') { I.pop = null; paintTitle(I); } if (n && n.onOpen) safe(function () { n.onOpen(); }); return; }
    if (d.group) { s.group = d.group; resetLimit(I); saveChoices(I); if (!query(I)) { paintTools(I); paintList(I); } else paintTools(I); return; }
    if (d.view) { s.view = d.view; saveChoices(I); paintTools(I); paintList(I); return; }
    if (b.hasAttribute('data-cbl-exp')) { R.allOpen = !R.allOpen; R.open = {}; paintTools(I); paintList(I); return; }
    if (b.hasAttribute('data-cbl-csv')) { download(I); return; }
    if (d.unfilt) { delete R.filt[d.unfilt]; resetLimit(I); if (query(I)) paintTools(I); else paintAll(I); return; }
    if (b.hasAttribute('data-cbl-clearf')) { R.filt = {}; resetLimit(I); I.pop = null; if (query(I)) paintTools(I); else paintAll(I); return; }
    if (b.hasAttribute('data-cbl-clear')) { R.filt = {}; R.q = ''; I.pop = null; resetLimit(I); if (query(I)) paintTools(I); paintAll(I); return; }
    if (b.hasAttribute('data-cbl-retry')) { if (o.onRetry) safe(function () { o.onRetry(); }); return; }
    if (b.hasAttribute('data-cbl-more')) { I.limit += 50; paintList(I); return; }
    if (b.hasAttribute('data-cbl-resetcols')) { s.cols = null; s.widths = {}; saveChoices(I); paintTools(I); paintList(I); return; }
    if (b.hasAttribute('data-cbl-selmode')) { R.selMode = !R.selMode; if (!R.selMode) R.sel = {}; paintTools(I); paintList(I); return; }
    if (b.hasAttribute('data-cbl-selall')) { matched(I).rows.forEach(function (r, i) { R.sel[rid(I, r, i)] = true; }); paintTools(I); paintList(I); return; }
    if (d.bulk) { var bk = (o.bulk || []).filter(function (x) { return x.id === d.bulk; })[0]; if (bk) safe(function () { bk.run(selectedRows(I)); }); return; }
    if (d.mv) { var set = shownKeys(I).slice(), i = set.indexOf(d.mv), j = i + (+d.d); if (i < 0 || j < 0 || j >= set.length) return; set.splice(j, 0, set.splice(i, 1)[0]); s.cols = set; saveChoices(I); paintTools(I); paintList(I); return; }
    if (d.col) return;   /* the checkbox acts on 'change' */
    if (d.sort) {
      /* a server-sorted page decides its own direction: it is told which heading was clicked */
      if (remote(I)) { query(I, 'sort', { key: d.sort }, true); return; }
      var cur = curSort(I), col = columns(I).filter(function (c) { return sortId(c) === d.sort; })[0], d0 = col && col.dir0 === -1 ? -1 : 1;
      s.sort = cur && cur.key === d.sort ? { key: d.sort, dir: -cur.dir } : { key: d.sort, dir: d0 }; resetLimit(I); saveChoices(I); paintList(I); return;
    }
    if (d.act) {
      var act = (o.actions || []).filter(function (x) { return x.id === d.act; })[0], row = rowById(I, d.actrow); if (act && row) safe(function () { act.run(row); });
      return;
    }
    if (b.hasAttribute('data-selrow')) { return; }
    if (b.hasAttribute('data-caret') || t.closest('[data-caret]')) { var rr = t.closest('[data-row]'); if (rr) toggleRow(I, rr.getAttribute('data-row'), false); return; }
    var rowEl = t.closest('[data-row]');
    if (rowEl && b === rowEl) {
      /* a control the page drew inside a cell (a link, a chip, a button with its own onclick) keeps its own job */
      var inner = t.closest('a,button,input,select,textarea,label,[onclick],[data-nolist]');
      if (inner && inner !== rowEl && rowEl.contains(inner)) return;
      openRow(I, rowEl.getAttribute('data-row'), ev);
    }
  }
  function onChange(I, ev) {
    var t = ev.target, R = I.r, s = I.s;
    if (t.hasAttribute('data-col')) {
      var k = t.getAttribute('data-col'), set = shownKeys(I).slice(), i = set.indexOf(k);
      if (t.checked && i < 0) set.push(k); else if (!t.checked && i >= 0 && k !== topKey(I)) set.splice(i, 1);
      s.cols = set; saveChoices(I); paintTools(I); paintList(I); refocusCol(I, k); return;
    }
    if (t.hasAttribute('data-gsel')) { s.group = t.value; resetLimit(I); saveChoices(I); if (!query(I)) { paintTools(I); paintList(I); } else paintTools(I); var gs = I.el.querySelector('#cbl-gsel-' + cssId(I.key)); if (gs) gs.focus(); return; }
    if (t.hasAttribute('data-filt')) { var fk = t.getAttribute('data-filt'); if (t.value) R.filt[fk] = t.value; else delete R.filt[fk]; resetLimit(I); if (!query(I)) { paintTools(I); paintList(I); } else paintTools(I); var f = I.el.querySelector('#cbl-f-' + cssId(I.key) + '-' + cssId(fk)); if (f) f.focus(); return; }
    if (t.hasAttribute('data-cbl-sort')) { var cur = s.sort ? s.sort.dir : 1; s.sort = { key: t.value, dir: 1 }; resetLimit(I); saveChoices(I); if (!query(I)) { paintTools(I); paintList(I); } var ss = I.el.querySelector('#cbl-sort-' + cssId(I.key)); if (ss) ss.focus(); return; }
    if (t.hasAttribute('data-selrow')) { var id = t.getAttribute('data-selrow'); if (t.checked) R.sel[id] = true; else delete R.sel[id]; paintTools(I); return; }
    if (t.hasAttribute('data-cbl-from') || t.hasAttribute('data-cbl-to')) {
      var p = head(I).period, fr = I.el.querySelector('[data-cbl-from]'), to = I.el.querySelector('[data-cbl-to]');
      if (p && fr && to && fr.value && to.value) { p.custom = { from: fr.value, to: to.value }; I.pv = null; I.pop = null; safe(function () { p.onPick('custom', p.custom); }); }
    }
  }
  function cssId(s) { return String(s).replace(/[^A-Za-z0-9_\-]/g, '\\$&'); }
  function refocusCol(I, k) { var c = I.el.querySelector('[data-col="' + k + '"]'); if (c) c.focus(); }

  function onKey(I, ev) {
    var t = ev.target, k = ev.key;
    if (k === 'Escape' && I.pop) { ev.preventDefault(); closePop(I, true); return; }
    if (t.hasAttribute && t.hasAttribute('data-rz') && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      ev.preventDefault();
      var rtl = root.getComputedStyle(I.el).direction === 'rtl', dlt = (k === 'ArrowRight' ? 8 : -8) * (rtl ? -1 : 1);
      resize(I, t.getAttribute('data-rz'), dlt, true); return;
    }
    if (t.hasAttribute && t.hasAttribute('data-g') && (k === 'Enter' || k === ' ')) { ev.preventDefault(); t.click(); return; }
    var rowEl = t.closest && t.closest('[data-row]');
    if (rowEl && t === rowEl) {
      if (k === 'Enter' || k === ' ') { ev.preventDefault(); openRow(I, rowEl.getAttribute('data-row'), ev); return; }
      if (k === 'ArrowRight' && hasNext(I) && !isOpen(I, rowEl.getAttribute('data-row'))) { ev.preventDefault(); toggleRow(I, rowEl.getAttribute('data-row'), true); return; }
      if (k === 'ArrowLeft' && hasNext(I) && isOpen(I, rowEl.getAttribute('data-row'))) { ev.preventDefault(); toggleRow(I, rowEl.getAttribute('data-row'), true); return; }
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        ev.preventDefault();
        var all = [].slice.call(I.el.querySelectorAll('[data-row]')), i = all.indexOf(rowEl), nx = all[i + (k === 'ArrowDown' ? 1 : -1)];
        if (nx) { nx.focus(); if (I.o.hl === false) return; I.r.hl = nx.getAttribute('data-row'); [].forEach.call(I.el.querySelectorAll('.cbl-row.sel,.cbl-lrec.sel'), function (n) { n.classList.remove('sel'); }); nx.classList.add('sel'); }
      }
    }
  }

  /* adjustable columns: pointer (mouse and touch), ← → in 8 px, double-click resets; never narrower than the label; remembered */
  function colByKey(I, key) { return columns(I).filter(function (c) { return c.key === key; })[0]; }
  function resize(I, key, delta, kb) {
    var c = colByKey(I, key); if (!c) return;
    I.s.widths[key] = Math.max(minW(I, c), widthOf(I, c) + delta);
    saveChoices(I); paintList(I); if (kb) refocusRz(I, key);
  }
  function applyTpl(I) {
    var tpl = template(I, shownCols(I));
    [].forEach.call(I.el.querySelectorAll('.cbl-hdr,.cbl-row'), function (n) { n.style.gridTemplateColumns = tpl; });
  }
  function onPointerDown(I, ev) {
    var b = ev.target.closest && ev.target.closest('[data-rz]'); if (!b) return;
    var c = colByKey(I, b.getAttribute('data-rz')); if (!c) return;
    ev.preventDefault();
    DRAG = { I: I, key: c.key, x: ev.clientX, w: widthOf(I, c), c: c, btn: b };
    b.classList.add('drag');
    try { b.setPointerCapture(ev.pointerId); } catch (_) {}
    root.document.addEventListener('pointermove', onPointerMove);
    root.document.addEventListener('pointerup', onPointerUp);
    root.document.addEventListener('pointercancel', onPointerUp);
  }
  function onPointerMove(ev) {
    if (!DRAG) return; var I = DRAG.I, rtl = root.getComputedStyle(I.el).direction === 'rtl';
    I.s.widths[DRAG.key] = Math.max(minW(I, DRAG.c), DRAG.w + (ev.clientX - DRAG.x) * (rtl ? -1 : 1));
    applyTpl(I);
  }
  function onPointerUp() {
    if (!DRAG) return; var I = DRAG.I;
    DRAG.btn.classList.remove('drag');
    root.document.removeEventListener('pointermove', onPointerMove);
    root.document.removeEventListener('pointerup', onPointerUp);
    root.document.removeEventListener('pointercancel', onPointerUp);
    DRAG = null; saveChoices(I);
  }

  /* one document-level listener each: a click anywhere outside a mounted list closes its popover; a resize refits every list to its window */
  if (root.document && root.document.addEventListener) {
    root.document.addEventListener('click', function (ev) {
      if (ev.target && ev.target.isConnected === false) return;   /* the click repainted its own button away: that was a click INSIDE the list */
      INST.forEach(function (I) { if (I.pop && !I.dead && !I.el.contains(ev.target)) closePop(I); });
    });
    /* ↑ ↓ move the highlighted row and Enter opens it, wherever the focus is not (a page with a list on it, nothing focused): the page does not wire this */
    root.document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { var open = INST.filter(function (I) { return !I.dead && I.pop; }); if (open.length) { ev.preventDefault(); closePop(open[open.length - 1], true); return; } }
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp' && ev.key !== 'Enter') return;
      if (ev.defaultPrevented) return;   /* a list's own handler already took it (and may have repainted its target away) */
      var t = ev.target;
      if (t && t.isConnected === false) return;
      if (t && t.tagName && /^(INPUT|SELECT|TEXTAREA|BUTTON|A|SUMMARY)$/.test(t.tagName)) return;
      if (t && t.closest && (t.closest('[data-cbl] [data-row]') || t.closest('dialog[open],[role=dialog],[aria-modal=true]'))) return;
      var live = INST.filter(function (I) { return !I.dead && I.o.hl !== false && I.el.getClientRects().length; }), I = live[live.length - 1];
      if (!I) return;
      var rows = [].slice.call(I.el.querySelectorAll('[data-row]')); if (!rows.length) return;
      if (ev.key === 'Enter') { if (I.r.hl) { ev.preventDefault(); openRow(I, I.r.hl, ev); } return; }
      var at = rows.map(function (r) { return r.getAttribute('data-row'); }).indexOf(I.r.hl);
      at = ev.key === 'ArrowDown' ? Math.min(rows.length - 1, at + 1) : Math.max(0, at < 0 ? 0 : at - 1);
      ev.preventDefault(); I.r.hl = rows[at].getAttribute('data-row');
      rows.forEach(function (r, i) { r.classList.toggle('sel', i === at); });
      if (rows[at].scrollIntoView) rows[at].scrollIntoView({ block: 'nearest' });
    });
    root.addEventListener('resize', function () { prune(); INST.forEach(function (I) { fit(I); setHdrH(I, I.el.querySelector('.cbl-list') || I.el); var n = I.el.clientWidth > 0 && I.el.clientWidth <= 640; if (n !== I.narrow) paintTitle(I); }); });
  }

  /* the rows a next level is made of: the first cell takes the room, the others are fixed-width and right-aligned (cells are the page's own trusted markup) */
  function nextRow(cells, widths) {
    return '<div class="cbl-nrow" style="display:flex;align-items:center;font-size:calc(13.5px * var(--k,1));padding:3px 0">' + cells.map(function (c, i) {
      return i === 0 ? '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + c + '</span>'
        : '<span style="width:' + ((widths && widths[i - 1]) || 110) + 'px;text-align:end">' + c + '</span>';
    }).join('') + '</div>';
  }
  function get(key) { prune(); var f = null; INST.forEach(function (I) { if (I.key === String(key) && !I.dead) f = I.api; }); return f; }

  /* forget what a person typed, chose and opened in list `key` (a different record is on screen under the same list: a new ledger, the other tab) */
  function reset(key) { delete STATE[String(key)]; }

  root.CBList = { mount: mount, nextRow: nextRow, get: get, reset: reset };
})(typeof window !== 'undefined' ? window : this);
