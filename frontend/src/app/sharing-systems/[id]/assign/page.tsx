'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Search, Users, Calendar, Mail, Key, 
  Shield, Check, UserPlus, Zap, Lock
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import {
  getFirstAvailableSlotType,
  getSharingConsoleMeta,
  getSharingSlotTypes,
  getSlotStat,
  type SharingConsoleType,
} from '@/lib/sharing';

type Client = {
  id: number;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  clientSlots?: Array<{
    id: number;
    sharingSystemId: number;
	    consoleType: SharingConsoleType;
    isActive: boolean;
  }>;
};

type SharingSystem = {
  id: number;
  name: string;
  donor: {
	    consoleType: SharingConsoleType;
    subscriptionType: string;
    startDate: string;
    endDate: string;
  };
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

export default function AssignClientPage() {
  const params = useParams();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [system, setSystem] = useState<SharingSystem | null>(null);
  const [consoleType, setConsoleType] = useState<SharingConsoleType>('PS5');
  const [formData, setFormData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    clientEmailLogin: '',
    clientEmailPassword: '',
    clientAccountPassword: '',
    notes: '',
  });

  const toInputDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split('T')[0];
  };

  const loadSystem = async () => {
    try {
      const data = await fetchWithAuth(`sharing-systems/${params.id}`);
      setSystem(data);
      const donorStart = toInputDate(data?.donor?.startDate);
      const donorEnd = toInputDate(data?.donor?.endDate);
      if (donorStart || donorEnd) {
        setFormData((prev) => ({
          ...prev,
          startDate: donorStart || prev.startDate,
          endDate: donorEnd || prev.endDate,
        }));
      }

      setConsoleType(getFirstAvailableSlotType(data?.donor?.consoleType, data?.slotStats));
    } catch (error) {
      console.error('Error loading system:', error);
      toast.error('Ошибка загрузки системы шеринга');
      router.push(`/sharing-systems/${params.id}`);
    }
  };

  useEffect(() => {
    loadSystem();
  }, [params.id]);

  const searchClients = useCallback(async () => {
    if (!search.trim()) {
      toast.info('Введите имя или телефон для поиска');
      return;
    }

    setSearching(true);
    try {
      const response = await fetchWithAuth(
        `sharing-systems/search-clients?q=${encodeURIComponent(search.trim())}&sharingSystemId=${params.id}`
      );
      
      let items = [];
      if (Array.isArray(response)) {
        items = response;
      } else if (response?.items) {
        items = response.items;
      } else if (response?.data) {
        items = response.data;
      }
      setClients(items);
      
      if (items.length === 0) {
        toast.info('Нет доступных клиентов. Все клиенты либо уже подключены к системам шеринга, либо не совпадают с поиском.');
      }
    } catch (error: any) {
      console.error('Error searching clients:', error);
      toast.error(`Ошибка поиска: ${error.message || 'Неизвестная ошибка'}`);
      setClients([]);
    } finally {
      setSearching(false);
    }
  }, [search, params.id]);

  const handleAssign = async () => {
    if (!selectedClient) {
      toast.error('Выберите клиента');
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      toast.error('Укажите даты начала и окончания');
      return;
    }
    if (consoleType === 'XBOX_2' && (!formData.clientEmailLogin.trim() || !formData.clientEmailPassword.trim())) {
      toast.error('Для Xbox #2 укажите логин и пароль личного аккаунта клиента');
      return;
    }

    setAssigning(true);
    try {
      const xboxDonorSlot = consoleType === 'XBOX_1';
      const data = {
        sharingSystemId: Number(params.id),
        clientId: selectedClient.id,
        consoleType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        clientEmailLogin: xboxDonorSlot ? '' : formData.clientEmailLogin,
        clientEmailPassword: xboxDonorSlot ? '' : formData.clientEmailPassword,
        clientAccountPassword: xboxDonorSlot ? '' : formData.clientAccountPassword,
        notes: formData.notes,
      };

      await fetchWithAuth('sharing-systems/assign-client', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      toast.success('Клиент успешно добавлен в систему шеринга');
      router.push(`/sharing-systems/${params.id}`);
    } catch (error: any) {
      console.error('Error assigning client:', error);
      toast.error(error.message || 'Ошибка добавления клиента');
    } finally {
      setAssigning(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchClients();
    }
  };

  const slotTypes = getSharingSlotTypes(system?.donor.consoleType);
  const selectedAvailable = getSlotStat(system?.slotStats, consoleType).available;
  const isXboxDonorSlot = consoleType === 'XBOX_1';
  const isXboxPersonalSlot = consoleType === 'XBOX_2';
  const accountSectionTitle = isXboxPersonalSlot ? 'Личный аккаунт клиента' : 'Учетные данные';
  const accountSectionHint = isXboxPersonalSlot ? 'обязательно для Xbox #2' : 'опционально';

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Link
          href={`/sharing-systems/${params.id}`}
          className="p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition-all hover:scale-110"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-teal-400 bg-clip-text text-transparent">
            Добавить клиента
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {system?.name ? `Система: ${system.name}` : 'Загрузка...'}
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ЛЕВАЯ КОЛОНКА - Поиск клиента */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="xl:col-span-1 space-y-6"
        >
          {/* Поиск */}
          <div className="glass p-6 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-teal-500/20">
                <Search className="w-5 h-5 text-teal-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Поиск клиента</h2>
            </div>
            
            <div className="relative mb-6">
              <input
                type="text"
                placeholder="Имя или телефон..."
                className="w-full pl-4 pr-12 py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button
                onClick={searchClients}
                disabled={searching || !search.trim()}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-teal-600 text-white text-sm font-medium hover:from-purple-700 hover:to-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {searching ? '...' : 'Ok'}
              </button>
            </div>

            {/* Результаты поиска */}
            {clients.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-slate-400 font-medium px-1">
                  Найдено: <span className="text-teal-400 font-bold">{clients.length}</span>
                </div>
                <div className="max-h-[480px] overflow-y-auto pr-2 space-y-2">
                  {clients.map((client, idx) => (
                    <motion.button
                      key={client.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => setSelectedClient(client)}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all group ${
                        selectedClient?.id === client.id
                          ? 'bg-gradient-to-r from-teal-500/20 to-teal-500/10 border-teal-500/70 ring-2 ring-teal-500/30'
                          : 'bg-slate-800/30 border-slate-600/50 hover:border-slate-500/70 hover:bg-slate-700/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white truncate text-sm">{client.name}</div>
                          <div className="text-xs text-teal-400 truncate mt-1">{client.phone}</div>
                          {client.email && (
                            <div className="text-xs text-slate-400 truncate mt-1 flex items-center gap-1">
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              {client.email}
                            </div>
                          )}
                        </div>
                        {selectedClient?.id === client.id && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="p-1.5 rounded-lg bg-teal-500/20"
                          >
                            <Check className="w-4 h-4 text-teal-400" />
                          </motion.div>
                        )}
                      </div>
                      {client.notes && (
                        <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-700/30 line-clamp-2">
                          {client.notes}
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {searching && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="animate-spin w-8 h-8 border-3 border-purple-500/30 border-t-purple-500 rounded-full mb-2"></div>
                <div className="text-sm text-slate-400">Поиск...</div>
              </div>
            )}

            {!searching && clients.length === 0 && (
              <div className="text-center py-10">
                <div className="p-3 rounded-lg bg-slate-800/30 mb-3 w-fit mx-auto">
                  <Users className="w-8 h-8 text-slate-600" />
                </div>
                <div className="text-sm text-slate-400">
                  {search.trim() ? 'Клиенты не найдены' : 'Начните поиск'}
                </div>
              </div>
            )}
          </div>

          {/* Статус выбора */}
          {selectedClient && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-gradient-to-r from-teal-500/20 to-teal-500/10 border border-teal-500/30"
            >
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-teal-500/20">
                  <Check className="w-4 h-4 text-teal-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-400">Выбран клиент</div>
                  <div className="font-semibold text-white truncate text-sm">{selectedClient.name}</div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* СРЕДНЯЯ + ПРАВАЯ КОЛОНКА */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="xl:col-span-2 space-y-6"
        >
          {/* Выбор консоли + Информация о системе - ОБЪЕДИНЕНО */}
          <div className="glass p-6 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500/20 to-purple-500/20">
                <Zap className="w-5 h-5 text-teal-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Выбор консоли и статус</h2>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {slotTypes.map((slotType) => {
                const meta = getSharingConsoleMeta(slotType);
                const Icon = meta.icon;
                const stat = getSlotStat(system?.slotStats, slotType);
                const disabled = stat.available === 0;
                const progress = stat.max > 0 ? (stat.used / stat.max) * 100 : 0;
                return (
                  <motion.button
                    key={slotType}
                    whileHover={{ scale: disabled ? 1 : 1.02 }}
                    onClick={() => setConsoleType(slotType)}
                    disabled={disabled}
                    className={`relative rounded-xl border-2 p-6 transition-all ${
                      consoleType === slotType
                        ? `bg-gradient-to-br from-slate-800/20 to-slate-950/20 ${meta.activeClass} ring-2 ring-white/10`
                        : 'border-slate-600/50 bg-slate-800/30 hover:border-slate-500/70'
                    } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="rounded-lg bg-slate-900/50 p-2.5">
                        <Icon className={`h-5 w-5 ${meta.textClass}`} />
                      </div>
                      {consoleType === slotType ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="rounded-full border border-white/15 bg-white/10 p-1.5"
                        >
                          <Check className={`h-4 w-4 ${meta.textClass}`} />
                        </motion.div>
                      ) : null}
                    </div>
                    <div className="text-left">
                      <div className="mb-1 text-lg font-bold text-white">{meta.fullLabel}</div>
                      <div className="mb-3 text-sm text-slate-400">{meta.description}</div>
                      <div className="mb-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Слоты:</span>
                          <span className="font-semibold text-white">{stat.used}/{stat.max}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50">
                          <div
                            className={`h-full bg-gradient-to-r ${meta.barClass}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <div className={`rounded-lg px-3 py-1.5 text-center text-xs font-medium ${
                        stat.available > 0 ? meta.badgeClass : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {stat.available > 0 ? `${stat.available} свободно` : 'Все заняты'}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Информация донора */}
            <div className="border-t border-slate-700/50 pt-6">
              <div className="text-xs text-slate-400 font-medium mb-3">ИНФОРМАЦИЯ О ДОНОРЕ</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                  <div className="text-xs text-slate-400 mb-1">Тип консоли</div>
	                  <div className="flex items-center gap-2 font-semibold text-white">
	                    {(() => {
	                      const meta = getSharingConsoleMeta(system?.donor.consoleType);
	                      const Icon = meta.icon;
	                      return (
	                        <>
	                          <Icon className={`h-4 w-4 ${meta.textClass}`} />
	                          {system?.donor.consoleType?.startsWith('XBOX') ? 'Xbox' : meta.label}
	                        </>
	                      );
	                    })()}
	                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                  <div className="text-xs text-slate-400 mb-1">Подписка</div>
                  <div className="font-semibold text-white text-sm truncate">{system?.donor.subscriptionType}</div>
                </div>
              </div>
            </div>
          </div>

          {isXboxDonorSlot ? (
            <div className="glass p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-emerald-500/20 p-2">
                  <Key className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Данные подтянутся автоматически</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    Для Xbox #1 клиент играет с донорского аккаунта. Логин и пароль донора будут показаны ему в личном кабинете, отдельный второй аккаунт вводить не нужно.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass p-6 rounded-2xl border border-slate-700/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                  <Key className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-lg font-bold text-white">{accountSectionTitle}</h2>
                <span className="text-xs text-slate-400 ml-auto">{accountSectionHint}</span>
              </div>

              {isXboxPersonalSlot ? (
                <p className="mb-4 rounded-lg border border-lime-500/25 bg-lime-500/10 px-3 py-2 text-sm leading-6 text-lime-100">
                  Для Xbox #2 донорский аккаунт будет показан отдельно для входа. Здесь укажите личный аккаунт клиента, с которого он будет запускать игры.
                </p>
              ) : null}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-2">
                    {isXboxPersonalSlot ? 'Логин личного аккаунта клиента' : 'Логин от почты'}
                  </label>
                  <input
                    type="email"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition text-sm"
                    placeholder="user@example.com"
                    value={formData.clientEmailLogin}
                    onChange={(e) => setFormData({...formData, clientEmailLogin: e.target.value})}
                    required={isXboxPersonalSlot}
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-2">
                    {isXboxPersonalSlot ? 'Пароль личного аккаунта клиента' : 'Пароль от почты'}
                  </label>
                  <input
                    type="password"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition text-sm"
                    placeholder="••••••••"
                    value={formData.clientEmailPassword}
                    onChange={(e) => setFormData({...formData, clientEmailPassword: e.target.value})}
                    required={isXboxPersonalSlot}
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-2 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    {isXboxPersonalSlot ? 'Пароль профиля личного аккаунта' : 'Пароль от аккаунта'}
                  </label>
                  <input
                    type="password"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition text-sm"
                    placeholder="••••••••"
                    value={formData.clientAccountPassword}
                    onChange={(e) => setFormData({...formData, clientAccountPassword: e.target.value})}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Даты и заметки */}
          <div className="glass p-6 rounded-2xl border border-slate-700/50">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                <Calendar className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Срок действия</h2>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-2">От</label>
                  <input
                    type="date"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition text-sm"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-2">До</label>
                  <input
                    type="date"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition text-sm"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-slate-400 font-medium mb-2">Заметки</label>
                <textarea
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition text-sm min-h-[75px] resize-none"
                  placeholder="Дополнительная информация..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* Кнопка добавления */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAssign}
	            disabled={!selectedClient || assigning || selectedAvailable === 0}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-teal-600 text-white font-semibold hover:from-purple-700 hover:via-pink-700 hover:to-teal-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 text-base shadow-lg shadow-purple-500/20"
          >
            {assigning ? (
              <>
                <div className="animate-spin w-5 h-5 border-2.5 border-white/30 border-t-white rounded-full" />
                Добавление...
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                Добавить клиента в систему
              </>
            )}
          </motion.button>

          {/* Кнопка отмены */}
          <Link
            href={`/sharing-systems/${params.id}`}
            className="w-full py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 font-medium hover:bg-slate-700/50 transition text-center block text-sm"
          >
            Отмена
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
