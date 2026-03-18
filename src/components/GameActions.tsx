import { cn } from '../utils/cn';
import { Check, Undo2, Shuffle, SkipForward, Trash2 } from 'lucide-react';

interface GameActionsProps {
  isMyTurn: boolean;
  hasPlacedTiles: boolean;
  canSwap: boolean;
  onConfirmMove: () => void;
  onUndoLast: () => void;
  onClearAll: () => void;
  onSwap: () => void;
  onPass: () => void;
  isLoading: boolean;
}

export function GameActions({
  isMyTurn, hasPlacedTiles, canSwap,
  onConfirmMove, onUndoLast, onClearAll, onSwap, onPass, isLoading,
}: GameActionsProps) {
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {hasPlacedTiles ? (
        <>
          <button
            onClick={onConfirmMove}
            disabled={!isMyTurn || isLoading}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium text-xs transition-all',
              'bg-primary text-primary-foreground hover:opacity-90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            data-testid="confirm-move"
          >
            <Check size={14} />
            OK
          </button>
          <button
            onClick={onUndoLast}
            disabled={isLoading}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs border border-border hover:bg-muted transition-colors"
            data-testid="undo-last"
          >
            <Undo2 size={13} />
          </button>
          <button
            onClick={onClearAll}
            disabled={isLoading}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs border border-border hover:bg-destructive/10 hover:text-destructive transition-colors"
            data-testid="clear-all"
          >
            <Trash2 size={13} />
          </button>
        </>
      ) : (
        <>
          {isMyTurn ? (
            <>
              {canSwap && (
                <button
                  onClick={onSwap}
                  disabled={isLoading}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs border border-border hover:bg-muted transition-colors"
                  data-testid="swap-tiles"
                >
                  <Shuffle size={13} />
                  Wymień
                </button>
              )}
              <button
                onClick={onPass}
                disabled={isLoading}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs border border-border hover:bg-muted transition-colors"
                data-testid="pass-turn"
              >
                <SkipForward size={13} />
                Pas
              </button>
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground">Czekaj na swoją kolej...</span>
          )}
        </>
      )}
    </div>
  );
}
