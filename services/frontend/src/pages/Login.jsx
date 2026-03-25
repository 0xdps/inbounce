import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../App.jsx';
import { LogoMark } from '../components/Logo.jsx';

export default function Login() {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuthed } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.login(key.trim());
      setAuthed(true);
      navigate('/apps');
    } catch (err) {
      setError(err.status === 401 ? 'Invalid key' : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base px-4 relative overflow-hidden">
      {/* Glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '50%', left: '50%', transform: 'translate(-50%, -65%)',
          width: 600, height: 500,
          background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.18) 0%, transparent 68%)',
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo block */}
        <div className="flex flex-col items-center gap-4 mb-10">
          <LogoMark size={52} />
          <div className="text-center">
            <h1 className="text-text-primary font-bold tracking-tight leading-none text-xl">
              in<span style={{ color: '#a78bfa' }}>bounce</span>
            </h1>
            <p className="text-text-muted text-xs mt-1.5 font-mono tracking-wide">admin dashboard</p>
          </div>
        </div>

        {/* Card */}
        <div
          className="bg-elevated rounded-2xl p-7"
          style={{ border: '1px solid rgba(139,92,246,0.18)', boxShadow: '0 0 0 4px rgba(124,58,237,0.06), 0 24px 64px rgba(0,0,0,0.55)' }}
        >
          <p className="text-text-secondary text-sm mb-5">Enter your admin key to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-text-muted text-xs font-mono uppercase tracking-widest mb-2">Admin key</label>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="••••••••••••••••"
                autoFocus
                className="w-full bg-overlay rounded-lg px-3.5 py-2.5 text-text-primary text-sm placeholder-text-muted focus:outline-none transition-all font-mono"
                style={{ border: '1px solid rgba(139,92,246,0.15)' }}
                onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.45)'}
                onBlur={e => e.target.style.borderColor = 'rgba(139,92,246,0.15)'}
              />
            </div>

            {error && (
              <p className="text-danger text-xs font-mono">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !key.trim()}
              className="w-full text-white font-semibold text-sm py-2.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
            >
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
