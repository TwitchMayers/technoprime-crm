import { GlassCard, SectionTitle } from '@technoprime/ui';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Доставка игровых приставок | TechnoPrime',
  description:
    'Условия доставки TechnoPrime по Москве и РФ: подтверждение заказа, сроки, отправка и сопровождение статусов.',
  path: '/delivery',
});

const STEPS = [
  {
    title: 'Подтверждение заказа',
    text: 'Менеджер подтверждает заказ и наличие в течение 10 минут в рабочее время.',
  },
  {
    title: 'Доставка по Москве',
    text: 'Работаем в окне 11:00–21:00. Возможна экспресс-доставка в день заказа.',
  },
  {
    title: 'Отгрузка по РФ',
    text: 'Отправляем через транспортные службы с трек-номером и уведомлением в Telegram.',
  },
];

export default function DeliveryPage() {
  return (
    <div className="space-y-10">
      <SectionTitle
        eyebrow="Доставка"
        title="Логистика и сроки"
        subtitle="Прозрачные условия, контроль статусов и уведомления клиенту на каждом этапе."
      />
      <div className="grid gap-6 md:grid-cols-3">
        {STEPS.map((step, idx) => (
          <GlassCard key={step.title} className="p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/80">0{idx + 1}</p>
            <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{step.text}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
