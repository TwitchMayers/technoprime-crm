'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Shirt, Edit, Trash, Archive, Package, Image as ImageIcon, ZoomIn, ShoppingCart, BarChart3, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import ProtectedRoute from '@/components/ProtectedRoute';

const CATEGORIES = {
  JACKET: 'Куртка',
  JEANS: 'Джинсы',
  TSHIRT: 'Футболка',
  VEST: 'Жилетка',
  SHIRT: 'Рубашка',
  SHORTS: 'Шорты',
  HAT: 'Шапка',
} as const;
type CategoryKey = keyof typeof CATEGORIES;

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;

type Product = {
  id: number;
  brand: string;
  category: keyof typeof CATEGORIES;
  color: string;
  imageUrl?: string;
  description?: string;
  price: number;
  costPrice: number;
  isArchived: boolean;
  archivedAt?: string;
  sizes: Array<{ size: string; stock: number }>;
};

type SoldProduct = {
  id: number;
  productId: number;
  brand: string;
  category: string;
  color: string;
  size: string;
  quantity: number;
  salePrice: number;
  costPrice: number;
  soldAt: string;
  orderId?: number;
};

export default function RichMarketProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [soldProducts, setSoldProducts] = useState<SoldProduct[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (showArchived) params.set('isArchived', 'true');
      params.set('limit', '500');

      const [productsRes, brandsRes, soldRes] = await Promise.all([
        fetchWithAuth(`/api/richmarket/products?${params}`)
          .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
          })
          .then(text => text ? JSON.parse(text) : [])
          .catch(err => {
            console.error('Failed to load products:', err);
            toast.error('Ошибка загрузки товаров');
            return [];
          }),
        fetchWithAuth('/api/richmarket/products/brands')
          .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
          })
          .then(text => text ? JSON.parse(text) : [])
          .catch(err => {
            console.error('Failed to load brands:', err);
            return [];
          }),
        // Загружаем проданные товары для архива
        showArchived ? fetchWithAuth('/api/richmarket/orders/sold-products')
          .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
          })
          .then(text => text ? JSON.parse(text) : [])
          .catch(err => {
            console.error('Failed to load sold products:', err);
            return [];
          }) : Promise.resolve([]),
      ]);
      
      setProducts(Array.isArray(productsRes) ? productsRes : []);
      setBrands(Array.isArray(brandsRes) ? brandsRes : []);
      setSoldProducts(Array.isArray(soldRes) ? soldRes : []);
    } catch (err) {
      console.error('Failed to load:', err);
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    load(); 
  }, [showArchived]);

  const deleteProduct = async (id: number) => {
    if (!confirm('Удалить товар навсегда?')) return;

    try {
      const res = await fetchWithAuth(`/api/richmarket/products/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.text();
        console.error('Delete error:', error);
        toast.error('Ошибка удаления');
        return;
      }

      toast.success('Товар удалён');
      load();
    } catch (err) {
      console.error('Network error:', err);
      toast.error('Ошибка сети');
    }
  };

  const archiveProduct = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/richmarket/products/${id}/archive`, { method: 'PATCH' });
      if (!res.ok) {
        const error = await res.text();
        console.error('Archive error:', error);
        toast.error('Ошибка архивации');
        return;
      }

      toast.success('Товар перемещен в архив');
      load();
    } catch (err) {
      console.error('Network error:', err);
      toast.error('Ошибка сети');
    }
  };

  const unarchiveProduct = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/richmarket/products/${id}/unarchive`, { method: 'PATCH' });
      if (!res.ok) {
        const error = await res.text();
        console.error('Unarchive error:', error);
        toast.error('Ошибка восстановления');
        return;
      }

      toast.success('Товар восстановлен из архива');
      load();
    } catch (err) {
      console.error('Network error:', err);
      toast.error('Ошибка сети');
    }
  };

  const getTotalStock = (p: Product) => {
    return p.sizes?.reduce((sum, s) => sum + s.stock, 0) || 0;
  };

  const getTotalValue = (p: Product) => {
    return getTotalStock(p) * p.price;
  };

  const getProfit = (p: Product) => {
    return getTotalStock(p) * (p.price - p.costPrice);
  };

  // Группируем проданные товары по productId для отображения в архиве
  const groupedSoldProducts = soldProducts.reduce((acc, sold) => {
    const key = `${sold.productId}-${sold.brand}-${sold.category}-${sold.color}`;
    if (!acc[key]) {
      acc[key] = {
        productId: sold.productId,
        brand: sold.brand,
        category: sold.category,
        color: sold.color,
        sizes: [],
        totalSold: 0,
        totalRevenue: 0,
        totalCost: 0,
        lastSold: sold.soldAt
      };
    }
    
    acc[key].sizes.push({
      size: sold.size,
      quantity: sold.quantity,
      salePrice: sold.salePrice,
      costPrice: sold.costPrice
    });
    acc[key].totalSold += sold.quantity;
    acc[key].totalRevenue += sold.quantity * sold.salePrice;
    acc[key].totalCost += sold.quantity * sold.costPrice;
    
    if (new Date(sold.soldAt) > new Date(acc[key].lastSold)) {
      acc[key].lastSold = sold.soldAt;
    }
    
    return acc;
  }, {} as any);

  // Статистика
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + getTotalStock(p), 0);
  const totalValue = products.reduce((sum, p) => sum + getTotalValue(p), 0);
  const totalProfit = products.reduce((sum, p) => sum + getProfit(p), 0);

  // Статистика архива
  const totalSoldItems = soldProducts.reduce((sum, s) => sum + s.quantity, 0);
  const totalRevenue = soldProducts.reduce((sum, s) => sum + (s.quantity * s.salePrice), 0);
  const totalCost = soldProducts.reduce((sum, s) => sum + (s.quantity * s.costPrice), 0);
  const archiveProfit = totalRevenue - totalCost;

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'RICHMARKET_CEO', 'RICHMARKET_MANAGER']}>
      <div className="space-y-4 pb-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 via-rose-400 to-orange-400 bg-clip-text text-transparent">
              {showArchived ? 'Архив продаж' : 'Каталог одежды'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {showArchived ? 'История проданных товаров' : 'Управление ассортиментом премиум брендов'}
            </p>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            {!showArchived ? (
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setModalOpen(true);
                }}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-orange-600 hover:from-pink-500 hover:to-orange-500 text-white font-semibold shadow-lg shadow-pink-500/30 transition-all"
              >
                <Plus className="w-5 h-5" />
                Добавить товар
              </button>
            ) : (
              <button
                onClick={() => {
                  // Экспорт архива в CSV
                  toast.info('Экспорт архива в разработке');
                }}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold shadow-lg shadow-blue-500/30 transition-all"
              >
                <Download className="w-5 h-5" />
                Экспорт архива
              </button>
            )}
          </div>
        </motion.div>

        {/* Статистика */}
        {!showArchived ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <div className="glass p-4 text-center">
              <div className="text-2xl font-bold text-pink-400">{totalProducts}</div>
              <div className="text-sm text-slate-400">Товаров</div>
            </div>
            <div className="glass p-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                {totalStock.toLocaleString()}
              </div>
              <div className="text-sm text-slate-400">Всего единиц</div>
            </div>
            <div className="glass p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">
                {totalValue.toLocaleString()} ₽
              </div>
              <div className="text-sm text-slate-400">Общая стоимость</div>
            </div>
            <div className="glass p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">
                {totalProfit.toLocaleString()} ₽
              </div>
              <div className="text-sm text-slate-400">Потенциальная прибыль</div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <div className="glass p-4 text-center">
              <div className="text-2xl font-bold text-amber-400">{Object.keys(groupedSoldProducts).length}</div>
              <div className="text-sm text-slate-400">Проданных позиций</div>
            </div>
            <div className="glass p-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                {totalSoldItems.toLocaleString()}
              </div>
              <div className="text-sm text-slate-400">Всего продаж</div>
            </div>
            <div className="glass p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">
                {totalRevenue.toLocaleString()} ₽
              </div>
              <div className="text-sm text-slate-400">Выручка</div>
            </div>
            <div className="glass p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400">
                {archiveProfit.toLocaleString()} ₽
              </div>
              <div className="text-sm text-slate-400">Прибыль</div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass p-4"
        >
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                placeholder={showArchived ? "Поиск по бренду, цвету..." : "Поиск по бренду, цвету или описанию..."}
                className="w-full pl-11 rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-500 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all"
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && load()}
              />
            </div>
            <button 
              onClick={load}
              className="btn-primary"
            >
              Найти
            </button>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                showArchived
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
              }`}
            >
              <Archive className="w-4 h-4" />
              {showArchived ? 'Активные' : 'Архив'}
            </button>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass p-12 text-center"
            >
              <div className="animate-spin w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <div className="text-slate-400">
                {showArchived ? 'Загрузка архива...' : 'Загрузка каталога...'}
              </div>
            </motion.div>
          ) : showArchived ? (
            // АРХИВ - проданные товары
            soldProducts.length === 0 ? (
              <motion.div
                key="empty-archive"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass p-16 text-center"
              >
                <Package className="w-24 h-24 mx-auto mb-6 text-slate-700" />
                <div className="text-xl font-semibold text-white mb-2">Архив пуст</div>
                <div className="text-slate-400">Нет данных о проданных товарах</div>
                <div className="text-slate-500 text-sm mt-2">
                  Проданные товары появятся здесь после завершения заказов
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="archive-grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                {Object.values(groupedSoldProducts).map((group: any, idx: number) => (
                  <motion.div
                    key={group.productId}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="glass p-6"
                  >
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-white mb-1">{group.brand}</h3>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-slate-400">
                                {CATEGORIES[group.category as keyof typeof CATEGORIES] || group.category}
                              </span>
                              <span className="text-slate-600">•</span>
                              <span className="px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300 text-xs">
                                {group.color}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-400">
                              {group.totalRevenue.toLocaleString()} ₽
                            </div>
                            <div className="text-sm text-slate-400">
                              Продано: {group.totalSold} шт
                            </div>
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="text-xs text-slate-500 mb-2">Проданные размеры:</div>
                          <div className="flex flex-wrap gap-2">
                            {group.sizes.map((s: any) => (
                              <div
                                key={s.size}
                                className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-medium"
                              >
                                <span className="text-white">{s.size}</span>
                                <span className="ml-1">×{s.quantity}</span>
                                <div className="text-xs text-amber-300">
                                  {s.salePrice.toLocaleString()} ₽
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="text-slate-500">
                            Прибыль: <span className="text-emerald-400 font-bold">
                              {(group.totalRevenue - group.totalCost).toLocaleString()} ₽
                            </span>
                          </div>
                          <div className="text-slate-500">
                            Последняя продажа: {new Date(group.lastSold).toLocaleDateString('ru-RU')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )
          ) : (
            // АКТИВНЫЕ ТОВАРЫ
            products.length === 0 ? (
              <motion.div
                key="empty-active"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass p-16 text-center"
              >
                <Shirt className="w-24 h-24 mx-auto mb-6 text-slate-700" />
                <div className="text-xl font-semibold text-white mb-2">Каталог пуст</div>
                <div className="text-slate-400">Добавьте первый товар в ассортимент</div>
              </motion.div>
            ) : (
              <motion.div
                key="active-grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              >
                {products.map((p, idx) => (
                  <ProductCard 
                    key={p.id} 
                    product={p} 
                    index={idx}
                    onEdit={() => {
                      setEditingProduct(p);
                      setModalOpen(true);
                    }}
                    onArchive={() => archiveProduct(p.id)}
                    onUnarchive={() => unarchiveProduct(p.id)}
                    onDelete={() => deleteProduct(p.id)}
                    onImagePreview={(url: string) => setImagePreview(url)}
                  />
                ))}
              </motion.div>
            )
          )}
        </AnimatePresence>

        <AnimatePresence>
          {imagePreview && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
              onClick={() => setImagePreview(null)}
            >
              <motion.img
                src={imagePreview}
                alt="Preview"
                className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {modalOpen && (
          <ProductModal
            product={editingProduct}
            brands={brands}
            onClose={() => {
              setModalOpen(false);
              setEditingProduct(null);
            }}
            onSave={() => {
              setModalOpen(false);
              setEditingProduct(null);
              load();
            }}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}

// Вынесем карточку товара в отдельный компонент для чистоты
function ProductCard({ product, index, onEdit, onArchive, onUnarchive, onDelete, onImagePreview }: any) {
  const getTotalStock = (p: any) => {
    return p.sizes?.reduce((sum: number, s: any) => sum + s.stock, 0) || 0;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="glass overflow-hidden group"
    >
      <div 
        className={`relative h-64 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden cursor-pointer ${product.isArchived ? 'grayscale' : ''}`}
        onClick={() => product.imageUrl && onImagePreview(product.imageUrl)}
      >
        {product.imageUrl ? (
          <>
            <img 
              src={product.imageUrl} 
              alt={product.brand}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500 bg-slate-900"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
              <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-16 h-16 text-slate-700" />
          </div>
        )}
        
        {product.isArchived ? (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-amber-500/90 text-white text-xs font-bold backdrop-blur-sm">
            Архив
          </div>
        ) : getTotalStock(product) === 0 ? (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-red-500/90 text-white text-xs font-bold backdrop-blur-sm">
            Нет в наличии
          </div>
        ) : null}
      </div>

      <div className="p-5">
        <div className="mb-3">
          <h3 className="text-xl font-bold text-white mb-1 truncate">{product.brand}</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">{CATEGORIES[product.category as CategoryKey]}</span>
            <span className="text-slate-600">•</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300 text-xs">
              {product.color}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs text-slate-500 mb-2">Размеры в наличии:</div>
          <div className="flex flex-wrap gap-2">
            {product.sizes && product.sizes.filter((s: any) => s.stock > 0).length > 0 ? (
              product.sizes
                .filter((s: any) => s.stock > 0)
                .map((s: any) => (
                  <div
                    key={s.size}
                    className="px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-medium"
                  >
                    <span className="text-white">{s.size}</span>
                    <span className="ml-1">×{s.stock}</span>
                  </div>
                ))
            ) : (
              <span className="text-slate-500 text-xs">Нет в наличии</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700/50">
          <div>
            <div className="text-xs text-slate-500">Цена</div>
            <div className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">
              {product.price.toLocaleString()} ₽
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Всего</div>
            <div className="text-lg font-bold text-white">
              {getTotalStock(product)} шт
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {!product.isArchived ? (
            <>
              <button
                onClick={onEdit}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 hover:border-slate-500/50 transition-all text-sm font-medium"
              >
                <Edit className="w-4 h-4" />
                Редактировать
              </button>
              
              <button
                onClick={onArchive}
                className="px-4 py-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 transition-all"
                title="В архив"
              >
                <Archive className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={onUnarchive}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-400 transition-all"
              title="Восстановить"
            >
              <Package className="w-4 h-4" />
              Восстановить
            </button>
          )}

          <button
            onClick={onDelete}
            className="px-4 py-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 transition-all"
            title="Удалить"
          >
            <Trash className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Компонент модального окна остается без изменений
function ProductModal({ product, brands, onClose, onSave }: any) {
  const [brand, setBrand] = useState(product?.brand || '');
  const [category, setCategory] = useState(product?.category || 'TSHIRT');
  const [color, setColor] = useState(product?.color || '');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product?.price || 0);
  const [costPrice, setCostPrice] = useState(product?.costPrice || 0);
  const [saving, setSaving] = useState(false);

  const [sizes, setSizes] = useState<Array<{ size: string; stock: number }>>(() => {
    const initialSizes = SIZES.map(size => ({ size, stock: 0 }));
    
    if (product?.sizes) {
      return initialSizes.map(initialSize => {
        const existingSize = product.sizes.find((s: any) => s.size === initialSize.size);
        return existingSize ? { ...existingSize } : initialSize;
      });
    }
    
    return initialSizes;
  });

  const updateSize = (sizeKey: string, stock: number) => {
    setSizes(prev => prev.map(s => 
      s.size === sizeKey ? { ...s, stock: Math.max(0, stock) } : s
    ));
  };

  const save = async () => {
    if (!brand.trim()) {
      toast.error('Введите бренд товара');
      return;
    }
    if (!color.trim()) {
      toast.error('Введите цвет товара');
      return;
    }
    if (price <= 0) {
      toast.error('Цена должна быть больше 0');
      return;
    }

    setSaving(true);
    
    const body = {
      brand: brand.trim(),
      category,
      color: color.trim(),
      imageUrl: imageUrl.trim() || undefined,
      description: description.trim() || undefined,
      price: Number(price),
      costPrice: Number(costPrice),
      sizes: sizes.filter(s => s.stock > 0),
    };

    try {
      const method = product ? 'PATCH' : 'POST';
      const url = product ? `/api/richmarket/products/${product.id}` : '/api/richmarket/products';

      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = 'Ошибка сохранения';
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        console.error('Save error:', errorText);
        toast.error(errorMessage);
        return;
      }

      toast.success(product ? 'Товар обновлён' : 'Товар добавлен');
      onSave();
    } catch (err) {
      console.error('Network error:', err);
      toast.error('Ошибка сети');
    } finally {
      setSaving(false);
    }
  };

  const totalStock = sizes.reduce((sum, s) => sum + s.stock, 0);
  const totalValue = totalStock * price;
  const totalCost = totalStock * costPrice;
  const totalProfit = totalValue - totalCost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md" 
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div 
        className="glass w-full max-w-4xl p-6 md:p-8 relative max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
      >
        <h2 className="text-2xl font-bold mb-6 text-white">
          {product ? 'Редактировать товар' : 'Добавить новый товар'}
        </h2>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm text-slate-300 mb-2 block font-semibold">Бренд *</label>
              <input
                placeholder="Moncler, Gucci, Balenciaga..."
                value={brand}
                onChange={e => setBrand(e.target.value)}
                className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-500 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all"
              />
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-2 block font-semibold">Категория</label>
              <select 
                value={category} 
                onChange={e => setCategory(e.target.value)} 
                className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-500 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all"
              >
                {Object.entries(CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-2 block font-semibold">Цвет *</label>
              <input
                placeholder="Черный, Белый, Синий..."
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-500 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm text-slate-300 mb-2 block font-semibold">URL фотографии</label>
              <input
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-500 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all"
              />
              {imageUrl && (
                <div className="mt-3">
                  <img 
                    src={imageUrl} 
                    alt="Preview" 
                    className="w-full h-48 object-contain rounded-lg bg-slate-900 border border-slate-700"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      toast.error('Не удалось загрузить изображение');
                    }}
                  />
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="text-sm text-slate-300 mb-2 block font-semibold">Описание</label>
              <textarea
                placeholder="Дополнительная информация о товаре..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-500 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-2 block font-semibold">Цена продажи (₽) *</label>
              <input
                type="number"
                min={0}
                step={100}
                value={price}
                onChange={e => setPrice(Number(e.target.value))}
                className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-500 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all"
              />
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-2 block font-semibold">Себестоимость (₽)</label>
              <input
                type="number"
                min={0}
                step={100}
                value={costPrice}
                onChange={e => setCostPrice(Number(e.target.value))}
                className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-4 py-3 text-white placeholder-slate-500 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all"
              />
            </div>
          </div>

          <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700/50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Размеры и остатки</h3>
              <div className="text-sm text-slate-400">
                Всего: <span className="text-white font-bold">{totalStock} шт</span> • 
                Стоимость: <span className="text-green-400 font-bold">{totalValue.toLocaleString()} ₽</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {SIZES.map(sizeKey => {
                const sizeData = sizes.find(s => s.size === sizeKey);
                return (
                  <div key={sizeKey} className="flex flex-col">
                    <label className="text-xs text-slate-400 mb-1.5 font-medium">{sizeKey}</label>
                    <input
                      type="number"
                      min={0}
                      value={sizeData?.stock || 0}
                      onChange={e => updateSize(sizeKey, Number(e.target.value))}
                      className="w-full text-center rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2 text-white placeholder-slate-500 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all"
                      placeholder="0"
                    />
                  </div>
                );
              })}
            </div>
            
            {totalStock > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-3 gap-4 text-xs">
                <div className="text-center">
                  <div className="text-slate-400">Себестоимость</div>
                  <div className="text-blue-400 font-bold">{totalCost.toLocaleString()} ₽</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400">Общая стоимость</div>
                  <div className="text-green-400 font-bold">{totalValue.toLocaleString()} ₽</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400">Прибыль</div>
                  <div className="text-emerald-400 font-bold">{totalProfit.toLocaleString()} ₽</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-end gap-3 mt-8">
          <button 
            className="btn-secondary order-2 md:order-1" 
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </button>
          <button 
            className="btn-success order-1 md:order-2 text-base py-3 flex items-center justify-center gap-2" 
            onClick={save}
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Сохранение...
              </>
            ) : (
              <>
                {product ? 'Сохранить изменения' : 'Добавить в каталог'}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}