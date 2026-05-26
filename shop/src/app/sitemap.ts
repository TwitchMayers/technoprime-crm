import type { MetadataRoute } from 'next';
import { fetchShopProducts } from '@/lib/shop-api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://technoprimestore.ru';
  const staticRoutes: MetadataRoute.Sitemap = [
    '/',
    '/catalog',
    '/ps4',
    '/ps5',
    '/xbox',
    '/steam-deck',
    '/ps-portal',
    '/promotions',
    '/delivery',
    '/warranty',
    '/contacts',
    '/about',
    '/legal/cookies',
    '/legal/privacy',
  ].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: 'daily',
    priority: path === '/' ? 1 : 0.7,
    lastModified: new Date(),
  }));

  const products = await fetchShopProducts({ limit: 500 });
  const productRoutes: MetadataRoute.Sitemap = products
    .filter((p) => p.slug)
    .map((p) => ({
      url: `${base}/product/${p.slug}`,
      changeFrequency: 'daily',
      priority: 0.8,
      lastModified: new Date(),
    }));

  return [...staticRoutes, ...productRoutes];
}
