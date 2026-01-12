'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Mail, Key, Shield, Calendar, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

export default function EditClientSlotPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    emailLogin: '',
    emailPassword: '',
    accountPassword: '',
    startDate: '',
    endDate: '',
    notes: '',
  });
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [clientInfo, setClientInfo] = useState<{
    clientName: string;
    consoleType: string;
    systemName: string;
  } | null>(null);

  useEffect(() => {
    const loadClientSlot = async () => {
      try {
        // Сначала получим информацию о системе и клиенте
        const system = await fetchWithAuth(`/api/sharing-systems?withAvailableSlots=false`);
        
        // Найдем слот
        let targetSlot = null;
        let targetSystem = null;
        
        for (const sys of system) {
          const slot = sys.clientSlots.find((s: any) => s.id === Number(params.slotId));
          if (slot) {
            targetSlot = slot;
            targetSystem = sys;
            break;
          }
        }

        if (!targetSlot || !targetSystem) {
          throw new Error('Слот не найден');
        }

        setClientInfo({
          clientName: targetSlot.client?.name || `Клиент #${targetSlot.clientId}`,
          consoleType: targetSlot.consoleType,
          systemName: targetSystem.name,
        });

        setFormData({
          emailLogin: targetSlot.emailLogin || '',
          emailPassword: targetSlot.emailPassword || '',
          accountPassword: targetSlot.accountPassword || '',
          startDate: targetSlot.startDate ? new Date(targetSlot.startDate).toISOString().split('T')[0] : '',
          endDate: targetSlot.endDate ? new Date(targetSlot.endDate).toISOString().split('T')[0] : '',
          notes: targetSlot.notes || '',
        });
      } catch (error) {
        console.error('Error loading client slot:', error);
        toast.error('Ошибка загрузки данных клиента');
        router.push('/sharing-systems');
      } finally {
        setLoading(false);
      }
    };

    if (params.slotId) {
      loadClientSlot();
    }
  }, [params.slotId, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchWithAuth(`/api/sharing-systems/client-slot/${params.slotId}/edit`, {
        method: 'PUT',
        body: JSON.stringify(formData),
      });

      toast.success('Данные клиента обновлены');
      router.back();
    } catch (error: any) {
      console.error('Error saving client slot:', error);
      toast.error(error.message || 'Ошибка сохранения данных');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="glass p-12 text-center rounded-2xl">
        <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <div className="text-slate-400">Загрузка данных клиента...</div>
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
          href="#"
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition hover:scale-105"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-teal-400 bg-clip-text text-transparent">
            Редактировать данные клиента
          </h1>
          {clientInfo && (
            <p className="text-slate-400 mt-1">
              {clientInfo.clientName} • {clientInfo.consoleType} • {clientInfo.systemName}
            </p>
          )}
        </div>
      </div>

      <div className="glass p-6 rounded-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Левая колонка */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Учетные данные</h2>
              
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
              </div>
            </div>
          </div>

          {/* Правая колонка */}
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Срок действия</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Дата начала
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                      className="w-full pl-12 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Дата окончания
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      className="w-full pl-12 rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Примечания
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full rounded-xl bg-slate-800/50 border border-slate-600/50 px-4 py-3 min-h-[120px]"
                    placeholder="Дополнительная информация о клиенте..."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <button
            onClick={() => router.back()}
            className="btn-secondary flex-1 text-center py-4 rounded-xl text-lg font-semibold"
          >
            Отмена
          </button>
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