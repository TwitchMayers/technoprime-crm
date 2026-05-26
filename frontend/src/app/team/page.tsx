'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { getSocket } from '@/lib/socket';
import { usePageActivity } from '@/hooks/usePageActivity';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import MobilePageHeader from '@/components/MobilePageHeader';
import {
  Activity,
  Clock3,
  MessageCircle,
  RefreshCw,
  Shield,
  ShoppingCart,
  UserCog,
  UserPlus,
  Wrench,
} from 'lucide-react';

type EmployeeRole = 'MANAGER' | 'TECHNICAL_SPECIALIST' | 'ADMIN' | 'SUPER_ADMIN';

type EmployeeOverviewRow = {
  id: number;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  login: string;
  role: EmployeeRole;
  position?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
  stats: {
    loginCount: number;
    ordersCreated: number;
    ordersStarted: number;
    ordersCompleted: number;
    revenue: number;
    profit: number;
    activeOrders: number;
    taskLoad: number;
    messagesSent: number;
    answeredChats?: number;
    averageResponseMinutes: number | null;
    unansweredMessagesToday?: number;
    shiftStartedAt?: string | null;
    shiftEndedAt?: string | null;
    shiftsCount?: number;
    soldConsolesCount?: number;
    shiftIncome?: number;
    salesBonusIncome?: number;
    totalIncome?: number;
  };
};

type EmployeeOverviewResponse = {
  period: string;
  totals: { active: number; inactive: number };
  employees: EmployeeOverviewRow[];
};

type ActivityItem = {
  id: string;
  timestamp: string;
  employeeId: number | null;
  employee?: {
    id: number;
    name: string;
    login: string;
    role: string;
  } | null;
  kind: 'AUTH_LOGIN' | 'ORDER_CREATED' | 'ORDER_STATUS_CHANGED' | 'MESSAGE_SENT';
  title: string;
  description: string;
};

type ActivityResponse = {
  period: string;
  activity: ActivityItem[];
};

type CompletedOrderOption = {
  id: number;
  date: string;
  totalPrice: number;
  managerId?: number | null;
  clientName?: string | null;
  clientPhone?: string | null;
};

const PERIODS = [
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
] as const;

const ROLE_OPTIONS: Array<{ value: EmployeeRole; label: string }> = [
  { value: 'ADMIN', label: 'Администратор' },
  { value: 'MANAGER', label: 'Менеджер' },
  { value: 'TECHNICAL_SPECIALIST', label: 'Технический специалист' },
  { value: 'SUPER_ADMIN', label: 'Супер-админ' },
];

function roleLabel(role: EmployeeRole) {
  return ROLE_OPTIONS.find(item => item.value === role)?.label || role;
}

