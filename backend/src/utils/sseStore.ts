/**
 * SSE (Server-Sent Events) subscription registry.
 *
 * Two registries:
 *  - sessionStreams: broadcasts live BCC session events to all viewers of that session
 *  - No user-level registry needed — notification badge uses 30s polling
 *
 * EventSource cannot set Authorization headers, so the JWT is passed as
 * `?token=<jwt>` and validated directly in the stream handler.
 */
import type { Response } from 'express';

/** Per-session subscriber set */
const sessionStreams = new Map<string, Set<Response>>();

/** Heartbeat intervals keyed by sessionId — one ping per session (not per client) */
const heartbeatIntervals = new Map<string, ReturnType<typeof setInterval>>();

export function subscribeSession(sessionId: string, res: Response): void {
  if (!sessionStreams.has(sessionId)) {
    sessionStreams.set(sessionId, new Set());
  }
  const subscribers = sessionStreams.get(sessionId)!;
  subscribers.add(res);

  // Start heartbeat when first subscriber connects
  if (!heartbeatIntervals.has(sessionId)) {
    const interval = setInterval(() => {
      broadcastToSession(sessionId, 'ping', { ts: Date.now() });
    }, 25_000);
    heartbeatIntervals.set(sessionId, interval);
  }

  // Clean up on client disconnect
  res.on('close', () => {
    subscribers.delete(res);
    if (subscribers.size === 0) {
      sessionStreams.delete(sessionId);
      const hb = heartbeatIntervals.get(sessionId);
      if (hb) {
        clearInterval(hb);
        heartbeatIntervals.delete(sessionId);
      }
    }
  });
}

export function broadcastToSession(sessionId: string, event: string, data: unknown): void {
  const subscribers = sessionStreams.get(sessionId);
  if (!subscribers || subscribers.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of subscribers) {
    try {
      res.write(payload);
    } catch {
      // Client disconnected mid-write — the 'close' handler will clean up
    }
  }
}
