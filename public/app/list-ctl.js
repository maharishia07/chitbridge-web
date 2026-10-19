/**
 * CALLED BY every list on every page — app.html (the Task table), crm, accounts, finance, standards, employees, network (CBList.mount · CBList.every).
 * CARD 29-qa-test-tooling-ux-locale-and-design-system/list-control
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
 *                      head:{ title, period, notices, slot(el) }, t, store, ... }) → { refresh, destroy, state, open(id, on) }
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
 * SAVED VIEWS (T3-COMPAT): `views:{ items:[{ key, label, filt, tip, rows? }], tid, inTitle }` — a tab sets the list's own filters. STD-COMPARE
 * (2026-10-15): a view may carry its OWN rows (`rows: () => [...]`, a second data file mapped onto its own columns): while that tab is lit — its
 * `filt` in force, other filters may be added — the unit draws those rows instead of the mount's, and the tab counts them. A view without `rows`
 * is unchanged: a filter over the mount's rows, lit only when the filters are exactly its own.
 *
 * SERVER-PAGED LISTS (Platform): pass `remote:{ total, onQuery(q), foot() }`. The unit then neither filters nor sorts: it draws
 * the page it was given in its own look, asks the page's pager for the next one through `onQuery`, and paints `foot()` below.
 *   `remote.filters: true` (T3) also draws the Filters control: each choice is handed to `onQuery` ({ filt, sort }), never applied here.
 */
