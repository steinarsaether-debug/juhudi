import { useQuery } from '@tanstack/react-query';
import { MapPin, RefreshCw, Navigation, Clock } from 'lucide-react';
import { adminApi } from '../../services/api';
import { LoLocation } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function statusDot(lo: LoLocation): { color: string; label: string } {
  if (!lo.lastPing) return { color: 'bg-gray-300', label: 'No data' };
  const mins = (Date.now() - new Date(lo.lastPing.createdAt).getTime()) / 60_000;
  if (mins < 30)  return { color: 'bg-green-400 animate-pulse', label: 'Active' };
  if (mins < 240) return { color: 'bg-yellow-400',              label: 'Idle' };
  return              { color: 'bg-gray-300',                   label: 'Offline' };
}

function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}&z=15`;
}

export default function AdminLocations() {
  const { data: officers, isLoading, refetch, dataUpdatedAt } = useQuery<LoLocation[]>({
    queryKey: ['adminLocations'],
    queryFn:  () => adminApi.getLocations(),
    staleTime: 120_000,
    refetchInterval: 120_000, // auto-refresh every 2 min
  });

  const active  = (officers ?? []).filter(o => o.lastPing && (Date.now() - new Date(o.lastPing.createdAt).getTime()) < 30 * 60_000);
  const idle    = (officers ?? []).filter(o => o.lastPing && (Date.now() - new Date(o.lastPing.createdAt).getTime()) >= 30 * 60_000);
  const missing = (officers ?? []).filter(o => !o.lastPing);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">LO Locations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Last updated {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-KE') : '—'}
          </p>
        </div>
        <button className="btn-secondary" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { label: 'Active (< 30 min)', count: active.length,  color: 'bg-green-50 border-green-200 text-green-700' },
          { label: 'Idle (30 min – 4 h)', count: idle.length, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
          { label: 'No data',            count: missing.length, color: 'bg-gray-50 border-gray-200 text-gray-500' },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm ${s.color}`}>
            <span className="font-bold text-lg leading-none">{s.count}</span>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Status', 'Loan Officer', 'Branch', 'Last Seen', 'Coordinates', 'Accuracy', 'Activity', 'Map'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(officers ?? []).map(lo => {
                const { color, label } = statusDot(lo);
                const p = lo.lastPing;
                return (
                  <tr key={lo.userId} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />
                        <span className="text-xs text-gray-500">{label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{lo.name}</td>
                    <td className="px-4 py-3 text-gray-600">{lo.branch}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p ? (
                        <div className="flex items-center gap-1 text-gray-600">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          {timeAgo(p.createdAt)}
                        </div>
                      ) : <span className="text-gray-300">Never</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {p ? (
                        <span className="text-gray-600">
                          {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {p?.accuracy ? `±${Math.round(p.accuracy)} m` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p?.activity?.replace(/_/g, ' ') ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {p ? (
                        <a
                          href={googleMapsUrl(p.latitude, p.longitude)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 font-medium"
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          View
                        </a>
                      ) : <span className="text-gray-300 text-xs flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> —</span>}
                    </td>
                  </tr>
                );
              })}
              {!officers?.length && (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">No Loan Officers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400 flex items-center gap-1">
        <MapPin className="h-3.5 w-3.5" />
        Locations are submitted automatically by the LO app every 30 minutes while active. The map link opens Google Maps.
      </p>
    </div>
  );
}
