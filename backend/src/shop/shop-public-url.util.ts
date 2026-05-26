const PRODUCTION_SHOP_URL = 'https://technoprimestore.ru';

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function isLocalOrTunnelHost(hostname: string) {
  const host = String(hostname || '').toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.nip.io') ||
    host.endsWith('.lhr.life')
  );
}

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function resolveShopPublicUrl(input?: string | null) {
  const fallback = PRODUCTION_SHOP_URL;
  const raw = String(input || process.env.SHOP_PUBLIC_URL || '').trim();

  if (!raw) {
    return process.env.NODE_ENV === 'production' ? fallback : 'http://localhost:3000';
  }

  const parsed = parseUrl(raw);
  if (!parsed) {
    return process.env.NODE_ENV === 'production' ? fallback : raw;
  }

  if (process.env.NODE_ENV === 'production') {
    if (isLocalOrTunnelHost(parsed.hostname)) {
      return fallback;
    }

    if (parsed.protocol !== 'https:') {
      parsed.protocol = 'https:';
      if (parsed.port === '80') {
        parsed.port = '';
      }
    }
  }

  return trimTrailingSlash(parsed.toString());
}

export function resolveTelegramShopPublicUrl() {
  const telegramRaw = String(process.env.SHOP_TELEGRAM_PUBLIC_URL || '').trim();
  return resolveShopPublicUrl(telegramRaw || undefined);
}
