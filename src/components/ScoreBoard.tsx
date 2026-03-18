import { Player } from '../game/types';
import { cn } from '../utils/cn';
import { Crown, Bot, User, Wifi, WifiOff } from 'lucide-react';

interface ScoreBoardProps {
  players: Player[];
  currentPlayerIndex: number;
  myPlayerId: string | null;
  bagSize: number;
}

export function ScoreBoard({ players, currentPlayerIndex, myPlayerId, bagSize }: ScoreBoardProps) {
  return (
    <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          Wyniki
        </h3>
        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
          Worek: {bagSize}
        </span>
      </div>

      <div className="space-y-2">
        {players.map((player, idx) => {
          const isCurrentTurn = idx === currentPlayerIndex;
          const isMe = player.id === myPlayerId;
          const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
          const isLeading = sortedPlayers[0]?.id === player.id && player.score > 0;

          return (
            <div
              key={player.id}
              className={cn(
                'flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200',
                isCurrentTurn && 'bg-primary/10 border border-primary/30',
                !isCurrentTurn && 'hover:bg-muted/50',
                isMe && !isCurrentTurn && 'bg-accent/5',
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                isCurrentTurn ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}>
                {player.isAI ? <Bot size={16} /> : <User size={16} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    'font-medium text-sm truncate',
                    isMe && 'text-accent',
                  )}>
                    {player.nickname}
                    {isMe && ' (Ty)'}
                  </span>
                  {isLeading && <Crown size={14} className="text-yellow-500 flex-shrink-0" />}
                  {isCurrentTurn && (
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {player.hand?.length || 0} kafelków
                </div>
              </div>

              <div className={cn(
                'text-lg font-display font-bold tabular-nums',
                isLeading ? 'text-primary' : 'text-foreground',
              )}>
                {player.score}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
