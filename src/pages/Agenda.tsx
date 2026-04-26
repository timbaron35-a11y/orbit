import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, updateDoc, doc, deleteField, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { Prospect, ProspectStatus } from '../types';
import { STATUS_LABEL, STATUS_COLOR, STATUS_BG, formatCurrency } from '../types';
import { tsToDate } from '../types';

interface ReminderGroup { label: string; color: string; items: Prospect[]; }

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

function groupByDate(prospects: Prospect[]): ReminderGroup[] {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
  const overdue: Prospect[] = [], todayItems: Prospect[] = [], tomorrowItems: Prospect[] = [], thisWeek: Prospect[] = [], later: Prospect[] = [];
  for (const p of prospects) {
    if (!p.reminderDate) continue;
    const d = startOfDay(tsToDate(p.reminderDate));
    if (d < today) overdue.push(p);
    else if (d.getTime() === today.getTime()) todayItems.push(p);
    else if (d.getTime() === tomorrow.getTime()) tomorrowItems.push(p);
    else if (d <= weekEnd) thisWeek.push(p);
    else later.push(p);
  }
  const groups: ReminderGroup[] = [];
  if (overdue.length) groups.push({ label: 'En retard', color: '#ef4444', items: overdue });
  if (todayItems.length) groups.push({ label: "Aujourd'hui", color: '#f59e0b', items: todayItems });
  if (tomorrowItems.length) groups.push({ label: 'Demain', color: '#3b82f6', items: tomorrowItems });
  if (thisWeek.length) groups.push({ label: 'Cette semaine', color: 'var(--accent)', items: thisWeek });
  if (later.length) groups.push({ label: 'Plus tard', color: 'var(--text-muted)', items: later });
  return groups;
}

function formatReminderDate(d: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(d);
}

