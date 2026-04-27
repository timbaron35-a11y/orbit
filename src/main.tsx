import { StrictMode, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { signOut } from 'firebase/auth'
import { auth } from './firebase.ts'

// Apply saved color scheme before first render to avoid flash
const saved = localStorage.getItem('orbit_color_scheme') ?? 'dark';
document.documentElement.setAttribute('data-theme', saved);

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(_error: Error, info: ErrorInfo) { console.error('App crash:', _error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    const err = this.state.error as Error;
    return (
      <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, padding: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Erreur</div>
          <div style={{ fontSize: 13.5, color: '#e5e5e5', marginBottom: 8, fontWeight: 600 }}>{err.message}</div>
          <pre style={{ fontSize: 11, color: '#737373', background: '#111', borderRadius: 8, padding: 12, overflow: 'auto', maxHeight: 160, marginBottom: 24 }}>{err.stack}</pre>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '9px 18px', borderRadius: 8, background: '#7c5cfc', color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Recharger
            </button>
            <button
              onClick={async () => {
                try { await signOut(auth); } catch {}
                localStorage.clear();
                indexedDB.deleteDatabase('firebaseLocalStorageDb');
                window.location.href = '/';
              }}
              style={{ padding: '9px 18px', borderRadius: 8, background: 'transparent', color: '#737373', border: '1px solid #2a2a2a', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              Réinitialiser la session
            </button>
          </div>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
