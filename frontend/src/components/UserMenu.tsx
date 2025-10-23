'use client';
import { useEffect, useState } from 'react';

export default function UserMenu() {
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.ok ? r.json() : null)
      .then(setUser)
      .catch(() => {});
  }, []);

  if (!user) return null;

  const name = user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.name;
  const role = user.position || user.role;

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="px-3 py-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 transition">
        {name} • {role}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 glass p-2">
          <a href="/profile" className="block px-3 py-2 rounded hover:bg-white/5">Профиль</a>
          <button
            className="w-full text-left px-3 py-2 rounded hover:bg-white/5"
            onClick={() => { localStorage.removeItem('token'); window.location.href = '/login'; }}
          >
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}