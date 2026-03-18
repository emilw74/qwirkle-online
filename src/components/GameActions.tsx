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
    <div className="flex items-center gap-2 flex-wrap justify-center p-3 bg-card rounded-xl border border-border/50">
      {hasPlacedTiles ? (
        <>
          <button
            onClick={onConfirmMove}
            disabled={!isMyTurn || isLoading}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all',
              'bg-primary text-primary-foreground hover:opacity-90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            data-testid="confirm-move"
          >
            <Check size={16} />
            Zatwierdź ruch
          </button>
          <button
            onClick={onUndoLast}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border border-border hover:bg-muted transition-colors"
            data-testid="undo-last"
          >
            <Undo2 size={16} />
            Cofnij
          </button>
          <button
            onClick={onClearAll}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
            data-testid="clear-all"
          >
            <Trash2 size={16} />
            Wyczyść
          </button>
        </>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            {isMyTurn ? 'Wybierz kafelek i umieść na planszy' : 'Czekaj na swoją kolej...'}
          </div>
          {isMyTurn && (
            <>
              {canSwap && (
                <button
                  onClick={onSwap}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border border-border hover:bg-muted transition-colors"
                  data-testid="swap-tiles"
                >
                  <Shuffle size={16} />
                  Wymień
                </button>
              )}
              <button
                onClick={onPass}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border border-border hover:bg-muted transition-colors"
                data-testid="pass-turn"
              >
                <SkipForward size={16} />
                Pas
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
