import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { bccApi } from '../../services/api';
import { getErrorMessage } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface BccFlag {
  id: string;
  category: string;
  severity: 'YELLOW' | 'RED';
  title: string;
  description: string | null;
  isResolved: boolean;
  didMaterialize: boolean | null;
  raisedBy: { id: string; firstName: string; lastName: string; role: string };
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  REPAYMENT_CAPACITY: 'Repayment Capacity',
  PURPOSE_RISK: 'Purpose Risk',
  CHARACTER_CONCERN: 'Character',
  SECTOR_RISK: 'Sector Risk',
  COLLATERAL_WEAKNESS: 'Collateral',
  DATA_QUALITY: 'Data Quality',
  OTHER: 'Other',
};

const SEVERITY_STYLES: Record<string, string> = {
  YELLOW: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  RED:    'bg-red-100 text-red-800 border-red-300',
};

function FlagCard({ flag, sessionId, canResolve }: { flag: BccFlag; sessionId: string; canResolve: boolean }) {
  const [showResolve, setShowResolve] = useState(false);
  const [note, setNote] = useState('');
  const qc = useQueryClient();

  const resolveMutation = useMutation({
    mutationFn: () => bccApi.resolveFlag(sessionId, flag.id, { resolvedNote: note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bcc-case', sessionId] }); setShowResolve(false); },
  });

  return (
    <div className={`rounded-lg border p-3 mb-2 ${SEVERITY_STYLES[flag.severity]} ${flag.isResolved ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${flag.severity === 'RED' ? 'bg-red-200' : 'bg-yellow-200'}`}>
              {flag.severity}
            </span>
            <span className="text-xs text-gray-600">{CATEGORY_LABELS[flag.category] ?? flag.category}</span>
            {flag.isResolved && <CheckCircle className="h-3 w-3 text-green-600" />}
          </div>
          <p className="font-semibold text-sm mt-1">{flag.title}</p>
          {flag.description && <p className="text-xs mt-0.5 opacity-80">{flag.description}</p>}
          <p className="text-xs opacity-60 mt-1">
            {flag.raisedBy.firstName} {flag.raisedBy.lastName} · {new Date(flag.createdAt).toLocaleDateString('en-KE')}
          </p>
          {flag.didMaterialize !== null && (
            <p className={`text-xs mt-1 font-medium ${flag.didMaterialize ? 'text-red-700' : 'text-green-700'}`}>
              Outcome: {flag.didMaterialize ? 'Concern validated' : 'Unfounded'}
            </p>
          )}
        </div>
      </div>
      {!flag.isResolved && canResolve && (
        <div className="mt-2">
          {!showResolve ? (
            <button onClick={() => setShowResolve(true)} className="text-xs underline opacity-70 hover:opacity-100">
              Resolve flag
            </button>
          ) : (
            <div className="space-y-1">
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Resolution note (optional)"
                className="w-full border border-current/30 rounded px-2 py-1 text-xs bg-white/60"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => resolveMutation.mutate()}
                  disabled={resolveMutation.isPending}
                  className="text-xs bg-current/20 hover:bg-current/30 px-2 py-0.5 rounded font-medium"
                >
                  {resolveMutation.isPending ? '...' : 'Confirm'}
                </button>
                <button onClick={() => setShowResolve(false)} className="text-xs opacity-60 hover:opacity-100">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BccFlagPanel({
  sessionId, flags, sessionOpen,
}: {
  sessionId: string;
  flags: BccFlag[];
  sessionOpen: boolean;
}) {
  const { user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: 'REPAYMENT_CAPACITY', severity: 'YELLOW', title: '', description: '' });
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(true);
  const qc = useQueryClient();

  const canResolve = user?.role === 'BRANCH_MANAGER' || user?.role === 'SUPERVISOR' || user?.role === 'ADMIN';

  const raiseMutation = useMutation({
    mutationFn: () => bccApi.raiseFlag(sessionId, form),
    onSuccess: () => {
      setShowForm(false);
      setForm({ category: 'REPAYMENT_CAPACITY', severity: 'YELLOW', title: '', description: '' });
      setError('');
      qc.invalidateQueries({ queryKey: ['bcc-case', sessionId] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const openFlags   = flags.filter(f => !f.isResolved);
  const closedFlags = flags.filter(f => f.isResolved);

  return (
    <div className="border-b">
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-4 w-4 ${openFlags.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
          <span className="text-sm font-semibold text-gray-700">
            Concerns & Flags
            {openFlags.length > 0 && <span className="ml-1 text-xs text-red-600">({openFlags.length} open)</span>}
          </span>
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {openFlags.map(f => (
            <FlagCard key={f.id} flag={f} sessionId={sessionId} canResolve={canResolve} />
          ))}
          {closedFlags.length > 0 && (
            <details className="mt-1">
              <summary className="text-xs text-gray-400 cursor-pointer">
                {closedFlags.length} resolved flag{closedFlags.length !== 1 ? 's' : ''}
              </summary>
              {closedFlags.map(f => (
                <FlagCard key={f.id} flag={f} sessionId={sessionId} canResolve={false} />
              ))}
            </details>
          )}

          {sessionOpen && (
            <>
              {!showForm ? (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 mt-1"
                >
                  <Plus className="h-3 w-3" /> Raise a concern
                </button>
              ) : (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-2 space-y-2">
                  <p className="text-xs font-semibold text-orange-800">Raise Concern</p>
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full text-xs border rounded px-2 py-1"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <div className="flex gap-2">
                    {(['YELLOW', 'RED'] as const).map(sev => (
                      <button
                        key={sev}
                        onClick={() => setForm(f => ({ ...f, severity: sev }))}
                        className={`flex-1 text-xs py-1 rounded font-semibold border-2 transition-colors ${
                          form.severity === sev
                            ? sev === 'RED' ? 'bg-red-100 border-red-400 text-red-800' : 'bg-yellow-100 border-yellow-400 text-yellow-800'
                            : 'border-gray-200 text-gray-500'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Title (required)"
                    className="w-full text-xs border rounded px-2 py-1"
                  />
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full text-xs border rounded px-2 py-1 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => form.title.trim() && raiseMutation.mutate()}
                      disabled={!form.title.trim() || raiseMutation.isPending}
                      className="text-xs bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-3 py-1 rounded"
                    >
                      {raiseMutation.isPending ? 'Saving...' : 'Raise Flag'}
                    </button>
                    <button onClick={() => setShowForm(false)} className="text-xs text-gray-500 hover:text-gray-800">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
