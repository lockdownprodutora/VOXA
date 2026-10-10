import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Search, Filter, Shield, UserCheck, UserX, Mail, Calendar, Award, 
  ShoppingBag, Music, Ticket, ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, Eye,
  Plus, Edit, Trash2, X, Upload, HardDrive, Settings, DollarSign, FileCheck, Check,
  Link, Link2, Key, User, Send, Share2, Copy, Sparkles, AlertTriangle, ExternalLink,
  Trophy, Star, Phone, MapPin, Lock, FileText, Image as ImageIcon, Flame, ChevronRight, Zap, ShieldCheck
} from 'lucide-react';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { doc, setDoc, getDoc, getDocFromServer, collection, getDocs, updateDoc, deleteDoc, addDoc, onSnapshot } from 'firebase/firestore';
import { uploadFile } from '../../utils/upload';
import { CentralUser, UserInvite, UserRole, ArtistSpecialty, LeagueStatus, PersonalData, DeliveryAddress } from '../../types';
import { 
  fetchCentralUsers, 
  saveCentralUser, 
  updateCentralUserPhoto, 
  generateUserInvite,
  executeCentralIdentityMigration,
  cleanMusicSubmodulesData,
  normalizeUserRole,
  generateSlug,
  generateUniqueSlug,
  generateReferralCode,
  isLastFetchFromCache
} from '../../utils/centralUserDb';
import { isFirestoreQuotaThrottled, handleFirestoreError } from '../../utils/storeDb';
import { adjustLeaguePoints, saveLeagueParticipant } from '../../utils/leagueDb';
import { UserCard } from '../common/UserCard';

interface UsersModuleProps {
  onBackToMenu: () => void;
  currentAdminRole?: 'SUPER_ADMIN' | 'ADMINISTRATOR' | 'MANAGER' | 'SUPPORT' | 'NONE';
}

