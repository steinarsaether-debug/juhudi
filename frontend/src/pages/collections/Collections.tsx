import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Phone, Car, MessageSquare, FileText,
  ChevronDown, ChevronUp, X, Calendar, Sparkles,
} from 'lucide-react';
import { collectionsApi, aiApi } from '../../services/api';
import { CollectionActionType, AiCollectionsRecommendation } from '../../types';
import { getErrorMessage } from '../../services/api';

// ── Action type config ────────────────────────────────────────────────────────

const ACTION_LABELS: Record<CollectionActionType, { label: string; icon: React.ElementType }> = {
  AUTO_ALERT:           { label: 'Auto Alert',          icon: AlertTriangle },
  PHONE_CALL:           { label: 'Phone Call',           icon: Phone },
  SMS_SENT:             { label: 'SMS Sent',             icon: MessageSquare },
  FIELD_VISIT:          { label: 'Field Visit',          icon: Car },
  PROMISE_TO_PAY:       { label: 'Promise to Pay',       icon: Calendar },
  PARTIAL_PAYMENT:      { label: 'Partial Payment',      icon: ChevronDown },
  DEMAND_LETTER:        { label: 'Demand Letter',        icon: FileText },
  LEGAL_NOTICE:         { label: 'Legal Notice',         icon: FileText },
  WRITE_OFF_RECOMMENDED:{ label: 'Write-off Recommended',icon: X },
  RESTRUCTURED:         { label: 'Restructured',         icon: ChevronUp },
  OTHER:                { label: 'Other',                icon: MessageSquare },
};

const ARREAR_BUCKETS = [
  { label: 'Day 1–6',   color: 'bg-yellow-100 text-yellow-800',  min: 1,  max: 6 },
  { label: '7–29 days', color: 'bg-orange-100 text-orange-800',  min: 7,  max: 29 },
  { label: '30–89 days',color: 'bg-red-100 text-red-700',        min: 30, max: 89 },
  { label: '90+ days',  color: 'bg-red-200 text-red-900 font-bold', min: 90, max: undefined },
];

