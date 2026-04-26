import { useEffect, useState, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const DURATION = 10000;

const ORBITS = [
  { radius: 90,  size: 5,   duration: 4,   color: '#7c5cfc', opacity: 0.9, delay: 0 },
  { radius: 90,  size: 3,   duration: 4,   color: '#a78bfa', opacity: 0.5, delay: 2 },
  { radius: 130, size: 4,   duration: 7,   color: '#c4b5fd', opacity: 0.7, delay: 0 },
  { radius: 130, size: 2.5, duration: 7,   color: '#7c5cfc', opacity: 0.4, delay: 3.5 },
  { radius: 170, size: 3.5, duration: 11,  color: '#a78bfa', opacity: 0.6, delay: 0 },
  { radius: 170, size: 2,   duration: 11,  color: '#ede9fe', opacity: 0.3, delay: 5.5 },
  { radius: 210, size: 3,   duration: 16,  color: '#7c5cfc', opacity: 0.4, delay: 0 },
  { radius: 210, size: 2,   duration: 16,  color: '#c4b5fd', opacity: 0.25, delay: 8 },
];

const STARS = Array.from({ length: 80 }, () => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 0.5 + Math.random() * 1.5,
  opacity: 0.1 + Math.random() * 0.4,
  duration: 2 + Math.random() * 4,
  delay: Math.random() * 4,
}));

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const { settings } = useTheme();
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'enter' | 'idle' | 'exit'>('enter');
  const doneRef = useRef(false);

  const dismiss = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase('exit');
    setTimeout(onDone, 800);
  };

  useEffect(() => {
    setTimeout(() => setPhase('idle'), 100);
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
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', overflow: 'hidden',
        background: '#07050f',
        opacity: phase === 'exit' ? 0 : 1,
        transition: phase === 'exit' ? 'opacity 0.8s ease' : 'none',
      }}
    >
      {/* Aurora background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(124,92,252,0.12) 0%, transparent 70%)',
        animation: 'splashFloat 6s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 50% 40% at 30% 60%, rgba(167,139,250,0.06) 0%, transparent 60%)',
        animation: 'splashFloat 8s ease-in-out 2s infinite reverse',
      }} />

      {/* Stars */}
      {STARS.map((s, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size,
          borderRadius: '50%',
          background: 'white',
          opacity: s.opacity,
          animation: `agentDot ${s.duration}s ease-in-out ${s.delay}s infinite`,
        }} />
      ))}

      {/* Orbital system */}
      <div style={{
        position: 'relative',
        width: 460, height: 460,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: phase === 'enter' ? 0 : 1,
        transform: phase === 'enter' ? 'scale(0.85)' : 'scale(1)',
        transition: 'opacity 1s ease, transform 1s cubic-bezier(0.34,1.2,0.64,1)',
      }}>
        {/* Orbit rings */}
        {[90, 130, 170, 210].map((r, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: r * 2, height: r * 2,
            borderRadius: '50%',
            border: `1px solid rgba(124,92,252,${0.08 - i * 0.015})`,
            boxShadow: `0 0 ${12 - i * 2}px rgba(124,92,252,${0.06 - i * 0.01})`,
          }} />
        ))}

        {/* Orbiting dots */}
        {ORBITS.map((o, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: o.radius * 2, height: o.radius * 2,
            animation: `splashOrbit${i % 2 === 0 ? '' : 'Rev'} ${o.duration}s linear ${o.delay}s infinite`,
          }}>
            <div style={{
              position: 'absolute',
              top: '50%', left: 0,
              marginTop: -o.size / 2,
              width: o.size, height: o.size,
              borderRadius: '50%',
              background: o.color,
              opacity: o.opacity,
              boxShadow: `0 0 ${o.size * 3}px ${o.color}`,
            }} />
          </div>
        ))}

        {/* Central orb */}
        <div style={{
          width: 100, height: 100, borderRadius: '50%',
          background: 'linear-gradient(135deg, #9b6dff 0%, #7c5cfc 40%, #4f35b8 100%)',
          boxShadow: '0 0 40px 12px rgba(124,92,252,0.5), 0 0 80px 24px rgba(124,92,252,0.2), inset 0 1px 0 rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 40, zIndex: 2,
          animation: 'splashFloat 4s ease-in-out infinite',
        }}>
          ✦
        </div>
      </div>

      {/* Text */}
      <div style={{
        position: 'absolute',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 10, zIndex: 3,
        opacity: phase === 'enter' ? 0 : 1,
        transform: phase === 'enter' ? 'translateY(16px)' : 'translateY(0)',
        transition: 'opacity 0.8s ease 0.3s, transform 0.8s ease 0.3s',
      }}>
        {/* Shine text */}
        <div style={{
          fontSize: 52, fontWeight: 800,
          letterSpacing: '-2px', lineHeight: 1,
          background: 'linear-gradient(135deg, #e0d7ff 0%, #ffffff 40%, #c4b5fd 70%, #a78bfa 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: 'drop-shadow(0 0 20px rgba(124,92,252,0.6))',
        }}>
          {appName}
        </div>
        <div style={{
          fontSize: 13.5, color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 400,
        }}>
          {tagline}
        </div>
      </div>

      {/* Bottom progress */}
      <div style={{
        position: 'absolute', bottom: 44, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        opacity: phase === 'enter' ? 0 : 1,
        transition: 'opacity 0.6s ease 0.8s',
      }}>
        <div style={{ width: 180, height: 1.5, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${progress * 100}%`,
            background: 'linear-gradient(90deg, #7c5cfc, #c4b5fd)',
            boxShadow: '0 0 10px rgba(124,92,252,0.9)',
            transition: 'width 0.05s linear',
          }} />
        </div>
        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Cliquer pour continuer
        </div>
      </div>
    </div>
  );
}
