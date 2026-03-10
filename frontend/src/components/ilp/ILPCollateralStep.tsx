// Step 5 of ILP wizard: Enhanced Collateral Entry
// Per-item valuation, verified toggle, live coverage ratio.
import { Plus, Trash2 } from 'lucide-react';
import { computeCollateralScore } from '../../utils/ilpScoring';

export interface CollateralItem {
  type:       string;
  valueKes:   number;
  isVerified: boolean;
}

export interface CollateralData {
  items:         CollateralItem[];
  loanAmountKes: number;
}

interface Props {
  data:     Partial<CollateralData>;
  onChange: (data: Partial<CollateralData>) => void;
}

const COLLATERAL_TYPES = [
  { value: 'TITLE_DEED',          label: 'Title Deed',             bonus: '+20 pts bonus' },
  { value: 'MOTOR_VEHICLE',       label: 'Motor Vehicle (log book)', bonus: '+10 pts bonus' },
  { value: 'CHATTEL',             label: 'Chattel / Equipment',    bonus: '+5 pts bonus' },
  { value: 'LIVESTOCK',           label: 'Livestock',              bonus: '' },
  { value: 'CROP_LIEN',           label: 'Crop Lien',              bonus: '' },
  { value: 'SAVINGS_DEPOSIT',     label: 'Savings Deposit',        bonus: '' },
  { value: 'PERSONAL_GUARANTEE',  label: 'Personal Guarantee',     bonus: '' },
  { value: 'GROUP_GUARANTEE',     label: 'Group Guarantee',        bonus: '' },
  { value: 'OTHER',               label: 'Other',                  bonus: '' },
];

function fmt(n: number) {
  return n.toLocaleString('en-KE');
}

export default function ILPCollateralStep({ data, onChange }: Props) {
  const items = data.items ?? [];
  const loanAmount = data.loanAmountKes ?? 0;

  const totalValue = items.reduce((s, i) => s + i.valueKes, 0);
  const coverageRatio = loanAmount > 0 ? totalValue / loanAmount : 0;
  const score = computeCollateralScore(items, loanAmount);

  const update = (newItems: CollateralItem[]) =>
    onChange({ ...data, items: newItems });

  const addItem = () =>
    update([...items, { type: 'OTHER', valueKes: 0, isVerified: false }]);

  const removeItem = (i: number) =>
    update(items.filter((_, idx) => idx !== i));

  const setItem = (i: number, partial: Partial<CollateralItem>) =>
    update(items.map((item, idx) => idx === i ? { ...item, ...partial } : item));

  const coverageColor =
    coverageRatio > 2    ? 'text-green-600' :
    coverageRatio >= 1.5 ? 'text-teal-600' :
    coverageRatio >= 1   ? 'text-amber-600' :
                           'text-red-500';

  return (
    <div className="space-y-5">
      {/* Score + coverage */}
      <div className="flex gap-3">
        <div className="flex-1 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-center">
          <div className="text-2xl font-bold text-orange-700">{score}<span className="text-sm font-normal text-orange-400">/100</span></div>
          <div className="text-xs text-orange-600 mt-0.5">Collateral Score</div>
        </div>
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center">
          <div className={`text-2xl font-bold ${coverageColor}`}>{coverageRatio.toFixed(2)}×</div>
          <div className="text-xs text-gray-500 mt-0.5">Coverage Ratio</div>
        </div>
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center">
          <div className="text-lg font-bold text-gray-700">KES {fmt(totalValue)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Collateral Value</div>
        </div>
      </div>

      {/* Loan amount ref */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Loan Amount (KES)</label>
        <input type="number" min={0}
          value={data.loanAmountKes ?? ''}
          onChange={e => onChange({ ...data, loanAmountKes: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          placeholder="e.g. 200000"
        />
        <p className="text-xs text-gray-400 mt-1">Coverage &gt;2× → 100 pts · ≥1.5× → 75 · ≥1× → 50 · &lt;1× → 20</p>
      </div>

      {/* Collateral items */}
      <div className="space-y-3">
        {items.map((item, i) => {
          const typeInfo = COLLATERAL_TYPES.find(t => t.value === item.type);
          return (
            <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Item {i + 1}</span>
                <button type="button" onClick={() => removeItem(i)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Type</label>
                  <select
                    value={item.type}
                    onChange={e => setItem(i, { type: e.target.value })}
                    className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {COLLATERAL_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}{t.bonus ? ` (${t.bonus})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Estimated Value (KES)</label>
                  <input type="number" min={0}
                    value={item.valueKes || ''}
                    onChange={e => setItem(i, { valueKes: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                    className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button type="button"
                  onClick={() => setItem(i, { isVerified: !item.isVerified })}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    item.isVerified
                      ? 'bg-green-50 border-green-400 text-green-700'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-green-400'
                  }`}
                >
                  <span>{item.isVerified ? '✓' : '○'}</span>
                  {item.isVerified ? 'Verified' : 'Mark as Verified'}
                </button>
                {typeInfo?.bonus && (
                  <span className="text-xs text-teal-600 font-medium">{typeInfo.bonus}</span>
                )}
              </div>
            </div>
          );
        })}

        <button type="button"
          onClick={addItem}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-orange-400 hover:text-orange-600 transition-all"
        >
          <Plus className="h-4 w-4" /> Add Collateral Item
        </button>
      </div>
    </div>
  );
}
