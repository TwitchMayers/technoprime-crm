'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, ShoppingCart, Trash2, Truck, Package, Eye, Filter, Download, Calendar, User, Phone, MapPin, Clock, CheckCircle, XCircle, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

// ✅ ФУНКЦИИ В НАЧАЛЕ
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + ' ₽';
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const DELIVERY_SERVICES: Record<string, string> = {
  YANDEX: 'Яндекс Доставка',
  AVITO: 'Авито Доставка',
  POST_RUSSIA: 'Почта России',
  FIVEPOST: '5Post',
  CDEK: 'СДЭК',
  BOXBERRY: 'Boxberry',
};

const STATUS_CONFIG = {
  NEW: { 
    label: 'Новый', 
    bg: 'bg-blue-500/20', 
    border: 'border-blue-500/30', 
    text: 'text-blue-400',
    icon: Clock,
    color: 'from-blue-500 to-cyan-500'
  },
  IN_PROGRESS: { 
    label: 'В работе', 
    bg: 'bg-amber-500/20', 
    border: 'border-amber-500/30', 
    text: 'text-amber-400',
    icon: Truck,
    color: 'from-amber-500 to-orange-500'
  },
  COMPLETED: { 
    label: 'Завершен', 
    bg: 'bg-green-500/20', 
    border: 'border-green-500/30', 
    text: 'text-green-400',
    icon: CheckCircle,
    color: 'from-green-500 to-emerald-500'
  },
  CANCELLED: { 
    label: 'Отменен', 
    bg: 'bg-rose-500/20', 
    border: 'border-rose-500/30', 
    text: 'text-rose-400',
    icon: XCircle,
    color: 'from-rose-500 to-pink-500'
  },
};

type Order = {
  id: number;
  date: string;
  status: keyof typeof STATUS_CONFIG;
  client?: { 
    name: string; 
    phone: string;
    city?: string;
    address?: string;
  };
  totalPrice: number;
  profit?: number;
  deliveryService?: string;
  trackingCode?: string;
  deliveryAddress?: string;
  items?: Array<{
    qty: number;
    unitPrice: number;
    product: { 
      brand: string; 
      category: string; 
      size: string; 
      color: string;
      imageUrl?: string;
    };
  }>;
};

