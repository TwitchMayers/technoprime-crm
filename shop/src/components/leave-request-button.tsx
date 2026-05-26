'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@technoprime/ui';
import { submitLeaveLead } from '@/lib/shop-api';
import { trackEvent } from '@/lib/analytics';
import {
  formatPhoneInput,
  getRussianMobilePhoneError,
  isValidRussianMobilePhone,
  normalizePhoneDigits,
} from '@/lib/phone';

type Props = {
  productId: number;
  productName: string;
  defaultPhone?: string;
  analyticsLocation?: string;
  className?: string;
};

type SessionUser = {
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  deliveryCity?: string | null;
  deliveryAddress?: string | null;
};

export function LeaveRequestButton({
  productId,
  productName,
  defaultPhone = '',
  analyticsLocation = 'product_card',
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone: formatPhoneInput(defaultPhone),
    city: '',
    address: '',
    comment: '',
  });

  const normalizedPhone = useMemo(() => normalizePhoneDigits(form.phone), [form.phone]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const loadPrefill = async () => {
      setPrefillLoading(true);
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = await res.json().catch(() => ({ user: null })) as { user?: SessionUser | null };
        const user = data?.user || null;
        if (cancelled || !user) return;

        const nextName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
        setForm(current => ({
          name: current.name || nextName,
          phone:
            current.phone ||
            (user.phone ? formatPhoneInput(String(user.phone)) : formatPhoneInput(defaultPhone)),
          city: current.city || String(user.deliveryCity || ''),
          address: current.address || String(user.deliveryAddress || ''),
          comment: current.comment,
        }));
      } catch {
        // ignore prefill errors, modal should remain usable
      } finally {
        if (!cancelled) {
          setPrefillLoading(false);
        }
      }
    };

    void loadPrefill();
    return () => {
      cancelled = true;
    };
  }, [defaultPhone, open]);

  const submit = async () => {
    const phoneError = getRussianMobilePhoneError(form.phone);
    if (phoneError) {
      setResult(phoneError);
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await submitLeaveLead({
        productId,
        name: form.name.trim() || undefined,
        phone: form.phone,
        city: form.city,
        address: form.address,
        comment: form.comment,
      });
      if (res?.success) {
        trackEvent('form_submit', {
          form: 'leave_request',
          product_id: productId,
          product_name: productName,
        });
        setResult('Заявка отправлена. Менеджер свяжется с вами.');
        window.setTimeout(() => {
          setOpen(false);
          setResult(null);
        }, 900);
      } else {
        setResult(res?.message || 'Не удалось отправить заявку');
      }
    } catch (error: any) {
      setResult(error?.message || 'Не удалось отправить заявку. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
        data-analytics-click="leave_request_open"
        data-analytics-location={analyticsLocation}
        data-analytics-product={productName}
      >
        Оставить заявку
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-5">
            <div className="mb-4">
              <div className="text-lg font-semibold text-white">Заявка на товар</div>
              <div className="text-sm text-slate-400">{productName}</div>
            </div>
            <div className="space-y-3">
              <input
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
                placeholder="Имя"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              />
              <input
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
                placeholder="+7 (9XX) XXX-XX-XX"
                value={form.phone}
                inputMode="tel"
                autoComplete="tel"
                onChange={(e) => setForm((s) => ({ ...s, phone: formatPhoneInput(e.target.value) }))}
              />
              <input
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
                placeholder="Город"
                value={form.city}
                onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
              />
              <textarea
                className="min-h-20 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
                placeholder="Адрес"
                value={form.address}
                onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
              />
              <textarea
                className="min-h-16 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
                placeholder="Комментарий"
                value={form.comment}
                onChange={(e) => setForm((s) => ({ ...s, comment: e.target.value }))}
              />
            </div>
            {!result && prefillLoading ? (
              <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                Подтягиваем данные из профиля...
              </div>
            ) : null}
            {!result && normalizedPhone && !isValidRussianMobilePhone(form.phone) ? (
              <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                Введите действующий мобильный номер в формате +7 (9XX) XXX-XX-XX.
              </div>
            ) : null}
            {result ? (
              <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                {result}
              </div>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
                Закрыть
              </Button>
              <Button
                onClick={submit}
                disabled={loading}
                data-analytics-click="leave_request_submit"
                data-analytics-location="leave_request_modal"
                data-analytics-product={productName}
              >
                {loading ? 'Отправка...' : 'Отправить'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
