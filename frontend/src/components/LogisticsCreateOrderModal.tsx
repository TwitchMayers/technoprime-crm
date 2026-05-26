'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LoaderCircle, Plus, Search, Sparkles, Trash2, Truck, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import ShipmentDispatchCodeCard from '@/components/ShipmentDispatchCodeCard';
import { carrierLabels, formatRuDate, shipmentStatusLabels } from '@/lib/logistics-ui';
import { useAuth } from '@/contexts/AuthContext';

type Client = {
  id: number;
  name: string;
  phone?: string | null;
  city?: string | null;
};

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

type OrderItemDraft = {
  productId: number;
  name: string;
  qty: number;
  salePrice: number;
  cost: number;
};

type ShipmentMatch = {
  id: number;
  carrier: string;
  status: string;
  syncMode?: string | null;
  externalOrderNumber?: string | null;
  trackingNumber?: string | null;
  barcode?: string | null;
  senderPoint?: string | null;
  receiverPoint?: string | null;
  expectedDeliveryAt?: string | null;
  lastSyncedAt?: string | null;
  managerComment?: string | null;
  order: {
    id: number;
    client?: { id: number; name: string; phone?: string | null; city?: string | null } | null;
    items?: Array<{
      product?: { name?: string | null } | null;
    }>;
  };
};

