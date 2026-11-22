/**
 * labs-ready.cjs: the Labs walk follows the manifest the shell reads (labsGrey, 1128).
 *   OWNS: readyOf(id) and parkedLab(): the grey-card checks for a Lab the manifest marks ready:false.
 *   CALLED BY: e2e/labs-flow.cjs.
 * ready:false = a grey non-link card with the shell's own sentence (signed out: the showcase line says Coming);
 * the click-through is parked, loudly, never silently. Reads public/app/manifest.json and shell.js, never a copy.
 */
const fs = require('fs'); const path = require('path');

function labsReady(PUB) {
  const MANIFEST = JSON.parse(fs.readFileSync(path.join(PUB, 'app', 'manifest.json'), 'utf8'));
  const SHELL_SRC = fs.readFileSync(path.join(PUB, 'app', 'shell.js'), 'utf8');
  const UNFINISHED = (SHELL_SRC.match(/unfinished:\s*'([^']+)'/) || [])[1] || 'Being finished';
  const readyOf = (id) => { const e = (MANIFEST.entries || []).filter((x) => x.id === id)[0]; return !!e && e.ready !== false; };

  /* true = the Lab is parked (ready:false) and its grey state was checked; the caller closes the page and moves on */
  async function parkedLab(p, lab, st, state, ok, row) {
    if (readyOf(lab.id)) return false;
    if (st.signedOut) {
      const line = p.locator('[data-testid="ix2-show-' + lab.id + '"]').first();
      const lt = ((await line.textContent({ timeout: 3000 }).catch(() => '')) || '').trim();
      ok(lab.key, /Coming/.test(lt) && lt.indexOf(lab.title) >= 0, 'signed out: the showcase line names ' + lab.title + ' as Coming (' + state + ')', 'got "' + lt + '"');
    } else {
      const card = p.locator('[data-testid="' + lab.tile + '"]').first();
      const tag = await card.evaluate((n) => n.tagName).catch(() => '');
      const at = await card.evaluate((n) => ({ href: n.getAttribute('href'), dis: n.getAttribute('aria-disabled'), rdy: n.getAttribute('data-ready') })).catch(() => ({}));
      ok(lab.key, tag !== '' && tag !== 'A' && at.href == null && at.dis === 'true' && at.rdy === 'no', lab.title + ' is a grey non-link card (' + state + ')', 'tag=' + tag + ' href=' + at.href + ' aria-disabled=' + at.dis + ' data-ready=' + at.rdy);
      const sentence = ((await p.locator('[data-testid="shell-off-' + lab.id + '"]').first().textContent({ timeout: 3000 }).catch(() => '')) || '').trim();
      ok(lab.key, sentence === UNFINISHED, lab.title + ' carries its readiness sentence "' + UNFINISHED + '" (' + state + ')', 'got "' + sentence + '"');
    }
    console.log('  --  [' + lab.key + '] parked: ready:false in manifest (' + state + ')');
    row(lab.key, 'click-through and Lab page (' + state + ')', 'PARKED', 'ready:false in manifest');
    return true;
  }
  return { readyOf, parkedLab, UNFINISHED };
}

module.exports = { labsReady };
