import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Loader, AlertTriangle, Check } from 'lucide-react';
import { api } from '../lib/api.js';

const FIELD_TYPES = ['string', 'email', 'number', 'boolean', 'url', 'date'];

const TYPE_COLORS = {
  string:  '#60a5fa',
  email:   '#a78bfa',
  number:  '#fbbf24',
  boolean: '#34d399',
  url:     '#22d3ee',
  date:    '#fb7185',
};

const TYPE_HINTS = {
  string:  'free text',
  email:   'validates format',
  number:  'int or float',
  boolean: 'true / false',
  url:     'validates URL',
  date:    'YYYY-MM-DD',
};

function emptyField(position) {
  return { _key: Math.random().toString(36).slice(2), name: '', type: 'string', required: false, unique: false, compound_key: '', position };
}

export default function SchemaBuilder({ appId }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasSubmissions, setHasSubmissions] = useState(false);

  useEffect(() => {
    // Load schema first
    api.getSchema(appId)
      .then((schemaFields) => {
        if (Array.isArray(schemaFields)) {
          setFields(schemaFields.map((f) => ({ ...f, _key: f.id })));
        } else {
          setFields([]);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load schema');
      })
      .finally(() => setLoading(false));

    // Load submissions count separately (don't block schema display)
    api.getSubmissions(appId, { limit: '1' })
      .then((subs) => {
        setHasSubmissions(subs.total > 0);
      })
      .catch(() => {
        // Ignore errors for submissions count
      });
  }, [appId]);

  function addField() {
    setFields((prev) => [...prev, emptyField(prev.length)]);
  }

  function removeField(key) {
    setFields((prev) => prev.filter((f) => f._key !== key));
  }

  function updateField(key, updates) {
    setFields((prev) => prev.map((f) => f._key === key ? { ...f, ...updates } : f));
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const toSave = fields.map((f, i) => ({
      name: f.name.trim(),
      type: f.type,
      required: !!f.required,
      unique: !!f.unique,
      compound_key: f.compound_key?.trim() || null,
      position: i,
    }));

    const invalid = toSave.find((f) => !f.name);
    if (invalid !== undefined) {
      setError('All fields must have a name');
      return;
    }

    setSaving(true);
    try {
      const saved = await api.saveSchema(appId, toSave);
      setFields(saved.map((f) => ({ ...f, _key: f.id })));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-text-muted">
        <Loader size={16} className="animate-spin mr-2" />
        <span className="text-xs font-mono">Loading schema…</span>
      </div>
    );
  }

  return (
    <form onSubmit={save}>
      {error && !saving && (
        <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 mb-5" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
          <AlertTriangle size={13} className="text-danger mt-0.5 shrink-0" />
          <p className="text-danger text-xs leading-relaxed">{error}</p>
        </div>
      )}
      
      {hasSubmissions && (
        <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 mb-5" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}>
          <AlertTriangle size={13} className="text-warning mt-0.5 shrink-0" />
          <p className="text-warning text-xs leading-relaxed">
            This app has existing submissions. Adding fields is safe — removing fields does not delete stored data.
          </p>
        </div>
      )}

      <div className="space-y-2.5 mb-5">
        {fields.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 text-center rounded-xl"
            style={{ border: '1px dashed rgba(139,92,246,0.2)', background: 'rgba(124,58,237,0.03)' }}
          >
            <p className="text-text-muted text-sm">No fields yet</p>
            <p className="text-text-muted text-xs mt-1 opacity-70">Add fields to define what this form accepts</p>
          </div>
        ) : (
          fields.map((field) => (
              <div
                key={field._key}
                className="rounded-xl p-4"
                style={{ background: '#0d0d1b', border: '1px solid rgba(139,92,246,0.14)' }}
              >
              {/* Row 1: field name + delete */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: TYPE_COLORS[field.type] ?? '#4a4a56' }}
                />
                <input
                  value={field.name}
                  onChange={(e) => updateField(field._key, { name: e.target.value })}
                  placeholder="field_name"
                  spellCheck={false}
                  className="flex-1 bg-transparent text-text-primary font-mono text-sm placeholder-text-muted focus:outline-none"
                  style={{ borderBottom: '1px solid rgba(139,92,246,0.12)', paddingBottom: 4 }}
                  onFocus={e => e.target.style.borderBottomColor = 'rgba(139,92,246,0.4)'}
                  onBlur={e => e.target.style.borderBottomColor = 'rgba(139,92,246,0.12)'}
                />
                <button
                  type="button"
                  onClick={() => removeField(field._key)}
                  className="text-text-muted hover:text-danger transition-colors shrink-0 p-1 rounded"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Row 2: type pills + toggles */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-1 flex-wrap">
                  {FIELD_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      title={TYPE_HINTS[t]}
                      onClick={() => updateField(field._key, { type: t })}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all"
                      style={
                        field.type === t
                          ? { color: TYPE_COLORS[t], background: TYPE_COLORS[t] + '1a', border: `1px solid ${TYPE_COLORS[t]}35` }
                          : { color: '#545470', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!field.required}
                      onChange={(e) => updateField(field._key, { required: e.target.checked })}
                      className="w-3.5 h-3.5 accent-accent cursor-pointer"
                    />
                    <span className="text-text-muted text-xs font-mono">required</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!field.unique}
                      onChange={(e) => updateField(field._key, { unique: e.target.checked })}
                      className="w-3.5 h-3.5 accent-accent cursor-pointer"
                    />
                    <span className="text-text-muted text-xs font-mono">unique</span>
                  </label>
                </div>
              </div>

              {/* Row 3: compound group (optional) */}
              <div className="flex items-center gap-2 mt-2.5 pt-2" style={{ borderTop: '1px solid rgba(139,92,246,0.06)' }}>
                <span className="text-[10px] font-mono text-text-muted shrink-0">compound</span>
                <input
                  value={field.compound_key || ''}
                  onChange={(e) => updateField(field._key, { compound_key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                  placeholder="group name (optional)"
                  spellCheck={false}
                  title="Fields sharing the same group name are checked as a tuple — the combination must be unique"
                  className="flex-1 bg-transparent text-text-muted font-mono text-[11px] placeholder-text-muted focus:text-text-secondary focus:outline-none"
                  style={{ borderBottom: '1px solid rgba(139,92,246,0.08)', paddingBottom: 2 }}
                  onFocus={e => e.target.style.borderBottomColor = 'rgba(139,92,246,0.3)'}
                  onBlur={e => e.target.style.borderBottomColor = 'rgba(139,92,246,0.08)'}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addField}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-accent-light transition-colors px-3 py-2 rounded-lg hover:bg-accent/[0.08]"
        >
          <Plus size={13} strokeWidth={2.5} />
          Add field
        </button>

        <div className="flex items-center gap-3">
          {error && <span className="text-danger text-xs font-mono">{error}</span>}
          {success && (
            <span className="flex items-center gap-1 text-success text-xs font-mono">
              <Check size={12} /> Saved
            </span>
          )}
          <button
            type="submit"
            disabled={saving || fields.length === 0}
            className="px-4 py-2 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
          >
            {saving ? 'Saving…' : 'Save schema'}
          </button>
        </div>
      </div>
    </form>
  );
}
