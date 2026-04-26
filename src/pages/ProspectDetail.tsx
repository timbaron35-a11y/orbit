import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc, getDoc, collection, onSnapshot,
  addDoc, updateDoc, deleteDoc, Timestamp, orderBy, query,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useToast } from '../contexts/ToastContext';
import type { Prospect } from '../types';
import { STATUS_LABEL, STATUS_COLOR, STATUS_BG, formatCurrency, formatDate } from '../types';
import { tsToDate } from '../types';
import ProspectModal from '../components/ProspectModal';
import CallRecorder from '../components/CallRecorder';

type ActivityType = 'note' | 'appel' | 'email' | 'relance';

interface Activity {
  id: string;
  type: ActivityType;
  content: string;
  subject?: string;
  duration?: number;
  createdAt: Timestamp;
}

const ACTIVITY_CONFIG: Record<ActivityType, { label: string; icon: string; color: string; placeholder: string }> = {
  note:    { label: 'Note',    icon: '📝', color: '#a78bfa', placeholder: 'Contexte, observation, point clé…' },
  appel:   { label: 'Appel',   icon: '📞', color: '#22c55e', placeholder: 'Résumé de la conversation…' },
  email:   { label: 'Email',   icon: '✉️', color: '#3b82f6', placeholder: 'Contenu ou résumé de l\'email…' },
  relance: { label: 'Relance', icon: '🔔', color: '#f59e0b', placeholder: 'Action de relance effectuée…' },
};

const TYPES: ActivityType[] = ['note', 'appel', 'email', 'relance'];

function timeAgo(ts: Timestamp): string {
  const diff = Math.floor((Date.now() - tsToDate(ts).getTime()) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 2) return 'Hier';
  return formatDate(tsToDate(ts));
}

