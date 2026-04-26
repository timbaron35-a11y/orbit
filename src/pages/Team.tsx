import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useTheme } from '../contexts/ThemeContext';
import type { Prospect, ProspectStatus } from '../types';
import { STATUS_LABEL, STATUS_COLOR, STATUS_BG, formatCurrency } from '../types';
import { tsToDate } from '../types';

interface MemberStats {
  email: string;
  label: string;
  total: number;
  byStatus: Record<string, number>;
  caSigned: number;
  caPipeline: number;
  conversionRate: number;
  stale: number;
}

const PIPELINE_WEIGHTS: Record<string, number> = {
  nouveau: 0.1, contacté: 0.25, devis: 0.6, signé: 1, perdu: 0,
};

function computeMemberStats(email: string, label: string, prospects: Prospect[]): MemberStats {
  const mine = prospects.filter(p => p.assignedTo === email);
  const byStatus: Record<string, number> = {};
  let caSigned = 0; let caPipeline = 0; let stale = 0;
  const now = Date.now();

  for (const p of mine) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    if (p.status === 'signé') caSigned += p.amount;
    caPipeline += p.amount * (PIPELINE_WEIGHTS[p.status] ?? 0);
    const days = Math.floor((now - tsToDate(p.lastContact).getTime()) / 86400000);
    if (days > 7 && p.status !== 'signé' && p.status !== 'perdu') stale++;
  }

  const active = mine.filter(p => p.status !== 'perdu').length;
  const signed = byStatus['signé'] ?? 0;
  const conversionRate = active > 0 ? Math.round((signed / active) * 100) : 0;

  return { email, label, total: mine.length, byStatus, caSigned, caPipeline, conversionRate, stale };
}

const STATUSES: ProspectStatus[] = ['nouveau', 'contacté', 'devis', 'signé', 'perdu'];

