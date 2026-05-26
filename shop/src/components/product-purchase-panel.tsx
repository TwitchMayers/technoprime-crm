'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@technoprime/ui';
import { formatPrice } from '@technoprime/lib';
import { AddToCartButton } from '@/components/add-to-cart-button';
import { LeaveRequestButton } from '@/components/leave-request-button';
import { ProductDetailTabs } from '@/components/product-detail-tabs';
import { PromoCountdown } from '@/components/promo-countdown';

type ProductVariant = {
  key: string;
  label: string;
  memoryGb?: number | null;
  price: number;
  originalPrice?: number | null;
  promoPrice?: number | null;
  promoOldPrice?: number | null;
  promoEndsAt?: string | null;
  promoRemainingSec?: number;
  isPromo?: boolean;
  stock?: number;
  inStock?: boolean;
  isDefault?: boolean;
};

type ProductPurchasePanelProps = {
  productId: number;
  slug?: string | null;
  name: string;
  coverImage?: string | null;
  basePrice: number;
  baseOriginalPrice?: number | null;
  baseIsPromo?: boolean;
  basePromoRemainingSec?: number;
  baseInStock: boolean;
  metaText: string;
  bundle: string;
  specs: string[];
  variants?: ProductVariant[] | null;
};

function normalizeVariants(input?: ProductVariant[] | null) {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input
    .map((row) => {
      const key = String(row?.key || '')
        .trim()
        .toLowerCase();
      if (!key || seen.has(key)) return null;
      const label = String(row?.label || key).trim();
      const price = Number(row?.price || 0);
      if (!label || !Number.isFinite(price) || price < 0) return null;
      const originalPriceRaw = Number(row?.promoOldPrice ?? row?.originalPrice ?? NaN);
      const originalPrice =
        Number.isFinite(originalPriceRaw) && originalPriceRaw > price ? originalPriceRaw : null;

      const memoryGbRaw = Number(row?.memoryGb ?? NaN);
      const memoryGb =
        Number.isFinite(memoryGbRaw) && memoryGbRaw > 0 ? Math.round(memoryGbRaw) : null;
      const stock = Math.max(0, Math.floor(Number(row?.stock ?? 0)));
      const inStock = row?.inStock !== undefined ? Boolean(row.inStock) : stock > 0;
      const isDefault = Boolean(row?.isDefault);

      seen.add(key);
      return {
        key,
        label,
        memoryGb,
        price,
        originalPrice,
        promoPrice:
          row?.promoPrice !== undefined && Number.isFinite(Number(row?.promoPrice))
            ? Number(row?.promoPrice)
            : null,
        promoOldPrice:
          row?.promoOldPrice !== undefined && Number.isFinite(Number(row?.promoOldPrice))
            ? Number(row?.promoOldPrice)
            : originalPrice,
        promoEndsAt: row?.promoEndsAt ? String(row.promoEndsAt) : null,
        promoRemainingSec: Math.max(0, Number(row?.promoRemainingSec || 0)),
        isPromo: Boolean(row?.isPromo),
        stock,
        inStock,
        isDefault,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export function ProductPurchasePanel({
  productId,
  slug,
  name,
  coverImage,
  basePrice,
  baseOriginalPrice,
  baseIsPromo,
  basePromoRemainingSec,
  baseInStock,
  metaText,
  bundle,
  specs,
  variants,
}: ProductPurchasePanelProps) {
  const preparedVariants = useMemo(() => normalizeVariants(variants), [variants]);
  const defaultVariantIndex = useMemo(() => {
    if (!preparedVariants.length) return -1;
    const explicitDefault = preparedVariants.findIndex((variant) => variant.isDefault);
    if (explicitDefault >= 0) return explicitDefault;
    return 0;
  }, [preparedVariants]);

  const [variantIndex, setVariantIndex] = useState(defaultVariantIndex);
  const activeVariant =
    preparedVariants.length > 0 && variantIndex >= 0 ? preparedVariants[variantIndex] : null;

  const currentPrice = activeVariant ? Number(activeVariant.price || 0) : Number(basePrice || 0);
  const currentOriginalPrice = activeVariant
    ? Number(activeVariant.originalPrice || 0) || null
    : Number(baseOriginalPrice || 0) || null;
  const currentInStock = activeVariant ? Boolean(activeVariant.inStock) : Boolean(baseInStock);
  const currentIsPromo = activeVariant ? Boolean(activeVariant.isPromo) : Boolean(baseIsPromo);
  const currentPromoRemainingSec = activeVariant
    ? Number(activeVariant.promoRemainingSec || 0)
    : Number(basePromoRemainingSec || 0);
  const variantLabel = activeVariant?.label || null;
  const variantKey = activeVariant?.key || null;

  const preparedSpecs = useMemo(() => {
    const cleaned = specs.filter((item) => !/^объём памяти:/i.test(item));
    if (activeVariant?.memoryGb) {
      return [`Объём памяти: ${activeVariant.memoryGb} ГБ`, ...cleaned];
    }
    return cleaned;
  }, [specs, activeVariant?.memoryGb]);

  const availabilityLabel = currentInStock ? 'В наличии' : 'Под заказ';
  const availabilityClass = currentInStock
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
    : 'bg-amber-500/15 text-amber-300 border-amber-400/40';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h3 className="text-2xl font-semibold">{name}</h3>
          <p className="text-sm text-slate-300">{metaText}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {currentIsPromo ? (
            <span className="shrink-0 rounded-full border border-orange-300/50 bg-orange-400/15 px-3 py-1 text-sm font-semibold text-orange-100">
              Акция
            </span>
          ) : null}
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-sm font-semibold ${availabilityClass}`}
          >
            {availabilityLabel}
          </span>
        </div>
      </div>

      {preparedVariants.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/90">
            Конфигурация
          </div>
          <div className="flex flex-wrap gap-2">
            {preparedVariants.map((variant, index) => (
              <button
                key={variant.key}
                type="button"
                onClick={() => setVariantIndex(index)}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  index === variantIndex
                    ? 'border-cyan-300/80 bg-cyan-400/20 text-cyan-100'
                    : 'border-white/15 bg-black/20 text-slate-200 hover:border-cyan-300/40'
                }`}
              >
                <span>{variant.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <ProductDetailTabs bundle={bundle} specs={preparedSpecs} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {currentInStock ? (
            <>
              <AddToCartButton
                productId={productId}
                slug={slug}
                name={name}
                variantKey={variantKey}
                variantLabel={variantLabel}
                price={currentPrice}
                coverImage={coverImage || null}
                inStock={currentInStock}
                className="bg-gradient-to-r from-cyan-500 via-blue-500 to-sky-600 text-white shadow-lg shadow-cyan-500/30 hover:brightness-110"
              />
              <Link
                href="/checkout"
                data-analytics-click="open_checkout"
                data-analytics-location="product_page"
                data-analytics-product={name}
              >
                <Button
                  variant="secondary"
                  className="border-cyan-300/50 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/25"
                >
                  Перейти к оформлению
                </Button>
              </Link>
            </>
          ) : (
            <LeaveRequestButton
              productId={productId}
              productName={variantLabel ? `${name} (${variantLabel})` : name}
              analyticsLocation="product_page"
              className="bg-gradient-to-r from-cyan-500 via-blue-500 to-sky-600 border-transparent text-white shadow-lg shadow-cyan-500/30 hover:brightness-110"
            />
          )}
        </div>
        <div className="space-y-1 text-right">
          {currentIsPromo && currentOriginalPrice && currentOriginalPrice > currentPrice ? (
            <p className="text-sm text-slate-400 line-through">
              {formatPrice(currentOriginalPrice, 'RUB')}
            </p>
          ) : null}
          <p className="text-3xl font-semibold text-cyan-200">{formatPrice(currentPrice, 'RUB')}</p>
          {currentIsPromo ? (
            <PromoCountdown
              initialSeconds={currentPromoRemainingSec}
              className="block text-xs text-cyan-200/80"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
