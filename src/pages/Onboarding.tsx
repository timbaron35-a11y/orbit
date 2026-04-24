import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeSettings } from '../contexts/ThemeContext';
import { DEFAULT_SETTINGS, applyTheme } from '../contexts/ThemeContext';

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

export default function Onboarding() {
  const { saveSettings } = useTheme();
  const [step, setStep] = useState(1);
  const [appName, setAppName] = useState('');
  const [tagline, setTagline] = useState('');
  const [accentColor, setAccentColor] = useState(DEFAULT_SETTINGS.accentColor);
  const [saving, setSaving] = useState(false);

  const previewName = appName.trim() || 'Orbit';
  const previewTagline = tagline.trim() || 'CRM pour freelances';

  const handleColorChange = (hex: string) => {
    setAccentColor(hex);
    applyTheme(hex);
  };

  const handleFinish = async () => {
    setSaving(true);
    const s: ThemeSettings = {
      appName: appName.trim() || DEFAULT_SETTINGS.appName,
      tagline: tagline.trim() || DEFAULT_SETTINGS.tagline,
      accentColor,
      plan: 'solo',
    };
    await saveSettings(s);
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
        maxWidth: 520,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
      }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--border)' }}>
          <div style={{
            height: '100%',
            background: 'var(--accent)',
            width: `${(step / 3) * 100}%`,
            transition: 'width 0.35s cubic-bezier(0.16,1,0.3,1)',
          }} />
        </div>

        <div style={{ padding: '40px 40px 32px' }}>
          {/* Step indicator */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>
            Étape {step} sur 3
          </div>

          {step === 1 && (
            <StepName
              appName={appName} setAppName={setAppName}
              tagline={tagline} setTagline={setTagline}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepColor
              accentColor={accentColor}
              onColorChange={handleColorChange}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <StepPreview
              appName={previewName}
              tagline={previewTagline}
              accentColor={accentColor}
              saving={saving}
              onBack={() => setStep(2)}
              onFinish={handleFinish}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StepName({ appName, setAppName, tagline, setTagline, onNext }: {
  appName: string; setAppName: (v: string) => void;
  tagline: string; setTagline: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.4px', marginBottom: 6 }}>
        Bienvenue 👋
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.6 }}>
        Personnalisez votre CRM en quelques secondes.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Field label="Nom de votre outil">
          <input
            className="orbit-input"
            value={appName}
            onChange={e => setAppName(e.target.value)}
            placeholder="Ex : Orbit, MonCRM, Freelance Pro…"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && onNext()}
          />
        </Field>
        <Field label="Tagline (optionnel)">
          <input
            className="orbit-input"
            value={tagline}
            onChange={e => setTagline(e.target.value)}
            placeholder="Ex : Mon suivi client freelance"
            onKeyDown={e => e.key === 'Enter' && onNext()}
          />
        </Field>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
        <button onClick={onNext} style={primaryBtn}>
          Suivant →
        </button>
      </div>
    </>
  );
}

function StepColor({ accentColor, onColorChange, onBack, onNext }: {
  accentColor: string;
  onColorChange: (hex: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: 6 }}>
        Couleur principale
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.6 }}>
        Elle sera utilisée partout dans l'interface.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
        {PRESET_COLORS.map(c => (
          <button
            key={c.hex}
            onClick={() => onColorChange(c.hex)}
            title={c.name}
            style={{
              width: 40, height: 40, borderRadius: 10,
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
            onChange={e => onColorChange(e.target.value)}
            style={{
              width: 44, height: 38, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface-2)', cursor: 'pointer', padding: 2,
            }}
          />
          <input
            className="orbit-input"
            value={accentColor}
            onChange={e => {
              if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onColorChange(e.target.value);
            }}
            style={{ fontFamily: 'monospace', width: 110 }}
          />
          <div style={{
            flex: 1, height: 38, borderRadius: 8,
            background: accentColor, opacity: 0.85,
          }} />
        </div>
      </Field>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
        <button onClick={onBack} style={ghostBtn}>← Retour</button>
        <button onClick={onNext} style={primaryBtn}>Suivant →</button>
      </div>
    </>
  );
}

function StepPreview({ appName, tagline, accentColor, saving, onBack, onFinish }: {
  appName: string; tagline: string; accentColor: string;
  saving: boolean; onBack: () => void; onFinish: () => void;
}) {
  return (
    <>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: 6 }}>
        Aperçu
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.6 }}>
        Voici à quoi ressemblera votre sidebar.
      </p>

      {/* Mock sidebar preview */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 28,
      }}>
        <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7,
              background: accentColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <circle cx="12" cy="12" r="3"/>
                <circle cx="12" cy="12" r="7" opacity=".5"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>{appName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{tagline}</div>
            </div>
          </div>
        </div>
        {['Dashboard', 'Pipeline', 'Clients'].map((label, i) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 14px', margin: '4px 8px', borderRadius: 7,
            background: i === 0 ? accentColor : 'transparent',
            color: i === 0 ? 'white' : 'var(--text-dim)',
            fontSize: 13,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', opacity: 0.7 }} />
            {label}
          </div>
        ))}
        <div style={{ height: 8 }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={ghostBtn}>← Retour</button>
        <button
          onClick={onFinish}
          disabled={saving}
          style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Enregistrement…' : 'Commencer →'}
        </button>
      </div>
    </>
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

const primaryBtn: React.CSSProperties = {
  padding: '10px 22px', borderRadius: 9, fontSize: 13.5, fontWeight: 600,
  background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
  transition: 'opacity 0.15s',
};

const ghostBtn: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 9, fontSize: 13.5, fontWeight: 500,
  background: 'transparent', color: 'var(--text-dim)',
  border: '1px solid var(--border)', cursor: 'pointer',
};
