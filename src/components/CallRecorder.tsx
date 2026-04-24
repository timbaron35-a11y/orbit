import { useState, useRef, useEffect } from 'react';

type RecorderState = 'idle' | 'recording' | 'transcribing' | 'summarizing' | 'done' | 'error';

interface CallResult {
  summary: string;
  transcript: string;
  durationSeconds: number;
}

interface Props {
  prospectName: string;
  onSave: (result: CallResult) => void;
  onCancel: () => void;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export default function CallRecorder({ prospectName, onSave, onCancel }: Props) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<CallResult | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      startTimeRef.current = Date.now();
      setState('recording');
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch {
      setError('Accès au micro refusé. Autorisez l\'accès dans les paramètres du navigateur.');
      setState('error');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    if (timerRef.current) clearInterval(timerRef.current);

    mediaRecorderRef.current.onstop = async () => {
      mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
      const mimeType = mediaRecorderRef.current?.mimeType ?? 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      await processAudio(blob, mimeType, durationSeconds);
    };
    mediaRecorderRef.current.stop();
  };

  const processAudio = async (blob: Blob, mimeType: string, durationSeconds: number) => {
    setState('transcribing');
    try {
      const base64 = await blobToBase64(blob);

      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, mimeType }),
      });
      if (!transcribeRes.ok) throw new Error(await transcribeRes.text());
      const { transcript } = await transcribeRes.json();

      setState('summarizing');
      const summarizeRes = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, prospectName }),
      });
      if (!summarizeRes.ok) throw new Error(await summarizeRes.text());
      const { summary } = await summarizeRes.json();

      setResult({ summary, transcript, durationSeconds });
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du traitement');
      setState('error');
    }
  };

  if (state === 'idle') {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🎙️</div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
            Mets ton téléphone en haut-parleur et lance l'enregistrement. L'appel sera transcrit et résumé automatiquement.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={onCancel} style={ghostBtn}>Annuler</button>
            <button onClick={startRecording} style={recordBtn}>
              ● Démarrer l'enregistrement
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'recording') {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%', background: '#ef4444',
              animation: 'pulse 1.2s ease-in-out infinite',
            }} />
            <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(elapsed)}
            </span>
          </div>
          <Waveform />
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, marginTop: 12 }}>
            Enregistrement en cours…
          </p>
          <button onClick={stopRecording} style={stopBtn}>
            ⏹ Arrêter l'enregistrement
          </button>
        </div>
      </div>
    );
  }

  if (state === 'transcribing' || state === 'summarizing') {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <Spinner />
          <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, marginTop: 16, marginBottom: 6 }}>
            {state === 'transcribing' ? 'Transcription en cours…' : 'Génération du résumé…'}
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            {state === 'transcribing' ? "Analyse de l'audio…" : "Génération du résumé…"}
          </p>
          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Step done={true} label="Enregistrement" />
            <StepArrow />
            <Step done={state === 'summarizing'} active={state === 'transcribing'} label="Transcription" />
            <StepArrow />
            <Step done={false} active={state === 'summarizing'} label="Résumé" />
          </div>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
          <p style={{ fontSize: 13.5, color: '#ef4444', marginBottom: 8 }}>Erreur lors de la transcription</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, fontFamily: 'monospace', background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 6, textAlign: 'left', wordBreak: 'break-word' }}>{error}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={onCancel} style={ghostBtn}>Annuler</button>
            <button onClick={() => setState('idle')} style={recordBtn}>Réessayer</button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'done' && result) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Summary */}
        <div style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>📞 Appel</span>
            <span style={{
              fontSize: 11, padding: '1px 7px', borderRadius: 20, fontWeight: 500,
              background: 'rgba(34,197,94,0.12)', color: '#22c55e',
            }}>
              ⏱ {formatTime(result.durationSeconds)}
            </span>
          </div>
          <div style={{
            fontSize: 13.5, color: 'var(--text)', lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
          }}>
            {result.summary}
          </div>
        </div>

        {/* Transcript toggle */}
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: 12.5, cursor: 'pointer', padding: '4px 0',
          }}
        >
          <span style={{ fontSize: 10, transition: 'transform 0.15s', display: 'inline-block', transform: showTranscript ? 'rotate(90deg)' : 'none' }}>▶</span>
          {showTranscript ? 'Masquer' : 'Voir'} la transcription complète
        </button>

        {showTranscript && (
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '14px 16px',
            maxHeight: 200, overflowY: 'auto',
          }}>
            <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
              {result.transcript}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={ghostBtn}>Annuler</button>
          <button
            onClick={() => onSave(result)}
            style={saveBtn}
          >
            ✓ Enregistrer dans le CRM
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function Waveform() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 32 }}>
      {[0.4, 0.7, 1, 0.8, 0.5, 0.9, 0.6, 1, 0.7, 0.4, 0.8, 0.5].map((h, i) => (
        <div
          key={i}
          style={{
            width: 3, borderRadius: 2,
            background: 'var(--accent)',
            height: `${h * 28}px`,
            opacity: 0.7,
            animation: `waveBar 0.8s ease-in-out ${i * 0.07}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: '3px solid var(--border)',
      borderTopColor: 'var(--accent)',
      animation: 'spin 0.8s linear infinite',
      margin: '0 auto',
    }} />
  );
}

function Step({ done, active, label }: { done: boolean; active?: boolean; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', margin: '0 auto 4px',
        background: done ? '#22c55e' : active ? 'var(--accent)' : 'var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, color: done || active ? 'white' : 'var(--text-muted)',
        transition: 'background 0.3s',
      }}>
        {done ? '✓' : '·'}
      </div>
      <div style={{ fontSize: 10.5, color: done || active ? 'var(--text)' : 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

function StepArrow() {
  return <div style={{ color: 'var(--border)', fontSize: 16, marginTop: 2 }}>→</div>;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return types.find(t => MediaRecorder.isTypeSupported(t)) ?? '';
}

const containerStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '20px 16px',
};

const recordBtn: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
  background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer',
};

const stopBtn: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
  background: 'var(--surface)', color: 'var(--text)',
  border: '1px solid var(--border)', cursor: 'pointer',
};

const saveBtn: React.CSSProperties = {
  padding: '9px 20px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
  background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
  background: 'transparent', color: 'var(--text-muted)',
  border: '1px solid var(--border)', cursor: 'pointer',
};
