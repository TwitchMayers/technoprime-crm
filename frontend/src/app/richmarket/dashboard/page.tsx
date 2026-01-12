'use client';

import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, Users, ShoppingCart, Package, Shirt, DollarSign, Target, Calendar, ArrowUpRight, ArrowDownRight, Star, Clock, Truck, CheckCircle, Clock as ClockIcon, XCircle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import ProtectedRoute from '@/components/ProtectedRoute';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
};

const formatCompactNumber = (value: number) => {
  return new Intl.NumberFormat('ru-RU', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(value);
};

// Анимированная KPI карточка
const KpiCard = ({ title, value, subtitle, trend, icon: Icon, accentColor, delay = 0 }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 30, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.5, delay }}
    whileHover={{ y: -5, scale: 1.02 }}
    className="relative overflow-hidden group"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl" />
    <div className="relative bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 group-hover:border-slate-600/70 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-2 rounded-lg ${accentColor} shadow-lg`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-slate-300 font-medium uppercase tracking-wide">{title}</span>
          </div>
          <div className="text-2xl font-bold text-white mb-2">{value}</div>
          <div className="flex items-center gap-2">
            {trend && (
              <div className={`flex items-center gap-1 text-xs font-semibold ${
                trend.value > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {trend.value > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(trend.value)}%
              </div>
            )}
            <div className="text-xs text-slate-400">{subtitle}</div>
          </div>
        </div>
      </div>
      {/* Анимированный прогресс бар */}
      {trend && (
        <div className="w-full bg-slate-700/50 rounded-full h-1">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(Math.abs(trend.value), 100)}%` }}
            transition={{ duration: 1, delay: delay + 0.3 }}
            className={`h-1 rounded-full ${
              trend.value > 0 ? 'bg-gradient-to-r from-green-400 to-emerald-400' : 'bg-gradient-to-r from-red-400 to-pink-400'
            }`}
          />
        </div>
      )}
    </div>
  </motion.div>
);

// Скелетон для загрузки
const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-slate-800/30 rounded-2xl p-6 animate-pulse">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-slate-700 rounded-lg" />
            <div className="h-4 bg-slate-700 rounded w-20" />
          </div>
          <div className="h-8 bg-slate-700 rounded w-3/4 mb-2" />
          <div className="h-3 bg-slate-700 rounded w-1/2" />
        </div>
      ))}
    </div>
  </div>
);

// Иконки статусов заказов
const StatusIcon = ({ status }: { status: string }) => {
  const icons: any = {
    'NEW': <ClockIcon className="w-4 h-4 text-blue-400" />,
    'IN_PROGRESS': <ClockIcon className="w-4 h-4 text-orange-400" />,
    'COMPLETED': <CheckCircle className="w-4 h-4 text-green-400" />,
    'CANCELLED': <XCircle className="w-4 h-4 text-red-400" />,
  };
  return icons[status] || <ClockIcon className="w-4 h-4 text-slate-400" />;
};

