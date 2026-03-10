/**
 * MpesaMonitor – Admin page to:
 *  1. Monitor all M-Pesa statement analyses across the system
 *  2. Tune the AI analysis algorithm (edit the prompt stored in SystemConfig)
 *
 * Access: ADMIN only
 */
import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Smartphone, BarChart3, Settings, RefreshCw,
  AlertTriangle, CheckCircle, Clock, XCircle,
  ChevronLeft, ChevronRight, RotateCcw, Save,
} from 'lucide-react';
import clsx from 'clsx';
import { adminApi, getErrorMessage } from '../../services/api';
import type { MpesaStatement, SystemConfig } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RISK_COLOUR: Record<string, string> = {
  LOW:       'bg-green-100 text-green-800',
  MEDIUM:    'bg-yellow-100 text-yellow-800',
  HIGH:      'bg-orange-100 text-orange-800',
  VERY_HIGH: 'bg-red-100 text-red-800',
};

const ACTION_COLOUR: Record<string, string> = {
  PROCEED:          'bg-green-50 text-green-700',
  ADDITIONAL_INFO:  'bg-yellow-50 text-yellow-700',
  CAUTION:          'bg-orange-50 text-orange-700',
  DECLINE:          'bg-red-50 text-red-700',
};

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return `KES ${Math.round(n).toLocaleString()}`;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING:    <Clock      className="h-3.5 w-3.5 text-gray-400" />,
  PROCESSING: <RefreshCw  className="h-3.5 w-3.5 text-blue-500 animate-spin" />,
  COMPLETE:   <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
  FAILED:     <XCircle    className="h-3.5 w-3.5 text-red-500" />,
};

