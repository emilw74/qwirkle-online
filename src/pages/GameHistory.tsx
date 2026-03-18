import { useState, useEffect } from 'react';
import { getGameHistory } from '../firebase/gameService';
import { GameHistoryEntry } from '../game/types';
import { cn } from '../utils/cn';
import { ArrowLeft, History, Clock, Users, Flame, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface GameHistoryProps {
  onBack: () => void;
}

export function GameHistory({ onBack }: GameHistoryProps) {
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

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
        <ArrowLeft size={16} /> Wróć
      </button>

      <div className="text-center space-y-2">
        <History size={40} className="mx-auto text-blue-500" />
        <h2 className="font-display font-bold text-xl">Historia gier</h2>
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
          <p className="text-sm">Brak historii</p>
          <p className="text-xs mt-1">Twoje gry pojawią się tutaj</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, idx) => (
            <div
              key={`${entry.gameId}-${idx}`}
              className="bg-card rounded-xl border border-border/50 p-4 space-y-3 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock size={12} />
                  {format(new Date(entry.date), 'd MMM yyyy, HH:mm', { locale: pl })}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Pokój:</span>
                  <span className="text-xs font-mono font-medium">{entry.roomCode}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                {entry.players
                  .sort((a, b) => b.score - a.score)
                  .map((player, pIdx) => (
                    <div key={pIdx} className="flex items-center gap-2">
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                        pIdx === 0 ? 'bg-yellow-500 text-white' : 'bg-muted text-muted-foreground',
                      )}>
                        {pIdx + 1}
                      </div>
                      <span className={cn(
                        'text-sm flex-1 truncate',
                        pIdx === 0 && 'font-medium',
                      )}>
                        {player.nickname}
                        {player.isAI && ' 🤖'}
                      </span>
                      <span className={cn(
                        'font-mono text-sm tabular-nums',
                        pIdx === 0 && 'font-bold text-primary',
                      )}>
                        {player.score}
                      </span>
                    </div>
                  ))}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/30">
                <span className="flex items-center gap-1">
                  <Users size={11} /> {entry.players.length} graczy
                </span>
                <span>{entry.totalMoves} ruchów</span>
                {entry.hadQwirkle && (
                  <span className="flex items-center gap-0.5 text-primary font-medium">
                    <Flame size={11} /> Qwirkle
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
