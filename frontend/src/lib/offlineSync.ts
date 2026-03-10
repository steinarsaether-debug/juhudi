/**
 * Sync pending offline records to the server when connectivity is restored.
 * Called from OfflineIndicator on 'online' event and on app startup.
 */

import { db, decrypt } from './offlineDb';

const API_URL = (import.meta as unknown as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? '';
const apiBase = `${API_URL}/api`;

export interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

export async function syncPendingCustomers(
  token: string,
  userSub: string,
): Promise<SyncResult> {
  const pending = await db.pendingCustomers.toArray();
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const record of pending) {
    try {
      const json = record.encrypted
        ? await decrypt(record.payload, userSub)
        : record.payload;
      const payload = JSON.parse(json) as Record<string, unknown>;

      const res = await fetch(`${apiBase}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await db.pendingCustomers.delete(record.id!);
        synced++;
      } else {
        const msg = `Customer ${record.tempId}: HTTP ${res.status}`;
        errors.push(msg);
        await db.pendingCustomers.update(record.id!, {
          syncAttempts: record.syncAttempts + 1,
          lastError: msg,
        });
        failed++;
      }
    } catch (err: unknown) {
      const msg = `Customer ${record.tempId}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      await db.pendingCustomers.update(record.id!, {
        syncAttempts: record.syncAttempts + 1,
        lastError: msg,
      });
      failed++;
    }
  }

  return { synced, failed, errors };
}

export async function syncAll(token: string, userSub: string): Promise<SyncResult> {
  if (!navigator.onLine) return { synced: 0, failed: 0, errors: ['Offline'] };
  return syncPendingCustomers(token, userSub);
}
