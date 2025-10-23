'use client';
import { useEffect, useState } from 'react';
import { getSocket, registerUser } from '@/lib/socket';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);

  const load = async () => {
    const u = await fetch('/api/me').then(r => r.json()).catch(() => null);
    setMe(u);
    if (!u?.id) return;
    const list = await fetch(`/api/notifications?unread=true&userId=${u.id}`)
      .then(r => r.json())
      .catch(() => []);
    setItems(list || []);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!me?.id) return;
    const s = getSocket();
    registerUser(me.id);
    const onNotification = () => load(); // только перезагрузка списка с бэка
    s.on('notification', onNotification);
    return () => { s.off('notification', onNotification); };
  }, [me?.id]);

  const unread = items.length;

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="px-3 py-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 relative">
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 text-xs bg-rose-600 rounded-full px-1">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 glass p-2 max-h-80 overflow-auto">
          <div className="text-sm text-slate-400 px-1 pb-2">Уведомления</div>
          {items.length === 0 ? (
            <div className="text-sm text-slate-400 px-2 py-2">Нет новых</div>
          ) : (
            items.map((n: any) => (
              <div key={n.id} className="px-2 py-2 rounded hover:bg-white/5 flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-medium">{n.type}</div>
                  <div className="text-slate-400 text-xs">{new Date(n.createdAt).toLocaleString()}</div>
                </div>
                {!!n.id && (
                  <button
                    className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                    onClick={async () => {
                      await fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' });
                      setItems(items.filter((i) => i.id !== n.id));
                    }}
                  >
                    Прочитано
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}