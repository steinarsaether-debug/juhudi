import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, UserPlus, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { customerApi } from '../../services/api';
import { Customer, PaginatedResponse } from '../../types';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const KYC_FILTERS = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending KYC' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function CustomerList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const page = parseInt(searchParams.get('page') ?? '1');
  const kycStatus = searchParams.get('kycStatus') ?? '';

  const { data, isLoading } = useQuery<PaginatedResponse<Customer>>({
    queryKey: ['customers', { page, search, kycStatus }],
    queryFn: () => customerApi.list({
      page, limit: 20,
      ...(search ? { search } : {}),
      ...(kycStatus ? { kycStatus } : {}),
    }),
  });

  const setPage = (p: number) => setSearchParams(prev => { prev.set('page', String(p)); return prev; });
  const setFilter = (f: string) => setSearchParams(prev => { prev.set('kycStatus', f); prev.set('page', '1'); return prev; });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Customers</h1>
        <Link to="/customers/new" className="btn-primary">
          <UserPlus className="h-4 w-4" />
          Onboard New Customer
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48 max-w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by name, village, customer ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {KYC_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                kycStatus === f.value
                  ? 'bg-primary-700 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table — hidden on mobile, shown on md+ */}
      <div className="table-container hidden md:block">
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Customer ID</th>
                <th>KYC Status</th>
                <th>AML</th>
                <th>Loans</th>
                <th>Quality</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((c) => {
                const flagCount = c.qualityFlagCount ?? 0;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link to={`/customers/${c.id}`} className="font-medium text-primary-700 hover:underline">
                        {c.firstName} {c.lastName}
                      </Link>
                    </td>
                    <td className="text-gray-500">{c.village}, {c.county}</td>
                    <td>
                      {c.customerNumber
                        ? <span className="font-mono text-xs text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{c.customerNumber}</span>
                        : c.yaraCustomerId
                          ? <span className="font-mono text-xs text-gray-400">{c.yaraCustomerId}</span>
                          : <span className="text-gray-300 text-xs">—</span>
                      }
                    </td>
                    <td><StatusBadge status={c.kycStatus} /></td>
                    <td><StatusBadge status={c.amlStatus} /></td>
                    <td className="text-center">{c._count?.loans ?? 0}</td>
                    <td>
                      {flagCount > 0 ? (
                        <Link
                          to={`/customers/${c.id}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100"
                          title={`${flagCount} unresolved quality flag(s)`}
                        >
                          <ShieldAlert className="h-3 w-3" />
                          {flagCount}
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="text-gray-500 text-xs">{new Date(c.createdAt).toLocaleDateString('en-KE')}</td>
                  </tr>
                );
              })}
              {!data?.data.length && (
                <tr><td colSpan={8} className="text-center text-gray-400 py-12">No customers found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile card list — shown on < md, hidden on md+ */}
      <div className="block md:hidden space-y-3">
        {isLoading ? (
          <LoadingSpinner />
        ) : data?.data.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No customers found</p>
        ) : (
          data?.data.map((c) => {
            const flagCount = c.qualityFlagCount ?? 0;
            return (
              <Link
                key={c.id}
                to={`/customers/${c.id}`}
                className="block bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm active:bg-gray-50"
              >
                {/* Row 1: Name + KYC badge */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-primary-700 truncate">
                    {c.firstName} {c.lastName}
                  </span>
                  <StatusBadge status={c.kycStatus} />
                </div>

                {/* Row 2: Location + Customer ID */}
                <p className="mt-1 text-xs text-gray-500">{c.village}, {c.county}</p>
                {(c.customerNumber || c.yaraCustomerId) && (
                  <p className="mt-0.5 font-mono text-xs text-gray-400">
                    {c.customerNumber ?? c.yaraCustomerId}
                  </p>
                )}

                {/* Row 3: AML badge + Loan count + Quality flags */}
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <StatusBadge status={c.amlStatus} />
                  <span className="text-xs text-gray-500">
                    {c._count?.loans ?? 0} loan{(c._count?.loans ?? 0) !== 1 ? 's' : ''}
                  </span>
                  {flagCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium bg-yellow-50 text-yellow-700 border-yellow-200">
                      <ShieldAlert className="h-3 w-3" />
                      {flagCount}
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.pagination.total)} of {data.pagination.total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="btn-secondary py-1.5 px-3 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage(page + 1)} disabled={page >= data.pagination.pages} className="btn-secondary py-1.5 px-3 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
