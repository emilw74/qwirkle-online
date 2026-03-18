export type Lang = 'pl' | 'en';

export const translations = {
  // ===== AuthGate =====
  authSubtitle: {
    pl: 'Zaloguj się aby grać z przyjaciółmi',
    en: 'Sign in to play with friends',
  },
  signInGoogle: {
    pl: 'Zaloguj się przez Google',
    en: 'Sign in with Google',
  },
  authDisclaimer: {
    pl: 'Twoje konto Google służy tylko do identyfikacji.\nNie pobieramy żadnych dodatkowych danych.',
    en: 'Your Google account is used for identification only.\nWe do not collect any additional data.',
  },
  authErrorLogin: {
    pl: 'Błąd logowania',
    en: 'Sign in error',
  },
  authErrorProfile: {
    pl: 'Błąd ładowania profilu',
    en: 'Error loading profile',
  },
  defaultPlayer: {
    pl: 'Gracz',
    en: 'Player',
  },

  // ===== App Header =====
  changeNick: {
    pl: 'Zmień nick',
    en: 'Change nickname',
  },
  backToLobby: {
    pl: 'Wróć do lobby',
    en: 'Back to lobby',
  },
  lightMode: {
    pl: 'Tryb jasny',
    en: 'Light mode',
  },
  darkMode: {
    pl: 'Tryb ciemny',
    en: 'Dark mode',
  },
  signOut: {
    pl: 'Wyloguj się',
    en: 'Sign out',
  },
  nickModalTitle: {
    pl: 'Zmień nick',
    en: 'Change nickname',
  },
  nickPlaceholder: {
    pl: 'Nowy nick...',
    en: 'New nickname...',
  },
  nickError: {
    pl: 'Nick musi mieć 1-16 znaków',
    en: 'Nickname must be 1-16 characters',
  },
  nickErrorGeneric: {
    pl: 'Błąd zmiany nicku',
    en: 'Error changing nickname',
  },
  cancel: {
    pl: 'Anuluj',
    en: 'Cancel',
  },
  save: {
    pl: 'Zapisz',
    en: 'Save',
  },

  // ===== Lobby — Main menu =====
  lobbySubtitle: {
    pl: 'Graj online lub z komputerem',
    en: 'Play online or against AI',
  },
  createRoom: {
    pl: 'Stwórz pokój',
    en: 'Create room',
  },
  createRoomDesc: {
    pl: 'Zaproś graczy lub dodaj AI',
    en: 'Invite players or add AI',
  },
  joinRoom: {
    pl: 'Dołącz do pokoju',
    en: 'Join room',
  },
  joinRoomDesc: {
    pl: 'Wpisz 6-cyfrowy kod',
    en: 'Enter 6-digit code',
  },
  myGames: {
    pl: 'Moje gry',
    en: 'My games',
  },
  myGamesDesc: {
    pl: 'Aktywne i zakończone rozgrywki',
    en: 'Active and finished games',
  },
  ranking: {
    pl: 'Ranking',
    en: 'Ranking',
  },
  history: {
    pl: 'Historia',
    en: 'History',
  },
  rules: {
    pl: 'Zasady',
    en: 'Rules',
  },
  about: {
    pl: 'O grze',
    en: 'About',
  },

  // ===== Lobby — Create / Join =====
  back: {
    pl: 'Wróć',
    en: 'Back',
  },
  loggedIn: {
    pl: 'Zalogowany',
    en: 'Logged in',
  },
  roomCode: {
    pl: 'Kod pokoju',
    en: 'Room code',
  },
  roomCodePlaceholder: {
    pl: '6-cyfrowy kod...',
    en: '6-digit code...',
  },
  maxPlayers: {
    pl: 'Maks. graczy',
    en: 'Max players',
  },
  nPlayers: {
    pl: 'graczy',
    en: 'players',
  },
  join: {
    pl: 'Dołącz',
    en: 'Join',
  },

  // ===== Lobby — Waiting room =====
  waitingRoom: {
    pl: 'Poczekalnia',
    en: 'Waiting room',
  },
  roomCodeLabel: {
    pl: 'Kod pokoju:',
    en: 'Room code:',
  },
  playersCount: {
    pl: 'Gracze',
    en: 'Players',
  },
  addBot: {
    pl: 'Dodaj bota',
    en: 'Add bot',
  },
  botEasy: {
    pl: 'Łatwy',
    en: 'Easy',
  },
  botMedium: {
    pl: 'Średni',
    en: 'Medium',
  },
  botHard: {
    pl: 'Trudny',
    en: 'Hard',
  },
  startGame: {
    pl: 'Rozpocznij grę',
    en: 'Start game',
  },
  needMinPlayers: {
    pl: 'Potrzeba min. 2 graczy',
    en: 'Need at least 2 players',
  },
  waitingForHost: {
    pl: 'Czekam na hosta...',
    en: 'Waiting for host...',
  },

  // ===== Lobby — My games =====
  refresh: {
    pl: 'Odśwież',
    en: 'Refresh',
  },
  active: {
    pl: 'Aktywne',
    en: 'Active',
  },
  finished: {
    pl: 'Zakończone',
    en: 'Finished',
  },
  waiting: {
    pl: 'Oczekiwanie',
    en: 'Waiting',
  },
  yourTurn: {
    pl: 'Twoja kolej',
    en: 'Your turn',
  },
  waitTurn: {
    pl: 'Czekaj',
    en: 'Wait',
  },
  pts: {
    pl: 'pkt',
    en: 'pts',
  },
  remove: {
    pl: 'Usuń',
    en: 'Remove',
  },
  emptyBoard: {
    pl: 'Pusta plansza',
    en: 'Empty board',
  },
  finalBoardLayout: {
    pl: 'Ostateczny układ planszy',
    en: 'Final board layout',
  },
  finishedAt: {
    pl: 'Zakończono:',
    en: 'Finished:',
  },
  noGames: {
    pl: 'Brak gier',
    en: 'No games',
  },
  noGamesHint: {
    pl: 'Stwórz pokój lub dołącz do istniejącego',
    en: 'Create a room or join an existing one',
  },

  // ===== Lobby errors =====
  authError: {
    pl: 'Błąd autoryzacji',
    en: 'Authorization error',
  },
  roomCodeError: {
    pl: 'Kod pokoju musi mieć 6 cyfr',
    en: 'Room code must be 6 digits',
  },
  createRoomError: {
    pl: 'Błąd tworzenia pokoju',
    en: 'Error creating room',
  },
  joinError: {
    pl: 'Błąd dołączania',
    en: 'Error joining',
  },
  rejoinError: {
    pl: 'Błąd powrotu do gry',
    en: 'Error rejoining game',
  },
  addAiError: {
    pl: 'Błąd dodawania AI',
    en: 'Error adding AI',
  },
  startGameError: {
    pl: 'Błąd rozpoczynania gry',
    en: 'Error starting game',
  },

  // ===== Game =====
  noGameData: {
    pl: 'Brak danych gry',
    en: 'No game data',
  },
  gameEnd: {
    pl: 'Koniec gry',
    en: 'Game over',
  },
  winner: {
    pl: 'Wygrywa:',
    en: 'Winner:',
  },
  newGame: {
    pl: 'Nowa gra',
    en: 'New game',
  },
  you: {
    pl: 'Ty',
    en: 'You',
  },
  swappedTiles: {
    pl: 'wymienił kafelki',
    en: 'swapped tiles',
  },
  invalidMove: {
    pl: 'Nieprawidłowy ruch',
    en: 'Invalid move',
  },
  error: {
    pl: 'Błąd',
    en: 'Error',
  },

  // ===== Game — Swap dialog =====
  swapTiles: {
    pl: 'Wymień kafelki',
    en: 'Swap tiles',
  },
  selectTilesToSwap: {
    pl: 'Wybierz kafelki do wymiany:',
    en: 'Select tiles to swap:',
  },
  swapCount: {
    pl: 'Wymień',
    en: 'Swap',
  },
  swapError: {
    pl: 'Błąd wymiany',
    en: 'Swap error',
  },

  // ===== GameActions =====
  hideLast: {
    pl: 'Ukryj',
    en: 'Hide',
  },
  lastMove: {
    pl: 'Ostatni ruch',
    en: 'Last move',
  },
  swap: {
    pl: 'Wymień',
    en: 'Swap',
  },
  pass: {
    pl: 'Pas',
    en: 'Pass',
  },
  waitForTurn: {
    pl: 'Czekaj na swoją kolej...',
    en: 'Wait for your turn...',
  },

  // ===== ScoreBoard =====
  // uses 'you' from Game

  // ===== Leaderboard =====
  leaderboardTitle: {
    pl: 'Ranking graczy',
    en: 'Player ranking',
  },
  noResults: {
    pl: 'Brak wyników',
    en: 'No results',
  },
  noResultsHint: {
    pl: 'Zagraj pierwszą grę, aby pojawić się w rankingu',
    en: 'Play your first game to appear on the leaderboard',
  },
  gamesPlayed: {
    pl: 'gier',
    en: 'games',
  },
  gamesWon: {
    pl: 'wygranych',
    en: 'won',
  },
  highest: {
    pl: 'najw.',
    en: 'best',
  },

  // ===== GameHistory =====
  historyTitle: {
    pl: 'Historia gier',
    en: 'Game history',
  },
  noHistory: {
    pl: 'Brak historii',
    en: 'No history',
  },
  noHistoryHint: {
    pl: 'Twoje gry pojawią się tutaj',
    en: 'Your games will appear here',
  },
  room: {
    pl: 'Pokój:',
    en: 'Room:',
  },
  playersLabel: {
    pl: 'graczy',
    en: 'players',
  },
  moves: {
    pl: 'ruchów',
    en: 'moves',
  },

  // ===== Rules =====
  rulesTitle: {
    pl: 'Zasady gry Qwirkle',
    en: 'Qwirkle Game Rules',
  },
  scoringExample: {
    pl: 'Przykład punktacji',
    en: 'Scoring Example',
  },

  // ===== About =====
  version: {
    pl: 'Wersja 1.0 · 2026',
    en: 'Version 1.0 · 2026',
  },
  conceptDesignTesting: {
    pl: 'Koncepcja, projekt, testy',
    en: 'Concept, design, testing',
  },
  coding: {
    pl: 'Kodowanie',
    en: 'Coding',
  },
  technologies: {
    pl: 'Technologie',
    en: 'Technologies',
  },
  disclaimer: {
    pl: 'Qwirkle jest znakiem towarowym MindWare. Ta aplikacja jest niezależnym projektem hobbystycznym i nie jest powiązana z MindWare.',
    en: 'Qwirkle is a trademark of MindWare. This app is an independent hobby project and is not affiliated with MindWare.',
  },

  // ===== ScoreBoard =====
  tilesLeft: {
    pl: 'Pozostałe kafelki',
    en: 'Tiles left',
  },

  // ===== Game deletion =====
  deleteGame: {
    pl: 'Usuń grę',
    en: 'Delete game',
  },
  deleteGameConfirmTitle: {
    pl: 'Usunąć grę?',
    en: 'Delete game?',
  },
  deleteGameConfirmMsg: {
    pl: 'Ta gra zostanie oznaczona jako usunięta dla wszystkich graczy i zniknie z historii po 7 dniach.',
    en: 'This game will be marked as deleted for all players and will disappear from history after 7 days.',
  },
  deleteGameConfirmMsgPermanent: {
    pl: 'Ta gra z botem zostanie trwale usunięta z historii.',
    en: 'This bot game will be permanently deleted from history.',
  },
  deleteGameConfirm: {
    pl: 'Usuń',
    en: 'Delete',
  },
  gameDeletedBy: {
    pl: 'Usunięta przez',
    en: 'Deleted by',
  },
  gameDeletedOn: {
    pl: 'dnia',
    en: 'on',
  },
  gameDeleted: {
    pl: 'Gra usunięta',
    en: 'Game deleted',
  },
} as const;

export type TranslationKey = keyof typeof translations;
