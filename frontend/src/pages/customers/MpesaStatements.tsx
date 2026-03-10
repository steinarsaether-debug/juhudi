/**
 * MpesaStatements – upload and view M-Pesa statement analyses for a customer.
 * Displayed as a collapsible section inside CustomerProfile.
 *
 * LO uploads a PDF or CSV statement.  The backend parses it and queues an
 * AI analysis that runs asynchronously.  The LO can poll / refresh to see results.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload, RefreshCw, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle, Clock, XCircle,
  TrendingUp, TrendingDown, Smartphone,
  DollarSign, AlertCircle, ShieldCheck,
} from 'lucide-react';
import clsx from 'clsx';
import { mpesaApi, getErrorMessage } from '../../services/api';
import type { MpesaStatement, MpesaDetectedLoan, MpesaSuspiciousPattern, MpesaGamblingTx } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null) {
  if (n == null) return '—';
  return `KES ${Math.round(n).toLocaleString()}`;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const RISK_COLOUR: Record<string, string> = {
  LOW:       'bg-green-100 text-green-800',
  MEDIUM:    'bg-yellow-100 text-yellow-800',
  HIGH:      'bg-orange-100 text-orange-800',
  VERY_HIGH: 'bg-red-100 text-red-800',
};

const ACTION_COLOUR: Record<string, string> = {
  PROCEED:          'text-green-700',
  ADDITIONAL_INFO:  'text-yellow-700',
  CAUTION:          'text-orange-700',
  DECLINE:          'text-red-700',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING:    <Clock      className="h-4 w-4 text-gray-400" />,
  PROCESSING: <RefreshCw  className="h-4 w-4 text-blue-500 animate-spin" />,
  COMPLETE:   <CheckCircle className="h-4 w-4 text-green-500" />,
  FAILED:     <XCircle    className="h-4 w-4 text-red-500" />,
};

// ─── Statement card ───────────────────────────────────────────────────────────

function StatementCard({
  stmt,
  customerId,
  onRetry,
}: {
  stmt:       MpesaStatement;
  customerId: string;
  onRetry:    (statementId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  // Poll while PENDING or PROCESSING
  const { data: polledData } = useQuery<MpesaStatement>({
    queryKey: ['mpesaStmt', customerId, stmt.id],
    queryFn:  () => mpesaApi.get(customerId, stmt.id),
    enabled:  stmt.analysisStatus === 'PENDING' || stmt.analysisStatus === 'PROCESSING',
    refetchInterval: 5_000,
  });
  // Refresh the statement list whenever the polled status changes to COMPLETE/FAILED
  useEffect(() => {
    if (polledData?.analysisStatus === 'COMPLETE' || polledData?.analysisStatus === 'FAILED') {
      queryClient.invalidateQueries({ queryKey: ['mpesaStatements', customerId] });
    }
  }, [polledData?.analysisStatus, customerId, queryClient]);

  const isComplete = stmt.analysisStatus === 'COMPLETE';

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        onClick={() => isComplete && setExpanded(e => !e)}
      >
        <div className="flex-shrink-0">{STATUS_ICON[stmt.analysisStatus]}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900 truncate">{stmt.fileName}</span>
            <span className="text-xs text-gray-500">{fmtSize(stmt.sizeBytes)}</span>
            {stmt.transactionCount > 0 && (
              <span className="text-xs text-gray-500">{stmt.transactionCount} txns</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
            <span>Uploaded {fmtDate(stmt.createdAt)}</span>
            {stmt.periodStart && stmt.periodEnd && (
              <span>{fmtDate(stmt.periodStart)} – {fmtDate(stmt.periodEnd)}</span>
            )}
            {stmt.uploadedBy && (
              <span>by {stmt.uploadedBy.firstName} {stmt.uploadedBy.lastName}</span>
            )}
          </div>
        </div>

        {/* Risk badge */}
        {isComplete && stmt.overallRiskLevel && (
          <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', RISK_COLOUR[stmt.overallRiskLevel])}>
            {stmt.overallRiskLevel.replace('_', ' ')}
          </span>
        )}
        {isComplete && stmt.recommendedAction && (
          <span className={clsx('text-xs font-medium hidden sm:block', ACTION_COLOUR[stmt.recommendedAction])}>
            {stmt.recommendedAction.replace('_', ' ')}
          </span>
        )}

        {/* Retry button */}
        {stmt.analysisStatus === 'FAILED' && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRetry(stmt.id); }}
            className="text-xs text-blue-600 hover:underline flex-shrink-0"
          >
            Retry
          </button>
        )}

        {isComplete && (
          expanded
            ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
            : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {/* Status message for non-complete */}
      {!isComplete && (
        <div className="px-4 py-3 text-sm text-gray-600 bg-white">
          {stmt.analysisStatus === 'PENDING'    && 'Analysis queued — will start shortly…'}
          {stmt.analysisStatus === 'PROCESSING' && 'AI analysis in progress — this may take 30–60 seconds…'}
          {stmt.analysisStatus === 'FAILED'     && (
            <span className="text-red-600">Analysis failed: {stmt.analysisError ?? 'Unknown error'}</span>
          )}
        </div>
      )}

      {/* Expanded analysis results */}
      {isComplete && expanded && (
        <div className="px-4 py-4 bg-white border-t border-gray-100 space-y-5">

          {/* Risk summary */}
          {stmt.riskSummary && (
            <div className={clsx(
              'rounded-lg p-3 text-sm',
              stmt.overallRiskLevel === 'LOW'       ? 'bg-green-50 text-green-800 border border-green-200' :
              stmt.overallRiskLevel === 'MEDIUM'    ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' :
              stmt.overallRiskLevel === 'HIGH'      ? 'bg-orange-50 text-orange-800 border border-orange-200' :
                                                      'bg-red-50 text-red-800 border border-red-200'
            )}>
              <p className="font-medium mb-1">AI Risk Summary</p>
              <p>{stmt.riskSummary}</p>
            </div>
          )}

          {/* Cash flow metrics */}
          {(stmt.avgMonthlyInflow != null || stmt.avgMonthlyOutflow != null) && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cash Flow (Monthly Average)</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <TrendingUp className="h-4 w-4 text-green-600 mx-auto mb-1" />
                  <p className="text-xs text-green-700">Inflow</p>
                  <p className="font-semibold text-green-800">{fmt(stmt.avgMonthlyInflow)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <TrendingDown className="h-4 w-4 text-red-600 mx-auto mb-1" />
                  <p className="text-xs text-red-700">Outflow</p>
                  <p className="font-semibold text-red-800">{fmt(stmt.avgMonthlyOutflow)}</p>
                </div>
                <div className={clsx('rounded-lg p-3 text-center', (stmt.avgMonthlyNet ?? 0) >= 0 ? 'bg-blue-50' : 'bg-orange-50')}>
                  <DollarSign className={clsx('h-4 w-4 mx-auto mb-1', (stmt.avgMonthlyNet ?? 0) >= 0 ? 'text-blue-600' : 'text-orange-600')} />
                  <p className={clsx('text-xs', (stmt.avgMonthlyNet ?? 0) >= 0 ? 'text-blue-700' : 'text-orange-700')}>Net</p>
                  <p className={clsx('font-semibold', (stmt.avgMonthlyNet ?? 0) >= 0 ? 'text-blue-800' : 'text-orange-800')}>{fmt(stmt.avgMonthlyNet)}</p>
                </div>
              </div>
              {(stmt.fulizaUsageCount ?? 0) > 0 && (
                <p className="mt-2 text-xs text-orange-700 bg-orange-50 rounded px-2 py-1">
                  <AlertCircle className="h-3.5 w-3.5 inline mr-1" />
                  Fuliza (M-Pesa overdraft) used {stmt.fulizaUsageCount} time{stmt.fulizaUsageCount !== 1 ? 's' : ''} in this period — indicates cash shortfall
                </p>
              )}
            </div>
          )}

          {/* Detected loans */}
          {(stmt.detectedLoans as MpesaDetectedLoan[] | undefined)?.length ? (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                Detected Loan Repayments ({(stmt.detectedLoans as MpesaDetectedLoan[]).length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-orange-50 text-orange-700">
                      <th className="text-left px-2 py-1 font-medium">Lender</th>
                      <th className="text-right px-2 py-1 font-medium">Est. Monthly</th>
                      <th className="text-right px-2 py-1 font-medium">Occurrences</th>
                      <th className="text-left px-2 py-1 font-medium">Last Payment</th>
                      <th className="text-left px-2 py-1 font-medium">Concern</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(stmt.detectedLoans as MpesaDetectedLoan[]).map((loan, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 font-medium text-gray-900">{loan.lender}</td>
                        <td className="px-2 py-1.5 text-right text-orange-700">{fmt(loan.estimatedMonthlyPayment)}</td>
                        <td className="px-2 py-1.5 text-right">{loan.occurrences}×</td>
                        <td className="px-2 py-1.5 text-gray-600">{fmtDate(loan.lastDate)}</td>
                        <td className="px-2 py-1.5 text-gray-600">{loan.concern}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Suspicious patterns */}
          {(stmt.suspiciousPatterns as MpesaSuspiciousPattern[] | undefined)?.length ? (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                Suspicious Patterns ({(stmt.suspiciousPatterns as MpesaSuspiciousPattern[]).length})
              </h4>
              <div className="space-y-2">
                {(stmt.suspiciousPatterns as MpesaSuspiciousPattern[]).map((p, i) => (
                  <div key={i} className={clsx(
                    'rounded-lg px-3 py-2 text-xs',
                    p.severity === 'HIGH'   ? 'bg-red-50 border border-red-200' :
                    p.severity === 'MEDIUM' ? 'bg-orange-50 border border-orange-200' :
                                              'bg-yellow-50 border border-yellow-200'
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold">{p.type.replace(/_/g, ' ')}</span>
                        {p.estimatedMonthly != null && (
                          <span className="ml-2 text-gray-600">~{fmt(p.estimatedMonthly)}/mo</span>
                        )}
                        <p className="mt-0.5 text-gray-700">{p.description}</p>
                        {p.evidence && <p className="mt-0.5 text-gray-500 italic">Evidence: {p.evidence}</p>}
                      </div>
                      <span className={clsx(
                        'px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0',
                        p.severity === 'HIGH'   ? 'bg-red-200 text-red-800' :
                        p.severity === 'MEDIUM' ? 'bg-orange-200 text-orange-800' :
                                                  'bg-yellow-200 text-yellow-800'
                      )}>{p.severity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Gambling */}
          {(stmt.gamblingTransactions as MpesaGamblingTx[] | undefined)?.length ? (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Gambling Transactions
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-red-50 text-red-700">
                      <th className="text-left px-2 py-1 font-medium">Platform</th>
                      <th className="text-right px-2 py-1 font-medium">Total Spent</th>
                      <th className="text-left px-2 py-1 font-medium">Frequency</th>
                      <th className="text-right px-2 py-1 font-medium">Months Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(stmt.gamblingTransactions as MpesaGamblingTx[]).map((g, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 font-medium text-gray-900">{g.platform}</td>
                        <td className="px-2 py-1.5 text-right text-red-700">{fmt(g.totalAmount)}</td>
                        <td className="px-2 py-1.5">{g.frequency}</td>
                        <td className="px-2 py-1.5 text-right">{g.months}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Positive indicators */}
          {(stmt.positiveIndicators as string[] | undefined)?.length ? (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                Positive Indicators
              </h4>
              <ul className="space-y-1">
                {(stmt.positiveIndicators as string[]).map((pi, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-green-700">
                    <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    {pi}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  customerId: string;
}

export default function MpesaStatements({ customerId }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient  = useQueryClient();

  const { data: statements, isLoading } = useQuery<MpesaStatement[]>({
    queryKey: ['mpesaStatements', customerId],
    queryFn:  () => mpesaApi.list(customerId),
    refetchInterval: (query) => {
      // Auto-poll while any statement is in progress
      const d = (query.state.data ?? []) as MpesaStatement[];
      const inProgress = d.some(
        s => s.analysisStatus === 'PENDING' || s.analysisStatus === 'PROCESSING',
      );
      return inProgress ? 6_000 : false;
    },
  });

  const retryMutation = useMutation({
    mutationFn: (statementId: string) => mpesaApi.retry(customerId, statementId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['mpesaStatements', customerId] }),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'csv') {
      setUploadError('Only PDF or CSV files are supported');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File is too large (max 10 MB)');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      await mpesaApi.upload(customerId, file);
      queryClient.invalidateQueries({ queryKey: ['mpesaStatements', customerId] });
    } catch (err) {
      setUploadError(getErrorMessage(err));
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-uploaded after a fix
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const stmtList = statements ?? [];
  const inProgress = stmtList.filter(s => s.analysisStatus === 'PENDING' || s.analysisStatus === 'PROCESSING').length;
  const complete   = stmtList.filter(s => s.analysisStatus === 'COMPLETE').length;
  const highRisk   = stmtList.filter(s => s.overallRiskLevel === 'HIGH' || s.overallRiskLevel === 'VERY_HIGH').length;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-green-600" />
          <h3 className="text-base font-semibold text-gray-900">M-Pesa Statement Analysis</h3>
          {stmtList.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
              {stmtList.length} uploaded
            </span>
          )}
          {highRisk > 0 && (
            <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-medium">
              {highRisk} high-risk
            </span>
          )}
          {inProgress > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 animate-pulse">
              {inProgress} analysing…
            </span>
          )}
        </div>

        {/* Upload button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            {uploading
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <Upload className="h-4 w-4" />
            }
            {uploading ? 'Uploading…' : 'Upload Statement'}
          </button>
        </div>
      </div>

      {/* Info text */}
      <p className="text-xs text-gray-500">
        Upload 2–3 months of M-Pesa statements (PDF or CSV export from M-Pesa app) to detect
        hidden loan repayments, gambling habits, second-household patterns, and verify stated income.
      </p>

      {/* Upload error */}
      {uploadError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {uploadError}
        </div>
      )}

      {/* Statement list */}
      {isLoading ? (
        <div className="text-sm text-gray-400 py-4 text-center">Loading statements…</div>
      ) : stmtList.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-8 text-center">
          <Smartphone className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No M-Pesa statements uploaded yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Upload a PDF or CSV from the M-Pesa app → Statements menu.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {stmtList.map(stmt => (
            <StatementCard
              key={stmt.id}
              stmt={stmt}
              customerId={customerId}
              onRetry={statementId => retryMutation.mutate(statementId)}
            />
          ))}
        </div>
      )}

      {complete > 0 && (
        <p className="text-xs text-gray-400">
          Click an analysed statement to expand the full risk report.
        </p>
      )}
    </div>
  );
}
