import { CheckoutPaymentClient } from './CheckoutPaymentClient';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Оплата заказа | TechnoPrime',
  description:
    'Страница оплаты заказа TechnoPrime: таймер брони, состав заказа и возврат к оплате из личного кабинета.',
  path: '/checkout/payment',
  noIndex: true,
});

export default async function CheckoutPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const params = await searchParams;
  const orderId = Number(params?.orderId || 0);
  return <CheckoutPaymentClient orderId={orderId} />;
}
