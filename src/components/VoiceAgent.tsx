import { useState, useRef, useEffect, useCallback } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, Timestamp } from 'firebase/firestore';
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

const SUGGESTIONS = [
  'Qui n\'a pas été contacté depuis 7 jours ?',
  'Quel est mon CA signé ce mois ?',
  'Liste mes devis en cours',
  'Crée un nouveau prospect',
];

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
  const [audioLevel, setAudioLevel] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [wakeReady, setWakeReady] = useState(false);
  const wakeRef = useRef<any>(null);

  const { workspaceUid } = useWorkspace();
  const { plan, agentVocalOnly } = useTheme();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vadFrameRef = useRef<number | null>(null);
  const lastAudioUpdateRef = useRef(0);

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
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(s => { streamRef.current = s; })
        .catch(() => {});
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, [open]);

  // Wake word "orbit"
  useEffect(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const sr: any = new SR();
    sr.lang = 'fr-FR';
    sr.continuous = true;
    sr.interimResults = true;
    wakeRef.current = sr;

    sr.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.toLowerCase();
        if (t.includes('orbit') && micState === 'idle') {
          sr.stop();
          setOpen(true);
          setTimeout(() => startRecording(), 300);
          return;
        }
      }
    };
    // Redémarre automatiquement si ça s'arrête
    sr.onend = () => {
      if (wakeRef.current === sr) {
        try { sr.start(); } catch { /* already started */ }
      }
    };
    sr.onerror = (e: any) => {
      if (e.error === 'not-allowed') { setWakeReady(false); return; }
    };

    try {
      sr.start();
      setWakeReady(true);
    } catch { /* pas de micro */ }

    return () => {
      wakeRef.current = null;
      sr.onend = null;
      try { sr.stop(); } catch { /* ok */ }
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
      streamRef.current?.getTracks().forEach(t => t.stop());
      stopVAD();
    };
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startRecordingRef = useRef<() => void>(() => {});

  const speak = useCallback(async (text: string) => {
    if (!ttsEnabled) return;
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        // Boucle conversationnelle : écoute auto après la réponse
        setTimeout(() => startRecordingRef.current(), 600);
      };
      audio.play();
    } catch { /* silencieux */ }
  }, [ttsEnabled]); // startRecording ajouté après

  const restartWakeWord = () => {
    const sr = wakeRef.current;
    if (!sr) return;
    sr.onend = () => { if (wakeRef.current === sr) { try { sr.start(); } catch { /* ok */ } } };
    try { sr.start(); } catch { /* ok */ }
  };

  const stopVAD = () => {
    if (vadFrameRef.current) cancelAnimationFrame(vadFrameRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setAudioLevel(0);
  };

  const startVAD = (stream: MediaStream, onSilence: () => void) => {
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.5;
    ctx.createMediaStreamSource(stream).connect(analyser);
    audioCtxRef.current = ctx;

    const data = new Uint8Array(analyser.frequencyBinCount);
    let speechDetected = false;

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;

      const now = Date.now();
      if (now - lastAudioUpdateRef.current > 40) {
        setAudioLevel(Math.min(avg / 35, 1));
        lastAudioUpdateRef.current = now;
      }

      if (avg > 8) {
        speechDetected = true;
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      } else if (speechDetected && !silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(onSilence, 1200);
      }

      vadFrameRef.current = requestAnimationFrame(tick);
    };
    vadFrameRef.current = requestAnimationFrame(tick);
  };

  const executeAction = useCallback(async (action: { type: string; args: Record<string, unknown> }) => {
    if (!workspaceUid) return;
    const col = collection(db, 'users', workspaceUid, 'prospects');

    if (action.type === 'update_prospect_status') {
      const { id, status } = action.args as { id: string; status: ProspectStatus };
      await updateDoc(doc(col, id), { status, lastContact: Timestamp.now() });

    } else if (action.type === 'update_prospect_amount') {
      const { id, amount } = action.args as { id: string; amount: number };
      await updateDoc(doc(col, id), { amount });

    } else if (action.type === 'add_note') {
      const { id, note } = action.args as { id: string; note: string };
      await updateDoc(doc(col, id), { notes: note, lastContact: Timestamp.now() });

    } else if (action.type === 'delete_prospect') {
      const { id } = action.args as { id: string };
      await deleteDoc(doc(col, id));

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

  const sendToAgent = useCallback(async (text: string) => {
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
      const reply = message ?? '';
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { role: 'agent', text: reply } : m
      ));
      speak(reply);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 ? { role: 'agent', text: `⚠️ ${msg}` } : m
      ));
    }
  }, [prospects, executeAction]);

  const startRecording = async () => {
    // Pause wake word pour éviter le conflit micro
    if (wakeRef.current) {
      wakeRef.current.onend = null;
      try { wakeRef.current.stop(); } catch { /* ok */ }
    }
    setMicState('recording');
    try {
      // Libère le stream pré-acquis s'il existe, on en prend un propre
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(100);
      mediaRecorderRef.current = mr;
      startVAD(stream, stopRecording);
    } catch {
      setMicState('idle');
      restartWakeWord();
    }
  };

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    stopVAD();
    setMicState('transcribing');
    mediaRecorderRef.current.onstop = async () => {
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
        restartWakeWord();
        await sendToAgent(transcript);
      } catch {
        setMicState('idle');
        restartWakeWord();
      }
    };
    mediaRecorderRef.current.stop();
  }, [sendToAgent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToAgent(inputText); }
  };

  // Toujours à jour pour éviter stale closure dans speak()
  startRecordingRef.current = startRecording;

  if (plan !== 'setup') return null;

  const isRecording = micState === 'recording';
  const isTranscribing = micState === 'transcribing';
  const isBusy = micState !== 'idle';
  const canSend = !!inputText.trim() && !isBusy;
  const orbScale = 1 + audioLevel * 0.45;

  return (
    <>
      {/* Compact recording / transcribing bubble */}
      {(isRecording || isTranscribing) && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 950,
          width: 220,
          background: 'linear-gradient(160deg, #1a1525 0%, #131013 100%)',
          border: '1px solid rgba(124,92,252,0.25)',
          borderRadius: 20,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          padding: '20px 16px 16px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          animation: 'agentSlideUp 0.2s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          {/* Orb */}
          <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isRecording && [1.5, 1.25].map((s, i) => (
              <div key={i} style={{
                position: 'absolute', width: 60, height: 60, borderRadius: '50%',
                background: `rgba(124,92,252,${0.06 + i * 0.04})`,
                transform: `scale(${s * (1 + audioLevel * 0.2)})`,
                transition: 'transform 0.07s ease',
              }} />
            ))}
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: isTranscribing
                ? 'linear-gradient(135deg, rgba(124,92,252,0.3), rgba(124,92,252,0.1))'
                : 'linear-gradient(135deg, #7c5cfc, #4f35b8)',
              boxShadow: isRecording
                ? `0 0 ${16 + audioLevel * 24}px ${4 + audioLevel * 10}px rgba(124,92,252,${0.3 + audioLevel * 0.35})`
                : '0 0 20px 4px rgba(124,92,252,0.2)',
              transform: isRecording ? `scale(${orbScale})` : 'scale(1)',
              transition: 'transform 0.06s ease, box-shadow 0.06s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
              animation: isTranscribing ? 'agentGlow 1.5s ease-in-out infinite' : 'none',
            }}>
              ✦
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#e5e5e5', margin: 0 }}>
              {isTranscribing ? 'Transcription…' : 'Je t\'écoute…'}
            </p>
            {isRecording && (
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '3px 0 0' }}>
                silence → envoi auto
              </p>
            )}
            {isTranscribing && <ThinkingDots color="rgba(124,92,252,0.7)" />}
          </div>

          {isRecording && (
            <button
              onClick={stopRecording}
              style={{
                padding: '6px 18px', borderRadius: 100,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)', fontSize: 11.5, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.12)'; el.style.color = '#fff'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.06)'; el.style.color = 'rgba(255,255,255,0.5)'; }}
            >
              Envoyer maintenant
            </button>
          )}
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 900,
          width: 380,
          background: 'linear-gradient(160deg, #1a1525 0%, #131013 100%)',
          border: '1px solid rgba(124,92,252,0.18)',
          borderRadius: 22,
          boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,92,252,0.06)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'agentSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 18px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'linear-gradient(135deg, rgba(124,92,252,0.1) 0%, transparent 100%)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              background: 'linear-gradient(135deg, #7c5cfc, #4f35b8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
              boxShadow: '0 4px 16px rgba(124,92,252,0.5)',
            }}>
              ✦
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.2px' }}>
                Assistant CRM
              </div>
              <div style={{ fontSize: 11, color: 'rgba(124,92,252,0.9)', fontWeight: 500, marginTop: 1 }}>
                Plan Setup · Toujours en ligne
              </div>
            </div>
            <button
              onClick={() => { setTtsEnabled(v => !v); window.speechSynthesis.cancel(); }}
              title={ttsEnabled ? 'Désactiver la voix' : 'Activer la voix'}
              style={{
                width: 26, height: 26, borderRadius: 7,
                background: ttsEnabled ? 'rgba(124,92,252,0.15)' : 'transparent',
                border: `1px solid ${ttsEnabled ? 'rgba(124,92,252,0.3)' : 'rgba(255,255,255,0.08)'}`,
                color: ttsEnabled ? '#a78bfa' : '#555', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.75'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              🔊
            </button>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                title="Effacer"
                style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#555', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e5e5e5'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
              >
                ⌫
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              style={{
                width: 26, height: 26, borderRadius: 7,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                color: '#555', fontSize: 15, cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e5e5e5'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#555'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div style={{
            overflowY: 'auto', padding: '16px 16px 8px',
            display: 'flex', flexDirection: 'column', gap: 10,
            minHeight: 220, maxHeight: 360,
          }}>
            {messages.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '8px 0' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 20, margin: '0 auto 12px',
                    background: 'linear-gradient(135deg, rgba(124,92,252,0.25), rgba(124,92,252,0.05))',
                    border: '1px solid rgba(124,92,252,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                  }}>✦</div>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: '#e5e5e5', marginBottom: 4 }}>
                    Bonjour, que puis-je faire ?
                  </p>
                  <p style={{ fontSize: 12, color: '#3d3d3d' }}>
                    Voix ou texte — je m'occupe du reste
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => sendToAgent(s)}
                      style={{
                        textAlign: 'left', padding: '9px 14px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        color: '#999', fontSize: 12.5, cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = 'rgba(124,92,252,0.1)';
                        el.style.borderColor = 'rgba(124,92,252,0.3)';
                        el.style.color = '#c4b5fd';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = 'rgba(255,255,255,0.04)';
                        el.style.borderColor = 'rgba(255,255,255,0.07)';
                        el.style.color = '#999';
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                  {m.role === 'agent' && (
                    <div style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: 'linear-gradient(135deg, #7c5cfc, #4f35b8)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11,
                    }}>✦</div>
                  )}
                  <div style={{
                    maxWidth: '80%', padding: '10px 14px',
                    borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    fontSize: 13, lineHeight: 1.6,
                    ...(m.role === 'user' ? {
                      background: 'linear-gradient(135deg, #7c5cfc, #4f35b8)',
                      color: 'white',
                      boxShadow: '0 4px 16px rgba(124,92,252,0.25)',
                    } : {
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: agentVocalOnly && !m.loading ? 'rgba(255,255,255,0.25)' : '#d4d4d4',
                      fontStyle: agentVocalOnly && !m.loading ? 'italic' : 'normal',
                    }),
                  }}>
                    {m.loading ? <ThinkingDots color="#7c5cfc" /> : agentVocalOnly && m.role === 'agent' ? '🔊 Réponse vocale' : m.text}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div style={{
            padding: '12px 14px 14px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <button
              onClick={startRecording}
              disabled={isBusy}
              title="Parler"
              style={{
                flexShrink: 0, width: 38, height: 38, borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(124,92,252,0.15), rgba(124,92,252,0.05))',
                border: '1px solid rgba(124,92,252,0.25)',
                color: '#7c5cfc', fontSize: 16,
                cursor: isBusy ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
                opacity: isBusy ? 0.4 : 1,
              }}
              onMouseEnter={e => { if (!isBusy) { const el = e.currentTarget as HTMLElement; el.style.background = 'linear-gradient(135deg, rgba(124,92,252,0.3), rgba(124,92,252,0.1))'; el.style.transform = 'scale(1.06)'; } }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'linear-gradient(135deg, rgba(124,92,252,0.15), rgba(124,92,252,0.05))'; el.style.transform = 'scale(1)'; }}
            >
              🎙
            </button>

            <input
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message…"
              disabled={isBusy}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, padding: '9px 14px',
                fontSize: 13, color: '#e5e5e5', outline: 'none',
                transition: 'border-color 0.15s',
                opacity: isBusy ? 0.4 : 1,
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(124,92,252,0.4)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            />

            <button
              onClick={() => sendToAgent(inputText)}
              disabled={!canSend}
              style={{
                flexShrink: 0, width: 38, height: 38, borderRadius: 12,
                background: canSend ? 'linear-gradient(135deg, #7c5cfc, #4f35b8)' : 'rgba(255,255,255,0.04)',
                border: 'none',
                color: canSend ? 'white' : '#2a2a2a',
                fontSize: 16, cursor: canSend ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
                boxShadow: canSend ? '0 4px 14px rgba(124,92,252,0.4)' : 'none',
              }}
              onMouseEnter={e => { if (canSend) { const el = e.currentTarget as HTMLElement; el.style.transform = 'scale(1.06)'; el.style.boxShadow = '0 6px 20px rgba(124,92,252,0.55)'; } }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'scale(1)'; el.style.boxShadow = canSend ? '0 4px 14px rgba(124,92,252,0.4)' : 'none'; }}
            >
              ↑
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 901 }}>
        {!open && !isRecording && (
          <div style={{
            position: 'absolute', inset: -8, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,92,252,0.15) 0%, transparent 70%)',
            animation: 'agentGlow 3s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        )}
        {/* Indicateur wake word actif */}
        {wakeReady && !open && !isRecording && (
          <div title='Dis "Orbit" pour activer' style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 12, height: 12, borderRadius: '50%',
            background: '#22c55e',
            border: '2px solid #0f0f0f',
            animation: 'pulse 3s ease-in-out infinite',
          }} />
        )}
        <button
          onClick={() => setOpen(o => !o)}
          onMouseEnter={() => setFabHover(true)}
          onMouseLeave={() => setFabHover(false)}
          title="Assistant IA"
          style={{
            width: 54, height: 54, borderRadius: '50%',
            background: 'linear-gradient(135deg, #7c5cfc 0%, #5b3fd4 100%)',
            border: 'none', color: 'white', fontSize: 22,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s',
            transform: fabHover ? 'scale(1.13) translateY(-3px)' : 'scale(1)',
            boxShadow: fabHover
              ? '0 10px 32px rgba(124,92,252,0.65)'
              : '0 4px 20px rgba(124,92,252,0.45)',
          }}
        >
          <span style={{
            display: 'inline-block',
            transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            transform: open ? 'rotate(45deg) scale(0.85)' : 'rotate(0deg) scale(1)',
          }}>
            {open ? '+' : '✦'}
          </span>
        </button>
      </div>
    </>
  );
}

function ThinkingDots({ color = '#e5e5e5' }: { color?: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: color, display: 'inline-block',
          animation: `agentDot 1.3s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </span>
  );
}
