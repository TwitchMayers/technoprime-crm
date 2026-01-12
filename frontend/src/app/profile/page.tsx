'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket, registerUser } from '@/lib/socket';
import { toast } from 'sonner';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

type Metric = { 
  period: string; 
  closedCount: number; 
  revenue: number; 
  profit: number; 
  activeCount: number; 
  queueCount: number; 
};

type Order = { 
  id: number; 
  status: 'NEW'|'IN_PROGRESS'|'COMPLETED'|'CANCELED'; 
  client?: { name?: string; phone?: string }; 
  totalPrice?: number; 
  date?: string; 
};

function Kpi({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="glass p-4">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [period, setPeriod] = useState<'today'|'week'|'month'>('today');
  const [metrics, setMetrics] = useState<Metric|null>(null);
  const [queue, setQueue] = useState<Order[]>([]);
  const [mineActive, setMineActive] = useState<Order[]>([]);
  const [mineDone, setMineDone] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      const u = await fetchWithAuth('/api/me').then(r=>r.json()).catch(()=>null);
      setMe(u);
      if (u?.role === 'ADMIN' || u?.role === 'SUPER_ADMIN') {
        router.replace('/dashboard');
      }
    };
    run();
  }, [router]);

  const money = (v?: number) => `${Number(v || 0).toLocaleString()} ₽`;

  const loadMetrics = async (p: 'today'|'week'|'month') => {
    const m = await fetchWithAuth(`/api/metrics?period=${p}`).then(r=>r.json()).catch(()=>null);
    setMetrics(m);
  };

  const loadQueue = async () => {
    const res = await fetchWithAuth('/api/orders/queue').then(r=>r.json()).catch(()=>[]);
    const list = Array.isArray(res) ? res : (res?.items || []);
    setQueue(list);
  };

  const loadMine = async (uid?: number) => {
    if (!uid) return;
    
    const [activeRes, doneRes] = await Promise.all([
      fetchWithAuth(`/api/orders?assigneeId=${uid}&status=IN_PROGRESS`).then(r=>r.json()).catch(()=>[]),
      fetchWithAuth(`/api/orders?assigneeId=${uid}&status=COMPLETED`).then(r=>r.json()).catch(()=>[]),
    ]);

    const active = Array.isArray(activeRes) ? activeRes : (activeRes?.items || []);
    const done = Array.isArray(doneRes) ? doneRes : (doneRes?.items || []);

    setMineActive(active);
    setMineDone(done);
  };

  useEffect(() => { 
    loadMetrics(period); 
    const t = setInterval(() => loadMetrics(period), 8000); 
    return () => clearInterval(t); 
  }, [period]);

  useEffect(() => {
    loadQueue();
    const s = getSocket();
    const handler = () => { 
      loadQueue(); 
      if (me?.id) loadMine(me.id); 
    };
    s.on('queueUpdated', handler);
    return () => { s.off('queueUpdated', handler); };
  }, [me?.id]);

  useEffect(() => {
    if (!me?.id) return;
    registerUser(me.id);
    loadMine(me.id);
  }, [me?.id]);

  const name = useMemo(() => {
    if (!me) return '';
    return me.firstName || me.lastName ? `${me.firstName || ''} ${me.lastName || ''}`.trim() : me.name;
  }, [me]);

  const accept = async (o: Order) => {
    setLoading(true);
    try {
      const meRes = await fetchWithAuth('/api/me').then(r=>r.json()).catch(()=>null);
      const res = await fetchWithAuth(`/api/orders/assign`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ orderId: o.id, assigneeId: meRes?.id || 1 })
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let msg = text;
        try { 
          const j = JSON.parse(text); 
          msg = j?.message || text; 
        } catch {}
        toast.error(msg || 'Не удалось принять заказ');
        return;
      }

      toast.success(`Заказ #${o.id} принят`);
      await Promise.all([loadQueue(), loadMine(meRes?.id)]);
    } finally { 
      setLoading(false); 
    }
  };

  if (me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-400">Перенаправление на дашборд…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">{name || 'Профиль'}</h1>
        <div className="text-slate-400">{me?.position || me?.role}</div>
      </div>

      <div className="flex gap-2">
        <button 
          className={`px-3 py-2 rounded-md transition ${period==='today'?'bg-purple-600':'bg-slate-700/50 hover:bg-slate-600/50'}`} 
          onClick={()=>setPeriod('today')}
        >
          Сегодня
        </button>
        <button 
          className={`px-3 py-2 rounded-md transition ${period==='week'?'bg-purple-600':'bg-slate-700/50 hover:bg-slate-600/50'}`} 
          onClick={()=>setPeriod('week')}
        >
          Неделя
        </button>
        <button 
          className={`px-3 py-2 rounded-md transition ${period==='month'?'bg-purple-600':'bg-slate-700/50 hover:bg-slate-600/50'}`} 
          onClick={()=>setPeriod('month')}
        >
          Месяц
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi title="Закрыто" value={metrics?.closedCount ?? 0} />
        <Kpi title="Моя выручка" value={money(metrics?.revenue)} />
        <Kpi title="Моя маржа" value={money(metrics?.profit)} />
        <Kpi title="Активные заказы" value={metrics?.activeCount ?? 0} />
      </div>

      <div className="glass p-4">
        <div className="p-2 text-sm text-slate-300 font-semibold mb-2">Заказы к принятию</div>
        <div className="max-h-[50vh] overflow-auto">
          {queue.length === 0 ? (
            <div className="p-4 text-slate-400 text-center">Нет заказов в очереди</div>
          ) : (
            <div className="space-y-2">
              {queue.map(o => (
                <div key={o.id} className="flex items-center justify-between rounded-lg bg-slate-800/50 border border-slate-700/50 px-4 py-3">
                  <div className="text-white">
                    <span className="font-semibold">#{o.id}</span> • {o.client?.name} 
                    {o.client?.phone && <span className="text-slate-400 ml-2">({o.client.phone})</span>}
                  </div>
                  <button 
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 transition disabled:opacity-50 font-medium text-sm"
                    disabled={loading} 
                    onClick={() => accept(o)}
                  >
                    Принять
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass p-4">
          <div className="font-semibold mb-3 text-white">Мои активные заказы</div>
          <div className="space-y-2">
            {mineActive.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-4">Нет активных</div>
            ) : (
              mineActive.map(o => (
                <div key={o.id} className="rounded-lg bg-slate-800/30 border border-slate-700/50 px-3 py-2">
                  <div className="text-white font-medium">#{o.id} • {o.client?.name}</div>
                  {o.client?.phone && (
                    <div className="text-xs text-slate-400 mt-1">{o.client.phone}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass p-4">
          <div className="font-semibold mb-3 text-white">Мои завершённые</div>
          <div className="space-y-2">
            {mineDone.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-4">Ещё нет</div>
            ) : (
              mineDone.map(o => (
                <div key={o.id} className="rounded-lg bg-slate-800/30 border border-slate-700/50 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-white font-medium">#{o.id} • {o.client?.name}</div>
                    <div className="text-teal-400 font-bold">{money(o.totalPrice)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}