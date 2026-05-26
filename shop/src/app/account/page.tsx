'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, GlassCard, SectionTitle } from '@technoprime/ui';
import { formatPrice } from '@technoprime/lib';
import {
  createVkLinkCode,
  fetchAccountInstructions,
  fetchAccountOverview,
  fetchMyOrders,
  saveCookieConsent as persistCookieConsent,
  ShopAccountOverview,
  ShopInstruction,
  ShopOrder,
  unlinkTelegramAccount,
  unlinkVkAccount,
  updateAccountProfile,
} from '@/lib/shop-api';
import { ConsultationDialog } from '@/components/consultation-dialog';
import {
  formatPhoneInput,
  isCompleteRussianPhone,
  normalizePhoneDigits,
  toApiPhone,
} from '@/lib/phone';

type ShopUser = {
  id: number;
  phone?: string | null;
  telegramUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type CookieChoice = 'unknown' | 'necessary' | 'all';

type ProfileForm = {
  firstName: string;
  lastName: string;
  birthDate: string;
  deliveryCity: string;
  deliveryAddress: string;
  notifyOrderStatus: boolean;
  notifySubscription: boolean;
  notifyService: boolean;
  notifyMarketing: boolean;
};

type VkAuthMode = 'login' | 'link';

type PhoneAuthStep = 'request' | 'verify' | 'waitcall';

type PhoneRequestResponse = {
  success: boolean;
  delivery?: 'mock' | 'sms' | 'waitcall' | 'messenger';
  expiresAt?: string;
  message?: string;
  waitcallPhone?: string | null;
  retryAfterSec?: number;
};

type PendingPhoneAuthState = {
  phone: string;
  step: Extract<PhoneAuthStep, 'verify' | 'waitcall'>;
  expiresAt: string | null;
  waitcallPhone: string | null;
  message: string | null;
};

const COOKIE_CONSENT_KEY = 'tp_cookie_consent';
const COOKIE_POLICY_VERSION = '2026-02';
const PHONE_AUTH_STORAGE_KEY = 'tp_pending_phone_auth';

const VK_STATUS_MESSAGE: Record<string, string> = {
  vk_logged_in: 'Вход через VK выполнен.',
  vk_linked: 'VK успешно привязан.',
  vk_already_linked: 'VK уже привязан к этому аккаунту.',
  vk_link_required: 'Сначала войдите в личный кабинет и привяжите VK в профиле.',
  vk_need_auth: 'Для привязки VK сначала войдите в личный кабинет.',
  vk_link_conflict:
    'Этот аккаунт уже привязан. Перейдите в нужный профиль и отвяжите соцсеть, затем повторите.',
  vk_error: 'Не удалось выполнить авторизацию через VK.',
};

function formatOrderStatus(status: string) {
  const map: Record<string, string> = {
    NEW: 'Новый',
    IN_PROGRESS: 'В работе',
    COMPLETED: 'Завершен',
    CANCELED: 'Отменен',
    RETURNED: 'Возвращён',
  };
  return map[status] || status;
}

function formatShipmentCarrier(carrier?: string | null) {
  const map: Record<string, string> = {
    AVITO_DELIVERY: 'Avito Доставка',
    AVITO_CDEK: 'СДЭК через Avito',
    AVITO_YANDEX: 'Яндекс через Avito',
    AVITO_POST_RUSSIA: 'Почта через Avito',
    CDEK_PERSONAL: 'СДЭК',
    YANDEX_DELIVERY: 'Яндекс Доставка',
    OZON_DELIVERY: 'Ozon',
    POST_RUSSIA: 'Почта России',
    OTHER: 'Служба доставки',
  };
  return map[String(carrier || '')] || 'Служба доставки';
}

function formatShipmentStatus(status?: string | null) {
  const map: Record<string, string> = {
    AWAITING_SHIPMENT_DATA: 'Готовим отправление',
    READY_FOR_HANDOVER: 'Готовим передачу в службу доставки',
    HANDED_TO_CARRIER: 'Передан в службу доставки',
    IN_TRANSIT: 'В пути',
    ARRIVED_AT_PICKUP_POINT: 'Прибыл в пункт выдачи',
    AWAITING_CUSTOMER_PICKUP: 'Ожидает получения',
    RECEIVED_BY_CUSTOMER: 'Получен',
    RETURN_IN_TRANSIT: 'Возврат в пути',
    RETURNED_TO_SELLER: 'Возвращён продавцу',
    DELIVERY_ISSUE: 'Есть вопрос по доставке',
    CANCELED: 'Доставка отменена',
  };
  return map[String(status || '')] || 'Статус уточняется';
}

function formatDeliveryDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatPaymentMethod(method: string) {
  const map: Record<string, string> = {
    CASH: 'Наличные',
    TRANSFER: 'Перевод',
    TRADE_IN: 'Trade-in',
  };
  return map[method] || method;
}

function formatWaitcallPhone(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('7')) {
    return `8 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  if (digits.length === 11 && digits.startsWith('8')) {
    return `8 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  if (digits.length === 10) {
    return `8 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
  }
  return String(value || '').trim();
}

function formatAccountPhone(value?: string | null) {
  return formatWaitcallPhone(value);
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getSubscriptionAccessTitle(subscription: ShopAccountOverview['subscriptions'][number]) {
  if (subscription.accountType === 'SHARING_CLIENT') return 'Данные подключенного аккаунта';
  if (subscription.accountType === 'PERSONAL') return 'Данные аккаунта';
  return 'Данные доступа';
}

function getSubscriptionAccessFields(subscription: ShopAccountOverview['subscriptions'][number]) {
  if (subscription.accountType === 'SHARING_DONOR') {
    return [] as Array<{ label: string; value: string }>;
  }

  return [
    subscription.emailLogin ? { label: 'Логин', value: subscription.emailLogin } : null,
    subscription.emailPassword ? { label: 'Пароль почты', value: subscription.emailPassword } : null,
    subscription.accountPassword ? { label: 'Пароль профиля', value: subscription.accountPassword } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;
}

function getSubscriptionAccessGroups(subscription: ShopAccountOverview['subscriptions'][number]) {
  if (subscription.accessGroups?.length) {
    return subscription.accessGroups.filter(group => group.fields.length > 0);
  }

  if (subscription.accountType === 'SHARING_DONOR') {
    return [] as Array<{ title: string; fields: Array<{ label: string; value: string }> }>;
  }

  const fields = getSubscriptionAccessFields(subscription);
  return fields.length ? [{ title: getSubscriptionAccessTitle(subscription), fields }] : [];
}

function getSubscriptionBadge(subscription: ShopAccountOverview['subscriptions'][number]) {
  const isExpired = new Date(subscription.endDate).getTime() <= Date.now();

  if (subscription.isActive) {
    return {
      className: 'bg-emerald-500/20 text-emerald-200',
      label: `Активна, ${subscription.daysLeft} дн.`,
    };
  }

  if (isExpired) {
    return {
      className: 'bg-rose-500/20 text-rose-200',
      label: 'Истекла',
    };
  }

  return {
    className: 'bg-slate-500/20 text-slate-300',
    label: 'Неактивна',
  };
}

function getCookieConsentValue(): CookieChoice {
  if (typeof window === 'undefined') return 'unknown';

  const fromStorage = window.localStorage.getItem(COOKIE_CONSENT_KEY);
  if (fromStorage === 'all' || fromStorage === 'necessary') {
    return fromStorage;
  }

  const fromCookie = document.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE_CONSENT_KEY}=`));

  if (!fromCookie) return 'unknown';
  const value = decodeURIComponent(fromCookie.split('=')[1] || '');
  if (value === 'all' || value === 'necessary') return value;
  return 'unknown';
}

