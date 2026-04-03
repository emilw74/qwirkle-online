import { cn } from '../utils/cn';
import { Check, Undo2, Shuffle, SkipForward, Trash2, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

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
  showLastMove: boolean;
  onToggleLastMove: () => void;
  hasLastMove: boolean;
}

export function GameActions({
  isMyTurn, hasPlacedTiles, canSwap,
  onConfirmMove, onUndoLast, onClearAll, onSwap, onPass, isLoading,
  showLastMove, onToggleLastMove, hasLastMove,
}: GameActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 justify-center">
      {hasPlacedTiles ? (
        <>
          <button
            onClick={onConfirmMove}
            disabled={!isMyTurn || isLoading}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 rounded-lg font-medium text-sm transition-all',
              'bg-primary text-primary-foreground hover:opacity-90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            data-testid="confirm-move"
          >
            <Check size={21} />
            OK
          </button>
          <button
            onClick={onUndoLast}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm border border-border hover:bg-muted transition-colors"
            data-testid="undo-last"
          >
            <Undo2 size={20} />
          </button>
          <button
            onClick={onClearAll}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm border border-border hover:bg-destructive/10 hover:text-destructive transition-colors"
            data-testid="clear-all"
          >
            <Trash2 size={20} />
          </button>
        </>
      ) : (
        <>
          {hasLastMove && (
            <button
              onClick={onToggleLastMove}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm border transition-colors',
                showLastMove
                  ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-700 dark:text-yellow-400'
                  : 'border-border hover:bg-muted',
              )}
              data-testid="show-last-move"
            >
              {showLastMove ? <EyeOff size={20} /> : <Eye size={20} />}
              {showLastMove ? t('hideLast') : t('lastMove')}
            </button>
          )}
          {isMyTurn ? (
            <>
              {canSwap && (
                <button
                  onClick={onSwap}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm border border-border hover:bg-muted transition-colors"
                  data-testid="swap-tiles"
                >
                  <Shuffle size={20} />
                  {t('swap')}
                </button>
              )}
              <button
                onClick={onPass}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm border border-border hover:bg-muted transition-colors"
                data-testid="pass-turn"
              >
                <SkipForward size={20} />
                {t('pass')}
              </button>
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground">{t('waitForTurn')}</span>
          )}
        </>
      )}
    </div>
  );
}
