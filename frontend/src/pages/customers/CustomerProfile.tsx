import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, MapPin, FileText, TrendingUp, CreditCard,
  Upload, AlertCircle, CheckCircle, BarChart3, Map, ShieldAlert, ClipboardList,
  Banknote, ChevronDown, ChevronUp, Pencil, Briefcase, Sparkles, RefreshCw,
} from 'lucide-react';
import { customerApi, qualityApi, interviewApi, ilpApi, aiApi, getErrorMessage } from '../../services/api';
import { Customer, KYCDocument, DataQualityFlag, CustomerInterview, Repayment, ILPSegment, BranchILPEligibilityResponse, CustomerTierSummary, AiCustomerSummary } from '../../types';
import clsx from 'clsx';
import MpesaStatements from './MpesaStatements';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useAuthStore } from '../../store/authStore';
import QualityFlagList from '../../components/common/QualityFlagList';
import AwardTierBadge, { LoyaltyCard } from '../../components/common/AwardTierBadge';

const DOC_TYPES = [
  { value: 'NATIONAL_ID_FRONT', label: 'National ID (Front)' },
  { value: 'NATIONAL_ID_BACK', label: 'National ID (Back)' },
  { value: 'PASSPORT_PHOTO', label: 'Passport Photo' },
  { value: 'KRA_PIN', label: 'KRA PIN Certificate' },
  { value: 'PROOF_OF_RESIDENCE', label: 'Proof of Residence' },
  { value: 'FARM_OWNERSHIP_PROOF', label: 'Farm/Land Ownership' },
  { value: 'GROUP_MEMBERSHIP_CERT', label: 'Group Membership Certificate' },
  { value: 'MPESA_STATEMENT', label: 'M-Pesa Statement' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
];

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [docType, setDocType] = useState('NATIONAL_ID_FRONT');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: ['customer', id],
    queryFn: () => customerApi.get(id!),
  });

  const { data: qualityFlags, refetch: refetchFlags } = useQuery({
    queryKey: ['qualityFlags', 'CUSTOMER', id],
    queryFn: () => qualityApi.getFlags('CUSTOMER', id!),
    enabled: !!id,
    staleTime: 30_000,
  });

  const { data: interviews } = useQuery<CustomerInterview[]>({
    queryKey: ['interviews', id],
    queryFn: () => interviewApi.list(id!),
    enabled: !!id,
    staleTime: 60_000,
  });

  const [showAllRepayments, setShowAllRepayments] = useState(false);
  const { data: repaymentsData } = useQuery<{ data: Repayment[] }>({
    queryKey: ['customerRepayments', id],
    queryFn: () => customerApi.getRepayments(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
  const repayments: Repayment[] = repaymentsData?.data ?? [];

  // ILP branch eligibility — fetch silently; hide on error
  const { data: ilpEligibility } = useQuery<BranchILPEligibilityResponse>({
    queryKey: ['ilpEligibility', customer?.branch?.id],
    queryFn: () => ilpApi.getBranchEligibility(customer!.branch!.id),
    enabled: !!customer?.branch?.id,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { data: tierSummary } = useQuery<CustomerTierSummary>({
    queryKey: ['customerTier', id],
    queryFn:  () => customerApi.getTier(id!),
    enabled:  !!id && customer?.kycStatus !== 'PENDING',
    staleTime: 5 * 60_000,
    retry: false,
  });

  const [aiSummaryEnabled, setAiSummaryEnabled] = useState(false);
  const { data: aiSummary, isFetching: aiLoading, refetch: refetchAi } = useQuery<AiCustomerSummary>({
    queryKey: ['aiCustomerSummary', id],
    queryFn: () => aiApi.customerSummary(id!),
    enabled: !!id && aiSummaryEnabled && customer?.kycStatus !== 'PENDING',
    staleTime: 5 * 60_000,
    retry: false,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => customerApi.uploadDocument(id!, docType, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', id] });
      setUploadFile(null);
      setUploadError(null);
    },
    onError: (err) => setUploadError(getErrorMessage(err)),
  });

  const kycMutation = useMutation({
    mutationFn: (data: { kycStatus: string }) => customerApi.updateKyc(id!, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer', id] }),
  });

  if (isLoading) return <LoadingSpinner />;
  if (!customer) return <div className="text-center py-12 text-gray-400">Customer not found</div>;

  const fp = customer.financialProfile;
  const farm = customer.farmProfile;
  const netMonthly = fp ? fp.monthlyFarmIncome + fp.monthlyOffFarmIncome - fp.monthlyHouseholdExpenses : 0;
  const latestScore = customer.creditScores?.[0];

  const canVerifyKyc = ['SUPERVISOR', 'BRANCH_MANAGER', 'ADMIN'].includes(user?.role ?? '');
  const canScore = customer.kycStatus !== 'PENDING';
  const hasDraftInterview = interviews?.some(i => i.status === 'DRAFT' && i.conductedById === user?.id);
  const completedInterviews = interviews?.filter(i => i.status === 'COMPLETED' && !i.interviewType?.startsWith('ILP_')) ?? [];

  // ILP derived state
  const ILP_SEGMENT_LABELS: Record<ILPSegment, string> = { FARMER: 'Farmer', LANDLORD: 'Landlord', SHOP_OWNER: 'Shop Owner' };
  const eligibleILPSegments = (ilpEligibility?.eligibilities ?? []).filter(e => e.status !== 'NOT_ELIGIBLE');
  const completedILPSegments = new Set<ILPSegment>(
    (interviews ?? [])
      .filter(i => i.status === 'COMPLETED' && i.interviewType?.startsWith('ILP_'))
      .map(i => i.ilpSegment)
      .filter(Boolean) as ILPSegment[],
  );
  const canApplyILP = customer.kycStatus === 'VERIFIED'
    && customer.amlStatus !== 'BLOCKED'
    && completedILPSegments.size > 0;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="page-title">{customer.firstName} {customer.lastName}</h1>
            <StatusBadge status={customer.kycStatus} />
            <StatusBadge status={customer.amlStatus} />
            {tierSummary && tierSummary.tier !== 'STANDARD' && (
              <AwardTierBadge tier={tierSummary.tier} size="sm" />
            )}
          </div>
          <p className="text-sm text-gray-500">
            {customer.customerNumber && (
              <span className="font-mono text-xs bg-gray-100 border border-gray-200 px-2 py-0.5 rounded mr-2 text-gray-600">{customer.customerNumber}</span>
            )}
            {customer.village}, {customer.county}
            {customer.yaraCustomerId && <> &bull; Yara ID: <span className="font-mono">{customer.yaraCustomerId}</span></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/customers/${id}/edit`} className="btn-secondary text-sm">
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          <Link to={`/customers/${id}/interview`} className="btn-secondary text-sm">
            <ClipboardList className="h-4 w-4" />
            {hasDraftInterview ? 'Continue Interview' : 'Start Interview'}
          </Link>
          {canScore && (
            <Link to={`/customers/${id}/score`} className="btn-secondary text-sm">
              <BarChart3 className="h-4 w-4" />
              Credit Score
            </Link>
          )}
          {['LOAN_OFFICER', 'SUPERVISOR'].includes(user?.role ?? '') && (
            <Link to={`/field/${id}`} className="btn-secondary text-sm">
              <Map className="h-4 w-4" />
              Field Tools
            </Link>
          )}
          {customer.kycStatus === 'VERIFIED' && customer.amlStatus !== 'BLOCKED' && (
            <Link
              to={`/customers/${id}/loan`}
              state={latestScore ? {
                maxAmount:     latestScore.maxLoanAmountKes,
                term:          latestScore.suggestedTermMonths,
                creditScoreId: latestScore.id,
              } : undefined}
              className="btn-primary text-sm"
            >
              <CreditCard className="h-4 w-4" />
              New Loan Application
            </Link>
          )}
          {/* ILP Segment Interview buttons */}
          {eligibleILPSegments.map(e => {
            const seg = e.segment;
            const done = completedILPSegments.has(seg);
            return (
              <Link
                key={seg}
                to={`/customers/${id}/ilp-interview/${seg.toLowerCase()}`}
                className={`btn-secondary text-sm relative ${done ? 'border-green-400' : ''}`}
                title={done ? `ILP ${ILP_SEGMENT_LABELS[seg]} interview completed` : `Start ILP ${ILP_SEGMENT_LABELS[seg]} interview`}
              >
                <Briefcase className="h-4 w-4" />
                ILP {ILP_SEGMENT_LABELS[seg]}
                {done && <CheckCircle className="h-3.5 w-3.5 text-green-500 absolute -top-1 -right-1" />}
              </Link>
            );
          })}
          {/* Apply ILP Loan button */}
          {canApplyILP && (
            <Link to={`/customers/${id}/ilp-apply`} className="btn-primary text-sm bg-indigo-600 hover:bg-indigo-700 border-indigo-600">
              <Briefcase className="h-4 w-4" />
              Apply ILP Loan
            </Link>
          )}
          {customer.kycStatus !== 'VERIFIED' && customer.kycStatus !== 'PENDING' && (
            <span className="text-xs text-gray-400 self-center">KYC needed for loan</span>
          )}
        </div>
      </div>

      {/* AML/PEP warning */}
      {customer.amlStatus === 'FLAGGED' && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-yellow-50 border border-yellow-300 p-3 text-sm text-yellow-800">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span><strong>AML Flagged:</strong> This customer requires Enhanced Due Diligence (EDD) before any loan can be disbursed.</span>
        </div>
      )}
      {customer.amlStatus === 'BLOCKED' && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-300 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <strong>AML BLOCKED:</strong> All loan activities are suspended for this customer. Contact Compliance.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Details */}
          <div className="card p-5">
            <h2 className="section-title flex items-center gap-2"><User className="h-4 w-4 text-gray-400" /> Personal Details</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><dt className="text-gray-500">Gender</dt><dd className="font-medium">{customer.gender}</dd></div>
              <div><dt className="text-gray-500">Marital Status</dt><dd className="font-medium">{customer.maritalStatus}</dd></div>
              <div><dt className="text-gray-500">Dependents</dt><dd className="font-medium">{customer.numberOfDependents}</dd></div>
              <div><dt className="text-gray-500">National ID</dt><dd className="font-mono">{customer.nationalId ?? '***'}</dd></div>
              <div><dt className="text-gray-500">Phone</dt><dd className="font-medium">{customer.phone}</dd></div>
              <div><dt className="text-gray-500">Branch</dt><dd className="font-medium">{customer.branch?.name}</dd></div>
            </dl>
          </div>

          {/* Farm Profile */}
          {farm && (
            <div className="card p-5">
              <h2 className="section-title flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-400" /> Farm Profile</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><dt className="text-gray-500">Farm Size</dt><dd className="font-medium">{farm.farmSize} acres</dd></div>
                <div><dt className="text-gray-500">Land Ownership</dt><dd className="font-medium">{farm.landOwnership}</dd></div>
                <div><dt className="text-gray-500">Primary Crop</dt><dd className="font-medium">{farm.primaryCrop}</dd></div>
                <div><dt className="text-gray-500">Secondary Crops</dt><dd className="font-medium">{farm.secondaryCrops?.join(', ') || '—'}</dd></div>
                <div><dt className="text-gray-500">Irrigation</dt><dd className="font-medium">{farm.irrigationType}</dd></div>
                <div><dt className="text-gray-500">Market Access</dt><dd className="font-medium">{farm.marketAccess}</dd></div>
                <div><dt className="text-gray-500">Yara Since</dt><dd className="font-medium">
                  {farm.yaraMemberSince ? new Date(farm.yaraMemberSince).getFullYear() : '—'}
                </dd></div>
                <div><dt className="text-gray-500">Yara Products</dt><dd className="font-medium">{farm.yaraProductsUsed?.join(', ') || '—'}</dd></div>
              </dl>
            </div>
          )}

          {/* Financial Summary */}
          {fp && (
            <div className="card p-5">
              <h2 className="section-title flex items-center gap-2"><TrendingUp className="h-4 w-4 text-gray-400" /> Financial Summary</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[
                  { label: 'Farm Income', value: `KES ${fp.monthlyFarmIncome.toLocaleString()}`, sub: '/mo' },
                  { label: 'Off-Farm Income', value: `KES ${fp.monthlyOffFarmIncome.toLocaleString()}`, sub: '/mo' },
                  { label: 'Net Disposable', value: `KES ${netMonthly.toLocaleString()}`, sub: '/mo', highlight: netMonthly > 0 },
                ].map(item => (
                  <div key={item.label} className={`rounded-lg p-3 text-center ${item.highlight ? 'bg-primary-50' : 'bg-gray-50'}`}>
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className={`font-bold text-sm ${item.highlight ? 'text-primary-700' : 'text-gray-800'}`}>{item.value}</p>
                    <p className="text-xs text-gray-400">{item.sub}</p>
                  </div>
                ))}
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><dt className="text-gray-500">CRB Status</dt><dd><StatusBadge status={fp.crbStatus} /></dd></div>
                <div><dt className="text-gray-500">Previous Loans</dt><dd>{fp.previousLoansCount}</dd></div>
                <div><dt className="text-gray-500">M-Pesa Avg</dt><dd>{fp.mpesaMonthlyAvgKes ? `KES ${fp.mpesaMonthlyAvgKes.toLocaleString()}` : '—'}</dd></div>
                <div><dt className="text-gray-500">Group Savings</dt><dd>{fp.groupMonthlySavingsKes ? `KES ${fp.groupMonthlySavingsKes.toLocaleString()}/mo` : '—'}</dd></div>
              </dl>
            </div>
          )}

          {/* Repayments */}
          {repayments.length > 0 && (() => {
            const totalRepaid = repayments.reduce((s, r) => s + r.amountKes, 0);
            const lastPayment = repayments[0]; // already sorted desc
            const daysSince = lastPayment
              ? Math.floor((Date.now() - new Date(lastPayment.paymentDate).getTime()) / 86_400_000)
              : null;
            const PREVIEW = 5;
            const visible = showAllRepayments ? repayments : repayments.slice(0, PREVIEW);

            const methodLabel: Record<string, string> = {
              MPESA: 'M-Pesa', BANK_TRANSFER: 'Bank', CASH: 'Cash',
            };

            return (
              <div className="card p-5">
                <h2 className="section-title flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-gray-400" />
                  Repayment History
                  <span className="ml-auto text-xs text-gray-400 font-normal">{repayments.length} entries</span>
                </h2>

                {/* Summary pills */}
                <div className="flex gap-3 mb-4">
                  <div className="flex-1 rounded-lg bg-green-50 p-3 text-center">
                    <p className="text-xs text-gray-500">Total Repaid</p>
                    <p className="text-sm font-bold text-green-700">KES {totalRepaid.toLocaleString()}</p>
                  </div>
                  <div className="flex-1 rounded-lg bg-gray-50 p-3 text-center">
                    <p className="text-xs text-gray-500">Last Payment</p>
                    <p className="text-sm font-bold text-gray-700">
                      {daysSince === 0 ? 'Today' : daysSince === 1 ? '1 day ago' : `${daysSince} days ago`}
                    </p>
                  </div>
                  {lastPayment?.loan?.outstandingBalKes != null && (
                    <div className="flex-1 rounded-lg bg-primary-50 p-3 text-center">
                      <p className="text-xs text-gray-500">Outstanding</p>
                      <p className="text-sm font-bold text-primary-700">
                        KES {lastPayment.loan.outstandingBalKes.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="pb-2 text-left font-medium text-gray-500">Date</th>
                        <th className="pb-2 text-left font-medium text-gray-500">Loan #</th>
                        <th className="pb-2 text-right font-medium text-gray-500">Amount</th>
                        <th className="pb-2 text-left font-medium text-gray-500">Method</th>
                        <th className="pb-2 text-left font-medium text-gray-500">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {visible.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="py-2 text-gray-500 whitespace-nowrap">
                            {new Date(r.paymentDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-2">
                            {r.loan ? (
                              <Link
                                to={`/loans/${r.loan.id}`}
                                className="font-mono text-primary-600 hover:underline"
                              >
                                {r.loan.loanNumber.slice(-8)}
                              </Link>
                            ) : '—'}
                          </td>
                          <td className="py-2 text-right font-medium text-gray-800">
                            KES {r.amountKes.toLocaleString()}
                          </td>
                          <td className="py-2">
                            <span className={clsx(
                              'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
                              r.method === 'MPESA' ? 'bg-green-100 text-green-700' :
                              r.method === 'BANK_TRANSFER' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600',
                            )}>
                              {methodLabel[r.method] ?? r.method}
                            </span>
                          </td>
                          <td className="py-2 text-gray-400 font-mono">{r.reference ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {repayments.length > PREVIEW && (
                  <button
                    onClick={() => setShowAllRepayments(v => !v)}
                    className="mt-3 flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium"
                  >
                    {showAllRepayments
                      ? <><ChevronUp className="h-3.5 w-3.5" /> Show less</>
                      : <><ChevronDown className="h-3.5 w-3.5" /> Show all {repayments.length} entries</>
                    }
                  </button>
                )}
              </div>
            );
          })()}

          {/* ILP Interviews */}
          {eligibleILPSegments.length > 0 && (
            <div className="card p-5">
              <h2 className="section-title flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-gray-400" />
                ILP Interviews
                <span className="ml-auto text-xs text-gray-400 font-normal">{eligibleILPSegments.length} eligible segment{eligibleILPSegments.length > 1 ? 's' : ''}</span>
              </h2>
              <div className="space-y-2">
                {eligibleILPSegments.map(e => {
                  const seg = e.segment;
                  const done = completedILPSegments.has(seg);
                  const ilpInterview = (interviews ?? [])
                    .filter(i => i.ilpSegment === seg && i.status === 'COMPLETED')
                    .sort((a, b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime())[0];
                  return (
                    <div key={seg} className={`rounded-lg border px-3 py-2.5 flex items-center justify-between gap-3 ${done ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{ILP_SEGMENT_LABELS[seg]}</p>
                        {ilpInterview ? (
                          <p className="text-xs text-gray-400">
                            Completed {new Date(ilpInterview.completedAt ?? ilpInterview.updatedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {ilpInterview.conductedBy && ` · ${ilpInterview.conductedBy.firstName} ${ilpInterview.conductedBy.lastName}`}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400">Not yet completed</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {done && <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium"><CheckCircle className="h-3.5 w-3.5" /> Done</span>}
                        <Link
                          to={`/customers/${id}/ilp-interview/${seg.toLowerCase()}`}
                          className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                        >
                          {done ? 'View / Redo' : 'Start'}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Past Interviews */}
          {completedInterviews.length > 0 && (
            <div className="card p-5">
              <h2 className="section-title flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-gray-400" />
                Pre-Screening Interviews
                <span className="ml-auto text-xs text-gray-400 font-normal">{completedInterviews.length} completed</span>
              </h2>
              <div className="space-y-2">
                {completedInterviews.map(iv => {
                  const pct = iv.scorePercent ?? 0;
                  const recColor: Record<string, string> = {
                    APPROVE: 'bg-green-100 text-green-700',
                    APPROVE_WITH_CONDITIONS: 'bg-yellow-100 text-yellow-700',
                    FURTHER_EVALUATION: 'bg-orange-100 text-orange-700',
                    DECLINE: 'bg-red-100 text-red-700',
                  };
                  const recLabel: Record<string, string> = {
                    APPROVE: 'Approve',
                    APPROVE_WITH_CONDITIONS: 'Conditional',
                    FURTHER_EVALUATION: 'Further Eval',
                    DECLINE: 'Decline',
                  };
                  return (
                    <div key={iv.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-xs text-gray-800">
                          {new Date(iv.completedAt ?? iv.updatedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-gray-400">
                          by {iv.conductedBy ? `${iv.conductedBy.firstName} ${iv.conductedBy.lastName}` : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          pct >= 70 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                        }`}>{pct.toFixed(0)}%</span>
                        {iv.recommendation && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${recColor[iv.recommendation] ?? 'bg-gray-100 text-gray-600'}`}>
                            {recLabel[iv.recommendation] ?? iv.recommendation}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Link to={`/customers/${id}/interview`} className="btn-secondary w-full mt-3 text-xs">
                <ClipboardList className="h-3.5 w-3.5" />
                {hasDraftInterview ? 'Continue Interview' : 'New Interview'}
              </Link>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Loyalty Tier Card */}
          {tierSummary && (
            <div className="card p-5">
              <h2 className="section-title flex items-center gap-2 mb-3">
                <span>🏆</span> Loyalty Tier
              </h2>
              <LoyaltyCard
                tier={tierSummary.tier}
                completedCycles={tierSummary.completedCycles}
                maxArrearsDays={tierSummary.maxArrearsDays}
                hasWriteOff={tierSummary.hasWriteOff}
                discounts={tierSummary.discounts}
                updatedAt={tierSummary.updatedAt}
              />
            </div>
          )}

          {/* Latest credit score */}
          {latestScore && (
            <div className="card p-5">
              <h2 className="section-title flex items-center gap-2"><BarChart3 className="h-4 w-4 text-gray-400" /> Credit Score</h2>
              <div className="text-center mb-3">
                <div className={`text-4xl font-bold ${
                  latestScore.totalScore >= 70 ? 'text-green-600' :
                  latestScore.totalScore >= 50 ? 'text-yellow-600' : 'text-red-600'
                }`}>{latestScore.totalScore}</div>
                <p className="text-xs text-gray-500 mt-1">out of 100</p>
                <StatusBadge status={latestScore.recommendation} />
              </div>
              <div className="space-y-2 text-xs">
                {[
                  { label: 'Cashflow', score: latestScore.cashflowScore ?? 0, max: 35 },
                  { label: 'Ability', score: latestScore.abilityScore ?? 0, max: 35 },
                  { label: 'Willingness', score: latestScore.willingnessScore ?? 0, max: 30 },
                ].map(({ label, score, max }) => (
                  <div key={label}>
                    <div className="flex justify-between text-gray-600 mb-1">
                      <span>{label}</span>
                      <span>{score}/{max}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-600 rounded-full" style={{ width: `${(score / max) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {latestScore.maxLoanAmountKes && (
                <div className="mt-3 p-2 bg-primary-50 rounded text-center">
                  <p className="text-xs text-gray-500">Max Loan Amount</p>
                  <p className="text-sm font-bold text-primary-700">KES {latestScore.maxLoanAmountKes.toLocaleString()}</p>
                </div>
              )}
              <Link to={`/customers/${id}/score`} className="btn-secondary w-full mt-3 text-xs">
                <BarChart3 className="h-3.5 w-3.5" /> Re-score
              </Link>
            </div>
          )}

          {/* AI Risk Summary */}
          {customer.kycStatus !== 'PENDING' && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title flex items-center gap-2 mb-0">
                  <Sparkles className="h-4 w-4 text-indigo-400" /> AI Risk Summary
                </h2>
                {aiSummary ? (
                  <button
                    onClick={() => refetchAi()}
                    disabled={aiLoading}
                    title="Refresh AI summary"
                    className="text-gray-400 hover:text-indigo-600 disabled:opacity-40"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                  </button>
                ) : null}
              </div>

              {!aiSummaryEnabled ? (
                <button
                  onClick={() => setAiSummaryEnabled(true)}
                  className="w-full py-2 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Generate AI Summary
                </button>
              ) : aiLoading ? (
                <div className="flex items-center justify-center py-4 text-indigo-400 text-xs gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Analysing customer data…
                </div>
              ) : aiSummary ? (
                <div className="space-y-3">
                  {/* Risk rating + action */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      aiSummary.riskRating === 'LOW' ? 'bg-green-100 text-green-700' :
                      aiSummary.riskRating === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                      aiSummary.riskRating === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {aiSummary.riskRating} RISK
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full ${
                      aiSummary.recommendedAction === 'PROCEED' ? 'bg-green-50 text-green-600' :
                      aiSummary.recommendedAction === 'CAUTION' ? 'bg-orange-50 text-orange-600' :
                      aiSummary.recommendedAction === 'DECLINE' ? 'bg-red-50 text-red-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {aiSummary.recommendedAction.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-gray-600 leading-relaxed">{aiSummary.summary}</p>

                  {/* Strengths */}
                  {aiSummary.strengths.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-green-700 mb-1">Strengths</p>
                      <ul className="space-y-0.5">
                        {aiSummary.strengths.map((s, i) => (
                          <li key={i} className="text-xs text-gray-600 flex gap-1.5"><span className="text-green-400 mt-0.5">▲</span>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Concerns */}
                  {aiSummary.concerns.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-700 mb-1">Concerns</p>
                      <ul className="space-y-0.5">
                        {aiSummary.concerns.map((c, i) => (
                          <li key={i} className="text-xs text-gray-600 flex gap-1.5"><span className="text-red-400 mt-0.5">▼</span>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs text-gray-300 text-right">
                    {new Date(aiSummary.generatedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-red-500 text-center py-2">AI summary unavailable</p>
              )}
            </div>
          )}

          {/* KYC Documents */}
          <div className="card p-5">
            <h2 className="section-title flex items-center gap-2"><FileText className="h-4 w-4 text-gray-400" /> KYC Documents</h2>
            <div className="space-y-2 mb-4">
              {customer.kycDocuments?.map((doc: KYCDocument) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-xs">{DOC_TYPES.find(d => d.value === doc.type)?.label ?? doc.type}</p>
                    <p className="text-xs text-gray-400">{doc.fileName}</p>
                  </div>
                  {doc.isVerified
                    ? <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    : <span className="text-xs text-yellow-600">Pending</span>
                  }
                </div>
              ))}
              {!customer.kycDocuments?.length && (
                <p className="text-xs text-gray-400 text-center py-3">No documents uploaded</p>
              )}
            </div>

            {/* Upload */}
            <div className="border-t pt-3">
              <select className="input text-xs mb-2" value={docType} onChange={e => setDocType(e.target.value)}>
                {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <label className="flex flex-col items-center gap-1 cursor-pointer rounded-lg border-2 border-dashed border-gray-200 p-3 hover:border-primary-400 hover:bg-primary-50 transition-colors">
                <Upload className="h-5 w-5 text-gray-400" />
                <span className="text-xs text-gray-500">{uploadFile ? uploadFile.name : 'Click to upload PDF/image'}</span>
                <input type="file" className="sr-only" accept=".jpg,.jpeg,.png,.pdf"
                  onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
              </label>
              {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
              <button
                onClick={() => uploadFile && uploadMutation.mutate(uploadFile)}
                disabled={!uploadFile || uploadMutation.isPending}
                className="btn-primary w-full mt-2 text-xs"
              >
                {uploadMutation.isPending ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          </div>

          {/* KYC Verification actions */}
          {canVerifyKyc && customer.kycStatus === 'SUBMITTED' && (
            <div className="card p-5">
              <h2 className="section-title text-sm">KYC Review</h2>
              <div className="space-y-2">
                <button
                  onClick={() => kycMutation.mutate({ kycStatus: 'VERIFIED' })}
                  disabled={kycMutation.isPending}
                  className="btn-primary w-full text-sm"
                >
                  <CheckCircle className="h-4 w-4" /> Approve KYC
                </button>
                <button
                  onClick={() => kycMutation.mutate({ kycStatus: 'REJECTED' })}
                  disabled={kycMutation.isPending}
                  className="btn-danger w-full text-sm"
                >
                  Reject KYC
                </button>
                <button
                  onClick={() => kycMutation.mutate({ kycStatus: 'REQUIRES_UPDATE' })}
                  disabled={kycMutation.isPending}
                  className="btn-secondary w-full text-sm"
                >
                  Request More Info
                </button>
              </div>
            </div>
          )}

          {/* M-Pesa Statement Analysis */}
          <div className="card p-5">
            <MpesaStatements customerId={id!} />
          </div>

          {/* Data Quality Flags */}
          {qualityFlags && qualityFlags.length > 0 && (
            <div className="card p-5">
              <h2 className="section-title flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-gray-400" />
                Data Quality
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                  qualityFlags.some((f: DataQualityFlag) => !f.isResolved && f.severity === 'CRITICAL')
                    ? 'bg-red-100 text-red-700'
                    : qualityFlags.some((f: DataQualityFlag) => !f.isResolved && f.severity === 'WARNING')
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {qualityFlags.filter((f: DataQualityFlag) => !f.isResolved).length} active
                </span>
              </h2>
              <QualityFlagList
                flags={qualityFlags}
                onFlagResolved={() => refetchFlags()}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
