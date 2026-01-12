'use client';

import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';

type Notif = { id?:string; type?:string; title?:string; text?:string; createdAt?:string };

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Notif[]>([]);
  const asked = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && !asked.current) {
      asked.current = true;
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(()=>null);
      }
    }

    const s = getSocket();
    const onNotif = (n: any) => {
      const item: Notif = {
        id: n?.id || String(Date.now()),
        type: n?.type,
        title: n?.title || n?.type || 'Уведомление',
        text: n?.text || n?.payload?.message,
        createdAt: new Date().toISOString(),
      };
      setList(prev => [item, ...prev].slice(0, 50));
      toast.info(item.title, { description: item.text });
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try { new Notification(item.title || 'Уведомление', { body: item.text || '' }); } catch {}
      }
    };

    s.on('notification', onNotif);
    s.on('notify', onNotif);
    return () => { s.off('notification', onNotif); s.off('notify', onNotif); };
  }, []);

  return (
    <div className="relative">
      <button
        className="relative p-2.5 rounded-md bg-white/5 hover:bg-white/10 transition"
        onClick={() => setOpen(!open)}
      >
        <Bell className="w-5 h-5 text-slate-300" />
        {list.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-gradient-to-r from-rose-500 to-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {list.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 glass p-3 z-50 animate-fade-in">
            <div className="text-sm font-semibold mb-2">Уведомления</div>
            <div className="max-h-80 overflow-auto space-y-2">
              {list.length === 0 ? (
                <div className="text-slate-400 text-sm p-4 text-center">Нет новых</div>
              ) : (
                list.map((n, i) => (
                  <div key={n.id || i} className="p-3 rounded-md bg-white/5 hover:bg-white/10 transition border border-white/5">
                    <div className="text-sm font-medium">{n.title}</div>
                    {n.text && <div className="text-xs text-slate-400 mt-1">{n.text}</div>}
                    <div className="text-[10px] text-slate-500 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString('ru') : ''}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}