import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Plus, ChevronLeft, Edit, UserMinus, Search,
  CreditCard, Calendar, MapPin,
} from 'lucide-react';
import { groupApi, customerApi, getErrorMessage } from '../../services/api';
import { LoanGroup, LoanGroupStatus, ApplicationStatus } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import clsx from 'clsx';

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<LoanGroupStatus, string> = {
  FORMING:   'bg-blue-50  border-blue-200  text-blue-700',
  ACTIVE:    'bg-green-50 border-green-200 text-green-700',
  SUSPENDED: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  DISSOLVED: 'bg-gray-100 border-gray-200  text-gray-500',
};

const APP_STATUS_COLORS: Record<ApplicationStatus, string> = {
  DRAFT:                 'bg-gray-100  text-gray-600',
  SUBMITTED:             'bg-blue-100  text-blue-700',
  UNDER_REVIEW:          'bg-yellow-100 text-yellow-700',
  APPROVED:              'bg-green-100 text-green-700',
  CONDITIONALLY_APPROVED:'bg-teal-100  text-teal-700',
  REJECTED:              'bg-red-100   text-red-700',
  WITHDRAWN:             'bg-gray-100  text-gray-500',
};

const KYC_LABEL: Record<string, string> = {
  PENDING: 'Pending', SUBMITTED: 'Submitted', VERIFIED: 'Verified',
  REJECTED: 'Rejected', REQUIRES_UPDATE: 'Update Needed',
};
const KYC_COLOR: Record<string, string> = {
  PENDING: 'text-gray-500', SUBMITTED: 'text-blue-600', VERIFIED: 'text-green-600',
  REJECTED: 'text-red-600', REQUIRES_UPDATE: 'text-yellow-600',
};

const ROLE_LABELS: Record<string, string> = {
  CHAIR: 'Chair', SECRETARY: 'Secretary', TREASURER: 'Treasurer', MEMBER: 'Member',
};
const ROLE_COLORS: Record<string, string> = {
  CHAIR: 'bg-purple-100 text-purple-700', SECRETARY: 'bg-blue-100 text-blue-700',
  TREASURER: 'bg-green-100 text-green-700', MEMBER: 'bg-gray-100 text-gray-600',
};

// ── Add Member Modal ──────────────────────────────────────────────────────────

