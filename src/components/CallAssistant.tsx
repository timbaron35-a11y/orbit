import { useState, useRef, useEffect, useCallback } from 'react';
import { doc, updateDoc, addDoc, collection, Timestamp, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import type { Prospect, ProspectStatus } from '../types';
import { STATUS_LABEL, STATUS_COLOR, STATUS_BG, formatCurrency } from '../types';
import { tsToDate } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useToast } from '../contexts/ToastContext';

interface Signal {
  type: 'budget' | 'objection' | 'deadline' | 'interet' | 'decision' | 'besoin';
  text: string;
  urgent: boolean;
}

interface Analysis {
  signals: Signal[];
  suggestion: string | null;
  nextStep: string | null;
  mood: 'positif' | 'neutre' | 'négatif' | 'hésitant';
}

interface Props {
  prospect: Prospect;
  onClose: () => void;
  onSaved?: () => void;
}

const SIGNAL_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  budget:    { label: 'Budget',    color: '#22c55e', icon: '€' },
  objection: { label: 'Objection', color: '#ef4444', icon: '!' },
  deadline:  { label: 'Deadline',  color: '#f59e0b', icon: '⏰' },
  interet:   { label: 'Intérêt',   color: '#a78bfa', icon: '✦' },
  decision:  { label: 'Décision',  color: '#3b82f6', icon: '→' },
  besoin:    { label: 'Besoin',    color: '#06b6d4', icon: '◎' },
};

const MOOD_CONFIG = {
  positif:  { color: '#22c55e', label: 'Positif',  dot: '●' },
  neutre:   { color: '#a1a1aa', label: 'Neutre',   dot: '●' },
  négatif:  { color: '#ef4444', label: 'Négatif',  dot: '●' },
  hésitant: { color: '#f59e0b', label: 'Hésitant', dot: '●' },
};

function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

function getSupportedMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return types.find(t => MediaRecorder.isTypeSupported(t)) ?? '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const STATUSES: ProspectStatus[] = ['nouveau', 'contacté', 'devis', 'signé', 'perdu'];

