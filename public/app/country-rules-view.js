/**
 * country-rules-view.js - NZ slice 2 (batch 1131): the client's "Country rules and results" door on the firm's client list.
 *
 * OWNS      the rows of one country's rules (each with the official source the pack cites and its date), the grey sentence of a rule the pack does not confirm,
 *           the client's own return facts as the practice row already carries them, and the door (button + panel) the opened client row draws.
 * CALLED BY books-practice-cells.js (the opened row's detail) · books-practice.js (the click, the country words of the list)
 * FLOW      CBCountryRules.doorHTML(row, kit) → a button and a hidden panel → rulesOf(pack) walks the pack's own members that carry a `cite` → panelHTML(row, kit)
 * CARD      15-tax-and-country-packs/country-lab · REQ-NZ-PACK-2026-11-26 section 4
 *
 * READS the adopted engines only (CBRegulation.packFor): a pack registered tomorrow (NZ) shows with no change here. It types no country's fact and computes nothing: the results are the
 * practice row's own `bas` (the pack's return form and due day), `months_unlocked` and the link to the client's tax return, which holds the boxes. A rule the pack marks
 * unconfirmed, unread or to check shows GREY with its sentence, never as law (grey what is not ready).
 */
(function (root) {
  'use strict';
  var SKIP = /(^|\.)(previous|moveIn)(\.|$)/; /* an older pack version and the move-in maps are not rules of the country */
  var LABEL = {
    'cashRounding': 'Cash rounding', 'slip': 'Words on the bill', 'taxId': 'Tax number format', 'abn': 'Tax number format', 'penalty_unit': 'Penalty unit', 'records': 'Keeping records',
    'tax.timing': 'When tax is counted (invoice or payment)', 'tax.export': 'Export sales', 'tax.taxInvoice': 'Tax invoice contents', 'tax.adjustmentNote': 'Credit and debit notes',
    'tax.registration': 'Registration threshold', 'tax.source': 'Law the tax rules rest on', 'thresholds': 'Thresholds', 'thresholds.registration': 'Registration threshold',
    'returns.g10_g11': 'Purchases boxes on the return', 'returns.unknownKind': 'Supplies the return cannot place'
  };
  /** a sentence for each state a pack gives a rule it does not stand behind */
  var GREY = {
    unconfirmed: 'Not confirmed: the pack holds this rule, but its source has not been checked.',
    unread: 'Not read: the source text was not opened, so this is not stated as law.',
    'cite-check': 'The source needs checking before this is relied on.'
  };
  var SHORT = 170; /* a source longer than this shows its first part; the whole text is the row's title */

  /** the pack for a country code, or null (the registry answers; nothing is typed here) */
  function packOf(code) {
    try {
      return code && root.CBRegulation ? root.CBRegulation.packFor(code) : null;
    } catch (failure) {
      if (root.cbQuiet) root.cbQuiet('country-rules:pack', failure);
      return null;
    }
  }
  /** the country's name: the pack's own ("Australia · GST" shows "Australia"), else the browser's region name, else the code */
  function nameOf(code) {
    var pack = packOf(code), word = pack && pack.name ? String(pack.name).split(' · ')[0] : '';
    if (word) return word;
    try {
      return new root.Intl.DisplayNames(['en'], { type: 'region' }).of(code) || String(code);
    } catch (failure) {
      if (root.cbQuiet) root.cbQuiet('country-rules:name', failure);
      return String(code || '');
    }
  }
  /** "supplyKinds.gst_free" → "Supply: gst free" for a member the table does not name */
  function humanise(path) {
    var parts = path.split('.'), last = parts[parts.length - 1];
    if (/^\d+$/.test(last)) last = parts[parts.length - 2] || last;
    return last.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  }
  function labelOf(path, node) {
    var key = path.replace(/^\./, '').replace(/\.\d+$/, '');
    if (LABEL[key]) return LABEL[key];
    if (/(^|\.)(asset_classes|assetClasses)$/.test(key)) return 'Depreciation: ' + String(node.class || node.name || humanise(key));
    if (/supplyKinds\./.test(key)) return 'Supply: ' + humanise(key);
    return humanise(key);
  }
  /** the date a rule carries: from / to when the row is dated, else '' */
  function datesOf(node) {
    if (node.from && node.to) return node.from + ' to ' + node.to;
    if (node.from) return 'from ' + node.from;
    return '';
  }
  /** one rule row from a pack member that carries a source: { label, cite, dates, status, grey } */
  function ruleOf(path, node) {
    var status = node.status || '';
    return { label: labelOf(path, node), cite: String(node.cite), dates: datesOf(node), status: status, grey: !!status && status !== 'confirmed' };
  }
  /** every member of the pack that carries a `cite`, walked once; two members citing the same text are one rule (the first label) */
  function rulesOf(pack) {
    var out = [], seen = {};
    (function walk(node, path) {
      if (!node || typeof node !== 'object') return;
      if (SKIP.test(path)) return;
      if (typeof node.cite === 'string' && node.cite && !seen[node.cite + '|' + (node.status || '')]) {
        seen[node.cite + '|' + (node.status || '')] = 1;
        out.push(ruleOf(path, node));
      }
      Object.keys(node).forEach(function (key) { walk(node[key], path + '.' + key); });
    })(pack || {}, '');
    return out;
  }
  /** the rows the pack names as out of scope or partial: grey, with the pack's own sentence */
  function scopeOf(pack) {
    var scope = (pack && pack.scope) || {}, out = [];
    ['out', 'partial'].forEach(function (kind) {
      Object.keys(scope[kind] || {}).forEach(function (key) {
        out.push({ label: humanise(key), cite: '', dates: '', status: kind, grey: true, sentence: String(scope[kind][key]), kind: kind });
      });
    });
    return out;
  }
  /** text made safe for HTML: the page's one escape (helpers.js esc), else the five characters */
  function safe(text) { return typeof root.esc === 'function' ? root.esc(text) : String(text == null ? '' : text).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function sentenceOf(rule, say) {
    if (rule.sentence) return say(rule.kind === 'out' ? 'Not in this pack' : 'Only partly in this pack') + ': ' + rule.sentence;
    return say(GREY[rule.status] || 'Not confirmed yet: ' + rule.status);
  }
  function ruleHTML(rule, say, id) {
    var clip = rule.cite.length > SHORT ? rule.cite.slice(0, SHORT).replace(/\s+\S*$/, '') + ' ...' : rule.cite;
    return '<li class="cr-rule' + (rule.grey ? ' cr-grey' : '') + '" data-testid="country-rule-' + id + '"' + (rule.grey ? ' data-grey="1"' : '') + '><b>' + safe(say(rule.label)) + '</b>' +
      (rule.dates ? ' <span class="sub">' + safe(rule.dates) + '</span>' : '') +
      (rule.cite ? '<span class="cr-src sub" title="' + safe(rule.cite) + '">' + safe(say('Source')) + ': ' + safe(clip) + '</span>' : '') +
      (rule.grey ? '<span class="cr-why sub">' + safe(sentenceOf(rule, say)) + '</span>' : '') + '</li>';
  }
  /** this client's own return facts, as its practice row carries them (nothing recomputed): the form, its due day, how many are behind, months not locked */
  function resultLines(row, kit, say) {
    var bas = row.bas || {}, line = function (label, value) { return '<div class="bp-fig"><span class="sub">' + safe(say(label)) + '</span><b>' + value + '</b></div>'; };
    var out = [line('Return', safe(bas.form || say('None yet')))];
    out.push(line('Due', bas.due_date ? safe(kit.dayWords(bas.due_date)) : safe(bas.why ? say(bas.why) : '-')));
    if (bas.overdue) out.push(line('Behind', safe(bas.overdue.n) + ' ' + safe(say(bas.overdue.n === 1 ? 'return' : 'returns'))));
    out.push(line('Months not locked', safe(row.months_unlocked)));
    return out.join('');
  }
  /** the panel: the country, its results, then its rules */
  function panelHTML(row, kit) {
    var say = kit.translate, pack = packOf(row.country), id = safe(row.entity_id);
    if (!pack) return '<p class="sub" data-testid="country-rules-none-' + id + '">' + safe(say(row.pack_missing || 'No rules for this country are held yet.')) + '</p>';
    var rules = rulesOf(pack).concat(scopeOf(pack)), href = kit.returnAddress ? kit.returnAddress(row) : '';
    return '<div class="cr-head"><b>' + safe(nameOf(row.country)) + '</b> <span class="sub">' + safe(say('Rules version')) + ' ' + safe(pack.version || '') + (pack.verified ? '' : ' · ' + safe(say('not marked as checked'))) + '</span></div>' +
      '<h4 class="cr-h">' + safe(say('This client under these rules')) + '</h4><div class="cr-res">' + resultLines(row, kit, say) + '</div>' +
      (href ? '<a class="bp-link" href="' + safe(href) + '" data-cbsid="HOM001-P15" data-testid="country-rules-return-' + id + '">' + safe(say('Open the tax return')) + '</a>' : '') +
      '<h4 class="cr-h">' + safe(say('Rules and where they come from')) + '</h4><ul class="cr-list">' + rules.map(function (rule, at) { return ruleHTML(rule, say, id + '-' + at); }).join('') + '</ul>' +
      '<a class="bp-link" href="/country-lab.html#/countries/' + safe(encodeURIComponent(row.country)) + '" data-cbsid="HOM001-P15" data-testid="country-rules-lab-' + id + '">' + safe(say('Open in the Country Lab')) + '</a>';
  }
  /** the door in the opened row: a button and its hidden panel; nothing for a client with no country */
  function doorHTML(row, kit) {
    if (!row || !row.country) return '';
    var id = safe(row.entity_id);
    return '<div class="bp-fig cr-door" data-testid="country-rules-' + id + '"><button type="button" class="bp-bandtab" data-cbsid="CMP010-B01" data-bp-rules="' + id + '" aria-expanded="false" data-testid="country-rules-open-' + id + '">' +
      safe(kit.translate('Country rules and results')) + '</button><div class="cr-panel" hidden data-testid="country-rules-panel-' + id + '">' + panelHTML(row, kit) + '</div></div>';
  }
  /** the door's press: show or hide its panel */
  function toggle(button) {
    var panel = button.parentNode && button.parentNode.querySelector('.cr-panel');
    if (!panel) return;
    var open = panel.hasAttribute('hidden');
    if (open) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  /** the style of the door and panel: theme tokens only, wraps at 390 px */
  function css() {
    return '.cr-door{display:block}.cr-panel{margin:8px 0;padding:8px 10px;border:1px solid var(--line,#DDD6C6);border-radius:10px;background:var(--card,#fff);max-width:100%}' +
      '.cr-h{margin:10px 0 4px;font-size:14px}.cr-res{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:4px 12px}.cr-list{margin:0;padding:0;list-style:none}' +
      '.cr-rule{display:flex;flex-direction:column;gap:1px;padding:4px 0;border-top:1px solid var(--line,#DDD6C6);overflow-wrap:anywhere}.cr-rule.cr-grey{color:var(--muted,#6B6455);background:var(--grey-t,#F4F1EA)}' +
      '.cr-src,.cr-why{font-size:12px}.cr-why{font-style:italic}@media(max-width:700px){.cr-res{grid-template-columns:1fr 1fr}}';
  }
  /** the style is added to the page once */
  function paintCss() {
    if (!root.document || root.document.getElementById('cr_css')) return;
    var node = root.document.createElement('style');
    node.id = 'cr_css';
    node.textContent = css();
    root.document.head.appendChild(node);
  }
  root.CBCountryRules = { nameOf: nameOf, rulesOf: rulesOf, scopeOf: scopeOf, panelHTML: panelHTML, doorHTML: doorHTML, toggle: toggle, paintCss: paintCss, packOf: packOf };
})(typeof window !== 'undefined' ? window : globalThis);
