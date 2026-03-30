import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import { Board } from '../components/Board';
import { PlayerHand } from '../components/PlayerHand';
import { ScoreBoard } from '../components/ScoreBoard';
import { GameActions } from '../components/GameActions';
import { TileView } from '../components/TileView';
import {
  placeTiles, swapPlayerTiles, passPlayerTurn, executeAITurn,
  subscribeToRoom, ensureGameFinalized, catchUpExpiredTurns,
  notifyTurnViaTelegram, notifyTurnReminderViaTelegram,
  getTelegramSettings, setGameTelegramMute,
  checkAndSendPendingReminder, clearPendingReminder,
} from '../firebase/gameService';
import { Tile, PlacedTile, Position, GameState, getLastMoveLabel } from '../game/types';
import { validateMove, boardFromRecord, getScoringLinePositions } from '../game/engine';
import { cn } from '../utils/cn';
import { ArrowLeft, Trophy, MessageCircle } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';

interface GameProps {
  onNavigate: (page: 'lobby' | 'leaderboard') => void;
}

export function Game({ onNavigate }: GameProps) {
  const { t } = useTranslation();
  const {
    playerId, roomCode, gameState, setGameState,
    selectedTiles, placedTilesThisTurn,
    selectTile, clearSelection, placeTileOnBoard, undoLastPlacement, clearPlacements,
  } = useGameStore();

  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastMoveInfo, setLastMoveInfo] = useState('');
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [swapSelection, setSwapSelection] = useState<Set<string>>(new Set());
  const [showLastMove, setShowLastMove] = useState(false);
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Telegram per-game mute
  const [tgConnected, setTgConnected] = useState(false);
  const [tgMuted, setTgMuted] = useState(false);
  useEffect(() => {
    if (!playerId || !roomCode) return;
    getTelegramSettings(playerId).then(s => {
      setTgConnected(!!s.telegramChatId && !!s.telegramNotifications);
      setTgMuted(!!s.telegramMutedGames?.[roomCode]);
    });
  }, [playerId, roomCode]);

  // Subscribe to room
  useEffect(() => {
    if (!roomCode) return;
    const unsub = subscribeToRoom(roomCode, (state) => {
      if (state) {
        setGameState(state);
      }
    });
    return () => unsub();
  }, [roomCode]);

  // Handle AI turns — chain consecutive bot turns reliably
  // Track which moves-length we've already triggered an AI turn for,
  // so each distinct game state only triggers one AI call.
  const aiTriggeredForMoveRef = useRef<number>(-1);
  useEffect(() => {
    if (!gameState || !roomCode || gameState.phase !== 'playing') return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer?.isAI) return;

    // Use moves count as a unique fingerprint for this game state.
    // Each AI turn adds a move, so moves.length changes between consecutive AI turns.
    const movesCount = gameState.moves?.length ?? 0;
    if (aiTriggeredForMoveRef.current === movesCount) return;
    aiTriggeredForMoveRef.current = movesCount;

    // Add a delay to make AI feel more natural
    const delay = 800 + Math.random() * 1200;
    aiTimeoutRef.current = setTimeout(async () => {
      try {
        const aiState = await executeAITurn(roomCode);
        // After AI plays, if next player is human, notify via Telegram
        if (aiState && aiState.phase === 'playing') {
          const next = aiState.players[aiState.currentPlayerIndex];
          if (next && !next.isAI) {
            const gameName = aiState.players.map(p => p.nickname).join(' vs ');
            const td = (aiState.turnStartedAt && aiState.turnTimeLimitMs) ? aiState.turnStartedAt + aiState.turnTimeLimitMs : undefined;
            notifyTurnViaTelegram(next.id, aiState.roomCode, gameName, td);
          }
        }
      } catch (e: any) {
        console.error('AI error:', e);
      }
    }, delay);

    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, [gameState?.currentPlayerIndex, gameState?.phase, gameState?.moves?.length, roomCode]);

  // Auto-pass when turn timer expires (handles multi-pass catch-up too)
  const catchUpRef = useRef(false);
  useEffect(() => {
    if (!gameState || !roomCode || gameState.phase !== 'playing') return;
    if (!gameState.turnTimeLimitMs || !gameState.turnStartedAt) return;

    const now = Date.now();
    const elapsed = now - gameState.turnStartedAt;
    const remaining = gameState.turnTimeLimitMs - elapsed;

    // Guard: don't auto-pass if turn started less than 3 seconds ago
    // (prevents race condition on game start / page load)
    if (elapsed < 3000) {
      const guardTimer = setTimeout(() => {
        // Re-check after guard period
        const newElapsed = Date.now() - gameState.turnStartedAt!;
        const newRemaining = gameState.turnTimeLimitMs! - newElapsed;
        if (newRemaining <= 0 && !catchUpRef.current) {
          catchUpRef.current = true;
          catchUpExpiredTurns(roomCode, gameState)
            .catch(e => console.error('[auto-pass catchUp] error:', e))
            .finally(() => { catchUpRef.current = false; });
        }
      }, 3000 - elapsed);
      return () => clearTimeout(guardTimer);
    }

    if (remaining <= 0 && !catchUpRef.current) {
      // Time already expired — catch up all missed turns
      catchUpRef.current = true;
      catchUpExpiredTurns(roomCode, gameState)
        .catch(e => console.error('[auto-pass catchUp] error:', e))
        .finally(() => { catchUpRef.current = false; });
      return;
    }

    if (remaining > 0) {
      // Schedule auto-pass for when current turn expires
      const timer = setTimeout(() => {
        if (catchUpRef.current) return;
        catchUpRef.current = true;
        catchUpExpiredTurns(roomCode, gameState)
          .catch(e => console.error('[auto-pass catchUp] error:', e))
          .finally(() => { catchUpRef.current = false; });
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [gameState?.currentPlayerIndex, gameState?.turnStartedAt, gameState?.phase, roomCode]);

  // Check for overdue pending reminders (offline fallback) whenever game state changes
  const pendingCheckedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!gameState || !roomCode || gameState.phase !== 'playing') return;
    if (!gameState.pendingReminder) return;
    const checkKey = `${roomCode}:${gameState.pendingReminder.turnStartedAt}`;
    if (pendingCheckedRef.current === checkKey) return;
    pendingCheckedRef.current = checkKey;
    checkAndSendPendingReminder(roomCode, gameState);
  }, [gameState?.pendingReminder, gameState?.turnStartedAt, roomCode]);

  // Telegram reminder: notify current player when their turn deadline approaches
  const reminderSentRef = useRef<string | null>(null); // tracks "roomCode:turnStartedAt" to avoid duplicates
  useEffect(() => {
    if (!gameState || !roomCode || gameState.phase !== 'playing') return;
    if (!gameState.turnTimeLimitMs || !gameState.turnStartedAt) return;

    const limitMs = gameState.turnTimeLimitMs;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.isAI) return;

    // Determine reminder threshold:
    // >= 60min limit → remind 30min before
    // 10–59min limit → remind 5min before
    // < 10min limit → no reminder
    let reminderBeforeMs: number;
    let minutesLabel: number;
    if (limitMs >= 60 * 60_000) {
      reminderBeforeMs = 30 * 60_000;
      minutesLabel = 30;
    } else if (limitMs >= 10 * 60_000) {
      reminderBeforeMs = 5 * 60_000;
      minutesLabel = 5;
    } else {
      return; // no reminder for < 10 min games
    }

    const now = Date.now();
    const elapsed = now - gameState.turnStartedAt;
    const deadline = gameState.turnTimeLimitMs;
    const turnDeadlineTs = gameState.turnStartedAt + limitMs;
    const reminderAt = deadline - reminderBeforeMs; // ms from turn start when reminder fires
    const msUntilReminder = reminderAt - elapsed;

    if (msUntilReminder <= 0) return; // already past reminder time

    const turnKey = `${roomCode}:${gameState.turnStartedAt}`;
    if (reminderSentRef.current === turnKey) return; // already scheduled/sent for this turn

    const timer = setTimeout(() => {
      reminderSentRef.current = turnKey;
      const gameName = gameState.players.map(p => p.nickname).join(' vs ');
      notifyTurnReminderViaTelegram(currentPlayer.id, roomCode, gameName, minutesLabel, turnDeadlineTs);
      clearPendingReminder(roomCode);
    }, msUntilReminder);

    return () => clearTimeout(timer);
  }, [gameState?.currentPlayerIndex, gameState?.turnStartedAt, gameState?.phase, roomCode, gameState?.turnTimeLimitMs]);

  // Ensure game finalization (leaderboard, history, sessions) — idempotent fallback
  const finalizedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!gameState || gameState.phase !== 'finished' || !roomCode || !playerId) return;
    if (finalizedRef.current === roomCode) return; // already handled this room
    finalizedRef.current = roomCode;
    ensureGameFinalized(gameState, playerId);
  }, [gameState?.phase, roomCode, playerId]);

  // Show last move info — stays visible until the next player makes their move
  // If recent moves are passes, show pass info + the last non-pass move
  const prevMovesLengthRef = useRef(gameState?.moves?.length || 0);

  useEffect(() => {
    const moves = gameState?.moves || [];
    const movesLen = moves.length;
    if (movesLen === 0 || movesLen === prevMovesLengthRef.current) return;
    prevMovesLengthRef.current = movesLen;

    const players = gameState!.players;
    const findNick = (id: string) => players.find(p => p.id === id)?.nickname || '?';

    // Collect trailing passes
    const passParts: string[] = [];
    let idx = movesLen - 1;
    while (idx >= 0 && moves[idx].isPass) {
      passParts.unshift(`${findNick(moves[idx].playerId)}: ${t('pass')}`);
      idx--;
    }

    // Find the last non-pass move (could be further back if several passes in a row)
    let scorePart = '';
    if (idx >= 0) {
      const m = moves[idx];
      if (m.isSwap) {
        scorePart = `${findNick(m.playerId)} ${t('swappedTiles')}`;
      } else if (m.score > 0) {
        const qwirkle = m.score >= 12 ? ' QWIRKLE!' : '';
        scorePart = `${findNick(m.playerId)}: +${m.score} ${t('pts')}${qwirkle}`;
      }
    }

    // Build combined info
    if (passParts.length > 0) {
      // Show passes + last actual move (if any)
      const passLine = passParts.join(' · ');
      setLastMoveInfo(scorePart ? `${passLine}\n${scorePart}` : passLine);
    } else if (scorePart) {
      setLastMoveInfo(scorePart);
    }
  }, [gameState?.moves?.length]);

  if (!gameState || !playerId || !roomCode) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">{t('noGameData')}</p>
        <button onClick={() => onNavigate('lobby')} className="text-primary hover:underline text-sm">
          {t('backToLobby')}
        </button>
      </div>
    );
  }

  const myPlayer = gameState.players.find(p => p.id === playerId);
  const isMyTurn = gameState.phase === 'playing' && gameState.players[gameState.currentPlayerIndex]?.id === playerId;
  const myHand = myPlayer?.hand || [];
  const board = gameState.board || {};
  const placedIds = new Set(placedTilesThisTurn.map(t => t.id));

  // Compute preview score and scoring line positions reactively as tiles are placed
  const { previewScore, scoringPositions } = useMemo(() => {
    if (placedTilesThisTurn.length === 0) return { previewScore: 0, scoringPositions: new Set<string>() };
    const tempBoard = boardFromRecord(board);
    const isFirstMove = tempBoard.size === 0;
    const result = validateMove(tempBoard, placedTilesThisTurn, isFirstMove);
    const score = result.valid ? result.score : 0;
    const positions = score > 0 ? getScoringLinePositions(tempBoard, placedTilesThisTurn) : new Set<string>();
    return { previewScore: score, scoringPositions: positions };
  }, [placedTilesThisTurn, board]);

  // Get the last non-swap move's tile positions for highlighting
  const lastMovePositions: Set<string> = new Set();
  if (showLastMove && gameState.moves?.length) {
    for (let i = gameState.moves.length - 1; i >= 0; i--) {
      const m = gameState.moves[i];
      if (!m.isSwap && m.tiles?.length > 0) {
        for (const t of m.tiles) {
          lastMovePositions.add(`${t.position.row},${t.position.col}`);
        }
        break;
      }
    }
  }

  const handleToggleLastMove = () => setShowLastMove(prev => !prev);

  const handleSelectTile = (tile: Tile) => {
    if (!isMyTurn) return;
    setSelectedTile(prev => prev?.id === tile.id ? null : tile);
    setError('');
  };

  const handleCellClick = (position: Position) => {
    if (!selectedTile || !isMyTurn) return;

    const tempBoard = boardFromRecord(board);
    for (const pt of placedTilesThisTurn) {
      tempBoard.set(`${pt.position.row},${pt.position.col}`, pt);
    }

    placeTileOnBoard(selectedTile, position);
    setSelectedTile(null);
    setShowLastMove(false);
    setError('');
  };

  /** Notify the next human player via Telegram (fire-and-forget) */
  const notifyNextPlayer = (state: GameState) => {
    if (state.phase !== 'playing') return;
    const next = state.players[state.currentPlayerIndex];
    if (!next || next.isAI) return; // AI will play, notification deferred
    const gameName = state.players.map(p => p.nickname).join(' vs ');
    const td = (state.turnStartedAt && state.turnTimeLimitMs) ? state.turnStartedAt + state.turnTimeLimitMs : undefined;
    notifyTurnViaTelegram(next.id, state.roomCode, gameName, td);
  };

  const handleConfirmMove = async () => {
    if (placedTilesThisTurn.length === 0) return;
    setIsLoading(true);
    setError('');
    try {
      const tempBoard = boardFromRecord(board);
      const isFirstMove = tempBoard.size === 0;
      const result = validateMove(tempBoard, placedTilesThisTurn, isFirstMove);
      if (!result.valid) {
        setError(result.error || t('invalidMove'));
        setIsLoading(false);
        return;
      }
      const newState = await placeTiles(roomCode, playerId, placedTilesThisTurn);
      notifyNextPlayer(newState);
      clearPlacements();
      setSelectedTile(null);
    } catch (e: any) {
      setError(e.message || t('error'));
    }
    setIsLoading(false);
  };

  const handleSwap = () => {
    setShowSwapDialog(true);
    setSwapSelection(new Set());
  };

  const handleConfirmSwap = async () => {
    if (swapSelection.size === 0) return;
    setIsLoading(true);
    setError('');
    try {
      const tilesToSwap = myHand.filter(t => swapSelection.has(t.id));
      const newState = await swapPlayerTiles(roomCode, playerId, tilesToSwap);
      notifyNextPlayer(newState);
      setShowSwapDialog(false);
      setSwapSelection(new Set());
    } catch (e: any) {
      setError(e.message || t('swapError'));
    }
    setIsLoading(false);
  };

  const handlePass = async () => {
    setIsLoading(true);
    setError('');
    try {
      const newState = await passPlayerTurn(roomCode, playerId);
      notifyNextPlayer(newState);
    } catch (e: any) {
      setError(e.message || t('error'));
    }
    setIsLoading(false);
  };

  const handleUndoLast = () => {
    undoLastPlacement();
    setError('');
  };

  const handleClearAll = () => {
    clearPlacements();
    setSelectedTile(null);
    setError('');
  };

  // Game finished screen
  if (gameState.phase === 'finished') {
    const sorted = [...gameState.players].sort((a, b) => b.score - a.score);
    return (
      <div className="max-w-lg mx-auto space-y-4 py-4 px-4 overflow-y-auto h-full">
        <div className="text-center space-y-3">
          <Trophy size={48} className="mx-auto text-yellow-500" />
          <h2 className="font-display font-bold text-2xl">{t('gameEnd')}</h2>
          <p className="text-muted-foreground">
            {t('winner')} <strong className="text-foreground">{gameState.winner}</strong>
          </p>
          {gameState.consecutivePasses >= gameState.players.length * 2 && (
            <p className="text-xs text-muted-foreground/70 italic">
              {t('endedByAllPassed')}
            </p>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3">
          {sorted.map((player, idx) => (
            <div
              key={player.id}
              className={cn(
                'flex items-center gap-4 p-3 rounded-xl',
                idx === 0 && 'bg-yellow-500/10 border border-yellow-500/30',
                idx === 1 && 'bg-muted/50',
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center font-display font-bold',
                idx === 0 && 'bg-yellow-500 text-white',
                idx === 1 && 'bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200',
                idx === 2 && 'bg-orange-400 text-white',
              )}>
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {player.nickname}
                  {player.id === playerId && ` (${t('you')})`}
                  {player.isAI && ' 🤖'}
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-display font-bold text-xl">{player.score}</span>
                {(() => {
                  const label = getLastMoveLabel(gameState.moves || [], player.id);
                  if (!label) return null;
                  const isScore = label.startsWith('+');
                  return (
                    <span className={cn(
                      'text-[10px] tabular-nums',
                      isScore ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
                    )}>
                      {label}
                    </span>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('lobby')}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all"
          >
            {t('newGame')}
          </button>
          <button
            onClick={() => onNavigate('leaderboard')}
            className="px-4 py-3 rounded-xl border border-border hover:bg-muted transition-colors"
          >
            <Trophy size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Compact top bar: scores inline */}
      <div className="flex-shrink-0 px-2 py-1.5">
        <ScoreBoard
          players={gameState.players}
          currentPlayerIndex={gameState.currentPlayerIndex}
          myPlayerId={playerId}
          bagSize={(gameState.bag || []).length}
          turnTimeLimitMs={gameState.turnTimeLimitMs}
          turnStartedAt={gameState.turnStartedAt}
          moves={gameState.moves}
        />
      </div>

      {/* Move info / error — minimal */}
      {(lastMoveInfo || error) && (
        <div className={cn(
          'mx-2 px-2 py-1 rounded-md text-xs text-center transition-all whitespace-pre-line',
          error ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
        )}>
          {error || lastMoveInfo}
        </div>
      )}

      {/* Board — takes all remaining space */}
      <div className="flex-1 px-1 min-h-0">
        <Board
          board={board}
          onCellClick={handleCellClick}
          selectedTile={selectedTile}
          placedThisTurn={placedTilesThisTurn}
          isMyTurn={isMyTurn}
          myHand={myHand.filter(t => !placedIds.has(t.id))}
          highlightedPositions={lastMovePositions}
          previewScore={previewScore}
          scoringPositions={scoringPositions}
          tgConnected={tgConnected}
          tgMuted={tgMuted}
          onToggleTgMute={async () => {
            const newMuted = !tgMuted;
            setTgMuted(newMuted);
            if (playerId) await setGameTelegramMute(playerId, roomCode, newMuted);
          }}
          tgMuteTitle={tgMuted ? t('telegramUnmuteGame') : t('telegramMuteGame')}
        />
      </div>

      {/* Compact bottom: hand + actions in one strip */}
      <div className="flex-shrink-0 border-t border-border/50 bg-card/80 backdrop-blur-sm px-2 pb-1 pt-1">
        <PlayerHand
          hand={myHand}
          selectedTile={selectedTile}
          onSelectTile={handleSelectTile}
          isMyTurn={isMyTurn}
          placedTileIds={placedIds}
        />
        <GameActions
          isMyTurn={isMyTurn}
          hasPlacedTiles={placedTilesThisTurn.length > 0}
          canSwap={(gameState.bag || []).length > 0}
          onConfirmMove={handleConfirmMove}
          onUndoLast={handleUndoLast}
          onClearAll={handleClearAll}
          onSwap={handleSwap}
          onPass={handlePass}
          isLoading={isLoading}
          showLastMove={showLastMove}
          onToggleLastMove={handleToggleLastMove}
          hasLastMove={(gameState.moves || []).some(m => !m.isSwap && m.tiles?.length > 0)}
        />
      </div>

      {/* Swap dialog */}
      {showSwapDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="font-display font-bold text-lg">{t('swapTiles')}</h3>
            <p className="text-sm text-muted-foreground">{t('selectTilesToSwap')}</p>
            <div className="flex gap-2 flex-wrap justify-center">
              {myHand.map(tile => (
                <TileView
                  key={tile.id}
                  tile={tile}
                  size={52}
                  selected={swapSelection.has(tile.id)}
                  onClick={() => {
                    const next = new Set(swapSelection);
                    if (next.has(tile.id)) next.delete(tile.id);
                    else next.add(tile.id);
                    setSwapSelection(next);
                  }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSwapDialog(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleConfirmSwap}
                disabled={swapSelection.size === 0 || isLoading}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {t('swapCount')} ({swapSelection.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
