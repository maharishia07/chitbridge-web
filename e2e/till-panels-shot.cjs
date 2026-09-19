/* till-panels-shot.cjs — DOES "Give each part the room you want" WORK? ([TILL-60], png/PanelSizing.png)
 * Drives the CONTROLS a shopkeeper would press: open the hub, open How it looks, press a preset.
 */
'use strict';
const { chromium } = require('@playwright/test');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','public');
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
(async()=>{
 const srv=http.createServer((q,r)=>{const rel=decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'index.html';const f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('no');}
  r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
 await new Promise(r=>srv.listen(0,r));
 const b=await chromium.launch();
 const p=await b.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2});
 const threw=[];p.on('pageerror',e=>threw.push(e.message));
 await p.goto('http://127.0.0.1:'+srv.address().port+'/till.html');
 await p.waitForFunction(()=>typeof window.setMode==='function'&&!!window.CBSearch,null,{timeout:30000});
 await p.evaluate(()=>{ window.S={shop:{name:'CB Test Traders',currency:'INR'},
   items:[{item_id:'a',name:'Idli',code:'T1',category:'Tiffin',unit:'plate',price:40}],offers:[],at:new Date().toISOString()};
   setMode('sell'); });
 /* ⚠️ DRIVE THE GATE: the ☰ button, then the section header, exactly as a person would */
 await p.click('[data-testid="till-side-open"]');
 /* ⚠️ THE HUB REPAINTS WHEN IT OPENS, so wait for the section header to exist before pressing it, then
    wait for its body to actually open. Clicking into a half-painted panel silently does nothing. */
 /* ⚠️ WAIT FOR THE HUB TO BE ON SCREEN before pressing inside it. Clicking the section a frame after the
    ☰ lands outside the still-painting panel, and the outside-click handler shuts the whole menu. */
 await p.waitForSelector('#tillmenu', { state: 'visible', timeout: 5000 });
 await p.waitForSelector('[data-testid="till-msec-btn-look"]', { state: 'visible', timeout: 5000 });
 await p.click('[data-testid="till-msec-btn-look"]');
 await p.waitForFunction(() => {
   const el = document.querySelector('[data-testid="till-panels"]');
   return el && el.closest('.mbody') && !el.closest('.mbody').hasAttribute('hidden');
 }, null, { timeout: 5000 });
 const before=await p.evaluate(()=>document.getElementById('panelwords').textContent);
 console.log('at rest   · ' + before);
 for (const id of ['keys','search','bill','nokeys','balanced']) {
   await p.click('[data-testid="till-panel-'+id+'"]');
   const r=await p.evaluate(()=>({ words:document.getElementById('panelwords').textContent,
     split:getComputedStyle(document.querySelector('.wrap')).getPropertyValue('--split').trim(),
     keysh:getComputedStyle(document.documentElement).getPropertyValue('--keysh').trim(),
     on:(document.querySelector('[data-panel].on')||{}).getAttribute&&document.querySelector('[data-panel].on').getAttribute('data-panel') }));
   console.log((id+'        ').slice(0,10)+'· lit='+r.on+' split='+r.split+' keysh='+r.keysh+' · '+r.words);
 }
 await p.click('[data-testid="till-density-compact"]');
 console.log('density   · body dense=' + await p.evaluate(()=>document.body.classList.contains('dense')));
 const shot=path.join(__dirname,'shots','panel-sizing.png');
 fs.mkdirSync(path.dirname(shot),{recursive:true});
 await p.screenshot({path:shot});
 console.log('wrote '+shot);
 if(threw.length){console.log('THREW · '+threw.join(' | '));process.exitCode=1;}
 await b.close();srv.close();
})();
