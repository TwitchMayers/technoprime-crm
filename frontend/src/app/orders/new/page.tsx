'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash, ArrowLeft, ShoppingCart, Truck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import ShipmentDispatchCodeCard from '@/components/ShipmentDispatchCodeCard';
import { useAuth } from '@/contexts/AuthContext';

type Product = {
  id: number;
  name: string;
  price: number;
  costPrice?: number;
  stock: number;
  isActive: boolean;
  isArchived?: boolean;
  isAlwaysAvailable?: boolean;
  inStock?: boolean;
};

type Client = {
  id: number;
  name: string;
  phone: string;
};

type OrderItem = {
  productId: number;
  name: string;
  qty: number;
  salePrice: number;
  cost: number;
};

const salesChannelOptions = [
  { value: 'RETAIL', label: 'Розничная продажа' },
  { value: 'WEBSITE', label: 'Интернет-магазин' },
  { value: 'AVITO', label: 'Avito' },
  { value: 'OZON', label: 'Ozon' },
  { value: 'OTHER', label: 'Другое' },
];

const carrierOptions = [
  { value: 'AVITO_DELIVERY', label: 'Avito Доставка' },
  { value: 'AVITO_CDEK', label: 'СДЭК через Avito' },
  { value: 'AVITO_YANDEX', label: 'Яндекс через Avito' },
  { value: 'AVITO_POST_RUSSIA', label: 'Почта через Avito' },
  { value: 'CDEK_PERSONAL', label: 'СДЭК, отправка физлицом' },
  { value: 'YANDEX_DELIVERY', label: 'Яндекс Доставка' },
  { value: 'OZON_DELIVERY', label: 'Ozon' },
  { value: 'POST_RUSSIA', label: 'Почта России' },
  { value: 'OTHER', label: 'Другая служба' },
];

function isProductOrderable(product: Product) {
  if (!product || product.isActive === false || product.isArchived) {
    return false;
  }
  if (product.isAlwaysAvailable) {
    return true;
  }
  if (Number(product.stock || 0) > 0) {
    return true;
  }
  return Boolean(product.inStock);
}

