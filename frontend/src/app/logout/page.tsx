'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function LogoutPage() {
  const { logout } = useAuth();

  useEffect(() => {
    logout();
  }, [logout]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass p-8">
        <div className="text-slate-400">Выход из системы…</div>
      </div>
    </div>
  );
}