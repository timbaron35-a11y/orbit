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
      <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Statistiques équipe
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(members.length, 4)}, 1fr)`, gap: 12 }}>
        {members.map(({ email, label }) => {
          const created = prospects.filter(p => (p as any).createdByEmail === email).length;
          const signed = prospects.filter(p => (p as any).createdByEmail === email && p.status === 'signé').length;
          const initials = email.slice(0, 2).toUpperCase();
          return (
            <div key={email} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(124,92,252,0.2), rgba(124,92,252,0.08))',
                  border: '1px solid rgba(124,92,252,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
                }}>
                  {initials}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {label}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1 }}>{created}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>créés</div>
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e', letterSpacing: '-0.5px', lineHeight: 1 }}>{signed}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>signés</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const METRIC_ICONS: Record<string, string> = {
  prospects: '◎',
  conversion: '⟳',
  relances: '◷',
  ca: '◈',
};

function MetricCard({ label, value, sub, color, icon, accent }: {
  label: string; value: string | number; sub?: string;
  color?: string; icon?: string; accent?: string;
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: accent ?? 'var(--accent)',
        opacity: 0.6,
        borderRadius: '14px 14px 0 0',
      }} />
      {/* icon */}
      <div style={{
        position: 'absolute', top: 16, right: 18,
        fontSize: 18, opacity: 0.12, color: color ?? 'var(--text)',
        fontWeight: 300,
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, marginBottom: 10 }}>
        {label}
      </span>
      <span style={{ fontSize: 32, fontWeight: 700, color: color ?? 'var(--text)', letterSpacing: '-1px', lineHeight: 1, marginBottom: 8 }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</span>}
    </div>
  );
}

function StatusBadge({ status }: { status: ProspectStatus }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 500,
      color: STATUS_COLOR[status],
      background: STATUS_BG[status],
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR[status], display: 'inline-block', flexShrink: 0 }} />
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
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px 24px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>
        Répartition par statut
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {counts.map(({ status, count }) => (
          <div key={status}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[status], display: 'inline-block' }} />
                {STATUS_LABEL[status]}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: STATUS_COLOR[status] }}>{count}</span>
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
              <div style={{
                width: `${(count / max) * 100}%`,
                background: `linear-gradient(90deg, ${STATUS_COLOR[status]}, ${STATUS_COLOR[status]}99)`,
                height: '100%', borderRadius: 6,
                transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
                minWidth: count > 0 ? 8 : 0,
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
    return { month: d.getMonth(), year: d.getFullYear(), label: d.toLocaleDateString('fr-FR', { month: 'short' }) };
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
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '22px 24px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>
        CA signé · 6 derniers mois
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110 }}>
        {data.map(({ label, ca }, i) => (
          <div
            key={label}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end', cursor: 'default' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            {hovered === i && ca > 0 && (
              <div style={{
                position: 'absolute',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '4px 8px',
                fontSize: 11.5, fontWeight: 600, color: 'var(--text)',
                whiteSpace: 'nowrap', pointerEvents: 'none',
                transform: 'translateY(-4px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}>
                {formatCurrency(ca)}
              </div>
            )}
            <div style={{
              width: '100%',
              height: `${Math.max((ca / maxCA) * 100, ca > 0 ? 8 : 2)}%`,
              background: ca > 0
                ? `linear-gradient(180deg, #a78bfa, rgba(124,92,252,0.6))`
                : 'var(--surface-2)',
              borderRadius: '5px 5px 0 0',
              transition: 'height 0.7s cubic-bezier(0.16,1,0.3,1), opacity 0.2s',
              opacity: ca > 0 ? (hovered === i ? 1 : 0.8) : 0.3,
              boxShadow: ca > 0 && hovered === i ? '0 0 16px rgba(124,92,252,0.4)' : 'none',
            }} />
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
      setProspects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prospect)));
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

  const today = new Date(); today.setHours(23, 59, 59, 999);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const remindersToday = prospects.filter(p => {
    if (!p.reminderDate) return false;
    return tsToDate(p.reminderDate) <= today;
  }).sort((a, b) => a.reminderDate!.toDate().getTime() - b.reminderDate!.toDate().getTime());

  const pendingFollowUp = prospects.filter(p =>
    p.status !== 'signé' && p.status !== 'perdu' && daysSince(tsToDate(p.lastContact)) > 5
  );

  const signedThisMonth = signed.filter(p => {
    const d = tsToDate(p.lastContact);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const caThisMonth = signedThisMonth.reduce((sum, p) => sum + p.amount, 0);

  const hotProspects = prospects
    .filter(p => p.status === 'devis' || p.status === 'contacté')
    .sort((a, b) => b.amount - a.amount);

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || '';
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        Chargement…
      </div>
    );
  }

  return (
    <div style={{ padding: '36px 40px', maxWidth: 980 }}>

      {/* Header */}
      <div style={{ marginBottom: 36, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            {greeting}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 6, textTransform: 'capitalize' }}>
            {new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}
          </p>
        </div>
        <button
          id="tour-new-prospect"
          onClick={() => setModal({ open: true })}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10,
            background: 'var(--accent)', color: 'white',
            border: 'none', fontSize: 13.5, fontWeight: 600,
            boxShadow: '0 4px 16px rgba(124,92,252,0.35)',
            transition: 'opacity 0.15s, box-shadow 0.15s',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(124,92,252,0.45)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,92,252,0.35)'; }}
        >
          <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 400 }}>+</span>
          Nouveau prospect
        </button>
      </div>

      {/* Rappels du jour */}
      {remindersToday.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Rappels du jour
            </h2>
            <span style={{
              background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
              fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
              border: '1px solid rgba(245,158,11,0.25)',
            }}>
              {remindersToday.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {remindersToday.map(p => {
              const isOverdue = tsToDate(p.reminderDate) < todayStart;
              return (
                <div key={p.id} style={{
                  background: 'var(--surface)',
                  border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  borderLeft: `3px solid ${isOverdue ? '#ef4444' : '#f59e0b'}`,
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  transition: 'background 0.15s',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                    background: STATUS_BG[p.status],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: STATUS_COLOR[p.status],
                  }}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/clients/${p.id}`)}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)', marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: isOverdue ? '#ef4444' : '#f59e0b' }}>
                      {isOverdue ? `En retard · ${formatDate(tsToDate(p.reminderDate))}` : "Aujourd'hui"}
                    </div>
                  </div>
                  {p.amount > 0 && (
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                      {formatCurrency(p.amount)}
                    </span>
                  )}
                  <button
                    onClick={() => clearReminder(p.id)}
                    style={{
                      flexShrink: 0, padding: '7px 14px', borderRadius: 8,
                      background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                      border: '1px solid rgba(34,197,94,0.2)',
                      fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.18)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.1)')}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
        <MetricCard
          label="Prospects actifs"
          value={active.length}
          sub={`${prospects.length} au total`}
          icon="◎"
          accent="rgba(124,92,252,0.7)"
        />
        <MetricCard
          label="Taux de conversion"
          value={`${conversionRate}%`}
          sub={`${signed.length} prospect${signed.length > 1 ? 's' : ''} signé${signed.length > 1 ? 's' : ''}`}
          color="var(--accent)"
          icon="⟳"
          accent="rgba(124,92,252,0.7)"
        />
        <MetricCard
          label="Relances en attente"
          value={pendingFollowUp.length}
          sub="+5 jours sans contact"
          color={pendingFollowUp.length > 0 ? '#f59e0b' : 'var(--text)'}
          icon="◷"
          accent={pendingFollowUp.length > 0 ? 'rgba(245,158,11,0.7)' : 'rgba(124,92,252,0.7)'}
        />
        <MetricCard
          label="CA ce mois"
          value={formatCurrency(caThisMonth)}
          sub={`${signedThisMonth.length} contrat${signedThisMonth.length > 1 ? 's' : ''} signé${signedThisMonth.length > 1 ? 's' : ''}`}
          color="#22c55e"
          icon="◈"
          accent="rgba(34,197,94,0.7)"
        />
      </div>

      {/* Relances urgentes */}
      {pendingFollowUp.length > 0 && (
        <div style={{
          background: 'rgba(245,158,11,0.05)',
          border: '1px solid rgba(245,158,11,0.18)',
          borderLeft: '3px solid #f59e0b',
          borderRadius: 10,
          padding: '12px 18px',
          marginBottom: 28,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 15 }}>⚠</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b' }}>
              {pendingFollowUp.length} relance{pendingFollowUp.length > 1 ? 's' : ''} en attente
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {' '}· {pendingFollowUp.slice(0, 3).map(p => p.name).join(', ')}{pendingFollowUp.length > 3 ? ` +${pendingFollowUp.length - 3}` : ''}
            </span>
          </div>
          <button
            onClick={() => navigate('/pipeline')}
            style={{
              fontSize: 12, fontWeight: 500, color: '#f59e0b',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 7, padding: '5px 12px', cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Voir le pipeline →
          </button>
        </div>
      )}

      {/* Charts */}
      {prospects.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 36 }}>
          <FunnelChart prospects={prospects} />
          <MonthlyChart prospects={prospects} />
        </div>
      )}

      {/* Stats équipe */}
      {plan === 'agence' && isOwn && myCollaborators.filter(i => i.status === 'accepted').length > 0 && (
        <TeamStatsCard prospects={prospects} collaborators={myCollaborators.filter(i => i.status === 'accepted')} ownerEmail={user?.email ?? ''} />
      )}

      {/* Prospects chauds */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Prospects chauds
          </h2>
          {hotProspects.length > 0 && (
            <button
              onClick={() => navigate('/clients')}
              style={{ fontSize: 12.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              Voir tous →
            </button>
          )}
        </div>

        {hotProspects.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '48px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <div style={{ fontSize: 32, opacity: 0.2 }}>◎</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Aucun prospect en cours</div>
            <button
              onClick={() => setModal({ open: true })}
              style={{
                marginTop: 4, fontSize: 13, fontWeight: 500, color: 'var(--accent)',
                background: 'var(--accent-dim)', border: '1px solid rgba(124,92,252,0.25)',
                borderRadius: 8, padding: '7px 16px', cursor: 'pointer',
              }}
            >
              + Ajouter un prospect
            </button>
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Prospect', 'Statut', 'Montant', 'Dernier contact', 'Notes'].map(col => (
                    <th key={col} style={{
                      padding: '12px 18px',
                      textAlign: 'left',
                      fontSize: 11.5, fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
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
                        transition: 'background 0.12s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                            background: STATUS_BG[p.status],
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: STATUS_COLOR[p.status],
                          }}>
                            {p.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>{p.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}><StatusBadge status={p.status} /></td>
                      <td style={{ padding: '14px 18px', fontWeight: 700, fontSize: 13.5, color: p.amount > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                        {p.amount > 0 ? formatCurrency(p.amount) : '—'}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          fontSize: 12.5, fontWeight: 500,
                          color: since > 5 ? '#f59e0b' : 'var(--text-dim)',
                          background: since > 5 ? 'rgba(245,158,11,0.08)' : 'transparent',
                          padding: since > 5 ? '3px 8px' : '0',
                          borderRadius: 6,
                        }}>
                          {since === 0 ? "Aujourd'hui" : since === 1 ? 'Hier' : `il y a ${since}j`}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: 13, maxWidth: 240 }}>
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
