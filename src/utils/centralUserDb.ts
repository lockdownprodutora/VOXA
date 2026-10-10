import { db, isFirebaseConfigured, collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, updateDoc, isFirestoreWriteQuotaExhausted, markFirestoreWriteQuotaExhausted } from "../lib/firebase";
import { addDoc } from "firebase/firestore";
import { CentralUser, UserInvite, DetailedArtist, ArtistShare, DistributionClearance, UserRole } from "../types";
import { isFirestoreQuotaThrottled, handleFirestoreError, followVoxaUser } from "./storeDb";
import { SOCIAL_CONFIG } from "./socialConfig";

export const CENTRAL_USERS_BACKUP_KEY = 'lockdown_central_users_cache';
export const USER_INVITES_BACKUP_KEY = 'lockdown_user_invites_cache';

/**
 * Normalizador ÚNICO e canônico para qualquer perfil de usuário no VOXA.
 * Garante que photoURL, coverUrl, nome, username e selos sejam preservados sem perda.
 */
export function normalizeUserProfile(u: any): CentralUser {
  if (!u || typeof u !== 'object') return {} as any;
  const uid = String(u.uid || u.id || '');
  const photo = String(u.photoURL || u.avatarUrl || u.photoUrl || u.avatarURL || u.profileImage || '').trim();
  const cover = String(u.coverUrl || u.coverURL || u.coverImage || u.bannerUrl || u.backgroundImage || '').trim();
  const name = String(u.name || u.displayName || u.artisticName || 'Membro VOXA').trim();
  const email = String(u.email || '').toLowerCase().trim();
  let rawUsername = String(u.username || u.slug || (email ? email.split('@')[0] : 'user')).trim();
  if (uid === SOCIAL_CONFIG.JUNIORSANTTI92_UID && (!rawUsername || rawUsername === 'juniorsantti' || rawUsername === 'juniorsantti92')) {
    rawUsername = SOCIAL_CONFIG.JRSANTTI_USERNAME;
  } else if (uid === SOCIAL_CONFIG.VOXA_UID && (!rawUsername || rawUsername === 'user')) {
    rawUsername = SOCIAL_CONFIG.VOXA_USERNAME;
  }
  const username = rawUsername;
  const slug = String(u.slug === 'juniorsantti' && uid === SOCIAL_CONFIG.JUNIORSANTTI92_UID ? SOCIAL_CONFIG.JRSANTTI_USERNAME : (u.slug || username)).trim();
  const role = normalizeUserRole(u.role);
  const isVerified = Boolean(
    u.isVerified ||
    u.verified ||
    u.is_verified ||
    u.official ||
    u.verificationStatus === 'verified' ||
    uid === SOCIAL_CONFIG.VOXA_UID ||
    uid === SOCIAL_CONFIG.JUNIORSANTTI92_UID
  );
  const isPremium = Boolean(u.isPremium || u.premium || (typeof u.role === 'string' && u.role.toLowerCase().includes('premium')));

  const rawAdminRole = String(u.adminRole || '').toUpperCase().trim();
  const isBootstrappedSuperAdmin =
    email === 'lockdownprodutora@gmail.com' ||
    email === 'admin@lockdownprodutora.com.br' ||
    email.endsWith('@lockdownprodutora.com.br') ||
    uid === SOCIAL_CONFIG.VOXA_UID ||
    uid === SOCIAL_CONFIG.JUNIORSANTTI92_UID;

  const resolvedAdminRole = ['SUPER_ADMIN', 'ADMINISTRATOR', 'MANAGER', 'SUPPORT'].includes(rawAdminRole)
    ? rawAdminRole
    : (isBootstrappedSuperAdmin
        ? 'SUPER_ADMIN'
        : (rawAdminRole === 'NONE'
            ? 'NONE'
            : (u.isAdmin === true || role === 'ADMINISTRADOR' ? 'ADMINISTRATOR' : 'NONE')));

  return {
    ...u,
    id: u.id || uid,
    uid,
    name,
    username,
    slug,
    artisticName: u.artisticName || '',
    email,
    phone: u.phone || '',
    photoURL: photo,
    avatarUrl: photo, // compatibilidade
    coverUrl: cover,
    coverURL: cover, // compatibilidade
    profileBanners: Array.isArray(u.profileBanners) ? u.profileBanners : [],
    profileAdSettings: u.profileAdSettings || {
      allowBannerAds: false,
      availableSlotsCount: 1,
      price24h: 25,
      price7d: 120,
      price30d: 400,
      requireManualApproval: true
    },
    isVerified,
    verified: isVerified,
    isPremium,
    premium: isPremium,
    accountType: u.accountType || role || 'Pessoa',
    role,
    adminRole: resolvedAdminRole,
    status: u.status || 'Ativo',
    accountStatus: u.accountStatus || (email ? 'CONTA_ATIVA' : 'SEM_ACESSO'),
    isAdmin: ['ADMINISTRATOR', 'SUPER_ADMIN'].includes(resolvedAdminRole),
    bio: u.bio || '',
    location: u.location || '',
    website: u.website || '',
    socials: u.socials || {},
    highlights: Array.isArray(u.highlights) ? u.highlights : [],
    features: u.features || {},
    messageSettings: u.messageSettings || { privacy: 'ANYONE' },
    categoryId: u.categoryId || '',
    categoryName: u.categoryName || '',
    followersCount: typeof u.followersCount === 'number' ? u.followersCount : 0,
    followingCount: typeof u.followingCount === 'number' ? u.followingCount : 0,
    followersList: Array.isArray(u.followersList) ? u.followersList : [],
    followingList: Array.isArray(u.followingList) ? u.followingList : [],
    totalLikesReceived: typeof u.totalLikesReceived === 'number' ? u.totalLikesReceived : (u.likesCount || 0),
    referralCode: u.referralCode || generateReferralCode(),
    createdAt: u.createdAt || new Date().toISOString(),
    updatedAt: u.updatedAt || new Date().toISOString()
  };
}

/**
 * Faz o merge seguro de um perfil existente com novos dados recebidos.
 * Nunca sobrescreve photoURL ou coverUrl válidos por vazios/undefined.
 */
export function mergeUserProfile(previous: any, incoming: any): CentralUser {
  if (!previous && !incoming) return {} as any;
  if (!previous) return normalizeUserProfile(incoming);
  if (!incoming) return normalizeUserProfile(previous);

  const prevNorm = normalizeUserProfile(previous);
  const incNorm = normalizeUserProfile(incoming);

  const photo = (incNorm.photoURL && incNorm.photoURL.trim() !== '') 
    ? incNorm.photoURL 
    : prevNorm.photoURL;

  const cover = (incNorm.coverUrl && incNorm.coverUrl.trim() !== '') 
    ? incNorm.coverUrl 
    : prevNorm.coverUrl;

  const name = (incNorm.name && incNorm.name !== 'Membro VOXA') 
    ? incNorm.name 
    : prevNorm.name;

  const bio = (incNorm.bio !== undefined && incNorm.bio !== '') 
    ? incNorm.bio 
    : (prevNorm.bio || '');

  return normalizeUserProfile({
    ...prevNorm,
    ...incNorm,
    photoURL: photo,
    coverUrl: cover,
    name,
    bio,
    socials: { ...(prevNorm.socials || {}), ...(incNorm.socials || {}) },
    features: { ...(prevNorm.features || {}), ...(incNorm.features || {}) }
  });
}

/**
 * Normaliza um nome gerando um slug limpo para URL /u/{slug}.
 */
export function generateSlug(name: string): string {
  if (!name) return `user-${Date.now().toString(36)}`;
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || `user-${Date.now().toString(36)}`;
}

/**
 * Gera um slug único garantindo que não colida com outro usuário.
 */
