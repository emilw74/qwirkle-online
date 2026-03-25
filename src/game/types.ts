// Qwirkle Game Types

export type TileColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';
export type TileShape = 'circle' | 'diamond' | 'square' | 'star' | 'clover' | 'cross';

export interface Tile {
  color: TileColor;
  shape: TileShape;
  id: string;
}

export interface Position {
  row: number;
  col: number;
}

export interface PlacedTile extends Tile {
  position: Position;
}

export interface BoardCell {
  tile: Tile | null;
}

export type Board = Map<string, Tile>; // key = "row,col"

export interface Player {
  id: string;
  nickname: string;
  hand: Tile[];
  score: number;
  isAI?: boolean;
  aiLevel?: AILevel;
  connected?: boolean;
}

export type AILevel = 'easy' | 'medium' | 'hard';

export type GamePhase = 'waiting' | 'playing' | 'finished';

export interface GameMove {
  playerId: string;
  tiles: PlacedTile[];
  score: number;
  isSwap: boolean;
  isPass?: boolean;
  isAutoPass?: boolean; // true = pass due to time expiry
  timestamp: number;
}

export interface GameState {
  id: string;
  board: Record<string, Tile>; // serialized board
  bag: Tile[];
  players: Player[];
  currentPlayerIndex: number;
  phase: GamePhase;
  moves: GameMove[];
  consecutivePasses: number;
  createdAt: number;
  roomCode: string;
  hostId: string;
  maxPlayers: number;
  winner: string | null;
  // Turn timer
  turnTimeLimitMs?: number; // max time per turn in milliseconds (default: 24h)
  turnStartedAt?: number;  // timestamp when current turn started
  // Auto-pass tracking: playerId → count of consecutive auto-passes since last real move
  autoPassCounts?: Record<string, number>;
}

export interface LeaderboardEntry {
  nickname: string;
  score: number;
  gamesPlayed: number;
  gamesWon: number;
  highestScore: number;
  averageScore: number;
  totalQwirkles: number;
}

export interface GameHistoryEntry {
  gameId: string;
  roomCode: string;
  players: { nickname: string; score: number; isAI?: boolean }[];
  winner: string;
  date: number;
  totalMoves: number;
  hadQwirkle: boolean;
  // Deletion metadata
  deletedAt?: number;
  deletedBy?: string; // nickname of the user who deleted
}

/**
 * Get the last move label for a given player from the moves array.
 * Returns: "+N" for scoring move, "p" for manual pass, "c" for auto-pass (clock),
 * "w" for swap, or "" if no moves yet.
 */
export function getLastMoveLabel(moves: GameMove[], playerId: string): string {
  for (let i = moves.length - 1; i >= 0; i--) {
    const m = moves[i];
    if (m.playerId !== playerId) continue;
    if (m.isAutoPass) return 'c';
    if (m.isPass) return 'p';
    if (m.isSwap) return 'w';
    if (m.score > 0) return `+${m.score}`;
    return '';
  }
  return '';
}

export const TILE_COLORS: TileColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
export const TILE_SHAPES: TileShape[] = ['circle', 'diamond', 'square', 'star', 'clover', 'cross'];
export const TILES_PER_COMBINATION = 3; // 3 copies of each color-shape combo
export const HAND_SIZE = 6;
export const QWIRKLE_BONUS = 6;
