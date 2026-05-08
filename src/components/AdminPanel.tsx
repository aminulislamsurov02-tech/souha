import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  type DocumentData
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { 
  Plus, 
  Trash2, 
  LogOut, 
  LayoutDashboard, 
  Package, 
  ShoppingBag,
  MessageSquare,
  Settings,
  AlertCircle,
  Loader2,
  X,
  Home,
  ArrowLeft,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

const MOCK_SALES_DATA = [
  { name: 'Mon', sales: 4000 },
  { name: 'Tue', sales: 3000 },
  { name: 'Wed', sales: 2000 },
  { name: 'Thu', sales: 2780 },
  { name: 'Fri', sales: 1890 },
  { name: 'Sat', sales: 2390 },
  { name: 'Sun', sales: 3490 },
];

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

export default function AdminPanel({ onBackToShop }: { onBackToShop: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [settings, setSettings] = useState({
    facebook: '',
    instagram: '',
    messenger: '',
    whatsapp: '',
    bkashNumber: '',
    nagadNumber: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'orders' | 'support' | 'settings'>('dashboard');
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  // Form state
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    category: '',
    image: '',
    rating: 5
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        fetchProducts();
        fetchOrders();
        fetchTickets();
        fetchSettings();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchProducts = async () => {
    const path = 'products';
    try {
      const snap = await getDocs(collection(db, path));
      setProducts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  };

  const fetchOrders = async () => {
    const path = 'orders';
    try {
      const snap = await getDocs(collection(db, path));
      setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  };

  const fetchTickets = async () => {
    const path = 'support_tickets';
    try {
      const snap = await getDocs(collection(db, path));
      setTickets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  };

  const fetchSettings = async () => {
    const path = 'settings/global';
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const docSnap = await getDoc(doc(db, 'settings', 'global'));
      if (docSnap.exists()) {
        setSettings(docSnap.data() as any);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = 'settings/global';
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      await setDoc(doc(db, 'settings', 'global'), {
        ...settings,
        updatedAt: serverTimestamp()
      });
      alert("Settings updated successfully");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError("Login failed. Make sure you are an authorized admin.");
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = 'products';
    try {
      await addDoc(collection(db, path), {
        ...newProduct,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewProduct({ name: '', price: '', category: '', image: '', rating: 5 });
      fetchProducts();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const path = `products/${id}`;
    try {
      await deleteDoc(doc(db, 'products', id));
      fetchProducts();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleUpdateOrderStatus = async (id: string, status: string) => {
    const path = `orders/${id}`;
    try {
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'orders', id), {
        status,
        updatedAt: serverTimestamp()
      });
      fetchOrders();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleUpdateTicketStatus = async (id: string, status: string) => {
    const path = `support_tickets/${id}`;
    try {
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'support_tickets', id), {
        status,
        updatedAt: serverTimestamp()
      });
      fetchTickets();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const seedData = async () => {
    const path = 'products';
    const sampleProducts = [
      {
        name: "AI-Sync Mood Lamp",
        price: "$290",
        category: "Tech",
        image: "https://images.unsplash.com/photo-1534073828943-f801091bbffb?auto=format&fit=crop&q=80&w=800",
        rating: 4.9
      },
      {
        name: "Neural-Focus Desk Mat",
        price: "$85",
        category: "Office",
        image: "https://images.unsplash.com/photo-1616423641454-ec0a1699912c?auto=format&fit=crop&q=80&w=800",
        rating: 4.7
      },
      {
        name: "Bionic Linen Tote",
        price: "$145",
        category: "Accessories",
        image: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800",
        rating: 4.8
      },
      {
        name: "Synthesis Ceramic Vase",
        price: "$120",
        category: "Decor",
        image: "https://images.unsplash.com/photo-1581783898377-1c85bf937427?auto=format&fit=crop&q=80&w=800",
        rating: 4.9
      }
    ];

    try {
      setLoading(true);
      for (const p of sampleProducts) {
        await addDoc(collection(db, path), {
          ...p,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setShowSuccess(true);
      fetchProducts();
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <Loader2 className="animate-spin text-stone-400" size={32} />
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-10 shadow-2xl shadow-stone-200 text-center"
        >
          <h2 className="text-3xl font-display font-medium tracking-tight mb-4 uppercase">Admin Entry</h2>
          <p className="text-stone-400 mb-8 text-sm leading-relaxed">
            Authorized personnel only. Access requires administrative privileges.
          </p>
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 text-xs flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <button 
            onClick={handleLogin}
            className="w-full bg-stone-900 text-stone-50 py-4 font-medium tracking-widest uppercase text-xs hover:bg-stone-800 transition-colors"
          >
            Authenticate with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-stone-900 text-stone-50 p-8 flex flex-col">
        <h1 className="text-2xl font-display font-medium tracking-widest mb-12 uppercase">Southa.</h1>
        
        <nav className="space-y-2 flex-grow">
          <button 
            onClick={onBackToShop}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide text-stone-400 hover:text-white transition-colors"
          >
            <Home size={18} /> Home
          </button>
          
          <div className="pt-4 pb-2">
            <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-4">Navigation</p>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide transition-colors ${activeTab === 'dashboard' ? 'bg-stone-800 text-white shadow-lg' : 'text-stone-400 hover:text-white'}`}
            >
              <LayoutDashboard size={18} /> Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('products')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide transition-colors ${activeTab === 'products' ? 'bg-stone-800 text-white shadow-lg' : 'text-stone-400 hover:text-white'}`}
            >
              <Package size={18} /> Inventory
            </button>
            <button 
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide transition-colors ${activeTab === 'orders' ? 'bg-stone-800 text-white shadow-lg' : 'text-stone-400 hover:text-white'}`}
            >
              <ShoppingBag size={18} /> Orders
            </button>
            <button 
              onClick={() => setActiveTab('support')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide transition-colors ${activeTab === 'support' ? 'bg-stone-800 text-white shadow-lg' : 'text-stone-400 hover:text-white'}`}
            >
              <MessageSquare size={18} /> Support
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide transition-colors ${activeTab === 'settings' ? 'bg-stone-800 text-white shadow-lg' : 'text-stone-400 hover:text-white'}`}
            >
              <Settings size={18} /> Settings
            </button>
          </div>

          <div className="pt-4">
            <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-stone-600 mb-4">Quick Actions</p>
            <button 
              onClick={() => setIsFormVisible(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide text-stone-400 hover:text-white transition-colors border-l-2 border-transparent hover:border-stone-500"
            >
              <Plus size={18} /> Add Product
            </button>
            <button 
              onClick={() => setIsDeleteModalOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide text-stone-400 hover:text-white transition-colors border-l-2 border-transparent hover:border-stone-500"
            >
              <Trash2 size={18} /> Delete by ID
            </button>
          </div>
        </nav>

        <button 
          onClick={() => signOut(auth)}
          className="flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide text-stone-400 hover:text-white transition-colors mt-auto border-t border-stone-800 pt-8"
        >
          <LogOut size={18} /> Sign Out
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-12 overflow-y-auto">
        <header className="flex justify-between items-center mb-12">
          <h2 className="text-3xl font-display font-medium tracking-tight uppercase">
            {activeTab === 'dashboard' ? 'Overview' : 'Product Inventory'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Welcome</p>
              <p className="text-sm font-medium">{user.email}</p>
            </div>
            <div className="w-10 h-10 bg-stone-200 rounded-full overflow-hidden">
              <img src={user.photoURL || ''} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' ? (
            <motion.div 
              key="dash"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-8 shadow-sm border border-stone-100 group hover:border-stone-900 transition-colors duration-500">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400 mb-2">Total Products</p>
                  <h3 className="text-4xl font-display font-medium group-hover:translate-x-1 transition-transform">{products.length}</h3>
                </div>
                <div className="bg-white p-8 shadow-sm border border-stone-100 group hover:border-stone-900 transition-colors duration-500">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400 mb-2">Total Orders</p>
                  <h3 className="text-4xl font-display font-medium group-hover:translate-x-1 transition-transform">{orders.length}</h3>
                </div>
                <div className="bg-white p-8 shadow-sm border border-stone-100 group hover:border-stone-900 transition-colors duration-500">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400 mb-2">Support Tickets</p>
                  <h3 className="text-4xl font-display font-medium group-hover:translate-x-1 transition-transform">{tickets.length}</h3>
                </div>
              </div>

              {/* Bootstrap Action */}
              <div className="bg-stone-900 p-10 text-stone-50 flex justify-between items-center overflow-hidden relative">
                <div className="relative z-10">
                  <h3 className="text-xl font-display font-medium uppercase tracking-widest mb-1">Trailer Setup</h3>
                  <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">Populate your instance with AI-themed products</p>
                </div>
                <button 
                  onClick={seedData}
                  className="relative z-10 bg-white text-stone-900 px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-stone-100 transition-colors shadow-2xl"
                >
                  Bootstrap Trailer Products
                </button>
                <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-stone-800 rounded-full blur-3xl opacity-50"></div>
              </div>

              {/* Chart Section */}
              <div className="bg-white p-8 shadow-sm border border-stone-100">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-lg font-display font-medium uppercase tracking-widest">Sale Engagement</h3>
                    <p className="text-xs text-stone-400 uppercase tracking-widest font-bold mt-1">Weekly Performance</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-stone-900"></span>
                    <span className="text-[10px] uppercase font-bold tracking-widest">Storefront Interactions</span>
                  </div>
                </div>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={MOCK_SALES_DATA}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1c1917" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#1c1917" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#a8a29e', fontSize: 10, fontWeight: 600 }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#a8a29e', fontSize: 10, fontWeight: 600 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #f5f5f4',
                          borderRadius: '0px',
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          fontSize: '12px'
                        }}
                        cursor={{ stroke: '#1c1917', strokeWidth: 1 }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="sales" 
                        stroke="#1c1917" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorSales)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 shadow-sm border border-stone-100">
                  <h4 className="text-sm font-bold uppercase tracking-widest mb-6">Recent Activity</h4>
                  <div className="space-y-6">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex gap-4 items-start pb-6 border-b border-stone-50 last:border-0 last:pb-0">
                        <div className="w-2 h-2 rounded-full bg-stone-200 mt-1.5 flex-shrink-0"></div>
                        <div>
                          <p className="text-sm font-medium">New product "Linen Vessel" published</p>
                          <p className="text-[10px] text-stone-400 uppercase font-bold mt-1">2 hours ago</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white p-8 shadow-sm border border-stone-100 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="text-stone-300" size={32} />
                  </div>
                  <h4 className="text-sm font-bold uppercase tracking-widest mb-2">No System Notifications</h4>
                  <p className="text-xs text-stone-400 max-w-[200px] leading-relaxed">Everything is running smoothly on your Southa instance.</p>
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'products' ? (
            <motion.div 
              key="products"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Previous products content ... */}
              <div className="flex justify-between items-center bg-white p-6 border border-stone-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-stone-50 rounded-full text-stone-900">
                    <Package size={24} />
                  </div>
                  <div>
                    <h3 className="font-display font-medium text-xl">Inventory Management</h3>
                    <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">{products.length} Items Listed</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-widest border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    <Trash2 size={16} /> Delete by ID
                  </button>
                  <button 
                    onClick={() => setIsFormVisible(true)}
                    className="flex items-center gap-2 px-6 py-3 text-xs font-bold uppercase tracking-widest bg-stone-900 text-stone-50 shadow-lg shadow-stone-900/10 hover:bg-stone-800 transition-all"
                  >
                    <Plus size={16} /> Add Product
                  </button>
                </div>
              </div>

              <section className="bg-white border border-stone-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-stone-50/50 border-b border-stone-100">
                    <tr>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Inventory ID</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Product</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Category</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Price</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {products.map(p => (
                      <tr key={p.id} className="hover:bg-stone-50/30 transition-colors">
                        <td className="px-8 py-6">
                           <code className="text-[10px] bg-stone-100 px-2 py-1 text-stone-500 font-mono">{p.id}</code>
                        </td>
                        <td className="px-8 py-6 flex items-center gap-4">
                          <div className="w-12 h-12 bg-stone-100 overflow-hidden">
                            <img src={p.image} alt="" className="w-full h-full object-cover" />
                          </div>
                          <span className="font-medium text-sm">{p.name}</span>
                        </td>
                        <td className="px-8 py-6 text-sm text-stone-500 uppercase tracking-widest text-xs">{p.category}</td>
                        <td className="px-8 py-6 font-medium text-sm">{p.price}</td>
                        <td className="px-8 py-6 text-right">
                          <button 
                            onClick={() => handleDeleteProduct(p.id)}
                            className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </motion.div>
          ) : activeTab === 'orders' ? (
            <motion.div 
              key="orders"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center bg-white p-6 border border-stone-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-stone-50 rounded-full text-stone-900">
                    <ShoppingBag size={24} />
                  </div>
                  <div>
                    <h3 className="font-display font-medium text-xl">Customer Orders</h3>
                    <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">{orders.length} Active Requests</p>
                  </div>
                </div>
              </div>

              <section className="bg-white border border-stone-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-stone-50/50 border-b border-stone-100">
                    <tr>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Order ID</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Customer</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Product</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Payment</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Status</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {orders.length > 0 ? orders.map(o => (
                      <tr key={o.id} className="hover:bg-stone-50/30 transition-colors">
                        <td className="px-8 py-6">
                           <code className="text-[10px] bg-stone-100 px-2 py-1 text-stone-500 font-mono">{o.id}</code>
                        </td>
                        <td className="px-8 py-6">
                          <p className="font-medium text-sm">{o.customerEmail}</p>
                          <p className="text-[10px] text-stone-400 uppercase font-bold">{new Date(o.createdAt?.seconds * 1000).toLocaleDateString()}</p>
                        </td>
                        <td className="px-8 py-6 text-sm text-stone-900">{o.productName}</td>
                        <td className="px-8 py-6">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500 bg-stone-100 px-2 py-1 rounded">
                            {o.paymentMethod || 'N/A'}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full ${
                            o.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            o.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <select 
                            value={o.status}
                            onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                            className="bg-stone-50 border border-stone-200 text-[10px] font-bold uppercase tracking-widest p-1 focus:outline-none focus:border-stone-900"
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                          </select>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center text-stone-400 font-display text-lg">
                          No orders received yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </motion.div>
          ) : activeTab === 'support' ? (
            <motion.div 
              key="support"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center bg-white p-6 border border-stone-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-stone-50 rounded-full text-stone-900">
                    <MessageSquare size={24} />
                  </div>
                  <div>
                    <h3 className="font-display font-medium text-xl">Help & Support Tickets</h3>
                    <p className="text-xs text-stone-400 uppercase tracking-widest font-bold">{tickets.length} Active Tickets</p>
                  </div>
                </div>
              </div>

              <section className="bg-white border border-stone-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-stone-50/50 border-b border-stone-100">
                    <tr>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">ID & Type</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Customer</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Message</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Status</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {tickets.length > 0 ? tickets.map(t => (
                      <tr key={t.id} className="hover:bg-stone-50/30 transition-colors">
                        <td className="px-8 py-6">
                           <div className="flex flex-col gap-1">
                             <code className="text-[10px] bg-stone-100 px-2 py-1 text-stone-500 font-mono w-fit">{t.id}</code>
                             <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">{t.type}</span>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                          <p className="font-medium text-sm">{t.customerEmail}</p>
                          <p className="text-[10px] text-stone-400 uppercase font-bold">{new Date(t.createdAt?.seconds * 1000).toLocaleDateString()}</p>
                        </td>
                        <td className="px-8 py-6">
                          <p className="font-medium text-sm text-stone-900 mb-1">{t.subject}</p>
                          <p className="text-xs text-stone-500 line-clamp-2 max-w-md">{t.message}</p>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full ${
                            t.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button 
                            onClick={() => handleUpdateTicketStatus(t.id, t.status === 'open' ? 'resolved' : 'open')}
                            className="bg-stone-900 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 hover:bg-stone-800 transition-colors"
                          >
                            {t.status === 'open' ? 'Resolve' : 'Reopen'}
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center text-stone-400 font-display text-lg">
                          No support request yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </motion.div>
          ) : (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl space-y-8"
            >
              <div className="bg-white p-10 border border-stone-100">
                <div className="mb-10">
                  <h3 className="font-display font-medium text-2xl uppercase tracking-widest mb-2">Social Integrations</h3>
                  <p className="text-xs text-stone-400 font-bold uppercase tracking-[0.2em]">Configure your contact links</p>
                </div>

                <form onSubmit={handleUpdateSettings} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3 block">Facebook URL</label>
                      <input 
                        type="url" 
                        value={settings.facebook}
                        onChange={e => setSettings({...settings, facebook: e.target.value})}
                        placeholder="https://facebook.com/your-page"
                        className="w-full bg-stone-50 border-b border-stone-200 py-3 px-4 text-sm focus:outline-none focus:border-stone-900 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3 block">Instagram URL</label>
                      <input 
                        type="url" 
                        value={settings.instagram}
                        onChange={e => setSettings({...settings, instagram: e.target.value})}
                        placeholder="https://instagram.com/your-profile"
                        className="w-full bg-stone-50 border-b border-stone-200 py-3 px-4 text-sm focus:outline-none focus:border-stone-900 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3 block">Messenger Link</label>
                      <input 
                        type="url" 
                        value={settings.messenger}
                        onChange={e => setSettings({...settings, messenger: e.target.value})}
                        placeholder="https://m.me/your-id"
                        className="w-full bg-stone-50 border-b border-stone-200 py-3 px-4 text-sm focus:outline-none focus:border-stone-900 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3 block">WhatsApp Number</label>
                      <input 
                        type="text" 
                        value={settings.whatsapp}
                        onChange={e => setSettings({...settings, whatsapp: e.target.value})}
                        placeholder="+8801XXXXXXXXX"
                        className="w-full bg-stone-50 border-b border-stone-200 py-3 px-4 text-sm focus:outline-none focus:border-stone-900 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3 block">bKash Number</label>
                      <input 
                        type="text" 
                        value={settings.bkashNumber}
                        onChange={e => setSettings({...settings, bkashNumber: e.target.value})}
                        placeholder="01XXXXXXXXX"
                        className="w-full bg-stone-50 border-b border-stone-200 py-3 px-4 text-sm focus:outline-none focus:border-stone-900 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3 block">Nagad Number</label>
                      <input 
                        type="text" 
                        value={settings.nagadNumber}
                        onChange={e => setSettings({...settings, nagadNumber: e.target.value})}
                        placeholder="01XXXXXXXXX"
                        className="w-full bg-stone-50 border-b border-stone-200 py-3 px-4 text-sm focus:outline-none focus:border-stone-900 transition-colors"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-stone-900 text-white py-5 text-xs font-bold uppercase tracking-[0.2em] hover:bg-stone-800 transition-all shadow-xl"
                  >
                    Save Changes
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Notification */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-12 right-12 z-[300] bg-stone-900 text-stone-50 px-8 py-5 shadow-2xl flex items-center gap-4 border border-stone-800"
            >
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle size={14} className="text-stone-900" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest">Success</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-[0.15em] mt-0.5">Product added to inventory</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal: Add Product */}
        <AnimatePresence>
          {isFormVisible && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsFormVisible(false)}
                className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
              />
              <motion.section 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative bg-white shadow-2xl w-full max-w-xl overflow-hidden"
              >
                <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                  <h3 className="text-xl font-display font-medium flex items-center gap-3">
                    <Plus size={20} /> New Inventory Item
                  </h3>
                  <button onClick={() => setIsFormVisible(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-10">
                  <form onSubmit={(e) => { handleAddProduct(e); setIsFormVisible(false); }} className="grid grid-cols-2 gap-6">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 block">Name</label>
                      <input 
                        type="text" 
                        value={newProduct.name}
                        onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                        placeholder="e.g. Minimalist Vessel"
                        className="w-full bg-stone-50 border-b border-stone-200 py-3 px-3 text-sm focus:outline-none focus:border-stone-900 transition-colors"
                        required
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 block">Price</label>
                      <input 
                        type="text" 
                        value={newProduct.price}
                        onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                        placeholder="$0.00"
                        className="w-full bg-stone-50 border-b border-stone-200 py-3 px-3 text-sm focus:outline-none focus:border-stone-900 transition-colors"
                        required
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 block">Category</label>
                      <input 
                        type="text" 
                        value={newProduct.category}
                        onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                        placeholder="Home, Accessories, etc."
                        className="w-full bg-stone-50 border-b border-stone-200 py-3 px-3 text-sm focus:outline-none focus:border-stone-900 transition-colors"
                        required
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 block">Image URL</label>
                      <input 
                        type="text" 
                        value={newProduct.image}
                        onChange={e => setNewProduct({...newProduct, image: e.target.value})}
                        placeholder="https://..."
                        className="w-full bg-stone-50 border-b border-stone-200 py-3 px-3 text-sm focus:outline-none focus:border-stone-900 transition-colors"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <button className="w-full bg-stone-900 text-stone-50 py-5 font-medium tracking-widest uppercase text-xs mt-4 hover:bg-stone-800 transition-colors shadow-xl shadow-stone-900/10">
                        Publish to Storefront
                      </button>
                    </div>
                  </form>
                </div>
              </motion.section>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Delete Product by ID */}
        <AnimatePresence>
          {isDeleteModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDeleteModalOpen(false)}
                className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
              />
              <motion.section 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative bg-white shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="p-8 border-b border-stone-100 flex justify-between items-center bg-red-50">
                  <h3 className="text-xl font-display font-medium flex items-center gap-3 text-red-900">
                    <Trash2 size={20} /> Delete Document
                  </h3>
                  <button onClick={() => setIsDeleteModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-10">
                  <p className="text-sm text-stone-500 mb-8 leading-relaxed">
                    This action is permanent. Enter the unique product ID below to verify and remove the item from the database.
                  </p>
                  <form onSubmit={(e) => { e.preventDefault(); handleDeleteProduct(deleteId); setIsDeleteModalOpen(false); setDeleteId(""); }} className="space-y-6">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 block">Product ID</label>
                      <input 
                        type="text" 
                        value={deleteId}
                        onChange={e => setDeleteId(e.target.value)}
                        placeholder="Enter ID..."
                        className="w-full bg-stone-50 border-b border-stone-200 py-3 px-3 text-sm focus:outline-none focus:border-red-500 transition-colors"
                        required
                      />
                    </div>
                    <button className="w-full bg-red-600 text-white py-5 font-medium tracking-widest uppercase text-xs mt-4 hover:bg-red-700 transition-colors shadow-xl shadow-red-900/10">
                      Confirm Deletion
                    </button>
                  </form>
                </div>
              </motion.section>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
