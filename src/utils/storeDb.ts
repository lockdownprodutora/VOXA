import { db, isFirebaseConfigured, auth, signOut, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, serverTimestamp, isFirestoreWriteQuotaExhausted, markFirestoreWriteQuotaExhausted } from "../lib/firebase";
import { runTransaction } from "firebase/firestore";
import { Product, Show, Fundraiser, FundraiserContribution, PublicCategoryItem, TravelBooking } from "../types";
export { type Show };

function cleanUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined) as unknown as T;
  }
  const newObj: any = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== undefined) {
      newObj[key] = cleanUndefined(val);
    }
  }
  return newObj as T;
}

const PRODUCTS_LOCAL_KEY = 'voxa_store_products';
const COMPANY_SETTINGS_LOCAL_KEY = 'voxa_company_info';

let _firestoreQuotaExceededUntil = 0;

export function isFirestoreQuotaThrottled(): boolean {
  return Date.now() < _firestoreQuotaExceededUntil;
}

export function handleFirestoreError(collectionName: string, err: any): boolean {
  const errMsg = err?.message || String(err);
  const isQuota = errMsg.includes('Quota') || errMsg.includes('quota') || err?.code === 'resource-exhausted';
  if (isQuota) {
    _firestoreQuotaExceededUntil = Date.now() + 60000;
    console.warn(`[Firestore Quota Notice] ${collectionName}: Quota diária do Firestore atingida ou em descanso. Servindo dados do cache local com segurança.`);
    return true;
  }
  console.warn(`[Firestore Notice] ${collectionName} fetch failed, using fallback:`, errMsg);
  return false;
}

export function getCurrentUserRole(): 'ADMINISTRATOR' | 'MANAGER' | 'SUPPORT' | 'NONE' {
  const saved = localStorage.getItem('voxa_current_user');
  if (!saved) return 'NONE';
  try {
    const user = JSON.parse(saved);
    const email = (user.email || '').toLowerCase().trim();
    const adminRole = String(user.adminRole || '').toUpperCase().trim();

    if (
      adminRole === 'SUPER_ADMIN' ||
      adminRole === 'ADMINISTRATOR' ||
      email === 'lockdownprodutora@gmail.com' ||
      email === 'admin@lockdownprodutora.com.br' ||
      email.endsWith('@lockdownprodutora.com.br') ||
      user.uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' ||
      user.uid === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1'
    ) {
      return 'ADMINISTRATOR';
    }
    if (adminRole === 'MANAGER') {
      return 'MANAGER';
    }
    if (adminRole === 'SUPPORT') {
      return 'SUPPORT';
    }
    if (user.role === 'ADMINISTRATOR' || user.role === 'ADMINISTRADOR' || user.isAdmin === true || user.role === 'admin' || user.role === 'Admin') {
      return 'ADMINISTRATOR';
    }
    if (user.role === 'MANAGER' || user.role === 'Gerente') {
      return 'MANAGER';
    }
    if (user.role === 'SUPPORT' || user.role === 'Suporte') {
      return 'SUPPORT';
    }
    return 'NONE';
  } catch (e) {
    return 'NONE';
  }
}

export function enforceRole(allowedRoles: ('ADMINISTRATOR' | 'MANAGER' | 'SUPPORT')[]) {
  const role = getCurrentUserRole();
  if (role === 'NONE' || !allowedRoles.includes(role)) {
    throw new Error(`Acesso negado: Seu cargo (${role}) não possui privilégios para executar esta operação.`);
  }
}

// We do NOT use hardcoded mock products for production fallback.
// If Firestore returns nothing, the return will be empty [].
// But we still persist to localStorage when edited by Admin.
export async function fetchStoreProducts(): Promise<Product[]> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const q = collection(db, 'store_products');
      const snapshot = await getDocs(q);
      const list: Product[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const p = { ...data, id: doc.id } as Product;
        
        // Auto backfill and check fields for existing products
        if (p.allowInstallments === undefined || p.maxInstallments === undefined) {
          if (p.category === 'Contas Digitais') {
            p.allowInstallments = false;
            p.maxInstallments = 1;
          } else {
            p.allowInstallments = p.allowInstallments !== undefined ? p.allowInstallments : true;
            p.maxInstallments = p.maxInstallments !== undefined ? p.maxInstallments : 12;
          }
        }
        
        list.push(p);
      });
      localStorage.setItem(PRODUCTS_LOCAL_KEY, JSON.stringify(list));
      return list;
    } catch (err: any) {
      handleFirestoreError('store_products', err);
    }
  }

  try {
    const saved = localStorage.getItem(PRODUCTS_LOCAL_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}

  return [];
}

export async function fetchShows(): Promise<Show[]> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const q = collection(db, 'shows');
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const list: Show[] = [];
        snapshot.forEach(d => {
          list.push({ id: d.id, ...d.data() } as Show);
        });
        localStorage.setItem('lockdown_shows', JSON.stringify(list));
        return list;
      }
    } catch (err) {
      handleFirestoreError('shows', err);
    }
  }

  try {
    const saved = localStorage.getItem('lockdown_shows');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {}

  return [];
}

export async function saveShow(show: Show): Promise<void> {
  enforceRole(['ADMINISTRATOR', 'MANAGER']);
  if (!isFirebaseConfigured()) {
    throw new Error("O Firebase não está conectado.");
  }
  const docRef = doc(db, 'shows', show.id);
  const cleanedShow = cleanUndefined(show);
  await setDoc(docRef, cleanedShow);

  try {
    const saved = localStorage.getItem('lockdown_shows');
    let list: Show[] = saved ? JSON.parse(saved) : [];
    list = list.filter(s => s.id !== show.id);
    list.unshift(show);
    localStorage.setItem('lockdown_shows', JSON.stringify(list));
  } catch (e) {}
}

export async function deleteShow(id: string): Promise<void> {
  enforceRole(['ADMINISTRATOR', 'MANAGER']);
  if (!isFirebaseConfigured()) {
    throw new Error("O Firebase não está conectado.");
  }
  const docRef = doc(db, 'shows', id);
  await deleteDoc(docRef);

  try {
    const saved = localStorage.getItem('lockdown_shows');
    if (saved) {
      const list: Show[] = JSON.parse(saved);
      const updated = list.filter(s => s.id !== id);
      localStorage.setItem('lockdown_shows', JSON.stringify(updated));
    }
  } catch (e) {}
}

export async function saveStoreProduct(product: Product): Promise<void> {
  enforceRole(['ADMINISTRATOR', 'MANAGER']);
  if (!isFirebaseConfigured()) {
    throw new Error("O Firebase não está conectado ou configurado no ambiente. Novas criações ou atualizações de produtos exigem que a integração em nuvem esteja ativa para que fiquem visíveis para todos os visitantes.");
  }

  try {
    const docRef = doc(db, 'store_products', product.id);
    const cleanedProduct = cleanUndefined(product);
    await setDoc(docRef, cleanedProduct);
  } catch (err: any) {
    console.error("Firestore product save failed:", err);
    throw new Error(`Falha ao gravar produto no banco de dados Firestore: ${err.message || err}`);
  }

  // Only sync to local storage after successful Firestore write
  try {
    const saved = localStorage.getItem(PRODUCTS_LOCAL_KEY);
    let list: Product[] = [];
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        list = parsed;
      }
    }
    list = list.filter(p => p.id !== product.id);
    list.unshift(product);
    localStorage.setItem(PRODUCTS_LOCAL_KEY, JSON.stringify(list));
  } catch (e) {}
}

export async function deleteStoreProduct(id: string): Promise<void> {
  enforceRole(['ADMINISTRATOR', 'MANAGER']);
  if (!isFirebaseConfigured()) {
    throw new Error("O Firebase não está conectado ou configurado no ambiente. A remoção de produtos exige que a integração em nuvem esteja ativa.");
  }

  try {
    const docRef = doc(db, 'store_products', id);
    await deleteDoc(docRef);
    const confirmation = await getDoc(docRef);
    if (confirmation.exists()) {
      throw new Error('O Firestore não confirmou a exclusão do produto.');
    }
  } catch (err: any) {
    console.error("Firestore product delete failed:", err);
    throw new Error(`Falha ao remover produto do banco de dados Firestore: ${err.message || err}`);
  }

  // Only sync to local storage after successful Firestore delete
  try {
    const saved = localStorage.getItem(PRODUCTS_LOCAL_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const updated = parsed.filter(p => p.id !== id);
        localStorage.setItem(PRODUCTS_LOCAL_KEY, JSON.stringify(updated));
      }
    }
  } catch (e) {}
}

