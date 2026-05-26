'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Lightbulb, MessageCircle, RefreshCw, Search, SendHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { getSocket } from '@/lib/socket';
import { usePageActivity } from '@/hooks/usePageActivity';
import { hydrateLearnedReply, type LearnedReplySuggestion } from '@/lib/reply-suggestions';

const WEBSITE_CHAT_REFRESH_MS = 45000;
const WEBSITE_SUGGESTION_CACHE_TTL_MS = 8 * 60 * 1000;
const WEBSITE_SUGGESTION_REFETCH_COOLDOWN_MS = 90 * 1000;
const WEBSITE_HISTORY_PAGE_SIZE = 120;

type ConversationItem = {
  clientId: number;
  clientName: string;
  clientPhone: string;
  clientCity?: string | null;
  unreadCount: number;
  status: 'UNREAD' | 'READ';
  responseState?: 'WAITING_MANAGER' | 'WAITING_CLIENT';
  totalMessages: number;
  lastMessageText: string;
  lastMessageAt: string;
  lastMessageAuthor: 'CLIENT' | 'MANAGER';
};

type HistoryItem = {
  id: string | number;
  channel: 'WEBSITE' | 'TELEGRAM' | 'VK' | 'MAX';
  status: 'SENT' | 'FAILED';
  entryType?: 'DIRECT' | 'CAMPAIGN' | 'SITE';
  author?: 'CLIENT' | 'MANAGER';
  text?: string | null;
  title?: string | null;
  errorMessage?: string | null;
  readByCustomerAt?: string | null;
  sentAt: string;
  createdBy?: { id: number; name: string } | null;
  attachments?: Array<{
    fileName: string;
    mimeType?: string | null;
    size?: number | null;
  }> | null;
};

type WebsiteChatUpdatedPayload = {
  clientId?: string | number | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeSuggestionQuestion(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[!?.,;:]+$/g, '')
    .trim();
}

