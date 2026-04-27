import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Clear any stale anonymous session so the login form works cleanly
  useEffect(() => {
    if (auth.currentUser?.isAnonymous) {
      signOut(auth).catch(console.error);
    }
  }, []);
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(searchParams.get('register') ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email);
        setResetSent(true);
      } else if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName.trim()) {
          await updateProfile(user, { displayName: displayName.trim() });
        }
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setError(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password' ? 'Email ou mot de passe incorrect.' :
        code === 'auth/email-already-in-use' ? 'Cet email est déjà utilisé.' :
        code === 'auth/weak-password' ? 'Mot de passe trop court (6 caractères min).' :
        code === 'auth/invalid-email' ? 'Adresse email invalide.' :
        'Une erreur est survenue. Réessaie.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '40px 36px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{
            width: 44, height: 44,
            background: 'var(--accent)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
              <circle cx="12" cy="12" r="3"/>
              <circle cx="12" cy="12" r="7" opacity=".5"/>
              <circle cx="12" cy="12" r="11" opacity=".2"/>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>Orbit</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>CRM pour freelances</div>
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 20, letterSpacing: '-0.2px' }}>
          {mode === 'login' ? 'Connexion' : mode === 'register' ? 'Créer un compte' : 'Mot de passe oublié'}
        </h1>

        {mode === 'reset' && resetSent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: 32 }}>📬</div>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Un email de réinitialisation a été envoyé à <strong style={{ color: 'var(--text)' }}>{email}</strong>.<br />
              Vérifie ta boîte mail — et tes spams si tu ne le vois pas.
            </p>
            <button
              onClick={() => { setMode('login'); setResetSent(false); setError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 500, fontSize: 13, padding: 0, cursor: 'pointer' }}
            >
              Retour à la connexion
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {mode === 'register' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={labelStyle}>Nom</label>
                  <input
                    className="orbit-input"
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Ex : Tim Baron"
                    autoFocus
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Email</label>
                <input
                  className="orbit-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ton@email.com"
                  autoFocus={mode === 'login'}
                  required
                />
              </div>

              {mode !== 'reset' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={labelStyle}>Mot de passe</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setMode('reset'); setError(''); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11.5, cursor: 'pointer', padding: 0 }}
                      >
                        Mot de passe oublié ?
                      </button>
                    )}
                  </div>
                  <input
                    className="orbit-input"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              )}

              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 13,
                  color: '#ef4444',
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || (mode !== 'reset' && !password)}
                style={{
                  marginTop: 4,
                  padding: '11px',
                  borderRadius: 9,
                  background: (email && (mode === 'reset' || password)) ? 'var(--accent)' : 'var(--surface-2)',
                  color: (email && (mode === 'reset' || password)) ? 'white' : 'var(--text-muted)',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 500,
                  transition: 'background 0.15s',
                  opacity: loading ? 0.7 : 1,
                  cursor: 'pointer',
                }}
              >
                {loading ? '...' : mode === 'login' ? 'Se connecter' : mode === 'register' ? 'Créer mon compte' : 'Envoyer le lien'}
              </button>
            </form>

            {/* Toggle mode */}
            <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
              {mode === 'reset' ? 'Tu t\'en souviens ? ' : mode === 'login' ? "Pas encore de compte ? " : "Déjà un compte ? "}
              <button
                onClick={() => { setMode(mode === 'register' ? 'login' : mode === 'reset' ? 'login' : 'register'); setError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 500, fontSize: 13, padding: 0, cursor: 'pointer' }}
              >
                {mode === 'login' ? "S'inscrire" : "Se connecter"}
              </button>
            </div>

            {mode === 'login' && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border-subtle)', paddingTop: 16, textAlign: 'center' }}>
                <button
                  onClick={() => navigate('/demo')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12.5, cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  Essayer sans compte →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 500,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
