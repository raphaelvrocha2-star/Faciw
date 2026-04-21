import React from 'react';
import { ShieldCheck, Lock, CloudUpload, SearchCheck } from 'lucide-react';

export function SecurityBadges() {
  return (
    <div className="flex flex-wrap items-center gap-4 py-4 border-y border-slate-100 dark:border-zinc-800 my-6">
      <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-zinc-700">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span className="text-[10px] font-black text-slate-600 dark:text-zinc-400">AMAZON SSL SECURED</span>
      </div>
      <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-zinc-700">
        <Lock className="w-4 h-4 text-indigo-600" />
        <span className="text-[10px] font-black text-slate-600 dark:text-zinc-400">AES-256 ENCRYPTION</span>
      </div>
      <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-zinc-700">
        <SearchCheck className="w-4 h-4 text-amber-600" />
        <span className="text-[10px] font-black text-slate-600 dark:text-zinc-400">MALWARE SHIELD</span>
      </div>
      <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-zinc-700">
        <CloudUpload className="w-4 h-4 text-sky-600" />
        <span className="text-[10px] font-black text-slate-600 dark:text-zinc-400">AUTO-BACKUP ON</span>
      </div>
    </div>
  );
}
