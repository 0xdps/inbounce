import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Loader, Inbox, AlertTriangle, Info } from 'lucide-react';
import { api } from '../lib/api.js';

function formatDate(ts) {
  return new Date(ts * 1000).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function CellValue({ value }) {
  if (value === null || value === undefined) return <span className="text-text-muted">—</span>;
  if (typeof value === 'boolean') return <span className={value ? 'text-success' : 'text-text-muted'}>{String(value)}</span>;
  return <span className="truncate max-w-[200px] inline-block align-bottom">{String(value)}</span>;
}

function MetaCell({ ip, meta }) {
  const ua = meta?.ua ?? null;
  const referrer = meta?.referrer ?? null;
  if (!ua && !referrer) return <span className="text-text-muted font-mono">{ip || '—'}</span>;

  return (
    <span className="group/meta relative inline-flex items-center gap-1">
      <span className="text-text-muted font-mono">{ip || '—'}</span>
      <Info size={11} className="text-text-muted/50 group-hover/meta:text-text-muted transition-colors flex-shrink-0" />
      <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-10 hidden group-hover/meta:block w-72 rounded-md bg-overlay border border-border p-2.5 text-[11px] text-text-secondary shadow-lg">
        {ua && (
          <span className="block mb-1">
            <span className="text-text-muted">UA: </span>{ua}
          </span>
        )}
        {referrer && (
          <span className="block">
            <span className="text-text-muted">Referrer: </span>{referrer}
          </span>
        )}
      </span>
    </span>
  );
}

export default function Submissions({ appId }) {
  const [rows, setRows] = useState([]);
  const [schema, setSchema] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState('DESC');
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subs, fields] = await Promise.all([
        api.getSubmissions(appId, { page, limit, order }),
        schema.length === 0 ? api.getSchema(appId) : Promise.resolve(schema),
      ]);
      setRows(subs.data);
      setTotal(subs.total);
      if (schema.length === 0) setSchema(fields);
    } finally {
      setLoading(false);
    }
  }, [appId, page, order]);

  useEffect(() => { load(); }, [load]);

  async function deleteRow(sid) {
    if (!confirm('Delete this submission?')) return;
    await api.deleteSubmission(appId, sid);
    setRows((prev) => prev.filter((r) => r.id !== sid));
    setTotal((t) => t - 1);
  }

  async function clearAll() {
    if (!confirm(`Delete all ${total} submissions? This cannot be undone.`)) return;
    setClearing(true);
    try {
      await api.clearSubmissions(appId);
      setRows([]);
      setTotal(0);
      setPage(1);
    } finally {
      setClearing(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const columns = schema.map((f) => f.name);

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-text-muted">
        <Loader size={16} className="animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (!loading && total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Inbox size={28} className="text-text-muted mb-3" />
        <p className="text-text-secondary font-medium text-sm">No submissions yet</p>
        <p className="text-text-muted text-xs mt-1">Use the embed snippet from the Overview tab to start collecting data</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-text-muted text-xs">{total} total</span>
          <button
            onClick={() => setOrder((o) => o === 'DESC' ? 'ASC' : 'DESC')}
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
          className="flex items-center gap-1.5 text-xs text-danger hover:text-danger/80 transition-colors disabled:opacity-40"
        >
          <AlertTriangle size={12} />
          {clearing ? 'Clearing…' : 'Clear all'}
        </button>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-overlay">
                {columns.map((col) => (
                  <th key={col} className="px-3 py-2 text-left text-xs font-medium text-text-muted font-mono">
                    {col}
                  </th>
                ))}
                <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">Submitted</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">IP / UA</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-overlay/50 transition-colors group">
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-2.5 text-xs text-text-secondary max-w-[200px]">
                      <CellValue value={row.data?.[col]} />
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-xs text-text-muted whitespace-nowrap">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2.5 text-xs"><MetaCell ip={row.ip} meta={row.meta} /></td>
                  <td className="px-2 py-2.5">
                    <button
                      onClick={() => deleteRow(row.id)}
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-text-muted text-xs">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
