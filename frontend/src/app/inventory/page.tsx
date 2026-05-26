'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, RefreshCw, Trash2, Search } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import MobilePageHeader from '@/components/MobilePageHeader';

type InventoryStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'RETURNED' | 'WRITEOFF';

type InventoryUnit = {
  id: number;
  serialNumber?: string | null;
  displayName?: string | null;
  category: string;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  variantKey?: string | null;
  variantLabel?: string | null;
  memoryGb?: number | null;
  status: InventoryStatus;
  attachedAt: string;
  product: {
    id: number;
    name: string;
    storefrontCategory?: string | null;
  };
};

type WarehouseProduct = {
  id: number;
  name: string;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
};

const statusLabel: Record<InventoryStatus, string> = {
  AVAILABLE: 'Доступно',
  RESERVED: 'В резерве',
  SOLD: 'Продано',
  RETURNED: 'Возврат',
  WRITEOFF: 'Списание',
};

const statusTone: Record<InventoryStatus, string> = {
  AVAILABLE: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
  RESERVED: 'border-amber-400/30 bg-amber-500/15 text-amber-200',
  SOLD: 'border-cyan-400/30 bg-cyan-500/15 text-cyan-200',
  RETURNED: 'border-violet-400/30 bg-violet-500/15 text-violet-200',
  WRITEOFF: 'border-rose-400/30 bg-rose-500/15 text-rose-200',
};

