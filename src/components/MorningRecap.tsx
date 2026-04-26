import { useEffect, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import type { Prospect } from '../types';
import { tsToDate, daysSince } from '../types';

const RECAP_KEY = 'morningRecapDate';

export default function MorningRecap({ ready }: { ready: boolean }) {
  const { morningRecap, plan } = useTheme();
  const { user } = useAuth();
  const blobUrlRef = useRef<string | null>(null);
  const readyRef = useRef(ready);
  const preparedRef = useRef(false);

  // Garde readyRef à jour
  useEffect(() => { readyRef.current = ready; }, [ready]);

  // Prépare l'audio dès que les conditions sont remplies
  useEffect(() => {
    if (!morningRecap || plan !== 'setup' || !user) return;
    if (preparedRef.current) return;
    if (localStorage.getItem(RECAP_KEY) === new Date().toDateString()) return;

    preparedRef.current = true;

    (async () => {
      try {
        const firstName = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || '';
        const snap = await getDocs(collection(db, 'users', user.uid, 'prospects'));
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

        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: parts.join(' ') }),
        });
        if (!res.ok) return;

        const blob = await res.blob();
        blobUrlRef.current = URL.createObjectURL(blob);

        // Joue immédiatement si splash déjà fermé, sinon attend
        if (readyRef.current) playAudio();
      } catch { /* silencieux */ }
    })();
  }, [morningRecap, plan, user]);

  // Joue dès que splash fermé, si audio prêt
  useEffect(() => {
    if (ready && blobUrlRef.current) playAudio();
  }, [ready]);

  const playAudio = () => {
    const url = blobUrlRef.current;
    if (!url) return;
    blobUrlRef.current = null; // évite double play
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play().catch(() => {});
    localStorage.setItem(RECAP_KEY, new Date().toDateString());
  };

  return null;
}
