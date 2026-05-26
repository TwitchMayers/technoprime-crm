'use client';

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ChevronLeft,
  ExternalLink,
  ImagePlus,
  Lightbulb,
  Link2,
  MessageCircle,
  Pin,
  RefreshCw,
  Search,
  SendHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { usePageActivity } from '@/hooks/usePageActivity';
import { useIsMobileViewport } from '@/hooks/useIsMobileViewport';
import { hydrateLearnedReply, type LearnedReplySuggestion } from '@/lib/reply-suggestions';

type AvitoAccount = {
  id: number;
  displayName: string;
  externalAccountId?: string | null;
  status: string;
  expiresAt?: string | null;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  requiresReconnect?: boolean;
  connectionHint?: string | null;
  hasLiveAccessToken?: boolean;
};

type AvitoChat = {
  id: string;
  updatedAt: string;
  createdAt?: string | null;
  unreadCount: number;
  isPinned?: boolean;
  counterpart: {
    id?: string | null;
    name: string;
    avatarUrl?: string | null;
  };
  item: {
    id?: string | null;
    title: string;
    price?: string | null;
    url?: string | null;
  };
  lastMessage: {
    id?: string | null;
    text?: string | null;
    type?: string | null;
    direction: string;
    createdAt?: string | null;
  };
};

type AvitoMessage = {
  id: string;
  text?: string | null;
  type?: string | null;
  imageUrl?: string | null;
  imageSizes?: Record<string, string> | null;
  voiceUrl?: string | null;
  direction: string;
  authorId?: string | null;
  createdAt: string;
  isRead?: boolean;
  readAt?: string | null;
  quote?: {
    id?: string | null;
    text?: string | null;
    type?: string | null;
    imageUrl?: string | null;
  } | null;
};

type PreparedAttachment = {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  originalSize: number;
};

const AVITO_MAX_PREPARED_IMAGE_BYTES = 4 * 1024 * 1024;
const AVITO_PREVIEW_IMAGE_BYTES = 1.8 * 1024 * 1024;
const AVITO_IMAGE_MAX_DIMENSION = 1600;
const AVITO_CHATS_LIMIT = 30;
const AVITO_MESSAGES_LIMIT = 40;
const AVITO_CHAT_POLL_MS = 12000;
const AVITO_ACTIVE_CHAT_MESSAGES_POLL_MS = 10000;
const AVITO_IDLE_CHAT_MESSAGES_POLL_MS = 22000;
const SUGGESTION_CACHE_TTL_MS = 8 * 60 * 1000;
const SUGGESTION_REFETCH_COOLDOWN_MS = 90 * 1000;

function buildChatLiveKey(chat: AvitoChat) {
  return [
    chat.lastMessage.id || '',
    chat.lastMessage.createdAt || '',
    chat.unreadCount || 0,
    chat.lastMessage.text || '',
  ].join(':');
}

function compareChatsByPriority(left: AvitoChat, right: AvitoChat) {
  if (Boolean(left.isPinned) !== Boolean(right.isPinned)) {
    return left.isPinned ? -1 : 1;
  }
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

function normalizeSuggestionQuestion(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[!?.,;:]+$/g, '')
    .trim();
}

function formatTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function buildProcessedImageName(file: File, mime: string) {
  const base = file.name.replace(/\.[^.]+$/, '');
  return mime === 'image/png' ? `${base}.png` : `${base}.jpg`;
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number) {
  return new Promise<Blob | null>(resolve => {
    canvas.toBlob(blob => resolve(blob), mime, quality);
  });
}

async function loadImageFile(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Не удалось открыть изображение'));
      element.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function prepareAvitoImage(file: File): Promise<PreparedAttachment> {
  const image = await loadImageFile(file);
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const shouldResize = largestSide > AVITO_IMAGE_MAX_DIMENSION;
  const shouldCompress = file.size > AVITO_PREVIEW_IMAGE_BYTES;
  const isGif = file.type.toLowerCase() === 'image/gif';

  if (!shouldResize && !shouldCompress) {
    return {
      file,
      previewUrl: URL.createObjectURL(file),
      width: image.naturalWidth,
      height: image.naturalHeight,
      originalSize: file.size,
    };
  }

  if (isGif) {
    throw new Error(
      'GIF лучше отправлять маленьким файлом до 1.8 МБ: автоматическое сжатие для него не подходит'
    );
  }

  const scale = shouldResize ? AVITO_IMAGE_MAX_DIMENSION / largestSide : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Не удалось подготовить изображение для Avito');
  }

  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const qualities = [0.86, 0.78, 0.68, 0.58];
  let processedBlob: Blob | null = null;
  for (const quality of qualities) {
    processedBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (processedBlob && processedBlob.size <= AVITO_MAX_PREPARED_IMAGE_BYTES) break;
  }

  if (!processedBlob || processedBlob.size > AVITO_MAX_PREPARED_IMAGE_BYTES) {
    throw new Error(
      'Фото получилось слишком тяжёлым даже после обработки. Выберите другое изображение или обрежьте его.'
    );
  }

  const preparedFile = new File(
    [processedBlob],
    buildProcessedImageName(file, processedBlob.type || 'image/jpeg'),
    { type: processedBlob.type || 'image/jpeg', lastModified: Date.now() }
  );

  return {
    file: preparedFile,
    previewUrl: URL.createObjectURL(preparedFile),
    width,
    height,
    originalSize: file.size,
  };
}

