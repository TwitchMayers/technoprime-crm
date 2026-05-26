'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, Smartphone, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  isStandaloneDisplayMode,
  needsStandaloneInstallForNotifications,
  supportsCrmNotifications,
} from '@/hooks/usePageActivity';
import { syncCrmPushSubscription } from '@/lib/push-subscriptions';

const DISMISS_KEY = 'crm-notification-permission-dismissed:v1';

function readDismissed() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DISMISS_KEY) === 'true';
}

export default function NotificationPermissionPrompt() {
  const { user, loading } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [standalone, setStandalone] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const refreshCapabilityState = useCallback(() => {
    if (typeof window === 'undefined') return;

    setDismissed(readDismissed());
    setStandalone(isStandaloneDisplayMode());
    if ('Notification' in window) {
      setPermission(Notification.permission);
    } else {
      setPermission('unsupported');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    refreshCapabilityState();

    window.addEventListener('focus', refreshCapabilityState);
    window.addEventListener('pageshow', refreshCapabilityState);
    document.addEventListener('visibilitychange', refreshCapabilityState);

    return () => {
      window.removeEventListener('focus', refreshCapabilityState);
      window.removeEventListener('pageshow', refreshCapabilityState);
      document.removeEventListener('visibilitychange', refreshCapabilityState);
    };
  }, [refreshCapabilityState]);

  const hidePrompt = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISMISS_KEY, 'true');
    }
    setDismissed(true);
  }, []);

  const requestPermission = useCallback(async () => {
    if (!supportsCrmNotifications() || typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    setRequesting(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission === 'granted') {
        await syncCrmPushSubscription().catch(() => undefined);
        toast.success('Уведомления CRM включены');
        hidePrompt();
        return;
      }

      if (nextPermission === 'denied') {
        toast.info('Разрешение на уведомления отклонено');
        hidePrompt();
      }
    } catch (error) {
      console.error('Notification permission request failed', error);
      toast.error('Не удалось запросить разрешение на уведомления');
    } finally {
      setRequesting(false);
    }
  }, [hidePrompt]);

  const handlePrimaryAction = useCallback(async () => {
    refreshCapabilityState();

    if (supportsCrmNotifications()) {
      await requestPermission();
      return;
    }

    if (needsStandaloneInstallForNotifications()) {
      toast.info('Откройте CRM с экрана Домой и нажмите кнопку ещё раз, тогда iPhone покажет системный запрос.');
      return;
    }

    toast.info('В этом режиме браузера push-уведомления пока недоступны.');
  }, [refreshCapabilityState, requestPermission]);

  const promptMode = useMemo(() => {
    if (loading || !user || dismissed) return null;
    if (permission === 'granted' || permission === 'denied') return null;
    if (supportsCrmNotifications()) return 'request';
    if (needsStandaloneInstallForNotifications()) return 'install';
    return null;
  }, [dismissed, loading, permission, user]);

  if (!promptMode) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[120] flex justify-center px-3 md:top-4 md:px-6">
      <div className="pointer-events-auto flex w-full max-w-2xl items-start gap-3 rounded-2xl border border-cyan-400/25 bg-slate-950/92 p-3 text-slate-100 shadow-[0_20px_45px_rgba(2,6,23,0.45)] backdrop-blur-xl md:p-4">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-200">
          {promptMode === 'install' ? <Smartphone className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold md:text-base">
            {promptMode === 'install'
              ? 'Добавьте CRM на экран Домой, чтобы включить уведомления'
              : 'Разрешите уведомления для CRM'}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-300 md:text-sm">
            {promptMode === 'install'
              ? 'На iPhone web-push работает для установленной web app. После добавления CRM на рабочий стол откройте её оттуда и разрешите уведомления.'
              : 'Мы будем спрашивать разрешение только один раз и только в CRM. Если уведомления уже доступны, этот блок больше не показывается.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handlePrimaryAction()}
              disabled={requesting}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {requesting
                ? 'Запрашиваем…'
                : promptMode === 'install'
                  ? standalone
                    ? 'Разрешить уведомления'
                    : 'Я открыл web app'
                  : 'Включить уведомления'}
            </button>
            {promptMode === 'install' ? (
              <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 text-xs text-slate-300 md:text-sm">
                Safari → Поделиться → На экран Домой
              </div>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={hidePrompt}
          className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          aria-label="Скрыть подсказку об уведомлениях"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
