import { GlassCard, SectionTitle } from '@technoprime/ui';
import { deliverySteps } from '@/data/catalog';

export function DeliverySection() {
  return (
    <section id="delivery" className="mt-20 space-y-10">
      <SectionTitle
        eyebrow="Доставка"
        title="Логистика без стресса"
        subtitle="Мы подтверждаем заказ за считанные минуты и доставляем в удобное окно."
      />
      <div className="grid gap-6 md:grid-cols-3">
        {deliverySteps.map((item, index) => (
          <GlassCard
            key={item.title}
            className="relative p-6"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <span className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">0{index + 1}</span>
            <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
            <p className="mt-3 text-sm text-slate-300">{item.text}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
