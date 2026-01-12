'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Users, MapPin, Phone, Package, Truck, Plus, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

type ClientType = 'regular' | 'avito_delivery';

export default function CreateClientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [clientType, setClientType] = useState<ClientType>('regular');

  // Regular client fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [consoleType, setConsoleType] = useState('');

  // Avito delivery fields
  const [avitoName, setAvitoName] = useState('');
  const [avitoCity, setAvitoCity] = useState('');
  const [avitoAddress, setAvitoAddress] = useState('');
  const [avitoConsole, setAvitoConsole] = useState('');
  const [avitoComment, setAvitoComment] = useState('');

  const handleSubmitRegular = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Введите имя клиента');
      return;
    }

    if (!phone.trim()) {
      toast.error('Введите номер телефона');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast.error('Введите корректный номер телефона');
      return;
    }

    setSaving(true);

    try {
      const clientData = {
        name: name.trim(),
        phone: `+${cleanPhone}`,
        ...(city.trim() && { city: city.trim() }),
        ...(address.trim() && { address: address.trim() }),
        ...(consoleType && { consoleType }),
        source: 'REGULAR',
      };

      const response = await fetchWithAuth('/api/clients', {
        method: 'POST',
        body: JSON.stringify(clientData),
      });

      toast.success('Клиент создан успешно');
      router.push(`/clients/${response.id || response.client?.id}`);
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast.error(`Ошибка создания: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitAvito = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!avitoName.trim()) {
      toast.error('Введите имя клиента');
      return;
    }

    if (!avitoCity.trim()) {
      toast.error('Введите город доставки');
      return;
    }

    setSaving(true);

    try {
      const clientData = {
        name: avitoName.trim(),
        phone: '+7000000000', // Placeholder
        city: avitoCity.trim(),
        address: avitoAddress.trim() || 'Авито доставка',
        ...(avitoConsole && { consoleType: avitoConsole }),
        source: 'AVITO_DELIVERY',
        notes: avitoComment.trim() || undefined,
      };

      const response = await fetchWithAuth('/api/clients', {
        method: 'POST',
        body: JSON.stringify(clientData),
      });

      toast.success('Клиент из Авито создан');
      router.push(`/clients/${response.id || response.client?.id}`);
    } catch (error: any) {
      console.error('Error creating avito client:', error);
      toast.error(`Ошибка создания: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Link
          href="/clients"
          className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-teal-400 bg-clip-text text-transparent">
            Создать клиента
          </h1>
          <p className="text-slate-400 mt-1">
            Выберите тип клиента и заполните информацию
          </p>
        </div>
      </motion.div>

      {/* CLIENT TYPE SELECTOR */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setClientType('regular')}
          className={`p-6 rounded-2xl border-2 transition-all ${
            clientType === 'regular'
              ? 'bg-gradient-to-br from-cyan-900/40 to-cyan-900/10 border-cyan-500/50 shadow-lg shadow-cyan-500/20'
              : 'bg-slate-900/40 border-slate-700/50 hover:border-slate-600/50'
          }`}
        >
          <Users className={`w-8 h-8 mb-3 ${clientType === 'regular' ? 'text-cyan-400' : 'text-slate-500'}`} />
          <div className="text-lg font-bold text-white mb-1">Обычный клиент</div>
          <p className="text-sm text-slate-400">
            Заполните все данные клиента и телефон
          </p>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setClientType('avito_delivery')}
          className={`p-6 rounded-2xl border-2 transition-all ${
            clientType === 'avito_delivery'
              ? 'bg-gradient-to-br from-orange-900/40 to-orange-900/10 border-orange-500/50 shadow-lg shadow-orange-500/20'
              : 'bg-slate-900/40 border-slate-700/50 hover:border-slate-600/50'
          }`}
        >
          <Truck className={`w-8 h-8 mb-3 ${clientType === 'avito_delivery' ? 'text-orange-400' : 'text-slate-500'}`} />
          <div className="text-lg font-bold text-white mb-1">Авито доставка</div>
          <p className="text-sm text-slate-400">
            Заказ через Авито, телефон не требуется
          </p>
        </motion.button>
      </motion.div>

      {/* FORMS */}
      {clientType === 'regular' ? (
        /* REGULAR CLIENT FORM */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-slate-900/60 to-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-8"
        >
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Users className="w-6 h-6 text-cyan-400" />
            Информация о клиенте
          </h2>

          <form onSubmit={handleSubmitRegular} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Имя клиента *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition"
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
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s\-()]/g, ''))}
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition"
                  placeholder="+7 (999) 123-45-67"
                  required
                  disabled={saving}
                />
              </div>
            </div>

            {/* Location & Console */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Город
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition"
                    placeholder="Москва"
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
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition"
                  disabled={saving}
                >
                  <option value="">Не указана</option>
                  <option value="PlayStation 5">PlayStation 5</option>
                  <option value="PlayStation 4">PlayStation 4</option>
                  <option value="Xbox Series X">Xbox Series X</option>
                  <option value="Xbox Series S">Xbox Series S</option>
                  <option value="Xbox One">Xbox One</option>
                  <option value="Nintendo Switch">Nintendo Switch</option>
                  <option value="PC">ПК</option>
                </select>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Адрес
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition min-h-[100px]"
                placeholder="ул. Ленина, д. 1, кв. 1"
                disabled={saving}
              />
            </div>

            {/* Submit */}
            <div className="flex gap-4 pt-4 border-t border-slate-700/50">
              <Link
                href="/clients"
                className="flex-1 px-6 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 text-slate-300 font-bold transition text-center"
              >
                Отмена
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Создание...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Создать клиента
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      ) : (
        /* AVITO DELIVERY FORM */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-slate-900/60 to-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-8"
        >
          <div className="mb-6 p-4 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-300">
              Для доставки через Авито номер телефона не требуется. Заполните только необходимые данные о заказе.
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Truck className="w-6 h-6 text-orange-400" />
            Заказ с Авито
          </h2>

          <form onSubmit={handleSubmitAvito} className="space-y-6">
            {/* Order Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Имя получателя *
                </label>
                <input
                  type="text"
                  value={avitoName}
                  onChange={(e) => setAvitoName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition"
                  placeholder="Иван Иванов"
                  required
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Город доставки *
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={avitoCity}
                    onChange={(e) => setAvitoCity(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition"
                    placeholder="Москва"
                    required
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            {/* Address & Console */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Адрес доставки
                </label>
                <textarea
                  value={avitoAddress}
                  onChange={(e) => setAvitoAddress(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition min-h-[100px]"
                  placeholder="Укажите адрес для доставки"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Консоль / Товар
                </label>
                <select
                  value={avitoConsole}
                  onChange={(e) => setAvitoConsole(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition"
                  disabled={saving}
                >
                  <option value="">Не указан</option>
                  <option value="PlayStation 5">PlayStation 5</option>
                  <option value="PlayStation 4">PlayStation 4</option>
                  <option value="Xbox Series X">Xbox Series X</option>
                  <option value="Xbox Series S">Xbox Series S</option>
                  <option value="Xbox One">Xbox One</option>
                  <option value="Nintendo Switch">Nintendo Switch</option>
                  <option value="PC">ПК</option>
                  <option value="Подписка PS Plus">Подписка PS Plus</option>
                  <option value="Подписка Game Pass">Подписка Game Pass</option>
                  <option value="Подписка EA Play">Подписка EA Play</option>
                </select>
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Комментарий / Примечание
              </label>
              <textarea
                value={avitoComment}
                onChange={(e) => setAvitoComment(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition min-h-[100px]"
                placeholder="Дополнительная информация, пожелания по доставке и т.д."
                disabled={saving}
              />
            </div>

            {/* Info Box */}
            <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/50 space-y-2">
              <div className="flex items-start gap-2 text-sm text-slate-400">
                <Package className="w-4 h-4 flex-shrink-0 mt-0.5 text-orange-400" />
                <span>Заказ будет создан с временным номером телефона</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-slate-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-orange-400" />
                <span>Вы сможете обновить данные клиента позже в карточке заказа</span>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-4 pt-4 border-t border-slate-700/50">
              <Link
                href="/clients"
                className="flex-1 px-6 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 text-slate-300 font-bold transition text-center"
              >
                Отмена
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Создание...
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    Создать заказ с Авито
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </div>
  );
}