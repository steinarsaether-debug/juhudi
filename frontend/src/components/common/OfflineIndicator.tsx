import { useEffect, useState, useCallback } from 'react';
import { WifiOff, Wifi, RefreshCw, CheckCircle } from 'lucide-react';
import { getPendingCount } from '../../lib/offlineDb';
import { syncAll } from '../../lib/offlineSync';
import { useAuthStore } from '../../store/authStore';

export default function OfflineIndicator() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncMsg, setLastSyncMsg] = useState<string | null>(null);
  const { token, user } = useAuthStore();

  const refreshCount = useCallback(async () => {
    setPendingCount(await getPendingCount());
  }, []);

  const handleSync = useCallback(async () => {
    if (!token || !user?.id || syncing) return;
    setSyncing(true);
    setLastSyncMsg(null);
    try {
      const result = await syncAll(token, user.id);
      await refreshCount();
      if (result.synced > 0) {
        setLastSyncMsg(`✓ ${result.synced} record${result.synced > 1 ? 's' : ''} synced`);
      } else if (result.failed > 0) {
        setLastSyncMsg(`⚠ ${result.failed} failed`);
      } else {
        setLastSyncMsg('Nothing pending');
      }
    } finally {
      setSyncing(false);
      setTimeout(() => setLastSyncMsg(null), 4000);
    }
  }, [token, user, syncing, refreshCount]);

  useEffect(() => {
    const goOnline = async () => {
      setOnline(true);
      await refreshCount();
      // Auto-sync when reconnected
      if (token && user?.id) {
        await handleSync();
      }
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    refreshCount();
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [refreshCount, handleSync, token, user]);

  // Only show when offline or there are pending records
  if (online && pendingCount === 0 && !lastSyncMsg) return null;

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full px-4 py-2 text-sm shadow-lg transition-all ${
        !online
          ? 'bg-gray-800 text-white'
          : pendingCount > 0
          ? 'bg-yellow-500 text-white'
          : 'bg-green-500 text-white'
      }`}
    >
      {!online ? (
        <WifiOff className="h-4 w-4 flex-shrink-0" />
      ) : pendingCount > 0 ? (
        <Wifi className="h-4 w-4 flex-shrink-0" />
      ) : (
        <CheckCircle className="h-4 w-4 flex-shrink-0" />
      )}

      {!online && <span>Offline mode</span>}
      {online && pendingCount > 0 && (
        <>
          <span>{pendingCount} pending</span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="ml-1 flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs hover:bg-white/30 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </>
      )}
      {lastSyncMsg && <span>{lastSyncMsg}</span>}
    </div>
  );
}
