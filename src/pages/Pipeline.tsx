import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Prospect, ProspectStatus } from '../types';
import { STATUS_LABEL, STATUS_COLOR, STATUS_BG, formatCurrency, daysSince } from '../types';
import { tsToDate } from '../types';
import ProspectModal from '../components/ProspectModal';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

const COLUMNS: ProspectStatus[] = ['nouveau', 'contacté', 'devis', 'signé', 'perdu'];

function ProspectCard({
  prospect, onStatusChange, onEdit, isDragging,
}: {
  prospect: Prospect;
  onStatusChange: (id: string, status: ProspectStatus) => void;
  onEdit: (p: Prospect) => void;
  isDragging: boolean;
}) {
  const since = daysSince(tsToDate(prospect.lastContact));
  const needsFollowUp = since > 5 && prospect.status !== 'signé' && prospect.status !== 'perdu';

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('prospectId', prospect.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onEdit(prospect)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 8,
        cursor: 'grab',
        transition: 'opacity 0.15s, box-shadow 0.15s, transform 0.15s',
        opacity: isDragging ? 0.3 : 1,
        transform: isDragging ? 'scale(0.96) rotate(1deg)' : 'scale(1)',
        userSelect: 'none',
        boxShadow: isDragging ? 'none' : '0 1px 3px rgba(0,0,0,0.2)',
      }}
      onMouseEnter={e => {
        if (!isDragging) {
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
          e.currentTarget.style.borderColor = 'rgba(124,92,252,0.3)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {/* Name + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: prospect.amount > 0 ? 10 : 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: STATUS_BG[prospect.status],
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: STATUS_COLOR[prospect.status],
        }}>
          {prospect.name.slice(0, 2).toUpperCase()}
        </div>
        <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {prospect.name}
        </span>
      </div>

      {/* Amount */}
      {prospect.amount > 0 && (
        <div style={{
          fontSize: 15, fontWeight: 700, color: 'var(--text)',
          letterSpacing: '-0.3px', marginBottom: 10,
        }}>
          {formatCurrency(prospect.amount)}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontSize: 11.5,
          color: needsFollowUp ? '#f59e0b' : 'var(--text-muted)',
          background: needsFollowUp ? 'rgba(245,158,11,0.1)' : 'transparent',
          padding: needsFollowUp ? '2px 7px' : '0',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {needsFollowUp && <span style={{ fontSize: 10 }}>⚠</span>}
          {since === 0 ? "Auj." : since === 1 ? 'Hier' : `${since}j`}
        </span>
        <select
          value={prospect.status}
          onClick={e => e.stopPropagation()}
          onChange={e => onStatusChange(prospect.id, e.target.value as ProspectStatus)}
          style={{
            background: STATUS_BG[prospect.status],
            color: STATUS_COLOR[prospect.status],
            border: 'none', borderRadius: 20,
            padding: '3px 8px',
            fontSize: 11.5, fontWeight: 600,
            cursor: 'pointer', outline: 'none', appearance: 'none',
          }}
        >
          {COLUMNS.map(s => (
            <option key={s} value={s} style={{ background: '#1a1a1a', color: 'var(--text)' }}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Assignee */}
      {prospect.assignedTo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: 'var(--accent-dim)', border: '1px solid rgba(124,92,252,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 7, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
          }}>
            {prospect.assignedTo.slice(0, 1).toUpperCase()}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {prospect.assignedTo.split('@')[0]}
          </span>
        </div>
      )}
    </div>
  );
}

