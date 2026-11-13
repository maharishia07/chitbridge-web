/**
 * ui-field.js — THE FIELD (CMP055, UX-137, docs WEB-FIELD-PART rev 2). One part for a text-like, date, time, checkbox, file and long-text field: a screen never hand-writes
 * a label, a hint, an error or a 44 px input, it MOUNTS one. It widens the Books field (CMP040) and the List field (CMP045), which stay valid as aliases until their pages convert.
 *
 * OWNS       ui.field(options) -> one HTML string (label, control, hint, error) · ui.field.read / set / error / focusFirstError (repaint locally, never rebuild the form) ·
 *            ui.field.parse (the one number reader: typed text + shop locale -> canonical ASCII decimal) · the one delegated input / change / focusout listener.
 * NOT YET    kind 'money' (own PR after this one: the cap-books helper move needs the M36 owners). It is refused here, never faked.
 * CALLED BY  a page that draws a field: shop.html first. Loaded AFTER app/ui.js (it reads ui.words, ui.escape, ui.style and ui.components from it).
 * KEYBOARD   a native control: Tab reaches it, the ring is 2 px --accent; a checkbox is a 44 px row; Enter in a text field commits nothing (a commit is a Save, which confirms).
 * REGISTER   CMP055; elements I01 text-like · I02 date and time · I03 checkbox · I04 file · T01 long text. The element carries data-cbsid, data-cbname="field", data-cbmount.
 * CARD       29-qa-test-tooling-ux-locale-and-design-system/design-system
 * FLOW       none (a drawing library). Spec: docs/critique/WEB-FIELD-PART-2026-11-13.md.
 *
 * THE RULES IT ENFORCES (it throws, because silence is the bug): an unknown property, a missing mount or label, a kind it does not draw, a per-row field without a key,
 * a handler given as a string. The value is CANONICAL (ASCII digits, "." decimal mark, ISO dates); the locale touches only what the person sees and types.
 */
