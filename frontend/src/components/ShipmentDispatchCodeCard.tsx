'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Barcode, CheckCircle2, Copy, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { formatRuDateTime } from '@/lib/logistics-ui';

type Props = {
  barcode?: string | null;
  trackingNumber?: string | null;
  externalOrderNumber?: string | null;
  senderPoint?: string | null;
  receiverPoint?: string | null;
  syncMode?: string | null;
  lastSyncedAt?: string | null;
  compact?: boolean;
};

function cleanValue(value?: string | null) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || null;
}

function badgeTone(kind: 'official' | 'manual' | 'derived') {
  if (kind === 'official') {
    return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
  }
  if (kind === 'manual') {
    return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100';
  }
  return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
}

export default function ShipmentDispatchCodeCard({
  barcode,
  trackingNumber,
  externalOrderNumber,
  senderPoint,
  receiverPoint,
  syncMode,
  lastSyncedAt,
  compact = false,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  const meta = useMemo(() => {
    const officialCode = cleanValue(barcode);
    const tracking = cleanValue(trackingNumber);
    const externalOrder = cleanValue(externalOrderNumber);
    const sender = cleanValue(senderPoint);
    const receiver = cleanValue(receiverPoint);
    const normalizedSyncMode = String(syncMode || '').toUpperCase();

    if (officialCode) {
      if (normalizedSyncMode === 'API') {
        return {
          value: officialCode,
          sourceKind: 'official' as const,
          sourceLabel: 'Официальный код Avito',
          note:
            'Код получен из интеграции Avito и может использоваться сотрудником CRM при сдаче отправления.',
          sender,
          receiver,
          lastSyncedAt: cleanValue(lastSyncedAt),
        };
      }

      return {
        value: officialCode,
        sourceKind: 'manual' as const,
        sourceLabel: 'Код внесён сотрудником',
        note:
          'Если код переписан из кабинета площадки, его обычно можно показать в пункте выдачи. Если код составлен вручную, приём в ПВЗ НУЖНО ПОДТВЕРДИТЬ.',
        sender,
        receiver,
        lastSyncedAt: cleanValue(lastSyncedAt),
      };
    }

    if (tracking) {
      return {
        value: tracking,
        sourceKind: 'derived' as const,
        sourceLabel: 'CRM-код по номеру отправления',
        note:
          'Это внутренний сканируемый код CRM. Для выдачи именно по правилам Avito предпочтителен официальный код отправки из интеграции.',
        sender,
        receiver,
        lastSyncedAt: cleanValue(lastSyncedAt),
      };
    }

    if (externalOrder) {
      return {
        value: externalOrder,
        sourceKind: 'derived' as const,
        sourceLabel: 'CRM-код по номеру заказа площадки',
        note:
          'Этот код помогает курьеру и менеджеру быстро открыть отправление в CRM. Для ПВЗ его приём НУЖНО ПОДТВЕРДИТЬ, пока не подтянется официальный код.',
        sender,
        receiver,
        lastSyncedAt: cleanValue(lastSyncedAt),
      };
    }

    return null;
  }, [barcode, externalOrderNumber, lastSyncedAt, receiverPoint, senderPoint, syncMode, trackingNumber]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !meta?.value) {
      return;
    }

    try {
      JsBarcode(svg, meta.value, {
        format: 'CODE128',
        background: '#ffffff',
        lineColor: '#020617',
        displayValue: false,
        margin: compact ? 10 : 14,
        flat: true,
        width: compact ? 1.6 : 2,
        height: compact ? 58 : 86,
      });
      setBarcodeError(null);
    } catch (error) {
      setBarcodeError('Не удалось построить сканируемый штрихкод для этого значения.');
    }
  }, [compact, meta]);

  const handleCopy = async () => {
    if (!meta?.value) return;
    try {
      await navigator.clipboard.writeText(meta.value);
      toast.success('Код отправки скопирован');
    } catch {
      toast.error('Не удалось скопировать код');
    }
  };

  if (!meta) {
    return (
      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
        Пока нет кода отправки. Добавьте официальный код площадки, номер отправления или номер заказа площадки.
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/35 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Barcode className="h-4 w-4 text-cyan-300" />
            Код отправки
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-400">
            {meta.sourceKind === 'official'
              ? 'Показывается сотруднику CRM для сдачи заказа в пункте.'
              : 'Служебный код для быстрого поиска, показа курьеру и ручной логистики.'}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <span
            className={`inline-flex max-w-full items-center justify-center rounded-full border px-2.5 py-1 text-center text-[10px] font-bold uppercase tracking-[0.12em] ${badgeTone(meta.sourceKind)}`}
          >
            {meta.sourceLabel}
          </span>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-slate-700/70 bg-slate-950/55 px-3 text-xs font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800/80 sm:w-auto"
          >
            <Copy className="h-3.5 w-3.5" />
            Копировать
          </button>
        </div>
      </div>

      <div className="mt-3 min-w-0 overflow-hidden rounded-2xl bg-white p-3 shadow-inner sm:p-4">
        {barcodeError ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{barcodeError}</span>
          </div>
        ) : (
          <div className="min-w-0 overflow-hidden">
            <svg
              ref={svgRef}
              className="block h-auto max-w-full overflow-hidden"
              role="img"
              aria-label="Штрихкод отправки"
            />
          </div>
        )}

        <div className="mt-3 break-all rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-semibold text-slate-900 sm:text-sm">
          {meta.value}
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2 sm:text-sm">
        <div className="min-w-0 rounded-xl border border-slate-700/60 bg-slate-950/35 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">Пункт отправки</div>
          <div className="mt-1.5 break-words text-white">{meta.sender || 'Не указан'}</div>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-700/60 bg-slate-950/35 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">Пункт получения</div>
          <div className="mt-1.5 break-words text-white">{meta.receiver || 'Не указан'}</div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-start gap-2 rounded-xl border border-slate-700/60 bg-slate-950/35 px-3 py-2.5 text-xs leading-5 text-slate-300 sm:text-sm">
          {meta.sourceKind === 'official' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          ) : (
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          )}
          <span>{meta.note}</span>
        </div>

        {meta.lastSyncedAt ? (
          <div className="text-[11px] text-slate-500 sm:text-xs">
            Последняя синхронизация: {formatRuDateTime(meta.lastSyncedAt)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
