'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock3,
  MessageCircle,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  StopCircle,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { usePageActivity } from '@/hooks/usePageActivity';
import MobilePageHeader from '@/components/MobilePageHeader';

type EmployeeMe = {
  id: number;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  role: 'MANAGER' | 'TECHNICAL_SPECIALIST' | 'ADMIN' | 'SUPER_ADMIN';
  position?: string | null;
  login: string;
  phone?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
};

type MeMetrics = {
  period: 'today' | 'week' | 'month' | 'year';
  closedCount: number;
  revenue: number;
  profit: number;
  activeCount: number;
  queueCount: number;
  messageCount: number;
  dealsCreated: number;
  answeredChats: number;
  averageResponseMinutes: number | null;
  unansweredMessagesToday?: number;
  shiftStartedAt?: string | null;
  shiftEndedAt?: string | null;
  isOnShift?: boolean;
  shiftsCount?: number;
  soldConsolesCount?: number;
  shiftIncome?: number;
  salesBonusIncome?: number;
  totalIncome?: number;
};

type MeShift = {
  isOnShift: boolean;
  currentShift?: {
    id: number;
    startedAt: string;
    endedAt?: string | null;
    status: 'OPEN' | 'CLOSED';
  } | null;
  todayShiftStartedAt?: string | null;
  todayShiftEndedAt?: string | null;
};

type MeEarnings = {
  period: 'today' | 'week' | 'month' | 'year';
  rates: { shift: number; saleBonus: number };
  shiftsCount: number;
  soldConsolesCount: number;
  shiftIncome: number;
  salesBonusIncome: number;
  totalIncome: number;
};