export interface CompanySettings {
  companyName: string;
  tradeName: string;
  document: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  logoUrl: string;
  faviconUrl?: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  twitter?: string;
  bankName?: string;
  bankCode?: string;
  agency?: string;
  accountNumber?: string;
  accountType?: string;
  holderName?: string;
  holderDoc?: string;
  pixKey?: string;
  pixType?: string;
  termsOfUse?: string;
  privacyPolicy?: string;
  refundPolicy?: string;
  companyBio?: string;
  mascotUrl?: string;
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: 'VOXA Tecnologia e Redes Sociais LTDA',
  tradeName: 'VOXA',
  document: '99.999.999/0001-99',
  email: 'contato@voxa.com.br',
  phone: '+55 (11) 99999-9999',
  whatsapp: '+55 (11) 99999-9999',
  address: 'Avenida Paulista, 1000 - Bela Vista',
  city: 'São Paulo',
  state: 'SP',
  zipCode: '01311-100',
  logoUrl: "",
  faviconUrl: "",
  instagram: 'voxa.social',
  youtube: 'voxasocial',
  tiktok: 'voxa.social',
  twitter: 'voxasocial',
  bankName: '',
  bankCode: '',
  agency: '',
  accountNumber: '',
  accountType: 'Conta Jurídica (PJ)',
  holderName: '',
  holderDoc: '',
  pixKey: '',
  pixType: 'E-mail',
  termsOfUse: '',
  privacyPolicy: '',
  refundPolicy: '',
  companyBio: 'VOXA — Uma nova dimensão social. Conecte-se com pessoas, marcas e criadores de conteúdo.',
  mascotUrl: ''
};

export async function fetchCompanySettings(): Promise<CompanySettings> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const docRef = doc(db, 'company_settings', 'settings');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as CompanySettings;
        // Sync local storage
        localStorage.setItem(COMPANY_SETTINGS_LOCAL_KEY, JSON.stringify(data));
        // Also sync other legacy/different keys that components might read
        localStorage.setItem('lockdown_company_settings', JSON.stringify(data));
        return data;
      }
    } catch (err) {
      handleFirestoreError('company_settings', err);
    }
  }

  // Local storage fallback
  try {
    const saved = localStorage.getItem(COMPANY_SETTINGS_LOCAL_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {}

  return DEFAULT_COMPANY_SETTINGS;
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  enforceRole(['ADMINISTRATOR']);
  if (!isFirebaseConfigured()) {
    throw new Error("O Firebase não está conectado ou configurado no ambiente. Novas configurações da empresa exigem que a integração em nuvem esteja ativa.");
  }

  try {
    const docRef = doc(db, 'company_settings', 'settings');
    await setDoc(docRef, settings);
  } catch (err: any) {
    console.error("Firestore company_settings save failed:", err);
    throw new Error(`Falha ao salvar configurações no Firestore: ${err.message || err}`);
  }

  // Only sync to local storage after successful Firestore write
  try {
    localStorage.setItem(COMPANY_SETTINGS_LOCAL_KEY, JSON.stringify(settings));
    localStorage.setItem('lockdown_company_settings', JSON.stringify(settings));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('company_settings_updated', { detail: { settings } }));
    }
  } catch (e) {}
}

export interface SellerRequest {
  id: string;
  userId: string;
  name: string;
  storeName: string;
  email: string;
  phone: string;
  document: string;
  type: 'Pessoa Física' | 'Empresa';
  category: string;
  description: string;
  socials?: string;
  observations?: string;
  status: 'Em análise' | 'Aprovado' | 'Rejeitado' | 'Suspenso';
  createdAt: string;
}

export interface StoreSettings {
  storeName: string;
  storeActive: boolean;
  defaultCommission: number;
  lowStockThreshold: number;
  allowSellers: boolean;
  requireApproval: boolean;
  freeShippingThreshold: number;
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: 'VOXA Store & Marketplace',
  storeActive: true,
  defaultCommission: 10,
  lowStockThreshold: 5,
  allowSellers: true,
  requireApproval: true,
  freeShippingThreshold: 299.00
};

export async function fetchSellerRequests(): Promise<SellerRequest[]> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const q = collection(db, 'seller_requests');
      const snapshot = await getDocs(q);
      const list: SellerRequest[] = [];
      snapshot.forEach(doc => {
        list.push({ ...doc.data(), id: doc.id } as SellerRequest);
      });
      localStorage.setItem('lockdown_seller_requests', JSON.stringify(list));
      return list;
    } catch (err) {
      handleFirestoreError('seller_requests', err);
    }
  }
  try {
    const saved = localStorage.getItem('lockdown_seller_requests');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [];
}

export async function saveSellerRequest(request: SellerRequest): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("O Firebase não está conectado.");
  }
  const docRef = doc(db, 'seller_requests', request.id);
  await setDoc(docRef, request);
  try {
    const list = await fetchSellerRequests();
    localStorage.setItem('lockdown_seller_requests', JSON.stringify(list));
  } catch (e) {}
}

export async function fetchStoreSettings(): Promise<StoreSettings> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const docRef = doc(db, 'store_settings', 'settings');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as StoreSettings;
        localStorage.setItem('lockdown_store_settings', JSON.stringify(data));
        return data;
      }
    } catch (err) {
      handleFirestoreError('store_settings', err);
    }
  }
  try {
    const saved = localStorage.getItem('lockdown_store_settings');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return DEFAULT_STORE_SETTINGS;
}

export async function saveStoreSettings(settings: StoreSettings): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("O Firebase não está conectado.");
  }
  const docRef = doc(db, 'store_settings', 'settings');
  await setDoc(docRef, settings);
  try {
    localStorage.setItem('lockdown_store_settings', JSON.stringify(settings));
  } catch (e) {}
}

export interface StoreOrder {
  id: string;
  userId: string;
  user: string;
  item: string;
  productId: string;
  quantity: number;
  amount: string; // e.g. "R$ 150,00"
  grossValue: number; // raw number
  commissionPercent: number; // e.g. 10
  commissionValue: number; // e.g. 15.00
  netValue: number; // e.g. 135.00
  sellerId: string; // e.g. "admin" or seller userId
  sellerName: string;
  status: 'Pendente' | 'Pago' | 'Recusado' | 'Cancelado' | 'Entregue';
  date: string;
  shippingAddress?: {
    name: string;
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    phone: string;
  };
  shippingValue?: number;
  productTotal?: number;
  deliveryStatus?: string;
}

export async function fetchStoreOrders(userEmail?: string): Promise<StoreOrder[]> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      let q;
      const isUserAdmin = userEmail === 'lockdownprodutora@gmail.com' || userEmail === 'admin@lockdownprodutora.com.br';
      
      if (userEmail && !isUserAdmin) {
        q = query(collection(db, 'store_orders'), where('userId', '==', userEmail));
      } else {
        q = collection(db, 'store_orders');
      }

      const snapshot = await getDocs(q);
      const list: StoreOrder[] = [];
      snapshot.forEach(doc => {
        list.push({ ...(doc.data() as any), id: doc.id } as StoreOrder);
      });
      localStorage.setItem('lockdown_payment_logs', JSON.stringify(list));
      return list;
    } catch (err) {
      handleFirestoreError('store_orders', err);
    }
  }
  try {
    const saved = localStorage.getItem('lockdown_payment_logs');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (userEmail) {
        const isUserAdmin = userEmail === 'lockdownprodutora@gmail.com' || userEmail === 'admin@lockdownprodutora.com.br';
        if (!isUserAdmin) {
          return parsed.filter((o: any) => o.userId === userEmail);
        }
      }
      return parsed;
    }
  } catch (e) {}
  return [];
}

export async function saveStoreOrder(order: StoreOrder): Promise<any> {
  try {
    const response = await fetch("/api/store/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        productId: order.productId,
        buyerEmail: order.userId || "unknown",
        buyerName: order.user || "Visitante",
        quantity: order.quantity || 1
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Erro ao registrar o pedido no servidor backend.");
    }

    console.log("[Backend saveStoreOrder Success]", data);

    try {
      const list = await fetchStoreOrders();
      localStorage.setItem('lockdown_payment_logs', JSON.stringify(list));
    } catch (e) {}

    return data;
  } catch (err: any) {
    console.error("Failed to secure saveStoreOrder via backend:", err);
    throw err;
  }
}

