'use client';

import Link from 'next/link';
import { BookOpen, Gamepad2, Link2, Settings, ShieldCheck, Users2 } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function SettingsPage() {
  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
      <div className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">
            <Settings className="h-4 w-4" />
            Настройки
          </div>
          <h1 className="mt-3 text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-teal-400 bg-clip-text text-transparent">
            Настройки CRM
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Системные разделы, подключения площадок и внутренние настройки TechnoPrime.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Link
            href="/settings/integrations"
            className="glass block overflow-hidden rounded-2xl border border-slate-700/70 transition hover:-translate-y-0.5"
          >
            <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-teal-500" />
            <div className="p-6">
              <div className="mb-4 inline-flex rounded-2xl bg-gradient-to-br from-purple-600 to-teal-600 p-3 text-white shadow-lg">
                <Link2 className="h-6 w-6" />
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100">
                  Интеграции
                </span>
                <span className="rounded-full border border-slate-600/60 bg-slate-900/60 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200">
                  SUPER_ADMIN
                </span>
              </div>
              <h2 className="mt-4 text-xl font-bold text-white">Площадки и авторизация</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Подключение Avito, Ozon, Яндекс Доставки и CDEK для синхронизации логистики и статусов отправлений.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-200">
                <ShieldCheck className="h-4 w-4" />
                Доступ к привязке и отвязке только у супер-админа
              </div>
            </div>
          </Link>

          <Link
            href="/team"
            className="glass block overflow-hidden rounded-2xl border border-slate-700/70 transition hover:-translate-y-0.5"
          >
            <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500" />
            <div className="p-6">
              <div className="mb-4 inline-flex rounded-2xl bg-gradient-to-br from-cyan-600 to-indigo-600 p-3 text-white shadow-lg">
                <Users2 className="h-6 w-6" />
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100">
                  Команда
                </span>
                <span className="rounded-full border border-slate-600/60 bg-slate-900/60 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200">
                  SUPER_ADMIN
                </span>
              </div>
              <h2 className="mt-4 text-xl font-bold text-white">Сотрудники и доступы</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Управление сотрудниками CRM, их ролями, загрузкой и внутренними метриками команды.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">
                <ShieldCheck className="h-4 w-4" />
                Раздел управления доступен только супер-админу
              </div>
            </div>
          </Link>

          <Link
            href="/storefront"
            className="glass block overflow-hidden rounded-2xl border border-slate-700/70 transition hover:-translate-y-0.5"
          >
            <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500" />
            <div className="p-6">
              <div className="mb-4 inline-flex rounded-2xl bg-gradient-to-br from-cyan-600 to-sky-600 p-3 text-white shadow-lg">
                <Gamepad2 className="h-6 w-6" />
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100">
                  Витрина
                </span>
                <span className="rounded-full border border-slate-600/60 bg-slate-900/60 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200">
                  CRM
                </span>
              </div>
              <h2 className="mt-4 text-xl font-bold text-white">Управление витриной</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Категории, посадочные блоки, акции и вся витринная логика магазина в одном месте.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-200">
                <Settings className="h-4 w-4" />
                Перенесено в системные настройки CRM
              </div>
            </div>
          </Link>

          <Link
            href="/settings/instructions"
            className="glass block overflow-hidden rounded-2xl border border-slate-700/70 transition hover:-translate-y-0.5"
          >
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500" />
            <div className="p-6">
              <div className="mb-4 inline-flex rounded-2xl bg-gradient-to-br from-emerald-600 to-cyan-600 p-3 text-white shadow-lg">
                <BookOpen className="h-6 w-6" />
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100">
                  Инструкции
                </span>
                <span className="rounded-full border border-slate-600/60 bg-slate-900/60 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200">
                  SUPPORT
                </span>
              </div>
              <h2 className="mt-4 text-xl font-bold text-white">База по приставкам</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Управление клиентскими инструкциями по платформам: разделы, сценарии восстановления и ключевые шаги.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                Отображаются только купившим соответствующую платформу
              </div>
            </div>
          </Link>
        </div>
      </div>
    </ProtectedRoute>
  );
}
