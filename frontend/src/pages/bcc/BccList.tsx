import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Clock, CheckCircle, XCircle, AlertTriangle, MessageSquare, Plus, CalendarDays, Play } from 'lucide-react';
import { bccApi, meetingApi } from '../../services/api';
import { BccSession } from '../../types';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuthStore } from '../../store/authStore';
import { getErrorMessage } from '../../services/api';

const STATUS_TABS = [
  { label: 'Open',     value: 'OPEN' },
  { label: 'Decided',  value: 'DECIDED' },
  { label: 'Override', value: 'OVERRIDDEN' },
  { label: 'All',      value: '' },
];

function OutcomeIcon({ outcome }: { outcome?: string }) {
  if (outcome === 'APPROVED' || outcome === 'CONDITIONAL')
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (outcome === 'REFUSED')
    return <XCircle className="h-4 w-4 text-red-500" />;
  if (outcome === 'REFERRED')
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  return null;
}

function VoteSummary({ votes }: { votes?: Array<{ vote: string }> }) {
  if (!votes?.length) return <span className="text-xs text-gray-400">No votes yet</span>;
  const endorse = votes.filter(v => v.vote === 'ENDORSE').length;
  const refuse  = votes.filter(v => v.vote === 'REFUSE').length;
  const abstain = votes.filter(v => v.vote === 'ABSTAIN').length;
  return (
    <span className="text-xs text-gray-600">
      <span className="text-green-600 font-medium">{endorse}✓</span>{' '}
      <span className="text-red-600 font-medium">{refuse}✗</span>{' '}
      {abstain > 0 && <span className="text-gray-400">{abstain}–</span>}
    </span>
  );
}

// ── New Meeting Modal ─────────────────────────────────────────────────────────

function NewMeetingModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => meetingApi.create({ title: title || undefined, scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bcc-meetings'] }); onClose(); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-blue-600" /> New BCC Meeting
        </h2>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Title (optional)</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Monday Credit – Week 11"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Scheduled date & time (optional)</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm"
          >
            {mutation.isPending ? 'Creating...' : 'Create Meeting'}
          </button>
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Meetings section ──────────────────────────────────────────────────────────

function MeetingsList({ canManage }: { canManage: boolean }) {
  const [showModal, setShowModal] = useState(false);

  const { data: meetings } = useQuery({
    queryKey: ['bcc-meetings'],
    queryFn: () => meetingApi.list(),
    refetchInterval: 30_000,
  });

  const activeMeetings  = (meetings ?? []).filter((m: { status: string }) => m.status === 'ACTIVE');
  const scheduledMeetings = (meetings ?? []).filter((m: { status: string }) => m.status === 'SCHEDULED');

  if ((meetings ?? []).length === 0 && !canManage) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <CalendarDays className="h-4 w-4" /> BCC Meetings
        </h2>
        {canManage && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            <Plus className="h-4 w-4" /> New Meeting
          </button>
        )}
      </div>

      {showModal && <NewMeetingModal onClose={() => setShowModal(false)} />}

      {[...activeMeetings, ...scheduledMeetings].length === 0 ? (
        <p className="text-sm text-gray-400 italic">No upcoming meetings</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...activeMeetings, ...scheduledMeetings].map((m: {
            id: string; title: string | null; status: string; scheduledAt: string | null;
            sessions: Array<{ status: string }>;
            createdBy: { firstName: string; lastName: string };
          }) => (
            <Link
              key={m.id}
              to={`/bcc/meetings/${m.id}`}
              className="block bg-white rounded-xl border hover:border-blue-400 hover:shadow-sm transition-all p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {m.title || 'BCC Meeting'}
                  </p>
                  {m.scheduledAt && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(m.scheduledAt).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  m.status === 'ACTIVE' ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {m.status === 'ACTIVE' ? (
                    <span className="flex items-center gap-1"><Play className="h-3 w-3" /> Live</span>
                  ) : m.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {m.sessions?.length ?? 0} case{(m.sessions?.length ?? 0) !== 1 ? 's' : ''} ·
                BM: {m.createdBy.firstName} {m.createdBy.lastName}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function BccList() {
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [page, setPage] = useState(1);
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['bcc', statusFilter, page],
    queryFn: () => bccApi.list({ ...(statusFilter ? { status: statusFilter } : {}), page, limit: 20 }),
  });

  const sessions: BccSession[] = data?.data ?? [];
  const pagination = data?.pagination;
  const canManage = user?.role === 'BRANCH_MANAGER' || user?.role === 'ADMIN';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Branch Credit Committee</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review and vote on credit applications</p>
        </div>
      </div>

      {/* Meetings */}
      <MeetingsList canManage={canManage} />

      {/* Ad-hoc Sessions */}
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2 mb-3">
        <Users className="h-4 w-4" /> Ad-hoc Sessions
      </h2>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : sessions.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No BCC sessions found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Votes</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opened</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comments</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {sessions.map((s) => {
                const app   = s.loanApplication;
                const cust  = app?.customer;
                const score = app?.creditScore;
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/bcc/${s.id}`} className="block group">
                        <p className="text-sm font-medium text-primary-700 group-hover:underline">
                          {cust?.firstName} {cust?.lastName}
                        </p>
                        <p className="text-xs text-gray-400">{cust?.county}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      KES {app?.requestedAmountKes?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {score ? (
                        <span className={`font-medium ${score.totalScore >= 70 ? 'text-green-600' : score.totalScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {score.totalScore}/100
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <VoteSummary votes={s.votes} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <OutcomeIcon outcome={s.outcome} />
                        <StatusBadge status={s.status} />
                        {s.managerOverride && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">Override</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(s.openedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {s._count?.comments ?? 0}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">{pagination.total} sessions</p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="btn-secondary text-sm disabled:opacity-40"
            >Prev</button>
            <button
              disabled={page === pagination.pages}
              onClick={() => setPage(p => p + 1)}
              className="btn-secondary text-sm disabled:opacity-40"
            >Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
