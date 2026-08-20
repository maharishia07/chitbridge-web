/**
 * cap-iddocs.js — a person's identity record, as ONE module used in every place it appears.
 *
 * Athi, 2026-08-20: *"we have to add as part of coassist registration and it has to be visible here… naturally
 * it has to be there in employee screen and as a separate module to update."*
 *
 * ⭐⭐ THREE SURFACES, ONE IMPLEMENTATION. It appears on the co-assist create form, on the co-assist edit form,
 * and on the employee's own profile. Written three times it would drift three ways — the masking rule in one
 * place, the Aadhaar sentence missing from another, a validation the third does not have. The standing rule is
 * blunt about this: a second call site means extract the helper NOW.
 *
 * ⭐ WHO IS LOOKING CHANGES WHAT IS SAID, NOT WHAT IS BUILT. `mode` is 'self' or 'owner':
 *      self   — "your record", submits as you, no consent question (submitting IS consenting)
 *      owner  — "on file for this person", names who filed it, and ASKS for consent before an Aadhaar
 */
'use strict';

var CBIdDocs = (function () {

  /* Mirrors the server catalogue in routes/identity-docs.js. ⚠️ The SERVER is authoritative — it revalidates
     every value. This exists so a field can say what is wrong before a round trip, never instead of one. */
  var HINT = {
    PHONE:    { label: 'Mobile',          eg: '9876543210' },
    EMAIL:    { label: 'Email',           eg: 'name@example.com' },
    PAN:      { label: 'PAN',             eg: 'ABCDE1234F' },
    VOTER_ID: { label: 'Voter ID',        eg: 'ABC1234567' },
    DL:       { label: 'Driving licence', eg: 'TN0120110001234' },
    AADHAAR:  { label: 'Aadhaar',         eg: '12 digits' }
  };
  var ORDER = ['PHONE', 'EMAIL', 'PAN', 'VOTER_ID', 'DL', 'AADHAAR'];

  var STATUS = {
    verified:   ['✓', 'var(--ok-3)',   'Verified'],
    pending:    ['◔', 'var(--warn-2)', 'Waiting to be checked'],
    unverified: ['○', 'var(--grey)',   'Not checked'],
    rejected:   ['✕', 'var(--bad-3)',  'Not accepted'],
    expired:    ['○', 'var(--grey)',   'Expired']
  };

  /**
   * The block. `docs` is what the API returned; `mode` is 'self' or 'owner'.
   *
   * ⚠️ RENDERS FROM THE CATALOGUE, NOT FROM THE ROWS. Listing only what is on file would show an empty box to
   * exactly the person who most needs telling what is missing — which is the whole point of a record.
   */
  function html(docs, mode, opts) {
    var o = opts || {};
    var byScheme = {};
    (docs || []).forEach(function (d) { byScheme[d.scheme] = d; });
    var self = mode !== 'owner';

    var rows = ORDER.map(function (sc) {
      var h = HINT[sc], d = byScheme[sc];
      var st = STATUS[(d && d.status) || 'unverified'];
      /* ⚠️ NAMES ITS INK — this surface paints a ground, and guard check 11 exists because one that did not
         was unreadable in every light theme. */
      return '<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 11px;border:1px solid var(--line);'
        + 'border-radius:9px;margin-bottom:6px;background:var(--card);color:var(--on-card)">'
        +   '<span style="color:' + st[1] + ';font-size:var(--fs-2);line-height:1.5" title="' + esc(st[2]) + '">' + st[0] + '</span>'
        +   '<div style="flex:1;min-width:0">'
        +     '<div style="font-size:var(--fs-2);font-weight:600">' + esc(h.label) + '</div>'
        +     (d
                ? '<div class="mono" style="font-size:var(--fs-1);color:var(--grey);margin-top:1px">' + esc(d.value_masked) + '</div>'
                  + '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:2px">' + esc(st[2])
                    /* ⭐ WHO FILED IT. An employee reading their own record deserves to know it was not them. */
                    + (d.submitted_by && d.submitted_by !== 'self' ? ' · entered by your employer' : '')
                  + '</div>'
                : '<div style="font-size:var(--fs-1);color:var(--grey);margin-top:1px">'
                  + esc(self ? 'Not added' : 'Nothing on file') + '</div>')
        +   '</div>'
        +   '<input class="inp" id="idoc_' + sc + '" placeholder="' + esc(h.eg) + '" autocapitalize="characters"'
        +     ' spellcheck="false" style="flex:0 0 180px;max-width:180px;margin:0">'
        + '</div>';
    }).join('');

    /* ⚠️⚠️ THE AADHAAR SENTENCE IS NOT REASSURANCE, IT IS THE DESIGN. The Aadhaar Act restricts a private body
       from holding the number at all, so "we keep it safe" would be the wrong claim AND the wrong build. What
       is true is that it is never stored — say that, because a person entering it is entitled to know. */
    var aadhaarNote = '<div class="misnote" style="margin-top:8px;line-height:1.5">'
      + 'Aadhaar: only the last four digits are kept. The number itself is never stored.</div>';

    var consent = self ? '' :
      '<label class="fl" style="display:flex;align-items:center;gap:7px;cursor:pointer;margin-top:8px">'
      + '<input type="checkbox" id="idoc_consent" style="width:auto;margin:0">'
      + '<span style="font-weight:400">They have agreed to this being recorded '
      + '<span style="color:var(--grey);font-size:var(--fs-1)">— required for Aadhaar</span></span></label>';

    /* Q is the single-quote character. Writing it inline inside a single-quoted JS string that is itself
       building an onclick attribute is how the last three quoting bugs in this codebase happened. */
    var Q = String.fromCharCode(39);
    var btn = o.noButton ? '' :
      '<button class="composebtn" style="margin-top:6px" onclick="CBIdDocs.save('
      + (o.subject ? (Q + esc(o.subject) + Q) : 'null') + ')">'
      + (self ? 'Submit for verification' : 'Save documents') + '</button>';

    return rows + aadhaarNote + consent
      + '<div class="err" id="idoc_err" style="margin-top:6px"></div>' + btn;
  }

  /** Load — returns [] rather than throwing when b174 has not been run, so the block still renders. */
  async function load(subjectId) {
    try {
      var q = subjectId ? ('?identity_id=' + encodeURIComponent(subjectId)) : '';
      var r = await fetch(CFG.API_BASE + '/api/identity/documents' + q,
        { headers: { Authorization: 'Bearer ' + SESSION.token } });
      if (!r.ok) return [];          // 503 before the migration — an empty record, not an error screen
      return (await r.json()).documents || [];
    } catch (_) { return []; }
  }

  /**
   * Save every field that was filled in.
   *
   * ⚠️ ONE REQUEST PER DOCUMENT, AND A PARTIAL FAILURE IS REPORTED AS ONE. Four documents where the third is
   * malformed must not silently discard the fourth, and must not claim success. Each is attempted; what failed
   * is named, with what saved alongside it.
   */
  async function save(subjectId) {
    var errEl = document.getElementById('idoc_err');
    var consentEl = document.getElementById('idoc_consent');
    var consent = !!(consentEl && consentEl.checked);
    var failed = [], saved = 0;

    for (var i = 0; i < ORDER.length; i++) {
      var sc = ORDER[i];
      var el = document.getElementById('idoc_' + sc);
      var v = el && el.value ? el.value.trim() : '';
      if (!v) continue;
      try {
        var body = { value: v, consent: consent };
        if (subjectId) body.identity_id = subjectId;
        var r = await fetch(CFG.API_BASE + '/api/identity/documents/' + sc, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SESSION.token },
          body: JSON.stringify(body)
        });
        if (r.ok) { saved++; el.value = ''; }
        else {
          var j = await r.json().catch(function () { return {}; });
          failed.push(HINT[sc].label + ' — ' + (j.message || r.status));
        }
      } catch (e) { failed.push(HINT[sc].label + ' — could not reach the server'); }
    }

    if (errEl) {
      errEl.style.color = failed.length ? 'var(--bad-3)' : 'var(--ok-3)';
      errEl.textContent = failed.length
        ? (saved ? saved + ' saved. ' : '') + 'Not saved: ' + failed.join(' · ')
        : (saved ? saved + ' submitted for verification.' : 'Nothing to save — fill in a field first.');
    }
    if (saved && typeof toast === 'function') toast(saved + ' document(s) submitted');
    return { saved: saved, failed: failed };
  }

  return { html: html, load: load, save: save, ORDER: ORDER };
})();
