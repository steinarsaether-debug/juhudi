import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Trophy, XCircle, Plus, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { ilpApi, adminApi, getErrorMessage } from '../../services/api';
import { BranchILPEligibilityResponse, ILPSegment } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const SEGMENTS: ILPSegment[] = ['FARMER', 'LANDLORD', 'SHOP_OWNER'];

const SEGMENT_LABELS: Record<ILPSegment, string> = {
  FARMER:     'Farmer',
  LANDLORD:   'Landlord',
  SHOP_OWNER: 'Shop Owner',
};

const STATUS_CHIP: Record<string, string> = {
  NOT_ELIGIBLE: 'bg-gray-100 text-gray-500 border-gray-200',
  ELIGIBLE:     'bg-blue-100 text-blue-700 border-blue-300',
  MASTERED:     'bg-amber-100 text-amber-700 border-amber-400',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  NOT_ELIGIBLE: <XCircle className="h-3.5 w-3.5" />,
  ELIGIBLE:     <CheckCircle className="h-3.5 w-3.5" />,
  MASTERED:     <Trophy className="h-3.5 w-3.5" />,
};

function MetricBadge({ label, value, threshold, good }: {
  label: string; value: number; threshold: number; good: boolean;
}) {
  const ok = good ? value > threshold : value < threshold;
  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${ok ? 'text-green-600' : 'text-red-500'}`}>
        {value.toFixed(1)}%
      </div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xs ${ok ? 'text-green-500' : 'text-red-400'}`}>
        {good ? `>${threshold}%` : `<${threshold}%`} target
      </div>
    </div>
  );
}

