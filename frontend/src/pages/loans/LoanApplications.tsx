import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { loanApi, bccApi, getErrorMessage } from '../../services/api';
import { LoanApplication, PaginatedResponse } from '../../types';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, Gavel } from 'lucide-react';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'SUBMITTED', label: 'Pending' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const ILP_SEGMENT_LABELS: Record<string, string> = {
  FARMER: 'Farmer',
  LANDLORD: 'Landlord',
  SHOP_OWNER: 'Shop Owner',
};

// ── Open BCC mini-modal ───────────────────────────────────────────────────────
function OpenBccModal({ application, onClose }: { application: LoanApplication; onClose: () => void }) {
  const qc = useQueryClient();
  const [quorum, setQuorum] = useState(2);
  const [notes, setNotes]   = useState('');
  const [error, setError]   = useState('');

  const mutation = useMutation({
    mutationFn: () => bccApi.open({
      loanApplicationId: application.id,
      quorumRequired: quorum,
      outcomeNotes: notes || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['applications'] }); qc.invalidateQueries({ queryKey: ['bcc'] }); onClose(); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Open BCC Session</h2>
        <p className="text-sm text-gray-500 mb-4">
          {application.customer?.firstName} {application.customer?.lastName} — KES {application.requestedAmountKes.toLocaleString()}
        </p>

        <label className="block text-sm font-medium text-gray-700 mb-1">Quorum Required (non-abstain votes)</label>
        <input
          type="number" min={2} max={10} value={quorum}
          onChange={e => setQuorum(Number(e.target.value))}
          className="input w-full mb-4"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Opening Notes (optional)</label>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          rows={2} maxLength={1000} className="input w-full mb-4 resize-none text-sm"
          placeholder="Context or questions for the committee…"
        />

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button disabled={mutation.isPending} onClick={() => mutation.mutate()} className="btn-primary flex-1">
            {mutation.isPending ? 'Opening…' : 'Open BCC'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LoanApplications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [reviewId, setReviewId]           = useState<string | null>(null);
  const [reviewNote, setReviewNote]       = useState('');
  const [bccApplication, setBccApplication] = useState<LoanApplication | null>(null);

  const page   = parseInt(searchParams.get('page') ?? '1');
  const status = searchParams.get('status') ?? '';

  const navigate = useNavigate();
  const canReview = ['SUPERVISOR', 'BRANCH_MANAGER', 'ADMIN'].includes(user?.role ?? '');
  const canOpenBcc = ['BRANCH_MANAGER', 'ADMIN'].includes(user?.role ?? '');

  const { data, isLoading } = useQuery<PaginatedResponse<LoanApplication>>({
    queryKey: ['applications', { page, status }],
    queryFn: () => loanApi.listApplications({ page, limit: 20, ...(status ? { status } : {}) }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, decision, notes }: { id: string; decision: string; notes: string }) =>
      loanApi.reviewApplication(id, { decision, reviewNotes: notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications'] });
      setReviewId(null);
      setReviewNote('');
    },
  });

  const setFilter = (f: string) => setSearchParams(prev => { prev.set('status', f); prev.set('page', '1'); return prev; });
  const setPage   = (p: number) => setSearchParams(prev => { prev.set('page', String(p)); return prev; });

  return (
    <div>
      {bccApplication && (
        <OpenBccModal application={bccApplication} onClose={() => setBccApplication(null)} />
      )}

      <div className="page-header">
        <h1 className="page-title">Loan Applications</h1>
      </div>

      <div className="flex gap-1 mb-4 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              status === f.value ? 'bg-primary-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table — hidden on mobile, shown on md+ */}
      <div className="table-container hidden md:block">
        {isLoading ? <LoadingSpinner /> : (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Amount</th>
                <th>Purpose</th>
                <th>Term</th>
                <th>Score</th>
                <th>Status</th>
                <th>Date</th>
                {(canReview || canOpenBcc) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {data?.data.map((a) => (
                <tr key={a.id}
                  onClick={() => navigate(`/loans/applications/${a.id}`)}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <td>
                    <Link to={`/customers/${a.customer?.id}`} className="font-medium text-primary-700 hover:underline"
                      onClick={e => e.stopPropagation()}>
                      {a.customer?.firstName} {a.customer?.lastName}
                    </Link>
                    <p className="text-xs text-gray-400">{a.customer?.county}</p>
                    {a.applicationNumber && (
                      <p className="font-mono text-xs text-gray-400 mt-0.5">{a.applicationNumber}</p>
                    )}
                  </td>
                  <td className="font-medium">KES {a.requestedAmountKes.toLocaleString()}</td>
                  <td className="max-w-xs truncate text-gray-500">{a.purposeOfLoan}</td>
                  <td>{a.termMonths} mo</td>
                  <td>
                    {a.creditScore ? (
                      <span className={`font-bold ${
                        a.creditScore.totalScore >= 70 ? 'text-green-600' :
                        a.creditScore.totalScore >= 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>{a.creditScore.totalScore}/100</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <StatusBadge status={a.status} />
                      {a.ilpSegment && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                          ILP · {ILP_SEGMENT_LABELS[a.ilpSegment] ?? a.ilpSegment}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-xs text-gray-500">{new Date(a.createdAt).toLocaleDateString('en-KE')}</td>
                  {(canReview || canOpenBcc) && (
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {canReview && (a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW') && (
                          <button onClick={() => setReviewId(a.id)} className="text-xs text-primary-700 hover:underline">
                            Review
                          </button>
                        )}
                        {canOpenBcc && (a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW') && (
                          <button
                            onClick={() => setBccApplication(a)}
                            className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 font-medium"
                            title="Open Branch Credit Committee session"
                          >
                            <Gavel className="h-3 w-3" /> BCC
                          </button>
                        )}
                        {a.status === 'APPROVED' && (
                          <Link to={`/loans/applications/${a.id}`} className="text-xs text-primary-700 hover:underline"
                            onClick={e => e.stopPropagation()}>
                            Disburse
                          </Link>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!data?.data.length && (
                <tr><td colSpan={8} className="text-center text-gray-400 py-12">No applications found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile card list — shown on < md, hidden on md+ */}
      <div className="block md:hidden space-y-3">
        {isLoading ? (
          <LoadingSpinner />
        ) : data?.data.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No applications found</p>
        ) : (
          data?.data.map((a) => (
            <div
              key={a.id}
              onClick={() => navigate(`/loans/applications/${a.id}`)}
              className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm active:bg-gray-50 cursor-pointer"
            >
              {/* Row 1: Customer name + Amount */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-primary-700 truncate">
                  {a.customer?.firstName} {a.customer?.lastName}
                </span>
                <span className="font-semibold text-gray-900 text-sm whitespace-nowrap">
                  KES {a.requestedAmountKes.toLocaleString()}
                </span>
              </div>

              {/* Row 2: County + App number */}
              <p className="mt-0.5 text-xs text-gray-400">
                {a.customer?.county}
                {a.applicationNumber && ` · ${a.applicationNumber}`}
              </p>

              {/* Row 3: Status + ILP tag + Score + Date */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <StatusBadge status={a.status} />
                {a.ilpSegment && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    ILP · {ILP_SEGMENT_LABELS[a.ilpSegment] ?? a.ilpSegment}
                  </span>
                )}
                {a.creditScore && (
                  <span className={`text-xs font-bold ml-auto ${
                    a.creditScore.totalScore >= 70 ? 'text-green-600' :
                    a.creditScore.totalScore >= 50 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {a.creditScore.totalScore}/100
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {new Date(a.createdAt).toLocaleDateString('en-KE')}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.pagination.total)} of {data.pagination.total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="btn-secondary py-1.5 px-3 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage(page + 1)} disabled={page >= data.pagination.pages} className="btn-secondary py-1.5 px-3 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Review Loan Application</h2>
            <div className="mb-4">
              <label className="label">Review Notes</label>
              <textarea
                className="input h-24"
                placeholder="Add notes for the decision..."
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => reviewMutation.mutate({ id: reviewId, decision: 'APPROVE', notes: reviewNote })}
                disabled={reviewMutation.isPending}
                className="btn-primary flex-1"
              >
                <CheckCircle className="h-4 w-4" /> Approve
              </button>
              <button
                onClick={() => reviewMutation.mutate({ id: reviewId, decision: 'CONDITIONALLY_APPROVE', notes: reviewNote })}
                disabled={reviewMutation.isPending}
                className="btn-secondary flex-1"
              >
                Conditional
              </button>
              <button
                onClick={() => reviewMutation.mutate({ id: reviewId, decision: 'REJECT', notes: reviewNote })}
                disabled={reviewMutation.isPending}
                className="btn-danger flex-1"
              >
                <XCircle className="h-4 w-4" /> Reject
              </button>
            </div>
            <button onClick={() => setReviewId(null)} className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
