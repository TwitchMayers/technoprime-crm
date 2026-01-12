'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, Package, Truck, Info, Phone, User, MapPin, CheckCircle, Clock, PlayCircle, MoreVertical, Filter, Search, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { getSocket } from '@/lib/socket';
import ProtectedRoute from '@/components/ProtectedRoute';

type TaskStatus = 'NEW' | 'IN_PROGRESS' | 'DONE';

type Task = {
  id: number;
  title: string;
  comment?: string;
  status: TaskStatus;
  orderId?: number;
  client?: { 
    name: string; 
    phone: string; 
    city?: string;
    address?: string;
  };
  order?: { 
    id: number; 
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
  assignedTo?: { name: string };
  dueDate?: string;
};

const DELIVERY_LABELS: Record<string, string> = {
  YANDEX: 'Яндекс Доставка',
  AVITO: 'Авито Доставка',
  POST_RUSSIA: 'Почта России',
  FIVEPOST: '5Post',
  CDEK: 'СДЭК',
  BOXBERRY: 'Boxberry',
};

const STATUS_CONFIG = {
  NEW: { 
    label: 'Новые', 
    color: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    icon: Clock,
    countColor: 'bg-blue-500'
  },
  IN_PROGRESS: { 
    label: 'В работе', 
    color: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    icon: PlayCircle,
    countColor: 'bg-amber-500'
  },
  DONE: { 
    label: 'Завершённые', 
    color: 'from-green-500 to-emerald-500',
    bg: 'bg-green-500/20',
    border: 'border-green-500/30',
    text: 'text-green-400',
    icon: CheckCircle,
    countColor: 'bg-green-500'
  },
};

// Компонент для отображения иконки статуса
const StatusIcon = ({ status }: { status: TaskStatus }) => {
  const IconComponent = STATUS_CONFIG[status].icon;
  return <IconComponent className="w-6 h-6" />;
};

export default function RichMarketTasksPage() {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'ALL'>('ALL');

  const loadTasks = async () => {
    setLoading(true);
    try {
      const [newTasks, inProgressTasks, doneTasks] = await Promise.all([
        fetchWithAuth('/api/richmarket/tasks?status=NEW').then(r => r.json()).catch(() => []),
        fetchWithAuth('/api/richmarket/tasks?status=IN_PROGRESS').then(r => r.json()).catch(() => []),
        fetchWithAuth('/api/richmarket/tasks?status=DONE').then(r => r.json()).catch(() => []),
      ]);

      const all = [
        ...(Array.isArray(newTasks) ? newTasks : []),
        ...(Array.isArray(inProgressTasks) ? inProgressTasks : []),
        ...(Array.isArray(doneTasks) ? doneTasks : []),
      ];

      setAllTasks(all);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      toast.error('Ошибка загрузки задач');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    loadTasks(); 
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socket.on('ORDER_CREATED', loadTasks);
    socket.on('queueUpdated', loadTasks);
    return () => {
      socket.off('ORDER_CREATED', loadTasks);
      socket.off('queueUpdated', loadTasks);
    };
  }, []);

  const acceptTask = async (task: Task) => {
    if (!task.orderId) return;

    try {
      const res = await fetchWithAuth(`/api/richmarket/orders/${task.orderId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error('Assign failed:', err);
        toast.error('Не удалось принять задачу');
        return;
      }

      toast.success('Задача принята');
      setTimeout(() => loadTasks(), 500);
    } catch (err) {
      console.error('Network error:', err);
      toast.error('Ошибка сети');
    }
  };

  const completeTask = async (task: Task) => {
    if (!task.orderId) return;

    try {
      const res = await fetchWithAuth(`/api/richmarket/orders/${task.orderId}/complete`, {
        method: 'POST',
      });

      if (!res.ok) {
        toast.error('Не удалось завершить задачу');
        return;
      }

      toast.success('Заказ завершён');
      setTimeout(() => loadTasks(), 500);
    } catch (err) {
      toast.error('Ошибка сети');
    }
  };

  // Фильтрация задач
  const filteredTasks = allTasks.filter(task => {
    const matchesStatus = filterStatus === 'ALL' || task.status === filterStatus;
    const matchesSearch = !searchQuery || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.client?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.client?.phone.includes(searchQuery);
    
    return matchesStatus && matchesSearch;
  });

  const getTasksByStatus = (status: TaskStatus) => 
    filteredTasks.filter(task => task.status === status);

  const getStatusCount = (status: TaskStatus) => 
    allTasks.filter(task => task.status === status).length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
  };

  const getOrderTotal = (task: Task) => {
    if (!task.order?.items) return 0;
    return task.order.items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
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
              Задачи RichMarket
            </h1>
            <p className="text-slate-400 text-sm mt-1">Управление заказами и доставкой премиальной одежды</p>
          </div>
          
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={loadTasks}
              disabled={loading}
              className="btn-secondary"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </motion.button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.entries(STATUS_CONFIG) as [TaskStatus, any][]).map(([status, config]) => (
            <motion.div
              key={status}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: status === 'NEW' ? 0.1 : status === 'IN_PROGRESS' ? 0.2 : 0.3 }}
              className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white">{getStatusCount(status)}</div>
                  <div className="text-sm text-slate-400">{config.label}</div>
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br ${config.color}`}>
                  <StatusIcon status={status} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                placeholder="Поиск по клиенту, телефону или названию задачи..."
                className="w-full pl-10 rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-400 focus:border-pink-500/50 transition-colors"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex gap-3">
              <select 
                className="rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white focus:border-pink-500/50 transition-colors"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as TaskStatus | 'ALL')}
              >
                <option value="ALL">Все статусы</option>
                <option value="NEW">Новые</option>
                <option value="IN_PROGRESS">В работе</option>
                <option value="DONE">Завершённые</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Tasks Board */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, colIndex) => (
              <div key={colIndex} className="space-y-4">
                <div className="h-8 bg-slate-700 rounded-xl animate-pulse mb-4" />
                {[...Array(4)].map((_, index) => (
                  <div key={index} className="bg-slate-800/30 rounded-2xl p-6 animate-pulse">
                    <div className="h-4 bg-slate-700 rounded w-3/4 mb-3" />
                    <div className="h-3 bg-slate-700 rounded w-1/2 mb-2" />
                    <div className="h-3 bg-slate-700 rounded w-2/3 mb-4" />
                    <div className="h-8 bg-slate-700 rounded w-full" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-12 text-center border border-slate-700/50"
          >
            <Package className="w-20 h-20 mx-auto mb-4 text-slate-600" />
            <div className="text-xl font-semibold text-white mb-2">Задачи не найдены</div>
            <div className="text-slate-400">Попробуйте изменить параметры поиска</div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {(Object.entries(STATUS_CONFIG) as [TaskStatus, any][]).map(([status, config]) => {
              const statusTasks = getTasksByStatus(status);

              return (
                <motion.div
                  key={status}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Column Header */}
                  <div className={`bg-gradient-to-r ${config.color} p-4 rounded-2xl text-white`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusIcon status={status} />
                        <div>
                          <div className="font-semibold">{config.label}</div>
                          <div className="text-sm opacity-90">{statusTasks.length} задач</div>
                        </div>
                      </div>
                      <div className={`w-8 h-8 rounded-full ${config.countColor} flex items-center justify-center text-white text-sm font-bold`}>
                        {statusTasks.length}
                      </div>
                    </div>
                  </div>

                  {/* Tasks List */}
                  <div className="space-y-4">
                    <AnimatePresence>
                      {statusTasks.map((task, index) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          index={index}
                          onAccept={acceptTask}
                          onComplete={completeTask}
                          onViewDetails={setDetailTask}
                          getOrderTotal={getOrderTotal}
                        />
                      ))}
                    </AnimatePresence>

                    {statusTasks.length === 0 && (
                      <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-700/50 rounded-2xl">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <div className="text-sm">Нет задач</div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Detail Modal */}
        <AnimatePresence>
          {detailTask && (
            <TaskDetailModal 
              task={detailTask} 
              onClose={() => setDetailTask(null)}
              getOrderTotal={getOrderTotal}
            />
          )}
        </AnimatePresence>
      </div>
    </ProtectedRoute>
  );
}

function TaskCard({ 
  task, 
  index, 
  onAccept, 
  onComplete, 
  onViewDetails,
  getOrderTotal 
}: { 
  task: Task;
  index: number;
  onAccept: (task: Task) => void;
  onComplete: (task: Task) => void;
  onViewDetails: (task: Task) => void;
  getOrderTotal: (task: Task) => number;
}) {
  const totalAmount = getOrderTotal(task);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -2, scale: 1.02 }}
      className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-4 border border-slate-700/50 hover:border-slate-600/70 transition-all duration-300 group"
    >
      {/* Task Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm group-hover:text-pink-400 transition-colors line-clamp-2">
            {task.title}
          </div>
          {task.orderId && (
            <div className="text-xs text-slate-400 mt-1">Заказ #{task.orderId}</div>
          )}
        </div>
        <button className="p-1 rounded-lg hover:bg-slate-700/50 transition-colors">
          <MoreVertical className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Client Info */}
      {task.client && (
        <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
          <User className="w-3 h-3" />
          <span className="truncate">{task.client.name}</span>
          {task.client.phone && (
            <a 
              href={`tel:${task.client.phone}`}
              className="text-pink-400 hover:text-pink-300 transition-colors"
            >
              {task.client.phone}
            </a>
          )}
        </div>
      )}

      {/* Order Items Preview */}
      {task.order?.items && task.order.items.length > 0 && (
        <div className="space-y-2 mb-3">
          {task.order.items.slice(0, 2).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="text-white truncate">
                {item.product.brand} {item.product.size}
              </div>
              <div className="text-slate-400">
                {item.qty} шт
              </div>
            </div>
          ))}
          {task.order.items.length > 2 && (
            <div className="text-xs text-slate-500">
              +{task.order.items.length - 2} других товаров
            </div>
          )}
        </div>
      )}

      {/* Delivery Info */}
      {task.order?.deliveryService && (
        <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
          <Truck className="w-3 h-3" />
          <span>{DELIVERY_LABELS[task.order.deliveryService]}</span>
          {task.order.trackingCode && (
            <span className="text-pink-400 font-mono text-xs">
              {task.order.trackingCode}
            </span>
          )}
        </div>
      )}

      {/* Order Total */}
      {totalAmount > 0 && (
        <div className="flex items-center justify-between mb-3 pt-2 border-t border-slate-700/50">
          <span className="text-xs text-slate-400">Сумма:</span>
          <span className="text-sm font-semibold text-pink-400">
            {totalAmount.toLocaleString()} ₽
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {task.status === 'NEW' && (
          <>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onAccept(task)}
              className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 text-white py-2 px-3 rounded-lg text-sm font-semibold text-center transition-all hover:shadow-lg"
            >
              Принять
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onViewDetails(task)}
              className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
            >
              <Info className="w-4 h-4" />
            </motion.button>
          </>
        )}
        
        {task.status === 'IN_PROGRESS' && (
          <>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onComplete(task)}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2 px-3 rounded-lg text-sm font-semibold text-center transition-all hover:shadow-lg"
            >
              Завершить
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onViewDetails(task)}
              className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
            >
              <Info className="w-4 h-4" />
            </motion.button>
          </>
        )}

        {task.status === 'DONE' && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onViewDetails(task)}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white py-2 px-3 rounded-lg text-sm font-semibold text-center transition-all hover:shadow-lg"
          >
            <Info className="w-4 h-4 inline mr-2" />
            Подробнее
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

function TaskDetailModal({ 
  task, 
  onClose,
  getOrderTotal 
}: { 
  task: Task; 
  onClose: () => void;
  getOrderTotal: (task: Task) => number;
}) {
  const totalAmount = getOrderTotal(task);

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
            {task.title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <Info className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Status Badge */}
          <div className={`bg-gradient-to-r ${STATUS_CONFIG[task.status].color} p-4 rounded-xl text-white`}>
            <div className="flex items-center gap-3">
              <StatusIcon status={task.status} />
              <div>
                <div className="font-semibold">{STATUS_CONFIG[task.status].label}</div>
                <div className="text-sm opacity-90">Текущий статус задачи</div>
              </div>
            </div>
          </div>

          {/* Client Information */}
          {task.client && (
            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
              <div className="text-sm text-slate-400 uppercase mb-3 font-semibold">Информация о клиенте</div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-pink-400" />
                  <div>
                    <div className="font-semibold text-white text-lg">{task.client.name}</div>
                    <a href={`tel:${task.client.phone}`} className="text-pink-400 hover:text-pink-300 transition-colors">
                      {task.client.phone}
                    </a>
                  </div>
                </div>
                
                {(task.client.city || task.client.address) && (
                  <div className="flex items-center gap-3 text-slate-300">
                    <MapPin className="w-5 h-5 text-amber-400" />
                    <div>
                      {task.client.city && <div>{task.client.city}</div>}
                      {task.client.address && <div className="text-sm">{task.client.address}</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Delivery Information */}
          {task.order?.deliveryService && (
            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
              <div className="text-sm text-slate-400 uppercase mb-3 font-semibold">Информация о доставке</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-300">Служба доставки:</span>
                  <span className="text-white font-semibold">
                    {DELIVERY_LABELS[task.order.deliveryService]}
                  </span>
                </div>
                {task.order.trackingCode && (
                  <div className="flex justify-between">
                    <span className="text-slate-300">Трек-номер:</span>
                    <span className="text-pink-400 font-mono font-bold">{task.order.trackingCode}</span>
                  </div>
                )}
                {task.order.deliveryAddress && (
                  <div className="flex justify-between">
                    <span className="text-slate-300">Адрес доставки:</span>
                    <span className="text-white text-right">{task.order.deliveryAddress}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Order Items */}
          {task.order?.items && task.order.items.length > 0 && (
            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
              <div className="text-sm text-slate-400 uppercase mb-3 font-semibold">
                Товары в заказе ({task.order.items.length})
              </div>
              <div className="space-y-3">
                {task.order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                    <div className="flex-1">
                      <div className="font-semibold text-white">{item.product.brand}</div>
                      <div className="text-sm text-slate-400">
                        {item.product.category} • {item.product.size} • {item.product.color}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">{item.qty} шт</div>
                      <div className="text-pink-400 font-semibold">
                        {formatCurrency(item.unitPrice * item.qty)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Order Summary */}
          {totalAmount > 0 && (
            <div className="bg-gradient-to-r from-pink-900/20 to-orange-900/20 p-4 rounded-xl border border-pink-500/30">
              <div className="text-sm text-slate-400 uppercase mb-3 font-semibold">Сводка заказа</div>
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-white">Итого:</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">
                  {totalAmount.toLocaleString()} ₽
                </span>
              </div>
            </div>
          )}

          {/* Task Comment */}
          {task.comment && (
            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
              <div className="text-sm text-slate-400 uppercase mb-3 font-semibold">Комментарий к задаче</div>
              <div className="text-white whitespace-pre-wrap">{task.comment}</div>
            </div>
          )}
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
        </div>
      </motion.div>
    </motion.div>
  );
}

// Вспомогательная функция для форматирования валюты
function formatCurrency(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
}