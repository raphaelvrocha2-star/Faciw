import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Cookie } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('lgpd_consent');
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('lgpd_consent', 'true');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:max-w-md z-[100]"
        >
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 bg-indigo-600 h-full" />
            <div className="flex items-start gap-4">
              <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-xl text-indigo-600 shrink-0">
                <Cookie className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
                  Privacidade & LGPD
                </h4>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed mb-4">
                  Utilizamos cookies e tecnologias seguras para melhorar sua experiência, garantir a segurança dos seus dados e personalizar ofertas. Ao continuar, você concorda com nossa Política de Privacidade.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAccept}
                    className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20"
                  >
                    Aceitar Todos
                  </button>
                  <button
                    onClick={() => setIsVisible(false)}
                    className="text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 text-xs font-bold"
                  >
                    Recusar
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
