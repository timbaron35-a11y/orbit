import { useEffect, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useTheme } from '../contexts/ThemeContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { Prospect } from '../types';
import { tsToDate, daysSince } from '../types';

const RECAP_KEY = 'morningRecapDate';

export default function MorningRecap() {
  const { morningRecap, plan } = useTheme();
  const { workspaceUid } = useWorkspace();
  const doneRef = useRef(false);

  useEffect(() => {
    if (!morningRecap || plan !== 'setup' || !workspaceUid || doneRef.current) return;

    const today = new Date().toDateString();
    if (localStorage.getItem(RECAP_KEY) === today) return;

    doneRef.current = true;

    const run = async () => {
      try {
        const snap = await getDocs(collection(db, 'users', workspaceUid, 'prospects'));
        const prospects = snap.docs.map(d => ({ id: d.id, ...d.data() } as Prospect));

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const remindersToday = prospects.filter(p => {
          if (!p.reminderDate) return false;
          const d = tsToDate(p.reminderDate);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === today.getTime();
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
        const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bonsoir' : 'Bonsoir';
        parts.push(`${greeting} ! Voici ton récap du jour.`);

        if (remindersToday.length > 0) {
          const names = remindersToday.slice(0, 3).map(p => p.name).join(', ');
          parts.push(`Tu as ${remindersToday.length} rappel${remindersToday.length > 1 ? 's' : ''} aujourd'hui : ${names}.`);
        } else {
          parts.push("Aucun rappel prévu aujourd'hui.");
        }

        if (hotDeals.length > 0) {
          parts.push(`${hotDeals.length} devis en attente de réponse.`);
        }

        if (inactive.length > 0) {
          parts.push(`${inactive.length} prospect${inactive.length > 1 ? 's' : ''} sans contact depuis plus de 7 jours.`);
        }

        if (totalCA > 0) {
          parts.push(`Ton chiffre d'affaires signé est de ${totalCA.toLocaleString('fr-FR')} euros.`);
        }

        parts.push('Bonne journée !');

        const text = parts.join(' ');

        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) return;

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        audio.play();

        localStorage.setItem(RECAP_KEY, new Date().toDateString());
      } catch { /* silencieux */ }
    };

    // Délai pour laisser l'app se charger
    const t = setTimeout(run, 2000);
    return () => clearTimeout(t);
  }, [morningRecap, plan, workspaceUid]);

  return null;
}
