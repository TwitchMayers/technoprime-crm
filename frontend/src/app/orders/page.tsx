'use client';

import { useEffect, useMemo, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList as List } from 'react-window';
import { getSocket } from '@/lib/socket';

type Order = {
  id: number;
  date: string;
  status: 'NEW'|'IN_PROGRESS'|'COMPLETED'|'CANCELED';
  client: { name: string; phone: string };
  totalPrice: string;
  profit: string;
  items?: { qty:number; product:{ name:string; category:string; price:string; costPrice:string } }[];
};

function Chip({ status }: { status: Order['status'] }) {
  const map: Record<Order['status'], string> = {
    NEW: 'bg-sky-600', IN_PROGRESS: 'bg-amber-600', COMPLETED: 'bg-green-600', CANCELED: 'bg-rose-600',
  };
  return <span className={`px-2 py-1 rounded text-xs text-white ${map[status]}`}>{status}</span>;
}

function Modal({ open, onClose, title, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="glass w-full max-w-2xl">
          <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
            <div className="font-semibold">{title}</div>
            <button onClick={onClose} className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20">✕</button>
          </div>
          <div className="p-4 max-h-[70vh] overflow-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [tab, setTab] = useState<'all'|'mine'|'queue'|'done'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Order[]>([]);
  const [me, setMe] = useState<any>(null);

  const load = async () => {
    const u = await fetch('/api/me').then(r=>r.json()).catch(()=>null);
    setMe(u);

    const params = new URLSearchParams();
    if (tab === 'queue') params.set('status','NEW');
    if (tab === 'mine' && u?.id) params.set('assigneeId', String(u.id));
    if (tab === 'done') params.set('status','COMPLETED');
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (q) params.set('q', q);

    const list: Order[] = await fetch(`/api/orders?${params.toString()}`).then(r=>r.json()).catch(()=>[]);
    setRows(list || []);
  };

  useEffect(() => { load(); }, [tab]);

  useEffect(() => {
    const s = getSocket();
    const handler = () => load();
    s.on('queueUpdated', handler);
    return () => { s.off('queueUpdated', handler); };
  }, [tab]);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [order, setOrder] = useState<Order|null>(null);
  const [archiveFlag, setArchiveFlag] = useState(true);

  const composition = useMemo(()=> {
    if (!order?.items?.length) return [];
    return order.items.map(it => ({
      name: it.product.name,
      qty: it.qty,
      cost: Number(it.product.costPrice) * it.qty,
      sum: Number(it.product.price) * it.qty,
    }));
  }, [order?.items]);

  const totals = useMemo(()=> {
    const cost = composition.reduce((s,i)=> s+i.cost, 0);
    const sum = composition.reduce((s,i)=> s+i.sum, 0);
    const profit = sum - cost;
    return { cost, sum, profit };
  }, [composition]);

  const Row = ({ index, style }: any) => {
    const o = rows[index];
    if (!o) return null;
    return (
      <div style={style} className="grid grid-cols-12 px-2 items-center border-b border-white/10 hover:bg-white/5">
        <div className="col-span-1 p-2">{o.id}</div>
        <div className="col-span-3 p-2">{o.client?.name}</div>
        <div className="col-span-2 p-2">{o.client?.phone}</div>
        <div className="col-span-2 p-2"><Chip status={o.status}/></div>
        <div className="col-span-2 p-2 text-right">{Number(o.totalPrice).toLocaleString()} ₽</div>
        <div className="col-span-2 p-2 text-right flex justify-end gap-2">
          {/* быстрые действия */}
          <a className="px-2 py-1 rounded bg-white/10 hover:bg-white/20" href={`tel:${o.client?.phone}`}>📞</a>
          <a className="px-2 py-1 rounded bg-white/10 hover:bg-white/20" href={`https://wa.me/${o.client?.phone?.replace(/\D/g,'')}`} target="_blank">💬</a>
          <a className="px-2 py-1 rounded bg-white/10 hover:bg-white/20" href={`/api/export/order?id=${o.id}`} target="_blank">🧾</a>

          {o.status==='NEW' && <button className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500"
              onClick={async ()=>{
                const u = await fetch('/api/me').then(r=>r.json());
                await fetch(`/api/orders/${o.id}/assign`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ assigneeId: u.id }) });
                load();
              }}>
            Принять
          </button>}
          {o.status!=='COMPLETED' && <button className="px-3 py-1 rounded bg-green-600 hover:bg-green-500"
              onClick={()=>{
                setOrder(o);
                setArchiveFlag(true);
                setCompleteOpen(true);
              }}>
            Завершить
          </button>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="glass p-3">
        <div className="grid grid-cols-1 md:grid-cols-8 gap-2">
          <div className="col-span-3 flex gap-2">
            <button className={`px-3 py-2 rounded-md ${tab==='all'?'bg-white/10':'bg-white/5'}`} onClick={()=>setTab('all')}>Все</button>
            <button className={`px-3 py-2 rounded-md ${tab==='mine'?'bg-white/10':'bg-white/5'}`} onClick={()=>setTab('mine')}>Мои</button>
            <button className={`px-3 py-2 rounded-md ${tab==='queue'?'bg-white/10':'bg-white/5'}`} onClick={()=>setTab('queue')}>К принятию</button>
            <button className={`px-3 py-2 rounded-md ${tab==='done'?'bg-white/10':'bg-white/5'}`} onClick={()=>setTab('done')}>Завершённые</button>
          </div>
          <input type="date" className="rounded bg-white/5 border border-white/10 px-3 py-2" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
          <input type="date" className="rounded bg-white/5 border border-white/10 px-3 py-2" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
          <input placeholder="Поиск (клиент/телефон)" className="rounded bg-white/5 border border-white/10 px-3 py-2" value={q} onChange={e=>setQ(e.target.value)} />
          <button className="px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500" onClick={()=>load()}>Найти</button>
        </div>
      </div>

      <div className="glass p-0" style={{ height: '60vh' }}>
        <div className="grid grid-cols-12 px-2 py-2 bg-[#0b1220] text-slate-400 sticky top-0 z-10">
          <div className="col-span-1 p-1">№</div>
          <div className="col-span-3 p-1">Клиент</div>
          <div className="col-span-2 p-1">Телефон</div>
          <div className="col-span-2 p-1">Статус</div>
          <div className="col-span-2 p-1 text-right">Сумма</div>
          <div className="col-span-2 p-1 text-right">Действия</div>
        </div>
        <AutoSizer>
          {({ height, width }) => (
            <List height={height - 36} width={width} itemCount={rows.length} itemSize={48}>
              {Row}
            </List>
          )}
        </AutoSizer>
      </div>

      {/* Модалка завершения с составом и маржой */}
      <Modal open={completeOpen} onClose={()=>setCompleteOpen(false)} title={`Завершить заказ #${order?.id ?? ''}`}>
        <div className="space-y-4">
          <div className="glass p-2">
            <div className="text-sm text-slate-300 mb-2">Состав заказа</div>
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left p-1">Товар</th>
                  <th className="text-right p-1">Кол-во</th>
                  <th className="text-right p-1">Себест.</th>
                  <th className="text-right p-1">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {composition.map((i, idx)=>(
                  <tr key={idx} className="border-t border-white/10">
                    <td className="p-1">{i.name}</td>
                    <td className="p-1 text-right">{i.qty}</td>
                    <td className="p-1 text-right">{i.cost.toLocaleString()} ₽</td>
                    <td className="p-1 text-right">{i.sum.toLocaleString()} ₽</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 font-semibold">
                  <td className="p-1">Итого</td>
                  <td></td>
                  <td className="p-1 text-right">{totals.cost.toLocaleString()} ₽</td>
                  <td className="p-1 text-right">{totals.sum.toLocaleString()} ₽</td>
                </tr>
                <tr className="font-semibold">
                  <td className="p-1">Маржа</td>
                  <td></td>
                  <td></td>
                  <td className="p-1 text-right">{totals.profit.toLocaleString()} ₽</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={archiveFlag} onChange={e=>setArchiveFlag(e.target.checked)} />
            <span>Списать консоль в архив</span>
          </label>
          <div className="text-right">
            <button className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 mr-2" onClick={()=>setCompleteOpen(false)}>Отмена</button>
            <button className="px-4 py-2 rounded bg-green-600 hover:bg-green-500"
                    onClick={async ()=>{
                      if (!order) return;
                      await fetch(`/api/orders/${order.id}/status`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:'COMPLETED', archiveOnComplete: archiveFlag }) });
                      setCompleteOpen(false); setOrder(null); load();
                    }}>
              Завершить
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}