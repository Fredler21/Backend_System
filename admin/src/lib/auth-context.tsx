'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@/lib/types';
import { authApi, setTokens, clearTokens, getAccessToken } from '@/lib/api';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  mustChangePassword: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  logout: () => Promise<void>;
  clearMustChangePassword: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    mustChangePassword: false,
  });

  const fetchUser = useCallback(async () => {
    try {
      const token = getAccessToken();
      if (!token) {
        setState({ user: null, loading: false, error: null, mustChangePassword: false });
        return;
      }
      const res = await authApi.me();
      if (res.success && res.data) {
        setState({ user: res.data, loading: false, error: null, mustChangePassword: false });
      } else {
        clearTokens();
        setState({ user: null, loading: false, error: null, mustChangePassword: false });
      }
    } catch {
      clearTokens();
      setState({ user: null, loading: false, error: null, mustChangePassword: false });
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string): Promise<{ mustChangePassword: boolean }> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await authApi.login({ email, password });
      if (res.success && res.data) {
        const { user, tokens, mustChangePassword } = res.data;
        if (user.role !== 'ADMIN') {
          throw new Error('Access denied. Admin privileges required.');
        }
        setTokens(tokens.accessToken, tokens.refreshToken);
        const needsChange = mustChangePassword ?? false;
        setState({ user, loading: false, error: null, mustChangePassword: needsChange });
        return { mustChangePassword: needsChange };
      }
      return { mustChangePassword: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setState({ user: null, loading: false, error: message, mustChangePassword: false });
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
      setState({ user: null, loading: false, error: null, mustChangePassword: false });
    }
  };

  const clearMustChangePassword = () => {
    setState((s) => ({ ...s, mustChangePassword: false }));
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        clearMustChangePassword,
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
