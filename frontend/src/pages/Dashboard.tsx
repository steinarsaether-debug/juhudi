import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users, CreditCard, AlertTriangle, Clock, TrendingUp, CheckCircle,
  Gavel, PhoneCall, BarChart2,
} from 'lucide-react';
import { loanApi, customerApi } from '../services/api';
import { DashboardStats, Customer, LoanApplication, PortfolioStatsLo, PortfolioStatsBranch, LoBreakdown } from '../types';
import { useAuthStore } from '../store/authStore';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import WeatherWidget, { WeatherAlertStrip, AllBranchWeatherBadge } from '../components/weather/WeatherWidget';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatKes(amount: number): string {
  if (amount >= 1_000_000) return `KES ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `KES ${(amount / 1_000).toFixed(0)}K`;
  return `KES ${amount.toLocaleString()}`;
}

function StatCard({ icon: Icon, label, value, sub, color = 'green', to }: {
  icon: typeof Users; label: string; value: string | number; sub?: string;
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'orange'; to?: string;
}) {
  const colors = {
    green:  'bg-primary-50  text-primary-700',
    yellow: 'bg-yellow-50   text-yellow-700',
    red:    'bg-red-50      text-red-700',
    blue:   'bg-blue-50     text-blue-700',
    orange: 'bg-orange-50   text-orange-700',
  };
  const content = (
    <div className="card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

// ── LO Portfolio ──────────────────────────────────────────────────────────────

function LoPortfolioWidget() {
  const { data: portfolio, isLoading } = useQuery<PortfolioStatsLo>({
    queryKey: ['portfolio'],
    queryFn: loanApi.portfolio,
    refetchInterval: 60_000,
  });

  if (isLoading || !portfolio) return null;

  return (
    <>
      <h2 className="text-base font-semibold text-gray-700 mb-3">My Portfolio</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users}         label="My Customers"      value={portfolio.myCustomers}        to="/customers" />
        <StatCard icon={CreditCard}    label="My Active Loans"   value={portfolio.myActiveLoans}       to="/loans?status=ACTIVE" />
        <StatCard icon={AlertTriangle} label="In Arrears"        value={portfolio.myArrears}           color="red" to="/collections" />
        <StatCard
          icon={TrendingUp}
          label="My Portfolio"
          value={formatKes(portfolio.myPortfolioOutstandingKes)}
          sub={`PAR 30d: ${portfolio.par30Rate}%`}
          color={parseFloat(portfolio.par30Rate) > 5 ? 'red' : 'green'}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 mb-6">
        <StatCard icon={Clock}   label="Pending Applications" value={portfolio.myPendingApps} color="yellow" to="/loans?status=SUBMITTED" />
        {portfolio.pendingBccVotes > 0 && (
          <StatCard
            icon={Gavel}
            label="BCC — Awaiting My Vote"
            value={portfolio.pendingBccVotes}
            color="orange"
            to="/bcc?status=OPEN"
          />
        )}
      </div>
    </>
  );
}

// ── Branch Manager Portfolio ───────────────────────────────────────────────────

function BranchPortfolioWidget() {
  const { data: portfolio, isLoading } = useQuery<PortfolioStatsBranch>({
    queryKey: ['portfolio'],
    queryFn: loanApi.portfolio,
    refetchInterval: 60_000,
  });

  if (isLoading || !portfolio) return null;

  return (
    <>
      <h2 className="text-base font-semibold text-gray-700 mb-3">Branch Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
        <StatCard icon={Users}         label="Customers"        value={portfolio.totalCustomers}          to="/customers" />
        <StatCard icon={CreditCard}    label="Active Loans"     value={portfolio.activeLoans}              to="/loans?status=ACTIVE" />
        <StatCard icon={Clock}         label="Pending Review"   value={portfolio.pendingApps}  color="yellow" to="/loans?status=SUBMITTED" />
        <StatCard icon={AlertTriangle} label="In Arrears"       value={portfolio.inArrears}    color="red"    to="/collections" />
        <StatCard icon={Gavel}         label="Open BCC"         value={portfolio.openBccSessions} color="orange" to="/bcc?status=OPEN" />
        <StatCard
          icon={TrendingUp}
          label="Portfolio"
          value={formatKes(portfolio.portfolioOutstandingKes)}
          sub={`PAR 30d: ${portfolio.par30Rate}%`}
          color={parseFloat(portfolio.par30Rate) > 5 ? 'red' : 'green'}
        />
      </div>

      {/* Per-LO breakdown */}
      {portfolio.loBreakdown?.length > 0 && (
        <div className="card mb-6">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
            <BarChart2 className="h-4 w-4 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Loan Officer Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-50">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Officer</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Customers</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Active Loans</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">In Arrears</th>
                  <th className="hidden lg:table-cell px-4 py-2.5 text-right text-xs font-medium text-gray-500">Portfolio</th>
                  <th className="hidden lg:table-cell px-4 py-2.5 text-right text-xs font-medium text-gray-500">PAR</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {portfolio.loBreakdown.map((lo: LoBreakdown) => (
                  <tr key={lo.officerId} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{lo.officerName}</td>
                    <td className="px-4 py-2.5 text-sm text-right text-gray-700">{lo.customers}</td>
                    <td className="px-4 py-2.5 text-sm text-right text-gray-700">{lo.activeLoans}</td>
                    <td className="px-4 py-2.5 text-sm text-right">
                      <span className={lo.inArrears > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                        {lo.inArrears}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-4 py-2.5 text-sm text-right text-gray-700">{formatKes(lo.portfolioKes)}</td>
                    <td className="hidden lg:table-cell px-4 py-2.5 text-sm text-right">
                      <span className={parseFloat(lo.parRate) > 5 ? 'text-red-600 font-medium' : 'text-green-600'}>
                        {lo.parRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuthStore();
  const isLo     = user?.role === 'LOAN_OFFICER';
  const isBm     = user?.role === 'BRANCH_MANAGER' || user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const isAdmin  = user?.role === 'ADMIN';
  const branchId = user?.branchId;

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['stats'],
    queryFn: loanApi.stats,
    refetchInterval: 60_000,
  });

  const { data: recentCustomers } = useQuery({
    queryKey: ['customers', 'recent'],
    queryFn: () => customerApi.list({ limit: 5, page: 1 }),
  });

  const { data: pendingApps } = useQuery({
    queryKey: ['applications', 'pending'],
    queryFn: () => loanApi.listApplications({ status: 'SUBMITTED', limit: 5 }),
  });

  if (statsLoading) return <LoadingSpinner />;

  const s = stats!;
  const parRatio = s.portfolioPrincipalKes > 0
    ? ((s.overdueLoans / Math.max(s.activeLoans, 1)) * 100).toFixed(1)
    : '0.0';

  return (
    <div>
      {/* ── Weather alerts for branch personnel ─────────────────────────────── */}
      {!isAdmin && branchId && <WeatherAlertStrip branchId={branchId} />}

      {/* Role-aware portfolio widget */}
      {isLo  && <LoPortfolioWidget />}
      {isBm  && <BranchPortfolioWidget />}

      {/* Admin weather badge — compact count card linking to branch listing */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <AllBranchWeatherBadge />
        </div>
      )}

      {/* Fallback legacy KPIs */}
      {!isLo && !isBm && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <StatCard icon={Users}         label="Total Customers"  value={s.totalCustomers}    to="/customers" />
          <StatCard icon={Clock}         label="Pending KYC"      value={s.pendingKyc}         color="yellow" to="/customers?kycStatus=PENDING" />
          <StatCard icon={CreditCard}    label="Active Loans"     value={s.activeLoans}         to="/loans?status=ACTIVE" />
          <StatCard icon={CheckCircle}   label="Pending Review"   value={s.pendingApplications} color="blue" to="/loans?status=SUBMITTED" />
          <StatCard icon={AlertTriangle} label="Overdue (>30d)"   value={s.overdueLoans}        color="red" />
          <StatCard
            icon={TrendingUp}
            label="Portfolio (Outstanding)"
            value={formatKes(s.portfolioOutstandingKes)}
            sub={`PAR 30d: ${parRatio}%`}
            color="green"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent customers */}
        <div className="card">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Customers</h2>
            <Link to="/customers" className="text-xs text-primary-700 hover:underline">View all</Link>
          </div>
          <div>
            {(recentCustomers?.data as Customer[] ?? []).map((c) => (
              <Link
                key={c.id}
                to={`/customers/${c.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.firstName} {c.lastName}</p>
                  <p className="text-xs text-gray-500">{c.village}, {c.county}</p>
                </div>
                <StatusBadge status={c.kycStatus} />
              </Link>
            ))}
            {!recentCustomers?.data?.length && (
              <p className="px-5 py-8 text-sm text-center text-gray-400">No customers yet</p>
            )}
          </div>
        </div>

        {/* Pending applications */}
        <div className="card">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">Pending Applications</h2>
              {isBm && (
                <Link to="/bcc" className="flex items-center gap-1 text-xs text-orange-600 hover:underline ml-1">
                  <Gavel className="h-3 w-3" /> BCC
                </Link>
              )}
            </div>
            <Link to="/loans" className="text-xs text-primary-700 hover:underline">View all</Link>
          </div>
          <div>
            {(pendingApps?.data as LoanApplication[] ?? []).map((a) => (
              <Link
                key={a.id}
                to={`/loans/${a.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {a.customer?.firstName} {a.customer?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">
                    KES {a.requestedAmountKes.toLocaleString()} &bull; {a.termMonths} months
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </Link>
            ))}
            {!pendingApps?.data?.length && (
              <p className="px-5 py-8 text-sm text-center text-gray-400">No pending applications</p>
            )}
          </div>
        </div>

        {/* Weather widget — full forecast for the user's branch */}
        {branchId && (
          <div className="lg:col-span-2">
            <WeatherWidget branchId={branchId} />
          </div>
        )}

        {/* Collections alert (visible to all) */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-red-500" />
              <h2 className="font-semibold text-gray-900">Collections — Day 1+ Arrears</h2>
            </div>
            <Link to="/collections" className="text-xs text-primary-700 hover:underline">Manage →</Link>
          </div>
          <div className="px-5 py-4 text-sm text-gray-500">
            <p>Log calls, visits, and promises to pay. Every day in arrears matters — start on day 1.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
