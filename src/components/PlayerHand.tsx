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

  return (
    <div className="flex items-center gap-1.5 justify-center px-2 py-1.5">
      {availableTiles.map(tile => (
        <TileView
          key={tile.id}
          tile={tile}
          size={44}
          selected={selectedTile?.id === tile.id}
          onClick={() => onSelectTile(tile)}
          disabled={!isMyTurn}
          className={cn(
            'hand-tile',
            selectedTile?.id === tile.id && 'selected',
          )}
        />
      ))}
      {availableTiles.length === 0 && (
        <div className="text-muted-foreground text-xs py-1">
          Brak kafelków
        </div>
      )}
    </div>
  );
}
