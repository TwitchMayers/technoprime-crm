'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Virtuoso } from 'react-virtuoso';

type Client = { id:number; name:string; phone:string; city?:string; address?:string; consoleType?:string };

function Modal({ open, onClose, title, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="glass w-full max-w-xl">
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

export default function ClientsPage() {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [consoleType, setConsoleType] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items:Client[]; total:number; page:number; limit:number }>({ items:[], total:0, page:1, limit:200 });

  const load = async () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (city) params.set('city', city);
    if (consoleType) params.set('consoleType', consoleType);
    params.set('page', String(page));
    params.set('limit', '200');
    const res = await fetch(`/api/clients?${params.toString()}`).then(r=>r.json()).catch(()=>({ items:[], total:0, page:1, limit:200 }));
    setData(res);
  };

  useEffect(()=>{ load(); }, [page]);

  const items = useMemo(()=> data.items, [data.items]);

  // модалки
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<any>({ name:'', phone:'', city:'', address:'', consoleType:'' });

  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState<any>({ id:0, name:'', phone:'', city:'', address:'', consoleType:'' });

  const onSaveAdd = async () => {
    const r = await fetch('/api/clients', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
    if (r.ok) {
      toast.success('Клиент добавлен');
      setAddOpen(false);
      setForm({ name:'', phone:'', city:'', address:'', consoleType:'' });
      load();
    } else toast.error('Ошибка добавления');
  };

  const onSaveEdit = async () => {
    const r = await fetch(`/api/clients/${edit.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name:edit.name||'', phone:edit.phone||'', city:edit.city||'', address:edit.address||'', consoleType:edit.consoleType||'' }),
    });
    if (r.ok) {
      toast.success('Клиент обновлён');
      setEditOpen(false);
      setEdit({ id:0, name:'', phone:'', city:'', address:'', consoleType:'' });
      load();
    } else toast.error('Ошибка обновления');
  };

  const Row = (index: number, c: Client) => (
    <div className="grid grid-cols-12 px-2 items-center border-b border-white/10 hover:bg-white/5">
      <div className="col-span-3 p-2">{c.name}</div>
      <div className="col-span-2 p-2">
        <a className="text-cyan-400 hover:underline" href={`tel:${c.phone}`}>{c.phone}</a>
      </div>
      <div className="col-span-2 p-2">{c.city || '-'}</div>
      <div className="col-span-3 p-2">{c.address || '-'}</div>
      <div className="col-span-2 p-2 text-right flex justify-end gap-2">
        <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
                onClick={() => { setEdit({ ...c, city: c.city||'', address: c.address||'', consoleType: c.consoleType||'' }); setEditOpen(true); }}>
          Ред.
        </button>
        <button className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500"
                onClick={async ()=>{ if (!confirm('Удалить клиента?')) return;
                  const r = await fetch(`/api/clients/${c.id}`, { method:'DELETE' });
                  r.ok ? (toast.success('Удалено'), load()) : toast.error('Ошибка удаления');
                }}>
          Удалить
        </button>
        <button className="px-3 py-1 rounded bg-white/10 hover:bg-white/20"
                onClick={async ()=>{
                  const r = await fetch('/api/subscriptions/renew', { method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ clientId: c.id, type: 'PS_PLUS', months: 1 }) });
                  r.ok ? toast.success('Продлено PS Plus +1м') : toast.error('Ошибка продления');
                }}>
          +PS
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="glass p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
        <input placeholder="Поиск (имя/телефон/адрес)" className="rounded bg-white/5 border border-white/10 px-3 py-2 col-span-3" value={q} onChange={e=>setQ(e.target.value)} />
        <input placeholder="Город" className="rounded bg-white/5 border border-white/10 px-3 py-2" value={city} onChange={e=>setCity(e.target.value)} />
        <input placeholder="Консоль" className="rounded bg-white/5 border border-white/10 px-3 py-2" value={consoleType} onChange={e=>setConsoleType(e.target.value)} />
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500" onClick={()=>{ setPage(1); load(); }}>Найти</button>
          <button className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-500" onClick={()=>setAddOpen(true)}>Добавить</button>
        </div>
      </div>

      <div className="glass p-0" style={{ height: '60vh' }}>
        <div className="grid grid-cols-12 px-2 py-2 bg-[#0b1220] text-slate-400 sticky top-0 z-10">
          <div className="col-span-3 p-1">Имя</div>
          <div className="col-span-2 p-1">Телефон</div>
          <div className="col-span-2 p-1">Город</div>
          <div className="col-span-3 p-1">Адрес</div>
          <div className="col-span-2 p-1 text-right">Действия</div>
        </div>
        <Virtuoso
          style={{ height: 'calc(60vh - 36px)' }}
          totalCount={items.length}
          itemContent={(index) => Row(index, items[index])}
        />
      </div>

      {/* Добавление */}
      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="Новый клиент">
        <div className="space-y-3">
          <input className="w-full rounded bg-white/5 border border-white/10 px-3 py-2" placeholder="Имя" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          <input className="w-full rounded bg-white/5 border border-white/10 px-3 py-2" placeholder="Телефон" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>
          <div className="grid grid-cols-2 gap-2">
            <input className="rounded bg-white/5 border border-white/10 px-3 py-2" placeholder="Город" value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/>
            <input className="rounded bg-white/5 border border-white/10 px-3 py-2" placeholder="Адрес" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/>
          </div>
          <input className="w-full rounded bg-white/5 border border-white/10 px-3 py-2" placeholder="Консоль" value={form.consoleType} onChange={e=>setForm({...form,consoleType:e.target.value})}/>
          <div className="text-right">
            <button className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 mr-2" onClick={()=>setAddOpen(false)}>Отмена</button>
            <button className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500" onClick={onSaveAdd}>Сохранить</button>
          </div>
        </div>
      </Modal>

      {/* Редактирование */}
      <Modal open={editOpen} onClose={()=>setEditOpen(false)} title={`Редактировать клиента #${edit?.id ?? ''}`}>
        <div className="space-y-3">
          <input className="w-full rounded bg-white/5 border border-white/10 px-3 py-2" placeholder="Имя" value={edit?.name||''} onChange={e=>setEdit({...edit, name:e.target.value})}/>
          <input className="w-full rounded bg-white/5 border border-white/10 px-3 py-2" placeholder="Телефон" value={edit?.phone||''} onChange={e=>setEdit({...edit, phone:e.target.value})}/>
          <div className="grid grid-cols-2 gap-2">
            <input className="rounded bg-white/5 border border-white/10 px-3 py-2" placeholder="Город" value={edit?.city||''} onChange={e=>setEdit({...edit, city:e.target.value})}/>
            <input className="rounded bg-white/5 border border-white/10 px-3 py-2" placeholder="Адрес" value={edit?.address||''} onChange={e=>setEdit({...edit, address:e.target.value})}/>
          </div>
          <input className="w-full rounded bg-white/5 border border-white/10 px-3 py-2" placeholder="Консоль" value={edit?.consoleType||''} onChange={e=>setEdit({...edit, consoleType:e.target.value})}/>
          <div className="text-right">
            <button className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 mr-2" onClick={()=>setEditOpen(false)}>Отмена</button>
            <button className="px-4 py-2 rounded bg-green-600 hover:bg-green-500" onClick={onSaveEdit}>Сохранить</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}