// ─── Default prompt (must match what mpesaController.ts exports) ──────────────
// This is shown in the editor when no custom prompt is saved in the DB.
const DEFAULT_PROMPT = `You are a credit risk analyst for Juhudi Kilimo, a Kenyan agricultural microfinance institution. Analyse the following M-Pesa transaction history for a smallholder farmer applying for a loan.

ANALYSIS INSTRUCTIONS:

1. HIDDEN LOAN REPAYMENTS – Look for payments to Kenyan digital/mobile lenders:
   • Digital lenders: Tala (SpreadMobile), Branch International, Zenka, Timiza (Absa), Haraka, Okolea, Zidisha
   • Telco credit: M-Shwari (NCBA), KCB M-Pesa, Equity Eazzy Loan, Co-op MCo-opCash
   • Fuliza: Any "Fuliza" entries = M-Pesa overdraft borrowing – HIGH CONCERN
   • SACCOs/MFIs: KWFT, Faulu, Vision Fund, Jitegemea, Unaitas
   • Generic: any description containing "loan repay", "instalment", "lipa loan", "kulipa mkopo"
   • Bank debits with consistent monthly timing (same amount, same recipient) may indicate loan EFT

2. SECOND HOUSEHOLD / SPLIT INCOME – Warning signs:
   • Same recipient name appearing regularly with significant amounts (possible second family/wife)
   • Regular school fees payments to multiple schools in different towns
   • Rent payments to a location inconsistent with stated address
   • Regular "send money" to same person monthly (over KES 3,000)

3. GAMBLING – Look for:
   • SportPesa, Betway Kenya, Odibets, Mozzart, Betin, Cheza, Betika, 1XBET
   • Any description with "BET", "JACKPOT", "STAKE"
   • Note: small occasional bets < KES 200 total/month = LOW risk; regular large bets = HIGH risk

4. ALCOHOL / SUBSTANCE PATTERNS:
   • Frequent transactions at bars/liquor stores (descriptions: "bar", "wines", "spirits")
   • Late-night withdrawals (after 22:00) occurring frequently

5. FULIZA USAGE (M-Pesa overdraft):
   • Count all "Fuliza" transactions (borrowing from M-Pesa overdraft)
   • High Fuliza usage means person is frequently cash-short

6. INCOME VERIFICATION:
   • What is the actual average monthly inflow from the M-Pesa data?
   • Does it match the stated income? Flag if actual is < 60% of stated

7. POSITIVE INDICATORS:
   • Regular salary/pay credits (consistent amounts monthly)
   • Regular SACCO savings contributions
   • School fees payments (shows responsible family planning)
   • Business payment receipts (Lipa na M-Pesa)
   • Consistent balance maintained

Respond ONLY with a valid JSON object in exactly this structure (no text outside JSON):

{
  "overallRiskLevel": "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH",
  "recommendedAction": "PROCEED" | "ADDITIONAL_INFO" | "CAUTION" | "DECLINE",
  "riskSummary": "<2-4 sentence plain English summary for the loan officer. Mention the most important findings.>",
  "periodCovered": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "months": <integer> },
  "incomeAnalysis": {
    "avgMonthlyInflow": <number>,
    "avgMonthlyOutflow": <number>,
    "statedIncomeComparison": "CONSISTENT" | "LOWER_THAN_STATED" | "HIGHER_THAN_STATED" | "UNKNOWN",
    "notes": "<brief note>"
  },
  "detectedLoans": [
    { "lender": "<name>", "estimatedMonthlyPayment": <number>, "occurrences": <integer>, "lastDate": "YYYY-MM-DD", "concern": "<brief note>" }
  ],
  "suspiciousPatterns": [
    { "type": "SECOND_HOUSEHOLD" | "GAMBLING" | "ALCOHOL" | "CASH_INTENSIVE" | "INCOME_INSTABILITY" | "OTHER", "description": "<string>", "severity": "LOW" | "MEDIUM" | "HIGH", "evidence": "<specific transactions or pattern>", "estimatedMonthly": <number or null> }
  ],
  "gamblingTransactions": [
    { "platform": "<name>", "totalAmount": <number>, "frequency": "<e.g. 2-3 times/week>", "months": <integer> }
  ],
  "fulizaUsage": { "count": <integer>, "totalBorrowed": <number>, "concern": "<string>" } | null,
  "positiveIndicators": ["<string>", ...]
}

Rules:
- Set overallRiskLevel to VERY_HIGH if total hidden loan payments exceed 30% of income, or if gambling > KES 5,000/month, or if second household strongly evidenced
- Set overallRiskLevel to HIGH if hidden loans are detected, gambling present, or Fuliza used > 5 times/month
- Set overallRiskLevel to MEDIUM if there are patterns worth discussing but no hard evidence
- Set overallRiskLevel to LOW if the statement looks clean and income is consistent
- recommendedAction DECLINE is only for VERY_HIGH risk with multiple serious indicators
- Be specific: cite actual transaction descriptions and dates where possible
- If the statement appears to be very short (< 20 transactions) or unreadable, note this in riskSummary and set recommendedAction to ADDITIONAL_INFO`;

// ─── Monitor Tab ──────────────────────────────────────────────────────────────

interface MonitorResponse {
  data:           MpesaStatement[];
  pagination:     { page: number; limit: number; total: number; pages: number };
  riskBreakdown:  Record<string, number>;
}

