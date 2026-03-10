/**
 * WeatherWidget
 *
 * Compact dashboard card showing:
 * - Current day conditions (temp, rain chance, wind, ET0)
 * - Active alert banners (CRITICAL → WARNING → ADVISORY)
 * - 10-day forecast strip with color-coded alert dots
 *
 * Data source: Open-Meteo via /api/weather/branches/:branchId
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CloudRain, Wind, Droplets, Sun,
  AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp,
} from 'lucide-react';
import { weatherApi } from '../../services/api';
import type { BranchWeatherResponse, WeatherAlert, DayForecast } from './weatherTypes';

// ── WMO code → emoji icon ────────────────────────────────────────────────────

function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

// ── Alert level styles ────────────────────────────────────────────────────────

const ALERT_STYLES: Record<string, { banner: string; dot: string; icon: typeof AlertTriangle }> = {
  CRITICAL: { banner: 'bg-red-50 border-red-300 text-red-800',   dot: 'bg-red-500',    icon: AlertCircle },
  WARNING:  { banner: 'bg-orange-50 border-orange-300 text-orange-800', dot: 'bg-orange-400', icon: AlertTriangle },
  ADVISORY: { banner: 'bg-yellow-50 border-yellow-200 text-yellow-800', dot: 'bg-yellow-400', icon: Info },
};

// ── Alert banner ──────────────────────────────────────────────────────────────

function AlertBanner({ alert, dateLabel }: { alert: WeatherAlert; dateLabel: string }) {
  const s = ALERT_STYLES[alert.level];
  const Icon = s.icon;
  return (
    <div className={`flex gap-2 px-3 py-2 rounded-lg border text-xs ${s.banner}`}>
      <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <span className="font-semibold">{alert.title}</span>
        {alert.day && <span className="ml-1 font-normal opacity-70">· {dateLabel}</span>}
        <span className="ml-1">— {alert.body}</span>
      </div>
    </div>
  );
}

// ── Day column in forecast strip ──────────────────────────────────────────────

function ForecastDay({ day }: { day: DayForecast }) {
  const alertDot = day.alertLevel ? ALERT_STYLES[day.alertLevel].dot : null;
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0 flex-1">
      <span className="text-xs text-gray-500 truncate">{day.dayLabel}</span>
      <span className="text-base leading-none">{weatherEmoji(day.weatherCode)}</span>
      <span className="text-xs font-semibold text-gray-800">{day.tempMax}°</span>
      <span className="text-xs text-gray-400">{day.tempMin}°</span>
      {day.precipProbability >= 20 ? (
        <span className="text-xs text-blue-500">{day.precipProbability}%</span>
      ) : (
        <span className="text-xs text-gray-300">—</span>
      )}
      {alertDot ? (
        <div className={`h-1.5 w-1.5 rounded-full ${alertDot}`} title={day.alertLevel ?? ''} />
      ) : (
        <div className="h-1.5 w-1.5" />
      )}
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

interface WeatherWidgetProps {
  branchId: string;
  branchName?: string;
  /** If false, only shows alert strip (compact mode for non-BM users) */
  showForecast?: boolean;
}

