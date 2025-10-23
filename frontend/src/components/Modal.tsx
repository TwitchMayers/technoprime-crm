'use client';
import { ReactNode, useEffect } from 'react';

export default function Modal({
  open, onClose, title, children, maxWidth = 560,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; maxWidth?: number }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="glass w-full"
          style={{ maxWidth }}
        >
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