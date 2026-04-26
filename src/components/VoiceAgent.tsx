import { useState, useRef, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { Prospect, ProspectStatus } from '../types';
import { tsToDate, daysSince } from '../types';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useTheme } from '../contexts/ThemeContext';

type AgentState = 'idle' | 'recording' | 'thinking' | 'error';

interface AgentMessage {
  role: 'user' | 'agent';
  text: string;
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
  const [state, setState] = useState<AgentState>('idle');
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [error, setError] = useState('');

  const { workspaceUid } = useWorkspace();
  const { plan } = useTheme();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    return () => { mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop()); };
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
      setState('recording');
    } catch {
      setError('Accès au micro refusé.');
      setState('error');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.onstop = async () => {
      mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
      const mimeType = mediaRecorderRef.current?.mimeType ?? 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      await processVoice(blob, mimeType);
    };
    mediaRecorderRef.current.stop();
    setState('thinking');
  };

  const processVoice = async (blob: Blob, mimeType: string) => {
    try {
      const base64 = await blobToBase64(blob);
      const tRes = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, mimeType }),
      });
      if (!tRes.ok) throw new Error(await tRes.text());
      const { transcript } = await tRes.json();

      setMessages(prev => [...prev, { role: 'user', text: transcript }]);

      const signed = prospects.filter(p => p.status === 'signé');
      const totalCA = signed.reduce((s, p) => s + (p.amount || 0), 0);
      const stats = { totalCA, signedCount: signed.length, prospectCount: prospects.length };

      const agentProspects = prospects.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        amount: p.amount || 0,
        email: p.email,
        company: p.company,
        daysSinceContact: daysSince(tsToDate(p.lastContact)),
      }));

      const aRes = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, prospects: agentProspects, stats }),
      });
      if (!aRes.ok) throw new Error(await aRes.text());
      const { message, action } = await aRes.json();

      if (action) await executeAction(action);
      setMessages(prev => [...prev, { role: 'agent', text: message ?? '' }]);
      setState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setState('error');
    }
  };

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
        name,
        email: email ?? '',
        company: company ?? '',
        amount: amount ?? 0,
        status: status ?? 'nouveau',
        notes: '',
        lastContact: Timestamp.now(),
        createdAt: Timestamp.now(),
      });
    }
  }, [workspaceUid]);

  const handleMicClick = () => {
    if (state === 'idle') startRecording();
    else if (state === 'recording') stopRecording();
    else if (state === 'error') { setState('idle'); setError(''); }
  };

  const isPremium = plan === 'setup';
  const micColor = state === 'recording' ? '#ef4444' : 'var(--accent)';
  const micLabel = state === 'recording' ? '⏹' : state === 'thinking' ? '…' : '🎙';

  if (!isPremium) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => { setOpen(o => !o); }}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 900,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--accent)', border: 'none',
          color: 'white', fontSize: 22, cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(124,92,252,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.15s',
        }}
        title="Assistant IA"
      >
        🤖
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 900,
          width: 320, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>🤖</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>Assistant CRM</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: '0 2px' }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 10,
            minHeight: 160, maxHeight: 260,
          }}>
            {messages.length === 0 && (
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', margin: 'auto' }}>
                Appuie sur le micro et parle à ton CRM.<br />
                <span style={{ fontSize: 11.5 }}>Ex : "Mets Dupont en devis" ou "Crée un prospect Martin"</span>
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: m.role === 'user' ? 'var(--accent)' : 'var(--surface-2)',
                color: m.role === 'user' ? 'white' : 'var(--text)',
                padding: '8px 12px', borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                fontSize: 13, lineHeight: 1.5,
              }}>
                {m.text}
              </div>
            ))}
            {state === 'thinking' && (
              <div style={{
                alignSelf: 'flex-start',
                background: 'var(--surface-2)', padding: '8px 14px',
                borderRadius: '12px 12px 12px 2px', fontSize: 18,
                animation: 'pulse 1s ease-in-out infinite',
              }}>
                ···
              </div>
            )}
            {error && (
              <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Mic */}
          <div style={{
            padding: '12px 16px', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            {state === 'recording' && (
              <span style={{ fontSize: 11.5, color: '#ef4444', animation: 'pulse 1s ease-in-out infinite' }}>
                ● Écoute en cours…
              </span>
            )}
            <button
              onClick={handleMicClick}
              disabled={state === 'thinking'}
              style={{
                width: 46, height: 46, borderRadius: '50%',
                background: state === 'recording' ? 'rgba(239,68,68,0.1)' : 'var(--accent-dim)',
                border: `2px solid ${micColor}`,
                color: micColor, fontSize: state === 'thinking' ? 16 : 20,
                cursor: state === 'thinking' ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              {micLabel}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
