import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Prospect, ProspectStatus } from '../types';
import { STATUS_LABEL, STATUS_COLOR, STATUS_BG, formatCurrency, formatDate, daysSince } from '../types';
import { tsToDate } from '../types';
import ProspectModal from '../components/ProspectModal';
import ImportModal from '../components/ImportModal';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

function exportCSV(prospects: Prospect[]) {
  const headers = ['Nom', 'Statut', 'Montant (€)', 'Dernier contact', 'Notes'];
  const rows = prospects.map(p => [
    `"${p.name.replace(/"/g, '""')}"`,
    STATUS_LABEL[p.status],
    p.amount.toString(),
    formatDate(tsToDate(p.lastContact)),
    `"${(p.notes ?? '').replace(/"/g, '""')}"`,
  ]);
  const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orbit-prospects-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const ALL_STATUSES: ProspectStatus[] = ['nouveau', 'contacté', 'devis', 'signé', 'perdu'];

function StatusBadge({ status }: { status: ProspectStatus }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 20,
      fontSize: 12, fontWeight: 500,
      color: STATUS_COLOR[status],
      background: STATUS_BG[status],
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR[status], flexShrink: 0 }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

const ghostBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '9px 14px', borderRadius: 9,
  background: 'var(--surface)', color: 'var(--text-dim)',
  border: '1px solid var(--border)', fontSize: 13, fontWeight: 500,
  cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
};

