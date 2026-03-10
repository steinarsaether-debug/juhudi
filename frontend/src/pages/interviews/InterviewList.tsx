// ─── Field Interviews — Global List ──────────────────────────────────────────
// LOs see only their own interviews.
// BM sees all interviews in their branch.
// Admin sees everything.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Search, CheckCircle2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { interviewApi } from '../../services/api';
import { CustomerInterview } from '../../types';
import clsx from 'clsx';

function StatusChip({ status }: { status: string }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
      status === 'COMPLETED'
        ? 'bg-green-100 text-green-700'
        : 'bg-yellow-100 text-yellow-700',
    )}>
      {status === 'COMPLETED'
        ? <CheckCircle2 className="h-3 w-3" />
        : <Clock className="h-3 w-3" />}
      {status === 'COMPLETED' ? 'Completed' : 'Draft'}
    </span>
  );
}

function RecommendationChip({ rec }: { rec?: string }) {
  if (!rec) return <span className="text-gray-400 text-xs">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    APPROVE:                { label: 'Approve',     cls: 'bg-green-100 text-green-700' },
    APPROVE_WITH_CONDITIONS:{ label: 'Conditional', cls: 'bg-blue-100 text-blue-700' },
    FURTHER_EVALUATION:     { label: 'More Info',   cls: 'bg-yellow-100 text-yellow-700' },
    DECLINE:                { label: 'Decline',     cls: 'bg-red-100 text-red-700' },
  };
  const m = map[rec] ?? { label: rec, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${m.cls}`}>
      {m.label}
    </span>
  );
}

export default function InterviewList() {
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState<'ALL' | 'COMPLETED' | 'DRAFT'>('ALL');
  const [page, setPage]         = useState(1);
  const LIMIT = 30;

  const params: Record<string, string | number> = { page, limit: LIMIT };
  if (status !== 'ALL') params.status = status;
  if (search)           params.search = search;

  const { data, isLoading } = useQuery({
    queryKey:  ['interviews', 'all', params],
    queryFn:   () => interviewApi.listAll(params),
    staleTime: 30_000,
  });

  const interviews: CustomerInterview[] = data?.data ?? [];
  const total: number    = data?.pagination?.total ?? 0;
  const pages: number    = data?.pagination?.pages ?? 1;

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleStatus = (v: 'ALL' | 'COMPLETED' | 'DRAFT') => { setStatus(v); setPage(1); };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100">
            <ClipboardList className="h-5 w-5 text-primary-700" />
          </div>
          <div>
            <h1 className="page-title">Field Interviews</h1>
            <p className="text-sm text-gray-500 mt-0.5">{total} interview{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by customer name…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-gray-200 p-1 bg-white shrink-0">
          {(['ALL', 'COMPLETED', 'DRAFT'] as const).map(s => (
            <button
              key={s}
              onClick={() => handleStatus(s)}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                status === s ? 'bg-primary-600 text-white' : 'text-gray-600 hover:text-gray-900',
              )}
            >
              {s === 'ALL' ? 'All' : s === 'COMPLETED' ? 'Completed' : 'Drafts'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : interviews.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <ClipboardList className="h-10 w-10 text-gray-300 mx-auto" />
            <p className="text-gray-500 text-sm">No interviews found</p>
            {search && (
              <p className="text-xs text-gray-400">Try adjusting your search</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Score</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Recommendation</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Conducted By</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {interviews.map(iv => (
                  <tr key={iv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      {iv.customer ? (
                        <Link
                          to={`/customers/${iv.customerId}`}
                          className="font-medium text-gray-900 hover:text-primary-700"
                        >
                          {iv.customer.firstName} {iv.customer.lastName}
                        </Link>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {iv.customer?.village && iv.customer?.county
                        ? `${iv.customer.village}, ${iv.customer.county}`
                        : iv.customer?.county ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={iv.status} />
                    </td>
                    <td className="px-4 py-3">
                      {iv.scorePercent != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={clsx('h-full rounded-full', iv.scorePercent >= 70 ? 'bg-green-500' : iv.scorePercent >= 50 ? 'bg-yellow-500' : 'bg-red-500')}
                              style={{ width: `${iv.scorePercent}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-700">{iv.scorePercent.toFixed(0)}%</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RecommendationChip rec={iv.recommendation} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {iv.conductedBy ? `${iv.conductedBy.firstName} ${iv.conductedBy.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(iv.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/customers/${iv.customerId}/interview`}
                        className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                      >
                        {iv.status === 'DRAFT' ? 'Continue →' : 'View →'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= pages}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
