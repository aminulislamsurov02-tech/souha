/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Menu, 
  X, 
  ArrowRight, 
  Instagram, 
  Twitter, 
  Facebook,
  Search,
  User,
  Star,
  Settings,
  CheckCircle,
  Loader2,
  Youtube,
  Play,
  ExternalLink,
  Music2,
  MessageSquare
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db, auth } from './lib/firebase';
import { signInWithPopup, GoogleAuthProvider, User as FirebaseUser } from 'firebase/auth';
import AdminPanel from './components/AdminPanel';

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Product {
  id: string;
  name: string;
  price: string;
  category: string;
  image: string;
  rating: number;
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<'shop' | 'admin'>('shop');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'bkash' | 'nagad' | 'credit_card' | 'debit_card'>('bkash');
  const [cartItems, setCartItems] = useState<{product: Product, quantity: number}[]>([]);
  const [supportForm, setSupportForm] = useState({
    subject: '',
    message: '',
    type: 'complaint' as 'complaint' | 'review' | 'inquiry'
  });
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
    });

    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);

    const testConnection = async () => {
      const { doc, getDocFromServer } = await import('firebase/firestore');
      try {
        await getDocFromServer(doc(db, 'settings', 'global'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const fetchSettings = async () => {
      const path = 'settings/global';
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'global'));
        if (docSnap.exists()) {
          setSettings(docSnap.data());
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, path);
      }
    };

    fetchSettings();

    // Real-time products sync
    const qPath = 'products';
    const q = query(collection(db, qPath), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, qPath);
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      unsubscribe();
      unsubscribeAuth();
    };
  }, []);

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Sign in error:", err);
    }
  };

  const handleOrder = async (product: Product | {product: Product, quantity: number}[]) => {
    if (!user) {
      handleSignIn();
      return;
    }

    setOrderLoading(true);
    const path = 'orders';
    try {
      const itemsToOrder = Array.isArray(product) ? product : [{ product, quantity: 1 }];
      
      for (const item of itemsToOrder) {
        await addDoc(collection(db, path), {
          productId: item.product.id,
          productName: item.product.name,
          customerEmail: user.email,
          paymentMethod: selectedPaymentMethod,
          status: 'pending',
          createdAt: serverTimestamp()
        });
      }

      setOrderSuccess(true);
      if (Array.isArray(product)) {
        setCartItems([]);
        setTimeout(() => setIsCartOpen(false), 2000);
      }
      setTimeout(() => {
        setOrderSuccess(false);
        setSelectedProduct(null);
      }, 2500);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setOrderLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.product.id === id) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCartItems(prev => prev.filter(item => item.product.id !== id));
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      handleSignIn();
      return;
    }

    setSupportLoading(true);
    const path = 'support_tickets';
    try {
      await addDoc(collection(db, path), {
        ...supportForm,
        customerEmail: user.email,
        status: 'open',
        createdAt: serverTimestamp()
      });
      setSupportSuccess(true);
      setTimeout(() => {
        setSupportSuccess(false);
        setIsSupportOpen(false);
        setSupportForm({ subject: '', message: '', type: 'complaint' });
      }, 2500);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setSupportLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (currentPage === 'admin') {
    return (
      <>
        <button 
          onClick={() => setCurrentPage('shop')}
          className="fixed top-6 right-6 z-[120] bg-white p-3 rounded-full shadow-lg border border-stone-100 flex items-center gap-2 text-xs font-bold uppercase tracking-widest hover:bg-stone-50 transition-colors"
        >
          <ArrowRight className="rotate-180" size={14} /> Back to Shop
        </button>
        <AdminPanel onBackToShop={() => setCurrentPage('shop')} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 select-none">
      {/* Floating Socials Sidebar */}
      <div className="fixed left-8 top-1/2 -translate-y-1/2 z-50 hidden xl:flex flex-col gap-10">
        <div className="w-[1px] h-20 bg-stone-200 mx-auto" />
        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-stone-900 transition-colors -rotate-90 origin-center text-[9px] font-black uppercase tracking-[0.4em] whitespace-nowrap">
          Instagram
        </a>
        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-stone-900 transition-colors -rotate-90 origin-center text-[9px] font-black uppercase tracking-[0.4em] whitespace-nowrap mt-16">
          Facebook
        </a>
        <a href="https://daraz.com.bd" target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-stone-900 transition-colors -rotate-90 origin-center text-[9px] font-black uppercase tracking-[0.4em] whitespace-nowrap mt-16">
          Daraz Store
        </a>
        <div className="w-[1px] h-20 bg-stone-200 mx-auto mt-20" />
      </div>

      {/* Navigation */}
      <nav 
        id="main-nav"
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled || isSearchOpen ? 'bg-stone-50/80 backdrop-blur-md py-4 shadow-sm' : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center text-stone-900">
          <div className="flex gap-8 items-center">
            <button 
              id="menu-toggle"
              onClick={() => setIsMenuOpen(true)}
              className="lg:hidden p-2 hover:bg-stone-200/50 rounded-full transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="hidden lg:flex gap-8 text-sm font-medium tracking-widest uppercase">
              <a href="#" className="hover:text-stone-500 transition-colors">Shop</a>
              <a href="#" className="hover:text-stone-500 transition-colors">Stories</a>
              <a href="#" className="hover:text-stone-500 transition-colors">About</a>
            </div>
          </div>

          <a href="/" className="text-3xl font-display font-medium tracking-[0.2em] -ml-4 lg:ml-0">
            SOUTHA
          </a>

          <div className="flex gap-4 items-center">
            <div className={`flex items-center transition-all duration-300 ${isSearchOpen ? 'w-48 sm:w-64 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
              <input 
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-b border-stone-900/20 py-1 text-sm focus:outline-none focus:border-stone-900"
                autoFocus={isSearchOpen}
              />
            </div>
            <button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 hover:bg-stone-200/50 rounded-full transition-colors"
            >
              <AnimatePresence mode="wait">
                {isSearchOpen ? (
                  <motion.div key="close" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 90 }}>
                    <X size={22} />
                  </motion.div>
                ) : (
                  <motion.div key="search" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                    <Search size={22} />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
            <button 
              onClick={() => setCurrentPage('admin')}
              className="p-2 hover:bg-stone-200/50 rounded-full transition-colors hidden sm:block"
            >
              <User size={22} />
            </button>
            <button 
              onClick={() => setIsSupportOpen(true)}
              className="p-2 hover:bg-stone-200/50 rounded-full transition-colors"
            >
              <Settings size={22} />
            </button>
            <button 
              onClick={() => setIsCartOpen(true)}
              className="p-2 hover:bg-stone-200/50 rounded-full transition-colors relative"
            >
              <ShoppingBag size={22} />
              {cartItems.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-stone-900 text-stone-50 text-[10px] font-bold flex items-center justify-center rounded-full">
                  {cartItems.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[60] lg:hidden"
            onClick={() => setIsMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-[80%] max-w-sm h-full bg-stone-50 p-8 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-12">
                <span className="text-2xl font-display font-medium tracking-widest">SOUTHA</span>
                <button onClick={() => setIsMenuOpen(false)} className="p-2">
                  <X size={24} />
                </button>
              </div>
              <div className="flex flex-col gap-6 text-xl font-medium tracking-wide">
                <a href="#" className="hover:translate-x-2 transition-transform">New Arrivals</a>
                <a href="#" className="hover:translate-x-2 transition-transform">Collections</a>
                <a href="#" className="hover:translate-x-2 transition-transform">Furniture</a>
                <a href="#" className="hover:translate-x-2 transition-transform">Accessories</a>
                <a href="#" className="hover:translate-x-2 transition-transform">Sale</a>
                <button 
                  onClick={() => { setCurrentPage('admin'); setIsMenuOpen(false); }}
                  className="text-left hover:translate-x-2 transition-transform text-stone-400 mt-4 text-sm"
                >
                  Admin Access
                </button>
              </div>
              <div className="mt-auto pt-8 border-t border-stone-200">
                <div className="flex gap-4">
                  <Instagram size={20} className="text-stone-400" />
                  <Twitter size={20} className="text-stone-400" />
                  <Facebook size={20} className="text-stone-400" />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Details Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-[100] overflow-y-auto"
          >
            <div className="max-w-7xl mx-auto px-6 py-12 min-h-screen flex flex-col lg:flex-row gap-16 relative">
              <button 
                onClick={() => setSelectedProduct(null)}
                className="fixed top-8 right-8 p-3 bg-stone-100 rounded-full hover:bg-stone-200 transition-colors z-[110]"
              >
                <X size={24} />
              </button>

              <div className="w-full lg:w-1/2 aspect-[4/5] overflow-hidden bg-stone-100">
                <motion.img 
                  layoutId={`product-img-${selectedProduct.id}`}
                  src={selectedProduct.image} 
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="w-full lg:w-1/2 flex flex-col justify-center py-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <span className="text-xs font-medium tracking-[0.3em] uppercase text-stone-400 mb-4 block">
                    {selectedProduct.category}
                  </span>
                  <h1 className="text-4xl md:text-5xl font-display font-medium tracking-tight mb-4">
                    {selectedProduct.name}
                  </h1>
                  <div className="flex items-center gap-2 mb-8">
                    <div className="flex text-stone-900">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={14} className={i < Math.floor(selectedProduct.rating) ? "fill-stone-900" : "text-stone-200"} />
                      ))}
                    </div>
                    <span className="text-xs font-medium text-stone-400">{selectedProduct.rating} (42 Reviews)</span>
                  </div>
                  
                  <p className="text-2xl font-medium mb-8">{selectedProduct.price}</p>
                  
                  <div className="space-y-8 mb-12">
                    <p className="text-stone-500 leading-relaxed max-w-md">
                      A masterpiece of minimalist design, this piece embodies the SOUTHA philosophy of essential living. Hand-crafted using sustainably sourced materials chosen for their texture and longevity.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-stone-100 pb-4">
                        <span className="text-sm font-medium tracking-wide">Materials</span>
                        <span className="text-sm text-stone-400">100% Sustainable Organic</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-stone-100 pb-4">
                        <span className="text-sm font-medium tracking-wide">Dimensions</span>
                        <span className="text-sm text-stone-400">12" x 8" x 4"</span>
                      </div>
                    </div>
                  </div>

                  {settings && (
                    <div className="flex flex-wrap gap-4 mb-8">
                      {settings.whatsapp && (
                        <a 
                          href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 border border-stone-200 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-900 hover:bg-stone-50 transition-colors"
                        >
                          <Music2 size={16} /> WhatsApp
                        </a>
                      )}
                      {settings.messenger && (
                        <a 
                          href={settings.messenger} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 border border-stone-200 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-900 hover:bg-stone-50 transition-colors"
                        >
                          <MessageSquare size={16} /> Messenger
                        </a>
                      )}
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button 
                      onClick={() => addToCart(selectedProduct)}
                      className="flex-1 bg-stone-100 text-stone-900 py-5 font-medium tracking-widest uppercase text-xs hover:bg-stone-200 transition-colors"
                    >
                      Add to Cart
                    </button>
                    <button 
                      onClick={() => handleOrder(selectedProduct)}
                      disabled={orderLoading || orderSuccess}
                      className={`flex-[1.5] flex items-center justify-center gap-3 py-5 font-medium tracking-widest uppercase text-xs transition-all duration-500 shadow-lg ${
                        orderSuccess 
                        ? 'bg-green-600 text-white' 
                        : 'bg-stone-900 text-stone-50 hover:bg-stone-800'
                      }`}
                    >
                      {orderLoading && <Loader2 size={16} className="animate-spin" />}
                      {orderSuccess && <CheckCircle size={16} />}
                      {orderSuccess ? 'Order Placed' : orderLoading ? 'Processing...' : user ? 'Buy It Now' : 'Sign in to Buy'}
                    </button>
                  </div>
                  {orderSuccess && (
                    <motion.p 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-xs font-bold uppercase tracking-widest text-green-600 mt-4 flex items-center gap-2"
                    >
                      <CheckCircle size={12} /> Your request has been sent to our boutique.
                    </motion.p>
                  )}
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-[150] overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-stone-100 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-display font-medium uppercase tracking-widest">Your Cart</h3>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">
                    {cartItems.reduce((acc, item) => acc + item.quantity, 0)} Items Selected
                  </p>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-stone-50 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {cartItems.length > 0 ? cartItems.map(item => (
                  <div key={item.product.id} className="flex gap-6 items-center group">
                    <div className="w-24 h-32 bg-stone-100 overflow-hidden">
                      <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-medium text-stone-900">{item.product.name}</h4>
                        <span className="text-sm font-medium">{item.product.price}</span>
                      </div>
                      <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-4">{item.product.category}</p>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center border border-stone-200">
                          <button onClick={() => updateCartQuantity(item.product.id, -1)} className="px-3 py-1 hover:bg-stone-50">-</button>
                          <span className="px-3 py-1 text-xs border-x border-stone-200">{item.quantity}</span>
                          <button onClick={() => updateCartQuantity(item.product.id, 1)} className="px-3 py-1 hover:bg-stone-50">+</button>
                        </div>
                        <button onClick={() => removeFromCart(item.product.id)} className="text-[10px] uppercase font-bold tracking-widest text-stone-400 hover:text-red-500 transition-colors">
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                    <ShoppingBag size={48} className="text-stone-200" />
                    <div>
                      <p className="text-lg font-display font-medium text-stone-400">Your cart is empty</p>
                      <p className="text-xs text-stone-400 uppercase tracking-widest mt-2">Start adding pieces to your space</p>
                    </div>
                    <button 
                      onClick={() => setIsCartOpen(false)}
                      className="bg-stone-900 text-white px-8 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors"
                    >
                      Browse Collection
                    </button>
                  </div>
                )}
              </div>

              {cartItems.length > 0 && (
                <div className="p-8 bg-stone-50 space-y-6">
                  <div className="space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Select Payment Method</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'bkash', label: 'bKash' },
                        { id: 'nagad', label: 'Nagad' },
                        { id: 'credit_card', label: 'Credit Card' },
                        { id: 'debit_card', label: 'Debit Card' }
                      ].map((method) => (
                        <button
                          key={method.id}
                          onClick={() => setSelectedPaymentMethod(method.id as any)}
                          className={`py-3 px-4 text-[10px] font-bold uppercase tracking-widest border transition-all ${
                            selectedPaymentMethod === method.id 
                            ? 'bg-stone-900 text-white border-stone-900' 
                            : 'bg-white text-stone-400 border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          {method.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {((selectedPaymentMethod === 'bkash' && settings?.bkashNumber) || 
                    (selectedPaymentMethod === 'nagad' && settings?.nagadNumber)) && (
                    <div className="p-4 bg-stone-900 text-white rounded-sm space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Send Payment To:</p>
                      <p className="text-sm font-medium tracking-widest">
                        {selectedPaymentMethod === 'bkash' ? settings.bkashNumber : settings.nagadNumber}
                      </p>
                      <p className="text-[8px] uppercase tracking-widest opacity-40">Please use your order ID as reference</p>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-stone-400 border-t border-stone-200 pt-6">
                    <span>Estimated Total</span>
                    <span className="text-stone-900 text-lg font-medium tracking-normal">
                      ${cartItems.reduce((acc, item) => {
                        const price = parseFloat(item.product.price.replace('$', '').replace(',', ''));
                        return acc + (price * item.quantity);
                      }, 0).toLocaleString()}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleOrder(cartItems)}
                    disabled={orderLoading || orderSuccess}
                    className={`w-full py-5 text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl transition-all duration-500 flex items-center justify-center gap-3 ${
                      orderSuccess ? 'bg-green-600 text-white' : 'bg-stone-900 text-white hover:bg-stone-800'
                    }`}
                  >
                    {orderLoading && <Loader2 size={16} className="animate-spin" />}
                    {orderSuccess && <CheckCircle size={16} />}
                    {orderSuccess ? 'Order Placed' : orderLoading ? 'Processing Request' : user ? 'Complete Purchase' : 'Sign in to Purchase'}
                  </button>
                  <p className="text-[9px] text-center text-stone-400 uppercase tracking-widest font-bold">
                    * Orders are sent as inquiries to our boutique
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section id="hero" className="relative h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&q=80&w=2000" 
            alt="Hero background"
            className="w-full h-full object-cover scale-105"
          />
          <div className="absolute inset-0 bg-stone-900/10"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <span className="inline-block text-stone-900/60 font-medium tracking-[0.3em] uppercase mb-4">
              Collection No. 04
            </span>
            <h1 className="text-5xl md:text-7xl font-display font-medium tracking-tight text-stone-900 mb-8 leading-[1.1]">
              The Art of Simple living
            </h1>
            <p className="text-lg text-stone-700/80 mb-10 max-w-md leading-relaxed">
              Curated essentials for a peaceful home. Discover our latest collection of sustainable materials and timeless forms.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-stone-900 text-stone-50 px-10 py-4 font-medium tracking-widest uppercase text-sm flex items-center gap-3 hover:bg-stone-800 transition-colors shadow-xl shadow-stone-900/10"
            >
              Shop Collection <ArrowRight size={18} />
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-16">
          <div className="space-y-4">
            <h3 className="text-lg font-display font-medium uppercase tracking-widest">Ethically Crafted</h3>
            <p className="text-stone-500 leading-relaxed">Every piece is created with respect for the planet and the people who make them.</p>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-display font-medium uppercase tracking-widest">Timeless Design</h3>
            <p className="text-stone-500 leading-relaxed">We focus on high-quality materials and classic silhouettes that last a lifetime.</p>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-display font-medium uppercase tracking-widest">Global Curation</h3>
            <p className="text-stone-500 leading-relaxed">Sourced from artisans around the world to bring unique stories to your space.</p>
          </div>
        </div>
      </section>

      {/* Product List */}
      <section id="products" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-end mb-16">
            <div>
              <span className="text-stone-400 font-medium tracking-[0.2em] uppercase text-xs mb-2 block">Our Edition</span>
              <h2 className="text-3xl md:text-4xl font-display font-medium tracking-tight">
                {searchQuery ? `Results for "${searchQuery}"` : "Essential Picks"}
              </h2>
            </div>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="text-xs font-bold tracking-widest uppercase text-stone-400 hover:text-stone-900 transition-colors underline underline-offset-4"
              >
                Clear Results
              </button>
            )}
            {!searchQuery && (
              <a href="#" className="hidden sm:flex items-center gap-2 text-sm font-medium tracking-widest uppercase hover:text-stone-400 transition-colors">
                View All <ArrowRight size={16} />
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 gap-y-16 min-h-[400px]">
            <AnimatePresence mode="popLayout">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product, idx) => (
                  <motion.div
                    key={product.id}
                    id={`product-${product.id}`}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="group cursor-pointer"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-stone-200 mb-6 group">
                      <motion.img 
                        layoutId={`product-img-${product.id}`}
                        src={product.image} 
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300"></div>
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="absolute bottom-6 left-6 right-6 bg-white py-4 text-stone-900 font-medium tracking-widest uppercase text-xs opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-xl"
                      >
                        Explore Design
                      </motion.button>
                      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-sm flex items-center gap-1">
                        <Star size={10} className="fill-stone-900 text-stone-900" />
                        <span className="text-[10px] font-bold">{product.rating}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-medium tracking-tight mb-1">{product.name}</h3>
                        <p className="text-sm text-stone-400 mb-2 uppercase tracking-widest text-[10px] font-semibold">{product.category}</p>
                      </div>
                      <span className="text-base font-medium">{product.price}</span>
                    </div>
                  </motion.div>
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="col-span-full py-20 text-center"
                >
                  <p className="text-stone-400 font-display text-xl">No products found matching your search.</p>
                  <button onClick={() => setSearchQuery("")} className="mt-4 text-stone-900 font-bold uppercase tracking-widest text-xs">Show all products</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-32 bg-stone-900 text-stone-50 overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-display font-medium mb-6 tracking-tight">Join the Circle</h2>
            <p className="text-stone-400 mb-10 max-w-md mx-auto leading-relaxed">
              Sign up for our newsletter and receive early access to new collections and interior inspiration.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mx-auto">
              <input 
                type="email" 
                placeholder="Email address"
                className="bg-transparent border-b border-stone-700 py-3 px-2 w-full focus:outline-none focus:border-stone-500 transition-colors text-stone-50"
              />
              <button className="bg-stone-50 text-stone-900 px-8 py-3 font-medium tracking-widest uppercase text-sm hover:bg-stone-200 transition-colors">
                Subscribe
              </button>
            </div>
          </motion.div>
        </div>
        <div className="absolute top-0 right-0 p-24 opacity-5 pointer-events-none">
          <ShoppingBag size={400} />
        </div>
      </section>

      {/* Support Modal */}
      <AnimatePresence>
        {isSupportOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSupportOpen(false)}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                <div>
                  <h3 className="text-xl font-display font-medium uppercase tracking-widest">Help & Support</h3>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-1">Contact our Concierge</p>
                </div>
                <button onClick={() => setIsSupportOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-10">
                <form onSubmit={handleSupportSubmit} className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 block">Subject</label>
                    <input 
                      type="text" 
                      value={supportForm.subject}
                      onChange={e => setSupportForm({...supportForm, subject: e.target.value})}
                      placeholder="e.g. Question about Shipping"
                      className="w-full bg-stone-50 border-b border-stone-200 py-3 px-3 text-sm focus:outline-none focus:border-stone-900 transition-colors"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 block">Request Type</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['complaint', 'review', 'inquiry'] as const).map(t => (
                        <button 
                          key={t}
                          type="button"
                          onClick={() => setSupportForm({...supportForm, type: t})}
                          className={`py-3 text-[10px] font-bold uppercase tracking-widest border transition-all ${
                            supportForm.type === t 
                            ? 'bg-stone-900 text-white border-stone-900' 
                            : 'bg-white text-stone-400 border-stone-100 hover:border-stone-400'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 block">Message</label>
                    <textarea 
                      value={supportForm.message}
                      onChange={e => setSupportForm({...supportForm, message: e.target.value})}
                      placeholder="How can we assist you today?"
                      rows={4}
                      className="w-full bg-stone-50 border-b border-stone-200 py-3 px-3 text-sm focus:outline-none focus:border-stone-900 transition-colors resize-none"
                      required
                    />
                  </div>

                  <button 
                    disabled={supportLoading || supportSuccess}
                    className={`w-full py-5 text-xs font-bold uppercase tracking-[0.2em] shadow-xl transition-all duration-500 flex items-center justify-center gap-3 ${
                      supportSuccess 
                      ? 'bg-green-600 text-white' 
                      : 'bg-stone-900 text-white hover:bg-stone-800'
                    }`}
                  >
                    {supportLoading && <Loader2 size={16} className="animate-spin" />}
                    {supportSuccess && <CheckCircle size={16} />}
                    {supportSuccess ? 'Ticket Submitted' : supportLoading ? 'Sending...' : user ? 'Send Message' : 'Sign in to Submit'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-24 bg-white border-t border-stone-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-24">
            <div className="md:col-span-1">
              <a href="/" className="text-2xl font-display font-medium tracking-[0.2em] mb-6 block uppercase">
                SOUTHA
              </a>
              <p className="text-stone-400 text-sm leading-relaxed max-w-xs">
                Creating spaces that breathe. We are a minimalist lifestyle brand dedicated to quality over quantity.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium tracking-widest uppercase text-xs mb-8">Shop</h4>
              <ul className="space-y-4 text-sm text-stone-500">
                <li><a href="#" className="hover:text-stone-900 transition-colors">New Arrivals</a></li>
                <li><a href="#" className="hover:text-stone-900 transition-colors">Best Sellers</a></li>
                <li><a href="#" className="hover:text-stone-900 transition-colors">Home Decor</a></li>
                <li><a href="#" className="hover:text-stone-900 transition-colors">Furniture</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium tracking-widest uppercase text-xs mb-8">Support</h4>
              <ul className="space-y-4 text-sm text-stone-500">
                <li><button onClick={() => setIsSupportOpen(true)} className="hover:text-stone-900 transition-colors">Help & Support</button></li>
                <li><a href="#" className="hover:text-stone-900 transition-colors">Shipping & Returns</a></li>
                <li><a href="#" className="hover:text-stone-900 transition-colors">Size Guide</a></li>
                <li><a href="#" className="hover:text-stone-900 transition-colors">FAQ</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium tracking-widest uppercase text-xs mb-8">Connect</h4>
              <div className="grid grid-cols-3 gap-4 mb-8 max-w-[160px]">
                <a href={settings?.facebook || "https://facebook.com"} target="_blank" rel="noopener noreferrer" className="text-stone-500 hover:text-stone-900 transition-colors">
                  <Facebook size={20} />
                </a>
                <a href={settings?.instagram || "https://instagram.com"} target="_blank" rel="noopener noreferrer" className="text-stone-500 hover:text-stone-900 transition-colors">
                  <Instagram size={20} />
                </a>
                <a href={settings?.messenger || "https://messenger.com"} target="_blank" rel="noopener noreferrer" className="text-stone-500 hover:text-stone-900 transition-colors">
                  <MessageSquare size={20} />
                </a>
                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-stone-500 hover:text-stone-900 transition-colors">
                  <Youtube size={20} />
                </a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-stone-500 hover:text-stone-900 transition-colors">
                  <Twitter size={20} />
                </a>
                <a href="https://daraz.com.bd" target="_blank" rel="noopener noreferrer" className="text-stone-500 hover:text-stone-900 transition-colors" title="Shop on Daraz">
                  <ShoppingBag size={20} />
                </a>
              </div>
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.2em]">© 2024 Southa Studio</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