export default function ProspectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspaceUid, isViewer } = useWorkspace();
  const { showToast } = useToast();

  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingProspect, setLoadingProspect] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [filterType, setFilterType] = useState<ActivityType | 'all'>('all');

  const [activityType, setActivityType] = useState<ActivityType>('note');
  const [activityContent, setActivityContent] = useState('');
  const [subject, setSubject] = useState('');
  const [duration, setDuration] = useState('');
  const [saving, setSaving] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    getDoc(doc(db, 'users', workspaceUid, 'prospects', id)).then(snap => {
      if (snap.exists()) setProspect({ id: snap.id, ...snap.data() } as Prospect);
      setLoadingProspect(false);
    });
  }, [user, id]);

  useEffect(() => {
    if (!user || !id) return;
    const q = query(
      collection(db, 'users', workspaceUid, 'prospects', id, 'activities'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, snap => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity)));
    });
  }, [user, id]);

  const handleAddActivity = async () => {
    if (!activityContent.trim() || !user || !id) return;
    setSaving(true);
    const data: Record<string, unknown> = {
      type: activityType,
      content: activityContent.trim(),
      createdAt: Timestamp.now(),
      authorEmail: user.email ?? 'inconnu',
    };
    if (activityType === 'email' && subject.trim()) data.subject = subject.trim();
    if (activityType === 'appel' && duration) data.duration = parseInt(duration, 10);
    await addDoc(collection(db, 'users', workspaceUid, 'prospects', id, 'activities'), data);
    showToast(`${ACTIVITY_CONFIG[activityType].label} enregistré`);
    setActivityContent('');
    setSubject('');
    setDuration('');
    setSaving(false);
  };

  const reloadProspect = () => {
    if (!user || !id) return;
    getDoc(doc(db, 'users', workspaceUid, 'prospects', id)).then(snap => {
      if (snap.exists()) setProspect({ id: snap.id, ...snap.data() } as Prospect);
    });
  };

  const filtered = filterType === 'all' ? activities : activities.filter(a => a.type === filterType);

  if (loadingProspect) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)', fontSize: 13 }}>
        Chargement…
      </div>
    );
  }

  if (!prospect) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Prospect introuvable.</div>
        <button onClick={() => navigate('/clients')} style={backBtnStyle}>← Retour</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 920 }}>
      <button onClick={() => navigate('/clients')} style={backBtnStyle}>← Clients</button>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginTop: 20, marginBottom: 32,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: STATUS_BG[prospect.status],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: STATUS_COLOR[prospect.status],
          }}>
            {prospect.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.3px' }}>
              {prospect.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
              <span style={{
                padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                color: STATUS_COLOR[prospect.status], background: STATUS_BG[prospect.status],
              }}>
                {STATUS_LABEL[prospect.status]}
              </span>
              {prospect.amount > 0 && (
                <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                  {formatCurrency(prospect.amount)}
                </span>
              )}
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                Dernier contact : {formatDate(tsToDate(prospect.lastContact))}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setEditOpen(true)}
          style={{
            padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ✏️ Modifier
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 20 }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <InfoCard prospect={prospect} activityCount={activities.length} />
          {prospect.notes && <NotesCard notes={prospect.notes} />}
          {(prospect.tags ?? []).length > 0 && <TagsCard tags={prospect.tags!} />}
        </div>

        {/* Right — activity journal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isViewer && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🔒</span> Accès lecture seule — vous ne pouvez pas ajouter d'activités
            </div>
          )}
          {!isViewer && <AddActivityCard
            activityType={activityType}
            setActivityType={t => { setActivityType(t); setSubject(''); setDuration(''); setShowRecorder(false); }}
            activityContent={activityContent}
            setActivityContent={setActivityContent}
            subject={subject}
            setSubject={setSubject}
            duration={duration}
            setDuration={setDuration}
            saving={saving}
            onSave={handleAddActivity}
            showRecorder={showRecorder}
            setShowRecorder={setShowRecorder}
            prospectName={prospect.name}
            onRecordingSaved={async ({ summary, transcript, durationSeconds }) => {
              if (!user || !id) return;
              setSaving(true);
              await addDoc(collection(db, 'users', workspaceUid, 'prospects', id, 'activities'), {
                type: 'appel',
                content: summary,
                subject: transcript,
                duration: Math.round(durationSeconds / 60) || 1,
                createdAt: Timestamp.now(),
                authorEmail: user.email ?? 'inconnu',
              });
              showToast('Appel transcrit et enregistré');
              setShowRecorder(false);
              setSaving(false);
            }}
          />}

          <JournalCard
            activities={filtered}
            total={activities.length}
            filterType={filterType}
            setFilterType={setFilterType}
            userId={workspaceUid}
            prospectId={id!}
          />
        </div>
      </div>

      {editOpen && (
        <ProspectModal
          prospect={prospect}
          onClose={() => { setEditOpen(false); reloadProspect(); }}
        />
      )}
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────── */

function InfoCard({ prospect, activityCount }: { prospect: Prospect; activityCount: number }) {
  return (
    <div style={card}>
      <SectionLabel>Informations</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <InfoRow label="Statut" value={
          <span style={{ color: STATUS_COLOR[prospect.status], fontWeight: 500 }}>
            {STATUS_LABEL[prospect.status]}
          </span>
        } />
        <InfoRow label="Montant" value={prospect.amount > 0 ? formatCurrency(prospect.amount) : '—'} />
        <InfoRow label="Dernier contact" value={formatDate(tsToDate(prospect.lastContact))} />
        {prospect.reminderDate && (
          <InfoRow label="Rappel" value={
            <span style={{ color: '#f59e0b' }}>
              🔔 {formatDate(tsToDate(prospect.reminderDate))}
            </span>
          } />
        )}
        {prospect.assignedTo && (
          <InfoRow label="Assigné à" value={
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid rgba(124,92,252,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                {prospect.assignedTo.slice(0, 2).toUpperCase()}
              </div>
              {prospect.assignedTo}
            </span>
          } />
        )}
        <InfoRow label="Activités" value={`${activityCount} entrée${activityCount > 1 ? 's' : ''}`} />
      </div>
    </div>
  );
}

function NotesCard({ notes }: { notes: string }) {
  return (
    <div style={card}>
      <SectionLabel>Notes</SectionLabel>
      <p style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.65, margin: 0 }}>{notes}</p>
    </div>
  );
}

function TagsCard({ tags }: { tags: string[] }) {
  return (
    <div style={card}>
      <SectionLabel>Tags</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tags.map(tag => (
          <span key={tag} style={{
            padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
            background: 'var(--accent-dim)', color: 'var(--accent)',
            border: '1px solid rgba(124,92,252,0.25)',
          }}>{tag}</span>
        ))}
      </div>
    </div>
  );
}

function AddActivityCard({
  activityType, setActivityType, activityContent, setActivityContent,
  subject, setSubject, duration, setDuration, saving, onSave,
  showRecorder, setShowRecorder, prospectName, onRecordingSaved,
}: {
  activityType: ActivityType; setActivityType: (t: ActivityType) => void;
  activityContent: string; setActivityContent: (v: string) => void;
  subject: string; setSubject: (v: string) => void;
  duration: string; setDuration: (v: string) => void;
  saving: boolean; onSave: () => void;
  showRecorder: boolean; setShowRecorder: (v: boolean) => void;
  prospectName: string;
  onRecordingSaved: (r: { summary: string; transcript: string; durationSeconds: number }) => void;
}) {
  const cfg = ACTIVITY_CONFIG[activityType];
  return (
    <div style={card}>
      <SectionLabel>Ajouter une entrée</SectionLabel>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {TYPES.map(t => (
          <button
            key={t}
            onClick={() => setActivityType(t)}
            style={{
              padding: '6px 11px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
              border: '1px solid',
              background: activityType === t ? `${ACTIVITY_CONFIG[t].color}18` : 'transparent',
              borderColor: activityType === t ? ACTIVITY_CONFIG[t].color : 'var(--border)',
              color: activityType === t ? ACTIVITY_CONFIG[t].color : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {ACTIVITY_CONFIG[t].icon} {ACTIVITY_CONFIG[t].label}
          </button>
        ))}
      </div>

      {/* Call recorder toggle */}
      {activityType === 'appel' && !showRecorder && (
        <button
          onClick={() => setShowRecorder(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '10px 14px', borderRadius: 9, marginBottom: 12,
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
            color: '#22c55e', fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 18 }}>🎙️</span>
          Enregistrer et transcrire automatiquement
          <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7, background: 'rgba(34,197,94,0.15)', padding: '2px 7px', borderRadius: 20 }}>
            IA
          </span>
        </button>
      )}

      {activityType === 'appel' && showRecorder && (
        <div style={{ marginBottom: 12 }}>
          <CallRecorder
            prospectName={prospectName}
            onSave={onRecordingSaved}
            onCancel={() => setShowRecorder(false)}
          />
        </div>
      )}

      {!showRecorder && (
        <>
          {activityType === 'email' && (
            <input
              className="orbit-input"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Objet de l'email…"
              style={{ marginBottom: 10, fontSize: 13 }}
            />
          )}
          {activityType === 'appel' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input
                className="orbit-input"
                type="number"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                placeholder="Durée (min)"
                min="1"
                style={{ width: 130, fontSize: 13 }}
              />
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>minutes</span>
            </div>
          )}

          <textarea
            className="orbit-input"
            value={activityContent}
            onChange={e => setActivityContent(e.target.value)}
            placeholder={cfg.placeholder}
            rows={3}
            style={{ resize: 'none', marginBottom: 10, lineHeight: 1.6 }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSave(); }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>⌘↵ pour sauvegarder</span>
            <button
              onClick={onSave}
              disabled={!activityContent.trim() || saving}
              style={{
                padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: activityContent.trim() ? 'var(--accent)' : 'var(--surface-2)',
                color: activityContent.trim() ? 'white' : 'var(--text-muted)',
                border: 'none', opacity: saving ? 0.7 : 1, transition: 'background 0.15s',
              }}
            >
              {saving ? '…' : 'Enregistrer'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function JournalCard({
  activities, total, filterType, setFilterType, userId, prospectId,
}: {
  activities: Activity[]; total: number;
  filterType: ActivityType | 'all'; setFilterType: (f: ActivityType | 'all') => void;
  userId: string; prospectId: string;
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <SectionLabel style={{ margin: 0 }}>Journal d'activité</SectionLabel>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total}</span>
        </div>
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <FilterTab active={filterType === 'all'} onClick={() => setFilterType('all')} color="var(--accent)">
            Tout
          </FilterTab>
          {TYPES.map(t => (
            <FilterTab
              key={t} active={filterType === t}
              onClick={() => setFilterType(t)} color={ACTIVITY_CONFIG[t].color}
            >
              {ACTIVITY_CONFIG[t].icon} {ACTIVITY_CONFIG[t].label}
            </FilterTab>
          ))}
        </div>
      </div>

      {activities.length === 0 ? (
        <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          {filterType === 'all' ? 'Aucune activité pour l\'instant.' : `Aucune entrée de type "${ACTIVITY_CONFIG[filterType as ActivityType]?.label}".`}
        </div>
      ) : (
        <div style={{ maxHeight: 460, overflowY: 'auto' }}>
          {activities.map((a, i) => (
            <ActivityEntry
              key={a.id}
              activity={a}
              isLast={i === activities.length - 1}
              userId={userId}
              prospectId={prospectId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityEntry({ activity: a, isLast, userId, prospectId }: {
  activity: Activity; isLast: boolean; userId: string; prospectId: string;
}) {
  const cfg = ACTIVITY_CONFIG[a.type];
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(a.content);
  const [editSubject, setEditSubject] = useState(a.subject ?? '');
  const [editDuration, setEditDuration] = useState(a.duration?.toString() ?? '');
  const [showMenu, setShowMenu] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUpdate = async () => {
    setSaving(true);
    const data: Record<string, unknown> = { content: editContent.trim() };
    if (a.type === 'email') data.subject = editSubject.trim();
    if (a.type === 'appel') data.duration = editDuration ? parseInt(editDuration, 10) : null;
    await updateDoc(doc(db, 'users', userId, 'prospects', prospectId, 'activities', a.id), data);
    setSaving(false);
    setEditing(false);
  };

  const handleDelete = async () => {
    await deleteDoc(doc(db, 'users', userId, 'prospects', prospectId, 'activities', a.id));
  };

  return (
    <div style={{
      display: 'flex', gap: 12, padding: '14px 18px',
      borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
      position: 'relative',
    }}>
      {/* Icon */}
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0, marginTop: 1,
        background: `${cfg.color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14,
      }}>
        {cfg.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
          {a.type === 'appel' && a.duration && (
            <span style={{
              fontSize: 11, padding: '1px 7px', borderRadius: 20, fontWeight: 500,
              background: `${cfg.color}15`, color: cfg.color,
            }}>
              ⏱ {a.duration} min
            </span>
          )}
          {a.type === 'email' && a.subject && (
            <span style={{
              fontSize: 11.5, color: 'var(--text-dim)', fontStyle: 'italic',
            }}>
              "{a.subject}"
            </span>
          )}
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {timeAgo(a.createdAt)}
          </span>
        </div>

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {a.type === 'email' && (
              <input
                className="orbit-input"
                value={editSubject}
                onChange={e => setEditSubject(e.target.value)}
                placeholder="Objet…"
                style={{ fontSize: 13 }}
              />
            )}
            {a.type === 'appel' && (
              <input
                className="orbit-input"
                type="number"
                value={editDuration}
                onChange={e => setEditDuration(e.target.value)}
                placeholder="Durée (min)"
                style={{ width: 120, fontSize: 13 }}
              />
            )}
            <textarea
              className="orbit-input"
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={3}
              style={{ resize: 'none', fontSize: 13, lineHeight: 1.6 }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleUpdate}
                disabled={!editContent.trim() || saving}
                style={{
                  padding: '6px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                  background: 'var(--accent)', color: 'white', border: 'none',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? '…' : 'Sauvegarder'}
              </button>
              <button
                onClick={() => setEditing(false)}
                style={{
                  padding: '6px 12px', borderRadius: 7, fontSize: 12.5,
                  background: 'transparent', color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 13.5, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>
            {a.content}
          </p>
        )}
      </div>

      {/* Context menu */}
      {!editing && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              padding: '4px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 16, lineHeight: 1,
              opacity: showMenu ? 1 : 0.4, transition: 'opacity 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => { if (!showMenu) e.currentTarget.style.opacity = '0.4'; }}
          >
            ···
          </button>
          {showMenu && (
            <>
              <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
              <div style={{
                position: 'absolute', right: 0, top: '110%',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 9, padding: 5, zIndex: 20, minWidth: 120,
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              }}>
                <MenuItem onClick={() => { setEditing(true); setShowMenu(false); }}>✏️ Modifier</MenuItem>
                <MenuItem onClick={handleDelete} danger>🗑 Supprimer</MenuItem>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FilterTab({ active, onClick, color, children }: {
  active: boolean; onClick: () => void; color: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px', borderRadius: 7, fontSize: 12, fontWeight: 500,
        border: '1px solid',
        background: active ? `${color}18` : 'transparent',
        borderColor: active ? color : 'var(--border)',
        color: active ? color : 'var(--text-muted)',
        transition: 'all 0.12s',
      }}
    >
      {children}
    </button>
  );
}

function MenuItem({ onClick, danger, children }: {
  onClick: () => void; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '7px 12px', borderRadius: 6, fontSize: 13,
        background: 'none', border: 'none',
        color: danger ? '#ef4444' : 'var(--text)', cursor: 'pointer',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 11.5, fontWeight: 500, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14,
      ...style,
    }}>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 12, padding: '18px 20px',
};

const backBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none',
  color: 'var(--text-muted)', fontSize: 13, fontWeight: 500,
  padding: 0, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 4,
};