export function ClientMessengerView() {
  const isPageActive = usePageActivity();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [mobilePane, setMobilePane] = useState<'list' | 'chat'>('list');

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [replySuggestions, setReplySuggestions] = useState<LearnedReplySuggestion[]>([]);
  const [replySuggestionsLoading, setReplySuggestionsLoading] = useState(false);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const pollBusyRef = useRef(false);
  const selectedClientIdRef = useRef<number | null>(null);
  const conversationsRequestIdRef = useRef(0);
  const blockingConversationRequestIdRef = useRef<number | null>(null);
  const conversationsLoadedOnceRef = useRef(false);
  const historyRequestIdRef = useRef(0);
  const suggestionRequestIdRef = useRef(0);
  const lastSuggestionKeyRef = useRef('');
  const suggestionCacheRef = useRef<Map<string, { at: number; items: LearnedReplySuggestion[] }>>(
    new Map(),
  );
  const suggestionLastFetchRef = useRef<Map<string, number>>(new Map());
  const prependHistorySnapshotRef = useRef<{ top: number; height: number } | null>(null);
  const historyCountRef = useRef(0);

  const resizeDraft = useCallback(() => {
    const element = draftRef.current;
    if (!element) return;
    element.style.height = '0px';
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 42), 116)}px`;
  }, []);

  const loadConversations = useCallback(async (silent?: boolean) => {
    const requestId = ++conversationsRequestIdRef.current;
    const shouldShowLoader = !silent || !conversationsLoadedOnceRef.current;
    if (shouldShowLoader) {
      blockingConversationRequestIdRef.current = requestId;
      setConversationsLoading(true);
    }

    try {
      const response = await fetchWithAuth('/api/clients/communication/conversations');
      if (requestId !== conversationsRequestIdRef.current) {
        return;
      }
      const items = Array.isArray(response?.items) ? response.items : [];
      setConversations(items as ConversationItem[]);
      setSelectedClientId(prev => {
        if (prev && items.some((item: ConversationItem) => item.clientId === prev)) return prev;
        return items.length ? Number(items[0].clientId) : null;
      });
    } catch (error: unknown) {
      if (requestId !== conversationsRequestIdRef.current) {
        return;
      }
      if (!silent) {
        toast.error(getErrorMessage(error, 'Не удалось загрузить диалоги'));
      }
      setConversations([]);
      setSelectedClientId(null);
    } finally {
      if (requestId !== conversationsRequestIdRef.current) {
        return;
      }
      conversationsLoadedOnceRef.current = true;
      if (
        blockingConversationRequestIdRef.current != null &&
        blockingConversationRequestIdRef.current <= requestId
      ) {
        blockingConversationRequestIdRef.current = null;
        setConversationsLoading(false);
      }
    }
  }, []);

  const loadHistory = useCallback(async (
    clientId: number,
    silent?: boolean,
    options?: { append?: boolean },
  ) => {
    const requestId = ++historyRequestIdRef.current;
    if (!silent && !options?.append) {
      setHistoryLoading(true);
    }
    if (options?.append) {
      setHistoryLoadingMore(true);
    }

    try {
      const offset = options?.append ? historyCountRef.current : 0;
      const response = await fetchWithAuth(
        `/api/clients/${clientId}/contact/history?channel=WEBSITE&limit=${WEBSITE_HISTORY_PAGE_SIZE}&offset=${offset}`,
      );
      if (
        requestId !== historyRequestIdRef.current ||
        selectedClientIdRef.current !== clientId
      ) {
        return;
      }
      const items = Array.isArray(response?.items) ? response.items : [];
      const sorted = [...items].sort(
        (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
      ) as HistoryItem[];

      setHistory((prev) => {
        if (options?.append) {
          return [...sorted, ...prev];
        }
        return sorted;
      });

      const hasMore = Boolean(response?.pagination?.hasMore) || items.length >= WEBSITE_HISTORY_PAGE_SIZE;
      setHistoryHasMore(hasMore);
    } catch {
      if (
        requestId !== historyRequestIdRef.current ||
        selectedClientIdRef.current !== clientId
      ) {
        return;
      }
      if (!silent) {
        setHistory([]);
      }
      setHistoryHasMore(false);
    } finally {
      if (requestId !== historyRequestIdRef.current) {
        return;
      }
      if (!silent && !options?.append) {
        setHistoryLoading(false);
      }
      if (options?.append) {
        setHistoryLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedClientId) {
      setHistory([]);
      setHistoryHasMore(false);
      return;
    }
    selectedClientIdRef.current = selectedClientId;
    setHistory([]);
    setHistoryHasMore(false);
    prependHistorySnapshotRef.current = null;
    void loadHistory(selectedClientId);
  }, [selectedClientId, loadHistory]);

  useEffect(() => {
    selectedClientIdRef.current = selectedClientId;
  }, [selectedClientId]);

  useEffect(() => {
    if (!isPageActive) return undefined;

    const socket = getSocket();
    const onWebsiteChatUpdated = (payload: WebsiteChatUpdatedPayload) => {
      const payloadClientId = Number(payload?.clientId || 0);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        void loadConversations(true);
        if (selectedClientId && (!payloadClientId || payloadClientId === selectedClientId)) {
          void loadHistory(selectedClientId, true);
        }
      }, 120);
    };
    socket.on('WEBSITE_CHAT_UPDATED', onWebsiteChatUpdated);

    return () => {
      socket.off('WEBSITE_CHAT_UPDATED', onWebsiteChatUpdated);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [isPageActive, selectedClientId, loadConversations, loadHistory]);

  useEffect(() => {
    if (!isPageActive) return;
    void loadConversations(true);
    if (selectedClientIdRef.current) {
      void loadHistory(selectedClientIdRef.current, true);
    }
  }, [isPageActive, loadConversations, loadHistory]);

  useEffect(() => {
    if (!isPageActive) return undefined;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || pollBusyRef.current) return;
      pollBusyRef.current = true;
      try {
        await loadConversations(true);
        if (selectedClientId) {
          await loadHistory(selectedClientId, true);
        }
      } finally {
        pollBusyRef.current = false;
        if (!cancelled) {
          pollTimerRef.current = window.setTimeout(tick, WEBSITE_CHAT_REFRESH_MS);
        }
      }
    };

    pollTimerRef.current = window.setTimeout(tick, WEBSITE_CHAT_REFRESH_MS);

    return () => {
      cancelled = true;
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isPageActive, loadConversations, loadHistory, selectedClientId]);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const snapshot = prependHistorySnapshotRef.current;
    if (snapshot) {
      const delta = container.scrollHeight - snapshot.height;
      container.scrollTop = snapshot.top + Math.max(0, delta);
      prependHistorySnapshotRef.current = null;
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [history]);
  useEffect(() => {
    historyCountRef.current = history.length;
  }, [history.length]);

  useEffect(() => {
    resizeDraft();
  }, [draft, resizeDraft]);

  useEffect(() => {
    const syncPaneWithViewport = () => {
      if (window.innerWidth >= 1280) {
        setMobilePane('list');
        return;
      }

      if (!selectedClientId) {
        setMobilePane('list');
      }
    };

    syncPaneWithViewport();
    window.addEventListener('resize', syncPaneWithViewport);
    return () => window.removeEventListener('resize', syncPaneWithViewport);
  }, [selectedClientId]);

  const visibleConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter(item => {
      if (filter === 'unread' && item.unreadCount <= 0) return false;
      if (!q) return true;
      return (
        item.clientName.toLowerCase().includes(q) ||
        item.clientPhone.toLowerCase().includes(q) ||
        String(item.lastMessageText || '').toLowerCase().includes(q)
      );
    });
  }, [conversations, filter, search]);

  const selectedConversation = useMemo(
    () => conversations.find(item => item.clientId === selectedClientId) || null,
    [conversations, selectedClientId],
  );
  const visibleHistory = useMemo(
    () =>
      history.filter(item =>
        Boolean(
          String(item.text || '').trim() ||
            item.title?.trim() ||
            item.attachments?.length ||
            (item.status === 'FAILED' && item.errorMessage?.trim()),
        ),
      ),
    [history],
  );
  const latestClientQuestion = useMemo(() => {
    const lastClientHistoryMessage = [...history]
      .reverse()
      .find(item => (item.author === 'CLIENT' || item.entryType === 'SITE') && item.text?.trim());
    if (lastClientHistoryMessage?.text?.trim()) {
      return lastClientHistoryMessage.text.trim();
    }
    if (
      selectedConversation?.lastMessageAuthor === 'CLIENT' &&
      selectedConversation.lastMessageText?.trim()
    ) {
      return selectedConversation.lastMessageText.trim();
    }
    return null;
  }, [history, selectedConversation]);

  useEffect(() => {
    if (!suggestionsExpanded) {
      lastSuggestionKeyRef.current = '';
      setReplySuggestions([]);
      setReplySuggestionsLoading(false);
      return;
    }

    const question = latestClientQuestion;
    if (!question) {
      const selectedPrefix = `${selectedClientId || 0}:`;
      if (!selectedClientId || !lastSuggestionKeyRef.current.startsWith(selectedPrefix)) {
        lastSuggestionKeyRef.current = '';
        setReplySuggestions([]);
        setReplySuggestionsLoading(false);
      }
      return;
    }

    const normalizedQuestion = normalizeSuggestionQuestion(question);
    const suggestionKey = `${selectedClientId || 0}:${normalizedQuestion}`;
    if (lastSuggestionKeyRef.current === suggestionKey) {
      return;
    }

    const cached = suggestionCacheRef.current.get(suggestionKey);
    if (cached && Date.now() - cached.at < WEBSITE_SUGGESTION_CACHE_TTL_MS) {
      lastSuggestionKeyRef.current = suggestionKey;
      setReplySuggestions(cached.items);
      setReplySuggestionsLoading(false);
      return;
    }

    const lastRequestedAt = suggestionLastFetchRef.current.get(suggestionKey) || 0;
    if (
      Date.now() - lastRequestedAt < WEBSITE_SUGGESTION_REFETCH_COOLDOWN_MS &&
      replySuggestions.length > 0
    ) {
      lastSuggestionKeyRef.current = suggestionKey;
      return;
    }

    const requestId = ++suggestionRequestIdRef.current;
    const params = new URLSearchParams({
      question,
      limit: '3',
      days: '120',
    });

    if (replySuggestions.length === 0) {
      setReplySuggestionsLoading(true);
    }
    suggestionLastFetchRef.current.set(suggestionKey, Date.now());
    void fetchWithAuth(`/api/analytics/ml/marketplace/reply-suggestions?${params.toString()}`)
      .then((payload) => {
        if (requestId !== suggestionRequestIdRef.current) return;
        const next = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
        suggestionCacheRef.current.set(suggestionKey, { at: Date.now(), items: next });
        lastSuggestionKeyRef.current = suggestionKey;
        setReplySuggestions(next);
      })
      .catch(() => {
        if (requestId !== suggestionRequestIdRef.current) return;
        const fallback = suggestionCacheRef.current.get(suggestionKey)?.items || [];
        setReplySuggestions(fallback);
      })
      .finally(() => {
        if (requestId === suggestionRequestIdRef.current) {
          setReplySuggestionsLoading(false);
        }
      });
  }, [latestClientQuestion, selectedClientId, suggestionsExpanded]);

  const applyReplySuggestion = useCallback((suggestion: LearnedReplySuggestion) => {
    const hydrated = hydrateLearnedReply(suggestion.answer);
    setDraft((current) => (current.trim() ? `${current.trim()}\n${hydrated}` : hydrated));
    window.setTimeout(() => {
      draftRef.current?.focus();
      resizeDraft();
    }, 0);
  }, [resizeDraft]);

  const handleSend = async () => {
    if (!selectedClientId) return;
    const text = draft.trim();
    if (!text) return;

    setSending(true);
    try {
      await fetchWithAuth(`/api/clients/${selectedClientId}/contact`, {
        method: 'POST',
        body: JSON.stringify({
          channel: 'WEBSITE',
          text,
        }),
      });
      setDraft('');
      await Promise.all([loadConversations(true), loadHistory(selectedClientId, true)]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Не удалось отправить сообщение'));
    } finally {
      setSending(false);
    }
  };

  const handleLoadOlderHistory = async () => {
    if (!selectedClientId || historyLoadingMore || !historyHasMore) return;
    const container = listRef.current;
    if (container) {
      prependHistorySnapshotRef.current = {
        top: container.scrollTop,
        height: container.scrollHeight,
      };
    }
    await loadHistory(selectedClientId, true, { append: true });
  };

  return (
    <div className="grid grid-cols-1 gap-2 xl:grid-cols-[380px,1fr] xl:gap-4">
      <div
        className={`crm-chat-pane glass flex min-h-[18rem] flex-col overflow-hidden rounded-2xl border border-slate-700/50 ${
          mobilePane === 'chat' ? 'hidden xl:flex' : 'flex'
        }`}
      >
        <div className="space-y-2 border-b border-slate-700/50 p-2.5 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4.5 w-4.5 text-cyan-300" />
              <p className="text-sm font-semibold text-white sm:text-base">Сообщения</p>
            </div>
            <button
              type="button"
              onClick={() => void loadConversations()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-600 bg-slate-900/65 text-slate-300 transition hover:bg-slate-700/40"
              title="Обновить"
            >
              <RefreshCw className={`w-4 h-4 ${conversationsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="w-full rounded-xl bg-slate-900/70 border border-slate-700 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500"
              placeholder="Поиск по диалогам"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`min-h-8 rounded-xl px-3 text-[12px] font-semibold sm:text-sm ${
                filter === 'all'
                  ? 'bg-cyan-600/30 text-cyan-100 border border-cyan-500/40'
                  : 'bg-slate-800/60 text-slate-300 border border-slate-700'
              }`}
            >
              Все
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`min-h-8 rounded-xl px-3 text-[12px] font-semibold sm:text-sm ${
                filter === 'unread'
                  ? 'bg-cyan-600/30 text-cyan-100 border border-cyan-500/40'
                  : 'bg-slate-800/60 text-slate-300 border border-slate-700'
              }`}
            >
              Непрочитанные
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversationsLoading ? (
            <div className="p-4 text-sm text-slate-400">Загрузка диалогов...</div>
          ) : visibleConversations.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">Нет диалогов от клиентов.</div>
          ) : (
            visibleConversations.map(item => {
              const active = item.clientId === selectedClientId;
                return (
                  <button
                    key={item.clientId}
                    type="button"
                    onClick={() => {
                      setSelectedClientId(item.clientId);
                      if (typeof window !== 'undefined' && window.innerWidth < 1280) {
                        setMobilePane('chat');
                      }
                    }}
                    className={`w-full px-3 py-2 text-left border-b border-slate-800/70 transition sm:px-4 sm:py-3 ${
                      active ? 'bg-cyan-600/15' : 'hover:bg-slate-800/50'
                    }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white sm:text-[15px]">{item.clientName}</p>
                      <p className="truncate text-[11px] text-slate-400 sm:text-xs">
                        {item.clientPhone}
                        {item.clientCity ? ` · ${item.clientCity}` : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-slate-500 sm:text-[11px]">{formatTime(item.lastMessageAt)}</p>
                      {item.unreadCount > 0 ? (
                        <span className="mt-1 inline-flex min-w-5 justify-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-950">
                          {item.unreadCount}
                        </span>
                      ) : (
                        <span className="mt-1 inline-flex text-[11px] text-slate-500">✓✓</span>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-300 sm:text-sm">
                    {item.lastMessageText}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div
        className={`crm-chat-pane glass flex min-h-[18rem] flex-col overflow-hidden rounded-2xl border border-slate-700/50 ${
          mobilePane === 'list' ? 'hidden xl:flex' : 'flex'
        }`}
      >
        {!selectedConversation ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm px-6 text-center">
            <div className="space-y-3">
              <p>Выберите диалог. Показываются только клиенты, которые уже написали в чат.</p>
              <button
                type="button"
                onClick={() => setMobilePane('list')}
                className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 xl:hidden"
              >
                Вернуться к списку
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-slate-700/50 bg-slate-900/70 px-3 py-2 sm:px-5 sm:py-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobilePane('list')}
                    className="mb-2 inline-flex items-center gap-1 rounded-xl border border-slate-600 bg-slate-950/70 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 xl:hidden"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Диалоги
                  </button>
                  <p className="text-[15px] font-semibold text-white sm:text-lg">{selectedConversation.clientName}</p>
                  <p className="text-[11px] text-slate-400 sm:text-sm">
                    {selectedConversation.clientPhone}
                    {selectedConversation.clientCity ? ` · ${selectedConversation.clientCity}` : ''}
                  </p>
                </div>
                <div className="max-w-[42vw] shrink-0 text-right text-[11px] sm:max-w-none sm:text-xs">
                  {selectedConversation.responseState === 'WAITING_MANAGER' ? (
                    <span className="inline-flex max-w-full items-center rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-amber-200">
                      <span className="truncate">Ждёт ответ</span>
                      <span className="ml-1 shrink-0">• {selectedConversation.unreadCount}</span>
                    </span>
                  ) : (
                    <span className="inline-flex max-w-full rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-1 text-emerald-200">
                      Ждёт клиента
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-950/35 px-2.5 py-2.5 sm:px-5 sm:py-4">
              <div className="flex min-h-full flex-col justify-end gap-2">
                {historyHasMore ? (
                  <div className="flex justify-center pb-1">
                    <button
                      type="button"
                      onClick={() => void handleLoadOlderHistory()}
                      disabled={historyLoadingMore}
                      className="rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800/70 disabled:opacity-60"
                    >
                      {historyLoadingMore ? 'Загружаю ещё...' : 'Показать более ранние сообщения'}
                    </button>
                  </div>
                ) : null}
                {historyLoading ? (
                  <p className="text-sm text-slate-400">Загрузка истории...</p>
                ) : visibleHistory.length === 0 ? (
                  <p className="text-sm text-slate-400">История пока пустая.</p>
                ) : (
                  visibleHistory.map(item => {
                    const fromClient = item.author === 'CLIENT' || item.entryType === 'SITE';
                    const fromManager = !fromClient;
                    const title = String(item.title || '').trim();
                    const text = String(item.text || '').trim();
                    return (
                      <div
                        key={item.id}
                        className={`flex ${fromClient ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[82%] rounded-2xl px-3 py-2 border text-sm shadow-sm sm:max-w-[80%] ${
                            fromClient
                              ? 'bg-slate-800/80 border-slate-700 text-slate-100'
                              : 'bg-cyan-600/20 border-cyan-500/40 text-cyan-50'
                          }`}
                        >
                          {title ? <p className="mb-1 text-sm font-semibold">{title}</p> : null}
                          {text ? (
                            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[13px] leading-5 sm:text-sm">
                              {text}
                            </p>
                          ) : null}
                          {item.attachments?.length ? (
                            <div className="mt-1.5 space-y-1">
                              {item.attachments.map((file, index) => (
                                <p key={`${item.id}-f-${index}`} className="text-xs text-slate-300">
                                  Файл: {file.fileName}
                                </p>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400 sm:text-[11px]">
                            <span>{formatTime(item.sentAt)}</span>
                            {fromManager ? <span>{item.readByCustomerAt ? '✓✓' : '✓'}</span> : null}
                          </div>
                          {item.status === 'FAILED' && item.errorMessage ? (
                            <p className="mt-1 text-xs text-rose-300">Ошибка: {item.errorMessage}</p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-700/50 bg-slate-950/92 p-2.5 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] backdrop-blur sm:p-4">
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSuggestionsExpanded((value) => !value)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition ${
                    suggestionsExpanded
                      ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100'
                      : 'border-slate-700/70 bg-slate-900/65 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  {suggestionsExpanded ? 'Скрыть подсказки' : 'Показать подсказки'}
                </button>

                {suggestionsExpanded ? (
                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/8 px-3 py-2.5">
                    <div className="text-[11px] leading-4 text-slate-400">
                      Варианты ответов по похожим вопросам из истории диалогов.
                    </div>
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                      {replySuggestionsLoading && !replySuggestions.length ? (
                        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/75 px-3 py-2 text-xs text-slate-400">
                          Подбираю варианты...
                        </div>
                      ) : replySuggestions.length ? (
                        replySuggestions.map((suggestion, index) => (
                          <button
                            key={`${suggestion.answer}-${index}`}
                            type="button"
                            onClick={() => applyReplySuggestion(suggestion)}
                            className="min-w-[170px] max-w-[260px] rounded-2xl border border-slate-700/70 bg-slate-950/80 px-3 py-2 text-left transition hover:border-cyan-400/40 hover:bg-slate-900/90 sm:min-w-[220px] sm:max-w-[280px]"
                          >
                            <div className="line-clamp-3 text-[12px] font-medium leading-5 text-slate-100">
                              {hydrateLearnedReply(suggestion.answer)}
                            </div>
                            <div className="mt-2 text-[10px] leading-4 text-slate-400">
                              {suggestion.reason}
                              {suggestion.successRate > 0 ? ` • ${suggestion.successRate}%` : ''}
                              {suggestion.count ? ` • ${suggestion.count} прим.` : ''}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-slate-700/70 bg-slate-950/75 px-3 py-2 text-xs text-slate-400">
                          Пока нет релевантных подсказок для этого диалога.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-[minmax(0,1fr)_42px] items-end gap-2 sm:flex">
                  <textarea
                    ref={draftRef}
                    value={draft}
                    onChange={event => setDraft(event.target.value)}
                    onInput={resizeDraft}
                    placeholder="Введите ответ клиенту..."
                    rows={1}
                    className="max-h-[110px] min-h-[42px] min-w-0 resize-none rounded-2xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm leading-5 text-white placeholder:text-slate-500 sm:flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-2xl bg-cyan-600 text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 sm:self-end"
                  >
                    <SendHorizontal className="w-4 h-4" />
                    <span className="hidden sm:inline">{sending ? 'Отправка...' : 'Отправить'}</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
