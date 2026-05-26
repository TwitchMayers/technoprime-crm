'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Search, Users, Calendar, Mail, Key, 
  Shield, QrCode, Check
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { getSharingConsoleMeta, type SharingConsoleType } from '@/lib/sharing';

type Client = {
  id: number;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
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
};

export default function AssignDonorPage() {
  const params = useParams();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [system, setSystem] = useState<SharingSystem | null>(null);
  const [formData, setFormData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    clientEmailLogin: '',
    clientEmailPassword: '',
    clientAccountPassword: '',
    notes: 'Вход через QR для донорской консоли',
  });

  const toInputDate = (value?: string | null) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split('T')[0];
  };

  const loadSystem = async () => {
    try {
      const data = await fetchWithAuth(`/api/sharing-systems/${params.id}`);
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
        `/api/sharing-systems/search-clients?q=${encodeURIComponent(search.trim())}&sharingSystemId=${params.id}`
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
        toast.info('Нет доступных клиентов для добавления к донору.');
      }
    } catch (error: any) {
      console.error('Error searching clients:', error);
      toast.error(`Ошибка поиска: ${error.message}`);
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

    if (!system) {
      toast.error('Система не загружена');
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      toast.error('Укажите даты начала и окончания');
      return;
    }

    setAssigning(true);
    try {
      const data = {
        sharingSystemId: Number(params.id),
        clientId: selectedClient.id,
        consoleType: system.donor.consoleType, // Тип консоли такой же как у донора
        startDate: formData.startDate,
        endDate: formData.endDate,
        clientEmailLogin: formData.clientEmailLogin,
        clientEmailPassword: formData.clientEmailPassword,
        clientAccountPassword: formData.clientAccountPassword,
        notes: formData.notes,
      };

      await fetchWithAuth('/api/sharing-systems/assign-donor-client', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      toast.success('Клиент успешно добавлен для доступа к донорской консоли');
      router.push(`/sharing-systems/${params.id}`);
    } catch (error: any) {
      console.error('Error assigning donor client:', error);
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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href={`/sharing-systems/${params.id}`}
            className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition hover:scale-105"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">
              Добавить доступ к донорской консоли
            </h1>
            <p className="text-slate-400 mt-1">
              {system?.name || 'Загрузка...'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Левая колонка - Поиск клиента */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Поиск */}
          <div className="glass p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Search className="w-5 h-5" />
              Поиск клиента
            </h2>
            
            <div className="relative mb-6">
              <input
                type="text"
                placeholder="Введите имя или телефон клиента..."
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <button
                onClick={searchClients}
                disabled={searching || !search.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/40 text-teal-400 hover:text-teal-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {searching ? 'Поиск...' : 'Найти'}
              </button>
            </div>

            {/* Результаты поиска */}
            {clients.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm text-slate-400">
                  Найдено клиентов: {clients.length}
                </div>
                <div className="max-h-[400px] overflow-y-auto pr-2">
                  {clients.map(client => (
                    <div
                      key={client.id}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedClient?.id === client.id
                          ? 'bg-teal-500/10 border-teal-500/50'
                          : 'bg-slate-800/30 border-slate-600/50 hover:bg-slate-700/50'
                      }`}
                      onClick={() => setSelectedClient(client)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-white">{client.name}</div>
                          <div className="text-sm text-teal-400 mt-1">{client.phone}</div>
                          {client.email && (
                            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {client.email}
                            </div>
                          )}
                        </div>
                        {selectedClient?.id === client.id && (
                          <Check className="w-5 h-5 text-teal-400" />
                        )}
                      </div>
                      {client.notes && (
                        <div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-700/50">
                          {client.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!searching && clients.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <div>Начните поиск клиентов</div>
              </div>
            )}
          </div>

          {/* Информация о доноре */}
          <div className="glass p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Информация о доноре
            </h2>
            
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-600/50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm text-slate-400">Тип консоли</div>
                  <div className="font-semibold text-white flex items-center gap-2 mt-1">
	                    {(() => {
	                      const meta = getSharingConsoleMeta(system?.donor.consoleType);
	                      const Icon = meta.icon;
	                      return (
	                        <>
	                          <Icon className={`h-5 w-5 ${meta.textClass}`} />
	                          {system?.donor.consoleType?.startsWith('XBOX') ? 'Xbox' : meta.fullLabel}
	                        </>
	                      );
	                    })()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">Подписка</div>
                  <div className="font-semibold text-white mt-1">
                    {system?.donor.subscriptionType || 'Загрузка...'}
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-slate-400 mb-2">Важная информация:</div>
              <ul className="text-sm text-slate-300 space-y-2 pl-4">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5"></div>
                  Клиент получит доступ к той же консоли, что и донор
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5"></div>
                  Для входа будет использоваться QR-код доступа
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5"></div>
                  Клиент не может быть добавлен в другие системы шеринга
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Правая колонка - Форма добавления */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {/* Данные для входа */}
          <div className="glass p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Key className="w-5 h-5" />
              Данные для входа (опционально)
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Логин от почты</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition"
                  placeholder="email@example.com"
                  value={formData.clientEmailLogin}
                  onChange={(e) => setFormData({...formData, clientEmailLogin: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Пароль от почты</label>
                <input
                  type="password"
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition"
                  placeholder="••••••••"
                  value={formData.clientEmailPassword}
                  onChange={(e) => setFormData({...formData, clientEmailPassword: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2 flex items-center gap-2">
                  <Shield className="w-3 h-3" />
                  Пароль от аккаунта
                </label>
                <input
                  type="password"
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition"
                  placeholder="••••••••"
                  value={formData.clientAccountPassword}
                  onChange={(e) => setFormData({...formData, clientAccountPassword: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* Даты и заметки */}
          <div className="glass p-6 rounded-2xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Срок действия и заметки
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Дата начала</label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Дата окончания</label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Заметки</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition min-h-[100px]"
                  placeholder="Дополнительная информация..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* Кнопка добавления */}
          <div className="glass p-6 rounded-2xl">
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30">
                <div className="flex items-center gap-3">
                  <QrCode className="w-5 h-5 text-teal-400" />
                  <div>
                    <div className="font-semibold text-white">Готово к добавлению</div>
                    <div className="text-sm text-teal-300">
                      {selectedClient 
                        ? `Выбран клиент: ${selectedClient.name}`
                        : 'Выберите клиента из списка'}
                    </div>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleAssign}
                disabled={!selectedClient || assigning}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-teal-600 to-blue-600 text-white font-semibold hover:from-teal-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {assigning ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    Добавление...
                  </>
                ) : (
                  <>
                    <QrCode className="w-5 h-5" />
                    Добавить доступ к донорской консоли
                  </>
                )}
              </button>
              
              <Link
                href={`/sharing-systems/${params.id}`}
                className="w-full py-3 rounded-xl bg-slate-800/50 border border-slate-600/50 text-slate-300 font-medium hover:bg-slate-700/50 transition text-center block"
              >
                Отмена
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
