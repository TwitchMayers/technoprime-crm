import { GlassCard, SectionTitle } from '@technoprime/ui';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Контакты TechnoPrime',
  description:
    'Контакты TechnoPrime: телефон, Telegram, график работы и информация по заказам, доставке и сервису.',
  path: '/contacts',
});

const CONTACTS = [
  {
    title: 'Телефон',
    value: '+7 (000) 000-00-00',
    hint: 'Основной канал для заказов и сервиса',
  },
  {
    title: 'Telegram',
    value: '@technoprime',
    hint: 'Оперативные ответы и уведомления по заказам',
  },
  {
    title: 'График',
    value: 'Ежедневно 11:00-21:00',
    hint: 'Поддержка и доставка по Москве',
  },
];

export default function ContactsPage() {
  return (
    <div className="space-y-10">
      <SectionTitle
        eyebrow="Контакты"
        title="Свяжитесь с TechnoPrime"
        subtitle="Оставьте заявку по удобному каналу: поможем с выбором, заказом, доставкой и сервисом."
      />

      <div className="grid gap-6 md:grid-cols-3">
        {CONTACTS.map((item) => (
          <GlassCard key={item.title} className="p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">{item.title}</p>
            <p className="mt-3 text-xl font-semibold text-white">{item.value}</p>
            <p className="mt-2 text-sm text-slate-300">{item.hint}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold text-white">Где нас найти</h3>
        <p className="mt-2 text-sm text-slate-300">
          Москва. Точный адрес пункта выдачи и время доставки подтверждает менеджер после оформления.
        </p>
        <div className="mt-4 h-56 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-transparent" />
      </GlassCard>
    </div>
  );
}
