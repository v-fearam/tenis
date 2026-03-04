import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { Usuario, LoginResponse } from '../types/user';

interface AuthState {
  user: Usuario | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'cb_access_token';
const USER_KEY = 'cb_user';
const REFRESH_KEY = 'cb_refresh_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
  });

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    const savedRefresh = localStorage.getItem(REFRESH_KEY);

    const clearSession = () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(REFRESH_KEY);
      api.setToken(null);
      setState({ token: null, user: null, loading: false });
    };

    const finalizeSession = (data: LoginResponse) => {
      api.setToken(data.access_token);
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_KEY, data.refresh_token || '');
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setState({ token: data.access_token, user: data.user, loading: false });
    };

    const refreshSession = async () => {
      if (!savedRefresh) {
        clearSession();
        return;
      }

      try {
        const data = await api.post<LoginResponse>('/auth/refresh', {
          refresh_token: savedRefresh,
        });
        finalizeSession(data);
      } catch {
        clearSession();
      }
    };

    if (savedToken && savedUser) {
      api.setToken(savedToken);
      let parsedUser: Usuario | null = null;
      try {
        parsedUser = JSON.parse(savedUser);
        // We set the user but keep loading: true to verify with latest role
        setState({
          token: savedToken,
          user: parsedUser,
          loading: true,
        });
      } catch {
        clearSession();
        return;
      }

      // Verify token is still valid by fetching latest profile (including latest rol)
      api.get<Usuario>('/auth/me')
        .then((user) => {
          localStorage.setItem(USER_KEY, JSON.stringify(user));
          setState({ token: savedToken, user, loading: false });
        })
        .catch(() => refreshSession());
      return;
    }

    if (savedRefresh) {
      refreshSession();
      return;
    }

    setState((s) => ({ ...s, loading: false }));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<LoginResponse>('/auth/login', { email, password });
    api.setToken(data.access_token);
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(REFRESH_KEY, data.refresh_token || '');
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setState({ token: data.access_token, user: data.user, loading: false });
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REFRESH_KEY);
    api.setToken(null);
    setState({ token: null, user: null, loading: false });
  }, []);

  const isAdmin = state.user?.rol === 'admin';

  return (
    <AuthContext.Provider value={{ ...state, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
