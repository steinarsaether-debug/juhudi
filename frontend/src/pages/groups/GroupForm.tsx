import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Users, ChevronLeft } from 'lucide-react';
import { groupApi, adminApi, getErrorMessage } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const FREQ_OPTIONS = [
  { value: 'WEEKLY',   label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Bi-weekly' },
  { value: 'MONTHLY',  label: 'Monthly' },
];

const DAY_OPTIONS = [
  'MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY',
];

export default function GroupForm() {
  const { id } = useParams<{ id?: string }>();
  const navigate   = useNavigate();
  const { user }   = useAuthStore();
  const isEdit     = !!id;

  // Load existing group when editing
  const { data: existingGroup, isLoading: loadingGroup } = useQuery({
    queryKey: ['group', id],
    queryFn: () => groupApi.get(id!),
    enabled: isEdit,
  });

  // Load users for LO selector (admin/BM only)
  const canPickLO  = ['ADMIN', 'BRANCH_MANAGER'].includes(user?.role ?? '');
  const { data: usersData } = useQuery({
    queryKey: ['adminUsers', 'LOAN_OFFICER'],
    queryFn:  () => adminApi.listUsers({ role: 'LOAN_OFFICER', limit: 200 }),
    enabled:  canPickLO,
  });
  const loUsers = usersData?.data ?? [];

  // Load branches for admin
  const { data: branchesData } = useQuery({
    queryKey: ['adminBranches'],
    queryFn:  () => adminApi.listBranches(),
    enabled:  user?.role === 'ADMIN',
  });
  const branches = branchesData ?? [];

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    name:             existingGroup?.name ?? '',
    registrationNo:   existingGroup?.registrationNo ?? '',
    meetingFrequency: (existingGroup?.meetingFrequency ?? 'MONTHLY') as string,
    meetingDay:       existingGroup?.meetingDay ?? '',
    meetingLocation:  existingGroup?.meetingLocation ?? '',
    formedAt:         existingGroup?.formedAt?.split('T')[0] ?? today,
    registeredAt:     existingGroup?.registeredAt?.split('T')[0] ?? '',
    notes:            existingGroup?.notes ?? '',
    loanOfficerId:    existingGroup?.loanOfficerId ?? '',
    branchId:         existingGroup?.branchId ?? '',
    status:           existingGroup?.status ?? 'FORMING',
  });

  // Once the query loads, populate the form
  const [populated, setPopulated] = useState(false);
  if (existingGroup && !populated) {
    setForm({
      name:             existingGroup.name,
      registrationNo:   existingGroup.registrationNo ?? '',
      meetingFrequency: existingGroup.meetingFrequency,
      meetingDay:       existingGroup.meetingDay ?? '',
      meetingLocation:  existingGroup.meetingLocation ?? '',
      formedAt:         existingGroup.formedAt.split('T')[0],
      registeredAt:     existingGroup.registeredAt?.split('T')[0] ?? '',
      notes:            existingGroup.notes ?? '',
      loanOfficerId:    existingGroup.loanOfficerId,
      branchId:         existingGroup.branchId,
      status:           existingGroup.status,
    });
    setPopulated(true);
  }

  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = {
        ...data,
        formedAt: new Date(data.formedAt).toISOString(),
        registeredAt: data.registeredAt ? new Date(data.registeredAt).toISOString() : undefined,
        registrationNo: data.registrationNo || undefined,
        meetingDay:     data.meetingDay || undefined,
        meetingLocation: data.meetingLocation || undefined,
        notes:          data.notes || undefined,
        loanOfficerId:  canPickLO && data.loanOfficerId ? data.loanOfficerId : undefined,
        branchId:       user?.role === 'ADMIN' && data.branchId ? data.branchId : undefined,
      };
      return isEdit
        ? groupApi.update(id!, payload)
        : groupApi.create(payload);
    },
    onSuccess: (result) => {
      navigate(`/groups/${result.id ?? id}`);
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Group name is required'); return; }
    mutation.mutate(form);
  };

  if (isEdit && loadingGroup) return <LoadingSpinner />;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-secondary p-2">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="page-title">{isEdit ? 'Edit Group' : 'New Loan Group'}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Solidarity / joint-liability group</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary-600" /> Group Details
          </h2>

          <div>
            <label className="label">Group Name *</label>
            <input
              className="input"
              placeholder="e.g. Wamahiu Self Help Group"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Registration No. (optional)</label>
              <input
                className="input"
                placeholder="e.g. SHG/2024/001"
                value={form.registrationNo}
                onChange={e => setForm(f => ({ ...f, registrationNo: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Date Formed *</label>
              <input
                className="input"
                type="date"
                value={form.formedAt}
                max={today}
                onChange={e => setForm(f => ({ ...f, formedAt: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Date Officially Registered (optional)</label>
            <input
              className="input"
              type="date"
              value={form.registeredAt}
              max={today}
              onChange={e => setForm(f => ({ ...f, registeredAt: e.target.value }))}
            />
          </div>
        </div>

        {/* Meeting Schedule */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Meeting Schedule</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Meeting Frequency *</label>
              <select
                className="input"
                value={form.meetingFrequency}
                onChange={e => setForm(f => ({ ...f, meetingFrequency: e.target.value }))}
              >
                {FREQ_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Meeting Day</label>
              <select
                className="input"
                value={form.meetingDay}
                onChange={e => setForm(f => ({ ...f, meetingDay: e.target.value }))}
              >
                <option value="">Not specified</option>
                {DAY_OPTIONS.map(d => (
                  <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Meeting Location</label>
            <input
              className="input"
              placeholder="e.g. Village market, Chief's office"
              value={form.meetingLocation}
              onChange={e => setForm(f => ({ ...f, meetingLocation: e.target.value }))}
            />
          </div>
        </div>

        {/* Admin / BM: LO & Branch assignment */}
        {canPickLO && (
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">Assignment</h2>
            {user?.role === 'ADMIN' && (
              <div>
                <label className="label">Branch</label>
                <select
                  className="input"
                  value={form.branchId}
                  onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}
                >
                  <option value="">— Select branch —</option>
                  {branches.map((b: { id: string; name: string }) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">Loan Officer</label>
              <select
                className="input"
                value={form.loanOfficerId}
                onChange={e => setForm(f => ({ ...f, loanOfficerId: e.target.value }))}
              >
                <option value="">— Select loan officer —</option>
                {loUsers.map((u: { id: string; firstName: string; lastName: string; branch?: { name: string } }) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} {u.branch ? `(${u.branch.name})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {isEdit && (
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                >
                  {['FORMING', 'ACTIVE', 'SUSPENDED', 'DISSOLVED'].map(s => (
                    <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="card p-6">
          <label className="label">Notes (optional)</label>
          <textarea
            className="input h-24 resize-none"
            placeholder="Any relevant notes about the group…"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  );
}
