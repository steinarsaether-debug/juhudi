// Step 4 of ILP wizard: Cash Flow — 12-month grid + DSR indicator
// Hard-block warning when DSR > 50%.
import { useState } from 'react';
import { computeCashFlowScore } from '../../utils/ilpScoring';

export interface MonthRow {
  month:   string;
  income:  number;
  expense: number;
}

export interface CashFlowData {
  totalMonthlyIncome:  number;
  existingMonthlyDebt: number;
  newInstallmentKes:   number;
  months?:             MonthRow[];
}

interface Props {
  data:            Partial<CashFlowData>;
  onChange:        (data: Partial<CashFlowData>) => void;
  installmentKes?: number;  // pre-calculated from loan amount + term
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function defaultMonths(): MonthRow[] {
  return MONTH_NAMES.map(m => ({ month: m, income: 0, expense: 0 }));
}

function fmt(n: number) {
  return n.toLocaleString('en-KE', { minimumFractionDigits: 0 });
}

export default function CashFlowTable({ data, onChange, installmentKes }: Props) {
  const [showMonthly, setShowMonthly] = useState(false);
  const months = data.months ?? defaultMonths();

  const effectiveInstallment = installmentKes ?? data.newInstallmentKes ?? 0;

  const { score, dsr, hardBlock } = computeCashFlowScore({
    totalMonthlyIncome:  data.totalMonthlyIncome ?? 0,
    existingMonthlyDebt: data.existingMonthlyDebt ?? 0,
    newInstallmentKes:   effectiveInstallment,
  });

  const dsrColor =
    hardBlock       ? 'text-red-600 font-bold' :
    dsr > 40        ? 'text-amber-600 font-semibold' :
    dsr > 30        ? 'text-yellow-600' :
                      'text-green-600 font-semibold';

  const set = (key: keyof CashFlowData) => (val: unknown) =>
    onChange({ ...data, [key]: val, newInstallmentKes: effectiveInstallment });

  const updateMonth = (idx: number, field: 'income' | 'expense', val: number) => {
    const newMonths = months.map((m, i) => i === idx ? { ...m, [field]: val } : m);
    // Recalculate average income from months
    const avgIncome = newMonths.reduce((s, m) => s + m.income, 0) / 12;
    onChange({ ...data, months: newMonths, totalMonthlyIncome: Math.round(avgIncome), newInstallmentKes: effectiveInstallment });
  };

  return (
    <div className="space-y-5">
      {/* DSR summary card */}
      <div className={`rounded-xl border p-4 ${hardBlock ? 'bg-red-50 border-red-400' : 'bg-teal-50 border-teal-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Debt Service Ratio (DSR)</p>
            <p className="text-xs text-gray-500 mt-0.5">
              (Existing debt + new installment) / Monthly income × 100
            </p>
          </div>
          <div className="text-right">
            <div className={`text-3xl ${dsrColor}`}>{dsr.toFixed(1)}%</div>
            <div className="text-xs text-gray-500">Score: {score}/100</div>
          </div>
        </div>
        {hardBlock && (
          <div className="mt-3 bg-red-100 border border-red-300 rounded-lg px-3 py-2 text-xs text-red-700 font-medium">
            ⛔ DSR exceeds 50% — this application cannot be submitted. Reduce the loan amount or correct income figures.
          </div>
        )}
        {!hardBlock && (
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${dsr >= 50 ? 'bg-red-500' : dsr >= 40 ? 'bg-amber-500' : dsr >= 30 ? 'bg-yellow-400' : 'bg-green-500'}`}
              style={{ width: `${Math.min(100, dsr)}%` }}
            />
          </div>
        )}
      </div>

      {/* Summary fields */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Total Monthly Income (KES)</label>
          <input type="number" min={0}
            value={data.totalMonthlyIncome ?? ''}
            onChange={e => set('totalMonthlyIncome')(e.target.value === '' ? 0 : parseFloat(e.target.value))}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="e.g. 50000"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Existing Monthly Debt (KES)</label>
          <input type="number" min={0}
            value={data.existingMonthlyDebt ?? ''}
            onChange={e => set('existingMonthlyDebt')(e.target.value === '' ? 0 : parseFloat(e.target.value))}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="e.g. 5000"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">New Monthly Installment (KES)</label>
          <input type="number" min={0}
            value={effectiveInstallment || ''}
            readOnly={!!installmentKes}
            onChange={e => onChange({ ...data, newInstallmentKes: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${installmentKes ? 'bg-gray-50 text-gray-500' : ''}`}
            placeholder="e.g. 8000"
          />
          {installmentKes && <p className="text-xs text-gray-400 mt-0.5">Auto-calculated from loan details</p>}
        </div>
      </div>

      {/* Optional 12-month grid */}
      <div>
        <button type="button"
          onClick={() => setShowMonthly(s => !s)}
          className="text-sm text-teal-700 underline hover:text-teal-900"
        >
          {showMonthly ? 'Hide' : 'Show'} 12-month income / expense breakdown (optional)
        </button>

        {showMonthly && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-2 py-2 text-left border border-gray-200 font-medium text-gray-600">Month</th>
                  <th className="px-2 py-2 text-right border border-gray-200 font-medium text-gray-600">Income (KES)</th>
                  <th className="px-2 py-2 text-right border border-gray-200 font-medium text-gray-600">Expense (KES)</th>
                  <th className="px-2 py-2 text-right border border-gray-200 font-medium text-gray-600">Net (KES)</th>
                </tr>
              </thead>
              <tbody>
                {months.map((row, i) => (
                  <tr key={row.month} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-2 py-1.5 border border-gray-200 font-medium">{row.month}</td>
                    <td className="px-2 py-1 border border-gray-200">
                      <input type="number" min={0}
                        value={row.income || ''}
                        onChange={e => updateMonth(i, 'income', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        className="w-full text-right bg-transparent focus:outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-1 border border-gray-200">
                      <input type="number" min={0}
                        value={row.expense || ''}
                        onChange={e => updateMonth(i, 'expense', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        className="w-full text-right bg-transparent focus:outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className={`px-2 py-1.5 border border-gray-200 text-right font-medium ${row.income - row.expense < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {fmt(row.income - row.expense)}
                    </td>
                  </tr>
                ))}
                {/* Totals */}
                <tr className="bg-teal-50 font-semibold">
                  <td className="px-2 py-2 border border-gray-200">Average</td>
                  <td className="px-2 py-2 border border-gray-200 text-right text-teal-700">
                    {fmt(Math.round(months.reduce((s, m) => s + m.income, 0) / 12))}
                  </td>
                  <td className="px-2 py-2 border border-gray-200 text-right text-teal-700">
                    {fmt(Math.round(months.reduce((s, m) => s + m.expense, 0) / 12))}
                  </td>
                  <td className="px-2 py-2 border border-gray-200 text-right text-teal-700">
                    {fmt(Math.round(months.reduce((s, m) => s + m.income - m.expense, 0) / 12))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
