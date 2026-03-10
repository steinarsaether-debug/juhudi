// Pure display component — shows ILP assessment scores as horizontal bars
// and a composite score badge with APPROVE/CONDITIONAL/DECLINE chip.
import { ILPRecommendation } from '../../types';

interface DimensionBar {
  label:  string;
  score:  number;   // 0–100
  weight: string;   // e.g. "20%"
  color:  string;   // tailwind bg class
}

interface ILPScoreDisplayProps {
  ownerScore:           number;
  businessScore:        number;
  operationalRiskScore: number;
  cashFlowScore:        number;
  collateralScore:      number;
  compositeScore:       number;
  ilpRecommendation:    ILPRecommendation;
  dsr?:                 number;
  compact?:             boolean;  // smaller version for sidebars
}

function ScoreBar({ label, score, weight, color }: DimensionBar) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-semibold text-gray-800">{score}/100 <span className="text-gray-400 font-normal">({weight})</span></span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

const RECOMMENDATION_STYLES: Record<ILPRecommendation, string> = {
  APPROVE:      'bg-green-100 text-green-800 border-green-300',
  CONDITIONAL:  'bg-amber-100 text-amber-800 border-amber-300',
  DECLINE:      'bg-red-100 text-red-800 border-red-300',
};

const RECOMMENDATION_LABELS: Record<ILPRecommendation, string> = {
  APPROVE:      'Recommend Approve',
  CONDITIONAL:  'Conditional Approval',
  DECLINE:      'Recommend Decline',
};

function compositeColor(score: number): string {
  if (score >= 75) return 'text-green-700';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

export default function ILPScoreDisplay({
  ownerScore, businessScore, operationalRiskScore, cashFlowScore, collateralScore,
  compositeScore, ilpRecommendation, dsr, compact = false,
}: ILPScoreDisplayProps) {
  const dimensions: DimensionBar[] = [
    { label: 'Owner / Character',  score: ownerScore,            weight: '20%', color: 'bg-blue-500' },
    { label: 'Business Quality',   score: businessScore,         weight: '25%', color: 'bg-indigo-500' },
    { label: 'Operational Risk',   score: operationalRiskScore,  weight: '20%', color: 'bg-violet-500' },
    { label: 'Cash Flow (DSR)',     score: cashFlowScore,         weight: '25%', color: 'bg-teal-500' },
    { label: 'Collateral',         score: collateralScore,       weight: '10%', color: 'bg-orange-500' },
  ];

  if (compact) {
    return (
      <div className="space-y-2">
        {dimensions.map(d => <ScoreBar key={d.label} {...d} />)}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className={`text-xl font-bold ${compositeColor(compositeScore)}`}>
            {compositeScore}<span className="text-sm font-normal text-gray-400">/100</span>
          </span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${RECOMMENDATION_STYLES[ilpRecommendation]}`}>
            {RECOMMENDATION_LABELS[ilpRecommendation]}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <h3 className="text-base font-semibold text-gray-900">ILP Assessment Score</h3>
        <span className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${RECOMMENDATION_STYLES[ilpRecommendation]}`}>
          {RECOMMENDATION_LABELS[ilpRecommendation]}
        </span>
      </div>

      {/* Composite score ring */}
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className={`text-4xl font-bold ${compositeColor(compositeScore)}`}>{compositeScore}</div>
          <div className="text-xs text-gray-400 mt-0.5">out of 100</div>
          {dsr !== undefined && (
            <div className="text-xs mt-1">
              DSR: <span className={`font-semibold ${dsr > 50 ? 'text-red-600' : dsr > 40 ? 'text-amber-600' : 'text-green-600'}`}>
                {dsr.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-3">
          {dimensions.map(d => <ScoreBar key={d.label} {...d} />)}
        </div>
      </div>

      {/* Thresholds legend */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 text-center">
        <div className="text-xs">
          <div className="font-semibold text-green-700">≥ 75</div>
          <div className="text-gray-500">Approve</div>
        </div>
        <div className="text-xs">
          <div className="font-semibold text-amber-600">60 – 74</div>
          <div className="text-gray-500">Conditional</div>
        </div>
        <div className="text-xs">
          <div className="font-semibold text-red-600">&lt; 60</div>
          <div className="text-gray-500">Decline</div>
        </div>
      </div>
    </div>
  );
}
