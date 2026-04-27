import { useEffect, useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';
import { collection, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
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

const daysAgo = (n: number) => Timestamp.fromDate(new Date(Date.now() - n * 86400000));
const daysFromNow = (n: number) => Timestamp.fromDate(new Date(Date.now() + n * 86400000));

const DEMO_PROSPECTS = [
  { name: 'Agence Lumière', status: 'signé', amount: 4800, notes: 'Refonte complète site + SEO', lastContact: daysAgo(2), assignedTo: null, reminderDate: null },
  { name: 'Studio Craft', status: 'devis', amount: 2200, notes: 'Logo + charte graphique', lastContact: daysAgo(5), assignedTo: null, reminderDate: daysFromNow(2) },
  { name: 'TechFlow SAS', status: 'contacté', amount: 6500, notes: 'Appli mobile MVP', lastContact: daysAgo(3), assignedTo: null, reminderDate: daysFromNow(1) },
  { name: 'Maison Durval', status: 'nouveau', amount: 1200, notes: 'Shooting photo produits', lastContact: daysAgo(1), assignedTo: null, reminderDate: null },
  { name: 'Optika Group', status: 'devis', amount: 3400, notes: 'Dashboard analytics', lastContact: daysAgo(8), assignedTo: null, reminderDate: daysFromNow(3) },
  { name: 'Cabinet Renard', status: 'contacté', amount: 900, notes: 'Plaquette commerciale PDF', lastContact: daysAgo(12), assignedTo: null, reminderDate: null },
  { name: 'Bloom Agency', status: 'signé', amount: 7200, notes: 'Campagne social media 6 mois', lastContact: daysAgo(4), assignedTo: null, reminderDate: null },
  { name: 'Nord Immo', status: 'perdu', amount: 2800, notes: 'Budget revu à la baisse', lastContact: daysAgo(20), assignedTo: null, reminderDate: null },
  { name: 'Vega Solutions', status: 'nouveau', amount: 5100, notes: 'Automatisation processus RH', lastContact: daysAgo(0), assignedTo: null, reminderDate: daysFromNow(5) },
  { name: 'Café Nomade', status: 'contacté', amount: 750, notes: 'Menu digital + QR code', lastContact: daysAgo(6), assignedTo: null, reminderDate: null },
];

const DEMO_SETTINGS = {
  appName: 'Orbit Demo',
  tagline: 'CRM pour freelances',
  accentColor: '#7c5cfc',
  plan: 'setup',
};

async function seedDemoData(uid: string) {
  const metaRef = doc(db, 'users', uid, 'meta', 'settings');
  const existing = await getDoc(metaRef);
  if (existing.exists()) return; // already seeded

  await setDoc(metaRef, DEMO_SETTINGS);

  const prospectsCol = collection(db, 'users', uid, 'prospects');
  await Promise.all(
    DEMO_PROSPECTS.map(p => {
      const ref = doc(prospectsCol);
      return setDoc(ref, { ...p, createdAt: daysAgo(Math.floor(Math.random() * 30) + 1) });
    })
  );
}

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
      seedDemoData(user.uid).finally(() => setAuthed(true));
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
            Mode démo — données d'exemple, session isolée
          </div>

          <div style={{ display: 'flex', minHeight: '100vh', paddingTop: 32 }}>
            <Sidebar basePath="/demo" />
            <main className="demo-main" style={{ flex: 1, marginLeft: 220, minHeight: '100vh', background: 'var(--bg)' }}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/clients/:id" element={<ProspectDetail />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/team" element={<Team />} />
                <Route path="*" element={<Dashboard />} />
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
