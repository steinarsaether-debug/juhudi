// Step 3 of ILP wizard: Operational Risk Assessment
// Segment prop controls which vertical-specific fields render.
import {
  computeFarmerOpsScore, computeLandlordOpsScore, computeShopOwnerOpsScore,
} from '../../utils/ilpScoring';

type Segment = 'FARMER' | 'LANDLORD' | 'SHOP_OWNER';

// ── FARMER ─────────────────────────────────────────────────────────────────
export interface FarmerOpsData {
  irrigationType:      'IRRIGATED' | 'MIXED' | 'RAIN_FED';
  hasStorage:          boolean;
  hasCropInsurance:    boolean;
  hasAlternativeIncome: boolean;
}

// ── LANDLORD ────────────────────────────────────────────────────────────────
export interface LandlordOpsData {
  buildingAgeYears:   number;
  hasInsurance:       boolean;
  maintenanceQuality: 'GOOD' | 'FAIR' | 'POOR';
  locationRating:     'PRIME' | 'GOOD' | 'AVERAGE' | 'POOR';
}

// ── SHOP OWNER ──────────────────────────────────────────────────────────────
export interface ShopOwnerOpsData {
  locationRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  competitorCount:   number;
  supplierCount:     number;
  hasInsurance:      boolean;
}

type OpsData = Partial<FarmerOpsData> | Partial<LandlordOpsData> | Partial<ShopOwnerOpsData>;

interface Props {
  segment:  Segment;
  data:     OpsData;
  onChange: (data: OpsData) => void;
}

