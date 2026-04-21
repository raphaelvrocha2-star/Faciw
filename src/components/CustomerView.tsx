import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Search, 
  User as UserIcon, 
  MapPin, 
  Phone, 
  Tag, 
  ShoppingBag, 
  ListChecks, 
  Plus, 
  Minus, 
  Trash2, 
  Store as StoreIcon,
  UtensilsCrossed,
  Flame,
  Zap,
  ShoppingBasket,
  MessageSquare,
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  ShoppingCart,
  Cpu,
  Sparkles,
  Calendar,
  Clock,
  Star,
  Bell,
  BellOff,
  Mail,
  X,
  AlertTriangle
} from 'lucide-react';
import { Product, Merchant, ChatMessage, ShoppingItem, ChatSession } from '../types';
import { filterProducts, generateChatTitle } from '../services/geminiService';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, setDoc, writeBatch } from 'firebase/firestore';

interface CustomerViewProps {
  products: Product[];
  merchants: Merchant[];
  shoppingList: ShoppingItem[];
  setShoppingList: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
  user: User | null;
  onLogin: () => void;
  sessions: ChatSession[];
  sessionsLoaded: boolean;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  onUpdateSession: (session: ChatSession) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onClearEmptySessions: () => void;
  userLocation: { lat: number; lng: number } | null;
  reminder: { date: string; time: string } | null;
  onUpdateReminder: (reminder: { date: string; time: string } | null) => void;
}

