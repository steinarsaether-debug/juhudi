import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useLocationPing } from '../../hooks/useLocationPing';

export default function Layout() {
  // Silently ping LO location every 30 min while the app is open
  useLocationPing('APP');

  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Auto-close mobile drawer whenever the user navigates to a new page
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuOpen={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