export function AvitoMessengerView() {
  const isPageActive = usePageActivity();
  const isMobileViewport = useIsMobileViewport();
  const [accounts, setAccounts] = useState<AvitoAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chats, setChats] = useState<AvitoChat[]>([]);
  const [chatsHasMore, setChatsHasMore] = useState(false);
  const [chatsLoadingMore, setChatsLoadingMore] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesLoadingMore, setMessagesLoadingMore] = useState(false);
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [messages, setMessages] = useState<AvitoMessage[]>([]);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [attachedImage, setAttachedImage] = useState<PreparedAttachment | null>(null);
  const [sending, setSending] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [replySuggestions, setReplySuggestions] = useState<LearnedReplySuggestion[]>([]);
  const [replySuggestionsLoading, setReplySuggestionsLoading] = useState(false);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false);
  const [pinUpdating, setPinUpdating] = useState(false);
  const [pinnedCount, setPinnedCount] = useState(0);
  const [pinnedLimit, setPinnedLimit] = useState(3);
  const [mobilePane, setMobilePane] = useState<'list' | 'chat'>('list');
  const chatsListRef = useRef<HTMLDivElement | null>(null);
  const chatsListScrollTopRef = useRef(0);
  const chatsListRestoreRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const liveKnownChatsRef = useRef<Record<string, string>>({});
  const livePrimedRef = useRef(false);
  const suggestionRequestIdRef = useRef(0);
  const lastSuggestionKeyRef = useRef('');
  const suggestionCacheRef = useRef<Map<string, { at: number; items: LearnedReplySuggestion[] }>>(
    new Map()
  );
  const suggestionLastFetchRef = useRef<Map<string, number>>(new Map());
  const selectedChatLiveKeyRef = useRef('');
  const selectedAccountIdRef = useRef<number | null>(null);
  const selectedChatIdRef = useRef<string | null>(null);
  const chatsRequestIdRef = useRef(0);
  const messagesRequestIdRef = useRef(0);
  const lastMessagesPolledAtRef = useRef(0);
  const prependSnapshotRef = useRef<{ top: number; height: number } | null>(null);
  const chatsCountRef = useRef(0);
  const chatsRef = useRef<AvitoChat[]>([]);
  const messagesCountRef = useRef(0);
  const messagesNextOffsetRef = useRef(0);

  const resizeDraft = useCallback(() => {
    const element = draftRef.current;
    if (!element) return;
    element.style.height = '0px';
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 42), 116)}px`;
  }, []);
  const isChatsListVisible = !isMobileViewport || mobilePane === 'list';

  const rememberChatsListScroll = useCallback(
    (force = false) => {
      const container = chatsListRef.current;
      if (!container) return;
      if (!force && !isChatsListVisible) return;
      chatsListScrollTopRef.current = container.scrollTop;
      chatsListRestoreRef.current = true;
    },
    [isChatsListVisible]
  );

  const selectedChat = useMemo(
    () => chats.find(chat => chat.id === selectedChatId) || null,
    [chats, selectedChatId]
  );
  const selectedAccount = useMemo(
    () => accounts.find(account => account.id === selectedAccountId) || null,
    [accounts, selectedAccountId]
  );
  useEffect(() => {
    chatsCountRef.current = chats.length;
    chatsRef.current = chats;
  }, [chats]);
  useEffect(() => {
    selectedAccountIdRef.current = selectedAccountId;
  }, [selectedAccountId]);
  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);
  useEffect(() => {
    messagesCountRef.current = messages.length;
  }, [messages.length]);
  const latestInboundQuestion = useMemo(() => {
    const latestFromHistory = [...messages]
      .reverse()
      .find(message => message.direction !== 'out' && message.text?.trim());
    if (latestFromHistory?.text?.trim()) {
      return latestFromHistory.text.trim();
    }
    if (selectedChat?.lastMessage.direction !== 'out' && selectedChat?.lastMessage.text?.trim()) {
      return selectedChat.lastMessage.text.trim();
    }
    return null;
  }, [messages, selectedChat]);

  const registerLiveChats = useCallback(
    (accountId: number, items: AvitoChat[]) => {
      const nextKnown: Record<string, string> = {};

      for (const chat of items) {
        const storageKey = `${accountId}:${chat.id}`;
        const nextKey = buildChatLiveKey(chat);

        nextKnown[storageKey] = nextKey;
      }

      liveKnownChatsRef.current = nextKnown;
      livePrimedRef.current = true;
    },
    []
  );

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const response = await fetchWithAuth('/api/logistics/marketplace-accounts/avito/connected');
      const items = Array.isArray(response) ? response : [];
      setAccounts(items);
      setSelectedAccountId(current => {
        if (current && items.some((item: AvitoAccount) => item.id === current)) return current;
        const preferred = items.find((item: AvitoAccount) => !item.requiresReconnect) || items[0];
        return preferred?.id || null;
      });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Не удалось загрузить аккаунты Avito'));
      setAccounts([]);
      setSelectedAccountId(null);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const loadChats = useCallback(
    async (
      accountId: number,
      silent?: boolean,
      options?: { live?: boolean; append?: boolean }
    ) => {
      const requestId = ++chatsRequestIdRef.current;
      if (!silent && !options?.append) setChatsLoading(true);
      if (options?.append) setChatsLoadingMore(true);

      try {
        const params = new URLSearchParams();
        params.set('limit', String(AVITO_CHATS_LIMIT));
        params.set('offset', String(options?.append ? chatsCountRef.current : 0));
        if (unreadOnly) params.set('unreadOnly', 'true');
        if (options?.live) params.set('live', 'true');
        const response = await fetchWithAuth(
          `/api/logistics/marketplace-accounts/${accountId}/avito/chats?${params.toString()}`
        );
        if (requestId !== chatsRequestIdRef.current || selectedAccountIdRef.current !== accountId) {
          return [] as AvitoChat[];
        }
        const items = Array.isArray(response?.items) ? (response.items as AvitoChat[]) : [];
        rememberChatsListScroll();
        setPinnedCount(Number(response?.pinnedCount || 0));
        setPinnedLimit(Number(response?.pinnedLimit || 3));
        setChatsHasMore(items.length >= AVITO_CHATS_LIMIT);

        if (options?.live) {
          registerLiveChats(accountId, items);
        }

        setChats(previous => {
          if (options?.append) {
            const incomingMap = new Map(items.map(chat => [chat.id, chat]));
            const updatedExisting = previous.map(chat => incomingMap.get(chat.id) || chat);
            const existingIds = new Set(updatedExisting.map(chat => chat.id));
            const appended = items.filter(chat => !existingIds.has(chat.id));
            if (!appended.length) return updatedExisting;
            return [...updatedExisting, ...appended];
          }

          if (previous.length > AVITO_CHATS_LIMIT && (options?.live || silent)) {
            // When manager is browsing older dialogs, keep order fully stable and patch only visible items.
            // This prevents jumping to the top when selecting old chats and during live polling.
            const incomingMap = new Map(items.map(chat => [chat.id, chat]));
            return previous.map(chat => incomingMap.get(chat.id) || chat);
          }

          const freshIds = new Set(items.map(chat => chat.id));
          const staleTail = previous.filter(chat => !freshIds.has(chat.id));
          const merged = [...items, ...staleTail];
          const map = new Map<string, AvitoChat>();
          for (const chat of merged) {
            map.set(chat.id, chat);
          }
          return Array.from(map.values()).sort(compareChatsByPriority);
        });

        setSelectedChatId(current => {
          if (!current) return items[0]?.id || null;
          return current;
        });

        return items;
      } catch (error: unknown) {
        if (requestId !== chatsRequestIdRef.current) {
          return [] as AvitoChat[];
        }
        if (!silent) {
          toast.error(getErrorMessage(error, 'Не удалось загрузить чаты Avito'));
          setChats([]);
          setSelectedChatId(null);
          setPinnedCount(0);
        }
        return [] as AvitoChat[];
      } finally {
        if (requestId === chatsRequestIdRef.current) {
          if (!silent && !options?.append) setChatsLoading(false);
          if (options?.append) setChatsLoadingMore(false);
        }
      }
    },
    [registerLiveChats, rememberChatsListScroll, unreadOnly]
  );

  const loadMessages = useCallback(
    async (
      accountId: number,
      chatId: string,
      silent?: boolean,
      options?: { live?: boolean; append?: boolean }
    ) => {
      const requestId = ++messagesRequestIdRef.current;
      if (!silent && !options?.append) setMessagesLoading(true);
      if (options?.append) setMessagesLoadingMore(true);

      try {
        setMessagesError(null);
        const params = new URLSearchParams();
        params.set('limit', String(AVITO_MESSAGES_LIMIT));
        params.set('offset', String(options?.append ? messagesNextOffsetRef.current : 0));
        if (options?.live) params.set('live', 'true');
        const response = await fetchWithAuth(
          `/api/logistics/marketplace-accounts/${accountId}/avito/chats/${encodeURIComponent(chatId)}/messages?${params.toString()}`
        );
        if (
          requestId !== messagesRequestIdRef.current ||
          selectedAccountIdRef.current !== accountId ||
          selectedChatIdRef.current !== chatId
        ) {
          return [] as AvitoMessage[];
        }
        const items = Array.isArray(response?.items) ? (response.items as AvitoMessage[]) : [];
        const nextOffset = Number(response?.nextOffset);
        messagesNextOffsetRef.current =
          Number.isFinite(nextOffset) && nextOffset >= 0
            ? nextOffset
            : (options?.append ? messagesNextOffsetRef.current : 0) + items.length;

        setMessagesHasMore(Boolean(response?.hasMore) || items.length >= AVITO_MESSAGES_LIMIT);
        setMessages(previous => {
          const map = new Map<string, AvitoMessage>();
          const merged = options?.append ? [...items, ...previous] : items;
          for (const message of merged) {
            map.set(message.id, message);
          }
          return Array.from(map.values()).sort(
            (left, right) =>
              new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
          );
        });

        return items;
      } catch (error: unknown) {
        if (requestId !== messagesRequestIdRef.current) {
          return [] as AvitoMessage[];
        }
        setMessagesError(getErrorMessage(error, 'Не удалось загрузить сообщения Avito'));
        if (!silent) {
          toast.error(getErrorMessage(error, 'Не удалось загрузить сообщения Avito'));
          setMessages([]);
        }
        return [] as AvitoMessage[];
      } finally {
        if (requestId === messagesRequestIdRef.current) {
          if (!silent && !options?.append) setMessagesLoading(false);
          if (options?.append) setMessagesLoadingMore(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (!selectedAccountId) {
      setChats([]);
      setChatsHasMore(false);
      setPinnedCount(0);
      setSelectedChatId(null);
      liveKnownChatsRef.current = {};
      livePrimedRef.current = false;
      selectedChatLiveKeyRef.current = '';
      lastMessagesPolledAtRef.current = 0;
      return;
    }
    liveKnownChatsRef.current = {};
    livePrimedRef.current = false;
    selectedChatLiveKeyRef.current = '';
    lastMessagesPolledAtRef.current = 0;
    setChatsHasMore(false);
    setPinnedCount(0);
    void loadChats(selectedAccountId);
  }, [selectedAccountId, unreadOnly, loadChats]);

  useEffect(() => {
    if (!selectedAccountId || !selectedChatId) {
      setMessages([]);
      setMessagesError(null);
      setMessagesHasMore(false);
      messagesNextOffsetRef.current = 0;
      prependSnapshotRef.current = null;
      selectedChatLiveKeyRef.current = '';
      lastMessagesPolledAtRef.current = 0;
      return;
    }
    setMessages([]);
    setMessagesError(null);
    setMessagesHasMore(false);
    messagesNextOffsetRef.current = 0;
    prependSnapshotRef.current = null;
    selectedChatLiveKeyRef.current = '';
    lastMessagesPolledAtRef.current = 0;
    void loadMessages(selectedAccountId, selectedChatId);
  }, [selectedAccountId, selectedChatId, loadMessages]);

  useEffect(() => {
    if (!selectedAccountId) return;
    if (!selectedChatId) {
      if (chats.length) {
        setSelectedChatId(chats[0]?.id || null);
      }
      return;
    }
    if (!chats.some(chat => chat.id === selectedChatId)) {
      setSelectedChatId(chats[0]?.id || null);
    }
  }, [chats, selectedAccountId, selectedChatId]);

  useLayoutEffect(() => {
    if (!chatsListRestoreRef.current || !isChatsListVisible) return;
    const container = chatsListRef.current;
    if (!container) {
      return;
    }
    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
    container.scrollTop = Math.min(chatsListScrollTopRef.current, maxTop);
    chatsListRestoreRef.current = false;
  }, [chats, selectedChatId, isChatsListVisible]);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const snapshot = prependSnapshotRef.current;
    if (snapshot) {
      const delta = container.scrollHeight - snapshot.height;
      container.scrollTop = snapshot.top + Math.max(0, delta);
      prependSnapshotRef.current = null;
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages]);

  useEffect(() => {
    resizeDraft();
  }, [draft, resizeDraft]);

  useEffect(() => {
    if (!selectedAccountId || !isPageActive || selectedAccount?.requiresReconnect) return;

    let cancelled = false;

    const syncMessagesIfNeeded = async (nextChats: AvitoChat[]) => {
      if (!selectedChatId) return;
      if (isMobileViewport && mobilePane !== 'chat') return;

      const selectedChatFromList = nextChats.find(chat => chat.id === selectedChatId) || null;
      const nextLiveKey = selectedChatFromList ? buildChatLiveKey(selectedChatFromList) : '';
      const now = Date.now();
      const minInterval =
        mobilePane === 'chat'
          ? AVITO_ACTIVE_CHAT_MESSAGES_POLL_MS
          : AVITO_IDLE_CHAT_MESSAGES_POLL_MS;
      const shouldReloadMessages =
        !lastMessagesPolledAtRef.current ||
        now - lastMessagesPolledAtRef.current >= minInterval ||
        (nextLiveKey && nextLiveKey !== selectedChatLiveKeyRef.current);

      if (!shouldReloadMessages) return;

      await loadMessages(selectedAccountId, selectedChatId, true, { live: true });
      selectedChatLiveKeyRef.current = nextLiveKey;
      lastMessagesPolledAtRef.current = now;
    };

    const tick = async () => {
      if (cancelled) return;
      const nextChats = await loadChats(selectedAccountId, true, {
        live: true,
      });
      await syncMessagesIfNeeded(nextChats);
      if (cancelled) return;
      pollTimerRef.current = window.setTimeout(tick, AVITO_CHAT_POLL_MS);
    };

    pollTimerRef.current = window.setTimeout(tick, AVITO_CHAT_POLL_MS);

    return () => {
      cancelled = true;
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [
    isMobileViewport,
    isPageActive,
    loadChats,
    loadMessages,
    mobilePane,
    selectedAccount?.requiresReconnect,
    selectedAccountId,
    selectedChatId,
  ]);

  useEffect(() => {
    return () => {
      if (attachedImage?.previewUrl) {
        URL.revokeObjectURL(attachedImage.previewUrl);
      }
    };
  }, [attachedImage?.previewUrl]);

  const visibleChats = useMemo(() => {
    const query = search.trim().toLowerCase();
    return chats.filter(chat => {
      if (!query) return true;
      const haystack = [
        chat.counterpart.name,
        chat.item.title,
        chat.item.price,
        chat.lastMessage.text,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [chats, search]);

  useEffect(() => {
    if (!suggestionsExpanded) {
      lastSuggestionKeyRef.current = '';
      setReplySuggestions([]);
      setReplySuggestionsLoading(false);
      return;
    }

    const question = latestInboundQuestion;
    const selectedChatIdValue = selectedChat?.id || '';
    const selectedItemTitle = selectedChat?.item?.title || '';
    if (!question || !selectedChatIdValue) {
      if (!messagesLoading) {
        lastSuggestionKeyRef.current = '';
        setReplySuggestions([]);
        setReplySuggestionsLoading(false);
      }
      return;
    }

    const normalizedQuestion = normalizeSuggestionQuestion(question);
    const suggestionKey = `${selectedAccountId || 0}:${selectedChatIdValue}:${normalizedQuestion}`;
    if (lastSuggestionKeyRef.current === suggestionKey) {
      return;
    }

    const cached = suggestionCacheRef.current.get(suggestionKey);
    if (cached && Date.now() - cached.at < SUGGESTION_CACHE_TTL_MS) {
      lastSuggestionKeyRef.current = suggestionKey;
      setReplySuggestions(cached.items);
      setReplySuggestionsLoading(false);
      return;
    }

    const lastRequestedAt = suggestionLastFetchRef.current.get(suggestionKey) || 0;
    if (
      Date.now() - lastRequestedAt < SUGGESTION_REFETCH_COOLDOWN_MS &&
      replySuggestions.length > 0
    ) {
      lastSuggestionKeyRef.current = suggestionKey;
      return;
    }

    const requestId = ++suggestionRequestIdRef.current;
    const params = new URLSearchParams();
    params.set('question', question);
    params.set('limit', '3');
    params.set('days', '120');
    if (selectedAccountId) params.set('accountId', String(selectedAccountId));
    if (selectedItemTitle) params.set('itemTitle', selectedItemTitle);

    if (replySuggestions.length === 0) {
      setReplySuggestionsLoading(true);
    }
    suggestionLastFetchRef.current.set(suggestionKey, Date.now());
    void fetchWithAuth(`/api/analytics/ml/marketplace/reply-suggestions?${params.toString()}`)
      .then(payload => {
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
  }, [
    latestInboundQuestion,
    messagesLoading,
    selectedAccountId,
    selectedChat?.id,
    selectedChat?.item?.title,
    suggestionsExpanded,
  ]);

  const applyReplySuggestion = useCallback(
    (suggestion: LearnedReplySuggestion) => {
      const hydrated = hydrateLearnedReply(suggestion.answer, {
        itemTitle: selectedChat?.item.title,
        itemPrice: selectedChat?.item.price,
        itemUrl: selectedChat?.item.url,
      });

      setDraft(current => (current.trim() ? `${current.trim()}\n${hydrated}` : hydrated));
      window.setTimeout(() => {
        draftRef.current?.focus();
        resizeDraft();
      }, 0);
    },
    [resizeDraft, selectedChat]
  );

  const handleRefresh = async () => {
    await loadAccounts();
    if (selectedAccountId) {
      await loadChats(selectedAccountId);
      if (selectedChatId) {
        await loadMessages(selectedAccountId, selectedChatId);
      }
    }
  };

  const handleLoadMoreChats = async () => {
    if (!selectedAccountId || chatsLoadingMore || !chatsHasMore) return;
    rememberChatsListScroll(true);
    await loadChats(selectedAccountId, true, { append: true });
  };

  const handleLoadMoreMessages = async () => {
    if (!selectedAccountId || !selectedChatId || messagesLoadingMore || !messagesHasMore) return;
    const container = listRef.current;
    if (container) {
      prependSnapshotRef.current = {
        top: container.scrollTop,
        height: container.scrollHeight,
      };
    }
    await loadMessages(selectedAccountId, selectedChatId, true, { append: true });
  };

  const toggleSelectedChatPin = async () => {
    if (!selectedAccountId || !selectedChat || pinUpdating) return;
    const targetPinned = !selectedChat.isPinned;

    if (targetPinned && pinnedCount >= pinnedLimit) {
      toast.error(`Можно закрепить не более ${pinnedLimit} диалогов`);
      return;
    }

    setPinUpdating(true);
    try {
      const path = `/api/logistics/marketplace-accounts/${selectedAccountId}/avito/chats/${encodeURIComponent(selectedChat.id)}/pin`;
      const payload = targetPinned
        ? await fetchWithAuth(path, { method: 'POST' })
        : await fetchWithAuth(path, { method: 'DELETE' });

      const nextCount = Number(payload?.count);
      if (Number.isFinite(nextCount)) {
        setPinnedCount(nextCount);
      }

      setChats(previous =>
        [...previous]
          .map(chat => (chat.id === selectedChat.id ? { ...chat, isPinned: targetPinned } : chat))
          .sort((left, right) => {
            if (Boolean(left.isPinned) !== Boolean(right.isPinned)) {
              return left.isPinned ? -1 : 1;
            }
            return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
          })
      );

      toast.success(targetPinned ? 'Диалог закреплён' : 'Закреп снят');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Не удалось обновить закреп'));
    } finally {
      setPinUpdating(false);
    }
  };

  const clearAttachedImage = useCallback(() => {
    if (attachedImage?.previewUrl) {
      URL.revokeObjectURL(attachedImage.previewUrl);
    }
    setAttachedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [attachedImage?.previewUrl]);

  const handleSelectImage = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const allowed = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/heic',
        'image/heif',
      ];
      if (!allowed.includes(file.type.toLowerCase())) {
        toast.error('Для Avito подходят JPEG, PNG, GIF, BMP и HEIC изображения');
        event.target.value = '';
        return;
      }
      if (file.size > 24 * 1024 * 1024) {
        toast.error('Размер изображения не должен превышать 24 МБ');
        event.target.value = '';
        return;
      }

      try {
        const prepared = await prepareAvitoImage(file);
        if (attachedImage?.previewUrl) {
          URL.revokeObjectURL(attachedImage.previewUrl);
        }
        setAttachedImage(prepared);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, 'Не удалось подготовить фото к отправке'));
        event.target.value = '';
      }
    },
    [attachedImage?.previewUrl]
  );

  const handleSend = async () => {
    if (!selectedAccountId || !selectedChatId) return;
    const text = draft.trim();
    if (!text && !attachedImage) return;

    setSending(true);
    try {
      if (attachedImage) {
        const formData = new FormData();
        if (text) formData.append('text', text);
        formData.append('image', attachedImage.file);
        await fetchWithAuth(
          `/api/logistics/marketplace-accounts/${selectedAccountId}/avito/chats/${encodeURIComponent(selectedChatId)}/messages`,
          {
            method: 'POST',
            body: formData,
          }
        );
      } else {
        await fetchWithAuth(
          `/api/logistics/marketplace-accounts/${selectedAccountId}/avito/chats/${encodeURIComponent(selectedChatId)}/messages`,
          {
            method: 'POST',
            body: JSON.stringify({ text }),
          }
        );
      }
      setDraft('');
      clearAttachedImage();
      await loadMessages(selectedAccountId, selectedChatId, true);
      await loadChats(selectedAccountId, true);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Не удалось отправить сообщение в Avito'));
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (message: AvitoMessage) => {
    if (!selectedAccountId || !selectedChatId || deletingMessageId || message.direction !== 'out') return;

    const confirmed = window.confirm('Удалить наше отправленное сообщение в Avito и скрыть его в CRM?');
    if (!confirmed) return;

    setDeletingMessageId(message.id);
    try {
      await fetchWithAuth(
        `/api/logistics/marketplace-accounts/${selectedAccountId}/avito/chats/${encodeURIComponent(selectedChatId)}/messages/${encodeURIComponent(message.id)}`,
        { method: 'DELETE' }
      );

      setMessages(previous => previous.filter(item => item.id !== message.id));
      await loadChats(selectedAccountId, true, { live: true });
      toast.success('Сообщение удалено в Avito');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Не удалось удалить сообщение'));
    } finally {
      setDeletingMessageId(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="hidden rounded-2xl border border-slate-700/60 p-2 md:block md:glass md:p-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-cyan-200 sm:text-sm">
              <Link2 className="h-4 w-4" />
              Avito сообщения
            </div>
            {selectedAccount ? (
              <div className="mt-1 truncate text-[11px] text-slate-400">
                {selectedAccount.displayName}
                {selectedAccount.externalAccountId
                  ? ` • ID ${selectedAccount.externalAccountId}`
                  : ''}
                {selectedAccount.lastSyncAt
                  ? ` • синк ${formatTime(selectedAccount.lastSyncAt)}`
                  : ''}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-600 bg-slate-900/65 text-slate-200 transition hover:bg-slate-700/40 sm:h-9 sm:w-9"
            aria-label="Обновить сообщения Avito"
          >
            <RefreshCw
              className={`h-4 w-4 ${accountsLoading || chatsLoading || messagesLoading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-start gap-2">
          {accountsLoading ? (
            <div className="text-xs text-slate-400">Загружаю подключённые аккаунты...</div>
          ) : accounts.length ? (
            <>
              <select
                value={selectedAccountId || ''}
                onChange={event => {
                  const nextId = Number(event.target.value || 0);
                  setSelectedAccountId(nextId || null);
                  setSelectedChatId(null);
                  setMobilePane('list');
                  chatsListScrollTopRef.current = 0;
                  chatsListRestoreRef.current = false;
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3 py-1.5 text-xs text-white sm:max-w-[240px] sm:text-sm"
              >
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.displayName}
                    {account.requiresReconnect ? ' · переподключить' : ''}
                  </option>
                ))}
              </select>
              {selectedAccount ? (
                <div className="rounded-xl border border-slate-700/70 bg-slate-950/80 px-2.5 py-1 text-[11px] text-slate-300">
                  {selectedAccount.lastSyncAt
                    ? `синк ${formatTime(selectedAccount.lastSyncAt)}`
                    : 'синк ещё не был'}
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 sm:text-sm">
              Подключите Avito-аккаунт в интеграциях.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-[380px,minmax(0,1fr)] xl:gap-4">
        <div
          className={`crm-chat-pane glass flex min-h-[18rem] flex-col overflow-hidden rounded-2xl border border-slate-700/50 ${mobilePane === 'chat' ? 'hidden xl:flex' : 'flex'}`}
        >
          <div className="space-y-2 border-b border-slate-700/50 p-2.5 sm:p-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4.5 w-4.5 text-cyan-300" />
              <p className="text-sm font-semibold text-white sm:text-base">Диалоги</p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500"
                placeholder="Поиск по чатам Avito"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUnreadOnly(false)}
                className={`min-h-8 rounded-xl px-3 text-[12px] font-semibold transition ${!unreadOnly ? 'bg-cyan-500/15 text-cyan-100' : 'bg-slate-900/60 text-slate-400'}`}
              >
                Все
              </button>
              <button
                type="button"
                onClick={() => setUnreadOnly(true)}
                className={`min-h-8 rounded-xl px-3 text-[12px] font-semibold transition ${unreadOnly ? 'bg-cyan-500/15 text-cyan-100' : 'bg-slate-900/60 text-slate-400'}`}
              >
                Непрочитанные
              </button>
            </div>
          </div>

          <div ref={chatsListRef} className="min-h-0 flex-1 overflow-y-auto">
            {!selectedAccountId ? (
              <div className="p-6 text-sm text-slate-400">
                Выберите Avito-аккаунт, чтобы открыть его сообщения.
              </div>
            ) : chatsLoading ? (
              <div className="p-6 text-sm text-slate-400">Загружаю чаты...</div>
            ) : visibleChats.length ? (
              visibleChats.map(chat => (
                <button
                  key={chat.id}
                  type="button"
                  aria-current={chat.id === selectedChatId ? 'true' : undefined}
                  onClick={() => {
                    rememberChatsListScroll();
                    setSelectedChatId(chat.id);
                    if (isMobileViewport) {
                      setMobilePane('chat');
                    }
                  }}
                  className={`w-full border-b border-slate-800/70 px-3 py-2 text-left transition hover:bg-slate-900/35 sm:px-4 sm:py-3 ${
                    chat.id === selectedChatId
                      ? 'border-l-2 border-l-cyan-300 bg-cyan-500/12 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-white sm:text-[15px]">
                        {chat.isPinned ? <Pin className="h-3.5 w-3.5 text-cyan-300" /> : null}
                        <span className="truncate">{chat.counterpart.name}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-400 sm:text-sm">
                        {chat.item.title}
                      </div>
                    </div>
                    {chat.unreadCount ? (
                      <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold text-cyan-100">
                        {chat.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-300 sm:text-sm">
                    {chat.lastMessage.text || 'Без текста'}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 sm:text-xs">
                    <span>{chat.item.price || 'Цена не указана'}</span>
                    <span>{formatTime(chat.lastMessage.createdAt || chat.updatedAt)}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-6 text-sm text-slate-400">
                По этому аккаунту Avito пока нет доступных диалогов.
              </div>
            )}
            {selectedAccountId && !chatsLoading && chatsHasMore ? (
              <div className="p-3">
                <button
                  type="button"
                  onClick={() => void handleLoadMoreChats()}
                  disabled={chatsLoadingMore}
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800/70 disabled:opacity-60"
                >
                  {chatsLoadingMore ? 'Загружаю ещё…' : 'Показать более ранние диалоги'}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={`crm-chat-pane glass flex min-h-[18rem] flex-col overflow-hidden rounded-2xl border border-slate-700/50 ${mobilePane === 'list' ? 'hidden xl:flex' : 'flex'}`}
        >
          {selectedChat ? (
            <>
              <div className="border-b border-slate-700/50 bg-slate-900/72 px-3 py-2 sm:p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        chatsListRestoreRef.current = true;
                        setMobilePane('list');
                      }}
                      className="mb-1.5 inline-flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-950/70 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 xl:hidden"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>К списку</span>
                    </button>
                    <div className="truncate text-[15px] font-semibold text-white sm:text-lg">
                      {selectedChat.counterpart.name}
                    </div>
                    <div className="mt-0.5 line-clamp-1 break-words text-[11px] leading-4 text-slate-400 sm:text-sm">
                      {selectedChat.item.title}
                    </div>
                  </div>
                  <div className="flex max-w-[46vw] shrink-0 flex-wrap items-start justify-end gap-1.5 sm:max-w-none sm:gap-2">
                    {selectedChat.item.url ? (
                      <a
                        href={selectedChat.item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900/60 px-0 text-[11px] font-semibold text-slate-200 transition hover:bg-slate-800/80 sm:w-auto sm:px-3 sm:py-2 sm:text-xs"
                        aria-label="Открыть объявление Avito"
                        title="Открыть объявление"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="ml-1.5 hidden sm:inline">Открыть объявление</span>
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void toggleSelectedChatPin()}
                      disabled={
                        pinUpdating || (!selectedChat.isPinned && pinnedCount >= pinnedLimit)
                      }
                      className={`inline-flex h-8 w-8 items-center justify-center gap-1 rounded-xl border px-0 text-[11px] font-semibold transition sm:w-auto sm:px-3 sm:py-2 sm:text-xs ${
                        selectedChat.isPinned
                          ? 'border-cyan-400/40 bg-cyan-500/12 text-cyan-100'
                          : 'border-slate-700/70 bg-slate-900/60 text-slate-200 hover:bg-slate-800/80'
                      } disabled:opacity-60`}
                      title={
                        selectedChat.isPinned ? 'Снять закреп' : `Закрепить (до ${pinnedLimit})`
                      }
                    >
                      <Pin className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{selectedChat.isPinned ? 'Закреплён' : 'Закрепить'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5 pb-3 sm:p-4">
                {messagesHasMore ? (
                  <div className="flex justify-center pb-1">
                    <button
                      type="button"
                      onClick={() => void handleLoadMoreMessages()}
                      disabled={messagesLoadingMore}
                      className="rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800/70 disabled:opacity-60"
                    >
                      {messagesLoadingMore ? 'Загружаю ещё…' : 'Показать более ранние сообщения'}
                    </button>
                  </div>
                ) : null}
                {messagesLoading ? (
                  <div className="text-sm text-slate-400">Загружаю сообщения...</div>
                ) : selectedAccount?.requiresReconnect && !selectedAccount?.hasLiveAccessToken ? (
                  <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-50">
                    {selectedAccount?.connectionHint ||
                      'Для этого Avito-аккаунта нужно заново сохранить Client ID и Client secret в настройках.'}
                  </div>
                ) : messagesError ? (
                  <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-50">
                    {messagesError}
                  </div>
                ) : messages.length ? (
                  messages.map(message => {
                    const outgoing = message.direction === 'out';
                    return (
                      <div
                        key={message.id}
                        className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[80%] sm:px-4 ${outgoing ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white' : 'bg-slate-900/80 text-slate-100'}`}
                        >
                          {message.quote?.text || message.quote?.imageUrl ? (
                            <div
                              className={`mb-2 rounded-xl border px-3 py-2 text-[11px] ${outgoing ? 'border-white/20 bg-white/10 text-white/80' : 'border-slate-700 bg-slate-950/40 text-slate-400'}`}
                            >
                              {message.quote?.imageUrl ? (
                                <a
                                  href={message.quote.imageUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mb-2 block overflow-hidden rounded-lg"
                                >
                                  <img
                                    src={message.quote.imageUrl}
                                    alt="Цитируемое изображение"
                                    className="max-h-28 w-auto rounded-lg object-cover"
                                  />
                                </a>
                              ) : null}
                              {message.quote?.text || 'Изображение'}
                            </div>
                          ) : null}
                          {message.imageUrl ? (
                            <a
                              href={message.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mb-2 block overflow-hidden rounded-2xl"
                            >
                              <img
                                src={message.imageUrl}
                                alt="Изображение из чата Avito"
                                className="max-h-[280px] w-full rounded-2xl object-cover"
                              />
                            </a>
                          ) : null}
                          {message.voiceUrl ? (
                            <audio controls preload="none" className="mb-2 w-full">
                              <source src={message.voiceUrl} />
                            </audio>
                          ) : null}
                          {message.text && (!message.imageUrl || message.text !== 'Изображение') ? (
                            <div className="break-words whitespace-pre-wrap text-[13px] leading-5 sm:text-sm">
                              {message.text}
                            </div>
                          ) : !message.imageUrl ? (
                            <div>
                              {message.type === 'image'
                                ? 'Изображение'
                                : message.type === 'voice'
                                  ? 'Голосовое сообщение'
                                  : 'Системное сообщение'}
                            </div>
                          ) : null}
                          <div
                            className={`mt-1.5 flex items-center justify-between gap-3 text-[10px] ${outgoing ? 'text-white/70' : 'text-slate-500'}`}
                          >
                            <span>{formatTime(message.createdAt)}</span>
                            {outgoing ? (
                              <button
                                type="button"
                                onClick={() => void handleDeleteMessage(message)}
                                disabled={deletingMessageId === message.id}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label="Удалить отправленное сообщение"
                                title="Удалить отправленное сообщение"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-slate-400">В этом чате пока нет сообщений.</div>
                )}
              </div>

              <div className="shrink-0 border-t border-slate-700/50 bg-slate-950/92 p-2.5 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] backdrop-blur sm:p-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/bmp,image/heic,image/heif"
                  className="hidden"
                  onChange={handleSelectImage}
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSuggestionsExpanded(value => !value)}
                      className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition ${
                        suggestionsExpanded
                          ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100'
                          : 'border-slate-700/70 bg-slate-900/65 text-slate-300 hover:bg-slate-800/80'
                      }`}
                    >
                      <Lightbulb className="h-3.5 w-3.5" />
                      {suggestionsExpanded ? 'Скрыть подсказки' : 'Показать подсказки'}
                    </button>
                    <div className="text-[10px] text-slate-500">
                      Закрепы: {pinnedCount}/{pinnedLimit}
                    </div>
                  </div>

                  {suggestionsExpanded ? (
                    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/8 px-3 py-2.5">
                      <div className="text-[11px] leading-4 text-slate-400">
                        Подборка по похожим вопросам из истории Avito.
                      </div>
                      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                        {replySuggestionsLoading && !replySuggestions.length ? (
                          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/75 px-3 py-2 text-xs text-slate-400">
                            Подбираю варианты...
                          </div>
                        ) : replySuggestions.length ? (
                          replySuggestions.map((suggestion, index) => {
                            const hydrated = hydrateLearnedReply(suggestion.answer, {
                              itemTitle: selectedChat?.item.title,
                              itemPrice: selectedChat?.item.price,
                              itemUrl: selectedChat?.item.url,
                            });

                            return (
                              <button
                                key={`${suggestion.answer}-${index}`}
                                type="button"
                                onClick={() => applyReplySuggestion(suggestion)}
                                className="min-w-[170px] max-w-[260px] rounded-2xl border border-slate-700/70 bg-slate-950/80 px-3 py-2 text-left transition hover:border-cyan-400/40 hover:bg-slate-900/90 sm:min-w-[220px] sm:max-w-[280px]"
                              >
                                <div className="line-clamp-3 text-[12px] font-medium leading-5 text-slate-100">
                                  {hydrated}
                                </div>
                                <div className="mt-2 text-[10px] leading-4 text-slate-400">
                                  {suggestion.reason}
                                  {suggestion.successRate > 0
                                    ? ` • ${suggestion.successRate}%`
                                    : ''}
                                  {suggestion.count ? ` • ${suggestion.count} прим.` : ''}
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/75 px-3 py-2 text-xs text-slate-400">
                            Пока нет релевантных подсказок для этого диалога.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {attachedImage ? (
                    <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950/90 sm:h-14 sm:w-14">
                          <img
                            src={attachedImage.previewUrl}
                            alt="Предпросмотр загружаемого изображения"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">
                            {attachedImage.file.name}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {formatFileSize(attachedImage.file.size)}
                            {attachedImage.originalSize > attachedImage.file.size
                              ? ` из ${formatFileSize(attachedImage.originalSize)}`
                              : ''}
                            {` · ${attachedImage.width}×${attachedImage.height}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={clearAttachedImage}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-700/70 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800/70"
                        >
                          <X className="h-3.5 w-3.5" />
                          Убрать
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-[42px_minmax(0,1fr)_42px] gap-2 md:grid-cols-[96px_minmax(0,1fr)_132px] md:items-stretch">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/70 px-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/80 md:min-h-[60px]"
                    >
                      <ImagePlus className="h-4 w-4" />
                      <span className="hidden md:inline">Фото</span>
                    </button>
                    <div className="min-w-0 rounded-3xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 sm:px-4">
                      <textarea
                        ref={draftRef}
                        value={draft}
                        onChange={event => setDraft(event.target.value)}
                        onInput={resizeDraft}
                        rows={1}
                        placeholder="Ответить покупателю в Avito..."
                        className="max-h-[116px] min-h-[42px] w-full resize-none overflow-y-auto border-0 bg-transparent px-0 py-0 text-sm leading-5 text-white placeholder:text-slate-500 focus:ring-0"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={sending || (!draft.trim() && !attachedImage)}
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 md:min-h-[60px] md:min-w-[132px]"
                    >
                      <SendHorizontal className="h-4 w-4" />
                      <span className="hidden md:inline">Отправить</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-400">
              Выберите чат слева, чтобы открыть переписку Avito.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
