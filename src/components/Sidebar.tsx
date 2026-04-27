import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useTheme } from '../contexts/ThemeContext';
import { useColorScheme } from '../hooks/useColorScheme';
import { useNotifications } from '../hooks/useNotifications';
import { useToast } from '../contexts/ToastContext';
import type { Prospect } from '../types';
import { tsToDate } from '../types';

const GridIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
  </svg>
);
const FunnelIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 3H2l8 9.46V19l4 2V12.46L22 3z"/>
  </svg>
);
const UsersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const ZapIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const CalendarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const SettingsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const TeamIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const LogOutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const buildNavItems = (reminderCount: number, base = '') => [
  { to: base + '/', label: 'Dashboard', icon: <GridIcon />, badge: reminderCount, id: 'tour-dashboard' },
  { to: base + '/pipeline', label: 'Pipeline', icon: <FunnelIcon />, badge: 0, id: 'tour-pipeline' },
  { to: base + '/clients', label: 'Prospects', icon: <UsersIcon />, badge: 0, id: 'tour-clients' },
  { to: base + '/agenda', label: 'Agenda', icon: <CalendarIcon />, badge: reminderCount, id: 'tour-agenda' },
  { to: base + '/automations', label: 'Automations', icon: <ZapIcon />, badge: 0, id: undefined },
  { to: base + '/settings', label: 'Paramètres', icon: <SettingsIcon />, badge: 0, id: 'tour-settings' },
];

