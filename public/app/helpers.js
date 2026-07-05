/* app/helpers.js — generic, dependency-free helpers (module 2 of the app split).
 * Classic script, shared global scope. Loaded by /app.html AFTER core.js and BEFORE the main inline
 * script, so every panel can call these. HARD RULE for this file: pure leaves only — nothing here may
 * reference app state (UI/SESSION/STORE/…) or DOM at load time. Panel-specific mappers/renderers stay
 * in their panel module. Extracted verbatim from app.html (behaviour unchanged). */

function deepClone(x){ return JSON.parse(JSON.stringify(x)); }

function esc(v){ return String(v==null?'':v).replace(/[<>"&]/g,c=>({'<':'&lt;','>':'&gt;','"':'&quot;','&':'&amp;'}[c])); }
function opt(arr,sel){ return arr.map(o=>`<option ${o===sel?'selected':''}>${o}</option>`).join(""); }
function scrErr(e){ return `<div class="empty"><div class="t">Couldn't load</div><div>${esc(e&&e.message)}</div></div>`; }

function cap(s){ return s[0].toUpperCase()+s.slice(1); }
function inr_(v){ return fmtMoney(v,'INR'); }   /* R1: one money formatter — alias to fmtMoney (currency-aware) */
function nm(v, fb){ return esc(v||fb||'—'); }   /* R3: one name-with-fallback — esc(display_name || fallback) */
function fmtAt(ts){ try{ return new Date(ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }catch(_){ return ''; } }

const CCY_LOCALE={INR:'en-IN',USD:'en-US',EUR:'de-DE',GBP:'en-GB',JPY:'ja-JP',CNY:'zh-CN',AUD:'en-AU',CAD:'en-CA',CHF:'de-CH',SGD:'en-SG',AED:'ar-AE',SAR:'ar-SA',KWD:'ar-KW',BHD:'ar-BH',OMR:'ar-OM',KRW:'ko-KR',VND:'vi-VN',THB:'th-TH',MYR:'ms-MY',IDR:'id-ID',ZAR:'en-ZA',BRL:'pt-BR',RUB:'ru-RU',NGN:'en-NG',KES:'en-KE',LKR:'si-LK',BDT:'bn-BD',PKR:'ur-PK',NPR:'ne-NP'};
function fmtMoney(amount,code){ code=(code||'INR'); amount=Number(amount||0); try{ return new Intl.NumberFormat(CCY_LOCALE[code]||undefined,{style:'currency',currency:code,currencyDisplay:'narrowSymbol'}).format(amount); }catch(e){ try{ return new Intl.NumberFormat(CCY_LOCALE[code]||undefined,{style:'currency',currency:code}).format(amount); }catch(_){ return code+' '+amount.toLocaleString(); } } }

function jwtPayload(t){ try{ const p=String(t||"").split('.')[1]; if(!p) return null; return JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/'))); }catch(_){ return null; } }
