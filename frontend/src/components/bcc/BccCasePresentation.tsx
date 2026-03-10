import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import { bccApi } from '../../services/api';

interface CaseData {
  sessionId: string;
  sessionStatus: string;
  loRecommendation: string | null;
  loNarrative: string | null;
  borrowerProfile: {
    firstName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    maritalStatus: string;
    numberOfDependents: number;
    county: string;
    subCounty: string;
    village: string;
    currentTier: string;
    yaraCustomerId: string | null;
  };
  farmAndBusiness: {
    farmProfile: Record<string, unknown> | null;
    financialProfile: Record<string, unknown> | null;
  };
  loanRequest: {
    id: string;
    loanType: string;
    requestedAmountKes: number;
    approvedAmountKes: number | null;
    termMonths: number;
    interestRatePct: number | null;
    purposeCategory: string | null;
    purposeOfLoan: string;
    repaymentMethod: string | null;
    ilpSegment: string | null;
    officer: { firstName: string; lastName: string };
    loanProduct: { name: string; interestRatePct: number } | null;
  };
  repaymentCapacity: {
    creditScore: Record<string, unknown> | null;
    ilpAssessment: Record<string, unknown> | null;
  };
  creditBackground: {
    previousLoans: Array<{ id: string; status: string; principalKes: number; disbursedAt: string | null; maturityDate: string | null; daysInArrears: number }>;
    latestInterview: { id: string; scorePercent: number | null; recommendation: string | null; completedAt: string | null; loNotes: string | null } | null;
  };
  collateral: Array<{ id: string; collateralType: string; description: string; estimatedValueKes: number; isVerified: boolean }>;
  riskRating: {
    creditScore: Record<string, unknown> | null;
    qualityFlags: Array<{ id: string; flagType: string; severity: string; message: string }>;
  };
  mpesaAnalysis: Record<string, unknown> | null;
  officerRecommendation: {
    loRecommendation: string | null;
    loNarrative: string | null;
  };
  committeeDiscussion: {
    votes: Array<{ id: string; vote: string; rationale: string | null; user: { firstName: string; lastName: string; role: string } }>;
    comments: unknown[];
    flags: unknown[];
    conditions: unknown[];
  };
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({
  title, children, complete, warning,
}: {
  title: string;
  children: React.ReactNode;
  complete?: boolean;
  warning?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {complete ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : warning ? (
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          ) : (
            <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
          )}
          <span className="text-sm font-semibold text-gray-800">{title}</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-gray-500 flex-shrink-0 mr-4">{label}</span>
      <span className="text-gray-900 font-medium text-right">{value}</span>
    </div>
  );
}

// ── LO Recommendation Editor ───────────────────────────────────────────────────

function LoRecommendationEditor({ sessionId, loRecommendation, loNarrative, sessionOpen }: {
  sessionId: string;
  loRecommendation: string | null;
  loNarrative: string | null;
  sessionOpen: boolean;
}) {
  const [rec, setRec] = useState(loRecommendation ?? '');
  const [narrative, setNarrative] = useState(loNarrative ?? '');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => bccApi.updateNarrative(sessionId, {
      loRecommendation: rec || undefined,
      loNarrative: narrative || undefined,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bcc-case', sessionId] }),
  });

  if (!sessionOpen && !loRecommendation && !loNarrative) {
    return <p className="text-sm text-gray-400 italic">No officer recommendation recorded</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">LO Recommendation</label>
        {sessionOpen ? (
          <select
            value={rec}
            onChange={e => setRec(e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">— Select —</option>
            <option value="RECOMMEND_APPROVE">Recommend Approve</option>
            <option value="RECOMMEND_CONDITIONAL">Recommend Conditional</option>
            <option value="RECOMMEND_DECLINE">Recommend Decline</option>
          </select>
        ) : (
          <span className={`text-sm font-semibold ${
            rec === 'RECOMMEND_APPROVE' ? 'text-green-700'
            : rec === 'RECOMMEND_DECLINE' ? 'text-red-700'
            : 'text-yellow-700'
          }`}>
            {rec.replace('RECOMMEND_', '').replace('_', ' ')}
          </span>
        )}
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Case Narrative</label>
        {sessionOpen ? (
          <textarea
            value={narrative}
            onChange={e => setNarrative(e.target.value)}
            rows={5}
            placeholder="Present the credit case: customer background, business assessment, key risks and mitigants..."
            className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
          />
        ) : (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{narrative || 'No narrative provided'}</p>
        )}
      </div>
      {sessionOpen && (
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : 'Save'}
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function BccCasePresentation({ caseData, sessionId }: { caseData: CaseData; sessionId: string }) {
  const bp = caseData.borrowerProfile;
  const lr = caseData.loanRequest;
  const rc = caseData.repaymentCapacity;
  const cb = caseData.creditBackground;

  const age = bp.dateOfBirth
    ? Math.floor((Date.now() - new Date(bp.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b">
        <h3 className="font-bold text-gray-900">
          {bp.firstName} {bp.lastName}
        </h3>
        <p className="text-sm text-gray-500">
          KES {lr.requestedAmountKes.toLocaleString()} · {lr.termMonths}m · {lr.loanType}
          {lr.ilpSegment ? ` · ILP ${lr.ilpSegment}` : ''}
        </p>
      </div>

      {/* Sections */}
      <Section title="1. Borrower Profile" complete={!!bp.firstName}>
        <Field label="Name" value={`${bp.firstName} ${bp.lastName}`} />
        <Field label="Age" value={age ? `${age} years` : null} />
        <Field label="Gender" value={bp.gender} />
        <Field label="Marital Status" value={bp.maritalStatus} />
        <Field label="Dependents" value={bp.numberOfDependents} />
        <Field label="Location" value={`${bp.village}, ${bp.subCounty}, ${bp.county}`} />
        <Field label="Loyalty Tier" value={bp.currentTier} />
        {bp.yaraCustomerId && <Field label="Yara ID" value={bp.yaraCustomerId} />}
      </Section>

      <Section
        title="2. Farm & Business"
        complete={!!(caseData.farmAndBusiness.farmProfile || caseData.farmAndBusiness.financialProfile)}
      >
        {caseData.farmAndBusiness.farmProfile ? (
          <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(caseData.farmAndBusiness.farmProfile, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-gray-400 italic">No farm profile recorded</p>
        )}
      </Section>

      <Section title="3. Loan Request" complete>
        <Field label="Amount" value={`KES ${lr.requestedAmountKes.toLocaleString()}`} />
        <Field label="Term" value={`${lr.termMonths} months`} />
        {lr.loanProduct && <Field label="Product" value={lr.loanProduct.name} />}
        <Field label="Purpose" value={lr.purposeCategory} />
        <Field label="Use of Funds" value={lr.purposeOfLoan} />
        <Field label="Repayment" value={lr.repaymentMethod} />
        <Field label="Officer" value={`${lr.officer.firstName} ${lr.officer.lastName}`} />
      </Section>

      <Section title="4. Repayment Capacity" complete={!!rc.creditScore} warning={!rc.creditScore}>
        {rc.creditScore ? (
          <div className="text-sm space-y-1">
            <Field label="Total Score" value={(rc.creditScore as { totalScore?: number }).totalScore} />
            <Field label="Recommendation" value={(rc.creditScore as { recommendation?: string }).recommendation} />
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">Credit score not yet calculated</p>
        )}
        {rc.ilpAssessment && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs font-semibold text-gray-500 mb-1">ILP Assessment</p>
            <Field label="Composite Score" value={(rc.ilpAssessment as { compositeScore?: number }).compositeScore} />
            <Field label="Recommendation" value={(rc.ilpAssessment as { ilpRecommendation?: string }).ilpRecommendation} />
          </div>
        )}
      </Section>

      <Section title="5. Credit Background" complete={cb.previousLoans.length > 0}>
        {cb.previousLoans.length === 0 ? (
          <p className="text-sm text-gray-500 italic">First-time borrower</p>
        ) : (
          <div className="space-y-2">
            {cb.previousLoans.map(loan => (
              <div key={loan.id} className="flex justify-between text-sm">
                <span>KES {loan.principalKes.toLocaleString()}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  loan.status === 'COMPLETED' ? 'bg-green-100 text-green-700'
                  : loan.status === 'DEFAULTED' ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600'
                }`}>{loan.status}</span>
                {loan.daysInArrears > 0 && (
                  <span className="text-red-600 text-xs">{loan.daysInArrears}d arrears</span>
                )}
              </div>
            ))}
          </div>
        )}
        {cb.latestInterview && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs font-semibold text-gray-500 mb-1">Pre-Screening Interview</p>
            <Field label="Score" value={cb.latestInterview.scorePercent != null ? `${cb.latestInterview.scorePercent.toFixed(1)}%` : null} />
            <Field label="Recommendation" value={cb.latestInterview.recommendation} />
            {cb.latestInterview.loNotes && (
              <p className="text-xs text-gray-600 mt-2 italic">{cb.latestInterview.loNotes}</p>
            )}
          </div>
        )}
      </Section>

      <Section title="6. Collateral" complete={caseData.collateral.length > 0} warning={caseData.collateral.length === 0}>
        {caseData.collateral.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No collateral recorded</p>
        ) : (
          caseData.collateral.map(c => (
            <div key={c.id} className="py-1 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{c.collateralType.replace(/_/g, ' ')}</span>
                <span>KES {c.estimatedValueKes.toLocaleString()}</span>
              </div>
              <p className="text-gray-500 text-xs">{c.description}</p>
              {c.isVerified && <span className="text-xs text-green-600">✓ Verified</span>}
            </div>
          ))
        )}
      </Section>

      <Section
        title="7. Risk Flags"
        complete={caseData.riskRating.qualityFlags.length === 0}
        warning={caseData.riskRating.qualityFlags.length > 0}
      >
        {caseData.riskRating.qualityFlags.length === 0 ? (
          <p className="text-sm text-green-600">No data quality flags</p>
        ) : (
          caseData.riskRating.qualityFlags.map(f => (
            <div key={f.id} className="py-1">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium mr-2 ${
                f.severity === 'CRITICAL' ? 'bg-red-100 text-red-700'
                : f.severity === 'WARNING' ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600'
              }`}>{f.severity}</span>
              <span className="text-sm text-gray-700">{f.message}</span>
            </div>
          ))
        )}
      </Section>

      <Section title="8. M-Pesa Analysis" complete={!!caseData.mpesaAnalysis}>
        {!caseData.mpesaAnalysis ? (
          <p className="text-sm text-gray-400 italic">No M-Pesa statement uploaded</p>
        ) : (
          <div className="space-y-2 text-sm">
            <Field label="Risk Level" value={(caseData.mpesaAnalysis as { overallRiskLevel?: string }).overallRiskLevel} />
            <Field label="Recommendation" value={(caseData.mpesaAnalysis as { recommendedAction?: string }).recommendedAction} />
            <Field label="Avg Monthly Inflow" value={(caseData.mpesaAnalysis as { avgMonthlyInflow?: number }).avgMonthlyInflow != null ? `KES ${((caseData.mpesaAnalysis as { avgMonthlyInflow: number }).avgMonthlyInflow).toLocaleString()}` : null} />
            <Field label="Avg Monthly Net" value={(caseData.mpesaAnalysis as { avgMonthlyNet?: number }).avgMonthlyNet != null ? `KES ${((caseData.mpesaAnalysis as { avgMonthlyNet: number }).avgMonthlyNet).toLocaleString()}` : null} />
            <Field label="Fuliza Uses" value={(caseData.mpesaAnalysis as { fulizaUsageCount?: number }).fulizaUsageCount} />
            {(caseData.mpesaAnalysis as { riskSummary?: string }).riskSummary && (
              <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 mt-2">
                {(caseData.mpesaAnalysis as { riskSummary: string }).riskSummary}
              </p>
            )}
          </div>
        )}
      </Section>

      <Section title="9. Officer Recommendation" complete={!!caseData.loRecommendation}>
        <LoRecommendationEditor
          sessionId={sessionId}
          loRecommendation={caseData.loRecommendation}
          loNarrative={caseData.loNarrative}
          sessionOpen={caseData.sessionStatus === 'OPEN'}
        />
      </Section>

      <Section title="10. Committee Decision" complete={!!caseData.committeeDiscussion.votes.length}>
        <div className="space-y-2">
          {caseData.committeeDiscussion.votes.map(v => (
            <div key={v.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{v.user.firstName} {v.user.lastName}</span>
              <div className="flex items-center gap-2">
                {v.rationale && <span className="text-xs text-gray-400 max-w-xs truncate">{v.rationale}</span>}
                <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                  v.vote === 'ENDORSE' ? 'bg-green-100 text-green-700'
                  : v.vote === 'REFUSE' ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600'
                }`}>{v.vote}</span>
              </div>
            </div>
          ))}
          {caseData.committeeDiscussion.votes.length === 0 && (
            <p className="text-sm text-gray-400 italic">No votes cast yet</p>
          )}
        </div>
      </Section>
    </div>
  );
}
