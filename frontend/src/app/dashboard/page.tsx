'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import dayjs from 'dayjs';

type Order = { id: number; date: string; totalPrice: string; costPrice: string; profit: string; };

function Kpi({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="glass p-4">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: async () => (await api.get('/orders')).data,
    refetchInterval: 8000,
  });

  const { revenue, profit, avgCheck, chart } = useMemo(() => {
    const rev = orders.reduce((s, o) => s + Number(o.totalPrice), 0);
    const prof = orders.reduce((s, o) => s + Number(o.profit), 0);
    const avg = orders.length ? Math.round(rev / orders.length) : 0;
    const grouped: Record<string, { date: string; revenue: number; profit: number }> = {};
    orders.forEach(o => {
      const d = dayjs(o.date).format('DD.MM');
      if (!grouped[d]) grouped[d] = { date: d, revenue: 0, profit: 0 };
      grouped[d].revenue += Number(o.totalPrice);
      grouped[d].profit += Number(o.profit);
    });
    return { revenue: rev, profit: prof, avgCheck: avg, chart: Object.values(grouped) };
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass p-6">
          <h2 className="text-2xl font-extrabold mb-2">Сделай заказ — смотри, как растёт график</h2>
          <p className="text-slate-400 mb-4">
            Создавай заказы — система считает выручку и маржу. График обновляется в реальном времени.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="pill">Маржа</span>
            <span className="pill">Выручка</span>
            <span className="pill">7 дней</span>
            <span className="pill">30 дней</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="pill">0 заказов сегодня</div>
            <div className="pill">Выручка: {(revenue || 0).toLocaleString()} ₽</div>
            <div className="pill">Маржа: {(profit || 0).toLocaleString()} ₽</div>
          </div>
        </div>

        <div className="glass p-2">
            <div className="w-full min-w-0">
                <ResponsiveContainer width="100%" aspect={2.4}>
                <LineChart data={chart}>
                    <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.2}/>
                    </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,.08)" strokeDasharray="4 4" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,.12)' }} />
                    <Line type="monotone" dataKey="revenue" stroke="url(#grad)" strokeWidth={3} dot={false} />
                </LineChart>
                </ResponsiveContainer>
            </div>
</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi title="Выручка (всего)" value={`${revenue.toLocaleString()} ₽`} />
        <Kpi title="Прибыль (всего)" value={`${profit.toLocaleString()} ₽`} />
        <Kpi title="Средний чек" value={`${(avgCheck || 0).toLocaleString()} ₽`} />
      </div>
    </div>
  );
}