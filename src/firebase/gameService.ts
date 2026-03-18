import { db } from './config';
import {
  ref, set, get, update, onValue, off, push, remove,
  query, orderByChild, limitToLast, equalTo, DataSnapshot
} from 'firebase/database';
import {
  GameState, Player, Tile, PlacedTile, GameMove,
  LeaderboardEntry, GameHistoryEntry
} from '../game/types';
import {
  createGameState, addPlayerToGame, addAIPlayer, startGame,
  applyMove, swapTiles, passTurn, generateRoomCode, boardFromRecord
} from '../game/engine';
import { getAIMove, shouldAISwap } from '../game/ai';

// --- Room Management ---

export async function createRoom(
  hostNickname: string,
  maxPlayers: number
): Promise<{ roomCode: string; playerId: string; gameState: GameState }> {
  const roomCode = generateRoomCode();
  const playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const gameState = createGameState(roomCode, playerId, hostNickname, maxPlayers);

  await set(ref(db, `rooms/${roomCode}`), gameState);
  return { roomCode, playerId, gameState };
}

export async function joinRoom(
  roomCode: string,
  nickname: string
): Promise<{ playerId: string; gameState: GameState }> {
  const snapshot = await get(ref(db, `rooms/${roomCode}`));
  if (!snapshot.exists()) throw new Error('Pokój nie istnieje');

  const gameState = snapshot.val() as GameState;
  if (gameState.phase !== 'waiting') throw new Error('Gra już trwa');
  if (gameState.players.length >= gameState.maxPlayers) throw new Error('Pokój jest pełny');

  // Check for duplicate nickname
  if (gameState.players.some(p => p.nickname === nickname)) {
    throw new Error('Ten nick jest już zajęty w tym pokoju');
  }

  const playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const updatedState = addPlayerToGame(gameState, playerId, nickname);

  await set(ref(db, `rooms/${roomCode}`), updatedState);
  return { playerId, gameState: updatedState };
}

export async function addAIToRoom(
  roomCode: string,
  level: 'easy' | 'medium' | 'hard'
): Promise<GameState> {
  const snapshot = await get(ref(db, `rooms/${roomCode}`));
  if (!snapshot.exists()) throw new Error('Pokój nie istnieje');

  const gameState = snapshot.val() as GameState;
  const updatedState = addAIPlayer(gameState, level);

  await set(ref(db, `rooms/${roomCode}`), updatedState);
  return updatedState;
}

export async function startGameInRoom(roomCode: string): Promise<GameState> {
  const snapshot = await get(ref(db, `rooms/${roomCode}`));
  if (!snapshot.exists()) throw new Error('Pokój nie istnieje');

  const gameState = snapshot.val() as GameState;
  const updatedState = startGame(gameState);

  await set(ref(db, `rooms/${roomCode}`), updatedState);
  return updatedState;
}

// --- Game Actions ---

export async function placeTiles(
  roomCode: string,
  playerId: string,
  placedTiles: PlacedTile[]
): Promise<GameState> {
  const snapshot = await get(ref(db, `rooms/${roomCode}`));
  if (!snapshot.exists()) throw new Error('Pokój nie istnieje');

  const gameState = snapshot.val() as GameState;
  // Restore hand arrays properly (Firebase may convert empty arrays to undefined)
  gameState.players = gameState.players.map(p => ({
    ...p,
    hand: p.hand || [],
  }));
  gameState.bag = gameState.bag || [];
  gameState.moves = gameState.moves || [];

  const updatedState = applyMove(gameState, placedTiles, playerId);

  await set(ref(db, `rooms/${roomCode}`), updatedState);

  // Save to history if game finished
  if (updatedState.phase === 'finished') {
    await saveGameHistory(updatedState);
    await updateLeaderboard(updatedState);
  }

  return updatedState;
}

export async function swapPlayerTiles(
  roomCode: string,
  playerId: string,
  tiles: Tile[]
): Promise<GameState> {
  const snapshot = await get(ref(db, `rooms/${roomCode}`));
  if (!snapshot.exists()) throw new Error('Pokój nie istnieje');

  const gameState = snapshot.val() as GameState;
  gameState.players = gameState.players.map(p => ({ ...p, hand: p.hand || [] }));
  gameState.bag = gameState.bag || [];
  gameState.moves = gameState.moves || [];

  const updatedState = swapTiles(gameState, tiles, playerId);

  await set(ref(db, `rooms/${roomCode}`), updatedState);
  return updatedState;
}

export async function passPlayerTurn(
  roomCode: string,
  playerId: string
): Promise<GameState> {
  const snapshot = await get(ref(db, `rooms/${roomCode}`));
  if (!snapshot.exists()) throw new Error('Pokój nie istnieje');

  const gameState = snapshot.val() as GameState;
  gameState.players = gameState.players.map(p => ({ ...p, hand: p.hand || [] }));
  gameState.bag = gameState.bag || [];
  gameState.moves = gameState.moves || [];

  const updatedState = passTurn(gameState, playerId);

  await set(ref(db, `rooms/${roomCode}`), updatedState);

  if (updatedState.phase === 'finished') {
    await saveGameHistory(updatedState);
    await updateLeaderboard(updatedState);
  }

  return updatedState;
}