export async function buyTicket(showId: string, quantity: number, buyerEmail: string, buyerName: string, buyerUid?: string): Promise<any> {
  try {
    const response = await fetch("/api/tickets/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        showId,
        quantity,
        buyerEmail,
        buyerName,
        buyerUid
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Erro ao registrar a compra do ingresso no servidor backend.");
    }

    console.log("[Backend buyTicket Success]", data);

    try {
      const list = await fetchStoreOrders();
      localStorage.setItem('lockdown_payment_logs', JSON.stringify(list));
    } catch (e) {}

    return data;
  } catch (err: any) {
    console.error("Failed to secure buyTicket via backend:", err);
    throw err;
  }
}

export interface FirestoreUser {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | string;
  isAdmin?: boolean;
  status: 'Ativo' | 'Inativo' | string;
  createdAt: string;
  lastLogin: string;
  photoURL?: string;
  referredByUserId?: string;
  mustChangePassword?: boolean;
  defaultFollowsInitialized?: boolean;
  categoryId?: string;
  categoryName?: string;
}

export async function fetchFirestoreUsers(): Promise<FirestoreUser[]> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const q = collection(db, 'users');
      const snapshot = await getDocs(q);
      const list: FirestoreUser[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        list.push({ ...data, uid: doc.id } as FirestoreUser);
      });
      // Store in localStorage as local backup fallback
      localStorage.setItem('lockdown_registered_users_firestore_backup', JSON.stringify(list));
      return list;
    } catch (err) {
      handleFirestoreError('users', err);
    }
  }
  try {
    const saved = localStorage.getItem('lockdown_registered_users_firestore_backup');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [];
}

export async function syncUserSession(firebaseUser: any): Promise<FirestoreUser | null> {
  if (!firebaseUser) {
    localStorage.removeItem('voxa_current_user');
    return null;
  }
  try {
    const docRef = doc(db, 'users', firebaseUser.uid);
    let docSnap;
    try {
      docSnap = await getDoc(docRef);
    } catch (getDocErr: any) {
      const errMsg = getDocErr.message || String(getDocErr);
      const isQuota = errMsg.includes("Quota") || errMsg.includes("quota") || getDocErr.code === "resource-exhausted";
      if (isQuota) {
        const cached = localStorage.getItem('voxa_current_user');
        if (cached) {
          try {
            console.warn("[syncUserSession] Quota exceeded. Restoring active session from localStorage cache.");
            return JSON.parse(cached);
          } catch (e) {}
        }
      }
      throw getDocErr;
    }

    let userData: any;

    const email = firebaseUser.email || '';
    const isAdminEmail = email === 'admin@voxa.com.br' || email === 'admin@lockdownprodutora.com.br' || email === 'lockdownprodutora@gmail.com' || firebaseUser.uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || firebaseUser.uid === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1';

    let canonicalAdminRole = '';
    try {
      const adminSnap = await getDoc(doc(db, 'admin_users', firebaseUser.uid));
      if (adminSnap.exists()) {
        canonicalAdminRole = String(adminSnap.data()?.role || '').toUpperCase().trim();
      }
    } catch (e) {}

    if (docSnap.exists()) {
      const existingData = docSnap.data();
      const statusLower = (existingData.status || '').toLowerCase();
      const accountStatusLower = (existingData.accountStatus || '').toLowerCase();

      if (
        statusLower === 'suspenso' || 
        statusLower === 'inativo' || 
        statusLower === 'bloqueado' || 
        statusLower === 'blocked' ||
        accountStatusLower === 'bloqueado'
      ) {
        localStorage.removeItem('voxa_current_user');
        await signOut(auth);
        throw new Error('CONTA_BLOQUEADA');
      }

      let prevCache: any = null;
      try {
        const cached = localStorage.getItem('voxa_current_user');
        if (cached) prevCache = JSON.parse(cached);
      } catch (e) {}

      // Preserve all profile fields including photoURL, coverUrl, username, bio, etc.
      const rawUsername = existingData.username || existingData.slug || prevCache?.username || prevCache?.slug || (email ? email.split('@')[0] : 'user');
      const canonicalUsername = (firebaseUser.uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || rawUsername === 'juniorsantti' || rawUsername === 'juniorsantti92')
        ? 'jrsantti'
        : (firebaseUser.uid === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1' ? 'voxa' : rawUsername);

      const resolvedAdminRole = canonicalAdminRole || (isAdminEmail ? 'SUPER_ADMIN' : (existingData.adminRole ? String(existingData.adminRole).toUpperCase().trim() : (existingData.isAdmin === true ? 'ADMINISTRATOR' : 'NONE')));

      userData = {
        ...(prevCache || {}),
        ...existingData,
        uid: firebaseUser.uid,
        id: firebaseUser.uid,
        name: existingData.name || prevCache?.name || firebaseUser.displayName || 'Membro VOXA',
        email: existingData.email || prevCache?.email || email,
        username: canonicalUsername,
        slug: canonicalUsername,
        adminRole: resolvedAdminRole,
        role: existingData.role || prevCache?.role || (isAdminEmail || resolvedAdminRole === 'ADMINISTRATOR' || resolvedAdminRole === 'SUPER_ADMIN' ? 'admin' : 'Usuário Comum'),
        isAdmin: resolvedAdminRole === 'ADMINISTRATOR' || resolvedAdminRole === 'SUPER_ADMIN' || existingData.isAdmin === true || isAdminEmail,
        status: existingData.status || prevCache?.status || 'Ativo',
        createdAt: existingData.createdAt || prevCache?.createdAt || new Date().toLocaleDateString('pt-BR'),
        lastLogin: new Date().toLocaleDateString('pt-BR'),
        photoURL: (existingData.photoURL || existingData.avatarUrl || prevCache?.photoURL || prevCache?.avatarUrl || firebaseUser.photoURL || '').trim(),
        avatarUrl: (existingData.photoURL || existingData.avatarUrl || prevCache?.photoURL || prevCache?.avatarUrl || firebaseUser.photoURL || '').trim(),
        coverUrl: (existingData.coverUrl || existingData.coverURL || prevCache?.coverUrl || prevCache?.coverURL || '').trim(),
        coverURL: (existingData.coverUrl || existingData.coverURL || prevCache?.coverUrl || prevCache?.coverURL || '').trim(),
        bio: existingData.bio !== undefined ? existingData.bio : (prevCache?.bio || ''),
        categoryId: existingData.categoryId || prevCache?.categoryId || '',
        categoryName: existingData.categoryName || prevCache?.categoryName || '',
        isVerified: existingData.isVerified !== undefined ? Boolean(existingData.isVerified) : Boolean(existingData.verified || prevCache?.isVerified || prevCache?.verified || true),
        verified: existingData.verified !== undefined ? Boolean(existingData.verified) : Boolean(existingData.isVerified || prevCache?.isVerified || prevCache?.verified || true),
        isPremium: Boolean(existingData.isPremium || existingData.premium || prevCache?.isPremium || prevCache?.premium),
        mustChangePassword: existingData.mustChangePassword === true,
        profileComplete: existingData.profileComplete !== undefined ? existingData.profileComplete : true
      };
      try {
        if (!isFirestoreWriteQuotaExhausted()) {
          const sessionPatch: any = {};
          if (existingData.lastLogin !== userData.lastLogin) {
            sessionPatch.lastLogin = userData.lastLogin;
          }
          if (existingData.username !== canonicalUsername || existingData.slug !== canonicalUsername) {
            sessionPatch.username = canonicalUsername;
            sessionPatch.slug = canonicalUsername;
          }
          if (Object.keys(sessionPatch).length > 0) {
            await setDoc(docRef, sessionPatch, { merge: true });
          }
        }
      } catch (setDocErr: any) {
        console.warn("[syncUserSession] Silently ignored lastLogin setDoc error (quota or write restriction):", setDocErr.message);
      }
    } else {
      // Auto-create profile on clean/new database (Fail-Open/Auto-Onboard for new users)
      const defaultUsername = (email.split('@')[0] || `user_${Date.now()}`).toLowerCase().replace(/[^a-z0-9_]/g, '');

      userData = {
        uid: firebaseUser.uid,
        id: firebaseUser.uid,
        name: firebaseUser.displayName || 'Novo Membro VOXA',
        email: email,
        username: defaultUsername,
        slug: defaultUsername,
        role: isAdminEmail ? 'admin' : 'Usuário Comum',
        isAdmin: isAdminEmail,
        status: 'Ativo',
        createdAt: new Date().toLocaleDateString('pt-BR'),
        lastLogin: new Date().toLocaleDateString('pt-BR'),
        photoURL: (firebaseUser.photoURL || '').trim(),
        avatarUrl: (firebaseUser.photoURL || '').trim(),
        coverUrl: '',
        coverURL: '',
        mustChangePassword: false,
        profileComplete: false
      };

      try {
        await setDoc(docRef, {
          uid: userData.uid,
          name: userData.name,
          email: userData.email,
          username: defaultUsername,
          role: userData.role,
          isAdmin: userData.isAdmin,
          status: userData.status,
          createdAt: userData.createdAt,
          lastLogin: userData.lastLogin,
          photoURL: userData.photoURL,
          mustChangePassword: false,
          profileComplete: false,
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          followersList: [],
          followingList: [],
          balance: 0
        });
      } catch (createErr) {
        console.warn("[syncUserSession] Auto-registration failed inside fallback:", createErr);
      }
    }

    localStorage.setItem('voxa_current_user', JSON.stringify(userData));

    return userData;
  } catch (err: any) {
    if (err?.message === 'CONTA_BLOQUEADA' || err?.message === 'CADASTRO_NAO_ENCONTRADO') {
      throw err;
    }
    const errMsg = err?.message || String(err);
    const isQuota = errMsg.includes("Quota") || errMsg.includes("quota") || err?.code === "resource-exhausted";
    if (isQuota) {
      const cached = localStorage.getItem('voxa_current_user');
      if (cached) {
        try {
          console.warn("[syncUserSession] Quota exceeded in main catch. Restoring active session from localStorage cache.");
          return JSON.parse(cached);
        } catch (e) {}
      }
    }
    handleFirestoreError('user_session', err);
    throw err;
  }
}

// ==========================================
// NEW FEATURES FOR USER DASHBOARD & ADMIN
// ==========================================

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  periodicity?: 'Mensal' | 'Anual'; // keep for backward-compat
  billingPeriod: 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual' | 'Único';
  benefits: string;
  imageUrl?: string;
  image?: string; // alias
  status: 'Pendente' | 'Aprovado' | 'Rejeitado' | 'Ajustes solicitados';
  published: boolean;
  active: boolean;
  ownerType: 'lockdown' | 'user';
  ownerId: string;
  ownerName: string;
  ownerEmail?: string;
  sellerId: string; // duplicate for compat
  sellerName: string; // duplicate for compat
  category: string;
  commissionPercent?: number;
  maxSubscribers?: number;
  startDate?: string;
  endDate?: string;
  internalNotes?: string;
  sellerUrl?: string;
  sellerNotes?: string;
  termsAccepted?: boolean;
  rejectionReason?: string;
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface SupportTicket {
  id: string;
  userId: string; // user email
  userName: string;
  subject: string;
  category: 'Pagamento' | 'Store' | 'Tickets' | 'Assinaturas' | 'Music' | 'Conta' | 'Problema técnico' | 'Outro';
  message: string;
  status: 'Aberto' | 'Em atendimento' | 'Aguardando usuário' | 'Resolvido' | 'Fechado';
  createdAt: string;
  messages: {
    sender: 'user' | 'admin';
    message: string;
    timestamp: string;
  }[];
}

export interface CommissionSettings {
  storeCommissionPercent: number;
  ticketCommissionPercent: number;
  subscriptionCommissionPercent: number;
  serviceCommissionPercent: number;
  otherCommissionPercent: number;
  isConfigured: boolean;
}

export interface Notification {
  id: string;
  userId: string; // user email
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const q = collection(db, 'subscription_plans');
      const snapshot = await getDocs(q);
      const list: SubscriptionPlan[] = [];
      snapshot.forEach(doc => {
        list.push({ ...doc.data(), id: doc.id } as SubscriptionPlan);
      });
      localStorage.setItem('lockdown_subscription_plans', JSON.stringify(list));
      return list;
    } catch (err) {
      handleFirestoreError('subscription_plans', err);
    }
  }
  try {
    const saved = localStorage.getItem('lockdown_subscription_plans');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [];
}

