import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { ShoppingCart, User as UserIcon, LogOut, LayoutDashboard, Search, Sun, Moon, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

interface NavbarProps {
  user: User | null;
  view: 'home' | 'customer' | 'merchant';
  setView: (view: 'home' | 'customer' | 'merchant') => void;
  onLogin: () => void;
  onLogout: () => void;
  isDark: boolean;
  toggleDarkMode: () => void;
}

export function Navbar({ user, view, setView, onLogin, onLogout, isDark, toggleDarkMode }: NavbarProps) {
  return (
    <nav className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 sticky top-0 z-50 transition-all">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        <div 
          onClick={() => {
            const hasVisited = localStorage.getItem('faciw_visited');
            setView(hasVisited ? 'customer' : 'home');
          }}
          className="flex items-center gap-2 shrink-0 group cursor-pointer"
        >
          <div className={cn(
            "bg-gradient-to-br from-indigo-600 to-cyan-500 p-2 rounded-xl shadow-lg transition-all",
            view === 'home' ? "scale-110 shadow-indigo-500/40" : "shadow-indigo-500/20 group-hover:scale-110"
          )}>
            <ShoppingCart className="text-white w-5 h-5 md:w-6 md:h-6" />
          </div>
          <span className="text-xl md:text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-cyan-500 dark:from-indigo-400 dark:to-cyan-400">
            FACIW
          </span>
          <ShieldCheck className="w-4 h-4 text-emerald-500 hidden md:block" />
        </div>

        <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
          <div className="flex bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl shrink-0">
            <button
              onClick={() => setView('customer')}
              className={cn(
                "flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-xl text-sm font-bold transition-all",
                view === 'customer' 
                  ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                  : "text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200"
              )}
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Explorar</span>
            </button>
            <button
              onClick={() => setView('merchant')}
              className={cn(
                "flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-xl text-sm font-bold transition-all",
                view === 'merchant' 
                  ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                  : "text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-200"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Painel</span>
            </button>
          </div>

          <button
            onClick={toggleDarkMode}
            className="p-2 text-slate-500 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            title={isDark ? "Modo Claro" : "Modo Escuro"}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="hidden xs:block h-6 w-px bg-slate-200 dark:bg-zinc-800 mx-1 md:mx-2" />

          {user ? (
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              <div className="hidden lg:block text-right">
                <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 leading-none">{user.displayName}</p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-500 mt-1">{user.email}</p>
              </div>
              <button 
                onClick={onLogout}
                className="p-2 text-slate-400 dark:text-zinc-500 hover:text-red-500 transition-colors"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="bg-indigo-600 text-white px-3 md:px-5 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 shrink-0 active:scale-95"
            >
              <UserIcon className="w-4 h-4" />
              <span className="hidden xs:inline">Conectar</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