function BranchRow({ branchId, branchName }: { branchId: string; branchName: string }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [grantModal, setGrantModal] = useState(false);
  const [grantSegment, setGrantSegment] = useState<ILPSegment>('FARMER');
  const [grantNotes, setGrantNotes] = useState('');
  const [statusModal, setStatusModal] = useState<{ seg: ILPSegment; action: 'MASTERED' | 'NOT_ELIGIBLE' } | null>(null);
  const [statusNotes, setStatusNotes] = useState('');

  const { data, isLoading, error } = useQuery<BranchILPEligibilityResponse>({
    queryKey: ['ilpEligibility', branchId],
    queryFn: () => ilpApi.getBranchEligibility(branchId),
    enabled: expanded,
  });

  const grantMutation = useMutation({
    mutationFn: () => ilpApi.grantEligibility(branchId, { segment: grantSegment, notes: grantNotes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ilpEligibility', branchId] });
      setGrantModal(false);
      setGrantNotes('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (action: { segment: ILPSegment; status: 'MASTERED' | 'NOT_ELIGIBLE' }) =>
      ilpApi.updateStatus(branchId, { segment: action.segment, status: action.status, notes: statusNotes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ilpEligibility', branchId] });
      setStatusModal(null);
      setStatusNotes('');
    },
  });

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Branch header row */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div>
          <p className="font-semibold text-gray-900">{branchName}</p>
          <p className="text-xs text-gray-400 mt-0.5">{branchId}</p>
        </div>
        <div className="flex items-center gap-2">
          {expanded && data?.eligibilities?.map(e => (
            <span key={e.segment}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_CHIP[e.status]}`}
            >
              {STATUS_ICONS[e.status]}
              {SEGMENT_LABELS[e.segment]}
            </span>
          ))}
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-gray-200 px-5 py-5 bg-gray-50 space-y-5">
          {isLoading && <LoadingSpinner />}
          {error && <p className="text-sm text-red-500">{getErrorMessage(error)}</p>}
          {data && (
            <>
              {/* Metrics */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">Portfolio Health Metrics</h3>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                    data.meetsThreshold ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-600'
                  }`}>
                    {data.meetsThreshold ? '✓ Meets threshold' : '✗ Below threshold'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <MetricBadge label="PAR30" value={data.metrics.par30} threshold={5} good={false} />
                  <MetricBadge label="Retention" value={data.metrics.retention} threshold={70} good={true} />
                  <MetricBadge label="Growth" value={data.metrics.growth} threshold={20} good={true} />
                </div>
              </div>

              {/* Segment chips */}
              <div className="grid grid-cols-3 gap-3">
                {SEGMENTS.map(seg => {
                  const elig = data.eligibilities.find(e => e.segment === seg);
                  const status = elig?.status ?? 'NOT_ELIGIBLE';
                  return (
                    <div key={seg} className={`border rounded-xl p-4 ${STATUS_CHIP[status]}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold">{SEGMENT_LABELS[seg]}</span>
                        {STATUS_ICONS[status]}
                      </div>
                      <p className="text-xs font-medium capitalize">{status.replace('_', ' ')}</p>
                      {elig?.unlockedAt && (
                        <p className="text-xs mt-1 opacity-70">
                          Unlocked {new Date(elig.unlockedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                      {elig?.masteredAt && (
                        <p className="text-xs mt-0.5 opacity-70">
                          Mastered {new Date(elig.masteredAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                      {/* Action buttons */}
                      <div className="mt-3 space-y-1">
                        {status === 'ELIGIBLE' && (
                          <button type="button"
                            onClick={() => { setStatusModal({ seg, action: 'MASTERED' }); setStatusNotes(''); }}
                            className="w-full py-1 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600"
                          >
                            Promote to Mastered
                          </button>
                        )}
                        {status !== 'NOT_ELIGIBLE' && (
                          <button type="button"
                            onClick={() => { setStatusModal({ seg, action: 'NOT_ELIGIBLE' }); setStatusNotes(''); }}
                            className="w-full py-1 rounded-lg border border-red-300 text-red-600 text-xs font-medium hover:bg-red-50"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grant button */}
              {!data.meetsThreshold && (
                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  Branch does not currently meet portfolio thresholds. Grant is still possible at admin discretion.
                </div>
              )}
              <button type="button"
                onClick={() => setGrantModal(true)}
                disabled={data.activeSegmentCount >= 2}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-700 text-white text-sm font-medium hover:bg-primary-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                Grant Segment Eligibility
                {data.activeSegmentCount >= 2 && ' (max 2 reached)'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Grant modal */}
      {grantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Grant ILP Segment Eligibility</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Segment</label>
              <select value={grantSegment} onChange={e => setGrantSegment(e.target.value as ILPSegment)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {SEGMENTS.map(s => <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea value={grantNotes} onChange={e => setGrantNotes(e.target.value)} rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Reason for granting, context…"
              />
            </div>
            {grantMutation.isError && (
              <p className="text-sm text-red-600">{getErrorMessage(grantMutation.error)}</p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setGrantModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
              >Cancel</button>
              <button type="button" onClick={() => grantMutation.mutate()}
                disabled={grantMutation.isPending}
                className="flex-1 py-2.5 rounded-lg bg-primary-700 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-60"
              >
                {grantMutation.isPending ? 'Granting…' : 'Grant Eligibility'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promote / Revoke modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              {statusModal.action === 'MASTERED' ? 'Promote to Mastered' : 'Revoke Eligibility'}
            </h2>
            <p className="text-sm text-gray-600">
              {statusModal.action === 'MASTERED'
                ? `This will mark ${SEGMENT_LABELS[statusModal.seg]} as MASTERED, enabling a second segment to be unlocked.`
                : `This will revoke ${SEGMENT_LABELS[statusModal.seg]} eligibility. The branch will no longer be able to offer ILP ${SEGMENT_LABELS[statusModal.seg]} loans.`
              }
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={statusNotes} onChange={e => setStatusNotes(e.target.value)} rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Reason for this action…"
              />
            </div>
            {updateMutation.isError && (
              <p className="text-sm text-red-600">{getErrorMessage(updateMutation.error)}</p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setStatusModal(null)}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
              >Cancel</button>
              <button type="button"
                onClick={() => updateMutation.mutate({ segment: statusModal.seg, status: statusModal.action })}
                disabled={updateMutation.isPending}
                className={`flex-1 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-60 ${
                  statusModal.action === 'MASTERED' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {updateMutation.isPending ? 'Updating…' : statusModal.action === 'MASTERED' ? 'Promote' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminILPEligibility() {
  const { data: branchesData } = useQuery({
    queryKey: ['adminBranches'],
    queryFn: () => adminApi.listBranches(),
  });

  const branches: { id: string; name: string }[] = branchesData?.data ?? branchesData ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">ILP Branch Eligibility</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Manage which branches can offer Individual Loan Products and for which verticals.
          Branches must meet portfolio health thresholds (PAR30 &lt; 5%, retention &gt; 70%, growth &gt; 20%).
        </p>
      </div>

      {/* Threshold legend */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'PAR30', desc: 'Portfolio at Risk (30+ days)', target: '< 5%', good: false },
          { label: 'Retention', desc: 'Repeat borrowers (≥2 loans)', target: '> 70%', good: true },
          { label: 'Portfolio Growth', desc: 'vs 6 months ago', target: '> 20%', good: true },
        ].map(m => (
          <div key={m.label} className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-base font-bold text-primary-700">{m.target}</div>
            <div className="text-sm font-medium text-gray-800 mt-0.5">{m.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{m.desc}</div>
          </div>
        ))}
      </div>

      {/* Branch list */}
      <div className="space-y-3">
        {branches.length === 0 && (
          <p className="text-center text-gray-400 py-12 text-sm">No branches found.</p>
        )}
        {branches.map((b: { id: string; name: string }) => (
          <BranchRow key={b.id} branchId={b.id} branchName={b.name} />
        ))}
      </div>
    </div>
  );
}
