import { useState } from 'react';
import { useGameStore } from '../hooks/useGameStore';
import { createRoom, joinRoom, addAIToRoom, startGameInRoom, subscribeToRoom } from '../firebase/gameService';
import { cn } from '../utils/cn';
import { Users, Bot, Play, Plus, LogIn, Trophy, History, Copy, Check, ArrowLeft } from 'lucide-react';
import { AILevel } from '../game/types';

interface LobbyProps {
  onNavigate: (page: 'game' | 'leaderboard' | 'history') => void;
}

export function Lobby({ onNavigate }: LobbyProps) {
  const { nickname, setNickname, setPlayerId, setRoomCode, setGameState, roomCode: storeRoomCode } = useGameStore();
  const [localNickname, setLocalNickname] = useState(nickname || '');
  const [mode, setMode] = useState<'menu' | 'create' | 'join' | 'waiting'>('menu');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [roomInfo, setRoomInfo] = useState<{ code: string; players: string[] } | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [copied, setCopied] = useState(false);
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);

  const handleCreateRoom = async () => {
    if (!localNickname.trim()) { setError('Wpisz nick'); return; }
    setIsLoading(true);
    setError('');
    try {
      const { roomCode, playerId, gameState } = await createRoom(localNickname.trim(), maxPlayers);
      setNickname(localNickname.trim());
      setPlayerId(playerId);
      setRoomCode(roomCode);
      setGameState(gameState);
      setRoomInfo({ code: roomCode, players: [localNickname.trim()] });
      setMode('waiting');

      // Subscribe to room updates
      const unsub = subscribeToRoom(roomCode, (state) => {
        if (state) {
          setGameState(state);
          setRoomInfo({
            code: roomCode,
            players: state.players.map(p => p.nickname),
          });
          if (state.phase === 'playing') {
            onNavigate('game');
          }
        }
      });
      setUnsubscribe(() => unsub);
    } catch (e: any) {
      setError(e.message || 'Błąd tworzenia pokoju');
    }
    setIsLoading(false);
  };

  const handleJoinRoom = async () => {
    if (!localNickname.trim()) { setError('Wpisz nick'); return; }
    if (joinCode.length !== 6) { setError('Kod pokoju musi mieć 6 cyfr'); return; }
    setIsLoading(true);
    setError('');
    try {
      const { playerId, gameState } = await joinRoom(joinCode, localNickname.trim());
      setNickname(localNickname.trim());
      setPlayerId(playerId);
      setRoomCode(joinCode);
      setGameState(gameState);
      setMode('waiting');
      setRoomInfo({ code: joinCode, players: gameState.players.map(p => p.nickname) });

      const unsub = subscribeToRoom(joinCode, (state) => {
        if (state) {
          setGameState(state);
          setRoomInfo({
            code: joinCode,
            players: state.players.map(p => p.nickname),
          });
          if (state.phase === 'playing') {
            onNavigate('game');
          }
        }
      });
      setUnsubscribe(() => unsub);
    } catch (e: any) {
      setError(e.message || 'Błąd dołączania');
    }
    setIsLoading(false);
  };

  const handleAddAI = async (level: AILevel) => {
    if (!roomInfo) return;
    setIsLoading(true);
    try {
      await addAIToRoom(roomInfo.code, level);
    } catch (e: any) {
      setError(e.message || 'Błąd dodawania AI');
    }
    setIsLoading(false);
  };

  const handleStartGame = async () => {
    if (!roomInfo) return;
    setIsLoading(true);
    try {
      await startGameInRoom(roomInfo.code);
    } catch (e: any) {
      setError(e.message || 'Błąd rozpoczynania gry');
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

  // --- RENDER ---

  if (mode === 'waiting' && roomInfo) {
    const gameState = useGameStore.getState().gameState;
    const isHost = gameState?.hostId === useGameStore.getState().playerId;
    const canStart = roomInfo.players.length >= 2;
    const canAddAI = roomInfo.players.length < maxPlayers;

    return (
      <div className="max-w-md mx-auto space-y-6">
        <button onClick={handleBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft size={16} /> Wróć
        </button>

        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm space-y-5">
          <div className="text-center space-y-2">
            <h2 className="font-display font-bold text-xl">Poczekalnia</h2>
            <div className="flex items-center justify-center gap-2">
              <span className="text-muted-foreground text-sm">Kod pokoju:</span>
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
              Gracze ({roomInfo.players.length}/{maxPlayers})
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

          {isHost && canAddAI && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Dodaj bota</div>
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
                    {level === 'easy' ? 'Łatwy' : level === 'medium' ? 'Średni' : 'Trudny'}
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
              {canStart ? 'Rozpocznij grę' : 'Potrzeba min. 2 graczy'}
            </button>
          )}

          {!isHost && (
            <div className="text-center text-sm text-muted-foreground animate-pulse">
              Czekam na hosta...
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
          <ArrowLeft size={16} /> Wróć
        </button>

        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm space-y-5">
          <h2 className="font-display font-bold text-xl text-center">
            {mode === 'create' ? 'Stwórz pokój' : 'Dołącz do pokoju'}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Twój nick</label>
              <input
                type="text"
                value={localNickname}
                onChange={e => setLocalNickname(e.target.value)}
                maxLength={16}
                placeholder="Wpisz nick..."
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                data-testid="nickname-input"
              />
            </div>

            {mode === 'join' && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Kod pokoju</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  placeholder="6-cyfrowy kod..."
                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm font-mono text-center text-xl tracking-[0.3em]"
                  data-testid="room-code-input"
                />
              </div>
            )}

            {mode === 'create' && (
              <div>
                <label className="block text-sm font-medium mb-1.5">Maks. graczy</label>
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
                      {n} graczy
                    </button>
                  ))}
                </div>
              </div>
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
                  {mode === 'create' ? 'Stwórz pokój' : 'Dołącz'}
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
      {/* Logo */}
      <div className="text-center space-y-3 pt-4">
        <div className="inline-flex items-center gap-1">
          {['red', 'orange', 'yellow', 'green', 'blue', 'purple'].map((color, i) => (
            <div
              key={color}
              className="w-7 h-7 rounded-md"
              style={{
                backgroundColor: {
                  red: '#e63946', orange: '#f77f00', yellow: '#fcbf49',
                  green: '#2a9d8f', blue: '#457b9d', purple: '#7b2cbf',
                }[color],
                transform: `rotate(${(i - 2.5) * 5}deg)`,
              }}
            />
          ))}
        </div>
        <h1 className="font-display font-bold text-3xl tracking-tight">Qwirkle Online</h1>
        <p className="text-muted-foreground text-sm">Graj online lub z komputerem</p>
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
            <div className="text-sm font-semibold">Stwórz pokój</div>
            <div className="text-xs opacity-80">Zaproś graczy lub dodaj AI</div>
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
            <div className="text-sm font-semibold">Dołącz do pokoju</div>
            <div className="text-xs text-muted-foreground">Wpisz 6-cyfrowy kod</div>
          </div>
        </button>
      </div>

      {/* Secondary actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate('leaderboard')}
          className="p-4 rounded-xl bg-card border border-border/50 hover:bg-muted/50 transition-all text-center shadow-sm"
          data-testid="leaderboard"
        >
          <Trophy size={24} className="mx-auto mb-2 text-yellow-500" />
          <div className="text-sm font-medium">Ranking</div>
        </button>
        <button
          onClick={() => onNavigate('history')}
          className="p-4 rounded-xl bg-card border border-border/50 hover:bg-muted/50 transition-all text-center shadow-sm"
          data-testid="game-history"
        >
          <History size={24} className="mx-auto mb-2 text-blue-500" />
          <div className="text-sm font-medium">Historia gier</div>
        </button>
      </div>
    </div>
  );
}