export async function saveSubscriptionPlan(plan: SubscriptionPlan): Promise<void> {
  enforceRole(['ADMINISTRATOR']);
  if (!isFirebaseConfigured()) {
    throw new Error("O Firebase não está conectado.");
  }
  const docRef = doc(db, 'subscription_plans', plan.id);
  
  // Clean undefined properties from the object to prevent Firestore errors
  const cleanedPlan: any = {};
  Object.keys(plan).forEach(key => {
    const val = (plan as any)[key];
    if (val !== undefined) {
      cleanedPlan[key] = val;
    }
  });

  await setDoc(docRef, cleanedPlan);
}

export async function deleteSubscriptionPlan(id: string): Promise<void> {
  enforceRole(['ADMINISTRATOR']);
  if (!isFirebaseConfigured()) {
    throw new Error("O Firebase não está conectado.");
  }
  const docRef = doc(db, 'subscription_plans', id);
  await deleteDoc(docRef);
}

export async function fetchSupportTickets(userEmail?: string): Promise<SupportTicket[]> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const colRef = collection(db, 'support_tickets');
      const q = userEmail ? query(colRef, where('userId', '==', userEmail)) : colRef;
      const snapshot = await getDocs(q);
      const list: SupportTicket[] = [];
      snapshot.forEach(doc => {
        list.push({ ...doc.data(), id: doc.id } as SupportTicket);
      });
      if (!userEmail) {
        localStorage.setItem('lockdown_support_tickets', JSON.stringify(list));
      }
      return list;
    } catch (err) {
      handleFirestoreError('support_tickets', err);
    }
  }
  try {
    const saved = localStorage.getItem('lockdown_support_tickets');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        if (userEmail) {
          return parsed.filter(t => t.userId === userEmail);
        }
        return parsed;
      }
    }
  } catch (e) {}
  return [];
}

export async function saveSupportTicket(ticket: SupportTicket): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("O Firebase não está conectado.");
  }
  const docRef = doc(db, 'support_tickets', ticket.id);
  const cleanedTicket = cleanUndefined(ticket);
  await setDoc(docRef, cleanedTicket);
}

export const DEFAULT_COMMISSION_SETTINGS: CommissionSettings = {
  storeCommissionPercent: 0,
  ticketCommissionPercent: 0,
  subscriptionCommissionPercent: 0,
  serviceCommissionPercent: 0,
  otherCommissionPercent: 0,
  isConfigured: false,
};

export async function fetchCommissionSettings(): Promise<CommissionSettings> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const docRef = doc(db, 'commission_settings', 'global');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as CommissionSettings;
        localStorage.setItem('lockdown_commission_settings', JSON.stringify(data));
        return { ...data, isConfigured: true };
      }
    } catch (err) {
      handleFirestoreError('commission_settings', err);
    }
  }
  try {
    const saved = localStorage.getItem('lockdown_commission_settings');
    if (saved) return { ...JSON.parse(saved), isConfigured: true };
  } catch (e) {}
  return DEFAULT_COMMISSION_SETTINGS;
}

export async function saveCommissionSettings(settings: CommissionSettings): Promise<void> {
  enforceRole(['ADMINISTRATOR']);
  if (!isFirebaseConfigured()) {
    throw new Error("O Firebase não está conectado.");
  }
  const docRef = doc(db, 'commission_settings', 'global');
  await setDoc(docRef, { ...settings, isConfigured: true });
}

export async function fetchNotifications(userEmail: string): Promise<Notification[]> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const q = query(collection(db, 'notifications'), where('userId', '==', userEmail));
      const snapshot = await getDocs(q);
      const list: Notification[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as Notification;
        list.push({ ...data, id: doc.id });
      });
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (err) {
      handleFirestoreError('notifications', err);
    }
  }
  return [];
}

