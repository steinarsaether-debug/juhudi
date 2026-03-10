import { computeFarmerBusinessScore } from '../../utils/ilpScoring';

export interface FarmerBusinessData {
  farmSizeAcres:   number;
  marketAccess:    'SUBSISTENCE' | 'LOCAL_MARKET' | 'COOPERATIVE' | 'CONTRACT';
  groupLoanCycles: number;
}

interface Props {
  data:     Partial<FarmerBusinessData>;
  onChange: (data: Partial<FarmerBusinessData>) => void;
}

const MARKET_OPTIONS = [
  { value: 'SUBSISTENCE',  label: 'Subsistence only',          pts: 10 },
  { value: 'LOCAL_MARKET', label: 'Local market',              pts: 25 },
  { value: 'COOPERATIVE',  label: 'Cooperative / Farmer group', pts: 40 },
  { value: 'CONTRACT',     label: 'Contract buyer',             pts: 50 },
];

const CYCLE_OPTIONS = [
  { value: 0, label: '0 cycles', pts: 10 },
  { value: 1, label: '1 cycle',  pts: 20 },
  { value: 2, label: '2 cycles', pts: 35 },
  { value: 3, label: '3+ cycles', pts: 50 },
];

export default function FarmerBusinessAssessment({ data, onChange }: Props) {
  const score = computeFarmerBusinessScore(data);
  const set = (key: keyof FarmerBusinessData) => (val: unknown) =>
    onChange({ ...data, [key]: val });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3">
        <span className="text-sm font-medium text-indigo-800">Farmer Business Score</span>
        <span className="text-2xl font-bold text-indigo-700">{score}<span className="text-sm font-normal text-indigo-400">/100</span></span>
      </div>

      {/* Farm size */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1">
          Farm Size (acres) <span className="text-gray-400 font-normal">(max raw 50 pts)</span>
        </label>
        <input
          type="number" min={0} max={10000}
          value={data.farmSizeAcres ?? ''}
          onChange={e => set('farmSizeAcres')(e.target.value === '' ? undefined : parseFloat(e.target.value))}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="e.g. 3.5"
        />
        <p className="text-xs text-gray-400 mt-1">&lt;1ac→10 · 1–3ac→25 · 3–5ac→40 · 5+ac→50</p>
      </div>

      {/* Market access */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-2">
          Market Access <span className="text-gray-400 font-normal">(max raw 50 pts)</span>
        </label>
        <div className="space-y-2">
          {MARKET_OPTIONS.map(opt => (
            <button key={opt.value} type="button"
              onClick={() => set('marketAccess')(opt.value)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm text-left transition-all ${
                data.marketAccess === opt.value
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-800'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'
              }`}
            >
              <span className="flex-1">{opt.label}</span>
              <span className={`text-xs font-semibold ${opt.pts >= 40 ? 'text-green-600' : opt.pts >= 25 ? 'text-amber-600' : 'text-red-500'}`}>+{opt.pts} pts</span>
            </button>
          ))}
        </div>
      </div>

      {/* Group loan cycles */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-2">
          Juhudi / MFI Group Loan Cycles Completed <span className="text-gray-400 font-normal">(max raw 50 pts)</span>
        </label>
        <div className="grid grid-cols-4 gap-2">
          {CYCLE_OPTIONS.map(opt => (
            <button key={opt.value} type="button"
              onClick={() => set('groupLoanCycles')(opt.value)}
              className={`py-3 rounded-lg border text-sm font-medium transition-all text-center ${
                data.groupLoanCycles === opt.value
                  ? 'bg-indigo-700 border-indigo-700 text-white'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-400'
              }`}
            >
              {opt.label}
              <div className="text-xs mt-0.5 opacity-70">+{opt.pts}pts</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
