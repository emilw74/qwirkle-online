import { auth, googleProvider, db } from './config';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { ref, get, set, update, child } from 'firebase/database';

export interface UserProfile {
  uid: string;
  nickname: string;
  photoURL: string | null;
  email: string | null;
  createdAt: number;
}

// Sign in with Google
export async function signInWithGoogle(): Promise<UserProfile> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  
  // Check if profile already exists
  const profileRef = ref(db, `profiles/${user.uid}`);
  const snapshot = await get(profileRef);
  
  if (snapshot.exists()) {
    // Return existing profile (keep their chosen nickname)
    const profile = snapshot.val() as UserProfile;
    // Update photo/email in case they changed
    await update(profileRef, {
      photoURL: user.photoURL || null,
      email: user.email || null,
    });
    return { ...profile, photoURL: user.photoURL || null, email: user.email || null };
  }
  
  // New user — create profile with Google display name as nickname
  const displayName = user.displayName || user.email?.split('@')[0] || 'Gracz';
  const profile: UserProfile = {
    uid: user.uid,
    nickname: displayName,
    photoURL: user.photoURL || null,
    email: user.email || null,
    createdAt: Date.now(),
  };
  
  await set(profileRef, profile);
  return profile;
}

// Get current user profile from DB
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await get(ref(db, `profiles/${uid}`));
  if (!snapshot.exists()) return null;
  return snapshot.val() as UserProfile;
}

// Update nickname — also updates nick in all active rooms
export async function updateNickname(uid: string, nickname: string): Promise<void> {
  const trimmed = nickname.trim();
  if (!trimmed || trimmed.length > 16) {
    throw new Error('Nick musi mieć 1-16 znaków');
  }
  await update(ref(db, `profiles/${uid}`), { nickname: trimmed });

  // Update nickname in all active rooms where this player is participating
  try {
    const sessionsSnap = await get(ref(db, `playerSessions/${uid}`));
    if (!sessionsSnap.exists()) return;
    const sessions = sessionsSnap.val() as Record<string, { roomCode: string; status: string }>;

    for (const [, session] of Object.entries(sessions)) {
      if (session.status !== 'active') continue;

      const roomSnap = await get(ref(db, `rooms/${session.roomCode}`));
      if (!roomSnap.exists()) continue;

      const room = roomSnap.val();
      const players = room.players || [];
      let updated = false;
      for (let i = 0; i < players.length; i++) {
        if (players[i].id === uid) {
          players[i].nickname = trimmed;
          updated = true;
        }
      }
      if (updated) {
        await update(ref(db, `rooms/${session.roomCode}`), { players });
      }
    }
  } catch (e) {
    console.error('Error updating nickname in rooms:', e);
  }
}

// Sign out
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

// Listen to auth state
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// Get current user
export function getCurrentUser(): User | null {
  return auth.currentUser;
}
