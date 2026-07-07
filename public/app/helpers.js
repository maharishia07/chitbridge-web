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
function fmtAt(ts){ try{ return new Date(ts).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'}); }catch(_){ return ''; } }   /* R4: pin en-IN (12h) so time is deterministic across browsers */
/* R5: connector/device health — ONE source (colour · dot · signal), was duplicated across cap-connector + cap-workforce. */
function healthColor(h){ return ({live:'#2f8f5b',slow:'#c9962a',offline:'#c0453b'})[h]||'#9aa3a7'; }
function healthDot(h){ return '<span title="'+esc(h||'')+'" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+healthColor(h)+'"></span>'; }
function sigLabel(s){ if(s==='no_signal')return '<span style="color:#c0453b;font-weight:700;font-size:11px">○ no signal</span>'; if(s==='live')return '<span style="color:#2f8f5b;font-weight:700;font-size:11px">● live</span>'; if(s==='slow')return '<span style="color:#c9962a;font-weight:700;font-size:11px">◐ slow</span>'; return '<span style="color:#9aa3a7;font-weight:700;font-size:11px">○ silent</span>'; }
/* R6: relative time ("2m ago") — was cap-workforce._ago; a generic leaf now (reusable in folders/inbox/etc). */
function timeAgo(ts){ if(!ts)return ''; var s=Math.floor((Date.now()-new Date(ts).getTime())/1000); if(s<0)s=0; if(s<60)return s+'s ago'; var m=Math.floor(s/60); if(m<60)return m+'m ago'; var h=Math.floor(m/60); if(h<24)return h+'h ago'; return Math.floor(h/24)+'d ago'; }

const CCY_LOCALE={INR:'en-IN',USD:'en-US',EUR:'de-DE',GBP:'en-GB',JPY:'ja-JP',CNY:'zh-CN',AUD:'en-AU',CAD:'en-CA',CHF:'de-CH',SGD:'en-SG',AED:'ar-AE',SAR:'ar-SA',KWD:'ar-KW',BHD:'ar-BH',OMR:'ar-OM',KRW:'ko-KR',VND:'vi-VN',THB:'th-TH',MYR:'ms-MY',IDR:'id-ID',ZAR:'en-ZA',BRL:'pt-BR',RUB:'ru-RU',NGN:'en-NG',KES:'en-KE',LKR:'si-LK',BDT:'bn-BD',PKR:'ur-PK',NPR:'ne-NP'};
function fmtMoney(amount,code){ code=(code||'INR'); amount=Number(amount||0); try{ return new Intl.NumberFormat(CCY_LOCALE[code]||undefined,{style:'currency',currency:code,currencyDisplay:'narrowSymbol'}).format(amount); }catch(e){ try{ return new Intl.NumberFormat(CCY_LOCALE[code]||undefined,{style:'currency',currency:code}).format(amount); }catch(_){ return code+' '+amount.toLocaleString(); } } }

function jwtPayload(t){ try{ const p=String(t||"").split('.')[1]; if(!p) return null; return JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/'))); }catch(_){ return null; } }
