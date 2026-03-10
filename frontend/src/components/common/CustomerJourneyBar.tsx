// CustomerJourneyBar — visual horizontal step indicator for the full customer lending lifecycle.
// Shows all stages from Pre-Screening → Repaying, highlights the current stage,
// and marks completed / blocked stages appropriately.

import { CheckCircle, Lock } from 'lucide-react';

export type JourneyStage =
  | 'PRE_SCREENING'
  | 'KYC'
  | 'INTERVIEW'
  | 'MPESA'
  | 'APPLICATION'
  | 'BCC_REVIEW'
  | 'APPROVED'
  | 'DISBURSED'
  | 'REPAYING';

export interface JourneyStep {
  stage:    JourneyStage;
  label:    string;
  sublabel?: string;
  status:   'COMPLETED' | 'CURRENT' | 'PENDING' | 'BLOCKED';
}

interface CustomerJourneyBarProps {
  steps:   JourneyStep[];
  compact?: boolean;  // single-line version for page headers
}

const STAGE_ICONS: Record<JourneyStage, string> = {
  PRE_SCREENING: '1',
  KYC:           '2',
  INTERVIEW:     '3',
  MPESA:         '4',
  APPLICATION:   '5',
  BCC_REVIEW:    '6',
  APPROVED:      '7',
  DISBURSED:     '8',
  REPAYING:      '9',
};

function StepNode({ step, isLast }: { step: JourneyStep; isLast: boolean }) {
  const { status, label, sublabel, stage } = step;

  const circleClass =
    status === 'COMPLETED' ? 'bg-green-500 border-green-500 text-white' :
    status === 'CURRENT'   ? 'bg-primary-700 border-primary-700 text-white ring-4 ring-primary-100' :
    status === 'BLOCKED'   ? 'bg-gray-100 border-gray-300 text-gray-400' :
                             'bg-white border-gray-300 text-gray-400';

  const labelClass =
    status === 'COMPLETED' ? 'text-green-700 font-medium' :
    status === 'CURRENT'   ? 'text-primary-800 font-semibold' :
    status === 'BLOCKED'   ? 'text-gray-300' :
                             'text-gray-400';

  const connectorClass =
    status === 'COMPLETED' ? 'bg-green-400' : 'bg-gray-200';

  return (
    <div className="flex items-center flex-1 min-w-0">
      <div className="flex flex-col items-center flex-shrink-0">
        {/* Circle */}
        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${circleClass}`}>
          {status === 'COMPLETED' ? (
            <CheckCircle className="h-4 w-4" />
          ) : status === 'BLOCKED' ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            STAGE_ICONS[stage]
          )}
        </div>
        {/* Label below circle */}
        <div className={`mt-1.5 text-center ${labelClass}`}>
          <div className="text-xs leading-tight whitespace-nowrap">{label}</div>
          {sublabel && <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{sublabel}</div>}
        </div>
      </div>

      {/* Connector line */}
      {!isLast && (
        <div className={`flex-1 h-0.5 mx-1 mt-[-18px] rounded-full ${connectorClass}`} />
      )}
    </div>
  );
}

export default function CustomerJourneyBar({ steps, compact = false }: CustomerJourneyBarProps) {
  if (compact) {
    // Compact: just dots + labels in a single row
    return (
      <div className="flex items-center overflow-x-auto pb-1 gap-0">
        {steps.map((step, i) => (
          <div key={step.stage} className="flex items-center flex-shrink-0">
            <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
              step.status === 'COMPLETED' ? 'bg-green-500 border-green-500 text-white' :
              step.status === 'CURRENT'   ? 'bg-primary-700 border-primary-700 text-white' :
              step.status === 'BLOCKED'   ? 'bg-gray-100 border-gray-200 text-gray-300' :
                                           'bg-white border-gray-200 text-gray-300'
            }`}>
              {step.status === 'COMPLETED' ? '✓' : STAGE_ICONS[step.stage]}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-4 h-0.5 ${step.status === 'COMPLETED' ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
        <span className="ml-3 text-xs text-gray-500">
          {steps.find(s => s.status === 'CURRENT')?.label ?? ''}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 overflow-x-auto">
      <div className="flex items-start min-w-max gap-0">
        {steps.map((step, i) => (
          <StepNode key={step.stage} step={step} isLast={i === steps.length - 1} />
        ))}
      </div>
    </div>
  );
}

