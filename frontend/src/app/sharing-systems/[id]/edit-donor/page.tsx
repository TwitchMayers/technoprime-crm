'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Mail, Key, Shield, Globe, Calendar, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

export default function EditDonorPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    region: '🇺🇦 Украина',
    emailLogin: '',
    emailPassword: '',
    accountPassword: '',
    dateOfBirth: '',
    backupCodes: '',
    notes: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [showAccountPassword, setShowAccountPassword] = useState(false);

  useEffect(() => {
    const loadDonor = async () => {
      try {
        const system = await fetchWithAuth(`/api/sharing-systems/${params.id}`);
        
        setFormData({
          email: system.donor.email || '',
          password: system.donor.password || '',
          region: system.donor.region || '🇺🇦 Украина',
          emailLogin: system.donor.emailLogin || '',
          emailPassword: system.donor.emailPassword || '',
          accountPassword: system.donor.accountPassword || '',
          dateOfBirth: system.donor.dateOfBirth ? new Date(system.donor.dateOfBirth).toISOString().split('T')[0] : '',
          backupCodes: system.donor.backupCodes || '',
          notes: system.donor.notes || '',
        });
      } catch (error) {
        console.error('Error loading donor:', error);
        toast.error('Ошибка загрузки данных донора');
        router.push(`/sharing-systems/${params.id}`);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      loadDonor();
    }
  }, [params.id, router]);

  const handleSave = async () => {
    if (!formData.email || !formData.password) {
      toast.error('Заполните email и пароль');
      return;
    }

    setSaving(true);
    try {
      const system = await fetchWithAuth(`/api/sharing-systems/${params.id}`);
      
      await fetchWithAuth(`/api/sharing-systems/donor-account/${system.donor.id}/details`, {
        method: 'PUT',
        body: JSON.stringify(formData),
      });

      toast.success('Данные донора обновлены');
      router.push(`/sharing-systems/${params.id}`);
    } catch (error: any) {
      console.error('Error saving donor:', error);
      toast.error(error.message || 'Ошибка сохранения данных');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="glass p-12 text-center rounded-2xl">
        <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <div className="text-slate-400">Загрузка данных донора...</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4">
        <Link
          href={`/sharing-systems/${params.id}`}
          className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-teal-400 bg-clip-text text-transparent">
            Редактировать данные донора
          </h1>
          <p className="text-slate-400 mt-1">Обновите информацию о донорском аккаунте</p>
        </div>
      </div>

      <div className="glass p-6 rounded-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Левая колонка */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Основные данные</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email донора *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full pl-12 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3"
                      placeholder="donor@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Пароль донора *
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="w-full pl-12 pr-10 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3"
                      placeholder="••••••••"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
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
                      className="w-full pl-12 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 appearance-none"
                    >
                      <option value="🇺🇦 Украина">🇺🇦 Украина</option>
                      <option value="🇷🇺 Россия">🇷🇺 Россия</option>
                      <option value="🇺🇸 США">🇺🇸 США</option>
                      <option value="🇪🇺 Европа">🇪🇺 Европа</option>
                      <option value="🇯🇵 Япония">🇯🇵 Япония</option>
                    </select>
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
                      className="w-full pl-12 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Правая колонка */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Данные аккаунта</h2>
              
              <div className="space-y-4">
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
                      className="w-full pl-12 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3"
                      placeholder="user@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Пароль от почты
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type={showEmailPassword ? "text" : "password"}
                      value={formData.emailPassword}
                      onChange={(e) => setFormData({...formData, emailPassword: e.target.value})}
                      className="w-full pl-12 pr-10 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3"
                      placeholder="••••••••"
                    />
                    <button
                      onClick={() => setShowEmailPassword(!showEmailPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Пароль от аккаунта
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type={showAccountPassword ? "text" : "password"}
                      value={formData.accountPassword}
                      onChange={(e) => setFormData({...formData, accountPassword: e.target.value})}
                      className="w-full pl-12 pr-10 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3"
                      placeholder="••••••••"
                    />
                    <button
                      onClick={() => setShowAccountPassword(!showAccountPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showAccountPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Резервные коды (по одному на строку)
                  </label>
                  <textarea
                    value={formData.backupCodes}
                    onChange={(e) => setFormData({...formData, backupCodes: e.target.value})}
                    className="w-full rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 min-h-[120px] font-mono text-sm"
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
                    className="w-full rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 min-h-[80px]"
                    placeholder="Дополнительная информация..."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <Link
            href={`/sharing-systems/${params.id}`}
            className="btn-secondary flex-1 text-center py-4 rounded-xl text-lg font-semibold"
          >
            Отмена
          </Link>
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-lg font-semibold"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="animate-spin w-6 h-6 border-3 border-white border-t-transparent rounded-full" />
                Сохранение...
              </>
            ) : (
              <>
                <Save className="w-6 h-6" />
                Сохранить изменения
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}