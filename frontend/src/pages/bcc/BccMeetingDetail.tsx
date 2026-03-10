import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Play, ChevronRight, CheckCircle, Circle,
  BarChart2, AlertTriangle, Plus, X,
} from 'lucide-react';
import { meetingApi, bccApi, loanApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useBccStream } from '../../hooks/useBccStream';
import BccCasePresentation from '../../components/bcc/BccCasePresentation';
import BccFlagPanel from '../../components/bcc/BccFlagPanel';
import BccConditionPanel from '../../components/bcc/BccConditionPanel';
import { getErrorMessage } from '../../services/api';

// ── Status helpers ─────────────────────────────────────────────────────────────

const OUTCOME_CHIP: Record<string, string> = {
  APPROVED:    'bg-green-100 text-green-800',
  REFUSED:     'bg-red-100 text-red-800',
  REFERRED:    'bg-yellow-100 text-yellow-800',
  CONDITIONAL: 'bg-blue-100 text-blue-800',
};

// ── Vote summary bar ───────────────────────────────────────────────────────────

function VoteSummary({ votes }: { votes: Array<{ vote: string; userId: string }> }) {
  const endorse = votes.filter(v => v.vote === 'ENDORSE').length;
  const refuse  = votes.filter(v => v.vote === 'REFUSE').length;
  const abstain = votes.filter(v => v.vote === 'ABSTAIN').length;
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-green-700 font-semibold">{endorse} ✓</span>
      <span className="text-red-700 font-semibold">{refuse} ✗</span>
      {abstain > 0 && <span className="text-gray-500">{abstain} —</span>}
    </div>
  );
}

// ── Agenda sidebar ─────────────────────────────────────────────────────────────

