import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ThumbsUp, ThumbsDown, Minus, Send, AlertTriangle,
  User, Clock, CheckCircle, XCircle, ChevronRight,
} from 'lucide-react';
import { bccApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { BccSession, BccVote, VoteType } from '../../types';
import { getErrorMessage } from '../../services/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

const VOTE_CONFIG: Record<VoteType, { label: string; color: string; icon: React.ElementType }> = {
  ENDORSE: { label: 'Endorse',  color: 'bg-green-600 hover:bg-green-700',  icon: ThumbsUp   },
  REFUSE:  { label: 'Refuse',   color: 'bg-red-600   hover:bg-red-700',    icon: ThumbsDown },
  ABSTAIN: { label: 'Abstain',  color: 'bg-gray-500  hover:bg-gray-600',   icon: Minus      },
};

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  APPROVED:    { label: 'Approved',             color: 'text-green-700 bg-green-100' },
  REFUSED:     { label: 'Refused',              color: 'text-red-700 bg-red-100' },
  REFERRED:    { label: 'Referred Up',          color: 'text-yellow-700 bg-yellow-100' },
  CONDITIONAL: { label: 'Conditional Approval', color: 'text-blue-700 bg-blue-100' },
};

function VoteBadge({ vote }: { vote: string }) {
  const styles: Record<string, string> = {
    ENDORSE: 'bg-green-100 text-green-700',
    REFUSE:  'bg-red-100 text-red-700',
    ABSTAIN: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${styles[vote] ?? 'bg-gray-100 text-gray-600'}`}>
      {vote}
    </span>
  );
}

// ── Vote Panel ────────────────────────────────────────────────────────────────

function VotePanel({ session, myVote }: { session: BccSession; myVote?: BccVote }) {
  const qc = useQueryClient();
  const [selectedVote, setSelectedVote] = useState<VoteType | null>(myVote?.vote ?? null);
  const [rationale, setRationale]       = useState(myVote?.rationale ?? '');
  const [error, setError]               = useState('');

  const mutation = useMutation({
    mutationFn: (v: VoteType) => bccApi.vote(session.id, { vote: v, rationale }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bcc', session.id] }); setError(''); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const closed = session.status !== 'OPEN';

  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-900 mb-3">Your Vote</h3>
      {myVote && (
        <p className="text-xs text-gray-400 mb-3">
          Voted {new Date(myVote.votedAt).toLocaleString()} — you can change your vote while the session is open.
        </p>
      )}
      {closed ? (
        <p className="text-sm text-gray-500">Session is closed — voting ended.</p>
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            {(Object.keys(VOTE_CONFIG) as VoteType[]).map((v) => {
              const cfg = VOTE_CONFIG[v];
              const Icon = cfg.icon;
              const active = selectedVote === v;
              return (
                <button
                  key={v}
                  onClick={() => setSelectedVote(v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-opacity ${cfg.color} ${active ? 'ring-2 ring-offset-1 ring-gray-400' : 'opacity-70 hover:opacity-100'}`}
                >
                  <Icon className="h-4 w-4" /> {cfg.label}
                </button>
              );
            })}
          </div>
          <textarea
            placeholder="Rationale (optional) — explain your position…"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={2}
            maxLength={1000}
            className="input w-full text-sm mb-2 resize-none"
          />
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <button
            disabled={!selectedVote || mutation.isPending}
            onClick={() => selectedVote && mutation.mutate(selectedVote)}
            className="btn-primary text-sm w-full"
          >
            {mutation.isPending ? 'Submitting…' : myVote ? 'Update Vote' : 'Submit Vote'}
          </button>
        </>
      )}
    </div>
  );
}

// ── BM Override Modal ─────────────────────────────────────────────────────────

const OUTCOMES = ['APPROVED', 'REFUSED', 'REFERRED', 'CONDITIONAL'] as const;

function OverrideModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [outcome, setOutcome]         = useState<typeof OUTCOMES[number]>('APPROVED');
  const [override, setOverride]       = useState(false);
  const [overrideReason, setReason]   = useState('');
  const [outcomeNotes, setNotes]      = useState('');
  const [amountKes, setAmountKes]     = useState('');
  const [interestPct, setInterestPct] = useState('');
  const [error, setError]             = useState('');

  const mutation = useMutation({
    mutationFn: () => bccApi.decide(sessionId, {
      outcome,
      override,
      overrideReason: override ? overrideReason : undefined,
      outcomeNotes: outcomeNotes || undefined,
      approvedAmountKes: amountKes ? Number(amountKes) : undefined,
      interestRatePct: interestPct ? Number(interestPct) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bcc', sessionId] }); onClose(); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="font-bold text-gray-900 text-lg mb-4">Close BCC Session</h2>

        <label className="block text-sm font-medium text-gray-700 mb-1">Decision</label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {OUTCOMES.map(o => (
            <button
              key={o}
              onClick={() => setOutcome(o)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                outcome === o ? 'bg-primary-700 text-white border-primary-700' : 'bg-white text-gray-700 border-gray-200 hover:border-primary-400'
              }`}
            >
              {o.replace('_', ' ')}
            </button>
          ))}
        </div>

        {(outcome === 'APPROVED' || outcome === 'CONDITIONAL') && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Approved Amount (KES)</label>
              <input type="number" value={amountKes} onChange={e => setAmountKes(e.target.value)}
                className="input text-sm w-full" placeholder="Leave blank = requested" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Interest Rate (%)</label>
              <input type="number" step="0.5" value={interestPct} onChange={e => setInterestPct(e.target.value)}
                className="input text-sm w-full" placeholder="e.g. 18" />
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700">This overrides the committee majority</span>
          </label>
        </div>

        {override && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Override Reason (required)</label>
            <textarea
              value={overrideReason} onChange={e => setReason(e.target.value)}
              rows={3} maxLength={1000} className="input w-full text-sm resize-none"
              placeholder="Explain why you are overriding the committee vote…"
            />
          </div>
        )}

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Outcome Notes (optional)</label>
          <textarea
            value={outcomeNotes} onChange={e => setNotes(e.target.value)}
            rows={2} maxLength={1000} className="input w-full text-sm resize-none"
            placeholder="Any conditions, special terms, or notes for the file…"
          />
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            disabled={mutation.isPending || (override && !overrideReason.trim())}
            onClick={() => mutation.mutate()}
            className="btn-primary flex-1"
          >
            {mutation.isPending ? 'Closing…' : 'Close Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BccDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [comment, setComment]     = useState('');
  const [showDecide, setShowDecide] = useState(false);
  const [commentError, setCommentError] = useState('');

  const { data: session, isLoading } = useQuery<BccSession>({
    queryKey: ['bcc', id],
    queryFn: () => bccApi.get(id!),
    refetchInterval: 30_000,
  });

  const commentMutation = useMutation({
    mutationFn: () => bccApi.comment(id!, comment),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bcc', id] }); setComment(''); setCommentError(''); },
    onError: (err) => setCommentError(getErrorMessage(err)),
  });

  if (isLoading) return <div className="text-center py-16 text-gray-400">Loading session…</div>;
  if (!session) return <div className="text-center py-16 text-gray-400">Session not found</div>;

  const app     = session.loanApplication;
  const cust    = app?.customer;
  const score   = app?.creditScore;
  const myVote  = session.votes?.find(v => v.user.id === user?.id);
  const canVote = ['BRANCH_MANAGER', 'SUPERVISOR', 'LOAN_OFFICER'].includes(user?.role ?? '');
  const isBm    = ['BRANCH_MANAGER', 'ADMIN'].includes(user?.role ?? '');

  const endorseCount = (session.votes ?? []).filter(v => v.vote === 'ENDORSE').length;
  const refuseCount  = (session.votes ?? []).filter(v => v.vote === 'REFUSE').length;
  const abstainCount = (session.votes ?? []).filter(v => v.vote === 'ABSTAIN').length;
  const outcomeStyle = session.outcome ? OUTCOME_LABELS[session.outcome] : null;

  return (
    <div className="max-w-5xl mx-auto">
      {showDecide && id && (
        <OverrideModal sessionId={id} onClose={() => setShowDecide(false)} />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/bcc" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            BCC: {cust?.firstName} {cust?.lastName}
          </h1>
          <p className="text-sm text-gray-500">
            {cust?.village}, {cust?.county} &bull; Opened {new Date(session.openedAt).toLocaleDateString()}
          </p>
        </div>
        {session.status === 'OPEN' && isBm && (
          <button onClick={() => setShowDecide(true)} className="btn-primary">
            Close Session
          </button>
        )}
      </div>

      {/* Outcome banner */}
      {session.outcome && outcomeStyle && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-5 ${outcomeStyle.color}`}>
          {session.outcome === 'APPROVED' || session.outcome === 'CONDITIONAL'
            ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <span className="font-semibold">{outcomeStyle.label}</span>
          {session.managerOverride && (
            <span className="ml-2 text-xs bg-white/50 rounded px-2 py-0.5">Manager Override</span>
          )}
          {session.outcomeNotes && <span className="ml-2 text-sm opacity-80">— {session.outcomeNotes}</span>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column: application summary */}
        <div className="lg:col-span-2 space-y-4">

          {/* Loan summary */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Loan Application</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-400 text-xs">Requested</p>
                <p className="font-semibold text-gray-900">KES {app?.requestedAmountKes?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Term</p>
                <p className="font-semibold text-gray-900">{app?.termMonths} months</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Purpose</p>
                <p className="text-gray-700 truncate">{app?.purposeOfLoan ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Credit Score</p>
                <p className={`font-bold ${(score?.totalScore ?? 0) >= 70 ? 'text-green-600' : (score?.totalScore ?? 0) >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {score?.totalScore ?? '—'}/100
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Recommendation</p>
                <p className="text-gray-700">{score?.recommendation ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Loan Officer</p>
                <p className="text-gray-700">{app?.officer ? `${app.officer.firstName} ${app.officer.lastName}` : '—'}</p>
              </div>
            </div>
            {app?.id && (
              <Link to={`/loans/${app.id}`} className="inline-flex items-center gap-1 mt-3 text-xs text-primary-600 hover:underline">
                View full application <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          {/* Customer profile summary */}
          {cust && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Customer Profile</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {cust.subCounty && <div><p className="text-xs text-gray-400">Sub-County</p><p>{cust.subCounty}</p></div>}
                {cust.village   && <div><p className="text-xs text-gray-400">Village</p><p>{cust.village}</p></div>}
                {cust.numberOfDependents !== undefined && <div><p className="text-xs text-gray-400">Dependents</p><p>{cust.numberOfDependents}</p></div>}
                {cust.farmProfile && (
                  <>
                    <div><p className="text-xs text-gray-400">Farm Size</p><p>{cust.farmProfile.farmSize} acres</p></div>
                    <div><p className="text-xs text-gray-400">Primary Crop</p><p>{cust.farmProfile.primaryCrop}</p></div>
                    <div><p className="text-xs text-gray-400">Land</p><p>{cust.farmProfile.landOwnership}</p></div>
                  </>
                )}
                {cust.financialProfile && (
                  <>
                    <div><p className="text-xs text-gray-400">Farm Income / mo</p><p>KES {cust.financialProfile.monthlyFarmIncome.toLocaleString()}</p></div>
                    <div><p className="text-xs text-gray-400">Household Exp / mo</p><p>KES {cust.financialProfile.monthlyHouseholdExpenses.toLocaleString()}</p></div>
                    <div><p className="text-xs text-gray-400">CRB</p><p>{cust.financialProfile.crbStatus}</p></div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Comment thread */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Discussion</h3>
            {(session.comments ?? []).length === 0 && (
              <p className="text-sm text-gray-400 mb-4">No comments yet — start the discussion.</p>
            )}
            <div className="space-y-3 mb-4">
              {(session.comments ?? []).map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary-100 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-primary-700" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-gray-800">
                        {c.user.firstName} {c.user.lastName}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">{c.user.role.toLowerCase().replace('_', ' ')}</span>
                      <span className="text-xs text-gray-300 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
            {session.status === 'OPEN' && (
              <div className="flex gap-2">
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Add a comment to the discussion…"
                  rows={2}
                  maxLength={2000}
                  className="input flex-1 text-sm resize-none"
                />
                <button
                  disabled={!comment.trim() || commentMutation.isPending}
                  onClick={() => commentMutation.mutate()}
                  className="btn-primary self-end"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            )}
            {commentError && <p className="text-xs text-red-600 mt-1">{commentError}</p>}
          </div>
        </div>

        {/* Right column: vote panel + vote list */}
        <div className="space-y-4">
          {/* Vote summary */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Votes</h3>
            <div className="flex gap-3 mb-4">
              <div className="flex-1 text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{endorseCount}</p>
                <p className="text-xs text-green-600">Endorse</p>
              </div>
              <div className="flex-1 text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{refuseCount}</p>
                <p className="text-xs text-red-600">Refuse</p>
              </div>
              <div className="flex-1 text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-500">{abstainCount}</p>
                <p className="text-xs text-gray-500">Abstain</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Quorum: {session.quorumRequired} non-abstain votes needed
            </p>

            {/* Individual votes */}
            <div className="space-y-2">
              {(session.votes ?? []).map(v => (
                <div key={v.id} className="flex items-start gap-2">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center mt-0.5">
                    <User className="h-3 w-3 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-xs font-medium text-gray-800">
                        {v.user.firstName} {v.user.lastName}
                      </span>
                      <VoteBadge vote={v.vote} />
                    </div>
                    {v.rationale && <p className="text-xs text-gray-500 truncate">{v.rationale}</p>}
                  </div>
                </div>
              ))}
              {(session.votes ?? []).length === 0 && (
                <p className="text-xs text-gray-400">No votes yet</p>
              )}
            </div>
          </div>

          {/* Vote panel */}
          {canVote && <VotePanel session={session} myVote={myVote} />}

          {/* Override notice */}
          {session.managerOverride && session.overrideReason && (
            <div className="card p-4 border-l-4 border-orange-400">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-semibold text-orange-700">Manager Override</span>
              </div>
              <p className="text-xs text-gray-600">{session.overrideReason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
