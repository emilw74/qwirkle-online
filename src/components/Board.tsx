import { useRef, useState, useCallback, useEffect } from 'react';
import { Tile, PlacedTile, Position } from '../game/types';
import { posKey, parseKey, boardFromRecord, getValidPlacements } from '../game/engine';
import { TileView, EmptyCell } from './TileView';
import { useGameStore } from '../hooks/useGameStore';
import { cn } from '../utils/cn';
import { ZoomIn, ZoomOut, Crosshair } from 'lucide-react';

interface BoardProps {
  board: Record<string, Tile>;
  onCellClick: (position: Position) => void;
  selectedTile: Tile | null;
  placedThisTurn: PlacedTile[];
  isMyTurn: boolean;
  myHand: Tile[];
}

export function Board({ board, onCellClick, selectedTile, placedThisTurn, isMyTurn, myHand }: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const CELL_SIZE = 52;
  const GAP = 4;

  // Calculate board bounds
  const allKeys = [
    ...Object.keys(board),
    ...placedThisTurn.map(t => posKey(t.position.row, t.position.col)),
  ];

  let minRow = 0, maxRow = 0, minCol = 0, maxCol = 0;
  const boardMap = boardFromRecord(board);

  // Add placed-this-turn tiles to compute valid positions
  const tempBoard = new Map(boardMap);
  for (const pt of placedThisTurn) {
    tempBoard.set(posKey(pt.position.row, pt.position.col), pt);
  }

  if (allKeys.length > 0) {
    const positions = allKeys.map(parseKey);
    minRow = Math.min(...positions.map(p => p.row)) - 2;
    maxRow = Math.max(...positions.map(p => p.row)) + 2;
    minCol = Math.min(...positions.map(p => p.col)) - 2;
    maxCol = Math.max(...positions.map(p => p.col)) + 2;
  } else {
    minRow = -3; maxRow = 3; minCol = -4; maxCol = 4;
  }

  // Calculate valid positions for highlighting
  const validPositions = new Set<string>();
  if (isMyTurn && selectedTile) {
    const placements = getValidPlacements(tempBoard, [selectedTile]);
    placements.forEach((_, key) => validPositions.add(key));
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !selectedTile) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && !selectedTile) {
      setIsPanning(true);
      setPanStart({
        x: e.touches[0].clientX - panOffset.x,
        y: e.touches[0].clientY - panOffset.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPanning && e.touches.length === 1) {
      setPanOffset({
        x: e.touches[0].clientX - panStart.x,
        y: e.touches[0].clientY - panStart.y,
      });
    }
  };

  const handleTouchEnd = () => setIsPanning(false);

  const resetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div className="relative flex-1 overflow-hidden bg-muted/30 dark:bg-muted/10 rounded-xl border border-border/50">
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        <button
          onClick={() => setZoom(z => Math.min(z + 0.2, 2))}
          className="p-2 rounded-lg bg-card border border-border/50 shadow-sm hover:bg-accent/10 transition-colors"
          data-testid="zoom-in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))}
          className="p-2 rounded-lg bg-card border border-border/50 shadow-sm hover:bg-accent/10 transition-colors"
          data-testid="zoom-out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={resetView}
          className="p-2 rounded-lg bg-card border border-border/50 shadow-sm hover:bg-accent/10 transition-colors"
          data-testid="center-view"
        >
          <Crosshair size={16} />
        </button>
      </div>

      {/* Board container */}
      <div
        ref={containerRef}
        className="w-full h-full min-h-[300px] select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: isPanning ? 'grabbing' : selectedTile ? 'crosshair' : 'grab' }}
      >
        <div
          className="relative"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.2s ease',
          }}
        >
          <div
            className="grid mx-auto my-8"
            style={{
              gridTemplateColumns: `repeat(${maxCol - minCol + 1}, ${CELL_SIZE}px)`,
              gap: `${GAP}px`,
              width: 'fit-content',
              margin: '2rem auto',
            }}
          >
            {Array.from({ length: (maxRow - minRow + 1) * (maxCol - minCol + 1) }).map((_, idx) => {
              const row = minRow + Math.floor(idx / (maxCol - minCol + 1));
              const col = minCol + (idx % (maxCol - minCol + 1));
              const key = posKey(row, col);

              // Check existing board tile
              const boardTile = board[key];
              // Check placed-this-turn tile
              const placedTile = placedThisTurn.find(
                t => t.position.row === row && t.position.col === col
              );

              const tile = boardTile || placedTile;
              const isValid = validPositions.has(key);
              const isPlacedThisTurn = !!placedTile;

              if (tile) {
                return (
                  <div key={key} className="relative">
                    <TileView
                      tile={tile}
                      size={CELL_SIZE}
                      className={cn(
                        isPlacedThisTurn && 'ring-2 ring-accent ring-offset-1 ring-offset-background',
                      )}
                    />
                  </div>
                );
              }

              const isEmpty = !boardTile && !placedTile;
              const hasNeighbor = tempBoard.size > 0 && (
                tempBoard.has(posKey(row - 1, col)) ||
                tempBoard.has(posKey(row + 1, col)) ||
                tempBoard.has(posKey(row, col - 1)) ||
                tempBoard.has(posKey(row, col + 1))
              );

              // Show empty cell if it's the start or adjacent to something
              const showCell = tempBoard.size === 0 ? (row === 0 && col === 0) : hasNeighbor;

              if (showCell || isValid) {
                return (
                  <EmptyCell
                    key={key}
                    size={CELL_SIZE}
                    isValid={isValid && isMyTurn}
                    onClick={isValid && isMyTurn && selectedTile ? () => onCellClick({ row, col }) : undefined}
                  />
                );
              }

              return <div key={key} style={{ width: CELL_SIZE, height: CELL_SIZE }} />;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