export const UsersModule: React.FC<UsersModuleProps> = ({ onBackToMenu, currentAdminRole }) => {
  const [users, setUsers] = useState<CentralUser[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [shares, setShares] = useState<any[]>([]);
  const [clearances, setClearances] = useState<any[]>([]);
  const [profileCategories, setProfileCategories] = useState<any[]>([]);

  // Category CRUD states
  const [isCategoryCrudOpen, setIsCategoryCrudOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [catNameInput, setCatNameInput] = useState('');
  const [catActiveInput, setCatActiveInput] = useState(true);
  const [catOrderInput, setCatOrderInput] = useState('0');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [accountStatusFilter, setAccountStatusFilter] = useState('ALL');
  const [usersViewTab, setUsersViewTab] = useState<'banco' | 'cards' | 'audit_logs'>('banco');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [currentActorRole, setCurrentActorRole] = useState<'SUPER_ADMIN' | 'ADMINISTRATOR' | 'MANAGER' | 'SUPPORT' | 'NONE'>(currentAdminRole || 'SUPER_ADMIN');
  
  // Modal states
  const [selectedUser, setSelectedUser] = useState<CentralUser | null>(null);
  const [editTab, setEditTab] = useState<'profile' | 'private_data' | 'league' | 'modules'>('profile');
  const [showRemovePhotoConfirm, setShowRemovePhotoConfirm] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'profile_no_auth' | 'with_auth'>('profile_no_auth');
  
  // Invite modal state
  const [inviteModalUser, setInviteModalUser] = useState<CentralUser | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [generatedInvite, setGeneratedInvite] = useState<{ token: string; inviteUrl: string; whatsappText: string } | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Migration modal state
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResults, setMigrationResults] = useState<{ stats: any; logs: string[] } | null>(null);

  // Clean submodules modal state
  const [isCleanModalOpen, setIsCleanModalOpen] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanResults, setCleanResults] = useState<{ deletedArtists: number; deletedShares: number; deletedClearances: number } | null>(null);

  // Destructive Cleanup & System Audit States
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditReport, setAuditReport] = useState<any>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupLogs, setCleanupLogs] = useState<string[] | null>(null);
  const [cleanupConfirmInput, setCleanupConfirmInput] = useState('');

  const runAuditReport = async () => {
    setIsAuditing(true);
    setAuditReport(null);
    try {
      const res = await fetch("/api/admin/users/audit");
      const data = await res.json();
      if (data.success) {
        setAuditReport(data);
      } else {
        setErrorMsg(data.error || "Falha ao executar auditoria.");
      }
    } catch (err: any) {
      setErrorMsg("Erro ao conectar com servidor de auditoria.");
    } finally {
      setIsAuditing(false);
    }
  };

  const executeSystemCleanup = async () => {
    if (cleanupConfirmInput !== "EXCLUIR_DEFINITIVAMENTE") {
      setErrorMsg("Código de confirmação de segurança inválido.");
      return;
    }
    setIsCleaningUp(true);
    setCleanupLogs(null);
    try {
      const res = await fetch("/api/admin/users/execute-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "EXCLUIR_DEFINITIVAMENTE" })
      });
      const data = await res.json();
      if (data.success) {
        setCleanupLogs(data.logs);
        setSuccessMsg(`Limpeza concluída! ${data.authDeletedCount} Auth e ${data.firestoreDeletedCount} Firestore deletados.`);
        loadAllData();
      } else {
        setErrorMsg(data.error || "Falha ao executar a limpeza.");
      }
    } catch (err: any) {
      setErrorMsg("Erro de rede ao executar limpeza.");
    } finally {
      setIsCleaningUp(false);
    }
  };

  // Points adjustment inline state inside modal
  const [isAdjustingPoints, setIsAdjustingPoints] = useState(false);
  const [pointsChangeInput, setPointsChangeInput] = useState(50);
  const [pointsReasonInput, setPointsReasonInput] = useState('');

  // Loading & Toast states
  const [isLoading, setIsLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Create User Form fields (Only `name` and `username` are required for PRE_REGISTERED!)
  const [createForm, setCreateForm] = useState<{
    name: string;
    artisticName: string;
    username: string;
    email: string;
    password: string;
    phone: string;
    bio: string;
    isVerified: boolean;
    role: UserRole;
    artistSpecialty: ArtistSpecialty;
    isAdmin: boolean;
    photoURL: string;
    coverUrl: string;
    galleryPhotos: string[];
    notes: string;
    adminRole: string;
    categoryId: string;
  }>({
    name: '',
    artisticName: '',
    username: '',
    email: '',
    password: '',
    phone: '',
    bio: '',
    isVerified: true,
    role: 'USUÁRIO COMUM',
    artistSpecialty: 'DJ',
    isAdmin: false,
    photoURL: '',
    coverUrl: '',
    galleryPhotos: [],
    notes: '',
    adminRole: 'NONE',
    categoryId: ''
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const [coverUploadStatus, setCoverUploadStatus] = useState('');
  const [localAdminAvatarPreview, setLocalAdminAvatarPreview] = useState<string | null>(null);
  const [localCreateAvatarPreview, setLocalCreateAvatarPreview] = useState<string | null>(null);
  const [localCreateCoverPreview, setLocalCreateCoverPreview] = useState<string | null>(null);
  const [localAdminCoverPreview, setLocalAdminCoverPreview] = useState<string | null>(null);
  const [uploadAdminAvatarError, setUploadAdminAvatarError] = useState<string | null>(null);
  const [modalErrorMsg, setModalErrorMsg] = useState('');

  // Edit User Form fields
  const [editForm, setEditForm] = useState<{
    name: string;
    artisticName: string;
    slug: string;
    email: string;
    phone: string;
    role: UserRole;
    artistSpecialty: ArtistSpecialty;
    isAdmin: boolean;
    isVerified: boolean;
    status: 'Ativo' | 'Inativo' | 'Cadastro incompleto' | 'Aguardando credenciais' | 'Suspenso' | 'PRE_REGISTERED';
    accountStatus: 'SEM_ACESSO' | 'CONVITE_PENDENTE' | 'CONTA_ATIVA' | 'PRE_REGISTERED';
    photoURL: string;
    coverUrl: string;
    bio: string;
    galleryPhotos: string[];
    notes: string;
    personalData: PersonalData;
    deliveryAddress: DeliveryAddress;
    referralCode: string;
    leagueStatus: LeagueStatus;
    leagueDivision: number;
    leaguePoints: number;
    lifetimePoints: number;
    adminRole: string;
    categoryId: string;
  }>({
    name: '',
    artisticName: '',
    slug: '',
    email: '',
    phone: '',
    role: 'USUÁRIO COMUM',
    artistSpecialty: 'DJ',
    isAdmin: false,
    isVerified: true,
    status: 'Ativo',
    accountStatus: 'SEM_ACESSO',
    photoURL: '',
    coverUrl: '',
    bio: '',
    galleryPhotos: [],
    notes: '',
    personalData: {},
    deliveryAddress: {},
    referralCode: '',
    leagueStatus: 'NÃO PARTICIPA',
    leagueDivision: 10,
    leaguePoints: 0,
    lifetimePoints: 0,
    adminRole: 'NONE',
    categoryId: ''
  });
  const [isSavingUser, setIsSavingUser] = useState(false);

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      artisticName: '',
      username: '',
      email: '',
      password: '',
      phone: '',
      bio: '',
      isVerified: true,
      role: 'USUÁRIO COMUM',
      artistSpecialty: 'DJ',
      isAdmin: false,
      photoURL: '',
      coverUrl: '',
      galleryPhotos: [],
      notes: '',
      adminRole: 'NONE',
      categoryId: ''
    });
    setLocalCreateAvatarPreview(null);
    setLocalCreateCoverPreview(null);
    setUploadAdminAvatarError(null);
    setModalErrorMsg('');
  };

  const loadAllData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    console.log("[USERS_LOAD_START] Starting loadAllData process...");
    
    try {
      // 1. Fetch Central Users with fallback / timeout protection inside fetchCentralUsers
      const userList = await fetchCentralUsers();
      setUsers(userList);
      setIsCached(isLastFetchFromCache);

      // Helper function to fetch standard Firestore collection with absolute 4-second timeout
      const fetchWithTimeout = async (collectionName: string, cacheKey: string, setFn: (data: any[]) => void) => {
        try {
          if (!isFirestoreQuotaThrottled()) {
            const q = collection(db, collectionName);
            const getPromise = getDocs(q);
            const timeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error(`${collectionName} fetch timed out`)), 4000)
            );

            const snap = await Promise.race([getPromise, timeoutPromise]) as any;
            const list: any[] = [];
            snap.forEach((d: any) => list.push({ id: d.id, ...d.data() }));
            localStorage.setItem(cacheKey, JSON.stringify(list));
            setFn(list);
          } else {
            throw new Error('Quota throttled');
          }
        } catch (err: any) {
          console.warn(`[USERS_API_ERROR] Failed/timed out loading ${collectionName}:`, err.message);
          handleFirestoreError(collectionName, err);
          try {
            const saved = localStorage.getItem(cacheKey);
            if (saved) setFn(JSON.parse(saved));
          } catch (e) {}
        }
      };

      // 2. Fetch Artists
      await fetchWithTimeout('artists', 'lockdown_music_artists', setArtists);

      // 3. Fetch Financial Shares
      await fetchWithTimeout('lockdown_music_shares', 'lockdown_music_shares_cache', setShares);

      // 4. Fetch Distribution Clearances
      await fetchWithTimeout('distribution_clearances', 'lockdown_distribution_clearances_cache', setClearances);

      // 5. Fetch Profile Categories
      await fetchWithTimeout('profile_categories', 'lockdown_profile_categories_cache', setProfileCategories);

      // 6. Fetch Admin Audit Logs
      await fetchWithTimeout('admin_audit_logs', 'lockdown_admin_audit_logs_cache', (logs) => {
        const sorted = [...logs].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        setAuditLogs(sorted);
      });

      // 7. Resolve Current Actor Role from canonical admin_users/{uid}
      try {
        const saved = localStorage.getItem('voxa_current_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          const actorUid = parsed.uid || parsed.id || '';
          const actorEmail = String(parsed.email || '').toLowerCase().trim();
          const isBootstrappedSuper =
            actorEmail === 'lockdownprodutora@gmail.com' ||
            actorEmail === 'admin@lockdownprodutora.com.br' ||
            actorEmail.endsWith('@lockdownprodutora.com.br') ||
            actorUid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' ||
            actorUid === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1';

          if (actorUid && isFirebaseConfigured()) {
            const snap = await getDoc(doc(db, 'admin_users', actorUid));
            if (snap.exists()) {
              const r = String(snap.data()?.role || '').toUpperCase().trim();
              if (['SUPER_ADMIN', 'ADMINISTRATOR', 'MANAGER', 'SUPPORT'].includes(r)) {
                setCurrentActorRole(r as any);
              } else if (isBootstrappedSuper) {
                setCurrentActorRole('SUPER_ADMIN');
              }
            } else if (isBootstrappedSuper) {
              setCurrentActorRole('SUPER_ADMIN');
            }
          } else if (isBootstrappedSuper) {
            setCurrentActorRole('SUPER_ADMIN');
          }
        }
      } catch (e) {}

      console.log("[USERS_RENDER_SUCCESS] All datasets fetched and loaded successfully.");
    } catch (err: any) {
      console.error("[USERS_API_ERROR] Critical error inside loadAllData:", err.message);
      setErrorMsg("Não foi possível carregar os usuários. Tente novamente.");
    } finally {
      setIsLoading(false);
      console.log("[USERS_LOADING_END] loadAllData process completed.");
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Real-time snapshot listener on admin_users and admin_audit_logs for immediate role & route revalidation
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const unsubAdminUsers = onSnapshot(
      collection(db, 'admin_users'),
      (snapshot) => {
        const rolesMap = new Map<string, string>();
        snapshot.forEach((docSnap) => {
          const r = docSnap.data()?.role;
          if (r) {
            rolesMap.set(docSnap.id, String(r).toUpperCase().trim());
          }
        });

        setUsers((prevUsers) => {
          if (!prevUsers || prevUsers.length === 0) return prevUsers;
          return prevUsers.map((u) => {
            const uid = String(u.uid || u.id || '');
            const email = String(u.email || '').toLowerCase().trim();
            const isBootstrappedSuper =
              email === 'lockdownprodutora@gmail.com' ||
              email === 'admin@lockdownprodutora.com.br' ||
              email.endsWith('@lockdownprodutora.com.br') ||
              uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' ||
              uid === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1';

            const snapRole = rolesMap.get(uid);
            const resolvedRole = snapRole
              ? snapRole
              : (isBootstrappedSuper ? 'SUPER_ADMIN' : 'NONE');

            return {
              ...u,
              adminRole: resolvedRole,
              isAdmin: ['SUPER_ADMIN', 'ADMINISTRATOR'].includes(resolvedRole)
            };
          });
        });

        // Also revalidate currentActorRole if current logged-in user is in snapshot
        try {
          const saved = localStorage.getItem('voxa_current_user');
          if (saved) {
            const parsed = JSON.parse(saved);
            const actorUid = String(parsed.uid || parsed.id || '');
            const actorEmail = String(parsed.email || '').toLowerCase().trim();
            const isBootstrappedSuper =
              actorEmail === 'lockdownprodutora@gmail.com' ||
              actorEmail === 'admin@lockdownprodutora.com.br' ||
              actorEmail.endsWith('@lockdownprodutora.com.br') ||
              actorUid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' ||
              actorUid === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1';

            const actorSnapRole = rolesMap.get(actorUid);
            if (actorSnapRole && ['SUPER_ADMIN', 'ADMINISTRATOR', 'MANAGER', 'SUPPORT'].includes(actorSnapRole)) {
              setCurrentActorRole(actorSnapRole as any);
            } else if (isBootstrappedSuper) {
              setCurrentActorRole('SUPER_ADMIN');
            } else if (actorUid) {
              setCurrentActorRole('NONE');
            }
          }
        } catch {}
      },
      (err) => {
        console.warn('[ADMIN_USERS_SNAPSHOT_WARN]', err.message);
      }
    );

    const unsubAuditLogs = onSnapshot(
      collection(db, 'admin_audit_logs'),
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        setAuditLogs(list);
      },
      () => {}
    );

    return () => {
      unsubAdminUsers();
      unsubAuditLogs();
    };
  }, []);

  // CRUD Profile Categories
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameInput.trim()) {
      alert("Por favor, digite o nome da categoria.");
      return;
    }
    setIsSavingCategory(true);
    try {
      const activeAdminUid = localStorage.getItem('voxa_current_user') 
        ? JSON.parse(localStorage.getItem('voxa_current_user')!).uid 
        : 'admin';
      
      const endpoint = editingCategory 
        ? "/api/admin/categories/update" 
        : "/api/admin/categories/create";

      const payload = {
        adminUid: activeAdminUid,
        id: editingCategory?.id,
        name: catNameInput.trim(),
        active: catActiveInput,
        order: Number(catOrderInput) || 0
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success) {
        alert(editingCategory ? "Categoria atualizada com sucesso!" : "Categoria criada com sucesso!");
        setCatNameInput('');
        setCatOrderInput('0');
        setCatActiveInput(true);
        setEditingCategory(null);
        // Reload fresh categories
        const catRes = await fetch("/api/admin/categories");
        const catData = await catRes.json();
        if (catData.success) {
          setProfileCategories(catData.categories || []);
        }
      } else {
        alert(data.error || "Erro ao salvar categoria.");
      }
    } catch (err: any) {
      alert("Erro de conexão ao salvar categoria.");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!window.confirm("Confirma excluir esta categoria de perfil?")) {
      return;
    }
    try {
      const activeAdminUid = localStorage.getItem('voxa_current_user') 
        ? JSON.parse(localStorage.getItem('voxa_current_user')!).uid 
        : 'admin';

      const response = await fetch("/api/admin/categories/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminUid: activeAdminUid, id: catId })
      });
      const data = await response.json();
      if (data.success) {
        alert(data.message || "Categoria excluída com sucesso.");
        // Reload fresh categories
        const catRes = await fetch("/api/admin/categories");
        const catData = await catRes.json();
        if (catData.success) {
          setProfileCategories(catData.categories || []);
        }
      } else {
        alert(data.error || "Erro ao excluir categoria.");
      }
    } catch (err: any) {
      alert("Erro de conexão ao excluir categoria.");
    }
  };

  // Sync edit form when a user is selected
  useEffect(() => {
    if (selectedUser) {
      setEditForm({
        name: selectedUser.name || '',
        artisticName: selectedUser.artisticName || '',
        slug: selectedUser.slug || generateSlug(selectedUser.name || ''),
        email: selectedUser.email || '',
        phone: selectedUser.phone || '',
        role: normalizeUserRole(selectedUser.role),
        artistSpecialty: selectedUser.artistSpecialty || 'DJ',
        isAdmin: selectedUser.isAdmin === true,
        isVerified: selectedUser.isVerified !== undefined ? Boolean(selectedUser.isVerified) : true,
        status: (selectedUser.status as any) || 'Ativo',
        accountStatus: (selectedUser.accountStatus as any) || 'SEM_ACESSO',
        photoURL: selectedUser.photoURL || selectedUser.avatarUrl || '',
        coverUrl: selectedUser.coverUrl || selectedUser.coverURL || '',
        bio: selectedUser.bio || '',
        galleryPhotos: selectedUser.galleryPhotos || [],
        notes: selectedUser.notes || '',
        personalData: selectedUser.personalData || {},
        deliveryAddress: selectedUser.deliveryAddress || {},
        referralCode: selectedUser.referralCode || generateReferralCode(),
        leagueStatus: selectedUser.leagueStatus || 'NÃO PARTICIPA',
        leagueDivision: selectedUser.leagueDivision || 10,
        leaguePoints: selectedUser.leaguePoints || 0,
        lifetimePoints: selectedUser.lifetimePoints || 0,
        adminRole: (selectedUser as any).adminRole || 'NONE',
        categoryId: (selectedUser as any).categoryId || ''
      });
      setModalErrorMsg('');
      setUploadAdminAvatarError(null);
      setLocalAdminAvatarPreview(null);
      setLocalAdminCoverPreview(null);
      setEditTab('profile');
    }
  }, [selectedUser]);

  // Create User Submit
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalErrorMsg('');
    setErrorMsg('');

    if (!createForm.name.trim()) {
      const msg = "O campo 'NOME DE USUÁRIO' é obrigatório.";
      setModalErrorMsg(msg);
      return;
    }

    const rawUsername = createForm.username.trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_.]/g, '');
    if (!rawUsername || rawUsername.length < 2) {
      const msg = "O campo '@USERNAME' é obrigatório e deve ter pelo menos 2 caracteres válidos.";
      setModalErrorMsg(msg);
      return;
    }

    if (createMode === 'with_auth' && (!createForm.email.trim() || !createForm.password || createForm.password.length < 6)) {
      const msg = "E-mail válido e senha (mínimo 6 caracteres) são obrigatórios para contas com login.";
      setModalErrorMsg(msg);
      return;
    }

    // Check username uniqueness against loaded users
    const usernameConflict = users.some(
      u => (String(u.username || '').toLowerCase() === rawUsername || String(u.slug || '').toLowerCase() === rawUsername)
    );
    if (usernameConflict) {
      const msg = `Não foi possível criar o perfil: o @${rawUsername} já está em uso por outro usuário.`;
      setModalErrorMsg(msg);
      return;
    }

    setIsCreatingUser(true);
    try {
      const newId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const cleanName = createForm.name.trim();
      const slug = rawUsername || generateUniqueSlug(cleanName, users, newId);
      const referralCode = generateReferralCode();
      const normalizedRole = normalizeUserRole(createForm.role);

      const matchedCategory = profileCategories.find(c => c.id === createForm.categoryId);
      const categoryName = createForm.categoryId === 'NONE' || !createForm.categoryId ? 'Sem categoria' : (matchedCategory ? matchedCategory.name : 'Sem categoria');

      if (createMode === 'with_auth') {
        const res = await fetch('/api/admin/users/create-with-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cleanName,
            artisticName: `@${rawUsername}`,
            username: rawUsername,
            slug,
            email: createForm.email.trim().toLowerCase(),
            password: createForm.password,
            phone: createForm.phone?.trim() || '',
            photoURL: createForm.photoURL || '',
            coverUrl: createForm.coverUrl || '',
            bio: createForm.bio?.trim() || '',
            isVerified: Boolean(createForm.isVerified),
            role: normalizedRole,
            isAdmin: createForm.adminRole !== 'NONE' && createForm.adminRole !== '',
            adminRole: createForm.adminRole || 'NONE',
            categoryId: createForm.categoryId === 'NONE' ? '' : createForm.categoryId,
            categoryName,
            origin: 'admin',
            notes: createForm.notes || ''
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Não foi possível criar a conta com login.');
        }
        const createdAuthUser = {
          ...data.user,
          username: rawUsername,
          slug,
          avatarUrl: createForm.photoURL || '',
          coverUrl: createForm.coverUrl || '',
          coverURL: createForm.coverUrl || '',
          bio: createForm.bio?.trim() || '',
          isVerified: Boolean(createForm.isVerified),
          verified: Boolean(createForm.isVerified),
          categoryId: createForm.categoryId === 'NONE' ? '' : createForm.categoryId,
          categoryName
        };
        await saveCentralUser(createdAuthUser, createForm.adminRole, createForm.categoryId);
      } else {
        const newUser: any = {
          id: newId,
          uid: newId,
          name: cleanName,
          artisticName: `@${rawUsername}`,
          username: rawUsername,
          slug,
          email: '',
          phone: createForm.phone?.trim() || '',
          photoURL: createForm.photoURL || '',
          avatarUrl: createForm.photoURL || '',
          coverUrl: createForm.coverUrl || '',
          coverURL: createForm.coverUrl || '',
          bio: createForm.bio?.trim() || '',
          isVerified: Boolean(createForm.isVerified),
          verified: Boolean(createForm.isVerified),
          features: {},
          highlights: [],
          galleryPhotos: createForm.galleryPhotos || [],
          role: normalizedRole,
          artistSpecialty: undefined,
          isAdmin: createForm.adminRole !== 'NONE' && createForm.adminRole !== '',
          adminRole: createForm.adminRole || 'NONE',
          categoryId: createForm.categoryId === 'NONE' ? '' : createForm.categoryId,
          categoryName: categoryName,
          status: 'PRE_REGISTERED',
          accountStatus: 'PRE_REGISTERED',
          hasAuth: false,
          origin: 'admin',
          isArtist: false,
          notes: createForm.notes || '',
          referralCode,
          followersCount: 0,
          followingCount: 0,
          leagueStatus: 'NÃO PARTICIPA',
          leagueDivision: 10,
          leaguePoints: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await saveCentralUser(newUser, createForm.adminRole, createForm.categoryId);

        // Immediately add to local state so list updates even before loadAllData finishes
        setUsers(prev => {
          const exists = prev.some(u => u.id === newId || u.uid === newId);
          return exists ? prev : [newUser, ...prev];
        });
      }

      setIsCached(false);
      setSuccessMsg(
        createMode === 'with_auth'
          ? `Conta e perfil @${rawUsername} criados com sucesso!`
          : `Perfil público @${rawUsername} criado com sucesso! Link: ${window.location.origin}/@${rawUsername}`
      );
      setIsCreateModalOpen(false);
      resetCreateForm();
      await loadAllData();
    } catch (err: any) {
      console.error("[ADMIN_CREATE_PROFILE_ERROR]", {
        file: "src/components/admin/UsersModule.tsx",
        fn: "handleCreateUserSubmit",
        error: err?.message || String(err),
        stack: err?.stack
      });
      const visibleErr = err?.message || 'Não foi possível criar o perfil.';
      setModalErrorMsg(`Não foi possível criar o perfil: ${visibleErr}`);
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Edit User Submit
  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalErrorMsg('');
    setErrorMsg('');

    if (!selectedUser) return;
    if (!editForm.name.trim()) {
      setModalErrorMsg("O nome é obrigatório.");
      return;
    }

    const prevAdminRole = String(selectedUser.adminRole || 'NONE').toUpperCase().trim();
    const nextAdminRole = String(editForm.adminRole || 'NONE').toUpperCase().trim();
    const roleChanged = prevAdminRole !== nextAdminRole;

    if (roleChanged) {
      if (!['SUPER_ADMIN', 'ADMINISTRATOR'].includes(currentActorRole)) {
        setModalErrorMsg("Acesso negado: Você não possui permissão para alterar cargos administrativos.");
        return;
      }
      if ((nextAdminRole === 'SUPER_ADMIN' || prevAdminRole === 'SUPER_ADMIN') && currentActorRole !== 'SUPER_ADMIN') {
        setModalErrorMsg("Apenas um SUPER_ADMIN autorizado pode promover ou alterar o cargo SUPER_ADMIN.");
        return;
      }
    }

    setIsSavingUser(true);
    setSuccessMsg('');
    try {
      const targetUid = String(selectedUser.uid || selectedUser.id || '');
      if (!targetUid) {
        throw new Error("UID do usuário inválido.");
      }

      const normalizedRole = normalizeUserRole(editForm.role);
      const cleanSlug = (editForm.slug || '').trim().replace(/^@+/, '').toLowerCase();
      const slug = cleanSlug ? generateUniqueSlug(cleanSlug, users, selectedUser.id) : generateUniqueSlug(editForm.name, users, selectedUser.id);

      const matchedCategory = profileCategories.find(c => c.id === editForm.categoryId);
      const categoryName = editForm.categoryId === 'NONE' || !editForm.categoryId ? 'Sem categoria' : (matchedCategory ? matchedCategory.name : 'Sem categoria');

      const updatedUser: CentralUser = {
        ...selectedUser,
        name: editForm.name.trim(),
        artisticName: editForm.artisticName.trim() || `@${slug}`,
        username: slug,
        slug,
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        role: ['ADMINISTRATOR', 'SUPER_ADMIN'].includes(nextAdminRole) ? 'ADMINISTRADOR' : (normalizedRole === 'ADMINISTRADOR' ? 'USUÁRIO COMUM' : normalizedRole),
        artistSpecialty: undefined,
        isAdmin: ['ADMINISTRATOR', 'SUPER_ADMIN'].includes(nextAdminRole),
        isVerified: Boolean(editForm.isVerified),
        verified: Boolean(editForm.isVerified),
        adminRole: nextAdminRole,
        categoryId: editForm.categoryId === 'NONE' ? '' : editForm.categoryId,
        categoryName: categoryName,
        status: editForm.status as any,
        accountStatus: editForm.accountStatus as any,
        photoURL: editForm.photoURL,
        avatarUrl: editForm.photoURL,
        coverUrl: editForm.coverUrl || '',
        coverURL: editForm.coverUrl || '',
        bio: editForm.bio || '',
        galleryPhotos: editForm.galleryPhotos,
        notes: editForm.notes,
        isArtist: false,
        personalData: editForm.personalData,
        deliveryAddress: editForm.deliveryAddress,
        referralCode: editForm.referralCode || generateReferralCode(),
        leagueStatus: editForm.leagueStatus,
        leagueDivision: editForm.leagueDivision || 10,
        leaguePoints: editForm.leaguePoints || 0,
        lifetimePoints: editForm.lifetimePoints || 0,
        updatedAt: new Date().toISOString()
      };

      await saveCentralUser(updatedUser, nextAdminRole, editForm.categoryId);

      // Notificar toda a aplicação para revalidação imediata de sessão/rotas
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('voxa_admin_role_updated', {
            detail: { uid: targetUid, role: nextAdminRole }
          })
        );
      }

      setIsCached(false);
      setSelectedUser(null);
      setSuccessMsg(`Perfil @${slug} atualizado com sucesso!`);
      await loadAllData();
    } catch (err: any) {
      console.error("[ADMIN_EDIT_PROFILE_ERROR]", {
        file: "src/components/admin/UsersModule.tsx",
        fn: "handleEditUserSubmit",
        error: err?.message || String(err),
        stack: err?.stack
      });
      setModalErrorMsg(err.message || 'Erro ao salvar alterações no usuário.');
    } finally {
      setIsSavingUser(false);
    }
  };

  // Revoke invite
  const handleRevokeInvite = async (userId: string, userName: string) => {
    if (isCached) {
      setErrorMsg("Reconecte para realizar alterações.");
      return;
    }
    if (!window.confirm(`Tem certeza que deseja revogar o convite de ativação de "${userName}"?`)) return;
    try {
      const res = await fetch('/api/admin/users/revoke-activation-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: userId })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Convite de ${userName} revogado com sucesso!`);
        await loadAllData();
      } else {
        setErrorMsg(data.error || 'Erro ao revogar convite.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Erro de conexão ao revogar convite.');
    }
  };

  // Delete user
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (isCached) {
      setErrorMsg("Reconecte para realizar alterações. Ações administrativas estão desabilitadas em modo cache.");
      return;
    }
    if (!window.confirm(`Tem certeza que deseja excluir o perfil central de "${userName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      setSuccessMsg(`Perfil de ${userName} removido.`);
      setSelectedUser(null);
      await loadAllData();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Erro ao excluir usuário.');
    }
  };

  // Photo upload handler (Store-style fast upload with instant preview and progress bar)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isGallery = false, isEditMode = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      const msg = 'Formato inválido. Use JPG, JPEG, PNG ou WEBP.';
      if (isEditMode) setUploadAdminAvatarError(msg);
      else setModalErrorMsg(msg);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    if (isEditMode && !isGallery) {
      setLocalAdminAvatarPreview(previewUrl);
      setUploadAdminAvatarError(null);
    } else if (!isEditMode && !isGallery) {
      setLocalCreateAvatarPreview(previewUrl);
      setModalErrorMsg('');
    }

    setIsUploadingPhoto(true);
    setUploadProgress(10);
    setUploadStatus('Enviando foto...');
    try {
      const targetUserId = isEditMode ? (selectedUser?.id || selectedUser?.uid) : undefined;
      const res = await uploadFile(
        file,
        'avatar',
        (p) => {
          setUploadProgress(Math.max(10, p.percentage));
          setUploadStatus(p.percentage < 100 ? `Enviando foto... ${p.percentage}%` : 'Finalizando...');
        },
        { targetUserId }
      );
      if (res && res.url) {
        setUploadProgress(100);
        setUploadStatus('Foto enviada com sucesso');
        if (isEditMode) {
          if (isGallery) {
            setEditForm(prev => {
              const current = prev.galleryPhotos || [];
              if (current.length >= 4) {
                setModalErrorMsg('Limite máximo de 4 fotos secundárias atingido.');
                return prev;
              }
              return { ...prev, galleryPhotos: [...current, res.url] };
            });
          } else {
            setEditForm(prev => ({ ...prev, photoURL: res.url }));
            setLocalAdminAvatarPreview(null);

            if (targetUserId) {
              await updateCentralUserPhoto(targetUserId, res.url, 'photo');
              setUsers(prev => prev.map(u => (u.id === targetUserId || u.uid === targetUserId) ? { ...u, photoURL: res.url, avatarUrl: res.url } : u));
              if (typeof window !== 'undefined') {
                (window as any).invalidateUserProfileCache?.(targetUserId);
              }
            }
          }
        } else {
          if (isGallery) {
            setCreateForm(prev => {
              const current = prev.galleryPhotos || [];
              if (current.length >= 4) {
                setModalErrorMsg('Limite máximo de 4 fotos secundárias atingido.');
                return prev;
              }
              return { ...prev, galleryPhotos: [...current, res.url] };
            });
          } else {
            setCreateForm(prev => ({ ...prev, photoURL: res.url }));
            setLocalCreateAvatarPreview(null);
          }
        }
      } else {
        throw new Error('URL da imagem não retornada pelo serviço de upload.');
      }
    } catch (err: any) {
      console.error("[ADMIN_USER_PHOTO_UPLOAD_ERROR]", {
        file: "src/components/admin/UsersModule.tsx",
        fn: "handlePhotoUpload",
        error: err?.message || String(err),
        stack: err?.stack
      });
      setUploadStatus('');
      if (isEditMode && !isGallery) {
        setUploadAdminAvatarError(err?.message || 'Não foi possível enviar a imagem.');
        setLocalAdminAvatarPreview(null);
      } else {
        setLocalCreateAvatarPreview(null);
        setModalErrorMsg(err?.message || 'Não foi possível enviar a foto. Tente novamente.');
      }
    } finally {
      setIsUploadingPhoto(false);
      setTimeout(() => URL.revokeObjectURL(previewUrl), 2000);
    }
  };

  // Cover / Banner upload handler (Store-style fast upload with instant preview and progress bar)
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditMode = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setModalErrorMsg('Formato de capa inválido. Use JPG, JPEG, PNG ou WEBP.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    if (isEditMode) {
      setLocalAdminCoverPreview(previewUrl);
    } else {
      setLocalCreateCoverPreview(previewUrl);
    }
    setModalErrorMsg('');

    setIsUploadingCover(true);
    setCoverUploadProgress(10);
    setCoverUploadStatus('Enviando capa...');
    try {
      const targetUserId = isEditMode ? (selectedUser?.id || selectedUser?.uid) : undefined;
      const res = await uploadFile(
        file,
        'cover',
        (p) => {
          setCoverUploadProgress(Math.max(10, p.percentage));
          setCoverUploadStatus(p.percentage < 100 ? `Enviando capa... ${p.percentage}%` : 'Finalizando...');
        },
        { targetUserId }
      );
      if (res && res.url) {
        setCoverUploadProgress(100);
        setCoverUploadStatus('Capa enviada com sucesso');
        if (isEditMode) {
          setEditForm(prev => ({ ...prev, coverUrl: res.url }));
          setLocalAdminCoverPreview(null);
          if (targetUserId) {
            await updateCentralUserPhoto(targetUserId, res.url, 'cover');
            setUsers(prev => prev.map(u => (u.id === targetUserId || u.uid === targetUserId) ? { ...u, coverUrl: res.url, coverURL: res.url } : u));
            if (typeof window !== 'undefined') {
              (window as any).invalidateUserProfileCache?.(targetUserId);
            }
          }
        } else {
          setCreateForm(prev => ({ ...prev, coverUrl: res.url }));
          setLocalCreateCoverPreview(null);
        }
      } else {
        throw new Error('URL da capa não retornada.');
      }
    } catch (err: any) {
      console.error("[ADMIN_USER_COVER_UPLOAD_ERROR]", {
        file: "src/components/admin/UsersModule.tsx",
        fn: "handleCoverUpload",
        error: err?.message || String(err),
        stack: err?.stack
      });
      setCoverUploadStatus('');
      setLocalAdminCoverPreview(null);
      setLocalCreateCoverPreview(null);
      setModalErrorMsg(err?.message || 'Não foi possível enviar a capa.');
    } finally {
      setIsUploadingCover(false);
      setTimeout(() => URL.revokeObjectURL(previewUrl), 2000);
    }
  };

  const handleAdminRemovePhoto = async () => {
    if (!selectedUser) return;
    const targetUserId = selectedUser.id || selectedUser.uid;
    if (!window.confirm("Remover foto de perfil? O usuário passará a utilizar o avatar padrão da VOXA.")) return;

    try {
      await updateCentralUserPhoto(targetUserId, '', 'photo');
      setEditForm(prev => ({ ...prev, photoURL: '' }));
      setSelectedUser(prev => prev ? { ...prev, photoURL: '', avatarUrl: '' } : null);
      setUsers(prev => prev.map(u => (u.id === targetUserId || u.uid === targetUserId) ? { ...u, photoURL: '', avatarUrl: '' } : u));

      if (typeof window !== 'undefined') {
        (window as any).invalidateUserProfileCache?.(targetUserId);
      }

      setSuccessMsg('Foto de perfil removida com sucesso!');
    } catch (err: any) {
      console.error(err);
      setModalErrorMsg('Erro ao remover foto de perfil.');
    }
  };

  // Make gallery photo the main photo
  const handleSetMainPhoto = (photoUrl: string, isEditMode = false) => {
    if (isEditMode) {
      setEditForm(prev => {
        const oldMain = prev.photoURL;
        const newGallery = prev.galleryPhotos.filter(p => p !== photoUrl);
        if (oldMain) newGallery.push(oldMain);
        return {
          ...prev,
          photoURL: photoUrl,
          galleryPhotos: newGallery.slice(0, 4)
        };
      });
    } else {
      setCreateForm(prev => {
        const oldMain = prev.photoURL;
        const newGallery = prev.galleryPhotos.filter(p => p !== photoUrl);
        if (oldMain) newGallery.push(oldMain);
        return {
          ...prev,
          photoURL: photoUrl,
          galleryPhotos: newGallery.slice(0, 4)
        };
      });
    }
  };

  // Remove gallery photo
  const handleRemoveGalleryPhoto = (photoUrl: string, isEditMode = false) => {
    if (isEditMode) {
      setEditForm(prev => ({
        ...prev,
        galleryPhotos: prev.galleryPhotos.filter(p => p !== photoUrl)
      }));
    } else {
      setCreateForm(prev => ({
        ...prev,
        galleryPhotos: prev.galleryPhotos.filter(p => p !== photoUrl)
      }));
    }
  };

  // Invite handler
  const handleOpenInviteModal = (user: CentralUser) => {
    setInviteModalUser(user);
    setInviteEmail(user.email || '');
    setInvitePhone(user.phone || '');
    setGeneratedInvite(null);
  };

  const handleGenerateInviteSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isCached) {
      setErrorMsg("Reconecte para realizar alterações. Ações administrativas estão desabilitadas em modo cache.");
      return;
    }
    if (!inviteModalUser) return;

    setIsGeneratingInvite(true);
    setErrorMsg('');
    try {
      const invite = await generateUserInvite({
        userId: inviteModalUser.id || inviteModalUser.uid || '',
        email: '',
        phone: '',
        name: inviteModalUser.name,
        artisticName: inviteModalUser.artisticName,
        role: inviteModalUser.role
      });
      setGeneratedInvite(invite);
      setSuccessMsg("Convite gerado com sucesso!");
      await loadAllData();
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Erro ao gerar convite.");
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  // Run Identity Migration
  const handleRunMigration = async () => {
    if (isCached) {
      setErrorMsg("Reconecte para realizar alterações. Migrações estão desabilitadas em modo cache.");
      return;
    }
    setIsMigrating(true);
    setErrorMsg('');
    try {
      const res = await executeCentralIdentityMigration();
      setMigrationResults(res);
      setSuccessMsg(`Migração concluída! ${res.stats.newUsersCreated} novos perfis criados e dados vinculados.`);
      await loadAllData();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Erro durante o processo de migração.");
    } finally {
      setIsMigrating(false);
    }
  };

  // Run Clean Music Submodules
  const handleRunCleanSubmodules = async () => {
    if (isCached) {
      setErrorMsg("Reconecte para realizar alterações. Ações de limpeza estão desabilitadas em modo cache.");
      return;
    }
    setIsCleaning(true);
    setErrorMsg('');
    try {
      const res = await cleanMusicSubmodulesData();
      setCleanResults(res);
      setSuccessMsg(`Limpeza concluída! Removidos ${res.deletedArtists} artistas, ${res.deletedShares} shares e ${res.deletedClearances} vozes.`);
      await loadAllData();
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Erro ao limpar dados dos submódulos de música.");
    } finally {
      setIsCleaning(false);
    }
  };

  // Inline point adjustment inside user modal
  const handleInlinePointAdjustment = async () => {
    if (isCached) {
      setErrorMsg("Reconecte para realizar alterações. Ajustes de pontos estão desabilitados em modo cache.");
      return;
    }
    if (!selectedUser) return;
    if (!pointsReasonInput.trim()) {
      setErrorMsg('Informe o motivo do ajuste.');
      return;
    }
    setIsAdjustingPoints(true);
    try {
      const adminEmail = localStorage.getItem('voxa_current_user') 
        ? JSON.parse(localStorage.getItem('voxa_current_user')!).email 
        : 'admin@voxa.com.br';

      await adjustLeaguePoints({
        userId: selectedUser.id || selectedUser.uid || '',
        change: Number(pointsChangeInput),
        reason: pointsReasonInput,
        type: 'ADMIN_ADJUSTMENT',
        reference: `USR-ADJ-${Date.now().toString(36).toUpperCase()}`,
        adminEmail
      });

      setEditForm(prev => ({
        ...prev,
        leaguePoints: Math.max(0, (prev.leaguePoints || 0) + Number(pointsChangeInput)),
        lifetimePoints: Math.max(0, (prev.lifetimePoints || 0) + Number(pointsChangeInput))
      }));
      setSuccessMsg('Pontos ajustados e registrados com sucesso!');
      setPointsReasonInput('');
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao ajustar pontos.');
    } finally {
      setIsAdjustingPoints(false);
    }
  };

  // Sort all users descending by lifetimePoints to establish their ranking position (active users only)
  const rankedUsers = [...users]
    .filter(u => u && u.accountStatus === 'CONTA_ATIVA')
    .sort((a, b) => {
      const ptsA = a.lifetimePoints || 0;
      const ptsB = b.lifetimePoints || 0;
      if (ptsB !== ptsA) {
        return ptsB - ptsA;
      }
      const parseDate = (dStr: any) => {
        if (!dStr) return Infinity;
        if (typeof dStr !== 'string') return new Date(dStr).getTime() || Infinity;
        if (dStr.includes('/')) {
          const parts = dStr.split('/');
          if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            return new Date(year, month, day).getTime();
          }
        }
        return new Date(dStr).getTime() || Infinity;
      };
      return parseDate(a.createdAt) - parseDate(b.createdAt);
    });
  const getUserRankPosition = (userId: string) => {
    const idx = rankedUsers.findIndex(u => u.id === userId || u.uid === userId);
    return idx !== -1 ? idx + 1 : rankedUsers.length + 1;
  };

  // Filtered users list
  const filteredUsers = users.filter(user => {
    try {
      if (!user) return false;
      const qLower = (searchQuery || '').toLowerCase();
      const matchesSearch = 
        !qLower ||
        (user.name && typeof user.name === 'string' && user.name.toLowerCase().includes(qLower)) ||
        (user.artisticName && typeof user.artisticName === 'string' && user.artisticName.toLowerCase().includes(qLower)) ||
        (user.email && typeof user.email === 'string' && user.email.toLowerCase().includes(qLower)) ||
        (user.slug && typeof user.slug === 'string' && user.slug.toLowerCase().includes(qLower)) ||
        (user.phone && typeof user.phone === 'string' && user.phone.includes(searchQuery)) ||
        (user.referralCode && typeof user.referralCode === 'string' && user.referralCode.toLowerCase().includes(qLower));

      const matchesAdminRole = 
        roleFilter === 'ALL' || 
        (roleFilter === 'NONE' && (!user.adminRole || user.adminRole === 'NONE')) ||
        user.adminRole === roleFilter;

      const matchesCategory = 
        categoryFilter === 'ALL' || 
        user.categoryId === categoryFilter;

      const matchesAccountStatus = 
        accountStatusFilter === 'ALL' || 
        user.accountStatus === accountStatusFilter ||
        (accountStatusFilter === 'CONTA_ATIVA' && user.hasAuth);

      return Boolean(matchesSearch && matchesAdminRole && matchesCategory && matchesAccountStatus);
    } catch (err) {
      console.error("[Filter Error] Failed to filter user:", user, err);
      return false;
    }
  });

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-emerald-600 shadow-sm"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-orbitron text-xs font-bold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-between text-[#FF0033] shadow-sm"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-[#FF0033] shrink-0" />
              <span className="font-orbitron text-xs font-bold">{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-[#FF0033] hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToMenu}
            className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl cursor-pointer transition-colors"
            title="Voltar ao Menu"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center text-[#FF0033] shadow-md shrink-0">
            <Users className="w-6 h-6 text-[#FF0033]" />
          </div>
          <div>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <h2 className="font-orbitron font-black text-xl text-black">CADASTRO CENTRAL DE USUÁRIOS</h2>
              <div className="flex flex-wrap gap-1.5">
                <span className="bg-emerald-50 text-emerald-700 font-orbitron font-bold text-[9px] px-2 py-0.5 rounded-full border border-emerald-200 uppercase">
                  FONTE DA VERDADE
                </span>
                {isCached ? (
                  <span className="bg-amber-100 text-amber-700 font-orbitron font-bold text-[9px] px-2 py-0.5 rounded-full border border-amber-300 uppercase">
                    FONTE DOS DADOS: CACHE / DESATUALIZADO
                  </span>
                ) : (
                  <span className="bg-emerald-100 text-emerald-700 font-orbitron font-bold text-[9px] px-2 py-0.5 rounded-full border border-emerald-300 uppercase">
                    FONTE DOS DADOS: ONLINE / FIRESTORE
                  </span>
                )}
              </div>
            </div>
            <p className="text-gray-500 text-xs font-sans mt-0.5">
              Identidade unificada, 4 papéis oficiais, 5 fotos de perfil, dados privados, afiliações e sistema League.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Clean Music Submodules Button */}
          <button
            onClick={() => {
              setCleanResults(null);
              setIsCleanModalOpen(true);
            }}
            className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-orbitron font-bold text-xs px-3.5 py-2.5 rounded-2xl flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs"
            title="Limpar registros redundantes de Artistas, Shares e Vozes"
          >
            <Trash2 className="w-3.5 h-3.5 text-amber-700" />
            <span>LIMPAR DADOS DE MÚSICA</span>
          </button>

          {/* Unification & Migration Tool Button */}
          <button
            onClick={() => {
              setAuditReport(null);
              setCleanupLogs(null);
              setCleanupConfirmInput('');
              setIsCleanupModalOpen(true);
              runAuditReport();
            }}
            className="bg-rose-50 hover:bg-rose-100 text-[#FF0033] border border-rose-300 font-orbitron font-bold text-xs px-3.5 py-2.5 rounded-2xl flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs"
            title="Auditar Auth vs Usuários e realizar limpeza destrutiva segura"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#FF0033]" />
            <span>AUDITAR & RESETAR AUTH</span>
          </button>

          {/* Unification & Migration Tool Button */}
          <button
            onClick={() => {
              setMigrationResults(null);
              setIsMigrationModalOpen(true);
            }}
            className="bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 font-orbitron font-bold text-xs px-3.5 py-2.5 rounded-2xl flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs"
            title="Auditar e unificar pessoas de todos os módulos"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>MIGRAÇÃO & AUDITORIA</span>
          </button>

          {/* Manage Categories Button */}
          <button
            onClick={() => {
              setEditingCategory(null);
              setCatNameInput('');
              setCatOrderInput('0');
              setCatActiveInput(true);
              setIsCategoryCrudOpen(true);
            }}
            className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 font-orbitron font-bold text-xs px-3.5 py-2.5 rounded-2xl flex items-center space-x-1.5 cursor-pointer transition-all shadow-xs"
            title="Gerenciar categorias públicas do módulo Usuários"
          >
            <Settings className="w-3.5 h-3.5 text-blue-600" />
            <span>GERENCIAR CATEGORIAS</span>
          </button>

          {/* Reload */}
          <button
            onClick={loadAllData}
            disabled={isLoading}
            className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl cursor-pointer transition-colors"
            title="Recarregar Usuários"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Create User Button */}
          <button
            onClick={() => {
              resetCreateForm();
              setIsCreateModalOpen(true);
            }}
            className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs px-4 py-2.5 rounded-2xl flex items-center space-x-2 shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>NOVO USUÁRIO</span>
          </button>
        </div>
      </div>

      {/* Cache / Offline status banner */}
      {isCached && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-orbitron font-bold text-xs text-amber-800 uppercase tracking-wider">
                DADOS EM CACHE — PODEM ESTAR DESATUALIZADOS
              </p>
              <p className="text-amber-600 text-[10px] font-sans mt-0.5 leading-relaxed">
                Não foi possível sincronizar com o banco online. Reconecte para realizar alterações. Ações administrativas estão temporariamente bloqueadas.
              </p>
              <p className="text-amber-700 font-bold text-[10px] font-sans mt-1">
                Reconecte para realizar alterações.
              </p>
            </div>
          </div>
          <button
            onClick={loadAllData}
            className="bg-amber-600 hover:bg-amber-700 text-white font-orbitron font-bold text-[10px] px-3.5 py-2 rounded-xl flex items-center space-x-1.5 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-pulse" />
            <span>TENTAR RECONECTAR</span>
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
          <span className="text-[10px] font-orbitron font-bold text-gray-400 block uppercase">
            {isCached ? "Último cache disponível" : "TOTAL DE PESSOAS"}
          </span>
          <span className="text-2xl font-orbitron font-black text-black">
            {users.length} {isCached && <span className="text-xs text-amber-500 font-bold ml-1">usuários em cache</span>}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-xs">
          <span className="text-[10px] font-orbitron font-bold text-blue-600 block">ARTISTAS</span>
          <span className="text-2xl font-orbitron font-black text-blue-700">
            {users.filter(u => normalizeUserRole(u.role) === 'ARTISTA').length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs">
          <span className="text-[10px] font-orbitron font-bold text-emerald-600 block">PRODUTORAS & EMPRESAS</span>
          <span className="text-2xl font-orbitron font-black text-emerald-700">
            {users.filter(u => ['PRODUTORA', 'EMPRESA'].includes(normalizeUserRole(u.role))).length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-xs">
          <span className="text-[10px] font-orbitron font-bold text-purple-600 block">MEMBROS LEAGUE</span>
          <span className="text-2xl font-orbitron font-black text-purple-700">
            {users.filter(u => u.leagueStatus === 'ATIVO').length}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-gray-200 max-w-lg space-x-1.5 overflow-x-auto">
        <button
          onClick={() => setUsersViewTab('banco')}
          className={`flex-1 py-2 px-3 rounded-xl text-center font-orbitron font-bold text-[10px] tracking-wider transition-all cursor-pointer whitespace-nowrap ${
            usersViewTab === 'banco'
              ? 'bg-black text-white shadow-sm'
              : 'text-gray-500 hover:text-black hover:bg-gray-50'
          }`}
        >
          BANCO DE USUÁRIOS
        </button>
        <button
          onClick={() => setUsersViewTab('cards')}
          className={`flex-1 py-2 px-3 rounded-xl text-center font-orbitron font-bold text-[10px] tracking-wider transition-all cursor-pointer whitespace-nowrap ${
            usersViewTab === 'cards'
              ? 'bg-black text-white shadow-sm'
              : 'text-gray-500 hover:text-black hover:bg-gray-50'
          }`}
        >
          CARDS / PERFIS
        </button>
        <button
          onClick={() => setUsersViewTab('audit_logs')}
          className={`flex-1 py-2 px-3 rounded-xl text-center font-orbitron font-bold text-[10px] tracking-wider transition-all cursor-pointer whitespace-nowrap ${
            usersViewTab === 'audit_logs'
              ? 'bg-black text-white shadow-sm'
              : 'text-gray-500 hover:text-black hover:bg-gray-50'
          }`}
        >
          AUDIT LOGS ({auditLogs.length})
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail, telefone, código..."
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-2 text-xs font-sans text-black focus:outline-none focus:border-[#FF0033]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {/* Admin Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-gray-100 border-none text-xs font-orbitron font-bold text-gray-700 rounded-2xl px-3 py-2 cursor-pointer focus:outline-none flex-1 sm:flex-none"
          >
            <option value="ALL">CARGO: TODOS</option>
            <option value="SUPER_ADMIN">SUPER ADMIN</option>
            <option value="ADMINISTRATOR">ADMINISTRADOR</option>
            <option value="MANAGER">GERENTE</option>
            <option value="SUPPORT">EQUIPE DE SUPORTE</option>
            <option value="NONE">NENHUM CARGO ADM</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-gray-100 border-none text-xs font-orbitron font-bold text-gray-700 rounded-2xl px-3 py-2 cursor-pointer focus:outline-none"
          >
            <option value="ALL">CATEGORIA: TODAS</option>
            {profileCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          {/* Account Status Filter */}
          <select
            value={accountStatusFilter}
            onChange={(e) => setAccountStatusFilter(e.target.value)}
            className="bg-gray-100 border-none text-xs font-orbitron font-bold text-gray-700 rounded-2xl px-3 py-2 cursor-pointer focus:outline-none"
          >
            <option value="ALL">STATUS: TODOS</option>
            <option value="CONTA_ATIVA">COM LOGIN (CONTA ATIVA)</option>
            <option value="PRE_REGISTERED">PERFIL SEM LOGIN (PRÉ-CADASTRADO)</option>
            <option value="CONVITE_PENDENTE">CONVITE PENDENTE</option>
            <option value="SEM_ACESSO">SEM ACESSO AO SITE</option>
          </select>
        </div>
      </div>

      {/* Users Grid */}
      {errorMsg ? (
        <div className="bg-white rounded-3xl border border-red-200 p-12 text-center shadow-xs flex flex-col items-center justify-center">
          <AlertCircle className="w-12 h-12 text-[#FF0033] mx-auto mb-3 shrink-0" />
          <p className="font-orbitron font-bold text-sm text-gray-700">{errorMsg}</p>
          <p className="text-xs text-gray-400 font-sans mt-1 mb-6">Ocorreu um problema na conexão ou limite de requisições excedido.</p>
          <button
            onClick={loadAllData}
            className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs px-5 py-2.5 rounded-2xl flex items-center space-x-2 shadow-md cursor-pointer transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>TENTAR NOVAMENTE</span>
          </button>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-xs">
          <RefreshCw className="w-8 h-8 text-[#FF0033] animate-spin mx-auto mb-3" />
          <p className="font-orbitron font-bold text-xs text-gray-500">Sincronizando usuários centrais...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-xs">
          <UserX className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-orbitron font-bold text-sm text-gray-700">Nenhum perfil encontrado</p>
          <p className="text-xs text-gray-400 font-sans mt-1">Ajuste os filtros ou crie um novo cadastro central.</p>
        </div>
      ) : usersViewTab === 'banco' ? (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden text-left">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">
                  <th className="py-4 px-5 w-12 text-center">Foto</th>
                  <th className="py-4 px-5">Nome</th>
                  <th className="py-4 px-5">@Username</th>
                  <th className="py-4 px-5">Categoria Pública</th>
                  <th className="py-4 px-5">Cargo Administrativo</th>
                  <th className="py-4 px-5">Status</th>
                  <th className="py-4 px-5">Data de Cadastro</th>
                  <th className="py-4 px-5 text-right w-44">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredUsers.map((user) => {
                  const hasAuth = user.hasAuth === true || user.accountStatus === 'CONTA_ATIVA';
                  const isInvitePending = user.accountStatus === 'CONVITE_PENDENTE';

                  // Associated items check
                  const linkedArtist = artists.find(a => a.userId === user.id || a.userId === user.uid || (a.name && user.name && a.name.toLowerCase() === user.name.toLowerCase()));
                  const linkedShares = shares.filter(s => s.userId === user.id || s.userId === user.uid || (s.artistName && user.name && s.artistName.toLowerCase() === user.name.toLowerCase()));
                  const linkedClearance = clearances.find(c => c.userId === user.id || c.userId === user.uid || (c.artistName && user.name && c.artistName.toLowerCase() === user.name.toLowerCase()));

                  return (
                    <tr key={user.id || user.uid} className="hover:bg-gray-50/50 transition-colors">
                      {/* Foto */}
                      <td className="py-3 px-5 text-center">
                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            alt={user.name}
                            className="w-9 h-9 rounded-xl object-cover border border-gray-200 shadow-xs mx-auto"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center text-white font-orbitron font-black text-xs mx-auto">
                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                        )}
                      </td>

                      {/* Nome */}
                      <td className="py-3 px-5 font-bold text-black">
                        <span className="truncate max-w-[150px]" title={user.name}>{user.name}</span>
                      </td>

                      {/* @Username */}
                      <td className="py-3 px-5 text-gray-500 font-mono font-bold">
                        {user.slug ? `@${user.slug}` : '—'}
                      </td>

                      {/* Categoria Pública */}
                      <td className="py-3 px-5 font-orbitron font-bold text-[10px] text-gray-700">
                        <span className="bg-[#FF0033]/5 text-[#FF0033] px-2.5 py-0.5 rounded-full border border-[#FF0033]/15">
                          {user.categoryName || 'Sem categoria'}
                        </span>
                      </td>

                      {/* Cargo Administrativo */}
                      <td className="py-3 px-5 font-sans font-bold text-xs text-gray-700">
                        {user.adminRole === 'SUPER_ADMIN' ? (
                          <span className="bg-black text-white border border-black text-[10px] font-orbitron font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                            Super Admin
                          </span>
                        ) : user.adminRole === 'ADMINISTRATOR' ? (
                          <span className="bg-red-50 text-[#FF0033] border border-red-200 text-[10px] font-orbitron font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                            Administrador
                          </span>
                        ) : user.adminRole === 'MANAGER' ? (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-orbitron font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                            Gerente
                          </span>
                        ) : user.adminRole === 'SUPPORT' ? (
                          <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-orbitron font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                            Equipe de Suporte
                          </span>
                        ) : (
                          <span className="text-gray-400 font-normal">—</span>
                        )}
                      </td>

                      {/* Status de Acesso */}
                      <td className="py-3 px-5">
                        {user.status === 'PRE_REGISTERED' || user.accountStatus === 'PRE_REGISTERED' ? (
                          <span className="bg-sky-50 text-sky-700 text-[10px] font-orbitron font-bold px-2.5 py-1 rounded-full border border-sky-200 inline-flex items-center gap-1">
                            PRÉ-CADASTRADO
                          </span>
                        ) : (user.accountStatus === 'INVITED' || user.accountStatus === 'CONVITE_PENDENTE') ? (
                          <span className="bg-amber-50 text-amber-700 text-[10px] font-orbitron font-bold px-2.5 py-1 rounded-full border border-amber-200 inline-flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 shrink-0 animate-spin" style={{ animationDuration: '4s' }} />
                            CONVITE PENDENTE
                          </span>
                        ) : user.status === 'SUSPENDED' || user.accountStatus === 'SUSPENDED' ? (
                          <span className="bg-red-50 text-red-700 text-[10px] font-orbitron font-bold px-2.5 py-1 rounded-full border border-red-200">
                            SUSPENSO
                          </span>
                        ) : user.status === 'DISABLED' || user.accountStatus === 'DISABLED' ? (
                          <span className="bg-gray-50 text-gray-500 text-[10px] font-orbitron font-bold px-2.5 py-1 rounded-full border border-gray-200">
                            DESATIVADO
                          </span>
                        ) : hasAuth ? (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-orbitron font-bold px-2.5 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            ATIVO
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-gray-600 text-[10px] font-orbitron font-bold px-2.5 py-1 rounded-full border border-gray-200">
                            SEM ACESSO
                          </span>
                        )}
                      </td>

                      {/* Data de Cadastro */}
                      <td className="py-3 px-5 font-mono text-[10px] text-gray-500">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '—'}
                      </td>

                      {/* Integrações */}
                      <td className="py-3 px-5">
                        <div className="flex gap-1 flex-wrap">
                          {linkedArtist && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[8px] font-orbitron font-bold px-1.5 py-0.5 rounded" title="Perfil de Artista Vinculado">
                              ARTISTA
                            </span>
                          )}
                          {linkedShares.length > 0 && (
                            <span className="bg-[#FF0033]/5 text-[#FF0033] border border-[#FF0033]/15 text-[8px] font-orbitron font-bold px-1.5 py-0.5 rounded" title={`${linkedShares.length} divisão(ões) de lucro`}>
                              SHARES ({linkedShares.length})
                            </span>
                          )}
                          {linkedClearance && (
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[8px] font-orbitron font-bold px-1.5 py-0.5 rounded" title="Liberação de distribuição pendente/ativa">
                              CLEAR
                            </span>
                          )}
                          {!linkedArtist && linkedShares.length === 0 && !linkedClearance && (
                            <span className="text-gray-400 text-[10px]">—</span>
                          )}
                        </div>
                      </td>

                      {/* Liga */}
                      <td className="py-3 px-5 text-center">
                        {user.leagueStatus === 'ATIVO' ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="text-amber-700 font-orbitron font-black text-[10px] flex items-center gap-0.5">
                              <Trophy className="w-3 h-3 text-amber-600 shrink-0" />
                              {user.leagueDivision || 10}ª DIV
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono">
                              {user.leaguePoints || 0} PTS
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {(user.username || user.slug) && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const cleanHandle = (user.username || user.slug || '').replace(/^@+/, '');
                                  const publicUrl = `${window.location.origin}/@${cleanHandle}`;
                                  navigator.clipboard.writeText(publicUrl);
                                  setSuccessMsg(`Link público copiado: ${publicUrl}`);
                                }}
                                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-200 cursor-pointer transition-colors"
                                title="Copiar Link Público (/@username)"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <a
                                href={`/@${(user.username || user.slug || '').replace(/^@+/, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-200 cursor-pointer transition-colors"
                                title="Abrir Perfil Público"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}
                          
                          {!hasAuth && (
                            <button
                              onClick={() => {
                                setInviteModalUser(user);
                                setInviteEmail(user.email || '');
                                setInvitePhone(user.phone || '');
                                setGeneratedInvite(null);
                              }}
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 cursor-pointer transition-colors"
                              title="Enviar Convite de Acesso"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {(user.accountStatus === 'INVITED' || user.accountStatus === 'CONVITE_PENDENTE') && (
                            <button
                              onClick={() => handleRevokeInvite(user.id || user.uid || '', user.name)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-100 cursor-pointer transition-colors"
                              title="Revogar Convite"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedUser(user)}
                            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg cursor-pointer transition-colors"
                            title="Editar Perfil"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteUser(user.id || user.uid || '', user.name)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-[#FF0033] rounded-lg border border-red-200 cursor-pointer transition-colors"
                            title="Excluir Usuário"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : usersViewTab === 'audit_logs' ? (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden text-left">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-orbitron font-black text-xs sm:text-sm text-black uppercase">Histórico de Alterações de Cargo (admin_audit_logs)</h3>
              <p className="text-[11px] text-gray-500 font-sans">Registro imutável com actorUid, targetUid, oldRole, newRole e timestamp.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">
                  <th className="py-3.5 px-4">Data / Hora</th>
                  <th className="py-3.5 px-4">Responsável (actorUid)</th>
                  <th className="py-3.5 px-4">Usuário Alvo (targetUid)</th>
                  <th className="py-3.5 px-4">Cargo Anterior</th>
                  <th className="py-3.5 px-4">Novo Cargo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 font-sans">
                      Nenhum registro de auditoria encontrado.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log, idx) => {
                    const actorId = log.actorUid || log.adminId || '—';
                    const targetId = log.targetUid || '—';
                    const actorUser = users.find(u => u.uid === actorId || u.id === actorId);
                    const targetUser = users.find(u => u.uid === targetId || u.id === targetId);
                    return (
                      <tr key={log.id || idx} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4 font-mono text-[10px] text-gray-600 whitespace-nowrap">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-black block">{actorUser?.name || 'Admin'}</span>
                          <span className="font-mono text-[10px] text-gray-400">{actorId}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-black block">{targetUser?.name || 'Usuário'}</span>
                          <span className="font-mono text-[10px] text-gray-400">{targetId}</span>
                        </td>
                        <td className="py-3 px-4 font-orbitron font-bold text-[10px] text-gray-500">
                          {log.oldRole || 'NONE'}
                        </td>
                        <td className="py-3 px-4 font-orbitron font-bold text-[10px] text-[#FF0033]">
                          {log.newRole || 'NONE'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Members Header */}
          <div className="text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-orbitron font-black text-sm text-black uppercase tracking-wider flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#FF0033]" />
                Galeria de Cards de Usuários
              </h3>
              <p className="text-xs text-gray-500 mt-1 font-sans">
                Cards de identidade visual de todos os membros cadastrados na Lockdown Produtora.
              </p>
            </div>
            
            {/* Search Input for Cards Tab */}
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="Pesquisar por nome ou @username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2 text-xs font-sans text-black focus:outline-none focus:border-[#FF0033] transition-colors"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {(() => {
            if (filteredUsers.length === 0) {
              return (
                <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-xs">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-orbitron font-bold text-sm text-gray-700">Nenhum membro encontrado</p>
                  <p className="text-xs text-gray-400 font-sans mt-1">Experimente alterar os termos da busca.</p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                {filteredUsers.map((user) => {
                  const position = getUserRankPosition(user.id || user.uid || '');
                  return (
                    <div key={user.id || user.uid} className="flex flex-col space-y-3 bg-[#121212] p-4 rounded-3xl border border-white/10 hover:border-white/20 transition-all duration-300">
                      <UserCard 
                        user={{
                          id: user.id || user.uid,
                          name: user.name,
                          artisticName: user.artisticName,
                          slug: user.slug,
                          photoURL: user.photoURL,
                          role: user.role,
                          lifetimePoints: user.lifetimePoints
                        }}
                        rankingPosition={position}
                        size="default"
                      />
                      
                      {/* Separate Administrative Action Buttons */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <a
                          href={`/u/${user.slug || ''}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-zinc-900 hover:bg-zinc-800 text-white border border-white/5 font-orbitron font-bold text-[8px] py-2 px-1 rounded-lg text-center uppercase truncate block"
                        >
                          VER PERFIL
                        </a>
                        
                        <button
                          type="button"
                          onClick={() => setSelectedUser(user)}
                          className="bg-[#FF0033] hover:opacity-90 text-white font-orbitron font-bold text-[8px] py-2 px-1 rounded-lg text-center uppercase truncate cursor-pointer"
                        >
                          EDITAR
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const profileUrl = `${window.location.origin}/u/${user.slug || ''}`;
                            navigator.clipboard.writeText(profileUrl);
                            alert('Link oficial copiado!');
                          }}
                          className="bg-zinc-900 hover:bg-zinc-800 text-white border border-white/5 font-orbitron font-bold text-[8px] py-2 px-1 rounded-lg text-center uppercase truncate cursor-pointer"
                        >
                          COPIAR LINK
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* MODAL: CREATE USER (Perfil sem Login ou Com Login) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border-2 border-gray-200 p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-left">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-[#FF0033]" />
                <h3 className="font-orbitron font-black text-base text-black">
                  {createMode === 'profile_no_auth' ? 'CRIAR PERFIL SEM LOGIN' : 'CRIAR PERFIL COM LOGIN & SENHA'}
                </h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-black cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setCreateMode('profile_no_auth');
                  setModalErrorMsg('');
                }}
                className={`py-2.5 px-3 rounded-xl font-orbitron font-bold text-xs transition-all cursor-pointer ${
                  createMode === 'profile_no_auth' 
                    ? 'bg-black text-white shadow-sm' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                1. CRIAR PERFIL SEM LOGIN
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateMode('with_auth');
                  setModalErrorMsg('');
                }}
                className={`py-2.5 px-3 rounded-xl font-orbitron font-bold text-xs transition-all cursor-pointer ${
                  createMode === 'with_auth' 
                    ? 'bg-black text-white shadow-sm' 
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                2. CRIAR COM LOGIN & SENHA
              </button>
            </div>

            {createMode === 'profile_no_auth' && (
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3 text-[11px] text-sky-900 font-sans flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Perfil Público Pré-Cadastrado (Sem E-mail/Senha)</span>
                  <span>Cria o perfil público imediatamente com URL real (<strong>/@username</strong> e <strong>/u/username</strong>). A conta poderá ser ativada futuramente pelo titular.</span>
                </div>
              </div>
            )}

            {modalErrorMsg && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start justify-between text-[#FF0033] text-xs font-bold shadow-xs">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-[#FF0033] shrink-0 mt-0.5" />
                  <span>{modalErrorMsg}</span>
                </div>
                <button type="button" onClick={() => setModalErrorMsg('')} className="text-[#FF0033] hover:text-red-800 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <form onSubmit={handleCreateUserSubmit} noValidate className="space-y-4">
              {/* Minimum required fields: Nome and @username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">
                    NOME DO PERFIL *
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={e => {
                      const val = e.target.value;
                      setCreateForm(prev => {
                        const autoSlug = !prev.username || prev.username === generateSlug(prev.name)
                          ? generateSlug(val)
                          : prev.username;
                        return { ...prev, name: val, username: autoSlug };
                      });
                    }}
                    placeholder="Ex: Junior Santti"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-black focus:outline-none focus:border-[#FF0033] font-bold"
                  />
                </div>

                <div>
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">
                    @USERNAME (URL PÚBLICA) *
                  </label>
                  <input
                    type="text"
                    value={createForm.username}
                    onChange={e => setCreateForm(prev => ({ ...prev, username: e.target.value.replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_.]/g, '') }))}
                    placeholder="Ex: jrsantti"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-black font-mono focus:outline-none focus:border-[#FF0033]"
                  />
                  {createForm.username && (
                    <span className="text-[10px] text-emerald-700 font-mono block mt-1 truncate">
                      URL: {window.location.origin}/@{createForm.username.replace(/^@+/, '')}
                    </span>
                  )}
                </div>
              </div>

              {/* Bio (Optional) */}
              <div>
                <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">
                  BIO / DESCRIÇÃO DO PERFIL (OPCIONAL)
                </label>
                <textarea
                  rows={2}
                  value={createForm.bio}
                  onChange={e => setCreateForm(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder=" Apresentação pública do perfil..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-black focus:outline-none focus:border-[#FF0033]"
                />
              </div>

              {/* Admin Role & Public Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">CATEGORIA PÚBLICA (OPCIONAL)</label>
                  <select
                    value={createForm.categoryId}
                    onChange={e => setCreateForm(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-orbitron font-bold text-gray-700 focus:outline-none"
                  >
                    <option value="">Sem categoria</option>
                    {profileCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">CARGO ADMINISTRATIVO</label>
                  <select
                    value={createForm.adminRole}
                    onChange={e => setCreateForm(prev => ({ ...prev, adminRole: e.target.value }))}
                    disabled={!['SUPER_ADMIN', 'ADMINISTRATOR'].includes(currentActorRole)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-orbitron font-bold text-gray-700 focus:outline-none disabled:opacity-60"
                  >
                    <option value="NONE">Nenhum (Membro Comum)</option>
                    <option value="ADMINISTRATOR">Administrador (ADMINISTRATOR)</option>
                    <option value="MANAGER">Gerente (MANAGER)</option>
                    <option value="SUPPORT">Suporte (SUPPORT)</option>
                    {currentActorRole === 'SUPER_ADMIN' && (
                      <option value="SUPER_ADMIN">Super Admin (SUPER_ADMIN)</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Verified Toggle & WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
                <div>
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">WHATSAPP / CONTATO (OPCIONAL)</label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={e => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-black focus:outline-none"
                  />
                </div>

                <div className="pt-3 sm:pt-4">
                  <label className="flex items-center space-x-2.5 bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={createForm.isVerified}
                      onChange={e => setCreateForm(prev => ({ ...prev, isVerified: e.target.checked }))}
                      className="w-4 h-4 accent-[#FF0033] rounded cursor-pointer"
                    />
                    <span className="font-orbitron text-[10px] font-bold text-black uppercase">
                      PERFIL VERIFICADO VOXA
                    </span>
                  </label>
                </div>
              </div>

              {createMode === 'with_auth' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-red-50/50 p-3.5 rounded-2xl border border-red-100">
                  <div>
                    <label className="font-orbitron text-[10px] text-gray-600 block font-bold mb-1">E-MAIL DE LOGIN *</label>
                    <input
                      type="email"
                      value={createForm.email}
                      onChange={e => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@exemplo.com"
                      className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-black focus:outline-none focus:border-[#FF0033]"
                    />
                  </div>

                  <div>
                    <label className="font-orbitron text-[10px] text-gray-600 block font-bold mb-1">SENHA INICIAL *</label>
                    <input
                      type="password"
                      value={createForm.password}
                      onChange={e => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full bg-white border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-black focus:outline-none focus:border-[#FF0033]"
                    />
                  </div>
                </div>
              )}

              {/* Store-Style Fast Photo Upload & Cover Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Profile Photo Upload */}
                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-orbitron text-[10px] font-bold text-black uppercase">
                      FOTO DE PERFIL
                    </span>
                    <label className="bg-black hover:bg-gray-800 text-white font-orbitron font-bold text-[9px] px-2.5 py-1.5 rounded-xl cursor-pointer flex items-center space-x-1 shadow">
                      <Upload className="w-3 h-3" />
                      <span>{createForm.photoURL ? 'TROCAR FOTO' : 'ENVIAR FOTO'}</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handlePhotoUpload(e, false, false)} className="hidden" />
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0 text-center">
                      {localCreateAvatarPreview ? (
                        <div className="relative">
                          <img src={localCreateAvatarPreview} alt="Preview" className="w-16 h-16 rounded-xl object-cover border-2 border-dashed border-[#FF0033] opacity-80" />
                          <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[7px] font-orbitron font-bold py-0.5 rounded-b-xl">
                            ENVIANDO
                          </span>
                        </div>
                      ) : createForm.photoURL ? (
                        <div className="relative group">
                          <img src={createForm.photoURL} alt="" className="w-16 h-16 rounded-xl object-cover border-2 border-[#FF0033]" referrerPolicy="no-referrer" />
                          <button
                            type="button"
                            onClick={() => {
                              setCreateForm(prev => ({ ...prev, photoURL: '' }));
                              setUploadStatus('');
                            }}
                            className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow transition-all cursor-pointer"
                            title="Remover foto"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gray-200 border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
                          <User className="w-5 h-5" />
                          <span className="text-[8px] font-orbitron mt-0.5">SEM FOTO</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {isUploadingPhoto ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[9px] font-orbitron font-bold">
                            <span className="text-gray-700 truncate">{uploadStatus || 'Enviando foto...'}</span>
                            <span className="text-[#FF0033]">{uploadProgress}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-[#FF0033] transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                          </div>
                        </div>
                      ) : createForm.photoURL ? (
                        <span className="text-[10px] text-emerald-700 font-orbitron font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          Foto pronta
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-sans block">
                          JPG, PNG ou WEBP.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Banner / Cover Upload */}
                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-orbitron text-[10px] font-bold text-black uppercase">
                      BANNER / CAPA
                    </span>
                    <label className="bg-black hover:bg-gray-800 text-white font-orbitron font-bold text-[9px] px-2.5 py-1.5 rounded-xl cursor-pointer flex items-center space-x-1 shadow">
                      <Upload className="w-3 h-3" />
                      <span>{createForm.coverUrl ? 'TROCAR CAPA' : 'ENVIAR CAPA'}</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleCoverUpload(e, false)} className="hidden" />
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0 text-center">
                      {localCreateCoverPreview ? (
                        <div className="relative">
                          <img src={localCreateCoverPreview} alt="Preview Capa" className="w-20 h-16 rounded-xl object-cover border-2 border-dashed border-[#FF0033] opacity-80" />
                        </div>
                      ) : createForm.coverUrl ? (
                        <div className="relative group">
                          <img src={createForm.coverUrl} alt="" className="w-20 h-16 rounded-xl object-cover border-2 border-[#FF0033]" referrerPolicy="no-referrer" />
                          <button
                            type="button"
                            onClick={() => {
                              setCreateForm(prev => ({ ...prev, coverUrl: '' }));
                              setCoverUploadStatus('');
                            }}
                            className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow transition-all cursor-pointer"
                            title="Remover capa"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-20 h-16 rounded-xl bg-gray-200 border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
                          <span className="text-[8px] font-orbitron">SEM CAPA</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {isUploadingCover ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[9px] font-orbitron font-bold">
                            <span className="text-gray-700 truncate">{coverUploadStatus || 'Enviando capa...'}</span>
                            <span className="text-[#FF0033]">{coverUploadProgress}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-[#FF0033] transition-all duration-200" style={{ width: `${coverUploadProgress}%` }} />
                          </div>
                        </div>
                      ) : createForm.coverUrl ? (
                        <span className="text-[10px] text-emerald-700 font-orbitron font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          Capa pronta
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-sans block">
                          Opcional (16:9).
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron text-xs px-4 py-2.5 rounded-2xl cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser || isUploadingPhoto || isUploadingCover}
                  className="bg-[#FF0033] hover:bg-red-700 disabled:opacity-50 text-white font-orbitron font-bold text-xs px-6 py-2.5 rounded-2xl shadow-md cursor-pointer flex items-center space-x-2"
                >
                  {isCreatingUser && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isCreatingUser ? 'SALVANDO PERFIL...' : 'SALVAR PERFIL CENTRAL'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER (4 TABS: PROFILE, PRIVATE DATA, LEAGUE, MODULES) */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border-2 border-gray-200 p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center space-x-3">
                {selectedUser.photoURL ? (
                  <img src={selectedUser.photoURL} alt="" className="w-12 h-12 rounded-2xl object-cover border border-gray-200" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center text-white">
                    <User className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div>
                  <h3 className="font-orbitron font-black text-base text-black">{selectedUser.name}</h3>
                  <div className="flex items-center space-x-2 text-[10px] font-mono text-gray-400">
                    <span>ID: {selectedUser.id || selectedUser.uid}</span>
                    <span>•</span>
                    <a
                      href={`/@${(selectedUser.username || selectedUser.slug || generateSlug(selectedUser.name)).replace(/^@+/, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#FF0033] hover:underline font-bold"
                    >
                      /@{(selectedUser.username || selectedUser.slug || generateSlug(selectedUser.name)).replace(/^@+/, '')}
                    </a>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-black cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalErrorMsg && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start justify-between text-[#FF0033] text-xs font-bold shadow-xs">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-[#FF0033] shrink-0 mt-0.5" />
                  <span>{modalErrorMsg}</span>
                </div>
                <button type="button" onClick={() => setModalErrorMsg('')} className="text-[#FF0033] hover:text-red-800 ml-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Edit Tabs Switcher */}
            <div className="flex space-x-1.5 border-b border-gray-200 pb-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setEditTab('profile')}
                className={`px-3 py-1.5 rounded-xl font-orbitron font-bold text-xs cursor-pointer transition-all ${
                  editTab === 'profile' ? 'bg-black text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                1. PERFIL & FOTOS
              </button>
              <button
                type="button"
                onClick={() => setEditTab('private_data')}
                className={`px-3 py-1.5 rounded-xl font-orbitron font-bold text-xs cursor-pointer transition-all ${
                  editTab === 'private_data' ? 'bg-black text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                2. DADOS PRIVADOS & ENTREGA
              </button>
              <button
                type="button"
                onClick={() => setEditTab('league')}
                className={`px-3 py-1.5 rounded-xl font-orbitron font-bold text-xs cursor-pointer transition-all ${
                  editTab === 'league' ? 'bg-black text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                3. INDICAÇÃO & AFILIAÇÃO
              </button>
              <button
                type="button"
                onClick={() => setEditTab('modules')}
                className={`px-3 py-1.5 rounded-xl font-orbitron font-bold text-xs cursor-pointer transition-all ${
                  editTab === 'modules' ? 'bg-black text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                4. MÓDULOS & ACESSO
              </button>
            </div>

            <form onSubmit={handleEditUserSubmit} className="space-y-4">
              {/* TAB 1: PROFILE & PHOTOS */}
              {editTab === 'profile' && (
                <div className="space-y-4">
                  <div>
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">NOME DE USUÁRIO *</label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-black focus:outline-none focus:border-[#FF0033] font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">SLUG PÚBLICO (/u/slug)</label>
                      <input
                        type="text"
                        value={editForm.slug}
                        onChange={e => setEditForm(prev => ({ ...prev, slug: generateSlug(e.target.value) }))}
                        placeholder="slug-do-perfil"
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-black font-mono focus:outline-none focus:border-[#FF0033]"
                      />
                    </div>

                    <div>
                      <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">CARGO ADMINISTRATIVO</label>
                      <select
                        value={editForm.adminRole}
                        onChange={e => {
                          const val = e.target.value;
                          setEditForm(prev => ({
                            ...prev,
                            adminRole: val,
                            isAdmin: val === 'ADMINISTRATOR' || val === 'SUPER_ADMIN'
                          }));
                        }}
                        disabled={!['SUPER_ADMIN', 'ADMINISTRATOR'].includes(currentActorRole)}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-orbitron font-bold text-gray-700 focus:outline-none font-sans disabled:opacity-60"
                      >
                        <option value="NONE">Nenhum (Usuário Comum)</option>
                        <option value="ADMINISTRATOR">Administrador (ADMINISTRATOR)</option>
                        <option value="MANAGER">Gerente (MANAGER)</option>
                        <option value="SUPPORT">Suporte (SUPPORT)</option>
                        {(currentActorRole === 'SUPER_ADMIN' || editForm.adminRole === 'SUPER_ADMIN') && (
                          <option value="SUPER_ADMIN">Super Admin (SUPER_ADMIN)</option>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
                    <div>
                      <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">CATEGORIA PÚBLICA</label>
                      <select
                        value={editForm.categoryId}
                        onChange={e => setEditForm(prev => ({ ...prev, categoryId: e.target.value }))}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-orbitron font-bold text-gray-700 focus:outline-none font-sans"
                      >
                        <option value="">Nenhuma</option>
                        {profileCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="pt-3 sm:pt-4">
                      <label className="flex items-center space-x-2.5 bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={editForm.isVerified}
                          onChange={e => setEditForm(prev => ({ ...prev, isVerified: e.target.checked }))}
                          className="w-4 h-4 accent-[#FF0033] rounded cursor-pointer"
                        />
                        <span className="font-orbitron text-[10px] font-bold text-black uppercase">
                          PERFIL VERIFICADO VOXA
                        </span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">BIO / DESCRIÇÃO PÚBLICA</label>
                    <textarea
                      rows={2}
                      value={editForm.bio}
                      onChange={e => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                      placeholder="Biografia pública do perfil..."
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-black focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">E-MAIL</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-black focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">WHATSAPP / TELEFONE</label>
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-black focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Photos Manager: Single Photo with Remove Option */}
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-orbitron text-xs font-bold text-black block">FOTO DO PERFIL</span>
                        <span className="text-[10px] text-gray-400 font-sans">
                          Apenas 1 foto de perfil oficial da conta.
                        </span>
                      </div>

                      {!isUploadingPhoto && (
                        <label className="bg-black hover:bg-gray-800 text-white font-orbitron font-bold text-[10px] px-3.5 py-2 rounded-xl cursor-pointer flex items-center space-x-1 shadow">
                          <Upload className="w-3 h-3" />
                          <span>{editForm.photoURL ? 'TROCAR FOTO' : 'ENVIAR FOTO'}</span>
                          <input id="admin-avatar-file-input" type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, false, true)} className="hidden" />
                        </label>
                      )}
                    </div>

                    {uploadAdminAvatarError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-[10px] p-2.5 rounded-xl flex flex-col items-center space-y-1">
                        <span>{uploadAdminAvatarError}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadAdminAvatarError(null);
                            const input = document.getElementById('admin-avatar-file-input');
                            if (input) (input as HTMLInputElement).click();
                          }}
                          className="bg-[#FF0033] text-white font-bold px-2 py-1 rounded-md text-[9px] hover:bg-[#d6002b]"
                        >
                          TENTAR NOVAMENTE
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-1">
                      <div className="relative text-center shrink-0">
                        {localAdminAvatarPreview ? (
                          <div className="relative group">
                            <img src={localAdminAvatarPreview} alt="Preview" className="w-20 h-20 rounded-2xl object-cover border-2 border-dashed border-gray-400 opacity-80" />
                            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[7px] font-orbitron font-bold py-0.5 rounded-b-2xl">
                              PRÉVIA
                            </span>
                          </div>
                        ) : editForm.photoURL ? (
                          <div className="relative group">
                            <img src={editForm.photoURL} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-[#FF0033] shadow-xs" referrerPolicy="no-referrer" />
                            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] font-orbitron font-bold py-0.5 rounded-b-2xl">
                              FOTO ATUAL
                            </span>
                            <button
                              type="button"
                              onClick={handleAdminRemovePhoto}
                              className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow-md transition-all cursor-pointer"
                              title="Remover foto"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-2xl bg-gray-200 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
                            <User className="w-6 h-6" />
                            <span className="text-[8px] font-orbitron mt-1">SEM FOTO</span>
                          </div>
                        )}
                      </div>

                      {isUploadingPhoto && (
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-orbitron font-bold">
                            <span className="text-gray-700">{uploadStatus || 'Enviando foto...'}</span>
                            <span className="text-[#FF0033]">{uploadProgress}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                               className="h-full bg-[#FF0033] transition-all duration-300" 
                               style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cover / Banner Manager */}
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-orbitron text-xs font-bold text-black block">BANNER / CAPA DO PERFIL</span>
                        <span className="text-[10px] text-gray-400 font-sans">
                          Imagem de capa exibida no topo do perfil público.
                        </span>
                      </div>

                      {!isUploadingCover && (
                        <label className="bg-black hover:bg-gray-800 text-white font-orbitron font-bold text-[10px] px-3.5 py-2 rounded-xl cursor-pointer flex items-center space-x-1 shadow">
                          <Upload className="w-3 h-3" />
                          <span>{editForm.coverUrl ? 'TROCAR CAPA' : 'ENVIAR CAPA'}</span>
                          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleCoverUpload(e, true)} className="hidden" />
                        </label>
                      )}
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <div className="relative text-center shrink-0">
                        {localAdminCoverPreview ? (
                          <img src={localAdminCoverPreview} alt="Preview Capa" className="w-28 h-16 rounded-2xl object-cover border-2 border-dashed border-[#FF0033] opacity-80" />
                        ) : editForm.coverUrl ? (
                          <div className="relative group">
                            <img src={editForm.coverUrl} alt="" className="w-28 h-16 rounded-2xl object-cover border-2 border-[#FF0033] shadow-xs" referrerPolicy="no-referrer" />
                            <button
                              type="button"
                              onClick={async () => {
                                const targetUserId = selectedUser.id || selectedUser.uid;
                                setEditForm(prev => ({ ...prev, coverUrl: '' }));
                                if (targetUserId) {
                                  await updateCentralUserPhoto(targetUserId, '', 'cover');
                                }
                              }}
                              className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow-md transition-all cursor-pointer"
                              title="Remover capa"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-28 h-16 rounded-2xl bg-gray-200 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
                            <span className="text-[8px] font-orbitron">SEM CAPA</span>
                          </div>
                        )}
                      </div>

                      {isUploadingCover && (
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-orbitron font-bold">
                            <span className="text-gray-700">{coverUploadStatus || 'Enviando capa...'}</span>
                            <span className="text-[#FF0033]">{coverUploadProgress}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#FF0033] transition-all duration-300"
                              style={{ width: `${coverUploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PRIVATE DATA (CIVIL & DELIVERY) */}
              {editTab === 'private_data' && (
                <div className="space-y-4">
                  <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/80 text-[11px] text-amber-900 font-sans flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Estes dados são protegidos e visíveis apenas pelo próprio usuário e pela administração.</span>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                    <span className="font-orbitron text-xs font-bold text-black block">DADOS PESSOAIS (CIVIL)</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">NOME COMPLETO (CIVIL)</label>
                        <input
                          type="text"
                          value={editForm.personalData.fullName || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, personalData: { ...prev.personalData, fullName: e.target.value } }))}
                          placeholder="Nome civil de registro"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-black focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">CPF</label>
                        <input
                          type="text"
                          value={editForm.personalData.cpf || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, personalData: { ...prev.personalData, cpf: e.target.value } }))}
                          placeholder="000.000.000-00"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-black focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">RG</label>
                        <input
                          type="text"
                          value={editForm.personalData.rg || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, personalData: { ...prev.personalData, rg: e.target.value } }))}
                          placeholder="00.000.000-0"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-black focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">TELEFONE DE CONTATO</label>
                        <input
                          type="text"
                          value={editForm.personalData.phone || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, personalData: { ...prev.personalData, phone: e.target.value } }))}
                          placeholder="(11) 99999-9999"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-black focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                    <span className="font-orbitron text-xs font-bold text-black block">ENDEREÇO DE ENTREGA</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">NOME DO DESTINATÁRIO</label>
                        <input
                          type="text"
                          value={editForm.deliveryAddress.recipientName || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, deliveryAddress: { ...prev.deliveryAddress, recipientName: e.target.value } }))}
                          placeholder="Quem receberá a encomenda"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-black focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">CEP</label>
                        <input
                          type="text"
                          value={editForm.deliveryAddress.cep || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, deliveryAddress: { ...prev.deliveryAddress, cep: e.target.value } }))}
                          placeholder="00000-000"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-black focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">RUA / AVENIDA</label>
                        <input
                          type="text"
                          value={editForm.deliveryAddress.street || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, deliveryAddress: { ...prev.deliveryAddress, street: e.target.value } }))}
                          placeholder="Logradouro"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-black focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">NÚMERO</label>
                        <input
                          type="text"
                          value={editForm.deliveryAddress.number || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, deliveryAddress: { ...prev.deliveryAddress, number: e.target.value } }))}
                          placeholder="123"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-black focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">COMPLEMENTO</label>
                        <input
                          type="text"
                          value={editForm.deliveryAddress.complement || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, deliveryAddress: { ...prev.deliveryAddress, complement: e.target.value } }))}
                          placeholder="Apto 42, Bloco B"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-black focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">BAIRRO</label>
                        <input
                          type="text"
                          value={editForm.deliveryAddress.neighborhood || ''}
                          onChange={e => setEditForm(prev => ({ ...prev, deliveryAddress: { ...prev.deliveryAddress, neighborhood: e.target.value } }))}
                          placeholder="Bairro"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-black focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">CIDADE / ESTADO (UF)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editForm.deliveryAddress.city || ''}
                            onChange={e => setEditForm(prev => ({ ...prev, deliveryAddress: { ...prev.deliveryAddress, city: e.target.value } }))}
                            placeholder="Cidade"
                            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-black focus:outline-none"
                          />
                          <input
                            type="text"
                            value={editForm.deliveryAddress.state || ''}
                            onChange={e => setEditForm(prev => ({ ...prev, deliveryAddress: { ...prev.deliveryAddress, state: e.target.value } }))}
                            placeholder="UF"
                            maxLength={2}
                            className="w-14 bg-white border border-gray-300 rounded-xl px-2 py-2 text-xs text-black uppercase focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: INDICAÇÃO & REFERRALS */}
              {editTab === 'league' && (
                <div className="space-y-4">
                  {/* Referral Code & Share Link */}
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-2">
                    <span className="font-orbitron text-xs font-bold text-emerald-900 block">SISTEMA DE INDICAÇÕES (AFILIAÇÃO)</span>
                    <div className="flex items-center gap-2">
                      <div className="bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-800 flex-1 flex items-center justify-between">
                        <span>CÓDIGO: {editForm.referralCode}</span>
                        <span className="text-[10px] text-gray-400">/u/{editForm.slug}?ref={editForm.referralCode}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const link = `${window.location.origin}/u/${editForm.slug}?ref={editForm.referralCode}`;
                          navigator.clipboard.writeText(link);
                          setSuccessMsg('Link de indicação copiado!');
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl cursor-pointer"
                        title="Copiar Link"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Confira meu perfil na VOXA e cadastre-se: ${window.location.origin}/u/${editForm.slug}?ref=${editForm.referralCode}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#25D366] text-white p-2.5 rounded-xl cursor-pointer"
                        title="Compartilhar no WhatsApp"
                      >
                        <Share2 className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: MODULES & ACCESS */}
              {editTab === 'modules' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">STATUS DE ACESSO</label>
                      <select
                        value={editForm.accountStatus}
                        onChange={e => setEditForm(prev => ({ ...prev, accountStatus: e.target.value as any }))}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-orbitron font-bold text-gray-700 focus:outline-none"
                      >
                        <option value="PRE_REGISTERED">PRÉ-CADASTRADO (PERFIL SEM LOGIN)</option>
                        <option value="SEM_ACESSO">SEM ACESSO AO SITE</option>
                        <option value="CONVITE_PENDENTE">CONVITE PENDENTE</option>
                        <option value="CONTA_ATIVA">CONTA ATIVA</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">STATUS DO CADASTRO</label>
                      <select
                        value={editForm.status}
                        onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value as any }))}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-orbitron font-bold text-gray-700 focus:outline-none"
                      >
                        <option value="PRE_REGISTERED">PRÉ-CADASTRADO</option>
                        <option value="Ativo">ATIVO</option>
                        <option value="Inativo">INATIVO</option>
                        <option value="Suspenso">SUSPENSO</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">CARGO ADMINISTRATIVO (admin_users/{'{uid}'}.role)</label>
                    <select
                      value={editForm.adminRole}
                      onChange={e => {
                        const val = e.target.value;
                        setEditForm(prev => ({
                          ...prev,
                          adminRole: val,
                          isAdmin: val === 'ADMINISTRATOR' || val === 'SUPER_ADMIN'
                        }));
                      }}
                      disabled={!['SUPER_ADMIN', 'ADMINISTRATOR'].includes(currentActorRole)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-orbitron font-bold text-gray-700 focus:outline-none disabled:opacity-60"
                    >
                      <option value="NONE">Nenhum (Usuário Comum)</option>
                      <option value="ADMINISTRATOR">Administrador (ADMINISTRATOR)</option>
                      <option value="MANAGER">Gerente (MANAGER)</option>
                      <option value="SUPPORT">Suporte (SUPPORT)</option>
                      {(currentActorRole === 'SUPER_ADMIN' || editForm.adminRole === 'SUPER_ADMIN') && (
                        <option value="SUPER_ADMIN">Super Admin (SUPER_ADMIN)</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">NOTAS INTERNAS</label>
                    <textarea
                      rows={2}
                      value={editForm.notes}
                      onChange={e => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Observações administrativas internas..."
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-black focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => handleOpenInviteModal(selectedUser)}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-orbitron font-bold text-xs px-4 py-2.5 rounded-2xl flex items-center justify-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>GERAR CONVITE</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="flex-1 sm:flex-none bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron text-xs px-4 py-2.5 rounded-2xl"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingUser || isUploadingPhoto}
                    className="flex-1 sm:flex-none bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs px-6 py-2.5 rounded-2xl shadow-md cursor-pointer flex items-center justify-center space-x-2"
                  >
                    {isSavingUser && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSavingUser ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INVITE USER */}
      {inviteModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border-2 border-gray-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center space-x-2">
                <Send className="w-5 h-5 text-emerald-600" />
                <h3 className="font-orbitron font-black text-sm text-black">ENVIAR CONVITE DE ACESSO</h3>
              </div>
              <button onClick={() => setInviteModalUser(null)} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-2xl border border-gray-200">
              {inviteModalUser.photoURL ? (
                <img src={inviteModalUser.photoURL} alt="" className="w-10 h-10 rounded-xl object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <div>
                <span className="font-orbitron font-black text-xs text-black block">{inviteModalUser.name}</span>
                <span className="text-[10px] text-purple-700 font-sans block">{inviteModalUser.artisticName || inviteModalUser.role}</span>
              </div>
            </div>

            {!generatedInvite ? (
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 space-y-1.5 text-left">
                  <span className="text-[10px] text-gray-500 font-orbitron font-bold uppercase tracking-wider block">Status do Convite</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-gray-800">
                      {inviteModalUser.accountStatus || 'SEM ACESSO'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      ({inviteModalUser.inviteToken ? 'Link pendente existente' : 'Sem link gerado'})
                    </span>
                  </div>
                </div>

                <div className="flex flex-col space-y-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => handleGenerateInviteSubmit()}
                    disabled={isGeneratingInvite}
                    className="w-full bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs py-3.5 rounded-2xl shadow-lg shadow-red-600/10 cursor-pointer flex items-center justify-center space-x-2 uppercase"
                  >
                    {isGeneratingInvite ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Gerando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Gerar Link de Ativação</span>
                      </>
                    )}
                  </button>

                  {inviteModalUser.inviteToken && (
                    <button
                      type="button"
                      onClick={async () => {
                        await handleRevokeInvite(inviteModalUser.id || inviteModalUser.uid || '', inviteModalUser.name);
                        setInviteModalUser(null);
                      }}
                      className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-orbitron font-bold text-[10px] py-2 rounded-xl border border-red-100 transition-all uppercase cursor-pointer"
                    >
                      Revogar Link Existente
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setInviteModalUser(null)}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-orbitron font-bold text-[10px] py-2.5 rounded-xl text-center uppercase"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-left">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                  <span className="text-[10px] font-orbitron font-bold text-emerald-700 block">LINK DE ATIVAÇÃO GERADO:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInvite.inviteUrl}
                      className="bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-800 font-mono w-full"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedInvite.inviteUrl);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg cursor-pointer shrink-0"
                      title="Copiar Link"
                    >
                      {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col space-y-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setGeneratedInvite(null)}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-orbitron font-bold text-xs py-3 rounded-2xl text-center uppercase cursor-pointer"
                  >
                    Gerar Novo Link
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await handleRevokeInvite(inviteModalUser.id || inviteModalUser.uid || '', inviteModalUser.name);
                      setGeneratedInvite(null);
                      setInviteModalUser(null);
                    }}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-orbitron font-bold text-[10px] py-2 rounded-xl border border-red-100 text-center uppercase cursor-pointer"
                  >
                    Revogar Link
                  </button>

                  <button
                    type="button"
                    onClick={() => setInviteModalUser(null)}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron font-bold text-xs py-2.5 rounded-2xl text-center uppercase cursor-pointer"
                  >
                    Concluído
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: MIGRATION & UNIFICATION AUDIT */}
      {isMigrationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border-2 border-gray-200 p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="font-orbitron font-black text-sm text-black">MIGRAÇÃO & UNIFICAÇÃO DE IDENTIDADES</h3>
                  <p className="text-[10px] text-gray-500 font-sans">Audita artistas, shares e liberações, vinculando-os ao cadastro central de Usuários.</p>
                </div>
              </div>
              <button onClick={() => setIsMigrationModalOpen(false)} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-200 space-y-2">
              <span className="font-orbitron text-xs font-bold text-purple-900 block">COMO FUNCIONA ESTA FERRAMENTA:</span>
              <ul className="text-[11px] text-purple-800 font-sans space-y-1 list-disc pl-4">
                <li>Verifica todos os registros de <strong>Artistas</strong>, <strong>Share Financeiro</strong> e <strong>Vozes Liberadas</strong>.</li>
                <li>Localiza o perfil correspondente em <strong>Usuários</strong> por nome ou nome artístico normalizado.</li>
                <li>Cria perfis centrais para pessoas que ainda não estavam cadastradas.</li>
                <li>Vincula o <code>userId</code> central em todas as tabelas para garantir integridade e sincronização da foto.</li>
              </ul>
            </div>

            {migrationResults && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-200 text-center">
                  <div>
                    <span className="text-[9px] font-orbitron text-gray-400 block">NOVOS PERFIS</span>
                    <span className="font-orbitron font-black text-base text-purple-700">{migrationResults.stats.newUsersCreated}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-orbitron text-gray-400 block">ARTISTAS</span>
                    <span className="font-orbitron font-black text-base text-blue-700">{migrationResults.stats.artistsLinked}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-orbitron text-gray-400 block">SHARES</span>
                    <span className="font-orbitron font-black text-base text-emerald-700">{migrationResults.stats.sharesLinked}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-orbitron text-gray-400 block">VOZES</span>
                    <span className="font-orbitron font-black text-base text-amber-700">{migrationResults.stats.clearancesLinked}</span>
                  </div>
                </div>

                <div className="bg-black text-emerald-400 p-3 rounded-2xl font-mono text-[10px] max-h-40 overflow-y-auto space-y-1">
                  {migrationResults.logs.map((log, idx) => (
                    <div key={idx}>✓ {log}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsMigrationModalOpen(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron text-xs px-4 py-2.5 rounded-2xl"
              >
                FECHAR
              </button>
              <button
                type="button"
                onClick={handleRunMigration}
                disabled={isMigrating}
                className="bg-purple-600 hover:bg-purple-700 text-white font-orbitron font-bold text-xs px-6 py-2.5 rounded-2xl shadow-md cursor-pointer flex items-center space-x-2"
              >
                {isMigrating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>EXECUTAR AUDITORIA & UNIFICAÇÃO</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CLEAN MUSIC SUBMODULES */}
      {isCleanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border-2 border-amber-300 p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-orbitron font-black text-sm text-black">LIMPAR SUBMÓDULOS DE MÚSICA</h3>
              </div>
              <button onClick={() => setIsCleanModalOpen(false)} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 space-y-2 text-xs text-amber-900 font-sans">
              <span className="font-orbitron font-bold block">O QUE ESTA FERRAMENTA FAZ:</span>
              <p>
                Esta operação remove registros redundantes de pessoas nas coleções secundárias de música (<strong>Artistas</strong>, <strong>Share Financeiro</strong> e <strong>Vozes Liberadas</strong>).
              </p>
              <p className="font-bold">
                ✓ Seus Usuários Centrais, Autenticação, Produtos da Store, Ingressos e Assinaturas NÃO serão afetados.
              </p>
            </div>

            {cleanResults && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-orbitron font-bold space-y-1">
                <div>✓ Artistas limpos: {cleanResults.deletedArtists}</div>
                <div>✓ Shares limpos: {cleanResults.deletedShares}</div>
                <div>✓ Vozes limpas: {cleanResults.deletedClearances}</div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsCleanModalOpen(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron text-xs px-4 py-2.5 rounded-2xl"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleRunCleanSubmodules}
                disabled={isCleaning}
                className="bg-amber-600 hover:bg-amber-700 text-white font-orbitron font-bold text-xs px-6 py-2.5 rounded-2xl shadow cursor-pointer flex items-center space-x-2"
              >
                {isCleaning && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>CONFIRMAR LIMPEZA DOS SUBMÓDULOS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AUDIT & DESTRUCTIVE SYSTEM CLEANUP */}
      {isCleanupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl border-2 border-red-500 p-6 max-w-2xl w-full shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-6 h-6 text-[#FF0033]" />
                <h3 className="font-orbitron font-black text-sm text-black">AUDITAR & RESETAR AUTH SISTEMA</h3>
              </div>
              <button onClick={() => setIsCleanupModalOpen(false)} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-900 font-sans space-y-2">
              <div className="flex items-center space-x-1.5 font-orbitron font-bold text-red-700">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>AVISO DE OPERAÇÃO DESTRUTIVA</span>
              </div>
              <p>
                Esta rotina audita os dados e **deleta permanentemente** todos os usuários do Firebase Authentication e todos os perfis do Firestore, **EXCETO** a conta administradora principal <strong className="underline">lockdownprodutora@gmail.com</strong>.
              </p>
              <p className="font-semibold text-red-800">
                ✓ Serão PRESERVADOS todos os registros financeiros e transacionais históricos (pedidos da loja, vendas de ingressos, faturas, comissões, pagamentos, carteiras e logs contábeis).
              </p>
            </div>

            {isAuditing && (
              <div className="flex flex-col items-center justify-center py-8 space-y-2">
                <RefreshCw className="w-8 h-8 text-[#FF0033] animate-spin" />
                <span className="font-orbitron text-xs font-bold text-gray-500">REALIZANDO VARREDURA COMPLETA...</span>
              </div>
            )}

            {!isAuditing && auditReport && (
              <div className="space-y-4">
                {/* Auth API Error Alert Banner */}
                {auditReport.authListFailed && (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs font-sans space-y-2">
                    <div className="flex items-center space-x-1.5 font-orbitron font-bold text-amber-700">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>SINCRO DO FIREBASE AUTH INDISPONÍVEL</span>
                    </div>
                    <p className="font-sans leading-relaxed text-left text-amber-900">
                      A listagem e auditoria dos usuários do Firebase Auth não pôde ser completada devido a uma restrição de API no Google Cloud/Firebase:
                    </p>
                    <div className="bg-white border border-amber-200 rounded-xl p-2.5 font-mono text-[10px] break-all leading-relaxed text-amber-800 text-left">
                      {auditReport.authListError}
                    </div>
                    <p className="font-sans text-[11px] text-amber-800 leading-relaxed text-left">
                      Para resolver isso e habilitar a listagem, você precisa ativar a API <strong>Identity Toolkit</strong> no Console do Google Cloud do seu projeto.
                    </p>
                    {(() => {
                      let gcpConsoleLink = "";
                      if (auditReport.authListError) {
                        const match = auditReport.authListError.match(/(\/\/)?console\.developers\.google\.com[^\s']+/);
                        if (match) {
                          gcpConsoleLink = match[0];
                          if (gcpConsoleLink.startsWith("//")) {
                            gcpConsoleLink = "https:" + gcpConsoleLink;
                          } else if (!gcpConsoleLink.startsWith("http")) {
                            gcpConsoleLink = "https://" + gcpConsoleLink;
                          }
                        }
                      }
                      return gcpConsoleLink ? (
                        <div className="pt-1 text-left">
                          <a 
                            href={gcpConsoleLink}
                            target="_blank" 
                            referrerPolicy="no-referrer"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white font-orbitron font-bold text-[10px] px-3.5 py-2 rounded-xl transition shadow-xs"
                          >
                            ATIVAR API NO CONSOLE GCP
                          </a>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl text-left">
                    <span className="text-[9px] font-orbitron text-gray-400 block">USUÁRIOS FIREBASE AUTH</span>
                    <span className="font-orbitron font-black text-xl text-black">
                      {auditReport.authListFailed ? "N/A (Desativado)" : auditReport.totalAuthUsers}
                    </span>
                  </div>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl text-left">
                    <span className="text-[9px] font-orbitron text-gray-400 block">PERFIS FIRESTORE (users)</span>
                    <span className="font-orbitron font-black text-xl text-black">{auditReport.totalFirestoreUsers}</span>
                  </div>
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl col-span-2 md:col-span-1 text-left">
                    <span className="text-[9px] font-orbitron text-rose-500 block">ÓRFÃOS + FANTASMAS</span>
                    <span className="font-orbitron font-black text-xl text-rose-700">
                      {auditReport.authListFailed ? "N/A" : (auditReport.orphans.length + auditReport.ghosts.length)}
                    </span>
                  </div>
                </div>

                {/* Safe Admin account confirmation */}
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-sans space-y-1 text-left">
                  <span className="font-orbitron font-bold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    CONTA ADMINISTRADORA PROTEGIDA:
                  </span>
                  <div className="font-mono text-[10px] pl-5">
                    Email: {auditReport.lockdownProdutora.email}<br />
                    UID no Auth: {auditReport.authListFailed ? "N/A (Erro de API)" : (auditReport.lockdownProdutora.uidInAuth || "Não encontrado no Auth!")}<br />
                    UID no Firestore: {auditReport.lockdownProdutora.uidInFirestore || "Não encontrado no Firestore!"}
                  </div>
                  <span className="block pl-5 mt-1 text-[10px] text-emerald-700 font-semibold">
                    ✓ Esta conta está 100% BLINDADA contra remoção e continuará operacional com todos os poderes de administração.
                  </span>
                </div>

                {/* Details list of Orphaned or Ghost accounts */}
                {(auditReport.orphans.length > 0 || auditReport.ghosts.length > 0) && (
                  <div className="space-y-2">
                    <span className="font-orbitron font-bold text-xs text-gray-700 block">INCONSISTÊNCIAS DETECTADAS:</span>
                    <div className="border border-gray-200 rounded-2xl p-3 bg-gray-50 max-h-40 overflow-y-auto space-y-2 text-[10px] font-mono">
                      {auditReport.orphans.map((o: any, idx: number) => (
                        <div key={`o-${idx}`} className="text-amber-700">
                          ⚠️ [ÓRFÃO NO AUTH] UID: {o.uid} | Email: {o.email || "Sem email"} | Nome: {o.displayName || "Sem nome"}
                        </div>
                      ))}
                      {auditReport.ghosts.map((g: any, idx: number) => (
                        <div key={`g-${idx}`} className="text-[#FF0033]">
                          ⚠️ [FANTASMA NO FIRESTORE] UID: {g.uid} | Email: {g.email || "Sem email"} | Nome: {g.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cleanup execution input confirmation */}
                {!cleanupLogs && (
                  <div className="p-4 border border-red-200 bg-red-50/50 rounded-2xl space-y-3">
                    <label className="font-orbitron font-bold text-xs text-red-800 block">
                      DIGITE "EXCLUIR_DEFINITIVAMENTE" PARA CONFIRMAR:
                    </label>
                    <input
                      type="text"
                      value={cleanupConfirmInput}
                      onChange={(e) => setCleanupConfirmInput(e.target.value)}
                      placeholder="EXCLUIR_DEFINITIVAMENTE"
                      className="w-full bg-white border border-red-300 rounded-xl px-4 py-2.5 text-center font-mono font-bold text-sm tracking-wider text-black focus:outline-hidden focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Execution logs */}
            {cleanupLogs && (
              <div className="space-y-2">
                <span className="font-orbitron font-bold text-xs text-emerald-700 block">LOGS DE EXECUÇÃO DA LIMPEZA:</span>
                <div className="border border-emerald-200 rounded-2xl p-3 bg-black text-emerald-400 max-h-56 overflow-y-auto space-y-1 text-[10px] font-mono">
                  {cleanupLogs.map((log, idx) => (
                    <div key={idx}>✓ {log}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsCleanupModalOpen(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron text-xs px-4 py-2.5 rounded-2xl"
              >
                FECHAR
              </button>
              
              {!cleanupLogs && auditReport && (
                <button
                  type="button"
                  onClick={executeSystemCleanup}
                  disabled={isCleaningUp || cleanupConfirmInput !== "EXCLUIR_DEFINITIVAMENTE"}
                  className="bg-[#FF0033] hover:bg-red-700 disabled:opacity-50 text-white font-orbitron font-bold text-xs px-6 py-2.5 rounded-2xl shadow-md cursor-pointer flex items-center space-x-2"
                >
                  {isCleaningUp && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>EXECUTAR LIMPEZA DESTRUTIVA</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: GERENCIAR CATEGORIAS */}
      {isCategoryCrudOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl border-2 border-blue-400 p-6 max-w-2xl w-full shadow-2xl space-y-6 text-black my-8 text-left">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-blue-600" />
                <h3 className="font-orbitron font-black text-sm text-black uppercase">Gerenciar Categorias Públicas</h3>
              </div>
              <button onClick={() => setIsCategoryCrudOpen(false)} className="text-gray-400 hover:text-black cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List and Create layout grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Form Section */}
              <form onSubmit={handleSaveCategory} className="space-y-4">
                <span className="font-orbitron font-black text-[10px] text-[#FF0033] tracking-widest block uppercase">
                  {editingCategory ? "Editar Categoria" : "Nova Categoria"}
                </span>

                <div className="space-y-3.5">
                  <div>
                    <label className="font-orbitron text-[9px] text-gray-500 block font-bold mb-1">NOME DA CATEGORIA PÚBLICA</label>
                    <input
                      type="text"
                      value={catNameInput}
                      onChange={(e) => setCatNameInput(e.target.value)}
                      placeholder="Ex: Time de Futebol, Influencer..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-orbitron text-[9px] text-gray-500 block font-bold mb-1">ORDEM DE EXIBIÇÃO (PESO)</label>
                    <input
                      type="number"
                      value={catOrderInput}
                      onChange={(e) => setCatOrderInput(e.target.value)}
                      placeholder="Ex: 10, 20..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center space-x-3 pt-1">
                    <input
                      type="checkbox"
                      id="catActive"
                      checked={catActiveInput}
                      onChange={(e) => setCatActiveInput(e.target.checked)}
                      className="w-4 h-4 rounded text-[#FF0033] focus:ring-[#FF0033]"
                    />
                    <label htmlFor="catActive" className="text-xs font-bold text-gray-700 font-sans cursor-pointer">Categoria ativa no sistema</label>
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(null);
                        setCatNameInput('');
                        setCatOrderInput('0');
                        setCatActiveInput(true);
                      }}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron font-bold text-[10px] py-2 px-4 rounded-xl cursor-pointer"
                    >
                      CANCELAR
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSavingCategory}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-orbitron font-bold text-[10px] py-2 px-4 rounded-xl uppercase tracking-wider cursor-pointer"
                  >
                    {isSavingCategory ? "SALVANDO..." : editingCategory ? "SALVAR ALTERAÇÕES" : "CRIAR CATEGORIA"}
                  </button>
                </div>
              </form>

              {/* List Section */}
              <div className="space-y-3">
                <span className="font-orbitron font-black text-[10px] text-gray-500 tracking-widest block uppercase">Categorias Ativas ({profileCategories.length})</span>
                
                <div className="border border-gray-100 rounded-2xl max-h-80 overflow-y-auto divide-y divide-gray-100 text-xs">
                  {profileCategories.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 font-sans">Nenhuma categoria cadastrada.</div>
                  ) : (
                    profileCategories.map((cat) => (
                      <div key={cat.id} className="p-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="text-left">
                          <span className="font-bold text-gray-800">{cat.name}</span>
                          <div className="flex gap-2 items-center text-[9px] text-gray-400 font-mono mt-0.5">
                            <span>Slug: {cat.slug}</span>
                            <span>•</span>
                            <span>Ordem: {cat.order}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setCatNameInput(cat.name);
                              setCatOrderInput(String(cat.order || '0'));
                              setCatActiveInput(cat.active !== false);
                            }}
                            className="p-1 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-500 hover:text-black transition-all cursor-pointer"
                            title="Editar Categoria"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1 hover:bg-red-50 border border-red-100 rounded-lg text-red-500 hover:text-[#FF0033] transition-all cursor-pointer"
                            title="Excluir Categoria"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsCategoryCrudOpen(false)}
                className="bg-[#171717] hover:bg-black text-white font-orbitron font-bold text-xs px-6 py-2.5 rounded-2xl shadow cursor-pointer uppercase"
              >
                FECHAR GESTÃO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
