import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Inbox, ChevronRight, Loader } from 'lucide-react';
import Layout from '../components/Layout.jsx';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-elevated border border-border rounded-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-text-primary font-semibold mb-4">New app</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-text-secondary text-xs mb-1.5">Name <span className="text-danger">*</span></label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Waitlist"
              className="w-full bg-overlay border border-border rounded-md px-3 py-2 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-text-secondary text-xs mb-1.5">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full bg-overlay border border-border rounded-md px-3 py-2 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-text-secondary text-xs mb-1.5">Allowed origins <span className="text-text-muted">(comma-separated, empty = all)</span></label>
            <input
              value={origins}
              onChange={(e) => setOrigins(e.target.value)}
              placeholder="https://mysite.com, https://other.com"
              className="w-full bg-overlay border border-border rounded-md px-3 py-2 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent transition-colors font-mono"
            />
          </div>
          {error && <p className="text-danger text-xs">{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-40"
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
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-text-primary font-semibold text-base">Apps</h1>
            <p className="text-text-muted text-xs mt-0.5">Each app is a form endpoint with its own schema and API key.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
          >
            <Plus size={14} />
            New app
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-text-muted">
            <Loader size={18} className="animate-spin mr-2" /> Loading…
          </div>
        ) : apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Inbox size={32} className="text-text-muted mb-3" />
            <p className="text-text-secondary font-medium">No apps yet</p>
            <p className="text-text-muted text-xs mt-1">Create your first app to get a form endpoint</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {apps.map((app) => (
              <button
                key={app.id}
                onClick={() => navigate(`/apps/${app.id}`)}
                className="w-full text-left bg-elevated border border-border hover:border-border-mid rounded-lg px-4 py-4 flex items-center justify-between group transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary font-medium truncate">{app.name}</span>
                    <span className="shrink-0 text-xs text-text-muted bg-overlay px-1.5 py-0.5 rounded">
                      {app.submission_count} submission{app.submission_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {app.description && (
                    <p className="text-text-muted text-xs mt-0.5 truncate">{app.description}</p>
                  )}
                  <p className="text-text-muted text-xs mt-1">Created {formatDate(app.created_at)}</p>
                </div>
                <ChevronRight size={16} className="text-text-muted group-hover:text-text-secondary transition-colors shrink-0 ml-4" />
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
