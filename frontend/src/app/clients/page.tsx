'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Search,
  Phone,
  Edit,
  Trash,
  Plus,
  Users,
  MapPin,
  Shield,
  AlertCircle,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  Mail,
  Package,
  Barcode,
  DollarSign,
  History,
  TrendingUp,
  User,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { formatPhoneNumber, cleanPhoneNumber, isValidPhone } from '@/lib/phoneUtils';
import type { Client, ClientOrder } from '@/types/client';

// ===== УТИЛИТЫ =====

const getActiveSubscription = (client: Client) => {
  return client.subscriptions?.find((s) => s.status === 'ACTIVE') || null;
};

const daysLeft = (endDate: string): string => {
  try {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 0) return `${diff} дн.`;
    if (diff === 0) return 'Сегодня';
    return 'Истекла';
  } catch {
    return 'Ошибка';
  }
};

const getStatusColor = (endDate: string): string => {
  try {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diff <= 0) return 'text-rose-400 bg-rose-500/20 border-rose-500/30';
    if (diff <= 7) return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
    return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
  } catch {
    return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
  }
};

const matchesSearch = (client: Client, query: string): boolean => {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return !!(
    client.name.toLowerCase().includes(q) ||
    client.phone.toLowerCase().includes(q) ||
    client.city?.toLowerCase().includes(q) ||
    client.address?.toLowerCase().includes(q)
  );
};

// ===== КОМПОНЕНТ CLIENT CARD =====

interface ClientCardProps {
  client: Client;
  isExpanded: boolean;
  onToggle: (id: number) => void;
  onEdit: (client: Client) => void;
  onDelete: (id: number) => void;
}

