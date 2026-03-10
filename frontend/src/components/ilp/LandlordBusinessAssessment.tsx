import { computeLandlordBusinessScore } from '../../utils/ilpScoring';

export interface LandlordBusinessData {
  occupancyPct:      number;
  unitCount:         number;
  titleDeedVerified: boolean;
}

interface Props {
  data:     Partial<LandlordBusinessData>;
  onChange: (data: Partial<LandlordBusinessData>) => void;
}

export default function LandlordBusinessAssessment({ data, onChange }: Props) {
  const score = computeLandlordBusinessScore(data);
  const set = (key: keyof LandlordBusinessData) => (val: unknown) =>
    onChange({ ...data, [key]: val });

  // Derived occupancy pct from unit count vs occupied
  const noTitleWarning = !data.titleDeedVerified;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3">
        <span className="text-sm font-medium text-indigo-800">Landlord Business Score</span>
        <span className="text-2xl font-bold text-indigo-700">{score}<span className="text-sm font-normal text-indigo-400">/100</span></span>
      </div>

      {noTitleWarning && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-800">
          <span className="text-amber-500 text-lg leading-tight">⚠</span>
          <div>
            <p className="font-semibold">No title deed — score capped at 40</p>
            <p className="text-xs mt-0.5">A verified title deed removes the cap and adds 50 raw points. Encourage the applicant to present their title deed.</p>
          </div>
        </div>
      )}

      {/* Occupancy % */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1">
          Current Occupancy Rate (%) <span className="text-gray-400 font-normal">(max raw 50 pts)</span>
        </label>
        <input
          type="number" min={0} max={100}
          value={data.occupancyPct ?? ''}
          onChange={e => set('occupancyPct')(e.target.value === '' ? undefined : parseFloat(e.target.value))}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="e.g. 85"
        />
        <p className="text-xs text-gray-400 mt-1">&lt;70%→0 · 70–85%→30 · ≥85%→50</p>
      </div>

      {/* Unit count */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-2">
          Number of Rentable Units <span className="text-gray-400 font-normal">(max raw 50 pts)</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '1–2 units', value: 2, pts: 20 },
            { label: '3–5 units', value: 4, pts: 35 },
            { label: '6+ units',  value: 6, pts: 50 },
          ].map(opt => (
            <button key={opt.value} type="button"
              onClick={() => set('unitCount')(opt.value)}
              className={`py-3 rounded-lg border text-sm font-medium transition-all text-center ${
                data.unitCount !== undefined &&
                ((opt.value === 2 && data.unitCount <= 2) ||
                 (opt.value === 4 && data.unitCount >= 3 && data.unitCount <= 5) ||
                 (opt.value === 6 && data.unitCount >= 6))
                  ? 'bg-indigo-700 border-indigo-700 text-white'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-400'
              }`}
            >
              {opt.label}
              <div className="text-xs mt-0.5 opacity-70">+{opt.pts}pts</div>
            </button>
          ))}
        </div>
        <input
          type="number" min={1} max={1000}
          value={data.unitCount ?? ''}
          onChange={e => set('unitCount')(e.target.value === '' ? undefined : parseInt(e.target.value))}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-2"
          placeholder="Or enter exact number of units"
        />
      </div>

      {/* Title deed */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-2">
          Title Deed Verified <span className="text-gray-400 font-normal">(+50 raw pts + removes cap)</span>
        </label>
        <div className="flex gap-3">
          {[
            { val: true,  label: 'Yes — title deed sighted & verified', color: 'bg-green-600 border-green-600 text-white' },
            { val: false, label: 'No — not presented',                   color: 'bg-white border-gray-200 text-gray-700' },
          ].map(opt => (
            <button key={String(opt.val)} type="button"
              onClick={() => set('titleDeedVerified')(opt.val)}
              className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-all text-center ${
                data.titleDeedVerified === opt.val
                  ? opt.val ? 'bg-green-600 border-green-600 text-white' : 'bg-red-50 border-red-400 text-red-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
