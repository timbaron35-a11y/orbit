import { createContext, useContext, useEffect, useState } from 'react';
import {
  collection, doc, setDoc, deleteDoc, addDoc, updateDoc,
  onSnapshot, query, where, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

export interface Collaboration {
  id: string;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  collaboratorUid: string;
  collaboratorEmail: string;
  role: 'editor' | 'viewer';
}

export interface Invitation {
  id: string;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  collaboratorEmail: string;
  collaboratorUid?: string;
  status: 'pending' | 'accepted' | 'declined';
  role: 'editor' | 'viewer';
  createdAt: Timestamp;
}

interface WorkspaceContextType {
  workspaceUid: string;
  workspaceOwnerName: string;
  isOwn: boolean;
  isViewer: boolean;
  sharedWorkspaces: Collaboration[];
  myCollaborators: Invitation[];
  pendingInvitations: Invitation[];
  switchWorkspace: (uid: string) => void;
  inviteCollaborator: (email: string, appName?: string) => Promise<'ok' | 'already_invited' | 'limit_reached'>;
  updateCollaboratorRole: (inv: Invitation, role: 'editor' | 'viewer') => Promise<void>;
  acceptInvitation: (inv: Invitation) => Promise<void>;
  declineInvitation: (invId: string) => Promise<void>;
  removeCollaborator: (inv: Invitation) => Promise<void>;
  revokeAccess: (collab: Collaboration) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaceUid: '',
  workspaceOwnerName: '',
  isOwn: true,
  isViewer: false,
  sharedWorkspaces: [],
  myCollaborators: [],
  pendingInvitations: [],
  switchWorkspace: () => {},
  inviteCollaborator: async () => 'ok',
  updateCollaboratorRole: async () => {},
  acceptInvitation: async () => {},
  declineInvitation: async () => {},
  removeCollaborator: async () => {},
  revokeAccess: async () => {},
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [workspaceUid, setWorkspaceUid] = useState('');
  const [sharedWorkspaces, setSharedWorkspaces] = useState<Collaboration[]>([]);
  const [myCollaborators, setMyCollaborators] = useState<Invitation[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);

  useEffect(() => {
    if (!user) { setWorkspaceUid(''); return; }
    const stored = localStorage.getItem(`orbit_workspace_${user.uid}`);
    setWorkspaceUid(stored ?? user.uid);
  }, [user]);

  // Workspaces shared with me (I'm the collaborator)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'collaborations'), where('collaboratorUid', '==', user.uid));
    return onSnapshot(q, snap => {
      const collabs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Collaboration));
      setSharedWorkspaces(collabs);
      // If active workspace was removed, fall back to own
      setWorkspaceUid(prev => {
        if (prev !== user.uid && !collabs.find(c => c.ownerId === prev)) {
          localStorage.setItem(`orbit_workspace_${user.uid}`, user.uid);
          return user.uid;
        }
        return prev;
      });
    });
  }, [user]);

  // Invitations I've sent (I'm the owner)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'invitations'), where('ownerId', '==', user.uid));
    return onSnapshot(q, snap => {
      setMyCollaborators(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invitation)));
    });
  }, [user]);

  // Pending invitations sent to me (by email)
  useEffect(() => {
    if (!user?.email) return;
    const q = query(
      collection(db, 'invitations'),
      where('collaboratorEmail', '==', user.email.toLowerCase()),
      where('status', '==', 'pending'),
    );
    return onSnapshot(q, snap => {
      setPendingInvitations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invitation)));
    });
  }, [user]);

  const switchWorkspace = (uid: string) => {
    if (!user) return;
    localStorage.setItem(`orbit_workspace_${user.uid}`, uid);
    setWorkspaceUid(uid);
  };

  const inviteCollaborator = async (email: string, appName?: string): Promise<'ok' | 'already_invited' | 'limit_reached'> => {
    if (!user) return 'ok';
    const normalized = email.trim().toLowerCase();
    const active = myCollaborators.filter(i => i.status !== 'declined');
    if (active.length >= 4) return 'limit_reached';
    const alreadyExists = active.find(i => i.collaboratorEmail === normalized);
    if (alreadyExists) return 'already_invited';
    const ownerName = user.displayName || user.email?.split('@')[0] || 'Utilisateur';
    await addDoc(collection(db, 'invitations'), {
      ownerId: user.uid,
      ownerEmail: user.email ?? '',
      ownerName,
      collaboratorEmail: normalized,
      status: 'pending',
      role: 'editor',
      createdAt: Timestamp.now(),
    });
    // Send invitation email (best-effort, don't block on failure)
    fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail: normalized,
        ownerName,
        ownerEmail: user.email ?? '',
        appName: appName || 'Orbit',
      }),
    }).catch(() => {});
    return 'ok';
  };

  const updateCollaboratorRole = async (inv: Invitation, role: 'editor' | 'viewer') => {
    if (!user) return;
    await updateDoc(doc(db, 'invitations', inv.id), { role });
    if (inv.collaboratorUid) {
      const collabId = `${user.uid}_${inv.collaboratorUid}`;
      await updateDoc(doc(db, 'collaborations', collabId), { role });
    }
  };

  const acceptInvitation = async (inv: Invitation) => {
    if (!user) return;
    const collabId = `${inv.ownerId}_${user.uid}`;
    await Promise.all([
      updateDoc(doc(db, 'invitations', inv.id), {
        status: 'accepted',
        collaboratorUid: user.uid,
      }),
      setDoc(doc(db, 'collaborations', collabId), {
        ownerId: inv.ownerId,
        ownerEmail: inv.ownerEmail,
        ownerName: inv.ownerName,
        collaboratorUid: user.uid,
        collaboratorEmail: user.email?.toLowerCase() ?? '',
        role: inv.role ?? 'editor',
      }),
    ]);
  };

  const declineInvitation = async (invId: string) => {
    await updateDoc(doc(db, 'invitations', invId), { status: 'declined' });
  };

  const removeCollaborator = async (inv: Invitation) => {
    if (!user) return;
    const collabId = `${user.uid}_${inv.collaboratorUid}`;
    await Promise.all([
      deleteDoc(doc(db, 'invitations', inv.id)),
      inv.collaboratorUid ? deleteDoc(doc(db, 'collaborations', collabId)) : Promise.resolve(),
    ]);
  };

  const revokeAccess = async (collab: Collaboration) => {
    if (!user) return;
    await deleteDoc(doc(db, 'collaborations', collab.id));
    if (workspaceUid === collab.ownerId) switchWorkspace(user.uid);
  };

  const isOwn = workspaceUid === user?.uid;
  const activeCollab = sharedWorkspaces.find(c => c.ownerId === workspaceUid);
  const isViewer = !isOwn && activeCollab?.role === 'viewer';
  const workspaceOwnerName = isOwn
    ? (user?.displayName || user?.email?.split('@')[0] || 'Moi')
    : (activeCollab?.ownerName ?? workspaceUid);

  return (
    <WorkspaceContext.Provider value={{
      workspaceUid: workspaceUid || user?.uid || '',
      workspaceOwnerName,
      isOwn,
      isViewer,
      sharedWorkspaces,
      myCollaborators,
      pendingInvitations,
      switchWorkspace,
      inviteCollaborator,
      updateCollaboratorRole,
      acceptInvitation,
      declineInvitation,
      removeCollaborator,
      revokeAccess,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
