const { chromium } = require('@playwright/test');
const F = require('./fixtures.js');
(async()=>{
const WEB=process.env.CB_WEB||'https://chitbridge-web.vercel.app';
const b=await chromium.launch(); const p=await (await b.newContext({baseURL:WEB})).newPage();
p.on('pageerror',e=>console.log('  PAGE ERROR:', String(e.message).slice(0,300)));
p.on('console',m=>{ if(m.type()==='error') console.log('  CONSOLE:', m.text().slice(0,250)); });
p.on('dialog',d=>d.accept());
await p.goto(WEB+'/app.html');
const who = await F.mintEntity(p, { email:'beta@test-cb.com', name:'Beta Fresh' });
console.log('mintEntity ->', JSON.stringify(who));
await F.clickNav(p,'intake').catch(async()=>{ await p.evaluate(()=>navTo('intake')); });
await p.waitForTimeout(4000);
const rows = await p.getByTestId('intake-row').count();
console.log('intake rows:', rows);
if(!rows){ console.log(await p.evaluate(()=>document.getElementById('intake_body')?.innerText.slice(0,200))); await b.close(); return; }
if(!(await p.getByTestId('intake-make-chit').count())) await p.getByTestId('intake-structure').first().click();
await p.getByTestId('intake-make-chit').first().waitFor({timeout:40000});
console.log('structured ok');
await p.evaluate(()=>{
  window.__log=[];
  const r=window.ccCartRelease; window.ccCartRelease=function(){ window.__log.push('ccCartRelease\n'+new Error().stack); return r.apply(this,arguments); };
  const s=window.ccCartSync;    window.ccCartSync=function(){ window.__log.push('ccCartSync'); return s.apply(this,arguments); };
  const a=window.ccAddPicked;   window.ccAddPicked=function(){ window.__log.push('ccAddPicked sel='+((window.UI&&UI._ccCart)?UI._ccCart.selected().length:'NOCART')); return a.apply(this,arguments); };
  const c=window.compose;       window.compose=function(){ window.__log.push('compose\n'+new Error().stack); return c.apply(this,arguments); };
});
await p.getByTestId('intake-make-chit').first().click();
await p.waitForTimeout(7000);
/* ⚠️ CC and UI are `let`-declared, so they are NOT on `window` — a window.CC probe reads undefined and reports
   an empty chit whatever the truth is. Unqualified names resolve through the global lexical environment. */
console.log(JSON.stringify(await p.evaluate(()=>({
  modalOpen: !!document.getElementById('cc_body'),
  ccItems: (CC.items||[]).map(i=>i.particulars+' x'+i.qty+' @'+i.price),
  cartExists: !!UI._ccCart,
  cartSelected: UI._ccCart? UI._ccCart.selected().map(x=>x.name) : null,
  ccErr: (document.getElementById('cc_err')||{}).textContent,
  subject: (CC.fields||{}).subject||null,
  captureId: UI._captureId||null,
  bodyText: (document.getElementById('cc_body')||{}).innerText,
})),null,2));
console.log('--- TRACE ---');
console.log((await p.evaluate(()=>window.__log||[])).join('\n---\n').slice(0,2500));
await b.close();
})();
