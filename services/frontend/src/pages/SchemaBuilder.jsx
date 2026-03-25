import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Loader, GripVertical, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api.js';
import Select from '../components/Select.jsx';

const FIELD_TYPES = ['string', 'email', 'number', 'boolean', 'url', 'date'];

const TYPE_COLORS = {
  string:  '#60a5fa',
  email:   '#a78bfa',
  number:  '#fbbf24',
  boolean: '#34d399',
  url:     '#22d3ee',
  date:    '#fb7185',
};

function emptyField(position) {
  return { _key: Math.random().toString(36).slice(2), name: '', type: 'string', required: false, unique: false, position };
}

export default function SchemaBuilder({ appId }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasSubmissions, setHasSubmissions] = useState(false);

  useEffect(() => {
    Promise.all([api.getSchema(appId), api.getSubmissions(appId, { limit: 1 })])
      .then(([schemaFields, subs]) => {
        setFields(schemaFields.map((f) => ({ ...f, _key: f.id })));
        setHasSubmissions(subs.total > 0);
      })
      .finally(() => setLoading(false));
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
        <Loader size={16} className="animate-spin mr-2" /> Loading schema…
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {hasSubmissions && (
        <div className="flex items-start gap-2 bg-warning/10 border border-warning/20 rounded-lg px-4 py-3">
          <AlertTriangle size={14} className="text-warning mt-0.5 shrink-0" />
          <p className="text-warning text-xs">
            This app has existing submissions. Adding fields is safe. Removing fields does not delete stored data.
          </p>
        </div>
      )}

      {fields.length === 0 ? (
        <div className="bg-elevated border border-border rounded-lg px-4 py-10 text-center">
          <p className="text-text-muted text-sm">No fields defined yet</p>
          <p className="text-text-muted text-xs mt-1">Add your first field below</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Column headers */}
          <div className="grid grid-cols-[1.5rem_1fr_140px_80px_80px_32px] gap-2 px-2">
            <div />
            <span className="text-text-muted text-xs">Field name</span>
            <span className="text-text-muted text-xs">Type</span>
            <span className="text-text-muted text-xs text-center">Required</span>
            <span className="text-text-muted text-xs text-center">Unique</span>
            <div />
          </div>

          {fields.map((field) => (
            <div
              key={field._key}
              className="grid grid-cols-[1.5rem_1fr_140px_80px_80px_32px] gap-2 items-center bg-elevated border border-border rounded-lg px-2 py-2"
            >
              <div className="flex flex-col items-center gap-1.5 py-0.5">
                <GripVertical size={14} className="text-text-muted cursor-grab" />
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: TYPE_COLORS[field.type] ?? '#4a4a56' }}
                />
              </div>

              <input
                value={field.name}
                onChange={(e) => updateField(field._key, { name: e.target.value })}
                placeholder="field_name"
                className="bg-overlay border border-border rounded px-2 py-1.5 text-sm text-text-primary font-mono placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
              />

              <Select
                value={field.type}
                onChange={(val) => updateField(field._key, { type: val })}
                options={FIELD_TYPES}
              />

              <div className="flex justify-center">
                <input
                  type="checkbox"
                  checked={!!field.required}
                  onChange={(e) => updateField(field._key, { required: e.target.checked })}
                  className="w-4 h-4 accent-accent cursor-pointer"
                />
              </div>

              <div className="flex justify-center">
                <input
                  type="checkbox"
                  checked={!!field.unique}
                  onChange={(e) => updateField(field._key, { unique: e.target.checked })}
                  className="w-4 h-4 accent-accent cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => removeField(field._key)}
                className="flex items-center justify-center text-text-muted hover:text-danger transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={addField}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <Plus size={14} />
          Add field
        </button>

        <div className="flex items-center gap-3">
          {error && <span className="text-danger text-xs">{error}</span>}
          {success && <span className="text-success text-xs">Schema saved</span>}
          <button
            type="submit"
            disabled={saving || fields.length === 0}
            className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save schema'}
          </button>
        </div>
      </div>
    </form>
  );
}
