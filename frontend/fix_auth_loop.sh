#!/bin/bash

echo "🔄 Исправляем циклический редирект аутентификации..."

# 1. Обновляем AuthContext
echo "🔐 Обновляем AuthContext..."
cat > src/contexts/AuthContext.tsx << 'AUTH'
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';

type Role = 'ADMIN' | 'MANAGER' | 'TECHNICAL_SPECIALIST' | 'SUPER_ADMIN' | 'RICHMARKET_CEO' | 'RICHMARKET_MANAGER';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // Восстанавливаем пользователя из localStorage при инициализации
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          return JSON.parse(savedUser);
        } catch {
          return null;
        }
      }
    }
    return null;
  });
  
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const verifyToken = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setUser(null);
        return false;
      }

      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': \`Bearer \${token}\`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        return true;
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('Token verification error:', error);
      return false;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      if (pathname === '/login') {
        setLoading(false);
        return;
      }

      await verifyToken();
      setLoading(false);
    };

    initAuth();
  }, [pathname]);

  const login = async (loginInput: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginInput, password }),
      });

      if (!response.ok) {
        throw new Error('Ошибка авторизации');
      }

      const data = await response.json();
      
      if (data.access_token && data.user) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        
        toast.success(\`Добро пожаловать, \${data.user.name}!\`);
        
        // Используем window.location для надежного редиректа
        window.location.href = '/dashboard';
      } else {
        throw new Error('Неверный ответ от сервера');
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка входа');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': \`Bearer \${token}\`,
          },
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
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
AUTH

# 2. Упрощаем ProtectedRoute
echo "🛡️ Упрощаем ProtectedRoute..."
cat > src/components/ProtectedRoute.tsx << 'PROTECTED'
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

type Role = 'ADMIN' | 'MANAGER' | 'TECHNICAL_SPECIALIST' | 'SUPER_ADMIN' | 'RICHMARKET_CEO' | 'RICHMARKET_MANAGER';

export default function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: Role[];
}) {
  const { user, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      console.log('Not authenticated, will redirect from middleware');
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-slate-400">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Middleware сделает редирект
  }

  // SUPER_ADMIN имеет доступ ко всему
  if (user?.role === 'SUPER_ADMIN') {
    return <>{children}</>;
  }

  // Проверяем права
  if (allowedRoles && allowedRoles.length > 0 && user) {
    const hasAccess = allowedRoles.includes(user.role as Role);
    
    if (!hasAccess) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Доступ запрещен</h1>
            <p className="text-gray-400">У вас нет прав для доступа к этой странице</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
PROTECTED

# 3. Обновляем middleware для правильного редиректа
echo "🛠️ Обновляем middleware..."
cat > ../middleware.ts << 'MIDDLEWARE'
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Публичные пути
  const publicPaths = ['/login', '/api/auth/login'];
  const isPublic = publicPaths.some(path => pathname.startsWith(path));
  
  // Если это публичный путь, пропускаем
  if (isPublic) {
    return NextResponse.next();
  }
  
  // Проверяем токен в cookie или localStorage (через заголовок)
  const token = request.cookies.get('token')?.value || 
                request.headers.get('Authorization')?.replace('Bearer ', '');
  
  // Если нет токена и это не публичный путь - редирект на /login
  if (!token) {
    console.log('🛠️ Middleware: No token found, redirecting to /login');
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
MIDDLEWARE

echo ""
echo "✅ Исправления применены!"
echo ""
echo "🔧 Основные изменения:"
echo "1. AuthContext теперь восстанавливает пользователя из localStorage"
echo "2. ProtectedRoute не делает редирект самостоятельно (это делает middleware)"
echo "3. После логина используется window.location.href для надежного редиректа"
echo "4. Middleware проверяет токен и делает редирект при необходимости"
echo ""
echo "🚀 Перезапустите проект: npm run dev"
