import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  deleteDoc, 
  doc, 
  writeBatch,
  getDocs,
  setDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut 
} from 'firebase/auth';
import { db, auth } from './firebase';
import { Merchant, Product, ChatMessage, ShoppingItem, ChatSession } from './types';
import { handleFirestoreError, OperationType } from './lib/firestoreUtils';
import { Navbar } from './components/Navbar';
import { MerchantView } from './components/MerchantView';
import { CustomerView } from './components/CustomerView';
import { LandingPage } from './components/LandingPage';
import { CookieConsent } from './components/CookieConsent';
import { SecurityBadges } from './components/SecurityBadges';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'home' | 'customer' | 'merchant'>(() => {
    const hasVisited = typeof window !== 'undefined' ? localStorage.getItem('faciw_visited') : null;
    return hasVisited ? 'customer' : 'home';
  });
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [reminder, setReminder] = useState<{ date: string; time: string } | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    } else {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    }

    // Always create a fresh session on app entry/refresh
    handleCreateSession();
  }, []);

  const toggleDarkMode = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const qMerchants = query(collection(db, 'merchants'));
    const unsubMerchants = onSnapshot(qMerchants, (snapshot) => {
      const mData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Merchant));
      setMerchants(mData);
    });

    const qProducts = query(collection(db, 'products'));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      const pData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(pData);
    });

    return () => {
      unsubMerchants();
      unsubProducts();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      if (activeSessionId) {
        const localList = localStorage.getItem(`shoppingList_${activeSessionId}`);
        if (localList) {
          setShoppingList(JSON.parse(localList));
        } else {
          setShoppingList([]);
        }
      } else {
        setShoppingList([]);
      }
      return;
    }

    if (!activeSessionId) {
      setShoppingList([]);
      return;
    }

    const qShopping = query(collection(db, 'users', user.uid, 'chat_sessions', activeSessionId, 'shopping_list'));
    const unsubShopping = onSnapshot(qShopping, async (snapshot) => {
      const sData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShoppingItem));
      
      // Sync local items to Firestore if they exist for this specific session
      const localListStr = localStorage.getItem(`shoppingList_${activeSessionId}`);
      if (localListStr) {
        const localList = JSON.parse(localListStr) as ShoppingItem[];
        if (localList.length > 0) {
          const batch = writeBatch(db);
          localList.forEach(item => {
            const itemRef = doc(db, 'users', user.uid, 'chat_sessions', activeSessionId, 'shopping_list', item.id);
            batch.set(itemRef, { ...item, addedAt: item.addedAt || Date.now() }, { merge: true });
          });
          await batch.commit();
          localStorage.removeItem(`shoppingList_${activeSessionId}`);
        }
      }
      
      setShoppingList(sData);
    });

    return () => unsubShopping();
  }, [user, activeSessionId]);

  useEffect(() => {
    if (!user) {
      const localSessions = localStorage.getItem('chatSessions');
      if (localSessions) {
        const parsed = JSON.parse(localSessions);
        setChatSessions(parsed);
        if (parsed.length > 0 && !activeSessionId) {
          setActiveSessionId(parsed[0].id);
        }
      }
      setSessionsLoaded(true);
      return;
    }

    const qSessions = query(collection(db, 'users', user.uid, 'chat_sessions'));
    const unsubSessions = onSnapshot(qSessions, (snapshot) => {
      const sData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
      const sortedDbSessions = sData.sort((a, b) => b.createdAt - a.createdAt);
      
      setChatSessions(prev => {
        // Keep sessions from DB, and also keep any "unsaved" session if it's the active one
        // An unsaved session is one with only 1 message (the greeting)
        const unsavedSessions = prev.filter(ps => 
          ps.messages.length <= 1 && 
          !sData.some(sd => sd.id === ps.id)
        );
        
        const combined = [...sortedDbSessions, ...unsavedSessions];
        
        // Ensure uniqueness by ID to prevent duplicate key errors
        const uniqueCombined = combined.filter((s, index, self) =>
          index === self.findIndex((t) => t.id === s.id)
        );

        return uniqueCombined.sort((a, b) => b.createdAt - a.createdAt);
      });

      if (sData.length > 0 && !activeSessionId) {
        setActiveSessionId(sortedDbSessions[0].id);
      }
      setSessionsLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/chat_sessions`);
      setSessionsLoaded(true);
    });

    return () => unsubSessions();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubReminder = onSnapshot(doc(db, 'users', user.uid, 'settings', 'reminder'), (doc) => {
      if (doc.exists()) {
        setReminder(doc.data() as { date: string; time: string });
      } else {
        setReminder(null);
      }
    });
    return () => unsubReminder();
  }, [user]);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn("Geolocation permission denied or error:", error);
          // Default to a central point if needed or leave null
        }
      );
    }
  }, []);

  const updateReminder = async (newReminder: { date: string; time: string } | null) => {
    if (!user) {
      if (newReminder) {
        localStorage.setItem('shoppingReminder', JSON.stringify(newReminder));
        setReminder(newReminder);
      } else {
        localStorage.removeItem('shoppingReminder');
        setReminder(null);
      }
      return;
    }

    try {
      const reminderRef = doc(db, 'users', user.uid, 'settings', 'reminder');
      if (newReminder) {
        await setDoc(reminderRef, newReminder);
      } else {
        await deleteDoc(reminderRef);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/settings/reminder`);
    }
  };

  const handleUpdateSession = async (session: ChatSession) => {
    // Only persist if it has more than 1 message (user is interacting)
    if (session.messages.length <= 1) {
      setChatSessions(prev => prev.map(s => s.id === session.id ? session : s));
      return;
    }

    if (!user) {
      const newSessions = chatSessions.map(s => s.id === session.id ? session : s);
      if (!chatSessions.find(s => s.id === session.id)) {
        newSessions.push(session);
      }
      const filteredPersist = newSessions.filter(s => s.messages.length > 1);
      setChatSessions(newSessions);
      localStorage.setItem('chatSessions', JSON.stringify(filteredPersist));
      return;
    }

    try {
      await setDoc(doc(db, 'users', user.uid, 'chat_sessions', session.id), session);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/chat_sessions/${session.id}`);
    }
  };

  const handleCreateSession = async () => {
    // If there's already an "empty" session, just switch to it instead of creating another one
    const existingEmpty = chatSessions.find(s => s.messages.length <= 1);
    if (existingEmpty) {
      setActiveSessionId(existingEmpty.id);
      return;
    }

    const newSession: ChatSession = {
      id: Math.random().toString(36).substring(7),
      title: 'Nova Conversa',
      messages: [{ role: 'model', content: 'Olá! Como posso te ajudar a economizar hoje?' }],
      recommendations: [],
      createdAt: Date.now()
    };

    // Just update state, don't persist yet
    setChatSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteSession = async (id: string) => {
    const remainingSessions = chatSessions.filter(s => s.id !== id);
    
    // Clean up local storage
    localStorage.removeItem(`shoppingList_${id}`);

    if (!user) {
      setChatSessions(remainingSessions);
      localStorage.setItem('chatSessions', JSON.stringify(remainingSessions));
      if (activeSessionId === id) setActiveSessionId(remainingSessions[0]?.id || null);
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'chat_sessions', id));
      if (activeSessionId === id) {
        setActiveSessionId(remainingSessions[0]?.id || null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/chat_sessions/${id}`);
    }
  };

  const clearEmptySessions = async () => {
    // Sessions with only 1 message (the initial model greeting) are considered "ghost" or empty
    const emptySessions = chatSessions.filter(s => s.messages.length <= 1);
    if (emptySessions.length === 0) return;

    // Clean up local storage for these empty sessions
    emptySessions.forEach(s => localStorage.removeItem(`shoppingList_${s.id}`));

    if (!user) {
      const filtered = chatSessions.filter(s => s.messages.length > 1);
      setChatSessions(filtered);
      localStorage.setItem('chatSessions', JSON.stringify(filtered));
      if (emptySessions.some(s => s.id === activeSessionId)) {
        setActiveSessionId(filtered[0]?.id || null);
      }
      return;
    }

    try {
      const batch = writeBatch(db);
      emptySessions.forEach(s => {
        batch.delete(doc(db, 'users', user.uid, 'chat_sessions', s.id));
      });
      await batch.commit();
      
      if (emptySessions.some(s => s.id === activeSessionId)) {
        const remaining = chatSessions.filter(s => s.messages.length > 1);
        setActiveSessionId(remaining[0]?.id || null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/chat_sessions (batch delete)`);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed", error);
      // alert or some UI feedback would be nice, but instructions say avoid window.alert
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="text-slate-500 font-medium animate-pulse">Iniciando Faciw...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors bg-slate-50 dark:bg-zinc-950">
      <Navbar 
        user={user} 
        view={view} 
        setView={setView} 
        onLogin={handleLogin} 
        onLogout={handleLogout}
        isDark={isDark}
        toggleDarkMode={toggleDarkMode}
      />
      
      <main className={cn(
        "max-w-7xl mx-auto px-2 lg:px-4 w-full flex flex-col",
        view === 'home' ? "py-0" : "flex-1 pt-2 pb-0 lg:py-4"
      )}>
        <AnimatePresence mode="wait">
          {view === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <LandingPage 
                onStartExploring={() => {
                  localStorage.setItem('faciw_visited', 'true');
                  setView('customer');
                }} 
                onGoToMerchant={() => {
                  localStorage.setItem('faciw_visited', 'true');
                  setView('merchant');
                }} 
              />
            </motion.div>
          ) : view === 'customer' ? (
            <motion.div
              key="customer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col"
            >
              <CustomerView 
                products={products} 
                merchants={merchants} 
                shoppingList={shoppingList}
                setShoppingList={setShoppingList}
                user={user}
                onLogin={handleLogin}
                sessions={chatSessions}
                sessionsLoaded={sessionsLoaded}
                activeSessionId={activeSessionId}
                setActiveSessionId={setActiveSessionId}
                onUpdateSession={handleUpdateSession}
                onCreateSession={handleCreateSession}
                onDeleteSession={handleDeleteSession}
                onClearEmptySessions={clearEmptySessions}
                userLocation={userLocation}
                reminder={reminder}
                onUpdateReminder={updateReminder}
              />
            </motion.div>
          ) : (
            <motion.div
              key="merchant"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <MerchantView user={user} products={products} merchants={merchants} onLogin={handleLogin} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {view !== 'home' && (
        <footer className="hidden lg:block bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 py-12 mt-12 transition-colors">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <span className="font-black tracking-tighter text-xl dark:text-white">FACIW</span>
              </div>
              <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium">&copy; 2026 Praxus - Faciw, conectando você ao melhor comércio local.</p>
              <div className="flex flex-col gap-2">
                <SecurityBadges />
                <div className="flex gap-6 justify-center md:justify-end">
                  <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors text-sm font-bold">Termos</a>
                  <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors text-sm font-bold">Privacidade</a>
                  <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors text-sm font-bold">Contato</a>
                </div>
              </div>
            </div>
          </div>
        </footer>
      )}
      
      <CookieConsent />
    </div>
  );
}