function formatMoney(value?: number) {
  return `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeOnly(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatShiftWindow(start?: string | null, end?: string | null) {
  const startLabel = formatTimeOnly(start);
  const endLabel = formatTimeOnly(end);
  if (startLabel && endLabel) return `${startLabel}–${endLabel}`;
  if (startLabel) return `с ${startLabel}`;
  if (endLabel) return `до ${endLabel}`;
  return '—';
}

function StatCard({
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
      <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <div className="line-clamp-2 text-[10px] uppercase leading-4 tracking-[0.14em] text-slate-400 sm:text-xs sm:tracking-[0.18em]">
            {title}
          </div>
          <div className="mt-1 break-words text-xl font-bold leading-tight text-white sm:mt-2 sm:text-2xl">{value}</div>
          <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400 sm:text-sm">{subtitle}</div>
        </div>
        <div className="shrink-0 rounded-xl border border-white/10 bg-white/5 p-2 sm:p-3">
          <Icon className="h-4 w-4 text-cyan-300 sm:h-5 sm:w-5" />
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { user } = useAuth();
  const isPageActive = usePageActivity();
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | 'all'>('all');
  const [overview, setOverview] = useState<EmployeeOverviewResponse | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    login: '',
    password: '',
    role: 'MANAGER' as EmployeeRole,
  });
  const [completedOrders, setCompletedOrders] = useState<CompletedOrderOption[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [creditSaving, setCreditSaving] = useState(false);
  const [creditForm, setCreditForm] = useState({
    employeeId: '',
    mode: 'ORDER' as 'ORDER' | 'MANUAL',
    orderId: '',
    quantity: 1,
    note: '',
  });
  const requestInFlightRef = useRef(false);
  const canManageEmployees = user?.role === 'SUPER_ADMIN';
  const canAwardSales = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const loadData = async (silent = false) => {
    if (requestInFlightRef.current) return;

    requestInFlightRef.current = true;
    if (!silent) setLoading(true);
    try {
      const [overviewData, activityData] = await Promise.all([
        fetchWithAuth(
          `/api/employees/admin/overview?period=${period}&includeInactive=${includeInactive ? '1' : '0'}`
        ) as Promise<EmployeeOverviewResponse>,
        fetchWithAuth(
          `/api/employees/admin/activity?period=${period}${selectedEmployeeId === 'all' ? '' : `&employeeId=${selectedEmployeeId}`}`
        ) as Promise<ActivityResponse>,
      ]);

      setOverview(overviewData);
      setActivity(activityData?.activity || []);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось загрузить данные по сотрудникам');
    } finally {
      requestInFlightRef.current = false;
      if (!silent) setLoading(false);
    }
  };

  const loadCompletedOrders = async () => {
    if (!canAwardSales) return;
    setOrdersLoading(true);
    try {
      const response = await fetchWithAuth('/api/employees/admin/completed-orders?limit=120');
      const rows = Array.isArray(response?.items) ? response.items : [];
      setCompletedOrders(rows);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось загрузить завершённые заказы');
      setCompletedOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [period, includeInactive, selectedEmployeeId, refreshTick]);

  useEffect(() => {
    if (!canAwardSales) return;
    void loadCompletedOrders();
  }, [canAwardSales, refreshTick]);

  useEffect(() => {
    if (!isPageActive) return;

    const interval = window.setInterval(() => {
      void loadData(true);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [period, includeInactive, selectedEmployeeId, isPageActive]);

  useEffect(() => {
    const socket = getSocket();

    const refreshFromEvent = () => {
      if (!isPageActive) return;
      void loadData(true);
    };

    socket.on('ORDER_CREATED', refreshFromEvent);
    socket.on('ORDER_ASSIGNED', refreshFromEvent);
    socket.on('ORDER_STATUS', refreshFromEvent);
    socket.on('WEBSITE_CHAT_UPDATED', refreshFromEvent);
    socket.on('queueUpdated', refreshFromEvent);
    socket.on('notification', refreshFromEvent);

    return () => {
      socket.off('ORDER_CREATED', refreshFromEvent);
      socket.off('ORDER_ASSIGNED', refreshFromEvent);
      socket.off('ORDER_STATUS', refreshFromEvent);
      socket.off('WEBSITE_CHAT_UPDATED', refreshFromEvent);
      socket.off('queueUpdated', refreshFromEvent);
      socket.off('notification', refreshFromEvent);
    };
  }, [period, includeInactive, selectedEmployeeId, isPageActive]);

  const totals = useMemo(() => {
    const employees = overview?.employees || [];
    return employees.reduce(
      (acc, employee) => {
        acc.ordersCreated += employee.stats.ordersCreated;
        acc.ordersCompleted += employee.stats.ordersCompleted;
        acc.answeredChats += Number(employee.stats.answeredChats || 0);
        acc.activeOrders += employee.stats.activeOrders;
        return acc;
      },
      { ordersCreated: 0, ordersCompleted: 0, answeredChats: 0, activeOrders: 0 }
    );
  }, [overview?.employees]);

  const teamInsights = useMemo(() => {
    const employees = overview?.employees || [];
    const topCloser =
      [...employees].sort(
        (left, right) => right.stats.ordersCompleted - left.stats.ordersCompleted
      )[0] || null;
    const fastest =
      [...employees]
        .filter(employee => employee.stats.averageResponseMinutes != null)
        .sort(
          (left, right) =>
            Number(left.stats.averageResponseMinutes ?? Number.MAX_SAFE_INTEGER) -
            Number(right.stats.averageResponseMinutes ?? Number.MAX_SAFE_INTEGER)
        )[0] || null;
    const busiest =
      [...employees].sort((left, right) => right.stats.activeOrders - left.stats.activeOrders)[0] ||
      null;
    const roleBreakdown = ROLE_OPTIONS.map(role => ({
      ...role,
      count: employees.filter(employee => employee.role === role.value && employee.isActive).length,
    }));

    return {
      topCloser,
      fastest,
      busiest,
      roleBreakdown,
    };
  }, [overview?.employees]);

  const managerOptions = useMemo(
    () =>
      (overview?.employees || []).filter(
        employee => employee.role === 'MANAGER' && employee.isActive
      ),
    [overview?.employees]
  );

  const handleAddSalesCredit = async () => {
    if (!canAwardSales) {
      toast.error('Начислять продажи могут только администраторы');
      return;
    }

    const employeeId = Number(creditForm.employeeId || 0);
    if (!employeeId) {
      toast.error('Выберите менеджера');
      return;
    }

    if (creditForm.mode === 'ORDER' && !Number(creditForm.orderId || 0)) {
      toast.error('Выберите завершённый заказ');
      return;
    }

    if (creditForm.mode === 'MANUAL' && Number(creditForm.quantity || 0) <= 0) {
      toast.error('Укажите количество проданных приставок');
      return;
    }

    setCreditSaving(true);
    try {
      const payload: Record<string, any> = {
        employeeId,
        note: creditForm.note.trim() || undefined,
      };
      if (creditForm.mode === 'ORDER') {
        payload.orderId = Number(creditForm.orderId);
        payload.quantity = 1;
      } else {
        payload.quantity = Math.max(1, Math.floor(Number(creditForm.quantity || 1)));
      }

      await fetchWithAuth('/api/employees/admin/sales-credit', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success('Продажа начислена менеджеру');
      setCreditForm(prev => ({
        ...prev,
        orderId: '',
        quantity: 1,
        note: '',
      }));
      setRefreshTick(value => value + 1);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось начислить продажу');
    } finally {
      setCreditSaving(false);
    }
  };

  const handleCreateEmployee = async () => {
    if (!canManageEmployees) {
      toast.error('Создавать сотрудников может только супер-администратор');
      return;
    }
    if (!form.login.trim() || !form.password.trim()) {
      toast.error('Укажите логин и пароль');
      return;
    }

    setSaving(true);
    try {
      await fetchWithAuth('/api/employees/admin', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      toast.success('Сотрудник создан');
      setForm({
        firstName: '',
        lastName: '',
        phone: '',
        login: '',
        password: '',
        role: 'MANAGER',
      });
      setRefreshTick(value => value + 1);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось создать сотрудника');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (employee: EmployeeOverviewRow) => {
    if (!canManageEmployees) {
      toast.error('Изменять учётные записи может только супер-администратор');
      return;
    }
    if (
      !window.confirm(
        `Отключить учётную запись ${employee.name}? История заказов и сообщений сохранится.`
      )
    ) {
      return;
    }

    try {
      await fetchWithAuth(`/api/employees/admin/${employee.id}`, { method: 'DELETE' });
      toast.success('Учётная запись отключена');
      setRefreshTick(value => value + 1);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось отключить сотрудника');
    }
  };

  const handleRestore = async (employee: EmployeeOverviewRow) => {
    if (!canManageEmployees) {
      toast.error('Изменять учётные записи может только супер-администратор');
      return;
    }
    try {
      await fetchWithAuth(`/api/employees/admin/${employee.id}/restore`, { method: 'PATCH' });
      toast.success('Учётная запись восстановлена');
      setRefreshTick(value => value + 1);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось восстановить сотрудника');
    }
  };

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <div className="mobile-page-shell md:space-y-6 md:pb-6">
        <MobilePageHeader
          title="Команда"
          subtitle={`${overview?.totals.active || 0} активных · ${totals.activeOrders} в работе`}
          sticky={false}
        />

        <div className="relative overflow-hidden rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 p-3 shadow-2xl shadow-black/25 sm:p-5 md:rounded-[28px] md:p-6">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/8 via-transparent to-fuchsia-500/8" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="hidden max-w-4xl md:block">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200">
                <Shield className="h-3.5 w-3.5" />
                Команда
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
                Команда и операционная нагрузка
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Здесь видно, кто сейчас держит поток заказов, кто быстрее отвечает клиентам и как
                команда распределяет выручку, задачи и коммуникацию внутри CRM.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
              {PERIODS.map(item => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setPeriod(item.value)}
                  className={`min-h-11 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                    period === item.value
                      ? 'bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20'
                      : 'border border-slate-700/70 bg-slate-900/60 text-slate-200 hover:border-slate-600 hover:bg-slate-800/80'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setRefreshTick(value => value + 1)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-900/60 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800/80 sm:justify-start"
              >
                <RefreshCw className="h-4 w-4" />
                Обновить
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
          <StatCard
            title="Активные сотрудники"
            value={overview?.totals.active || 0}
            subtitle="Учётки, которые сейчас работают в CRM"
            icon={UserCog}
          />
          <StatCard
            title="Создано заказов"
            value={totals.ordersCreated}
            subtitle={`За ${period === 'week' ? 'неделю' : period === 'month' ? 'месяц' : 'год'}`}
            icon={ShoppingCart}
          />
          <StatCard
            title="Отвечено чатов"
            value={totals.answeredChats}
            subtitle="Уникальные диалоги в рабочем окне"
            icon={MessageCircle}
          />
          <StatCard
            title="Активная нагрузка"
            value={totals.activeOrders}
            subtitle="Заказы и задачи в работе"
            icon={Activity}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="glass p-3 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-fuchsia-200/70">
                  Пульс команды
                </div>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Кто тянет продажи и ответы
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={includeInactive}
                    onChange={event => setIncludeInactive(event.target.checked)}
                  />
                  Показать отключённых
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={event =>
                    setSelectedEmployeeId(
                      event.target.value === 'all' ? 'all' : Number(event.target.value)
                    )
                  }
                >
                  <option value="all">Все сотрудники</option>
                  {(overview?.employees || []).map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-2.5 md:mt-5 md:grid-cols-3 md:gap-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3 sm:rounded-3xl sm:p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
                  Лидер по закрытиям
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {teamInsights.topCloser?.name || '—'}
                </div>
                <div className="mt-1 text-sm text-cyan-300">
                  {teamInsights.topCloser
                    ? `${teamInsights.topCloser.stats.ordersCompleted} завершённых заказов`
                    : 'Пока нет данных'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3 sm:rounded-3xl sm:p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
                  Самый быстрый ответ
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {teamInsights.fastest?.name || '—'}
                </div>
                <div className="mt-1 text-sm text-emerald-300">
                  {teamInsights.fastest?.stats.averageResponseMinutes == null
                    ? 'Пока нет замера'
                    : `${teamInsights.fastest.stats.averageResponseMinutes} мин`}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3 sm:rounded-3xl sm:p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 sm:text-xs sm:tracking-[0.18em]">
                  Самая высокая нагрузка
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {teamInsights.busiest?.name || '—'}
                </div>
                <div className="mt-1 text-sm text-amber-300">
                  {teamInsights.busiest
                    ? `${teamInsights.busiest.stats.activeOrders} активных заказов`
                    : 'Пока нет данных'}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {teamInsights.roleBreakdown.map(role => (
                <div
                  key={role.value}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    {role.label}
                  </div>
                  <div className="mt-2 text-2xl font-bold text-white">{role.count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass p-3 sm:p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <UserPlus className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Новый сотрудник</h2>
                <p className="text-sm text-slate-400">
                  Создание менеджеров, техспециалистов и супер-админов.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                placeholder="Имя"
                value={form.firstName}
                onChange={event => setForm(prev => ({ ...prev, firstName: event.target.value }))}
              />
              <input
                placeholder="Фамилия"
                value={form.lastName}
                onChange={event => setForm(prev => ({ ...prev, lastName: event.target.value }))}
              />
              <input
                placeholder="Телефон"
                value={form.phone}
                onChange={event => setForm(prev => ({ ...prev, phone: event.target.value }))}
              />
              <select
                value={form.role}
                onChange={event =>
                  setForm(prev => ({ ...prev, role: event.target.value as EmployeeRole }))
                }
              >
                {ROLE_OPTIONS.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                placeholder="Логин"
                value={form.login}
                onChange={event => setForm(prev => ({ ...prev, login: event.target.value }))}
              />
              <input
                type="password"
                placeholder="Пароль"
                value={form.password}
                onChange={event => setForm(prev => ({ ...prev, password: event.target.value }))}
              />
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void handleCreateEmployee()}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <UserPlus className="h-4 w-4" />
              {saving ? 'Создаём...' : 'Создать сотрудника'}
            </button>

            <div className="my-5 h-px bg-white/10" />

            <div className="space-y-3">
              <div>
                <h3 className="text-base font-semibold text-white">Начислить продажу менеджеру</h3>
                <p className="text-sm text-slate-400">
                  1 приставка = 1 000 ₽. Можно привязать к завершённому заказу или начислить
                  вручную.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={creditForm.employeeId}
                  onChange={event =>
                    setCreditForm(prev => ({ ...prev, employeeId: event.target.value }))
                  }
                  disabled={!canAwardSales}
                >
                  <option value="">Выберите менеджера</option>
                  {managerOptions.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>

                <select
                  value={creditForm.mode}
                  onChange={event =>
                    setCreditForm(prev => ({
                      ...prev,
                      mode: event.target.value as 'ORDER' | 'MANUAL',
                      orderId: '',
                    }))
                  }
                  disabled={!canAwardSales}
                >
                  <option value="ORDER">Из завершённого заказа</option>
                  <option value="MANUAL">Ручное начисление</option>
                </select>

                {creditForm.mode === 'ORDER' ? (
                  <select
                    value={creditForm.orderId}
                    onChange={event =>
                      setCreditForm(prev => ({ ...prev, orderId: event.target.value }))
                    }
                    disabled={!canAwardSales || ordersLoading}
                    className="md:col-span-2"
                  >
                    <option value="">
                      {ordersLoading ? 'Загружаем завершённые заказы…' : 'Выберите заказ'}
                    </option>
                    {completedOrders.map(order => (
                      <option key={order.id} value={order.id}>
                        #{order.id} · {order.clientName || order.clientPhone || 'клиент'} ·{' '}
                        {formatMoney(order.totalPrice)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={1}
                    value={creditForm.quantity}
                    onChange={event =>
                      setCreditForm(prev => ({
                        ...prev,
                        quantity: Math.max(1, Number(event.target.value || 1)),
                      }))
                    }
                    disabled={!canAwardSales}
                    placeholder="Сколько приставок продано"
                    className="md:col-span-2"
                  />
                )}

                <input
                  placeholder="Комментарий (необязательно)"
                  value={creditForm.note}
                  onChange={event => setCreditForm(prev => ({ ...prev, note: event.target.value }))}
                  disabled={!canAwardSales}
                  className="md:col-span-2"
                />
              </div>

              <button
                type="button"
                disabled={!canAwardSales || creditSaving}
                onClick={() => void handleAddSalesCredit()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/35 bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creditSaving ? 'Начисляем…' : 'Начислить продажу'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.98fr_1.02fr]">
          <div className="glass p-3 sm:p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <Clock3 className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Лента активности</h2>
                <p className="text-sm text-slate-400">
                  Живые входы, переводы заказов, ответы клиентам и системные действия.
                </p>
              </div>
            </div>

            <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
              {activity.map(item => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{item.description}</div>
                      {item.employee?.name ? (
                        <div className="mt-2 text-xs text-cyan-200">
                          {item.employee.name} · {item.employee.role}
                        </div>
                      ) : null}
                    </div>
                    <div className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateTime(item.timestamp)}
                    </div>
                  </div>
                </div>
              ))}

              {!loading && activity.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-400">
                  За выбранный период пока нет действий.
                </div>
              ) : null}
            </div>
          </div>

          <div className="glass p-3 sm:p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <Shield className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Сотрудники</h2>
                <p className="text-sm text-slate-400">
                  Карточки нагрузки, ответов и результатов по каждому сотруднику.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {(overview?.employees || []).map(employee => (
              <div
                key={employee.id}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 shadow-lg shadow-black/20 sm:rounded-[26px] sm:p-4"
              >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-white sm:text-lg">{employee.name}</div>
                      <div className="mt-1 break-words text-xs leading-4 text-slate-400">
                        {roleLabel(employee.role)} · {employee.login}
                        {employee.phone ? ` · ${employee.phone}` : ''}
                      </div>
                    </div>
                    <span
                      className={`badge ${employee.isActive ? 'badge-success' : 'badge-danger'}`}
                    >
                      {employee.isActive ? 'Активен' : 'Отключён'}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:mt-4 sm:gap-3">
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 sm:p-3">
                      <div className="text-[10px] uppercase leading-4 tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.16em]">
                        Заказы
                      </div>
                      <div className="mt-2 text-xl font-bold text-white">
                        {employee.stats.ordersCompleted}
                      </div>
                      <div className="text-xs text-slate-500">завершил</div>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 sm:p-3">
                      <div className="text-[10px] uppercase leading-4 tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.16em]">
                        Ответы
                      </div>
                      <div className="mt-2 text-xl font-bold text-white">
                        {Number(employee.stats.answeredChats || 0)}
                      </div>
                      <div className="text-xs text-slate-500">чаты с ответом</div>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 sm:p-3">
                      <div className="text-[10px] uppercase leading-4 tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.16em]">
                        Не отвечено
                      </div>
                      <div className="mt-2 text-xl font-bold text-white">
                        {Number(employee.stats.unansweredMessagesToday || 0)}
                      </div>
                      <div className="text-xs text-slate-500">сообщений за сегодня</div>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 sm:p-3">
                      <div className="text-[10px] uppercase leading-4 tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.16em]">
                        Нагрузка
                      </div>
                      <div className="mt-2 text-xl font-bold text-white">
                        {employee.stats.activeOrders}
                      </div>
                      <div className="text-xs text-slate-500">активных заказов</div>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 sm:p-3">
                      <div className="text-[10px] uppercase leading-4 tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.16em]">
                        Ответ
                      </div>
                      <div className="mt-2 text-xl font-bold text-white">
                        {employee.stats.averageResponseMinutes == null
                          ? '—'
                          : `${employee.stats.averageResponseMinutes}`}
                      </div>
                      <div className="text-xs text-slate-500">минут в среднем</div>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 sm:p-3">
                      <div className="text-[10px] uppercase leading-4 tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.16em]">
                        Смена
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        {formatShiftWindow(
                          employee.stats.shiftStartedAt,
                          employee.stats.shiftEndedAt
                        )}
                      </div>
                      <div className="text-xs text-slate-500">по активности сегодня</div>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 sm:p-3">
                      <div className="text-[10px] uppercase leading-4 tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.16em]">
                        Продано
                      </div>
                      <div className="mt-2 text-xl font-bold text-white">
                        {Number(employee.stats.soldConsolesCount || 0)}
                      </div>
                      <div className="text-xs text-slate-500">приставок в периоде</div>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 sm:p-3">
                      <div className="text-[10px] uppercase leading-4 tracking-[0.12em] text-slate-500 sm:text-xs sm:tracking-[0.16em]">
                        Доход
                      </div>
                      <div className="mt-2 text-xl font-bold text-white">
                        {formatMoney(employee.stats.totalIncome || 0)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatMoney(employee.stats.shiftIncome || 0)} смены +{' '}
                        {formatMoney(employee.stats.salesBonusIncome || 0)} продажи
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      Последний вход:{' '}
                      <span className="text-slate-300">{formatDateTime(employee.lastLoginAt)}</span>
                    </div>
                    {employee.isActive ? (
                      <button
                        type="button"
                        onClick={() => void handleDeactivate(employee)}
                        className="inline-flex items-center gap-2 rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-500/25"
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        Отключить
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleRestore(employee)}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/25"
                      >
                        Восстановить
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!loading && !overview?.employees?.length ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-400">
                Сотрудников пока нет.
              </div>
            ) : null}
          </div>
        </div>

        <div className="glass p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <Activity className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Детализация по сотрудникам</h2>
              <p className="text-sm text-slate-400">
                Полная таблица по входам, заказам, ответам, выручке и прибыли.
              </p>
            </div>
          </div>

          <div className="space-y-3 xl:hidden">
            {(overview?.employees || []).map(employee => (
              <div
                key={employee.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-white">{employee.name}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {roleLabel(employee.role)} · {employee.login}
                      {employee.phone ? ` • ${employee.phone}` : ''}
                    </div>
                  </div>
                  <span className={`badge ${employee.isActive ? 'badge-success' : 'badge-danger'}`}>
                    {employee.isActive ? 'Активен' : 'Отключён'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:gap-3">
                  <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-2.5 sm:p-3">
                    <div className="text-slate-500">Последний вход</div>
                    <div className="mt-1 text-white">{formatDateTime(employee.lastLoginAt)}</div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-2.5 sm:p-3">
                    <div className="text-slate-500">Входы</div>
                    <div className="mt-1 text-white">{employee.stats.loginCount}</div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-2.5 sm:p-3">
                    <div className="text-slate-500">Создал / завершил</div>
                    <div className="mt-1 text-white">
                      {employee.stats.ordersCreated} / {employee.stats.ordersCompleted}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-2.5 sm:p-3">
                    <div className="text-slate-500">Активных / ответы</div>
                    <div className="mt-1 text-white">
                      {employee.stats.activeOrders} / {Number(employee.stats.answeredChats || 0)}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-2.5 sm:p-3">
                    <div className="text-slate-500">Не отвечено сегодня</div>
                    <div className="mt-1 text-white">
                      {Number(employee.stats.unansweredMessagesToday || 0)}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-2.5 sm:p-3">
                    <div className="text-slate-500">Ср. задержка</div>
                    <div className="mt-1 text-white">
                      {employee.stats.averageResponseMinutes == null
                        ? '—'
                        : `${employee.stats.averageResponseMinutes} мин`}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-2.5 sm:p-3">
                    <div className="text-slate-500">Смена сегодня</div>
                    <div className="mt-1 text-white">
                      {formatShiftWindow(
                        employee.stats.shiftStartedAt,
                        employee.stats.shiftEndedAt
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-2.5 sm:p-3">
                    <div className="text-slate-500">Продано приставок</div>
                    <div className="mt-1 text-white">
                      {Number(employee.stats.soldConsolesCount || 0)}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-2.5 sm:p-3">
                    <div className="text-slate-500">Доход за период</div>
                    <div className="mt-1 text-white">
                      {formatMoney(employee.stats.totalIncome || 0)}
                    </div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-2.5 sm:p-3">
                    <div className="text-slate-500">Нагрузка</div>
                    <div className="mt-1 text-white">{employee.stats.taskLoad}</div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-2.5 sm:p-3">
                    <div className="text-slate-500">Выручка</div>
                    <div className="mt-1 text-white">{formatMoney(employee.stats.revenue)}</div>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/35 p-2.5 sm:p-3">
                    <div className="text-slate-500">Прибыль</div>
                    <div className="mt-1 text-white">{formatMoney(employee.stats.profit)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto custom-scrollbar xl:block">
            <table className="w-full min-w-[1480px] text-sm">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Роль</th>
                  <th>Статус</th>
                  <th>Последний вход</th>
                  <th>Входы</th>
                  <th>Создал заказов</th>
                  <th>Взял в работу</th>
                  <th>Завершил</th>
                  <th>Активных</th>
                  <th>Чатов с ответом</th>
                  <th>Не отвечено сегодня</th>
                  <th>Ср. задержка</th>
                  <th>Смена сегодня</th>
                  <th>Смен за период</th>
                  <th>Продано приставок</th>
                  <th>Текущая нагрузка</th>
                  <th>Доход</th>
                  <th>Выручка</th>
                  <th>Прибыль</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.employees || []).map(employee => (
                  <tr key={employee.id}>
                    <td>
                      <div className="font-medium text-white">{employee.name}</div>
                      <div className="text-xs text-slate-400">
                        {employee.login}
                        {employee.phone ? ` • ${employee.phone}` : ''}
                      </div>
                    </td>
                    <td>{roleLabel(employee.role)}</td>
                    <td>
                      <span
                        className={`badge ${employee.isActive ? 'badge-success' : 'badge-danger'}`}
                      >
                        {employee.isActive ? 'Активен' : 'Отключён'}
                      </span>
                    </td>
                    <td>{formatDateTime(employee.lastLoginAt)}</td>
                    <td>{employee.stats.loginCount}</td>
                    <td>{employee.stats.ordersCreated}</td>
                    <td>{employee.stats.ordersStarted}</td>
                    <td>{employee.stats.ordersCompleted}</td>
                    <td>{employee.stats.activeOrders}</td>
                    <td>{Number(employee.stats.answeredChats || 0)}</td>
                    <td>{Number(employee.stats.unansweredMessagesToday || 0)}</td>
                    <td>
                      {employee.stats.averageResponseMinutes == null
                        ? '—'
                        : `${employee.stats.averageResponseMinutes} мин`}
                    </td>
                    <td>
                      {formatShiftWindow(
                        employee.stats.shiftStartedAt,
                        employee.stats.shiftEndedAt
                      )}
                    </td>
                    <td>{Number(employee.stats.shiftsCount || 0)}</td>
                    <td>{Number(employee.stats.soldConsolesCount || 0)}</td>
                    <td>{employee.stats.taskLoad}</td>
                    <td>{formatMoney(employee.stats.totalIncome || 0)}</td>
                    <td>{formatMoney(employee.stats.revenue)}</td>
                    <td>{formatMoney(employee.stats.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {loading ? (
          <div className="glass p-8 text-center text-slate-400">
            Загружаем команду и активность...
          </div>
        ) : null}
      </div>
    </ProtectedRoute>
  );
}
