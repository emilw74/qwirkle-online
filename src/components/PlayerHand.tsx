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
    <div className="flex flex-col items-center gap-3 p-4">
      <div className="text-sm font-medium text-muted-foreground">
        Twoje kafelki ({availableTiles.length})
      </div>
      <div className="flex gap-2 flex-wrap justify-center">
        {availableTiles.map(tile => (
          <TileView
            key={tile.id}
            tile={tile}
            size={56}
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
          <div className="text-muted-foreground text-sm py-4">
            Brak kafelków
          </div>
        )}
      </div>
    </div>
  );
}
