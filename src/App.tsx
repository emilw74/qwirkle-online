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
  const { isDarkMode, toggleDarkMode, reset } = useGameStore();

  // Initialize dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const handleNavigateHome = () => {
    reset();
    setPage('lobby');
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 h-14">
          <button
            onClick={handleNavigateHome}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-0.5">
              {['#e63946', '#f77f00', '#fcbf49', '#2a9d8f', '#457b9d', '#7b2cbf'].map((color, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <span className="font-display font-bold text-sm hidden sm:inline">Qwirkle</span>
          </button>

          <div className="flex items-center gap-2">
            {page === 'game' && (
              <button
                onClick={handleNavigateHome}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                title="Wróć do lobby"
              >
                <Home size={18} />
              </button>
            )}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label={isDarkMode ? 'Tryb jasny' : 'Tryb ciemny'}
              data-testid="theme-toggle"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {page === 'lobby' && (
          <Lobby onNavigate={(p) => setPage(p)} />
        )}
        {page === 'game' && (
          <Game onNavigate={(p) => setPage(p)} />
        )}
        {page === 'leaderboard' && (
          <Leaderboard onBack={() => setPage('lobby')} />
        )}
        {page === 'history' && (
          <GameHistory onBack={() => setPage('lobby')} />
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-muted-foreground border-t border-border/30">
        <a
          href="https://www.perplexity.ai/computer"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          Created with Perplexity Computer
        </a>
      </footer>
    </div>
  );
}

export default App;