export default function RichMarketOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'total' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await fetchWithAuth(`/api/richmarket/orders?${params}`);
      const data = await res.json();
      const items = data.items || data || [];
      
      // Преобразуем totalPrice в number для всех заказов
      const processedOrders = (Array.isArray(items) ? items : []).map((order: any) => ({
        ...order,
        totalPrice: Number(order.totalPrice) || 0
      }));
      
      setOrders(processedOrders);
    } catch (err) {
      console.error('Failed to load orders:', err);
      toast.error('Ошибка загрузки заказов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    loadOrders(); 
  }, []);

  // Сортировка заказов
  const sortedOrders = [...orders].sort((a, b) => {
    let aValue: any = 0;
    let bValue: any = 0;

    switch (sortBy) {
      case 'date':
        aValue = new Date(a.date).getTime();
        bValue = new Date(b.date).getTime();
        break;
      case 'total':
        aValue = a.totalPrice;
        bValue = b.totalPrice;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
    }

    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const deleteOrder = async (id: number) => {
    if (!confirm('Удалить заказ? Товары вернутся на склад.')) return;

    try {
      const res = await fetchWithAuth(`/api/richmarket/orders/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Ошибка удаления');
      }

      toast.success('Заказ удалён');
      loadOrders();
    } catch (err) {
      toast.error('Ошибка при удалении заказа');
    }
  };

  const updateOrderStatus = async (orderId: number, newStatus: string) => {
    try {
      // Здесь будет логика обновления статуса заказа
      toast.success('Статус обновлен');
      loadOrders();
    } catch (err) {
      toast.error('Ошибка обновления статуса');
    }
  };

  const getStatusCount = (status: string) => {
    return orders.filter(order => status === 'ALL' || order.status === status).length;
  };

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'RICHMARKET_CEO', 'RICHMARKET_MANAGER']}>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-orange-400 bg-clip-text text-transparent">
              Заказы RichMarket
            </h1>
            <p className="text-slate-400 text-sm mt-1">Управление продажами и доставкой премиальной одежды</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <Link
              href="/richmarket/orders/new"
              className="btn-success w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Новый заказ
            </Link>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-secondary w-full sm:w-auto"
            >
              <Download className="w-4 h-4 inline mr-2" />
              Экспорт
            </motion.button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{getStatusCount('ALL')}</div>
                <div className="text-sm text-slate-400">Всего заказов</div>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{getStatusCount('NEW')}</div>
                <div className="text-sm text-slate-400">Новые</div>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{getStatusCount('IN_PROGRESS')}</div>
                <div className="text-sm text-slate-400">В работе</div>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
                <Truck className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(
                    orders
                      .filter(order => order.status === 'COMPLETED')
                      .reduce((sum, order) => sum + (Number(order.totalPrice) || 0), 0)
                  )}
                </div>
                <div className="text-sm text-slate-400">Общая выручка</div>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                <Package className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                placeholder="Поиск по клиенту, телефону или трек-номеру..."
                className="w-full pl-10 rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-400 focus:border-pink-500/50 transition-colors"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadOrders()}
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <select 
                className="rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white focus:border-pink-500/50 transition-colors"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Все статусы</option>
                <option value="NEW">Новые</option>
                <option value="IN_PROGRESS">В работе</option>
                <option value="COMPLETED">Завершенные</option>
                <option value="CANCELLED">Отмененные</option>
              </select>
              
              <select 
                className="rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white focus:border-pink-500/50 transition-colors"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
              >
                <option value="date">По дате</option>
                <option value="total">По сумме</option>
                <option value="status">По статусу</option>
              </select>
              
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="btn-secondary min-w-[120px]"
              >
                <Filter className="w-4 h-4 inline mr-2" />
                {sortOrder === 'asc' ? 'По возр.' : 'По убыв.'}
              </button>
              
              <button 
                onClick={loadOrders}
                className="btn-primary min-w-[100px]"
              >
                Применить
              </button>
            </div>
          </div>
        </motion.div>

        {/* Orders Grid */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-slate-800/30 rounded-2xl p-6 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-6 bg-slate-700 rounded w-20" />
                  <div className="h-6 bg-slate-700 rounded w-24" />
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-slate-700 rounded w-3/4" />
                  <div className="h-4 bg-slate-700 rounded w-1/2" />
                  <div className="h-4 bg-slate-700 rounded w-2/3" />
                </div>
                <div className="flex gap-2 mt-4">
                  <div className="h-8 bg-slate-700 rounded flex-1" />
                  <div className="h-8 bg-slate-700 rounded w-8" />
                  <div className="h-8 bg-slate-700 rounded w-8" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedOrders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-12 text-center border border-slate-700/50"
          >
            <ShoppingCart className="w-20 h-20 mx-auto mb-4 text-slate-600" />
            <div className="text-xl font-semibold text-white mb-2">Заказы не найдены</div>
            <div className="text-slate-400 mb-6">Попробуйте изменить параметры поиска или создать новый заказ</div>
            <Link
              href="/richmarket/orders/new"
              className="btn-success"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Создать первый заказ
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {sortedOrders.map((order, index) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600/70 transition-all duration-300 group"
                >
                  {/* Order Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-2xl font-bold text-white group-hover:text-pink-400 transition-colors">
                        #{order.id}
                      </div>
                      <div className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(order.date)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${STATUS_CONFIG[order.status].bg} ${STATUS_CONFIG[order.status].border} ${STATUS_CONFIG[order.status].text}`}>
                        {STATUS_CONFIG[order.status].label}
                      </span>
                      <button className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Client Info */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-white">
                      <User className="w-4 h-4 text-pink-400" />
                      <span className="font-semibold">{order.client?.name || 'Клиент'}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <Phone className="w-4 h-4" />
                      <a href={`tel:${order.client?.phone}`} className="hover:text-pink-400 transition-colors">
                        {order.client?.phone}
                      </a>
                    </div>

                    {(order.client?.city || order.deliveryAddress) && (
                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <MapPin className="w-4 h-4" />
                        <span>{order.client?.city}{order.deliveryAddress && ` • ${order.deliveryAddress}`}</span>
                      </div>
                    )}
                  </div>

                  {/* Order Items */}
                  <div className="space-y-2 mb-4">
                    <div className="text-sm text-slate-400 font-medium">Товары:</div>
                    {order.items && order.items.slice(0, 2).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="text-white truncate">
                          {item.product.brand} {item.product.size}
                        </div>
                        <div className="text-slate-400">
                          {item.qty} шт × {formatCurrency(item.unitPrice)}
                        </div>
                      </div>
                    ))}
                    {order.items && order.items.length > 2 && (
                      <div className="text-xs text-slate-500">
                        +{order.items.length - 2} других товаров
                      </div>
                    )}
                  </div>

                  {/* Delivery Info */}
                  {order.deliveryService && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                      <Truck className="w-4 h-4" />
                      <span>{DELIVERY_SERVICES[order.deliveryService]}</span>
                      {order.trackingCode && (
                        <span className="font-mono text-pink-400 ml-2">{order.trackingCode}</span>
                      )}
                    </div>
                  )}

                  {/* Order Total */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-700/50 mb-4">
                    <span className="text-slate-400 font-medium">Итого:</span>
                    <span className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">
                      {formatCurrency(order.totalPrice)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setDetailOrder(order)}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 text-white py-2.5 px-4 rounded-lg text-sm font-semibold text-center transition-all hover:shadow-lg"
                    >
                      <Eye className="w-4 h-4 inline mr-2" />
                      Подробнее
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => deleteOrder(order.id)}
                      className="p-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* FAB Mobile */}
        <Link
          href="/richmarket/orders/new"
          className="lg:hidden fixed bottom-6 right-6 w-16 h-16 rounded-full bg-gradient-to-r from-pink-600 to-orange-600 shadow-2xl shadow-pink-500/50 flex items-center justify-center z-40 active:scale-95 transition-transform"
        >
          <Plus className="w-8 h-8 text-white" />
        </Link>

        {/* Detail Modal */}
        <AnimatePresence>
          {detailOrder && (
            <OrderDetailModal 
              order={detailOrder} 
              onClose={() => setDetailOrder(null)}
              onStatusUpdate={updateOrderStatus}
            />
          )}
        </AnimatePresence>
      </div>
    </ProtectedRoute>
  );
}

