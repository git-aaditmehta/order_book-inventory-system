import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  BookOpen, Package, Gem, History, AlertTriangle, 
  BarChart3, Shield, LogOut, Menu, X 
} from 'lucide-react';
import type { UserRole } from '../types';

interface LayoutProps {
  userRole: UserRole;
  userEmail: string;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ userRole, userEmail, onLogout }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Order Book', path: '/order-book', icon: BookOpen, roles: ['OWNER', 'MANAGER'] },
    { label: 'Raw Materials', path: '/raw-materials', icon: Package, roles: ['OWNER', 'MANAGER'] },
    { label: 'Jewelry Catalog', path: '/jewelry', icon: Gem, roles: ['OWNER', 'MANAGER'] },
    { label: 'Order History', path: '/history', icon: History, roles: ['OWNER', 'MANAGER'] },
    { label: 'Low Stock', path: '/low-stock', icon: AlertTriangle, roles: ['OWNER', 'MANAGER'] },
    { label: 'Insights & PDF', path: '/insights', icon: BarChart3, roles: ['OWNER'] },
    { label: 'Security Panel', path: '/security', icon: Shield, roles: ['OWNER'] },
  ];

  const allowedNavItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--color-paper)] text-[var(--color-text-main)]">
      
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-[var(--color-paper-card)] border-b border-[var(--color-border)] sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Gem className="w-6 h-6 text-[var(--color-accent)]" />
          <span className="font-bold text-lg tracking-tight">Luxe Craft</span>
          <span className={userRole === 'OWNER' ? 'badge-gold' : 'badge-muted'}>
            {userRole}
          </span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-white"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Sidebar Navigation for Desktop */}
      <aside className="hidden md:flex flex-col w-64 p-5 bg-[var(--color-paper-card)] border-r border-[var(--color-border)] min-h-screen justify-between">
        <div>
          {/* Logo & Role Badge */}
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-paper)] border border-[var(--color-border)] flex items-center justify-center">
                <Gem className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
              <div>
                <h1 className="font-bold text-base leading-snug tracking-tight">Luxe Craft</h1>
                <p className="text-xs text-[var(--color-text-muted)] truncate max-w-[120px]">{userEmail}</p>
              </div>
            </div>
            <span className={userRole === 'OWNER' ? 'badge-gold' : 'badge-muted'}>
              {userRole}
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {allowedNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }: { isActive: boolean }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                      isActive
                        ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] font-semibold shadow'
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-paper-card-hover)] hover:text-[var(--color-text-main)]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer Logout */}
        <div className="pt-4 border-t border-[var(--color-border)]">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-950/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Slide-Out Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/70 flex flex-col justify-between p-6 bg-[var(--color-paper-card)] animate-fadeIn">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)] mb-6">
              <div>
                <span className="font-bold text-lg">Luxe Craft</span>
                <p className="text-xs text-[var(--color-text-muted)]">{userEmail}</p>
              </div>
              <span className={userRole === 'OWNER' ? 'badge-gold' : 'badge-muted'}>
                {userRole}
              </span>
            </div>
            <nav className="space-y-2">
              {allowedNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }: { isActive: boolean }) =>
                      `flex items-center gap-4 px-4 py-3 rounded-lg font-medium text-base ${
                        isActive
                          ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)]'
                          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-paper-card-hover)]'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
          <button
            onClick={() => { setMobileMenuOpen(false); onLogout(); }}
            className="flex items-center justify-center gap-2 py-3 rounded-lg bg-red-950/50 text-red-400 font-semibold border border-red-800/40"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full pb-20 md:pb-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-[var(--color-paper-card)] border-t border-[var(--color-border)] flex justify-around p-2">
        {allowedNavItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }: { isActive: boolean }) =>
                `flex flex-col items-center gap-1 p-2 rounded-lg text-xs ${
                  isActive ? 'text-[var(--color-accent)] font-bold' : 'text-[var(--color-text-muted)]'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