function getDefaultProfileForm(): ProfileForm {
  return {
    firstName: '',
    lastName: '',
    birthDate: '',
    deliveryCity: '',
    deliveryAddress: '',
    notifyOrderStatus: true,
    notifySubscription: true,
    notifyService: true,
    notifyMarketing: true,
  };
}

function renderInstructionContent(content: string) {
  const renderInstructionInline = (value: string, keyPrefix: string) => {
    const normalized = String(value || '');
    if (!normalized.includes('**')) {
      return normalized;
    }

    const chunks = normalized.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return chunks.map((chunk, index) => {
      const boldMatch = chunk.match(/^\*\*([^*]+)\*\*$/);
      if (boldMatch) {
        return (
          <strong key={`${keyPrefix}-strong-${index}`} className="font-semibold text-cyan-100">
            {boldMatch[1]}
          </strong>
        );
      }
      return <span key={`${keyPrefix}-text-${index}`}>{chunk}</span>;
    });
  };

  const blocks = String(content || '')
    .split(/\n{2,}/g)
    .map(block => block.trim())
    .filter(Boolean);

  return blocks.map((block, blockIndex) => {
    const lines = block
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const calloutTitle = lines[0]?.replace(/\*\*/g, '').replace(/:$/, '').trim();
    if (calloutTitle === 'Важные правила' || calloutTitle === 'Важно') {
      return (
        <div
          key={`callout-${blockIndex}`}
          className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-rose-50"
        >
          <p className="font-semibold text-rose-100">{calloutTitle}</p>
          <div className="mt-2 space-y-2 text-sm text-rose-50/95">
            {renderInstructionContent(lines.slice(1).join('\n'))}
          </div>
        </div>
      );
    }

    const ordered = lines.length > 1 && lines.every(line => /^\d+[\).\s]/.test(line));
    if (ordered) {
      return (
        <ol key={`ordered-${blockIndex}`} className="ml-5 list-decimal space-y-2">
          {lines.map((line, idx) => (
            <li key={`line-${blockIndex}-${idx}`} className="leading-relaxed text-slate-100">
              {renderInstructionInline(
                line.replace(/^\d+[\).\s]*/, ''),
                `ordered-${blockIndex}-${idx}`,
              )}
            </li>
          ))}
        </ol>
      );
    }

    const bullets = lines.length > 1 && lines.every(line => /^[-•]\s*/.test(line));
    if (bullets) {
      return (
        <ul key={`bullet-${blockIndex}`} className="ml-5 list-disc space-y-2">
          {lines.map((line, idx) => (
            <li key={`line-${blockIndex}-${idx}`} className="leading-relaxed text-slate-100">
              {renderInstructionInline(
                line.replace(/^[-•]\s*/, ''),
                `bullet-${blockIndex}-${idx}`,
              )}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p key={`text-${blockIndex}`} className="leading-relaxed text-slate-100 whitespace-pre-line">
        {renderInstructionInline(block, `text-${blockIndex}`)}
      </p>
    );
  });
}

function loadPendingPhoneAuthState(): PendingPhoneAuthState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(PHONE_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPhoneAuthState;
    const normalized = normalizePhoneDigits(parsed.phone || '');
    if (normalized.length !== 11) {
      window.sessionStorage.removeItem(PHONE_AUTH_STORAGE_KEY);
      return null;
    }

    if (parsed.step !== 'verify' && parsed.step !== 'waitcall') {
      window.sessionStorage.removeItem(PHONE_AUTH_STORAGE_KEY);
      return null;
    }

    if (!parsed.expiresAt || Number.isNaN(new Date(parsed.expiresAt).getTime()) || new Date(parsed.expiresAt).getTime() <= Date.now()) {
      window.sessionStorage.removeItem(PHONE_AUTH_STORAGE_KEY);
      return null;
    }

    return {
      phone: formatPhoneInput(parsed.phone),
      step: parsed.step,
      expiresAt: parsed.expiresAt,
      waitcallPhone: parsed.waitcallPhone || null,
      message: parsed.message || null,
    };
  } catch {
    window.sessionStorage.removeItem(PHONE_AUTH_STORAGE_KEY);
    return null;
  }
}

function clearPendingPhoneAuthState() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PHONE_AUTH_STORAGE_KEY);
}

function persistPendingPhoneAuthState(state: PendingPhoneAuthState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PHONE_AUTH_STORAGE_KEY, JSON.stringify(state));
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.3 4.4c.3-.2.6.1.5.5l-3.1 14.5c-.1.5-.6.7-1 .5l-4.6-3.4-2.4 2.3c-.2.2-.4.3-.6.3-.3 0-.5-.2-.5-.5l.2-3.9 7.1-6.4c.2-.2 0-.5-.3-.4l-8.7 5.5-3.8-1.3c-.5-.2-.5-.9 0-1.1l16.2-6.6Z"
      />
    </svg>
  );
}

function VkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3.8 7.6c.1-.3.3-.4.6-.4h2.7c.2 0 .4.1.5.3.8 2 1.7 3.7 2.7 4.9.3.4.6.6.8.6.2 0 .3-.2.3-.5v-4.7c0-.4.2-.6.6-.6h2.4c.4 0 .6.2.6.6v2.5c0 .8 0 1.3.2 1.5.1.2.3.2.6 0 .8-.8 1.5-2 2.2-3.6.1-.2.3-.3.5-.3h2.7c.4 0 .6.3.5.7-.3 1.4-1.2 2.9-2.5 4.6-.3.4-.3.7 0 1 .6.7 1.2 1.5 1.8 2.5.2.4 0 .8-.4.8h-2.7c-.2 0-.4-.1-.6-.3-.6-.8-1.1-1.4-1.5-1.8-.3-.3-.5-.4-.7-.3-.2.1-.3.3-.3.7v1.2c0 .3-.2.5-.5.5h-1.1c-2 0-3.8-.9-5.4-2.7-1.6-1.8-2.8-4-3.5-6.7-.1-.2-.1-.4 0-.5Z"
      />
    </svg>
  );
}

