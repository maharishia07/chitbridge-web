// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import CoAssistsPage   from './pages/CoAssistsPage';
import MyTasksPage     from './pages/MyTasksPage';
import NotFoundPage    from './pages/NotFoundPage';

const Protected = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  const { isLoggedIn } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isLoggedIn ? <Navigate to="/inbox" replace/> : <LoginPage/>}/>
      <Route path="/inbox"          element={<Protected><InboxPage/></Protected>}/>
      <Route path="/chit/:chitId"   element={<Protected><ChitDetailPage/></Protected>}/>
      <Route path="/send"           element={<Protected><SendChitPage/></Protected>}/>
      <Route path="/connections"    element={<Protected><ConnectionsPage/></Protected>}/>
      <Route path="/settings"       element={<Protected><SettingsPage/></Protected>}/>
      <Route path="/mis"            element={<Protected><MISPage/></Protected>}/>
      <Route path="/order"          element={<Protected><OrderPage/></Protected>}/>
      <Route path="/my-tasks"       element={<Protected><MyTasksPage/></Protected>}/>
      <Route path="/co-assists"     element={<Protected><CoAssistsPage/></Protected>}/>
      <Route path="/employees"      element={<Protected><CoAssistsPage/></Protected>}/>
      <Route path="/my-catalogue"   element={<Protected><StubPage title="My Catalogue" phase="Phase 1" description="Publish your product catalogue for buyers."/></Protected>}/>
      <Route path="/my-catalogue/upload" element={<Protected><StubPage title="Bulk Upload" phase="Phase 1" description="Upload products from CSV or Excel."/></Protected>}/>
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
