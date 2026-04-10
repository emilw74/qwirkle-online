import { useState, useEffect, useCallback, useRef } from 'react';
import { Lobby, LobbyMode } from './pages/Lobby';
import { Game } from './pages/Game';
import { Leaderboard } from './pages/Leaderboard';
import { Rules } from './pages/Rules';
import { About } from './pages/About';
import { AdminPanel } from './pages/AdminPanel';
import { AuthGate } from './components/AuthGate';
import { useGameStore } from './hooks/useGameStore';
import { signOut } from './firebase/authService';
import { cn } from './utils/cn';
import { Moon, Sun, Home, LogOut, Pencil } from 'lucide-react';
import { UserProfile, updateNickname } from './firebase/authService';
import { LanguageProvider, useTranslation } from './i18n/LanguageContext';
import { LanguageToggle } from './components/LanguageToggle';

import { SUPERUSER_EMAIL } from './firebase/gameService';

type Page = 'lobby' | 'game' | 'leaderboard' | 'rules' | 'about' | 'admin';

/** When navigating from Leaderboard to Rules, optionally scroll to a section */
type RulesScrollTarget = string | undefined;

function AppContent({ profile }: { profile: UserProfile }) {
  const { t } = useTranslation();
  const [page, setPage] = useState<Page>('lobby');
  const { isDarkMode, toggleDarkMode, leaveGame, setAuth, nickname } = useGameStore();
  const [editingNick, setEditingNick] = useState(false);
  const [nickInput, setNickInput] = useState('');
  const [nickError, setNickError] = useState('');

  // Set auth on mount and when profile changes
  useEffect(() => {
    setAuth(profile.uid, profile.nickname, profile.photoURL);
  }, [profile.uid, profile.nickname, profile.photoURL]);

  // Track OS dark mode
  const [systemDark, setSystemDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Initialize dark mode & listen for OS theme changes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // When OS switches to dark → force dark mode on; when OS switches to light → allow manual control
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
      if (e.matches && !isDarkMode) toggleDarkMode();
    };
    // On mount: force dark if system is dark
    if (mq.matches && !isDarkMode) toggleDarkMode();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const [rulesScrollTarget, setRulesScrollTarget] = useState<RulesScrollTarget>(undefined);
  const [lobbyInitialMode, setLobbyInitialMode] = useState<'menu' | 'mygames'>('menu');
  const [lobbyKey, setLobbyKey] = useState(0);

  // Track lobby mode for back-button logic & push history on forward nav
  const lobbyModeRef = useRef<LobbyMode>('menu');
  const isPopstateNav = useRef(false); // true when navigation was triggered by popstate
  const handleLobbyModeChange = useCallback((m: LobbyMode) => {
    const prev = lobbyModeRef.current;
    lobbyModeRef.current = m;
    // Push history when going deeper (menu → anything else), but not on popstate-driven nav
    if (!isPopstateNav.current && prev === 'menu' && m !== 'menu') {
      history.pushState({ page: 'lobby', lobbyMode: m }, '');
    }
  }, []);

  const handleNavigateHome = () => {
    setPage('lobby');
    setLobbyInitialMode('mygames');
    setLobbyKey(k => k + 1);
    leaveGame();
    // Replace current entry (game) with mygames so back still works correctly
    history.replaceState({ page: 'lobby', lobbyMode: 'mygames' }, '');
  };

  // --- Android Back button (history-based) ---
  // On mount, replace current state with lobby/menu baseline
  useEffect(() => {
    history.replaceState({ page: 'lobby', lobbyMode: 'menu' }, '');
  }, []);

  // Listen for popstate (Android back / browser back)
  const pageRef = useRef(page);
  pageRef.current = page;

  useEffect(() => {
    const onPopState = (_e: PopStateEvent) => {
      const currentPage = pageRef.current;
      const currentLobbyMode = lobbyModeRef.current;

      isPopstateNav.current = true;

      // Game → lobby/mygames (refreshed)
      if (currentPage === 'game') {
        setPage('lobby');
        setLobbyInitialMode('mygames');
        setLobbyKey(k => k + 1);
        leaveGame();
        // Stack already has [menu, mygames] — no push needed
        setTimeout(() => { isPopstateNav.current = false; }, 50);
        return;
      }

      // Leaderboard, rules, about → lobby/menu
      if (currentPage !== 'lobby') {
        setLobbyInitialMode('menu');
        setLobbyKey(k => k + 1);
        setPage('lobby');
        // Stack is now at baseline [menu] — no push needed
        setTimeout(() => { isPopstateNav.current = false; }, 50);
        return;
      }

      // Lobby but not menu → menu (remount lobby)
      if (currentLobbyMode !== 'menu') {
        setLobbyInitialMode('menu');
        setLobbyKey(k => k + 1);
        // Stack is now at baseline [menu] — no push needed
        setTimeout(() => { isPopstateNav.current = false; }, 50);
        return;
      }

      // Lobby/menu → let the browser close the tab/go back naturally
      isPopstateNav.current = false;
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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
      setNickError(t('nickError'));
      return;
    }
    try {
      await updateNickname(profile.uid, trimmed);
      setAuth(profile.uid, trimmed, profile.photoURL);
      setEditingNick(false);
    } catch (e: any) {
      setNickError(e.message || t('nickErrorGeneric'));
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
            onClick={() => {
              if (isGame) {
                handleNavigateHome();
              } else {
                // On non-game pages: go to lobby/menu
                setLobbyInitialMode('menu');
                setLobbyKey(k => k + 1);
                setPage('lobby');
              }
            }}
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
                  title={t('changeNick')}
                >
                  <Pencil size={12} className="text-muted-foreground" />
                </button>
              </div>
            )}
            {isGame && (
              <button
                onClick={handleNavigateHome}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                title={t('backToLobby')}
              >
                <Home size={16} />
              </button>
            )}
            <button
              onClick={systemDark ? undefined : toggleDarkMode}
              className={cn(
                'rounded-lg transition-colors',
                isGame ? 'p-1.5' : 'p-2',
                systemDark ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted cursor-pointer',
              )}
              aria-label={isDarkMode ? t('lightMode') : t('darkMode')}
              data-testid="theme-toggle"
              disabled={systemDark}
            >
              {isDarkMode ? <Sun size={isGame ? 16 : 18} /> : <Moon size={isGame ? 16 : 18} />}
            </button>
            {!isGame && (
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                title={t('signOut')}
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
            <h3 className="font-display font-bold text-lg">{t('nickModalTitle')}</h3>
            <input
              type="text"
              value={nickInput}
              onChange={e => setNickInput(e.target.value)}
              maxLength={16}
              placeholder={t('nickPlaceholder')}
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
                {t('cancel')}
              </button>
              <button
                onClick={handleSaveNick}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all"
                data-testid="save-nickname"
              >
                {t('save')}
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
            <Lobby
              key={lobbyKey}
              onNavigate={(p) => {
                setLobbyInitialMode('menu');
                history.pushState({ page: p }, '');
                setPage(p);
              }}
              initialMode={lobbyInitialMode}
              onModeChange={handleLobbyModeChange}
              isSuperUser={profile.email === SUPERUSER_EMAIL}
            />
          )}
          {page === 'leaderboard' && (
            <Leaderboard
              onBack={() => setPage('lobby')}
              onNavigate={(target) => {
                if (target.startsWith('rules:')) {
                  const section = target.split(':')[1];
                  setRulesScrollTarget(section);
                  history.pushState({ page: 'rules' }, '');
                  setPage('rules');
                }
              }}
            />
          )}
          {page === 'rules' && (
            <Rules
              onBack={() => { setRulesScrollTarget(undefined); setPage('lobby'); }}
              scrollToSection={rulesScrollTarget}
            />
          )}
          {page === 'about' && (
            <About onBack={() => setPage('lobby')} />
          )}
          {page === 'admin' && profile.email === SUPERUSER_EMAIL && (
            <AdminPanel onBack={() => setPage('lobby')} />
          )}
        </main>
      )}
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AuthGate>
        {(profile) => <AppContent profile={profile} />}
      </AuthGate>
    </LanguageProvider>
  );
}

export default App;
