'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Users, Globe, Calendar, Key, Mail, Lock, Shield, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import {
  getDefaultSharingConsoleType,
  getSharingConsoleMeta,
  getSharingConsoleTypesForSubscription,
  isSharingConsoleCompatibleWithSubscription,
  type SharingConsoleType,
  type SharingSubscriptionType,
} from '@/lib/sharing';

export default function NewSharingSystemPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    // Основная информация
    name: '',
    donorConsoleType: 'PS5' as SharingConsoleType,
    
    // Данные донора
    donorEmail: '',
    donorPassword: '',
    region: '🇺🇦 Украина',
    subscriptionType: 'PS_PLUS' as SharingSubscriptionType,
    subscriptionPeriod: 'YEAR' as 'MONTH' | 'THREE_MONTHS' | 'YEAR',
    
    // Данные аккаунта
    emailLogin: '',
    emailPassword: '',
    accountPassword: '',
    dateOfBirth: '',
    
    // Сроки
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    
    // Резервные коды и заметки
    backupCodes: '',
    notes: '',
  });

  const chooseDonorConsoleType = (donorConsoleType: SharingConsoleType) => {
    setFormData({
      ...formData,
      donorConsoleType,
      subscriptionType: donorConsoleType.startsWith('XBOX') ? 'GAME_PASS' : formData.subscriptionType,
    });
  };

  const chooseSubscriptionType = (subscriptionType: SharingSubscriptionType) => {
    setFormData((prev) => ({
      ...prev,
      subscriptionType,
      donorConsoleType: isSharingConsoleCompatibleWithSubscription(subscriptionType, prev.donorConsoleType)
        ? prev.donorConsoleType
        : getDefaultSharingConsoleType(subscriptionType),
    }));
  };

  const donorConsoleOptions = getSharingConsoleTypesForSubscription(formData.subscriptionType);

  const createSystem = async () => {
    if (!formData.name || !formData.donorEmail || !formData.donorPassword) {
      toast.error('Заполните название системы, email и пароль донора');
      return;
    }

    setLoading(true);
    try {
      await fetchWithAuth('/api/sharing-systems', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      toast.success('Система шеринга создана!');
      router.push('/sharing-systems');
    } catch (error: any) {
      console.error('❌ Error creating sharing system:', error);
      toast.error(error.message || 'Ошибка создания системы');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4">
        <Link
          href="/sharing-systems"
          className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-teal-400 bg-clip-text text-transparent">
            Новая система шеринга
          </h1>
          <p className="text-slate-400 mt-1">Создание системы общего доступа для PlayStation и Xbox</p>
        </div>
      </div>

      <div className="glass p-6 rounded-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Левая колонка */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Основная информация
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Название системы *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    placeholder="Система шеринга #1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Тип консоли донора *
                  </label>
	                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
	                    {donorConsoleOptions.map((type) => {
	                      const meta = getSharingConsoleMeta(type);
	                      const Icon = meta.icon;
	                      const selected = formData.donorConsoleType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => chooseDonorConsoleType(type)}
                          className={`rounded-xl border-2 p-5 transition-all ${
                            selected ? meta.activeClass : 'border-slate-600 bg-slate-800/30'
                          }`}
                        >
	                          <Icon className={`mx-auto mb-3 h-8 w-8 ${meta.textClass}`} />
	                          <div className="text-center font-semibold text-white">
	                            {meta.fullLabel}
	                          </div>
	                          <div className="mt-1 text-center text-xs text-slate-400">
	                            {meta.description}
	                          </div>
	                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Регион
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <select
                      value={formData.region}
                      onChange={(e) => setFormData({...formData, region: e.target.value})}
                      className="w-full pl-12 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 appearance-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    >
                      <option value="🇺🇦 Украина">🇺🇦 Украина</option>
                      <option value="🇷🇺 Россия">🇷🇺 Россия</option>
                      <option value="🇺🇸 США">🇺🇸 США</option>
                      <option value="🇪🇺 Европа">🇪🇺 Европа</option>
                      <option value="🇯🇵 Япония">🇯🇵 Япония</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-md font-semibold text-white mb-3">Тип подписки</h3>
              <div className="grid grid-cols-3 gap-3">
	                <button
	                  type="button"
	                  onClick={() => chooseSubscriptionType('PS_PLUS')}
                  className={`p-4 rounded-xl border-2 ${
                    formData.subscriptionType === 'PS_PLUS'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-600 bg-slate-800/30'
                  }`}
                >
                  <div className="text-sm font-medium text-center text-white">PS Plus</div>
                </button>
	                <button
	                  type="button"
	                  onClick={() => chooseSubscriptionType('GAME_PASS')}
                  className={`p-4 rounded-xl border-2 ${
                    formData.subscriptionType === 'GAME_PASS'
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-slate-600 bg-slate-800/30'
                  }`}
                >
                  <div className="text-sm font-medium text-center text-white">Game Pass</div>
                </button>
	                <button
	                  type="button"
	                  onClick={() => chooseSubscriptionType('EA_PLAY')}
                  className={`p-4 rounded-xl border-2 ${
                    formData.subscriptionType === 'EA_PLAY'
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-slate-600 bg-slate-800/30'
                  }`}
                >
                  <div className="text-sm font-medium text-center text-white">EA Play</div>
                </button>
              </div>
            </div>
          </div>

          {/* Правая колонка */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Данные донорского аккаунта</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email донора *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={formData.donorEmail}
                      onChange={(e) => setFormData({...formData, donorEmail: e.target.value})}
                      className="w-full pl-12 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                      placeholder="donor@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
	                      Пароль от аккаунта
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={formData.donorPassword}
                        onChange={(e) => setFormData({...formData, donorPassword: e.target.value})}
                        className="w-full pl-12 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Дата рождения
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                        className="w-full pl-12 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Логин от почты
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={formData.emailLogin}
                        onChange={(e) => setFormData({...formData, emailLogin: e.target.value})}
                        className="w-full pl-12 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                        placeholder="user@email.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Пароль от почты
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={formData.emailPassword}
                        onChange={(e) => setFormData({...formData, emailPassword: e.target.value})}
                        className="w-full pl-12 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Пароль от аккаунта
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={formData.accountPassword}
                      onChange={(e) => setFormData({...formData, accountPassword: e.target.value})}
                      className="w-full pl-12 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Дата начала
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      className="w-full rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Дата окончания
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      className="w-full rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Период подписки
                  </label>
                  <select
                    value={formData.subscriptionPeriod}
                    onChange={(e) => setFormData({...formData, subscriptionPeriod: e.target.value as any})}
                    className="w-full rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="MONTH">1 месяц</option>
                    <option value="THREE_MONTHS">3 месяца</option>
                    <option value="YEAR">1 год</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Резервные коды (по одному на строку)
                  </label>
                  <textarea
                    value={formData.backupCodes}
                    onChange={(e) => setFormData({...formData, backupCodes: e.target.value})}
                    className="w-full rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 min-h-[120px] font-mono text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    placeholder="3sEHkw&#10;UAJBVC&#10;ZhQgWt"
                    rows={5}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Примечания
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 min-h-[80px] focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    placeholder="Дополнительная информация о системе..."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <Link
            href="/sharing-systems"
            className="btn-secondary flex-1 text-center py-4 rounded-xl text-lg font-semibold hover:scale-[1.02] transition-transform"
          >
            Отмена
          </Link>
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-lg font-semibold hover:scale-[1.02] transition-transform"
            onClick={createSystem}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="animate-spin w-6 h-6 border-3 border-white border-t-transparent rounded-full" />
                Создание...
              </>
            ) : (
              <>
                <Save className="w-6 h-6" />
                Создать систему
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
