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
import DemoTour from '../components/DemoTour';

function DemoApp() {
  const { user, loading } = useAuth();
  const [authed, setAuthed] = useState(false);
  const [tourDone, setTourDone] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      signInAnonymously(auth).catch(console.error);
    }
    if (!loading && user) setAuthed(true);
  }, [user, loading]);

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
