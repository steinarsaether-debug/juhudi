import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { BarChart3, ChevronRight, Info, AlertTriangle, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import { customerApi, scoringApi, getErrorMessage } from '../../services/api';
import { Customer, CreditScore, ScoreBreakdown, BenchmarkComparison } from '../../types';
import StatusBadge from '../../components/common/StatusBadge';

interface ScoringForm {
  monthlyFarmIncome: number;
  monthlyOffFarmIncome: number;
  monthlyHouseholdExpenses: number;
  otherMonthlyDebt: number;
  mpesaMonthlyAvgKes?: number;
  hasGroupMembership: boolean;
  groupMonthlySavingsKes?: number;
  farmSizeAcres: number;
  landOwnership: string;
  primaryCrop: string;
  secondaryCrops: string;
  marketAccess: string;
  irrigationType: string;
  livestockCount: number;
  yaraMemberSinceYears?: number;
  yaraProductsUsedCount: number;
  crbStatus: string;
  previousLoansCount: number;
  previousLoansRepaidOnTime?: boolean;
  numberOfDependents: number;
  requestedAmountKes: number;
  termMonths: number;
}

function ScoreBar({ label, score, max, breakdown }: { label: string; score: number; max: number; breakdown?: ScoreBreakdown[] }) {
  const [open, setOpen] = useState(false);
  const pct = (score / max) * 100;
  const color = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="border border-gray-100 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm text-gray-800">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{score}/{max}</span>
          {breakdown && (
            <button onClick={() => setOpen(o => !o)} className="text-gray-400 hover:text-gray-600">
              <Info className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {open && breakdown && (
        <div className="mt-3 space-y-2">
          {breakdown.map((b) => (
            <div key={b.component} className="bg-gray-50 rounded p-2 text-xs">
              <div className="flex justify-between mb-1">
                <span className="font-medium text-gray-700">{b.component}</span>
                <span>{b.score}/{b.maxScore}</span>
              </div>
              <ul className="text-gray-500 space-y-0.5">
                {b.notes.map((n, i) => <li key={i}>• {n}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BenchmarkComparisonTable({ comparisons, penalty }: { comparisons: BenchmarkComparison[]; penalty: number }) {
  const [open, setOpen] = useState(false);
  const flagged = comparisons.filter(c => c.flagged);

  if (comparisons.length === 0) return null;

  return (
    <div className="card p-5">
      <button
        className="flex items-center justify-between w-full text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-gray-800">Benchmark Comparison</h3>
          {flagged.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 text-xs px-2 py-0.5">
              <AlertTriangle className="h-3 w-3" />
              {flagged.length} flag{flagged.length > 1 ? 's' : ''}
            </span>
          )}
          {penalty > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5">
              -{penalty} pts penalty
            </span>
          )}
        </div>
        <Info className="h-4 w-4 text-gray-400" />
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-500">
            Comparing stated monthly farm income against independently sourced benchmarks.
            {penalty > 0 && <span className="text-red-600 font-medium"> A reliability penalty of -{penalty} pts has been applied to the cashflow score.</span>}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-1.5 font-medium text-gray-600">Benchmark</th>
                  <th className="text-right py-1.5 font-medium text-gray-600">Stated/mo</th>
                  <th className="text-right py-1.5 font-medium text-gray-600">Low–Mid–High</th>
                  <th className="text-right py-1.5 font-medium text-gray-600">Deviation</th>
                  <th className="text-left py-1.5 font-medium text-gray-600">Source</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((c) => {
                  const devColor = c.flagged
                    ? 'text-red-600 font-semibold'
                    : c.deviationPct > 20
                    ? 'text-orange-600'
                    : c.deviationPct < -20
                    ? 'text-blue-600'
                    : 'text-gray-600';
                  const DeviationIcon =
                    c.deviationPct > 5 ? TrendingUp : c.deviationPct < -5 ? TrendingDown : Minus;

                  return (
                    <tr key={c.itemName} className={`border-b border-gray-50 ${c.flagged ? 'bg-red-50' : ''}`}>
                      <td className="py-1.5 pr-2">
                        <div className="font-medium text-gray-800">{c.itemName}</div>
                        <div className="text-gray-400">{c.scope} · {c.referenceYear}</div>
                      </td>
                      <td className="py-1.5 text-right text-gray-700">
                        {c.statedMonthlyKes.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-right text-gray-500">
                        {c.benchmarkLowKes.toLocaleString()}–{c.benchmarkMidKes.toLocaleString()}–{c.benchmarkHighKes.toLocaleString()}
                      </td>
                      <td className={`py-1.5 text-right ${devColor}`}>
                        <span className="inline-flex items-center gap-0.5 justify-end">
                          <DeviationIcon className="h-3 w-3" />
                          {c.deviationPct > 0 ? '+' : ''}{c.deviationPct}%
                        </span>
                        {c.flagged && <div className="text-red-500">⚠ inflated?</div>}
                      </td>
                      <td className="py-1.5 pl-2 text-gray-400">{c.sourceShortName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreditScoring() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<CreditScore | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: customer } = useQuery<Customer>({
    queryKey: ['customer', id],
    queryFn: () => customerApi.get(id!),
  });

  const fp = customer?.financialProfile;
  const farm = customer?.farmProfile;

  const yaraMemberYears = farm?.yaraMemberSince
    ? Math.max(0, (Date.now() - new Date(farm.yaraMemberSince).getTime()) / (1000 * 60 * 60 * 24 * 365))
    : 0;

  const { register, handleSubmit } = useForm<ScoringForm>({
    defaultValues: {
      monthlyFarmIncome: fp?.monthlyFarmIncome ?? 0,
      monthlyOffFarmIncome: fp?.monthlyOffFarmIncome ?? 0,
      monthlyHouseholdExpenses: fp?.monthlyHouseholdExpenses ?? 0,
      otherMonthlyDebt: fp?.otherMonthlyDebt ?? 0,
      mpesaMonthlyAvgKes: fp?.mpesaMonthlyAvgKes ?? undefined,
      hasGroupMembership: fp?.hasGroupMembership ?? false,
      groupMonthlySavingsKes: fp?.groupMonthlySavingsKes ?? undefined,
      farmSizeAcres: farm?.farmSize ?? 1,
      landOwnership: farm?.landOwnership ?? 'OWNED',
      primaryCrop: farm?.primaryCrop ?? '',
      secondaryCrops: farm?.secondaryCrops?.join(', ') ?? '',
      marketAccess: farm?.marketAccess ?? 'LOCAL_MARKET',
      irrigationType: farm?.irrigationType ?? 'RAIN_FED',
      livestockCount: farm?.livestockCount ?? 0,
      yaraMemberSinceYears: Math.round(yaraMemberYears),
      yaraProductsUsedCount: farm?.yaraProductsUsed?.length ?? 0,
      crbStatus: fp?.crbStatus ?? 'UNKNOWN',
      previousLoansCount: fp?.previousLoansCount ?? 0,
      previousLoansRepaidOnTime: fp?.previousLoansRepaidOnTime ?? undefined,
      numberOfDependents: customer?.numberOfDependents ?? 0,
      requestedAmountKes: 50000,
      termMonths: 6,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: ScoringForm) => {
      const payload = {
        ...data,
        secondaryCrops: data.secondaryCrops ? data.secondaryCrops.split(',').map(s => s.trim()).filter(Boolean) : [],
        yaraMemberSinceYears: data.yaraMemberSinceYears ?? null,
        mpesaMonthlyAvgKes: data.mpesaMonthlyAvgKes ?? null,
        groupMonthlySavingsKes: data.groupMonthlySavingsKes ?? null,
        previousLoansRepaidOnTime: data.previousLoansRepaidOnTime ?? null,
      };
      return scoringApi.run(id!, payload);
    },
    onSuccess: (data) => { setResult(data); setError(null); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const recColor = {
    APPROVE: 'text-green-700 bg-green-50 border-green-200',
    CONDITIONAL: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    DECLINE: 'text-red-700 bg-red-50 border-red-200',
    STRONG_DECLINE: 'text-red-900 bg-red-100 border-red-300',
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Credit Scoring</h1>
          {customer && (
            <p className="text-sm text-gray-500 mt-1">
              <Link to={`/customers/${id}`} className="text-primary-700 hover:underline">
                {customer.firstName} {customer.lastName}
              </Link>
              {' '}&bull; {customer.county}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input form */}
        <div>
          <form onSubmit={handleSubmit(data => mutation.mutate(data))} className="space-y-4">
            <div className="card p-5">
              <h2 className="section-title">Cash Flow (35 pts)</h2>
              <div className="space-y-3">
                {[
                  { field: 'monthlyFarmIncome', label: 'Monthly Farm Income (KES) *' },
                  { field: 'monthlyOffFarmIncome', label: 'Monthly Off-Farm Income (KES)' },
                  { field: 'monthlyHouseholdExpenses', label: 'Monthly Household Expenses (KES) *' },
                  { field: 'otherMonthlyDebt', label: 'Existing Monthly Debt Repayments (KES)' },
                  { field: 'mpesaMonthlyAvgKes', label: 'M-Pesa Monthly Avg (KES)' },
                  { field: 'groupMonthlySavingsKes', label: 'Group/Chama Monthly Savings (KES)' },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label className="label text-xs">{label}</label>
                    <input type="number" min="0" className="input text-sm"
                      {...register(field as keyof ScoringForm, { valueAsNumber: true })} />
                  </div>
                ))}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...register('hasGroupMembership')} />
                  Is a member of a savings group
                </label>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="section-title">Ability (35 pts)</h2>
              <div className="space-y-3">
                <div>
                  <label className="label text-xs">Farm Size (acres) *</label>
                  <input type="number" step="0.1" min="0.1" className="input text-sm"
                    {...register('farmSizeAcres', { required: true, valueAsNumber: true })} />
                </div>
                <div>
                  <label className="label text-xs">Land Ownership</label>
                  <select className="input text-sm" {...register('landOwnership')}>
                    <option value="OWNED">Owned</option>
                    <option value="LEASED">Leased</option>
                    <option value="COMMUNAL">Communal</option>
                    <option value="FAMILY">Family</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Primary Crop</label>
                  <input className="input text-sm" {...register('primaryCrop')} />
                </div>
                <div>
                  <label className="label text-xs">Secondary Crops (comma-separated)</label>
                  <input className="input text-sm" placeholder="Beans, Vegetables..."
                    {...register('secondaryCrops')} />
                </div>
                <div>
                  <label className="label text-xs">Market Access</label>
                  <select className="input text-sm" {...register('marketAccess')}>
                    <option value="CONTRACT">Contract Farming</option>
                    <option value="COOPERATIVE">Cooperative</option>
                    <option value="LOCAL_MARKET">Local Market</option>
                    <option value="SUBSISTENCE">Subsistence</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Irrigation</label>
                  <select className="input text-sm" {...register('irrigationType')}>
                    <option value="IRRIGATED">Irrigated</option>
                    <option value="RAIN_FED">Rain-fed</option>
                    <option value="MIXED">Mixed</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="section-title">Willingness (30 pts)</h2>
              <div className="space-y-3">
                <div>
                  <label className="label text-xs">Years as Yara Customer</label>
                  <input type="number" min="0" step="0.5" className="input text-sm"
                    {...register('yaraMemberSinceYears', { valueAsNumber: true })} />
                </div>
                <div>
                  <label className="label text-xs">Number of Yara Products Used</label>
                  <input type="number" min="0" className="input text-sm"
                    {...register('yaraProductsUsedCount', { valueAsNumber: true })} />
                </div>
                <div>
                  <label className="label text-xs">CRB Status</label>
                  <select className="input text-sm" {...register('crbStatus')}>
                    <option value="UNKNOWN">Not checked</option>
                    <option value="CLEAR">Clear</option>
                    <option value="PERFORMING">Active / Performing</option>
                    <option value="LISTED">Negative Listing</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Number of Previous Loans</label>
                  <input type="number" min="0" className="input text-sm"
                    {...register('previousLoansCount', { valueAsNumber: true })} />
                </div>
                <div>
                  <label className="label text-xs">Number of Dependents</label>
                  <input type="number" min="0" className="input text-sm"
                    {...register('numberOfDependents', { valueAsNumber: true })} />
                </div>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="section-title">Loan Request</h2>
              <div className="space-y-3">
                <div>
                  <label className="label text-xs">Requested Amount (KES) *</label>
                  <input type="number" min="1000" max="500000" className="input text-sm"
                    {...register('requestedAmountKes', { required: true, valueAsNumber: true })} />
                </div>
                <div>
                  <label className="label text-xs">Term (months)</label>
                  <select className="input text-sm" {...register('termMonths', { valueAsNumber: true })}>
                    <option value={3}>3 months</option>
                    <option value={6}>6 months</option>
                    <option value={12}>12 months</option>
                    <option value={18}>18 months</option>
                    <option value={24}>24 months</option>
                  </select>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" disabled={mutation.isPending} className="btn-primary w-full py-3">
              {mutation.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Calculating...
                </>
              ) : (
                <><BarChart3 className="h-4 w-4" /> Run Credit Score</>
              )}
            </button>
          </form>
        </div>

        {/* Results */}
        <div>
          {result ? (
            <div className="space-y-4">
              {/* Overall result */}
              <div className={`card p-6 border-2 ${recColor[result.recommendation]}`}>
                <div className="text-center mb-4">
                  <div className="text-5xl font-bold mb-1">{result.totalScore}</div>
                  <p className="text-sm opacity-70">out of 100</p>
                  <div className="mt-2">
                    <StatusBadge status={result.recommendation} />
                  </div>
                </div>
                <div className="text-center border-t pt-4">
                  <p className="text-xs opacity-70 mb-1">Maximum Loan Amount</p>
                  <p className="text-2xl font-bold">KES {result.maxLoanAmountKes.toLocaleString()}</p>
                  <p className="text-xs opacity-70 mt-1">Suggested term: {result.suggestedTermMonths} months</p>
                </div>
                {result.requiresSupervisorReview && (
                  <div className="mt-3 flex items-center gap-2 text-xs rounded-lg bg-white/50 p-2">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    Supervisor review required before disbursement
                  </div>
                )}
              </div>

              {/* Score breakdown */}
              <div className="card p-5 space-y-3">
                <h3 className="font-semibold text-sm text-gray-800">Score Breakdown (click info for details)</h3>
                <ScoreBar label="Cash Flow" score={result.cashflowScore} max={35} breakdown={result.cashflowBreakdown} />
                <ScoreBar label="Ability" score={result.abilityScore} max={35} breakdown={result.abilityBreakdown} />
                <ScoreBar label="Willingness" score={result.willingnessScore} max={30} breakdown={result.willingnessBreakdown} />
              </div>

              {/* Benchmark Comparison */}
              {result.benchmarkComparisons && result.benchmarkComparisons.length > 0 && (
                <BenchmarkComparisonTable
                  comparisons={result.benchmarkComparisons}
                  penalty={result.benchmarkPenaltyApplied ?? 0}
                />
              )}

              {/* Notes */}
              {result.scoringNotes && (
                <div className="card p-4 bg-yellow-50 border-yellow-200">
                  <h3 className="font-semibold text-sm text-yellow-800 mb-2">Scoring Notes</h3>
                  <p className="text-xs text-yellow-700 whitespace-pre-line">{result.scoringNotes}</p>
                </div>
              )}

              {/* AI Narrative */}
              {result.narrative && (
                <div className="card p-4 bg-indigo-50 border-indigo-200">
                  <h3 className="font-semibold text-sm text-indigo-800 mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> AI Loan Officer Narrative
                  </h3>
                  <p className="text-xs text-indigo-700 leading-relaxed">{result.narrative}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Link
                  to={`/customers/${id}/loan`}
                  state={{ creditScoreId: result.creditScoreId, maxAmount: result.maxLoanAmountKes, term: result.suggestedTermMonths }}
                  className={`btn-primary flex-1 ${result.recommendation === 'DECLINE' || result.recommendation === 'STRONG_DECLINE' ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  <CreditCard className="h-4 w-4" />
                  Proceed to Loan Application
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <Link to={`/customers/${id}`} className="btn-secondary">Back</Link>
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center text-gray-400">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Fill in the form and run the credit score to see results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreditCard({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>;
}