export function generateUniqueSlug(name: string, existingUsers: CentralUser[], currentUserId?: string): string {
  const base = generateSlug(name);
  let candidate = base;
  let counter = 2;
  while (existingUsers.some(u => (u.slug === candidate || generateSlug(u.name || '') === candidate) && u.id !== currentUserId && u.uid !== currentUserId)) {
    candidate = `${base}-${counter}`;
    counter++;
  }
  return candidate;
}

/**
 * Gera um código de indicação único e elegante (ex: LK-8F92A1).
 */
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LK-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Normaliza os tipos de usuário para os tipos oficiais:
 * 'ARTISTA' | 'USUÁRIO COMUM' | 'PRODUTORA' | 'EMPRESA' | 'ADMINISTRADOR'
 */
export function normalizeUserRole(rawRole?: any): UserRole {
  if (!rawRole || typeof rawRole !== 'string') return 'USUÁRIO COMUM';
  const upper = rawRole.toUpperCase().trim();
  if (upper.includes('ADMIN')) {
    return 'ADMINISTRADOR';
  }
  if (upper.includes('ARTISTA') || upper.includes('DJ') || upper.includes('CANTOR') || upper.includes('MC')) {
    return 'ARTISTA';
  }
  if (upper.includes('PRODUTORA') || upper.includes('GRAVADORA') || upper.includes('LABEL')) {
    return 'PRODUTORA';
  }
  if (upper.includes('EMPRESA') || upper.includes('MARCA') || upper.includes('ORGANIZAÇÃO')) {
    return 'EMPRESA';
  }
  return 'USUÁRIO COMUM';
}

/**
 * Normaliza um nome removendo acentos, espaços múltiplos, caracteres especiais e convertendo para minúsculas.
 */
export function normalizePersonName(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Calcula a pontuação de similaridade entre duas strings (Jaccard / Substring matching).
 */
export function calculateNameSimilarity(a: string, b: string): number {
  const normA = normalizePersonName(a);
  const normB = normalizePersonName(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;
  if (normA.includes(normB) || normB.includes(normA)) return 0.85;

  const wordsA = new Set(normA.split(' '));
  const wordsB = new Set(normB.split(' '));
  let intersection = 0;
  wordsA.forEach(w => {
    if (wordsB.has(w)) intersection++;
  });
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Busca pessoas existentes na lista por nome, nome artístico ou e-mail,
 * retornando correspondência exata ou sugestões de perfis semelhantes.
 */
export function searchPeople(queryStr: string, allUsers: CentralUser[]): {
  exactMatch?: CentralUser;
  similarMatches: CentralUser[];
} {
  const q = normalizePersonName(queryStr);
  if (!q || q.length < 2) {
    return { similarMatches: [] };
  }

  let exactMatch: CentralUser | undefined;
  const similarMatches: CentralUser[] = [];

  for (const user of allUsers) {
    const normName = normalizePersonName(user.name || '');
    const normArtistic = normalizePersonName(user.artisticName || '');
    const userEmail = (user.email || '').toLowerCase().trim();

    if (normName === q || normArtistic === q || (userEmail && userEmail === queryStr.toLowerCase().trim())) {
      exactMatch = user;
    } else {
      const simName = calculateNameSimilarity(queryStr, user.name || '');
      const simArt = calculateNameSimilarity(queryStr, user.artisticName || '');
      if (simName >= 0.5 || simArt >= 0.5 || (userEmail && userEmail.includes(q))) {
        similarMatches.push(user);
      }
    }
  }

  return { exactMatch, similarMatches };
}

export let isLastFetchFromCache = false;

/**
 * Busca todos os usuários do Firestore central (coleção `users`).
 */
export async function fetchCentralUsers(): Promise<CentralUser[]> {
  console.log("[USERS_LOAD_START] Starting fetchCentralUsers process...");
  isLastFetchFromCache = false;
  
  // 1. Tentar buscar pela API segura do backend com um timeout de 6 segundos
  const controller = new AbortController();
  const apiTimeout = setTimeout(() => {
    controller.abort();
    console.warn("[USERS_API_ERROR] /api/admin/users request timed out after 6000ms");
  }, 6000);

  try {
    const saved = localStorage.getItem('voxa_current_user');
    let uidHeader = '';
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        uidHeader = parsed.uid || parsed.id || '';
      } catch (e) {}
    }

    const res = await fetch("/api/admin/users", { 
      signal: controller.signal,
      headers: uidHeader ? { "x-admin-uid": uidHeader } : undefined
    });
    clearTimeout(apiTimeout);
    const data = await res.json();
    if (data.success && Array.isArray(data.users)) {
      console.log(`[USERS_API_SUCCESS] Loaded ${data.users.length} users successfully from API.`);
      
      // Merge with previous cache to never strip images or covers
      let existingCacheMap: Record<string, CentralUser> = {};
      try {
        const savedCache = localStorage.getItem(CENTRAL_USERS_BACKUP_KEY);
        if (savedCache) {
          const parsed = JSON.parse(savedCache);
          if (Array.isArray(parsed)) {
            parsed.forEach((u: any) => {
              const id = u.uid || u.id;
              if (id) existingCacheMap[id] = normalizeUserProfile(u);
            });
          }
        }
      } catch (e) {}

      const clientAdminRolesMap = new Map<string, string>();
      try {
        if (isFirebaseConfigured() && !isFirestoreQuotaThrottled()) {
          const adminUsersSnap = await getDocs(collection(db, 'admin_users'));
          adminUsersSnap.forEach((aDoc: any) => {
            const r = aDoc.data()?.role;
            if (r) clientAdminRolesMap.set(aDoc.id, String(r).toUpperCase().trim());
          });
        }
      } catch (e) {}

      const list = data.users.map((u: any) => {
        const id = u.uid || u.id;
        const prev = id ? existingCacheMap[id] : null;
        const canonicalRole = (id && clientAdminRolesMap.get(id)) || (u.adminRole && u.adminRole !== 'NONE' ? u.adminRole : undefined);
        const enriched = canonicalRole ? { ...u, adminRole: canonicalRole, isAdmin: canonicalRole === 'ADMINISTRATOR' || canonicalRole === 'SUPER_ADMIN' } : u;
        return mergeUserProfile(prev, enriched);
      });

      localStorage.setItem(CENTRAL_USERS_BACKUP_KEY, JSON.stringify(list));
      return list;
    }
  } catch (apiErr: any) {
    clearTimeout(apiTimeout);
    console.warn("[USERS_API_ERROR] Backend API Users Fetch Failed:", apiErr.name === 'AbortError' ? 'Timeout' : apiErr.message);
  }

  // 2. Fallback: buscar diretamente via cliente do Firestore com timeout de 5 segundos
  if (!isFirestoreQuotaThrottled()) {
    console.log("[USERS_FIRESTORE_FALLBACK] Attempting direct Firestore query fallback...");
    
    try {
      const q = collection(db, 'users');
      
      const getDocsPromise = getDocs(q);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("Firestore query timed out after 5000ms")), 5000)
      );

      const snapshot = await Promise.race([getDocsPromise, timeoutPromise]) as any;

      const adminRolesMap = new Map<string, string>();
      try {
        const adminUsersSnap = await getDocs(collection(db, 'admin_users'));
        adminUsersSnap.forEach((aDoc: any) => {
          const r = aDoc.data()?.role;
          if (r) adminRolesMap.set(aDoc.id, String(r).toUpperCase().trim());
        });
      } catch (e) {}
      
      let existingCacheMap: Record<string, CentralUser> = {};
      try {
        const savedCache = localStorage.getItem(CENTRAL_USERS_BACKUP_KEY);
        if (savedCache) {
          const parsed = JSON.parse(savedCache);
          if (Array.isArray(parsed)) {
            parsed.forEach((u: any) => {
              const id = u.uid || u.id;
              if (id) existingCacheMap[id] = normalizeUserProfile(u);
            });
          }
        }
      } catch (e) {}

      const list: CentralUser[] = [];
      snapshot.forEach((docSnap: any) => {
        const rawData = docSnap.data();
        const canonicalAdminRole = adminRolesMap.get(docSnap.id) || rawData.adminRole;
        const raw = { id: docSnap.id, uid: docSnap.id, ...rawData, ...(canonicalAdminRole ? { adminRole: canonicalAdminRole } : {}) };
        const id = raw.uid || raw.id;
        const prev = id ? existingCacheMap[id] : null;
        list.push(mergeUserProfile(prev, raw));
      });

      console.log(`[USERS_FIRESTORE_FALLBACK] Successfully loaded ${list.length} users from Firestore query.`);
      localStorage.setItem(CENTRAL_USERS_BACKUP_KEY, JSON.stringify(list));
      return list;
    } catch (err: any) {
      console.warn("[USERS_FIRESTORE_FALLBACK] Failed to fetch users via Firestore client:", err.message);
      handleFirestoreError('users_central', err);
    }
  }

  // 3. Fallback: buscar dados do cache local do navegador
  console.log("[USERS_FIRESTORE_FALLBACK] Attempting local storage cache loading...");
  try {
    const saved = localStorage.getItem(CENTRAL_USERS_BACKUP_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        console.log(`[USERS_FIRESTORE_FALLBACK] Successfully loaded ${parsed.length} users from localStorage.`);
        isLastFetchFromCache = true;
        return parsed.map((u: any) => normalizeUserProfile(u));
      }
    }
  } catch (e: any) {
    console.error("[USERS_FIRESTORE_FALLBACK] Local cache load failed:", e.message);
  }
  return [];
}

