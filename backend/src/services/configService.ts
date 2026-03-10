/**
 * System Configuration Service
 *
 * Single source of truth for all tunable business constants.
 * Values are stored in `system_configs` (Postgres) and cached in-memory
 * with a 5-minute TTL so scoring stays fast while still picking up edits.
 *
 * Usage (synchronous after initialization):
 *   const cfg = configService;
 *   const threshold = cfg.num('scoring.group.approve_threshold');   // 70
 *   const rate      = cfg.pct('scoring.group.monthly_rate');        // 0.015
 */
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { CONFIG_DEFAULTS } from './configDefaults';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class ConfigService {
  private cache = new Map<string, string>();
  private lastRefresh = 0;
  private refreshPromise: Promise<void> | null = null;

  /** Load / refresh all configs from the database. */
  async refresh(): Promise<void> {
    try {
      const rows = await prisma.systemConfig.findMany({ select: { key: true, value: true } });
      const next = new Map<string, string>();
      for (const r of rows) next.set(r.key, r.value);
      this.cache = next;
      this.lastRefresh = Date.now();
    } catch (err) {
      logger.error('ConfigService: refresh failed – using cached/defaults', { err });
    }
  }

  /** Call once at server startup. */
  async initialize(): Promise<void> {
    await this.refresh();
    logger.info(`ConfigService: loaded ${this.cache.size} config keys`);
  }

  /** Background refresh (non-blocking) if TTL has expired. */
  private maybeTriggerRefresh(): void {
    if (Date.now() - this.lastRefresh < CACHE_TTL_MS) return;
    if (this.refreshPromise) return;
    this.refreshPromise = this.refresh().finally(() => { this.refreshPromise = null; });
  }

  /** Raw string value; falls back to CONFIG_DEFAULTS, then throws. */
  raw(key: string): string {
    this.maybeTriggerRefresh();
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const def = CONFIG_DEFAULTS[key];
    if (def !== undefined) return String(def);
    throw new Error(`ConfigService: unknown key "${key}"`);
  }

  /** Parse as plain number. */
  num(key: string): number {
    const v = parseFloat(this.raw(key));
    if (isNaN(v)) throw new Error(`ConfigService: "${key}" is not a number`);
    return v;
  }

  /**
   * Parse as percentage stored as a whole number (e.g. "18" → 0.18).
   * Use this for PERCENTAGE-typed configs.
   */
  pct(key: string): number {
    return this.num(key) / 100;
  }

  /** Integer. */
  int(key: string): number {
    return Math.round(this.num(key));
  }

  /** Boolean ("true" / "false"). */
  bool(key: string): boolean {
    return this.raw(key).toLowerCase() === 'true';
  }

  /**
   * Convenience: return a plain object of multiple numeric keys.
   * Keys are the last segment of each dot-path.
   */
  group<K extends string>(keys: Record<K, string>): Record<K, number> {
    const result = {} as Record<K, number>;
    for (const [alias, key] of Object.entries(keys) as [K, string][]) {
      result[alias] = this.num(key);
    }
    return result;
  }
}

export const configService = new ConfigService();
