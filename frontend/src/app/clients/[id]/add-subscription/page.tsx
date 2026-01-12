'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Calendar, Play, StopCircle, Shield, AlertTriangle, Clock } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

type Client = {
  id: number;
  name: string;
  phone: string;
  consoleType?: string;
};

type SharingSystem = {
  id: number;
  name: string;
  donor: {
    email: string;
    consoleType: 'PS4' | 'PS5';
    endDate: string;
  };
  availableSlots: number;
  usedSlots: number;
  totalSlots: number;
  daysLeft: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
  clientSlots: Array<{
    consoleType: 'PS4' | 'PS5';
    isActive: boolean;
  }>;
};

export default function AddClientSubscriptionPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [sharingSystems, setSharingSystems] = useState<SharingSystem[]>([]);
  
  // Form state
  const [subscriptionType, setSubscriptionType] = useState<'PS_PLUS' | 'GAME_PASS' | 'EA_PLAY'>('PS_PLUS');
  const [accountType, setAccountType] = useState<'PERSONAL' | 'SHARING_CLIENT'>('PERSONAL');
  const [subscriptionPeriod, setSubscriptionPeriod] = useState<'MONTH' | 'THREE_MONTHS' | 'YEAR'>('MONTH');
  
  // Personal account data
  const [emailLogin, setEmailLogin] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  
  // Sharing system data
  const [selectedSystem, setSelectedSystem] = useState<number | null>(null);
  const [selectedConsoleType, setSelectedConsoleType] = useState<'PS4' | 'PS5'>('PS5');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load client
        const clientData = await fetchWithAuth(`clients/${params.id}`);
        setClient(clientData);
        
        // Load sharing systems
        const systemsData = await fetchWithAuth('sharing-systems?isActive=true&withAvailableSlots=true');
        setSharingSystems(Array.isArray(systemsData) ? systemsData : []);
        
        // Set default console type from client
        if (clientData?.consoleType) {
          if (clientData.consoleType.includes('PS5')) {
            setSelectedConsoleType('PS5');
          } else if (clientData.consoleType.includes('PS4')) {
            setSelectedConsoleType('PS4');
          }
        }
      } catch (error: any) {
        console.error('Error loading data:', error);
        toast.error(`Ошибка загрузки: ${error.message || 'Неизвестная ошибка'}`);
        router.push('/clients');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      loadData();
    }
  }, [params.id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (accountType === 'SHARING_CLIENT' && !selectedSystem) {
      toast.error('Выберите систему шеринга');
      return;
    }

    if (accountType === 'PERSONAL' && (!emailLogin || !emailPassword)) {
      toast.error('Заполните данные аккаунта');
      return;
    }

    setSaving(true);
    try {
      const now = new Date();
      const endDate = new Date(now);
      
      switch (subscriptionPeriod) {
        case 'MONTH':
          endDate.setMonth(endDate.getMonth() + 1);
          break;
        case 'THREE_MONTHS':
          endDate.setMonth(endDate.getMonth() + 3);
          break;
        case 'YEAR':
          endDate.setFullYear(endDate.getFullYear() + 1);
          break;
      }

      if (accountType === 'PERSONAL') {
        // Create personal subscription
        const body = {
          clientId: client?.id,
          type: subscriptionType,
          startDate: now.toISOString(),
          endDate: endDate.toISOString(),
          status: 'ACTIVE',
          accountType: 'PERSONAL',
          subscriptionPeriod,
          psEmail: emailLogin,
          psPassword: emailPassword,
          accountPassword: accountPassword || undefined,
        };

        await fetchWithAuth('subscriptions', {
          method: 'POST',
          body: JSON.stringify(body),
        });

        toast.success('Персональная подписка создана');
      } else {
        // Assign to sharing system
        const selectedSystemData = sharingSystems.find(s => s.id === selectedSystem);
        if (!selectedSystemData) {
          throw new Error('Система шеринга не найдена');
        }

        // Check if console type slot is available
        const activeSlots = selectedSystemData.clientSlots?.filter(slot => slot.isActive) || [];
        const slotCount = activeSlots.filter(slot => slot.consoleType === selectedConsoleType).length;
        
        if (slotCount >= 1) {
          toast.error(`Слот ${selectedConsoleType} в выбранной системе уже занят`);
          setSaving(false);
          return;
        }

        const body = {
          clientId: client?.id,
          sharingSystemId: selectedSystem,
          consoleType: selectedConsoleType,
          startDate: now.toISOString(),
          endDate: selectedSystemData.donor.endDate,
          notes: `Подписка добавлена через интерфейс клиента`,
        };

        await fetchWithAuth('sharing-systems/assign-client', {
          method: 'POST',
          body: JSON.stringify(body),
        });

        toast.success('Клиент привязан к системе шеринга');
      }

      router.push(`/clients/${params.id}`);
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      toast.error(`Ошибка создания: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setSaving(false);
    }
  };

  const getAvailableSystems = () => {
    return sharingSystems.filter(system => {
      if (system.isExpired || system.daysLeft <= 0) return false;
      
      const activeSlots = system.clientSlots?.filter(slot => slot.isActive) || [];
      const ps5Count = activeSlots.filter(slot => slot.consoleType === 'PS5').length;
      const ps4Count = activeSlots.filter(slot => slot.consoleType === 'PS4').length;
      
      // Check if selected console type is available
      if (selectedConsoleType === 'PS5') {
        return ps5Count < 1;
      } else {
        return ps4Count < 1;
      }
    });
  };

  if (loading) {
    return (
      <div className="glass p-12 text-center">
        <div className="animate-spin w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <div className="text-slate-400">Загрузка...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="glass p-12 text-center">
        <AlertTriangle className="w-20 h-20 mx-auto mb-4 text-rose-400" />
        <div className="text-slate-400 font-medium">Клиент не найден</div>
        <Link href="/clients" className="btn-secondary mt-4 inline-block">
          Вернуться к списку
        </Link>
      </div>
    );
  }

  const availableSystems = getAvailableSystems();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/clients/${client.id}`}
          className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-teal-400 bg-clip-text text-transparent">
            Добавить подписку
          </h1>
          <p className="text-slate-400 mt-1">
            Клиент: {client.name} • {client.phone}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Client Info */}
        <div className="space-y-6">
          <div className="glass p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Информация о клиенте
            </h2>
            
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-600/50">
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-slate-400">Имя</div>
                  <div className="font-medium text-white">{client.name}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">Телефон</div>
                  <div className="font-medium text-white">{client.phone}</div>
                </div>
                {client.consoleType && (
                  <div>
                    <div className="text-sm text-slate-400">Консоль</div>
                    <div className="font-medium text-white flex items-center gap-2">
                      {client.consoleType.includes('PS5') ? (
                        <Play className="w-4 h-4 text-teal-400" />
                      ) : client.consoleType.includes('PS4') ? (
                        <StopCircle className="w-4 h-4 text-blue-400" />
                      ) : null}
                      {client.consoleType}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Subscription Form */}
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="glass p-6">
            <h2 className="text-lg font-bold text-white mb-6">Настройки подписки</h2>

            <div className="space-y-6">
              {/* Subscription Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Тип подписки</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'PS_PLUS', label: '🎮 PS Plus', color: 'text-blue-400' },
                    { value: 'GAME_PASS', label: '🎯 Game Pass', color: 'text-green-400' },
                    { value: 'EA_PLAY', label: '⚽ EA Play', color: 'text-orange-400' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setSubscriptionType(type.value as any)}
                      className={`p-3 rounded-lg border-2 transition ${
                        subscriptionType === type.value
                          ? 'border-teal-500 bg-teal-500/10'
                          : 'border-slate-600 bg-slate-800/30'
                      }`}
                    >
                      <div className={`text-sm font-medium ${type.color}`}>
                        {type.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Account Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">Тип аккаунта</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setAccountType('PERSONAL')}
                    className={`p-4 rounded-lg border-2 transition ${
                      accountType === 'PERSONAL'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-600 bg-slate-800/30'
                    }`}
                  >
                    <Users className="w-6 h-6 mb-2 mx-auto text-blue-400" />
                    <div className="font-medium text-center text-white">Персональный</div>
                    <div className="text-xs text-slate-400 text-center mt-1">
                      Отдельный аккаунт
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType('SHARING_CLIENT')}
                    className={`p-4 rounded-lg border-2 transition ${
                      accountType === 'SHARING_CLIENT'
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-slate-600 bg-slate-800/30'
                    }`}
                  >
                    <Shield className="w-6 h-6 mb-2 mx-auto text-purple-400" />
                    <div className="font-medium text-center text-white">Система шеринга</div>
                    <div className="text-xs text-slate-400 text-center mt-1">
                      Общий аккаунт
                    </div>
                  </button>
                </div>
              </div>

              {/* Personal Account Fields */}
              {accountType === 'PERSONAL' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Период подписки</label>
                    <select
                      value={subscriptionPeriod}
                      onChange={(e) => setSubscriptionPeriod(e.target.value as any)}
                      className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5"
                    >
                      <option value="MONTH">1 месяц</option>
                      <option value="THREE_MONTHS">3 месяца</option>
                      <option value="YEAR">1 год</option>
                    </select>
                  </div>

                  <div className="border-t border-slate-700/50 pt-4">
                    <div className="text-sm font-semibold mb-3 text-slate-200">Данные аккаунта *</div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-slate-400 mb-1.5 block">Логин от почты</label>
                        <input
                          type="text"
                          value={emailLogin}
                          onChange={(e) => setEmailLogin(e.target.value)}
                          className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5"
                          placeholder="user@email.com"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-1.5 block">Пароль от почты</label>
                        <input
                          type="text"
                          value={emailPassword}
                          onChange={(e) => setEmailPassword(e.target.value)}
                          className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5"
                          placeholder="••••••••"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-1.5 block">Пароль от аккаунта</label>
                        <input
                          type="text"
                          value={accountPassword}
                          onChange={(e) => setAccountPassword(e.target.value)}
                          className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5"
                          placeholder="•••••••• (опционально)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sharing System Fields */}
              {accountType === 'SHARING_CLIENT' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Тип консоли для подключения</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setSelectedConsoleType('PS5')}
                        className={`p-4 rounded-lg border-2 transition ${
                          selectedConsoleType === 'PS5'
                            ? 'border-teal-500 bg-teal-500/10'
                            : 'border-slate-600 bg-slate-800/30'
                        }`}
                      >
                        <Play className="w-6 h-6 mb-2 mx-auto" />
                        <div className="font-medium text-center">PlayStation 5</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedConsoleType('PS4')}
                        className={`p-4 rounded-lg border-2 transition ${
                          selectedConsoleType === 'PS4'
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-600 bg-slate-800/30'
                        }`}
                      >
                        <StopCircle className="w-6 h-6 mb-2 mx-auto" />
                        <div className="font-medium text-center">PlayStation 4</div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Выберите систему шеринга</label>
                    {availableSystems.length === 0 ? (
                      <div className="text-center py-6 rounded-lg bg-slate-800/50 border border-slate-600/50">
                        <Shield className="w-12 h-12 mx-auto mb-2 text-slate-600" />
                        <div className="text-sm text-slate-400">Нет доступных систем шеринга</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {selectedConsoleType === 'PS5' 
                            ? 'Все PS5 слоты заняты или нет активных систем'
                            : 'Все PS4 слоты заняты или нет активных систем'}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {availableSystems.map((system) => {
                          const activeSlots = system.clientSlots?.filter(slot => slot.isActive) || [];
                          const slotCount = activeSlots.filter(slot => slot.consoleType === selectedConsoleType).length;
                          const available = slotCount < 1;
                          
                          return (
                            <div
                              key={system.id}
                              onClick={() => available && setSelectedSystem(system.id)}
                              className={`p-4 rounded-lg cursor-pointer transition ${
                                selectedSystem === system.id
                                  ? 'bg-purple-500/20 border border-purple-500/50'
                                  : 'bg-slate-800/30 hover:bg-slate-700/50'
                              } ${!available && 'opacity-50 cursor-not-allowed'}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="font-medium text-white">{system.name}</div>
                                <div className="flex items-center gap-2">
                                  {system.donor.consoleType === 'PS5' ? (
                                    <Play className="w-4 h-4 text-teal-400" />
                                  ) : (
                                    <StopCircle className="w-4 h-4 text-blue-400" />
                                  )}
                                  <span className="text-sm text-slate-400">{system.donor.consoleType}</span>
                                </div>
                              </div>
                              <div className="text-sm text-slate-400 mb-2">Донор: {system.donor.email}</div>
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  <span className={system.daysLeft <= 30 ? 'text-amber-400' : 'text-teal-400'}>
                                    {system.daysLeft} дней
                                  </span>
                                </div>
                                <div>
                                  <span className={available ? 'text-teal-400' : 'text-rose-400'}>
                                    {available ? 'Слот свободен' : 'Слот занят'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selectedSystem && (
                    <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                      <div className="text-sm text-purple-300">
                        Клиент будет подключен к выбранной системе шеринга как {selectedConsoleType} клиент.
                        Срок действия подписки соответствует сроку донорского аккаунта.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-700/50">
                <button
                  type="submit"
                  className="w-full btn-primary flex items-center justify-center gap-2"
                  disabled={saving || (accountType === 'SHARING_CLIENT' && !selectedSystem)}
                >
                  {saving ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Создание...
                    </>
                  ) : (
                    'Создать подписку'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}