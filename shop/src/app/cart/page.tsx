'use client';

import Link from 'next/link';
import { Button, GlassCard, SectionTitle } from '@technoprime/ui';
import { formatPrice } from '@technoprime/lib';
import { useCartStore } from '@/lib/cart-store';

export default function CartPage() {
  const { items, totalAmount, totalQty, setQty, removeItem, clear } = useCartStore();

  return (
    <div className="space-y-10">
      <SectionTitle
        eyebrow="Корзина"
        title="Ваш заказ"
        subtitle="Измените количество, удалите лишнее и переходите к оформлению."
      />
      {items.length === 0 ? (
        <GlassCard className="p-8">
          <p className="text-sm text-slate-300">Корзина пока пуста. Добавьте товары из каталога.</p>
          <div className="mt-6">
            <Link href="/catalog">
              <Button>Перейти в каталог</Button>
            </Link>
          </div>
        </GlassCard>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <GlassCard className="space-y-4 p-6">
            {items.map((item) => (
              <div
                key={`${item.productId}:${item.variantKey || 'default'}`}
                className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_auto_auto_auto]"
              >
                <div>
                  <p className="font-semibold text-white">{item.name}</p>
                  {item.variantLabel ? (
                    <p className="text-xs text-cyan-200">{item.variantLabel}</p>
                  ) : null}
                  <p className="text-sm text-slate-400">{formatPrice(item.price, 'RUB')} за шт.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="h-8 w-8 rounded-lg border border-white/20"
                    onClick={() => setQty(item.productId, item.qty - 1, item.variantKey)}
                  >
                    -
                  </button>
                  <span className="w-8 text-center">{item.qty}</span>
                  <button
                    className="h-8 w-8 rounded-lg border border-white/20"
                    onClick={() => setQty(item.productId, item.qty + 1, item.variantKey)}
                  >
                    +
                  </button>
                </div>
                <div className="self-center font-semibold text-cyan-200">
                  {formatPrice(item.price * item.qty, 'RUB')}
                </div>
                <button
                  className="self-center text-sm text-rose-300 hover:text-rose-200"
                  onClick={() => removeItem(item.productId, item.variantKey)}
                >
                  Удалить
                </button>
              </div>
            ))}
          </GlassCard>
          <GlassCard className="h-fit space-y-4 p-6">
            <p className="text-lg font-semibold">Итого</p>
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Товаров</span>
              <span>{totalQty}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Сумма</span>
              <span className="text-base font-semibold text-white">{formatPrice(totalAmount, 'RUB')}</span>
            </div>
            <div className="space-y-2 pt-3">
              <Link href="/checkout" className="block">
                <Button className="w-full">Оформить заказ</Button>
              </Link>
              <button
                className="w-full rounded-xl border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
                onClick={clear}
              >
                Очистить корзину
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
