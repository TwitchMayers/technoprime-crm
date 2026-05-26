'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, GlassCard, SectionTitle } from '@technoprime/ui';
import { formatPrice } from '@technoprime/lib';
import { fetchMyOrder, type ShopOrder } from '@/lib/shop-api';

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatPaymentMethod(method: string) {
  const map: Record<string, string> = {
    CASH: 'Оплата при получении',
    TRANSFER: 'Перевод',
    TRADE_IN: 'Trade-in',
  };
  return map[method] || method;
}

function describePaymentFlow(order: ShopOrder) {
  if (order.paymentMethod === 'TRANSFER') {
    return 'Заказ ожидает оплаты переводом. Если страница закроется, вы сможете вернуться к ней из личного кабинета, пока действует бронь.';
  }
  if (order.paymentMethod === 'TRADE_IN') {
    return 'Заказ ожидает согласования трейд-ина. Бронь по товару активна ограниченное время, затем заказ будет автоматически отменён.';
  }
  return 'Заказ создан. Бронь по товару активна ограниченное время, затем заказ будет автоматически отменён, если подтверждение не завершено.';
}

export function CheckoutPaymentClient({ orderId }: { orderId: number }) {
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdownSec, setCountdownSec] = useState(0);

  useEffect(() => {
    if (!orderId || Number.isNaN(orderId)) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchMyOrder(orderId);
        setOrder(data);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [orderId]);

  useEffect(() => {
    if (!order?.reserveUntil) {
      setCountdownSec(0);
      return;
    }

    const tick = () => {
      const seconds = Math.max(
        0,
        Math.ceil((new Date(order.reserveUntil as string).getTime() - Date.now()) / 1000),
      );
      setCountdownSec(seconds);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [order?.reserveUntil]);

  const expired = useMemo(() => countdownSec <= 0, [countdownSec]);
  const canResume = Boolean(order?.canResumePayment && !expired);

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Заказ принят"
        title="Оплата и подтверждение заказа"
        subtitle="Бронь на товар уже создана. Если окно закроется, вы сможете вернуться к нему из личного кабинета."
      />

      {loading ? (
        <GlassCard className="p-8 text-sm text-slate-300">Загружаем заказ...</GlassCard>
      ) : !order ? (
        <GlassCard className="space-y-4 p-8">
          <p className="text-sm text-slate-300">Заказ не найден или доступ к нему уже истёк.</p>
          <Link href="/account">
            <Button>Перейти в личный кабинет</Button>
          </Link>
        </GlassCard>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <GlassCard className="space-y-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-cyan-200/70">Заказ</p>
                <p className="mt-2 text-3xl font-semibold text-white">#{order.id}</p>
              </div>
              {order.reserveUntil ? (
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/70">Бронь активна</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {expired ? '0:00' : formatCountdown(countdownSec)}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200">
              {order.status === 'COMPLETED' ? (
                <p>Заказ уже оплачен и подтверждён. Дальше его статус будет меняться в личном кабинете.</p>
              ) : order.status === 'CANCELED' ? (
                <p>
                  Заказ отменён
                  {order.cancellationReason ? ` (${order.cancellationReason})` : ''}.
                </p>
              ) : (
                <p>{describePaymentFlow(order)}</p>
              )}
            </div>

            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{item.product?.name || `Товар #${item.id}`}</p>
                      <p className="mt-1 text-sm text-slate-300">
                        {item.variantLabel ? `${item.variantLabel} • ` : ''}
                        Кол-во: {item.qty}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Серийный номер: {item.serialNumber || '—'}
                      </p>
                    </div>
                    <p className="text-base font-semibold text-cyan-200">
                      {formatPrice(Number(item.lineTotal || 0), 'RUB')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/account">
                <Button variant="secondary">В личный кабинет</Button>
              </Link>
              {canResume ? (
                <Link href={order.paymentUrl || `/checkout/payment?orderId=${order.id}`}>
                  <Button>Остаться на странице оплаты</Button>
                </Link>
              ) : null}
            </div>
          </GlassCard>

          <GlassCard className="space-y-5 p-6">
            <div>
              <p className="text-lg font-semibold text-white">Сводка</p>
              <p className="mt-2 text-sm text-slate-300">
                Статус: {order.paymentState === 'PAID' ? 'Оплачен' : order.paymentState === 'AWAITING_PAYMENT' ? 'Ожидает оплаты' : order.status}
              </p>
              <p className="mt-1 text-sm text-slate-300">Способ: {formatPaymentMethod(order.paymentMethod)}</p>
              <p className="mt-1 text-sm text-slate-300">
                Сумма: {formatPrice(Number(order.totalPrice || 0), 'RUB')}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
              <p className="text-sm font-semibold text-emerald-100">Рекомендуем привязать Telegram или VK</p>
              <p className="mt-2 text-sm text-slate-200">
                Так вы сможете быстрее получать статусы заказа, сообщения менеджера и уведомления по подпискам.
              </p>
              <div className="mt-3">
                <Link href="/account#linked-accounts">
                  <Button size="sm">Открыть привязки</Button>
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              <p>
                Если вы закрыли эту страницу, бронь и заказ останутся в личном кабинете до окончания таймера.
              </p>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
