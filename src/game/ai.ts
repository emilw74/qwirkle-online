import {
  Tile, PlacedTile, Board, AILevel, Position,
  TILE_COLORS, TILE_SHAPES
} from './types';
import {
  boardFromRecord, posKey, parseKey, getNeighbors, validateMove, getValidPlacements
} from './engine';

interface AIMove {
  tiles: PlacedTile[];
  score: number;
}

// Get all empty cells adjacent to existing tiles
function getAdjacentEmpty(board: Board): Set<string> {
  const empty = new Set<string>();
  if (board.size === 0) {
    empty.add(posKey(0, 0));
    return empty;
  }
  board.forEach((_, key) => {
    const pos = parseKey(key);
    for (const n of getNeighbors(pos)) {
      const nKey = posKey(n.row, n.col);
      if (!board.has(nKey)) empty.add(nKey);
    }
  });
  return empty;
}

// Find all valid single-tile placements
function findSinglePlacements(board: Board, hand: Tile[], isFirstMove: boolean): AIMove[] {
  const moves: AIMove[] = [];
  const placements = getValidPlacements(board, hand);

  placements.forEach((validTiles, cellKey) => {
    const pos = parseKey(cellKey);
    for (const tile of validTiles) {
      const placed: PlacedTile = { ...tile, position: pos };
      const result = validateMove(board, [placed], isFirstMove);
      if (result.valid) {
        moves.push({ tiles: [placed], score: result.score });
      }
    }
  });
  return moves;
}

// Find multi-tile placements along a direction
function findMultiPlacements(
  board: Board, hand: Tile[], isFirstMove: boolean, maxDepth: number
): AIMove[] {
  const allMoves: AIMove[] = [];

  // Start from each valid single placement and extend
  const adjacentCells = getAdjacentEmpty(board);

  adjacentCells.forEach(startKey => {
    const startPos = parseKey(startKey);

    // Try extending in each direction (horizontal and vertical)
    for (const dir of ['row', 'col'] as const) {
      // Try each tile from hand as starting tile
      for (let i = 0; i < hand.length; i++) {
        const firstTile = hand[i];
        const placed: PlacedTile = { ...firstTile, position: startPos };
        const tempBoard = new Map(board);
        tempBoard.set(startKey, firstTile);

        const firstResult = validateMove(board, [placed], isFirstMove);
        if (!firstResult.valid) continue;

        allMoves.push({ tiles: [placed], score: firstResult.score });

        // Try extending with remaining tiles
        const remainingHand = hand.filter((_, idx) => idx !== i);
        extendPlacement(
          board, tempBoard, [placed], remainingHand,
          startPos, dir, isFirstMove, allMoves, maxDepth - 1
        );
      }
    }
  });

  return allMoves;
}

function extendPlacement(
  originalBoard: Board,
  currentBoard: Board,
  currentTiles: PlacedTile[],
  remainingHand: Tile[],
  lastPos: Position,
  dir: 'row' | 'col',
  isFirstMove: boolean,
  results: AIMove[],
  depthLeft: number
) {
  if (depthLeft <= 0 || remainingHand.length === 0) return;

  // Try extending in positive direction
  const nextPos: Position = dir === 'row'
    ? { row: lastPos.row, col: lastPos.col + 1 }
    : { row: lastPos.row + 1, col: lastPos.col };

  const nextKey = posKey(nextPos.row, nextPos.col);

  // Skip if cell is occupied
  if (currentBoard.has(nextKey)) {
    // Try the cell after
    const skipPos: Position = dir === 'row'
      ? { row: nextPos.row, col: nextPos.col + 1 }
      : { row: nextPos.row + 1, col: nextPos.col };
    if (!currentBoard.has(posKey(skipPos.row, skipPos.col))) {
      // Can't skip - line must be contiguous
      return;
    }
  }

  if (currentBoard.has(nextKey)) return;

  for (let i = 0; i < remainingHand.length; i++) {
    const tile = remainingHand[i];
    const placed: PlacedTile = { ...tile, position: nextPos };
    const allPlaced = [...currentTiles, placed];

    const result = validateMove(originalBoard, allPlaced, isFirstMove);
    if (result.valid) {
      results.push({ tiles: [...allPlaced], score: result.score });

      // Continue extending
      const newBoard = new Map(currentBoard);
      newBoard.set(nextKey, tile);
      const newRemaining = remainingHand.filter((_, idx) => idx !== i);

      extendPlacement(
        originalBoard, newBoard, allPlaced, newRemaining,
        nextPos, dir, isFirstMove, results, depthLeft - 1
      );
    }
  }
}

