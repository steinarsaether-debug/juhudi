import { computeShopOwnerBusinessScore } from '../../utils/ilpScoring';

export interface ShopOwnerBusinessData {
  yearsInBusiness:    number;
  hasBusinessLicense: boolean;
  hasBookkeeping:     boolean;
  stockVsLoanRatio:   number;
  stockValueKes?:     number;  // helper for UI (not sent to backend as-is)
  loanAmountKes?:     number;  // helper for UI
}

interface Props {
  data:     Partial<ShopOwnerBusinessData>;
  onChange: (data: Partial<ShopOwnerBusinessData>) => void;
}

function Toggle({ label, hint, value, onChange }: {
  label: string; hint: string; value?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400">{hint}</p>
      </div>
      <div className="flex gap-2">
        {[true, false].map(v => (
          <button key={String(v)} type="button"
            onClick={() => onChange(v)}
            className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-all ${
              value === v
                ? v ? 'bg-green-600 border-green-600 text-white' : 'bg-red-50 border-red-400 text-red-700'
                : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-400'
            }`}
          >
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ShopOwnerBusinessAssessment({ data, onChange }: Props) {
  const score = computeShopOwnerBusinessScore(data);
  const set = (key: keyof ShopOwnerBusinessData) => (val: unknown) =>
    onChange({ ...data, [key]: val });

  // Compute ratio when both values present
  const handleStockChange = (stockKes: number) => {
    const loan = data.loanAmountKes ?? 0;
    const ratio = loan > 0 ? stockKes / loan : 0;
    onChange({ ...data, stockValueKes: stockKes, stockVsLoanRatio: ratio });
  };

  const handleLoanChange = (loanKes: number) => {
    const stock = data.stockValueKes ?? 0;
    const ratio = loanKes > 0 ? stock / loanKes : 0;
    onChange({ ...data, loanAmountKes: loanKes, stockVsLoanRatio: ratio });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3">
        <span className="text-sm font-medium text-indigo-800">Shop Owner Business Score</span>
        <span className="text-2xl font-bold text-indigo-700">{score}<span className="text-sm font-normal text-indigo-400">/100</span></span>
      </div>

      {/* Years in business */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1">
          Years in Business <span className="text-gray-400 font-normal">(max raw 50 pts)</span>
        </label>
        <input
          type="number" min={0} max={60}
          value={data.yearsInBusiness ?? ''}
          onChange={e => set('yearsInBusiness')(e.target.value === '' ? undefined : parseFloat(e.target.value))}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="e.g. 3"
        />
        <p className="text-xs text-gray-400 mt-1">&lt;1yr→10 · 1–3yrs→30 · 3+yrs→50</p>
      </div>

      {/* Toggle factors */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 px-4">
        <Toggle
          label="Business / Trading Licence"
          hint="+30 raw pts if verified"
          value={data.hasBusinessLicense}
          onChange={v => set('hasBusinessLicense')(v)}
        />
        <Toggle
          label="Has Bookkeeping / Sales Records"
          hint="+20 raw pts — cashbook, app, or spreadsheet"
          value={data.hasBookkeeping}
          onChange={v => set('hasBookkeeping')(v)}
        />
      </div>

      {/* Stock vs loan ratio */}
      <div>
        <label className="block text-sm font-medium text-gray-800 mb-1">
          Stock Value vs Loan Amount <span className="text-gray-400 font-normal">(max raw 30 pts)</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Current Stock Value (KES)</label>
            <input
              type="number" min={0}
              value={data.stockValueKes ?? ''}
              onChange={e => handleStockChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. 200000"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Loan Amount (KES)</label>
            <input
              type="number" min={0}
              value={data.loanAmountKes ?? ''}
              onChange={e => handleLoanChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. 150000"
            />
          </div>
        </div>
        {data.stockVsLoanRatio !== undefined && data.loanAmountKes && data.loanAmountKes > 0 && (
          <p className="text-xs mt-1.5">
            Ratio: <strong>{(data.stockVsLoanRatio ?? 0).toFixed(2)}×</strong>
            {' — '}
            {data.stockVsLoanRatio! >= 2
              ? <span className="text-green-600">Excellent (+30 pts)</span>
              : data.stockVsLoanRatio! >= 1
                ? <span className="text-amber-600">Good (+20 pts)</span>
                : <span className="text-red-500">Low (+0 pts)</span>
            }
          </p>
        )}
      </div>
    </div>
  );
}
