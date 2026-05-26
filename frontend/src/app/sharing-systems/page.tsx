'use client';

import { useEffect, useState } from 'react';
import { Search, Plus, Users, AlertTriangle, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import MobilePageHeader from '@/components/MobilePageHeader';
import { getSharingConsoleMeta, getSharingSlotTypes, getSlotStat, type SharingConsoleType } from '@/lib/sharing';

type SharingSystem = {
  id: number;
  name: string;
  isActive: boolean;
  totalSlots: number;
  availableSlots: number;
  usedSlots: number;
  daysLeft: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
  donor: {
    id: number;
    email: string;
	    consoleType: SharingConsoleType;
    endDate: string;
    isActive: boolean;
  };
  clientSlots: Array<{
    id: number;
    clientId: number;
    client: {
      id: number;
      name: string;
      phone: string;
    };
	    consoleType: SharingConsoleType;
    startDate: string;
    endDate: string;
    isActive: boolean;
  }>;
  slotStats: {
    ps5: { used: number; max: number; available: number };
    ps4: { used: number; max: number; available: number };
    xbox1?: { used: number; max: number; available: number };
    xbox2?: { used: number; max: number; available: number };
  };
};

export default function SharingSystemsPage() {
  const [systems, setSystems] = useState<SharingSystem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'available' | 'expired'>('all');

  const loadSystems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'active') params.set('isActive', 'true');
      if (filter === 'available') params.set('withAvailableSlots', 'true');
      
      const data = await fetchWithAuth(`sharing-systems?${params}`);
      setSystems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSystems();
  }, [filter]);

  const filteredSystems = systems.filter(system =>
    system.name.toLowerCase().includes(search.toLowerCase()) ||
    system.donor.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: systems.length,
    active: systems.filter(s => s.isActive && !s.isExpired).length,
    expiring: systems.filter(s => s.isExpiringSoon).length,
    utilized: systems.length > 0 ? Math.round((systems.reduce((sum, s) => sum + s.usedSlots, 0) / Math.max(1, systems.reduce((sum, s) => sum + s.totalSlots, 0))) * 100) : 0,
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="mobile-page-shell md:space-y-6 md:pb-6">
      <MobilePageHeader
        title="Системы шеринга"
        subtitle={`${stats.total} систем · ${stats.active} активных`}
        sticky={false}
        action={
          <Link
            href="/sharing-systems/new"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-pink-500/20"
            aria-label="Новая система"
          >
            <Plus className="h-4 w-4" />
          </Link>
        }
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="hidden items-center justify-between gap-4 md:flex"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-teal-400 bg-clip-text text-transparent">
            Системы шеринга
          </h1>
          <p className="text-slate-400 text-sm mt-1">Управление общим доступом PlayStation и Xbox</p>
        </div>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Link
            href="/sharing-systems/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:from-purple-700 hover:to-pink-700 transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Новая система
          </Link>
        </motion.div>
      </motion.div>

      {/* Stats */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 md:gap-4 lg:grid-cols-4"
      >
        {[
          { label: 'Всего систем', value: stats.total, icon: Users, color: 'from-blue-500 to-cyan-500' },
          { label: 'Активные', value: stats.active, icon: Sparkles, color: 'from-teal-500 to-green-500' },
          { label: 'Скоро истекают', value: stats.expiring, icon: AlertTriangle, color: 'from-amber-500 to-orange-500' },
          { label: 'Загруженность', value: `${stats.utilized}%`, icon: TrendingUp, color: 'from-purple-500 to-pink-500' },
        ].map(({ label, value, icon: Icon, color }, idx) => (
          <motion.div
            key={idx}
            variants={itemVariants}
            className={`glass min-w-0 rounded-xl border border-slate-700/50 bg-gradient-to-br ${color}/10 p-3 sm:p-4`}
          >
            <div className="flex min-w-0 items-start justify-between gap-2 sm:items-center">
              <div className="min-w-0">
                <div className="mb-1 line-clamp-2 text-[11px] leading-4 text-slate-400 sm:text-sm">{label}</div>
                <div className="break-words text-2xl font-bold leading-tight text-white sm:text-3xl">{value}</div>
              </div>
              <div className={`shrink-0 rounded-lg bg-gradient-to-br ${color} p-2 opacity-20 sm:p-3`}>
                <Icon className="h-5 w-5 text-white sm:h-6 sm:w-6" />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-xl border border-slate-700/50 p-3 sm:p-4"
      >
        <div className="flex flex-col gap-3 md:flex-row md:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              placeholder="Поиск по названию или email..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="mobile-scroll-row md:mx-0 md:flex md:gap-2 md:px-0 md:pb-0">
            {[
              { key: 'all', label: 'Все' },
              { key: 'active', label: 'Активные' },
              { key: 'available', label: 'Свободны' },
              { key: 'expired', label: 'Истекли' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key as any)}
                className={`min-h-10 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-all ${
                  filter === key
                    ? 'bg-gradient-to-r from-purple-600 to-teal-600 text-white shadow-lg'
                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-600/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Systems Grid */}
      {loading ? (
        <div className="glass p-12 text-center rounded-2xl">
          <div className="animate-spin w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div className="text-slate-400">Загрузка...</div>
        </div>
      ) : filteredSystems.length === 0 ? (
        <div className="glass p-12 text-center rounded-2xl border border-slate-700/50">
          <Users className="w-16 h-16 mx-auto mb-3 text-slate-600" />
          <div className="text-slate-400 font-medium">Не найдено</div>
          <div className="text-sm text-slate-500 mt-1">
            {search ? 'Попробуйте другой поиск' : 'Создайте первую систему'}
          </div>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3"
        >
          {filteredSystems.map((system) => (
            <motion.div
              key={system.id}
              variants={itemVariants}
              whileHover={{ y: -5 }}
              className="glass group rounded-xl border border-slate-700/50 p-4 transition-all hover:border-slate-600/80 sm:p-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white truncate group-hover:text-teal-400 transition">{system.name}</h3>
                  <div className="text-xs text-slate-400 truncate mt-1">{system.donor.email}</div>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ml-2 ${
                  system.isExpired ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50' :
                  system.isExpiringSoon ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' :
                  'bg-teal-500/20 text-teal-400 border border-teal-500/50'
                }`}>
                  {system.isExpired ? 'Истекла' : system.isExpiringSoon ? 'Скоро' : 'Активна'}
                </div>
              </div>

              {/* Donor */}
              <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-600/50 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Консоль</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {(() => {
                        const meta = getSharingConsoleMeta(system.donor.consoleType);
                        const Icon = meta.icon;
                        return (
                          <>
                            <Icon className={`h-4 w-4 ${meta.textClass}`} />
                            <span className="font-bold text-white">
                              {system.donor.consoleType.startsWith('XBOX') ? 'Xbox' : meta.label}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Дней</div>
                    <div className={`text-xl font-bold ${
                      system.daysLeft <= 0 ? 'text-rose-400' :
                      system.daysLeft <= 30 ? 'text-amber-400' :
                      'text-teal-400'
                    }`}>
                      {system.daysLeft}
                    </div>
                  </div>
                </div>
              </div>

              {/* Slots Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Слоты</span>
                  <span className="text-sm font-semibold text-white">{system.usedSlots}/{system.totalSlots}</span>
                </div>
                <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all"
                    style={{ width: `${(system.usedSlots / system.totalSlots) * 100}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {getSharingSlotTypes(system.donor.consoleType).map((slotType) => {
                    const meta = getSharingConsoleMeta(slotType);
                    const stat = getSlotStat(system.slotStats, slotType);
                    return (
                      <div key={slotType} className="text-xs">
                        <span className="text-slate-400">{meta.label}:</span>
                        <span className={`${meta.textClass} ml-1 font-semibold`}>{stat.used}/{stat.max}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Clients */}
              {system.clientSlots.filter(s => s.isActive).length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-slate-800/20 border border-slate-600/30">
                  <div className="text-xs text-slate-400 mb-2">Клиентов:</div>
                  <div className="flex flex-wrap gap-1">
                    {system.clientSlots
                      .filter(s => s.isActive)
                      .slice(0, 3)
                      .map((slot) => (
                        <div key={slot.id} className="px-2 py-1 rounded-full text-xs bg-slate-700/50 text-slate-300">
                          {slot.client?.name || `#${slot.clientId}`}
                        </div>
                      ))}
                    {system.clientSlots.filter(s => s.isActive).length > 3 && (
                      <div className="px-2 py-1 text-xs text-slate-400">
                        +{system.clientSlots.filter(s => s.isActive).length - 3}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  href={`/sharing-systems/${system.id}`}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-600/50 transition text-center text-sm font-medium"
                >
                  Открыть
                </Link>
                {system.availableSlots > 0 && (
                  <Link
                    href={`/sharing-systems/${system.id}/assign`}
                    className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:from-teal-700 hover:to-cyan-700 transition text-center text-sm font-medium"
                  >
                    Добавить
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
