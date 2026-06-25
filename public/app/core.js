/* app/core.js — shared client module for the Task Panel (module 1 of the app split).
 * Loaded by /app.html BEFORE its main inline script (classic script, shared global scope).
 * Exposes: fill(), unwrap() (the {ok,data,error} envelope), api() (auth + 401/422/500 branching).
 * Depends on host globals defined in app.html: EP, CFG, SESSION, demoApi, go.
 * Pattern for a NEW panel: add one EP row + one mapper, then a panel module that calls api(). */

function fill(path, params){ return path.replace(/:(\w+)/g, (_, k) => encodeURIComponent((params && params[k]) ?? "")); }

// Single response envelope. Accepts a real {ok,data,error} envelope, or normalises the legacy
// wrappers ({chits,…}, {entity}, {messages,…}, …) so feature code uses `data` directly.
function unwrap(j){
  if(j==null||typeof j!=="object"||Array.isArray(j)) return j;
  if("ok" in j && ("data" in j || "error" in j)){ if(j.ok===false) throw new Error(j.error||"Request failed"); return j.data; }
  if("my_disputes" in j || "header" in j) return j;                 // structured/compound payloads pass through whole
  for(const k of ["chits","messages","connections","requests","suppliers","items","results","actors"]) if(Array.isArray(j[k])) return j[k];
  if(j.entity) return j.entity;
  if(j.settings) return j.settings;
  if(j.chit) return j.chit;
  return j;
}

async function api(key, {params, query, body}={}){
  const ep = EP[key]; if(!ep) throw new Error("no endpoint "+key);
  if(CFG.MODE==="demo"){ await new Promise(r=>setTimeout(r,140)); return unwrap(demoApi(key,{params,query,body})); }
  let url = CFG.API_BASE + fill(ep.p, params);
  if(query){const q=new URLSearchParams(Object.entries(query).filter(([,v])=>v!=null&&v!=="")); if([...q].length)url+="?"+q;}
  const res = await fetch(url, {method:ep.m, headers:{"Content-Type":"application/json", ...(SESSION.token?{Authorization:"Bearer "+SESSION.token}:{})}, body: body?JSON.stringify(body):undefined});
  if(!res.ok){
    let msg=""; try{ const j=await res.json(); msg=j.message||j.error||""; }catch(_){}
    if(res.status===401){ SESSION={}; try{localStorage.removeItem("cb_token");}catch(_){} if(typeof go==="function") go("#/login"); throw new Error(msg||"Session expired — please sign in again."); }
    if(res.status===422){ throw new Error(msg||"Please check the form and try again."); }          // validation
    if(res.status>=500){ throw new Error(msg||"Server error — please try again."); }                 // generic
    throw new Error(msg||("API "+res.status+" "+ep.m+" "+ep.p));
  }
  return unwrap(res.status===204?null:await res.json());
}
