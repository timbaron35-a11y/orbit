import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { ToastProvider } from './contexts/ToastContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Pipeline from './pages/Pipeline';
import Clients from './pages/Clients';
import Automations from './pages/Automations';
import Settings from './pages/Settings';
import Onboarding from './pages/Onboarding';
import Agenda from './pages/Agenda';
import ProspectDetail from './pages/ProspectDetail';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Demo from './pages/Demo';
import GlobalSearch from './components/GlobalSearch';

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const { loaded, isNewUser } = useTheme();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 13 }}>
        Chargement…
      </div>
    );
  }

  if (!user) return <Landing />;

  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 13 }}>
        Chargement…
      </div>
    );
  }

  if (isNewUser) return <Onboarding />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 220, minHeight: '100vh', background: 'var(--bg)' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ProspectDetail />} />
          <Route path="/automations" element={<Automations />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      <GlobalSearch />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <WorkspaceProvider>
          <ToastProvider>
          <Routes>
            <Route path="/login" element={<AuthRedirect />} />
            <Route path="/demo/*" element={<Demo />} />
            <Route path="/*" element={<ProtectedLayout />} />
          </Routes>
          </ToastProvider>
          </WorkspaceProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function AuthRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