function DaysBadge({ days }: { days: number }) {
  const bucket = ARREAR_BUCKETS.find(b => days >= b.min && (b.max === undefined || days <= b.max));
  if (!bucket) return <span className="text-xs text-gray-400">{days}d</span>;
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${bucket.color}`}>{days} days</span>
  );
}

// ── Log Action Modal ──────────────────────────────────────────────────────────

interface LogActionModalProps {
  loanId: string;
  customerName: string;
  daysInArrears: number;
  onClose: () => void;
}

function LogActionModal({ loanId, customerName, daysInArrears, onClose }: LogActionModalProps) {
  const qc = useQueryClient();
  const [actionType, setActionType] = useState<CollectionActionType>('PHONE_CALL');
  const [notes, setNotes]           = useState('');
  const [nextDate, setNextDate]     = useState('');
  const [promisedAmt, setPromisedAmt] = useState('');
  const [promisedDate, setPromisedDate] = useState('');
  const [error, setError]           = useState('');

  const mutation = useMutation({
    mutationFn: () => collectionsApi.logAction(loanId, {
      actionType,
      notes: notes || undefined,
      nextActionDate: nextDate ? new Date(nextDate).toISOString() : undefined,
      promisedAmountKes: promisedAmt ? Number(promisedAmt) : undefined,
      promisedDate: promisedDate ? new Date(promisedDate).toISOString() : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections'] });
      onClose();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const showPromise = actionType === 'PROMISE_TO_PAY';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Log Action</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {customerName} &bull; <DaysBadge days={daysInArrears} />
        </p>

        <label className="block text-sm font-medium text-gray-700 mb-2">Action Type</label>
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {(Object.keys(ACTION_LABELS) as CollectionActionType[])
            .filter(k => k !== 'AUTO_ALERT')
            .map(k => {
              const { label, icon: Icon } = ACTION_LABELS[k];
              return (
                <button
                  key={k}
                  onClick={() => setActionType(k)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors text-left ${
                    actionType === k
                      ? 'bg-primary-700 text-white border-primary-700'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  {label}
                </button>
              );
            })}
        </div>

        {showPromise && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Promised Amount (KES)</label>
              <input type="number" value={promisedAmt} onChange={e => setPromisedAmt(e.target.value)}
                className="input text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Promised Date</label>
              <input type="date" value={promisedDate} onChange={e => setPromisedDate(e.target.value)}
                className="input text-sm w-full" />
            </div>
          </div>
        )}

        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            rows={3} maxLength={2000} className="input w-full text-sm resize-none"
            placeholder="What happened? What was agreed?"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Next Action Date (optional)</label>
          <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)}
            className="input text-sm w-full" />
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="btn-primary flex-1"
          >
            {mutation.isPending ? 'Saving…' : 'Log Action'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AI Recommendation inline panel ────────────────────────────────────────────

function AiRecommendationPanel({ loanId, onClose }: { loanId: string; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery<AiCollectionsRecommendation>({
    queryKey: ['aiCollectionsRec', loanId],
    queryFn: () => aiApi.collectionsRecommendation(loanId),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const priorityColor = {
    LOW: 'bg-blue-50 border-blue-200 text-blue-800',
    MEDIUM: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    HIGH: 'bg-orange-50 border-orange-200 text-orange-800',
    URGENT: 'bg-red-50 border-red-200 text-red-800',
  };

  const actionLabel: Record<string, string> = {
    CALL: 'Phone Call', VISIT: 'Field Visit', RESTRUCTURE: 'Restructure',
    LEGAL: 'Legal Action', WRITE_OFF: 'Write-off',
  };

  return (
    <tr>
      <td colSpan={7} className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" /> AI Collection Recommendation
            </div>

            {isLoading ? (
              <p className="text-xs text-indigo-400">Generating recommendation…</p>
            ) : isError ? (
              <p className="text-xs text-red-500">Unable to generate recommendation.</p>
            ) : data ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${priorityColor[data.priority]}`}>
                    {data.priority} PRIORITY
                  </span>
                  <span className="text-xs font-semibold text-gray-700">
                    {actionLabel[data.recommendedAction] ?? data.recommendedAction}
                  </span>
                  {data.escalate && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                      Escalate
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600">{data.reasoning}</p>
                {data.suggestedMessage && (
                  <div className="bg-white rounded border border-indigo-100 p-2">
                    <p className="text-xs text-gray-400 mb-1 font-medium">Suggested message:</p>
                    <p className="text-xs text-gray-700 italic">{data.suggestedMessage}</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Loan row ──────────────────────────────────────────────────────────────────

interface LoanRow {
  id: string;
  loanNumber: string;
  daysInArrears: number;
  outstandingBalKes: number;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    county: string;
    village: string;
  };
  application?: {
    officer?: { id: string; firstName: string; lastName: string };
  };
  collectionActions?: Array<{
    actionType: string;
    createdAt: string;
    nextActionDate?: string;
    notes?: string;
  }>;
  _count?: { collectionActions: number };
}

function LoanArrearRow({ loan, onLog }: { loan: LoanRow; onLog: (id: string, name: string, days: number) => void }) {
  const [showAi, setShowAi] = useState(false);
  const lastAction = loan.collectionActions?.[0];
  const customerName = `${loan.customer.firstName} ${loan.customer.lastName}`;

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3">
          <Link to={`/loans/${loan.id}`} className="block group">
            <p className="text-sm font-medium text-primary-700 group-hover:underline">{customerName}</p>
            <p className="text-xs text-gray-400">{loan.customer.village}, {loan.customer.county}</p>
          </Link>
        </td>
        <td className="px-4 py-3">
          <DaysBadge days={loan.daysInArrears} />
        </td>
        <td className="px-4 py-3 text-sm font-medium text-gray-900">
          KES {(loan.outstandingBalKes ?? 0).toLocaleString()}
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">
          {loan.application?.officer
            ? `${loan.application.officer.firstName} ${loan.application.officer.lastName}`
            : '—'}
        </td>
        <td className="px-4 py-3">
          {lastAction ? (
            <div>
              <span className="text-xs font-medium text-gray-700">
                {ACTION_LABELS[lastAction.actionType as CollectionActionType]?.label ?? lastAction.actionType}
              </span>
              <p className="text-xs text-gray-400">{new Date(lastAction.createdAt).toLocaleDateString()}</p>
              {lastAction.nextActionDate && (
                <p className="text-xs text-orange-500">
                  Follow-up: {new Date(lastAction.nextActionDate).toLocaleDateString()}
                </p>
              )}
            </div>
          ) : (
            <span className="text-xs text-red-500 font-medium">No action yet</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-gray-400 text-center">
          {loan._count?.collectionActions ?? 0}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onLog(loan.id, customerName, loan.daysInArrears)}
              className="btn-secondary text-xs"
            >
              Log
            </button>
            <button
              onClick={() => setShowAi(v => !v)}
              title="AI recommendation"
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                showAi
                  ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                  : 'bg-white border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
      {showAi && <AiRecommendationPanel loanId={loan.id} onClose={() => setShowAi(false)} />}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Collections() {
  const [minDays, setMinDays] = useState(1);
  const [page, setPage]       = useState(1);
  const [modal, setModal]     = useState<{ loanId: string; name: string; days: number } | null>(null);

  const { data: summary } = useQuery({
    queryKey: ['collections', 'summary'],
    queryFn: collectionsApi.summary,
    refetchInterval: 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['collections', 'arrears', minDays, page],
    queryFn: () => collectionsApi.arrears({ minDays, page, limit: 25 }),
    refetchInterval: 60_000,
  });

  const loans: LoanRow[] = data?.data ?? [];
  const pagination = data?.pagination;

  const openModal = (loanId: string, name: string, days: number) =>
    setModal({ loanId, name, days });

  return (
    <div>
      {modal && (
        <LogActionModal
          loanId={modal.loanId}
          customerName={modal.name}
          daysInArrears={modal.days}
          onClose={() => setModal(null)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Collections</h1>
          <p className="text-sm text-gray-500 mt-0.5">Loans in arrears — action required from day 1</p>
        </div>
      </div>

      {/* Summary buckets */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {ARREAR_BUCKETS.map(b => {
            const key = b.min === 1 ? 'day1to6' : b.min === 7 ? 'day7to29' : b.min === 30 ? 'day30to89' : 'day90plus';
            const count = summary.buckets?.[key] ?? 0;
            return (
              <button
                key={b.label}
                onClick={() => { setMinDays(b.min); setPage(1); }}
                className={`card p-4 text-left transition-shadow hover:shadow-md ${minDays === b.min ? 'ring-2 ring-primary-400' : ''}`}
              >
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className={`text-xs mt-1 font-medium px-2 py-0.5 rounded inline-block ${b.color}`}>{b.label}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* PAR banner */}
      {summary && (
        <div className="flex items-center gap-6 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-5 text-sm">
          <div>
            <span className="text-gray-500">Total in arrears: </span>
            <span className="font-bold text-gray-900">{summary.totalInArrears}</span>
          </div>
          <div>
            <span className="text-gray-500">Arrears amount: </span>
            <span className="font-bold text-gray-900">KES {Number(summary.totalArrearsKes ?? 0).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">PAR 30: </span>
            <span className="font-bold text-red-700">{summary.par30Rate}%</span>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[1, 7, 30, 90].map(d => (
          <button
            key={d}
            onClick={() => { setMinDays(d); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              minDays === d
                ? 'bg-primary-700 text-white border-primary-700'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
            }`}
          >
            {d === 1 ? 'All arrears' : `≥ ${d} days`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : loans.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No loans in arrears at this threshold</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Officer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Action</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {loans.map(loan => (
                <LoanArrearRow key={loan.id} loan={loan} onLog={openModal} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">{pagination.total} loans</p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm disabled:opacity-40">Prev</button>
            <button disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
