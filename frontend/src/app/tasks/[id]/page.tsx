'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, CheckCircle, AlertCircle, User, Phone, Mail, Play, Check } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import TaskDetailsModal from '../TaskDetailsModal';
import { useAuth } from '@/contexts/AuthContext';

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
  clientId?: number;
  client?: { id: number; name: string; phone: string; email?: string };
  orderId?: number;
  order?: {
    id: number;
    totalPrice: string;
    status: string;
    source?: 'STORE' | 'MANUAL';
    reserveUntil?: string | null;
    paymentMethod?: string;
    comment?: string | null;
    client?: { id: number; name: string; phone: string; email?: string };
  };
  createdAt: string;
};

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params?.id ? Number(params.id) : null;

  const { user } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [extendLoading, setExtendLoading] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!taskId || Number.isNaN(taskId)) {
      setLoading(false);
      return;
    }

    loadTask();
  }, [taskId]);

  const loadTask = async () => {
    try {
      setLoading(true);
      const taskData = await fetchWithAuth(`tasks/${taskId}`);
      
      if (!taskData) {
        toast.error('Задача не найдена');
        setTask(null);
        return;
      }

      const normalizedTask: Task = {
        ...(taskData as Task),
        client: taskData.client || taskData.order?.client || undefined,
      };

      setTask(normalizedTask);
    } catch (error) {
      console.error('Failed to load task:', error);
      toast.error('Ошибка загрузки задачи');
      setTask(null);
    } finally {
      setLoading(false);
    }
  };

  // Accept task and assign order
  const acceptTask = async () => {
    if (!task?.id) {
      toast.error('Задача не загружена');
      return;
    }

    if (!task?.orderId) {
      toast.error('У этой задачи нет связанного заказа');
      return;
    }

    if (!user?.id) {
      toast.error('Ошибка авторизации. Пожалуйста, перезагрузитесь');
      // ❌ УБРАЛ router.push('/login') - AuthContext это сделает
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetchWithAuth(
        `orders/${task.orderId}/assign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assigneeId: user.id,
          }),
        }
      );

      if (!response) {
        throw new Error('Empty response from server');
      }

      toast.success('Заказ назначен вам');
      
      // Update task status
      await updateTaskStatus('IN_PROGRESS', true);
    } catch (error) {
      console.error('Failed to assign order:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      toast.error(`Ошибка назначения: ${errorMessage}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Complete task
  const completeTask = async () => {
    if (!task?.id) {
      toast.error('Задача не загружена');
      return;
    }

    setActionLoading(true);
    try {
      await updateTaskStatus('DONE');
      
      toast.success('Задача завершена');
      
      // Редирект на список задач
      setTimeout(() => {
        router.push('/tasks');
      }, 1500);
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast.error('Ошибка завершения задачи');
    } finally {
      setActionLoading(false);
    }
  };

  // Update task status
  const updateTaskStatus = async (
    newStatus: 'NEW' | 'IN_PROGRESS' | 'DONE',
    acceptTask = false,
  ) => {
    if (!taskId) return;

    try {
      const response = await fetchWithAuth(`tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          comment: task?.comment || '',
          accept: acceptTask,
        }),
      });

      if (!response) {
        throw new Error('Empty response from server');
      }

      setTask(response);
      
      return response;
    } catch (error) {
      console.error('Failed to update task status:', error);
      toast.error('Ошибка обновления статуса');
      throw error;
    }
  };

  // Utility functions
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

  const extendReserve = async (minutes: 15 | 30) => {
    if (!task?.order?.id) return;

    setExtendLoading(minutes);
    try {
      await fetchWithAuth(`orders/${task.order.id}/extend-reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes }),
      });
      toast.success(`Бронь продлена на ${minutes} минут`);
      await loadTask();
    } catch (error: any) {
      console.error('Failed to extend reserve:', error);
      toast.error(error?.message || 'Не удалось продлить бронь');
    } finally {
      setExtendLoading(null);
    }
  };

  const reserveActive =
    Boolean(task?.order?.source === 'STORE' && task?.order?.status === 'NEW' && task?.order?.reserveUntil) &&
    new Date(String(task?.order?.reserveUntil)).getTime() > Date.now();

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
            <div className="text-slate-400 font-medium">Загрузка задачи...</div>
          </motion.div>
        </div>
      </ProtectedRoute>
    );
  }

  // Not found state
  if (!task) {
    return (
      <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'TECHNICAL_SPECIALIST']}>
        <div className="min-h-screen bg-slate-950 p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-4 font-medium transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Назад к задачам
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">Задача не найдена</p>
            <p className="text-slate-500 text-sm mt-2">ID задачи: {taskId}</p>
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
          className="mb-6"
        >
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-4 font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Назад к задачам
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* Task header card */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur p-6">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/5 via-transparent to-blue-600/5 pointer-events-none"></div>

              <div className="relative z-10">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-white mb-2 line-clamp-2">
                      {task.title}
                    </h1>
                    <p className="text-slate-400 text-sm">
                      {task.type} • ID: {task.id}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-semibold text-sm whitespace-nowrap ${getStatusColor(
                      task.status
                    )}`}
                  >
                    {getStatusIcon(task.status)}
                    {getStatusLabel(task.status)}
                  </div>
                </div>

                {/* Comment */}
                {task.comment && (
                  <div className="mt-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <p className="text-sm text-slate-300 line-clamp-3">
                      {task.comment}
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 mt-6">
                  {task.status === 'NEW' && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={acceptTask}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-bold text-sm transition-all"
                      type="button"
                    >
                      <Play className="w-4 h-4" />
                      {actionLoading ? 'Назначение...' : 'Принять и начать'}
                    </motion.button>
                  )}

                  {task.status === 'IN_PROGRESS' && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={completeTask}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-bold text-sm transition-all"
                      type="button"
                    >
                      <Check className="w-4 h-4" />
                      {actionLoading ? 'Завершение...' : 'Завершить'}
                    </motion.button>
                  )}

                  {task.status === 'DONE' && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 font-bold text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Задача завершена
                    </div>
                  )}

                  {reserveActive ? (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => void extendReserve(15)}
                        disabled={extendLoading !== null}
                        className="flex items-center gap-2 px-4 py-3 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 font-bold text-sm transition-all disabled:opacity-60"
                        type="button"
                      >
                        {extendLoading === 15 ? 'Продлеваем...' : '+15 минут брони'}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => void extendReserve(30)}
                        disabled={extendLoading !== null}
                        className="flex items-center gap-2 px-4 py-3 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 font-bold text-sm transition-all disabled:opacity-60"
                        type="button"
                      >
                        {extendLoading === 30 ? 'Продлеваем...' : '+30 минут брони'}
                      </motion.button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Order card */}
            {task.order && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur p-6 cursor-pointer hover:border-cyan-500/50 transition-all group"
                onClick={() => setModalOpen(true)}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-600/5 via-transparent to-orange-600/5 pointer-events-none group-hover:from-amber-600/10 group-hover:to-orange-600/10 transition-all"></div>

                <div className="relative z-10">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-cyan-400" />
                    Связанный заказ
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Номер заказа</p>
                      <p className="text-2xl font-bold text-white">
                        #{task.order.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Сумма</p>
                      <p className="text-2xl font-bold text-cyan-400">
                        {Number(task.order.totalPrice).toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs text-slate-400 mb-1">Клиент</p>
                      <p className="text-lg font-semibold text-white">
                        {task.order.client?.name}
                      </p>
                      <p className="text-sm text-slate-400">
                        {task.order.client?.phone}
                      </p>
                    </div>
                    {reserveActive ? (
                      <div className="md:col-span-2">
                        <p className="text-xs text-slate-400 mb-1">Бронь до</p>
                        <p className="text-sm font-semibold text-sky-300">
                          {new Date(String(task.order.reserveUntil)).toLocaleString('ru-RU')}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                    Нажмите для подробнее
                  </p>
                </div>
              </motion.div>
            )}

            {/* No order warning */}
            {!task.order && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative overflow-hidden rounded-2xl border border-amber-700/50 bg-amber-500/5 p-6"
              >
                <div className="relative z-10 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <p className="text-amber-200 text-sm">
                    У этой задачи нет связанного заказа
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Task info card */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur p-6">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-600/5 via-transparent to-slate-600/5 pointer-events-none"></div>

              <div className="relative z-10 space-y-4">
                <div>
                  <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide font-semibold">
                    Статус
                  </p>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border font-semibold text-sm justify-center ${getStatusColor(
                      task.status
                    )}`}
                  >
                    {getStatusIcon(task.status)}
                    {getStatusLabel(task.status)}
                  </div>
                </div>

                <div className="h-px bg-slate-700/50"></div>

                <div>
                  <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide font-semibold">
                    Дата исполнения
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {new Date(task.dueDate).toLocaleDateString('ru-RU', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                <div className="h-px bg-slate-700/50"></div>

                <div>
                  <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide font-semibold">
                    Назначена на
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {task.status === 'NEW' ? (
                      'Ожидает принятия (админ/техник)'
                    ) : task.assignedTo?.name || (
                      <span className="text-slate-500">Не назначена</span>
                    )}
                  </p>
                </div>

                <div className="h-px bg-slate-700/50"></div>

                <div>
                  <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide font-semibold">
                    Принял задачу
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {task.acceptedBy?.name || (task.status === 'NEW' ? 'Ещё не принята' : 'Не зафиксировано')}
                  </p>
                  {task.acceptedAt ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(task.acceptedAt).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  ) : null}
                </div>

                <div className="h-px bg-slate-700/50"></div>

                <div>
                  <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide font-semibold">
                    Создана
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(task.createdAt).toLocaleString('ru-RU', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Client info card */}
            {task.client && (
              <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur p-6">
                <div className="absolute inset-0 bg-gradient-to-br from-green-600/5 via-transparent to-emerald-600/5 pointer-events-none"></div>

                <div className="relative z-10">
                  <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-cyan-400" />
                    Клиент
                  </h4>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide font-semibold">
                        Имя
                      </p>
                      <p className="font-semibold text-white">
                        {task.client.name}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide font-semibold">
                        Телефон
                      </p>
                      <a
                        href={`tel:${task.client.phone}`}
                        className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-semibold text-sm transition-colors"
                      >
                        <Phone className="w-4 h-4" />
                        {task.client.phone}
                      </a>
                    </div>

                    {task.client.email && (
                      <div>
                        <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide font-semibold">
                          Email
                        </p>
                        <a
                          href={`mailto:${task.client.email}`}
                          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-semibold text-sm transition-colors break-all"
                        >
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          {task.client.email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* No client warning */}
            {!task.client && (
              <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 p-6">
                <p className="text-slate-500 text-sm text-center">
                  Информация о клиенте недоступна
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Order Details Modal */}
        {task.orderId && (
          <TaskDetailsModal
            orderId={task.orderId}
            open={modalOpen}
            onClose={() => setModalOpen(false)}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
