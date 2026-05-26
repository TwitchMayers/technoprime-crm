'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { disconnectSocket } from '@/lib/socket';

type Role = 'ADMIN' | 'MANAGER' | 'TECHNICAL_SPECIALIST' | 'SUPER_ADMIN';

type User = {
  id: number;
  login: string;
  name: string;
  role: Role;
  position?: string;
  tenant?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_HINT_COOKIE = 'tp_session=1';

function hasSessionHintCookie() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((entry) => entry.trim() === SESSION_HINT_COOKIE);
}

function setSessionHintCookie() {
  if (typeof document === 'undefined') return;
  const maxAge = 60 * 60 * 12;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `tp_session=1; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

function clearSessionHintCookie() {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `tp_session=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
}

function clearAuthStorage() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
  clearSessionHintCookie();
}

function requestServerLogoutCleanup() {
  if (typeof window === 'undefined') return;
  void fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  }).catch(() => undefined);
}

function persistAuth(user: User) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.removeItem('token');
  }
  setSessionHintCookie();
}

function readStoredUser() {
  if (typeof window === 'undefined') return null;
  const savedUser = localStorage.getItem('user');
  if (!savedUser) return null;

  try {
    return JSON.parse(savedUser) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ initialUser, shouldVerifySession }] = useState(() => {
    if (typeof window === 'undefined') {
      return { initialUser: null as User | null, shouldVerifySession: false };
    }

    const cachedUser = readStoredUser();
    if (!cachedUser) {
      localStorage.removeItem('token');
    }

    return {
      initialUser: cachedUser,
      shouldVerifySession: Boolean(cachedUser) || hasSessionHintCookie(),
    };
  });

  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(shouldVerifySession);
  const verifyInFlightRef = useRef<Promise<boolean> | null>(null);
  const lastVerifyAtRef = useRef(0);

  const verifyToken = useCallback(
    async (options?: { allowCachedUser?: boolean; timeoutMs?: number; force?: boolean }) => {
      const force = options?.force === true;
      const now = Date.now();

      if (!force && verifyInFlightRef.current) {
        return verifyInFlightRef.current;
      }

      if (!force && now - lastVerifyAtRef.current < 1200) {
        return Boolean(readStoredUser());
      }

      lastVerifyAtRef.current = now;

      const request = (async () => {
        try {
          const controller = new AbortController();
          const timeoutMs = options?.timeoutMs ?? 10000;
          const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

          const response = (await Promise.race([
            fetch('/api/auth/me', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
              signal: controller.signal,
              cache: 'no-store',
              credentials: 'include',
            }),
            new Promise<Response>((_, reject) => {
              window.setTimeout(() => reject(new Error('AUTH_TIMEOUT')), timeoutMs + 250);
            }),
          ]).finally(() => {
            window.clearTimeout(timeoutId);
          })) as Response;

          if (response.ok) {
            const userData = await response.json();
            persistAuth(userData);
            setUser(userData);
            return true;
          }

          if (response.status === 401 || response.status === 403) {
            clearAuthStorage();
            requestServerLogoutCleanup();
            setUser(null);
            return false;
          }

          if (options?.allowCachedUser) {
            const cachedUser = readStoredUser();
            if (cachedUser) {
              persistAuth(cachedUser);
              setUser(cachedUser);
              return true;
            }
          }

          return false;
        } catch {
          if (options?.allowCachedUser) {
            const cachedUser = readStoredUser();
            if (cachedUser) {
              persistAuth(cachedUser);
              setUser(cachedUser);
              return true;
            }
          }

          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return Boolean(readStoredUser());
          }

          return false;
        }
      })();

      verifyInFlightRef.current = request;
      return request.finally(() => {
        if (verifyInFlightRef.current === request) {
          verifyInFlightRef.current = null;
        }
      });
    },
    [],
  );

  useEffect(() => {
    if (!loading) return undefined;

    const timerId = window.setTimeout(() => {
      setLoading(false);
    }, 12000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [loading]);

  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      if (!shouldVerifySession) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      const restored = await verifyToken({
        allowCachedUser: true,
        timeoutMs: 7000,
        force: true,
      });

      if (!cancelled) {
        if (!restored) {
          setUser(null);
        }
        setLoading(false);
      }
    };

    void initAuth();
    return () => {
      cancelled = true;
    };
  }, [shouldVerifySession, verifyToken]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let revalidating = false;
    const revalidate = () => {
      if (document.hidden || revalidating) return;

      const hasHint = hasSessionHintCookie();
      if (!hasHint && !user && window.location.pathname.startsWith('/login')) {
        return;
      }

      revalidating = true;
      void verifyToken({ allowCachedUser: true, timeoutMs: 5000 }).finally(() => {
        revalidating = false;
      });
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        revalidate();
      }
    };

    window.addEventListener('focus', revalidate);
    window.addEventListener('pageshow', revalidate);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', revalidate);
      window.removeEventListener('pageshow', revalidate);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user, verifyToken]);

  const login = async (loginInput: string, password: string) => {
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12000);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginInput, password }),
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
      }).finally(() => {
        window.clearTimeout(timeoutId);
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload?.message ||
          payload?.error ||
          (response.status === 504 ? 'Сервер долго отвечает. Попробуйте ещё раз.' : 'Ошибка авторизации');
        throw new Error(message);
      }

      const data = await response.json();
      if (data.user) {
        persistAuth(data.user);
        setUser(data.user);
        toast.success(`Добро пожаловать, ${data.user.name}!`);
        const targetPath =
          data.user.role === 'MANAGER' ? '/profile' : '/analytics';
        window.location.replace(targetPath);
        return;
      }

      throw new Error('Неверный ответ от сервера');
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError';
      toast.error(isAbort ? 'Сервер не ответил вовремя. Повторите вход.' : err.message || 'Ошибка входа');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      }).catch(() => undefined);
    } finally {
      clearAuthStorage();
      disconnectSocket();
      setUser(null);
      setLoading(false);
      toast.info('Вы вышли из системы');
      window.location.href = '/login';
    }
  };

  const hasRole = (...roles: Role[]) => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasRole,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