var CBUiField = (function () {
  var MOUNT_CODE = /^[A-Z]{3}\d{3}(?:-D\d{2})?-U\d{2,3}$/;
  var ALLOWED = ['mount', 'kind', 'label', 'id', 'name', 'key', 'value', 'hint', 'error', 'required', 'readonly', 'role', 'min', 'max', 'step', 'maxlength', 'accept', 'rows',
    'autocomplete', 'inputmode', 'placeholder', 'testid', 'cls', 'data', 'attrs', 'onInput', 'onChange'];
  /* the long tail a page may still pass: a closed name list, never free HTML (no on*, style, id, type, value, data-cbsid) */
  var ATTRS = ['list', 'pattern', 'spellcheck', 'autocapitalize', 'enterkeyhint', 'size', 'multiple', 'capture'];
  var KINDS = {
    text: { type: 'text', el: 'I01', auto: 'off' }, search: { type: 'search', el: 'I01', auto: 'off' }, password: { type: 'password', el: 'I01' },
    email: { type: 'email', el: 'I01', dir: 'ltr', auto: 'email' }, phone: { type: 'tel', el: 'I01', dir: 'ltr', auto: 'tel' },
    number: { type: 'text', el: 'I01', dir: 'ltr', mode: 'decimal', auto: 'off', decimal: true },
    percent: { type: 'text', el: 'I01', dir: 'ltr', mode: 'decimal', auto: 'off', decimal: true, suffix: '%' },
    date: { type: 'date', el: 'I02' }, time: { type: 'time', el: 'I02' }, checkbox: { type: 'checkbox', el: 'I03' },
    file: { type: 'file', el: 'I04' }, long: { tag: 'textarea', el: 'T01', auto: 'off' }
  };
  var DIGITS = [['٠', '٩'], ['۰', '۹'], ['०', '९']]; /* Arabic-Indic, Extended Arabic-Indic, Devanagari: each ten code points in a row */
  var HANDLERS = {};
  /* the error colour: the theme has no danger TEXT token (the page's own #b4453f is 2.98:1 on Dark), so it is the red pulled 30% toward the theme's --ink: dark red on Cream, light red on Dark, AA on both (the walk measures it) */
  var CSS =
    '@supports (color:color-mix(in srgb,currentcolor,currentcolor)){:root{--field-bad:color-mix(in srgb,var(--bad-source,#b4453f) 65%,var(--ink,#1d1b16))}}' +
    '.cbf{margin:3px 0 11px;max-width:100%;box-sizing:border-box;min-width:0}' +
    '.cbf-row{display:flex;gap:8px;align-items:baseline;justify-content:space-between}' +
    '.cbf-l{font-size:12px;color:var(--grey-3,var(--dim,#5e594d))}.cbf-req{font-size:11px;color:var(--grey-3,var(--dim,#5e594d))}' +
    '.cbf .cbf-in{display:block;width:100%;max-width:100%;box-sizing:border-box;min-height:max(44px,var(--act-h,44px));margin:3px 0 0;padding:9px;border:1px solid var(--field-edge,#85807C);' +
    'border-radius:8px;font:inherit;font-size:14px;color:var(--ink,#2a2418);background:var(--card,#fff)}' +
    '.cbf textarea.cbf-in{min-height:0;resize:vertical}.cbf .cbf-in[readonly]{background:var(--paper,#f4f0e6)}' +
    '.cbf .cbf-in:focus-visible,.cbf .cbf-fb:focus-within{outline:2px solid var(--accent,#1f5f5b);outline-offset:2px}' +
    '.cbf .cbf-in[aria-invalid="true"]{border-color:var(--field-bad,#b4453f)}' +
    '.cbf-h{font-size:11.5px;color:var(--grey-3,var(--dim,#5e594d));margin-top:3px;overflow-wrap:anywhere}' +
    '.cbf-e{font-size:12.5px;color:var(--field-bad,#b4453f);margin-top:3px;overflow-wrap:anywhere}' +
    '.cbf-c{display:flex;align-items:center;gap:10px;min-height:max(44px,var(--act-h,44px));cursor:pointer;font-size:13px;color:var(--ink,#2a2418)}' +
    '.cbf .cbf-c .cbf-in{display:inline-block;width:24px;min-width:24px;min-height:24px;height:24px;margin:0;padding:0}' +
    '.cbf-fb{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;min-height:max(44px,var(--act-h,44px));padding:10px 12px;' +
    'border:1.5px dashed var(--field-edge,#85807C);border-radius:10px;cursor:pointer;font-weight:600;font-size:12.5px;color:var(--ink,#2a2418);background:var(--card,#fff);text-align:center}' +
    '.cbf .cbf-fb .cbf-in{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;margin:0;min-height:0}' +
    '.cbf-fn{font-weight:400;color:var(--grey-3,var(--dim,#5e594d));overflow-wrap:anywhere}' +
    '.cbf-suf{position:relative}.cbf .cbf-suf .cbf-in{padding-inline-end:30px}.cbf-suf b{position:absolute;inset-inline-end:10px;top:50%;margin-top:-4px;font-weight:400;color:var(--grey-3,var(--dim,#5e594d))}';

  function refuse(reason) {
    throw new Error('ui.field: ' + reason);
  }
  function library() {
    var lib = typeof window !== 'undefined' ? window.ui : null;
    if (!lib || !lib.words || !lib.escape) refuse('app/ui.js must be loaded before app/ui-field.js');
    return lib;
  }
  function say(english, key, values) {
    var text = library().words(english, 'CMP055.' + key);
    return values ? text.replace(/\{(\w+)\}/g, function (whole, name) { return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : whole; }) : text;
  }
  function ensureStyle() {
    library().style();
    if (typeof document === 'undefined' || !document.head || document.getElementById('cbui-field-css')) return;
    var node = document.createElement('style');
    node.id = 'cbui-field-css';
    node.textContent = CSS;
    document.head.appendChild(node);
  }
  function pairs(list) {
    var esc = library().escape;
    return list.filter(function (pair) { return pair[1] !== null && pair[1] !== undefined && pair[1] !== false; })
      .map(function (pair) { return pair[1] === true ? pair[0] : pair[0] + '="' + esc(pair[1]) + '"'; }).join(' ');
  }

  /* ---------- the number reader: one function of (typed text, shop locale) ---------- */
  /** the shop locale's marks, read from CBLocale (never the browser): { mark, group, lakh } ("." and "," for India, Australia and the UAE) */
  function marksOf() {
    var sample = '';
    if (typeof CBLocale !== 'undefined' && CBLocale.number) sample = String(CBLocale.number(1234567.5, { minimumFractionDigits: 1, maximumFractionDigits: 1 })).replace(/[‎‏؜]/g, '');
    var marks = sample.replace(/\d/g, '');
    if (!marks) return { mark: '.', group: ',', lakh: false };
    var parts = sample.split(marks.charAt(0));
    return { mark: marks.charAt(marks.length - 1), group: marks.length > 1 ? marks.charAt(0) : '', lakh: parts.length > 2 && parts[1].length === 2 };
  }
  /** digit sets of other scripts become ASCII; U+066B (Arabic decimal) and U+066C (Arabic grouping) become the shop's marks */
  function asciiDigits(text, marks) {
    return String(text == null ? '' : text).replace(/[٠-٩۰-۹०-९٫٬]/g, function (ch) {
      if (ch === '٫') return marks.mark;
      if (ch === '٬') return marks.group || ',';
      var code = ch.charCodeAt(0);
      for (var at = 0; at < DIGITS.length; at += 1) if (code >= DIGITS[at][0].charCodeAt(0) && code <= DIGITS[at][1].charCodeAt(0)) return String(code - DIGITS[at][0].charCodeAt(0));
      return ch;
    });
  }
  /** is the grouped whole part written in a place this locale groups (thousands, or lakhs where the locale does)? */
  function groupedRight(whole, marks) {
    var group = marks.group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var western = new RegExp('^\\d{1,3}(' + group + '\\d{3})+$');
    var lakh = new RegExp('^\\d{1,2}(' + group + '\\d{2})*' + group + '\\d{3}$');
    return western.test(whole) || (marks.lakh && lakh.test(whole));
  }
  /** ui.field.parse(text, marks?) -> { ok:true, value:'1234.5' } or { ok:false, error:'sentence' }. "1,50" in a "." locale is an ERROR, never 150 and never 1.5. */
  function parse(text, given) {
    var marks = given || marksOf();
    var typed = asciiDigits(text, marks).replace(/[\s  ]/g, '');
    var sign = /^[+-]/.test(typed) ? typed.charAt(0) : '';
    var body = typed.slice(sign.length);
    var cut = body.split(marks.mark);
    if (!body || cut.length > 2 || !/^\d[\d.,]*$|^\d*$/.test(body.replace(marks.mark, ''))) return { ok: false, error: say('That is not a number. Type digits only, like 1234.5', 'badnumber') };
    var whole = cut[0];
    var wrongMark = marks.mark === '.' ? ',' : '.';
    if (cut.length === 1 && whole.split(wrongMark).length === 2 && /^\d+$/.test(whole.split(wrongMark)[0]) && /^\d{1,2}$/.test(whole.split(wrongMark)[1])) {
      return { ok: false, error: say('Use a {mark} before the decimals, like 1{mark}5', 'wrongmark', { mark: marks.mark }) };
    }
    if (marks.group && whole.indexOf(marks.group) >= 0) {
      if (!groupedRight(whole, marks)) return { ok: false, error: say('Check the commas in that number', 'badgroup') };
      whole = whole.split(marks.group).join('');
    }
    if (!/^\d*$/.test(whole) || (whole === '' && !cut[1]) || (cut[1] !== undefined && !/^\d*$/.test(cut[1]))) return { ok: false, error: say('That is not a number. Type digits only, like 1234.5', 'badnumber') };
    if (whole === '') whole = '0';
    whole = whole.replace(/^0+(?=\d)/, '');
    return { ok: true, value: sign + whole + (cut[1] ? '.' + cut[1] : '') };
  }

  /* ---------- the mark-up ---------- */
  function checkOptions(options) {
    if (!options || typeof options !== 'object') refuse('options are required');
    if (options.kind === 'money') refuse('kind "money" is its own part (after the M36 owners confirm); it is not drawn here');
    Object.keys(options).forEach(function (name) { if (ALLOWED.indexOf(name) < 0) refuse('"' + name + '" is not a property of the field'); });
    if (!MOUNT_CODE.test(options.mount || '')) refuse('mount must be a screen mount code like SHP001-U03');
    if (!KINDS[options.kind]) refuse('kind must be ' + Object.keys(KINDS).join(', '));
    if (!options.label || !String(options.label).trim()) refuse('label is required (the accessible name; a placeholder is never the name)');
    ['onInput', 'onChange'].forEach(function (name) { if (options[name] !== undefined && typeof options[name] !== 'function') refuse(name + ' must be a function, never inline JavaScript'); });
    if (options.attrs && (typeof options.attrs !== 'object' || Object.keys(options.attrs).some(function (name) { return ATTRS.indexOf(name) < 0; }))) refuse('attrs is an object of ' + ATTRS.join(', ') + ' only');
  }
  function idOf(options) {
    if (options.id) return String(options.id);
    var tail = options.key === undefined || options.key === null ? '' : '-' + String(options.key).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return options.mount.toLowerCase() + tail;
  }
  /** the reason a field is read-only: role {ok:false, why} (permission) outranks readonly:'sentence' (state); null when it can be typed in */
  function readonlyReason(options) {
    if (options.role && options.role.ok === false) return String(options.role.why || '');
    if (!options.readonly) return null;
    if (typeof options.readonly !== 'string' || !options.readonly.trim()) refuse('readonly: give the reason as a sentence; a locked field always says why');
    return options.readonly;
  }
  function describedBy(id, hasHint, hasError, hasName) {
    return [hasHint ? id + '-h' : '', hasError ? id + '-e' : '', hasName ? id + '-n' : ''].filter(Boolean).join(' ') || null;
  }
  function controlAttributes(kind, options, id, reason) {
    var shape = KINDS[options.kind];
    var inputMode = options.inputmode || shape.mode || null;
    var attrs = Object.keys(options.attrs || {}).map(function (name) { return [name, options.attrs[name]]; });
    var base = [['data-cbsid', 'CMP055-' + shape.el], ['data-cbname', 'field'], ['data-cbmount', options.mount], ['data-cbkind', options.kind], ['id', id], ['name', options.name],
      ['data-testid', options.testid], ['class', 'cbf-in' + (options.cls ? ' ' + options.cls : '')], ['placeholder', options.placeholder], ['autocomplete', options.autocomplete || shape.auto],
      ['inputmode', inputMode], ['dir', shape.dir || (shape.tag || shape.type === 'text' || shape.type === 'search' ? 'auto' : null)], ['min', options.min], ['max', options.max],
      ['step', options.step], ['maxlength', options.maxlength], ['accept', options.accept], ['required', !!options.required], ['readonly', reason !== null],
      ['aria-invalid', options.error ? 'true' : null], ['aria-describedby', describedBy(id, !!(options.hint || reason || shape.decimal || shape.type === 'date'), !!options.error, kind === 'file')]];
    var data = Object.keys(options.data || {}).map(function (suffix) { return ['data-' + suffix, String(options.data[suffix])]; });
    return pairs(base.concat([['type', shape.tag ? null : shape.type], ['rows', shape.tag ? options.rows || 4 : null]], data, attrs));
  }
  function controlHtml(options, id, reason) {
    var shape = KINDS[options.kind], esc = library().escape;
    var attributes = controlAttributes(options.kind, options, id, reason);
    if (shape.tag) return '<textarea ' + attributes + '>' + esc(options.value == null ? '' : options.value) + '</textarea>';
    var checked = shape.type === 'checkbox' ? !!options.value : false;
    var value = shape.type === 'checkbox' || shape.type === 'file' || options.value == null ? '' : options.value;
    var input = '<input ' + attributes + (shape.type === 'checkbox' || shape.type === 'file' ? '' : ' value="' + esc(value) + '"') + (checked ? ' checked' : '') + '>';
    return shape.suffix ? '<span class="cbf-suf">' + input + '<b aria-hidden="true">' + shape.suffix + '</b></span>' : input;
  }
  function noteHtml(options, id, reason) {
    var shape = KINDS[options.kind], esc = library().escape;
    var words = [options.hint, reason].filter(Boolean).map(function (text) { return esc(text); }).join(' · ');
    var echoes = shape.decimal || shape.type === 'date';
    if (!words && !echoes) return '';
    return '<div class="cbf-h" id="' + id + '-h"><span>' + words + '</span>' + (echoes ? ' <span id="' + id + '-x" aria-live="polite"></span>' : '') + '</div>';
  }
  function errorHtml(options, id) {
    if (!options.error) return '';
    return '<div class="cbf-e" id="' + id + '-e"><span aria-hidden="true">⚠ </span>' + library().escape(options.error) + '</div>';
  }
  function labelHtml(options, id) {
    var esc = library().escape;
    var required = options.required ? '<span class="cbf-req">' + esc(say('Required', 'required')) + '</span>' : '';
    return '<div class="cbf-row"><label class="cbf-l" for="' + id + '">' + esc(options.label) + '</label>' + required + '</div>';
  }
  /** the part: ui.field({ mount, kind, label, ... }) -> HTML */
  function field(options) {
    checkOptions(options);
    var shape = KINDS[options.kind], id = idOf(options), reason = readonlyReason(options);
    ensureStyle();
    if (options.onInput || options.onChange) HANDLERS[id] = { input: options.onInput, change: options.onChange };
    var tail = noteHtml(options, id, reason) + errorHtml(options, id);
    var control = controlHtml(options, id, reason);
    if (shape.type === 'checkbox') return '<div class="cbf"><label class="cbf-c" for="' + id + '">' + control + '<span>' + library().escape(options.label) + '</span></label>' + tail + '</div>';
    if (shape.type === 'file') return '<div class="cbf"><label class="cbf-fb" for="' + id + '"><span>' + library().escape(options.label) + '</span>' + control + '</label><div class="cbf-fn" id="' + id + '-n"></div>' + tail + '</div>';
    return '<div class="cbf">' + labelHtml(options, id) + control + tail + '</div>';
  }

  /* ---------- reading and repainting one field ---------- */
  function elementOf(target) {
    if (target && typeof target === 'object') return target;
    return typeof document !== 'undefined' ? document.getElementById(String(target)) : null;
  }
  /** the canonical value of one field: ASCII decimal for a number, ISO for a date, true/false for a checkbox, the file name for a file; { value: NaN, error } for a number it cannot read */
  function read(target) {
    var el = elementOf(target);
    if (!el) return { value: undefined };
    var kind = el.getAttribute('data-cbkind');
    if (kind === 'checkbox') return { value: !!el.checked };
    if (kind === 'file') return { value: el.files && el.files[0] ? el.files[0].name : '' };
    if (!KINDS[kind] || !KINDS[kind].decimal) return { value: el.value };
    if (!String(el.value).trim()) return { value: '' };
    var parsed = parse(el.value);
    return parsed.ok ? { value: parsed.value } : { value: NaN, error: parsed.error };
  }
  function noteOf(el, suffix) {
    return typeof document !== 'undefined' ? document.getElementById(el.id + '-' + suffix) : null;
  }
  /** show an error under one field (or clear it): the ONE place role="alert" is added, so a first render never announces every row at once */
  function showError(target, sentence) {
    var el = elementOf(target);
    if (!el) return;
    var box = noteOf(el, 'e');
    if (sentence && !box) {
      box = document.createElement('div');
      box.id = el.id + '-e';
      box.className = 'cbf-e';
      (noteOf(el, 'h') || (el.closest('.cbf-suf') || el).parentNode).insertAdjacentElement('afterend', box);
    }
    if (box && sentence) { box.textContent = '⚠ ' + sentence; box.setAttribute('role', 'alert'); }
    if (box && !sentence) box.remove();
    if (sentence) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    var ids = [noteOf(el, 'h') ? el.id + '-h' : '', sentence ? el.id + '-e' : '', noteOf(el, 'n') ? el.id + '-n' : ''].filter(Boolean).join(' ');
    if (ids) el.setAttribute('aria-describedby', ids); else el.removeAttribute('aria-describedby');
  }
  /** the locale echo: a date as words ("13 Nov 2026"), a number grouped the shop's way, so a mismatched browser still shows what the app understood */
  function echoOf(el) {
    var kind = el.getAttribute('data-cbkind'), have = String(el.value || '');
    if (typeof CBLocale === 'undefined') return '';
    if (kind === 'date') {
      var part = /^(\d{4})-(\d\d)-(\d\d)$/.exec(have);
      return part ? CBLocale.date(Date.UTC(+part[1], +part[2] - 1, +part[3], 12), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
    }
    var parsed = KINDS[kind] && KINDS[kind].decimal && have.trim() ? parse(have) : null;
    return parsed && parsed.ok ? String(CBLocale.number(Number(parsed.value), { maximumFractionDigits: 20 })) : '';
  }
  /** when the person leaves a number field: read it, say what was understood, or say what to fix; a good number is written back canonical so a page's own .value reader agrees */
  function settle(el) {
    var kind = el.getAttribute('data-cbkind');
    var echo = noteOf(el, 'x');
    if (KINDS[kind] && KINDS[kind].decimal && String(el.value).trim()) {
      var result = read(el);
      showError(el, result.error || null);
      if (!result.error) el.value = result.value;
    } else if (el.getAttribute('aria-invalid') === 'true' && KINDS[kind] && KINDS[kind].decimal) showError(el, null);
    if (echo) echo.textContent = echoOf(el);
  }
  function set(target, value) {
    var el = elementOf(target);
    if (!el) return;
    if (el.getAttribute('data-cbkind') === 'checkbox') el.checked = !!value; else el.value = value == null ? '' : value;
    settle(el);
  }
  /** move focus to the first field with an error inside a form (the invalid-submit helper); returns the field or null */
  function focusFirstError(form) {
    var first = form && form.querySelector ? form.querySelector('[data-cbname="field"][aria-invalid="true"]') : null;
    if (first) first.focus();
    return first;
  }

  /* ---------- one delegated listener for every field on the page ---------- */
  function fieldOf(event) {
    var el = event && event.target;
    return el && el.getAttribute && el.getAttribute('data-cbname') === 'field' ? el : null;
  }
  function onInput(event) {
    var el = fieldOf(event);
    if (!el) return;
    var kind = el.getAttribute('data-cbkind');
    if (KINDS[kind] && KINDS[kind].decimal) {
      var mapped = asciiDigits(el.value, marksOf());
      if (mapped !== el.value) el.value = mapped;
    }
    var handler = HANDLERS[el.id];
    if (handler && handler.input) { var got = read(el); handler.input(got.value !== got.value ? el.value : got.value, el, event); }
  }
  function onChange(event) {
    var el = fieldOf(event);
    if (!el) return;
    var kind = el.getAttribute('data-cbkind');
    if (kind === 'file') { var named = noteOf(el, 'n'); if (named) named.textContent = read(el).value; }
    if (kind === 'date') settle(el);
    var handler = HANDLERS[el.id];
    if (handler && handler.change) handler.change(read(el).value, el, event);
  }
  function onFocusOut(event) {
    var el = fieldOf(event);
    if (el) settle(el);
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('focusout', onFocusOut);
  }
  field.read = read;
  field.set = set;
  field.error = showError;
  field.focusFirstError = focusFirstError;
  field.parse = parse;
  field.kinds = KINDS;
  if (typeof window !== 'undefined' && window.ui) window.ui.field = field;
  return field;
})();
