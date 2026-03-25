import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, Zap } from 'lucide-react';
import { useAuth } from '../App.jsx';

export default function Layout({ children, title, back }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-base">
      {/* Topbar */}
      <header className="flex items-center justify-between px-6 h-12 border-b border-border bg-elevated shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/apps" className="flex items-center gap-2 text-text-primary font-semibold tracking-tight hover:text-accent transition-colors">
            <Zap size={16} className="text-accent" />
            inbounce
          </Link>
          {back && (
            <>
              <span className="text-text-muted">/</span>
              <button
                onClick={() => navigate(back.href)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                {back.label}
              </button>
            </>
          )}
          {title && (
            <>
              <span className="text-text-muted">/</span>
              <span className="text-text-primary">{title}</span>
            </>
          )}
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-text-muted hover:text-danger transition-colors text-xs"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
