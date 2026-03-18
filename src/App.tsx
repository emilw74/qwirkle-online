import { useState, useEffect } from 'react';
import { Lobby } from './pages/Lobby';
import { Game } from './pages/Game';
import { Leaderboard } from './pages/Leaderboard';
import { GameHistory } from './pages/GameHistory';
import { Rules } from './pages/Rules';
import { AuthGate } from './components/AuthGate';
import { useGameStore } from './hooks/useGameStore';
import { signOut } from './firebase/authService';
import { cn } from './utils/cn';
import { Moon, Sun, Home, LogOut, Pencil } from 'lucide-react';
import { UserProfile, updateNickname } from './firebase/authService';

type Page = 'lobby' | 'game' | 'leaderboard' | 'history' | 'rules';

function AppContent({ profile }: { profile: UserProfile }) {
  const [page, setPage] = useState<Page>('lobby');
  const { isDarkMode, toggleDarkMode, leaveGame, setAuth, nickname } = useGameStore();
  const [editingNick, setEditingNick] = useState(false);
  const [nickInput, setNickInput] = useState('');
  const [nickError, setNickError] = useState('');

  // Set auth on mount and when profile changes
  useEffect(() => {
    setAuth(profile.uid, profile.nickname, profile.photoURL);
  }, [profile.uid, profile.nickname, profile.photoURL]);

  // Initialize dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleNavigateHome = () => {
    leaveGame();
    setPage('lobby');
  };

  const handleSignOut = async () => {
    await signOut();
    useGameStore.getState().reset();
  };

  const handleStartEditNick = () => {
    setNickInput(nickname || profile.nickname);
    setNickError('');
    setEditingNick(true);
  };

  const handleSaveNick = async () => {
    const trimmed = nickInput.trim();
    if (!trimmed || trimmed.length > 16) {
      setNickError('Nick musi mieć 1-16 znaków');
      return;
    }
    try {
      await updateNickname(profile.uid, trimmed);
      setAuth(profile.uid, trimmed, profile.photoURL);
      setEditingNick(false);
    } catch (e: any) {
      setNickError(e.message || 'Błąd zmiany nicku');
    }
  };

  const isGame = page === 'game';
  const displayNick = nickname || profile.nickname;

  return (
    <div className={cn(
      'bg-background text-foreground',
      isGame ? 'h-dvh overflow-hidden flex flex-col' : 'min-h-dvh',
    )}>
      {/* Header — compact on game page */}
      <header className={cn(
        'flex-shrink-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50',
        !isGame && 'sticky top-0',
      )}>
        <div className={cn(
          'max-w-4xl mx-auto flex items-center justify-between px-3',
          isGame ? 'h-10' : 'h-14 px-4',
        )}>
          <button
            onClick={handleNavigateHome}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-0.5">
              {['#e63946', '#f77f00', '#fcbf49', '#2db84d', '#3a7bd5', '#7b2cbf'].map((color, i) => (
                <div
                  key={i}
                  className={cn('rounded-sm', isGame ? 'w-2.5 h-2.5' : 'w-3 h-3')}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            {!isGame && (
              <span className="font-display font-bold text-sm hidden sm:inline">Qwirkle</span>
            )}
          </button>

          <div className="flex items-center gap-1">
            {/* User info */}
            {!isGame && (
              <div className="flex items-center gap-2 mr-2">
                {profile.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt=""
                    className="w-6 h-6 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {displayNick.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium hidden sm:inline max-w-[100px] truncate">
                  {displayNick}
                </span>
                <button
                  onClick={handleStartEditNick}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  title="Zmień nick"
                >
                  <Pencil size={12} className="text-muted-foreground" />
                </button>
              </div>
            )}
            {isGame && (
              <button
                onClick={handleNavigateHome}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                title="Wróć do lobby"
              >
                <Home size={16} />
              </button>
            )}
            <button
              onClick={toggleDarkMode}
              className={cn(
                'rounded-lg hover:bg-muted transition-colors',
                isGame ? 'p-1.5' : 'p-2',
              )}
              aria-label={isDarkMode ? 'Tryb jasny' : 'Tryb ciemny'}
              data-testid="theme-toggle"
            >
              {isDarkMode ? <Sun size={isGame ? 16 : 18} /> : <Moon size={isGame ? 16 : 18} />}
            </button>
            {!isGame && (
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                title="Wyloguj się"
                data-testid="sign-out"
              >
                <LogOut size={18} className="text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Nick edit modal */}
      {editingNick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl border border-border p-5 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="font-display font-bold text-lg">Zmień nick</h3>
            <input
              type="text"
              value={nickInput}
              onChange={e => setNickInput(e.target.value)}
              maxLength={16}
              placeholder="Nowy nick..."
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSaveNick()}
              data-testid="edit-nickname-input"
            />
            {nickError && (
              <div className="text-xs text-destructive">{nickError}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setEditingNick(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveNick}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all"
                data-testid="save-nickname"
              >
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      {isGame ? (
        <div className="flex-1 min-h-0">
          <Game onNavigate={(p) => setPage(p)} />
        </div>
      ) : (
        <main className="max-w-4xl mx-auto px-4 py-6">
          {page === 'lobby' && (
            <Lobby onNavigate={(p) => setPage(p)} />
          )}
          {page === 'leaderboard' && (
            <Leaderboard onBack={() => setPage('lobby')} />
          )}
          {page === 'history' && (
            <GameHistory onBack={() => setPage('lobby')} />
          )}
          {page === 'rules' && (
            <Rules onBack={() => setPage('lobby')} />
          )}
        </main>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthGate>
      {(profile) => <AppContent profile={profile} />}
    </AuthGate>
  );
}

export default App;
