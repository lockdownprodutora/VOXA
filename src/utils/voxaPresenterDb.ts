import { db, isFirebaseConfigured } from '../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';

export type PresenterAspectRatio = '9:16' | '1:1' | '16:9' | '4:5';
export type VideoDurationOption = 5 | 10 | 15 | 20 | 30 | 40;
export type CaptionStyleType = 'Clean' | 'Bold' | 'Social' | 'Minimal';

export type VoxaAiToolId =
  | 'criar_avatar'
  | 'avatar_falante'
  | 'motion_transfer'
  | 'character_replace'
  | 'imagem_para_video'
  | 'texto_para_video'
  | 'gerar_imagem'
  | 'editar_imagem'
  | 'criar_anuncio'
  | 'criar_cenario'
  | 'biblioteca_ia'
  | 'meus_projetos';

export type PresenterTargetChannel =
  | 'Instagram'
  | 'TikTok'
  | 'YouTube Shorts'
  | 'Stories'
  | 'Campanhas'
  | 'Anúncios'
  | 'Tutoriais'
  | 'Novidades da plataforma';

export type AvatarCharacterStyle =
  | 'Humano Realista'
  | 'Profissional / Executivo'
  | 'Influencer / Creator'
  | 'Futurista'
  | 'Cyberpunk'
  | 'Mascote 3D'
  | 'Estilizado / Editorial';

export interface CaptionSegment {
  startSec: number;
  endSec: number;
  text: string;
}

export interface VoxaAiToolConfig {
  id: VoxaAiToolId;
  name: string;
  shortDesc: string;
  badge: string;
  enabled: boolean;
  publicEnabled: boolean;
  statusMode: 'REAL_ACTIVE' | 'EM_PREPARACAO';
  provider: string;
  model: string;
  endpoint: string;
  providerCostBRL: number; // Base cost in BRL (e.g., per generation or per 10s)
  minimumMarginPercent: number; // 75% minimum gross margin rule
  creditsCharged: number; // Calculated so salePrice = providerCostBRL / (1 - 0.75), 1 credit = R$ 0.10
}

export interface VoxaPresenterSettings {
  presenterPublicEnabled: boolean; // NOW TRUE by default
  mode: 'INTERNO' | 'PÚBLICO';
  availableToUsers: boolean;
  authorizedRoles: string[];
  authorizedUids: string[];
  consumeUserCredits: boolean; // true for public users, false for internal admin
  defaultPresetId: string; // 'voxa_official_studio'
  defaultProvider: string;
  usdToBrlRate: number;
  creditValueBRL: number; // R$ 0.10 per credit
  minimumMarginPercent: number; // 75%
  watermarkEnabledByDefault: boolean;
  toolsConfig: Record<string, VoxaAiToolConfig>;
  futurePublicPricing: {
    billingEnabled: boolean;
    pricePerVideoBRL: number;
    creditsPerVideo: number;
  };
  updatedAt: string;
  updatedBy?: string;
}

export interface VoxaPresenterAvatar {
  id: string;
  avatarId?: string;
  userUid?: string;
  name: string;
  roleTitle: string;
  description: string;
  characterDescription?: string;
  style?: AvatarCharacterStyle | string;
  avatarUrl: string;
  referenceImages?: string[];
  seed?: number;
  referenceMetadata?: {
    provider: string;
    model: string;
    consistencyLock: boolean;
    facialRigVersion: string;
  };
  isOfficial: boolean;
  isSavedCharacter?: boolean;
  defaultVoiceId: string;
  defaultLanguage: string;
  defaultTone: string;
  accentColor: string;
  createdAt: string;
}

export interface VoxaPresenterScenario {
  id: string;
  userUid?: string;
  name: string;
  presetCode: string;
  category?: 'Fundo branco' | 'Estúdio' | 'Escritório' | 'Futurista' | 'Fundo escuro' | 'Cenário VOXA' | 'Upload personalizado';
  description: string;
  backgroundType: 'white_studio' | 'dark_studio' | 'newsroom' | 'creator_lounge' | 'office' | 'futuristic' | 'custom_image';
  backgroundColor: string;
  secondaryColor: string;
  backgroundImageUrl?: string;
  showVoxaLogoDefault: boolean;
  lightingStyle: string;
  isOfficialPreset?: boolean;
  createdAt: string;
}

