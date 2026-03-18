import { useState, useEffect } from 'react';
import { Lobby } from './pages/Lobby';
import { Game } from './pages/Game';
import { Leaderboard } from './pages/Leaderboard';
import { GameHistory } from './pages/GameHistory';
import { useGameStore } from './hooks/useGameStore';
import { cn } from './utils/cn';
import { Moon, Sun, Home } from 'lucide-react';

type Page = 'lobby' | 'game' | 'leaderboard' | 'history';

function App() {
  const [page, setPage] = useState<Page>('lobby');
  const { isDarkMode, toggleDarkMode, leaveGame } = useGameStore();

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

  const isGame = page === 'game';

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
          </div>
        </div>
      </header>

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
        </main>
      )}
    </div>
  );
}

export default App;
