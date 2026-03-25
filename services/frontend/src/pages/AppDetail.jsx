import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, Check, RefreshCw, Trash2, Loader, ChevronLeft } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import SchemaBuilder from './SchemaBuilder.jsx';
import Submissions from './Submissions.jsx';
import { api } from '../lib/api.js';

function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button onClick={copy} className={`flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors ${className}`}>
      {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

const TYPE_PLACEHOLDER = {
  string:  f => `'your ${f}'`,
  email:   _f => `'user@example.com'`,
  url:     _f => `'https://example.com'`,
  number:  _f => `42`,
  boolean: _f => `true`,
  date:    _f => `'2024-01-15'`,
};

function inputType(type) {
  if (type === 'email')   return 'email';
  if (type === 'url')     return 'url';
  if (type === 'number')  return 'number';
  if (type === 'boolean') return 'checkbox';
  if (type === 'date')    return 'date';
  return 'text';
}

function EmbedSnippet({ apiKey, fields = [] }) {
  const [mode, setMode] = useState('fetch');
  const url = `${window.location.origin}/s/${apiKey}`;

  const bodyFields = fields.length > 0
    ? fields.map(f => {
        const ph = (TYPE_PLACEHOLDER[f.type] ?? TYPE_PLACEHOLDER.string)(f.name);
        return `    ${f.name}: ${ph},${f.required ? '' : '  // optional'}`;
      }).join('\n')
    : '    // define schema fields in the Schema tab';

  const fetchSnippet = `await fetch('${url}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
${bodyFields}
  }),
});`;

  const formInputs = fields.length > 0
    ? fields.map(f => {
        const type = inputType(f.type);
        const req  = f.required ? ' required' : '';
        if (type === 'checkbox')
          return `  <label>\n    <input type="checkbox" name="${f.name}"${req} />\n    ${f.name}\n  </label>`;
        return `  <input type="${type}" name="${f.name}" placeholder="${f.name}"${req} />`;
      }).join('\n')
    : '  <!-- define schema fields in the Schema tab -->';

  const formSnippet = `<form action="${url}" method="POST">
${formInputs}

  <!-- honeypot: leave empty -->
  <input type="text" name="_hp" style="display:none" tabindex="-1" autocomplete="off" />

  <button type="submit">Submit</button>
</form>`;

  const active = mode === 'fetch' ? fetchSnippet : formSnippet;

  return (
    <div className="bg-overlay border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-text-secondary text-xs font-medium">Embed snippet</span>
          <div className="flex items-center gap-0.5 bg-surface border border-border rounded p-0.5">
            {['fetch', 'html'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                  mode === m ? 'bg-overlay text-text-primary' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {m === 'fetch' ? 'JS fetch' : 'HTML form'}
              </button>
            ))}
          </div>
        </div>
        <CopyButton text={active} />
      </div>
      <pre className="text-text-secondary text-xs font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">{active}</pre>
    </div>
  );
}

const TABS = ['Submissions', 'Schema', 'Setup'];

