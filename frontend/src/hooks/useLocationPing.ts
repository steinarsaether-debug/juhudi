/**
 * Auto-pings the backend with the user's GPS coordinates every PING_INTERVAL ms.
 * Only fires for authenticated users when geolocation is available.
 * Skips if last ping was within PING_INTERVAL (stored in localStorage).
 */
import { useEffect } from 'react';
import { adminApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

const PING_INTERVAL_MS = 30 * 60 * 1_000; // 30 minutes
const LS_KEY = 'jk_last_location_ping';

export function useLocationPing(activity?: string) {
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (!navigator.geolocation) return;

    const lastPingStr = localStorage.getItem(LS_KEY);
    if (lastPingStr) {
      const lastPing = parseInt(lastPingStr, 10);
      if (Date.now() - lastPing < PING_INTERVAL_MS) return; // too soon
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        adminApi
          .pingLocation({
            latitude:  pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy:  pos.coords.accuracy,
            activity:  activity ?? 'APP',
          })
          .then(() => localStorage.setItem(LS_KEY, String(Date.now())))
          .catch(() => { /* silently ignore — non-critical */ });
      },
      () => { /* permission denied or unavailable – ignore */ },
      { timeout: 10_000, maximumAge: 60_000 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);
}
