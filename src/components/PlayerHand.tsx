import { useState, useRef, useCallback, useEffect } from 'react';
import { Tile } from '../game/types';
import { TileView } from './TileView';
import { cn } from '../utils/cn';

interface PlayerHandProps {
  hand: Tile[];
  selectedTile: Tile | null;
  onSelectTile: (tile: Tile) => void;
  isMyTurn: boolean;
  placedTileIds: Set<string>;
}

export function PlayerHand({ hand, selectedTile, onSelectTile, isMyTurn, placedTileIds }: PlayerHandProps) {
  const availableTiles = hand.filter(t => !placedTileIds.has(t.id));

  // Local reordering state — purely visual, keyed by tile IDs
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const startXRef = useRef(0);
  const movedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync orderedIds when hand composition changes
  const availableKey = availableTiles.map(t => t.id).join(',');
  useEffect(() => {
    const ids = availableTiles.map(t => t.id);
    setOrderedIds(prev => {
      const kept = prev.filter(id => ids.includes(id));
      const added = ids.filter(id => !prev.includes(id));
      return [...kept, ...added];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableKey]);

  // Build display order
  const displayTiles = orderedIds
    .map(id => availableTiles.find(t => t.id === id))
    .filter((t): t is Tile => !!t);
  // Fallback if out of sync
  const tiles = displayTiles.length === availableTiles.length ? displayTiles : availableTiles;

  // Find the target index from a horizontal position
  const getDropIndex = useCallback((clientX: number): number => {
    if (!containerRef.current) return 0;
    const children = containerRef.current.querySelectorAll<HTMLElement>('[data-hand-tile]');
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) return i;
    }
    return children.length - 1;
  }, []);

  const reorder = useCallback((from: number, to: number) => {
    if (from === to) return;
    setOrderedIds(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  // --- Pointer handlers (unified touch + mouse) ---
  const handlePointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    // Only primary button / single touch
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    movedRef.current = false;
    setDragIdx(idx);
    setDropIdx(idx);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragIdx === null) return;
    const dx = Math.abs(e.clientX - startXRef.current);
    if (dx > 6) movedRef.current = true;
    if (!movedRef.current) return;
    setDropIdx(getDropIndex(e.clientX));
  }, [dragIdx, getDropIndex]);

  const handlePointerUp = useCallback(() => {
    if (dragIdx !== null && dropIdx !== null && movedRef.current) {
      reorder(dragIdx, dropIdx);
    }
    setDragIdx(null);
    setDropIdx(null);
    movedRef.current = false;
  }, [dragIdx, dropIdx, reorder]);

  const handleClick = useCallback((tile: Tile) => {
    if (!movedRef.current) {
      onSelectTile(tile);
    }
  }, [onSelectTile]);

  // Compute shifted positions for visual preview during drag
  const getShift = (idx: number): number => {
    if (dragIdx === null || dropIdx === null || !movedRef.current) return 0;
    if (idx === dragIdx) return 0; // dragged tile will be semi-transparent
    if (dragIdx < dropIdx) {
      // Moving right: tiles between (dragIdx, dropIdx] shift left
      if (idx > dragIdx && idx <= dropIdx) return -1;
    } else if (dragIdx > dropIdx) {
      // Moving left: tiles between [dropIdx, dragIdx) shift right
      if (idx >= dropIdx && idx < dragIdx) return 1;
    }
    return 0;
  };

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-1.5 justify-center px-2 py-1.5"
      style={{ touchAction: 'pan-y' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {tiles.map((tile, idx) => {
        const shift = getShift(idx);
        const isDragged = dragIdx === idx && movedRef.current;
        return (
          <div
            key={tile.id}
            data-hand-tile
            onPointerDown={(e) => handlePointerDown(e, idx)}
            className="relative"
            style={{
              transform: isDragged
                ? 'scale(0.85)'
                : shift !== 0
                  ? `translateX(${shift * 48}px)`
                  : 'none',
              opacity: isDragged ? 0.4 : 1,
              transition: dragIdx !== null ? 'transform 150ms ease, opacity 150ms ease' : 'none',
              zIndex: isDragged ? 10 : 0,
            }}
          >
            <TileView
              tile={tile}
              size={44}
              selected={selectedTile?.id === tile.id}
              onClick={() => handleClick(tile)}
              disabled={!isMyTurn}
              className={cn(
                'hand-tile',
                selectedTile?.id === tile.id && 'selected',
              )}
            />
            {/* Drop indicator line */}
            {dragIdx !== null && dropIdx === idx && dragIdx !== idx && movedRef.current && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary rounded-full"
                style={{
                  left: dragIdx > dropIdx ? -4 : undefined,
                  right: dragIdx < dropIdx ? -4 : undefined,
                }}
              />
            )}
          </div>
        );
      })}
      {tiles.length === 0 && (
        <div className="text-muted-foreground text-xs py-1">
          Brak kafelków
        </div>
      )}
    </div>
  );
}
