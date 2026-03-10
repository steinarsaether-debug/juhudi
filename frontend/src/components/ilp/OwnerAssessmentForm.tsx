// Step 1 of ILP wizard: Owner / Character Assessment (all segments)
// 4 factors: experience, CRB status, loan history, references
import { computeOwnerScore } from '../../utils/ilpScoring';

export interface OwnerFormData {
  experienceYears:  number;
  crbStatus:        'CLEAR' | 'PERFORMING' | 'UNKNOWN' | 'LISTED';
  loanHistoryType:  'NONE' | 'ON_TIME' | 'SOME_LATE' | 'DEFAULT';
  referenceCount:   number;
}

interface Props {
  data: Partial<OwnerFormData>;
  onChange: (data: Partial<OwnerFormData>) => void;
}

const CRB_OPTIONS = [
  { value: 'CLEAR',      label: 'Clear — no issues', points: 30 },
  { value: 'PERFORMING', label: 'Performing — active but current', points: 30 },
  { value: 'UNKNOWN',    label: 'Unknown — not checked', points: 15 },
  { value: 'LISTED',     label: 'Listed — active adverse listing', points: 0 },
];

const HISTORY_OPTIONS = [
  { value: 'ON_TIME',   label: 'On time — always paid as agreed', points: 30 },
  { value: 'NONE',      label: 'No previous loan history', points: 15 },
  { value: 'SOME_LATE', label: 'Some late payments', points: 15 },
  { value: 'DEFAULT',   label: 'Default — did not repay', points: 0 },
];

function PointBadge({ points }: { points: number }) {
  const color = points >= 25 ? 'text-green-600' : points >= 10 ? 'text-amber-600' : 'text-red-500';
  return <span className={`text-xs font-semibold ${color} ml-auto`}>+{points} pts</span>;
}

export default function OwnerAssessmentForm({ data, onChange }: Props) {
  const score = computeOwnerScore(data as Partial<OwnerFormData>);
  const set = (key: keyof OwnerFormData) => (val: unknown) =>
    onChange({ ...data, [key]: val });

  return (
    <div className="space-y-6">
      {/* Live score */}
      <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-5 py-3">
        <span className="text-sm font-medium text-blue-800">Owner / Character Score</span>
        <span className="text-2xl font-bold text-blue-700">{score}<span className="text-sm font-normal text-blue-400">/100</span></span>
      </div>

      {/* Experience */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1">
          Years of Experience in this Business / Activity
          <span className="text-gray-400 font-normal ml-1">(max 50 pts)</span>
        </label>
        <input
          type="number"
          min={0} max={60}
          value={data.experienceYears ?? ''}
          onChange={e => set('experienceYears')(e.target.value === '' ? undefined : parseFloat(e.target.value))}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="e.g. 5"
        />
        <p className="text-xs text-gray-400 mt-1">
          &lt;2 yrs → 10 pts · 2–5 yrs → 30 pts · 5+ yrs → 50 pts
        </p>
      </div>

      {/* CRB Status */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-2">
          CRB Status <span className="text-gray-400 font-normal">(max 30 pts)</span>
        </label>
        <div className="space-y-2">
          {CRB_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set('crbStatus')(opt.value)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm text-left transition-all ${
                data.crbStatus === opt.value
                  ? 'bg-primary-50 border-primary-500 text-primary-800'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-primary-300'
              }`}
            >
              <span className="flex-1">{opt.label}</span>
              <PointBadge points={opt.points} />
            </button>
          ))}
        </div>
      </div>

      {/* Loan history */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-2">
          Previous Loan Repayment History <span className="text-gray-400 font-normal">(max 30 pts)</span>
        </label>
        <div className="space-y-2">
          {HISTORY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set('loanHistoryType')(opt.value)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm text-left transition-all ${
                data.loanHistoryType === opt.value
                  ? 'bg-primary-50 border-primary-500 text-primary-800'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-primary-300'
              }`}
            >
              <span className="flex-1">{opt.label}</span>
              <PointBadge points={opt.points} />
            </button>
          ))}
        </div>
      </div>

      {/* References */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-2">
          Number of Character References Provided <span className="text-gray-400 font-normal">(max 20 pts)</span>
        </label>
        <div className="flex gap-3">
          {[0, 1, 2].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => set('referenceCount')(n)}
              className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-all ${
                data.referenceCount === n
                  ? 'bg-primary-700 border-primary-700 text-white'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-primary-400'
              }`}
            >
              {n} ref{n !== 1 ? 's' : ''}
              <div className="text-xs mt-0.5 opacity-70">{n >= 2 ? '+20' : n === 1 ? '+10' : '+0'} pts</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
