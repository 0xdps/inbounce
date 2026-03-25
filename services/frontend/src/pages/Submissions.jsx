import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Loader, Inbox, Copy, Check, Search, X } from 'lucide-react';
import { api } from '../lib/api.js';
import Select from '../components/Select.jsx';

// ── Utilities ─────────────────────────────────────────────────────────────

function timeAgo(ts) {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fullDate(ts) {
  return new Date(ts * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function parseDevice(ua) {
  if (!ua) return null;
  let browser = 'Unknown';
  if (/Edg\/(\d+)/.test(ua))                  browser = `Edge ${ua.match(/Edg\/(\d+)/)[1]}`;
  else if (/Chrome\/(\d+)/.test(ua))           browser = `Chrome ${ua.match(/Chrome\/(\d+)/)[1]}`;
  else if (/Firefox\/(\d+)/.test(ua))          browser = `Firefox ${ua.match(/Firefox\/(\d+)/)[1]}`;
  else if (/Version\/[\d.]+.*Safari/.test(ua)) browser = 'Safari';
  let os = null;
  if (/iPhone/.test(ua))       os = 'iOS';
  else if (/iPad/.test(ua))    os = 'iPadOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua))   os = 'Linux';
  return os ? `${browser} · ${os}` : browser;
}

// ── Activity Chart ────────────────────────────────────────────────────────

function ActivityChart({ daily }) {
  const [tooltip, setTooltip] = useState(null);
  const today = new Date();
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const found = daily?.find(r => r.date === key);
    days.push({ date: key, count: found ? Number(found.count) : 0 });
  }
  const max = Math.max(...days.map(d => d.count), 1);
  return (
    <div className="relative">
      {tooltip && (
        <div
          className="absolute bottom-full mb-2 z-10 pointer-events-none -translate-x-1/2 px-2 py-1 rounded bg-overlay border border-border-mid text-[11px] whitespace-nowrap shadow-xl"
          style={{ left: `${tooltip.pct * 100}%` }}
        >
          <span className="text-text-muted">{tooltip.date}</span>
          <span className="text-text-primary font-medium ml-2">{tooltip.count}</span>
          <span className="text-text-muted ml-0.5">sub{tooltip.count !== 1 ? 's' : ''}</span>
        </div>
      )}
      <div className="flex items-end gap-px" style={{ height: 32 }}>
        {days.map(({ date, count }, i) => {
          const pct = count / max;
          const h   = count === 0 ? 2 : Math.max(4, Math.round(pct * 32));
          const op  = count === 0 ? 0.07 : 0.28 + pct * 0.72;
          return (
            <div
              key={date}
              className="flex-1 rounded-[1px] cursor-default"
              style={{ height: h, backgroundColor: `rgba(124,58,237,${op})` }}
              onMouseEnter={() => setTooltip({ date, count, pct: (i + 0.5) / days.length })}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Stats Item ────────────────────────────────────────────────────────────

function StatItem({ label, value, highlight }) {
  return (
    <div>
      <p className={`text-2xl font-semibold tabular-nums leading-none ${highlight ? 'text-accent' : 'text-text-primary'}`}>
        {value !== null && value !== undefined ? value.toLocaleString() : '—'}
      </p>
      <p className="text-xs text-text-muted mt-1">{label}</p>
    </div>
  );
}

// ── Copy Button ───────────────────────────────────────────────────────────

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async e => {
        e.stopPropagation();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-text-muted hover:text-text-secondary transition-colors"
    >
      {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
    </button>
  );
}

// ── Cell Value ────────────────────────────────────────────────────────────

function CellValue({ value }) {
  if (value === null || value === undefined) return <span className="text-text-muted">—</span>;
  if (typeof value === 'boolean') return (
    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${value ? 'text-success bg-success/10' : 'text-text-muted bg-overlay'}`}>
      {String(value)}
    </span>
  );
  return <>{String(value)}</>;
}

// ── Expanded Row Detail ───────────────────────────────────────────────────

function RowDetail({ row, schema, onDelete }) {
  const device = parseDevice(row.meta?.ua ?? null);
  return (
    <div className="bg-base border-t border-border px-5 py-4">
      <div className="grid grid-cols-2 gap-8">
        {/* Fields */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-muted mb-3">Fields</p>
          <div className="space-y-2.5">
            {schema.map(f => (
              <div key={f.name} className="flex gap-4 items-start">
                <span className="text-text-muted text-xs font-mono w-28 shrink-0 pt-0.5">{f.name}</span>
                <span className="text-text-secondary text-xs break-all"><CellValue value={row.data?.[f.name]} /></span>
              </div>
            ))}
          </div>
        </div>
        {/* Source */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-muted mb-3">Source</p>
          <div className="space-y-2.5">
            <div className="flex gap-4">
              <span className="text-text-muted text-xs font-mono w-28 shrink-0">when</span>
              <span className="text-text-secondary text-xs">{fullDate(row.created_at)}</span>
            </div>
            {row.ip && (
              <div className="flex gap-4">
                <span className="text-text-muted text-xs font-mono w-28 shrink-0">ip</span>
                <span className="text-text-secondary text-xs font-mono">{row.ip}</span>
              </div>
            )}
            {device && (
              <div className="flex gap-4">
                <span className="text-text-muted text-xs font-mono w-28 shrink-0">browser</span>
                <span className="text-text-secondary text-xs">{device}</span>
              </div>
            )}
            {row.meta?.referrer && (
              <div className="flex gap-4">
                <span className="text-text-muted text-xs font-mono w-28 shrink-0">referrer</span>
                <span className="text-text-secondary text-xs break-all">{row.meta.referrer}</span>
              </div>
            )}
            {row.meta?.geo && (
              <div className="flex gap-4">
                <span className="text-text-muted text-xs font-mono w-28 shrink-0">location</span>
                <span className="text-text-secondary text-xs">
                  {[row.meta.geo.city, row.meta.geo.region, row.meta.geo.country].filter(Boolean).join(', ')}
                  {row.meta.geo.isp && <span className="text-text-muted ml-1.5">· {row.meta.geo.isp}</span>}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-[11px] font-mono truncate max-w-[280px]">{row.id}</span>
          <CopyBtn text={row.id} />
        </div>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-danger transition-colors"
        >
          <Trash2 size={12} />
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function Submissions({ appId }) {
  const [stats, setStats]       = useState(null);
  const [rows, setRows]         = useState([]);
  const [schema, setSchema]     = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [order, setOrder]       = useState('DESC');
  const [loading, setLoading]   = useState(true);
  const [clearing, setClearing] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [filterField, setFilterField] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const limit = 20;

  useEffect(() => {
    api.getStats(appId).then(setStats).catch(() => {});
  }, [appId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit, order };
      if (filterField && filterValue !== '') {
        params.filter_field = filterField;
        params.filter_value = filterValue;
      }
      const [subs, fields] = await Promise.all([
        api.getSubmissions(appId, params),
        schema.length === 0 ? api.getSchema(appId) : Promise.resolve(schema),
      ]);
      setRows(subs.data);
      setTotal(subs.total);
      if (schema.length === 0) setSchema(fields);
    } finally {
      setLoading(false);
    }
  }, [appId, page, order, filterField, filterValue]);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(id) {
    setExpanded(prev => prev === id ? null : id);
  }

  async function deleteRow(sid) {
    if (!confirm('Delete this submission?')) return;
    await api.deleteSubmission(appId, sid);
    setRows(prev => prev.filter(r => r.id !== sid));
    setTotal(t => t - 1);
    if (expanded === sid) setExpanded(null);
    setStats(prev => prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev);
  }

  async function clearAll() {
    if (!confirm(`Delete all ${total} submissions? This cannot be undone.`)) return;
    setClearing(true);
    try {
      await api.clearSubmissions(appId);
      setRows([]); setTotal(0); setPage(1); setExpanded(null);
      setStats(prev => prev ? { ...prev, total: 0, today: 0, week: 0, month: 0, daily: [] } : prev);
    } finally {
      setClearing(false);
    }
  }

  const totalPages  = Math.max(1, Math.ceil(total / limit));
  const cols        = schema.map(f => f.name);
  const visibleCols = cols.slice(0, 3);
  const extraCols   = cols.length > 3 ? cols.length - 3 : 0;

  if (loading && rows.length === 0) {
    return (
      <div className="space-y-5">
        <div className="bg-elevated border border-border rounded-xl p-5 h-24 animate-pulse" />
        <div className="flex items-center justify-center py-12 text-text-muted">
          <Loader size={16} className="animate-spin mr-2" /> Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats + Chart */}
      <div className="bg-elevated border border-border rounded-xl p-5">
        <div className="flex items-end gap-10">
          <div className="flex items-end gap-8 shrink-0">
            <StatItem label="total"   value={stats?.total ?? total} />
            <StatItem label="today"   value={stats?.today}   highlight />
            <StatItem label="7 days"  value={stats?.week} />
            <StatItem label="30 days" value={stats?.month} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text-muted text-[10px] uppercase tracking-wider mb-2">Last 30 days</p>
            {stats
              ? <ActivityChart daily={stats.daily} />
              : <div className="h-8 rounded bg-overlay animate-pulse" />
            }
          </div>
        </div>
      </div>

      {total === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox size={28} className="text-text-muted mb-3" />
          <p className="text-text-secondary font-medium text-sm">No submissions yet</p>
          <p className="text-text-muted text-xs mt-1">Use the embed snippet in the Setup tab to start collecting data</p>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-text-muted text-xs">
                {(filterField && filterValue !== '') ? `${total.toLocaleString()} result${total !== 1 ? 's' : ''}` : `${total.toLocaleString()} total`}
              </span>
              <button
                onClick={() => { setPage(1); setOrder(o => o === 'DESC' ? 'ASC' : 'DESC'); }}
                className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                {order === 'DESC' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                {order === 'DESC' ? 'Newest first' : 'Oldest first'}
              </button>
              {loading && <Loader size={12} className="animate-spin text-text-muted" />}
            </div>
            <button
              onClick={clearAll}
              disabled={clearing}
              className="text-xs text-text-muted hover:text-danger transition-colors disabled:opacity-40"
            >
              {clearing ? 'Clearing…' : 'Clear all'}
            </button>
          </div>

          {/* Filter bar */}
          {schema.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative flex items-center text-text-muted">
                <Search size={12} className="absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search value…"
                  value={filterValue}
                  onChange={e => { setFilterValue(e.target.value); setPage(1); }}
                  className="pl-7 pr-3 py-1.5 text-xs bg-elevated border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors w-48"
                />
              </div>
              <span className="text-text-muted text-xs">in</span>
              <Select
                value={filterField || '_all'}
                onChange={v => { setFilterField(v === '_all' ? '' : v); setPage(1); }}
                options={[{ value: '_all', label: 'all fields' }, ...schema.map(f => ({ value: f.name, label: f.name }))]}
                className="w-36"
              />
              {(filterField || filterValue) && (
                <button
                  onClick={() => { setFilterField(''); setFilterValue(''); setPage(1); }}
                  className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  <X size={11} /> Clear
                </button>
              )}
            </div>
          )}

          {/* Table */}
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-elevated border-b border-border">
                  <th className="w-8 pl-3" />
                  {visibleCols.map(col => (
                    <th key={col} className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-text-muted font-mono">
                      {col}
                    </th>
                  ))}
                  {extraCols > 0 && (
                    <th className="px-3 py-3 text-left text-[11px] font-medium text-text-muted">
                      +{extraCols} more
                    </th>
                  )}
                  <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-text-muted">When</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(row => {
                  const isExpanded = expanded === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        onClick={() => toggleExpand(row.id)}
                        className={`group cursor-pointer transition-colors ${isExpanded ? 'bg-overlay' : 'hover:bg-overlay/50'}`}
                      >
                        <td className="pl-3 py-3.5">
                          <ChevronRight
                            size={13}
                            className={`text-text-muted transition-transform duration-150 ${isExpanded ? 'rotate-90 text-accent' : ''}`}
                          />
                        </td>
                        {visibleCols.map((col, i) => (
                          <td key={col} className={`px-3 py-3.5 text-xs max-w-[200px] truncate ${i === 0 ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                            <CellValue value={row.data?.[col]} />
                          </td>
                        ))}
                        {extraCols > 0 && (
                          <td className="px-3 py-3.5 text-xs text-text-muted">…</td>
                        )}
                        <td className="px-3 py-3.5 text-xs text-text-muted whitespace-nowrap" title={fullDate(row.created_at)}>
                          {timeAgo(row.created_at)}
                        </td>
                        <td className="pr-2 py-3.5" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => deleteRow(row.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-danger transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={visibleCols.length + extraCols + 3} className="p-0">
                            <RowDetail row={row} schema={schema} onDelete={() => deleteRow(row.id)} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-xs">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-overlay disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-overlay disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
