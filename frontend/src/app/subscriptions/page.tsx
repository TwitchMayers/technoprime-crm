// frontend/src/app/subscriptions/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Search, Info, Trash2, CreditCard, Calendar as CalendarIcon, Users, User, Link, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

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
    consoleType: 'PS4' | 'PS5';
    sharingSystem?: {
      id: number;
      name: string;
      donor?: {
        email: string;
        consoleType: 'PS4' | 'PS5';
      };
    };
  };
  donorAccount?: {
    id: number;
    email: string;
    consoleType: 'PS4' | 'PS5';
  };
};

const typeLabels: Record<string, string> = {
  PS_PLUS: '🎮 PS Plus',
  GAME_PASS: '🎯 GamePass',
  EA_PLAY: '⚽ EA Play',
};

const accountTypeLabels = {
  PERSONAL: { label: 'Персональный', icon: User, color: 'text-blue-400 bg-blue-500/20 border-blue-500/30' },
  SHARING_CLIENT: { label: 'Шеринг-клиент', icon: Users, color: 'text-purple-400 bg-purple-500/20 border-purple-500/30' },
  SHARING_DONOR: { label: 'Шеринг-донор', icon: Link, color: 'text-teal-400 bg-teal-500/20 border-teal-500/30' },
};

export default function SubscriptionsPage() {
  const { user, hasRole } = useAuth();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [q, setQ] = useState('');
  const [filterType, setFilterType] = useState<'all'|'PS_PLUS'|'GAME_PASS'|'EA_PLAY'>('all');
  const [filterAccountType, setFilterAccountType] = useState<'all'|'PERSONAL'|'SHARING_CLIENT'|'SHARING_DONOR'>('all');
  const [loading, setLoading] = useState(false);
  const [detailSub, setDetailSub] = useState<Subscription | null>(null);
  const [showSharingModal, setShowSharingModal] = useState(false);

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

  useEffect(() => { 
    if (user) {
      load(); 
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
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-teal-400 bg-clip-text text-transparent">
              Подписки
            </h1>
            <p className="text-slate-400 mt-1">
              Управление подписками и системами шеринга
            </p>
          </div>
          <div className="flex gap-2">
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
        <div className="glass p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
              <option value="PS_PLUS">🎮 PS Plus</option>
              <option value="GAME_PASS">🎯 GamePass</option>
              <option value="EA_PLAY">⚽ EA Play</option>
            </select>

            <select 
              className="rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-2.5" 
              value={filterAccountType} 
              onChange={e=>setFilterAccountType(e.target.value as any)}
            >
              <option value="all">Все типы аккаунтов</option>
              <option value="PERSONAL">👤 Персональные</option>
              <option value="SHARING_CLIENT">👥 Шеринг-клиенты</option>
              <option value="SHARING_DONOR">🔗 Шеринг-доноры</option>
            </select>

            <button className="btn-primary text-sm" onClick={load}>Найти</button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass p-4 text-center">
            <div className="text-2xl font-bold text-white">{subs.length}</div>
            <div className="text-sm text-slate-400">Всего подписок</div>
          </div>
          <div className="glass p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">
              {subs.filter(s => s.accountType === 'PERSONAL').length}
            </div>
            <div className="text-sm text-slate-400">Персональные</div>
          </div>
          <div className="glass p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">
              {subs.filter(s => s.accountType === 'SHARING_CLIENT').length}
            </div>
            <div className="text-sm text-slate-400">Шеринг-клиенты</div>
          </div>
          <div className="glass p-4 text-center">
            <div className="text-2xl font-bold text-teal-400">
              {subs.filter(s => s.accountType === 'SHARING_DONOR').length}
            </div>
            <div className="text-sm text-slate-400">Шеринг-доноры</div>
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
                          <div className="text-white font-medium">{s.client?.name || s.donorAccount?.email || '—'}</div>
                          <div className="text-sm text-slate-400">{s.client?.phone || 'Донорский аккаунт'}</div>
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
                  className="glass p-4 active:scale-[0.98] transition-transform"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="text-lg font-bold text-white">
                        {s.client?.name || s.donorAccount?.email || '—'}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
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
              load();
            }} 
            onDelete={deleteSub}
            canDelete={canDelete}
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
              {sub.client?.name || sub.donorAccount?.email || '—'}
            </div>
            {sub.client?.phone && (
              <div className="text-sm text-slate-400 mt-1">{sub.client.phone}</div>
            )}
            {sub.client?.consoleType && (
              <div className="text-sm text-slate-400 mt-1">{sub.client.consoleType}</div>
            )}
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
                {sub.clientSlot.sharingSystem.donor && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Донорский аккаунт:</span>
                    <span className="text-white">{sub.clientSlot.sharingSystem.donor.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Donor Account Info */}
          {sub.donorAccount && (
            <div className="bg-teal-500/10 p-4 rounded-lg border border-teal-500/30">
              <div className="text-xs text-slate-500 uppercase mb-2">Донорский аккаунт</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-white font-mono text-xs">{sub.donorAccount.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Тип консоли:</span>
                  <span className="text-white">{sub.donorAccount.consoleType}</span>
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
            </div>
          </div>

          {/* Serial Number */}
          <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
            <div className="text-xs text-slate-500 uppercase mb-2">Серийный номер консоли</div>
            <div className="font-mono text-teal-400 font-semibold">{getSerialNumber()}</div>
          </div>

          {/* Account Data - только для персональных аккаунтов */}
          {sub.accountType === 'PERSONAL' && (
            <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
              <div className="text-xs text-slate-500 uppercase mb-3">Данные аккаунта</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-white font-mono text-xs">{sub.client?.emailLogin || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Пароль почты:</span>
                  <span className="text-white font-mono text-xs">{sub.client?.emailPassword || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Пароль аккаунта:</span>
                  <span className="text-white font-mono text-xs">{sub.client?.accountPassword || '—'}</span>
                </div>
              </div>
            </div>
          )}
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