export default function Pipeline() {
  const { user } = useAuth();
  const { workspaceUid } = useWorkspace();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; prospect?: Prospect }>({ open: false });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ProspectStatus | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'users', workspaceUid, 'prospects'), snap => {
      setProspects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Prospect)));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const handleStatusChange = async (id: string, status: ProspectStatus) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', workspaceUid, 'prospects', id), { status });
  };

  const handleDrop = (e: React.DragEvent, status: ProspectStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('prospectId');
    if (id) handleStatusChange(id, status);
    setDraggingId(null);
    setDragOverStatus(null);
  };

  const grouped = COLUMNS.reduce((acc, status) => {
    acc[status] = prospects.filter(p => p.status === status);
    return acc;
  }, {} as Record<ProspectStatus, Prospect[]>);

  const columnTotal = (status: ProspectStatus) =>
    grouped[status].reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
        Chargement…
      </div>
    );
  }

  return (
    <div
      style={{ padding: '36px 40px', height: '100vh', display: 'flex', flexDirection: 'column' }}
      onDragEnd={() => { setDraggingId(null); setDragOverStatus(null); }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.5px' }}>Pipeline</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 6 }}>
            {prospects.length} prospect{prospects.length !== 1 ? 's' : ''} · glissez pour changer le statut
          </p>
        </div>
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
          Nouveau prospect
        </button>
      </div>

      {/* Columns */}
      <div style={{ display: 'flex', gap: 10, flex: 1, overflowX: 'auto', paddingBottom: 8 }}>
        {COLUMNS.map(status => {
          const isOver = dragOverStatus === status;
          const isDragSource = draggingId !== null && grouped[status].some(p => p.id === draggingId);
          const total = columnTotal(status);

          return (
            <div
              key={status}
              style={{ minWidth: 234, flex: '0 0 234px', display: 'flex', flexDirection: 'column', gap: 6 }}
              onDragOver={e => { e.preventDefault(); setDragOverStatus(status); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStatus(null); }}
              onDrop={e => handleDrop(e, status)}
            >
              {/* Column header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px',
                background: isOver ? `${STATUS_COLOR[status]}12` : 'var(--surface)',
                border: '1px solid',
                borderColor: isOver ? STATUS_COLOR[status] : 'var(--border)',
                borderRadius: 12,
                transition: 'border-color 0.15s, background 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: STATUS_COLOR[status], flexShrink: 0,
                    boxShadow: `0 0 6px ${STATUS_COLOR[status]}`,
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {STATUS_LABEL[status]}
                  </span>
                </div>
                <span style={{
                  background: `${STATUS_COLOR[status]}18`,
                  color: STATUS_COLOR[status],
                  fontSize: 11.5, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 20,
                  border: `1px solid ${STATUS_COLOR[status]}30`,
                }}>
                  {grouped[status].length}
                </span>
              </div>

              {/* Cards area */}
              <div
                style={{
                  flex: 1, overflowY: 'auto',
                  borderRadius: 12,
                  border: isOver && !isDragSource ? `2px dashed ${STATUS_COLOR[status]}60` : '2px solid transparent',
                  background: isOver && !isDragSource ? `${STATUS_COLOR[status]}06` : 'transparent',
                  padding: isOver && !isDragSource ? 6 : 0,
                  transition: 'all 0.15s',
                  minHeight: 100,
                }}
              >
                {grouped[status].map(p => (
                  <ProspectCard
                    key={p.id}
                    prospect={p}
                    onStatusChange={handleStatusChange}
                    onEdit={p => setModal({ open: true, prospect: p })}
                    isDragging={draggingId === p.id}
                  />
                ))}
                {grouped[status].length === 0 && (
                  <div style={{
                    border: `1.5px dashed ${isOver ? STATUS_COLOR[status] : 'var(--border)'}`,
                    borderRadius: 10, padding: '28px 14px', textAlign: 'center',
                    color: isOver ? STATUS_COLOR[status] : 'var(--text-muted)',
                    fontSize: 12.5, transition: 'all 0.15s',
                    background: isOver ? `${STATUS_COLOR[status]}08` : 'transparent',
                  }}>
                    {isOver ? '↓ Déposer ici' : 'Aucun prospect'}
                  </div>
                )}
              </div>

              {/* Column total */}
              {total > 0 && (
                <div style={{
                  padding: '9px 14px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>Total</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: STATUS_COLOR[status] }}>
                    {formatCurrency(total)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
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
