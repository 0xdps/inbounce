import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Inbox, ChevronRight, Loader } from 'lucide-react';
import Layout from '../components/Layout.js';
import { api } from '../lib/api.js';

function formatDate(ts) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function CreateModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [origins, setOrigins] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const allowed_origins = origins
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
      const app = await api.createApp({ name: name.trim(), description: description.trim() || undefined, allowed_origins });
      onCreate(app);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(139,92,246,0.14)',
    transition: 'border-color 0.15s',
  };
  const inputFocus = (e) => { e.target.style.borderColor = 'rgba(139,92,246,0.42)'; e.target.style.outline = 'none'; };
  const inputBlur = (e) => { e.target.style.borderColor = 'rgba(139,92,246,0.14)'; };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-elevated rounded-2xl p-7"
        style={{ border: '1px solid rgba(139,92,246,0.18)', boxShadow: '0 0 0 4px rgba(124,58,237,0.06), 0 32px 80px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-text-primary font-semibold text-base mb-5">New app</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-text-muted text-xs font-mono uppercase tracking-widest mb-1.5">Name <span className="text-danger">*</span></label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Waitlist"
              className="w-full rounded-lg px-3.5 py-2.5 text-text-primary text-sm placeholder-text-muted"
              style={inputStyle}
              onFocus={inputFocus} onBlur={inputBlur}
            />
          </div>
          <div>
            <label className="block text-text-muted text-xs font-mono uppercase tracking-widest mb-1.5">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full rounded-lg px-3.5 py-2.5 text-text-primary text-sm placeholder-text-muted"
              style={inputStyle}
              onFocus={inputFocus} onBlur={inputBlur}
            />
          </div>
          <div>
            <label className="block text-text-muted text-xs font-mono uppercase tracking-widest mb-1.5">
              Allowed origins <span className="text-text-muted normal-case tracking-normal">(comma-separated, empty = all)</span>
            </label>
            <input
              value={origins}
              onChange={(e) => setOrigins(e.target.value)}
              placeholder="https://mysite.com, https://other.com"
              className="w-full rounded-lg px-3.5 py-2.5 text-text-primary text-sm placeholder-text-muted font-mono"
              style={inputStyle}
              onFocus={inputFocus} onBlur={inputBlur}
            />
          </div>
          {error && <p className="text-danger text-xs font-mono">{error}</p>}
          <div className="flex gap-2.5 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
            >
              {loading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Apps() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.getApps()
      .then(setApps)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout
      title="Apps"
      headerRight={
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-all"
          style={{ boxShadow: '0 0 14px rgba(124,58,237,0.3)' }}
        >
          <Plus size={13} strokeWidth={2.5} />
          New app
        </button>
      }
    >
      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-text-muted">
            <Loader size={16} className="animate-spin mr-2.5" />
            <span className="text-xs font-mono">Loading…</span>
          </div>
        ) : apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(139,92,246,0.14)' }}
            >
              <Inbox size={20} className="text-accent-light" />
            </div>
            <p className="text-text-secondary font-semibold text-sm">No apps yet</p>
            <p className="text-text-muted text-xs mt-1.5 max-w-xs">Create your first app to get a form endpoint and start collecting submissions.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-5 flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-all"
            >
              <Plus size={12} strokeWidth={2.5} /> New app
            </button>
          </div>
        ) : (
          <div className="grid gap-2.5">
            {apps.map((app) => (
              <button
                key={app.id}
                onClick={() => navigate(`/apps/${app.id}`)}
                className="w-full text-left bg-elevated rounded-xl px-5 py-4 flex items-center justify-between group transition-all hover:bg-surface relative overflow-hidden"
                style={{ border: '1px solid rgba(139,92,246,0.12)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.28)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.12)'}
              >
                {/* Left accent bar on hover */}
                <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(to bottom, #7c3aed, transparent)' }} />
                <div className="min-w-0 flex-1 pl-1">
                  <p className="text-text-primary font-semibold text-sm tracking-tight">{app.name}</p>
                  {app.description && (
                    <p className="text-text-muted text-xs mt-0.5 truncate max-w-md">{app.description}</p>
                  )}
                  <p className="text-text-muted text-xs mt-2.5 font-mono">Created {formatDate(app.created_at)}</p>
                </div>
                <div className="flex items-center gap-6 shrink-0 ml-6">
                  <div className="text-right">
                    <p className="text-xl font-bold tabular-nums text-text-primary leading-none">
                      {(app.submission_count ?? 0).toLocaleString()}
                    </p>
                    <p className="text-text-muted text-xs mt-1">submission{app.submission_count !== 1 ? 's' : ''}</p>
                  </div>
                  <ChevronRight size={15} className="text-text-muted group-hover:text-accent-light transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={(app) => setApps((prev) => [app, ...prev])}
        />
      )}
    </Layout>
  );
}
