'use client';

import { useState } from 'react';
import {
  ChevronDown,
  Edit,
  Trash,
  Phone,
  MapPin,
  Gamepad2,
  Play,
  StopCircle,
  Shield,
  AlertTriangle,
  Link2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { type SharingConsoleType } from '@/lib/sharing';

type Subscription = {
  id: number;
  type: string;
  endDate: string;
  status: string;
  accountType?: 'PERSONAL' | 'SHARING_CLIENT' | 'SHARING_DONOR';
  clientSlot?: {
    endDate?: string | null;
    sharingSystem?: {
      donor?: {
        endDate?: string | null;
      };
    };
  };
  donorAccount?: {
    endDate?: string | null;
  };
  sharingSystem?: {
    id: number;
    name: string;
    donor: {
      email: string;
	      consoleType: SharingConsoleType;
      endDate?: string | null;
    };
  };
};

type Client = {
  id: number;
  name: string;
  phone: string;
  city?: string;
  address?: string;
  consoleType?: string;
  subscriptions?: Subscription[];
  createdAt?: string;
};

const getActiveSubscription = (client: Client) => {
  const active = client.subscriptions?.filter((s) => s.status === 'ACTIVE') || [];
  if (!active.length) return null;

  return active.sort(
    (left, right) =>
      getSubscriptionEffectiveEndTime(right) - getSubscriptionEffectiveEndTime(left),
  )[0] || null;
};

const parseDateTime = (value?: string | null) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

const getSubscriptionEffectiveEndTime = (sub: Subscription | null) => {
  if (!sub) return 0;

  const candidates =
    sub.accountType === 'SHARING_CLIENT'
      ? [
          sub.endDate,
          sub.clientSlot?.endDate,
          sub.clientSlot?.sharingSystem?.donor?.endDate && !sub.clientSlot?.endDate
            ? sub.clientSlot.sharingSystem.donor.endDate
            : null,
          sub.donorAccount?.endDate && !sub.clientSlot?.endDate ? sub.donorAccount.endDate : null,
        ]
      : sub.accountType === 'SHARING_DONOR'
        ? [
            sub.endDate,
            sub.donorAccount?.endDate,
            sub.clientSlot?.sharingSystem?.donor?.endDate,
            sub.sharingSystem?.donor?.endDate,
          ]
        : [sub.endDate];

  return Math.max(0, ...candidates.map(parseDateTime).filter((time): time is number => time !== null));
};

const getSubscriptionEffectiveEndDate = (sub: Subscription | null) => {
  const time = getSubscriptionEffectiveEndTime(sub);
  return time > 0 ? new Date(time).toISOString() : null;
};

const daysLeft = (endDate?: string | null) => {
  try {
    if (!endDate) return 'Ошибка даты';
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil(
      (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff > 0) return `${diff} дн.`;
    if (diff === 0) return 'Сегодня';
    return 'Истекла';
  } catch {
    return 'Ошибка даты';
  }
};

const getStatusColor = (endDate?: string | null) => {
  try {
    if (!endDate) return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil(
      (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diff <= 0) return 'text-rose-400 bg-rose-500/20 border-rose-500/30';
    if (diff <= 7) return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
    return 'text-teal-400 bg-teal-500/20 border-teal-500/30';
  } catch {
    return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
  }
};

export function ClientCardExpanded({
  client,
  onEdit,
  onDelete,
}: {
  client: Client;
  onEdit: (client: Client) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sub = getActiveSubscription(client);
  const effectiveEndDate = getSubscriptionEffectiveEndDate(sub);
  const isExpired = Boolean(effectiveEndDate && new Date(effectiveEndDate) < new Date());

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl border border-slate-700/50 overflow-hidden hover:border-slate-600/80 transition-all relative z-10"
    >
      {/* HEADER - ВСЕГДА ВИДНО */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 hover:bg-slate-800/30 transition text-left"
      >
        <div className="flex items-start justify-between gap-3">
          {/* Левая часть - Инфо о клиенте */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white flex-shrink-0">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white truncate text-lg">
                  {client.name}
                </h3>
                <p className="text-sm text-cyan-400 truncate">
                  <Phone className="w-3 h-3 inline mr-1" />
                  {client.phone}
                </p>
              </div>
            </div>

            {/* Город и адрес */}
            {(client.city || client.address) && (
              <div className="flex items-start gap-2 text-sm text-slate-400">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <div className="line-clamp-2">
                  {client.city}
                  {client.address && client.city ? ', ' : ''}
                  {client.address}
                </div>
              </div>
            )}
          </div>

          {/* Правая часть - Консоль и Статус подписки */}
          <div className="flex items-start gap-2 flex-shrink-0">
            {/* Консоль */}
            {client.consoleType && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/50 border border-slate-700/50">
	                {client.consoleType.toLowerCase().includes('xbox') ? (
	                  <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
	                ) : client.consoleType.includes('PS5') ? (
	                  <Play className="w-3.5 h-3.5 text-cyan-400" />
	                ) : (
                  <StopCircle className="w-3.5 h-3.5 text-blue-400" />
                )}
                <span className="text-xs font-medium text-slate-300 whitespace-nowrap">
                  {client.consoleType.replace('PlayStation ', 'PS')}
                </span>
              </div>
            )}

            {/* Статус подписки */}
            {sub && (
              <div
                className={`px-2 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 ${getStatusColor(
                  effectiveEndDate
                )}`}
              >
                {isExpired ? (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    Истекла
                  </>
                ) : (
                  <>
                    <Shield className="w-3 h-3" />
                    {daysLeft(effectiveEndDate)}
                  </>
                )}
              </div>
            )}

            {/* Кнопка расширения */}
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              className="p-1.5 rounded-lg hover:bg-slate-700/50 transition"
            >
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </motion.div>
          </div>
        </div>
      </button>

      {/* EXPANDED CONTENT */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t border-slate-700/50"
          >
            <div className="p-4 space-y-4">
              {/* ИНФОРМАЦИЯ О ПОДПИСКЕ ИЛИ СИСТЕМЕ ШЕРИНГА */}
              {sub ? (
                <div className="space-y-3">
                  {/* Тип подписки */}
                  <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">Подписка:</span>
                      <div
                        className={`flex items-center gap-1.5 font-bold text-sm ${
                          sub.accountType === 'SHARING_CLIENT'
                            ? 'text-purple-400'
                            : 'text-cyan-400'
                        }`}
                      >
                        {sub.accountType === 'SHARING_CLIENT' && (
                          <Shield className="w-4 h-4" />
                        )}
                        {sub.type === 'PS_PLUS'
                          ? 'PS Plus'
                          : sub.type === 'GAME_PASS'
                            ? 'Game Pass'
                            : 'EA Play'}
                      </div>
                    </div>

                    {/* Дата окончания */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Дата окончания:</span>
                      <span
                        className={`font-medium ${
                          isExpired ? 'text-rose-400' : 'text-teal-400'
                        }`}
                      >
                        {effectiveEndDate ? new Date(effectiveEndDate).toLocaleDateString('ru') : '—'}
                      </span>
                    </div>

                    {/* Система шеринга (если есть) */}
                    {sub.sharingSystem &&
                      sub.accountType === 'SHARING_CLIENT' && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50">
                          <div className="text-xs text-slate-400 mb-2">
                            Система шеринга:
                          </div>
                          <Link
                            href={`/sharing-systems/${sub.sharingSystem.id}`}
                            className="flex items-center justify-between p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition"
                          >
                            <div>
                              <div className="font-medium text-white text-sm">
                                {sub.sharingSystem.name}
                              </div>
                              <div className="text-xs text-purple-300">
                                {sub.sharingSystem.donor.consoleType} •{' '}
                                {sub.sharingSystem.donor.email}
                              </div>
                            </div>
                            <Link2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          </Link>
                        </div>
                      )}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center gap-2 text-sm text-amber-300 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">Нет активной подписки</span>
                  </div>
                  <Link
                    href={`/clients/${client.id}/add-subscription`}
                    className="block text-center px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-sm font-medium transition"
                  >
                    Добавить подписку
                  </Link>
                </div>
              )}

              {/* ДЕЙСТВИЯ */}
              <div className="flex gap-2 pt-2 border-t border-slate-700/50">
                <a
                  href={`tel:${client.phone}`}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 transition text-sm font-medium"
                >
                  <Phone className="w-4 h-4" />
                  Звонить
                </a>
                <button
                  onClick={() => onEdit(client)}
                  type="button"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 transition text-sm font-medium"
                >
                  <Edit className="w-4 h-4" />
                  Редактировать
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Удалить клиента "${client.name}"?`)) {
                      onDelete(client.id);
                    }
                  }}
                  type="button"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 transition text-sm font-medium"
                >
                  <Trash className="w-4 h-4" />
                  Удалить
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
