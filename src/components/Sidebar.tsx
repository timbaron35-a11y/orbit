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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
  </svg>
);

const FunnelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 3H2l8 9.46V19l4 2V12.46L22 3z"/>
  </svg>
);

const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const ZapIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const LogOutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const buildNavItems = (reminderCount: number) => [
  { to: '/', label: 'Dashboard', icon: <GridIcon />, badge: reminderCount, id: 'tour-dashboard' },
  { to: '/pipeline', label: 'Pipeline', icon: <FunnelIcon />, badge: 0, id: 'tour-pipeline' },
  { to: '/clients', label: 'Clients', icon: <UsersIcon />, badge: 0, id: 'tour-clients' },
  { to: '/agenda', label: 'Agenda', icon: <CalendarIcon />, badge: reminderCount, id: 'tour-agenda' },
  { to: '/automations', label: 'Automations', icon: <ZapIcon />, badge: 0, id: undefined },
  { to: '/settings', label: 'Paramètres', icon: <SettingsIcon />, badge: 0, id: 'tour-settings' },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const { workspaceUid, isOwn, sharedWorkspaces, pendingInvitations, switchWorkspace, acceptInvitation, declineInvitation } = useWorkspace();
  const { settings } = useTheme();
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
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      const overdue = snap.docs
        .filter(d => {
          const data = d.data() as Prospect;
          return data.reminderDate && tsToDate(data.reminderDate) <= now;
        })
        .map(d => ({ id: d.id, ...d.data() } as Prospect));
      setOverdueProspects(overdue);
      setReminderCount(overdue.length);
    });
    return unsub;
  }, [user, workspaceUid]);

  useEffect(() => {
    const { appName } = settings;
    document.title = reminderCount > 0 ? `(${reminderCount}) ${appName}` : appName;
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
      width: 220,
      minHeight: '100vh',
      position: 'fixed',
      left: 0, top: 0,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28,
            background: 'var(--accent)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3"/>
              <circle cx="12" cy="12" r="7" opacity=".5"/>
              <circle cx="12" cy="12" r="11" opacity=".2"/>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
        <div style={{
          padding: '9px 12px', borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(245,158,11,0.06)',
        }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 5, lineHeight: 1.4 }}>
            🔔 Activer les rappels
          </div>
          <button
            onClick={requestNotifPermission}
            style={{
              width: '100%', padding: '5px 0', borderRadius: 6, fontSize: 12, fontWeight: 500,
              background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
            }}
          >
            Autoriser les notifications
          </button>
        </div>
      )}

      {/* Pending invitations banner */}
      {pendingInvitations.map(inv => (
        <div key={inv.id} style={{
          padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(124,92,252,0.06)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, marginBottom: 6, lineHeight: 1.4 }}>
            👥 <strong>{inv.ownerName}</strong> t'invite à collaborer
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => acceptInvitation(inv)}
              style={{
                flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 12, fontWeight: 500,
                background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer',
              }}
            >Accepter</button>
            <button
              onClick={() => declineInvitation(inv.id)}
              style={{
                flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 12, fontWeight: 500,
                background: 'transparent', color: 'var(--text-muted)',
                border: '1px solid var(--border)', cursor: 'pointer',
              }}
            >Refuser</button>
          </div>
        </div>
      ))}

      {/* Workspace switcher */}
      {(sharedWorkspaces.length > 0) && (
        <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, marginBottom: 5, paddingLeft: 4 }}>
            Espace
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button
              onClick={() => switchWorkspace(user!.uid)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                background: isOwn ? 'var(--accent-dim)' : 'transparent',
                color: isOwn ? 'var(--accent)' : 'var(--text-muted)',
                border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOwn ? 'var(--accent)' : 'var(--border)', flexShrink: 0 }} />
              Mes prospects
            </button>
            {sharedWorkspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => switchWorkspace(ws.ownerId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 7, fontSize: 12.5, fontWeight: 500,
                  background: workspaceUid === ws.ownerId ? 'var(--accent-dim)' : 'transparent',
                  color: workspaceUid === ws.ownerId ? 'var(--accent)' : 'var(--text-muted)',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: workspaceUid === ws.ownerId ? 'var(--accent)' : 'var(--border)', flexShrink: 0 }} />
                {ws.ownerName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 8,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            Rechercher
          </div>
          <kbd style={{ fontSize: 10, opacity: 0.6, fontFamily: 'inherit' }}>⌘K</kbd>
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
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 13 }}>🔔</span>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: '#f59e0b' }}>
                {reminderCount} rappel{reminderCount > 1 ? 's' : ''} aujourd'hui
              </span>
            </div>
            <span style={{ fontSize: 10, color: '#f59e0b', opacity: 0.7 }}>
              {reminderPanelOpen ? '▲' : '▼'}
            </span>
          </button>

          {reminderPanelOpen && (
            <div style={{ padding: '4px 8px 8px' }}>
              {overdueProspects.map(p => (
                <button
                  key={p.id}
                  onClick={() => { navigate(`/clients/${p.id}`); setReminderPanelOpen(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 8px', borderRadius: 7,
                    background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#f59e0b', flexShrink: 0,
                  }} />
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
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {buildNavItems(reminderCount).map(({ to, label, icon, badge, id }) => (
          <NavLink
            key={to}
            id={id}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 10px',
              borderRadius: 8,
              marginBottom: 2,
              color: isActive ? 'white' : 'var(--text-dim)',
              background: isActive ? 'var(--accent)' : 'transparent',
              fontSize: 13.5,
              fontWeight: isActive ? 500 : 400,
              transition: 'all 0.15s',
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
                fontSize: 10.5, fontWeight: 700,
                padding: '1px 6px', borderRadius: 20, lineHeight: '16px',
              }}>
                {badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div style={{
        padding: '12px 14px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'var(--accent-dim)',
          border: '1px solid rgba(124,92,252,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, color: 'var(--accent)',
          flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayLabel}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Freelance</div>
        </div>
        <button
          onClick={toggle}
          title={scheme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-muted)',
            padding: 4, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'color 0.15s', fontSize: 14,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          {scheme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button
          onClick={signOut}
          title="Se déconnecter"
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-muted)',
            padding: 4, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <LogOutIcon />
        </button>
      </div>
    </aside>
  );
}
