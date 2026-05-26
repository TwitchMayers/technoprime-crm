'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Button } from '@technoprime/ui';
import {
  fetchConsultationHistory,
  sendConsultationMessage,
  ShopConsultationHistoryItem,
} from '@/lib/shop-api';
import { trackEvent } from '@/lib/analytics';

type AuthUser = {
  id: number;
  phone?: string | null;
};

type Props = {
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
};

function channelLabel(channel?: 'WEBSITE' | 'TELEGRAM' | 'VK' | string) {
  if (!channel || channel === 'WEBSITE') return 'Сайт';
  if (channel === 'TELEGRAM') return 'Telegram';
  if (channel === 'VK') return 'VK';
  return 'Отключенный канал';
}

async function fetchAuthUser() {
  const res = await fetch('/api/auth/me', { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({ user: null }));
  return (data?.user || null) as AuthUser | null;
}

export function ConsultationDialog({
  className,
  variant = 'secondary',
  size = 'lg',
  label = 'Получить консультацию',
}: Props) {
  const [open, setOpen] = useState(false);
  const [resolvingSession, setResolvingSession] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<ShopConsultationHistoryItem[]>([]);
  const [conversationQueueState, setConversationQueueState] = useState<'WAITING_MANAGER' | 'WAITING_CUSTOMER'>('WAITING_CUSTOMER');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const lastMessageKeyRef = useRef<string>('');

  const loadHistory = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setHistoryLoading(true);
    }

    try {
      const data = await fetchConsultationHistory();
      const items = Array.isArray(data?.items) ? data.items : [];
      setHistory(items);
      if (data?.conversation?.queueState) {
        setConversationQueueState(data.conversation.queueState);
      } else if (data?.conversation?.status === 'CLOSED') {
        setConversationQueueState('WAITING_CUSTOMER');
      }
    } catch {
      if (!opts?.silent) {
        setHistory([]);
      }
    } finally {
      if (!opts?.silent) {
        setHistoryLoading(false);
      }
    }
  };

  const openDialog = async () => {
    setOpen(true);
    setNotice(null);
    setText('');
    setResolvingSession(true);

    try {
      const user = await fetchAuthUser();
      if (!user?.id) {
        setAuthorized(false);
        setHistory([]);
        return;
      }

      setAuthorized(true);
      await loadHistory();
    } finally {
      setResolvingSession(false);
    }
  };

  const closeDialog = () => {
    setOpen(false);
    setNotice(null);
  };

  const submitMessage = async () => {
    const payload = text.trim();
    if (!payload) {
      setNotice('Введите сообщение для менеджера.');
      return;
    }

    setSending(true);
    setNotice(null);
    try {
      const res = await sendConsultationMessage({ text: payload });
      if (res?.success) {
        trackEvent('form_submit', {
          form: 'consultation',
        });
        setText('');
        setNotice(res?.message || 'Сообщение отправлено.');
        await loadHistory({ silent: true });
      } else {
        setNotice(res?.message || 'Не удалось отправить сообщение.');
      }
    } catch {
      setNotice('Ошибка сети. Попробуйте ещё раз.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    setPortalReady(true);
    return () => setPortalReady(false);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !authorized) return;

    const timerId = window.setInterval(() => {
      void loadHistory({ silent: true });
    }, 3000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [authorized, open]);

  useEffect(() => {
    const lastItem = history[history.length - 1];
    const nextKey = lastItem ? `${lastItem.id}:${lastItem.sentAt}` : '';
    if (!nextKey || nextKey === lastMessageKeyRef.current) return;
    lastMessageKeyRef.current = nextKey;

    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [history]);

  const dialog = open ? (
        <div
          className="fixed inset-0 z-[1200] flex items-start justify-center bg-slate-950/82 p-2 pt-[calc(env(safe-area-inset-top)+3.25rem)] backdrop-blur-sm sm:p-4 sm:pt-[calc(env(safe-area-inset-top)+3.9rem)]"
          onClick={closeDialog}
        >
          <div
            className="relative flex h-[min(88dvh,860px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-cyan-100/15 bg-[linear-gradient(160deg,rgba(2,6,23,0.96),rgba(10,18,34,0.95))] shadow-[0_30px_90px_rgba(2,132,199,0.25)] sm:h-[min(84dvh,840px)] sm:rounded-[28px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="relative border-b border-white/10 px-3 py-3.5 sm:px-4 sm:py-4 md:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">
                    Коммуникационный центр
                  </p>
                  <p className="text-lg font-semibold text-white md:text-xl">Диалог с менеджером</p>
                  <p className="text-sm text-slate-400">История консультации по вашему аккаунту</p>
                </div>
                <Button variant="ghost" size="sm" onClick={closeDialog}>
                  Закрыть
                </Button>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 sm:px-4 sm:pb-4 md:px-6 md:pb-6">
              <div className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                Обычно отвечаем в течение 10 минут.
              </div>

              {resolvingSession ? (
                <div className="flex min-h-0 flex-1 items-center justify-center py-6">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-slate-300">
                    Проверяем авторизацию...
                  </div>
                </div>
              ) : authorized === false ? (
                <div className="flex min-h-0 flex-1 items-center justify-center py-5">
                  <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-center md:p-7">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/40 bg-cyan-500/12 text-cyan-100">
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                        <path d="M6 10V8a6 6 0 1 1 12 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        <rect x="4" y="10" width="16" height="10" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    </div>
                    <p className="text-lg font-semibold text-white">Требуется авторизация</p>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                      Для консультации в чате нужно войти в личный кабинет. После входа история диалога
                      будет доступна автоматически.
                    </p>
                    <div className="mt-5">
                      <Link href="/account" onClick={closeDialog}>
                        <Button size="md" className="w-full sm:w-auto">
                          Войти или зарегистрироваться
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex min-h-0 flex-1 flex-col space-y-4">
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      conversationQueueState === 'WAITING_MANAGER'
                        ? 'border border-amber-300/35 bg-amber-500/10 text-amber-100'
                        : 'border border-emerald-300/30 bg-emerald-500/10 text-emerald-100'
                    }`}
                  >
                    {conversationQueueState === 'WAITING_MANAGER'
                      ? 'Диалог открыт. Ожидается ответ менеджера.'
                      : 'Менеджер уже ответил. Если остались вопросы, продолжайте переписку здесь.'}
                  </div>

                  <div
                    ref={listRef}
                    className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/25 p-3 sm:rounded-3xl sm:p-4"
                  >
                    {historyLoading ? (
                      <p className="text-sm text-slate-300">Загружаем историю...</p>
                    ) : history.length ? (
                      history.map((item) => (
                        <div
                          key={item.id}
                          className={`max-w-[92%] rounded-2xl border px-3 py-2.5 shadow-[0_8px_24px_rgba(2,6,23,0.24)] ${
                            item.direction === 'CUSTOMER'
                              ? 'ml-auto border-cyan-300/40 bg-cyan-500/14'
                              : item.direction === 'SYSTEM'
                                ? 'mx-auto border-amber-300/30 bg-amber-500/10'
                                : 'border-white/15 bg-white/[0.04]'
                          }`}
                        >
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                              {item.direction === 'CUSTOMER'
                                ? 'Вы'
                                : item.direction === 'SYSTEM'
                                  ? 'Система'
                                  : item.createdBy?.name || `Менеджер · ${channelLabel(item.channel)}`}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {new Date(item.sentAt).toLocaleString('ru-RU')}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-slate-100">{item.text}</p>
                          {item.status === 'FAILED' && item.errorMessage ? (
                            <p className="mt-1 text-xs text-rose-300">Ошибка: {item.errorMessage}</p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-300">
                        История пока пустая. Напишите сообщение менеджеру, чтобы начать диалог.
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <textarea
                      className="min-h-24 w-full rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-sm text-white placeholder:text-slate-400 sm:min-h-28"
                      placeholder="Опишите вопрос по заказу, подписке или товару..."
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                    />
                    <div className="mt-2.5 flex justify-end">
                      <Button size="sm" onClick={submitMessage} disabled={sending}>
                        {sending ? 'Отправка...' : 'Отправить'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {notice ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">
                  {notice}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => {
          void openDialog();
        }}
        data-analytics-click="consultation_open"
        data-analytics-location="sitewide"
      >
        {label}
      </Button>
      {portalReady && dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
