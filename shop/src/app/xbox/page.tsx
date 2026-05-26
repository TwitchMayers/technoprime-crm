import { StorefrontLandingPage } from '@/components/storefront-landing-page';
import { fetchShopProducts } from '@/lib/shop-api';
import { buildPageMetadata } from '@/lib/seo';
import { getStorefrontLanding } from '@/lib/storefront-landings';

const config = getStorefrontLanding('xbox')!;

export const metadata = buildPageMetadata({
  title: config.seoTitle,
  description: config.seoDescription,
  path: '/xbox',
});

export default async function XboxLandingPage() {
  const products = (await fetchShopProducts({ limit: 500 })).filter(config.match).slice(0, 12);
  return <StorefrontLandingPage config={config} products={products} />;
}