export function CustomerView({ 
  products, 
  merchants, 
  shoppingList, 
  setShoppingList, 
  user, 
  onLogin,
  sessions,
  sessionsLoaded,
  activeSessionId,
  setActiveSessionId,
  onUpdateSession,
  onCreateSession,
  onDeleteSession,
  onClearEmptySessions,
  userLocation,
  reminder,
  onUpdateReminder
}: CustomerViewProps) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'results' | 'list'>('chat');
  const [hasNewResults, setHasNewResults] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [tempReminderDate, setTempReminderDate] = useState(reminder?.date || '');
  const [tempReminderTime, setTempReminderTime] = useState(reminder?.time || '');
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [isClearListModalOpen, setIsClearListModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Close sidebar on mobile when switching sessions
  const handleSessionSelect = (id: string) => {
    setActiveSessionId(id);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [];
  const recommendations = activeSession?.recommendations || [];

  useEffect(() => {
    if (sessionsLoaded && sessions.length === 0) {
      onCreateSession();
    }
  }, [sessions, sessionsLoaded]);

  const handleAddToList = async (product: Product) => {
    if (!activeSessionId) return;
    const existingItem = shoppingList.find(item => item.id === product.id);

    if (!user) {
      let newList: ShoppingItem[];
      if (existingItem) {
        newList = shoppingList.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        const { id, ...productData } = product;
        newList = [...shoppingList, { ...productData, id: product.id, quantity: 1, addedAt: Date.now(), purchased: false }];
      }
      localStorage.setItem(`shoppingList_${activeSessionId}`, JSON.stringify(newList));
      setShoppingList(newList);
      return;
    }

    try {
      const itemRef = doc(db, 'users', user.uid, 'chat_sessions', activeSessionId, 'shopping_list', product.id);
      
      if (existingItem) {
        await updateDoc(itemRef, {
          quantity: existingItem.quantity + 1
        });
      } else {
        const { id, ...productData } = product;
        await setDoc(itemRef, {
          ...productData,
          id: product.id,
          quantity: 1,
          addedAt: Date.now(),
          purchased: false
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/chat_sessions/${activeSessionId}/shopping_list/${product.id}`);
    }
  };

  const handleToggleCheck = async (item: ShoppingItem) => {
    if (!activeSessionId) return;
    const isPurchased = !item.purchased;
    if (!user) {
      const newList = shoppingList.map(i => i.id === item.id ? { ...i, purchased: isPurchased } : i);
      localStorage.setItem(`shoppingList_${activeSessionId}`, JSON.stringify(newList));
      setShoppingList(newList);
      return;
    }
    try {
      await updateDoc(doc(db, 'users', user.uid, 'chat_sessions', activeSessionId, 'shopping_list', item.id), {
        purchased: isPurchased
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/chat_sessions/${activeSessionId}/shopping_list/${item.id}`);
    }
  };

  const handleClearList = async () => {
    if (!activeSessionId || shoppingList.length === 0) return;
    
    if (!user) {
      localStorage.setItem(`shoppingList_${activeSessionId}`, JSON.stringify([]));
      setShoppingList([]);
      setIsClearListModalOpen(false);
      return;
    }

    try {
      const batch = writeBatch(db);
      shoppingList.forEach((item) => {
        batch.delete(doc(db, 'users', user.uid, 'chat_sessions', activeSessionId, 'shopping_list', item.id));
      });
      await batch.commit();
      setIsClearListModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/chat_sessions/${activeSessionId}/shopping_list`);
    }
  };


  // Grouping logic
  const groupedList = shoppingList.reduce((acc, item) => {
    const merchant = merchants.find(m => m.id === item.merchantId);
    const merchantId = item.merchantId;
    if (!acc[merchantId]) {
      acc[merchantId] = { merchant, items: [], total: 0 };
    }
    acc[merchantId].items.push(item);
    acc[merchantId].total += item.price * item.quantity;
    return acc;
  }, {} as Record<string, { merchant: Merchant | undefined, items: ShoppingItem[], total: number }>);

  const getStoreStatus = (openingHours?: string) => {
    if (!openingHours) return null;
    
    try {
      // Improved regex to handle formats like "10:00 às 18:00", "08:00 - 19:00", etc.
      const timeMatch = openingHours.match(/(\d{1,2}:\d{2})\s*(?:-|às|ás|até|à)\s*(\d{1,2}:\d{2})/i);
      if (!timeMatch) return null; // Hide if format is not recognized

      const [_, openStr, closeStr] = timeMatch;
      
      // Normalize times to HH:mm format for reliable comparison
      const normalize = (s: string) => s.length === 4 ? `0${s}` : s;
      const nOpen = normalize(openStr);
      const nClose = normalize(closeStr);

      const now = new Date();
      const nowTotal = now.getHours() * 60 + now.getMinutes();

      const [oH, oM] = nOpen.split(':').map(Number);
      const [cH, cM] = nClose.split(':').map(Number);
      const openTotal = oH * 60 + oM;
      const closeTotal = cH * 60 + cM;

      if (nowTotal >= openTotal && nowTotal < closeTotal) {
        const remaining = closeTotal - nowTotal;
        if (remaining <= 60) {
          return { text: `Fecha às ${nClose}`, color: "text-amber-500" };
        }
        return { text: "Aberto agora", color: "text-emerald-500" };
      } else {
        return { text: `Abre às ${nOpen}`, color: "text-red-500" };
      }
    } catch {
      return null;
    }
  };

  const grandTotal = shoppingList.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (e?: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault();
    const userMsg = customMsg || input.trim();
    if (!userMsg || isTyping || !activeSession) return;

    if (!customMsg) setInput('');
    
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMsg }];
    
    onUpdateSession({
      ...activeSession,
      messages: newMessages
    });

    setIsTyping(true);

    try {
      const result = await filterProducts(userMsg, products, merchants, messages, userLocation || undefined);
      const updatedMessages: ChatMessage[] = [...newMessages, { role: 'model', content: result.explanation }];
      
      let updatedRecommendations = recommendations;
      if (result.recommendedProductIds?.length > 0) {
        updatedRecommendations = products.filter(p => result.recommendedProductIds.includes(p.id));
        setHasNewResults(true);
      }

      let updatedTitle = activeSession.title;
      if (messages.length === 1) {
        try {
          updatedTitle = await generateChatTitle(userMsg, result.explanation);
        } catch (titleErr) {
          console.error("Failed to generate title:", titleErr);
          updatedTitle = userMsg.substring(0, 30) + (userMsg.length > 30 ? '...' : '');
        }
      }

      onUpdateSession({
        ...activeSession,
        title: updatedTitle,
        messages: updatedMessages,
        recommendations: updatedRecommendations
      });

    } catch (error) {
      onUpdateSession({
        ...activeSession,
        messages: [...newMessages, { role: 'model', content: 'Erro ao processar. Tente novamente.' }]
      });
    } finally {
      setIsTyping(false);
    }
  };

  const saveReminder = () => {
    if (tempReminderDate && tempReminderTime) {
      onUpdateReminder({ date: tempReminderDate, time: tempReminderTime });
      setIsReminderModalOpen(false);
    }
  };

  const removeReminder = () => {
    onUpdateReminder(null);
    setTempReminderDate('');
    setTempReminderTime('');
    setIsReminderModalOpen(false);
  };

  const suggestions = [
    { label: 'Ofertas de Hoje', icon: <Zap className="w-3 h-3" />, color: 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800' },
    { label: 'Receita de Estrogonofe', icon: <UtensilsCrossed className="w-3 h-3" />, color: 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800' },
    { label: 'Ofertas de Carnes', icon: <Flame className="w-3 h-3" />, color: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' },
    { label: 'Dicas de Churrasco', icon: <Tag className="w-3 h-3" />, color: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' },
    { label: 'Produtos de Limpeza', icon: <Zap className="w-3 h-3" />, color: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' },
    { label: 'Hortifruti Fresco', icon: <ShoppingBasket className="w-3 h-3" />, color: 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800' },
    { label: 'Vinhos Tintos', icon: <UtensilsCrossed className="w-3 h-3" />, color: 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800' },
    { label: 'Cafés Especiais', icon: <Zap className="w-3 h-3" />, color: 'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800' },
    { label: 'Lanches Prontos', icon: <ShoppingBag className="w-3 h-3" />, color: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' },
  ];

  return (
    <div className="flex flex-1 min-h-screen relative gap-4">
      {/* Sidebar - Desktop & Mobile Overlay */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 lg:sticky lg:top-20 lg:h-[calc(100vh-100px)] flex flex-col bg-white dark:bg-slate-900 border-r lg:border border-slate-200 dark:border-slate-800 lg:rounded-3xl overflow-hidden transition-all duration-300 shadow-xl lg:shadow-sm shrink-0",
        isSidebarOpen ? "w-72 translate-x-0" : "w-0 lg:w-16 -translate-x-full lg:translate-x-0"
      )}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          {(isSidebarOpen || window.innerWidth < 1024) && <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">Histórico</h3>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500">
            {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
        
        <div className="p-3 shrink-0 flex gap-2">
          <button 
            onClick={() => { onCreateSession(); if (window.innerWidth < 1024) setIsSidebarOpen(false); }}
            className={cn(
              "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all",
              "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20",
              !isSidebarOpen && "lg:justify-center lg:px-0"
            )}
          >
            <PlusCircle className="w-4 h-4" />
            {isSidebarOpen && "Novo Chat"}
          </button>
          {isSidebarOpen && sessions.filter(s => s.messages.length <= 1).length > 0 && (
            <button 
              onClick={onClearEmptySessions}
              title="Limpar Conversas Vazias"
              className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {sessions.filter(s => s.id === activeSessionId || s.messages.length > 1).map(session => (
            <div key={session.id} className="group relative">
              <button
                onClick={() => handleSessionSelect(session.id)}
                className={cn(
                  "w-full text-left px-3 py-3 rounded-xl text-xs transition-all flex items-center gap-3",
                  activeSessionId === session.id 
                    ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 font-bold border border-indigo-100 dark:border-indigo-800" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                  !isSidebarOpen && "lg:justify-center lg:px-0"
                )}
              >
                <MessageSquare className={cn("w-4 h-4 shrink-0", activeSessionId === session.id ? "text-indigo-600" : "text-slate-400")} />
                {isSidebarOpen && <span className="truncate flex-1">{session.title}</span>}
              </button>
              {isSidebarOpen && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100",
                    activeSessionId === session.id 
                      ? "text-indigo-400 hover:text-red-500" 
                      : "text-slate-300 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className={cn(
        "flex flex-col flex-1 w-full"
      )}>
        {/* Universal Tabs & History Toggle - STICKY */}
        <div className="sticky top-16 z-40 bg-slate-50/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-slate-200/50 dark:border-zinc-800/50 p-2 shadow-sm transition-all mb-4">
          <div className="max-w-5xl mx-auto flex items-center gap-2 w-full">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <div className="flex-1 flex bg-slate-200 dark:bg-zinc-800 p-1 rounded-2xl shadow-inner">
              <button onClick={() => setActiveTab('chat')} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all", activeTab === 'chat' ? "bg-white dark:bg-zinc-700 text-indigo-700 dark:text-indigo-400 shadow-sm scale-[1.02]" : "text-slate-600 dark:text-zinc-400 hover:text-indigo-500")}>
                Chat
              </button>
              <button onClick={() => { setActiveTab('results'); setHasNewResults(false); }} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all relative", activeTab === 'results' ? "bg-white dark:bg-zinc-700 text-indigo-700 dark:text-indigo-400 shadow-sm scale-[1.02]" : "text-slate-600 dark:text-zinc-400 hover:text-indigo-500")}>
                Ofertas {(recommendations.length > 0 ? recommendations : products.filter(p => p.originalPrice && p.originalPrice > p.price)).length > 0 && (
                  <span className="bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded-full ml-1">
                    {(recommendations.length > 0 ? recommendations : products.filter(p => p.originalPrice && p.originalPrice > p.price)).length}
                  </span>
                )}
                {hasNewResults && activeTab !== 'results' && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                )}
              </button>
              <button onClick={() => setActiveTab('list')} className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all", activeTab === 'list' ? "bg-white dark:bg-zinc-700 text-indigo-700 dark:text-indigo-400 shadow-sm scale-[1.02]" : "text-slate-600 dark:text-zinc-400 hover:text-indigo-500")}>
                Lista {shoppingList.length > 0 && <span className="bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded-full ml-1">{shoppingList.length}</span>}
              </button>
            </div>
          </div>
        </div>

        {/* View Content Wrapper */}
        <div className="max-w-5xl mx-auto w-full flex flex-col px-2 lg:px-4 pb-12 relative">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden"
              >
          <div className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-indigo-50/30 dark:bg-indigo-900/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20"><ShoppingCart className="text-white w-5 h-5" /></div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-zinc-100 leading-none text-sm">Faciw AI</h3>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-1">Sempre online</p>
              </div>
            </div>
          </div>
          <div ref={scrollRef} className="p-4 space-y-4 bg-slate-50/30 dark:bg-zinc-900/30">
            {messages.length === 0 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="bg-white dark:bg-zinc-800 p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-700 shadow-sm relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/5 blur-3xl rounded-full group-hover:bg-indigo-500/10 transition-colors" />
                  <div className="relative z-10">
                    <h4 className="text-lg font-black text-slate-900 dark:text-zinc-100 mb-2">Olá! Como posso ajudar? 🛒</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 leading-relaxed">Sou seu assistente de economia. Posso te dar receitas, comparar preços e encontrar as melhores ofertas.</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg">#Receitas</span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg">#Promoções</span>
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded-lg">#Comparativo</span>
                    </div>
                  </div>
                </div>

                {products.some(p => p.originalPrice && p.originalPrice > p.price) && (
                  <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-5 rounded-[2rem] text-white shadow-lg shadow-rose-500/20 relative overflow-hidden group">
                    <Sparkles className="absolute -right-2 -top-2 w-16 h-16 text-white/10 rotate-12 group-hover:scale-125 transition-transform duration-700" />
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-4 h-4 fill-current" />
                        <h4 className="text-xs font-black uppercase tracking-widest">Ofertas Imperdíveis</h4>
                      </div>
                      <p className="text-sm font-bold mb-4">Temos {products.filter(p => p.originalPrice && p.originalPrice > p.price).length} produtos com desconto hoje!</p>
                      <button 
                        onClick={() => handleSend(undefined, "Quais são as melhores promoções de hoje?")}
                        className="bg-white text-rose-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md"
                      >
                        Ver Todas as Ofertas
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-2 max-w-[90%] animate-in fade-in slide-in-from-bottom-2 duration-300", msg.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm", msg.role === 'user' ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" : "bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-100 dark:border-zinc-700")}>
                  {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Cpu className="w-4 h-4 text-indigo-600" />}
                </div>
                <div className={cn("p-3.5 rounded-2xl text-[13px] sm:text-sm leading-relaxed", msg.role === 'user' ? "bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/10" : "bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-100 dark:border-zinc-700 rounded-tl-none shadow-sm")}>
                  <div className="markdown-body prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {isTyping && <div className="flex gap-2"><div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 flex items-center justify-center shadow-sm"><Cpu className="w-4 h-4 text-indigo-600" /></div><div className="bg-white dark:bg-zinc-800 p-3.5 rounded-2xl rounded-tl-none border border-slate-100 dark:border-zinc-700 shadow-sm"><div className="flex gap-1.5"><span className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce" /><span className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} /><span className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} /></div></div></div>}
            
            {!isTyping && messages.length < 3 && (
              <div className="pt-2 overflow-hidden relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-slate-50 dark:from-zinc-900 to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-slate-50 dark:from-zinc-900 to-transparent z-10 pointer-events-none" />
                
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-4">Sugestões para você</p>
                
                <div className="flex relative items-center py-2 h-14 overflow-hidden">
                  <motion.div 
                    className="flex gap-3 whitespace-nowrap"
                    animate={{
                      x: ["0%", "-50%"],
                    }}
                    transition={{
                      x: {
                        repeat: Infinity,
                        repeatType: "loop",
                        duration: 35,
                        ease: "linear",
                      },
                    }}
                    style={{ width: "fit-content" }}
                  >
                    {[...suggestions, ...suggestions].map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(undefined, s.label)}
                        className={cn(
                          "flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[11px] font-bold border transition-all hover:scale-110 active:scale-95 shadow-sm shrink-0",
                          s.color
                        )}
                      >
                        {s.icon}
                        {s.label}
                      </button>
                    ))}
                  </motion.div>
                </div>
              </div>
            )}
          </div>
          <form 
            onSubmit={handleSend} 
            className="sticky bottom-0 z-10 p-4 pb-8 lg:pb-6 border-t border-slate-100 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md shrink-0 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]"
          >
            <div className="relative group">
              <input 
                type="text" 
                value={input} 
                onChange={(e) => setInput(e.target.value)} 
                placeholder="Ex: Ofertas de picanha hoje..." 
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl py-4 pl-5 pr-14 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white dark:focus:bg-zinc-800 focus:border-indigo-500 transition-all text-sm dark:text-zinc-100 shadow-inner" 
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isTyping} 
                className="absolute right-2 top-2 bottom-2 w-12 flex items-center justify-center bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-zinc-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-90"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[9px] text-center text-slate-400 mt-2 font-medium">Use IA para encontrar o melhor preço em sua região.</p>
          </form>
        </motion.div>
      )}

      {activeTab === 'results' && (
              <motion.div 
                key="results"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-4 pr-1"
              >
          <div className="bg-indigo-900 text-white p-4 rounded-3xl shadow-lg relative overflow-hidden shrink-0 group">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-500/20 blur-2xl rounded-full" 
            />
            <Sparkles className="absolute -right-4 -top-4 w-16 h-16 text-indigo-800/50 rotate-12 group-hover:scale-110 transition-transform" />
            <h3 className="text-lg font-bold mb-1 relative z-10 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Melhores Opções
            </h3>
            <p className="text-indigo-100 text-[10px] relative z-10 font-bold opacity-80 backdrop-blur-sm">Curadoria inteligente Faciw.</p>
          </div>

          {/* Flash Deals Section */}
          {((recommendations.length > 0 ? recommendations : products).some(p => p.originalPrice && p.originalPrice > p.price)) && (
             <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-3xl border border-rose-100 dark:border-rose-900/30 shrink-0">
               <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-2">
                   <div className="bg-rose-500 p-1.5 rounded-lg">
                     <Zap className="w-3 h-3 text-white fill-current" />
                   </div>
                   <h4 className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Ofertas Relâmpago</h4>
                 </div>
                 <span className="text-[8px] font-bold text-rose-400 uppercase">
                   {recommendations.length > 0 ? "No Contexto" : "Melhores Hoje"}
                 </span>
               </div>
               <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
                 {(recommendations.length > 0 ? recommendations : products)
                   .filter(p => p.originalPrice && p.originalPrice > p.price)
                   .sort((a, b) => ((b.originalPrice! - b.price) / b.originalPrice!) - ((a.originalPrice! - a.price) / a.originalPrice!))
                   .slice(0, 5)
                   .map(p => {
                     const inList = shoppingList.some(item => item.id === p.id);
                     return (
                       <div key={p.id} className="min-w-[140px] bg-white dark:bg-zinc-800 p-3 rounded-2xl shadow-sm border border-rose-100 dark:border-rose-900/20 flex flex-col justify-between">
                         <div>
                           <div className="flex justify-between items-start mb-1">
                             <span className="text-[8px] font-black text-rose-500 uppercase">{Math.round((p.originalPrice! - p.price) / p.originalPrice! * 100)}% OFF</span>
                             <button onClick={() => handleAddToList(p)} className={cn("p-1 rounded-md transition-all", inList ? "text-indigo-600" : "text-slate-300 hover:text-indigo-600")}>
                               <Plus className="w-3 h-3" />
                             </button>
                           </div>
                           <h5 className="text-[10px] font-bold truncate text-slate-800 dark:text-zinc-100">{p.name}</h5>
                         </div>
                         <div className="mt-2">
                           <p className="text-[9px] text-slate-400 line-through font-medium leading-none">R$ {p.originalPrice?.toFixed(2).replace('.', ',')}</p>
                           <p className="text-[11px] font-black text-rose-600 dark:text-rose-400">R$ {p.price.toFixed(2).replace('.', ',')}</p>
                         </div>
                       </div>
                     );
                   })
                 }
               </div>
             </div>
          )}

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
            {recommendations.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800">
                <ShoppingBag className="w-8 h-8 text-slate-200 dark:text-zinc-700 mx-auto mb-2" />
                <p className="text-slate-400 text-xs">Busque algo para ver ofertas.</p>
              </div>
            ) : (
              recommendations.map((product) => {
                const merchant = merchants.find(m => m.id === product.merchantId);
                const inList = shoppingList.some(item => item.id === product.id);
                return (
                  <div key={product.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-900 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-slate-900 dark:text-zinc-100 text-sm truncate">{product.name}</h4>
                          {product.brand && (
                            <span className="text-indigo-500 dark:text-indigo-400 font-bold text-[8px] uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-md shrink-0">
                              {product.brand}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">R$ {product.price.toFixed(2).replace('.', ',')} / {product.unit}</p>
                          {product.originalPrice && product.originalPrice > product.price && (
                            <span className="text-[9px] text-slate-400 line-through font-bold">R$ {product.originalPrice.toFixed(2).replace('.', ',')}</span>
                          )}
                          {product.originalPrice && product.originalPrice > product.price && (
                            <span className="text-[8px] bg-emerald-500 text-white px-1 rounded font-black uppercase tracking-tighter shadow-sm animate-pulse">Promo</span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => handleAddToList(product)} className={cn("p-2 rounded-lg transition-all", inList ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600" : "bg-slate-50 dark:bg-zinc-800 text-slate-400 hover:text-indigo-600")}><Plus className="w-4 h-4" /></button>
                    </div>
                    {merchant && (
                      <div className="pt-2 border-t border-slate-50 dark:border-zinc-800 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                        <div className="flex items-center gap-2 truncate">
                          <StoreIcon className="w-3 h-3 shrink-0" /> 
                          <span className="truncate font-medium text-slate-700 dark:text-zinc-400">{merchant.name}</span>
                        </div>
                        {merchant.rating && (
                          <div className="flex items-center gap-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold shrink-0">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            {merchant.rating.toFixed(1)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      )}

            {activeTab === 'list' && (
              <motion.div 
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-5 pr-1 pb-8"
              >
          <div className="bg-zinc-900 dark:bg-zinc-800 text-white p-4 rounded-3xl shadow-lg relative overflow-hidden shrink-0">
            <ListChecks className="absolute -right-4 -top-4 w-16 h-16 text-zinc-700/50 rotate-12" />
            <div className="relative z-10 flex justify-between items-start mb-2">
              <div>
                <h3 className="text-lg font-bold mb-1">Lista de Compras</h3>
                <p className="text-zinc-400 text-[10px]">Agrupado por loja.</p>
              </div>
              <button 
                onClick={() => setIsReminderModalOpen(true)}
                className={cn(
                  "p-2 rounded-xl transition-all flex items-center gap-2 text-[10px] font-bold",
                  reminder 
                    ? "bg-indigo-600 text-white" 
                    : "bg-zinc-800 dark:bg-zinc-700 text-zinc-400 hover:text-white"
                )}
              >
                {reminder ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                {reminder ? `${reminder.date} ${reminder.time}` : "Lembrete"}
              </button>
            </div>
            <div className="relative z-10 flex items-center justify-between mt-4">
              <p className="text-indigo-400 font-bold text-sm">Total: R$ {grandTotal.toFixed(2).replace('.', ',')}</p>
              {shoppingList.length > 0 && (
                <button 
                  onClick={() => setIsClearListModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl text-[10px] font-bold transition-all border border-red-500/20"
                >
                  <Trash2 className="w-3 h-3" />
                  Limpar Tudo
                </button>
              )}
            </div>
          </div>
          <div className="space-y-6 pr-1">
            {shoppingList.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                <ListChecks className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-slate-400 text-xs">Sua lista está vazia.</p>
              </div>
            ) : (
              Object.entries(groupedList).map(([merchantId, data]) => (
                <div key={merchantId} className="space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex flex-col min-w-0 cursor-pointer group" onClick={() => data.merchant && setSelectedMerchant(data.merchant)}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <StoreIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate group-hover:text-indigo-600 transition-colors">
                          {data.merchant?.name || 'Estabelecimento'}
                        </h4>
                        {data.merchant?.rating && (
                          <div className="flex items-center gap-0.5 text-amber-500 font-bold text-[8px] bg-amber-50 dark:bg-amber-900/20 px-1 py-0.5 rounded shrink-0">
                            <Star className="w-2 h-2 fill-current" />
                            {data.merchant.rating}
                          </div>
                        )}
                      </div>
                      {data.merchant?.address && (
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 ml-5 truncate flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5" /> {data.merchant.address}
                        </p>
                      )}
                      {(() => {
                        const status = getStoreStatus(data.merchant?.openingHours);
                        if (!status) return null;
                        return (
                          <p className={cn("text-[9px] ml-5 font-bold flex items-center gap-1", status.color)}>
                            <Clock className="w-2.5 h-2.5" /> {status.text}
                          </p>
                        );
                      })()}
                      {data.merchant?.phone && (
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 ml-5 truncate">{data.merchant.phone}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {data.merchant && (
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.merchant.address + ' ' + data.merchant.name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded-lg hover:text-indigo-600 transition-all"
                          title="Ver no Maps"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
                        R$ {data.total.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {data.items.map((item) => (
                      <div key={item.id} className={cn(
                        "bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2 transition-all",
                        item.purchased && "opacity-60 grayscale-[0.5]"
                      )}>
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button 
                            onClick={() => handleToggleCheck(item)}
                            className={cn(
                              "w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0",
                              item.purchased 
                                ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20" 
                                : "bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-transparent"
                            )}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={cn(
                                "text-xs font-medium text-slate-900 dark:text-zinc-100 truncate",
                                item.purchased && "line-through text-slate-400 dark:text-zinc-500"
                              )}>{item.name}</p>
                              {item.brand && (
                                <span className="text-indigo-500 dark:text-indigo-400 font-bold text-[7px] uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/20 px-1 py-0.5 rounded-sm shrink-0">
                                  {item.brand}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">R$ {item.price.toFixed(2).replace('.', ',')} / {item.unit}</p>
                              {item.originalPrice && item.originalPrice > item.price && (
                                <span className="text-[8px] text-slate-400 line-through">R$ {item.originalPrice.toFixed(2).replace('.', ',')}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-slate-50 dark:bg-zinc-800 rounded-lg p-0.5">
                            <button onClick={async () => {
                              if (!activeSessionId) return;
                              if (!user) {
                                const newList = item.quantity > 1 
                                  ? shoppingList.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i)
                                  : shoppingList.filter(i => i.id !== item.id);
                                localStorage.setItem(`shoppingList_${activeSessionId}`, JSON.stringify(newList));
                                setShoppingList(newList);
                                return;
                              }
                              const itemRef = doc(db, 'users', user.uid, 'chat_sessions', activeSessionId, 'shopping_list', item.id);
                              try {
                                if (item.quantity > 1) await updateDoc(itemRef, { quantity: item.quantity - 1 });
                                else await deleteDoc(itemRef);
                              } catch (error) {
                                handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/chat_sessions/${activeSessionId}/shopping_list/${item.id}`);
                              }
                            }} className="p-1 hover:text-indigo-600"><Minus className="w-3 h-3" /></button>
                            <span className="w-5 text-center text-[10px] font-bold">{item.quantity}</span>
                            <button onClick={async () => {
                              if (!activeSessionId) return;
                              if (!user) {
                                const newList = shoppingList.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
                                localStorage.setItem(`shoppingList_${activeSessionId}`, JSON.stringify(newList));
                                setShoppingList(newList);
                                return;
                              }
                              const itemRef = doc(db, 'users', user.uid, 'chat_sessions', activeSessionId, 'shopping_list', item.id);
                              try {
                                await updateDoc(itemRef, { quantity: item.quantity + 1 });
                              } catch (error) {
                                handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/chat_sessions/${activeSessionId}/shopping_list/${item.id}`);
                              }
                            }} className="p-1 hover:text-indigo-600"><Plus className="w-3 h-3" /></button>
                          </div>
                          <button onClick={async () => {
                            if (!activeSessionId) return;
                            if (!user) {
                              const newList = shoppingList.filter(i => i.id !== item.id);
                              localStorage.setItem(`shoppingList_${activeSessionId}`, JSON.stringify(newList));
                              setShoppingList(newList);
                              return;
                            }
                            try {
                              await deleteDoc(doc(db, 'users', user.uid, 'chat_sessions', activeSessionId, 'shopping_list', item.id));
                            } catch (error) {
                              handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/chat_sessions/${activeSessionId}/shopping_list/${item.id}`);
                            }
                          }} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

    <AnimatePresence>
      {isReminderModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReminderModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl">
                  <Bell className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-zinc-100">Programar Lembrete</h3>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase tracking-widest font-bold">Não esqueça de economizar</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1.5 block tracking-widest flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Data da Compra
                  </label>
                  <input 
                    type="date" 
                    value={tempReminderDate}
                    onChange={(e) => setTempReminderDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 dark:text-zinc-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1.5 block tracking-widest flex items-center gap-2">
                    <Clock className="w-3 h-3" /> Horário
                  </label>
                  <input 
                    type="time" 
                    value={tempReminderTime}
                    onChange={(e) => setTempReminderTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 dark:text-zinc-200"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                {reminder && (
                  <button 
                    onClick={removeReminder}
                    className="flex-1 px-4 py-3 border border-slate-200 dark:border-zinc-800 text-red-500 dark:text-red-400 font-bold rounded-2xl text-xs hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                  >
                    Remover
                  </button>
                )}
                <button 
                  onClick={saveReminder}
                  disabled={!tempReminderDate || !tempReminderTime}
                  className="flex-[2] bg-indigo-600 text-white font-bold px-4 py-3 rounded-2xl text-xs hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all"
                >
                  Salvar Lembrete
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Clear List Confirmation Modal */}
        <AnimatePresence>
          {isClearListModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsClearListModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-sm overflow-hidden"
              >
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-2">Apagar Lista?</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 px-4">
                    Isso removerá permanentemente todos os {shoppingList.length} itens da sua lista de compras atual.
                  </p>
                </div>
                <div className="flex p-4 gap-3 bg-slate-50 dark:bg-zinc-800/50">
                  <button 
                    onClick={() => setIsClearListModalOpen(false)}
                    className="flex-1 py-3 px-4 rounded-2xl text-sm font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleClearList}
                    className="flex-1 py-3 px-4 rounded-2xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all"
                  >
                    Sim, Apagar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {selectedMerchant && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMerchant(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[2.5rem] p-0 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="bg-indigo-600 p-8 text-white relative shrink-0">
                <button 
                  onClick={() => setSelectedMerchant(null)}
                  className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30">
                    <StoreIcon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight">{selectedMerchant.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedMerchant.rating && (
                        <div className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-lg text-xs font-bold backdrop-blur-md">
                          <Star className="w-3 h-3 fill-current text-amber-300" />
                          {selectedMerchant.rating.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-indigo-50">
                    <MapPin className="w-3.5 h-3.5 opacity-70" /> {selectedMerchant.address}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-indigo-50">
                    <Phone className="w-3.5 h-3.5 opacity-70" /> {selectedMerchant.phone}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-indigo-50">
                    <Mail className="w-3.5 h-3.5 opacity-70" /> {selectedMerchant.email}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-indigo-50">
                    <Clock className="w-3.5 h-3.5 opacity-70" /> {selectedMerchant.openingHours || 'Horário não informado'}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50 dark:bg-zinc-950">
                <h4 className="text-xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pl-2">Produtos da Loja</h4>
                <div className="grid grid-cols-1 gap-3">
                  {products.filter(p => p.merchantId === selectedMerchant.id).length === 0 ? (
                    <div className="text-center py-10 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800">
                      <ShoppingBag className="w-8 h-8 text-slate-200 dark:text-zinc-700 mx-auto mb-2" />
                      <p className="text-slate-400 text-xs">Nenhum produto cadastrado ainda.</p>
                    </div>
                  ) : (
                    products.filter(p => p.merchantId === selectedMerchant.id).map(product => {
                      const inList = shoppingList.some(item => item.id === product.id);
                      return (
                        <div key={product.id} className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-900 transition-all group flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h5 className="font-bold text-slate-900 dark:text-zinc-100 text-sm truncate">{product.name}</h5>
                              {product.brand && (
                                <span className="text-indigo-500 dark:text-indigo-400 font-bold text-[7px] uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-md">
                                  {product.brand}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">R$ {product.price.toFixed(2).replace('.', ',')} / {product.unit}</p>
                          </div>
                          <button 
                            onClick={() => handleAddToList(product)}
                            className={cn(
                              "w-10 h-10 rounded-2xl flex items-center justify-center transition-all",
                              inList 
                                ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600" 
                                : "bg-slate-50 dark:bg-zinc-800 text-slate-400 hover:bg-indigo-600 hover:text-white"
                            )}
                          >
                            {inList ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </AnimatePresence>
    </div>
  </div>
</div>
);
}
