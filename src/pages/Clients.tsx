import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Prospect, ProspectStatus } from '../types';
import { STATUS_LABEL, STATUS_COLOR, STATUS_BG, formatCurrency, formatDate, daysSince } from '../types';

function exportCSV(prospects: Prospect[]) {
  const headers = ['Nom', 'Statut', 'Montant (€)', 'Dernier contact', 'Notes'];
  const rows = prospects.map(p => [
    `"${p.name.replace(/"/g, '""')}"`,
    STATUS_LABEL[p.status],
    p.amount.toString(),
    formatDate(p.lastContact.toDate()),
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
import ProspectModal from '../components/ProspectModal';
import ImportModal from '../components/ImportModal';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

const ALL_STATUSES: ProspectStatus[] = ['nouveau', 'contacté', 'devis', 'signé', 'perdu'];

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
      whiteSpace: 'nowrap',
    }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

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
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.3px' }}>Clients</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 4 }}>
            {prospects.length} prospects au total
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setImportOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 14px', borderRadius: 9,
              background: 'var(--surface)', color: 'var(--text-dim)',
              border: '1px solid var(--border)', fontSize: 13.5, fontWeight: 500,
            }}
          >
            ↑ Importer CSV
          </button>
          <button
            onClick={() => exportCSV(filtered)}
            disabled={filtered.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 14px', borderRadius: 9,
              background: 'var(--surface)', color: 'var(--text-dim)',
              border: '1px solid var(--border)', fontSize: 13.5, fontWeight: 500,
              opacity: filtered.length === 0 ? 0.4 : 1,
            }}
          >
            ↓ Exporter CSV
          </button>
          <button
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
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Search */}
        <input
          type="text"
          placeholder="Rechercher…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 14px',
            color: 'var(--text)',
            fontSize: 13.5,
            outline: 'none',
            width: 200,
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />

        {/* Status filters */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', ...ALL_STATUSES] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                background: filter === s ? (s === 'all' ? 'var(--accent)' : STATUS_BG[s]) : 'var(--surface)',
                color: filter === s ? (s === 'all' ? 'white' : STATUS_COLOR[s]) : 'var(--text-dim)',
                border: '1px solid',
                borderColor: filter === s ? (s === 'all' ? 'var(--accent)' : STATUS_COLOR[s]) : 'var(--border)',
                transition: 'all 0.15s',
              }}
            >
              {s === 'all' ? 'Tous' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 500,
                background: activeTag === tag ? 'var(--accent-dim)' : 'transparent',
                color: activeTag === tag ? 'var(--accent)' : 'var(--text-muted)',
                border: '1px solid',
                borderColor: activeTag === tag ? 'rgba(124,92,252,0.3)' : 'var(--border)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Aucun résultat
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const since = daysSince(p.lastContact.toDate());
                return (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/clients/${p.id}`)}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '13px 16px', fontWeight: 500, fontSize: 13.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: STATUS_BG[p.status],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: STATUS_COLOR[p.status], flexShrink: 0,
                        }}>
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div>{p.name}</div>
                          {(p.tags ?? []).length > 0 && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                              {(p.tags ?? []).map(tag => (
                                <span key={tag} style={{
                                  fontSize: 10.5, padding: '1px 7px', borderRadius: 20, fontWeight: 500,
                                  background: 'var(--accent-dim)', color: 'var(--accent)',
                                  border: '1px solid rgba(124,92,252,0.2)',
                                }}>{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px' }}><StatusBadge status={p.status} /></td>
                    <td style={{ padding: '13px 16px', fontWeight: 500, fontSize: 13.5 }}>
                      {p.amount > 0 ? formatCurrency(p.amount) : '—'}
                    </td>
                    <td style={{ padding: '13px 16px', color: since > 5 && p.status !== 'signé' && p.status !== 'perdu' ? '#f59e0b' : 'var(--text-dim)', fontSize: 13 }}>
                      {formatDate(p.lastContact.toDate())}
                      {since > 5 && p.status !== 'signé' && p.status !== 'perdu' && (
                        <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>⚠ {since}j</span>
                      )}
                    </td>
                    <td style={{ padding: '13px 16px', color: 'var(--text-muted)', fontSize: 13, maxWidth: 240 }}>
                      <span style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {p.notes || '—'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modal.open && (
        <ProspectModal
          prospect={modal.prospect}
          onClose={() => setModal({ open: false })}
        />
      )}

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}
