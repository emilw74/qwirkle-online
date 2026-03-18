import { useState, useEffect } from 'react';
import { getLeaderboard } from '../firebase/gameService';
import { LeaderboardEntry } from '../game/types';
import { cn } from '../utils/cn';
import { ArrowLeft, Trophy, Medal, Flame, Target } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

interface LeaderboardProps {
  onBack: () => void;
}

export function Leaderboard({ onBack }: LeaderboardProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const data = await getLeaderboard();
      setEntries(data);
    } catch (e) {
      console.error('Error loading leaderboard:', e);
    }
    setIsLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
        <ArrowLeft size={16} /> {t('back')}
      </button>

      <div className="text-center space-y-2">
        <Trophy size={40} className="mx-auto text-yellow-500" />
        <h2 className="font-display font-bold text-xl">{t('leaderboardTitle')}</h2>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Target size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">{t('noResults')}</p>
          <p className="text-xs mt-1">{t('noResultsHint')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, idx) => (
            <div
              key={entry.nickname}
              className={cn(
                'flex items-center gap-3 p-4 rounded-xl border transition-all',
                idx === 0 && 'bg-yellow-500/10 border-yellow-500/30',
                idx === 1 && 'bg-gray-200/50 dark:bg-gray-700/30 border-gray-300/50 dark:border-gray-600/50',
                idx === 2 && 'bg-orange-500/10 border-orange-500/20',
                idx > 2 && 'bg-card border-border/50',
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-sm flex-shrink-0',
                idx === 0 && 'bg-yellow-500 text-white',
                idx === 1 && 'bg-gray-400 dark:bg-gray-500 text-white',
                idx === 2 && 'bg-orange-500 text-white',
                idx > 2 && 'bg-muted text-muted-foreground',
              )}>
                {idx + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{entry.nickname}</div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{entry.gamesPlayed} {t('gamesPlayed')}</span>
                  <span>{entry.gamesWon} {t('gamesWon')}</span>
                  {entry.totalQwirkles > 0 && (
                    <span className="flex items-center gap-0.5 text-primary">
                      <Flame size={12} /> {entry.totalQwirkles}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="font-display font-bold text-lg">{entry.highestScore}</div>
                <div className="text-xs text-muted-foreground">{t('highest')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
