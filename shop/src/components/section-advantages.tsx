import { GlassCard, SectionTitle } from '@technoprime/ui';
import { advantages } from '@/data/catalog';

export function AdvantagesSection() {
  return (
    <section id="advantages" className="mt-20 space-y-10">
      <SectionTitle
        eyebrow="Сервис"
        title="Мы строим не просто магазин, а сервис, которому доверяют"
        subtitle="Честные цены, проверка товара и персональная поддержка — ключевые ценности TechnoPrime."
      />
      <div className="grid gap-6 md:grid-cols-3">
        {advantages.map((item, index) => (
          <GlassCard
            key={item.title}
            className="p-6"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <h3 className="text-lg font-semibold text-white">{item.title}</h3>
            <p className="mt-3 text-sm text-slate-300">{item.description}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
