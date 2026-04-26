import { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import type { Prospect, ProspectStatus } from '../types';
import { STATUS_LABEL, STATUS_COLOR, STATUS_BG } from '../types';
import { tsToDate } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  prospect?: Prospect;
  onClose: () => void;
}

const STATUSES: ProspectStatus[] = ['nouveau', 'contacté', 'devis', 'signé', 'perdu'];

const toDateInput = (ts: { toDate: () => Date }) =>
  tsToDate(ts).toISOString().split('T')[0];

const todayInput = () => new Date().toISOString().split('T')[0];

export default function ProspectModal({ prospect, onClose }: Props) {
  const { user } = useAuth();
  const { workspaceUid, isViewer, myCollaborators, isOwn } = useWorkspace();
  const { showToast } = useToast();
  const { plan } = useTheme();
  const isEdit = !!prospect;

  const [name, setName] = useState(prospect?.name ?? '');
  const [email, setEmail] = useState(prospect?.email ?? '');
  const [phone, setPhone] = useState(prospect?.phone ?? '');
  const [company, setCompany] = useState(prospect?.company ?? '');
  const [status, setStatus] = useState<ProspectStatus>(prospect?.status ?? 'nouveau');
  const [amount, setAmount] = useState(prospect?.amount?.toString() ?? '');
  const [lastContact, setLastContact] = useState(prospect ? toDateInput(prospect.lastContact) : todayInput());
  const [notes, setNotes] = useState(prospect?.notes ?? '');
  const [tags, setTags] = useState<string[]>(prospect?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [reminderDate, setReminderDate] = useState(
    prospect?.reminderDate ? toDateInput(prospect.reminderDate) : ''
  );
  const [assignedTo, setAssignedTo] = useState(prospect?.assignedTo ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const teamMembers = isOwn
    ? [
        { email: user?.email ?? '', label: 'Moi' },
        ...myCollaborators.filter(i => i.status === 'accepted').map(i => ({ email: i.collaboratorEmail, label: i.collaboratorEmail })),
      ]
    : [];

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    if (!user) return;
    try {
      if (isEdit) {
        const data: Record<string, unknown> = {
          name: name.trim(), status,
          email: email.trim() || deleteField(),
          phone: phone.trim() || deleteField(),
          company: company.trim() || deleteField(),
          amount: parseFloat(amount) || 0,
          lastContact: Timestamp.fromDate(new Date(lastContact + 'T12:00:00')),
          notes: notes.trim(), tags,
          reminderDate: reminderDate
            ? Timestamp.fromDate(new Date(reminderDate + 'T12:00:00'))
            : deleteField(),
          assignedTo: assignedTo || deleteField(),
        };
        await updateDoc(doc(db, 'users', workspaceUid, 'prospects', prospect.id), data);
        showToast('Prospect mis à jour');
      } else {
        const data: Record<string, unknown> = {
          name: name.trim(), status,
          email: email.trim() || null,
          phone: phone.trim() || null,
          company: company.trim() || null,
          amount: parseFloat(amount) || 0,
          lastContact: Timestamp.fromDate(new Date(lastContact + 'T12:00:00')),
          notes: notes.trim(), tags,
          createdByEmail: user.email ?? 'inconnu',
        };
        if (reminderDate) data.reminderDate = Timestamp.fromDate(new Date(reminderDate + 'T12:00:00'));
        if (assignedTo) data.assignedTo = assignedTo;
        await addDoc(collection(db, 'users', workspaceUid, 'prospects'), data);
        showToast(`${name.trim()} ajouté`);
      }
      onClose();
    } catch {
      showToast('Erreur lors de l\'enregistrement', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!prospect?.id || !user) return;
    await deleteDoc(doc(db, 'users', workspaceUid, 'prospects', prospect.id));
    showToast('Prospect supprimé', 'info');
    onClose();
  };

  const initials = name.trim().slice(0, 2).toUpperCase() || '??';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 200,
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.15s ease',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0,
        width: 440,
        background: 'var(--bg)',
        borderLeft: '1px solid var(--border)',
        zIndex: 201,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.4)',
      }}>

        {/* Top accent line */}
        <div style={{ height: 2, background: `linear-gradient(90deg, var(--accent), #a78bfa, transparent)`, flexShrink: 0 }} />

        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 14,
          flexShrink: 0,
        }}>
          {/* Avatar */}
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: `linear-gradient(135deg, ${STATUS_BG[status]}, ${STATUS_COLOR[status]}22)`,
            border: `1px solid ${STATUS_COLOR[status]}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: STATUS_COLOR[status],
          }}>
            {initials}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isEdit ? prospect.name : 'Nouveau prospect'}
            </h2>
            {isEdit && (
              <div style={{
                marginTop: 3,
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '2px 8px', borderRadius: 20,
                background: STATUS_BG[prospect.status],
                fontSize: 11.5, fontWeight: 600, color: STATUS_COLOR[prospect.status],
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR[prospect.status], flexShrink: 0 }} />
                {STATUS_LABEL[prospect.status]}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, width: 32, height: 32, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >×</button>
        </div>

        {/* Form */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          <Field label="Nom du prospect">
            <input
              className="orbit-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex : Agence Lumière"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </Field>

          <Field label="Email">
            <input
              className="orbit-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="contact@exemple.com"
            />
          </Field>

          <Field label="Téléphone">
            <input
              className="orbit-input"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+33 6 12 34 56 78"
            />
          </Field>

          <Field label="Entreprise">
            <input
              className="orbit-input"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Nom de l'entreprise"
            />
          </Field>

          {/* Status pills */}
          <Field label="Statut">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {STATUSES.map(s => {
                const active = status === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: active ? STATUS_BG[s] : 'transparent',
                      color: active ? STATUS_COLOR[s] : 'var(--text-muted)',
                      border: active ? `1.5px solid ${STATUS_COLOR[s]}50` : '1.5px solid var(--border)',
                      boxShadow: active ? `0 0 8px ${STATUS_COLOR[s]}30` : 'none',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = STATUS_COLOR[s]; e.currentTarget.style.color = STATUS_COLOR[s]; } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Montant estimé (€)">
            <input
              className="orbit-input"
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              min="0"
              step="100"
            />
          </Field>

          <Field label="Dernier contact">
            <input
              className="orbit-input"
              type="date"
              value={lastContact}
              onChange={e => setLastContact(e.target.value)}
            />
          </Field>

          <Field label="Rappel">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="orbit-input"
                type="date"
                value={reminderDate}
                onChange={e => setReminderDate(e.target.value)}
                style={{ flex: 1 }}
              />
              {reminderDate && (
                <button
                  onClick={() => setReminderDate('')}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 7, color: 'var(--text-muted)', fontSize: 16, lineHeight: 1,
                    padding: '6px 8px', flexShrink: 0, cursor: 'pointer',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  title="Supprimer le rappel"
                >×</button>
              )}
            </div>
            {reminderDate && (
              <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b80', flexShrink: 0 }} />
                Rappel le {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date(reminderDate + 'T12:00:00'))}
              </div>
            )}
          </Field>

          {plan === 'agence' && teamMembers.length > 1 && (
            <Field label="Assigné à">
              <select
                className="orbit-input"
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
              >
                <option value="">— Non assigné</option>
                {teamMembers.map(m => (
                  <option key={m.email} value={m.email}>{m.label}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Tags">
            <TagEditor tags={tags} setTags={setTags} tagInput={tagInput} setTagInput={setTagInput} />
          </Field>

          <Field label="Notes">
            <textarea
              className="orbit-input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Contexte, besoins, suivi…"
              rows={5}
              style={{ resize: 'vertical', lineHeight: 1.6 }}
            />
          </Field>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, alignItems: 'center',
          background: 'var(--bg)',
          flexShrink: 0,
        }}>
          {isViewer && (
            <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ opacity: 0.6 }}>🔒</span> Accès lecture seule
            </div>
          )}
          {!isViewer && isEdit && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; }}
            >
              Supprimer
            </button>
          )}

          {!isViewer && confirmDelete && (
            <>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)', flex: 1 }}>Supprimer définitivement ?</span>
              <button
                onClick={() => setConfirmDelete(false)}
                style={ghostBtn}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
              >Non</button>
              <button
                onClick={handleDelete}
                style={{ ...ghostBtn, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                Confirmer
              </button>
            </>
          )}

          {!isViewer && !confirmDelete && (
            <>
              <div style={{ flex: 1 }} />
              <button
                onClick={onClose}
                style={ghostBtn}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
              >Annuler</button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || saving}
                style={{
                  padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: name.trim() ? 'var(--accent)' : 'var(--surface-2)',
                  color: name.trim() ? 'white' : 'var(--text-muted)',
                  border: 'none', cursor: name.trim() ? 'pointer' : 'default',
                  opacity: saving ? 0.7 : 1,
                  transition: 'opacity 0.15s, box-shadow 0.15s',
                  boxShadow: name.trim() ? '0 4px 14px rgba(124,92,252,0.35)' : 'none',
                }}
                onMouseEnter={e => { if (name.trim() && !saving) e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,92,252,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = name.trim() ? '0 4px 14px rgba(124,92,252,0.35)' : 'none'; }}
              >
                {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const PRESET_TAGS = ['Design', 'Développement', 'Marketing', 'Consulting', 'E-commerce', 'Startup', 'PME', 'Urgent', 'Référence'];

function TagEditor({ tags, setTags, tagInput, setTagInput }: {
  tags: string[];
  setTags: (t: string[]) => void;
  tagInput: string;
  setTagInput: (s: string) => void;
}) {
  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };
  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag));

  const suggestions = PRESET_TAGS.filter(t => !tags.includes(t) && (!tagInput || t.toLowerCase().includes(tagInput.toLowerCase())));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map(tag => (
            <span key={tag} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: 'var(--accent-dim)', color: 'var(--accent)',
              border: '1px solid rgba(124,92,252,0.25)',
            }}>
              {tag}
              <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', color: 'var(--accent)', padding: 0, fontSize: 14, lineHeight: 1, opacity: 0.7, cursor: 'pointer' }}>×</button>
            </span>
          ))}
        </div>
      )}

      <input
        className="orbit-input"
        value={tagInput}
        onChange={e => setTagInput(e.target.value)}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) { e.preventDefault(); addTag(tagInput); }
          if (e.key === 'Backspace' && !tagInput && tags.length > 0) removeTag(tags[tags.length - 1]);
        }}
        placeholder="Ajouter un tag…"
        style={{ fontSize: 13 }}
      />

      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {suggestions.map(tag => (
            <button
              key={tag}
              onClick={() => addTag(tag)}
              style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 12,
                background: 'var(--surface-2)', color: 'var(--text-muted)',
                border: '1px solid var(--border)', cursor: 'pointer',
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
  background: 'transparent', color: 'var(--text-dim)',
  border: '1px solid var(--border)', cursor: 'pointer',
  transition: 'border-color 0.15s, color 0.15s',
};
