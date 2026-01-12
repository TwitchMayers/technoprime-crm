'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import { 
  Users, Package, ShoppingCart, ListTodo, CreditCard, LogOut, User, Bell, 
  Volume2, VolumeX, LayoutDashboard, Shirt, TrendingUp, Share2, Settings,
  BarChart3, Shield, GamepadIcon, ChevronLeft
} from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

type SystemType = 'TECHNOPRIME' | 'RICHMARKET';

type MenuItem = {
  href: string;
  label: string;
  icon: any;
  roles: string[];
  badge?: string;
  gradient?: string;
};

type Notif = { 
  id?: string; 
  title?: string; 
  text?: string; 
  createdAt?: string;
  read?: boolean;
};

const techPrimeMenu: MenuItem[] = [
  { 
    href: '/dashboard', 
    label: 'Дашборд', 
    icon: LayoutDashboard, 
    roles: ['ADMIN', 'SUPER_ADMIN'],
    gradient: 'from-blue-500 to-cyan-500'
  },
  { 
    href: '/clients', 
    label: 'Клиенты', 
    icon: Users, 
    roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'],
    gradient: 'from-green-500 to-emerald-500'
  },
  { 
    href: '/products', 
    label: 'Товары', 
    icon: Package, 
    roles: ['ADMIN', 'MANAGER', 'TECHNICAL_SPECIALIST', 'SUPER_ADMIN'],
    gradient: 'from-orange-500 to-amber-500'
  },
  { 
    href: '/orders', 
    label: 'Заказы', 
    icon: ShoppingCart, 
    roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'],
    gradient: 'from-purple-500 to-pink-500'
  },
  { 
    href: '/tasks', 
    label: 'Задачи', 
    icon: ListTodo, 
    roles: ['ADMIN', 'TECHNICAL_SPECIALIST', 'SUPER_ADMIN'],
    gradient: 'from-red-500 to-rose-500'
  },
  { 
    href: '/subscriptions', 
    label: 'Подписки', 
    icon: CreditCard, 
    roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'],
    gradient: 'from-indigo-500 to-purple-500'
  },
  { 
    href: '/sharing-systems', 
    label: 'Системы шеринга', 
    icon: Share2, 
    roles: ['ADMIN', 'MANAGER', 'SUPER_ADMIN'],
    gradient: 'from-violet-500 to-purple-600',
    badge: 'NEW'
  },
  { 
    href: '/analytics', 
    label: 'Аналитика', 
    icon: BarChart3, 
    roles: ['ADMIN', 'SUPER_ADMIN'],
    gradient: 'from-teal-500 to-cyan-600'
  },
];

