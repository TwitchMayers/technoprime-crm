'use client';

import { useEffect, useState } from 'react';
import { DollarSign, ShoppingCart, TrendingUp, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { toast } from 'sonner';
import KpiCard from '@/components/dashboard/KpiCard';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

type Overview = {
  totals: { ordersClosed:number; revenue:number; cost:number; profit:number; adSpend:number; netProfit:number };
  seriesByDay: { date:string; revenue:number; profit:number; adSpend:number; netProfit:number }[];
};
type EmpRow = { employeeId:number; name:string; closedCount:number; revenue:number; profit:number };
type SeasonRow = { month:string; sales:number };

const AD_SKUS = ['PS5','PS4','XBOX_ONE_S','XBOX_SERIES_S','XBOX_SERIES_X','NINTENDO_SWITCH','STEAM_DECK'] as const;
const PIE_COLORS = ['#5dd3b3','#a78bfa','#ef4444','#f59e0b','#22d3ee','#ec4899','#14b8a6'];
const money = (v?: number) => `${Number(v || 0).toLocaleString()} ₽`;

export default function DashboardPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [ov, setOv] = useState<Overview | null>(null);
  const [emps, setEmps] = useState<EmpRow[]>([]);
  const [adPie, setAdPie] = useState<{name:string; value:number}[]>([]);
  const [seasonality, setSeasonality] = useState<SeasonRow[]>([]);
  const [adRows, setAdRows] = useState<{adSku:string; amount:string; note:string}[]>(
    AD_SKUS.map(s=>({ adSku:s, amount:'', note:'' }))
  );

  const loadAll = async () => {
    const qs = new URLSearchParams(); if (from) qs.set('from', from); if (to) qs.set('to', to);
    const [overview, employees, salesByAds, season] = await Promise.all([
      fetchWithAuth(`/api/analytics/overview?${qs}`).then(r=>r.json()).catch(()=>null),
      fetchWithAuth(`/api/analytics/employees?${qs}`).then(r=>r.json()).catch(()=>[]),
      fetchWithAuth(`/api/analytics/sales-by-ads?${qs}`).then(r=>r.json()).catch(()=>[]),
      fetchWithAuth('/api/analytics/seasonality').then(r=>r.json()).catch(()=>[]),
    ]);
    setOv(overview);
    setEmps(employees || []);
    const pie = (salesByAds || []).map((x:any)=>({ name: x.adSku, value: x.adSpend||0 })).filter((x:any)=>x.value>0);
    setAdPie(pie);
    setSeasonality(season || []);
  };

  const loadAdSpendDay = async () => {
    const date = (new Date()).toISOString().slice(0,10);
    const data = await fetchWithAuth(`/api/ad-spend?from=${date}&to=${date}`).then(r=>r.json()).catch(()=>[]);
    const map = new Map<string,any>();
    (data||[]).forEach((r:any)=>map.set(r.adSku,r));
    setAdRows(AD_SKUS.map(s=>{
      const x = map.get(s);
      return { adSku:s, amount: x?String(x.amount):'', note: x?.note||'' };
    }));
  };

  const saveRow = async (r:{adSku:string; amount:string; note:string}) => {
    const date = (new Date()).toISOString().slice(0,10);
    const amt = Number((r.amount||'').replace(',', '.')) || 0;
    const body = { date, adSku: r.adSku, amount: amt, note: r.note };
    const res = await fetchWithAuth('/api/ad-spend', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!res.ok) { toast.error('Ошибка сохранения'); return; }
    toast.success('Сохранено');
    await loadAll();
    await loadAdSpendDay();
  };

  useEffect(() => { loadAll(); loadAdSpendDay(); }, []);

  return (
    <div className="space-y-6">
      <div className="glass p-4 flex items-center justify-between">
        <div className="text-xl font-bold">Дашборд руководителя</div>
        <div className="flex items-center gap-2">
          <input type="date" className="rounded bg-white/5 border border-white/10 px-3 py-2" value={from} onChange={e=>setFrom(e.target.value)} />
          <input type="date" className="rounded bg-white/5 border border-white/10 px-3 py-2" value={to} onChange={e=>setTo(e.target.value)} />
          <button className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-700 transition" onClick={loadAll}>Обновить</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard icon={ShoppingCart} title="Закрыто" value={ov?.totals.ordersClosed ?? 0} color="orange" />
        <KpiCard icon={DollarSign} title="Выручка" value={money(ov?.totals.revenue)} color="teal" />
        <KpiCard icon={TrendingUp} title="Маржа" value={money(ov?.totals.profit)} color="green" />
        <KpiCard icon={BarChart3} title="Реклама" value={money(ov?.totals.adSpend)} subtitle="расходы" color="orange" />
        <KpiCard icon={TrendingUp} title="Чистая прибыль" value={money(ov?.totals.netProfit)} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass p-4">
          <div className="text-lg font-semibold mb-3">Динамика выручки и маржи</div>
          <div className="w-full h-72">
            <ResponsiveContainer>
              <AreaChart data={ov?.seriesByDay || []}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5dd3b3" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#5dd3b3" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #444' }} />
                <Area type="monotone" dataKey="revenue" stroke="#5dd3b3" fill="url(#gradRevenue)" strokeWidth={2} name="Выручка" />
                <Area type="monotone" dataKey="profit" stroke="#a78bfa" fill="url(#gradProfit)" strokeWidth={2} name="Маржа" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass p-4">
          <div className="text-lg font-semibold mb-3">Расходы на рекламу (по SKU)</div>
          <div className="w-full h-72 flex items-center justify-center">
            {adPie.length === 0 ? (
              <div className="text-slate-400 text-sm">Нет данных</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={adPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {adPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background:'#1e1e2e', border:'1px solid #444' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass p-4">
          <div className="text-lg font-semibold mb-3">Сезонность (по месяцам)</div>
          <div className="w-full h-72">
            <ResponsiveContainer>
              <BarChart data={seasonality}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip contentStyle={{ background:'#1e1e2e', border:'1px solid #444' }} />
                <Bar dataKey="sales" fill="#a78bfa" radius={[8,8,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass p-4">
          <div className="text-lg font-semibold mb-3">Top Performance (менеджеры)</div>
          <div className="space-y-3">
            {emps.slice(0,5).map((e,i)=>{
              const max = Math.max(...emps.map(x=>x.revenue), 1);
              const pct = Math.round((e.revenue/max)*100);
              return (
                <div key={e.employeeId} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-teal-500 flex items-center justify-center text-xs font-bold">
                    {i+1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{e.name}</div>
                    <div className="text-xs text-slate-400">{e.closedCount} заказов • {money(e.revenue)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-teal-400 to-purple-500" style={{width:`${pct}%`}} />
                    </div>
                    <span className="text-xs text-slate-400 w-10 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
            {emps.length===0 && <div className="text-slate-400 text-sm p-4 text-center">Нет данных</div>}
          </div>
        </div>
      </div>

      <div className="glass p-4">
        <div className="text-lg font-semibold mb-3">Рекламные расходы за день</div>
        <div className="text-xs text-slate-400 mb-3">Вводите сумму по каждой позиции и нажимайте "Сохранить".</div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr className="border-b border-white/10">
                <th className="text-left p-2">Позиция</th>
                <th className="p-2">Сумма (₽)</th>
                <th className="p-2">Комментарий</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {adRows.map((r, idx)=>(
                <tr key={r.adSku} className="border-t border-white/5">
                  <td className="p-2">{r.adSku.replaceAll('_',' ')}</td>
                  <td className="p-2">
                    <input
                      className="w-32 rounded bg-white/5 border border-white/10 px-2 py-1 text-right"
                      value={r.amount}
                      onChange={e=>{ const v=[...adRows]; v[idx].amount=e.target.value; setAdRows(v); }}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="w-full rounded bg-white/5 border border-white/10 px-2 py-1"
                      value={r.note}
                      onChange={e=>{ const v=[...adRows]; v[idx].note=e.target.value; setAdRows(v); }}
                    />
                  </td>
                  <td className="p-2 text-right">
                    <button
                      className="px-3 py-1 rounded bg-teal-600 hover:bg-teal-700 transition text-xs"
                      onClick={()=> saveRow(r)}
                    >
                      Сохранить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
