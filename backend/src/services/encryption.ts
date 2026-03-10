/**
 * AES-256-GCM field-level encryption for PII data.
 * Kenya Data Protection Act 2019 – sensitive personal data must be protected.
 *
 * Format stored in DB: base64(iv:authTag:ciphertext)  (all hex-encoded parts
 * concatenated with colons, then base64-encoded for safe storage).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;   // bytes

function getMasterKey(): Buffer {
  return Buffer.from(config.ENCRYPTION_KEY, 'hex');
}

/**
 * Derive a per-field deterministic IV for searchable fields (e.g. phone hash).
 * For non-searchable fields, use random IV.
 */
export function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Store as: base64(hex_iv + ":" + hex_tag + ":" + hex_ciphertext)
  const combined = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  return Buffer.from(combined).toString('base64');
}

export function decrypt(encryptedValue: string): string {
  try {
    const combined = Buffer.from(encryptedValue, 'base64').toString('utf8');
    const [ivHex, tagHex, ciphertextHex] = combined.split(':');

    if (!ivHex || !tagHex || !ciphertextHex) {
      throw new Error('Invalid encrypted value format');
    }

    const key = getMasterKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error('Decryption failed – data may be corrupted or key is incorrect');
  }
}

/**
 * One-way hash for deduplication lookups (phone, national ID).
 * Uses HMAC-SHA256 with the ENCRYPTION_IV_KEY as pepper.
 */
export function hashForLookup(value: string): string {
  const pepper = config.ENCRYPTION_IV_KEY;
  return createHash('sha256')
    .update(pepper + value.trim().toLowerCase())
    .digest('hex');
}

/**
 * Mask a value for display / logging – shows only first 3 and last 2 chars.
 * e.g. "12345678" → "123***78"
 */
export function maskSensitive(value: string): string {
  if (value.length <= 5) return '***';
  return value.slice(0, 3) + '***' + value.slice(-2);
}
