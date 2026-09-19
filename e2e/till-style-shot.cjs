/* till-style-shot.cjs — SEE IT BEFORE YOU LIVE WITH IT ([TILL-77], png/DisplaySettings.png)
 * Athi: "bring the miniature version in the popup to show this is how it looks and then ask for the apply."
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
 const p=await b.newPage({viewport:{width:1500,height:1000},deviceScaleFactor:2});
 const threw=[];p.on('pageerror',e=>threw.push(e.message));
 await p.goto('http://127.0.0.1:'+srv.address().port+'/till.html');
 await p.waitForFunction(()=>typeof window.setMode==='function'&&!!window.CBScreen,null,{timeout:30000});
 await p.evaluate(()=>{ window.S={shop:{name:'Mayur Bhavan',currency:'INR'},items:[],offers:[],at:new Date().toISOString()}; setMode('sell'); });

 const before=await p.evaluate(()=>screenCfg().theme+'/'+screenCfg().tile+'/'+screenCfg().layout);
 console.log('in force  · '+before);

 /* ⚠️ DRIVE THE GATE: the strip, How it looks, then the door */
 await p.click('[data-testid="till-side-open"]');
 await p.waitForSelector('#tillmenu',{state:'visible',timeout:5000});
 await p.click('[data-testid="till-msec-btn-look"]');
 await p.waitForSelector('[data-testid="till-open-style"]',{state:'visible',timeout:5000});
 await p.click('[data-testid="till-open-style"]');
 await p.waitForSelector('#styledlg[open]',{timeout:5000});

 const rows=await p.evaluate(()=>Array.from(document.querySelectorAll('.stylerow .sl')).map(x=>x.textContent.trim()));
 console.log('groups    · '+rows.join(' · '));
 const says0=await p.evaluate(()=>document.getElementById('stylesays').textContent);
 console.log('preview   · '+says0);

 /* choose Kiosk and watch the miniature change — WITHOUT applying */
 await p.click('[data-testid="till-style-preset-kiosk"]');
 const after=await p.evaluate(()=>({says:document.getElementById('stylesays').textContent,
   tiles:document.querySelectorAll('#stylepreview .sk-tile').length,
   live:screenCfg().theme+'/'+screenCfg().tile+'/'+screenCfg().layout}));
 console.log('kiosk     · '+after.says);
 console.log('          · preview tiles='+after.tiles+'  counter still '+after.live
   +(after.live===before?'  OK nothing applied yet':'  ✗ APPLIED WITHOUT ASKING'));

 /* ⭐⭐ PHOTOS BY SURFACE ([TILL-80]) — Athi: "a popup window to check where, and all the photos off" */
 const ph0=await p.evaluate(()=>({keys:!!screenCfg().photos, list:thumbsOn()}));
 await p.click('[data-testid="till-style-photos-list"]');
 const ph1=await p.evaluate(()=>({keys:!!styleVal('photos'), list:thumbsOn()}));
 console.log('photos    · list toggled: keys='+ph1.keys+' list='+ph1.list
   +((ph1.list!==ph0.list)?'  OK the list has its own switch':'  ✗'));
 await p.click('[data-testid="till-style-photos-none"]');
 const ph2=await p.evaluate(()=>({keys:!!styleVal('photos'), list:thumbsOn()}));
 console.log('          · all off: keys='+ph2.keys+' list='+ph2.list
   +((!ph2.keys&&!ph2.list)?'  OK every surface':'  ✗ SOMETHING STILL ON'));

 const shot=path.join(__dirname,'shots','screen-style.png');
 fs.mkdirSync(path.dirname(shot),{recursive:true});
 await p.screenshot({path:shot}); console.log('wrote '+shot);

 await p.click('[data-testid="till-style-apply"]');
 const applied=await p.evaluate(()=>screenCfg().theme+'/'+screenCfg().tile+'/'+screenCfg().layout);
 console.log('apply     · '+applied+(applied!==before?'  OK applied on request':'  ✗ DID NOTHING'));

 if(threw.length){console.log('THREW · '+threw.join(' | '));process.exitCode=1;}
 await b.close();srv.close();
})();
