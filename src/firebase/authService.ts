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

// Update nickname — propagates to profile, leaderboard, active rooms, player sessions, and game history
export async function updateNickname(uid: string, nickname: string): Promise<void> {
  const trimmed = nickname.trim();
  if (!trimmed || trimmed.length > 16) {
    throw new Error('Nick musi mieć 1-16 znaków');
  }

  // Get old nickname before updating (needed for gameHistory which stores nick, not uid)
  const profileSnap = await get(ref(db, `profiles/${uid}`));
  const oldNick = profileSnap.exists() ? (profileSnap.val() as { nickname: string }).nickname : null;

  // 1. Profile
  await update(ref(db, `profiles/${uid}`), { nickname: trimmed });

  // If nick didn't actually change, skip the rest
  if (oldNick === trimmed) return;

  // 2. Leaderboard
  try {
    const lbSnap = await get(ref(db, `leaderboard/${uid}`));
    if (lbSnap.exists()) {
      await update(ref(db, `leaderboard/${uid}`), { nickname: trimmed });
    }
  } catch (e) {
    console.error('Error updating nickname in leaderboard:', e);
  }

  // 3. Active rooms — update players array in rooms where this user plays
  try {
    const ownSessionsSnap = await get(ref(db, `playerSessions/${uid}`));
    if (ownSessionsSnap.exists()) {
      const ownSessions = ownSessionsSnap.val() as Record<string, { roomCode: string; status: string }>;
      for (const [, session] of Object.entries(ownSessions)) {
        if (session.status !== 'active') continue;
        try {
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
        } catch (e) {
          console.error('Error updating nickname in room:', session.roomCode, e);
        }
      }
    }
  } catch (e) {
    console.error('Error updating nickname in active rooms:', e);
  }

  // 4. Player sessions (ALL users) — update gameName, finalPlayers, winner wherever old nick appears
  if (oldNick) {
    try {
      const allSessionsSnap = await get(ref(db, 'playerSessions'));
      if (allSessionsSnap.exists()) {
        const allSessions = allSessionsSnap.val() as Record<string, Record<string, {
          gameName?: string;
          finalPlayers?: { nickname: string; score: number; isAI?: boolean }[];
          winner?: string;
        }>>;

        for (const [sessionUid, rooms] of Object.entries(allSessions)) {
          for (const [roomCode, session] of Object.entries(rooms)) {
            const sessionUpdates: Record<string, unknown> = {};

            if (session.gameName && session.gameName.includes(oldNick)) {
              sessionUpdates.gameName = session.gameName.split(oldNick).join(trimmed);
            }
            if (session.finalPlayers?.some(p => p.nickname === oldNick && !p.isAI)) {
              sessionUpdates.finalPlayers = session.finalPlayers.map(p =>
                p.nickname === oldNick && !p.isAI ? { ...p, nickname: trimmed } : p
              );
            }
            if (session.winner === oldNick) {
              sessionUpdates.winner = trimmed;
            }

            if (Object.keys(sessionUpdates).length > 0) {
              await update(ref(db, `playerSessions/${sessionUid}/${roomCode}`), sessionUpdates);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error updating nickname in playerSessions:', e);
    }
  }

  // 5. Game history — update all entries where old nick appears
  if (oldNick) {
    try {
      const histSnap = await get(ref(db, 'gameHistory'));
      if (histSnap.exists()) {
        const history = histSnap.val() as Record<string, {
          players: { nickname: string; score: number; isAI?: boolean }[];
          winner: string;
        }>;

        for (const [key, entry] of Object.entries(history)) {
          const hasOldNick = entry.players.some(p => p.nickname === oldNick && !p.isAI);
          if (!hasOldNick) continue;

          const histUpdates: Record<string, unknown> = {
            players: entry.players.map(p =>
              p.nickname === oldNick && !p.isAI ? { ...p, nickname: trimmed } : p
            ),
          };
          if (entry.winner === oldNick) {
            histUpdates.winner = trimmed;
          }
          await update(ref(db, `gameHistory/${key}`), histUpdates);
        }
      }
    } catch (e) {
      console.error('Error updating nickname in gameHistory:', e);
    }
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
