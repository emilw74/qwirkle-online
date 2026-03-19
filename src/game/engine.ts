import { v4 as uuidv4 } from 'uuid';
import {
  Tile, TileColor, TileShape, Board, PlacedTile, Position, Player, GameState,
  GameMove, TILE_COLORS, TILE_SHAPES, TILES_PER_COMBINATION, HAND_SIZE, QWIRKLE_BONUS
} from './types';

// --- Tile Bag ---

export function createBag(): Tile[] {
  const bag: Tile[] = [];
  for (const color of TILE_COLORS) {
    for (const shape of TILE_SHAPES) {
      for (let i = 0; i < TILES_PER_COMBINATION; i++) {
        bag.push({ color, shape, id: uuidv4() });
      }
    }
  }
  return shuffleArray(bag);
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function drawTiles(bag: Tile[], count: number): { drawn: Tile[]; remaining: Tile[] } {
  const drawn = bag.slice(0, count);
  const remaining = bag.slice(count);
  return { drawn, remaining };
}

// --- Board Utilities ---

export function posKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function parseKey(key: string): Position {
  const [row, col] = key.split(',').map(Number);
  return { row, col };
}

export function boardFromRecord(rec: Record<string, Tile> | null | undefined): Board {
  if (!rec) return new Map();
  return new Map(Object.entries(rec));
}

export function boardToRecord(board: Board): Record<string, Tile> {
  const rec: Record<string, Tile> = {};
  board.forEach((tile, key) => {
    rec[key] = tile;
  });
  return rec;
}

export function getNeighbors(pos: Position): Position[] {
  return [
    { row: pos.row - 1, col: pos.col },
    { row: pos.row + 1, col: pos.col },
    { row: pos.row, col: pos.col - 1 },
    { row: pos.row, col: pos.col + 1 },
  ];
}

// --- Line Detection ---

function getLine(board: Board, pos: Position, dir: 'row' | 'col'): Tile[] {
  const tiles: Tile[] = [];
  const tile = board.get(posKey(pos.row, pos.col));
  if (!tile) return tiles;
  
  // go backward
  let r = pos.row, c = pos.col;
  while (true) {
    if (dir === 'row') c--; else r--;
    const t = board.get(posKey(r, c));
    if (!t) break;
    tiles.unshift(t);
  }
  
  // add current
  tiles.push(tile);
  
  // go forward
  r = pos.row; c = pos.col;
  while (true) {
    if (dir === 'row') c++; else r++;
    const t = board.get(posKey(r, c));
    if (!t) break;
    tiles.push(t);
  }
  
  return tiles;
}

// --- Validation ---

function isValidLine(tiles: Tile[]): boolean {
  if (tiles.length <= 1) return true;
  if (tiles.length > 6) return false;
  
  // All same color, all different shapes OR all same shape, all different colors
  const allSameColor = tiles.every(t => t.color === tiles[0].color);
  const allSameShape = tiles.every(t => t.shape === tiles[0].shape);
  
  if (!allSameColor && !allSameShape) return false;
  
  if (allSameColor) {
    const shapes = new Set(tiles.map(t => t.shape));
    if (shapes.size !== tiles.length) return false;
  }
  
  if (allSameShape) {
    const colors = new Set(tiles.map(t => t.color));
    if (colors.size !== tiles.length) return false;
  }
  
  return true;
}

function tilesInSameLine(positions: Position[]): boolean {
  if (positions.length <= 1) return true;
  const allSameRow = positions.every(p => p.row === positions[0].row);
  const allSameCol = positions.every(p => p.col === positions[0].col);
  return allSameRow || allSameCol;
}

function tilesAreContiguous(board: Board, positions: Position[]): boolean {
  if (positions.length <= 1) return true;
  
  const allSameRow = positions.every(p => p.row === positions[0].row);
  
  if (allSameRow) {
    const cols = positions.map(p => p.col).sort((a, b) => a - b);
    for (let c = cols[0]; c <= cols[cols.length - 1]; c++) {
      if (!board.has(posKey(positions[0].row, c))) return false;
    }
  } else {
    const rows = positions.map(p => p.row).sort((a, b) => a - b);
    for (let r = rows[0]; r <= rows[rows.length - 1]; r++) {
      if (!board.has(posKey(r, positions[0].col))) return false;
    }
  }
  return true;
}

function tilesConnectedToBoard(board: Board, newPositions: Position[], isFirstMove: boolean): boolean {
  if (isFirstMove) return true;
  
  for (const pos of newPositions) {
    const neighbors = getNeighbors(pos);
    for (const n of neighbors) {
      const key = posKey(n.row, n.col);
      if (board.has(key) && !newPositions.some(p => p.row === n.row && p.col === n.col)) {
        return true;
      }
    }
  }
  return false;
}

export interface ValidationResult {
  valid: boolean;
  score: number;
  error?: string;
  qwirkle: boolean;
}

export function validateMove(
  board: Board,
  placedTiles: PlacedTile[],
  isFirstMove: boolean
): ValidationResult {
  if (placedTiles.length === 0) {
    return { valid: false, score: 0, error: 'Musisz postawić przynajmniej 1 kafelek', qwirkle: false };
  }
  
  const positions = placedTiles.map(t => t.position);
  
  // Check all tiles in same row or column
  if (!tilesInSameLine(positions)) {
    return { valid: false, score: 0, error: 'Kafelki muszą być w jednej linii', qwirkle: false };
  }
  
  // Check no overlap with existing board
  for (const pt of placedTiles) {
    if (board.has(posKey(pt.position.row, pt.position.col))) {
      return { valid: false, score: 0, error: 'Pole jest już zajęte', qwirkle: false };
    }
  }
  
  // First move must include center
  if (isFirstMove && !positions.some(p => p.row === 0 && p.col === 0)) {
    // Actually in Qwirkle the first tile can be anywhere - we'll use 0,0 as convention
    // but let's just allow it anywhere for the first move
  }
  
  // Temporarily place tiles on board
  const tempBoard = new Map(board);
  for (const pt of placedTiles) {
    tempBoard.set(posKey(pt.position.row, pt.position.col), {
      color: pt.color,
      shape: pt.shape,
      id: pt.id
    });
  }
  
  // Check contiguity (no gaps in the line between new tiles)
  if (!tilesAreContiguous(tempBoard, positions)) {
    return { valid: false, score: 0, error: 'Nie może być przerw między kafelkami', qwirkle: false };
  }
  
  // Check connection to existing tiles (unless first move)
  if (!tilesConnectedToBoard(tempBoard, positions, isFirstMove)) {
    return { valid: false, score: 0, error: 'Kafelki muszą być połączone z planszą', qwirkle: false };
  }
  
  // Validate all affected lines and calculate score
  let totalScore = 0;
  let hasQwirkle = false;
  const scoredLines = new Set<string>();
  
  for (const pos of positions) {
    for (const dir of ['row', 'col'] as const) {
      const line = getLine(tempBoard, pos, dir);
      if (line.length <= 1) continue;
      
      // Create a unique key for this line to avoid double-counting
      const lineKey = dir === 'row' 
        ? `r${pos.row}_${line.map((_, i) => {
            let c = pos.col;
            // find start of line
            let tc = pos.col;
            while (tempBoard.has(posKey(pos.row, tc - 1))) tc--;
            return tc + i;
          }).join(',')}`
        : `c${pos.col}_${line.map((_, i) => {
            let tr = pos.row;
            while (tempBoard.has(posKey(tr - 1, pos.col))) tr--;
            return tr + i;
          }).join(',')}`;
      
      if (scoredLines.has(lineKey)) continue;
      
      if (!isValidLine(line)) {
        return { 
          valid: false, score: 0, 
          error: `Nieprawidłowa linia: kafelki muszą mieć ten sam kolor lub kształt, bez powtórzeń`, 
          qwirkle: false 
        };
      }
      
      scoredLines.add(lineKey);
      totalScore += line.length;
      if (line.length === 6) {
        totalScore += QWIRKLE_BONUS;
        hasQwirkle = true;
      }
    }
  }
  
  // If single tile placed and only creates lines of length 1, score is 1
  if (totalScore === 0 && placedTiles.length === 1) {
    totalScore = 1;
  }
  
  return { valid: true, score: totalScore, qwirkle: hasQwirkle };
}

// Recalculate score more carefully
export function calculateScore(board: Board, placedTiles: PlacedTile[]): number {
  const positions = placedTiles.map(t => t.position);
  let totalScore = 0;
  const countedLines = new Set<string>();

  for (const pos of positions) {
    for (const dir of ['row', 'col'] as const) {
      const line = getLine(board, pos, dir);
      if (line.length <= 1) continue;

      // Build stable line key
      let startR = pos.row, startC = pos.col;
      if (dir === 'row') {
        while (board.has(posKey(startR, startC - 1))) startC--;
      } else {
        while (board.has(posKey(startR - 1, startC))) startR--;
      }
      const lineKey = `${dir}_${startR}_${startC}_${line.length}`;
      if (countedLines.has(lineKey)) continue;
      countedLines.add(lineKey);

      totalScore += line.length;
      if (line.length === 6) totalScore += QWIRKLE_BONUS;
    }
  }

  if (totalScore === 0 && placedTiles.length > 0) totalScore = placedTiles.length;
  return totalScore;
}

// --- Valid Placement Finding ---

export function getValidPlacements(board: Board, hand: Tile[]): Map<string, Tile[]> {
  // Returns map of posKey -> tiles from hand that can go there
  const validPlacements = new Map<string, Tile[]>();
  
  if (board.size === 0) {
    // First move: only position 0,0
    validPlacements.set(posKey(0, 0), [...hand]);
    return validPlacements;
  }
  
  // Find all empty cells adjacent to existing tiles
  const emptyCells = new Set<string>();
  board.forEach((_, key) => {
    const pos = parseKey(key);
    for (const n of getNeighbors(pos)) {
      const nKey = posKey(n.row, n.col);
      if (!board.has(nKey)) {
        emptyCells.add(nKey);
      }
    }
  });
  
  // For each empty cell, check which tiles from hand can be placed there
  emptyCells.forEach(cellKey => {
    const pos = parseKey(cellKey);
    const validTiles: Tile[] = [];
    
    for (const tile of hand) {
      const tempBoard = new Map(board);
      tempBoard.set(cellKey, tile);
      
      // Check all lines through this position
      let valid = true;
      for (const dir of ['row', 'col'] as const) {
        const line = getLine(tempBoard, pos, dir);
        if (line.length > 1 && !isValidLine(line)) {
          valid = false;
          break;
        }
      }
      
      if (valid) {
        validTiles.push(tile);
      }
    }
    
    if (validTiles.length > 0) {
      validPlacements.set(cellKey, validTiles);
    }
  });
  
  return validPlacements;
}

// --- Game State Management ---

export function createGameState(
  roomCode: string,
  hostId: string,
  hostNickname: string,
  maxPlayers: number = 2
): GameState {
  const bag = createBag();
  const { drawn, remaining } = drawTiles(bag, HAND_SIZE);
  
  return {
    id: uuidv4(),
    board: {},
    bag: remaining,
    players: [{
      id: hostId,
      nickname: hostNickname,
      hand: drawn,
      score: 0,
    }],
    currentPlayerIndex: 0,
    phase: 'waiting',
    moves: [],
    consecutivePasses: 0,
    createdAt: Date.now(),
    roomCode,
    hostId,
    maxPlayers,
    winner: null,
  };
}

export function addPlayerToGame(state: GameState, playerId: string, nickname: string): GameState {
  if (state.players.length >= state.maxPlayers) throw new Error('Pokój jest pełny');
  if (state.phase !== 'waiting') throw new Error('Gra już się rozpoczęła');
  
  const { drawn, remaining } = drawTiles(state.bag, HAND_SIZE);
  
  return {
    ...state,
    bag: remaining,
    players: [...state.players, {
      id: playerId,
      nickname,
      hand: drawn,
      score: 0,
    }],
  };
}

export function addAIPlayer(state: GameState, level: 'easy' | 'medium' | 'hard'): GameState {
  const aiId = `ai_${uuidv4().slice(0, 8)}`;
  const aiNames: Record<string, string> = {
    easy: 'Bot_Łatwy',
    medium: 'Bot_Średni',
    hard: 'Bot_Ekspert',
  };
  // If there's already a bot with the same level, add a number suffix
  const baseName = aiNames[level];
  const existingCount = state.players.filter(p => p.isAI && p.aiLevel === level).length;
  const nickname = existingCount > 0 ? `${baseName}_${existingCount + 1}` : baseName;
  
  const { drawn, remaining } = drawTiles(state.bag, HAND_SIZE);
  
  return {
    ...state,
    bag: remaining,
    players: [...state.players, {
      id: aiId,
      nickname,
      hand: drawn,
      score: 0,
      isAI: true,
      aiLevel: level,
    }],
  };
}

export function startGame(state: GameState): GameState {
  if (state.players.length < 2) throw new Error('Potrzeba minimum 2 graczy');
  
  // Determine who goes first - player with most tiles of one attribute
  // In standard Qwirkle, player with largest group of same-attribute tiles starts
  let maxGroupSize = 0;
  let startingPlayer = 0;
  
  state.players.forEach((player, idx) => {
    // Check for largest group by color
    for (const color of TILE_COLORS) {
      const count = player.hand.filter(t => t.color === color).length;
      if (count > maxGroupSize) {
        maxGroupSize = count;
        startingPlayer = idx;
      }
    }
    // Check for largest group by shape
    for (const shape of TILE_SHAPES) {
      const count = player.hand.filter(t => t.shape === shape).length;
      if (count > maxGroupSize) {
        maxGroupSize = count;
        startingPlayer = idx;
      }
    }
  });
  
  return {
    ...state,
    phase: 'playing',
    currentPlayerIndex: startingPlayer,
    turnStartedAt: Date.now(),
  };
}

export function applyMove(state: GameState, placedTiles: PlacedTile[], playerId: string): GameState {
  const board = boardFromRecord(state.board);
  const playerIdx = state.players.findIndex(p => p.id === playerId);
  if (playerIdx === -1) throw new Error('Gracz nie znaleziony');
  if (playerIdx !== state.currentPlayerIndex) throw new Error('Nie Twoja kolej');
  
  const isFirstMove = board.size === 0;
  const validation = validateMove(board, placedTiles, isFirstMove);
  if (!validation.valid) throw new Error(validation.error);
  
  // Place tiles on board
  const newBoard = new Map(board);
  for (const pt of placedTiles) {
    newBoard.set(posKey(pt.position.row, pt.position.col), {
      color: pt.color, shape: pt.shape, id: pt.id
    });
  }
  
  // Remove placed tiles from hand
  const placedIds = new Set(placedTiles.map(t => t.id));
  let newHand = state.players[playerIdx].hand.filter(t => !placedIds.has(t.id));
  
  // Draw new tiles
  const tilesToDraw = Math.min(placedTiles.length, state.bag.length);
  const { drawn, remaining } = drawTiles(state.bag, tilesToDraw);
  newHand = [...newHand, ...drawn];
  
  const newPlayers = state.players.map((p, i) => {
    if (i === playerIdx) {
      return { ...p, hand: newHand, score: p.score + validation.score };
    }
    return p;
  });
  
  const move: GameMove = {
    playerId,
    tiles: placedTiles,
    score: validation.score,
    isSwap: false,
    timestamp: Date.now(),
  };
  
  // Check if game is over
  let phase = state.phase;
  let winner = state.winner;
  
  // Game ends if a player empties their hand and bag is empty
  if (newHand.length === 0 && remaining.length === 0) {
    phase = 'finished';
    // Player who goes out gets 6 bonus points
    const finalPlayers = newPlayers.map((p, i) => {
      if (i === playerIdx) return { ...p, score: p.score + 6 };
      return p;
    });
    const maxScore = Math.max(...finalPlayers.map(p => p.score));
    const winnerPlayer = finalPlayers.find(p => p.score === maxScore);
    winner = winnerPlayer?.nickname || null;
    
    return {
      ...state,
      board: boardToRecord(newBoard),
      bag: remaining,
      players: finalPlayers,
      currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
      phase,
      moves: [...state.moves, move],
      consecutivePasses: 0,
      winner,
      autoPassCounts: resetAutoPass(state.autoPassCounts, playerId),
    };
  }
  
  const nextPlayerIdx = (state.currentPlayerIndex + 1) % state.players.length;
  
  return {
    ...state,
    board: boardToRecord(newBoard),
    bag: remaining,
    players: newPlayers,
    currentPlayerIndex: nextPlayerIdx,
    phase,
    moves: [...state.moves, move],
    consecutivePasses: 0,
    winner,
    turnStartedAt: Date.now(),
    autoPassCounts: resetAutoPass(state.autoPassCounts, playerId),
  };
}

export function swapTiles(state: GameState, tilesToSwap: Tile[], playerId: string): GameState {
  const playerIdx = state.players.findIndex(p => p.id === playerId);
  if (playerIdx === -1) throw new Error('Gracz nie znaleziony');
  if (playerIdx !== state.currentPlayerIndex) throw new Error('Nie Twoja kolej');
  if (state.bag.length < tilesToSwap.length) throw new Error('Za mało kafelków w worku');
  
  const swapIds = new Set(tilesToSwap.map(t => t.id));
  let newHand = state.players[playerIdx].hand.filter(t => !swapIds.has(t.id));
  
  // Draw new tiles first
  const { drawn, remaining } = drawTiles(state.bag, tilesToSwap.length);
  newHand = [...newHand, ...drawn];
  
  // Put swapped tiles back in bag
  const newBag = shuffleArray([...remaining, ...tilesToSwap]);
  
  function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  
  const newPlayers = state.players.map((p, i) => {
    if (i === playerIdx) return { ...p, hand: newHand };
    return p;
  });
  
  const move: GameMove = {
    playerId,
    tiles: [],
    score: 0,
    isSwap: true,
    timestamp: Date.now(),
  };
  
  const nextPlayerIdx = (state.currentPlayerIndex + 1) % state.players.length;
  
  return {
    ...state,
    bag: newBag,
    players: newPlayers,
    currentPlayerIndex: nextPlayerIdx,
    moves: [...state.moves, move],
    consecutivePasses: state.consecutivePasses + 1,
    turnStartedAt: Date.now(),
    autoPassCounts: resetAutoPass(state.autoPassCounts, playerId),
  };
}

export function passTurn(state: GameState, playerId: string): GameState {
  const playerIdx = state.players.findIndex(p => p.id === playerId);
  if (playerIdx === -1) throw new Error('Gracz nie znaleziony');
  if (playerIdx !== state.currentPlayerIndex) throw new Error('Nie Twoja kolej');
  
  const newConsecutivePasses = state.consecutivePasses + 1;
  let phase = state.phase;
  let winner = state.winner;
  
  // If all players pass consecutively, game ends
  if (newConsecutivePasses >= state.players.length) {
    phase = 'finished';
    const maxScore = Math.max(...state.players.map(p => p.score));
    const winnerPlayer = state.players.find(p => p.score === maxScore);
    winner = winnerPlayer?.nickname || null;
  }
  
  const nextPlayerIdx = (state.currentPlayerIndex + 1) % state.players.length;
  
  return {
    ...state,
    currentPlayerIndex: nextPlayerIdx,
    phase,
    consecutivePasses: newConsecutivePasses,
    winner,
    turnStartedAt: phase === 'finished' ? state.turnStartedAt : Date.now(),
    // Note: autoPassCounts NOT reset here — passTurn is also used for auto-passes.
    // Manual pass resets it in passPlayerTurn (gameService.ts).
  };
}

// Reset auto-pass counter for a player who made a real move
function resetAutoPass(counts: Record<string, number> | undefined, playerId: string): Record<string, number> {
  if (!counts || !counts[playerId]) return counts || {};
  const next = { ...counts };
  delete next[playerId];
  return next;
}

export function generateRoomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
