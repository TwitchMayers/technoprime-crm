'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSocket, registerUser } from '@/lib/socket';

type Metric = { period: string; closedCount: number; revenue: number; profit: number; activeCount: number; queueCount: number; };

function Kpi({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="glass p-4">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}

export default function ProfilePage() {
  const [me, setMe] = useState<any>(null);
  const [period, setPeriod] = useState<'today'|'month'|'week'>('today');
  const [metrics, setMetrics] = useState<Metric|null>(null);
  const [queue, setQueue] = useState<any[]>([]);

  const loadMe = async () => {
    const u = await fetch('/api/me').then(r=>r.json()).catch(()=>null);
    setMe(u);
  };

  const loadMetrics = async (p: 'today'|'week'|'month') => {
    const m = await fetch(`/api/metrics?period=${p}`).then(r=>r.json()).catch(()=>null);
    setMetrics(m);
  };

  const loadQueue = async () => {
    const list = await fetch('/api/orders/queue').then(r=>r.json()).catch(()=>[]);
    setQueue(list || []);
  };

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    loadMetrics(period);
    const t = setInterval(()=>loadMetrics(period), 8000);
    return ()=> clearInterval(t);
  }, [period]);

  useEffect(() => {
    loadQueue();
    const s = getSocket();
    s.on('queueUpdated', ()=> loadQueue());
    return () => { s.off('queueUpdated'); };
  }, []);

  useEffect(() => {
    if (!me?.id) return;
    const s = getSocket();
    registerUser(me.id);
  }, [me?.id]);

  const name = useMemo(() => {
    if (!me) return '';
    return me.firstName || me.lastName ? `${me.firstName || ''} ${me.lastName || ''}`.trim() : me.name;
  }, [me]);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">{name}</h1>
        <div className="text-slate-400">{me?.position || me?.role}</div>
      </div>

      <div className="flex gap-2">
        <button className={`px-3 py-2 rounded-md ${period==='today'?'bg-white/10':'bg-white/5'}`} onClick={()=>setPeriod('today')}>Сегодня</button>
        <button className={`px-3 py-2 rounded-md ${period==='week'?'bg-white/10':'bg-white/5'}`} onClick={()=>setPeriod('week')}>Неделя</button>
        <button className={`px-3 py-2 rounded-md ${period==='month'?'bg-white/10':'bg-white/5'}`} onClick={()=>setPeriod('month')}>Месяц</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi title="Закрыто" value={metrics?.closedCount ?? 0} />
        <Kpi title="Моя выручка" value={`${(metrics?.revenue ?? 0).toLocaleString()} ₽`} />
        <Kpi title="Моя маржа" value={`${(metrics?.profit ?? 0).toLocaleString()} ₽`} />
        <Kpi title="Активные заказы" value={metrics?.activeCount ?? 0} />
      </div>

      <div className="glass p-2">
        <div className="p-2 text-sm text-slate-300">Заказы к принятию</div>
        <div className="max-h-[50vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#0b1220]">
              <tr className="text-slate-400">
                <th className="text-left p-2">№</th>
                <th className="text-left p-2">Клиент</th>
                <th className="text-left p-2">Телефон</th>
                <th className="text-left p-2">Дата</th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 ? (
                <tr><td className="p-2 text-slate-400">Нет заказов</td></tr>
              ) : queue.map((o:any) => (
                <tr key={o.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="p-2">{o.id}</td>
                  <td className="p-2">{o.client?.name}</td>
                  <td className="p-2">{o.client?.phone}</td>
                  <td className="p-2">{new Date(o.date).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}