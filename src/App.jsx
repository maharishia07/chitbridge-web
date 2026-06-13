// src/App.jsx — Root component with all providers and routes
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppModeProvider } from './context/AppModeContext';

// Pages
import LoginPage from './pages/LoginPage';
import InboxPage from './pages/InboxPage';
import ChitDetailPage from './pages/ChitDetailPage';
import SendChitPage from './pages/SendChitPage';
import ConnectionsPage from './pages/ConnectionsPage';
import SettingsPage from './pages/SettingsPage';
import MISPage from './pages/MISPage';
import NotFoundPage from './pages/NotFoundPage';

// Protected route wrapper
const Protected = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

// App with providers
const AppRoutes = () => {
  const { isLoggedIn } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={
        isLoggedIn ? <Navigate to="/inbox" replace /> : <LoginPage />
      } />
      <Route path="/inbox" element={<Protected><InboxPage /></Protected>} />
      <Route path="/chit/:chitId" element={<Protected><ChitDetailPage /></Protected>} />
      <Route path="/send" element={<Protected><SendChitPage /></Protected>} />
      <Route path="/connections" element={<Protected><ConnectionsPage /></Protected>} />
      <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
      <Route path="/mis" element={<Protected><MISPage /></Protected>} />
      <Route path="/" element={<Navigate to="/inbox" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppModeProvider>
          <AppRoutes />
        </AppModeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
