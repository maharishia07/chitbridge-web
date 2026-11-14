'use strict';
/**
 * money-input-guard.cjs — NO AMOUNT IS TYPED OUTSIDE THE ONE MONEY INPUT (M36 · R16 · T16 · invariant I17).
 *
 * ⭐ The unit is bkMoneyInput (public/app/cap-books.js): the symbol, the decimals (CBMoney.decimals) and minor units out. A field a person types an
 *   amount into that is not that unit — a bare <input inputmode="decimal">, a type="number", an id or test id that says amount — fails the build here,
 *   in every file CB Accounts and CB CRM load. The unit's own field carries data-money="1"; that is how it is told from a bare one.
 * ⭐ A minus sign in front of a shown balance is the other half (Dr/Cr and "you owe" words are the rule — bkDrCr, bkOwes): `bkMoney(-x)` and `'-' + bkMoney(` fail too.
 * ⭐ The guard proves itself: it plants a bare <input> and a minus in a copy and must fail on both, every run.
 *
 * Run: node e2e/money-input-guard.cjs        exit 1 on a bare amount
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PUB = path.join(ROOT, 'public');
const FILES = ['app/cap-books.js', 'app/cap-entry.js', 'app/cap-period.js', 'app/cap-bank.js', 'app/cap-crm.js', 'app/cap-crm-record.js', 'app/cap-folders.js', 'app/accounts-shell.js', 'accounts.html', 'crm.html'];

/** every finding in one source text: [{ line, why, text }] */
function scan(src) {
  const out = [];
  src.split(/\r?\n/).forEach((ln, i) => {
    const code = ln.replace(/^\s*(\/\/|\*|\/\*).*$/, '');                        /* a comment line is not a field */
    const re = /<input\b[^>]*>?/g; let m;
    while ((m = re.exec(code))) {
      const tag = m[0];
      if (/\bdata-money=/.test(tag)) continue;                                  /* the unit's own field */
      if (/type=["']?(file|checkbox|radio|date|search|password|email|tel|hidden)/.test(tag)) continue;
      const amountish = /inputmode=["']decimal["']|type=["']number["']|(?:id|data-testid)=["'][^"']*(?:amt|amount)(?![a-z])/i.test(tag);
      if (amountish) out.push({ line: i + 1, why: 'a bare amount field — use bkMoneyInput', text: tag.slice(0, 110) });
    }
    if (/bkMoney\(\s*-/.test(code) || /['"][-−]['"]\s*\+\s*bkMoney\(/.test(code)) out.push({ line: i + 1, why: 'a minus sign on a balance — use bkDrCr or bkOwes', text: code.trim().slice(0, 110) });
  });
  return out;
}

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  XX  ') + m); if (!c) fail++; };

for (const f of FILES) {
  const p = path.join(PUB, f); if (!fs.existsSync(p)) { ok(false, f + ' is missing'); continue; }
  const r = scan(fs.readFileSync(p, 'utf8'));
  ok(r.length === 0, f + ': every amount field is the money unit' + (r.length ? '\n' + r.map((x) => '        line ' + x.line + ' · ' + x.why + ' · ' + x.text).join('\n') : ''));
}
const real = fs.readFileSync(path.join(PUB, 'app/cap-books.js'), 'utf8');
ok(/data-money="1"/.test(real) && /function bkMoneyInput\(/.test(real), 'the unit exists: bkMoneyInput builds a data-money field');
ok(/CBLocale\.symbol/.test(real) && /bkDec\(/.test(real.slice(real.indexOf('function bkMinorText'), real.indexOf('function bkMoneyRead'))), 'the unit takes its symbol from CBLocale and its decimals from CBMoney (bkDec)');

/* the guard proves itself: a planted bare input and a planted minus must both be found */
const planted = '<div>' + '\n' + "  + '<input class=\"inp\" id=\"x_amt\" inputmode=\"decimal\">'" + '\n' + "  + bkMoney(-5)" + '\n' + "  + '<input type=\"number\" data-testid=\"cost\">'";
const pr = scan(planted);
ok(pr.filter((x) => /bare amount/.test(x.why)).length === 2 && pr.filter((x) => /minus/.test(x.why)).length === 1, 'PLANTED: a bare <input inputmode="decimal">, a type="number" and a minus on a balance are all caught (' + pr.length + ' findings)');
ok(scan("+ bkMoneyInput({ id: 'a' })").length === 0 && scan('<input class="mi-in" data-money="1" inputmode="decimal">').length === 0, 'the unit\'s own field is not a finding');

console.log(fail ? '\nmoney-input-guard: FAIL' : '\nmoney-input-guard: PASS');
process.exit(fail ? 1 : 0);
