import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';

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
import VoiceAgent from './components/VoiceAgent';
import SplashScreen from './components/SplashScreen';
import MorningRecap from './components/MorningRecap';

function LockedBanner() {
  const { locked } = useTheme();
  if (!locked) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: 'linear-gradient(90deg, #ef4444, #dc2626)',
      padding: '10px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: 13.5, color: 'white', fontWeight: 500,
    }}>
      <span>⚠️ Votre essai a expiré — votre espace est en lecture seule.</span>
      <a href="/settings" style={{ color: 'white', fontWeight: 700, textDecoration: 'underline' }}>
        S'abonner →
      </a>
    </div>
  );
}

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const { loaded, isNewUser, locked } = useTheme();
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem('splashShown'));
  const [splashDone, setSplashDone] = useState(() => !!sessionStorage.getItem('splashShown'));

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
      {showSplash && (
        <SplashScreen onDone={() => {
          sessionStorage.setItem('splashShown', '1');
          setShowSplash(false);
          setSplashDone(true);
        }} />
      )}
      <MorningRecap ready={splashDone} />
      <LockedBanner />
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 220, minHeight: '100vh', background: 'var(--bg)', marginTop: locked ? 40 : 0 }}>
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
      <VoiceAgent />
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

