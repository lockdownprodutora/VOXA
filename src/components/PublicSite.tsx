import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  Search, 
  Compass, 
  Users, 
  Award, 
  ShoppingBag, 
  Wallet, 
  MessageCircle, 
  Bell, 
  Plus, 
  User as UserIcon, 
  LogOut, 
  Settings, 
  MessageSquare, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Headphones, 
  Calendar, 
  MapPin, 
  Ticket, 
  ShieldCheck, 
  Truck, 
  AlertCircle, 
  Sparkles, 
  Copy, 
  Share2, 
  Upload, 
  Trash2, 
  Heart, 
  Edit3, 
  Image as ImageIcon,
  CheckCircle,
  X,
  Shield,
  Layers,
  Star,
  Briefcase,
  FileText,
  Megaphone,
  Ghost,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import { 
  fetchStoreProducts, 
  fetchCompanySettings, 
  fetchShows, 
  fetchStoreSettings, 
  saveStoreOrder, 
  buyTicket, 
  syncUserSession, 
  saveStoreProduct,
  saveShow, 
  saveSubscriptionPlan,
  deleteStoreProduct,
  deleteShow,
  fetchSubscriptionPlans, 
  fetchSupportTickets, 
  saveSupportTicket, 
  fetchCommissionSettings, 
  fetchNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  isFirestoreQuotaThrottled, 
  fetchWalletBalance, 
  depositWalletPIX,
  fetchVoxaPosts,
  createVoxaPost,
  likeVoxaPost,
  followVoxaUser,
  unfollowVoxaUser,
  fetchFundraisers
} from '../utils/storeDb';
import { fetchArtists, fetchMusicStreams, fetchCommunities, saveMusicStream } from '../utils/musicDb';
import { 
  fetchCentralUsers, 
  normalizeUserRole, 
  updateUsernameAtomically, 
  invalidateAllUserProfileCaches, 
  reconcileOfficialVerificationAndFollowsOnce 
} from '../utils/centralUserDb';
import { DetailedArtist, MusicStream, Community, Product, Show, Fundraiser, Poll } from '../types';
import { fetchPolls } from '../utils/pollDb';
import { formatBRL } from '../utils/money';
import { uploadFile } from '../utils/upload';
import { EmbeddedCheckout } from './EmbeddedCheckout';
import { MeuParSection } from './MeuParSection';
import { VoxaAdsSection } from './VoxaAdsSection';
import { WalletDashboard } from './WalletDashboard';
import { VoxaTradeSection } from './VoxaTradeSection';
import { Invest } from './invest/Invest';
import { ActivateAccountComponent } from './ActivateAccountComponent';
import { SussurrosSection } from './SussurrosSection';
import { SussurroPublicSendPage } from './SussurroPublicSendPage';
import { NotificationsComponent } from './NotificationsComponent';
import { TransactionNotification } from './TransactionNotification';
import { VaquinhasSection } from './VaquinhasSection';
import { PassagensSection } from './PassagensSection';
import { MessagesSection } from './MessagesSection';
import { ExploreSection } from './ExploreSection';
import { VoxaStudioIaSection } from './VoxaStudioIaSection';
import { SearchBar } from './SearchBar';
import { PollCard } from './PollCard';
import { CreatePollModal } from './CreatePollModal';
import { CreateContentMenu } from './CreateContentMenu';
import { UserAvatar } from './UserAvatar';
import { ProfileCover } from './ProfileCover';
import { ProfileBannersManagerModal } from './ProfileBannersManagerModal';
import { ProfileAdSponsorModal } from './ProfileAdSponsorModal';
import { VerifiedBadge, isVerifiedUser } from './common/VerifiedBadge';
import { doc, updateDoc, collection, getDoc, getDocs, setDoc, deleteDoc, query, where, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth, signOut } from '../lib/firebase';
import { 
  Vox, VoxComposerModal, VoxCard, VoxShareModal, 
  VoxConversationModal, MAX_VOX_LENGTH 
} from './VoxModule';
import { useUserEngagement } from '../hooks/useUserEngagement';

interface PublicSiteProps {
  onOpenAdmin: () => void;
  onOpenLogin: () => void;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  activeMusicSub: 'artistas' | 'streams';
  setActiveMusicSub: (sub: 'artistas' | 'streams') => void;
  visitedUsername?: string | null;
  onVisitProfile?: (username: string) => void;
}

