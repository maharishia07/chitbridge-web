// src/App.jsx
import { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppModeProvider } from './context/AppModeContext';

import LoginPage       from './pages/LoginPage';
import InboxPage       from './pages/InboxPage';
import ChitDetailPage  from './pages/ChitDetailPage';
import SendChitPage    from './pages/SendChitPage';
import ConnectionsPage from './pages/ConnectionsPage';
import SettingsPage    from './pages/SettingsPage';
import MISPage         from './pages/MISPage';
import OrderPage       from './pages/OrderPage';
import StubPage        from './pages/StubPage';
import CoAssistsPage      from './pages/CoAssistsPage';
import MyTasksPage        from './pages/MyTasksPage';
import SetPinPage         from './pages/SetPinPage';
import ActorProfilePage   from './pages/ActorProfilePage';
import DisputesPage    from './pages/DisputesPage';
import MyCataloguePage from './pages/MyCataloguePage';
import SupplierOrderPage from './pages/SupplierOrderPage';
import PublicCataloguePage from './pages/PublicCataloguePage';
import NotFoundPage    from './pages/NotFoundPage';

// Layer Simulator — self-contained client-side teaching/QA tool (no auth, no API)
const SimulatorTab = lazy(() => import('./sim/SimulatorTab'));
// Public showcase tour — DB-backed, lead-gated marketing page (calls /api/simulator)
const SimulatorPage = lazy(() => import('./sim/SimulatorPage'));
// NET — network connect (self-contained demo) + live catalogue (needs deployed NET API)
const NetworkConnect = lazy(() => import('./sim/NetworkConnect'));
const Catalogue      = lazy(() => import('./sim/Catalogue'));

const Protected = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

// /catalogue is live (calls the NET API); supply an entity id (?entity=<uuid> or the input).
const CatalogueRoute = () => {
  const [entityId, setEntityId] = useState(new URLSearchParams(window.location.search).get('entity') || '');
  const [draft, setDraft] = useState(entityId);
  return (
    <div>
      <div style={{padding:'10px 16px',borderBottom:'1px solid #e5e7eb',display:'flex',gap:8,alignItems:'center'}}>
        <Link to="/inbox" style={{fontSize:13,color:'#2563eb',textDecoration:'none'}}>← Back</Link>
        <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="entity id (uuid from /api/network/entities)"
          style={{flex:1,padding:6,border:'1px solid #cdd9dd',borderRadius:6,fontSize:13}}/>
        <button onClick={()=>setEntityId(draft.trim())} style={{padding:'6px 12px',border:0,background:'#3F66A6',color:'#fff',borderRadius:6,fontWeight:700}}>Load</button>
      </div>
      {entityId ? <Catalogue entityId={entityId}/> : <div style={{padding:20,color:'#7C8085'}}>Enter an entity id to load its catalogue.</div>}
    </div>
  );
};

const AppRoutes = () => {
  const { isLoggedIn } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isLoggedIn ? <Navigate to="/inbox" replace/> : <LoginPage/>}/>
      {/* B3.7 — public storefront, no auth gate */}
      <Route path="/c/:bridgeId" element={<PublicCataloguePage/>}/>
      {/* Layer Simulator — public, no auth gate (client-side demo) */}
      <Route path="/simulator" element={
        <Suspense fallback={<div style={{padding:24}}>Loading simulator…</div>}>
          <div style={{padding:'10px 16px',borderBottom:'1px solid #e5e7eb'}}>
            <Link to="/inbox" style={{fontSize:13,color:'#2563eb',textDecoration:'none'}}>← Back to app</Link>
          </div>
          <SimulatorTab/>
        </Suspense>
      }/>
      {/* Public showcase tour — lead-gated, DB-backed; the SimulatorTab above stays as-is */}
      <Route path="/tour" element={
        <Suspense fallback={<div style={{padding:24}}>Loading…</div>}>
          <SimulatorPage/>
        </Suspense>
      }/>
      {/* NET — network connect (self-contained demo) + live catalogue */}
      <Route path="/network" element={
        <Suspense fallback={<div style={{padding:24}}>Loading network…</div>}>
          <div style={{padding:'10px 16px',borderBottom:'1px solid #e5e7eb'}}>
            <Link to="/inbox" style={{fontSize:13,color:'#2563eb',textDecoration:'none'}}>← Back to app</Link>
          </div>
          <NetworkConnect/>
        </Suspense>
      }/>
      <Route path="/catalogue" element={
        <Suspense fallback={<div style={{padding:24}}>Loading catalogue…</div>}><CatalogueRoute/></Suspense>
      }/>
      <Route path="/inbox"          element={<Protected><InboxPage/></Protected>}/>
      <Route path="/chit/:chitId"   element={<Protected><ChitDetailPage/></Protected>}/>
      <Route path="/send"           element={<Protected><SendChitPage/></Protected>}/>
      <Route path="/connections"    element={<Protected><ConnectionsPage/></Protected>}/>
      <Route path="/settings"       element={<Protected><SettingsPage/></Protected>}/>
      <Route path="/mis"            element={<Protected><MISPage/></Protected>}/>
      <Route path="/order"          element={<Protected><OrderPage/></Protected>}/>
      <Route path="/my-tasks"       element={<Protected><MyTasksPage/></Protected>}/>
      <Route path="/co-assists"     element={<Protected><CoAssistsPage/></Protected>}/>
      <Route path="/set-pin"        element={<Protected><SetPinPage/></Protected>}/>
      <Route path="/profile"        element={<Protected><ActorProfilePage/></Protected>}/>
      <Route path="/disputes"       element={<Protected><DisputesPage/></Protected>}/>
      <Route path="/employees"      element={<Protected><CoAssistsPage/></Protected>}/>
      <Route path="/my-catalogue"   element={<Protected><MyCataloguePage/></Protected>}/>
      <Route path="/supplier-order/:supplierId" element={<Protected><SupplierOrderPage/></Protected>}/>
      <Route path="/my-catalogue/upload" element={<Protected><StubPage title="Bulk Upload" phase="Phase 1" description="Upload products from CSV or Excel."/></Protected>}/>
      <Route path="/break" element={<Protected><StubPage title="Go on Break" phase="Under Development" description="View which co-assists are currently on break and manage break schedules. Use the Go on break button in My Task to manage your own break status."/></Protected>}/>
      <Route path="/" element={<Navigate to="/inbox" replace/>}/>
      <Route path="*" element={<NotFoundPage/>}/>
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppModeProvider>
          <AppRoutes/>
        </AppModeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
