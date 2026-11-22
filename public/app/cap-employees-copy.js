/**
 * cap-employees-copy.js — Employees: the sign-in name, whole, with its Copy control, and the add form's two field watchers (the key, the level's one-line why).
 *
 * OWNS      signInName (the name AS TYPED at the sign-in screen, never cut) · nameWithCopy (the name and its Copy control, code EMP001-B14) · wireCopy (Copy: the whole name to the clipboard, said on the button); moved out of cap-employees.js (2026-11-17, size ratchet; behaviour unchanged)
 *           watchLevel (the picked access label says in one line what it can do: the server's own why, lib/access PRESETS)
 * CALLED BY public/employees.html (<script src>, before cap-employees.js) · app/cap-employees.js (the list's sign-in column, the person's sheet, the added-person note)
 * FLOW      nameWithCopy(userId, testid, cls) draws the name and the button → the host calls wireCopy() once the HTML is in the page → a press copies and says Copied on the button itself
 * CARD      17-people-employees-hr-and-payroll/pin-otp-first-sign-in
 */
(function (root) {
  'use strict';
  function words(text) {
    return typeof root.tx === 'function' ? root.tx(text) : text;
  }
  /** one element by id */
  function $(id) {
    return root.document.getElementById(id);
  }
  /** the sign-in name AS TYPED at the sign-in screen, whole (asha01@mayur-restaurant.br): W15-59 - the short form failed when typed as shown, so it is never cut. */
  function signInName(u) {
    return String(u == null ? '' : u);
  }
  /** the sign-in name and its Copy control (library button, code EMP001-B14); the name's own element keeps its test id so it reads as the plain name */
  function nameWithCopy(u, idTid, cls) {
    var name = signInName(u);
    return (
      '<span class="' + cls + '" data-testid="' + idTid + '" style="overflow-wrap:anywhere;word-break:break-all;min-width:0">' + esc(name) + '</span> ' +
      (name ? '<button data-cbsid="EMP001-B14" type="button" class="act emp-copy" id="emp_copy" data-testid="emp-copy" data-copy="' + esc(name) + '">' + esc(words('Copy')) + '</button>' : '')
    );
  }
  /** the count in words, never "0 on" (UX-196): "No people yet" · "1 person" · "N people" (the locale's plural rule), bold */
  function peopleCount(n) {
    if (!n) return esc(words('No people yet'));
    return '<b>' + esc(typeof root.txn === 'function' ? root.txn('{count} person', '{count} people', n) : n === 1 ? '1 person' : n + ' people') + '</b>';
  }
  /** Copy: the whole sign-in name to the clipboard, said on the button itself (no toast to miss) */
  function wireCopy() {
    var copyButton = $('emp_copy');
    if (!copyButton) return;
    /* a press: the whole name to the clipboard, said on the button itself */
    copyButton.onclick = function () {
      var text = copyButton.getAttribute('data-copy') || '',
        showResult = function (ok) {
          copyButton.textContent = words(ok ? 'Copied' : 'Select the name and copy it');
        };
      try {
        root.navigator.clipboard.writeText(text).then(
          function () {
            showResult(true);
          },
          function () {
            showResult(false);
          }
        );
      } catch (_) {
        showResult(false);
      }
    };
  }
  /**
   * W14: the line "They sign in as <name>@<practice or shop>" under the sign-in name. It follows the name AS TYPED and shows the whole ID: the part after @ is the one the server printed
   * (suggest-key's login_format), kept; nothing is composed before the server has said it. watchKey(input, note, suggest(word) → promise of the server's reply, T) → { typed(), ask(word, then) }.
   */
  function watchKey(input, note, suggest, translate) {
    var typedKey = false, suffix = '';
    function paintNote() {
      var key = String(input.value || '').trim().toLowerCase();
      note.textContent = key && suffix ? translate('They sign in as') + ' ' + key + '@' + suffix : '';
    }
    function askSuggest(word, then) {
      return suggest(word).then(function (reply) {
        suffix = String((reply && reply.login_format) || '').split('@')[1] || suffix;
        if (then && !typedKey) then(reply);
        paintNote();
      }, function () {});
    }
    input.oninput = function () {
      typedKey = true;
      if (suffix) paintNote();
      else askSuggest(input.value.trim() || 'xx');
    };
    return { typed: function () { return typedKey; }, ask: askSuggest };
  }
  /** the picked label says in one line what it can do (choices[i].why, the server's own words); the label also carries its hat, so label and access agree */
  function watchLevel(select, line, choices) {
    var show = function () {
      var pick = choices[+select.value] || {};
      line.textContent = pick.why || '';
    };
    select.onchange = show;
    show();
  }
  root.CBEmployeesCopy = { watchLevel: watchLevel, watchKey: watchKey, signInName: signInName, nameWithCopy: nameWithCopy, peopleCount: peopleCount, wireCopy: wireCopy };
})(typeof window !== 'undefined' ? window : this);