export default function Agenda() {
  const { user } = useAuth();
  const { workspaceUid } = useWorkspace();
  const navigate = useNavigate();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'users', workspaceUid, 'prospects'), snap => {
      setProspects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Prospect)).filter(p => p.reminderDate));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const handleDone = async (p: Prospect) => {
    if (!user) return;
    setDismissing(prev => new Set(prev).add(p.id));
    await updateDoc(doc(db, 'users', workspaceUid, 'prospects', p.id), { reminderDate: deleteField(), lastContact: Timestamp.now() });
    setDismissing(prev => { const s = new Set(prev); s.delete(p.id); return s; });
  };

  const handleSnooze = async (p: Prospect, days: number) => {
    if (!user) return;
    const next = new Date(); next.setDate(next.getDate() + days); next.setHours(12, 0, 0, 0);
    await updateDoc(doc(db, 'users', workspaceUid, 'prospects', p.id), { reminderDate: Timestamp.fromDate(next) });
  };

  const today = startOfDay(new Date());
  const overdueCount = prospects.filter(p => p.reminderDate && startOfDay(tsToDate(p.reminderDate)) < today).length;
  const todayCount = prospects.filter(p => p.reminderDate && startOfDay(tsToDate(p.reminderDate)).getTime() === today.getTime()).length;
  const upcomingCount = prospects.length - overdueCount - todayCount;
  const groups = groupByDate(prospects);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>Chargement…</div>;

  return (
    <div style={{ padding: '36px 40px', maxWidth: 780 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>Agenda</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 6 }}>
          {prospects.length === 0 ? 'Aucun rappel planifié.' : `${prospects.length} rappel${prospects.length > 1 ? 's' : ''} planifié${prospects.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Stat cards */}
      {prospects.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { value: overdueCount, label: 'En retard', color: '#ef4444', accent: 'rgba(239,68,68,0.7)' },
            { value: todayCount, label: "Aujourd'hui", color: '#f59e0b', accent: 'rgba(245,158,11,0.7)' },
            { value: upcomingCount, label: 'À venir', color: 'var(--accent)', accent: 'rgba(124,92,252,0.7)' },
          ].map(({ value, label, color, accent }) => value >= 0 ? (
            <div key={label} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent, borderRadius: '14px 14px 0 0', opacity: value > 0 ? 0.7 : 0.2 }} />
              <div style={{ fontSize: 28, fontWeight: 700, color: value > 0 ? color : 'var(--text-muted)', letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>{label}</div>
            </div>
          ) : null)}
        </div>
      )}

      {prospects.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '64px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 32, opacity: 0.15 }}>◷</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Aucun rappel planifié</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
            Ajoutez des rappels depuis les fiches prospects pour les retrouver ici.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {groups.map(group => (
            <div key={group.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: group.color, flexShrink: 0, boxShadow: `0 0 6px ${group.color}` }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: group.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{group.label}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{group.items.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.items.map(p => (
                  <ReminderCard
                    key={p.id}
                    prospect={p}
                    groupColor={group.color}
                    isDismissing={dismissing.has(p.id)}
                    onDone={() => handleDone(p)}
                    onSnooze={days => handleSnooze(p, days)}
                    onClick={() => navigate(`/clients/${p.id}`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReminderCard({ prospect: p, groupColor, isDismissing, onDone, onSnooze, onClick }: {
  prospect: Prospect; groupColor: string; isDismissing: boolean;
  onDone: () => void; onSnooze: (days: number) => void; onClick: () => void;
}) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `3px solid ${groupColor}`,
      borderRadius: 12, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 14,
      opacity: isDismissing ? 0.4 : 1, transition: 'opacity 0.2s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
    }}>
      {/* Avatar */}
      <div onClick={onClick} style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: `linear-gradient(135deg, ${STATUS_BG[p.status as ProspectStatus]}, ${STATUS_COLOR[p.status as ProspectStatus]}22)`,
        border: `1px solid ${STATUS_COLOR[p.status as ProspectStatus]}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: STATUS_COLOR[p.status as ProspectStatus],
        cursor: 'pointer',
      }}>
        {p.name.slice(0, 2).toUpperCase()}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={onClick}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 500, color: STATUS_COLOR[p.status as ProspectStatus], background: STATUS_BG[p.status as ProspectStatus] }}>
            {STATUS_LABEL[p.status as ProspectStatus]}
          </span>
          {p.amount > 0 && <span style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 700 }}>{formatCurrency(p.amount)}</span>}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ opacity: 0.6 }}>◷</span>
          {p.reminderDate ? formatReminderDate(tsToDate(p.reminderDate)) : ''}
          {p.notes && <span style={{ opacity: 0.6 }}>· {p.notes.slice(0, 55)}{p.notes.length > 55 ? '…' : ''}</span>}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, position: 'relative' }}>
        <button
          onClick={() => setSnoozeOpen(!snoozeOpen)}
          style={{
            padding: '7px 11px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
            background: 'var(--surface-2)', color: 'var(--text-muted)',
            border: '1px solid var(--border)', cursor: 'pointer',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          ⏱ Reporter
        </button>
        <button
          onClick={onDone}
          disabled={isDismissing}
          style={{
            padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
            background: 'rgba(34,197,94,0.1)', color: '#22c55e',
            border: '1px solid rgba(34,197,94,0.25)', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.18)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.1)')}
        >
          ✓ Fait
        </button>

        {snoozeOpen && (
          <>
            <div onClick={() => setSnoozeOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
            <div style={{
              position: 'absolute', right: 0, top: '110%',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 6, zIndex: 20, minWidth: 160,
              boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
            }}>
              {[{ label: 'Demain', days: 1 }, { label: 'Dans 3 jours', days: 3 }, { label: 'Dans 1 semaine', days: 7 }, { label: 'Dans 2 semaines', days: 14 }].map(opt => (
                <button
                  key={opt.days}
                  onClick={() => { onSnooze(opt.days); setSnoozeOpen(false); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, fontSize: 13, background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
