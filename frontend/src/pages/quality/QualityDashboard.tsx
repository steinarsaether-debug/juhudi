import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert, ShieldX, ShieldCheck, RefreshCw,
  ChevronRight, AlertTriangle, Users, BarChart2,
} from 'lucide-react';
import { qualityApi, getErrorMessage } from '../../services/api';
import { QualityReport } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// ── Helper: human-readable flag-type labels ──────────────────────────────────
const FLAG_LABELS: Record<string, string> = {
  SIMILAR_NAME_SAME_BRANCH:   'Similar name – same branch',
  SIMILAR_NAME_CROSS_BRANCH:  'Similar name – cross branch',
  NAME_DOB_MATCH:             'Name + DOB match',
  GPS_PROXIMITY:              'GPS proximity clash',
  FINANCIAL_PROFILE_COPY:     'Identical financial profile',
  LOAN_PURPOSE_COPY_PASTE:    'Copy-pasted loan purpose',
  GENERIC_LOAN_PURPOSE:       'Generic / template loan purpose',
  ROUND_NUMBER_INCOME:        'Suspicious round-number income',
  NEGATIVE_DISPOSABLE_INCOME: 'Negative disposable income',
  HIGH_DEBT_BURDEN:           'High debt burden',
  RAPID_SUCCESSION:           'Rapid application succession',
};

// ── Severity card ─────────────────────────────────────────────────────────────
function SeverityCard({
  severity, count, icon: Icon, colorClass,
}: {
  severity: string; count: number;
  icon: typeof ShieldX; colorClass: string;
}) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-4 ${colorClass}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/60">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{count}</p>
        <p className="text-xs font-medium opacity-70">{severity}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function QualityDashboard() {
  const qc = useQueryClient();
  const [scanMsg, setScanMsg] = useState('');
  const [scanError, setScanError] = useState('');

  const { data: report, isLoading } = useQuery<QualityReport>({
    queryKey: ['qualityReport'],
    queryFn: () => qualityApi.report(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const scanMutation = useMutation({
    mutationFn: () => qualityApi.branchScan(),
    onSuccess: (result: { processed: number; flagsCreated: number }) => {
      setScanMsg(`Scan complete — ${result.processed} records checked, ${result.flagsCreated} flag(s) created/updated.`);
      setScanError('');
      qc.invalidateQueries({ queryKey: ['qualityReport'] });
    },
    onError: (err) => { setScanError(getErrorMessage(err)); setScanMsg(''); },
  });

  if (isLoading) return <LoadingSpinner />;
  if (!report) return <div className="text-center py-12 text-gray-400">Unable to load quality report</div>;

  const totalActive = (report.bySeverity.CRITICAL ?? 0) +
                      (report.bySeverity.WARNING  ?? 0) +
                      (report.bySeverity.INFO     ?? 0);

  // Sort flag types by count desc
  const sortedTypes = Object.entries(report.byType)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Quality Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Duplicate detection, copy-paste alerts, and data integrity flags
          </p>
        </div>
        <button
          onClick={() => { setScanMsg(''); setScanError(''); scanMutation.mutate(); }}
          disabled={scanMutation.isPending}
          className="btn-secondary flex items-center gap-2"
          title="Re-scan all branch customers and applications"
        >
          <RefreshCw className={`h-4 w-4 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
          {scanMutation.isPending ? 'Scanning…' : 'Run Branch Scan'}
        </button>
      </div>

      {/* Scan feedback */}
      {scanMsg && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {scanMsg}
        </div>
      )}
      {scanError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {scanError}
        </div>
      )}

      {/* Severity summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SeverityCard severity="Total Active Flags" count={totalActive}
          icon={ShieldAlert} colorClass="bg-gray-50 border-gray-200 text-gray-700" />
        <SeverityCard severity="Critical" count={report.bySeverity.CRITICAL ?? 0}
          icon={ShieldX} colorClass="bg-red-50 border-red-200 text-red-700" />
        <SeverityCard severity="Warning" count={report.bySeverity.WARNING ?? 0}
          icon={ShieldAlert} colorClass="bg-yellow-50 border-yellow-200 text-yellow-700" />
        <SeverityCard severity="Info" count={report.bySeverity.INFO ?? 0}
          icon={ShieldAlert} colorClass="bg-blue-50 border-blue-200 text-blue-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flag types breakdown */}
        <div className="card p-5">
          <h2 className="section-title flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-gray-400" />
            Flags by Type
          </h2>
          {sortedTypes.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
              <ShieldCheck className="h-5 w-5 mr-2 text-green-500" />
              No active quality flags — great job!
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTypes.map(([type, count]) => {
                const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;
                return (
                  <div key={type}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">{FLAG_LABELS[type] ?? type}</span>
                      <span className="font-bold text-gray-800">{count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-600 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top flagged customers */}
        <div className="card p-5">
          <h2 className="section-title flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            Most Flagged Customers
          </h2>
          {report.topFlaggedCustomers.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
              <ShieldCheck className="h-5 w-5 mr-2 text-green-500" />
              No flagged customers
            </div>
          ) : (
            <div className="space-y-1">
              {report.topFlaggedCustomers.map(c => (
                <Link
                  key={c.id}
                  to={`/customers/${c.id}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800 group-hover:text-primary-700">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-xs text-gray-400">{c.county}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      c.flagCount >= 3 ? 'bg-red-100 text-red-700' :
                      c.flagCount >= 2 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {c.flagCount} flag{c.flagCount !== 1 ? 's' : ''}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Per-officer breakdown */}
      {report.byOfficer.length > 0 && (
        <div className="card p-5 mt-6">
          <h2 className="section-title flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            Flags per Loan Officer
          </h2>
          <div className="table-container mt-0 border-0 shadow-none p-0">
            <table>
              <thead>
                <tr>
                  <th>Officer</th>
                  <th className="text-right">Total Flags</th>
                  <th className="text-right">Critical</th>
                  <th className="text-right">Other</th>
                  <th className="text-right">% Critical</th>
                </tr>
              </thead>
              <tbody>
                {report.byOfficer
                  .sort((a, b) => b.critical - a.critical || b.flags - a.flags)
                  .map(o => {
                    const critPct = o.flags > 0 ? Math.round((o.critical / o.flags) * 100) : 0;
                    return (
                      <tr key={o.officerId}>
                        <td className="font-medium">{o.name}</td>
                        <td className="text-right font-bold">{o.flags}</td>
                        <td className={`text-right font-bold ${o.critical > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {o.critical}
                        </td>
                        <td className="text-right text-gray-500">{o.flags - o.critical}</td>
                        <td className="text-right">
                          <span className={`text-xs font-medium ${
                            critPct >= 50 ? 'text-red-600' :
                            critPct >= 25 ? 'text-yellow-600' : 'text-gray-500'
                          }`}>
                            {critPct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clean slate state */}
      {totalActive === 0 && report.byOfficer.length === 0 && (
        <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <ShieldCheck className="h-12 w-12 text-green-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-green-700">All Clear</h3>
          <p className="text-sm text-green-600 mt-1">
            No active data quality flags in this branch. Run a branch scan to check for new issues.
          </p>
        </div>
      )}
    </div>
  );
}
