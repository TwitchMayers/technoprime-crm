import { GlassCard, SectionTitle } from '@technoprime/ui';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'О магазине TechnoPrime',
  description:
    'Узнайте, как работает TechnoPrime: проверка техники, прозрачные цены и поддержка после покупки.',
  path: '/about',
});

const PRINCIPLES = [
  {
    title: 'Проверка перед оплатой',
    text: 'Каждая позиция проходит проверку комплекта и состояния до передачи клиенту.',
  },
  {
    title: 'Прозрачная цена',
    text: 'Цена в карточке и в заказе совпадает. Перед оплатой показываем итог без скрытых доплат.',
  },
  {
    title: 'Сервис 24/7',
    text: 'Поддержка отвечает по заказам, доставке и гарантии в удобных каналах связи.',
  },
];

const MILESTONES = [
  {
    year: '2024',
    title: 'Запуск TechnoPrime',
    text: 'Сфокусировались на игровых консолях и комплектах с честной проверкой.',
  },
  {
    year: '2025',
    title: 'Расширение каталога и сервиса',
    text: 'Запустили личный кабинет, удобную доставку и регулярные акции для постоянных клиентов.',
  },
  {
    year: '2026',
    title: 'Персональные рекомендации',
    text: 'Развиваем точный подбор комплектов и обновляем ассортимент под реальный спрос покупателей.',
  },
];

export default function AboutPage() {
  return (
    <div className="space-y-10">
      <SectionTitle
        eyebrow="О компании"
        title="TechnoPrime"
        subtitle="Мы развиваем магазин игровой техники с быстрой обработкой заказов, честной консультацией и сопровождением до получения."
      />

      <div className="grid gap-6 md:grid-cols-3">
        {PRINCIPLES.map((item) => (
          <GlassCard key={item.title} className="p-6">
            <h3 className="text-lg font-semibold text-white">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{item.text}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold text-white">Как мы развиваемся</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {MILESTONES.map((item) => (
            <div key={item.year + item.title} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/80">{item.year}</p>
              <p className="mt-2 font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-sm text-slate-300">{item.text}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
