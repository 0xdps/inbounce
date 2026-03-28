import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { api } from './lib/api.js';
import Login from './pages/Login.js';
import Apps from './pages/Apps.js';
import AppDetail from './pages/AppDetail.js';

interface AuthContextType {
  authed: boolean | null;
  setAuthed: (authed: boolean) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [authed, setAuthed] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    api.me()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setAuthed(false);
  }, []);

  return (
    <AuthContext.Provider value={{ authed, setAuthed, logout }}>
      {authed === null ? (
        <div className="flex items-center justify-center h-full text-text-muted text-sm">
          Loading…
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }): ReactNode {
  const { authed } = useAuth();
  if (!authed) return <Navigate to="/login" replace />;
  return children;
}

export default function App(): ReactNode {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Navigate to="/apps" replace /></ProtectedRoute>} />
          <Route path="/apps" element={<ProtectedRoute><Apps /></ProtectedRoute>} />
          <Route path="/apps/:slug" element={<ProtectedRoute><AppDetail /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
