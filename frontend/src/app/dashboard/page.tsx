'use client';

import { useEffect, useState, useMemo } from 'react';
import { Calendar, TrendingUp, Package, Plus, Trash2, Users, ShoppingCart, DollarSign, Target, AlertCircle, ArrowUp, ArrowDown, RefreshCw, Download, Filter, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ProtectedRoute from '@/components/ProtectedRoute';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

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
  seriesByDay: { date: string; revenue: number; profit: number; adSpend: number; netProfit: number }[];
};

type EmpRow = { 
  employeeId: number; 
  name: string; 
  closedCount: number; 
  revenue: number; 
  profit: number;
};

type AdSalesData = {
  adSku: string;
  totalSpend: number;
  revenue: number;
  profit: number;
  roi: number;
  orders: number;
};

type AdSpendEntry = {
  id?: number;
  date: string;
  adSku: string;
  amount: number;
  note?: string;
};

type Client = {
  id: number;
  name: string;
  phone: string;
  email?: string;
  ordersCount: number;
  totalSpent: number;
  lastOrder?: string;
  status: 'active' | 'inactive';
};

type Task = {
  id: number;
  status: string;
  [key: string]: any;
};

type TaskStats = {
  total: number;
  new: number;
  inProgress: number;
  completed: number;
  avgCompletionTime: number;
};

type PieChartData = {
  name: string;
  value: number;
};

const AD_SKUS = ['PS5', 'PS4', 'XBOX_ONE_S', 'XBOX_SERIES_S', 'XBOX_SERIES_X', 'NINTENDO_SWITCH', 'STEAM_DECK'] as const;

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + ' ₽';
};

const formatDateShort = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