export default function Clients() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { workspaceUid } = useWorkspace();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ProspectStatus | 'all'>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; prospect?: Prospect }>({ open: false });
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'users', workspaceUid, 'prospects'), snap => {
      setProspects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Prospect)));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const allTags = [...new Set(prospects.flatMap(p => p.tags ?? []))].sort();

  const filtered = prospects.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (activeTag && !(p.tags ?? []).includes(activeTag)) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => b.amount - a.amount);

  // counts per status for filter badges
  const countFor = (s: ProspectStatus | 'all') =>
    s === 'all' ? prospects.length : prospects.filter(p => p.status === s).length;

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
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>Prospects</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 6 }}>
            {prospects.length} prospect{prospects.length !== 1 ? 's' : ''} au total
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setImportOpen(true)}
            style={ghostBtn}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
          >
            <span style={{ fontSize: 15 }}>↑</span> Importer
          </button>
          <button
            onClick={() => exportCSV(filtered)}
            disabled={filtered.length === 0}
            style={{ ...ghostBtn, opacity: filtered.length === 0 ? 0.4 : 1, cursor: filtered.length === 0 ? 'default' : 'pointer' }}
            onMouseEnter={e => { if (filtered.length > 0) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
          >
            <span style={{ fontSize: 15 }}>↓</span> Exporter
          </button>
          <button
            onClick={() => setModal({ open: true })}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 10,
              background: 'var(--accent)', color: 'white',
              border: 'none', fontSize: 13.5, fontWeight: 600,
              boxShadow: '0 4px 16px rgba(124,92,252,0.35)',
              cursor: 'pointer', transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 400 }}>+</span>
            Nouveau
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '14px 16px',
        display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-muted)', pointerEvents: 'none' }}>
            ⌕
          </span>
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 8, padding: '7px 12px 7px 28px',
              color: 'var(--text)', fontSize: 13.5, outline: 'none', width: 200,
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />

        {/* Status pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', ...ALL_STATUSES] as const).map(s => {
            const active = filter === s;
            const count = countFor(s);
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 500,
                  background: active ? (s === 'all' ? 'var(--accent)' : STATUS_BG[s]) : 'transparent',
                  color: active ? (s === 'all' ? 'white' : STATUS_COLOR[s]) : 'var(--text-muted)',
                  border: '1px solid',
                  borderColor: active ? (s === 'all' ? 'var(--accent)' : STATUS_COLOR[s]) : 'var(--border)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {s !== 'all' && active && (
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR[s], flexShrink: 0 }} />
                )}
                {s === 'all' ? 'Tous' : STATUS_LABEL[s]}
                <span style={{
                  fontSize: 11, fontWeight: 700, opacity: 0.7,
                  background: active ? 'rgba(255,255,255,0.2)' : 'var(--surface-2)',
                  borderRadius: 20, padding: '0 5px',
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <>
            <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    background: activeTag === tag ? 'var(--accent-dim)' : 'transparent',
                    color: activeTag === tag ? 'var(--accent)' : 'var(--text-muted)',
                    border: '1px solid',
                    borderColor: activeTag === tag ? 'rgba(124,92,252,0.3)' : 'var(--border)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  # {tag}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Results count */}
      {(search || filter !== 'all' || activeTag) && (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12 }}>
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          {(search || filter !== 'all' || activeTag) && (
            <button
              onClick={() => { setSearch(''); setFilter('all'); setActiveTag(null); }}
              style={{ marginLeft: 8, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5 }}
            >
              Effacer les filtres ×
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{
            padding: '64px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 36, opacity: 0.15 }}>◎</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>
              {search || filter !== 'all' || activeTag ? 'Aucun résultat pour ces filtres' : 'Aucun prospect pour l\'instant'}
            </div>
            {!search && filter === 'all' && !activeTag && (
              <button
                onClick={() => setModal({ open: true })}
                style={{
                  marginTop: 4, fontSize: 13, fontWeight: 500, color: 'var(--accent)',
                  background: 'var(--accent-dim)', border: '1px solid rgba(124,92,252,0.25)',
                  borderRadius: 8, padding: '8px 18px', cursor: 'pointer',
                }}
              >
                + Ajouter un prospect
              </button>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                {['Prospect', 'Statut', 'Montant', 'Dernier contact', 'Notes'].map(col => (
                  <th key={col} style={{
                    padding: '12px 18px', textAlign: 'left',
                    fontSize: 11.5, fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const since = daysSince(tsToDate(p.lastContact));
                const stale = since > 5 && p.status !== 'signé' && p.status !== 'perdu';
                return (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/clients/${p.id}`)}
                    style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      cursor: 'pointer', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Name + avatar + tags */}
                    <td style={{ padding: '15px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                          background: `linear-gradient(135deg, ${STATUS_BG[p.status]}, ${STATUS_COLOR[p.status]}22)`,
                          border: `1px solid ${STATUS_COLOR[p.status]}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: STATUS_COLOR[p.status],
                        }}>
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>{p.name}</div>
                          {(p.tags ?? []).length > 0 && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                              {(p.tags ?? []).map(tag => (
                                <span key={tag} style={{
                                  fontSize: 10.5, padding: '1px 7px', borderRadius: 20, fontWeight: 500,
                                  background: 'var(--accent-dim)', color: 'var(--accent)',
                                  border: '1px solid rgba(124,92,252,0.2)',
                                }}>#{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '15px 18px' }}><StatusBadge status={p.status} /></td>

                    {/* Amount */}
                    <td style={{ padding: '15px 18px' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: p.amount > 0 ? 'var(--text)' : 'var(--text-muted)', letterSpacing: '-0.3px' }}>
                        {p.amount > 0 ? formatCurrency(p.amount) : '—'}
                      </span>
                    </td>

                    {/* Last contact */}
                    <td style={{ padding: '15px 18px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 13, color: stale ? '#f59e0b' : 'var(--text-dim)' }}>
                          {formatDate(tsToDate(p.lastContact))}
                        </span>
                        {stale && (
                          <span style={{
                            fontSize: 11, color: '#f59e0b',
                            display: 'flex', alignItems: 'center', gap: 3,
                          }}>
                            ⚠ {since}j sans contact
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Notes */}
                    <td style={{ padding: '15px 18px', maxWidth: 240 }}>
                      <span style={{
                        display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                        fontSize: 13, color: 'var(--text-muted)',
                      }}>
                        {p.notes || '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal.open && <ProspectModal prospect={modal.prospect} onClose={() => setModal({ open: false })} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}
