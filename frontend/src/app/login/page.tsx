'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const { user, login, loading: authLoading, isAuthenticated } = useAuth();
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [forceShowLogin, setForceShowLogin] = useState(false);

  // ✅ Редирект если уже авторизован
  useEffect(() => {
    if (isAuthenticated && user) {
      setLeaving(true);
      const timerId = window.setTimeout(() => {
        router.replace(user.role === 'MANAGER' ? '/profile' : '/analytics');
      }, 600);
      return () => window.clearTimeout(timerId);
    }
  }, [isAuthenticated, user, router]);

  // Восстанавливаем сохраненный логин
  useEffect(() => {
    const savedLogin = localStorage.getItem('remember_login');
    if (savedLogin) {
      setLoginInput(savedLogin);
    }
  }, []);

  useEffect(() => {
    if (!authLoading || isAuthenticated) {
      setForceShowLogin(false);
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setForceShowLogin(true);
    }, 1800);

    return () => window.clearTimeout(timerId);
  }, [authLoading, isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginInput || !password) {
      alert('Введите логин и пароль');
      return;
    }

    setLoading(true);

    try {
      // ✅ Используем метод login из AuthContext
      await login(loginInput, password);
      
      if (remember) {
        localStorage.setItem('remember_login', loginInput);
      } else {
        localStorage.removeItem('remember_login');
      }

      // Анимация выхода запускается в useEffect выше
    } catch (err: any) {
      setLoading(false);
    }
  };

  if (authLoading && !forceShowLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <span className="text-sm text-neutral-400">Проверка сессии...</span>
          <button
            type="button"
            onClick={() => setForceShowLogin(true)}
            className="text-xs text-indigo-300/90 hover:text-indigo-200 underline underline-offset-4"
          >
            Открыть форму входа
          </button>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <span className="text-sm text-neutral-400">Перенаправление в рабочий раздел...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
      {/* Ambient background */}
      <div className="absolute inset-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-600/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* LOGIN CARD */}
      <AnimatePresence>
        {!leaving && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, filter: 'blur(6px)' }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="relative z-10 w-full max-w-sm"
          >
            <div className="relative rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl shadow-[0_0_80px_-20px_rgba(99,102,241,0.4)] p-8">
              {/* Header */}
              <div className="mb-8 text-center">
                <h1 className="text-3xl font-semibold tracking-tight bg-gradient-to-r from-indigo-400 to-teal-400 bg-clip-text text-transparent">
                  TechnoPrime
                </h1>
                <p className="mt-2 text-sm text-neutral-500">
                  Вход в систему
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Login */}
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-indigo-400 transition" />
                  <input
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    disabled={loading}
                    autoComplete="username"
                    placeholder="Логин"
                    className="w-full rounded-lg bg-neutral-900/70 border border-neutral-800 px-10 py-2.5 text-sm text-white placeholder-neutral-600 outline-none transition
                      focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>

                {/* Password */}
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-indigo-400 transition" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                    placeholder="Пароль"
                    className="w-full rounded-lg bg-neutral-900/70 border border-neutral-800 px-10 pr-10 py-2.5 text-sm text-white placeholder-neutral-600 outline-none transition
                      focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Remember */}
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <button
                    type="button"
                    onClick={() => setRemember(v => !v)}
                    className={`w-4 h-4 rounded border transition flex items-center justify-center
                      ${remember
                        ? 'bg-indigo-600 border-indigo-500'
                        : 'border-neutral-600'
                      }`}
                  >
                    {remember && (
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    )}
                  </button>
                  Запомнить логин
                </div>

                {/* Button */}
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  whileHover={{ boxShadow: '0 0 0 6px rgba(99,102,241,0.15)' }}
                  disabled={loading}
                  className="relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-indigo-600 to-teal-600 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                  type="submit"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Войти
                  </span>
                </motion.button>
              </form>
            </div>

            <div className="mt-6 text-center text-xs text-neutral-600">
              © {new Date().getFullYear()} TechnoPrime
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEAVING OVERLAY */}
      <AnimatePresence>
        {leaving && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-4"
            >
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <span className="text-sm text-neutral-400">
                Вход в систему…
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