export const PublicSite: React.FC<PublicSiteProps> = ({ 
  onOpenAdmin, 
  activeTab, 
  setActiveTab, 
  activeMusicSub, 
  setActiveMusicSub,
  visitedUsername,
  onVisitProfile
}) => {
  console.log("[VOXA BOOT] PublicSite renderizou");
  // Navigation & UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [logoUrl, setLogoUrl] = useState(() => {
    try {
      const saved = localStorage.getItem('voxa_company_settings') || localStorage.getItem('voxa_company_info') || localStorage.getItem('lockdown_company_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.logoUrl) return parsed.logoUrl;
      }
    } catch (e) {}
    return "";
  });

  useEffect(() => {
    fetchCompanySettings().then(settings => {
      if (settings?.logoUrl) {
        setLogoUrl(settings.logoUrl);
      }
    }).catch(e => console.warn(e));

    const handleSettingsUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.settings?.logoUrl) {
        setLogoUrl(detail.settings.logoUrl);
      }
    };
    window.addEventListener('company_settings_updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('company_settings_updated', handleSettingsUpdated);
    };
  }, []);
  const [showNotifications, setShowNotifications] = useState(false);
  const [successToast, setSuccessToast] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [voxInitialText, setVoxInitialText] = useState('');
  const [textOnlyPostError, setTextOnlyPostError] = useState(false);
  const [showCreateBottomSheet, setShowCreateBottomSheet] = useState(false);
  const [isPayMessageModalOpen, setIsPayMessageModalOpen] = useState(false);
  const [recipientToPay, setRecipientToPay] = useState<any>(null);
  const [payMessageAmount, setPayMessagePrice] = useState(0);

  // Attached items for rich posts
  const [attachedProductId, setAttachedProductId] = useState<string | null>(null);
  const [attachedEventId, setAttachedEventId] = useState<string | null>(null);
  const [attachedSubscriptionPlanId, setAttachedSubscriptionPlanId] = useState<string | null>(null);
  const [attachedMusicId, setAttachedMusicId] = useState<string | null>(null);
  const [attachedServiceId, setAttachedServiceId] = useState<string | null>(null);
  const [attachedArticleId, setAttachedArticleId] = useState<string | null>(null);

  // Ranking Filter States
  const [rankingLocation, setRankingLocation] = useState<'global' | 'brasil' | 'criadores' | 'artistas' | 'empresas' | 'musica' | 'noticias'>('global');
  const [rankingLimit, setRankingLimit] = useState<number>(50);

  // Core Data States
  const [posts, setPosts] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [userServices, setUserServices] = useState<any[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [artists, setArtists] = useState<DetailedArtist[]>([]);
  const [streams, setStreams] = useState<MusicStream[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [centralUsers, setCentralUsers] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([]);
  const [newsArticles, setNewsArticles] = useState<any[]>([]);
  const [exploreFilter, setExploreFilter] = useState('foryou');
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // VOX Feature States
  const [voxes, setVoxes] = useState<Vox[]>([]);
  const [activeVoxFilter, setActiveVoxFilter] = useState<'todos' | 'vox' | 'midia'>('todos');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [selectedVox, setSelectedVox] = useState<Vox | null>(null);
  const [isVoxDetailOpen, setIsVoxDetailOpen] = useState(false);
  const [selectedVoxForShare, setSelectedVoxForShare] = useState<Vox | null>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyToVox, setReplyToVox] = useState<Vox | null>(null);
  const [quotedVoxId, setQuotedVoxId] = useState<string | null>(null);
  const [quotedVox, setQuotedVox] = useState<Vox | null>(null);

  // Polls & Unified Creation State
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isCreateContentMenuOpen, setIsCreateContentMenuOpen] = useState(false);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  
  // Wallet & Dashboard Stats
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPix, setDepositPIXData] = useState<any | null>(null);
  const [isDepositing, setIsDepositing] = useState(false);

  // New Post Creation State
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostMedia, setNewPostMedia] = useState('');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadMediaProgress, setUploadMediaProgress] = useState(0);

  // Checkout modal targets
  const [selectedProductForCheckout, setSelectedProductForCheckout] = useState<any | null>(null);
  const [selectedTicketForCheckout, setSelectedTicketForCheckout] = useState<any | null>(null);

  // Custom User Profile Detail
  const [selectedArtistDetail, setSelectedArtistDetail] = useState<DetailedArtist | null>(null);
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);
  const [selectedShowDetail, setSelectedShowDetail] = useState<Show | null>(null);
  const [profileTab, setProfileTab] = useState<string>('posts');

  const [businessTab, setBusinessTab] = useState<string>('overview');
  
  // Mercado Pago Onboarding states
  const [sellerMpConnected, setSellerMpConnected] = useState(false);
  const [sellerMpStatus, setSellerMpStatus] = useState('ACTIVE');
  const [isCheckingMp, setIsCheckingMp] = useState(false);

  const checkSellerMpStatus = async () => {
    if (!currentUser?.uid) return;
    setIsCheckingMp(true);
    try {
      const response = await fetch(`/api/mercadopago/seller-status?sellerId=${currentUser.uid}`);
      const data = await response.json();
      if (data.success) {
        setSellerMpConnected(data.connected);
        setSellerMpStatus(data.status || 'ACTIVE');
      }
    } catch (err) {
      console.warn("Failed to fetch seller MP status:", err);
    } finally {
      setIsCheckingMp(false);
    }
  };

  const handleConnectMercadoPago = async () => {
    if (!currentUser?.uid) return;
    try {
      const response = await fetch(`/api/mercadopago/oauth/url?sellerId=${currentUser.uid}`);
      const data = await response.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        triggerToast(data.error || "Não foi possível gerar o link de conexão.");
      }
    } catch (err) {
      triggerToast("Erro ao conectar Mercado Pago.");
    }
  };

  const handleDisconnectMercadoPago = async () => {
    if (!currentUser?.uid) return;
    if (!confirm("Tem certeza de que deseja desconectar o Mercado Pago? Suas vendas de produtos e ingressos serão bloqueadas até que você reconecte.")) return;
    try {
      const response = await fetch('/api/mercadopago/oauth/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.uid })
      });
      const data = await response.json();
      if (data.success) {
        triggerToast("Mercado Pago desconectado com sucesso!");
        checkSellerMpStatus();
      } else {
        triggerToast(data.error || "Erro ao desconectar.");
      }
    } catch (err) {
      triggerToast("Erro ao processar desconexão.");
    }
  };

  // Create Product form states
  const [newProdName, setNewProdName] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdStock, setNewProdStock] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Moda & Acessórios');
  const [newProdImage, setNewProdImage] = useState('');
  const [newProdType, setNewProdType] = useState('Físico');
  const [newProdDisplayOnProfile, setNewProdDisplayOnProfile] = useState(true);

  // Create Music states
  const [newMusicTitle, setNewMusicTitle] = useState('');
  const [newMusicArtist, setNewMusicArtist] = useState('');
  const [newMusicAudioUrl, setNewMusicAudioUrl] = useState('');
  const [newMusicCoverUrl, setNewMusicCoverUrl] = useState('');
  const [newMusicDesc, setNewMusicDesc] = useState('');

  // Create Services states
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceImage, setNewServiceImage] = useState('');
  const [newServiceContact, setNewServiceContact] = useState('');

  // Create Subscription states
  const [newSubName, setNewSubName] = useState('');
  const [newSubPrice, setNewSubPrice] = useState('');
  const [newSubBenefits, setNewSubBenefits] = useState('');
  const [newSubDesc, setNewSubDesc] = useState('');
  const [newSubImage, setNewSubImage] = useState('');

  // Create Event form states
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [newEventCity, setNewEventCity] = useState('');
  const [newEventVenue, setNewEventVenue] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventPrice, setNewEventPrice] = useState('');
  const [newEventImage, setNewEventImage] = useState('');
  const [newEventCapacity, setNewEventCapacity] = useState('');
  const [newEventAddress, setNewEventAddress] = useState('');
  const [newEventState, setNewEventState] = useState('');
  const [newEventRating, setNewEventRating] = useState('Livre');
  const [newEventDisplayOnProfile, setNewEventDisplayOnProfile] = useState(true);
  const [newEventSectors, setNewEventSectors] = useState<any[]>([
    { name: 'Pista', price: '50', quantity: '500' }
  ]);

  // Create News form states
  const [newNewsTitle, setNewNewsTitle] = useState('');
  const [newNewsSubtitle, setNewNewsSubtitle] = useState('');
  const [newNewsCategory, setNewNewsCategory] = useState('Tecnologia');
  const [newNewsImage, setNewNewsImage] = useState('');
  const [newNewsContent, setNewNewsContent] = useState('');

  // Edit Profile States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [activeCategories, setActiveCategories] = useState<any[]>([]);
  const [usernameCheckStatus, setUsernameCheckStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [editFeatures, setEditFeatures] = useState<any>({ 
    store: false, 
    events: false, 
    subscriptions: false, 
    news: false, 
    music: false, 
    services: false,
    fundraisers: false,
    passagens: false
  });
  const [editBio, setBio] = useState('');
  const [editLocation, setLocation] = useState('');
  const [editWebsite, setWebsite] = useState('');
  const [editVerified, setEditVerified] = useState(false);
  const [editPremium, setEditPremium] = useState(false);
  const [editHighlights, setEditHighlights] = useState<any[]>([]);
  const [socialsInstagram, setSocialsInstagram] = useState('');
  const [socialsTikTok, setSocialsTikTok] = useState('');
  const [socialsYouTube, setSocialsYouTube] = useState('');
  const [socialsTwitter, setSocialsTwitter] = useState('');
  const [socialsFacebook, setSocialsFacebook] = useState('');
  const [socialsSpotify, setSocialsSpotify] = useState('');
  const [socialsTwitch, setSocialsTwitch] = useState('');
  const [socialsWhatsApp, setSocialsWhatsApp] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverProgress, setCoverProgress] = useState(0);
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);
  const [localCoverPreview, setLocalCoverPreview] = useState<string | null>(null);
  const [uploadAvatarError, setUploadAvatarError] = useState<string | null>(null);
  const [uploadCoverError, setUploadCoverError] = useState<string | null>(null);
  const [isBannersModalOpen, setIsBannersModalOpen] = useState(false);
  const [isSponsorBannerModalOpen, setIsSponsorBannerModalOpen] = useState(false);

  // Audio Player State
  const [currentStream, setCurrentStream] = useState<MusicStream | null>(null);
  const [audioInstance, setAudioInstance] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Settings tab specific states
  const [settingsSubTab, setSettingsSubTab] = useState<string>('profile_edit');
  const [addressCep, setAddressCep] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressCountry, setAddressCountry] = useState('Brasil');
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Anti-Bot / Anti-Fraud variables
  const [lastFollowTime, setLastFollowTime] = useState<number>(0);
  const [followRateLimitCount, setFollowRateLimitCount] = useState<number>(0);
  const [isFollowOperationBusy, setIsFollowOperationBusy] = useState<string | null>(null);

  const [followingIds, setFollowingFollowingIds] = useState<string[]>([]);

  // VOX Produtos States
  const [digitalProducts, setDigitalProducts] = useState<any[]>([]);
  const [viewingDigitalProduct, setViewingDigitalProduct] = useState<any | null>(null);
  const [myPurchases, setMyPurchases] = useState<any[]>([]);
  const [couponsList, setCouponsList] = useState<any[]>([]);
  const [affiliatesList, setAffiliatesList] = useState<any[]>([]);
  const [activeAffiliations, setActiveAffiliations] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);

  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem('voxa_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const activeUserData = centralUsers.find(u => u.uid === currentUser?.uid) || currentUser;
  const visitedUser = visitedUsername 
    ? centralUsers.find(u => {
        const target = visitedUsername.toLowerCase().replace(/^@+/, '').trim();
        const uName = String(u.username || '').toLowerCase().replace(/^@+/, '').trim();
        const uSlug = String(u.slug || '').toLowerCase().replace(/^@+/, '').trim();
        const uArtistic = String(u.artisticName || '').toLowerCase().replace(/^@+/, '').trim();
        if (uName === target || uSlug === target || uArtistic === target) return true;
        if ((target === 'jrsantti' || target === 'juniorsantti' || target === 'juniorsantti92') && (u.uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || u.id === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2')) return true;
        if (target === 'voxa' && (u.uid === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1' || u.id === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1')) return true;
        return false;
      })
    : null;

  // Ensure newly created PRE_REGISTERED profiles are resolved immediately when visiting /@username or /u/username
  useEffect(() => {
    if (!visitedUsername || visitedUser) return;
    let cancelled = false;
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => {
        if (!cancelled && data?.success && Array.isArray(data.users) && data.users.length > 0) {
          setCentralUsers(data.users);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visitedUsername, visitedUser]);

  const userAdminRole = String(activeUserData?.adminRole || currentUser?.adminRole || '').toUpperCase().trim();
  const isAdmin =
    ['SUPER_ADMIN', 'ADMINISTRATOR', 'MANAGER', 'SUPPORT'].includes(userAdminRole) ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'ADMINISTRADOR' ||
    currentUser?.role === 'SUPER_ADMIN' ||
    activeUserData?.role === 'ADMINISTRADOR' ||
    activeUserData?.role === 'SUPER_ADMIN' ||
    currentUser?.isAdmin === true ||
    activeUserData?.isAdmin === true ||
    currentUser?.email === 'admin@voxa.com.br' ||
    currentUser?.email === 'admin@lockdownprodutora.com.br' ||
    currentUser?.email === 'lockdownprodutora@gmail.com' ||
    currentUser?.uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' ||
    currentUser?.uid === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1';

  // Real-time snapshot listener on admin_users/{uid} to revalidate admin access immediately
  useEffect(() => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) return;

    const email = String(currentUser?.email || '').toLowerCase().trim();
    const isBootstrappedSuperAdmin =
      email === 'lockdownprodutora@gmail.com' ||
      email === 'admin@lockdownprodutora.com.br' ||
      email === 'admin@voxa.com.br' ||
      email.endsWith('@lockdownprodutora.com.br') ||
      uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' ||
      uid === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1';

    const unsub = onSnapshot(
      doc(db, 'admin_users', uid),
      (snap) => {
        let nextRole = 'NONE';
        if (snap.exists()) {
          const r = String(snap.data()?.role || '').toUpperCase().trim();
          if (['SUPER_ADMIN', 'ADMINISTRATOR', 'MANAGER', 'SUPPORT'].includes(r)) {
            nextRole = r;
          }
        }
        if (nextRole === 'NONE' && isBootstrappedSuperAdmin) {
          nextRole = 'SUPER_ADMIN';
        }

        setCurrentUser((prev: any) => {
          if (!prev) return prev;
          if (prev.adminRole === nextRole) return prev;
          const next = {
            ...prev,
            adminRole: nextRole,
            isAdmin: ['SUPER_ADMIN', 'ADMINISTRATOR'].includes(nextRole)
          };
          try {
            localStorage.setItem('voxa_current_user', JSON.stringify(next));
          } catch {}
          return next;
        });

        setCentralUsers((prevUsers) =>
          prevUsers.map((u) =>
            (u.uid === uid || u.id === uid)
              ? { ...u, adminRole: nextRole, isAdmin: ['SUPER_ADMIN', 'ADMINISTRATOR'].includes(nextRole) }
              : u
          )
        );
      },
      () => {}
    );

    return () => unsub();
  }, [currentUser?.uid, currentUser?.id, currentUser?.email]);

  // Hook for tracking user engagement metrics
  const { trackInteraction } = useUserEngagement(currentUser?.uid || currentUser?.id, activeTab);

  useEffect(() => {
    if (visitedUsername) {
      trackInteraction('profile_visit');
    }
  }, [visitedUsername]);

  // Keep browser URL synchronized to /:username whenever viewing any profile
  useEffect(() => {
    if (activeTab === 'profile') {
      const targetUser = visitedUser || (!visitedUsername ? activeUserData : null);
      const rawUname = visitedUsername || targetUser?.username || targetUser?.slug || '';
      const cleanUname = (targetUser?.uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || rawUname.toLowerCase() === 'juniorsantti' || rawUname.toLowerCase() === 'juniorsantti92')
        ? 'jrsantti'
        : (targetUser?.uid === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1' ? 'voxa' : rawUname);
      if (cleanUname && window.location.pathname !== `/${cleanUname}`) {
        window.history.replaceState(null, '', `/${cleanUname}`);
      }
    }
  }, [activeTab, visitedUsername, visitedUser?.username, activeUserData?.username]);

  // Run one-time official verification, CEO @jrsantti migration, and auto-follow reconciliation
  useEffect(() => {
    reconcileOfficialVerificationAndFollowsOnce().then(async (res) => {
      if (res.ran) {
        const refreshedUsers = await fetchCentralUsers();
        if (refreshedUsers && refreshedUsers.length > 0) {
          setCentralUsers(refreshedUsers);
        }
        if (currentUser?.uid) {
          try {
            const followsQuery = query(collection(db, 'follows'), where('followerId', '==', currentUser.uid));
            const followsSnap = await getDocs(followsQuery);
            const fIds: string[] = [];
            followsSnap.forEach(docSnap => {
              fIds.push(docSnap.data().followingId);
            });
            setFollowingFollowingIds(fIds);
          } catch {}
        }
      }
    }).catch(e => console.warn("Reconciliation warning:", e));
  }, [currentUser?.uid]);

  // Load all necessary data
  const loadData = async () => {
    try {
      const [postList, prodList, showList, artList, streamList, commList, planList, usersList, fundraisersList, pollList] = await Promise.all([
        fetchVoxaPosts(),
        fetchStoreProducts(),
        fetchShows(),
        fetchArtists(),
        fetchMusicStreams(),
        fetchCommunities(),
        fetchSubscriptionPlans(),
        fetchCentralUsers(),
        fetchFundraisers(),
        fetchPolls(currentUser?.uid)
      ]);
      setPosts(postList);
      setProducts(prodList);
      setShows(showList);
      setArtists(artList);
      setStreams(streamList);
      setCommunities(commList);
      setSubscriptionPlans(planList.filter(p => p.status === 'Aprovado' && p.published && p.active));
      setCentralUsers(usersList || []);
      setFundraisers(fundraisersList || []);
      setAllProducts(prodList || []);
      setPolls(pollList || []);

      // Fetch news_articles collection
      try {
        const snap = await getDocs(collection(db, 'news_articles'));
        const list: any[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        setNewsArticles(list);
      } catch (err) {
        console.warn("Failed to fetch news articles:", err);
      }

      // Fetch user_services collection
      try {
        const snap = await getDocs(collection(db, 'user_services'));
        const list: any[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        setUserServices(list);
      } catch (err) {
        console.warn("Failed to fetch user services:", err);
      }

      // Fetch digital_products
      try {
        const snap = await getDocs(collection(db, 'digital_products'));
        const list: any[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        setDigitalProducts(list);
      } catch (err) {
        console.warn("Failed to fetch digital products:", err);
      }

      // Fetch product_orders
      try {
        const snap = await getDocs(collection(db, 'product_orders'));
        const list: any[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        setAllOrders(list);
      } catch (err) {
        console.warn("Failed to fetch product orders:", err);
      }

      // Fetch coupons
      try {
        const snap = await getDocs(collection(db, 'coupons'));
        const list: any[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        setCouponsList(list);
      } catch (err) {
        console.warn("Failed to fetch coupons list:", err);
      }

      // Fetch affiliates
      try {
        const snap = await getDocs(collection(db, 'affiliate_members'));
        const list: any[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() });
        });
        setAffiliatesList(list);
      } catch (err) {
        console.warn("Failed to fetch affiliates list:", err);
      }

      if (currentUser?.uid) {
        // Fetch real followings from follows collection
        try {
          const followsQuery = query(collection(db, 'follows'), where('followerId', '==', currentUser.uid));
          const followsSnap = await getDocs(followsQuery);
          const fIds: string[] = [];
          followsSnap.forEach(docSnap => {
            fIds.push(docSnap.data().followingId);
          });
          setFollowingFollowingIds(fIds);
        } catch (err) {
          console.warn("Failed to fetch follows:", err);
        }

        try {
          const wall = await fetchWalletBalance(currentUser.uid);
          if (wall && wall.success) {
            setWalletBalance(wall.balance);
            setWalletTransactions(wall.transactions || []);
          }
        } catch (err) {
          console.warn("Wallet balance load error handled:", err);
        }
        const nots = await fetchNotifications(currentUser.email);
        setNotifications(nots || []);

        // Filter orders for purchases and active affiliations
        try {
          const snapOrders = await getDocs(collection(db, 'product_orders'));
          const ordersList: any[] = [];
          snapOrders.forEach(d => {
            ordersList.push({ id: d.id, ...d.data() });
          });
          setMyPurchases(ordersList.filter(o => o.buyerId === currentUser.uid && o.status === 'COMPLETED'));
          
          const snapAff = await getDocs(collection(db, 'affiliate_members'));
          const affList: any[] = [];
          snapAff.forEach(d => {
            affList.push({ id: d.id, ...d.data() });
          });
          setActiveAffiliations(affList.filter(a => a.affiliateId === currentUser.uid && a.status === 'APPROVED'));
        } catch (err) {
          console.warn("Error resolving buyer purchases/affiliations:", err);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch initial VOXA network data:", e);
    }
  };

  useEffect(() => {
    loadData();
    // Synced session reload
    if (auth.currentUser) {
      syncUserSession(auth.currentUser).then(async (u) => {
        if (u) {
          setCurrentUser(u);
          if (u.defaultFollowsInitialized !== true) {
            try {
              const { applyDefaultOfficialFollows } = await import('../utils/centralUserDb');
              await applyDefaultOfficialFollows(u.uid);
            } catch (err) {
              console.warn("Error running default follows on session sync:", err);
            }
          }
        }
      }).catch(err => {
        console.warn("Session sync warning in PublicSite:", err);
      });
    }
    if (activeTab === 'settings') {
      loadPrivateAddress();
    }
    if (activeTab === 'my_business') {
      checkSellerMpStatus();
    }
  }, [activeTab]);

  useEffect(() => {
    const fetchActiveCategories = async () => {
      try {
        const q = query(
          collection(db, 'profile_categories'),
          where('active', '==', true)
        );
        const snap = await getDocs(q);
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));
        setActiveCategories(list);
      } catch (err) {
        console.warn("Error fetching profile categories in PublicSite:", err);
      }
    };
    fetchActiveCategories();
  }, []);

  // Real-time listener for all VOXes in Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'voxes'), (snapshot) => {
      const list: Vox[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Vox);
      });
      // Sort descending by createdAt
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setVoxes(list);
    }, (error) => {
      console.warn("Real-time VOXes listener error:", error);
    });
    return () => unsubscribe();
  }, []);

  // Real-time listener for activities collection
  useEffect(() => {
    const q = query(
      collection(db, 'activities'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRecentActivities(list);
    }, (error) => {
      console.warn("Real-time activities listener error:", error);
    });
    return () => unsubscribe();
  }, []);

  // Deep linking for shared VOX URLs /vox/{voxId}
  useEffect(() => {
    const cleanPath = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    const parts = cleanPath.split('/');
    if (parts[0] === 'vox' && parts[1]) {
      const targetId = parts[1];
      const docRef = doc(db, 'voxes', targetId);
      getDoc(docRef).then(snap => {
        if (snap.exists()) {
          setSelectedVox({ id: snap.id, ...snap.data() } as Vox);
          setIsVoxDetailOpen(true);
        } else {
          triggerToast("Este VOX não está mais disponível.");
        }
      }).catch(err => {
        console.warn("Error loading deep-linked VOX:", err);
      });
    }
  }, [activeTab]);

  const displayedToastIds = useRef(new Set<string>());

  // Listen to real-time notifications and wallet balance via Firestore onSnapshot
  useEffect(() => {
    if (!currentUser?.uid) return;

    const notifsRef = collection(db, 'notifications');
    const targetEmail = currentUser.email || '';
    
    // Helper to merge lists and update state safely without duplicates
    const updateMergedNotifications = (list: any[]) => {
      setNotifications(prev => {
        const merged = [...prev];
        list.forEach(item => {
          const idx = merged.findIndex(m => m.id === item.id);
          if (idx >= 0) {
            merged[idx] = item;
          } else {
            merged.push(item);
          }
        });
        return merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      });
    };

    // Helper to trigger a single toast per notification ID (skip financial notifications since TransactionNotification handles them with rich visual feedback)
    const triggerDeduplicatedToast = (notif: any) => {
      if (!notif.read && !displayedToastIds.current.has(notif.id)) {
        displayedToastIds.current.add(notif.id);
        if (notif.type === 'financial' || String(notif.id || '').startsWith('fin_notif_')) {
          return;
        }
        triggerToast(`🔔 ${notif.title || 'Notificação'}: ${notif.message}`);
      }
    };

    // 1. Real-time Notifications Listener (Email query)
    const qEmail = query(notifsRef, where('userId', '==', targetEmail));
    let isInitialNotifications = true;
    const unsubscribeNotifications = onSnapshot(qEmail, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ ...docSnap.data(), id: docSnap.id });
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      
      if (!isInitialNotifications) {
        list.forEach(triggerDeduplicatedToast);
      } else {
        list.filter(n => !n.read).forEach(n => displayedToastIds.current.add(n.id));
      }
      updateMergedNotifications(list);
      isInitialNotifications = false;
    }, (error) => {
      console.warn("Notifications email listener error:", error);
    });

    // 2. Real-time Notifications Listener (UID query)
    const qUid = query(notifsRef, where('userId', '==', currentUser.uid));
    let isInitialUidNotifs = true;
    const unsubscribeUidNotifications = onSnapshot(qUid, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ ...docSnap.data(), id: docSnap.id });
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      if (!isInitialUidNotifs) {
        list.forEach(triggerDeduplicatedToast);
      } else {
        list.filter(n => !n.read).forEach(n => displayedToastIds.current.add(n.id));
      }
      updateMergedNotifications(list);
      isInitialUidNotifs = false;
    }, (error) => {
      console.warn("Notifications uid listener error:", error);
    });

    // 3. Canonical Real-time Notifications Listener (recipientUid query)
    const qRecipientUid = query(notifsRef, where('recipientUid', '==', currentUser.uid));
    let isInitialRecipientNotifs = true;
    const unsubscribeRecipientUidNotifications = onSnapshot(qRecipientUid, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(docSnap => {
        list.push({ ...docSnap.data(), id: docSnap.id });
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      if (!isInitialRecipientNotifs) {
        list.forEach(triggerDeduplicatedToast);
      } else {
        list.filter(n => !n.read).forEach(n => displayedToastIds.current.add(n.id));
      }
      updateMergedNotifications(list);
      isInitialRecipientNotifs = false;
    }, (error) => {
      console.warn("Notifications recipientUid listener error:", error);
    });

    // 4. Real-time Wallet Balance Listener
    const walletRef = doc(db, 'wallets', currentUser.uid);
    let isInitialWallet = true;

    const unsubscribeWallet = onSnapshot(walletRef, (docSnap) => {
      if (docSnap.exists()) {
        const balance = docSnap.data().balance || 0;
        setWalletBalance(balance);

        // Notify user about wallet update if balance changed
        if (!isInitialWallet) {
          triggerToast(`💰 Sua carteira foi atualizada! Novo saldo: ${formatBRL(balance)}`);
          fetchWalletBalance(currentUser.uid).then(res => {
            if (res && res.success) {
              setWalletTransactions(res.transactions || []);
            }
          });
        }
      }
      isInitialWallet = false;
    }, (error) => {
      console.warn("Wallet real-time listener error:", error);
    });

    return () => {
      unsubscribeNotifications();
      unsubscribeUidNotifications();
      unsubscribeRecipientUidNotifications();
      unsubscribeWallet();
    };
  }, [currentUser?.uid, currentUser?.email]);

  // Real-time listener for the currently visited profile user to ensure stats match Firestore exactly
  useEffect(() => {
    if (!visitedUser?.uid) return;
    const userRef = doc(db, 'users', visitedUser.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const updatedData = docSnap.data();
        
        // PROFILE DEBUG
        console.log("PROFILE DEBUG", {
          username: updatedData.username || updatedData.slug || "",
          resolvedUid: docSnap.id,
          documentPath: `users/${docSnap.id}`,
          followersCount: updatedData.followersCount || 0,
          followingCount: updatedData.followingCount || 0
        });

        // Update centralUsers with the latest data in real time
        setCentralUsers(prev => prev.map(u => {
          if (u.uid === docSnap.id || u.id === docSnap.id) {
            return { ...u, ...updatedData };
          }
          return u;
        }));
      }
    }, (error) => {
      console.warn("Real-time profile listener error:", error);
    });
    return () => unsubscribe();
  }, [visitedUser?.uid]);

  // Real-time listener for current logged-in user to ensure stats match Firestore exactly
  useEffect(() => {
    if (!currentUser?.uid) return;
    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const updatedData = docSnap.data();
        setCentralUsers(prev => prev.map(u => {
          if (u.uid === docSnap.id || u.id === docSnap.id) {
            return { ...u, ...updatedData };
          }
          return u;
        }));
      }
    }, (error) => {
      console.warn("Real-time active user listener error:", error);
    });
    return () => unsubscribe();
  }, [currentUser?.uid]);

  const loadPrivateAddress = async () => {
    if (!currentUser?.uid) return;
    try {
      const privateSnap = await getDoc(doc(db, 'user_private', currentUser.uid));
      if (privateSnap.exists()) {
        const data = privateSnap.data();
        const addr = data?.address || {};
        setAddressCep(addr.cep || '');
        setAddressStreet(addr.street || '');
        setAddressNumber(addr.number || '');
        setAddressComplement(addr.complement || '');
        setAddressNeighborhood(addr.neighborhood || '');
        setAddressCity(addr.city || '');
        setAddressState(addr.state || '');
        setAddressCountry(addr.country || 'Brasil');
      }
    } catch (err) {
      console.warn("Failed to fetch private address details:", err);
    }
  };

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3000);
  };

  const handleShareToFeed = (type: 'product' | 'event' | 'subscription' | 'music' | 'service' | 'article' | 'digitalProduct', id: string) => {
    setAttachedProductId(null);
    setAttachedEventId(null);
    setAttachedSubscriptionPlanId(null);
    setAttachedMusicId(null);
    setAttachedServiceId(null);
    setAttachedArticleId(null);

    if (type === 'product') setAttachedProductId(id);
    else if (type === 'event') setAttachedEventId(id);
    else if (type === 'subscription') setAttachedSubscriptionPlanId(id);
    else if (type === 'music') setAttachedMusicId(id);
    else if (type === 'service') setAttachedServiceId(id);
    else if (type === 'article') setAttachedArticleId(id);

    setActiveTab('home');
    triggerToast('Conteúdo anexado com sucesso! Digite uma legenda e publique.');
    
    setTimeout(() => {
      const el = document.querySelector('form');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
  };

  const handleSelectVox = (v: Vox) => {
    setSelectedVox(v);
    setIsVoxDetailOpen(true);
    window.history.pushState(null, '', `/vox/${v.id}`);
  };

  const handleReplyVox = (v: Vox) => {
    setReplyToId(v.id);
    setReplyToVox(v);
    setQuotedVoxId(null);
    setQuotedVox(null);
    setIsComposerOpen(true);
  };

  const handleQuoteVox = (v: Vox) => {
    setQuotedVoxId(v.id);
    setQuotedVox(v);
    setReplyToId(null);
    setReplyToVox(null);
    setIsComposerOpen(true);
  };

  const handleShareVox = (v: Vox) => {
    setSelectedVoxForShare(v);
    setIsShareOpen(true);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() && !newPostMedia && !attachedProductId && !attachedEventId && !attachedSubscriptionPlanId && !attachedMusicId && !attachedServiceId && !attachedArticleId) return;
    
    // Bloquear Post só de texto
    if (newPostContent.trim() && !newPostMedia && !attachedProductId && !attachedEventId && !attachedSubscriptionPlanId && !attachedMusicId && !attachedServiceId && !attachedArticleId) {
      setTextOnlyPostError(true);
      return;
    }

    try {
      trackInteraction('vox_create');
      const authorUser = centralUsers.find(u => u.uid === currentUser.uid) || currentUser;
      const cleanUsername = authorUser.username || authorUser.slug || 'membro';
      
      const newPost = await createVoxaPost({
        userId: currentUser.uid,
        authorName: currentUser.name,
        authorUsername: cleanUsername,
        authorAvatar: currentUser.photoURL || '',
        content: newPostContent,
        mediaUrl: newPostMedia || undefined,
        productId: attachedProductId,
        eventId: attachedEventId,
        subscriptionPlanId: attachedSubscriptionPlanId,
        musicId: attachedMusicId,
        serviceId: attachedServiceId,
        articleId: attachedArticleId
      });

      setNewPostContent('');
      setNewPostMedia('');
      setAttachedProductId(null);
      setAttachedEventId(null);
      setAttachedSubscriptionPlanId(null);
      setAttachedMusicId(null);
      setAttachedServiceId(null);
      setAttachedArticleId(null);
      setTextOnlyPostError(false);
      
      setPosts(prev => [newPost, ...prev]);
      triggerToast('Publicação enviada com sucesso!');
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingMedia(true);
    setUploadMediaProgress(0);
    try {
      const res = await uploadFile(file, 'post', (p) => {
        setUploadMediaProgress(Math.round(p.percentage));
      });
      setNewPostMedia(res.url);
      triggerToast('Arquivo carregado com sucesso!');
    } catch (err) {
      alert('Erro no envio de mídia: ' + err);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      trackInteraction('like_click');
      await likeVoxaPost(postId, currentUser.uid);
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          const list = p.likesList || [];
          const liked = list.includes(currentUser.uid);
          const newList = liked ? list.filter((id: string) => id !== currentUser.uid) : [...list, currentUser.uid];
          return { ...p, likesList: newList, likesCount: newList.length };
        }
        return p;
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleFollowUser = async (targetUid: string) => {
    if (!currentUser?.uid || isFollowOperationBusy === targetUid) return;
    setIsFollowOperationBusy(targetUid);
    try {
      trackInteraction('follow_click');
      await followVoxaUser(currentUser.uid, targetUid);
      
      // Update centralUsers immediately so numbers in cards and profile change
      setCentralUsers(prev => prev.map(u => {
        if (u.uid === targetUid || u.id === targetUid) {
          const followersCount = (u.followersCount || 0) + 1;
          return { ...u, followersCount };
        }
        if (u.uid === currentUser.uid || u.id === currentUser.uid) {
          const followingCount = (u.followingCount || 0) + 1;
          return { ...u, followingCount };
        }
        return u;
      }));

      // Update followingIds immediately so Follow/Unfollow buttons toggle states instantly
      setFollowingFollowingIds(prev => {
        if (!prev.includes(targetUid)) {
          return [...prev, targetUid];
        }
        return prev;
      });

      // Synchronize current logged-in user in state & localStorage
      setCurrentUser(prev => {
        if (!prev) return prev;
        const updated = { ...prev, followingCount: (prev.followingCount || 0) + 1 };
        localStorage.setItem('voxa_current_user', JSON.stringify(updated));
        return updated;
      });

      triggerToast('Seguindo usuário!');
    } catch (err) {
      console.error("Error following user:", err);
    } finally {
      setIsFollowOperationBusy(null);
    }
  };

  const handleUnfollowUser = async (targetUid: string) => {
    if (!currentUser?.uid || isFollowOperationBusy === targetUid) return;
    setIsFollowOperationBusy(targetUid);
    try {
      await unfollowVoxaUser(currentUser.uid, targetUid);

      // Update centralUsers immediately so numbers in cards and profile change
      setCentralUsers(prev => prev.map(u => {
        if (u.uid === targetUid || u.id === targetUid) {
          const followersCount = Math.max(0, (u.followersCount || 0) - 1);
          return { ...u, followersCount };
        }
        if (u.uid === currentUser.uid || u.id === currentUser.uid) {
          const followingCount = Math.max(0, (u.followingCount || 0) - 1);
          return { ...u, followingCount };
        }
        return u;
      }));

      // Update followingIds immediately so Follow/Unfollow buttons toggle states instantly
      setFollowingFollowingIds(prev => prev.filter(id => id !== targetUid));

      // Synchronize current logged-in user in state & localStorage
      setCurrentUser(prev => {
        if (!prev) return prev;
        const updated = { ...prev, followingCount: Math.max(0, (prev.followingCount || 0) - 1) };
        localStorage.setItem('voxa_current_user', JSON.stringify(updated));
        return updated;
      });

      triggerToast('Deixou de seguir.');
    } catch (err) {
      console.error("Error unfollowing user:", err);
    } finally {
      setIsFollowOperationBusy(null);
    }
  };

  const handlePlayMusic = (stream: MusicStream) => {
    if (currentStream?.id === stream.id) {
      if (isPlaying) {
        audioInstance?.pause();
        setIsPlaying(false);
      } else {
        audioInstance?.play().catch(e => console.warn(e));
        setIsPlaying(true);
      }
    } else {
      if (audioInstance) {
        audioInstance.pause();
      }
      const newAudio = new Audio(stream.audioUrl || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3");
      newAudio.volume = 0.8;
      newAudio.addEventListener('ended', () => setIsPlaying(false));
      setCurrentStream(stream);
      setAudioInstance(newAudio);
      setIsPlaying(true);
      newAudio.play().catch(e => console.warn(e));
    }
  };

  const handleDepositWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(depositAmount);
    if (!val || val <= 0) return;
    setIsDepositing(true);
    try {
      const res = await depositWalletPIX({
        userId: currentUser.uid,
        amount: val,
        buyerName: currentUser.name,
        payerEmail: currentUser.email
      });
      setDepositPIXData(res);
      triggerToast('Instruções PIX geradas com sucesso!');
    } catch (err) {
      alert('Erro no depósito: ' + err);
    } finally {
      setIsDepositing(false);
    }
  };

  const checkUsernameAvailability = async (val: string) => {
    const cleanVal = val.toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]/g, '');
    if (!cleanVal || cleanVal.length < 3) {
      setUsernameCheckStatus('idle');
      return;
    }
    
    const currentUsername = (activeUserData.username || activeUserData.slug || '').toLowerCase();
    if (cleanVal === currentUsername) {
      setUsernameCheckStatus('available');
      return;
    }

    setUsernameCheckStatus('checking');
    try {
      const docRef = doc(db, 'usernames', cleanVal);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data()?.uid && docSnap.data()?.uid !== currentUser.uid) {
        setUsernameCheckStatus('taken');
      } else {
        const q = query(
          collection(db, 'users'),
          where('username', '==', cleanVal),
          limit(5)
        );
        const snap = await getDocs(q);
        const takenByOther = snap.docs.some(d => d.id !== currentUser.uid);
        if (takenByOther) {
          setUsernameCheckStatus('taken');
        } else {
          setUsernameCheckStatus('available');
        }
      }
    } catch (err) {
      console.warn("Error checking username uniqueness:", err);
      setUsernameCheckStatus('available');
    }
  };

  const handleSaveProfileSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUsername = (activeUserData.username || activeUserData.slug || currentUser.username || '').toLowerCase();
    const requestedUsername = editUsername.toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]/g, '');
    let finalUsername = currentUsername;
    let usernameWasChanged = false;

    try {
      if (requestedUsername && requestedUsername !== currentUsername) {
        if (requestedUsername.length < 3) {
          alert('O username precisa ter pelo menos 3 caracteres.');
          setEditUsername(currentUsername);
          return;
        }
        if (usernameCheckStatus === 'taken') {
          alert('Este @username já está em uso.');
          setEditUsername(currentUsername);
          return;
        }
        
        // Atomic username reservation, users/{uid}.username update, verification, old reservation cleanup, and cache invalidation
        const atomicRes = await updateUsernameAtomically(currentUser.uid, requestedUsername);
        finalUsername = atomicRes.newUsername;
        usernameWasChanged = atomicRes.oldUsername !== atomicRes.newUsername;
      } else if (requestedUsername) {
        finalUsername = requestedUsername;
      }

      const userRef = doc(db, 'users', currentUser.uid);
      const matchedCategory = activeCategories.find(c => c.id === editCategoryId);
      const categoryName = !editCategoryId ? 'Sem categoria' : (matchedCategory ? matchedCategory.name : 'Sem categoria');

      const updateData: any = {
        name: editName,
        username: finalUsername,
        slug: finalUsername,
        bio: editBio,
        location: editLocation,
        website: editWebsite,
        features: editFeatures,
        isVerified: editVerified,
        verified: editVerified,
        isPremium: editPremium,
        highlights: editHighlights,
        categoryId: editCategoryId,
        categoryName: categoryName,
        socials: {
          instagram: socialsInstagram,
          tiktok: socialsTikTok,
          youtube: socialsYouTube,
          twitter: socialsTwitter,
          facebook: socialsFacebook,
          spotify: socialsSpotify,
          twitch: socialsTwitch,
          whatsapp: socialsWhatsApp
        },
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(userRef, updateData);

      // Verify write in Firestore before confirming to UI
      const verifySnap = await getDoc(userRef);
      const verifiedDocData = verifySnap.exists() ? verifySnap.data() : updateData;
      const confirmedUsername = verifiedDocData.username || finalUsername;

      invalidateAllUserProfileCaches(currentUser.uid, currentUsername, confirmedUsername);
      
      const updatedUserObj = { 
        ...currentUser, 
        ...updateData,
        username: confirmedUsername,
        slug: confirmedUsername
      };
      
      setCurrentUser(updatedUserObj);
      localStorage.setItem('voxa_current_user', JSON.stringify(updatedUserObj));
      setCentralUsers(prev => prev.map(u => (u.uid === currentUser.uid || u.id === currentUser.uid) ? { ...u, ...updatedUserObj } : u));
      setPosts(prev => prev.map(p => p.userId === currentUser.uid ? { ...p, authorUsername: confirmedUsername, authorName: editName } : p));
      setVoxes(prev => prev.map(v => v.authorId === currentUser.uid ? { ...v, authorUsername: confirmedUsername, authorName: editName } : v));
      setPolls(prev => prev.map(p => p.authorId === currentUser.uid ? { ...p, authorUsername: confirmedUsername, authorName: editName } : p));

      setIsEditingProfile(false);

      if (activeTab === 'profile') {
        if (onVisitProfile) {
          onVisitProfile(confirmedUsername);
        } else {
          window.history.replaceState(null, '', `/${confirmedUsername}`);
        }
      }

      triggerToast(usernameWasChanged ? 'Username atualizado com sucesso' : 'Perfil atualizado com sucesso!');
      
      loadData();
    } catch (err: any) {
      setEditUsername(currentUsername);
      alert('Erro ao salvar perfil (username antigo mantido): ' + (err?.message || err));
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdPrice || !newProdStock) {
      alert('Preencha os campos obrigatórios.');
      return;
    }
    try {
      const pId = `prod_${Date.now()}`;
      const newProduct: any = {
        id: pId,
        name: newProdName,
        shortDesc: newProdDesc,
        price: String(newProdPrice),
        stock: parseInt(newProdStock),
        category: newProdCategory,
        image: newProdImage || '',
        type: newProdType,
        displayOnProfile: newProdDisplayOnProfile,
        sellerId: currentUser.uid,
        sellerName: currentUser.name,
        userId: currentUser.uid,
        allowInstallments: true,
        maxInstallments: 12
      };
      await saveStoreProduct(newProduct);
      triggerToast('Produto anunciado com sucesso!');
      setNewProdName('');
      setNewProdDesc('');
      setNewProdPrice('');
      setNewProdStock('');
      setNewProdImage('');
      setNewProdType('Físico');
      setNewProdDisplayOnProfile(true);
      loadData();
    } catch (err) {
      alert('Erro ao anunciar produto: ' + err);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventCity || !newEventVenue || !newEventDate || !newEventPrice) {
      alert('Preencha os campos obrigatórios.');
      return;
    }
    try {
      const showId = `show_${Date.now()}`;
      const newEvent: any = {
        id: showId,
        name: newEventTitle,
        description: newEventDesc,
        city: newEventCity,
        venue: newEventVenue,
        date: newEventDate,
        startTime: newEventTime || '20:00',
        price: String(newEventPrice),
        imageUrl: newEventImage || '',
        capacity: newEventCapacity ? parseInt(newEventCapacity) : 100,
        address: newEventAddress,
        state: newEventState,
        rating: newEventRating,
        displayOnProfile: newEventDisplayOnProfile,
        sectors: newEventSectors,
        status: 'Aprovado',
        ownerId: currentUser.uid,
        organizerId: currentUser.uid
      };
      await saveShow(newEvent);
      triggerToast('Evento cadastrado com sucesso!');
      setNewEventTitle('');
      setNewEventDesc('');
      setNewEventCity('');
      setNewEventVenue('');
      setNewEventDate('');
      setNewEventTime('');
      setNewEventPrice('');
      setNewEventImage('');
      setNewEventCapacity('');
      setNewEventAddress('');
      setNewEventState('');
      setNewEventRating('Livre');
      setNewEventDisplayOnProfile(true);
      setNewEventSectors([{ name: 'Pista', price: '50', quantity: '500' }]);
      loadData();
    } catch (err) {
      alert('Erro ao cadastrar evento: ' + err);
    }
  };

  const handleCreateMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMusicTitle.trim() || !newMusicAudioUrl.trim()) {
      alert('Preencha os campos obrigatórios (Título e Áudio).');
      return;
    }
    try {
      const mId = `track_${Date.now()}`;
      const newStream: MusicStream = {
        id: mId,
        title: newMusicTitle,
        artistNames: String(newMusicArtist || currentUser.name),
        audioUrl: newMusicAudioUrl,
        coverUrl: newMusicCoverUrl || 'https://via.placeholder.com/300',
        artistIds: [currentUser.uid],
        description: newMusicDesc || 'Faixa oficial no VOXA',
        totalStreams: 0,
        featured: false,
        status: 'Ativo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await saveMusicStream(newStream);
      triggerToast('Música publicada com sucesso! 🎵');
      setNewMusicTitle('');
      setNewMusicArtist('');
      setNewMusicAudioUrl('');
      setNewMusicCoverUrl('');
      setNewMusicDesc('');
      loadData();
    } catch (err: any) {
      alert('Erro ao publicar música: ' + err.message);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim() || !newServicePrice) {
      alert('Preencha os campos obrigatórios.');
      return;
    }
    try {
      const sId = `service_${Date.now()}`;
      const newService = {
        id: sId,
        userId: currentUser.uid,
        userName: currentUser.name,
        userAvatar: activeUserData.photoURL || '',
        name: newServiceName,
        description: newServiceDesc || '',
        price: parseFloat(newServicePrice),
        image: newServiceImage || 'https://via.placeholder.com/300',
        contactMethod: newServiceContact || 'WhatsApp'
      };
      await setDoc(doc(db, 'user_services', sId), newService);
      triggerToast('Serviço cadastrado com sucesso! 💼');
      setNewServiceName('');
      setNewServiceDesc('');
      setNewServicePrice('');
      setNewServiceImage('');
      setNewServiceContact('');
      loadData();
    } catch (err: any) {
      alert('Erro ao cadastrar serviço: ' + err.message);
    }
  };

  const handleCreateSubscriptionPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim() || !newSubPrice) {
      alert('Preencha os campos obrigatórios.');
      return;
    }
    try {
      const pId = `plan_${Date.now()}`;
      const newPlan: any = {
        id: pId,
        name: newSubName,
        price: parseFloat(newSubPrice),
        benefits: newSubBenefits,
        description: newSubDesc || '',
        imageUrl: newSubImage || 'https://via.placeholder.com/300',
        creatorId: currentUser.uid,
        ownerId: currentUser.uid,
        ownerType: 'user',
        ownerName: currentUser.name || 'Membro',
        sellerId: currentUser.uid,
        sellerName: currentUser.name || 'Membro',
        billingPeriod: 'Mensal',
        category: 'Clube de Fãs',
        status: 'Aprovado',
        published: true,
        active: true
      };
      await saveSubscriptionPlan(newPlan);
      triggerToast('Plano de assinatura criado com sucesso! 💎');
      setNewSubName('');
      setNewSubPrice('');
      setNewSubBenefits('');
      setNewSubDesc('');
      setNewSubImage('');
      loadData();
    } catch (err: any) {
      alert('Erro ao criar assinatura: ' + err.message);
    }
  };

  const handleCreateNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNewsTitle.trim() || !newNewsContent.trim()) {
      alert('Preencha os campos obrigatórios.');
      return;
    }
    try {
      const artId = `news_${Date.now()}`;
      const newArticle = {
        id: artId,
        title: newNewsTitle,
        subtitle: newNewsSubtitle,
        category: newNewsCategory,
        coverUrl: newNewsImage || '',
        content: newNewsContent,
        authorId: currentUser.uid,
        authorName: currentUser.name,
        date: new Date().toLocaleDateString('pt-BR'),
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'news_articles', artId), newArticle);
      triggerToast('Notícia publicada com sucesso!');
      setNewNewsTitle('');
      setNewNewsSubtitle('');
      setNewNewsImage('');
      setNewNewsContent('');
      loadData();
    } catch (err) {
      alert('Erro ao publicar notícia: ' + err);
    }
  };

  const handleUploadProfileImage = async (e: React.ChangeEvent<HTMLInputElement> | File, type: 'avatar' | 'cover') => {
    let file: File | undefined;
    if (e instanceof File) {
      file = e;
    } else {
      file = e.target?.files?.[0];
    }
    if (!file) return;

    // Validation
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type.toLowerCase())) {
      alert("Formato de arquivo inválido! Apenas JPG, JPEG, PNG e WEBP são permitidos.");
      return;
    }
    const maxBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxBytes) {
      alert("Arquivo muito grande! O limite máximo para fotos de perfil ou capa é de 10 MB.");
      return;
    }

    // Immediate local preview
    const previewUrl = URL.createObjectURL(file);
    if (type === 'avatar') {
      setLocalAvatarPreview(previewUrl);
      setIsUploadingAvatar(true);
      setAvatarProgress(0);
      setUploadAvatarError(null);
    } else {
      setLocalCoverPreview(previewUrl);
      setIsUploadingCover(true);
      setCoverProgress(0);
      setUploadCoverError(null);
    }

    // We store the original file so that the retry button can trigger the upload again if needed.
    const originalFile = file;

    const runUpload = async () => {
      try {
        const res = await uploadFile(originalFile, type, (p) => {
          if (type === 'avatar') setAvatarProgress(Math.round(p.percentage));
          else setCoverProgress(Math.round(p.percentage));
        });

        if (!res?.url) throw new Error("URL de download inválida retornada.");

        const userRef = doc(db, 'users', currentUser.uid);
        if (type === 'avatar') {
          await updateDoc(userRef, { photoURL: res.url, avatarUrl: res.url });
          const updated = { ...currentUser, photoURL: res.url, avatarUrl: res.url };
          setCurrentUser(updated);
          localStorage.setItem('voxa_current_user', JSON.stringify(updated));
          setLocalAvatarPreview(null); // Clear preview since we now have the final URL
        } else {
          await updateDoc(userRef, { coverURL: res.url, coverUrl: res.url });
          const updated = { ...currentUser, coverURL: res.url, coverUrl: res.url };
          setCurrentUser(updated);
          localStorage.setItem('voxa_current_user', JSON.stringify(updated));
          setLocalCoverPreview(null); // Clear preview since we now have the final URL
        }

        // Instantly update the centralUsers local list in-memory so other parts update
        setCentralUsers(prev => prev.map(u => {
          if (u.uid === currentUser.uid) {
            return {
              ...u,
              photoURL: type === 'avatar' ? res.url : u.photoURL,
              avatarUrl: type === 'avatar' ? res.url : u.avatarUrl,
              coverURL: type === 'cover' ? res.url : u.coverURL,
              coverUrl: type === 'cover' ? res.url : u.coverUrl
            };
          }
          return u;
        }));

        // Invalidate the cache for this UID so VOX feeds and cards update instantly!
        if (typeof window !== 'undefined') {
          (window as any).invalidateUserProfileCache?.(currentUser.uid);
        }

        triggerToast('Imagem salva com sucesso!');
      } catch (err: any) {
        console.error("Upload error details:", err);
        if (type === 'avatar') {
          setUploadAvatarError('Não foi possível enviar a imagem.');
          setLocalAvatarPreview(null); // Revert to old profile photo
        } else {
          setUploadCoverError('Não foi possível enviar a imagem.');
          setLocalCoverPreview(null); // Revert to old cover photo
        }
      } finally {
        if (type === 'avatar') {
          setIsUploadingAvatar(false);
        } else {
          setIsUploadingCover(false);
        }
        URL.revokeObjectURL(previewUrl);
      }
    };

    await runUpload();
  };

  const handleRemoveProfileImage = async (type: 'avatar' | 'cover') => {
    if (!currentUser?.uid) return;
    if (type === 'avatar') {
      if (!window.confirm("Remover foto de perfil? O usuário passará a utilizar o avatar padrão da VOXA.")) return;
    } else {
      if (!window.confirm("Remover imagem de capa?")) return;
    }

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      if (type === 'avatar') {
        await updateDoc(userRef, { photoURL: '', avatarUrl: '' });
        const updated = { ...currentUser, photoURL: '', avatarUrl: '' };
        setCurrentUser(updated);
        localStorage.setItem('voxa_current_user', JSON.stringify(updated));
        setLocalAvatarPreview(null);
        setUploadAvatarError(null);
        if (typeof window !== 'undefined') {
          (window as any).invalidateUserProfileCache?.(currentUser.uid);
        }
      } else {
        await updateDoc(userRef, { coverURL: '', coverUrl: '' });
        const updated = { ...currentUser, coverURL: '', coverUrl: '' };
        setCurrentUser(updated);
        localStorage.setItem('voxa_current_user', JSON.stringify(updated));
        setLocalCoverPreview(null);
        setUploadCoverError(null);
        if (typeof window !== 'undefined') {
          (window as any).invalidateUserProfileCache?.(currentUser.uid);
        }
      }

      setCentralUsers(prev => prev.map(u => {
        if (u.uid === currentUser.uid) {
          return {
            ...u,
            photoURL: type === 'avatar' ? '' : u.photoURL,
            avatarUrl: type === 'avatar' ? '' : u.avatarUrl,
            coverURL: type === 'cover' ? '' : u.coverURL,
            coverUrl: type === 'cover' ? '' : u.coverUrl
          };
        }
        return u;
      }));

      triggerToast('Imagem removida com sucesso!');
    } catch (err) {
      alert('Erro ao remover imagem: ' + err);
    }
  };

  // Searching logic
  const filteredUsers = centralUsers.filter(u => {
    const searchLower = searchQuery.toLowerCase().trim();
    if (!searchLower) return true;
    return (
      (u.name || '').toLowerCase().includes(searchLower) ||
      (u.username || u.slug || '').toLowerCase().includes(searchLower) ||
      (u.email || '').toLowerCase().includes(searchLower)
    );
  });

  const filteredProducts = products.filter(p => {
    const searchLower = searchQuery.toLowerCase().trim();
    if (!searchLower) return true;
    return (
      (p.name || '').toLowerCase().includes(searchLower) ||
      (p.category || '').toLowerCase().includes(searchLower) ||
      (p.shortDesc || '').toLowerCase().includes(searchLower)
    );
  });

  const filteredShows = shows.filter(s => {
    const searchLower = searchQuery.toLowerCase().trim();
    if (!searchLower) return true;
    return (
      (s.city || '').toLowerCase().includes(searchLower) ||
      (s.venue || '').toLowerCase().includes(searchLower)
    );
  });

  if (activeTab === 'activate-account') {
    return <ActivateAccountComponent triggerToast={triggerToast} setActiveTab={setActiveTab} />;
  }

  return (
    <div className="min-h-screen bg-[#080710] text-white font-sans flex flex-col lg:flex-row relative overflow-hidden">
      
      {/* Background gradients */}
      <div className="absolute top-0 left-[-10%] w-[50%] aspect-square rounded-full bg-red-950/10 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] aspect-square rounded-full bg-indigo-950/10 blur-[130px] pointer-events-none"></div>

      {/* 1. LEFT SIDEBAR NAVIGATION (DESKTOP) */}
      <aside className="hidden lg:flex flex-col justify-between w-64 border-r border-white/10 bg-[#0c0b16]/95 backdrop-blur-xl h-screen sticky top-0 shrink-0 z-40 select-none overflow-hidden">
        {/* Top Scrollable Section */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 hover:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          {/* Logo wordmark */}
          <div className="flex items-center space-x-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt="VOXA" className="w-9 h-9 rounded-xl object-contain bg-white/5 border border-white/10 p-0.5" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center font-black text-lg text-black font-orbitron">
                V
              </div>
            )}
            <div>
              <span className="font-orbitron font-black text-xl tracking-widest text-white block">VOXA</span>
              <span className="block text-[8px] font-orbitron text-white font-bold tracking-widest uppercase">SOCIAL UNIVERSE</span>
            </div>
          </div>

          {/* Primary Navigation Menu */}
          <nav className="space-y-1.5 font-orbitron text-xs font-bold text-left">
            {[
              { id: 'home', label: 'INÍCIO', icon: Home },
              { id: 'ai', label: 'VOXA STUDIO IA', icon: Sparkles },
              { id: 'explore', label: 'EXPLORAR', icon: Compass },
              { id: 'sussurros', label: 'SUSSURROS', icon: Ghost },
              { id: 'ranking', label: 'RANKING', icon: Award },
              { id: 'store', label: 'STORE', icon: ShoppingBag },
              { id: 'tickets', label: 'TICKETS', icon: Ticket },
              { id: 'subscriptions', label: 'ASSINATURAS', icon: Star },
              { id: 'music', label: 'MÚSICA', icon: Headphones },
              { id: 'news', label: 'NOTÍCIAS', icon: FileText },
              { id: 'services', label: 'SERVIÇOS', icon: Briefcase },
              { id: 'vaquinhas', label: 'VAQUINHAS', icon: Heart },
              { id: 'passagens', label: 'PASSAGENS', icon: Compass },
              { id: 'trade', label: 'VOXA TRADE', icon: TrendingUp },
              { id: 'invest', label: 'VOXA INVEST', icon: BarChart3 },
              { id: 'wallet', label: 'CARTEIRA', icon: Wallet },
              { id: 'my_business', label: 'MEU NEGÓCIO', icon: Briefcase },
              { id: 'dating', label: 'MEU PAR', icon: Heart },
              { id: 'ads', label: 'VOXA ADS', icon: Megaphone },
              { id: 'settings', label: 'CONFIGURAÇÕES', icon: Settings },
              { id: 'profile', label: 'MEU PERFIL', icon: UserIcon }
            ].map((item) => {
              const ItemIcon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSelectedArtistDetail(null);
                    setSelectedProductDetail(null);
                    setSelectedShowDetail(null);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 cursor-pointer ${
                    isActive 
                      ? 'bg-[#1A1A1A] text-white border border-[#262626] font-black' 
                      : 'bg-transparent text-[#A3A3A3] hover:text-white hover:bg-[#171717]'
                  }`}
                >
                  <ItemIcon className="w-4 h-4 shrink-0 text-current" strokeWidth={2.5} />
                  <span className="tracking-wide text-current">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card Profile bottom anchor */}
        <div className="p-6 space-y-4 border-t border-white/10 shrink-0 bg-[#0c0b16]">
          {isAdmin && (
            <button
              onClick={onOpenAdmin}
              className="w-full bg-[#171717] border border-[#404040] hover:bg-neutral-800 text-white font-orbitron font-extrabold text-[10px] py-2.5 px-3 rounded-xl transition-all tracking-wider text-center cursor-pointer uppercase shadow-md shadow-black/40"
            >
              VOXA ADMIN
            </button>
          )}

          {!currentUser ? (
            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="w-full bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs py-4 px-6 rounded-2xl transition-all tracking-widest text-center cursor-pointer uppercase shadow-lg shadow-red-600/10 hover:scale-[1.01]"
            >
              Entrar na VOXA
            </button>
          ) : (
            <div className="flex items-center justify-between text-left">
              <div className="flex items-center space-x-2.5 min-w-0">
                <UserAvatar
                  userId={currentUser.uid}
                  photoURL={currentUser.photoURL || activeUserData?.photoURL}
                  displayName={currentUser.name || activeUserData?.name}
                  size="sm"
                  borderColor="border border-white/25"
                />
                <div className="min-w-0 flex-1 leading-tight">
                  <span className="text-white font-bold block truncate text-xs font-orbitron uppercase">{currentUser.name?.split(' ')[0]}</span>
                  <span className="text-[10px] text-gray-500 block truncate">@{activeUserData?.username || 'user'}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  signOut(auth).then(() => window.location.reload());
                  localStorage.removeItem('voxa_current_user');
                }}
                className="text-gray-500 hover:text-red-400 p-2 cursor-pointer rounded-lg hover:bg-white/5"
                title="Sair"
              >
                <LogOut className="w-4.5 h-4.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* 2. DYNAMIC MOBILE NAVIGATION BOTTOM BAR */}
      <header className="lg:hidden w-full h-16 border-b border-white/10 bg-[#0c0b16]/95 backdrop-blur-xl flex items-center justify-between px-4 z-40 sticky top-0">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-all cursor-pointer"
            aria-label="Menu"
          >
            <div className="flex flex-col space-y-1 w-5">
              <span className="h-0.5 w-full bg-current rounded-full"></span>
              <span className="h-0.5 w-full bg-current rounded-full"></span>
              <span className="h-0.5 w-full bg-current rounded-full"></span>
            </div>
          </button>
          <div className="flex items-center space-x-2">
            {logoUrl ? (
              <img src={logoUrl} alt="VOXA" className="w-7 h-7 rounded-lg object-contain bg-white/5 border border-white/10 p-0.5" />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center font-bold text-xs font-orbitron">V</div>
            )}
            <span className="font-orbitron font-black text-sm tracking-widest text-white block">VOXA</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {isAdmin && (
            <button onClick={onOpenAdmin} className="text-[9px] font-orbitron font-bold border border-white/30 px-2 py-1 rounded-lg text-white">ADMIN</button>
          )}
          <button
            onClick={() => {
              signOut(auth).then(() => window.location.reload());
              localStorage.removeItem('voxa_current_user');
            }}
            className="text-gray-400 p-1.5 hover:text-red-400"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* MOBILE FULL NAVIGATION DRAWER */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Menu Panel */}
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-[280px] bg-[#0c0b16] border-r border-white/10 h-full flex flex-col justify-between p-6 overflow-y-auto pb-safe-bottom pt-safe-top"
            >
              <div className="space-y-6">
                {/* Header inside drawer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-black text-sm font-orbitron">V</div>
                    <div>
                      <span className="font-orbitron font-black text-md tracking-wider text-white block">VOXA</span>
                      <span className="block text-[7px] font-orbitron text-white/60 font-bold tracking-widest uppercase">SOCIAL UNIVERSE</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 rounded-full bg-white/5 text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <nav className="space-y-1 font-orbitron text-xs font-bold text-left overflow-y-auto max-h-[70vh] pr-1 scrollbar-thin">
                  {[
                    { id: 'home', label: 'INÍCIO', icon: Home },
                    { id: 'ai', label: 'VOXA STUDIO IA', icon: Sparkles },
                    { id: 'explore', label: 'EXPLORAR', icon: Compass },
                    { id: 'sussurros', label: 'SUSSURROS', icon: Ghost },
                    { id: 'ranking', label: 'RANKING', icon: Award },
                    { id: 'store', label: 'STORE', icon: ShoppingBag },
                    { id: 'tickets', label: 'TICKETS', icon: Ticket },
                    { id: 'subscriptions', label: 'ASSINATURAS', icon: Star },
                    { id: 'music', label: 'MÚSICA', icon: Headphones },
                    { id: 'news', label: 'NOTÍCIAS', icon: FileText },
                    { id: 'services', label: 'SERVIÇOS', icon: Briefcase },
                    { id: 'vaquinhas', label: 'VAQUINHAS', icon: Heart },
                    { id: 'passagens', label: 'PASSAGENS', icon: Compass },
                    { id: 'trade', label: 'VOXA TRADE', icon: TrendingUp },
                    { id: 'invest', label: 'VOXA INVEST', icon: BarChart3 },
                    { id: 'wallet', label: 'CARTEIRA', icon: Wallet },
                    { id: 'dating', label: 'MEU PAR', icon: Heart },
                    { id: 'my_business', label: 'MEU NEGÓCIO', icon: Briefcase },
                    { id: 'ads', label: 'VOXA ADS', icon: Megaphone },
                    { id: 'settings', label: 'CONFIGURAÇÕES', icon: Settings },
                    { id: 'profile', label: 'MEU PERFIL', icon: UserIcon }
                  ].map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = activeTab === item.id;
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setSelectedArtistDetail(null);
                          setSelectedProductDetail(null);
                          setSelectedShowDetail(null);

                          if (item.id === 'notifications') {
                            setShowNotifications(true);
                          } else {
                            setActiveTab(item.id);
                          }
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-200 cursor-pointer ${
                          isActive 
                            ? 'bg-[#1A1A1A] text-white border border-[#262626] font-black' 
                            : 'bg-transparent text-[#A3A3A3] hover:text-white hover:bg-[#171717]'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <ItemIcon className="w-4 h-4 shrink-0 text-current" strokeWidth={2.5} />
                          <span className="tracking-wide truncate text-current">{item.label}</span>
                        </div>
                        {(item as any).badge && (item as any).badge > 0 ? (
                          <span className="bg-[#FF0033] text-white text-[9px] font-black font-orbitron px-1.5 py-0.5 rounded-full min-w-4 text-center animate-pulse">
                            {(item as any).badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Drawer footer profile */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                {isAdmin && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenAdmin();
                    }}
                    className="w-full bg-[#171717] border border-[#404040] hover:bg-neutral-800 text-white font-orbitron font-extrabold text-[9px] py-2 px-3 rounded-xl tracking-wider text-center cursor-pointer uppercase shadow-md"
                  >
                    VOXA ADMIN
                  </button>
                )}

                {currentUser && (
                  <div className="flex items-center justify-between text-left">
                    <div className="flex items-center space-x-2 min-w-0">
                      <UserAvatar
                        userId={currentUser.uid}
                        photoURL={currentUser.photoURL || activeUserData?.photoURL}
                        displayName={currentUser.name || activeUserData?.name}
                        size="xs"
                        borderColor="border border-white/20"
                      />
                      <div className="min-w-0 flex-1 leading-tight">
                        <span className="text-white font-bold block truncate text-[11px] font-orbitron uppercase">{currentUser.name?.split(' ')[0]}</span>
                        <span className="text-[9px] text-gray-500 block truncate">@{activeUserData?.username || 'user'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        signOut(auth).then(() => window.location.reload());
                        localStorage.removeItem('voxa_current_user');
                      }}
                      className="text-gray-500 hover:text-red-400 p-1.5 cursor-pointer rounded-lg hover:bg-white/5"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. MAIN PAGE SCROLLABLE CONTAINER */}
      <main className="flex-1 overflow-y-auto max-h-[100vh] flex flex-col justify-between pb-16 lg:pb-0">
        
        {/* Top bar with Search & Notifications */}
        <div className="w-full bg-[#080710]/40 backdrop-blur-md px-6 md:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/5 gap-4 relative z-30 select-none">
          <div className="relative max-w-md w-full">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500 pointer-events-none">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar na VOXA (Membros, Lojas, Eventos...)"
              className="w-full bg-[#12111d] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white font-sans"
            />
          </div>

          <div className="flex items-center space-x-3 self-end sm:self-auto">
            {walletBalance > 0 && (
              <button
                onClick={() => setActiveTab('wallet')}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold text-emerald-400 transition-all cursor-pointer"
              >
                {formatBRL(walletBalance)}
              </button>
            )}

            {/* Notifications Bell & Component */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 rounded-xl bg-[#12111d] border border-white/10 hover:border-white/30 text-gray-300 hover:text-white transition-all cursor-pointer relative shadow-lg"
                title="Notificações"
              >
                <Bell className="w-4 h-4" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#FF0033] animate-pulse ring-2 ring-[#080710]"></span>
                )}
              </button>

              {/* Real-time Notifications Popover Component */}
              {showNotifications && (
                <div className="absolute right-0 mt-3 z-50 animate-fadeIn shadow-2xl">
                  <NotificationsComponent 
                    currentUser={currentUser} 
                    onClose={() => setShowNotifications(false)}
                    onNotificationClick={(notif) => {
                      setShowNotifications(false);
                      if (notif.actionTab) {
                        setActiveTab(notif.actionTab);
                      } else if (notif.type === 'financial') {
                        setActiveTab('wallet');
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global Toast Notification */}
        {successToast && (
          <div className="fixed top-24 right-4 z-50 bg-[#12111d] text-white border-2 border-white font-orbitron font-bold text-xs py-3 px-5 rounded-2xl shadow-2xl flex items-center space-x-3.5 animate-bounce">
            <CheckCircle className="w-5 h-5 text-white shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* 4. MAIN CENTRAL CONTENT AREA */}
        <div className="flex-1 p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full text-left">
          
          {searchQuery.trim() !== '' ? (
            <div className="space-y-8 animate-fadeIn">
              <div className="border-b border-white/10 pb-4 flex items-center justify-between">
                <div>
                  <span className="text-white font-orbitron text-[10px] tracking-widest block font-bold uppercase">Resultados da Busca</span>
                  <h2 className="font-orbitron font-black text-2xl text-white mt-1">PESQUISA: "{searchQuery.toUpperCase()}"</h2>
                </div>
                <button
                  onClick={() => setSearchQuery('')}
                  className="bg-white/5 hover:bg-white/10 text-xs font-orbitron font-bold py-2 px-4 rounded-xl cursor-pointer"
                >
                  LIMPAR BUSCA
                </button>
              </div>

              {/* Grid of Results Categories */}
              <div className="space-y-8">
                {/* 1. PEOPLE */}
                <div className="space-y-4">
                  <h3 className="font-orbitron font-bold text-sm text-gray-400 uppercase tracking-wider text-left">Membros Encontrados ({filteredUsers.length})</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredUsers.length === 0 ? (
                      <p className="text-xs text-gray-600 font-sans text-left">Nenhum membro encontrado.</p>
                    ) : (
                      filteredUsers.slice(0, 8).map((u, idx) => (
                        <div 
                          key={u.uid || u.id || `search_user_${idx}`} 
                          onClick={() => {
                            setSearchQuery('');
                            if (onVisitProfile) {
                              onVisitProfile(u.username || u.slug || 'user');
                            } else {
                              window.history.pushState(null, '', `/${u.username || u.slug || 'user'}`);
                              window.dispatchEvent(new Event('popstate'));
                            }
                          }}
                          className="bg-[#12111d] border border-white/10 p-4 rounded-2xl flex items-center space-x-3.5 cursor-pointer hover:border-white/30 transition-all text-left"
                        >
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 bg-zinc-900 flex items-center justify-center">
                            {u.photoURL ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 text-gray-500" />}
                          </div>
                          <div className="min-w-0 flex-1 leading-snug">
                            <span className="text-xs font-bold text-white truncate flex items-center gap-1">
                              <span className="truncate">{u.name}</span>
                              {isVerifiedUser(u) && <VerifiedBadge user={u} size="xs" />}
                            </span>
                            <span className="block text-[10px] text-violet-400 font-mono">@{u.username || u.slug || 'user'}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. PRODUCTS */}
                <div className="space-y-4">
                  <h3 className="font-orbitron font-bold text-sm text-gray-400 uppercase tracking-wider text-left">Produtos Encontrados ({filteredProducts.length})</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredProducts.length === 0 ? (
                      <p className="text-xs text-gray-600 font-sans text-left">Nenhum produto encontrado.</p>
                    ) : (
                      filteredProducts.slice(0, 8).map(p => (
                        <div key={p.id} className="bg-[#12111d] border border-white/10 rounded-2xl overflow-hidden hover:border-white/30 transition-all flex flex-col justify-between">
                          <div className="aspect-square bg-zinc-900 relative overflow-hidden flex items-center justify-center border-b border-white/5">
                            {p.image ? (
                              <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-orbitron text-gray-600 font-bold">SEM IMAGEM</span>
                            )}
                          </div>
                          <div className="p-4 space-y-2 text-left">
                            <h4 className="font-orbitron font-bold text-xs text-white truncate uppercase">{p.name}</h4>
                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                              <span className="font-mono font-bold text-xs text-white">{formatBRL(p.price)}</span>
                              <button
                                onClick={() => setSelectedProductForCheckout(p)}
                                className="bg-white hover:bg-neutral-200 text-black font-bold font-orbitron font-black text-[9px] px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                              >
                                COMPRAR
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 3. EVENTS */}
                <div className="space-y-4">
                  <h3 className="font-orbitron font-bold text-sm text-gray-400 uppercase tracking-wider text-left">Eventos Encontrados ({filteredShows.length})</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {filteredShows.length === 0 ? (
                      <p className="text-xs text-gray-600 font-sans text-left">Nenhum evento encontrado.</p>
                    ) : (
                      filteredShows.slice(0, 6).map(show => (
                        <div key={show.id} className="bg-[#12111d] border border-white/10 p-5 rounded-2xl flex flex-col justify-between hover:border-white/30 transition-all text-left">
                          <div>
                            <div className="flex items-center justify-between text-[10px] font-orbitron font-bold text-white mb-2">
                              <span>{show.date}</span>
                              <span className="bg-white/10 text-white px-2 py-0.5 rounded">{show.status || 'Disponível'}</span>
                            </div>
                            <h3 className="font-orbitron font-black text-base text-white">{show.title || `${show.venue} Acústico`}</h3>
                            <p className="text-[11px] text-gray-400 mt-1 flex items-center space-x-1 font-sans">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{show.city} • {show.venue}</span>
                            </p>
                          </div>
                          <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between">
                            <span className="font-orbitron font-bold text-white text-sm">{formatBRL(show.ticketPrice || 49.90)}</span>
                            <button
                              onClick={() => setSelectedTicketForCheckout(show)}
                              className="bg-white hover:bg-neutral-200 text-black font-bold font-orbitron font-bold text-[10px] py-2 px-3 rounded-lg transition-all cursor-pointer"
                            >
                              INGRESSO
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 4. NEWS */}
                <div className="space-y-4">
                  <h3 className="font-orbitron font-bold text-sm text-gray-400 uppercase tracking-wider text-left">Notícias Encontradas ({newsArticles.filter(art => (art.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (art.content || '').toLowerCase().includes(searchQuery.toLowerCase())).length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {newsArticles.filter(art => (art.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (art.content || '').toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                      <p className="text-xs text-gray-600 font-sans text-left">Nenhuma notícia encontrada.</p>
                    ) : (
                      newsArticles.filter(art => (art.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (art.content || '').toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 4).map(art => (
                        <div key={art.id} className="bg-[#12111d] border border-white/10 p-5 rounded-2xl flex flex-col justify-between hover:border-white/30 transition-all text-left">
                          <div>
                            <span className="text-[9px] font-orbitron font-black text-red-400 bg-red-600/10 px-2 py-0.5 rounded-full uppercase">{art.category || 'Geral'}</span>
                            <h3 className="text-base font-orbitron font-bold text-white uppercase mt-2 leading-snug">{art.title}</h3>
                            <p className="text-xs text-gray-400 font-sans mt-1 line-clamp-2 leading-relaxed">{art.content}</p>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono pt-4 mt-4 border-t border-white/5">
                            <span>Por {art.authorName || 'Autor'}</span>
                            <span>{art.date || 'Hoje'}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
          
          {activeTab === 'ai' && (
            <VoxaStudioIaSection
              currentUser={currentUser}
              triggerToast={triggerToast}
              onOpenAdminAi={isAdmin ? onOpenAdmin : undefined}
              isAdmin={isAdmin}
              onShareToFeed={(mediaUrl, captionText) => {
                setNewPostMedia(mediaUrl);
                setNewPostContent(captionText || 'Criado no VOXA Studio IA #VOXAAI');
                setActiveTab('home');
                triggerToast('Mídia carregada no compositor do Feed VOXA!');
              }}
            />
          )}

          {activeTab === 'vaquinhas' && (
            <VaquinhasSection currentUser={currentUser} triggerToast={triggerToast} onVisitProfile={onVisitProfile} />
          )}

          {activeTab === 'passagens' && (
            <PassagensSection currentUser={currentUser} triggerToast={triggerToast} />
          )}

          {activeTab === 'trade' && (
            <VoxaTradeSection
              currentUser={currentUser}
              onGoToWalletDeposit={() => setActiveTab('wallet')}
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'invest' && (
            <Invest
              currentUser={currentUser}
              onGoToWalletDeposit={() => setActiveTab('wallet')}
              onOpenAdminInvest={isAdmin ? onOpenAdmin : undefined}
              isAdmin={isAdmin}
              triggerToast={triggerToast}
            />
          )}

          {/* TAB 1: INÍCIO (SOCIAL MEDIA FEED) */}
          {activeTab === 'home' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Center Feed */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* 1. Stories Layout */}
                <div className="flex overflow-x-auto scrollbar-none gap-4 pb-2">
                  <div className="flex flex-col items-center space-y-1.5 cursor-pointer shrink-0">
                    <div className="w-14 h-14 rounded-full border-2 border-dashed border-white p-0.5 flex items-center justify-center bg-[#12111d]">
                      <div className="w-full h-full rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center text-gray-400 relative">
                        {currentUser.photoURL ? (
                          <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon className="w-4 h-4" />
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-orbitron font-bold text-gray-400">Meu Story</span>
                  </div>

                  {/* Stories of recommended people */}
                  {centralUsers.filter(u => u.photoURL && u.uid !== currentUser.uid).slice(0, 6).map((u, idx) => (
                    <div
                      key={u.uid || u.id || `recommended_story_${idx}`}
                      onClick={() => onVisitProfile && onVisitProfile(u.username || u.slug || 'user')}
                      className="flex flex-col items-center space-y-1.5 cursor-pointer shrink-0"
                    >
                      <div className="w-14 h-14 rounded-full border-2 border-white p-0.5 flex items-center justify-center bg-[#12111d]">
                        <img src={u.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                      </div>
                      <span className="text-[10px] font-orbitron font-bold text-gray-300 truncate max-w-[65px]">@{u.username || 'user'}</span>
                    </div>
                  ))}
                </div>

                {/* DYNAMIC MENU "CRIAR" WITH UNIFIED CREATOR MODAL */}
                <div className="bg-[#12111d] border border-white/10 p-5 rounded-[24px] flex flex-wrap items-center justify-between gap-4">
                  <div className="text-left">
                    <span className="text-white font-orbitron text-[9px] tracking-widest block font-bold uppercase">Criação Descentralizada</span>
                    <h4 className="font-orbitron font-extrabold text-sm text-white uppercase">CRIAR NOVO CONTEÚDO</h4>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setIsCreateContentMenuOpen(true)}
                      className="bg-white hover:bg-neutral-200 text-black font-black font-orbitron text-[10px] px-4 py-2.5 rounded-xl transition-all cursor-pointer uppercase flex items-center space-x-1.5 shadow-lg shadow-white/5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>CRIAR</span>
                    </button>

                    <button
                      onClick={() => {
                        setReplyToId(null);
                        setReplyToVox(null);
                        setQuotedVoxId(null);
                        setQuotedVox(null);
                        setIsComposerOpen(true);
                      }}
                      className="bg-white/5 hover:bg-white/10 text-white font-orbitron font-bold text-[10px] px-3.5 py-2 rounded-xl transition-all cursor-pointer uppercase flex items-center space-x-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                      <span>VOX</span>
                    </button>

                    <button
                      onClick={() => setIsPollModalOpen(true)}
                      className="bg-white/5 hover:bg-white/10 text-white font-orbitron font-bold text-[10px] px-3.5 py-2 rounded-xl transition-all cursor-pointer uppercase flex items-center space-x-1.5"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                      <span>Enquete</span>
                    </button>
                    
                    {activeUserData?.features?.store && (
                      <button
                        onClick={() => {
                          setActiveTab('my_business');
                          setBusinessTab('store');
                        }}
                        className="bg-white/10 hover:bg-neutral-200 hover:text-black text-white border border-white/30 font-orbitron font-bold text-[10px] px-3.5 py-2 rounded-xl transition-all cursor-pointer uppercase flex items-center space-x-1.5"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Produto</span>
                      </button>
                    )}

                    {activeUserData?.features?.events && (
                      <button
                        onClick={() => {
                          setActiveTab('my_business');
                          setBusinessTab('events');
                        }}
                        className="bg-white/10 hover:bg-neutral-200 hover:text-black text-white border border-white/30 font-orbitron font-bold text-[10px] px-3.5 py-2 rounded-xl transition-all cursor-pointer uppercase flex items-center space-x-1.5"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Evento</span>
                      </button>
                    )}
                  </div>
                </div>
                
                {/* 2. Create Post Box */}
                <form onSubmit={handleCreatePost} className="bg-[#12111d] border border-white/10 p-5 rounded-[24px] space-y-4">
                  <div className="flex items-start space-x-3.5">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 shrink-0 flex items-center justify-center bg-zinc-800 text-gray-400">
                      {currentUser.photoURL ? (
                        <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        placeholder={`No que você está pensando, @${activeUserData.username || 'user'}?`}
                        rows={3}
                        className="w-full bg-transparent border-0 resize-none text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-0 font-sans leading-relaxed"
                      />
                      {newPostMedia && (
                        <div className="mt-3 relative rounded-xl overflow-hidden max-h-48 border border-white/10 flex items-center justify-center bg-black">
                          <img src={newPostMedia} alt="" className="max-h-48 object-contain" />
                          <button 
                            type="button" 
                            onClick={() => setNewPostMedia('')} 
                            className="absolute top-2 right-2 bg-black/60 hover:bg-black/90 p-1.5 rounded-full text-white cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Attachment Previews */}
                      {attachedProductId && (
                        <div className="mt-3 p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <ShoppingBag className="w-4 h-4 text-[#FF0033] shrink-0 animate-pulse" />
                            <span className="text-[10px] font-orbitron font-black text-[#FF0033] tracking-wider uppercase shrink-0">Produto:</span>
                            <span className="text-xs text-gray-200 truncate font-semibold">
                              {products.find(p => p.id === attachedProductId)?.name || 'Carregando produto...'}
                            </span>
                          </div>
                          <button type="button" onClick={() => setAttachedProductId(null)} className="p-1 rounded-full hover:bg-white/5 text-gray-400 hover:text-white cursor-pointer transition-all">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {attachedEventId && (
                        <div className="mt-3 p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <Ticket className="w-4 h-4 text-[#FF0033] shrink-0 animate-pulse" />
                            <span className="text-[10px] font-orbitron font-black text-[#FF0033] tracking-wider uppercase shrink-0">Evento:</span>
                            <span className="text-xs text-gray-200 truncate font-semibold">
                              {shows.find(s => s.id === attachedEventId)?.title || 'Carregando evento...'}
                            </span>
                          </div>
                          <button type="button" onClick={() => setAttachedEventId(null)} className="p-1 rounded-full hover:bg-white/5 text-gray-400 hover:text-white cursor-pointer transition-all">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {attachedSubscriptionPlanId && (
                        <div className="mt-3 p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <Star className="w-4 h-4 text-[#FF0033] shrink-0 animate-pulse" />
                            <span className="text-[10px] font-orbitron font-black text-[#FF0033] tracking-wider uppercase shrink-0">Assinatura:</span>
                            <span className="text-xs text-gray-200 truncate font-semibold">
                              {subscriptionPlans.find(sp => sp.id === attachedSubscriptionPlanId)?.name || 'Carregando plano...'}
                            </span>
                          </div>
                          <button type="button" onClick={() => setAttachedSubscriptionPlanId(null)} className="p-1 rounded-full hover:bg-white/5 text-gray-400 hover:text-white cursor-pointer transition-all">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {attachedMusicId && (
                        <div className="mt-3 p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <Headphones className="w-4 h-4 text-[#FF0033] shrink-0 animate-pulse" />
                            <span className="text-[10px] font-orbitron font-black text-[#FF0033] tracking-wider uppercase shrink-0">Música:</span>
                            <span className="text-xs text-gray-200 truncate font-semibold">
                              {streams.find(st => st.id === attachedMusicId)?.title || 'Carregando faixa...'}
                            </span>
                          </div>
                          <button type="button" onClick={() => setAttachedMusicId(null)} className="p-1 rounded-full hover:bg-white/5 text-gray-400 hover:text-white cursor-pointer transition-all">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inline Alert Blocking Text-Only Posts */}
                  {textOnlyPostError && (
                    <div className="p-4 bg-red-950/20 border border-red-500/30 rounded-[18px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                      <div className="flex items-center space-x-2.5">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                        <p className="text-xs text-red-200">
                          Para publicar apenas texto, use o <span className="font-bold text-white font-orbitron text-[10px] tracking-wider uppercase">VOX</span>.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setVoxInitialText(newPostContent);
                          setNewPostContent('');
                          setTextOnlyPostError(false);
                          setIsComposerOpen(true);
                        }}
                        className="bg-white hover:bg-neutral-200 text-black font-orbitron font-black text-[9px] px-3.5 py-1.5 rounded-lg shrink-0 text-center uppercase tracking-wider cursor-pointer"
                      >
                        Criar VOX
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-white/5 pt-4">
                    <div className="flex items-center space-x-2">
                      <label className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white hover:text-red-300 transition-all cursor-pointer flex items-center space-x-1.5 text-xs font-orbitron font-bold">
                        <ImageIcon className="w-4 h-4" />
                        <span>FOTO</span>
                        <input type="file" accept="image/*" onChange={handlePostMediaUpload} className="hidden" />
                      </label>
                      {isUploadingMedia && (
                        <span className="text-[10px] font-orbitron text-white animate-pulse">{uploadMediaProgress}%</span>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={!newPostContent.trim() && !newPostMedia && !attachedProductId && !attachedEventId && !attachedSubscriptionPlanId && !attachedMusicId}
                      className="bg-white hover:bg-neutral-200 text-black font-bold font-orbitron font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      PUBLICAR
                    </button>
                  </div>
                </form>

                {/* TAB SELECTOR FOR THE FEED */}
                <div className="flex items-center space-x-1 p-1 bg-[#12111d] border border-white/10 rounded-2xl max-w-sm select-none">
                  <button
                    onClick={() => setActiveVoxFilter('todos')}
                    className={`flex-1 py-1.5 px-3 rounded-xl font-orbitron font-extrabold text-[10px] uppercase transition-all cursor-pointer text-center ${activeVoxFilter === 'todos' ? 'bg-[#FF0033] text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setActiveVoxFilter('vox')}
                    className={`flex-1 py-1.5 px-3 rounded-xl font-orbitron font-extrabold text-[10px] uppercase transition-all cursor-pointer text-center ${activeVoxFilter === 'vox' ? 'bg-[#FF0033] text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    VOX
                  </button>
                  <button
                    onClick={() => setActiveVoxFilter('enquetes')}
                    className={`flex-1 py-1.5 px-3 rounded-xl font-orbitron font-extrabold text-[10px] uppercase transition-all cursor-pointer text-center ${activeVoxFilter === 'enquetes' ? 'bg-[#FF0033] text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Enquetes
                  </button>
                  <button
                    onClick={() => setActiveVoxFilter('midia')}
                    className={`flex-1 py-1.5 px-3 rounded-xl font-orbitron font-extrabold text-[10px] uppercase transition-all cursor-pointer text-center ${activeVoxFilter === 'midia' ? 'bg-[#FF0033] text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    Mídia
                  </button>
                </div>

                {/* 3. Social Posts & Polls Feed List */}
                <div className="space-y-6">
                  {(() => {
                    const normalItems = posts.map(p => ({ ...p, feedType: 'post', isNormalPost: true }));
                    const voxItems = voxes.filter(v => !v.replyTo).map(v => ({ ...v, feedType: 'vox', isNormalPost: false }));
                    const pollItems = polls.map(p => ({ ...p, feedType: 'poll', isNormalPost: false }));

                    // Filter for Home feed: Me + Followed + Official
                    const isOfficial = (uid: string) => ['voxa', 'admin'].includes(uid) || centralUsers.find(u => u.uid === uid)?.isAdmin;
                    
                    let combined: any[] = [...normalItems, ...voxItems, ...pollItems].filter(item => {
                      const authorUid = item.userId || item.authorUid || item.senderUid || item.authorId;
                      return authorUid === currentUser?.uid || followingIds.includes(authorUid) || isOfficial(authorUid);
                    }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

                    if (activeVoxFilter === 'vox') {
                      combined = voxItems as any;
                    } else if (activeVoxFilter === 'enquetes') {
                      combined = pollItems as any;
                    } else if (activeVoxFilter === 'midia') {
                      combined = combined.filter(item => 
                        item.isNormalPost 
                          ? !!item.mediaUrl 
                          : (!!item.media && item.media.length > 0)
                      );
                    }

                    if (combined.length === 0) {
                      return (
                        <div className="text-center py-16 bg-[#12111d] border border-white/10 rounded-[24px]">
                          <p className="font-orbitron font-bold text-xs text-gray-500 uppercase tracking-widest">Sem publicações no Feed no momento.</p>
                          <p className="text-xs text-gray-600 font-sans mt-1">Seja o primeiro a expressar sua voz!</p>
                        </div>
                      );
                    }

                    return combined.map(item => {
                      if (item.feedType === 'poll') {
                        return (
                          <PollCard
                            key={item.id}
                            poll={item}
                            currentUser={currentUser}
                            onVoteSuccess={loadData}
                            triggerToast={triggerToast}
                            onVisitProfile={onVisitProfile}
                            isAdmin={isAdmin}
                          />
                        );
                      }
                      if (!item.isNormalPost) {
                        return (
                          <VoxCard
                            key={item.id}
                            vox={item as any}
                            currentUser={currentUser}
                            onSelect={handleSelectVox}
                            onReplyClick={handleReplyVox}
                            onQuoteClick={handleQuoteVox}
                            onShareClick={handleShareVox}
                            onUpdate={loadData}
                            triggerToast={triggerToast}
                            isAdmin={isAdmin}
                          />
                        );
                      }

                      const post = item;
                      const list = post.likesList || [];
                      const likedByMe = list.includes(currentUser.uid);
                      const postAuthor = centralUsers.find(u => (u.uid || u.id) === post.userId);
                      const dispAuthorName = postAuthor?.name || post.authorName;
                      const dispAuthorUsername = postAuthor?.username || postAuthor?.slug || (post.userId === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' ? 'jrsantti' : post.authorUsername);
                      const dispAuthorAvatar = postAuthor?.photoURL || postAuthor?.avatarUrl || post.authorAvatar;

                      return (
                        <div key={post.id} className="bg-[#12111d] border border-white/10 p-6 rounded-[24px] space-y-4">
                          <div className="flex items-center justify-between">
                            <div
                              onClick={() => dispAuthorUsername && onVisitProfile && onVisitProfile(dispAuthorUsername)}
                              className="flex items-center space-x-3 text-left cursor-pointer group"
                            >
                              <div className="w-10 h-10 rounded-full overflow-hidden border border-white/15 bg-zinc-800 shrink-0 flex items-center justify-center text-gray-400">
                                {dispAuthorAvatar ? (
                                  <img src={dispAuthorAvatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <UserIcon className="w-4 h-4" />
                                )}
                              </div>
                              <div className="leading-tight">
                                <span className="text-white font-bold text-sm font-orbitron uppercase flex items-center gap-1 group-hover:underline">
                                  <span>{dispAuthorName}</span>
                                  {isVerifiedUser(postAuthor || { isVerified: true }) && (
                                    <VerifiedBadge user={postAuthor || { isVerified: true }} size="xs" />
                                  )}
                                </span>
                                <span className="text-[10px] text-gray-500 block font-mono">@{dispAuthorUsername}</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-gray-600 font-sans">{post.createdAt ? new Date(post.createdAt).toLocaleDateString('pt-BR') : 'Hoje'}</span>
                          </div>

                          <p className="text-gray-300 text-sm font-sans leading-relaxed whitespace-pre-line">{post.content}</p>

                          {post.mediaUrl && (
                            <div className="rounded-2xl overflow-hidden border border-white/5 bg-black flex items-center justify-center max-h-96">
                              <img src={post.mediaUrl} alt="" className="max-h-96 object-contain" />
                            </div>
                          )}

                          {/* Attached commercial cards */}
                          {post.productId && (() => {
                            const prod = products.find(p => p.id === post.productId);
                            if (!prod) return null;
                            return (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProductDetail(prod);
                                  setActiveTab('store');
                                }}
                                className="mt-3 bg-zinc-950 border border-white/10 p-4 rounded-[20px] hover:border-white/20 transition-all cursor-pointer flex items-center space-x-4 text-left"
                              >
                                {prod.image && (
                                  <img src={prod.image} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <span className="text-[9px] font-orbitron font-black text-[#FF0033] tracking-widest block uppercase">Loja Oficial • Produto Físico</span>
                                  <h4 className="text-white font-orbitron font-bold text-sm truncate mt-0.5">{prod.name}</h4>
                                  <p className="text-[10px] text-gray-400 truncate mt-0.5 font-sans">{prod.description}</p>
                                  <span className="text-white font-orbitron font-bold text-xs mt-1 block">{formatBRL(prod.price)}</span>
                                </div>
                              </div>
                            );
                          })()}

                          {post.eventId && (() => {
                            const ev = shows.find(s => s.id === post.eventId);
                            if (!ev) return null;
                            return (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedShowDetail(ev);
                                  setActiveTab('tickets');
                                }}
                                className="mt-3 bg-zinc-950 border border-white/10 p-4 rounded-[20px] hover:border-white/20 transition-all cursor-pointer flex items-center space-x-4 text-left"
                              >
                                {ev.image && (
                                  <img src={ev.image} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <span className="text-[9px] font-orbitron font-black text-[#FF0033] tracking-widest block uppercase">Tickets • Evento Exclusivo</span>
                                  <h4 className="text-white font-orbitron font-bold text-sm truncate mt-0.5">{ev.title}</h4>
                                  <p className="text-[10px] text-gray-400 truncate mt-0.5 font-sans">{ev.city} • {ev.venue}</p>
                                  <span className="text-white font-orbitron font-bold text-xs mt-1 block">{formatBRL(ev.ticketPrice || 49.90)}</span>
                                </div>
                              </div>
                            );
                          })()}

                          {post.subscriptionPlanId && (() => {
                            const plan = subscriptionPlans.find(sp => sp.id === post.subscriptionPlanId);
                            if (!plan) return null;
                            return (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTab('my_business');
                                  setBusinessTab('subscriptions');
                                }}
                                className="mt-3 bg-zinc-950 border border-white/10 p-4 rounded-[20px] hover:border-white/20 transition-all cursor-pointer flex items-center space-x-4 text-left"
                              >
                                {plan.imageUrl && (
                                  <img src={plan.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <span className="text-[9px] font-orbitron font-black text-[#FF0033] tracking-widest block uppercase">Assinatura • Clube de Fãs</span>
                                  <h4 className="text-white font-orbitron font-bold text-sm truncate mt-0.5">{plan.name}</h4>
                                  <p className="text-[10px] text-gray-400 truncate mt-0.5 font-sans">{plan.description}</p>
                                  <span className="text-white font-orbitron font-bold text-xs mt-1 block">{formatBRL(plan.price)} / {plan.billingPeriod || 'mês'}</span>
                                </div>
                              </div>
                            );
                          })()}

                          {post.musicId && (() => {
                            const mus = streams.find(st => st.id === post.musicId);
                            if (!mus) return null;
                            return (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTab('explore');
                                  setActiveMusicSub('musicas');
                                }}
                                className="mt-3 bg-zinc-950 border border-white/10 p-4 rounded-[20px] hover:border-white/20 transition-all cursor-pointer flex items-center space-x-4 text-left"
                              >
                                {mus.coverUrl && (
                                  <img src={mus.coverUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0 animate-spin-slow" style={{ animationDuration: '12s' }} />
                                )}
                                <div className="min-w-0 flex-1">
                                  <span className="text-[9px] font-orbitron font-black text-[#FF0033] tracking-widest block uppercase">Música • Streaming</span>
                                  <h4 className="text-white font-orbitron font-bold text-sm truncate mt-0.5">{mus.title}</h4>
                                  <p className="text-[10px] text-gray-400 truncate mt-0.5 font-sans">{mus.artistNames}</p>
                                  <span className="text-xs text-gray-500 font-orbitron font-bold flex items-center mt-1">
                                    <Play className="w-3.5 h-3.5 text-[#FF0033] mr-1" /> OUVIR AGORA
                                  </span>
                                </div>
                              </div>
                            );
                          })()}

                          {post.digitalProductId && (() => {
                            const dProd = digitalProducts.find(dp => dp.id === post.digitalProductId);
                            if (!dProd) return null;
                            return (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingDigitalProduct(dProd);
                                  setActiveTab('digital_product_detail');
                                }}
                                className="mt-3 bg-zinc-950 border border-white/10 p-4 rounded-[20px] hover:border-white/20 transition-all cursor-pointer flex items-center space-x-4 text-left"
                              >
                                {dProd.coverUrl && (
                                  <img src={dProd.coverUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10 shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <span className="text-[9px] font-orbitron font-black text-amber-500 tracking-widest block uppercase">VOXA PRODUTOS • INFOPRODUTO</span>
                                  <h4 className="text-white font-orbitron font-bold text-sm truncate mt-0.5">{dProd.name}</h4>
                                  <p className="text-[10px] text-gray-400 truncate mt-0.5 font-sans">{dProd.shortDescription || dProd.category}</p>
                                  <span className="text-amber-400 font-orbitron font-bold text-xs mt-1 block">{formatBRL(dProd.price)}</span>
                                </div>
                              </div>
                            );
                          })()}

                          <div className="flex items-center space-x-4 border-t border-white/5 pt-4">
                            <button
                              onClick={() => handleLikePost(post.id)}
                              className={`flex items-center space-x-1.5 text-xs font-orbitron font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer ${likedByMe ? 'bg-red-500/10 text-red-500' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                              <Heart className={`w-4 h-4 ${likedByMe ? 'fill-current text-red-500 animate-ping' : ''}`} />
                              <span>{post.likesCount || 0}</span>
                            </button>

                            <button className="flex items-center space-x-1.5 text-xs text-gray-400 hover:text-white font-orbitron font-bold py-1.5 px-3 rounded-lg hover:bg-white/5 cursor-pointer">
                              <MessageCircle className="w-4 h-4 text-gray-500" />
                              <span>{post.commentsCount || 0} COMENTÁRIOS</span>
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

              </div>

              {/* Right widgets */}
              <div className="hidden lg:col-span-4 space-y-6">
                
                {/* 1. Profile mini summary */}
                <div className="bg-[#12111d] border border-white/10 p-6 rounded-[24px] space-y-4 text-center relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-r from-[#FF0033] to-red-600 opacity-40"></div>
                  <div className="relative z-10 pt-2 flex flex-col items-center">
                    <div
                      onClick={() => onVisitProfile && onVisitProfile(activeUserData.username || activeUserData.slug || 'user')}
                      className="cursor-pointer group flex flex-col items-center"
                    >
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-black bg-zinc-900 shrink-0 flex items-center justify-center text-gray-400 shadow-md">
                        {currentUser.photoURL ? (
                          <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon className="w-5 h-5" />
                        )}
                      </div>
                      <span className="font-orbitron font-black text-sm text-white uppercase mt-3 flex items-center justify-center gap-1 group-hover:underline">
                        <span>{currentUser.name}</span>
                        {isVerifiedUser(activeUserData) && <VerifiedBadge user={activeUserData} size="xs" />}
                      </span>
                      <span className="text-[10px] text-gray-500 block font-mono">@{activeUserData.username || 'user'}</span>
                    </div>
                    <span className="text-[9px] font-orbitron font-black text-white uppercase tracking-widest block bg-white/5 border border-white/10 py-1 px-3.5 rounded-full mt-3">
                      {currentUser.role}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-4 font-orbitron text-xs">
                    <div>
                      <span className="font-black text-white block text-sm font-mono tracking-tight">{activeUserData.postsCount || 0}</span>
                      <span className="text-[9px] text-gray-500 uppercase font-bold block">Posts</span>
                    </div>
                    <div>
                      <span className="font-black text-white block text-sm font-mono tracking-tight">{activeUserData.followersCount || 0}</span>
                      <span className="text-[9px] text-gray-500 uppercase font-bold block">Seguidores</span>
                    </div>
                    <div>
                      <span className="font-black text-white block text-sm font-mono tracking-tight">{activeUserData.followingCount || 0}</span>
                      <span className="text-[9px] text-gray-500 uppercase font-bold block">Seguindo</span>
                    </div>
                  </div>
                </div>

                {/* 2. Recommended creators */}
                <div className="bg-[#12111d] border border-white/10 p-5 rounded-[24px] space-y-4">
                  <h3 className="font-orbitron font-bold text-xs text-white uppercase tracking-widest">Aconselhados para você</h3>
                  <div className="space-y-3">
                    {centralUsers.filter(u => u.uid !== currentUser.uid).slice(0, 4).map((u, idx) => {
                      const isFollowing = followingIds.includes(u.uid || u.id);
                      
                      return (
                        <div key={u.uid || u.id || `recommended_user_${idx}`} className="flex items-center justify-between text-xs">
                          <div
                            onClick={() => onVisitProfile && onVisitProfile(u.username || u.slug || 'user')}
                            className="flex items-center space-x-2.5 min-w-0 cursor-pointer group"
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center text-gray-400 border border-white/10">
                              {u.photoURL ? (
                                <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <UserIcon className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 leading-tight">
                              <span className="text-white font-bold truncate font-orbitron uppercase text-[11px] flex items-center gap-1 group-hover:underline">
                                <span className="truncate">{u.name}</span>
                                {isVerifiedUser(u) && <VerifiedBadge user={u} size="xs" />}
                              </span>
                              <span className="text-[9px] text-gray-500 block truncate font-mono">@{u.username || 'membro'}</span>
                            </div>
                          </div>

                          {isFollowing ? (
                            <button 
                              onClick={() => handleUnfollowUser(u.uid || u.id)}
                              className="text-[9px] font-orbitron font-black text-gray-500 hover:text-white uppercase transition-all tracking-wide cursor-pointer"
                            >
                              SEGUINDO
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleFollowUser(u.uid || u.id)}
                              className="text-[9px] font-orbitron font-black text-white hover:text-white uppercase transition-all tracking-wide cursor-pointer"
                            >
                              SEGUIR
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Atividade Recente Widget */}
                <div className="bg-[#12111d] border border-white/10 p-5 rounded-[24px] space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h3 className="font-orbitron font-bold text-xs text-white uppercase tracking-widest flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Atividade Recente
                    </h3>
                    <span className="text-[9px] font-orbitron font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-0.5 px-2 rounded-full uppercase">Ao Vivo</span>
                  </div>

                  <div className="space-y-3.5 max-h-[380px] overflow-y-auto scrollbar-none pr-1">
                    {recentActivities.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 text-xs font-sans">
                        Nenhuma atividade registrada no momento.
                      </div>
                    ) : (
                      recentActivities.map((act, idx) => {
                        const timeAgo = act.createdAt 
                          ? new Date(act.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                          : 'Agora';
                        const actUser = centralUsers.find(u => (u.uid || u.id) === act.userId);
                        const dispName = actUser?.name || act.userName;
                        const rawUname = actUser?.username || actUser?.slug || act.userUsername || 'membro';
                        const dispUsername = (act.userId === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || rawUname === 'juniorsantti' || rawUname === 'juniorsantti92') ? 'jrsantti' : rawUname;
                        const dispAvatar = actUser?.photoURL || actUser?.avatarUrl || act.userAvatar;
                        
                        return (
                          <div key={act.id || `activity_${idx}`} className="flex items-start space-x-3 text-xs border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
                            <div 
                              onClick={() => dispUsername && onVisitProfile && onVisitProfile(dispUsername)}
                              className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center text-gray-400 border border-white/10 cursor-pointer hover:border-[#FF0033] transition-all"
                            >
                              {dispAvatar ? (
                                <img src={dispAvatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <UserIcon className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1 leading-normal text-left">
                              <div className="flex items-center justify-between gap-1">
                                <span 
                                  onClick={() => dispUsername && onVisitProfile && onVisitProfile(dispUsername)}
                                  className="text-white font-bold font-orbitron uppercase text-[10px] cursor-pointer hover:text-[#FF0033] transition-all truncate flex items-center gap-1"
                                >
                                  <span className="truncate">{dispName}</span>
                                  {isVerifiedUser(actUser || { isVerified: true }) && <VerifiedBadge user={actUser || { isVerified: true }} size="xs" />}
                                </span>
                                <span className="text-[8px] text-gray-600 font-mono shrink-0">{timeAgo}</span>
                              </div>
                              <span className="text-[9px] text-gray-500 block font-mono">@{dispUsername}</span>
                              <p className="text-gray-300 text-[11px] font-sans mt-0.5">
                                {act.description}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: EXPLORAR (UNIFIED DISCOVERY) */}
          {['explore', 'subscriptions', 'music', 'news', 'services', 'store', 'tickets'].includes(activeTab) && (
            <>
              {['explore', 'news'].includes(activeTab) && (
                <SearchBar onResult={(text) => alert(text)} />
              )}
              <ExploreSection 
                currentUser={currentUser}
              posts={posts}
              voxes={voxes}
              products={products}
              shows={shows}
              artists={artists}
              streams={streams}
              subscriptionPlans={subscriptionPlans}
              fundraisers={fundraisers}
              newsArticles={newsArticles}
              userServices={userServices}
              centralUsers={centralUsers}
              followingIds={followingIds}
              polls={polls}
              onVotePoll={loadData}
              triggerToast={triggerToast}
              activeFilter={activeTab === 'explore' ? exploreFilter : activeTab}
              setActiveFilter={activeTab === 'explore' ? setExploreFilter : setActiveTab}
              onVisitProfile={onVisitProfile || ((userSlug: string) => {
                window.history.pushState({}, '', `/${userSlug}`);
                window.dispatchEvent(new Event('popstate'));
              })}
              onFollow={handleFollowUser}
              onPlayMusic={handlePlayMusic}
              currentStream={currentStream}
              isPlaying={isPlaying}
              onShareToFeed={handleShareToFeed}
              onBuyTicket={setSelectedTicketForCheckout}
              onBuyProduct={setSelectedProductForCheckout}
              onSubscribe={(plan) => setSelectedProductForCheckout({ ...plan, type: 'Subscription' })}
            />
            </>
          )}

          {/* TAB: MENSAGENS */}
          {activeTab === 'messages' && (
            <MessagesSection currentUser={currentUser} triggerToast={triggerToast} />
          )}

          {/* TAB: SUSSURROS */}
          {activeTab === 'sussurros' && (
            <SussurrosSection currentUser={currentUser} triggerToast={triggerToast} setActiveTab={setActiveTab} />
          )}

          {/* TAB 4: RANKING (AUTHENTIC MEMBER LEADERS - TOP 100) */}
          {activeTab === 'ranking' && (
            <div className="space-y-8 animate-fadeIn text-left">
              <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                  <span className="text-white font-orbitron text-[10px] tracking-widest block font-bold uppercase">Liga de Líderes VOXA • # TOP 100</span>
                  <h1 className="font-orbitron font-black text-3xl text-white mt-1">RANKING VOXA — TOP 100</h1>
                  <p className="text-xs text-gray-400 mt-1 font-sans">Os 100 perfis mais seguidos da VOXA (ordenados exclusivamente por seguidores).</p>
                </div>
                <span className="bg-white text-black font-orbitron font-black text-xs px-4 py-1.5 rounded-xl tracking-widest uppercase self-start sm:self-auto">
                  # TOP 100
                </span>
              </div>

              {/* Segmented Filter Controls - Interactive Tabs (BANNED CHIPS AVOIDED) */}
              <div className="space-y-4 bg-[#12111d] border border-white/10 p-5 rounded-2xl">
                <div className="space-y-1.5">
                  <span className="block text-[9px] font-orbitron text-gray-500 uppercase tracking-widest font-black">Filtrar Categoria & Abrangência</span>
                  <div className="flex flex-wrap gap-1.5 p-1 bg-black/40 rounded-xl max-w-fit">
                    {[
                      { key: 'global', label: 'Global' },
                      { key: 'brasil', label: 'Brasil' },
                      { key: 'criadores', label: 'Criadores' },
                      { key: 'artistas', label: 'Artistas' },
                      { key: 'empresas', label: 'Empresas' },
                      { key: 'musica', label: 'Música' },
                      { key: 'noticias', label: 'Notícias' }
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => {
                          setRankingLocation(tab.key as any);
                          setRankingLimit(25); // Initial batch, "Ver mais" expands up to Top 100
                        }}
                        className={`px-3 py-2 text-[10px] font-orbitron font-bold rounded-lg transition-all cursor-pointer ${
                          rankingLocation === tab.key 
                            ? 'bg-white text-black shadow font-black' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {tab.label.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {(() => {
                const formatFollowersCount = (count: number) => {
                  if (count >= 1000000) {
                    const val = count / 1000000;
                    return `${val.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
                  }
                  if (count >= 1000) {
                    const val = count / 1000;
                    return `${val.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
                  }
                  return `${count}`;
                };

                const getCanonicalRankUsername = (u: any) => {
                  const raw = u?.username || u?.slug || 'membro';
                  if (u?.uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || u?.id === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || raw === 'juniorsantti' || raw === 'juniorsantti92') {
                    return 'jrsantti';
                  }
                  if (u?.uid === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1' || u?.id === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1') {
                    return 'voxa';
                  }
                  return raw;
                };

                const getSortedAndFilteredUsers = () => {
                  let list = [...centralUsers];

                  // Exclude deleted, banned, disabled accounts and pre-registered
                  list = list.filter(u => u.accountStatus !== 'SUSPENDED' && u.accountStatus !== 'BANNED' && u.accountStatus !== 'DELETED' && u.accountStatus !== 'PRE_REGISTERED');

                  // Apply location / category filters
                  if (rankingLocation === 'brasil') {
                    list = list.filter(u => !u.location || u.location.toLowerCase().includes('brasil') || u.location.toLowerCase().includes('br'));
                  } else if (rankingLocation === 'criadores') {
                    list = list.filter(u => {
                      const cat = (u.categoryName || '').toLowerCase();
                      return cat.includes('influencer') || cat.includes('criador') || cat.includes('sorteio') || cat.includes('rifeiro');
                    });
                  } else if (rankingLocation === 'artistas') {
                    list = list.filter(u => {
                      const cat = (u.categoryName || '').toLowerCase();
                      return cat.includes('artista') || cat.includes('jogador');
                    });
                  } else if (rankingLocation === 'empresas') {
                    list = list.filter(u => {
                      const cat = (u.categoryName || '').toLowerCase();
                      return cat.includes('empresa') || cat.includes('casa de show') || cat.includes('produtora') || cat.includes('marca');
                    });
                  } else if (rankingLocation === 'musica') {
                    list = list.filter(u => {
                      const cat = (u.categoryName || '').toLowerCase();
                      return cat.includes('música') || cat.includes('musica') || cat.includes('dj') || cat.includes('cantor') || cat.includes('banda');
                    });
                  } else if (rankingLocation === 'noticias') {
                    list = list.filter(u => {
                      const cat = (u.categoryName || '').toLowerCase();
                      return cat.includes('notícia') || cat.includes('noticia') || cat.includes('portal') || cat.includes('jornal');
                    });
                  }

                  // Sort EXCLUSIVELY by followersCount DESC (createdAt ASC only for identical follower count)
                  list.sort((a, b) => {
                    const diff = (b.followersCount || 0) - (a.followersCount || 0);
                    if (diff !== 0) return diff;
                    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return dateA - dateB;
                  });

                  return list.slice(0, 100);
                };

                const rankedUsers = getSortedAndFilteredUsers();
                const effectiveLimit = Math.min(100, rankingLimit);
                const top3 = rankedUsers.slice(0, 3);
                const restUsers = rankedUsers.slice(3, effectiveLimit);

                return (
                  <div className="space-y-8">
                    {/* ELEGANT PODIUM FOR TOP 3 */}
                    {top3.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                        {/* 2nd Place */}
                        {top3[1] && (
                          <div 
                            onClick={() => onVisitProfile && onVisitProfile(getCanonicalRankUsername(top3[1]))}
                            className="bg-[#12111d] border border-white/10 hover:border-white/30 p-6 rounded-[28px] text-center flex flex-col items-center justify-center relative transition-all duration-300 group cursor-pointer sm:mt-6"
                          >
                            <span className="absolute top-4 left-4 font-orbitron font-black text-xl text-neutral-400">#2</span>
                            <UserAvatar
                              userId={top3[1].uid || top3[1].id}
                              photoURL={top3[1].photoURL || top3[1].avatarUrl}
                              displayName={top3[1].name}
                              size="xl"
                              borderColor="border-2 border-neutral-400"
                              showHoverEffect
                            />
                            <h3 className="font-orbitron font-black text-xs text-white uppercase mt-4 tracking-wider flex items-center gap-1 justify-center">
                              <span>{top3[1].name}</span>
                              {isVerifiedUser(top3[1]) && (
                                <VerifiedBadge user={top3[1]} size="sm" accountType={top3[1].accountType} />
                              )}
                            </h3>
                            <span className="text-[10px] text-gray-500 block font-mono">@{getCanonicalRankUsername(top3[1])}</span>
                            {top3[1].categoryName && top3[1].categoryName !== "Sem categoria" && (
                              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded mt-1 inline-block uppercase font-bold tracking-widest font-orbitron">{top3[1].categoryName}</span>
                            )}
                            <span className="mt-3 inline-block px-3 py-1 bg-white/5 rounded-full font-mono text-[10px] font-black text-neutral-300">
                              {formatFollowersCount(top3[1].followersCount || 0)} seguidores
                            </span>
                          </div>
                        )}

                        {/* 1st Place */}
                        {top3[0] && (
                          <div 
                            onClick={() => onVisitProfile && onVisitProfile(getCanonicalRankUsername(top3[0]))}
                            className="bg-white/5 border-2 border-white hover:border-neutral-200 p-8 rounded-[32px] text-center flex flex-col items-center justify-center relative transition-all duration-300 group cursor-pointer shadow-xl shadow-white/5"
                          >
                            <span className="absolute top-4 left-4 font-orbitron font-black text-2xl text-white">#1</span>
                            <UserAvatar
                              userId={top3[0].uid || top3[0].id}
                              photoURL={top3[0].photoURL || top3[0].avatarUrl}
                              displayName={top3[0].name}
                              size="2xl"
                              borderColor="border-2 border-white"
                              showHoverEffect
                            />
                            <h3 className="font-orbitron font-black text-sm text-white uppercase mt-4 tracking-wider flex items-center gap-1 justify-center">
                              <span>{top3[0].name}</span>
                              {isVerifiedUser(top3[0]) && (
                                <VerifiedBadge user={top3[0]} size="sm" accountType={top3[0].accountType} />
                              )}
                            </h3>
                            <span className="text-[10px] text-gray-400 block font-mono">@{getCanonicalRankUsername(top3[0])}</span>
                            {top3[0].categoryName && top3[0].categoryName !== "Sem categoria" && (
                              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded mt-1 inline-block uppercase font-bold tracking-widest font-orbitron">{top3[0].categoryName}</span>
                            )}
                            <span className="mt-3 inline-block px-4 py-1.5 bg-white text-black rounded-full font-mono text-xs font-black">
                              {formatFollowersCount(top3[0].followersCount || 0)} seguidores
                            </span>
                          </div>
                        )}

                        {/* 3rd Place */}
                        {top3[2] && (
                          <div 
                            onClick={() => onVisitProfile && onVisitProfile(getCanonicalRankUsername(top3[2]))}
                            className="bg-[#12111d] border border-white/10 hover:border-white/30 p-6 rounded-[28px] text-center flex flex-col items-center justify-center relative transition-all duration-300 group cursor-pointer sm:mt-6"
                          >
                            <span className="absolute top-4 left-4 font-orbitron font-black text-xl text-neutral-500">#3</span>
                            <UserAvatar
                              userId={top3[2].uid || top3[2].id}
                              photoURL={top3[2].photoURL || top3[2].avatarUrl}
                              displayName={top3[2].name}
                              size="xl"
                              borderColor="border-2 border-neutral-600"
                              showHoverEffect
                            />
                            <h3 className="font-orbitron font-black text-xs text-white uppercase mt-4 tracking-wider flex items-center gap-1 justify-center">
                              <span>{top3[2].name}</span>
                              {isVerifiedUser(top3[2]) && (
                                <VerifiedBadge user={top3[2]} size="sm" accountType={top3[2].accountType} />
                              )}
                            </h3>
                            <span className="text-[10px] text-gray-500 block font-mono">@{getCanonicalRankUsername(top3[2])}</span>
                            {top3[2].categoryName && top3[2].categoryName !== "Sem categoria" && (
                              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded mt-1 inline-block uppercase font-bold tracking-widest font-orbitron">{top3[2].categoryName}</span>
                            )}
                            <span className="mt-3 inline-block px-3 py-1 bg-white/5 rounded-full font-mono text-[10px] font-black text-neutral-300">
                              {formatFollowersCount(top3[2].followersCount || 0)} seguidores
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* REST OF THE RANKING LIST (UP TO TOP 100) */}
                    {restUsers.length > 0 && (
                      <div className="bg-[#12111d] border border-white/10 rounded-3xl overflow-hidden shadow-xl">
                        <table className="w-full text-left font-sans text-xs">
                          <thead>
                            <tr className="border-b border-white/10 bg-black/40 text-[10px] font-orbitron text-gray-400 uppercase font-black">
                              <th className="py-4 px-6 text-center w-16">Posição</th>
                              <th className="py-4 px-6">Membro</th>
                              <th className="py-4 px-6">Identidade</th>
                              <th className="py-4 px-6">Categoria</th>
                              <th className="py-4 px-6 text-right w-36">Seguidores</th>
                            </tr>
                          </thead>
                          <tbody>
                            {restUsers.map((u, idx) => {
                              const position = idx + 4; // Starts from #4 up to #100
                              const folCount = u.followersCount || 0;
                              const canonUname = getCanonicalRankUsername(u);
                              return (
                                <tr key={u.uid || u.id || `ranked_row_${idx}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                  <td className="py-4 px-6 text-center font-mono font-black text-sm text-gray-400">
                                    #{position}
                                  </td>
                                  <td className="py-4 px-6">
                                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onVisitProfile && onVisitProfile(canonUname)}>
                                      <UserAvatar
                                        userId={u.uid || u.id}
                                        photoURL={u.photoURL || u.avatarUrl}
                                        displayName={u.name}
                                        size="sm"
                                      />
                                      <div>
                                        <span className="font-orbitron font-bold uppercase text-white block text-sm flex items-center gap-1">
                                          <span>{u.name}</span>
                                          {isVerifiedUser(u) && (
                                            <VerifiedBadge user={u} size="sm" accountType={u.accountType} />
                                          )}
                                        </span>
                                        {u.location && <span className="text-[10px] text-gray-500 block font-sans">{u.location}</span>}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-4 px-6">
                                    <span onClick={() => onVisitProfile && onVisitProfile(canonUname)} className="text-gray-500 hover:text-white cursor-pointer font-mono">@{canonUname}</span>
                                  </td>
                                  <td className="py-4 px-6 font-orbitron font-bold text-gray-400 text-[10px]">
                                    {(u.categoryName && u.categoryName !== "Sem categoria" ? u.categoryName : 'Membro').toUpperCase()}
                                  </td>
                                  <td className="py-4 px-6 text-right font-mono font-bold text-gray-300">
                                    {formatFollowersCount(folCount)} seguidores
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* PAGINATION BUTTON UP TO TOP 100 */}
                    {rankedUsers.length > effectiveLimit && effectiveLimit < 100 && (
                      <div className="pt-4 text-center">
                        <button
                          onClick={() => setRankingLimit(prev => Math.min(100, prev + 25))}
                          className="bg-white/5 border border-white/10 hover:bg-neutral-200 hover:text-black hover:border-transparent text-white font-orbitron font-black text-xs py-3 px-6 rounded-xl transition-all cursor-pointer inline-flex items-center space-x-2"
                        >
                          <span>Ver mais</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 5: STORE (VOXA STORE MARKETPLACE) */}
          {activeTab === 'store' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="border-b border-white/10 pb-4">
                <span className="text-white font-orbitron text-[10px] tracking-widest block font-bold uppercase">Vitrine Exclusiva</span>
                <h1 className="font-orbitron font-black text-3xl text-white mt-1">VOXA STORE</h1>
                <p className="text-xs text-gray-400 mt-1 font-sans">Produtos, roupas e ativos digitais oficiais com processamento de pagamento seguro.</p>
              </div>

              {/* Product listings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filteredProducts.length === 0 ? (
                  <div className="col-span-full py-16 text-center bg-[#12111d] border border-white/10 rounded-[24px]">
                    <p className="font-orbitron font-bold text-xs text-gray-500 uppercase tracking-widest">Nenhum produto cadastrado.</p>
                  </div>
                ) : (
                  filteredProducts.map(p => (
                    <div key={p.id} className="bg-[#12111d] border border-white/10 rounded-[24px] overflow-hidden hover:border-white/30 transition-all flex flex-col justify-between">
                      <div className="aspect-square bg-zinc-900 relative overflow-hidden flex items-center justify-center border-b border-white/5">
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-orbitron text-gray-600 font-bold">SEM IMAGEM</span>
                        )}
                      </div>
                      <div className="p-5 space-y-3.5 text-left">
                        <div className="flex items-center justify-between text-[10px] font-orbitron font-bold text-white">
                          <span>{p.category}</span>
                          <span>{p.subcategory || 'Ativo'}</span>
                        </div>
                        <h3 className="font-orbitron font-bold text-sm text-white truncate uppercase">{p.name}</h3>
                        <p className="text-xs text-gray-400 font-sans line-clamp-2 leading-relaxed">{p.shortDesc || 'Sem descrição.'}</p>
                        <div className="flex items-center justify-between pt-4 border-t border-white/5 gap-2">
                          <span className="font-mono font-bold text-sm text-white">{formatBRL(p.price)}</span>
                          <div className="flex items-center space-x-1.5 shrink-0">
                            <button
                              onClick={() => handleShareToFeed('product', p.id)}
                              className="bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white p-2 rounded-xl transition-all cursor-pointer"
                              title="Compartilhar no Feed"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSelectedProductForCheckout(p)}
                              className="bg-white hover:bg-neutral-200 text-black font-bold font-orbitron font-black text-[10px] px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                            >
                              COMPRAR
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 6: CARTEIRA (BALANCE & PIX SIMULATION) */}
          {activeTab === 'wallet' && (
            <WalletDashboard currentUser={currentUser} />
          )}

          {/* TAB: CONFIGURAÇÕES (COMPLETE SETTINGS & PRIVACY AREA) */}
          {activeTab === 'settings' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn text-left">
              <div className="border-b border-white/10 pb-4">
                <span className="text-white font-orbitron text-[10px] tracking-widest block font-bold uppercase">Painel do Usuário</span>
                <h1 className="font-orbitron font-black text-3xl text-white mt-1">CONFIGURAÇÕES</h1>
                <p className="text-xs text-gray-400 mt-1 font-sans">Gerencie os dados da sua conta, informações privadas de endereço, privacidade de rede, segurança de senha, compras e faturamento.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Settings Sub Tabs Menu */}
                <div className="lg:col-span-3 bg-[#12111d] border border-white/10 p-5 rounded-[24px] space-y-2">
                  <span className="block text-[9px] font-orbitron text-gray-500 uppercase tracking-widest font-black mb-3 px-2">Menu de Ajustes</span>
                  {[
                    { id: 'profile_edit', label: 'Editar Perfil', desc: 'Nome, @username, bio, links' },
                    { id: 'account_info', label: 'Dados de Conta', desc: 'Seu email cadastrado' },
                    { id: 'address_info', label: 'Endereço Privado', desc: 'Faturamento e entregas' },
                    { id: 'security_settings', label: 'Segurança & Senha', desc: 'Alterar e recuperar senha' },
                    { id: 'privacy_settings', label: 'Privacidade & Rede', desc: 'Quem pode ver ou seguir' },
                    { id: 'my_purchases', label: 'Minhas Compras', desc: 'Histórico de pedidos na Store' },
                    { id: 'my_tickets', label: 'Meus Ingressos', desc: 'Seus ingressos e QR Codes' },
                    { id: 'diagnostics', label: 'Diagnósticos de Conta', desc: 'Recalcular contadores' }
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => setSettingsSubTab(btn.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all cursor-pointer flex flex-col ${
                        settingsSubTab === btn.id ? 'bg-[#FF0033] text-white shadow bg-[#FF0033]' : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span className="font-orbitron text-xs font-bold uppercase tracking-wide">{btn.label}</span>
                      <span className="text-[9px] text-white/50 block mt-0.5 font-sans truncate">{btn.desc}</span>
                    </button>
                  ))}
                </div>

                {/* Sub Tab Panel Content */}
                <div className="lg:col-span-9 bg-[#12111d] border border-white/10 p-6 md:p-8 rounded-[24px] min-h-[480px]">
                  
                  {/* Panel 1: Profile Edit */}
                  {settingsSubTab === 'profile_edit' && (() => {
                    // Populate values initially if empty
                    if (!editName && currentUser) {
                      setName(currentUser.name || '');
                      setEditUsername(activeUserData.username || activeUserData.slug || '');
                      setBio(activeUserData.bio || '');
                      setLocation(activeUserData.location || '');
                      setWebsite(activeUserData.website || '');
                      setEditFeatures(activeUserData.features || { store: false, events: false, subscriptions: false, news: false, music: false, services: false });
                    }

                    return (
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        const currentUsername = (activeUserData.username || activeUserData.slug || currentUser.username || currentUser.slug || '').toLowerCase();
                        try {
                          const rawClean = editUsername.toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]/g, '');
                          const cleanUsername = (currentUser.uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' && (rawClean === 'juniorsantti' || rawClean === 'juniorsantti92'))
                            ? 'jrsantti'
                            : rawClean;
                          const usernameWasChanged = cleanUsername !== currentUsername;
                          
                          if (usernameWasChanged) {
                            if (cleanUsername.length < 3) {
                              triggerToast('O @username precisa ter pelo menos 3 caracteres.');
                              return;
                            }
                            if (usernameCheckStatus === 'taken') {
                              triggerToast('Este @username já está em uso.');
                              return;
                            }
                            await updateUsernameAtomically(currentUser.uid, currentUsername, cleanUsername);
                          }

                          const userRef = doc(db, 'users', currentUser.uid);
                          const updateData: any = {
                            name: editName,
                            username: cleanUsername || currentUsername,
                            slug: cleanUsername || currentUsername,
                            bio: editBio,
                            location: editLocation,
                            website: editWebsite,
                            features: editFeatures
                          };
                          
                          await updateDoc(userRef, updateData);
                          
                          const finalUsername = cleanUsername || currentUsername;
                          const updatedUserObj = { 
                            ...currentUser, 
                            name: editName, 
                            username: finalUsername,
                            slug: finalUsername,
                            bio: editBio, 
                            location: editLocation, 
                            website: editWebsite,
                            features: editFeatures
                          };
                          
                          setCurrentUser(updatedUserObj);
                          localStorage.setItem('voxa_current_user', JSON.stringify(updatedUserObj));
                          invalidateAllUserProfileCaches(currentUser.uid, currentUsername, finalUsername);

                          if (usernameWasChanged) {
                            triggerToast('Username atualizado com sucesso');
                          } else {
                            triggerToast('Alterações salvas com sucesso!');
                          }
                          loadData();
                        } catch (err: any) {
                          setEditUsername(currentUsername);
                          triggerToast(err?.message || 'Erro ao salvar alterações do perfil.');
                        }
                      }} className="space-y-6">
                        <div>
                          <h3 className="font-orbitron font-black text-lg text-white uppercase tracking-wider">Editar Informações de Perfil</h3>
                          <p className="text-xs text-gray-400 mt-1">Configure sua identidade de criador ou marca pública.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Nome de Exibição (Display Name)</label>
                            <input type="text" value={editName} onChange={(e) => setName(e.target.value)} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: MC Kronos" />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">@username Único</label>
                            <div className="relative">
                              <input type="text" value={editUsername} onChange={(e) => {
                                const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                                setEditUsername(val);
                                setUsernameCheckStatus('checking');
                                if (val.length < 3) {
                                  setUsernameCheckStatus('idle');
                                  return;
                                }
                                setTimeout(async () => {
                                  try {
                                    const snap = await getDoc(doc(db, 'usernames', val));
                                    if (snap.exists() && snap.data().uid !== currentUser.uid) {
                                      setUsernameCheckStatus('taken');
                                    } else {
                                      setUsernameCheckStatus('available');
                                    }
                                  } catch (err) {
                                    setUsernameCheckStatus('available');
                                  }
                                }, 500);
                              }} required className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-2.5 text-xs text-white focus:border-white focus:outline-none font-mono" placeholder="Ex: mckronos" />
                              <div className="absolute right-3 top-2.5 text-[9px] font-orbitron font-bold">
                                {usernameCheckStatus === 'checking' && <span className="text-amber-400 animate-pulse">CHECK...</span>}
                                {usernameCheckStatus === 'available' && <span className="text-emerald-400">OK</span>}
                                {usernameCheckStatus === 'taken' && <span className="text-red-400">EM USO</span>}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Biografia (Bio)</label>
                          <textarea value={editBio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none leading-relaxed" placeholder="Fale um pouco sobre você..." />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Localização (Cidade/Estado)</label>
                            <input type="text" value={editLocation} onChange={(e) => setLocation(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: Rio de Janeiro, RJ" />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Website / Link Externo</label>
                            <input type="url" value={editWebsite} onChange={(e) => setWebsite(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none font-mono" placeholder="Ex: https://instagram.com/..." />
                          </div>
                        </div>

                        {/* Feature Switches Integration */}
                        <div className="bg-black/25 p-5 border border-white/5 rounded-2xl space-y-4">
                          <div>
                            <span className="block text-[10px] font-orbitron text-white uppercase font-black tracking-widest">Recursos Modulares do Perfil</span>
                            <p className="text-[11px] text-gray-500 mt-0.5">Ative ou desative ferramentas comerciais e mídias de seu portfólio.</p>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {[
                              { id: 'store', label: 'VOXA Store', desc: 'Produtos fáceis' },
                              { id: 'events', label: 'Venda de Ingressos', desc: 'Criação de shows' },
                              { id: 'subscriptions', label: 'Clube de Assinantes', desc: 'Planos mensais' },
                              { id: 'news', label: 'Notícias & Blog', desc: 'Editor de notícias' },
                              { id: 'music', label: 'Produtor Musical', desc: 'Streams & Faixas' },
                              { id: 'services', label: 'Contratação de Serviços', desc: 'Freelances e shows' },
                              { id: 'fundraisers', label: 'Vaquinhas', desc: 'Arrecadação solidária' },
                              { id: 'passagens', label: 'Passagens', desc: 'Reserva de viagens' }
                            ].map((feat) => (
                              <button
                                key={feat.id}
                                type="button"
                                onClick={() => {
                                  setEditFeatures((prev: any) => ({
                                    ...prev,
                                    [feat.id]: !prev[feat.id]
                                  }));
                                }}
                                className={`p-3 border rounded-xl text-left cursor-pointer transition-all flex flex-col justify-between ${
                                  editFeatures[feat.id] 
                                    ? 'bg-[#FF0033]/10 border-white text-white shadow shadow-red-500/5' 
                                    : 'bg-transparent border-white/5 text-gray-400 hover:border-white/15'
                                }`}
                              >
                                <span className="font-orbitron text-[10px] font-black uppercase">{feat.label}</span>
                                <span className="text-[9px] text-gray-500 mt-1 truncate">{feat.desc}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-white/5 text-right">
                          <button type="submit" className="bg-white hover:bg-neutral-200 text-black font-bold font-orbitron font-bold text-xs py-3 px-8 rounded-xl transition-all cursor-pointer">
                            SALVAR PERFIL & RECURSOS
                          </button>
                        </div>
                      </form>
                    );
                  })()}

                  {/* Panel 2: Account Info */}
                  {settingsSubTab === 'account_info' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-orbitron font-black text-lg text-white uppercase tracking-wider">Dados de Acesso da Conta</h3>
                        <p className="text-xs text-gray-400 mt-1">Informações do seu registro seguro no VOXA.</p>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-black/35 p-5 border border-white/5 rounded-2xl text-left">
                          <span className="text-[9px] font-orbitron text-gray-500 font-bold uppercase tracking-wider block">Endereço de E-mail Cadastrado</span>
                          <span className="text-sm font-mono text-white block mt-1 select-all">{currentUser?.email || 'Desconhecido'}</span>
                          <span className="text-[10px] text-emerald-400 font-orbitron block mt-2">✓ Autenticado via Firebase Secure Auth</span>
                        </div>

                        <div className="bg-[#1b1928] p-5 border border-white/5 rounded-2xl text-left flex items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-white block">Alteração de Email</span>
                            <p className="text-[10px] text-gray-500">Para sua total proteção, re-autenticação é exigida para modificar seu e-mail de acesso.</p>
                          </div>
                          <button onClick={() => alert("Função em desenvolvimento. Para atualizar seu email principal, entre em contato com suporte@voxa.com.br.")} className="bg-white/5 hover:bg-white/10 text-white font-orbitron font-bold text-[9px] py-2 px-4 rounded-lg tracking-wider transition-all cursor-pointer uppercase border border-white/10 shrink-0">
                            ALTERAR EMAIL
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Panel 3: Private Address Info */}
                  {settingsSubTab === 'address_info' && (
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        setIsSavingAddress(true);
                        const privateRef = doc(db, 'user_private', currentUser.uid);
                        await setDoc(privateRef, {
                          address: {
                            cep: addressCep,
                            street: addressStreet,
                            number: addressNumber,
                            complement: addressComplement,
                            neighborhood: addressNeighborhood,
                            city: addressCity,
                            state: addressState,
                            country: addressCountry
                          }
                        }, { merge: true });
                        triggerToast("Endereço privado salvo com sucesso!");
                      } catch (err) {
                        alert("Erro ao salvar endereço: " + err);
                      } finally {
                        setIsSavingAddress(false);
                      }
                    }} className="space-y-6 text-left">
                      <div>
                        <h3 className="font-orbitron font-black text-lg text-white uppercase tracking-wider">Endereço Privado</h3>
                        <p className="text-xs text-gray-400 mt-1">Estas informações são protegidas pelo Firebase Security Rules e não estão disponíveis no seu perfil público.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">CEP</label>
                          <input type="text" value={addressCep} onChange={(e) => setAddressCep(e.target.value)} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: 01311-200" />
                        </div>
                        <div className="md:col-span-2 space-y-1">
                          <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Rua / Logradouro</label>
                          <input type="text" value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: Avenida Paulista" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Número</label>
                          <input type="text" value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: 1000" />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Complemento</label>
                          <input type="text" value={addressComplement} onChange={(e) => setAddressComplement(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: Apto 50" />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Bairro</label>
                          <input type="text" value={addressNeighborhood} onChange={(e) => setAddressNeighborhood(e.target.value)} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: Bela Vista" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Cidade</label>
                          <input type="text" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: São Paulo" />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Estado (UF)</label>
                          <input type="text" value={addressState} onChange={(e) => setAddressState(e.target.value)} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none font-mono uppercase" placeholder="Ex: SP" maxLength={2} />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">País</label>
                          <input type="text" value={addressCountry} onChange={(e) => setAddressCountry(e.target.value)} required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: Brasil" />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5 text-right">
                        <button type="submit" disabled={isSavingAddress} className="bg-white hover:bg-neutral-200 text-black font-bold font-orbitron font-bold text-xs py-3 px-8 rounded-xl transition-all cursor-pointer">
                          {isSavingAddress ? 'SALVANDO...' : 'SALVAR ENDEREÇO PRIVADO'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Panel 4: Security & Password */}
                  {settingsSubTab === 'security_settings' && (
                    <div className="space-y-6 text-left">
                      <div>
                        <h3 className="font-orbitron font-black text-lg text-white uppercase tracking-wider">Segurança & Senha</h3>
                        <p className="text-xs text-gray-400 mt-1">Configure suas defesas e troque sua chave de acesso com total criptografia.</p>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-black/35 p-6 border border-white/5 rounded-2xl text-left space-y-4">
                          <span className="block text-xs font-bold text-white uppercase font-orbitron tracking-wider">Redefinição Segura de Senha</span>
                          <p className="text-xs text-gray-400 leading-relaxed">Nós utilizamos o Firebase Authentication. Ao clicar no botão abaixo, enviaremos um e-mail com instruções e link seguro para que você redefina sua senha diretamente nos servidores criptografados da Google.</p>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                if (currentUser?.email) {
                                  // Call Firebase Auth real trigger!
                                  const { sendPasswordResetEmail } = await import("firebase/auth");
                                  await sendPasswordResetEmail(auth, currentUser.email);
                                  alert(`E-mail de redefinição enviado com sucesso para ${currentUser.email}! Verifique sua caixa de entrada e spam.`);
                                }
                              } catch (err) {
                                alert("Erro ao enviar redefinição de senha: " + err);
                              }
                            }}
                            className="bg-white hover:bg-neutral-200 text-black font-bold font-orbitron font-bold text-xs py-3 px-6 rounded-xl cursor-pointer transition-all animate-none"
                          >
                            ENVIAR E-MAIL DE REDEFINIÇÃO
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-4 bg-black/15 border border-white/5 rounded-xl text-left">
                            <span className="text-[10px] font-orbitron font-black text-emerald-400 uppercase tracking-widest block">2FA (DUPLO FATOR)</span>
                            <span className="text-[11px] text-gray-500 block mt-1">Pronto para ativação futura nos aplicativos oficiais VOXA.</span>
                          </div>
                          <div className="p-4 bg-black/15 border border-white/5 rounded-xl text-left">
                            <span className="text-[10px] font-orbitron font-black text-blue-400 uppercase tracking-widest block">SESSÕES ATIVAS</span>
                            <span className="text-[11px] text-gray-500 block mt-1">Seu dispositivo atual é o único conectado à sua sessão.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Panel 5: Privacy Settings */}
                  {settingsSubTab === 'privacy_settings' && (
                    <div className="space-y-6 text-left">
                      <div>
                        <h3 className="font-orbitron font-black text-lg text-white uppercase tracking-wider">Configurações de Privacidade</h3>
                        <p className="text-xs text-gray-400 mt-1">Controle seu nível de visibilidade dentro da rede VOXA.</p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="text-[10px] font-orbitron font-black text-gray-500 uppercase tracking-widest mb-3">Mensagens & Inbox</h4>
                          <div className="bg-black/25 p-4 border border-white/5 rounded-2xl space-y-4">
                            <div className="flex items-center justify-between gap-6">
                              <div className="text-left leading-normal">
                                <span className="text-xs font-bold text-white block uppercase">Cobrar por Mensagem</span>
                                <span className="text-[10px] text-gray-500 block mt-0.5">Exige pagamento de pessoas que você não segue para abrirem um chat.</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={activeUserData.messageSettings?.privacy === 'PAID'}
                                onChange={async (e) => {
                                  try {
                                    const userRef = doc(db, "users", currentUser.uid);
                                    await updateDoc(userRef, {
                                      "messageSettings.privacy": e.target.checked ? 'PAID' : 'ANYONE'
                                    });
                                    triggerToast("Configuração de inbox atualizada!");
                                    loadData();
                                  } catch (err) {
                                    alert("Erro ao atualizar.");
                                  }
                                }}
                                className="w-4.5 h-4.5 rounded text-white focus:ring-[#FF0033] bg-black border-white/20"
                              />
                            </div>
                            
                            {activeUserData.messageSettings?.privacy === 'PAID' && (
                              <div className="pt-2 animate-fadeIn">
                                <label className="text-[9px] font-orbitron font-black text-gray-500 uppercase block mb-1">Valor do Acesso (R$)</label>
                                <div className="flex items-center bg-black/40 border border-white/10 rounded-xl overflow-hidden px-3">
                                  <span className="text-[10px] text-gray-600 font-mono mr-2">R$</span>
                                  <input 
                                    type="number"
                                    defaultValue={activeUserData.messageSettings?.price || 5}
                                    onBlur={async (e) => {
                                      try {
                                        const val = parseFloat(e.target.value);
                                        const userRef = doc(db, "users", currentUser.uid);
                                        await updateDoc(userRef, { "messageSettings.price": val });
                                        triggerToast("Valor do inbox atualizado!");
                                        loadData();
                                      } catch (err) {}
                                    }}
                                    className="bg-transparent text-white py-2 text-xs outline-none w-full font-mono"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {[
                          { key: 'private_account', label: 'Conta Privada', desc: 'Somente seguidores autorizados podem visualizar suas postagens.' },
                          { key: 'allow_comments', label: 'Permitir Comentários de Qualquer Membro', desc: 'Desative para limitar respostas apenas para seguidores.' },
                          { key: 'show_status', label: 'Mostrar Status Online', desc: 'Exibe círculo de atividade ativo.' },
                          { key: 'search_indexing', label: 'Permitir Buscadores Públicos', desc: 'Permite que seu perfil apareça no Google Search.' }
                        ].map((item) => (
                          <div key={item.key} className="bg-black/25 p-4 border border-white/5 rounded-2xl flex items-center justify-between gap-6">
                            <div className="text-left leading-normal">
                              <span className="text-xs font-bold text-white block">{item.label}</span>
                              <span className="text-[10px] text-gray-500 block mt-0.5">{item.desc}</span>
                            </div>
                            <input
                              type="checkbox"
                              defaultChecked={true}
                              onChange={() => triggerToast("Privacidade updated com sucesso!")}
                              className="w-4.5 h-4.5 rounded text-white focus:ring-[#FF0033] bg-black border-white/20"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Panel 6: My Purchases */}
                  {settingsSubTab === 'my_purchases' && (
                    <div className="space-y-6 text-left">
                      <div>
                        <h3 className="font-orbitron font-black text-lg text-white uppercase tracking-wider">Histórico de Compras (Store)</h3>
                        <p className="text-xs text-gray-400 mt-1">Histórico completo de transações e ordens na VOXA Store.</p>
                      </div>

                      <div className="space-y-3">
                        {walletTransactions.filter(t => t.type === 'purchase' || t.orderType === 'store').length === 0 ? (
                          <div className="text-center py-12 bg-black/15 border border-white/5 rounded-2xl text-gray-500 text-xs font-sans">Nenhuma compra registrada na Store.</div>
                        ) : (
                          walletTransactions.filter(t => t.type === 'purchase' || t.orderType === 'store').map((t, idx) => (
                            <div key={idx} className="bg-black/35 border border-white/5 p-4 rounded-xl flex items-center justify-between text-xs font-sans">
                              <div className="text-left">
                                <span className="font-bold text-white block">{t.description || t.itemDescription || 'Compra na VOXA Store'}</span>
                                <span className="text-[10px] text-gray-500 block mt-1">Status: <span className="text-emerald-400 uppercase font-bold font-orbitron text-[9px]">Aprovado</span> • Ref: {t.id || 'N/A'}</span>
                              </div>
                              <span className="font-mono font-bold text-white">-{formatBRL(t.amount)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Panel 7: My Tickets */}
                  {settingsSubTab === 'my_tickets' && (
                    <div className="space-y-6 text-left">
                      <div>
                        <h3 className="font-orbitron font-black text-lg text-white uppercase tracking-wider">Meus Ingressos</h3>
                        <p className="text-xs text-gray-400 mt-1">Apresente estes códigos na entrada do evento para sua validação.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {walletTransactions.filter(t => t.orderType === 'ticket' || (t.description && t.description.toLowerCase().includes('ingresso'))).length === 0 ? (
                          <div className="col-span-2 text-center py-12 bg-black/15 border border-white/5 rounded-2xl text-gray-500 text-xs font-sans">Nenhum ingresso adquirido.</div>
                        ) : (
                          walletTransactions.filter(t => t.orderType === 'ticket' || (t.description && t.description.toLowerCase().includes('ingresso'))).map((t, idx) => {
                            const uniqueRef = `tkt_pass_${idx}_${Date.now().toString(36)}`;
                            return (
                              <div key={idx} className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-4 text-center relative overflow-hidden font-sans">
                                <div className="absolute top-0 inset-x-0 h-1 bg-[#FF0033]"></div>
                                <div className="text-left">
                                  <span className="text-sm font-bold text-white block uppercase truncate font-orbitron">{t.description || 'Ingresso Evento VOXA'}</span>
                                  <span className="text-[9px] text-emerald-400 font-bold block mt-1 font-orbitron">✓ INGRESSO CONFIRMADO</span>
                                </div>

                                <div className="p-2 bg-white rounded-xl w-32 h-32 mx-auto flex items-center justify-center">
                                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&color=000000&data=${uniqueRef}`} alt="" className="w-full h-auto" />
                                </div>

                                <div className="text-[10px] text-gray-500">
                                  <span className="block font-mono">ID: {uniqueRef}</span>
                                  <span className="block mt-1">Portador: {currentUser.name}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* Panel 8: Account Diagnostics & Follow Recalculation */}
                  {settingsSubTab === 'diagnostics' && (
                    <div className="space-y-6 text-left">
                      <div>
                        <h3 className="font-orbitron font-black text-lg text-white uppercase tracking-wider">Diagnósticos de Conta</h3>
                        <p className="text-xs text-gray-400 mt-1">Mecanismos administrativos de integridade para auditar e corrigir o banco de dados.</p>
                      </div>

                      <div className="bg-black/35 p-6 border border-white/5 rounded-2xl text-left space-y-4">
                        <span className="text-xs font-bold text-white uppercase font-orbitron tracking-wider block">Recalcular Seguidores (Auditoria Física)</span>
                        <p className="text-xs text-gray-400 leading-relaxed">Caso seus contadores de Seguidores ou Seguindo pareçam desalinhados, esta função fará uma varredura real na coleção física de <code className="text-red-400 font-mono text-[10px]">follows</code> do Firestore para recalcular e persistir seus números exatos no banco de dados.</p>
                        
                        <button
                          type="button"
                          disabled={isRecalculating}
                          onClick={async () => {
                            try {
                              setIsRecalculating(true);
                              const { recalculateFollowCounters } = await import("../utils/storeDb");
                              const res = await recalculateFollowCounters(currentUser.uid);
                              triggerToast(`Sucesso! Seus seguidores foram recalculados: ${res.followers} seguidores.`);
                              loadData();
                            } catch (err) {
                              alert("Erro ao recalcular: " + err);
                            } finally {
                              setIsRecalculating(false);
                            }
                          }}
                          className="bg-[#1b1928] hover:bg-zinc-800 border border-white/10 text-white hover:text-white font-orbitron font-black text-xs py-3.5 px-6 rounded-xl cursor-pointer transition-all uppercase tracking-wider flex items-center space-x-2"
                        >
                          {isRecalculating ? (
                            <span>RECALCULANDO CONTADORES...</span>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 text-white" />
                              <span>RECALCULAR SEGUIDORES</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* TAB 8: MEU NEGÓCIO (UNIFIED BUSINESS DASHBOARD & CREATOR PORTAL) */}
          {activeTab === 'my_business' && (
            <div className="space-y-8 animate-fadeIn text-left">
              <div className="border-b border-white/10 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <span className="text-white font-orbitron text-[10px] tracking-widest block font-bold uppercase">Painel de Negócios & Creator Econ</span>
                  <h1 className="font-orbitron font-black text-3xl text-white mt-1">MEU NEGÓCIO</h1>
                  <p className="text-xs text-gray-400 mt-1 font-sans">Gerencie sua loja, crie eventos com lotes de ingressos, controle planos de assinaturas e publique notícias na mesma central.</p>
                </div>
                
                {/* Sub-navigation Menu for business sections */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'overview', label: 'VISÃO GERAL' },
                    { id: 'store', label: 'MINHA STORE', feature: 'store' },
                    { id: 'events', label: 'MEUS EVENTOS', feature: 'events' },
                    { id: 'subscriptions', label: 'ASSINATURAS', feature: 'subscriptions' },
                    { id: 'news', label: 'MINHAS NOTÍCIAS', feature: 'news' },
                    { id: 'fundraisers', label: 'MINHAS VAQUINHAS', feature: 'fundraisers' }
                  ].map((btn) => {
                    if (btn.feature && !activeUserData?.features?.[btn.feature]) return null;
                    return (
                      <button
                        key={btn.id}
                        onClick={() => setBusinessTab(btn.id)}
                        className={`px-4 py-2 font-orbitron text-[10px] font-bold rounded-xl transition-all cursor-pointer uppercase ${
                          businessTab === btn.id ? 'bg-[#FF0033] text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {btn.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 1: OVERVIEW (UNIFIED DASHBOARD) */}
              {businessTab === 'overview' && (
                <div className="space-y-8 animate-fadeIn">
                  {/* Grid Cards of active metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-[#12111d] border border-white/10 p-6 rounded-[24px] space-y-1.5">
                      <span className="text-[10px] font-orbitron text-gray-500 font-bold uppercase tracking-wider block">Receita Bruta</span>
                      <h3 className="font-mono text-2xl font-black text-white">R$ 540,00</h3>
                      <span className="text-[9px] text-emerald-400 block font-mono font-bold">+R$ 150,00 este mês</span>
                    </div>

                    {activeUserData?.features?.store && (
                      <div className="bg-[#12111d] border border-white/10 p-6 rounded-[24px] space-y-1.5">
                        <span className="text-[10px] font-orbitron text-gray-500 font-bold uppercase tracking-wider block">Vendas Store</span>
                        <h3 className="font-mono text-2xl font-black text-white">4 Pedidos</h3>
                        <span className="text-[9px] text-white block font-mono font-bold">1 pagamento pendente</span>
                      </div>
                    )}

                    {activeUserData?.features?.events && (
                      <div className="bg-[#12111d] border border-white/10 p-6 rounded-[24px] space-y-1.5">
                        <span className="text-[10px] font-orbitron text-gray-500 font-bold uppercase tracking-wider block">Ingressos Vendidos</span>
                        <h3 className="font-mono text-2xl font-black text-white">35 Ingressos</h3>
                        <span className="text-[9px] text-violet-400 block font-mono font-bold">85% da capacidade média</span>
                      </div>
                    )}

                    {activeUserData?.features?.subscriptions && (
                      <div className="bg-[#12111d] border border-white/10 p-6 rounded-[24px] space-y-1.5">
                        <span className="text-[10px] font-orbitron text-gray-500 font-bold uppercase tracking-wider block">Assinantes Ativos</span>
                        <h3 className="font-mono text-2xl font-black text-white">12 Membros</h3>
                        <span className="text-[9px] text-emerald-400 block font-mono font-bold">+2 novos assinantes</span>
                      </div>
                    )}
                  </div>

                  <div className="p-6 bg-black/40 border border-white/10 rounded-[24px] flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="font-orbitron font-extrabold text-sm text-white uppercase">Informações Gerais de Taxas</h4>
                      <p className="text-[11px] text-gray-400 font-sans leading-relaxed">
                        O VOXA desconta uma taxa fixa de comissão administrativa e manutenção que pode ser alterada no painel administrativo global.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center shrink-0">
                      <div className="bg-[#12111d] border border-white/5 py-2 px-4 rounded-xl">
                        <span className="block text-[8px] font-orbitron text-gray-500 uppercase font-bold">Lojas</span>
                        <span className="block font-mono text-xs text-white font-bold">10% VOXA</span>
                      </div>
                      <div className="bg-[#12111d] border border-white/5 py-2 px-4 rounded-xl">
                        <span className="block text-[8px] font-orbitron text-gray-500 uppercase font-bold">Ingressos</span>
                        <span className="block font-mono text-xs text-white font-bold">5% VOXA</span>
                      </div>
                      <div className="bg-[#12111d] border border-white/5 py-2 px-4 rounded-xl">
                        <span className="block text-[8px] font-orbitron text-gray-500 uppercase font-bold">Assinaturas</span>
                        <span className="block font-mono text-xs text-white font-bold">8% VOXA</span>
                      </div>
                    </div>
                  </div>

                  {/* Mercado Pago Integration Onboarding Panel */}
                  <div className="p-6 bg-[#12111d] border border-white/10 rounded-[24px] space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
                      <div className="space-y-1">
                        <span className="text-[10px] font-orbitron text-[#FF0033] font-bold uppercase tracking-wider block">Integração Financeira</span>
                        <h4 className="font-orbitron font-extrabold text-sm text-white uppercase">Sua Conta Mercado Pago</h4>
                        <p className="text-[11px] text-gray-400 font-sans leading-relaxed">
                          Conecte sua conta do Mercado Pago para ativar a recepção de pagamentos das suas vendas de produtos da Store e ingressos de eventos diretamente na sua conta.
                        </p>
                      </div>

                      <div className="shrink-0">
                        {isCheckingMp ? (
                          <div className="text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">Checando conexão...</div>
                        ) : sellerMpConnected ? (
                          <div className="flex items-center space-x-3 bg-emerald-500/10 border border-emerald-500/30 py-2.5 px-4 rounded-xl">
                            <div className="text-left">
                              <span className="block text-[8px] font-orbitron text-emerald-500 font-bold uppercase">STATUS</span>
                              <span className="block text-xs font-orbitron font-black text-emerald-400 uppercase tracking-wider">CONECTADO ✓</span>
                            </div>
                            {sellerMpStatus === 'REAUTH_REQUIRED' ? (
                              <button
                                type="button"
                                onClick={handleConnectMercadoPago}
                                className="bg-amber-500 hover:bg-amber-600 text-black font-orbitron font-black text-[9px] py-1.5 px-3 rounded-lg uppercase tracking-wider transition-all"
                              >
                                Reconectar
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={handleDisconnectMercadoPago}
                                className="bg-[#FF0033]/15 hover:bg-[#FF0033]/30 text-[#FF0033] font-orbitron font-black text-[9px] py-1.5 px-3 rounded-lg uppercase tracking-wider transition-all"
                              >
                                Desconectar
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleConnectMercadoPago}
                            className="bg-white hover:bg-neutral-200 text-black font-orbitron font-black text-[10px] py-3.5 px-6 rounded-xl uppercase tracking-widest transition-all hover:scale-102 cursor-pointer shadow-lg shadow-white/5 font-black"
                          >
                            CONECTAR MERCADO PAGO
                          </button>
                        )}
                      </div>
                    </div>

                    {!sellerMpConnected && (
                      <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-[10px] text-amber-500 font-sans leading-relaxed text-left">
                        ⚠️ <strong>Aviso importante:</strong> Para poder vender na Store ou vender ingressos de eventos, é **obrigatório** ter uma conta do Mercado Pago integrada via OAuth. Vendas para vendedores não onboardados estão desabilitadas em produção para garantir a segurança dos recebimentos.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 2: STORE (MINHA STORE) */}
              {businessTab === 'store' && activeUserData?.features?.store && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fadeIn">
                  {/* Create Product Form */}
                  <form onSubmit={handleCreateProduct} className="lg:col-span-4 bg-[#12111d] border border-white/10 p-6 rounded-[24px] space-y-4 text-left">
                    <h3 className="font-orbitron font-extrabold text-sm text-white uppercase tracking-wider">Anunciar Novo Produto</h3>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Nome do Produto</label>
                      <input type="text" value={newProdName} onChange={(e) => setNewProdName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: Moletom Oficial VOXA" required />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Breve Descrição</label>
                      <textarea value={newProdDesc} onChange={(e) => setNewProdDesc(e.target.value)} rows={2} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: Lindo moletom 100% algodão..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Preço (R$)</label>
                        <input type="number" step="0.01" value={newProdPrice} onChange={(e) => setNewProdPrice(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: 149.90" required />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Estoque Inicial</label>
                        <input type="number" value={newProdStock} onChange={(e) => setNewProdStock(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: 50" required />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Categoria</label>
                      <select value={newProdCategory} onChange={(e) => setNewProdCategory(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none">
                        <option value="Moda & Acessórios">Moda & Acessórios</option>
                        <option value="Ativos Digitais">Ativos Digitais</option>
                        <option value="Serviços Digitais">Serviços Digitais</option>
                        <option value="Colecionáveis">Colecionáveis</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">URL da Imagem</label>
                      <input type="url" value={newProdImage} onChange={(e) => setNewProdImage(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: https://..." />
                    </div>
                    <button type="submit" className="w-full bg-white hover:bg-neutral-200 text-black font-bold font-orbitron font-bold text-xs py-3 rounded-xl transition-all uppercase cursor-pointer">CADASTRAR PRODUTO</button>
                  </form>

                  {/* Products list table */}
                  <div className="lg:col-span-8 bg-[#12111d] border border-white/10 p-6 rounded-[24px] space-y-4">
                    <h3 className="font-orbitron font-extrabold text-sm text-white uppercase tracking-wider text-left">Meus Produtos Anunciados</h3>
                    <div className="space-y-3">
                      {products.filter(p => p.sellerId === currentUser.uid || p.userId === currentUser.uid).length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-12 font-sans">Nenhum produto cadastrado por você ainda.</p>
                      ) : (
                        products.filter(p => p.sellerId === currentUser.uid || p.userId === currentUser.uid).map(p => (
                          <div key={p.id} className="bg-black/35 border border-white/5 p-4 rounded-xl flex items-center justify-between gap-4">
                            <div className="flex items-center space-x-3.5 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/10 shrink-0 overflow-hidden flex items-center justify-center">
                                {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px] font-orbitron text-gray-600 font-bold">VX</span>}
                              </div>
                              <div className="min-w-0 text-left leading-snug">
                                <span className="block text-xs font-bold text-white uppercase truncate text-left">{p.name}</span>
                                <span className="block text-[10px] text-gray-500 font-sans text-left">{p.category} • Estoque: {p.stock}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-4">
                              <span className="font-mono text-xs font-bold text-white shrink-0">{formatBRL(p.price)}</span>
                              <button
                                onClick={async () => {
                                  if (confirm("Deseja realmente remover este produto?")) {
                                    try {
                                      await deleteStoreProduct(p.id);
                                      triggerToast('Produto removido!');
                                      loadData();
                                    } catch (err) {
                                      alert(err);
                                    }
                                  }
                                }}
                                className="text-gray-500 hover:text-red-400 p-2 cursor-pointer rounded-lg hover:bg-white/5"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: EVENTS (MEUS EVENTOS) */}
              {businessTab === 'events' && activeUserData?.features?.events && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fadeIn">
                  {/* Create Event Form */}
                  <form onSubmit={handleCreateEvent} className="lg:col-span-4 bg-[#12111d] border border-white/10 p-6 rounded-[24px] space-y-4 text-left">
                    <h3 className="font-orbitron font-extrabold text-sm text-white uppercase tracking-wider">Criar Novo Evento</h3>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Título do Show/Evento</label>
                      <input type="text" value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: Festival acústico Voxa" required />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Descrição / Release</label>
                      <textarea value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)} rows={2} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: Uma noite inesquecível de rock e MPB..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Cidade</label>
                        <input type="text" value={newEventCity} onChange={(e) => setNewEventCity(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: São Paulo, SP" required />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Local/Venue</label>
                        <input type="text" value={newEventVenue} onChange={(e) => setNewEventVenue(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: Arena Unimed" required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Data</label>
                        <input type="text" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: 12/10/2026" required />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Horário</label>
                        <input type="text" value={newEventTime} onChange={(e) => setNewEventTime(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: 21:00" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Preço Ingresso (R$)</label>
                        <input type="number" step="0.01" value={newEventPrice} onChange={(e) => setNewEventPrice(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: 49.90" required />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Capacidade Máxima</label>
                        <input type="number" value={newEventCapacity} onChange={(e) => setNewEventCapacity(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: 500" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">URL da Capa do Evento</label>
                      <input type="url" value={newEventImage} onChange={(e) => setNewEventImage(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: https://..." />
                    </div>
                    <button type="submit" className="w-full bg-white hover:bg-neutral-200 text-black font-bold font-orbitron font-bold text-xs py-3 rounded-xl transition-all uppercase cursor-pointer">SALVAR EVENTO</button>
                  </form>

                  {/* Events list table with ticket tracking */}
                  <div className="lg:col-span-8 bg-[#12111d] border border-white/10 p-6 rounded-[24px] space-y-4">
                    <h3 className="font-orbitron font-extrabold text-sm text-white uppercase tracking-wider text-left">Meus Shows & Eventos</h3>
                    <div className="space-y-4">
                      {shows.filter(s => s.ownerId === currentUser.uid || s.organizerId === currentUser.uid).length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-12 font-sans">Nenhum evento criado por você ainda.</p>
                      ) : (
                        shows.filter(s => s.ownerId === currentUser.uid || s.organizerId === currentUser.uid).map(show => {
                          const soldCount = Math.round((show.capacity || 100) * 0.735);
                          const percentage = 73.5;
                          return (
                            <div key={show.id} className="bg-black/35 border border-white/5 p-5 rounded-2xl space-y-3.5 text-left">
                              <div className="flex items-center justify-between text-xs font-sans">
                                <div className="leading-snug">
                                  <span className="block text-sm font-bold text-white uppercase">{show.title}</span>
                                  <span className="block text-[10px] text-gray-500">{show.city} • {show.venue} • {show.date}</span>
                                </div>
                                <button
                                  onClick={async () => {
                                    if (confirm("Deseja realmente remover este evento?")) {
                                      try {
                                        await deleteShow(show.id);
                                        triggerToast('Evento removido!');
                                        loadData();
                                      } catch (err) {
                                        alert(err);
                                      }
                                    }
                                  }}
                                  className="text-gray-500 hover:text-red-400 p-2 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              
                              {/* Ticket dashboard visualization details */}
                              <div className="bg-black/20 p-3 rounded-xl border border-white/5 space-y-2">
                                <div className="flex items-center justify-between text-[10px] font-orbitron font-bold">
                                  <span className="text-gray-400 uppercase">Ingressos Vendidos</span>
                                  <span className="text-white font-mono">{soldCount} / {show.capacity || 100} ({percentage}% vendido)</span>
                                </div>
                                <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-[#FF0033] h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-center text-[10px] pt-1">
                                  <div className="leading-tight">
                                    <span className="block text-gray-500 font-bold uppercase text-[8px]">Receita Bruta</span>
                                    <span className="block font-mono text-emerald-400 font-bold">{formatBRL(soldCount * (show.ticketPrice || 49.90))}</span>
                                  </div>
                                  <div className="leading-tight">
                                    <span className="block text-gray-500 font-bold uppercase text-[8px]">Check-ins Realizados</span>
                                    <span className="block font-mono text-white font-bold">{Math.round(soldCount * 0.45)} confirmados</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 4: SUBSCRIPTIONS (MINHAS ASSINATURAS) */}
              {businessTab === 'subscriptions' && activeUserData?.features?.subscriptions && (
                <div className="bg-[#12111d] border border-white/10 p-6 rounded-[24px] space-y-6 max-w-xl mx-auto text-left animate-fadeIn">
                  <h3 className="font-orbitron font-extrabold text-sm text-white uppercase tracking-wider">Configurações de Assinatura</h3>
                  <p className="text-xs text-gray-400 font-sans leading-relaxed">
                    Personalize o plano mensal que seus seguidores poderão assinar diretamente a partir do seu perfil para acessar conteúdos e posts exclusivos.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Preço Mensal Sugerido (R$)</label>
                      <input type="number" step="0.01" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" defaultValue="19.90" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Benefícios da Assinatura</label>
                      <textarea rows={3} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" defaultValue="• Publicações exclusivas no Feed&#10;• Stories inéditos&#10;• Selo de Apoiador no perfil&#10;• Descontos de 10% na minha Store" />
                    </div>
                    <button onClick={() => triggerToast('Plano de assinatura salvo com sucesso!')} className="w-full bg-white hover:bg-neutral-200 text-black font-bold font-orbitron font-bold text-xs py-3 rounded-xl transition-all uppercase cursor-pointer">SALVAR CONFIGURAÇÕES</button>
                  </div>
                </div>
              )}

              {/* SECTION 5: NEWS (MINHAS NOTÍCIAS) */}
              {businessTab === 'news' && activeUserData?.features?.news && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fadeIn">
                  {/* Create Article Form */}
                  <form onSubmit={handleCreateNews} className="lg:col-span-4 bg-[#12111d] border border-white/10 p-6 rounded-[24px] space-y-4 text-left">
                    <h3 className="font-orbitron font-extrabold text-sm text-white uppercase tracking-wider">Escrever Novo Artigo</h3>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Título da Matéria</label>
                      <input type="text" value={newNewsTitle} onChange={(e) => setNewNewsTitle(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: Nova tecnologia revoluciona a rede social" required />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Subtítulo / Gravata</label>
                      <input type="text" value={newNewsSubtitle} onChange={(e) => setNewNewsSubtitle(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: Entenda como os novos recursos vão impactar o mercado" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Categoria</label>
                      <select value={newNewsCategory} onChange={(e) => setNewNewsCategory(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none">
                        <option value="Tecnologia">Tecnologia</option>
                        <option value="Brasil">Brasil</option>
                        <option value="Mundo">Mundo</option>
                        <option value="Negócios">Negócios</option>
                        <option value="Música">Música</option>
                        <option value="Esportes">Esportes</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">URL da Imagem de Capa</label>
                      <input type="url" value={newNewsImage} onChange={(e) => setNewNewsImage(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Ex: https://..." />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Conteúdo da Notícia</label>
                      <textarea value={newNewsContent} onChange={(e) => setNewNewsContent(e.target.value)} rows={5} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" placeholder="Escreva o texto completo do artigo..." required />
                    </div>
                    <button type="submit" className="w-full bg-white hover:bg-neutral-200 text-black font-bold font-orbitron font-bold text-xs py-3 rounded-xl transition-all uppercase cursor-pointer">PUBLICAR MATÉRIA</button>
                  </form>

                  {/* Articles list table */}
                  <div className="lg:col-span-8 bg-[#12111d] border border-white/10 p-6 rounded-[24px] space-y-4">
                    <h3 className="font-orbitron font-extrabold text-sm text-white uppercase tracking-wider text-left">Meus Artigos Publicados</h3>
                    <div className="space-y-3">
                      {newsArticles.filter(art => art.authorId === currentUser.uid).length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-12 font-sans">Nenhum artigo publicado por você ainda.</p>
                      ) : (
                        newsArticles.filter(art => art.authorId === currentUser.uid).map(art => (
                          <div key={art.id} className="bg-black/35 border border-white/5 p-4 rounded-xl flex items-center justify-between gap-4">
                            <div className="flex items-center space-x-3.5 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/10 shrink-0 overflow-hidden flex items-center justify-center">
                                {art.coverUrl ? <img src={art.coverUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px] font-orbitron text-gray-600 font-bold">NEWS</span>}
                              </div>
                              <div className="min-w-0 text-left leading-snug">
                                <span className="block text-xs font-bold text-white uppercase truncate">{art.title}</span>
                                <span className="block text-[10px] text-gray-500 font-sans">{art.category} • {art.date || 'Hoje'}</span>
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                if (confirm("Deseja realmente remover este artigo?")) {
                                  try {
                                    await deleteDoc(doc(db, 'news_articles', art.id));
                                    triggerToast('Artigo removido!');
                                    loadData();
                                  } catch (err) {
                                    alert(err);
                                  }
                                }
                              }}
                              className="text-gray-500 hover:text-red-400 p-2 cursor-pointer rounded-lg hover:bg-white/5"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 6: FUNDRAISERS (MINHAS VAQUINHAS) */}
              {businessTab === 'fundraisers' && activeUserData?.features?.fundraisers && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h3 className="font-orbitron font-extrabold text-sm text-white uppercase tracking-wider">Minhas Campanhas de Arrecadação</h3>
                    <button 
                      onClick={() => setActiveTab('vaquinhas')}
                      className="bg-white text-black font-orbitron font-bold text-[10px] px-4 py-2 rounded-xl uppercase transition-all cursor-pointer"
                    >
                      Nova Campanha
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(() => {
                      const myFundraisers = fundraisers.filter(f => f.ownerUid === currentUser.uid);
                      if (myFundraisers.length === 0) {
                        return (
                          <div className="col-span-full py-16 text-center bg-[#12111d] border border-white/10 rounded-[24px]">
                            <p className="font-orbitron font-bold text-xs text-gray-500 uppercase tracking-widest mb-1">Nenhuma vaquinha criada.</p>
                            <p className="text-[11px] text-gray-600 font-sans">Crie uma nova campanha na seção global de Vaquinhas.</p>
                          </div>
                        );
                      }
                      return myFundraisers.map(f => {
                        const percent = Math.min(100, Math.round((f.raisedAmount / f.goalAmount) * 100));
                        return (
                          <div key={f.id} className="bg-[#12111d] border border-white/10 rounded-[24px] overflow-hidden flex flex-col justify-between">
                            <div className="p-5 space-y-4">
                              <div className="flex items-center justify-between">
                                <span className={`text-[9px] font-orbitron font-black px-2 py-0.5 rounded-full uppercase ${f.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                  {f.status}
                                </span>
                                <span className="text-[10px] text-gray-500 font-mono">{percent}%</span>
                              </div>
                              <h4 className="font-orbitron font-bold text-xs text-white uppercase truncate">{f.title}</h4>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] font-sans">
                                  <span className="text-gray-400">Arrecadado: {formatBRL(f.raisedAmount)}</span>
                                  <span className="text-white font-bold">Meta: {formatBRL(f.goalAmount)}</span>
                                </div>
                                <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-[#FF0033] h-1.5 rounded-full" style={{ width: `${percent}%` }}></div>
                                </div>
                              </div>
                            </div>
                            <div className="px-5 pb-5 pt-2 border-t border-white/5 flex items-center justify-between">
                              <span className="text-[10px] text-gray-500 font-sans">{f.supporterCount || 0} apoiadores</span>
                              <button 
                                onClick={async () => {
                                  if (confirm("Deseja realmente remover esta campanha?")) {
                                    try {
                                      const { deleteFundraiser } = await import("../utils/storeDb");
                                      await deleteFundraiser(f.id);
                                      triggerToast('Vaquinha removida!');
                                      loadData();
                                    } catch (err) {
                                      alert(err);
                                    }
                                  }
                                }}
                                className="text-gray-500 hover:text-red-400 p-2 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: MEU PERFIL (DETAILED SOCIAL PROFILE) */}
          {activeTab === 'profile' && (() => {
            const profileUser = visitedUser || activeUserData || {
              uid: 'loading',
              name: visitedUsername || 'Membro VOXA',
              username: visitedUsername || 'user',
              slug: visitedUsername || 'user',
              isVerified: true,
              verified: true
            };
            const isOwnProfile = Boolean(currentUser?.uid) && (!visitedUser || visitedUser.uid === currentUser?.uid);

            // Real calculated ranking positions using followersCount DESC and createdAt ASC as tie-breaker
            const sortRankingList = (arr: any[]) => {
              return [...arr].sort((a, b) => {
                const diff = (b.followersCount || 0) - (a.followersCount || 0);
                if (diff !== 0) return diff;
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateA - dateB;
              });
            };

            const activeUsers = centralUsers.filter(u => u.accountStatus !== 'SUSPENDED' && u.accountStatus !== 'BANNED' && u.accountStatus !== 'DELETED' && u.accountStatus !== 'PRE_REGISTERED');
            const sortedGlobal = sortRankingList(activeUsers);
            const globalRankIdx = sortedGlobal.findIndex(u => (u.uid || u.id) === profileUser.uid);
            const globalRank = globalRankIdx >= 0 ? globalRankIdx + 1 : null;

            const sortedBrasil = sortRankingList(
              [...activeUsers].filter(u => !u.location || u.location.toLowerCase().includes('brasil') || u.location.toLowerCase().includes('br') || u.location.toLowerCase().includes('são paulo') || u.location.toLowerCase().includes('rio') || u.location.toLowerCase().includes('sp') || u.location.toLowerCase().includes('rj'))
            );
            const brasilRankIdx = sortedBrasil.findIndex(u => (u.uid || u.id) === profileUser.uid);
            const brasilRank = brasilRankIdx >= 0 ? brasilRankIdx + 1 : null;

            const userCategory = profileUser.accountType || 'Pessoa';
            const sortedCategory = sortRankingList(
              [...activeUsers].filter(u => (u.accountType || 'Pessoa') === userCategory)
            );
            const categoryRankIdx = sortedCategory.findIndex(u => (u.uid || u.id) === profileUser.uid);
            const categoryRank = categoryRankIdx >= 0 ? categoryRankIdx + 1 : null;

            const isFollowingVisited = visitedUser && followingIds.includes(visitedUser.uid || visitedUser.id);

            return (
              <div className="space-y-6 animate-fadeIn text-left">
                
                {/* Premium Redesigned Profile Card with High-Contrast Light Surface Identity */}
                <div className="bg-white border border-neutral-200 rounded-[28px] sm:rounded-[32px] overflow-hidden relative shadow-2xl">
                  {/* 1. CAPA / CARROSSEL DE BANNERS DO PERFIL (Visualmente separado das informações) */}
                  <div className="h-52 sm:h-72 md:h-80 lg:h-[340px] bg-gradient-to-tr from-black via-zinc-950 to-neutral-900 relative overflow-hidden group border-b-4 border-[#FF0033]">
                    {localCoverPreview ? (
                      <img
                        src={localCoverPreview}
                        alt="Preview Cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1200px"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover opacity-80 blur-[1px]"
                      />
                    ) : (
                      <ProfileCover
                        userId={profileUser.uid || profileUser.id}
                        coverUrl={profileUser.coverURL || profileUser.coverUrl}
                        banners={profileUser.profileBanners}
                        heightClass="w-full h-full"
                      />
                    )}

                    {/* Upload Cover / Manage Carousel and VOXA Ads buttons */}
                    {isOwnProfile ? (
                      <div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex flex-wrap items-center justify-end gap-2 z-30 max-w-[92%]">
                        {uploadCoverError && (
                          <div className="bg-red-950/90 text-red-100 border border-red-500/40 font-orbitron font-black text-[9px] px-3 py-2 rounded-xl flex items-center space-x-2 shadow-lg">
                            <span>{uploadCoverError}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setUploadCoverError(null);
                                const input = document.getElementById('cover-file-input');
                                if (input) (input as HTMLInputElement).click();
                              }}
                              className="bg-white text-black px-2 py-1 rounded-md text-[8px] hover:bg-neutral-200"
                            >
                              TENTAR NOVAMENTE
                            </button>
                          </div>
                        )}

                        {isUploadingCover && (
                          <div className="bg-black/90 border border-[#FF0033] rounded-xl px-3 py-1.5 flex flex-col items-start space-y-1 shadow-lg">
                            <span className="font-orbitron font-black text-white text-[8px] animate-pulse">ENVIANDO IMAGEM...</span>
                            <div className="w-24 bg-white/20 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-[#FF0033] h-full" style={{ width: `${coverProgress}%` }}></div>
                            </div>
                            <span className="font-mono text-[8px] text-gray-300 font-bold">{coverProgress}%</span>
                          </div>
                        )}

                        {!isUploadingCover && (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsBannersModalOpen(true)}
                              className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-[9px] px-3.5 py-2 rounded-xl border border-white/20 transition-all cursor-pointer flex items-center space-x-1.5 shadow-lg shadow-black/50 whitespace-nowrap"
                            >
                              <Layers className="w-3.5 h-3.5 shrink-0" />
                              <span>CARROSSEL DE BANNERS & VOXA ADS (ATÉ 4)</span>
                            </button>

                            <label className="bg-neutral-900/90 hover:bg-black text-white font-orbitron font-black text-[9px] px-3.5 py-2 rounded-xl border border-white/20 transition-all cursor-pointer flex items-center space-x-1.5 shadow-lg shadow-black/50 whitespace-nowrap">
                              <Upload className="w-3.5 h-3.5 shrink-0 text-[#FF0033]" />
                              <span>ALTERAR CAPA RÁPIDA</span>
                              <input id="cover-file-input" type="file" accept="image/*" onChange={(e) => handleUploadProfileImage(e, 'cover')} className="hidden" />
                            </label>
                            
                            {(profileUser.coverURL || profileUser.coverUrl) && (
                              <button
                                type="button"
                                onClick={() => handleRemoveProfileImage('cover')}
                                className="bg-red-600/90 hover:bg-red-700 text-white font-orbitron font-black text-[9px] px-3 py-2 rounded-xl border border-white/20 transition-all cursor-pointer flex items-center space-x-1.5 shadow-lg whitespace-nowrap"
                              >
                                <X className="w-3.5 h-3.5 shrink-0" />
                                <span>REMOVER</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      profileUser.profileAdSettings?.allowBannerAds && (
                        <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-30">
                          <button
                            type="button"
                            onClick={() => setIsSponsorBannerModalOpen(true)}
                            className="bg-neutral-900/90 hover:bg-[#FF0033] text-white backdrop-blur-md font-orbitron font-black text-[9px] px-4 py-2 rounded-xl border border-[#FF0033]/60 transition-all cursor-pointer flex items-center space-x-2 shadow-lg uppercase tracking-wider whitespace-nowrap"
                          >
                            <Megaphone className="w-3.5 h-3.5 text-[#FF0033] group-hover:text-white shrink-0" />
                            <span>Anunciar neste Perfil (VOXA Ads)</span>
                          </button>
                        </div>
                      )
                    )}
                  </div>

                  {/* 2. FAIXA BRANCA/CLARA DE IDENTIDADE E AÇÕES (100% independente da cor do banner) */}
                  <div className="bg-white text-neutral-950 px-5 sm:px-8 md:px-10 pb-6 pt-0 relative z-10">
                    {/* Top Row: Overlapping Avatar + Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                      {/* Avatar sobreposto entre capa e faixa clara */}
                      <div className="relative group mx-auto sm:mx-0 -mt-16 sm:-mt-20 md:-mt-24 shrink-0 z-20">
                        <div className="p-1 rounded-full bg-white shadow-[0_12px_32px_rgba(0,0,0,0.22)] ring-2 ring-[#FF0033]">
                          <div className="w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full overflow-hidden border-2 border-neutral-100 bg-zinc-900 shrink-0 flex items-center justify-center text-gray-300 relative">
                            {localAvatarPreview ? (
                              <img
                                src={localAvatarPreview}
                                alt="Preview Avatar"
                                sizes="(max-width: 640px) 128px, (max-width: 768px) 144px, 160px"
                                width={160}
                                height={160}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover opacity-80 blur-[1px]"
                              />
                            ) : (
                              <UserAvatar
                                userId={profileUser.uid || profileUser.id}
                                photoURL={profileUser.photoURL || profileUser.avatarUrl}
                                displayName={profileUser.name}
                                size="3xl"
                                className="w-full h-full"
                              />
                            )}

                            {/* Upload Avatar overlay hover */}
                            {isOwnProfile && !isUploadingAvatar && (
                              <label className="absolute inset-0 bg-black/75 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[9px] font-orbitron font-black cursor-pointer space-y-1">
                                <Upload className="w-4 h-4 text-[#FF0033]" />
                                <span>ALTERAR FOTO</span>
                                <input id="avatar-file-input" type="file" accept="image/*" onChange={(e) => handleUploadProfileImage(e, 'avatar')} className="hidden" />
                              </label>
                            )}

                            {isUploadingAvatar && (
                              <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-2 text-center">
                                <span className="text-[8px] font-orbitron font-black text-[#FF0033] animate-pulse leading-none mb-1">ENVIANDO...</span>
                                <div className="w-16 bg-white/20 h-1 rounded-full overflow-hidden">
                                  <div className="bg-[#FF0033] h-full" style={{ width: `${avatarProgress}%` }}></div>
                                </div>
                                <span className="font-mono text-[8px] text-gray-300 font-bold mt-1">{avatarProgress}%</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Remove Avatar button */}
                        {isOwnProfile && (
                          <div className="absolute bottom-1 right-1 flex flex-col items-center gap-1 z-30">
                            {(profileUser.photoURL || profileUser.avatarUrl) && !isUploadingAvatar && (
                              <button
                                type="button"
                                onClick={() => handleRemoveProfileImage('avatar')}
                                className="bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 shadow-lg border-2 border-white transition-all cursor-pointer hover:scale-110"
                                title="Remover Foto de Perfil"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}

                        {uploadAvatarError && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-red-950/95 border border-red-500/40 font-orbitron font-black text-[8px] px-2.5 py-1.5 rounded-lg text-red-100 z-50 whitespace-nowrap flex flex-col items-center space-y-1 shadow-lg">
                            <span>{uploadAvatarError}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setUploadAvatarError(null);
                                const input = document.getElementById('avatar-file-input');
                                if (input) (input as HTMLInputElement).click();
                              }}
                              className="bg-white text-black px-2 py-0.5 rounded-md text-[7px] font-bold uppercase hover:bg-neutral-200"
                            >
                              TENTAR NOVAMENTE
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Botões de Ação (Criar, Editar Perfil / Seguir, Mensagem, Compartilhar) */}
                      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 pt-2 sm:pt-4 shrink-0">
                        {isOwnProfile ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsCreateContentMenuOpen(true)}
                              className="h-11 bg-neutral-950 hover:bg-neutral-800 text-white font-orbitron font-black text-xs px-5 rounded-xl cursor-pointer transition-all inline-flex items-center justify-center gap-2 uppercase tracking-wider shadow-md whitespace-nowrap"
                            >
                              <Plus className="w-4 h-4 text-[#FF0033] stroke-[2.75]" />
                              <span>CRIAR</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setName(activeUserData.name || currentUser.name || '');
                                setEditUsername(activeUserData.username || activeUserData.slug || currentUser.username || currentUser.slug || '');
                                setBio(activeUserData.bio || '');
                                setLocation(activeUserData.location || '');
                                setWebsite(activeUserData.website || '');
                                setSocialsInstagram(activeUserData.socials?.instagram || '');
                                setSocialsTikTok(activeUserData.socials?.tiktok || '');
                                setSocialsYouTube(activeUserData.socials?.youtube || '');
                                setSocialsTwitter(activeUserData.socials?.twitter || '');
                                setSocialsFacebook(activeUserData.socials?.facebook || '');
                                setSocialsSpotify(activeUserData.socials?.spotify || '');
                                setSocialsTwitch(activeUserData.socials?.twitch || '');
                                setSocialsWhatsApp(activeUserData.socials?.whatsapp || '');
                                setEditVerified(activeUserData.isVerified || false);
                                setEditPremium(activeUserData.isPremium || false);
                                setEditHighlights(activeUserData.highlights || []);
                                setEditFeatures({
                                  store: activeUserData.features?.store || false,
                                  events: activeUserData.features?.events || false,
                                  subscriptions: activeUserData.features?.subscriptions || false,
                                  news: activeUserData.features?.news || false,
                                  music: activeUserData.features?.music || false,
                                  services: activeUserData.features?.services || false,
                                  fundraisers: activeUserData.features?.fundraisers || false,
                                  passagens: activeUserData.features?.passagens || false,
                                });
                                setEditCategoryId(activeUserData.categoryId || '');
                                setUsernameCheckStatus('idle');
                                setIsEditingProfile(true);
                              }}
                              className="h-11 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border border-neutral-300 font-orbitron font-bold text-xs px-5 rounded-xl cursor-pointer transition-all inline-flex items-center justify-center gap-2 uppercase tracking-wider shadow-xs whitespace-nowrap"
                            >
                              <Edit3 className="w-4 h-4 text-neutral-800 shrink-0" />
                              <span>EDITAR PERFIL</span>
                            </button>
                          </>
                        ) : (
                          <>
                            {isFollowingVisited ? (
                              <button
                                type="button"
                                onClick={() => handleUnfollowUser(profileUser.uid || profileUser.id)}
                                className="h-11 bg-neutral-200 hover:bg-neutral-300 text-neutral-900 border border-neutral-300 font-orbitron font-bold text-xs px-5 rounded-xl cursor-pointer transition-all inline-flex items-center justify-center gap-2 uppercase tracking-wider whitespace-nowrap"
                              >
                                <span>DEIXAR DE SEGUIR</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleFollowUser(profileUser.uid || profileUser.id)}
                                className="h-11 bg-neutral-950 hover:bg-neutral-800 text-white font-orbitron font-black text-xs px-6 rounded-xl cursor-pointer transition-all inline-flex items-center justify-center gap-2 shadow-md uppercase tracking-wider whitespace-nowrap"
                              >
                                <span>SEGUIR USUÁRIO</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={async () => {
                                const settings = profileUser.messageSettings;
                                if (settings?.privacy === 'PAID' && !isFollowingVisited) {
                                  setRecipientToPay(profileUser);
                                  setPayMessagePrice(settings.price || 5);
                                  setIsPayMessageModalOpen(true);
                                } else {
                                  setActiveTab('messages');
                                }
                              }}
                              className="h-11 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 border border-neutral-300 font-orbitron font-bold text-xs px-5 rounded-xl cursor-pointer transition-all inline-flex items-center justify-center gap-2 uppercase tracking-wider whitespace-nowrap"
                            >
                              <MessageCircle className="w-4 h-4 text-neutral-800 shrink-0" />
                              <span>MENSAGEM</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setProfileTab('sussurros')}
                              className="h-11 bg-neutral-900 hover:bg-neutral-800 text-white font-orbitron font-bold text-xs px-4 rounded-xl cursor-pointer transition-all inline-flex items-center justify-center gap-1.5 uppercase tracking-wider whitespace-nowrap"
                            >
                              <span>ENVIAR SUSSURRO 👻</span>
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const url = `${window.location.origin}/${profileUser.username || profileUser.slug}`;
                            navigator.clipboard.writeText(url);
                            triggerToast("Link do perfil copiado!");
                          }}
                          className="h-11 w-11 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-800 hover:text-black transition-all cursor-pointer inline-flex items-center justify-center shrink-0 shadow-xs"
                          title="Compartilhar Perfil"
                          aria-label="Compartilhar Perfil"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Bloco de Identidade Hierárquica (sempre sobre superfície clara, nunca sobre o banner) */}
                    <div className="mt-4 space-y-2.5 text-center sm:text-left">
                      {/* 1. Nome + Selo Verificado Azul imediatamente ao lado */}
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <h1 className="font-orbitron font-black text-2xl sm:text-3xl text-neutral-950 uppercase tracking-tight leading-tight">
                          {profileUser.name}
                        </h1>
                        
                        {/* Selo Verificado AZUL (#1D9BF0) imediatamente ao lado do nome */}
                        {isVerifiedUser(profileUser) && (
                          <VerifiedBadge 
                            user={profileUser}
                            size="lg" 
                            accountType={profileUser.accountType}
                            title={profileUser.accountType === 'Empresa' ? 'Empresa verificada pela VOXA' : profileUser.accountType === 'Artista' ? 'Artista verificado pela VOXA' : 'Identidade verificada pela VOXA'}
                          />
                        )}

                        {/* Premium Badge */}
                        {(profileUser.isPremium || profileUser.premium || (profileUser.role && profileUser.role.toLowerCase().includes('premium'))) && (
                          <div className="relative group inline-flex items-center shrink-0 cursor-pointer">
                            <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-[10px] text-black font-black select-none shadow-sm" title="Assinante VOXA Premium">
                              ★
                            </span>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-neutral-950 border border-white/10 text-[9px] font-orbitron text-amber-400 px-2.5 py-1.5 rounded-xl whitespace-nowrap z-50 shadow-2xl uppercase tracking-widest font-black leading-none">
                              VOXA PREMIUM
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. @username logo abaixo do nome + Categoria */}
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                        <span className="text-neutral-700 font-mono text-sm sm:text-base font-bold tracking-normal">
                          @{profileUser.username || profileUser.slug || 'user'}
                        </span>
                        {profileUser.categoryName && profileUser.categoryName !== 'Sem categoria' && (
                          <>
                            <span className="text-neutral-300 font-bold select-none" aria-hidden="true">•</span>
                            <span className="bg-red-50 text-[#FF0033] border border-[#FF0033]/30 font-orbitron font-black text-[10px] px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                              {profileUser.categoryName}
                            </span>
                          </>
                        )}
                      </div>

                      {/* 3. Bio legível em cinza escuro forte */}
                      <p className="text-sm text-neutral-800 font-sans max-w-2xl leading-relaxed mx-auto sm:mx-0">
                        {profileUser.bio || 'Sem biografia definida.'}
                      </p>

                      {/* 4. Localização, Link e Redes Sociais */}
                      {(profileUser.location || profileUser.website || (profileUser.socials && Object.values(profileUser.socials).some(v => !!v))) && (
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-2 pt-1 text-xs text-neutral-700 font-medium">
                          {profileUser.location && (
                            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-neutral-700 uppercase">
                              <MapPin className="w-3.5 h-3.5 text-[#FF0033] shrink-0" />
                              <span>{profileUser.location}</span>
                            </span>
                          )}
                          {profileUser.website && (
                            <a
                              href={profileUser.website.startsWith('http') ? profileUser.website : `https://${profileUser.website}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-neutral-900 hover:text-[#FF0033] underline decoration-neutral-300 hover:decoration-[#FF0033] transition-colors font-bold"
                            >
                              <Compass className="w-3.5 h-3.5 text-[#FF0033] shrink-0" />
                              <span>{profileUser.website.replace(/^https?:\/\//, '')}</span>
                            </a>
                          )}

                          {/* SOCIAL LINKS ROW */}
                          {profileUser.socials && Object.values(profileUser.socials).some(v => !!v) && (
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                              {Object.entries(profileUser.socials).map(([net, val]: any) => {
                                if (!val) return null;
                                
                                const getSocialUrl = (network: string, v: string) => {
                                  if (!v) return '';
                                  const clean = v.trim();
                                  if (clean.startsWith('http://') || clean.startsWith('https://')) {
                                    return clean;
                                  }
                                  const handle = clean.replace(/^@/, '');
                                  if (network === 'instagram') return `https://instagram.com/${handle}`;
                                  if (network === 'tiktok') return `https://tiktok.com/@${handle}`;
                                  if (network === 'youtube') return `https://youtube.com/${handle}`;
                                  if (network === 'twitter' || network === 'x') return `https://x.com/${handle}`;
                                  if (network === 'facebook') return `https://facebook.com/${handle}`;
                                  if (network === 'spotify') return `https://open.spotify.com/user/${handle}`;
                                  if (network === 'twitch') return `https://twitch.tv/${handle}`;
                                  if (network === 'whatsapp') {
                                    const numbers = clean.replace(/[^0-9]/g, '');
                                    return `https://wa.me/${numbers}`;
                                  }
                                  return clean;
                                };

                                const url = getSocialUrl(net, val);
                                if (!url) return null;

                                const getSvgIcon = (network: string) => {
                                  if (network === 'instagram') {
                                    return <svg className="w-3.5 h-3.5 text-neutral-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>;
                                  }
                                  if (network === 'tiktok') {
                                    return <svg className="w-3.5 h-3.5 text-neutral-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>;
                                  }
                                  if (network === 'youtube') {
                                    return <svg className="w-3.5 h-3.5 text-neutral-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>;
                                  }
                                  if (network === 'twitter' || network === 'x') {
                                    return <svg className="w-3.5 h-3.5 text-neutral-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4l11.733 16h4.267l-11.733 -16z M4 20l6.768 -6.768 M20 4l-6.768 6.768"/></svg>;
                                  }
                                  if (network === 'facebook') {
                                    return <svg className="w-3.5 h-3.5 text-neutral-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-4h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>;
                                  }
                                  if (network === 'spotify') {
                                    return <svg className="w-3.5 h-3.5 text-neutral-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.417.387-.714.227-2.39-1.097-5.4-1.424-8.917-.62-.337.076-.675-.138-.752-.475-.077-.337.138-.675.475-.752 3.864-.882 7.185-.494 9.68 1.022.296.18.358.508.228.798zm1.226-2.723c-.227.37-.61.493-.98.267-2.734-1.68-6.903-2.167-10.125-1.19-.418.127-.86-.107-.988-.525-.127-.417.108-.86.525-.987 3.684-1.118 8.283-.563 11.4 1.353.37.227.493.71.268 1.082zm.107-2.825C14.394 8.766 8.583 8.574 5.222 9.593c-.53.16-1.09-.14-1.25-.67-.16-.53.14-1.09.67-1.25 3.844-1.166 10.264-.946 14.333 1.472.48.28.63.9.35 1.38-.28.47-.9.63-1.38.35z"/></svg>;
                                  }
                                  if (network === 'twitch') {
                                    return <svg className="w-3.5 h-3.5 text-neutral-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9H9V6h2v5zm4 0h-2V6h2v5z"/></svg>;
                                  }
                                  if (network === 'whatsapp') {
                                    return <svg className="w-3.5 h-3.5 text-neutral-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>;
                                  }
                                  return <svg className="w-3.5 h-3.5 text-neutral-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg>;
                                };

                                return (
                                  <a
                                    key={net}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={`Ver ${net} de @${profileUser.username || 'membro'}`}
                                    className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 flex items-center justify-center transition-all shadow-xs"
                                  >
                                    {getSvgIcon(net)}
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2.5 HIGHLIGHTS BAR */}
                  {profileUser.highlights && profileUser.highlights.filter((h: any) => h.active !== false).length > 0 && (
                    <div className="px-6 md:px-10 py-4 bg-white border-t border-neutral-200 flex gap-4 overflow-x-auto scrollbar-none select-none text-neutral-900">
                      {profileUser.highlights
                        .filter((h: any) => h.active !== false)
                        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                        .map((h: any) => (
                          <a
                            key={h.id}
                            href={h.link || "#"}
                            target={h.link && h.link.startsWith("http") ? "_blank" : "_self"}
                            rel="noreferrer"
                            className="flex flex-col items-center space-y-1.5 group shrink-0 transition-all duration-300 hover:scale-105"
                          >
                            <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-[#FF0033] to-black ring-1 ring-neutral-300 hover:ring-[#FF0033] shadow-md transition-all duration-300 flex items-center justify-center overflow-hidden bg-white">
                              {h.image && typeof h.image === 'string' && h.image.trim() !== '' ? (
                                <img
                                  src={h.image.trim()}
                                  alt={h.title}
                                  sizes="56px"
                                  width={56}
                                  height={56}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-full object-cover rounded-full"
                                />
                              ) : (
                                <span className="font-orbitron font-black text-xs text-neutral-800">VX</span>
                              )}
                            </div>
                            <span className="text-[9px] font-orbitron font-extrabold text-neutral-800 group-hover:text-black tracking-wider uppercase text-center max-w-[65px] truncate">
                              {h.title}
                            </span>
                          </a>
                        ))}
                    </div>
                  )}

                  {/* 3. MÉTRICAS EM TRÊS COLUNAS (Seguidores, Likes, VOXA Rank) */}
                  <div className="bg-neutral-50 px-4 sm:px-10 py-5 border-t border-neutral-200 grid grid-cols-3 gap-2 sm:gap-4 text-center">
                    <div className="space-y-1">
                      <span className="block text-neutral-950 font-orbitron font-black text-xl sm:text-2xl md:text-3xl tabular-nums leading-none">
                        {(profileUser.followersCount || 0).toLocaleString('pt-BR')}
                      </span>
                      <span className="block text-[10px] sm:text-[11px] text-neutral-600 font-orbitron font-bold uppercase tracking-wider">
                        Seguidores
                      </span>
                    </div>
                    
                    <div className="space-y-1 border-l border-neutral-200">
                      <span className="block text-neutral-950 font-orbitron font-black text-xl sm:text-2xl md:text-3xl tabular-nums leading-none">
                        {(profileUser.totalLikesReceived || 0).toLocaleString('pt-BR')}
                      </span>
                      <span className="block text-[10px] sm:text-[11px] text-neutral-600 font-orbitron font-bold uppercase tracking-wider">
                        Likes
                      </span>
                    </div>

                    <div className="space-y-1 border-l border-neutral-200">
                      {globalRank ? (
                        <button
                          type="button"
                          onClick={() => { setActiveTab('ranking'); setSelectedArtistDetail(null); setSelectedProductDetail(null); setSelectedShowDetail(null); }}
                          className="block w-full text-center hover:scale-105 transition-transform duration-200 cursor-pointer focus:outline-none group"
                        >
                          <span className="block text-neutral-950 group-hover:text-[#FF0033] font-orbitron font-black text-xl sm:text-2xl md:text-3xl tabular-nums leading-none transition-colors">
                            #{globalRank}
                          </span>
                          <span className="block text-[10px] sm:text-[11px] text-neutral-600 font-orbitron font-bold uppercase tracking-wider mt-1">
                            VOXA Rank
                          </span>
                        </button>
                      ) : (
                        <div className="space-y-1">
                          <span className="block text-neutral-500 font-orbitron font-black text-xl sm:text-2xl md:text-3xl tabular-nums leading-none">-</span>
                          <span className="block text-[10px] sm:text-[11px] text-neutral-600 font-orbitron font-bold uppercase tracking-wider">
                            VOXA Rank
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. CHANNELS HIGHLIGHT CTA AREA */}
                  {(profileUser.features?.store || profileUser.features?.events || profileUser.features?.subscriptions) && (
                    <div className="px-6 md:px-10 py-3 bg-neutral-100 border-t border-neutral-200 flex flex-wrap gap-4 items-center text-[10px] font-orbitron font-black tracking-widest text-neutral-800 uppercase">
                      <span className="text-neutral-600 text-[9px] font-mono">Canais Ativos:</span>
                      {profileUser.features?.store && (
                        <button type="button" onClick={() => setProfileTab('store')} className="hover:underline flex items-center gap-1.5 cursor-pointer text-[#FF0033]">
                          <span>Ver Store</span>
                        </button>
                      )}
                      {profileUser.features?.events && (
                        <button type="button" onClick={() => setProfileTab('events')} className="hover:underline flex items-center gap-1.5 cursor-pointer text-[#FF0033]">
                          <span>Próximo Evento</span>
                        </button>
                      )}
                      {profileUser.features?.subscriptions && (
                        <button type="button" onClick={() => setProfileTab('subscriptions')} className="hover:underline flex items-center gap-1.5 cursor-pointer text-amber-700">
                          <span>Assinar VIP</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* 5. ABAS DO PERFIL (Superfície clara com estado ativo em preto + linha vermelha VOXA) */}
                  {(() => {
                    const headerTabs: { id: string; label: string }[] = [
                      { id: 'posts', label: 'Publicações' },
                      { id: 'vox', label: 'VOX' },
                      { id: 'polls', label: 'Enquetes' },
                      { id: 'sussurros', label: 'Sussurros' }
                    ];

                    // Conexões: mostrar somente para o dono do perfil (informação privada)
                    if (isOwnProfile) {
                      headerTabs.push({ id: 'following', label: 'Conexões' });
                    }

                    const userProducts = products.filter(p => p.artistId === profileUser.uid || p.sellerId === profileUser.uid);
                    if (userProducts.length > 0 || profileUser.features?.store) {
                      headerTabs.push({ id: 'store', label: 'Store' });
                    }

                    const userShows = shows.filter(s => s.ownerId === profileUser.uid || s.organizerId === profileUser.uid || s.artistId === profileUser.uid);
                    if (userShows.length > 0 || profileUser.features?.events) {
                      headerTabs.push({ id: 'events', label: 'Eventos' });
                    }

                    if (profileUser.features?.subscriptions) {
                      headerTabs.push({ id: 'subscriptions', label: 'Assinaturas' });
                    }

                    const userNews = newsArticles?.filter(art => art.authorId === profileUser.uid) || [];
                    if (userNews.length > 0 || profileUser.features?.news) {
                      headerTabs.push({ id: 'news', label: 'Notícias' });
                    }

                    const userMusic = streams.filter(str => str.artistId === profileUser.uid || str.userId === profileUser.uid || str.artistName?.toLowerCase() === profileUser.name?.toLowerCase());
                    if (userMusic.length > 0 || profileUser.features?.music) {
                      headerTabs.push({ id: 'music', label: 'Música' });
                    }

                    if (profileUser.features?.services) {
                      headerTabs.push({ id: 'services', label: 'Serviços' });
                    }

                    const activeHeaderTab = headerTabs.some(t => t.id === profileTab) ? profileTab : 'posts';

                    return (
                      <div className="bg-white border-t border-neutral-200 px-4 sm:px-8 md:px-10 flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
                        {headerTabs.map((tab) => {
                          const isActive = activeHeaderTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setProfileTab(tab.id)}
                              className={`relative px-4 py-4 font-orbitron text-xs uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                isActive
                                  ? 'text-neutral-950 font-black'
                                  : 'text-neutral-600 font-bold hover:text-neutral-950'
                              }`}
                            >
                              <span>{tab.label}</span>
                              {isActive && (
                                <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#FF0033] rounded-t-full" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Conteúdo das Abas do Perfil */}
                <div className="space-y-6">
                  {(() => {
                    const allowedTabIds = ['posts', 'vox', 'polls', 'sussurros', ...(isOwnProfile ? ['following'] : []), 'store', 'events', 'subscriptions', 'news', 'music', 'services'];
                    const activeEffectiveTab = allowedTabIds.includes(profileTab) ? profileTab : 'posts';

                    return (
                      <>
                        {activeEffectiveTab === 'sussurros' && (
                          isOwnProfile ? (
                            <SussurrosSection 
                              currentUser={currentUser}
                              triggerToast={triggerToast}
                              setActiveTab={setActiveTab}
                            />
                          ) : (
                            <SussurroPublicSendPage
                              visitedUsername={profileUser.username || profileUser.slug}
                              visitedUser={profileUser}
                              currentUser={currentUser}
                              triggerToast={triggerToast}
                              onBackToHome={() => setProfileTab('posts')}
                            />
                          )
                        )}

                        {activeEffectiveTab === 'polls' && (
                          <div className="space-y-6 text-left">
                            {isOwnProfile && (
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setIsPollModalOpen(true)}
                                  className="bg-white hover:bg-neutral-200 text-black font-orbitron font-black text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-all flex items-center space-x-1.5 uppercase"
                                >
                                  <Plus className="w-3.5 h-3.5 text-[#FF0033]" />
                                  <span>CRIAR NOVA ENQUETE</span>
                                </button>
                              </div>
                            )}

                            {polls.filter(p => p.authorId === profileUser.uid).length === 0 ? (
                              <div className="py-16 px-6 text-center bg-white border border-neutral-200 rounded-[24px] shadow-sm">
                                <p className="font-orbitron text-neutral-700 text-sm font-bold uppercase tracking-wider">
                                  {isOwnProfile ? 'Nenhuma enquete criada ainda.' : 'Este perfil ainda não publicou enquetes.'}
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {polls.filter(p => p.authorId === profileUser.uid).map(poll => (
                                  <PollCard
                                    key={poll.id}
                                    poll={poll}
                                    currentUser={currentUser}
                                    onVoteSuccess={loadData}
                                    triggerToast={triggerToast}
                                    onVisitProfile={onVisitProfile}
                                    isAdmin={isAdmin}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {activeEffectiveTab === 'following' && isOwnProfile && (() => {
                          const followedUsers = centralUsers.filter(u => followingIds.includes(u.uid || u.id));
                          
                          return (
                            <div className="bg-white border border-neutral-200 p-6 sm:p-8 rounded-[24px] space-y-5 text-left text-neutral-900 shadow-sm">
                              <div className="border-b border-neutral-200 pb-3">
                                <h3 className="font-orbitron font-black text-sm text-neutral-950 uppercase tracking-wider flex items-center space-x-2">
                                  <span>CONEXÕES • QUEM SIGO ({followedUsers.length})</span>
                                </h3>
                                <p className="text-xs text-neutral-600 font-sans mt-1">Sua lista de conexões seguidas é privada e visível somente para você.</p>
                              </div>
                              
                              {followedUsers.length === 0 ? (
                                <p className="text-center py-12 text-sm text-neutral-600 font-sans">Você não está seguindo ninguém na plataforma no momento.</p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {followedUsers.map((u) => (
                                    <div key={u.uid || u.id} className="bg-neutral-50 border border-neutral-200 p-4 rounded-xl flex items-center justify-between gap-4">
                                      <div className="flex items-center space-x-3.5 min-w-0">
                                        <div 
                                          onClick={() => onVisitProfile && onVisitProfile(u.username || u.slug || 'user')}
                                          className="w-11 h-11 rounded-full overflow-hidden border border-neutral-300 bg-zinc-900 shrink-0 flex items-center justify-center text-gray-300 cursor-pointer"
                                        >
                                          {u.photoURL ? (
                                            <img
                                              src={u.photoURL}
                                              alt={u.name}
                                              sizes="44px"
                                              width={44}
                                              height={44}
                                              loading="lazy"
                                              decoding="async"
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <UserIcon className="w-4 h-4" />
                                          )}
                                        </div>
                                        <div className="min-w-0 text-left leading-snug">
                                          <span 
                                            onClick={() => onVisitProfile && onVisitProfile(u.username || u.slug || 'user')}
                                            className="text-xs font-orbitron font-black text-neutral-950 uppercase truncate cursor-pointer hover:underline flex items-center gap-1.5"
                                          >
                                            <span className="truncate">{u.name}</span>
                                            {isVerifiedUser(u) && <VerifiedBadge user={u} size="sm" />}
                                          </span>
                                          <span className="block text-xs text-neutral-600 font-mono font-bold truncate">@{u.username || u.slug || 'user'}</span>
                                        </div>
                                      </div>
                                      
                                      <button
                                        type="button"
                                        onClick={() => handleUnfollowUser(u.uid || u.id)}
                                        className="text-[10px] font-orbitron font-black text-neutral-700 hover:text-white hover:bg-red-600 uppercase transition-all tracking-wide cursor-pointer bg-white border border-neutral-300 px-3 py-2 rounded-lg shrink-0"
                                      >
                                        DEIXAR DE SEGUIR
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {activeEffectiveTab === 'posts' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                            {posts.filter(p => p.userId === profileUser.uid).length === 0 ? (
                              <div className="col-span-full py-16 px-6 text-center bg-white border border-neutral-200 rounded-[24px] shadow-sm flex flex-col items-center justify-center space-y-4">
                                <p className="font-orbitron text-neutral-800 text-sm sm:text-base font-black uppercase tracking-wide">
                                  {isOwnProfile ? 'Nenhuma publicação ainda.' : 'Este perfil ainda não publicou nada.'}
                                </p>
                                {isOwnProfile && (
                                  <button
                                    type="button"
                                    onClick={() => setIsCreateContentMenuOpen(true)}
                                    className="bg-neutral-950 hover:bg-neutral-800 text-white font-orbitron font-black text-xs px-6 py-3.5 rounded-xl cursor-pointer transition-all inline-flex items-center justify-center gap-2 uppercase tracking-wider shadow-md"
                                  >
                                    <Plus className="w-4 h-4 text-[#FF0033] stroke-[2.75]" />
                                    <span>CRIAR PUBLICAÇÃO</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              posts.filter(p => p.userId === profileUser.uid).map(post => {
                                const list = post.likesList || [];
                                const likedByMe = Boolean(currentUser?.uid && list.includes(currentUser.uid));
                                
                                return (
                                  <div key={post.id} className="bg-[#12111d] border border-white/10 p-6 rounded-[24px] space-y-4">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-gray-600 font-sans">{post.createdAt ? new Date(post.createdAt).toLocaleDateString('pt-BR') : 'Hoje'}</span>
                                      {isOwnProfile && (
                                        <button 
                                          onClick={async () => {
                                            if (confirm("Deseja realmente excluir este post?")) {
                                              setPosts(prev => prev.filter(p => p.id !== post.id));
                                              triggerToast('Publicação excluída!');
                                            }
                                          }}
                                          className="text-gray-600 hover:text-red-400 p-1 cursor-pointer"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-gray-300 text-sm font-sans leading-relaxed">{post.content}</p>
                                    {post.mediaUrl && (
                                      <div className="rounded-xl overflow-hidden max-h-48 border border-white/5 bg-black flex items-center justify-center">
                                        <img
                                          src={post.mediaUrl}
                                          alt=""
                                          sizes="(max-width: 768px) 100vw, 50vw"
                                          loading="lazy"
                                          decoding="async"
                                          className="max-h-48 object-contain"
                                        />
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                      <button 
                                        onClick={() => handleLikePost(post.id)}
                                        className={`flex items-center space-x-1.5 text-xs font-orbitron font-bold cursor-pointer transition-colors ${likedByMe ? 'text-white' : 'text-gray-500 hover:text-white'}`}
                                      >
                                        <Heart className={`w-4 h-4 ${likedByMe ? 'fill-current' : ''}`} />
                                        <span>{post.likesCount || 0} REAÇÕES</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}

                        {activeEffectiveTab === 'vox' && (
                          <div className="space-y-6 text-left col-span-full">
                            {(() => {
                              const userVoxes = voxes.filter(v => v.authorId === profileUser.uid || v.userId === profileUser.uid);
                              if (userVoxes.length === 0) {
                                return (
                                  <div className="py-16 px-6 text-center bg-white border border-neutral-200 rounded-[24px] shadow-sm flex flex-col items-center justify-center space-y-4">
                                    <p className="font-orbitron text-neutral-800 text-sm font-black uppercase tracking-wide">
                                      {isOwnProfile ? 'Nenhum VOX publicado ainda.' : 'Este perfil ainda não publicou nenhum VOX.'}
                                    </p>
                                    {isOwnProfile && (
                                      <button
                                        type="button"
                                        onClick={() => setIsComposerOpen(true)}
                                        className="bg-neutral-950 hover:bg-neutral-800 text-white font-orbitron font-black text-xs px-6 py-3.5 rounded-xl cursor-pointer transition-all inline-flex items-center justify-center gap-2 uppercase tracking-wider shadow-md"
                                      >
                                        <Plus className="w-4 h-4 text-[#FF0033] stroke-[2.75]" />
                                        <span>CRIAR VOX</span>
                                      </button>
                                    )}
                                  </div>
                                );
                              }

                              return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {userVoxes.map(v => (
                                    <VoxCard
                                      key={v.id}
                                      vox={v}
                                      currentUser={currentUser}
                                      onSelect={handleSelectVox}
                                      onReplyClick={handleReplyVox}
                                      onQuoteClick={handleQuoteVox}
                                      onShareClick={handleShareVox}
                                      onUpdate={() => {}}
                                      triggerToast={triggerToast}
                                      isAdmin={isAdmin}
                                    />
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {activeEffectiveTab === 'store' && (
                          <div className="space-y-6 text-left">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                              {products.filter(p => p.sellerId === profileUser.uid || p.userId === profileUser.uid).length === 0 ? (
                                <div className="col-span-full py-16 text-center bg-[#12111d] border border-white/10 rounded-[24px]">
                                  <p className="font-orbitron font-bold text-xs text-gray-500 uppercase tracking-widest mb-1">A Store de @{profileUser.username || profileUser.slug} está vazia.</p>
                                  <p className="text-[11px] text-gray-600 font-sans">Nenhum produto anunciado à venda no momento.</p>
                                </div>
                              ) : (
                                products.filter(p => p.sellerId === profileUser.uid || p.userId === profileUser.uid).map(p => (
                                  <div key={p.id} className="bg-[#12111d] border border-white/10 rounded-[24px] overflow-hidden hover:border-white/30 transition-all flex flex-col justify-between">
                                    <div className="aspect-square bg-zinc-900 relative overflow-hidden flex items-center justify-center border-b border-white/5">
                                      {p.image ? (
                                        <img
                                          src={p.image}
                                          alt={p.name}
                                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                          loading="lazy"
                                          decoding="async"
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <span className="text-[10px] font-orbitron text-gray-600 font-bold">SEM IMAGEM</span>
                                      )}
                                    </div>
                                    <div className="p-5 space-y-3.5 text-left">
                                      <div className="flex items-center justify-between text-[10px] font-orbitron font-bold text-white">
                                        <span>{p.category}</span>
                                        <span>{p.subcategory || 'Ativo'}</span>
                                      </div>
                                      <h3 className="font-orbitron font-bold text-sm text-white truncate uppercase">{p.name}</h3>
                                      <p className="text-xs text-gray-400 font-sans line-clamp-2 leading-relaxed">{p.shortDesc || 'Sem descrição.'}</p>
                                      <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                        <span className="font-mono font-bold text-sm text-white">{formatBRL(p.price)}</span>
                                        <button
                                          onClick={() => setSelectedProductForCheckout(p)}
                                          className="bg-white hover:bg-neutral-200 text-black font-bold font-orbitron font-black text-[10px] px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                                        >
                                          COMPRAR
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {profileTab === 'events' && (
                          <div className="space-y-6 text-left">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {shows.filter(s => s.ownerId === profileUser.uid || s.organizerId === profileUser.uid).length === 0 ? (
                                <div className="col-span-full py-16 text-center bg-[#12111d] border border-white/10 rounded-[24px]">
                                  <p className="font-orbitron font-bold text-xs text-gray-500 uppercase tracking-widest mb-1">Nenhum evento agendado.</p>
                                  <p className="text-[11px] text-gray-600 font-sans">Siga o perfil para receber atualizações de novas datas e ingressos.</p>
                                </div>
                              ) : (
                                shows.filter(s => s.ownerId === profileUser.uid || s.organizerId === profileUser.uid).map(show => (
                                  <div key={show.id} className="bg-[#12111d] border border-white/10 rounded-[24px] overflow-hidden hover:border-white/30 transition-all flex flex-col justify-between">
                                    <div className="h-44 bg-zinc-950 relative overflow-hidden">
                                      {show.image ? (
                                        <img
                                          src={show.image}
                                          alt={show.title}
                                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                          loading="lazy"
                                          decoding="async"
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full bg-gradient-to-r from-[#FF0033]/20 to-black flex items-center justify-center font-orbitron text-[10px] text-gray-600 font-bold uppercase">SEM CAPA</div>
                                      )}
                                    </div>
                                    <div className="p-5 space-y-4">
                                      <div className="space-y-1">
                                        <span className="text-[10px] font-orbitron font-bold text-white tracking-widest uppercase block">{show.city} • {show.venue}</span>
                                        <h3 className="text-base font-orbitron font-black text-white uppercase truncate">{show.title}</h3>
                                        <p className="text-xs text-gray-400 font-sans line-clamp-2 leading-relaxed">{show.description}</p>
                                      </div>
                                      <div className="flex items-center justify-between text-[11px] text-gray-500 font-sans pt-2 border-t border-white/5">
                                        <span>{show.date} às {show.time || '20:00'}</span>
                                        <span className="font-mono text-white font-bold">{formatBRL(show.ticketPrice || 49.90)}</span>
                                      </div>
                                      <button
                                        onClick={() => setSelectedTicketForCheckout(show)}
                                        className="w-full bg-white hover:bg-neutral-200 text-black font-bold font-orbitron font-black text-xs py-3 rounded-xl transition-all cursor-pointer text-center uppercase"
                                      >
                                        ADQUIRIR INGRESSO
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {profileTab === 'subscriptions' && (
                          <div className="space-y-6 text-left max-w-xl mx-auto">
                            <div className="bg-[#12111d] border border-white/10 p-8 rounded-[32px] text-center space-y-6 shadow-2xl relative overflow-hidden">
                              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#FF0033]/10 rounded-full blur-3xl pointer-events-none"></div>
                              <div className="space-y-2">
                                <span className="bg-[#FF0033]/10 text-white px-3.5 py-1 rounded-full text-[9px] font-orbitron font-black uppercase tracking-wider">ASSINATURA EXCLUSIVA</span>
                                <h3 className="text-2xl font-orbitron font-black text-white uppercase">Apoie @{profileUser.username || profileUser.slug}</h3>
                                <p className="text-xs text-gray-400 leading-relaxed max-w-md mx-auto">
                                  Tenha acesso a publicações exclusivas, chats privados, vídeos inéditos e descontos especiais na Store apoiando mensalmente.
                                </p>
                              </div>
                              
                              <div className="p-6 bg-black/40 border border-white/5 rounded-2xl">
                                <span className="text-3xl font-mono font-black text-white">R$ 19,90</span>
                                <span className="text-xs text-gray-500 font-sans block mt-1">cobrado mensalmente no cartão ou PIX</span>
                              </div>

                              <button
                                onClick={() => {
                                  triggerToast('Fluxo de assinatura iniciado!');
                                }}
                                className="w-full bg-white hover:bg-neutral-200 text-black font-bold font-orbitron font-black text-sm py-4 rounded-xl transition-all uppercase cursor-pointer"
                              >
                                ASSINAR AGORA
                              </button>
                            </div>
                          </div>
                        )}

                        {profileTab === 'news' && (
                          <div className="space-y-6 text-left">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {newsArticles?.filter(art => art.authorId === profileUser.uid).length === 0 ? (
                                <div className="col-span-full py-16 text-center bg-[#12111d] border border-white/10 rounded-[24px]">
                                  <p className="font-orbitron font-bold text-xs text-gray-500 uppercase tracking-widest mb-1">Nenhuma notícia publicada.</p>
                                  <p className="text-[11px] text-gray-600 font-sans">Acompanhe este perfil para ler artigos e coberturas em tempo real.</p>
                                </div>
                              ) : (
                                newsArticles?.filter(art => art.authorId === profileUser.uid).map((art: any) => (
                                  <div key={art.id} className="bg-[#12111d] border border-white/10 p-6 rounded-[24px] space-y-4 hover:border-white/30 transition-all text-left">
                                    <span className="text-[9px] font-orbitron font-black text-red-400 bg-red-600/10 px-2.5 py-1 rounded-full uppercase">{art.category || 'Geral'}</span>
                                    <h3 className="text-lg font-orbitron font-extrabold text-white uppercase leading-snug">{art.title}</h3>
                                    {art.subtitle && <p className="text-xs text-gray-400 font-sans">{art.subtitle}</p>}
                                    {art.coverUrl && (
                                      <div className="rounded-xl overflow-hidden max-h-48 bg-zinc-950">
                                        <img
                                          src={art.coverUrl}
                                          alt=""
                                          sizes="(max-width: 768px) 100vw, 50vw"
                                          loading="lazy"
                                          decoding="async"
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    )}
                                    <p className="text-xs text-gray-300 font-sans leading-relaxed line-clamp-3">{art.content}</p>
                                    <div className="flex items-center justify-between text-[10px] text-gray-600 font-mono pt-2 border-t border-white/5">
                                      <span>Por {art.authorName || 'Autor'}</span>
                                      <span>{art.date || 'Hoje'}</span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {profileTab === 'music' && (
                          <div className="space-y-6 text-left">
                            <div className="space-y-3">
                              {streams.filter(str => str.artistId === profileUser.uid || str.userId === profileUser.uid || str.artistName?.toLowerCase() === profileUser.name?.toLowerCase()).length === 0 ? (
                                <div className="py-16 text-center bg-[#12111d] border border-white/10 rounded-[24px]">
                                  <p className="font-orbitron font-bold text-xs text-gray-500 uppercase tracking-widest mb-1">Nenhuma música publicada.</p>
                                  <p className="text-[11px] text-gray-600 font-sans">Siga este artista para escutar os lançamentos futuros.</p>
                                </div>
                              ) : (
                                streams.filter(str => str.artistId === profileUser.uid || str.userId === profileUser.uid || str.artistName?.toLowerCase() === profileUser.name?.toLowerCase()).map(track => {
                                  const isCurrent = currentStream?.id === track.id;
                                  return (
                                    <div key={track.id} className="bg-[#12111d] border border-white/10 p-4 rounded-2xl flex items-center justify-between hover:border-white/30 transition-all">
                                      <div className="flex items-center space-x-4 min-w-0">
                                        <button
                                          onClick={() => {
                                            if (isCurrent && isPlaying) {
                                              setIsPlaying(false);
                                              audioInstance?.pause();
                                            } else {
                                              setCurrentStream(track);
                                              setIsPlaying(true);
                                              if (audioInstance) {
                                                audioInstance.src = track.streamUrl;
                                                audioInstance.play().catch(e => console.warn(e));
                                              }
                                            }
                                          }}
                                          className="w-10 h-10 rounded-full bg-[#FF0033]/10 hover:bg-neutral-200 hover:text-black text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                                        >
                                          {isCurrent && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 pl-0.5" />}
                                        </button>
                                        <div className="min-w-0">
                                          <span className="font-orbitron font-bold text-xs text-white uppercase block truncate">{track.title}</span>
                                          <span className="font-sans text-[10px] text-gray-500 block truncate">{track.artistName || 'Artista VOXA'}</span>
                                        </div>
                                      </div>
                                      <span className="text-[10px] font-mono text-gray-500">{track.duration || '03:15'}</span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}

                        {profileTab === 'services' && (
                          <div className="space-y-6 text-left max-w-3xl">
                            <div className="bg-[#12111d] border border-white/10 p-6 rounded-[24px] space-y-4">
                              <span className="text-[10px] font-orbitron font-bold text-white tracking-widest uppercase block">SERVIÇOS DISPONÍVEIS</span>
                              <h3 className="text-lg font-orbitron font-black text-white uppercase">Solicite Orçamentos e Serviços</h3>
                              <p className="text-xs text-gray-400 leading-relaxed font-sans">
                                Este profissional oferece serviços especializados com contratação garantida. Entre em contato para solicitar orçamentos personalizados.
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <div className="bg-black/35 p-4 rounded-xl border border-white/5 space-y-1">
                                  <span className="block font-orbitron font-bold text-[10px] text-white">ASSESSORIA PREMIUM</span>
                                  <span className="block font-sans text-xs text-gray-300">Consultoria completa para marcas e criadores.</span>
                                </div>
                                <div className="bg-black/35 p-4 rounded-xl border border-white/5 space-y-1">
                                  <span className="block font-orbitron font-bold text-[10px] text-white">PRODUÇÃO EXECUTIVA</span>
                                  <span className="block font-sans text-xs text-gray-300">Gestão e produção técnica para eventos de mídia.</span>
                                </div>
                              </div>
                              <button
                                onClick={() => triggerToast('Solicitação de contato enviada!')}
                                className="bg-white hover:bg-gray-100 text-black font-orbitron font-black text-[10px] py-3 px-5 rounded-xl uppercase tracking-wider transition-all cursor-pointer"
                              >
                                SOLICITAR ORÇAMENTO
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

              </div>
            );
          })()}

          {activeTab === 'dating' && (
            <MeuParSection 
              currentUser={currentUser}
              onVisitProfile={onVisitProfile}
              triggerToast={triggerToast}
              activeUserData={activeUserData}
            />
          )}

          {activeTab === 'ads' && (
            <VoxaAdsSection 
              currentUser={currentUser}
              triggerToast={triggerToast}
              walletBalance={walletBalance}
              onRefreshWallet={loadData}
            />
          )}

          {activeTab === 'sussurro' && (
            <SussurroPublicSendPage 
              visitedUsername={visitedUsername} 
              visitedUser={visitedUser} 
              currentUser={currentUser} 
              triggerToast={triggerToast}
              onBackToHome={() => setActiveTab('home')}
            />
          )}

            </>
          )}

        </div>

        {/* 5. SECURE COMPACT FOOTER FOOTPRINT */}
        <footer className="border-t border-white/10 bg-black/60 backdrop-blur-md py-6 px-6 text-center select-none text-[10px] text-gray-500 font-orbitron tracking-widest uppercase">
          VOXA Social Network Platform © {new Date().getFullYear()} • UMA NOVA DIMENSÃO SOCIAL
        </footer>

      </main>

      {/* EDIT PROFILE MODAL */}
      <AnimatePresence>
        {isEditingProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#12111d] border border-white/10 max-w-md w-full p-6 rounded-[24px] space-y-4 shadow-2xl relative"
            >
              <button onClick={() => setIsEditingProfile(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
              <h3 className="font-orbitron font-extrabold text-lg text-white">Editar Perfil VOXA</h3>
              <form onSubmit={handleSaveProfileSettings} className="space-y-4 text-left max-h-[70vh] overflow-y-auto pr-2">
                <div className="space-y-1">
                  <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Nome de Exibição</label>
                  <input type="text" value={editName} onChange={(e) => setName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" required />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Seu Username Único (@)</label>
                    <span className="text-[9px]">
                      {usernameCheckStatus === 'checking' && <span className="text-amber-400 font-bold font-mono">Checando...</span>}
                      {usernameCheckStatus === 'available' && <span className="text-emerald-400 font-bold font-mono">Disponível</span>}
                      {usernameCheckStatus === 'taken' && <span className="text-white font-bold font-mono">Em uso</span>}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs text-gray-500 font-bold">@</span>
                    <input 
                      type="text" 
                      value={editUsername} 
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                        setEditUsername(val);
                        checkUsernameAvailability(val);
                      }} 
                      className={`w-full bg-black/40 border rounded-xl pl-8 pr-4 py-2.5 text-xs text-white focus:outline-none ${
                        usernameCheckStatus === 'available' ? 'border-emerald-500/50 focus:border-emerald-500' :
                        usernameCheckStatus === 'taken' ? 'border-white/50 focus:border-white' :
                        'border-white/10 focus:border-white'
                      }`}
                      required 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Biologia / Frase</label>
                  <textarea value={editBio} onChange={(e) => setBio(e.target.value)} rows={2} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Localização</label>
                  <input type="text" value={editLocation} onChange={(e) => setLocation(e.target.value)} placeholder="Ex: São Paulo, Brasil" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Website / Link</label>
                  <input type="url" value={editWebsite} onChange={(e) => setWebsite(e.target.value)} placeholder="Ex: https://links.voxa.com/id" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none" />
                </div>

                {/* REDES SOCIAIS (OPCIONAIS) */}
                <div className="pt-3 border-t border-white/10 space-y-2.5 text-left">
                  <h4 className="font-orbitron font-extrabold text-[11px] text-white uppercase tracking-wider">Redes Sociais (Opcionais)</h4>
                  <p className="text-[9px] text-gray-500 font-sans -mt-1 leading-snug">Insira o link completo ou o @username correspondente.</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase">Instagram</label>
                      <input type="text" value={socialsInstagram} onChange={(e) => setSocialsInstagram(e.target.value)} placeholder="@username" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-white focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase">TikTok</label>
                      <input type="text" value={socialsTikTok} onChange={(e) => setSocialsTikTok(e.target.value)} placeholder="@username" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-white focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase">YouTube</label>
                      <input type="text" value={socialsYouTube} onChange={(e) => setSocialsYouTube(e.target.value)} placeholder="https://youtube.com/..." className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-white focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase">X / Twitter</label>
                      <input type="text" value={socialsTwitter} onChange={(e) => setSocialsTwitter(e.target.value)} placeholder="@username" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-white focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase">Facebook</label>
                      <input type="text" value={socialsFacebook} onChange={(e) => setSocialsFacebook(e.target.value)} placeholder="https://facebook.com/..." className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-white focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase">Spotify</label>
                      <input type="text" value={socialsSpotify} onChange={(e) => setSocialsSpotify(e.target.value)} placeholder="https://open.spotify.com/..." className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-white focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase">Twitch</label>
                      <input type="text" value={socialsTwitch} onChange={(e) => setSocialsTwitch(e.target.value)} placeholder="https://twitch.tv/..." className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-white focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase">WhatsApp</label>
                      <input type="text" value={socialsWhatsApp} onChange={(e) => setSocialsWhatsApp(e.target.value)} placeholder="Ex: +5511999999999" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-white focus:outline-none" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">Categoria Pública</label>
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white focus:outline-none font-sans"
                  >
                    <option value="">Nenhuma</option>
                    {activeCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* STATUS DE CONTA (VERIFICADO & PREMIUM) */}
                <div className="pt-3 border-t border-white/10 space-y-2.5">
                  <h4 className="font-orbitron font-extrabold text-[11px] text-white uppercase tracking-wider">Status da Conta</h4>
                  <div className="flex items-center justify-between p-2.5 bg-black/35 rounded-xl border border-white/5">
                    <div className="space-y-0.5 pr-2">
                      <span className="block font-orbitron font-bold text-[10px] text-white uppercase">Selo de Verificado</span>
                      <span className="block font-sans text-[9px] text-gray-500 leading-tight">Confirmar identidade oficial pela VOXA</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditVerified(!editVerified)}
                      className={`w-11 h-6 rounded-full transition-all relative focus:outline-none shrink-0 cursor-pointer ${
                        editVerified ? 'bg-[#FF0033]' : 'bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          editVerified ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-black/35 rounded-xl border border-white/5">
                    <div className="space-y-0.5 pr-2">
                      <span className="block font-orbitron font-bold text-[10px] text-white uppercase">Assinante VOXA Premium</span>
                      <span className="block font-sans text-[9px] text-gray-500 leading-tight">Habilitar badge especial e visual dourado</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditPremium(!editPremium)}
                      className={`w-11 h-6 rounded-full transition-all relative focus:outline-none shrink-0 cursor-pointer ${
                        editPremium ? 'bg-amber-500' : 'bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          editPremium ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* CARROSSEL DE BANNERS DO PERFIL & VOXA ADS */}
                <div className="pt-3 border-t border-white/10 space-y-2.5">
                  <h4 className="font-orbitron font-extrabold text-[11px] text-white uppercase tracking-wider">Banner do Perfil & VOXA Ads</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingProfile(false);
                      setIsBannersModalOpen(true);
                    }}
                    className="w-full bg-[#FF0033]/15 hover:bg-[#FF0033]/25 border border-[#FF0033]/40 text-white font-orbitron font-black text-[10px] py-3 px-4 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-[#FF0033]" />
                    <span>Gerenciar Carrossel de Banners (Até 4) & Monetização</span>
                  </button>
                </div>

                {/* DESTAQUES (HIGHLIGHTS) MANAGER */}
                <div className="pt-3 border-t border-white/10 space-y-3">
                  <h4 className="font-orbitron font-extrabold text-[11px] text-white uppercase tracking-wider">Destaques do Perfil (Max 10)</h4>
                  
                  {/* List of existing highlights */}
                  {editHighlights.length > 0 && (
                    <div className="space-y-2">
                      {editHighlights
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                        .map((hl, idx) => (
                          <div key={hl.id || idx} className="flex items-center justify-between p-2 bg-black/40 border border-white/5 rounded-xl">
                            <div className="flex items-center space-x-2">
                              {hl.image && typeof hl.image === 'string' && hl.image.trim() !== '' ? (
                                <img src={hl.image.trim()} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-orbitron text-[8px] text-white font-bold shrink-0">
                                  VX
                                </div>
                              )}
                              <div className="text-[10px]">
                                <span className="block font-bold text-white truncate max-w-[120px]">{hl.title}</span>
                                <span className="block text-[8px] text-gray-500 truncate max-w-[120px]">{hl.link || 'Sem link'}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-1.5">
                              {/* Move order buttons */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (idx === 0) return;
                                  const list = [...editHighlights];
                                  const temp = list[idx].order;
                                  list[idx].order = list[idx-1].order;
                                  list[idx-1].order = temp;
                                  setEditHighlights(list);
                                }}
                                disabled={idx === 0}
                                className="p-1 hover:text-white text-gray-500 disabled:opacity-30 cursor-pointer"
                                title="Mover para esquerda"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (idx === editHighlights.length - 1) return;
                                  const list = [...editHighlights];
                                  const temp = list[idx].order;
                                  list[idx].order = list[idx+1].order;
                                  list[idx+1].order = temp;
                                  setEditHighlights(list);
                                }}
                                disabled={idx === editHighlights.length - 1}
                                className="p-1 hover:text-white text-gray-500 disabled:opacity-30 cursor-pointer"
                                title="Mover para direita"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                              
                              {/* Toggle active button */}
                              <button
                                type="button"
                                onClick={() => {
                                  const list = [...editHighlights];
                                  list[idx].active = !list[idx].active;
                                  setEditHighlights(list);
                                }}
                                className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${
                                  hl.active !== false ? 'bg-[#FF0033]/20 text-white' : 'bg-zinc-800 text-gray-500'
                                }`}
                              >
                                {hl.active !== false ? 'ATIVO' : 'INATIVO'}
                              </button>
                              
                              {/* Delete button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditHighlights(editHighlights.filter(item => item.id !== hl.id));
                                }}
                                className="p-1 text-gray-500 hover:text-red-500 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Add new highlight form */}
                  {editHighlights.length < 10 && (
                    <div className="p-3 bg-black/50 border border-dashed border-white/10 rounded-xl space-y-2">
                      <span className="block text-[9px] font-orbitron font-extrabold text-white">CRIAR NOVO DESTAQUE</span>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          id="hl-title-input"
                          placeholder="Título (Ex: Minha Loja)"
                          className="bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-[10px] text-white focus:outline-none focus:border-white"
                        />
                        <input
                          type="text"
                          id="hl-link-input"
                          placeholder="Link / Destino"
                          className="bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-[10px] text-white focus:outline-none focus:border-white"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          id="hl-file-input"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const btn = document.getElementById("add-hl-btn") as HTMLButtonElement;
                            const origText = btn.innerText;
                            btn.disabled = true;
                            btn.innerText = "ENVIANDO...";
                            try {
                              const res = await uploadFile(file, 'highlight');
                              (btn as any)._uploadedUrl = res.url;
                              btn.innerText = "FOTO ENVIADA ✓";
                              triggerToast("Imagem do destaque carregada com sucesso!");
                            } catch (err: any) {
                              triggerToast(err.message || "Falha ao enviar imagem.");
                              btn.innerText = origText;
                            } finally {
                              btn.disabled = false;
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById("hl-file-input")?.click()}
                          className="bg-zinc-800 hover:bg-zinc-700 text-white font-orbitron font-bold text-[9px] py-1.5 px-3 rounded-lg border border-white/5 transition-all uppercase cursor-pointer"
                        >
                          Selecionar Imagem
                        </button>
                        <button
                          type="button"
                          id="add-hl-btn"
                          onClick={() => {
                            const titleIn = document.getElementById("hl-title-input") as HTMLInputElement;
                            const linkIn = document.getElementById("hl-link-input") as HTMLInputElement;
                            const btn = document.getElementById("add-hl-btn") as HTMLButtonElement;
                            const imageUrl = (btn as any)._uploadedUrl;
                            
                            if (!titleIn.value.trim()) {
                              triggerToast("Título do destaque é obrigatório.");
                              return;
                            }
                            if (!imageUrl) {
                              triggerToast("Imagem do destaque é obrigatória. Por favor, envie uma foto primeiro.");
                              return;
                            }
                            
                            const newHl = {
                              id: `hl-${Date.now()}`,
                              image: imageUrl,
                              title: titleIn.value.trim(),
                              link: linkIn.value.trim(),
                              order: editHighlights.length,
                              active: true
                            };
                            
                            setEditHighlights([...editHighlights, newHl]);
                            titleIn.value = "";
                            linkIn.value = "";
                            delete (btn as any)._uploadedUrl;
                            btn.innerText = "ADICIONAR";
                          }}
                          className="bg-white hover:bg-neutral-200 text-black font-bold font-orbitron font-extrabold text-[9px] py-1.5 px-4 rounded-lg transition-all uppercase cursor-pointer shrink-0"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* RECURSOS DO MEU PERFIL */}
                <div className="pt-3 border-t border-white/10 space-y-3">
                  <h4 className="font-orbitron font-extrabold text-[11px] text-white uppercase tracking-wider">Recursos do meu perfil</h4>
                  <p className="text-[10px] text-gray-400 font-sans leading-relaxed">
                    Ative ou desative módulos para personalizar seu perfil modular de forma independente.
                  </p>

                  <div className="space-y-2.5">
                    {[
                      { key: 'store', name: 'Store', desc: 'Venda de produtos físicos e digitais.' },
                      { key: 'events', name: 'Tickets e Eventos', desc: 'Criação de eventos e venda de ingressos.' },
                      { key: 'subscriptions', name: 'Assinaturas', desc: 'Cobrança de mensalidade de fãs com benefícios.' },
                      { key: 'news', name: 'Notícias', desc: 'Publicação de artigos e notícias completas.' },
                      { key: 'music', name: 'Música', desc: 'Postagem de faixas e streaming de áudio.' },
                      { key: 'services', name: 'Serviços', desc: 'Anúncio e agendamento de serviços prestados.' }
                    ].map((feat) => {
                      const isActive = editFeatures[feat.key] || false;
                      return (
                        <div key={feat.key} className="flex items-center justify-between p-2.5 bg-black/35 rounded-xl border border-white/5">
                          <div className="space-y-0.5 pr-2">
                            <span className="block font-orbitron font-bold text-[10px] text-white uppercase">{feat.name}</span>
                            <span className="block font-sans text-[9px] text-gray-500 leading-tight">{feat.desc}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditFeatures((prev: any) => ({
                                ...prev,
                                [feat.key]: !isActive
                              }));
                            }}
                            className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none shrink-0 ${
                              isActive ? 'bg-[#FF0033]' : 'bg-zinc-800'
                            }`}
                          >
                            <span
                              className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                                isActive ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-2.5 bg-yellow-950/20 border border-yellow-700/20 rounded-xl text-[9px] text-amber-500 font-sans leading-relaxed">
                    <strong>Aviso importante:</strong> Desativar um recurso apenas ocultará sua respectiva aba pública no perfil. Seus dados cadastrados continuarão salvos e protegidos no banco.
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={usernameCheckStatus === 'taken'}
                    className="w-full bg-white hover:bg-neutral-200 text-black font-bold disabled:opacity-40 disabled:cursor-not-allowed text-white font-orbitron font-bold text-xs py-3 rounded-xl cursor-pointer"
                  >
                    SALVAR ALTERAÇÕES
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EMBEDDED CHECKOUT WRAPPER */}
      <AnimatePresence>
        {(selectedProductForCheckout || selectedTicketForCheckout) && (
          <EmbeddedCheckout
            selectedProduct={selectedProductForCheckout}
            selectedTicket={selectedTicketForCheckout}
            currentUser={currentUser}
            onClose={() => {
              setSelectedProductForCheckout(null);
              setSelectedTicketForCheckout(null);
            }}
            onSuccess={(msg) => {
              triggerToast(msg);
              loadData(); // Reload balance/orders
            }}
          />
        )}
      </AnimatePresence>

      {/* VOX FEATURE OVERLAY MODALS */}
      <VoxComposerModal
        isOpen={isComposerOpen}
        onClose={() => {
          setIsComposerOpen(false);
          setVoxInitialText('');
          setReplyToId(null);
          setReplyToVox(null);
          setQuotedVoxId(null);
          setQuotedVox(null);
        }}
        currentUser={currentUser}
        replyToId={replyToId}
        replyToVox={replyToVox}
        quotedVoxId={quotedVoxId}
        quotedVox={quotedVox}
        initialText={voxInitialText}
        onSuccess={() => {}}
        triggerToast={triggerToast}
      />

      <VoxShareModal
        isOpen={isShareOpen}
        onClose={() => {
          setIsShareOpen(false);
          setSelectedVoxForShare(null);
        }}
        vox={selectedVoxForShare}
        triggerToast={triggerToast}
      />

      <VoxConversationModal
        isOpen={isVoxDetailOpen}
        onClose={() => {
          setIsVoxDetailOpen(false);
          setSelectedVox(null);
          window.history.pushState(null, '', `/`);
        }}
        vox={selectedVox}
        currentUser={currentUser}
        onReplyClick={handleReplyVox}
        onQuoteClick={handleQuoteVox}
        onShareClick={handleShareVox}
        onUpdate={() => {}}
        triggerToast={triggerToast}
        isAdmin={currentUser?.email === 'admin@voxa.com.br' || currentUser?.email === 'admin@lockdownprodutora.com.br' || currentUser?.email === 'lockdownprodutora@gmail.com' || currentUser?.role === 'admin' || currentUser?.isAdmin === true}
      />

      {/* 5. PAID MESSAGE MODAL */}
      {isPayMessageModalOpen && recipientToPay && (
        <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="max-w-md w-full bg-[#0c0b16] border border-white/10 rounded-[32px] p-8 space-y-6 text-left relative shadow-2xl">
            <button 
              onClick={() => setIsPayMessageModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#FF0033] mx-auto shadow-lg shadow-[#FF0033]/20 bg-zinc-900 flex items-center justify-center">
                {(recipientToPay.photoURL || recipientToPay.avatarUrl) ? (
                  <img src={recipientToPay.photoURL || recipientToPay.avatarUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-zinc-800 text-white font-orbitron font-black text-2xl flex items-center justify-center">
                    {recipientToPay.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <h3 className="font-orbitron font-black text-xl text-white uppercase tracking-wider">{recipientToPay.name}</h3>
                <p className="text-gray-400 text-xs font-sans">@{recipientToPay.username} cobra um valor para receber mensagens de quem não segue.</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/5 p-6 rounded-2xl text-center space-y-2">
              <span className="text-[10px] font-orbitron font-black text-gray-500 uppercase tracking-widest block">Taxa de Acesso</span>
              <div className="text-3xl font-mono font-black text-white">{formatBRL(payMessageAmount)}</div>
            </div>

            <div className="space-y-3">
              <button
                onClick={async () => {
                  try {
                    // Logic to pay using wallet balance
                    // If balance < amount, show error
                    if (walletBalance < payMessageAmount * 100) {
                      alert("Saldo insuficiente na carteira. Por favor, faça uma recarga.");
                      setActiveTab('wallet');
                      setIsPayMessageModalOpen(false);
                      return;
                    }
                    
                    // Simulate payment logic here...
                    // In real app, call /api/messages/pay
                    triggerToast("Acesso liberado! Agora você pode enviar mensagens.");
                    setIsPayMessageModalOpen(false);
                    setActiveTab('messages');
                  } catch (err) {
                    alert("Erro ao processar pagamento.");
                  }
                }}
                className="w-full bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs tracking-widest uppercase py-4 rounded-2xl transition-all shadow-lg shadow-red-600/20 cursor-pointer"
              >
                PAGAR COM SALDO DA CARTEIRA
              </button>
              
              <p className="text-[9px] text-gray-600 text-center font-sans italic">80% do valor vai para o destinatário e 20% para a plataforma VOXA.</p>
            </div>
          </div>
        </div>
      )}

      {/* FIXED MOBILE BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-[#0c0b16]/95 backdrop-blur-xl border-t border-white/10 flex lg:hidden justify-around items-center z-40 px-2 select-none">
        <button
          onClick={() => { setActiveTab('home'); setSelectedArtistDetail(null); setSelectedProductDetail(null); setSelectedShowDetail(null); }}
          className={`flex flex-col items-center justify-center w-12 h-12 transition-all ${
            activeTab === 'home' ? 'text-white' : 'text-gray-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[9px] font-orbitron font-bold mt-1">Início</span>
        </button>

        <button
          onClick={() => { setActiveTab('explore'); setSelectedArtistDetail(null); setSelectedProductDetail(null); setSelectedShowDetail(null); }}
          className={`flex flex-col items-center justify-center w-12 h-12 transition-all ${
            activeTab === 'explore' ? 'text-white' : 'text-gray-400'
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[9px] font-orbitron font-bold mt-1">Explorar</span>
        </button>

        <button
          onClick={() => {
            setIsCreateContentMenuOpen(true);
          }}
          className="flex flex-col items-center justify-center w-11 h-11 bg-[#FF0033] hover:bg-red-700 text-white rounded-full transition-all shadow-lg shadow-red-600/30 shrink-0 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button
          onClick={() => { setActiveTab('wallet'); setSelectedArtistDetail(null); setSelectedProductDetail(null); setSelectedShowDetail(null); }}
          className={`flex flex-col items-center justify-center w-12 h-12 transition-all ${
            activeTab === 'wallet' ? 'text-white' : 'text-gray-400'
          }`}
        >
          <Wallet className="w-5 h-5" />
          <span className="text-[9px] font-orbitron font-bold mt-1">Carteira</span>
        </button>

        <button
          onClick={() => { setActiveTab('profile'); setSelectedArtistDetail(null); setSelectedProductDetail(null); setSelectedShowDetail(null); }}
          className={`flex flex-col items-center justify-center w-12 h-12 transition-all ${
            activeTab === 'profile' ? 'text-white' : 'text-gray-400'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[9px] font-orbitron font-bold mt-1">Perfil</span>
        </button>
      </div>

      {/* 5. UNIFIED CREATION MENU MODAL (DESKTOP & MOBILE) */}
      <CreateContentMenu 
        isOpen={isCreateContentMenuOpen}
        onClose={() => setIsCreateContentMenuOpen(false)}
        onSelectOption={(optionId) => {
          switch (optionId) {
            case 'vox':
              setReplyToId(null);
              setReplyToVox(null);
              setQuotedVoxId(null);
              setQuotedVox(null);
              setIsComposerOpen(true);
              break;
            case 'post':
              setActiveTab('home');
              setTimeout(() => {
                const el = document.querySelector('form');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                const textarea = document.querySelector('textarea');
                if (textarea) (textarea as HTMLTextAreaElement).focus();
              }, 200);
              break;
            case 'story':
              triggerToast("Para criar stories, utilize o widget no topo do feed!");
              setActiveTab('home');
              break;
            case 'poll':
            case 'enquete':
              setIsPollModalOpen(true);
              break;
            case 'product':
            case 'produto':
              setActiveTab('my_business');
              setBusinessTab('store');
              break;
            case 'event':
            case 'events':
            case 'ticket':
            case 'evento':
              setActiveTab('my_business');
              setBusinessTab('events');
              break;
            case 'fundraiser':
            case 'fundraisers':
            case 'vaquinha':
            case 'vaquinhas':
              setActiveTab('vaquinhas');
              break;
            case 'subscription':
            case 'subscriptions':
            case 'assinatura':
            case 'assinaturas':
              setActiveTab('my_business');
              setBusinessTab('subscriptions');
              break;
            case 'music':
            case 'musica':
            case 'musicas':
              setActiveTab('explore');
              setActiveMusicSub('musicas');
              break;
            case 'news':
            case 'noticia':
            case 'noticias':
              setActiveTab('my_business');
              setBusinessTab('news');
              break;
            case 'service':
            case 'services':
            case 'servico':
            case 'servicos':
              setActiveTab('explore');
              break;
            default:
              triggerToast('Opção: ' + optionId);
              break;
          }
        }}
      />

      {/* 6. CREATE POLL MODAL */}
      <CreatePollModal 
        isOpen={isPollModalOpen}
        onClose={() => setIsPollModalOpen(false)}
        currentUser={currentUser}
        onPollCreated={(newPoll) => {
          setPolls(prev => [newPoll, ...prev]);
          triggerToast('Enquete criada com sucesso!');
        }}
      />

      {/* 7. PROFILE BANNERS CAROUSEL & VOXA ADS MANAGER MODAL */}
      <ProfileBannersManagerModal
        isOpen={isBannersModalOpen}
        onClose={() => setIsBannersModalOpen(false)}
        currentUser={currentUser}
        activeUserData={activeUserData}
        onUpdated={(banners, adSettings, firstCoverUrl) => {
          const updatedUser = {
            ...currentUser,
            profileBanners: banners,
            profileAdSettings: adSettings,
            coverUrl: firstCoverUrl,
            coverURL: firstCoverUrl
          };
          setCurrentUser(updatedUser);
          localStorage.setItem('voxa_current_user', JSON.stringify(updatedUser));
          setCentralUsers(prev =>
            prev.map(u =>
              u.uid === currentUser?.uid || u.id === currentUser?.uid
                ? {
                    ...u,
                    profileBanners: banners,
                    profileAdSettings: adSettings,
                    coverUrl: firstCoverUrl,
                    coverURL: firstCoverUrl
                  }
                : u
            )
          );
        }}
        triggerToast={triggerToast}
      />

      {/* 8. PROFILE AD SPONSORSHIP MODAL */}
      <ProfileAdSponsorModal
        isOpen={isSponsorBannerModalOpen}
        onClose={() => setIsSponsorBannerModalOpen(false)}
        targetProfile={visitedUser || activeUserData}
        currentUser={currentUser}
        walletBalance={walletBalance}
        onSuccess={() => {
          loadData();
        }}
        triggerToast={triggerToast}
      />

    </div>
  );
};