export default function Team() {
  const { user } = useAuth();
  const { workspaceUid, isOwn, myCollaborators } = useWorkspace();
  const { plan: themePlan } = useTheme();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, 'users', workspaceUid, 'prospects'), snap => {
      setProspects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Prospect)));
      setLoading(false);
    });
  }, [user]);

  if (!isOwn || themePlan !== 'agence') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 32, opacity: 0.15 }}>↗</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Réservé au Plan Agence</div>
        <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>Passez au Plan Agence pour accéder aux stats d'équipe.</div>
      </div>
    );
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>Chargement…</div>;

  const accepted = myCollaborators.filter(i => i.status === 'accepted');
  const members = [
    { email: user!.email!, label: 'Moi' },
    ...accepted.map(i => ({ email: i.collaboratorEmail, label: i.collaboratorEmail.split('@')[0] })),
  ];

  const memberStats = members.map(m => computeMemberStats(m.email, m.label, prospects));

  // Team aggregates
  const unassigned = prospects.filter(p => !p.assignedTo);
  const totalCA = memberStats.reduce((s, m) => s + m.caSigned, 0);
  const totalPipeline = memberStats.reduce((s, m) => s + m.caPipeline, 0);
  const totalStale = memberStats.reduce((s, m) => s + m.stale, 0);

  // Donut data: team-wide status counts
  const teamByStatus = STATUSES.map(s => ({
    status: s,
    count: prospects.filter(p => p.status === s).length,
  })).filter(x => x.count > 0);
  const totalAssigned = teamByStatus.reduce((s, x) => s + x.count, 0);

  return (
    <div style={{ padding: '36px 40px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>Équipe</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 6 }}>
          {members.length} membre{members.length > 1 ? 's' : ''} · {prospects.length} prospects au total
        </p>
      </div>

      {/* Team aggregate cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        {[
          { label: 'CA signé total', value: formatCurrency(totalCA), color: '#22c55e', accent: 'rgba(34,197,94,0.7)' },
          { label: 'Pipeline pondéré', value: formatCurrency(totalPipeline), color: 'var(--accent)', accent: 'rgba(124,92,252,0.7)' },
          { label: 'Relances en retard', value: totalStale, color: totalStale > 0 ? '#f59e0b' : 'var(--text-muted)', accent: totalStale > 0 ? 'rgba(245,158,11,0.7)' : 'rgba(115,115,115,0.3)' },
          { label: 'Non assignés', value: unassigned.length, color: unassigned.length > 0 ? '#ef4444' : 'var(--text-muted)', accent: unassigned.length > 0 ? 'rgba(239,68,68,0.7)' : 'rgba(115,115,115,0.3)' },
        ].map(({ label, value, color, accent }) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent, borderRadius: '14px 14px 0 0' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color, letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      {prospects.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>

          {/* Donut — statuts équipe */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>Statuts équipe</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <DonutChart data={teamByStatus} total={totalAssigned} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                {teamByStatus.map(({ status, count }) => (
                  <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[status as ProspectStatus], flexShrink: 0, boxShadow: `0 0 5px ${STATUS_COLOR[status as ProspectStatus]}` }} />
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)', flex: 1 }}>{STATUS_LABEL[status as ProspectStatus]}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: STATUS_COLOR[status as ProspectStatus] }}>{count}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 32, textAlign: 'right' }}>{Math.round((count / totalAssigned) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Member comparison bars */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 18 }}>CA signé par membre</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {memberStats.filter(m => m.total > 0).map(m => {
                const pct = totalCA > 0 ? (m.caSigned / totalCA) * 100 : (m.total > 0 ? 100 / memberStats.filter(x => x.total > 0).length : 0);
                const prospectPct = prospects.length > 0 ? (m.total / prospects.filter(p => p.assignedTo).length) * 100 : 0;
                return (
                  <div key={m.email}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{m.label}</span>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>{formatCurrency(m.caSigned)}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.total} prospects</span>
                      </div>
                    </div>
                    {/* CA bar */}
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #22c55e, #4ade80)', borderRadius: 3, transition: 'width 0.6s ease' }} />
                    </div>
                    {/* Prospects bar */}
                    <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${prospectPct}%`, background: 'linear-gradient(90deg, var(--accent), #a78bfa)', borderRadius: 2, opacity: 0.6, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {memberStats.every(m => m.total === 0) && (
              <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', paddingTop: 12 }}>Aucun prospect assigné</div>
            )}
          </div>
        </div>
      )}

      {/* Member cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {memberStats.map(m => (
          <MemberCard key={m.email} stats={m} isMe={m.email === user!.email} />
        ))}

        {/* Unassigned */}
        {unassigned.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid #ef4444', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#ef4444' }}>?</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Non assignés</div>
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 2 }}>{unassigned.length} prospect{unassigned.length > 1 ? 's' : ''} sans responsable</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {unassigned.slice(0, 8).map(p => (
                <span key={p.id} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: STATUS_BG[p.status as ProspectStatus], color: STATUS_COLOR[p.status as ProspectStatus], border: `1px solid ${STATUS_COLOR[p.status as ProspectStatus]}30` }}>
                  {p.name}
                </span>
              ))}
              {unassigned.length > 8 && <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>+{unassigned.length - 8} autres</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MemberCard({ stats: m, isMe }: { stats: MemberStats; isMe: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const initials = m.label.slice(0, 2).toUpperCase();

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
      {/* Header row */}
      <div
        style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Avatar */}
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: isMe ? 'linear-gradient(135deg, var(--accent-dim), rgba(124,92,252,0.12))' : 'var(--surface-2)',
          border: isMe ? '1px solid rgba(124,92,252,0.3)' : '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: isMe ? 'var(--accent)' : 'var(--text-muted)',
        }}>
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{m.label}</span>
            {isMe && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 600 }}>Vous</span>}
            {m.stale > 0 && <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 600 }}>⚠ {m.stale} en retard</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{m.email}</div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
          <Stat label="Prospects" value={m.total} />
          <Stat label="CA signé" value={m.caSigned > 0 ? formatCurrency(m.caSigned) : '—'} color="#22c55e" />
          <Stat label="Pipeline" value={m.caPipeline > 0 ? formatCurrency(m.caPipeline) : '—'} color="var(--accent)" />
          <Stat label="Conversion" value={`${m.conversionRate}%`} />
        </div>

        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8, transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</span>
      </div>

      {/* Expanded: status breakdown */}
      {expanded && m.total > 0 && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 20px', background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Répartition par statut</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STATUSES.map(s => {
              const count = m.byStatus[s] ?? 0;
              if (count === 0) return null;
              return (
                <div key={s} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 10,
                  background: STATUS_BG[s], border: `1px solid ${STATUS_COLOR[s]}30`,
                  flex: '1 1 140px',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[s], boxShadow: `0 0 6px ${STATUS_COLOR[s]}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: STATUS_COLOR[s], fontWeight: 600, flex: 1 }}>{STATUS_LABEL[s]}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: STATUS_COLOR[s] }}>{count}</span>
                </div>
              );
            })}
          </div>

          {/* Pipeline bar */}
          {m.total > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Répartition pipeline</div>
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
                {STATUSES.filter(s => (m.byStatus[s] ?? 0) > 0).map(s => (
                  <div key={s} style={{
                    flex: m.byStatus[s] ?? 0,
                    background: `linear-gradient(90deg, ${STATUS_COLOR[s]}, ${STATUS_COLOR[s]}99)`,
                  }} title={`${STATUS_LABEL[s]}: ${m.byStatus[s]}`} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {expanded && m.total === 0 && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 20px', background: 'var(--surface-2)', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          Aucun prospect assigné
        </div>
      )}
    </div>
  );
}

function DonutChart({ data, total }: { data: { status: string; count: number }[]; total: number }) {
  const R = 48; const stroke = 10;
  const circ = 2 * Math.PI * R;
  let offset = 0;
  const slices = data.map(({ status, count }) => {
    const pct = total > 0 ? count / total : 0;
    const dash = pct * circ;
    const gap = circ - dash;
    const slice = { status, dash, gap, offset };
    offset += dash;
    return slice;
  });

  return (
    <svg width={120} height={120} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
      <circle cx={60} cy={60} r={R} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
      {slices.map(({ status, dash, gap, offset: off }) => (
        <circle
          key={status}
          cx={60} cy={60} r={R}
          fill="none"
          stroke={STATUS_COLOR[status as ProspectStatus]}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={circ / 4 - off}
          strokeLinecap="butt"
          style={{ filter: `drop-shadow(0 0 4px ${STATUS_COLOR[status as ProspectStatus]}60)` }}
        />
      ))}
      <text x={60} y={55} textAnchor="middle" style={{ fontSize: 20, fontWeight: 700, fill: 'var(--text)' }}>{total}</text>
      <text x={60} y={70} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--text-muted)' }}>prospects</text>
    </svg>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: color ?? 'var(--text)', letterSpacing: '-0.3px' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
