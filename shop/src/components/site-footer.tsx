import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="relative z-0 mt-6 border-t border-white/10 bg-black/20 px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+5.9rem)] text-sm text-slate-300 backdrop-blur-xl md:mt-20 md:px-8 md:py-12">
      <div className="mx-auto w-full max-w-7xl">
        <div className="space-y-3 md:hidden">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-base leading-none text-white">TechnoPrime Store</p>
          </div>
          <p className="text-[11px] leading-4 text-slate-400">
            Готовые игровые решения: консоли, игры, аксессуары и подписки с гарантией и поддержкой.
          </p>

          <div className="space-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Покупателям</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Link href="/delivery" className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200 hover:bg-white/[0.08]">
                  Доставка
                </Link>
                <Link href="/warranty" className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200 hover:bg-white/[0.08]">
                  Гарантия
                </Link>
                <Link href="/contacts" className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200 hover:bg-white/[0.08]">
                  Контакты
                </Link>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Инфо</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Link href="/about" className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200 hover:bg-white/[0.08]">
                  О компании
                </Link>
                <Link href="/promotions" className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200 hover:bg-white/[0.08]">
                  Акции
                </Link>
                <Link href="/legal/privacy" className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200 hover:bg-white/[0.08]">
                  Политика данных
                </Link>
                <Link href="/legal/cookies" className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200 hover:bg-white/[0.08]">
                  Cookies
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden gap-8 md:grid md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <p className="font-display text-xl text-white">TechnoPrime Store</p>
            <p className="max-w-xl text-slate-400">
              Готовые игровые решения: консоли, игры, аксессуары и подписки с честными ценами, гарантией и поддержкой.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-white">Покупателям</p>
            <Link href="/delivery" className="block hover:text-white">Доставка</Link>
            <Link href="/warranty" className="block hover:text-white">Гарантия</Link>
            <Link href="/contacts" className="block hover:text-white">Контакты</Link>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-white">Инфо</p>
            <Link href="/about" className="block hover:text-white">О компании</Link>
            <Link href="/promotions" className="block hover:text-white">Акции</Link>
            <Link href="/catalog" className="block hover:text-white">Каталог</Link>
            <Link href="/legal/privacy" className="block hover:text-white">Политика данных</Link>
            <Link href="/legal/cookies" className="block hover:text-white">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
