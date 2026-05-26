'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  RefreshCcw,
  Target,
  TrendingUp,
  type LucideIcon,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { toast } from 'sonner';

import ProtectedRoute from '@/components/ProtectedRoute';
import MobilePageHeader from '@/components/MobilePageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { usePageActivity } from '@/hooks/usePageActivity';

type Overview = {
  totals: {
    ordersClosed: number;
    revenue: number;
    cost: number;
    profit: number;
    adSpend: number;
    netProfit: number;
  };
  seriesByDay: {
    date: string;
    revenue: number;
    profit: number;
    adSpend: number;
    netProfit: number;
  }[];
};

type SeasonalityData = {
  month: string;
  sales: number;
};

type MlEmployeeItem = {
  employeeId: number;
  name: string;
  roleLabel?: string;
  recent14dDone: number;
  forecastNext7d: number;
  trendPct: number;
  riskScore: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  readinessLabel?: string;
  recommendedLoadPct: number;
  averageResponseMinutes?: number | null;
  peakDemandWindow?: string | null;
  slowdownWindow?: string | null;
  recommendation: string;
};

type MlAdBudgetRow = {
  weekday: number;
  label: string;
  orders: number;
  revenue: number;
  profit: number;
  adSpend: number;
  netProfit: number;
  rawRoi: number | null;
  smoothedRoi: number;
  confidence: number;
  score: number;
  recommendedSharePct: number;
  recommendedBudget: number;
  recommendation: string;
};

type MlAdBudgetForecast = {
  generatedAt: string;
  window: {
    from: string;
    to: string;
    days: number;
  };
  totals: {
    revenue: number;
    profit: number;
    adSpend: number;
    netProfit: number;
    orders: number;
  };
  baselines: {
    priorRoi: number;
    historicalWeeklyBudget: number;
    recommendedWeeklyBudget: number;
  };
  rows: MlAdBudgetRow[];
  bestDays: string[];
};

type MarketplaceOverview = {
  summary: {
    connectedAccounts: number;
    currentBalance: number;
    balanceDelta: number;
    trackedListings: number;
    activeListings?: number;
    archivedListings?: number;
    promotedListings: number;
    totalViews: number;
    totalFavorites: number;
    totalContacts: number;
    statsContacts?: number;
    inboundChatContacts?: number;
    favoritesAvailable?: boolean;
    contactConversion: number;
    manualAdSpend: number;
    estimatedAdvertisingSpend: number;
    estimatedTopUps: number;
    todayAdvertisingSpend?: number;
    todayTopUps?: number;
    lastSpendDate: string | null;
    lastKnownSpendDate?: string | null;
    spendSource?: 'OPERATIONS' | 'BALANCE_DELTA' | 'NO_DATA';
    trainingExamples: number;
    rawTrainingExamples?: number;
    filteredTrainingExamples?: number;
    statsWindowFrom?: string | null;
    statsWindowTo?: string | null;
    operationsCount?: number;
    topUpOperationsCount?: number;
    spendOperationsCount?: number;
    bestReplyHour: number | null;
  };
  accounts: Array<{
    id: number;
    displayName: string;
    externalAccountId?: string | null;
    lastSyncAt?: string | null;
    lastSyncError?: string | null;
    currentBalance: number;
    bonusBalance: number;
    trackedListings?: number;
    activeListings?: number;
    archivedListings?: number;
    promotedListings?: number;
    totalViews?: number;
    totalFavorites?: number;
    totalContacts?: number;
  }>;
  balanceTimeline: Array<{ date: string; real: number; bonus: number }>;
  spendTimeline: Array<{ date: string; spentEstimate: number; topUpEstimate: number }>;
  serviceMix: Array<{
    title: string;
    listings: number;
    totalViews: number;
    totalContacts: number;
    totalSpend?: number;
    avgContactRate: number;
    costPerContact?: number;
  }>;
  filteredLearningCategories?: Array<{ label: string; count: number }>;
};

type MarketplaceListingService = string | {
  title?: string | null;
  type?: string | null;
};

type MarketplaceListingItem = {
  accountId: number;
  accountName: string;
  externalItemId: string;
  title: string;
  url?: string | null;
  priceLabel?: string | null;
  statusLabel?: string | null;
  services: MarketplaceListingService[];
  totalViews: number;
  totalFavorites: number;
  totalContacts: number;
  statsContacts?: number;
  inboundChatContacts?: number;
  favoriteRate: number;
  contactRate: number;
  promotionSpend?: number;
  costPerContact?: number;
  firstTrackedAt: string;
  lastTrackedAt: string;
  lastSpendAt?: string | null;
  leadStarts?: number;
  strongLeadStarts?: number;
  phoneSignals?: number;
  siteRegistrations?: number;
  bestDemandHour?: string | null;
  estimatedClosedDeals?: number;
  estimatedRevenue?: number;
  estimatedProfit?: number;
  dealConversionRate?: number;
  costPerDeal?: number;
  score: number;
  recommendation: string;
};

type PromotionPlaybookItem = {
  service: string;
  listings: number;
  avgContactRate: number;
  costPerContact: number;
  baselineContactRate: number;
  baselineCostPerContact: number;
  contactLiftPct: number;
  cplDeltaPct: number;
  marketVolume: 'низкий' | 'средний' | 'высокий';
  verdict: 'Эффективно' | 'Слабо' | 'Нужно тестировать';
  confidence: 'low' | 'medium' | 'high';
  recommendation: string;
};

type MarketplaceLearningSummary = {
  generatedAt: string;
  corpus: {
    totalExamples: number;
    usefulExamples: number;
    filteredExamples: number;
    inboundExamples: number;
    outboundExamples: number;
    uniqueChats: number;
    uniqueListings: number;
    responsePairs: number;
    positiveSignalDialogs: number;
  };
  topHours: Array<{ hour: number; count: number }>;
  topWeekdays: Array<{ weekday: number; label: string; count: number }>;
  priceBuckets: Array<{ rangeLabel: string; count: number }>;
  productFamilies: Array<{
    family: string;
    dialogs: number;
    successfulDialogs: number;
    variants: string[];
    customerIntents: Array<{ label: string; count: number }>;
    responsePatterns: Array<{ pattern: string; count: number }>;
    answerSuggestions: Array<{
      question: string;
      answer: string;
      count: number;
      successCount: number;
      successRate: number;
    }>;
    exampleQuestions: string[];
  }>;
  customerIntents: Array<{ label: string; count: number }>;
  responsePatterns: Array<{ pattern: string; count: number }>;
  answerSuggestions: Array<{
    family: string;
    question: string;
    answer: string;
    count: number;
    successCount: number;
    successRate: number;
  }>;
  filteredCategories: Array<{ label: string; count: number }>;
  demandForecast?: {
    nextHourMsk: string;
    expectedIncomingNextHour: number;
    tomorrowWeekday: string;
    expectedIncomingTomorrow: number;
    expectedIncomingTomorrowBase?: number;
    weatherAdjustmentPct?: number;
    weatherSummary?: string | null;
    weatherConfidence?: 'low' | 'medium' | 'high' | null;
    weatherTopCities?: string[];
    hotHours: string[];
  };
  recommendations: string[];
};

