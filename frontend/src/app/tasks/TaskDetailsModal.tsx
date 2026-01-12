'use client';

import { useEffect, useState } from 'react';
import { X, User, Phone, MapPin, Package } from 'lucide-react';

type ProductLike = { name?:string; serialNumber?:string; category?:string; brand?:string; model?:string };
type OrderItem = { qty:number; product?:ProductLike };
type Order = {
  id:number;
  status?:string;
  date?:string;
  client?: { name?:string; phone?:string; city?:string; address?:string };
  items?:OrderItem[];
};

export default function TaskDetailsModal({ orderId, open, onClose }:{
  orderId:number; open:boolean; onClose:()=>void;
}) {
  const [data, setData] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !orderId) return;
    setLoading(true);
    fetch(`/api/orders/${orderId}`, { cache:'no-store' })
      .then(async (r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, orderId]);

  if (!open) return null;

  const serial = (p?:ProductLike) => p?.serialNumber || '—';
  const pname  = (p?:ProductLike) => p?.name || [p?.brand, p?.model].filter(Boolean).join(' ') || '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="glass w-full max-w-4xl p-6 relative animate-scale-in">
        <button className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition" onClick={onClose}>
          <X className="w-5 h-5" />
        </button>

        <div className="text-2xl font-bold mb-6">Заказ #{orderId}</div>

        {loading ? (
          <div className="text-slate-400 p-8 text-center">Загрузка…</div>
        ) : !data ? (
          <div className="text-slate-400 p-8 text-center">Данные не найдены</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Клиент */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-lg font-semibold mb-3">
                <User className="w-5 h-5 text-teal-400" />
                Клиент
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-400">Имя:</span>
                  <span className="font-medium">{data.client?.name || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-400">Телефон:</span>
                  <span className="font-medium">{data.client?.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-400">Город:</span>
                  <span>{data.client?.city || '—'}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
                  <div>
                    <span className="text-slate-400">Адрес:</span>
                    <div className="text-sm">{data.client?.address || '—'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Статус */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-lg font-semibold mb-3">
                <Package className="w-5 h-5 text-purple-400" />
                Статус заказа
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-slate-400">Состояние:</span>
                  <div className="mt-1">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      data.status==='COMPLETED' ? 'bg-green-500/20 text-green-400' :
                      data.status==='IN_PROGRESS' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-sky-500/20 text-sky-400'
                    }`}>
                      {data.status || '—'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Дата создания:</span>
                  <div className="font-medium">{data.date ? new Date(data.date).toLocaleString('ru') : '—'}</div>
                </div>
              </div>
            </div>

            {/* Товары */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 md:col-span-2">
              <div className="text-lg font-semibold mb-3">Товары в заказе</div>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-400">
                    <tr className="border-b border-white/10">
                      <th className="text-left p-2">Наименование</th>
                      <th className="text-left p-2">Серийный номер</th>
                      <th className="text-left p-2">Категория</th>
                      <th className="text-center p-2">Кол-во</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.items || []).length > 0 ? (
                      (data.items || []).map((it, i) => (
                        <tr key={i} className="border-t border-white/5">
                          <td className="p-2">{pname(it.product)}</td>
                          <td className="p-2">
                            <span className="font-mono text-xs text-teal-400">{serial(it.product)}</span>
                          </td>
                          <td className="p-2 text-slate-400">{it.product?.category || '—'}</td>
                          <td className="p-2 text-center font-semibold">{it.qty}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={4} className="p-4 text-center text-slate-400">Пусто</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}