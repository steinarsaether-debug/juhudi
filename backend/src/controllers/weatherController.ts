/**
 * Weather Controller
 *
 * Fetches 10-day agricultural forecasts from Open-Meteo (free, no API key).
 * Derives actionable alerts from weather thresholds calibrated for small-scale
 * Kenyan farming (flooding, drought stress, high winds, extreme heat).
 *
 * Results are cached in-memory for 1 hour to stay within the 10,000 calls/day
 * free-tier limit even with many concurrent dashboard users.
 */

import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';

// ── Types ────────────────────────────────────────────────────────────────────

export type AlertLevel = 'CRITICAL' | 'WARNING' | 'ADVISORY';

export interface WeatherAlert {
  level: AlertLevel;
  title: string;
  body: string;
  day: string | null; // ISO date this alert applies to, null = multi-day
}

export interface DayForecast {
  date: string;
  dayLabel: string;       // "Mon", "Tue" … "Today"
  tempMax: number;
  tempMin: number;
  precipMm: number;
  precipProbability: number;
  windSpeedKmh: number;
  gustKmh: number;
  et0Mm: number;
  sunshineDurationHrs: number;
  uvIndex: number;
  weatherCode: number;
  description: string;
  alertLevel: AlertLevel | null;
}

export interface BranchWeatherResponse {
  branchId: string;
  branchName: string;
  county: string;
  latitude: number;
  longitude: number;
  fetchedAt: string;
  alerts: WeatherAlert[];
  today: DayForecast;
  forecast: DayForecast[];  // 10 days including today
}

// ── In-memory cache (1 hour TTL) ─────────────────────────────────────────────

interface CacheEntry {
  data: BranchWeatherResponse;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

// ── WMO weather code → human description ─────────────────────────────────────

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Light showers', 81: 'Rain showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Heavy thunderstorm with hail',
};

function wmoDescription(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? 'Unknown';
}

// ── Alert derivation from thresholds ─────────────────────────────────────────
// Thresholds calibrated for smallholder Kenyan farming context.

