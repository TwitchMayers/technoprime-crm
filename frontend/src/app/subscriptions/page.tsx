'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function SubscriptionsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ clientId:'', type:'PS_PLUS', startDate:'', endDate:'', status:'ACTIVE' });

  const load = ()=> api.get('/subscriptions').then(r=>setRows(r.data));
  useEffect(()=>{ load(); },[]);

  return (
    <div>
      <h1>Подписки</h1>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input placeholder="ClientId" value={form.clientId} onChange={e=>setForm({...form,clientId:Number(e.target.value)||undefined})}/>
        <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
          <option>PS_PLUS</option><option>GAME_PASS</option><option>EA_PLAY</option>
        </select>
        <input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/>
        <input type="date" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/>
        <button onClick={async ()=>{
          if (!form.clientId || !form.startDate || !form.endDate) return alert('Проверь поля');
          await api.post('/subscriptions', { ...form, startDate: new Date(form.startDate), endDate: new Date(form.endDate) });
          load();
        }}>Добавить</button>
      </div>

      <table>
        <thead><tr><th>ID</th><th>Клиент</th><th>Тип</th><th>Начало</th><th>Окончание</th><th>Статус</th></tr></thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r.id}>
              <td>{r.id}</td><td>{r.client?.name}</td><td>{r.type}</td>
              <td>{new Date(r.startDate).toLocaleDateString()}</td>
              <td>{new Date(r.endDate).toLocaleDateString()}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}