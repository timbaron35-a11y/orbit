import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface Automation { id: string; trigger: string; action: string; active: boolean; runs: number; icon: string; iconColor: string; }

const DEFAULT_AUTOMATIONS: Automation[] = [
  { id: '1', trigger: 'Pas de contact depuis 5 jours', action: 'Afficher alerte de relance dans le Dashboard', active: true, runs: 12, icon: '⏰', iconColor: '#f59e0b' },
  { id: '2', trigger: 'Statut passe à "Signé"', action: 'Marquer comme client actif + notifier', active: true, runs: 3, icon: '✅', iconColor: '#22c55e' },
  { id: '3', trigger: 'Nouveau prospect ajouté', action: 'Envoyer email de bienvenue automatique', active: false, runs: 0, icon: '✉️', iconColor: '#3b82f6' },
  { id: '4', trigger: 'Devis envoyé depuis +7 jours sans réponse', action: 'Relance automatique par email', active: false, runs: 0, icon: '📄', iconColor: '#a78bfa' },
  { id: '5', trigger: 'Statut passe à "Perdu"', action: 'Archiver le prospect + note de clôture', active: false, runs: 1, icon: '📦', iconColor: '#ef4444' },
];

export default function Automations() {
  const { plan } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const isSetup = plan === 'setup';
  const [automations, setAutomations] = useState(DEFAULT_AUTOMATIONS);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestText, setRequestText] = useState('');
  const [sending, setSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const toggleAutomation = (id: string) => {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  const activeCount = automations.filter(a => a.active).length;
  const totalRuns = automations.reduce((sum, a) => sum + a.runs, 0);

  return (
    <div style={{ padding: '36px 40px', maxWidth: 780 }}>

      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>Automations</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 6 }}>
            {isSetup ? `${activeCount} automation${activeCount !== 1 ? 's' : ''} active${activeCount !== 1 ? 's' : ''}` : 'Automatisez vos actions commerciales récurrentes'}
          </p>
        </div>
      </div>

      {/* Custom automations banner — only locked for non-setup */}
      {!isSetup && (
        <div style={{
          background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.18)',
          borderLeft: '3px solid #fbbf24',
          borderRadius: 12, padding: '18px 20px', marginBottom: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Automations personnalisées</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Créez vos propres automations sur-mesure avec le Plan Premium — configuration complète incluse.
            </div>
          </div>
          <a
            href="mailto:tim.baron.35@gmail.com?subject=Pack Setup Orbit - Automations"
            style={{ flexShrink: 0, padding: '10px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Contacter →
          </a>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Actives', value: activeCount, color: '#22c55e', accent: 'rgba(34,197,94,0.7)' },
          { label: 'Déclenchements', value: totalRuns, color: 'var(--accent)', accent: 'rgba(124,92,252,0.7)' },
          { label: 'Disponibles', value: automations.length, color: 'var(--text-dim)', accent: 'rgba(115,115,115,0.5)' },
        ].map(({ label, value, color, accent }) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent, borderRadius: '14px 14px 0 0', opacity: 0.6 }} />
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color, letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {automations.map(a => (
          <div
            key={a.id}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 16,
              transition: 'opacity 0.2s, border-color 0.2s, box-shadow 0.2s',
              opacity: !a.active ? 0.55 : 1,
              boxShadow: a.active ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
              borderColor: a.active ? 'var(--border)' : 'var(--border-subtle)',
            }}
          >
            {/* Icon */}
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: `${a.iconColor}18`,
              border: `1px solid ${a.iconColor}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 19,
              boxShadow: a.active ? `0 0 12px ${a.iconColor}30` : 'none',
            }}>
              {a.icon}
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                {a.trigger}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ opacity: 0.5 }}>→</span>
                {a.action}
              </div>
            </div>

            {/* Run count */}
            {a.runs > 0 && (
              <div style={{
                padding: '4px 10px', borderRadius: 20,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {a.runs}× déclenché{a.runs > 1 ? 's' : ''}
              </div>
            )}

            {/* Toggle */}
            <div
              onClick={() => toggleAutomation(a.id)}
              style={{
                width: 44, height: 24, borderRadius: 12,
                background: a.active ? 'var(--accent)' : 'var(--surface-2)',
                border: '1px solid',
                borderColor: a.active ? 'var(--accent)' : 'var(--border)',
                cursor: 'pointer',
                position: 'relative', transition: 'background 0.2s, border-color 0.2s',
                flexShrink: 0,
                boxShadow: a.active ? '0 0 8px rgba(124,92,252,0.3)' : 'none',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: a.active ? 22 : 2,
                width: 18, height: 18, borderRadius: '50%',
                background: 'white', transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Add CTA */}
      <div
        onClick={() => isSetup ? setShowRequestForm(true) : setShowUpgrade(true)}
        style={{
          marginTop: 10, border: `1.5px dashed ${isSetup ? 'var(--border)' : 'rgba(251,191,36,0.25)'}`,
          borderRadius: 14, padding: '18px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: 'pointer', color: isSetup ? 'var(--text-muted)' : '#fbbf24',
          fontSize: 13.5, opacity: isSetup ? 1 : 0.6, transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = isSetup ? 'var(--accent)' : 'rgba(251,191,36,0.5)'; e.currentTarget.style.color = isSetup ? 'var(--accent)' : '#fbbf24'; e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = isSetup ? 'var(--border)' : 'rgba(251,191,36,0.25)'; e.currentTarget.style.color = isSetup ? 'var(--text-muted)' : '#fbbf24'; e.currentTarget.style.opacity = isSetup ? '1' : '0.6'; }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>{isSetup ? '+' : '🔒'}</span>
        {isSetup ? 'Demander une automation personnalisée' : 'Créer une automation — Plan Premium requis'}
      </div>

      {/* Request form modal */}
      {showRequestForm && (
        <>
          <div onClick={() => setShowRequestForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 301, width: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '32px', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
            {requestSent ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Demande envoyée !</h2>
                <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
                  Votre automation sera créée dans les <strong style={{ color: 'var(--text)' }}>3 jours ouvrés</strong>.
                </p>
                <button onClick={() => { setShowRequestForm(false); setRequestSent(false); setRequestText(''); }} style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(124,92,252,0.35)' }}>
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.3px' }}>Demander une automation</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
                  Décrivez ce que vous voulez automatiser. Nous la configurons en <strong style={{ color: 'var(--text)' }}>3 jours ouvrés</strong>.
                </p>
                <textarea
                  value={requestText}
                  onChange={e => setRequestText(e.target.value)}
                  placeholder={"Ex : Quand un prospect passe en 'Signé', m'envoyer un email récap avec son nom et le montant."}
                  style={{ width: '100%', minHeight: 120, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13.5, padding: '12px 14px', fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button onClick={() => setShowRequestForm(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13.5, fontWeight: 500, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    Annuler
                  </button>
                  <button
                    disabled={!requestText.trim() || sending}
                    onClick={async () => {
                      setSending(true);
                      try {
                        await fetch('/api/request-automation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userEmail: user?.email, description: requestText }) });
                        setRequestSent(true);
                      } catch { showToast('Erreur lors de l\'envoi', 'error'); }
                      finally { setSending(false); }
                    }}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, background: requestText.trim() ? 'var(--accent)' : 'var(--surface-2)', color: requestText.trim() ? 'white' : 'var(--text-muted)', border: 'none', cursor: requestText.trim() ? 'pointer' : 'default', opacity: sending ? 0.7 : 1, boxShadow: requestText.trim() ? '0 4px 12px rgba(124,92,252,0.35)' : 'none' }}
                  >
                    {sending ? '…' : 'Envoyer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Upgrade modal */}
      {showUpgrade && (
        <>
          <div onClick={() => setShowUpgrade(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 301, width: 420, background: 'var(--surface)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 20, padding: '36px 32px', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 18 }}>⚡</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.3px' }}>Plan Premium requis</h2>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 24 }}>
              Les automations sont incluses dans le Plan Premium à <strong style={{ color: 'var(--text)' }}>149€ one-shot</strong>. Configuration complète + 1h de coaching inclus.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href="mailto:tim.baron.35@gmail.com?subject=Pack Setup Orbit - Automations" style={{ display: 'block', textAlign: 'center', padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700, background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', textDecoration: 'none' }}>
                Contacter pour le Pack Setup →
              </a>
              <button onClick={() => setShowUpgrade(false)} style={{ padding: '10px', borderRadius: 10, fontSize: 13.5, fontWeight: 500, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                Fermer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
