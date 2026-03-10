import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { loanApi, kpiApi, bccApi, getErrorMessage } from '../../services/api';
import { Loan, CustomerRiskFlag } from '../../types';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AmortisationTable from '../../components/AmortisationTable';
import { useAuthStore } from '../../store/authStore';
import {
  AlertCircle, DollarSign, Banknote, CheckSquare, Square,
  CheckCircle2, ArrowRight, RefreshCw, Calendar, CreditCard,
  ClipboardList, Gavel,
} from 'lucide-react';
import clsx from 'clsx';
import AwardTierBadge from '../../components/common/AwardTierBadge';
import RiskFlagList from '../../components/common/RiskFlagList';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RepaymentForm {
  amountKes:   number;
  paymentDate: string;
  method:      string;
  reference?:  string;
  notes?:      string;
}

// ── Open BCC modal ────────────────────────────────────────────────────────────

function OpenBccModal({ applicationId, label, onClose, onSuccess }: {
  applicationId: string;
  label: string;
  onClose: () => void;
  onSuccess: (sessionId: string) => void;
}) {
  const [quorum, setQuorum] = useState(2);
  const [notes, setNotes]   = useState('');
  const [error, setError]   = useState('');

  const mutation = useMutation({
    mutationFn: () => bccApi.open({ loanApplicationId: applicationId, quorumRequired: quorum, outcomeNotes: notes || undefined }),
    onSuccess: (session) => onSuccess(session.id),
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

// ── Pre-disbursement checklist items ──────────────────────────────────────────

const CHECKLIST_ITEMS = [
  { id: 'agreement',   label: 'Loan agreement signed by customer' },
  { id: 'collateral',  label: 'Collateral documents verified and filed' },
  { id: 'mpesa',       label: 'M-Pesa / bank account confirmed with customer' },
  { id: 'firstdate',   label: 'First repayment date confirmed with customer' },
  { id: 'insurance',   label: 'Insurance / loan protection arranged (if applicable)' },
];

// ── Disbursal Panel ───────────────────────────────────────────────────────────

function DisbursalPanel({
  loan, onSuccess,
}: {
  loan: Loan;
  onSuccess: (loan: Loan) => void;
}) {
  const [checked, setChecked]   = useState<Record<string, boolean>>({});
  const [method, setMethod]     = useState<'MPESA' | 'BANK_TRANSFER' | 'CASH'>('MPESA');
  const [reference, setReference] = useState('');
  const [error, setError]       = useState<string | null>(null);

  const toggle = (id: string) => setChecked(c => ({ ...c, [id]: !c[id] }));
  const allChecked = CHECKLIST_ITEMS.every(item => checked[item.id]);

  const disburseMutation = useMutation({
    mutationFn: () => loanApi.disburse(loan.id, { disbursementMethod: method, disbursementReference: reference || undefined }),
    onSuccess: (result) => onSuccess(result),
    onError: (err) => setError(getErrorMessage(err)),
  });

  return (
    <div className="card p-5 space-y-5 border-primary-200">
      <div>
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Banknote className="h-4 w-4 text-primary-600" />
          Disburse Loan
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">Complete all checklist items before disbursing</p>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        {CHECKLIST_ITEMS.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
            className={clsx(
              'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all',
              checked[item.id]
                ? 'border-green-300 bg-green-50 text-green-900'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
            )}
          >
            {checked[item.id]
              ? <CheckSquare className="h-4 w-4 text-green-600 flex-shrink-0" />
              : <Square className="h-4 w-4 text-gray-300 flex-shrink-0" />}
            {item.label}
          </button>
        ))}
      </div>

      {/* Method & reference */}
      <div className="space-y-3">
        <div>
          <label className="label text-xs">Disbursement Method *</label>
          <div className="grid grid-cols-3 gap-2">
            {(['MPESA', 'BANK_TRANSFER', 'CASH'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={clsx(
                  'rounded-xl border-2 py-2 text-xs font-medium transition-all',
                  method === m
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300',
                )}
              >
                {m === 'MPESA' ? 'M-Pesa' : m === 'BANK_TRANSFER' ? 'Bank' : 'Cash'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label text-xs">
            {method === 'MPESA' ? 'M-Pesa Confirmation Code' : method === 'BANK_TRANSFER' ? 'Bank Reference / EFT No.' : 'Receipt / Voucher No.'}
          </label>
          <input
            className="input text-sm"
            placeholder={method === 'MPESA' ? 'e.g. QAB3X4YDEF' : method === 'BANK_TRANSFER' ? 'e.g. EFT20250226001' : 'e.g. RCT-00412'}
            value={reference}
            onChange={e => setReference(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      <button
        type="button"
        onClick={() => disburseMutation.mutate()}
        disabled={!allChecked || disburseMutation.isPending}
        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {disburseMutation.isPending ? 'Disbursing…' : (
          <><Banknote className="h-4 w-4" /> Confirm Disbursement</>
        )}
      </button>

      {!allChecked && (
        <p className="text-xs text-center text-gray-400">
          {CHECKLIST_ITEMS.filter(i => !checked[i.id]).length} checklist item(s) remaining
        </p>
      )}
    </div>
  );
}

// ── Post-disbursal Success Screen ─────────────────────────────────────────────

function DisbursalSuccessScreen({ loan }: { loan: Loan }) {
  const firstRepaymentDate = loan.disbursedAt
    ? new Date(new Date(loan.disbursedAt).setMonth(new Date(loan.disbursedAt).getMonth() + 1)).toISOString()
    : undefined;

  return (
    <div className="space-y-6">
      {/* Success banner */}
      <div className="card p-6 border-green-200 bg-green-50 text-center space-y-2">
        <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
        <h2 className="text-lg font-semibold text-green-900">Loan Disbursed Successfully</h2>
        <p className="text-sm text-green-700">
          KES {loan.principalKes.toLocaleString()} disbursed on{' '}
          {loan.disbursedAt ? new Date(loan.disbursedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) : 'today'}
        </p>
      </div>

      {/* Key info */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Calendar, label: 'First Payment Due', value: firstRepaymentDate ? new Date(firstRepaymentDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
          { icon: CreditCard, label: 'Monthly Instalment', value: `KES ${loan.installmentKes.toLocaleString()}` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-4 w-4 text-primary-600" />
              <p className="text-xs text-gray-500">{label}</p>
            </div>
            <p className="font-semibold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Amortisation */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Full Repayment Schedule</h3>
        <AmortisationTable
          principal={loan.principalKes}
          annualRatePct={loan.interestRatePct}
          termMonths={loan.termMonths}
          startDate={firstRepaymentDate}
        />
      </div>

      <Link to={`/customers/${loan.customerId}`} className="btn-secondary w-full text-center block">
        Back to Customer Profile
      </Link>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LoanDetail() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const qc       = useQueryClient();

  const [showRepayForm, setShowRepayForm]     = useState(false);
  const [disbursedLoan, setDisbursedLoan]     = useState<Loan | null>(null);
  const [showSchedule, setShowSchedule]       = useState(false);
  const [showBccModal, setShowBccModal]       = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  const canDisburse = ['SUPERVISOR', 'BRANCH_MANAGER', 'ADMIN'].includes(user?.role ?? '');
  const canOpenBcc  = ['BRANCH_MANAGER', 'ADMIN'].includes(user?.role ?? '');

  const { data: loan, isLoading } = useQuery<Loan>({
    queryKey: ['loan', id],
    queryFn:  () => loanApi.getLoan(id!),
  });

  const { data: riskFlags = [] } = useQuery<CustomerRiskFlag[]>({
    queryKey: ['riskFlags', id],
    queryFn:  () => kpiApi.getRiskFlags(id!),
    enabled:  !!loan?.ilpCycleNumber,
    staleTime: 30_000,
  });
  const activeRiskFlags = riskFlags.filter(f => f.isActive);

  const repayMutation = useMutation({
    mutationFn: (data: RepaymentForm) => loanApi.recordRepayment(id!, {
      ...data,
      paymentDate: new Date(data.paymentDate).toISOString(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loan', id] });
      setShowRepayForm(false);
      reset();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const { register, handleSubmit, reset } = useForm<RepaymentForm>({
    defaultValues: { paymentDate: new Date().toISOString().split('T')[0], method: 'MPESA' },
  });

  if (isLoading) return <LoadingSpinner />;
  if (!loan) return <div className="text-center py-12 text-gray-400">Loan not found</div>;

  // Show post-disbursal success screen right after disbursement
  if (disbursedLoan) return <DisbursalSuccessScreen loan={disbursedLoan} />;

  const repaid      = loan.repayments?.reduce((sum, r) => sum + r.amountKes, 0) ?? 0;
  const outstanding = loan.outstandingBalKes ?? loan.principalKes;
  const progress    = loan.totalRepayableKes > 0 ? ((repaid / loan.totalRepayableKes) * 100) : 0;

  const firstRepaymentDate = loan.disbursedAt
    ? new Date(new Date(loan.disbursedAt).setMonth(new Date(loan.disbursedAt).getMonth() + 1)).toISOString()
    : undefined;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Loan #{loan.loanNumber}</h1>
          <p className="text-sm text-gray-500 mt-1">
            <Link to={`/customers/${loan.customerId}`} className="text-primary-700 hover:underline">
              {loan.customer?.firstName} {loan.customer?.lastName}
            </Link>
            {' '}&bull; {loan.customer?.county}
            {loan.application?.applicationNumber && (
              <span className="ml-2 font-mono text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                {loan.application.applicationNumber}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status={loan.status} />
          {/* BCC button */}
          {canOpenBcc && loan.application && ['SUBMITTED', 'UNDER_REVIEW'].includes(loan.application.status) && (
            <button onClick={() => setShowBccModal(true)} className="btn-secondary text-sm">
              <Gavel className="h-4 w-4" /> Open BCC
            </button>
          )}
          {/* ILP follow-up link */}
          {loan.ilpCycleNumber && (
            <Link to={`/loans/${id}/follow-up`} className="btn-secondary text-sm">
              <ClipboardList className="h-4 w-4" /> ILP Follow-Up
            </Link>
          )}
          {/* Repeat loan CTA */}
          {loan.status === 'COMPLETED' && (
            <button
              onClick={() => navigate(`/customers/${loan.customerId}/apply`, {
                state: { maxAmount: loan.principalKes, fromLoanId: loan.id },
              })}
              className="btn-primary text-sm"
            >
              <RefreshCw className="h-4 w-4" /> Next Loan Cycle
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />{error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Principal',          value: `KES ${loan.principalKes.toLocaleString()}` },
          { label: 'Interest Rate',      value: `${loan.interestRatePct}% p.a.` },
          { label: 'Monthly Instalment', value: `KES ${loan.installmentKes.toLocaleString()}` },
          { label: 'Outstanding',        value: `KES ${outstanding.toLocaleString()}`, highlight: true },
        ].map(item => (
          <div key={item.label} className={`card p-4 ${item.highlight ? 'border-primary-200 bg-primary-50' : ''}`}>
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className={`font-bold text-sm mt-1 ${item.highlight ? 'text-primary-700' : 'text-gray-900'}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Repayment progress */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Repayment Progress</h2>
          <span className="text-sm text-gray-500">{progress.toFixed(0)}% repaid</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-primary-600 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>Paid: KES {repaid.toLocaleString()}</span>
          <span>Total: KES {loan.totalRepayableKes.toLocaleString()}</span>
        </div>
        {loan.daysInArrears > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg p-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />{loan.daysInArrears} days in arrears
          </div>
        )}
      </div>

      {/* Completed CTA */}
      {loan.status === 'COMPLETED' && (
        <div className="card p-5 mb-6 bg-green-50 border-green-200 flex items-center justify-between">
          <div>
            <p className="font-semibold text-green-900">Loan Fully Repaid 🎉</p>
            <p className="text-sm text-green-700 mt-0.5">This customer is eligible for another loan cycle.</p>
          </div>
          <button
            onClick={() => navigate(`/customers/${loan.customerId}/apply`, {
              state: { maxAmount: Math.round(loan.principalKes * 1.2), fromLoanId: loan.id },
            })}
            className="btn-primary text-sm flex-shrink-0"
          >
            Apply for Next Loan <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Repayment history */}
        <div className="card">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Repayment History</h2>
            {loan.status === 'ACTIVE' && (
              <button onClick={() => setShowRepayForm(s => !s)} className="btn-primary text-xs py-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Record Payment
              </button>
            )}
          </div>

          {showRepayForm && (
            <form
              onSubmit={handleSubmit(data => repayMutation.mutate(data))}
              className="p-4 border-b bg-gray-50 space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Amount (KES) *</label>
                  <input type="number" min="1" className="input text-sm"
                    placeholder={String(loan.installmentKes)}
                    {...register('amountKes', { required: true, valueAsNumber: true })} />
                </div>
                <div>
                  <label className="label text-xs">Payment Date *</label>
                  <input type="date" className="input text-sm"
                    {...register('paymentDate', { required: true })} />
                </div>
                <div>
                  <label className="label text-xs">Method</label>
                  <select className="input text-sm" {...register('method')}>
                    <option value="MPESA">M-Pesa</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Reference (M-Pesa code, etc.)</label>
                  <input className="input text-sm" placeholder="e.g. QAB3XDEF4"
                    {...register('reference')} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={repayMutation.isPending} className="btn-primary flex-1 text-sm">
                  {repayMutation.isPending ? 'Saving…' : 'Save Payment'}
                </button>
                <button type="button" onClick={() => setShowRepayForm(false)} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div>
            {loan.repayments?.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">KES {r.amountKes.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{r.method}{r.reference ? ` · ${r.reference}` : ''}</p>
                </div>
                <p className="text-xs text-gray-500">{new Date(r.paymentDate).toLocaleDateString('en-KE')}</p>
              </div>
            ))}
            {!loan.repayments?.length && (
              <p className="text-center text-gray-400 text-sm py-8">No payments recorded yet</p>
            )}
          </div>
        </div>

        {/* Right column: details + disbursement */}
        <div className="space-y-4">
          {/* Loan details card */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Loan Details</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Term</dt>
                <dd>{loan.termMonths} months</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Disbursed</dt>
                <dd>{loan.disbursedAt ? new Date(loan.disbursedAt).toLocaleDateString('en-KE') : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Maturity Date</dt>
                <dd>{loan.maturityDate ? new Date(loan.maturityDate).toLocaleDateString('en-KE') : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Disbursement Method</dt>
                <dd>{(loan as { disbursementMethod?: string }).disbursementMethod?.replace('_', ' ') ?? '—'}</dd>
              </div>
              {firstRepaymentDate && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">First Payment Due</dt>
                  <dd className="font-medium text-primary-700">
                    {new Date(firstRepaymentDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                  </dd>
                </div>
              )}
              {loan.application?.customerTierAtApplication && loan.application.customerTierAtApplication !== 'STANDARD' && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-2">
                  <dt className="text-gray-500">Loyalty Tier</dt>
                  <dd><AwardTierBadge tier={loan.application.customerTierAtApplication} size="sm" /></dd>
                </div>
              )}
              {loan.application?.interestRateDiscountPct && loan.application.interestRateDiscountPct > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Rate Discount</dt>
                  <dd className="text-green-600 font-medium">−{loan.application.interestRateDiscountPct}% p.a.</dd>
                </div>
              )}
              {loan.application?.processingFeeDiscountPct && loan.application.processingFeeDiscountPct > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Fee Discount</dt>
                  <dd className="text-green-600 font-medium">−{loan.application.processingFeeDiscountPct}% on fee</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Amortisation schedule (active/completed loans) */}
          {(['ACTIVE', 'COMPLETED', 'DEFAULTED'].includes(loan.status)) && (
            <div className="card p-5">
              <button
                type="button"
                onClick={() => setShowSchedule(s => !s)}
                className="w-full flex items-center justify-between text-sm font-semibold text-gray-900"
              >
                <span>Repayment Schedule</span>
                <span className="text-primary-600 text-xs">{showSchedule ? 'Hide' : 'Show'}</span>
              </button>
              {showSchedule && (
                <div className="mt-4">
                  <AmortisationTable
                    principal={loan.principalKes}
                    annualRatePct={loan.interestRatePct}
                    termMonths={loan.termMonths}
                    startDate={firstRepaymentDate}
                    compact={loan.termMonths > 4}
                  />
                </div>
              )}
            </div>
          )}

          {/* ILP Assessment summary */}
          {loan.application?.ilpAssessment && (() => {
            const a = loan.application.ilpAssessment;
            const seg = loan.application.ilpSegment;
            const recColor = a.ilpRecommendation === 'APPROVE'
              ? 'bg-green-100 text-green-700 border-green-200'
              : a.ilpRecommendation === 'CONDITIONAL'
              ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
              : 'bg-red-100 text-red-700 border-red-200';
            const segLabels: Record<string, string> = { FARMER: 'Farmer', LANDLORD: 'Landlord', SHOP_OWNER: 'Shop Owner' };
            return (
              <div className="card p-5">
                <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  ILP Assessment
                  {seg && <span className="text-xs font-medium px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{segLabels[seg] ?? seg}</span>}
                </h2>
                <div className={`mb-3 px-3 py-2 rounded-lg border text-sm font-semibold ${recColor}`}>
                  {a.ilpRecommendation === 'APPROVE' ? '✓ Approve' : a.ilpRecommendation === 'CONDITIONAL' ? '⚠ Conditional' : '✗ Decline'}
                  <span className="ml-2 font-bold text-lg">{a.compositeScore}</span>
                  <span className="text-xs font-normal ml-1">/ 100</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Owner/Character', score: a.ownerScore, weight: '20%' },
                    { label: 'Business Quality', score: a.businessScore, weight: '25%' },
                    { label: 'Operational Risk', score: a.operationalRiskScore, weight: '20%' },
                    { label: 'Cash Flow', score: a.cashFlowScore, weight: '25%' },
                    { label: 'Collateral', score: a.collateralScore, weight: '10%' },
                  ].map(({ label, score, weight }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                        <span>{label}</span>
                        <span>{score}/100 <span className="text-gray-400">({weight})</span></span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${score >= 75 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {loan.ilpCycleNumber && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>Cycle #{loan.ilpCycleNumber}</span>
                    <Link to={`/loans/${id}/follow-up`} className="text-primary-600 hover:underline font-medium">
                      View Follow-Up Schedule →
                    </Link>
                  </div>
                )}
              </div>
            );
          })()}

          {/* KPI Risk Flags */}
          {loan.ilpCycleNumber && riskFlags.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                KPI Risk Flags
                {activeRiskFlags.length > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    activeRiskFlags.some(f => f.severity === 'RED')
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {activeRiskFlags.length} active
                  </span>
                )}
              </h2>
              <RiskFlagList
                flags={riskFlags}
                loanId={id!}
                onFlagChange={() => qc.invalidateQueries({ queryKey: ['riskFlags', id] })}
                showResolved={false}
                compact={true}
              />
            </div>
          )}

          {/* Disbursement panel */}
          {canDisburse && loan.status === 'PENDING_DISBURSEMENT' && (
            <DisbursalPanel loan={loan} onSuccess={setDisbursedLoan} />
          )}
        </div>
      </div>

      {/* BCC modal */}
      {showBccModal && loan.application && (
        <OpenBccModal
          applicationId={loan.application.id}
          label={`${loan.customer?.firstName} ${loan.customer?.lastName} — KES ${loan.principalKes.toLocaleString()}`}
          onClose={() => setShowBccModal(false)}
          onSuccess={(sessionId) => navigate(`/bcc/${sessionId}`)}
        />
      )}
    </div>
  );
}
