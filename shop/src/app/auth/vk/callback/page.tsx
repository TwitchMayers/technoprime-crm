'use client';

import { useEffect, useRef } from 'react';

function parseHashParams(hash: string) {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  return new URLSearchParams(raw);
}

export default function VkCallbackPage() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const goAccount = (status: string) => {
      window.location.replace(`/account?vk_status=${encodeURIComponent(status)}`);
    };

    const query = new URLSearchParams(window.location.search || '');
    const queryCode = String(query.get('code') || '').trim();
    const queryState = String(query.get('state') || '').trim();
    if (queryCode && queryState) {
      const url = new URL('/api/auth/vk/callback', window.location.origin);
      url.searchParams.set('code', queryCode);
      url.searchParams.set('state', queryState);
      window.location.replace(url.toString());
      return;
    }

    const params = parseHashParams(window.location.hash || '');
    const error = String(params.get('error') || '').trim();
    if (error) {
      goAccount('vk_error');
      return;
    }

    const accessToken = String(params.get('access_token') || '').trim();
    const state = String(params.get('state') || '').trim();
    if (!accessToken || !state) {
      goAccount('vk_error');
      return;
    }

    void fetch('/api/auth/vk/callback-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, state }),
      cache: 'no-store',
    })
      .then(res => res.json().catch(() => null))
      .then(data => {
        const status = String(data?.vkStatus || '').trim() || 'vk_error';
        goAccount(status);
      })
      .catch(() => goAccount('vk_error'));
  }, []);

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-cyan-200/20 bg-slate-950/70 p-6 text-center backdrop-blur">
        <p className="text-sm text-slate-300">Завершаем вход через VK...</p>
      </div>
    </div>
  );
}
