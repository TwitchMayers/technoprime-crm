import { StorefrontLandingPage } from '@/components/storefront-landing-page';
import { fetchShopProducts } from '@/lib/shop-api';
import { buildPageMetadata } from '@/lib/seo';
import { getStorefrontLanding } from '@/lib/storefront-landings';

const config = getStorefrontLanding('ps-portal')!;

export const metadata = buildPageMetadata({
  title: config.seoTitle,
  description: config.seoDescription,
  path: '/ps-portal',
});

export default async function PsPortalLandingPage() {
  const products = (await fetchShopProducts({ limit: 500 })).filter(config.match).slice(0, 12);
  return <StorefrontLandingPage config={config} products={products} />;
}