export async function createNotification(userId: string, title: string, message: string, recipientUid?: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  try {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const docRef = doc(db, 'notifications', id);
    await setDoc(docRef, {
      id,
      userId,
      recipientUid: recipientUid || userId,
      title,
      message,
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn("Could not create notification in Firestore:", e);
  }
}

export async function markNotificationAsRead(id: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  try {
    const docRef = doc(db, 'notifications', id);
    await setDoc(docRef, { read: true, readAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.warn("Error marking notification as read:", e);
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  try {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
    const snap = await getDocs(q);
    const batchPromises = snap.docs.map(doc => 
      setDoc(doc.ref, { read: true, readAt: new Date().toISOString() }, { merge: true })
    );
    await Promise.all(batchPromises);
  } catch (e) {
    console.warn("Error marking all notifications as read:", e);
  }
}

export async function fetchWalletBalance(userId: string): Promise<{ success: boolean, balance: number, transactions: any[] }> {
  try {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return { success: true, balance: 0, transactions: [] };
    }

    const cleanId = userId.trim();

    // Prioritize direct client-side Firestore read (under the auth rules: userId == request.auth.uid)
    try {
      const walletRef = doc(db, "wallets", cleanId);
      const walletSnap = await getDoc(walletRef);
      const balance = walletSnap.exists() ? (walletSnap.data()?.balance || 0) : 0;

      const txsRef = collection(db, "wallet_transactions");
      const txsQuery = query(txsRef, where("userId", "==", cleanId));
      const txsSnap = await getDocs(txsQuery);
      
      const transactions: any[] = [];
      txsSnap.forEach(d => {
        transactions.push({ id: d.id, ...d.data() });
      });

      transactions.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      return {
        success: true,
        balance,
        transactions
      };
    } catch (fsErr: any) {
      try {
        const response = await fetch(`/api/wallet/balance?userId=${encodeURIComponent(cleanId)}`);
        if (!response.ok) {
          return { success: true, balance: 0, transactions: [] };
        }
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          return { success: true, balance: 0, transactions: [] };
        }
        const data = await response.json();
        return {
          success: true,
          balance: Number(data.balance || 0),
          transactions: Array.isArray(data.transactions) ? data.transactions : []
        };
      } catch {
        return {
          success: true,
          balance: 0,
          transactions: []
        };
      }
    }
  } catch {
    return {
      success: true,
      balance: 0,
      transactions: []
    };
  }
}

export async function depositWalletPIX(payload: { userId: string, amount: number, buyerName: string, payerEmail: string }): Promise<any> {
  try {
    const response = await fetch("/api/wallet/deposit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Erro ao solicitar depósito via PIX.");
    }
    return data;
  } catch (err: any) {
    console.error("Failed to secure wallet deposit:", err);
    throw err;
  }
}

export async function payWithWalletBalance(payload: {
  userId: string;
  amount: number;
  buyerName: string;
  buyerEmail: string;
  orderType: 'ticket' | 'store' | 'subscription';
  productId: string;
  itemDescription: string;
  metadata?: any;
}): Promise<any> {
  try {
    const response = await fetch("/api/wallet/pay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Erro ao processar pagamento com saldo.");
    }
    return data;
  } catch (err: any) {
    console.error("Failed to process wallet balance payment:", err);
    throw err;
  }
}

// ==========================================
// VOXA SOCIAL MEDIA PLATFORM DB HELPER ACTIONS
// ==========================================

export async function fetchVoxaPosts(): Promise<any[]> {
  if (!isFirebaseConfigured() || isFirestoreQuotaThrottled()) {
    try {
      const saved = localStorage.getItem('voxa_posts');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  }
  try {
    const q = collection(db, 'posts');
    const snap = await getDocs(q);
    const list: any[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() });
    });
    // Sort descending by timestamp/date
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    localStorage.setItem('voxa_posts', JSON.stringify(list));
    return list;
  } catch (err) {
    console.warn("Error fetching VOXA posts:", err);
    return [];
  }
}

export async function createVoxaPost(payload: {
  userId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  content: string;
  mediaUrl?: string;
  productId?: string | null;
  eventId?: string | null;
  subscriptionPlanId?: string | null;
  musicId?: string | null;
  serviceId?: string | null;
  articleId?: string | null;
  digitalProductId?: string | null;
}): Promise<any> {
  const cleanPayload = cleanUndefined(payload);
  const postId = `post-${Date.now()}`;
  const newPost = {
    ...cleanPayload,
    id: postId,
    createdAt: new Date().toISOString(),
    likesCount: 0,
    likesList: [],
    commentsCount: 0
  };

  if (isFirebaseConfigured()) {
    try {
      await setDoc(doc(db, 'posts', postId), newPost);
      // Increment user postsCount
      const userRef = doc(db, 'users', payload.userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentCount = userSnap.data().postsCount || 0;
        await setDoc(userRef, { postsCount: currentCount + 1 }, { merge: true });
      }
    } catch (err) {
      console.warn("Error creating firestore post:", err);
    }
  }

  // Update local cache
  try {
    const saved = localStorage.getItem('voxa_posts');
    const existing = saved ? JSON.parse(saved) : [];
    existing.unshift(newPost);
    localStorage.setItem('voxa_posts', JSON.stringify(existing));
  } catch (e) {}

  return newPost;
}

export async function likeVoxaPost(postId: string, userUid: string): Promise<any> {
  if (!isFirebaseConfigured()) return;
  try {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
      const data = postSnap.data();
      const likesList: string[] = data.likesList || [];
      const index = likesList.indexOf(userUid);
      
      let updatedLikes: string[];
      let liked = false;
      if (index >= 0) {
        updatedLikes = likesList.filter(id => id !== userUid);
      } else {
        updatedLikes = [...likesList, userUid];
        liked = true;
      }

      const updatedData = {
        likesList: updatedLikes,
        likesCount: updatedLikes.length
      };

      await setDoc(postRef, updatedData, { merge: true });

      // Update totalLikesReceived for the post author
      if (data.userId) {
        try {
          const authorRef = doc(db, 'users', data.userId);
          const authorSnap = await getDoc(authorRef);
          if (authorSnap.exists()) {
            const authorData = authorSnap.data();
            const currentLikes = authorData.totalLikesReceived || 0;
            let newLikes = liked ? currentLikes + 1 : currentLikes - 1;
            if (newLikes < 0) newLikes = 0;
            await setDoc(authorRef, { totalLikesReceived: newLikes }, { merge: true });
          }
        } catch (likesErr) {
          console.warn("Could not update totalLikesReceived for post author:", likesErr);
        }
      }

      // Create social interaction notification
      if (liked && data.userId && data.userId !== userUid) {
        try {
          const likerRef = doc(db, 'users', userUid);
          const likerSnap = await getDoc(likerRef);
          const likerName = likerSnap.exists() ? (likerSnap.data().name || "Alguém") : "Alguém";
          await createNotification(
            data.userId,
            "Nova curtida no seu post! ❤️",
            `"${likerName}" curtiu a sua publicação: "${data.content ? data.content.substring(0, 40) : ''}..."`
          );
        } catch (notifErr) {
          console.warn("Could not create post like notification:", notifErr);
        }
      }

      return updatedData;
    }
  } catch (err) {
    console.warn("Error liking VOXA post:", err);
  }
}

export async function followVoxaUser(
  currentUid: string, 
  targetUid: string, 
  options?: { silent?: boolean; source?: 'organic' | 'default_follow' }
): Promise<void> {
  if (!isFirebaseConfigured() || currentUid === targetUid) return;
  const followDocId = `${currentUid}_${targetUid}`;
  const followRef = doc(db, 'follows', followDocId);
  const myRef = doc(db, 'users', currentUid);
  const targetRef = doc(db, 'users', targetUid);

  try {
    await runTransaction(db, async (transaction) => {
      const followSnap = await transaction.get(followRef);
      if (followSnap.exists()) {
        return; // relationship already exists, idempotent exit
      }
      
      const mySnap = await transaction.get(myRef);
      const targetSnap = await transaction.get(targetRef);
      
      const myData = mySnap.exists() ? mySnap.data() : { followingCount: 0 };
      const targetData = targetSnap.exists() ? targetSnap.data() : { followersCount: 0 };

      const newFollowingCount = (myData.followingCount || 0) + 1;
      const newFollowersCount = (targetData.followersCount || 0) + 1;

      // 1. Create the follow relation
      transaction.set(followRef, {
        followerId: currentUid,
        followingId: targetUid,
        followerUid: currentUid,
        followingUid: targetUid,
        source: options?.source || 'organic',
        createdAt: new Date().toISOString()
      });

      // 2. Increment followingCount for A
      if (mySnap.exists()) {
        transaction.update(myRef, {
          followingCount: newFollowingCount
        });
      } else {
        transaction.set(myRef, {
          uid: currentUid,
          id: currentUid,
          followingCount: newFollowingCount
        }, { merge: true });
      }

      // 3. Increment followersCount for B
      if (targetSnap.exists()) {
        transaction.update(targetRef, {
          followersCount: newFollowersCount
        });
      } else {
        transaction.set(targetRef, {
          uid: targetUid,
          id: targetUid,
          followersCount: newFollowersCount
        }, { merge: true });
      }
    });

    // Log follow activity
    let targetUsername = 'membro';
    try {
      const targetSnap = await getDoc(targetRef);
      if (targetSnap.exists()) {
        targetUsername = targetSnap.data().username || targetSnap.data().slug || 'membro';
      }
    } catch (e) {}

    try {
      const { logActivity } = await import('./activities');
      await logActivity(currentUid, 'follow', `começou a seguir @${targetUsername}`, { targetUid });
    } catch (err) {}

    // Create follow social notification (unless silent is true)
    if (!options?.silent) {
      try {
        const followerSnap = await getDoc(myRef);
        const followerName = followerSnap.exists() ? (followerSnap.data().name || "Um usuário") : "Um usuário";
        await createNotification(
          targetUid,
          "Novo seguidor! 👤",
          `"${followerName}" começou a seguir você no VOXA.`,
          targetUid
        );
      } catch (notifErr) {
        console.warn("Could not create follow notification:", notifErr);
      }
    }
  } catch (err) {
    console.error("Error in transaction followVoxaUser:", err);
    throw err;
  }
}

