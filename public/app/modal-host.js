/**
 * modal-host.js — the popup shell for a page that has no app.html: modal(html, wide, opt) and closeModal(), so ui.dialog (CMP002, public/app/ui.js) opens in place on Home.
 *
 * OWNS      the #modalhost element, the dim backdrop, the corner X (.mx) and Esc / backdrop press to close · the shell's look (theme tokens only)
 * CALLED BY index.html (Home) before assign-bar.js; ui.dialog calls modal() and closeModal() as globals. A page that already defines modal() (app.html) does not load this file, and a second definition is never made.
 * FLOW      ui.dialog → modal(html) → #modalhost.innerHTML → press X / Esc / the backdrop → closeModal() → focus returns to the control that opened it
 * CARD      29-qa-test-tooling-ux-locale-and-design-system/popup
 */
(function (root) {
  'use strict';
  if (typeof root.modal === 'function') return;
  var CSS_ID = 'mh_css', opener = null;
  var MODAL_CSS = '#modalhost .mover{position:fixed;inset:0;z-index:5000;background:var(--scrim,rgba(8,24,32,.45));display:flex;align-items:flex-start;justify-content:center;padding:56px 16px;overflow-y:auto}' +
    '#modalhost .modal{position:relative;width:360px;max-width:94vw;background:var(--card,#fff);color:var(--ink,#1B1B1B);border-radius:14px;overflow:hidden;box-shadow:var(--shadow,0 8px 30px rgba(0,0,0,.25))}#modalhost .modal.wide{width:820px}' +
    '#modalhost .mhd{padding:13px 16px;border-bottom:1px solid var(--line,#DDD6C6);display:flex;align-items:center;gap:8px;padding-inline-end:56px}#modalhost .mhd .t{font-weight:700}#modalhost .mhd .sub{color:var(--grey,#5B5B5B);font-size:13px}' +
    '#modalhost .mbody{padding:12px 16px;max-height:60vh;overflow-y:auto}#modalhost .mfoot{display:flex;justify-content:flex-end;gap:8px;padding:10px 16px;border-top:1px solid var(--line,#DDD6C6)}' +
    '#modalhost .mx{position:absolute;inset-block-start:4px;inset-inline-end:4px;min-width:44px;min-height:44px;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer}' +
    '@media (max-width:680px){#modalhost .mover{padding:18px 7px}}';
  function host() {
    var node = root.document.getElementById('modalhost');
    if (!node) { node = root.document.createElement('div'); node.id = 'modalhost'; root.document.body.appendChild(node); }
    if (!root.document.getElementById(CSS_ID)) { var style = root.document.createElement('style'); style.id = CSS_ID; style.textContent = MODAL_CSS; root.document.head.appendChild(style); }
    return node;
  }
  root.closeModal = function () {
    var node = root.document.getElementById('modalhost');
    if (node) node.innerHTML = '';
    if (opener && root.document.body.contains(opener) && opener.focus) opener.focus();
    opener = null;
  };
  /** the popup: a dim backdrop, the card, the corner X; the body comes from the caller already escaped */
  root.modal = function (html, wide) {
    var node = host();
    if (!node.innerHTML) opener = root.document.activeElement && root.document.activeElement !== root.document.body ? root.document.activeElement : null;
    node.innerHTML = '<div class="mover"><div class="modal' + (wide ? ' wide' : '') + '" data-pop="host" role="dialog" aria-modal="true"><button type="button" class="mx" data-cbsid="CMP005-B01" aria-label="' + (root.tx ? root.tx('Close') : 'Close') + '" title="' + (root.tx ? root.tx('Close') : 'Close') + '">✕</button>' + html + '</div></div>';
    node.querySelector('.mover').addEventListener('click', function (ev) {
      if (ev.target.classList.contains('mover') || (ev.target.closest && ev.target.closest('.mx'))) root.closeModal();
    });
  };
  root.document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && root.document.querySelector('#modalhost .mover')) root.closeModal();
  });
})(typeof window !== 'undefined' ? window : globalThis);