export interface VoxaAiJobRecord {
  jobId: string;
  userUid: string;
  userName?: string;
  tool: VoxaAiToolId | string;
  toolLabel: string;
  provider: string;
  model: string;
  endpoint: string;
  cost: number; // Cost in BRL
  providerCostUSD: number;
  creditsCharged: number;
  salePriceBRL: number;
  marginPercent: number;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  stageLabel: 'Preparando...' | 'Gerando...' | 'Processando...' | 'Finalizando...' | 'Concluído' | 'Falhou';
  durationSeconds?: number;
  segmentsCount?: number;
  aspectRatio?: PresenterAspectRatio;
  referenceImageSent?: boolean;
  audioVoiceGenerated?: boolean;
  realLipSync?: boolean;
  motionGeneration?: boolean;
  consentConfirmed?: boolean;
  aiMetadata?: {
    generatedBy: 'VOXA Studio IA';
    watermarkText: string;
    AvatarId?: string;
    continuitySeed?: number;
  };
  inputSummary?: string;
  outputUrl?: string;
  audioUrl?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface VoxaPresenterLibraryItem {
  id: string;
  jobId?: string;
  userUid?: string;
  itemCategory?: 'video' | 'image' | 'avatar' | 'scenario' | 'project' | 'ad';
  title: string;
  targetChannel: PresenterTargetChannel;
  aspectRatio: PresenterAspectRatio;
  avatarId: string;
  avatarName: string;
  avatarUrl: string;
  savedCharacterId?: string;
  savedCharacterName?: string;
  script: string;
  voiceId: string;
  voiceName: string;
  voiceGender?: 'female' | 'male';
  voiceSpeed?: number;
  voiceStyle?: string;
  language: string;
  tone: string;
  scenarioId: string;
  scenarioName: string;
  presetUsed: string;
  showVoxaLogo: boolean;
  voxaAiWatermark?: boolean;
  backgroundImageUrl?: string;
  generateCaptions: boolean;
  captionStyle?: CaptionStyleType;
  captions: CaptionSegment[];
  videoUrl?: string;
  imageUrl?: string;
  audioUrl?: string;
  durationSeconds: number;
  segmentsComposed?: number;
  provider: string;
  model?: string;
  endpoint?: string;
  providerCost: number; // USD
  estimatedCostBRL: number; // BRL
  creditsCharged?: number;
  referenceImageSent?: boolean;
  realLipSync?: boolean;
  motionGeneration?: boolean;
  createdAt: string;
  createdByUid: string;
  createdByName: string;
}

// Helper: Calculate minimum sale price & credits enforcing >= 75% gross margin
// Formula: minimumSalePriceBRL = costBRL / (1 - 0.75) = costBRL * 4
// 1 VOXA AI Credit = R$ 0.10
export function computeCreditsWith75Margin(
  costBRL: number,
  marginPercent = 75,
  creditValueBRL = 0.10
): {
  costBRL: number;
  minimumSalePriceBRL: number;
  creditsCharged: number;
  effectiveMarginPercent: number;
} {
  const safeMargin = Math.min(95, Math.max(75, marginPercent)) / 100;
  const minimumSalePriceBRL = Number((costBRL / (1 - safeMargin)).toFixed(2));
  const creditsCharged = Math.max(5, Math.ceil(minimumSalePriceBRL / creditValueBRL));
  const actualSaleBRL = creditsCharged * creditValueBRL;
  const effectiveMarginPercent =
    actualSaleBRL > 0 ? Number((((actualSaleBRL - costBRL) / actualSaleBRL) * 100).toFixed(1)) : 75;

  return {
    costBRL: Number(costBRL.toFixed(2)),
    minimumSalePriceBRL: Number(actualSaleBRL.toFixed(2)),
    creditsCharged,
    effectiveMarginPercent
  };
}

export const DEFAULT_VOXA_AI_TOOLS_CONFIG: Record<string, VoxaAiToolConfig> = {
  criar_avatar: {
    id: 'criar_avatar',
    name: 'Criar Avatar',
    shortDesc: 'Crie avatares consistentes por fotos de referência ou prompt (Humano, Executivo, Influencer, Cyberpunk, Mascote).',
    badge: 'CONSISTENTE',
    enabled: true,
    publicEnabled: true,
    statusMode: 'REAL_ACTIVE',
    provider: 'Google Gemini API (@google/genai)',
    model: 'gemini-3.1-flash-lite-image',
    endpoint: '/api/ai/generate-image',
    providerCostBRL: 0.50,
    minimumMarginPercent: 75,
    creditsCharged: 20 // R$ 0,50 / (1 - 0.75) = R$ 2,00 = 20 créditos
  },
  avatar_falante: {
    id: 'avatar_falante',
    name: 'Avatar Falante (VOXA Presenter)',
    shortDesc: 'Avatar realmente animado com sincronização labial (lip-sync), piscadas, movimentos de cabeça, gestos, voz neural e até 40s.',
    badge: 'ATÉ 40s • LIP-SYNC',
    enabled: true,
    publicEnabled: true,
    statusMode: 'REAL_ACTIVE',
    provider: 'Google Gemini TTS + Veo 3.1 + VOXA Neural Kinematic Engine',
    model: 'gemini-3.8-flash-lite-tts + veo-3.1-lite-generate-preview',
    endpoint: '/api/ai/talking-avatar',
    providerCostBRL: 1.00, // Base per 10s (R$ 1,00 cost -> R$ 4,00 sale -> 40 créditos per 10s)
    minimumMarginPercent: 75,
    creditsCharged: 40
  },
  motion_transfer: {
    id: 'motion_transfer',
    name: 'Motion Transfer',
    shortDesc: 'Transfira movimentos corporais, gestos, câmera e timing de um vídeo de referência autorizado para o seu Avatar.',
    badge: 'TRANSFERÊNCIA DE MOVIMENTO',
    enabled: true,
    publicEnabled: true,
    statusMode: 'REAL_ACTIVE',
    provider: 'Google Veo 3.1 + VOXA Pose & Motion Extractor',
    model: 'veo-3.1-generate-preview + gemini-3.1-flash-lite-image',
    endpoint: '/api/ai/motion-transfer',
    providerCostBRL: 2.50,
    minimumMarginPercent: 75,
    creditsCharged: 100 // R$ 2,50 / (1 - 0.75) = R$ 10,00 = 100 créditos
  },
  character_replace: {
    id: 'character_replace',
    name: 'Character Replace (Substituir Personagem)',
    shortDesc: 'Substitua o personagem de um vídeo autorizado pelo seu Avatar mantendo o enquadramento, iluminação e ação.',
    badge: 'SUBSTITUIR PERSONAGEM',
    enabled: true,
    publicEnabled: true,
    statusMode: 'REAL_ACTIVE',
    provider: 'Google Veo 3.1 Reference Asset + Gemini Image',
    model: 'veo-3.1-generate-preview + gemini-3.1-flash-lite-image',
    endpoint: '/api/ai/motion-transfer',
    providerCostBRL: 2.50,
    minimumMarginPercent: 75,
    creditsCharged: 100
  },
  imagem_para_video: {
    id: 'imagem_para_video',
    name: 'Imagem → Vídeo',
    shortDesc: 'Envie uma foto e anime com movimento cinematográfico real via Google Veo 3.1.',
    badge: 'VEO 3.1',
    enabled: true,
    publicEnabled: true,
    statusMode: 'REAL_ACTIVE',
    provider: 'Google Gemini / Veo 3.1 API (@google/genai)',
    model: 'veo-3.1-lite-generate-preview',
    endpoint: '/api/ai/video/start',
    providerCostBRL: 2.00,
    minimumMarginPercent: 75,
    creditsCharged: 80 // R$ 2,00 / 0.25 = R$ 8,00 = 80 créditos
  },
  texto_para_video: {
    id: 'texto_para_video',
    name: 'Texto → Vídeo',
    shortDesc: 'Descreva uma cena e gere vídeos cinematográficos em 9:16 ou 16:9 com Google Veo 3.1.',
    badge: 'VEO 3.1',
    enabled: true,
    publicEnabled: true,
    statusMode: 'REAL_ACTIVE',
    provider: 'Google Gemini / Veo 3.1 API (@google/genai)',
    model: 'veo-3.1-lite-generate-preview',
    endpoint: '/api/ai/video/start',
    providerCostBRL: 2.00,
    minimumMarginPercent: 75,
    creditsCharged: 80
  },
  gerar_imagem: {
    id: 'gerar_imagem',
    name: 'Gerar Imagem',
    shortDesc: 'Geração de imagens em alta definição nos formatos 1:1, 4:5, 9:16 e 16:9.',
    badge: 'GEMINI IMAGE',
    enabled: true,
    publicEnabled: true,
    statusMode: 'REAL_ACTIVE',
    provider: 'Google Gemini API (@google/genai)',
    model: 'gemini-3.1-flash-lite-image',
    endpoint: '/api/ai/generate-image',
    providerCostBRL: 0.40,
    minimumMarginPercent: 75,
    creditsCharged: 16 // R$ 0,40 / 0.25 = R$ 1,60 = 16 créditos
  },
  editar_imagem: {
    id: 'editar_imagem',
    name: 'Editar Imagem',
    shortDesc: 'Trocar fundo, trocar roupa, adicionar/remover objetos, relighting, expandir e transformar estilo.',
    badge: 'EDITOR IA',
    enabled: true,
    publicEnabled: true,
    statusMode: 'REAL_ACTIVE',
    provider: 'Google Gemini API (@google/genai)',
    model: 'gemini-3.1-flash-lite-image',
    endpoint: '/api/ai/edit-image',
    providerCostBRL: 0.45,
    minimumMarginPercent: 75,
    creditsCharged: 18
  },
  criar_anuncio: {
    id: 'criar_anuncio',
    name: 'Criar Anúncio',
    shortDesc: 'Envie produto, imagem e descrição para gerar banners, posts, stories, vídeos curtos UGC e anúncios comerciais.',
    badge: 'ADS & UGC',
    enabled: true,
    publicEnabled: true,
    statusMode: 'REAL_ACTIVE',
    provider: 'Google Gemini 3.8 + Gemini Image + TTS',
    model: 'gemini-3.8-flash + gemini-3.1-flash-lite-image',
    endpoint: '/api/ai/create-ad',
    providerCostBRL: 0.75,
    minimumMarginPercent: 75,
    creditsCharged: 30
  },
  criar_cenario: {
    id: 'criar_cenario',
    name: 'Criar Cenário',
    shortDesc: 'Gere cenários de estúdio exclusivos ou envie fundos personalizados (JPG, PNG, WEBP) para seus vídeos.',
    badge: 'STUDIO BACKDROP',
    enabled: true,
    publicEnabled: true,
    statusMode: 'REAL_ACTIVE',
    provider: 'Google Gemini API (@google/genai)',
    model: 'gemini-3.1-flash-lite-image',
    endpoint: '/api/ai/generate-image',
    providerCostBRL: 0.40,
    minimumMarginPercent: 75,
    creditsCharged: 16
  }
};

export const DEFAULT_VOXA_PRESENTER_SETTINGS: VoxaPresenterSettings = {
  presenterPublicEnabled: true, // PUBLIC ENABLED AS REQUESTED
  mode: 'PÚBLICO',
  availableToUsers: true,
  authorizedRoles: ['SUPER_ADMIN', 'ADMINISTRATOR', 'MANAGER'],
  authorizedUids: [],
  consumeUserCredits: true,
  defaultPresetId: 'voxa_official_studio',
  defaultProvider: 'Google Gemini 3.8 TTS + Veo 3.1 + VOXA Neural Kinematic Engine',
  usdToBrlRate: 5.75,
  creditValueBRL: 0.10,
  minimumMarginPercent: 75,
  watermarkEnabledByDefault: true,
  toolsConfig: DEFAULT_VOXA_AI_TOOLS_CONFIG,
  futurePublicPricing: {
    billingEnabled: true,
    pricePerVideoBRL: 4.00,
    creditsPerVideo: 40
  },
  updatedAt: new Date().toISOString()
};

export const OFFICIAL_VOXA_AVATARS: VoxaPresenterAvatar[] = [
  {
    id: 'avatar_voxa_aria',
    avatarId: 'avatar_voxa_aria',
    name: 'Aria VOXA',
    roleTitle: 'Apresentadora Oficial • Institucional & Campanhas',
    description: 'Avatar oficial principal da VOXA para comunicados oficiais, campanhas de marca, Instagram Reels e anúncios estratégicos.',
    characterDescription: 'Mulher brasileira executiva moderna, 28 anos, expressão carismática e confiante, iluminação de estúdio premium.',
    style: 'Profissional / Executivo',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=900&q=85',
    referenceImages: ['https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=900&q=85'],
    seed: 104829,
    referenceMetadata: {
      provider: 'VOXA Neural Rig + Gemini Image',
      model: 'gemini-3.1-flash-lite-image',
      consistencyLock: true,
      facialRigVersion: 'v2.4-kinematic'
    },
    isOfficial: true,
    defaultVoiceId: 'voxa_female_studio_br',
    defaultLanguage: 'pt-BR',
    defaultTone: 'Institucional Premium',
    accentColor: '#FF0033',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'avatar_voxa_marcus',
    avatarId: 'avatar_voxa_marcus',
    name: 'Marcus VOXA',
    roleTitle: 'Executivo • Finanças, Negócios & Tutoriais',
    description: 'Apresentador executivo ideal para explicações de produto, tutoriais da plataforma, novidades financeiras e demonstrações 16:9.',
    characterDescription: 'Homem executivo brasileiro, 34 anos, blazer escuro alinhado, postura firme e didática em estúdio.',
    style: 'Profissional / Executivo',
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=900&q=85',
    referenceImages: ['https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=900&q=85'],
    seed: 209384,
    referenceMetadata: {
      provider: 'VOXA Neural Rig + Gemini Image',
      model: 'gemini-3.1-flash-lite-image',
      consistencyLock: true,
      facialRigVersion: 'v2.4-kinematic'
    },
    isOfficial: true,
    defaultVoiceId: 'voxa_male_exec_br',
    defaultLanguage: 'pt-BR',
    defaultTone: 'Tutorial Didático',
    accentColor: '#111827',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'avatar_voxa_luna',
    avatarId: 'avatar_voxa_luna',
    name: 'Luna VOXA',
    roleTitle: 'Host Social • TikTok, Stories & Creators',
    description: 'Apresentadora dinâmica com linguagem ágil para TikTok, YouTube Shorts, Stories, sorteios oficiais e engajamento da comunidade.',
    characterDescription: 'Jovem criadora de conteúdo digital, 24 anos, visual moderno urbano, expressiva e comunicativa.',
    style: 'Influencer / Creator',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=900&q=85',
    referenceImages: ['https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=900&q=85'],
    seed: 304912,
    referenceMetadata: {
      provider: 'VOXA Neural Rig + Gemini Image',
      model: 'gemini-3.1-flash-lite-image',
      consistencyLock: true,
      facialRigVersion: 'v2.4-kinematic'
    },
    isOfficial: true,
    defaultVoiceId: 'voxa_female_viral_br',
    defaultLanguage: 'pt-BR',
    defaultTone: 'Energético / Viral',
    accentColor: '#FF0033',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'avatar_voxa_kai',
    avatarId: 'avatar_voxa_kai',
    name: 'Kai VOXA',
    roleTitle: 'Especialista • Eventos, Tickets & Tech',
    description: 'Apresentador focado em lançamentos de eventos, VOXA Store, tecnologia e chamadas rápidas de alta conversão.',
    characterDescription: 'Apresentador jovem contemporâneo, 29 anos, estilo tech premium, gestos dinâmicos e olhar focado.',
    style: 'Futurista',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=900&q=85',
    referenceImages: ['https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=900&q=85'],
    seed: 409182,
    referenceMetadata: {
      provider: 'VOXA Neural Rig + Gemini Image',
      model: 'gemini-3.1-flash-lite-image',
      consistencyLock: true,
      facialRigVersion: 'v2.4-kinematic'
    },
    isOfficial: true,
    defaultVoiceId: 'voxa_male_dynamic_br',
    defaultLanguage: 'pt-BR',
    defaultTone: 'Anúncio Comercial',
    accentColor: '#FF0033',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

export const OFFICIAL_VOXA_SCENARIOS: VoxaPresenterScenario[] = [
  {
    id: 'voxa_official_studio',
    name: 'VOXA OFFICIAL STUDIO',
    presetCode: 'VOXA OFFICIAL STUDIO',
    category: 'Cenário VOXA',
    description: 'Fundo branco infinito, logo VOXA ao fundo, iluminação premium, detalhes discretos preto/vermelho, avatar central e aparência profissional.',
    backgroundType: 'white_studio',
    backgroundColor: '#FFFFFF',
    secondaryColor: '#F4F4F6',
    showVoxaLogoDefault: true,
    lightingStyle: 'Iluminação de Estúdio Clean Key + Soft Rim Preto/Vermelho',
    isOfficialPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'cenario_fundo_branco',
    name: 'Fundo Branco Infinito',
    presetCode: 'WHITE CYCLORAMA',
    category: 'Fundo branco',
    description: 'Ciclorama branco puro com iluminação difusa de estúdio fotográfico para máximo destaque ao apresentador.',
    backgroundType: 'white_studio',
    backgroundColor: '#FFFFFF',
    secondaryColor: '#F9FAFB',
    showVoxaLogoDefault: false,
    lightingStyle: 'High-Key Softbox 5600K',
    isOfficialPreset: false,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'cenario_estudio_broadcast',
    name: 'Estúdio Broadcast Pro',
    presetCode: 'STUDIO PRO',
    category: 'Estúdio',
    description: 'Estúdio acústico de gravação de conteúdo com profundidade suave e iluminação de recorte profissional.',
    backgroundType: 'newsroom',
    backgroundColor: '#F1F5F9',
    secondaryColor: '#CBD5E1',
    showVoxaLogoDefault: true,
    lightingStyle: 'Broadcast Key + Warm Rim',
    isOfficialPreset: false,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'cenario_escritorio_executivo',
    name: 'Escritório Executivo Moderno',
    presetCode: 'EXECUTIVE OFFICE',
    category: 'Escritório',
    description: 'Ambiente corporativo contemporâneo com arquitetura limpa, ideal para comunicados de negócios, finanças e tutoriais.',
    backgroundType: 'office',
    backgroundColor: '#E2E8F0',
    secondaryColor: '#94A3B8',
    showVoxaLogoDefault: true,
    lightingStyle: 'Natural Daylight + Key Light',
    isOfficialPreset: false,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'cenario_futurista_neural',
    name: 'Laboratório Futurista Horizonte',
    presetCode: 'FUTURISTIC LAB',
    category: 'Futurista',
    description: 'Arquitetura futurista iluminada por feixes sutis de luz ciano e vermelho VOXA, ideal para inovação e tecnologia.',
    backgroundType: 'futuristic',
    backgroundColor: '#0F172A',
    secondaryColor: '#1E293B',
    showVoxaLogoDefault: true,
    lightingStyle: 'Neon Rim + Volumetric Key',
    isOfficialPreset: false,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'voxa_dark_premium',
    name: 'Fundo Escuro • Dark Studio',
    presetCode: 'VOXA DARK STUDIO',
    category: 'Fundo escuro',
    description: 'Estúdio escuro sofisticado com luz de recorte vermelha VOXA (#FF0033) e contraste cinematográfico.',
    backgroundType: 'dark_studio',
    backgroundColor: '#09090B',
    secondaryColor: '#18181B',
    showVoxaLogoDefault: true,
    lightingStyle: 'Key Light Dramática + Rim Light Vermelho VOXA',
    isOfficialPreset: false,
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

export const PRESENTER_VOICES = [
  { id: 'voxa_female_studio_br', label: 'Aria Studio Neural (Feminina • Natural & Institucional)', gender: 'female' as const, geminiVoice: 'Kore', lang: 'pt-BR', pitch: 1.03, rate: 1.0, style: 'Institucional' },
  { id: 'voxa_female_viral_br', label: 'Luna Creator Neural (Feminina • Dinâmica Reels/TikTok)', gender: 'female' as const, geminiVoice: 'Zephyr', lang: 'pt-BR', pitch: 1.08, rate: 1.08, style: 'Viral / Social' },
  { id: 'voxa_male_exec_br', label: 'Marcus Executive Neural (Masculina • Sólida & Didática)', gender: 'male' as const, geminiVoice: 'Charon', lang: 'pt-BR', pitch: 0.94, rate: 1.0, style: 'Executivo' },
  { id: 'voxa_male_dynamic_br', label: 'Kai Impact Neural (Masculina • Comercial & Energética)', gender: 'male' as const, geminiVoice: 'Fenrir', lang: 'pt-BR', pitch: 0.98, rate: 1.06, style: 'Comercial' },
  { id: 'voxa_intl_en_us', label: 'Voxa Global Neural (Feminina • English US)', gender: 'female' as const, geminiVoice: 'Kore', lang: 'en-US', pitch: 1.02, rate: 1.0, style: 'Global' },
  { id: 'voxa_intl_es_es', label: 'Voxa Latam Neural (Masculina • Español)', gender: 'male' as const, geminiVoice: 'Puck', lang: 'es-ES', pitch: 1.0, rate: 1.02, style: 'Latam' }
];

export const PRESENTER_LANGUAGES = [
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'es-ES', label: 'Español (Latam / España)' }
];

export const PRESENTER_TONES = [
  'Institucional Premium',
  'Energético / Viral',
  'Tutorial Didático',
  'Anúncio Comercial',
  'Novidade da Plataforma',
  'Executivo & Confiável'
];

export const PRESENTER_CHANNELS: PresenterTargetChannel[] = [
  'Instagram',
  'TikTok',
  'YouTube Shorts',
  'Stories',
  'Campanhas',
  'Anúncios',
  'Tutoriais',
  'Novidades da plataforma'
];

const LOCAL_SETTINGS_KEY = 'voxa_studio_ia_settings_v2';
const LOCAL_LIBRARY_KEY = 'voxa_presenter_library_v1';
const LOCAL_AVATARS_KEY = 'voxa_presenter_custom_avatars_v1';
const LOCAL_SCENARIOS_KEY = 'voxa_presenter_custom_scenarios_v1';
const LOCAL_JOBS_KEY = 'voxa_ai_jobs_v1';
const LOCAL_CREDITS_KEY = 'voxa_ai_user_credits_v1';

// Estimate speaking duration from script text + speed
export function estimateSpeechDurationSeconds(script: string, speed = 1.0): number {
  const cleaned = (script || '').trim();
  if (!cleaned) return 0;
  const words = cleaned.split(/\s+/).filter(Boolean).length;
  // Average natural speaking rate in Portuguese is ~2.5 words/second
  const rawSec = words / (2.5 * Math.max(0.5, speed));
  return Math.max(3, Math.round(rawSec));
}

// Divide a script into coherent narrative segments when target duration > 10s (e.g., 10s + 10s + 10s + 10s for 40s)
export function splitScriptIntoContinuitySegments(
  script: string,
  targetDurationSeconds: number
): Array<{ segmentIndex: number; durationSec: number; text: string }> {
  const maxSegmentSec = 10;
  const segmentsCount = Math.max(1, Math.ceil(targetDurationSeconds / maxSegmentSec));
  const cleaned = (script || '').trim();

  if (segmentsCount === 1 || !cleaned) {
    return [{ segmentIndex: 0, durationSec: targetDurationSeconds, text: cleaned }];
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  const wordsPerSegment = Math.max(1, Math.ceil(words.length / segmentsCount));
  const segments: Array<{ segmentIndex: number; durationSec: number; text: string }> = [];
  let remainingSec: number = targetDurationSeconds;

  for (let i = 0; i < segmentsCount; i++) {
    const slice = words.slice(i * wordsPerSegment, (i + 1) * wordsPerSegment).join(' ');
    const segDur = i === segmentsCount - 1 ? remainingSec : Math.min(maxSegmentSec, remainingSec);
    remainingSec = Math.max(0, remainingSec - segDur);
    segments.push({
      segmentIndex: i,
      durationSec: segDur || maxSegmentSec,
      text: slice || cleaned
    });
  }

  return segments;
}

export function buildTimedCaptionsFromScript(
  script: string,
  targetDurationSec?: number
): {
  captions: CaptionSegment[];
  durationSeconds: number;
} {
  const cleaned = (script || '').trim();
  if (!cleaned) {
    return { captions: [], durationSeconds: targetDurationSec || 5 };
  }

  const rawSentences = cleaned
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?…;:])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const sentence of rawSentences) {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (words.length <= 8) {
      chunks.push(sentence);
    } else {
      for (let i = 0; i < words.length; i += 7) {
        chunks.push(words.slice(i, i + 7).join(' '));
      }
    }
  }

  const totalWords = cleaned.split(/\s+/).filter(Boolean).length;
  const effectiveTotalDuration = targetDurationSec || Math.max(5, Math.ceil(totalWords / 2.5));

  let cursor = 0;
  const captions: CaptionSegment[] = chunks.map((chunk, idx) => {
    const wordCount = chunk.split(/\s+/).length;
    const ratio = totalWords > 0 ? wordCount / totalWords : 1 / chunks.length;
    const segDuration =
      idx === chunks.length - 1
        ? Math.max(1.0, effectiveTotalDuration - cursor)
        : Math.max(1.2, Number((effectiveTotalDuration * ratio).toFixed(1)));
    const startSec = Number(cursor.toFixed(1));
    const endSec = Number(Math.min(effectiveTotalDuration, cursor + segDuration).toFixed(1));
    cursor = endSec;
    return {
      startSec,
      endSec: Math.max(startSec + 0.8, endSec),
      text: chunk
    };
  });

  return {
    captions,
    durationSeconds: effectiveTotalDuration
  };
}

export function calculatePresenterCost(
  script: string,
  aspectRatio: PresenterAspectRatio,
  generateCaptions: boolean,
  usdToBrlRate = 5.75,
  targetDurationSec: VideoDurationOption = 10
): {
  provider: string;
  model: string;
  endpoint: string;
  providerCost: number; // USD
  estimatedCostBRL: number; // BRL
  minimumSalePriceBRL: number;
  creditsCharged: number;
  marginPercent: number;
  durationSeconds: number;
  segmentsCount: number;
} {
  const durationSeconds = targetDurationSec || Math.max(5, estimateSpeechDurationSeconds(script));
  const segmentsCount = Math.max(1, Math.ceil(durationSeconds / 10));
  // Real provider cost calculation: R$ 0.10 per second of neural synthesis (so 10s = R$ 1.00, 20s = R$ 2.00, 40s = R$ 4.00)
  const costBRL = Number((durationSeconds * 0.10 + (generateCaptions ? 0.10 : 0)).toFixed(2));
  const providerCost = Number((costBRL / usdToBrlRate).toFixed(4));
  const pricing = computeCreditsWith75Margin(costBRL, 75, 0.10);

  return {
    provider: 'Google Gemini 3.8 TTS + Veo 3.1 + VOXA Neural Kinematic Engine',
    model: 'gemini-3.8-flash-lite-tts + veo-3.1-lite-generate-preview',
    endpoint: '/api/ai/talking-avatar',
    providerCost,
    estimatedCostBRL: pricing.costBRL,
    minimumSalePriceBRL: pricing.minimumSalePriceBRL,
    creditsCharged: pricing.creditsCharged,
    marginPercent: pricing.effectiveMarginPercent,
    durationSeconds,
    segmentsCount
  };
}

// ============================================================================
// USER VOXA AI CREDITS MANAGEMENT (voxa_ai_credits/{userUid})
// ============================================================================
export async function fetchUserAiCredits(userUid: string): Promise<number> {
  if (!userUid) return 0;
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDoc(doc(db, 'voxa_ai_credits', userUid));
      if (snap.exists()) {
        const bal = Number(snap.data()?.credits ?? 250);
        return bal;
      } else {
        // Initialize account with 250 welcome VOXA AI Credits so user can test immediately
        const initial = {
          userUid,
          credits: 250,
          totalPurchased: 250,
          totalSpent: 0,
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'voxa_ai_credits', userUid), initial);
        return 250;
      }
    } catch {}
  }
  try {
    const raw = localStorage.getItem(`${LOCAL_CREDITS_KEY}_${userUid}`);
    if (raw !== null) return Number(raw);
    localStorage.setItem(`${LOCAL_CREDITS_KEY}_${userUid}`, '250');
  } catch {}
  return 250;
}

