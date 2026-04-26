import { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const DURATION = 10000;
const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  angle: (i / 16) * 360,
  dist: 80 + Math.random() * 60,
  size: 3 + Math.random() * 4,
  delay: Math.random() * 2,
  duration: 2 + Math.random() * 2,
}));

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const { settings } = useTheme();
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const dismiss = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onDone, 600);
  };

  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      const p = Math.min((Date.now() - start) / DURATION, 1);
      setProgress(p);
      if (p >= 1) { clearInterval(iv); dismiss(); }
    }, 50);
    return () => clearInterval(iv);
  }, []);

  const appName = settings.appName || 'Orbit';
  const tagline = settings.tagline || 'CRM pour freelances';

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'radial-gradient(ellipse at 50% 40%, #1a1030 0%, #0a0810 60%, #060508 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        animation: leaving ? 'splashFadeOut 0.6s ease forwards' : 'none',
      }}
    >
      {/* Particles */}
      {PARTICLES.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * p.dist;
        const ty = Math.sin(rad) * p.dist;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: '50%', top: '42%',
            width: p.size, height: p.size,
            borderRadius: '50%',
            background: 'var(--accent)',
            opacity: 0,
            // @ts-ignore
            '--tx': `${tx}px`,
            '--ty': `${ty}px`,
            animation: `splashParticle ${p.duration}s ease-out ${p.delay}s infinite`,
          } as React.CSSProperties} />
        );
      })}

      {/* Glow rings */}
      {[200, 160, 120].map((size, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: size, height: size,
          borderRadius: '50%',
          border: `1px solid rgba(124,92,252,${0.06 + i * 0.04})`,
          animation: `splashFloat ${3 + i * 0.5}s ease-in-out ${i * 0.3}s infinite`,
        }} />
      ))}

      {/* Orb */}
      <div style={{
        width: 90, height: 90, borderRadius: '50%',
        background: 'linear-gradient(135deg, #7c5cfc 0%, #5b3fd4 50%, #3d28a8 100%)',
        boxShadow: '0 0 60px 20px rgba(124,92,252,0.4), 0 0 120px 40px rgba(124,92,252,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, color: 'white',
        animation: 'splashOrbIn 0.8s cubic-bezier(0.34,1.56,0.64,1) both, splashFloat 4s ease-in-out 0.8s infinite',
        marginBottom: 32, zIndex: 1,
      }}>
        ✦
      </div>

      {/* App name */}
      <div style={{
        fontSize: 42, fontWeight: 800, color: '#f0f0f0',
        letterSpacing: '-1.5px', lineHeight: 1,
        animation: 'splashTextIn 0.6s ease 0.4s both',
        zIndex: 1,
      }}>
        {appName}
      </div>

      {/* Tagline */}
      <div style={{
        fontSize: 14, color: 'rgba(255,255,255,0.35)', marginTop: 10, fontWeight: 400,
        letterSpacing: '0.05em',
        animation: 'splashTextIn 0.6s ease 0.7s both',
        zIndex: 1,
      }}>
        {tagline}
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
        width: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        animation: 'splashTextIn 0.6s ease 1s both',
      }}>
        <div style={{
          width: '100%', height: 2, borderRadius: 2,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: 'linear-gradient(90deg, #7c5cfc, #a78bfa)',
            width: `${progress * 100}%`,
            transition: 'width 0.05s linear',
            boxShadow: '0 0 8px rgba(124,92,252,0.8)',
          }} />
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em' }}>
          Cliquer pour passer
        </div>
      </div>
    </div>
  );
}
