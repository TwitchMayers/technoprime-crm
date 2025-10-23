'use client';
import { ReactNode, useEffect } from 'react';

export default function Drawer({
  open, onClose, title, children, width = 420
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        className="absolute inset-y-0 right-0 bg-[#0b1220] border-l border-white/10"
        style={{
          width,
          transform: `translateX(${open ? 0 : width}px)`,
          transition: 'transform .25s ease'
        }}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20">✕</button>
        </div>
        <div className="p-4 overflow-auto h-[calc(100%-56px)]">{children}</div>
      </div>
    </div>
  );
}