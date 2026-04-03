import { useState, useEffect } from 'react';
import { Player, GameMove, getLastMoveLabel } from '../game/types';
import { cn } from '../utils/cn';
import { Bot, User, Clock } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

interface ScoreBoardProps {
  players: Player[];
  currentPlayerIndex: number;
  myPlayerId: string | null;
  bagSize: number;
  turnTimeLimitMs?: number;
  turnStartedAt?: number;
  moves?: GameMove[];
}

function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return '0:00';
  const totalMin = Math.ceil(remainingMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function ScoreBoard({ players, currentPlayerIndex, myPlayerId, bagSize, turnTimeLimitMs, turnStartedAt, moves }: ScoreBoardProps) {
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now());

  // Tick every second when timer is active
  useEffect(() => {
    if (!turnTimeLimitMs || !turnStartedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [turnTimeLimitMs, turnStartedAt]);

  const remainingMs = (turnTimeLimitMs && turnStartedAt)
    ? Math.max(0, turnTimeLimitMs - (now - turnStartedAt))
    : null;

  const isUrgent = remainingMs !== null && remainingMs < 60_000; // less than 1 min
  const isWarning = remainingMs !== null && remainingMs < 300_000 && !isUrgent; // less than 5 min

  const is4Players = players.length >= 4;

  return (
    <div className={cn(
      'w-full gap-1.5',
      is4Players ? 'grid grid-cols-2' : 'flex items-center gap-2',
    )}>
      {players.map((player, idx) => {
        const isCurrentTurn = idx === currentPlayerIndex;
        const isMe = player.id === myPlayerId;

        return (
          <div
            key={player.id}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all min-w-0',
              !is4Players && 'flex-1',
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
                {isMe && ` (${t('you')})`}
              </span>
              {isCurrentTurn && !remainingMs && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block ml-1" />
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Countdown timer next to current player's score */}
              {isCurrentTurn && remainingMs !== null && (
                <span className={cn(
                  'font-mono text-[10px] tabular-nums',
                  isUrgent && 'text-destructive font-bold animate-pulse',
                  isWarning && 'text-yellow-600 dark:text-yellow-400',
                  !isUrgent && !isWarning && 'text-muted-foreground',
                )}>
                  <Clock size={9} className="inline mr-0.5 -mt-[1px]" />
                  {formatCountdown(remainingMs)}
                </span>
              )}
              <span className={cn(
                'font-display font-bold tabular-nums',
                'text-foreground',
              )}>
                {player.score}
              </span>
              {moves && (() => {
                const label = getLastMoveLabel(moves, player.id);
                if (!label) return null;
                const isScore = label.startsWith('+');
                return (
                  <span className={cn(
                    'text-[9px] tabular-nums',
                    isScore ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
                  )}>
                    {label}
                  </span>
                );
              })()}
              {bagSize === 0 && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-muted/80 text-muted-foreground tabular-nums" title={t('tilesLeft')}>
                  {player.hand?.length || 0}✦
                </span>
              )}
            </div>
          </div>
        );
      })}

      <span className={cn(
        'text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0 tabular-nums',
        is4Players && 'col-span-2 justify-self-center',
      )}>
        {bagSize}
      </span>
    </div>
  );
}
