import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { Prospect } from '../types';
import { STATUS_LABEL, STATUS_COLOR, STATUS_BG, formatCurrency } from '../types';

export default function GlobalSearch() {
  const { user } = useAuth();
  const { workspaceUid } = useWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selected, setSelected] = useState(0);

  const openSearch = useCallback(async () => {
    if (!user) return;
    setOpen(true);
    setQuery('');
    setSelected(0);
    const snap = await getDocs(collection(db, 'users', workspaceUid, 'prospects'));
    setProspects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Prospect)));
  }, [user]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        open ? close() : openSearch();
      }
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, openSearch, close]);

  const results = query.trim()
    ? prospects.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.notes?.toLowerCase().includes(query.toLowerCase())
      )
    : prospects.slice(0, 6);

  useEffect(() => setSelected(0), [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[selected]) {
      navigate(`/clients/${results[selected].id}`);
      close();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 300,
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.1s ease',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', left: '50%', top: '20%',
        transform: 'translateX(-50%)',
        width: '100%', maxWidth: 540,
        zIndex: 301,
        animation: 'fadeIn 0.12s ease',
      }}>
        {/* Search input */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: results.length > 0 ? '12px 12px 0 0' : 12,
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher un prospect…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 15,
            }}
          />
          <kbd style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 5, padding: '2px 7px', fontSize: 11,
            color: 'var(--text-muted)', fontFamily: 'inherit',
          }}>esc</kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderTop: '1px solid var(--border-subtle)',
            borderRadius: '0 0 12px 12px',
            overflow: 'hidden',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
            maxHeight: 340,
            overflowY: 'auto',
          }}>
            {!query.trim() && (
              <div style={{ padding: '8px 16px 4px', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
                Récents
              </div>
            )}
            {results.map((p, i) => (
              <div
                key={p.id}
                onClick={() => { navigate(`/clients/${p.id}`); close(); }}
                onMouseEnter={() => setSelected(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px', cursor: 'pointer',
                  background: selected === i ? 'var(--surface-2)' : 'transparent',
                  borderBottom: i < results.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: STATUS_BG[p.status],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: STATUS_COLOR[p.status],
                }}>
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)' }}>
                    {p.name}
                  </div>
                  {p.notes && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginTop: 1 }}>
                      {p.notes}
                    </div>
                  )}
                </div>
                <span style={{
                  padding: '3px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 500,
                  color: STATUS_COLOR[p.status], background: STATUS_BG[p.status], flexShrink: 0,
                }}>
                  {STATUS_LABEL[p.status]}
                </span>
                {p.amount > 0 && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', flexShrink: 0 }}>
                    {formatCurrency(p.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {query.trim() && results.length === 0 && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderTop: '1px solid var(--border-subtle)',
            borderRadius: '0 0 12px 12px',
            padding: '20px 16px', textAlign: 'center',
            color: 'var(--text-muted)', fontSize: 13,
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          }}>
            Aucun résultat pour « {query} »
          </div>
        )}
      </div>
    </>
  );
}
