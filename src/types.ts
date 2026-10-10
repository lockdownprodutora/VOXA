export interface Artist {
  id: string;
  name: string;
  genre: string;
  image: string;
  listeners: string;
  topTrack: string;
}

export interface Sector {
  sectorId: string;
  name: string;
  description: string;
  capacity: number;
  active: boolean;
}

export interface Lot {
  lotId: string;
  sectorId: string;
  name: string;
  price: number;
  quantity: number;
  soldQuantity: number;
  salesStart: string;
  salesEnd: string;
  active: boolean;
  soldOut: boolean;
}

export interface Show {
  id: string;
  name?: string;
  description?: string;
  city: string;
  venue: string;
  date: string;
  startTime?: string;
  endTime?: string;
  category?: string;
  rating?: string;
  price: string;
  status: string; // 'Pendente' | 'Aprovado' | 'Rejeitado' | 'Alteração Solicitada'
  imageUrl?: string;
  organizerId?: string;
  organizerName?: string;
  observations?: string;
  cancellationPolicy?: string;
  
  // Address / Location
  cep?: string;
  address?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  state?: string;
  country?: string;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;

  // Sectors & Lots
  sectors?: Sector[];
  lots?: Lot[];

  // Commission & Fee Settings (per-event customizable)
  lockdownFeeType?: 'percent' | 'fixed' | 'both';
  lockdownFeePercent?: number;
  lockdownFeeFixed?: number;
  lockdownFeeApplyOn?: 'gross' | 'net_after_payment_fee';
  paymentFeePercent?: number;
  transferredAmount?: number;
}

export interface Product {
  id: string;
  name: string;
  category: string; // Changed from enum to string to support all categories dynamically
  price: string;
  image?: string | null;
  images?: string[];
  mediaUrl?: string | null;
  driveFileId?: string | null;
  driveFolderId?: string | null;
  imageMedia?: {
    provider: 'google-drive';
    driveFileId: string;
    driveFolderId?: string | null;
    mediaUrl: string;
    fileName: string;
    mimeType: string;
  } | null;
  badge?: string;
  status?: string;
  sellerId?: string;
  sellerName?: string;
  allowInstallments?: boolean;
  maxInstallments?: number;
}

export interface ReleaseTrack {
  id: string;
  title: string;
  artist: string;
  albumCover: string;
  duration: string;
  genre: string;
  status: 'Pendente' | 'Aprovado' | 'Reprovado';
  dateAdded: string;
  audioSample?: string;
}

export type UserRole = 'ARTISTA' | 'USUÁRIO COMUM' | 'PRODUTORA' | 'EMPRESA' | 'ADMINISTRADOR';
export type ArtistSpecialty = 'DJ' | 'MC' | 'Cantor' | 'Produtor Musical' | 'Outro' | string;
export type AccountStatus = 'SEM_ACESSO' | 'CONVITE_PENDENTE' | 'CONTA_ATIVA' | 'PRE_REGISTERED' | 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
export type LeagueStatus = 'NÃO PARTICIPA' | 'PENDENTE' | 'ATIVO' | 'SUSPENSO' | 'SAIU';

export interface PersonalData {
  fullName?: string;
  cpf?: string;
  rg?: string;
  phone?: string;
}