const richMarketMenu: MenuItem[] = [
  { 
    href: '/richmarket/dashboard', 
    label: 'Дашборд', 
    icon: TrendingUp, 
    roles: ['SUPER_ADMIN', 'RICHMARKET_CEO'],
    gradient: 'from-pink-500 to-rose-500'
  },
  { 
    href: '/richmarket/clients', 
    label: 'Клиенты', 
    icon: Users, 
    roles: ['SUPER_ADMIN', 'RICHMARKET_CEO', 'RICHMARKET_MANAGER'],
    gradient: 'from-green-500 to-emerald-500'
  },
  { 
    href: '/richmarket/products', 
    label: 'Каталог', 
    icon: Shirt, 
    roles: ['SUPER_ADMIN', 'RICHMARKET_CEO', 'RICHMARKET_MANAGER'],
    gradient: 'from-orange-500 to-amber-500'
  },
  { 
    href: '/richmarket/orders', 
    label: 'Заказы', 
    icon: ShoppingCart, 
    roles: ['SUPER_ADMIN', 'RICHMARKET_CEO', 'RICHMARKET_MANAGER'],
    gradient: 'from-purple-500 to-pink-500'
  },
  { 
    href: '/richmarket/tasks', 
    label: 'Задачи', 
    icon: ListTodo, 
    roles: ['SUPER_ADMIN', 'RICHMARKET_CEO', 'RICHMARKET_MANAGER'],
    gradient: 'from-red-500 to-rose-500'
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout: authLogout } = useAuth();

  // ✅ ВСЕ HOOKS СРАЗУ - БЕЗ УСЛОВИЙ!
  const [currentSystem, setCurrentSystem] = useState<SystemType>('TECHNOPRIME');
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(false);

  // Определяем текущую систему по URL
  useEffect(() => {
    if (pathname?.startsWith('/richmarket')) {
      setCurrentSystem('RICHMARKET');
    } else {
      setCurrentSystem('TECHNOPRIME');
    }
  }, [pathname]);

  // Инициализация звука и уведомлений
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const saved = localStorage.getItem('notificationSound');
    if (saved !== null) setSoundEnabled(saved === 'true');

    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/notification.mp3');
    }

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // WebSocket уведомления
  useEffect(() => {
    if (!user) return; // ✅ Условие ВНУТРИ useEffect, а не до него!

    const socket = getSocket();

    const handleNotification = (data: any) => {
      const notif: Notif = {
        id: data?.id || String(Date.now() + Math.random()),
        title: data?.title || data?.type || 'Уведомление',
        text: data?.text || data?.payload?.message || '',
        createdAt: new Date().toISOString(),
        read: false,
      };

      setNotifs(prev => [notif, ...prev].slice(0, 50));

      toast.success(notif.title, {
        description: notif.text,
        duration: 5000,
      });

      if (soundEnabled && audioRef.current) {
        audioRef.current.play().catch(() => {});
      }

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notif.title || 'TechnoPrime CRM', {
          body: notif.text,
          icon: '/favicon.ico',
        });
      }
    };

    socket.on('notification', handleNotification);
    socket.on('notify', handleNotification);
    socket.on('ORDER_CREATED', handleNotification);
    socket.on('ORDER_ASSIGNED', handleNotification);
    socket.on('queueUpdated', () => {});

    return () => {
      socket.off('notification', handleNotification);
      socket.off('notify', handleNotification);
      socket.off('ORDER_CREATED', handleNotification);
      socket.off('ORDER_ASSIGNED', handleNotification);
      socket.off('queueUpdated');
    };
  }, [user, soundEnabled]);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const newValue = !prev;
      localStorage.setItem('notificationSound', String(newValue));
      toast.info(newValue ? '🔔 Звук включен' : '🔕 Звук выключен');
      return newValue;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifs([]);
    setNotifOpen(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('http://localhost:4000/api/auth/logout', { 
        method: 'POST',
        credentials: 'include'
      }).catch(() => null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      document.cookie = 'token=; Max-Age=0; path=/; SameSite=Strict';
      if (typeof localStorage !== 'undefined') localStorage.clear();
      if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
      authLogout();
    }
  }, [authLogout]);

  // ✅ EARLY RETURNS - ТОЛЬКО СЕЙЧАС, ПОСЛЕ ВСЕХ HOOKS!
  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  if (!user) return null;

  // Выбираем меню в зависимости от системы
  const menuItems = currentSystem === 'RICHMARKET' ? richMarketMenu : techPrimeMenu;
  const visibleMenu = menuItems.filter(item => item.roles.includes(user.role));

  const unreadCount = notifs.filter(n => !n.read).length;
  const name = user.name || 'Пользователь';

  // Цвета системы
  const systemColors = currentSystem === 'RICHMARKET' 
    ? { 
        gradient: 'from-pink-600 to-orange-600', 
        text: 'RichMarket', 
        bg: 'from-pink-900/20 to-orange-900/20',
        border: 'border-pink-500/30'
      }
    : { 
        gradient: 'from-purple-600 to-teal-600', 
        text: 'TechnoPrime', 
        bg: 'from-purple-900/20 to-teal-900/20',
        border: 'border-purple-500/30'
      };

  const sidebarWidth = sidebarCollapsed ? 'w-20' : 'w-64';

  return (
    <div className={`${sidebarWidth} h-screen flex flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-slate-700/50 transition-all duration-300 relative group z-20`}>
      
      {/* Toggle Button */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="absolute -right-3 top-6 z-20 w-6 h-6 rounded-full bg-slate-800 border border-slate-600 hover:bg-slate-700 transition-all hidden md:flex items-center justify-center"
        title={sidebarCollapsed ? 'Развернуть' : 'Свернуть'}
        type="button"
      >
        <ChevronLeft className={`w-3 h-3 text-slate-400 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
      </button>

      {/* Header */}
      <div className={`p-4 border-b border-slate-700/50 bg-gradient-to-br ${systemColors.bg} relative overflow-hidden`}>
        <div className="relative z-10">
          <div className={`font-bold transition-all ${sidebarCollapsed ? 'text-lg text-center' : 'text-xl'}`}>
            {sidebarCollapsed ? (
              <div className="bg-gradient-to-r from-purple-400 to-teal-400 bg-clip-text text-transparent">TP</div>
            ) : (
              <div className="bg-gradient-to-r from-purple-400 to-teal-400 bg-clip-text text-transparent">
                {systemColors.text}
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <>
              <div className="text-xs text-slate-400 mt-1">CRM System</div>
              <div className="mt-2 px-2 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-medium inline-block">
                {user.role}
              </div>
            </>
          )}
        </div>
        
        {/* Animated Background */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-teal-400 animate-pulse"></div>
        </div>
      </div>

      {/* Переключатель систем - для SUPER_ADMIN */}
      {user.role === 'SUPER_ADMIN' && !sidebarCollapsed && (
        <div className="p-3 border-b border-slate-700/50">
          <div className="text-xs text-slate-500 mb-2">Система</div>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/dashboard"
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-center ${
                currentSystem === 'TECHNOPRIME'
                  ? 'bg-gradient-to-r from-purple-600 to-teal-600 text-white shadow-lg'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <GamepadIcon className="w-3 h-3 inline mr-1" />
              TechPrime
            </Link>
            <Link
              href="/richmarket/dashboard"
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all text-center ${
                currentSystem === 'RICHMARKET'
                  ? 'bg-gradient-to-r from-pink-600 to-orange-600 text-white shadow-lg'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <Shirt className="w-3 h-3 inline mr-1" />
              RichMarket
            </Link>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
        {visibleMenu.map(m => {
          const Icon = m.icon;
          const active = pathname === m.href || (m.href !== '/dashboard' && pathname?.startsWith(m.href));
          
          return (
            <Link
              key={m.href}
              href={m.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition group relative ${
                active 
                  ? `bg-gradient-to-r ${m.gradient || systemColors.gradient} text-white shadow-lg transform scale-105` 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white hover:transform hover:scale-105'
              }`}
              title={sidebarCollapsed ? m.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              
              {!sidebarCollapsed && (
                <>
                  <span className="text-sm font-medium flex-1">{m.label}</span>
                  {m.badge && (
                    <span className="bg-gradient-to-r from-red-500 to-pink-600 text-white text-[10px] font-bold rounded-full px-2 py-0.5">
                      {m.badge}
                    </span>
                  )}
                </>
              )}

              {/* Tooltip for collapsed state */}
              {sidebarCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none">
                  {m.label}
                  {m.badge && (
                    <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1">
                      {m.badge}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-slate-700/50 space-y-2">
        {/* Уведомления */}
        <div className="relative">
          <button
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/30 hover:bg-slate-700/50 transition group"
            onClick={() => setNotifOpen(!notifOpen)}
            title={sidebarCollapsed ? 'Уведомления' : undefined}
            type="button"
          >
            <div className="relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-4 px-1 flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            
            {!sidebarCollapsed && (
              <>
                <span className="text-sm font-medium flex-1 text-left">Уведомления</span>
                <Volume2 className={`w-4 h-4 ${soundEnabled ? 'text-teal-400' : 'text-slate-600'}`} />
              </>
            )}

            {/* Tooltip for collapsed state */}
            {sidebarCollapsed && unreadCount > 0 && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none">
                {unreadCount} новых уведомлений
              </div>
            )}
          </button>

          {notifOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setNotifOpen(false)} 
                aria-hidden="true"
              />
              <div className={`absolute glass p-3 z-50 rounded-lg shadow-2xl border border-slate-700/50 ${
                sidebarCollapsed ? 'left-full ml-2 w-80' : 'left-0 right-0 mx-2 bottom-full mb-2'
              }`}>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700/50">
                  <div className="text-sm font-semibold">Уведомления</div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={toggleSound} 
                      className="p-1.5 rounded hover:bg-slate-700/50 transition"
                      title={soundEnabled ? 'Выключить звук' : 'Включить звук'}
                      type="button"
                    >
                      {soundEnabled ? 
                        <Volume2 className="w-4 h-4 text-teal-400" /> : 
                        <VolumeX className="w-4 h-4 text-slate-400" />
                      }
                    </button>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead} 
                        className="text-xs text-purple-400 hover:text-purple-300"
                        type="button"
                      >
                        Прочитать все
                      </button>
                    )}
                    {notifs.length > 0 && (
                      <button 
                        onClick={clearAll} 
                        className="text-xs text-rose-400 hover:text-rose-300"
                        type="button"
                      >
                        Очистить
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-96 overflow-auto space-y-2 custom-scrollbar">
                  {notifs.length === 0 ? (
                    <div className="text-slate-400 text-sm p-8 text-center">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <div>Нет уведомлений</div>
                    </div>
                  ) : (
                    notifs.map((n, i) => (
                      <div
                        key={n.id || i}
                        className={`p-3 rounded-lg transition cursor-pointer ${
                          n.read ? 'bg-slate-800/30 hover:bg-slate-700/50' : 'bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30'
                        }`}
                        onClick={() => {
                          if (!n.read) {
                            setNotifs(prev => prev.map((item, idx) => (idx === i ? { ...item, read: true } : item)));
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{n.title}</div>
                            {n.text && <div className="text-xs text-slate-400 mt-1">{n.text}</div>}
                            {n.createdAt && (
                              <div className="text-xs text-slate-500 mt-1">
                                {new Date(n.createdAt).toLocaleString('ru')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile */}
        <Link 
          href="/profile" 
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition group"
          title={sidebarCollapsed ? 'Профиль' : undefined}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-lg text-white font-bold text-sm">
            {name.charAt(0).toUpperCase()}
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{name}</div>
              <div className="text-xs text-slate-400 truncate">{user.login}</div>
            </div>
          )}

          {/* Tooltip for collapsed state */}
          {sidebarCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none">
              {name}
              <div className="text-xs text-slate-400">{user.login}</div>
            </div>
          )}
        </Link>

        {/* Settings */}
        <Link 
          href="/settings" 
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800/50 hover:text-white transition group"
          title={sidebarCollapsed ? 'Настройки' : undefined}
        >
          <Settings className="w-5 h-5" />
          {!sidebarCollapsed && <span className="text-sm font-medium">Настройки</span>}

          {/* Tooltip for collapsed state */}
          {sidebarCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none">
              Настройки
            </div>
          )}
        </Link>

        {/* Logout */}
        <button
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition group"
          onClick={logout}
          title={sidebarCollapsed ? 'Выйти' : undefined}
          type="button"
        >
          <LogOut className="w-5 h-5" />
          {!sidebarCollapsed && <span className="text-sm font-medium">Выйти</span>}

          {/* Tooltip for collapsed state */}
          {sidebarCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none">
              Выйти
            </div>
          )}
        </button>
      </div>

      {/* Version */}
      {!sidebarCollapsed && (
        <div className="px-3 py-2 border-t border-slate-700/50">
          <div className="text-xs text-slate-500 text-center">
            v2.1.0 • TechnoPrime CRM
          </div>
        </div>
      )}
    </div>
  );
}