export default function NewOrderPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clientId, setClientId] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'TRADE_IN'>('CASH');
  const [salesChannel, setSalesChannel] = useState('RETAIL');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'LOCAL_DELIVERY' | 'TRANSPORT_COMPANY'>('LOCAL_DELIVERY');
  const [carrier, setCarrier] = useState('AVITO_DELIVERY');
  const [externalOrderNumber, setExternalOrderNumber] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [barcode, setBarcode] = useState('');
  const [senderPoint, setSenderPoint] = useState('');
  const [receiverPoint, setReceiverPoint] = useState('');
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState('');
  const [expectedPayout, setExpectedPayout] = useState('');
  const [marketplaceCommission, setMarketplaceCommission] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [comment, setComment] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const isManager = user?.role === 'MANAGER';

  const load = async () => {
    try {
      const [clientsRes, productsRes] = await Promise.all([
        fetchWithAuth('/api/clients?limit=500'),
        fetchWithAuth('/api/products?isArchived=false&orderable=true&limit=500'),
      ]);

      const clientsList = Array.isArray(clientsRes) ? clientsRes : (clientsRes?.items || []);
      setClients(clientsList);

      const productsList: Product[] = Array.isArray(productsRes) ? productsRes : (productsRes?.items || []);
      setProducts(productsList.filter(isProductOrderable));
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('Ошибка загрузки данных');
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addProduct = (pid: number) => {
    const p = products.find((x) => x.id === pid);
    if (!p) return;

    const existingItem = items.find((i) => i.productId === p.id);
    if (existingItem) {
      const newItems = [...items];
      existingItem.qty += 1;
      setItems(newItems);
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          qty: 1,
          salePrice: Number(p.price),
          cost: Number(p.costPrice || 0),
        },
      ]);
    }
  };

  const totals = useMemo(() => {
    const sum = items.reduce((s, i) => s + i.salePrice * i.qty, 0);
    const cost = items.reduce((s, i) => s + i.cost * i.qty, 0);
    const profit = sum - cost;
    return { sum, cost, profit };
  }, [items]);

  const save = async () => {
    if (!clientId || items.length === 0) {
      toast.error('Выберите клиента и добавьте товары');
      return;
    }

    setLoading(true);

    const body = {
      clientId,
      paymentMethod,
      salesChannel,
      fulfillmentMethod,
      settlementStatus:
        fulfillmentMethod === 'TRANSPORT_COMPANY' ? 'AWAITING_CUSTOMER_RECEIPT' : 'NOT_REQUIRED',
      expectedPayout: expectedPayout || undefined,
      marketplaceCommission: marketplaceCommission || undefined,
      shipment:
        fulfillmentMethod === 'TRANSPORT_COMPANY'
          ? {
              carrier,
              externalOrderNumber: externalOrderNumber || undefined,
              trackingNumber: trackingNumber || undefined,
              barcode: barcode || undefined,
              senderPoint: senderPoint || undefined,
              receiverPoint: receiverPoint || undefined,
              expectedDeliveryAt: expectedDeliveryAt || undefined,
              customerNote: customerNote || undefined,
              managerComment: comment || undefined,
            }
          : undefined,
      comment: comment || undefined,
      items: items.map((i) => ({
        productId: i.productId,
        qty: i.qty,
        salePrice: i.salePrice,
      })),
    };

    try {
      const response = await fetchWithAuth('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      console.log('Order created:', response);
      toast.success('Заказ успешно создан');
      router.push('/orders');
    } catch (e: any) {
      console.error('Error creating order:', e);
      toast.error(e?.message || 'Ошибка создания заказа');
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-slate-400">Загрузка данных...</div>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
      <div className="space-y-6 pb-6">
        {/* ===== HEADER ===== */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.back()}
            className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 transition md:hidden"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div>
            <h1 className="text-3xl font-bold text-white">Создание заказа</h1>
            <p className="text-slate-400 text-sm mt-1">Добавьте товары и создайте новый заказ</p>
          </div>
        </motion.div>

        {/* ===== CLIENT & PAYMENT ===== */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass p-6 rounded-xl space-y-4"
        >
          <h2 className="text-lg font-bold text-white">Основная информация</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-300 mb-2 block font-bold">Клиент *</label>
              <select
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:ring-2 focus:ring-cyan-500/50 transition"
                value={clientId}
                onChange={(e) => setClientId(Number(e.target.value))}
              >
                <option value={0}>— выберите клиента —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-2 block font-bold">Способ оплаты</label>
              <select
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:ring-2 focus:ring-cyan-500/50 transition"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
              >
                <option value="CASH">Наличные</option>
                <option value="TRANSFER">Банковский перевод</option>
                <option value="TRADE_IN">Trade-In</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-2 block font-bold">Примечание</label>
              <input
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/50 transition"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Дополнительная информация..."
              />
            </div>
          </div>
        </motion.div>

        {/* ===== FULFILLMENT ===== */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass p-6 rounded-xl space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-400/30">
              <Truck className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Исполнение заказа</h2>
              <p className="text-sm text-slate-400">Локальная доставка или отправка через транспортную компанию</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-300 mb-2 block font-bold">Канал продажи</label>
              <select
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:ring-2 focus:ring-cyan-500/50 transition"
                value={salesChannel}
                onChange={(e) => setSalesChannel(e.target.value)}
              >
                {salesChannelOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-2 block font-bold">Способ исполнения</label>
              <select
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:ring-2 focus:ring-cyan-500/50 transition"
                value={fulfillmentMethod}
                onChange={(e) => setFulfillmentMethod(e.target.value as any)}
              >
                <option value="LOCAL_DELIVERY">Локальная доставка</option>
                <option value="TRANSPORT_COMPANY">Транспортная компания</option>
              </select>
            </div>

            {fulfillmentMethod === 'TRANSPORT_COMPANY' && (
              <div>
                <label className="text-sm text-slate-300 mb-2 block font-bold">Служба доставки</label>
                <select
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:ring-2 focus:ring-cyan-500/50 transition"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                >
                  {carrierOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {fulfillmentMethod === 'TRANSPORT_COMPANY' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="text-sm text-slate-300 mb-2 block font-bold">Номер заказа площадки</label>
                <input
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/50 transition"
                  value={externalOrderNumber}
                  onChange={(e) => setExternalOrderNumber(e.target.value)}
                  placeholder="Avito / Ozon номер"
                />
                {salesChannel === 'AVITO' && externalOrderNumber.trim() ? (
                  <p className="mt-2 text-xs leading-5 text-cyan-200/80">
                    Если подключён аккаунт Avito, фоновая синхронизация сможет подтянуть официальный код отправки и ПВЗ по этому номеру заказа.
                  </p>
                ) : null}
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-2 block font-bold">Номер отправления</label>
                <input
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/50 transition"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Трек / номер накладной"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-2 block font-bold">Штрихкод отправки</label>
                <input
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/50 transition"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Только для менеджера"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Вставляйте сюда официальный код площадки, если он уже известен. Если поле пустое, CRM построит внутренний сканируемый код по номеру отправления.
                </p>
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-2 block font-bold">Пункт отправки</label>
                <input
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/50 transition"
                  value={senderPoint}
                  onChange={(e) => setSenderPoint(e.target.value)}
                  placeholder="Куда отнести товар"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-2 block font-bold">Пункт получения</label>
                <input
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/50 transition"
                  value={receiverPoint}
                  onChange={(e) => setReceiverPoint(e.target.value)}
                  placeholder="Текстом для клиента"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-2 block font-bold">Ожидаемая дата доставки</label>
                <input
                  type="date"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:ring-2 focus:ring-cyan-500/50 transition"
                  value={expectedDeliveryAt}
                  onChange={(e) => setExpectedDeliveryAt(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-2 block font-bold">Ожидаемое поступление</label>
                <input
                  type="number"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/50 transition"
                  value={expectedPayout}
                  onChange={(e) => setExpectedPayout(e.target.value)}
                  placeholder="Сумма после получения"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-2 block font-bold">Комиссия площадки</label>
                <input
                  type="number"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/50 transition"
                  value={marketplaceCommission}
                  onChange={(e) => setMarketplaceCommission(e.target.value)}
                  placeholder="Если известна"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-2 block font-bold">Комментарий для клиента</label>
                <input
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500/50 transition"
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Покажем в личном кабинете"
                />
              </div>
            </div>
          )}

          {fulfillmentMethod === 'TRANSPORT_COMPANY' &&
          (barcode.trim() || trackingNumber.trim() || externalOrderNumber.trim()) ? (
            <div className="pt-2">
              <ShipmentDispatchCodeCard
                barcode={barcode}
                trackingNumber={trackingNumber}
                externalOrderNumber={externalOrderNumber}
                senderPoint={senderPoint}
                receiverPoint={receiverPoint}
                compact
              />
            </div>
          ) : null}
        </motion.div>

        {/* ===== ADD PRODUCT ===== */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass p-6 rounded-xl"
        >
          <h2 className="text-lg font-bold text-white mb-4">Добавить товары</h2>

          <select
            className="w-full px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:ring-2 focus:ring-cyan-500/50 transition"
            onChange={(e) => {
              if (e.target.value) {
                addProduct(Number(e.target.value));
              }
              e.target.value = '0';
            }}
          >
            <option value="0">— выберите товар —</option>
            {products
              .filter((p) => p.isActive && p.stock > 0)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (остаток: {p.stock}) - {p.price.toLocaleString()} ₽
                </option>
              ))}
          </select>
        </motion.div>

        {/* ===== DESKTOP TABLE ===== */}
        <div className="hidden md:block glass p-6 rounded-xl">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-slate-700" />
              <div className="text-slate-400">Добавьте товары в заказ</div>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-slate-400 text-sm border-b border-slate-700/50">
                    <th className="text-left p-3">Наименование</th>
                    <th className="text-right p-3">Количество</th>
                    <th className="text-right p-3">Цена за единицу</th>
                    <th className="text-right p-3">Сумма</th>
                    <th className="text-right p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <motion.tr
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="border-t border-slate-700/50 hover:bg-slate-800/30 transition"
                    >
                      <td className="p-3 text-white font-medium">{it.name}</td>
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          min={1}
                          className="w-20 text-right px-2 py-1 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white"
                          value={it.qty}
                          onChange={(e) => {
                            const v = Math.max(1, Number(e.target.value));
                            const arr = [...items];
                            arr[idx].qty = v;
                            setItems(arr);
                          }}
                        />
                      </td>
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          className="w-32 text-right px-2 py-1 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white"
                          value={it.salePrice}
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value));
                            const arr = [...items];
                            arr[idx].salePrice = v;
                            setItems(arr);
                          }}
                        />
                      </td>
                      <td className="p-3 text-right font-bold text-cyan-400">
                        {(it.salePrice * it.qty).toLocaleString()} ₽
                      </td>
                      <td className="p-3 text-right">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 transition"
                          onClick={() => {
                            const arr = [...items];
                            arr.splice(idx, 1);
                            setItems(arr);
                          }}
                        >
                          <Trash className="w-4 h-4 text-rose-400" />
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ===== MOBILE PRODUCT LIST ===== */}
        <div className="md:hidden space-y-3">
          <AnimatePresence mode="popLayout">
            {items.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass p-8 text-center rounded-xl"
              >
                <Plus className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <div className="text-slate-400">Добавьте товары в заказ</div>
              </motion.div>
            ) : (
              items.map((it, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="glass p-4 rounded-xl"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-bold text-white">{it.name}</div>
                      {!isManager ? (
                        <div className="text-xs text-slate-500 mt-0.5">
                          Себестоимость: {it.cost.toLocaleString()} ₽
                        </div>
                      ) : null}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 transition"
                      onClick={() => {
                        const arr = [...items];
                        arr.splice(idx, 1);
                        setItems(arr);
                      }}
                    >
                      <Trash className="w-4 h-4 text-rose-400" />
                    </motion.button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block font-bold">Количество</label>
                      <input
                        type="number"
                        min={1}
                        className="w-full text-center px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white"
                        value={it.qty}
                        onChange={(e) => {
                          const v = Math.max(1, Number(e.target.value));
                          const arr = [...items];
                          arr[idx].qty = v;
                          setItems(arr);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block font-bold">Цена (₽)</label>
                      <input
                        type="number"
                        className="w-full text-right px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white"
                        value={it.salePrice}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value));
                          const arr = [...items];
                          arr[idx].salePrice = v;
                          setItems(arr);
                        }}
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-700/50 flex justify-between items-center">
                    <span className="text-sm text-slate-400">Сумма:</span>
                    <span className="text-lg font-bold text-cyan-400">
                      {(it.salePrice * it.qty).toLocaleString()} ₽
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* ===== TOTAL & SAVE ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-6 rounded-xl border border-slate-700/50 backdrop-blur-xl"
        >
          {isManager ? (
            <div className="mb-4 pb-4 border-b border-slate-700/50">
              <div className="text-sm text-slate-400">Итого к оплате</div>
              <div className="text-2xl font-bold text-cyan-400 mt-1">
                {totals.sum.toLocaleString()} ₽
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pb-4 border-b border-slate-700/50">
              <div>
                <div className="text-sm text-slate-400">Себестоимость</div>
                <div className="text-xl font-bold text-slate-300 mt-1">
                  {totals.cost.toLocaleString()} ₽
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Итого к оплате</div>
                <div className="text-xl font-bold text-cyan-400 mt-1">
                  {totals.sum.toLocaleString()} ₽
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-400">Прибыль</div>
                <div className={`text-xl font-bold mt-1 ${totals.profit > 0 ? 'text-green-400' : 'text-rose-400'}`}>
                  {totals.profit.toLocaleString()} ₽
                </div>
              </div>
            </div>
          )}

          <button
            className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold transition text-base disabled:opacity-50 shadow-lg shadow-cyan-500/30"
            onClick={save}
            disabled={!clientId || items.length === 0 || loading}
          >
            {loading ? 'Создание заказа...' : 'Создать заказ'}
          </button>
        </motion.div>
      </div>
    </ProtectedRoute>
  );
}
