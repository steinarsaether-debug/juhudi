import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Users, Plus, Search, RefreshCw, ChevronRight } from 'lucide-react';
import { groupApi } from '../../services/api';
import { LoanGroup, LoanGroupStatus } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const STATUS_COLORS: Record<LoanGroupStatus, string> = {
  FORMING:   'bg-blue-50  border-blue-200  text-blue-700',
  ACTIVE:    'bg-green-50 border-green-200 text-green-700',
  SUSPENDED: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  DISSOLVED: 'bg-gray-50  border-gray-200  text-gray-500',
};

const FREQ_LABEL: Record<string, string> = {
  WEEKLY: 'Weekly', BIWEEKLY: 'Bi-weekly', MONTHLY: 'Monthly',
};

export default function GroupList() {
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [page, setPage]       = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['groups', search, status, page],
    queryFn: () => groupApi.list({
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      page,
      limit: 20,
    }),
    staleTime: 60_000,
  });

  const groups: LoanGroup[] = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Loan Groups</h1>
          <p className="text-sm text-gray-500 mt-1">Solidarity / joint-liability lending groups</p>
        </div>
        <Link to="/groups/new" className="btn-primary">
          <Plus className="h-4 w-4" /> New Group
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search groups…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="input w-44"
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="">All statuses</option>
            <option value="FORMING">Forming</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DISSOLVED">Dissolved</option>
          </select>
          <button className="btn-secondary" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Group Name', 'Reg. No.', 'Status', 'Members', 'Active Loans', 'LO', 'Branch', 'Meeting', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {groups.map(g => (
                  <tr key={g.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700 flex-shrink-0">
                          <Users className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-gray-900">{g.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{g.registrationNo ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[g.status]}`}>
                        {g.status.charAt(0) + g.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{g.activeMembers ?? g._count?.members ?? 0}</td>
                    <td className="px-4 py-3 text-gray-700">{g.activeLoans ?? 0}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {g.loanOfficer ? `${g.loanOfficer.firstName} ${g.loanOfficer.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{g.branch?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {FREQ_LABEL[g.meetingFrequency]}
                      {g.meetingDay ? `, ${g.meetingDay}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/groups/${g.id}`}
                        className="flex items-center gap-1 text-primary-600 hover:text-primary-800 text-xs font-medium"
                      >
                        View <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-gray-400">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>No groups found.</p>
                      <Link to="/groups/new" className="text-primary-600 text-sm mt-1 inline-block">
                        Create the first group →
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <span>{pagination.total} groups total</span>
              <div className="flex items-center gap-2">
                <button
                  className="btn-secondary py-1 px-3"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  ← Prev
                </button>
                <span>Page {page} of {pagination.pages}</span>
                <button
                  className="btn-secondary py-1 px-3"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
