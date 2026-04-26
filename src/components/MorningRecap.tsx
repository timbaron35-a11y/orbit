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
        const greeting = hour < 12 ? 'Bonjour' : 'Bonsoir';
        const parts: string[] = [];

        parts.push(`${greeting} ${firstName ? firstName + ' !' : '!'} Voici ton récap du ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}.`);

        // Rappels du jour
        if (remindersToday.length > 0) {
          const names = remindersToday.map(p => p.name).join(', ');
          parts.push(`Tu as ${remindersToday.length} rappel${remindersToday.length > 1 ? 's' : ''} prévu${remindersToday.length > 1 ? 's' : ''} aujourd'hui : ${names}.`);
        } else {
          parts.push("Aucun rappel prévu aujourd'hui.");
        }

        // Devis en cours
        if (hotDeals.length > 0) {
          const names = hotDeals.slice(0, 3).map(p =>
            `${p.name}${p.amount ? ' pour ' + p.amount.toLocaleString('fr-FR') + ' euros' : ''}`
          ).join(', ');
          parts.push(`${hotDeals.length} devis en attente de réponse${potentialCA > 0 ? ', soit ' + potentialCA.toLocaleString('fr-FR') + ' euros de CA potentiel' : ''} : ${names}.`);
        }

        // Prospects inactifs
        if (inactive.length > 0) {
          const urgents = inactive.sort((a, b) => daysSince(tsToDate(b.lastContact)) - daysSince(tsToDate(a.lastContact)));
          const top = urgents.slice(0, 2).map(p => `${p.name} (${daysSince(tsToDate(p.lastContact))} jours)`).join(' et ');
          parts.push(`${inactive.length} prospect${inactive.length > 1 ? 's' : ''} n'ont pas été contactés depuis plus de 7 jours. Les plus urgents : ${top}.`);
        }

        // Pipeline global
        if (inProgress.length > 0) {
          parts.push(`Tu as ${inProgress.length} prospect${inProgress.length > 1 ? 's' : ''} en cours de traitement.`);
        }

        // CA
        if (totalCA > 0) {
          parts.push(`Ton chiffre d'affaires signé est de ${totalCA.toLocaleString('fr-FR')} euros.`);
        }

        parts.push('Bonne journée, tu vas cartonner !');

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
