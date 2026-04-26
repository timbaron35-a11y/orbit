import { useState, useRef, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Prospect, ProspectStatus } from '../types';
import { tsToDate, daysSince } from '../types';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useTheme } from '../contexts/ThemeContext';

type MicState = 'idle' | 'recording' | 'transcribing';

interface AgentMessage {
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
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);

  const { workspaceUid } = useWorkspace();
  const { plan } = useTheme();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
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
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    return () => { mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop()); };
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      setMicState('recording');
    } catch {
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
        setInputText(transcript);
        inputRef.current?.focus();
      } catch (err) {
        setInputText(err instanceof Error ? err.message : 'Erreur transcription');
      } finally {
        setMicState('idle');
      }
    };
    mediaRecorderRef.current.stop();
  };

  const handleMicClick = () => {
    if (micState === 'idle') startRecording();
    else if (micState === 'recording') stopRecording();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendToAgent(inputText);
    }
  };

  if (plan !== 'setup') return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Assistant IA"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 900,
          width: 50, height: 50, borderRadius: '50%',
          background: open ? 'var(--surface)' : 'var(--accent)',
          border: open ? '1px solid var(--border)' : 'none',
          color: open ? 'var(--text-muted)' : 'white',
          fontSize: open ? 18 : 22, cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(124,92,252,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}
      >
        {open ? '×' : '🤖'}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 84, right: 24, zIndex: 900,
          width: 340, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 14,
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '11px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 14 }}>🤖</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', flex: 1 }}>Assistant CRM</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 20, border: '1px solid var(--border)' }}>
              Setup
            </span>
          </div>

          {/* Messages */}
          <div style={{
            overflowY: 'auto', padding: '14px',
            display: 'flex', flexDirection: 'column', gap: 10,
            minHeight: 180, maxHeight: 300,
          }}>
            {messages.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🎙️</div>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                  Parle ou écris une commande.<br />
                  <span style={{ fontSize: 11.5, opacity: 0.75 }}>
                    "Mets Dupont en signé" · "Crée un prospect"<br />"Qui n'a pas été contacté ?"
                  </span>
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                background: m.role === 'user' ? 'var(--accent)' : 'var(--surface-2)',
                color: m.role === 'user' ? 'white' : 'var(--text)',
                padding: '8px 12px',
                borderRadius: m.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                fontSize: 13, lineHeight: 1.5,
              }}>
                {m.loading ? <LoadingDots /> : m.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div style={{
            padding: '10px 12px', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {/* Mic button */}
            <button
              onClick={handleMicClick}
              disabled={micState === 'transcribing'}
              title={micState === 'recording' ? 'Arrêter' : 'Parler'}
              style={{
                flexShrink: 0,
                width: 34, height: 34, borderRadius: '50%',
                background: micState === 'recording' ? 'rgba(239,68,68,0.12)' : 'var(--surface-2)',
                border: `1.5px solid ${micState === 'recording' ? '#ef4444' : 'var(--border)'}`,
                color: micState === 'recording' ? '#ef4444' : micState === 'transcribing' ? 'var(--text-muted)' : 'var(--text-muted)',
                fontSize: micState === 'transcribing' ? 10 : 15,
                cursor: micState === 'transcribing' ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
                animation: micState === 'recording' ? 'pulse 1s ease-in-out infinite' : 'none',
              }}
            >
              {micState === 'transcribing' ? '···' : micState === 'recording' ? '⏹' : '🎙'}
            </button>

            {/* Text input */}
            <input
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                micState === 'recording' ? 'Écoute en cours…' :
                micState === 'transcribing' ? 'Transcription…' :
                'Écris ou parle…'
              }
              disabled={micState !== 'idle'}
              style={{
                flex: 1, background: 'var(--surface-2)',
                border: '1px solid var(--border)', borderRadius: 20,
                padding: '7px 14px', fontSize: 13,
                color: 'var(--text)', outline: 'none',
                opacity: micState !== 'idle' ? 0.6 : 1,
              }}
            />

            {/* Send button */}
            <button
              onClick={() => sendToAgent(inputText)}
              disabled={!inputText.trim() || micState !== 'idle'}
              title="Envoyer"
              style={{
                flexShrink: 0,
                width: 34, height: 34, borderRadius: '50%',
                background: inputText.trim() && micState === 'idle' ? 'var(--accent)' : 'var(--surface-2)',
                border: '1.5px solid var(--border)',
                color: inputText.trim() && micState === 'idle' ? 'white' : 'var(--text-muted)',
                fontSize: 14, cursor: inputText.trim() && micState === 'idle' ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function LoadingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'var(--text-muted)',
          animation: `pulse 1s ease-in-out ${i * 0.2}s infinite`,
          display: 'inline-block',
        }} />
      ))}
    </span>
  );
}