// --- AI Turn ---

export async function executeAITurn(roomCode: string): Promise<GameState> {
  const snapshot = await get(ref(db, `rooms/${roomCode}`));
  if (!snapshot.exists()) throw new Error('Pokój nie istnieje');

  const gameState = snapshot.val() as GameState;
  gameState.players = gameState.players.map(p => ({ ...p, hand: p.hand || [] }));
  gameState.bag = gameState.bag || [];
  gameState.moves = gameState.moves || [];

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (!currentPlayer?.isAI) throw new Error('Nie tura AI');

  const aiLevel = currentPlayer.aiLevel || 'medium';

  // Check if AI should swap
  const swapResult = shouldAISwap(gameState.board || {}, currentPlayer.hand, aiLevel, (gameState.bag || []).length);
  if (swapResult) {
    return swapPlayerTiles(roomCode, currentPlayer.id, swapResult);
  }

  // Get AI move
  const aiMove = getAIMove(gameState.board || {}, currentPlayer.hand, aiLevel, (gameState.bag || []).length);

  if (!aiMove) {
    // AI passes
    return passPlayerTurn(roomCode, currentPlayer.id);
  }

  return placeTiles(roomCode, currentPlayer.id, aiMove.tiles);
}

// --- Real-time Listeners ---

export function subscribeToRoom(
  roomCode: string,
  callback: (state: GameState | null) => void
): () => void {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const handler = (snapshot: DataSnapshot) => {
    if (snapshot.exists()) {
      const state = snapshot.val() as GameState;
      state.players = (state.players || []).map(p => ({ ...p, hand: p.hand || [] }));
      state.bag = state.bag || [];
      state.moves = state.moves || [];
      callback(state);
    } else {
      callback(null);
    }
  };
  onValue(roomRef, handler);
  return () => off(roomRef, 'value', handler);
}

// --- Leaderboard ---

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const snapshot = await get(ref(db, 'leaderboard'));
  if (!snapshot.exists()) return [];

  const data = snapshot.val();
  const entries: LeaderboardEntry[] = Object.values(data);
  entries.sort((a, b) => b.highestScore - a.highestScore);
  return entries;
}

async function updateLeaderboard(gameState: GameState): Promise<void> {
  for (const player of gameState.players) {
    if (player.isAI) continue;

    const playerRef = ref(db, `leaderboard/${encodeNickname(player.nickname)}`);
    const snapshot = await get(playerRef);

    const isWinner = gameState.winner === player.nickname;
    const hadQwirkle = gameState.moves.some(m =>
      m.playerId === player.id && m.score >= 12
    );

    if (snapshot.exists()) {
      const existing = snapshot.val() as LeaderboardEntry;
      await update(playerRef, {
        gamesPlayed: existing.gamesPlayed + 1,
        gamesWon: existing.gamesWon + (isWinner ? 1 : 0),
        highestScore: Math.max(existing.highestScore, player.score),
        averageScore: Math.round(
          ((existing.averageScore * existing.gamesPlayed) + player.score) / (existing.gamesPlayed + 1)
        ),
        totalQwirkles: existing.totalQwirkles + (hadQwirkle ? 1 : 0),
      });
    } else {
      await set(playerRef, {
        nickname: player.nickname,
        score: player.score,
        gamesPlayed: 1,
        gamesWon: isWinner ? 1 : 0,
        highestScore: player.score,
        averageScore: player.score,
        totalQwirkles: hadQwirkle ? 1 : 0,
      });
    }
  }
}

function encodeNickname(name: string): string {
  return name.replace(/[.#$/[\]]/g, '_');
}

// --- Game History ---

async function saveGameHistory(gameState: GameState): Promise<void> {
  const entry: GameHistoryEntry = {
    gameId: gameState.id,
    roomCode: gameState.roomCode,
    players: gameState.players.map(p => ({
      nickname: p.nickname,
      score: p.score,
      isAI: p.isAI,
    })),
    winner: gameState.winner || '',
    date: Date.now(),
    totalMoves: gameState.moves.length,
    hadQwirkle: gameState.moves.some(m => m.score >= 12),
  };

  await push(ref(db, 'gameHistory'), entry);
}

export async function getGameHistory(limit: number = 50): Promise<GameHistoryEntry[]> {
  const historyQuery = query(
    ref(db, 'gameHistory'),
    orderByChild('date'),
    limitToLast(limit)
  );
  const snapshot = await get(historyQuery);
  if (!snapshot.exists()) return [];

  const data = snapshot.val();
  const entries: GameHistoryEntry[] = Object.values(data);
  entries.sort((a, b) => b.date - a.date);
  return entries;
}

// --- Room cleanup ---

export async function deleteRoom(roomCode: string): Promise<void> {
  await remove(ref(db, `rooms/${roomCode}`));
}

export async function checkRoomExists(roomCode: string): Promise<boolean> {
  const snapshot = await get(ref(db, `rooms/${roomCode}`));
  return snapshot.exists();
}
