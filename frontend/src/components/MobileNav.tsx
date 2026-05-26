'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, X, LogOut, Users, Package, ShoppingCart, ListTodo, CreditCard, Share2, MessageCircle, Settings, Truck, BarChart3, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const menuItems = [
  { href: '/clients', label: 'Клиенты', icon: Users, roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/products', label: 'Товары', icon: Package, roles: ['ADMIN', 'MANAGER', 'TECHNICAL_SPECIALIST', 'SUPER_ADMIN'] },
  { href: '/orders', label: 'Заказы', icon: ShoppingCart, roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/logistics', label: 'Логистика', icon: Truck, roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/tasks', label: 'Задачи', icon: ListTodo, roles: ['ADMIN', 'TECHNICAL_SPECIALIST', 'SUPER_ADMIN'] },
  { href: '/subscriptions', label: 'Подписки', icon: CreditCard, roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/communication-center', label: 'Коммуникации', icon: MessageCircle, roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/sales-memo', label: 'Памятка', icon: BookOpen, roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/analytics', label: 'Аналитика', icon: BarChart3, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { href: '/team', label: 'Команда', icon: Users, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { href: '/sharing-systems', label: 'Шеринг', icon: Share2, roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/settings', label: 'Настройки', icon: Settings, roles: ['ADMIN', 'SUPER_ADMIN'] },
];

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout: authLogout } = useAuth();
  const pathname = usePathname();

  // ✅ Правильный колбэк для закрытия меню
  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // ✅ Правильный колбэк для логаута
  const handleLogout = useCallback(async () => {
    handleClose();
    await authLogout();
  }, [handleClose, authLogout]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isOpen]);

  if (!user || pathname === '/login' || pathname === '/register') {
    return null;
  }

  const visibleItems = menuItems.filter(item => 
    item.roles.includes(user.role as any)
  );

  return (
    <>
      {/* Hamburger Button - ВСЕГДА на top */}
      <motion.button
        className="fixed left-3 z-[60] flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-950/84 shadow-2xl backdrop-blur-2xl transition hover:bg-slate-800/88 md:hidden sm:left-4"
        style={{ top: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.95 }}
        type="button"
        aria-label="Toggle menu"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Menu className="w-6 h-6 text-white" />
        )}
      </motion.button>

      {/* Overlay - перекрывает контент но НЕ кнопку */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Menu - выше overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.nav
            className="fixed inset-y-0 left-0 z-[50] flex w-[min(88vw,340px)] flex-col overflow-y-auto border-r border-slate-700/50 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 shadow-2xl md:hidden"
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            {/* Header */}
            <div className="flex-shrink-0 border-b border-slate-700/50 bg-gradient-to-br from-purple-900/20 to-teal-900/20 px-5 pb-3.5 pt-[calc(env(safe-area-inset-top)+0.95rem)]">
              <div className="bg-gradient-to-r from-purple-400 to-teal-400 bg-clip-text text-2xl font-bold text-transparent">
                TechnoPrime
              </div>
              <div className="text-xs text-slate-400 mt-1">CRM System</div>
              <div className="mt-3 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-medium inline-block">
                {user.role}
              </div>
            </div>

            {/* Menu Items - scrollable */}
            <div className="flex-1 p-3.5 space-y-1.5 overflow-y-auto">
              {visibleItems.map((item, idx) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Link
                      href={item.href}
                      onClick={handleClose}
                      className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl transition-all active:scale-95 ${
                        isActive
                          ? 'bg-gradient-to-r from-purple-600 to-teal-600 shadow-lg shadow-purple-500/30 text-white'
                          : 'bg-slate-800/30 hover:bg-slate-700/50 text-slate-300 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer - sticky */}
            <div className="flex-shrink-0 p-4 border-t border-slate-700/50 bg-slate-900/80 backdrop-blur-xl space-y-3">
              {/* Profile */}
              <Link
                href="/profile"
                onClick={handleClose}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition active:scale-95"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-teal-500 flex items-center justify-center flex-shrink-0 text-white font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">{user.name}</div>
                  <div className="text-xs text-slate-400 truncate">{user.login}</div>
                </div>
              </Link>

              {/* Logout */}
              <motion.button
                onClick={handleLogout}
                whileTap={{ scale: 0.95 }}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 hover:text-rose-300 transition active:scale-95 font-medium"
              >
                <LogOut className="w-5 h-5" />
                <span>Выйти</span>
              </motion.button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
