'use client';

import { useEffect, useMemo, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';

type Product = {
  id:number; name:string; category:'CONSOLE'|'ACCESSORY'|'DISK'|'SERVICE'|'SUBSCRIPTION_KEY';
  brand?:string; model?:string; version?:string; stock:number; costPrice:string; price:string;
};

function CategoryChip({ cat }: { cat: Product['category'] }) {
  const map: Record<Product['category'], string> = {
    CONSOLE: 'chip chip-console',
    ACCESSORY: 'chip chip-accessory',
    DISK: 'chip chip-disk',
    SERVICE: 'chip chip-service',
    SUBSCRIPTION_KEY: 'chip chip-key',
  };
  const label: Record<Product['category'], string> = {
    CONSOLE: 'Console', ACCESSORY: 'Accessory', DISK: 'Disk', SERVICE: 'Service', SUBSCRIPTION_KEY: 'Key',
  };
  return <span className={map[cat]}>{label[cat]}</span>;
}

export default function ProductsPage() {
  const [tab, setTab] = useState<'active'|'archive'>('active');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [rows, setRows] = useState<{ items:Product[]; total:number; page:number; limit:number }>({ items:[], total:0, page:1, limit:200 });

  const load = async () => {
    const params = new URLSearchParams();
    params.set('isArchived', tab === 'archive' ? 'true' : 'false');
    params.set('page', '1'); params.set('limit', '200');
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    const r = await fetch(`/api/products?${params.toString()}`).then(r=>r.json()).catch(()=>({ items:[], total:0, page:1, limit:200 }));
    setRows(r);
  };

  useEffect(()=>{ load(); }, [tab]);

  const items = useMemo(()=> rows.items, [rows]);

  const Row = (index: number, p: Product) => (
    <div className="grid grid-cols-12 px-2 items-center border-b border-white/10 hover:bg-white/5">
      <div className="col-span-3 p-2">{p.name}</div>
      <div className="col-span-2 p-2"><CategoryChip cat={p.category}/></div>
      <div className="col-span-2 p-2">{p.brand || '-'}</div>
      <div className="col-span-2 p-2">{p.model || '-'}</div>
      <div className="col-span-1 p-2 text-right">{p.stock}</div>
      <div className="col-span-1 p-2 text-right">{Number(p.costPrice).toLocaleString()} ₽</div>
      <div className="col-span-1 p-2 text-right">{Number(p.price).toLocaleString()} ₽</div>
      <div className="col-span-12 p-2 text-right">
        <button className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500"
                onClick={async ()=>{ if (!confirm('Удалить товар?')) return;
                  const r = await fetch(`/api/products/${p.id}`, { method:'DELETE' });
                  r.ok ? load() : alert('Ошибка удаления');
                }}>
          Удалить
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="glass p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
        <div className="flex gap-2">
          <button className={`px-3 py-2 rounded-md ${tab==='active'?'bg-white/10':'bg-white/5'}`} onClick={()=>setTab('active')}>Активные</button>
          <button className={`px-3 py-2 rounded-md ${tab==='archive'?'bg-white/10':'bg-white/5'}`} onClick={()=>setTab('archive')}>Архив</button>
        </div>
        <input placeholder="Поиск (название/бренд/модель)" className="rounded bg-white/5 border border-white/10 px-3 py-2 col-span-3" value={q} onChange={e=>setQ(e.target.value)} />
        <select className="rounded bg-white/5 border border-white/10 px-3 py-2" value={category} onChange={e=>setCategory(e.target.value)}>
          <option value="">Любая категория</option>
          <option value="CONSOLE">CONSOLE</option><option value="ACCESSORY">ACCESSORY</option>
          <option value="DISK">DISK</option><option value="SERVICE">SERVICE</option><option value="SUBSCRIPTION_KEY">SUBSCRIPTION_KEY</option>
        </select>
        <button className="px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500" onClick={()=>load()}>Найти</button>
      </div>

      <div className="glass p-0" style={{ height: '60vh' }}>
        <div className="grid grid-cols-12 px-2 py-2 bg-[#0b1220] text-slate-400 sticky top-0 z-10">
          <div className="col-span-3 p-1">Название</div>
          <div className="col-span-2 p-1">Категория</div>
          <div className="col-span-2 p-1">Бренд</div>
          <div className="col-span-2 p-1">Модель</div>
          <div className="col-span-1 p-1 text-right">Ост.</div>
          <div className="col-span-1 p-1 text-right">Себест.</div>
          <div className="col-span-1 p-1 text-right">Цена</div>
        </div>
        <Virtuoso
          style={{ height: 'calc(60vh - 36px)' }}
          totalCount={items.length}
          itemContent={(index) => Row(index, items[index])}
        />
      </div>
    </div>
  );
}