function formatMoney(value?: number) {
  return `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeOnly(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShiftWindow(start?: string | null, end?: string | null) {
  const startLabel = formatTimeOnly(start);
  const endLabel = formatTimeOnly(end);
  if (startLabel && endLabel) return `${startLabel}–${endLabel}`;
  if (startLabel) return `с ${startLabel}`;
  if (endLabel) return `до ${endLabel}`;
  return '—';
}

function Kpi({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: any;
}) {
  return (
    <div className="glass p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.16em]">{title}</div>
          <div className="mt-1.5 text-xl font-bold text-white sm:mt-2 sm:text-2xl">{value}</div>
          <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-2 sm:p-3">
          <Icon className="h-4 w-4 text-cyan-300 sm:h-5 sm:w-5" />
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const isPageActive = usePageActivity();
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [me, setMe] = useState<EmployeeMe | null>(null);
  const [metrics, setMetrics] = useState<MeMetrics | null>(null);
  const [shift, setShift] = useState<MeShift | null>(null);
  const [earnings, setEarnings] = useState<MeEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shiftSaving, setShiftSaving] = useState(false);

  const loadProfile = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [meData, metricsData, shiftData, earningsData] = await Promise.all([
          fetchWithAuth('/api/employees/me') as Promise<EmployeeMe>,
          fetchWithAuth(`/api/employees/me/metrics?period=${period}`) as Promise<MeMetrics>,
          fetchWithAuth('/api/employees/me/shift') as Promise<MeShift>,
          fetchWithAuth(`/api/employees/me/earnings?period=${period}`) as Promise<MeEarnings>,
        ]);

        setMe(meData);
        setMetrics(metricsData);
        setShift(shiftData);
        setEarnings(earningsData);
      } catch (error: any) {
        toast.error(error?.message || 'Не удалось загрузить профиль сотрудника');
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [period]
  );

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!isPageActive) return;
    const interval = window.setInterval(() => {
      void loadProfile(true);
    }, 25000);
    return () => window.clearInterval(interval);
  }, [isPageActive, loadProfile]);

  useEffect(() => {
    if (!me) return;
    if (me.role === 'ADMIN' || me.role === 'SUPER_ADMIN') {
      router.replace('/analytics');
    }
  }, [me, router]);

  const displayName = useMemo(() => {
    if (!me) return 'Профиль сотрудника';
    const fullName = [me.firstName, me.lastName].filter(Boolean).join(' ').trim();
    return fullName || me.name;
  }, [me]);

  const recommendations = useMemo(() => {
    const tips: string[] = [];
    const avgResponse = Number(metrics?.averageResponseMinutes || 0);
    const unanswered = Number(metrics?.unansweredMessagesToday || 0);

    if (me?.role === 'MANAGER') {
      if (!shift?.isOnShift) {
        tips.push(
          'Начните смену в начале работы, чтобы CRM корректно считала рабочее время и эффективность.'
        );
      }
      if (avgResponse > 5) {
        tips.push(
          'Среднее время ответа выше 5 минут. Ускорьте первичный ответ, чтобы не терять вероятность сделки.'
        );
      }
      if (unanswered > 0) {
        tips.push(
          `Сейчас есть ${unanswered} неотвеченных сообщений за сегодня. Закройте их в приоритете.`
        );
      }
      if (Number(metrics?.activeCount || 0) > 7) {
        tips.push(
          'Нагрузка высокая. Разделите поток по задачам, чтобы не увеличить задержку ответа клиентам.'
        );
      }
      if (!tips.length) {
        tips.push(
          'Работа идёт в хорошем темпе: продолжайте удерживать ответ до 5 минут и фиксируйте смены.'
        );
      }
      return tips;
    }

    if (!tips.length) {
      tips.push(
        'Фиксируйте смены и обновляйте задачи в CRM — это улучшает точность статистики по команде.'
      );
    }
    return tips;
  }, [
    me?.role,
    metrics?.activeCount,
    metrics?.averageResponseMinutes,
    metrics?.unansweredMessagesToday,
    shift?.isOnShift,
  ]);

  const onStartShift = async () => {
    setShiftSaving(true);
    try {
      await fetchWithAuth('/api/employees/me/shift/start', { method: 'POST' });
      toast.success('Смена начата');
      await loadProfile(true);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось начать смену');
    } finally {
      setShiftSaving(false);
    }
  };

  const onEndShift = async () => {
    setShiftSaving(true);
    try {
      await fetchWithAuth('/api/employees/me/shift/end', { method: 'POST' });
      toast.success('Смена завершена');
      await loadProfile(true);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось завершить смену');
    } finally {
      setShiftSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="glass p-8 text-center text-slate-400">Загружаем профиль сотрудника...</div>
    );
  }

  if (me?.role === 'ADMIN' || me?.role === 'SUPER_ADMIN') {
    return (
      <div className="glass p-8 text-center text-slate-400">Перенаправляем в аналитику...</div>
    );
  }

  return (
    <div className="mobile-page-shell md:space-y-6 md:pb-6">
      <MobilePageHeader title={displayName} subtitle={me?.position || me?.role || 'Профиль'} sticky={false} />

      <div className="glass rounded-2xl border border-cyan-400/20 bg-slate-950/50 p-3 sm:p-5 md:rounded-[26px]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="hidden md:block">
            <h1 className="text-2xl font-bold text-white">{displayName}</h1>
            <div className="mt-1 text-sm text-slate-400">
              {me?.position || me?.role || 'Сотрудник'} · {me?.login}
              {me?.phone ? ` · ${me.phone}` : ''}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Последний вход: {formatDateTime(me?.lastLoginAt)}
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 md:items-end">
            <span className={`badge ${me?.isActive ? 'badge-success' : 'badge-danger'}`}>
              {me?.isActive ? 'Активен' : 'Отключён'}
            </span>
            <div className="text-xs text-slate-400">
              Смена сегодня:{' '}
              {formatShiftWindow(shift?.todayShiftStartedAt, shift?.todayShiftEndedAt)}
            </div>
            <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto">
              {!shift?.isOnShift ? (
                <button
                  type="button"
                  onClick={() => void onStartShift()}
                  disabled={shiftSaving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-60"
                >
                  <PlayCircle className="h-4 w-4" />
                  {shiftSaving ? 'Запуск...' : 'Начать смену'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void onEndShift()}
                  disabled={shiftSaving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-60"
                >
                  <StopCircle className="h-4 w-4" />
                  {shiftSaving ? 'Завершаем...' : 'Закончить смену'}
                </button>
              )}
              <button
                type="button"
                onClick={() => void loadProfile(true)}
                disabled={refreshing}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/65 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/70 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Обновить
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 md:flex md:flex-wrap">
        {[
          { key: 'today', label: 'Сегодня' },
          { key: 'week', label: 'Неделя' },
          { key: 'month', label: 'Месяц' },
        ].map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPeriod(item.key as 'today' | 'week' | 'month')}
            className={`min-h-10 rounded-xl px-3 py-2 text-sm font-semibold transition md:px-4 ${
              period === item.key
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                : 'border border-slate-700/70 bg-slate-900/65 text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 md:gap-4 xl:grid-cols-3">
        <Kpi
          title="Заказы"
          value={metrics?.closedCount || 0}
          subtitle="завершил"
          icon={ShoppingCart}
        />
        <Kpi
          title="Ответы"
          value={metrics?.answeredChats || 0}
          subtitle="чаты с ответом"
          icon={MessageCircle}
        />
        <Kpi
          title="Не отвечено"
          value={metrics?.unansweredMessagesToday || 0}
          subtitle="сообщений за сегодня"
          icon={ShieldCheck}
        />
        <Kpi
          title="Нагрузка"
          value={metrics?.activeCount || 0}
          subtitle="активных заказов"
          icon={Clock3}
        />
        <Kpi
          title="Ответ"
          value={
            metrics?.averageResponseMinutes == null ? '—' : `${metrics.averageResponseMinutes}`
          }
          subtitle="минут в среднем"
          icon={Clock3}
        />
        <Kpi
          title="Смена"
          value={formatShiftWindow(shift?.todayShiftStartedAt, shift?.todayShiftEndedAt)}
          subtitle="по активности сегодня"
          icon={ShiftIcon}
        />
      </div>

      <div className="grid gap-3 md:gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="glass p-3 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-cyan-300" />
            <h2 className="text-lg font-semibold text-white">Доход сотрудника</h2>
          </div>

          <div className="grid grid-cols-3 gap-2.5 md:gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Смены</div>
              <div className="mt-2 text-2xl font-bold text-white">{earnings?.shiftsCount || 0}</div>
              <div className="text-xs text-slate-500">
                {formatMoney(earnings?.rates.shift || 2000)} за смену
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Продажи</div>
              <div className="mt-2 text-2xl font-bold text-white">
                {earnings?.soldConsolesCount || 0}
              </div>
              <div className="text-xs text-slate-500">
                {formatMoney(earnings?.rates.saleBonus || 1000)} за приставку
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Итого</div>
              <div className="mt-2 text-2xl font-bold text-white">
                {formatMoney(earnings?.totalIncome || 0)}
              </div>
              <div className="text-xs text-slate-500">за выбранный период</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4 text-sm text-slate-300">
            <div>
              {formatMoney(earnings?.shiftIncome || 0)} за смены +{' '}
              {formatMoney(earnings?.salesBonusIncome || 0)} за проданные приставки.
            </div>
          </div>
        </div>

        <div className="glass p-3 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
            <h2 className="text-lg font-semibold text-white">Персональные рекомендации</h2>
          </div>
          <div className="space-y-2">
            {recommendations.map((tip, index) => (
              <div
                key={`${index}-${tip}`}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-200"
              >
                {tip}
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-slate-500">
            Идеальный первичный ответ клиенту: до 5 минут.
          </div>
        </div>
      </div>
    </div>
  );
}

function ShiftIcon(props: any) {
  return <Clock3 {...props} />;
}
