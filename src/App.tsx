import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useState, useRef } from 'react';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { ToastProvider } from './contexts/ToastContext';
import Sidebar from './components/Sidebar';

const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Pipeline      = lazy(() => import('./pages/Pipeline'));
const Clients       = lazy(() => import('./pages/Clients'));
const Automations   = lazy(() => import('./pages/Automations'));
const Settings      = lazy(() => import('./pages/Settings'));
const Onboarding    = lazy(() => import('./pages/Onboarding'));
const Agenda        = lazy(() => import('./pages/Agenda'));
const ProspectDetail = lazy(() => import('./pages/ProspectDetail'));
const Team          = lazy(() => import('./pages/Team'));
const Login         = lazy(() => import('./pages/Login'));
const Landing       = lazy(() => import('./pages/Landing'));
const Demo          = lazy(() => import('./pages/Demo'));
const GlobalSearch  = lazy(() => import('./components/GlobalSearch'));
const VoiceAgent    = lazy(() => import('./components/VoiceAgent'));
const SplashScreen  = lazy(() => import('./components/SplashScreen'));
const MorningRecap  = lazy(() => import('./components/MorningRecap'));

const PageFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 13 }}>
    Chargement…
  </div>
);

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
  const playRecapRef = useRef<(() => void) | null>(null);

  if (loading) return <PageFallback />;
  if (!user) return <Suspense fallback={<PageFallback />}><Landing /></Suspense>;
  if (!loaded) return <PageFallback />;
  if (isNewUser) return <Suspense fallback={<PageFallback />}><Onboarding /></Suspense>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Suspense fallback={null}>
        {showSplash && (
          <SplashScreen
            onDone={() => {
              sessionStorage.setItem('splashShown', '1');
              setShowSplash(false);
              setSplashDone(true);
            }}
            onPlayAudio={() => { playRecapRef.current?.(); }}
          />
        )}
        <MorningRecap ready={splashDone} onPlayReady={(fn) => { playRecapRef.current = fn; }} />
      </Suspense>
      <LockedBanner />
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 220, minHeight: '100vh', background: 'var(--bg)', marginTop: locked ? 40 : 0 }}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/:id" element={<ProspectDetail />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/team" element={<Team />} />
          </Routes>
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <GlobalSearch />
        <VoiceAgent />
      </Suspense>
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
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/login" element={<AuthRedirect />} />
              <Route path="/demo/*" element={<Demo />} />
              <Route path="/*" element={<ProtectedLayout />} />
            </Routes>
          </Suspense>
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
  return <Suspense fallback={null}><Login /></Suspense>;
}
