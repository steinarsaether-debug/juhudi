import { useLocation, Link } from 'react-router-dom';
import { UserPlus, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import NotificationBell from './NotificationBell';

const breadcrumbs: Record<string, string> = {
  '/': 'Dashboard',
  '/customers': 'Customers',
  '/customers/new': 'New Customer',
  '/loans': 'Loan Applications',
};

export default function Header({ onMenuOpen }: { onMenuOpen: () => void }) {
  const { pathname } = useLocation();
  const { user } = useAuthStore();
  const title = breadcrumbs[pathname] ?? 'Juhudi Kilimo';
  const today = new Date().toLocaleDateString('en-KE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-4">
      {/* Hamburger — hidden on desktop where sidebar is always visible */}
      <button
        onClick={onMenuOpen}
        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-500 mt-0.5">{today}</p>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        {(user?.role === 'LOAN_OFFICER' || user?.role === 'BRANCH_MANAGER' || user?.role === 'ADMIN') && (
          <Link to="/customers/new" className="btn-primary text-xs">
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Onboard Customer</span>
          </Link>
        )}
      </div>
    </header>
  );
}
