'use client';

import { useState } from 'react';
import { Button } from '@technoprime/ui';
import { useCartStore } from '@/lib/cart-store';
import { trackEvent } from '@/lib/analytics';

type Props = {
  productId: number;
  name: string;
  slug?: string | null;
  variantKey?: string | null;
  variantLabel?: string | null;
  price: number;
  coverImage?: string | null;
  inStock?: boolean | null;
  className?: string;
};

export function AddToCartButton(props: Props) {
  const { addItem } = useCartStore();
  const [added, setAdded] = useState(false);

  return (
    <Button
      className={props.className}
      size="sm"
      onClick={() => {
        addItem(
          {
            productId: props.productId,
            variantKey: props.variantKey || null,
            variantLabel: props.variantLabel || null,
            name: props.name,
            slug: props.slug || null,
            price: props.price,
            coverImage: props.coverImage || null,
            inStock: props.inStock ?? null,
          },
          1,
        );
        trackEvent('add_to_cart', {
          product_id: props.productId,
          product_name: props.name,
          variant: props.variantLabel || props.variantKey || undefined,
          price: props.price,
        });
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
      disabled={props.inStock === false}
      data-analytics-click="add_to_cart"
      data-analytics-location="product_card"
      data-analytics-product={props.name}
    >
      {props.inStock === false ? 'Нет в наличии' : added ? 'Добавлено' : 'В корзину'}
    </Button>
  );
}
