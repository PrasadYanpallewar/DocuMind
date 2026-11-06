import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('documind_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('documind_token') || null);
  const [loading, setLoading] = useState(true);

  // Synchronize authentication status from server on mount
  const checkAuth = useCallback(async () => {
    const savedToken = localStorage.getItem('documind_token');
    if (!savedToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      const result = await authService.getCurrentUser();
      if (result?.data?.user) {
        setUser(result.data.user);
        setToken(savedToken);
        localStorage.setItem('documind_user', JSON.stringify(result.data.user));
      } else {
        throw new Error('Invalid user payload');
      }
    } catch (err) {
      console.warn('Authentication token expired or invalid:', err.message);
      localStorage.removeItem('documind_token');
      localStorage.removeItem('documind_user');
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [checkAuth]);

  const login = async (email, password) => {
    const res = await authService.login({ email, password });
    const { token: receivedToken, user: receivedUser } = res.data;

    localStorage.setItem('documind_token', receivedToken);
    localStorage.setItem('documind_user', JSON.stringify(receivedUser));

    setToken(receivedToken);
    setUser(receivedUser);
    return res;
  };

  const register = async (name, email, password) => {
    const res = await authService.register({ name, email, password });
    const { token: receivedToken, user: receivedUser } = res.data;

    localStorage.setItem('documind_token', receivedToken);
    localStorage.setItem('documind_user', JSON.stringify(receivedUser));

    setToken(receivedToken);
    setUser(receivedUser);
    return res;
  };

  const logout = () => {
    localStorage.removeItem('documind_token');
    localStorage.removeItem('documind_user');
    setUser(null);
    setToken(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    loading,
    login,
    register,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