// KPI CARD
const KpiCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  accentColor,
  trend,
  alert
}: { 
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  accentColor: string;
  trend?: { value: number; isPositive: boolean };
  alert?: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -4 }}
    className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl p-6 transition-all cursor-pointer ${
      alert
        ? 'bg-gradient-to-br from-red-900/20 to-red-900/5 border-red-500/30 shadow-lg shadow-red-500/10 hover:shadow-red-500/20'
        : `bg-gradient-to-br ${accentColor} border-slate-700/50 shadow-lg shadow-black/20 hover:shadow-lg`
    }`}
  >
    <div className="flex items-start justify-between mb-4">
      <div className="flex-1">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</p>
        <p className="text-3xl md:text-4xl font-bold text-white mb-2">{value}</p>
        <p className="text-sm text-slate-400">{subtitle}</p>
        
        {trend && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center gap-1 mt-3 text-sm font-bold ${
              trend.isPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {trend.isPositive ? (
              <ArrowUp className="w-4 h-4" />
            ) : (
              <ArrowDown className="w-4 h-4" />
            )}
            {trend.isPositive ? '+' : ''}{trend.value}%
          </motion.div>
        )}
      </div>
      
      <div className={`p-4 rounded-xl ${
        alert 
          ? 'bg-red-500/20' 
          : 'bg-gradient-to-br from-slate-700 to-slate-800/50'
      }`}>
        <Icon className="w-7 h-7 text-white opacity-80" />
      </div>
    </div>

    <div className={`h-1 absolute bottom-0 left-0 right-0 ${accentColor.split(' ')[1]}`}></div>
  </motion.div>
);

const safeGetValue = (value: any, defaultValue: any = 0) => {
  if (value === undefined || value === null) return defaultValue;
  return value;
};

export default function DashboardPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [ov, setOv] = useState<Overview | null>(null);
  const [emps, setEmps] = useState<EmpRow[]>([]);
  const [adSalesData, setAdSalesData] = useState<AdSalesData[]>([]);
  const [adSpendList, setAdSpendList] = useState<AdSpendEntry[]>([]);
  const [todayAdSpend, setTodayAdSpend] = useState<AdSpendEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Инициализация дат
  useEffect(() => {
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    setFrom(monthAgo.toISOString().split('T')[0]);
    setTo(today.toISOString().split('T')[0]);
  }, []);

  const setPeriodDates = (p: 'today' | 'week' | 'month') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    setPeriod(p);
    setTo(todayStr);

    if (p === 'today') {
      setFrom(todayStr);
    } else if (p === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      setFrom(weekAgo.toISOString().split('T')[0]);
    } else if (p === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      setFrom(monthAgo.toISOString().split('T')[0]);
    }
  };

  // Загрузка основных данных
  const loadAll = async () => {
    if (!from || !to) return;
    
    setLoading(true);
    
    const qs = new URLSearchParams(); 
    if (from) qs.set('from', from); 
    if (to) qs.set('to', to);
    
    try {
      const overview = await fetchWithAuth(`/api/analytics/overview?${qs}`).catch(() => null);
      setOv(overview);
      
      const employees = await fetchWithAuth(`/api/analytics/employees?${qs}`).catch(() => []);
      setEmps(Array.isArray(employees) ? employees : []);
      
      const salesByAds = await fetchWithAuth(`/api/analytics/sales-by-ads?${qs}`).catch(() => []);
      setAdSalesData(Array.isArray(salesByAds) ? salesByAds : []);
      
      const adSpendData = await fetchWithAuth(`/api/ad-spend?${qs}`).catch(() => []);
      setAdSpendList(Array.isArray(adSpendData) ? adSpendData : []);
      
      const tasks = await fetchWithAuth(`/api/tasks`).catch(() => []);
      if (Array.isArray(tasks)) {
        const completedStatuses = ['COMPLETED', 'DONE', 'FINISHED', 'CLOSED'];
        setTaskStats({
          total: tasks.length,
          new: tasks.filter((t: Task) => t.status === 'NEW').length,
          inProgress: tasks.filter((t: Task) => t.status === 'IN_PROGRESS').length,
          completed: tasks.filter((t: Task) => completedStatuses.includes(t.status)).length,
          avgCompletionTime: 0
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  // ЗАГРУЗКА КЛИЕНТОВ ИЗ ЗАКАЗОВ
  const loadClientsFromOrders = async () => {
    try {
      const ordersResponse = await fetchWithAuth(`/api/orders?limit=1000`).catch(() => null);
      
      if (!ordersResponse || !ordersResponse.items) {
        console.log('No orders found');
        return;
      }

      const orders = ordersResponse.items;
      const clientsMap = new Map<number, Client>();

      orders.forEach((order: any) => {
        const client = order.client;
        if (!client || !client.id) return;

        const price = Number(order.totalPrice || order.price || 0);

        if (!clientsMap.has(client.id)) {
          clientsMap.set(client.id, {
            id: client.id,
            name: client.name || 'Unknown',
            phone: client.phone || '',
            email: client.email,
            ordersCount: 0,
            totalSpent: 0,
            lastOrder: order.date,
            status: 'active'
          });
        }

        const entry = clientsMap.get(client.id)!;
        entry.ordersCount += 1;
        entry.totalSpent += price;
        entry.lastOrder = order.date;
      });

      const processedClients: Client[] = Array.from(clientsMap.values());
      setClients(processedClients);
      console.log('Loaded clients from orders:', processedClients.length);
    } catch (error) {
      console.error('Failed to load clients from orders:', error);
      
      try {
        const clientsData = await fetchWithAuth(`/api/clients?limit=100`).catch(() => []);
        
        if (Array.isArray(clientsData) && clientsData.length > 0) {
          const processedClients: Client[] = clientsData.map((c: any) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            ordersCount: c.orders?.length || 0,
            totalSpent: c.orders?.reduce((sum: number, o: any) => {
              const price = Number(o.totalPrice || 0);
              return sum + (isNaN(price) ? 0 : price);
            }, 0) || 0,
            lastOrder: c.orders?.[0]?.date,
            status: c.isActive ? 'active' : 'inactive'
          }));
          
          setClients(processedClients);
          console.log('Loaded clients from API (fallback)');
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }
  };

  const loadTodayAdSpend = async () => {
    try {
      const date = new Date().toISOString().split('T')[0];
      const data = await fetchWithAuth(`/api/ad-spend?from=${date}&to=${date}`).catch(() => []);
      setTodayAdSpend(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load today ad spend:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadAll(),
      loadClientsFromOrders(),
      loadTodayAdSpend()
    ]);
    setRefreshing(false);
    toast.success('Данные обновлены');
  };

  useEffect(() => { 
    if (from && to) {
      loadAll();
      loadClientsFromOrders();
      loadTodayAdSpend(); 
    }
  }, [from, to]);

  const addTodayEntry = () => {
    setTodayAdSpend(prev => [...prev, {
      date: new Date().toISOString().split('T')[0],
      adSku: 'PS5',
      amount: 0,
      note: '',
    }]);
  };

  const updateTodayEntry = (index: number, field: 'adSku' | 'amount' | 'note', value: any) => {
    const arr = [...todayAdSpend];
    arr[index] = { ...arr[index], [field]: value };
    setTodayAdSpend(arr);
  };

  const deleteTodayEntry = async (index: number, entry: AdSpendEntry) => {
    if (entry.id) {
      try {
        await fetchWithAuth(`/api/ad-spend/${entry.id}`, { method: 'DELETE' });
        toast.success('Запись удалена');
        await loadAll();
        await loadTodayAdSpend();
      } catch {
        toast.error('Ошибка удаления');
      }
    } else {
      const arr = [...todayAdSpend];
      arr.splice(index, 1);
      setTodayAdSpend(arr);
    }
  };

  const saveTodayEntry = async (entry: AdSpendEntry, index: number) => {
    if (!entry.amount || entry.amount <= 0) {
      toast.error('Введите сумму');
      return;
    }

    const body = { 
      date: entry.date, 
      adSku: entry.adSku, 
      amount: Number(entry.amount),
      note: entry.note || '',
    };

    try {
      const method = entry.id ? 'PATCH' : 'POST';
      const url = entry.id ? `/api/ad-spend/${entry.id}` : '/api/ad-spend';
      
      const res = await fetchWithAuth(url, { 
        method, 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify(body) 
      });

      if (!res || !res.ok) { 
        toast.error('Ошибка сохранения'); 
        return; 
      }

      toast.success(entry.id ? 'Расход обновлён' : 'Расход сохранён');
      await loadAll();
      await loadTodayAdSpend();
    } catch (error) {
      toast.error('Ошибка сети');
    }
  };

  // Вычисления
  const totals = useMemo(() => {
    const defaultTotals = {
      ordersClosed: 0,
      revenue: 0,
      cost: 0,
      profit: 0,
      adSpend: 0,
      netProfit: 0,
      activeClients: 0,
      conversionRate: 0
    };

    if (!ov?.totals) return defaultTotals;

    return {
      ...defaultTotals,
      ...ov.totals
    };
  }, [ov?.totals]);

  const totalAdSpendPeriod = useMemo(() => 
    adSpendList.reduce((sum, item) => sum + safeGetValue(item.amount, 0), 0), 
    [adSpendList]
  );

  const totalTodayAdSpend = useMemo(() => 
    todayAdSpend.reduce((sum, item) => sum + safeGetValue(item.amount, 0), 0), 
    [todayAdSpend]
  );

  const chartData = useMemo(() => {
    if (!ov?.seriesByDay) return [];
    
    const days = ov.seriesByDay.length;
    const shouldAggregate = days > 14;
    
    return ov.seriesByDay
      .filter((_, idx) => !shouldAggregate || idx % 3 === 0)
      .map(item => ({
        ...item,
        dateFormatted: formatDateShort(item.date),
      }));
  }, [ov?.seriesByDay]);

  const marginPercentage = useMemo(() => {
    if (totals.revenue <= 0) return 0;
    return (totals.profit / totals.revenue) * 100;
  }, [totals.revenue, totals.profit]);

  const roiPercentage = useMemo(() => {
    if (totals.netProfit <= 0 || totals.adSpend <= 0) return 0;
    return (totals.netProfit / totals.adSpend) * 100;
  }, [totals.netProfit, totals.adSpend]);

  // Сортированные клиенты
  const topClients = useMemo(() => {
    return [...clients]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);
  }, [clients]);

  // Категории расходов
  const expensesByCategory = useMemo(() => {
    const categories: Record<string, number> = {};
    adSalesData.forEach(item => {
      categories[item.adSku] = item.totalSpend;
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [adSalesData]);

  const COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  // Проверка проблем
  const hasWarning = totals.profit < 0 || (totals.netProfit < 0 && totals.adSpend > 0);
  const adSpendTooHigh = totals.adSpend > totals.profit;

  // ✅ ИСПРАВЛЕНО: Убрали ProtectedRoute из loading состояния
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-slate-400 font-medium">Загрузка дашборда...</div>
        </motion.div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6 pb-6">
        {/* HEADER */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-r from-slate-900/60 to-slate-800/60 backdrop-blur-xl p-8"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 via-transparent to-blue-600/10"></div>
          
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Командный центр
              </h1>
              <p className="text-slate-400">Полная аналитика бизнеса в реальном времени</p>
            </div>

            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 text-slate-300 transition-all disabled:opacity-50"
                type="button"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </motion.button>

              {hasWarning && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-medium"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Внимание: низкая прибыль
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ПЕРИОД ВЫБОРА */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/40 backdrop-blur border border-slate-700/50 rounded-2xl p-4"
        >
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
            <div className="flex gap-2">
              {[
                { key: 'today', label: 'Сегодня' },
                { key: 'week', label: 'Неделя' },
                { key: 'month', label: 'Месяц' },
              ].map(({ key, label }) => (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPeriodDates(key as any)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap text-sm ${
                    period === key
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700'
                  }`}
                  type="button"
                >
                  {label}
                </motion.button>
              ))}
            </div>

            <div className="hidden lg:block h-8 w-px bg-slate-700/50"></div>

            <div className="flex gap-3 flex-1 items-center">
              <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPeriod('custom');
                }}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
              <span className="text-slate-500 flex-shrink-0">—</span>
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPeriod('custom');
                }}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          </div>
        </motion.div>

        {/* KPI CARDS */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, staggerChildren: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          <KpiCard
            title="Выручка"
            value={formatCurrency(safeGetValue(totals.revenue))}
            subtitle={`${safeGetValue(totals.ordersClosed)} заказов`}
            icon={DollarSign}
            accentColor="from-cyan-900/30 to-cyan-900/5 border-cyan-500/30"
          />
          
          <KpiCard
            title="Маржа"
            value={formatCurrency(safeGetValue(totals.profit))}
            subtitle={`${marginPercentage.toFixed(1)}%`}
            icon={TrendingUp}
            accentColor="from-emerald-900/30 to-emerald-900/5 border-emerald-500/30"
            alert={totals.profit < 0}
          />
          
          <KpiCard
            title="Клиенты"
            value={clients.length.toString()}
            subtitle={`${clients.filter(c => c.status === 'active').length} активных`}
            icon={Users}
            accentColor="from-blue-900/30 to-blue-900/5 border-blue-500/30"
          />
          
          <KpiCard
            title="Реклама"
            value={formatCurrency(totalAdSpendPeriod)}
            subtitle="За период"
            icon={Target}
            accentColor={adSpendTooHigh ? 'from-red-900/30 to-red-900/5 border-red-500/30' : 'from-orange-900/30 to-orange-900/5 border-orange-500/30'}
            alert={adSpendTooHigh}
          />
          
          <KpiCard
            title="Чистая прибыль"
            value={formatCurrency(safeGetValue(totals.netProfit))}
            subtitle={`ROI ${roiPercentage.toFixed(0)}%`}
            icon={Target}
            accentColor="from-violet-900/30 to-violet-900/5 border-violet-500/30"
            alert={totals.netProfit < 0}
          />
        </motion.div>

        {/* ЗАДАЧИ И КЛИЕНТЫ - КОРОТКИЙ ВИД */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* ЗАДАЧИ */}
          {taskStats && (
            <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur p-6">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/5 via-transparent to-orange-600/5 pointer-events-none"></div>
              
              <h3 className="text-lg font-bold text-white mb-4 relative z-10 flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                Статус задач
              </h3>
              
              <div className="space-y-3 relative z-10">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                  <span className="text-slate-300 font-medium">Всего задач</span>
                  <span className="text-2xl font-bold text-white">{taskStats.total}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <span className="text-slate-300 font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-400" />
                    Новые
                  </span>
                  <span className="text-xl font-bold text-blue-400">{taskStats.new}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <span className="text-slate-300 font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    В работе
                  </span>
                  <span className="text-xl font-bold text-yellow-400">{taskStats.inProgress}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <span className="text-slate-300 font-medium flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Завершено
                  </span>
                  <span className="text-xl font-bold text-green-400">{taskStats.completed}</span>
                </div>
              </div>
            </div>
          )}

          {/* ТОП КЛИЕНТОВ */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur p-6">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 via-transparent to-blue-600/5 pointer-events-none"></div>
            
            <h3 className="text-lg font-bold text-white mb-4 relative z-10 flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Топ клиентов
            </h3>
            
            <div className="space-y-2 max-h-64 overflow-y-auto relative z-10">
              {topClients.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Нет клиентов</p>
                </div>
              ) : (
                topClients.map((client, idx) => (
                  <motion.div
                    key={client.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 hover:border-cyan-500/30 transition-all"
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate">{client.name}</div>
                      <div className="text-xs text-slate-400">{client.ordersCount} заказов</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-cyan-400 text-sm">{formatCurrency(client.totalSpent)}</div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>

        {/* ГРАФИКИ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 xl:grid-cols-2 gap-6"
        >
          {/* Revenue Chart */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur p-6">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/5 via-transparent to-blue-600/5 pointer-events-none"></div>
            
            <h3 className="text-lg font-bold text-white mb-4 relative z-10">Динамика доходов</h3>
            <div className="h-64 md:h-80 relative z-10">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis 
                      dataKey="dateFormatted" 
                      stroke="#94a3b8" 
                      fontSize={12}
                      tickMargin={10}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={12}
                      tickFormatter={(value) => (value / 1000).toFixed(0) + 'k'}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #475569',
                        borderRadius: '8px',
                      }}
                      formatter={(value: any) => [formatCurrency(Number(value)), '']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#06b6d4" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                      name="Выручка" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="profit" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorProfit)" 
                      name="Маржа" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <TrendingUp className="w-12 h-12 opacity-30" />
                </div>
              )}
            </div>
          </div>

          {/* TOP EMPLOYEES */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur p-6">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 via-transparent to-blue-600/5 pointer-events-none"></div>
            
            <h3 className="text-lg font-bold text-white mb-4 relative z-10">Топ сотрудников</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto relative z-10">
              {emps.length === 0 ? (
                <div className="text-center text-slate-400 py-12">
                  Нет данных
                </div>
              ) : (
                emps.map((emp, idx) => (
                  <motion.div
                    key={emp.employeeId}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 hover:border-cyan-500/30 transition-all"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate">{emp.name}</div>
                      <div className="text-sm text-slate-400">{emp.closedCount} заказов</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-cyan-400">{formatCurrency(emp.profit)}</div>
                      <div className="text-xs text-slate-500">прибыль</div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>

        {/* ROI И РАСХОДЫ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 xl:grid-cols-2 gap-6"
        >
          {/* ROI BY PRODUCTS */}
          {adSalesData.length > 0 && (
            <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur p-6">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-600/5 via-transparent to-orange-600/5 pointer-events-none"></div>
              
              <h3 className="text-lg font-bold text-white mb-4 relative z-10">ROI по товарам</h3>
              <div className="h-64 md:h-80 relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={adSalesData} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis 
                      dataKey="adSku" 
                      stroke="#94a3b8" 
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={12}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #475569',
                        borderRadius: '8px',
                      }}
                      formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'ROI']}
                    />
                    <Bar 
                      dataKey="roi" 
                      fill="#f59e0b" 
                      name="ROI %" 
                      radius={[4, 4, 0, 0]} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* РАСХОДЫ ПО КАТЕГОРИЯМ */}
          {expensesByCategory.length > 0 && (
            <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur p-6">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-600/5 via-transparent to-rose-600/5 pointer-events-none"></div>
              
              <h3 className="text-lg font-bold text-white mb-4 relative z-10">Расходы по товарам</h3>
              <div className="h-64 md:h-80 relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensesByCategory}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props: any) => `${props.name}: ${formatCurrency(props.value)}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {expensesByCategory.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => formatCurrency(Number(value))}
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #475569',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </motion.div>

        {/* AD SPEND SECTION - УЛУЧШЕННЫЙ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur p-6"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-orange-600/5 via-transparent to-pink-600/5 pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Расходы на рекламу</h3>
              <p className="text-slate-400 text-sm">Управление и контроль рекламного бюджета</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={addTodayEntry}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm transition-all shadow-lg whitespace-nowrap"
              type="button"
            >
              <Plus className="w-4 h-4" />
              Добавить расход
            </motion.button>
          </div>

          {/* SPEND STATS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-br from-cyan-900/40 to-cyan-900/10 border border-cyan-500/30 p-4 rounded-xl"
            >
              <div className="text-sm text-slate-300 font-medium mb-2">Расходы сегодня</div>
              <div className="text-3xl font-bold text-cyan-400">
                {formatCurrency(totalTodayAdSpend)}
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className={`bg-gradient-to-br border p-4 rounded-xl ${
                adSpendTooHigh
                  ? 'from-red-900/40 to-red-900/10 border-red-500/30'
                  : 'from-purple-900/40 to-purple-900/10 border-purple-500/30'
              }`}
            >
              <div className="text-sm text-slate-300 font-medium mb-2">За период</div>
              <div className={`text-3xl font-bold ${adSpendTooHigh ? 'text-red-400' : 'text-purple-400'}`}>
                {formatCurrency(totalAdSpendPeriod)}
              </div>
            </motion.div>
          </div>

          {/* SPEND LIST */}
          <div className="space-y-3 relative z-10">
            <AnimatePresence mode="popLayout">
              {todayAdSpend.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-slate-400 py-8 border-2 border-dashed border-slate-700/50 rounded-lg"
                >
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <div className="font-medium">Нет записей за сегодня</div>
                </motion.div>
              ) : (
                todayAdSpend.map((entry, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-lg hover:border-slate-600/50 transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block font-medium">Товар</label>
                          <select
                            value={entry.adSku}
                            onChange={(e) => updateTodayEntry(idx, 'adSku', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                          >
                            {AD_SKUS.map(sku => (
                              <option key={sku} value={sku}>{sku}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block font-medium">Сумма (₽)</label>
                          <input
                            type="number"
                            placeholder="0"
                            value={entry.amount || ''}
                            onChange={(e) => updateTodayEntry(idx, 'amount', Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-2 flex-1 md:flex-none">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => saveTodayEntry(entry, idx)}
                          disabled={!entry.amount || entry.amount <= 0}
                          className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-all whitespace-nowrap"
                          type="button"
                        >
                          {entry.id ? 'Обновить' : 'Сохранить'}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => deleteTodayEntry(idx, entry)}
                          className="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-400 transition-all"
                          type="button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </ProtectedRoute>
  );
}