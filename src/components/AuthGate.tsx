import { useState, useEffect } from 'react';
import { signInWithGoogle, getUserProfile, onAuthChange, UserProfile } from '../firebase/authService';
import { cn } from '../utils/cn';
import { LogIn } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { LanguageToggle } from './LanguageToggle';

interface AuthGateProps {
  children: (profile: UserProfile) => React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      if (user) {
        try {
          const p = await getUserProfile(user.uid);
          if (p) {
            setProfile(p);
          } else {
            const displayName = user.displayName || user.email?.split('@')[0] || t('defaultPlayer');
            const newProfile: UserProfile = {
              uid: user.uid,
              nickname: displayName,
              photoURL: user.photoURL || null,
              email: user.email || null,
              createdAt: Date.now(),
            };
            setProfile(newProfile);
          }
        } catch (e) {
          console.error('Error loading profile:', e);
          setError(t('authErrorProfile'));
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleSignIn = async () => {
    setSigningIn(true);
    setError('');
    try {
      const p = await signInWithGoogle();
      setProfile(p);
    } catch (e: any) {
      if (e.code === 'auth/popup-closed-by-user') {
        // User closed popup — don't show error
      } else if (e.code === 'auth/cancelled-popup-request') {
        // Another popup was already open
      } else {
        setError(e.message || t('authErrorLogin'));
        console.error('Sign in error:', e);
      }
    }
    setSigningIn(false);
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4">
        <div className="max-w-sm w-full space-y-8 text-center">
          {/* Language toggle */}
          <div className="flex justify-end">
            <LanguageToggle />
          </div>

          {/* Logo */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1">
              {['#e63946', '#f77f00', '#fcbf49', '#2db84d', '#3a7bd5', '#7b2cbf'].map((color, i) => (
                <div
                  key={color}
                  className="w-8 h-8 rounded-md"
                  style={{
                    backgroundColor: color,
                    transform: `rotate(${(i - 2.5) * 5}deg)`,
                  }}
                />
              ))}
            </div>
            <h1 className="font-display font-bold text-3xl tracking-tight text-foreground">
              Qwirkle Online
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('authSubtitle')}
            </p>
          </div>

          {/* Sign in button */}
          <button
            onClick={handleSignIn}
            disabled={signingIn}
            className={cn(
              'w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all',
              'flex items-center justify-center gap-3',
              'bg-white dark:bg-zinc-800 text-foreground',
              'border border-border/80 shadow-sm',
              'hover:shadow-md hover:bg-gray-50 dark:hover:bg-zinc-700',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            data-testid="google-sign-in"
          >
            {signingIn ? (
              <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            ) : (
              <>
                {/* Google logo SVG */}
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                {t('signInGoogle')}
              </>
            )}
          </button>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          <p className="text-xs text-muted-foreground/70">
            {t('authDisclaimer').split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </p>
        </div>
      </div>
    );
  }

  return <>{children(profile)}</>;
}