export async function unfollowVoxaUser(currentUid: string, targetUid: string): Promise<void> {
  if (!isFirebaseConfigured() || currentUid === targetUid) return;
  const followDocId = `${currentUid}_${targetUid}`;
  const followRef = doc(db, 'follows', followDocId);
  const myRef = doc(db, 'users', currentUid);
  const targetRef = doc(db, 'users', targetUid);

  try {
    await runTransaction(db, async (transaction) => {
      const followSnap = await transaction.get(followRef);
      if (!followSnap.exists()) {
        return; // relationship does not exist, safe exit
      }
      
      const mySnap = await transaction.get(myRef);
      const targetSnap = await transaction.get(targetRef);

      const myData = mySnap.exists() ? mySnap.data() : { followingCount: 1 };
      const targetData = targetSnap.exists() ? targetSnap.data() : { followersCount: 1 };

      const newFollowingCount = Math.max(0, (myData.followingCount || 0) - 1);
      const newFollowersCount = Math.max(0, (targetData.followersCount || 0) - 1);

      // 1. Delete follow document
      transaction.delete(followRef);

      // 2. Update follower counting
      if (mySnap.exists()) {
        transaction.update(myRef, { followingCount: newFollowingCount });
      }
      // 3. Update following counting
      if (targetSnap.exists()) {
        transaction.update(targetRef, { followersCount: newFollowersCount });
      }
    });
  } catch (err) {
    console.error("Error in transaction unfollowVoxaUser:", err);
    throw err;
  }
}

export async function recalculateFollowCounters(userUid: string): Promise<{ followers: number, following: number }> {
  if (!isFirebaseConfigured()) return { followers: 0, following: 0 };
  try {
    // 1. Count follows where followingId matches this user
    const followersQuery = query(collection(db, 'follows'), where('followingId', '==', userUid));
    const followersSnap = await getDocs(followersQuery);
    const followersCount = followersSnap.size;

    // 2. Count follows where followerId matches this user
    const followingQuery = query(collection(db, 'follows'), where('followerId', '==', userUid));
    const followingSnap = await getDocs(followingQuery);
    const followingCount = followingSnap.size;

    // 3. Update target document in Firestore with canonical counters
    const userRef = doc(db, 'users', userUid);
    await setDoc(userRef, {
      followersCount,
      followingCount
    }, { merge: true });

    return { followers: followersCount, following: followingCount };
  } catch (err) {
    console.error("Error recalculating follow counters for", userUid, err);
    throw err;
  }
}

// ==========================================
// VOX (Sua voz dentro da VOXA) ACTIONS
// ==========================================

export async function fetchVoxes(): Promise<any[]> {
  if (!isFirebaseConfigured() || isFirestoreQuotaThrottled()) {
    try {
      const saved = localStorage.getItem('voxa_voxes');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  }
  try {
    const q = collection(db, 'voxes');
    const snap = await getDocs(q);
    const list: any[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() });
    });
    // Sort descending by createdAt
    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    localStorage.setItem('voxa_voxes', JSON.stringify(list));
    return list;
  } catch (err) {
    console.warn("Error fetching VOXes:", err);
    return [];
  }
}

export async function createVox(payload: {
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  authorVerified?: boolean;
  text: string;
  media?: string[];
  replyTo?: string | null;
  quotedVoxId?: string | null;
  visibility?: 'public' | 'followers' | 'private';
  isRepost?: boolean;
  repostOf?: string | null;
}): Promise<any> {
  const voxId = `vox-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const cleanPayload = cleanUndefined(payload);
  const newVox = {
    ...cleanPayload,
    id: voxId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    editedAt: null,
    replyTo: payload.replyTo || null,
    quotedVoxId: payload.quotedVoxId || null,
    visibility: payload.visibility || 'public',
    likeCount: 0,
    likesList: [],
    replyCount: 0,
    repostCount: 0,
    repostsList: [],
    isRepost: payload.isRepost || false,
    repostOf: payload.repostOf || null
  };

  if (isFirebaseConfigured()) {
    try {
      await setDoc(doc(db, 'voxes', voxId), newVox);

      // Log recent activity (silently caught to not disrupt flow)
      try {
        const { logActivity } = await import('./activities');
        await logActivity(
          payload.authorId,
          'vox_created',
          payload.replyTo ? 'respondeu a um VOX' : (payload.quotedVoxId ? 'citou um VOX' : 'escreveu um novo VOX na plataforma'),
          { voxId, text: payload.text }
        );
      } catch (actErr) {
        console.warn("Activity logging failed for VOX creation:", actErr);
      }

      // If it is a reply, increment replyCount on the parent VOX
      if (payload.replyTo) {
        const parentRef = doc(db, 'voxes', payload.replyTo);
        const parentSnap = await getDoc(parentRef);
        if (parentSnap.exists()) {
          const parentData = parentSnap.data();
          const newReplyCount = (parentData.replyCount || 0) + 1;
          await setDoc(parentRef, { replyCount: newReplyCount }, { merge: true });

          // Trigger reply notification to parent author if it is not self
          if (parentData.authorId && parentData.authorId !== payload.authorId) {
            await createNotification(
              parentData.authorId,
              "Nova resposta no seu VOX! 💬",
              `"${payload.authorName}" respondeu ao seu VOX: "${payload.text.substring(0, 40)}..."`,
              parentData.authorId
            );
          }
        }
      }

      // If it is a quote, increment repostCount on the original VOX and notify
      if (payload.quotedVoxId) {
        const quotedRef = doc(db, 'voxes', payload.quotedVoxId);
        const quotedSnap = await getDoc(quotedRef);
        if (quotedSnap.exists()) {
          const quotedData = quotedSnap.data();
          const newRepostCount = (quotedData.repostCount || 0) + 1;
          const updatedRepostsList = [...(quotedData.repostsList || [])];
          if (!updatedRepostsList.includes(payload.authorId)) {
            updatedRepostsList.push(payload.authorId);
          }
          await setDoc(quotedRef, { repostCount: newRepostCount, repostsList: updatedRepostsList }, { merge: true });

          // Trigger quote notification to quoted author if it is not self
          if (quotedData.authorId && quotedData.authorId !== payload.authorId) {
            await createNotification(
              quotedData.authorId,
              "Seu VOX foi citado! 🔁",
              `"${payload.authorName}" citou o seu VOX: "${payload.text.substring(0, 40)}..."`,
              quotedData.authorId
            );
          }
        }
      }
    } catch (err) {
      console.warn("Error creating firestore VOX:", err);
    }
  }

  // Update local cache
  try {
    const saved = localStorage.getItem('voxa_voxes');
    const existing = saved ? JSON.parse(saved) : [];
    existing.unshift(newVox);
    localStorage.setItem('voxa_voxes', JSON.stringify(existing));
  } catch (e) {}

  return newVox;
}

export async function likeVox(voxId: string, userUid: string): Promise<any> {
  if (!isFirebaseConfigured()) return null;
  try {
    const voxRef = doc(db, 'voxes', voxId);
    let updatedData = null;

    await runTransaction(db, async (transaction) => {
      // 1. ALL READS FIRST
      const voxSnap = await transaction.get(voxRef);
      if (!voxSnap.exists()) throw new Error("VOX não encontrado");
      const data = voxSnap.data();
      const likesList = data.likesList || [];
      const index = likesList.indexOf(userUid);

      let updatedLikes: string[];
      let liked = false;
      if (index >= 0) {
        updatedLikes = likesList.filter((id: string) => id !== userUid);
      } else {
        updatedLikes = [...likesList, userUid];
        liked = true;
      }

      const authorRef = data.authorId ? doc(db, 'users', data.authorId) : null;
      const authorSnap = authorRef ? await transaction.get(authorRef) : null;

      const likerRef = (liked && data.authorId && data.authorId !== userUid) ? doc(db, 'users', userUid) : null;
      const likerSnap = likerRef ? await transaction.get(likerRef) : null;

      // 2. ALL WRITES AFTER
      updatedData = {
        likesList: updatedLikes,
        likeCount: updatedLikes.length
      };

      transaction.update(voxRef, updatedData);

      if (authorRef && authorSnap && authorSnap.exists()) {
        const authorData = authorSnap.data();
        const currentLikes = authorData.totalLikesReceived || 0;
        let newLikes = liked ? currentLikes + 1 : currentLikes - 1;
        if (newLikes < 0) newLikes = 0;
        transaction.update(authorRef, { totalLikesReceived: newLikes });
      }

      // Log activity
      if (liked) {
        try {
          const { logActivity } = await import('./activities');
          await logActivity(userUid, 'like', `curtiu o VOX de @${data.authorUsername || 'membro'}`, { voxId });
        } catch (err) {}
      }

      if (liked && data.authorId && data.authorId !== userUid) {
        const likerName = likerSnap && likerSnap.exists() ? (likerSnap.data().name || "Alguém") : "Alguém";
        const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const notifRef = doc(db, 'notifications', id);
        transaction.set(notifRef, {
          id,
          userId: data.authorId,
          recipientUid: data.authorId,
          title: "Nova curtida no seu VOX! ❤️",
          message: `"${likerName}" curtiu o seu VOX: "${data.text ? data.text.substring(0, 40) : ''}..."`,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    });

    return updatedData;
  } catch (err) {
    console.error("Error liking VOX:", err);
    throw err;
  }
}

export async function repostVox(voxId: string, userUid: string, currentUserProfile: any): Promise<any> {
  if (!isFirebaseConfigured()) return null;
  try {
    const voxRef = doc(db, 'voxes', voxId);
    let updatedData = null;

    await runTransaction(db, async (transaction) => {
      const voxSnap = await transaction.get(voxRef);
      if (!voxSnap.exists()) throw new Error("VOX não encontrado");
      const data = voxSnap.data();
      const repostsList = data.repostsList || [];
      const index = repostsList.indexOf(userUid);

      let updatedReposts: string[];
      let reposted = false;
      if (index >= 0) {
        // Already reposted, undoing repost
        updatedReposts = repostsList.filter((id: string) => id !== userUid);
      } else {
        updatedReposts = [...repostsList, userUid];
        reposted = true;
      }

      updatedData = {
        repostsList: updatedReposts,
        repostCount: updatedReposts.length
      };

      transaction.update(voxRef, updatedData);

      if (reposted) {
        // Create Repost Container VOX
        const newVoxId = `vox-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const newVoxRef = doc(db, 'voxes', newVoxId);
        transaction.set(newVoxRef, {
          id: newVoxId,
          authorId: userUid,
          authorName: currentUserProfile.name || "Membro",
          authorUsername: currentUserProfile.username || "membro",
          authorAvatar: currentUserProfile.photoURL || currentUserProfile.avatarUrl || "",
          authorVerified: currentUserProfile.verified || false,
          text: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          visibility: data.visibility || 'public',
          likeCount: 0,
          likesList: [],
          replyCount: 0,
          repostCount: 0,
          repostsList: [],
          isRepost: true,
          repostOf: voxId
        });

        // Create notification
        if (data.authorId && data.authorId !== userUid) {
          const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          const notifRef = doc(db, 'notifications', id);
          transaction.set(notifRef, {
            id,
            userId: data.authorId,
            recipientUid: data.authorId,
            title: "Seu VOX foi repostado! 🔁",
            message: `"${currentUserProfile.name}" repostou o seu VOX: "${data.text ? data.text.substring(0, 40) : ''}..."`,
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      }
    });

    return updatedData;
  } catch (err) {
    console.error("Error reposting VOX:", err);
    throw err;
  }
}

