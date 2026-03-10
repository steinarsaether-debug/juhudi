import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, ExternalLink } from 'lucide-react';
import { adminApi } from '../../services/api';
import { AuditLogEntry, PaginatedResponse } from '../../types';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// Human-friendly action labels
const ACTION_LABEL: Record<string, string> = {
  LOGIN:              'Login',
  CHANGE_PASSWORD:    'Changed Password',
  CREATE_USER:        'Created User',
  UPDATE_USER:        'Updated User',
  RESET_PASSWORD:     'Reset Password',
  ACTIVATE_USER:      'Activated User',
  DEACTIVATE_USER:    'Deactivated User',
  CREATE_BRANCH:      'Created Branch',
  UPDATE_BRANCH:      'Updated Branch',
  CREATE_CUSTOMER:    'Created Customer',
  UPDATE_KYC_STATUS:  'Updated KYC',
  VIEW_KYC_DOCS:      'Viewed KYC Docs',
  UPLOAD_DOCUMENT:    'Uploaded Document',
  SCORE_CUSTOMER:     'Credit Scored',
  SUBMIT_APPLICATION: 'Loan Application',
  APPROVE_LOAN:       'Approved Loan',
  REJECT_LOAN:        'Rejected Loan',
  DISBURSE_LOAN:      'Disbursed Loan',
  RECORD_REPAYMENT:   'Recorded Repayment',
  RESOLVE_FLAG:       'Resolved Flag',
  BRANCH_SCAN:        'Branch Scan',
  SAVE_INTERVIEW:     'Saved Interview',
};

const ACTION_COLOR: Record<string, string> = {
  LOGIN:           'bg-blue-50 text-blue-600',
  CREATE_CUSTOMER: 'bg-green-50 text-green-600',
  DEACTIVATE_USER: 'bg-red-50 text-red-600',
  DISBURSE_LOAN:   'bg-purple-50 text-purple-600',
  APPROVE_LOAN:    'bg-green-50 text-green-600',
  REJECT_LOAN:     'bg-red-50 text-red-600',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN:          'bg-red-100 text-red-700',
  BRANCH_MANAGER: 'bg-purple-100 text-purple-700',
  SUPERVISOR:     'bg-blue-100 text-blue-700',
  LOAN_OFFICER:   'bg-green-100 text-green-700',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

export default function AdminActivity() {
  const [userSearch, setUserSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');
  const [page, setPage] = useState(1);

  const params = {
    page, limit: 50,
    ...(userSearch    ? { userId: userSearch }  : {}),
    ...(actionFilter  ? { action: actionFilter } : {}),
    ...(from          ? { from }                 : {}),
    ...(to            ? { to }                   : {}),
  };

  const { data, isLoading } = useQuery<PaginatedResponse<AuditLogEntry>>({
    queryKey: ['adminActivity', params],
    queryFn:  () => adminApi.listActivity(params),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Activity Log</h1>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Auto-refreshes every 30s
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="input pl-9 w-full text-sm"
              placeholder="User name / email…"
              value={userSearch}
              onChange={e => { setUserSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="input text-sm"
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          >
            <option value="">All actions</option>
            {Object.keys(ACTION_LABEL).map(a => (
              <option key={a} value={a}>{ACTION_LABEL[a]}</option>
            ))}
          </select>
          <div>
            <label className="block text-xs text-gray-400 mb-1">From</label>
            <input type="date" className="input w-full text-sm" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">To</label>
            <input type="date" className="input w-full text-sm" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} />
          </div>
        </div>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['When', 'User', 'Action', 'Entity', 'IP Address'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(data?.data ?? []).map(log => (
                  <tr key={log.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs text-gray-700">{timeAgo(log.createdAt)}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(log.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 whitespace-nowrap">
                        {log.user.firstName} {log.user.lastName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${ROLE_COLORS[log.user.role] ?? 'bg-gray-100 text-gray-500'}`}>
                          {log.user.role.replace('_', ' ')}
                        </span>
                        {log.user.branch && (
                          <span className="text-xs text-gray-400">{log.user.branch.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${ACTION_COLOR[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ACTION_LABEL[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-500">{log.entity}</p>
                      <p className="font-mono text-xs text-gray-400 flex items-center gap-1">
                        {log.entityId.substring(0, 8)}…
                        <a
                          href={`/${log.entity}/${log.entityId}`}
                          className="text-primary-500 hover:text-primary-700"
                          target="_blank" rel="noreferrer"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">
                      {log.ipAddress}
                    </td>
                  </tr>
                ))}
                {!data?.data?.length && (
                  <tr><td colSpan={5} className="py-12 text-center text-gray-400">No activity found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
              <span>{data.pagination.total.toLocaleString()} entries</span>
              <div className="flex gap-2">
                <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                <span className="px-3 py-2">Page {page} of {data.pagination.pages}</span>
                <button className="btn-secondary" disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