export default function Sidebar({ basePath = '' }: { basePath?: string }) {
  const { user, signOut } = useAuth();
  const { workspaceUid, sharedWorkspaces, pendingInvitations, switchWorkspace, acceptInvitation, declineInvitation, isOwn } = useWorkspace();
  const { settings, plan } = useTheme();
  const { scheme, toggle } = useColorScheme();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [reminderCount, setReminderCount] = useState(0);
  const [overdueProspects, setOverdueProspects] = useState<Prospect[]>([]);
  const [reminderPanelOpen, setReminderPanelOpen] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  const toastedRef = useRef(false);

  useEffect(() => {
    if ('Notification' in window) setNotifPermission(Notification.permission);
  }, []);

  const requestNotifPermission = async () => {
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };

  useNotifications(overdueProspects);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'users', workspaceUid, 'prospects'), snap => {
      const now = new Date(); now.setHours(23, 59, 59, 999);
      const overdue = snap.docs
        .filter(d => { const data = d.data() as Prospect; return data.reminderDate && tsToDate(data.reminderDate) <= now; })
        .map(d => ({ id: d.id, ...d.data() } as Prospect));
      setOverdueProspects(overdue);
      setReminderCount(overdue.length);
    });
    return unsub;
  }, [user, workspaceUid]);

  useEffect(() => {
    document.title = reminderCount > 0 ? `(${reminderCount}) ${settings.appName}` : settings.appName;
  }, [reminderCount, settings]);

  useEffect(() => {
    if (toastedRef.current || overdueProspects.length === 0) return;
    toastedRef.current = true;
    if (overdueProspects.length <= 3) {
      overdueProspects.forEach(p => showToast(`🔔 ${p.name} — rappel aujourd'hui`, 'info'));
    } else {
      showToast(`🔔 ${overdueProspects.length} rappels en attente aujourd'hui`, 'info');
    }
  }, [overdueProspects]);

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email ?? '').slice(0, 2).toUpperCase();
  const displayLabel = user?.displayName || user?.email?.split('@')[0] || 'Utilisateur';

  return (
    <aside style={{
      width: 220, minHeight: '100vh',
      position: 'fixed', left: 0, top: 0,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      zIndex: 100,
    }}>

      {/* Logo */}
      <div style={{ padding: '18px 16px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
            boxShadow: '0 0 16px rgba(124,92,252,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3"/>
              <circle cx="12" cy="12" r="7" opacity=".5"/>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {settings.appName}
            </div>
            {settings.tagline && (
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {settings.tagline}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notification permission banner */}
      {notifPermission === 'default' && (
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(245,158,11,0.05)' }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.4 }}>
            🔔 Activer les rappels navigateur
          </div>
          <button
            onClick={requestNotifPermission}
            style={{
              width: '100%', padding: '6px 0', borderRadius: 7, fontSize: 12, fontWeight: 600,
              background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(124,92,252,0.3)',
            }}
          >
            Autoriser
          </button>
        </div>
      )}

      {/* Pending invitations */}
      {pendingInvitations.map(inv => (
        <div key={inv.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(124,92,252,0.05)' }}>
          <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, marginBottom: 8, lineHeight: 1.4 }}>
            👥 <strong>{inv.ownerName}</strong> t'invite à collaborer
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => acceptInvitation(inv)} style={{ flex: 1, padding: '5px 0', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer' }}>
              Accepter
            </button>
            <button onClick={() => declineInvitation(inv.id)} style={{ flex: 1, padding: '5px 0', borderRadius: 7, fontSize: 12, fontWeight: 500, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              Refuser
            </button>
          </div>
        </div>
      ))}

      {/* Workspace switcher */}
      {sharedWorkspaces.length > 0 && (
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4, paddingLeft: 6 }}>
            Espace de travail
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[{ id: user!.uid, label: 'Mes prospects', ownerId: user!.uid }, ...sharedWorkspaces.map(ws => ({ id: ws.id, label: ws.ownerName, ownerId: ws.ownerId }))].map(ws => {
              const active = workspaceUid === ws.ownerId;
              return (
                <button
                  key={ws.id}
                  onClick={() => switchWorkspace(ws.ownerId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', borderRadius: 8, fontSize: 12.5, fontWeight: active ? 600 : 400,
                    background: active ? 'var(--accent-dim)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? 'var(--accent)' : 'var(--border)', flexShrink: 0, boxShadow: active ? '0 0 5px var(--accent)' : 'none' }} />
                  {ws.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 9,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontSize: 12.5, cursor: 'pointer',
            justifyContent: 'space-between', transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(124,92,252,0.4)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            Rechercher…
          </div>
          <kbd style={{ fontSize: 10, opacity: 0.5, fontFamily: 'inherit', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>⌘K</kbd>
        </button>
      </div>

      {/* Reminder panel */}
      {reminderCount > 0 && (
        <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setReminderPanelOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 14px', background: 'rgba(245,158,11,0.06)',
              border: 'none', cursor: 'pointer', justifyContent: 'space-between',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.06)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#f59e0b' }}>
                {reminderCount} rappel{reminderCount > 1 ? 's' : ''}
              </span>
            </div>
            <span style={{ fontSize: 9, color: '#f59e0b', opacity: 0.6 }}>{reminderPanelOpen ? '▲' : '▼'}</span>
          </button>

          {reminderPanelOpen && (
            <div style={{ padding: '4px 8px 8px', background: 'rgba(245,158,11,0.03)' }}>
              {overdueProspects.map(p => (
                <button
                  key={p.id}
                  onClick={() => { navigate(`/clients/${p.id}`); setReminderPanelOpen(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 8px', borderRadius: 7,
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '10px 8px' }}>
        {buildNavItems(reminderCount, basePath).map(({ to, label, icon, badge, id }) => (
          <NavLink
            key={to}
            id={id}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 9, marginBottom: 2,
              color: isActive ? 'white' : 'var(--text-dim)',
              background: isActive ? 'linear-gradient(135deg, var(--accent), #8b6ff7)' : 'transparent',
              fontSize: 13.5, fontWeight: isActive ? 600 : 400,
              transition: 'all 0.15s',
              boxShadow: isActive ? '0 2px 12px rgba(124,92,252,0.3)' : 'none',
              textDecoration: 'none',
            })}
            onMouseEnter={e => {
              const el = e.currentTarget;
              if (!el.getAttribute('aria-current')) {
                el.style.background = 'var(--surface-2)';
                el.style.color = 'var(--text)';
              }
            }}
            onMouseLeave={e => {
              const el = e.currentTarget;
              if (!el.getAttribute('aria-current')) {
                el.style.background = 'transparent';
                el.style.color = 'var(--text-dim)';
              }
            }}
          >
            {icon}
            <span style={{ flex: 1 }}>{label}</span>
            {badge > 0 && (
              <span style={{
                background: '#f59e0b', color: '#000',
                fontSize: 10, fontWeight: 700,
                padding: '1px 6px', borderRadius: 20, lineHeight: '16px', minWidth: 18, textAlign: 'center',
              }}>
                {badge}
              </span>
            )}
          </NavLink>
        ))}

        {isOwn && plan === 'agence' && (
          <NavLink
            to={basePath + '/team'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 9, marginBottom: 2,
              color: isActive ? 'white' : 'var(--text-dim)',
              background: isActive ? 'linear-gradient(135deg, var(--accent), #8b6ff7)' : 'transparent',
              fontSize: 13.5, fontWeight: isActive ? 600 : 400,
              transition: 'all 0.15s',
              boxShadow: isActive ? '0 2px 12px rgba(124,92,252,0.3)' : 'none',
              textDecoration: 'none',
            })}
            onMouseEnter={e => {
              const el = e.currentTarget;
              if (!el.getAttribute('aria-current')) {
                el.style.background = 'var(--surface-2)';
                el.style.color = 'var(--text)';
              }
            }}
            onMouseLeave={e => {
              const el = e.currentTarget;
              if (!el.getAttribute('aria-current')) {
                el.style.background = 'transparent';
                el.style.color = 'var(--text-dim)';
              }
            }}
          >
            <TeamIcon />
            <span style={{ flex: 1 }}>Équipe</span>
          </NavLink>
        )}
      </nav>

      {/* User */}
      <div style={{
        padding: '12px 12px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 9,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11.5, fontWeight: 700, color: 'white',
          boxShadow: '0 2px 8px rgba(124,92,252,0.35)',
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayLabel}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>Freelance</div>
        </div>
        <button
          onClick={toggle}
          title={scheme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', width: 28, height: 28,
            borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, cursor: 'pointer', fontSize: 13,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          {scheme === 'dark' ? '☀' : '☾'}
        </button>
        <button
          onClick={signOut}
          title="Se déconnecter"
          style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', width: 28, height: 28,
            borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, cursor: 'pointer',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <LogOutIcon />
        </button>
      </div>
    </aside>
  );
}
