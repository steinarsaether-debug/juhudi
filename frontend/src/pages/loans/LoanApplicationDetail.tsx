import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { loanApi, bccApi, aiApi, getErrorMessage } from '../../services/api';
import { LoanApplication, LoanCollateral, AiApplicationReview } from '../../types';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AwardTierBadge from '../../components/common/AwardTierBadge';
import { useAuthStore } from '../../store/authStore';
import {
  ArrowLeft, User, Banknote, FileText, Shield, CheckSquare, Square,
  CheckCircle, XCircle, AlertCircle, ExternalLink, Gavel, CheckCircle2, Sparkles, RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CHECKLIST_ITEMS = [
  { id: 'agreement',  label: 'Loan agreement signed by customer' },
  { id: 'collateral', label: 'Collateral documents verified and filed' },
  { id: 'mpesa',      label: 'M-Pesa / bank account confirmed with customer' },
  { id: 'firstdate',  label: 'First repayment date confirmed with customer' },
  { id: 'insurance',  label: 'Insurance / loan protection arranged (if applicable)' },
];

const COLLATERAL_LABELS: Record<string, string> = {
  TITLE_DEED: 'Title Deed', MOTOR_VEHICLE: 'Motor Vehicle', CHATTEL: 'Chattel',
  LIVESTOCK: 'Livestock', CROP_LIEN: 'Crop Lien', SALARY_ASSIGNMENT: 'Salary Assignment',
  GROUP_GUARANTEE: 'Group Guarantee', PERSONAL_GUARANTEE: 'Personal Guarantee',
  SAVINGS_DEPOSIT: 'Savings Deposit', OTHER: 'Other',
};

const ILP_SEGMENT_LABELS: Record<string, string> = {
  FARMER: 'Farmer', LANDLORD: 'Landlord', SHOP_OWNER: 'Shop Owner',
};

const ILP_DIMENSION_LABELS: Record<string, string> = {
  ownerScore: 'Owner / Borrower', businessScore: 'Business', operationalRiskScore: 'Operational Risk',
  cashFlowScore: 'Cash Flow', collateralScore: 'Collateral',
};

function scoreColor(s: number): string {
  if (s >= 70) return 'bg-green-500';
  if (s >= 50) return 'bg-yellow-400';
  return 'bg-red-500';
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="card p-5 space-y-4">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-primary-600" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1.5 border-b border-gray-50 last:border-0">
      <dt className="text-sm text-gray-500 flex-shrink-0 w-40">{label}</dt>
      <dd className="text-sm text-gray-900 font-medium text-right">{children}</dd>
    </div>
  );
}

// ── Open BCC Modal ────────────────────────────────────────────────────────────