export default function AppDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Submissions');
  const [keyVisible, setKeyVisible] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editOrigins, setEditOrigins] = useState('');
  const [saving, setSaving] = useState(false);
  const [schema, setSchema] = useState([]);

  useEffect(() => {
    Promise.all([api.getApp(id), api.getSchema(id)])
      .then(([a, fields]) => {
        setApp(a);
        setSchema(fields);
        setEditName(a.name);
        setEditDesc(a.description || '');
        setEditOrigins((a.allowed_origins || []).join(', '));
      })
      .catch(() => navigate('/apps'))
      .finally(() => setLoading(false));
  }, [id]);

  async function rotateKey() {
    if (!confirm('Rotate API key? The old key will stop working immediately.')) return;
    setRotating(true);
    try {
      const { api_key } = await api.rotateKey(id);
      setApp((prev) => ({ ...prev, api_key }));
    } finally {
      setRotating(false);
    }
  }

  async function deleteApp() {
    if (!confirm(`Delete "${app.name}"? This will permanently delete all submissions.`)) return;
    setDeleting(true);
    try {
      await api.deleteApp(id);
      navigate('/apps');
    } finally {
      setDeleting(false);
    }
  }

  async function saveOverview(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const allowed_origins = editOrigins.split(',').map((o) => o.trim()).filter(Boolean);
      const updated = await api.updateApp(id, { name: editName, description: editDesc, allowed_origins });
      setApp((prev) => ({ ...prev, ...updated }));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader size={18} className="animate-spin mr-2" /> Loading…
        </div>
      </Layout>
    );
  }

  return (
    <Layout back={{ href: '/apps', label: 'Apps' }} title={app.name}>
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-6">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'text-text-primary border-accent'
                  : 'text-text-secondary border-transparent hover:text-text-primary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Setup tab */}
        {tab === 'Setup' && (
          <div className="space-y-4">
            {/* Info */}
            <div className="bg-elevated border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-text-primary font-medium text-sm">App info</h2>
                {!editing && (
                  <button onClick={() => setEditing(true)} className="text-xs text-text-secondary hover:text-text-primary transition-colors">
                    Edit
                  </button>
                )}
              </div>
              {editing ? (
                <form onSubmit={saveOverview} className="space-y-3">
                  <div>
                    <label className="block text-text-secondary text-xs mb-1">Name</label>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-overlay border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors" />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-xs mb-1">Description</label>
                    <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Optional" className="w-full bg-overlay border border-border rounded px-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors" />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-xs mb-1">Allowed origins <span className="text-text-muted">(comma-separated)</span></label>
                    <input value={editOrigins} onChange={(e) => setEditOrigins(e.target.value)} placeholder="https://mysite.com" className="w-full bg-overlay border border-border rounded px-3 py-1.5 text-sm text-text-primary font-mono placeholder-text-muted focus:outline-none focus:border-accent transition-colors" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setEditing(false)} className="text-xs text-text-secondary hover:text-text-primary transition-colors px-3 py-1.5">Cancel</button>
                    <button type="submit" disabled={saving} className="text-xs bg-accent hover:bg-accent-hover text-white px-3 py-1.5 rounded transition-colors disabled:opacity-40">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-text-muted text-xs">Name</dt>
                    <dd className="text-text-primary text-xs">{app.name}</dd>
                  </div>
                  {app.description && (
                    <div className="flex justify-between">
                      <dt className="text-text-muted text-xs">Description</dt>
                      <dd className="text-text-secondary text-xs">{app.description}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-text-muted text-xs">Allowed origins</dt>
                    <dd className="text-text-secondary text-xs font-mono">
                      {(app.allowed_origins || []).length === 0 ? 'All origins' : (app.allowed_origins || []).join(', ')}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-text-muted text-xs">Submissions</dt>
                    <dd className="text-text-primary text-xs">{app.submission_count ?? '—'}</dd>
                  </div>
                </dl>
              )}
            </div>

            {/* API Key */}
            <div className="bg-elevated border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-text-primary font-medium text-sm">API key</h2>
                <div className="flex items-center gap-3">
                  <button onClick={() => setKeyVisible((v) => !v)} className="text-xs text-text-secondary hover:text-text-primary transition-colors">
                    {keyVisible ? 'Hide' : 'Show'}
                  </button>
                  <CopyButton text={app.api_key} />
                  <button
                    onClick={rotateKey}
                    disabled={rotating}
                    className="flex items-center gap-1 text-xs text-text-secondary hover:text-warning transition-colors"
                  >
                    <RefreshCw size={11} className={rotating ? 'animate-spin' : ''} />
                    Rotate
                  </button>
                </div>
              </div>
              <div className="bg-overlay border border-border rounded px-3 py-2 font-mono text-xs text-text-secondary break-all">
                {keyVisible ? app.api_key : '•'.repeat(48)}
              </div>
              <p className="text-text-muted text-xs mt-2">Treat this as a semi-public write-only token — it grants submission access only.</p>
            </div>

            {/* Embed snippet */}
            <EmbedSnippet apiKey={app.api_key} fields={schema} />

            {/* Danger zone */}
            <div className="bg-elevated border border-danger/20 rounded-lg p-5">
              <h2 className="text-danger font-medium text-sm mb-3">Danger zone</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-secondary text-xs">Delete this app</p>
                  <p className="text-text-muted text-xs mt-0.5">Permanently deletes all schema and submissions. Cannot be undone.</p>
                </div>
                <button
                  onClick={deleteApp}
                  disabled={deleting}
                  className="flex items-center gap-1.5 text-xs text-danger border border-danger/30 hover:bg-danger/10 px-3 py-1.5 rounded transition-colors disabled:opacity-40"
                >
                  <Trash2 size={12} />
                  {deleting ? 'Deleting…' : 'Delete app'}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'Schema' && <SchemaBuilder appId={id} />}
        {tab === 'Submissions' && <Submissions appId={id} />}
      </div>
    </Layout>
  );
}
