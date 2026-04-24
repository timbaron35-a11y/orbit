import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface Automation {
  id: string;
  trigger: string;
  action: string;
  active: boolean;
  runs: number;
  icon: string;
  iconColor: string;
}

const DEFAULT_AUTOMATIONS: Automation[] = [
  {
    id: '1',
    trigger: 'Pas de contact depuis 5 jours',
    action: 'Afficher alerte de relance dans le Dashboard',
    active: true,
    runs: 12,
    icon: '⏰',
    iconColor: '#f59e0b',
  },
  {
    id: '2',
    trigger: 'Statut passe à "Signé"',
    action: 'Marquer comme client actif + notifier',
    active: true,
    runs: 3,
    icon: '✅',
    iconColor: '#22c55e',
  },
  {
    id: '3',
    trigger: 'Nouveau prospect ajouté',
    action: 'Envoyer email de bienvenue automatique',
    active: false,
    runs: 0,
    icon: '✉️',
    iconColor: '#3b82f6',
  },
  {
    id: '4',
    trigger: 'Devis envoyé depuis +7 jours sans réponse',
    action: 'Relance automatique par email',
    active: false,
    runs: 0,
    icon: '📄',
    iconColor: '#a78bfa',
  },
  {
    id: '5',
    trigger: 'Statut passe à "Perdu"',
    action: 'Archiver le prospect + note de clôture',
    active: false,
    runs: 1,
    icon: '📦',
    iconColor: '#ef4444',
  },
];

function ToggleSwitch({ active, onToggle, locked }: { active: boolean; onToggle: () => void; locked: boolean }) {
  return (
    <div
      onClick={locked ? undefined : onToggle}
      style={{
        width: 40, height: 22,
        borderRadius: 11,
        background: locked ? 'var(--surface-2)' : active ? 'var(--accent)' : 'var(--surface-2)',
        border: '1px solid',
        borderColor: locked ? 'var(--border)' : active ? 'var(--accent)' : 'var(--border)',
        cursor: locked ? 'default' : 'pointer',
        position: 'relative',
        transition: 'background 0.2s, border-color 0.2s',
        flexShrink: 0,
        opacity: locked ? 0.4 : 1,
      }}
    >
      <div style={{
        position: 'absolute',
        top: 2, left: active && !locked ? 20 : 2,
        width: 16, height: 16,
        borderRadius: '50%',
        background: 'white',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}

export default function Automations() {
  const { plan } = useTheme();
  const isSetup = plan === 'setup';
  const [automations, setAutomations] = useState(DEFAULT_AUTOMATIONS);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const toggleAutomation = (id: string) => {
    if (!isSetup) { setShowUpgrade(true); return; }
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  const activeCount = automations.filter(a => a.active).length;

  return (
    <div style={{ padding: '32px 36px', maxWidth: 780 }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.3px' }}>Automations</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 4 }}>
            {isSetup
              ? `${activeCount} automation${activeCount > 1 ? 's' : ''} active${activeCount > 1 ? 's' : ''}`
              : 'Automatisez vos actions commerciales récurrentes'}
          </p>
        </div>
        {!isSetup && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 10,
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
          }}>
            <span style={{ fontSize: 14 }}>🔒</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#fbbf24' }}>Plan Premium requis</span>
          </div>
        )}
      </div>

      {/* Locked banner */}
      {!isSetup && (
        <div style={{
          background: 'rgba(251,191,36,0.05)',
          border: '1px solid rgba(251,191,36,0.18)',
          borderRadius: 12,
          padding: '18px 20px',
          marginBottom: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              Automations personnalisées
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Activez, désactivez et créez vos propres automations avec le Plan Premium — configuration complète incluse.
            </div>
          </div>
          <a
            href="mailto:tim.baron.35@gmail.com?subject=Pack Setup Orbit - Automations"
            style={{
              flexShrink: 0,
              padding: '10px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700,
              background: 'rgba(251,191,36,0.12)', color: '#fbbf24',
              border: '1px solid rgba(251,191,36,0.25)', textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Contacter →
          </a>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Actives', value: isSetup ? activeCount : '—', color: '#22c55e' },
          { label: 'Déclenchements', value: isSetup ? automations.reduce((sum, a) => sum + a.runs, 0) : '—', color: 'var(--accent)' },
          { label: 'Disponibles', value: automations.length, color: 'var(--text-dim)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '16px 18px',
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, marginBottom: 6 }}>
              {label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, color, letterSpacing: '-0.5px' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Automation list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {automations.map(automation => (
          <div
            key={automation.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              opacity: (!isSetup || !automation.active) ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            <div style={{
              width: 40, height: 40,
              borderRadius: 10,
              background: `${automation.iconColor}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}>
              {automation.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)' }}>
                  {automation.trigger}
                </span>
              </div>
              <div>
                <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                  → {automation.action}
                </span>
              </div>
            </div>

            {automation.runs > 0 && isSetup && (
              <div style={{
                padding: '4px 10px',
                borderRadius: 20,
                background: 'var(--surface-2)',
                fontSize: 12,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {automation.runs}× déclenchée{automation.runs > 1 ? 's' : ''}
              </div>
            )}

            <ToggleSwitch
              active={automation.active}
              onToggle={() => toggleAutomation(automation.id)}
              locked={!isSetup}
            />
          </div>
        ))}
      </div>

      {/* Add automation CTA */}
      <div
        onClick={() => !isSetup ? setShowUpgrade(true) : null}
        style={{
          marginTop: 12,
          border: `1px dashed ${isSetup ? 'var(--border)' : 'rgba(251,191,36,0.25)'}`,
          borderRadius: 12,
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          cursor: 'pointer',
          color: isSetup ? 'var(--text-muted)' : '#fbbf24',
          fontSize: 13.5,
          opacity: isSetup ? 1 : 0.6,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = isSetup ? 'var(--accent)' : 'rgba(251,191,36,0.5)';
          e.currentTarget.style.color = isSetup ? 'var(--accent)' : '#fbbf24';
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = isSetup ? 'var(--border)' : 'rgba(251,191,36,0.25)';
          e.currentTarget.style.color = isSetup ? 'var(--text-muted)' : '#fbbf24';
          e.currentTarget.style.opacity = isSetup ? '1' : '0.6';
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>{isSetup ? '+' : '🔒'}</span>
        {isSetup ? 'Créer une automation' : 'Créer une automation — Pack Setup requis'}
      </div>

      {/* Upgrade modal */}
      {showUpgrade && (
        <>
          <div onClick={() => setShowUpgrade(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 301, width: 420,
            background: 'var(--surface)', border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: 18, padding: '36px 32px',
            boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>⚡</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.3px' }}>
              Plan Premium requis
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 24 }}>
              Les automations personnalisées sont incluses dans le Plan Premium à <strong style={{ color: 'var(--text)' }}>149€ one-shot</strong>. Configuration complète + 1h de coaching inclus.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a
                href="mailto:tim.baron.35@gmail.com?subject=Pack Setup Orbit - Automations"
                style={{
                  display: 'block', textAlign: 'center',
                  padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  background: 'rgba(251,191,36,0.12)', color: '#fbbf24',
                  border: '1px solid rgba(251,191,36,0.3)', textDecoration: 'none',
                }}
              >
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
