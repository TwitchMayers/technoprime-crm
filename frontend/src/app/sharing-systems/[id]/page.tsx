'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Users, Calendar, Mail, Key,
  AlertTriangle, Clock, Trash2, Globe, Shield, Copy, 
  Edit, ExternalLink, Hash, Battery, QrCode, Zap, Activity
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { getSharingConsoleMeta, getSharingSlotTypes, getSlotStat, type SharingConsoleType } from '@/lib/sharing';

type ClientSlot = {
  id: number;
  clientId: number;
  client: {
    id: number;
    name: string;
    phone: string;
  };
  consoleType: SharingConsoleType;
  emailLogin?: string;
  emailPassword?: string;
  accountPassword?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  notes?: string;
};

type DonorAccount = {
  id: number;
  email: string;
  password: string;
  consoleType: SharingConsoleType;
  startDate: string;
  endDate: string;
  subscriptionType: string;
  subscriptionPeriod: string;
  isActive: boolean;
  region?: string;
  emailLogin?: string;
  emailPassword?: string;
  accountPassword?: string;
  dateOfBirth?: string;
  backupCodes?: string;
  notes?: string;
};

type SharingSystem = {
  id: number;
  name: string;
  isActive: boolean;
  totalSlots: number;
  availableSlots: number;
  usedSlots: number;
  daysLeft: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
  donor: DonorAccount;
  clientSlots: ClientSlot[];
  slotStats: {
    ps5: {
      used: number;
      max: number;
      available: number;
    };
    ps4: {
      used: number;
      max: number;
      available: number;
    };
    xbox1?: {
      used: number;
      max: number;
      available: number;
    };
    xbox2?: {
      used: number;
      max: number;
      available: number;
    };
  };
};

