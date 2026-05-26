'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, GlassCard, SectionTitle } from '@technoprime/ui';
import { formatPrice } from '@technoprime/lib';
import { useCartStore } from '@/lib/cart-store';
import { fetchAccountOverview, submitCheckout } from '@/lib/shop-api';
import { trackEvent } from '@/lib/analytics';

type PaymentMethod = 'CASH' | 'TRANSFER' | 'TRADE_IN';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalAmount, totalQty, clear } = useCartStore();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    city: 'Москва',
    address: '',
    comment: '',
    paymentMethod: 'CASH' as PaymentMethod,
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; orderId?: number } | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const overview = await fetchAccountOverview();
        if (!overview?.user) {
          setAuthorized(false);
          return;
        }
        setAuthorized(true);
        setForm((current) => ({
          ...current,
          name:
            [overview.user.firstName, overview.user.lastName].filter(Boolean).join(' ').trim() ||
            current.name,
          phone: overview.user.phone || current.phone,
          city: overview.user.deliveryCity || current.city,
          address: overview.user.deliveryAddress || current.address,
        }));
      } catch {
        setAuthorized(false);
      }
    };
    void run();
  }, []);

  const disabled = useMemo(
    () => !items.length || !form.phone || !form.address || submitting || authorized !== true,
    [items.length, form.phone, form.address, submitting, authorized],
  );

  const onSubmit = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const payload = {
        ...form,
        items: items.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          variantKey: item.variantKey || null,
        })),
      };
      const res = await submitCheckout(payload);
      if (res?.success) {
        trackEvent('form_submit', {
          form: 'checkout',
          payment_method: form.paymentMethod,
          order_id: res.orderId || undefined,
          total_amount: totalAmount,
        });
        trackEvent('go_to_payment', {
          payment_method: form.paymentMethod,
          order_id: res.orderId || undefined,
          total_amount: totalAmount,
        });
        clear();
        setResult({ ok: true, message: 'Заказ оформлен', orderId: res.orderId });
        router.push(res?.paymentUrl || `/checkout/payment?orderId=${res.orderId}`);
      } else {
        setResult({ ok: false, message: res?.message || 'Не удалось оформить заказ' });
      }
    } catch {
      setResult({ ok: false, message: 'Ошибка сети при оформлении' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-10">
      <SectionTitle
        eyebrow="Оформление"
        title="Подтверждение заказа"
        subtitle="После нажатия «Подтвердить заказ» бронь держится 15 минут. Менеджер свяжется с вами для подтверждения."
      />

      {items.length === 0 ? (
        <GlassCard className="p-8">
          <p className="text-sm text-slate-300">Корзина пуста. Сначала добавьте товары.</p>
          <div className="mt-6">
            <Link href="/catalog">
              <Button>В каталог</Button>
            </Link>
          </div>
        </GlassCard>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <GlassCard className="space-y-4 p-6">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
                placeholder="Имя"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              />
              <input
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
                placeholder="Телефон +7..."
                value={form.phone}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
                placeholder="Город"
                value={form.city}
                onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
              />
              <select
                className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
                value={form.paymentMethod}
                onChange={(e) => setForm((s) => ({ ...s, paymentMethod: e.target.value as PaymentMethod }))}
              >
                <option value="CASH">Оплата при получении</option>
                <option value="TRANSFER">Перевод</option>
                <option value="TRADE_IN">Трейд-ин</option>
              </select>
            </div>
            <textarea
              className="min-h-24 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
              placeholder="Адрес доставки"
              value={form.address}
              onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
            />
            <textarea
              className="min-h-20 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
              placeholder="Комментарий к заказу"
              value={form.comment}
              onChange={(e) => setForm((s) => ({ ...s, comment: e.target.value }))}
            />
            <Button
              className="w-full sm:w-auto"
              disabled={disabled}
              onClick={onSubmit}
              data-analytics-click="checkout_submit"
              data-analytics-location="checkout"
            >
              {submitting ? 'Оформляем...' : 'Подтвердить заказ'}
            </Button>
            {authorized === false ? (
              <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">
                Для оформления заказа нужно войти в аккаунт.
                <div className="mt-2">
                  <Link href="/account">
                    <Button size="sm" variant="secondary">Войти</Button>
                  </Link>
                </div>
              </div>
            ) : null}
            {result ? (
              <div
                className={`rounded-xl p-3 text-sm ${
                  result.ok
                    ? 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                    : 'border border-rose-400/40 bg-rose-500/10 text-rose-200'
                }`}
              >
                {result.message}
                {result.orderId ? ` #${result.orderId}` : ''}
              </div>
            ) : null}
          </GlassCard>

          <GlassCard className="h-fit space-y-4 p-6">
            <p className="text-lg font-semibold">Состав заказа</p>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={`${item.productId}:${item.variantKey || 'default'}`} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">
                    {item.name}
                    {item.variantLabel ? ` · ${item.variantLabel}` : ''}
                    {' '}× {item.qty}
                  </span>
                  <span className="text-white">{formatPrice(item.qty * item.price, 'RUB')}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 pt-3 text-sm">
              <div className="flex items-center justify-between text-slate-300">
                <span>Товаров</span>
                <span>{totalQty}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-base font-semibold text-white">
                <span>Итого</span>
                <span>{formatPrice(totalAmount, 'RUB')}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
