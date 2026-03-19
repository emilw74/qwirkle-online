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
  const activePointerId = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragTileRef = useRef<Tile | null>(null);

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

  // --- Pointer handlers ---

  const handlePointerDown = useCallback((e: React.PointerEvent, idx: number, tile: Tile) => {
    if (e.button !== 0) return;
    startXRef.current = e.clientX;
    movedRef.current = false;
    activePointerId.current = e.pointerId;
    dragTileRef.current = tile;
    setDragIdx(idx);
    setDropIdx(idx);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragIdx === null || e.pointerId !== activePointerId.current) return;
    const dx = Math.abs(e.clientX - startXRef.current);
    if (dx > 8) movedRef.current = true;
    if (!movedRef.current) return;
    setDropIdx(getDropIndex(e.clientX));
  }, [dragIdx, getDropIndex]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== activePointerId.current) return;

    if (dragIdx !== null && dropIdx !== null && movedRef.current) {
      // Was a drag — reorder tiles
      reorder(dragIdx, dropIdx);
    } else if (dragTileRef.current && isMyTurn) {
      // Was a tap/click — select the tile
      onSelectTile(dragTileRef.current);
    }

    setDragIdx(null);
    setDropIdx(null);
    movedRef.current = false;
    activePointerId.current = null;
    dragTileRef.current = null;
  }, [dragIdx, dropIdx, reorder, onSelectTile, isMyTurn]);

  const handleCancel = useCallback(() => {
    setDragIdx(null);
    setDropIdx(null);
    movedRef.current = false;
    activePointerId.current = null;
    dragTileRef.current = null;
  }, []);

  // Visual shift during drag
  const getShift = (idx: number): number => {
    if (dragIdx === null || dropIdx === null || !movedRef.current) return 0;
    if (idx === dragIdx) return 0;
    if (dragIdx < dropIdx) {
      if (idx > dragIdx && idx <= dropIdx) return -1;
    } else if (dragIdx > dropIdx) {
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
      onPointerCancel={handleCancel}
    >
      {tiles.map((tile, idx) => {
        const shift = getShift(idx);
        const isDragged = dragIdx === idx && movedRef.current;
        return (
          <div
            key={tile.id}
            data-hand-tile
            onPointerDown={(e) => handlePointerDown(e, idx, tile)}
            className={cn(
              'relative select-none',
              !isMyTurn && 'opacity-50',
            )}
            style={{
              transform: isDragged
                ? 'scale(0.85)'
                : shift !== 0
                  ? `translateX(${shift * 48}px)`
                  : 'none',
              opacity: isDragged ? 0.4 : undefined,
              transition: dragIdx !== null ? 'transform 150ms ease, opacity 150ms ease' : 'none',
              zIndex: isDragged ? 10 : 0,
              cursor: isMyTurn ? 'pointer' : 'not-allowed',
            }}
          >
            <TileView
              tile={tile}
              size={44}
              selected={selectedTile?.id === tile.id}
              className={cn(
                'hand-tile pointer-events-none',
                selectedTile?.id === tile.id && 'selected',
              )}
            />
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
