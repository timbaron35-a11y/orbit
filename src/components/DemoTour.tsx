import { useState, useEffect } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface Step {
  title: string;
  body: string;
  target?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const STEPS: Step[] = [
  {
    title: 'Bienvenue dans Orbit 👋',
    body: 'Ce tour va vous montrer les principales fonctionnalités en 2 minutes. Vous pouvez naviguer librement et utiliser l\'app normalement — vos données sont isolées.',
    position: 'center',
  },
  {
    title: 'Dashboard',
    body: 'La page d\'accueil résume votre activité : prospects actifs, taux de conversion, CA signé ce mois, et les relances urgentes.',
    target: 'tour-dashboard',
    position: 'right',
  },
  {
    title: 'Ajouter un prospect',
    body: 'Cliquez sur "+ Nouveau prospect" pour créer votre premier contact. Remplissez le nom, le statut, le montant estimé et une date de rappel.',
    target: 'tour-new-prospect',
    position: 'bottom',
  },
  {
    title: 'Pipeline',
    body: 'Visualisez tous vos prospects par statut : Nouveau, Contacté, Devis, Signé, Perdu. Filtrez et triez pour avoir une vue claire de votre pipeline.',
    target: 'tour-pipeline',
    position: 'right',
  },
  {
    title: 'Fiche prospect',
    body: 'Cliquez sur un prospect pour accéder à sa fiche complète : informations, notes, tags, et surtout son journal d\'activité. Chaque appel, email ou note est consigné.',
    target: 'tour-clients',
    position: 'right',
  },
  {
    title: 'Agenda & rappels',
    body: 'Les rappels que vous assignez aux prospects apparaissent ici, groupés par urgence. Marquez-les comme faits ou reportez-les d\'un clic.',
    target: 'tour-agenda',
    position: 'right',
  },
  {
    title: 'Paramètres',
    body: 'Personnalisez le nom de l\'outil et sa couleur principale. Vous pouvez aussi inviter un collaborateur pour travailler à deux sur les mêmes prospects.',
    target: 'tour-settings',
    position: 'right',
  },
  {
    title: 'C\'est tout !',
    body: 'Vous avez vu l\'essentiel. Testez librement, ajoutez de vrais prospects, explorez les fonctionnalités. Votre avis nous est précieux.',
    position: 'center',
  },
];

interface Props {
  onEnd: () => void;
}

export default function DemoTour({ onEnd }: Props) {
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [feedback, setFeedback] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  useEffect(() => {
    if (!current.target) { setTargetRect(null); return; }
    const el = document.getElementById(current.target);
    if (!el) { setTargetRect(null); return; }
    const rect = el.getBoundingClientRect();
    setTargetRect(rect);
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [step]);

  const next = () => {
    if (isLast) { setShowFeedback(true); return; }
    setStep(s => s + 1);
  };

  const prev = () => setStep(s => Math.max(0, s - 1));

  const submitFeedback = async () => {
    if (!feedback.trim()) return;
    setSubmitting(true);
    await addDoc(collection(db, 'demo_feedback'), {
      name: name.trim() || 'Anonyme',
      feedback: feedback.trim(),
      createdAt: Timestamp.now(),
    });
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={overlayStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🙏</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 10, letterSpacing: '-0.3px' }}>
            Merci pour votre retour !
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 24 }}>
            Votre avis a été transmis. Vous pouvez continuer à explorer l'application librement.
          </p>
          <button onClick={onEnd} style={primaryBtn}>Continuer dans l'app →</button>
        </div>
      </div>
    );
  }

  if (showFeedback) {
    return (
      <div style={overlayStyle}>
        <div style={{ ...cardStyle, maxWidth: 460 }}>
          <div style={{ fontSize: 32, marginBottom: 14 }}>💬</div>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.3px' }}>
            Votre avis compte
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            Qu'avez-vous pensé d'Orbit ? Ce qui vous a plu, ce qui manque, ce qui n'est pas clair — tout est utile.
          </p>
          <input
            className="orbit-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Votre prénom (optionnel)"
            style={{ marginBottom: 10, fontSize: 13 }}
          />
          <textarea
            className="orbit-input"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Votre retour sur l'app…"
            rows={5}
            style={{ resize: 'none', lineHeight: 1.65, marginBottom: 16, fontSize: 13 }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onEnd} style={ghostBtn}>Passer</button>
            <button
              onClick={submitFeedback}
              disabled={!feedback.trim() || submitting}
              style={{ ...primaryBtn, opacity: !feedback.trim() || submitting ? 0.6 : 1 }}
            >
              {submitting ? '…' : 'Envoyer mon retour'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Highlight box around target
  const pad = 10;
  const highlightStyle: React.CSSProperties | null = targetRect ? {
    position: 'fixed',
    top: targetRect.top - pad,
    left: targetRect.left - pad,
    width: targetRect.width + pad * 2,
    height: targetRect.height + pad * 2,
    borderRadius: 12,
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
    border: '2px solid var(--accent)',
    zIndex: 999,
    pointerEvents: 'none',
    transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
  } : null;

  // Tooltip position
  let tooltipStyle: React.CSSProperties = { position: 'fixed', zIndex: 1000, width: 320 };
  if (!targetRect || current.position === 'center') {
    tooltipStyle = { ...tooltipStyle, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  } else if (current.position === 'right') {
    tooltipStyle = { ...tooltipStyle, top: targetRect.top, left: targetRect.right + 20 };
  } else if (current.position === 'bottom') {
    tooltipStyle = { ...tooltipStyle, top: targetRect.bottom + 16, left: targetRect.left };
  } else if (current.position === 'left') {
    tooltipStyle = { ...tooltipStyle, top: targetRect.top, right: window.innerWidth - targetRect.left + 20 };
  }

  return (
    <>
      {/* Dim overlay (no highlight) */}
      {!targetRect && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 998, pointerEvents: 'none' }} />
      )}

      {/* Highlight cutout */}
      {highlightStyle && <div style={highlightStyle} />}

      {/* Tooltip card */}
      <div style={{ ...tooltipStyle, animation: 'fadeIn 0.2s ease' }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '22px 22px 18px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}>
          {/* Progress */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: i <= step ? 'var(--accent)' : 'var(--border)',
                transition: 'background 0.2s',
              }} />
            ))}
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.2px' }}>
            {current.title}
          </h3>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 18 }}>
            {current.body}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={onEnd}
              style={{ background: 'none', border: 'none', fontSize: 12.5, color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
            >
              Passer le tour
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              {!isFirst && (
                <button onClick={prev} style={ghostBtn}>←</button>
              )}
              <button onClick={next} style={primaryBtn}>
                {isLast ? 'Laisser un retour →' : 'Suivant →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.6)',
  zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backdropFilter: 'blur(4px)',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: '40px 36px',
  maxWidth: 420, width: '100%',
  textAlign: 'center',
  boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
};

const primaryBtn: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
  background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 8, fontSize: 13.5, fontWeight: 500,
  background: 'transparent', color: 'var(--text-dim)',
  border: '1px solid var(--border)', cursor: 'pointer',
};