function deriveAlerts(days: DayForecast[]): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  days.forEach(d => {
    const date = d.date;

    // CRITICAL — immediate safety / severe damage risk
    if (d.precipMm >= 50) {
      alerts.push({
        level: 'CRITICAL',
        title: 'Flash Flood Risk',
        body: `${Math.round(d.precipMm)} mm of rain expected — risk of flash flooding, soil erosion, and crop damage. Avoid low-lying areas and river crossings.`,
        day: date,
      });
    } else if (d.gustKmh >= 60) {
      alerts.push({
        level: 'CRITICAL',
        title: 'Severe Wind Warning',
        body: `Wind gusts up to ${Math.round(d.gustKmh)} km/h. Secure livestock shelters and lightweight structures. Suspend field spraying.`,
        day: date,
      });
    } else if (d.weatherCode >= 95) {
      alerts.push({
        level: 'CRITICAL',
        title: 'Thunderstorm with Hail',
        body: 'Hailstorm likely. Move livestock indoors, cover seedling trays, and postpone field visits.',
        day: date,
      });
    }

    // WARNING — significant risk, action recommended
    if (d.precipMm >= 25 && d.precipMm < 50) {
      alerts.push({
        level: 'WARNING',
        title: 'Heavy Rain Warning',
        body: `${Math.round(d.precipMm)} mm of rain forecast. Field visits and disbursements may be disrupted. Check farm drainage.`,
        day: date,
      });
    } else if (d.tempMax >= 37) {
      alerts.push({
        level: 'WARNING',
        title: 'Extreme Heat',
        body: `High of ${Math.round(d.tempMax)}°C — severe crop stress likely. Ensure irrigation where available; reschedule outdoor visits to early morning.`,
        day: date,
      });
    } else if (d.gustKmh >= 40 && d.gustKmh < 60) {
      alerts.push({
        level: 'WARNING',
        title: 'High Winds',
        body: `Gusts up to ${Math.round(d.gustKmh)} km/h. Protect tall crops and avoid aerial spraying.`,
        day: date,
      });
    }

    // ADVISORY — conditions to monitor
    if (d.et0Mm >= 7 && d.precipMm < 1) {
      alerts.push({
        level: 'ADVISORY',
        title: 'High Drought Stress',
        body: `Evapotranspiration ${d.et0Mm.toFixed(1)} mm/day with no rain. Irrigate if possible; watch for wilting in maize and beans.`,
        day: date,
      });
    } else if (d.tempMax >= 34 && d.tempMax < 37) {
      alerts.push({
        level: 'ADVISORY',
        title: 'Heat Stress',
        body: `High of ${Math.round(d.tempMax)}°C. Monitor crop water needs; consider shade netting for nurseries.`,
        day: date,
      });
    } else if (d.precipProbability >= 80 && d.precipMm >= 10) {
      alerts.push({
        level: 'ADVISORY',
        title: 'Rain Expected',
        body: `${d.precipProbability}% chance of ${Math.round(d.precipMm)} mm. Postpone soil-sensitive fieldwork.`,
        day: date,
      });
    }
  });

  // Dry spell: 4+ consecutive days with no rain and moderate ET0
  let dryRun = 0;
  let dryStart: string | null = null;
  for (const d of days) {
    if (d.precipMm < 1 && d.et0Mm >= 4) {
      if (dryRun === 0) dryStart = d.date;
      dryRun++;
    } else {
      dryRun = 0;
      dryStart = null;
    }
    if (dryRun === 4 && dryStart) {
      alerts.push({
        level: 'ADVISORY',
        title: 'Dry Spell',
        body: '4+ consecutive dry days with high evaporation. Monitor soil moisture; plan irrigation for rain-fed crops.',
        day: dryStart,
      });
      dryRun = 0; // don't repeat per-day
    }
  }

  // De-duplicate: keep highest-level alert per (day, title) pair
  const seen = new Set<string>();
  const deduped: WeatherAlert[] = [];
  const levelOrder: Record<AlertLevel, number> = { CRITICAL: 3, WARNING: 2, ADVISORY: 1 };

  // Sort descending by severity so highest level wins dedup
  alerts.sort((a, b) => levelOrder[b.level] - levelOrder[a.level]);
  for (const a of alerts) {
    const key = `${a.day}|${a.title}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(a);
    }
  }

  // Return sorted: CRITICAL first, then by date
  return deduped.sort((a, b) => {
    const lvl = levelOrder[b.level] - levelOrder[a.level];
    if (lvl !== 0) return lvl;
    return (a.day ?? '').localeCompare(b.day ?? '');
  });
}

// ── Open-Meteo fetch ──────────────────────────────────────────────────────────

interface OpenMeteoResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
    et0_fao_evapotranspiration: number[];
    sunshine_duration: number[];
    uv_index_max: number[];
    weather_code: number[];
  };
}

async function fetchOpenMeteo(lat: number, lon: number): Promise<OpenMeteoResponse> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'wind_gusts_10m_max',
      'et0_fao_evapotranspiration',
      'sunshine_duration',
      'uv_index_max',
      'weather_code',
    ].join(','),
    forecast_days: '10',
    timezone: 'Africa/Nairobi',
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm',
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!resp.ok) throw new Error(`Open-Meteo returned ${resp.status}`);
  return resp.json() as Promise<OpenMeteoResponse>;
}

// ── Assemble response ─────────────────────────────────────────────────────────

function buildResponse(
  branchId: string, branchName: string, county: string,
  lat: number, lon: number, raw: OpenMeteoResponse,
): BranchWeatherResponse {
  const d = raw.daily;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' }); // YYYY-MM-DD

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const forecast: DayForecast[] = d.time.map((date, i) => {
    const isToday = date === today;
    const dayOfWeek = dayLabels[new Date(date + 'T12:00:00').getDay()];
    const f: DayForecast = {
      date,
      dayLabel: isToday ? 'Today' : dayOfWeek,
      tempMax: Math.round(d.temperature_2m_max[i] ?? 0),
      tempMin: Math.round(d.temperature_2m_min[i] ?? 0),
      precipMm: Math.round((d.precipitation_sum[i] ?? 0) * 10) / 10,
      precipProbability: Math.round(d.precipitation_probability_max[i] ?? 0),
      windSpeedKmh: Math.round(d.wind_speed_10m_max[i] ?? 0),
      gustKmh: Math.round(d.wind_gusts_10m_max[i] ?? 0),
      et0Mm: Math.round((d.et0_fao_evapotranspiration[i] ?? 0) * 10) / 10,
      sunshineDurationHrs: Math.round(((d.sunshine_duration[i] ?? 0) / 3600) * 10) / 10,
      uvIndex: Math.round(d.uv_index_max[i] ?? 0),
      weatherCode: d.weather_code[i] ?? 0,
      description: wmoDescription(d.weather_code[i] ?? 0),
      alertLevel: null,
    };
    return f;
  });

  const alerts = deriveAlerts(forecast);

  // Tag each forecast day with its highest alert level
  const alertLevelByDay = new Map<string, AlertLevel>();
  const levelOrder: Record<AlertLevel, number> = { CRITICAL: 3, WARNING: 2, ADVISORY: 1 };
  for (const a of alerts) {
    if (a.day) {
      const existing = alertLevelByDay.get(a.day);
      if (!existing || levelOrder[a.level] > levelOrder[existing]) {
        alertLevelByDay.set(a.day, a.level);
      }
    }
  }
  for (const f of forecast) {
    f.alertLevel = alertLevelByDay.get(f.date) ?? null;
  }

  return {
    branchId,
    branchName,
    county,
    latitude: lat,
    longitude: lon,
    fetchedAt: new Date().toISOString(),
    alerts,
    today: forecast[0],
    forecast,
  };
}

// ── Controller ────────────────────────────────────────────────────────────────

export const getBranchWeather = asyncHandler(async (req: Request, res: Response) => {
  const { branchId } = req.params;

  const cached = cache.get(branchId);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.data);
    return;
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) { res.status(404).json({ error: 'Branch not found' }); return; }

  if (!branch.latitude || !branch.longitude) {
    res.status(422).json({ error: 'Branch has no coordinates configured' });
    return;
  }

  const raw = await fetchOpenMeteo(branch.latitude, branch.longitude);
  const data = buildResponse(branch.id, branch.name, branch.county, branch.latitude, branch.longitude, raw);

  cache.set(branchId, { data, expiresAt: Date.now() + 60 * 60 * 1000 });
  res.json(data);
});

/**
 * GET /api/weather/branches — returns weather for all active branches with coordinates.
 * Runs all fetches in parallel; skips branches without coordinates.
 */
export const getAllBranchWeather = asyncHandler(async (_req: Request, res: Response) => {
  const branches = await prisma.branch.findMany({
    where: { isActive: true, NOT: [{ latitude: null }, { longitude: null }] },
  });

  const results = await Promise.allSettled(
    branches.map(async (b): Promise<BranchWeatherResponse> => {
      const cached = cache.get(b.id);
      if (cached && cached.expiresAt > Date.now()) return cached.data;

      const raw = await fetchOpenMeteo(b.latitude!, b.longitude!);
      const data = buildResponse(b.id, b.name, b.county, b.latitude!, b.longitude!, raw);
      cache.set(b.id, { data, expiresAt: Date.now() + 60 * 60 * 1000 });
      return data;
    }),
  );

  const weather = results
    .filter((r): r is PromiseFulfilledResult<BranchWeatherResponse> => r.status === 'fulfilled')
    .map((r: PromiseFulfilledResult<BranchWeatherResponse>) => r.value);

  res.json(weather);
});
