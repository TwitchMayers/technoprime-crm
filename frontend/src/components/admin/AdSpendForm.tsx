'use client';
import { useEffect, useState } from 'react';

const AD_SKUS = ['PS5','PS4','XBOX_ONE_S','XBOX_SERIES_S','XBOX_SERIES_X','NINTENDO_SWITCH','STEAM_DECK'] as const;
type AdSku = typeof AD_SKUS[number];

type Row = { adSku: AdSku; amount: string; note: string };

function todayStr() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return d.toISOString().slice(0,10);
}

export default function AdSpendForm() {
  const [date, setDate] = useState<string>(todayStr());
  const [rows, setRows] = useState<Row[]>(AD_SKUS.map(s => ({ adSku: s, amount: '', note: '' })));
  const [msg, setMsg] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  const loadForDate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ad-spend?from=${date}&to=${date}`).then(r=>r.json()).catch(()=>[]);
      const map = new Map<string, any>();
      (res||[]).forEach((r:any)=> map.set(r.adSku, r));
      setRows(AD_SKUS.map(s => {
        const x = map.get(s);
        return { adSku: s, amount: x ? String(x.amount) : '', note: x?.note || '' };
      }));
    } finally { setLoading(false); }
  };

  useEffect(()=>{ loadForDate(); }, [date]);

  const save = async (r: Row) => {
    const amount = Number((r.amount || '').replace(',', '.')) || 0;
    const body = { date, adSku: r.adSku, amount, note: r.note };
    const res = await fetch('/api/ad-spend', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    if (!res.ok) {
      const t = await res.text().catch(()=> '');
      setMsg(t || 'Ошибка сохранения'); setTimeout(()=>setMsg(null), 2500);
    } else {
      setMsg('Сохранено'); setTimeout(()=>setMsg(null), 1200);
    }
  };

  return (
    <div className="glass p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Рекламные расходы за день</div>
        <input type="date" className="rounded bg-white/5 border border-white/10 px-3 py-2"
               value={date} onChange={e=>setDate(e.target.value)} />
      </div>
      <div className="text-sm mb-2 text-slate-400">Вводите сумму по каждой позиции и нажимайте “Сохранить”.</div>
      <table className="w-full text-sm">
        <thead className="text-slate-400">
          <tr><th className="text-left p-2">Позиция</th><th className="p-2">Сумма</th><th className="p-2">Комментарий</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((r, idx)=>(
            <tr key={r.adSku} className="border-t border-white/10">
              <td className="p-2">{r.adSku.replaceAll('_',' ')}</td>
              <td className="p-2">
                <input className="w-32 rounded bg-white/5 border border-white/10 px-2 py-1 text-right"
                       value={r.amount} onChange={e=>{ const v=[...rows]; v[idx].amount=e.target.value; setRows(v); }} />
              </td>
              <td className="p-2">
                <input className="w-full rounded bg-white/5 border border-white/10 px-2 py-1"
                       value={r.note} onChange={e=>{ const v=[...rows]; v[idx].note=e.target.value; setRows(v); }} />
              </td>
              <td className="p-2 text-right">
                <button className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500"
                        onClick={()=>save(r)} disabled={loading}>Сохранить</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {msg && <div className="mt-2 text-slate-200">{msg}</div>}
    </div>
  );
}