/**
 * Runs the automatic default follows on creation or first activation.
 */
export async function applyDefaultOfficialFollows(userId: string): Promise<void> {
  if (!userId || !isFirebaseConfigured()) return;
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    // Ensure official profiles exist so transactions never fail
    const voxaRef = doc(db, 'users', SOCIAL_CONFIG.VOXA_UID);
    const voxaSnap = await getDoc(voxaRef);
    if (!voxaSnap.exists()) {
      await setDoc(voxaRef, {
        id: SOCIAL_CONFIG.VOXA_UID,
        uid: SOCIAL_CONFIG.VOXA_UID,
        name: 'VOXA',
        username: SOCIAL_CONFIG.VOXA_USERNAME,
        slug: SOCIAL_CONFIG.VOXA_USERNAME,
        isVerified: true,
        verified: true,
        role: 'ADMINISTRADOR',
        accountType: 'Empresa',
        status: 'Ativo',
        followersCount: 0,
        followingCount: 0
      }, { merge: true });
    }

    const ceoRef = doc(db, 'users', SOCIAL_CONFIG.JUNIORSANTTI92_UID);
    const ceoSnap = await getDoc(ceoRef);
    if (!ceoSnap.exists()) {
      await setDoc(ceoRef, {
        id: SOCIAL_CONFIG.JUNIORSANTTI92_UID,
        uid: SOCIAL_CONFIG.JUNIORSANTTI92_UID,
        name: 'Junior Santti',
        username: SOCIAL_CONFIG.JRSANTTI_USERNAME,
        slug: SOCIAL_CONFIG.JRSANTTI_USERNAME,
        isVerified: true,
        verified: true,
        role: 'ADMINISTRADOR',
        accountType: 'Criador',
        status: 'Ativo',
        followersCount: 0,
        followingCount: 0
      }, { merge: true });
    }

    // 1. Auto-follow VOXA account (silent, source: 'default_follow')
    if (userId !== SOCIAL_CONFIG.VOXA_UID) {
      await followVoxaUser(userId, SOCIAL_CONFIG.VOXA_UID, { silent: true, source: 'default_follow' });
    }

    // 2. Auto-follow Founder account (silent, source: 'default_follow')
    if (userId !== SOCIAL_CONFIG.JUNIORSANTTI92_UID) {
      await followVoxaUser(userId, SOCIAL_CONFIG.JUNIORSANTTI92_UID, { silent: true, source: 'default_follow' });
    }

    // 3. Mark as initialized
    if (userData?.defaultFollowsInitialized !== true) {
      await setDoc(userRef, { defaultFollowsInitialized: true }, { merge: true });
    }
    console.log(`[DEFAULT_FOLLOWS_SUCCESS] Successfully set default follows for user ${userId}`);
  } catch (err) {
    console.warn("[DEFAULT_FOLLOWS_ERROR] Could not apply default follows for", userId, err);
  }
}

/**
 * Atualização ATÔMICA e segura de @username de um usuário.
 * 1. Normaliza username;
 * 2. Verifica disponibilidade real;
 * 3. Reserva novo username em `usernames/{newUsername}`;
 * 4. Atualiza `users/{uid}` (username e slug);
 * 5. Remove reserva antiga somente após confirmação;
 * 6. Atualiza referências denormalizadas (voxes, posts, polls, activities, chat_threads);
 * 7. Invalida todos os caches (memória, sessionStorage, localStorage).
 */
