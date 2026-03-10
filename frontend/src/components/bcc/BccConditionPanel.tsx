import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Plus, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { bccApi } from '../../services/api';
import { getErrorMessage } from '../../services/api';

interface BccCondition {
  id: string;
  description: string;
  dueDate: string | null;
  verifiedAt: string | null;
  verifiedNote: string | null;
  addedBy: { firstName: string; lastName: string };
  createdAt: string;
}

function ConditionItem({ cond, sessionId, canVerify }: { cond: BccCondition; sessionId: string; canVerify: boolean }) {
  const [showVerify, setShowVerify] = useState(false);
  const [note, setNote] = useState('');
  const qc = useQueryClient();

  const verifyMutation = useMutation({
    mutationFn: () => bccApi.verifyCondition(sessionId, cond.id, { verifiedNote: note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bcc-case', sessionId] }); setShowVerify(false); },
  });

  const isVerified = !!cond.verifiedAt;

  return (
    <div className={`py-2 border-b last:border-b-0 ${isVerified ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-2">
        {isVerified
          ? <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
          : <CheckSquare className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800">{cond.description}</p>
          {cond.dueDate && (
            <p className="text-xs text-gray-500 mt-0.5">
              Due: {new Date(cond.dueDate).toLocaleDateString('en-KE')}
            </p>
          )}
          {cond.verifiedAt && (
            <p className="text-xs text-green-600 mt-0.5">
              Verified {new Date(cond.verifiedAt).toLocaleDateString('en-KE')}
              {cond.verifiedNote && ` — ${cond.verifiedNote}`}
            </p>
          )}
          {!isVerified && canVerify && (
            <>
              {!showVerify ? (
                <button onClick={() => setShowVerify(true)} className="text-xs underline text-blue-600 mt-1">
                  Mark verified
                </button>
              ) : (
                <div className="mt-1 space-y-1">
                  <input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Verification note (optional)"
                    className="w-full text-xs border rounded px-2 py-1"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => verifyMutation.mutate()}
                      disabled={verifyMutation.isPending}
                      className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-0.5 rounded"
                    >
                      {verifyMutation.isPending ? '...' : 'Confirm'}
                    </button>
                    <button onClick={() => setShowVerify(false)} className="text-xs text-gray-500">Cancel</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BccConditionPanel({
  sessionId, conditions, canManage,
}: {
  sessionId: string;
  conditions: BccCondition[];
  canManage: boolean;
}) {
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(true);
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: () => bccApi.addCondition(sessionId, { description: desc, dueDate: dueDate || undefined }),
    onSuccess: () => {
      setShowForm(false);
      setDesc('');
      setDueDate('');
      setError('');
      qc.invalidateQueries({ queryKey: ['bcc-case', sessionId] });
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const pending  = conditions.filter(c => !c.verifiedAt);
  const verified = conditions.filter(c => !!c.verifiedAt);

  return (
    <div className="border-b">
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <CheckSquare className={`h-4 w-4 ${pending.length > 0 ? 'text-blue-500' : 'text-gray-400'}`} />
          <span className="text-sm font-semibold text-gray-700">
            Conditions
            {pending.length > 0 && <span className="ml-1 text-xs text-blue-600">({pending.length} pending)</span>}
          </span>
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {conditions.length === 0 && (
            <p className="text-xs text-gray-400 italic">No conditions set</p>
          )}
          {[...pending, ...verified].map(c => (
            <ConditionItem key={c.id} cond={c} sessionId={sessionId} canVerify={canManage} />
          ))}

          {canManage && (
            <>
              {!showForm ? (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2"
                >
                  <Plus className="h-3 w-3" /> Add condition
                </button>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2 space-y-2">
                  <p className="text-xs font-semibold text-blue-800">Add Condition</p>
                  {error && <p className="text-xs text-red-600">{error}</p>}
                  <textarea
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                    placeholder="Describe the condition..."
                    rows={2}
                    className="w-full text-xs border rounded px-2 py-1 resize-none"
                  />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full text-xs border rounded px-2 py-1"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => desc.trim() && addMutation.mutate()}
                      disabled={!desc.trim() || addMutation.isPending}
                      className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1 rounded"
                    >
                      {addMutation.isPending ? 'Saving...' : 'Add'}
                    </button>
                    <button onClick={() => setShowForm(false)} className="text-xs text-gray-500">Cancel</button>
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
