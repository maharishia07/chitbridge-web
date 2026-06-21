import React, { useMemo, useState } from "react";
// ---- Chit & Bridge — Network Connect (live demo) ----
// Self-contained store + UI. Brand tokens dogfooded.
const C = {
  blue:"#3F66A6", gold:"#C9A86A", grey:"#7C8085", ink:"#0F2E3D",
  paper:"#FFFFFF", line:"#D8E0E4", bg:"#F7F9FA",
  green:"#2C6B2C", greenBg:"#E7F4E7", greenLn:"#9CC79C",
  red:"#9A3B3B", redBg:"#FBEEEE", redLn:"#C06A6A",
  amber:"#9A6A12", amberBg:"#FDF4E3", amberLn:"#E0A32A",
};
const seed = () => ({
  seq: 100,
  personaId: "e_anand",
  entities: [
    { id:"e_anand", bridgeId:"CB-AN1D-0000-0001", name:"Anand Distributors (HQ)", mode:"b2b", path:"anand" },
    { id:"e_chn",   bridgeId:"CB-AN1D-0000-0002", name:"Chennai Region",  mode:"b2b", path:"anand.chennai" },
    { id:"e_tng",   bridgeId:"CB-AN1D-0000-0003", name:"T.Nagar Branch",  mode:"b2b", path:"anand.chennai.tnagar" },
    { id:"e_ady",   bridgeId:"CB-AN1D-0000-0004", name:"Adyar Branch",    mode:"b2b", path:"anand.chennai.adyar" },
    { id:"e_acme",  bridgeId:"CB-7K2P-9QH4-3M21", name:"ACME Distributors", mode:"b2b", path:"acme" },
    { id:"e_bes",   bridgeId:"CB-BES4-1010-2020", name:"Besant Traders",  mode:"b2b", path:"besant" }, // root, independent
  ],
  edges: [
    { id:"x1", parentId:"e_anand", childId:"e_chn", type:"governance", state:"active",    inFlight:true  },
    { id:"x2", parentId:"e_chn",   childId:"e_tng", type:"governance", state:"active",    inFlight:false },
    { id:"x3", parentId:"e_chn",   childId:"e_ady", type:"governance", state:"active",    inFlight:false },
    { id:"x4", parentId:"e_acme",  childId:"e_bes", type:"governance", state:"requested", inFlight:false }, // ACME → Besant (pending)
  ],
});
const seg = (p) => p.split(".");
const lastSeg = (p) => seg(p)[seg(p).length - 1];
export default function NetworkConnect() {
  const [st, setSt] = useState(seed);
  const me = st.entities.find(e => e.id === st.personaId);
  const byId = (id) => st.entities.find(e => e.id === id);
  const [tab, setTab] = useState("net");
  // --- derived ---
  const mySubtree = useMemo(
    () => st.entities
      .filter(e => e.path === me.path || e.path.startsWith(me.path + "."))
      .sort((a,b) => a.path.localeCompare(b.path)),
    [st.entities, me.path]
  );
  const hasParent = (e) => st.edges.some(x => x.childId === e.id && (x.state==="active"||x.state==="suspended"));
  const incoming = st.edges.filter(x => x.childId === me.id && x.state === "requested");
  const outgoing = st.edges.filter(x => x.parentId === me.id && x.state === "requested");
  const myConnections = st.edges.filter(x => (x.parentId===me.id||x.childId===me.id) && (x.state==="active"||x.state==="suspended"));
  // --- actions ---
  const setEdge = (id, patch) => setSt(s => ({...s, edges: s.edges.map(x => x.id===id?{...x,...patch}:x)}));
  const lookup = (raw) => st.entities.find(e => e.bridgeId.toUpperCase() === raw.trim().toUpperCase());
  const requestConnect = (targetId) => {
    const id = "x" + (st.seq+1);
    setSt(s => ({...s, seq:s.seq+1, edges:[...s.edges, { id, parentId:me.id, childId:targetId, type:"governance", state:"requested", inFlight:false }]}));
  };
  const registerThenRequest = (name) => {
    const eid = "e" + (st.seq+1);
    const bridgeId = "CB-NEW" + (st.seq) + "-STUB-0000";
    setSt(s => ({...s, seq:s.seq+1,
      entities:[...s.entities, { id:eid, bridgeId, name, mode:"b2b", path:"reg_"+eid, claimed:false }]}));
    // unclaimed stub: request stays 'requested' until claimed
    setTimeout(()=>requestConnect(eid), 0);
  };
  const approve = (edge) => {
    const parent = byId(edge.parentId), child = byId(edge.childId);
    const newPath = parent.path + "." + lastSeg(child.path);
    setSt(s => ({...s,
      entities: s.entities.map(e => {
        if (e.id === child.id) return {...e, path:newPath};
        if (e.path.startsWith(child.path + ".")) return {...e, path:newPath + e.path.slice(child.path.length)};
        return e;
      }),
      edges: s.edges.map(x => x.id===edge.id ? {...x, state:"active"} : x),
    }));
  };
  const decline = (edge) => setEdge(edge.id, {state:"declined"});
  const suspend = (edge) => setEdge(edge.id, {state:"suspended"});
  const resume  = (edge) => setEdge(edge.id, {state:"active"});
  const disconnect = (edge) => {
    if (edge.inFlight) return; // guarded in UI
    setEdge(edge.id, {state:"disconnected"});
  };
  const settleAndDisconnect = (edge) => setSt(s => ({...s, edges: s.edges.map(x => x.id===edge.id?{...x,inFlight:false,state:"disconnected"}:x)}));
  // --- tiny UI atoms ---
  const Badge = ({state}) => {
    const m = { active:[C.green,C.greenBg,C.greenLn], requested:[C.amber,C.amberBg,C.amberLn],
      suspended:[C.grey,"#EEF1F2","#C4D0D5"], declined:[C.red,C.redBg,C.redLn], disconnected:["#FFF",C.ink,C.ink] }[state] || [C.grey,"#eee","#ccc"];
    return <span style={{color:m[0],background:m[1],border:`1px solid ${m[2]}`,borderRadius:12,padding:"2px 10px",fontSize:12,fontWeight:700}}>{state}</span>;
  };
  const Btn = ({onClick, kind="ghost", children, disabled}) => {
    const k = { primary:[C.paper,C.blue,C.blue], ghost:[C.ink,C.paper,C.line], danger:[C.red,C.redBg,C.redLn] }[kind];
    return <button onClick={onClick} disabled={disabled} style={{color:disabled?"#aaa":k[0],background:k[1],border:`1px solid ${k[2]}`,borderRadius:8,padding:"8px 14px",fontWeight:700,fontSize:13,cursor:disabled?"not-allowed":"pointer",marginRight:8}}>{children}</button>;
  };
  const Card = ({children, style}) => <div style={{background:C.paper,border:`1px solid ${C.line}`,borderRadius:12,padding:18,marginBottom:14,...style}}>{children}</div>;
  // --- add-connection form ---
  const [bid, setBid] = useState("");
  const [found, setFound] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [regName, setRegName] = useState("");
  const doLookup = () => { const f = lookup(bid); setFound(f||null); setNotFound(!f && bid.trim().length>0); };
  return (
    <div style={{fontFamily:"system-ui, Arial, sans-serif", background:C.bg, minHeight:"100%", padding:20}}>
      {/* persona bar */}
      <div style={{background:C.ink, color:"#fff", borderRadius:12, padding:"14px 18px", marginBottom:16, display:"flex", alignItems:"center", gap:14, flexWrap:"wrap"}}>
        <div style={{fontWeight:700, fontSize:18}}>Network connections</div>
        <div style={{fontSize:12, color:"#9fc4d0"}}>Bridge ID · two-party consent · down-only (v1)</div>
        <div style={{marginLeft:"auto", display:"flex", alignItems:"center", gap:8}}>
          <span style={{fontSize:12, color:"#9fc4d0"}}>Viewing as:</span>
          {["e_anand","e_bes","e_acme"].map(pid => {
            const e = byId(pid); const on = pid===st.personaId;
            return <button key={pid} onClick={()=>{setSt(s=>({...s,personaId:pid})); setFound(null); setNotFound(false); setBid("");}}
              style={{borderRadius:14, padding:"5px 12px", fontSize:12, fontWeight:700, cursor:"pointer",
                border:`1px solid ${on?C.gold:"#365"}`, background:on?C.gold:"transparent", color:on?C.ink:"#cfe0e6"}}>{e.name.split(" ")[0]}</button>;
          })}
        </div>
      </div>
      {/* tabs */}
      <div style={{display:"flex", gap:8, marginBottom:14}}>
        {[["net","My network"],["req",`Requests${incoming.length?` (${incoming.length})`:""}`],["con","Connections"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{borderRadius:8, padding:"8px 16px", fontWeight:700, fontSize:13, cursor:"pointer",
            border:`1px solid ${tab===k?C.blue:C.line}`, background:tab===k?C.blue:C.paper, color:tab===k?"#fff":C.ink}}>{l}</button>
        ))}
      </div>
      {/* MY NETWORK */}
      {tab==="net" && (<>
        <Card>
          <div style={{fontWeight:700, fontSize:15, color:C.ink, marginBottom:10}}>Your network — you see the downside, drill down</div>
          {mySubtree.map(e => {
            const depth = seg(e.path).length - seg(me.path).length;
            return <div key={e.id} style={{padding:"7px 0", paddingLeft:depth*26, borderBottom:`1px solid #f0f3f4`, fontSize:14, color:C.ink}}>
              <span style={{color:C.blue, marginRight:8}}>{depth===0?"●":"–"}</span>{e.name}
              {e.id===me.id && <span style={{marginLeft:8, fontSize:11, color:C.grey}}>(you)</span>}
            </div>;
          })}
          {outgoing.length>0 && outgoing.map(x=>(
            <div key={x.id} style={{padding:"7px 0", paddingLeft:26, fontSize:14, color:C.amber}}>– {byId(x.childId).name} <Badge state="requested"/> <span style={{fontSize:11}}>awaiting their consent</span></div>
          ))}
        </Card>
        <Card>
          <div style={{fontWeight:700, fontSize:15, color:C.ink, marginBottom:10}}>Add a connection</div>
          <div style={{fontSize:13, fontWeight:700, color:"#44606c", marginBottom:6}}>Counterpart Bridge ID</div>
          <div style={{display:"flex", gap:8, marginBottom:12}}>
            <input value={bid} onChange={e=>setBid(e.target.value)} placeholder="CB-XXXX-XXXX-XXXX"
              style={{flex:1, padding:"10px 12px", borderRadius:8, border:`1px solid #c4d0d5`, fontFamily:"monospace", fontSize:14}} />
            <Btn kind="primary" onClick={doLookup}>Look up</Btn>
          </div>
          <div style={{fontSize:12, color:C.grey, marginBottom:12}}>Direction: <b>▼ Down</b> &nbsp;·&nbsp; <span style={{color:"#aaa"}}>▲ Up — v1: off</span> &nbsp; (try CB-BES4-1010-2020, or any unknown id)</div>
          {found && (
            <div style={{background:C.bg, border:`1px solid ${C.line}`, borderRadius:8, padding:14}}>
              <div style={{fontWeight:700, color:C.ink}}>{found.name} <Badge state="active"/></div>
              <div style={{fontSize:12, color:C.grey, margin:"4px 0 10px"}}>Bridge ID {found.bridgeId} · mode {found.mode} · verified</div>
              {hasParent(found)
                ? <div style={{color:C.red, fontSize:13, fontWeight:700}}>Already in a network — tree-only (one parent). Cannot add.</div>
                : found.id===me.id
                  ? <div style={{color:C.red, fontSize:13}}>That's you.</div>
                  : <Btn kind="primary" onClick={()=>{requestConnect(found.id); setFound(null); setBid(""); setTab("net");}}>Request permission (down)</Btn>}
            </div>
          )}
          {notFound && (
            <div style={{background:C.amberBg, border:`1px solid ${C.amberLn}`, borderRadius:8, padding:14}}>
              <div style={{fontWeight:700, color:C.amber, marginBottom:8}}>Bridge ID not found — register entity →</div>
              <input value={regName} onChange={e=>setRegName(e.target.value)} placeholder="New entity name"
                style={{padding:"8px 10px", borderRadius:8, border:`1px solid #c4d0d5`, marginRight:8}} />
              <Btn kind="primary" disabled={!regName.trim()} onClick={()=>{registerThenRequest(regName.trim()); setRegName(""); setBid(""); setNotFound(false); setTab("net");}}>Register + invite</Btn>
              <div style={{fontSize:11, color:C.amber, marginTop:8}}>Stub stays pending until claimed (identity verified) — an unclaimed stub can't consent.</div>
            </div>
          )}
        </Card>
      </>)}
      {/* REQUESTS (approver) */}
      {tab==="req" && (<>
        {incoming.length===0 && <Card><div style={{color:C.grey}}>No incoming requests for {me.name}.</div></Card>}
        {incoming.map(x => {
          const from = byId(x.parentId);
          return <Card key={x.id}>
            <div style={{fontWeight:700, fontSize:17, color:C.ink}}>{from.name} wants to connect</div>
            <div style={{display:"inline-block", marginTop:6, background:C.amberBg, border:`1px solid ${C.amberLn}`, borderRadius:14, padding:"3px 12px", fontFamily:"monospace", fontWeight:700, color:C.amber, fontSize:13}}>{from.bridgeId}</div>
            <div style={{fontSize:14, color:C.ink, margin:"12px 0 6px"}}>They want to add <b>you</b> as a <b>downstream node</b> (edge type: <span style={{color:C.blue,fontWeight:700}}>governance</span>, authority flows down).</div>
            <div style={{display:"flex", gap:14, flexWrap:"wrap", marginTop:8}}>
              <div style={{flex:1, minWidth:260, background:C.greenBg, border:`1px solid ${C.greenLn}`, borderRadius:8, padding:12}}>
                <div style={{fontWeight:700, color:C.green, marginBottom:6}}>If you accept</div>
                <div style={{fontSize:13, color:"#2f5a2f", lineHeight:1.7}}>✓ they govern you per this edge (cannot loosen your floors)<br/>✓ they see your compliance status within the grant<br/>✓ the connection shows in both networks</div>
              </div>
              <div style={{flex:1, minWidth:260, background:C.redBg, border:`1px solid ${C.redLn}`, borderRadius:8, padding:12}}>
                <div style={{fontWeight:700, color:C.red, marginBottom:6}}>They will NOT</div>
                <div style={{fontSize:13, color:"#7a3b3b", lineHeight:1.7}}>✗ see your customers / registrants (default-deny)<br/>✗ see your internal catalogue or pricing<br/>✗ reach sideways or beyond the grant</div>
              </div>
            </div>
            <div style={{marginTop:14}}>
              <Btn kind="primary" onClick={()=>{approve(x); setTab("net");}}>Approve</Btn>
              <Btn kind="danger" onClick={()=>decline(x)}>Decline</Btn>
              <span style={{fontSize:12, color:C.grey, marginLeft:6}}>Mutual to form · you can suspend / disconnect anytime.</span>
            </div>
          </Card>;
        })}
      </>)}
      {/* CONNECTIONS (lifecycle) */}
      {tab==="con" && (<>
        {myConnections.length===0 && <Card><div style={{color:C.grey}}>No active connections for {me.name}.</div></Card>}
        {myConnections.map(x => {
          const other = byId(x.parentId===me.id ? x.childId : x.parentId);
          const role = x.parentId===me.id ? "you govern" : "governed by";
          return <Card key={x.id}>
            <div style={{display:"flex", alignItems:"center", gap:10}}>
              <div style={{fontWeight:700, color:C.ink, fontSize:15}}>{other.name}</div>
              <Badge state={x.state}/>
              <span style={{fontSize:12, color:C.grey}}>{role} · {x.type}</span>
            </div>
            <div style={{marginTop:12}}>
              {x.state==="active" && <Btn onClick={()=>suspend(x)}>Suspend</Btn>}
              {x.state==="suspended" && <Btn kind="primary" onClick={()=>resume(x)}>Resume</Btn>}
              {x.inFlight
                ? <Btn kind="danger" disabled>Disconnect (blocked)</Btn>
                : <Btn kind="danger" onClick={()=>disconnect(x)}>Disconnect</Btn>}
              {x.inFlight && <span style={{color:C.red, fontSize:12, marginLeft:6}}>In-flight chit on this edge — <a style={{color:C.blue, cursor:"pointer", fontWeight:700}} onClick={()=>settleAndDisconnect(x)}>settle &amp; disconnect</a> (compensates first)</span>}
            </div>
          </Card>;
        })}
      </>)}
      <div style={{textAlign:"center", fontSize:11, color:C.grey, marginTop:8}}>Chit &amp; Bridge · Bridgemark · canon — demo store, in-memory</div>
    </div>
  );
}
