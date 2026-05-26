'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  CreditCard,
  CircleDollarSign,
  Gamepad2,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

type PriceRow = {
  label: string;
  price: number;
  note?: string;
};

type Variant = {
  id: string;
  name: string;
  summary: string;
  highlights?: string[];
  bundle: string[];
  prices: PriceRow[];
  addons?: PriceRow[];
  warnings?: string[];
};

type Family = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  variants: Variant[];
};

const families: Family[] = [
  {
    id: 'steam-deck',
    title: 'Steam Deck',
    subtitle: 'LCD / OLED',
    description:
      'Двухсистемный портативный комплект под ключ: для игр, работы и расширенной совместимости.',
    variants: [
      {
        id: 'steam-deck-lcd',
        name: 'Steam Deck LCD',
        summary:
          'Настроенный комплект под ключ: SteamOS + Windows, готов к выдаче и старту без дополнительной настройки.',
        highlights: [
          'Установлены две системы: родная SteamOS и Windows 11 от TechnoPrime.',
          'На Windows доступны игры, которые не запускаются в SteamOS (Anti-Cheat проекты и онлайн-шутеры).',
          'Клиент получает уже настроенное устройство с драйверами, утилитами контроля и готовым игровым профилем.',
        ],
        bundle: [
          'Steam Deck приставка.',
          'DualBoot образ TechnoPrime (SteamOS + Windows).',
          'Зарядный кабель.',
          'Кейс-переноска.',
          'Устройство подготовлено и проверено перед выдачей.',
        ],
        prices: [
          { label: '512 ГБ', price: 43990 },
          { label: '1024 ГБ', price: 46990 },
        ],
      },
      {
        id: 'steam-deck-oled',
        name: 'Steam Deck OLED',
        summary:
          'Флагманский комплект под ключ: готов к игре и работе сразу после покупки.',
        highlights: [
          'Две подготовленные системы: SteamOS для лицензий и Windows 11 TechnoPrime для расширенной совместимости.',
          'Полная преднастройка устройства: драйверы, сервисные утилиты и тест стабильности перед выдачей.',
          'Можно использовать как игровую консоль и как компактный рабочий компьютер.',
        ],
        bundle: [
          'Steam Deck приставка.',
          'DualBoot образ TechnoPrime (SteamOS + Windows).',
          'Зарядный кабель.',
          'Кейс-переноска.',
          'Устройство подготовлено и проверено перед выдачей.',
        ],
        prices: [
          { label: '512 ГБ', price: 54990 },
          { label: '1024 ГБ', price: 61990 },
        ],
      },
    ],
  },
  {
    id: 'playstation-45',
    title: 'PlayStation 4 / 5',
    subtitle: 'Семейство Sony',
    description:
      'Комплекты Sony с готовой настройкой, доставкой и подписочным сценарием «под ключ».',
    variants: [
      {
        id: 'ps4',
        name: 'PlayStation 4 FAT / Slim / Pro',
        summary:
          'Премиум-комплект под ключ для PS4-линейки.',
        bundle: [
          'Приставка PlayStation 4 (FAT / Slim / Pro по наличию).',
          '2 геймпада в комплекте.',
          'PS Plus Deluxe на 1 год (500+ игр).',
          'Комплект кабелей.',
        ],
        prices: [{ label: 'Цена по наличию', price: 0, note: 'Уточняется у администратора по текущему складу' }],
        warnings: [
          'Внутренняя подсказка менеджеру: если клиент спрашивает об оригинальности геймпадов, корректный ответ — «премиум копия, новые». Без прямого вопроса этот момент отдельно не акцентируем.',
        ],
      },
      {
        id: 'ps5-digital',
        name: 'PlayStation 5 (без дисковода)',
        summary:
          'Премиум-комплект под ключ с полной базовой подготовкой.',
        bundle: [
          'Приставка PlayStation 5.',
          '1 геймпад в комплекте.',
          'PS Plus Deluxe на 1 год (500+ игр).',
          'Комплект кабелей.',
        ],
        prices: [{ label: 'Базовый комплект', price: 43990 }],
        addons: [{ label: 'Второй геймпад (доп. аксессуар)', price: 5000 }],
      },
      {
        id: 'ps5-disc',
        name: 'PlayStation 5 (с дисководом)',
        summary:
          'Премиум-комплект под ключ с поддержкой дисковых и цифровых сценариев.',
        bundle: [
          'Приставка PlayStation 5.',
          '1 геймпад в комплекте.',
          'PS Plus Deluxe на 1 год (500+ игр).',
          'Комплект кабелей.',
        ],
        prices: [{ label: 'Базовый комплект', price: 46990 }],
        addons: [{ label: 'Второй геймпад (доп. аксессуар)', price: 5000 }],
      },
    ],
  },
  {
    id: 'playstation-portal',
    title: 'PlayStation Portal',
    subtitle: 'Портативный сценарий Sony',
    description:
      'Персональный облачный комплект для дистанционной игры в экосистеме PlayStation.',
    variants: [
      {
        id: 'ps-portal',
        name: 'PlayStation Portal',
        summary:
          'Премиум-комплект под ключ для удалённой игры в экосистеме PlayStation.',
        bundle: [
          'Приставка PlayStation Portal.',
          'Подписка на 1 месяц.',
          'Кабель в комплекте.',
          'Устройство подготовлено для быстрого старта.',
        ],
        prices: [{ label: 'Базовый комплект', price: 24990 }],
        addons: [
          { label: 'Продление подписки на 1 месяц', price: 2500 },
          { label: 'Продление подписки на 3 месяца', price: 7000 },
          { label: 'Продление подписки на 12 месяцев', price: 17000 },
        ],
      },
    ],
  },
  {
    id: 'nintendo-switch',
    title: 'Nintendo Switch',
    subtitle: 'OLED',
    description:
      'Nintendo-направление с готовой системой и подготовленной игровой средой.',
    variants: [
      {
        id: 'switch-oled',
        name: 'Nintendo Switch OLED',
        summary:
          'По Nintendo сейчас без уточнения состава комплекта: детали подтверждаем отдельно.',
        bundle: [
          'Комплект уточняется индивидуально по текущей поставке.',
        ],
        prices: [
          { label: '128 ГБ', price: 25990 },
          { label: '256 ГБ', price: 28990 },
          { label: '512 ГБ', price: 31990 },
        ],
      },
    ],
  },
  {
    id: 'oculus-quest',
    title: 'Oculus Quest',
    subtitle: 'VR',
    description:
      'VR-комплект с заранее подготовленным окружением и быстрым стартом «из коробки».',
    variants: [
      {
        id: 'quest-128',
        name: 'Oculus Quest 2',
        summary:
          'Премиум-комплект под ключ для VR.',
        bundle: [
          'Приставка Oculus Quest 2.',
          '2 джойстика.',
          'Зарядный кабель.',
        ],
        prices: [{ label: '128 ГБ', price: 22990 }],
      },
    ],
  },
  {
    id: 'xbox-one',
    title: 'Xbox One',
    subtitle: 'One S',
    description:
      'Готовый Xbox-комплект с персональным аккаунтом и онлайн-доступом.',
    variants: [
      {
        id: 'xbox-one-s',
        name: 'Xbox One S',
        summary:
          'Премиум-комплект под ключ для Xbox One.',
        bundle: [
          'Приставка Xbox One S.',
          '1 геймпад (оригинал).',
          'Подписка на 1 месяц.',
          'Комплект кабелей.',
        ],
        prices: [{ label: 'Базовый комплект', price: 21990 }],
      },
    ],
  },
  {
    id: 'xbox-series',
    title: 'Xbox Series',
    subtitle: 'Series S / Series X',
    description:
      'Актуальная Xbox-линейка с персональным аккаунтом, онлайн-режимом и сервисной подготовкой.',
    variants: [
      {
        id: 'xbox-series',
        name: 'Xbox Series',
        summary:
          'Премиум-комплект под ключ для Series S / Series X.',
        bundle: [
          'Приставка Xbox Series (S или X по комплектации).',
          '1 геймпад (оригинал).',
          'Подписка на 1 месяц.',
          'Комплект кабелей.',
        ],
        prices: [
          { label: 'Series S 512 ГБ', price: 25990 },
          { label: 'Series X', price: 46990 },
        ],
        addons: [{ label: 'Второй геймпад (доп. аксессуар)', price: 5000 }],
      },
    ],
  },
];

