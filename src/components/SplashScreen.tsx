import { useEffect, useState, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

const DURATION = 9000;

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const { settings } = useTheme();
  const { user } = useAuth();
  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || '';
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0); // 0→1→2→3 stagger
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  const dismiss = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    setTimeout(onDone, 700);
  };

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200);
    const t2 = setTimeout(() => setPhase(2), 900);
    const t3 = setTimeout(() => setPhase(3), 1600);

    const start = Date.now();
    const iv = setInterval(() => {
      const p = Math.min((Date.now() - start) / DURATION, 1);
      setProgress(p);
      if (p >= 1) { clearInterval(iv); dismiss(); }
    }, 50);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearInterval(iv); };
  }, []);

  const appName = settings.appName || 'Orbit';
  const tagline = settings.tagline || 'CRM pour freelances';

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#060408',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', overflow: 'hidden',
        opacity: leaving ? 0 : 1,
        transition: leaving ? 'opacity 0.7s ease' : 'none',
      }}
    >
      {/* Ambient light */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(124,92,252,0.07) 0%, transparent 70%)',
        opacity: phase >= 1 ? 1 : 0,
        transition: 'opacity 2s ease',
      }} />

      {/* Top line */}
      <div style={{
        position: 'absolute', top: '30%', left: 0, right: 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent 0%, rgba(124,92,252,0.15) 20%, rgba(196,181,253,0.4) 50%, rgba(124,92,252,0.15) 80%, transparent 100%)',
        transform: `scaleX(${phase >= 1 ? 1 : 0})`,
        transition: 'transform 1.2s cubic-bezier(0.16,1,0.3,1)',
      }} />
      <div style={{
        position: 'absolute', bottom: '30%', left: 0, right: 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent 0%, rgba(124,92,252,0.15) 20%, rgba(196,181,253,0.4) 50%, rgba(124,92,252,0.15) 80%, transparent 100%)',
        transform: `scaleX(${phase >= 1 ? 1 : 0})`,
        transition: 'transform 1.4s cubic-bezier(0.16,1,0.3,1)',
      }} />

      {/* Center content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, zIndex: 2 }}>

        {/* Icon */}
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(124,92,252,0.2), rgba(124,92,252,0.05))',
          border: '1px solid rgba(124,92,252,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26,
          boxShadow: '0 0 40px rgba(124,92,252,0.2)',
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? 'scale(1) translateY(0)' : 'scale(0.7) translateY(8px)',
          transition: 'all 0.8s cubic-bezier(0.34,1.4,0.64,1)',
        }}>
          ✦
        </div>

        {/* Bienvenue hero */}
        {firstName && (
          <div style={{
            fontSize: 52, fontWeight: 800,
            letterSpacing: '-1.5px', lineHeight: 1.1,
            background: 'linear-gradient(160deg, #ffffff 0%, #e2d9ff 50%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2 ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease, transform 0.7s cubic-bezier(0.34,1.2,0.64,1)',
          }}>
            Bonjour, {firstName}
          </div>
        )}

        {/* App name + tagline */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          opacity: phase >= 3 ? 1 : 0,
          transform: phase >= 3 ? 'translateY(0)' : 'translateY(8px)',
          transition: 'all 0.7s ease 0.1s',
        }}>
          <div style={{
            fontSize: 15, fontWeight: 600,
            color: 'rgba(196,181,253,0.6)',
            letterSpacing: '0.1em',
          }}>
            {appName}
          </div>
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.22)',
            letterSpacing: '0.22em', textTransform: 'uppercase',
          }}>
            {tagline}
          </div>
        </div>
      </div>

      {/* Glow dot under name */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, 60px)',
        width: 200, height: 1,
        background: 'radial-gradient(ellipse, rgba(124,92,252,0.4) 0%, transparent 70%)',
        opacity: phase >= 2 ? 1 : 0,
        transition: 'opacity 1s ease 0.5s',
        pointerEvents: 'none',
      }} />

      {/* Corner marks */}
      {[
        { top: 32, left: 32 },
        { top: 32, right: 32 },
        { bottom: 32, left: 32 },
        { bottom: 32, right: 32 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: 'absolute', ...pos,
          width: 16, height: 16,
          borderTop: i < 2 ? '1px solid rgba(124,92,252,0.25)' : 'none',
          borderBottom: i >= 2 ? '1px solid rgba(124,92,252,0.25)' : 'none',
          borderLeft: i % 2 === 0 ? '1px solid rgba(124,92,252,0.25)' : 'none',
          borderRight: i % 2 === 1 ? '1px solid rgba(124,92,252,0.25)' : 'none',
          opacity: phase >= 1 ? 1 : 0,
          transition: `opacity 0.5s ease ${0.2 + i * 0.1}s`,
        }} />
      ))}

      {/* Progress */}
      <div style={{
        position: 'absolute', bottom: 40,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        opacity: phase >= 3 ? 1 : 0,
        transition: 'opacity 0.6s ease',
      }}>
        <button
          onClick={dismiss}
          style={{
            padding: '11px 32px',
            borderRadius: 12,
            border: '1px solid rgba(124,92,252,0.4)',
            background: 'rgba(124,92,252,0.15)',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 14, fontWeight: 600,
            letterSpacing: '0.04em',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 0 24px rgba(124,92,252,0.2)',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,92,252,0.28)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 36px rgba(124,92,252,0.4)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,92,252,0.15)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 24px rgba(124,92,252,0.2)';
          }}
        >
          C'est parti →
        </button>
        <div style={{ width: 80, height: 1, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', borderRadius: 1, marginTop: 4 }}>
          <div style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: 'linear-gradient(90deg, #7c5cfc, #c4b5fd)',
            transition: 'width 0.05s linear',
          }} />
        </div>
      </div>
    </div>
  );
}
