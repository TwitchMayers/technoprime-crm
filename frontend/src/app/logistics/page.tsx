'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Link2,
  PackageCheck,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import LogisticsCreateOrderModal from '@/components/LogisticsCreateOrderModal';
import ProtectedRoute from '@/components/ProtectedRoute';
import MobilePageHeader from '@/components/MobilePageHeader';
import ShipmentDispatchCodeCard from '@/components/ShipmentDispatchCodeCard';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { usePageActivity } from '@/hooks/usePageActivity';
import { useAuth } from '@/contexts/AuthContext';
import {
  carrierLabels,
  formatRuDate,
  formatRuDateTime,
  integrationHealthTone,
  logisticsKpis,
  providerMeta,
  settlementStatusLabels,
  settlementTone,
  shipmentPlatformFromCarrier,
  shipmentStatusLabels,
  shipmentStatusTone,
} from '@/lib/logistics-ui';

type Shipment = {
  id: number;
  carrier: string;
  status: string;
  syncMode?: string;
  externalOrderNumber?: string | null;
  trackingNumber?: string | null;
  barcode?: string | null;
  lastSyncedAt?: string | null;
  senderPoint?: string | null;
  receiverPoint?: string | null;
  expectedDeliveryAt?: string | null;
  handedOverAt?: string | null;
  arrivedAt?: string | null;
  receivedAt?: string | null;
  returnedAt?: string | null;
  customerNote?: string | null;
  managerComment?: string | null;
  updatedAt?: string;
  order: {
    id: number;
    status: string;
    salesChannel: string;
    settlementStatus: string;
    comment?: string | null;
    expectedPayout?: string | number | null;
    actualPayout?: string | number | null;
    client?: { id: number; name: string; phone?: string | null; city?: string | null } | null;
    items?: Array<{
      product?: { name?: string | null } | null;
      inventoryUnits?: Array<{ serialNumber?: string | null; status?: string | null }>;
    }>;
  };
  events?: Array<{ id: number; title: string; status: string; createdAt: string; comment?: string | null; source?: string }>;
};

type IntegrationOverview = {
  id: number;
  platform: keyof typeof providerMeta;
  displayName: string;
  authType: string;
  status: string;
  externalAccountId?: string | null;
  expiresAt?: string | null;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  updatedAt: string;
};

const tabs = [
  { key: 'all', label: 'Все', statuses: [] as string[] },
  { key: 'handover', label: 'Ожидают передачи', statuses: ['AWAITING_SHIPMENT_DATA', 'READY_FOR_HANDOVER'] },
  { key: 'transit', label: 'В пути', statuses: ['HANDED_TO_CARRIER', 'IN_TRANSIT'] },
  { key: 'pickup', label: 'Ожидают получения', statuses: ['ARRIVED_AT_PICKUP_POINT', 'AWAITING_CUSTOMER_PICKUP'] },
  { key: 'funds', label: 'Ожидание поступления средств', statuses: ['RECEIVED_BY_CUSTOMER'] },
  { key: 'returns', label: 'Возвраты', statuses: ['RETURN_IN_TRANSIT', 'RETURNED_TO_SELLER'] },
  { key: 'issues', label: 'Проблемные', statuses: ['DELIVERY_ISSUE'] },
  { key: 'archive', label: 'Архив', statuses: [] as string[] },
];

function statusOptions(shipment: Shipment) {
  const base = [
    'READY_FOR_HANDOVER',
    'HANDED_TO_CARRIER',
    'IN_TRANSIT',
    'ARRIVED_AT_PICKUP_POINT',
    'AWAITING_CUSTOMER_PICKUP',
    'RECEIVED_BY_CUSTOMER',
    'RETURN_IN_TRANSIT',
    'RETURNED_TO_SELLER',
    'DELIVERY_ISSUE',
  ];

  if (shipment.status === 'RETURNED_TO_SELLER') {
    return ['RETURNED_TO_SELLER'];
  }

  return base;
}

function productTitle(shipment: Shipment) {
  return shipment.order.items?.[0]?.product?.name || shipment.order.comment || shipment.managerComment || 'Товар';
}

function serialNumber(shipment: Shipment) {
  return shipment.order.items?.[0]?.inventoryUnits?.find((unit) => unit.serialNumber)?.serialNumber || '—';
}

