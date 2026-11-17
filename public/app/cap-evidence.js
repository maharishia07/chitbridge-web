/**
 * cap-evidence.js — CMP062 the Evidence chip and CMP063 the Evidence sheet: what stands behind a books row (ASA 500: the auditor vouches an entry to its source).
 * A chip on each Day book row says what is held: the files on its source document (Evidence 2), none yet (No file), no source document at all (No source: an opening balance, a receipt or a journal, so nothing to attach to; the firm, owner and adviser Day books paint a quiet dash there, not a pill), or, for a purchase that claims GST above the tax-invoice threshold with no file,
 * No tax invoice (a warning). A press opens the sheet: the source document (its number) and its files; a file opens in a new tab.
 *
 * OWNS      the chip html · the sheet · the one door a file is read through (GET /api/books/evidence/:id, with the seat's own headers, never cached)
 * CALLED BY cap-books.js (the owner's and the adviser's Day book) · books-grant-view.js (the auditor's Day book) · books-grant-drill.js (the entry sheet)
 * FLOW      use({ raw }) → ingest(entries) once per page (the server sent `evidence` on each entry: nothing is computed here) → chip(entry) in each row → a press → sheet(entry) → a file → raw(path) → a blob → a new tab
 * CARD      14-accounting/ACC-358-AUDIT-MARKERS-REQUIREMENT
 *
 * ⭐ The server decides: the flag, its sentence and its cite arrive in `entry.evidence`; this file paints them and works out no tax and no threshold. A file is fetched with the Bearer token and the seat's headers (X-Books-For for a firm),
 * so a revoked grant stops at the next press. Only images and PDFs open for viewing; everything else downloads (the server says the same).
 *
 *   CBEvidence.use({ raw(path) → Promise<Response> }) → { ingest(list) · chip(entry) · sheet(entry, { opener }) }
 */