(function (root) {
  'use strict';
  if (root.CBList) return;

  /* ── its own words: every string is written here in English and goes through the host's translator (opts.t) when one is given (see T) ── */
  /* ── its own escaping ── the ONE esc's twin, kept on purpose: CBList is a self-contained unit (e2e/list-unit.cjs proves it reads nothing from its page);
     e2e/prim-homes.cjs allows exactly this copy, and it escapes what app/helpers.js esc does (& < > " ') */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function plain(h) {
    return String(h == null ? '' : h)
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ── its own memory: browser storage under its own prefix, an in-memory fallback when storage throws ── */
  var MEM = {};
  function lsGet(k) {
    try {
      var v = root.localStorage.getItem(k);
      return v == null ? null : JSON.parse(v);
    } catch (_) {
      return MEM[k] === undefined ? null : MEM[k];
    }
  }
  function lsSet(k, v) {
    MEM[k] = v;
    try {
      root.localStorage.setItem(k, JSON.stringify(v));
    } catch (_) {}
  }

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
    '.cbl .cbl-title .cbl-views.in-title{padding:0;background:none;overflow:visible;flex-wrap:wrap}',
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
    /* T3-COMPAT: the LAST column's handle stays inside the grid — hung 4 px past its edge it gave every filled list a 4 px sideways scroll (rule 13) */
    '.cbl .cbl-hc:last-child > .cbl-rz{inset-inline-end:0}',
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
    var node = d.createElement('style');
    node.id = 'cblist_css';
    node.textContent = CSS.replace(/\.cbl(?![\w-])/g, '.cbl:not(#_)');
    d.head.appendChild(node);
  }

  /* ── small helpers ── */
  function px(w, dflt) {
    if (typeof w === 'number') return w;
    var m = /(\d+(?:\.\d+)?)\s*px/.exec(String(w || ''));
    return m ? parseFloat(m[1]) : dflt || 140;
  }
  function val(x) {
    return typeof x === 'function' ? safe(x, undefined) : x;
  }
  function safe(fn, dflt) {
    try {
      var v = fn();
      return v === undefined ? dflt : v;
    } catch (_) {
      return dflt;
    }
  }
  function cmpVals(a, b) {
    var na = typeof a === 'number' ? a : parseFloat(String(a).replace(/[^\d.\-]/g, '')),
      nb = typeof b === 'number' ? b : parseFloat(String(b).replace(/[^\d.\-]/g, ''));
    if (typeof a === 'number' || (isFinite(na) && isFinite(nb) && /^[\s\d.,\-−₹$€£]+$/.test(String(a)) && /^[\s\d.,\-−₹$€£]+$/.test(String(b)))) {
      return (na || 0) - (nb || 0);
    }
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }

  var INST = []; /* every live mount; pruned when its element leaves the document */
  var STATE = {}; /* key → the choices that must survive a repaint (search, filters, open rows) */
  var DRAG = null;

  function prune() {
    INST = INST.filter(function (item) {
      if (item.dead) return false;
      if (!root.document.documentElement.contains(item.el)) {
        teardown(item);
        return false;
      }
      return true;
    });
  }
  function teardown(I) {
    I.dead = true;
    try {
      if (I.io) I.io.disconnect();
    } catch (_) {}
    clearTimeout(I.qt);
    try {
      var node = I.el.querySelector(':scope > .cbl-list');
      if (node && node.__cblRO) node.__cblRO.disconnect();
    } catch (_) {}
    (I.off || []).forEach(function (x) {
      try {
        I.el.removeEventListener(x[0], x[1]);
      } catch (_) {}
    });
    I.off = [];
  }

  /* ═════ MOUNT ═════ */
  function mount(el, o) {
    if (!el || !o) return null;
    injectCss();
    prune();
    var key = String(o.key || el.id || 'list');
    el.innerHTML = '';
    if (el.__cbl) {
      teardown(el.__cbl);
      INST = INST.filter(function (x) {
        return x !== el.__cbl;
      });
    }
    var I = { el: el, o: o, key: key, pop: null, limit: 50, nextCache: {}, dead: false };
    var R = STATE[key] || (STATE[key] = { q: '', filt: {}, open: {}, allOpen: false, sel: {}, selMode: false, gcol: {}, hl: null });
    I.r = R;
    /* a host may open the list already narrowed (a link from another page: Home's Suppliers -> the CRM list of suppliers): opts.preset = { filt:{ key: value } } replaces the remembered filters */
    if (o.preset && o.preset.filt) {
      R.filt = {};
      Object.keys(o.preset.filt).forEach(function (item) {
        R.filt[item] = o.preset.filt[item];
      });
    }
    I.s = loadChoices(I);
    el.__cbl = I;
    el.classList.add('cbl');
    el.setAttribute('data-cbl', key);
    wire(I);
    INST.push(I);
    paintAll(I);
    var api = {
      refresh: function (x) {
        return refresh(I, x);
      },
      destroy: function () {
        teardown(I);
        INST = INST.filter(function (y) {
          return y !== I;
        });
        if (el.__cbl === I) {
          el.__cbl = null;
          el.innerHTML = '';
          el.classList.remove('cbl');
        }
      },
      el: el,
      state: function () {
        return {
          cols: I.s.cols.slice(),
          widths: JSON.parse(JSON.stringify(I.s.widths)),
          view: I.s.view,
          group: I.s.group,
          sort: I.s.sort,
          q: R.q,
          filt: JSON.parse(JSON.stringify(R.filt))
        };
      },
      /* open(id, on) — a page opens (or closes, on === false) one row's next level itself: the call desk's Next moves to the row that follows (W1-CRM) */
      open: function (id, on) {
        var rowId = String(id);
        if (isOpen(I, rowId) !== (on !== false)) toggleRow(I, rowId, true);
        else {
          R.hl = rowId;
          refocusRow(I, rowId);
        }
      }
    };
    I.api = api;
    return api;
  }

  /* the choices a person made, remembered per list key: through opts.store when the host gives one, else under our own prefix */
  function skey(I) {
    return 'cblist.' + (I.o.scope ? I.o.scope + '.' : '') + I.key;
  }
  function loadChoices(I) {
    var o = I.o,
      saved = null;
    if (o.store && typeof o.store.get === 'function')
      saved = safe(function () {
        return o.store.get(I.key);
      }, null);
    else saved = lsGet(skey(I));
    saved = saved && typeof saved === 'object' ? saved : {};
    var s = {
      cols: Array.isArray(saved.cols) && saved.cols.length ? saved.cols.slice() : null,
      widths: saved.widths && typeof saved.widths === 'object' ? saved.widths : {},
      view: saved.view === 'lines' || saved.view === 'grid' ? saved.view : o.view === 'lines' ? 'lines' : 'grid',
      group: saved.group || (o.group && o.group.default) || null,
      sort: saved.sort && saved.sort.key ? saved.sort : null
    };
    return s;
  }
  function saveChoices(I) {
    var list = I.s,
      v = { cols: list.cols, widths: list.widths, view: list.view, group: list.group, sort: list.sort };
    if (I.o.store && typeof I.o.store.set === 'function')
      safe(function () {
        I.o.store.set(I.key, v);
      });
    else lsSet(skey(I), v);
  }

  /* the host's words, else ours; never a raw key */
  function T(I, s, vars) {
    var text = s;
    if (I.o.t) {
      text = safe(function () {
        return I.o.t(s);
      }, s);
      if (typeof text !== 'string' || !text) text = s;
    }
    if (vars)
      Object.keys(vars).forEach(function (item) {
        text = text.split('{' + item + '}').join(vars[item]);
      });
    return text;
  }

  /* ═════ the data: rows → matched → ordered → grouped items ═════ */
  /* the mount's own rows; allRows = the lit view's own rows when it has them (STD-COMPARE), else these */
  function baseRows(inst) {
    var rows =
      typeof inst.o.rows === 'function'
        ? safe(function () {
            return inst.o.rows();
          }, [])
        : inst.o.rows;
    return Array.isArray(rows) ? rows : [];
  }
  function viewRows(inst) {
    var view = litOwnView(inst);
    if (!view) return null;
    var rows = safe(function () {
      return view.rows();
    }, []);
    return Array.isArray(rows) ? rows : [];
  }
  function allRows(inst) {
    return viewRows(inst) || baseRows(inst);
  }
  function rid(I, row, i) {
    var v = I.o.id ? I.o.id(row) : row && row.id;
    return String(v == null ? 'r' + i : v);
  }
  function columns(I) {
    return (typeof I.o.columns === 'function' ? I.o.columns() : I.o.columns) || [];
  }
  function pinned(I) {
    return columns(I).filter(function (item) {
      return item.pin === 'end';
    });
  }
  function choosable(I) {
    return columns(I).filter(function (item) {
      return item.pin !== 'end';
    });
  }
  function topKey(I) {
    var list = choosable(I),
      best = null;
    list.forEach(function (item) {
      if (best == null || (item.prio || 99) < (best.prio || 99)) best = item;
    });
    return best ? best.key : null;
  }
  function defaultCols(I) {
    var list = choosable(I),
      keys = list.map(function (item) {
        return item.key;
      }),
      want = val(I.o.defaultCols); /* a function when a view has columns of its own (STD-COMPARE) */
    if (Array.isArray(want) && want.length)
      return want.filter(function (item) {
        return keys.indexOf(item) >= 0;
      });
    var byPrio = list
      .slice()
      .sort(function (first, second) {
        return (first.prio || 99) - (second.prio || 99);
      })
      .slice(0, 3)
      .map(function (item) {
        return item.key;
      });
    return keys.filter(function (item) {
      return byPrio.indexOf(item) >= 0;
    });
  }
  /* the shown columns, in the person's order: stale keys dropped, the top column always present, then any pinned (the amount) at the end */
  function shownKeys(I) {
    var keys = choosable(I).map(function (item) {
        return item.key;
      }),
      set = (I.s.cols || defaultCols(I)).filter(function (item) {
        return keys.indexOf(item) >= 0;
      });
    if (!set.length) set = defaultCols(I);
    var top = topKey(I);
    if (top && set.indexOf(top) < 0) set = [top].concat(set);
    return set;
  }
  /* in card mode (a narrow container) a page may cap the fields a card carries: the highest-priority ones stay, the rest are NAMED in the chooser */
  function noRoomKeys(I) {
    var keys = shownKeys(I),
      max = I.o.cardMax;
    if (!I.card || !max || keys.length <= max) return [];
    var by = {};
    columns(I).forEach(function (item) {
      by[item.key] = item;
    });
    var keep = keys
      .slice()
      .sort(function (first, second) {
        return ((by[first] || {}).prio || 99) - ((by[second] || {}).prio || 99);
      })
      .slice(0, max);
    return keys.filter(function (item) {
      return keep.indexOf(item) < 0;
    });
  }
  function shownCols(I) {
    var by = {},
      out = noRoomKeys(I);
    columns(I).forEach(function (item) {
      by[item.key] = item;
    });
    return shownKeys(I)
      .filter(function (item) {
        return out.indexOf(item) < 0;
      })
      .map(function (item) {
        return by[item];
      })
      .filter(Boolean)
      .concat(pinned(I));
  }
  function minW(I, c) {
    return Math.max(64, String(c.label || c.key).length * 9 + 40);
  }
  function widthOf(I, c) {
    var w = I.s.widths[c.key];
    if (typeof w !== 'number') w = Math.max(px(c.w, 140), minW(I, c));
    return Math.max(minW(I, c), w);
  }
  function leadOn(I) {
    return (
      !!(
        I.o.lead &&
        safe(function () {
          return I.o.lead.on();
        }, false)
      ) ||
      (I.o.bulk && I.o.bulk.length && I.r.selMode)
    );
  }
  function template(I, cols) {
    return (
      (leadOn(I) ? '34px ' : '') +
      cols
        .map(function (item) {
          return widthOf(I, item) + 'px';
        })
        .join(' ')
    );
  }
  function remote(I) {
    return !!I.o.remote;
  }

  function sortOf(I, cols) {
    var st = I.s.sort,
      sorts = I.o.sorts || [],
      e = null,
      dir = 1,
      cmp = null;
    if (st) {
      dir = st.dir === -1 ? -1 : 1;
      for (var index = 0; index < sorts.length; index++)
        if (sorts[index].key === st.key) {
          e = sorts[index];
          break;
        }
      if (e) cmp = e.cmp;
      else {
        var col = null;
        columns(I).forEach(function (item) {
          if (!col && sortId(item) === st.key) col = item;
        });
        if (col)
          cmp = function (a, b) {
            return cmpVals(sortVal(col, a), sortVal(col, b));
          };
      }
    } else if (sorts[0] && sorts[0].cmp) cmp = sorts[0].cmp;
    return cmp ? { cmp: cmp, dir: dir } : null;
  }
  /* the sort in force: the page's own (a server-sorted list), else the person's, else the first declared */
  function curSort(I) {
    if (I.o.sortNow)
      return safe(function () {
        return I.o.sortNow();
      }, null);
    return I.s.sort || (sortOf(I) && (I.o.sorts || [])[0] ? { key: I.o.sorts[0].key, dir: 1 } : null);
  }
  function sortId(list) {
    return list.sort === true ? list.key : list.sort ? String(list.sort) : null;
  }
  function sortVal(c, row) {
    if (c.value)
      return safe(function () {
        return c.value(row);
      }, '');
    var v = safe(function () {
      return c.cell(row);
    }, '');
    return c.html ? plain(v) : v;
  }

  /* a filter choice the data no longer offers (a new date range) is dropped, never left hiding everything */
  function cleanFilters(I) {
    (I.o.filters || []).forEach(function (item) {
      var v = I.r.filt[item.key],
        opts = fopts(item);
      if (
        v &&
        opts.length &&
        !opts.some(function (x) {
          return x.v === v;
        })
      )
        delete I.r.filt[item.key];
    });
  }
  function matched(I) {
    var rows = allRows(I),
      R = I.r;
    if (remote(I)) return { all: rows, rows: rows };
    var q = String(R.q || '')
        .trim()
        .toLowerCase(),
      fl = I.o.filters || [];
    var out = rows.filter(function (row) {
      if (q) {
        var text = I.o.search
          ? safe(function () {
              return I.o.search(row);
            }, '')
          : columns(I)
              .map(function (item) {
                return sortVal(item, row);
              })
              .join(' ');
        if (
          String(text || '')
            .toLowerCase()
            .indexOf(q) < 0
        )
          return false;
      }
      for (var index = 0; index < fl.length; index++) {
        var v = R.filt[fl[index].key];
        if (
          v &&
          !safe(function () {
            return fl[index].match ? fl[index].match(row, v) : row[fl[index].key] === v;
          }, true)
        )
          return false;
      }
      return true;
    });
    var srt = sortOf(I);
    if (srt) {
      var d = srt.dir;
      out = out.slice().sort(function (first, second) {
        return srt.cmp(first, second) * d;
      });
    }
    return { all: rows, rows: out };
  }
  function groupMode(I) {
    var g = I.o.group;
    if (!g) return null;
    var opts = g.options || [];
    var m = I.s.group;
    if (
      m &&
      opts.length &&
      !opts.some(function (x) {
        return x[0] === m;
      })
    )
      m = null;
    return m || g.default || (opts[0] && opts[0][0]) || 'on';
  }
  /* the rows (and, with a grouping, their group lines) in order: a group is ONE head and all its rows, groups in order of first appearance */
  function itemsOf(I, rows) {
    var g = I.o.group,
      mode = groupMode(I);
    if (!g || !g.by || mode === 'none')
      return rows.map(function (item, index) {
        return { row: item, id: rid(I, item, index) };
      });
    var buckets = {},
      order = [],
      loose = [];
    rows.forEach(function (item, index) {
      var k = safe(function () {
          return g.by(item, mode);
        }, null),
        it = { row: item, id: rid(I, item, index), g: k ? String(k[1]) : null };
      if (!k) {
        loose.push(it);
        return;
      }
      var key = String(k[1]);
      if (!buckets[key]) {
        buckets[key] = { label: k[0], rows: [], items: [] };
        order.push(key);
      }
      buckets[key].rows.push(item);
      buckets[key].items.push(it);
    });
    if (g.order)
      order.sort(function (x, y) {
        return g.order.indexOf(x) - g.order.indexOf(y);
      });
    var items = [];
    order.forEach(function (key) {
      var bk = buckets[key],
        fig = g.fig
          ? safe(function () {
              return g.fig(bk.rows, mode, key);
            }, '')
          : T(I, '{n} shown', { n: bk.rows.length });
      items.push({ group: bk.label, gkey: key, fig: fig });
      bk.items.forEach(function (item) {
        items.push(item);
      });
    });
    return items.concat(loose);
  }
  function isOpen(I, id) {
    var R = I.r;
    return R.allOpen ? !R.open[id + '#closed'] : !!R.open[id];
  }
  function hasNext(I) {
    return !!(I.o.next || (I.o.actions && I.o.actions.length));
  }

  /* ═════ painting ═════ */
  function paintAll(I) {
    cleanFilters(I);
    paintTitle(I);
    paintTools(I);
    paintList(I);
    fit(I);
  }
  function $(I, sel) {
    return I.el.querySelector(sel);
  }

  function head(I) {
    return typeof I.o.head === 'function'
      ? safe(function () {
          return I.o.head();
        }, null)
      : I.o.head;
  }
  function paintTitle(list) {
    var h = head(list),
      box = $(list, ':scope > .cbl-title');
    if (!h || !(h.title || h.period || h.slot || (h.notices && h.notices.length) || (h.chips && h.chips.length))) {
      if (box) box.remove();
      return;
    }
    if (!box) {
      box = root.document.createElement('div');
      box.className = 'cbl-title';
      box.setAttribute('data-cbl-part', 'title');
      list.el.insertBefore(box, list.el.firstChild);
    }
    var out = '';
    if (h.title) out += '<h1>' + esc(h.title) + '</h1>';
    if (h.period) {
      var p = h.period;
      out +=
        '<span class="cbl-anchor"><button type="button" class="cbl-chip period" data-cbl-pop="period" aria-haspopup="dialog" aria-expanded="' +
        (list.pop === 'period') +
        '" data-testid="cbl-period-' +
        esc(list.key) +
        '">' +
        esc(p.label || '') +
        ' ▾</button>' +
        (list.pop === 'period' ? periodPop(list, p) : '') +
        '</span>';
    }
    var chips = h.chips || [],
      notes = h.notices || [],
      chipHTML = function (c) {
        return '<span class="cbl-chip"' + (c.tid ? ' data-testid="' + esc(c.tid) + '"' : '') + '>' + esc(c.text) + '</span>';
      };
    var noteHTML = function (n, i) {
      return (
        '<button type="button" class="cbl-chip ' +
        esc(n.cls === 'bad' ? 'bad' : 'warn') +
        '" data-notice="' +
        i +
        '"' +
        (n.tid ? ' data-testid="' + esc(n.tid) + '"' : '') +
        '>' +
        esc(n.text) +
        '</button>'
      );
    };
    /* a narrow container folds the strip and the notices into ONE chip that opens them: the head stays within its 30% of a phone */
    list.narrow = list.el.clientWidth > 0 && list.el.clientWidth <= 640;
    if (list.narrow && chips.length + notes.length > 1) {
      var bad = notes.some(function (item) {
        return item.cls === 'bad';
      });
      out +=
        '<span class="cbl-anchor"><button type="button" class="cbl-chip ' +
        (notes.length ? (bad ? 'bad' : 'warn') : '') +
        '" data-cbl-pop="notes" aria-haspopup="dialog" aria-expanded="' +
        (list.pop === 'notes') +
        '" data-testid="cbl-notes-' +
        esc(list.key) +
        '">' +
        esc(T(list, notes.length ? '{n} notices' : '{n} details', { n: chips.length + notes.length })) +
        ' ▾</button>' +
        (list.pop === 'notes'
          ? '<div class="cbl-pop left" role="dialog" aria-label="' +
            esc(T(list, 'Notices')) +
            '" data-testid="cbl-notes-pop-' +
            esc(list.key) +
            '"><div class="cbl-notes">' +
            chips.map(chipHTML).join('') +
            notes.map(noteHTML).join('') +
            '</div></div>'
          : '') +
        '</span>';
    } else {
      out += chips.map(chipHTML).join('') + notes.map(noteHTML).join('');
    }
    /* T3-COMPAT: views.inTitle — the saved-view tabs sit in the title row, after the chips, instead of a row of their own (a head that must stay short) */
    if (list.o.views && list.o.views.inTitle)
      out += '<span class="cbl-views in-title" data-cbl-part="views" role="tablist" aria-label="' + esc(T(list, 'Views')) + '"></span>';
    if (typeof h.slot === 'function')
      out += '<span class="cbl-slot" data-cbl-part="slot" style="margin-inline-start:auto;display:flex;align-items:center;gap:8px"></span>';
    box.innerHTML = out;
    if (list.o.views && list.o.views.inTitle) paintViews(list);
    if (typeof h.slot === 'function') {
      var node = box.querySelector(':scope > .cbl-slot');
      if (node)
        safe(function () {
          h.slot(node);
        });
    }
  }
  function periodPop(I, p) {
    var presets = p.presets || [],
      val = I.pv || p.value;
    return (
      '<div class="cbl-pop left" role="dialog" aria-label="' +
      esc(T(I, 'Period')) +
      '"><h4>' +
      esc(T(I, 'Period')) +
      '</h4><div class="cbl-preset">' +
      presets
        .map(function (x) {
          return '<button type="button" data-period="' + esc(x[0]) + '" aria-pressed="' + (val === x[0]) + '">' + esc(x[1]) + '</button>';
        })
        .join('') +
      '</div>' +
      (val === 'custom'
        ? '<div class="cbl-custom"><input data-cbl-from type="date" value="' +
          esc((p.custom && p.custom.from) || '') +
          '" aria-label="' +
          esc(T(I, 'From')) +
          '"> → <input data-cbl-to type="date" value="' +
          esc((p.custom && p.custom.to) || '') +
          '" aria-label="' +
          esc(T(I, 'To')) +
          '"></div>'
        : '') +
      '</div>'
    );
  }

  /** did the person narrow the list (a search, or a filter beyond the page's own starting view)? UX-94: a page whose starting filter IS its normal view
   *  (Disputes opens on "Still open", opts.presetIsDefault) says it is empty, not "Nothing matches" */
  function isNarrowed(list) {
    var starting = (list.o.presetIsDefault && list.o.preset && list.o.preset.filt) || {};
    var beyondStart = activeFilters(list).filter(function (filter) {
      return list.r.filt[filter.key] !== starting[filter.key];
    });
    return (list.r.q && String(list.r.q).trim()) || beyondStart.length;
  }
  function activeFilters(I) {
    return (I.o.filters || []).filter(function (item) {
      return I.r.filt[item.key];
    });
  }
  function countText(I, m) {
    var t = T(I, '{n} shown', { n: m.rows.length });
    if (remote(I)) {
      var tot = val(I.o.remote.total);
      if (tot != null && tot !== m.rows.length) t += ' ' + T(I, 'of') + ' ' + tot;
    } else if (m.rows.length !== m.all.length) t += ' ' + T(I, 'of') + ' ' + m.all.length;
    return t;
  }
  function fopts(f) {
    return (f.options || []).map(function (x) {
      return typeof x === 'object' ? x : { v: x, label: x };
    });
  }
  function paintTools(list) {
    paintViews(list);
    var box = $(list, ':scope > .cbl-tools');
    if (!box) {
      box = root.document.createElement('div');
      box.className = 'cbl-tools';
      box.setAttribute('data-cbl-part', 'tools');
      box.setAttribute('role', 'toolbar');
      box.setAttribute('aria-label', T(list, 'View'));
      var node = $(list, ':scope > .cbl-list');
      list.el.insertBefore(box, node);
    }
    var o = list.o,
      R = list.r,
      s = list.s,
      m = matched(list),
      fn = activeFilters(list).length,
      k = esc(list.key),
      sorts = sortChoices(list);
    var tids = o.tids || {},
      tl = o.tools || {},
      h =
        tl.search === false
          ? ''
          : '<div class="cbl-search"><span aria-hidden="true">🔍</span><input type="search" data-cbl-q id="cbl-q-' +
            k +
            '" data-testid="listctl-search-' +
            k +
            '" placeholder="' +
            esc(o.searchHint || T(list, 'Search')) +
            '" value="' +
            esc(R.q) +
            '" aria-label="' +
            esc(T(list, 'Search')) +
            '"></div>';
    /* T3-DISPUTES-ASSIST: a server-paged list that ALSO filters on the server says so (remote.filters: true) — the same Filters control, and every choice
       goes to its onQuery (q.filt · q.sort) instead of narrowing the page in hand. T3-CATALOGUE (widened, additively): a server-paged list that DECLARES
       filters gets the Filters ▾ too (a change goes to its pager, the unit still filters nothing itself); sorts alone show it only when the unit sorts (not remote) or the list opted in */
    if ((o.filters && o.filters.length) || ((!remote(list) || o.remote.filters === true) && sorts.length > 1)) {
      h +=
        '<span class="cbl-anchor"><button type="button" class="cbl-tbtn' +
        (fn ? ' on' : '') +
        '" data-cbl-pop="filt" id="cbl-filt-' +
        k +
        '" data-testid="cbl-filters-' +
        k +
        '" aria-haspopup="dialog" aria-expanded="' +
        (list.pop === 'filt') +
        '">' +
        esc(T(list, 'Filters')) +
        ' ▾' +
        (fn ? ' <span class="badge">' + fn + '</span>' : '') +
        '</button>' +
        (list.pop === 'filt' ? filtPop(list, sorts) : '') +
        '</span>';
    }
    var g = o.group,
      gm = groupMode(list);
    if (g && g.as === 'select' && (g.options || []).length > 1) {
      h +=
        '<label class="cbl-gsel" data-testid="cbl-group-' +
        k +
        '"' +
        (g.tips && g.tips[gm] ? ' title="' + esc(T(list, g.tips[gm])) + '"' : '') +
        '><span class="cbl-glab" data-testid="cbl-glab-' +
        k +
        '">' +
        esc(T(list, 'Group')) +
        '</span><select data-gsel id="cbl-gsel-' +
        k +
        '" data-testid="' +
        esc(g.tid ? g.tid + '-group' : 'cbl-gsel-' + k) +
        '" aria-label="' +
        esc(T(list, 'Group by')) +
        '">' +
        g.options
          .map(function (x) {
            return (
              '<option value="' +
              esc(x[0]) +
              '"' +
              (gm === x[0] ? ' selected' : '') +
              (g.tips && g.tips[x[0]] ? ' title="' + esc(T(list, g.tips[x[0]])) + '"' : '') +
              '>' +
              esc(T(list, x[1])) +
              '</option>'
            );
          })
          .join('') +
        '</select></label>';
    } else if (g && (g.options || []).length > 1)
      h +=
        '<span class="cbl-glab" data-testid="cbl-glab-' +
        k +
        '">' +
        esc(T(list, 'Group by')) +
        '</span><span class="cbl-seg" role="group" aria-label="' +
        esc(T(list, 'Group by')) +
        '" data-testid="cbl-group-' +
        k +
        '">' +
        g.options
          .map(function (x) {
            return (
              '<button type="button" data-group="' +
              esc(x[0]) +
              '"' +
              (g.tid ? ' data-testid="' + esc(g.tid) + '-group-' + esc(x[0]) + '"' : '') +
              ' aria-pressed="' +
              (gm === x[0]) +
              '">' +
              esc(T(list, x[1])) +
              '</button>'
            );
          })
          .join('') +
        '</span>';
    if (hasNext(list))
      h +=
        '<button type="button" class="cbl-tbtn cbl-ico" data-cbl-exp data-testid="' +
        esc(R.allOpen ? tids.collapse || 'cbl-expand-' + k : tids.expand || 'cbl-expand-' + k) +
        '" title="' +
        esc(T(list, R.allOpen ? 'Collapse all' : 'Expand all')) +
        '" aria-label="' +
        esc(T(list, R.allOpen ? 'Collapse all' : 'Expand all')) +
        '" aria-pressed="' +
        !!R.allOpen +
        '">' +
        (R.allOpen ? '⇡' : '⇣') +
        '</button>';
    h +=
      '<span class="cbl-seg" role="group" aria-label="' +
      esc(T(list, 'View')) +
      '"><button type="button" data-view="grid" data-testid="view-grid-' +
      k +
      '" title="' +
      esc(T(list, 'Grid: columns')) +
      '" aria-label="' +
      esc(T(list, 'Grid: columns')) +
      '" aria-pressed="' +
      (s.view === 'grid') +
      '">▤</button><button type="button" data-view="lines" data-testid="view-lines-' +
      k +
      '" title="' +
      esc(T(list, 'Lines: one line per record')) +
      '" aria-label="' +
      esc(T(list, 'Lines: one line per record')) +
      '" aria-pressed="' +
      (s.view === 'lines') +
      '">☰</button></span>';
    h +=
      '<span class="cbl-anchor"><button type="button" class="cbl-tbtn cbl-ico" data-cbl-pop="cols" id="cbl-cols-' +
      k +
      '" data-testid="cols-btn-' +
      k +
      '" title="' +
      esc(T(list, 'Choose columns')) +
      '" aria-label="' +
      esc(T(list, 'Choose columns')) +
      '" aria-haspopup="dialog" aria-expanded="' +
      (list.pop === 'cols') +
      '">⚙</button>' +
      (list.pop === 'cols' ? colsPop(list) : '') +
      '</span>';
    if (o.csv !== false && tl.csv !== false)
      h +=
        '<button type="button" class="cbl-tbtn cbl-ico" data-cbl-csv data-testid="' +
        esc(tids.csv || 'cbl-csv-' + k) +
        '" title="' +
        esc(T(list, 'Download CSV')) +
        '" aria-label="' +
        esc(T(list, 'Download CSV')) +
        '">⬇</button>';
    if (o.bulk && o.bulk.length)
      h +=
        '<button type="button" class="cbl-tbtn' +
        (R.selMode ? ' on' : '') +
        '" data-cbl-selmode data-testid="cbl-select-' +
        k +
        '" aria-pressed="' +
        !!R.selMode +
        '">☑ ' +
        esc(T(list, 'Select')) +
        '</button>';
    if (tl.count !== false)
      h +=
        '<span class="cbl-count" id="cbl-count-' +
        k +
        '" data-testid="' +
        esc(tids.count || list.key + '-count') +
        '" aria-live="polite">' +
        esc(countText(list, m)) +
        '</span>'; /* tools.count:false — a host that already says the count (one count on a screen) */
    if (o.bulk && o.bulk.length && R.selMode) {
      var n = selectedRows(list).length;
      h +=
        '<span class="cbl-acts" style="margin:0" data-testid="cbl-bulk-' +
        k +
        '"><button type="button" class="cbl-btn" data-cbl-selall>' +
        esc(T(list, 'Select all shown')) +
        '</button>' +
        o.bulk
          .map(function (item) {
            return (
              '<button type="button" class="cbl-btn" data-bulk="' +
              esc(item.id) +
              '"' +
              (n ? '' : ' disabled') +
              '>' +
              esc(T(list, item.label)) +
              ' (' +
              n +
              ')</button>'
            );
          })
          .join('') +
        '</span>';
    }
    h +=
      '<div class="cbl-fchips">' +
      activeFilters(list)
        .map(function (item) {
          var ov = fopts(item).filter(function (x) {
            return x.v === R.filt[item.key];
          })[0];
          return (
            '<span class="cbl-fchip">' +
            esc(item.label || item.key) +
            ': ' +
            esc(ov ? ov.label : R.filt[item.key]) +
            '<button type="button" data-unfilt="' +
            esc(item.key) +
            '" aria-label="' +
            esc(T(list, 'Remove {x} filter', { x: item.label || item.key })) +
            '">×</button></span>'
          );
        })
        .join('') +
      '</div>';
    if (list.pop && String(list.pop).indexOf('hf:') === 0) h += hfPop(list);
    var ae = root.document.activeElement,
      keepId = ae && box.contains(ae) ? ae.id : '',
      ss = null,
      se = null;
    if (keepId && ae.setSelectionRange) {
      try {
        ss = ae.selectionStart;
        se = ae.selectionEnd;
      } catch (_) {}
    }
    box.innerHTML = h;
    if (keepId) {
      var back = box.querySelector('#' + cssId(keepId));
      if (back) {
        back.focus();
        if (ss != null) {
          try {
            back.setSelectionRange(ss, se);
          } catch (_) {}
        }
      }
    }
  }
  /* the saved views: tabs that set the list's own filters. A tab is lit when the filters in force are exactly its own. */
  function viewMatches(I, v, row) {
    var list = I.o.filters || [],
      ok = true;
    Object.keys(v.filt || {}).forEach(function (item) {
      var text = list.filter(function (x) {
        return x.key === item;
      })[0];
      if (
        text &&
        ok &&
        !safe(function () {
          return text.match ? text.match(row, v.filt[item]) : row[item] === v.filt[item];
        }, true)
      )
        ok = false;
    });
    return ok;
  }
  function viewOn(inst, view) {
    var a = inst.r.filt,
      b = view.filt || {},
      ka = Object.keys(a).filter(function (item) {
        return a[item];
      }),
      list = Object.keys(b);
    var sameOwn = list.every(function (item) {
      return a[item] === b[item];
    });
    return view.rows
      ? list.length > 0 && sameOwn
      : ka.length === list.length && sameOwn; /* a view with its own rows stays lit while its filters are in force (its country filter may change) */
  }
  function litOwnView(inst) {
    var views = (inst.o.views && inst.o.views.items) || [],
      out = null;
    views.forEach(function (view) {
      if (!out && typeof view.rows === 'function' && viewOn(inst, view)) out = view;
    });
    return out;
  }
  function paintViews(I) {
    var list = I.o.views && I.o.views.items,
      inT = !!(I.o.views && I.o.views.inTitle),
      box = $(I, inT ? ':scope > .cbl-title > .cbl-views' : ':scope > .cbl-views');
    if (!list || !list.length || remote(I)) {
      if (box) box.remove();
      return;
    }
    if (!box && inT) return; /* no title row painted (yet): paintTitle paints the tabs with it */
    if (!box) {
      box = root.document.createElement('div');
      box.className = 'cbl-views';
      box.setAttribute('data-cbl-part', 'views');
      box.setAttribute('role', 'tablist');
      box.setAttribute('aria-label', T(I, 'Views'));
      var node = $(I, ':scope > .cbl-tools'),
        l = $(I, ':scope > .cbl-list');
      I.el.insertBefore(box, node || l);
    }
    var rows = baseRows(I),
      vt = I.o.views.tid || 'views';
    box.innerHTML = list
      .map(function (item) {
        var n = (
            typeof item.rows === 'function'
              ? safe(function () {
                  return item.rows();
                }, [])
              : rows.filter(function (row) {
                  return viewMatches(I, item, row);
                })
          ).length,
          on = viewOn(I, item);
        return (
          '<button type="button" role="tab" class="cbl-vtab" data-view-tab="' +
          esc(item.key) +
          '" aria-selected="' +
          on +
          '" data-testid="' +
          esc(vt) +
          '-' +
          esc(item.key) +
          '"' +
          (item.tip ? ' title="' + esc(T(I, item.tip)) + '"' : '') +
          '>' +
          esc(T(I, item.label)) +
          ' <span class="n">' +
          n +
          '</span></button>'
        );
      })
      .join('');
  }
  /* the filter behind a column heading: a small menu of that filter's own choices (the same state as Filters ▾) */
  function hfPop(list) {
    var fk = String(list.pop).slice(3),
      f = (list.o.filters || []).filter(function (x) {
        return x.key === fk;
      })[0];
    if (!f) return '';
    var at = list.hfAt || { l: 8, t: 100 },
      cur = list.r.filt[fk] || '';
    return (
      '<div class="cbl-pop hf" role="menu" aria-label="' +
      esc(f.label || fk) +
      '" data-testid="cbl-hf-pop-' +
      esc(fk) +
      '" style="left:' +
      Math.round(at.l) +
      'px;top:' +
      Math.round(at.t) +
      'px">' +
      '<button type="button" role="menuitemradio" aria-checked="' +
      !cur +
      '" data-hfv="" data-hfk="' +
      esc(fk) +
      '">' +
      esc(f.all || T(list, 'Any')) +
      '</button>' +
      fopts(f)
        .map(function (x) {
          return (
            '<button type="button" role="menuitemradio" aria-checked="' +
            (cur === x.v) +
            '" data-hfv="' +
            esc(x.v) +
            '" data-hfk="' +
            esc(fk) +
            '" data-testid="cbl-hf-' +
            esc(fk) +
            '-' +
            esc(x.v) +
            '">' +
            esc(x.label) +
            '</button>'
          );
        })
        .join('') +
      '</div>'
    );
  }
  function sortChoices(I) {
    var out = [],
      seen = {};
    (I.o.sorts || []).forEach(function (x) {
      out.push({ id: x.key, label: x.label || x.key });
      seen[x.key] = 1;
    });
    columns(I).forEach(function (item) {
      var id = sortId(item);
      if (id && !seen[id]) {
        out.push({ id: id, label: item.label || item.key });
        seen[id] = 1;
      }
    });
    return out;
  }
  function filtPop(I, sorts) {
    var R = I.r,
      st = I.s.sort,
      cur = st ? st.key : (I.o.sorts || [])[0] && I.o.sorts[0].key;
    return (
      '<div class="cbl-pop left" role="dialog" aria-label="' +
      esc(T(I, 'Filters')) +
      '" data-testid="cbl-filters-pop-' +
      esc(I.key) +
      '"><h4>' +
      esc(T(I, 'Filters')) +
      '</h4>' +
      (I.o.filters || [])
        .map(function (item) {
          return (
            '<div class="f"><span id="cbl-fl-' +
            esc(I.key) +
            '-' +
            esc(item.key) +
            '">' +
            esc(item.label || item.key) +
            '</span><select aria-labelledby="cbl-fl-' +
            esc(I.key) +
            '-' +
            esc(item.key) +
            '" data-filt="' +
            esc(item.key) +
            '" id="cbl-f-' +
            esc(I.key) +
            '-' +
            esc(item.key) +
            '" data-testid="listctl-filter-' +
            esc(item.key) +
            '"><option value="">' +
            esc(item.all || T(I, 'Any')) +
            '</option>' +
            fopts(item)
              .map(function (x) {
                return '<option value="' + esc(x.v) + '"' + (R.filt[item.key] === x.v ? ' selected' : '') + '>' + esc(x.label) + '</option>';
              })
              .join('') +
            '</select></div>'
          );
        })
        .join('') +
      (sorts.length > 1
        ? '<div class="f"><span id="cbl-sl-' +
          esc(I.key) +
          '">' +
          esc(T(I, 'Sort by')) +
          '</span><select aria-labelledby="cbl-sl-' +
          esc(I.key) +
          '" data-cbl-sort id="cbl-sort-' +
          esc(I.key) +
          '" data-testid="listctl-sort-' +
          esc(I.key) +
          '">' +
          sorts
            .map(function (x) {
              return '<option value="' + esc(x.id) + '"' + (cur === x.id ? ' selected' : '') + '>' + esc(x.label) + '</option>';
            })
            .join('') +
          '</select></div>'
        : '') +
      '<div class="cbl-acts"><button type="button" class="cbl-btn" data-cbl-clearf>' +
      esc(T(I, 'Clear all')) +
      '</button></div></div>'
    );
  }
  function colsPop(I) {
    var all = choosable(I),
      shown = shownKeys(I),
      by = {},
      top = topKey(I);
    all.forEach(function (item) {
      by[item.key] = item;
    });
    var rest = all.filter(function (item) {
        return shown.indexOf(item.key) < 0;
      }),
      k = esc(I.key),
      nr = noRoomKeys(I);
    function row(c, i, on) {
      return (
        '<div class="cbl-colrow">' +
        (on
          ? '<button type="button" class="cbl-mv" data-mv="' +
            esc(c.key) +
            '" data-d="-1"' +
            (i === 0 ? ' disabled' : '') +
            ' aria-label="' +
            esc(T(I, 'Move {x} left', { x: c.label })) +
            '" title="' +
            esc(T(I, 'Move {x} left', { x: c.label })) +
            '">←</button>'
          : '<span class="cbl-mvsp"></span>') +
        '<label' +
        (c.key === top ? ' title="' + esc(T(I, 'Always shown — it names the row')) + '"' : '') +
        '><input type="checkbox" data-col="' +
        esc(c.key) +
        '" data-testid="cols-' +
        k +
        '-' +
        esc(c.key) +
        '"' +
        (on ? ' checked' : '') +
        (c.key === top ? ' disabled' : '') +
        '> ' +
        esc(c.label || c.key) +
        (on && nr.indexOf(c.key) >= 0
          ? ' <span class="cbl-noroom" data-testid="cols-noroom-' + esc(c.key) + '">' + esc(T(I, 'hidden — no room')) + '</span>'
          : '') +
        '</label>' +
        (on
          ? '<button type="button" class="cbl-mv" data-mv="' +
            esc(c.key) +
            '" data-d="1"' +
            (i === shown.length - 1 ? ' disabled' : '') +
            ' aria-label="' +
            esc(T(I, 'Move {x} right', { x: c.label })) +
            '" title="' +
            esc(T(I, 'Move {x} right', { x: c.label })) +
            '">→</button>'
          : '<span class="cbl-mvsp"></span>') +
        '</div>'
      );
    }
    return (
      '<div class="cbl-pop" role="dialog" aria-label="' +
      esc(T(I, 'Choose columns')) +
      '" data-testid="cols-menu-' +
      k +
      '"><h4>' +
      esc(T(I, 'Shown — in this order')) +
      '</h4>' +
      shown
        .map(function (item, index) {
          return by[item] ? row(by[item], index, true) : '';
        })
        .join('') +
      (rest.length
        ? '<h4>' +
          esc(T(I, 'Available')) +
          '</h4>' +
          rest
            .map(function (item) {
              return row(item, 0, false);
            })
            .join('')
        : '') +
      '<div class="cbl-acts"><button type="button" class="cbl-btn" data-cbl-resetcols data-testid="cols-reset-' +
      k +
      '">' +
      esc(T(I, 'Reset to the standard columns')) +
      '</button></div></div>'
    );
  }

  /* the rows area: header (sticky) + rows, or one of the four states */
  function paintList(I) {
    var box = $(I, ':scope > .cbl-list');
    if (!box) {
      box = root.document.createElement('div');
      box.className = 'cbl-list';
      box.setAttribute('tabindex', '0');
      box.setAttribute('data-cbl-part', 'list');
      I.el.appendChild(box);
    }
    box.setAttribute('aria-label', T(I, 'Rows'));
    if (!box.__cblScroll) {
      box.__cblScroll = true;
      box.addEventListener(
        'scroll',
        function () {
          if (I.o.onScroll)
            safe(function () {
              I.o.onScroll(box);
            });
        },
        { passive: true }
      );
    }
    I.card = box.clientWidth > 0 && box.clientWidth <= 620;
    if (!box.__cblRO && root.ResizeObserver) {
      box.__cblRO = new root.ResizeObserver(function () {
        if (I.dead) return;
        var c = box.clientWidth > 0 && box.clientWidth <= 620;
        if (c !== I.card) {
          paintTools(I);
          paintList(I);
        }
      });
      try {
        box.__cblRO.observe(box);
      } catch (_) {}
    }
    var keepTop = box.scrollTop,
      o = I.o,
      R = I.r,
      s = I.s,
      cols = shownCols(I),
      tpl = template(I, cols);
    if (I.io) {
      try {
        I.io.disconnect();
      } catch (_) {}
      I.io = null;
    }
    I.el.classList.toggle('tbllines', s.view === 'lines');
    var state = typeof o.state === 'function' ? o.state() : o.state;
    var hdr = headerHTML(I, cols, tpl, state === 'loading');
    var h = '';
    if (state === 'loading') {
      box.innerHTML =
        '<div class="cbl-grid" role="grid" aria-busy="true">' + (s.view === 'grid' ? hdr : '') + '</div>' + new Array(7).join('<div class="cbl-skel"></div>');
      setHdrH(I, box);
      return;
    }
    if (state === 'error') {
      /* ⚠️ a caller may hand a plain SENTENCE (cap-finance did). A string has a native .sub() method (String.prototype.sub),
         so er.sub printed "function sub() { [native code] }" on screen. A string is the title; only an object has parts. */
      var er = val(o.error);
      er = typeof er === 'string' ? { title: er } : er || {};
      box.innerHTML =
        '<div class="cbl-state" role="alert" data-testid="cbl-error-' +
        esc(I.key) +
        '"><div class="big">' +
        esc(er.title || T(I, 'The list could not load.')) +
        '</div>' +
        esc(er.sub || T(I, 'Nothing was lost. Try again in a moment.')) +
        '<br><button type="button" class="cbl-btn" data-cbl-retry>' +
        esc(T(I, 'Try again')) +
        '</button></div>';
      return;
    }
    var m = matched(I),
      items = itemsOf(I, m.rows);
    if (!m.rows.length) {
      var narrowed = isNarrowed(I);
      if (m.all.length && narrowed && !remote(I)) {
        box.innerHTML =
          '<div class="cbl-state" data-testid="cbl-nomatch-' +
          esc(I.key) +
          '"><div class="big">' +
          esc(T(I, 'Nothing matches.')) +
          '</div>' +
          esc(R.q ? '“' + R.q + '” ' + T(I, 'matches nothing here.') : T(I, 'These filters match nothing here.')) +
          '<br><button type="button" class="cbl-btn" data-cbl-clear>' +
          esc(T(I, 'Clear search and filters')) +
          '</button></div>';
      } else if (remote(I) && narrowed) {
        box.innerHTML =
          '<div class="cbl-state" data-testid="cbl-nomatch-' +
          esc(I.key) +
          '"><div class="big">' +
          esc(T(I, 'Nothing matches.')) +
          '</div>' +
          esc(R.q ? '“' + R.q + '” ' + T(I, 'matches nothing here.') : T(I, 'These filters match nothing here.')) +
          '<br><button type="button" class="cbl-btn" data-cbl-clear>' +
          esc(T(I, 'Clear search and filters')) +
          '</button></div>' +
          footHTML(I);
      } else {
        var em = val(o.empty);
        em = typeof em === 'string' ? { title: em } : em || {}; /* same trap as er above */
        box.innerHTML =
          '<div class="cbl-state" data-testid="cbl-empty-' +
          esc(I.key) +
          '"><div class="big">' +
          esc(em.title || T(I, 'Nothing recorded yet.')) +
          '</div>' +
          esc(em.sub || '') +
          '</div>' +
          footHTML(I);
      }
      return;
    }
    /* the rows that can be drawn: a collapsed group's rows are not among them (so a collapsed group never leaves a "show more" behind) */
    items = items.filter(function (x) {
      return x.group != null || !(x.g != null && R.gcol[x.g]);
    });
    var drawn = 0,
      count = 0,
      total = items.filter(function (x) {
        return x.group == null;
      }).length,
      limit = I.limit;
    if (limit > total) limit = I.limit = Math.max(50, Math.min(limit, total));
    var body = '';
    for (var index = 0; index < items.length; index++) {
      var it = items[index];
      if (it.group != null) {
        count = 0; /* the stripe starts again under each group head */
        var shut = !!R.gcol[it.gkey],
          gt = o.group && o.group.tid;
        body +=
          '<div class="cbl-group" role="button" tabindex="0" aria-expanded="' +
          !shut +
          '" data-g="' +
          esc(it.gkey) +
          '"' +
          (gt || o.group.headTid ? ' data-testid="' + esc(o.group.headTid ? o.group.headTid(it.gkey) : gt + '-ghead-' + esc(it.gkey)) + '"' : '') +
          ' style="cursor:pointer"><span class="cbl-tw" aria-hidden="true">' +
          (shut ? '▸' : '▾') +
          '</span><b>' +
          esc(it.group) +
          '</b> <span class="fig"' +
          (gt ? ' data-testid="' + esc(gt) + '-gsum-' + esc(it.gkey) + '"' : '') +
          '>' +
          esc(it.fig) +
          '</span></div>';
        continue;
      }
      if (!remote(I) && drawn >= limit) break;
      drawn++;
      var zb = count++ % 2 === 1; /* ZEBRA: the 2nd, 4th … data row of the list (or of its group) */
      body += s.view === 'grid' ? rowHTML(I, it, cols, tpl, zb) : lineHTML(I, it, cols, zb);
    }
    var end;
    if (!remote(I) && drawn < total)
      end =
        '<div class="cbl-end" data-cbl-sentinel data-testid="cbl-more-' +
        esc(I.key) +
        '"><button type="button" data-cbl-more>' +
        esc(T(I, '↓ Show {n} more', { n: Math.min(50, total - drawn) })) +
        '</button> <span>' +
        drawn +
        ' ' +
        esc(T(I, 'of')) +
        ' ' +
        total +
        '</span></div>';
    else
      end = remote(I)
        ? ''
        : '<div class="cbl-end" data-testid="cbl-end-' +
          esc(I.key) +
          '">' +
          esc(T(I, 'end of list')) +
          '</div>'; /* the count is said once, in the tools — not again here (ai-eye E-3/E-13) */
    box.innerHTML =
      '<div class="cbl-grid' +
      (s.view === 'lines' ? ' cbl-lines' : '') +
      '" role="grid" aria-rowcount="' +
      total +
      '">' +
      (s.view === 'grid' ? hdr : '') +
      body +
      '</div>' +
      end +
      footHTML(I);
    setHdrH(I, box);
    box.scrollTop = keepTop;
    if (!remote(I) && drawn < total) {
      var sent = box.querySelector('[data-cbl-sentinel]');
      if (sent && root.IntersectionObserver) {
        try {
          I.io = new root.IntersectionObserver(
            function (list) {
              if (
                list.some(function (e) {
                  return e.isIntersecting;
                })
              ) {
                I.limit += 50;
                paintList(I);
              }
            },
            { root: box, rootMargin: '0px' }
          );
          I.io.observe(sent);
        } catch (_) {}
      }
    }
    var node = $(I, '.cbl-count');
    if (node) node.textContent = countText(I, m);
    resolveNext(I);
  }
  function footHTML(I) {
    var f = I.o.remote && I.o.remote.foot;
    var v = f
      ? safe(function () {
          return f();
        }, '')
      : '';
    return v ? '<div class="cbl-foot" data-testid="cbl-foot-' + esc(I.key) + '">' + v + '</div>' : '';
  }
  function setHdrH(I, box) {
    var node = box.querySelector('.cbl-hdr');
    box.style.setProperty('--cl-hdr-h', (node ? node.offsetHeight : 0) + 'px');
  }

  function headerHTML(list, cols, tpl, plainHead) {
    var st = curSort(list);
    var lead = leadOn(list) ? '<div class="cbl-hc" role="columnheader" aria-label="' + esc(T(list, 'Select')) + '"></div>' : '';
    return (
      '<div class="cbl-hdr lhead" role="row" style="grid-template-columns:' +
      tpl +
      '">' +
      lead +
      cols
        .map(function (item) {
          var id = sortId(item),
            sorted = !!(st && id && st.key === id),
            r = !!(item.num || item.pin === 'end'),
            label = esc(item.label || item.key);
          return (
            '<div class="cbl-hc lhcell' +
            (r ? ' r' : '') +
            (id ? ' sortable' : '') +
            '" role="columnheader" aria-sort="' +
            (sorted ? (st.dir === -1 ? 'descending' : 'ascending') : 'none') +
            '">' +
            (id
              ? '<button type="button" class="sort"' +
                (plainHead ? ' disabled tabindex="-1"' : ' data-sort="' + esc(id) + '"') +
                '>' +
                label +
                ' <span class="arrow">' +
                (sorted ? (st.dir === -1 ? '▼' : '▲') : '⇅') +
                '</span></button>'
              : label) /* the loading header keeps the SAME boxes (its buttons are just inert), so it does not change height when the rows arrive */ +
            (item.hfilter && !remote(list)
              ? '<button type="button" class="cbl-hf' +
                (list.r.filt[item.hfilter] ? ' on' : '') +
                '"' +
                (plainHead ? ' disabled tabindex="-1"' : ' data-hf="' + esc(item.hfilter) + '"') +
                ' data-testid="cbl-hf-' +
                esc(item.hfilter) +
                '" aria-haspopup="menu" aria-expanded="' +
                (list.pop === 'hf:' + item.hfilter) +
                '" aria-label="' +
                esc(T(list, 'Filter {x}', { x: item.label || item.key })) +
                '" title="' +
                esc(T(list, 'Filter {x}', { x: item.label || item.key })) +
                '">' +
                (list.r.filt[item.hfilter] ? '●' : '▾') +
                '</button>'
              : '') +
            (plainHead
              ? ''
              : '<button type="button" class="cbl-rz colrz" data-rz="' +
                esc(item.key) +
                '" aria-label="' +
                esc(T(list, 'Resize {x} column (arrow keys)', { x: item.label || item.key })) +
                '" title="' +
                esc(T(list, 'Drag to resize · double-click resets')) +
                '"></button>') +
            '</div>'
          );
        })
        .join('') +
      '</div>'
    );
  }
  function cellOf(I, c, row) {
    var v = safe(function () {
      return c.cell ? c.cell(row) : row[c.key];
    }, '');
    if (v == null) v = '';
    return c.html ? String(v) : esc(v);
  }
  function rowAttrs(I, row, id) {
    var a = '',
      o = I.o,
      at = o.rowAttrs
        ? safe(function () {
            return o.rowAttrs(row);
          }, null)
        : null;
    if (at)
      Object.keys(at).forEach(function (item) {
        if (/^[a-z][a-z0-9\-]*$/i.test(item) && !/^on/i.test(item)) a += ' ' + item + '="' + esc(at[item]) + '"';
      });
    var tid = o.rowTid
      ? safe(function () {
          return o.rowTid(row);
        }, '')
      : '';
    return (tid ? ' data-testid="' + esc(tid) + '"' : '') + a;
  }
  function rowHTML(I, it, cols, tpl, zb) {
    var row = it.row,
      id = it.id,
      R = I.r,
      nx = hasNext(I),
      open = nx && isOpen(I, id),
      o = I.o;
    var cls =
      (o.rowClass
        ? safe(function () {
            return o.rowClass(row);
          }, '')
        : '') +
      (R.hl === id && o.hl !== false ? ' sel' : '') +
      (zb ? ' z' : '') +
      (it.g != null ? ' ing' : '');
    var cells = cols
      .map(function (item, index) {
        var amt = item.pin === 'end';
        return (
          '<div class="cbl-cell lcell' +
          (index === 0 ? ' first' : '') +
          (amt ? ' r mono strong amt' : '') +
          (item.num && !amt ? ' r mono' : '') +
          (item.mono ? ' mono' : '') +
          '" data-l="' +
          esc(index === 0 ? '' : item.label || '') +
          '" role="gridcell"' +
          (item.tid
            ? ' data-testid="' +
              esc(
                safe(function () {
                  return item.tid(row);
                }, '')
              ) +
              '"'
            : '') +
          '>' +
          (index === 0 && nx
            ? '<span class="cbl-tw" data-caret role="button" aria-label="' +
              esc(T(I, open ? 'Collapse' : 'Expand')) +
              '" aria-expanded="' +
              !!open +
              '">▸</span>'
            : '') +
          cellOf(I, item, row) +
          '</div>'
        );
      })
      .join('');
    var lead = leadOn(I) ? '<div class="cbl-lead" role="gridcell">' + leadCell(I, row, id) + '</div>' : '';
    var out =
      '<div class="cbl-row lrow grow' +
      (open ? ' cbl-open open' : '') +
      (cls ? ' ' + esc(cls) : '') +
      '" role="row" data-row="' +
      esc(id) +
      '" tabindex="0"' +
      (nx ? ' aria-expanded="' + !!open + '"' : '') +
      ' style="grid-template-columns:' +
      tpl +
      '"' +
      rowAttrs(I, row, id) +
      '>' +
      lead +
      cells +
      '</div>';
    if (open) out += nextHTML(I, row, id);
    return out;
  }
  function leadCell(I, row, id) {
    if (
      I.o.lead &&
      safe(function () {
        return I.o.lead.on();
      }, false)
    )
      return safe(function () {
        return I.o.lead.cell(row);
      }, '');
    return '<input type="checkbox" data-selrow="' + esc(id) + '"' + (I.r.sel[id] ? ' checked' : '') + ' aria-label="' + esc(T(I, 'Select')) + '">';
  }
  function lineHTML(I, it, cols, zb) {
    var row = it.row,
      id = it.id,
      nx = hasNext(I),
      open = nx && isOpen(I, id),
      o = I.o,
      pin = cols.filter(function (item) {
        return item.pin === 'end';
      })[0];
    var cls =
      (o.rowClass
        ? safe(function () {
            return o.rowClass(row);
          }, '')
        : '') +
      (I.r.hl === id && o.hl !== false ? ' sel' : '') +
      (zb ? ' z' : '') +
      (it.g != null ? ' ing' : '');
    var flow = cols
      .filter(function (item) {
        return item.pin !== 'end';
      })
      .map(function (item) {
        var v = cellOf(I, item, row),
          t = plain(v);
        if (!t || t === '—') return '';
        return (
          '<span class="cbl-fl lcell' +
          (item.mono ? ' cbl-num' : '') +
          '" data-l="' +
          esc(item.label || '') +
          '"' +
          (item.tid
            ? ' data-testid="' +
              esc(
                safe(function () {
                  return item.tid(row);
                }, '')
              ) +
              '"'
            : '') +
          '>' +
          v +
          '</span>'
        );
      })
      .join('');
    var gist = o.gist
      ? safe(function () {
          return o.gist(row);
        }, '')
      : '';
    var lead = leadOn(I) ? '<span class="cbl-lead" style="padding:0 8px 0 0">' + leadCell(I, row, id) + '</span>' : '';
    var out =
      '<div class="cbl-lrec lrow' +
      (open ? ' cbl-open open' : '') +
      (cls ? ' ' + esc(cls) : '') +
      '" role="row" data-row="' +
      esc(id) +
      '" tabindex="0"' +
      (nx ? ' aria-expanded="' + !!open + '"' : '') +
      rowAttrs(I, row, id) +
      '><div class="cbl-lline">' +
      lead +
      (nx
        ? '<span class="cbl-tw" data-caret role="button" aria-label="' + esc(T(I, open ? 'Collapse' : 'Expand')) + '" aria-expanded="' + !!open + '">▸</span>'
        : '') +
      '<span class="cbl-lflow">' +
      flow +
      '</span>' +
      (pin ? '<span class="cbl-lamt">' + cellOf(I, pin, row) + '</span>' : '') +
      '</div>' +
      (gist ? '<div class="cbl-lgist"' + (o.gistTid ? ' data-testid="' + esc(o.gistTid(row)) + '"' : '') + '>' + esc(gist) + '</div>' : '') +
      '</div>';
    if (open) out += nextHTML(I, row, id);
    return out;
  }
  /* what a row opens to: the page's markup (trusted by contract), then the row actions the unit draws itself */
  function nextHTML(I, row, id) {
    var o = I.o,
      inner = '';
    if (o.next) {
      if (I.nextCache[id] !== undefined) inner = I.nextCache[id];
      else {
        var v = safe(function () {
          return o.next(row, { view: I.s.view, id: id });
        }, '');
        if (v && typeof v.then === 'function') {
          inner = o.nextPending
            ? safe(function () {
                return o.nextPending(row);
              }, '')
            : '<span class="cbl-dim">' +
              esc(T(I, 'Reading…')) +
              '</span>'; /* nextPending: the card's own shape while its answer is on the way, so it does not change height */
          I.pending = I.pending || {};
          I.pending[id] = v;
        } else {
          inner = v == null ? '' : String(v);
        }
      }
    }
    var acts = (o.actions || []).filter(function (item) {
      return (
        !item.when ||
        safe(function () {
          return item.when(row);
        }, true)
      );
    });
    return (
      '<div class="cbl-next" role="row" data-next="' +
      esc(id) +
      '"><div role="cell">' +
      inner +
      '</div>' +
      (acts.length
        ? '<div class="cbl-acts">' +
          (function () {
            var whys = acts.map(function (item) {
              return item.why
                ? safe(function () {
                    return item.why(row);
                  }, '')
                : '';
            }); /* the page asks the server's answer for this login; a sentence = refused, shown greyed with it */
            /* every action refused for the same reason (a view-only login): the sentence ONCE after the row's buttons, not six times (ai-eye E-1) */
            var one =
              acts.length > 1 &&
              whys[0] &&
              whys.every(function (item) {
                return item === whys[0];
              })
                ? whys[0]
                : '';
            return (
              acts
                .map(function (item, index) {
                  var why = whys[index];
                  var btn =
                    '<button type="button" class="cbl-btn" data-act="' +
                    esc(item.id) +
                    '" data-actrow="' +
                    esc(id) +
                    '"' +
                    (item.tid ? ' data-testid="' + esc(item.tid) + '"' : '') +
                    (why ? ' disabled aria-disabled="true" title="' + esc(why) + '"' : '') +
                    '>' +
                    (item.icon ? esc(item.icon) + ' ' : '') +
                    esc(T(I, item.label)) +
                    '</button>';
                  return why && !one
                    ? '<span class="cbl-act">' +
                        btn +
                        '<span class="cbl-why"' +
                        (item.tid ? ' data-testid="' + esc(item.tid) + '-why"' : '') +
                        '>' +
                        esc(why) +
                        '</span></span>'
                    : btn;
                })
                .join('') + (one ? '<span class="cbl-why" data-testid="cbl-why-' + esc(id) + '">' + esc(one) + '</span>' : '')
            );
          })() +
          '</div>'
        : '') +
      '</div>'
    );
  }
  function resolveNext(I) {
    var p = I.pending;
    if (!p) return;
    I.pending = null;
    Object.keys(p).forEach(function (id) {
      p[id].then(
        function (html) {
          I.nextCache[id] = html == null ? '' : String(html);
          if (I.dead) return;
          var node = I.el.querySelector('.cbl-next[data-next="' + (root.CSS && root.CSS.escape ? root.CSS.escape(id) : id) + '"] > div');
          if (node) node.innerHTML = I.nextCache[id];
        },
        function () {
          I.nextCache[id] = '<span class="cbl-dim">' + esc(T(I, 'The list could not load.')) + '</span>';
          if (!I.dead) paintList(I);
        }
      );
    });
  }
  function selectedRows(I) {
    var ids = I.r.sel;
    return allRows(I).filter(function (item, index) {
      return ids[rid(I, item, index)];
    });
  }

  /* the rows area fills the rest of the window: from its top edge to the bottom of the viewport, recalculated on resize.
     ⭐ SET-WALK1 · W21 (15 Oct): an EMPTY or SHORT list is as tall as its content — the "only rows scroll" height applies only when the rows
     overflow it. Before: every list took the window's rest (an empty sessions list painted 2,400 px of nothing), and a list scrolled up out of
     a scrolling pane (its top NEGATIVE) grew by the scrolled distance. Now: the top is clamped at the window's edge, the natural height is
     measured with the inline height off, and the window height is set only when the content would overflow it. */
  function fit(I) {
    if (I.o.fill === false || !I.el.getBoundingClientRect) return;
    var top = Math.max(0, I.el.getBoundingClientRect().top),
      avail = Math.max(300, Math.floor(root.innerHeight - top - (I.o.bottom == null ? 8 : I.o.bottom)));
    I.el.style.height = '';
    var natural = I.el.scrollHeight;
    I.el.style.height = natural > avail ? avail + 'px' : '';
    I.el.setAttribute('data-cbl-fit', natural > avail ? 'window' : 'content');
  }

  /* ═════ actions ═════ */
  function resetLimit(I) {
    I.limit = 50;
  }
  function query(I, why, sort, now) {
    if (!remote(I)) return false;
    clearTimeout(I.qt);
    var go = function () {
      safe(function () {
        I.o.remote.onQuery({ why: why || 'search', q: I.r.q, filt: JSON.parse(JSON.stringify(I.r.filt)), sort: sort || curSort(I), group: I.s.group });
      });
    };
    if (now) go();
    else I.qt = setTimeout(go, 250);
    return true;
  }
  function refresh(I, x) {
    if (I.dead) return;
    if (Array.isArray(x)) I.o.rows = x;
    else if (x && typeof x === 'object') {
      Object.keys(x).forEach(function (item) {
        if (item === 'remote' && I.o.remote) Object.assign(I.o.remote, x.remote);
        else I.o[item] = x[item];
      });
    }
    I.nextCache = {};
    paintAll(I);
  }
  function setQ(I, v) {
    I.r.q = v;
    resetLimit(I);
    if (query(I)) {
      var node = $(I, '.cbl-count');
      return;
    }
    paintList(I);
  }
  function toggleRow(I, id, focus) {
    var R = I.r;
    R.hl = id;
    if (R.allOpen) R.open[id + '#closed'] = !R.open[id + '#closed'];
    else R.open[id] = !R.open[id];
    var keep = I.el.querySelector('.cbl-list'),
      top = keep ? keep.scrollTop : 0;
    paintList(I);
    if (keep) {
      var node = $(I, ':scope > .cbl-list');
      if (node) node.scrollTop = top;
    }
    if (focus) refocusRow(I, id);
  }
  function refocusRow(I, id) {
    var node = I.el.querySelector('[data-row="' + (root.CSS && root.CSS.escape ? root.CSS.escape(id) : id) + '"]');
    if (node) node.focus();
  }
  function rowById(I, id) {
    var all = allRows(I),
      r = null;
    all.forEach(function (x, index) {
      if (r == null && rid(I, x, index) === id) r = x;
    });
    return r;
  }
  function openRow(I, id, ev) {
    var row = rowById(I, id);
    if (!row) return;
    I.r.hl = id;
    if (I.o.onOpen) {
      safe(function () {
        I.o.onOpen(row, ev);
      });
      return;
    }
    if (hasNext(I)) toggleRow(I, id, ev && ev.type === 'keydown');
  }
  function closePop(list, refocus) {
    if (!list.pop) return;
    var was = list.pop;
    list.pop = null;
    list.pv = null;
    paintTitle(list);
    paintTools(list);
    if (refocus) {
      var node = list.el.querySelector('[data-cbl-pop="' + was + '"]');
      if (node) node.focus();
    }
  }
  function togglePop(list, name) {
    list.pop = list.pop === name ? null : name;
    paintTitle(list);
    paintTools(list);
    var node = list.el.querySelector('.cbl-pop');
    if (node) {
      var f = node.querySelector('select,input:not([disabled]),button:not([disabled])');
      if (f && name !== 'period') f.focus();
    }
  }

  function csv(I) {
    var m = matched(I),
      cols = shownCols(I);
    var q = function (text) {
      text = String(text == null ? '' : text);
      return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    };
    var lines = [
      cols
        .map(function (item) {
          return q(item.label || item.key);
        })
        .join(',')
    ];
    m.rows.forEach(function (item) {
      lines.push(
        cols
          .map(function (c) {
            var v = safe(function () {
              return c.cell ? c.cell(item) : item[c.key];
            }, '');
            return q(c.html ? plain(v) : v);
          })
          .join(',')
      );
    });
    return lines.join('\r\n');
  }
  function download(I) {
    if (typeof I.o.csv === 'function') {
      safe(function () {
        I.o.csv(matched(I).rows, shownCols(I), csv(I));
      });
      return;
    }
    try {
      var b = new root.Blob(['﻿' + csv(I)], { type: 'text/csv;charset=utf-8' }),
        u = root.URL.createObjectURL(b),
        node = root.document.createElement('a');
      node.href = u;
      node.download = I.key + '.csv';
      root.document.body.appendChild(node);
      node.click();
      node.remove();
      setTimeout(function () {
        root.URL.revokeObjectURL(u);
      }, 2000);
    } catch (_) {}
  }

  /* ═════ events: one set of delegated listeners on the mount element, so it dies with it ═════ */
  function wire(I) {
    var el = I.el;
    /* every listener is remembered so teardown can remove it: a list mounted again on the same element must not leave the old one answering too */
    I.off = [];
    var on = function (type, fn) {
      var h = function (ev) {
        if (!I.dead) fn(ev);
      };
      el.addEventListener(type, h);
      I.off.push([type, h]);
    };
    on('click', function (ev) {
      onClick(I, ev);
    });
    on('input', function (ev) {
      var t = ev.target;
      if (t.hasAttribute && t.hasAttribute('data-cbl-q')) {
        setQ(I, t.value);
      }
    });
    on('change', function (ev) {
      onChange(I, ev);
    });
    on('keydown', function (ev) {
      onKey(I, ev);
    });
    on('pointerdown', function (ev) {
      onPointerDown(I, ev);
    });
    on('dblclick', function (ev) {
      var node = ev.target.closest && ev.target.closest('[data-rz]');
      if (!node) return;
      delete I.s.widths[node.getAttribute('data-rz')];
      saveChoices(I);
      paintList(I);
      refocusRz(I, node.getAttribute('data-rz'));
    });
  }
  function refocusRz(I, k) {
    var node = I.el.querySelector('[data-rz="' + k + '"]');
    if (node) node.focus();
  }
  function onClick(list, ev) {
    var node = ev.target;
    if (!node.closest) return;
    var b = node.closest('button,[data-row],input[type=checkbox],select'),
      R = list.r,
      s = list.s,
      o = list.o;
    var pop = node.closest('.cbl-pop');
    var hcell = node.closest('.cbl-hc');
    if (hcell && !node.closest('.cbl-rz') && !node.closest('[data-sort]') && !node.closest('[data-hf]') && list.el.contains(hcell)) {
      var sbtn = hcell.querySelector('[data-sort]');
      if (sbtn) {
        sbtn.click();
        return;
      }
    }
    var gh = node.closest('[data-g]');
    if (gh && list.el.contains(gh) && !(b && b.hasAttribute('data-row'))) {
      if (list.pop) {
        list.pop = null;
        paintTitle(list);
        paintTools(list);
      }
      R.gcol[gh.getAttribute('data-g')] = !R.gcol[gh.getAttribute('data-g')];
      paintList(list);
      var g2 = list.el.querySelector('[data-g="' + cssId(gh.getAttribute('data-g')) + '"]');
      if (g2) g2.focus();
      return;
    }
    if (!b) {
      if (list.pop && !pop) closePop(list);
      return;
    }
    if (b.hasAttribute('data-rz')) return;
    if (b.hasAttribute('data-cbl-pop')) {
      togglePop(list, b.getAttribute('data-cbl-pop'));
      return;
    }
    if (b.hasAttribute('data-hf')) {
      var er = list.el.getBoundingClientRect(),
        br = b.getBoundingClientRect();
      list.hfAt = { l: Math.max(4, Math.min(br.left - er.left, er.width - 190)), t: br.bottom - er.top + 4 };
      togglePop(list, 'hf:' + b.getAttribute('data-hf'));
      paintList(list);
      return;
    }
    if (b.hasAttribute('data-hfv')) {
      var hk = b.getAttribute('data-hfk'),
        hv = b.getAttribute('data-hfv');
      if (hv) R.filt[hk] = hv;
      else delete R.filt[hk];
      list.pop = null;
      resetLimit(list);
      if (query(list)) {
        paintTools(list);
        paintList(list);
      } else paintAll(list);
      return;
    }
    if (b.hasAttribute('data-view-tab')) {
      var vw = ((o.views && o.views.items) || []).filter(function (x) {
        return x.key === b.getAttribute('data-view-tab');
      })[0];
      if (vw) {
        R.filt = {};
        Object.keys(vw.filt || {}).forEach(function (item) {
          R.filt[item] = vw.filt[item];
        });
        list.pop = null;
        resetLimit(list);
        paintAll(list);
      }
      return;
    }
    if (list.pop && !pop) {
      /* any other click outside the popover closes it, then does its own job */ list.pop = null;
      paintTitle(list);
      paintTools(list);
    }
    var d = b.dataset || {};
    if (b.hasAttribute('data-period')) {
      var pp = head(list).period;
      if (pp) {
        list.pv = d.period;
        if (d.period !== 'custom') {
          list.pop = null;
          list.pv = null;
        }
        safe(function () {
          pp.onPick(d.period, null);
        });
        paintTitle(list);
        paintTools(list);
      }
      return;
    }
    if (d.notice != null) {
      var n = (head(list).notices || [])[+d.notice];
      if (list.pop === 'notes') {
        list.pop = null;
        paintTitle(list);
      }
      if (n && n.onOpen)
        safe(function () {
          n.onOpen();
        });
      return;
    }
    if (d.group) {
      s.group = d.group;
      resetLimit(list);
      saveChoices(list);
      if (!query(list)) {
        paintTools(list);
        paintList(list);
      } else paintTools(list);
      return;
    }
    if (d.view) {
      s.view = d.view;
      saveChoices(list);
      paintTools(list);
      paintList(list);
      return;
    }
    if (b.hasAttribute('data-cbl-exp')) {
      R.allOpen = !R.allOpen;
      R.open = {};
      paintTools(list);
      paintList(list);
      return;
    }
    if (b.hasAttribute('data-cbl-csv')) {
      download(list);
      return;
    }
    if (d.unfilt) {
      delete R.filt[d.unfilt];
      resetLimit(list);
      if (query(list)) paintTools(list);
      else paintAll(list);
      return;
    }
    if (b.hasAttribute('data-cbl-clearf')) {
      R.filt = {};
      resetLimit(list);
      list.pop = null;
      if (query(list)) paintTools(list);
      else paintAll(list);
      return;
    }
    if (b.hasAttribute('data-cbl-clear')) {
      R.filt = {};
      R.q = '';
      list.pop = null;
      resetLimit(list);
      if (query(list)) paintTools(list);
      paintAll(list);
      return;
    }
    if (b.hasAttribute('data-cbl-retry')) {
      if (o.onRetry)
        safe(function () {
          o.onRetry();
        });
      return;
    }
    if (b.hasAttribute('data-cbl-more')) {
      list.limit += 50;
      paintList(list);
      return;
    }
    if (b.hasAttribute('data-cbl-resetcols')) {
      s.cols = null;
      s.widths = {};
      saveChoices(list);
      paintTools(list);
      paintList(list);
      return;
    }
    if (b.hasAttribute('data-cbl-selmode')) {
      R.selMode = !R.selMode;
      if (!R.selMode) R.sel = {};
      paintTools(list);
      paintList(list);
      return;
    }
    if (b.hasAttribute('data-cbl-selall')) {
      matched(list).rows.forEach(function (item, index) {
        R.sel[rid(list, item, index)] = true;
      });
      paintTools(list);
      paintList(list);
      return;
    }
    if (d.bulk) {
      var bk = (o.bulk || []).filter(function (x) {
        return x.id === d.bulk;
      })[0];
      if (bk)
        safe(function () {
          bk.run(selectedRows(list));
        });
      return;
    }
    if (d.mv) {
      var set = shownKeys(list).slice(),
        i = set.indexOf(d.mv),
        j = i + +d.d;
      if (i < 0 || j < 0 || j >= set.length) return;
      set.splice(j, 0, set.splice(i, 1)[0]);
      s.cols = set;
      saveChoices(list);
      paintTools(list);
      paintList(list);
      return;
    }
    if (d.col) return; /* the checkbox acts on 'change' */
    if (d.sort) {
      /* a server-sorted page decides its own direction: it is told which heading was clicked */
      if (remote(list)) {
        query(list, 'sort', { key: d.sort }, true);
        return;
      }
      var cur = curSort(list),
        col = columns(list).filter(function (item) {
          return sortId(item) === d.sort;
        })[0],
        d0 = col && col.dir0 === -1 ? -1 : 1;
      s.sort = cur && cur.key === d.sort ? { key: d.sort, dir: -cur.dir } : { key: d.sort, dir: d0 };
      resetLimit(list);
      saveChoices(list);
      paintList(list);
      return;
    }
    if (d.act) {
      var act = (o.actions || []).filter(function (x) {
          return x.id === d.act;
        })[0],
        row = rowById(list, d.actrow);
      if (act && row)
        safe(function () {
          act.run(row);
        });
      return;
    }
    if (b.hasAttribute('data-selrow')) {
      return;
    }
    if (b.hasAttribute('data-caret') || node.closest('[data-caret]')) {
      var rr = node.closest('[data-row]');
      if (rr) toggleRow(list, rr.getAttribute('data-row'), false);
      return;
    }
    var rowEl = node.closest('[data-row]');
    if (rowEl && b === rowEl) {
      /* a control the page drew inside a cell (a link, a chip, a button with its own onclick) keeps its own job */
      var inner = node.closest('a,button,input,select,textarea,label,[onclick],[data-nolist]');
      if (inner && inner !== rowEl && rowEl.contains(inner)) return;
      openRow(list, rowEl.getAttribute('data-row'), ev);
    }
  }
  function onChange(list, ev) {
    var node = ev.target,
      R = list.r,
      s = list.s;
    if (node.hasAttribute('data-col')) {
      var k = node.getAttribute('data-col'),
        set = shownKeys(list).slice(),
        i = set.indexOf(k);
      if (node.checked && i < 0) set.push(k);
      else if (!node.checked && i >= 0 && k !== topKey(list)) set.splice(i, 1);
      s.cols = set;
      saveChoices(list);
      paintTools(list);
      paintList(list);
      refocusCol(list, k);
      return;
    }
    if (node.hasAttribute('data-gsel')) {
      s.group = node.value;
      resetLimit(list);
      saveChoices(list);
      if (!query(list)) {
        paintTools(list);
        paintList(list);
      } else paintTools(list);
      var gs = list.el.querySelector('#cbl-gsel-' + cssId(list.key));
      if (gs) gs.focus();
      return;
    }
    if (node.hasAttribute('data-filt')) {
      var fk = node.getAttribute('data-filt');
      if (node.value) R.filt[fk] = node.value;
      else delete R.filt[fk];
      resetLimit(list);
      if (!query(list)) {
        paintTools(list);
        paintList(list);
      } else paintTools(list);
      var f = list.el.querySelector('#cbl-f-' + cssId(list.key) + '-' + cssId(fk));
      if (f) f.focus();
      return;
    }
    if (node.hasAttribute('data-cbl-sort')) {
      var cur = s.sort ? s.sort.dir : 1;
      s.sort = { key: node.value, dir: 1 };
      resetLimit(list);
      saveChoices(list);
      if (!query(list)) {
        paintTools(list);
        paintList(list);
      }
      var ss = list.el.querySelector('#cbl-sort-' + cssId(list.key));
      if (ss) ss.focus();
      return;
    }
    if (node.hasAttribute('data-selrow')) {
      var id = node.getAttribute('data-selrow');
      if (node.checked) R.sel[id] = true;
      else delete R.sel[id];
      paintTools(list);
      return;
    }
    if (node.hasAttribute('data-cbl-from') || node.hasAttribute('data-cbl-to')) {
      var p = head(list).period,
        fr = list.el.querySelector('[data-cbl-from]'),
        to = list.el.querySelector('[data-cbl-to]');
      if (p && fr && to && fr.value && to.value) {
        p.custom = { from: fr.value, to: to.value };
        list.pv = null;
        list.pop = null;
        safe(function () {
          p.onPick('custom', p.custom);
        });
      }
    }
  }
  function cssId(s) {
    return String(s).replace(/[^A-Za-z0-9_\-]/g, '\\$&');
  }
  function refocusCol(I, k) {
    var node = I.el.querySelector('[data-col="' + k + '"]');
    if (node) node.focus();
  }

  function onKey(list, event) {
    var node = event.target,
      k = event.key;
    if (k === 'Escape' && list.pop) {
      event.preventDefault();
      closePop(list, true);
      return;
    }
    if (node.hasAttribute && node.hasAttribute('data-rz') && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      event.preventDefault();
      var rtl = root.getComputedStyle(list.el).direction === 'rtl',
        dlt = (k === 'ArrowRight' ? 8 : -8) * (rtl ? -1 : 1);
      resize(list, node.getAttribute('data-rz'), dlt, true);
      return;
    }
    if (node.hasAttribute && node.hasAttribute('data-g') && (k === 'Enter' || k === ' ')) {
      event.preventDefault();
      node.click();
      return;
    }
    var rowEl = node.closest && node.closest('[data-row]');
    if (rowEl && node === rowEl) {
      if (k === 'Enter' || k === ' ') {
        event.preventDefault();
        openRow(list, rowEl.getAttribute('data-row'), event);
        return;
      }
      if (k === 'ArrowRight' && hasNext(list) && !isOpen(list, rowEl.getAttribute('data-row'))) {
        event.preventDefault();
        toggleRow(list, rowEl.getAttribute('data-row'), true);
        return;
      }
      if (k === 'ArrowLeft' && hasNext(list) && isOpen(list, rowEl.getAttribute('data-row'))) {
        event.preventDefault();
        toggleRow(list, rowEl.getAttribute('data-row'), true);
        return;
      }
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        event.preventDefault();
        var all = [].slice.call(list.el.querySelectorAll('[data-row]')),
          i = all.indexOf(rowEl),
          nx = all[i + (k === 'ArrowDown' ? 1 : -1)];
        if (nx) {
          nx.focus();
          if (list.o.hl === false) return;
          list.r.hl = nx.getAttribute('data-row');
          [].forEach.call(list.el.querySelectorAll('.cbl-row.sel,.cbl-lrec.sel'), function (node) {
            node.classList.remove('sel');
          });
          nx.classList.add('sel');
        }
      }
    }
  }

  /* adjustable columns: pointer (mouse and touch), ← → in 8 px, double-click resets; never narrower than the label; remembered */
  function colByKey(I, key) {
    return columns(I).filter(function (item) {
      return item.key === key;
    })[0];
  }
  function resize(I, key, delta, kb) {
    var c = colByKey(I, key);
    if (!c) return;
    I.s.widths[key] = Math.max(minW(I, c), widthOf(I, c) + delta);
    saveChoices(I);
    paintList(I);
    if (kb) refocusRz(I, key);
  }
  function applyTpl(I) {
    var tpl = template(I, shownCols(I));
    [].forEach.call(I.el.querySelectorAll('.cbl-hdr,.cbl-row'), function (node) {
      node.style.gridTemplateColumns = tpl;
    });
  }
  function onPointerDown(I, event) {
    var node = event.target.closest && event.target.closest('[data-rz]');
    if (!node) return;
    var c = colByKey(I, node.getAttribute('data-rz'));
    if (!c) return;
    event.preventDefault();
    DRAG = { I: I, key: c.key, x: event.clientX, w: widthOf(I, c), c: c, btn: node };
    node.classList.add('drag');
    try {
      node.setPointerCapture(event.pointerId);
    } catch (_) {}
    root.document.addEventListener('pointermove', onPointerMove);
    root.document.addEventListener('pointerup', onPointerUp);
    root.document.addEventListener('pointercancel', onPointerUp);
  }
  function onPointerMove(ev) {
    if (!DRAG) return;
    var I = DRAG.I,
      rtl = root.getComputedStyle(I.el).direction === 'rtl';
    I.s.widths[DRAG.key] = Math.max(minW(I, DRAG.c), DRAG.w + (ev.clientX - DRAG.x) * (rtl ? -1 : 1));
    applyTpl(I);
  }
  function onPointerUp() {
    if (!DRAG) return;
    var I = DRAG.I;
    DRAG.btn.classList.remove('drag');
    root.document.removeEventListener('pointermove', onPointerMove);
    root.document.removeEventListener('pointerup', onPointerUp);
    root.document.removeEventListener('pointercancel', onPointerUp);
    DRAG = null;
    saveChoices(I);
  }

  /* one document-level listener each: a click anywhere outside a mounted list closes its popover; a resize refits every list to its window */
  if (root.document && root.document.addEventListener) {
    root.document.addEventListener('click', function (ev) {
      if (ev.target && ev.target.isConnected === false) return; /* the click repainted its own button away: that was a click INSIDE the list */
      INST.forEach(function (item) {
        if (item.pop && !item.dead && !item.el.contains(ev.target)) closePop(item);
      });
    });
    /* ↑ ↓ move the highlighted row and Enter opens it, wherever the focus is not (a page with a list on it, nothing focused): the page does not wire this */
    root.document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        var open = INST.filter(function (item) {
          return !item.dead && item.pop;
        });
        if (open.length) {
          event.preventDefault();
          closePop(open[open.length - 1], true);
          return;
        }
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return;
      if (event.defaultPrevented) return; /* a list's own handler already took it (and may have repainted its target away) */
      var node = event.target;
      if (node && node.isConnected === false) return;
      if (node && node.tagName && /^(INPUT|SELECT|TEXTAREA|BUTTON|A|SUMMARY)$/.test(node.tagName)) return;
      if (node && node.closest && (node.closest('[data-cbl] [data-row]') || node.closest('dialog[open],[role=dialog],[aria-modal=true]'))) return;
      var live = INST.filter(function (item) {
          return !item.dead && item.o.hl !== false && item.el.getClientRects().length;
        }),
        I = live[live.length - 1];
      if (!I) return;
      var rows = [].slice.call(I.el.querySelectorAll('[data-row]'));
      if (!rows.length) return;
      if (event.key === 'Enter') {
        if (I.r.hl) {
          event.preventDefault();
          openRow(I, I.r.hl, event);
        }
        return;
      }
      var at = rows
        .map(function (item) {
          return item.getAttribute('data-row');
        })
        .indexOf(I.r.hl);
      at = event.key === 'ArrowDown' ? Math.min(rows.length - 1, at + 1) : Math.max(0, at < 0 ? 0 : at - 1);
      event.preventDefault();
      I.r.hl = rows[at].getAttribute('data-row');
      rows.forEach(function (item, index) {
        item.classList.toggle('sel', index === at);
      });
      if (rows[at].scrollIntoView) rows[at].scrollIntoView({ block: 'nearest' });
    });
    root.addEventListener('resize', function () {
      prune();
      INST.forEach(function (item) {
        fit(item);
        setHdrH(item, item.el.querySelector('.cbl-list') || item.el);
        var n = item.el.clientWidth > 0 && item.el.clientWidth <= 640;
        if (n !== item.narrow) paintTitle(item);
      });
    });
  }

  /* the rows a next level is made of: the first cell takes the room, the others are fixed-width and right-aligned (cells are the page's own trusted markup) */
  function nextRow(cells, widths) {
    return (
      '<div class="cbl-nrow" style="display:flex;align-items:center;font-size:calc(13.5px * var(--k,1));padding:3px 0">' +
      cells
        .map(function (item, index) {
          return index === 0
            ? '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + item + '</span>'
            : '<span style="width:' + ((widths && widths[index - 1]) || 110) + 'px;text-align:end">' + item + '</span>';
        })
        .join('') +
      '</div>'
    );
  }
  function get(key) {
    prune();
    var f = null;
    INST.forEach(function (item) {
      if (item.key === String(key) && !item.dead) f = item.api;
    });
    return f;
  }

  /* forget what a person typed, chose and opened in list `key` (a different record is on screen under the same list: a new ledger, the other tab) */
  function reset(key) {
    delete STATE[String(key)];
  }

  /**
   * EVERY PAGE of a server-paged list (DISCIPLINES §2: top-level total · page · limit), for a screen that sums the WHOLE set
   * rather than drawing it (the test board's coverage and verdicts — T2-PAGING). `fetchPage(n)` answers page n: an array, or
   * an object holding the rows under `key`. Pages are read until the rows reach the answer's `total` (an answer with no
   * total is one page). Resolves to every row; a failed page rejects, so the caller says it could not read.
   */
  function every(fetchPage, key) {
    var all = [];
    function step(page) {
      return Promise.resolve(fetchPage(page)).then(function (reply) {
        var rows = Array.isArray(reply) ? reply : (reply && reply[key]) || [];
        all = all.concat(rows);
        var more = rows.length && reply.total != null && all.length < reply.total && !(reply.limit && rows.length < reply.limit) && page < 200;
        return more ? step(page + 1) : all;
      });
    }
    return step(1);
  }

  root.CBList = { mount: mount, nextRow: nextRow, get: get, reset: reset, every: every };
})(typeof window !== 'undefined' ? window : this);
