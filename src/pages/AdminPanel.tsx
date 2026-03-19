import { useState, useEffect } from 'react';
import {
  adminClearLeaderboard,
  adminDeleteAllFinishedGames,
  adminGetActiveRooms,
  adminUpdatePlayerNickInRoom,
  ActiveRoomInfo,
} from '../firebase/gameService';
import { useTranslation } from '../i18n/LanguageContext';
import { cn } from '../utils/cn';
import { ArrowLeft, Trash2, Trophy, Users, Pencil, AlertTriangle, Check, Loader2 } from 'lucide-react';

interface AdminPanelProps {
  onBack: () => void;
}

export function AdminPanel({ onBack }: AdminPanelProps) {
  const { t } = useTranslation();

  // --- State ---
  const [activeRooms, setActiveRooms] = useState<ActiveRoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Nick editing
  const [editingPlayer, setEditingPlayer] = useState<{ roomCode: string; playerId: string; currentNick: string } | null>(null);
  const [nickInput, setNickInput] = useState('');

  // Confirmation dialogs
  const [confirmAction, setConfirmAction] = useState<'leaderboard' | 'games' | null>(null);

  useEffect(() => {
    loadActiveRooms();
  }, []);

  async function loadActiveRooms() {
    setLoading(true);
    try {
      const rooms = await adminGetActiveRooms();
      setActiveRooms(rooms);
    } catch (e) {
      console.error('Error loading active rooms:', e);
    } finally {
      setLoading(false);
    }
  }

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleClearLeaderboard() {
    setActionLoading('leaderboard');
    setConfirmAction(null);
    try {
      await adminClearLeaderboard();
      showMessage('success', t('adminLeaderboardCleared'));
    } catch (e: any) {
      showMessage('error', e.message || 'Error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteFinishedGames() {
    setActionLoading('games');
    setConfirmAction(null);
    try {
      const result = await adminDeleteAllFinishedGames();
      showMessage('success', t('adminGamesDeleted').replace('{history}', String(result.deletedHistory)).replace('{sessions}', String(result.deletedSessions)));
    } catch (e: any) {
      showMessage('error', e.message || 'Error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSaveNick() {
    if (!editingPlayer) return;
    setActionLoading(`nick-${editingPlayer.playerId}`);
    try {
      await adminUpdatePlayerNickInRoom(editingPlayer.roomCode, editingPlayer.playerId, nickInput);
      showMessage('success', t('adminNickUpdated'));
      setEditingPlayer(null);
      await loadActiveRooms();
    } catch (e: any) {
      showMessage('error', e.message || 'Error');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="font-display font-bold text-xl">{t('adminTitle')}</h2>
          <p className="text-xs text-muted-foreground">{t('adminSubtitle')}</p>
        </div>
      </div>

      {/* Status message */}
      {message && (
        <div className={cn(
          'p-3 rounded-lg text-sm flex items-center gap-2',
          message.type === 'success' ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-destructive/10 text-destructive',
        )}>
          {message.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          {message.text}
        </div>
      )}

      {/* Section 1: Clear Leaderboard */}
      <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-yellow-500" />
          <h3 className="font-semibold text-sm">{t('adminClearLeaderboard')}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{t('adminClearLeaderboardDesc')}</p>
        <button
          onClick={() => setConfirmAction('leaderboard')}
          disabled={actionLoading !== null}
          className="w-full py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {actionLoading === 'leaderboard' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          {t('adminClearLeaderboardBtn')}
        </button>
      </div>

      {/* Section 2: Delete All Finished Games */}
      <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Trash2 size={18} className="text-red-500" />
          <h3 className="font-semibold text-sm">{t('adminDeleteGames')}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{t('adminDeleteGamesDesc')}</p>
        <button
          onClick={() => setConfirmAction('games')}
          disabled={actionLoading !== null}
          className="w-full py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {actionLoading === 'games' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          {t('adminDeleteGamesBtn')}
        </button>
      </div>

      {/* Section 3: Active Games — Nick Editing */}
      <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-blue-500" />
          <h3 className="font-semibold text-sm">{t('adminActiveGames')}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{t('adminActiveGamesDesc')}</p>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : activeRooms.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-4">
            {t('adminNoActiveGames')}
          </div>
        ) : (
          <div className="space-y-3">
            {activeRooms.map((room) => (
              <div key={room.roomCode} className="bg-muted/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs text-muted-foreground">{room.roomCode}</div>
                  <div className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    room.phase === 'playing' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                    room.phase === 'waiting' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                    'bg-muted text-muted-foreground',
                  )}>
                    {room.phase}
                  </div>
                </div>
                <div className="space-y-1">
                  {room.players.map((player) => (
                    <div key={player.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className={cn('truncate', player.isAI && 'text-muted-foreground italic')}>
                        {player.nickname}
                        {player.isAI && ' 🤖'}
                      </span>
                      {!player.isAI && (
                        <button
                          onClick={() => {
                            setEditingPlayer({ roomCode: room.roomCode, playerId: player.id, currentNick: player.nickname });
                            setNickInput(player.nickname);
                          }}
                          className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
                          title={t('adminEditNick')}
                        >
                          <Pencil size={14} className="text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={loadActiveRooms}
          disabled={loading}
          className="w-full py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          {t('adminRefresh')}
        </button>
      </div>

      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl border border-border p-5 max-w-sm w-full shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={20} />
              <h3 className="font-display font-bold text-lg">{t('adminConfirmTitle')}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {confirmAction === 'leaderboard' ? t('adminConfirmLeaderboard') : t('adminConfirmGames')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={confirmAction === 'leaderboard' ? handleClearLeaderboard : handleDeleteFinishedGames}
                className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-all"
              >
                {t('adminConfirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nick edit modal */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl border border-border p-5 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="font-display font-bold text-lg">{t('adminEditNickTitle')}</h3>
            <p className="text-xs text-muted-foreground">
              {t('adminEditNickRoom')}: <span className="font-mono">{editingPlayer.roomCode}</span>
            </p>
            <input
              type="text"
              value={nickInput}
              onChange={e => setNickInput(e.target.value)}
              maxLength={16}
              placeholder={t('nickPlaceholder')}
              className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSaveNick()}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setEditingPlayer(null)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSaveNick}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading?.startsWith('nick-') ? <Loader2 size={16} className="animate-spin" /> : null}
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
