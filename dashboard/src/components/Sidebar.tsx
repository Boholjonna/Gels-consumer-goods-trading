import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Building2,
  TrendingUp,
  BarChart3,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useSidebar } from '@/contexts/SidebarContext';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/forecast', label: 'Forecast', icon: TrendingUp },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/company', label: 'Company', icon: Building2 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { isOpen, isCollapsed, close, toggleCollapse, isMobile } = useSidebar();

  const sidebarContent = (
    <>
      {/* Logo / Brand */}
      <div
        className={clsx(
          'flex items-center mb-6',
          isCollapsed && !isMobile ? 'justify-center px-0' : 'justify-between px-1'
        )}
      >
        {(!isCollapsed || isMobile) && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#1a56db] flex items-center justify-center flex-shrink-0">
              <ShoppingCart size={14} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white leading-tight tracking-wide">POS Admin</h1>
              <p className="text-[10px] text-[#5b7da8] leading-tight">Order Management</p>
            </div>
          </div>
        )}
        {isCollapsed && !isMobile && (
          <div className="w-7 h-7 rounded-lg bg-[#1a56db] flex items-center justify-center">
            <ShoppingCart size={14} className="text-white" />
          </div>
        )}
        {isMobile ? (
          <button onClick={close} className="p-1.5 text-[#5b7da8] hover:text-white rounded-md hover:bg-[#132848] transition-colors">
            <X size={16} />
          </button>
        ) : (
          <button
            onClick={toggleCollapse}
            className="p-1.5 text-[#5b7da8] hover:text-white rounded-md hover:bg-[#132848] transition-colors"
          >
            {isCollapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
          </button>
        )}
      </div>

      {/* Nav section label */}
      {(!isCollapsed || isMobile) && (
        <p className="text-[10px] font-semibold text-[#3d5a7a] uppercase tracking-widest mb-2 px-2">
          Navigation
        </p>
      )}

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => isMobile && close()}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors',
                isCollapsed && !isMobile ? 'justify-center' : '',
                isActive
                  ? 'bg-[#1a56db] text-white shadow-sm'
                  : 'text-[#a8bdd4] hover:bg-[#132848] hover:text-white'
              )
            }
            title={isCollapsed && !isMobile ? item.label : undefined}
          >
            <item.icon size={16} className="flex-shrink-0" />
            {(!isCollapsed || isMobile) && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom divider */}
      {(!isCollapsed || isMobile) && (
        <div className="mt-4 pt-4 border-t border-[#1a2d4a]">
          <p className="text-[10px] text-[#3d5a7a] text-center">v1.0</p>
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <>
        {isOpen && (
          <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={close} />
        )}
        <aside
          className={clsx(
            'fixed inset-y-0 left-0 z-50 w-60 bg-[#0c1c35] text-white p-4 flex flex-col transition-transform duration-200',
            isOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  return (
    <aside
      className={clsx(
        'bg-[#0c1c35] text-white min-h-screen p-3 flex flex-col transition-all duration-200 flex-shrink-0',
        isCollapsed ? 'w-[52px]' : 'w-[200px]'
      )}
    >
      {sidebarContent}
    </aside>
  );
}
