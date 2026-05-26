import { GlassCard, SectionTitle } from '@technoprime/ui';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Гарантия и сервис | TechnoPrime',
  description:
    'Условия гарантии TechnoPrime: проверка комплекта, диагностика, оформление обращения и поддержка по заказам.',
  path: '/warranty',
});

const RULES = [
  'Гарантия на устройства — до 12 месяцев (в зависимости от категории и комплектации).',
  'На проверку качества и комплекта при получении дается время до оплаты.',
  'При гарантийном случае оформляется заявка и проводится диагностика с уведомлением о ходе обращения.',
  'Неисправности из-за механических повреждений и нарушений условий эксплуатации не покрываются.',
];

const STEPS = [
  {
    title: '1. Заявка',
    text: 'Свяжитесь с нами и укажите номер заказа, описание проблемы и удобный канал связи.',
  },
  {
    title: '2. Диагностика',
    text: 'Проводим проверку устройства и фиксируем результаты в карточке заказа.',
  },
  {
    title: '3. Решение',
    text: 'Выполняем ремонт, замену или возврат по условиям и текущему статусу товара.',
  },
];

export default function WarrantyPage() {
  return (
    <div className="space-y-10">
      <SectionTitle
        eyebrow="Гарантия"
        title="Условия и порядок обращения"
        subtitle="Понятные правила без скрытых пунктов. Все этапы обращения прозрачны и отслеживаются менеджером."
      />

      <GlassCard className="p-6">
        <ul className="space-y-3 text-sm text-slate-200">
          {RULES.map((rule) => (
            <li key={rule} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              {rule}
            </li>
          ))}
        </ul>
      </GlassCard>

      <div className="grid gap-6 md:grid-cols-3">
        {STEPS.map((step) => (
          <GlassCard key={step.title} className="p-6">
            <h3 className="text-lg font-semibold text-white">{step.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{step.text}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
