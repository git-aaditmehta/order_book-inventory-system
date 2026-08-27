import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  BookOpen, Package, Gem, History, AlertTriangle, 
  BarChart3, Shield, LogOut, Menu, X, ChevronRight
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
    { label: 'Order Book',      path: '/order-book',    icon: BookOpen,      roles: ['OWNER', 'MANAGER'] },
    { label: 'Raw Materials',   path: '/raw-materials', icon: Package,       roles: ['OWNER', 'MANAGER'] },
    { label: 'Jewelry Catalog', path: '/jewelry',       icon: Gem,           roles: ['OWNER', 'MANAGER'] },
    { label: 'Order History',   path: '/history',       icon: History,       roles: ['OWNER', 'MANAGER'] },
    { label: 'Low Stock',       path: '/low-stock',     icon: AlertTriangle, roles: ['OWNER', 'MANAGER'] },
    { label: 'Insights & PDF',  path: '/insights',      icon: BarChart3,     roles: ['OWNER'] },
    { label: 'Security Panel',  path: '/security',      icon: Shield,        roles: ['OWNER'] },
  ];

  const allowedNavItems = navItems.filter(item => item.roles.includes(userRole));

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--color-paper)', overflow: 'hidden' }}>

      {/* ── Mobile Top Header ── */}
      <header
        className="md:hidden"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--space-4)',
          height: '60px',
          background: 'var(--color-card)',
          borderBottom: `1px solid var(--color-border)`,
          position: 'sticky',
          top: 0,
          zIndex: 30,
          boxShadow: '0 1px 6px oklch(18% 0.010 75 / 0.07)',
        }}
      >
        {/* Hamburger button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-ink-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-sm)',
            minWidth: 44,
            minHeight: 44,
          }}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          <Menu style={{ width: 22, height: 22 }} />
        </button>

        {/* Brand — centred */}
        <span style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          fontWeight: 800,
          fontSize: '1.0625rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--color-ink)',
        }}>
          Luxe Craft
        </span>

        {/* Role avatar */}
        <div style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: 'var(--color-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-accent-text)',
          fontWeight: 800,
          fontSize: '0.8125rem',
          letterSpacing: '0.03em',
          flexShrink: 0,
        }}>
          {userRole === 'OWNER' ? 'OW' : 'MG'}
        </div>
      </header>

      {/* ── Desktop Layout ── */}
      <div style={{ display: 'flex', flex: 1 }}>

        {/* ── Desktop Sidebar ── */}
        <aside
          className="hidden md:flex"
          style={{
            flexDirection: 'column',
            width: 240,
            padding: 'var(--space-6)',
            background: 'var(--color-card)',
            borderRight: `1px solid var(--color-border)`,
            minHeight: '100svh',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            alignSelf: 'flex-start',
            maxHeight: '100svh',
            overflowY: 'auto',
            flexShrink: 0,
            boxShadow: '2px 0 12px oklch(18% 0.010 75 / 0.04)',
          }}
        >
          <div>
            {/* Brand */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 'var(--space-6)',
              marginBottom: 'var(--space-5)',
              borderBottom: `1px solid var(--color-border)`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                  width: 38, height: 38,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Gem style={{ width: 18, height: 18, color: 'var(--color-accent-text)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h1 style={{
                    fontWeight: 800,
                    fontSize: '0.9375rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--color-ink)',
                    lineHeight: 1.1,
                  }}>
                    Luxe Craft
                  </h1>
                  <p style={{
                    fontSize: '0.6875rem',
                    color: 'var(--color-ink-3)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 130,
                    marginTop: 2,
                  }}>
                    {userEmail}
                  </p>
                </div>
              </div>
              <span className={userRole === 'OWNER' ? 'badge-accent' : 'badge-muted'}>
                {userRole}
              </span>
            </div>

            {/* Nav */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {allowedNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    style={({ isActive }: { isActive: boolean }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: '0.5625rem var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.9375rem',
                      textDecoration: 'none',
                      color: isActive ? 'var(--color-accent-text)' : 'var(--color-ink-2)',
                      background: isActive ? 'var(--color-accent)' : 'transparent',
                      transition: `background ${100}ms, color ${100}ms`,
                      minHeight: 44,
                    })}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      if (el.getAttribute('aria-current') !== 'page') {
                        el.style.background = 'var(--color-paper-2)';
                        el.style.color = 'var(--color-ink)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      if (el.getAttribute('aria-current') !== 'page') {
                        el.style.background = 'transparent';
                        el.style.color = 'var(--color-ink-2)';
                      }
                    }}
                  >
                    <Icon style={{ width: 17, height: 17, flexShrink: 0 }} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Sign out */}
          <div style={{ paddingTop: 'var(--space-5)', borderTop: `1px solid var(--color-border)`, marginTop: 'var(--space-4)' }}>
            <button
              onClick={onLogout}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: '0.5625rem var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9375rem',
                fontWeight: 500,
                color: 'var(--color-danger)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                minHeight: 44,
                transition: `background ${100}ms`,
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-danger-bg)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <LogOut style={{ width: 17, height: 17 }} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main
          style={{
            flex: 1,
            padding: 'var(--space-5) var(--space-4)',
            maxWidth: '1200px',
            width: '100%',
            /* Extra bottom pad on mobile for bottom nav */
            paddingBottom: 'calc(var(--space-5) + 76px)',
          }}
          className="md:!pb-8 md:!p-8"
        >
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Slide-Out Drawer ── */}
      {mobileMenuOpen && (
        <div
          className="md:hidden animate-fadeIn"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: 'oklch(18% 0.010 75 / 0.40)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
          }}
          onClick={closeMobileMenu}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: 'min(288px, 84vw)',
              background: 'var(--color-card)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              boxShadow: '4px 0 24px oklch(18% 0.010 75 / 0.14)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--space-5)',
              borderBottom: `1px solid var(--color-border)`,
              position: 'sticky',
              top: 0,
              background: 'var(--color-card)',
              zIndex: 1,
            }}>
              <div>
                <p style={{ fontWeight: 800, fontSize: '0.9375rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-ink)' }}>
                  Luxe Craft
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', marginTop: 2 }}>{userEmail}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className={userRole === 'OWNER' ? 'badge-accent' : 'badge-muted'}>{userRole}</span>
                <button
                  onClick={closeMobileMenu}
                  style={{
                    background: 'var(--color-paper-2)',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-ink-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-sm)',
                    minWidth: 36,
                    minHeight: 36,
                  }}
                  aria-label="Close menu"
                >
                  <X style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>

            {/* Nav links */}
            <nav style={{ display: 'flex', flexDirection: 'column', padding: 'var(--space-3) var(--space-3)', gap: 2, flex: 1 }}>
              {allowedNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={closeMobileMenu}
                    style={({ isActive }: { isActive: boolean }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-3) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '1rem',
                      textDecoration: 'none',
                      color: isActive ? 'var(--color-accent-text)' : 'var(--color-ink)',
                      background: isActive ? 'var(--color-accent)' : 'transparent',
                      minHeight: 52,
                    })}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <Icon style={{ width: 20, height: 20, flexShrink: 0 }} />
                      <span>{item.label}</span>
                    </span>
                    <ChevronRight style={{ width: 16, height: 16, opacity: 0.35 }} />
                  </NavLink>
                );
              })}
            </nav>

            {/* Sign out */}
            <div style={{ padding: 'var(--space-4) var(--space-4)', borderTop: `1px solid var(--color-border)` }}>
              <button
                onClick={() => { closeMobileMenu(); onLogout(); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--color-danger)',
                  background: 'var(--color-danger-bg)',
                  border: '1.5px solid oklch(50% 0.18 25 / 0.20)',
                  cursor: 'pointer',
                  minHeight: 52,
                  fontFamily: 'var(--font-body)',
                }}
              >
                <LogOut style={{ width: 18, height: 18 }} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Bottom Navigation Bar ── */}
      <nav
        className="md:hidden"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          background: 'var(--color-card)',
          borderTop: `1px solid var(--color-border)`,
          display: 'flex',
          justifyContent: 'space-around',
          padding: '0.375rem 0',
          paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -4px 16px oklch(18% 0.010 75 / 0.07)',
        }}
      >
        {allowedNavItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }: { isActive: boolean }) => ({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '0.375rem 0.5rem',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                color: isActive ? 'var(--color-accent)' : 'var(--color-ink-3)',
                minWidth: 52,
                minHeight: 48,
                justifyContent: 'center',
              })}
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <Icon style={{ width: 22, height: 22 }} />
                  <span style={{
                    fontSize: '0.625rem',
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.01em',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                  }}>
                    {item.label.split(' ')[0]}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
