// ─── AmortisationTable ────────────────────────────────────────────────────────
// Reusable reducing-balance amortisation schedule table.
// Props: principal (KES), annualRatePct (e.g. 18), termMonths, startDate? (ISO string)
import { useMemo } from 'react';

interface AmortisationRow {
  month:        number;
  dueDate:      string;
  openingBal:   number;
  principal:    number;
  interest:     number;
  instalment:   number;
  closingBal:   number;
}

interface Props {
  principal:      number;
  annualRatePct:  number;
  termMonths:     number;
  startDate?:     string;   // ISO date — first payment date; defaults to 1 month from today
  compact?:       boolean;  // if true, show abbreviated table (first 3 + last 1)
}

function fmt(n: number) {
  return n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function addMonths(base: Date, n: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + n);
  return d;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function buildSchedule(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  startDate?: string,
): AmortisationRow[] {
  const monthlyRate = annualRatePct / 100 / 12;
  const instalment = monthlyRate > 0
    ? (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
      (Math.pow(1 + monthlyRate, termMonths) - 1)
    : principal / termMonths;

  const firstPayment = startDate ? new Date(startDate) : addMonths(new Date(), 1);
  const rows: AmortisationRow[] = [];
  let balance = principal;

  for (let m = 1; m <= termMonths; m++) {
    const interest   = balance * monthlyRate;
    const principalP = Math.min(instalment - interest, balance);
    const closing    = Math.max(balance - principalP, 0);

    rows.push({
      month:      m,
      dueDate:    fmtDate(addMonths(firstPayment, m - 1)),
      openingBal: Math.round(balance),
      interest:   Math.round(interest),
      principal:  Math.round(principalP),
      instalment: Math.round(instalment),
      closingBal: Math.round(closing),
    });

    balance = closing;
  }

  return rows;
}

export default function AmortisationTable({
  principal,
  annualRatePct,
  termMonths,
  startDate,
  compact = false,
}: Props) {
  const rows = useMemo(
    () => buildSchedule(principal, annualRatePct, termMonths, startDate),
    [principal, annualRatePct, termMonths, startDate],
  );

  const totalInterest  = rows.reduce((s, r) => s + r.interest, 0);
  const totalPrincipal = rows.reduce((s, r) => s + r.principal, 0);
  const totalPayable   = rows.reduce((s, r) => s + r.instalment, 0);

  // In compact mode show first 3 rows + last row with ellipsis row between
  const displayRows = compact && rows.length > 4
    ? [...rows.slice(0, 3), null, rows[rows.length - 1]]
    : rows;

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
          <p className="text-xs text-blue-600 font-medium">Monthly Instalment</p>
          <p className="text-sm font-bold text-blue-900 mt-0.5">KES {fmt(rows[0]?.instalment ?? 0)}</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">
          <p className="text-xs text-orange-600 font-medium">Total Interest</p>
          <p className="text-sm font-bold text-orange-900 mt-0.5">KES {fmt(totalInterest)}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2">
          <p className="text-xs text-green-600 font-medium">Total Repayable</p>
          <p className="text-sm font-bold text-green-900 mt-0.5">KES {fmt(totalPayable)}</p>
        </div>
      </div>

      {/* Schedule table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-gray-500 font-medium">#</th>
              <th className="px-3 py-2 text-left text-gray-500 font-medium">Due Date</th>
              <th className="px-3 py-2 text-right text-gray-500 font-medium">Opening</th>
              <th className="px-3 py-2 text-right text-gray-500 font-medium">Principal</th>
              <th className="px-3 py-2 text-right text-gray-500 font-medium">Interest</th>
              <th className="px-3 py-2 text-right text-gray-500 font-medium">Instalment</th>
              <th className="px-3 py-2 text-right text-gray-500 font-medium">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayRows.map((row, i) =>
              row === null ? (
                <tr key="ellipsis">
                  <td colSpan={7} className="px-3 py-1.5 text-center text-gray-400">
                    ⋮ {rows.length - 4} more months ⋮
                  </td>
                </tr>
              ) : (
                <tr key={row.month} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-3 py-2 text-gray-500">{row.month}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.dueDate}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{fmt(row.openingBal)}</td>
                  <td className="px-3 py-2 text-right text-green-700 font-medium">{fmt(row.principal)}</td>
                  <td className="px-3 py-2 text-right text-orange-600">{fmt(row.interest)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmt(row.instalment)}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{fmt(row.closingBal)}</td>
                </tr>
              ),
            )}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-gray-700 text-xs">Totals</td>
              <td className="px-3 py-2 text-right text-green-700 text-xs">{fmt(totalPrincipal)}</td>
              <td className="px-3 py-2 text-right text-orange-600 text-xs">{fmt(totalInterest)}</td>
              <td className="px-3 py-2 text-right text-gray-900 text-xs">{fmt(totalPayable)}</td>
              <td className="px-3 py-2 text-right text-gray-400 text-xs">—</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-gray-400 text-right">
        {annualRatePct}% p.a. · reducing balance · {termMonths} months
      </p>
    </div>
  );
}
