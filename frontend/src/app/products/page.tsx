'use client';

import { useEffect, useState } from 'react';
import { Search, Plus, Archive, Package, Edit, Trash2, Box, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageHeader from '@/components/MobilePageHeader';

type Product = {
  id: number;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  stock: number;
  price: number;
  costPrice?: number;
  isActive: boolean;
  isAlwaysAvailable?: boolean;
  storefrontCategory?: string | null;
  coverImage?: string | null;
  gallery?: string[] | string | null;
  serialNumber?: string;
  adSku?: string;
};

function normalizeGallery(value: Product['gallery'], coverImage?: string | null) {
  if (Array.isArray(value)) {
    const list = value.filter(
      (item): item is string => typeof item === 'string' && Boolean(item.trim()),
    );
    if (coverImage && !list.includes(coverImage)) {
      return [coverImage, ...list];
    }
    return list;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return normalizeGallery(parsed, coverImage);
      return coverImage ? [coverImage] : [];
    } catch {
      return value.trim() ? [value.trim()] : coverImage ? [coverImage] : [];
    }
  }
  return coverImage ? [coverImage] : [];
}

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
      params.set('scope', 'warehouse');

      const data = await fetchWithAuth(`/api/products?${params}`);
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const filtered = list
        .filter((row: any) => !row?.storefrontCategory)
        .filter((row: any) => (showArchived ? !row?.isActive : Boolean(row?.isActive)));
      setProducts(filtered);
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

  const canManage = hasRole('ADMIN', 'MANAGER', 'TECHNICAL_SPECIALIST', 'SUPER_ADMIN');
  const canDelete = hasRole('ADMIN', 'MANAGER', 'SUPER_ADMIN');
  const canSeeFinancials = user?.role !== 'MANAGER';

  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const inStock = products.filter(p => p.stock > 0).length;
  const totalProfit = canSeeFinancials
    ? products.reduce((sum, p) => sum + ((p.price - Number(p.costPrice || 0)) * p.stock), 0)
    : 0;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'TECHNICAL_SPECIALIST', 'SUPER_ADMIN']}>
      <div className="mobile-page-shell md:space-y-6 md:pb-24">
        <MobilePageHeader title="Склад" subtitle={`${products.length} позиций · ${totalStock} единиц`} sticky={false} />

        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-slate-700"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20"></div>
          <div className="relative bg-slate-900/60 p-3 backdrop-blur-xl sm:p-5 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
              <div className="hidden md:block">
                <h1 className="mb-2 text-4xl font-bold text-white">Склад</h1>
                <p className="text-slate-400">
                  {products.length} складских позиций • {totalStock} единиц в наличии
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
                  className="flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:from-cyan-400 hover:to-blue-500 md:w-auto md:rounded-xl md:px-8"
                >
                  <Plus className="w-5 h-5" />
                  Добавить позицию
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
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 md:gap-4 lg:grid-cols-4"
        >
          {[
            { label: 'Всего товаров', value: products.length, icon: Package, bgGradient: 'from-blue-600/20 to-blue-600/5' },
            { label: 'В наличии', value: inStock, icon: TrendingUp, bgGradient: 'from-green-600/20 to-green-600/5' },
            { label: 'Единиц', value: totalStock, icon: Box, bgGradient: 'from-purple-600/20 to-purple-600/5' },
            canSeeFinancials
              ? { label: 'Прибыль', value: `${(totalProfit / 1000).toFixed(1)}K ₽`, icon: DollarSign, bgGradient: 'from-amber-600/20 to-amber-600/5' }
              : { label: 'Категорий', value: Object.keys(categoryIcons).length, icon: DollarSign, bgGradient: 'from-amber-600/20 to-amber-600/5' },
          ].map(({ label, value, icon: Icon, bgGradient }, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              className={`rounded-xl border border-slate-700 bg-gradient-to-br ${bgGradient} p-3 transition-all hover:border-slate-600 sm:p-5 md:p-6`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="mb-1.5 text-xs text-slate-400 sm:mb-2 sm:text-sm">{label}</p>
                  <p className="text-2xl font-bold text-white sm:text-3xl">{value}</p>
                </div>
                <Icon className="h-6 w-6 text-slate-500 sm:h-8 sm:w-8" />
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ФИЛЬТРЫ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-slate-700 bg-slate-900/40 p-3 backdrop-blur sm:p-5 md:p-6"
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
            <div className="flex flex-col gap-3 lg:flex-row lg:gap-4">
              <div className="mobile-scroll-row lg:mx-0 lg:flex lg:overflow-visible lg:px-0 lg:pb-0">
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
                className={`ml-0 flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all lg:ml-auto ${
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
            <h3 className="text-xl font-bold text-slate-300 mb-2">Складские позиции не найдены</h3>
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
              const profit = product.price - Number(product.costPrice || 0);
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

                  {product.isAlwaysAvailable ? (
                    <p className="text-[11px] text-emerald-300 mb-3">Всегда в наличии</p>
                  ) : null}

                  {/* Цены и прибыль */}
                  <div className="space-y-3 mb-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Цена:</span>
                      <span className="font-bold text-cyan-400">{product.price.toLocaleString()} ₽</span>
                    </div>
                    {canSeeFinancials ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-400">Себестоимость:</span>
                          <span className="text-sm text-slate-300">{Number(product.costPrice || 0).toLocaleString()} ₽</span>
                        </div>
                        <div className="h-px bg-slate-700"></div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-400">Маржа:</span>
                          <span className={`font-bold text-lg ${profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            +{profit.toLocaleString()} ₽ ({profitPercent}%)
                          </span>
                        </div>
                      </>
                    ) : null}
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
            canSeeFinancials={canSeeFinancials}
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
  canSeeFinancials,
  onClose, 
  onSave 
}: {
  product: Product | null;
  canSeeFinancials: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    category: product?.category || 'CONSOLE',
    brand: product?.brand || '',
    model: product?.model || '',
    price: product?.price || 0,
    costPrice: product?.costPrice || 0,
    isAlwaysAvailable: Boolean(product?.isAlwaysAvailable),
    serialNumber: product?.serialNumber || '',
  });
  const [stockDelta, setStockDelta] = useState(product ? 0 : 1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [gallery, setGallery] = useState<string[]>(normalizeGallery(product?.gallery, product?.coverImage));
  const [coverImage, setCoverImage] = useState<string | null>(product?.coverImage || null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const syncMediaState = (payload: any) => {
    const nextCover = payload?.coverImage || null;
    const nextGallery = normalizeGallery(payload?.gallery, nextCover);
    setCoverImage(nextCover);
    setGallery(nextGallery);
  };

  const uploadFilesForProduct = async (productId: number, files: File[]) => {
    if (!files.length) return;

    setUploading(true);
    try {
      const form = new FormData();
      files.forEach((file) => form.append('files', file));
      const media = await fetchWithAuth(`/api/products/${productId}/images`, {
        method: 'POST',
        body: form,
      });
      syncMediaState(media);
      setPendingFiles([]);
      toast.success('Фото загружены');
    } catch (err: any) {
      toast.error(err.message || 'Ошибка загрузки фото');
    } finally {
      setUploading(false);
    }
  };

  const setAsCover = async (url: string) => {
    if (!product?.id) return;
    try {
      const media = await fetchWithAuth(`/api/products/${product.id}/images/cover`, {
        method: 'PATCH',
        body: JSON.stringify({ url }),
      });
      syncMediaState(media);
    } catch (err: any) {
      toast.error(err.message || 'Ошибка выбора главного фото');
    }
  };

  const reorderGallery = async (next: string[]) => {
    if (!product?.id) {
      setGallery(next);
      return;
    }
    try {
      const media = await fetchWithAuth(`/api/products/${product.id}/images/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ images: next }),
      });
      syncMediaState(media);
    } catch (err: any) {
      toast.error(err.message || 'Ошибка сортировки фото');
    }
  };

  const removeImage = async (url: string) => {
    if (!product?.id) return;
    try {
      const media = await fetchWithAuth(`/api/products/${product.id}/images`, {
        method: 'DELETE',
        body: JSON.stringify({ url }),
      });
      syncMediaState(media);
      toast.success('Фото удалено');
    } catch (err: any) {
      toast.error(err.message || 'Ошибка удаления фото');
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Заполните название');
      return;
    }

    setSaving(true);
    try {
      const url = product ? `/api/products/${product.id}` : `/api/products`;
      const method = product ? 'PATCH' : 'POST';

      const response = await fetchWithAuth(url, {
        method,
        body: JSON.stringify({
          name: formData.name,
          category: formData.category,
          brand: formData.brand || null,
          model: formData.model || null,
          price: formData.price,
          ...(canSeeFinancials ? { costPrice: formData.costPrice } : {}),
          serialNumber: formData.serialNumber || null,
          isAlwaysAvailable: formData.isAlwaysAvailable,
          storefrontCategory: null,
          isActive: true,
        }),
      });

      const savedProductId = Number(response?.id || product?.id || 0);
      const qtyDelta = Math.trunc(Number(stockDelta || 0));
      if (savedProductId && qtyDelta !== 0) {
        await fetchWithAuth(`/api/products/${savedProductId}/stock/adjust`, {
          method: 'PATCH',
          body: JSON.stringify({ delta: qtyDelta }),
        });
      }
      if (savedProductId && pendingFiles.length) {
        await uploadFilesForProduct(savedProductId, pendingFiles);
      }

      toast.success(product ? 'Складская позиция обновлена' : 'Складская позиция создана');
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
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl sm:p-6 md:p-8"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <h2 className="mb-5 text-2xl font-bold text-white md:mb-6 md:text-3xl">
          {product ? 'Редактировать складскую позицию' : 'Добавить складскую позицию'}
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
            <label className="text-sm text-slate-300 mb-2 block font-bold">
              Изменение остатка (шт)
            </label>
            <input
              type="number"
              className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition"
              value={stockDelta}
              onChange={(e) => setStockDelta(Math.trunc(Number(e.target.value || 0)))}
            />
            <div className="mt-1 text-xs text-slate-500">
              {product
                ? 'Плюс добавит единицы на склад, минус снимет доступные единицы.'
                : 'Для новой позиции обычно 1. Для услуг/подписок можно поставить любое количество.'}
            </div>
            {product ? (
              <div className="mt-1 text-xs text-cyan-300">
                Текущий остаток: {Math.max(0, Number(product.stock || 0))} шт
              </div>
            ) : null}
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

          {canSeeFinancials ? (
            <div>
              <label className="text-sm text-slate-300 mb-2 block font-bold">Себестоимость (₽)</label>
              <input
                type="number"
                className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition"
                value={formData.costPrice}
                onChange={(e) => setFormData({...formData, costPrice: Math.max(0, Number(e.target.value))})}
              />
            </div>
          ) : null}

          <div className="md:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-200 font-medium">
              <input
                type="checkbox"
                checked={formData.isAlwaysAvailable}
                onChange={(e) =>
                  setFormData({ ...formData, isAlwaysAvailable: e.target.checked })
                }
              />
              Всегда в наличии (цифровой сервис, без списания со склада)
            </label>
          </div>

          <div className="md:col-span-2 rounded-xl border border-slate-700 bg-slate-800/30 p-4 space-y-3">
            <div className="text-sm font-bold text-slate-200">Фото товара</div>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setPendingFiles(Array.from(e.target.files || []))}
              className="w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-600 file:px-3 file:py-2 file:text-white"
            />
            {pendingFiles.length > 0 ? (
              <div className="text-xs text-slate-400">
                Выбрано файлов: {pendingFiles.length}
                {product?.id ? ' (загрузятся при сохранении)' : ' (сначала создай товар)'}
              </div>
            ) : null}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {gallery.map((url, index) => (
                <div key={url} className="rounded-lg border border-slate-700 p-2 space-y-2">
                  <img src={url} alt={`img-${index}`} className="h-24 w-full rounded object-cover" />
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      className={`rounded px-2 py-1 text-xs ${
                        coverImage === url
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 text-slate-200'
                      }`}
                      onClick={() => setAsCover(url)}
                    >
                      Главная
                    </button>
                    <button
                      type="button"
                      className="rounded bg-rose-600 px-2 py-1 text-xs text-white"
                      onClick={() => removeImage(url)}
                    >
                      Удалить
                    </button>
                    <button
                      type="button"
                      className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
                      disabled={index === 0}
                      onClick={() => {
                        const next = [...gallery];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        void reorderGallery(next);
                      }}
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
                      disabled={index === gallery.length - 1}
                      onClick={() => {
                        const next = [...gallery];
                        [next[index + 1], next[index]] = [next[index], next[index + 1]];
                        void reorderGallery(next);
                      }}
                    >
                      →
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
            disabled={saving || uploading}
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold disabled:opacity-50 transition-all"
          >
            {saving || uploading ? 'Сохранение...' : (product ? 'Сохранить' : 'Создать')}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