export default function SharingSystemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [system, setSystem] = useState<SharingSystem | null>(null);
  const [removingSlot, setRemovingSlot] = useState<number | null>(null);
  const [showDonorPassword, setShowDonorPassword] = useState(false);

  const loadSystem = async () => {
    try {
      const data = await fetchWithAuth(`sharing-systems/${params.id}`);
      setSystem(data);
    } catch (error) {
      console.error('Error loading sharing system:', error);
      toast.error('Ошибка загрузки системы шеринга');
      router.push('/sharing-systems');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      loadSystem();
    }
  }, [params.id]);

  const handleDeleteSystem = async () => {
    if (!confirm('Вы уверены? Это действие нельзя отменить!')) {
      return;
    }

    setDeleting(true);
    try {
      await fetchWithAuth(`sharing-systems/${params.id}`, {
        method: 'DELETE',
      });
      
      toast.success('Система шеринга удалена');
      router.push('/sharing-systems');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления системы');
    } finally {
      setDeleting(false);
    }
  };

  const removeClientSlot = async (slotId: number) => {
    if (!confirm('Отвязать клиента?')) return;
    
    setRemovingSlot(slotId);
    try {
      await fetchWithAuth(`sharing-systems/client-slot/${slotId}`, {
        method: 'DELETE',
      });
      
      toast.success('Клиент отвязан');
      await loadSystem();
    } catch (error: any) {
      toast.error(error.message || 'Ошибка');
    } finally {
      setRemovingSlot(null);
    }
  };

  const editClientSlot = async (slotId: number) => {
    const slot = system?.clientSlots.find(s => s.id === slotId);
    if (!slot) return;

    const newPassword = prompt('Новый пароль:', slot.accountPassword || '');
    if (newPassword === null) return;

    try {
      await fetchWithAuth(`sharing-systems/client-slot/${slotId}/edit`, {
        method: 'PUT',
        body: JSON.stringify({
          accountPassword: newPassword,
        }),
      });
      
      toast.success('Обновлено');
      await loadSystem();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text);
    toast.success(message);
  };

  if (loading) {
    return (
      <div className="glass p-12 text-center rounded-2xl">
        <div className="animate-spin w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <div className="text-slate-400">Загрузка...</div>
      </div>
    );
  }

  if (!system) {
    return (
      <div className="glass p-12 text-center rounded-2xl">
        <AlertTriangle className="w-20 h-20 mx-auto mb-4 text-rose-400" />
        <div className="text-slate-400 font-medium">Не найдена</div>
        <Link href="/sharing-systems" className="btn-secondary mt-4 inline-block">
          Назад
        </Link>
      </div>
    );
  }

  const activeClientSlots = system.clientSlots.filter(slot => slot.isActive);
  const anySlotAvailable = system.availableSlots > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Link
          href="/sharing-systems"
          className="p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition-all hover:scale-110"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-teal-400 bg-clip-text text-transparent">
            {system.name}
          </h1>
          <p className="text-slate-400 text-sm mt-1 flex items-center gap-2 flex-wrap">
            <Hash className="w-4 h-4" />
            ID: {system.id}
          </p>
        </div>
        <div className={`px-4 py-2 rounded-full font-bold flex items-center gap-2 text-sm whitespace-nowrap ${
          system.isExpired ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50' :
          system.isExpiringSoon ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' :
          'bg-teal-500/20 text-teal-400 border border-teal-500/50'
        }`}>
          <Battery className="w-4 h-4" />
          {system.isExpired ? 'Истекла' : system.isExpiringSoon ? 'Скоро' : 'Активна'}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* LEFT: Donor + Clients */}
        <div className="xl:col-span-3 space-y-6">
          {/* Donor Account */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass p-6 rounded-2xl border border-slate-700/50"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="p-2.5 rounded-lg bg-gradient-to-br from-teal-500/20 to-purple-500/20">
                  <Users className="w-5 h-5 text-teal-400" />
                </div>
                <h2 className="text-lg font-bold text-white">Донорский аккаунт</h2>
              </div>
              <Link
                href={`/sharing-systems/${system.id}/edit-donor`}
                className="text-sm text-teal-400 hover:text-teal-300 flex items-center gap-1"
              >
                <Edit className="w-4 h-4" />
                Редактировать
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Console Type */}
	              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-600/50">
	                <div className="flex items-center gap-2 mb-3">
	                  {(() => {
	                    const meta = getSharingConsoleMeta(system.donor.consoleType);
	                    const Icon = meta.icon;
	                    return <Icon className={`h-6 w-6 ${meta.textClass}`} />;
	                  })()}
	                  <div>
	                    <div className="text-xs text-slate-400">Консоль</div>
	                    <div className="font-bold text-white">
	                      {system.donor.consoleType.startsWith('XBOX') ? 'Xbox' : getSharingConsoleMeta(system.donor.consoleType).label}
	                    </div>
	                  </div>
	                </div>
                <div className="text-sm text-slate-300">{system.donor.subscriptionType}</div>
              </div>

              {/* Days Left */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-600/50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Осталось дней</div>
                    <div className={`text-lg font-bold ${
                      system.daysLeft <= 0 ? 'text-rose-400' :
                      system.daysLeft <= 30 ? 'text-amber-400' :
                      'text-teal-400'
                    }`}>
                      {system.daysLeft}
                    </div>
                  </div>
                  <Clock className={`w-8 h-8 ${
                    system.daysLeft <= 0 ? 'text-rose-400/50' :
                    system.daysLeft <= 30 ? 'text-amber-400/50' :
                    'text-teal-400/50'
                  }`} />
                </div>
              </div>

              {/* Email */}
              <div className="md:col-span-2 p-4 rounded-xl bg-slate-800/50 border border-slate-600/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-slate-400">Email</div>
                  <button
                    onClick={() => copyToClipboard(system.donor.email, 'Email скопирован')}
                    className="text-teal-400 hover:text-teal-300"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <div className="font-mono text-sm text-white break-all">{system.donor.email}</div>
              </div>

              {/* Password */}
              <div className="md:col-span-2 p-4 rounded-xl bg-slate-800/50 border border-slate-600/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-slate-400">Пароль</div>
                  <button
                    onClick={() => setShowDonorPassword(!showDonorPassword)}
                    className="text-teal-400 hover:text-teal-300 text-xs"
                  >
                    {showDonorPassword ? 'Скрыть' : 'Показать'}
                  </button>
                </div>
                <div className="font-mono text-sm text-white">
                  {showDonorPassword ? system.donor.password : '••••••••'}
                </div>
              </div>

              {/* Additional Info */}
              {system.donor.region && (
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-600/50">
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Регион
                  </div>
                  <div className="font-medium text-white">{system.donor.region}</div>
                </div>
              )}

              {system.donor.dateOfBirth && (
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-600/50">
                  <div className="text-xs text-slate-400 mb-1">Дата рождения</div>
                  <div className="font-medium text-white">
                    {new Date(system.donor.dateOfBirth).toLocaleDateString('ru')}
                  </div>
                </div>
              )}

              {system.donor.emailLogin && (
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-600/50">
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Логин почты
                  </div>
                  <div className="font-mono text-sm text-white truncate">{system.donor.emailLogin}</div>
                </div>
              )}

              {system.donor.accountPassword && (
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-600/50">
                  <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Пароль аккаунта
                  </div>
                  <button
                    onClick={() => copyToClipboard(system.donor.accountPassword!, 'Скопирован')}
                    className="text-xs text-teal-400 hover:text-teal-300"
                  >
                    Скопировать
                  </button>
                </div>
              )}
            </div>

            {system.donor.backupCodes && (
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-600/50">
                <div className="text-xs text-slate-400 mb-2">Резервные коды</div>
                <button
                  onClick={() => copyToClipboard(system.donor.backupCodes!, 'Коды скопированы')}
                  className="text-sm text-teal-400 hover:text-teal-300"
                >
                  Скопировать все
                </button>
              </div>
            )}
          </motion.div>

          {/* Clients List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass p-6 rounded-2xl border border-slate-700/50"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="p-2.5 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                  <Activity className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-lg font-bold text-white">Подключенные клиенты</h2>
              </div>
              <div className="text-sm text-slate-400">
                {activeClientSlots.length} клиент{activeClientSlots.length !== 1 ? 'ов' : ''}
              </div>
            </div>

            {activeClientSlots.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto mb-3 text-slate-700" />
                <div className="text-slate-400">Нет подключенных клиентов</div>
              </div>
            ) : (
              <div className="space-y-2">
                {activeClientSlots.map((slot, idx) => (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-4 rounded-lg bg-slate-800/30 border border-slate-600/50 hover:border-slate-500/70 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-semibold text-white truncate">
                            {slot.client?.name || `Клиент #${slot.clientId}`}
                          </div>
	                          <div className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-bold ${getSharingConsoleMeta(slot.consoleType).badgeClass}`}>
	                            {getSharingConsoleMeta(slot.consoleType).label}
	                          </div>
                        </div>
                        <div className="text-sm text-slate-400 mb-2">
                          {slot.client?.phone || 'Нет номера'}
                        </div>
                        {slot.emailLogin && (
                          <div className="text-xs text-slate-500 space-y-1">
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {slot.emailLogin}
                            </div>
                            {slot.accountPassword && (
                              <div className="flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                Пароль: ••••••••
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-end flex-col gap-2">
                        <div className="text-xs text-slate-400">
                          до {new Date(slot.endDate).toLocaleDateString('ru')}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => editClientSlot(slot.id)}
                            className="p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/40 text-purple-400 transition"
                            title="Редактировать"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeClientSlot(slot.id)}
                            disabled={removingSlot === slot.id}
                            className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 transition disabled:opacity-50"
                            title="Удалить"
                          >
                            {removingSlot === slot.id ? (
                              <div className="animate-spin w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* RIGHT: Stats + Actions */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* Slots Stats */}
          <div className="glass p-6 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-teal-500/20 to-cyan-500/20">
                <Zap className="w-5 h-5 text-teal-400" />
              </div>
              <h3 className="font-bold text-white">Слоты</h3>
            </div>

            <div className="space-y-4">
              {/* Overall */}
              <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-600/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">Всего</span>
                  <span className="font-bold text-white">{system.usedSlots}/{system.totalSlots}</span>
                </div>
                <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-teal-500"
                    style={{ width: `${(system.usedSlots / system.totalSlots) * 100}%` }}
                  />
                </div>
              </div>

              {getSharingSlotTypes(system.donor.consoleType).map((slotType) => {
                const meta = getSharingConsoleMeta(slotType);
                const Icon = meta.icon;
                const stat = getSlotStat(system.slotStats, slotType);
                return (
                  <div key={slotType} className="rounded-lg border border-slate-600/50 bg-slate-800/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-sm text-slate-400">
                        <Icon className={`h-4 w-4 ${meta.textClass}`} />
                        {meta.label}
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {stat.used}/{stat.max}
                      </span>
                    </div>
                    <div className={`text-xs ${meta.textClass}`}>
                      {stat.available} свободно
                    </div>
                  </div>
                );
              })}

              {/* Utilization */}
              <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-600/50">
                <div className="text-xs text-slate-400 mb-1">Загруженность</div>
                <div className="text-2xl font-bold text-white">
                  {Math.round((system.usedSlots / system.totalSlots) * 100)}%
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass p-6 rounded-2xl border border-slate-700/50">
            <h3 className="font-bold text-white mb-3">Действия</h3>
            
            <div className="space-y-2">
              {anySlotAvailable && (
                <>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link
                      href={`/sharing-systems/${system.id}/assign`}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition font-medium text-sm"
                    >
                      <Users className="w-4 h-4" />
                      Добавить клиента
                    </Link>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link
                      href={`/sharing-systems/${system.id}/assign-donor`}
                      className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:from-teal-700 hover:to-cyan-700 transition font-medium text-sm"
                    >
                      <QrCode className="w-4 h-4" />
                      К донору (QR)
                    </Link>
                  </motion.div>
                </>
              )}

              <button
                onClick={() => copyToClipboard(
                  `${system.donor.email}:${system.donor.password}`,
                  'Данные скопированы'
                )}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-600/50 transition font-medium text-sm"
              >
                <Copy className="w-4 h-4" />
                Скопировать
              </button>

              <button
                onClick={loadSystem}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-600/50 transition font-medium text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Обновить
              </button>

              {activeClientSlots.length === 0 && (
                <button
                  onClick={handleDeleteSystem}
                  disabled={deleting}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/40 border border-rose-500/30 transition font-medium text-sm disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full" />
                      Удаление...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Удалить
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Warnings */}
          {(system.isExpired || system.isExpiringSoon) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass p-4 rounded-2xl border border-slate-700/50"
            >
              {system.isExpired && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-rose-400 text-sm">Подписка истекла!</div>
                    <div className="text-xs text-rose-300">Продлите срочно</div>
                  </div>
                </div>
              )}
              {system.isExpiringSoon && !system.isExpired && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                  <Clock className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-amber-400 text-sm">Скоро истекает</div>
                    <div className="text-xs text-amber-300">Осталось {system.daysLeft} дней</div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
