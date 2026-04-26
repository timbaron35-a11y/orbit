import { Timestamp } from 'firebase/firestore';

// Convertit un Timestamp Firestore OU une string ISO en Date
export function tsToDate(ts: unknown): Date {
  if (!ts) return new Date();
  if (ts instanceof Timestamp) return ts.toDate();
  if (typeof ts === 'string') return new Date(ts);
  if (typeof ts === 'object' && 'toDate' in (ts as object)) return (ts as Timestamp).toDate();
  return new Date();
}

export type ProspectStatus = 'nouveau' | 'contacté' | 'devis' | 'signé' | 'perdu';

export interface Prospect {
  id: string;
  name: string;
  status: ProspectStatus;
  lastContact: Timestamp;
  amount: number;
  notes: string;
  reminderDate?: Timestamp;
  tags?: string[];
  email?: string;
  phone?: string;
  company?: string;
  createdByEmail?: string;
  assignedTo?: string;
}

export const STATUS_LABEL: Record<ProspectStatus, string> = {
  nouveau: 'Nouveau',
  contacté: 'Contacté',
  devis: 'Devis',
  signé: 'Signé',
  perdu: 'Perdu',
};

export const STATUS_COLOR: Record<ProspectStatus, string> = {
  nouveau: '#3b82f6',
  contacté: '#f59e0b',
  devis: '#a78bfa',
  signé: '#22c55e',
  perdu: '#ef4444',
};

export const STATUS_BG: Record<ProspectStatus, string> = {
  nouveau: 'rgba(59,130,246,0.12)',
  contacté: 'rgba(245,158,11,0.12)',
  devis: 'rgba(167,139,250,0.12)',
  signé: 'rgba(34,197,94,0.12)',
  perdu: 'rgba(239,68,68,0.12)',
};

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);

export const daysSince = (date: Date) => {
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
};
