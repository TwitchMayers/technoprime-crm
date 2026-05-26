import { Gamepad2, Play, StopCircle, type LucideIcon } from 'lucide-react';

export type SharingConsoleType = 'PS4' | 'PS5' | 'XBOX_1' | 'XBOX_2';
export type SharingSubscriptionType = 'PS_PLUS' | 'GAME_PASS' | 'EA_PLAY';

export type SharingSlotStats = {
  ps5?: { used: number; max: number; available: number };
  ps4?: { used: number; max: number; available: number };
  xbox1?: { used: number; max: number; available: number };
  xbox2?: { used: number; max: number; available: number };
};

export const sharingConsoleMeta: Record<
  SharingConsoleType,
  {
    label: string;
    fullLabel: string;
    description: string;
    icon: LucideIcon;
    activeClass: string;
    textClass: string;
    badgeClass: string;
    barClass: string;
  }
> = {
  PS5: {
    label: 'PS5',
    fullLabel: 'PlayStation 5',
    description: 'Следующее поколение',
    icon: Play,
    activeClass: 'border-teal-500 bg-teal-500/10',
    textClass: 'text-teal-400',
    badgeClass: 'bg-teal-500/20 text-teal-400',
    barClass: 'from-teal-500 to-teal-400',
  },
  PS4: {
    label: 'PS4',
    fullLabel: 'PlayStation 4',
    description: 'Предыдущее поколение',
    icon: StopCircle,
    activeClass: 'border-blue-500 bg-blue-500/10',
    textClass: 'text-blue-400',
    badgeClass: 'bg-blue-500/20 text-blue-400',
    barClass: 'from-blue-500 to-blue-400',
  },
  XBOX_1: {
    label: 'Xbox #1',
    fullLabel: 'Xbox #1',
    description: 'Донорский аккаунт',
    icon: Gamepad2,
    activeClass: 'border-emerald-500 bg-emerald-500/10',
    textClass: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/20 text-emerald-400',
    barClass: 'from-emerald-500 to-teal-400',
  },
  XBOX_2: {
    label: 'Xbox #2',
    fullLabel: 'Xbox #2',
    description: 'Донор + личный аккаунт',
    icon: Gamepad2,
    activeClass: 'border-lime-500 bg-lime-500/10',
    textClass: 'text-lime-400',
    badgeClass: 'bg-lime-500/20 text-lime-400',
    barClass: 'from-lime-500 to-emerald-400',
  },
};

export function isXboxConsoleType(value?: string | null): value is 'XBOX_1' | 'XBOX_2' {
  return value === 'XBOX_1' || value === 'XBOX_2';
}

export function getSharingConsoleMeta(value?: string | null) {
  if (value === 'PS4' || value === 'PS5' || value === 'XBOX_1' || value === 'XBOX_2') {
    return sharingConsoleMeta[value];
  }
  return sharingConsoleMeta.PS5;
}

export function getSlotStat(stats: SharingSlotStats | undefined, type: SharingConsoleType) {
  if (type === 'PS5') return stats?.ps5 || { used: 0, max: 0, available: 0 };
  if (type === 'PS4') return stats?.ps4 || { used: 0, max: 0, available: 0 };
  if (type === 'XBOX_1') return stats?.xbox1 || { used: 0, max: 0, available: 0 };
  return stats?.xbox2 || { used: 0, max: 0, available: 0 };
}

export function getSharingSlotTypes(donorConsoleType?: string | null): SharingConsoleType[] {
  return isXboxConsoleType(donorConsoleType) ? ['XBOX_1', 'XBOX_2'] : ['PS5', 'PS4'];
}

export function getFirstAvailableSlotType(
  donorConsoleType: string | null | undefined,
  stats: SharingSlotStats | undefined,
): SharingConsoleType {
  const options = getSharingSlotTypes(donorConsoleType);
  return options.find(type => getSlotStat(stats, type).available > 0) || options[0];
}

export function getSharingConsoleTypesForSubscription(
  subscriptionType: SharingSubscriptionType,
): SharingConsoleType[] {
  return subscriptionType === 'GAME_PASS' ? ['XBOX_1', 'XBOX_2'] : ['PS5', 'PS4'];
}

export function isSharingConsoleCompatibleWithSubscription(
  subscriptionType: SharingSubscriptionType,
  consoleType?: string | null,
) {
  return getSharingConsoleTypesForSubscription(subscriptionType).includes(consoleType as SharingConsoleType);
}

export function getDefaultSharingConsoleType(subscriptionType: SharingSubscriptionType): SharingConsoleType {
  return getSharingConsoleTypesForSubscription(subscriptionType)[0];
}
