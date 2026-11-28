/**
 * drift-display-1138.test.cjs - DRIFT GUARD (28 Nov 2026), web half of PROOF-2026-11-27 rows 6, 10b, 21 and 31. Offline static guard.
 *  6   privacy register: a 403 is the state 'refused' with its own words, never 'error' (connection fault + a retry that cannot succeed)
 *  10b Bank home: the shop-level "none in an unbroken run" phrase prints only on an account that HAS a signed month
 *  21  lead "Move to..." button: greyed with the seat's own words when the server's lead.may says no (code read_only / comment_only)
 *  31  readiness clearance buttons (Gather / Verify at source / Draft with AI): drawn from the server's may { gather, verify } via _rdGrey, never always live
 * Run: node tests/drift-display-1138.test.cjs
 * CARD      ux/server-says-may
 */
'use strict';
const fs = require('fs'), path = require('path');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'app', f), 'utf8');
const bad = [];
const need = (ok, why) => { if (!ok) bad.push(why); };
const priv = R('cap-crm-privacy-register.js');
need(/e\.status === 403 \? 'refused' : 'error'/.test(priv), '6: a 403 is no longer the state refused');
need(priv.includes('empty: crmPrivEmpty,') && priv.includes("if (PRV.state === 'refused') return { title: tx('Your login cannot see privacy requests.')"), '6: the refused state has no words of its own');
need(/t\.signed \+ t\.unfiled > 0 && data\.unexplained && data\.unexplained\.no_run/.test(R('cap-bank-home.js')), '10b: the no_run phrase prints on an account with no signed month');
const leads = R('cap-crm-leads.js');
need(/verdict\.code === 'read_only' \|\| verdict\.code === 'comment_only' \? crmViewWhy\(\)/.test(leads), '21: the lead Move-to button lost the seat refusal words');
const rd = R('cap-readiness.js');
need(/function _rdGrey\(key\)/.test(rd) && /UI\.laneRd\.may\[key\]/.test(rd), '31: _rdGrey no longer reads the server may');
for (const [id, key] of [['SCR033-B05', 'verify'], ['SCR033-B06', 'gather'], ['SCR033-B07', 'gather']])
  need(rd.includes('data-cbsid="' + id + '"\' + _rdGrey(\'' + key + '\')'), '31: button ' + id + ' is no longer drawn through _rdGrey(' + key + ')');
if (bad.length) { for (const b of bad) console.log('   FAIL ' + b); process.exit(1); }
console.log('drift-display-1138: all passed');
