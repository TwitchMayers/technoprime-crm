import { GlassCard } from '@technoprime/ui';

export function CtaSection() {
  return (
    <section id="contacts" className="mt-12">
      <GlassCard className="relative overflow-hidden p-5 sm:p-6 md:p-10">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="relative z-10 space-y-6">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Мы в социальных сетях</p>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">Мы всегда на связи</h2>
            <p className="text-sm text-slate-300 md:text-base">
              Получай актуальные новинки, скидки и поддержку через Telegram и VK. Ответим быстро и по делу.
            </p>
          </div>
          <div className="grid gap-3 pt-1 sm:grid-cols-2">
            <div className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-3">
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-100/90">Telegram</p>
              <a
                href="https://t.me/TechnoPrimeMarket"
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-sm font-semibold text-white hover:text-cyan-100"
              >
                @TechnoPrimeMarket
              </a>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-3">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-300">VK</p>
              <a
                href="https://vk.com/public236325005"
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-sm font-semibold text-white hover:text-cyan-100"
              >
                vk.com/public236325005
              </a>
            </div>
          </div>
        </div>
      </GlassCard>
    </section>
  );
}
