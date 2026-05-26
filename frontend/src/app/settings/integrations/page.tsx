'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  KeyRound,
  Link2,
  PlugZap,
  RefreshCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import {
  formatRuDateTime,
  integrationHealthTone,
  marketplaceAuthLabels,
  marketplaceStatusLabels,
  MarketplacePlatformKey,
  providerMeta,
} from '@/lib/logistics-ui';

type MarketplaceAccount = {
  id: number;
  platform: MarketplacePlatformKey;
  displayName: string;
  authType: string;
  status: string;
  externalAccountId?: string | null;
  clientId?: string | null;
  scopes?: string | null;
  expiresAt?: string | null;
  disconnectedAt?: string | null;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  createdAt: string;
  updatedAt: string;
  hasClientId?: boolean;
  hasAccessToken?: boolean;
  hasRefreshToken?: boolean;
  hasApiKey?: boolean;
  requiresReconnect?: boolean;
  connectionHint?: string | null;
};

type ConnectForm = {
  displayName: string;
  externalAccountId: string;
  clientId: string;
  apiKey: string;
  accessToken: string;
  refreshToken: string;
  scopes: string;
};

const hiddenFieldKeys = ['apiKey', 'accessToken', 'refreshToken'] as const;

const authTypeByPlatform: Record<MarketplacePlatformKey, 'OAUTH' | 'API_KEY'> = {
  AVITO: 'OAUTH',
  OZON: 'API_KEY',
  YANDEX_DELIVERY: 'API_KEY',
  CDEK: 'API_KEY',
};

function createEmptyForm(account?: Partial<MarketplaceAccount>): ConnectForm {
  return {
    displayName: account?.displayName || '',
    externalAccountId: account?.externalAccountId || '',
    clientId: account?.clientId || '',
    apiKey: '',
    accessToken: '',
    refreshToken: '',
    scopes: account?.scopes || '',
  };
}

function isExpiringSoon(value?: string | null) {
  if (!value) return false;
  const diff = new Date(value).getTime() - Date.now();
  return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
}

function secretState(account?: MarketplaceAccount | null) {
  if (!account) return 'Секреты ещё не добавлены';

  if (account.platform === 'AVITO' && account.requiresReconnect) {
    return 'Нужно заново ввести Client ID / Client secret';
  }

  const parts = [
    account.hasApiKey ? 'API key' : null,
    account.hasAccessToken ? 'access token' : null,
    account.hasRefreshToken ? 'refresh token' : null,
  ].filter(Boolean);

  if (!parts.length) return 'Секреты пока не сохранены';
  return `Сохранены: ${parts.join(', ')}`;
}

