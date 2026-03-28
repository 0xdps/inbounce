import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Custom styled dropdown — replaces native <select>.
 * @param {string}   value      - current selected value
 * @param {Function} onChange   - called with the new value string
 * @param {Array}    options    - string[] or { value, label }[]
 * @param {string}   [className]
 */
export default function Select({ value, onChange, options, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
  const selected = items.find(o => o.value === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 bg-overlay border border-border rounded px-2 py-1.5 text-sm text-text-primary hover:border-border-mid focus:outline-none focus:border-accent transition-colors"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown
          size={11}
          className={`text-text-muted shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-overlay border border-border rounded shadow-xl overflow-hidden">
          {items.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-2 py-1.5 text-sm transition-colors hover:bg-elevated ${opt.value === value ? 'text-accent' : 'text-text-primary'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
