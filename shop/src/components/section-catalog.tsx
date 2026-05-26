import { SectionTitle } from '@technoprime/ui';
import { ProductCard } from '@/components/product-card';
import { MobileCatalogCarousel } from '@/components/mobile-catalog-carousel';

export type CatalogProduct = {
  id: number;
  slug?: string | null;
  name: string;
  price: number;
  originalPrice?: number | null;
  badge?: string;
  meta?: string;
  coverImage?: string | null;
  previewImage?: string | null;
  inStock?: boolean | null;
  isPromo?: boolean;
  promoRemainingSec?: number;
  variantKey?: string | null;
  variantLabel?: string | null;
};

export function CatalogSection({ products }: { products: CatalogProduct[] }) {
  const feed = products.slice(0, 3);
  const columnsClass =
    feed.length === 1
      ? 'md:grid-cols-1 max-w-3xl'
      : feed.length === 2
        ? 'md:grid-cols-2 max-w-5xl'
        : 'md:grid-cols-3';

  return (
    <section id="catalog" className="mt-12 space-y-6 md:space-y-8">
      <SectionTitle
        eyebrow="Каталог"
        title="Популярные позиции прямо сейчас"
        subtitle="Если сомневаетесь, начните с того, что выбирают чаще всего."
      />
      <MobileCatalogCarousel products={feed} />

      <div className={`mx-auto hidden gap-6 md:grid ${columnsClass}`}>
        {feed.map((product) => (
          <ProductCard key={product.id} {...product} />
        ))}
      </div>
    </section>
  );
}
