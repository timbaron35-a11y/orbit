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

  const audioBlobUrl = useRef<string | null>(null);
  const fetchDone = useRef(false);
  const played = useRef(false);
  const readyRef = useRef(false);

  // Étape 1 — dès que les conditions sont connues, on prépare l'audio en arrière-plan
  useEffect(() => {
    if (!morningRecap || plan !== 'setup' || !user || fetchDone.current) return;
    if (localStorage.getItem(RECAP_KEY) === new Date().toDateString()) return;

    fetchDone.current = true;

    const prepare = async () => {
      try {
        const firstName = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || '';
        const snap = await getDocs(collection(db, 'users', user.uid, 'prospects'));
        const prospects = snap.docs.map(d => ({ id: d.id, ...d.data() } as Prospect));

        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);

        const remindersToday = prospects.filter(p => {
          if (!p.reminderDate) return false;
          const d = tsToDate(p.reminderDate);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === todayMidnight.getTime();
        });

        const inactive = prospects.filter(p =>
          p.status !== 'signé' && p.status !== 'perdu' &&
          daysSince(tsToDate(p.lastContact)) >= 7
        );

        const hotDeals = prospects.filter(p => p.status === 'devis');
        const signed = prospects.filter(p => p.status === 'signé');
        const inProgress = prospects.filter(p => p.status === 'nouveau' || p.status === 'contacté');
        const totalCA = signed.reduce((s, p) => s + (p.amount || 0), 0);
        const potentialCA = hotDeals.reduce((s, p) => s + (p.amount || 0), 0);

        const hour = new Date().getHours();
        const parts: string[] = [];

        parts.push(`${hour < 12 ? 'Bonjour' : 'Bonsoir'} ${firstName ? firstName + ' !' : '!'} Voici ton récap du ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.`);

        if (remindersToday.length > 0) {
          const names = remindersToday.map(p => p.name).join(', ');
          parts.push(`Tu as ${remindersToday.length} rappel${remindersToday.length > 1 ? 's' : ''} aujourd'hui : ${names}.`);
        } else {
          parts.push("Aucun rappel prévu aujourd'hui.");
        }

        if (hotDeals.length > 0) {
          const names = hotDeals.slice(0, 3).map(p =>
            `${p.name}${p.amount ? ' pour ' + p.amount.toLocaleString('fr-FR') + ' euros' : ''}`
          ).join(', ');
          parts.push(`${hotDeals.length} devis en attente${potentialCA > 0 ? ', soit ' + potentialCA.toLocaleString('fr-FR') + ' euros potentiels' : ''} : ${names}.`);
        }

        if (inactive.length > 0) {
          const top = inactive
            .sort((a, b) => daysSince(tsToDate(b.lastContact)) - daysSince(tsToDate(a.lastContact)))
            .slice(0, 2)
            .map(p => `${p.name}, ${daysSince(tsToDate(p.lastContact))} jours`)
            .join(' et ');
          parts.push(`${inactive.length} prospect${inactive.length > 1 ? 's' : ''} sans contact depuis plus de 7 jours. Les plus urgents : ${top}.`);
        }

        if (inProgress.length > 0) {
          parts.push(`${inProgress.length} prospect${inProgress.length > 1 ? 's' : ''} en cours.`);
        }

        if (totalCA > 0) {
          parts.push(`CA signé : ${totalCA.toLocaleString('fr-FR')} euros.`);
        }

        parts.push('Bonne journée, tu vas cartonner !');

        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: parts.join(' ') }),
        });
        if (!res.ok) return;

        const blob = await res.blob();
        audioBlobUrl.current = URL.createObjectURL(blob);

        // Si le splash est déjà fini, on joue immédiatement
        if (readyRef.current) playAudio();
      } catch { /* silencieux */ }
    };

    prepare();
  }, [morningRecap, plan, user]);

  // Étape 2 — dès que le splash est fermé, on joue (si l'audio est prêt)
  useEffect(() => {
    if (!ready) return;
    readyRef.current = true;
    if (audioBlobUrl.current) playAudio();
  }, [ready]);

  const playAudio = () => {
    if (played.current || !audioBlobUrl.current) return;
    played.current = true;
    const audio = new Audio(audioBlobUrl.current);
    audio.onended = () => {
      URL.revokeObjectURL(audioBlobUrl.current!);
      audioBlobUrl.current = null;
    };
    audio.play().catch(() => {});
    localStorage.setItem(RECAP_KEY, new Date().toDateString());
  };

  return null;
}
