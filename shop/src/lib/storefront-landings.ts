import type { ShopProduct } from '@/lib/shop-api';

export type StorefrontLandingConfig = {
  slug: 'ps4' | 'ps5' | 'xbox' | 'steam-deck' | 'ps-portal';
  title: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  heroEyebrow: string;
  intro: string;
  catalogHref: string;
  whyUs: Array<{ title: string; text: string }>;
  faq: Array<{ question: string; answer: string }>;
  match: (product: ShopProduct) => boolean;
};

function contains(product: ShopProduct, tokens: string[]) {
  const haystack = [product.name, product.brand, product.model, product.version]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return tokens.every((token) => haystack.includes(token.toLowerCase()));
}

export const STOREFRONT_LANDINGS: Record<StorefrontLandingConfig['slug'], StorefrontLandingConfig> = {
  ps4: {
    slug: 'ps4',
    title: 'PlayStation 4: готовые решения и проверенные комплекты',
    description:
      'Подборка PlayStation 4 FAT, Slim и Pro: готовые к игре комплекты, проверка состояния, гарантия и честная цена.',
    seoTitle: 'PlayStation 4 купить в Москве | PS4 FAT, Slim, Pro | TechnoPrime',
    seoDescription:
      'Купить PlayStation 4 в Москве: PS4 FAT, Slim и Pro, готовые комплекты, проверка состояния, гарантия и быстрая доставка.',
    heroEyebrow: 'Landing page / PS4',
    intro:
      'PS4 остается сильным выбором для тех, кто хочет большую библиотеку игр и готовое решение без лишних переплат. Мы собираем комплекты под ключ и заранее проверяем каждую приставку перед продажей.',
    catalogHref: '/catalog?main=home-consoles&sub=playstation&family=ps4',
    whyUs: [
      {
        title: 'Готово к игре',
        text: 'Комплекты собираются так, чтобы клиент мог подключить приставку и начать играть без дополнительных покупок.',
      },
      {
        title: 'Проверка перед выдачей',
        text: 'Перед продажей проверяем работоспособность, комплект и общее состояние приставки.',
      },
      {
        title: 'Поддержка после покупки',
        text: 'В личном кабинете остаются заказы, статусы и связь с менеджером по подпискам и сервису.',
      },
    ],
    faq: [
      {
        question: 'Какие версии PS4 есть в наличии?',
        answer: 'На витрине TechnoPrime доступны PS4 FAT, Slim и Pro в зависимости от текущего наличия.',
      },
      {
        question: 'Можно ли купить PS4 уже с подпиской?',
        answer: 'Да, часть комплектов собирается под ключ: с подпиской, аксессуарами и готовой настройкой.',
      },
      {
        question: 'Есть ли гарантия на PS4?',
        answer: 'Да, условия гарантии указываются в карточке товара и подтверждаются менеджером при заказе.',
      },
    ],
    match: (product) => product.catalogFamilyKey === 'ps4' || contains(product, ['playstation 4']),
  },
  ps5: {
    slug: 'ps5',
    title: 'PlayStation 5: Digital и Blu-Ray версии',
    description:
      'Подборка PlayStation 5 FAT и Slim: Digital и Blu-Ray версии, проверенные комплекты и честная цена.',
    seoTitle: 'PlayStation 5 купить в Москве | PS5 Slim и FAT | TechnoPrime',
    seoDescription:
      'Купить PlayStation 5 в Москве: PS5 Slim и FAT, Digital и Blu-Ray версии, гарантия, проверка и доставка.',
    heroEyebrow: 'Landing page / PS5',
    intro:
      'Страница для рекламного и поискового трафика по PlayStation 5. Здесь собраны актуальные модели, понятные версии и карточки с готовыми комплектами.',
    catalogHref: '/catalog?main=home-consoles&sub=playstation&family=ps5',
    whyUs: [
      {
        title: 'Понятные версии',
        text: 'Разделяем Digital и Blu-Ray версии, чтобы клиенту было проще выбрать нужную конфигурацию.',
      },
      {
        title: 'Комплекты под задачу',
        text: 'Можно выбрать базовую приставку или решение под ключ с дополнительными аксессуарами и сервисами.',
      },
      {
        title: 'Актуальное наличие',
        text: 'Цены и доступность синхронизируются с CRM и складом без ручных расхождений.',
      },
    ],
    faq: [
      {
        question: 'Чем отличается PS5 Digital от Blu-Ray?',
        answer: 'Digital работает без дисковода, Blu-Ray позволяет запускать диски и использовать физические издания игр.',
      },
      {
        question: 'Есть ли Slim версии?',
        answer: 'Да, на странице показываются актуальные карточки PS5 Slim и другие доступные версии.',
      },
      {
        question: 'Можно ли оформить бронь онлайн?',
        answer: 'Да, после оформления заказа товар резервируется на ограниченное время, а оплату можно завершить позже из личного кабинета.',
      },
    ],
    match: (product) => product.catalogFamilyKey === 'ps5' || contains(product, ['playstation 5']),
  },
  xbox: {
    slug: 'xbox',
    title: 'Xbox: One, Series S и Series X',
    description:
      'Подборка Xbox One и Xbox Series: актуальные модели, проверенные приставки и готовые игровые комплекты.',
    seoTitle: 'Xbox купить в Москве | Series S, Series X, Xbox One | TechnoPrime',
    seoDescription:
      'Купить Xbox в Москве: Xbox One, Series S и Series X, готовые комплекты, проверка перед продажей и гарантия.',
    heroEyebrow: 'Landing page / Xbox',
    intro:
      'Страница для трафика по Xbox. Здесь собраны доступные приставки Microsoft с понятной навигацией по линейкам и конфигурациям.',
    catalogHref: '/catalog?main=home-consoles&sub=xbox',
    whyUs: [
      {
        title: 'Линейки разделены',
        text: 'Xbox One и Xbox Series выделены в отдельные карточки, чтобы клиент не путался в поколениях.',
      },
      {
        title: 'Актуальные комплекты',
        text: 'Мы показываем только те конфигурации, которые реально доступны для оформления заказа.',
      },
      {
        title: 'Быстрый заказ',
        text: 'Заказ можно оформить на сайте и вернуться к оплате из личного кабинета, пока действует бронь.',
      },
    ],
    faq: [
      {
        question: 'Какие модели Xbox доступны?',
        answer: 'На витрине доступны Xbox One S, Xbox One X, Xbox Series S и Xbox Series X в зависимости от наличия.',
      },
      {
        question: 'Есть ли комплекты с геймпадами и подпиской?',
        answer: 'Да, часть товаров собирается как готовые игровые решения с аксессуарами и дополнительными сервисами.',
      },
      {
        question: 'Можно ли проверить состояние перед покупкой?',
        answer: 'Да, перед продажей мы проверяем комплект, состояние и базовую работоспособность приставки.',
      },
    ],
    match: (product) =>
      product.catalogSubKey === 'xbox' ||
      product.catalogFamilyKey === 'xbox-one' ||
      product.catalogFamilyKey === 'xbox-series' ||
      contains(product, ['xbox']),
  },
  'steam-deck': {
    slug: 'steam-deck',
    title: 'Steam Deck: LCD и OLED версии',
    description:
      'Подборка Steam Deck LCD и OLED: разные объёмы памяти, готовые комплекты и быстрая консультация по выбору.',
    seoTitle: 'Steam Deck купить в Москве | LCD и OLED | TechnoPrime',
    seoDescription:
      'Купить Steam Deck в Москве: LCD и OLED версии, разные объёмы памяти, проверка перед продажей и быстрая доставка.',
    heroEyebrow: 'Landing page / Steam Deck',
    intro:
      'Steam Deck покупают за гибкость и доступ к библиотеке PC-игр. На этой странице собраны обе актуальные линейки, чтобы упростить выбор между LCD и OLED.',
    catalogHref: '/catalog?main=portable-consoles&sub=steam-deck',
    whyUs: [
      {
        title: 'LCD и OLED на одной странице',
        text: 'Легко сравнить модели и выбрать подходящую версию под бюджет и сценарий использования.',
      },
      {
        title: 'Прозрачные конфигурации',
        text: 'В карточках указаны объём памяти, состояние и состав комплекта.',
      },
      {
        title: 'Поддержка по настройке',
        text: 'После покупки можно быстро связаться с менеджером по вопросам заказа и сервиса.',
      },
    ],
    faq: [
      {
        question: 'Чем отличается Steam Deck LCD от OLED?',
        answer: 'OLED предлагает более яркий экран и улучшенные ощущения от портативной игры, LCD остается сильным по цене вариантом.',
      },
      {
        question: 'Какие объёмы памяти доступны?',
        answer: 'На витрине могут быть доступны варианты 512GB и 1024GB в зависимости от модели и наличия.',
      },
      {
        question: 'Подходит ли Steam Deck для поездок?',
        answer: 'Да, это одна из главных сильных сторон устройства: полноценная портативная игровая система.',
      },
    ],
    match: (product) =>
      product.catalogSubKey === 'steam-deck' ||
      product.catalogFamilyKey === 'steam-deck-lcd' ||
      product.catalogFamilyKey === 'steam-deck-oled' ||
      contains(product, ['steam deck']),
  },
  'ps-portal': {
    slug: 'ps-portal',
    title: 'PlayStation Portal: портативный экран для PlayStation',
    description:
      'Подборка PlayStation Portal: актуальные предложения, проверка состояния и консультация по совместимости.',
    seoTitle: 'PlayStation Portal купить в Москве | TechnoPrime',
    seoDescription:
      'Купить PlayStation Portal в Москве: актуальное наличие, проверка состояния, консультация и быстрая доставка.',
    heroEyebrow: 'Landing page / PS Portal',
    intro:
      'PlayStation Portal подходит тем, кто хочет играть удаленно через экосистему PlayStation. Здесь собраны актуальные карточки и базовая информация по выбору.',
    catalogHref: '/catalog?main=portable-consoles&sub=portable-playstation&family=playstation-portal',
    whyUs: [
      {
        title: 'Фокус на совместимости',
        text: 'Помогаем понять, подходит ли устройство под ваш сценарий использования и домашнюю экосистему PlayStation.',
      },
      {
        title: 'Проверка перед продажей',
        text: 'Каждая карточка сопровождается проверкой состояния и базовой работоспособности.',
      },
      {
        title: 'Быстрая коммуникация',
        text: 'После оформления заказа статусы и связь с менеджером доступны в личном кабинете.',
      },
    ],
    faq: [
      {
        question: 'Для чего нужен PlayStation Portal?',
        answer: 'Это устройство для удаленной игры в экосистеме PlayStation, когда нужен отдельный экран и контроллерный форм-фактор.',
      },
      {
        question: 'Есть ли отдельная категория для PS Portal?',
        answer: 'Да, на этой странице собраны все актуальные предложения по PlayStation Portal.',
      },
      {
        question: 'Можно ли оформить заказ онлайн?',
        answer: 'Да, оформить заказ можно прямо на сайте с последующим переходом к оплате и бронью товара.',
      },
    ],
    match: (product) =>
      product.catalogFamilyKey === 'playstation-portal' || contains(product, ['playstation', 'portal']),
  },
};

export function getStorefrontLanding(slug: string) {
  return STOREFRONT_LANDINGS[slug as StorefrontLandingConfig['slug']] || null;
}