function isArchivedShipment(shipment: Shipment) {
  return ['COMPLETED', 'RETURNED', 'CANCELED'].includes(String(shipment.order?.status || '').toUpperCase());
}

function ShipmentMetaField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-700/60 bg-slate-950/35 p-2.5 sm:p-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs">{label}</div>
      <div className={`mt-1.5 break-words text-[13px] text-white sm:mt-2 sm:text-sm ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </div>
    </div>
  );
}

export default function LogisticsPage() {
  const { user } = useAuth();
  const isPageActive = usePageActivity();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState<number | null>(null);
  const [autoSyncDone, setAutoSyncDone] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [actualPayout, setActualPayout] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const canManageIntegrations = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const load = async () => {
    try {
      const [shipmentsData, integrationsData] = await Promise.all([
        fetchWithAuth('/api/logistics/shipments?limit=300'),
        canManageIntegrations
          ? fetchWithAuth('/api/logistics/marketplace-accounts/overview').catch(() => ({
              items: [],
              total: 0,
              success: false,
            }))
          : Promise.resolve([]),
      ]);
      const nextShipments = Array.isArray(shipmentsData) ? shipmentsData : [];
      const nextIntegrations = Array.isArray(integrationsData)
        ? integrationsData
        : Array.isArray(integrationsData?.items)
          ? integrationsData.items
          : [];
      setShipments(nextShipments);
      setIntegrations(nextIntegrations);
      return { shipments: nextShipments as Shipment[], integrations: nextIntegrations as IntegrationOverview[] };
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось загрузить логистику');
      return { shipments: [] as Shipment[], integrations: [] as IntegrationOverview[] };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [canManageIntegrations]);

  useEffect(() => {
    if (!isPageActive) return undefined;

    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        void load();
      }
    }, 60_000);

    const handleFocus = () => {
      void load();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handleFocus);
    void load();

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handleFocus);
    };
  }, [isPageActive]);

  useEffect(() => {
    if (loading || autoSyncDone || refreshing || syncingAccountId || !canManageIntegrations) return;

    const needsBootstrapSync = integrations.some((account) => {
      if (account.status !== 'CONNECTED' || account.lastSyncError) return false;
      return !shipments.some(
        (shipment) => shipmentPlatformFromCarrier(shipment.carrier) === account.platform,
      );
    });

    if (!needsBootstrapSync) return;

    setAutoSyncDone(true);
    void refreshLogistics();
  }, [autoSyncDone, canManageIntegrations, integrations, loading, refreshing, shipments, syncingAccountId]);

  const integrationMap = useMemo(() => {
    const map = new Map<string, IntegrationOverview>();
    for (const account of integrations) {
      if (!map.has(account.platform)) {
        map.set(account.platform, account);
      }
    }
    return map;
  }, [integrations]);

  const integrationGroups = useMemo(() => {
    const map = new Map<string, IntegrationOverview[]>();
    for (const account of integrations) {
      const current = map.get(account.platform) || [];
      current.push(account);
      map.set(account.platform, current);
    }
    return map;
  }, [integrations]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const active = tabs.find((item) => item.key === activeTab);

    return shipments.filter((shipment) => {
      const archived = isArchivedShipment(shipment);

      if (activeTab === 'archive') {
        if (!archived) return false;
      } else if (archived) {
        return false;
      }

      if (active && active.statuses.length && !active.statuses.includes(shipment.status)) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        String(shipment.order.id),
        productTitle(shipment),
        shipment.order.client?.name,
        shipment.order.client?.phone,
        shipment.externalOrderNumber,
        shipment.trackingNumber,
        shipment.barcode,
        shipment.senderPoint,
        shipment.receiverPoint,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [activeTab, search, shipments]);

  const stats = useMemo(() => {
    const activeShipments = shipments.filter((item) => !isArchivedShipment(item));
    const values = {
      handover: activeShipments.filter((item) => ['AWAITING_SHIPMENT_DATA', 'READY_FOR_HANDOVER'].includes(item.status)).length,
      transit: activeShipments.filter((item) => ['HANDED_TO_CARRIER', 'IN_TRANSIT'].includes(item.status)).length,
      pickup: activeShipments.filter((item) => ['ARRIVED_AT_PICKUP_POINT', 'AWAITING_CUSTOMER_PICKUP'].includes(item.status)).length,
      returns: activeShipments.filter((item) => ['RETURN_IN_TRANSIT', 'RETURNED_TO_SELLER'].includes(item.status)).length,
      eta: activeShipments.filter((item) => Boolean(item.expectedDeliveryAt)).length,
    };

    return values;
  }, [shipments]);

  const openShipment = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setActualPayout(shipment.order.actualPayout ? String(shipment.order.actualPayout) : '');
  };

  const syncMarketplaceAccount = async (
    account: IntegrationOverview,
    options?: { silentSuccess?: boolean },
  ) => {
    setSyncingAccountId(account.id);
    try {
      const result = await fetchWithAuth(`/api/logistics/marketplace-accounts/${account.id}/sync`, {
        method: 'POST',
      });
      if (!options?.silentSuccess) {
        const fetched = Number(result?.fetched || 0);
        const imported = Number(result?.imported || 0);
        const updated = Number(result?.updated || 0);
        toast.success(
          `${providerMeta[account.platform].shortLabel}: синхронизировано ${fetched} заказов, новых ${imported}, обновлено ${updated}`,
        );
      }
      return true;
    } catch (error: any) {
      toast.error(error?.message || `Не удалось синхронизировать ${providerMeta[account.platform].shortLabel}`);
      return false;
    } finally {
      setSyncingAccountId((current) => (current === account.id ? null : current));
    }
  };

  const refreshLogistics = async () => {
    setRefreshing(true);
    try {
      const connectedAccounts = canManageIntegrations
        ? integrations.filter((item) => item.status === 'CONNECTED')
        : [];
      if (canManageIntegrations) {
        for (const account of connectedAccounts) {
          await syncMarketplaceAccount(account, { silentSuccess: true });
        }
      }
      await load();
      toast.success(connectedAccounts.length ? 'Логистика и статусы площадок обновлены' : 'Логистика обновлена');
    } finally {
      setRefreshing(false);
    }
  };

  const reloadAndRefreshModal = async (shipmentId?: number) => {
    const snapshot = await load();
    if (shipmentId) {
      const next = snapshot.shipments.find((item) => item.id === shipmentId);
      if (next) {
        setSelectedShipment(next);
        return;
      }
      try {
        const fresh = await fetchWithAuth(`/api/logistics/shipments/${shipmentId}`);
        setSelectedShipment(fresh || null);
      } catch {
        setSelectedShipment(null);
      }
    } else {
      setSelectedShipment(null);
    }
  };

  const handleCreatedFromLogistics = (shipment?: { id: number } | null) => {
    setCreateModalOpen(false);
    void (async () => {
      const snapshot = await load();
      if (!shipment?.id) {
        return;
      }

      const fresh =
        snapshot.shipments.find((item) => item.id === shipment.id) ||
        (await fetchWithAuth(`/api/logistics/shipments/${shipment.id}`).catch(() => null));

      if (fresh) {
        setActiveTab('all');
        setSearch('');
        openShipment(fresh as Shipment);
      }
    })();
  };

  const updateShipmentStatus = async (shipment: Shipment, status: string) => {
    try {
      await fetchWithAuth(`/api/logistics/shipments/${shipment.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      toast.success('Статус доставки обновлён');
      await load();
      if (selectedShipment?.id === shipment.id) {
        const fresh = await fetchWithAuth(`/api/logistics/shipments/${shipment.id}`);
        setSelectedShipment(fresh);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось обновить статус');
    }
  };

  const markFundsReceived = async (shipment: Shipment) => {
    try {
      await fetchWithAuth(`/api/logistics/shipments/${shipment.id}/funds-received`, {
        method: 'POST',
        body: JSON.stringify({ actualPayout: actualPayout || undefined }),
      });
      toast.success('Поступление средств подтверждено');
      await reloadAndRefreshModal();
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось подтвердить поступление средств');
    }
  };

  const createLink = async (orderId: number) => {
    try {
      const data = await fetchWithAuth(`/api/logistics/orders/${orderId}/link-token`, {
        method: 'POST',
      });
      await navigator.clipboard.writeText(data.url);
      toast.success('Одноразовая ссылка для привязки заказа скопирована');
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось создать ссылку');
    }
  };

  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'SUPER_ADMIN']}>
      <div className="space-y-3 overflow-x-hidden pb-10 md:space-y-6">
        <MobilePageHeader
          title="Логистика"
          subtitle="Активные отправления и статусы площадок"
          action={
            <button
              onClick={() => void refreshLogistics()}
              disabled={refreshing}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/70 text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
              type="button"
              aria-label="Обновить логистику"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          }
        />

        <div className="md:hidden">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-purple-500 hover:to-teal-500"
            type="button"
          >
            <Plus className="h-4 w-4" />
            Создать логистический заказ
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          className="hidden md:flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-cyan-100">
              <Truck className="h-4 w-4" />
              Логистика
            </div>
            <h1 className="mt-3 text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-teal-400 bg-clip-text text-transparent">
              Доставка и движение отправлений
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Заказы с доставкой, контроль передачи в службу, движение до клиента и этап
              <span className="text-slate-300"> «Ожидание поступления средств»</span> после получения.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              type="button"
            >
              <Plus className="h-4 w-4" />
              Создать заказ логистики
            </button>

            <button
              onClick={() => void refreshLogistics()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-teal-600 px-4 py-2.5 font-semibold text-white transition hover:from-purple-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Синхронизирую площадки...' : 'Обновить логистику'}
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 gap-2.5 xl:grid-cols-5"
        >
          {logisticsKpis.map(({ key, label, icon: Icon, gradient }) => (
            <motion.div
              key={key}
              whileHover={{ y: -3 }}
              className="glass rounded-2xl border border-slate-700/60 p-2.5 sm:p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 sm:text-xs">{label}</div>
                  <div className="mt-1 text-lg font-bold text-white sm:mt-2 sm:text-2xl">
                    {stats[key as keyof typeof stats] ?? 0}
                  </div>
                </div>
                <div className={`rounded-xl bg-gradient-to-br ${gradient} p-2 text-white shadow-lg sm:p-3`}>
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="glass rounded-2xl border border-slate-700/70 p-3 sm:p-5"
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px] xl:items-start">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Статусы и ETA</div>
              <h2 className="mt-1.5 text-base font-bold text-white sm:mt-3 sm:text-xl">
                Активные отправления и архив логистики в одном разделе.
              </h2>
              <p className="mt-1.5 text-xs leading-5 text-slate-400 sm:mt-2 sm:text-sm sm:leading-6">
                Активные отправления остаются в рабочем потоке, а завершённые и отменённые автоматически уходят в архив.
              </p>
            </div>

            {canManageIntegrations ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {(Object.keys(providerMeta) as Array<keyof typeof providerMeta>).map((platform) => {
                  const accounts = integrationGroups.get(platform) || [];
                  const account = accounts[0];
                  return (
                    <div
                      key={platform}
                      className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-2.5 sm:px-4 sm:py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white sm:text-base">{providerMeta[platform].shortLabel}</div>
                          <div className="line-clamp-1 text-[11px] leading-4 text-slate-500 sm:text-xs sm:leading-5">
                            {accounts.length
                              ? accounts.length === 1
                                ? accounts[0].displayName
                                : `${accounts[0].displayName}${accounts.length > 1 ? ` и ещё ${accounts.length - 1}` : ''}`
                              : 'Площадка пока не подключена'}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] sm:px-3 sm:text-[11px] ${integrationHealthTone(
                              account?.status,
                              account?.lastSyncError,
                            )}`}
                          >
                            {account?.status === 'CONNECTED' ? 'Синхронизация' : 'Резервный режим'}
                          </span>
                          {account?.status === 'CONNECTED' ? (
                            <button
                              onClick={() => void syncMarketplaceAccount(account)}
                              disabled={syncingAccountId === account.id || refreshing}
                              className="rounded-lg border border-slate-600/70 bg-slate-900/55 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition hover:border-slate-500 hover:bg-slate-800/70 disabled:cursor-not-allowed disabled:opacity-70 sm:px-3 sm:text-[11px]"
                              type="button"
                            >
                              {syncingAccountId === account.id ? 'Синк...' : 'Синк'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {account?.lastSyncError ? (
                        <div className="mt-2.5 break-words rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[11px] leading-5 text-rose-100 sm:text-xs">
                          {account.lastSyncError}
                        </div>
                      ) : null}
                      {accounts.length > 1 ? (
                        <div className="mt-2 text-[11px] text-slate-500 sm:mt-3 sm:text-xs">Подключено аккаунтов: {accounts.length}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-3 text-xs leading-5 text-slate-400 sm:px-4 sm:text-sm">
                Блок управления площадками и авторизацией доступен только администратору.
              </div>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl border border-slate-700/70 p-2.5 sm:p-4"
        >
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск по заказу, клиенту, ПВЗ или треку"
                className="w-full rounded-xl border border-slate-600/60 bg-slate-900/60 py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 sm:text-base"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                    activeTab === tab.key
                      ? 'bg-gradient-to-r from-purple-600 to-teal-600 text-white shadow-lg'
                      : 'border border-slate-700/70 bg-slate-900/50 text-slate-300 hover:border-slate-600 hover:text-white'
                  }`}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </motion.section>

        {loading ? (
          <div className="glass rounded-2xl p-6 text-center text-sm text-slate-400 sm:p-12">Загрузка логистики...</div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-center text-sm text-slate-400 sm:p-12">
            {activeTab === 'archive'
              ? 'Архив логистики пока пуст.'
              : integrations.some((item) => item.lastSyncError)
              ? 'Отправления не появились, потому что одна из площадок вернула ошибку синхронизации. Деталь уже показана в блоке интеграций выше.'
              : 'В этой выборке пока нет отправлений.'}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-5">
            {filtered.map((shipment) => {
              const platform = shipmentPlatformFromCarrier(shipment.carrier);
              const integration = platform ? integrationMap.get(platform) : null;
              const events = shipment.events?.slice(0, 3) || [];

              return (
                <motion.article
                  key={shipment.id}
                  whileHover={{ y: -3 }}
                  className="glass overflow-hidden rounded-2xl border border-slate-700/70"
                >
                  <div className={`h-1 w-full bg-gradient-to-r ${platform ? providerMeta[platform].accent : 'from-slate-600 to-slate-700'}`} />

                  <div className="space-y-3.5 p-3 sm:p-4 lg:space-y-5 lg:p-5">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          <span className="rounded-full border border-slate-600/60 bg-slate-900/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-200 sm:px-3 sm:text-[11px]">
                            {carrierLabels[shipment.carrier] || shipment.carrier}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] sm:px-3 sm:text-[11px] ${shipmentStatusTone(shipment.status)}`}>
                            {shipmentStatusLabels[shipment.status] || shipment.status}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] sm:px-3 sm:text-[11px] ${settlementTone(shipment.order.settlementStatus)}`}>
                            {settlementStatusLabels[shipment.order.settlementStatus] || shipment.order.settlementStatus}
                          </span>
                          {isArchivedShipment(shipment) ? (
                            <span className="rounded-full border border-slate-600/60 bg-slate-900/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-200 sm:px-3 sm:text-[11px]">
                              Архив
                            </span>
                          ) : null}
                        </div>

                        <div>
                          <h2 className="text-lg font-bold text-white sm:text-xl lg:text-2xl">
                            Заказ #{shipment.order.id}
                          </h2>
                          <div className="mt-1 text-sm font-medium leading-5 text-slate-200 sm:text-base">
                            {productTitle(shipment)}
                          </div>
                          <div className="mt-1 text-[13px] leading-5 text-slate-400 sm:text-sm">
                            {shipment.order.client?.name || 'Клиент'}{shipment.order.client?.phone ? ` • ${shipment.order.client.phone}` : ''}{shipment.order.client?.city ? ` • ${shipment.order.client.city}` : ''}
                          </div>
                        </div>

                        <div className="grid gap-2.5 text-sm text-slate-300 sm:grid-cols-2 2xl:grid-cols-4">
                          <div className="rounded-xl border border-slate-700/60 bg-slate-900/35 p-2.5 sm:p-3">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs">Номер площадки</div>
                            <div className="mt-1.5 break-all font-mono text-[13px] text-white sm:mt-2 sm:text-sm">{shipment.externalOrderNumber || '—'}</div>
                          </div>
                          <div className="rounded-xl border border-slate-700/60 bg-slate-900/35 p-2.5 sm:p-3">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs">Номер отправления</div>
                            <div className="mt-1.5 break-all font-mono text-[13px] text-white sm:mt-2 sm:text-sm">{shipment.trackingNumber || '—'}</div>
                          </div>
                          <div className="rounded-xl border border-slate-700/60 bg-slate-900/35 p-2.5 sm:p-3">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs">ПВЗ получения</div>
                            <div className="mt-1.5 break-words text-[13px] text-white sm:mt-2 sm:text-sm">{shipment.receiverPoint || '—'}</div>
                          </div>
                          <div className="rounded-xl border border-slate-700/60 bg-slate-900/35 p-2.5 sm:p-3">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs">ETA от службы</div>
                            <div className="mt-1.5 text-[13px] text-white sm:mt-2 sm:text-sm">
                              {shipment.expectedDeliveryAt ? formatRuDate(shipment.expectedDeliveryAt) : 'ожидаем после передачи'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2.5 xl:min-w-[320px]">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                          <button
                            onClick={() => openShipment(shipment)}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:from-purple-500 hover:to-teal-500"
                            type="button"
                          >
                            <PackageCheck className="h-4 w-4" />
                            Открыть отправление
                          </button>

                          <button
                            onClick={() => createLink(shipment.order.id)}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-slate-600/70 bg-slate-900/55 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800/70"
                            type="button"
                          >
                            <Copy className="h-4 w-4" />
                            Ссылка для ЛК
                          </button>
                        </div>

                        <div className="rounded-xl border border-slate-700/60 bg-slate-900/35 p-3">
                          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs">Что видит клиент</div>
                          <div className="mt-1.5 text-[13px] leading-5 text-slate-300 sm:mt-2 sm:text-sm sm:leading-6">
                            Служба: {carrierLabels[shipment.carrier] || shipment.carrier}
                            <br />
                            Статус: {shipmentStatusLabels[shipment.status] || shipment.status}
                            <br />
                            ETA: {shipment.expectedDeliveryAt ? formatRuDate(shipment.expectedDeliveryAt) : 'будет после обновления от службы'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-4">
                      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/25 p-3 sm:p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          <ShieldCheck className="h-4 w-4 text-teal-300" />
                          Состояние отправления
                        </div>
                        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                          <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2.5 sm:p-3">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs">Серийный номер</div>
                            <div className="mt-1.5 text-[13px] text-white sm:mt-2 sm:text-sm">{serialNumber(shipment)}</div>
                          </div>
                          <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2.5 sm:p-3">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs">Статус расчётов</div>
                            <div className="mt-1.5 text-[13px] text-white sm:mt-2 sm:text-sm">
                              {settlementStatusLabels[shipment.order.settlementStatus] || shipment.order.settlementStatus}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2.5 sm:p-3">
                            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs">Источник статуса</div>
                            <div className="mt-1.5 text-[13px] text-white sm:mt-2 sm:text-sm">
                              {integration?.status === 'CONNECTED' ? 'Площадка / служба' : 'Менеджер вручную'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/25 p-3 sm:p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          <CalendarClock className="h-4 w-4 text-cyan-300" />
                          Последние события
                        </div>
                        {events.length ? (
                          <div className="mt-3 space-y-2.5">
                            {events.map((event) => (
                              <div key={event.id} className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2.5 sm:p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold text-white">{event.title}</div>
                                    {event.comment ? <div className="mt-1 text-[13px] leading-5 text-slate-400 sm:text-sm">{event.comment}</div> : null}
                                  </div>
                                  <div className="text-[10px] text-slate-500 sm:text-xs">{formatRuDateTime(event.createdAt)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-slate-500">История пока не заполнена.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        )}

        <AnimatePresence>
          {selectedShipment ? (
            <motion.div
              className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" onClick={() => setSelectedShipment(null)} />
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                className="glass relative z-10 flex h-[100dvh] w-full max-w-full flex-col overflow-hidden rounded-none border border-slate-700/70 sm:h-auto sm:max-h-[92dvh] sm:max-w-5xl sm:rounded-3xl"
              >
                <div
                  className={`h-1 w-full bg-gradient-to-r ${
                    (() => {
                      const platform = shipmentPlatformFromCarrier(selectedShipment.carrier);
                      return platform ? providerMeta[platform].accent : 'from-slate-600 to-slate-700';
                    })()
                  }`}
                />

                <div className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-950/94 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.85rem)] backdrop-blur-xl sm:static sm:border-b-0 sm:bg-transparent sm:px-6 sm:pb-0 sm:pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] sm:px-3 sm:text-[11px] ${shipmentStatusTone(selectedShipment.status)}`}>
                          {shipmentStatusLabels[selectedShipment.status] || selectedShipment.status}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] sm:px-3 sm:text-[11px] ${settlementTone(selectedShipment.order.settlementStatus)}`}>
                          {settlementStatusLabels[selectedShipment.order.settlementStatus] || selectedShipment.order.settlementStatus}
                        </span>
                      </div>

                      <h2 className="mt-3 text-lg font-bold text-white sm:text-2xl">
                        Заказ #{selectedShipment.order.id}
                      </h2>
                      <div className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-slate-200 sm:line-clamp-none sm:text-base">
                        {productTitle(selectedShipment)}
                      </div>
                      <div className="mt-1.5 text-[12px] leading-5 text-slate-400 sm:text-sm">
                        {selectedShipment.order.client?.name || 'Клиент'}
                        {selectedShipment.order.client?.phone ? ` • ${selectedShipment.order.client.phone}` : ''}
                        {selectedShipment.order.client?.city ? ` • ${selectedShipment.order.client.city}` : ''}
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedShipment(null)}
                      className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/60 px-3 text-xs font-semibold text-slate-300 transition hover:bg-slate-800/80 hover:text-white sm:h-11 sm:text-sm"
                      type="button"
                    >
                      Закрыть
                    </button>
                  </div>

                  <p className="mt-2.5 text-[11px] leading-5 text-slate-400 sm:mt-4 sm:text-sm sm:leading-6">
                    В личном кабинете клиент видит только службу доставки, статус, ПВЗ и ETA. Внутренние штрихкоды и служебные поля остаются в CRM.
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 sm:px-6 sm:pb-6 sm:pt-6">
                  <div className="grid gap-3 sm:gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="min-w-0">
                      <div className="grid min-w-0 gap-3 md:grid-cols-2 md:gap-4">
                        <ShipmentDispatchCodeCard
                          barcode={selectedShipment.barcode}
                          trackingNumber={selectedShipment.trackingNumber}
                          externalOrderNumber={selectedShipment.externalOrderNumber}
                          senderPoint={selectedShipment.senderPoint}
                          receiverPoint={selectedShipment.receiverPoint}
                          syncMode={selectedShipment.syncMode}
                          lastSyncedAt={selectedShipment.lastSyncedAt}
                        />

                        <div className="min-w-0 rounded-2xl border border-slate-700/60 bg-slate-900/35 p-3 sm:p-4">
                          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:text-xs">Доставка</div>
                          <div className="mt-2.5 grid gap-2.5 sm:mt-3 sm:grid-cols-2">
                            <ShipmentMetaField
                              label="Служба"
                              value={carrierLabels[selectedShipment.carrier] || selectedShipment.carrier}
                            />
                            <ShipmentMetaField
                              label="Источник"
                              value={selectedShipment.syncMode === 'API' ? 'Синхронизация площадки' : 'Ручной ввод CRM'}
                            />
                            <ShipmentMetaField label="Номер отправления" value={selectedShipment.trackingNumber} mono />
                            <ShipmentMetaField
                              label="Код отправки"
                              value={selectedShipment.barcode || selectedShipment.trackingNumber || selectedShipment.externalOrderNumber}
                              mono
                            />
                            <ShipmentMetaField label="Пункт отправки" value={selectedShipment.senderPoint} />
                            <ShipmentMetaField label="ПВЗ получения" value={selectedShipment.receiverPoint} />
                            <ShipmentMetaField
                              label="ETA"
                              value={selectedShipment.expectedDeliveryAt ? formatRuDate(selectedShipment.expectedDeliveryAt) : 'будет после обновления от службы'}
                            />
                            <ShipmentMetaField label="Номер площадки" value={selectedShipment.externalOrderNumber} mono />
                          </div>
                        </div>

                        <div className="min-w-0 rounded-2xl border border-slate-700/60 bg-slate-900/35 p-3 sm:p-4">
                          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:text-xs">Товар и расчёты</div>
                          <div className="mt-2.5 grid gap-2.5 sm:mt-3 sm:grid-cols-2">
                            <ShipmentMetaField label="Товар" value={productTitle(selectedShipment)} />
                            <ShipmentMetaField label="Серийный номер" value={serialNumber(selectedShipment)} mono />
                            <ShipmentMetaField
                              label="Ожидаемое поступление"
                              value={selectedShipment.order.expectedPayout ? String(selectedShipment.order.expectedPayout) : '—'}
                            />
                            <ShipmentMetaField
                              label="Фактическое поступление"
                              value={selectedShipment.order.actualPayout ? String(selectedShipment.order.actualPayout) : '—'}
                            />
                            <div className="min-w-0 rounded-xl border border-slate-700/60 bg-slate-950/35 p-2.5 sm:col-span-2 sm:p-3">
                              <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs">Комментарий менеджера</div>
                              <div className="mt-1.5 break-words text-[13px] leading-5 text-white sm:mt-2 sm:text-sm">
                                {selectedShipment.managerComment || selectedShipment.order.comment || '—'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 sm:mt-6">
                        <div className="text-sm font-semibold text-white">Следующие действия</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {statusOptions(selectedShipment).map((status) => (
                            <button
                              key={status}
                              onClick={() => updateShipmentStatus(selectedShipment, status)}
                              className={`rounded-full border px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                                selectedShipment.status === status
                                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                                  : 'border-slate-700/70 bg-slate-900/50 text-slate-200 hover:border-slate-500 hover:text-white'
                              }`}
                              type="button"
                            >
                              {shipmentStatusLabels[status] || status}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:mt-6 md:grid-cols-[minmax(0,1fr)_auto]">
                        <input
                          value={actualPayout}
                          onChange={(event) => setActualPayout(event.target.value)}
                          placeholder="Фактическая сумма поступления"
                          className="w-full rounded-2xl border border-slate-600/60 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 sm:text-base"
                        />

                        <button
                          onClick={() => markFundsReceived(selectedShipment)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-emerald-500 hover:to-teal-500 sm:px-5 sm:py-3"
                          type="button"
                        >
                          <CircleDollarSign className="h-4 w-4" />
                          Средства поступили
                        </button>
                      </div>

                      <div className="mt-3 grid gap-2.5 sm:mt-4 sm:flex sm:flex-wrap sm:gap-3">
                        <button
                          onClick={() => createLink(selectedShipment.order.id)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-900/50 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800/70"
                          type="button"
                        >
                          <Link2 className="h-4 w-4" />
                          Ссылка для привязки в ЛК
                        </button>

                        <button
                          onClick={() => updateShipmentStatus(selectedShipment, 'RETURN_IN_TRANSIT')}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20"
                          type="button"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Оформить возврат
                        </button>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-3 rounded-2xl border border-slate-700/60 bg-slate-900/35 p-3 sm:space-y-4 sm:p-5">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:text-xs">История движения</div>
                        <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
                          {(selectedShipment.events || []).length ? (
                            selectedShipment.events!.map((event) => (
                              <div key={event.id} className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-2.5 sm:p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-white">{event.title}</div>
                                    {event.comment ? <div className="mt-1 text-[13px] leading-5 text-slate-400 sm:text-sm">{event.comment}</div> : null}
                                  </div>
                                  <div className="shrink-0 text-[10px] text-slate-500 sm:text-xs">{formatRuDateTime(event.createdAt)}</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-3 text-sm text-slate-500 sm:p-4">
                              История пока пустая.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-[13px] leading-5 text-cyan-100 sm:p-4 sm:text-sm sm:leading-6">
                        Если площадка подключена, статусы и ETA приходят от интеграции. Ручное обновление остаётся резервным сценарием на случай задержки внешних данных.
                      </div>

                      <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-3 text-[13px] text-slate-300 sm:p-4 sm:text-sm">
                        <div className="font-semibold text-white">Что увидит клиент</div>
                        <div className="mt-2">
                          Службу доставки, текущий статус, ПВЗ текстом и ожидаемую дату. Внутренние штрихкоды и служебные коды в личный кабинет не выводятся.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <LogisticsCreateOrderModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreated={handleCreatedFromLogistics}
        />
      </div>
    </ProtectedRoute>
  );
}
