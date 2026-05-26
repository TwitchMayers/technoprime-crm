'use client';
import { useState } from 'react';
import { Bell, ChevronDown, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Header({ user }:{ user?: { name?:string; role?:string } }) {
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications] = useState<any[]>([]);

  return (
    <header className="header-gradient sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <div className="text-white font-semibold tracking-wide">TechnoPrime System</div>

        <div className="flex items-center gap-4">
          {/* Уведомления */}
          <div className="relative" onMouseEnter={()=>setNotifOpen(true)} onMouseLeave={()=>setNotifOpen(false)}>
            <button className="btn btn-ghost relative">
              <Bell className="w-5 h-5 text-white/80" />
              {notifications.length>0 && <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px] rounded-full px-1">{notifications.length}</span>}
            </button>
            <AnimatePresence>
              {notifOpen && (
                <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                  transition={{duration:.18}} className="absolute right-0 mt-2 w-80 glass p-2 shadow-elev-2">
                  <div className="text-sm text-slate-300 mb-2">Уведомления</div>
                  <div className="max-h-80 overflow-auto space-y-1">
                    {notifications.length===0 ? <div className="text-slate-400 text-sm p-2">Нет новых</div> :
                      notifications.map((n,i)=>(
                        <div key={i} className="p-2 rounded bg-white/5 hover:bg-white/10 transition">
                          <div className="text-sm text-white">{n.title || n.type}</div>
                          {n.text && <div className="text-xs text-slate-400">{n.text}</div>}
                        </div>
                      ))
                    }
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Профиль */}
          <div className="relative" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}>
            <button className="btn btn-ghost text-white/90">
              <User className="w-5 h-5 mr-2" />
              <span className="hidden md:inline">{user?.name || 'Профиль'}</span>
              <ChevronDown className="w-4 h-4 ml-1 text-white/60" />
            </button>
            <AnimatePresence>
              {open && (
                <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                  transition={{duration:.18}} className="absolute right-0 mt-2 w-64 glass p-2 shadow-elev-2">
                  <div className="p-2">
                    <div className="text-white font-medium">{user?.name || 'User'}</div>
                    <div className="text-xs text-slate-400">{user?.role}</div>
                  </div>
                  <div className="border-t border-white/10 my-2"/>
                  <a className="block px-3 py-2 rounded hover:bg-white/10 transition text-sm" href="/profile">Профиль</a>
                  <a className="block px-3 py-2 rounded hover:bg-white/10 transition text-sm" href="/profile/admin">Админ‑панель</a>
                  <a className="block px-3 py-2 rounded hover:bg-white/10 transition text-sm" href="/logout">Выйти</a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
