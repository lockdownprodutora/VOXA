import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, ShoppingBag, Plus, Trash2, Tag, Image as ImageIcon, CheckCircle2, X, 
  Search, Filter, Edit, Eye, Shield, DollarSign, Package, Users, FileText, Gift, 
  Settings, Star, AlertTriangle, Check, RefreshCw, Layers, Truck, Percent, 
  Lock, Unlock, Award
} from 'lucide-react';
import { Product } from '../../types';
import { uploadFile } from '../../utils/upload';
import { OFFICIAL_CATEGORIES, mapOldCategory } from '../../utils/categories';
import { 
  fetchStoreProducts, 
  saveStoreProduct, 
  deleteStoreProduct,
  fetchStoreOrders,
  saveStoreOrder,
  fetchSellerRequests,
  saveSellerRequest,
  fetchStoreSettings,
  saveStoreSettings,
  SellerRequest,
  StoreOrder,
  StoreSettings
} from '../../utils/storeDb';
import { isFirebaseConfigured, db } from '../../lib/firebase';
import { collection, query, where, getDocs, limit, doc, setDoc } from 'firebase/firestore';
import { formatBRL, maskBRL } from '../../utils/money';

interface StoreModuleProps {
  onBackToMenu: () => void;
}

export const StoreModule: React.FC<StoreModuleProps> = ({ onBackToMenu }) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'produtos' | 'categorias' | 'pedidos' | 'vendedores' | 'solicitacoes' | 'pendentes' | 'cupons' | 'giftcards' | 'estoque' | 'avaliacoes' | 'config'
  >('overview');

  // Persistence for products
  const [customProducts, setCustomProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [selectedViewOrder, setSelectedViewOrder] = useState<StoreOrder | null>(null);
  const [sellerRequests, setSellerRequests] = useState<SellerRequest[]>([]);

  useEffect(() => {
    const loadAllDbData = async () => {
      try {
        const prods = await fetchStoreProducts();
        setCustomProducts(prods);
        
        const ords = await fetchStoreOrders();
        setOrders(ords);

        const requests = await fetchSellerRequests();
        setSellerRequests(requests);

        const settings = await fetchStoreSettings();
        setStoreSettings(settings);
      } catch (err) {
        console.warn("Store database data load notice in admin:", err);
      }
    };
    loadAllDbData();
  }, []);

  // Categories persistence
  const [categories, setCategories] = useState<any[]>(() => {
    const saved = localStorage.getItem('lockdown_store_categories');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0 && parsed.some((p: any) => p.name === 'Contas Digitais' || p.name === 'Automóveis')) {
          return parsed;
        }
      } catch (e) {}
    }
    return OFFICIAL_CATEGORIES.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      active: true,
      count: 0
    }));
  });

  // Pending products (Announcements awaiting approval)
  const [pendingProducts, setPendingProducts] = useState<any[]>(() => {
    const saved = localStorage.getItem('lockdown_store_pending');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  // Derived sellers from approved seller requests
  const sellers = sellerRequests.filter(req => req.status === 'Aprovado').map(req => ({
    id: req.id,
    storeName: req.storeName,
    owner: req.name,
    email: req.email,
    status: 'Ativo',
    commission: storeSettings.defaultCommission,
    balance: 'R$ 0,00',
    date: new Date(req.createdAt).toLocaleDateString('pt-BR')
  }));

  // Coupons persistence
  const [coupons, setCoupons] = useState<any[]>(() => {
    const saved = localStorage.getItem('lockdown_store_coupons');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 'cp-1', code: 'LOCKDOWN10', type: 'Percentual', value: '10%', minOrder: 'R$ 50,00', uses: 45, maxUses: 100, active: true },
      { id: 'cp-2', code: 'LOCKDOWN50', type: 'Valor Fixo', value: 'R$ 50,00', minOrder: 'R$ 250,00', uses: 12, maxUses: 50, active: true }
    ];
  });

  // Gift Cards codes
  const [giftCardCodes, setGiftCardCodes] = useState<any[]>(() => {
    const saved = localStorage.getItem('lockdown_store_giftcards');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 'gc-code-1', name: 'Gift Card R$ 50', code: 'LOCK-GC50-9921', value: 'R$ 50,00', status: 'Disponível', buyer: '-' },
      { id: 'gc-code-2', name: 'Gift Card R$ 100', code: 'LOCK-GC100-8841', value: 'R$ 100,00', status: 'Utilizado', buyer: 'MC Kronos' }
    ];
  });

  // Reviews
  const [reviews, setReviews] = useState<any[]>(() => {
    const saved = localStorage.getItem('lockdown_store_reviews');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 'rev-1', product: 'Moletom Oversized Lockdown', user: 'Julia Silva', rating: 5, comment: 'Qualidade absurda do moletom! Pano pesado e estampa impecável.', date: '05/08/2026', verified: true },
      { id: 'rev-2', product: 'Pack Acapellas Vol. 1', user: 'DJ Kevin', rating: 5, comment: 'Stems limpos demais, salvou meu remix.', date: '04/08/2026', verified: true }
    ];
  });

  // Store Settings
  const [storeSettings, setStoreSettings] = useState(() => {
    const saved = localStorage.getItem('lockdown_store_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      storeName: 'Lockdown Store & Marketplace',
      storeActive: true,
      defaultCommission: 10,
      lowStockThreshold: 5,
      allowSellers: true,
      requireApproval: true,
      freeShippingThreshold: 299.00
    };
  });

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');

  // Form state for creating/editing product
  const [formName, setFormName] = useState('');
  const [formShortDesc, setFormShortDesc] = useState('');
  const [formFullDesc, setFormFullDesc] = useState('');
  const [formCategory, setFormCategory] = useState('Produtos Físicos');
  const [formSubcategory, setFormSubcategory] = useState('Roupas');
  const [formType, setFormType] = useState<'Físico' | 'Digital' | 'Gift Card' | 'Serviço'>('Físico');
  const [formPrice, setFormPrice] = useState('R$ ');
  const [formPromoPrice, setFormPromoPrice] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formStock, setFormStock] = useState('10');
  const [formImage, setFormImage] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [formBadge, setFormBadge] = useState('LANÇAMENTO');
  const [formWeight, setFormWeight] = useState('0.5 kg');
  const [formDigitalUrl, setFormDigitalUrl] = useState('');
  const [formAllowInstallments, setFormAllowInstallments] = useState(true);
  const [formMaxInstallments, setFormMaxInstallments] = useState(12);

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  // Diagnostics State
  const [diagnostics, setDiagnostics] = useState<{
    firebaseOk: boolean;
    driveSimulated: boolean;
    driveRootOk: boolean;
    recentUploads: any[];
    lastChecked: string;
  } | null>(null);
  const [isTestingDiagnostics, setIsTestingDiagnostics] = useState(false);

  const runStoreDiagnostics = async () => {
    setIsTestingDiagnostics(true);
    try {
      const firebaseOk = isFirebaseConfigured();
      
      let driveSimulated = true;
      let driveRootOk = false;
      try {
        const res = await fetch("/api/drive-folders");
        if (res.ok) {
          const data = await res.json();
          driveSimulated = !!data.isSimulated;
          driveRootOk = data.success && !data.isSimulated;
        }
      } catch (e) {
        console.error("Failed to query drive folders for diagnostics:", e);
      }

      // Fetch recent store uploads from Firestore collection 'uploads'
      const recentUploadsList: any[] = [];
      if (firebaseOk) {
        try {
          const uploadsRef = collection(db, 'uploads');
          // Buscamos os uploads associados ao modulo de Store de forma segura
          const q = query(uploadsRef, where('module', '==', 'store'), limit(5));
          const snap = await getDocs(q);
          snap.forEach(docSnap => {
            recentUploadsList.push({ id: docSnap.id, ...docSnap.data() });
          });
        } catch (e) {
          console.error("Failed to fetch uploads metadata for diagnostics:", e);
        }
      }

      setDiagnostics({
        firebaseOk,
        driveSimulated,
        driveRootOk,
        recentUploads: recentUploadsList,
        lastChecked: new Date().toLocaleTimeString()
      });
    } catch (err) {
      console.error("Error during diagnostics:", err);
    } finally {
      setIsTestingDiagnostics(false);
    }
  };

  const handleResetLocalStorage = () => {
    if (confirm("Deseja realmente limpar o cache local da Store? Isso irá recarregar as informações sincronizadas diretamente do banco de dados em nuvem.")) {
      localStorage.removeItem('lockdown_store_products');
      localStorage.removeItem('lockdown_store_categories');
      localStorage.removeItem('lockdown_store_sellers');
      localStorage.removeItem('lockdown_store_pending');
      localStorage.removeItem('lockdown_store_coupons');
      localStorage.removeItem('lockdown_store_settings');
      window.location.reload();
    }
  };

  useEffect(() => {
    if (activeTab === 'config') {
      runStoreDiagnostics();
    }
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('lockdown_store_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('lockdown_store_sellers', JSON.stringify(sellers));
  }, [sellers]);

  useEffect(() => {
    localStorage.setItem('lockdown_store_pending', JSON.stringify(pendingProducts));
  }, [pendingProducts]);

  useEffect(() => {
    localStorage.setItem('lockdown_store_coupons', JSON.stringify(coupons));
  }, [coupons]);

  useEffect(() => {
    localStorage.setItem('lockdown_store_settings', JSON.stringify(storeSettings));
  }, [storeSettings]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPrice) return;

    setErrorMsg('');
    setSuccessMsg('');
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Iniciando o salvamento...');

    const productId = editingProduct ? editingProduct.id : 'prod-' + Date.now();
    const preservedImages = previewUrls.filter(url => url && !url.startsWith('blob:'));

    try {
      let uploadedMedia: any[] = [];
      let imageUploadFailed = false;

      // 1. Upload files first to Google Drive
      if (selectedFiles.length > 0) {
        setUploadStatus('Fazendo upload das imagens para o Google Drive corporativo...');
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          setUploadStatus(`Enviando ${file.name}...`);
          
          const result = await uploadFile(file, 'product', (progress) => {
            const filePct = progress.percentage;
            const totalPct = Math.round(((i / selectedFiles.length) * 100) + (filePct / selectedFiles.length));
            setUploadProgress(totalPct);
          }, {
            module: 'store',
            entityId: productId,
            entityName: formName,
            subFolder: 'Imagens'
          });

          if (!result.url) {
            throw new Error(`O sistema de armazenamento não confirmou o upload de ${file.name}.`);
          }

          uploadedMedia.push(result);

          // 2. LOG EXIGIDO: STORE_UPLOAD_DEBUG
          console.log("STORE_UPLOAD_DEBUG", {
            productId,
            fileName: file.name,
            fileType: file.type,
            uploadResponse: result,
            driveFileId: result.driveFileId,
            driveUrl: result.url,
            mediaProxyUrl: result.url,
            valorFinalQueSeraSalvo: result.url
          });
        }
      }

      // 3. Juntar mídias antigas com novas
      const uploadedUrls = uploadedMedia.map(media => media.url);
      const allImages = [...preservedImages, ...uploadedUrls];
      const finalImage = allImages[0] || null;

      // 4. Montar o produto final
      const finalProduct: any = {
        ...(editingProduct || {}),
        id: productId,
        name: formName,
        shortDesc: formShortDesc || formName,
        fullDesc: formFullDesc || formName,
        category: formCategory,
        subcategory: formSubcategory,
        type: formType,
        price: formPrice,
        promoPrice: formPromoPrice,
        sku: formSku || editingProduct?.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        stock: Number.isFinite(Number(formStock)) ? Number(formStock) : 0,
        status: editingProduct?.status || 'Ativo',
        seller: editingProduct?.seller || 'Lockdown Oficial',
        image: finalImage,
        images: allImages,
        featured: editingProduct?.featured !== undefined ? editingProduct.featured : true,
        badge: formBadge,
        tags: [formCategory.toLowerCase(), formSubcategory.toLowerCase()],
        weight: formWeight,
        digitalFileUrl: formDigitalUrl,
        allowInstallments: formCategory === 'Contas Digitais' ? false : formAllowInstallments,
        maxInstallments: formCategory === 'Contas Digitais' ? 1 : Number(formMaxInstallments),
        updatedAt: new Date().toISOString(),
        createdAt: editingProduct?.createdAt || new Date().toISOString()
      };

      if (uploadedMedia.length > 0) {
        const primaryMedia = uploadedMedia[0];
        finalProduct.mediaUrl = primaryMedia.url;
        finalProduct.driveFileId = primaryMedia.driveFileId || null;
        finalProduct.driveFolderId = primaryMedia.driveFolderId || null;
        finalProduct.imageMedia = {
          provider: primaryMedia.provider || 'google-drive',
          driveFileId: primaryMedia.driveFileId || null,
          driveFolderId: primaryMedia.driveFolderId || null,
          mediaUrl: primaryMedia.url,
          fileName: primaryMedia.fileName,
          mimeType: primaryMedia.mimeType
        };
        finalProduct.imageMediaList = uploadedMedia.map(media => ({
          provider: media.provider || 'google-drive',
          driveFileId: media.driveFileId || null,
          driveFolderId: media.driveFolderId || null,
          mediaUrl: media.url,
          fileName: media.fileName,
          mimeType: media.mimeType
        }));
      }

      // 5. Salvar o produto de forma atômica no Firestore
      setUploadStatus('Salvando documento do produto no Firestore...');
      await saveStoreProduct(finalProduct);

      // 6. Ler novamente do Firestore para garantir consistência perfeita
      setUploadStatus('Atualizando listagem do banco de dados...');
      const freshProducts = await fetchStoreProducts();
      setCustomProducts(freshProducts);

      // Logar a verificação de salvamento no Firestore
      const verifiedProduct = freshProducts.find(p => p.id === productId);
      console.log("STORE_VERIFICATION_LOG", {
        productId,
        "FIRESTORE image": verifiedProduct?.image || null,
        "FIRESTORE images[0]": verifiedProduct?.images?.[0] || null,
        "PRIMARY IMAGE": verifiedProduct?.image || null,
        "img src": verifiedProduct?.image || null
      });

      // 7. Sucesso somente após gravação e leitura confirmada
      setUploadProgress(100);
      setSuccessMsg(editingProduct ? 'Produto atualizado na Store com sucesso!' : 'Produto cadastrado e publicado na Loja com sucesso!');
      setTimeout(() => setSuccessMsg(''), 4000);
      
      setIsAddModalOpen(false);
      resetForm();
      setEditingProduct(null);

    } catch (err: any) {
      console.error("Failed to upload/save product:", err);
      setErrorMsg(err.message || 'Falha ao salvar produto na nuvem. Verifique a configuração do seu banco de dados.');
      setTimeout(() => setErrorMsg(''), 8000);
    } finally {
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  const handleEditClick = (prod: any) => {
    setEditingProduct(prod);
    setFormName(prod.name || '');
    setFormShortDesc(prod.shortDesc || '');
    setFormFullDesc(prod.fullDesc || '');
    
    // Support category and subcategory with automatic mapping for older products
    const mapped = mapOldCategory(prod.category || 'Roupas');
    const hasCategory = prod.category && OFFICIAL_CATEGORIES.some(c => c.name === prod.category);
    setFormCategory(hasCategory ? prod.category : mapped.category);
    setFormSubcategory(prod.subcategory || mapped.subcategory);

    setFormType(prod.type || 'Físico');
    setFormPrice(prod.price || 'R$ ');
    setFormPromoPrice(prod.promoPrice || '');
    setFormSku(prod.sku || '');
    setFormStock((prod.stock !== undefined ? prod.stock : 10).toString());
    setFormImage(prod.image || '');
    setFormImages(prod.images || (prod.image ? [prod.image] : []));
    setPreviewUrls(prod.images || (prod.image ? [prod.image] : []));
    setSelectedFiles([]);
    setFormBadge(prod.badge || 'LANÇAMENTO');
    setFormWeight(prod.weight || '0.5 kg');
    setFormDigitalUrl(prod.digitalFileUrl || '');
    setFormAllowInstallments(prod.allowInstallments !== undefined ? prod.allowInstallments : (prod.category === 'Contas Digitais' ? false : true));
    setFormMaxInstallments(prod.maxInstallments !== undefined ? prod.maxInstallments : (prod.category === 'Contas Digitais' ? 1 : 12));
    setIsAddModalOpen(true);
  };

  const resetForm = () => {
    setFormName('');
    setFormShortDesc('');
    setFormFullDesc('');
    setFormCategory('Produtos Físicos');
    setFormSubcategory('Roupas');
    setFormPrice('R$ ');
    setFormPromoPrice('');
    setFormSku('');
    setFormStock('10');
    setFormImage('');
    setFormImages([]);
    setPreviewUrls([]);
    setSelectedFiles([]);
    setFormDigitalUrl('');
    setFormAllowInstallments(true);
    setFormMaxInstallments(12);
  };

  const handleDeleteProduct = async (id: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const prod = customProducts.find(p => p.id === id);

      // Firestore must confirm before the UI/cache is changed.
      await deleteStoreProduct(id);
      const freshProducts = await fetchStoreProducts();
      setCustomProducts(freshProducts);
      setSuccessMsg('Produto removido do Firestore e da loja com sucesso.');

      const driveIds = new Set<string>();
      if (prod?.driveFileId) driveIds.add(prod.driveFileId);
      for (const media of prod?.imageMediaList || []) {
        if (media?.driveFileId) driveIds.add(media.driveFileId);
      }
      for (const imgUrl of prod?.images || (prod?.image ? [prod.image] : [])) {
        if (imgUrl?.includes('/api/media/drive/')) driveIds.add(imgUrl.split('/api/media/drive/').pop()!);
      }
      for (const fileId of driveIds) {
        fetch('/api/delete-drive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId })
        }).catch(error => console.warn('Produto excluído; limpeza da imagem no Drive ficou pendente:', error));
      }
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error("Failed to delete product:", err);
      setErrorMsg(err.message || 'Erro ao remover o produto.');
      setTimeout(() => setErrorMsg(''), 6000);
    }
  };

  const handleApprovePending = async (item: any) => {
    const approvedProduct = {
      id: 'prod-' + Date.now(),
      name: item.name,
      shortDesc: item.description,
      fullDesc: item.description,
      category: item.category,
      type: item.type,
      price: item.price,
      stock: 20,
      status: 'Ativo',
      seller: item.seller,
      image: item.image || "",
      images: [item.image],
      featured: false,
      badge: 'MARKETPLACE'
    };
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      await saveStoreProduct(approvedProduct);
      setCustomProducts(prev => [approvedProduct, ...prev]);
      setPendingProducts(prev => prev.filter(p => p.id !== item.id));
      setSuccessMsg(`Anúncio de ${item.seller} aprovado e publicado na Store!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error("Failed to save approved product to Firestore:", err);
      setErrorMsg(err.message || 'Erro ao salvar anúncio aprovado na nuvem.');
      setTimeout(() => setErrorMsg(''), 6000);
    }
  };

  const handleRejectPending = (id: string) => {
    setPendingProducts(prev => prev.filter(p => p.id !== id));
    setSuccessMsg('Anúncio recusado.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const filteredProducts = customProducts.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.seller.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = filterCategory === 'ALL' || p.category === filterCategory;
    const matchType = filterType === 'ALL' || p.type === filterType;
    return matchSearch && matchCat && matchType;
  });

  return (
    <div className="h-full flex flex-col justify-between p-4 md:p-8 max-w-7xl mx-auto w-full text-black">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 border-b border-gray-200">
        <button
          onClick={onBackToMenu}
          className="flex items-center space-x-2 bg-white hover:bg-gray-100 border border-gray-300 px-4 py-2 rounded-xl text-xs font-orbitron text-gray-700 hover:text-black transition-all cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>MENU PRINCIPAL</span>
        </button>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              resetForm();
              setEditingProduct(null);
              setIsAddModalOpen(true);
            }}
            className="bg-[#FF0033] hover:bg-[#d6002b] text-white font-orbitron font-bold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ADICIONAR PRODUTO</span>
          </button>
          <div className="hidden sm:flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-[#FF0033] animate-pulse"></span>
            <span className="font-orbitron font-bold text-sm tracking-wider text-black">STORE & MARKETPLACE MANAGER</span>
          </div>
        </div>
      </div>

      {successMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-6 py-3 rounded-xl flex items-center space-x-3 my-4 font-orbitron text-xs shadow-sm"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </motion.div>
      )}

      {errorMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 border border-rose-300 text-rose-800 px-6 py-3 rounded-xl flex items-center space-x-3 my-4 font-orbitron text-xs shadow-sm"
        >
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </motion.div>
      )}

      {/* Tabs Navigation */}
      <div className="flex space-x-2 my-6 overflow-x-auto pb-2 border-b border-gray-200 scrollbar-thin">
        {[
          { id: 'overview', label: 'Visão Geral', icon: Layers },
          { id: 'produtos', label: 'Produtos', icon: ShoppingBag },
          { id: 'categorias', label: 'Categorias', icon: Tag },
          { id: 'pedidos', label: 'Pedidos', icon: FileText },
          { id: 'vendedores', label: 'Vendedores', icon: Users },
          { id: 'solicitacoes', label: `Solicitações (${sellerRequests.filter(r => r.status === 'Em análise').length})`, icon: Award },
          { id: 'pendentes', label: `Anúncios (${pendingProducts.length})`, icon: Shield },
          { id: 'cupons', label: 'Cupons', icon: Percent },
          { id: 'giftcards', label: 'Gift Cards', icon: Gift },
          { id: 'estoque', label: 'Estoque', icon: Package },
          { id: 'avaliacoes', label: 'Avaliações', icon: Star },
          { id: 'config', label: 'Configurações', icon: Settings }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-orbitron transition-all cursor-pointer flex items-center space-x-2 whitespace-nowrap ${
                isActive
                  ? 'bg-[#FF0033] text-white font-bold shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label.toUpperCase()}</span>
            </button>
          );
        })}
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto pb-8 space-y-6">

        {/* 1. VISÃO GERAL */}
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                <span className="text-xs text-gray-500 font-orbitron font-bold">PRODUTOS ATIVOS</span>
                <h3 className="font-orbitron font-black text-3xl text-black mt-2">{customProducts.length}</h3>
                <span className="text-xs text-emerald-600 mt-2 block font-orbitron">No catálogo da loja</span>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                <span className="text-xs text-gray-500 font-orbitron font-bold">PEDIDOS REALIZADOS</span>
                <h3 className="font-orbitron font-black text-3xl text-black mt-2">
                  {orders.length}
                </h3>
                <span className="text-xs text-amber-600 mt-2 block font-orbitron">
                  {orders.filter(o => o.status === 'Pendente').length} pendente(s) de pagamento
                </span>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                <span className="text-xs text-gray-500 font-orbitron font-bold">RECEITA REAL (PAGO)</span>
                <h3 className="font-orbitron font-black text-2xl text-black mt-3">
                  {formatBRL(
                    orders
                      .filter(o => o.status === 'Pago' || o.status === 'Entregue')
                      .reduce((sum, o) => sum + (o.grossValue || 0), 0)
                  )}
                </h3>
                <span className="text-xs text-emerald-600 mt-2 block font-orbitron">Soma de pedidos liquidados</span>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                <span className="text-xs text-gray-500 font-orbitron font-bold">VENDEDORES PARCEIROS</span>
                <h3 className="font-orbitron font-black text-3xl text-black mt-2">
                  {sellers.length}
                </h3>
                <span className="text-xs text-[#FF0033] mt-2 block font-orbitron">
                  {sellerRequests.filter(s => s.status === 'Em análise').length} solicitação(ões) em análise
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Orders */}
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <h3 className="font-orbitron font-bold text-lg text-black mb-4">ÚLTIMOS PEDIDOS NA STORE</h3>
                <div className="space-y-3">
                  {orders.slice(0, 5).map(order => (
                    <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200">
                      <div>
                        <span className="font-orbitron font-bold text-xs text-black block">{order.id} - {order.item}</span>
                        <span className="text-[11px] text-gray-500 font-sans">{order.user} • {order.date}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-orbitron font-bold text-xs text-[#FF0033] block">{formatBRL(order.amount)}</span>
                        <span className={`text-[10px] font-orbitron font-bold px-2 py-0.5 rounded ${
                          order.status === 'Pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Low stock alerts */}
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <h3 className="font-orbitron font-bold text-lg text-black mb-4">ESTOQUE BAIXO & ALERTAS</h3>
                <div className="space-y-3">
                  {customProducts.filter(p => p.stock <= 5).map(prod => (
                    <div key={prod.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          {(prod.images?.[0] || prod.image) ? (
                            <img src={prod.images?.[0] || prod.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-orbitron font-bold text-[8px] text-gray-400">SEM</span>
                          )}
                        </div>
                        <div>
                          <span className="font-orbitron font-bold text-xs text-black block">{prod.name}</span>
                          <span className="text-[11px] text-amber-800 font-sans">SKU: {prod.sku}</span>
                        </div>
                      </div>
                      <span className="font-orbitron font-bold text-xs bg-amber-200 text-amber-900 px-2.5 py-1 rounded-lg">
                        {prod.stock} un. restantes
                      </span>
                    </div>
                  ))}
                  {customProducts.filter(p => p.stock <= 5).length === 0 && (
                    <div className="py-8 text-center text-gray-500 font-orbitron text-xs">
                      Nenhum produto com estoque crítico no momento.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 2. PRODUTOS */}
        {activeTab === 'produtos' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar produto, categoria..."
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-black focus:border-[#FF0033] focus:outline-none font-sans"
                  />
                </div>

                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-black focus:border-[#FF0033] focus:outline-none font-orbitron"
                >
                  <option value="ALL">TODAS CATEGORIAS</option>
                  {OFFICIAL_CATEGORIES.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>

                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-black focus:border-[#FF0033] focus:outline-none font-orbitron"
                >
                  <option value="ALL">TODOS OS TIPOS</option>
                  <option value="Físico">Físico</option>
                  <option value="Digital">Digital</option>
                  <option value="Gift Card">Gift Card</option>
                  <option value="Serviço">Serviço</option>
                </select>
              </div>

              <button
                onClick={() => {
                  resetForm();
                  setEditingProduct(null);
                  setIsAddModalOpen(true);
                }}
                className="bg-[#FF0033] hover:bg-[#d6002b] text-white font-orbitron font-bold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-2 shadow-md transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>ADICIONAR PRODUTO</span>
              </button>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProducts.map(prod => (
                <div key={prod.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm relative group flex flex-col justify-between">
                  <div>
                    <div className="aspect-square relative overflow-hidden rounded-xl mb-3 bg-gray-100 flex items-center justify-center">
                      {(prod.images?.[0] || prod.image) ? (
                        <img src={prod.images?.[0] || prod.image} alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <span className="font-orbitron font-bold text-[10px] text-gray-400">SEM IMAGEM</span>
                      )}
                      {prod.badge && (
                        <span className="absolute top-2 left-2 bg-[#FF0033] text-white font-orbitron font-extrabold text-[9px] px-2 py-0.5 rounded shadow">
                          {prod.badge}
                        </span>
                      )}
                      <span className="absolute top-2 right-2 bg-black/80 text-white font-orbitron text-[9px] px-2 py-0.5 rounded">
                        {prod.type}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 font-orbitron font-bold">{prod.category} • Vendedor: {prod.seller}</span>
                    <h4 className="font-orbitron font-bold text-black text-sm truncate mt-0.5">{prod.name}</h4>
                    <span className="text-xs text-gray-600 line-clamp-1 mt-1 font-sans">{prod.shortDesc}</span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="font-orbitron font-black text-[#FF0033] text-base">{formatBRL(prod.price)}</span>
                      <span className="text-[10px] text-gray-500 block font-orbitron">Estoque: {prod.stock}</span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditClick(prod)}
                        className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-[#FF0033] rounded-lg transition-colors cursor-pointer"
                        title="Editar produto"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(prod.id)}
                        className="p-2 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-[#FF0033] rounded-lg transition-colors cursor-pointer"
                        title="Excluir produto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* 3. CATEGORIAS */}
        {activeTab === 'categorias' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <div>
                  <h3 className="font-orbitron font-bold text-xl text-black">GERENCIAMENTO DE CATEGORIAS</h3>
                  <span className="text-xs text-gray-500 font-sans">Organize departamentos da Store pública e marketplace.</span>
                </div>
                <button
                  onClick={() => {
                    const name = prompt('Nome da nova categoria:');
                    if (name) {
                      const newCat = { id: 'cat-' + Date.now(), name, slug: name.toLowerCase().replace(/\s+/g, '-'), active: true, count: 0 };
                      setCategories(prev => [...prev, newCat]);
                      setSuccessMsg('Categoria criada com sucesso!');
                      setTimeout(() => setSuccessMsg(''), 3000);
                    }
                  }}
                  className="bg-[#FF0033] text-white font-orbitron font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-2 shadow cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>NOVA CATEGORIA</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-200">
                    <div>
                      <h4 className="font-orbitron font-bold text-black text-sm">{cat.name}</h4>
                      <span className="text-[11px] text-gray-500 font-sans">Slug: /{cat.slug} • {cat.count} produtos</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-[10px] font-orbitron font-bold px-2.5 py-1 rounded-full ${
                        cat.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {cat.active ? 'ATIVA' : 'INATIVA'}
                      </span>
                      <button
                        onClick={() => {
                          setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, active: !c.active } : c));
                        }}
                        className="text-xs font-orbitron text-[#FF0033] hover:underline cursor-pointer"
                      >
                        Alternar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* 4. PEDIDOS */}
        {activeTab === 'pedidos' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
              <h3 className="font-orbitron font-bold text-xl text-black">TODOS OS PEDIDOS DA STORE</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-[10px] font-orbitron text-gray-600 tracking-wider">
                      <th className="py-3 px-4">PEDIDO</th>
                      <th className="py-3 px-4">CLIENTE</th>
                      <th className="py-3 px-4">ITEM</th>
                      <th className="py-3 px-4">VALOR</th>
                      <th className="py-3 px-4">MERCADO PAGO</th>
                      <th className="py-3 px-4">PAGAMENTO</th>
                      <th className="py-3 px-4">ENTREGA</th>
                      <th className="py-3 px-4">DATA</th>
                      <th className="py-3 px-4">AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-sans">
                    {orders.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="py-3.5 px-4 font-orbitron font-bold text-black">{o.id}</td>
                        <td className="py-3.5 px-4 font-semibold text-black">{o.user}</td>
                        <td className="py-3.5 px-4 text-gray-700">{o.item}</td>
                        <td className="py-3.5 px-4 font-orbitron font-bold text-[#FF0033]">{formatBRL(o.amount)}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500">{o.mpId}</td>
                        <td className="py-3.5 px-4">
                          <span className={`font-orbitron text-[10px] px-2.5 py-1 rounded font-bold ${
                            o.status === 'Pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {o.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-orbitron text-[10px] bg-gray-100 border border-gray-200 px-2.5 py-1 rounded text-gray-700 font-bold">
                            {o.deliveryStatus || 'Novo'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-gray-500 text-[11px]">{o.date}</td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => setSelectedViewOrder(o)}
                            className="bg-black hover:bg-zinc-800 text-white font-orbitron font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer"
                          >
                            DETALHES
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW ORDER DETAILS MODAL */}
        {selectedViewOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              className="bg-white rounded-3xl border border-gray-200 shadow-2xl p-6 md:p-8 max-w-lg w-full overflow-hidden text-left space-y-6"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <span className="text-[10px] text-gray-400 font-orbitron uppercase block">DETALHES DO PEDIDO</span>
                  <h4 className="font-orbitron font-black text-lg text-black">{selectedViewOrder.id}</h4>
                </div>
                <button 
                  onClick={() => setSelectedViewOrder(null)}
                  className="p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-black transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs font-sans text-gray-700">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-orbitron text-[9px] text-gray-400 block uppercase font-bold">Item do Pedido</span>
                    <span className="font-bold text-black">{selectedViewOrder.item}</span>
                  </div>
                  <div>
                    <span className="font-orbitron text-[9px] text-gray-400 block uppercase font-bold">Quantidade</span>
                    <span className="font-bold text-black">{selectedViewOrder.quantity}x</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-orbitron text-[9px] text-gray-400 block uppercase font-bold">Total Pago (MP)</span>
                    <span className="font-orbitron font-black text-sm text-[#FF0033]">{formatBRL(selectedViewOrder.grossValue || parseFloat(selectedViewOrder.amount?.replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0)}</span>
                  </div>
                  <div>
                    <span className="font-orbitron text-[9px] text-gray-400 block uppercase font-bold">Data da Compra</span>
                    <span className="text-gray-900">{selectedViewOrder.date}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                  <span className="font-orbitron text-[9px] text-gray-500 block uppercase font-bold">Endereço de Entrega</span>
                  {selectedViewOrder.shippingAddress ? (
                    <div className="space-y-1.5 text-gray-800">
                      <p><strong className="text-black">Destinatário:</strong> {selectedViewOrder.shippingAddress.name}</p>
                      <p><strong className="text-black">Logradouro:</strong> {selectedViewOrder.shippingAddress.street}, Nº {selectedViewOrder.shippingAddress.number}</p>
                      {selectedViewOrder.shippingAddress.complement && (
                        <p><strong className="text-black">Complemento:</strong> {selectedViewOrder.shippingAddress.complement}</p>
                      )}
                      <p><strong className="text-black">Bairro:</strong> {selectedViewOrder.shippingAddress.neighborhood}</p>
                      <p><strong className="text-black">Cidade/UF:</strong> {selectedViewOrder.shippingAddress.city} - {selectedViewOrder.shippingAddress.state}</p>
                      <p><strong className="text-black">CEP:</strong> {selectedViewOrder.shippingAddress.cep}</p>
                      <p><strong className="text-black">Telefone:</strong> {selectedViewOrder.shippingAddress.phone}</p>
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">Produto Digital (Sem endereço de entrega necessário).</p>
                  )}
                </div>

                <div className="space-y-2">
                  <span className="font-orbitron text-[9px] text-gray-400 block uppercase font-bold">Alterar Status da Entrega</span>
                  <div className="flex gap-2">
                    {['Novo', 'Enviado', 'Entregue', 'Cancelado'].map((status) => {
                      const isActive = (selectedViewOrder.deliveryStatus || 'Novo') === status;
                      return (
                        <button
                          key={status}
                          onClick={async () => {
                            if (!isFirebaseConfigured()) return;
                            try {
                              const docRef = doc(db, 'store_orders', selectedViewOrder.id);
                              await setDoc(docRef, { deliveryStatus: status }, { merge: true });
                              setSelectedViewOrder(prev => prev ? { ...prev, deliveryStatus: status } : null);
                              // update list
                              setOrders(prev => prev.map(o => o.id === selectedViewOrder.id ? { ...o, deliveryStatus: status } : o));
                            } catch (e) {
                              console.error("Failed to update delivery status:", e);
                            }
                          }}
                          className={`flex-1 py-2 rounded-xl text-[10px] font-orbitron font-bold uppercase border cursor-pointer transition-all ${
                            isActive 
                              ? 'bg-black text-white border-black shadow-md' 
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setSelectedViewOrder(null)}
                  className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs px-6 py-2.5 rounded-xl cursor-pointer shadow"
                >
                  FECHAR
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 5. VENDEDORES */}
        {activeTab === 'vendedores' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <div>
                  <h3 className="font-orbitron font-bold text-xl text-black">PERFIS DE VENDEDORES AUTORIZADOS</h3>
                  <span className="text-xs text-gray-500 font-sans">Gerencie parceiros de marketplace, comissões e saldos.</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {sellers.map(s => (
                  <div key={s.id} className="p-6 rounded-2xl bg-gray-50 border border-gray-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className={`font-orbitron text-[10px] px-2.5 py-1 rounded font-bold ${
                        s.status === 'Ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {s.status.toUpperCase()}
                      </span>
                      <span className="font-orbitron text-xs text-gray-500 font-bold">Comissão: {s.commission}%</span>
                    </div>
                    <div>
                      <h4 className="font-orbitron font-black text-lg text-black">{s.storeName}</h4>
                      <span className="text-xs text-gray-600 block">{s.owner} ({s.email})</span>
                    </div>
                    <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-orbitron">Saldo:</span>
                      <span className="font-orbitron font-bold text-sm text-[#FF0033]">{s.balance}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* 5.1 SOLICITAÇÕES DE VENDEDORES */}
        {activeTab === 'solicitacoes' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm">
              <h3 className="font-orbitron font-bold text-xl text-black mb-2">SOLICITAÇÕES DE NOVOS VENDEDORES</h3>
              <p className="text-xs text-gray-500 font-sans mb-6">Aprove ou rejeite novas solicitações de usuários para vender na Lockdown Store.</p>
              
              <div className="space-y-4">
                {sellerRequests.map(req => (
                  <div key={req.id} className="p-6 rounded-2xl bg-gray-50 border border-gray-200 space-y-4 text-left">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-3">
                      <div>
                        <span className="font-orbitron font-black text-lg text-black">{req.storeName}</span>
                        <span className="text-xs text-gray-500 block">Responsável: {req.name} ({req.email})</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`font-orbitron text-[10px] px-2.5 py-1 rounded font-bold ${
                          req.status === 'Aprovado' ? 'bg-emerald-100 text-emerald-800' :
                          req.status === 'Rejeitado' ? 'bg-rose-100 text-rose-800' :
                          req.status === 'Suspenso' ? 'bg-gray-200 text-gray-800' :
                          'bg-amber-100 text-amber-800 animate-pulse'
                        }`}>
                          {req.status.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-gray-400 font-orbitron">{new Date(req.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                      <div>
                        <span className="text-gray-500 block font-bold">Tipo de Conta:</span>
                        <span className="text-black">{req.type}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block font-bold">Documento (CPF/CNPJ):</span>
                        <span className="text-black">{req.document || 'Não informado'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block font-bold">Telefone:</span>
                        <span className="text-black">{req.phone || 'Não informado'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block font-bold">Categoria:</span>
                        <span className="text-black">{req.category}</span>
                      </div>
                      <div className="md:col-span-2">
                        <span className="text-gray-500 block font-bold">Redes Sociais / Site:</span>
                        <span className="text-black truncate block">{req.socials || 'Não informado'}</span>
                      </div>
                      <div className="md:col-span-3">
                        <span className="text-gray-500 block font-bold">Descrição dos Produtos:</span>
                        <p className="text-black mt-0.5 bg-white p-2 rounded border border-gray-100">{req.description}</p>
                      </div>
                      {req.observations && (
                        <div className="md:col-span-3">
                          <span className="text-gray-500 block font-bold">Observações:</span>
                          <p className="text-black mt-0.5">{req.observations}</p>
                        </div>
                      )}
                    </div>
                    
                    {req.status === 'Em análise' && (
                      <div className="pt-4 border-t border-gray-100 flex items-center justify-end space-x-3">
                        <button
                          onClick={async () => {
                            if (confirm('Deseja realmente REJEITAR esta solicitação de vendedor?')) {
                              try {
                                const updated = { ...req, status: 'Rejeitado' as const };
                                await saveSellerRequest(updated);
                                setSellerRequests(prev => prev.map(item => item.id === req.id ? updated : item));
                                setSuccessMsg('Solicitação rejeitada com sucesso!');
                                setTimeout(() => setSuccessMsg(''), 3000);
                              } catch (e: any) {
                                setErrorMsg('Erro ao rejeitar no banco: ' + e.message);
                              }
                            }
                          }}
                          className="px-4 py-2 rounded-xl border border-rose-300 hover:bg-rose-50 text-xs font-orbitron text-rose-700 font-bold cursor-pointer transition-all animate-none"
                        >
                          REJEITAR
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Deseja realmente APROVAR esta solicitação de vendedor?')) {
                              try {
                                const updated = { ...req, status: 'Aprovado' as const };
                                await saveSellerRequest(updated);
                                setSellerRequests(prev => prev.map(item => item.id === req.id ? updated : item));
                                setSuccessMsg('Solicitação aprovada! O usuário agora é um vendedor oficial.');
                                setTimeout(() => setSuccessMsg(''), 4000);
                              } catch (e: any) {
                                setErrorMsg('Erro ao aprovar no banco: ' + e.message);
                              }
                            }
                          }}
                          className="px-6 py-2 rounded-xl bg-[#FF0033] hover:bg-[#d6002b] text-white text-xs font-orbitron font-bold shadow cursor-pointer transition-all animate-none"
                        >
                          APROVAR COMO VENDEDOR
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                
                {sellerRequests.length === 0 && (
                  <div className="py-12 text-center text-gray-500 font-orbitron text-xs bg-gray-50 rounded-2xl border">
                    Nenhuma solicitação de vendedor enviada até o momento.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* 6. ANÚNCIOS PENDENTES */}
        {activeTab === 'pendentes' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm">
              <h3 className="font-orbitron font-bold text-xl text-black mb-6">MODERAÇÃO DE ANÚNCIOS DE VENDEDORES</h3>
              <div className="space-y-4">
                {pendingProducts.map(item => (
                  <div key={item.id} className="p-6 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center space-x-4">
                      <img src={item.image} alt="" className="w-20 h-20 object-cover rounded-xl border" />
                      <div>
                        <span className="font-orbitron text-[10px] text-[#FF0033] font-bold">Vendedor: {item.seller}</span>
                        <h4 className="font-orbitron font-bold text-black text-base">{item.name}</h4>
                        <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                        <span className="text-[10px] text-gray-400 font-orbitron mt-2 block">Enviado em: {item.submittedAt}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
                      <button
                        onClick={() => handleRejectPending(item.id)}
                        className="px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-200 text-xs font-orbitron text-gray-700 font-bold cursor-pointer"
                      >
                        RECUSAR
                      </button>
                      <button
                        onClick={() => handleApprovePending(item)}
                        className="px-6 py-2.5 rounded-xl bg-[#FF0033] hover:bg-[#d6002b] text-white text-xs font-orbitron font-bold shadow cursor-pointer"
                      >
                        APROVAR E PUBLICAR
                      </button>
                    </div>
                  </div>
                ))}
                {pendingProducts.length === 0 && (
                  <div className="py-12 text-center text-gray-500 font-orbitron text-xs">
                    Nenhum anúncio pendente de moderação no momento.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* 7. CUPONS */}
        {activeTab === 'cupons' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <h3 className="font-orbitron font-bold text-xl text-black">CUPONS DE DESCONTO</h3>
                <button
                  onClick={() => {
                    const code = prompt('Código do cupom (ex: VERAO2026):');
                    const value = prompt('Valor do desconto (ex: 15% ou R$ 30,00):');
                    if (code && value) {
                      const newCp = { id: 'cp-' + Date.now(), code: code.toUpperCase(), type: 'Percentual', value, minOrder: 'R$ 0,00', uses: 0, maxUses: 100, active: true };
                      setCoupons(prev => [...prev, newCp]);
                      setSuccessMsg('Cupom criado com sucesso!');
                      setTimeout(() => setSuccessMsg(''), 3000);
                    }
                  }}
                  className="bg-[#FF0033] text-white font-orbitron font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-2 shadow cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>NOVO CUPOM</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {coupons.map(cp => (
                  <div key={cp.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <div>
                      <span className="font-orbitron font-black text-black text-base">{cp.code}</span>
                      <span className="text-xs text-[#FF0033] font-orbitron font-bold block mt-0.5">Desconto: {cp.value}</span>
                      <span className="text-[11px] text-gray-500 font-sans block mt-1">Usos: {cp.uses} / {cp.maxUses}</span>
                    </div>
                    <span className="font-orbitron text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded font-bold">
                      ATIVO
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* 8. GIFT CARDS */}
        {activeTab === 'giftcards' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <div>
                  <h3 className="font-orbitron font-bold text-xl text-black">GERENCIAMENTO DE GIFT CARDS</h3>
                  <span className="text-xs text-gray-500 font-sans">Códigos protegidos no backend liberados somente após pagamento confirmado.</span>
                </div>
                <button
                  onClick={() => {
                    const name = prompt('Nome do Gift Card (ex: Gift Card R$ 150):');
                    const value = prompt('Valor (ex: R$ 150,00):');
                    if (name && value) {
                      const newCode = { id: 'gc-' + Date.now(), name, code: `LOCK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`, value, status: 'Disponível', buyer: '-' };
                      setGiftCardCodes(prev => [...prev, newCode]);
                      setSuccessMsg('Gift card gerado com sucesso!');
                      setTimeout(() => setSuccessMsg(''), 3000);
                    }
                  }}
                  className="bg-[#FF0033] text-white font-orbitron font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-2 shadow cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>GERAR CÓDIGO</span>
                </button>
              </div>

              <div className="space-y-3">
                {giftCardCodes.map(gc => (
                  <div key={gc.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <div>
                      <span className="font-orbitron font-bold text-sm text-black">{gc.name}</span>
                      <span className="font-mono text-xs text-[#FF0033] block mt-1 font-bold">Código: {gc.code}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-orbitron font-bold text-xs text-black block">{gc.value}</span>
                      <span className={`text-[10px] font-orbitron font-bold px-2 py-0.5 rounded ${
                        gc.status === 'Disponível' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {gc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* 9. ESTOQUE */}
        {activeTab === 'estoque' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm max-w-5xl mx-auto">
              <h3 className="font-orbitron font-bold text-xl text-black mb-6">CONTROLE DE ESTOQUE DE PRODUTOS</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-[10px] font-orbitron text-gray-600 tracking-wider">
                      <th className="py-3 px-4">PRODUTO</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">CATEGORIA</th>
                      <th className="py-3 px-4">ESTOQUE ATUAL</th>
                      <th className="py-3 px-4">STATUS</th>
                      <th className="py-3 px-4">AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-sans">
                    {customProducts.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="py-3.5 px-4 font-orbitron font-semibold text-black">{p.name}</td>
                        <td className="py-3.5 px-4 font-mono text-gray-500">{p.sku}</td>
                        <td className="py-3.5 px-4 text-gray-700">{p.category}</td>
                        <td className="py-3.5 px-4 font-orbitron font-bold text-black">{p.stock} unidades</td>
                        <td className="py-3.5 px-4">
                          <span className={`font-orbitron text-[10px] px-2.5 py-1 rounded font-bold ${
                            p.stock > 5 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {p.stock > 5 ? 'EM ESTOQUE' : 'ESTOQUE BAIXO'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={async () => {
                              const newStock = prompt(`Novo estoque para ${p.name}:`, p.stock.toString());
                              if (newStock !== null) {
                                const updatedStock = parseInt(newStock) || 0;
                                const updatedProd = { ...p, stock: updatedStock };
                                setErrorMsg('');
                                setSuccessMsg('');
                                try {
                                  await saveStoreProduct(updatedProd);
                                  setCustomProducts(prev => prev.map(prod => prod.id === p.id ? updatedProd : prod));
                                  setSuccessMsg('Estoque atualizado!');
                                  setTimeout(() => setSuccessMsg(''), 3000);
                                } catch (err: any) {
                                  console.error("Failed to update stock in Firestore:", err);
                                  setErrorMsg(err.message || 'Erro ao atualizar estoque na nuvem.');
                                  setTimeout(() => setErrorMsg(''), 6000);
                                }
                              }
                            }}
                            className="font-orbitron text-xs text-[#FF0033] hover:underline font-bold cursor-pointer"
                          >
                            Atualizar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* 10. AVALIAÇÕES */}
        {activeTab === 'avaliacoes' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm max-w-4xl mx-auto">
              <h3 className="font-orbitron font-bold text-xl text-black mb-6">MODERAÇÃO DE AVALIAÇÕES DE CLIENTES</h3>
              <div className="space-y-4">
                {reviews.map(rev => (
                  <div key={rev.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-orbitron font-bold text-black text-xs">{rev.product}</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Compra Verificada</span>
                      </div>
                      <p className="text-xs text-gray-700 mt-1">{rev.comment} — <span className="font-semibold">{rev.user}</span></p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex text-amber-500">
                        {[...Array(rev.rating)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                      </div>
                      <button
                        onClick={() => {
                          setReviews(prev => prev.filter(r => r.id !== rev.id));
                          setSuccessMsg('Avaliação removida.');
                          setTimeout(() => setSuccessMsg(''), 3000);
                        }}
                        className="text-gray-400 hover:text-[#FF0033] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* 11. CONFIGURAÇÕES */}
        {activeTab === 'config' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm max-w-3xl mx-auto space-y-6">
              <h3 className="font-orbitron font-bold text-xl text-black">CONFIGURAÇÕES GERAIS DA STORE</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-200">
                  <div>
                    <h4 className="font-orbitron font-bold text-black text-xs">LOJA PÚBLICA ATIVA</h4>
                    <span className="text-[11px] text-gray-500">Exibir e-commerce para visitantes</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={storeSettings.storeActive}
                    onChange={e => setStoreSettings({ ...storeSettings, storeActive: e.target.checked })}
                    className="w-5 h-5 accent-[#FF0033] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-200">
                  <div>
                    <h4 className="font-orbitron font-bold text-black text-xs">PERMITIR VENDEDORES (MARKETPLACE)</h4>
                    <span className="text-[11px] text-gray-500">Usuários podem solicitar perfil de vendedor</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={storeSettings.allowSellers}
                    onChange={e => setStoreSettings({ ...storeSettings, allowSellers: e.target.checked })}
                    className="w-5 h-5 accent-[#FF0033] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-200">
                  <div>
                    <h4 className="font-orbitron font-bold text-black text-xs">APROVAÇÃO OBRIGATÓRIA DE ANÚNCIOS</h4>
                    <span className="text-[11px] text-gray-500">Produtos de vendedores precisam ser aprovados no admin</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={storeSettings.requireApproval}
                    onChange={e => setStoreSettings({ ...storeSettings, requireApproval: e.target.checked })}
                    className="w-5 h-5 accent-[#FF0033] cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">COMISSÃO PADRÃO DO MARKETPLACE (%)</label>
                  <input
                    type="number"
                    value={storeSettings.defaultCommission}
                    onChange={e => setStoreSettings({ ...storeSettings, defaultCommission: Number(e.target.value) })}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                  />
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={async () => {
                      try {
                        await saveStoreSettings(storeSettings);
                        setSuccessMsg('Configurações da Store salvas com sucesso!');
                        setTimeout(() => setSuccessMsg(''), 3000);
                      } catch (err: any) {
                        setErrorMsg('Erro ao salvar no Firestore: ' + (err.message || err));
                        setTimeout(() => setErrorMsg(''), 4000);
                      }
                    }}
                    className="bg-[#FF0033] hover:bg-[#d6002b] text-white font-orbitron font-bold px-8 py-3.5 rounded-xl text-xs shadow-md transition-all cursor-pointer"
                  >
                    SALVAR CONFIGURAÇÕES
                  </button>
                </div>
              </div>
            </div>

            {/* Bloco de Diagnóstico da Store */}
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm max-w-3xl mx-auto space-y-6 mt-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center space-x-3">
                  <Shield className="w-5 h-5 text-[#FF0033]" />
                  <h3 className="font-orbitron font-bold text-lg text-black">DIAGNÓSTICO DA LOCKDOWN STORE</h3>
                </div>
                <button
                  onClick={runStoreDiagnostics}
                  disabled={isTestingDiagnostics}
                  className="flex items-center space-x-2 text-xs font-orbitron font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingDiagnostics ? 'animate-spin' : ''}`} />
                  <span>{isTestingDiagnostics ? 'TESTANDO...' : 'TESTAR NOVAMENTE'}</span>
                </button>
              </div>

              {diagnostics ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Status do Firebase */}
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
                      <span className="text-[10px] font-orbitron font-bold text-gray-400 block uppercase">Firebase & Firestore</span>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${diagnostics.firebaseOk ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="font-sans font-bold text-sm text-black">
                          {diagnostics.firebaseOk ? 'Ativo e Conectado' : 'Modo Dummy/Simulado'}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 block">
                        {diagnostics.firebaseOk ? 'Banco Firestore persistente operacional.' : 'Usando dados simulados em cache local.'}
                      </span>
                    </div>

                    {/* Status das Chaves Google Drive */}
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
                      <span className="text-[10px] font-orbitron font-bold text-gray-400 block uppercase">Chaves do Google Drive</span>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${!diagnostics.driveSimulated ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="font-sans font-bold text-sm text-black">
                          {!diagnostics.driveSimulated ? 'Credenciais Reais Ativas' : 'Modo Simulação Ativo'}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 block">
                        {!diagnostics.driveSimulated ? 'Service Account autenticada com sucesso.' : 'Usando fallback resiliente sem upload real.'}
                      </span>
                    </div>

                    {/* Status da Pasta Raiz */}
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
                      <span className="text-[10px] font-orbitron font-bold text-gray-400 block uppercase">Pasta Raiz (Módulos)</span>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${diagnostics.driveRootOk ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="font-sans font-bold text-sm text-black">
                          {diagnostics.driveRootOk ? 'Totalmente Acessível' : 'Pendente / Simulada'}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 block">
                        {diagnostics.driveRootOk ? ' LOCKDOWN PRODUTORA / Store / Produtos ativa.' : 'Fallback de diretório simulado ativado.'}
                      </span>
                    </div>
                  </div>

                  {/* Uploads Recentes da Store */}
                  <div className="space-y-3">
                    <span className="text-xs font-orbitron font-bold text-black uppercase block">Uploads Recentes na Store (Firestore)</span>
                    {diagnostics.recentUploads.length > 0 ? (
                      <div className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-100">
                        {diagnostics.recentUploads.map((up) => (
                          <div key={up.id} className="p-3.5 bg-gray-50 flex items-center justify-between text-xs font-sans">
                            <div className="flex flex-col space-y-0.5">
                              <span className="font-bold text-black truncate max-w-xs">{up.fileName || 'Arquivo sem nome'}</span>
                              <span className="text-[10px] text-gray-500">ID: {up.fileId || up.id}</span>
                            </div>
                            <div className="flex items-center space-x-3 text-right">
                              <span className="text-[10px] text-gray-400">
                                {up.uploadedAt ? new Date(up.uploadedAt).toLocaleDateString() : 'Sem data'}
                              </span>
                              {up.url && (
                                <a
                                  href={up.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#FF0033] hover:underline font-bold text-[10px] uppercase font-orbitron flex items-center space-x-1"
                                >
                                  <span>Visualizar</span>
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 bg-gray-50 border border-dashed border-gray-200 rounded-2xl text-center">
                        <span className="text-xs text-gray-400 block font-sans">Nenhum upload de produto registrado recentemente no Firestore.</span>
                      </div>
                    )}
                  </div>

                  {/* Ações de Limpeza */}
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-orbitron font-bold text-amber-900 text-xs uppercase">Resetar Cache do Navegador</h4>
                        <p className="text-[11px] text-amber-700 font-sans mt-0.5 leading-relaxed">
                          Se você notar produtos inconsistentes ou estados quebrados no painel, limpe o cache local do navegador para forçar a resincronização direta dos dados do Firestore.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleResetLocalStorage}
                      className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-orbitron font-bold px-4 py-2.5 rounded-xl text-[10px] uppercase shadow-sm transition-all flex items-center space-x-2 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Limpar Cache / Reset</span>
                    </button>
                  </div>

                  <span className="text-[10px] text-gray-400 block text-right font-sans">Último diagnóstico realizado às {diagnostics.lastChecked}</span>
                </div>
              ) : (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <RefreshCw className="w-6 h-6 text-[#FF0033] animate-spin mx-auto mb-2" />
                  <span className="text-xs text-gray-500 font-sans block">Carregando métricas e verificando status do sistema...</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

      </div>

      {/* Add Product Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white max-w-2xl w-full p-8 rounded-3xl border-2 border-[#FF0033] shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  resetForm();
                  setEditingProduct(null);
                }}
                className="absolute top-4 right-4 text-gray-500 hover:text-black transition-colors p-2 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-[#FF0033]/10 border border-[#FF0033] flex items-center justify-center text-[#FF0033]">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-orbitron text-[10px] text-[#FF0033] tracking-widest block font-bold">LOCKDOWN STORE ADMIN</span>
                  <h2 className="font-orbitron font-black text-2xl text-black">
                    {editingProduct ? 'EDITAR PRODUTO EXISTENTE' : 'CADASTRAR NOVO PRODUTO'}
                  </h2>
                </div>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">TIPO DO PRODUTO</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as any)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                    >
                      <option value="Físico">Produto Físico (Roupas, Copos, Eletrônicos)</option>
                      <option value="Digital">Produto Digital (Download, Licença, Stems)</option>
                      <option value="Gift Card">Gift Card / Código</option>
                      <option value="Serviço">Serviço Autorizado (Design, Produção, Mix)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">CATEGORIA</label>
                    <select
                      value={formCategory}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        setFormCategory(newCat);
                        const catObj = OFFICIAL_CATEGORIES.find(c => c.name === newCat);
                        if (catObj && catObj.subcategories.length > 0) {
                          setFormSubcategory(catObj.subcategories[0].name);
                        } else {
                          setFormSubcategory('');
                        }
                        
                        // Default installment settings based on category for new products
                        if (!editingProduct) {
                          if (newCat === 'Contas Digitais') {
                            setFormAllowInstallments(false);
                            setFormMaxInstallments(1);
                          } else {
                            setFormAllowInstallments(true);
                            setFormMaxInstallments(12);
                          }
                        }
                      }}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                    >
                      {OFFICIAL_CATEGORIES.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">SUBCATEGORIA</label>
                    <select
                      value={formSubcategory}
                      onChange={(e) => setFormSubcategory(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                      required
                    >
                      {(OFFICIAL_CATEGORIES.find(c => c.name === formCategory)?.subcategories || []).map(sub => (
                        <option key={sub.id} value={sub.name}>{sub.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">NOME DO PRODUTO</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Moletom Oversized Lockdown"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">PREÇO</label>
                    <input
                      type="text"
                      value={formPrice}
                      onChange={(e) => setFormPrice(maskBRL(e.target.value))}
                      placeholder="R$ 299,90"
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">ESTOQUE</label>
                    <input
                      type="number"
                      value={formStock}
                      onChange={(e) => setFormStock(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">DESCRIÇÃO CURTA</label>
                  <input
                    type="text"
                    value={formShortDesc}
                    onChange={(e) => setFormShortDesc(e.target.value)}
                    placeholder="Resumo exibido na vitrine"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                  />
                </div>

                {/* CONFIGURAÇÕES DE PAGAMENTO */}
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl space-y-3">
                  <span className="text-xs font-orbitron font-bold text-[#FF0033] tracking-wider block">CONFIGURAÇÕES DE PAGAMENTO</span>
                  
                  {formCategory === 'Contas Digitais' ? (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-xl font-sans">
                      <strong>Atenção:</strong> Produtos da categoria <strong>Contas Digitais</strong> não possuem checkout via Mercado Pago ou parcelamento por regras fiscais e termos de uso. O fluxo direciona o cliente automaticamente para falar com a Lockdown via WhatsApp.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">PERMITIR PARCELAMENTO</label>
                        <select
                          value={formAllowInstallments ? 'SIM' : 'NÃO'}
                          onChange={(e) => {
                            const isSim = e.target.value === 'SIM';
                            setFormAllowInstallments(isSim);
                            if (!isSim) {
                              setFormMaxInstallments(1);
                            } else {
                              setFormMaxInstallments(12);
                            }
                          }}
                          className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                        >
                          <option value="SIM">SIM</option>
                          <option value="NÃO">NÃO</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">MÁXIMO DE PARCELAS</label>
                        <select
                          value={formMaxInstallments}
                          disabled={!formAllowInstallments}
                          onChange={(e) => setFormMaxInstallments(Number(e.target.value))}
                          className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans disabled:opacity-50"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                            <option key={num} value={num}>{num}x</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">IMAGENS DO PRODUTO (UPLOAD REAL)</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center bg-gray-50 hover:bg-gray-100 transition-colors relative">
                    <input
                      type="file"
                      multiple
                      accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
                      disabled={isUploading}
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;

                        const fileList: File[] = Array.from(files) as File[];
                        
                        // Create local object URLs for immediate preview
                        const localUrls = fileList.map((file: any) => URL.createObjectURL(file));
                        
                        // Set previewUrls and selectedFiles
                        setPreviewUrls(prev => {
                          const remaining = prev.filter(url => !url.startsWith('blob:'));
                          return [...remaining, ...localUrls];
                        });
                        setSelectedFiles(prev => [...prev, ...fileList]);

                        const productId = editingProduct ? editingProduct.id : 'new-product-temp';

                        // Log image details
                        fileList.forEach((file, idx) => {
                          console.log("STORE_IMAGE_DEBUG", {
                            action: "Selected file from input",
                            fileName: file.name,
                            fileType: file.type,
                            fileSize: file.size,
                            productId: productId,
                            previewUrl: localUrls[idx]
                          });
                        });
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                      <ImageIcon className="w-8 h-8 text-[#FF0033]" />
                      <span className="font-orbitron font-bold text-xs text-black">CLIQUE PARA ADICIONAR OU ARRASTE AS FOTOS</span>
                      <span className="text-[10px] text-gray-500 font-sans">PNG, JPG, JPEG, WEBP, GIF (Enviado de forma segura ao Google Drive da Lockdown)</span>
                    </div>
                  </div>

                  {isUploading && (
                    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs font-orbitron font-bold">
                        <span className="text-gray-700">{uploadStatus}</span>
                        <span className="text-[#FF0033]">{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#FF0033] transition-all duration-300" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {previewUrls.length > 0 ? (
                    <div className="grid grid-cols-4 gap-3 mt-4">
                      {previewUrls.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border-2 border-gray-200 group bg-black">
                          <img src={img} alt="" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-1 space-y-1">
                            <button
                              type="button"
                              onClick={() => {
                                const urlToRemove = img;
                                const updatedPreviews = previewUrls.filter((_, i) => i !== idx);
                                setPreviewUrls(updatedPreviews);
                                
                                if (urlToRemove.startsWith('blob:')) {
                                  // Calculate how many blob URLs came before this one to remove correct file from selectedFiles
                                  const blobIndex = previewUrls.slice(0, idx).filter(u => u.startsWith('blob:')).length;
                                  setSelectedFiles(prev => prev.filter((_, i) => i !== blobIndex));
                                }
                              }}
                              className="bg-[#FF0033] text-white text-[9px] font-orbitron px-2 py-1 rounded w-full cursor-pointer"
                            >
                              Remover
                            </button>
                          </div>
                          {idx === 0 && (
                            <span className="absolute top-1 left-1 bg-[#FF0033] text-white text-[8px] font-orbitron font-bold px-1.5 py-0.5 rounded">
                              Principal
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 p-4 text-center rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-500 font-orbitron font-bold uppercase tracking-wider">
                      Sem imagem selecionada
                    </div>
                  )}
                </div>

                {formType === 'Digital' && (
                  <div>
                    <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">URL DO ARQUIVO DIGITAL SEGURO</label>
                    <input
                      type="url"
                      value={formDigitalUrl}
                      onChange={(e) => setFormDigitalUrl(e.target.value)}
                      placeholder="https://lockdownprodutora.com.br/downloads/..."
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                    />
                  </div>
                )}

                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      resetForm();
                      setEditingProduct(null);
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-orbitron font-bold px-6 py-3 rounded-xl text-xs transition-all cursor-pointer border border-gray-300"
                  >
                    CANCELAR
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="bg-[#FF0033] hover:bg-[#d6002b] text-white font-orbitron font-bold px-8 py-3 rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center space-x-2"
                  >
                    {editingProduct ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span>{editingProduct ? 'SALVAR ALTERAÇÕES' : 'PUBLICAR PRODUTO'}</span>
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