const steamDeckAccessories: PriceRow[] = [
  { label: 'Чехол силикон / пластик', price: 1000 },
  { label: 'Защитное стекло', price: 2000 },
  { label: 'Док-станция', price: 1500 },
  { label: 'Карта памяти 256 ГБ', price: 3000 },
  { label: 'Карта памяти 512 ГБ', price: 6000 },
];

function getDefaultHighlights(familyId: string) {
  switch (familyId) {
    case 'steam-deck':
      return [
        'Полная подготовка под ключ: устройство настроено и проверено перед выдачей.',
        'Готовый игровой сценарий для портативного использования сразу после покупки.',
        'Менеджер сопровождает запуск и помогает с базовой адаптацией под клиента.',
      ];
    case 'playstation-45':
    case 'playstation-portal':
      return [
        'Комплект под ключ с преднастройкой и готовностью к быстрой выдаче.',
        'Сценарий использования под подписку и онлайн-функции уже подготовлен.',
        'Проверка и контроль состояния перед продажей каждой консоли.',
      ];
    case 'xbox-one':
    case 'xbox-series':
      return [
        'Премиум-подготовка системы и геймпада перед выдачей.',
        'Комплект ориентирован на быстрый старт и стабильную онлайн-игру.',
        'Чёткая поддержка по запуску и продлению подписок после покупки.',
      ];
    case 'oculus-quest':
      return [
        'VR-комплект под ключ: базовая настройка и готовность к старту.',
        'Проверка контроллеров и ключевых функций перед передачей клиенту.',
        'Быстрый запуск сценария «достал и играешь» без лишних шагов.',
      ];
    case 'nintendo-switch':
      return [
        'Подготовка и проверка устройства перед выдачей.',
        'Актуальный комплект уточняется по поставке и согласуется с клиентом.',
        'Сохранён фокус на комфортном старте после покупки.',
      ];
    default:
      return [
        'Полная предпродажная проверка и настройка.',
        'Готовность к использованию в день покупки.',
        'Поддержка менеджера и инструкции после выдачи.',
      ];
  }
}

