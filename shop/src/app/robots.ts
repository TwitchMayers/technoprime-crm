import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://technoprimestore.ru/sitemap.xml',
    host: 'https://technoprimestore.ru',
  };
}
