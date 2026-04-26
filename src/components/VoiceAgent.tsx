import { useState, useRef, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Prospect, ProspectStatus } from '../types';
import { tsToDate, daysSince } from '../types';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useTheme } from '../contexts/ThemeContext';

type MicState = 'idle' | 'recording' | 'transcribing';

interface Msg {
  role: 'user' | 'agent';
  text: string;
  loading?: boolean;
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

export default function VoiceAgent() {
  const [open, setOpen] = useState(false);
  const [micState, setMicState] = useState<MicState>('idle');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [fabHover, setFabHover] = useState(false);

  const { workspaceUid } = useWorkspace();
  const { plan } = useTheme();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!workspaceUid) return;
    const q = collection(db, 'users', workspaceUid, 'prospects');
    return onSnapshot(q, snap => {
      setProspects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Prospect)));
    });
  }, [workspaceUid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
      // Pré-acquisition du micro dès l'ouverture du panel
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(s => { streamRef.current = s; })
        .catch(() => {});
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const executeAction = useCallback(async (action: { type: string; args: Record<string, unknown> }) => {
    if (!workspaceUid) return;
    const col = collection(db, 'users', workspaceUid, 'prospects');
    if (action.type === 'update_prospect_status') {
      const { id, status } = action.args as { id: string; status: ProspectStatus };
      await updateDoc(doc(col, id), { status, lastContact: Timestamp.now() });
    } else if (action.type === 'create_prospect') {
      const { name, email, company, amount, status } = action.args as {
        name: string; email?: string; company?: string; amount?: number; status?: ProspectStatus;
      };
      await addDoc(col, {
        name, email: email ?? '', company: company ?? '',
        amount: amount ?? 0, status: status ?? 'nouveau',
        notes: '', lastContact: Timestamp.now(), createdAt: Timestamp.now(),
      });
    }
  }, [workspaceUid]);

  const sendToAgent = async (text: string) => {
    if (!text.trim()) return;
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', text }, { role: 'agent', text: '', loading: true }]);
    try {
      const signed = prospects.filter(p => p.status === 'signé');
      const stats = {
        totalCA: signed.reduce((s, p) => s + (p.amount || 0), 0),
        signedCount: signed.length,
        prospectCount: prospects.length,
      };
      const agentProspects = prospects.map(p => ({
        id: p.id, name: p.name, status: p.status, amount: p.amount || 0,
        email: p.email, company: p.company,
        daysSinceContact: daysSince(tsToDate(p.lastContact)),
      }));
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, prospects: agentProspects, stats }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { message, action } = await res.json();
      if (action) await executeAction(action);
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { role: 'agent', text: message ?? '' } : m
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { role: 'agent', text: `⚠️ ${msg}` } : m
      ));
    }
  };

  const startRecording = async () => {
    setMicState('recording');
    try {
      // Utilise le stream pré-acquis si disponible, sinon en demande un nouveau
      const stream = streamRef.current ?? await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(100); // timeslice court pour capturer dès le début
      mediaRecorderRef.current = mr;
    } catch {
      setMicState('idle');
      setInputText('Accès au micro refusé.');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    setMicState('transcribing');
    mediaRecorderRef.current.onstop = async () => {
      mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
      const mimeType = mediaRecorderRef.current?.mimeType ?? 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      try {
        const base64 = await blobToBase64(blob);
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: base64, mimeType }),
        });
        if (!res.ok) throw new Error(await res.text());
        const { transcript } = await res.json();
        setMicState('idle');
        await sendToAgent(transcript); // envoi automatique
      } catch (err) {
        setInputText(err instanceof Error ? err.message : 'Erreur transcription');
        setMicState('idle');
      }
    };
    mediaRecorderRef.current.stop();
  };

  const handleMicDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (micState === 'idle') startRecording();
  };

  const handleMicUp = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (micState === 'recording') stopRecording();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToAgent(inputText); }
  };

  if (plan !== 'setup') return null;

  const isRecording = micState === 'recording';
  const isTranscribing = micState === 'transcribing';
  const canSend = !!inputText.trim() && micState === 'idle';

  return (
    <>
      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 900,
          width: 360,
          background: 'linear-gradient(160deg, #1c1826 0%, #161616 100%)',
          border: '1px solid rgba(124,92,252,0.2)',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,92,252,0.08)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'agentSlideUp 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(124,92,252,0.06)',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg, #7c5cfc, #5b3fd4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, flexShrink: 0,
              boxShadow: '0 4px 12px rgba(124,92,252,0.4)',
            }}>
              ✦
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#e5e5e5', letterSpacing: '-0.1px' }}>
                Assistant IA
              </div>
              <div style={{ fontSize: 11, color: 'rgba(124,92,252,0.8)', fontWeight: 500 }}>
                {isRecording ? '● Écoute en cours…' : isTranscribing ? 'Transcription…' : 'En ligne'}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#737373', fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = '#e5e5e5'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#737373'; }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div style={{
            overflowY: 'auto', padding: '16px',
            display: 'flex', flexDirection: 'column', gap: 12,
            minHeight: 200, maxHeight: 320,
          }}>
            {messages.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', padding: '16px 8px' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 18, margin: '0 auto 14px',
                  background: 'linear-gradient(135deg, rgba(124,92,252,0.2), rgba(124,92,252,0.05))',
                  border: '1px solid rgba(124,92,252,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}>
                  ✦
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#e5e5e5', marginBottom: 6 }}>
                  Parle ou écris une commande
                </p>
                <p style={{ fontSize: 11.5, color: '#4a4a4a', lineHeight: 1.7 }}>
                  "Mets Dupont en signé"<br />
                  "Crée un prospect chez Acme"<br />
                  "Qui n'a pas été contacté ?"
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '84%',
                  padding: '10px 14px',
                  borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  fontSize: 13, lineHeight: 1.6,
                  ...(m.role === 'user' ? {
                    background: 'linear-gradient(135deg, #7c5cfc, #5b3fd4)',
                    color: 'white',
                    boxShadow: '0 4px 16px rgba(124,92,252,0.3)',
                  } : {
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    color: '#d4d4d4',
                  }),
                }}>
                  {m.loading ? <ThinkingDots /> : m.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div style={{
            padding: '12px 14px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(0,0,0,0.2)',
          }}>
            {/* Mic */}
            <MicButton micState={micState} onDown={handleMicDown} onUp={handleMicUp} />

            {/* Input */}
            <input
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? 'Écoute…' : isTranscribing ? 'Transcription…' : 'Écris ou maintiens 🎙 pour parler…'}
              disabled={micState !== 'idle'}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: '9px 14px',
                fontSize: 13,
                color: '#e5e5e5',
                outline: 'none',
                transition: 'border-color 0.15s',
                opacity: micState !== 'idle' ? 0.5 : 1,
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.5)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />

            {/* Send */}
            <button
              onClick={() => sendToAgent(inputText)}
              disabled={!canSend}
              style={{
                flexShrink: 0,
                width: 36, height: 36, borderRadius: 10,
                background: canSend ? 'linear-gradient(135deg, #7c5cfc, #5b3fd4)' : 'rgba(255,255,255,0.05)',
                border: 'none',
                color: canSend ? 'white' : '#3a3a3a',
                fontSize: 16, cursor: canSend ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
                boxShadow: canSend ? '0 4px 12px rgba(124,92,252,0.4)' : 'none',
              }}
              onMouseEnter={e => { if (canSend) (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
            >
              ↑
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 900 }}>
        {/* Recording ring */}
        {isRecording && (
          <>
            <div style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              border: '2px solid rgba(239,68,68,0.6)',
              animation: 'agentRing 1.2s ease-out infinite',
            }} />
            <div style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              border: '2px solid rgba(239,68,68,0.4)',
              animation: 'agentRing 1.2s ease-out 0.4s infinite',
            }} />
          </>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          onMouseEnter={() => setFabHover(true)}
          onMouseLeave={() => setFabHover(false)}
          title="Assistant IA"
          style={{
            width: 52, height: 52, borderRadius: '50%',
            background: isRecording
              ? 'linear-gradient(135deg, #ef4444, #dc2626)'
              : 'linear-gradient(135deg, #7c5cfc, #5b3fd4)',
            border: 'none',
            color: 'white',
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s',
            transform: fabHover ? 'scale(1.12) translateY(-2px)' : 'scale(1)',
            boxShadow: fabHover
              ? '0 8px 28px rgba(124,92,252,0.6)'
              : '0 4px 18px rgba(124,92,252,0.4)',
            animation: !open && !isRecording ? 'agentGlow 3s ease-in-out infinite' : 'none',
          }}
        >
          {open ? '×' : '✦'}
        </button>
      </div>
    </>
  );
}

