import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { api } from './lib/api.js';
import Login from './pages/Login.jsx';
import Apps from './pages/Apps.jsx';
import AppDetail from './pages/AppDetail.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(null); // null = loading

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
      ) : children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children }) {
  const { authed } = useAuth();
  if (!authed) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Navigate to="/apps" replace /></ProtectedRoute>} />
          <Route path="/apps" element={<ProtectedRoute><Apps /></ProtectedRoute>} />
          <Route path="/apps/:id" element={<ProtectedRoute><AppDetail /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
