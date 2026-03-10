import { useState, useEffect } from 'react';
import { LogOut, Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';

const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/orders': 'Orders',
  '/forecast': 'Forecast',
  '/products': 'Products',
  '/categories': 'Categories',
  '/users': 'Collectors',
  '/branches': 'Branches',
  '/company': 'Company Profile',
};

function getPageLabel(pathname: string): string {
  if (pathname.startsWith('/orders/')) return 'Order Detail';
  if (pathname.startsWith('/products/') && pathname.endsWith('/edit')) return 'Edit Product';
  if (pathname === '/products/new') return 'New Product';
  return PAGE_LABELS[pathname] || 'Dashboard';
}

function LiveClock() {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="text-xs font-mono text-[#4b5e73] tabular-nums">{time}</span>
  );
}

export function Header() {
  const { user, signOut } = useAuth();
  const { toggle, isMobile } = useSidebar();
  const location = useLocation();
  const pageLabel = getPageLabel(location.pathname);

  return (
    <header className="bg-white border-b border-[#e2ecf9] px-4 h-10 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        {isMobile && (
          <button
            onClick={toggle}
            className="p-1 text-[#4b5e73] hover:text-[#0d1f35] rounded transition-colors"
          >
            <Menu size={18} />
          </button>
        )}
        <h2 className="text-sm font-semibold text-[#0d1f35]">{pageLabel}</h2>
      </div>
      <div className="flex items-center gap-4">
        <LiveClock />
        <div className="h-4 w-px bg-[#e2ecf9]" />
        <span className="text-xs text-[#4b5e73] hidden sm:inline font-medium">
          {user?.full_name || user?.email}
        </span>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-xs text-[#4b5e73] hover:text-[#0d1f35] transition-colors"
        >
          <LogOut size={13} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
