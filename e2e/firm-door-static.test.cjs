'use strict';
/**
 * e2e/firm-door-static.test.cjs — the firm door's two screens send the ONE agency ask: type 'agency' (never commercial, never a second ask path), through the registered endpoints, and the module is wired into the three pages that show it.
 * Run: node e2e/firm-door-static.test.cjs · no browser, no network.   CARD 04-network/connections-and-invitations
 */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let bad = 0;
const check = (what, cond) => { console.log((cond ? '  ok   ' : '  FAIL ') + what); if (!cond) bad++; };
const door = read('public/app/firm-door.js');
const member = read('public/app/books-grant-member.js'), network = read('public/network.html'), home = read('index.html');
check('the owner side asks with parentHandle and type agency', door.includes("side === 'owner' ? { parentHandle: handle, type: 'agency' }"));
check('the firm side asks with childHandle and type agency', door.includes("{ childHandle: handle, type: 'agency' }"));
check('no other connection type is sent from the door', !/type: '(commercial|governance)'/.test(door));
check('every write is a CBAction', (door.match(/CBAction\.run\(/g) || []).length >= 3);
check('accept on the owner side ends in the existing Give access sheet (giveTo), not a copy of the form', door.includes('o.giveTo(row.name)') && !door.includes('grantsGive'));
check('the endpoints are the ones the api serves', ['/api/network/entities/lookup', '/api/network/entities/:id/connections', '/api/network/connections', '/api/network/connections/:id/approve', '/api/network/connections/:id/decline', '/api/network/connections/:id/disconnect'].every((p) => door.includes("'" + p + "'")));
check('books-grant-member paints the owner card', /CBFirmDoor\.mount\(\$\('bg_door'\), \{\s*side: 'owner'/.test(member));
check('the practice page paints the firm card', read('public/app/books-practice.js').includes("CBFirmDoor.mount(host, { side: 'firm'"));
check('network.html loads firm-door.js before books-grant-member.js', network.indexOf('firm-door.js') > 0 && network.indexOf('firm-door.js') < network.indexOf('books-grant-member.js'));
check('index.html loads firm-door.js before books-practice.js', home.indexOf('firm-door.js') > 0 && home.indexOf('firm-door.js') < home.indexOf('books-practice.js'));
check('CB_BUILD is 2026-11-18h', read('public/app.html').includes("'2026-11-18h'"));
process.exit(bad ? 1 : 0);