export async function deductUserAiCredits(
  userUid: string,
  creditsToDeduct: number,
  reason: string
): Promise<{ success: boolean; remainingCredits: number; error?: string }> {
  const current = await fetchUserAiCredits(userUid);
  if (current < creditsToDeduct) {
    return {
      success: false,
      remainingCredits: current,
      error: `Saldo insuficiente de Créditos VOXA AI. Necessário: ${creditsToDeduct} créditos (Saldo atual: ${current} créditos).`
    };
  }
  const next = current - creditsToDeduct;
  try {
    localStorage.setItem(`${LOCAL_CREDITS_KEY}_${userUid}`, String(next));
  } catch {}

  if (isFirebaseConfigured() && userUid) {
    try {
      await setDoc(
        doc(db, 'voxa_ai_credits', userUid),
        {
          userUid,
          credits: next,
          lastReason: reason,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    } catch {}
  }
  return { success: true, remainingCredits: next };
}

export async function addUserAiCredits(userUid: string, amount: number): Promise<number> {
  const current = await fetchUserAiCredits(userUid);
  const next = current + Math.max(0, amount);
  try {
    localStorage.setItem(`${LOCAL_CREDITS_KEY}_${userUid}`, String(next));
  } catch {}
  if (isFirebaseConfigured() && userUid) {
    try {
      await setDoc(
        doc(db, 'voxa_ai_credits', userUid),
        {
          userUid,
          credits: next,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    } catch {}
  }
  return next;
}

// ============================================================================
// JOBS HISTORY & ASYNC TRACKING (voxa_ai_jobs/{jobId})
// ============================================================================
export async function fetchAiJobs(userUid?: string): Promise<VoxaAiJobRecord[]> {
  if (isFirebaseConfigured()) {
    try {
      const q = query(collection(db, 'voxa_ai_jobs'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list: VoxaAiJobRecord[] = [];
      snap.forEach((d) => list.push({ jobId: d.id, ...(d.data() as any) }));
      localStorage.setItem(LOCAL_JOBS_KEY, JSON.stringify(list));
      return userUid ? list.filter((j) => j.userUid === userUid) : list;
    } catch {}
  }
  try {
    const saved = localStorage.getItem(LOCAL_JOBS_KEY);
    if (saved) {
      const list: VoxaAiJobRecord[] = JSON.parse(saved);
      return userUid ? list.filter((j) => j.userUid === userUid) : list;
    }
  } catch {}
  return [];
}

export async function saveAiJob(job: VoxaAiJobRecord): Promise<VoxaAiJobRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_JOBS_KEY);
    const list: VoxaAiJobRecord[] = raw ? JSON.parse(raw) : [];
    const next = [job, ...list.filter((j) => j.jobId !== job.jobId)];
    localStorage.setItem(LOCAL_JOBS_KEY, JSON.stringify(next));
  } catch {}

  if (isFirebaseConfigured()) {
    try {
      await setDoc(doc(db, 'voxa_ai_jobs', job.jobId), job, { merge: true });
    } catch {}
  }
  return job;
}

// ============================================================================
// SETTINGS, LIBRARY, AVATARS & SCENARIOS
// ============================================================================
export async function fetchVoxaPresenterSettings(): Promise<VoxaPresenterSettings> {
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDoc(doc(db, 'voxa_ai_settings', 'global'));
      if (snap.exists()) {
        const data = snap.data() as Partial<VoxaPresenterSettings>;
        const publicEnabled =
          data.presenterPublicEnabled !== undefined ? Boolean(data.presenterPublicEnabled) : true;
        const merged: VoxaPresenterSettings = {
          ...DEFAULT_VOXA_PRESENTER_SETTINGS,
          ...data,
          presenterPublicEnabled: publicEnabled,
          mode: publicEnabled ? 'PÚBLICO' : 'INTERNO',
          availableToUsers: publicEnabled,
          toolsConfig: {
            ...DEFAULT_VOXA_AI_TOOLS_CONFIG,
            ...(data.toolsConfig || {})
          }
        };
        localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(merged));
        return merged;
      } else {
        await setDoc(doc(db, 'voxa_ai_settings', 'global'), DEFAULT_VOXA_PRESENTER_SETTINGS);
      }
    } catch {}
  }
  try {
    const saved = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_VOXA_PRESENTER_SETTINGS,
        ...parsed,
        toolsConfig: {
          ...DEFAULT_VOXA_AI_TOOLS_CONFIG,
          ...(parsed.toolsConfig || {})
        }
      };
    }
  } catch {}
  return DEFAULT_VOXA_PRESENTER_SETTINGS;
}

