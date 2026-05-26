export const CRM_LIVE_NOTIFICATION_EVENT = 'crm-live-notification';

export type CrmLiveNotification = {
  id?: string;
  title: string;
  text?: string;
  createdAt?: string;
  source?: string;
  accountId?: number;
  chatId?: string;
  href?: string;
};

export function emitCrmLiveNotification(payload: CrmLiveNotification) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CRM_LIVE_NOTIFICATION_EVENT, { detail: payload }));
}
