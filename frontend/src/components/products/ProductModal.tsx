'use client';

import { useState, useEffect } from 'react';
import { X, Package, Save } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

type Product = {
  id?: number;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  stock: number;
  price: number;
  costPrice: number;
  sku?: string;
  serialNumber?: string;
  description?: string;
};

type ProductModalProps = {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const categories = [
  { value: 'CONSOLE', label: 'Консоль', color: 'text-blue-400' },
  { value: 'GAME', label: 'Игра', color: 'text-pink-400' },
  { value: 'ACCESSORY', label: 'Аксессуар', color: 'text-purple-400' },
  { value: 'DISK', label: 'Диск', color: 'text-green-400' },
  { value: 'SERVICE', label: 'Услуга', color: 'text-amber-400' },
  { value: 'SUBSCRIPTION_KEY', label: 'Ключ подписки', color: 'text-teal-400' },
];

export default function ProductModal({ product, isOpen, onClose, onSuccess }: ProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Product>({
    name: '',
    category: 'CONSOLE',
    brand: '',
    model: '',
    stock: 0,
    price: 0,
    costPrice: 0,
    sku: '',
    serialNumber: '',
    description: '',
  });

  useEffect(() => {
    if (product) {
      setFormData({
        id: product.id,
        name: product.name || '',
        category: product.category || 'CONSOLE',
        brand: product.brand || '',
        model: product.model || '',
        stock: product.stock || 0,
        price: product.price || 0,
        costPrice: product.costPrice || 0,
        sku: product.sku || '',
        serialNumber: product.serialNumber || '',
        description: product.description || '',
      });
    } else {
      setFormData({
        name: '',
        category: 'CONSOLE',
        brand: '',
        model: '',
        stock: 0,
        price: 0,
        costPrice: 0,
        sku: '',
        serialNumber: '',
        description: '',
      });
    }
  }, [product]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Введите название товара');
      return;
    }

    if (formData.price <= 0) {
      toast.error('Цена должна быть больше 0');
      return;
    }

    setLoading(true);
    try {
      const url = product?.id ? `products/${product.id}` : 'products';
      const method = product?.id ? 'PATCH' : 'POST';

      await fetchWithAuth(url, {
        method,
        body: JSON.stringify(formData),
      });

      toast.success(product?.id ? 'Товар обновлен' : 'Товар создан');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error(`Ошибка сохранения: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNumberInput = (field: keyof Product, value: string) => {
    const numValue = parseFloat(value) || 0;
    setFormData(prev => ({ ...prev, [field]: numValue }));
  };

  const calculateProfit = () => {
    return formData.price - formData.costPrice;
  };

  const profitMarginValue = formData.costPrice > 0 
    ? ((formData.price - formData.costPrice) / formData.costPrice * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5" />
              {product?.id ? 'Редактировать товар' : 'Новый товар'}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {product?.id ? 'Измените информацию о товаре' : 'Заполните информацию о новом товаре'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Название товара *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5 text-white"
                  placeholder="PlayStation 5 Digital Edition"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Категория
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                      className={`p-3 rounded-lg border transition text-left ${
                        formData.category === cat.value
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-slate-600 bg-slate-800/30 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className={`text-sm mb-1 ${cat.color}`}>{cat.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Бренд
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                    className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5 text-white"
                    placeholder="Sony"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Модель
                  </label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                    className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5 text-white"
                    placeholder="PS5 Slim"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Описание
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5 min-h-[100px] text-white"
                  placeholder="Описание товара..."
                />
              </div>
            </div>

            {/* Right Column - Stock & Pricing */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Артикул (SKU)
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                    className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5 text-white"
                    placeholder="SONY-PS5-DIGITAL"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Серийный номер
                  </label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                    className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5 text-white"
                    placeholder="ABC123XYZ"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Остаток на складе
                </label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => handleNumberInput('stock', e.target.value)}
                  className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5 text-white"
                  min="0"
                  step="1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Себестоимость (₽)
                  </label>
                  <input
                    type="number"
                    value={formData.costPrice}
                    onChange={(e) => handleNumberInput('costPrice', e.target.value)}
                    className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5 text-white"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Цена продажи (₽) *
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => handleNumberInput('price', e.target.value)}
                    className="w-full rounded-lg bg-slate-800/50 border border-slate-600/50 px-3 py-2.5 text-white"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              {/* Profit Calculator */}
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-600/50">
                <div className="text-sm font-medium text-white mb-2">Расчет прибыли</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-400">Прибыль с единицы</div>
                    <div className={`text-lg font-bold ${calculateProfit() >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                      {calculateProfit().toLocaleString('ru-RU')} ₽
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Маржа</div>
                    <div className={`text-lg font-bold ${(profitMarginValue as number) >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                      {(profitMarginValue as number).toFixed(1)}%
                    </div>
                  </div>
                </div>
                {formData.stock > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-700/50">
                    <div className="text-xs text-slate-400">Общая прибыль со склада</div>
                    <div className={`text-lg font-bold ${calculateProfit() * formData.stock >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
                      {(calculateProfit() * formData.stock).toLocaleString('ru-RU')} ₽
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              disabled={loading}
            >
              <Save className="w-4 h-4" />
              {loading ? (product?.id ? 'Сохранение...' : 'Создание...') : (product?.id ? 'Сохранить изменения' : 'Создать товар')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}