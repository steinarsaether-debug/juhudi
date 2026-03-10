import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart2, TrendingUp, AlertTriangle } from 'lucide-react';
import { bccApi } from '../../services/api';

const CATEGORY_LABELS: Record<string, string> = {
  REPAYMENT_CAPACITY: 'Repayment Capacity',
  PURPOSE_RISK: 'Purpose Risk',
  CHARACTER_CONCERN: 'Character',
  SECTOR_RISK: 'Sector Risk',
  COLLATERAL_WEAKNESS: 'Collateral',
  DATA_QUALITY: 'Data Quality',
  OTHER: 'Other',
};

function RateBar({ rate }: { rate: number }) {
  const color = rate >= 70 ? 'bg-red-500' : rate >= 40 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${rate}%` }} />
      </div>
      <span className="text-sm font-semibold w-10 text-right">{rate}%</span>
    </div>
  );
}

export default function BccAnalytics() {
  const [months, setMonths] = useState(6);

  const { data, isLoading } = useQuery({
    queryKey: ['bcc-flag-accuracy', months],
    queryFn: () => bccApi.getFlagAccuracy({ months }),
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-blue-600" /> BCC Flag Accuracy
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tracks whether committee concerns predicted actual loan performance
          </p>
        </div>
        <select
          value={months}
          onChange={e => setMonths(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
          <option value={24}>Last 24 months</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-gray-400 py-8 text-center">Loading analytics...</div>
      ) : !data ? (
        <div className="text-gray-400 py-8 text-center">No data available</div>
      ) : (
        <>
          {/* Summary */}
          <div className="bg-white rounded-xl border p-4 mb-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{data.totalFlags}</p>
                <p className="text-sm text-gray-500">total flags with recorded outcomes ({data.periodMonths}m period)</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Category */}
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" /> By Flag Category
              </h2>
              {Object.keys(data.byCategory ?? {}).length === 0 ? (
                <p className="text-sm text-gray-400 italic">No data yet</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(data.byCategory as Record<string, { total: number; materialized: number; rate: number }>).map(
                    ([category, stats]) => (
                      <div key={category}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 font-medium">
                            {CATEGORY_LABELS[category] ?? category}
                          </span>
                          <span className="text-gray-500">
                            {stats.materialized}/{stats.total} materialized
                          </span>
                        </div>
                        <RateBar rate={stats.rate} />
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* By Officer */}
            <div className="bg-white rounded-xl border p-4">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-500" /> By Officer
              </h2>
              {(data.byOfficer as Array<{ id: string; name: string; total: number; materialized: number; rate: number }>)?.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No data yet</p>
              ) : (
                <div className="space-y-4">
                  {(data.byOfficer as Array<{ id: string; name: string; total: number; materialized: number; rate: number }>)
                    ?.sort((a, b) => b.total - a.total)
                    .map(officer => (
                      <div key={officer.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 font-medium">{officer.name}</span>
                          <span className="text-gray-500">
                            {officer.materialized}/{officer.total}
                          </span>
                        </div>
                        <RateBar rate={officer.rate} />
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Interpretation guide */}
          <div className="mt-6 bg-gray-50 rounded-xl border p-4 text-sm text-gray-600">
            <p className="font-semibold text-gray-700 mb-1">How to read this</p>
            <p>
              "Materialization rate" shows what percentage of raised flags were later confirmed by actual loan
              performance (arrears, default, or other adverse outcome). A high rate on a category or by an officer
              signals good early identification of risk — use this in coaching and BCC training.
            </p>
            <div className="flex gap-4 mt-2">
              <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-green-500 inline-block" /> &lt;40% low accuracy</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-yellow-500 inline-block" /> 40–69% moderate</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-red-500 inline-block" /> ≥70% high accuracy</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