export async function updateUsernameAtomic(
  uid: string,
  rawNewUsername: string,
  additionalProfileData?: Record<string, any>
): Promise<{ success: boolean; newUsername: string; oldUsername: string }> {
  if (!uid) throw new Error("UID do usuário inválido.");
  const cleanNew = rawNewUsername.toLowerCase().trim().replace(/^@+/, '').replace(/[^a-z0-9_.]/g, '');
  if (!cleanNew || cleanNew.length < 3) {
    throw new Error("O @username precisa ter pelo menos 3 caracteres válidos.");
  }

  const reservedRoutes = [
    'admin', 'home', 'explore', 'wallet', 'messages', 'sussurros', 'settings',
    'notifications', 'ranking', 'vaquinhas', 'passagens', 'store', 'tickets',
    'subscriptions', 'music', 'news', 'services', 'my_business', 'dating',
    'ads', 'support', 'activate-account', 'dashboard', 'submit_music', 'my_submissions', 'vox', 'u', 's'
  ];
  if (reservedRoutes.includes(cleanNew)) {
    throw new Error("Este @username é reservado pelo sistema.");
  }

  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  const existingUserData = userSnap.exists() ? userSnap.data() : {};
  const oldUsername = String(existingUserData.username || existingUserData.slug || '').toLowerCase().trim();

  // Se o username mudou, validar disponibilidade real
  if (cleanNew !== oldUsername) {
    const newUsernameRef = doc(db, 'usernames', cleanNew);
    const newUsernameSnap = await getDoc(newUsernameRef);
    if (newUsernameSnap.exists() && newUsernameSnap.data()?.uid && newUsernameSnap.data()?.uid !== uid) {
      throw new Error(`O @${cleanNew} já está em uso por outro perfil.`);
    }

    const usersQuery = query(collection(db, 'users'), where('username', '==', cleanNew));
    const usersSnap = await getDocs(usersQuery);
    const takenByOther = usersSnap.docs.some(d => d.id !== uid && d.data()?.uid !== uid);
    if (takenByOther) {
      throw new Error(`O @${cleanNew} já pertence a outro usuário.`);
    }

    // Etapa 3: Reservar novo username em `usernames/{newUsername}`
    await setDoc(newUsernameRef, {
      uid,
      username: cleanNew,
      updatedAt: new Date().toISOString()
    });
  }

  // Etapa 4: Atualizar `users/{uid}`
  const payloadToUpdate: Record<string, any> = {
    ...(additionalProfileData ? cleanUndefined(additionalProfileData) : {}),
    uid,
    id: uid,
    username: cleanNew,
    slug: cleanNew,
    updatedAt: new Date().toISOString()
  };

  try {
    await setDoc(userRef, payloadToUpdate, { merge: true });
    // Confirmar leitura real no Firestore
    const confirmSnap = await getDoc(userRef);
    if (!confirmSnap.exists() || confirmSnap.data()?.username !== cleanNew) {
      throw new Error("O Firestore não confirmou a gravação do novo username.");
    }
  } catch (err) {
    // Rollback da reserva nova se falhou a atualização do usuário
    if (cleanNew !== oldUsername) {
      try { await deleteDoc(doc(db, 'usernames', cleanNew)); } catch {}
    }
    throw err;
  }

  // Também sincronizar com backend se disponível
  try {
    await fetch("/api/admin/users/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: payloadToUpdate })
    });
  } catch {}

  // Etapa 6: Remover reserva antiga somente após confirmação de sucesso
  if (oldUsername && oldUsername !== cleanNew) {
    try {
      const oldRef = doc(db, 'usernames', oldUsername);
      const oldSnap = await getDoc(oldRef);
      if (oldSnap.exists() && oldSnap.data()?.uid === uid) {
        await deleteDoc(oldRef);
      }
    } catch (e) {
      console.warn("Could not remove old username reservation:", e);
    }
  }

  // Etapa 9: Atualizar referências denormalizadas em background/await
  if (oldUsername !== cleanNew || additionalProfileData?.name) {
    const newDisplayName = additionalProfileData?.name || existingUserData.name;
    try {
      // Atualizar voxes
      const voxSnap = await getDocs(query(collection(db, 'voxes'), where('authorId', '==', uid)));
      await Promise.all(voxSnap.docs.map(d => {
        const up: any = { authorUsername: cleanNew };
        if (newDisplayName) up.authorName = newDisplayName;
        return setDoc(doc(db, 'voxes', d.id), up, { merge: true });
      }));
    } catch (e) {}

    try {
      // Atualizar posts
      const postSnap = await getDocs(query(collection(db, 'posts'), where('userId', '==', uid)));
      await Promise.all(postSnap.docs.map(d => {
        const up: any = { authorUsername: cleanNew };
        if (newDisplayName) up.authorName = newDisplayName;
        return setDoc(doc(db, 'posts', d.id), up, { merge: true });
      }));
    } catch (e) {}

    try {
      // Atualizar enquetes (polls)
      const pollSnap = await getDocs(query(collection(db, 'polls'), where('authorId', '==', uid)));
      await Promise.all(pollSnap.docs.map(d => {
        const up: any = { authorUsername: cleanNew };
        if (newDisplayName) up.authorName = newDisplayName;
        return setDoc(doc(db, 'polls', d.id), up, { merge: true });
      }));
    } catch (e) {}

    try {
      // Atualizar atividades recentes
      const actSnap = await getDocs(query(collection(db, 'activities'), where('userId', '==', uid)));
      await Promise.all(actSnap.docs.map(d => {
        const up: any = { userUsername: cleanNew };
        if (newDisplayName) up.userName = newDisplayName;
        return setDoc(doc(db, 'activities', d.id), up, { merge: true });
      }));
    } catch (e) {}

    try {
      // Atualizar chat_threads onde é participante
      const threadsSnap = await getDocs(query(collection(db, 'chat_threads'), where('participants', 'array-contains', uid)));
      await Promise.all(threadsSnap.docs.map(d => {
        const up: any = { [`participantUsernames.${uid}`]: cleanNew };
        if (newDisplayName) up[`participantNames.${uid}`] = newDisplayName;
        return updateDoc(doc(db, 'chat_threads', d.id), up);
      }));
    } catch (e) {}
  }

  // Etapa 5 & 10: Invalidar caches (sessionStorage, localStorage, memória VOX)
  invalidateAllUserProfileCaches(uid, oldUsername, cleanNew, payloadToUpdate);

  return { success: true, newUsername: cleanNew, oldUsername };
}

/**
 * Invalida todos os caches de perfil (sessionStorage, localStorage, VOX in-memory cache e mapas por username/UID).
 */
