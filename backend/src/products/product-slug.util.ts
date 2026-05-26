type SlugSource = {
  id?: number | string | null;
  slug?: string | null;
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  adSku?: string | null;
};

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

function transliterate(input: string) {
  return Array.from(input)
    .map(char => {
      const lower = char.toLowerCase();
      return CYRILLIC_MAP[lower] ?? char;
    })
    .join('');
}

export function normalizeSlugPart(input: string) {
  return transliterate(String(input || ''))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 90);
}

export function buildProductSlug(input: SlugSource) {
  const explicitSlug = normalizeSlugPart(String(input.slug || ''));
  if (explicitSlug) return explicitSlug;

  const composed = [
    input.name,
    input.brand &&
    !String(input.name || '')
      .toLowerCase()
      .includes(String(input.brand || '').toLowerCase())
      ? input.brand
      : null,
    input.model &&
    !String(input.name || '')
      .toLowerCase()
      .includes(String(input.model || '').toLowerCase())
      ? input.model
      : null,
    input.version,
  ]
    .filter(Boolean)
    .join(' ');

  const normalized = normalizeSlugPart(composed);
  if (normalized) return normalized;

  const skuFallback = normalizeSlugPart(String(input.adSku || ''));
  if (skuFallback) return skuFallback;

  return `product-${String(input.id || 'item').replace(/\D+/g, '') || 'item'}`;
}
