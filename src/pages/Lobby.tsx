import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import {
  createRoom, joinRoom, addAIToRoom, startGameInRoom, subscribeToRoom,
  savePlayerSession, updateSessionGameName, getGamesForPlayer,
  removePlayerSession, deleteGame,
  PlayerSession, PlayerGames,
} from '../firebase/gameService';
import { cn } from '../utils/cn';
import {
  Users, Bot, Play, Plus, LogIn, Trophy, Copy, Check,
  ArrowLeft, Gamepad2, ChevronRight, X, BookOpen, Info, Trash2, Clock, Shield,
} from 'lucide-react';
import { AILevel, GameState, Tile } from '../game/types';
import { TileView } from '../components/TileView';
import { posKey, parseKey } from '../game/engine';
import { useTranslation } from '../i18n/LanguageContext';
import { LanguageToggle } from '../components/LanguageToggle';

export type LobbyMode = 'menu' | 'create' | 'join' | 'waiting' | 'mygames';

interface LobbyProps {
  onNavigate: (page: 'game' | 'leaderboard' | 'rules' | 'about' | 'admin') => void;
  initialMode?: 'menu' | 'mygames';
  onModeChange?: (mode: LobbyMode) => void;
  isSuperUser?: boolean;
}

// --- Mini Board for finished game detail ---
function MiniBoard({ board, cellSize = 18 }: { board: Record<string, Tile>; cellSize?: number }) {
  const { t } = useTranslation();
  const keys = Object.keys(board);
  if (keys.length === 0) return <div className="text-xs text-muted-foreground text-center py-4">{t('emptyBoard')}</div>;

  const positions = keys.map(parseKey);
  const minRow = Math.min(...positions.map(p => p.row));
  const maxRow = Math.max(...positions.map(p => p.row));
  const minCol = Math.min(...positions.map(p => p.col));
  const maxCol = Math.max(...positions.map(p => p.col));

  const cols = maxCol - minCol + 1;
  const rows = maxRow - minRow + 1;
  const gap = 2;

  return (
    <div className="overflow-auto max-h-[50vh] rounded-lg bg-muted/30 dark:bg-muted/10 border border-border/50 p-2">
      <div
        className="grid mx-auto"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gap: `${gap}px`,
          width: 'fit-content',
        }}
      >
        {Array.from({ length: rows * cols }).map((_, idx) => {
          const row = minRow + Math.floor(idx / cols);
          const col = minCol + (idx % cols);
          const key = posKey(row, col);
          const tile = board[key];

          if (tile) {
            return (
              <TileView
                key={key}
                tile={tile}
                size={cellSize}
                showShadow={false}
              />
            );
          }

          return <div key={key} style={{ width: cellSize, height: cellSize }} />;
        })}
      </div>
    </div>
  );
}