function AddMemberModal({
  groupId,
  onClose,
  onAdded,
}: { groupId: string; onClose: () => void; onAdded: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [role, setRole]             = useState('MEMBER');
  const [error, setError]           = useState('');

  const { data: searchData, isFetching } = useQuery({
    queryKey: ['customers', 'search', searchTerm],
    queryFn: () => customerApi.list({ search: searchTerm, limit: 10 }),
    enabled: searchTerm.length >= 2,
    staleTime: 30_000,
  });
  const results = searchData?.data ?? [];

  const addMutation = useMutation({
    mutationFn: (customerId: string) =>
      groupApi.addMember(groupId, { customerId, role }),
    onSuccess: () => { onAdded(); onClose(); },
    onError: (err) => setError(getErrorMessage(err)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <UserMinus className="h-4 w-4 text-primary-600 rotate-180" /> Add Member
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="label">Search Customer</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                className="input pl-9"
                placeholder="Name or ID number…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Results */}
          {isFetching && <p className="text-sm text-gray-400">Searching…</p>}
          {results.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {results.map((c: { id: string; firstName: string; lastName: string; kycStatus: string; county: string }) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addMutation.mutate(c.id)}
                  disabled={addMutation.isPending}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.firstName} {c.lastName}</p>
                    <p className={`text-xs ${KYC_COLOR[c.kycStatus] ?? 'text-gray-400'}`}>
                      KYC: {KYC_LABEL[c.kycStatus] ?? c.kycStatus} · {c.county}
                    </p>
                  </div>
                  <Plus className="h-4 w-4 text-primary-600 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
          {searchTerm.length >= 2 && !isFetching && results.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">No customers found.</p>
          )}

          <div>
            <label className="label">Role in Group</label>
            <select
              className="input"
              value={role}
              onChange={e => setRole(e.target.value)}
            >
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
        </div>

        <div className="px-5 pb-5 flex justify-end">
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function GroupProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showAddMember, setShowAddMember] = useState(false);
  const [removingId, setRemovingId]       = useState<string | null>(null);

  const { data: group, isLoading, error: loadError } = useQuery<LoanGroup>({
    queryKey: ['group', id],
    queryFn:  () => groupApi.get(id!),
    enabled:  !!id,
    staleTime: 30_000,
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => groupApi.removeMember(id!, memberId),
    onSuccess: () => {
      setRemovingId(null);
      qc.invalidateQueries({ queryKey: ['group', id] });
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (loadError || !group) {
    return <div className="p-8 text-center text-gray-500">Group not found.</div>;
  }

  const activeMembers = (group.members ?? []).filter(m => m.isActive);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/groups')} className="btn-secondary p-2">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="page-title mb-0">{group.name}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[group.status]}`}>
                {group.status.charAt(0) + group.status.slice(1).toLowerCase()}
              </span>
            </div>
            {group.registrationNo && (
              <p className="text-sm text-gray-500 mt-0.5">Reg. No: {group.registrationNo}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/groups/${id}/edit`} className="btn-secondary">
            <Edit className="h-4 w-4" /> Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Info cards */}
        <div className="space-y-4">
          {/* Group info */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Group Info</h3>
            <InfoRow label="Loan Officer" value={group.loanOfficer ? `${group.loanOfficer.firstName} ${group.loanOfficer.lastName}` : '—'} />
            <InfoRow label="Branch" value={group.branch?.name ?? '—'} />
            <InfoRow label="Formed" value={new Date(group.formedAt).toLocaleDateString('en-KE')} />
            {group.registeredAt && (
              <InfoRow label="Registered" value={new Date(group.registeredAt).toLocaleDateString('en-KE')} />
            )}
          </div>

          {/* Meeting schedule */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Meeting Schedule
            </h3>
            <InfoRow label="Frequency" value={{ WEEKLY: 'Weekly', BIWEEKLY: 'Bi-weekly', MONTHLY: 'Monthly' }[group.meetingFrequency] ?? group.meetingFrequency} />
            {group.meetingDay && <InfoRow label="Day" value={group.meetingDay.charAt(0) + group.meetingDay.slice(1).toLowerCase()} />}
            {group.meetingLocation && (
              <div>
                <p className="text-xs text-gray-500">Location</p>
                <p className="text-sm text-gray-800 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" /> {group.meetingLocation}
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          {group.notes && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Notes</h3>
              <p className="text-sm text-gray-600">{group.notes}</p>
            </div>
          )}
        </div>

        {/* Right: Members + Loans (2 col) */}
        <div className="col-span-2 space-y-6">

          {/* Members table */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary-600" />
                Members
                <span className="text-sm font-normal text-gray-400">({activeMembers.length})</span>
              </h3>
              <button
                className="btn-primary py-1.5 text-sm"
                onClick={() => setShowAddMember(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Add Member
              </button>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Name', 'Role', 'KYC', 'Active Loan', 'Joined', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeMembers.map(m => {
                  const c = m.customer!;
                  const activeLoan = c.loanApplications?.[0];
                  return (
                    <tr key={m.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <Link to={`/customers/${c.id}`} className="font-medium text-primary-700 hover:underline">
                          {c.firstName} {c.lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[m.role]}`}>
                          {ROLE_LABELS[m.role]}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-xs ${KYC_COLOR[c.kycStatus]}`}>
                        {KYC_LABEL[c.kycStatus] ?? c.kycStatus}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {activeLoan ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${APP_STATUS_COLORS[activeLoan.status]}`}>
                            {activeLoan.status.replace(/_/g, ' ')}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(m.joinedAt).toLocaleDateString('en-KE')}
                      </td>
                      <td className="px-4 py-3">
                        {removingId === m.id ? (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-red-600">Remove?</span>
                            <button
                              onClick={() => removeMutation.mutate(m.id)}
                              className="text-red-600 hover:text-red-800 font-medium"
                              disabled={removeMutation.isPending}
                            >
                              Yes
                            </button>
                            <button onClick={() => setRemovingId(null)} className="text-gray-400">
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setRemovingId(m.id)}
                            className="text-xs text-gray-400 hover:text-red-600 flex items-center gap-1"
                          >
                            <UserMinus className="h-3.5 w-3.5" /> Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {activeMembers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400 text-sm">
                      No members yet. Click "Add Member" to add customers to this group.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Loan History */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary-600" />
                Loan Applications
              </h3>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Customer', 'App #', 'Amount', 'Term', 'Status', 'Officer', 'Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(group.loanApplications ?? []).map(app => (
                  <tr key={app.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <Link to={`/customers/${app.customerId}`} className="text-primary-700 hover:underline font-medium">
                        {app.customer?.firstName} {app.customer?.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{app.applicationNumber.slice(-8)}</td>
                    <td className="px-4 py-3 font-medium">KES {app.requestedAmountKes.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{app.termMonths} mo</td>
                    <td className="px-4 py-3">
                      <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', APP_STATUS_COLORS[app.status])}>
                        {app.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {app.officer ? `${app.officer.firstName} ${app.officer.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(app.createdAt).toLocaleDateString('en-KE')}
                    </td>
                  </tr>
                ))}
                {!group.loanApplications?.length && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400 text-sm">
                      No loan applications for this group yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <AddMemberModal
          groupId={id!}
          onClose={() => setShowAddMember(false)}
          onAdded={() => qc.invalidateQueries({ queryKey: ['group', id] })}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  );
}
