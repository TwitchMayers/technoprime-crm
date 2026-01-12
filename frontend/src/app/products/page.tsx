'use client';

import { useEffect, useState } from 'react';
import { Search, Plus, Archive, Package, Edit, Trash2, Box, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
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
  stock: number;
  price: number;
  costPrice: number;
  isActive: boolean;
  serialNumber?: string;
  adSku?: string;
};

const categoryIcons: Record<string, {icon: any; label: string; color: string}> = {
  CONSOLE: { icon: Package, label: 'Консоль', color: 'text-blue-400' },
  ACCESSORY: { icon: Box, label: 'Аксессуар', color: 'text-purple-400' },
  DISK: { icon: AlertCircle, label: 'Диск', color: 'text-green-400' },
  SERVICE: { icon: DollarSign, label: 'Услуга', color: 'text-amber-400' },
  SUBSCRIPTION_KEY: { icon: TrendingUp, label: 'Ключ подписки', color: 'text-teal-400' },
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
      // ✅ ИСПРАВЛЕНО: правильная логика - НЕ используем isActive/isArchived в параметрах
      // Показываем активные товары когда !showArchived, архивные когда showArchived

      const data = await fetchWithAuth(`/api/products?${params}`);
      
      if (data && data.items && Array.isArray(data.items)) {
        // ✅ ФИЛЬТРУЕМ на фронтенде
        const filtered = data.items.filter((p: any) => {
  if (showArchived) return !p.isActive;
  return p.isActive;
});
        setProducts(filtered);
      } else if (Array.isArray(data)) {
        const filtered = data.filter(p => {
          if (showArchived) return !p.isActive;
          return p.isActive;
        });
        setProducts(filtered);
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
      toast.error(err.message || 'Ошибка архивирования');
    }
  };

  const canManage = hasRole('ADMIN', 'MANAGER', 'TECHNICAL_SPECIALIST');
  const canDelete = hasRole('ADMIN', 'MANAGER');

  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
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
    <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'TECHNICAL_SPECIALIST']}>
      <div className="space-y-6 pb-24">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-slate-700"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20"></div>
          <div className="relative bg-slate-900/60 backdrop-blur-xl p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">
                  Каталог товаров
                </h1>
                <p className="text-slate-400">
                  {products.length} товаров • {totalStock} единиц в наличии
                </p>
              </div>
              {canManage && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setEditingProduct(null);
                    setModalOpen(true);
                  }}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold shadow-lg flex items-center gap-2 whitespace-nowrap transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Добавить товар
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>

        {/* СТАТИСТИКА */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            { label: 'Всего товаров', value: products.length, icon: Package, bgGradient: 'from-blue-600/20 to-blue-600/5' },
            { label: 'В наличии', value: inStock, icon: TrendingUp, bgGradient: 'from-green-600/20 to-green-600/5' },
            { label: 'Единиц', value: totalStock, icon: Box, bgGradient: 'from-purple-600/20 to-purple-600/5' },
            { label: 'Прибыль', value: `${(totalProfit / 1000).toFixed(1)}K ₽`, icon: DollarSign, bgGradient: 'from-amber-600/20 to-amber-600/5' },
          ].map(({ label, value, icon: Icon, bgGradient }, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              className={`bg-gradient-to-br ${bgGradient} border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition-all`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-slate-400 mb-2">{label}</p>
                  <p className="text-3xl font-bold text-white">{value}</p>
                </div>
                <Icon className="w-8 h-8 text-slate-500" />
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ФИЛЬТРЫ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/40 backdrop-blur border border-slate-700 rounded-2xl p-6"
        >
          <div className="space-y-4">
            {/* Поиск */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                placeholder="Поиск по названию, бренду, серийному номеру..."
                className="w-full pl-12 pr-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
              />
            </div>

            {/* Категории */}
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap font-medium text-sm ${
                    selectedCategory === 'all'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700'
                  }`}
                >
                  Все категории
                </button>
                {Object.entries(categoryIcons).map(([key, { icon: Icon, label }]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedCategory(key)}
                    className={`px-3 py-2 rounded-lg transition-all whitespace-nowrap font-medium text-sm flex items-center gap-2 ${
                      selectedCategory === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700'
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
                className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap font-medium text-sm flex items-center gap-2 ml-auto ${
                  showArchived
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700'
                }`}
              >
                <Archive className="w-4 h-4" />
                <span>{showArchived ? 'Архив' : 'Активные'}</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* ТОВАРЫ */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-slate-400">Загрузка товаров...</p>
            </div>
          </div>
        ) : products.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/40 border border-slate-700 rounded-2xl p-12 text-center"
          >
            <Box className="w-20 h-20 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-bold text-slate-300 mb-2">Товары не найдены</h3>
            <p className="text-slate-500 mb-6">
              {showArchived ? 'В архиве нет товаров' : 'Начните с добавления первого товара'}
            </p>
            {canManage && !showArchived && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setEditingProduct(null);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:from-cyan-400 hover:to-blue-500 transition-all"
              >
                <Plus className="w-5 h-5" />
                Добавить товар
              </motion.button>
            )}
          </motion.div>
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
              const profitPercent = product.price > 0 ? Math.round((profit / product.price) * 100) : 0;
              const stockStatus = product.stock > 10 ? 'high' : product.stock > 0 ? 'low' : 'out';
              const Icon = cat.icon;

              return (
                <motion.div
                  key={product.id}
                  variants={itemVariants}
                  whileHover={{ y: -8 }}
                  className="bg-slate-900/40 border border-slate-700 hover:border-slate-600 rounded-xl p-6 transition-all"
                >
                  {/* Заголовок */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-lg bg-slate-800/50">
                      <Icon className={`w-6 h-6 ${cat.color}`} />
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                      stockStatus === 'high' ? 'bg-green-500/20 text-green-300' :
                      stockStatus === 'low' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-red-500/20 text-red-300'
                    }`}>
                      {product.stock} шт
                    </div>
                  </div>

                  {/* Название и категория */}
                  <h3 className="text-lg font-bold text-white mb-1 line-clamp-2">{product.name}</h3>
                  <p className="text-xs text-slate-400 mb-4">{cat.label}</p>

                  {/* Бренд и модель */}
                  {product.brand && (
                    <p className="text-xs text-slate-500 mb-4 pb-4 border-b border-slate-700">
                      {product.brand} {product.model && `/ ${product.model}`}
                    </p>
                  )}

                  {/* Цены и прибыль */}
                  <div className="space-y-3 mb-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Цена:</span>
                      <span className="font-bold text-cyan-400">{product.price.toLocaleString()} ₽</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Себестоимость:</span>
                      <span className="text-sm text-slate-300">{product.costPrice.toLocaleString()} ₽</span>
                    </div>
                    <div className="h-px bg-slate-700"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Маржа:</span>
                      <span className={`font-bold text-lg ${profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        +{profit.toLocaleString()} ₽ ({profitPercent}%)
                      </span>
                    </div>
                  </div>

                  {/* Действия */}
                  <div className="flex gap-2">
                    {canManage && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setEditingProduct(product);
                          setModalOpen(true);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 text-sm font-medium transition border border-slate-700"
                      >
                        <Edit className="w-4 h-4" />
                        Редактировать
                      </motion.button>
                    )}
                    {canDelete && (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleArchive(product.id)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${
                            showArchived
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30'
                              : 'bg-orange-500/20 text-orange-300 border-orange-500/30 hover:bg-orange-500/30'
                          }`}
                          title={showArchived ? 'Восстановить' : 'В архив'}
                        >
                          <Archive className="w-4 h-4" />
                        </motion.button>
                        {!showArchived && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDelete(product.id)}
                            className="px-3 py-2 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-sm font-medium transition hover:bg-red-500/30"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
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
        body: JSON.stringify({
          ...formData,
          isActive: true,
        }),
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
        className="bg-slate-900 border border-slate-700 w-full max-w-2xl p-8 relative max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <h2 className="text-3xl font-bold text-white mb-6">
          {product ? 'Редактировать товар' : 'Добавить новый товар'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="md:col-span-2">
            <label className="text-sm text-slate-300 mb-2 block font-bold">Название *</label>
            <input
              className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="PlayStation 5 Slim"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-bold">Категория</label>
            <select
              className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
            >
              <option value="CONSOLE">Консоль</option>
              <option value="ACCESSORY">Аксессуар</option>
              <option value="DISK">Диск</option>
              <option value="SERVICE">Услуга</option>
              <option value="SUBSCRIPTION_KEY">Ключ подписки</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-bold">Бренд</label>
            <input
              className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition"
              value={formData.brand}
              onChange={(e) => setFormData({...formData, brand: e.target.value})}
              placeholder="Sony"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-bold">Модель</label>
            <input
              className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition"
              value={formData.model}
              onChange={(e) => setFormData({...formData, model: e.target.value})}
              placeholder="PS5 Slim"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-bold">Серийный номер</label>
            <input
              className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition"
              value={formData.serialNumber}
              onChange={(e) => setFormData({...formData, serialNumber: e.target.value})}
              placeholder="ABC123XYZ"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-bold">Остаток (шт)</label>
            <input
              type="number"
              className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition"
              value={formData.stock}
              onChange={(e) => setFormData({...formData, stock: Math.max(0, Number(e.target.value))})}
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-bold">Цена продажи (₽)</label>
            <input
              type="number"
              className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition"
              value={formData.price}
              onChange={(e) => setFormData({...formData, price: Math.max(0, Number(e.target.value))})}
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 mb-2 block font-bold">Себестоимость (₽)</label>
            <input
              type="number"
              className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition"
              value={formData.costPrice}
              onChange={(e) => setFormData({...formData, costPrice: Math.max(0, Number(e.target.value))})}
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-slate-700">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700/50 transition font-bold"
          >
            Отмена
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold disabled:opacity-50 transition-all"
          >
            {saving ? 'Сохранение...' : (product ? 'Сохранить' : 'Создать')}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}