type ExternalTrackingData = {
  provider: 'TRACKTRY' | 'HEURISTIC';
  reference: string;
  carrierHint?: string | null;
  carrier: string;
  statusBucket: string;
  status: string;
  statusLabel?: string | null;
  senderPoint?: string | null;
  receiverPoint?: string | null;
  expectedDeliveryAt?: string | null;
  events?: Array<{
    at: string;
    status: string;
    location?: string | null;
    details?: string | null;
  }>;
  needsManualVerification?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (shipment?: ShipmentMatch | null) => void;
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

function productTitle(shipment?: ShipmentMatch | null) {
  return shipment?.order.items?.[0]?.product?.name || shipment?.managerComment || 'Отправление';
}

export default function LogisticsCreateOrderModal({ open, onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const lastResolvedKeyRef = useRef('');

  const [clientId, setClientId] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'TRADE_IN'>('TRANSFER');
  const [salesChannel, setSalesChannel] = useState('AVITO');
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
  const [items, setItems] = useState<OrderItemDraft[]>([]);
  const [matchedShipment, setMatchedShipment] = useState<ShipmentMatch | null>(null);
  const [externalTracking, setExternalTracking] = useState<ExternalTrackingData | null>(null);
  const [resolveMessage, setResolveMessage] = useState<string | null>(null);
  const isAvitoFlow = salesChannel === 'AVITO' || carrier.startsWith('AVITO_');
  const isManager = user?.role === 'MANAGER';

  const resetForm = () => {
    setClientId(0);
    setPaymentMethod('TRANSFER');
    setSalesChannel('AVITO');
    setCarrier('AVITO_DELIVERY');
    setExternalOrderNumber('');
    setTrackingNumber('');
    setBarcode('');
    setSenderPoint('');
    setReceiverPoint('');
    setExpectedDeliveryAt('');
    setExpectedPayout('');
    setMarketplaceCommission('');
    setCustomerNote('');
    setComment('');
    setItems([]);
    setMatchedShipment(null);
    setExternalTracking(null);
    setResolveMessage(null);
    lastResolvedKeyRef.current = '';
  };

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    let cancelled = false;

    const loadReferenceData = async () => {
      setDataLoading(true);
      try {
        const [clientsRes, productsRes] = await Promise.all([
          fetchWithAuth('/api/clients?limit=500'),
          fetchWithAuth('/api/products?isArchived=false&orderable=true&limit=500'),
        ]);

        if (cancelled) return;

        setClients(Array.isArray(clientsRes) ? clientsRes : clientsRes?.items || []);
        const productsList: Product[] = Array.isArray(productsRes)
          ? productsRes
          : productsRes?.items || [];
        setProducts(productsList.filter(isProductOrderable));
      } catch (error: any) {
        if (!cancelled) {
          toast.error(error?.message || 'Не удалось загрузить клиентов и товары для логистики');
        }
      } finally {
        if (!cancelled) {
          setDataLoading(false);
        }
      }
    };

    void loadReferenceData();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const totals = useMemo(() => {
    const sum = items.reduce((acc, item) => acc + item.salePrice * item.qty, 0);
    return {
      sum,
      profit: items.reduce((acc, item) => acc + (item.salePrice - item.cost) * item.qty, 0),
    };
  }, [items]);

  const addProduct = (productId: number) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    setItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) =>
          item.productId === product.id ? { ...item, qty: item.qty + 1 } : item,
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          qty: 1,
          salePrice: Number(product.price),
          cost: Number(product.costPrice || 0),
        },
      ];
    });
  };

  const updateItem = (productId: number, patch: Partial<OrderItemDraft>) => {
    setItems((current) =>
      current.map((item) =>
        item.productId === productId
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    );
  };

  const removeItem = (productId: number) => {
    setItems((current) => current.filter((item) => item.productId !== productId));
  };

  const buildResolveKey = () =>
    [salesChannel, carrier, externalOrderNumber.trim(), trackingNumber.trim(), barcode.trim()].join('|');

  const resolveShipment = async (options?: { silent?: boolean }) => {
    const referencePresent =
      externalOrderNumber.trim() || trackingNumber.trim() || barcode.trim();
    if (!referencePresent) {
      setMatchedShipment(null);
      setExternalTracking(null);
      setResolveMessage(null);
      return null;
    }

    setResolving(true);
    try {
      const result = await fetchWithAuth('/api/logistics/resolve-shipment', {
        method: 'POST',
        body: JSON.stringify({
          salesChannel,
          carrier,
          externalOrderNumber: externalOrderNumber.trim() || undefined,
          trackingNumber: trackingNumber.trim() || undefined,
          barcode: barcode.trim() || undefined,
        }),
      });

      if (result?.shipment) {
        const shipment = result.shipment as ShipmentMatch;
        setMatchedShipment(shipment);
        setExternalTracking(null);
        setResolveMessage(
          result?.syncedAccounts
            ? `Найдено после синхронизации ${result.syncedAccounts} Avito-аккаунт(ов).`
            : 'Найдено в текущей базе CRM.',
        );
        setCarrier(shipment.carrier || carrier);
        setTrackingNumber((current) => current || shipment.trackingNumber || '');
        setBarcode((current) => current || shipment.barcode || '');
        setSenderPoint((current) => current || shipment.senderPoint || '');
        setReceiverPoint((current) => current || shipment.receiverPoint || '');
        setExpectedDeliveryAt((current) => {
          if (current) return current;
          return shipment.expectedDeliveryAt
            ? String(shipment.expectedDeliveryAt).slice(0, 10)
            : '';
        });
        if (!clientId && shipment.order.client?.id) {
          setClientId(shipment.order.client.id);
        }
        if (!options?.silent) {
          toast.success(`Найдено отправление #${shipment.id}`);
        }
      } else {
        setMatchedShipment(null);
        const external = result?.externalTracking as ExternalTrackingData | undefined;
        setExternalTracking(external || null);
        setResolveMessage(result?.message || 'Совпадение по номеру пока не найдено.');
        if (external) {
          setCarrier((current) => {
            if (current && current !== 'OTHER' && current !== 'AVITO_DELIVERY') return current;
            return external.carrier || current || 'OTHER';
          });
          setTrackingNumber((current) => current || external.reference || '');
          setBarcode((current) => current || external.reference || '');
          setSenderPoint((current) => current || external.senderPoint || '');
          setReceiverPoint((current) => current || external.receiverPoint || '');
          setExpectedDeliveryAt((current) => {
            if (current) return current;
            return external.expectedDeliveryAt ? String(external.expectedDeliveryAt).slice(0, 10) : '';
          });
        }
        if (!options?.silent && result?.message) {
          toast.message(result.message);
        }
      }

      return result?.shipment || null;
    } catch (error: any) {
      if (!options?.silent) {
        toast.error(error?.message || 'Не удалось подтянуть данные по номеру');
      }
      return null;
    } finally {
      setResolving(false);
    }
  };

  useEffect(() => {
    if (!open || !isAvitoFlow) return;

    const key = buildResolveKey();
    const hasReference = key.split('|').slice(2).some(Boolean);
    if (!hasReference || lastResolvedKeyRef.current === key) return;

    const timeoutId = window.setTimeout(() => {
      lastResolvedKeyRef.current = key;
      void resolveShipment({ silent: true });
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [barcode, carrier, externalOrderNumber, isAvitoFlow, open, salesChannel, trackingNumber]);

  const handleCreate = async () => {
    if (matchedShipment?.id) {
      onCreated?.(matchedShipment);
      onClose();
      return;
    }

    if (!clientId || !items.length) {
      toast.error('Выберите клиента и добавьте хотя бы один товар');
      return;
    }

    setSaving(true);
    try {
      const createdOrder = await fetchWithAuth('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          paymentMethod,
          salesChannel,
          fulfillmentMethod: 'TRANSPORT_COMPANY',
          settlementStatus: 'AWAITING_CUSTOMER_RECEIPT',
          expectedPayout: expectedPayout || undefined,
          marketplaceCommission: marketplaceCommission || undefined,
          comment: comment || undefined,
          shipment: {
            carrier,
            externalOrderNumber: externalOrderNumber || undefined,
            trackingNumber: trackingNumber || undefined,
            barcode: barcode || undefined,
            senderPoint: senderPoint || undefined,
            receiverPoint: receiverPoint || undefined,
            expectedDeliveryAt: expectedDeliveryAt || undefined,
            customerNote: customerNote || undefined,
            managerComment: comment || undefined,
          },
          items: items.map((item) => ({
            productId: item.productId,
            qty: item.qty,
            salePrice: item.salePrice,
          })),
        }),
      });

      let nextShipment: ShipmentMatch | null = null;

      if (isAvitoFlow && (externalOrderNumber || trackingNumber || barcode)) {
        nextShipment = await resolveShipment({ silent: true });
      }

      if (!nextShipment && createdOrder?.id) {
        const shipments = await fetchWithAuth('/api/logistics/shipments?limit=300');
        const rows = Array.isArray(shipments) ? shipments : [];
        nextShipment =
          rows.find((item: ShipmentMatch) => item.order?.id === createdOrder.id) || null;
      }

      toast.success('Логистический заказ создан');
      onCreated?.(nextShipment);
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось создать логистический заказ');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className="glass relative z-10 flex h-[100dvh] w-full max-w-full flex-col overflow-hidden border border-slate-700/70 sm:h-auto sm:max-h-[92dvh] sm:max-w-5xl sm:rounded-3xl"
        >
          <div className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-950/94 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.85rem)] backdrop-blur-xl sm:px-6 sm:pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100">
                  <Truck className="h-3.5 w-3.5" />
                  Логистический заказ
                </div>
                <h2 className="mt-3 text-lg font-bold text-white sm:text-2xl">Создать отправление прямо из логистики</h2>
                <p className="mt-1.5 max-w-3xl text-[12px] leading-5 text-slate-400 sm:text-sm sm:leading-6">
                  Для Avito-отправлений номер заказа или трек можно сразу использовать для автоматической подтяжки статуса, ПВЗ и официального кода отправки.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/60 px-3 text-xs font-semibold text-slate-300 transition hover:bg-slate-800/80 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-6 sm:pb-6">
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
              <div className="min-w-0 space-y-4">
                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/35 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <UserRound className="h-4 w-4 text-cyan-300" />
                    Клиент и параметры заказа
                  </div>

                  {dataLoading ? (
                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Загружаю клиентов и товары...
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-300">Клиент</label>
                        <select
                          value={clientId}
                          onChange={(event) => setClientId(Number(event.target.value))}
                          className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white"
                        >
                          <option value={0}>— выберите клиента —</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name} {client.phone ? `(${client.phone})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-300">Способ оплаты</label>
                        <select
                          value={paymentMethod}
                          onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}
                          className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white"
                        >
                          <option value="TRANSFER">Перевод</option>
                          <option value="CASH">Наличные</option>
                          <option value="TRADE_IN">Trade-In</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-300">Канал продажи</label>
                        <select
                          value={salesChannel}
                          onChange={(event) => setSalesChannel(event.target.value)}
                          className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white"
                        >
                          {salesChannelOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-300">Служба доставки</label>
                        <select
                          value={carrier}
                          onChange={(event) => setCarrier(event.target.value)}
                          className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white"
                        >
                          {carrierOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-bold text-slate-300">Комментарий менеджера</label>
                        <input
                          value={comment}
                          onChange={(event) => setComment(event.target.value)}
                          placeholder="Например: передать курьеру до 18:00"
                          className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/35 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Search className="h-4 w-4 text-cyan-300" />
                      Номер площадки и автоподтяжка
                    </div>

                    <button
                      type="button"
                      onClick={() => void resolveShipment()}
                      disabled={resolving || dataLoading}
                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-60"
                    >
                      {resolving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Подтянуть по номеру
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-300">Номер заказа площадки</label>
                      <input
                        value={externalOrderNumber}
                        onChange={(event) => {
                          setExternalOrderNumber(event.target.value);
                          setMatchedShipment(null);
                        }}
                        onBlur={() => {
                          if (isAvitoFlow && externalOrderNumber.trim()) {
                            void resolveShipment({ silent: true });
                          }
                        }}
                        placeholder="Avito номер заказа"
                        className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-300">Номер отправления</label>
                      <input
                        value={trackingNumber}
                        onChange={(event) => {
                          setTrackingNumber(event.target.value);
                          setMatchedShipment(null);
                        }}
                        onBlur={() => {
                          if (isAvitoFlow && trackingNumber.trim()) {
                            void resolveShipment({ silent: true });
                          }
                        }}
                        placeholder="Трек / накладная"
                        className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-300">Код отправки</label>
                      <input
                        value={barcode}
                        onChange={(event) => {
                          setBarcode(event.target.value);
                          setMatchedShipment(null);
                        }}
                        onBlur={() => {
                          if (isAvitoFlow && barcode.trim()) {
                            void resolveShipment({ silent: true });
                          }
                        }}
                        placeholder="Официальный код, если уже известен"
                        className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-300">Пункт отправки</label>
                      <input
                        value={senderPoint}
                        onChange={(event) => setSenderPoint(event.target.value)}
                        placeholder="Куда курьер относит посылку"
                        className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-300">Пункт получения</label>
                      <input
                        value={receiverPoint}
                        onChange={(event) => setReceiverPoint(event.target.value)}
                        placeholder="Автоподтянется, если площадка отдаёт ПВЗ"
                        className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-300">Ожидаемая дата доставки</label>
                      <input
                        type="date"
                        value={expectedDeliveryAt}
                        onChange={(event) => setExpectedDeliveryAt(event.target.value)}
                        className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-300">Ожидаемое поступление</label>
                      <input
                        type="number"
                        value={expectedPayout}
                        onChange={(event) => setExpectedPayout(event.target.value)}
                        placeholder="Сумма после получения"
                        className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-300">Комиссия площадки</label>
                      <input
                        type="number"
                        value={marketplaceCommission}
                        onChange={(event) => setMarketplaceCommission(event.target.value)}
                        placeholder="Если известна"
                        className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-bold text-slate-300">Комментарий для клиента</label>
                      <input
                        value={customerNote}
                        onChange={(event) => setCustomerNote(event.target.value)}
                        placeholder="Этот текст увидит клиент в личном кабинете"
                        className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  {resolveMessage ? (
                    <div className="mt-3 rounded-xl border border-slate-700/60 bg-slate-950/35 px-3 py-2 text-xs leading-5 text-slate-300">
                      {resolveMessage}
                    </div>
                  ) : null}

                  {externalTracking ? (
                    <div
                      className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-5 ${
                        externalTracking.needsManualVerification
                          ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
                          : 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100'
                      }`}
                    >
                      <div className="font-semibold">
                        Внешний трекинг: {externalTracking.carrierHint || 'перевозчик определён'}
                      </div>
                      <div className="mt-1">
                        Статус: {shipmentStatusLabels[externalTracking.status] || externalTracking.statusLabel || externalTracking.status}
                      </div>
                      {externalTracking.receiverPoint ? <div>Пункт получения: {externalTracking.receiverPoint}</div> : null}
                      {externalTracking.expectedDeliveryAt ? (
                        <div>ETA: {formatRuDate(externalTracking.expectedDeliveryAt)}</div>
                      ) : null}
                      {externalTracking.needsManualVerification ? (
                        <div className="mt-1">
                          По этому номеру часть данных определена эвристически. Детали отправки НУЖНО ПОДТВЕРДИТЬ перед сдачей.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs leading-5 text-cyan-100">
                      Если отправление не найдено в CRM, система пытается определить перевозчика и статусы по номеру через внешний трекинг. Если внешний источник ничего не вернул, поля остаются ручными.
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/35 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Plus className="h-4 w-4 text-cyan-300" />
                    Товары в отправлении
                  </div>

                  <div className="mt-4">
                    <select
                      defaultValue="0"
                      onChange={(event) => {
                        const productId = Number(event.target.value);
                        if (productId > 0) {
                          addProduct(productId);
                        }
                        event.target.value = '0';
                      }}
                      className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white"
                    >
                      <option value="0">— добавить товар в логистический заказ —</option>
                      {products
                        .filter((product) => product.isActive !== false)
                        .map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} · остаток {product.stock} · {Number(product.price).toLocaleString('ru-RU')} ₽
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="mt-3 space-y-3">
                    {items.length ? (
                      items.map((item) => (
                        <div key={item.productId} className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white">{item.name}</div>
                              {!isManager ? (
                                <div className="mt-1 text-xs text-slate-500">Себестоимость: {Number(item.cost).toLocaleString('ru-RU')} ₽</div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(item.productId)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/10 text-rose-100 transition hover:bg-rose-500/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Количество</label>
                              <input
                                type="number"
                                min={1}
                                value={item.qty}
                                onChange={(event) =>
                                  updateItem(item.productId, { qty: Math.max(1, Number(event.target.value || 1)) })
                                }
                                className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white"
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Цена продажи</label>
                              <input
                                type="number"
                                min={0}
                                value={item.salePrice}
                                onChange={(event) =>
                                  updateItem(item.productId, { salePrice: Number(event.target.value || 0) })
                                }
                                className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 px-4 py-3 text-sm text-slate-400">
                        Добавьте хотя бы один товар, чтобы создать логистический заказ.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="min-w-0 space-y-4">
                <ShipmentDispatchCodeCard
                  barcode={barcode}
                  trackingNumber={trackingNumber}
                  externalOrderNumber={externalOrderNumber}
                  senderPoint={senderPoint}
                  receiverPoint={receiverPoint}
                  compact
                />

                {matchedShipment ? (
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                    <div className="text-sm font-semibold text-emerald-100">Найдено существующее отправление</div>
                    <div className="mt-2 text-sm text-white">
                      Заказ #{matchedShipment.order.id} · {productTitle(matchedShipment)}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-emerald-50/85">
                      {carrierLabels[matchedShipment.carrier] || matchedShipment.carrier} · {shipmentStatusLabels[matchedShipment.status] || matchedShipment.status}
                      {matchedShipment.receiverPoint ? ` · ${matchedShipment.receiverPoint}` : ''}
                      {matchedShipment.expectedDeliveryAt ? ` · ETA ${formatRuDate(matchedShipment.expectedDeliveryAt)}` : ''}
                    </div>
                    <div className="mt-3 text-xs leading-5 text-emerald-50/85">
                      Новый дубликат создавать не нужно. Можно сразу открыть найденное отправление.
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/35 p-4">
                  <div className="text-sm font-semibold text-white">Итоги</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <span>Товаров</span>
                      <span className="font-semibold text-white">{items.reduce((acc, item) => acc + item.qty, 0)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Сумма заказа</span>
                      <span className="font-semibold text-white">{totals.sum.toLocaleString('ru-RU')} ₽</span>
                    </div>
                    {!isManager ? (
                      <div className="flex items-center justify-between gap-3">
                        <span>Ориентировочная маржа</span>
                        <span className="font-semibold text-white">{totals.profit.toLocaleString('ru-RU')} ₽</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCreate()}
                    disabled={saving || dataLoading}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-purple-500 hover:to-teal-500 disabled:opacity-60"
                  >
                    {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                    {matchedShipment ? 'Открыть найденное отправление' : 'Создать логистический заказ'}
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/55 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800/80"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