export default function AccountPage() {
  const botName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME;
  const publicShopUrl = String(process.env.NEXT_PUBLIC_SHOP_PUBLIC_URL || '').trim();
  const botLoginLink = botName ? `https://t.me/${botName}?start=shop_login` : null;
  const vkBotLink = 'https://vk.me/public236325005';

  const [user, setUser] = useState<ShopUser | null>(null);
  const [overview, setOverview] = useState<ShopAccountOverview | null>(null);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [instructions, setInstructions] = useState<ShopInstruction[]>([]);
  const [sessionResolved, setSessionResolved] = useState(false);

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<PhoneAuthStep>('request');
  const [waitcallPhone, setWaitcallPhone] = useState<string | null>(null);
  const [waitcallExpiresAt, setWaitcallExpiresAt] = useState<string | null>(null);
  const [countdownSec, setCountdownSec] = useState<number>(0);
  const [requestRetryAfterSec, setRequestRetryAfterSec] = useState<number>(0);
  const [ordersNowTs, setOrdersNowTs] = useState<number>(Date.now());
  const [activeInstructionKey, setActiveInstructionKey] = useState<string>('');
  const [activeSectionByInstruction, setActiveSectionByInstruction] = useState<Record<string, string>>({});
  const [vkLinkCode, setVkLinkCode] = useState<string | null>(null);
  const [vkLinkExpiresAt, setVkLinkExpiresAt] = useState<string | null>(null);
  const [vkLinkUrl, setVkLinkUrl] = useState<string>(vkBotLink);

  const [profileForm, setProfileForm] = useState<ProfileForm>(getDefaultProfileForm());

  const [loading, setLoading] = useState(false);
  const [statusChecking, setStatusChecking] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [cookieChoice, setCookieChoice] = useState<CookieChoice>('unknown');
  const consentSyncKeyRef = useRef<string | null>(null);

  const displayName = useMemo(() => {
    if (!overview?.user) return user?.phone || 'Пользователь';
    const fullName = [overview.user.firstName, overview.user.lastName].filter(Boolean).join(' ').trim();
    return fullName || overview.user.telegramUsername || overview.user.phone || 'Пользователь';
  }, [overview, user]);

  const orderedOrders = useMemo(() => {
    return [...orders].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }, [orders]);

  const visibleOrders = useMemo(() => {
    return [...orderedOrders].reverse();
  }, [orderedOrders]);

  const availableInstructions = useMemo(() => instructions, [instructions]);

  const activeInstruction = useMemo(() => {
    if (!availableInstructions.length) return null;
    const direct = availableInstructions.find(item => item.consoleKey === activeInstructionKey);
    return direct || availableInstructions[0];
  }, [availableInstructions, activeInstructionKey]);

  const activeInstructionSections = useMemo(() => {
    if (!activeInstruction) return [] as ShopInstruction['sections'];
    return [...activeInstruction.sections].sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
  }, [activeInstruction]);

  const activeSectionKey = useMemo(() => {
    if (!activeInstruction) return '';
    const remembered = activeSectionByInstruction[activeInstruction.consoleKey];
    if (remembered && activeInstructionSections.some(section => section.key === remembered)) {
      return remembered;
    }
    return activeInstructionSections[0]?.key || '';
  }, [activeInstruction, activeInstructionSections, activeSectionByInstruction]);

  const activeSection = useMemo(() => {
    if (!activeInstruction || !activeSectionKey) return null;
    return activeInstructionSections.find(section => section.key === activeSectionKey) || null;
  }, [activeInstruction, activeInstructionSections, activeSectionKey]);

  const accountOrdersCount = useMemo(() => {
    if (orders.length > 0) return orders.length;
    return overview?.stats.storeOrdersCount || 0;
  }, [orders.length, overview?.stats.storeOrdersCount]);

  useEffect(() => {
    const hasTimedOrders = orders.some(
      order =>
        order.status === 'NEW' &&
        order.source === 'STORE' &&
        order.reserveUntil &&
        new Date(order.reserveUntil).getTime() > Date.now(),
    );

    if (!hasTimedOrders) return;

    const timer = window.setInterval(() => {
      setOrdersNowTs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [orders]);

  const resetPhoneAuthFlow = (nextMessage?: string | null) => {
    setStep('request');
    setCode('');
    setWaitcallPhone(null);
    setWaitcallExpiresAt(null);
    setRequestRetryAfterSec(0);
    clearPendingPhoneAuthState();
    if (typeof nextMessage !== 'undefined') {
      setMessage(nextMessage);
    }
  };

  const applyVkStatus = async (status: string, overrideMessage?: string) => {
    setMessage(overrideMessage || VK_STATUS_MESSAGE[status] || 'Состояние VK обновлено.');
    if (status === 'vk_logged_in' || status === 'vk_linked' || status === 'vk_already_linked') {
      await loadSession();
    }
  };

  const startVkAuth = async (mode: VkAuthMode) => {
    if (mode === 'link' && !user) {
      setMessage('Сначала войдите по телефону или через Telegram, затем привяжите VK из профиля.');
      return;
    }

    setLoading(true);
    try {
      if (typeof window !== 'undefined') {
        const isLocalhostHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocalhostHost && publicShopUrl) {
          const target = new URL('/account', publicShopUrl);
          target.searchParams.set('vk_entry', mode);
          window.location.assign(target.toString());
          return;
        }
      }

      if (mode === 'link') {
        const result = await createVkLinkCode();
        if (!result?.success) {
          setMessage(result?.message || 'Не удалось создать код привязки VK.');
          return;
        }
        if (result?.alreadyLinked) {
          setMessage('VK уже привязан к этому аккаунту.');
          await loadSession();
          return;
        }

        setVkLinkCode(result.code || null);
        setVkLinkExpiresAt(result.expiresAt || null);
        setVkLinkUrl(result?.botLink || vkBotLink);
        setMessage(
          result?.code
            ? `Откройте VK-бота и отправьте код привязки: ${result.code}`
            : 'Откройте VK-бота и отправьте одноразовый код привязки из блока ниже.',
        );
        window.open(result?.botLink || vkBotLink, '_blank', 'noopener,noreferrer');
        return;
      }

      setMessage('Открываем VK-бота. Если аккаунт уже привязан, отправьте в чат слово «вход».');
      window.open(vkBotLink, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('VK bot open failed', error);
      await applyVkStatus('vk_error');
    } finally {
      setLoading(false);
    }
  };

  const loadSession = async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json().catch(() => ({ user: null }));
      setUser(data.user || null);

      if (!data.user) {
        setOverview(null);
        setOrders([]);
        setInstructions([]);
        return;
      }

      const [overviewData, ordersData, instructionsData] = await Promise.all([
        fetchAccountOverview(),
        fetchMyOrders(),
        fetchAccountInstructions(),
      ]);
      setOverview(overviewData);
      setOrders(ordersData);
      setInstructions(Array.isArray(instructionsData?.items) ? instructionsData.items : []);
    } finally {
      setSessionResolved(true);
    }
  };

  const hydrateProfileForm = (nextOverview: ShopAccountOverview | null) => {
    if (!nextOverview?.user) {
      setProfileForm(getDefaultProfileForm());
      return;
    }

    setProfileForm({
      firstName: nextOverview.user.firstName || '',
      lastName: nextOverview.user.lastName || '',
      birthDate: nextOverview.user.birthDate ? String(nextOverview.user.birthDate).slice(0, 10) : '',
      deliveryCity: nextOverview.user.deliveryCity || '',
      deliveryAddress: nextOverview.user.deliveryAddress || '',
      notifyOrderStatus: nextOverview.user.notifyOrderStatus ?? true,
      notifySubscription: nextOverview.user.notifySubscription ?? true,
      notifyService: nextOverview.user.notifyService ?? true,
      notifyMarketing:
        nextOverview.user.marketingConsent ?? nextOverview.user.notifyMarketing ?? true,
    });
  };

  useEffect(() => {
    setCookieChoice(getCookieConsentValue());
    const pendingPhoneAuth = loadPendingPhoneAuthState();
    if (pendingPhoneAuth) {
      setPhone(pendingPhoneAuth.phone);
      setStep(pendingPhoneAuth.step);
      setWaitcallPhone(pendingPhoneAuth.waitcallPhone);
      setWaitcallExpiresAt(pendingPhoneAuth.expiresAt);
      setMessage(pendingPhoneAuth.message);
    }
    void loadSession();
  }, []);

  useEffect(() => {
    hydrateProfileForm(overview);
  }, [overview]);

  useEffect(() => {
    if (!availableInstructions.length) {
      setActiveInstructionKey('');
      return;
    }

    setActiveInstructionKey((prev) => {
      if (prev && availableInstructions.some(item => item.consoleKey === prev)) {
        return prev;
      }
      return availableInstructions[0].consoleKey;
    });
  }, [availableInstructions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const tgPhone = params.get('tg_phone');
    const tgCode = params.get('tg_code');
    if (!tgPhone || !tgCode) return;

    const applyTelegramLogin = async () => {
      setLoading(true);
      setMessage('Подтверждаем вход через Telegram...');
      try {
        const res = await fetch('/api/auth/phone/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: tgPhone, code: tgCode }),
        });
        const data = await res.json();
        if (data.success) {
          await loadSession();
          setMessage('Вход через Telegram выполнен');
        } else {
          setMessage('Ссылка Telegram устарела. Запроси новую в боте.');
        }
      } catch {
        setMessage('Ошибка сети при подтверждении Telegram-входа');
      } finally {
        window.history.replaceState({}, '', '/account');
        setLoading(false);
      }
    };

    void applyTelegramLogin();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const vkEntry = params.get('vk_entry');
    if (vkEntry !== 'login' && vkEntry !== 'link') return;

    params.delete('vk_entry');
    const next = params.toString();
    window.history.replaceState({}, '', next ? `/account?${next}` : '/account');

    void startVkAuth(vkEntry);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const vkStatus = params.get('vk_status');
    if (!vkStatus) return;
    setMessage(VK_STATUS_MESSAGE[vkStatus] || 'Состояние VK обновлено.');

    params.delete('vk_status');
    const next = params.toString();
    window.history.replaceState({}, '', next ? `/account?${next}` : '/account');

    if (vkStatus === 'vk_logged_in' || vkStatus === 'vk_linked' || vkStatus === 'vk_already_linked') {
      void loadSession();
    }
  }, []);

  useEffect(() => {
    if (requestRetryAfterSec <= 0) return undefined;

    const timerId = window.setInterval(() => {
      setRequestRetryAfterSec(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [requestRetryAfterSec]);

  useEffect(() => {
    if (step !== 'waitcall') return undefined;

    void checkPhoneAuthStatus(true);
    const timerId = window.setInterval(() => {
      void checkPhoneAuthStatus(true);
    }, 3000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [phone, step]);

  useEffect(() => {
    if ((step !== 'verify' && step !== 'waitcall') || !waitcallExpiresAt) {
      setCountdownSec(0);
      return undefined;
    }

    const sync = () => {
      const remaining = Math.max(0, Math.ceil((new Date(waitcallExpiresAt).getTime() - Date.now()) / 1000));
      setCountdownSec(remaining);
      if (remaining <= 0) {
        resetPhoneAuthFlow('Время подтверждения истекло. Запросите код заново.');
      }
    };

    sync();
    const timerId = window.setInterval(sync, 1000);
    return () => window.clearInterval(timerId);
  }, [step, waitcallExpiresAt]);

  useEffect(() => {
    if (user?.id) {
      clearPendingPhoneAuthState();
      return;
    }

    if (step !== 'verify' && step !== 'waitcall') {
      clearPendingPhoneAuthState();
      return;
    }

    if (!waitcallExpiresAt || new Date(waitcallExpiresAt).getTime() <= Date.now()) {
      clearPendingPhoneAuthState();
      return;
    }

    const normalized = normalizePhoneDigits(phone);
    if (normalized.length !== 11) return;

    persistPendingPhoneAuthState({
      phone,
      step,
      expiresAt: waitcallExpiresAt,
      waitcallPhone,
      message,
    });
  }, [message, phone, step, user?.id, waitcallExpiresAt, waitcallPhone]);

  useEffect(() => {
    if (!user?.id || cookieChoice === 'unknown') return;
    const syncKey = `${user.id}:${cookieChoice}:${COOKIE_POLICY_VERSION}`;
    if (consentSyncKeyRef.current === syncKey) return;

    consentSyncKeyRef.current = syncKey;
    void persistCookieConsent({
      analytics: cookieChoice === 'all',
      version: COOKIE_POLICY_VERSION,
    });
  }, [cookieChoice, user?.id]);

  const requestCode = async () => {
    if (!isCompleteRussianPhone(phone)) {
      setMessage('Введите номер в формате +7 (___) ___-__-__.');
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/phone/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: toApiPhone(phone) }),
      });
      const data = await res.json() as PhoneRequestResponse;
      setRequestRetryAfterSec(Number(data.retryAfterSec || 0));
      if (data.success) {
        setCode('');
        setWaitcallExpiresAt(data.expiresAt || null);
        if (data.delivery === 'waitcall' && data.waitcallPhone) {
          setWaitcallPhone(data.waitcallPhone);
          setStep('waitcall');
          setMessage(
            data.message || 'Позвоните на указанный номер с этого телефона. После звонка вход завершится автоматически.',
          );
        } else {
          setWaitcallPhone(null);
          setStep('verify');
          setMessage(data.message || 'Код отправлен');
        }
      } else {
        setMessage(data.message || 'Не удалось отправить код');
      }
    } catch {
      setMessage('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!isCompleteRussianPhone(phone)) {
      setMessage('Введите номер в формате +7 (___) ___-__-__.');
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: toApiPhone(phone), code }),
      });
      const data = await res.json();
      if (data.success) {
        resetPhoneAuthFlow('Вход выполнен');
        await loadSession();
      } else {
        setMessage('Неверный код');
      }
    } catch {
      setMessage('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  const checkPhoneAuthStatus = async (silent = false) => {
    if (!isCompleteRussianPhone(phone)) return;

    if (!silent) {
      setStatusChecking(true);
      setMessage('Проверяем подтверждение звонка...');
    }

    try {
      const res = await fetch(`/api/auth/phone/status?phone=${encodeURIComponent(toApiPhone(phone))}`, {
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({ success: false, verified: false }));
      if (data?.verified) {
        resetPhoneAuthFlow('Вход выполнен');
        await loadSession();
        return;
      }

      if (!silent && data?.state === 'pending') {
        setMessage('Подтверждение ещё не получено. Если вы уже позвонили, подождите несколько секунд.');
        return;
      }

      if (data?.state === 'not_found') {
        resetPhoneAuthFlow('Запрос подтверждения истёк. Запросите вход заново.');
        return;
      }

      if (!silent) {
        setMessage('Подтверждение ещё не получено. Если вы уже позвонили, подождите несколько секунд.');
      }
    } catch {
      if (!silent) {
        setMessage('Не удалось проверить статус. Попробуйте ещё раз через несколько секунд.');
      }
    } finally {
      if (!silent) {
        setStatusChecking(false);
      }
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setOverview(null);
    setOrders([]);
    setInstructions([]);
    resetPhoneAuthFlow('Вы вышли из аккаунта');
  };

  const unlinkTelegram = async () => {
    const result = await unlinkTelegramAccount();
    if (result?.success) {
      setMessage('Telegram отвязан. Вход по телефону сохранён.');
      await loadSession();
      return;
    }
    setMessage('Не удалось отвязать Telegram');
  };

  const unlinkVk = async () => {
    const result = await unlinkVkAccount();
    if (result?.success) {
      setMessage('VK отвязан. Вход по телефону сохранён.');
      await loadSession();
      return;
    }
    setMessage('Не удалось отвязать VK');
  };

  const saveProfile = async () => {
    if (!user) return;

    setProfileSaving(true);
    setMessage(null);
    try {
      const result = await updateAccountProfile({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        birthDate: profileForm.birthDate || null,
        deliveryCity: profileForm.deliveryCity,
        deliveryAddress: profileForm.deliveryAddress,
        notifyOrderStatus: profileForm.notifyOrderStatus,
        notifySubscription: profileForm.notifySubscription,
        notifyService: profileForm.notifyService,
        notifyMarketing: profileForm.notifyMarketing,
        marketingConsent: profileForm.notifyMarketing,
      });

      if (result?.success) {
        await loadSession();
      } else {
        setMessage('Не удалось сохранить профиль');
      }
    } catch {
      setMessage('Ошибка сети при сохранении профиля');
    } finally {
      setProfileSaving(false);
    }
  };

  const applyCookieChoice = async (choice: CookieChoice) => {
    if (choice === 'unknown') return;

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, choice);
      document.cookie = `${COOKIE_CONSENT_KEY}=${encodeURIComponent(choice)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    }

    setCookieChoice(choice);

    await persistCookieConsent({
      analytics: choice === 'all',
      version: COOKIE_POLICY_VERSION,
    }).catch(() => undefined);
  };

  const onRenewClick = () => {
    setMessage('Продление скоро будет доступно в личном кабинете.');
  };

  return (
    <div className="space-y-6 pb-2 sm:space-y-8 sm:pb-2">
      <SectionTitle
        eyebrow="Личный кабинет"
        title="Личный кабинет TechnoPrime"
        subtitle="История заказов, подписки, связи с менеджером и настройки уведомлений в одном экране."
      />

      {!sessionResolved ? (
        <GlassCard className="p-5 sm:p-8">
          <p className="text-sm text-slate-300">Загружаем личный кабинет...</p>
        </GlassCard>
      ) : user && overview ? (
        <div className="space-y-6">
          <GlassCard className="p-4 sm:p-6 md:p-8">
            <div className="grid grid-cols-[1fr_auto] items-stretch gap-2.5">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3 sm:border-transparent sm:bg-transparent sm:p-0">
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/80">Аккаунт активен</p>
                <p className="text-xl font-semibold text-white sm:text-2xl">{displayName}</p>
                <p className="text-sm text-slate-300">Телефон: {formatAccountPhone(overview.user.phone) || 'не указан'}</p>
              </div>
              <div className="flex shrink-0">
                <button
                  type="button"
                  onClick={logout}
                  className="group inline-flex h-full min-h-[92px] w-[112px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-cyan-200/25 bg-gradient-to-b from-white/[0.08] to-white/[0.02] px-2 text-[12px] font-semibold leading-tight text-slate-100 transition hover:border-cyan-200/45 hover:from-white/[0.12] hover:to-white/[0.04] sm:min-h-11 sm:w-auto sm:flex-row sm:gap-2 sm:rounded-xl sm:px-3 sm:text-sm"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                    <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="m14 16 4-4-4-4M18 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-center">Сменить аккаунт</span>
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1.5 sm:mt-5 sm:gap-2.5">
              <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2.5 sm:rounded-2xl sm:p-4">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400 sm:text-xs sm:tracking-[0.2em]">Заказы</p>
                <p className="mt-1 text-lg font-semibold sm:mt-2 sm:text-2xl">{accountOrdersCount}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2.5 sm:rounded-2xl sm:p-4">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400 sm:text-xs sm:tracking-[0.2em]">Активные подписки</p>
                <p className="mt-1 text-lg font-semibold sm:mt-2 sm:text-2xl">{overview.stats.activeSubscriptionsCount}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2.5 sm:rounded-2xl sm:p-4">
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400 sm:text-xs sm:tracking-[0.2em]">Ближайшая дата окончания подписки</p>
                <p className="mt-1 text-[11px] leading-tight text-slate-200 sm:mt-2 sm:text-sm">
                  {overview.stats.nextSubscriptionExpireAt
                    ? new Date(overview.stats.nextSubscriptionExpireAt).toLocaleDateString('ru-RU')
                    : 'Активных подписок нет'}
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard id="my-dialogs" className="relative overflow-hidden border-cyan-200/20 p-4 sm:p-5">
            <div className="pointer-events-none absolute -right-10 -top-8 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl" />
            <div className="relative space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">Мои диалоги</p>
                  <p className="text-sm text-slate-300">
                    Пишите менеджеру прямо из кабинета и смотрите историю в реальном времени.
                  </p>
                </div>
                <span className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-100">
                  Online
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">
                  Единая история переписки
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">
                  Обычно отвечаем в течение 10 минут
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-300/35 bg-cyan-500/10 p-3">
                <ConsultationDialog
                  className="w-full justify-center"
                  variant="secondary"
                  size="sm"
                  label="Открыть диалог"
                />
              </div>
            </div>
          </GlassCard>

          <GlassCard id="subscriptions" className="space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-lg font-semibold">Подписки</p>
              <p className="text-sm text-slate-300">Всего: {overview.subscriptions.length}</p>
            </div>

            {overview.subscriptions.length === 0 ? (
              <p className="text-sm text-slate-300">Подписок пока нет.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {overview.subscriptions.map(subscription => {
                  const badge = getSubscriptionBadge(subscription);
                  const accessGroups = getSubscriptionAccessGroups(subscription);

                  return (
                    <div key={subscription.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{subscription.typeLabel}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                          {subscription.accountType === 'SHARING_CLIENT'
                            ? 'Шеринг'
                            : subscription.accountType === 'PERSONAL'
                              ? 'Личный аккаунт'
                              : 'Донорский аккаунт'}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-slate-300">
                      <p>Платформа: {subscription.consoleType || '—'}</p>
                      <p>Период: {subscription.subscriptionPeriodLabel}</p>
                      <p>До: {new Date(subscription.endDate).toLocaleDateString('ru-RU')}</p>
                    </div>
                    {accessGroups.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {accessGroups.map(group => (
                          <div key={group.title} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                              {group.title}
                            </p>
                            <div className="mt-2 space-y-1">
                              {group.fields.map(field => (
                                <p key={`${group.title}-${field.label}`}>
                                  {field.label}: {field.value}
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : subscription.accountType === 'SHARING_CLIENT' ? (
                      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                        Подписка активна. Данные подключенного аккаунта появятся здесь после завершения настройки доступа.
                      </div>
                    ) : subscription.accountType === 'SHARING_DONOR' ? (
                      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                        Донорские данные скрыты и не отображаются в личном кабинете.
                      </div>
                    ) : null}
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!subscription.canRenew}
                        onClick={onRenewClick}
                        className={!subscription.canRenew ? 'cursor-not-allowed opacity-60' : ''}
                      >
                        Продлить
                      </Button>
                      {!subscription.canRenew ? (
                        <span className="text-xs text-slate-400">Доступно за 7 дней до окончания</span>
                      ) : null}
                    </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          <GlassCard id="console-instructions" className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold">Инструкции по вашим приставкам</p>
                <p className="text-sm text-slate-300">
                  Доступ открывается только по купленным платформам и активным сервисам.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
                {instructions.length} доступно
              </span>
            </div>

            {!instructions.length ? (
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                Для вашего профиля пока нет персональных инструкций. После покупки совместимой приставки раздел появится автоматически.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {availableInstructions.map((item) => {
                    const isActive = activeInstruction?.consoleKey === item.consoleKey;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveInstructionKey(item.consoleKey)}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                          isActive
                            ? 'border-cyan-300/60 bg-cyan-500/20 text-cyan-50'
                            : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10'
                        }`}
                      >
                        {item.consoleLabel}
                      </button>
                    );
                  })}
                </div>

                {activeInstruction ? (
                  <div className="grid gap-3 lg:grid-cols-[minmax(220px,280px),1fr]">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Разделы</p>
                      <div className="space-y-2">
                        {activeInstructionSections.map((section) => {
                          const selected = activeSectionKey === section.key;
                          return (
                            <button
                              key={section.key}
                              type="button"
                              onClick={() => setActiveSectionByInstruction((prev) => ({
                                ...prev,
                                [activeInstruction.consoleKey]: section.key,
                              }))}
                              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                                selected
                                  ? 'border-cyan-300/60 bg-cyan-500/20 text-cyan-50'
                                  : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10'
                              }`}
                            >
                              {section.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-cyan-200/20 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-4 sm:p-5">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">{activeInstruction.consoleLabel}</p>
                        <h3 className="text-xl font-semibold text-white">{activeInstruction.title}</h3>
                        {activeInstruction.subtitle ? (
                          <p className="text-sm text-slate-300">{activeInstruction.subtitle}</p>
                        ) : null}
                      </div>

                      {activeSection ? (
                        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                          <p className="mb-3 text-lg font-semibold text-white">{activeSection.title}</p>
                          <div className="space-y-3 text-[15px]">
                            {renderInstructionContent(activeSection.content)}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-slate-300">Выберите раздел инструкции слева.</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </GlassCard>

          <GlassCard id="orders-history" className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-lg font-semibold">История заказов</p>
              <Button variant="secondary" size="sm" onClick={() => void loadSession()} className="w-full sm:w-auto">
                Обновить
              </Button>
            </div>

            {!overview.user.phone ? (
              <p className="text-sm text-slate-300">Для истории заказов нужен подтвержденный номер телефона.</p>
            ) : visibleOrders.length === 0 ? (
              <p className="text-sm text-slate-300">Заказов пока нет.</p>
            ) : (
              <div className="space-y-3">
                {visibleOrders.map((order, index) => (
                  <div key={order.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">Заказ #{orderedOrders.length - index}</p>
                      <p className="text-xs text-slate-400">{new Date(order.date).toLocaleString('ru-RU')}</p>
                    </div>
                    <div className="mt-2 grid gap-1 text-sm text-slate-300 md:grid-cols-3">
                      <p>
                        Статус:{' '}
                        {order.paymentState === 'PAID'
                          ? 'Оплачен'
                          : order.paymentState === 'AWAITING_PAYMENT'
                            ? 'Ожидает оплаты'
                            : formatOrderStatus(order.status)}
                      </p>
                      <p>Оплата: {formatPaymentMethod(order.paymentMethod)}</p>
                      <p>Сумма: {formatPrice(Number(order.totalPrice || 0), 'RUB')}</p>
                    </div>
                    {order.canResumePayment && order.reserveUntil ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-3 text-sm text-slate-100">
                        <div>
                          <p className="font-semibold text-cyan-100">Бронь и оплата ещё активны</p>
                          <p className="mt-1 text-xs text-slate-300">
                            Осталось {formatCountdown(Math.max(0, Math.ceil((new Date(order.reserveUntil).getTime() - ordersNowTs) / 1000)))}
                          </p>
                        </div>
                        <Link href={order.paymentUrl || `/checkout/payment?orderId=${order.id}`}>
                          <Button size="sm">Оплатить</Button>
                        </Link>
                      </div>
                    ) : null}
                    {order.status === 'CANCELED' && order.cancellationReason ? (
                      <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-3 text-sm text-rose-100">
                        {order.cancellationReason}
                      </div>
                    ) : null}
                    {order.shipment ? (
                      <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-3 text-sm text-slate-100">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-cyan-100">Доставка: {formatShipmentCarrier(order.shipment.carrier)}</p>
                            <p className="mt-1 text-slate-200">{formatShipmentStatus(order.shipment.status)}</p>
                          </div>
                          {formatDeliveryDate(order.shipment.expectedDeliveryAt) ? (
                            <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
                              Ориентировочно: {formatDeliveryDate(order.shipment.expectedDeliveryAt)}
                            </div>
                          ) : null}
                        </div>
                        {order.shipment.receiverPoint ? (
                          <p className="mt-2 text-xs text-slate-300">Пункт получения: {order.shipment.receiverPoint}</p>
                        ) : null}
                        {order.shipment.customerNote ? (
                          <p className="mt-2 text-xs text-slate-300">{order.shipment.customerNote}</p>
                        ) : null}
                        {order.shipment.events?.length ? (
                          <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-xs text-slate-300">
                            {order.shipment.events.slice(-3).map(event => (
                              <p key={event.id}>
                                {event.title} · {new Date(event.createdAt).toLocaleDateString('ru-RU')}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-3 space-y-1 text-sm text-slate-300">
                      {order.items.map(item => (
                        <p key={item.id}>
                          {item.product?.name || `Товар #${item.id}`}
                          {item.variantLabel ? ` (${item.variantLabel})` : ''} × {item.qty}
                          {item.serialNumber ? ` • SN: ${item.serialNumber}` : ''}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
            <GlassCard className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-semibold">Настройки профиля</p>
                  <p className="text-sm text-slate-300">Телефон менять нельзя: он является ключом авторизации.</p>
                </div>
                <Button onClick={saveProfile} disabled={profileSaving} className="w-full sm:w-auto">
                  {profileSaving ? 'Сохраняем...' : 'Сохранить'}
                </Button>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-slate-300">Имя</span>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    value={profileForm.firstName}
                    onChange={event => setProfileForm(prev => ({ ...prev, firstName: event.target.value }))}
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-slate-300">Фамилия</span>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    value={profileForm.lastName}
                    onChange={event => setProfileForm(prev => ({ ...prev, lastName: event.target.value }))}
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-slate-300">Дата рождения</span>
                  <input
                    type="date"
                    className="tp-date-input w-full min-w-0 max-w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-left text-white [color-scheme:dark]"
                    value={profileForm.birthDate}
                    onChange={event => setProfileForm(prev => ({ ...prev, birthDate: event.target.value }))}
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-slate-300">Город доставки</span>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                    value={profileForm.deliveryCity}
                    onChange={event => setProfileForm(prev => ({ ...prev, deliveryCity: event.target.value }))}
                  />
                </label>
              </div>

              <label className="space-y-1 text-sm block">
                <span className="text-slate-300">Адрес доставки</span>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white sm:min-h-28"
                  value={profileForm.deliveryAddress}
                  onChange={event => setProfileForm(prev => ({ ...prev, deliveryAddress: event.target.value }))}
                />
              </label>

              <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3.5 sm:p-4">
                <p className="text-sm font-semibold">Уведомления</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                    <span>Статусы заказов</span>
                    <input
                      type="checkbox"
                      checked={profileForm.notifyOrderStatus}
                      onChange={event =>
                        setProfileForm(prev => ({ ...prev, notifyOrderStatus: event.target.checked }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                    <span>Подписки и продления</span>
                    <input
                      type="checkbox"
                      checked={profileForm.notifySubscription}
                      onChange={event =>
                        setProfileForm(prev => ({ ...prev, notifySubscription: event.target.checked }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                    <span>Важные сервисные сообщения</span>
                    <input
                      type="checkbox"
                      checked={profileForm.notifyService}
                      onChange={event =>
                        setProfileForm(prev => ({ ...prev, notifyService: event.target.checked }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                    <span>Я согласен получать рекламные сообщения</span>
                    <input
                      type="checkbox"
                      checked={profileForm.notifyMarketing}
                      onChange={event =>
                        setProfileForm(prev => ({ ...prev, notifyMarketing: event.target.checked }))
                      }
                    />
                  </label>
                </div>
              </div>
            </GlassCard>

            <GlassCard id="linked-accounts" className="space-y-4 p-4 sm:p-5">
              <div>
                <p className="text-lg font-semibold">Привязанные аккаунты</p>
                <p className="text-sm text-slate-300">Если Telegram отвязан, вход по SMS и номеру останется доступен.</p>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Telegram</p>
                      <p className="text-sm text-slate-300">
                        {overview.linkedAccounts.telegram.connected
                          ? `Привязан: @${overview.linkedAccounts.telegram.username || 'username'}`
                          : 'Не привязан'}
                      </p>
                    </div>
                    {overview.linkedAccounts.telegram.connected ? (
                      <Button variant="secondary" size="sm" onClick={unlinkTelegram}>Отвязать</Button>
                    ) : botLoginLink ? (
                      <a href={botLoginLink} target="_blank" rel="noreferrer">
                        <Button size="sm">Привязать</Button>
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">VK</p>
                      <p className="mt-1 text-sm text-slate-300">
                        {overview.linkedAccounts.vk.connected
                          ? `ID: ${overview.linkedAccounts.vk.id || overview.user.vkId || '—'}`
                          : 'Привязка выполняется только из уже авторизованного кабинета: нажмите «Привязать», получите код и отправьте его VK-боту.'}
                      </p>
                    </div>
                    {overview.linkedAccounts.vk.connected ? (
                      <Button variant="secondary" size="sm" onClick={unlinkVk}>Отвязать</Button>
                    ) : (
                      <Button size="sm" onClick={() => void startVkAuth('link')} disabled={loading}>
                        Привязать
                      </Button>
                    )}
                  </div>
                  {!overview.linkedAccounts.vk.connected && vkLinkCode ? (
                    <div className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Код привязки VK</p>
                      <p className="mt-2 font-mono text-2xl font-semibold tracking-[0.3em] text-white">
                        {vkLinkCode}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        Отправьте этот код в личные сообщения VK-боту.
                        {vkLinkExpiresAt
                          ? ` Код действует до ${new Date(vkLinkExpiresAt).toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}.`
                          : ''}
                      </p>
                      <a
                        href={vkLinkUrl || vkBotLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20"
                      >
                        Открыть VK-бота
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <GlassCard className={`h-full p-4 sm:p-6 ${step !== 'request' ? 'relative z-[240]' : ''}`}>
            <div className="flex h-full flex-col justify-between gap-4">
            <div className="space-y-1">
              <p className="text-lg font-semibold">Единая авторизация по номеру телефона</p>
              <p className="text-sm text-slate-300">
                Подтвержденный номер обеспечивает защищенный доступ к профилю, заказам и подпискам.
              </p>
            </div>

            <label className="space-y-1 text-sm block">
              <span className="text-slate-200">Телефон</span>
              <input
                value={phone}
                onChange={event => setPhone(formatPhoneInput(event.target.value))}
                placeholder="+7 (___) ___-__-__"
                inputMode="tel"
                autoComplete="tel"
                className="w-full rounded-xl border border-white/50 bg-white/95 px-4 py-3 text-sm text-slate-900 caret-slate-900 placeholder:text-slate-500 shadow-inner focus:border-cyan-400 focus:outline-none"
              />
            </label>

            {step === 'verify' ? (
              <input
                value={code}
                onChange={event => setCode(event.target.value)}
                placeholder="Код подтверждения"
                inputMode="numeric"
                className="w-full rounded-xl border border-white/50 bg-white/95 px-4 py-3 text-sm text-slate-900 caret-slate-900 placeholder:text-slate-500 shadow-inner focus:border-cyan-400 focus:outline-none"
              />
            ) : null}

            {step === 'waitcall' ? (
              <div className="space-y-3 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-100">Подтверждение звонком</p>
                    <p className="text-sm text-slate-200">Позвоните с этого номера на:</p>
                  </div>
                  {countdownSec > 0 ? (
                    <div className="rounded-xl border border-emerald-200/25 bg-black/20 px-3 py-2 text-right">
                      <p className="text-lg font-semibold leading-none text-white">{formatCountdown(countdownSec)}</p>
                    </div>
                  ) : null}
                </div>
                <p className="text-lg font-semibold text-white">{formatWaitcallPhone(waitcallPhone)}</p>
                <p className="text-xs text-slate-300">
                  После звонка вход завершится автоматически.
                </p>
              </div>
            ) : null}

            <div className="relative z-[245] flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {step === 'request' ? (
                <Button
                  onClick={requestCode}
                  disabled={loading}
                  className="relative z-[260] w-full touch-manipulation bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 hover:brightness-110"
                >
                  Получить код
                </Button>
              ) : step === 'waitcall' ? (
                <>
                  <Button
                    onClick={() => void checkPhoneAuthStatus()}
                    disabled={loading || statusChecking}
                    className="relative z-[260] w-full touch-manipulation sm:flex-1 bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 hover:brightness-110"
                  >
                    {statusChecking ? 'Проверяем...' : 'Проверить статус'}
                  </Button>
                  <Button
                    variant="secondary"
                    className="relative z-[260] w-full touch-manipulation sm:flex-1"
                    onClick={() => {
                      setStep('request');
                      setWaitcallPhone(null);
                      setWaitcallExpiresAt(null);
                    }}
                  >
                    Назад
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={verifyCode}
                    disabled={loading}
                    className="relative z-[260] w-full touch-manipulation sm:flex-1 bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 hover:brightness-110"
                  >
                    Подтвердить
                  </Button>
                  <Button
                    variant="secondary"
                    className="relative z-[260] w-full touch-manipulation sm:flex-1"
                    onClick={requestCode}
                    disabled={loading || requestRetryAfterSec > 0}
                  >
                    {requestRetryAfterSec > 0
                      ? `Отправить снова через ${requestRetryAfterSec} сек`
                      : 'Отправить код повторно'}
                  </Button>
                </>
              )}
            </div>
            </div>
          </GlassCard>

          <GlassCard className="h-full p-4 sm:p-6">
            <div className="flex h-full flex-col justify-between gap-4">
            <div className="space-y-1">
              <p className="text-lg font-semibold">Единая авторизация через социальные аккаунты</p>
              <p className="text-sm text-slate-300">
                Telegram выполняет вход напрямую. VK используется только после безопасной привязки в уже авторизованном кабинете.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {botLoginLink ? (
                <a
                  href={botLoginLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-cyan-200/70 bg-gradient-to-r from-sky-500 to-cyan-400 px-3 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(34,211,238,0.35)] transition hover:brightness-110"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/25 text-white">
                    <TelegramIcon />
                  </span>
                  TG
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-cyan-200/70 bg-gradient-to-r from-sky-500 to-cyan-400 px-3 py-2 text-sm font-semibold text-white opacity-70"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/25 text-white">
                    <TelegramIcon />
                  </span>
                  TG
                </button>
              )}

              <button
                type="button"
                onClick={() => void startVkAuth('login')}
                disabled={loading}
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-[#89b3ff]/70 bg-gradient-to-r from-[#2f7cff] to-[#2b65d9] px-3 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(47,124,255,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/25 text-white">
                    <VkIcon />
                  </span>
                  VK Bot
                </button>
            </div>

            <p className="text-xs text-slate-400">
              Для VK: сначала привяжите аккаунт в личном кабинете, затем отправляйте боту слово «вход».
            </p>

            <p className="text-xs text-slate-400">
              Отправляя персональные данные в боте, вы подтверждаете согласие с{' '}
              <Link href="/legal/privacy" className="underline">политикой данных</Link>{' '}
              и{' '}
              <Link href="/legal/cookies" className="underline">cookies-политикой</Link>.
            </p>
            </div>
          </GlassCard>
        </div>
      )}

      {message ? (
        <GlassCard className="p-4">
          <p className="text-sm text-slate-200">{message}</p>
        </GlassCard>
      ) : null}

      {cookieChoice === 'unknown' ? (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.6rem)] left-1/2 z-[220] w-[min(100%-1.5rem,920px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-cyan-200/25 bg-gradient-to-r from-slate-950/95 via-slate-900/95 to-slate-950/95 p-4 shadow-[0_18px_50px_rgba(8,47,73,0.45)] backdrop-blur-xl md:bottom-4">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[radial-gradient(circle_at_left,rgba(34,211,238,0.28),transparent_65%)]" />
          <div className="relative grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <p className="text-sm leading-relaxed text-slate-100">
              Мы используем необходимые cookies для входа и безопасности. Аналитические cookies подключаются только после вашего согласия.
            </p>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:w-auto md:min-w-[360px]">
              <Button
                variant="secondary"
                size="sm"
                className="h-10 w-full justify-center border-white/30 bg-white/10 text-white hover:bg-white/15"
                onClick={() => void applyCookieChoice('necessary')}
              >
                Только необходимые
              </Button>
              <Button
                size="sm"
                className="h-10 w-full justify-center bg-gradient-to-r from-cyan-400 to-sky-400 text-slate-950 hover:brightness-110"
                onClick={() => void applyCookieChoice('all')}
              >
                Принять все
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