export async function updateVoxaPresenterSettings(
  partial: Partial<VoxaPresenterSettings>,
  updatedBy?: string
): Promise<VoxaPresenterSettings> {
  const current = await fetchVoxaPresenterSettings();
  const publicEnabled =
    partial.presenterPublicEnabled !== undefined
      ? Boolean(partial.presenterPublicEnabled)
      : current.presenterPublicEnabled;

  const updated: VoxaPresenterSettings = {
    ...current,
    ...partial,
    presenterPublicEnabled: publicEnabled,
    mode: publicEnabled ? 'PÚBLICO' : 'INTERNO',
    availableToUsers: publicEnabled,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || current.updatedBy || 'SUPER_ADMIN'
  };

  localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(updated));

  if (isFirebaseConfigured()) {
    try {
      await setDoc(doc(db, 'voxa_ai_settings', 'global'), updated, { merge: true });
    } catch {}
  }
  return updated;
}

export function subscribeToVoxaPresenterSettings(
  callback: (settings: VoxaPresenterSettings) => void
): () => void {
  if (!isFirebaseConfigured()) {
    fetchVoxaPresenterSettings().then(callback);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'voxa_ai_settings', 'global'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<VoxaPresenterSettings>;
        const publicEnabled =
          data.presenterPublicEnabled !== undefined ? Boolean(data.presenterPublicEnabled) : true;
        const merged: VoxaPresenterSettings = {
          ...DEFAULT_VOXA_PRESENTER_SETTINGS,
          ...data,
          presenterPublicEnabled: publicEnabled,
          mode: publicEnabled ? 'PÚBLICO' : 'INTERNO',
          availableToUsers: publicEnabled,
          toolsConfig: {
            ...DEFAULT_VOXA_AI_TOOLS_CONFIG,
            ...(data.toolsConfig || {})
          }
        };
        callback(merged);
      } else {
        callback(DEFAULT_VOXA_PRESENTER_SETTINGS);
      }
    },
    () => {
      fetchVoxaPresenterSettings().then(callback);
    }
  );
}

