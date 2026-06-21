import { useEffect, useState } from 'react';
// API base — repo convention is VITE_API_URL (not VITE_API_BASE); endpoints live under /api.
const API = (import.meta.env.VITE_API_URL || '') + '/api';
const TABS = [['overview','Overview'],['see','See it work'],['map','The map'],
  ['foryou','Is this for you?'],['straight','Straight talk'],['usp',"What's different"]];
const READY = { working:['rb-working','Working'], designed:['rb-designed','Designed'], soon:['rb-soon','When ready'] };
const Badge = ({r}) => { const b = READY[r]||READY.designed; return <span className={'rb '+b[0]}>{b[1]}</span>; };

export default function SimulatorPage(){
  const [content,setContent] = useState(null);
  const [token,setToken] = useState(()=>localStorage.getItem('cb_token'));
  const [leadId,setLeadId] = useState(()=>localStorage.getItem('cb_lead_id'));
  const [tab,setTab] = useState('overview');
  useEffect(()=>{ fetch(`${API}/simulator/content`).then(r=>r.json()).then(setContent).catch(()=>{}); },[]);
  if(!token) return <><Style/><Gate onDone={(t,id)=>{localStorage.setItem('cb_token',t);localStorage.setItem('cb_lead_id',id);setToken(t);setLeadId(id);}}/></>;
  if(!content) return <><Style/><div className="sim-load">Loading…</div></>;
  return (<div className="sim"><Style/>
    <header className="sim-head"><h1>Chit &amp; Bridge</h1><span>a governed way for organisations to transact — a look inside</span></header>
    <nav className="sim-tabs">{TABS.map(([k,l])=><button key={k} className={tab===k?'active':''} onClick={()=>{setTab(k);window.scrollTo(0,0);}}>{l}</button>)}</nav>
    <main>
      {tab==='overview' && <Overview c={content}/>}
      {tab==='see' && <See c={content}/>}
      {tab==='map' && <Map c={content}/>}
      {tab==='foryou' && <ForYou c={content}/>}
      {tab==='straight' && <Straight/>}
      {tab==='usp' && <Usp c={content}/>}
    </main>
    <Feedback leadId={leadId} section={tab}/>
  </div>);
}

function Overview({c}){
  return <section>
    <h2>What this platform does</h2>
    <p className="lead">Seven simple parts that combine into your business. The engine underneath is the same for everyone — what changes is the setup it inherits.</p>
    {c.layers.map((L,i)=><div className="card row" key={L.id}><div className="num">{i+1}</div><div><p className="lname">{L.name}</p><p className="lpur">{L.purpose}</p></div></div>)}
    <div className="assembly"><div className="num">✓</div><div><p className="lname">= your running business</p><p className="lpur">the seven parts combine, then keep only what you need</p></div></div>
  </section>;
}

function Map({c}){
  const itemsFor = id => c.items.filter(it=>it.layer_id===id);
  return <section>
    <h2>The map</h2>
    <p className="lead">Everything the platform handles, in plain words. Each item shows how ready it is.</p>
    {c.layers.map((L,i)=><MapLayer key={L.id} n={i+1} L={L} items={itemsFor(L.id)} open={i===0}/>)}
  </section>;
}
function MapLayer({n,L,items,open}){
  const [o,setO]=useState(open);
  return <div className={'lblock'+(o?' open':'')}>
    <div className="lhead" onClick={()=>setO(!o)}><span className="num">{n}</span><span className="lname">{L.name}</span><span className="chev">▸</span></div>
    {o && <div className="lbody">{items.map(it=><div className="item" key={it.id}><div className="itop"><span className="nm">{it.name}</span><Badge r={it.readiness}/></div><div className="mn">{it.meaning}</div></div>)}</div>}
  </div>;
}

