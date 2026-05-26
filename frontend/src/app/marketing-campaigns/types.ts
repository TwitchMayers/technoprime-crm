export type Channel = 'TELEGRAM' | 'VK' | 'MAX';
export type AudienceType = 'ALL' | 'ACTIVE_ORDERS' | 'SUBSCRIPTIONS' | 'REGISTERED_RANGE';

export type CampaignAttachment = {
  fileName: string;
  mimeType?: string | null;
  size?: number | null;
  path?: string;
};

export type MarketingCampaign = {
  id: number;
  title: string;
  message: string;
  buttonText?: string | null;
  buttonUrl?: string | null;
  attachments?: CampaignAttachment[] | null;
  channels: Channel[];
  audienceType: AudienceType;
  status: 'DRAFT' | 'SENT';
  isSending: boolean;
  sentCount: number;
  errorCount: number;
  createdAt: string;
  sentAt?: string | null;
};

export type CampaignFormState = {
  title: string;
  message: string;
  buttonText: string;
  buttonUrl: string;
  files: File[];
  channels: Channel[];
  audienceType: AudienceType;
  registeredFrom: string;
  registeredTo: string;
};

export type ClientAudienceItem = {
  id: number;
  telegramId?: string | null;
  vkId?: string | null;
  maxId?: string | null;
  marketingConsent?: boolean;
  createdAt?: string;
  orders?: unknown[];
  subscriptions?: unknown[];
};

export const CHANNEL_OPTIONS: Array<{ value: Channel; label: string; short: string }> = [
  { value: 'TELEGRAM', label: 'Telegram', short: 'TG' },
  { value: 'VK', label: 'VK', short: 'VK' },
  { value: 'MAX', label: 'MAX', short: 'MAX' },
];

export const AUDIENCE_OPTIONS: Array<{ value: AudienceType; label: string }> = [
  { value: 'ALL', label: 'Все клиенты' },
  { value: 'ACTIVE_ORDERS', label: 'Только с активными заказами' },
  { value: 'SUBSCRIPTIONS', label: 'Только с подписками' },
  { value: 'REGISTERED_RANGE', label: 'Кастом (по дате регистрации)' },
];

export const initialCampaignForm: CampaignFormState = {
  title: '',
  message: '',
  buttonText: '',
  buttonUrl: '',
  files: [],
  channels: ['TELEGRAM'],
  audienceType: 'ALL',
  registeredFrom: '',
  registeredTo: '',
};
