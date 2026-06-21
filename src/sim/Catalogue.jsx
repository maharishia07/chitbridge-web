import React, { useEffect, useState } from "react";
import { catalogueApi } from "../api/catalogue";
const C = { blue:"#3F66A6", ink:"#0F2E3D", line:"#D8E0E4", paper:"#fff", grey:"#7C8085" };
export default function Catalogue({ entityId }) {
  const [items, setItems] = useState([]); const [err, setErr] = useState(null);
  const [form, setForm] = useState({ name:"", price:"", priceType:"Business" });
  const load = () => catalogueApi.items(entityId).then(setItems).catch(e=>setErr(e.message));
  useEffect(() => { load(); }, [entityId]);
  const add = async () => { if(!form.name) return; await catalogueApi.addItem(entityId, { ...form, price:Number(form.price)||0 }); setForm({name:"",price:"",priceType:"Business"}); load(); };
  return (
    <div style={{fontFamily:"system-ui,Arial",padding:20}}>
      <h3 style={{color:C.ink}}>Catalogue</h3>
      {err && <div style={{color:"#9A3B3B"}}>{err}</div>}
      <div style={{display:"flex",gap:8,margin:"12px 0"}}>
        <input placeholder="Product name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={{flex:2,padding:8,border:`1px solid ${C.line}`,borderRadius:8}}/>
        <input placeholder="Price" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} style={{width:110,padding:8,border:`1px solid ${C.line}`,borderRadius:8}}/>
        <select value={form.priceType} onChange={e=>setForm({...form,priceType:e.target.value})} style={{padding:8,border:`1px solid ${C.line}`,borderRadius:8}}>
          <option>Business</option><option>Personal</option><option>Employee</option>
        </select>
        <button onClick={add} style={{background:C.blue,color:"#fff",border:0,borderRadius:8,padding:"8px 16px",fontWeight:700}}>Add</button>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr style={{textAlign:"left",color:C.grey,fontSize:13}}><th>Name</th><th>Price</th><th>Tier</th><th>Stock</th></tr></thead>
        <tbody>{items.map(it=>(
          <tr key={it.id} style={{borderTop:`1px solid ${C.line}`}}>
            <td style={{padding:"8px 0"}}>{it.name}</td><td>{Number(it.price).toFixed(2)} {it.currency_code}</td>
            <td>{it.price_type}</td><td>{it.out_of_stock?"out":(it.available_stock||"—")}</td>
          </tr>))}
        </tbody>
      </table>
      {items.length===0 && <div style={{color:C.grey,marginTop:12}}>No products yet.</div>}
    </div>
  );
}
