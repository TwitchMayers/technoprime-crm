'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  AlertTriangle,
  Users,
  Calendar,
  Plus,
  Trash2,
  BarChart3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { toast } from 'sonner';

import ProtectedRoute from '@/components/ProtectedRoute';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

/* =======================
   TYPES
======================= */

type Overview = {
  totals: {
    ordersClosed: number;
    revenue: number;
    cost: number;
    profit: number;
    adSpend: number;
    netProfit: number;
    activeClients?: number;
    conversionRate?: number;
  };
  seriesByDay: {
    date: string;
    revenue: number;
    profit: number;
    adSpend: number;
    netProfit: number;
  }[];
};

type AdSpendEntry = {
  id?: number;
  date: string;
  adSku: string;
  amount: number;
  note?: string;
};

type AdSalesData = {
  adSku: string;
  revenue: number;
  profit: number;
  roi: number;
};

/* =======================
   HELPERS
======================= */

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('ru-RU').format(Math.round(v)) + ' ₽';

const todayStr = () => new Date().toISOString().split('T')[0];

const KPI_STATE = (value: number) => {
  if (value > 0) return 'ok';
  if (value === 0) return 'warn';
  return 'danger';
};

/* =======================
   KPI CARD
======================= */

function Kpi({
  title,
  value,
  subtitle,
  state,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  state: 'ok' | 'warn' | 'danger';
  icon: any;
}) {
  const colors = {
    ok: 'from-emerald-500 to-green-600',
    warn: 'from-amber-500 to-orange-600',
    danger: 'from-rose-500 to-red-600',
  };

  return (
    <motion.div
      layout
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-5"
    >
      <div
        className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${colors[state]}`}
      />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {title}
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {value}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {subtitle}
          </div>
        </div>
        <div
          className={`p-3 rounded-xl bg-gradient-to-br ${colors[state]} text-white shadow-lg`}
        >
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </motion.div>
  );
}

/* =======================
   PAGE
======================= */

export default function DashboardPage() {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [overview, setOverview] = useState<Overview | null>(null);
  const [adSpendToday, setAdSpendToday] = useState<AdSpendEntry[]>([]);
  const [adSales, setAdSales] = useState<AdSalesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<'revenue' | 'profit' | 'net'>(
    'revenue'
  );

  /* =======================
     LOAD
  ======================= */

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const qs = `from=${from}&to=${to}`;

        const [ov, ads, spend] = await Promise.all([
          fetchWithAuth(`/api/analytics/overview?${qs}`).then(r => r.json()),
          fetchWithAuth(`/api/analytics/sales-by-ads?${qs}`).then(r => r.json()),
          fetchWithAuth(`/api/ad-spend?from=${todayStr()}&to=${todayStr()}`).then(r => r.json()),
        ]);

        setOverview(ov);
        setAdSales(ads || []);
        setAdSpendToday(spend || []);
      } catch {
        toast.error('Ошибка загрузки дашборда');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [from, to]);

  const totals = overview?.totals;

  const alerts = useMemo(() => {
    if (!totals) return [];
    const res: string[] = [];
    if (totals.netProfit < 0) res.push('Отрицательная чистая прибыль');
    if (totals.adSpend > totals.profit)
      res.push('Реклама съедает прибыль');
    if ((totals.conversionRate || 0) < 2)
      res.push('Низкая конверсия');
    return res;
  }, [totals]);

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <div className="min-h-screen flex items-center justify-center text-slate-400">
          Загрузка…
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <div className="space-y-8 pb-24">

        {/* COMMAND CENTER */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-white/10 bg-black/70 backdrop-blur-xl p-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">
                Сегодня в бизнесе
              </h1>
              <p className="text-slate-400 mt-1">
                {new Date().toLocaleDateString('ru-RU', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
            </div>
            <Calendar className="w-6 h-6 text-slate-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <Kpi
              title="Выручка"
              value={formatCurrency(totals?.revenue || 0)}
              subtitle={`${totals?.ordersClosed || 0} заказов`}
              state={KPI_STATE(totals?.revenue || 0)}
              icon={DollarSign}
            />
            <Kpi
              title="Прибыль"
              value={formatCurrency(totals?.profit || 0)}
              subtitle="До рекламы"
              state={KPI_STATE(totals?.profit || 0)}
              icon={TrendingUp}
            />
            <Kpi
              title="Реклама"
              value={formatCurrency(totals?.adSpend || 0)}
              subtitle="Расходы"
              state={KPI_STATE(-(totals?.adSpend || 0))}
              icon={Target}
            />
            <Kpi
              title="Чистая прибыль"
              value={formatCurrency(totals?.netProfit || 0)}
              subtitle="Финальный итог"
              state={KPI_STATE(totals?.netProfit || 0)}
              icon={TrendingDown}
            />
          </div>
        </motion.div>

        {/* ALERTS */}
        {alerts.length > 0 && (
          <motion.div className="space-y-2">
            {alerts.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 text-rose-300"
              >
                <AlertTriangle className="w-5 h-5" />
                {a}
              </div>
            ))}
          </motion.div>
        )}

        {/* MAIN CHART */}
        <div className="rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">
              Динамика
            </h2>
            <div className="flex gap-2">
              {(['revenue', 'profit', 'net'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setChartMode(m)}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    chartMode === m
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {m === 'revenue'
                    ? 'Выручка'
                    : m === 'profit'
                    ? 'Прибыль'
                    : 'Чистая'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={overview?.seriesByDay || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#020617',
                    border: '1px solid #334155',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={
                    chartMode === 'revenue'
                      ? 'revenue'
                      : chartMode === 'profit'
                      ? 'profit'
                      : 'netProfit'
                  }
                  stroke="#6366f1"
                  fill="rgba(99,102,241,0.25)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ROI */}
        {adSales.length > 0 && (
          <div className="rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              ROI по товарам
            </h2>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={adSales}>
                  <XAxis dataKey="adSku" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="roi" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