export default function CallAssistant({ prospect, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const { workspaceUid } = useWorkspace();
  const { showToast } = useToast();
  const [phase, setPhase] = useState<'idle' | 'setup' | 'active' | 'ended' | 'saving'>('idle');
  const [captureMode, setCaptureMode] = useState<'mic' | 'browser'>('browser');
  const [minimized, setMinimized] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [allSignals, setAllSignals] = useState<Signal[]>([]);
  const [error, setError] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState('');
  const [saveStatus, setSaveStatus] = useState<ProspectStatus>(prospect.status);
  const [saveReminder, setSaveReminder] = useState('');
  const [persisting, setPersisting] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyzeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const transcriptRef = useRef('');
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const mimeTypeRef = useRef('');

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  useEffect(() => {
    return () => {
      stopAllTracks();
      if (timerRef.current) clearInterval(timerRef.current);
      if (analyzeTimerRef.current) clearInterval(analyzeTimerRef.current);
    };
  }, []);

  const stopAllTracks = () => {
    recorderRef.current?.stream?.getTracks().forEach(t => t.stop());
  };

  const buildProspectContext = () => {
    const lines = [
      `Statut: ${STATUS_LABEL[prospect.status]}`,
      prospect.amount > 0 ? `Montant: ${formatCurrency(prospect.amount)}` : null,
      prospect.company ? `Entreprise: ${prospect.company}` : null,
      prospect.notes ? `Notes: ${prospect.notes.slice(0, 200)}` : null,
      `Dernier contact: ${tsToDate(prospect.lastContact).toLocaleDateString('fr-FR')}`,
    ].filter(Boolean);
    return lines.join('. ');
  };

  const processChunk = useCallback(async (chunk: Blob) => {
    if (chunk.size < 1000) return;
    try {
      const base64 = await blobToBase64(chunk);
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, mimeType: mimeTypeRef.current }),
      });
      if (!res.ok) return;
      const { transcript: chunk_text } = await res.json();
      if (chunk_text?.trim()) {
        setTranscript(prev => prev + (prev ? ' ' : '') + chunk_text.trim());
      }
    } catch { /* silent fail on chunk */ }
  }, []);

  const runAnalysis = useCallback(async () => {
    const current = transcriptRef.current;
    if (!current.trim() || analyzing) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/call-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: current,
          prospectName: prospect.name,
          prospectContext: buildProspectContext(),
        }),
      });
      if (!res.ok) return;
      const result: Analysis = await res.json();
      setAnalysis(result);
      if (result.signals?.length > 0) {
        setAllSignals(prev => {
          const existing = new Set(prev.map(s => s.text));
          const newOnes = result.signals.filter(s => !existing.has(s.text));
          return [...prev, ...newOnes];
        });
      }
    } catch { /* silent */ } finally {
      setAnalyzing(false);
    }
  }, [prospect, analyzing]);

  const startCapture = async () => {
    setError('');
    try {
      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType;

      let stream: MediaStream;

      if (captureMode === 'browser') {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        // getDisplayMedia requires video:true on most browsers — we stop video tracks immediately
        let displayStream: MediaStream | null = null;
        try {
          displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          displayStream.getVideoTracks().forEach(t => t.stop());
        } catch {
          // User cancelled or not supported — fall back to mic only
        }

        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        ctx.createMediaStreamSource(micStream).connect(dest);
        if (displayStream && displayStream.getAudioTracks().length > 0) {
          ctx.createMediaStreamSource(displayStream).connect(dest);
        }
        stream = dest.stream;

        const origTracks = [...micStream.getTracks(), ...(displayStream?.getTracks() ?? [])];
        stream.getTracks()[0]?.addEventListener('ended', () => origTracks.forEach(t => t.stop()));
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }

      const mr = new MediaRecorder(stream, { mimeType });
      recorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          processChunk(e.data);
        }
      };

      mr.start(6000); // chunk every 6s
      startTimeRef.current = Date.now();
      setPhase('active');

      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      // Analyze every 10s
      analyzeTimerRef.current = setInterval(runAnalysis, 10000);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setError('Accès refusé. Autorise le micro' + (captureMode === 'browser' ? ' et le partage audio' : '') + ' dans le navigateur.');
      } else {
        setError(msg);
      }
    }
  };

  const stopCapture = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    stopAllTracks();
    if (timerRef.current) clearInterval(timerRef.current);
    if (analyzeTimerRef.current) clearInterval(analyzeTimerRef.current);
    setPhase('ended');
    // Final analysis
    setTimeout(runAnalysis, 500);
  };

  const openSavePanel = async () => {
    setPhase('saving');
    setSummarizing(true);
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, prospectName: prospect.name, durationSeconds: elapsed }),
      });
      if (res.ok) {
        const { summary: s } = await res.json();
        setSummary(s ?? transcript.slice(0, 300));
      } else {
        setSummary(transcript.slice(0, 300));
      }
    } catch {
      setSummary(transcript.slice(0, 300));
    } finally {
      setSummarizing(false);
    }
  };

  const handlePersist = async () => {
    if (!user) return;
    setPersisting(true);
    try {
      await addDoc(collection(db, 'users', workspaceUid, 'prospects', prospect.id, 'activities'), {
        type: 'appel',
        content: summary,
        subject: transcript,
        duration: Math.round(elapsed / 60) || 1,
        createdAt: Timestamp.now(),
        authorEmail: user.email ?? 'inconnu',
      });
      const update: Record<string, unknown> = {
        status: saveStatus,
        lastContact: Timestamp.now(),
      };
      if (saveReminder) {
        update.reminderDate = Timestamp.fromDate(new Date(saveReminder + 'T12:00:00'));
      } else {
        update.reminderDate = deleteField();
      }
      await updateDoc(doc(db, 'users', workspaceUid, 'prospects', prospect.id), update);
      showToast('Appel enregistré dans le CRM');
      onSaved?.();
      onClose();
    } catch {
      showToast('Erreur lors de la sauvegarde', 'error');
    } finally {
      setPersisting(false);
    }
  };

  const moodCfg = analysis ? MOOD_CONFIG[analysis.mood] ?? MOOD_CONFIG.neutre : null;

  // ── Save panel ──────────────────────────────────────────────────────────────
  if (phase === 'saving') {
    return (
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 500,
        width: 380, background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden',
      }}>
        <div style={{ height: 2, background: 'linear-gradient(90deg, var(--accent), #a78bfa, transparent)' }} />
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Enregistrer l'appel</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{prospect.name} · {Math.round(elapsed / 60)}min</span>
          </div>

          {/* Summary */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>Résumé IA</div>
            {summarizing ? (
              <div style={{ padding: '14px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                Génération du résumé…
              </div>
            ) : (
              <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                rows={4}
                style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)', fontSize: 12.5, padding: '10px 12px', fontFamily: 'inherit', lineHeight: 1.6, resize: 'none', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
            )}
          </div>

          {/* Status */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Nouveau statut</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STATUSES.map(s => {
                const active = saveStatus === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSaveStatus(s)}
                    style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                      background: active ? STATUS_BG[s] : 'transparent',
                      color: active ? STATUS_COLOR[s] : 'var(--text-muted)',
                      border: active ? `1.5px solid ${STATUS_COLOR[s]}50` : '1.5px solid var(--border)',
                      boxShadow: active ? `0 0 8px ${STATUS_COLOR[s]}25` : 'none',
                    }}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reminder */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>Rappel de suivi</div>
            <input
              type="date"
              className="orbit-input"
              value={saveReminder}
              onChange={e => setSaveReminder(e.target.value)}
              style={{ fontSize: 13 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 7, marginTop: 2 }}>
            <button
              onClick={() => setPhase('ended')}
              style={{ padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
            >
              Retour
            </button>
            <button
              onClick={handlePersist}
              disabled={persisting || summarizing || !summary.trim()}
              style={{
                flex: 1, padding: '9px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: 'var(--accent)', color: 'white', border: 'none',
                cursor: persisting || summarizing ? 'default' : 'pointer',
                opacity: persisting ? 0.7 : 1,
                boxShadow: '0 4px 14px rgba(124,92,252,0.35)',
              }}
            >
              {persisting ? 'Enregistrement…' : '✓ Enregistrer dans le CRM'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Idle / Setup ────────────────────────────────────────────────────────────
  if (phase === 'idle' || phase === 'setup') {
    return (
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 500,
        width: 340, background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        <div style={{ height: 2, background: 'linear-gradient(90deg, #22c55e, #a78bfa, transparent)' }} />
        <div style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Copilote d'appel</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{prospect.name}</div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: '4px 6px', borderRadius: 6 }}>×</button>
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Mode de capture</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {[
              { mode: 'browser' as const, label: 'Navigateur + micro', desc: 'Meet, Teams, Zoom dans ce navigateur — capture les deux voix', icon: '🖥' },
              { mode: 'mic' as const, label: 'Micro seul', desc: 'Appel téléphonique en haut-parleur', icon: '🎙' },
            ].map(opt => (
              <div
                key={opt.mode}
                onClick={() => setCaptureMode(opt.mode)}
                style={{
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${captureMode === opt.mode ? 'var(--accent)' : 'var(--border)'}`,
                  background: captureMode === opt.mode ? 'var(--accent-dim)' : 'var(--surface-2)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 15 }}>{opt.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: captureMode === opt.mode ? 'var(--accent)' : 'var(--text)' }}>{opt.label}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', paddingLeft: 23 }}>{opt.desc}</div>
              </div>
            ))}
          </div>

          {captureMode === 'browser' && (
            <div style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#f59e0b', lineHeight: 1.6 }}>
                📌 Chrome va demander de <strong>partager un onglet</strong> — coche "Partager l'audio de l'onglet" puis sélectionne ton onglet Meet/Teams.<br/>
                <span style={{ opacity: 0.8 }}>Si l'audio système n'est pas disponible, le micro seul sera utilisé.</span>
              </div>
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
              {error}
            </div>
          )}

          <button
            onClick={startCapture}
            style={{
              width: '100%', padding: '11px', borderRadius: 10, fontSize: 13.5, fontWeight: 700,
              background: '#22c55e', color: 'white', border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(34,197,94,0.35)', transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            ● Démarrer le copilote
          </button>
        </div>
      </div>
    );
  }

  // ── Active / Ended ───────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 500,
      width: minimized ? 220 : 380,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      transition: 'width 0.2s',
      overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{ height: 2, background: phase === 'active' ? 'linear-gradient(90deg, #22c55e, #a78bfa)' : 'linear-gradient(90deg, var(--border), transparent)' }} />
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {phase === 'active' && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0, boxShadow: '0 0 6px #ef4444', animation: 'pulse 1.2s ease-in-out infinite' }} />
        )}
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
          {minimized ? formatTime(elapsed) : prospect.name}
        </span>
        {!minimized && <span style={{ fontSize: 12.5, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatTime(elapsed)}</span>}
        {moodCfg && !minimized && (
          <span style={{ fontSize: 11, fontWeight: 600, color: moodCfg.color, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 7 }}>{moodCfg.dot}</span>{moodCfg.label}
          </span>
        )}
        <button onClick={() => setMinimized(!minimized)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', padding: '2px 4px', borderRadius: 5 }}>
          {minimized ? '▲' : '▼'}
        </button>
        {phase === 'active' ? (
          <button
            onClick={stopCapture}
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', borderRadius: 7, fontSize: 12, fontWeight: 600, padding: '4px 10px', cursor: 'pointer' }}
          >
            Stop
          </button>
        ) : (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: '2px 4px' }}>×</button>
        )}
      </div>

      {!minimized && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* AI suggestion */}
          {analysis?.suggestion && (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent-dim), rgba(124,92,252,0.05))',
              border: '1px solid rgba(124,92,252,0.2)',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span style={{ fontSize: 13, color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>✦</span>
              <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, lineHeight: 1.5 }}>{analysis.suggestion}</span>
              {analyzing && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0, marginTop: 2 }}>…</span>}
            </div>
          )}

          {/* Signals */}
          {allSignals.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allSignals.slice(-6).map((s, i) => {
                const cfg = SIGNAL_CONFIG[s.type] ?? SIGNAL_CONFIG.besoin;
                return (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    background: `${cfg.color}12`,
                    border: `1px solid ${cfg.color}30`,
                    color: cfg.color,
                  }}>
                    <span style={{ fontSize: 9 }}>{cfg.icon}</span>
                    {s.text.slice(0, 28)}{s.text.length > 28 ? '…' : ''}
                  </span>
                );
              })}
            </div>
          )}

          {/* Next step */}
          {analysis?.nextStep && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#f59e0b' }}>→</span>
              <span>Prochaine étape probable : <strong style={{ color: 'var(--text)' }}>{analysis.nextStep}</strong></span>
            </div>
          )}

          {/* Transcript */}
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
              Transcription live
              {analyzing && <span style={{ fontSize: 10, color: 'var(--accent)', animation: 'pulse 1s infinite' }}>● analyse…</span>}
            </div>
            <div style={{
              height: 110, overflowY: 'auto', fontSize: 12.5, color: 'var(--text-dim)',
              lineHeight: 1.65, background: 'var(--surface-2)', borderRadius: 9,
              border: '1px solid var(--border)', padding: '10px 12px',
            }}>
              {transcript || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>En attente de parole…</span>}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          {/* Ended state */}
          {phase === 'ended' && (
            <div style={{ display: 'flex', gap: 7 }}>
              <button
                onClick={() => navigator.clipboard.writeText(transcript)}
                style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 500, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}
              >
                Copier
              </button>
              <button
                onClick={openSavePanel}
                style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(124,92,252,0.35)' }}
              >
                ✓ Sauvegarder dans le CRM
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
