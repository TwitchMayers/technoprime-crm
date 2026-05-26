'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import MobilePageHeader from '@/components/MobilePageHeader';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

type Task = {
  id: number;
  title: string;
  type: string;
  status: 'NEW' | 'IN_PROGRESS' | 'DONE';
  dueDate: string;
  comment: string;
  assignedToId: number;
  assignedTo?: { id: number; name: string };
  acceptedBy?: { id: number; name: string };
  acceptedAt?: string | null;
  orderId?: number;
  createdAt: string;
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<'current' | 'completed'>('current');
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);

  const refreshTasks = async (showSuccessToast = false) => {
    try {
      if (showSuccessToast) {
        setRefetching(true);
      } else {
        setLoading(true);
      }

      const data = await fetchWithAuth('/api/tasks');
      setTasks(Array.isArray(data) ? data : []);

      if (showSuccessToast) {
        toast.success('Задачи обновлены');
      }
    } catch (error) {
      console.error('Failed to refresh tasks:', error);
      toast.error(showSuccessToast ? 'Ошибка обновления задач' : 'Ошибка загрузки задач');
      setTasks([]);
    } finally {
      setLoading(false);
      setRefetching(false);
    }
  };

  // Load tasks list on mount
  useEffect(() => {
    void refreshTasks(false);
  }, []);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      NEW: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      IN_PROGRESS: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      DONE: 'bg-green-500/20 text-green-400 border-green-500/30',
    };
    return colors[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      NEW: <AlertCircle className="w-4 h-4" />,
      IN_PROGRESS: <Clock className="w-4 h-4" />,
      DONE: <CheckCircle className="w-4 h-4" />,
    };
    return icons[status] || null;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      NEW: 'Новая',
      IN_PROGRESS: 'В работе',
      DONE: 'Завершена',
    };
    return labels[status] || status;
  };

  const currentTasks = tasks.filter((task) => task.status !== 'DONE');
  const completedTasks = tasks.filter((task) => task.status === 'DONE');
  const visibleTasks = view === 'completed' ? completedTasks : currentTasks;

  // Loading state
  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'TECHNICAL_SPECIALIST']}>
        <div className="flex items-center justify-center min-h-screen bg-slate-950">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <div className="text-slate-400 font-medium">Загрузка задач...</div>
          </motion.div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'TECHNICAL_SPECIALIST']}>
      <div className="space-y-3 pb-8 md:space-y-5 md:pb-10">
        <MobilePageHeader title="Задачи" subtitle="Очередь задач и история выполнения" sticky={false} />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-900/40 p-3 sm:p-4 md:flex md:items-center md:justify-between md:space-y-0"
        >
          <div>
            <h1 className="text-2xl font-bold text-white md:mb-2 md:text-4xl">Задачи</h1>
            <p className="text-xs text-slate-400 md:text-base">
              {visibleTasks.length} {visibleTasks.length === 1 ? 'задача' : visibleTasks.length < 5 ? 'задачи' : 'задач'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:gap-3 md:min-w-[22rem]">
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-700/60 bg-slate-900/50 p-1">
              <button
                type="button"
                onClick={() => setView('current')}
                className={`rounded-lg px-2 py-2 text-[12px] font-semibold transition sm:px-4 sm:text-sm ${
                  view === 'current'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Текущие ({currentTasks.length})
              </button>
              <button
                type="button"
                onClick={() => setView('completed')}
                className={`rounded-lg px-2 py-2 text-[12px] font-semibold transition sm:px-4 sm:text-sm ${
                  view === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Завершённые ({completedTasks.length})
              </button>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => void refreshTasks(true)}
              disabled={refetching}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-600/20 px-4 py-2 text-sm font-semibold text-cyan-400 transition-all hover:bg-cyan-600/30 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
            >
              {refetching ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full"></div>
                  Обновление...
                </>
              ) : (
                <>
                  ↻ Обновить
                </>
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Empty state */}
        {visibleTasks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400 font-medium mb-2">
              {view === 'completed' ? 'Нет завершённых задач' : 'Нет текущих задач'}
            </p>
            <p className="text-slate-500 text-sm">
              {view === 'completed'
                ? 'История завершений пока пуста'
                : 'Все текущие задачи уже обработаны'}
            </p>
          </motion.div>
        ) : (
          /* Tasks grid */
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {visibleTasks.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => router.push(`/tasks/${task.id}`)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 p-4 transition-all hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 sm:p-6"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/5 via-transparent to-blue-600/5 pointer-events-none group-hover:from-cyan-600/10 group-hover:to-blue-600/10 transition-all"></div>

                <div className="relative z-10">
                  {/* Title and status */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-2">
                        {task.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {task.type} • ID: {task.id}
                      </p>
                    </div>
                    <div
                      className={`flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1 text-[11px] font-semibold sm:px-3 sm:text-xs ${getStatusColor(
                        task.status
                      )}`}
                    >
                      {getStatusIcon(task.status)}
                      {getStatusLabel(task.status)}
                    </div>
                  </div>

                  {/* Comment */}
                  {task.comment && (
                    <p className="text-sm text-slate-300 mb-4 line-clamp-2">
                      {task.comment}
                    </p>
                  )}

                  {/* Meta info */}
                  <div className="space-y-2 text-xs text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>Дата исполнения:</span>
                      <span className="text-slate-200 font-medium">
                        {new Date(task.dueDate).toLocaleDateString('ru-RU', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Исполнитель:</span>
                      <span className="text-slate-200 font-medium text-right">
                        {task.status === 'NEW'
                          ? 'Ожидает принятия'
                          : task.acceptedBy?.name || task.assignedTo?.name || 'Не назначена'}
                      </span>
                    </div>
                    {task.acceptedAt ? (
                      <div className="flex items-center justify-between">
                        <span>Принята:</span>
                        <span className="text-slate-300">
                          {new Date(task.acceptedAt).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Hover indicator */}
                  <div className="mt-4 border-t border-slate-700/50 pt-4 text-center text-xs text-slate-500 transition-colors group-hover:text-slate-400">
                    Открыть задачу
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
