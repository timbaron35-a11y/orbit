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
  const doneRef = useRef(false);

  useEffect(() => {
    if (!ready || !morningRecap || plan !== 'setup' || !user || doneRef.current) return;
    if (localStorage.getItem(RECAP_KEY) === new Date().toDateString()) return;

    doneRef.current = true;

    const play = async () => {
      try {
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
        const totalCA = signed.reduce((s, p) => s + (p.amount || 0), 0);

        const parts: string[] = [];
        const hour = new Date().getHours();
        parts.push(`${hour < 12 ? 'Bonjour' : 'Bonsoir'} ! Voici ton récap du jour.`);

        if (remindersToday.length > 0) {
          const names = remindersToday.slice(0, 3).map(p => p.name).join(', ');
          parts.push(`${remindersToday.length} rappel${remindersToday.length > 1 ? 's' : ''} aujourd'hui : ${names}.`);
        } else {
          parts.push("Aucun rappel prévu aujourd'hui.");
        }

        if (hotDeals.length > 0) parts.push(`${hotDeals.length} devis en attente de réponse.`);
        if (inactive.length > 0) parts.push(`${inactive.length} prospect${inactive.length > 1 ? 's' : ''} sans contact depuis plus de 7 jours.`);
        if (totalCA > 0) parts.push(`Chiffre d'affaires signé : ${totalCA.toLocaleString('fr-FR')} euros.`);
        parts.push('Bonne journée !');

        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: parts.join(' ') }),
        });
        if (!res.ok) return;

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play();

        localStorage.setItem(RECAP_KEY, new Date().toDateString());
      } catch { /* silencieux */ }
    };

    play();
  }, [ready, morningRecap, plan, user]);

  return null;
}
