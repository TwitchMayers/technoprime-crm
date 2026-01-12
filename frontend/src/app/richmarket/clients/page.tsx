'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Users, Phone, MapPin, Edit, Trash, Mail, ShoppingBag, Calendar, ArrowUpDown, Filter, Download, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import ProtectedRoute from '@/components/ProtectedRoute';

type Client = {
  id: number;
  name: string;
  phone: string;
  city?: string;
  address?: string;
  notes?: string;
  orders?: any[];
  totalOrders?: number;
  totalSpent?: number;
  lastOrderDate?: string;
};

export default function RichMarketClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'orders' | 'spent' | 'recent'>('recent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const loadClients = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      params.set('limit', '500');

      const res = await fetchWithAuth(`/api/richmarket/clients?${params}`);
      const data = await res.json();
      const items = data.items || data || [];
      
      // Обогащаем данные клиентов информацией о заказах
      const enrichedClients = await Promise.all(
        (Array.isArray(items) ? items : []).map(async (client: Client) => {
          try {
            const ordersRes = await fetchWithAuth(`/api/richmarket/orders?clientId=${client.id}`);
            const ordersData = await ordersRes.json();
            const orders = ordersData.items || ordersData || [];
            const completedOrders = orders.filter((o: any) => o.status === 'COMPLETED');
            
            return {
              ...client,
              totalOrders: orders.length,
              totalSpent: completedOrders.reduce((sum: number, o: any) => sum + (Number(o.totalPrice) || 0), 0),
              lastOrderDate: orders.length > 0 ? 
                new Date(Math.max(...orders.map((o: any) => new Date(o.date).getTime()))).toISOString() : 
                undefined
            };
          } catch {
            return { ...client, totalOrders: 0, totalSpent: 0 };
          }
        })
      );
      
      setClients(enrichedClients);
    } catch (err) {
      console.error('Failed to load clients:', err);
      toast.error('Ошибка загрузки клиентов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    loadClients(); 
  }, []);

  // Сортировка клиентов
  const sortedClients = [...clients].sort((a, b) => {
    let aValue: any = 0;
    let bValue: any = 0;

    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'orders':
        aValue = a.totalOrders || 0;
        bValue = b.totalOrders || 0;
        break;
      case 'spent':
        aValue = a.totalSpent || 0;
        bValue = b.totalSpent || 0;
        break;
      case 'recent':
        aValue = a.lastOrderDate ? new Date(a.lastOrderDate).getTime() : 0;
        bValue = b.lastOrderDate ? new Date(b.lastOrderDate).getTime() : 0;
        break;
    }

    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const deleteClient = async (id: number) => {
    if (!confirm('Удалить клиента? Все связанные заказы также будут удалены.')) return;

    try {
      const res = await fetchWithAuth(`/api/richmarket/clients/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.message || 'Ошибка удаления');
        return;
      }

      toast.success('Клиент удалён');
      loadClients();
    } catch (err) {
      toast.error('Ошибка при удалении клиента');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'RICHMARKET_CEO', 'RICHMARKET_MANAGER']}>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-orange-400 bg-clip-text text-transparent">
              Клиенты RichMarket
            </h1>
            <p className="text-slate-400 text-sm mt-1">База покупателей премиальной одежды</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setEditingClient(null);
                setModalOpen(true);
              }}
              className="btn-success w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Добавить клиента
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-secondary w-full sm:w-auto"
            >
              <Download className="w-4 h-4 inline mr-2" />
              Экспорт
            </motion.button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{clients.length}</div>
                <div className="text-sm text-slate-400">Всего клиентов</div>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">
                  {clients.filter(c => (c.totalOrders || 0) > 0).length}
                </div>
                <div className="text-sm text-slate-400">Активных клиентов</div>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(clients.reduce((sum, c) => sum + (c.totalSpent || 0), 0))}
                </div>
                <div className="text-sm text-slate-400">Общая выручка</div>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                <Mail className="w-6 h-6 text-white" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                placeholder="Поиск по имени, телефону или городу..."
                className="w-full pl-10 rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-400 focus:border-pink-500/50 transition-colors"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadClients()}
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <select 
                className="rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white focus:border-pink-500/50 transition-colors"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
              >
                <option value="recent">По дате заказа</option>
                <option value="name">По имени</option>
                <option value="orders">По количеству заказов</option>
                <option value="spent">По сумме покупок</option>
              </select>
              
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="btn-secondary min-w-[120px]"
              >
                <ArrowUpDown className="w-4 h-4 inline mr-2" />
                {sortOrder === 'asc' ? 'По возр.' : 'По убыв.'}
              </button>
              
              <button 
                onClick={loadClients}
                className="btn-primary min-w-[100px]"
              >
                <Filter className="w-4 h-4 inline mr-2" />
                Найти
              </button>
            </div>
          </div>
        </motion.div>

        {/* Clients Grid */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-slate-800/30 rounded-2xl p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-slate-700 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-slate-700 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-700 rounded w-1/2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-700 rounded w-full" />
                  <div className="h-3 bg-slate-700 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedClients.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-12 text-center border border-slate-700/50"
          >
            <Users className="w-20 h-20 mx-auto mb-4 text-slate-600" />
            <div className="text-xl font-semibold text-white mb-2">Клиенты не найдены</div>
            <div className="text-slate-400 mb-6">Попробуйте изменить параметры поиска</div>
            <button
              onClick={() => {
                setSearchQuery('');
                setEditingClient(null);
                setModalOpen(true);
              }}
              className="btn-success"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Добавить первого клиента
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {sortedClients.map((client, index) => (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="bg-slate-800/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 hover:border-slate-600/70 transition-all duration-300 group"
                >
                  {/* Client Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white font-bold text-lg">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-white text-lg group-hover:text-pink-400 transition-colors">
                          {client.name}
                        </div>
                        <a 
                          href={`tel:${client.phone}`}
                          className="text-pink-400 hover:text-pink-300 transition-colors text-sm"
                        >
                          {client.phone}
                        </a>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <button className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Client Info */}
                  <div className="space-y-3 mb-4">
                    {(client.city || client.address) && (
                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <MapPin className="w-4 h-4" />
                        <span>{client.city}{client.address && ` • ${client.address}`}</span>
                      </div>
                    )}
                    
                    {client.lastOrderDate && (
                      <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <Calendar className="w-4 h-4" />
                        <span>Последний заказ: {formatDate(client.lastOrderDate)}</span>
                      </div>
                    )}
                  </div>

                  {/* Client Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-700/30 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-white">{client.totalOrders || 0}</div>
                      <div className="text-xs text-slate-400">Заказов</div>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-white">
                        {formatCurrency(client.totalSpent || 0)}
                      </div>
                      <div className="text-xs text-slate-400">Потратил</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <motion.a
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      href={`tel:${client.phone}`}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2.5 px-4 rounded-lg text-sm font-semibold text-center transition-all hover:shadow-lg"
                    >
                      <Phone className="w-4 h-4 inline mr-2" />
                      Позвонить
                    </motion.a>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setEditingClient(client);
                        setModalOpen(true);
                      }}
                      className="p-2.5 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => deleteClient(client.id)}
                      className="p-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 transition-colors"
                    >
                      <Trash className="w-4 h-4 text-rose-400" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Modal */}
        <AnimatePresence>
          {modalOpen && (
            <ClientModal
              client={editingClient}
              onClose={() => {
                setModalOpen(false);
                setEditingClient(null);
              }}
              onSave={() => {
                setModalOpen(false);
                setEditingClient(null);
                loadClients();
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </ProtectedRoute>
  );
}

function ClientModal({ client, onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    name: client?.name || '',
    phone: client?.phone || '',
    city: client?.city || '',
    address: client?.address || '',
    notes: client?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error('Заполните имя и телефон');
      return;
    }

    setSaving(true);
    try {
      const method = client ? 'PATCH' : 'POST';
      const url = client ? `/api/richmarket/clients/${client.id}` : '/api/richmarket/clients';

      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error('Ошибка сохранения');
      }

      toast.success(client ? 'Клиент обновлён' : 'Клиент создан');
      onSave();
    } catch (err) {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <motion.div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      <motion.div 
        className="glass w-full max-w-md p-6 relative rounded-2xl border border-slate-700/50"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {client ? 'Редактировать клиента' : 'Новый клиент'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <Trash className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-300 mb-2 block font-medium">Имя *</label>
            <input
              placeholder="Иван Иванов"
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-400 focus:border-pink-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-medium">Телефон *</label>
            <input
              placeholder="+7 (999) 123-45-67"
              value={formData.phone}
              onChange={e => handleChange('phone', e.target.value)}
              className="w-full rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-400 focus:border-pink-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-medium">Город</label>
            <input
              placeholder="Москва"
              value={formData.city}
              onChange={e => handleChange('city', e.target.value)}
              className="w-full rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-400 focus:border-pink-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-medium">Адрес доставки</label>
            <input
              placeholder="ул. Ленина, д. 1, кв. 10"
              value={formData.address}
              onChange={e => handleChange('address', e.target.value)}
              className="w-full rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-400 focus:border-pink-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-medium">Примечания</label>
            <textarea
              placeholder="Дополнительная информация о клиенте..."
              value={formData.notes}
              onChange={e => handleChange('notes', e.target.value)}
              className="w-full rounded-xl bg-slate-800/60 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-400 focus:border-pink-500/50 transition-colors resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-secondary flex-1"
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-success flex-1"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Сохранение...' : (client ? 'Сохранить' : 'Создать')}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}