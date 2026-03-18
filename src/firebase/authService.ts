import { auth, googleProvider, db } from './config';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { ref, get, set, update } from 'firebase/database';

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

// Update nickname
export async function updateNickname(uid: string, nickname: string): Promise<void> {
  const trimmed = nickname.trim();
  if (!trimmed || trimmed.length > 16) {
    throw new Error('Nick musi mieć 1-16 znaków');
  }
  await update(ref(db, `profiles/${uid}`), { nickname: trimmed });
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
