export type LearnedReplySuggestion = {
  answer: string;
  family?: string | null;
  count: number;
  successCount: number;
  successRate: number;
  reason: string;
  matchedIntents?: string[];
  exampleQuestions?: string[];
  tokenOverlap?: number;
};

type ReplySuggestionContext = {
  itemTitle?: string | null;
  itemPrice?: string | null;
  itemUrl?: string | null;
};

function normalizeSpaces(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,!.?:;])/g, '$1')
    .trim();
}

function extractMemoryHint(title?: string | null) {
  const normalized = String(title || '').trim();
  if (!normalized) return null;
  const match = normalized.match(/\b(64|128|256|512|1024|2048)\s?(GB|ГБ)\b|\b(1|2)\s?(TB|ТБ)\b/i);
  if (!match) return null;
  return normalizeSpaces(match[0].toUpperCase().replace('ГБ', ' GB').replace('ТБ', ' TB'));
}

export function hydrateLearnedReply(
  template: string,
  context?: ReplySuggestionContext,
) {
  const replacements: Record<string, string> = {
    '{товар}': context?.itemTitle?.trim() || 'товар',
    '{цена}': context?.itemPrice?.trim() || 'актуальная цена',
    '{ссылка}': context?.itemUrl?.trim() || 'ссылка на объявление',
    '{вариант}': extractMemoryHint(context?.itemTitle) || context?.itemTitle?.trim() || 'нужная версия',
    '{память}': extractMemoryHint(context?.itemTitle) || 'нужная комплектация',
    '{срок}': 'сегодня',
  };

  let hydrated = String(template || '');
  Object.entries(replacements).forEach(([placeholder, value]) => {
    hydrated = hydrated.replaceAll(placeholder, value);
  });

  return normalizeSpaces(hydrated);
}
