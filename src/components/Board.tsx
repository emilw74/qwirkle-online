import { useRef, useState, useCallback, useEffect } from 'react';
import { Tile, PlacedTile, Position, TileColor } from '../game/types';
import { posKey, parseKey, boardFromRecord, getValidPlacements } from '../game/engine';
import { TileView, EmptyCell } from './TileView';
import { useGameStore } from '../hooks/useGameStore';
import { cn } from '../utils/cn';
import { ZoomIn, ZoomOut, Crosshair } from 'lucide-react';

// Contrasting highlight colors per tile color
const SCORING_RING_COLOR: Record<TileColor, string> = {
  red: '#06b6d4',     // cyan
  orange: '#3b82f6',  // blue
  yellow: '#a855f7',  // purple
  green: '#ec4899',   // pink
  blue: '#f97316',    // orange
  purple: '#84cc16',  // lime
};

interface BoardProps {
  board: Record<string, Tile>;
  onCellClick: (position: Position) => void;
  selectedTile: Tile | null;
  placedThisTurn: PlacedTile[];
  isMyTurn: boolean;
  myHand: Tile[];
  highlightedPositions?: Set<string>;
  previewScore?: number;
  scoringPositions?: Set<string>;
}

export function Board({ board, onCellClick, selectedTile, placedThisTurn, isMyTurn, myHand, highlightedPositions, previewScore, scoringPositions }: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  // Pinch-to-zoom state
  const pinchRef = useRef<{ startDist: number; startZoom: number; midX: number; midY: number } | null>(null);
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

  const getTouchDist = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Start pinch-to-zoom
      setIsPanning(false);
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      pinchRef.current = {
        startDist: dist,
        startZoom: zoom,
        midX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        midY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    } else if (e.touches.length === 1 && !selectedTile) {
      pinchRef.current = null;
      setIsPanning(true);
      setPanStart({
        x: e.touches[0].clientX - panOffset.x,
        y: e.touches[0].clientY - panOffset.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      const scale = dist / pinchRef.current.startDist;
      const newZoom = Math.min(Math.max(pinchRef.current.startZoom * scale, 0.4), 2);
      setZoom(newZoom);
    } else if (isPanning && e.touches.length === 1) {
      setPanOffset({
        x: e.touches[0].clientX - panStart.x,
        y: e.touches[0].clientY - panStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    pinchRef.current = null;
  };

  // Prevent browser pinch-zoom on the board container (needs non-passive listener)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const preventDefault = (e: TouchEvent) => {
      if (e.touches.length >= 2) e.preventDefault();
    };
    el.addEventListener('touchmove', preventDefault, { passive: false });
    return () => el.removeEventListener('touchmove', preventDefault);
  }, []);

  const resetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div className="relative flex-1 overflow-hidden bg-muted/30 dark:bg-muted/10 rounded-lg border border-border/50 h-full">
      {/* Zoom controls */}
      <div className="absolute top-1.5 right-1.5 z-10 flex flex-col gap-1">
        <button
          onClick={() => setZoom(z => Math.min(z + 0.2, 2))}
          className="p-1.5 rounded-md bg-card/90 border border-border/50 shadow-sm hover:bg-accent/10 transition-colors"
          data-testid="zoom-in"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))}
          className="p-1.5 rounded-md bg-card/90 border border-border/50 shadow-sm hover:bg-accent/10 transition-colors"
          data-testid="zoom-out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 rounded-md bg-card/90 border border-border/50 shadow-sm hover:bg-accent/10 transition-colors"
          data-testid="center-view"
        >
          <Crosshair size={14} />
        </button>
      </div>

      {/* Board container */}
      <div
        ref={containerRef}
        className="w-full h-full select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: isPanning ? 'grabbing' : selectedTile ? 'crosshair' : 'grab', touchAction: 'none' }}
      >
        <div
          className="relative"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isPanning || pinchRef.current ? 'none' : 'transform 0.2s ease',
          }}
        >
          <div
            className="grid mx-auto"
            style={{
              gridTemplateColumns: `repeat(${maxCol - minCol + 1}, ${CELL_SIZE}px)`,
              gap: `${GAP}px`,
              width: 'fit-content',
              margin: '0.5rem auto',
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
              const isHighlighted = highlightedPositions?.has(key);
              const isScoring = scoringPositions?.has(key);
              // Show score badge on the last placed tile
              const lastPlaced = placedThisTurn.length > 0 ? placedThisTurn[placedThisTurn.length - 1] : null;
              const isLastPlaced = lastPlaced && lastPlaced.position.row === row && lastPlaced.position.col === col;

              if (tile) {
                return (
                  <div key={key} className="relative">
                    <TileView
                      tile={tile}
                      size={CELL_SIZE}
                      className={cn(
                        isPlacedThisTurn && !isScoring && 'ring-2 ring-accent ring-offset-1 ring-offset-background',
                        isScoring && 'ring-offset-1 ring-offset-background scoring-tile-glow',
                        isHighlighted && !isScoring && 'ring-2 ring-yellow-500 ring-offset-1 ring-offset-background animate-pulse',
                      )}
                      style={isScoring && tile ? {
                        '--scoring-color': SCORING_RING_COLOR[tile.color as TileColor],
                        outline: `2.5px solid ${SCORING_RING_COLOR[tile.color as TileColor]}`,
                        outlineOffset: '1.5px',
                      } as React.CSSProperties : undefined}
                    />
                    {isLastPlaced && previewScore != null && previewScore > 0 && (
                      <div className="absolute -top-2.5 -right-2.5 z-10 min-w-[22px] h-[22px] px-1 rounded-full bg-primary text-primary-foreground font-bold text-[11px] flex items-center justify-center shadow-md tabular-nums pointer-events-none">
                        +{previewScore}
                      </div>
                    )}
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
