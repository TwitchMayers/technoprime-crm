import type { Metadata } from 'next';

export const SITE_NAME = 'TechnoPrime Store';
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SHOP_PUBLIC_URL ||
  process.env.SHOP_PUBLIC_URL ||
  'https://technoprimestore.ru'
).replace(/\/$/, '');

function normalizeText(value: string | null | undefined, fallback: string, maxLength: number) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return fallback;
  return normalized.slice(0, maxLength);
}

export function absoluteUrl(path = '/') {
  const preparedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(preparedPath, SITE_URL).toString();
}

export function normalizeMetadataImage(image?: string | null) {
  const raw = String(image || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return absoluteUrl(raw);
}

export function buildOgImageUrl(title?: string | null, description?: string | null) {
  const params = new URLSearchParams();
  if (title) params.set('title', normalizeText(title, '', 90));
  if (description) params.set('subtitle', normalizeText(description, '', 140));
  return absoluteUrl(`/api/og?${params.toString()}`);
}

export function buildPageMetadata(input: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: 'website' | 'article';
  noIndex?: boolean;
}) {
  const title = normalizeText(input.title, SITE_NAME, 200);
  const description = normalizeText(
    input.description,
    'Каталог игровых приставок, аксессуаров и сервисов TechnoPrime.',
    320,
  );
  const canonical = absoluteUrl(input.path);
  const image = normalizeMetadataImage(input.image) || buildOgImageUrl(title, description);
  const metadata: Metadata = {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      type: input.type || 'website',
      locale: 'ru_RU',
      url: canonical,
      siteName: SITE_NAME,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };

  if (input.noIndex) {
    metadata.robots = {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    };
  }

  return metadata;
}