function Toggle({ label, pts, value, onChange }: {
  label: string; pts: string; value?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400">{pts}</p>
      </div>
      <div className="flex gap-2">
        {[true, false].map(v => (
          <button key={String(v)} type="button"
            onClick={() => onChange(v)}
            className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-all ${
              value === v
                ? v ? 'bg-green-600 border-green-600 text-white' : 'bg-red-50 border-red-300 text-red-700'
                : 'bg-white border-gray-200 text-gray-600 hover:border-violet-400'
            }`}
          >
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  );
}

function RadioGroup<T extends string>({ label, hint, options, value, onChange }: {
  label: string; hint?: string;
  options: { value: T; label: string; pts: number }[];
  value?: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-800 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      <div className="space-y-2">
        {options.map(opt => (
          <button key={opt.value} type="button"
            onClick={() => onChange(opt.value)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm text-left transition-all ${
              value === opt.value
                ? 'bg-violet-50 border-violet-500 text-violet-800'
                : 'bg-white border-gray-200 text-gray-700 hover:border-violet-300'
            }`}
          >
            <span className="flex-1">{opt.label}</span>
            <span className={`text-xs font-semibold ${opt.pts >= 20 ? 'text-green-600' : opt.pts >= 10 ? 'text-amber-600' : 'text-red-500'}`}>
              +{opt.pts} pts
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Farmer ops form ──────────────────────────────────────────────────────────
function FarmerOps({ data, onChange }: { data: Partial<FarmerOpsData>; onChange: (d: Partial<FarmerOpsData>) => void }) {
  const score = computeFarmerOpsScore(data);
  const set = (k: keyof FarmerOpsData) => (v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-5">
      <ScoreBadge score={score} label="Farmer Operational Risk Score" />
      <RadioGroup label="Water / Irrigation Source" options={[
        { value: 'IRRIGATED', label: 'River / borehole irrigation', pts: 25 },
        { value: 'MIXED',     label: 'Mixed (rain + irrigation)',   pts: 15 },
        { value: 'RAIN_FED',  label: 'Rain-fed only',               pts: 0  },
      ]} value={data.irrigationType} onChange={v => set('irrigationType')(v)} />
      <div className="bg-gray-50 rounded-xl border border-gray-200 px-4">
        <Toggle label="On-Farm Storage" pts="+25 pts — grain store, cold storage, etc." value={data.hasStorage} onChange={v => set('hasStorage')(v)} />
        <Toggle label="Crop / Weather Insurance" pts="+25 pts — any valid crop insurance policy" value={data.hasCropInsurance} onChange={v => set('hasCropInsurance')(v)} />
        <Toggle label="Alternative Off-Farm Income" pts="+25 pts — salary, business, remittances" value={data.hasAlternativeIncome} onChange={v => set('hasAlternativeIncome')(v)} />
      </div>
    </div>
  );
}

// ── Landlord ops form ────────────────────────────────────────────────────────
function LandlordOps({ data, onChange }: { data: Partial<LandlordOpsData>; onChange: (d: Partial<LandlordOpsData>) => void }) {
  const score = computeLandlordOpsScore(data);
  const set = (k: keyof LandlordOpsData) => (v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-5">
      <ScoreBadge score={score} label="Landlord Operational Risk Score" />
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1">Building Age (years)</label>
        <input type="number" min={0} max={200}
          value={data.buildingAgeYears ?? ''}
          onChange={e => set('buildingAgeYears')(e.target.value === '' ? undefined : parseInt(e.target.value))}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          placeholder="e.g. 10"
        />
        <p className="text-xs text-gray-400 mt-1">≤5yrs→25 · ≤15yrs→15 · ≤30yrs→5 · &gt;30yrs→0</p>
      </div>
      <RadioGroup label="Maintenance Quality" options={[
        { value: 'GOOD', label: 'Good / Excellent — well maintained',  pts: 25 },
        { value: 'FAIR', label: 'Fair — adequate but some issues',     pts: 12 },
        { value: 'POOR', label: 'Poor — needs major work',             pts: 0  },
      ]} value={data.maintenanceQuality} onChange={v => set('maintenanceQuality')(v)} />
      <RadioGroup label="Location Rating" options={[
        { value: 'PRIME',   label: 'Prime urban — very high demand', pts: 25 },
        { value: 'GOOD',    label: 'Good urban — solid demand',      pts: 18 },
        { value: 'AVERAGE', label: 'Peri-urban / town',              pts: 10 },
        { value: 'POOR',    label: 'Rural — low demand',             pts: 0  },
      ]} value={data.locationRating} onChange={v => set('locationRating')(v)} />
      <div className="bg-gray-50 rounded-xl border border-gray-200 px-4">
        <Toggle label="Building / Property Insurance" pts="+25 pts" value={data.hasInsurance} onChange={v => set('hasInsurance')(v)} />
      </div>
    </div>
  );
}

// ── Shop owner ops form ──────────────────────────────────────────────────────
function ShopOwnerOps({ data, onChange }: { data: Partial<ShopOwnerOpsData>; onChange: (d: Partial<ShopOwnerOpsData>) => void }) {
  const score = computeShopOwnerOpsScore(data);
  const set = (k: keyof ShopOwnerOpsData) => (v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-5">
      <ScoreBadge score={score} label="Shop Owner Operational Risk Score" />
      <RadioGroup label="Location Risk Level" hint="Lower risk = higher demand, stable customers" options={[
        { value: 'LOW',    label: 'Low — busy, stable location', pts: 30 },
        { value: 'MEDIUM', label: 'Medium — moderate foot traffic', pts: 15 },
        { value: 'HIGH',   label: 'High — risky, unstable location', pts: 0 },
      ]} value={data.locationRiskLevel} onChange={v => set('locationRiskLevel')(v)} />
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1">Competitors within 500m</label>
        <input type="number" min={0} max={100}
          value={data.competitorCount ?? ''}
          onChange={e => set('competitorCount')(e.target.value === '' ? undefined : parseInt(e.target.value))}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          placeholder="e.g. 2"
        />
        <p className="text-xs text-gray-400 mt-1">0–2 competitors→+20 · 3–5→+10 · &gt;5→+0</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1">Number of Regular Suppliers</label>
        <input type="number" min={1} max={100}
          value={data.supplierCount ?? ''}
          onChange={e => set('supplierCount')(e.target.value === '' ? undefined : parseInt(e.target.value))}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          placeholder="e.g. 3"
        />
        <p className="text-xs text-gray-400 mt-1">1 supplier→+5 · 2→+15 · 3+→+25</p>
      </div>
      <div className="bg-gray-50 rounded-xl border border-gray-200 px-4">
        <Toggle label="Business Insurance (fire, theft, stock)" pts="+25 pts" value={data.hasInsurance} onChange={v => set('hasInsurance')(v)} />
      </div>
    </div>
  );
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-5 py-3">
      <span className="text-sm font-medium text-violet-800">{label}</span>
      <span className="text-2xl font-bold text-violet-700">{score}<span className="text-sm font-normal text-violet-400">/100</span></span>
    </div>
  );
}

export default function OperationalRiskForm({ segment, data, onChange }: Props) {
  if (segment === 'FARMER')
    return <FarmerOps data={data as Partial<FarmerOpsData>} onChange={onChange as (d: Partial<FarmerOpsData>) => void} />;
  if (segment === 'LANDLORD')
    return <LandlordOps data={data as Partial<LandlordOpsData>} onChange={onChange as (d: Partial<LandlordOpsData>) => void} />;
  return <ShopOwnerOps data={data as Partial<ShopOwnerOpsData>} onChange={onChange as (d: Partial<ShopOwnerOpsData>) => void} />;
}