// ── Helpers — build journey steps from customer/application state ─────────────

export interface CustomerJourneyState {
  kycVerified:           boolean;
  interviewCompleted:    boolean;
  mpesaAnalysed?:        boolean;    // optional stage
  applicationStatus?:    string;     // SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED | etc.
  disbursed?:            boolean;
  hasRepayments?:        boolean;
}

export function buildJourneySteps(state: CustomerJourneyState): JourneyStep[] {
  const {
    kycVerified, interviewCompleted, mpesaAnalysed,
    applicationStatus, disbursed, hasRepayments,
  } = state;

  const appSubmitted = !!applicationStatus && applicationStatus !== 'DRAFT';
  const appApproved  = applicationStatus === 'APPROVED' || applicationStatus === 'CONDITIONALLY_APPROVED';
  const appRejected  = applicationStatus === 'REJECTED';

  // Determine CURRENT stage
  const current: JourneyStage =
    disbursed && hasRepayments ? 'REPAYING' :
    disbursed                  ? 'DISBURSED' :
    appApproved                ? 'APPROVED' :
    appSubmitted && !appApproved && !appRejected ? 'BCC_REVIEW' :
    interviewCompleted && kycVerified ? 'APPLICATION' :
    kycVerified ? 'INTERVIEW' :
    'KYC';

  const done = (s: JourneyStage) => {
    const order: JourneyStage[] = [
      'PRE_SCREENING', 'KYC', 'INTERVIEW', 'MPESA', 'APPLICATION',
      'BCC_REVIEW', 'APPROVED', 'DISBURSED', 'REPAYING',
    ];
    const ci = order.indexOf(current);
    const si = order.indexOf(s);
    return si < ci;
  };

  const steps: JourneyStep[] = [
    {
      stage: 'PRE_SCREENING', label: 'Pre-screening', status: 'COMPLETED',
    },
    {
      stage: 'KYC', label: 'KYC',
      sublabel: kycVerified ? 'Verified' : 'Pending',
      status: kycVerified ? (current === 'KYC' ? 'CURRENT' : 'COMPLETED') : (current === 'KYC' ? 'CURRENT' : 'PENDING'),
    },
    {
      stage: 'INTERVIEW', label: 'Interview',
      sublabel: interviewCompleted ? 'Done' : 'Needed',
      status: interviewCompleted ? (done('INTERVIEW') ? 'COMPLETED' : 'COMPLETED') :
              !kycVerified ? 'BLOCKED' :
              current === 'INTERVIEW' ? 'CURRENT' : 'PENDING',
    },
    {
      stage: 'MPESA', label: 'M-Pesa',
      sublabel: mpesaAnalysed ? 'Analysed' : 'Optional',
      status: mpesaAnalysed ? 'COMPLETED' :
              !kycVerified ? 'BLOCKED' : 'PENDING',
    },
    {
      stage: 'APPLICATION', label: 'Application',
      status: appSubmitted ? (done('APPLICATION') ? 'COMPLETED' : 'COMPLETED') :
              !kycVerified || !interviewCompleted ? 'BLOCKED' :
              current === 'APPLICATION' ? 'CURRENT' : 'PENDING',
    },
    {
      stage: 'BCC_REVIEW', label: 'BCC Review',
      status: appApproved || appRejected ? 'COMPLETED' :
              appSubmitted ? (current === 'BCC_REVIEW' ? 'CURRENT' : 'PENDING') :
              'BLOCKED',
    },
    {
      stage: 'APPROVED', label: 'Approved',
      status: appApproved && disbursed ? 'COMPLETED' :
              appApproved ? (current === 'APPROVED' ? 'CURRENT' : 'COMPLETED') :
              appRejected ? 'BLOCKED' : 'PENDING',
    },
    {
      stage: 'DISBURSED', label: 'Disbursed',
      status: disbursed && hasRepayments ? 'COMPLETED' :
              disbursed ? (current === 'DISBURSED' ? 'CURRENT' : 'COMPLETED') :
              !appApproved ? 'BLOCKED' : 'PENDING',
    },
    {
      stage: 'REPAYING', label: 'Repaying',
      status: hasRepayments ? (current === 'REPAYING' ? 'CURRENT' : 'COMPLETED') :
              !disbursed ? 'BLOCKED' : 'PENDING',
    },
  ];

  return steps;
}