function OpenBccModal({ applicationId, label, onClose, onSuccess }: {
  applicationId: string; label: string;
  onClose: () => void; onSuccess: (sessionId: string) => void;
}) {
  const [quorum, setQuorum] = useState(2);
  const [notes, setNotes]   = useState('');
  const [error, setError]   = useState('');

  const mutation = useMutation({
    mutationFn: () => bccApi.open({ loanApplicationId: applicationId, quorumRequired: quorum, outcomeNotes: notes || undefined }),
    onSuccess: (session: { id: string }) => onSuccess(session.id),
    onError: (err) => setError(getErrorMessage(err)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Gavel className="h-5 w-5 text-primary-600" /> Open BCC Session
        </h2>
        <p className="text-sm text-gray-500 mb-4">{label}</p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Quorum Required</label>
        <input type="number" min={2} max={10} value={quorum}
          onChange={e => setQuorum(Number(e.target.value))}
          className="input w-full mb-4" />
        <label className="block text-sm font-medium text-gray-700 mb-1">Opening Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          rows={2} maxLength={1000} className="input w-full mb-4 resize-none text-sm"
          placeholder="Context or questions for the committee…" />
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

// ── Workflow Sidebar ──────────────────────────────────────────────────────────

function WorkflowPanel({ app }: { app: LoanApplication }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const canReview   = ['SUPERVISOR', 'BRANCH_MANAGER', 'ADMIN'].includes(user?.role ?? '');
  const canOpenBcc  = ['BRANCH_MANAGER', 'ADMIN'].includes(user?.role ?? '');
  const canDisburse = ['SUPERVISOR', 'BRANCH_MANAGER', 'ADMIN'].includes(user?.role ?? '');

  const isPending   = app.status === 'SUBMITTED' || app.status === 'UNDER_REVIEW';
  const isApproved  = app.status === 'APPROVED' || app.status === 'CONDITIONALLY_APPROVED';
  const isRejected  = app.status === 'REJECTED';

  const [reviewNotes, setReviewNotes]       = useState('');
  const [approvedAmt, setApprovedAmt]       = useState('');
  const [interestRate, setInterestRate]     = useState('');
  const [showBccModal, setShowBccModal]     = useState(false);

  // Disburse state
  const [checked, setChecked]   = useState<Record<string, boolean>>({});
  const [method, setMethod]     = useState<'MPESA' | 'BANK_TRANSFER' | 'CASH'>('MPESA');
  const [reference, setReference] = useState('');
  const [disburseError, setDisburseError] = useState('');

  const allChecked = CHECKLIST_ITEMS.every(item => checked[item.id]);
  const toggle = (id: string) => setChecked(c => ({ ...c, [id]: !c[id] }));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['application', app.id] });
    qc.invalidateQueries({ queryKey: ['applications'] });
  };

  const reviewMutation = useMutation({
    mutationFn: (decision: string) => loanApi.reviewApplication(app.id, {
      decision,
      reviewNotes: reviewNotes || undefined,
      approvedAmountKes: approvedAmt ? Number(approvedAmt) : undefined,
      interestRatePct: interestRate ? Number(interestRate) : undefined,
    }),
    onSuccess: invalidate,
    onError: (err) => alert(getErrorMessage(err)),
  });

  const disburseMutation = useMutation({
    mutationFn: () => loanApi.disburse(app.id, {
      disbursementMethod: method,
      disbursementReference: reference || undefined,
    }),
    onSuccess: (loan: { id: string }) => navigate(`/loans/${loan.id}`),
    onError: (err) => setDisburseError(getErrorMessage(err)),
  });

  return (
    <div className="space-y-4">

      {/* ── PENDING: Review Controls ─────────────────────────────── */}
      {isPending && canReview && (
        <div className="card p-5 space-y-4 border-primary-100">
          <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary-600" /> Review Application
          </h3>

          <div>
            <label className="label text-xs">Review Notes</label>
            <textarea
              value={reviewNotes} onChange={e => setReviewNotes(e.target.value)}
              rows={3} className="input text-sm resize-none"
              placeholder="Observations, conditions, concerns…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Approved Amount (KES)</label>
              <input type="number" value={approvedAmt} onChange={e => setApprovedAmt(e.target.value)}
                className="input text-sm" placeholder={app.requestedAmountKes.toLocaleString()} />
            </div>
            <div>
              <label className="label text-xs">Interest Rate (%)</label>
              <input type="number" value={interestRate} onChange={e => setInterestRate(e.target.value)}
                className="input text-sm" placeholder="18" step="0.5" min="0" max="100" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              disabled={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate('APPROVE')}
              className="btn-primary w-full"
            >
              <CheckCircle className="h-4 w-4" /> Approve
            </button>
            <button
              disabled={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate('CONDITIONALLY_APPROVE')}
              className="btn-secondary w-full text-sm"
            >
              Conditionally Approve
            </button>
            <button
              disabled={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate('REJECT')}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 text-sm font-medium py-2 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" /> Reject
            </button>
          </div>
        </div>
      )}

      {/* ── PENDING: Open BCC ────────────────────────────────────── */}
      {isPending && canOpenBcc && !app.bccSession && (
        <div className="card p-5">
          <button
            onClick={() => setShowBccModal(true)}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-orange-300 hover:border-orange-400 text-orange-600 hover:text-orange-700 text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            <Gavel className="h-4 w-4" /> Open BCC Session
          </button>
          {showBccModal && (
            <OpenBccModal
              applicationId={app.id}
              label={`${app.customer?.firstName} ${app.customer?.lastName} — KES ${app.requestedAmountKes.toLocaleString()}`}
              onClose={() => setShowBccModal(false)}
              onSuccess={(sessionId) => navigate(`/bcc/${sessionId}`)}
            />
          )}
        </div>
      )}

      {/* ── PENDING: BCC already open ───────────────────────────── */}
      {isPending && app.bccSession && (
        <div className="card p-4 border-orange-100 bg-orange-50">
          <p className="text-xs text-orange-700 font-medium mb-1">BCC Session Open</p>
          <Link to={`/bcc/${app.bccSession.id}`}
            className="text-sm text-orange-700 hover:underline flex items-center gap-1">
            View BCC Session <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* ── APPROVED: Disburse ──────────────────────────────────── */}
      {isApproved && !app.loan && canDisburse && (
        <div className="card p-5 space-y-4 border-primary-200">
          <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary-600" /> Disburse Loan
          </h3>

          <div className="space-y-2">
            {CHECKLIST_ITEMS.map(item => (
              <button key={item.id} type="button" onClick={() => toggle(item.id)}
                className={clsx(
                  'w-full flex items-center gap-3 rounded-xl border px-3 py-2 text-left text-xs transition-all',
                  checked[item.id]
                    ? 'border-green-300 bg-green-50 text-green-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                )}
              >
                {checked[item.id]
                  ? <CheckSquare className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                  : <Square className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />}
                {item.label}
              </button>
            ))}
          </div>

          <div>
            <label className="label text-xs">Disbursement Method *</label>
            <div className="grid grid-cols-3 gap-2">
              {(['MPESA', 'BANK_TRANSFER', 'CASH'] as const).map(m => (
                <button key={m} type="button" onClick={() => setMethod(m)}
                  className={clsx('rounded-xl border-2 py-1.5 text-xs font-medium transition-all',
                    method === m
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}>
                  {m === 'MPESA' ? 'M-Pesa' : m === 'BANK_TRANSFER' ? 'Bank' : 'Cash'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label text-xs">
              {method === 'MPESA' ? 'M-Pesa Confirmation Code' : method === 'BANK_TRANSFER' ? 'Bank Reference' : 'Receipt No.'}
            </label>
            <input className="input text-sm" value={reference} onChange={e => setReference(e.target.value)}
              placeholder={method === 'MPESA' ? 'e.g. QAB3X4YDEF' : method === 'BANK_TRANSFER' ? 'e.g. EFT001' : 'e.g. RCT-001'} />
          </div>

          {disburseError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> {disburseError}
            </p>
          )}

          <button
            disabled={!allChecked || disburseMutation.isPending}
            onClick={() => disburseMutation.mutate()}
            className="btn-primary w-full disabled:opacity-50"
          >
            {disburseMutation.isPending
              ? 'Disbursing…'
              : `Disburse KES ${(app.approvedAmountKes ?? app.requestedAmountKes).toLocaleString()}`}
          </button>
          {!allChecked && (
            <p className="text-xs text-gray-400 text-center">Tick all checklist items to enable</p>
          )}
        </div>
      )}

      {/* ── APPROVED + loan exists ──────────────────────────────── */}
      {isApproved && app.loan && (
        <div className="card p-5 border-green-200 bg-green-50">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="font-semibold text-green-900 text-sm">Loan Disbursed</span>
          </div>
          <p className="text-xs text-green-700 mb-3">{app.loan.loanNumber}</p>
          <Link to={`/loans/${app.loan.id}`}
            className="btn-secondary w-full text-center block text-sm">
            View Active Loan →
          </Link>
        </div>
      )}

      {/* ── REJECTED ────────────────────────────────────────────── */}
      {isRejected && (
        <div className="card p-5 border-red-200 bg-red-50">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <span className="font-semibold text-red-900 text-sm">Application Rejected</span>
          </div>
          {app.rejectionReason && (
            <p className="text-xs text-red-700">{app.rejectionReason}</p>
          )}
        </div>
      )}

      {/* ── Customer Quick-Card ──────────────────────────────────── */}
      {app.customer && (
        <div className="card p-4">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Customer</p>
          <Link to={`/customers/${app.customer.id}`}
            className="font-semibold text-primary-700 hover:underline block">
            {app.customer.firstName} {app.customer.lastName}
          </Link>
          <p className="text-xs text-gray-500">{app.customer.county}</p>
          {app.customerTierAtApplication && app.customerTierAtApplication !== 'STANDARD' && (
            <div className="mt-2">
              <AwardTierBadge tier={app.customerTierAtApplication} size="sm" />
            </div>
          )}
        </div>
      )}

      {/* ── Officer ─────────────────────────────────────────────── */}
      {app.officer && (
        <div className="card p-4">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Loan Officer</p>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-800">{app.officer.firstName} {app.officer.lastName}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LoanApplicationDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: app, isLoading, error } = useQuery<LoanApplication>({
    queryKey: ['application', id],
    queryFn:  () => loanApi.getApplication(id!),
    enabled:  !!id,
  });

  const [aiReviewEnabled, setAiReviewEnabled] = useState(false);
  const { data: aiReview, isFetching: aiLoading, refetch: refetchAi } = useQuery<AiApplicationReview>({
    queryKey: ['aiApplicationReview', id],
    queryFn: () => aiApi.applicationReview(id!),
    enabled: !!id && aiReviewEnabled,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (isLoading) return <LoadingSpinner />;
  if (error || !app) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-gray-600">Application not found.</p>
        <Link to="/loans" className="text-primary-700 text-sm hover:underline mt-2 block">
          ← Back to Loan Applications
        </Link>
      </div>
    );
  }

  const hasCashFlow = app.monthlyIncomeSnapshot != null || app.hadShockPastYear != null
    || app.hasSavingsBuffer != null || app.hasAlternativeIncome != null;

  return (
    <div>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="mb-6">
        <Link to="/loans" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="h-4 w-4" /> Back to Loan Applications
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">
                {app.applicationNumber || `Application #${app.id.slice(0, 8)}`}
              </h1>
              <StatusBadge status={app.status} />
              {app.ilpSegment && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                  ILP · {ILP_SEGMENT_LABELS[app.ilpSegment] ?? app.ilpSegment}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {app.customer && (
                <Link to={`/customers/${app.customer.id}`} className="text-primary-700 hover:underline font-medium">
                  {app.customer.firstName} {app.customer.lastName}
                </Link>
              )}
              {app.customer?.county && <span> · {app.customer.county}</span>}
              <span> · Submitted {new Date(app.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main content — 2/3 */}
        <div className="lg:col-span-2 space-y-5">

          {/* 1. Application Summary */}
          <SectionCard title="Application Summary" icon={FileText}>
            <dl>
              <InfoRow label="Requested Amount">KES {app.requestedAmountKes.toLocaleString()}</InfoRow>
              {app.approvedAmountKes != null && (
                <InfoRow label="Approved Amount">
                  <span className="text-green-700">KES {app.approvedAmountKes.toLocaleString()}</span>
                </InfoRow>
              )}
              {app.interestRatePct != null && (
                <InfoRow label="Interest Rate">{app.interestRatePct}% p.a.</InfoRow>
              )}
              <InfoRow label="Term">{app.termMonths} months</InfoRow>
              <InfoRow label="Loan Type">{app.loanType === 'GROUP' ? 'Group Loan' : 'Individual Loan'}</InfoRow>
              {app.loanGroup && (
                <InfoRow label="Group">{app.loanGroup.name}</InfoRow>
              )}
              {app.groupLoanShareKes != null && (
                <InfoRow label="Group Share">KES {app.groupLoanShareKes.toLocaleString()}</InfoRow>
              )}
              {app.loanProduct && (
                <InfoRow label="Loan Product">{app.loanProduct.name}</InfoRow>
              )}
              {app.repaymentMethod && (
                <InfoRow label="Repayment Method">{app.repaymentMethod.replace('_', ' ')}</InfoRow>
              )}
              {app.purposeCategory && (
                <InfoRow label="Purpose Category">{app.purposeCategory.replace(/_/g, ' ')}</InfoRow>
              )}
              <InfoRow label="Purpose of Loan">
                <span className="text-left block max-w-xs">{app.purposeOfLoan}</span>
              </InfoRow>
              {app.customerTierAtApplication && app.customerTierAtApplication !== 'STANDARD' && (
                <InfoRow label="Customer Tier">
                  <AwardTierBadge tier={app.customerTierAtApplication} size="sm" />
                </InfoRow>
              )}
              {(app.interestRateDiscountPct ?? 0) > 0 && (
                <InfoRow label="Rate Discount">−{app.interestRateDiscountPct}%</InfoRow>
              )}
              {(app.processingFeeDiscountPct ?? 0) > 0 && (
                <InfoRow label="Fee Discount">−{app.processingFeeDiscountPct}%</InfoRow>
              )}
            </dl>
          </SectionCard>

          {/* 2. Credit Score */}
          {app.creditScore && (
            <SectionCard title="Credit Score" icon={Shield}>
              <div className="flex items-center gap-4">
                <div className={clsx(
                  'rounded-full h-16 w-16 flex items-center justify-center text-xl font-bold text-white flex-shrink-0',
                  app.creditScore.totalScore >= 70 ? 'bg-green-500'
                    : app.creditScore.totalScore >= 50 ? 'bg-yellow-400'
                    : 'bg-red-500',
                )}>
                  {app.creditScore.totalScore}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Score out of 100</p>
                  <p className="text-sm font-semibold text-gray-900">{app.creditScore.recommendation}</p>
                </div>
              </div>
            </SectionCard>
          )}

          {/* 3. Cash Flow & Resilience */}
          {hasCashFlow && (
            <SectionCard title="Cash Flow & Resilience" icon={Banknote}>
              <dl>
                {app.monthlyIncomeSnapshot != null && (
                  <InfoRow label="Monthly Income">KES {app.monthlyIncomeSnapshot.toLocaleString()}</InfoRow>
                )}
                {app.monthlyExpensesSnapshot != null && (
                  <InfoRow label="Monthly Expenses">KES {app.monthlyExpensesSnapshot.toLocaleString()}</InfoRow>
                )}
                {app.monthlyIncomeSnapshot != null && app.monthlyExpensesSnapshot != null && (
                  <InfoRow label="Net Monthly">
                    <span className={(app.monthlyIncomeSnapshot - app.monthlyExpensesSnapshot) >= 0 ? 'text-green-700' : 'text-red-700'}>
                      KES {(app.monthlyIncomeSnapshot - app.monthlyExpensesSnapshot).toLocaleString()}
                    </span>
                  </InfoRow>
                )}
                {app.hadShockPastYear != null && (
                  <InfoRow label="Economic Shock (past yr)">{app.hadShockPastYear ? '⚠ Yes' : 'No'}</InfoRow>
                )}
                {app.hadShockPastYear && app.shockType && (
                  <InfoRow label="Shock Type">{app.shockType.replace(/_/g, ' ')}</InfoRow>
                )}
                {app.copingMechanism && (
                  <InfoRow label="Coping Mechanism">
                    <span className="text-left block max-w-xs">{app.copingMechanism}</span>
                  </InfoRow>
                )}
                {app.hasSavingsBuffer != null && (
                  <InfoRow label="Savings Buffer">{app.hasSavingsBuffer ? `Yes — ${app.savingsBufferMonths ?? '?'} months` : 'No'}</InfoRow>
                )}
                {app.hasAlternativeIncome != null && (
                  <InfoRow label="Alternative Income">{app.hasAlternativeIncome ? 'Yes' : 'No'}</InfoRow>
                )}
              </dl>
            </SectionCard>
          )}

          {/* 4. Collateral */}
          {(app.collateral?.length ?? 0) > 0 && (
            <SectionCard title="Collateral" icon={Shield}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-left pb-2 font-medium">Type</th>
                      <th className="text-left pb-2 font-medium">Description</th>
                      <th className="text-right pb-2 font-medium">Est. Value</th>
                      <th className="text-center pb-2 font-medium">Verified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {app.collateral!.map((c: LoanCollateral) => (
                      <tr key={c.id}>
                        <td className="py-2 text-gray-700 font-medium whitespace-nowrap">
                          {COLLATERAL_LABELS[c.collateralType] ?? c.collateralType}
                        </td>
                        <td className="py-2 text-gray-600 max-w-xs">{c.description}</td>
                        <td className="py-2 text-right text-gray-900 font-medium whitespace-nowrap">
                          KES {c.estimatedValueKes.toLocaleString()}
                        </td>
                        <td className="py-2 text-center">
                          {c.isVerified
                            ? <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* 5. ILP Assessment */}
          {app.ilpSegment && app.ilpAssessment && (() => {
            const ia = app.ilpAssessment;
            const dims = [
              { key: 'ownerScore',            score: ia.ownerScore },
              { key: 'businessScore',          score: ia.businessScore },
              { key: 'operationalRiskScore',   score: ia.operationalRiskScore },
              { key: 'cashFlowScore',          score: ia.cashFlowScore },
              { key: 'collateralScore',        score: ia.collateralScore },
            ];
            return (
              <SectionCard title={`ILP Assessment — ${ILP_SEGMENT_LABELS[app.ilpSegment!] ?? app.ilpSegment}`} icon={FileText}>
                <div className="space-y-3">
                  {dims.map(({ key, score }) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>{ILP_DIMENSION_LABELS[key] ?? key}</span>
                        <span className="font-semibold">{score}/100</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={clsx('h-full rounded-full', scoreColor(score))}
                          style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={clsx('rounded-full h-12 w-12 flex items-center justify-center text-base font-bold text-white',
                      scoreColor(ia.compositeScore))}>
                      {ia.compositeScore}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Composite Score</p>
                      <p className="text-sm font-semibold text-gray-900">{ia.ilpRecommendation}</p>
                    </div>
                  </div>
                </div>
                {ia.assessorNotes && (
                  <p className="text-xs text-gray-500 mt-2 italic">{ia.assessorNotes}</p>
                )}
              </SectionCard>
            );
          })()}

          {/* 6. BCC Session */}
          {app.bccSession && (
            <SectionCard title="BCC Session" icon={Gavel}>
              <dl>
                <InfoRow label="Status"><StatusBadge status={app.bccSession.status} /></InfoRow>
                {app.bccSession.outcome && (
                  <InfoRow label="Outcome"><StatusBadge status={app.bccSession.outcome} /></InfoRow>
                )}
                <InfoRow label="Quorum Required">{app.bccSession.quorumRequired} votes</InfoRow>
                {app.bccSession.outcomeNotes && (
                  <InfoRow label="Notes">
                    <span className="text-left block max-w-xs">{app.bccSession.outcomeNotes}</span>
                  </InfoRow>
                )}
              </dl>
              <Link to={`/bcc/${app.bccSession.id}`}
                className="btn-secondary w-full text-center block text-sm mt-2">
                View BCC Session <ExternalLink className="h-3.5 w-3.5 inline ml-1" />
              </Link>
            </SectionCard>
          )}

          {/* AI Application Review */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-indigo-500" /> AI Application Review
              </h2>
              {aiReview && (
                <button onClick={() => refetchAi()} disabled={aiLoading} title="Refresh"
                  className="text-gray-400 hover:text-indigo-600 disabled:opacity-40">
                  <RefreshCw className={`h-3.5 w-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            {!aiReviewEnabled ? (
              <button
                onClick={() => setAiReviewEnabled(true)}
                className="w-full py-2 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" /> Generate AI Review Brief
              </button>
            ) : aiLoading ? (
              <div className="flex items-center justify-center py-5 text-indigo-400 text-xs gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Analysing application…
              </div>
            ) : aiReview ? (
              <div className="space-y-4">
                {/* Headline + confidence */}
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      aiReview.recommendation === 'APPROVE' ? 'bg-green-100 text-green-700' :
                      aiReview.recommendation === 'CONDITIONAL' ? 'bg-yellow-100 text-yellow-700' :
                      aiReview.recommendation === 'REJECT' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>{aiReview.recommendation}</span>
                    <span className="text-xs text-gray-400">{aiReview.confidence}% confidence</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800">{aiReview.headline}</p>
                </div>

                {/* Strengths */}
                {aiReview.strengths.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-700 mb-1">Strengths</p>
                    <ul className="space-y-1">
                      {aiReview.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                          <span className="text-green-400 mt-0.5 flex-shrink-0">▲</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Risks */}
                {aiReview.risks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-700 mb-1">Risks</p>
                    <ul className="space-y-1">
                      {aiReview.risks.map((r, i) => (
                        <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                          <span className="text-red-400 mt-0.5 flex-shrink-0">▼</span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Outstanding Questions */}
                {aiReview.outstandingQuestions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-orange-700 mb-1">Questions to Ask Applicant</p>
                    <ul className="space-y-1">
                      {aiReview.outstandingQuestions.map((q, i) => (
                        <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                          <span className="text-orange-400 mt-0.5 flex-shrink-0">?</span>{q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggested Conditions */}
                {aiReview.suggestedConditions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1">Suggested Conditions</p>
                    <ul className="space-y-1">
                      {aiReview.suggestedConditions.map((c, i) => (
                        <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                          <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>{c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-gray-300 text-right">
                  {new Date(aiReview.generatedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ) : (
              <p className="text-xs text-red-500 text-center py-2">AI review unavailable</p>
            )}
          </div>

          {/* 7. Review Decision */}
          {['APPROVED', 'CONDITIONALLY_APPROVED', 'REJECTED'].includes(app.status) && (
            <SectionCard title="Review Decision" icon={CheckCircle}>
              <div className="flex items-center gap-3 mb-4">
                <StatusBadge status={app.status} />
                {app.reviewedAt && (
                  <span className="text-xs text-gray-400">
                    {new Date(app.reviewedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                )}
              </div>
              <dl>
                {app.approvedAmountKes != null && (
                  <InfoRow label="Approved Amount">
                    <span className="text-green-700 font-semibold">KES {app.approvedAmountKes.toLocaleString()}</span>
                  </InfoRow>
                )}
                {app.interestRatePct != null && (
                  <InfoRow label="Interest Rate">{app.interestRatePct}% p.a.</InfoRow>
                )}
                {app.reviewNotes && (
                  <InfoRow label="Notes">
                    <span className="text-left block max-w-xs">{app.reviewNotes}</span>
                  </InfoRow>
                )}
                {app.rejectionReason && (
                  <InfoRow label="Rejection Reason">
                    <span className="text-left block max-w-xs text-red-700">{app.rejectionReason}</span>
                  </InfoRow>
                )}
              </dl>
            </SectionCard>
          )}
        </div>

        {/* Sidebar — 1/3 */}
        <div className="space-y-4">
          <WorkflowPanel app={app} />
        </div>
      </div>
    </div>
  );
}