type JsonResponseLike = {
  json: () => Promise<unknown>;
};

type MarketplaceListingsPayload = {
  items?: unknown;
  recommendations?: {
    best?: unknown;
    weak?: unknown;
  };
  promotionPlaybook?: unknown;
};

type MlEmployeesPayload = {
  items?: unknown;
  generatedAt?: string | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};
const safeArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const formatMoney = (value: number) => `${new Intl.NumberFormat('ru-RU').format(Math.round(value || 0))} ₽`;
const formatPct = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
const formatDateLabel = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
};

function hasJson(value: unknown): value is JsonResponseLike {
  return Boolean(value && typeof value === 'object' && 'json' in value && typeof (value as { json?: unknown }).json === 'function');
}

async function unwrap<T>(value: unknown, fallback: T): Promise<T> {
  try {
    if (hasJson(value)) {
      return (await value.json()) as T;
    }
    return (value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/50 p-3 sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-2 sm:items-center">
        <div className="min-w-0">
          <div className="line-clamp-2 text-[10px] uppercase leading-4 tracking-[0.12em] text-slate-400 sm:text-xs sm:tracking-wide">
            {title}
          </div>
          <div className="mt-1 break-words text-xl font-bold leading-tight text-white sm:text-2xl">{value}</div>
          <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500 sm:text-xs">{subtitle}</div>
        </div>
        <div className="shrink-0 rounded-xl border border-cyan-400/30 bg-cyan-500/15 p-2 sm:p-3">
          <Icon className="h-4 w-4 text-cyan-300 sm:h-5 sm:w-5" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/20 bg-slate-900/30 p-6 text-sm text-slate-400">
      {message}
    </div>
  );
}

export default function AnalyticsPage() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const isPageActive = usePageActivity();
  const [from, setFrom] = useState(daysAgoISO(29));
  const [to, setTo] = useState(todayISO());
  const [selectedMarketplaceAccountId, setSelectedMarketplaceAccountId] = useState<'all' | number>('all');
  const [chartMode, setChartMode] = useState<'revenue' | 'profit' | 'netProfit'>('revenue');

  const [loadingCore, setLoadingCore] = useState(true);
  const [refreshingCore, setRefreshingCore] = useState(false);
  const [coreErrors, setCoreErrors] = useState<string[]>([]);
  const [loadingMarketplace, setLoadingMarketplace] = useState(false);
  const [marketplaceErrors, setMarketplaceErrors] = useState<string[]>([]);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [seasonality, setSeasonality] = useState<SeasonalityData[]>([]);
  const [marketplaceOverview, setMarketplaceOverview] = useState<MarketplaceOverview | null>(null);
  const [marketplaceListings, setMarketplaceListings] = useState<MarketplaceListingItem[]>([]);
  const [marketplaceListingRecommendations, setMarketplaceListingRecommendations] = useState<{ best: string[]; weak: string[] }>({ best: [], weak: [] });
  const [promotionPlaybook, setPromotionPlaybook] = useState<PromotionPlaybookItem[]>([]);
  const [marketplaceLearning, setMarketplaceLearning] = useState<MarketplaceLearningSummary | null>(null);

  const [mlLoading, setMlLoading] = useState(false);
  const [mlRecomputing, setMlRecomputing] = useState(false);
  const [mlGeneratedAt, setMlGeneratedAt] = useState<string | null>(null);
  const [mlEmployees, setMlEmployees] = useState<MlEmployeeItem[]>([]);
  const [mlAdBudget, setMlAdBudget] = useState<MlAdBudgetForecast | null>(null);
  const coreRequestIdRef = useRef(0);
  const marketplaceRequestIdRef = useRef(0);
  const mlRequestIdRef = useRef(0);

  const buildBaseQuery = () => new URLSearchParams({ from, to });

  const loadCore = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (authLoading || !isAuthenticated) return;
    const requestId = ++coreRequestIdRef.current;
    if (mode === 'initial') {
      setLoadingCore(true);
    } else {
      setRefreshingCore(true);
    }

    const qs = buildBaseQuery();
    const nextErrors: string[] = [];

    try {
      const [ovRes, seasonRes] = await Promise.allSettled([
        fetchWithAuth(`/api/analytics/overview?${qs.toString()}`),
        fetchWithAuth('/api/analytics/seasonality'),
      ]);

      if (ovRes.status === 'fulfilled') {
        const payload = await unwrap<Overview | null>(ovRes.value, null);
        if (requestId !== coreRequestIdRef.current) return;
        setOverview(payload);
      } else {
        if (requestId !== coreRequestIdRef.current) return;
        setOverview(null);
        nextErrors.push('Не удалось загрузить обзор показателей');
      }

      if (seasonRes.status === 'fulfilled') {
        const payload = await unwrap<unknown>(seasonRes.value, []);
        if (requestId !== coreRequestIdRef.current) return;
        setSeasonality(safeArray<SeasonalityData>(payload));
      } else {
        if (requestId !== coreRequestIdRef.current) return;
        setSeasonality([]);
        nextErrors.push('Не удалось загрузить сезонность');
      }

    } catch {
      if (requestId !== coreRequestIdRef.current) return;
      nextErrors.push('Ошибка сети при загрузке аналитики');
    } finally {
      if (requestId !== coreRequestIdRef.current) return;
      setCoreErrors(nextErrors);
      if (mode === 'initial') {
        setLoadingCore(false);
      } else {
        setRefreshingCore(false);
      }
      if (mode === 'refresh' && nextErrors.length) {
        toast.error(nextErrors[0]);
      }
    }
  };

  const loadMarketplace = async (silent = false) => {
    if (authLoading || !isAuthenticated) return;
    const requestId = ++marketplaceRequestIdRef.current;
    if (!silent) setLoadingMarketplace(true);

    const qs = buildBaseQuery();
    if (selectedMarketplaceAccountId !== 'all') {
      qs.set('accountId', String(selectedMarketplaceAccountId));
    }
    const nextErrors: string[] = [];

    try {
      const [marketplaceOverviewRes, marketplaceListingsRes, marketplaceLearningRes] = await Promise.allSettled([
        fetchWithAuth(`/api/analytics/marketplace/overview?${qs.toString()}`),
        fetchWithAuth(`/api/analytics/marketplace/listings?${qs.toString()}`),
        fetchWithAuth(`/api/analytics/ml/marketplace?${qs.toString()}`),
      ]);

      if (marketplaceOverviewRes.status === 'fulfilled') {
        const payload = await unwrap<MarketplaceOverview | null>(marketplaceOverviewRes.value, null);
        if (requestId !== marketplaceRequestIdRef.current) return;
        setMarketplaceOverview(payload);
      } else {
        if (requestId !== marketplaceRequestIdRef.current) return;
        setMarketplaceOverview(null);
        nextErrors.push('Не удалось загрузить Avito-метрики');
      }

      if (marketplaceListingsRes.status === 'fulfilled') {
        const payload = await unwrap<MarketplaceListingsPayload>(marketplaceListingsRes.value, {});
        if (requestId !== marketplaceRequestIdRef.current) return;
        setMarketplaceListings(safeArray<MarketplaceListingItem>(payload?.items));
        setMarketplaceListingRecommendations({
          best: safeArray<string>(payload?.recommendations?.best),
          weak: safeArray<string>(payload?.recommendations?.weak),
        });
        setPromotionPlaybook(safeArray<PromotionPlaybookItem>(payload?.promotionPlaybook));
      } else {
        if (requestId !== marketplaceRequestIdRef.current) return;
        setMarketplaceListings([]);
        setMarketplaceListingRecommendations({ best: [], weak: [] });
        setPromotionPlaybook([]);
        nextErrors.push('Не удалось загрузить аналитику объявлений Avito');
      }

      if (marketplaceLearningRes.status === 'fulfilled') {
        const payload = await unwrap<MarketplaceLearningSummary | null>(marketplaceLearningRes.value, null);
        if (requestId !== marketplaceRequestIdRef.current) return;
        setMarketplaceLearning(payload);
      } else {
        if (requestId !== marketplaceRequestIdRef.current) return;
        setMarketplaceLearning(null);
        nextErrors.push('Не удалось загрузить слой обучения по диалогам');
      }
    } catch {
      if (requestId !== marketplaceRequestIdRef.current) return;
      nextErrors.push('Ошибка сети при загрузке Avito-аналитики');
    } finally {
      if (requestId !== marketplaceRequestIdRef.current) return;
      setMarketplaceErrors(nextErrors);
      if (!silent) {
        setLoadingMarketplace(false);
      }
      if (silent && nextErrors.length) {
        toast.error(nextErrors[0]);
      }
    }
  };

  const loadMl = async () => {
    if (authLoading || !isAuthenticated) return;
    const requestId = ++mlRequestIdRef.current;
    setMlLoading(true);
    try {
      const baseQs = buildBaseQuery();
      const [employeeRes, adBudgetRes] = await Promise.allSettled([
        fetchWithAuth('/api/analytics/ml/employees'),
        fetchWithAuth(`/api/analytics/ml/ad-budget?${baseQs.toString()}`),
      ]);

      if (employeeRes.status === 'fulfilled') {
        const payload = await unwrap<MlEmployeesPayload>(employeeRes.value, {});
        if (requestId !== mlRequestIdRef.current) return;
        setMlEmployees(safeArray<MlEmployeeItem>(payload?.items));
        setMlGeneratedAt(payload?.generatedAt || null);
      } else {
        if (requestId !== mlRequestIdRef.current) return;
        setMlEmployees([]);
      }

      if (adBudgetRes.status === 'fulfilled') {
        const payload = await unwrap<MlAdBudgetForecast | null>(adBudgetRes.value, null);
        if (requestId !== mlRequestIdRef.current) return;
        setMlAdBudget(payload);
      } else {
        if (requestId !== mlRequestIdRef.current) return;
        setMlAdBudget(null);
      }
    } catch {
      if (requestId !== mlRequestIdRef.current) return;
      toast.error('Ошибка загрузки ML-данных');
    } finally {
      if (requestId === mlRequestIdRef.current) {
        setMlLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated && isPageActive) {
      void loadCore('initial');
    }
  }, [authLoading, from, isAuthenticated, isPageActive, to]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && isPageActive) {
      void loadMarketplace();
    }
  }, [authLoading, from, isAuthenticated, isPageActive, selectedMarketplaceAccountId, to]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && isPageActive) {
      const timerId = window.setTimeout(() => {
        void loadMl();
      }, 250);
      return () => window.clearTimeout(timerId);
    }
  }, [authLoading, from, isAuthenticated, isPageActive, to]);

  const recomputeMl = async () => {
    setMlRecomputing(true);
    try {
      await fetchWithAuth('/api/analytics/ml/recompute', { method: 'POST' });
      await loadMl();
      toast.success('ML-прогнозы пересчитаны');
    } catch {
      toast.error('Не удалось пересчитать ML-прогнозы');
    } finally {
      setMlRecomputing(false);
    }
  };

  const totals = overview?.totals || {
    ordersClosed: 0,
    revenue: 0,
    cost: 0,
    profit: 0,
    adSpend: 0,
    netProfit: 0,
  };

  const chartData = overview?.seriesByDay || [];
  const hasChartData = chartData.some((day) => day.revenue > 0 || day.profit > 0 || day.netProfit !== 0);
  const hasSeasonality = seasonality.some((row) => row.sales > 0);
  const marketplaceSummary = marketplaceOverview?.summary;
  const effectiveAdSpend = (totals.adSpend || 0) + (marketplaceSummary?.estimatedAdvertisingSpend || 0);
  const effectiveNetProfit = (totals.profit || 0) - effectiveAdSpend;
  const favoritesUnavailable =
    (marketplaceSummary?.totalViews || 0) > 0 &&
    !(marketplaceSummary?.favoritesAvailable ?? ((marketplaceSummary?.totalFavorites || 0) > 0));
  const visibleLearningIntents = useMemo(() => {
    const intents = marketplaceLearning?.customerIntents || [];
    const specific = intents.filter((item) => item.label !== 'Общее уточнение');
    return (specific.length ? specific : intents).slice(0, 6);
  }, [marketplaceLearning]);
  const visibleAnswerSuggestions = useMemo(
    () => (marketplaceLearning?.answerSuggestions || []).slice(0, 6),
    [marketplaceLearning],
  );
  const visibleFamilies = useMemo(
    () =>
      (marketplaceLearning?.productFamilies || [])
        .filter((family) => family.answerSuggestions.length || family.customerIntents.length)
        .slice(0, 4),
    [marketplaceLearning],
  );
  const spendSourceLabel =
    marketplaceSummary?.spendSource === 'OPERATIONS'
      ? 'по истории операций Avito'
      : marketplaceSummary?.spendSource === 'BALANCE_DELTA'
        ? 'оценка по движению баланса'
        : 'данных о списаниях от Avito пока нет';

  const alerts = useMemo(() => {
    const list: string[] = [];
    if (effectiveNetProfit < 0) list.push('Чистая прибыль отрицательная с учётом Avito и ручных рекламных расходов');
    if (effectiveAdSpend > totals.profit) list.push('Суммарные рекламные расходы выше валовой прибыли');
    if (!hasChartData) list.push('За выбранный период нет завершенных продаж');
    return list;
  }, [effectiveAdSpend, effectiveNetProfit, totals.profit, hasChartData]);

  const jumpToSection = useCallback((sectionId: string) => {
    if (typeof window === 'undefined') return;
    const element = document.getElementById(sectionId);
    if (!element) return;
    const y = element.getBoundingClientRect().top + window.scrollY - 84;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }, []);

  if (authLoading || loadingCore) {
    return (
      <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
        <div className="min-h-screen flex items-center justify-center text-slate-400">
          {authLoading ? 'Проверка сессии...' : 'Загрузка аналитики...'}
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
      <div className="mx-auto flex w-full max-w-[1360px] min-w-0 flex-col gap-3 overflow-x-hidden pb-24 md:gap-5">
        <MobilePageHeader
          title="Аналитика CRM"
          subtitle="Финансы, Avito и прогнозы"
          sticky={false}
          action={
            <button
              type="button"
              onClick={() => {
                void Promise.all([loadCore('refresh'), loadMarketplace(true)]);
              }}
              disabled={refreshingCore || loadingMarketplace}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/70 text-slate-200 transition hover:bg-slate-800 disabled:opacity-60 md:hidden"
              aria-label="Обновить аналитику"
            >
              <RefreshCcw className={`h-4 w-4 ${(refreshingCore || loadingMarketplace) ? 'animate-spin' : ''}`} />
            </button>
          }
        />

        <div className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-black/60 p-3 sm:p-6 md:space-y-5 md:rounded-3xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="hidden min-w-0 md:block">
              <h1 className="text-2xl font-bold text-white">Аналитика CRM</h1>
              <p className="text-slate-400 text-sm">Финансы, сезонность, Avito-воронка и прогнозы спроса/нагрузки.</p>
            </div>
            <button
              onClick={() => {
                void Promise.all([loadCore('refresh'), loadMarketplace(true)]);
              }}
              disabled={refreshingCore || loadingMarketplace}
              className="btn-secondary hidden items-center gap-2 md:inline-flex"
            >
              <RefreshCcw className={`w-4 h-4 ${(refreshingCore || loadingMarketplace) ? 'animate-spin' : ''}`} />
              Обновить
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-2 text-sm text-slate-300">
              <span className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                <span>От:</span>
              </span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm text-slate-300">
              <span className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                <span>До:</span>
              </span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-sm text-slate-300">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <span>Avito:</span>
              </span>
              <select
                value={selectedMarketplaceAccountId === 'all' ? 'all' : String(selectedMarketplaceAccountId)}
                onChange={(e) =>
                  setSelectedMarketplaceAccountId(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
                className="min-w-0"
              >
                <option value="all">Все аккаунты</option>
                {(marketplaceOverview?.accounts || []).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="hidden text-xs text-slate-500 md:flex md:items-center">
            Период влияет на KPI, график, ROI и прогнозы. Avito-фильтр разделяет аналитику по аккаунтам и не смешивает основной профиль с тестовыми.
          </div>
          {loadingMarketplace ? (
            <div className="text-xs text-cyan-300">Avito-блок загружается отдельно и не блокирует основную аналитику CRM.</div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-2.5 md:p-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-slate-500 md:text-xs md:tracking-[0.16em]">Разделы аналитики</div>
          <div className="mobile-scroll-row md:mx-0 md:flex-wrap md:px-0 md:pb-0">
            {[
              { id: 'analytics-overview', label: 'Финансы' },
              { id: 'analytics-avito', label: 'Avito и продвижение' },
              { id: 'analytics-listings', label: 'Объявления и обучение' },
              { id: 'analytics-team', label: 'Сотрудники' },
              { id: 'analytics-ml', label: 'ML прогнозы' },
            ].map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => jumpToSection(section.id)}
                className="rounded-full border border-slate-700/70 bg-slate-950/65 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-200"
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {coreErrors.length > 0 ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4" />
              Частичные ошибки загрузки
            </div>
            <ul className="mt-2 list-disc pl-5">
              {coreErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {marketplaceErrors.length > 0 ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-amber-100">
            <div className="font-semibold">Часть Avito-аналитики временно недоступна</div>
            <ul className="mt-2 list-disc pl-5">
              {marketplaceErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {alerts.length > 0 ? (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert} className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                {alert}
              </div>
            ))}
          </div>
        ) : null}

        <div id="analytics-overview" className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
          <KpiCard title="Выручка" value={formatMoney(totals.revenue)} subtitle={`${totals.ordersClosed} закрытых заказов`} icon={Wallet} />
          <KpiCard title="Валовая прибыль" value={formatMoney(totals.profit)} subtitle="До рекламных расходов" icon={TrendingUp} />
          <KpiCard
            title="Реклама"
            value={formatMoney(effectiveAdSpend)}
            subtitle={`ручные ${formatMoney(totals.adSpend)} + Avito ${formatMoney(marketplaceSummary?.estimatedAdvertisingSpend || 0)}`}
            icon={Target}
          />
          <KpiCard title="Чистая прибыль" value={formatMoney(effectiveNetProfit)} subtitle="После всех рекламных расходов" icon={Zap} />
        </div>

        <div id="analytics-avito" className="min-w-0 space-y-3 rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-950/30 via-slate-950/70 to-cyan-950/30 p-3 sm:p-5 md:space-y-5 md:rounded-3xl">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white sm:text-xl">Avito Intelligence</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400 sm:text-sm">
                Активные объявления, продвижение, реальные сигналы покупателей и обучающий корпус по ответам менеджеров.
              </p>
            </div>
            <button
              className="btn-secondary w-full shrink-0 justify-center xl:w-auto"
              onClick={() =>
                void fetchWithAuth('/api/analytics/marketplace/sync', { method: 'POST' })
                  .then(() => loadCore('refresh'))
                  .catch(() => toast.error('Не удалось обновить Avito-данные'))
              }
            >
              Синхронизировать Avito
            </button>
          </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
            <KpiCard
              title="Баланс Avito"
              value={formatMoney(marketplaceSummary?.currentBalance || 0)}
              subtitle={`${marketplaceSummary?.connectedAccounts || 0} аккаунтов`}
              icon={Wallet}
            />
            <KpiCard
              title="Активные объявления"
              value={String(marketplaceSummary?.activeListings ?? marketplaceSummary?.trackedListings ?? 0)}
              subtitle={`${marketplaceSummary?.promotedListings || 0} с продвижением сейчас`}
              icon={Target}
            />
            <KpiCard
              title="Контакты"
              value={String(marketplaceSummary?.totalContacts || 0)}
              subtitle={`${(marketplaceSummary?.contactConversion || 0).toFixed(2)}% от просмотров`}
              icon={Users}
            />
            <KpiCard
              title="Полезный корпус"
              value={String(marketplaceLearning?.corpus.usefulExamples || marketplaceSummary?.trainingExamples || 0)}
              subtitle={`лучший час: ${marketplaceSummary?.bestReplyHour == null ? '—' : `${String(marketplaceSummary.bestReplyHour).padStart(2, '0')}:00`}`}
              icon={Zap}
            />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-black/40 p-3 sm:p-4 md:space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-white sm:text-lg">Баланс, охват и рекламные данные</h3>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500 sm:text-xs">
                    Окно данных по объявлениям: {marketplaceSummary?.statsWindowFrom ? `${marketplaceSummary.statsWindowFrom} — ${marketplaceSummary?.statsWindowTo || marketplaceSummary.statsWindowFrom}` : 'ещё нет снапшотов'}.
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-semibold ${(marketplaceSummary?.balanceDelta || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {(marketplaceSummary?.balanceDelta || 0) >= 0 ? '+' : ''}{formatMoney(marketplaceSummary?.balanceDelta || 0)}
                </span>
              </div>

              <div className="h-52 sm:h-72">
                <ResponsiveContainer>
                  <AreaChart data={marketplaceOverview?.balanceTimeline || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      formatter={(value: unknown) => formatMoney(Number(value))}
                      contentStyle={{ backgroundColor: '#020617', border: '1px solid #334155' }}
                    />
                    <Area type="monotone" dataKey="real" stroke="#22d3ee" fill="rgba(34,211,238,0.18)" strokeWidth={2} />
                    <Area type="monotone" dataKey="bonus" stroke="#a855f7" fill="rgba(168,85,247,0.14)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-sm md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                  <div className="text-slate-500">Просмотры за период</div>
                  <div className="mt-1 text-xl font-semibold text-white">{marketplaceSummary?.totalViews || 0}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                  <div className="text-slate-500">Избранное за период</div>
                  <div className="mt-1 text-xl font-semibold text-white">
                    {favoritesUnavailable ? 'н/д' : marketplaceSummary?.totalFavorites || 0}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {favoritesUnavailable
                      ? 'текущий stats API Avito не отдал избранное для этого периода'
                      : 'по ежедневной статистике Avito, не all-time'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                  <div className="text-slate-500">Контактные действия</div>
                  <div className="mt-1 text-xl font-semibold text-white">{marketplaceSummary?.statsContacts || 0}</div>
                  <div className="mt-1 text-xs text-slate-500">клики по номеру и другим контактным действиям, а не число чатов</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                  <div className="text-slate-500">Новые диалоги</div>
                  <div className="mt-1 text-xl font-semibold text-white">{marketplaceSummary?.inboundChatContacts || 0}</div>
                  <div className="mt-1 text-xs text-slate-500">живые входящие переписки покупателей за выбранный период</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                  <div className="text-slate-500">Списано за период</div>
                  <div className="mt-1 text-xl font-semibold text-white">{formatMoney(marketplaceSummary?.estimatedAdvertisingSpend || 0)}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {spendSourceLabel}
                    {marketplaceSummary?.spendOperationsCount ? ` · ${marketplaceSummary.spendOperationsCount} операций` : ''}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                  <div className="text-slate-500">Пополнения / возвраты</div>
                  <div className="mt-1 text-xl font-semibold text-white">{formatMoney(marketplaceSummary?.estimatedTopUps || 0)}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {marketplaceSummary?.topUpOperationsCount
                      ? `${marketplaceSummary.topUpOperationsCount} операций за период`
                      : marketplaceSummary?.operationsCount
                        ? `${marketplaceSummary.operationsCount} операций в истории`
                        : 'если операций нет, считаем только по движению баланса'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {(marketplaceOverview?.accounts || []).map((account) => (
                  <div key={account.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">{account.displayName}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          ID {account.externalAccountId || '—'} · синк {formatDateLabel(account.lastSyncAt)}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-cyan-300">{formatMoney(account.currentBalance || 0)}</div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-400">
                      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="text-slate-500">Активные</div>
                        <div className="mt-1 text-base font-semibold text-white">{account.activeListings ?? account.trackedListings ?? 0}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="text-slate-500">Продвигаются</div>
                        <div className="mt-1 text-base font-semibold text-white">{account.promotedListings || 0}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="text-slate-500">Просмотры</div>
                        <div className="mt-1 text-base font-semibold text-white">{account.totalViews || 0}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="text-slate-500">Контакты</div>
                        <div className="mt-1 text-base font-semibold text-white">{account.totalContacts || 0}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {(marketplaceSummary?.promotedListings || 0) > 0 && (marketplaceSummary?.estimatedAdvertisingSpend || 0) === 0 ? (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                  Активные услуги продвижения уже есть по {(marketplaceSummary?.promotedListings || 0)} объявлениям, но новых списаний в истории операций Avito за этот период пока нет.
                </div>
              ) : null}
            </div>

            <div className="min-w-0 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <h3 className="text-lg font-semibold text-white">Рекомендации по объявлениям</h3>
                <div className="mt-3 space-y-2">
                  {[...marketplaceListingRecommendations.best, ...marketplaceListingRecommendations.weak].slice(0, 6).map((recommendation) => (
                    <div key={recommendation} className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-300">
                      {recommendation}
                    </div>
                  ))}
                  {[...marketplaceListingRecommendations.best, ...marketplaceListingRecommendations.weak].length === 0 ? (
                    <EmptyState message="Пока не накопилось достаточно данных по объявлениям для рекомендаций." />
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <h3 className="text-lg font-semibold text-white">Рекомендации по пакетам продвижения</h3>
                <div className="mt-2 text-xs text-slate-500">
                  Оценка строится на ваших просмотрах, контактах и фактических списаниях по услугам.
                </div>
                <div className="mt-3 space-y-2">
                  {promotionPlaybook.slice(0, 5).map((row) => (
                    <div key={row.service} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-white">{row.service}</div>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                            row.verdict === 'Эффективно'
                              ? 'bg-emerald-500/20 text-emerald-200'
                              : row.verdict === 'Слабо'
                                ? 'bg-rose-500/20 text-rose-200'
                                : 'bg-amber-500/20 text-amber-200'
                          }`}
                        >
                          {row.verdict}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                        <div>Конверсия: <span className="text-slate-200">{row.avgContactRate.toFixed(2)}%</span></div>
                        <div>База: <span className="text-slate-200">{row.baselineContactRate.toFixed(2)}%</span></div>
                        <div>Lift: <span className={row.contactLiftPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{row.contactLiftPct >= 0 ? '+' : ''}{row.contactLiftPct}%</span></div>
                        <div>CPL: <span className="text-slate-200">{formatMoney(row.costPerContact)}</span></div>
                      </div>
                      <div className="mt-2 text-xs leading-5 text-slate-300">{row.recommendation}</div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Рынок: {row.marketVolume} · уверенность: {row.confidence === 'high' ? 'высокая' : row.confidence === 'medium' ? 'средняя' : 'низкая'}
                      </div>
                    </div>
                  ))}
                  {promotionPlaybook.length === 0 ? (
                    <EmptyState message="Недостаточно данных, чтобы построить уверенный playbook по пакетам продвижения." />
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <h3 className="text-lg font-semibold text-white">Семейства товаров и обучающий корпус</h3>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  {visibleFamilies.map((family) => (
                    <div key={family.family} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="font-medium text-white">{family.family}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {family.dialogs} диалогов · {family.successfulDialogs} с позитивным сигналом
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {family.variants.slice(0, 3).map((variant) => (
                            <span key={`${family.family}-${variant}`} className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-100">
                              {variant}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {family.customerIntents.slice(0, 3).map((intent) => (
                          <span key={`${family.family}-${intent.label}`} className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-slate-300">
                            {intent.label} · {intent.count}
                          </span>
                        ))}
                      </div>
                      {family.answerSuggestions[0] ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-5 text-slate-300">
                          <div className="mb-1 font-semibold text-white">Сильная обучающая пара</div>
                          <div className="text-slate-400">Вопрос</div>
                          <div className="mt-1 text-white">{family.answerSuggestions[0].question}</div>
                          <div className="mt-3 text-slate-400">Ответ менеджера</div>
                          <div className="mt-1 text-white">{family.answerSuggestions[0].answer}</div>
                          <div className="mt-2 text-[11px] text-cyan-200">
                            {family.answerSuggestions[0].count} повторений · успех {family.answerSuggestions[0].successRate}%
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {visibleFamilies.length === 0 ? (
                    <EmptyState message="Пока не накопилось достаточно чистых диалогов для обучения по семействам товаров." />
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <h3 className="text-lg font-semibold text-white">Какие услуги реально тянут лиды</h3>
                <div className="mt-3 space-y-2">
                  {(marketplaceOverview?.serviceMix || []).slice(0, 5).map((service) => (
                    <div key={service.title} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-white">{service.title}</div>
                        <div className="text-sm font-semibold text-cyan-300">{service.avgContactRate.toFixed(2)}%</div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {service.listings} объявлений · {service.totalContacts} контактов · {service.totalViews} просмотров
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        списано: {formatMoney(service.totalSpend || 0)} · цена контакта: {formatMoney(service.costPerContact || 0)}
                      </div>
                    </div>
                  ))}
                  {(marketplaceOverview?.serviceMix || []).length === 0 ? (
                    <EmptyState message="Avito ещё не вернул достаточно данных по услугам продвижения." />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

          <div className="min-w-0 space-y-3 rounded-2xl border border-white/10 bg-black/60 p-3 sm:p-5 md:space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Динамика продаж и прибыли</h2>
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              <button className={`btn-secondary ${chartMode === 'revenue' ? 'ring-1 ring-cyan-400/50' : ''}`} onClick={() => setChartMode('revenue')}>Выручка</button>
              <button className={`btn-secondary ${chartMode === 'profit' ? 'ring-1 ring-cyan-400/50' : ''}`} onClick={() => setChartMode('profit')}>Прибыль</button>
              <button className={`btn-secondary ${chartMode === 'netProfit' ? 'ring-1 ring-cyan-400/50' : ''}`} onClick={() => setChartMode('netProfit')}>Чистая</button>
            </div>
          </div>

          {hasChartData ? (
            <div className="h-56 sm:h-80">
              <ResponsiveContainer>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    formatter={(value: unknown) => formatMoney(Number(value))}
                    contentStyle={{ backgroundColor: '#020617', border: '1px solid #334155' }}
                  />
                  <Area
                    type="monotone"
                    dataKey={chartMode}
                    stroke="#22d3ee"
                    fill="rgba(34, 211, 238, 0.2)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="По выбранному периоду нет данных для графика." />
          )}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="min-w-0 rounded-2xl border border-white/10 bg-black/60 p-3 sm:p-5 space-y-3">
            <h2 className="text-lg font-semibold text-white">Сезонность (месяцы)</h2>
            {hasSeasonality ? (
              <div className="h-52 sm:h-72">
                <ResponsiveContainer>
                  <BarChart data={seasonality}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    <Bar dataKey="sales" fill="#60a5fa" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="Недостаточно данных для сезонности." />
            )}
          </div>

          <div className="min-w-0 rounded-2xl border border-white/10 bg-black/60 p-3 sm:p-5 space-y-3">
            <h2 className="text-lg font-semibold text-white">Оперативный прогноз спроса</h2>
            {marketplaceLearning?.demandForecast ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                    <div className="text-slate-500 text-sm">Следующий час ({marketplaceLearning.demandForecast.nextHourMsk})</div>
                    <div className="mt-1 text-2xl font-semibold text-white">
                      ~{marketplaceLearning.demandForecast.expectedIncomingNextHour}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">ожидаемых новых обращений</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                    <div className="text-slate-500 text-sm">
                      Прогноз на {marketplaceLearning.demandForecast.tomorrowWeekday}
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-white">
                      ~{marketplaceLearning.demandForecast.expectedIncomingTomorrow}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">ожидаемых обращений за день</div>
                  </div>
                </div>
                <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/8 p-3 text-sm text-cyan-100">
                  Пиковые часы, где лучше держать повышенную готовность: {marketplaceLearning.demandForecast.hotHours.join(', ') || 'н/д'}.
                </div>
                {marketplaceLearning.demandForecast.weatherSummary ? (
                  <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-3 text-sm text-sky-100 space-y-1">
                    <div>{marketplaceLearning.demandForecast.weatherSummary}</div>
                    {typeof marketplaceLearning.demandForecast.expectedIncomingTomorrowBase === 'number' ? (
                      <div className="text-xs text-sky-200/90">
                        Базовый прогноз без погоды: ~{marketplaceLearning.demandForecast.expectedIncomingTomorrowBase}. Коррекция: {marketplaceLearning.demandForecast.weatherAdjustmentPct && marketplaceLearning.demandForecast.weatherAdjustmentPct > 0 ? '+' : ''}{marketplaceLearning.demandForecast.weatherAdjustmentPct || 0}%.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyState message="Пока недостаточно данных, чтобы уверенно дать почасовой прогноз спроса." />
            )}
          </div>
        </div>

        <div id="analytics-listings" className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0 rounded-2xl border border-white/10 bg-black/60 p-4 sm:p-5 space-y-3">
            <h2 className="text-lg font-semibold text-white">Объявления Avito: просмотры, услуги и конверсия</h2>
            {marketplaceListings.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {marketplaceListings.slice(0, 12).map((item) => (
                  <div key={`${item.accountId}-${item.externalItemId}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-white">{item.title}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.accountName} · {item.priceLabel || 'Цена не указана'} · {item.statusLabel || 'статус не пришёл'}
                        </div>
                      </div>
                      <div className={`shrink-0 text-sm font-semibold ${item.contactRate >= 2 ? 'text-emerald-300' : item.contactRate >= 1 ? 'text-amber-300' : 'text-rose-300'}`}>
                        {item.contactRate.toFixed(2)}%
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="text-slate-500">Просмотры</div>
                        <div className="mt-1 font-semibold text-white">{item.totalViews}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="text-slate-500">Контакты</div>
                        <div className="mt-1 font-semibold text-white">{item.totalContacts}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          действия {item.statsContacts || 0} · диалоги {item.inboundChatContacts || 0}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="text-slate-500">Избранное</div>
                        <div className="mt-1 font-semibold text-white">
                          {favoritesUnavailable ? 'н/д' : item.totalFavorites}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="text-slate-500">Списано</div>
                        <div className="mt-1 font-semibold text-white">{formatMoney(item.promotionSpend || 0)}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          CPL {formatMoney(item.costPerContact || 0)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="text-slate-500">Сигналы старта сделки</div>
                        <div className="mt-1 font-semibold text-white">{item.leadStarts || 0}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          телефон {item.phoneSignals || 0} · регистрация {item.siteRegistrations || 0}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="text-slate-500">Оценка закрытых сделок</div>
                        <div className="mt-1 font-semibold text-white">{item.estimatedClosedDeals || 0}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          конверсия {item.dealConversionRate?.toFixed(2) || '0.00'}% · стоимость привлечения сделки {item.costPerDeal ? formatMoney(item.costPerDeal) : '—'}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          средний чек сделки {(item.estimatedClosedDeals || 0) > 0 && (item.estimatedRevenue || 0) > 0 ? formatMoney((item.estimatedRevenue || 0) / Math.max(1, item.estimatedClosedDeals || 0)) : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {item.services?.length ? item.services.slice(0, 4).map((service, index) => (
                        <span key={`${item.externalItemId}-${index}`} className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-2 py-1 text-[11px] text-fuchsia-100">
                          {typeof service === 'string' ? service : service?.title || service?.type || 'услуга'}
                        </span>
                      )) : <span className="text-xs text-slate-500">Без продвижения</span>}
                    </div>

                    <div className="mt-2 text-xs text-cyan-200">
                      {item.bestDemandHour ? `Пиковый час входящих: ${item.bestDemandHour}` : 'Пиковый час входящих пока не выявлен'}
                    </div>
                    <div className="mt-3 text-xs leading-5 text-slate-400">{item.recommendation}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="Нет данных по объявлениям Avito. Проверьте подключение аккаунта и синхронизацию." />
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <div className="min-w-0 rounded-2xl border border-white/10 bg-black/60 p-4 sm:p-5 space-y-3">
              <h2 className="text-lg font-semibold text-white">Лучшие часы и сигналы</h2>
              {marketplaceLearning?.topHours?.length ? (
                <div className="h-60">
                  <ResponsiveContainer>
                    <BarChart data={marketplaceLearning.topHours}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="hour" stroke="#94a3b8" tickFormatter={(value) => `${String(value).padStart(2, '0')}:00`} />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Bar dataKey="count" fill="#22d3ee" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState message="Пока нет накопленных сигналов по времени активности покупателей." />
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 text-sm text-slate-300">
                  <div className="text-slate-500">Полезных примеров</div>
                  <div className="mt-1 text-xl font-semibold text-white">{marketplaceLearning?.corpus.usefulExamples || 0}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    пары вопрос-ответ: {marketplaceLearning?.corpus.responsePairs || 0}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 text-sm text-slate-300">
                  <div className="text-slate-500">Отфильтровано шума</div>
                  <div className="mt-1 text-xl font-semibold text-white">{marketplaceLearning?.corpus.filteredExamples || 0}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    позитивных диалогов: {marketplaceLearning?.corpus.positiveSignalDialogs || 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-w-0 rounded-2xl border border-white/10 bg-black/60 p-4 sm:p-5 space-y-3">
              <h2 className="text-lg font-semibold text-white">Интенты, дни недели и отфильтрованный шум</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                <div>
                  <div className="mb-2 text-sm font-medium text-slate-300">Лучшие дни</div>
                  <div className="flex flex-wrap gap-2">
                    {(marketplaceLearning?.topWeekdays || []).map((weekday) => (
                      <span key={weekday.label} className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold text-fuchsia-100">
                        {weekday.label} · {weekday.count}
                      </span>
                    ))}
                    {(marketplaceLearning?.topWeekdays || []).length === 0 ? (
                      <span className="text-sm text-slate-400">Нет сигнала по дням недели.</span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-slate-300">Типы вопросов покупателей</div>
                  <div className="flex flex-wrap gap-2">
                    {visibleLearningIntents.map((intent) => (
                      <span key={intent.label} className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                        {intent.label} · {intent.count}
                      </span>
                    ))}
                    {visibleLearningIntents.length === 0 ? (
                      <span className="text-sm text-slate-400">Пока нет стабильного паттерна по интентам.</span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-slate-300">Шум, который не идёт в обучение</div>
                  <div className="space-y-2">
                    {(marketplaceLearning?.filteredCategories || []).map((bucket) => (
                      <div key={bucket.label} className="rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-slate-300">
                        <span className="font-medium text-white">{bucket.label}</span>
                        <span className="ml-2 text-slate-500">{bucket.count} сообщений</span>
                      </div>
                    ))}
                    {(marketplaceLearning?.filteredCategories || []).length === 0 ? (
                      <span className="text-sm text-slate-400">Шумовые сообщения пока не встречались.</span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-slate-300">Цены, где чаще пишут</div>
                  <div className="space-y-2">
                    {(marketplaceLearning?.priceBuckets || []).map((bucket) => (
                      <div key={bucket.rangeLabel} className="rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-slate-300">
                        <span className="font-medium text-white">{bucket.rangeLabel}</span>
                        <span className="ml-2 text-slate-500">{bucket.count} диалогов</span>
                      </div>
                    ))}
                    {(marketplaceLearning?.priceBuckets || []).length === 0 ? (
                      <span className="text-sm text-slate-400">Пока нет паттерна по ценам.</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-w-0 rounded-2xl border border-white/10 bg-black/60 p-4 sm:p-5 space-y-3">
              <h2 className="text-lg font-semibold text-white">Подсказки из обученного корпуса</h2>
              {(marketplaceLearning?.recommendations || []).length || visibleAnswerSuggestions.length ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    {visibleAnswerSuggestions.map((pair) => (
                      <div key={`${pair.family}-${pair.question}-${pair.answer}`} className="rounded-xl border border-white/10 bg-slate-900/40 p-3 text-sm text-slate-300">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-200">{pair.family}</div>
                        <div className="text-xs text-slate-500">Вопрос клиента</div>
                        <div className="mt-1 text-white">{pair.question}</div>
                        <div className="mt-3 text-xs text-slate-500">Сильный ответ менеджера</div>
                        <div className="mt-1 text-white">{pair.answer}</div>
                        <div className="mt-2 text-[11px] text-slate-500">
                          {pair.count} повторений · успех {pair.successRate}% · позитивных исходов {pair.successCount}
                        </div>
                      </div>
                    ))}
                  </div>
                  {marketplaceLearning?.recommendations.map((recommendation) => (
                    <div key={recommendation} className="rounded-xl border border-white/10 bg-slate-900/40 p-3 text-sm text-slate-300">
                      {recommendation}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="Система ещё копит чистые пары «вопрос → ответ» по Avito-диалогам." />
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-white/10 bg-black/60 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">ML прогноз рекламного бюджета по дням</h2>
            <div className="text-xs text-slate-500">
              Окно: {mlAdBudget?.window.from || '—'} — {mlAdBudget?.window.to || '—'}
            </div>
          </div>

          {mlLoading ? (
            <div className="text-sm text-slate-400">Загрузка расчёта бюджета…</div>
          ) : mlAdBudget?.rows?.length ? (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-slate-500">Исторический недельный бюджет</div>
                  <div className="mt-1 text-lg font-semibold text-white">{formatMoney(mlAdBudget.baselines.historicalWeeklyBudget || 0)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-slate-500">Рекомендованный недельный бюджет</div>
                  <div className="mt-1 text-lg font-semibold text-cyan-200">{formatMoney(mlAdBudget.baselines.recommendedWeeklyBudget || 0)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-slate-500">Сильные дни</div>
                  <div className="mt-1 text-lg font-semibold text-white">{mlAdBudget.bestDays?.join(', ') || '—'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {mlAdBudget.rows.map((row) => (
                  <div key={row.weekday} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{row.label}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          заказов {row.orders} · ROI {row.rawRoi == null ? '—' : `${formatPct(row.rawRoi * 100)}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Доля бюджета</div>
                        <div className="text-base font-semibold text-cyan-200">{row.recommendedSharePct.toFixed(2)}%</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="text-slate-500">Рекомендация</div>
                        <div className="mt-1 font-semibold text-white">{formatMoney(row.recommendedBudget)}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="text-slate-500">Уверенность</div>
                        <div className="mt-1 font-semibold text-white">{Math.round(row.confidence * 100)}%</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs leading-5 text-slate-400">{row.recommendation}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState message="ML-блок бюджета пока не вернул данных по рекламе и заказам за выбранный период." />
          )}
        </div>

        <div className="min-w-0 rounded-2xl border border-white/10 bg-black/60 p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-300" />
              Прогноз нагрузки менеджеров
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>Последний расчет: {mlGeneratedAt ? new Date(mlGeneratedAt).toLocaleString('ru-RU') : 'нет данных'}</span>
              <button className="btn-secondary" disabled={mlRecomputing} onClick={recomputeMl}>
                {mlRecomputing ? 'Пересчёт...' : 'Пересчитать'}
              </button>
            </div>
          </div>
          {mlLoading ? (
            <div className="text-sm text-slate-400">Загрузка ML-данных...</div>
          ) : mlEmployees.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {mlEmployees.slice(0, 12).map((row) => (
                <div key={row.employeeId} className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.roleLabel || 'Менеджер'}</div>
                    </div>
                    <div
                      className={
                        row.risk === 'HIGH'
                          ? 'rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-xs text-rose-200'
                          : row.risk === 'MEDIUM'
                            ? 'rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-200'
                            : 'rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200'
                      }
                    >
                      {row.risk === 'HIGH' ? 'Риск перегруза: высокий' : row.risk === 'MEDIUM' ? 'Риск перегруза: средний' : 'Риск перегруза: низкий'} · индекс {row.riskScore}/100
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-300">
                    <div>
                      Факт за 14 дней:
                      <span className="ml-1 font-semibold text-white">{row.recent14dDone}</span>
                    </div>
                    <div>
                      Ожидание на 7 дней:
                      <span className="ml-1 font-semibold text-white">{Math.round(row.forecastNext7d)}</span>
                    </div>
                    <div>
                      Тренд к прошлому периоду:
                      <span className={`ml-1 font-semibold ${row.trendPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {formatPct(row.trendPct)}
                      </span>
                    </div>
                    <div>
                      Нагрузка на входящие:
                      <span className="ml-1 font-semibold text-white">{row.recommendedLoadPct}%</span>
                    </div>
                    <div>
                      Средний ответ:
                      <span className="ml-1 font-semibold text-white">
                        {row.averageResponseMinutes == null ? 'н/д' : `${row.averageResponseMinutes} мин`}
                      </span>
                    </div>
                    <div>
                      Пик входящих:
                      <span className="ml-1 font-semibold text-cyan-200">{row.peakDemandWindow || 'н/д'}</span>
                    </div>
                    <div className="col-span-2">
                      Когда чаще просадка ответа:
                      <span className="ml-1 font-semibold text-amber-200">{row.slowdownWindow || 'не выявлена'}</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 text-[11px] text-slate-500">Рекомендуемая доля входящих заказов</div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                        style={{ width: `${Math.max(4, Math.min(100, row.recommendedLoadPct))}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3 text-xs leading-5 text-slate-300">
                    {`Что делать сейчас: ${row.recommendation}`}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="ML-блок сотрудников пока не вернул данные." />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