export default function RichMarketDashboard() {
  const [dashboardData, setDashboardData] = useState({
    kpi: {
      revenue: 0,
      profit: 0,
      orders: 0,
      clients: 0,
      items: 0,
      averageOrder: 0,
    },
    salesTrend: [] as any[],
    orderStatuses: [] as any[],
    deliveryMethods: [] as any[],
    topProducts: [] as any[],
    recentActivity: [] as any[],
  });
  
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week');

  // Загрузка реальных данных с аналитических эндпоинтов
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        
        // Загружаем все аналитические данные параллельно
        const [kpiData, salesData, statusData, deliveryData, productsData, activityData] = await Promise.all([
          fetchWithAuth(`/api/richmarket/orders/analytics/dashboard?period=${timeRange}`).then(r => r.json()),
          fetchWithAuth(`/api/richmarket/orders/analytics/sales-trend?period=${timeRange}`).then(r => r.json()),
          fetchWithAuth('/api/richmarket/orders/analytics/orders-by-status').then(r => r.json()),
          fetchWithAuth('/api/richmarket/orders/analytics/delivery-methods').then(r => r.json()),
          fetchWithAuth('/api/richmarket/orders/analytics/top-products?limit=3').then(r => r.json()),
          fetchWithAuth('/api/richmarket/orders/analytics/recent-activity?limit=4').then(r => r.json()),
        ]);

        console.log('Loaded analytics data:', {
          kpiData, salesData, statusData, deliveryData, productsData, activityData
        });

        setDashboardData({
          kpi: kpiData || {
            revenue: 0,
            profit: 0,
            orders: 0,
            clients: 0,
            items: 0,
            averageOrder: 0,
          },
          salesTrend: salesData || [],
          orderStatuses: statusData || [],
          deliveryMethods: deliveryData || [],
          topProducts: productsData || [],
          recentActivity: activityData || [],
        });

      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        // Fallback на базовые данные если аналитика не доступна
        await loadFallbackData();
      } finally {
        setLoading(false);
      }
    };

    // Запасной вариант загрузки данных из существующих эндпоинтов
    const loadFallbackData = async () => {
      try {
        const [orders, clients, products] = await Promise.all([
          fetchWithAuth('/api/richmarket/orders').then(r => r.json()).catch(() => ({ items: [] })),
          fetchWithAuth('/api/richmarket/clients').then(r => r.json()).catch(() => ({ items: [] })),
          fetchWithAuth('/api/richmarket/products').then(r => r.json()).catch(() => ({ items: [] })),
        ]);

        const ordersList = orders.items || orders || [];
        const clientsList = clients.items || clients || [];
        const productsList = products.items || products || [];

        const completedOrders = ordersList.filter((o: any) => o.status === 'COMPLETED');
        const revenue = completedOrders.reduce((sum: number, o: any) => sum + (Number(o.totalPrice) || 0), 0);
        const profit = completedOrders.reduce((sum: number, o: any) => sum + (Number(o.profit) || 0), 0);
        const averageOrder = completedOrders.length > 0 ? revenue / completedOrders.length : 0;

        // Рассчитываем общий stock
        const totalStock = productsList.reduce((sum: number, product: any) => {
          return sum + (product.sizes?.reduce((sizeSum: number, size: any) => sizeSum + (size.stock || 0), 0) || 0);
        }, 0);

        // Базовые данные для графиков
        const salesTrend = generateSalesTrendFromOrders(completedOrders, timeRange);
        const orderStatuses = analyzeOrderStatuses(ordersList);
        const deliveryMethods = analyzeDeliveryMethods(ordersList);
        const topProducts = await loadTopProductsFallback();
        const recentActivity = ordersList.slice(0, 4);

        setDashboardData({
          kpi: {
            revenue,
            profit,
            orders: ordersList.length,
            clients: clientsList.length,
            items: totalStock,
            averageOrder,
          },
          salesTrend,
          orderStatuses,
          deliveryMethods,
          topProducts,
          recentActivity,
        });
      } catch (error) {
        console.error('Fallback data loading failed:', error);
      }
    };

    // Вспомогательные функции для fallback данных
    const generateSalesTrendFromOrders = (orders: any[], period: string) => {
      const now = new Date();
      const days = period === 'month' ? 30 : period === 'year' ? 365 : 7;
      const data = [];
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayOrders = orders.filter((order: any) => {
          const orderDate = new Date(order.date).toISOString().split('T')[0];
          return orderDate === dateStr;
        });
        
        data.push({
          date: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
          revenue: dayOrders.reduce((sum: number, o: any) => sum + (Number(o.totalPrice) || 0), 0),
          profit: dayOrders.reduce((sum: number, o: any) => sum + (Number(o.profit) || 0), 0),
          orders: dayOrders.length,
        });
      }
      
      return data;
    };

    const analyzeOrderStatuses = (orders: any[]) => {
      const statusCount: any = {};
      orders.forEach((order: any) => {
        statusCount[order.status] = (statusCount[order.status] || 0) + 1;
      });
      
      const statusColors = {
        'NEW': '#3b82f6',
        'IN_PROGRESS': '#f59e0b',
        'COMPLETED': '#10b981',
        'CANCELLED': '#ef4444',
      };

      return Object.entries(statusCount).map(([name, value]) => ({
        name,
value,
color: statusColors[name as keyof typeof statusColors] || '#6b7280',
      }));
    };

    const analyzeDeliveryMethods = (orders: any[]) => {
      const methodCount: any = {};
      orders.forEach((order: any) => {
        const method = order.deliveryService || 'Не указано';
        methodCount[method] = (methodCount[method] || 0) + 1;
      });
      
      const deliveryColors = {
        'СДЭК': '#8b5cf6',
        'Почта России': '#f59e0b',
        'Яндекс Доставка': '#f97316',
        'Boxberry': '#ec4899',
        'Авито Доставка': '#06b6d4',
      };

      return Object.entries(methodCount).map(([name, value]) => ({
  name,
  value,
  color: deliveryColors[name as keyof typeof deliveryColors] || '#6b7280',
}));
    };

    const loadTopProductsFallback = async () => {
      try {
        const soldProducts = await fetchWithAuth('/api/richmarket/orders/sold-products').then(r => r.json());
        const productsList = Array.isArray(soldProducts) ? soldProducts : soldProducts.items || [];
        
        const productSales: any = {};
        
        productsList.forEach((product: any) => {
          const key = `${product.brand}_${product.category}_${product.color}`;
          if (!productSales[key]) {
            productSales[key] = {
              id: product.productId,
              brand: product.brand,
              category: product.category,
              color: product.color,
              sales: 0,
              revenue: 0,
            };
          }
          productSales[key].sales += product.quantity || 1;
          productSales[key].revenue += (product.salePrice || 0) * (product.quantity || 1);
        });
        
        return Object.values(productSales)
          .sort((a: any, b: any) => b.sales - a.sales)
          .slice(0, 3)
          .map((product: any, index) => ({
            ...product,
            trend: index === 0 ? 12 : index === 1 ? -5 : 8,
          }));
      } catch (error) {
        console.error('Failed to load top products:', error);
        return [];
      }
    };

    loadDashboardData();
  }, [timeRange]);

  const marginPercentage = dashboardData.kpi.revenue > 0 
    ? ((dashboardData.kpi.profit / dashboardData.kpi.revenue) * 100).toFixed(1) 
    : '0';

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'RICHMARKET_CEO']}>
        <div className="space-y-6">
          <DashboardSkeleton />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'RICHMARKET_CEO']}>
      <div className="space-y-6">
        {/* Заголовок с анимацией */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-orange-400 bg-clip-text text-transparent">
              RichMarket Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-1">Аналитика продаж премиальной одежды в реальном времени</p>
          </div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 mt-4 sm:mt-0"
          >
            {['week', 'month', 'year'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  timeRange === range
                    ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-lg'
                    : 'bg-slate-800/50 text-slate-400 hover:text-slate-300'
                }`}
              >
                {range === 'week' && 'Неделя'}
                {range === 'month' && 'Месяц'}
                {range === 'year' && 'Год'}
              </button>
            ))}
          </motion.div>
        </motion.div>

        {/* Основные KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Общая выручка"
            value={formatCurrency(dashboardData.kpi.revenue)}
            subtitle={`${dashboardData.kpi.orders} заказов`}
            trend={{ value: 12.5 }}
            icon={DollarSign}
            accentColor="bg-gradient-to-br from-pink-500 to-rose-600"
            delay={0.1}
          />

          <KpiCard
            title="Чистая прибыль"
            value={formatCurrency(dashboardData.kpi.profit)}
            subtitle={`Маржа ${marginPercentage}%`}
            trend={{ value: 8.3 }}
            icon={TrendingUp}
            accentColor="bg-gradient-to-br from-orange-500 to-amber-600"
            delay={0.2}
          />

          <KpiCard
            title="Клиенты"
            value={formatCompactNumber(dashboardData.kpi.clients)}
            subtitle="Активные покупатели"
            trend={{ value: 5.2 }}
            icon={Users}
            accentColor="bg-gradient-to-br from-purple-500 to-pink-600"
            delay={0.3}
          />

          <KpiCard
            title="Товары"
            value={formatCompactNumber(dashboardData.kpi.items)}
            subtitle="На складе"
            trend={{ value: -2.1 }}
            icon={Shirt}
            accentColor="bg-gradient-to-br from-teal-500 to-cyan-600"
            delay={0.4}
          />
        </div>

        {/* Графики и аналитика */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* График выручки */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-2 bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Динамика продаж</h3>
              <div className="flex items-center gap-1 text-slate-400">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">
                  {timeRange === 'week' && 'Последние 7 дней'}
                  {timeRange === 'month' && 'Последние 30 дней'}
                  {timeRange === 'year' && 'Последние 12 месяцев'}
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dashboardData.salesTrend}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={value => formatCompactNumber(value)} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(30, 41, 59, 0.9)', 
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(100, 116, 139, 0.3)',
                    borderRadius: '12px',
                    color: 'white'
                  }}
                  formatter={(value: any) => [formatCurrency(value), '']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#8b5cf6" 
                  fill="url(#revenueGradient)" 
                  strokeWidth={2}
                  name="Выручка"
                />
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#10b981" 
                  fill="url(#profitGradient)" 
                  strokeWidth={2}
                  name="Прибыль"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Статусы заказов */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
          >
            <h3 className="text-lg font-bold text-white mb-6">Статусы заказов</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={Array.isArray(dashboardData.orderStatuses) ? dashboardData.orderStatuses : []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {Array.isArray(dashboardData.orderStatuses) && dashboardData.orderStatuses.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(100, 116, 139, 0.3)',
                    borderRadius: '12px',
                    color: 'white'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {Array.isArray(dashboardData.orderStatuses) && dashboardData.orderStatuses.map((status, index) => (
                <div key={status.name} className="flex items-center gap-2">
                  <StatusIcon status={status.name} />
                  <span className="text-sm text-slate-300 capitalize">
                    {status.name.toLowerCase().replace('_', ' ')}
                  </span>
                  <span className="text-sm text-slate-400 ml-auto">{status.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Нижний ряд: Топ товары и активность */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Топ товары */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Популярные товары</h3>
              <Star className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="space-y-4">
              {Array.isArray(dashboardData.topProducts) && dashboardData.topProducts.map((product, index) => (
                <motion.div
                  key={product.id || index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  className="flex items-center gap-4 p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-orange-500 text-white font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white text-sm">
                      {product.brand} {product.category} {product.color}
                    </div>
                    <div className="text-xs text-slate-400">
                      {product.sales} продаж • {formatCurrency(product.revenue || 0)}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-semibold ${
                    (product.trend > 0) ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {(product.trend > 0) ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(product.trend || 0)}%
                  </div>
                </motion.div>
              ))}
              {(!Array.isArray(dashboardData.topProducts) || dashboardData.topProducts.length === 0) && (
                <div className="text-center text-slate-400 py-4">
                  Нет данных о популярных товарах
                </div>
              )}
            </div>
          </motion.div>

          {/* Последняя активность */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Последние заказы</h3>
              <Clock className="w-5 h-5 text-slate-400" />
            </div>
            <div className="space-y-4">
              <AnimatePresence>
                {Array.isArray(dashboardData.recentActivity) && dashboardData.recentActivity.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.9 + index * 0.1 }}
                    className="flex items-center gap-4 p-3 rounded-xl bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                  >
                    <StatusIcon status={activity.status} />
                    <div className="flex-1">
                      <div className="font-semibold text-white text-sm">Заказ #{activity.id}</div>
                      <div className="text-xs text-slate-400">
                        {activity.client?.name || 'Клиент'} • {formatCurrency(activity.totalPrice || 0)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">
                        {new Date(activity.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(activity.date).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {(!Array.isArray(dashboardData.recentActivity) || dashboardData.recentActivity.length === 0) && (
                  <div className="text-center text-slate-400 py-4">
                    Нет данных о последних заказах
                  </div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Дополнительная информация о доставке */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
        >
          <h3 className="text-lg font-bold text-white mb-6">Способы доставки</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.isArray(dashboardData.deliveryMethods) && dashboardData.deliveryMethods.map((method, index) => (
              <div key={method.name} className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/30">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: method.color }}
                />
                <div>
                  <div className="text-sm font-semibold text-white">{method.name}</div>
                  <div className="text-xs text-slate-400">{method.value} заказов</div>
                </div>
              </div>
            ))}
            {(!Array.isArray(dashboardData.deliveryMethods) || dashboardData.deliveryMethods.length === 0) && (
              <div className="col-span-4 text-center text-slate-400 py-4">
                Нет данных о способах доставки
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </ProtectedRoute>
  );
}