export function getAIMove(
  boardRecord: Record<string, Tile>,
  hand: Tile[],
  level: AILevel,
  bagSize: number
): AIMove | null {
  const board = boardFromRecord(boardRecord);
  const isFirstMove = board.size === 0;

  // Search depth based on level
  const maxDepth = level === 'easy' ? 2 : level === 'medium' ? 4 : 6;

  // Find all possible moves
  let allMoves: AIMove[] = [];

  // Single tile placements
  allMoves = findSinglePlacements(board, hand, isFirstMove);

  // Multi-tile placements
  if (maxDepth > 1) {
    const multiMoves = findMultiPlacements(board, hand, isFirstMove, maxDepth);
    allMoves = [...allMoves, ...multiMoves];
  }

  // Remove duplicates (same tiles, same positions)
  const uniqueMoves = deduplicateMoves(allMoves);

  if (uniqueMoves.length === 0) return null;

  // Sort by score descending
  uniqueMoves.sort((a, b) => b.score - a.score);

  // Select move based on AI level
  switch (level) {
    case 'easy': {
      // Pick a random move from the bottom 60%
      const pool = uniqueMoves.slice(Math.floor(uniqueMoves.length * 0.4));
      if (pool.length === 0) return uniqueMoves[uniqueMoves.length - 1];
      return pool[Math.floor(Math.random() * pool.length)];
    }
    case 'medium': {
      // Pick from top 50% with some randomness
      const top = uniqueMoves.slice(0, Math.max(1, Math.ceil(uniqueMoves.length * 0.5)));
      return top[Math.floor(Math.random() * top.length)];
    }
    case 'hard': {
      // Almost always pick the best move, small chance of 2nd or 3rd
      const r = Math.random();
      if (r < 0.7 || uniqueMoves.length === 1) return uniqueMoves[0];
      if (r < 0.9 && uniqueMoves.length > 1) return uniqueMoves[1];
      if (uniqueMoves.length > 2) return uniqueMoves[2];
      return uniqueMoves[0];
    }
    default:
      return uniqueMoves[0];
  }
}

function deduplicateMoves(moves: AIMove[]): AIMove[] {
  const seen = new Set<string>();
  return moves.filter(move => {
    const key = move.tiles
      .map(t => `${t.id}@${t.position.row},${t.position.col}`)
      .sort()
      .join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Check if AI should swap tiles (no good moves available)
export function shouldAISwap(
  boardRecord: Record<string, Tile>,
  hand: Tile[],
  level: AILevel,
  bagSize: number
): Tile[] | null {
  if (bagSize === 0) return null;

  const board = boardFromRecord(boardRecord);
  const isFirstMove = board.size === 0;
  if (isFirstMove) return null; // always can play on first move

  const moves = findSinglePlacements(board, hand, isFirstMove);

  // Easy AI swaps if it has no moves
  if (moves.length === 0) {
    const swapCount = Math.min(hand.length, bagSize, 3);
    return hand.slice(0, swapCount);
  }

  // Medium/Hard: swap if best score is very low and there are tiles to swap
  if (level !== 'easy') {
    const bestScore = Math.max(...moves.map(m => m.score));
    if (bestScore <= 1 && bagSize >= 3) {
      // Swap tiles that don't share attributes with others in hand
      const toSwap = findWorstTiles(hand, 3);
      return toSwap;
    }
  }

  return null;
}

function findWorstTiles(hand: Tile[], count: number): Tile[] {
  // Score each tile by how many others in hand share an attribute
  const scored = hand.map(tile => {
    let score = 0;
    for (const other of hand) {
      if (other.id === tile.id) continue;
      if (other.color === tile.color || other.shape === tile.shape) score++;
    }
    return { tile, score };
  });

  // Sort by score ascending (worst tiles first)
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, count).map(s => s.tile);
}
