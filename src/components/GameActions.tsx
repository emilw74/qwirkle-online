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
  previewScore?: number;
}

export function GameActions({
  isMyTurn, hasPlacedTiles, canSwap,
  onConfirmMove, onUndoLast, onClearAll, onSwap, onPass, isLoading,
  showLastMove, onToggleLastMove, hasLastMove, previewScore,
}: GameActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1.5 justify-center">
      {hasPlacedTiles ? (
        <>
          {(previewScore != null && previewScore > 0) && (
            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-lg bg-primary/15 text-primary font-bold text-sm tabular-nums">
              +{previewScore}
            </span>
          )}
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
          {hasLastMove && (
            <button
              onClick={onToggleLastMove}
              className={cn(
                'flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs border transition-colors',
                showLastMove
                  ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-700 dark:text-yellow-400'
                  : 'border-border hover:bg-muted',
              )}
              data-testid="show-last-move"
            >
              {showLastMove ? <EyeOff size={13} /> : <Eye size={13} />}
              {showLastMove ? t('hideLast') : t('lastMove')}
            </button>
          )}
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
                  {t('swap')}
                </button>
              )}
              <button
                onClick={onPass}
                disabled={isLoading}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs border border-border hover:bg-muted transition-colors"
                data-testid="pass-turn"
              >
                <SkipForward size={13} />
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
