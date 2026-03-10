import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList, AlertCircle, AlertTriangle, Clock, Phone, MapPin,
  FileText, CheckCircle, Flag, ChevronDown, ChevronUp, RefreshCw, X,
} from 'lucide-react';
import { kpiApi, ilpApi } from '../../services/api';
import { ILPFollowUp } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

interface WorklistGroup {
  OVERDUE:   ILPFollowUp[];
  TODAY:     ILPFollowUp[];
  THIS_WEEK: ILPFollowUp[];
  UPCOMING:  ILPFollowUp[];
}

interface WorklistResponse {
  total:   number;
  grouped: WorklistGroup;
}

const VISIT_ICONS: Record<string, React.ReactNode> = {
  PHONE_CALL:      <Phone    className="h-4 w-4" />,
  FIELD_VISIT:     <MapPin   className="h-4 w-4" />,
  DOCUMENT_REVIEW: <FileText className="h-4 w-4" />,
  KPI_CHECK:       <Flag     className="h-4 w-4" />,
};

function CompletePanel({
  fu, onClose, onDone,
}: { fu: ILPFollowUp; onClose: () => void; onDone: () => void }) {
  const [notes, setNotes] = useState('');
  const [flags, setFlags] = useState<string[]>([]);
  const qc = useQueryClient();

  const RISK_FLAGS = [
    'Unable to contact', 'Business not operating', 'Funds diverted',
    'Signs of distress', 'Overdue repayment', 'Collateral at risk',
    'Market downturn', 'Family crisis',
  ];

  const toggle = (f: string) =>
    setFlags(p => p.includes(f) ? p.filter(x => x !== f) : [...p, f]);

  const mutation = useMutation({
    mutationFn: () => ilpApi.completeFollowUp(fu.id, { visitNotes: notes, riskFlags: flags }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loWorklist'] });
      onDone();
    },
  });

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-5 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">Complete Follow-up</h4>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
          placeholder="What did you observe? Key findings…"
        />
      </div>
      {fu.visitType !== 'KPI_CHECK' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Risk Flags (select all that apply)</label>
          <div className="flex flex-wrap gap-2">
            {RISK_FLAGS.map(f => (
              <button key={f} type="button" onClick={() => toggle(f)}
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
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        className="w-full py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {mutation.isPending
          ? 'Saving…'
          : <><CheckCircle className="h-4 w-4 inline mr-1.5 -mt-0.5" />Confirm Completion</>}
      </button>
    </div>
  );
}

function WorklistCard({ fu }: { fu: ILPFollowUp }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const due = new Date(fu.scheduledDate);
  const isOverdue = due < now;
  const isKPI = fu.visitType === 'KPI_CHECK';

  const riskSeverity = fu.riskFlag?.severity;
  const borderColor = isOverdue
    ? 'border-red-300 bg-red-50'
    : isKPI && riskSeverity === 'RED'
    ? 'border-red-200 bg-red-50'
    : isKPI && riskSeverity === 'YELLOW'
    ? 'border-amber-200 bg-amber-50'
    : 'border-gray-200 bg-white';

  const iconBg = isOverdue
    ? 'bg-red-100 text-red-600'
    : isKPI
    ? riskSeverity === 'RED' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
    : 'bg-blue-50 text-blue-600';

  return (
    <div className={`border rounded-xl overflow-hidden ${borderColor}`}>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 p-2 rounded-lg flex-shrink-0 ${iconBg}`}>
              {VISIT_ICONS[fu.visitType] ?? <Clock className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              {/* Customer name */}
              {fu.loan?.customer && (
                <Link
                  to={`/customers/${fu.loan.customer.id}`}
                  className="text-xs font-semibold text-primary-700 hover:underline"
                >
                  {fu.loan.customer.firstName} {fu.loan.customer.lastName}
                </Link>
              )}
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{fu.milestone}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">
                  {fu.visitType.replace(/_/g, ' ')} ·{' '}
                  {due.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {fu.loan?.loanNumber && (
                  <Link to={`/loans/${fu.loanId}`} className="text-xs text-primary-600 hover:underline">
                    {fu.loan.loanNumber}
                  </Link>
                )}
                {fu.loan?.ilpCycleNumber && (
                  <span className="text-xs text-gray-400">Cycle {fu.loan.ilpCycleNumber}</span>
                )}
              </div>
              {isOverdue && (
                <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Overdue by {Math.floor((now.getTime() - due.getTime()) / 86400000)} days
                </p>
              )}
              {isKPI && fu.riskFlag && (
                <p className={`text-xs font-medium mt-1 flex items-center gap-1 ${
                  riskSeverity === 'RED' ? 'text-red-600' : 'text-amber-600'
                }`}>
                  <Flag className="h-3 w-3" />
                  {fu.riskFlag.isActive ? 'Active flag' : 'Flag resolved'}: {fu.riskFlag.title}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-700 text-white text-xs font-medium hover:bg-primary-800 transition-colors"
          >
            Mark Complete
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {/* KPI pre-filled notes preview */}
        {isKPI && fu.visitNotes && (
          <div className="mt-3 text-xs text-gray-600 bg-white border border-amber-100 rounded-lg p-3 whitespace-pre-line">
            {fu.visitNotes}
          </div>
        )}
      </div>

      {open && (
        <CompletePanel
          fu={fu}
          onClose={() => setOpen(false)}
          onDone={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function GroupSection({
  label, items, icon, color,
}: { label: string; items: ILPFollowUp[]; icon: React.ReactNode; color: string }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className={`text-sm font-semibold uppercase tracking-wide mb-3 flex items-center gap-2 ${color}`}>
        {icon} {label} ({items.length})
      </h2>
      <div className="space-y-3">
        {items.map(fu => <WorklistCard key={fu.id} fu={fu} />)}
      </div>
    </section>
  );
}

export default function LOWorklist() {
  const { data, isLoading, refetch } = useQuery<WorklistResponse>({
    queryKey: ['loWorklist'],
    queryFn:  () => kpiApi.getLOWorklist(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (isLoading) return <LoadingSpinner />;

  const { grouped, total } = data ?? { grouped: { OVERDUE: [], TODAY: [], THIS_WEEK: [], UPCOMING: [] }, total: 0 };
  const overdue   = grouped.OVERDUE   ?? [];
  const today     = grouped.TODAY     ?? [];
  const thisWeek  = grouped.THIS_WEEK ?? [];
  const upcoming  = grouped.UPCOMING  ?? [];

  const kpiCount = [...overdue, ...today, ...thisWeek, ...upcoming].filter(f => f.visitType === 'KPI_CHECK').length;
  const redCount = [...overdue, ...today, ...thisWeek, ...upcoming].filter(f => f.riskFlag?.severity === 'RED').length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary-600" />
            My Worklist
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} pending task{total !== 1 ? 's' : ''}
            {kpiCount > 0 && ` · ${kpiCount} KPI check${kpiCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border rounded-lg px-3 py-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Alert banner */}
      {redCount > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {redCount} task{redCount !== 1 ? 's' : ''} linked to critical (RED) KPI flags — immediate action required
          </p>
        </div>
      )}

      {total === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">All caught up!</p>
          <p className="text-sm mt-1">No pending follow-up tasks right now.</p>
        </div>
      ) : (
        <>
          <GroupSection
            label="Overdue"
            items={overdue}
            icon={<AlertTriangle className="h-4 w-4" />}
            color="text-red-600"
          />
          <GroupSection
            label="Due Today"
            items={today}
            icon={<Clock className="h-4 w-4" />}
            color="text-orange-600"
          />
          <GroupSection
            label="This Week"
            items={thisWeek}
            icon={<Clock className="h-4 w-4" />}
            color="text-blue-600"
          />
          <GroupSection
            label="Upcoming"
            items={upcoming}
            icon={<Clock className="h-4 w-4" />}
            color="text-gray-500"
          />
        </>
      )}
    </div>
  );
}