export function invalidateAllUserProfileCaches(
  uid?: string,
  oldUsername?: string,
  newUsername?: string,
  updatedFields?: Record<string, any>
): void {
  try {
    if (uid) {
      sessionStorage.removeItem(`voxa_profile_${uid}`);
    }
    // Limpar qualquer chave voxa_profile_* no sessionStorage para garantir zero cache congelado
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith('voxa_profile_') || k.includes('username') || k.includes('juniorsantti'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
  } catch {}

  try {
    if (uid && updatedFields) {
      const savedUsers = localStorage.getItem(CENTRAL_USERS_BACKUP_KEY);
      if (savedUsers) {
        const parsed: CentralUser[] = JSON.parse(savedUsers);
        const updatedList = parsed.map(u =>
          (u.uid === uid || u.id === uid)
            ? normalizeUserProfile({ ...u, ...updatedFields, username: newUsername || u.username, slug: newUsername || u.slug })
            : u
        );
        localStorage.setItem(CENTRAL_USERS_BACKUP_KEY, JSON.stringify(updatedList));
      }
    } else {
      localStorage.removeItem(CENTRAL_USERS_BACKUP_KEY);
    }
  } catch {}

  try {
    if (uid) {
      const savedCurrent = localStorage.getItem('voxa_current_user');
      if (savedCurrent) {
        const parsedCurrent = JSON.parse(savedCurrent);
        if (parsedCurrent.uid === uid || parsedCurrent.id === uid) {
          const nextUser = {
            ...parsedCurrent,
            ...(updatedFields || {}),
            ...(newUsername ? { username: newUsername, slug: newUsername } : {})
          };
          localStorage.setItem('voxa_current_user', JSON.stringify(nextUser));
        }
      }
    }
  } catch {}

  try {
    if (typeof window !== 'undefined') {
      if ((window as any).invalidateUserProfileCache) {
        (window as any).invalidateUserProfileCache(uid);
      }
      window.dispatchEvent(
        new CustomEvent('voxa_profile_cache_invalidated', {
          detail: { uid, oldUsername, newUsername }
        })
      );
    }
  } catch {}
}

/**
 * Alias compatível com PublicSite para atualização atômica de @username:
 * Suporta updateUsernameAtomically(uid, newUsername) ou updateUsernameAtomically(uid, oldUsername, newUsername, additionalProfileData)
 */
export async function updateUsernameAtomically(
  uid: string,
  arg2: string,
  arg3?: string | Record<string, any>,
  arg4?: Record<string, any>
): Promise<{ success: boolean; newUsername: string; oldUsername: string }> {
  if (typeof arg3 === 'string') {
    return updateUsernameAtomic(uid, arg3, arg4);
  }
  return updateUsernameAtomic(uid, arg2, arg3 as Record<string, any> | undefined);
}

let _reconciliationRunning = false;

/**
 * Migração e reconciliação única:
 * - Migra o perfil do CEO (`lvwWKvnHoMPDrOWTgrCZewhgcVw2`) de `juniorsantti` para `jrsantti`
 * - Garante `@voxa` (`TkJZkTxYX0PYknDHULfr8DR7Dlw1`) configurado
 * - Marca todos os perfis existentes como verificados (`isVerified: true`, `verified: true`) caso ainda não tenham sido reconciliados
 * - Garante UMA ÚNICA VEZ que todos os usuários existentes sigam `@voxa` e `@jrsantti` (respeitando unfollow posterior)
 * - Recalcula `followersCount` e `followingCount` a partir das relações reais em `follows`
 */
export async function runVoxaSystemReconciliationOnce(): Promise<{ ran: boolean }> {
  if (_reconciliationRunning || !isFirebaseConfigured() || isFirestoreWriteQuotaExhausted()) return { ran: false };
  const MIGRATION_KEY = 'voxa_reconciliation_v2026_jrsantti_verified_v2';
  if (typeof window !== 'undefined' && localStorage.getItem(MIGRATION_KEY) === 'true') {
    return { ran: false };
  }

  _reconciliationRunning = true;
  try {
    console.log("[VOXA RECONCILIATION] Iniciando migração do CEO @jrsantti, selos verificados e follows oficiais...");

    // 1. Migrar especificamente o perfil do CEO para @jrsantti
    const ceoUid = SOCIAL_CONFIG.JUNIORSANTTI92_UID;
    const ceoRef = doc(db, 'users', ceoUid);
    const ceoSnap = await getDoc(ceoRef);
    if (ceoSnap.exists()) {
      const ceoData = ceoSnap.data();
      if (ceoData.username !== 'jrsantti' || ceoData.slug !== 'jrsantti' || !ceoData.isVerified) {
        await updateUsernameAtomic(ceoUid, 'jrsantti', {
          isVerified: true,
          verified: true
        });
      } else {
        await setDoc(doc(db, 'usernames', 'jrsantti'), { uid: ceoUid, username: 'jrsantti', updatedAt: new Date().toISOString() }, { merge: true });
      }
      // Liberar reservas antigas juniorsantti / juniorsantti92 somente após confirmação
      const checkCeo = await getDoc(ceoRef);
      if (checkCeo.exists() && checkCeo.data()?.username === 'jrsantti') {
        try { await deleteDoc(doc(db, 'usernames', 'juniorsantti')); } catch {}
        try { await deleteDoc(doc(db, 'usernames', 'juniorsantti92')); } catch {}
      }
    } else {
      await setDoc(ceoRef, {
        id: ceoUid,
        uid: ceoUid,
        name: 'Junior Santti',
        username: 'jrsantti',
        slug: 'jrsantti',
        isVerified: true,
        verified: true,
        role: 'ADMINISTRADOR',
        accountType: 'Criador',
        status: 'Ativo',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      await setDoc(doc(db, 'usernames', 'jrsantti'), { uid: ceoUid, username: 'jrsantti', updatedAt: new Date().toISOString() }, { merge: true });
    }

    // 2. Garantir @voxa oficial
    const voxaUid = SOCIAL_CONFIG.VOXA_UID;
    const voxaRef = doc(db, 'users', voxaUid);
    const voxaSnap = await getDoc(voxaRef);
    if (voxaSnap.exists()) {
      const voxaData = voxaSnap.data();
      if (voxaData.username !== 'voxa' || !voxaData.isVerified) {
        await setDoc(voxaRef, {
          username: 'voxa',
          slug: 'voxa',
          isVerified: true,
          verified: true
        }, { merge: true });
        await setDoc(doc(db, 'usernames', 'voxa'), { uid: voxaUid, username: 'voxa', updatedAt: new Date().toISOString() }, { merge: true });
      }
    } else {
      await setDoc(voxaRef, {
        id: voxaUid,
        uid: voxaUid,
        name: 'VOXA',
        username: 'voxa',
        slug: 'voxa',
        isVerified: true,
        verified: true,
        role: 'ADMINISTRADOR',
        accountType: 'Empresa',
        status: 'Ativo',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      await setDoc(doc(db, 'usernames', 'voxa'), { uid: voxaUid, username: 'voxa', updatedAt: new Date().toISOString() }, { merge: true });
    }

    // 3. Buscar todos os usuários existentes no Firestore
    const usersSnap = await getDocs(collection(db, 'users'));
    const allUserDocs = usersSnap.docs;

    for (const uDoc of allUserDocs) {
      const uid = uDoc.id;
      const data = uDoc.data();

      const updates: Record<string, any> = {};

      // Se for o CEO, garantir username jrsantti
      if (uid === ceoUid && (data.username !== 'jrsantti' || data.slug !== 'jrsantti')) {
        updates.username = 'jrsantti';
        updates.slug = 'jrsantti';
      }

      // Marcar todos os perfis existentes como verificados (migração temporária solicitada, preservando remoção manual futura do admin)
      if (data.isVerified === undefined || data.verified === undefined || (!data.isVerified && !data.verificationMigrationV1Done)) {
        updates.isVerified = true;
        updates.verified = true;
        updates.verificationMigrationV1Done = true;
      }

      // Auto-follow ÚNICO para usuários existentes (não recria se officialFollowMigrationV2026Done já for true, permitindo unfollow posterior)
      if (!data.officialFollowMigrationV2026Done) {
        if (uid !== voxaUid) {
          try {
            await followVoxaUser(uid, voxaUid, { silent: true, source: 'default_follow' });
          } catch {}
        }
        if (uid !== ceoUid) {
          try {
            await followVoxaUser(uid, ceoUid, { silent: true, source: 'default_follow' });
          } catch {}
        }
        updates.officialFollowMigrationV2026Done = true;
        updates.defaultFollowsInitialized = true;
      }

      if (Object.keys(updates).length > 0) {
        try {
          await setDoc(doc(db, 'users', uid), updates, { merge: true });
        } catch {}
      }
    }

    // 4. Reconciliar contadores reais (followersCount e followingCount) a partir das relações reais em `follows`
    try {
      const followsSnap = await getDocs(collection(db, 'follows'));
      const followersMap = new Map<string, Set<string>>();
      const followingMap = new Map<string, Set<string>>();

      followsSnap.docs.forEach(fDoc => {
        const fData = fDoc.data();
        const follower = fData.followerId || fData.followerUid;
        const following = fData.followingId || fData.followingUid;
        if (follower && following && follower !== following) {
          if (!followersMap.has(following)) followersMap.set(following, new Set());
          followersMap.get(following)!.add(follower);

          if (!followingMap.has(follower)) followingMap.set(follower, new Set());
          followingMap.get(follower)!.add(following);
        }
      });

      for (const uDoc of allUserDocs) {
        const uid = uDoc.id;
        const uData = uDoc.data();
        const realFollowers = followersMap.get(uid)?.size || 0;
        const realFollowing = followingMap.get(uid)?.size || 0;
        if (uData.followersCount !== realFollowers || uData.followingCount !== realFollowing) {
          try {
            await setDoc(doc(db, 'users', uid), {
              followersCount: realFollowers,
              followingCount: realFollowing
            }, { merge: true });
          } catch {}
        }
      }
    } catch (e) {
      console.warn("[VOXA RECONCILIATION] Aviso ao recalcular contadores globais:", e);
    }

    // 5. Invalidar caches para refletir imediatamente na UI
    invalidateAllUserProfileCaches();
    if (typeof window !== 'undefined') {
      localStorage.setItem(MIGRATION_KEY, 'true');
    }

    console.log("[VOXA RECONCILIATION] Migração concluída com sucesso!");
    return { ran: true };
  } catch (err) {
    console.warn("[VOXA RECONCILIATION] Erro durante reconciliação:", err);
    return { ran: false };
  } finally {
    _reconciliationRunning = false;
  }
}

export const reconcileOfficialVerificationAndFollowsOnce = runVoxaSystemReconciliationOnce;

function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined);
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      result[key] = cleanUndefined(val);
    }
  }
  return result;
}

/**
 * Salva ou atualiza um usuário central no Firestore.
 */
export async function saveCentralUser(user: CentralUser, adminRole?: string, categoryId?: string): Promise<void> {
  const cleanId = user.id || user.uid || `user_prof_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const cleanName = (user.name || user.artisticName || 'Usuário').trim();
  const rawUsername = String(user.username || user.slug || generateSlug(cleanName)).trim().replace(/^@+/, '').toLowerCase();
  const slug = user.slug || rawUsername || generateSlug(cleanName);
  const referralCode = user.referralCode || generateReferralCode();
  const role = normalizeUserRole(user.role);

  const normalizedAdminRole = adminRole !== undefined
    ? String(adminRole || 'NONE').toUpperCase().trim()
    : ((user as any).adminRole ? String((user as any).adminRole).toUpperCase().trim() : undefined);

  const photoVal = user.photoURL || (user as any).avatarUrl || '';
  const coverVal = user.coverUrl || (user as any).coverURL || '';

  const toSaveRaw: CentralUser = {
    ...user,
    id: cleanId,
    uid: user.uid || cleanId,
    name: cleanName,
    username: rawUsername || slug,
    slug,
    photoURL: photoVal,
    avatarUrl: photoVal,
    coverUrl: coverVal,
    coverURL: coverVal,
    role: normalizedAdminRole === 'ADMINISTRATOR' || normalizedAdminRole === 'SUPER_ADMIN'
      ? 'ADMINISTRADOR'
      : (role === 'ADMINISTRADOR' ? 'USUÁRIO COMUM' : role),
    ...(normalizedAdminRole !== undefined ? {
      adminRole: normalizedAdminRole,
      isAdmin: normalizedAdminRole === 'ADMINISTRATOR' || normalizedAdminRole === 'SUPER_ADMIN'
    } : {}),
    referralCode,
    galleryPhotos: Array.isArray(user.galleryPhotos) ? user.galleryPhotos.slice(0, 4) : [],
    updatedAt: new Date().toISOString()
  };

  const toSave = cleanUndefined(toSaveRaw);

  let activeAdminUid = '';
  try {
    const saved = localStorage.getItem('voxa_current_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      activeAdminUid = parsed.uid || parsed.id || '';
    }
  } catch (e) {}

  let apiSaveSucceeded = false;
  let apiErrorMessage = '';

  // 1. Tentar salvar via API do Servidor (bypassa regras de segurança e garante gravação no Firestore via Admin SDK) com timeout de 10s
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (activeAdminUid) {
      headers["x-admin-uid"] = activeAdminUid;
    }

    const controller = new AbortController();
    const apiTimeout = setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch("/api/admin/users/update", {
        method: "POST",
        headers,
        body: JSON.stringify({
          user: toSave,
          adminRole: normalizedAdminRole,
          categoryId,
          adminUid: activeAdminUid
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(apiTimeout);
    }

    const result = await response.json();
    if (!result.success) {
      apiErrorMessage = result.error || "Erro retornado pela API";
      throw new Error(apiErrorMessage);
    }
    apiSaveSucceeded = true;
    console.log(`[USERS_API_SAVE] Perfil do usuário ${cleanId} (@${toSave.username}) salvo com sucesso no backend.`);
  } catch (apiErr: any) {
    console.warn("[USERS_API_SAVE] Falha ao salvar via API do servidor, tentando salvar direto no Firestore cliente:", apiErr.message);
  }

  // 2. Garantir gravação e confirmação real em admin_users/{uid}.role, usernames/{username} e users/{uid} no Firestore com timeout de 8s
  const withFirestoreTimeout = <T>(promise: Promise<T>, ms = 8000): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Tempo limite excedido ao comunicar com o Firestore.")), ms))
    ]);
  };

  try {
    if (!apiSaveSucceeded || !isFirestoreQuotaThrottled()) {
      if (normalizedAdminRole !== undefined) {
        const adminDocRef = doc(db, 'admin_users', cleanId);
        if (normalizedAdminRole === 'NONE' || !normalizedAdminRole) {
          try {
            const existingAdminSnap = await withFirestoreTimeout(getDoc(adminDocRef), 4000);
            if (existingAdminSnap.exists()) {
              await withFirestoreTimeout(deleteDoc(adminDocRef), 4000);
            }
          } catch {}
        } else {
          await withFirestoreTimeout(setDoc(adminDocRef, {
            uid: cleanId,
            role: normalizedAdminRole,
            status: 'ACTIVE',
            updatedBy: activeAdminUid || 'admin',
            updatedAt: new Date().toISOString()
          }, { merge: true }), 5000);
        }
      }

      const docRef = doc(db, 'users', cleanId);
      await withFirestoreTimeout(setDoc(docRef, toSave, { merge: true }), 6000);

      if (toSave.username) {
        const cleanUname = String(toSave.username).toLowerCase().trim().replace(/^@+/, '');
        if (cleanUname) {
          await withFirestoreTimeout(setDoc(doc(db, 'usernames', cleanUname), {
            uid: cleanId,
            username: cleanUname,
            updatedAt: new Date().toISOString()
          }, { merge: true }), 4000);
        }
      }
    }
  } catch (err: any) {
    if (!apiSaveSucceeded) {
      console.error("[USERS_FIRESTORE_SAVE_ERROR] Falha total ao salvar usuário no Firestore:", {
        file: "src/utils/centralUserDb.ts",
        fn: "saveCentralUser",
        error: err.message || apiErrorMessage,
        stack: err.stack
      });
      throw new Error(apiErrorMessage || err.message || "Não foi possível salvar o perfil no Firestore.");
    }
  }

  // 3. Trigger auto-follow of official accounts in background with timeout (never block profile creation!)
  if (toSave.defaultFollowsInitialized !== true) {
    Promise.race([
      applyDefaultOfficialFollows(cleanId),
      new Promise(resolve => setTimeout(resolve, 4000))
    ]).catch(err => console.warn("[DEFAULT_FOLLOWS_BG_WARN]", err));
  }

  // 4. Atualizar o cache local do localStorage e invalidar caches de perfil para que /@username funcione imediatamente
  try {
    const saved = localStorage.getItem(CENTRAL_USERS_BACKUP_KEY);
    const list: CentralUser[] = saved ? JSON.parse(saved) : [];
    const idx = list.findIndex(u => (u.id === cleanId || u.uid === cleanId));
    const normalizedSaved = normalizeUserProfile(toSave);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...normalizedSaved };
    } else {
      list.unshift(normalizedSaved);
    }
    localStorage.setItem(CENTRAL_USERS_BACKUP_KEY, JSON.stringify(list));
    invalidateAllUserProfileCaches(cleanId, toSave.username, toSave.username, normalizedSaved);
  } catch (e: any) {
    console.error("Local cache update failed:", e.message);
  }
}

/**
 * Atualiza a foto do perfil central do usuário, propagando instantaneamente para todos os módulos.
 */
export async function updateCentralUserPhoto(userId: string, photoURL: string, type: 'photo' | 'cover' = 'photo'): Promise<void> {
  if (!userId) return;
  
  let activeAdminUid = '';
  try {
    const saved = localStorage.getItem('voxa_current_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      activeAdminUid = parsed.uid || parsed.id || '';
    }
  } catch (e) {}

  const updatePayload = type === 'cover' 
    ? { id: userId, coverUrl: photoURL, coverURL: photoURL }
    : { id: userId, photoURL, avatarUrl: photoURL };

  // Tentar atualizar via API do servidor (bypassa regras e sincroniza com o banco)
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (activeAdminUid) {
      headers["x-admin-uid"] = activeAdminUid;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch("/api/admin/users/update", {
        method: "POST",
        headers,
        body: JSON.stringify({
          user: updatePayload,
          adminUid: activeAdminUid
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Erro na API de foto");
    }
    console.log(`[USERS_API_SAVE_PHOTO] ${type === 'cover' ? 'Capa' : 'Foto'} atualizada via API com sucesso.`);
  } catch (apiErr: any) {
    console.warn(`[USERS_API_SAVE_PHOTO] Falha ao atualizar ${type} via API, usando fallback Firestore cliente:`, apiErr.message);
    try {
      const docRef = doc(db, 'users', userId);
      const fsPayload = type === 'cover'
        ? { coverUrl: photoURL, coverURL: photoURL, updatedAt: new Date().toISOString() }
        : { photoURL, avatarUrl: photoURL, updatedAt: new Date().toISOString() };
      await Promise.race([
        setDoc(docRef, fsPayload, { merge: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout ao salvar foto no Firestore.")), 6000))
      ]);
    } catch (err: any) {
      console.error("Firestore update user photo failed:", err);
      throw err;
    }
  }

  // Update local cache
  try {
    const saved = localStorage.getItem(CENTRAL_USERS_BACKUP_KEY);
    if (saved) {
      const list: CentralUser[] = JSON.parse(saved);
      const updated = list.map(u => (u.id === userId || u.uid === userId) 
        ? (type === 'cover' ? { ...u, coverUrl: photoURL, coverURL: photoURL } : { ...u, photoURL, avatarUrl: photoURL })
        : u
      );
      localStorage.setItem(CENTRAL_USERS_BACKUP_KEY, JSON.stringify(updated));
    }
    invalidateAllUserProfileCaches(userId, undefined, undefined, type === 'cover' ? { coverUrl: photoURL, coverURL: photoURL } : { photoURL, avatarUrl: photoURL });
  } catch (e) {}
}

/**
 * Define uma das fotos secundárias da galeria como a foto principal do perfil central.
 */
export async function setCentralUserMainPhoto(userId: string, targetPhotoUrl: string): Promise<void> {
  if (!userId || !targetPhotoUrl) return;
  const users = await fetchCentralUsers();
  const user = users.find(u => u.id === userId || u.uid === userId);
  if (!user) return;

  const currentMain = user.photoURL;
  const gallery = (user.galleryPhotos || []).filter(p => p !== targetPhotoUrl);
  if (currentMain && currentMain !== targetPhotoUrl && !gallery.includes(currentMain)) {
    gallery.unshift(currentMain);
  }

  user.photoURL = targetPhotoUrl;
  user.galleryPhotos = gallery.slice(0, 4);
  await saveCentralUser(user);
}

/**
 * Cria ou recupera um perfil central de pessoa sem forçar criação de credenciais de login.
 */
export async function findOrCreatePerson(
  data: {
    name: string;
    artisticName?: string;
    email?: string;
    phone?: string;
    photoURL?: string;
    role?: string;
    origin?: string;
    isArtist?: boolean;
    notes?: string;
  },
  existingUsers: CentralUser[]
): Promise<CentralUser> {
  const cleanName = (data.name || data.artisticName || '').trim();
  const normNewName = normalizePersonName(cleanName);

  // 1. Procurar correspondência existente
  for (const u of existingUsers) {
    const uName = normalizePersonName(u.name || '');
    const uArt = normalizePersonName(u.artisticName || '');
    if ((normNewName && uName === normNewName) || (normNewName && uArt === normNewName)) {
      return u;
    }
  }

  // 2. Criar novo perfil sem Auth (Perfil central desvinculado de login até convite)
  const newId = `user_prof_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const role = normalizeUserRole(data.role || (data.isArtist ? 'ARTISTA' : 'USUÁRIO COMUM'));
  const slug = generateUniqueSlug(cleanName, existingUsers, newId);

  const newUser: CentralUser = {
    id: newId,
    uid: newId,
    name: cleanName,
    slug,
    artisticName: data.artisticName?.trim() || cleanName,
    email: data.email?.trim() || '',
    phone: data.phone?.trim() || '',
    photoURL: data.photoURL || (data as any).avatarUrl || (data as any).photoUrl || (data as any).avatarURL || '',
    galleryPhotos: [],
    role,
    artistSpecialty: role === 'ARTISTA' ? 'DJ' : undefined,
    isAdmin: false,
    status: 'Ativo',
    accountStatus: 'SEM_ACESSO',
    hasAuth: false,
    origin: (data.origin as any) || 'music',
    isArtist: role === 'ARTISTA',
    notes: data.notes || '',
    referralCode: generateReferralCode(),
    leagueStatus: 'NÃO PARTICIPA',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await saveCentralUser(newUser);
  return newUser;
}

/**
 * Remove com segurança os registros atuais de pessoas dentro de:
 * - Music → Artistas (coleção `artists`)
 * - Music → Share Financeiro (coleção `lockdown_music_shares`)
 * - Music → Vozes Autorizadas (coleção `distribution_clearances`)
 * 
 * Preserva estritamente:
 * - Usuários já existentes no módulo Usuários
 * - Firebase Auth
 * - Pedidos e Vendas da Loja
 * - Produtos da Loja
 * - Ingressos e Shows
 * - Arquivos e dados de outros módulos
 */
export async function cleanMusicSubmodulesData(): Promise<{
  success: boolean;
  deletedArtists: number;
  deletedShares: number;
  deletedClearances: number;
}> {
  let deletedArtists = 0;
  let deletedShares = 0;
  let deletedClearances = 0;

  // 1. Limpar Artistas
  try {
    const artSnap = await getDocs(collection(db, 'artists'));
    for (const d of artSnap.docs) {
      try {
        await deleteDoc(doc(db, 'artists', d.id));
        deletedArtists++;
      } catch (e) {
        console.warn(`Erro ao deletar artista ${d.id}:`, e);
      }
    }
  } catch (e) {
    console.warn("Could not query artists from Firestore:", e);
  }
  localStorage.setItem('lockdown_music_artists', JSON.stringify([]));

  // 2. Limpar Share Financeiro
  try {
    const shareSnap = await getDocs(collection(db, 'lockdown_music_shares'));
    for (const d of shareSnap.docs) {
      try {
        await deleteDoc(doc(db, 'lockdown_music_shares', d.id));
        deletedShares++;
      } catch (e) {
        console.warn(`Erro ao deletar share ${d.id}:`, e);
      }
    }
  } catch (e) {
    console.warn("Could not query shares from Firestore:", e);
  }
  localStorage.setItem('lockdown_music_shares', JSON.stringify([]));

  // 3. Limpar Vozes Liberadas
  try {
    const clearSnap = await getDocs(collection(db, 'distribution_clearances'));
    for (const d of clearSnap.docs) {
      try {
        await deleteDoc(doc(db, 'distribution_clearances', d.id));
        deletedClearances++;
      } catch (e) {
        console.warn(`Erro ao deletar clearance ${d.id}:`, e);
      }
    }
  } catch (e) {
    console.warn("Could not query clearances from Firestore:", e);
  }
  localStorage.setItem('lockdown_distribution_clearance', JSON.stringify([]));

  return {
    success: true,
    deletedArtists,
    deletedShares,
    deletedClearances
  };
}

/**
 * Gera um convite seguro para o usuário criar sua senha na Lockdown.
 */
export async function generateUserInvite(params: {
  userId: string;
  email: string;
  phone?: string;
  name: string;
  artisticName?: string;
  role?: string;
}): Promise<{
  token: string;
  inviteUrl: string;
  whatsappText: string;
}> {
  try {
    const res = await fetch('/api/admin/users/generate-activation-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId: params.userId,
        email: params.email,
        phone: params.phone
      })
    });

    if (res.ok) {
      const data = await res.json();
      const inviteUrl = `${window.location.origin}${data.activationUrl}`;
      const whatsappText = `Olá ${params.artisticName || params.name}! Seu perfil na VOXA foi criado. Acesse o link abaixo para definir seu e-mail, senha e ativar seu acesso:\n\n${inviteUrl}`;
      return {
        token: data.token,
        inviteUrl,
        whatsappText
      };
    }
  } catch (err) {
    console.warn("Backend /api/admin/users/generate-activation-token call failed, using client fallback:", err);
  }

  // Fallback client-side token generation
  const token = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  const inviteUrl = `${window.location.origin}/activate-account?token=${token}`;
  const whatsappText = `Olá ${params.artisticName || params.name}! Seu perfil na VOXA foi criado. Acesse o link abaixo para definir sua senha de acesso e ativar sua conta:\n\n${inviteUrl}`;

  const inviteDoc: UserInvite = {
    id: token,
    token,
    userId: params.userId,
    email: params.email,
    phone: params.phone,
    name: params.name,
    artisticName: params.artisticName,
    role: params.role,
    status: 'pending',
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    createdAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'user_invites', token), inviteDoc);
    await updateDoc(doc(db, 'users', params.userId), {
      accountStatus: 'INVITED',
      status: 'INVITED',
      inviteToken: token,
      inviteEmail: params.email,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn("Could not persist invite in Firestore:", e);
  }

  return { token, inviteUrl, whatsappText };
}

