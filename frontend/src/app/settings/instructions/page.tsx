'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

type InstructionSection = {
  key: string;
  title: string;
  content: string;
  sortOrder: number;
};

type InstructionRecord = {
  id: number;
  consoleKey: string;
  consoleLabel: string;
  title: string;
  subtitle?: string | null;
  searchAliases: string[];
  sections: InstructionSection[];
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type InstructionForm = {
  id?: number;
  consoleKey: string;
  consoleLabel: string;
  title: string;
  subtitle: string;
  searchAliasesRaw: string;
  sortOrder: string;
  isPublished: boolean;
  sections: InstructionSection[];
};

function makeEmptySection(index = 0): InstructionSection {
  return {
    key: `section_${index + 1}`,
    title: '',
    content: '',
    sortOrder: index,
  };
}

function makeEmptyForm(): InstructionForm {
  return {
    consoleKey: '',
    consoleLabel: '',
    title: '',
    subtitle: '',
    searchAliasesRaw: '',
    sortOrder: '0',
    isPublished: true,
    sections: [makeEmptySection(0)],
  };
}

function toForm(row: InstructionRecord): InstructionForm {
  return {
    id: row.id,
    consoleKey: row.consoleKey,
    consoleLabel: row.consoleLabel,
    title: row.title,
    subtitle: row.subtitle || '',
    searchAliasesRaw: Array.isArray(row.searchAliases) ? row.searchAliases.join(', ') : '',
    sortOrder: String(row.sortOrder || 0),
    isPublished: Boolean(row.isPublished),
    sections: Array.isArray(row.sections) && row.sections.length
      ? row.sections.map((section, index) => ({
          key: section.key || `section_${index + 1}`,
          title: section.title || '',
          content: section.content || '',
          sortOrder: Number(section.sortOrder || index),
        }))
      : [makeEmptySection(0)],
  };
}

function normalizeConsoleKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeSectionKey(value: string) {
  return normalizeConsoleKey(value) || 'section';
}

export default function SettingsInstructionsPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('SUPER_ADMIN', 'ADMIN');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<InstructionRecord[]>([]);
  const [form, setForm] = useState<InstructionForm>(makeEmptyForm());
  const [activeId, setActiveId] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((row) => {
      const source = [
        row.consoleLabel,
        row.consoleKey,
        row.title,
        row.subtitle || '',
        ...(row.searchAliases || []),
      ]
        .join(' ')
        .toLowerCase();
      return source.includes(query);
    });
  }, [items, search]);

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth('/api/instructions');
      const list = Array.isArray(data) ? data : [];
      setItems(list);

      if (!activeId && list.length) {
        setActiveId(list[0].id);
        setForm(toForm(list[0]));
      }
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось загрузить инструкции');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startCreate = () => {
    setActiveId(null);
    setForm(makeEmptyForm());
  };

  const startEdit = (row: InstructionRecord) => {
    setActiveId(row.id);
    setForm(toForm(row));
  };

  const setSection = (index: number, patch: Partial<InstructionSection>) => {
    setForm((prev) => {
      const next = [...prev.sections];
      const current = next[index];
      if (!current) return prev;
      next[index] = { ...current, ...patch };
      return {
        ...prev,
        sections: next,
      };
    });
  };

  const addSection = () => {
    setForm((prev) => ({
      ...prev,
      sections: [...prev.sections, makeEmptySection(prev.sections.length)],
    }));
  };

  const removeSection = (index: number) => {
    setForm((prev) => {
      const next = prev.sections.filter((_, sectionIndex) => sectionIndex !== index);
      return {
        ...prev,
        sections: next.length ? next : [makeEmptySection(0)],
      };
    });
  };

  const save = async () => {
    if (!canEdit) {
      toast.error('Недостаточно прав для изменения инструкций');
      return;
    }

    setSaving(true);
    try {
      const body = {
        consoleKey: normalizeConsoleKey(form.consoleKey),
        consoleLabel: form.consoleLabel.trim(),
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        searchAliases: form.searchAliasesRaw
          .split(/[,\n;]/g)
          .map((item) => item.trim())
          .filter(Boolean),
        sortOrder: Number(form.sortOrder || 0),
        isPublished: Boolean(form.isPublished),
        sections: form.sections.map((section, index) => ({
          key: normalizeSectionKey(section.key || section.title || `section_${index + 1}`),
          title: section.title.trim(),
          content: section.content.trim(),
          sortOrder: index,
        })),
      };

      const url = activeId ? `/api/instructions/${activeId}` : '/api/instructions';
      const method = activeId ? 'PATCH' : 'POST';
      const result = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(body),
      });

      if (!result?.success || !result?.instruction) {
        toast.error(result?.message || 'Не удалось сохранить инструкцию');
        return;
      }

      toast.success(activeId ? 'Инструкция обновлена' : 'Инструкция добавлена');
      const instruction = result.instruction as InstructionRecord;

      setItems((prev) => {
        if (activeId) {
          return prev.map((item) => (item.id === instruction.id ? instruction : item));
        }
        return [instruction, ...prev];
      });
      setActiveId(instruction.id);
      setForm(toForm(instruction));
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось сохранить инструкцию');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!canEdit) {
      toast.error('Недостаточно прав для удаления инструкции');
      return;
    }

    if (!window.confirm('Удалить инструкцию? Это действие нельзя отменить.')) return;

    try {
      const result = await fetchWithAuth(`/api/instructions/${id}`, { method: 'DELETE' });
      if (!result?.success) {
        toast.error(result?.message || 'Не удалось удалить инструкцию');
        return;
      }
      toast.success('Инструкция удалена');

      setItems((prev) => prev.filter((item) => item.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setForm(makeEmptyForm());
      }
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось удалить инструкцию');
    }
  };

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 text-sm text-cyan-200/90 transition hover:text-cyan-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад в настройки
            </Link>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">
              <BookOpen className="h-4 w-4" />
              Инструкции
            </div>
            <h1 className="mt-3 text-3xl font-bold bg-gradient-to-r from-cyan-300 via-blue-300 to-sky-200 bg-clip-text text-transparent">
              База инструкций по приставкам
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Эти инструкции отображаются клиентам в личном кабинете только по купленным платформам.
            </p>
          </div>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
          >
            <Plus className="h-4 w-4" />
            Новая инструкция
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px,1fr]">
          <div className="glass rounded-2xl border border-slate-700/70 p-4">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Поиск</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Steam Deck, PS5, DualBoot..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none"
              />
            </label>

            <div className="mt-3 space-y-2">
              {loading ? (
                <p className="text-sm text-slate-300">Загружаем инструкции...</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-slate-300">Инструкции не найдены.</p>
              ) : (
                filtered.map((row) => {
                  const active = row.id === activeId;
                  return (
                    <div
                      key={row.id}
                      className={`rounded-xl border p-3 transition ${
                        active
                          ? 'border-cyan-300/55 bg-cyan-500/15'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="w-full text-left"
                      >
                        <p className="text-sm font-semibold text-white">{row.consoleLabel}</p>
                        <p className="mt-1 text-xs text-slate-300">{row.title}</p>
                        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          key: {row.consoleKey}
                        </p>
                      </button>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => void remove(row.id)}
                          className="mt-2 inline-flex items-center gap-1 rounded-lg border border-rose-300/30 bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Удалить
                        </button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="glass rounded-2xl border border-slate-700/70 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-slate-300">Ключ платформы (consoleKey)</span>
                <input
                  value={form.consoleKey}
                  onChange={(event) => setForm((prev) => ({ ...prev, consoleKey: event.target.value }))}
                  placeholder="steam_deck"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-slate-300">Название платформы</span>
                <input
                  value={form.consoleLabel}
                  onChange={(event) => setForm((prev) => ({ ...prev, consoleLabel: event.target.value }))}
                  placeholder="Steam Deck"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none"
                />
              </label>
            </div>

            <label className="mt-3 block space-y-1 text-sm">
              <span className="text-slate-300">Заголовок</span>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Инструкция по Steam Deck"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none"
              />
            </label>

            <label className="mt-3 block space-y-1 text-sm">
              <span className="text-slate-300">Подзаголовок</span>
              <input
                value={form.subtitle}
                onChange={(event) => setForm((prev) => ({ ...prev, subtitle: event.target.value }))}
                placeholder="Краткое описание для клиента"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none"
              />
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-slate-300">Порядок (sortOrder)</span>
                <input
                  value={form.sortOrder}
                  onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-cyan-300/60 focus:outline-none"
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                <span>Опубликовано</span>
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(event) => setForm((prev) => ({ ...prev, isPublished: event.target.checked }))}
                />
              </label>
            </div>

            <label className="mt-3 block space-y-1 text-sm">
              <span className="text-slate-300">Поисковые синонимы (через запятую)</span>
              <textarea
                value={form.searchAliasesRaw}
                onChange={(event) => setForm((prev) => ({ ...prev, searchAliasesRaw: event.target.value }))}
                placeholder="steam deck, steamdeck, dualboot, steamos"
                className="min-h-20 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500 focus:border-cyan-300/60 focus:outline-none"
              />
            </label>

            <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Разделы инструкции</p>
                <button
                  type="button"
                  onClick={addSection}
                  className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Раздел
                </button>
              </div>

              <div className="space-y-3">
                {form.sections.map((section, index) => (
                  <div key={`${section.key}-${index}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="grid gap-2 sm:grid-cols-[220px,1fr,auto]">
                      <label className="space-y-1 text-xs text-slate-300">
                        <span>Ключ раздела</span>
                        <input
                          value={section.key}
                          onChange={(event) => setSection(index, { key: event.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-white focus:border-cyan-300/60 focus:outline-none"
                        />
                      </label>
                      <label className="space-y-1 text-xs text-slate-300">
                        <span>Заголовок</span>
                        <input
                          value={section.title}
                          onChange={(event) => setSection(index, { title: event.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-white focus:border-cyan-300/60 focus:outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeSection(index)}
                        className="self-end rounded-lg border border-rose-300/30 bg-rose-500/10 px-2 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
                      >
                        Удалить
                      </button>
                    </div>
                    <label className="mt-2 block space-y-1 text-xs text-slate-300">
                      <span>Содержимое</span>
                      <textarea
                        value={section.content}
                        onChange={(event) => setSection(index, { content: event.target.value })}
                        className="min-h-28 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-sm text-white focus:border-cyan-300/60 focus:outline-none"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !canEdit}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Сохраняем...' : activeId ? 'Сохранить изменения' : 'Создать инструкцию'}
              </button>
              {!canEdit ? (
                <span className="inline-flex items-center rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
                  Режим только чтения: изменение доступно ADMIN и SUPER_ADMIN
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