function OrderDetailModal({ order, onClose, onStatusUpdate }: { 
  order: Order; 
  onClose: () => void;
  onStatusUpdate: (orderId: number, status: string) => void;
}) {
  const StatusIcon = STATUS_CONFIG[order.status].icon;

  return (
    <motion.div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      <motion.div 
        className="glass w-full max-w-2xl p-6 relative rounded-2xl border border-slate-700/50 max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            Заказ #{order.id}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <XCircle className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Status Badge */}
          <div className={`bg-gradient-to-r ${STATUS_CONFIG[order.status].color} p-4 rounded-xl text-white`}>
            <div className="flex items-center gap-3">
              <StatusIcon className="w-6 h-6" />
              <div>
                <div className="font-semibold">{STATUS_CONFIG[order.status].label}</div>
                <div className="text-sm opacity-90">Текущий статус заказа</div>
              </div>
            </div>
          </div>

          {/* Client Information */}
          <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
            <div className="text-sm text-slate-400 uppercase mb-3 font-semibold">Информация о клиенте</div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-pink-400" />
                <div>
                  <div className="font-semibold text-white text-lg">{order.client?.name}</div>
                  <a href={`tel:${order.client?.phone}`} className="text-pink-400 hover:text-pink-300 transition-colors">
                    {order.client?.phone}
                  </a>
                </div>
              </div>
              
              {(order.client?.city || order.deliveryAddress) && (
                <div className="flex items-center gap-3 text-slate-300">
                  <MapPin className="w-5 h-5 text-amber-400" />
                  <div>
                    {order.client?.city && <div>{order.client.city}</div>}
                    {order.deliveryAddress && <div className="text-sm">{order.deliveryAddress}</div>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Information */}
          {order.deliveryService && (
            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
              <div className="text-sm text-slate-400 uppercase mb-3 font-semibold">Информация о доставке</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-300">Служба доставки:</span>
                  <span className="text-white font-semibold">{DELIVERY_SERVICES[order.deliveryService]}</span>
                </div>
                {order.trackingCode && (
                  <div className="flex justify-between">
                    <span className="text-slate-300">Трек-номер:</span>
                    <span className="text-pink-400 font-mono font-bold">{order.trackingCode}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
            <div className="text-sm text-slate-400 uppercase mb-3 font-semibold">
              Товары в заказе ({order.items?.length || 0})
            </div>
            <div className="space-y-3">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex-1">
                    <div className="font-semibold text-white">{item.product.brand}</div>
                    <div className="text-sm text-slate-400">
                      {item.product.category} • {item.product.size} • {item.product.color}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold">{item.qty} шт</div>
                    <div className="text-pink-400 font-semibold">{formatCurrency(item.unitPrice * item.qty)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-gradient-to-r from-pink-900/20 to-orange-900/20 p-4 rounded-xl border border-pink-500/30">
            <div className="text-sm text-slate-400 uppercase mb-3 font-semibold">Итоговая информация</div>
            <div className="space-y-2">
              <div className="flex justify-between text-lg">
                <span className="text-slate-300">Сумма заказа:</span>
                <span className="text-white font-bold">{formatCurrency(order.totalPrice)}</span>
              </div>
              {order.profit && (
                <div className="flex justify-between text-lg">
                  <span className="text-slate-300">Прибыль:</span>
                  <span className="text-green-400 font-bold">{formatCurrency(order.profit)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-slate-400 pt-2 border-t border-slate-700/50">
                <span>Дата создания:</span>
                <span>{new Date(order.date).toLocaleDateString('ru-RU', { 
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-secondary flex-1"
            onClick={onClose}
          >
            Закрыть
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary flex-1"
            onClick={() => {
              // Логика для изменения статуса или других действий
              onClose();
            }}
          >
            Редактировать
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}