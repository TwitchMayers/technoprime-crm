// frontend/src/app/subscriptions/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Search, Info, Trash2, CreditCard, Calendar as CalendarIcon, Users, User, Link, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import type { SharingConsoleType } from '@/lib/sharing';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageHeader from '@/components/MobilePageHeader';

type Subscription = {
  id:number;
  type:string;
  status:string;
  startDate:string;
  endDate:string;
  serialNumber?:string;
  accountType: 'PERSONAL' | 'SHARING_CLIENT' | 'SHARING_DONOR';
  client?: { 
    id:number; 
    name?:string; 
    phone?:string; 
    consoleType?:string;
    emailLogin?:string;
    emailPassword?:string;
    accountPassword?:string;
    orders?: Array<{
      items: Array<{
        product?: {
          serialNumber?: string;
          category?: string;
        }
      }>
    }>;
  };
  // Новые поля для системы шеринга
  clientSlot?: {
    id: number;
    consoleType: SharingConsoleType;
    emailLogin?: string;
    emailPassword?: string;
    accountPassword?: string;
    sharingSystem?: {
      id: number;
      name: string;
      donor?: {
        consoleType: SharingConsoleType;
      };
    };
  };
  donorAccount?: {
    id: number;
    email: string;
    consoleType: SharingConsoleType;
  };
};

type ClientOption = {
  id: number;
  name: string;
  phone: string;
  consoleType?: string | null;
  emailLogin?: string | null;
  emailPassword?: string | null;
  accountPassword?: string | null;
};

const typeLabels: Record<string, string> = {
  PS_PLUS: 'PS Plus',
  GAME_PASS: 'Game Pass',
  EA_PLAY: 'EA Play',
};

const accountTypeLabels = {
  PERSONAL: { label: 'Персональный', icon: User, color: 'text-blue-400 bg-blue-500/20 border-blue-500/30' },
  SHARING_CLIENT: { label: 'Шеринг-клиент', icon: Users, color: 'text-purple-400 bg-purple-500/20 border-purple-500/30' },
  SHARING_DONOR: { label: 'Шеринг-донор', icon: Link, color: 'text-teal-400 bg-teal-500/20 border-teal-500/30' },
};

function getSubscriptionOwnerLabel(sub: Subscription) {
  if (sub.client?.name) return sub.client.name;
  if (sub.accountType === 'SHARING_DONOR') return 'Донорский аккаунт';
  return '—';
}

function getSubscriptionOwnerSubtitle(sub: Subscription) {
  if (sub.client?.phone) return sub.client.phone;
  if (sub.accountType === 'SHARING_DONOR') return 'Данные донора скрыты';
  return '—';
}