export async function deleteVox(voxId: string, userUid: string, isAdminUser: boolean): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const voxRef = doc(db, 'voxes', voxId);
    const voxSnap = await getDoc(voxRef);
    if (!voxSnap.exists()) return false;
    const data = voxSnap.data();

    if (data.authorId !== userUid && !isAdminUser) {
      throw new Error("Não autorizado para excluir este VOX");
    }

    await deleteDoc(voxRef);

    // If it was a reply, decrement replyCount on parent
    if (data.replyTo) {
      const parentRef = doc(db, 'voxes', data.replyTo);
      const parentSnap = await getDoc(parentRef);
      if (parentSnap.exists()) {
        const parentData = parentSnap.data();
        const newReplyCount = Math.max(0, (parentData.replyCount || 1) - 1);
        await setDoc(parentRef, { replyCount: newReplyCount }, { merge: true });
      }
    }

    // Delete associated reposts that refer to this vox
    const qReposts = query(collection(db, 'voxes'), where('repostOf', '==', voxId));
    const repostsSnap = await getDocs(qReposts);
    repostsSnap.forEach(async (d) => {
      await deleteDoc(doc(db, 'voxes', d.id));
    });

    return true;
  } catch (err) {
    console.error("Error deleting VOX:", err);
    throw err;
  }
}

export async function editVox(voxId: string, text: string, userUid: string): Promise<any> {
  if (!isFirebaseConfigured()) return null;
  try {
    const voxRef = doc(db, 'voxes', voxId);
    const voxSnap = await getDoc(voxRef);
    if (!voxSnap.exists()) throw new Error("VOX não encontrado");
    const data = voxSnap.data();
    if (data.authorId !== userUid) throw new Error("Apenas o autor pode editar");

    const update = {
      text,
      updatedAt: new Date().toISOString(),
      editedAt: new Date().toISOString()
    };

    await setDoc(voxRef, update, { merge: true });
    return { ...data, ...update };
  } catch (err) {
    console.error("Error editing VOX:", err);
    throw err;
  }
}

export async function reportVox(payload: {
  voxId: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  details?: string;
}): Promise<any> {
  if (!isFirebaseConfigured()) return null;
  try {
    const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const reportRef = doc(db, 'vox_reports', reportId);
    const voxRef = doc(db, 'voxes', payload.voxId);
    const voxSnap = await getDoc(voxRef);
    const voxData = voxSnap.exists() ? voxSnap.data() : null;

    const newReport = {
      id: reportId,
      voxId: payload.voxId,
      reporterId: payload.reporterId,
      reporterName: payload.reporterName,
      reason: payload.reason,
      details: payload.details || "",
      voxAuthorId: voxData?.authorId || "",
      voxText: voxData?.text || "",
      status: 'Pendente',
      createdAt: new Date().toISOString()
    };

    await setDoc(reportRef, newReport);
    return newReport;
  } catch (err) {
    console.error("Error reporting VOX:", err);
    throw err;
  }
}

export async function fetchVoxReplies(voxId: string): Promise<any[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const q = query(collection(db, 'voxes'), where('replyTo', '==', voxId));
    const snap = await getDocs(q);
    const list: any[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() });
    });
    list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    return list;
  } catch (err) {
    console.warn("Error fetching VOX replies:", err);
    return [];
  }
}

export async function fetchUserVoxes(userUid: string): Promise<any[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const q = query(collection(db, 'voxes'), where('authorId', '==', userUid));
    const snap = await getDocs(q);
    const list: any[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() });
    });
    list.sort((a, b) => (b.createdAt || '').localeCompare(b.createdAt || ''));
    return list;
  } catch (err) {
    console.warn("Error fetching user VOXes:", err);
    return [];
  }
}

export async function fetchTrendingVoxes(): Promise<any[]> {
  const list = await fetchVoxes();
  return [...list].sort((a, b) => {
    const scoreA = (a.likeCount || 0) * 2 + (a.repostCount || 0) * 3 + (a.replyCount || 0) * 1.5;
    const scoreB = (b.likeCount || 0) * 2 + (b.repostCount || 0) * 3 + (b.replyCount || 0) * 1.5;
    return scoreB - scoreA;
  });
}

