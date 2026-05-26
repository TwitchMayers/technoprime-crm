import { StorefrontLandingPage } from '@/components/storefront-landing-page';
import { fetchShopProducts } from '@/lib/shop-api';
import { buildPageMetadata } from '@/lib/seo';
import { getStorefrontLanding } from '@/lib/storefront-landings';

const config = getStorefrontLanding('ps4')!;

export const metadata = buildPageMetadata({
  title: config.seoTitle,
  description: config.seoDescription,
  path: '/ps4',
});

export default async function Ps4LandingPage() {
  const products = (await fetchShopProducts({ limit: 500 })).filter(config.match).slice(0, 12);
  return <StorefrontLandingPage config={config} products={products} />;
}
