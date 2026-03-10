import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, CreditCard,
  LogOut, Leaf, BarChart2, Map, Gavel, PhoneCall, ShieldAlert,
  UserCog, Building2, ClipboardList, MapPin, UsersRound, Smartphone,
  History, TrendingUp, ListChecks, SlidersHorizontal, X,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useQuery } from '@tanstack/react-query';
import { bccApi, qualityApi } from '../../services/api';
import clsx from 'clsx';

function AdminNavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive ? 'bg-primary-700 text-white' : 'text-primary-200 hover:bg-primary-800 hover:text-white',
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="pt-4 pb-1 px-3">
      <p className="text-xs font-semibold text-primary-400 uppercase tracking-wider">{label}</p>
    </div>
  );
}

/** Role-aware portal subtitle shown under the logo */
function portalSubtitle(role?: string): string {
  switch (role) {
    case 'ADMIN':           return 'Admin Console';
    case 'BRANCH_MANAGER':  return 'Branch Manager Portal';
    case 'SUPERVISOR':      return 'Supervisor Portal';
    default:                return 'Loan Officer Portal';
  }
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuthStore();

  const { data: bccData } = useQuery({
    queryKey: ['bcc', 'OPEN', 1],
    queryFn: () => bccApi.list({ status: 'OPEN', limit: 1 }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const openBccCount: number = bccData?.pagination?.total ?? 0;

  const canSeeQuality = ['BRANCH_MANAGER', 'ADMIN', 'SUPERVISOR'].includes(user?.role ?? '');
  const { data: qualityData } = useQuery({
    queryKey: ['qualityReport', 'sidebar'],
    queryFn: () => qualityApi.report(),
    enabled: canSeeQuality,
    refetchInterval: 300_000,
    staleTime: 120_000,
  });
  const criticalFlagCount: number = (qualityData as { bySeverity?: { CRITICAL?: number } } | undefined)?.bySeverity?.CRITICAL ?? 0;

  // BM/SUP see all branch follow-ups; LO sees only their own
  const isLO = user?.role === 'LOAN_OFFICER';
  const worklistLabel = isLO ? 'My Worklist' : 'Branch Worklist';

  function NavItem({
    to, icon: Icon, label, badge, exact,
  }: { to: string; icon: React.ElementType; label: string; badge?: number; exact?: boolean }) {
    return (
      <NavLink
        to={to}
        end={exact}
        className={({ isActive }) =>
          clsx(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            isActive ? 'bg-primary-700 text-white' : 'text-primary-200 hover:bg-primary-800 hover:text-white',
          )
        }
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <span className="text-xs bg-orange-500 text-white rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center leading-none">
            {badge}
          </span>
        )}
      </NavLink>
    );
  }

  return (
    <>
      {/* Backdrop — mobile only, visible when drawer is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      <aside className={[
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-primary-900 text-white',
        'transition-transform duration-300 ease-in-out',
        'lg:static lg:z-auto lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}>

      {/* Close button — only visible in mobile drawer */}
      <button
        onClick={onClose}
        className="absolute right-3 top-3 rounded-md p-1.5 text-primary-300 hover:bg-primary-800 hover:text-white lg:hidden"
        aria-label="Close menu"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-primary-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600">
          <Leaf className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">Juhudi Kilimo</p>
          <p className="text-xs text-primary-300">{portalSubtitle(user?.role)}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">

        {/* Top-level */}
        <NavItem to="/" icon={LayoutDashboard} label="Dashboard" exact />

        {/* ── Customer Lifecycle ── */}
        <SectionLabel label="Customer Lifecycle" />
        <NavItem to="/customers"   icon={Users}         label="Customers" />
        <NavItem to="/interviews"  icon={ClipboardList} label="Interviews" />
        <NavItem to="/groups"      icon={UsersRound}    label="Groups" />

        {/* ── Lending ── */}
        <SectionLabel label="Lending" />
        <NavItem to="/loans"       icon={CreditCard}    label="Loan Applications" />
        <NavItem to="/bcc"         icon={Gavel}         label="BCC" badge={openBccCount} />

        {/* ── Portfolio ── */}
        <SectionLabel label="Portfolio" />
        <NavItem to="/worklist"    icon={ListChecks}    label={worklistLabel} />
        <NavItem to="/collections" icon={PhoneCall}     label="Collections" />
        <NavItem to="/benchmarks"  icon={BarChart2}     label="Benchmarks" />

        {/* Field Tools — LO and Supervisor only (BM uses location map instead) */}
        {['LOAN_OFFICER', 'SUPERVISOR'].includes(user?.role ?? '') && (
          <NavItem to="/field" icon={Map} label="Field Tools" />
        )}

        {/* ── Oversight (SUP / BM / ADMIN) ── */}
        {['ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR'].includes(user?.role ?? '') && (
          <>
            <SectionLabel label="Oversight" />
            <NavLink
              to="/quality"
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary-700 text-white' : 'text-primary-200 hover:bg-primary-800 hover:text-white',
                )
              }
            >
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">Data Quality</span>
              {criticalFlagCount > 0 && (
                <span className="text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center leading-none">
                  {criticalFlagCount}
                </span>
              )}
            </NavLink>
          </>
        )}

        {/* ── Administration (BM / ADMIN) ── */}
        {['ADMIN', 'BRANCH_MANAGER'].includes(user?.role ?? '') && (
          <>
            <SectionLabel label="Administration" />
            {user?.role === 'ADMIN' && (
              <>
                <AdminNavLink to="/admin/users"            icon={<UserCog     className="h-4 w-4 flex-shrink-0" />} label="Users" />
                <AdminNavLink to="/admin/branches"         icon={<Building2   className="h-4 w-4 flex-shrink-0" />} label="Branches" />
                <AdminNavLink to="/admin/mpesa"            icon={<Smartphone  className="h-4 w-4 flex-shrink-0" />} label="M-Pesa AI" />
                <AdminNavLink to="/admin/ilp-eligibility"  icon={<TrendingUp  className="h-4 w-4 flex-shrink-0" />} label="ILP Eligibility" />
              </>
            )}
            <AdminNavLink to="/admin/bcc-analytics" icon={<BarChart2         className="h-4 w-4 flex-shrink-0" />} label="BCC Analytics" />
            <AdminNavLink to="/admin/activity"  icon={<History            className="h-4 w-4 flex-shrink-0" />} label="Activity Log" />
            <AdminNavLink to="/admin/locations" icon={<MapPin             className="h-4 w-4 flex-shrink-0" />} label="LO Locations" />
            {user?.role === 'ADMIN' && (
              <AdminNavLink to="/admin/config" icon={<SlidersHorizontal className="h-4 w-4 flex-shrink-0" />} label="System Config" />
            )}
          </>
        )}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-primary-800 px-4 py-4">
        <div className="mb-3 px-1">
          <p className="text-sm font-medium text-white">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-primary-300 capitalize">{user?.role?.toLowerCase().replace('_', ' ')}</p>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary-300 hover:bg-primary-800 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
      </aside>
    </>
  );
}