function MicButton({ micState, onDown, onUp }: {
  micState: MicState;
  onDown: (e: React.MouseEvent | React.TouchEvent) => void;
  onUp: (e: React.MouseEvent | React.TouchEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  const isRecording = micState === 'recording';
  const isTranscribing = micState === 'transcribing';

  return (
    <button
      onMouseDown={onDown}
      onMouseUp={onUp}
      onMouseLeave={e => { setHover(false); if (isRecording) onUp(e); }}
      onTouchStart={onDown}
      onTouchEnd={onUp}
      disabled={isTranscribing}
      onMouseEnter={() => setHover(true)}
      title="Maintenir pour parler"
      style={{
        flexShrink: 0,
        width: 36, height: 36, borderRadius: 10,
        background: isRecording
          ? 'rgba(239,68,68,0.15)'
          : hover ? 'rgba(124,92,252,0.15)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${isRecording ? 'rgba(239,68,68,0.4)' : hover ? 'rgba(124,92,252,0.4)' : 'rgba(255,255,255,0.1)'}`,
        color: isRecording ? '#ef4444' : isTranscribing ? '#3a3a3a' : hover ? '#7c5cfc' : '#737373',
        fontSize: 15,
        cursor: isTranscribing ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
        transform: isRecording ? 'scale(0.95)' : hover && !isTranscribing ? 'scale(1.05)' : 'scale(1)',
        userSelect: 'none',
      }}
    >
      {isTranscribing ? <ThinkingDots /> : '🎙'}
    </button>
  );
}

function ThinkingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'currentColor',
          display: 'inline-block',
          animation: `agentDot 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </span>
  );
}
