'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

export type SystemType = 'TECHNOPRIME' | 'RICHMARKET';

export function useCurrentSystem(): SystemType {
  const pathname = usePathname();
  if (pathname?.startsWith('/richmarket')) return 'RICHMARKET';
  return 'TECHNOPRIME';
}

export default function SystemSwitcher() {
  const { user } = useAuth();
  const router = useRouter();
  const currentSystem = useCurrentSystem();
  
  if (user?.role !== 'SUPER_ADMIN') return null;

  const switchTo = (system: SystemType) => {
    localStorage.setItem('currentSystem', system);
    
    if (system === 'RICHMARKET') {
      router.push('/richmarket/dashboard');
    } else {
      router.push('/dashboard');
    }
    
    window.location.reload(); // Перезагрузка для обновления sidebar
  };

  return (
    <div className="p-3 border-t border-slate-700/50">
      <div className="text-xs text-slate-500 mb-2 text-center">Переключение системы</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => switchTo('TECHNOPRIME')}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            currentSystem === 'TECHNOPRIME'
              ? 'bg-gradient-to-r from-purple-600 to-teal-600 text-white shadow-lg'
              : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
          }`}
        >
          🎮 TechnoPrime
        </button>
        <button
          onClick={() => switchTo('RICHMARKET')}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            currentSystem === 'RICHMARKET'
              ? 'bg-gradient-to-r from-pink-600 to-orange-600 text-white shadow-lg'
              : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
          }`}
        >
          👔 RichMarket
        </button>
      </div>
    </div>
  );
}