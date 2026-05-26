import { Badge, Button, GlassCard } from '@technoprime/ui';
import { formatPrice } from '@technoprime/lib';
import Image from 'next/image';
import Link from 'next/link';
import { AddToCartButton } from '@/components/add-to-cart-button';
import { LeaveRequestButton } from '@/components/leave-request-button';
import { PromoCountdown } from '@/components/promo-countdown';

export function ProductCard({
  id,
  name,
  slug,
  price,
  originalPrice,
  badge,
  meta,
  summary,
  coverImage,
  previewImage,
  inStock,
  isPromo,
  promoRemainingSec,
  variantKey,
  variantLabel,
}: {
  id: number;
  name: string;
  slug?: string | null;
  price: number;
  originalPrice?: number | null;
  badge?: string;
  meta?: string;
  summary?: string | null;
  coverImage?: string | null;
  previewImage?: string | null;
  inStock?: boolean | null;
  isPromo?: boolean;
  promoRemainingSec?: number;
  variantKey?: string | null;
  variantLabel?: string | null;
}) {
  const imageForPreview = previewImage || coverImage || null;
  const normalizedBundle = String(summary || '')
    .replace(/^комплект:\s*/i, '')
    .trim();
  const bundleItems = normalizedBundle
    ? normalizedBundle
        .split(/\r?\n|[;,]/g)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  return (
    <GlassCard className="flex h-full flex-col overflow-hidden border-cyan-200/20">
      <div className="relative h-44 border-b border-white/10 bg-gradient-to-br from-white/10 to-white/5">
        <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
          {isPromo ? <Badge>Акция</Badge> : null}
          {badge ? <Badge>{badge}</Badge> : null}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-16 bg-gradient-to-b from-black/45 to-transparent" />
        <Link
          href={slug ? `/product/${slug}` : `/product/${id}`}
          className="group flex h-full w-full items-center justify-center"
          data-analytics-click="open_product_card"
          data-analytics-location="catalog_card"
          data-analytics-product={name}
        >
          {imageForPreview ? (
            <Image
              src={imageForPreview}
              alt={name}
              className="bg-slate-950/40 object-cover object-center transition duration-300 group-hover:scale-[1.03]"
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              quality={74}
            />
          ) : (
            <div className="h-16 w-32 rounded-full bg-gradient-to-r from-cyan-400/60 to-blue-500/40 blur-xl transition group-hover:scale-110" />
          )}
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="space-y-2">
          <h3 className="min-h-[3.25rem] text-lg font-semibold leading-6 text-white">{name}</h3>
          {meta ? <p className="text-xs text-slate-400">{meta}</p> : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/90">
            Комплект
          </div>
          {bundleItems.length ? (
            <ul className="mt-2 min-h-[2.5rem] space-y-1 text-sm text-slate-200/90">
              {bundleItems.slice(0, 4).map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 text-xs text-slate-400">Комплектация уточняется менеджером</div>
          )}
        </div>

        <div className="mt-auto space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              href={slug ? `/product/${slug}` : `/product/${id}`}
              className="w-full"
              data-analytics-click="open_product_details"
              data-analytics-location="catalog_card"
              data-analytics-product={name}
            >
              <Button variant="secondary" size="sm" className="w-full justify-center">
                Подробнее
              </Button>
            </Link>
            {inStock ? (
              <AddToCartButton
                productId={id}
                slug={slug}
                name={name}
                variantKey={variantKey}
                variantLabel={variantLabel}
                price={price}
                coverImage={coverImage || null}
                inStock={inStock}
                className="w-full justify-center"
              />
            ) : (
              <LeaveRequestButton
                productId={id}
                productName={variantLabel ? `${name} (${variantLabel})` : name}
                analyticsLocation="catalog_card"
                className="w-full justify-center"
              />
            )}
          </div>
          <div className="space-y-1">
            {isPromo && originalPrice && originalPrice > price ? (
              <p className="text-sm text-slate-400 line-through">{formatPrice(originalPrice, 'RUB')}</p>
            ) : null}
            <p className="text-2xl font-semibold text-white">{formatPrice(price, 'RUB')}</p>
            {isPromo ? (
              <PromoCountdown
                initialSeconds={promoRemainingSec}
                className="block text-xs text-cyan-200/85"
              />
            ) : null}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
