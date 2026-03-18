import { Player } from '../game/types';
import { cn } from '../utils/cn';
import { Crown, Bot, User } from 'lucide-react';

interface ScoreBoardProps {
  players: Player[];
  currentPlayerIndex: number;
  myPlayerId: string | null;
  bagSize: number;
}

export function ScoreBoard({ players, currentPlayerIndex, myPlayerId, bagSize }: ScoreBoardProps) {
  return (
    <div className="flex items-center gap-2 w-full">
      {players.map((player, idx) => {
        const isCurrentTurn = idx === currentPlayerIndex;
        const isMe = player.id === myPlayerId;
        const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
        const isLeading = sortedPlayers[0]?.id === player.id && player.score > 0;

        return (
          <div
            key={player.id}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all flex-1 min-w-0',
              isCurrentTurn && 'bg-primary/10 border border-primary/30',
              !isCurrentTurn && 'bg-card border border-border/50',
            )}
          >
            <div className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
              isCurrentTurn ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}>
              {player.isAI ? <Bot size={11} /> : <User size={11} />}
            </div>

            <div className="flex-1 min-w-0 truncate">
              <span className={cn(
                'font-medium',
                isMe && 'text-accent',
              )}>
                {player.nickname}
                {isMe && ' (Ty)'}
              </span>
              {isLeading && <Crown size={10} className="inline ml-0.5 text-yellow-500" />}
              {isCurrentTurn && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block ml-1" />
              )}
            </div>

            <span className={cn(
              'font-display font-bold tabular-nums flex-shrink-0',
              isLeading ? 'text-primary' : 'text-foreground',
            )}>
              {player.score}
            </span>
          </div>
        );
      })}

      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0 tabular-nums">
        {bagSize}
      </span>
    </div>
  );
}
