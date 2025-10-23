'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Product = { id:number; name:string; price:string; costPrice:string; stock:number; isArchived:boolean };
type Client = { id:number; name:string; phone:string };

export default function NewOrderPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clientId, setClientId] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH'|'TRANSFER'|'TRADE_IN'>('CASH');
  const [comment, setComment] = useState('');
  const [items, setItems] = useState<{ productId:number; name:string; qty:number; salePrice:number; cost:number }[]>([]);

  const load = async () => {
    // забираем много, активные
    const resC = await fetch('/api/clients?limit=500').then(r=>r.json()).catch(()=>({ items:[] }));
    setClients(resC.items || []);
    const resP = await fetch('/api/products?isArchived=false&limit=500').then(r=>r.json()).catch(()=>({ items:[] }));
    const ps: Product[] = resP.items || [];
    setProducts(ps);
  };

  useEffect(()=>{ load(); }, []);

  const addProduct = (pid: number) => {
    const p = products.find(x=>x.id === pid);
    if (!p) return;
    setItems(prev => [...prev, { productId: p.id, name: p.name, qty: 1, salePrice: Number(p.price), cost: Number(p.costPrice) }]);
  };

  const totals = useMemo(()=>{
    const sum = items.reduce((s,i)=> s + i.salePrice*i.qty, 0);
    const cost = items.reduce((s,i)=> s + i.cost*i.qty, 0);
    const profit = sum - cost;
    return { sum, cost, profit };
  }, [items]);

  const save = async () => {
    if (!clientId || items.length === 0) { toast.error('Выберите клиента и добавьте товары'); return; }
    const body = {
      clientId,
      paymentMethod,
      comment,
      items: items.map(i=>({ productId:i.productId, qty:i.qty, salePrice:i.salePrice })),
    };
    const r = await fetch('/api/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    r.ok ? toast.success('Заказ создан') : toast.error('Ошибка создания заказа');
    if (r.ok) { setItems([]); setComment(''); }
  };

  return (
    <div className="space-y-4">
      <div className="glass p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <div className="text-sm text-slate-400 mb-1">Клиент</div>
          <select className="w-full rounded bg-white/5 border border-white/10 px-3 py-2" value={clientId} onChange={e=>setClientId(Number(e.target.value))}>
            <option value={0}>— выберите клиента —</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
          </select>
        </div>
        <div>
          <div className="text-sm text-slate-400 mb-1">Способ оплаты</div>
          <select className="w-full rounded bg-white/5 border border-white/10 px-3 py-2" value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value as any)}>
            <option value="CASH">Наличные</option>
            <option value="TRANSFER">Перевод</option>
            <option value="TRADE_IN">Trade-In</option>
          </select>
        </div>
        <div>
          <div className="text-sm text-slate-400 mb-1">Комментарий</div>
          <input className="w-full rounded bg-white/5 border border-white/10 px-3 py-2" value={comment} onChange={e=>setComment(e.target.value)} />
        </div>
      </div>

      <div className="glass p-3">
        <div className="flex gap-2 mb-3">
          <select className="rounded bg-white/5 border border-white/10 px-3 py-2" onChange={e=>addProduct(Number(e.target.value))}>
            <option value={0}>Добавить товар</option>
            {products.filter(p=>!p.isArchived && p.stock>0).map(p=><option key={p.id} value={p.id}>{p.name} (ост: {p.stock})</option>)}
          </select>
        </div>

        <table className="w-full text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="text-left p-2">Товар</th>
              <th className="text-right p-2">Кол-во</th>
              <th className="text-right p-2">Цена</th>
              <th className="text-right p-2">Сумма</th>
              <th className="text-right p-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            {items.length===0 ? <tr><td className="p-2 text-slate-400">Добавьте товары</td></tr> :
              items.map((it,idx)=>(
                <tr key={idx} className="border-t border-white/10">
                  <td className="p-2">{it.name}</td>
                  <td className="p-2 text-right">
                    <input type="number" min={1} className="w-20 text-right rounded bg-white/5 border border-white/10 px-2 py-1"
                           value={it.qty} onChange={e=>{ const v=Math.max(1, Number(e.target.value)); const arr=[...items]; arr[idx].qty=v; setItems(arr); }}/>
                  </td>
                  <td className="p-2 text-right">
                    <input type="number" className="w-24 text-right rounded bg-white/5 border border-white/10 px-2 py-1"
                           value={it.salePrice} onChange={e=>{ const v=Math.max(0, Number(e.target.value)); const arr=[...items]; arr[idx].salePrice=v; setItems(arr); }}/>
                  </td>
                  <td className="p-2 text-right">{(it.salePrice*it.qty).toLocaleString()} ₽</td>
                  <td className="p-2 text-right">
                    <button className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500" onClick={()=>{ const arr=[...items]; arr.splice(idx,1); setItems(arr); }}>Удалить</button>
                  </td>
                </tr>
              ))
            }
          </tbody>
          <tfoot>
            <tr className="border-t border-white/10 font-semibold">
              <td className="p-2">Итого</td><td></td>
              <td className="p-2 text-right">{totals.cost.toLocaleString()} ₽</td>
              <td className="p-2 text-right">{totals.sum.toLocaleString()} ₽</td>
              <td className="p-2 text-right">Маржа: {totals.profit.toLocaleString()} ₽</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="text-right">
        <button className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-500" onClick={save}>Сохранить</button>
      </div>
    </div>
  );
}