function getVisibleAccountFields(sub: Subscription) {
  const source =
    sub.accountType === 'PERSONAL'
      ? {
          emailLogin: sub.client?.emailLogin,
          emailPassword: sub.client?.emailPassword,
          accountPassword: sub.client?.accountPassword,
        }
      : sub.accountType === 'SHARING_CLIENT'
        ? {
            emailLogin: sub.clientSlot?.emailLogin,
            emailPassword: sub.clientSlot?.emailPassword,
            accountPassword: sub.clientSlot?.accountPassword,
          }
        : null;

  if (!source) return [] as Array<{ label: string; value: string }>;

  return [
    source.emailLogin ? { label: 'Логин', value: source.emailLogin } : null,
    source.emailPassword ? { label: 'Пароль почты', value: source.emailPassword } : null,
    source.accountPassword ? { label: 'Пароль профиля', value: source.accountPassword } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;
}

function getAccountFieldsTitle(sub: Subscription) {
  if (sub.accountType === 'SHARING_CLIENT') return 'Данные подключенного аккаунта';
  if (sub.accountType === 'PERSONAL') return 'Данные аккаунта';
  return 'Данные доступа';
}

export default function SubscriptionsPage() {
  const { user, hasRole } = useAuth();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [q, setQ] = useState('');
  const [filterType, setFilterType] = useState<'all'|'PS_PLUS'|'GAME_PASS'|'EA_PLAY'>('all');
  const [filterAccountType, setFilterAccountType] = useState<'all'|'PERSONAL'|'SHARING_CLIENT'|'SHARING_DONOR'>('all');
  const [loading, setLoading] = useState(false);
  const [detailSub, setDetailSub] = useState<Subscription | null>(null);
  const [showSharingModal, setShowSharingModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetchWithAuth('/api/subscriptions').then(r=>r.json()).catch(()=>[]);
    let list = Array.isArray(res) ? res : (res.items || []);
    
    // Фильтрация
    if (q) {
      list = list.filter((s:Subscription) => 
        s.client?.name?.toLowerCase().includes(q.toLowerCase()) || 
        s.client?.phone?.includes(q) ||
        s.donorAccount?.email?.toLowerCase().includes(q.toLowerCase())
      );
    }
    if (filterType !== 'all') list = list.filter((s:Subscription) => s.type === filterType);
    if (filterAccountType !== 'all') list = list.filter((s:Subscription) => s.accountType === filterAccountType);
    
    setSubs(list);
    setLoading(false);
  };

  const loadClients = async () => {
    const res = await fetchWithAuth('/api/clients?limit=500').catch(() => ({ items: [] }));
    const list = Array.isArray(res) ? res : (res?.items || []);
    setClients(Array.isArray(list) ? list : []);
  };

  useEffect(() => { 
    if (user) {
      void Promise.all([load(), loadClients()]);
    }
  }, [filterType, filterAccountType, user]);

  const deleteSub = async (id: number) => {
    if (!confirm('Удалить подписку? Это действие нельзя отменить.')) return;

    try {
      const res = await fetchWithAuth(`/api/subscriptions/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.message || 'Ошибка удаления');
        return;
      }

      toast.success('Подписка удалена');
      load();
    } catch (err) {
      console.error('Delete subscription error:', err);
      toast.error('Ошибка удаления подписки');
    }
  };

  const daysLeft = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000*60*60*24));
    return diff > 0 ? diff : 0;
  };

  const canDelete = hasRole('ADMIN', 'MANAGER');

  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
      <div className="mobile-page-shell md:space-y-4">
        <MobilePageHeader title="Подписки" subtitle="Шеринг, продления и доступы" sticky={false} />

        {/* Header */}
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/35 p-3 md:flex-row md:items-center md:gap-4 md:border-0 md:bg-transparent md:p-0">
          <div className="hidden md:block">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-teal-400 bg-clip-text text-transparent">
              Подписки
            </h1>
            <p className="text-slate-400 mt-1">
              Управление подписками и системами шеринга
            </p>
          </div>
          <div className="mobile-action-grid md:flex md:gap-2">
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4" />
              Добавить подписку
            </button>
            <button 
              className="btn-secondary flex items-center gap-2"
              onClick={() => setShowSharingModal(true)}
            >
              <Users className="w-4 h-4" />
              Системы шеринга
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="glass p-3 md:p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                placeholder="Поиск по клиенту или email"
                className="w-full pl-10 rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5"
                value={q}
                onChange={e=>setQ(e.target.value)}
                onKeyDown={e=> e.key==='Enter' ? load() : null}
              />
            </div>
            
            <select 
              className="rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-2.5" 
              value={filterType} 
              onChange={e=>setFilterType(e.target.value as any)}
            >
              <option value="all">Все типы подписок</option>
              <option value="PS_PLUS">PS Plus</option>
              <option value="GAME_PASS">Game Pass</option>
              <option value="EA_PLAY">EA Play</option>
            </select>

            <select 
              className="rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-2.5" 
              value={filterAccountType} 
              onChange={e=>setFilterAccountType(e.target.value as any)}
            >
              <option value="all">Все типы аккаунтов</option>
              <option value="PERSONAL">Персональные</option>
              <option value="SHARING_CLIENT">Шеринг-клиенты</option>
              <option value="SHARING_DONOR">Шеринг-доноры</option>
            </select>

            <button className="btn-primary text-sm" onClick={load}>Найти</button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
          <div className="glass p-3 text-center md:p-4">
            <div className="text-xl font-bold text-white md:text-2xl">{subs.length}</div>
            <div className="text-xs text-slate-400 md:text-sm">Всего подписок</div>
          </div>
          <div className="glass p-3 text-center md:p-4">
            <div className="text-xl font-bold text-blue-400 md:text-2xl">
              {subs.filter(s => s.accountType === 'PERSONAL').length}
            </div>
            <div className="text-xs text-slate-400 md:text-sm">Персональные</div>
          </div>
          <div className="glass p-3 text-center md:p-4">
            <div className="text-xl font-bold text-purple-400 md:text-2xl">
              {subs.filter(s => s.accountType === 'SHARING_CLIENT').length}
            </div>
            <div className="text-xs text-slate-400 md:text-sm">Шеринг-клиенты</div>
          </div>
          <div className="glass p-3 text-center md:p-4">
            <div className="text-xl font-bold text-teal-400 md:text-2xl">
              {subs.filter(s => s.accountType === 'SHARING_DONOR').length}
            </div>
            <div className="text-xs text-slate-400 md:text-sm">Шеринг-доноры</div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block glass overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="bg-slate-800/60">
                <tr className="text-slate-400 text-sm">
                  <th className="text-left p-4">Клиент</th>
                  <th className="text-left p-4">Тип подписки</th>
                  <th className="text-left p-4">Тип аккаунта</th>
                  <th className="text-left p-4">Система шеринга</th>
                  <th className="text-left p-4">Окончание</th>
                  <th className="text-center p-4">Осталось</th>
                  <th className="text-left p-4">Статус</th>
                  <th className="text-center p-4">Действия</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400">Загрузка…</td></tr>
                ) : subs.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400">Подписки не найдены</td></tr>
                ) : (
                  subs.map((s) => {
                    const accountTypeConfig = accountTypeLabels[s.accountType];
                    const AccountTypeIcon = accountTypeConfig.icon;
                    
                    return (
                      <tr key={s.id} className="border-t border-slate-700/50 hover:bg-slate-800/30 transition">
                        <td className="p-4">
                          <div className="text-white font-medium">{getSubscriptionOwnerLabel(s)}</div>
                          <div className="text-sm text-slate-400">{getSubscriptionOwnerSubtitle(s)}</div>
                        </td>
                        <td className="p-4 text-slate-300">{typeLabels[s.type] || s.type}</td>
                        <td className="p-4">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${accountTypeConfig.color} border`}>
                            <AccountTypeIcon className="w-3 h-3" />
                            {accountTypeConfig.label}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-slate-400">
                          {s.clientSlot?.sharingSystem?.name || 
                           (s.accountType === 'SHARING_DONOR' ? 'Донорская система' : '—')}
                          {s.clientSlot?.consoleType && (
                            <div className="text-xs text-slate-500 mt-1">{s.clientSlot.consoleType}</div>
                          )}
                        </td>
                        <td className="p-4 text-sm text-slate-400">{new Date(s.endDate).toLocaleDateString('ru')}</td>
                        <td className="p-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            daysLeft(s.endDate)>7
                              ?'bg-green-500/20 text-green-400 border border-green-500/30'
                              :'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {daysLeft(s.endDate)} дн.
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            s.status==='ACTIVE'
                              ?'bg-green-500/20 text-green-400 border border-green-500/30'
                              :'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition" 
                              onClick={()=>setDetailSub(s)}
                            >
                              <Info className="w-4 h-4" />
                            </button>
                            {canDelete && (
                              <button 
                                className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 transition" 
                                onClick={()=>deleteSub(s.id)}
                              >
                                <Trash2 className="w-4 h-4 text-rose-400" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="glass p-8 text-center">
              <div className="animate-spin w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <div className="text-slate-400">Загрузка подписок…</div>
            </div>
          ) : subs.length === 0 ? (
            <div className="glass p-12 text-center">
              <CreditCard className="w-20 h-20 mx-auto mb-4 text-slate-700" />
              <div className="text-slate-400 font-medium">Подписки не найдены</div>
            </div>
          ) : (
            subs.map((s, idx) => {
              const accountTypeConfig = accountTypeLabels[s.accountType];
              const AccountTypeIcon = accountTypeConfig.icon;

              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass p-3 transition-transform active:scale-[0.98] sm:p-4"
                >
                  {/* Header */}
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-bold text-white sm:text-lg">
                        {getSubscriptionOwnerLabel(s)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${accountTypeConfig.color} border`}>
                          <AccountTypeIcon className="w-3 h-3" />
                          {accountTypeConfig.label}
                        </div>
                        <span className="text-sm text-slate-400">{typeLabels[s.type] || s.type}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        s.status==='ACTIVE'
                          ?'bg-green-500/20 text-green-400 border border-green-500/30'
                          :'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {s.status}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        daysLeft(s.endDate)>7 ? 'text-green-400' : 'text-rose-400'
                      }`}>
                        {daysLeft(s.endDate)} дн.
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 py-3 border-t border-b border-slate-700/50">
                    {s.client?.phone && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Телефон:</span>
                        <a href={`tel:${s.client.phone}`} className="text-slate-300 hover:text-teal-400 transition">
                          {s.client.phone}
                        </a>
                      </div>
                    )}

                    {s.accountType === 'SHARING_DONOR' && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Доступ:</span>
                        <span className="text-slate-300">Данные донора скрыты</span>
                      </div>
                    )}
                    
                    {s.clientSlot?.sharingSystem && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Система шеринга:</span>
                        <span className="text-slate-300 font-medium">
                          {s.clientSlot.sharingSystem.name}
                        </span>
                      </div>
                    )}

                    {s.clientSlot?.consoleType && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Консоль:</span>
                        <span className="text-slate-300">{s.clientSlot.consoleType}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">До:</span>
                      <span className="text-slate-300 font-medium">
                        {new Date(s.endDate).toLocaleDateString('ru', { 
                          day: '2-digit', 
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setDetailSub(s)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition active:scale-95 font-medium"
                    >
                      <Info className="w-4 h-4" />
                      Подробнее
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => deleteSub(s.id)}
                        className="px-4 py-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 transition active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Detail Modal */}
        {detailSub && (
          <SubDetailModal 
            sub={detailSub} 
            onClose={()=>{
              setDetailSub(null);
              void load();
            }} 
            onDelete={deleteSub}
            canDelete={canDelete}
          />
        )}

        {showCreateModal && (
          <CreateSubscriptionModal
            clients={clients}
            onClose={() => setShowCreateModal(false)}
            onCreated={async () => {
              setShowCreateModal(false);
              await Promise.all([load(), loadClients()]);
            }}
          />
        )}

        {/* Sharing Systems Modal */}
        {showSharingModal && (
          <SharingSystemsModal onClose={() => setShowSharingModal(false)} />
        )}
      </div>
    </ProtectedRoute>
  );
}

// ОБНОВЛЕННЫЙ SubDetailModal с информацией о системе шеринга
function SubDetailModal({ 
  sub, 
  onClose, 
  onDelete, 
  canDelete 
}: { 
  sub: Subscription; 
  onClose: () => void;
  onDelete: (id: number) => void;
  canDelete: boolean;
}) {
  const daysLeft = () => {
    const end = new Date(sub.endDate);
    const now = new Date();
    return Math.ceil((end.getTime() - now.getTime()) / (1000*60*60*24));
  };

  const getSerialNumber = () => {
    if (sub.serialNumber) return sub.serialNumber;
    
    if (sub.client?.orders && sub.client.orders.length > 0) {
      const consoleItem = sub.client.orders[0].items?.find(
        item => item.product?.category === 'CONSOLE'
      );
      return consoleItem?.product?.serialNumber || '—';
    }
    
    return '—';
  };

  const accountTypeConfig = accountTypeLabels[sub.accountType];
  const AccountTypeIcon = accountTypeConfig.icon;
  const visibleAccountFields = getVisibleAccountFields(sub);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-0">
      <motion.div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <motion.div 
        className="glass w-full max-w-lg p-4 md:p-6 relative max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-xl font-bold text-white">Детали подписки</div>
          {canDelete && (
            <button
              onClick={() => {
                onDelete(sub.id);
                onClose();
              }}
              className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 transition active:scale-95"
            >
              <Trash2 className="w-5 h-5 text-rose-400" />
            </button>
          )}
        </div>

        <div className="space-y-4">
          {/* Account Type Badge */}
          <div className={`p-4 rounded-lg border ${accountTypeConfig.color}`}>
            <div className="flex items-center gap-3">
              <AccountTypeIcon className="w-6 h-6" />
              <div>
                <div className="font-bold text-white">{accountTypeConfig.label}</div>
                <div className="text-sm text-slate-300 mt-1">
                  {sub.accountType === 'SHARING_CLIENT' && 'Клиент в системе шеринга'}
                  {sub.accountType === 'SHARING_DONOR' && 'Донорский аккаунт системы шеринга'}
                  {sub.accountType === 'PERSONAL' && 'Персональный аккаунт'}
                </div>
              </div>
            </div>
          </div>

          {/* Client/Donor Info */}
          <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
            <div className="text-xs text-slate-500 uppercase mb-2">
              {sub.accountType === 'SHARING_DONOR' ? 'Донорский аккаунт' : 'Клиент'}
            </div>
            <div className="font-semibold text-white text-lg">
              {getSubscriptionOwnerLabel(sub)}
            </div>
            <div className="text-sm text-slate-400 mt-1">{getSubscriptionOwnerSubtitle(sub)}</div>
            {sub.client?.consoleType ? (
              <div className="text-sm text-slate-400 mt-1">{sub.client.consoleType}</div>
            ) : null}
          </div>

          {/* Sharing System Info */}
          {sub.clientSlot?.sharingSystem && (
            <div className="bg-purple-500/10 p-4 rounded-lg border border-purple-500/30">
              <div className="text-xs text-slate-500 uppercase mb-2">Система шеринга</div>
              <div className="font-bold text-purple-400 text-lg mb-2">
                {sub.clientSlot.sharingSystem.name}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Тип консоли:</span>
                  <span className="text-white">{sub.clientSlot.consoleType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Доступ:</span>
                  <span className="text-white">Через подключенный слот</span>
                </div>
              </div>
            </div>
          )}

          {/* Donor Account Info */}
          {sub.donorAccount && (
            <div className="bg-teal-500/10 p-4 rounded-lg border border-teal-500/30">
              <div className="text-xs text-slate-500 uppercase mb-2">Донорский аккаунт</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Тип консоли:</span>
                  <span className="text-white">{sub.donorAccount.consoleType}</span>
                </div>
                <div className="text-slate-300">
                  Данные донора скрыты и не показываются в клиентских профилях.
                </div>
              </div>
            </div>
          )}

          {/* Subscription Info */}
          <div className="bg-gradient-to-br from-purple-900/20 to-teal-900/20 p-4 rounded-lg border border-purple-500/30">
            <div className="text-xs text-slate-500 uppercase mb-2">Подписка</div>
            <div className="font-bold text-xl text-white mb-3">{typeLabels[sub.type] || sub.type}</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Начало:</span>
                <span className="text-white">{new Date(sub.startDate).toLocaleDateString('ru')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Окончание:</span>
                <span className="text-white">{new Date(sub.endDate).toLocaleDateString('ru')}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
                <span className="text-slate-400">Осталось:</span>
                <span className={`text-xl font-bold ${daysLeft() > 7 ? 'text-green-400' : 'text-rose-400'}`}>
                  {daysLeft()} дней
                </span>
              </div>

              {visibleAccountFields.length > 0 && (
                <div className="pt-3 border-t border-slate-700/50 space-y-2">
                  <div className="text-xs text-slate-400 uppercase">
                    {getAccountFieldsTitle(sub)}
                  </div>
                  {visibleAccountFields.map(field => (
                    <div key={field.label} className="flex justify-between gap-3">
                      <span className="text-slate-400">{field.label}:</span>
                      <span className="text-white font-mono text-xs text-right break-all">
                        {field.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Serial Number */}
          <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
            <div className="text-xs text-slate-500 uppercase mb-2">Серийный номер консоли</div>
            <div className="font-mono text-teal-400 font-semibold">{getSerialNumber()}</div>
          </div>

        </div>

        <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center justify-end gap-3">
          {canDelete && (
            <button 
              className="btn-danger order-2 md:order-1" 
              onClick={() => {
                onDelete(sub.id);
                onClose();
              }}
            >
              <Trash2 className="w-4 h-4 inline mr-2" />
              Удалить
            </button>
          )}
          <button className="btn-secondary order-1 md:order-2" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function formatInputDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function addPeriod(dateString: string, period: 'MONTH' | 'THREE_MONTHS' | 'YEAR') {
  const base = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(base.getTime())) {
    return formatInputDate(new Date());
  }

  const next = new Date(base);
  if (period === 'MONTH') next.setMonth(next.getMonth() + 1);
  if (period === 'THREE_MONTHS') next.setMonth(next.getMonth() + 3);
  if (period === 'YEAR') next.setFullYear(next.getFullYear() + 1);
  return formatInputDate(next);
}

function toIsoDate(dateString: string, endOfDay = false) {
  const suffix = endOfDay ? 'T23:59:59.000Z' : 'T00:00:00.000Z';
  return new Date(`${dateString}${suffix}`).toISOString();
}

function CreateSubscriptionModal({
  clients,
  onClose,
  onCreated,
}: {
  clients: ClientOption[];
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const today = formatInputDate(new Date());
  const [saving, setSaving] = useState(false);
  const [clientId, setClientId] = useState<number>(0);
  const [type, setType] = useState<'PS_PLUS' | 'GAME_PASS' | 'EA_PLAY'>('GAME_PASS');
  const [subscriptionPeriod, setSubscriptionPeriod] = useState<'MONTH' | 'THREE_MONTHS' | 'YEAR'>('MONTH');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addPeriod(today, 'MONTH'));
  const [consoleType, setConsoleType] = useState('Xbox');
  const [emailLogin, setEmailLogin] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [accountPassword, setAccountPassword] = useState('');

  const selectedClient = clients.find(item => item.id === clientId) || null;

  useEffect(() => {
    if (!selectedClient) return;
    setConsoleType(selectedClient.consoleType || consoleType);
    setEmailLogin(selectedClient.emailLogin || '');
    setEmailPassword(selectedClient.emailPassword || '');
    setAccountPassword(selectedClient.accountPassword || '');
  }, [selectedClient]);

  const submit = async () => {
    if (!clientId) {
      toast.error('Выберите клиента');
      return;
    }
    if (!emailLogin.trim() || !emailPassword.trim()) {
      toast.error('Укажите логин и пароль аккаунта');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('Укажите срок подписки');
      return;
    }
    if (new Date(`${endDate}T23:59:59`).getTime() <= new Date(`${startDate}T00:00:00`).getTime()) {
      toast.error('Дата окончания должна быть позже даты начала');
      return;
    }

    setSaving(true);
    try {
      await fetchWithAuth('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          type,
          startDate: toIsoDate(startDate),
          endDate: toIsoDate(endDate, true),
          status: 'ACTIVE',
          accountType: 'PERSONAL',
          subscriptionPeriod,
          consoleType: consoleType.trim() || undefined,
          emailLogin: emailLogin.trim(),
          emailPassword: emailPassword.trim(),
          accountPassword: accountPassword.trim() || undefined,
        }),
      });

      toast.success('Подписка добавлена');
      await onCreated();
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось создать подписку');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-0">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <motion.div
        className="glass relative w-full max-w-2xl p-4 md:p-6 max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-bold text-white">Новая подписка</div>
            <div className="text-sm text-slate-400 mt-1">
              Создание персональной подписки с логином, паролем и сроком действия.
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-slate-300">Клиент</span>
            <select
              className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5"
              value={clientId}
              onChange={(e) => setClientId(Number(e.target.value))}
            >
              <option value={0}>Выберите клиента</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.phone})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">Тип подписки</span>
            <select
              className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5"
              value={type}
              onChange={(e) => setType(e.target.value as any)}
            >
              <option value="PS_PLUS">PlayStation Plus</option>
              <option value="GAME_PASS">Xbox Ultimate Game Pass</option>
              <option value="EA_PLAY">EA Play</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">Период</span>
            <select
              className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5"
              value={subscriptionPeriod}
              onChange={(e) => {
                const next = e.target.value as 'MONTH' | 'THREE_MONTHS' | 'YEAR';
                setSubscriptionPeriod(next);
                setEndDate(addPeriod(startDate, next));
              }}
            >
              <option value="MONTH">1 месяц</option>
              <option value="THREE_MONTHS">3 месяца</option>
              <option value="YEAR">1 год</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">Дата начала</span>
            <input
              type="date"
              className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setEndDate(addPeriod(e.target.value, subscriptionPeriod));
              }}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">Дата окончания</span>
            <input
              type="date"
              className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-slate-300">Платформа / консоль</span>
            <input
              className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5"
              value={consoleType}
              onChange={(e) => setConsoleType(e.target.value)}
              placeholder="Например: Xbox Series X / PS5 / Steam Deck"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-slate-300">Логин аккаунта</span>
            <input
              className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5"
              value={emailLogin}
              onChange={(e) => setEmailLogin(e.target.value)}
              placeholder="user@email.com"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">Пароль аккаунта</span>
            <input
              className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder="Пароль от аккаунта / почты"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">Пароль профиля</span>
            <input
              className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5"
              value={accountPassword}
              onChange={(e) => setAccountPassword(e.target.value)}
              placeholder="Дополнительно, если нужен"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <button className="btn-primary flex items-center justify-center gap-2" onClick={submit} disabled={saving}>
            <Plus className="w-4 h-4" />
            {saving ? 'Сохраняем...' : 'Создать подписку'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Модальное окно систем шеринга
function SharingSystemsModal({ onClose }: { onClose: () => void }) {
  const [systems, setSystems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSystems = async () => {
      try {
        const response = await fetchWithAuth('/api/sharing-systems?isActive=true');
        const data = await response.json();
        setSystems(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error loading sharing systems:', error);
        toast.error('Ошибка загрузки систем шеринга');
      } finally {
        setLoading(false);
      }
    };

    loadSystems();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-0">
      <motion.div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <motion.div 
        className="glass w-full max-w-4xl p-4 md:p-6 relative max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-2xl font-bold text-white">Системы шеринга</div>
            <div className="text-slate-400 mt-1">Управление системами общего доступа</div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <div className="text-slate-400">Загрузка систем шеринга...</div>
          </div>
        ) : systems.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <div className="text-slate-400 font-medium">Системы шеринга не найдены</div>
            <div className="text-sm text-slate-500 mt-2">Создайте первую систему шеринга</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systems.map((system) => (
              <div key={system.id} className="glass p-4 rounded-lg border border-slate-700/50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold text-white text-lg">{system.name}</div>
                    <div className="text-sm text-slate-400 mt-1">
                      Донор: {system.donor?.email} • {system.donor?.consoleType}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-400">Осталось дней</div>
                    <div className="text-xl font-bold text-teal-400">{system.daysLeft}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="p-2 rounded bg-slate-800/50 text-center">
                    <div className="text-sm text-slate-400">Использовано слотов</div>
                    <div className="text-lg font-bold text-white">
                      {system.usedSlots} / {system.totalSlots}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-800/50 text-center">
                    <div className="text-sm text-slate-400">Свободно слотов</div>
                    <div className="text-lg font-bold text-teal-400">
                      {system.availableSlots}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400">
                  Подключено клиентов: {system.clientSlots?.filter((s: any) => s.isActive).length || 0}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button className="btn-primary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </motion.div>
    </div>
  );
}
