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
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '14px',
        marginBottom: 8,
        cursor: 'grab',
        transition: 'opacity 0.15s, border-color 0.15s, transform 0.15s',
        opacity: isDragging ? 0.35 : 1,
        transform: isDragging ? 'scale(0.97)' : 'scale(1)',
        userSelect: 'none',
      }}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.borderColor = '#3a3a3a'; }}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div style={{ fontWeight: 500, fontSize: 13.5, marginBottom: 6, color: 'var(--text)' }}>
        {prospect.name}
      </div>
      {prospect.assignedTo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid rgba(124,92,252,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
            {prospect.assignedTo.slice(0, 2).toUpperCase()}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {prospect.assignedTo.split('@')[0]}
          </span>
        </div>
      )}
      {prospect.amount > 0 && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
          {formatCurrency(prospect.amount)}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: needsFollowUp ? '#f59e0b' : 'var(--text-muted)' }}>
          {since === 0 ? "Aujourd'hui" : since === 1 ? 'Hier' : `${since}j`}
          {needsFollowUp && ' ⚠'}
        </span>
        <select
          value={prospect.status}
          onClick={e => e.stopPropagation()}
          onChange={e => onStatusChange(prospect.id, e.target.value as ProspectStatus)}
          style={{
            background: STATUS_BG[prospect.status],
            color: STATUS_COLOR[prospect.status],
            border: 'none', borderRadius: 20, padding: '3px 8px',
            fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
            outline: 'none', appearance: 'none',
          }}
        >
          {COLUMNS.map(s => (
            <option key={s} value={s} style={{ background: '#1a1a1a', color: 'var(--text)' }}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
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
      style={{ padding: '32px 36px', height: '100vh', display: 'flex', flexDirection: 'column' }}
      onDragEnd={() => { setDraggingId(null); setDragOverStatus(null); }}
    >
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.3px' }}>Pipeline</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 4 }}>
            {prospects.length} prospects · glissez les cartes entre les colonnes
          </p>
        </div>
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

      <div style={{ display: 'flex', gap: 12, flex: 1, overflowX: 'auto', paddingBottom: 8 }}>
        {COLUMNS.map(status => {
          const isOver = dragOverStatus === status;
          const isDragSource = draggingId !== null && grouped[status].some(p => p.id === draggingId);

          return (
            <div
              key={status}
              style={{ minWidth: 220, flex: '0 0 220px', display: 'flex', flexDirection: 'column', gap: 8 }}
              onDragOver={e => { e.preventDefault(); setDragOverStatus(status); }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverStatus(null);
                }
              }}
              onDrop={e => handleDrop(e, status)}
            >
              {/* Column header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px',
                background: isOver ? `${STATUS_COLOR[status]}10` : 'var(--surface)',
                border: '1px solid',
                borderColor: isOver ? STATUS_COLOR[status] : 'var(--border)',
                borderRadius: 10, marginBottom: 4,
                transition: 'border-color 0.15s, background 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[status], flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                    {STATUS_LABEL[status]}
                  </span>
                </div>
                <span style={{
                  background: 'var(--surface-2)', color: 'var(--text-muted)',
                  fontSize: 11.5, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                }}>
                  {grouped[status].length}
                </span>
              </div>

              {/* Drop zone + cards */}
              <div
                style={{
                  flex: 1, overflowY: 'auto',
                  borderRadius: 10,
                  border: isOver && !isDragSource ? `2px dashed ${STATUS_COLOR[status]}` : '2px solid transparent',
                  padding: isOver && !isDragSource ? 6 : 0,
                  transition: 'border-color 0.15s, padding 0.15s',
                  minHeight: 80,
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
                    border: `1px dashed ${isOver ? STATUS_COLOR[status] : 'var(--border)'}`,
                    borderRadius: 10, padding: '24px 14px', textAlign: 'center',
                    color: isOver ? STATUS_COLOR[status] : 'var(--text-muted)',
                    fontSize: 12, transition: 'all 0.15s',
                    background: isOver ? `${STATUS_COLOR[status]}08` : 'transparent',
                  }}>
                    {isOver ? 'Déposer ici' : 'Aucun prospect'}
                  </div>
                )}
              </div>

              {/* Column total */}
              {columnTotal(status) > 0 && (
                <div style={{
                  padding: '8px 12px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  fontSize: 12, color: 'var(--text-dim)',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>Total</span>
                  <span style={{ fontWeight: 600, color: STATUS_COLOR[status] }}>
                    {formatCurrency(columnTotal(status))}
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
