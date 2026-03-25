import React from 'react';
import { Link } from 'react-router-dom';
import { LogOut, LayoutGrid } from 'lucide-react';
import { useAuth } from '../App.jsx';
import { LogoFull } from './Logo.jsx';

export default function Layout({ children, title, navItems = [], appName, headerRight }) {
  const { logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-base">
      {/* ── Sidebar ── */}
      <aside
        className="w-[220px] flex flex-col shrink-0"
        style={{ background: 'rgba(10,10,24,0.98)', borderRight: '1px solid rgba(139,92,246,0.1)' }}
      >
        {/* Logo */}
        <div
          className="h-[58px] flex items-center px-5 shrink-0"
          style={{ borderBottom: '1px solid rgba(139,92,246,0.08)' }}
        >
          <Link to="/apps">
            <LogoFull size={24} />
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 overflow-y-auto space-y-0.5">
          <Link
            to="/apps"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-secondary hover:bg-white/[0.03] transition-all"
          >
            <LayoutGrid size={13} />
            All apps
          </Link>

          {appName && navItems.length > 0 && (
            <div className="pt-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted px-3 pb-1.5 truncate">
                {appName}
              </p>
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    item.active
                      ? 'text-text-primary bg-accent/[0.12]'
                      : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03]'
                  }`}
                >
                  <item.Icon size={13} className={item.active ? 'text-accent-light' : ''} />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </nav>

        {/* Sign out */}
        <div className="p-3" style={{ borderTop: '1px solid rgba(139,92,246,0.08)' }}>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-text-muted hover:text-danger transition-all font-mono"
          >
            <LogOut size={13} />
            sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {(title || headerRight) && (
          <div
            className="h-[58px] flex items-center justify-between px-6 shrink-0"
            style={{
              borderBottom: '1px solid rgba(139,92,246,0.08)',
              background: 'rgba(7,7,15,0.85)',
              backdropFilter: 'blur(16px)',
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}
          >
            {title && (
              <h1 className="text-text-primary font-semibold text-sm tracking-tight leading-none">
                {title}
              </h1>
            )}
            {headerRight && (
              <div className="flex items-center gap-2 ml-auto">
                {headerRight}
              </div>
            )}
          </div>
        )}
        <main className="flex-1 overflow-auto relative z-0">
          {children}
        </main>
      </div>
    </div>
  );
}

