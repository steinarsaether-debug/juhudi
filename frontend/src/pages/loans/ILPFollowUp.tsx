import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle, Clock, AlertTriangle, Phone, MapPin, FileText,
  ChevronLeft, X, Flag, AlertCircle,
} from 'lucide-react';
import { ilpApi, kpiApi } from '../../services/api';
import { ILPFollowUp as IFollowUp, CustomerRiskFlag } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import RiskFlagList from '../../components/common/RiskFlagList';

const VISIT_ICONS: Record<string, React.ReactNode> = {
  PHONE_CALL:      <Phone    className="h-4 w-4" />,
  FIELD_VISIT:     <MapPin   className="h-4 w-4" />,
  DOCUMENT_REVIEW: <FileText className="h-4 w-4" />,
  KPI_CHECK:       <Flag     className="h-4 w-4" />,
};

const RISK_FLAG_OPTIONS = [
  'Unable to contact', 'Business not operating', 'Funds diverted',
  'Signs of distress', 'Overdue repayment', 'Collateral at risk',
  'Market downturn', 'Family crisis',
];

function FollowUpCard({
  fu, onComplete,
}: {
  fu: IFollowUp;
  onComplete: (id: string, notes: string, flags: string[]) => void;
}) {
  const [open,  setOpen]  = useState(false);
  const [notes, setNotes] = useState(fu.visitType === 'KPI_CHECK' && fu.visitNotes ? fu.visitNotes : '');
  const [flags, setFlags] = useState<string[]>([]);

  const scheduled = new Date(fu.scheduledDate);
  const now       = new Date();
  const isOverdue = !fu.isCompleted && scheduled < now;
  const isKPI     = fu.visitType === 'KPI_CHECK';
  const riskSev   = fu.riskFlag?.severity;

  const toggleFlag = (f: string) =>
    setFlags(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const borderColor = fu.isCompleted
    ? 'border-green-200 bg-green-50'
    : isOverdue
    ? 'border-red-300 bg-red-50'
    : isKPI && riskSev === 'RED'
    ? 'border-red-200 bg-red-50'
    : isKPI && riskSev === 'YELLOW'
    ? 'border-amber-200 bg-amber-50'
    : 'border-gray-200 bg-white';

  const iconBg = fu.isCompleted
    ? 'bg-green-100 text-green-600'
    : isOverdue
    ? 'bg-red-100 text-red-600'
    : isKPI
    ? riskSev === 'RED' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
    : 'bg-blue-50 text-blue-600';

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${borderColor}`}>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 p-2 rounded-lg flex-shrink-0 ${iconBg}`}>
              {VISIT_ICONS[fu.visitType] ?? <Clock className="h-4 w-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-gray-900">{fu.milestone}</p>
                {isKPI && riskSev && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    riskSev === 'RED'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {riskSev === 'RED' ? '🔴 Critical' : '🟡 Warning'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {fu.visitType.replace(/_/g, ' ')} ·{' '}
                {scheduled.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              {fu.isCompleted && (
                <p className="text-xs text-green-600 mt-1">
                  Completed {new Date(fu.completedAt!).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                  {fu.completedBy && ` by ${fu.completedBy.firstName} ${fu.completedBy.lastName}`}
                </p>
              )}
              {isOverdue && (
                <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Overdue by {Math.floor((now.getTime() - scheduled.getTime()) / 86400000)} days
                </p>
              )}
              {isKPI && fu.riskFlag && !fu.isCompleted && (
                <p className={`text-xs mt-1 ${riskSev === 'RED' ? 'text-red-600' : 'text-amber-600'}`}>
                  Flag: {fu.riskFlag.title}
                  {!fu.riskFlag.isActive && ' (resolved)'}
                </p>
              )}
            </div>
          </div>

          {fu.isCompleted ? (
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-primary-700 text-white text-xs font-medium hover:bg-primary-800 transition-colors"
            >
              Mark Complete
            </button>
          )}
        </div>

        {/* Completed visit notes */}
        {fu.isCompleted && fu.visitNotes && (
          <div className="mt-3 text-xs text-gray-600 bg-white border border-green-100 rounded-lg p-3 whitespace-pre-line">
            {fu.visitNotes}
          </div>
        )}
        {fu.isCompleted && fu.riskFlags?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {fu.riskFlags.map(f => (
              <span key={f} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">{f}</span>
            ))}
          </div>
        )}

        {/* KPI pre-filled questions (before completion) */}
        {isKPI && !fu.isCompleted && fu.visitNotes && (
          <div className="mt-3 text-xs text-gray-600 bg-white border border-amber-100 rounded-lg p-3 whitespace-pre-line">
            {fu.visitNotes}
          </div>
        )}
      </div>

      {/* Mark complete panel */}
      {open && (
        <div className="border-t border-gray-200 bg-gray-50 px-5 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-800">Complete Follow-up</h4>
            <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Visit Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder={isKPI
                ? 'Record customer responses to the questions above…'
                : 'What did you observe? Key findings, customer feedback…'}
            />
          </div>

          {!isKPI && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Risk Flags (select all that apply)</label>
              <div className="flex flex-wrap gap-2">
                {RISK_FLAG_OPTIONS.map(f => (
                  <button key={f} type="button"
                    onClick={() => toggleFlag(f)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      flags.includes(f)
                        ? 'bg-amber-100 border-amber-400 text-amber-800'
                        : 'bg-white border-gray-300 text-gray-600 hover:border-amber-400'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => { onComplete(fu.id, notes, flags); setOpen(false); }}
            className="w-full py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            <CheckCircle className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Confirm Completion
          </button>
        </div>
      )}
    </div>
  );
}

export default function ILPFollowUpPage() {
  const { id: loanId } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: followUps = [], isLoading } = useQuery<IFollowUp[]>({
    queryKey: ['ilpFollowUps', loanId],
    queryFn:  () => ilpApi.getFollowUps(loanId!),
    enabled:  !!loanId,
  });

  const { data: riskFlags = [] } = useQuery<CustomerRiskFlag[]>({
    queryKey: ['riskFlags', loanId],
    queryFn:  () => kpiApi.getRiskFlags(loanId!),
    enabled:  !!loanId,
    staleTime: 30_000,
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, notes, flags }: { id: string; notes: string; flags: string[] }) =>
      ilpApi.completeFollowUp(id, { visitNotes: notes, riskFlags: flags }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ilpFollowUps', loanId] });
      qc.invalidateQueries({ queryKey: ['riskFlags', loanId] });
    },
  });

  if (isLoading) return <LoadingSpinner />;

  const overdue   = followUps.filter(f => !f.isCompleted && new Date(f.scheduledDate) < new Date());
  const upcoming  = followUps.filter(f => !f.isCompleted && new Date(f.scheduledDate) >= new Date());
  const completed = followUps.filter(f => f.isCompleted);

  const activeFlags  = riskFlags.filter(f => f.isActive);
  const kpiTasks     = [...overdue, ...upcoming].filter(f => f.visitType === 'KPI_CHECK');
  const redCount     = activeFlags.filter(f => f.severity === 'RED').length;
  const yellowCount  = activeFlags.filter(f => f.severity === 'YELLOW').length;

  const handleComplete = (id: string, notes: string, flags: string[]) => {
    completeMutation.mutate({ id, notes, flags });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to={`/loans/${loanId}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ChevronLeft className="h-4 w-4" /> Back to Loan
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">ILP Follow-Up Schedule</h1>
        <p className="text-sm text-gray-500 mt-1">
          {completed.length} of {followUps.length} visits completed
          {kpiTasks.length > 0 && ` · ${kpiTasks.length} KPI check${kpiTasks.length !== 1 ? 's' : ''} pending`}
        </p>
      </div>

      {/* KPI risk flag summary banner */}
      {activeFlags.length > 0 && (
        <div className={`mb-6 flex items-start gap-3 rounded-xl border p-4 ${
          redCount > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
        }`}>
          {redCount > 0
            ? <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            : <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />}
          <div>
            <p className={`text-sm font-semibold ${redCount > 0 ? 'text-red-700' : 'text-amber-700'}`}>
              {redCount > 0
                ? `${redCount} critical KPI flag${redCount !== 1 ? 's' : ''} active`
                : `${yellowCount} warning KPI flag${yellowCount !== 1 ? 's' : ''} active`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">KPI check tasks are generated automatically based on active flags</p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{followUps.length > 0 ? Math.round((completed.length / followUps.length) * 100) : 0}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${followUps.length > 0 ? (completed.length / followUps.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Active risk flags panel */}
      {activeFlags.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Flag className="h-4 w-4 text-amber-500" /> Active KPI Flags
          </h2>
          <RiskFlagList
            flags={riskFlags}
            loanId={loanId!}
            onFlagChange={() => qc.invalidateQueries({ queryKey: ['riskFlags', loanId] })}
            showResolved={false}
          />
        </div>
      )}

      {overdue.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Overdue ({overdue.length})
          </h2>
          <div className="space-y-3">
            {overdue.map(f => <FollowUpCard key={f.id} fu={f} onComplete={handleComplete} />)}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Upcoming ({upcoming.length})
          </h2>
          <div className="space-y-3">
            {upcoming.map(f => <FollowUpCard key={f.id} fu={f} onComplete={handleComplete} />)}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-green-600 uppercase tracking-wide mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> Completed ({completed.length})
          </h2>
          <div className="space-y-3">
            {completed.map(f => <FollowUpCard key={f.id} fu={f} onComplete={handleComplete} />)}
          </div>
        </section>
      )}

      {followUps.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No follow-up schedule found for this loan.</p>
        </div>
      )}
    </div>
  );
}
