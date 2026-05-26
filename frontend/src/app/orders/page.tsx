'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { Search, Calendar, Plus, Trash2, ShoppingCart, ChevronDown, Phone } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import { usePageActivity } from '@/hooks/usePageActivity';
import MobilePageHeader from '@/components/MobilePageHeader';

type Order = {
  id: number;
  date: string;
  status: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED' | 'RETURNED';
  source?: 'STORE' | 'MANUAL';
  isShopLead?: boolean;
  leadStage?: 'PREORDER' | null;
  client: { id: number; name: string; phone: string } | null;
  totalPrice?: string | number;
  items?: Array<{
    id: number;
    product?: { name: string };
    qty: number;
    salePrice: number;
  }>;
};

type OrderDetails = Order & {
  comment?: string | null;
  leadInfo?: {
    product?: string | null;
    requestedPhone?: string | null;
    city?: string | null;
    address?: string | null;
    comment?: string | null;
    serialNumber?: string | null;
  } | null;
  client: {
    id: number;
    name: string;
    phone: string;
    city?: string | null;
    address?: string | null;
  } | null;
  items: Array<{
    id: number;
    productId: number;
    qty: number;
    unitPrice?: number | string;
    variantKey?: string | null;
    product?: { id: number; name: string } | null;
    inventoryUnits?: Array<{
      id: number;
      serialNumber: string | null;
    }>;
  }>;
};

