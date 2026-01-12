'use client';

import { useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, X, LogOut, LayoutDashboard, Users, Package, ShoppingCart, ListTodo, CreditCard, Share2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const menuItems = [
  { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard, roles: ['ADMIN', 'SUPER_ADMIN'] },
  { href: '/clients', label: 'Клиенты', icon: Users, roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/products', label: 'Товары', icon: Package, roles: ['ADMIN', 'MANAGER', 'TECHNICAL_SPECIALIST', 'SUPER_ADMIN'] },
  { href: '/orders', label: 'Заказы', icon: ShoppingCart, roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/tasks', label: 'Задачи', icon: ListTodo, roles: ['ADMIN', 'TECHNICAL_SPECIALIST', 'SUPER_ADMIN'] },
  { href: '/subscriptions', label: 'Подписки', icon: CreditCard, roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { href: '/sharing-systems', label: 'Шеринг', icon: Share2, roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
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
        className="fixed top-4 left-4 z-[60] p-3 rounded-xl glass backdrop-blur-2xl shadow-2xl md:hidden hover:bg-slate-700/50 transition"
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
            className="fixed inset-y-0 left-0 w-80 max-w-[90vw] bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-slate-700/50 shadow-2xl z-[50] md:hidden flex flex-col overflow-y-auto"
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-700/50 bg-gradient-to-br from-purple-900/20 to-teal-900/20 flex-shrink-0">
              <div className="font-bold text-2xl bg-gradient-to-r from-purple-400 to-teal-400 bg-clip-text text-transparent">
                TechnoPrime
              </div>
              <div className="text-xs text-slate-400 mt-1">CRM System</div>
              <div className="mt-3 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-medium inline-block">
                {user.role}
              </div>
            </div>

            {/* Menu Items - scrollable */}
            <div className="flex-1 p-4 space-y-2 overflow-y-auto">
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
                      className={`flex items-center gap-4 px-4 py-4 rounded-xl transition-all active:scale-95 ${
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