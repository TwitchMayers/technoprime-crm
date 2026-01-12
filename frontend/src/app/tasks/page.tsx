'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
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
  orderId?: number;
  createdAt: string;
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);

  // Load tasks list on mount
  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth('/api/tasks');
      setTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error('Ошибка загрузки задач');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefetching(true);
      const data = await fetchWithAuth('/api/tasks');
      setTasks(Array.isArray(data) ? data : []);
      toast.success('Задачи обновлены');
    } catch (error) {
      console.error('Failed to refresh tasks:', error);
      toast.error('Ошибка обновления задач');
    } finally {
      setRefetching(false);
    }
  };

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
      <div className="min-h-screen bg-slate-950 p-4 md:p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Задачи</h1>
            <p className="text-slate-400">
              {tasks.length} {tasks.length === 1 ? 'задача' : tasks.length < 5 ? 'задачи' : 'задач'}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={refetching}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-400 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
        </motion.div>

        {/* Empty state */}
        {tasks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400 font-medium mb-2">Нет задач</p>
            <p className="text-slate-500 text-sm">Все задачи выполнены или созданы ещё не были</p>
          </motion.div>
        ) : (
          /* Tasks grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tasks.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => router.push(`/tasks/${task.id}`)}
                className="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur p-6 cursor-pointer hover:border-cyan-500/50 transition-all hover:shadow-lg hover:shadow-cyan-500/10"
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
                      className={`flex items-center gap-2 px-3 py-1 rounded-lg border font-semibold text-xs whitespace-nowrap flex-shrink-0 ${getStatusColor(
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
                      <span>Назначена на:</span>
                      <span className="text-slate-200 font-medium">
                        {task.assignedTo?.name || 'Не назначена'}
                      </span>
                    </div>
                  </div>

                  {/* Hover indicator */}
                  <div className="mt-4 pt-4 border-t border-slate-700/50 text-xs text-slate-500 group-hover:text-slate-400 transition-colors text-center">
                    👆 Нажмите для подробнее
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