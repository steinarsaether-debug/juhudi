/**
 * Offline-first IndexedDB layer using Dexie.js
 *
 * Stores:
 *  - pendingCustomers  : customer onboarding forms waiting for sync
 *  - pendingPhotos     : KYC / farm photos captured offline
 *  - farmSurveys       : GPS boundary surveys
 *  - healthAssessments : AI health assessment results cache
 *
 * Sensitive text fields are AES-GCM-256 encrypted before storage
 * using a key derived from the authenticated user's sub + a device salt.
 */

import Dexie, { type EntityTable } from 'dexie';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingCustomer {
  id?: number;              // local auto-increment key
  tempId: string;           // uuid assigned locally
  payload: string;          // JSON-stringified customer form (may be encrypted)
  encrypted: boolean;
  createdAt: string;
  syncAttempts: number;
  lastError?: string;
}

export interface PendingPhoto {
  id?: number;
  tempId: string;
  customerId?: string;      // if linked to existing customer
  pendingCustomerTempId?: string;
  purpose: 'KYC_ID' | 'KYC_SELFIE' | 'FARM' | 'CROP_HEALTH' | 'ANIMAL_HEALTH';
  dataUrl: string;          // JPEG data URL (already compressed by CameraCapture)
  gpsLat: number | null;
  gpsLng: number | null;
  capturedAt: string;
  syncAttempts: number;
  lastError?: string;
}

export interface FarmSurvey {
  id?: number;
  tempId: string;
  customerId?: string;
  pendingCustomerTempId?: string;
  waypoints: Array<{ lat: number; lng: number; timestamp: string }>;
  areaAcres: number | null;
  perimeterM: number | null;
  capturedAt: string;
  synced: boolean;
}

export interface HealthAssessmentCache {
  id?: number;
  tempId: string;
  customerId?: string;
  subjectType: string;
  county?: string;
  imageBase64: string;
  assessment: unknown;       // AI response
  cachedAt: string;
}

// ─── Dexie Database ───────────────────────────────────────────────────────────

export class JuhudiOfflineDb extends Dexie {
  pendingCustomers!: EntityTable<PendingCustomer, 'id'>;
  pendingPhotos!: EntityTable<PendingPhoto, 'id'>;
  farmSurveys!: EntityTable<FarmSurvey, 'id'>;
  healthAssessments!: EntityTable<HealthAssessmentCache, 'id'>;

  constructor() {
    super('juhudi-offline');
    this.version(1).stores({
      pendingCustomers:  '++id, tempId, createdAt',
      pendingPhotos:     '++id, tempId, purpose, customerId',
      farmSurveys:       '++id, tempId, customerId, synced',
      healthAssessments: '++id, tempId, customerId, subjectType',
    });
  }
}

export const db = new JuhudiOfflineDb();

// ─── Encryption helpers ───────────────────────────────────────────────────────

const DEVICE_SALT_KEY = 'juhudi-device-salt';

function getDeviceSalt(): Uint8Array {
  const stored = localStorage.getItem(DEVICE_SALT_KEY);
  if (stored) return new Uint8Array(JSON.parse(stored) as number[]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(DEVICE_SALT_KEY, JSON.stringify(Array.from(salt)));
  return salt;
}

async function deriveKey(userSub: string): Promise<CryptoKey> {
  const salt = getDeviceSalt();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(userSub),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encrypt(plaintext: string, userSub: string): Promise<string> {
  const key = await deriveKey(userSub);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(ciphertextB64: string, userSub: string): Promise<string> {
  const key = await deriveKey(userSub);
  const combined = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export async function savePendingCustomer(
  tempId: string,
  formData: Record<string, unknown>,
  userSub: string,
): Promise<void> {
  const json = JSON.stringify(formData);
  const payload = await encrypt(json, userSub);
  await db.pendingCustomers.add({
    tempId,
    payload,
    encrypted: true,
    createdAt: new Date().toISOString(),
    syncAttempts: 0,
  });
}

export async function getPendingCount(): Promise<number> {
  return db.pendingCustomers.count();
}
