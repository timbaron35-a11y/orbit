import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, updateDoc, doc, deleteField, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { Prospect, ProspectStatus } from '../types';
import { STATUS_LABEL, STATUS_COLOR, STATUS_BG, formatCurrency } from '../types';

interface ReminderGroup {
  label: string;
  color: string;
  items: Prospect[];
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function groupByDate(prospects: Prospect[]): ReminderGroup[] {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

  const overdue: Prospect[] = [];
  const todayItems: Prospect[] = [];
  const tomorrowItems: Prospect[] = [];
  const thisWeek: Prospect[] = [];
  const later: Prospect[] = [];

  for (const p of prospects) {
    if (!p.reminderDate) continue;
    const d = startOfDay(p.reminderDate.toDate());
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
  if (thisWeek.length) groups.push({ label: 'Cette semaine', color: 'var(--text-muted)', items: thisWeek });
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
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Prospect));
      setProspects(all.filter(p => p.reminderDate));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const handleDone = async (p: Prospect) => {
    if (!user) return;
    setDismissing(prev => new Set(prev).add(p.id));
    await updateDoc(doc(db, 'users', workspaceUid, 'prospects', p.id), {
      reminderDate: deleteField(),
      lastContact: Timestamp.now(),
    });
    setDismissing(prev => { const s = new Set(prev); s.delete(p.id); return s; });
  };

  const handleSnooze = async (p: Prospect, days: number) => {
    if (!user) return;
    const next = new Date();
    next.setDate(next.getDate() + days);
    next.setHours(12, 0, 0, 0);
    await updateDoc(doc(db, 'users', workspaceUid, 'prospects', p.id), {
      reminderDate: Timestamp.fromDate(next),
    });
  };

  const today = startOfDay(new Date());
  const overdueCount = prospects.filter(p => p.reminderDate && startOfDay(p.reminderDate.toDate()) < today).length;
  const todayCount = prospects.filter(p => p.reminderDate && startOfDay(p.reminderDate.toDate()).getTime() === today.getTime()).length;

  const groups = groupByDate(prospects);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        Chargement…
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 780 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.3px' }}>Agenda</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 4 }}>
          {prospects.length === 0
            ? 'Aucun rappel planifié.'
            : `${prospects.length} rappel${prospects.length > 1 ? 's' : ''} planifié${prospects.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Stats */}
      {(overdueCount > 0 || todayCount > 0) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
          {overdueCount > 0 && (
            <StatCard
              value={overdueCount}
              label="en retard"
              color="#ef4444"
              bg="rgba(239,68,68,0.08)"
            />
          )}
          {todayCount > 0 && (
            <StatCard
              value={todayCount}
              label="aujourd'hui"
              color="#f59e0b"
              bg="rgba(245,158,11,0.08)"
            />
          )}
          <StatCard
            value={prospects.length - overdueCount - todayCount}
            label="à venir"
            color="var(--accent)"
            bg="var(--accent-dim)"
          />
        </div>
      )}

      {prospects.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {groups.map(group => (
            <div key={group.label}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
              }}>
                <span style={{
                  fontSize: 11.5, fontWeight: 600, color: group.color,
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  {group.label}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{group.items.length}</span>
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
  prospect: Prospect;
  groupColor: string;
  isDismissing: boolean;
  onDone: () => void;
  onSnooze: (days: number) => void;
  onClick: () => void;
}) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        opacity: isDismissing ? 0.4 : 1,
        transition: 'opacity 0.2s',
        position: 'relative',
      }}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 10, bottom: 10,
        width: 3, borderRadius: '0 2px 2px 0',
        background: groupColor,
      }} />

      {/* Avatar */}
      <div
        onClick={onClick}
        style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: STATUS_BG[p.status as ProspectStatus],
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: STATUS_COLOR[p.status as ProspectStatus],
          cursor: 'pointer',
        }}
      >
        {p.name.slice(0, 2).toUpperCase()}
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={onClick}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{p.name}</span>
          <span style={{
            padding: '2px 8px', borderRadius: 20, fontSize: 11.5, fontWeight: 500,
            color: STATUS_COLOR[p.status as ProspectStatus],
            background: STATUS_BG[p.status as ProspectStatus],
          }}>
            {STATUS_LABEL[p.status as ProspectStatus]}
          </span>
          {p.amount > 0 && (
            <span style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 600 }}>
              {formatCurrency(p.amount)}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
          🔔 {p.reminderDate ? formatReminderDate(p.reminderDate.toDate()) : ''}
          {p.notes && (
            <span style={{ marginLeft: 10, color: 'var(--text-muted)', opacity: 0.7 }}>
              · {p.notes.slice(0, 60)}{p.notes.length > 60 ? '…' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, position: 'relative' }}>
        <button
          onClick={() => { setSnoozeOpen(!snoozeOpen); }}
          title="Reporter"
          style={{
            padding: '7px 10px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
            background: 'var(--surface-2)', color: 'var(--text-muted)',
            border: '1px solid var(--border)', cursor: 'pointer',
          }}
        >
          ⏱ Reporter
        </button>
        <button
          onClick={onDone}
          disabled={isDismissing}
          title="Marquer comme fait"
          style={{
            padding: '7px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
            background: 'rgba(16,185,129,0.1)', color: '#10b981',
            border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer',
          }}
        >
          ✓ Fait
        </button>

        {snoozeOpen && (
          <>
            <div
              onClick={() => setSnoozeOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 10 }}
            />
            <div style={{
              position: 'absolute', right: 0, top: '110%',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10, padding: 6,
              zIndex: 20, minWidth: 150,
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            }}>
              {[
                { label: 'Demain', days: 1 },
                { label: 'Dans 3 jours', days: 3 },
                { label: 'Dans 1 semaine', days: 7 },
                { label: 'Dans 2 semaines', days: 14 },
              ].map(opt => (
                <button
                  key={opt.days}
                  onClick={() => { onSnooze(opt.days); setSnoozeOpen(false); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', borderRadius: 7, fontSize: 13,
                    background: 'none', border: 'none',
                    color: 'var(--text)', cursor: 'pointer',
                  }}
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

function StatCard({ value, label, color, bg }: { value: number; label: string; color: string; bg: string }) {
  if (value <= 0) return null;
  return (
    <div style={{
      padding: '12px 18px', borderRadius: 10,
      background: bg, border: `1px solid ${color}30`,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 13, color, opacity: 0.85 }}>{label}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '56px 24px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      <div style={{ fontSize: 36 }}>🗓️</div>
      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>Aucun rappel planifié</div>
      <div style={{ fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
        Ajoutez des rappels depuis les fiches prospects pour les retrouver ici.
      </div>
    </div>
  );
}