function MonitorTab() {
  const [page,      setPage]      = useState(1);
  const [riskLevel, setRiskLevel] = useState('');
  const [status,    setStatus]    = useState('');

  const { data, isLoading, refetch } = useQuery<MonitorResponse>({
    queryKey: ['admin', 'mpesaAnalyses', page, riskLevel, status],
    queryFn: () => adminApi.listMpesaAnalyses({
      page,
      limit: 30,
      ...(riskLevel ? { riskLevel } : {}),
      ...(status    ? { status }    : {}),
    }),
    staleTime: 30_000,
  });

  const stmts = data?.data ?? [];
  const pg    = data?.pagination;
  const rb    = data?.riskBreakdown ?? {};
  const total = pg?.total ?? 0;

  const RISK_LEVELS  = ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
  const STATUSES     = ['PENDING', 'PROCESSING', 'COMPLETE', 'FAILED'];

  return (
    <div className="space-y-6">

      {/* Risk breakdown cards */}
      {Object.keys(rb).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {RISK_LEVELS.map(rl => (
            <button
              key={rl}
              type="button"
              onClick={() => { setRiskLevel(riskLevel === rl ? '' : rl); setPage(1); }}
              className={clsx(
                'rounded-lg p-3 text-center transition-all border',
                riskLevel === rl ? 'ring-2 ring-primary-500' : '',
                rl === 'LOW'       ? 'bg-green-50 border-green-200' :
                rl === 'MEDIUM'    ? 'bg-yellow-50 border-yellow-200' :
                rl === 'HIGH'      ? 'bg-orange-50 border-orange-200' :
                                     'bg-red-50 border-red-200',
              )}
            >
              <p className="text-2xl font-bold">{rb[rl] ?? 0}</p>
              <p className="text-xs font-medium mt-0.5">{rl.replace('_', ' ')}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filters + refresh */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={riskLevel}
          onChange={e => { setRiskLevel(e.target.value); setPage(1); }}
          className="input-field text-sm py-1.5 w-40"
        >
          <option value="">All Risk Levels</option>
          {RISK_LEVELS.map(rl => <option key={rl} value={rl}>{rl.replace('_', ' ')}</option>)}
        </select>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="input-field text-sm py-1.5 w-40"
        >
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="button" onClick={() => refetch()} className="btn-secondary text-sm py-1.5">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
        <span className="text-sm text-gray-500 ml-auto">{total} statement{total !== 1 ? 's' : ''} total</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>
      ) : stmts.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No statements found.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Customer</th>
                <th className="text-left px-4 py-3 font-medium">Branch</th>
                <th className="text-left px-4 py-3 font-medium">File</th>
                <th className="text-left px-4 py-3 font-medium">Period</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Risk</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
                <th className="text-right px-4 py-3 font-medium">Inflow/mo</th>
                <th className="text-left px-4 py-3 font-medium">LO</th>
                <th className="text-left px-4 py-3 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stmts.map(stmt => (
                <tr key={stmt.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {stmt.customer ? (
                      <a
                        href={`/customers/${stmt.customer.id}`}
                        className="font-medium text-primary-700 hover:underline"
                      >
                        {stmt.customer.firstName} {stmt.customer.lastName}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{stmt.customer?.branch?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate" title={stmt.fileName}>{stmt.fileName}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {stmt.periodStart && stmt.periodEnd
                      ? `${fmtDate(stmt.periodStart)} – ${fmtDate(stmt.periodEnd)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="flex items-center justify-center gap-1">
                      {STATUS_ICON[stmt.analysisStatus]}
                      <span className="text-xs">{stmt.analysisStatus}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {stmt.overallRiskLevel ? (
                      <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', RISK_COLOUR[stmt.overallRiskLevel])}>
                        {stmt.overallRiskLevel.replace('_', ' ')}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {stmt.recommendedAction ? (
                      <span className={clsx('text-xs px-2 py-0.5 rounded', ACTION_COLOUR[stmt.recommendedAction])}>
                        {stmt.recommendedAction.replace('_', ' ')}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 text-xs">{fmt(stmt.avgMonthlyInflow)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {stmt.uploadedBy ? `${stmt.uploadedBy.firstName} ${stmt.uploadedBy.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(stmt.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pg && pg.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500">
            Page {pg.page} of {pg.pages} ({total} total)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="btn-secondary py-1.5 px-3 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={page >= pg.pages}
              onClick={() => setPage(p => Math.min(pg.pages, p + 1))}
              className="btn-secondary py-1.5 px-3 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Config Tab ───────────────────────────────────────────────────────────────

function ConfigTab() {
  const queryClient = useQueryClient();
  const [promptText, setPromptText] = useState<string | null>(null);
  const [saved,    setSaved]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const CONFIG_KEY = 'mpesa_analysis_prompt';

  const { data: config, isLoading } = useQuery<SystemConfig | null>({
    queryKey: ['admin', 'config', CONFIG_KEY],
    queryFn:  () => adminApi.getConfig(CONFIG_KEY),
  });

  // Populate editor on first successful load
  useEffect(() => {
    if (!isLoading && promptText === null) {
      const cfg = config as SystemConfig | null | undefined;
      setPromptText(cfg?.value ?? DEFAULT_PROMPT);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const saveMutation = useMutation({
    mutationFn: (value: string) =>
      adminApi.updateConfig(CONFIG_KEY, value, 'Custom M-Pesa AI analysis prompt'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'config', CONFIG_KEY] });
      setSaved(true);
      setSaveError(null);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => setSaveError(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminApi.deleteConfig(CONFIG_KEY),
    onSuccess: () => {
      setPromptText(DEFAULT_PROMPT);
      queryClient.invalidateQueries({ queryKey: ['admin', 'config', CONFIG_KEY] });
      setSaved(true);
      setSaveError(null);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => setSaveError(getErrorMessage(err)),
  });

  const cfgTyped    = config as SystemConfig | null | undefined;
  const isCustom    = cfgTyped !== null && cfgTyped !== undefined;
  const isModified  = promptText !== (cfgTyped?.value ?? DEFAULT_PROMPT);
  const isMutating  = saveMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">AI Analysis Prompt</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            This is the system prompt sent to Claude when analysing M-Pesa statements.
            Edit to add new lenders, adjust risk rules, or refine instructions.
            Changes take effect immediately for all new analyses.
          </p>
          {isCustom && (
            <p className="text-xs text-blue-700 mt-1">
              Currently using a <strong>custom prompt</strong>
              {cfgTyped?.updatedBy && ` (last saved by ${cfgTyped.updatedBy.firstName} ${cfgTyped.updatedBy.lastName})`}
              {cfgTyped?.updatedAt && ` on ${fmtDate(cfgTyped.updatedAt)}`}.
            </p>
          )}
          {!isCustom && (
            <p className="text-xs text-gray-500 mt-1">Currently using the <strong>built-in default prompt</strong>.</p>
          )}
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {isCustom && (
            <button
              type="button"
              disabled={isMutating}
              onClick={() => {
                if (window.confirm('Reset to the built-in default prompt? The custom prompt will be deleted.')) {
                  deleteMutation.mutate();
                }
              }}
              className="btn-secondary text-sm text-orange-700 border-orange-300 hover:bg-orange-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Default
            </button>
          )}
          <button
            type="button"
            disabled={isMutating || !isModified || !promptText}
            onClick={() => promptText && saveMutation.mutate(promptText)}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {isMutating
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <Save className="h-4 w-4" />
            }
            {isMutating ? 'Saving…' : 'Save Prompt'}
          </button>
        </div>
      </div>

      {saved && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Prompt saved successfully. All future analyses will use the updated prompt.
        </div>
      )}
      {saveError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {/* Tips */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 space-y-1">
        <p className="font-medium">Editing tips:</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li>Add new lenders under section 1 (e.g. "Pesa Pap", "Okoa Jahazi")</li>
          <li>Add new gambling platforms under section 3</li>
          <li>Adjust the threshold rules at the bottom (the "Rules:" section)</li>
          <li>The transaction data will always be appended automatically — do not add it to the prompt</li>
          <li>The prompt must end with the JSON structure definition; changing the JSON keys will break parsing</li>
          <li>Use "Reset to Default" to undo all custom changes</li>
        </ul>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400 text-center py-8">Loading…</div>
      ) : (
        <textarea
          value={promptText ?? ''}
          onChange={e => setPromptText(e.target.value)}
          rows={40}
          className="w-full font-mono text-xs border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
          spellCheck={false}
        />
      )}

      {isModified && (
        <p className="text-xs text-orange-600 flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          You have unsaved changes. Click "Save Prompt" to apply them.
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MpesaMonitor() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'config'>('monitor');

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Smartphone className="h-6 w-6 text-green-600" />
          M-Pesa Analysis Monitor
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor all customer M-Pesa statement analyses and tune the AI algorithm.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {([
            { id: 'monitor', label: 'Analysis Monitor', icon: BarChart3 },
            { id: 'config',  label: 'AI Algorithm Config', icon: Settings },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={clsx(
                'flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === id
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="card p-6">
        {activeTab === 'monitor' ? <MonitorTab /> : <ConfigTab />}
      </div>
    </div>
  );
}
