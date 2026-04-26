import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, updateDoc, doc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import type { Prospect, ProspectStatus } from '../types';
import { STATUS_LABEL, STATUS_COLOR, STATUS_BG, formatCurrency, formatDate, daysSince } from '../types';
import { tsToDate } from '../types';
import ProspectModal from '../components/ProspectModal';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace, type Invitation } from '../contexts/WorkspaceContext';
import { useTheme } from '../contexts/ThemeContext';

function TeamStatsCard({ prospects, collaborators, ownerEmail }: { prospects: Prospect[]; collaborators: Invitation[]; ownerEmail: string }) {
  const members = [
    { email: ownerEmail, label: 'Vous (propriétaire)' },
    ...collaborators.map(c => ({ email: c.collaboratorEmail, label: c.collaboratorEmail })),
  ];

  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12, letterSpacing: '-0.1px' }}>
        Statistiques équipe
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(members.length, 4)}, 1fr)`, gap: 12 }}>
        {members.map(({ email, label }) => {
          const created = prospects.filter(p => (p as any).createdByEmail === email).length;
          const signed = prospects.filter(p => (p as any).createdByEmail === email && p.status === 'signé').length;
          const initials = email.slice(0, 2).toUpperCase();
          return (
            <div key={email} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid rgba(124,92,252,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                  {initials}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {label}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.5px' }}>{created}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>prospects créés</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: '#22c55e', letterSpacing: '-0.5px' }}>{signed}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>signés</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
        {label}
      </span>
      <span style={{ fontSize: 28, fontWeight: 600, color: color ?? 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1 }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</span>}
    </div>
  );
}

function StatusBadge({ status }: { status: ProspectStatus }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 9px',
      borderRadius: 20,
      fontSize: 11.5,
      fontWeight: 500,
      color: STATUS_COLOR[status],
      background: STATUS_BG[status],
    }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const ALL_STATUSES: ProspectStatus[] = ['nouveau', 'contacté', 'devis', 'signé', 'perdu'];

function FunnelChart({ prospects }: { prospects: Prospect[] }) {
  const counts = ALL_STATUSES.map(s => ({
    status: s,
    count: prospects.filter(p => p.status === s).length,
  }));
  const max = Math.max(...counts.map(c => c.count), 1);

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
        Répartition par statut
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {counts.map(({ status, count }) => (
          <div key={status}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{STATUS_LABEL[status]}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: STATUS_COLOR[status] }}>{count}</span>
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{
                width: `${(count / max) * 100}%`,
                background: STATUS_COLOR[status],
                height: '100%', borderRadius: 4,
                transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
                minWidth: count > 0 ? 6 : 0,
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyChart({ prospects }: { prospects: Prospect[] }) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return {
      month: d.getMonth(),
      year: d.getFullYear(),
      label: d.toLocaleDateString('fr-FR', { month: 'short' }),
    };
  });

  const data = months.map(({ month, year, label }) => {
    const ca = prospects
      .filter(p => {
        if (p.status !== 'signé') return false;
        const d = tsToDate(p.lastContact);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, p) => sum + p.amount, 0);
    return { label, ca };
  });

  const maxCA = Math.max(...data.map(d => d.ca), 1);

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
        CA signé · 6 derniers mois
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
        {data.map(({ label, ca }) => (
          <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
            <div
              title={ca > 0 ? formatCurrency(ca) : '—'}
              style={{
                width: '100%',
                height: `${Math.max((ca / maxCA) * 100, ca > 0 ? 8 : 2)}%`,
                background: ca > 0 ? 'var(--accent)' : 'var(--surface-2)',
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.6s cubic-bezier(0.16,1,0.3,1)',
                opacity: ca > 0 ? 1 : 0.4,
              }}
            />
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { workspaceUid, myCollaborators, isOwn } = useWorkspace();
  const { plan } = useTheme();
  const navigate = useNavigate();

  const clearReminder = async (id: string) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', workspaceUid, 'prospects', id), { reminderDate: deleteField() });
  };
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; prospect?: Prospect }>({ open: false });

  useEffect(() => {
    if (!user) return;
    const ref = collection(db, 'users', workspaceUid, 'prospects');

    const unsub = onSnapshot(ref, snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prospect));
      setProspects(data);
      setLoading(false);
    });

    return unsub;
  }, [user]);

  const active = prospects.filter(p => p.status !== 'perdu');
  const signed = prospects.filter(p => p.status === 'signé');
  const conversionRate = active.length > 0 ? Math.round((signed.length / active.length) * 100) : 0;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const remindersToday = prospects.filter(p => {
    if (!p.reminderDate) return false;
    const d = tsToDate(p.reminderDate);
    return d <= today;
  }).sort((a, b) => a.reminderDate!.toDate().getTime() - b.reminderDate!.toDate().getTime());

  const pendingFollowUp = prospects.filter(p => {
    if (p.status === 'signé' || p.status === 'perdu') return false;
    return daysSince(tsToDate(p.lastContact)) > 5;
  });

  const signedThisMonth = signed.filter(p => {
    const d = tsToDate(p.lastContact);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const caThisMonth = signedThisMonth.reduce((sum, p) => sum + p.amount, 0);

  const hotProspects = prospects
    .filter(p => p.status === 'devis' || p.status === 'contacté')
    .sort((a, b) => b.amount - a.amount);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        Chargement…
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.3px' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 4 }}>
            {new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}
          </p>
        </div>
        <button
          id="tour-new-prospect"
          onClick={() => setModal({ open: true })}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 16px', borderRadius: 9,
            background: 'var(--accent)', color: 'white',
            border: 'none', fontSize: 13.5, fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Nouveau prospect
        </button>
      </div>

      {/* Rappels du jour */}
      {remindersToday.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12, letterSpacing: '-0.1px', display: 'flex', alignItems: 'center', gap: 8 }}>
            🔔 Rappels du jour
            <span style={{
              background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
              fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
            }}>
              {remindersToday.length}
            </span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {remindersToday.map(p => {
              const isOverdue = tsToDate(p.reminderDate) < todayStart;
              const reminderLabel = isOverdue
                ? `En retard · ${formatDate(tsToDate(p.reminderDate))}`
                : "Aujourd'hui";
              return (
                <div
                  key={p.id}
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
                    borderRadius: 10,
                    padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                    background: STATUS_BG[p.status],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: STATUS_COLOR[p.status],
                  }}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div
                    style={{ flex: 1, cursor: 'pointer' }}
                    onClick={() => navigate(`/clients/${p.id}`)}
                  >
                    <div style={{ fontWeight: 500, fontSize: 13.5, color: 'var(--text)', marginBottom: 2 }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 12, color: isOverdue ? '#ef4444' : '#f59e0b' }}>
                      {reminderLabel}
                    </div>
                  </div>
                  {p.amount > 0 && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>
                      {formatCurrency(p.amount)}
                    </span>
                  )}
                  <button
                    onClick={() => clearReminder(p.id)}
                    title="Marquer comme fait"
                    style={{
                      flexShrink: 0,
                      padding: '7px 14px', borderRadius: 8,
                      background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                      border: '1px solid rgba(34,197,94,0.2)',
                      fontSize: 12.5, fontWeight: 500,
                    }}
                  >
                    ✓ Fait
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 36 }}>
        <MetricCard
          label="Prospects actifs"
          value={active.length}
          sub={`${prospects.length} au total`}
        />
        <MetricCard
          label="Taux de conversion"
          value={`${conversionRate}%`}
          sub={`${signed.length} signés`}
          color="var(--accent)"
        />
        <MetricCard
          label="Relances en attente"
          value={pendingFollowUp.length}
          sub="+5 jours sans contact"
          color={pendingFollowUp.length > 0 ? '#f59e0b' : undefined}
        />
        <MetricCard
          label="CA signé ce mois"
          value={formatCurrency(caThisMonth)}
          sub={`${signedThisMonth.length} nouveau${signedThisMonth.length > 1 ? 'x' : ''} contrat${signedThisMonth.length > 1 ? 's' : ''}`}
          color="#22c55e"
        />
      </div>

      {/* Relances urgentes */}
      {pendingFollowUp.length > 0 && (
        <div style={{
          background: 'rgba(245,158,11,0.06)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 10,
          padding: '14px 18px',
          marginBottom: 28,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          <span style={{ fontSize: 16, marginTop: 1 }}>⚠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#f59e0b', marginBottom: 4 }}>
              {pendingFollowUp.length} relance{pendingFollowUp.length > 1 ? 's' : ''} en attente
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              {pendingFollowUp.map(p => p.name).join(', ')}
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {prospects.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 36 }}>
          <FunnelChart prospects={prospects} />
          <MonthlyChart prospects={prospects} />
        </div>
      )}

      {/* Stats équipe — Plan Agence */}
      {plan === 'agence' && isOwn && myCollaborators.filter(i => i.status === 'accepted').length > 0 && (
        <TeamStatsCard prospects={prospects} collaborators={myCollaborators.filter(i => i.status === 'accepted')} ownerEmail={user?.email ?? ''} />
      )}

      {/* Prospects chauds */}
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14, letterSpacing: '-0.1px' }}>
          Prospects chauds
        </h2>
        {hotProspects.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>Aucun prospect actif.</div>
        ) : (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Nom', 'Statut', 'Montant', 'Dernier contact', 'Notes'].map(col => (
                    <th key={col} style={{
                      padding: '11px 16px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hotProspects.map((p, i) => {
                  const since = daysSince(tsToDate(p.lastContact));
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/clients/${p.id}`)}
                      style={{
                        borderBottom: i < hotProspects.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        transition: 'background 0.1s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '13px 16px', fontWeight: 500, fontSize: 13.5 }}>{p.name}</td>
                      <td style={{ padding: '13px 16px' }}><StatusBadge status={p.status} /></td>
                      <td style={{ padding: '13px 16px', fontWeight: 500, fontSize: 13.5 }}>
                        {p.amount > 0 ? formatCurrency(p.amount) : '—'}
                      </td>
                      <td style={{ padding: '13px 16px', color: since > 5 ? '#f59e0b' : 'var(--text-dim)', fontSize: 13 }}>
                        {since === 0 ? "Aujourd'hui" : since === 1 ? 'Hier' : `il y a ${since}j`}
                      </td>
                      <td style={{ padding: '13px 16px', color: 'var(--text-muted)', fontSize: 13, maxWidth: 260 }}>
                        <span style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {p.notes || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.open && (
        <ProspectModal
          prospect={modal.prospect}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  );
}