function money(value: number) {
  if (!value || value <= 0) return 'Уточняется';
  return `${value.toLocaleString('ru-RU')} ₽`;
}

export default function SalesMemoPage() {
  const [selectedFamilyId, setSelectedFamilyId] = useState(families[0].id);
  const selectedFamily = useMemo(
    () => families.find((item) => item.id === selectedFamilyId) || families[0],
    [selectedFamilyId],
  );

  const [selectedVariantId, setSelectedVariantId] = useState(selectedFamily.variants[0]?.id || '');
  useEffect(() => {
    setSelectedVariantId(selectedFamily.variants[0]?.id || '');
  }, [selectedFamily.id, selectedFamily.variants]);

  const selectedVariant = useMemo(
    () => selectedFamily.variants.find((item) => item.id === selectedVariantId) || selectedFamily.variants[0],
    [selectedFamily, selectedVariantId],
  );
  const premiumHighlights = useMemo(
    () =>
      selectedVariant?.highlights?.length
        ? selectedVariant.highlights
        : getDefaultHighlights(selectedFamily.id),
    [selectedFamily.id, selectedVariant?.highlights],
  );

  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'SUPER_ADMIN']}>
      <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:space-y-6 sm:pb-8">
        <section className="glass rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900 via-indigo-950/40 to-cyan-950/30 p-4 sm:rounded-3xl sm:p-7">
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-cyan-100 sm:text-xs sm:tracking-[0.16em]">
            <BookOpen className="h-4 w-4" />
            <span className="truncate">Памятка менеджера</span>
          </div>
          <h1 className="mt-3 text-xl font-bold leading-tight text-white sm:text-4xl">
            Комплекты под ключ и актуальные цены
          </h1>
          <p className="mt-2 max-w-4xl text-[13px] leading-5 text-slate-300 sm:text-base sm:leading-6">
            Страница для быстрых консультаций: выбор платформы, формат комплекта и стоимость по ключевым конфигурациям.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
            {[
              'Все приставки проходят 3 этапа проверки.',
              'Гарантия от магазина: 180 дней.',
              'Доставка по Старой Москве — бесплатно.',
              'Инструкции по платформе доступны клиенту в личном кабинете после покупки.',
            ].map((item) => (
              <div key={item} className="rounded-xl border border-slate-700/70 bg-slate-900/65 px-3 py-2.5 text-[13px] leading-5 text-slate-200 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
                <span className="inline-flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
                  <span>{item}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="-mx-2 flex snap-x gap-2 overflow-x-auto px-2 pb-1 scrollbar-hide sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 xl:grid-cols-4">
          {families.map((family) => {
            const isActive = family.id === selectedFamilyId;
            return (
              <button
                key={family.id}
                onClick={() => setSelectedFamilyId(family.id)}
                className={`w-[min(78vw,20rem)] shrink-0 snap-start rounded-2xl border p-3 text-left transition sm:w-auto sm:p-4 ${
                  isActive
                    ? 'border-cyan-400/50 bg-cyan-500/10 shadow-lg shadow-cyan-900/30'
                    : 'border-slate-700/70 bg-slate-900/55 hover:border-slate-500/70 hover:bg-slate-800/55'
                }`}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-white sm:text-lg">{family.title}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-cyan-200/90 sm:text-xs sm:tracking-[0.16em]">{family.subtitle}</div>
                  </div>
                  <Gamepad2 className={`h-5 w-5 ${isActive ? 'text-cyan-300' : 'text-slate-500'}`} />
                </div>
                <p className="mt-2 line-clamp-3 text-[13px] leading-5 text-slate-300 sm:mt-3 sm:text-sm">{family.description}</p>
              </button>
            );
          })}
        </section>

        <section className="glass rounded-2xl border border-slate-700/60 p-3 sm:rounded-3xl sm:p-6">
          <div className="flex flex-col gap-2 border-b border-slate-700/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.1em] text-cyan-200/90 sm:text-xs sm:tracking-[0.16em]">Выбрано семейство</div>
              <h2 className="text-xl font-bold text-white sm:text-2xl">{selectedFamily.title}</h2>
            </div>
            <div className="w-fit rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs font-semibold text-slate-300">
              {selectedFamily.variants.length} конфигурац.
            </div>
          </div>

          {selectedFamily.variants.length > 1 && (
            <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
              {selectedFamily.variants.map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-[13px] font-semibold transition sm:px-4 sm:text-sm ${
                    variant.id === selectedVariant?.id
                      ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100'
                      : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                  }`}
                  type="button"
                >
                  {variant.name}
                </button>
              ))}
            </div>
          )}

          {selectedVariant ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
              <article className="rounded-2xl border border-slate-700/70 bg-slate-900/65 p-3 sm:p-5">
                <h3 className="text-lg font-bold text-white sm:text-xl">{selectedVariant.name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{selectedVariant.summary}</p>

                <div className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-950/60 p-3 sm:p-4">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-cyan-200/90 sm:text-sm sm:tracking-[0.16em]">
                    Главные плюсы премиум / под ключ комплекта
                  </div>
                  <ul className="space-y-2 text-sm leading-6 text-slate-200">
                    {premiumHighlights.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-emerald-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-950/60 p-3 sm:mt-5 sm:p-4">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-cyan-200/90 sm:text-sm sm:tracking-[0.16em]">
                    Что входит в комплект под ключ
                  </div>
                  <ul className="space-y-2 text-sm leading-6 text-slate-200">
                    {selectedVariant.bundle.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-emerald-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {selectedVariant.warnings?.length ? (
                  <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
                      Внутренняя подсказка менеджеру
                    </div>
                    <ul className="space-y-2 text-sm leading-6 text-amber-100">
                      {selectedVariant.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>

              <aside className="order-first space-y-3 xl:order-none xl:space-y-4">
                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/65 p-3 sm:p-5">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-cyan-200/90 sm:text-sm sm:tracking-[0.16em]">
                    <CircleDollarSign className="h-4 w-4" />
                    Стоимость
                  </div>
                  <div className="space-y-2">
                    {selectedVariant.prices.map((priceRow) => (
                      <div key={priceRow.label} className="rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-2">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-100">{priceRow.label}</div>
                            {priceRow.note ? (
                              <div className="mt-1 text-xs text-slate-400">{priceRow.note}</div>
                            ) : null}
                          </div>
                          <div className="text-right text-base font-bold text-cyan-300">{money(priceRow.price)}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedVariant.addons && selectedVariant.addons.length > 0 ? (
                    <>
                      <div className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                        Дополнительно
                      </div>
                      <div className="mt-2 space-y-2">
                        {selectedVariant.addons.map((addon) => (
                          <div key={addon.label} className="rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-2">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                              <div className="min-w-0 text-sm text-slate-200">{addon.label}</div>
                              <div className="text-right text-sm font-bold text-emerald-300">{money(addon.price)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}

                  {selectedFamily.id === 'steam-deck' ? (
                    <>
                      <div className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                        Аксессуары к Steam Deck
                      </div>
                      <div className="mt-2 space-y-2">
                        {steamDeckAccessories.map((item) => (
                          <div key={item.label} className="rounded-xl border border-slate-700/60 bg-slate-950/60 px-3 py-2">
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                              <div className="min-w-0 text-sm text-slate-200">{item.label}</div>
                              <div className="text-right text-sm font-bold text-emerald-300">{money(item.price)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              </aside>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4">
            <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/90">
              <CreditCard className="h-4 w-4" />
              Продление подписок
            </div>
            <div className="space-y-2 text-sm text-slate-100">
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 px-3 py-2">
                <div className="font-medium">PS Plus Deluxe (Украина) — год</div>
                <div className="mt-1 text-emerald-300">{money(5000)}</div>
              </div>
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 px-3 py-2">
                <div className="font-medium">PS Plus Premium (Европа) для PS Portal</div>
                <div className="mt-1 text-emerald-300">
                  {money(2500)} / {money(7000)} / {money(17000)} (месяц / 3 месяца / год)
                </div>
              </div>
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 px-3 py-2">
                <div className="font-medium">Xbox Ultimate Game Pass</div>
                <div className="mt-1 text-emerald-300">
                  {money(2500)} / {money(13000)} (месяц / год)
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4">
            <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/90">
              <Truck className="h-4 w-4" />
              Доставка
            </div>
            <ul className="space-y-2 text-sm leading-6 text-slate-200">
              <li>Avito-доставка доступна для каждого комплекта.</li>
              <li>По Старой Москве — бесплатная доставка силами магазина.</li>
              <li>В ближайшую область — от 2 000 ₽, итог зависит от адреса.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4">
            <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/90">
              <ShieldCheck className="h-4 w-4" />
              Гарантия и состояние
            </div>
            <ul className="space-y-2 text-sm leading-6 text-slate-200">
              <li>Все приставки — б/у в отличном состоянии.</li>
              <li>Перед продажей выполняется трехэтапная техническая проверка.</li>
              <li>Гарантия магазина — 180 дней.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4">
            <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/90">
              <BookOpen className="h-4 w-4" />
              Инструкции для клиента
            </div>
            <ul className="space-y-2 text-sm leading-6 text-slate-200">
              <li>После покупки клиенту открывается доступ к инструкциям только по купленной платформе.</li>
              <li>Инструкции отображаются в личном кабинете клиента автоматически.</li>
              <li>Менеджер подтверждает клиенту наличие инструкции сразу при продаже.</li>
            </ul>
          </div>
        </section>
      </div>
    </ProtectedRoute>
  );
}