export default function WeatherWidget({ branchId, branchName, showForecast = true }: WeatherWidgetProps) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error } = useQuery<BranchWeatherResponse>({
    queryKey: ['weather', branchId],
    queryFn: () => weatherApi.getBranchWeather(branchId),
    staleTime: 30 * 60 * 1000,   // 30 min — data changes slowly
    refetchInterval: 60 * 60 * 1000, // re-fetch every hour
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-32 mb-2" />
        <div className="h-8 bg-gray-100 rounded w-20" />
      </div>
    );
  }

  if (error || !data) return null; // fail silently — weather is supplementary

  const today = data.today;
  const criticalAlerts = data.alerts.filter(a => a.level === 'CRITICAL');
  const otherAlerts    = data.alerts.filter(a => a.level !== 'CRITICAL');
  const visibleAlerts  = expanded ? data.alerts : [...criticalAlerts, ...otherAlerts.slice(0, 1)];
  const hasMoreAlerts  = data.alerts.length > visibleAlerts.length;

  // Format a day's date string as short readable label
  function dayLabel(isoDate: string | null): string {
    if (!isoDate) return '';
    const d = new Date(isoDate + 'T12:00:00');
    return d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-xl">{weatherEmoji(today.weatherCode)}</span>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {branchName ?? data.branchName} Weather
            </p>
            <p className="text-xs text-gray-400">{data.county} County</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900 leading-none">{today.tempMax}°C</p>
          <p className="text-xs text-gray-400">Low {today.tempMin}°C</p>
        </div>
      </div>

      {/* Today's conditions strip */}
      <div className="flex gap-4 px-4 py-2 text-xs text-gray-600 border-b border-gray-50">
        <span className="flex items-center gap-1">
          <CloudRain className="h-3 w-3 text-blue-400" />
          {today.precipProbability}% · {today.precipMm} mm
        </span>
        <span className="flex items-center gap-1">
          <Wind className="h-3 w-3 text-gray-400" />
          {today.windSpeedKmh} km/h
        </span>
        <span className="flex items-center gap-1">
          <Droplets className="h-3 w-3 text-green-400" />
          ET₀ {today.et0Mm} mm
        </span>
        {today.uvIndex >= 8 && (
          <span className="flex items-center gap-1 text-orange-600">
            <Sun className="h-3 w-3" />
            UV {today.uvIndex}
          </span>
        )}
        <span className="ml-auto text-gray-400">{today.description}</span>
      </div>

      {/* Alert banners */}
      {data.alerts.length > 0 && (
        <div className="px-3 pt-2 pb-1 space-y-1.5">
          {visibleAlerts.map((a, i) => (
            <AlertBanner key={i} alert={a} dateLabel={dayLabel(a.day)} />
          ))}
          {(hasMoreAlerts || expanded) && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 pl-1"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Show less' : `${data.alerts.length - visibleAlerts.length} more alert${data.alerts.length - visibleAlerts.length > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}

      {/* 10-day forecast strip */}
      {showForecast && (
        <div className="flex gap-1 px-3 py-2 border-t border-gray-50 overflow-x-auto">
          {data.forecast.map(day => (
            <ForecastDay key={day.date} day={day} />
          ))}
        </div>
      )}

      <div className="px-4 pb-2 text-right">
        <span className="text-[10px] text-gray-300">Open-Meteo · {new Date(data.fetchedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}

// ── Compact alert-only strip (for dashboard top) ──────────────────────────────

export function WeatherAlertStrip({ branchId }: { branchId: string }) {
  const { data } = useQuery<BranchWeatherResponse>({
    queryKey: ['weather', branchId],
    queryFn: () => weatherApi.getBranchWeather(branchId),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: 1,
  });

  const important = (data?.alerts ?? []).filter(a => a.level === 'CRITICAL' || a.level === 'WARNING');
  if (!important.length) return null;

  function dayLabel(isoDate: string | null): string {
    if (!isoDate) return '';
    const d = new Date(isoDate + 'T12:00:00');
    return d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  return (
    <div className="space-y-1.5 mb-4">
      {important.map((a, i) => {
        const s = ALERT_STYLES[a.level];
        const Icon = s.icon;
        return (
          <div key={i} className={`flex gap-2 px-4 py-2.5 rounded-xl border text-sm ${s.banner}`}>
            <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold">{a.title}</span>
              {a.day && <span className="ml-1 font-normal opacity-70">· {dayLabel(a.day)}</span>}
              <span className="ml-1">— {a.body}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Compact multi-branch weather badge (for admin dashboard) ─────────────────
// Shows CRITICAL + WARNING counts as stat-card badges linking to /admin/branches.

export function AllBranchWeatherBadge() {
  const { data: allWeather } = useQuery<BranchWeatherResponse[]>({
    queryKey: ['weather', 'all'],
    queryFn: weatherApi.getAllBranchWeather,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: 1,
  });

  if (!allWeather?.length) return null;

  let critical = 0;
  let warning = 0;
  let affectedBranches = 0;

  for (const b of allWeather) {
    const hasCritical = b.alerts.some(a => a.level === 'CRITICAL');
    const hasWarning  = b.alerts.some(a => a.level === 'WARNING');
    if (hasCritical || hasWarning) affectedBranches++;
    critical += b.alerts.filter(a => a.level === 'CRITICAL').length;
    warning  += b.alerts.filter(a => a.level === 'WARNING').length;
  }

  if (critical === 0 && warning === 0) return null;

  return (
    <Link to="/admin/branches" className="block">
      <div className="card p-5 hover:shadow-md transition-shadow border-l-4 border-red-400">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500">Weather Alerts</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{affectedBranches} branch{affectedBranches !== 1 ? 'es' : ''}</p>
            <div className="flex gap-3 mt-1.5">
              {critical > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                  <AlertCircle className="h-3 w-3" />
                  {critical} critical
                </span>
              )}
              {warning > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="h-3 w-3" />
                  {warning} warning{warning !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <div className="rounded-lg p-2.5 bg-red-50 text-red-700">
            <CloudRain className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Link>
  );
}
