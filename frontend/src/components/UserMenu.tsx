'use client';

import { useEffect, useState } from 'react';
import { User, Settings as SettingsIcon } from 'lucide-react';
import Link from 'next/link';

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    fetch('/api/me').then(r=>r.json()).then(setMe).catch(()=>null);
  }, []);

  const name = me?.name || (me?.firstName || me?.lastName ? `${me.firstName||''} ${me.lastName||''}`.trim() : 'Профиль');

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 transition"
        onClick={() => setOpen(!open)}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-teal-500 flex items-center justify-center">
          <User className="w-4 h-4" />
        </div>
        <span className="text-sm hidden md:inline">{name}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 glass p-2 z-50 animate-fade-in">
            <div className="p-2">
              <div className="text-white font-medium">{name}</div>
              <div className="text-xs text-slate-400">{me?.role || me?.position}</div>
            </div>
            <div className="border-t border-white/10 my-2" />
            <Link className="block px-3 py-2 rounded hover:bg-white/10 transition text-sm" href="/profile">
              Личный кабинет
            </Link>
            {me?.role === 'ADMIN' && (
              <Link className="block px-3 py-2 rounded hover:bg-white/10 transition text-sm" href="/profile/admin">
                Админ‑панель
              </Link>
            )}
            <Link className="flex items-center gap-2 px-3 py-2 rounded hover:bg-white/10 transition text-sm" href="/profile">
              <SettingsIcon className="w-4 h-4" />
              Настройки
            </Link>
          </div>
        </>
      )}
    </div>
  );
}