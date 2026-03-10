import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { customerApi, interviewApi, ilpApi, loanApi, getErrorMessage } from '../../services/api';
import {
  BranchILPEligibilityResponse, ILPSegment, ILPSaveAssessmentPayload,
} from '../../types';
import {
  computeOwnerScore, computeBusinessScore, computeOpsScore,
  computeCashFlowScore, computeCollateralScore, computeCompositeScore,
  deriveRecommendation, calcMonthlyInstallment,
} from '../../utils/ilpScoring';
import { useAuthStore } from '../../store/authStore';
import OwnerAssessmentForm, { OwnerFormData } from '../../components/ilp/OwnerAssessmentForm';
import FarmerBusinessAssessment, { FarmerBusinessData } from '../../components/ilp/FarmerBusinessAssessment';
import LandlordBusinessAssessment, { LandlordBusinessData } from '../../components/ilp/LandlordBusinessAssessment';
import ShopOwnerBusinessAssessment, { ShopOwnerBusinessData } from '../../components/ilp/ShopOwnerBusinessAssessment';
import OperationalRiskForm from '../../components/ilp/OperationalRiskForm';
import CashFlowTable, { CashFlowData } from '../../components/ilp/CashFlowTable';
import ILPCollateralStep, { CollateralData } from '../../components/ilp/ILPCollateralStep';
import ILPScoreDisplay from '../../components/ilp/ILPScoreDisplay';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import JourneyGate, { GateRequirement } from '../../components/common/JourneyGate';
import { buildJourneySteps } from '../../components/common/CustomerJourneyBar';

const SEGMENT_LABELS: Record<ILPSegment, string> = {
  FARMER: 'Farmer', LANDLORD: 'Landlord', SHOP_OWNER: 'Shop Owner',
};

const SEGMENT_RANGES: Record<ILPSegment, { min: number; max: number; maxTermMonths: number }> = {
  FARMER:     { min: 100_000, max: 500_000, maxTermMonths: 24 },
  LANDLORD:   { min: 200_000, max: 1_000_000, maxTermMonths: 36 },
  SHOP_OWNER: { min: 100_000, max: 500_000, maxTermMonths: 24 },
};

const STEP_LABELS = [
  'Segment', 'Owner', 'Business', 'Operations', 'Cash Flow', 'Collateral', 'Review',
];

// ── Step 0: Segment Selection ────────────────────────────────────────────────

