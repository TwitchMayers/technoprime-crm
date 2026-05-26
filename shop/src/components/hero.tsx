import { Badge, Button, GlassCard } from '@technoprime/ui';
import { formatPrice } from '@technoprime/lib';
import Image from 'next/image';
import Link from 'next/link';
import { ConsultationDialog } from '@/components/consultation-dialog';

type HeroFreshDrop = {
  title: string;
  description: string;
  price: number;
  href: string;
  imageUrl?: string | null;
  imageAlt?: string;
};

export function Hero({ freshDrop }: { freshDrop: HeroFreshDrop }) {
  return (
    <section className="relative grid gap-4 lg:grid-cols-[1.04fr_0.96fr] lg:items-stretch lg:gap-6 2xl:gap-7" id="hero">
      <GlassCard className="space-y-5 p-4 sm:p-6 lg:flex lg:h-full lg:min-h-[560px] lg:flex-col lg:justify-between lg:space-y-0 lg:p-7 xl:min-h-[620px] xl:p-10">
        <div className="space-y-6">
          <div className="flex items-center">
            <Badge>TechnoPrime Store</Badge>
          </div>

          <div className="space-y-2.5">
            <h1 className="font-display text-[1.75rem] font-semibold leading-tight sm:text-4xl lg:text-[2.8rem] lg:leading-[1.05] xl:text-[3.35rem]">
              Готовые игровые решения для вас.
            </h1>
            <p className="text-sm leading-relaxed text-slate-300 sm:text-base lg:max-w-[58ch] lg:text-[1.05rem] xl:text-[1.12rem]">
              Продаём консоли, игры, аксессуары и подписки с актуальным наличием, честной ценой и поддержкой до и после покупки.
            </p>
          </div>

          <div className="grid gap-2.5 md:grid-cols-2 lg:max-w-[680px] xl:max-w-[740px]">
            <Link
              href="/catalog"
              className="w-full"
              data-analytics-click="hero_open_catalog"
              data-analytics-location="home_hero"
            >
              <Button size="lg" className="w-full justify-center">Открыть каталог</Button>
            </Link>
            <div className="hidden md:block">
              <ConsultationDialog variant="secondary" size="lg" className="w-full justify-center" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 md:hidden">
            <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-cyan-300/15 text-cyan-100">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                  <path d="M4 7h11l3 4v6a1 1 0 0 1-1 1h-1.5a2.5 2.5 0 1 1-5 0h-3a2.5 2.5 0 1 1-5 0H2a1 1 0 0 1-1-1V9a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="mt-1 text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-cyan-100">Доставка</p>
              <p className="mt-1 text-[11px] leading-tight text-slate-200">11:00–21:00</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-cyan-300/15 text-cyan-100">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                  <path d="M5 13.5V11a7 7 0 1 1 14 0v2.5M6.5 17.5h-.8A1.7 1.7 0 0 1 4 15.8v-.6c0-.9.8-1.7 1.7-1.7h.8c.9 0 1.7.8 1.7 1.7v.6c0 .9-.8 1.7-1.7 1.7Zm11 0h.8c.9 0 1.7-.8 1.7-1.7v-.6c0-.9-.8-1.7-1.7-1.7h-.8c-.9 0-1.7.8-1.7 1.7v.6c0 .9.8 1.7 1.7 1.7Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="mt-1 text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-cyan-100">Поддержка</p>
              <p className="mt-1 text-[11px] leading-tight text-slate-200">24/7</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-cyan-300/15 text-cyan-100">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                  <path d="M4 5.5h16a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H12l-4.5 3v-3H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="mt-1 text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-cyan-100">Ответ</p>
              <p className="mt-1 text-[11px] leading-tight text-slate-200">до 10 мин</p>
            </div>
          </div>
        </div>

        <div className="hidden gap-3 text-sm text-slate-300 md:grid md:grid-cols-3 lg:text-[15px] xl:gap-4 xl:text-base">
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 lg:px-5 lg:py-4 xl:px-6 xl:py-4">Доставка по Москве 11:00–21:00</div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 lg:px-5 lg:py-4 xl:px-6 xl:py-4">Поддержка 24/7</div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 lg:px-5 lg:py-4 xl:px-6 xl:py-4">Ответ менеджера до 10 минут</div>
        </div>
      </GlassCard>

      <div className="relative lg:h-full">
        <div className="absolute -right-9 top-8 h-52 w-52 rounded-full bg-cyan-500/20 blur-3xl" />
        <GlassCard className="relative flex h-full flex-col gap-4 p-4 sm:gap-5 sm:p-5 lg:min-h-[560px] lg:gap-6 lg:p-7 xl:min-h-[620px] xl:gap-7 xl:p-9">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-cyan-200 lg:text-[15px]">Новые поставки</p>
            <span className="text-[11px] uppercase tracking-[0.15em] text-slate-400 lg:text-xs">Подборка недели</span>
          </div>
          <div className="relative flex-1 overflow-hidden rounded-3xl border border-white/10 bg-black/20 min-h-[250px] sm:min-h-[300px] lg:min-h-[360px] xl:min-h-[430px]">
            {freshDrop.imageUrl ? (
              <Image
                src={freshDrop.imageUrl}
                alt={freshDrop.imageAlt || freshDrop.title}
                className="object-cover"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 42vw"
                quality={76}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/35 via-sky-500/25 to-blue-500/35" />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/72 via-slate-900/28 to-slate-900/8" />
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xl font-semibold text-white sm:text-2xl xl:text-[2rem]">{freshDrop.title}</p>
              <p className="text-sm leading-relaxed text-slate-200 sm:text-base">{freshDrop.description}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl font-semibold lg:text-[1.8rem]">
                {freshDrop.price > 0 ? formatPrice(freshDrop.price, 'RUB') : 'Цена по запросу'}
              </p>
              <Link
                href={freshDrop.href}
                data-analytics-click="hero_open_product"
                data-analytics-location="home_hero"
                data-analytics-product={freshDrop.title}
              >
                <Button size="sm" className="lg:min-h-11 lg:px-6 lg:text-base">Смотреть товар</Button>
              </Link>
            </div>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}