export async function fetchVoxById(voxId: string): Promise<any> {
  if (!isFirebaseConfigured()) return null;
  try {
    const docSnap = await getDoc(doc(db, 'voxes', voxId));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (err) {
    console.warn("Error fetching VOX by ID:", err);
    return null;
  }
}

export const DEFAULT_PUBLIC_CATEGORIES: PublicCategoryItem[] = [
  { id: 'cat-1', name: 'Artista', slug: 'artista', active: true, order: 1 },
  { id: 'cat-2', name: 'Empresa', slug: 'empresa', active: true, order: 2 },
  { id: 'cat-3', name: 'Influencer', slug: 'influencer', active: true, order: 3 },
  { id: 'cat-4', name: 'Criador de Conteúdo', slug: 'criador-de-conteudo', active: true, order: 4 },
  { id: 'cat-5', name: 'Produtora', slug: 'produtora', active: true, order: 5 },
  { id: 'cat-6', name: 'Emissora de TV', slug: 'emissora-de-tv', active: true, order: 6 },
  { id: 'cat-7', name: 'Agência de Viagens', slug: 'agencia-de-viagens', active: true, order: 7 },
  { id: 'cat-8', name: 'Banco', slug: 'banco', active: true, order: 8 },
  { id: 'cat-9', name: 'Time de Futebol', slug: 'time-de-futebol', active: true, order: 9 },
  { id: 'cat-10', name: 'Casa de Show', slug: 'casa-de-show', active: true, order: 10 },
  { id: 'cat-11', name: 'Jogador de Futebol', slug: 'jogador-de-futebol', active: true, order: 11 },
  { id: 'cat-12', name: 'Rifeiro', slug: 'rifeiro', active: true, order: 12 },
  { id: 'cat-13', name: 'Criador de Sorteios', slug: 'criador-de-sorteios', active: true, order: 13 },
  { id: 'cat-14', name: 'Marca de Carros', slug: 'marca-de-carros', active: true, order: 14 }
];

export async function fetchPublicCategories(): Promise<PublicCategoryItem[]> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const q = collection(db, 'profile_categories');
      const snap = await getDocs(q);
      const list: PublicCategoryItem[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as PublicCategoryItem);
      });
      if (list.length > 0) {
        list.sort((a, b) => (a.order || 0) - (b.order || 0));
        localStorage.setItem('lockdown_profile_categories_cache', JSON.stringify(list));
        return list;
      }
    } catch (err) {
      handleFirestoreError('profile_categories', err);
    }
  }

  try {
    const saved = localStorage.getItem('lockdown_profile_categories_cache');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}

  return DEFAULT_PUBLIC_CATEGORIES;
}

export async function savePublicCategory(cat: PublicCategoryItem): Promise<void> {
  enforceRole(['ADMINISTRATOR']);
  if (!isFirebaseConfigured()) throw new Error("Firebase não conectado");
  const ref = doc(db, 'profile_categories', cat.id);
  await setDoc(ref, cleanUndefined(cat));
  try {
    const list = await fetchPublicCategories();
    const updated = list.filter(c => c.id !== cat.id);
    updated.push(cat);
    updated.sort((a, b) => (a.order || 0) - (b.order || 0));
    localStorage.setItem('lockdown_profile_categories_cache', JSON.stringify(updated));
  } catch (e) {}
}

export async function deletePublicCategory(id: string): Promise<void> {
  enforceRole(['ADMINISTRATOR']);
  if (!isFirebaseConfigured()) throw new Error("Firebase não conectado");
  const ref = doc(db, 'profile_categories', id);
  await deleteDoc(ref);
  try {
    const list = await fetchPublicCategories();
    const updated = list.filter(c => c.id !== id);
    localStorage.setItem('lockdown_profile_categories_cache', JSON.stringify(updated));
  } catch (e) {}
}

export async function fetchFundraisers(): Promise<Fundraiser[]> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const q = collection(db, 'fundraisers');
      const snap = await getDocs(q);
      const list: Fundraiser[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as Fundraiser);
      });
      localStorage.setItem('voxa_fundraisers', JSON.stringify(list));
      return list;
    } catch (err) {
      handleFirestoreError('fundraisers', err);
    }
  }
  try {
    const saved = localStorage.getItem('voxa_fundraisers');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export async function fetchFundraiserById(id: string): Promise<Fundraiser | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const ref = doc(db, 'fundraisers', id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Fundraiser;
    }
    return null;
  } catch (err) {
    console.warn("Error fetching fundraiser:", err);
    return null;
  }
}

export async function saveFundraiser(fundraiser: Fundraiser): Promise<void> {
  if (!isFirebaseConfigured()) throw new Error("Firebase não conectado");
  const ref = doc(db, 'fundraisers', fundraiser.id);
  await setDoc(ref, cleanUndefined(fundraiser));
  try {
    const list = await fetchFundraisers();
    const updated = list.filter(f => f.id !== fundraiser.id);
    updated.unshift(fundraiser);
    localStorage.setItem('voxa_fundraisers', JSON.stringify(updated));
  } catch (e) {}
}

export async function deleteFundraiser(id: string): Promise<void> {
  if (!isFirebaseConfigured()) throw new Error("Firebase não conectado");
  const ref = doc(db, 'fundraisers', id);
  await deleteDoc(ref);
  try {
    const list = await fetchFundraisers();
    const updated = list.filter(f => f.id !== id);
    localStorage.setItem('voxa_fundraisers', JSON.stringify(updated));
  } catch (e) {}
}

export async function contributeFundraiser(payload: {
  fundraiserId: string;
  contributorId: string;
  contributorName: string;
  amount: number;
  paymentMethod: 'wallet' | 'pix';
}): Promise<any> {
  if (!isFirebaseConfigured()) throw new Error("Firebase não conectado");
  
  const fundraiserRef = doc(db, 'fundraisers', payload.fundraiserId);
  const contributionId = `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const contribRef = doc(db, 'fundraiser_contributions', contributionId);

  const commissionPercent = 5;
  const platformFee = Number((payload.amount * (commissionPercent / 100)).toFixed(2));
  const netAmount = Number((payload.amount - platformFee).toFixed(2));

  let updatedFundraiser: any = null;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(fundraiserRef);
    if (!snap.exists()) throw new Error("Vaquinha não encontrada.");
    const data = snap.data() as Fundraiser;

    const newRaised = (data.raisedAmount || 0) + payload.amount;
    const newSupporterCount = (data.supporterCount || 0) + 1;

    updatedFundraiser = {
      ...data,
      raisedAmount: newRaised,
      supporterCount: newSupporterCount,
      updatedAt: new Date().toISOString()
    };

    transaction.update(fundraiserRef, {
      raisedAmount: newRaised,
      supporterCount: newSupporterCount,
      updatedAt: new Date().toISOString()
    });

    const contribution: FundraiserContribution = {
      id: contributionId,
      fundraiserId: payload.fundraiserId,
      contributorId: payload.contributorId,
      contributorName: payload.contributorName,
      amount: payload.amount,
      platformFee,
      netAmount,
      status: 'COMPLETED',
      paymentMethod: payload.paymentMethod,
      createdAt: new Date().toISOString()
    };

    transaction.set(contribRef, cleanUndefined(contribution));
  });

  return { success: true, contributionId, updatedFundraiser };
}

export async function fetchFundraiserContributions(fundraiserId?: string): Promise<FundraiserContribution[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const colRef = collection(db, 'fundraiser_contributions');
    const q = fundraiserId ? query(colRef, where('fundraiserId', '==', fundraiserId)) : query(colRef);
    const snap = await getDocs(q);
    const list: FundraiserContribution[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() } as FundraiserContribution);
    });
    return list;
  } catch (err) {
    console.warn("Error fetching fundraiser contributions:", err);
    return [];
  }
}

export async function fetchTravelBookings(userId: string): Promise<TravelBooking[]> {
  if (!isFirebaseConfigured()) return [];
  try {
    const q = query(collection(db, 'travel_bookings'), where('userId', '==', userId));
    const snap = await getDocs(q);
    const list: TravelBooking[] = [];
    snap.forEach(d => {
      list.push({ id: d.id, ...d.data() } as TravelBooking);
    });
    return list;
  } catch (err) {
    console.warn("Error fetching travel bookings:", err);
    return [];
  }
}

export async function saveTravelBooking(booking: TravelBooking): Promise<void> {
  if (!isFirebaseConfigured()) throw new Error("Firebase não conectado");
  const ref = doc(db, 'travel_bookings', booking.id);
  await setDoc(ref, cleanUndefined(booking));
}