export async function fetchPresenterLibrary(): Promise<VoxaPresenterLibraryItem[]> {
  if (isFirebaseConfigured()) {
    try {
      const q = query(collection(db, 'voxa_presenter_library'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list: VoxaPresenterLibraryItem[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      localStorage.setItem(LOCAL_LIBRARY_KEY, JSON.stringify(list));
      return list;
    } catch {}
  }
  try {
    const saved = localStorage.getItem(LOCAL_LIBRARY_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

export async function savePresenterLibraryItem(
  item: VoxaPresenterLibraryItem
): Promise<VoxaPresenterLibraryItem> {
  const existing = await fetchPresenterLibrary();
  const next = [item, ...existing.filter((x) => x.id !== item.id)];
  localStorage.setItem(LOCAL_LIBRARY_KEY, JSON.stringify(next));

  if (isFirebaseConfigured()) {
    try {
      await setDoc(doc(db, 'voxa_presenter_library', item.id), item);
    } catch {}
  }
  return item;
}

export async function deletePresenterLibraryItem(id: string): Promise<void> {
  const existing = await fetchPresenterLibrary();
  const next = existing.filter((x) => x.id !== id);
  localStorage.setItem(LOCAL_LIBRARY_KEY, JSON.stringify(next));

  if (isFirebaseConfigured()) {
    try {
      await deleteDoc(doc(db, 'voxa_presenter_library', id));
    } catch {}
  }
}

export async function fetchCustomAvatars(): Promise<VoxaPresenterAvatar[]> {
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDocs(collection(db, 'voxa_presenter_avatars'));
      const custom: VoxaPresenterAvatar[] = [];
      snap.forEach((d) => custom.push({ id: d.id, ...(d.data() as any) }));
      localStorage.setItem(LOCAL_AVATARS_KEY, JSON.stringify(custom));
      return custom;
    } catch {}
  }
  try {
    const saved = localStorage.getItem(LOCAL_AVATARS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

export async function saveCustomAvatar(avatar: VoxaPresenterAvatar): Promise<VoxaPresenterAvatar> {
  const current = await fetchCustomAvatars();
  const next = [avatar, ...current.filter((a) => a.id !== avatar.id)];
  localStorage.setItem(LOCAL_AVATARS_KEY, JSON.stringify(next));

  if (isFirebaseConfigured()) {
    try {
      await setDoc(doc(db, 'voxa_presenter_avatars', avatar.id), avatar);
    } catch {}
  }
  return avatar;
}

export async function deleteCustomAvatar(avatarId: string): Promise<void> {
  const current = await fetchCustomAvatars();
  const next = current.filter((a) => a.id !== avatarId);
  localStorage.setItem(LOCAL_AVATARS_KEY, JSON.stringify(next));
  if (isFirebaseConfigured()) {
    try {
      await deleteDoc(doc(db, 'voxa_presenter_avatars', avatarId));
    } catch {}
  }
}

export async function fetchCustomScenarios(): Promise<VoxaPresenterScenario[]> {
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDocs(collection(db, 'voxa_presenter_scenarios'));
      const custom: VoxaPresenterScenario[] = [];
      snap.forEach((d) => custom.push({ id: d.id, ...(d.data() as any) }));
      localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(custom));
      return custom;
    } catch {}
  }
  try {
    const saved = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

export async function saveCustomScenario(scenario: VoxaPresenterScenario): Promise<VoxaPresenterScenario> {
  const current = await fetchCustomScenarios();
  const next = [scenario, ...current.filter((s) => s.id !== scenario.id)];
  localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(next));

  if (isFirebaseConfigured()) {
    try {
      await setDoc(doc(db, 'voxa_presenter_scenarios', scenario.id), scenario);
    } catch {}
  }
  return scenario;
}
