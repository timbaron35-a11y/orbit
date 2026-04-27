import { useEffect, useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { WorkspaceProvider } from '../contexts/WorkspaceContext';
import { ToastProvider } from '../contexts/ToastContext';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Dashboard from './Dashboard';
import Pipeline from './Pipeline';
import Clients from './Clients';
import ProspectDetail from './ProspectDetail';
import Agenda from './Agenda';
import Settings from './Settings';
import Team from './Team';
import DemoTour from '../components/DemoTour';

function DemoApp() {
  const { user, loading } = useAuth();
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [tourDone, setTourDone] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      signInAnonymously(auth).catch(() => setAuthError(true));
    } else {
      setAuthed(true);
    }
  }, [user, loading]);

  if (authError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', textAlign: 'center' }}>La démo nécessite l'authentification anonyme Firebase</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 380, lineHeight: 1.6 }}>
          Active <strong style={{ color: 'var(--text)' }}>Authentication → Anonymous</strong> dans la Firebase Console du projet <strong style={{ color: 'var(--text)' }}>orbit-app-e70dd</strong>, puis recharge.
        </div>
        <button onClick={() => window.location.reload()} style={{ padding: '9px 22px', borderRadius: 9, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
          Recharger
        </button>
      </div>
    );
  }

  if (!authed) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 13 }}>
        Chargement de la démo…
      </div>
    );
  }

  return (
    <ThemeProvider>
      <WorkspaceProvider>
        <ToastProvider>
          {/* Demo banner */}
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0,
            background: 'linear-gradient(90deg, #7c5cfc, #a78bfa)',
            padding: '7px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontSize: 12.5, fontWeight: 500, color: 'white',
            zIndex: 200,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', opacity: 0.7, flexShrink: 0 }} />
            Mode démo — vos données sont temporaires et isolées
          </div>

          <div style={{ display: 'flex', minHeight: '100vh', paddingTop: 32 }}>
            <Sidebar />
            <main className="demo-main" style={{ flex: 1, marginLeft: 220, minHeight: '100vh', background: 'var(--bg)' }}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/clients/:id" element={<ProspectDetail />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/team" element={<Team />} />
              </Routes>
            </main>
          </div>

          {!tourDone && <DemoTour onEnd={() => setTourDone(true)} />}
        </ToastProvider>
      </WorkspaceProvider>
    </ThemeProvider>
  );
}

export default function Demo() {
  return (
    <AuthProvider>
      <DemoApp />
    </AuthProvider>
  );
}
