/**
 * labs-ready.cjs: the Labs walk follows the manifest the shell reads (labsGrey 1128; READY-HINT 25 Nov: no cover, one hint at the card).
 *   OWNS: readyOf(id) and parkedLab(): the grey-card checks for a Lab the manifest marks ready:false.
 *   CALLED BY: e2e/labs-flow.cjs.
 * ready:false = the card stays a link and carries the shell's one hint "Being finished" (signed out: the showcase line says Coming);
 * the click-through is parked, loudly, never silently. Reads public/app/manifest.json and shell.js, never a copy.
 */
const fs = require('fs'); const path = require('path');

function labsReady(PUB) {
  const MANIFEST = JSON.parse(fs.readFileSync(path.join(PUB, 'app', 'manifest.json'), 'utf8'));
  const SHELL_SRC = fs.readFileSync(path.join(PUB, 'app', 'shell.js'), 'utf8');
  const UNFINISHED = (SHELL_SRC.match(/unfinishedShort:\s*'([^']+)'/) || [])[1] || 'Being finished';
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
      const at = await card.evaluate((n) => ({ tag: n.tagName, href: n.getAttribute('href') })).catch(() => ({}));
      ok(lab.key, at.tag === 'A' && !!at.href, lab.title + ' stays a link, never covered or dead (' + state + ')', 'tag=' + at.tag + ' href=' + at.href);
      const hint = ((await card.locator('[data-testid="shell-hint-' + lab.id + '"]').first().textContent({ timeout: 3000 }).catch(() => '')) || '').trim();
      ok(lab.key, hint === UNFINISHED, lab.title + ' carries its one hint "' + UNFINISHED + '" (' + state + ')', 'got "' + hint + '"');
    }
    console.log('  --  [' + lab.key + '] parked: ready:false in manifest (' + state + ')');
    row(lab.key, 'click-through and Lab page (' + state + ')', 'PARKED', 'ready:false in manifest');
    return true;
  }
  return { readyOf, parkedLab, UNFINISHED };
}

module.exports = { labsReady };
