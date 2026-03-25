import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../App.jsx';

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
    <div className="min-h-screen flex items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <Zap size={20} className="text-accent" />
          <span className="text-text-primary font-semibold text-lg tracking-tight">inbounce</span>
        </div>

        <div className="bg-elevated border border-border rounded-lg p-6">
          <h1 className="text-text-primary font-semibold mb-1">Sign in</h1>
          <p className="text-text-muted text-xs mb-5">Enter your admin key to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-text-secondary text-xs mb-1.5">Admin key</label>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="••••••••••••••••"
                autoFocus
                className="w-full bg-overlay border border-border rounded-md px-3 py-2 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent transition-colors font-mono"
              />
            </div>

            {error && (
              <p className="text-danger text-xs">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !key.trim()}
              className="w-full bg-accent hover:bg-accent-hover text-white font-medium text-sm py-2 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
