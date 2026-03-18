import { create } from 'zustand';
import { GameState, Tile, PlacedTile, Position } from '../game/types';

interface GameStore {
  // Player identity (from Firebase Auth)
  uid: string | null;
  playerId: string | null;
  nickname: string | null;
  photoURL: string | null;
  roomCode: string | null;

  // Game state from Firebase
  gameState: GameState | null;

  // Local UI state
  selectedTiles: Tile[];
  placedTilesThisTurn: PlacedTile[];
  isDarkMode: boolean;

  // Actions
  setAuth: (uid: string, nickname: string, photoURL: string | null) => void;
  setPlayerId: (id: string) => void;
  setNickname: (name: string) => void;
  setRoomCode: (code: string) => void;
  setGameState: (state: GameState | null) => void;
  selectTile: (tile: Tile) => void;
  deselectTile: (tileId: string) => void;
  clearSelection: () => void;
  placeTileOnBoard: (tile: Tile, position: Position) => void;
  undoLastPlacement: () => void;
  clearPlacements: () => void;
  toggleDarkMode: () => void;
  leaveGame: () => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  uid: null,
  playerId: null,
  nickname: null,
  photoURL: null,
  roomCode: null,
  gameState: null,
  selectedTiles: [],
  placedTilesThisTurn: [],
  isDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,

  setAuth: (uid, nickname, photoURL) => set({ uid, nickname, photoURL }),
  setPlayerId: (id) => set({ playerId: id }),
  setNickname: (name) => set({ nickname: name }),
  setRoomCode: (code) => set({ roomCode: code }),
  setGameState: (state) => set({ gameState: state }),

  selectTile: (tile) => set(s => {
    if (s.selectedTiles.find(t => t.id === tile.id)) {
      return { selectedTiles: s.selectedTiles.filter(t => t.id !== tile.id) };
    }
    return { selectedTiles: [...s.selectedTiles, tile] };
  }),

  deselectTile: (tileId) => set(s => ({
    selectedTiles: s.selectedTiles.filter(t => t.id !== tileId),
  })),

  clearSelection: () => set({ selectedTiles: [] }),

  placeTileOnBoard: (tile, position) => set(s => ({
    placedTilesThisTurn: [...s.placedTilesThisTurn, { ...tile, position }],
    selectedTiles: s.selectedTiles.filter(t => t.id !== tile.id),
  })),

  undoLastPlacement: () => set(s => {
    return {
      placedTilesThisTurn: s.placedTilesThisTurn.slice(0, -1),
    };
  }),

  clearPlacements: () => set({ placedTilesThisTurn: [], selectedTiles: [] }),

  toggleDarkMode: () => set(s => {
    const newMode = !s.isDarkMode;
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { isDarkMode: newMode };
  }),

  // Soft reset: keeps auth info (uid, nickname, photoURL) for multi-game flow
  leaveGame: () => set({
    playerId: null,
    roomCode: null,
    gameState: null,
    selectedTiles: [],
    placedTilesThisTurn: [],
  }),
  // Hard reset: clears everything
  reset: () => set({
    uid: null,
    playerId: null,
    nickname: null,
    photoURL: null,
    roomCode: null,
    gameState: null,
    selectedTiles: [],
    placedTilesThisTurn: [],
  }),
}));
