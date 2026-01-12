'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Barcode } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

type OrderItem = {
  productId: number;
  serialNumber: string;
  brand?: string | null;
  model?: string | null;
  price: number;
};

export default function AddBySerial(props: {
  onAdd: (item: OrderItem) => void;
  loading?: boolean;
}) {
  const [serial, setSerial] = useState('');
  const [loading, setLoading] = useState(false);

  const add = async () => {
    const s = serial.trim();
    if (!s) return;

    setLoading(true);
    try {
      const data = await fetchWithAuth(`/inventory/by-serial/${encodeURIComponent(s)}`);
      props.onAdd({
        productId: data.id,
        serialNumber: data.serialNumber,
        brand: data.brand,
        model: data.model,
        price: data.price ?? 0,
      });
      setSerial('');
      toast.success('Товар добавлен');
    } catch (e: any) {
      toast.error(e?.message || 'Не найдено / нет в наличии');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="w-full pl-10 px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-600/50 text-white focus:ring-2 focus:ring-cyan-500/50 transition"
          placeholder="Сканируйте или введите серийный номер"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          onKeyDown={(e) => (e.key === 'Enter' ? add() : null)}
        />
      </div>
      <button
        className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold transition disabled:opacity-50"
        disabled={loading || !serial.trim()}
        onClick={add}
      >
        {loading ? '...' : 'Добавить'}
      </button>
    </div>
  );
}