(function (root) {
  'use strict';
  var doc = root.document;
  var seen = {}; /* entry_id → { entry, ctl }: the entries the page ingested, so a press finds its row */

  function T(s) {
    return typeof root.tx === 'function' ? root.tx(s) : s;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  var W = {
    flag: 'No tax invoice',
    none: 'No file',
    nodoc: 'No source',
    evidence: 'Evidence',
    head: 'Evidence for {no}',
    source: 'Source document',
    noSource: 'This entry has no source document (an opening balance, a receipt or a hand-keyed journal).',
    noFiles: 'No file is held on this document yet.',
    files: 'Files held',
    close: 'Close',
    open: 'Open',
    flagWhy: 'GST is claimed on this purchase and no tax invoice is held on it.',
    rule: 'Rule read',
    failed: 'Could not open that file. Nothing was changed.',
    ended: 'Access to these books has ended.',
    claimOne: '{amount} of {box} is from 1 purchase with no tax invoice. You need the tax invoice to claim it.',
    claimMany: '{amount} of {box} is from {n} purchases with no tax invoice. You need the tax invoice to claim it.',
    claimRiskOne: '{amount}{kind} if the {n} purchase without a tax invoice is not claimed',
    claimRiskMany: '{amount}{kind} if the {n} purchases without a tax invoice are not claimed',
    claimBox: 'the tax you claim',
    claimSee: 'See them'
  };
  var CSS =
    '.ev{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line,#DDD6C6);border-radius:99px;background:var(--card,#fff);color:inherit;font:inherit;font-size:var(--fs-1,12px);font-weight:700;padding:3px 10px;min-height:28px;cursor:pointer;white-space:nowrap}' +
    '.ev:focus-visible{outline:2px solid var(--blue,#1f5fa8);outline-offset:2px}' +
    '.ev-ok{border-color:var(--ok,#2E8B57);color:var(--ok-3,#0F5132)}' +
    '.ev-warn{border-color:var(--warn,#B7791F);background:var(--warn-tint,#FFF4D6);color:var(--warn-3,#7A4B00)}' +
    '.ev-quiet{color:var(--grey,#5E594D);font-weight:600}' +
    'dialog.ev-sheet{border:1px solid var(--line,#DDD6C6);border-radius:14px;padding:0;width:min(520px,calc(100vw - 24px));max-height:calc(100vh - 24px);background:var(--card,#fff);color:var(--ink,#1D1B16)}' +
    'dialog.ev-sheet::backdrop{background:rgba(0,0,0,.4)}' +
    '.ev-in{padding:14px 16px;display:flex;flex-direction:column;gap:10px}' +
    '.ev-hd{display:flex;gap:8px;align-items:flex-start;justify-content:space-between}.ev-hd h2{margin:0;font-size:var(--fs-3,17px)}' +
    '.ev-x{border:0;background:transparent;font:inherit;font-size:20px;line-height:1;min-width:44px;min-height:44px;cursor:pointer;color:var(--grey,#5E594D)}' +
    '.ev-sub{font-size:var(--fs-1,12px);color:var(--grey,#5E594D)}' +
    '.ev-warnbox{border:1px solid var(--warn,#B7791F);background:var(--warn-tint,#FFF4D6);color:var(--warn-3,#7A4B00);border-radius:8px;padding:8px 10px;font-size:var(--fs-2,14px);font-weight:700}' +
    '.ev-warnbox small{display:block;font-weight:400;margin-top:4px;font-size:var(--fs-1,12px)}' +
    '.ev-list{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none}' +
    '.ev-file{display:flex;gap:8px;align-items:center;justify-content:space-between;width:100%;box-sizing:border-box;border:1px solid var(--line,#DDD6C6);border-radius:10px;background:var(--card,#fff);color:inherit;font:inherit;font-size:var(--fs-2,14px);padding:8px 12px;min-height:44px;cursor:pointer;text-align:start}' +
    '.ev-file b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ev-file span{color:var(--grey,#5E594D);font-size:var(--fs-1,12px);white-space:nowrap}' +
    '.ev-out{font-size:var(--fs-1,12px);min-height:1em}.ev-out[data-tone=error]{color:var(--disp,#8E3517);font-weight:700}' +
    '@media (max-width:700px){.ev{min-height:44px;padding:3px 12px}}';
  var cssDone = false;
  function addCss() {
    if (cssDone || !doc) return;
    cssDone = true;
    var node = doc.createElement('style');
    node.setAttribute('data-cbevidence', '1');
    node.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(node);
  }
  function sizeWords(bytes) {
    var n = Number(bytes) || 0;
    return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B';
  }

  /** the chip's state from what the server sent: { key, rank, tone, word } (key = the Day book's Evidence filter; rank = its sort, the ones needing action first) */
  function stateOf(ev) {
    if (ev.flag === 'no_tax_invoice') return { key: 'flag', rank: 0, tone: 'warn', word: T(W.flag), sym: '⚠' };
    if (ev.count > 0) return { key: 'held', rank: 3, tone: 'ok', word: T(W.evidence) + ' ' + ev.count, sym: '📎' };
    if (ev.doc) return { key: 'none', rank: 1, tone: 'quiet', word: T(W.none), sym: '○' };
    return { key: 'nodoc', rank: 2, tone: 'quiet', word: T(W.nodoc), sym: '○' };
  }

  function use(cfg) {
    addCss();
    var ctl = {
      cfg: cfg || {},
      /** remember the page's entries (the rows the chips stand on) */
      ingest: function (list) {
        (list || []).forEach(function (entry) {
          if (entry && entry.entry_id) seen[String(entry.entry_id)] = { entry: entry, ctl: ctl };
        });
      },
      /** the chip for an entry (html); empty when the server sent no evidence (an older server) */
      chip: function (entry) {
        var ev = entry && entry.evidence;
        if (!ev || !entry.entry_id) return '';
        if (!seen[String(entry.entry_id)]) ctl.ingest([entry]);
        var s = stateOf(ev);
        return (
          '<button type="button" class="ev ev-' + s.tone + '" data-cbsid="CMP062-B01" data-ev-open="' + esc(entry.entry_id) + '" data-tone="' + s.tone + '" data-testid="ev-chip-' + esc(entry.entry_no || entry.entry_id) + '">' +
          '<span aria-hidden="true">' + s.sym + '</span> ' + esc(s.word) + '</button>'
        );
      },
      sheet: function (entry, o) {
        return openSheet(ctl, entry, o || {});
      }
    };
    return ctl;
  }

  /** the page a tab shows for a file: its name as the TITLE (a blob url alone would title the tab with a bare id) and the file in the browser's own viewer (a PDF in the PDF plugin, an image as an image) */
  function viewerPage(name, kind, fileUrl) {
    var label = esc(name || 'file');
    var body = kind === 'pdf' ? '<embed type="application/pdf" src="' + fileUrl + '">' : '<img alt="' + label + '" src="' + fileUrl + '">';
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + label + '</title><style>html,body{margin:0;height:100%;background:#525659}embed{width:100%;height:100%;display:block}img{max-width:100%;max-height:100%;display:block;margin:0 auto}</style></head><body>' + body + '</body></html>';
  }
  /** a link pressed on the page: the browser opens the tab itself, with no opener (a script that opens about:blank and sets its address later loses the blob: Chrome keys a blob url to the page that made it) */
  function pressLink(href, name, download) {
    var a = doc.createElement('a');
    a.href = href;
    a.rel = 'noopener noreferrer';
    if (download) a.download = name || 'file';
    else a.target = '_blank';
    (doc.body || doc.documentElement).appendChild(a);
    a.click();
    a.remove();
  }
  var alive = []; /* the blob urls of opened files: kept until this page goes, so a tab that is reloaded still finds its file (nothing is stored beyond the page) */
  if (root.addEventListener) root.addEventListener('pagehide', function () { alive.forEach(function (u) { try { root.URL.revokeObjectURL(u); } catch (_) { /* gone */ } }); alive = []; });

  /** open one file through the seat's own door: images and PDFs in a new tab titled with the file's name; anything else downloads */
  function openFile(ctl, file, out) {
    function fail(text) {
      out.setAttribute('data-tone', 'error');
      out.textContent = text;
    }
    out.removeAttribute('data-tone');
    out.textContent = '';
    return ctl.cfg.raw('/api/books/evidence/' + encodeURIComponent(file.id)).then(
      function (res) {
        if (!res.ok) return fail(res.status === 403 ? T(W.ended) : T(W.failed));
        return res.blob().then(function (blob) {
          var mime = String(blob.type || '').toLowerCase();
          var fileUrl = root.URL.createObjectURL(blob);
          alive.push(fileUrl);
          var kind = mime === 'application/pdf' ? 'pdf' : /^image\/(png|jpe?g|gif|webp|bmp)$/.test(mime) ? 'image' : null;
          if (!kind) return pressLink(fileUrl, file.name, true);
          var page = root.URL.createObjectURL(new root.Blob([viewerPage(file.name, kind, fileUrl)], { type: 'text/html' }));
          alive.push(page);
          pressLink(page, file.name, false);
        });
      },
      function () { fail(T(W.failed)); }
    );
  }

  /** CMP063 the sheet */
  function openSheet(ctl, entry, o) {
    var ev = entry && entry.evidence;
    if (!ev) return null;
    addCss();
    var dlg = doc.createElement('dialog');
    dlg.className = 'ev-sheet';
    dlg.setAttribute('data-cbsid', 'CMP063-D01');
    dlg.setAttribute('data-pop', 'CMP063');
    dlg.setAttribute('data-testid', 'ev-sheet');
    var no = entry.entry_no || '';
    dlg.setAttribute('aria-label', T(W.head).replace('{no}', no));
    var flag = ev.flag === 'no_tax_invoice' ? '<div class="ev-warnbox" role="status" data-testid="ev-flag">' + esc(ev.flag_why || T(W.flagWhy)) + (ev.cite ? '<small>' + esc(T(W.rule)) + ': ' + esc(ev.cite) + '</small>' : '') + '</div>' : '';
    var srcLine = ev.doc ? '<div data-testid="ev-source"><b>' + esc(T(W.source)) + '</b>: ' + esc(ev.doc.ref || '') + '</div>' : '<div class="ev-sub" data-testid="ev-source">' + esc(T(W.noSource)) + '</div>';
    var files = (ev.files || []).length
      ? '<ul class="ev-list" data-testid="ev-files">' + ev.files.map(function (f, n) {
          return '<li><button type="button" class="ev-file" data-cbsid="CMP063-B02" data-ev-file="' + n + '" data-testid="ev-file-' + n + '"><b>' + esc(f.name) + '</b><span>' + esc(sizeWords(f.size)) + ' · ' + esc(T(W.open)) + '</span></button></li>';
        }).join('') + '</ul>'
      : ev.doc ? '<div class="ev-sub" data-testid="ev-nofiles">' + esc(T(W.noFiles)) + '</div>' : '';
    dlg.innerHTML =
      '<div class="ev-in"><div class="ev-hd"><h2 data-testid="ev-title">' + esc(T(W.head).replace('{no}', no)) + '</h2>' +
      '<button type="button" class="ev-x" data-cbsid="CMP063-B01" data-ev-close="1" aria-label="' + esc(T(W.close)) + '">✕</button></div>' +
      flag + srcLine + files + '<div class="ev-out" role="status" data-testid="ev-out"></div></div>';
    (doc.body || doc.documentElement).appendChild(dlg);
    var out = dlg.querySelector('.ev-out');
    dlg.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!t) return;
      if (t.hasAttribute('data-ev-close')) dlg.close();
      else if (t.hasAttribute('data-ev-file')) openFile(ctl, ev.files[Number(t.getAttribute('data-ev-file'))], out);
    });
    dlg.addEventListener('close', function () {
      dlg.remove();
      if (o.opener && o.opener.focus) try { o.opener.focus(); } catch (_) { /* the row repainted */ }
    });
    if (dlg.showModal) dlg.showModal();
    else dlg.setAttribute('open', '');
    var first = dlg.querySelector('.ev-file') || dlg.querySelector('.ev-x');
    if (first) first.focus();
    return dlg;
  }

  /* a press on a chip, anywhere on the page: capture phase, so the row behind it does not also open */
  if (doc && !root.__cbEvidenceWired) {
    root.__cbEvidenceWired = true;
    doc.addEventListener(
      'click',
      function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-ev-open]') : null;
        if (!b) return;
        var hit = seen[b.getAttribute('data-ev-open')];
        if (!hit) return;
        e.preventDefault();
        e.stopPropagation();
        openSheet(hit.ctl, hit.entry, { opener: b });
      },
      true
    );
  }

  /**
   * the warning on a return: the server carried { count, tax_minor, box } (the Day book's own flag over the period, books-evidence.unsupportedIn) — this words it and adds nothing up.
   * money(minor) is the page's own formatter (it knows the currency). → { text, see } or null when no claimed tax is without its tax invoice.
   */
  function claimWarning(u, money) {
    if (!u || !(u.count > 0) || !(u.tax_minor > 0)) return null;
    addCss(); /* the warning band is painted by a page that has not opened the chip yet */
    var text = T(u.count === 1 ? W.claimOne : W.claimMany)
      .replace('{amount}', money(u.tax_minor))
      .replace('{box}', u.box ? u.box : T(W.claimBox))
      .replace('{n}', String(u.count));
    return { text: text, see: T(W.claimSee) };
  }

  /**
   * ACC-357 (W15-103): the money at risk on the To pay line. The server carried both figures (net_minor, and unsupported_input.net_if_unclaimed_minor — what the return would say if those
   * purchases are not claimed); this words them and adds nothing up. money(minor) is the page's formatter; netMinor is the return's own net. → "A$6,000.00 if the 2 purchases … are not claimed" or null.
   */
  function claimRisk(u, netMinor, money) {
    if (!u || !(u.count > 0) || u.net_if_unclaimed_minor == null) return null;
    var now = Number(u.net_if_unclaimed_minor),
      kind = now < 0 ? ' ' + T('refund') : netMinor < 0 ? ' ' + T('to pay') : '';
    return T(u.count === 1 ? W.claimRiskOne : W.claimRiskMany)
      .replace('{amount}', money(Math.abs(now)))
      .replace('{kind}', kind)
      .replace('{n}', String(u.count));
  }

  root.CBEvidence = { use: use, stateOf: stateOf, claimWarning: claimWarning, claimRisk: claimRisk, words: { flag: W.flag, none: W.none, nodoc: W.nodoc, held: 'File attached' } };
})(typeof window !== 'undefined' ? window : globalThis);
