import { useState, useEffect } from 'react';
import { getGameHistory } from '../firebase/gameService';
import { GameHistoryEntry } from '../game/types';
import { cn } from '../utils/cn';
import { ArrowLeft, History, Clock, Users, Flame, Trophy, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { pl as plLocale } from 'date-fns/locale';
import { enGB } from 'date-fns/locale';
import { useTranslation } from '../i18n/LanguageContext';

interface GameHistoryProps {
  onBack: () => void;
}

export function GameHistory({ onBack }: GameHistoryProps) {
  const { t, lang } = useTranslation();
  const [entries, setEntries] = useState<GameHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await getGameHistory(50);
      setEntries(data);
    } catch (e) {
      console.error('Error loading history:', e);
    }
    setIsLoading(false);
  };

  const dateLocale = lang === 'pl' ? plLocale : enGB;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
        <ArrowLeft size={16} /> {t('back')}
      </button>

      <div className="text-center space-y-2">
        <History size={40} className="mx-auto text-blue-500" />
        <h2 className="font-display font-bold text-xl">{t('historyTitle')}</h2>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">{t('noHistory')}</p>
          <p className="text-xs mt-1">{t('noHistoryHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, idx) => {
            const isDeleted = !!entry.deletedAt;
            const deletedDate = entry.deletedAt
              ? format(new Date(entry.deletedAt), 'd MMM yyyy, HH:mm', { locale: dateLocale })
              : '';

            return (
              <div
                key={`${entry.gameId}-${idx}`}
                className={cn(
                  'rounded-xl border p-4 space-y-3 shadow-sm',
                  isDeleted
                    ? 'bg-muted/10 border-border/30 opacity-60'
                    : 'bg-card border-border/50',
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {isDeleted ? <Trash2 size={12} /> : <Clock size={12} />}
                    {format(new Date(entry.date), 'd MMM yyyy, HH:mm', { locale: dateLocale })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{t('room')}</span>
                    <span className="text-xs font-mono font-medium">{entry.roomCode}</span>
                  </div>
                </div>

                {isDeleted && (
                  <div className="text-xs text-muted-foreground/70 flex items-center gap-1">
                    <Trash2 size={11} />
                    {t('gameDeletedBy')} {entry.deletedBy} {t('gameDeletedOn')} {deletedDate}
                  </div>
                )}

                <div className={cn('space-y-1.5', isDeleted && 'opacity-70')}>
                  {entry.players
                    .sort((a, b) => b.score - a.score)
                    .map((player, pIdx) => (
                      <div key={pIdx} className="flex items-center gap-2">
                        <div className={cn(
                          'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                          pIdx === 0 && !isDeleted ? 'bg-yellow-500 text-white' : 'bg-muted text-muted-foreground',
                        )}>
                          {pIdx + 1}
                        </div>
                        <span className={cn(
                          'text-sm flex-1 truncate',
                          pIdx === 0 && !isDeleted && 'font-medium',
                          isDeleted && 'line-through text-muted-foreground',
                        )}>
                          {player.nickname}
                          {player.isAI && ' 🤖'}
                        </span>
                        <span className={cn(
                          'font-mono text-sm tabular-nums',
                          pIdx === 0 && !isDeleted && 'font-bold text-primary',
                          isDeleted && 'text-muted-foreground',
                        )}>
                          {player.score}
                        </span>
                      </div>
                    ))}
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/30">
                  <span className="flex items-center gap-1">
                    <Users size={11} /> {entry.players.length} {t('playersLabel')}
                  </span>
                  <span>{entry.totalMoves} {t('moves')}</span>
                  {entry.hadQwirkle && !isDeleted && (
                    <span className="flex items-center gap-0.5 text-primary font-medium">
                      <Flame size={11} /> Qwirkle
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
