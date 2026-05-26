'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, GlassCard } from '@technoprime/ui';
import { claimOrderLink } from '@/lib/shop-api';

export default function OrderLinkClient({ token }: { token: string }) {
  const [status, setStatus] = useState<'loading' | 'need-login' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Проверяем ссылку привязки заказа...');

  const claim = async () => {
    if (!token) return;
    setStatus('loading');
    setMessage('Привязываем заказ к вашему личному кабинету...');
    try {
      await claimOrderLink(token);
      setStatus('success');
      setMessage('Заказ привязан к вашему личному кабинету.');
    } catch (error: any) {
      const text = String(error?.message || '');
      if (text.toLowerCase().includes('войдите') || text.toLowerCase().includes('unauthorized')) {
        setStatus('need-login');
        setMessage('Войдите или зарегистрируйтесь по телефону, затем вернитесь на эту страницу и нажмите кнопку привязки.');
        return;
      }
      setStatus('error');
      setMessage(text || 'Не удалось привязать заказ. Возможно, ссылка уже использована или устарела.');
    }
  };

  useEffect(() => {
    void claim();
  }, [token]);

  return (
    <main className="min-h-screen bg-[#071321] px-4 py-16 text-white">
      <div className="mx-auto max-w-xl">
        <GlassCard className="space-y-5 p-6 sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">TechnoPrime</p>
            <h1 className="mt-3 text-3xl font-bold">Привязка заказа</h1>
          </div>

          <p className="text-slate-300">{message}</p>

          {status === 'loading' ? (
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-cyan-400" />
            </div>
          ) : null}

          {status === 'need-login' ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/account" className="w-full sm:w-auto">
                <Button className="w-full">Войти или зарегистрироваться</Button>
              </Link>
              <Button variant="secondary" onClick={() => void claim()} className="w-full sm:w-auto">
                Я уже вошёл, привязать
              </Button>
            </div>
          ) : null}

          {status === 'success' ? (
            <Link href="/account#orders-history">
              <Button>Открыть личный кабинет</Button>
            </Link>
          ) : null}

          {status === 'error' ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="secondary" onClick={() => void claim()} className="w-full sm:w-auto">
                Попробовать ещё раз
              </Button>
              <Link href="/account" className="w-full sm:w-auto">
                <Button className="w-full">Открыть личный кабинет</Button>
              </Link>
            </div>
          ) : null}
        </GlassCard>
      </div>
    </main>
  );
}
