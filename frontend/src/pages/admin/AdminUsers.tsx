import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, Edit2, KeyRound, ToggleLeft, ToggleRight, Search, X, AlertCircle, CheckCircle,
} from 'lucide-react';
import { adminApi, getErrorMessage } from '../../services/api';
import { AdminUser, AdminBranch } from '../../types';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const ROLE_LABELS: Record<string, string> = {
  ADMIN:          'Admin',
  BRANCH_MANAGER: 'Branch Mgr',
  SUPERVISOR:     'Supervisor',
  LOAN_OFFICER:   'Loan Officer',
};
const ROLE_COLORS: Record<string, string> = {
  ADMIN:          'bg-red-100 text-red-700',
  BRANCH_MANAGER: 'bg-purple-100 text-purple-700',
  SUPERVISOR:     'bg-blue-100 text-blue-700',
  LOAN_OFFICER:   'bg-green-100 text-green-700',
};

const EMPTY_FORM = {
  firstName: '', lastName: '', email: '', phone: '',
  role: 'LOAN_OFFICER', branchId: '', employeeId: '',
};

export default function AdminUsers() {
  const qc = useQueryClient();
  const [search, setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [editUser, setEditUser]     = useState<AdminUser | null>(null);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [formError, setFormError]   = useState('');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const params = {
    page,
    limit: 30,
    ...(search     ? { search }            : {}),
    ...(roleFilter ? { role: roleFilter }  : {}),
  };

  const { data, isLoading } = useQuery<{ data: AdminUser[]; pagination: { total: number; pages: number } }>({
    queryKey: ['adminUsers', params],
    queryFn:  () => adminApi.listUsers(params),
    staleTime: 30_000,
  });

  const { data: branches } = useQuery<AdminBranch[]>({
    queryKey: ['adminBranches'],
    queryFn:  () => adminApi.listBranches(),
    staleTime: 60_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['adminUsers'] });

  const saveMutation = useMutation({
    mutationFn: (f: typeof EMPTY_FORM) => editUser
      ? adminApi.updateUser(editUser.id, {
          firstName: f.firstName, lastName: f.lastName,
          phone: f.phone, role: f.role,
          branchId: f.branchId || null,
          employeeId: f.employeeId || null,
        })
      : adminApi.createUser(f),
    onSuccess: (res) => {
      invalidate();
      if (!editUser && res?.temporaryPassword) {
        setTempPassword(res.temporaryPassword);
      } else {
        closeModal();
      }
    },
    onError: (err) => setFormError(getErrorMessage(err)),
  });

  const resetPwMutation = useMutation({
    mutationFn: (id: string) => adminApi.resetPassword(id),
    onSuccess: (res) => {
      invalidate();
      alert(`Temporary password: ${res.temporaryPassword}\n\nUser must change on next login.`);
    },
    onError: (err) => alert(getErrorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => adminApi.toggleUserActive(id),
    onSuccess: () => invalidate(),
    onError: (err) => alert(getErrorMessage(err)),
  });

  function openCreate() {
    setEditUser(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setTempPassword(null);
    setShowModal(true);
  }
  function openEdit(u: AdminUser) {
    setEditUser(u);
    setForm({
      firstName: u.firstName, lastName: u.lastName,
      email: u.email, phone: u.phone,
      role: u.role, branchId: u.branchId ?? '',
      employeeId: u.employeeId ?? '',
    });
    setFormError('');
    setTempPassword(null);
    setShowModal(true);
  }
  function closeModal() {
    setShowModal(false);
    setTempPassword(null);
    setFormError('');
  }

  const activeBranches = (branches ?? []).filter(b => b.isActive);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">User Management</h1>
        <button className="btn-primary" onClick={openCreate}>
          <UserPlus className="h-4 w-4" /> Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Search name, email, employee ID…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="input w-auto"
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Name', 'Email', 'Role', 'Branch', 'Employee ID', 'Status', 'Last Login', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(data?.data ?? []).map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {u.firstName} {u.lastName}
                      {u.mustChangePass && (
                        <span className="ml-1.5 text-xs text-orange-500" title="Must change password">⚠</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.branch?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{u.employeeId ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          title="Edit user"
                          onClick={() => openEdit(u)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Reset password"
                          onClick={() => { if (confirm(`Reset password for ${u.firstName} ${u.lastName}?`)) resetPwMutation.mutate(u.id); }}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title={u.isActive ? 'Deactivate' : 'Activate'}
                          onClick={() => { if (confirm(`${u.isActive ? 'Deactivate' : 'Activate'} ${u.firstName} ${u.lastName}?`)) toggleMutation.mutate(u.id); }}
                          className={`p-1.5 rounded hover:bg-gray-100 ${u.isActive ? 'text-green-500 hover:text-red-500' : 'text-gray-300 hover:text-green-500'}`}
                        >
                          {u.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!data?.data?.length && (
                  <tr><td colSpan={8} className="py-12 text-center text-gray-400">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
              <span>{data.pagination.total} users</span>
              <div className="flex gap-2">
                <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                <span className="px-3 py-2">Page {page} of {data.pagination.pages}</span>
                <button className="btn-secondary" disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && !tempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">{editUser ? 'Edit User' : 'Add New User'}</h2>
              <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">First Name *</label>
                  <input className="input w-full" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Last Name *</label>
                  <input className="input w-full" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email *</label>
                <input
                  className="input w-full"
                  type="email"
                  value={form.email}
                  disabled={!!editUser}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone * (Kenyan format)</label>
                <input
                  className="input w-full"
                  placeholder="+254712345678"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Role *</label>
                  <select className="input w-full" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Branch</label>
                  <select className="input w-full" value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}>
                    <option value="">— None —</option>
                    {activeBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Employee ID (optional)</label>
                <input className="input w-full" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} />
              </div>
              {formError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5" /> {formError}
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button className="btn-secondary flex-1" onClick={closeModal}>Cancel</button>
              <button
                className="btn-primary flex-1"
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving…' : (editUser ? 'Save Changes' : 'Create User')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temp password display */}
      {showModal && tempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold mb-2">User Created</h2>
            <p className="text-sm text-gray-500 mb-4">Share this temporary password securely. The user must change it on first login.</p>
            <div className="bg-gray-50 rounded-xl p-4 font-mono text-2xl font-bold tracking-widest text-gray-800 mb-4 select-all">
              {tempPassword}
            </div>
            <button className="btn-primary w-full" onClick={closeModal}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
