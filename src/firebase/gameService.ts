import { db } from './config';
import {
  ref, set, get, update, onValue, off, push, remove, DataSnapshot
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

// --- Catch up expired turns ---
// When nobody has the game open, turns expire silently.
// This function replays all missed auto-passes (and AI moves) retroactively.
// Called whenever any client loads a game state that has expired turns.

export async function catchUpExpiredTurns(roomCode: string, state: GameState): Promise<GameState> {
  if (state.phase !== 'playing' || !state.turnTimeLimitMs || !state.turnStartedAt) {
    return state;
  }

  const now = Date.now();
  let current = state;
  // Allow enough iterations: up to 120 catch-up cycles (e.g. 60 min / 30s timer = 120)
  let safetyLimit = 120;

  while (
    current.phase === 'playing' &&
    current.turnTimeLimitMs &&
    current.turnStartedAt &&
    safetyLimit > 0
  ) {
    const elapsed = now - current.turnStartedAt;
    if (elapsed <= current.turnTimeLimitMs) break; // current turn still has time

    // Deadline = when this turn should have ended
    const deadline = current.turnStartedAt + current.turnTimeLimitMs;

    const currentPlayer = current.players[current.currentPlayerIndex];
    if (!currentPlayer) break;

    if (currentPlayer.isAI) {
      // AI players don't time out — they play instantly during catch-up.
      // Execute a real AI turn.
      try {
        // Save current state to Firebase so AI turn can read it
        await set(ref(db, `rooms/${roomCode}`), stripUndefined(current));
        current = await executeAITurn(roomCode);
        // Override turnStartedAt to the deadline so catch-up chain continues
        // (executeAITurn sets turnStartedAt = Date.now(), which would break the loop)
        if (current.phase === 'playing') {
          current.turnStartedAt = deadline;
        }
      } catch (e) {
        console.error('[catchUp] AI turn error:', e);
        break;
      }
    } else {
      // Human player timed out — execute a pass.
      const passState = passTurn(current, currentPlayer.id);
      // Override turnStartedAt to the deadline (not Date.now()) so the chain continues correctly
      if (passState.phase === 'playing') {
        passState.turnStartedAt = deadline;
      }
      // Track auto-pass count for this player
      const counts = { ...(passState.autoPassCounts || {}) };
      counts[currentPlayer.id] = (counts[currentPlayer.id] || 0) + 1;
      passState.autoPassCounts = counts;
      current = passState;
    }

    safetyLimit--;
  }

  // After catching up, set turnStartedAt to real time so the next turn timer works normally
  if (current !== state && current.phase === 'playing') {
    current.turnStartedAt = Date.now();
  }

  // Save final state to Firebase
  if (current !== state) {
    console.log('[catchUp] Replayed expired turns for room:', roomCode,
      '| phase:', current.phase, '| currentPlayer:', current.players[current.currentPlayerIndex]?.nickname);
    await set(ref(db, `rooms/${roomCode}`), stripUndefined(current));
  }

  return current;
}

// Execute all pending AI turns for a game (bots play immediately, no waiting)
export async function executePendingAITurns(roomCode: string, state: GameState): Promise<GameState> {
  if (state.phase !== 'playing') return state;

  let current = state;
  let safety = state.players.filter(p => p.isAI).length + 1;

  while (current.phase === 'playing' && safety > 0) {
    const cp = current.players[current.currentPlayerIndex];
    if (!cp?.isAI) break;
    try {
      await set(ref(db, `rooms/${roomCode}`), stripUndefined(current));
      current = await executeAITurn(roomCode);
    } catch (e) {
      console.error('[pendingAI] error:', e);
      break;
    }
    safety--;
  }

  if (current !== state) {
    await set(ref(db, `rooms/${roomCode}`), stripUndefined(current));
  }

  return current;
}

// --- Firebase Data Sanitization ---
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

function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// --- Room Management ---

const DEFAULT_TURN_TIME_MS = 24 * 60 * 60 * 1000; // 24h

export async function createRoom(
  hostNickname: string,
  maxPlayers: number,
  uid: string,
  turnTimeLimitMs?: number
): Promise<{ roomCode: string; playerId: string; gameState: GameState }> {
  const roomCode = generateRoomCode();
  // Use uid as playerId for consistent identification across devices
  const playerId = uid;
  const gameState = createGameState(roomCode, playerId, hostNickname, maxPlayers);
  gameState.turnTimeLimitMs = turnTimeLimitMs || DEFAULT_TURN_TIME_MS;

  await set(ref(db, `rooms/${roomCode}`), stripUndefined(gameState));
  return { roomCode, playerId, gameState };
}

export async function joinRoom(
  roomCode: string,
  nickname: string,
  uid: string
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

  // Check if user already in room (by uid)
  if (gameState.players.some(p => p.id === uid)) {
    throw new Error('Już jesteś w tym pokoju');
  }

  // Use uid as playerId
  const playerId = uid;
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
  if (gameState.players.length < gameState.maxPlayers) {
    throw new Error(`Czekamy na graczy (${gameState.players.length}/${gameState.maxPlayers})`);
  }
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

  if (updatedState.phase === 'finished') {
    console.log('[placeTiles] Game finished, saving history & leaderboard for room:', roomCode);
    try {
      await saveGameHistory(updatedState);
      console.log('[placeTiles] saveGameHistory OK');
    } catch (e) {
      console.error('[placeTiles] saveGameHistory FAILED:', e);
    }
    try {
      await updateLeaderboard(updatedState);
      console.log('[placeTiles] updateLeaderboard OK');
    } catch (e) {
      console.error('[placeTiles] updateLeaderboard FAILED:', e);
    }
    // Mark all human player sessions as finished (using uid = playerId)
    for (const p of updatedState.players) {
      if (!p.isAI) {
        await markSessionFinished(p.id, roomCode, updatedState).catch(() => {});
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
  // Manual pass = player is active → reset their auto-pass counter
  if (updatedState.autoPassCounts?.[playerId]) {
    const counts = { ...updatedState.autoPassCounts };
    delete counts[playerId];
    updatedState.autoPassCounts = counts;
  }

  await set(ref(db, `rooms/${roomCode}`), stripUndefined(updatedState));

  if (updatedState.phase === 'finished') {
    console.log('[passPlayerTurn] Game finished, saving history & leaderboard for room:', roomCode);
    try {
      await saveGameHistory(updatedState);
      console.log('[passPlayerTurn] saveGameHistory OK');
    } catch (e) {
      console.error('[passPlayerTurn] saveGameHistory FAILED:', e);
    }
    try {
      await updateLeaderboard(updatedState);
      console.log('[passPlayerTurn] updateLeaderboard OK');
    } catch (e) {
      console.error('[passPlayerTurn] updateLeaderboard FAILED:', e);
    }
    for (const p of updatedState.players) {
      if (!p.isAI) {
        await markSessionFinished(p.id, roomCode, updatedState).catch(() => {});
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

  const swapResult = shouldAISwap(gameState.board || {}, currentPlayer.hand, aiLevel, (gameState.bag || []).length);
  if (swapResult) {
    return swapPlayerTiles(roomCode, currentPlayer.id, swapResult);
  }

  const aiMove = getAIMove(gameState.board || {}, currentPlayer.hand, aiLevel, (gameState.bag || []).length);

  if (!aiMove) {
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

    // Use player.id (uid) as key for leaderboard
    const playerRef = ref(db, `leaderboard/${player.id}`);
    const snapshot = await get(playerRef);

    const isWinner = gameState.winner === player.nickname;
    const hadQwirkle = gameState.moves.some(m =>
      m.playerId === player.id && m.score >= 12
    );

    if (snapshot.exists()) {
      const existing = snapshot.val() as LeaderboardEntry;
      await update(playerRef, {
        nickname: player.nickname, // Update nickname in case it changed
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



// --- Player Sessions (multi-game support, keyed by uid) ---

export interface PlayerSession {
  roomCode: string;
  playerId: string;
  gameName: string;
  joinedAt: number;
  status: 'active' | 'finished';
  finishedAt?: number;
  gameStartedAt?: number; // timestamp of first move
  finalBoard?: Record<string, Tile>;
  finalPlayers?: { nickname: string; score: number; isAI?: boolean }[];
  winner?: string;
  hostId?: string; // uid of the game creator
  // Deletion metadata
  deletedAt?: number;
  deletedBy?: string; // nickname of the user who deleted
}

function generateGameName(players: { nickname: string; isAI?: boolean; aiLevel?: string }[]): string {
  const names = players.map(p => p.nickname);
  if (names.length === 2) return `${names[0]} vs ${names[1]}`;
  return names.join(', ');
}

export async function savePlayerSession(
  uid: string,
  roomCode: string,
  playerId: string,
  players: { nickname: string; isAI?: boolean; aiLevel?: string }[],
  hostId?: string
): Promise<void> {
  const session: PlayerSession = {
    roomCode,
    playerId,
    gameName: generateGameName(players),
    joinedAt: Date.now(),
    status: 'active',
    hostId,
  };
  await set(ref(db, `playerSessions/${uid}/${roomCode}`), stripUndefined(session));
}

export async function updateSessionGameName(
  uid: string,
  roomCode: string,
  players: { nickname: string; isAI?: boolean; aiLevel?: string }[]
): Promise<void> {
  const gameName = generateGameName(players);
  await update(ref(db, `playerSessions/${uid}/${roomCode}`), { gameName });
}

export async function markSessionFinished(
  uid: string,
  roomCode: string,
  gameState: GameState
): Promise<void> {
  await update(ref(db, `playerSessions/${uid}/${roomCode}`), stripUndefined({
    status: 'finished',
    finishedAt: Date.now(),
    gameStartedAt: gameState.moves?.[0]?.timestamp || gameState.createdAt,
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
  uid: string,
  roomCode: string
): Promise<void> {
  await remove(ref(db, `playerSessions/${uid}/${roomCode}`));
}

export async function getPlayerSessions(
  uid: string
): Promise<PlayerSession[]> {
  const snapshot = await get(ref(db, `playerSessions/${uid}`));
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  return Object.values(data) as PlayerSession[];
}

export interface PlayerGames {
  active: { session: PlayerSession; gameState: GameState }[];
  finished: PlayerSession[];
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function getGamesForPlayer(
  uid: string
): Promise<PlayerGames> {
  const sessions = await getPlayerSessions(uid);
  const active: { session: PlayerSession; gameState: GameState }[] = [];
  const finished: PlayerSession[] = [];
  const now = Date.now();

  for (const session of sessions) {
    // Auto-remove sessions deleted more than 7 days ago
    if (session.deletedAt && now - session.deletedAt > SEVEN_DAYS_MS) {
      await removePlayerSession(uid, session.roomCode).catch(() => {});
      continue;
    }

    // Deleted sessions go to finished list (shown greyed out)
    if (session.deletedAt) {
      finished.push(session);
      continue;
    }

    if (session.status === 'finished') {
      finished.push(session);
      continue;
    }

    const snapshot = await get(ref(db, `rooms/${session.roomCode}`));
    if (snapshot.exists()) {
      let state = sanitizeGameState(snapshot.val() as GameState);

      // Catch up any expired turns (auto-pass chain)
      state = await catchUpExpiredTurns(session.roomCode, state);
      // Execute any pending AI turns (bots play immediately)
      state = await executePendingAITurns(session.roomCode, state);

      if (state.phase === 'finished') {
        await markSessionFinished(uid, session.roomCode, state);
        // Also ensure history & leaderboard are saved (idempotent)
        await ensureGameFinalized(state, uid);
        finished.push({
          ...session,
          status: 'finished',
          finishedAt: Date.now(),
          gameStartedAt: state.moves?.[0]?.timestamp || state.createdAt,
          finalBoard: state.board,
          finalPlayers: state.players.map(p => ({ nickname: p.nickname, score: p.score, isAI: p.isAI })),
          winner: state.winner || '',
        });
      } else {
        active.push({ session, gameState: state });
      }
    } else {
      await removePlayerSession(uid, session.roomCode);
    }
  }

  finished.sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));

  return { active, finished };
}

// --- Ensure game is properly finalized (idempotent fallback) ---

export async function ensureGameFinalized(
  gameState: GameState,
  currentUid: string
): Promise<void> {
  if (gameState.phase !== 'finished') return;

  console.log('[ensureGameFinalized] Starting for room:', gameState.roomCode);

  try {
    // 1. Check if gameHistory already has this game (by roomCode)
    const historySnapshot = await get(ref(db, 'gameHistory'));
    let alreadyInHistory = false;
    if (historySnapshot.exists()) {
      const data = historySnapshot.val() as Record<string, any>;
      alreadyInHistory = Object.values(data).some(
        (entry: any) => entry.roomCode === gameState.roomCode
      );
    }
    console.log('[ensureGameFinalized] alreadyInHistory:', alreadyInHistory);

    if (!alreadyInHistory) {
      try {
        await saveGameHistory(gameState);
        console.log('[ensureGameFinalized] saveGameHistory OK');
      } catch (e) {
        console.error('[ensureGameFinalized] saveGameHistory FAILED:', e);
      }

      try {
        await updateLeaderboard(gameState);
        console.log('[ensureGameFinalized] updateLeaderboard OK');
      } catch (e) {
        console.error('[ensureGameFinalized] updateLeaderboard FAILED:', e);
      }
    }

    // 3. Mark sessions finished for all human players
    for (const p of gameState.players) {
      if (!p.isAI) {
        await markSessionFinished(p.id, gameState.roomCode, gameState).catch(() => {});
      }
    }
    console.log('[ensureGameFinalized] Done');
  } catch (e) {
    console.error('[ensureGameFinalized] error:', e);
  }
}

// --- Room cleanup ---

export async function deleteRoom(roomCode: string): Promise<void> {
  await remove(ref(db, `rooms/${roomCode}`));
}

export async function checkRoomExists(roomCode: string): Promise<boolean> {
  const snapshot = await get(ref(db, `rooms/${roomCode}`));
  return snapshot.exists();
}

// --- Delete game (by host) ---
// For bot games: permanent delete (remove from history + all sessions immediately)
// For human-only games: soft-delete (mark as deleted, auto-cleanup after 7 days)

export async function deleteGame(
  roomCode: string,
  deletedByNickname: string,
  permanent: boolean = false
): Promise<void> {
  const now = Date.now();

  // 1. Remove the room itself
  await remove(ref(db, `rooms/${roomCode}`)).catch(() => {});

  // 2. Handle gameHistory entries
  const historySnapshot = await get(ref(db, 'gameHistory'));
  if (historySnapshot.exists()) {
    const data = historySnapshot.val() as Record<string, any>;
    for (const [key, entry] of Object.entries(data)) {
      if (entry.roomCode === roomCode) {
        if (permanent) {
          await remove(ref(db, `gameHistory/${key}`)).catch(() => {});
        } else {
          await update(ref(db, `gameHistory/${key}`), {
            deletedAt: now,
            deletedBy: deletedByNickname,
          });
        }
      }
    }
  }

  // 3. Handle all player sessions that reference this room
  const sessionsSnapshot = await get(ref(db, 'playerSessions'));
  if (sessionsSnapshot.exists()) {
    const allSessions = sessionsSnapshot.val() as Record<string, Record<string, any>>;
    for (const [uid, rooms] of Object.entries(allSessions)) {
      if (rooms[roomCode]) {
        if (permanent) {
          await remove(ref(db, `playerSessions/${uid}/${roomCode}`)).catch(() => {});
        } else {
          await update(ref(db, `playerSessions/${uid}/${roomCode}`), {
            status: 'finished',
            deletedAt: now,
            deletedBy: deletedByNickname,
          });
        }
      }
    }
  }
}

// --- Admin functions ---

export const SUPERUSER_EMAIL = 'emil.wawrzycki@ewakon.pl';

/** Clear entire leaderboard */
export async function adminClearLeaderboard(): Promise<void> {
  await remove(ref(db, 'leaderboard'));
}

/** Permanently delete all finished games (gameHistory + finished playerSessions) */
export async function adminDeleteAllFinishedGames(): Promise<{ deletedHistory: number; deletedSessions: number }> {
  let deletedHistory = 0;
  let deletedSessions = 0;

  // 1. Remove all gameHistory entries
  const histSnap = await get(ref(db, 'gameHistory'));
  if (histSnap.exists()) {
    deletedHistory = Object.keys(histSnap.val()).length;
    await remove(ref(db, 'gameHistory'));
  }

  // 2. Remove all finished playerSessions
  const sessionsSnap = await get(ref(db, 'playerSessions'));
  if (sessionsSnap.exists()) {
    const allSessions = sessionsSnap.val() as Record<string, Record<string, { status: string }>>;
    for (const [uid, rooms] of Object.entries(allSessions)) {
      for (const [roomCode, session] of Object.entries(rooms)) {
        if (session.status === 'finished') {
          await remove(ref(db, `playerSessions/${uid}/${roomCode}`));
          deletedSessions++;
        }
      }
    }
  }

  return { deletedHistory, deletedSessions };
}

/** Get all registered players (unique profiles) */
export interface AdminPlayerInfo {
  uid: string;
  nickname: string;
  email: string | null;
  photoURL: string | null;
  banned: boolean;
  createdAt: number;
}

export async function adminGetAllPlayers(): Promise<AdminPlayerInfo[]> {
  const profilesSnap = await get(ref(db, 'profiles'));
  if (!profilesSnap.exists()) return [];

  const profiles = profilesSnap.val() as Record<string, {
    uid: string; nickname: string; email: string | null;
    photoURL: string | null; banned?: boolean; createdAt: number;
  }>;

  return Object.entries(profiles).map(([uid, p]) => ({
    uid,
    nickname: p.nickname,
    email: p.email || null,
    photoURL: p.photoURL || null,
    banned: p.banned === true,
    createdAt: p.createdAt || 0,
  }));
}

/** Admin: update a player's nickname (profile + leaderboard + active rooms + sessions + history) */
export async function adminUpdatePlayerNick(uid: string, newNickname: string): Promise<void> {
  // Reuse the existing updateNickname from authService — import it here would create circular dep.
  // So we do it inline:
  const trimmed = newNickname.trim();
  if (!trimmed || trimmed.length > 16) {
    throw new Error('Nick musi mieć 1-16 znaków');
  }

  // Get old nickname
  const profileSnap = await get(ref(db, `profiles/${uid}`));
  if (!profileSnap.exists()) throw new Error('Profile not found');
  const oldNick = (profileSnap.val() as { nickname: string }).nickname;
  if (oldNick === trimmed) return;

  // 1. Profile
  await update(ref(db, `profiles/${uid}`), { nickname: trimmed });

  // 2. Leaderboard
  const lbSnap = await get(ref(db, `leaderboard/${uid}`));
  if (lbSnap.exists()) {
    await update(ref(db, `leaderboard/${uid}`), { nickname: trimmed });
  }

  // 3. Active rooms
  const roomsSnap = await get(ref(db, 'rooms'));
  if (roomsSnap.exists()) {
    const rooms = roomsSnap.val() as Record<string, { players: Player[] }>;
    for (const [roomCode, room] of Object.entries(rooms)) {
      const players = room.players || [];
      let updated = false;
      for (let i = 0; i < players.length; i++) {
        if (players[i].id === uid) {
          players[i].nickname = trimmed;
          updated = true;
        }
      }
      if (updated) {
        await update(ref(db, `rooms/${roomCode}`), { players });
      }
    }
  }

  // 4. All playerSessions
  const allSessionsSnap = await get(ref(db, 'playerSessions'));
  if (allSessionsSnap.exists()) {
    const allSessions = allSessionsSnap.val() as Record<string, Record<string, {
      gameName?: string;
      finalPlayers?: { nickname: string; score: number; isAI?: boolean }[];
      winner?: string;
    }>>;
    for (const [sessionUid, rooms] of Object.entries(allSessions)) {
      for (const [roomCode, session] of Object.entries(rooms)) {
        const updates: Record<string, unknown> = {};
        if (session.gameName?.includes(oldNick)) {
          updates.gameName = session.gameName.split(oldNick).join(trimmed);
        }
        if (session.finalPlayers?.some(p => p.nickname === oldNick && !p.isAI)) {
          updates.finalPlayers = session.finalPlayers.map(p =>
            p.nickname === oldNick && !p.isAI ? { ...p, nickname: trimmed } : p
          );
        }
        if (session.winner === oldNick) updates.winner = trimmed;
        if (Object.keys(updates).length > 0) {
          await update(ref(db, `playerSessions/${sessionUid}/${roomCode}`), updates);
        }
      }
    }
  }

  // 5. gameHistory
  const histSnap = await get(ref(db, 'gameHistory'));
  if (histSnap.exists()) {
    const history = histSnap.val() as Record<string, {
      players: { nickname: string; score: number; isAI?: boolean }[];
      winner: string;
    }>;
    for (const [key, entry] of Object.entries(history)) {
      if (!entry.players.some(p => p.nickname === oldNick && !p.isAI)) continue;
      const updates: Record<string, unknown> = {
        players: entry.players.map(p =>
          p.nickname === oldNick && !p.isAI ? { ...p, nickname: trimmed } : p
        ),
      };
      if (entry.winner === oldNick) updates.winner = trimmed;
      await update(ref(db, `gameHistory/${key}`), updates);
    }
  }
}

/** Ban a user: mark profile as banned, remove all their games and data */
export async function adminBanUser(uid: string): Promise<void> {
  // 1. Mark profile as banned
  await update(ref(db, `profiles/${uid}`), { banned: true });

  // 2. Remove from leaderboard
  await remove(ref(db, `leaderboard/${uid}`)).catch(() => {});

  // 3. Remove all their playerSessions
  await remove(ref(db, `playerSessions/${uid}`)).catch(() => {});

  // 4. Remove rooms they're in (or remove them from rooms)
  const roomsSnap = await get(ref(db, 'rooms'));
  if (roomsSnap.exists()) {
    const rooms = roomsSnap.val() as Record<string, GameState>;
    for (const [roomCode, room] of Object.entries(rooms)) {
      const isInRoom = (room.players || []).some((p: Player) => p.id === uid);
      if (isInRoom) {
        // If this user is the only human, delete the entire room
        const humanPlayers = (room.players || []).filter((p: Player) => !p.isAI && p.id !== uid);
        if (humanPlayers.length === 0) {
          await remove(ref(db, `rooms/${roomCode}`));
          // Also remove other players' sessions for this room
          const sessSnap = await get(ref(db, 'playerSessions'));
          if (sessSnap.exists()) {
            const allSess = sessSnap.val() as Record<string, Record<string, unknown>>;
            for (const [sUid, sRooms] of Object.entries(allSess)) {
              if (sRooms[roomCode]) {
                await remove(ref(db, `playerSessions/${sUid}/${roomCode}`)).catch(() => {});
              }
            }
          }
        } else {
          // Remove this player from the room
          const updatedPlayers = (room.players || []).filter((p: Player) => p.id !== uid);
          await update(ref(db, `rooms/${roomCode}`), { players: updatedPlayers });
        }
      }
    }
  }

  // 5. Remove their entries from gameHistory (games with only this human)
  // Note: we keep multi-player game history intact, just remove solo bot games
  const histSnap = await get(ref(db, 'gameHistory'));
  if (histSnap.exists()) {
    const history = histSnap.val() as Record<string, {
      players: { nickname: string; isAI?: boolean }[];
    }>;
    for (const [key, entry] of Object.entries(history)) {
      const humanPlayers = entry.players.filter(p => !p.isAI);
      if (humanPlayers.length <= 1) {
        // Solo game with bots — delete
        await remove(ref(db, `gameHistory/${key}`));
      }
    }
  }
}

/** Unban a user */
export async function adminUnbanUser(uid: string): Promise<void> {
  await update(ref(db, `profiles/${uid}`), { banned: false });
}

/** Check if a user is banned (used by AuthGate) */
export async function isUserBanned(uid: string): Promise<boolean> {
  const snap = await get(ref(db, `profiles/${uid}/banned`));
  return snap.exists() && snap.val() === true;
}
