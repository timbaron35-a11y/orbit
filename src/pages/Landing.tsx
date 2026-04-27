import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

export default function Landing() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [legalOpen, setLegalOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    const dots: { x: number; y: number; vx: number; vy: number; r: number; o: number }[] = [];
    for (let i = 0; i < 60; i++) {
      dots.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, r: Math.random() * 1.2 + 0.4, o: Math.random() * 0.35 + 0.08 });
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const d of dots) {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > canvas.width) d.vx *= -1;
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(124,92,252,${d.o})`; ctx.fill();
      }
      for (let i = 0; i < dots.length; i++) for (let j = i + 1; j < dots.length; j++) {
        const dx = dots[i].x - dots[j].x; const dy = dots[i].y - dots[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 130) { ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y); ctx.strokeStyle = `rgba(124,92,252,${0.1 * (1 - dist / 130)})`; ctx.lineWidth = 0.7; ctx.stroke(); }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <div style={{ background: '#080808', minHeight: '100vh', color: '#e5e5e5', fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif', overflowX: 'hidden' }}>

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 60px', position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(8,8,8,0.9)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(124,92,252,0.4)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity=".5"/><circle cx="12" cy="12" r="11" opacity=".2"/>
            </svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.4px', color: 'white' }}>Orbit</span>
        </div>
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {['Fonctionnalités', 'Tarif'].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'white')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
            >{l}</a>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => navigate('/login')} style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13.5, fontWeight: 500, background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
            Connexion
          </button>
          <button onClick={() => navigate('/login?register=1')} style={{ padding: '8px 22px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, background: 'linear-gradient(135deg, #7c5cfc, #6d4df0)', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 0 20px rgba(124,92,252,0.35)' }}>
            Essai gratuit →
          </button>
        </div>
      </nav>

      {/* Hero — full screen */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: 800, height: 800, background: 'radial-gradient(circle, rgba(124,92,252,0.1) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, alignItems: 'center', minHeight: '100vh' }}>
          {/* Left */}
          <div style={{ padding: '0 60px 0 80px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 20, marginBottom: 32, background: 'rgba(124,92,252,0.1)', border: '1px solid rgba(124,92,252,0.3)', fontSize: 12.5, fontWeight: 500, color: '#a78bfa' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c5cfc', display: 'inline-block', boxShadow: '0 0 8px #7c5cfc' }} />
              7 jours d'essai gratuit — sans carte bancaire
            </div>

            <h1 style={{ fontSize: 62, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-3px', marginBottom: 28, color: 'white' }}>
              Le CRM qui ne<br />vous ralentit pas.
            </h1>

            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, marginBottom: 16, maxWidth: 480 }}>
              Orbit centralise vos prospects, vos relances et l'historique de chaque client en un seul outil. Conçu pour les indépendants qui veulent travailler, pas configurer un logiciel.
            </p>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, marginBottom: 44, maxWidth: 480 }}>
              Ajoutez un prospect en 30 secondes. Retrouvez le contexte d'un appel en 5. Signez plus vite.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
              <button onClick={() => navigate('/login?register=1')} style={{ padding: '15px 36px', borderRadius: 12, fontSize: 15.5, fontWeight: 700, background: 'linear-gradient(135deg, #7c5cfc, #6d4df0)', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 0 40px rgba(124,92,252,0.4)', letterSpacing: '-0.2px' }}>
                Commencer gratuitement →
              </button>
              <button onClick={() => navigate('/login')} style={{ padding: '15px 28px', borderRadius: 12, fontSize: 15, fontWeight: 500, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                Se connecter
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.2)' }}>7 jours gratuits · puis 19 €/mois · résiliable à tout moment</p>
          </div>

          {/* Right — App mockup */}
          <div style={{ padding: '60px 80px 60px 20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <AppMockup />
          </div>
        </div>
      </section>

      {/* Stats band */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)', padding: '36px 80px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
        {[
          { n: '< 2 min', label: 'pour ajouter et qualifier un prospect' },
          { n: '100%', label: 'de vos données vous appartiennent' },
          { n: '0', label: 'fonctionnalité superflue' },
          { n: '19€', label: 'par mois, tout inclus' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: 'white', letterSpacing: '-1.5px' }}>{s.n}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 4, maxWidth: 160 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Features — full width alternating */}
      <section id="fonctionnalités" style={{ padding: '120px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 80, padding: '0 60px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#7c5cfc', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>Fonctionnalités</div>
          <h2 style={{ fontSize: 44, fontWeight: 800, color: 'white', letterSpacing: '-1.8px', lineHeight: 1.1 }}>
            Tout ce qu'un freelance<br />
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>a réellement besoin.</span>
          </h2>
        </div>

        {[
          {
            icon: '🎯',
            title: 'Un pipeline clair, une vision immédiate',
            body: 'Chaque prospect a son statut — Nouveau, Contacté, Devis envoyé, Signé, Perdu. Visualisez en un coup d\'œil où en est chaque opportunité et quelles actions s\'imposent.',
            details: ['Vue Kanban et liste', 'Filtres par statut, montant, date', 'Montant potentiel par étape', 'Tri et recherche instantanés'],
            side: 'left',
          },
          {
            icon: '🔔',
            title: 'Ne ratez plus jamais une relance',
            body: 'Assignez une date de rappel à n\'importe quel prospect. Orbit vous alerte le jour J directement dans l\'interface et en notification sur votre bureau.',
            details: ['Rappels par date', 'Badge sur l\'onglet navigateur', 'Notifications bureau natives', 'Vue Agenda dédiée'],
            side: 'right',
          },
          {
            icon: '📋',
            title: 'L\'historique complet de chaque relation',
            body: 'Notes, appels, emails, relances — tout est consigné dans le journal d\'activité du prospect. Avant de décrocher le téléphone, vous avez tout le contexte nécessaire.',
            details: ['Journal d\'activité horodaté', 'Types : note, appel, email, relance', 'Durée et objet pour les appels', 'Modification et suppression inline'],
            side: 'left',
          },
          {
            icon: '🎙️',
            title: 'Transcription automatique des appels',
            body: 'Enregistrez vos appels directement depuis la fiche client. L\'intelligence artificielle transcrit la conversation et en génère un résumé structuré, automatiquement sauvegardé.',
            details: ['Enregistrement micro en un clic', 'Transcription par Whisper AI', 'Résumé et points clés générés', 'Aucune prise de note manuelle'],
            side: 'right',
          },
        ].map((f) => (
          <div key={f.title} style={{
            display: 'grid',
            gridTemplateColumns: f.side === 'left' ? '1fr 1fr' : '1fr 1fr',
            gap: 0,
            padding: '72px 80px',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            alignItems: 'center',
          }}>
            <div style={{ order: f.side === 'right' ? 2 : 1, padding: f.side === 'left' ? '0 80px 0 0' : '0 0 0 80px' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(124,92,252,0.12)', border: '1px solid rgba(124,92,252,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 20 }}>{f.icon}</div>
              <h3 style={{ fontSize: 28, fontWeight: 700, color: 'white', letterSpacing: '-0.8px', marginBottom: 16, lineHeight: 1.25 }}>{f.title}</h3>
              <p style={{ fontSize: 15.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, marginBottom: 28 }}>{f.body}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {f.details.map(d => (
                  <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'rgba(255,255,255,0.55)' }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(124,92,252,0.15)', border: '1px solid rgba(124,92,252,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#a78bfa', flexShrink: 0 }}>✓</span>
                    {d}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ order: f.side === 'right' ? 1 : 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FeatureIllustration type={f.icon} />
            </div>
          </div>
        ))}
      </section>

      {/* Pricing — full width */}
      <section id="tarif" style={{ padding: '120px 80px', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7c5cfc', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>Tarifs</div>
            <h2 style={{ fontSize: 46, fontWeight: 800, color: 'white', letterSpacing: '-2px', lineHeight: 1.1, marginBottom: 18 }}>
              Choisissez votre formule
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.38)', lineHeight: 1.7, maxWidth: 540, margin: '0 auto' }}>
              Commencez seul, grandissez en équipe, ou démarrez avec un accompagnement personnalisé.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, alignItems: 'start' }}>
            {/* Solo */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '36px 32px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>Plan Solo</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 6 }}>
                <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-2.5px', color: 'white' }}>19€</span>
                <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.28)' }}>/mois</span>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)', marginBottom: 28 }}>Pour les freelances et indépendants.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 32 }}>
                {[
                  'Prospects illimités',
                  'Pipeline & journal d\'activité',
                  'Agenda & rappels',
                  'Transcription IA des appels',
                  'Personnalisation complète',
                  '1 collaborateur invité',
                  'Mises à jour incluses',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'rgba(255,255,255,0.6)' }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#22c55e', fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {item}
                  </div>
                ))}
              </div>
              <button onClick={() => navigate('/login?register=1')} style={{ width: '100%', padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 600, background: 'rgba(124,92,252,0.15)', color: '#a78bfa', border: '1px solid rgba(124,92,252,0.3)', cursor: 'pointer' }}>
                Essai gratuit 7 jours →
              </button>
              <p style={{ textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.2)', marginTop: 10 }}>Sans carte bancaire · Résiliable à tout moment</p>
            </div>

            {/* Agence — highlighted */}
            <div style={{ background: 'rgba(124,92,252,0.07)', border: '1px solid rgba(124,92,252,0.4)', borderRadius: 20, padding: '36px 32px', position: 'relative', overflow: 'hidden', transform: 'scale(1.025)', boxShadow: '0 0 60px rgba(124,92,252,0.12)' }}>
              <div style={{ position: 'absolute', top: -80, right: -80, width: 220, height: 220, background: 'radial-gradient(circle, rgba(124,92,252,0.14), transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Plan Agence</span>
                <span style={{ padding: '4px 11px', borderRadius: 20, background: 'rgba(124,92,252,0.2)', border: '1px solid rgba(124,92,252,0.35)', fontSize: 11.5, fontWeight: 600, color: '#a78bfa' }}>Populaire</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 6 }}>
                <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-2.5px', color: 'white' }}>49€</span>
                <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.28)' }}>/mois</span>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)', marginBottom: 28 }}>Pour les petites équipes (3–5 utilisateurs).</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 32 }}>
                {[
                  'Tout du plan Solo',
                  'Jusqu\'à 5 utilisateurs',
                  'Espace de travail partagé',
                  'Vue pipeline commune',
                  'Gestion des rôles',
                  'Statistiques équipe',
                  'Support prioritaire',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'rgba(255,255,255,0.7)' }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(124,92,252,0.2)', border: '1px solid rgba(124,92,252,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#a78bfa', fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {item}
                  </div>
                ))}
              </div>
              <button onClick={() => navigate('/login?register=1')} style={{ width: '100%', padding: '13px', borderRadius: 10, fontSize: 14, fontWeight: 700, background: 'linear-gradient(135deg, #7c5cfc, #6d4df0)', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 0 24px rgba(124,92,252,0.35)' }}>
                Essai gratuit 7 jours →
              </button>
              <p style={{ textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.2)', marginTop: 10 }}>Sans carte bancaire · Résiliable à tout moment</p>
            </div>

            {/* Premium */}
            <div style={{ background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 20, padding: '36px 32px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(251,191,36,0.7)', marginBottom: 20 }}>⚡ Plan Premium</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 6 }}>
                <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-2.5px', color: 'white' }}>149€</span>
                <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.28)' }}>one-shot</span>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)', marginBottom: 28 }}>Configuration complète + automations + accompagnement.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 32 }}>
                {[
                  'Tout du Plan Agence',
                  'Automations personnalisées',
                  'Installation & paramétrage',
                  'Import de vos contacts existants',
                  'Personnalisation aux couleurs de votre marque',
                  '1h de coaching en visio',
                  'Support dédié 30 jours',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'rgba(255,255,255,0.6)' }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fbbf24', fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {item}
                  </div>
                ))}
              </div>
              <a href="mailto:tim.baron.35@gmail.com?subject=Plan Premium Orbit" style={{ display: 'block', width: '100%', padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 600, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.28)', cursor: 'pointer', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
                Nous contacter →
              </a>
              <p style={{ textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.2)', marginTop: 10 }}>Paiement unique · Sans abonnement obligatoire</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '100px 80px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7c5cfc', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>FAQ</div>
            <h2 style={{ fontSize: 38, fontWeight: 800, color: 'white', letterSpacing: '-1.5px', lineHeight: 1.1 }}>Questions fréquentes</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              {
                q: "Est-ce que je peux annuler à tout moment ?",
                a: "Oui, sans préavis ni frais. Vous pouvez résilier votre abonnement en un clic depuis les paramètres. Vous conservez l'accès jusqu'à la fin de la période déjà payée.",
              },
              {
                q: "Qu'est-ce qui est inclus dans les 7 jours d'essai ?",
                a: "L'accès complet à toutes les fonctionnalités du Plan Solo — aucune restriction, aucune carte bancaire requise. À la fin de l'essai, vous choisissez de continuer ou non.",
              },
              {
                q: "Mes données sont-elles sécurisées ?",
                a: "Oui. Orbit repose sur l'infrastructure Firebase de Google, avec des données chiffrées en transit et au repos. Vos prospects n'appartiennent qu'à vous — nous n'y accédons pas.",
              },
              {
                q: "Quelle est la différence entre Solo et Agence ?",
                a: "Le Plan Solo est idéal pour les indépendants — 1 utilisateur avec un collaborateur invité. Le Plan Agence permet d'inviter jusqu'à 4 collaborateurs, de gérer les rôles et d'accéder aux statistiques par membre d'équipe.",
              },
              {
                q: "Je peux importer mes contacts existants ?",
                a: "Oui, via le Pack Premium qui inclut un accompagnement à l'import. Vous pouvez aussi créer vos prospects manuellement ou les importer en CSV depuis la page Clients.",
              },
              {
                q: "Orbit fonctionne-t-il sur mobile ?",
                a: "Orbit est une application web optimisée pour desktop. Une version mobile responsive est sur notre feuille de route.",
              },
            ].map((item, i) => (
              <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                    padding: '22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                  }}
                >
                  <span style={{ fontSize: 15.5, fontWeight: 600, color: 'white', letterSpacing: '-0.2px' }}>{item.q}</span>
                  <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)', flexShrink: 0, transition: 'transform 0.2s', transform: faqOpen === i ? 'rotate(45deg)' : 'none' }}>+</span>
                </button>
                {faqOpen === i && (
                  <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, paddingBottom: 22, margin: 0 }}>
                    {item.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA — full bleed */}
      <section style={{ padding: '140px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 700, height: 400, background: 'radial-gradient(ellipse, rgba(124,92,252,0.09), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <h2 style={{ fontSize: 56, fontWeight: 800, color: 'white', letterSpacing: '-2.5px', lineHeight: 1.05, marginBottom: 20 }}>
            Votre prochain client<br />vous attend déjà.
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.35)', marginBottom: 48, maxWidth: 520, margin: '0 auto 48px' }}>
            Rejoignez Orbit et transformez votre suivi commercial en avantage concurrentiel réel.
          </p>
          <button onClick={() => navigate('/login?register=1')} style={{ padding: '17px 48px', borderRadius: 14, fontSize: 16.5, fontWeight: 700, background: 'linear-gradient(135deg, #7c5cfc, #6d4df0)', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 0 60px rgba(124,92,252,0.4)', letterSpacing: '-0.3px' }}>
            Commencer gratuitement →
          </button>
          <p style={{ marginTop: 18, fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>Sans carte bancaire · 7 jours gratuits · Résiliable à tout moment</p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '28px 80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity=".5"/>
            </svg>
          </div>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: 'white' }}>Orbit</span>
        </div>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
          {['Fonctionnalités', 'Tarif', 'Connexion'].map(l => (
            <span key={l} style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', cursor: 'pointer' }}
              onClick={() => l === 'Connexion' ? navigate('/login') : null}
            >{l}</span>
          ))}
          <span
            onClick={() => setLegalOpen(true)}
            style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
          >Mentions légales</span>
          <a href="mailto:tim.baron.35@gmail.com" style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
          >Contact</a>
        </div>
        <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.15)' }}>© 2026 Orbit · Fait pour les freelances</span>
        <button
          onClick={async () => {
            const { signOut } = await import('firebase/auth');
            const { auth } = await import('../firebase');
            try { await signOut(auth); } catch {}
            localStorage.clear();
            try { indexedDB.deleteDatabase('firebaseLocalStorageDb'); } catch {}
            window.location.href = '/login';
          }}
          style={{ fontSize: 11, color: 'rgba(255,255,255,0.08)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.08)')}
        >Réinitialiser la session</button>
      </footer>

      {/* Mentions légales modal */}
      {legalOpen && (
        <>
          <div onClick={() => setLegalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, backdropFilter: 'blur(4px)' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 501, width: 580, maxHeight: '80vh', overflowY: 'auto',
            background: '#111', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 18, padding: '40px 36px',
            boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: 0 }}>Mentions légales</h2>
              <button onClick={() => setLegalOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            {[
              {
                title: 'Éditeur',
                content: 'Orbit est édité par Tim Baron, auto-entrepreneur.\nEmail : tim.baron.35@gmail.com',
              },
              {
                title: 'Hébergement',
                content: 'Application hébergée par Vercel Inc. (440 N Barranca Ave #4133, Covina, CA 91723, USA).\nBase de données hébergée par Google Firebase (Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA).',
              },
              {
                title: 'Données personnelles (RGPD)',
                content: "Les données saisies dans Orbit (prospects, activités, notes) sont stockées dans votre espace Firebase personnel et ne sont accessibles qu'à vous et aux collaborateurs que vous invitez explicitement.\n\nAucune donnée n'est vendue ou partagée avec des tiers. Vous pouvez demander la suppression de votre compte et de toutes vos données en écrivant à tim.baron.35@gmail.com.",
              },
              {
                title: 'Cookies',
                content: "Orbit n'utilise pas de cookies de tracking ou publicitaires. Seul un cookie de session Firebase est utilisé pour maintenir votre connexion.",
              },
              {
                title: 'Propriété intellectuelle',
                content: "Le code source, le design et le nom Orbit sont la propriété exclusive de Tim Baron. Toute reproduction sans autorisation est interdite.",
              },
            ].map(({ title, content }) => (
              <div key={title} style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.4)', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' }}>{content}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AppMockup() {
  const statuses = [
    { name: 'Agence Nova', status: 'devis', amount: '3 200 €', color: '#a78bfa' },
    { name: 'Studio Craft', status: 'contacté', amount: '1 800 €', color: '#f59e0b' },
    { name: 'Médiart', status: 'signé', amount: '4 500 €', color: '#22c55e' },
    { name: 'Freelabs', status: 'nouveau', amount: '2 100 €', color: '#3b82f6' },
  ];
  return (
    <div style={{ width: '100%', maxWidth: 480, background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)' }}>
      {/* Titlebar */}
      <div style={{ padding: '12px 16px', background: '#161616', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ef4444','#f59e0b','#22c55e'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.7 }} />)}
        </div>
        <div style={{ flex: 1, height: 24, background: 'rgba(255,255,255,0.04)', borderRadius: 5, margin: '0 8px' }} />
      </div>
      {/* Sidebar + content */}
      <div style={{ display: 'flex', height: 340 }}>
        <div style={{ width: 52, background: '#0f0f0f', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 10 }}>
          {['#7c5cfc','rgba(255,255,255,0.15)','rgba(255,255,255,0.15)','rgba(255,255,255,0.15)'].map((bg, i) => (
            <div key={i} style={{ width: 30, height: 30, borderRadius: 8, background: bg }} />
          ))}
        </div>
        <div style={{ flex: 1, padding: '16px', overflowY: 'hidden' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Prospects actifs</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {statuses.map(p => (
              <div key={p.name} style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: `${p.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: p.color }}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>{p.name}</div>
                    <div style={{ fontSize: 10.5, color: p.color, marginTop: 2 }}>{p.status}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>{p.amount}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(124,92,252,0.08)', border: '1px solid rgba(124,92,252,0.2)', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13 }}>🔔</span>
            <span style={{ fontSize: 11.5, color: '#a78bfa' }}>2 rappels aujourd'hui</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureIllustration({ type }: { type: string }) {
  const illustrations: Record<string, React.ReactNode> = {
    '🎯': (
      <div style={{ width: '100%', maxWidth: 400, padding: 24 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Pipeline</div>
        {[
          { label: 'Nouveau', count: 3, color: '#3b82f6', w: '45%' },
          { label: 'Contacté', count: 5, color: '#f59e0b', w: '65%' },
          { label: 'Devis', count: 4, color: '#a78bfa', w: '55%' },
          { label: 'Signé', count: 2, color: '#22c55e', w: '30%' },
        ].map(s => (
          <div key={s.label} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>{s.label}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: s.color }}>{s.count}</span>
            </div>
            <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: s.w, background: s.color, borderRadius: 4, opacity: 0.7 }} />
            </div>
          </div>
        ))}
      </div>
    ),
    '🔔': (
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10, padding: 24 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Rappels du jour</div>
        {[
          { name: 'Agence Nova', label: 'Relance devis — En retard', color: '#ef4444' },
          { name: 'Studio Craft', label: "Rappel aujourd'hui", color: '#f59e0b' },
          { name: 'Freelabs', label: 'Appel de découverte', color: '#f59e0b' },
        ].map(r => (
          <div key={r.name} style={{ background: '#1a1a1a', border: `1px solid ${r.color}30`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14 }}>🔔</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>{r.name}</div>
              <div style={{ fontSize: 11.5, color: r.color, marginTop: 2 }}>{r.label}</div>
            </div>
          </div>
        ))}
      </div>
    ),
    '📋': (
      <div style={{ width: '100%', maxWidth: 380, padding: 24 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Journal d'activité</div>
        {[
          { icon: '📞', type: 'Appel', time: 'il y a 2h', note: '15 min · Budget confirmé à 3 200€, envoi devis attendu vendredi', color: '#22c55e' },
          { icon: '✉️', type: 'Email', time: 'Hier', note: 'Objet : Proposition commerciale — Envoi du devis v2', color: '#3b82f6' },
          { icon: '📝', type: 'Note', time: 'il y a 3j', note: 'Décideur = Marie T. · Appel de découverte très positif', color: '#a78bfa' },
        ].map(a => (
          <div key={a.time} style={{ display: 'flex', gap: 12, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 14 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `${a.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{a.icon}</div>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: a.color }}>{a.type}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{a.time}</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{a.note}</div>
            </div>
          </div>
        ))}
      </div>
    ),
    '🎙️': (
      <div style={{ width: '100%', maxWidth: 380, padding: 24 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Transcription IA</div>
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>📞 Appel</span>
            <span style={{ fontSize: 11, background: 'rgba(34,197,94,0.12)', color: '#22c55e', padding: '2px 8px', borderRadius: 20 }}>⏱ 14 min</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 12 }}>
            <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Résumé ·</strong> Budget validé à 3 200€. Le client souhaite un livrable avant le 15. Point bloquant : validation interne par le DAF.
          </div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.3)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
            <strong style={{ color: 'rgba(255,255,255,0.4)' }}>Actions ·</strong> Envoyer devis vendredi · Relancer le 16
          </div>
        </div>
      </div>
    ),
  };
  return (
    <div style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {illustrations[type] ?? null}
    </div>
  );
}