function ClientCard({ client, isExpanded, onToggle, onEdit, onDelete }: ClientCardProps) {
  const sub = getActiveSubscription(client);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="glass rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-cyan-500/10 transition-all"
    >
      {/* HEADER CARD */}
      <motion.div
        onClick={() => onToggle(client.id)}
        className="p-5 cursor-pointer hover:bg-slate-800/40 transition group"
      >
        <div className="flex items-start justify-between gap-4">
          {/* LEFT: AVATAR + INFO */}
          <div className="flex items-start gap-4 min-w-0 flex-1">
            {/* AVATAR */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-2xl text-white shadow-lg shadow-cyan-500/30 flex-shrink-0">
              {client.name.charAt(0).toUpperCase()}
            </div>

            {/* NAME + CONTACTS */}
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-white truncate">{client.name}</h3>

              {/* LOCATION */}
              {client.city && (
                <div className="flex items-center gap-1 text-sm text-slate-400 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span className="truncate">
                    {client.city}
                    {client.address && `, ${client.address}`}
                  </span>
                </div>
              )}

              {/* PHONE */}
              <a
                href={`tel:${client.phone}`}
                className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 transition font-mono mt-2"
              >
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                {client.phone}
              </a>
            </div>
          </div>

          {/* RIGHT: STATUS + EXPAND */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {/* STATUS BADGE */}
            {sub ? (
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border inline-block ${getStatusColor(
                    sub.endDate
                  )}`}
                >
                  {daysLeft(sub.endDate)}
                </span>
                <span
                  className={`text-xs font-semibold flex items-center gap-1 ${
                    sub.accountType === 'SHARING_CLIENT'
                      ? 'text-purple-400'
                      : 'text-cyan-400'
                  }`}
                >
                  {sub.accountType === 'SHARING_CLIENT' && (
                    <Shield className="w-3 h-3" />
                  )}
                  {sub.type === 'PS_PLUS'
                    ? 'PS Plus'
                    : sub.type === 'GAME_PASS'
                      ? 'Game Pass'
                      : 'EA Play'}
                </span>
              </div>
            ) : (
              <div className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Нет подписки
              </div>
            )}

            {/* EXPAND BUTTON */}
            <motion.button
              animate={{ rotate: isExpanded ? 180 : 0 }}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(client.id);
              }}
              className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition"
            >
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </motion.button>
          </div>
        </div>

        {/* QUICK INFO ROW */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-700/30">
          {/* CONSOLE */}
          {client.consoleType && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Консоль:</span>
              <span className="px-2 py-1 rounded-lg bg-slate-700/50 text-xs font-medium text-slate-300">
                {client.consoleType}
              </span>
            </div>
          )}

          {/* ORDERS COUNT */}
          {client.orders && client.orders.length > 0 && (
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-300 font-semibold">
                {client.orders.length} заказов
              </span>
            </div>
          )}

          {/* DATE ADDED */}
          {client.createdAt && (
            <div className="flex items-center gap-2 ml-auto">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500">
                {new Date(client.createdAt).toLocaleDateString('ru')}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* EXPANDED CONTENT */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-700/50 overflow-hidden"
          >
            <div className="p-6 space-y-6 bg-gradient-to-b from-slate-800/20 to-transparent">
              {/* SUBSCRIPTION DETAIL */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-400" />
                  Подписка
                </h4>

                {sub ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 space-y-3"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Тип:</div>
                        <div className="text-sm font-bold text-white">
                          {sub.type === 'PS_PLUS'
                            ? 'PlayStation Plus'
                            : sub.type === 'GAME_PASS'
                              ? 'Xbox Game Pass'
                              : 'EA Play'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Тип аккаунта:</div>
                        <div
                          className={`text-sm font-bold ${
                            sub.accountType === 'SHARING_CLIENT'
                              ? 'text-purple-400'
                              : 'text-cyan-400'
                          }`}
                        >
                          {sub.accountType === 'SHARING_CLIENT' ? 'Шеринг' : 'Личный'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Конец подписки:</div>
                        <div className="text-sm font-bold text-white">
                          {new Date(sub.endDate).toLocaleDateString('ru', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Осталось:</div>
                        <div
                          className={`text-sm font-bold ${
                            new Date(sub.endDate) < new Date()
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {daysLeft(sub.endDate)}
                        </div>
                      </div>
                    </div>

                    {sub.sharingSystem && (
                      <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                        <div className="text-xs text-slate-400 mb-1">Система шеринга:</div>
                        <div className="text-sm font-medium text-cyan-400">
                          {sub.sharingSystem.name}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
                    <p className="text-sm text-amber-300">Нет активной подписки</p>
                  </div>
                )}
              </div>

              {/* ORDERS HISTORY */}
              {client.orders && client.orders.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <History className="w-4 h-4 text-cyan-400" />
                    История заказов ({client.orders.length})
                  </h4>

                  <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-hide">
                    {client.orders.map((order: ClientOrder, idx: number) => (
                      <OrderCard key={order.id} order={order} />
                    ))}
                  </div>
                </div>
              )}

              {/* ADDITIONAL INFO */}
              {(client.address || client.emailLogin) && (
                <div className="space-y-3 pt-4 border-t border-slate-700/30">
                  <h4 className="text-sm font-bold text-slate-300">Дополнительно</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {client.address && (
                      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-1">
                        <div className="text-xs text-slate-400">Адрес:</div>
                        <div className="text-sm font-medium text-white">
                          {client.address}
                        </div>
                      </div>
                    )}

                    {client.emailLogin && (
                      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-1">
                        <div className="text-xs text-slate-400">Email логин:</div>
                        <div className="text-sm font-mono text-cyan-400 flex items-center gap-2">
                          {client.emailLogin}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(client.emailLogin || '');
                              toast.success('Скопирован');
                            }}
                            className="p-1 rounded hover:bg-slate-700 transition"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER ACTIONS */}
      <motion.div className="p-4 border-t border-slate-700/50 bg-slate-800/20 flex items-center gap-2">
        <a
          href={`tel:${client.phone}`}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-400 text-sm font-semibold transition"
        >
          <Phone className="w-4 h-4" />
          Звонок
        </a>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onEdit(client)}
          className="flex-1 px-3 py-2.5 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 text-sm font-semibold transition"
        >
          <Edit className="w-4 h-4 inline mr-1" />
          Редакт.
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setDeleteConfirm(true)}
          className="flex-1 px-3 py-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 text-sm font-semibold transition"
        >
          <Trash className="w-4 h-4 inline mr-1" />
          Удалить
        </motion.button>
      </motion.div>

      {/* DELETE CONFIRM */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-6 max-w-sm border border-slate-700/50"
            >
              <h3 className="text-lg font-bold text-white mb-2">
                Удалить клиента?
              </h3>
              <p className="text-sm text-slate-400 mb-6">
                Это действие необратимо. Все связанные данные будут удалены.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 text-slate-300 font-semibold transition"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    onDelete(client.id);
                    setDeleteConfirm(false);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition"
                >
                  Удалить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ===== ORDER CARD COMPONENT =====

function OrderCard({ order }: { order: ClientOrder }) {
  const [expanded, setExpanded] = useState(false);

  const consoles = order.items.filter(
    (item) =>
      item.product.category === 'CONSOLE' ||
      item.product.name?.toLowerCase().includes('playstation') ||
      item.product.name?.toLowerCase().includes('xbox') ||
      item.product.name?.toLowerCase().includes('ps'),
  );

  const otherItems = order.items.filter(
    (item) =>
      item.product.category !== 'CONSOLE' &&
      !item.product.name?.toLowerCase().includes('playstation') &&
      !item.product.name?.toLowerCase().includes('xbox') &&
      !item.product.name?.toLowerCase().includes('ps'),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-slate-800/40 border border-slate-700/50 overflow-hidden hover:border-slate-600/50 transition"
    >
      {/* ORDER HEADER */}
      <motion.button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-800/50 transition"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
          >
            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </motion.div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Заказ #{order.id}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                ✓ Завершён
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {new Date(order.date).toLocaleDateString('ru', {
                day: 'numeric',
                month: 'short',
                year: '2-digit',
              })}
            </div>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-cyan-400">
            {Number(order.totalPrice).toLocaleString()} ₽
          </div>
        </div>
      </motion.button>

      {/* ORDER DETAILS */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="border-t border-slate-700/30 bg-slate-800/20 p-3 space-y-3"
          >
            {/* WHO CREATED / CLOSED */}
            <div className="grid grid-cols-2 gap-2">
              {order.createdBy && (
                <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 space-y-1">
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Создал:
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {order.createdBy.name}
                  </div>
                </div>
              )}
              {order.manager && (
                <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 space-y-1">
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Закрыл:
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {order.manager.name}
                  </div>
                </div>
              )}
            </div>

            {/* CONSOLES */}
            {consoles.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <Package className="w-3 h-3 text-cyan-400" />
                  Приставки
                </div>
                {consoles.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 space-y-1"
                  >
                    <div className="font-semibold text-white text-sm">
                      {item.product.name}
                    </div>
                    {item.product.serialNumber && (
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <Barcode className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                        <span className="font-mono bg-slate-800/50 px-2 py-0.5 rounded">
                          {item.product.serialNumber}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-sm font-bold text-green-400">
                      <DollarSign className="w-3 h-3" />
                      {item.product.price.toLocaleString()} ₽
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* OTHER ITEMS */}
            {otherItems.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <Package className="w-3 h-3 text-amber-400" />
                  Товары ({otherItems.length})
                </div>
                {otherItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-white text-sm">
                        {item.product.name}
                      </div>
                      <div className="text-xs text-slate-500">x{item.qty}</div>
                    </div>
                    <div className="font-bold text-amber-400 text-sm">
                      {(item.product.price * item.qty).toLocaleString()} ₽
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* TOTAL */}
            <div className="pt-2 border-t border-slate-700/30 flex items-center justify-between">
              <span className="text-xs text-slate-400">Итого:</span>
              <span className="font-bold text-cyan-400">
                {Number(order.totalPrice).toLocaleString()} ₽
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ===== MAIN PAGE =====

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'with_subscription' | 'without_subscription' | 'expired'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '1000' });
      const response = await fetchWithAuth(`/api/clients?${params}`);
      const items = Array.isArray(response) ? response : response?.items || response?.data || [];
      setClients(items);
    } catch (error: any) {
      console.error('Error loading clients:', error);
      toast.error(`Ошибка загрузки: ${error.message}`);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const hasSubscription = getActiveSubscription(client) !== null;
      const sub = getActiveSubscription(client);
      const isExpired = sub && new Date(sub.endDate) < new Date();

      if (filter === 'with_subscription') return hasSubscription && !isExpired;
      if (filter === 'without_subscription') return !hasSubscription;
      if (filter === 'expired') return isExpired;

      return matchesSearch(client, search);
    });
  }, [clients, search, filter]);

  const stats = useMemo(() => {
    const withSub = clients.filter((c) => getActiveSubscription(c) !== null).length;
    const expired = clients.filter((c) => {
      const sub = getActiveSubscription(c);
      return sub && new Date(sub.endDate) < new Date();
    }).length;

    const totalRevenue = clients.reduce((acc, c) => {
      return acc + (c.orders || []).reduce((sum, order) => sum + Number(order.totalPrice), 0);
    }, 0);

    const avgOrderValue =
      clients.length > 0
        ? Math.round(
            clients.reduce((acc, c) => {
              const orderSum = (c.orders || []).reduce(
                (sum, order) => sum + Number(order.totalPrice),
                0
              );
              return acc + orderSum;
            }, 0) / clients.filter((c) => (c.orders || []).length > 0).length
          )
        : 0;

    return {
      total: clients.length,
      withSubscription: withSub,
      withoutSubscription: clients.length - withSub,
      expiredSubscriptions: expired,
      totalRevenue,
      avgOrderValue,
    };
  }, [clients]);

  const handleDelete = async (id: number) => {
    try {
      await fetchWithAuth(`/api/clients/${id}`, { method: 'DELETE' });
      toast.success('Клиент удален');
      loadClients();
    } catch (error: any) {
      toast.error(`Ошибка: ${error.message}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.csv')) {
      importFromCSV(file);
    } else if (file.name.endsWith('.json')) {
      importFromJSON(file);
    } else {
      toast.error('Поддерживаются только CSV и JSON');
    }
  };

  const importFromCSV = async (file: File) => {
    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());

      let imported = 0,
        skipped = 0,
        errors = 0;

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i]
            .split(',')
            .map((v) => v.replace(/"/g, '').trim());
          if (values.length < 3) continue;

          const clientData = {
            name: values[1] || '',
            phone: values[2] || '',
            city: values[3] || undefined,
            address: values[4] || undefined,
            consoleType: values[5] || undefined,
            emailLogin: values[6] || undefined,
            emailPassword: values[7] || undefined,
            accountPassword: values[8] || undefined,
          };

          if (!clientData.name || !clientData.phone) {
            errors++;
            continue;
          }

          const cleanPhone = clientData.phone.replace(/\D/g, '');
          if (cleanPhone.length < 10) {
            errors++;
            continue;
          }
          clientData.phone = `+${cleanPhone.slice(-11)}`;

          try {
            await fetchWithAuth('/api/clients', {
              method: 'POST',
              body: JSON.stringify(clientData),
            });
            imported++;
          } catch (err: any) {
            if (
              err.message?.includes('exist') ||
              err.message?.includes('duplicate')
            ) {
              skipped++;
            } else {
              throw err;
            }
          }
        } catch {
          errors++;
        }
      }

      let message = `Загружено: ${imported}`;
      if (skipped > 0) message += `, пропущено: ${skipped}`;
      if (errors > 0) message += `, ошибок: ${errors}`;

      toast.success(message);
      if (imported > 0) loadClients();
    } catch (error: any) {
      toast.error(`Ошибка импорта: ${error.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const importFromJSON = async (file: File) => {
    setUploading(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const clientsArray = Array.isArray(data) ? data : [data];

      let imported = 0,
        skipped = 0,
        errors = 0;

      for (const clientData of clientsArray) {
        try {
          if (!clientData.name || !clientData.phone) {
            errors++;
            continue;
          }

          const cleanPhone = clientData.phone.replace(/\D/g, '');
          if (cleanPhone.length < 10) {
            errors++;
            continue;
          }

          const normalizedPhone = `+${cleanPhone.slice(-11)}`;
          const isDuplicate = clients.some(
            (c) =>
              c.name.toLowerCase().trim() ===
                clientData.name.toLowerCase().trim() && c.phone === normalizedPhone
          );

          if (isDuplicate) {
            skipped++;
            continue;
          }

          const {
            id,
            tenant,
            subscription,
            subscriptions,
            orders,
            createdAt,
            isActive,
            status,
            notes,
            emailLogin: origEmailLogin,
            emailPassword: origEmailPassword,
            accountPassword: origAccountPassword,
            ...cleanData
          } = clientData;

          const dataToSend: any = {
            name: cleanData.name?.trim(),
            phone: normalizedPhone,
          };

          if (cleanData.city?.trim()) dataToSend.city = cleanData.city.trim();
          if (cleanData.address?.trim())
            dataToSend.address = cleanData.address.trim();
          if (cleanData.consoleType) dataToSend.consoleType = cleanData.consoleType;
          if (origEmailLogin?.trim())
            dataToSend.emailLogin = origEmailLogin.trim();
          if (origEmailPassword?.trim())
            dataToSend.emailPassword = origEmailPassword.trim();
          if (origAccountPassword?.trim())
            dataToSend.accountPassword = origAccountPassword.trim();

          try {
            await fetchWithAuth('/api/clients', {
              method: 'POST',
              body: JSON.stringify(dataToSend),
            });
            imported++;
          } catch (err: any) {
            if (
              err.message?.toLowerCase().includes('exist') ||
              err.message?.toLowerCase().includes('duplicate') ||
              err.message?.toLowerCase().includes('unique')
            ) {
              skipped++;
            } else {
              errors++;
            }
          }
        } catch {
          errors++;
        }
      }

      let message = `Загружено: ${imported}`;
      if (skipped > 0) message += `, пропущено: ${skipped}`;
      if (errors > 0) message += `, ошибок: ${errors}`;

      toast.success(message);
      if (imported > 0) loadClients();
    } catch (error: any) {
      toast.error(`Ошибка импорта: ${error.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      const headers = [
        'ID',
        'Имя',
        'Телефон',
        'Город',
        'Адрес',
        'Консоль',
        'Email логин',
        'Email пароль',
        'Пароль аккаунта',
        'Подписка',
        'Конец подписки',
        'Система шеринга',
        'Дата создания',
      ];

      const rows = clients.map((client) => {
        const sub = getActiveSubscription(client);
        return [
          client.id,
          client.name,
          client.phone,
          client.city || '',
          client.address || '',
          client.consoleType || '',
          client.emailLogin || '',
          client.emailPassword || '',
          client.accountPassword || '',
          sub?.type || 'Нет',
          sub?.endDate ? new Date(sub.endDate).toLocaleDateString('ru') : '',
          sub?.sharingSystem?.name || '',
          client.createdAt ? new Date(client.createdAt).toLocaleDateString('ru') : '',
        ];
      });

      let csv = '\ufeff' + headers.map((h) => `"${h}"`).join(',') + '\n';
      csv += rows
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        )
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast.success(`Экспортировано ${clients.length} клиентов в CSV`);
    } catch (error: any) {
      toast.error('Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  const exportToJSON = async () => {
    setExporting(true);
    try {
      const data = clients.map((c) => ({
        ...c,
        subscription: getActiveSubscription(c),
      }));

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json;charset=utf-8;',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `clients_${new Date().toISOString().split('T')[0]}.json`;
      link.click();

      toast.success(`Экспортировано ${clients.length} клиентов в JSON`);
    } catch (error: any) {
      toast.error('Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  const toggleCardExpanded = (clientId: number) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
    }
    setExpandedCards(newExpanded);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
            Клиенты
          </h1>
          <p className="text-slate-400 mt-2 text-lg">
            Полное управление клиентской базой и историей покупок
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setEditingClient(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold shadow-lg shadow-cyan-500/30 transition-all"
          >
            <Plus className="w-5 h-5" />
            Добавить клиента
          </motion.button>

{/* EXPORT DROPDOWN */}
<div className="relative group">
  <motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    disabled={exporting}
    className="flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 text-slate-300 font-bold transition-all disabled:opacity-50"
  >
    <Download className="w-5 h-5" />
    Экспорт
  </motion.button>

  {/* DROPDOWN MENU */}
  <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-40 min-w-[180px] overflow-hidden">
    <button
      onClick={exportToCSV}
      disabled={exporting || clients.length === 0}
      className="w-full text-left px-4 py-3 hover:bg-slate-800 transition first:rounded-t-lg text-slate-300 disabled:opacity-50 font-medium text-sm"
    >
      📋 CSV
    </button>
    <div className="h-px bg-slate-700/50" />
    <button
      onClick={exportToJSON}
      disabled={exporting || clients.length === 0}
      className="w-full text-left px-4 py-3 hover:bg-slate-800 transition last:rounded-b-lg text-slate-300 disabled:opacity-50 font-medium text-sm"
    >
      📄 JSON
    </button>
  </div>
</div>

          {/* IMPORT */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 text-slate-300 font-bold transition-all disabled:opacity-50"
          >
            <Upload className="w-5 h-5" />
            Импорт
          </motion.button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={handleFileUpload}
            className="hidden"
            disabled={uploading}
          />

          {/* REFRESH */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={loadClients}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 text-slate-300 font-bold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
      </motion.div>

      {/* STATS */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4"
      >
        {[
          {
            value: stats.total,
            label: 'Всего',
            icon: Users,
            color: 'cyan',
            suffix: '',
          },
          {
            value: stats.withSubscription,
            label: 'С подпиской',
            icon: CheckCircle,
            color: 'green',
            suffix: '',
          },
          {
            value: stats.withoutSubscription,
            label: 'Без подписки',
            icon: AlertCircle,
            color: 'amber',
            suffix: '',
          },
          {
            value: stats.expiredSubscriptions,
            label: 'Истекшие',
            icon: AlertTriangle,
            color: 'rose',
            suffix: '',
          },
          {
            value: `${(stats.totalRevenue / 1000000).toFixed(1)}M`,
            label: 'Доход',
            icon: TrendingUp,
            color: 'purple',
            suffix: '₽',
          },
          {
            value: stats.avgOrderValue.toLocaleString(),
            label: 'Средний заказ',
            icon: DollarSign,
            color: 'indigo',
            suffix: '₽',
          },
        ].map((stat, idx) => {
          const Icon = stat.icon;
          const colorMap: any = {
            cyan: 'from-cyan-500/20 to-cyan-500/10 border-cyan-500/30 text-cyan-400',
            green: 'from-green-500/20 to-green-500/10 border-green-500/30 text-green-400',
            amber: 'from-amber-500/20 to-amber-500/10 border-amber-500/30 text-amber-400',
            rose: 'from-rose-500/20 to-rose-500/10 border-rose-500/30 text-rose-400',
            purple: 'from-purple-500/20 to-purple-500/10 border-purple-500/30 text-purple-400',
            indigo: 'from-indigo-500/20 to-indigo-500/10 border-indigo-500/30 text-indigo-400',
          };

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className={`glass rounded-2xl p-5 border bg-gradient-to-br ${colorMap[stat.color]} group hover:shadow-lg transition`}
              whileHover={{ y: -4 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl lg:text-3xl font-bold text-white">
                    {stat.value}
                    {stat.suffix && (
                      <span className="text-sm ml-1">{stat.suffix}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-1.5">{stat.label}</div>
                </div>
                <Icon className={`w-8 h-8 opacity-20 group-hover:opacity-30 transition`} />
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* FILTERS & SEARCH */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-2xl p-6 space-y-4 border border-slate-700/50"
      >
        {/* SEARCH */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            placeholder="Поиск по имени, телефону, городу, адресу..."
            className="w-full pl-12 pr-4 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/50 transition text-base"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="search"
          />
        </div>

        {/* FILTERS */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[
            { key: 'all', label: 'Все', icon: Users },
            { key: 'with_subscription', label: 'С подпиской', icon: CheckCircle },
            { key: 'without_subscription', label: 'Без подписки', icon: AlertCircle },
            { key: 'expired', label: 'Истекшие', icon: AlertTriangle },
          ].map(({ key, label, icon: Icon }) => (
            <motion.button
              key={key}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilter(key as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all whitespace-nowrap font-semibold text-sm ${
                filter === key
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* CONTENT */}
      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass p-20 text-center rounded-2xl border border-slate-700/50"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-14 h-14 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-6"
          />
          <div className="text-slate-400 font-semibold text-lg">
            Загрузка клиентов...
          </div>
        </motion.div>
      ) : filteredClients.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass p-20 text-center rounded-2xl border border-slate-700/50"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Users className="w-24 h-24 mx-auto mb-6 text-slate-700" />
          </motion.div>
          <div className="text-slate-400 font-semibold text-lg">
            Клиенты не найдены
          </div>
          <div className="text-sm text-slate-500 mt-3">
            {search || filter !== 'all'
              ? 'Измените параметры поиска'
              : 'Добавьте первого клиента'}
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {filteredClients.map((client, idx) => (
              <ClientCard
                key={client.id}
                client={client}
                isExpanded={expandedCards.has(client.id)}
                onToggle={toggleCardExpanded}
                onEdit={(c) => {
                  setEditingClient(c);
                  setModalOpen(true);
                }}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* MODAL */}
      <AnimatePresence>
        {modalOpen && (
          <ClientModal
            client={editingClient}
            isOpen={modalOpen}
            onClose={() => {
              setModalOpen(false);
              setEditingClient(null);
            }}
            onSuccess={() => {
              setModalOpen(false);
              setEditingClient(null);
              loadClients();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== CLIENT MODAL =====

function ClientModal({
  client,
  isOpen,
  onClose,
  onSuccess,
}: {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(client?.name || '');
  const [phone, setPhone] = useState(() =>
    client?.phone ? formatPhoneNumber(client.phone) : ''
  );
  const [city, setCity] = useState(client?.city || '');
  const [address, setAddress] = useState(client?.address || '');
  const [consoleType, setConsoleType] = useState(client?.consoleType || '');
  const [emailLogin, setEmailLogin] = useState(client?.emailLogin || '');
  const [emailPassword, setEmailPassword] = useState(client?.emailPassword || '');
  const [accountPassword, setAccountPassword] = useState(
    client?.accountPassword || ''
  );
  const [saving, setSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    email: false,
    account: false,
  });

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneNumber(e.target.value));
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} скопирован`);
    } catch {
      toast.error('Ошибка копирования');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Введите имя');
      return;
    }

    if (!isValidPhone(phone)) {
      toast.error('Неверный номер телефона');
      return;
    }

    setSaving(true);

    try {
      const clientData: any = {
        name: name.trim(),
        phone: cleanPhoneNumber(phone),
      };

      if (city.trim()) clientData.city = city.trim();
      if (address.trim()) clientData.address = address.trim();
      if (consoleType) clientData.consoleType = consoleType;
      if (emailLogin.trim()) clientData.emailLogin = emailLogin.trim();
      if (emailPassword.trim()) clientData.emailPassword = emailPassword.trim();
      if (accountPassword.trim())
        clientData.accountPassword = accountPassword.trim();

      const method = client ? 'PATCH' : 'POST';
      const url = client ? `/api/clients/${client.id}` : '/api/clients';

      await fetchWithAuth(url, {
        method,
        body: JSON.stringify(clientData),
      });

      toast.success(client ? 'Сохранено' : 'Создано');
      onSuccess();
    } catch (error: any) {
      toast.error(`Ошибка: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
        className="glass w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/50"
      >
        <div className="p-8 border-b border-slate-700/50 flex items-center justify-between sticky top-0 bg-slate-900/80 backdrop-blur z-10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-6 h-6 text-cyan-400" />
            {client ? 'Редактировать клиента' : 'Новый клиент'}
          </h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={onClose}
            className="text-3xl text-slate-400 hover:text-slate-200 transition"
            type="button"
          >
            ×
          </motion.button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* BASIC INFO */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-cyan-400" />
              Основная информация
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Имя *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 transition"
                  placeholder="Иван Иванов"
                  required
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Телефон *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 transition font-mono"
                  placeholder="+7 (999) 123-45-67"
                  required
                  disabled={saving}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Город
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 transition"
                  placeholder="Москва"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Адрес
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 transition"
                  placeholder="Ул. Примера, д. 1"
                  disabled={saving}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Консоль
              </label>
              <select
                value={consoleType}
                onChange={(e) => setConsoleType(e.target.value)}
                className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 transition"
                disabled={saving}
              >
                <option value="">Выберите консоль</option>
                <option value="PlayStation 5">PlayStation 5</option>
                <option value="PlayStation 4">PlayStation 4</option>
                <option value="Xbox Series X">Xbox Series X</option>
                <option value="Xbox Series S">Xbox Series S</option>
                <option value="Xbox One">Xbox One</option>
                <option value="Nintendo Switch">Nintendo Switch</option>
              </select>
            </div>
          </div>

          {/* CREDENTIALS */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-purple-400" />
              Данные доступа (опционально)
            </h3>

            <div className="p-5 rounded-xl bg-slate-800/30 border border-slate-700/50 space-y-4">
              {/* EMAIL LOGIN */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Email логин
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={emailLogin}
                    onChange={(e) => setEmailLogin(e.target.value)}
                    className="flex-1 rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 transition"
                    placeholder="example@mail.com"
                    disabled={saving}
                  />
                  {emailLogin && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      onClick={() => copyToClipboard(emailLogin, 'Логин')}
                      className="px-4 py-3 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition"
                    >
                      <Copy className="w-5 h-5 text-cyan-400" />
                    </motion.button>
                  )}
                </div>
              </div>

              {/* EMAIL PASSWORD */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Пароль почты
                </label>
                <div className="flex gap-2">
                  <input
                    type={showPasswords.email ? 'text' : 'password'}
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    className="flex-1 rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 transition"
                    placeholder="••••••••"
                    disabled={saving}
                  />
                  {emailPassword && (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() =>
                          setShowPasswords({
                            ...showPasswords,
                            email: !showPasswords.email,
                          })
                        }
                        className="px-4 py-3 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition"
                      >
                        {showPasswords.email ? (
                          <EyeOff className="w-5 h-5 text-slate-400" />
                        ) : (
                          <Eye className="w-5 h-5 text-slate-400" />
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() =>
                          copyToClipboard(emailPassword, 'Пароль почты')
                        }
                        className="px-4 py-3 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition"
                      >
                        <Copy className="w-5 h-5 text-cyan-400" />
                      </motion.button>
                    </>
                  )}
                </div>
              </div>

              {/* ACCOUNT PASSWORD */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Пароль аккаунта
                </label>
                <div className="flex gap-2">
                  <input
                    type={showPasswords.account ? 'text' : 'password'}
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    className="flex-1 rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/50 transition"
                    placeholder="••••••••"
                    disabled={saving}
                  />
                  {accountPassword && (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() =>
                          setShowPasswords({
                            ...showPasswords,
                            account: !showPasswords.account,
                          })
                        }
                        className="px-4 py-3 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition"
                      >
                        {showPasswords.account ? (
                          <EyeOff className="w-5 h-5 text-slate-400" />
                        ) : (
                          <Eye className="w-5 h-5 text-slate-400" />
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            accountPassword,
                            'Пароль аккаунта'
                          )
                        }
                        className="px-4 py-3 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition"
                      >
                        <Copy className="w-5 h-5 text-cyan-400" />
                      </motion.button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex gap-4 pt-6 border-t border-slate-700/50">
            <motion.button
              whileHover={{ scale: 1.02 }}
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 text-slate-300 font-bold transition"
              disabled={saving}
            >
              Отмена
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              type="submit"
              className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30"
              disabled={saving}
            >
              {saving && (
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              )}
              {client ? 'Сохранить изменения' : 'Создать клиента'}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}