function AgendaItem({
  session, active, onClick,
}: {
  session: {
    id: string;
    agendaIndex: number | null;
    status: string;
    outcome: string | null;
    presentedAt: string | null;
    loanApplication: {
      requestedAmountKes: number;
      customer: { firstName: string; lastName: string };
      officer: { firstName: string; lastName: string };
    };
    votes: Array<{ vote: string; userId: string }>;
    _count: { comments: number; flags: number };
  };
  active: boolean;
  onClick: () => void;
}) {
  const statusIcon = session.status === 'DECIDED' || session.status === 'OVERRIDDEN'
    ? <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
    : session.presentedAt
    ? <Play className="h-4 w-4 text-blue-600 flex-shrink-0" />
    : <Circle className="h-4 w-4 text-gray-400 flex-shrink-0" />;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors ${
        active ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center gap-2">
        {statusIcon}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${active ? 'text-white' : 'text-gray-900'}`}>
            {session.loanApplication.customer.firstName} {session.loanApplication.customer.lastName}
          </p>
          <p className={`text-xs truncate ${active ? 'text-blue-100' : 'text-gray-500'}`}>
            KES {session.loanApplication.requestedAmountKes.toLocaleString()}
          </p>
        </div>
        <ChevronRight className={`h-4 w-4 flex-shrink-0 ${active ? 'text-blue-200' : 'text-gray-400'}`} />
      </div>
      {session.votes.length > 0 && (
        <div className="mt-1 pl-6">
          <VoteSummary votes={session.votes} />
        </div>
      )}
      {session.outcome && (
        <div className="mt-1 pl-6">
          <span className={`text-xs px-1.5 py-0.5 rounded ${active ? 'bg-blue-700 text-white' : OUTCOME_CHIP[session.outcome]}`}>
            {session.outcome}
          </span>
        </div>
      )}
    </button>
  );
}

// ── Add Application Modal ──────────────────────────────────────────────────────

function AddApplicationModal({ meetingId, onClose }: { meetingId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [quorum, setQuorum] = useState(2);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const { data: submittedApps, isLoading } = useQuery({
    queryKey: ['applications', 'bcc-eligible'],
    queryFn: async () => {
      const [s, u] = await Promise.all([
        loanApi.listApplications({ status: 'SUBMITTED', limit: 50 }),
        loanApi.listApplications({ status: 'UNDER_REVIEW', limit: 50 }),
      ]);
      return [...(s.items ?? []), ...(u.items ?? [])];
    },
  });

  const mutation = useMutation({
    mutationFn: () => meetingApi.addSession(meetingId, { loanApplicationId: selected!, quorumRequired: quorum }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bcc-meeting', meetingId] });
      onClose();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-gray-900">Add Application to Agenda</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="p-4 max-h-80 overflow-y-auto">
          {isLoading && <p className="text-sm text-gray-400 text-center py-4">Loading applications…</p>}
          {!isLoading && !submittedApps?.length && (
            <p className="text-sm text-gray-400 text-center py-4">No eligible applications (SUBMITTED or UNDER_REVIEW)</p>
          )}
          {(submittedApps ?? []).map((app: { id: string; applicationNumber: string; requestedAmountKes: number; status: string; customer?: { firstName: string; lastName: string } }) => (
            <button
              key={app.id}
              onClick={() => setSelected(app.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 border transition-colors ${
                selected === app.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-transparent hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {app.customer?.firstName} {app.customer?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {app.applicationNumber} · KES {app.requestedAmountKes.toLocaleString()}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  app.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {app.status === 'SUBMITTED' ? 'Pending' : 'Under Review'}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 border-t space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 whitespace-nowrap">Quorum required</label>
            <input type="number" min={2} max={10} value={quorum}
              onChange={e => setQuorum(Number(e.target.value))}
              className="border rounded-lg px-3 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button
              disabled={!selected || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium py-2 rounded-lg text-sm"
            >
              {mutation.isPending ? 'Adding…' : 'Add to Agenda'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function BccMeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [presentError, setPresentError] = useState('');
  const [showAddApp, setShowAddApp] = useState(false);

  const { data: meeting, isLoading, error } = useQuery({
    queryKey: ['bcc-meeting', id],
    queryFn: () => meetingApi.get(id!),
    enabled: !!id,
    refetchInterval: 15_000,
  });

  const { data: caseData, isLoading: caseLoading } = useQuery({
    queryKey: ['bcc-case', activeSessionId],
    queryFn: () => bccApi.getCasePresentation(activeSessionId!),
    enabled: !!activeSessionId,
    refetchInterval: 15_000,
  });

  // SSE for the active session
  useBccStream(activeSessionId ?? undefined, {
    onVote:    () => { qc.invalidateQueries({ queryKey: ['bcc-case', activeSessionId] }); qc.invalidateQueries({ queryKey: ['bcc-meeting', id] }); },
    onComment: () => qc.invalidateQueries({ queryKey: ['bcc-case', activeSessionId] }),
    onFlag:    () => qc.invalidateQueries({ queryKey: ['bcc-case', activeSessionId] }),
    onCondition: () => qc.invalidateQueries({ queryKey: ['bcc-case', activeSessionId] }),
    onClosed:  () => { qc.invalidateQueries({ queryKey: ['bcc-case', activeSessionId] }); qc.invalidateQueries({ queryKey: ['bcc-meeting', id] }); },
  });

  const activateMutation = useMutation({
    mutationFn: () => meetingApi.activate(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bcc-meeting', id] }),
  });

  const presentMutation = useMutation({
    mutationFn: (sessionId: string) => meetingApi.startPresenting(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bcc-meeting', id] });
      setPresentError('');
    },
    onError: (err) => setPresentError(getErrorMessage(err)),
  });

  const canManage = user?.role === 'BRANCH_MANAGER' || user?.role === 'ADMIN';

  if (isLoading) return <div className="p-6 text-gray-500">Loading meeting...</div>;
  if (error || !meeting) return <div className="p-6 text-red-600">{getErrorMessage(error)}</div>;


  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* ── Sidebar: Agenda ─────────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <button onClick={() => navigate('/bcc')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3">
            <ArrowLeft className="h-4 w-4" /> Back to BCC
          </button>
          <h2 className="font-semibold text-gray-900 truncate">
            {meeting.title || 'BCC Meeting'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {meeting.scheduledAt
              ? new Date(meeting.scheduledAt).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })
              : 'Date TBD'
            }
          </p>
          <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded font-medium ${
            meeting.status === 'ACTIVE' ? 'bg-green-100 text-green-800'
            : meeting.status === 'COMPLETED' ? 'bg-gray-200 text-gray-600'
            : 'bg-yellow-100 text-yellow-800'
          }`}>
            {meeting.status}
          </span>
        </div>

        {/* Activate button */}
        {canManage && meeting.status === 'SCHEDULED' && (
          <div className="p-3 border-b">
            <button
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-lg"
            >
              <Play className="h-4 w-4" /> Start Meeting
            </button>
          </div>
        )}

        {/* Add application button — only on SCHEDULED meetings */}
        {canManage && meeting.status === 'SCHEDULED' && (
          <div className="p-3 border-b">
            <button
              onClick={() => setShowAddApp(true)}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:text-blue-600 text-gray-500 text-sm font-medium py-2 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Application
            </button>
          </div>
        )}

        {/* Agenda list */}
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Agenda</p>
          {(meeting.sessions ?? []).length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No cases added yet</p>
          )}
          {(meeting.sessions ?? []).map((s: Parameters<typeof AgendaItem>[0]['session']) => (
            <AgendaItem
              key={s.id}
              session={s}
              active={activeSessionId === s.id}
              onClick={() => setActiveSessionId(s.id)}
            />
          ))}
        </div>

        {/* Analytics link */}
        {canManage && (
          <div className="p-3 border-t">
            <Link
              to="/admin/bcc-analytics"
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-800"
            >
              <BarChart2 className="h-4 w-4" /> Flag Accuracy Analytics
            </Link>
          </div>
        )}
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      {activeSessionId ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Case Presentation */}
          <div className="flex-1 overflow-y-auto">
            {caseLoading ? (
              <div className="p-8 text-gray-400">Loading case...</div>
            ) : caseData ? (
              <>
                {/* Start Presenting button */}
                {canManage && !caseData.presentedAt && meeting.status === 'ACTIVE' && (
                  <div className="p-4 bg-white border-b">
                    {presentError && (
                      <p className="text-red-600 text-sm mb-2">{presentError}</p>
                    )}
                    <button
                      onClick={() => presentMutation.mutate(activeSessionId)}
                      disabled={presentMutation.isPending}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
                    >
                      <Play className="h-4 w-4" /> Start Presenting This Case
                    </button>
                  </div>
                )}
                {caseData.presentedAt && (
                  <div className="px-4 py-2 bg-blue-50 border-b text-blue-700 text-xs flex items-center gap-1">
                    <Play className="h-3 w-3" />
                    Presenting since {new Date(caseData.presentedAt).toLocaleTimeString('en-KE')}
                  </div>
                )}
                <BccCasePresentation caseData={caseData} sessionId={activeSessionId} />
              </>
            ) : null}
          </div>

          {/* Right: Discussion + Flags + Conditions */}
          <div className="w-80 flex-shrink-0 border-l bg-white overflow-y-auto flex flex-col">
            {caseData && (
              <>
                <BccFlagPanel
                  sessionId={activeSessionId}
                  flags={caseData.committeeDiscussion?.flags ?? []}
                  sessionOpen={caseData.sessionStatus === 'OPEN'}
                />
                <BccConditionPanel
                  sessionId={activeSessionId}
                  conditions={caseData.committeeDiscussion?.conditions ?? []}
                  canManage={canManage}
                />
              </>
            )}

            {/* Comment thread */}
            {caseData && (
              <CommentThread
                sessionId={activeSessionId}
                comments={caseData.committeeDiscussion?.comments ?? []}
                sessionOpen={caseData.sessionStatus === 'OPEN'}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Select a case from the agenda to view details</p>
            {canManage && meeting.status === 'SCHEDULED' && (
              <button
                onClick={() => setShowAddApp(true)}
                className="mt-4 flex items-center gap-2 mx-auto text-sm text-blue-600 hover:underline"
              >
                <Plus className="h-4 w-4" /> Add your first application
              </button>
            )}
          </div>
        </div>
      )}

      {showAddApp && (
        <AddApplicationModal meetingId={id!} onClose={() => setShowAddApp(false)} />
      )}
    </div>
  );
}

