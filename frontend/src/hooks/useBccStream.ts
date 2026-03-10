import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

interface BccStreamHandlers {
  onVote?: (data: unknown) => void;
  onComment?: (data: unknown) => void;
  onFlag?: (data: unknown) => void;
  onFlagResolved?: (data: unknown) => void;
  onCondition?: (data: unknown) => void;
  onNarrativeUpdated?: (data: unknown) => void;
  onPresenting?: (data: unknown) => void;
  onMeetingActivated?: (data: unknown) => void;
  onClosed?: (data: unknown) => void;
}

/**
 * Opens an SSE connection to /api/bcc/:sessionId/stream.
 * JWT is passed as ?token= because EventSource cannot set Authorization headers.
 *
 * Falls back gracefully if connection drops — React Query refetchInterval:15000
 * ensures data stays fresh even without SSE.
 */
export function useBccStream(sessionId: string | undefined, handlers: BccStreamHandlers) {
  useEffect(() => {
    if (!sessionId) return;

    const token = useAuthStore.getState().token;
    if (!token) return;

    const url = `/api/bcc/${sessionId}/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    const listen = (event: string, handler?: (data: unknown) => void) => {
      if (!handler) return;
      es.addEventListener(event, (e: MessageEvent) => {
        try {
          handler(JSON.parse(e.data));
        } catch {
          // ignore parse errors
        }
      });
    };

    listen('vote',              handlers.onVote);
    listen('comment',           handlers.onComment);
    listen('flag',              handlers.onFlag);
    listen('flag_resolved',     handlers.onFlagResolved);
    listen('condition',         handlers.onCondition);
    listen('narrative_updated', handlers.onNarrativeUpdated);
    listen('presenting',        handlers.onPresenting);
    listen('meeting_activated', handlers.onMeetingActivated);
    listen('session_closed',    handlers.onClosed);

    es.onerror = () => {
      // SSE dropped — React Query polling will maintain data freshness
      es.close();
    };

    return () => {
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);
}