export interface DeliveryAddress {
  recipientName?: string;
  phone?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface ProfileBanner {
  bannerId: string;
  ownerUid: string;
  type: 'image' | 'gif' | 'video' | 'youtube';
  mediaUrl?: string;
  youtubeVideoId?: string;
  redirectUrl?: string;
  title?: string;
  position: number; // 1 to 4
  active: boolean;
  isAdvertisement?: boolean;
  adCampaignId?: string;
  isSponsoredAd?: boolean;
  sponsorUid?: string;
  sponsorName?: string;
  sponsorUsername?: string;
  expiresAt?: string;
  clicksCount?: number;
  impressionsCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ProfileAdSettings {
  allowBannerAds: boolean;
  availableSlotsCount: number; // 1 to 4
  price24h: number;
  price7d: number;
  price30d: number;
  requireManualApproval: boolean;
  updatedAt?: string;
}

export interface CentralUser {
  id: string;
  uid?: string; // firebaseUid or profile id
  name: string; // Username / Nome artístico (único campo obrigatório na criação)
  slug?: string; // e.g. 'dj-nk' para perfil público /u/dj-nk
  artisticName?: string;
  email?: string;
  phone?: string;
  photoURL?: string; // Foto principal
  avatarUrl?: string; // Alias for backward compatibility
  galleryPhotos?: string[]; // Até 4 fotos secundárias (máximo 5 fotos no total)
  role: UserRole | string;
  artistSpecialty?: ArtistSpecialty; // Especialidade opcional (ex: DJ, MC, etc)
  isAdmin?: boolean;
  status: 'Ativo' | 'Inativo' | 'Cadastro incompleto' | 'Aguardando credenciais' | 'Suspenso' | 'PRE_REGISTERED' | 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  accountStatus: AccountStatus;
  hasAuth?: boolean;
  origin?: 'admin' | 'music' | 'site' | 'manual' | 'migration';
  isArtist?: boolean;
  notes?: string;
  inviteToken?: string;
  inviteEmail?: string;
  
  // Dados Privados (visíveis apenas pelo próprio usuário e admin)
  personalData?: PersonalData;
  deliveryAddress?: DeliveryAddress;
  
  // Sistema de Indicação (Referrals)
  referralCode?: string;
  referredByUserId?: string;
  
  // Sistema League
  leagueStatus?: LeagueStatus;
  leagueDivision?: number; // 1 a 10 (sempre inicia na 10ª Divisão)
  leaguePoints?: number; // 0 inicialmente
  leagueJoinedAt?: string;
  
  // Ranking Geral
  lifetimePoints?: number; // Pontuação acumulada histórica para o Ranking Geral
  
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;

  // VOXA specific fields
  bio?: string;
  location?: string;
  website?: string;
  coverURL?: string;
  coverUrl?: string;
  profileBanners?: ProfileBanner[];
  profileAdSettings?: ProfileAdSettings;
  socials?: any;
  highlights?: any[];
  features?: {
    store?: boolean;
    events?: boolean;
    subscriptions?: boolean;
    news?: boolean;
    music?: boolean;
    services?: boolean;
    fundraisers?: boolean;
    passagens?: boolean;
  };
  messageSettings?: {
    privacy: 'ANYONE' | 'FOLLOWED' | 'FOLLOWERS' | 'NONE' | 'PAID';
    price?: number;
  };
  followersCount?: number;
  followingCount?: number;
  followersList?: string[];
  followingList?: string[];
  username?: string;
  accountType?: string;
  defaultFollowsInitialized?: boolean;
  categoryId?: string;
  categoryName?: string;
  isVerified?: boolean;
  verified?: boolean;
}

export interface Referral {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  referralCode: string;
  createdAt: string;
  status: 'pending' | 'qualified' | 'fraud_rejected';
  lifecycleStage?: 'CLICKED' | 'REGISTERED' | 'QUALIFIED' | 'REWARDED' | 'FRAUD_REJECTED';
  clickedAt?: string;
  registeredAt?: string;
  qualifiedAt?: string;
  rewardedAt?: string;
  source?: string;
  referrerName?: string;
  referredName?: string;
  bonusAmountCentavos?: number;
  referrerBonusAmount?: number;
  referredBonusAmount?: number;
  bonusCredited?: boolean;
  promoCredited?: boolean;
  walletType?: 'PROMO';
}

export interface ReferralSettings {
  enabled: boolean;
  referrerBonusAmount: number; // centavos credited to promoBalance
  referredBonusAmount: number; // centavos credited to promoBalance
  referrerLeaguePoints: number;
  allowWithdrawPromo: boolean;
  allowUseInTrade: boolean;
  allowUseInStore: boolean;
  allowUseInAds: boolean;
  allowPromoInStore?: boolean;
  allowPromoInTrade?: boolean;
  allowPromoWithdrawal?: boolean;
  autoQualifyOnSignup?: boolean;
  requireProfileComplete: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export interface LeagueParticipant {
  id: string;
  userId: string;
  division: number; // 1 a 10 (sempre inicia na 10ª)
  status: LeagueStatus;
  points: number; // 0 inicial
  seasonPoints: number;
  joinedAt: string;
  currentPosition?: number;
  wins?: number;
  losses?: number;
  promotions?: number;
  relegations?: number;
}

export interface LeaguePointEvent {
  id: string;
  userId: string;
  type: 'REFERRAL' | 'ACTIVITY' | 'FAN_SUPPORT' | 'CHALLENGE' | 'SALE' | 'TICKET' | 'MISSION' | 'MATCH' | 'BONUS' | 'PENALTY';
  points: number;
  referenceId?: string;
  createdAt: string;
  seasonId?: string;
  status: 'pending' | 'applied' | 'cancelled';
}

export interface LeaguePointTransaction {
  id: string;
  userId: string;
  previousValue: number;
  change: number;
  finalValue: number;
  type: string;
  reference: string;
  reason: string;
  createdAt: string;
  createdBy: string;
}

export interface LeagueSeason {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'finished';
}

export interface UserInvite {
  id: string;
  token: string;
  userId: string;
  email: string;
  phone?: string;
  name: string;
  artisticName?: string;
  role?: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: number;
  createdAt: string;
  acceptedAt?: string;
}

export type AdminModuleType = 'menu' | 'overview' | 'users' | 'music' | 'ticket' | 'store' | 'assinatura' | 'config' | 'drive' | 'support_requests' | 'league' | 'sorteios' | 'gamer' | 'ads' | 'vox' | 'social_diagnostics' | 'financeiro' | 'vaquinhas' | 'passagens' | 'categories' | 'trade' | 'trade_settings' | 'invest' | 'voxa_ai';
export type MusicSubModuleType = 'overview' | 'artistas' | 'acapellas' | 'whatsapp' | 'distribuicao' | 'lancamentos' | 'envios' | 'streams_manager' | 'visao_geral_music';

export interface DetailedArtist {
  id: string;
  name: string;
  realName?: string;
  artistType: string; // DJ, MC, Cantor, Produtor
  company: string; // e.g., Lockdown
  bio: string;
  image: string; // photoURL
  imageStoragePath?: string;
  spotifyUrl: string;
  spotifyArtistId?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  monthlyListeners: number;
  listenersUpdatedAt?: string;
  featured: boolean;
  status: 'Ativo' | 'Rascunho' | 'Oculto';
  userId?: string;
  driveFolderId?: string;
  driveFolderName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MusicStream {
  id: string;
  title: string;
  artistIds: string[]; // references to DetailedArtist.id
  artistNames: string; // pre-joined names e.g., "MC KRONOS, DJ LOCK"
  coverUrl: string;
  coverStoragePath?: string;
  audioUrl: string;
  audioStoragePath?: string;
  audioFormat?: string; // mp3, wav
  totalStreams: number;
  platformStreams?: {
    spotify?: number;
    youtube?: number;
    appleMusic?: number;
    deezer?: number;
    amazonMusic?: number;
    tiktok?: number;
  };
  releaseDate?: string;
  spotifyUrl?: string;
  youtubeUrl?: string;
  appleMusicUrl?: string;
  deezerUrl?: string;
  amazonMusicUrl?: string;
  description?: string;
  featured: boolean;
  status: 'Ativo' | 'Rascunho' | 'Oculto';
  createdAt: string;
  updatedAt: string;
}

export interface ShareParticipant {
  type: 'Empresário' | 'Produtora' | 'Produtor Musical' | 'Empresa' | 'Outros';
  name: string;
  email: string;
  percentage: number;
}

export interface ShareHistory {
  id: string;
  date: string;
  description: string;
  amount: number;
}

export interface ArtistShare {
  id: string;
  artistPhoto: string;
  artistName: string;
  artistEmail: string;
  paymentEmail?: string;
  artistPercentage: number;
  distributor: string;
  status: 'Pendente' | 'Concluido' | 'Recusado';
  notes: string;
  participants: ShareParticipant[];
  history: ShareHistory[];
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface YouTubeVerificationRequest {
  id: string;
  channelName: string;
  channelLink: string;
  contactEmail: string;
  subscriberCount: number;
  currentDistributor: string;
  notes: string;
  status: 'Enviado' | 'Em processamento' | 'Concluido' | 'Rejeitado';
  adminNotes?: string;
  userEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface DistributionClearance {
  id: string;
  image: string;
  artistName: string;
  status: 'Aprovado' | 'Pendente';
  notes: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Community {
  id: string;
  name: string;
  coverUrl: string;
  whatsappUrl: string;
  discordUrl: string;
  status: 'Ativo' | 'Inativo';
  createdAt: string;
  updatedAt: string;
}

export interface Fundraiser {
  id: string;
  ownerUid: string;
  ownerName?: string;
  ownerUsername?: string;
  ownerAvatar?: string;
  title: string;
  slug: string;
  coverUrl: string;
  shortDescription: string;
  description: string;
  goalAmount: number;
  raisedAmount: number;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELED';
  categoryId: string;
  showOnProfile: boolean;
  allowSharing: boolean;
  createdAt: string;
  updatedAt: string;
  endsAt?: string;
  supporterCount?: number;
}

export interface FundraiserContribution {
  id: string;
  fundraiserId: string;
  contributorId: string;
  contributorName: string;
  amount: number;
  platformFee: number;
  netAmount: number;
  status: 'PENDING' | 'COMPLETED' | 'REFUNDED';
  paymentMethod: 'wallet' | 'pix';
  createdAt: string;
}

export interface PublicCategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  active: boolean;
  order: number;
}

export interface TravelSearchQuery {
  type: 'flight' | 'bus';
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  class?: string;
}

export interface TravelBooking {
  id: string;
  userId: string;
  type: 'flight' | 'bus';
  origin: string;
  destination: string;
  departureDate: string;
  passengers: number;
  status: 'SEARCHED' | 'SELECTED' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELED' | 'REFUNDED';
  amount: number;
  createdAt: string;
}

export interface ChatThread {
  id: string;
  participants: string[];
  participantNames: { [uid: string]: string };
  participantAvatars: { [uid: string]: string };
  participantUsernames: { [uid: string]: string };
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: { [uid: string]: number };
  updatedAt: string;
  status: 'ACTIVE' | 'REQUEST' | 'BLOCKED';
  requestBy?: string;
  pricePerMessage?: number;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderUid: string;
  text: string;
  createdAt: string;
  read: boolean;
  type: 'text' | 'image' | 'payment_request' | 'payment_confirmation';
  paymentId?: string;
}

export interface PollOption {
  id: string;
  text: string;
  votesCount: number;
}

export interface Poll {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  duration: string;
  endsAt: string;
  status: 'ACTIVE' | 'ENDED' | 'CANCELED';
  createdAt: string;
  userVotedOptionId?: string; // Loaded locally / client-side
}

export interface PollVote {
  id: string;
  pollId: string;
  uid: string;
  optionId: string;
  votedAt: string;
}

export interface TradeAssetConfig {
  id: string;
  symbol: string;
  name: string;
  category: 'CRYPTO' | 'FOREX' | 'COMMODITIES';
  provider: 'BINANCE' | 'AWESOMEAPI';
  providerPair: string;
  decimals: number;
  currencyPrefix: string;
  active: boolean;
}

export interface TradeSettings {
  enabled: boolean;
  realMoneyEnabled: boolean;
  winPayoutPercent: number;
  tradeFeePercent: number;
  minimumStake: number;
  maximumStake: number;
  maximumUserExposure: number;
  maximumPlatformExposure: number;
  allowedDurations: number[];
  allowedAssets: string[];
  payoutPercent: number;
  platformFeePercent: number;
  minStakeCentavos: number;
  maxStakeCentavos: number;
  maxOpenPositionsPerUser: number;
  allowedDurationsSeconds: number[];
  assets: TradeAssetConfig[];
  updatedAt: string;
  updatedBy?: string;
}

export interface TradePosition {
  id: string;
  userUid: string;
  assetId: string;
  assetSymbol: string;
  assetName?: string;
  direction: 'UP' | 'DOWN';
  stakeAmount: number;
  durationSeconds?: number;
  entryPrice: number;
  entryTimestamp: string;
  expiryTimestamp: string;
  exitPrice: number | null;
  status: 'PENDING' | 'OPEN' | 'SETTLING' | 'WON' | 'LOST' | 'DRAW' | 'CANCELED' | 'ERROR';
  payoutPercent: number;
  platformFeePercent?: number;
  grossResult: number;
  fees: number;
  netResult: number;
  marketDataProvider: string;
  createdAt: string;
  settledAt: string | null;
}
