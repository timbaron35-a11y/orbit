import { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

type Plan = 'solo' | 'agence' | 'setup';

interface Feature {
  icon: string;
  label: string;
  desc: string;
  path?: string;
  plans: Plan[];
  badge?: string;
}

const FEATURES: Feature[] = [
  {
    icon: '◎',
    label: 'Dashboard',
    desc: 'Métriques en temps réel : prospects actifs, CA signé, taux de conversion, relances urgentes.',
    path: '/demo',
    plans: ['solo', 'agence', 'setup'],
  },
  {
    icon: '⬡',
    label: 'Pipeline kanban',
    desc: 'Glissez les prospects d\'une colonne à l\'autre. Totaux par statut, alerte de relance intégrée.',
    path: '/demo/pipeline',
    plans: ['solo', 'agence', 'setup'],
  },
  {
    icon: '◷',
    label: 'Agenda & rappels',
    desc: 'Tous vos rappels groupés par urgence. Reporter ou marquer comme fait en un clic.',
    path: '/demo/agenda',
    plans: ['solo', 'agence', 'setup'],
  },
  {
    icon: '⟳',
    label: 'Automations',
    desc: 'Alertes automatiques : relances en retard, prospect signé, devis sans réponse. Activez/désactivez à la volée.',
    path: '/demo/automations',
    plans: ['solo', 'agence', 'setup'],
  },
  {
    icon: '✉',
    label: 'Rapport hebdo IA',
    desc: 'Chaque lundi matin : score pipeline /10, prévision CA, narrative IA personnalisée. → Dans Paramètres, active le rapport et clique "Tester" pour recevoir un exemple.',
    path: '/demo/settings',
    plans: ['solo', 'agence', 'setup'],
    badge: 'IA',
  },
  {
    icon: '↗',
    label: 'Collaboration',
    desc: 'Invitez des membres, assignez des prospects, gérez les rôles éditeur/lecture. → Dans Paramètres, section "Collaborateurs".',
    path: '/demo/settings',
    plans: ['agence', 'setup'],
  },
  {
    icon: '🎙',
    label: 'Transcription d\'appel',
    desc: 'Ouvrez un prospect → bouton "● Copilote" en haut à droite → lancez l\'enregistrement → l\'IA transcrit et résume l\'appel automatiquement.',
    path: '/demo/clients',
    plans: ['setup'],
    badge: 'IA',
  },
  {
    icon: '◉',
    label: 'Copilote d\'appel live',
    desc: 'Ouvrez un prospect → "● Copilote" → choisissez le mode (micro seul ou micro + écran) → l\'IA analyse en direct et suggère des réponses toutes les 10 secondes.',
    path: '/demo/clients',
    plans: ['setup'],
    badge: 'IA',
  },
  {
    icon: '◈',
    label: 'Récap vocal matinal',
    desc: 'À l\'ouverture de l\'app, un assistant vocal lit vos rappels du jour et prospects chauds. → Active dans Paramètres → "Récap vocal matinal", puis recharge.',
    path: '/demo/settings',
    plans: ['setup'],
    badge: 'IA',
  },
  {
    icon: '⬗',
    label: 'Assistant vocal IA',
    desc: 'Icône micro en bas à droite de la sidebar → parlez : "Qui dois-je relancer ?" ou "Quel est mon CA ce mois ?". Réponses instantanées.',
    path: '/demo',
    plans: ['setup'],
    badge: 'IA',
  },
  {
    icon: '⚡',
    label: 'Automations personnalisées',
    desc: 'Soumettez vos scénarios sur-mesure (ex : email auto à J+3 si pas de réponse), on les configure en 3 jours ouvrés. → Dans Automations, section "Personnalisées".',
    path: '/demo/automations',
    plans: ['setup'],
    badge: 'Sur-mesure',
  },
];

const PLAN_CONFIG = {
  solo: {
    label: 'Solo',
    price: 'Gratuit',
    color: '#a1a1aa',
    accent: 'rgba(161,161,170,0.15)',
    border: 'rgba(161,161,170,0.3)',
    desc: 'Tout ce qu\'il faut pour gérer son pipeline seul.',
    cta: 'Essayer Solo',
  },
  agence: {
    label: 'Agence',
    price: '29€/mois',
    color: '#3b82f6',
    accent: 'rgba(59,130,246,0.1)',
    border: 'rgba(59,130,246,0.3)',
    desc: 'Pour les freelances qui travaillent en équipe.',
    cta: 'Essayer Agence',
  },
  setup: {
    label: 'Premium IA',
    price: '149€ one-shot',
    color: '#7c5cfc',
    accent: 'rgba(124,92,252,0.12)',
    border: 'rgba(124,92,252,0.35)',
    desc: 'L\'IA intégrée dans chaque étape de votre process commercial.',
    cta: 'Essayer Premium',
    featured: true,
  },
};

interface Props {
  onEnd: () => void;
}

export default function DemoTour({ onEnd }: Props) {
  const [phase, setPhase] = useState<'plans' | 'guide' | 'feedback' | 'done'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<Plan>('solo');
  const [guideOpen, setGuideOpen] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const visibleFeatures = FEATURES.filter(f => f.plans.includes(selectedPlan));

  const submitFeedback = async () => {
    if (!feedback.trim()) return;
    setSubmitting(true);
    await addDoc(collection(db, 'demo_feedback'), {
      name: name.trim() || 'Anonyme',
      plan: selectedPlan,
      feedback: feedback.trim(),
      createdAt: Timestamp.now(),
    });
    setSubmitting(false);
    setPhase('done');
  };

  // ── Plan selection ──────────────────────────────────────────────────────────
  if (phase === 'plans') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px',
      }}>
        <div style={{ maxWidth: 860, width: '100%' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#7c5cfc', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(124,92,252,0.5)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity=".5"/></svg>
              </div>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'white', letterSpacing: '-0.4px' }}>Orbit</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', letterSpacing: '-0.5px', margin: '0 0 10px' }}>
              Le CRM qui pense pour vous
            </h1>
            <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
              Choisissez un plan pour explorer ses fonctionnalités
            </p>
          </div>

          {/* Plan cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
            {(Object.entries(PLAN_CONFIG) as [Plan, typeof PLAN_CONFIG.solo][]).map(([plan, cfg]) => {
              const featureCount = FEATURES.filter(f => f.plans.includes(plan)).length;
              const isSelected = selectedPlan === plan;
              const isFeatured = !!(('featured' in cfg) && cfg.featured);

              return (
                <div
                  key={plan}
                  onClick={() => setSelectedPlan(plan)}
                  style={{
                    background: isSelected ? cfg.accent : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${isSelected ? cfg.color : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 14, padding: '22px 20px',
                    cursor: 'pointer', transition: 'all 0.15s',
                    position: 'relative', overflow: 'hidden',
                  }}
                >
                  {isFeatured && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${cfg.color}, #a78bfa)` }} />
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: isSelected ? cfg.color : 'white' }}>{cfg.label}</span>
                    {isFeatured && <span style={{ fontSize: 10.5, fontWeight: 700, color: cfg.color, background: `${cfg.color}20`, padding: '2px 8px', borderRadius: 20, border: `1px solid ${cfg.color}40` }}>⭐ Populaire</span>}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: 6 }}>{cfg.price}</div>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 14 }}>{cfg.desc}</div>
                  <div style={{ fontSize: 12, color: isSelected ? cfg.color : 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                    {featureCount} fonctionnalité{featureCount > 1 ? 's' : ''}
                  </div>

                  {isSelected && (
                    <div style={{ position: 'absolute', top: 14, right: 14, width: 18, height: 18, borderRadius: '50%', background: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', fontWeight: 700 }}>✓</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Feature preview for selected plan */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Inclus dans le plan {PLAN_CONFIG[selectedPlan].label}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {visibleFeatures.map(f => (
                <span key={f.label} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 500,
                  background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                  {f.icon} {f.label}
                  {f.badge && <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700 }}>{f.badge}</span>}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button
              onClick={onEnd}
              style={{ padding: '11px 22px', borderRadius: 10, fontSize: 13.5, fontWeight: 500, background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }}
            >
              Explorer librement
            </button>
            <button
              onClick={() => setPhase('guide')}
              style={{
                padding: '11px 28px', borderRadius: 10, fontSize: 13.5, fontWeight: 700,
                background: PLAN_CONFIG[selectedPlan].color, color: 'white', border: 'none',
                cursor: 'pointer', boxShadow: `0 4px 20px ${PLAN_CONFIG[selectedPlan].color}50`,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {PLAN_CONFIG[selectedPlan].cta} →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Feedback ────────────────────────────────────────────────────────────────
  if (phase === 'feedback') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px 36px', maxWidth: 440, width: '100%', boxShadow: '0 30px 80px rgba(0,0,0,0.4)', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>💬</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.3px' }}>Votre avis compte</h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 22, lineHeight: 1.6 }}>
            Qu'avez-vous pensé d'Orbit ? Ce qui vous a plu, ce qui manque, ce qui n'est pas clair.
          </p>
          <input className="orbit-input" value={name} onChange={e => setName(e.target.value)} placeholder="Votre prénom (optionnel)" style={{ marginBottom: 10, fontSize: 13 }} />
          <textarea className="orbit-input" value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Votre retour…" rows={4} style={{ resize: 'none', lineHeight: 1.65, marginBottom: 16, fontSize: 13 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onEnd} style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>Passer</button>
            <button
              onClick={submitFeedback}
              disabled={!feedback.trim() || submitting}
              style={{ flex: 2, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', opacity: !feedback.trim() ? 0.6 : 1 }}
            >
              {submitting ? '…' : 'Envoyer'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px 36px', maxWidth: 380, width: '100%', boxShadow: '0 30px 80px rgba(0,0,0,0.4)', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🙏</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Merci !</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 24 }}>Votre retour a été transmis. Continuez à explorer librement.</p>
          <button onClick={onEnd} style={{ padding: '11px 28px', borderRadius: 9, fontSize: 13.5, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,92,252,0.35)' }}>
            Continuer →
          </button>
        </div>
      </div>
    );
  }

  // ── Guide panel ─────────────────────────────────────────────────────────────
  const planCfg = PLAN_CONFIG[selectedPlan];

  return (
    <>
      {/* Floating guide panel */}
      <div style={{
        position: 'fixed', right: 0, top: 32, bottom: 0,
        width: guideOpen ? 300 : 44,
        background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        zIndex: 500, display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s cubic-bezier(0.16,1,0.3,1)',
        boxShadow: '-8px 0 30px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}>
        {/* Toggle tab */}
        <button
          onClick={() => setGuideOpen(!guideOpen)}
          style={{
            position: 'absolute', left: -1, top: '50%', transform: 'translateY(-50%)',
            width: 20, height: 56, borderRadius: '8px 0 0 8px',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRight: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 10,
          }}
        >
          {guideOpen ? '›' : '‹'}
        </button>

        {guideOpen && (
          <>
            {/* Header */}
            <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>Guide des fonctionnalités</div>
                <button onClick={() => setPhase('feedback')} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  Donner un avis
                </button>
              </div>

              {/* Plan selector */}
              <div style={{ display: 'flex', gap: 5 }}>
                {(Object.entries(PLAN_CONFIG) as [Plan, typeof PLAN_CONFIG.solo][]).map(([plan, cfg]) => (
                  <button
                    key={plan}
                    onClick={() => setSelectedPlan(plan)}
                    style={{
                      flex: 1, padding: '5px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', transition: 'all 0.12s',
                      background: selectedPlan === plan ? cfg.color : 'var(--surface-2)',
                      color: selectedPlan === plan ? 'white' : 'var(--text-muted)',
                      border: `1px solid ${selectedPlan === plan ? cfg.color : 'var(--border)'}`,
                    }}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
              {visibleFeatures.map(f => (
                <div
                  key={f.label}
                  onClick={() => f.path && navigate(f.path)}
                  style={{
                    padding: '12px 18px', cursor: f.path ? 'pointer' : 'default',
                    transition: 'background 0.1s', borderBottom: '1px solid var(--border-subtle)',
                  }}
                  onMouseEnter={e => { if (f.path) e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{f.icon}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{f.label}</span>
                    {f.badge && (
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.15)', padding: '1px 6px', borderRadius: 20, border: '1px solid rgba(167,139,250,0.25)', flexShrink: 0 }}>{f.badge}</span>
                    )}
                    {f.path && <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>→</span>}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, paddingLeft: 22 }}>
                    {f.desc}
                  </p>
                </div>
              ))}

              {/* Locked features hint */}
              {selectedPlan !== 'setup' && (
                <div style={{ margin: '10px 14px', padding: '12px 14px', borderRadius: 10, background: 'rgba(124,92,252,0.06)', border: '1px solid rgba(124,92,252,0.15)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>
                    ✦ {selectedPlan === 'solo' ? '6' : '5'} features Premium IA non incluses
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Copilote d'appel, transcription, assistant vocal, récap matinal…
                  </div>
                  <button
                    onClick={() => setSelectedPlan('setup')}
                    style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                  >
                    Voir le plan Premium →
                  </button>
                </div>
              )}
            </div>

            {/* Footer CTA */}
            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <a
                href="mailto:tim.baron.35@gmail.com?subject=Orbit - Intéressé par le plan"
                style={{
                  display: 'block', textAlign: 'center', padding: '10px', borderRadius: 9,
                  fontSize: 13, fontWeight: 700, color: 'white', textDecoration: 'none',
                  background: planCfg.color,
                  boxShadow: `0 4px 14px ${planCfg.color}40`,
                }}
              >
                Démarrer avec {planCfg.label} →
              </a>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>{planCfg.price}</div>
            </div>
          </>
        )}

        {/* Collapsed state */}
        {!guideOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 60 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              Guide
            </div>
          </div>
        )}
      </div>

      {/* Offset main content when guide is open */}
      <style>{`
        .demo-main { margin-right: ${guideOpen ? '300px' : '44px'} !important; transition: margin-right 0.2s; }
      `}</style>
    </>
  );
}
