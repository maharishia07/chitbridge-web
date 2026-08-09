const { chromium } = require('@playwright/test');
const F = require('./fixtures.js');
(async()=>{
const WEB='https://chitbridge-web.vercel.app';
const b=await chromium.launch(); const p=await (await b.newContext({baseURL:WEB})).newPage();
p.on('pageerror',e=>console.log('  PAGE ERROR:',String(e.message).slice(0,250)));
p.on('dialog',d=>d.accept());
await p.goto(WEB+'/app.html');
await F.mintEntity(p, { email:'beta@test-cb.com', name:'Beta Fresh' });
await F.clickNav(p,'intake').catch(async()=>{ await p.evaluate(()=>navTo('intake')); });
await p.waitForTimeout(4000);
if(!(await p.getByTestId('intake-raise').count())) await p.getByTestId('intake-structure').first().click();
await p.getByTestId('intake-raise').first().waitFor({timeout:45000});
await p.getByTestId('intake-raise').first().click();
await p.waitForTimeout(14000);
console.log('landed on:', await p.evaluate(()=>UI.nav+' / '+UI.folder));
await p.locator('.row').first().click().catch(()=>{});
await p.waitForTimeout(4000);
const d=await p.evaluate(()=>({ kind:(UI.detail||{}).kind, hasVia:!!(UI.detail&&UI.detail.via),
  detail:(document.getElementById('detailpane')||{}).innerText||'' }));
console.log('purpose:',d.kind,'| via block:',d.hasVia);
console.log('---- what the chit shows ----\n'+d.detail.slice(0,900));
await b.close();
})();