function SegmentStep({
  eligibility, selectedSegment, onSelect, customerId, ilpInterview,
}: {
  eligibility?: BranchILPEligibilityResponse;
  selectedSegment?: ILPSegment;
  onSelect: (s: ILPSegment) => void;
  customerId: string;
  ilpInterview?: Record<ILPSegment, boolean>;
}) {
  const segments: ILPSegment[] = ['FARMER', 'LANDLORD', 'SHOP_OWNER'];
  const eligibleSegs = eligibility?.eligibilities
    .filter(e => e.status !== 'NOT_ELIGIBLE')
    .map(e => e.segment) ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Select the ILP vertical for this application. Only segments available at your branch are shown.
      </p>
      {eligibleSegs.length === 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 inline mr-2 -mt-0.5" />
          Your branch does not have any ILP segment eligibility. Please contact your Branch Manager or Admin.
        </div>
      )}
      {segments.map(seg => {
        const eligible = eligibleSegs.includes(seg);
        const hasInterview = ilpInterview?.[seg] ?? false;
        const range = SEGMENT_RANGES[seg];
        return (
          <button key={seg} type="button"
            disabled={!eligible}
            onClick={() => onSelect(seg)}
            className={`w-full flex items-start gap-4 px-5 py-4 rounded-xl border-2 text-left transition-all ${
              selectedSegment === seg
                ? 'border-primary-600 bg-primary-50'
                : eligible
                  ? 'border-gray-200 bg-white hover:border-primary-300'
                  : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-gray-900">{SEGMENT_LABELS[seg]}</span>
                {!eligible && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Not Eligible</span>}
                {eligible && !hasInterview && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">No Interview</span>
                )}
                {hasInterview && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Interview Done
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                KES {(range.min / 1000).toFixed(0)}K – {(range.max / 1_000_000 >= 1 ? (range.max / 1_000_000).toFixed(1) + 'M' : (range.max / 1000).toFixed(0) + 'K')} · up to {range.maxTermMonths} months
              </p>
              {eligible && !hasInterview && (
                <Link to={`/customers/${customerId}/ilp-interview/${seg.toLowerCase()}`}
                  className="mt-2 inline-block text-xs text-primary-700 underline"
                  onClick={e => e.stopPropagation()}
                >
                  → Complete ILP {SEGMENT_LABELS[seg]} Interview first
                </Link>
              )}
            </div>
            {selectedSegment === seg && <CheckCircle className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />}
          </button>
        );
      })}
    </div>
  );
}

// ── Step 6: Review & Submit ──────────────────────────────────────────────────

function ReviewStep({
  segment, ownerData, businessData, opsData, cashFlowData, collateralData,
  assessorNotes, onNotesChange, loanAmount, termMonths, loanProductId: _loanProductId,
  onLoanAmountChange, onTermChange,
}: {
  segment: ILPSegment;
  ownerData: Partial<OwnerFormData>;
  businessData: Record<string, unknown>;
  opsData: Record<string, unknown>;
  cashFlowData: Partial<CashFlowData>;
  collateralData: Partial<CollateralData>;
  assessorNotes: string;
  onNotesChange: (s: string) => void;
  loanAmount: number;
  termMonths: number;
  loanProductId?: string;
  onLoanAmountChange: (n: number) => void;
  onTermChange: (n: number) => void;
}) {
  const range = SEGMENT_RANGES[segment];
  const installment = calcMonthlyInstallment(loanAmount, 18, termMonths);

  const ownerScore    = computeOwnerScore(ownerData);
  const bizScore      = computeBusinessScore(segment, businessData);
  const opsScore      = computeOpsScore(segment, opsData);
  const { score: cfScore, dsr, hardBlock } = computeCashFlowScore({
    totalMonthlyIncome:  cashFlowData.totalMonthlyIncome ?? 0,
    existingMonthlyDebt: cashFlowData.existingMonthlyDebt ?? 0,
    newInstallmentKes:   installment,
  });
  const collScore = computeCollateralScore(collateralData.items ?? [], loanAmount);
  const composite = computeCompositeScore({
    ownerScore: ownerScore, businessScore: bizScore,
    operationalRiskScore: opsScore, cashFlowScore: cfScore, collateralScore: collScore,
  });
  const recommendation = deriveRecommendation(composite);

  return (
    <div className="space-y-6">
      {/* Loan details */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800">Loan Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Loan Amount (KES {(range.min / 1000).toFixed(0)}K–{(range.max / 1_000_000 >= 1 ? (range.max / 1_000_000).toFixed(1) + 'M' : (range.max / 1000).toFixed(0) + 'K')})
            </label>
            <input type="number" min={range.min} max={range.max} step={10000}
              value={loanAmount || ''}
              onChange={e => onLoanAmountChange(parseFloat(e.target.value) || 0)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Term (months, max {range.maxTermMonths})
            </label>
            <input type="number" min={1} max={range.maxTermMonths}
              value={termMonths || ''}
              onChange={e => onTermChange(parseInt(e.target.value) || 1)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-white border border-gray-200 rounded-lg py-3">
            <div className="text-base font-bold text-gray-900">KES {installment.toLocaleString('en-KE')}</div>
            <div className="text-xs text-gray-400">Monthly installment</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg py-3">
            <div className="text-base font-bold text-gray-900">18%</div>
            <div className="text-xs text-gray-400">Annual interest rate</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg py-3">
            <div className={`text-base font-bold ${hardBlock ? 'text-red-600' : dsr > 40 ? 'text-amber-600' : 'text-green-600'}`}>
              {dsr.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400">DSR</div>
          </div>
        </div>
        {hardBlock && (
          <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-xs text-red-700 font-medium">
            ⛔ DSR exceeds 50% — reduce the loan amount or increase income before submitting.
          </div>
        )}
      </div>

      {/* Score display */}
      <ILPScoreDisplay
        ownerScore={ownerScore} businessScore={bizScore} operationalRiskScore={opsScore}
        cashFlowScore={cfScore} collateralScore={collScore}
        compositeScore={composite} ilpRecommendation={recommendation} dsr={dsr}
      />

      {/* Assessor notes */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1.5">
          Assessor Notes <span className="text-gray-400 font-normal">(optional, max 2000 chars)</span>
        </label>
        <textarea
          value={assessorNotes}
          onChange={e => onNotesChange(e.target.value)}
          maxLength={2000}
          rows={4}
          className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="LO narrative: key strengths, risk mitigants, loan purpose justification…"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{assessorNotes.length}/2000</p>
      </div>
    </div>
  );
}

// ── Main Wizard ──────────────────────────────────────────────────────────────

export default function ILPApplicationForm() {
  const { id: customerId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [step, setStep] = useState(0);
  const [segment, setSegment] = useState<ILPSegment | undefined>();
  const [ownerData, setOwnerData] = useState<Partial<OwnerFormData>>({});
  const [businessData, setBusinessData] = useState<Record<string, unknown>>({});
  const [opsData, setOpsData] = useState<Record<string, unknown>>({});
  const [cashFlowData, setCashFlowData] = useState<Partial<CashFlowData>>({});
  const [collateralData, setCollateralData] = useState<Partial<CollateralData>>({ items: [] });
  const [assessorNotes, setAssessorNotes] = useState('');
  const [loanAmount, setLoanAmount] = useState(100_000);
  const [termMonths, setTermMonths] = useState(12);
  const [submitError, setSubmitError] = useState('');

  // Fetch customer
  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customerApi.get(customerId!),
    enabled: !!customerId,
  });

  // Fetch branch eligibility
  const { data: eligibility } = useQuery<BranchILPEligibilityResponse>({
    queryKey: ['ilpEligibility', user?.branchId],
    queryFn: () => ilpApi.getBranchEligibility(user!.branchId!),
    enabled: !!user?.branchId,
  });

  // Check ILP interview completion for each segment
  const ilpInterview: Record<ILPSegment, boolean> = { FARMER: false, LANDLORD: false, SHOP_OWNER: false };
  const { data: farmerInterview }     = useQuery({ queryKey: ['ilpInterview', customerId, 'FARMER'],     queryFn: () => interviewApi.getILP(customerId!, 'FARMER').catch(() => null),     enabled: !!customerId });
  const { data: landlordInterview }   = useQuery({ queryKey: ['ilpInterview', customerId, 'LANDLORD'],   queryFn: () => interviewApi.getILP(customerId!, 'LANDLORD').catch(() => null),   enabled: !!customerId });
  const { data: shopOwnerInterview }  = useQuery({ queryKey: ['ilpInterview', customerId, 'SHOP_OWNER'], queryFn: () => interviewApi.getILP(customerId!, 'SHOP_OWNER').catch(() => null), enabled: !!customerId });
  if (farmerInterview)    ilpInterview['FARMER']     = true;
  if (landlordInterview)  ilpInterview['LANDLORD']   = true;
  if (shopOwnerInterview) ilpInterview['SHOP_OWNER'] = true;

  // Pre-populate from interview when segment is selected
  useEffect(() => {
    if (!segment) return;
    const interviewData =
      segment === 'FARMER'     ? farmerInterview :
      segment === 'LANDLORD'   ? landlordInterview :
      shopOwnerInterview;

    if (!interviewData?.answers) return;
    const ans = interviewData.answers as Record<string, unknown>;

    // Prefill owner data from Section A answers
    if (ans['A1'] !== undefined) {
      setOwnerData(prev => ({
        ...prev,
        experienceYears: Number(ans['A1']) || 0,
        referenceCount: (ans['A5'] && ans['A5b']) ? 2 : (ans['A5'] ? 1 : 0),
      }));
    }
    // Segment-specific prefill could be extended here
  }, [segment, farmerInterview, landlordInterview, shopOwnerInterview]);

  // Journey gate check
  const kycVerified = customer?.kycStatus === 'VERIFIED';
  const interviewCompleted = !!(farmerInterview || landlordInterview || shopOwnerInterview);
  const journeySteps = buildJourneySteps({ kycVerified, interviewCompleted });

  const gateRequirements: GateRequirement[] = [
    {
      label: 'KYC Verification',
      description: 'The customer must be KYC-verified before applying for an ILP loan.',
      actionLabel: 'Complete KYC',
      actionTo: `/customers/${customerId}`,
      completed: kycVerified,
    },
    {
      label: 'ILP Field Interview',
      description: 'At least one ILP vertical interview must be completed for this customer before starting the wizard.',
      actionLabel: 'Start Interview',
      actionTo: `/customers/${customerId}/ilp-interview/farmer`,
      completed: interviewCompleted,
    },
  ];

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!segment) throw new Error('No segment selected');
      const installment = calcMonthlyInstallment(loanAmount, 18, termMonths);
      const { hardBlock, dsr } = computeCashFlowScore({
        totalMonthlyIncome:  cashFlowData.totalMonthlyIncome ?? 0,
        existingMonthlyDebt: cashFlowData.existingMonthlyDebt ?? 0,
        newInstallmentKes:   installment,
      });
      if (hardBlock) throw new Error(`DSR of ${dsr.toFixed(1)}% exceeds 50%. Reduce loan amount or verify income.`);

      // Step 1: Create loan application
      const app = await loanApi.apply({
        customerId,
        requestedAmountKes: loanAmount,
        purposeOfLoan: assessorNotes || `ILP ${SEGMENT_LABELS[segment]} loan`,
        termMonths,
        loanType: 'INDIVIDUAL',
        ilpSegment: segment,
        monthlyIncomeSnapshot: cashFlowData.totalMonthlyIncome,
        monthlyExpensesSnapshot: cashFlowData.existingMonthlyDebt,
        hasAlternativeIncome: false,
      });

      // Step 2: Save ILP assessment
      const payload: ILPSaveAssessmentPayload = {
        segment,
        ownerData: ownerData as Record<string, unknown>,
        businessData,
        operationalRiskData: opsData,
        cashFlowData: {
          totalMonthlyIncome: cashFlowData.totalMonthlyIncome ?? 0,
          existingMonthlyDebt: cashFlowData.existingMonthlyDebt ?? 0,
          newInstallmentKes: installment,
          months: cashFlowData.months,
        },
        collateralData: {
          items: (collateralData.items ?? []).map(i => ({ type: i.type, valueKes: i.valueKes, isVerified: i.isVerified })),
          loanAmountKes: loanAmount,
        },
        assessorNotes,
      };
      await ilpApi.saveAssessment(app.id, payload);
      return app;
    },
    onSuccess: (app) => navigate(`/loans/${app.id}`),
    onError: (err) => setSubmitError(getErrorMessage(err)),
  });

  if (loadingCustomer) return <LoadingSpinner />;

  return (
    <JourneyGate title="ILP Loan Application" requirements={gateRequirements} journeySteps={journeySteps}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link to={`/customers/${customerId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
            <ChevronLeft className="h-4 w-4" /> Back to Customer
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            ILP Application{segment ? ` — ${SEGMENT_LABELS[segment]}` : ''}
          </h1>
          {customer && (
            <p className="text-gray-500 mt-1 text-sm">
              {customer.firstName} {customer.lastName} · {customer.county}
            </p>
          )}
        </div>

        {/* Step progress */}
        <div className="flex gap-0 mb-8 overflow-x-auto">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex items-center flex-shrink-0">
              <div className={`flex flex-col items-center ${i < STEP_LABELS.length - 1 ? 'mr-1' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  i < step ? 'bg-green-500 border-green-500 text-white' :
                  i === step ? 'bg-primary-700 border-primary-700 text-white ring-4 ring-primary-100' :
                  'bg-white border-gray-300 text-gray-400'
                }`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-[10px] mt-1 whitespace-nowrap ${i === step ? 'text-primary-700 font-semibold' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`w-6 h-0.5 mx-0.5 mb-5 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          {step === 0 && (
            <SegmentStep
              eligibility={eligibility}
              selectedSegment={segment}
              onSelect={s => { setSegment(s); setLoanAmount(SEGMENT_RANGES[s].min); }}
              customerId={customerId!}
              ilpInterview={ilpInterview}
            />
          )}
          {step === 1 && (
            <OwnerAssessmentForm data={ownerData} onChange={setOwnerData} />
          )}
          {step === 2 && segment === 'FARMER' && (
            <FarmerBusinessAssessment data={businessData as Partial<FarmerBusinessData>} onChange={d => setBusinessData(d as Record<string, unknown>)} />
          )}
          {step === 2 && segment === 'LANDLORD' && (
            <LandlordBusinessAssessment data={businessData as Partial<LandlordBusinessData>} onChange={d => setBusinessData(d as Record<string, unknown>)} />
          )}
          {step === 2 && segment === 'SHOP_OWNER' && (
            <ShopOwnerBusinessAssessment data={businessData as Partial<ShopOwnerBusinessData>} onChange={d => setBusinessData(d as Record<string, unknown>)} />
          )}
          {step === 3 && segment && (
            <OperationalRiskForm segment={segment} data={opsData} onChange={d => setOpsData(d as Record<string, unknown>)} />
          )}
          {step === 4 && (
            <CashFlowTable
              data={cashFlowData}
              onChange={setCashFlowData}
              installmentKes={calcMonthlyInstallment(loanAmount, 18, termMonths)}
            />
          )}
          {step === 5 && (
            <ILPCollateralStep
              data={{ ...collateralData, loanAmountKes: loanAmount }}
              onChange={d => setCollateralData(d as Partial<CollateralData>)}
            />
          )}
          {step === 6 && segment && (
            <ReviewStep
              segment={segment}
              ownerData={ownerData}
              businessData={businessData}
              opsData={opsData}
              cashFlowData={cashFlowData}
              collateralData={collateralData}
              assessorNotes={assessorNotes}
              onNotesChange={setAssessorNotes}
              loanAmount={loanAmount}
              termMonths={termMonths}
              onLoanAmountChange={setLoanAmount}
              onTermChange={setTermMonths}
            />
          )}

          {submitError && (
            <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-300 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {submitError}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex justify-between">
            <button type="button"
              disabled={step === 0}
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>

            {step < 6 ? (
              <button type="button"
                disabled={step === 0 && (!segment || !ilpInterview[segment!])}
                onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-primary-700 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button"
                disabled={submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
              >
                <CheckCircle className="h-4 w-4" />
                {submitMutation.isPending ? 'Submitting…' : 'Submit Application'}
              </button>
            )}
          </div>
        </div>
      </div>
    </JourneyGate>
  );
}
