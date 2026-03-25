import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Trash2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader, Inbox, Copy, Check, Search, X, Download } from 'lucide-react';
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
  if (/iPhone/.test(ua))        os = 'iOS';
  else if (/iPad/.test(ua))     os = 'iPadOS';
  else if (/Android/.test(ua))  os = 'Android';
  else if (/Windows/.test(ua))  os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua))    os = 'Linux';
  return os ? `${browser} · ${os}` : browser;
}

// ── Activity Chart ─────────────────────────────────────────────────────────

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
          className="absolute bottom-full mb-2 z-10 pointer-events-none -translate-x-1/2 px-2 py-1 rounded-lg shadow-xl text-[11px] whitespace-nowrap"
          style={{ left: `${tooltip.pct * 100}%`, background: '#1a1a2e', border: '1px solid rgba(139,92,246,0.25)' }}
        >
          <span className="text-text-muted">{tooltip.date}</span>
          <span className="text-text-primary font-semibold ml-2">{tooltip.count}</span>
        </div>
      )}
      <div className="flex items-end gap-px" style={{ height: 36 }}>
        {days.map(({ date, count }, i) => {
          const pct = count / max;
          const h   = count === 0 ? 2 : Math.max(4, Math.round(pct * 36));
          const op  = count === 0 ? 0.07 : 0.25 + pct * 0.75;
          return (
            <div
              key={date}
              className="flex-1 rounded-sm cursor-default transition-opacity hover:opacity-100"
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

// ── Distribution Card ─────────────────────────────────────────────────────

function DistributionCard({ fieldName, distribution }) {
  if (!distribution || distribution.data.length === 0) return null;
  const max = distribution.data[0]?.count ?? 1;
  const grandTotal = distribution.total || 1;
  return (
    <div className="rounded-xl p-4" style={{ background: '#0d0d1b', border: '1px solid rgba(139,92,246,0.12)' }}>
      <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-3">{fieldName}</p>
      <div className="space-y-2.5">
        {distribution.data.slice(0, 6).map(({ value, count }) => (
          <div key={value}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-text-secondary text-xs truncate max-w-[160px]">{value ?? '(empty)'}</span>
              <span className="text-text-muted text-xs font-mono ml-2 shrink-0">{count} · {Math.round(count / grandTotal * 100)}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${(count / max) * 100}%`, background: 'linear-gradient(to right, #7c3aed, #a78bfa)' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stat Item ─────────────────────────────────────────────────────────────

function StatItem({ label, value, highlight }) {
  return (
    <div>
      <p className={`text-2xl font-bold tabular-nums leading-none ${highlight ? 'text-accent-light' : 'text-text-primary'}`}>
        {value !== null && value !== undefined ? value.toLocaleString() : '—'}
      </p>
      <p className="text-xs text-text-muted mt-1 font-mono">{label}</p>
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
    <div className="px-5 py-4" style={{ background: 'rgba(7,7,15,0.6)', borderTop: '1px solid rgba(139,92,246,0.1)' }}>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-muted mb-3 font-mono">Fields</p>
          <div className="space-y-2.5">
            {schema.map(f => (
              <div key={f.name} className="flex gap-4 items-start">
                <span className="text-text-muted text-xs font-mono w-28 shrink-0 pt-0.5">{f.name}</span>
                <span className="text-text-secondary text-xs break-all"><CellValue value={row.data?.[f.name]} /></span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-muted mb-3 font-mono">Source</p>
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
      <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid rgba(139,92,246,0.08)' }}>
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

// ── Date range helpers ────────────────────────────────────────────────────

const DATE_OPTIONS = [
  { label: 'All',   value: 'all',   after: null },
  { label: 'Today', value: 'today', after: () => Math.floor(Date.now() / 86400000) * 86400 },
  { label: '7d',    value: '7d',    after: () => Math.floor(Date.now() / 1000) - 7  * 86400 },
  { label: '30d',   value: '30d',   after: () => Math.floor(Date.now() / 1000) - 30 * 86400 },
];

// ── Main Component ─────────────────────────────────────────────────────────

export default function Submissions({ appId }) {
  const [stats, setStats]         = useState(null);
  const [rows, setRows]           = useState([]);
  const [schema, setSchema]       = useState([]);
  const [distributions, setDist]  = useState({});
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [order, setOrder]         = useState('DESC');
  const [loading, setLoading]     = useState(true);
  const [clearing, setClearing]   = useState(false);
  const [expanded, setExpanded]   = useState(null);
  const [dateRange, setDateRange] = useState('all');
  const [filterField, setFilterField] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const limit = 20;

  const afterTs = useMemo(() => {
    const opt = DATE_OPTIONS.find(o => o.value === dateRange);
    return typeof opt?.after === 'function' ? opt.after() : null;
  }, [dateRange]);

  useEffect(() => {
    api.getStats(appId).then(setStats).catch(() => {});
  }, [appId]);

  // Load distributions for first 2 string/email fields
  useEffect(() => {
    if (schema.length === 0) return;
    const candidates = schema.filter(f => ['string', 'email', 'url'].includes(f.type)).slice(0, 2);
    candidates.forEach(f => {
      api.getFieldDistribution(appId, f.name, afterTs)
        .then(d => setDist(prev => ({ ...prev, [f.name]: d })))
        .catch(() => {});
    });
  }, [schema, afterTs, appId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit, order };
      if (filterField && filterValue !== '') {
        params.filter_field = filterField;
        params.filter_value = filterValue;
      }
      if (afterTs) params.after = afterTs;
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
  }, [appId, page, order, filterField, filterValue, afterTs]);

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
      setDist({});
    } finally {
      setClearing(false);
    }
  }

  async function exportCsv() {
    const params = { page: 1, limit: 1000, order };
    if (filterField && filterValue !== '') { params.filter_field = filterField; params.filter_value = filterValue; }
    if (afterTs) params.after = afterTs;
    try {
      const result = await api.getSubmissions(appId, params);
      const cols = schema.map(f => f.name);
      const csvRows = result.data.map(row => [
        ...cols.map(c => {
          const v = row.data?.[c];
          if (v === null || v === undefined) return '';
          const s = String(v);
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        }),
        new Date(row.created_at * 1000).toISOString(),
        row.ip || '',
        row.meta?.geo?.country || '',
      ]);
      const header = [...cols, 'submitted_at', 'ip', 'country'].join(',');
      const csv = [header, ...csvRows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `submissions-${appId}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {/* ignore */}
  }

  const totalPages  = Math.max(1, Math.ceil(total / limit));
  const cols        = schema.map(f => f.name);
  const visibleCols = cols.slice(0, 4);
  const extraCols   = cols.length > 4 ? cols.length - 4 : 0;
  const distFields  = Object.keys(distributions);
  const isFiltered  = !!(filterField || filterValue || afterTs);

  if (loading && rows.length === 0) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl h-24 animate-pulse" style={{ background: '#0d0d1b', border: '1px solid rgba(139,92,246,0.1)' }} />
        <div className="flex items-center justify-center py-12 text-text-muted">
          <Loader size={16} className="animate-spin mr-2" />
          <span className="text-xs font-mono">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Analytics: stats + chart ── */}
      <div className="rounded-xl p-5" style={{ background: '#0d0d1b', border: '1px solid rgba(139,92,246,0.12)' }}>
        <div className="flex items-end gap-8">
          <div className="flex items-end gap-8 shrink-0">
            <StatItem label="total"   value={stats?.total ?? total} />
            <StatItem label="today"   value={stats?.today}   highlight />
            <StatItem label="7 days"  value={stats?.week} />
            <StatItem label="30 days" value={stats?.month} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text-muted text-[10px] uppercase tracking-wider font-mono mb-2">Last 30 days</p>
            {stats
              ? <ActivityChart daily={stats.daily} />
              : <div className="h-9 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
            }
          </div>
        </div>
      </div>

      {/* ── Distribution cards ── */}
      {distFields.length > 0 && (
        <div className={`grid gap-4 ${distFields.length >= 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {distFields.map(f => (
            <DistributionCard key={f} fieldName={f} distribution={distributions[f]} />
          ))}
        </div>
      )}

      {total === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(139,92,246,0.14)' }}>
            <Inbox size={18} className="text-accent-light" />
          </div>
          <p className="text-text-secondary font-semibold text-sm">No submissions yet</p>
          <p className="text-text-muted text-xs mt-1.5">Use the embed snippet in the Setup tab to start collecting data</p>
        </div>
      ) : (
        <>
          {/* ── Toolbar ── */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Date range */}
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg shrink-0" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,92,246,0.1)' }}>
              {DATE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setDateRange(opt.value); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                    dateRange === opt.value
                      ? 'text-text-primary'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                  style={dateRange === opt.value ? { background: 'rgba(124,58,237,0.18)' } : {}}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <button
              onClick={() => { setPage(1); setOrder(o => o === 'DESC' ? 'ASC' : 'DESC'); }}
              className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors font-mono shrink-0"
            >
              {order === 'DESC' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
              {order === 'DESC' ? 'Newest' : 'Oldest'}
            </button>

            {loading && <Loader size={12} className="animate-spin text-text-muted" />}

            {/* Count */}
            <span className="text-text-muted text-xs font-mono ml-auto">
              {isFiltered ? `${total.toLocaleString()} match${total !== 1 ? 'es' : ''}` : `${total.toLocaleString()} total`}
            </span>

            {/* Export */}
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors font-mono"
            >
              <Download size={12} />
              CSV
            </button>

            {/* Clear */}
            <button
              onClick={clearAll}
              disabled={clearing}
              className="text-xs text-text-muted hover:text-danger transition-colors disabled:opacity-40 font-mono"
            >
              {clearing ? 'Clearing…' : 'Clear all'}
            </button>
          </div>

          {/* ── Filter bar ── */}
          {schema.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex items-center text-text-muted">
                <Search size={12} className="absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search value…"
                  value={filterValue}
                  onChange={e => { setFilterValue(e.target.value); setPage(1); }}
                  className="pl-7 pr-3 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none transition-all w-44 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.12)' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.4)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(139,92,246,0.12)'}
                />
              </div>
              <span className="text-text-muted text-xs font-mono">in</span>
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
                  <X size={11} /> Clear filter
                </button>
              )}
            </div>
          )}

          {/* ── Table ── */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(139,92,246,0.12)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#0d0d1b', borderBottom: '1px solid rgba(139,92,246,0.1)' }}>
                  <th className="w-8 pl-3" />
                  {visibleCols.map((col, i) => (
                    <th key={col} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted font-mono">
                      {col}
                    </th>
                  ))}
                  {extraCols > 0 && (
                    <th className="px-3 py-2.5 text-left text-[11px] text-text-muted">+{extraCols}</th>
                  )}
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted font-mono">When</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const isExpanded = expanded === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        onClick={() => toggleExpand(row.id)}
                        className="group cursor-pointer transition-colors"
                        style={{
                          borderTop: idx > 0 ? '1px solid rgba(139,92,246,0.06)' : undefined,
                          background: isExpanded ? 'rgba(124,58,237,0.06)' : undefined,
                        }}
                        onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                        onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = ''; }}
                      >
                        <td className="pl-3 py-3.5">
                          <ChevronRight
                            size={13}
                            className={`text-text-muted transition-transform duration-150 ${isExpanded ? 'rotate-90 text-accent-light' : ''}`}
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
                        <td className="px-3 py-3.5 text-xs text-text-muted whitespace-nowrap font-mono" title={fullDate(row.created_at)}>
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

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-xs font-mono">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-overlay disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-overlay disabled:opacity-30 transition-colors"
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
