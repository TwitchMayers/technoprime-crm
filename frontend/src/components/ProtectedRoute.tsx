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