function canRemoveInventoryUnit(item: InventoryUnit) {
  return item.status === 'AVAILABLE' || item.status === 'RETURNED' || item.status === 'WRITEOFF';
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryUnit[]>([]);
  const [warehouseProducts, setWarehouseProducts] = useState<WarehouseProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | InventoryStatus>('AVAILABLE');

  const [formData, setFormData] = useState({
    productId: '',
    serialNumber: '',
    name: '',
    brand: '',
    model: '',
    version: '',
    memoryGb: '',
    variantKey: '',
    purchasePrice: '',
    price: '',
    category: 'CONSOLE',
    notes: '',
  });

  const loadWarehouseProducts = async () => {
    try {
      const data = await fetchWithAuth('/api/products?limit=5000&scope=warehouse');
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const warehouseOnly = list
        .map((row: any) => ({
          id: Number(row.id),
          name: String(row.name),
          brand: row.brand ?? null,
          model: row.model ?? null,
          version: row.version ?? null,
        }))
        .sort((a: WarehouseProduct, b: WarehouseProduct) => a.name.localeCompare(b.name, 'ru'));
      setWarehouseProducts(warehouseOnly);
    } catch {
      setWarehouseProducts([]);
    }
  };

  const loadInventory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (status !== 'ALL') params.set('status', status);
      params.set('limit', '500');

      const data = await fetchWithAuth(`/api/inventory?${params.toString()}`);
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list);
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось загрузить склад');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadWarehouseProducts(), loadInventory()]);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadInventory();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, status]);

  const saveUnit = async () => {
    setSaving(true);
    try {
      await fetchWithAuth('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({
          productId: formData.productId ? Number(formData.productId) : undefined,
          serialNumber: formData.serialNumber.trim() || undefined,
          name: formData.name.trim() || undefined,
          brand: formData.brand.trim() || undefined,
          model: formData.model.trim() || undefined,
          version: formData.version.trim() || undefined,
          memoryGb: formData.memoryGb ? Number(formData.memoryGb) : undefined,
          variantKey: formData.variantKey.trim() || undefined,
          purchasePrice: formData.purchasePrice ? Number(formData.purchasePrice) : undefined,
          price: formData.price ? Number(formData.price) : undefined,
          category: formData.category,
          notes: formData.notes.trim() || undefined,
        }),
      });

      toast.success('Складская единица добавлена');
      setFormData({
        productId: '',
        serialNumber: '',
        name: '',
        brand: '',
        model: '',
        version: '',
        memoryGb: '',
        variantKey: '',
        purchasePrice: '',
        price: '',
        category: 'CONSOLE',
        notes: '',
      });
      await loadInventory();
    } catch (err: any) {
      toast.error(err?.message || 'Ошибка добавления');
    } finally {
      setSaving(false);
    }
  };

  const removeUnit = async (id: number) => {
    if (!confirm('Удалить складскую единицу?')) return;

    try {
      await fetchWithAuth(`/api/inventory/${id}`, { method: 'DELETE' });
      toast.success('Удалено');
      await loadInventory();
    } catch (err: any) {
      toast.error(err?.message || 'Не удалось удалить');
    }
  };

  const availableCount = useMemo(
    () => items.filter(item => item.status === 'AVAILABLE').length,
    [items],
  );

  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'TECHNICAL_SPECIALIST', 'SUPER_ADMIN']}>
      <div className="mobile-page-shell md:space-y-6 md:pb-6">
        <MobilePageHeader title="Единицы склада" subtitle={`${items.length} единиц · ${availableCount} доступно`} sticky={false} />

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/35 p-3 md:flex-row md:items-center md:justify-between md:border-0 md:bg-transparent md:p-0">
          <div className="hidden md:block">
            <h1 className="text-2xl font-bold text-white">Склад</h1>
            <p className="text-sm text-slate-400">
              Только реальные единицы товара. Карточки витрины управляются отдельно в разделе
              «Витрина».
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadInventory()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-600 bg-slate-800/60 px-4 py-2 text-sm text-slate-100 hover:bg-slate-700/60 md:rounded-lg"
          >
            <RefreshCw className="h-4 w-4" />
            Обновить
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5 md:gap-4">
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 md:p-4">
            <div className="text-xs text-slate-400">Всего единиц</div>
            <div className="mt-1 text-xl font-bold text-white md:text-2xl">{items.length}</div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 md:p-4">
            <div className="text-xs text-slate-400">Доступно</div>
            <div className="mt-1 text-xl font-bold text-emerald-300 md:text-2xl">{availableCount}</div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 md:p-4">
            <div className="text-xs text-slate-400">Складских позиций</div>
            <div className="mt-1 text-xl font-bold text-cyan-300 md:text-2xl">{warehouseProducts.length}</div>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/40 p-3 md:p-4">
          <div className="text-sm font-semibold text-slate-200">Добавить складскую единицу</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select
              value={formData.productId}
              onChange={(e) => setFormData(prev => ({ ...prev, productId: e.target.value }))}
              className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white"
            >
              <option value="">Авто: создать/подобрать складскую позицию</option>
              {warehouseProducts.map(product => (
                <option key={product.id} value={product.id}>
                  #{product.id} · {product.name}
                </option>
              ))}
            </select>

            <input
              value={formData.serialNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
              placeholder="Серийный номер (необязательно для услуг)"
              className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white"
            />

            <input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Название складской единицы"
              className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white"
            />

            <input
              value={formData.model}
              onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
              placeholder="Модель (для автоопределения)"
              className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white"
            />

            <input
              value={formData.brand}
              onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
              placeholder="Бренд"
              className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white"
            />

            <input
              value={formData.version}
              onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
              placeholder="Версия"
              className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white"
            />

            <input
              type="number"
              min={0}
              value={formData.memoryGb}
              onChange={(e) => setFormData(prev => ({ ...prev, memoryGb: e.target.value }))}
              placeholder="Объём памяти (GB)"
              className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white"
            />

            <input
              value={formData.variantKey}
              onChange={(e) => setFormData(prev => ({ ...prev, variantKey: e.target.value }))}
              placeholder="variantKey (напр. 512gb)"
              className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white"
            />

            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white"
            >
              <option value="CONSOLE">CONSOLE</option>
              <option value="ACCESSORY">ACCESSORY</option>
              <option value="DISK">DISK</option>
              <option value="SERVICE">SERVICE</option>
              <option value="SUBSCRIPTION_KEY">SUBSCRIPTION_KEY</option>
            </select>

            <input
              type="number"
              min={0}
              value={formData.purchasePrice}
              onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
              placeholder="Закупочная цена"
              className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white"
            />

            <input
              type="number"
              min={0}
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              placeholder="Цена продажи"
              className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white"
            />

            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Примечание"
              className="md:col-span-2 rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white"
            />
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void saveUnit()}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {saving ? 'Сохраняем...' : 'Добавить на склад'}
          </button>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/40 p-3 md:p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по серийнику, модели, складской позиции"
                className="w-full rounded-lg border border-slate-600 bg-slate-800/70 py-2 pl-9 pr-3 text-sm text-white"
              />
            </div>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ALL' | InventoryStatus)}
              className="rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white"
            >
              <option value="ALL">Все статусы</option>
              <option value="AVAILABLE">Доступно</option>
              <option value="RESERVED">В резерве</option>
              <option value="SOLD">Продано</option>
              <option value="RETURNED">Возврат</option>
              <option value="WRITEOFF">Списание</option>
            </select>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-400">Загрузка...</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700/70 bg-slate-950/35 p-6 text-center text-sm text-slate-400">
              По текущим фильтрам складские единицы не найдены.
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500">#{item.id}</div>
                        <div className="mt-1 line-clamp-2 text-sm font-semibold text-white">
                          {item.displayName || [item.brand, item.model, item.version].filter(Boolean).join(' ') || item.product.name}
                        </div>
                        <div className="mt-1 line-clamp-1 text-xs text-slate-400">
                          #{item.product.id} · {item.product.name}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${statusTone[item.status]}`}>
                        {statusLabel[item.status]}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-slate-700/60 bg-slate-900/45 p-2.5">
                        <div className="text-slate-500">Серийник</div>
                        <div className="mt-1 break-all font-mono text-slate-100">
                          {item.serialNumber || '—'}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-700/60 bg-slate-900/45 p-2.5">
                        <div className="text-slate-500">Вариант</div>
                        <div className="mt-1 text-slate-100">
                          {item.variantLabel || item.variantKey || '—'}
                        </div>
                      </div>
                      <div className="col-span-2 rounded-xl border border-slate-700/60 bg-slate-900/45 p-2.5">
                        <div className="text-slate-500">Дата добавления</div>
                        <div className="mt-1 text-slate-100">
                          {new Date(item.attachedAt).toLocaleString('ru-RU')}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!canRemoveInventoryUnit(item)}
                      onClick={() => void removeUnit(item.id)}
                      className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                      title={canRemoveInventoryUnit(item) ? 'Удалить единицу' : 'Удаление доступно только для доступных/возврат/списание'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Удалить
                    </button>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-left text-slate-400">
                    <th className="py-2 pr-3">ID</th>
                    <th className="py-2 pr-3">Складская позиция</th>
                    <th className="py-2 pr-3">Единица</th>
                    <th className="py-2 pr-3">Серийник</th>
                    <th className="py-2 pr-3">Вариант</th>
                    <th className="py-2 pr-3">Статус</th>
                    <th className="py-2 pr-3">Дата</th>
                    <th className="py-2">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-slate-800 text-slate-200">
                      <td className="py-2 pr-3">#{item.id}</td>
                      <td className="py-2 pr-3">
                        #{item.product.id} · {item.product.name}
                      </td>
                      <td className="py-2 pr-3">
                        {item.displayName || [item.brand, item.model, item.version].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="py-2 pr-3">{item.serialNumber || '—'}</td>
                      <td className="py-2 pr-3">{item.variantLabel || item.variantKey || '—'}</td>
                      <td className="py-2 pr-3">
                        <span className="rounded-full border border-slate-600 px-2 py-0.5 text-xs">
                          {statusLabel[item.status]}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{new Date(item.attachedAt).toLocaleString('ru-RU')}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          disabled={!canRemoveInventoryUnit(item)}
                          onClick={() => void removeUnit(item.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/20 px-2 py-1 text-xs text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                          title={canRemoveInventoryUnit(item) ? 'Удалить единицу' : 'Удаление доступно только для доступных/возврат/списание'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