type LeadInventoryOption = {
  id: number;
  serialNumber?: string | null;
  displayName?: string | null;
  variantLabel?: string | null;
  memoryGb?: number | null;
  product?: {
    id: number;
    name: string;
    brand?: string | null;
    model?: string | null;
    version?: string | null;
  } | null;
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
  RETURNED: {
    label: 'Возвращён',
    bg: 'bg-slate-500/20',
    border: 'border-slate-500/50',
    text: 'text-slate-300',
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
  const isPageActive = usePageActivity();
  const [tab, setTab] = useState<'all' | 'queue' | 'done'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sendingLeadId, setSendingLeadId] = useState<number | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<number | null>(null);
  const [editingLeadLoading, setEditingLeadLoading] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [leadInventoryOptions, setLeadInventoryOptions] = useState<LeadInventoryOption[]>([]);
  const [leadForm, setLeadForm] = useState({
    name: '',
    phone: '',
    city: '',
    address: '',
    comment: '',
    inventoryUnitId: '0',
    productName: '',
    currentSerial: '',
  });
  const requestInFlightRef = useRef(false);

  const load = async () => {
    if (requestInFlightRef.current) return;

    requestInFlightRef.current = true;
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
      requestInFlightRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tab]);

  useEffect(() => {
    const s = getSocket();
    const handler = () => {
      if (!isPageActive) return;
      void load();
    };
    s.on('queueUpdated', handler);
    return () => {
      s.off('queueUpdated', handler);
    };
  }, [isPageActive, tab]);

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

  const sendLeadToTasks = async (orderId: number) => {
    setSendingLeadId(orderId);
    try {
      await fetchWithAuth(`/api/orders/${orderId}/send-to-tasks`, {
        method: 'POST',
      });
      toast.success('Предзаказ передан в задачи для техника');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось передать предзаказ в задачи');
    } finally {
      setSendingLeadId(null);
    }
  };

  const closeLeadEditor = () => {
    if (savingLead) return;
    setEditingLeadId(null);
    setLeadInventoryOptions([]);
    setLeadForm({
      name: '',
      phone: '',
      city: '',
      address: '',
      comment: '',
      inventoryUnitId: '0',
      productName: '',
      currentSerial: '',
    });
  };

  const openLeadEditor = async (orderId: number) => {
    setEditingLeadId(orderId);
    setEditingLeadLoading(true);
    try {
      const [detail, inventoryPayload] = await Promise.all([
        fetchWithAuth(`/api/orders/${orderId}`) as Promise<OrderDetails>,
        fetchWithAuth(`/api/orders/${orderId}/lead-inventory-options`) as Promise<{
          items?: LeadInventoryOption[];
        }>,
      ]);

      const firstItem = detail?.items?.[0];
      const currentInventoryId = firstItem?.inventoryUnits?.[0]?.id || 0;
      setLeadInventoryOptions(Array.isArray(inventoryPayload?.items) ? inventoryPayload.items : []);
      setLeadForm({
        name: detail?.client?.name || '',
        phone: detail?.leadInfo?.requestedPhone || detail?.client?.phone || '',
        city: detail?.leadInfo?.city || detail?.client?.city || '',
        address: detail?.leadInfo?.address || detail?.client?.address || '',
        comment: detail?.leadInfo?.comment || '',
        inventoryUnitId: currentInventoryId ? String(currentInventoryId) : '0',
        productName: firstItem?.product?.name || detail?.leadInfo?.product || '',
        currentSerial: firstItem?.inventoryUnits?.[0]?.serialNumber || detail?.leadInfo?.serialNumber || '',
      });
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось открыть предзаказ');
      setEditingLeadId(null);
    } finally {
      setEditingLeadLoading(false);
    }
  };

  const saveLead = async () => {
    if (!editingLeadId) return;

    setSavingLead(true);
    try {
      await fetchWithAuth(`/api/orders/${editingLeadId}/lead`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leadForm.name,
          phone: leadForm.phone,
          city: leadForm.city,
          address: leadForm.address,
          comment: leadForm.comment,
          inventoryUnitId: Number(leadForm.inventoryUnitId || 0),
        }),
      });

      toast.success('Предзаказ обновлён');
      closeLeadEditor();
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось сохранить предзаказ');
    } finally {
      setSavingLead(false);
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
      <div className="mobile-page-shell md:space-y-6 md:pb-20">
        <MobilePageHeader title="Заказы" subtitle={`${stats.total} всего · ${stats.inProgress} в работе`} sticky={false} />

        {/* ===== HEADER ===== */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/35 p-3 md:flex-row md:items-center md:gap-4 md:border-0 md:bg-transparent md:p-0">
            <div className="hidden md:block">
              <h1 className="text-3xl font-bold text-white">Заказы</h1>
              <p className="mt-1 text-slate-400">
                Всего {stats.total} • {stats.completed} завершено • {stats.inProgress} в работе
              </p>
            </div>

            <Link
              href="/orders/new"
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition-all hover:from-cyan-500 hover:to-blue-500 md:w-auto md:justify-start md:rounded-xl md:px-6"
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
          className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4"
        >
          <div className="glass rounded-xl p-3 md:p-4">
            <div className="text-xl font-bold text-white md:text-2xl">{stats.total}</div>
            <div className="mt-1 text-xs text-slate-400 md:text-sm">Всего заказов</div>
          </div>
          <div className="glass rounded-xl p-3 md:p-4">
            <div className="text-xl font-bold text-green-400 md:text-2xl">{stats.completed}</div>
            <div className="mt-1 text-xs text-slate-400 md:text-sm">Завершено</div>
          </div>
          <div className="glass rounded-xl p-3 md:p-4">
            <div className="text-xl font-bold text-amber-400 md:text-2xl">{stats.inProgress}</div>
            <div className="mt-1 text-xs text-slate-400 md:text-sm">В работе</div>
          </div>
          <div className="glass col-span-2 rounded-xl p-3 md:col-span-1 md:p-4">
            <div className="text-xl font-bold text-cyan-400 md:text-2xl">{stats.totalSum.toLocaleString()} ₽</div>
            <div className="mt-1 text-xs text-slate-400 md:text-sm">Общая сумма</div>
          </div>
        </motion.div>

        {/* ===== TABS ===== */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-xl p-2.5 md:p-3"
        >
          <div className="mobile-scroll-row md:mx-0 md:flex md:overflow-visible md:px-0 md:pb-0">
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
                className={`flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all md:rounded-lg ${
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
          className="glass rounded-xl p-3 md:p-4"
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium text-white">{o.client?.name ?? '—'}</div>
                          {o.isShopLead ? (
                            <span className="inline-flex rounded-full border border-fuchsia-500/40 bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-300">
                              Предзаказ
                            </span>
                          ) : null}
                        </div>
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
                        <div className="flex items-center justify-center gap-2">
                          {o.isShopLead && o.source === 'STORE' && o.status === 'NEW' ? (
                            <motion.button
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.96 }}
                              onClick={() => openLeadEditor(o.id)}
                              className="px-3 py-2 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-200 text-xs font-semibold transition"
                              title="Дополнить предзаказ"
                            >
                              Дополнить
                            </motion.button>
                          ) : null}
                          {o.source === 'STORE' && o.status === 'NEW' ? (
                            <motion.button
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.96 }}
                              onClick={() => sendLeadToTasks(o.id)}
                              disabled={sendingLeadId === o.id}
                              className="px-3 py-2 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-semibold transition disabled:opacity-60"
                              title="Передать заказ в задачи"
                            >
                              {sendingLeadId === o.id ? 'Передаём...' : 'В задачи'}
                            </motion.button>
                          ) : null}
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => deleteOrder(o.id)}
                            className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 transition inline-block"
                            title="Удалить заказ"
                          >
                            <Trash2 className="w-4 h-4 text-rose-400" />
                          </motion.button>
                        </div>
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-2xl font-bold text-white">#{o.id}</div>
                            {o.isShopLead ? (
                              <span className="inline-flex rounded-full border border-fuchsia-500/40 bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-300">
                                Предзаказ
                              </span>
                            ) : null}
                          </div>
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
                              {o.isShopLead && o.source === 'STORE' && o.status === 'NEW' ? (
                                <button
                                  onClick={() => openLeadEditor(o.id)}
                                  className="flex-1 px-3 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-200 transition text-sm font-medium"
                                >
                                  Дополнить
                                </button>
                              ) : null}
                              {o.source === 'STORE' && o.status === 'NEW' ? (
                                <button
                                  onClick={() => sendLeadToTasks(o.id)}
                                  disabled={sendingLeadId === o.id}
                                  className="flex-1 px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 transition text-sm font-medium disabled:opacity-60"
                                >
                                  {sendingLeadId === o.id ? 'Передаём...' : 'Передать в задачи'}
                                </button>
                              ) : null}
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

        <AnimatePresence>
          {editingLeadId ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                className="glass w-full max-w-2xl rounded-2xl border border-slate-700/70 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">Дополнить предзаказ #{editingLeadId}</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Уточните данные после звонка и при необходимости назначьте приставку со склада.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeLeadEditor}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800/60"
                  >
                    Закрыть
                  </button>
                </div>

                {editingLeadLoading ? (
                  <div className="py-16 text-center text-slate-300">Загружаем данные предзаказа…</div>
                ) : (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">
                        Приставка
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {leadForm.productName || 'Товар не определён'}
                      </div>
                      {leadForm.currentSerial ? (
                        <div className="mt-2 text-sm text-slate-300">
                          Сейчас назначен серийный номер: <span className="text-white">{leadForm.currentSerial}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-sm text-slate-300">Имя клиента</span>
                        <input
                          className="w-full rounded-lg border border-slate-600/60 bg-slate-900/70 px-4 py-3 text-white"
                          value={leadForm.name}
                          onChange={(e) => setLeadForm(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm text-slate-300">Телефон заявки</span>
                        <input
                          className="w-full rounded-lg border border-slate-600/60 bg-slate-900/70 px-4 py-3 text-white"
                          value={leadForm.phone}
                          onChange={(e) => setLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="+7 (9XX) XXX-XX-XX"
                        />
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-sm text-slate-300">Город</span>
                        <input
                          className="w-full rounded-lg border border-slate-600/60 bg-slate-900/70 px-4 py-3 text-white"
                          value={leadForm.city}
                          onChange={(e) => setLeadForm(prev => ({ ...prev, city: e.target.value }))}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm text-slate-300">Приставка со склада</span>
                        <select
                          className="w-full rounded-lg border border-slate-600/60 bg-slate-900/70 px-4 py-3 text-white"
                          value={leadForm.inventoryUnitId}
                          onChange={(e) =>
                            setLeadForm(prev => ({ ...prev, inventoryUnitId: e.target.value }))
                          }
                        >
                          <option value="0">Пока не назначать</option>
                          {leadInventoryOptions.map(option => (
                            <option key={option.id} value={option.id}>
                              {option.serialNumber || option.displayName || `Единица #${option.id}`}
                              {option.variantLabel ? ` • ${option.variantLabel}` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="space-y-1 block">
                      <span className="text-sm text-slate-300">Адрес</span>
                      <textarea
                        className="min-h-[96px] w-full rounded-lg border border-slate-600/60 bg-slate-900/70 px-4 py-3 text-white"
                        value={leadForm.address}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, address: e.target.value }))}
                      />
                    </label>

                    <label className="space-y-1 block">
                      <span className="text-sm text-slate-300">Комментарий менеджера / клиента</span>
                      <textarea
                        className="min-h-[96px] w-full rounded-lg border border-slate-600/60 bg-slate-900/70 px-4 py-3 text-white"
                        value={leadForm.comment}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, comment: e.target.value }))}
                      />
                    </label>

                    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={closeLeadEditor}
                        className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800/60"
                        disabled={savingLead}
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        onClick={saveLead}
                        className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-60"
                        disabled={savingLead}
                      >
                        {savingLead ? 'Сохраняем…' : 'Сохранить предзаказ'}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </ProtectedRoute>
  );
}
