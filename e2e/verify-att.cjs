const { chromium } = require('@playwright/test');
const F = require('./fixtures.js');
(async()=>{
const WEB='https://chitbridge-web.vercel.app';
const b=await chromium.launch(); const p=await (await b.newContext({baseURL:WEB})).newPage();
p.on('pageerror',e=>console.log('  PAGE ERROR:',String(e.message).slice(0,200)));
p.on('dialog',d=>d.accept());
await p.goto(WEB+'/app.html');
await F.mintEntity(p, { email:'beta@test-cb.com', name:'Beta Fresh' });
await F.clickNav(p,'intake').catch(async()=>{ await p.evaluate(()=>navTo('intake')); });
await p.waitForTimeout(4000);
console.log('use-catalogue toggle present:', await p.getByTestId('intake-use-catalogue').count());
if(!(await p.getByTestId('intake-raise').count())) await p.getByTestId('intake-structure').first().click();
await p.getByTestId('intake-raise').first().waitFor({timeout:45000});
await p.getByTestId('intake-raise').first().click();
await p.waitForTimeout(14000);
await p.locator('.row').first().click().catch(()=>{});
await p.waitForTimeout(5000);
console.log('lines:', await p.evaluate(()=>((UI.detail||{}).items||[]).map(i=>i[0]+' '+i[1]).join(' | ')));
await p.locator('.attTile').first().click();
await p.waitForTimeout(6000);
const lb=await p.evaluate(()=>{
  const pre=document.querySelector('.atttext');
  return { hasPre: !!pre, text: pre?pre.innerText.slice(0,320):null,
           fallback: document.querySelector('.attfile')?document.querySelector('.attfile').innerText.slice(0,120):null };
});
console.log('inline <pre>:', lb.hasPre, '| download tile:', lb.fallback);
if(lb.text) console.log('---- what opens ----\n'+lb.text);
await b.close();
})();