// --- Finished Game Detail ---
function FinishedGameDetail({ session, onClose }: { session: PlayerSession; onClose: () => void }) {
  const { t, lang } = useTranslation();
  const finishedDate = session.finishedAt
    ? new Date(session.finishedAt).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '';

  const sorted = [...(session.finalPlayers || [])].sort((a, b) => b.score - a.score);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl border border-border p-5 max-w-md w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">{session.gameName}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="text-xs text-muted-foreground">
          {t('finishedAt')} {finishedDate}
        </div>

        {/* Scores */}
        <div className="space-y-2">
          {sorted.map((player, idx) => (
            <div
              key={player.nickname}
              className={cn(
                'flex items-center gap-3 p-2.5 rounded-lg',
                idx === 0 && 'bg-yellow-500/10 border border-yellow-500/30',
                idx > 0 && 'bg-muted/50',
              )}
            >
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center font-display font-bold text-xs',
                idx === 0 && 'bg-yellow-500 text-white',
                idx === 1 && 'bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200',
                idx === 2 && 'bg-orange-400 text-white',
              )}>
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm truncate block">
                  {player.nickname}
                  {player.isAI && ' 🤖'}
                  {player.nickname === session.winner && ' 🏆'}
                </span>
              </div>
              <div className="font-display font-bold text-lg">{player.score}</div>
            </div>
          ))}
        </div>

        {/* Board */}
        {session.finalBoard && Object.keys(session.finalBoard).length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">{t('finalBoardLayout')}</div>
            <MiniBoard board={session.finalBoard} cellSize={22} />
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimeShort(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m > 0 ? m + 'min' : ''}`;
  if (m > 0) return `${m}:${s.toString().padStart(2, '0')}`;
  return `0:${s.toString().padStart(2, '0')}`;
}

function formatTimeLimitDisplay(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return '<1min';
  const totalMin = Math.floor(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 && d === 0) parts.push(`${m}min`); // skip minutes when days shown
  return parts.join(' ') || '<1min';
}

export function Lobby({ onNavigate, initialMode = 'menu', onModeChange, isSuperUser }: LobbyProps) {
  const { t, lang } = useTranslation();
  const { uid, nickname, setPlayerId, setRoomCode, setGameState } = useGameStore();
  const [mode, setModeRaw] = useState<LobbyMode>(initialMode);
  const setMode = (m: LobbyMode) => {
    setModeRaw(m);
    onModeChange?.(m);
  };
  // Notify parent of initial mode on mount
  useEffect(() => { onModeChange?.(initialMode); }, []);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [roomInfo, setRoomInfo] = useState<{ code: string; players: string[] } | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [turnTimeHours, setTurnTimeHours] = useState<number | ''>('');
  const [turnTimeMinutes, setTurnTimeMinutes] = useState<number | ''>('');
  const [copied, setCopied] = useState(false);
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);

  // My games state
  const [playerGames, setPlayerGames] = useState<PlayerGames>({ active: [], finished: [] });
  const [loadingGames, setLoadingGames] = useState(false);
  const [selectedFinished, setSelectedFinished] = useState<PlayerSession | null>(null);

  // Delete game state
  const [deleteConfirm, setDeleteConfirm] = useState<{ roomCode: string; gameName: string; hasBots: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Auto-refresh: only when some game needs background processing (not all waiting on me)
  const [tick, setTick] = useState(0);
  const loadingRef = useRef(false);
  loadingRef.current = loadingGames;
  const gamesRef = useRef(playerGames);
  gamesRef.current = playerGames;
  useEffect(() => {
    if (mode !== 'mygames') return;
    // Immediately load games when entering mygames view
    loadGames();
    // Tick every second for countdown timers
    const tickInterval = setInterval(() => setTick(t => t + 1), 1_000);
    // Full reload every 10 seconds, but only if needed
    const refreshInterval = setInterval(() => {
      if (loadingRef.current) return;
      const { active } = gamesRef.current;
      // Refresh needed when any active game needs background processing:
      // - phase 'waiting' (someone might join)
      // - it's not my turn (bot or opponent could act)
      // - timer expired (needs catchUpExpiredTurns even if it's "my turn")
      const now = Date.now();
      const needsRefresh = active.length === 0 || active.some(({ session, gameState }) => {
        if (gameState.phase === 'waiting') return true;
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (currentPlayer?.id !== session.playerId) return true;
        // Even if it's my turn, refresh if my timer has expired (auto-pass needed)
        if (gameState.turnTimeLimitMs && gameState.turnStartedAt) {
          const deadline = gameState.turnStartedAt + gameState.turnTimeLimitMs;
          if (now >= deadline) return true;
        }
        return false;
      });
      if (needsRefresh) loadGames();
    }, 10_000);
    return () => {
      clearInterval(tickInterval);
      clearInterval(refreshInterval);
    };
  }, [mode]);

  const currentNick = nickname || t('defaultPlayer');
  const currentUid = uid || '';

  const loadGames = async () => {
    if (!currentUid) return;
    setLoadingGames(true);
    try {
      const games = await getGamesForPlayer(currentUid);
      setPlayerGames(games);
    } catch (e) {
      console.error('Error loading games:', e);
    }
    setLoadingGames(false);
  };

  const handleCreateRoom = async () => {
    if (!currentUid) { setError(t('authError')); return; }
    setIsLoading(true);
    setError('');
    try {
      const h = turnTimeHours === '' ? 0 : turnTimeHours;
      const m = turnTimeMinutes === '' ? 0 : turnTimeMinutes;
      const turnTimeLimitMs = (h === 0 && m === 0) ? 24 * 60 * 60 * 1000 : (h * 60 + m) * 60 * 1000;
      const { roomCode, playerId, gameState } = await createRoom(currentNick, maxPlayers, currentUid, turnTimeLimitMs);
      setPlayerId(playerId);
      setRoomCode(roomCode);
      setGameState(gameState);
      setRoomInfo({ code: roomCode, players: [currentNick] });
      setMode('waiting');

      await savePlayerSession(currentUid, roomCode, playerId, gameState.players, currentUid);

      const unsub = subscribeToRoom(roomCode, (state) => {
        if (state) {
          setGameState(state);
          setRoomInfo({
            code: roomCode,
            players: state.players.map(p => p.nickname),
          });
          if (state.phase === 'playing') {
            updateSessionGameName(currentUid, roomCode, state.players);
            onNavigate('game');
          }
        }
      });
      setUnsubscribe(() => unsub);
    } catch (e: any) {
      setError(e.message || t('createRoomError'));
    }
    setIsLoading(false);
  };

  const handleJoinRoom = async () => {
    if (!currentUid) { setError(t('authError')); return; }
    if (joinCode.length !== 6) { setError(t('roomCodeError')); return; }
    setIsLoading(true);
    setError('');
    try {
      const { playerId, gameState } = await joinRoom(joinCode, currentNick, currentUid);
      setPlayerId(playerId);
      setRoomCode(joinCode);
      setGameState(gameState);
      setMode('waiting');
      setRoomInfo({ code: joinCode, players: gameState.players.map(p => p.nickname) });

      await savePlayerSession(currentUid, joinCode, playerId, gameState.players, gameState.hostId);

      const unsub = subscribeToRoom(joinCode, (state) => {
        if (state) {
          setGameState(state);
          setRoomInfo({
            code: joinCode,
            players: state.players.map(p => p.nickname),
          });
          if (state.phase === 'playing') {
            updateSessionGameName(currentUid, joinCode, state.players);
            onNavigate('game');
          }
        }
      });
      setUnsubscribe(() => unsub);
    } catch (e: any) {
      setError(e.message || t('joinError'));
    }
    setIsLoading(false);
  };

  const handleRejoinGame = async (session: PlayerSession, gameState?: GameState) => {
    setIsLoading(true);
    setError('');
    try {
      // Auto-start if host clicks a full waiting game
      if (gameState?.phase === 'waiting'
        && gameState.hostId === currentUid
        && gameState.players.length >= gameState.maxPlayers) {
        await startGameInRoom(session.roomCode);
      }

      setPlayerId(session.playerId);
      setRoomCode(session.roomCode);

      const unsub = subscribeToRoom(session.roomCode, (state) => {
        if (state) {
          setGameState(state);
          updateSessionGameName(currentUid, session.roomCode, state.players);
        }
      });
      setUnsubscribe(() => unsub);

      await new Promise(resolve => setTimeout(resolve, 500));
      onNavigate('game');
    } catch (e: any) {
      setError(e.message || t('rejoinError'));
    }
    setIsLoading(false);
  };

  const handleDeleteFinished = async (session: PlayerSession) => {
    try {
      await removePlayerSession(currentUid, session.roomCode);
      setPlayerGames(prev => ({
        ...prev,
        finished: prev.finished.filter(s => s.roomCode !== session.roomCode),
      }));
    } catch (e) {
      console.error('Error removing session:', e);
    }
  };

  const handleDeleteGame = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const permanent = deleteConfirm.hasBots;
      await deleteGame(deleteConfirm.roomCode, currentNick, permanent);

      if (permanent) {
        // Bot games: remove completely from local state
        setPlayerGames(prev => ({
          active: prev.active.filter(a => a.session.roomCode !== deleteConfirm.roomCode),
          finished: prev.finished.filter(s => s.roomCode !== deleteConfirm.roomCode),
        }));
      } else {
        // Human games: mark as deleted in local state
        const now = Date.now();
        setPlayerGames(prev => ({
          active: prev.active.filter(a => a.session.roomCode !== deleteConfirm.roomCode),
          finished: prev.finished.map(s =>
            s.roomCode === deleteConfirm.roomCode
              ? { ...s, deletedAt: now, deletedBy: currentNick }
              : s
          ).concat(
            prev.active
              .filter(a => a.session.roomCode === deleteConfirm.roomCode)
              .map(a => ({ ...a.session, status: 'finished' as const, deletedAt: now, deletedBy: currentNick }))
          ),
        }));
      }
      setDeleteConfirm(null);
    } catch (e) {
      console.error('Error deleting game:', e);
    }
    setDeleting(false);
  };

  const handleAddAI = async (level: AILevel) => {
    if (!roomInfo) return;
    setIsLoading(true);
    try {
      const updatedState = await addAIToRoom(roomInfo.code, level);
      await savePlayerSession(currentUid, roomInfo.code, useGameStore.getState().playerId!, updatedState.players);
    } catch (e: any) {
      setError(e.message || t('addAiError'));
    }
    setIsLoading(false);
  };

  const handleStartGame = async () => {
    if (!roomInfo) return;
    setIsLoading(true);
    try {
      await startGameInRoom(roomInfo.code);
    } catch (e: any) {
      setError(e.message || t('startGameError'));
    }
    setIsLoading(false);
  };

  const copyCode = () => {
    if (roomInfo) {
      navigator.clipboard.writeText(roomInfo.code).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBack = () => {
    if (unsubscribe) unsubscribe();
    setMode('menu');
    setError('');
    setRoomInfo(null);
  };

  const handleOpenMyGames = () => {
    setError('');
    setMode('mygames');
    loadGames();
  };

  // --- RENDER ---

  // Delete confirmation modal
  const deleteModal = deleteConfirm && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl border border-border p-5 max-w-sm w-full shadow-xl space-y-4">
        <h3 className="font-display font-bold text-lg">{t('deleteGameConfirmTitle')}</h3>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{deleteConfirm.gameName}</strong>
        </p>
        <p className="text-sm text-muted-foreground">{t(deleteConfirm.hasBots ? 'deleteGameConfirmMsgPermanent' : 'deleteGameConfirmMsg')}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setDeleteConfirm(null)}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleDeleteGame}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {deleting ? (
              <div className="w-4 h-4 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin" />
            ) : (
              <><Trash2 size={14} />{t('deleteGameConfirm')}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Finished game detail modal
  const finishedModal = selectedFinished && (
    <FinishedGameDetail
      session={selectedFinished}
      onClose={() => setSelectedFinished(null)}
    />
  );

  // My games view
  if (mode === 'mygames') {
    const { active, finished } = playerGames;
    return (
      <div className="max-w-md mx-auto space-y-6">
        {finishedModal}
        {deleteModal}
        <button onClick={handleBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft size={16} /> {t('back')}
        </button>

        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm space-y-5">
          <h2 className="font-display font-bold text-xl">{t('myGames')}</h2>

          {loadingGames ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Active games */}
              {active.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('active')} ({active.length})
                  </div>
                  {active.map(({ session, gameState }) => {
                    const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === session.playerId;
                    const myPlayer = gameState.players.find(p => p.id === session.playerId);
                    const isHost = gameState.hostId === currentUid;
                    const currentTurnPlayer = gameState.players[gameState.currentPlayerIndex];
                    const remainingMs = (gameState.turnTimeLimitMs && gameState.turnStartedAt)
                      ? Math.max(0, gameState.turnTimeLimitMs - (Date.now() - gameState.turnStartedAt))
                      : null;
                    const myAutoPassCount = gameState.autoPassCounts?.[session.playerId] || 0;
                    const gameStartedAt = gameState.moves?.[0]?.timestamp;
                    const gameDurationMs = gameStartedAt ? Date.now() - gameStartedAt : 0;
                    // Use tick to force re-render
                    void tick;
                    return (
                      <div key={session.roomCode} className="rounded-xl border border-border/50 overflow-hidden">
                        <button
                          onClick={() => handleRejoinGame(session, gameState)}
                          disabled={isLoading}
                          className={cn(
                            'w-full p-3.5 text-left transition-all hover:shadow-md',
                            isMyTurn
                              ? 'bg-primary/5 hover:bg-primary/10'
                              : 'bg-card hover:bg-muted/50',
                          )}
                          data-testid={`rejoin-${session.roomCode}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              {gameState.phase === 'playing' ? (
                                <div className="font-semibold text-sm truncate">
                                  {gameState.players.map((p, i) => (
                                    <span key={p.id}>
                                      {i > 0 && <span className="text-muted-foreground font-normal">{gameState.players.length === 2 ? ' vs ' : ', '}</span>}
                                      <span className={p.isAI ? 'text-[#2563eb] dark:text-blue-300' : ''}>{p.nickname}</span>
                                      <span className="text-muted-foreground font-normal">: {p.score}</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div className="font-semibold text-sm truncate">{session.gameName}</div>
                              )}
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {gameState.phase === 'waiting' ? (() => {
                                  const isFull = gameState.players.length >= gameState.maxPlayers;
                                  const hostPlayer = gameState.players.find(p => p.id === gameState.hostId);
                                  if (isFull && isHost) {
                                    return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-500/15 text-green-700 dark:text-green-400">{t('readyToStart')}</span>;
                                  } else if (isFull) {
                                    return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">{t('waitingForHost2')} {hostPlayer?.nickname || '...'}</span>;
                                  } else {
                                    return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">{t('waitingForPlayers')} ({gameState.players.length}/{gameState.maxPlayers})</span>;
                                  }
                                })() : (
                                  <span className={cn(
                                    'text-xs px-2 py-0.5 rounded-full font-medium',
                                    isMyTurn
                                      ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                                      : 'bg-muted text-muted-foreground',
                                  )}>
                                    {isMyTurn ? t('yourTurn') : t('waitTurn')}
                                  </span>
                                )}
                                {gameState.phase === 'waiting' && gameState.players.length < gameState.maxPlayers && (
                                  <span className="text-xs font-mono font-bold tracking-wider text-primary">{session.roomCode}</span>
                                )}
                                {gameState.phase === 'playing' && currentTurnPlayer && (
                                  <span className="text-xs text-muted-foreground">
                                    {t('turnOf')} {currentTurnPlayer.nickname}
                                  </span>
                                )}
                                {gameState.phase === 'playing' && remainingMs !== null && (
                                  <span className={cn(
                                    'text-xs flex items-center gap-0.5',
                                    remainingMs < 300_000 ? 'text-destructive' : 'text-muted-foreground',
                                  )}>
                                    <Clock size={10} />
                                    {formatTimeShort(remainingMs)}
                                  </span>
                                )}
                                {gameState.phase === 'playing' && myAutoPassCount > 0 && (
                                  <span className="text-xs text-orange-600 dark:text-orange-400">
                                    {t('autoPassCount')} {myAutoPassCount}
                                  </span>
                                )}
                                {gameState.phase === 'playing' && gameStartedAt && (
                                  <span className="text-xs text-muted-foreground/70">
                                    ⏱ {formatDuration(gameDurationMs)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                          </div>
                        </button>
                        {isHost && (
                          <div className="border-t border-border/30 px-3.5 py-1.5 flex justify-end">
                            <button
                              onClick={() => setDeleteConfirm({ roomCode: session.roomCode, gameName: session.gameName, hasBots: gameState.players.filter(p => !p.isAI).length <= 1 && gameState.players.some(p => p.isAI) })}
                              className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                            >
                              <Trash2 size={11} /> {t('deleteGame')}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Finished games */}
              {finished.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t('finished')} ({finished.length})
                  </div>
                  {finished.map(session => {
                    const isDeleted = !!session.deletedAt;
                    const isHost = session.hostId === currentUid;
                    const finishedDate = session.finishedAt
                      ? new Date(session.finishedAt).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : '';
                    const deletedDate = session.deletedAt
                      ? new Date(session.deletedAt).toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-GB', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : '';
                    const sorted = [...(session.finalPlayers || [])].sort((a, b) => b.score - a.score);
                    const totalDurationMs = (session.finishedAt && session.gameStartedAt)
                      ? session.finishedAt - session.gameStartedAt
                      : 0;

                    return (
                      <div
                        key={session.roomCode}
                        className={cn(
                          'rounded-xl border overflow-hidden',
                          isDeleted
                            ? 'border-border/30 bg-muted/10 opacity-60'
                            : 'border-border/50 bg-muted/20',
                        )}
                      >
                        {isDeleted ? (
                          /* Deleted game — greyed out, no click */
                          <div className="p-3.5">
                            <div className="flex items-center gap-2 mb-1">
                              <Trash2 size={13} className="text-muted-foreground/60 flex-shrink-0" />
                              <div className="font-semibold text-sm truncate line-through text-muted-foreground">
                                {session.gameName}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground/70 space-y-0.5 pl-5">
                              <div>
                                {t('gameDeletedBy')} {session.deletedBy} {t('gameDeletedOn')} {deletedDate}
                                {totalDurationMs > 0 && <span className="ml-2">⏱ {formatDuration(totalDurationMs)}</span>}
                              </div>
                              {sorted.length > 0 && (
                                <div className="flex items-center gap-3 mt-1">
                                  {sorted.map(p => (
                                    <span key={p.nickname}>
                                      {p.nickname}: {p.score}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="border-t border-border/30 px-3.5 py-1.5 flex justify-end">
                              <button
                                onClick={() => handleDeleteFinished(session)}
                                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                              >
                                {t('remove')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Normal finished game */
                          <>
                            <button
                              onClick={() => setSelectedFinished(session)}
                              className="w-full p-3.5 text-left transition-all hover:bg-muted/40"
                              data-testid={`finished-${session.roomCode}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-sm truncate">{session.gameName}</div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-xs text-muted-foreground">{finishedDate}</span>
                                    {totalDurationMs > 0 && (
                                      <span className="text-xs text-muted-foreground/70">⏱ {formatDuration(totalDurationMs)}</span>
                                    )}
                                    {session.winner && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 font-medium">
                                        🏆 {session.winner}
                                      </span>
                                    )}
                                  </div>
                                  {sorted.length > 0 && (
                                    <div className="flex items-center gap-3 mt-1.5">
                                      {sorted.map(p => (
                                        <span key={p.nickname} className="text-xs text-muted-foreground">
                                          {p.nickname}: <strong className="text-foreground">{p.score}</strong>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                              </div>
                            </button>
                            <div className="border-t border-border/30 px-3.5 py-1.5 flex justify-end gap-3">
                              {isHost && (
                                <button
                                  onClick={() => setDeleteConfirm({ roomCode: session.roomCode, gameName: session.gameName, hasBots: (session.finalPlayers || []).filter(p => !p.isAI).length <= 1 && (session.finalPlayers || []).some(p => p.isAI) })}
                                  className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                                >
                                  <Trash2 size={11} /> {t('deleteGame')}
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteFinished(session)}
                                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                              >
                                {t('remove')}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {active.length === 0 && finished.length === 0 && (
                <div className="text-center py-8 space-y-2">
                  <Gamepad2 size={32} className="mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">{t('noGames')}</p>
                  <p className="text-xs text-muted-foreground/70">{t('noGamesHint')}</p>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">{error}</div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'waiting' && roomInfo) {
    const gameState = useGameStore.getState().gameState;
    const isHost = gameState?.hostId === useGameStore.getState().playerId;
    const canStart = roomInfo.players.length >= 2 && roomInfo.players.length >= maxPlayers;
    const canAddAI = roomInfo.players.length < maxPlayers;

    return (
      <div className="max-w-md mx-auto space-y-6">
        <button onClick={handleBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft size={16} /> {t('back')}
        </button>

        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm space-y-5">
          <div className="text-center space-y-2">
            <h2 className="font-display font-bold text-xl">{t('waitingRoom')}</h2>
            <div className="flex items-center justify-center gap-2">
              <span className="text-muted-foreground text-sm">{t('roomCodeLabel')}</span>
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg font-mono font-bold text-lg hover:bg-primary/20 transition-colors"
              >
                {roomInfo.code}
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              {t('playersCount')} ({roomInfo.players.length}/{maxPlayers})
            </div>
            {roomInfo.players.map((name, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  {name.startsWith('Bot') ? <Bot size={16} className="text-primary" /> : <Users size={16} className="text-primary" />}
                </div>
                <span className="font-medium text-sm">{name}</span>
                {i === 0 && <span className="text-xs px-2 py-0.5 bg-accent/20 text-accent rounded-full ml-auto">Host</span>}
              </div>
            ))}
          </div>

          {/* Turn time limit info */}
          {gameState?.turnTimeLimitMs && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50 rounded-lg">
              <Clock size={15} className="text-muted-foreground flex-shrink-0" />
              <div className="text-sm">
                <span className="text-muted-foreground">{t('timePerMove')}</span>{' '}
                <span className="font-medium">{formatTimeLimitDisplay(gameState.turnTimeLimitMs)}</span>
              </div>
            </div>
          )}

          {isHost && canAddAI && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">{t('addBot')}</div>
              <div className="grid grid-cols-3 gap-2">
                {(['easy', 'medium', 'hard'] as AILevel[]).map(level => (
                  <button
                    key={level}
                    onClick={() => handleAddAI(level)}
                    disabled={isLoading}
                    className={cn(
                      'p-2.5 rounded-lg border text-sm font-medium transition-all',
                      'hover:bg-muted disabled:opacity-50',
                      level === 'easy' && 'border-green-300 text-green-600 dark:border-green-700 dark:text-green-400',
                      level === 'medium' && 'border-yellow-300 text-yellow-600 dark:border-yellow-700 dark:text-yellow-400',
                      level === 'hard' && 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400',
                    )}
                  >
                    <Bot size={20} className="mx-auto mb-1" />
                    {level === 'easy' ? t('botEasy') : level === 'medium' ? t('botMedium') : t('botHard')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">{error}</div>
          )}

          {isHost && (
            <button
              onClick={handleStartGame}
              disabled={!canStart || isLoading}
              className={cn(
                'w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
                canStart
                  ? 'bg-primary text-primary-foreground hover:opacity-90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
              )}
              data-testid="start-game"
            >
              <Play size={18} />
              {canStart ? t('startGame') : `${t('waitingForPlayers')} (${roomInfo.players.length}/${maxPlayers})`}
            </button>
          )}

          {!isHost && (
            <div className="text-center text-sm text-muted-foreground animate-pulse">
              {t('waitingForHost')}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'create' || mode === 'join') {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <button onClick={handleBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft size={16} /> {t('back')}
        </button>

        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm space-y-5">
          <h2 className="font-display font-bold text-xl text-center">
            {mode === 'create' ? t('createRoom') : t('joinRoom')}
          </h2>

          <div className="space-y-4">
            {/* Show current player */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {currentNick.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-sm">{currentNick}</div>
                <div className="text-xs text-muted-foreground">{t('loggedIn')}</div>
              </div>
            </div>

            {mode === 'join' && (
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('roomCode')}</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  placeholder={t('roomCodePlaceholder')}
                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm font-mono text-center text-xl tracking-[0.3em]"
                  data-testid="room-code-input"
                />
              </div>
            )}

            {mode === 'create' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1.5">{t('maxPlayers')}</label>
                  <div className="flex gap-2">
                    {[2, 3].map(n => (
                      <button
                        key={n}
                        onClick={() => setMaxPlayers(n)}
                        className={cn(
                          'flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all',
                          maxPlayers === n
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border hover:bg-muted',
                        )}
                      >
                        {n} {t('nPlayers')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    {t('turnTimeLimit')} <span className="text-xs text-muted-foreground font-normal">({t('turnTimeDefault')})</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={48}
                          value={turnTimeHours}
                          placeholder="0"
                          onChange={e => {
                            const v = e.target.value;
                            if (v === '') { setTurnTimeHours(''); return; }
                            setTurnTimeHours(Math.min(48, Math.max(0, parseInt(v) || 0)));
                          }}
                          className="w-16 px-2 py-2 rounded-lg border border-input bg-background text-foreground text-sm text-center"
                        />
                        <span className="text-sm text-muted-foreground">{t('hours')}</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={turnTimeMinutes}
                          placeholder="0"
                          onChange={e => {
                            const v = e.target.value;
                            if (v === '') { setTurnTimeMinutes(''); return; }
                            setTurnTimeMinutes(Math.min(59, Math.max(0, parseInt(v) || 0)));
                          }}
                          className="w-16 px-2 py-2 rounded-lg border border-input bg-background text-foreground text-sm text-center"
                        />
                        <span className="text-sm text-muted-foreground">{t('minutes')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {[
                      { h: 0, m: 2, label: '2min' },
                      { h: 0, m: 5, label: '5min' },
                      { h: 0, m: 15, label: '15min' },
                      { h: 1, m: 0, label: '1h' },
                      { h: 6, m: 0, label: '6h' },
                      { h: 24, m: 0, label: '24h' },
                    ].map(preset => (
                      <button
                        key={preset.label}
                        onClick={() => { setTurnTimeHours(preset.h); setTurnTimeMinutes(preset.m); }}
                        className={cn(
                          'px-2.5 py-1 rounded-md border text-xs font-medium transition-all',
                          turnTimeHours === preset.h && turnTimeMinutes === preset.m
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'border-border hover:bg-muted text-muted-foreground',
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">{error}</div>
            )}

            <button
              onClick={mode === 'create' ? handleCreateRoom : handleJoinRoom}
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="submit-room"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'create' ? <Plus size={18} /> : <LogIn size={18} />}
                  {mode === 'create' ? t('createRoom') : t('join')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main menu
  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Logo + Language toggle */}
      <div className="text-center space-y-3 pt-4">
        <div className="flex justify-center">
          <LanguageToggle />
        </div>
        <div className="inline-flex items-center gap-1">
          {['red', 'orange', 'yellow', 'green', 'blue', 'purple'].map((color, i) => (
            <div
              key={color}
              className="w-7 h-7 rounded-md"
              style={{
                backgroundColor: {
                  red: '#e63946', orange: '#f77f00', yellow: '#fcbf49',
                  green: '#2db84d', blue: '#3a7bd5', purple: '#7b2cbf',
                }[color],
                transform: `rotate(${(i - 2.5) * 5}deg)`,
              }}
            />
          ))}
        </div>
        <h1 className="font-display font-bold text-3xl tracking-tight">Qwirkle Online</h1>
        <p className="text-muted-foreground text-sm">{t('lobbySubtitle')}</p>
      </div>

      {/* Main actions */}
      <div className="space-y-3">
        <button
          onClick={() => setMode('create')}
          className="w-full p-4 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center gap-4 hover:opacity-90 transition-all shadow-sm"
          data-testid="create-room"
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Plus size={24} />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold">{t('createRoom')}</div>
            <div className="text-xs opacity-80">{t('createRoomDesc')}</div>
          </div>
        </button>

        <button
          onClick={() => setMode('join')}
          className="w-full p-4 rounded-xl bg-card border border-border/50 font-semibold flex items-center gap-4 hover:bg-muted/50 transition-all shadow-sm"
          data-testid="join-room"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <LogIn size={24} className="text-accent" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold">{t('joinRoom')}</div>
            <div className="text-xs text-muted-foreground">{t('joinRoomDesc')}</div>
          </div>
        </button>

        <button
          onClick={handleOpenMyGames}
          className="w-full p-4 rounded-xl bg-card border border-border/50 font-semibold flex items-center gap-4 hover:bg-muted/50 transition-all shadow-sm"
          data-testid="my-games"
        >
          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
            <Gamepad2 size={24} className="text-green-600 dark:text-green-400" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold">{t('myGames')}</div>
            <div className="text-xs text-muted-foreground">{t('myGamesDesc')}</div>
          </div>
        </button>
      </div>

      {/* Secondary actions */}
      <div className={cn('grid gap-2', isSuperUser ? 'grid-cols-4' : 'grid-cols-3')}>
        <button
          onClick={() => onNavigate('leaderboard')}
          className="p-3 rounded-xl bg-card border border-border/50 hover:bg-muted/50 transition-all text-center shadow-sm"
          data-testid="leaderboard"
        >
          <Trophy size={22} className="mx-auto mb-1.5 text-yellow-500" />
          <div className="text-xs font-medium">{t('ranking')}</div>
        </button>
        <button
          onClick={() => onNavigate('rules')}
          className="p-3 rounded-xl bg-card border border-border/50 hover:bg-muted/50 transition-all text-center shadow-sm"
          data-testid="rules"
        >
          <BookOpen size={22} className="mx-auto mb-1.5 text-emerald-500" />
          <div className="text-xs font-medium">{t('rules')}</div>
        </button>
        <button
          onClick={() => onNavigate('about')}
          className="p-3 rounded-xl bg-card border border-border/50 hover:bg-muted/50 transition-all text-center shadow-sm"
          data-testid="about"
        >
          <Info size={22} className="mx-auto mb-1.5 text-violet-500" />
          <div className="text-xs font-medium">{t('about')}</div>
        </button>
        {isSuperUser && (
          <button
            onClick={() => onNavigate('admin')}
            className="p-3 rounded-xl bg-card border border-red-500/30 hover:bg-red-500/10 transition-all text-center shadow-sm"
            data-testid="admin"
          >
            <Shield size={22} className="mx-auto mb-1.5 text-red-500" />
            <div className="text-xs font-medium">{t('adminMenu')}</div>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm max-w-md mx-auto">{error}</div>
      )}
    </div>
  );
}
