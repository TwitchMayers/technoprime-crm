'use client';

import { useEffect, useState } from 'react';
import { Search, Plus, Archive, Package, Edit, Trash2, Box, Filter, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

type Product = {
  id: number;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  storefrontCategory?: string | null;
  stock: number;
  price: number;
  costPrice: number;
  isActive: boolean;
  serialNumber?: string;
  adSku?: string;
};

const categoryIcons: Record<string, {icon: any; label: string; color: string}> = {
  CONSOLE: { icon: Package, label: 'Консоль', color: 'from-blue-500 to-cyan-500' },
  ACCESSORY: { icon: Box, label: 'Аксессуар', color: 'from-purple-500 to-pink-500' },
  DISK: { icon: AlertCircle, label: 'Диск', color: 'from-green-500 to-emerald-500' },
  SERVICE: { icon: Filter, label: 'Услуга', color: 'from-amber-500 to-orange-500' },
  SUBSCRIPTION_KEY: { icon: DollarSign, label: 'Ключ подписки', color: 'from-teal-500 to-cyan-500' },
};

export default function ProductsPage() {
  const { user, hasRole } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      params.set('isArchived', String(!showArchived));

      const data = await fetchWithAuth(`/api/products?${params}`);
      
      if (data && data.items && Array.isArray(data.items)) {
        setProducts(data.items);
      } else if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      console.error('Failed to load products:', err);
      toast.error(err.message || 'Ошибка загрузки товаров');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      load();
    }
  }, [showArchived, selectedCategory, user]);

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить товар?')) return;
    
    try {
      await fetchWithAuth(`/api/products/${id}`, { method: 'DELETE' });
      toast.success('Товар удалён');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Ошибка удаления');
    }
  };

  const handleArchive = async (id: number) => {
    try {
      const endpoint = showArchived ? 'unarchive' : 'archive';
      await fetchWithAuth(`/api/products/${id}/${endpoint}`, { method: 'PATCH' });
      toast.success(showArchived ? 'Товар восстановлен' : 'Товар архивирован');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Ошибка');
    }
  };

  const canManage = hasRole('ADMIN', 'TECHNICAL_SPECIALIST', 'SUPER_ADMIN');
  const canDelete = hasRole('ADMIN', 'SUPER_ADMIN');

  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const totalValue = products.reduce((sum, p) => sum + (p.stock * p.price), 0);
  const inStock = products.filter(p => p.stock > 0).length;
  const totalProfit = products.reduce((sum, p) => sum + ((p.price - p.costPrice) * p.stock), 0);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'TECHNICAL_SPECIALIST', 'SUPER_ADMIN']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-teal-400 bg-clip-text text-transparent">
              Товары
            </h1>
            <p className="text-slate-400 mt-1">
              Управление товарами и услугами
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => {
                setEditingProduct(null);
                setModalOpen(true);
              }}
              className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold hover:from-teal-700 hover:to-cyan-700 transition shadow-lg flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Новый товар
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            { label: 'Всего товаров', value: products.length, icon: Package, color: 'from-blue-500 to-cyan-500' },
            { label: 'В наличии', value: inStock, icon: TrendingUp, color: 'from-green-500 to-emerald-500' },
            { label: 'Остаток шт', value: totalStock, icon: Box, color: 'from-purple-500 to-pink-500' },
            { label: 'Потенц. прибыль', value: `${(totalProfit / 1000).toFixed(1)}K ₽`, icon: DollarSign, color: 'from-amber-500 to-orange-500' },
          ].map(({ label, value, icon: Icon, color }, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              className={`glass p-4 rounded-xl border border-slate-700/50 bg-gradient-to-br ${color}/10`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-400 mb-1">{label}</div>
                  <div className="text-3xl font-bold text-white">{value}</div>
                </div>
                <div className={`p-3 rounded-lg bg-gradient-to-br ${color} opacity-20`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass p-4 rounded-xl border border-slate-700/50"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                placeholder="Поиск товаров..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap font-medium text-sm ${
                  selectedCategory === 'all'
                    ? 'bg-gradient-to-r from-purple-600 to-teal-600 text-white shadow-lg'
                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-600/50'
                }`}
              >
                Все
              </button>
              {Object.entries(categoryIcons).map(([key, { icon: Icon, label }]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`px-3 py-2 rounded-lg transition-all whitespace-nowrap font-medium text-sm flex items-center gap-1 ${
                    selectedCategory === key
                      ? `bg-gradient-to-r ${categoryIcons[key].color} text-white shadow-lg`
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-600/50'
                  }`}
                  title={label}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap font-medium text-sm flex items-center gap-2 ${
                showArchived
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg'
                  : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-600/50'
              }`}
            >
              <Archive className="w-4 h-4" />
              <span className="hidden sm:inline">{showArchived ? 'Архив' : 'Активные'}</span>
            </button>
          </div>
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="glass p-12 text-center rounded-2xl">
            <div className="animate-spin w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <div className="text-slate-400">Загрузка товаров...</div>
          </div>
        ) : products.length === 0 ? (
          <div className="glass p-12 text-center rounded-2xl border border-slate-700/50">
            <Box className="w-16 h-16 mx-auto mb-3 text-slate-600" />
            <div className="text-slate-400 font-medium">Товары не найдены</div>
            <div className="text-sm text-slate-500 mt-1">
              {showArchived ? 'Архив пуст' : 'Добавьте первый товар'}
            </div>
            {canManage && !showArchived && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setEditingProduct(null);
                  setModalOpen(true);
                }}
                className="mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold"
              >
                <Plus className="w-4 h-4" />
                Добавить товар
              </motion.button>
            )}
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {products.map((product) => {
              const cat = categoryIcons[product.category] || categoryIcons.CONSOLE;
              const profit = product.price - product.costPrice;
              const stockStatus = product.stock > 10 ? 'high' : product.stock > 0 ? 'low' : 'out';
              const isShowcaseCard = Boolean(product.storefrontCategory);
              const Icon = cat.icon;

              return (
                <motion.div
                  key={product.id}
                  variants={itemVariants}
                  whileHover={{ y: -5 }}
                  className="glass p-6 rounded-xl border border-slate-700/50 hover:border-slate-600/80 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg bg-gradient-to-br ${cat.color} opacity-20`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                      stockStatus === 'high' ? 'bg-green-500/20 text-green-400' :
                      stockStatus === 'low' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-rose-500/20 text-rose-400'
                    }`}>
                      {product.stock} шт
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1">{product.name}</h3>
                  <p className="text-sm text-slate-400 mb-4">{cat.label}</p>

                  {product.brand && <p className="text-xs text-slate-500 mb-3">{product.brand} {product.model}</p>}
                  {isShowcaseCard ? (
                    <p className="text-xs text-slate-400 mb-3">
                      Карточка витрины не удаляется и не архивируется складскими действиями
                    </p>
                  ) : null}

                  <div className="space-y-2 mb-4 p-3 rounded-lg bg-slate-800/30 border border-slate-600/50">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Цена:</span>
                      <span className="font-bold text-teal-400">{product.price.toLocaleString()} ₽</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Себест.:</span>
                      <span className="text-slate-300">{product.costPrice.toLocaleString()} ₽</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-slate-600/50">
                      <span className="text-slate-400">Прибыль:</span>
                      <span className={profit > 0 ? 'text-green-400' : 'text-rose-400'}>{profit > 0 ? '+' : ''}{profit.toLocaleString()} ₽</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {canManage && (
                      <button
                        onClick={() => {
                          setEditingProduct(product);
                          setModalOpen(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 text-sm font-medium transition"
                      >
                        <Edit className="w-4 h-4" />
                        Редактировать
                      </button>
                    )}
                    {canDelete && (
                      <>
                        <button
                          onClick={() => handleArchive(product.id)}
                          disabled={isShowcaseCard}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                            showArchived
                              ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          } ${isShowcaseCard ? 'opacity-40 cursor-not-allowed' : ''}`}
                          title={isShowcaseCard ? 'Карточки витрины не архивируются' : ''}
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        {!showArchived && (
                          <button
                            onClick={() => handleDelete(product.id)}
                            disabled={isShowcaseCard}
                            className={`px-3 py-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 text-sm font-medium transition hover:bg-rose-500/40 ${isShowcaseCard ? 'opacity-40 cursor-not-allowed' : ''}`}
                            title={isShowcaseCard ? 'Карточки витрины не удаляются' : ''}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Modal */}
        {modalOpen && (
          <ProductModal
            product={editingProduct}
            onClose={() => {
              setModalOpen(false);
              setEditingProduct(null);
            }}
            onSave={async () => {
              setModalOpen(false);
              setEditingProduct(null);
              await load();
            }}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}

function ProductModal({ 
  product, 
  onClose, 
  onSave 
}: {
  product: Product | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    category: product?.category || 'CONSOLE',
    brand: product?.brand || '',
    model: product?.model || '',
    stock: product?.stock || 0,
    price: product?.price || 0,
    costPrice: product?.costPrice || 0,
    serialNumber: product?.serialNumber || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Заполните название');
      return;
    }

    setSaving(true);
    try {
      const url = product ? `/api/products/${product.id}` : `/api/products`;
      const method = product ? 'PATCH' : 'POST';

      await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      toast.success(product ? 'Товар обновлён' : 'Товар создан');
      onSave();
    } catch (err: any) {
      toast.error(err.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <motion.div
        className="glass w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/50"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <h2 className="text-2xl font-bold text-white mb-6">
          {product ? 'Редактировать товар' : 'Добавить товар'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="md:col-span-2">
            <label className="text-sm text-slate-300 mb-2 block font-medium">Название *</label>
            <input
              className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="PlayStation 5"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-medium">Категория</label>
            <select
              className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
            >
              {Object.entries(categoryIcons).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-medium">Бренд</label>
            <input
              className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              value={formData.brand}
              onChange={(e) => setFormData({...formData, brand: e.target.value})}
              placeholder="Sony"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-medium">Модель</label>
            <input
              className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              value={formData.model}
              onChange={(e) => setFormData({...formData, model: e.target.value})}
              placeholder="PS5 Slim"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-medium">Серийный номер</label>
            <input
              className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              value={formData.serialNumber}
              onChange={(e) => setFormData({...formData, serialNumber: e.target.value})}
              placeholder="ABC123XYZ"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-medium">Остаток (шт)</label>
            <input
              type="number"
              className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              value={formData.stock}
              onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})}
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-medium">Цена продажи (₽)</label>
            <input
              type="number"
              className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              value={formData.price}
              onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-medium">Себестоимость (₽)</label>
            <input
              type="number"
              className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              value={formData.costPrice}
              onChange={(e) => setFormData({...formData, costPrice: Number(e.target.value)})}
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-slate-300 hover:bg-slate-700/50 transition font-medium"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:from-teal-700 hover:to-cyan-700 transition font-medium disabled:opacity-50"
          >
            {saving ? '...' : (product ? 'Сохранить' : 'Создать')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
