'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@/lib/types';
import { authApi, setTokens, clearTokens, getAccessToken } from '@/lib/api';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const fetchUser = useCallback(async () => {
    try {
      const token = getAccessToken();
      if (!token) {
        setState({ user: null, loading: false, error: null });
        return;
      }
      const res = await authApi.me();
      if (res.success && res.data) {
        setState({ user: res.data, loading: false, error: null });
      } else {
        clearTokens();
        setState({ user: null, loading: false, error: null });
      }
    } catch {
      clearTokens();
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await authApi.login({ email, password });
      if (res.success && res.data) {
        const { user, tokens } = res.data;
        if (user.role !== 'ADMIN') {
          throw new Error('Access denied. Admin privileges required.');
        }
        setTokens(tokens.accessToken, tokens.refreshToken);
        setState({ user, loading: false, error: null });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setState({ user: null, loading: false, error: message });
      throw err;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore logout errors
    } finally {
      clearTokens();
      setState({ user: null, loading: false, error: null });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        isAdmin: state.user?.role === 'ADMIN',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