// ── Inline comment thread ──────────────────────────────────────────────────────

function CommentThread({
  sessionId, comments, sessionOpen,
}: {
  sessionId: string;
  comments: Array<{ id: string; body: string; createdAt: string; user: { firstName: string; lastName: string; role: string } }>;
  sessionOpen: boolean;
}) {
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => bccApi.comment(sessionId, body),
    onSuccess: () => {
      setBody('');
      setError('');
      qc.invalidateQueries({ queryKey: ['bcc-case', sessionId] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  return (
    <div className="flex-1 flex flex-col border-t">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">Discussion</p>
      <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-3">
        {comments.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No comments yet</p>
        )}
        {comments.map(c => (
          <div key={c.id} className="text-sm">
            <p className="font-medium text-gray-800 text-xs">
              {c.user.firstName} {c.user.lastName}
              <span className="text-gray-400 font-normal ml-1">
                · {new Date(c.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
            <p className="text-gray-700 mt-0.5">{c.body}</p>
          </div>
        ))}
      </div>
      {sessionOpen && (
        <div className="p-3 border-t">
          {error && <p className="text-red-600 text-xs mb-1">{error}</p>}
          <div className="flex gap-2">
            <input
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && body.trim()) { e.preventDefault(); mutation.mutate(); } }}
            />
            <button
              onClick={() => body.trim() && mutation.mutate()}
              disabled={!body.trim() || mutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded px-3 py-1.5 text-sm"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
