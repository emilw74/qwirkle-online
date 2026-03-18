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

// --- Firebase Data Sanitization ---
// Firebase converts empty arrays/objects to null
function sanitizeGameState(state: GameState): GameState {
  return {
    ...state,
    board: state.board || {},
    bag: state.bag || [],
    moves: state.moves || [],
    winner: state.winner ?? null,
    players: (state.players || []).map(p => ({
      ...p,
      hand: p.hand || [],
    })),
  };
}

// Remove undefined values before writing to Firebase (Firebase rejects undefined)
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// --- Room Management ---

export async function createRoom(
  hostNickname: string,
  maxPlayers: number
): Promise<{ roomCode: string; playerId: string; gameState: GameState }> {
  const roomCode = generateRoomCode();
  const playerId = `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const gameState = createGameState(roomCode, playerId, hostNickname, maxPlayers);

  await set(ref(db, `rooms/${roomCode}`), stripUndefined(gameState));
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

  await set(ref(db, `rooms/${roomCode}`), stripUndefined(updatedState));
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

  await set(ref(db, `rooms/${roomCode}`), stripUndefined(updatedState));
  return updatedState;
}

export async function startGameInRoom(roomCode: string): Promise<GameState> {
  const snapshot = await get(ref(db, `rooms/${roomCode}`));
  if (!snapshot.exists()) throw new Error('Pokój nie istnieje');

  const gameState = snapshot.val() as GameState;
  const updatedState = startGame(gameState);

  await set(ref(db, `rooms/${roomCode}`), stripUndefined(updatedState));
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

  const gameState = sanitizeGameState(snapshot.val() as GameState);

  const updatedState = applyMove(gameState, placedTiles, playerId);

  await set(ref(db, `rooms/${roomCode}`), stripUndefined(updatedState));

  // Save to history if game finished
  if (updatedState.phase === 'finished') {
    await saveGameHistory(updatedState);
    await updateLeaderboard(updatedState);
    // Mark all human player sessions as finished
    for (const p of updatedState.players) {
      if (!p.isAI) {
        await markSessionFinished(p.nickname, roomCode, updatedState).catch(() => {});
      }
    }
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

  const gameState = sanitizeGameState(snapshot.val() as GameState);

  const updatedState = swapTiles(gameState, tiles, playerId);

  await set(ref(db, `rooms/${roomCode}`), stripUndefined(updatedState));
  return updatedState;
}

export async function passPlayerTurn(
  roomCode: string,
  playerId: string
): Promise<GameState> {
  const snapshot = await get(ref(db, `rooms/${roomCode}`));
  if (!snapshot.exists()) throw new Error('Pokój nie istnieje');

  const gameState = sanitizeGameState(snapshot.val() as GameState);

  const updatedState = passTurn(gameState, playerId);

  await set(ref(db, `rooms/${roomCode}`), stripUndefined(updatedState));

  if (updatedState.phase === 'finished') {
    await saveGameHistory(updatedState);
    await updateLeaderboard(updatedState);
    // Mark all human player sessions as finished
    for (const p of updatedState.players) {
      if (!p.isAI) {
        await markSessionFinished(p.nickname, roomCode, updatedState).catch(() => {});
      }
    }
  }

  return updatedState;
}

// --- AI Turn ---

export async function executeAITurn(roomCode: string): Promise<GameState> {
  const snapshot = await get(ref(db, `rooms/${roomCode}`));
  if (!snapshot.exists()) throw new Error('Pokój nie istnieje');

  const gameState = sanitizeGameState(snapshot.val() as GameState);

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
      state.board = state.board || {};
      state.winner = state.winner ?? null;
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

// --- Player Sessions (multi-game support) ---

export interface PlayerSession {
  roomCode: string;
  playerId: string;
  gameName: string;
  joinedAt: number;
  status: 'active' | 'finished';
  finishedAt?: number;
  finalBoard?: Record<string, Tile>;
  finalPlayers?: { nickname: string; score: number; isAI?: boolean }[];
  winner?: string;
}

function generateGameName(players: { nickname: string; isAI?: boolean; aiLevel?: string }[]): string {
  const names = players.map(p => {
    if (p.isAI) {
      const levelMap: Record<string, string> = { easy: '\u0141atwy', medium: '\u015aredni', hard: 'Trudny' };
      return `Bot ${levelMap[p.aiLevel || 'medium'] || '\u015aredni'}`;
    }
    return p.nickname;
  });
  if (names.length === 2) return `${names[0]} vs ${names[1]}`;
  return names.join(', ');
}

export async function savePlayerSession(
  nickname: string,
  roomCode: string,
  playerId: string,
  players: { nickname: string; isAI?: boolean; aiLevel?: string }[]
): Promise<void> {
  const encodedNick = encodeNickname(nickname);
  const session: PlayerSession = {
    roomCode,
    playerId,
    gameName: generateGameName(players),
    joinedAt: Date.now(),
    status: 'active',
  };
  await set(ref(db, `playerSessions/${encodedNick}/${roomCode}`), stripUndefined(session));
}

export async function updateSessionGameName(
  nickname: string,
  roomCode: string,
  players: { nickname: string; isAI?: boolean; aiLevel?: string }[]
): Promise<void> {
  const encodedNick = encodeNickname(nickname);
  const gameName = generateGameName(players);
  await update(ref(db, `playerSessions/${encodedNick}/${roomCode}`), { gameName });
}

export async function markSessionFinished(
  nickname: string,
  roomCode: string,
  gameState: GameState
): Promise<void> {
  const encodedNick = encodeNickname(nickname);
  await update(ref(db, `playerSessions/${encodedNick}/${roomCode}`), stripUndefined({
    status: 'finished',
    finishedAt: Date.now(),
    finalBoard: gameState.board || {},
    finalPlayers: gameState.players.map(p => ({
      nickname: p.nickname,
      score: p.score,
      isAI: p.isAI || false,
    })),
    winner: gameState.winner || '',
    gameName: generateGameName(gameState.players),
  }));
}

export async function removePlayerSession(
  nickname: string,
  roomCode: string
): Promise<void> {
  const encodedNick = encodeNickname(nickname);
  await remove(ref(db, `playerSessions/${encodedNick}/${roomCode}`));
}

export async function getPlayerSessions(
  nickname: string
): Promise<PlayerSession[]> {
  const encodedNick = encodeNickname(nickname);
  const snapshot = await get(ref(db, `playerSessions/${encodedNick}`));
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.values(data) as PlayerSession[];
}

export interface PlayerGames {
  active: { session: PlayerSession; gameState: GameState }[];
  finished: PlayerSession[];
}

export async function getGamesForPlayer(
  nickname: string
): Promise<PlayerGames> {
  const sessions = await getPlayerSessions(nickname);
  const active: { session: PlayerSession; gameState: GameState }[] = [];
  const finished: PlayerSession[] = [];

  for (const session of sessions) {
    // Already marked as finished — no need to fetch room
    if (session.status === 'finished') {
      finished.push(session);
      continue;
    }

    // Active session — verify room still exists
    const snapshot = await get(ref(db, `rooms/${session.roomCode}`));
    if (snapshot.exists()) {
      const state = sanitizeGameState(snapshot.val() as GameState);
      if (state.phase === 'finished') {
        // Game ended while player was away — mark as finished
        await markSessionFinished(nickname, session.roomCode, state);
        finished.push({
          ...session,
          status: 'finished',
          finishedAt: Date.now(),
          finalBoard: state.board,
          finalPlayers: state.players.map(p => ({ nickname: p.nickname, score: p.score, isAI: p.isAI })),
          winner: state.winner || '',
        });
      } else {
        active.push({ session, gameState: state });
      }
    } else {
      // Room deleted — clean up
      await removePlayerSession(nickname, session.roomCode);
    }
  }

  // Sort finished by date descending
  finished.sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));

  return { active, finished };
}

// --- Room cleanup ---

export async function deleteRoom(roomCode: string): Promise<void> {
  await remove(ref(db, `rooms/${roomCode}`));
}

export async function checkRoomExists(roomCode: string): Promise<boolean> {
  const snapshot = await get(ref(db, `rooms/${roomCode}`));
  return snapshot.exists();
}