export default function IntegrationsPage() {
  const [accounts, setAccounts] = useState<MarketplaceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlatform, setActivePlatform] = useState<MarketplacePlatformKey | null>(null);
  const [editingAccount, setEditingAccount] = useState<MarketplaceAccount | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<MarketplaceAccount | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ConnectForm>(createEmptyForm());
  const searchParams = useSearchParams();

  const load = async () => {
    try {
      const data = await fetchWithAuth('/api/logistics/marketplace-accounts');
      setAccounts(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось загрузить интеграции');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const oauth = searchParams.get('oauth');
    const provider = searchParams.get('provider');
    const reason = searchParams.get('reason');

    if (provider !== 'AVITO' || !oauth) return;

    if (oauth === 'success') {
      toast.success('Avito успешно подключён');
    } else if (oauth === 'error') {
      toast.error(reason ? `Avito вернул ошибку: ${reason}` : 'Не удалось завершить авторизацию Avito');
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('oauth');
    url.searchParams.delete('provider');
    url.searchParams.delete('reason');
    window.history.replaceState({}, '', url.toString());
  }, [searchParams]);

  const grouped = useMemo(() => {
    return (Object.keys(providerMeta) as MarketplacePlatformKey[]).map((platform) => {
      const entries = accounts
        .filter((account) => account.platform === platform)
        .sort((a, b) => {
          if (!a.requiresReconnect && b.requiresReconnect) return -1;
          if (a.requiresReconnect && !b.requiresReconnect) return 1;
          if (a.status === 'CONNECTED' && b.status !== 'CONNECTED') return -1;
          if (a.status !== 'CONNECTED' && b.status === 'CONNECTED') return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

      return {
        platform,
        meta: providerMeta[platform],
        entries,
        current: entries[0] || null,
      };
    });
  }, [accounts]);

  const stats = useMemo(() => {
    const connected = accounts.filter((item) => item.status === 'CONNECTED').length;
    const issues = accounts.filter((item) => item.status === 'ERROR' || item.lastSyncError || item.requiresReconnect).length;
    const expiring = accounts.filter((item) => isExpiringSoon(item.expiresAt)).length;
    const syncedRecently = accounts.filter((item) => {
      if (!item.lastSyncAt) return false;
      return Date.now() - new Date(item.lastSyncAt).getTime() < 24 * 60 * 60 * 1000;
    }).length;

    return {
      connected,
      issues,
      expiring,
      syncedRecently,
    };
  }, [accounts]);

  const openConnectModal = (platform: MarketplacePlatformKey, account?: MarketplaceAccount | null) => {
    setActivePlatform(platform);
    setEditingAccount(account || null);
    setForm(createEmptyForm(account || undefined));
  };

  const closeConnectModal = () => {
    setActivePlatform(null);
    setEditingAccount(null);
    setForm(createEmptyForm());
    setSubmitting(false);
  };

  const submit = async () => {
    if (!activePlatform) return;

    const meta = providerMeta[activePlatform];
    const missingField = meta.formFields.find((field) => field.required && !String(form[field.key] || '').trim());
    if (missingField) {
      toast.error(`Заполните поле «${missingField.label}»`);
      return;
    }

    setSubmitting(true);

    try {
      if (activePlatform === 'AVITO') {
        const result = await fetchWithAuth('/api/logistics/oauth/avito/start', {
          method: 'POST',
          body: JSON.stringify({
            accountId: editingAccount?.id,
            platform: activePlatform,
            displayName: form.displayName,
            externalAccountId: form.externalAccountId || undefined,
            clientId: form.clientId,
            apiKey: form.apiKey,
            scopes: form.scopes || undefined,
            oauthMode: 'auto',
            redirectTo: `${window.location.pathname}${window.location.search}`,
          }),
        });

        if (result?.mode === 'authorization_code' && result?.redirectUrl) {
          toast.info('Открываю авторизацию Avito...');
          window.location.assign(String(result.redirectUrl));
          return;
        }

        toast.success(editingAccount ? 'Avito переподключён' : 'Avito подключён');
        closeConnectModal();
        await load();
        return;
      }

      const payload = {
        platform: activePlatform,
        authType: authTypeByPlatform[activePlatform],
        status: 'CONNECTED',
        ...Object.fromEntries(
          Object.entries(form).map(([key, value]) => [key, String(value || '').trim() || undefined]),
        ),
      };

      if (editingAccount) {
        await fetchWithAuth(`/api/logistics/marketplace-accounts/${editingAccount.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success(`${meta.label} переподключён`);
      } else {
        await fetchWithAuth('/api/logistics/marketplace-accounts', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success(`${meta.label} подключён`);
      }

      closeConnectModal();
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось сохранить подключение');
      setSubmitting(false);
    }
  };

  const disconnect = async () => {
    if (!disconnectTarget) return;

    try {
      await fetchWithAuth(`/api/logistics/marketplace-accounts/${disconnectTarget.id}`, {
        method: 'DELETE',
      });
      toast.success(`${providerMeta[disconnectTarget.platform].label} отключён`);
      setDisconnectTarget(null);
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось отключить аккаунт');
    }
  };

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
      <div className="space-y-6 pb-10">
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-cyan-100">
              <Link2 className="h-4 w-4" />
              Интеграции
            </div>
            <h1 className="mt-3 text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-teal-400 bg-clip-text text-transparent">
              Аккаунты площадок
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Подключение Avito, Ozon, Яндекс Доставки и CDEK для синхронизации статусов отправлений.
              Доступ к привязке и отвязке есть только у супер-админа.
            </p>
          </div>

          <button
            onClick={() => openConnectModal('AVITO')}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 font-semibold text-white transition hover:from-purple-500 hover:to-pink-500"
            type="button"
          >
            <PlugZap className="h-4 w-4" />
            Новое подключение
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {[
            {
              label: 'Подключено аккаунтов',
              value: stats.connected,
              icon: CheckCircle2,
              gradient: 'from-emerald-500 to-teal-500',
            },
            {
              label: 'Требуют внимания',
              value: stats.issues,
              icon: AlertTriangle,
              gradient: 'from-rose-500 to-pink-500',
            },
            {
              label: 'Токены скоро истекут',
              value: stats.expiring,
              icon: Clock3,
              gradient: 'from-amber-500 to-orange-500',
            },
            {
              label: 'Синхронизация за 24 часа',
              value: stats.syncedRecently,
              icon: RefreshCcw,
              gradient: 'from-cyan-500 to-sky-500',
            },
          ].map(({ label, value, icon: Icon, gradient }) => (
            <motion.div
              key={label}
              whileHover={{ y: -3 }}
              className="glass rounded-2xl border border-slate-700/60 p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-400">{label}</div>
                  <div className="mt-2 text-3xl font-bold text-white">{value}</div>
                </div>
                <div className={`rounded-xl bg-gradient-to-br ${gradient} p-3 text-white/95 shadow-lg`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="glass rounded-2xl border border-slate-700/70 p-5"
        >
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                Как устроено подключение
              </div>
              <h2 className="mt-3 text-xl font-bold text-white">
                Сначала подключаем площадку, потом логистика начинает забирать статусы и ETA.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Мы больше не держим общий экран с техническими полями “на всё подряд”. У каждой площадки свой
                сценарий: отдельная авторизация, отдельный способ синхронизации и отдельное состояние подключения.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                'Провайдерские карточки вместо общей формы',
                'Подключение и переподключение только от супер-админа',
                'ETA и статусы в логистике приходят от площадки, а не вводятся вручную',
              ].map((item) => (
                <div key={item} className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {loading ? (
          <div className="glass rounded-2xl p-12 text-center text-slate-400">Загрузка интеграций...</div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 gap-6 xl:grid-cols-2"
          >
            {grouped.map(({ platform, meta, current, entries }) => {
              const Icon = meta.icon;

              return (
                <motion.article
                  key={platform}
                  whileHover={{ y: -4 }}
                  className={`glass overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br ${meta.accentSoft}`}
                >
                  <div className={`h-1 w-full bg-gradient-to-r ${meta.accent}`} />

                  <div className="space-y-5 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className={`rounded-2xl bg-gradient-to-br ${meta.accent} p-3 text-white shadow-lg`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${meta.badgeClassName}`}>
                              {meta.shortLabel}
                            </span>
                            <span className="rounded-full border border-slate-600/60 bg-slate-900/60 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200">
                              {meta.authModeLabel}
                            </span>
                            <span
                              className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${integrationHealthTone(
                                current?.status,
                                current?.lastSyncError,
                              )}`}
                            >
                              {marketplaceStatusLabels[current?.status || 'DISCONNECTED']}
                            </span>
                          </div>

                          <h2 className="mt-4 text-2xl font-bold text-white">{meta.headline}</h2>
                          <p className="mt-2 text-sm leading-6 text-slate-400">{meta.description}</p>
                          {current?.requiresReconnect ? (
                            <div className="mt-3 inline-flex max-w-full rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-100">
                              Требует переподключения: не хватает Client ID / Client secret
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <button
                        onClick={() => openConnectModal(platform, current)}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-lg bg-gradient-to-r ${meta.accent} px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110`}
                        type="button"
                      >
                        {current?.status === 'CONNECTED' ? (
                          <>
                            <RefreshCcw className="h-4 w-4" />
                            Переподключить
                          </>
                        ) : (
                          <>
                            <PlugZap className="h-4 w-4" />
                            Подключить
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-700/60 bg-slate-900/35 p-4">
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                          Что синхронизируем
                        </div>
                        <div className="mt-2 text-sm text-slate-200">{meta.capability}</div>
                        <div className="mt-3 text-sm leading-6 text-slate-400">{meta.statusCopy}</div>
                      </div>

                      <div className="rounded-xl border border-slate-700/60 bg-slate-900/35 p-4">
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                          Аккаунты площадки
                        </div>
                        {entries.length ? (
                          <div className="mt-3 space-y-3">
                            {entries.map((entry, index) => (
                              <div
                                key={entry.id}
                                className={`rounded-xl border px-3 py-3 text-sm ${
                                  index === 0
                                    ? 'border-cyan-400/25 bg-cyan-500/10 text-slate-100'
                                    : 'border-slate-700/60 bg-slate-950/35 text-slate-300'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="font-semibold text-white">{entry.displayName}</div>
                                    <div className="mt-1 text-xs text-slate-400">
                                      Режим: {marketplaceAuthLabels[entry.authType] || entry.authType}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-500">
                                      Последняя синхронизация: {formatRuDateTime(entry.lastSyncAt)}
                                    </div>
                                  </div>
                                  <div
                                    className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${integrationHealthTone(
                                      entry.status,
                                      entry.lastSyncError,
                                    )}`}
                                  >
                                    {marketplaceStatusLabels[entry.status] || entry.status}
                                  </div>
                                </div>

                                <div className="mt-2 text-xs text-slate-400">Секреты: {secretState(entry)}</div>
                                {entry.requiresReconnect ? (
                                  <div className="mt-2 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
                                    {entry.connectionHint || 'Подключение выглядит активным, но для Avito не хватает Client ID или Client secret.'}
                                  </div>
                                ) : null}
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openConnectModal(platform, entry)}
                                    className="rounded-lg border border-slate-600/70 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-800/80"
                                  >
                                    Изменить
                                  </button>
                                  {entry.status === 'CONNECTED' ? (
                                    <button
                                      type="button"
                                      onClick={() => setDisconnectTarget(entry)}
                                      className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
                                    >
                                      Отключить
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 text-sm leading-6 text-slate-400">
                            Площадка ещё не подключена. После авторизации логистика сможет использовать её для
                            автоматических обновлений.
                          </div>
                        )}
                      </div>
                    </div>

                    {current?.lastSyncError ? (
                      <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                        <div className="font-semibold">Последняя ошибка синхронизации</div>
                        <div className="mt-1 text-rose-100/90">{current.lastSyncError}</div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-3 border-t border-slate-700/60 pt-4 text-sm text-slate-400">
                      <div>Всего аккаунтов: {entries.length}</div>
                      <div>Истекает: {current?.expiresAt ? formatRuDateTime(current.expiresAt) : '—'}</div>
                      <div>ID аккаунта: {current?.externalAccountId || '—'}</div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => openConnectModal(platform, current)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-600/70 bg-slate-900/50 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800/70"
                        type="button"
                      >
                        <KeyRound className="h-4 w-4" />
                        {current ? 'Изменить данные подключения' : 'Открыть мастер подключения'}
                      </button>

                      <button
                        onClick={() => openConnectModal(platform)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-600/70 bg-slate-900/50 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800/70"
                        type="button"
                      >
                        <PlugZap className="h-4 w-4" />
                        Добавить ещё аккаунт
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        )}

        <AnimatePresence>
          {activePlatform ? (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" onClick={closeConnectModal} />
              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                className="glass relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-700/70"
              >
                <div className={`h-1 w-full bg-gradient-to-r ${providerMeta[activePlatform].accent}`} />

                <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className={`inline-flex rounded-xl bg-gradient-to-br ${providerMeta[activePlatform].accent} p-3 text-white shadow-lg`}>
                          {(() => {
                            const Icon = providerMeta[activePlatform].icon;
                            return <Icon className="h-5 w-5" />;
                          })()}
                        </div>
                        <h2 className="mt-4 text-2xl font-bold text-white">
                          {editingAccount ? 'Переподключение площадки' : 'Новое подключение'}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          {providerMeta[activePlatform].description}
                        </p>
                      </div>

                      <button
                        onClick={closeConnectModal}
                        className="rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800/80 hover:text-white"
                        type="button"
                      >
                        Закрыть
                      </button>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      {providerMeta[activePlatform].formFields.map((field) => (
                        <label key={field.key} className="block">
                          <div className="mb-2 text-sm font-semibold text-slate-200">
                            {field.label}
                            {field.required ? <span className="ml-1 text-rose-300">*</span> : null}
                          </div>
                          <input
                            type={field.type || (hiddenFieldKeys.includes(field.key as any) ? 'password' : 'text')}
                            value={form[field.key]}
                            onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                            placeholder={field.placeholder}
                            className="w-full rounded-xl border border-slate-600/60 bg-slate-900/65 px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-cyan-400/30"
                          />
                          {field.helper ? <div className="mt-2 text-xs text-slate-500">{field.helper}</div> : null}
                        </label>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        onClick={submit}
                        disabled={submitting}
                        className={`inline-flex items-center gap-2 rounded-lg bg-gradient-to-r ${providerMeta[activePlatform].accent} px-5 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70`}
                        type="button"
                      >
                        <PlugZap className="h-4 w-4" />
                        {submitting
                          ? 'Подготавливаю...'
                          : activePlatform === 'AVITO'
                            ? (editingAccount ? 'Переподключить Avito' : 'Подключить Avito')
                            : editingAccount
                              ? `Переподключить ${providerMeta[activePlatform].shortLabel}`
                              : `Подключить ${providerMeta[activePlatform].shortLabel}`}
                      </button>

                      <button
                        onClick={closeConnectModal}
                        className="rounded-lg border border-slate-700/70 bg-slate-900/60 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800/80 hover:text-white"
                        type="button"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-slate-700/70 bg-slate-900/35 p-5">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                        Как это работает
                      </div>
                      <div className="mt-3 text-lg font-bold text-white">{providerMeta[activePlatform].authModeLabel}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {activePlatform === 'AVITO'
                          ? 'Сохраняем Client ID и Client secret, после чего CRM сама получает access token у Avito и сохраняет срок его действия.'
                          : 'После сохранения мы используем это подключение как основной источник статусов для логистики. ETA и фактические этапы будут приходить от самой площадки или службы доставки.'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-100">
                      {providerMeta[activePlatform].statusCopy}
                    </div>

                    <div className="space-y-3">
                      {[
                        'Подключение и отвязка доступны только супер-админу.',
                        'Секреты после сохранения больше не отображаются открытым текстом.',
                        'Если у площадки слетит доступ, логистика увидит это как проблему синхронизации.',
                      ].map((item) => (
                        <div key={item} className="flex gap-3 text-sm text-slate-300">
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>

                    {editingAccount ? (
                      <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-4 text-sm text-slate-300">
                        <div className="font-semibold text-white">Текущее подключение</div>
                        <div className="mt-2">{editingAccount.displayName}</div>
                        <div className="mt-1">Последняя синхронизация: {formatRuDateTime(editingAccount.lastSyncAt)}</div>
                        <div className="mt-1">Статус: {marketplaceStatusLabels[editingAccount.status] || editingAccount.status}</div>
                      </div>
                    ) : null}

                    <a
                      href={activePlatform === 'AVITO' ? 'https://developers.avito.ru/' : '#'}
                      target={activePlatform === 'AVITO' ? '_blank' : undefined}
                      rel={activePlatform === 'AVITO' ? 'noreferrer' : undefined}
                      onClick={(event) => {
                        if (activePlatform !== 'AVITO') event.preventDefault();
                      }}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {activePlatform === 'AVITO'
                        ? 'Открыть кабинет разработчика Avito и получить Client ID / Client secret'
                        : 'Документация и ключи площадки добавим следующим этапом внутри мастера'}
                    </a>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {disconnectTarget ? (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" onClick={() => setDisconnectTarget(null)} />
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                className="glass relative z-10 w-full max-w-lg rounded-3xl border border-slate-700/70 p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-rose-500/15 p-3 text-rose-200">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white">Отключить площадку?</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Подключение <span className="font-semibold text-white">{disconnectTarget.displayName}</span> будет
                      отключено, а сохранённые токены очищены. История отправлений при этом сохранится.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={disconnect}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-600 to-pink-600 px-5 py-3 font-semibold text-white transition hover:from-rose-500 hover:to-pink-500"
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                    Отключить
                  </button>
                  <button
                    onClick={() => setDisconnectTarget(null)}
                    className="rounded-lg border border-slate-700/70 bg-slate-900/60 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800/80 hover:text-white"
                    type="button"
                  >
                    Отмена
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </ProtectedRoute>
  );
}
