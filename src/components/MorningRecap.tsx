import { useEffect, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import type { Prospect } from '../types';
import { tsToDate, daysSince } from '../types';

const RECAP_KEY = 'morningRecapDate';
const LOG = (...args: unknown[]) => console.log('[MorningRecap]', ...args);

// Unlock audio context on first user interaction so audio.play() works without a direct gesture
function unlockAudio() {
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  ctx.resume().then(() => ctx.close());
}

export default function MorningRecap({ ready }: { ready: boolean }) {
  const { morningRecap, plan } = useTheme();
  const { user } = useAuth();
  const blobUrlRef = useRef<string | null>(null);
  const readyRef = useRef(ready);

  LOG('render', { morningRecap, plan, user: user?.uid, ready });

  // Unlock audio on the very first user interaction (e.g. clicking the splash screen)
  useEffect(() => {
    const handler = () => { unlockAudio(); };
    document.addEventListener('click', handler, { once: true });
    document.addEventListener('touchend', handler, { once: true });
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('touchend', handler);
    };
  }, []);

  useEffect(() => { readyRef.current = ready; }, [ready]);

  useEffect(() => {
    LOG('effect fired', { morningRecap, plan, user: user?.uid });

    if (!morningRecap) { LOG('skip: morningRecap off'); return; }
    if (plan !== 'setup') { LOG('skip: plan =', plan); return; }
    if (!user) { LOG('skip: no user'); return; }

    const stored = localStorage.getItem(RECAP_KEY);
    const today = new Date().toDateString();
    if (stored === today) { LOG('skip: already played today', stored); return; }

    LOG('starting fetch…');
    let active = true;

    (async () => {
      try {
        const firstName = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || '';
        const snap = await getDocs(collection(db, 'users', user.uid, 'prospects'));
        if (!active) { LOG('cancelled after Firestore'); return; }

        LOG('got', snap.docs.length, 'prospects');

        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Prospect));
        const midnight = new Date(); midnight.setHours(0, 0, 0, 0);

        const reminders = all.filter(p => {
          if (!p.reminderDate) return false;
          const d = tsToDate(p.reminderDate); d.setHours(0, 0, 0, 0);
          return d.getTime() === midnight.getTime();
        });
        const inactive = all
          .filter(p => p.status !== 'signé' && p.status !== 'perdu' && daysSince(tsToDate(p.lastContact)) >= 7)
          .sort((a, b) => daysSince(tsToDate(b.lastContact)) - daysSince(tsToDate(a.lastContact)));
        const devis = all.filter(p => p.status === 'devis');
        const signed = all.filter(p => p.status === 'signé');
        const inProgress = all.filter(p => p.status === 'nouveau' || p.status === 'contacté');
        const totalCA = signed.reduce((s, p) => s + (p.amount || 0), 0);
        const potentialCA = devis.reduce((s, p) => s + (p.amount || 0), 0);

        const hour = new Date().getHours();
        const parts: string[] = [];

        parts.push(`${hour < 12 ? 'Bonjour' : 'Bonsoir'} ${firstName} ! Voici ton récap du ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.`);

        if (reminders.length > 0)
          parts.push(`Tu as ${reminders.length} rappel${reminders.length > 1 ? 's' : ''} aujourd'hui : ${reminders.map(p => p.name).join(', ')}.`);
        else
          parts.push("Aucun rappel prévu aujourd'hui.");

        if (devis.length > 0) {
          const names = devis.slice(0, 3).map(p => `${p.name}${p.amount ? ' pour ' + p.amount.toLocaleString('fr-FR') + ' euros' : ''}`).join(', ');
          parts.push(`${devis.length} devis en attente${potentialCA > 0 ? ', soit ' + potentialCA.toLocaleString('fr-FR') + ' euros potentiels' : ''} : ${names}.`);
        }

        if (inactive.length > 0) {
          const top = inactive.slice(0, 2).map(p => `${p.name}, ${daysSince(tsToDate(p.lastContact))} jours`).join(' et ');
          parts.push(`${inactive.length} prospect${inactive.length > 1 ? 's' : ''} sans contact depuis plus de 7 jours. Les plus urgents : ${top}.`);
        }

        if (inProgress.length > 0)
          parts.push(`${inProgress.length} prospect${inProgress.length > 1 ? 's' : ''} en cours de traitement.`);

        if (totalCA > 0)
          parts.push(`Chiffre d'affaires signé : ${totalCA.toLocaleString('fr-FR')} euros.`);

        parts.push('Bonne journée, tu vas cartonner !');

        const text = parts.join(' ');
        LOG('calling /api/tts, text length =', text.length);

        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        LOG('/api/tts response:', res.status, res.ok);
        if (!active) { LOG('cancelled after TTS fetch'); return; }
        if (!res.ok) {
          const errText = await res.text();
          LOG('TTS error body:', errText);
          return;
        }

        const blob = await res.blob();
        LOG('blob size:', blob.size, 'type:', blob.type);
        if (!active) return;

        blobUrlRef.current = URL.createObjectURL(blob);
        LOG('audio ready, readyRef =', readyRef.current);
        if (readyRef.current) playAudio();
      } catch (e) {
        LOG('caught error:', e);
      }
    })();

    return () => { LOG('cleanup — cancelling'); active = false; };
  }, [morningRecap, plan, user]);

  useEffect(() => {
    LOG('ready effect', { ready, hasBlobUrl: !!blobUrlRef.current });
    if (ready && blobUrlRef.current) playAudio();
  }, [ready]);

  const playAudio = () => {
    const url = blobUrlRef.current;
    LOG('playAudio called, url =', url ? 'set' : 'null');
    if (!url) return;
    blobUrlRef.current = null;
    localStorage.setItem(RECAP_KEY, new Date().toDateString());
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play()
      .then(() => LOG('audio playing'))
      .catch(e => LOG('audio.play() failed:', e));
  };

  return null;
}
