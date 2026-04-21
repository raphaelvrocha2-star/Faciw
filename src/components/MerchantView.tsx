import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Plus,
  CreditCard,
  Store,
  Edit2,
  ChevronRight,
  Save,
  X,
  ShoppingCart,
  Check,
  Zap,
  Infinity as InfinityIcon,
  Star,
  ArrowRight,
  FileText,
  Cpu,
  Shield,
  Cloud,
  Lock,
  RefreshCcw,
  Sparkles
} from 'lucide-react';
import Papa from 'papaparse';
import { db } from '../firebase';
import { aiService } from '../services/aiService';
import { 
  collection, 
  addDoc, 
  writeBatch, 
  doc, 
  deleteDoc,
  setDoc,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { Merchant, Product } from '../types';
import { cn } from '../lib/utils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

interface MerchantViewProps {
  user: User | null;
  products: Product[];
  merchants: Merchant[];
  onLogin: () => void;
}

export function MerchantView({ user, products, merchants, onLogin }: MerchantViewProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingStore, setIsAddingStore] = useState(false);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isConfirmingDeleteMerchant, setIsConfirmingDeleteMerchant] = useState(false);

  // Manual Product State
  const [newProductName, setNewProductName] = useState('');
  const [newProductBrand, setNewProductBrand] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductOriginalPrice, setNewProductOriginalPrice] = useState('');
  const [newProductUnit, setNewProductUnit] = useState('unidade');

  // Product Edit State
  const [editProductName, setEditProductName] = useState('');
  const [editProductBrand, setEditProductBrand] = useState('');
  const [editProductPrice, setEditProductPrice] = useState('');
  const [editProductOriginalPrice, setEditProductOriginalPrice] = useState('');
  const [editProductUnit, setEditProductUnit] = useState('unidade');

  // Profile Edit State
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editOpeningHours, setEditOpeningHours] = useState('');

  const myMerchants = React.useMemo(() => merchants.filter(m => m.ownerId === user?.uid), [merchants, user]);
  
  React.useEffect(() => {
    if (!selectedMerchantId && myMerchants.length > 0) {
      setSelectedMerchantId(myMerchants[0].id);
    }
  }, [myMerchants, selectedMerchantId]);

  // Handle Stripe Success Redirect
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const merchantId = params.get('merchant_id');
    const upgrade = params.get('upgrade');

    if (sessionId && merchantId && user) {
      const updatePlan = async () => {
        try {
          if (upgrade === 'pro') {
            await updateDoc(doc(db, 'merchants', merchantId), { plan: 'pro' });
            setSuccess("Parabéns! Sua loja agora é Plano Pro. Aproveite os produtos ilimitados!");
          } else if (upgrade === 'premium') {
            await updateDoc(doc(db, 'merchants', merchantId), { plan: 'premium' });
            setSuccess("Incrível! Sua loja agora é Faciw Premium. Suas promoções estão ativas!");
          }
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
          console.error("Error updating plan:", err);
        }
      };
      updatePlan();
    }
  }, [user]);

  // Auto-upgrade for tester account
  React.useEffect(() => {
    if (user?.email === 'raphaelvrocha2@gmail.com' && myMerchants.length > 0) {
      const upgradeTestAccount = async () => {
        const batch = writeBatch(db);
        let updated = false;
        myMerchants.forEach(m => {
          if (m.plan !== 'premium') {
            batch.update(doc(db, 'merchants', m.id), { plan: 'premium' });
            updated = true;
          }
        });
        if (updated) {
          try {
            await batch.commit();
            setSuccess("Modo Premium ativado automaticamente para sua conta de teste!");
          } catch (err) {
            console.error("Auto-upgrade error:", err);
          }
        }
      };
      upgradeTestAccount();
    }
  }, [user, myMerchants]);

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: user?.uid,
        email: user?.email,
        emailVerified: user?.emailVerified,
        isAnonymous: user?.isAnonymous,
        tenantId: user?.tenantId,
        providerInfo: user?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    return errInfo;
  };

  const currentMerchant = myMerchants.find(m => m.id === selectedMerchantId);
  const merchantProducts = products.filter(p => p.merchantId === selectedMerchantId);

  const startEditing = () => {
    if (!currentMerchant) return;
    setEditName(currentMerchant.name);
    setEditAddress(currentMerchant.address);
    setEditPhone(currentMerchant.phone);
    setEditOpeningHours(currentMerchant.openingHours || '');
    setIsEditingProfile(true);
  };

  const handleUpdateProfile = async () => {
    if (!selectedMerchantId || !user) return;
    const path = `merchants/${selectedMerchantId}`;
    try {
      await updateDoc(doc(db, 'merchants', selectedMerchantId), {
        name: editName,
        address: editAddress,
        phone: editPhone,
        openingHours: editOpeningHours
      });
      setIsEditingProfile(false);
      setSuccess("Perfil atualizado com sucesso!");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      setError("Erro ao atualizar perfil. Verifique suas permissões.");
    }
  };

  const handleRegisterMerchant = async () => {
    if (!user) return;
    const path = 'merchants';
    try {
      const newMerchantRef = doc(collection(db, 'merchants'));
      await setDoc(newMerchantRef, {
        ownerId: user.uid,
        name: editName || 'Novo Comércio',
        email: user.email || '',
        address: editAddress || 'Endereço não cadastrado',
        phone: editPhone || '',
        openingHours: editOpeningHours,
        isSubscribed: true,
        plan: user.email === 'raphaelvrocha2@gmail.com' ? 'premium' : 'free',
        location: { 
          lat: -23.5505 + (Math.random() - 0.5) * 0.1, 
          lng: -46.6333 + (Math.random() - 0.5) * 0.1 
        },
        rating: 4.0 + Math.random(),
        reviewCount: Math.floor(Math.random() * 200) + 10
      });
      setSelectedMerchantId(newMerchantRef.id);
      setIsAddingStore(false);
      setEditName('');
      setEditAddress('');
      setEditPhone('');
      setEditOpeningHours('');
      setSuccess("Novo comércio registrado!");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      setError("Erro ao registrar comércio.");
    }
  };

  const handleUpgradePlan = async (type: 'pro' | 'premium') => {
    if (!selectedMerchantId || !user) {
      console.warn("Cannot upgrade: selectedMerchantId or user is null", { selectedMerchantId, user });
      return;
    }
    setIsSubscribing(true);
    setError(null);

    try {
      // Force token refresh to ensure it's not stale/wrong audience
      const idToken = await user.getIdToken(true);
      const endpoint = type === 'premium' ? '/api/create-premium-checkout-session' : '/api/create-pro-checkout-session';
      console.log(`Creating checkout session for merchant (${type}):`, selectedMerchantId);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          merchantId: selectedMerchantId,
          successUrl: window.location.origin,
          cancelUrl: window.location.origin,
        }),
      });

      const data = await response.json();
      console.log("Stripe response data:", data);
      if (data.url) {
        // Use window.open for better compatibility with iframe environments
        // and to avoid X-Frame-Options issues
        const checkoutWindow = window.open(data.url, '_blank');
        
        if (!checkoutWindow || checkoutWindow.closed || typeof checkoutWindow.closed === 'undefined') {
          // If popup is blocked, fallback to same window redirect
          window.location.href = data.url;
        } else {
          // If opened in new tab, we can show a message to the user
          setSuccess("Página de pagamento aberta em uma nova aba!");
          setIsSubscribing(false);
          setIsUpgradeModalOpen(false);
        }
      } else {
        throw new Error(data.error || "Erro ao criar sessão de pagamento");
      }
    } catch (err: any) {
      console.error("Upgrade error:", err);
      setError(err.message);
      setIsSubscribing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedMerchantId || !currentMerchant) return;

    const isFreePlan = currentMerchant.plan === 'free';
    const currentCount = merchantProducts.length;

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Security: Simulated Malware Scan
      setSuccess("Escaneando arquivo em busca de malware...");
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulating scan time

      let content = "";
      let productsToUpload: any[] = [];

      if (file.type === 'application/pdf') {
        content = await aiService.extractTextFromPDF(file);
      } else {
        // For CSV or other text files
        content = await file.text();
      }

      // Use AI to parse the content intelligently
      productsToUpload = await aiService.parseStockContent(content, file.name);

      if (productsToUpload.length === 0) {
        throw new Error("Não foi possível encontrar produtos no arquivo.");
      }

      const batch = writeBatch(db);
      let count = 0;
      const MAX_BATCH_SIZE = 450;

      for (const product of productsToUpload) {
        if (isFreePlan && (currentCount + count) >= 50) {
          setError("Limite de 50 produtos atingido no Plano Free. Faça upgrade para o Plano Pro para cadastrar mais.");
          break;
        }

        if (count >= MAX_BATCH_SIZE) break;

        const productRef = doc(collection(db, 'products'));
        batch.set(productRef, {
          merchantId: selectedMerchantId,
          name: product.name || 'Produto sem nome',
          brand: product.brand || '',
          price: product.price || 0,
          originalPrice: product.originalPrice || null,
          unit: product.unit || 'unidade',
          category: 'Geral'
        });
        count++;
      }

      if (count > 0) {
        await batch.commit();
        setSuccess(`${count} produtos interpretados por IA e cadastrados com sucesso!`);
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Erro ao processar o arquivo de forma inteligente.");
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const path = `products/${id}`;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
      setError("Erro ao excluir produto.");
    }
  };

  const handleAddProductManual = async () => {
    if (!selectedMerchantId || !user || !currentMerchant) return;
    
    if (currentMerchant.plan === 'free' && merchantProducts.length >= 50) {
      setError("Limite de 50 produtos atingido no Plano Free. Faça upgrade para o Plano Pro.");
      return;
    }

    const path = 'products';
    try {
      await addDoc(collection(db, 'products'), {
        merchantId: selectedMerchantId,
        name: newProductName,
        brand: newProductBrand,
        price: parseFloat(newProductPrice.replace(',', '.')),
        originalPrice: newProductOriginalPrice ? parseFloat(newProductOriginalPrice.replace(',', '.')) : null,
        unit: newProductUnit,
        category: 'Geral'
      });
      setNewProductName('');
      setNewProductBrand('');
      setNewProductPrice('');
      setNewProductOriginalPrice('');
      setIsAddingProduct(false);
      setSuccess("Produto adicionado com sucesso!");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
      setError("Erro ao adicionar produto manualmente.");
    }
  };

  const handleStartEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setEditProductName(product.name);
    setEditProductBrand(product.brand || '');
    setEditProductPrice(product.price.toString().replace('.', ','));
    setEditProductOriginalPrice(product.originalPrice ? product.originalPrice.toString().replace('.', ',') : '');
    setEditProductUnit(product.unit);
  };

  const handleUpdateProduct = async () => {
    if (!editingProductId || !user) return;
    const path = `products/${editingProductId}`;
    try {
      await updateDoc(doc(db, 'products', editingProductId), {
        name: editProductName,
        brand: editProductBrand,
        price: parseFloat(editProductPrice.replace(',', '.')),
        originalPrice: editProductOriginalPrice ? parseFloat(editProductOriginalPrice.replace(',', '.')) : null,
        unit: editProductUnit
      });
      setEditingProductId(null);
      setEditProductBrand('');
      setEditProductOriginalPrice('');
      setSuccess("Produto atualizado com sucesso!");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
      setError("Erro ao atualizar produto.");
    }
  };

  const handleClearAllProducts = () => {
    if (!selectedMerchantId || !user || merchantProducts.length === 0) return;
    setIsConfirmingClear(true);
  };

  const executeClearAllProducts = async () => {
    if (!selectedMerchantId || !user) return;
    setIsConfirmingClear(false);
    
    const path = 'products (batch delete)';
    try {
      const batch = writeBatch(db);
      merchantProducts.forEach(p => {
        batch.delete(doc(db, 'products', p.id));
      });
      await batch.commit();
      setSuccess("Todos os produtos foram removidos com sucesso.");
      setError(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      setError("Erro ao remover produtos.");
    }
  };

  const handleDeleteMerchant = async () => {
    if (!selectedMerchantId || !user) return;
    const path = `merchants/${selectedMerchantId}`;
    try {
      // 1. Delete all products of this merchant
      const batch = writeBatch(db);
      merchantProducts.forEach(p => {
        batch.delete(doc(db, 'products', p.id));
      });
      await batch.commit();

      // 2. Delete the merchant itself
      await deleteDoc(doc(db, 'merchants', selectedMerchantId));
      
      setIsConfirmingDeleteMerchant(false);
      setSelectedMerchantId(null);
      setSuccess("Comércio excluído com sucesso!");
      setError(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
      setError("Erro ao excluir comércio. Verifique suas permissões.");
    }
  };

  if (!user) {
    return (
      <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <ShoppingCart className="w-16 h-16 text-indigo-600 dark:text-indigo-500 mx-auto mb-4" />
        <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 mb-2">Área do Comerciante</h2>
        <p className="text-slate-600 dark:text-zinc-400 mb-8 max-w-md mx-auto">
          Gerencie seu inventário com o poder da inteligência artificial e conecte-se com milhares de clientes.
        </p>
        <button
          onClick={onLogin}
          className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20"
        >
          Entrar com Google
        </button>
      </div>
    );
  }

  if (myMerchants.length === 0 || isAddingStore) {
    return (
      <div className="max-w-md mx-auto py-12">
        <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-xl">
              <Store className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-zinc-100">
              {isAddingStore ? 'Nova Unidade' : 'Bem-vindo ao Faciw!'}
            </h2>
          </div>
          
          <p className="text-slate-600 dark:text-zinc-400 mb-6 text-sm">
            {isAddingStore 
              ? 'Preencha os dados básicos para criar sua nova unidade ou loja.' 
              : 'Parece que você ainda não registrou seu comércio. Comece agora!'}
          </p>

          <div className="space-y-4 mb-8">
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 block tracking-widest">Nome da Loja</label>
              <input 
                type="text" 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ex: Supermercado Local" 
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 block tracking-widest">Endereço</label>
              <input 
                type="text" 
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="Rua, Número, Bairro, Cidade"
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 block tracking-widest">Horário de Funcionamento</label>
              <input 
                type="text" 
                value={editOpeningHours}
                onChange={(e) => setEditOpeningHours(e.target.value)}
                placeholder="Ex: Seg-Sex 08:00 - 18:00"
                className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleRegisterMerchant}
              disabled={!editName.trim()}
              className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
            >
              {isAddingStore ? 'Criar Unidade' : 'Ativar Meu Comércio'}
            </button>
            {isAddingStore && (
              <button
                onClick={() => setIsAddingStore(false)}
                className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 py-3.5 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 relative">
      {/* Upgrade Modal */}
      {isUpgradeModalOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-slate-950/95 backdrop-blur-xl transition-all duration-500 overflow-y-auto"
          onClick={() => setIsUpgradeModalOpen(false)}
        >
          <div 
            className="relative w-full max-w-6xl mx-auto my-auto animate-in fade-in zoom-in-95 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Standard "X" Close Button */}
            <button 
              onClick={() => setIsUpgradeModalOpen(false)}
              className="absolute -top-16 right-0 md:-top-4 md:-right-4 z-50 p-3 bg-white text-slate-900 rounded-full shadow-2xl hover:scale-110 active:scale-90 transition-all cursor-pointer border-4 border-slate-950"
              aria-label="Fechar"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch pt-4">
              {/* PLAN FREE */}
              <div className="bg-white dark:bg-zinc-900 rounded-[3rem] p-8 border border-slate-200 dark:border-zinc-800 shadow-xl flex flex-col transition-all hover:scale-[1.02]">
                <div className="mb-8">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-6">
                    <Store className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Plano Free</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900 dark:text-white leading-none">R$ 0</span>
                    <span className="text-slate-400 font-bold text-sm">/eterno</span>
                  </div>
                </div>

                <div className="space-y-4 mb-10 flex-1">
                  {[
                    "Até 50 produtos",
                    "Visibilidade local básica",
                    "Acesso ao painel",
                    "Suporte via e-mail"
                  ].map((feat, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-1 rounded-full text-emerald-600">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-sm font-bold text-slate-600 dark:text-zinc-400 truncate">{feat}</span>
                    </div>
                  ))}
                </div>

                <button 
                  disabled 
                  className="w-full py-4 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-400 font-black text-sm uppercase tracking-widest"
                >
                  Plano Atual
                </button>
              </div>

              {/* PLAN PRO */}
              <div className="bg-indigo-600 rounded-[3rem] p-8 text-white shadow-[0_30px_60px_-15px_rgba(79,70,229,0.5)] flex flex-col transition-all hover:scale-[1.05] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4">
                  <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm border border-white/20">
                    Mais Popular
                  </div>
                </div>
                
                <div className="mb-8">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2">Faciw Pro</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white leading-none">R$ 49,99</span>
                    <span className="text-white/60 font-bold text-sm">/mês</span>
                  </div>
                </div>

                <div className="space-y-4 mb-10 flex-1">
                  {[
                    "Estoque Ilimitado",
                    "Prioridade na IA",
                    "Suporte VIP 24/7"
                  ].map((feat, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="bg-white/20 p-1 rounded-full text-white">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-sm font-bold text-indigo-50 truncate">{feat}</span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => handleUpgradePlan('pro')}
                  disabled={isSubscribing}
                  className="w-full py-4 rounded-2xl bg-white text-indigo-600 font-black text-sm uppercase tracking-widest hover:bg-indigo-50 transition-colors shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isSubscribing ? 'Processando...' : 'Ativar Pro Now'}
                </button>
              </div>

              {/* PLAN PREMIUM */}
              <div className="bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-[3rem] p-8 text-white shadow-[0_30px_60px_-15px_rgba(16,185,129,0.3)] flex flex-col transition-all hover:scale-[1.02] relative overflow-hidden group">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all" />
                
                <div className="mb-8">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2">Faciw Premium</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white leading-none">R$ 79,99</span>
                    <span className="text-white/60 font-bold text-sm">/mês</span>
                  </div>
                </div>

                <div className="space-y-4 mb-10 flex-1">
                  {[
                    "Tudo do Plano Pro",
                    "Gerenciador de Promoções",
                    "Ranking de Pesquisa #1"
                  ].map((feat, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="bg-white/20 p-1 rounded-full text-white">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-sm font-bold text-emerald-50 truncate">{feat}</span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => handleUpgradePlan('premium')}
                  disabled={isSubscribing}
                  className="w-full py-4 rounded-2xl bg-zinc-900 text-white font-black text-sm uppercase tracking-widest hover:bg-black transition-colors shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isSubscribing ? 'Processando...' : 'Ativar Premium'}
                </button>
              </div>
            </div>

            <p className="text-center text-[10px] text-white/40 mt-12 font-bold uppercase tracking-widest pb-8">
              Pagamentos processados pelo Stripe • Criptografia Bancária • Sem fidelidade
            </p>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {isConfirmingClear && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
            <div className="bg-red-100 dark:bg-red-900/30 w-16 h-16 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-6">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 text-center mb-2">Limpar Estoque?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-8 font-medium">
              Esta ação irá apagar <span className="font-bold text-red-600">TODOS</span> os produtos desta loja. Esta operação é irreversível.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={executeClearAllProducts}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-200 dark:shadow-none"
              >
                Sim, Apagar Tudo
              </button>
              <button
                onClick={() => setIsConfirmingClear(false)}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-4 rounded-2xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Merchant Confirmation Modal */}
      {isConfirmingDeleteMerchant && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
            <div className="bg-red-100 dark:bg-red-900/30 w-16 h-16 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 text-center mb-2">Excluir Comércio?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-8 font-medium">
              Esta ação irá apagar permanentemente a loja <span className="font-bold text-red-600">"{currentMerchant?.name}"</span> e TODOS os seus produtos.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleDeleteMerchant}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-200 dark:shadow-none"
              >
                Sim, Excluir Definitivamente
              </button>
              <button
                onClick={() => setIsConfirmingDeleteMerchant(false)}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-4 rounded-2xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar: Store Selector */}
      <div className="lg:col-span-3 space-y-6">
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider">Minhas Lojas</h3>
            <button 
              onClick={() => {
                setEditName('');
                setEditAddress('');
                setEditPhone('');
                setIsAddingStore(true);
              }}
              className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {myMerchants.map(m => (
              <button
                key={m.id}
                onClick={() => {
                  setSelectedMerchantId(m.id);
                  setIsEditingProfile(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-2xl transition-all text-left group",
                  selectedMerchantId === m.id 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20" 
                    : "bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Store className={cn("w-4 h-4 shrink-0", selectedMerchantId === m.id ? "text-white" : "text-indigo-600")} />
                  <span className="text-sm font-bold truncate">{m.name}</span>
                </div>
                <ChevronRight className={cn("w-4 h-4 shrink-0 transition-transform", selectedMerchantId === m.id ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100")} />
              </button>
            ))}
          </div>
        </div>

        {currentMerchant && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Perfil da Loja</h3>
              {!isEditingProfile && (
                <button 
                  onClick={startEditing}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {isEditingProfile ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nome</label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Endereço</label>
                  <input 
                    type="text" 
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Telefone</label>
                  <input 
                    type="text" 
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Horário de Funcionamento</label>
                  <input 
                    type="text" 
                    value={editOpeningHours}
                    onChange={(e) => setEditOpeningHours(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    placeholder="Ex: Seg-Sex 08:00 - 18:00"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={handleUpdateProfile}
                    className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <Save className="w-3 h-3" /> Salvar
                  </button>
                  <button 
                    onClick={() => setIsEditingProfile(false)}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <X className="w-3 h-3" /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Nome</label>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{currentMerchant.name}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Endereço</label>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{currentMerchant.address}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Telefone</label>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{currentMerchant.phone || 'Não informado'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Horário de Funcionamento</label>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{currentMerchant.openingHours || 'Não informado'}</p>
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 uppercase font-bold">Plano Atual</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full font-bold uppercase",
                      currentMerchant.plan === 'pro' ? "bg-indigo-100 text-indigo-700" : 
                      currentMerchant.plan === 'premium' ? "bg-emerald-100 text-emerald-700" :
                      "bg-slate-100 text-slate-600"
                    )}>
                      {currentMerchant.plan === 'pro' ? 'Faciw Pro' : currentMerchant.plan === 'premium' ? 'Premium' : 'Free'}
                    </span>
                  </div>
                  {(currentMerchant.plan !== 'pro' && currentMerchant.plan !== 'premium') && (
                    <div className="pt-2">
                      <button 
                        onClick={() => setIsUpgradeModalOpen(true)}
                        className="w-full relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-white dark:to-slate-100 text-white dark:text-slate-900 py-4 rounded-2xl text-sm font-black transition-all hover:scale-[1.05] active:scale-[0.95] shadow-[0_10px_30px_-10px_rgba(79,70,229,0.5)] dark:shadow-none flex flex-col items-center justify-center gap-1 group border border-indigo-500/30"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-cyan-500/20 to-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity animate-pulse" />
                        <div className="flex items-center gap-2 relative z-10">
                          <ShoppingCart className="w-5 h-5 text-indigo-500 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                          <span className="uppercase tracking-tighter">Planos Faciw</span>
                        </div>
                        <span className="text-[9px] opacity-60 font-medium relative z-10">Vendas Ilimitadas & IA</span>
                      </button>
                      <div className="mt-3 flex items-center justify-center gap-1.5">
                        <div className="h-1 w-1 rounded-full bg-indigo-500 animate-ping" />
                        <p className="text-[9px] text-center text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest">Oferta Especial Ativa</p>
                      </div>
                    </div>
                  )}
                   {currentMerchant.plan === 'pro' && (
                    <div className="pt-2">
                       <button 
                         onClick={() => setIsUpgradeModalOpen(true)}
                         className="w-full relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-600 text-white py-4 rounded-2xl text-sm font-black transition-all hover:scale-[1.05] active:scale-[0.95] flex flex-col items-center justify-center gap-1 group shadow-[0_10px_20px_-5px_rgba(16,185,129,0.4)]"
                       >
                         <div className="flex items-center gap-2 relative z-10">
                           <Sparkles className="w-5 h-5 text-white" />
                           <span className="uppercase tracking-tighter">Upgrade para Premium</span>
                         </div>
                       </button>
                    </div>
                  )}

                  {/* Admin Auto-Upgrade for Test Account */}
                  {user?.email === 'raphaelvrocha2@gmail.com' && currentMerchant.plan !== 'premium' && (
                    <div className="pt-6 border-t border-dashed border-indigo-200 dark:border-indigo-900 mt-4">
                      <button
                        onClick={async () => {
                          if (!selectedMerchantId) return;
                          try {
                            setIsSubscribing(true);
                            await updateDoc(doc(db, 'merchants', selectedMerchantId), { plan: 'premium' });
                            setSuccess("Modo Premium ativado automaticamente para sua conta de teste!");
                          } catch (err) {
                            setError("Falha ao ativar modo teste.");
                          } finally {
                            setIsSubscribing(false);
                          }
                        }}
                        className="w-full py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                      >
                        <Zap className="w-3 h-3 animate-bounce" />
                        Ativar Teste Premium (Admin Only)
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Assinatura</span>
                    <span className="text-indigo-600 font-bold">Ativa</span>
                  </div>

                  {/* Security Center */}
                  <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-2xl border border-slate-100 dark:border-zinc-800 space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Login Seguro</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600">SISTEMA ATIVO</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-3 h-3 text-sky-600" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Backups</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-bold text-slate-700 dark:text-zinc-300">DIÁRIO OK</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="w-3 h-3 text-indigo-600" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Malware Scan</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-700 dark:text-zinc-300">PROTEGIDO</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200/50 dark:border-zinc-700/50 flex items-center justify-center gap-2">
                      <RefreshCcw className="w-3 h-3 text-slate-400" />
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">WAF & Firewall Ativo</span>
                    </div>
                  </div>
                  <div className="pt-6 border-t border-slate-100 dark:border-zinc-800">
                    <button 
                      onClick={() => setIsConfirmingDeleteMerchant(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-100 dark:border-red-900/20 active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir Comércio
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content: Products & Upload */}
      <div className="lg:col-span-9 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
              Uploader Inteligente (IA)
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              Envie sua lista em <span className="font-bold text-indigo-600">PDF ou CSV</span>. Nossa IA interpretará preços e unidades automaticamente.
            </p>
            
            <label className={cn(
              "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-all relative overflow-hidden",
              isUploading 
                ? "bg-slate-50 dark:bg-zinc-800 border-indigo-300 dark:border-indigo-700" 
                : "bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300 dark:hover:border-indigo-700"
            )}>
              <div className="flex flex-col items-center justify-center pt-5 pb-6 relative z-10">
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                    <p className="text-[10px] font-black text-indigo-600 animate-pulse">IA ANALISANDO ARQUIVO...</p>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 mb-2">
                      <FileText className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                      <FileSpreadsheet className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <p className="text-xs text-indigo-800 dark:text-indigo-200 font-bold uppercase tracking-wider">Selecionar PDF ou CSV</p>
                  </>
                )}
              </div>
              <input type="file" className="hidden" accept=".csv,.pdf" onChange={handleFileUpload} disabled={isUploading} />
            </label>

            {(error || success) && (
              <div className={cn(
                "mt-4 p-3 rounded-xl flex items-center gap-2 text-xs font-medium",
                error ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-800" : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800"
              )}>
                {error ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {error || success}
              </div>
            )}
          </div>

          <div className="bg-indigo-900 text-white p-6 rounded-3xl shadow-lg shadow-indigo-900/20 relative overflow-hidden flex flex-col justify-center">
            <Store className="absolute -right-6 -bottom-6 w-32 h-32 text-indigo-800/50 -rotate-12" />
            <h3 className="text-xl font-bold mb-2 relative z-10 uppercase tracking-tight">Gerenciamento Ágil</h3>
            <p className="text-indigo-100 text-sm relative z-10 leading-relaxed">
              Mantenha os preços da sua loja atualizados para que nossa IA possa recomendar seus produtos aos clientes próximos.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Produtos em Estoque ({merchantProducts.length})</h3>
            <div className="flex gap-2">
              {merchantProducts.length > 0 && (
                <button 
                  onClick={handleClearAllProducts}
                  className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-red-100 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Limpar Tudo
                </button>
              )}
              <button 
                onClick={() => setIsAddingProduct(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 dark:shadow-none"
              >
                <Plus className="w-4 h-4" />
                Adicionar Manual
              </button>
            </div>
          </div>

          {isAddingProduct && (
            <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nome do Produto</label>
                  <input 
                    type="text" 
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="Ex: Arroz 5kg"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Marca</label>
                  <input 
                    type="text" 
                    value={newProductBrand}
                    onChange={(e) => setNewProductBrand(e.target.value)}
                    placeholder="Ex: Tio João"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Preço (R$)</label>
                  <input 
                    type="text" 
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none font-bold text-indigo-600"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block">Preço Original</label>
                    {currentMerchant?.plan !== 'premium' && (
                      <span className="text-[8px] bg-amber-100 text-amber-600 px-1 py-0.5 rounded font-black uppercase ring-1 ring-amber-200 animate-pulse">Premium</span>
                    )}
                  </div>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={newProductOriginalPrice}
                      onChange={(e) => setNewProductOriginalPrice(e.target.value)}
                      placeholder={currentMerchant?.plan === 'premium' ? "Ex: 49,99" : "🔓 Upgrade para usar"}
                      disabled={currentMerchant?.plan !== 'premium'}
                      className={cn(
                        "w-full bg-white dark:bg-slate-900 border rounded-xl px-3 py-2 text-sm focus:outline-none transition-all",
                        currentMerchant?.plan === 'premium' 
                          ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-900/10 placeholder:text-emerald-500/50" 
                          : "border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-800/50"
                      )}
                    />
                    {currentMerchant?.plan === 'premium' && newProductOriginalPrice && parseFloat(newProductOriginalPrice.replace(',', '.')) > parseFloat(newProductPrice.replace(',', '.')) && (
                      <div className="absolute top-1/2 -right-3 -translate-y-1/2 bg-rose-500 text-white text-[7px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest shadow-lg animate-pulse">Promo</div>
                    )}
                    {currentMerchant?.plan !== 'premium' && (
                      <button 
                        type="button"
                        onClick={() => setIsUpgradeModalOpen(true)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        title="Faça upgrade para Premium para ativar promoções"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Unidade</label>
                  <select 
                    value={newProductUnit}
                    onChange={(e) => setNewProductUnit(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="unidade">Unidade</option>
                    <option value="kg">Quilo (kg)</option>
                    <option value="litro">Litro (L)</option>
                    <option value="pacote">Pacote</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleAddProductManual}
                  disabled={!newProductName || !newProductPrice}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  Salvar Produto
                </button>
                <button 
                  onClick={() => setIsAddingProduct(false)}
                  className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-6 py-2 rounded-xl text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Produto</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Preço</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">Promo</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Unidade</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {merchantProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 dark:text-slate-600 italic text-sm">
                      Nenhum produto cadastrado para esta loja.
                    </td>
                  </tr>
                ) : (
                  merchantProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                        {editingProductId === product.id ? (
                          <div className="flex flex-col gap-2">
                            <input 
                              type="text" 
                              value={editProductName}
                              onChange={(e) => setEditProductName(e.target.value)}
                              placeholder="Nome"
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm focus:outline-none"
                            />
                            <input 
                              type="text" 
                              value={editProductBrand}
                              onChange={(e) => setEditProductBrand(e.target.value)}
                              placeholder="Marca"
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[10px] focus:outline-none"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>{product.name}</span>
                            {product.brand && (
                              <span className="text-blue-500 dark:text-blue-400 font-bold text-[10px] uppercase tracking-wider bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">
                                {product.brand}
                              </span>
                            )}
                            {product.originalPrice && product.originalPrice > product.price && (
                              <span className="text-[8px] bg-rose-500 text-white px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest animate-pulse flex items-center gap-0.5">
                                <Zap className="w-2 h-2 fill-current" />
                                PROMO
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-indigo-600 dark:text-indigo-400 font-bold">
                        {editingProductId === product.id ? (
                           <div className="flex flex-col gap-1">
                             <input 
                               type="text" 
                               value={editProductPrice}
                               onChange={(e) => setEditProductPrice(e.target.value)}
                               placeholder="Preço Venda"
                               className="w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm focus:outline-none font-bold text-indigo-600 shadow-sm"
                             />
                             {editProductOriginalPrice && parseFloat(editProductOriginalPrice.replace(',', '.')) > parseFloat(editProductPrice.replace(',', '.')) && (
                               <span className="text-[8px] bg-emerald-500 text-white px-1 py-0.5 rounded font-black uppercase text-center">Promo Ativa</span>
                             )}
                           </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-black">R$ {product.price.toFixed(2).replace('.', ',')}</span>
                            {product.originalPrice && product.originalPrice > product.price && (
                              <span className="text-[10px] text-slate-400 line-through font-medium">
                                R$ {product.originalPrice.toFixed(2).replace('.', ',')}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {editingProductId === product.id ? (
                          <div className="flex flex-col gap-1 items-center">
                             <input 
                               type="text" 
                               value={editProductOriginalPrice}
                               onChange={(e) => setEditProductOriginalPrice(e.target.value)}
                               placeholder={currentMerchant?.plan === 'premium' ? "Origi." : "Premium"}
                               disabled={currentMerchant?.plan !== 'premium'}
                               className={cn(
                                 "w-20 border rounded-lg px-2 py-1 text-[10px] focus:outline-none text-center",
                                 currentMerchant?.plan === 'premium'
                                   ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800"
                                   : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-50 cursor-not-allowed"
                               )}
                             />
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            {product.originalPrice && product.originalPrice > product.price ? (
                              <span className="bg-emerald-500 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter animate-bounce shadow-lg shadow-emerald-500/20">
                                PROMO
                              </span>
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800" />
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-500">
                        {editingProductId === product.id ? (
                          <select 
                            value={editProductUnit}
                            onChange={(e) => setEditProductUnit(e.target.value)}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs focus:outline-none"
                          >
                            <option value="unidade">Unidade</option>
                            <option value="kg">kg</option>
                            <option value="litro">L</option>
                            <option value="pacote">Pct</option>
                          </select>
                        ) : product.unit}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {editingProductId === product.id ? (
                            <>
                              <button 
                                onClick={handleUpdateProduct}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setEditingProductId(null)}
                                className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                onClick={() => handleStartEditProduct(product)}
                                className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteProduct(product.id)}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
