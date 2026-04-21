import React from 'react';
import { motion } from 'motion/react';
import { ShoppingCart, ShieldCheck, Zap, Store, Search, ArrowRight, Star, Sparkles, MapPin, CheckCircle2, LayoutDashboard, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';

interface LandingPageProps {
  onStartExploring: () => void;
  onGoToMerchant: () => void;
}

export function LandingPage({ onStartExploring, onGoToMerchant }: LandingPageProps) {
  return (
    <div className="flex flex-col gap-16 lg:gap-24 pb-20">
      {/* Hero Section */}
      <section className="relative pt-10 lg:pt-20 px-4 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-[20%] left-[-5%] w-[40%] h-[40%] bg-cyan-500/10 dark:bg-cyan-500/5 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-4 mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-xs font-bold border border-indigo-100 dark:border-indigo-800">
              <Sparkles className="w-4 h-4" />
              <span>Inteligência Artificial para o Comércio Local</span>
            </div>
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-zinc-700">
              By Praxus
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl lg:text-7xl font-black tracking-tighter text-slate-900 dark:text-white mb-6 leading-[0.9]"
          >
            ENCONTRE O QUE PRECISA <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">PELO MELHOR PREÇO.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-slate-500 dark:text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed font-medium"
          >
            Faciw conecta você aos lojistas da sua região com inteligência artificial. Economize tempo e dinheiro em suas compras do dia a dia.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={onStartExploring}
              className="w-full sm:w-auto px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-indigo-600/20"
            >
              Começar a Explorar <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={onGoToMerchant}
              className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white rounded-2xl font-bold border border-slate-200 dark:border-zinc-800 flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all active:scale-95"
            >
              Sou Lojista <Store className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Feature Split Section */}
      <section className="px-4 max-w-7xl mx-auto w-full">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* For Consumers */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 lg:p-12 border border-slate-100 dark:border-zinc-800 shadow-sm relative overflow-hidden group"
          >
            <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-indigo-500/5 rounded-full group-hover:scale-125 transition-transform duration-500" />
            <div className="relative z-10">
              <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20 mb-8">
                <Search className="text-white w-7 h-7" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 leading-tight">Para quem compra.</h2>
              <p className="text-slate-500 dark:text-zinc-400 mb-8 font-medium">Use nosso chat inteligente para encontrar ofertas, comparar preços entre lojas locais e organizar sua lista de compras.</p>
              
              <ul className="space-y-4 mb-10">
                {[
                  'Chat IA que entende o que você precisa',
                  'Filtro por distância e preço baixo',
                  'Lista de compras isolada por conversa',
                  'Lembretes inteligentes de mercado'
                ].map((text, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-zinc-300">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0" /> {text}
                  </li>
                ))}
              </ul>

              <button
                onClick={onStartExploring}
                className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-sm uppercase tracking-wider group/btn"
              >
                Explorar Ofertas <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>

          {/* For Merchants */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-zinc-950 rounded-[2.5rem] p-8 lg:p-12 border border-zinc-800 shadow-sm relative overflow-hidden group"
          >
            <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-indigo-500/10 rounded-full group-hover:scale-125 transition-transform duration-500" />
            <div className="relative z-10">
              <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-8">
                <LayoutDashboard className="text-white w-7 h-7" />
              </div>
              <h2 className="text-3xl font-black text-white mb-4 leading-tight">Para quem vende.</h2>
              <p className="text-zinc-400 mb-8 font-medium">Digitalize seu estoque em segundos e seja encontrado por clientes prontos para comprar na sua região.</p>
              
              <ul className="space-y-4 mb-10">
                {[
                  'Dashboard completo para gerenciar produtos',
                  'Visibilidade total para buscas locais',
                  'Gestão inteligente de estoque',
                  'Link direto para seu WhatsApp'
                ].map((text, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-bold text-zinc-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> {text}
                  </li>
                ))}
              </ul>

              <button
                onClick={onGoToMerchant}
                className="inline-flex items-center gap-2 text-emerald-400 font-black text-sm uppercase tracking-wider group/btn"
              >
                Acessar Painel <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust & Security Banner */}
      <section className="px-4">
        <div className="max-w-7xl mx-auto py-12 px-8 bg-slate-100 dark:bg-zinc-900/50 rounded-[2.5rem] flex flex-col lg:flex-row items-center justify-between gap-8 border border-slate-200 dark:border-zinc-800">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center shrink-0">
              <ShieldCheck className="w-10 h-10" />
            </div>
            <div className="text-center sm:text-left">
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">Privacidade & Segurança</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium max-w-md">Compliance total com a LGPD e monitoramento ativo contra malware. Seus dados estão em boas mãos.</p>
            </div>
          </div>
          <div className="flex gap-12 shrink-0">
            <div className="text-center">
              <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">100%</div>
              <div className="text-[10px] uppercase tracking-widest font-black text-slate-400 mt-1">LGPD</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">24/7</div>
              <div className="text-[10px] uppercase tracking-widest font-black text-slate-400 mt-1">Proteção</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Info */}
      <section className="px-4 max-w-7xl mx-auto w-full grid md:grid-cols-4 gap-12">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <ShoppingCart className="text-white w-4 h-4" />
            </div>
            <span className="text-xl font-black tracking-tighter dark:text-white">FACIW</span>
          </div>
          <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium leading-relaxed max-w-xs">
            Desenvolvido pela startup <span className="text-indigo-600 dark:text-indigo-400 font-bold">Praxus</span>, o Faciw utiliza tecnologia de ponta para transformar a maneira como você interage com o comércio local.
          </p>
        </div>
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-6">Plataforma</h4>
          <ul className="space-y-4 text-sm text-slate-500 dark:text-zinc-400 font-medium">
            <li><button onClick={onStartExploring} className="hover:text-indigo-600 transition-colors">Explorar Ofertas</button></li>
            <li><button onClick={onGoToMerchant} className="hover:text-indigo-600 transition-colors">Painel do Lojista</button></li>
            <li><button className="hover:text-indigo-600 transition-colors">Faciw Pro</button></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white mb-6">Empresa</h4>
          <ul className="space-y-4 text-sm text-slate-500 dark:text-zinc-400 font-medium">
            <li><a href="#" className="hover:text-indigo-600 transition-colors">Sobre a Praxus</a></li>
            <li><a href="#" className="hover:text-indigo-600 transition-colors">Privacidade</a></li>
            <li><a href="#" className="hover:text-indigo-600 transition-colors">Contato</a></li>
          </ul>
        </div>
      </section>
    </div>
  );
}