/**
 * Executa a auditoria e unificação automática das pessoas de todos os módulos para a coleção `users`.
 */
export async function executeCentralIdentityMigration(): Promise<{
  success: boolean;
  stats: {
    totalUsersBefore: number;
    newUsersCreated: number;
    artistsLinked: number;
    sharesLinked: number;
    clearancesLinked: number;
  };
  logs: string[];
}> {
  const logs: string[] = [];
  const stats = {
    totalUsersBefore: 0,
    newUsersCreated: 0,
    artistsLinked: 0,
    sharesLinked: 0,
    clearancesLinked: 0
  };

  try {
    // Carregar usuários existentes
    const currentUsers = await fetchCentralUsers();
    stats.totalUsersBefore = currentUsers.length;
    const existingUsersMap = new Map<string, CentralUser>();
    currentUsers.forEach(u => existingUsersMap.set(u.id || u.uid || '', u));

    const findOrCreateUserClient = async (
      name: string,
      photoURL: string,
      role: string,
      origin: string,
      email?: string
    ): Promise<string | null> => {
      const cleanName = (name || '').trim();
      const norm = normalizePersonName(cleanName);
      if (!norm) return null;

      // Buscar por nome exato, artístico ou email
      for (const [uid, u] of existingUsersMap.entries()) {
        const uNorm = normalizePersonName(u.name || '');
        const artNorm = normalizePersonName(u.artisticName || '');
        const uEmail = (u.email || '').toLowerCase().trim();

        if (uNorm === norm || artNorm === norm || (email && uEmail === email.toLowerCase().trim())) {
          if (!u.photoURL && photoURL) {
            u.photoURL = photoURL;
            try {
              await updateCentralUserPhoto(uid, photoURL);
              logs.push(`Foto central atualizada para usuário existente: "${u.name}"`);
            } catch (e) {}
          }
          return uid;
        }
      }

      // Se não encontrou, criar novo perfil central
      const newId = `user_prof_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const normalizedRole = normalizeUserRole(role);
      const slug = generateUniqueSlug(cleanName, Array.from(existingUsersMap.values()), newId);

      const newUserDoc: CentralUser = {
        id: newId,
        uid: newId,
        name: cleanName,
        slug,
        artisticName: cleanName,
        email: email || '',
        photoURL: photoURL || '',
        galleryPhotos: [],
        role: normalizedRole,
        artistSpecialty: normalizedRole === 'ARTISTA' ? 'DJ' : undefined,
        isAdmin: false,
        status: 'Ativo',
        accountStatus: email ? 'CONVITE_PENDENTE' : 'SEM_ACESSO',
        hasAuth: false,
        origin: (origin as any) || 'migration',
        isArtist: normalizedRole === 'ARTISTA',
        notes: `Criado automaticamente pela ferramenta de migração a partir do módulo ${origin}.`,
        referralCode: generateReferralCode(),
        leagueStatus: 'NÃO PARTICIPA',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        await saveCentralUser(newUserDoc);
        existingUsersMap.set(newId, newUserDoc);
        stats.newUsersCreated++;
        logs.push(`Novo perfil central criado: "${cleanName}" (ID: ${newId})`);
        return newId;
      } catch (err: any) {
        logs.push(`Aviso ao criar usuário para "${cleanName}": ${err.message || err}`);
        return null;
      }
    };

    // A. Migrar Artistas (coleção `artists`)
    try {
      const artSnap = await getDocs(collection(db, 'artists'));
      for (const d of artSnap.docs) {
        const artist = d.data();
        const artistId = d.id;
        const artistName = artist.name || artist.artistName || '';
        const photo = artist.image || artist.photoUrl || artist.avatar || '';

        if (artistName) {
          let linkedUserId = artist.userId;
          if (!linkedUserId || !existingUsersMap.has(linkedUserId)) {
            linkedUserId = await findOrCreateUserClient(artistName, photo, 'ARTISTA', 'Music (Artistas)');
            if (linkedUserId) {
              try {
                await updateDoc(doc(db, 'artists', artistId), {
                  userId: linkedUserId,
                  updatedAt: new Date().toISOString()
                });
                stats.artistsLinked++;
                logs.push(`Artista "${artistName}" vinculado ao perfil central ${linkedUserId}`);
              } catch (e: any) {
                logs.push(`Aviso ao vincular artista ${artistName}: ${e.message}`);
              }
            }
          }
        }
      }
    } catch (e: any) {
      logs.push(`Aviso na migração de Artistas: ${e.message}`);
    }

    // B. Migrar Share Financeiro (coleção `lockdown_music_shares`)
    try {
      const shareSnap = await getDocs(collection(db, 'lockdown_music_shares'));
      for (const d of shareSnap.docs) {
        const share = d.data();
        const shareId = d.id;
        const name = share.artistName || '';
        const photo = share.artistPhoto || '';
        const paymentEmail = share.paymentEmail || share.artistEmail || '';

        if (name) {
          let linkedUserId = share.userId;
          if (!linkedUserId || !existingUsersMap.has(linkedUserId)) {
            linkedUserId = await findOrCreateUserClient(name, photo, 'ARTISTA', 'Share Financeiro', paymentEmail);
            if (linkedUserId) {
              try {
                await updateDoc(doc(db, 'lockdown_music_shares', shareId), {
                  userId: linkedUserId,
                  updatedAt: new Date().toISOString()
                });
                stats.sharesLinked++;
                logs.push(`Share Financeiro de "${name}" vinculado ao perfil central ${linkedUserId}`);
              } catch (e: any) {
                logs.push(`Aviso ao vincular share de ${name}: ${e.message}`);
              }
            }
          }
        }
      }
    } catch (e: any) {
      logs.push(`Aviso na migração de Share Financeiro: ${e.message}`);
    }

    // C. Migrar Vozes Liberadas (coleção `distribution_clearances`)
    try {
      const clearSnap = await getDocs(collection(db, 'distribution_clearances'));
      for (const d of clearSnap.docs) {
        const clearance = d.data();
        const clearanceId = d.id;
        const name = clearance.artistName || '';
        const photo = clearance.image || '';

        if (name) {
          let linkedUserId = clearance.userId;
          if (!linkedUserId || !existingUsersMap.has(linkedUserId)) {
            linkedUserId = await findOrCreateUserClient(name, photo, 'ARTISTA', 'Vozes Liberadas');
            if (linkedUserId) {
              try {
                await updateDoc(doc(db, 'distribution_clearances', clearanceId), {
                  userId: linkedUserId,
                  updatedAt: new Date().toISOString()
                });
                stats.clearancesLinked++;
                logs.push(`Voz Liberada de "${name}" vinculada ao perfil central ${linkedUserId}`);
              } catch (e: any) {
                logs.push(`Aviso ao vincular voz de ${name}: ${e.message}`);
              }
            }
          }
        }
      }
    } catch (e: any) {
      logs.push(`Aviso na migração de Vozes Liberadas: ${e.message}`);
    }

    // Atualizar cache local
    const finalUsers = Array.from(existingUsersMap.values());
    localStorage.setItem(CENTRAL_USERS_BACKUP_KEY, JSON.stringify(finalUsers));

    logs.push("Processo de migração e consolidação de identidades concluído com sucesso.");
    return {
      success: true,
      stats,
      logs
    };
  } catch (err: any) {
    console.error("[Client Identity Migration Error]", err);
    throw new Error(err.message || "Erro durante a unificação de identidades.");
  }
}
