import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import { Board } from '../components/Board';
import { PlayerHand } from '../components/PlayerHand';
import { ScoreBoard } from '../components/ScoreBoard';
import { GameActions } from '../components/GameActions';
import { TileView } from '../components/TileView';
import {
  placeTiles, swapPlayerTiles, passPlayerTurn, executeAITurn,
  subscribeToRoom, ensureGameFinalized
} from '../firebase/gameService';
import { Tile, PlacedTile, Position, GameState } from '../game/types';
import { validateMove, boardFromRecord } from '../game/engine';
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
  const aiProcessingRef = useRef(false);

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

  // Handle AI turns
  useEffect(() => {
    if (!gameState || !roomCode || gameState.phase !== 'playing') return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer?.isAI || aiProcessingRef.current) return;

    aiProcessingRef.current = true;

    // Add a delay to make AI feel more natural
    aiTimeoutRef.current = setTimeout(async () => {
      try {
        await executeAITurn(roomCode);
      } catch (e: any) {
        console.error('AI error:', e);
      }
      aiProcessingRef.current = false;
    }, 800 + Math.random() * 1200);

    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, [gameState?.currentPlayerIndex, gameState?.phase, roomCode]);

  // Auto-pass when turn timer expires
  const autoPassRef = useRef(false);
  useEffect(() => {
    if (!gameState || !roomCode || !playerId || gameState.phase !== 'playing') return;
    if (!gameState.turnTimeLimitMs || !gameState.turnStartedAt) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.isAI) return; // AI turns are handled by AI logic
    if (currentPlayer.id !== playerId) return; // Only auto-pass for current client

    const elapsed = Date.now() - gameState.turnStartedAt;
    const remaining = gameState.turnTimeLimitMs - elapsed;

    if (remaining <= 0 && !autoPassRef.current) {
      // Time is already up, pass immediately
      autoPassRef.current = true;
      passPlayerTurn(roomCode, currentPlayer.id)
        .catch(e => console.error('[auto-pass] error:', e))
        .finally(() => { autoPassRef.current = false; });
      return;
    }

    if (remaining > 0) {
      autoPassRef.current = false;
      const timer = setTimeout(() => {
        if (autoPassRef.current) return;
        autoPassRef.current = true;
        passPlayerTurn(roomCode, currentPlayer.id)
          .catch(e => console.error('[auto-pass] error:', e))
          .finally(() => { autoPassRef.current = false; });
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [gameState?.currentPlayerIndex, gameState?.turnStartedAt, gameState?.phase, roomCode, playerId]);

  // Ensure game finalization (leaderboard, history, sessions) — idempotent fallback
  const finalizedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!gameState || gameState.phase !== 'finished' || !roomCode || !playerId) return;
    if (finalizedRef.current === roomCode) return; // already handled this room
    finalizedRef.current = roomCode;
    ensureGameFinalized(gameState, playerId);
  }, [gameState?.phase, roomCode, playerId]);

  // Show last move info — stays visible until the next player makes their move
  const prevMovesLengthRef = useRef(gameState?.moves?.length || 0);

  useEffect(() => {
    const movesLen = gameState?.moves?.length || 0;
    if (movesLen === 0 || movesLen === prevMovesLengthRef.current) return;
    prevMovesLengthRef.current = movesLen;

    const lastMove = gameState!.moves[movesLen - 1];
    const player = gameState!.players.find(p => p.id === lastMove.playerId);
    if (!player) return;

    if (lastMove.isSwap) {
      setLastMoveInfo(`${player.nickname} ${t('swappedTiles')}`);
    } else if (lastMove.score > 0) {
      const qwirkle = lastMove.score >= 12 ? ' QWIRKLE!' : '';
      setLastMoveInfo(`${player.nickname}: +${lastMove.score} ${t('pts')}${qwirkle}`);
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
  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === playerId;
  const myHand = myPlayer?.hand || [];
  const board = gameState.board || {};
  const placedIds = new Set(placedTilesThisTurn.map(t => t.id));

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
      await placeTiles(roomCode, playerId, placedTilesThisTurn);
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
      await swapPlayerTiles(roomCode, playerId, tilesToSwap);
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
      await passPlayerTurn(roomCode, playerId);
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
              <div className="font-display font-bold text-xl">{player.score}</div>
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
        />
      </div>

      {/* Move info / error — minimal */}
      {(lastMoveInfo || error) && (
        <div className={cn(
          'mx-2 px-2 py-1 rounded-md text-xs text-center transition-all',
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
