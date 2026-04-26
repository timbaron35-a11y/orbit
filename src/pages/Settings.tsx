import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeSettings } from '../contexts/ThemeContext';
import { applyTheme } from '../contexts/ThemeContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import UpgradeModal from '../components/UpgradeModal';

const PRESET_COLORS = [
  { hex: '#7c5cfc', name: 'Violet' },
  { hex: '#3b82f6', name: 'Bleu' },
  { hex: '#10b981', name: 'Vert' },
  { hex: '#f59e0b', name: 'Ambre' },
  { hex: '#ef4444', name: 'Rouge' },
  { hex: '#ec4899', name: 'Rose' },
  { hex: '#06b6d4', name: 'Cyan' },
  { hex: '#8b5cf6', name: 'Indigo' },
];

export default function Settings() {
  const { settings, saveSettings, plan } = useTheme();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [appName, setAppName] = useState(settings.appName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [accentColor, setAccentColor] = useState(settings.accentColor);
  const [saving, setSaving] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const { myCollaborators, inviteCollaborator, updateCollaboratorRole, removeCollaborator } = useWorkspace();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<string | null>(null);

  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      const paidPlan = searchParams.get('plan');
      showToast(paidPlan === 'agence' ? 'Plan Agence activé — bienvenue !' : 'Paiement confirmé !');
      setSearchParams({}, { replace: true });
    } else if (payment === 'cancelled') {
      showToast('Paiement annulé', 'info');
      setSearchParams({}, { replace: true });
    }
  }, []);

  const handleCheckout = async (targetPlan: 'solo' | 'agence') => {
    if (!user) return;
    setCheckingOut(true);
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email, plan: targetPlan }),
      });
      const text = await res.text();
      let data: { url?: string; error?: string };
      try { data = JSON.parse(text); } catch { data = { error: `Réponse invalide (${res.status}): ${text.slice(0, 100)}` }; }
      if (data.error) { showToast(data.error, 'error'); return; }
      window.location.href = data.url!;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur réseau', 'error');
    } finally {
      setCheckingOut(false);
    }
  };

  const handlePortal = async () => {
    if (!user) return;
    setOpeningPortal(true);
    try {
      const res = await fetch('/api/create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid }),
      });
      const { url, error } = await res.json();
      if (error) { showToast(error, 'error'); return; }
      window.location.href = url;
    } catch {
      showToast('Erreur', 'error');
    } finally {
      setOpeningPortal(false);
    }
  };

  const maxCollaborators = plan === 'agence' ? 4 : 1;

  useEffect(() => {
    setAppName(settings.appName);
    setTagline(settings.tagline);
    setAccentColor(settings.accentColor);
  }, [settings]);

  const handleColorChange = (hex: string) => {
    setAccentColor(hex);
    applyTheme(hex);
  };

  const isDirty =
    appName !== settings.appName ||
    tagline !== settings.tagline ||
    accentColor !== settings.accentColor;

  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    const s: ThemeSettings = {
      appName: appName.trim() || settings.appName,
      tagline: tagline.trim() || settings.tagline,
      accentColor,
      plan: settings.plan ?? 'solo',
    };
    await saveSettings(s);
    setSaving(false);
    showToast('Paramètres enregistrés');
  };

  const handleReset = () => {
    setAppName(settings.appName);
    setTagline(settings.tagline);
    setAccentColor(settings.accentColor);
    applyTheme(settings.accentColor);
  };

  return (
    <div style={{ padding: '32px 36px', maxWidth: 640 }}>
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.3px' }}>Paramètres</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 4 }}>
            Personnalisez l'apparence de votre CRM.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <span style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 700,
            background: plan === 'setup' ? 'rgba(251,191,36,0.12)' : plan === 'agence' ? 'rgba(124,92,252,0.15)' : 'var(--surface-2)',
            color: plan === 'setup' ? '#fbbf24' : plan === 'agence' ? 'var(--accent)' : 'var(--text-muted)',
            border: `1px solid ${plan === 'setup' ? 'rgba(251,191,36,0.28)' : plan === 'agence' ? 'rgba(124,92,252,0.3)' : 'var(--border)'}`,
          }}>
            {plan === 'setup' ? '⚡ Plan Premium' : plan === 'agence' ? '✦ Plan Agence' : 'Plan Solo'}
          </span>
          {plan === 'solo' && (
            <button
              onClick={() => handleCheckout('agence')}
              disabled={checkingOut}
              style={{
                fontSize: 13, fontWeight: 600, color: 'white',
                background: 'var(--accent)',
                border: 'none', cursor: 'pointer',
                padding: '8px 16px', borderRadius: 8,
                opacity: checkingOut ? 0.6 : 1,
                boxShadow: '0 2px 8px rgba(124,92,252,0.35)',
                transition: 'opacity 0.15s',
              }}
            >
              {checkingOut ? '…' : '✦ Passer au Plan Agence'}
            </button>
          )}
          {(plan === 'agence' || plan === 'setup') && (
            <button
              onClick={handlePortal}
              disabled={openingPortal}
              style={{
                fontSize: 12.5, fontWeight: 500, color: 'var(--text-muted)',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 7, padding: '5px 12px', cursor: 'pointer',
                opacity: openingPortal ? 0.6 : 1,
              }}
            >
              {openingPortal ? '…' : 'Gérer l\'abonnement'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* Branding section */}
        <Section title="Identité">
          <Field label="Nom de l'outil">
            <input
              className="orbit-input"
              value={appName}
              onChange={e => setAppName(e.target.value)}
              placeholder="Orbit"
            />
          </Field>
          <Field label="Tagline">
            <input
              className="orbit-input"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              placeholder="CRM pour freelances"
            />
          </Field>
        </Section>

        {/* Color section */}
        <Section title="Couleur principale">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginBottom: 16 }}>
            {PRESET_COLORS.map(c => (
              <button
                key={c.hex}
                onClick={() => handleColorChange(c.hex)}
                title={c.name}
                style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: c.hex, border: '3px solid',
                  borderColor: accentColor === c.hex ? 'white' : 'transparent',
                  outline: accentColor === c.hex ? `2px solid ${c.hex}` : 'none',
                  outlineOffset: 2,
                  cursor: 'pointer', transition: 'transform 0.1s',
                  transform: accentColor === c.hex ? 'scale(1.12)' : 'scale(1)',
                }}
              />
            ))}
          </div>

          <Field label="Couleur personnalisée">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="color"
                value={accentColor}
                onChange={e => handleColorChange(e.target.value)}
                style={{
                  width: 44, height: 38, borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--surface-2)', cursor: 'pointer', padding: 2,
                }}
              />
              <input
                className="orbit-input"
                value={accentColor}
                onChange={e => {
                  if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) handleColorChange(e.target.value);
                }}
                style={{ fontFamily: 'monospace', width: 110 }}
              />
              <div style={{
                flex: 1, height: 38, borderRadius: 8,
                background: accentColor, opacity: 0.85,
              }} />
            </div>
          </Field>
        </Section>

        {/* Preview */}
        <Section title="Aperçu">
          <div style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: accentColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="3"/>
                    <circle cx="12" cy="12" r="7" opacity=".5"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
                    {appName.trim() || 'Orbit'}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>
                    {tagline.trim() || 'CRM pour freelances'}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding: '6px 8px', background: 'var(--surface)' }}>
              {['Dashboard', 'Pipeline', 'Clients'].map((label, i) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 7,
                  background: i === 0 ? accentColor : 'transparent',
                  color: i === 0 ? 'white' : 'var(--text-dim)',
                  fontSize: 13, marginBottom: 2,
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', opacity: 0.7 }} />
                  {label}
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface)' }}>
              <button style={{
                padding: '8px 16px', borderRadius: 7,
                background: accentColor, color: 'white',
                border: 'none', fontSize: 13, fontWeight: 500,
              }}>
                + Nouveau prospect
              </button>
            </div>
          </div>
        </Section>

        {/* Sharing section */}
        <Section title="Partage & Collaboration">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -6, lineHeight: 1.6 }}>
            Invitez des collaborateurs par email.{' '}
            {plan === 'solo' ? '1 collaborateur inclus dans le Plan Solo.' : 'Jusqu\'à 4 collaborateurs avec le Plan Agence.'}
          </p>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="orbit-input"
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="email@exemple.com"
              style={{ flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
            <button
              onClick={async () => {
                if (!inviteEmail.trim()) return;
                const active = myCollaborators.filter(i => i.status !== 'declined');
                if (active.length >= maxCollaborators) {
                  setUpgradeModal('Inviter plus de collaborateurs');
                  return;
                }
                setInviting(true);
                const result = await inviteCollaborator(inviteEmail.trim(), settings.appName);
                setInviting(false);
                setInviteEmail('');
                if (result === 'already_invited') {
                  showToast('Cette personne est déjà invitée', 'info');
                } else if (result === 'limit_reached') {
                  showToast('Limite atteinte', 'error');
                } else {
                  showToast('Invitation envoyée');
                }
              }}
              disabled={!inviteEmail.trim() || inviting}
              style={{
                padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 500,
                background: inviteEmail.trim() ? 'var(--accent)' : 'var(--surface-2)',
                color: inviteEmail.trim() ? 'white' : 'var(--text-muted)',
                border: 'none', cursor: inviteEmail.trim() ? 'pointer' : 'default',
                opacity: inviting ? 0.7 : 1, whiteSpace: 'nowrap',
              }}
            >
              {inviting ? '…' : 'Inviter'}
            </button>
          </div>

          {(() => {
            const active = myCollaborators.filter(i => i.status !== 'declined');
            return (
              <>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {active.length}/4 collaborateurs · {4 - active.length} place{4 - active.length !== 1 ? 's' : ''} disponible{4 - active.length !== 1 ? 's' : ''}
                </div>
                {active.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Collaborateurs
                    </div>
                    {active.map(inv => (
                      <div key={inv.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', borderRadius: 9,
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: inv.status === 'accepted' ? 'rgba(34,197,94,0.12)' : 'var(--surface)',
                          border: `1px solid ${inv.status === 'accepted' ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 600,
                          color: inv.status === 'accepted' ? '#22c55e' : 'var(--text-muted)',
                          flexShrink: 0,
                        }}>
                          {inv.collaboratorEmail.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {inv.collaboratorEmail}
                          </div>
                          <div style={{ fontSize: 11.5, color: inv.status === 'accepted' ? '#22c55e' : '#f59e0b', marginTop: 2 }}>
                            {inv.status === 'accepted' ? '✓ Accès actif' : '⏳ En attente'}
                          </div>
                        </div>
                        {/* Role toggle — Agence only */}
                        {plan === 'agence' ? (
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            {(['editor', 'viewer'] as const).map(r => (
                              <button
                                key={r}
                                onClick={() => updateCollaboratorRole(inv, r)}
                                style={{
                                  padding: '4px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 500,
                                  background: (inv.role ?? 'editor') === r ? 'var(--accent-dim)' : 'transparent',
                                  color: (inv.role ?? 'editor') === r ? 'var(--accent)' : 'var(--text-muted)',
                                  border: `1px solid ${(inv.role ?? 'editor') === r ? 'rgba(124,92,252,0.3)' : 'var(--border)'}`,
                                  cursor: 'pointer',
                                }}
                              >
                                {r === 'editor' ? 'Éditeur' : 'Lecture'}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button
                            onClick={() => setUpgradeModal('Gestion des rôles')}
                            style={{ padding: '4px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 500, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
                          >
                            🔒 Rôles
                          </button>
                        )}
                        <button
                          onClick={() => removeCollaborator(inv)}
                          style={{
                            background: 'none', border: 'none', color: 'var(--text-muted)',
                            fontSize: 18, cursor: 'pointer', padding: '2px 6px', borderRadius: 5,
                            lineHeight: 1,
                          }}
                          title="Révoquer l'accès"
                          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </Section>
      </div>

      {upgradeModal && <UpgradeModal feature={upgradeModal} onClose={() => setUpgradeModal(null)} />}

      {/* Agent Setup settings */}
      {plan === 'setup' && (
        <div style={{ marginTop: 32 }}>
          <Section title="Assistant IA">
            {[
              {
                key: 'agentVocalOnly' as const,
                label: 'Réponses vocales uniquement',
                desc: "L'agent répond à voix haute sans afficher de texte",
                toastOn: 'Mode vocal activé',
                toastOff: 'Mode texte + vocal activé',
              },
              {
                key: 'agentWakeWord' as const,
                label: 'Activation par "Dis Orbit"',
                desc: 'Dis "Orbit" pour activer l\'assistant sans toucher l\'écran (Chrome uniquement)',
                toastOn: 'Wake word activé',
                toastOff: 'Wake word désactivé',
              },
              {
                key: 'morningRecap' as const,
                label: 'Récap vocal à l\'ouverture',
                desc: 'L\'assistant te lit un résumé de tes rappels et prospects chauds du jour',
                toastOn: 'Récap vocal activé',
                toastOff: 'Récap vocal désactivé',
              },
            ].map(({ key, label, desc, toastOn, toastOff }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
                </div>
                <button
                  onClick={async () => {
                    const next = { ...settings, [key]: !settings[key] };
                    await saveSettings(next);
                    showToast(next[key] ? toastOn : toastOff);
                  }}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: settings[key] ? 'var(--accent)' : 'var(--border)',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0, marginLeft: 16,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: settings[key] ? 22 : 2,
                    width: 20, height: 20, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>
            ))}
          </Section>
        </div>
      )}

      {/* Action bar */}
      <div style={{
        display: 'flex', gap: 8, justifyContent: 'flex-end',
        marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)',
        alignItems: 'center',
      }}>
        {isDirty && (
          <button onClick={handleReset} style={ghostBtn}>
            Annuler
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          style={{
            padding: '9px 22px', borderRadius: 9, fontSize: 13.5, fontWeight: 600,
            background: isDirty ? 'var(--accent)' : 'var(--surface-2)',
            color: isDirty ? 'white' : 'var(--text-muted)',
            border: 'none', cursor: isDirty ? 'pointer' : 'default',
            opacity: saving ? 0.7 : 1,
            transition: 'background 0.15s, opacity 0.15s',
          }}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <label style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 9, fontSize: 13.5, fontWeight: 500,
  background: 'transparent', color: 'var(--text-dim)',
  border: '1px solid var(--border)', cursor: 'pointer',
};
