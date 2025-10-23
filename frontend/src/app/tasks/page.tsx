'use client';

import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useState } from 'react';

type Task = { id:number; title:string; status:'NEW'|'IN_PROGRESS'|'DONE'; client?:{ name:string } };

function TaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="glass p-2 mb-2">
      <div className="text-sm font-semibold">{task.title}</div>
      <div className="text-xs text-slate-400">{task.client?.name || ''}</div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const load = async () => {
    const list = await fetch('/api/tasks').then(r=>r.json()).catch(()=>[]);
    setTasks(list || []);
  };

  useEffect(()=>{ load(); }, []);

  const columns = useMemo(() => ({
    NEW: tasks.filter(t=>t.status==='NEW'),
    IN_PROGRESS: tasks.filter(t=>t.status==='IN_PROGRESS'),
    DONE: tasks.filter(t=>t.status==='DONE'),
  }), [tasks]);

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    // Определяем целевую колонку
    const overId = over.id as string;
    const targetStatus: Task['status'] = ['NEW','IN_PROGRESS','DONE'].includes(overId as any) ? (overId as any) : null;
    // Перетаскивание между колонками
    if (targetStatus) {
      const t = tasks.find(x=>x.id===Number(active.id));
      if (!t || t.status===targetStatus) return;
      await fetch(`/api/tasks/${t.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: targetStatus }) });
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DndContext onDragEnd={onDragEnd}>
          {(['NEW','IN_PROGRESS','DONE'] as const).map(col => (
            <div key={col} id={col} className="glass p-3 min-h-[50vh]">
              <div className="text-sm text-slate-300 mb-2">
                {col === 'NEW' ? 'Новые' : col === 'IN_PROGRESS' ? 'В работе' : 'Сделано'}
              </div>
              <SortableContext items={columns[col].map(t=>t.id)} strategy={verticalListSortingStrategy}>
                {columns[col].map(t => <TaskCard key={t.id} task={t} />)}
              </SortableContext>
            </div>
          ))}
        </DndContext>
      </div>
    </div>
  );
}