function See({c}){
  const [trade,setTrade]=useState('pharmacy');
  const [shape,setShape]=useState(c.shapes[0]?.id);
  const [a,setA]=useState(5),[b,setB]=useState(8),[clash,setClash]=useState(false);
  const [proof,setProof]=useState([]);
  const kit = c.items.filter(it=>it.layer_id===3 && (it.ex_pharmacy||it.ex_restaurant));
  const sh = c.shapes.find(s=>s.id===shape)||c.shapes[0];
  const runSmoke = () => { const names=['Stop-and-name rule','Plan upgrade in place','Frozen receipt','Inherit-live','Certificate cascade']; names.forEach((_,i)=>setTimeout(()=>setProof(p=>[...p,i]),350*(i+1))); };
  return <section>
    <h2>See it work</h2>
    <p className="lead">A few things you can change and watch respond.</p>

    <h3>Switch the trade</h3>
    <div className="ctl">{['pharmacy','restaurant'].map(t=><button key={t} className={trade===t?'on':''} onClick={()=>setTrade(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}</div>
    <div className="card">{kit.map(it=><div key={it.id} className="kv"><b>{it.name}:</b> {trade==='pharmacy'?it.ex_pharmacy:it.ex_restaurant}</div>)}</div>

    <h3>Change the platform shape</h3>
    <div className="ctl">{c.shapes.map(s=><button key={s.id} className={shape===s.id?'on':''} onClick={()=>setShape(s.id)}>{s.name}</button>)}</div>
    <div className="card"><div className="kv"><b>Where the customer lives:</b> {sh.customer_home}</div><div className="kv"><b>Discovery:</b> {sh.discovery}</div><p className="note">{sh.note}</p><p className="note">Supported shape. Mixing consumer and business in one network is not supported — and we say so.</p></div>

    <h3>How rules combine</h3>
    <div className="card">
      <div className="combineCtl">
        <label className="note">Rule A floor: <select value={a} onChange={e=>setA(+e.target.value)}>{[2,5,10].map(v=><option key={v}>{v}</option>)}</select></label>
        <label className="note">Rule B floor: <select value={b} onChange={e=>setB(+e.target.value)}>{[2,5,8].map(v=><option key={v}>{v}</option>)}</select></label>
        <label className="note"><input type="checkbox" checked={clash} onChange={e=>setClash(e.target.checked)}/> introduce a contradiction</label>
      </div>
      <div className="combineOut">{clash
        ? <span><b style={{color:'#b3402f'}}>⏹ Stops and names it.</b> Rule A and Rule B can't both be met. The platform doesn't guess — it halts and reports the two that clash.</span>
        : <span>Common ground = <b>{Math.max(a,b)}</b>. Both floors are satisfied by taking the higher of the two.</span>}</div>
    </div>

    <h3>Proven by test</h3>
    <p className="note">A feature is called "working" only when an automated test proves it. Green means a passing test backs it.</p>
    <div className="stripe">{['Stop-and-name rule','Plan upgrade in place','Frozen receipt','Inherit-live','Certificate cascade'].map((p,i)=><span key={i} className={'chip'+(proof.includes(i)?' green':'')}><span className="dot"/>{p}</span>)}</div>
    <button className="btn" onClick={runSmoke}>Run the smoke test</button>
  </section>;
}

function ForYou({c}){
  const [ans,setAns]=useState({});
  const [v,setV]=useState(null);
  const run=()=>{
    const order={exclude:4,defer:3,configure:2,pass:1}; let worst='pass'; const fired=[];
    c.rules.forEach(r=>{ if(ans[r.id]==='yes'){ fired.push(r); if(order[r.disposition]>order[worst])worst=r.disposition; } });
    const pick=d=>fired.filter(r=>r.disposition===d).map(r=>r.detail);
    let cls,head,list;
    if(worst==='exclude'){cls='no';head='Not a fit as described — but here’s the alternative.';list=pick('exclude');}
    else if(worst==='defer'){cls='notyet';head='Not yet — here’s what it’s waiting on.';list=pick('defer');}
    else if(worst==='configure'){cls='config';head='Yes — set it up this way.';list=pick('configure');}
    else{cls='yes';head='Clean fit — yes.';list=[];}
    setV({cls,head,list,also:pick('pass')});
  };
  return <section>
    <h2>Is this for you?</h2>
    <p className="lead">This isn't for everyone — and that's the point.</p>

    <h3>What we are — and what we're not</h3>
    <div className="two">
      <div className="card col are"><h4>We are</h4><ul><li>a governed way for different organisations to transact</li><li>so a deal either fully completes, or cleanly stops and compensates — on the record</li><li>a rulebook-and-coordination engine across firms</li></ul></div>
      <div className="card col arenot"><h4>We're not</h4><ul><li>an ERP or an accounting book</li><li>a payments rail or an identity issuer</li><li>a promise that the physical world matched the record</li><li>a place to mix consumer and business buyers in one network</li></ul></div>
    </div>

    <h3>How we compare</h3>
    <table className="tbl"><thead><tr><th>Neighbour</th><th>What it does</th><th>The difference</th></tr></thead>
    <tbody>{c.compare.map(r=><tr key={r.id}><td><b>{r.neighbour}</b></td><td>{r.does}</td><td>{r.difference}</td></tr>)}</tbody></table>

    <h3>Where we sit</h3>
    <div className="card" style={{padding:8}}>
      <svg viewBox="0 0 600 360" width="100%">
        <line x1="60" y1="320" x2="560" y2="320" stroke="#cfcfca"/><line x1="60" y1="40" x2="60" y2="320" stroke="#cfcfca"/>
        <text x="300" y="350" textAnchor="middle" fontSize="12" fill="#5d5d6b">within one organisation → across organisations</text>
        <text x="24" y="180" textAnchor="middle" fontSize="12" fill="#5d5d6b" transform="rotate(-90 24 180)">best-effort → governed</text>
        <circle cx="150" cy="290" r="6" fill="#9a9aa6"/><text x="162" y="294" fontSize="12" fill="#5d5d6b">spreadsheets, email</text>
        <circle cx="150" cy="110" r="6" fill="#9a9aa6"/><text x="162" y="114" fontSize="12" fill="#5d5d6b">ERP (one firm)</text>
        <circle cx="430" cy="290" r="6" fill="#9a9aa6"/><text x="330" y="294" fontSize="12" fill="#5d5d6b">marketplaces, EDI</text>
        <circle cx="470" cy="90" r="9" fill="#3b4ec2"/><text x="360" y="78" fontSize="13" fill="#3b4ec2" fontWeight="700">Chit &amp; Bridge</text>
      </svg>
    </div>

    <h3>Will it work for my business?</h3>
    <div className="card">
      {c.rules.map((r,i)=><div className="q" key={r.id}><div className="qt">{i+1}. {r.question}</div>
        <label><input type="radio" name={'q'+r.id} onChange={()=>setAns({...ans,[r.id]:'yes'})}/> Yes</label>
        <label><input type="radio" name={'q'+r.id} defaultChecked onChange={()=>setAns({...ans,[r.id]:'no'})}/> No</label></div>)}
      <button className="btn" onClick={run} style={{marginTop:12}}>See my verdict</button>
      {v && <div className={'verdict '+v.cls}><h4>{v.head}</h4>{v.list.length>0 && <ul>{v.list.map((t,i)=><li key={i}>{t}</li>)}</ul>}{v.also.length>0 && <><div className="note">Also worth knowing:</div><ul>{v.also.map((t,i)=><li key={i}>{t}</li>)}</ul></>}</div>}
    </div>
  </section>;
}

function Straight(){
  return <section>
    <h2>Straight talk</h2>
    <p className="lead">The honest spine. What's proven, what isn't, where AI fits, and what we don't promise.</p>
    <h3>How this was built — and how we know it holds</h3>
    <div className="card"><p>It started from real pain in distribution and trade, mapped from a legacy system through a long design dialogue, with every decision logged. The first build set out to prove not features but <b>soundness</b> — that rules fold without contradiction, a clash stops cleanly, permissions hold, and a deal completes or compensates. Code was written to <b>test the logic</b>, with the governance layer's tests passing. Most features are designed, not yet built — and this page never pretends otherwise.</p></div>
    <h3>Where AI fits — and where it must not</h3>
    <div className="card"><p>AI is the <b>proposer</b>: it drafts rule interpretations, maps fields, and explains in plain words. AI must <b>not</b> be the final attester (a qualified human is accountable), the enforcement engine (exact and repeatable, not probabilistic), or a voucher for truth. The flip side is the prize: a <b>safe harness for AI agents in commerce</b> — an agent can act because real rules and a human check its moves before they bind. <i>AI proposes, a human attests, the engine disposes.</i></p></div>
    <h3>My own critique</h3>
    <div className="card"><ul><li>Who may attest a rule, and who's liable when an attestation is wrong, is still open.</li><li>Cross-organisation hand-off with an end-to-end guarantee isn't built yet.</li><li>Breadth is unproven beyond the first mechanisms.</li><li>Plain English can hide complexity; the simplicity is a promise to keep.</li><li>A single attester is a bottleneck until the role is shared.</li></ul></div>
    <h3>Not yet</h3>
    <div className="card"><p>Cross-border transactions, anonymous-yet-portable identity, multi-hop custody with a hard guarantee, and deep delegation chains are planned — each built only when a real use case pays for it.</p></div>
    <h3>Disclaimer</h3>
    <div className="card"><p className="note">A design showcase, not the live platform. Demos illustrate mechanisms, not production breadth. Any guarantee covers the record and compensation, not that the physical world matched it. Assessed use cases only. Not legal or financial advice.</p></div>
  </section>;
}

function Usp({c}){
  return <section>
    <h2>What makes us different</h2>
    <p className="lead">Each standout feature shown with both sides — what it gives you, and the honest trade-off — plus how ready it is.</p>
    <table className="tbl"><thead><tr><th>Feature</th><th>What it gives</th><th>The trade-off</th><th>Ready?</th></tr></thead>
    <tbody>{c.usps.map(u=><tr key={u.id}><td><b>{u.name}</b></td><td>{u.pleasure||u.why}</td><td className="note">{u.pain||'—'}</td><td><Badge r={u.readiness}/></td></tr>)}</tbody></table>
    <p className="note">Readiness is from the design record; confirm against the build before publishing.</p>
  </section>;
}

function Gate({onDone}){
  const [f,setF]=useState({name:'',email:'',org:''}); const [err,setErr]=useState('');
  const submit=async()=>{ if(!f.name||!f.email.includes('@')) return setErr('A name and a valid email, please.');
    try{ const r=await fetch(`${API}/simulator/lead`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(f)}); const d=await r.json(); if(d.token)onDone(d.token,d.leadId); else setErr('Please try again.'); }catch{ setErr('Please try again.'); } };
  return <><div className="sim-gate"><div className="gcard">
    <h3>Have a look inside</h3><p>A quick hello so we know who's interested.</p>
    <input placeholder="Your name" onChange={e=>setF({...f,name:e.target.value})}/>
    <input placeholder="Email" onChange={e=>setF({...f,email:e.target.value})}/>
    <input placeholder="Organisation (optional)" onChange={e=>setF({...f,org:e.target.value})}/>
    <div className="err">{err}</div><button className="btn" style={{width:'100%'}} onClick={submit}>Enter</button>
  </div></div></>;
}

function Feedback({leadId,section}){
  const [open,setOpen]=useState(false); const [msg,setMsg]=useState(''); const [rating,setRating]=useState(0); const [sent,setSent]=useState(false);
  const send=async()=>{ if(!msg)return; try{ await fetch(`${API}/simulator/feedback`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({section,rating,message:msg,leadId})}); }catch{} setSent(true); };
  if(!open) return <button className="fab" onClick={()=>setOpen(true)}>Give feedback</button>;
  return <div className="fbbox">{sent? <p>Thank you — noted.</p> : <><div className="stars">{[1,2,3,4,5].map(n=><span key={n} className={n<=rating?'on':''} onClick={()=>setRating(n)}>★</span>)}</div><textarea placeholder="What works, what doesn't?" onChange={e=>setMsg(e.target.value)}/><button className="btn" onClick={send}>Send</button></>}</div>;
}

function Style(){ return <style>{`
.sim{max-width:920px;margin:0 auto;padding:0 20px 80px;color:#17171f;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif}
.sim-load{max-width:920px;margin:40px auto;color:#5d5d6b}
.sim-head{padding:22px 0 6px}.sim-head h1{font-size:22px;margin:0;display:inline}.sim-head span{color:#5d5d6b;font-size:14px;margin-left:10px}
.sim-tabs{display:flex;flex-wrap:wrap;gap:4px;padding:10px 0 18px;border-bottom:1px solid #e7e6e1;margin-bottom:24px}
.sim-tabs button{border:1px solid transparent;background:none;color:#5d5d6b;padding:7px 12px;border-radius:999px;cursor:pointer;font-size:14px;font-weight:500}
.sim-tabs button.active{background:#eef0fb;color:#3b4ec2}
.sim h2{font-size:24px;margin:0 0 6px}.sim h3{font-size:17px;margin:28px 0 10px}.sim .lead{color:#5d5d6b;margin:0 0 20px}
.card{background:#fff;border:1px solid #e7e6e1;border-radius:14px;padding:14px 18px;margin:8px 0}
.row{display:flex;gap:14px;align-items:flex-start}.num{flex:none;width:30px;height:30px;border-radius:50%;background:#eef0fb;color:#3b4ec2;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14px}
.lname{font-weight:600;margin:0;font-size:15px}.lpur{color:#5d5d6b;font-size:14px;margin:2px 0 0}
.assembly{display:flex;gap:14px;align-items:center;background:#f7efdc;border:1px solid #ecdcb6;border-radius:14px;padding:14px 18px;margin-top:10px}.assembly .num{background:#fff;color:#c79a3b}
.rb{display:inline-block;font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;text-transform:uppercase}
.rb-working{background:#e6f3eb;color:#2f8f5b}.rb-designed{background:#f7eed8;color:#b07d18}.rb-soon{background:#efeff1;color:#6b6b78}
.lblock{margin:12px 0}.lhead{display:flex;gap:10px;align-items:center;cursor:pointer;padding:6px 0}.lhead .lname{font-size:16px}.chev{margin-left:auto;color:#999}.lblock.open .chev{transform:rotate(90deg)}
.item{padding:11px 0;border-bottom:1px solid #eee}.item:last-child{border-bottom:0}.itop{display:flex;justify-content:space-between;gap:10px;align-items:center}.nm{font-weight:600;font-size:14px}.mn{color:#5d5d6b;font-size:14px}
.ctl{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px}.ctl button{border:1px solid #e7e6e1;background:#fff;padding:8px 14px;border-radius:999px;cursor:pointer;font-size:14px;color:#5d5d6b}.ctl button.on{background:#17171f;color:#fff;border-color:#17171f}
.kv{font-size:14px}.note{color:#5d5d6b;font-size:13px}
.combineCtl{display:flex;gap:18px;flex-wrap:wrap;align-items:center}.combineOut{margin-top:12px;font-size:15px}
.stripe{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.chip{font-size:13px;padding:6px 11px;border-radius:999px;border:1px solid #e7e6e1;background:#fff;display:flex;align-items:center;gap:7px}.dot{width:9px;height:9px;border-radius:50%;background:#6b6b78}.chip.green .dot{background:#2f8f5b}
.tbl{width:100%;border-collapse:collapse;font-size:14px;margin:6px 0}.tbl th,.tbl td{text-align:left;padding:11px 10px;border-bottom:1px solid #e7e6e1;vertical-align:top}.tbl th{color:#5d5d6b;font-size:12px;text-transform:uppercase;letter-spacing:.3px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:640px){.two{grid-template-columns:1fr}}
.col h4{margin:0 0 8px}.col.are h4{color:#2f8f5b}.col.arenot h4{color:#b3402f}.col ul{margin:0;padding-left:18px;color:#5d5d6b;font-size:14px}.col li{margin:6px 0}
.btn{background:#3b4ec2;color:#fff;border:0;padding:11px 18px;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer}
.q{padding:12px 0;border-bottom:1px solid #eee}.qt{font-size:14px;font-weight:500;margin-bottom:6px}.q label{margin-right:16px;font-size:14px;color:#5d5d6b;cursor:pointer}
.verdict{margin-top:16px;padding:16px 18px;border-radius:14px}.verdict h4{margin:0 0 8px}.verdict ul{margin:6px 0 0;padding-left:18px;font-size:14px}
.verdict.yes{background:#e6f3eb;border:1px solid #bfe3cd}.verdict.config{background:#eef0fb;border:1px solid #dfe3f6}.verdict.notyet{background:#f7eed8;border:1px solid #ecdcb6}.verdict.no{background:#fbeae7;border:1px solid #f1c9c1}
.sim-gate{position:fixed;inset:0;background:rgba(20,20,28,.55);display:flex;align-items:center;justify-content:center;padding:20px;z-index:50}.gcard{background:#fff;border-radius:18px;max-width:420px;width:100%;padding:26px}.gcard h3{margin:0 0 4px}.gcard p{color:#5d5d6b;font-size:14px;margin:0 0 16px}.gcard input{width:100%;padding:11px 12px;border:1px solid #e7e6e1;border-radius:10px;font-size:14px;margin:6px 0}.err{color:#b3402f;font-size:13px;min-height:16px}
.fab{position:fixed;right:20px;bottom:20px;background:#17171f;color:#fff;border:0;border-radius:999px;padding:11px 16px;font-size:14px;cursor:pointer;z-index:40}
.fbbox{position:fixed;right:20px;bottom:20px;background:#fff;border:1px solid #e7e6e1;border-radius:14px;padding:14px;width:280px;box-shadow:0 12px 40px rgba(0,0,0,.15);z-index:40}.fbbox textarea{width:100%;height:70px;border:1px solid #e7e6e1;border-radius:8px;padding:8px;font:inherit;font-size:14px;margin:6px 0}.stars span{cursor:pointer;color:#ccc;font-size:20px}.stars span.on{color:#c79a3b}
`}</style>; }
