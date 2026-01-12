'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getSocket } from '@/lib/socket';
import { Search, Calendar, Plus, Trash2, ShoppingCart, ChevronDown, Phone, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import ProtectedRoute from '@/components/ProtectedRoute';

type Order = {
  id: number;
  date: string;
  status: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
  client: { id: number; name: string; phone: string } | null;
  totalPrice?: string | number;
  items?: Array<{
    id: number;
    product?: { name: string };
    qty: number;
    salePrice: number;
  }>;
};

const statusConfig = {
  NEW: {
    label: 'Новый',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
  },
  IN_PROGRESS: {
    label: 'В работе',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/50',
    text: 'text-amber-400',
  },
  COMPLETED: {
    label: 'Завершён',
    bg: 'bg-green-500/20',
    border: 'border-green-500/50',
    text: 'text-green-400',
  },
  CANCELED: {
    label: 'Отменён',
    bg: 'bg-rose-500/20',
    border: 'border-rose-500/50',
    text: 'text-rose-400',
  },
};

function StatusChip({ status }: { status: Order['status'] }) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex px-3 py-1.5 rounded-full text-xs font-bold ${config.bg} ${config.border} ${config.text} border`}
    >
      {config.label}
    </span>
  );
}

export default function OrdersPage() {
  const [tab, setTab] = useState<'all' | 'queue' | 'done'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab === 'queue') params.set('status', 'NEW');
      if (tab === 'done') params.set('status', 'COMPLETED');
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (q) params.set('q', q);

      const data = await fetchWithAuth(`/api/orders?${params.toString()}`);
      const list = data.items || data || [];
      setRows(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Error loading orders:', err);
      toast.error('Ошибка загрузки заказов');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tab]);

  useEffect(() => {
    const s = getSocket();
    const handler = () => load();
    s.on('queueUpdated', handler);
    return () => {
      s.off('queueUpdated', handler);
    };
  }, [tab]);

  const deleteOrder = async (orderId: number) => {
    if (!confirm('Удалить заказ? Товары вернутся на склад.')) return;

    try {
      await fetchWithAuth(`/api/orders/${orderId}`, {
        method: 'DELETE',
      });

      toast.success('Заказ удалён');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Ошибка удаления заказа');
    }
  };

  const stats = useMemo(() => {
    const totalSum = rows.reduce((s, r) => s + Number(r.totalPrice || 0), 0);
    const completed = rows.filter((r) => r.status === 'COMPLETED').length;
    const inProgress = rows.filter((r) => r.status === 'IN_PROGRESS').length;

    return {
      total: rows.length,
      completed,
      inProgress,
      totalSum,
    };
  }, [rows]);

  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
      <div className="space-y-6 pb-20">
        {/* ===== HEADER ===== */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Заказы</h1>
              <p className="text-slate-400 mt-1">
                Всего {stats.total} • {stats.completed} завершено • {stats.inProgress} в работе
              </p>
            </div>

            <Link
              href="/orders/new"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold shadow-lg shadow-cyan-500/30 transition-all w-full md:w-auto justify-center md:justify-start"
            >
              <Plus className="w-5 h-5" />
              Новый заказ
            </Link>
          </div>
        </motion.div>

        {/* ===== STATS ===== */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <div className="glass p-4 rounded-xl">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-sm text-slate-400 mt-1">Всего заказов</div>
          </div>
          <div className="glass p-4 rounded-xl">
            <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
            <div className="text-sm text-slate-400 mt-1">Завершено</div>
          </div>
          <div className="glass p-4 rounded-xl">
            <div className="text-2xl font-bold text-amber-400">{stats.inProgress}</div>
            <div className="text-sm text-slate-400 mt-1">В работе</div>
          </div>
          <div className="glass p-4 rounded-xl col-span-2 md:col-span-1">
            <div className="text-2xl font-bold text-cyan-400">{stats.totalSum.toLocaleString()} ₽</div>
            <div className="text-sm text-slate-400 mt-1">Общая сумма</div>
          </div>
        </motion.div>

        {/* ===== TABS ===== */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass p-3 rounded-xl"
        >
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'Все заказы' },
              { key: 'queue', label: 'Очередь' },
              { key: 'done', label: 'Завершённые' },
            ].map(({ key, label }) => (
              <motion.button
                key={key}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setTab(key as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all whitespace-nowrap font-medium text-sm ${
                  tab === key
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700'
                }`}
              >
                {label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ===== FILTERS ===== */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass p-4 rounded-xl"
        >
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                placeholder="Поиск по клиенту..."
                className="w-full pl-10 rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-cyan-500/50 transition"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                className="w-full pl-10 rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-cyan-500/50 transition"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                className="w-full pl-10 rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-cyan-500/50 transition"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <button
              className="col-span-1 md:col-span-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold transition text-sm"
              onClick={load}
              disabled={loading}
            >
              {loading ? 'Поиск...' : 'Поиск'}
            </button>
          </div>
        </motion.div>

        {/* ===== DESKTOP TABLE ===== */}
        <div className="hidden lg:block glass rounded-xl overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-900 to-slate-800 sticky top-0">
                <tr className="text-slate-300 text-sm border-b border-slate-700/50">
                  <th className="text-left p-4 font-bold">Номер</th>
                  <th className="text-left p-4 font-bold">Клиент</th>
                  <th className="text-left p-4 font-bold">Статус</th>
                  <th className="text-right p-4 font-bold">Сумма</th>
                  <th className="text-left p-4 font-bold">Дата</th>
                  <th className="text-center p-4 font-bold">Действия</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center">
                      <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto"></div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-slate-700" />
                      <div className="text-slate-400 font-medium">Заказы не найдены</div>
                    </td>
                  </tr>
                ) : (
                  rows.map((o, idx) => (
                    <motion.tr
                      key={o.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="border-t border-slate-700/50 hover:bg-slate-800/50 transition"
                    >
                      <td className="p-4">
                        <span className="font-bold text-cyan-400">#{o.id}</span>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-white">{o.client?.name ?? '—'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{o.client?.phone ?? '—'}</div>
                      </td>
                      <td className="p-4">
                        <StatusChip status={o.status} />
                      </td>
                      <td className="p-4 text-right font-bold text-cyan-400">
                        {Number(o.totalPrice || 0).toLocaleString()} ₽
                      </td>
                      <td className="p-4 text-sm text-slate-400">
                        {o.date ? new Date(o.date).toLocaleDateString('ru') : ''}
                      </td>
                      <td className="p-4 text-center">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => deleteOrder(o.id)}
                          className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 transition inline-block"
                          title="Удалить заказ"
                        >
                          <Trash2 className="w-4 h-4 text-rose-400" />
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== MOBILE CARDS ===== */}
        <div className="lg:hidden space-y-3">
          {loading ? (
            <div className="glass p-8 text-center rounded-xl">
              <div className="animate-spin w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <div className="text-slate-400">Загрузка заказов…</div>
            </div>
          ) : rows.length === 0 ? (
            <div className="glass p-12 text-center rounded-xl">
              <ShoppingCart className="w-20 h-20 mx-auto mb-4 text-slate-700" />
              <div className="text-slate-400 font-medium">Заказы не найдены</div>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {rows.map((o, idx) => {
                const isExpanded = expandedId === o.id;

                return (
                  <motion.div
                    key={o.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: idx * 0.05 }}
                    className="glass rounded-xl overflow-hidden"
                  >
                    {/* HEADER */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : o.id)}
                      className="w-full p-4 hover:bg-slate-800/30 transition text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-2xl font-bold text-white">#{o.id}</div>
                          <div className="text-sm text-slate-400 mt-1">{o.client?.name ?? '—'}</div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <StatusChip status={o.status} />
                          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          </motion.div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-700/50">
                        <div className="flex justify-between items-end">
                          <div className="text-slate-400 text-sm">Сумма:</div>
                          <div className="text-2xl font-bold text-cyan-400">
                            {Number(o.totalPrice || 0).toLocaleString()} ₽
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* EXPANDED */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-slate-700/50"
                        >
                          <div className="p-4 space-y-4">
                            {/* КЛИЕНТ */}
                            <div>
                              <h4 className="text-sm font-bold text-slate-300 mb-2">Клиент</h4>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400 text-sm">Имя:</span>
                                  <span className="text-white font-medium">{o.client?.name ?? '—'}</span>
                                </div>
                                {o.client?.phone && (
                                  <a
                                    href={`tel:${o.client.phone}`}
                                    className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition"
                                  >
                                    <Phone className="w-4 h-4" />
                                    <span className="text-sm">{o.client.phone}</span>
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* ТОВАРЫ */}
                            {o.items && o.items.length > 0 && (
                              <div>
                                <h4 className="text-sm font-bold text-slate-300 mb-2">Товары ({o.items.length})</h4>
                                <div className="space-y-2">
                                  {o.items.map((item, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm p-2 rounded-lg bg-slate-800/30">
                                      <div>
                                        <div className="text-white font-medium">{item.product?.name ?? 'Товар'}</div>
                                        <div className="text-xs text-slate-500">Кол-во: {item.qty}</div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-cyan-400 font-bold">{(item.salePrice * item.qty).toLocaleString()} ₽</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* ДАТА */}
                            <div className="pt-2 border-t border-slate-700/50">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-400">Дата:</span>
                                <span className="text-white font-medium">
                                  {o.date ? new Date(o.date).toLocaleDateString('ru', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  }) : '—'}
                                </span>
                              </div>
                            </div>

                            {/* ACTIONS */}
                            <div className="flex gap-2 pt-3 border-t border-slate-700/50">
                              <button
                                onClick={() => deleteOrder(o.id)}
                                className="flex-1 px-3 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 transition text-sm font-medium"
                              >
                                Удалить
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}