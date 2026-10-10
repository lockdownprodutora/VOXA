import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Video,
  UserCheck,
  Wand2,
  Image as ImageIcon,
  Film,
  Type,
  Megaphone,
  Layers,
  Library,
  FolderKanban,
  Play,
  Square,
  Download,
  Upload,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Coins,
  Volume2,
  Sliders,
  Captions,
  Share2,
  Eye,
  Cpu,
  Clock
} from 'lucide-react';
import {
  VoxaAiToolId,
  VoxaPresenterSettings,
  VoxaPresenterAvatar,
  VoxaPresenterScenario,
  VoxaPresenterLibraryItem,
  VoxaAiJobRecord,
  PresenterAspectRatio,
  PresenterTargetChannel,
  VideoDurationOption,
  CaptionStyleType,
  AvatarCharacterStyle,
  CaptionSegment,
  DEFAULT_VOXA_PRESENTER_SETTINGS,
  OFFICIAL_VOXA_AVATARS,
  OFFICIAL_VOXA_SCENARIOS,
  PRESENTER_VOICES,
  PRESENTER_LANGUAGES,
  PRESENTER_TONES,
  PRESENTER_CHANNELS,
  fetchVoxaPresenterSettings,
  subscribeToVoxaPresenterSettings,
  fetchPresenterLibrary,
  savePresenterLibraryItem,
  deletePresenterLibraryItem,
  fetchCustomAvatars,
  saveCustomAvatar,
  deleteCustomAvatar,
  fetchCustomScenarios,
  saveCustomScenario,
  fetchUserAiCredits,
  deductUserAiCredits,
  addUserAiCredits,
  fetchAiJobs,
  saveAiJob,
  buildTimedCaptionsFromScript,
  calculatePresenterCost,
  estimateSpeechDurationSeconds,
  splitScriptIntoContinuitySegments,
  computeCreditsWith75Margin
} from '../utils/voxaPresenterDb';
import { AnimatedTalkingAvatarCanvas, drawAnimatedAvatarFrame } from './AnimatedTalkingAvatarCanvas';
import { uploadFile } from '../utils/upload';
import { getGlobalCompanyLogo } from '../utils/company';
import { VoxaStudioIaDashboard } from './VoxaStudioIaDashboard';

interface VoxaStudioIaSectionProps {
  currentUser: any;
  triggerToast?: (msg: string) => void;
  onShareToFeed?: (mediaUrl: string, captionText: string) => void;
  onOpenAdminAi?: () => void;
  isAdmin?: boolean;
}

const STUDIO_TOOLS: Array<{
  id: VoxaAiToolId;
  label: string;
  shortDesc: string;
  badge: string;
  icon: any;
  statusMode: 'REAL_ACTIVE' | 'EM_PREPARACAO';
}> = [
  {
    id: 'avatar_falante',
    label: 'Avatar Falante',
    shortDesc: 'Avatar realmente animado com sincronização labial, voz neural, gestos e até 40s.',
    badge: 'ATÉ 40s • LIP-SYNC',
    icon: Video,
    statusMode: 'REAL_ACTIVE'
  },
  {
    id: 'criar_avatar',
    label: 'Criar Avatar',
    shortDesc: 'Crie seu personagem consistente por fotos ou prompt (Humano, Executivo, Influencer, Cyberpunk).',
    badge: 'CONSISTENTE',
    icon: UserCheck,
    statusMode: 'REAL_ACTIVE'
  },
  {
    id: 'motion_transfer',
    label: 'Motion Transfer',
    shortDesc: 'Transfira movimentos corporais, gestos e câmera de um vídeo de referência para o seu Avatar.',
    badge: 'MOTION IA',
    icon: Film,
    statusMode: 'REAL_ACTIVE'
  },
  {
    id: 'character_replace',
    label: 'Character Replace',
    shortDesc: 'Substitua o personagem de um vídeo autorizado pelo seu Avatar mantendo cena e iluminação.',
    badge: 'REPLACE IA',
    icon: Wand2,
    statusMode: 'REAL_ACTIVE'
  },
  {
    id: 'imagem_para_video',
    label: 'Imagem → Vídeo',
    shortDesc: 'Envie uma foto e gere movimento cinematográfico real com Google Veo 3.1.',
    badge: 'VEO 3.1',
    icon: Video,
    statusMode: 'REAL_ACTIVE'
  },
  {
    id: 'texto_para_video',
    label: 'Texto → Vídeo',
    shortDesc: 'Descreva uma cena e gere vídeos em alta definição 9:16 ou 16:9 com Veo 3.1.',
    badge: 'VEO 3.1',
    icon: Type,
    statusMode: 'REAL_ACTIVE'
  },
  {
    id: 'gerar_imagem',
    label: 'Gerar Imagem',
    shortDesc: 'Crie imagens em 1:1, 4:5, 9:16 e 16:9 com estilos fotográficos e editoriais.',
    badge: 'GEMINI IMAGE',
    icon: ImageIcon,
    statusMode: 'REAL_ACTIVE'
  },
  {
    id: 'editar_imagem',
    label: 'Editar Imagem',
    shortDesc: 'Trocar fundo, trocar roupa, remover/adicionar objetos, relighting e transformar estilo.',
    badge: 'EDITOR IA',
    icon: Sliders,
    statusMode: 'REAL_ACTIVE'
  },
  {
    id: 'criar_anuncio',
    label: 'Criar Anúncio',
    shortDesc: 'Envie produto e descrição para criar banners, stories, vídeos UGC e roteiros comerciais.',
    badge: 'ADS & UGC',
    icon: Megaphone,
    statusMode: 'REAL_ACTIVE'
  },
  {
    id: 'criar_cenario',
    label: 'Criar Cenário',
    shortDesc: 'Gere cenários de estúdio exclusivos por IA ou envie fundos personalizados (JPG/PNG/WEBP).',
    badge: 'CENÁRIOS',
    icon: Layers,
    statusMode: 'REAL_ACTIVE'
  },
  {
    id: 'biblioteca_ia',
    label: 'Biblioteca IA',
    shortDesc: 'Seus avatares, vídeos, imagens, áudios, cenários e anúncios salvos na nuvem VOXA.',
    badge: 'ACERVO',
    icon: Library,
    statusMode: 'REAL_ACTIVE'
  },
  {
    id: 'meus_projetos',
    label: 'Meus Projetos',
    shortDesc: 'Histórico de gerações (Job ID, provider, modelo, custo, créditos e status em tempo real).',
    badge: 'HISTÓRICO',
    icon: FolderKanban,
    statusMode: 'REAL_ACTIVE'
  }
];

export const VoxaStudioIaSection: React.FC<VoxaStudioIaSectionProps> = ({
  currentUser,
  triggerToast,
  onShareToFeed,
  onOpenAdminAi,
  isAdmin
}) => {
  const [activeTool, setActiveTool] = useState<VoxaAiToolId | null>(null);
  const [settings, setSettings] = useState<VoxaPresenterSettings>(DEFAULT_VOXA_PRESENTER_SETTINGS);
  const [userCredits, setUserCredits] = useState<number>(250);
  const [customAvatars, setCustomAvatars] = useState<VoxaPresenterAvatar[]>([]);
  const [customScenarios, setCustomScenarios] = useState<VoxaPresenterScenario[]>([]);
  const [libraryItems, setLibraryItems] = useState<VoxaPresenterLibraryItem[]>([]);
  const [jobsHistory, setJobsHistory] = useState<VoxaAiJobRecord[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Async Queue Progress Stage
  const [isProcessingJob, setIsProcessingJob] = useState(false);
  const [jobStageLabel, setJobStageLabel] = useState<'Preparando...' | 'Gerando...' | 'Processando...' | 'Finalizando...'>('Preparando...');
  const [jobProgressPercent, setJobProgressPercent] = useState(0);

  // =========================================================================
  // 1. AVATAR FALANTE (VOXA PRESENTER PÚBLICO) STATE
  // =========================================================================
  const [videoTitle, setVideoTitle] = useState('Apresentação Oficial • VOXA Studio IA');
  const [targetChannel, setTargetChannel] = useState<PresenterTargetChannel>('Instagram');
  const [aspectRatio, setAspectRatio] = useState<PresenterAspectRatio>('9:16');
  const [targetDurationSec, setTargetDurationSec] = useState<VideoDurationOption>(15);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(OFFICIAL_VOXA_AVATARS[0].id);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('voxa_official_studio');
  const [script, setScript] = useState<string>(
    'Olá! Bem-vindo ao novo VOXA Studio IA. Agora você pode criar avatares falantes com sincronização labial real, movimentos naturais de cabeça e corpo, cenários de estúdio e vídeos de até 40 segundos para suas redes sociais!'
  );
  const [voiceId, setVoiceId] = useState<string>(PRESENTER_VOICES[0].id);
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1.0);
  const [language, setLanguage] = useState<string>('pt-BR');
  const [tone, setTone] = useState<string>('Institucional Premium');
  const [showVoxaLogo, setShowVoxaLogo] = useState<boolean>(true);
  const [voxaWatermark, setVoxaWatermark] = useState<boolean>(true);
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState<string>('');
  const [generateCaptions, setGenerateCaptions] = useState<boolean>(true);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyleType>('Clean');
  const [captions, setCaptions] = useState<CaptionSegment[]>([]);

  // Playback & Output State for Talking Avatar
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewCurrentSec, setPreviewCurrentSec] = useState(0);
  const [lipSyncEnvelope, setLipSyncEnvelope] = useState<number[]>([]);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string>('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string>('');
  const [lastTelemetryProof, setLastTelemetryProof] = useState<any>(null);
  const [aiScriptTopic, setAiScriptTopic] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const companyLogo = getGlobalCompanyLogo();
  const userUid = currentUser?.uid || currentUser?.id || 'guest_voxa_user';

  useEffect(() => {
    let mounted = true;
    const loadAll = async () => {
      const [s, creds, avs, scens, lib, jobs] = await Promise.all([
        fetchVoxaPresenterSettings(),
        fetchUserAiCredits(userUid),
        fetchCustomAvatars(),
        fetchCustomScenarios(),
        fetchPresenterLibrary(),
        fetchAiJobs(userUid)
      ]);
      if (!mounted) return;
      setSettings(s);
      setUserCredits(creds);
      setCustomAvatars(avs);
      setCustomScenarios(scens);
      setLibraryItems(lib);
      setJobsHistory(jobs);
    };
    loadAll();

    const unsub = subscribeToVoxaPresenterSettings((live) => {
      if (mounted) setSettings(live);
    });

    return () => {
      mounted = false;
      unsub();
      if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, [userUid]);

  useEffect(() => {
    if (generateCaptions) {
      const { captions: built } = buildTimedCaptionsFromScript(script, targetDurationSec);
      setCaptions(built);
    } else {
      setCaptions([]);
    }
  }, [script, generateCaptions, targetDurationSec]);

  const notify = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    if (triggerToast && type === 'success') triggerToast(text);
    setTimeout(() => setFeedback(null), 5000);
  };

  const allAvatars: VoxaPresenterAvatar[] = [...OFFICIAL_VOXA_AVATARS, ...customAvatars];
  const allScenarios: VoxaPresenterScenario[] = [...OFFICIAL_VOXA_SCENARIOS, ...customScenarios];
  const activeAvatar = allAvatars.find((a) => a.id === selectedAvatarId) || OFFICIAL_VOXA_AVATARS[0];
  const activeScenario = allScenarios.find((s) => s.id === selectedScenarioId) || OFFICIAL_VOXA_SCENARIOS[0];
  const activeVoice = PRESENTER_VOICES.find((v) => v.id === voiceId) || PRESENTER_VOICES[0];

  const estimatedSpeechSec = estimateSpeechDurationSeconds(script, voiceSpeed);
  const continuitySegments = splitScriptIntoContinuitySegments(script, targetDurationSec);
  const presenterPricing = calculatePresenterCost(
    script,
    aspectRatio,
    generateCaptions,
    settings.usdToBrlRate,
    targetDurationSec
  );

  // =========================================================================
  // 2. CRIAR AVATAR STATE
  // =========================================================================
  const [newAvatarName, setNewAvatarName] = useState('');
  const [newAvatarRole, setNewAvatarRole] = useState('Creator & Apresentador');
  const [newAvatarStyle, setNewAvatarStyle] = useState<AvatarCharacterStyle>('Humano Realista');
  const [newAvatarPrompt, setNewAvatarPrompt] = useState(
    'Apresentador brasileiro carismático, olhar expressivo para a câmera, iluminação de estúdio profissional, retrato nítido de meio corpo.'
  );
  const [newAvatarRefPhotos, setNewAvatarRefPhotos] = useState<string[]>([]);
  const [generatedAvatarPreviewUrl, setGeneratedAvatarPreviewUrl] = useState<string>('');
  const [generatedAvatarSeed, setGeneratedAvatarSeed] = useState<number>(108420);

  // =========================================================================
  // 3. MOTION TRANSFER & CHARACTER REPLACE STATE
  // =========================================================================
  const [motionAvatarId, setMotionAvatarId] = useState<string>(OFFICIAL_VOXA_AVATARS[0].id);
  const [motionRefVideoUrl, setMotionRefVideoUrl] = useState<string>('');
  const [motionRefFrameDataUrl, setMotionRefFrameDataUrl] = useState<string>('');
  const [motionDescription, setMotionDescription] = useState<string>(
    'Movimento natural de apresentador gesticulando com as mãos, leve inclinação de cabeça e expressão confiante olhando para a câmera.'
  );
  const [motionConsentConfirmed, setMotionConsentConfirmed] = useState<boolean>(false);
  const [motionAspectRatio, setMotionAspectRatio] = useState<PresenterAspectRatio>('9:16');
  const [motionResultKeyframeUrl, setMotionResultKeyframeUrl] = useState<string>('');
  const [motionResultVideoUrl, setMotionResultVideoUrl] = useState<string>('');

  // =========================================================================
  // 4. IMAGEM -> VÍDEO & TEXTO -> VÍDEO (VEO 3.1) STATE
  // =========================================================================
  const [veoPrompt, setVeoPrompt] = useState<string>(
    'Cinematic studio shot of a modern digital creator presenting in a sleek futuristic lounge with soft volumetric lighting, natural body movement.'
  );
  const [veoInputImageUrl, setVeoInputImageUrl] = useState<string>('');
  const [veoAspectRatio, setVeoAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [veoResolution, setVeoResolution] = useState<'720p' | '1080p'>('720p');
  const [veoOutputVideoUrl, setVeoOutputVideoUrl] = useState<string>('');

  // =========================================================================
  // 5. GERAR IMAGEM & EDITAR IMAGEM STATE
  // =========================================================================
  const [imgGenPrompt, setImgGenPrompt] = useState<string>(
    'Retrato editorial hiper-realista em estúdio com iluminação dramática vermelha e branca estilo VOXA.'
  );
  const [imgGenStyle, setImgGenStyle] = useState<string>('Fotográfico Realista');
  const [imgGenRatio, setImgGenRatio] = useState<PresenterAspectRatio>('9:16');
  const [imgGenResultUrl, setImgGenResultUrl] = useState<string>('');

  const [editSourceImageUrl, setEditSourceImageUrl] = useState<string>('');
  const [editOperation, setEditOperation] = useState<string>('Trocar fundo');
  const [editPrompt, setEditPrompt] = useState<string>('Colocar em um estúdio executivo moderno com iluminação suave');
  const [editResultUrl, setEditResultUrl] = useState<string>('');

  // =========================================================================
  // 6. CRIAR ANÚNCIO & CRIAR CENÁRIO STATE
  // =========================================================================
  const [adProductName, setAdProductName] = useState<string>('');
  const [adProductDesc, setAdProductDesc] = useState<string>('');
  const [adFormat, setAdFormat] = useState<string>('Vídeo Curto / Reels UGC');
  const [adProductImageUrl, setAdProductImageUrl] = useState<string>('');
  const [adResultCopy, setAdResultCopy] = useState<string>('');
  const [adResultBannerUrl, setAdResultBannerUrl] = useState<string>('');

  const [scenarioName, setScenarioName] = useState<string>('');
  const [scenarioCategory, setScenarioCategory] = useState<VoxaPresenterScenario['category']>('Cenário VOXA');
  const [scenarioPrompt, setScenarioPrompt] = useState<string>(
    'Cenário de estúdio broadcast clean em branco e detalhes sutis em vermelho e preto, arquitetura minimalista premium, sem pessoas.'
  );
  const [scenarioGeneratedUrl, setScenarioGeneratedUrl] = useState<string>('');

  // Library Filter
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'video' | 'image' | 'avatar' | 'scenario' | 'ad'>('all');

  // Helper: Poll Veo 3.1 operation until completion and download MP4 blob
  const pollAndDownloadVeoVideo = async (operationName: string): Promise<string> => {
    for (let attempt = 0; attempt < 36; attempt++) {
      await new Promise((r) => setTimeout(r, 5000));
      setJobStageLabel(attempt < 10 ? 'Gerando...' : 'Processando...');
      setJobProgressPercent(Math.min(92, 25 + attempt * 2));

      const statusRes = await fetch('/api/ai/video/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationName })
      });
      const statusData = await statusRes.json();
      if (statusData.done) {
        if (statusData.error) {
          throw new Error(statusData.error);
        }
        setJobStageLabel('Finalizando...');
        setJobProgressPercent(96);
        const dlRes = await fetch('/api/ai/video/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationName })
        });
        if (!dlRes.ok) {
          throw new Error('Falha ao transferir arquivo MP4 do servidor.');
        }
        const blob = await dlRes.blob();
        return URL.createObjectURL(blob);
      }
    }
    throw new Error('Tempo limite de renderização excedido.');
  };

  // Helper: Record animated canvas + real neural WAV audio into downloadable WebM video
  const recordAnimatedTalkingVideoWithAudio = async (
    audioDataUrl: string,
    envelope: number[],
    durationToRecordSec: number
  ): Promise<string> => {
    const dims =
      aspectRatio === '9:16'
        ? { width: 540, height: 960 }
        : aspectRatio === '1:1'
        ? { width: 720, height: 720 }
        : aspectRatio === '4:5'
        ? { width: 640, height: 800 }
        : { width: 960, height: 540 };

    const offscreen = document.createElement('canvas');
    offscreen.width = dims.width;
    offscreen.height = dims.height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível.');

    const loadImg = (url?: string): Promise<HTMLImageElement | null> =>
      new Promise((resolve) => {
        if (!url) return resolve(null);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      });

    const [avatarImg, bgImg, logoImg] = await Promise.all([
      loadImg(activeAvatar.avatarUrl),
      loadImg(customBackgroundUrl || activeScenario.backgroundImageUrl),
      loadImg(companyLogo)
    ]);

    const stream = offscreen.captureStream(30);

    // Attach real generated neural WAV audio stream to MediaRecorder if available
    let audioCtx: AudioContext | null = null;
    let audioSource: AudioBufferSourceNode | null = null;
    if (audioDataUrl) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioContextClass();
        const resp = await fetch(audioDataUrl);
        const arrayBuf = await resp.arrayBuffer();
        const decodedAudio = await audioCtx.decodeAudioData(arrayBuf);
        const dest = audioCtx.createMediaStreamDestination();
        audioSource = audioCtx.createBufferSource();
        audioSource.buffer = decodedAudio;
        audioSource.playbackRate.value = voiceSpeed;
        audioSource.connect(dest);
        audioSource.connect(audioCtx.destination);
        dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      } catch (e) {
        console.warn('[VOXA Studio Audio Mux note]:', e);
      }
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 3200000
    });

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    const finishedPromise = new Promise<string>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        resolve(URL.createObjectURL(blob));
      };
    });

    recorder.start(200);
    if (audioSource) {
      try {
        audioSource.start(0);
      } catch {}
    }

    const fps = 30;
    const clampedSec = Math.min(40, Math.max(5, durationToRecordSec));
    const totalFrames = Math.ceil(clampedSec * fps);

    for (let f = 0; f <= totalFrames; f++) {
      const elapsedSec = f / fps;
      drawAnimatedAvatarFrame(ctx, offscreen.width, offscreen.height, elapsedSec, {
        avatar: activeAvatar,
        scenario: activeScenario,
        avatarImg,
        bgImg,
        logoImg,
        showVoxaLogo,
        voxaWatermark,
        captions,
        captionStyle,
        generateCaptions,
        isPlaying: true,
        lipSyncEnvelope: envelope
      });

      const pct = Math.min(98, Math.round(35 + (f / totalFrames) * 63));
      setJobProgressPercent(pct);
      if (f > totalFrames * 0.75) setJobStageLabel('Finalizando...');
      await new Promise((r) => setTimeout(r, 1000 / fps));
    }

    recorder.stop();
    if (audioSource) {
      try {
        audioSource.stop();
      } catch {}
    }
    if (audioCtx) {
      try {
        await audioCtx.close();
      } catch {}
    }

    return finishedPromise;
  };

  // =========================================================================
  // HANDLER: GENERATE REAL ANIMATED TALKING AVATAR VIDEO (UP TO 40s)
  // =========================================================================
  const handleGenerateTalkingAvatarVideo = async () => {
    if (!script.trim()) {
      notify('error', 'Digite um roteiro para o Avatar Falante.');
      return;
    }

    const creditsRequired = presenterPricing.creditsCharged;
    const deductRes = await deductUserAiCredits(
      userUid,
      creditsRequired,
      `Avatar Falante (${targetDurationSec}s • ${aspectRatio})`
    );
    if (!deductRes.success) {
      notify('error', deductRes.error || 'Saldo de créditos insuficiente.');
      return;
    }
    setUserCredits(deductRes.remainingCredits);

    const jobId = `job_avatar_${Date.now()}`;
    setIsProcessingJob(true);
    setJobStageLabel('Preparando...');
    setJobProgressPercent(10);

    try {
      setJobStageLabel('Gerando...');
      setJobProgressPercent(22);

      const response = await fetch('/api/ai/talking-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          voiceName: activeVoice.geminiVoice,
          gender: activeVoice.gender,
          tone,
          language,
          targetDurationSec,
          avatarImage: activeAvatar.avatarUrl,
          aspectRatio
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro na síntese neural do Avatar Falante.');
      }

      setGeneratedAudioUrl(data.audioUrl || '');
      setLipSyncEnvelope(data.lipSyncEnvelope || []);
      setLastTelemetryProof(data.telemetryProof || null);

      setJobStageLabel('Processando...');
      setJobProgressPercent(35);

      const effectiveDuration = Math.min(40, Math.max(5, Number(targetDurationSec)));
      const videoBlobUrl = await recordAnimatedTalkingVideoWithAudio(
        data.audioUrl || '',
        data.lipSyncEnvelope || [],
        effectiveDuration
      );

      setGeneratedVideoUrl(videoBlobUrl);

      const newItem: VoxaPresenterLibraryItem = {
        id: `voxa_vid_${Date.now()}`,
        jobId,
        userUid,
        itemCategory: 'video',
        title: videoTitle.trim() || `Avatar Falante • ${activeAvatar.name}`,
        targetChannel,
        aspectRatio,
        avatarId: activeAvatar.id,
        avatarName: activeAvatar.name,
        avatarUrl: activeAvatar.avatarUrl,
        script,
        voiceId: activeVoice.id,
        voiceName: activeVoice.label,
        voiceGender: activeVoice.gender,
        voiceSpeed,
        voiceStyle: activeVoice.style,
        language,
        tone,
        scenarioId: activeScenario.id,
        scenarioName: activeScenario.name,
        presetUsed: activeScenario.presetCode,
        showVoxaLogo,
        voxaAiWatermark: voxaWatermark,
        backgroundImageUrl: customBackgroundUrl || activeScenario.backgroundImageUrl,
        generateCaptions,
        captionStyle,
        captions,
        videoUrl: videoBlobUrl,
        audioUrl: data.audioUrl || '',
        durationSeconds: effectiveDuration,
        segmentsComposed: data.segmentsComposed || continuitySegments.length,
        provider: data.telemetryProof?.provider || presenterPricing.provider,
        model: data.telemetryProof?.ttsModel || presenterPricing.model,
        endpoint: '/api/ai/talking-avatar',
        providerCost: presenterPricing.providerCost,
        estimatedCostBRL: presenterPricing.estimatedCostBRL,
        creditsCharged: creditsRequired,
        referenceImageSent: true,
        realLipSync: true,
        motionGeneration: true,
        createdAt: new Date().toISOString(),
        createdByUid: userUid,
        createdByName: currentUser?.name || 'Criador VOXA'
      };

      const saved = await savePresenterLibraryItem(newItem);
      setLibraryItems((prev) => [saved, ...prev]);

      const jobRec: VoxaAiJobRecord = {
        jobId,
        userUid,
        userName: currentUser?.name || 'Criador VOXA',
        tool: 'avatar_falante',
        toolLabel: 'Avatar Falante (VOXA Presenter)',
        provider: presenterPricing.provider,
        model: presenterPricing.model,
        endpoint: '/api/ai/talking-avatar',
        cost: presenterPricing.estimatedCostBRL,
        providerCostUSD: presenterPricing.providerCost,
        creditsCharged: creditsRequired,
        salePriceBRL: presenterPricing.minimumSalePriceBRL,
        marginPercent: presenterPricing.marginPercent,
        status: 'COMPLETED',
        stageLabel: 'Concluído',
        durationSeconds: effectiveDuration,
        segmentsCount: data.segmentsComposed || continuitySegments.length,
        aspectRatio,
        referenceImageSent: true,
        audioVoiceGenerated: Boolean(data.audioUrl),
        realLipSync: true,
        motionGeneration: true,
        aiMetadata: {
          generatedBy: 'VOXA Studio IA',
          watermarkText: 'Criado com VOXA AI',
          AvatarId: activeAvatar.id,
          continuitySeed: activeAvatar.seed || 104829
        },
        inputSummary: `${activeAvatar.name} • ${effectiveDuration}s (${continuitySegments.length} seg) • ${aspectRatio}`,
        outputUrl: videoBlobUrl,
        audioUrl: data.audioUrl || '',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };
      await saveAiJob(jobRec);
      setJobsHistory((prev) => [jobRec, ...prev]);

      notify('success', `Vídeo animado (${effectiveDuration}s) com lip-sync e voz neural gerado com sucesso!`);
    } catch (err: any) {
      await addUserAiCredits(userUid, creditsRequired);
      setUserCredits((c) => c + creditsRequired);
      notify('error', err.message || 'Falha ao gerar vídeo do Avatar Falante.');
    } finally {
      setIsProcessingJob(false);
      setJobProgressPercent(0);
    }
  };

  // Toggle Live Preview with Neural Audio or Speech Synthesis
  const handleTogglePreview = () => {
    if (isPreviewPlaying) {
      setIsPreviewPlaying(false);
      setPreviewCurrentSec(0);
      if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      return;
    }

    setIsPreviewPlaying(true);
    setPreviewCurrentSec(0);

    if (generatedAudioUrl) {
      const audio = new Audio(generatedAudioUrl);
      audio.playbackRate = voiceSpeed;
      audioPlayerRef.current = audio;
      audio.play().catch(() => {});
    } else if ('speechSynthesis' in window && script.trim()) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(script);
      utter.lang = language;
      utter.rate = voiceSpeed;
      window.speechSynthesis.speak(utter);
    }

    const startMs = Date.now();
    const totalDur = targetDurationSec;
    previewTimerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startMs) / 1000;
      if (elapsed >= totalDur) {
        setIsPreviewPlaying(false);
        setPreviewCurrentSec(0);
        if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
      } else {
        setPreviewCurrentSec(Number(elapsed.toFixed(1)));
      }
    }, 80);
  };

  // AI Script Generator
  const handleGenerateAiScript = async () => {
    if (!aiScriptTopic.trim()) {
      notify('error', 'Informe o tema para a IA criar o roteiro.');
      return;
    }
    setIsGeneratingScript(true);
    try {
      const res = await fetch('/api/admin/voxa-ai/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: `${aiScriptTopic} (Duração alvo: ${targetDurationSec} segundos)`,
          targetChannel,
          tone,
          language
        })
      });
      const data = await res.json();
      if (data.script) {
        setScript(data.script);
        notify('success', 'Roteiro otimizado gerado com IA!');
      }
    } catch {
      notify('error', 'Erro ao gerar roteiro automático.');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // =========================================================================
  // HANDLER: CRIAR AVATAR CONSISTENTE
  // =========================================================================
  const handleCreateConsistentAvatar = async () => {
    if (!newAvatarName.trim() || !newAvatarPrompt.trim()) {
      notify('error', 'Preencha o nome e a descrição do Avatar.');
      return;
    }
    const toolCfg = settings.toolsConfig?.criar_avatar;
    const creditsCost = toolCfg?.creditsCharged || 20;
    const deduct = await deductUserAiCredits(userUid, creditsCost, `Criar Avatar: ${newAvatarName}`);
    if (!deduct.success) {
      notify('error', deduct.error || 'Saldo insuficiente.');
      return;
    }
    setUserCredits(deduct.remainingCredits);

    setIsProcessingJob(true);
    setJobStageLabel('Gerando...');
    setJobProgressPercent(35);

    try {
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Consistent studio character portrait of ${newAvatarName} (${newAvatarRole}). ${newAvatarPrompt}. Facing camera, symmetrical neutral-friendly expression ready for facial animation and lip-sync.`,
          style: newAvatarStyle,
          aspectRatio: '1:1',
          referenceImage: newAvatarRefPhotos[0] || undefined
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao gerar Avatar.');

      setGeneratedAvatarPreviewUrl(data.imageUrl);
      setGeneratedAvatarSeed(data.seed || 108420);

      const newAv: VoxaPresenterAvatar = {
        id: `avatar_user_${Date.now()}`,
        avatarId: `avatar_user_${Date.now()}`,
        userUid,
        name: newAvatarName.trim(),
        roleTitle: newAvatarRole.trim() || newAvatarStyle,
        description: newAvatarPrompt.trim(),
        characterDescription: newAvatarPrompt.trim(),
        style: newAvatarStyle,
        avatarUrl: data.imageUrl,
        referenceImages: [data.imageUrl, ...newAvatarRefPhotos],
        seed: data.seed || 108420,
        referenceMetadata: {
          provider: data.provider,
          model: data.model,
          consistencyLock: true,
          facialRigVersion: 'v2.4-kinematic'
        },
        isOfficial: false,
        isSavedCharacter: true,
        defaultVoiceId: PRESENTER_VOICES[0].id,
        defaultLanguage: 'pt-BR',
        defaultTone: 'Institucional Premium',
        accentColor: '#FF0033',
        createdAt: new Date().toISOString()
      };

      await saveCustomAvatar(newAv);
      setCustomAvatars((prev) => [newAv, ...prev]);
      setSelectedAvatarId(newAv.id);
      setMotionAvatarId(newAv.id);

      await saveAiJob({
        jobId: `job_create_avatar_${Date.now()}`,
        userUid,
        userName: currentUser?.name || 'Criador VOXA',
        tool: 'criar_avatar',
        toolLabel: 'Criar Avatar Consistente',
        provider: data.provider,
        model: data.model,
        endpoint: '/api/ai/generate-image',
        cost: 0.50,
        providerCostUSD: 0.087,
        creditsCharged: creditsCost,
        salePriceBRL: creditsCost * 0.10,
        marginPercent: 75,
        status: 'COMPLETED',
        stageLabel: 'Concluído',
        referenceImageSent: newAvatarRefPhotos.length > 0,
        outputUrl: data.imageUrl,
        inputSummary: `${newAv.name} (${newAvatarStyle}) • Seed #${newAv.seed}`,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      });

      notify('success', `Avatar "${newAv.name}" criado e salvo com consistência (Seed #${newAv.seed})!`);
    } catch (err: any) {
      await addUserAiCredits(userUid, creditsCost);
      setUserCredits((c) => c + creditsCost);
      notify('error', err.message || 'Erro ao criar avatar.');
    } finally {
      setIsProcessingJob(false);
      setJobProgressPercent(0);
    }
  };

  // =========================================================================
  // HANDLER: MOTION TRANSFER & CHARACTER REPLACE
  // =========================================================================
  const handleReferenceVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const tempUrl = URL.createObjectURL(file);
    setMotionRefVideoUrl(tempUrl);

    // Extract a representative keyframe from the uploaded video for pose & lighting conditioning
    const vid = document.createElement('video');
    vid.src = tempUrl;
    vid.muted = true;
    vid.playsInline = true;
    vid.onloadeddata = () => {
      vid.currentTime = Math.min(1.0, (vid.duration || 2) * 0.25);
    };
    vid.onseeked = () => {
      const c = document.createElement('canvas');
      c.width = Math.min(640, vid.videoWidth || 540);
      c.height = Math.min(640, vid.videoHeight || 960);
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(vid, 0, 0, c.width, c.height);
        setMotionRefFrameDataUrl(c.toDataURL('image/jpeg', 0.85));
      }
    };
  };

  const handleRunMotionOrReplace = async (mode: 'motion_transfer' | 'character_replace') => {
    if (!motionConsentConfirmed) {
      notify('error', 'Confirme a autorização de direitos e uso responsável antes de prosseguir.');
      return;
    }
    const targetAv = allAvatars.find((a) => a.id === motionAvatarId) || OFFICIAL_VOXA_AVATARS[0];
    const creditsCost = 100; // R$ 2.50 cost -> R$ 10.00 sale (75% margin) -> 100 credits
    const deduct = await deductUserAiCredits(userUid, creditsCost, `${mode}: ${targetAv.name}`);
    if (!deduct.success) {
      notify('error', deduct.error || 'Saldo insuficiente.');
      return;
    }
    setUserCredits(deduct.remainingCredits);

    setIsProcessingJob(true);
    setJobStageLabel('Preparando...');
    setJobProgressPercent(15);

    try {
      const res = await fetch('/api/ai/motion-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          avatarImage: targetAv.avatarUrl,
          avatarName: targetAv.name,
          referenceFrameImage: motionRefFrameDataUrl || undefined,
          motionDescription,
          consentConfirmed: motionConsentConfirmed,
          aspectRatio: motionAspectRatio
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro no processamento.');

      if (data.synthesizedKeyframeUrl) {
        setMotionResultKeyframeUrl(data.synthesizedKeyframeUrl);
      }

      let finalVideoUrl = '';
      if (data.operationName) {
        finalVideoUrl = await pollAndDownloadVeoVideo(data.operationName);
        setMotionResultVideoUrl(finalVideoUrl);
      }

      const libItem: VoxaPresenterLibraryItem = {
        id: `voxa_${mode}_${Date.now()}`,
        userUid,
        itemCategory: 'video',
        title: `${mode === 'character_replace' ? 'Character Replace' : 'Motion Transfer'} • ${targetAv.name}`,
        targetChannel: 'Instagram',
        aspectRatio: motionAspectRatio,
        avatarId: targetAv.id,
        avatarName: targetAv.name,
        avatarUrl: targetAv.avatarUrl,
        script: motionDescription,
        voiceId: targetAv.defaultVoiceId,
        voiceName: 'Motion Sync',
        language: 'pt-BR',
        tone: 'Motion Transfer',
        scenarioId: 'voxa_official_studio',
        scenarioName: 'Cena do Vídeo de Referência',
        presetUsed: mode.toUpperCase(),
        showVoxaLogo: true,
        voxaAiWatermark: true,
        generateCaptions: false,
        captions: [],
        videoUrl: finalVideoUrl,
        imageUrl: data.synthesizedKeyframeUrl,
        durationSeconds: 8,
        provider: data.provider,
        model: data.model,
        endpoint: '/api/ai/motion-transfer',
        providerCost: 0.43,
        estimatedCostBRL: 2.50,
        creditsCharged: creditsCost,
        referenceImageSent: true,
        motionGeneration: true,
        createdAt: new Date().toISOString(),
        createdByUid: userUid,
        createdByName: currentUser?.name || 'Criador VOXA'
      };
      await savePresenterLibraryItem(libItem);
      setLibraryItems((prev) => [libItem, ...prev]);

      notify('success', `${mode === 'character_replace' ? 'Character Replace' : 'Motion Transfer'} concluído com sucesso!`);
    } catch (err: any) {
      await addUserAiCredits(userUid, creditsCost);
      setUserCredits((c) => c + creditsCost);
      notify('error', err.message || 'Erro ao processar transferência de movimento.');
    } finally {
      setIsProcessingJob(false);
      setJobProgressPercent(0);
    }
  };

  // =========================================================================
  // HANDLER: IMAGEM -> VÍDEO & TEXTO -> VÍDEO (VEO 3.1)
  // =========================================================================
  const handleRunVeoGeneration = async (isImageToVideo: boolean) => {
    if (isImageToVideo && !veoInputImageUrl) {
      notify('error', 'Envie uma imagem base para animar em vídeo.');
      return;
    }
    if (!veoPrompt.trim()) {
      notify('error', 'Descreva o movimento ou a cena desejada.');
      return;
    }

    const creditsCost = 80; // R$ 2.00 cost -> R$ 8.00 sale -> 80 credits
    const deduct = await deductUserAiCredits(
      userUid,
      creditsCost,
      isImageToVideo ? 'Imagem → Vídeo (Veo 3.1)' : 'Texto → Vídeo (Veo 3.1)'
    );
    if (!deduct.success) {
      notify('error', deduct.error || 'Saldo insuficiente.');
      return;
    }
    setUserCredits(deduct.remainingCredits);

    setIsProcessingJob(true);
    setJobStageLabel('Preparando...');
    setJobProgressPercent(15);

    try {
      const startRes = await fetch('/api/ai/video/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: veoPrompt,
          image: isImageToVideo ? veoInputImageUrl : undefined,
          aspectRatio: veoAspectRatio,
          resolution: veoResolution
        })
      });
      const startData = await startRes.json();
      if (!startRes.ok || !startData.success || !startData.operationName) {
        throw new Error(startData.error || 'Falha ao iniciar geração no Google Veo 3.1.');
      }

      const mp4Url = await pollAndDownloadVeoVideo(startData.operationName);
      setVeoOutputVideoUrl(mp4Url);

      const newItem: VoxaPresenterLibraryItem = {
        id: `voxa_veo_${Date.now()}`,
        userUid,
        itemCategory: 'video',
        title: `${isImageToVideo ? 'Imagem → Vídeo' : 'Texto → Vídeo'} • Veo 3.1`,
        targetChannel: 'Instagram',
        aspectRatio: veoAspectRatio,
        avatarId: 'veo_cinematic',
        avatarName: 'Veo 3.1 Neural Video',
        avatarUrl: veoInputImageUrl || OFFICIAL_VOXA_AVATARS[0].avatarUrl,
        script: veoPrompt,
        voiceId: 'none',
        voiceName: 'Cinematic',
        language: 'pt-BR',
        tone: 'Cinematográfico',
        scenarioId: 'voxa_official_studio',
        scenarioName: 'Veo 3.1',
        presetUsed: 'VEO 3.1',
        showVoxaLogo: true,
        voxaAiWatermark: true,
        generateCaptions: false,
        captions: [],
        videoUrl: mp4Url,
        durationSeconds: 8,
        provider: startData.provider,
        model: startData.model,
        endpoint: '/api/ai/video/start',
        providerCost: 0.35,
        estimatedCostBRL: 2.00,
        creditsCharged: creditsCost,
        referenceImageSent: isImageToVideo,
        motionGeneration: true,
        createdAt: new Date().toISOString(),
        createdByUid: userUid,
        createdByName: currentUser?.name || 'Criador VOXA'
      };
      await savePresenterLibraryItem(newItem);
      setLibraryItems((prev) => [newItem, ...prev]);

      notify('success', 'Vídeo Veo 3.1 gerado e salvo na Biblioteca IA!');
    } catch (err: any) {
      await addUserAiCredits(userUid, creditsCost);
      setUserCredits((c) => c + creditsCost);
      notify('error', err.message || 'Erro ao gerar vídeo no Veo 3.1.');
    } finally {
      setIsProcessingJob(false);
      setJobProgressPercent(0);
    }
  };

  // =========================================================================
  // HANDLER: GERAR IMAGEM & EDITAR IMAGEM
  // =========================================================================
  const handleGenerateImage = async () => {
    if (!imgGenPrompt.trim()) {
      notify('error', 'Digite um prompt para gerar a imagem.');
      return;
    }
    const creditsCost = 16;
    const deduct = await deductUserAiCredits(userUid, creditsCost, 'Gerar Imagem IA');
    if (!deduct.success) {
      notify('error', deduct.error || 'Saldo insuficiente.');
      return;
    }
    setUserCredits(deduct.remainingCredits);
    setIsProcessingJob(true);
    setJobStageLabel('Gerando...');
    setJobProgressPercent(45);

    try {
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imgGenPrompt,
          style: imgGenStyle,
          aspectRatio: imgGenRatio
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao gerar imagem.');

      setImgGenResultUrl(data.imageUrl);
      const item: VoxaPresenterLibraryItem = {
        id: `voxa_img_${Date.now()}`,
        userUid,
        itemCategory: 'image',
        title: imgGenPrompt.slice(0, 48),
        targetChannel: 'Instagram',
        aspectRatio: imgGenRatio,
        avatarId: 'gemini_image',
        avatarName: imgGenStyle,
        avatarUrl: data.imageUrl,
        script: imgGenPrompt,
        voiceId: 'none',
        voiceName: 'Image',
        language: 'pt-BR',
        tone: imgGenStyle,
        scenarioId: 'voxa_official_studio',
        scenarioName: imgGenStyle,
        presetUsed: 'GEMINI IMAGE',
        showVoxaLogo: true,
        voxaAiWatermark: true,
        generateCaptions: false,
        captions: [],
        imageUrl: data.imageUrl,
        durationSeconds: 0,
        provider: data.provider,
        model: data.model,
        endpoint: '/api/ai/generate-image',
        providerCost: 0.07,
        estimatedCostBRL: 0.40,
        creditsCharged: creditsCost,
        createdAt: new Date().toISOString(),
        createdByUid: userUid,
        createdByName: currentUser?.name || 'Criador VOXA'
      };
      await savePresenterLibraryItem(item);
      setLibraryItems((prev) => [item, ...prev]);
      notify('success', 'Imagem gerada com sucesso!');
    } catch (err: any) {
      await addUserAiCredits(userUid, creditsCost);
      setUserCredits((c) => c + creditsCost);
      notify('error', err.message || 'Falha ao gerar imagem.');
    } finally {
      setIsProcessingJob(false);
      setJobProgressPercent(0);
    }
  };

  const handleEditImage = async () => {
    if (!editSourceImageUrl) {
      notify('error', 'Envie uma imagem para editar.');
      return;
    }
    const creditsCost = 18;
    const deduct = await deductUserAiCredits(userUid, creditsCost, `Editar Imagem (${editOperation})`);
    if (!deduct.success) {
      notify('error', deduct.error || 'Saldo insuficiente.');
      return;
    }
    setUserCredits(deduct.remainingCredits);
    setIsProcessingJob(true);
    setJobStageLabel('Processando...');
    setJobProgressPercent(50);

    try {
      const res = await fetch('/api/ai/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: editSourceImageUrl,
          editOperation,
          prompt: editPrompt
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao editar imagem.');
      setEditResultUrl(data.imageUrl);
      notify('success', `Edição "${editOperation}" concluída!`);
    } catch (err: any) {
      await addUserAiCredits(userUid, creditsCost);
      setUserCredits((c) => c + creditsCost);
      notify('error', err.message || 'Erro ao editar imagem.');
    } finally {
      setIsProcessingJob(false);
      setJobProgressPercent(0);
    }
  };

  // =========================================================================
  // HANDLER: CRIAR ANÚNCIO & CRIAR CENÁRIO
  // =========================================================================
  const handleCreateAd = async () => {
    if (!adProductName.trim()) {
      notify('error', 'Informe o nome do produto ou campanha.');
      return;
    }
    const creditsCost = 30;
    const deduct = await deductUserAiCredits(userUid, creditsCost, `Criar Anúncio: ${adProductName}`);
    if (!deduct.success) {
      notify('error', deduct.error || 'Saldo insuficiente.');
      return;
    }
    setUserCredits(deduct.remainingCredits);
    setIsProcessingJob(true);
    setJobStageLabel('Gerando...');
    setJobProgressPercent(45);

    try {
      const res = await fetch('/api/ai/create-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: adProductName,
          productDescription: adProductDesc,
          adFormat,
          aspectRatio: '9:16',
          productImage: adProductImageUrl || undefined
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao gerar anúncio.');
      setAdResultCopy(data.adCopy || '');
      setAdResultBannerUrl(data.adBannerUrl || '');
      notify('success', 'Criativo e roteiro comercial gerados com sucesso!');
    } catch (err: any) {
      await addUserAiCredits(userUid, creditsCost);
      setUserCredits((c) => c + creditsCost);
      notify('error', err.message || 'Erro ao criar anúncio.');
    } finally {
      setIsProcessingJob(false);
      setJobProgressPercent(0);
    }
  };

  const handleGenerateScenario = async () => {
    if (!scenarioName.trim() || !scenarioPrompt.trim()) {
      notify('error', 'Informe o nome e a descrição do cenário.');
      return;
    }
    const creditsCost = 16;
    const deduct = await deductUserAiCredits(userUid, creditsCost, `Criar Cenário: ${scenarioName}`);
    if (!deduct.success) {
      notify('error', deduct.error || 'Saldo insuficiente.');
      return;
    }
    setUserCredits(deduct.remainingCredits);
    setIsProcessingJob(true);
    setJobStageLabel('Gerando...');
    setJobProgressPercent(40);

    try {
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Empty television/social media studio background backdrop (NO people): ${scenarioPrompt}. Category: ${scenarioCategory}. Professional architectural lighting.`,
          aspectRatio: '16:9'
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao gerar cenário.');

      setScenarioGeneratedUrl(data.imageUrl);
      const newScen: VoxaPresenterScenario = {
        id: `scen_user_${Date.now()}`,
        userUid,
        name: scenarioName.trim(),
        presetCode: scenarioCategory?.toUpperCase() || 'CUSTOM STUDIO',
        category: scenarioCategory,
        description: scenarioPrompt.trim(),
        backgroundType: 'custom_image',
        backgroundColor: '#111827',
        secondaryColor: '#1F2937',
        backgroundImageUrl: data.imageUrl,
        showVoxaLogoDefault: true,
        lightingStyle: 'Studio AI Lighting',
        isOfficialPreset: false,
        createdAt: new Date().toISOString()
      };
      await saveCustomScenario(newScen);
      setCustomScenarios((prev) => [newScen, ...prev]);
      setSelectedScenarioId(newScen.id);
      notify('success', `Cenário "${newScen.name}" salvo e disponível no Avatar Falante!`);
    } catch (err: any) {
      await addUserAiCredits(userUid, creditsCost);
      setUserCredits((c) => c + creditsCost);
      notify('error', err.message || 'Erro ao criar cenário.');
    } finally {
      setIsProcessingJob(false);
      setJobProgressPercent(0);
    }
  };

  return (
    <div className="space-y-8 text-left">
      {/* HEADER PRÓPRIO DO MÓDULO: VOXA AI STUDIO */}
      <header className="bg-[#111018]/90 backdrop-blur-xl border border-white/10 rounded-3xl px-5 py-4 sm:px-7 sm:py-4 flex flex-wrap items-center justify-between gap-4 shadow-xl sticky top-2 z-20">
        {/* Brand & Back to Studio Home */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTool(null)}
            className="flex items-center gap-2.5 text-left group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-[#FF0033] text-white flex items-center justify-center shadow-md shadow-[#FF0033]/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-orbitron font-black text-sm sm:text-base text-white tracking-tight block leading-none">
                VOXA <span className="text-[#FF0033]">AI Studio</span>
              </span>
              <span className="text-[9px] font-orbitron text-gray-400 uppercase tracking-widest block mt-0.5">
                Creative Intelligence
              </span>
            </div>
          </button>
        </div>

        {/* Navigation Items: Criar | Biblioteca | Projetos */}
        <nav className="flex items-center gap-1.5 sm:gap-2 bg-black/50 border border-white/10 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTool(null)}
            className={`px-3.5 py-2 rounded-xl font-orbitron font-bold text-[11px] uppercase transition-all cursor-pointer ${
              activeTool === null ||
              (activeTool !== 'biblioteca_ia' && activeTool !== 'meus_projetos')
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Criar
          </button>
          <button
            onClick={() => setActiveTool('biblioteca_ia')}
            className={`px-3.5 py-2 rounded-xl font-orbitron font-bold text-[11px] uppercase transition-all cursor-pointer ${
              activeTool === 'biblioteca_ia'
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Biblioteca
          </button>
          <button
            onClick={() => setActiveTool('meus_projetos')}
            className={`px-3.5 py-2 rounded-xl font-orbitron font-bold text-[11px] uppercase transition-all cursor-pointer ${
              activeTool === 'meus_projetos'
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Projetos
          </button>
        </nav>

        {/* Discreet Credits Display & Buy Credits */}
        <div className="flex items-center gap-2.5">
          <div className="bg-black/60 border border-white/15 rounded-2xl px-3.5 py-2 flex items-center gap-2.5">
            <span className="text-xs font-mono font-bold text-white">
              ✨ {userCredits} <span className="text-[10px] text-gray-400 font-sans">créditos</span>
            </span>
            <button
              onClick={async () => {
                const next = await addUserAiCredits(userUid, 200);
                setUserCredits(next);
                notify('success', '+200 Créditos VOXA AI adicionados à sua conta!');
              }}
              className="bg-[#FF0033] hover:bg-red-600 text-white font-orbitron font-black text-[10px] px-3 py-1.5 rounded-xl uppercase tracking-wider transition-all cursor-pointer"
            >
              Comprar créditos
            </button>
          </div>

          {isAdmin && onOpenAdminAi && (
            <button
              onClick={onOpenAdminAi}
              className="hidden sm:inline-flex bg-white/5 hover:bg-white/10 border border-white/15 text-gray-300 hover:text-white font-orbitron font-bold text-[10px] px-3 py-2 rounded-xl uppercase cursor-pointer"
            >
              Admin IA
            </button>
          )}
        </div>
      </header>

      {/* SUB-BAR DE TROCA RÁPIDA QUANDO UMA FERRAMENTA ESTÁ ABERTA */}
      {activeTool !== null && (
        <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveTool(null)}
            className="shrink-0 bg-white/5 hover:bg-white/10 border border-white/15 text-white font-orbitron font-bold text-[11px] px-4 py-2.5 rounded-2xl flex items-center gap-2 cursor-pointer"
          >
            <span>← Voltar ao Início do Estúdio</span>
          </button>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {STUDIO_TOOLS.map((tool) => {
              const Icon = tool.icon;
              const isSelected = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id)}
                  className={`shrink-0 px-3.5 py-2 rounded-xl font-orbitron font-bold text-[10px] uppercase border transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#FF0033] border-[#FF0033] text-white'
                      : 'bg-[#14131d] border-white/10 text-gray-400 hover:text-white hover:border-white/25'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tool.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* GLOBAL ASYNC QUEUE PROGRESS BANNER */}
      {isProcessingJob && (
        <div className="bg-gradient-to-r from-[#181524] via-[#12111d] to-[#181524] border border-[#FF0033]/60 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-[#FF0033]/20 border border-[#FF0033]/40 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-[#FF0033] animate-spin" />
              </div>
              <div>
                <span className="font-orbitron font-black text-xs sm:text-sm text-white uppercase block">
                  {jobStageLabel}
                </span>
                <span className="text-xs text-gray-400 font-sans">
                  VOXA AI Studio está sintetizando seu conteúdo em alta definição...
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-orbitron font-bold">
              <span className={jobStageLabel === 'Preparando...' ? 'text-[#FF0033]' : 'text-gray-500'}>
                1. Preparando...
              </span>
              <span className="text-gray-600">→</span>
              <span
                className={
                  jobStageLabel === 'Gerando...' || jobStageLabel === 'Processando...'
                    ? 'text-[#FF0033]'
                    : 'text-gray-500'
                }
              >
                2. Gerando...
              </span>
              <span className="text-gray-600">→</span>
              <span className={jobStageLabel === 'Finalizando...' ? 'text-[#FF0033]' : 'text-gray-500'}>
                3. Finalizando...
              </span>
            </div>
          </div>
          <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FF0033] via-red-500 to-white transition-all duration-300"
              style={{ width: `${Math.max(15, jobProgressPercent)}%` }}
            />
          </div>
        </div>
      )}

      {/* FEEDBACK TOAST */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
              : 'bg-red-500/10 border-red-500/40 text-red-300'
          }`}
        >
          <div className="flex items-center gap-3 text-xs font-orbitron font-bold">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-[10px] underline uppercase cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {/* DASHBOARD */}
      {activeTool === null && (
        <VoxaStudioIaDashboard
          onSelectTool={setActiveTool}
          recentJobs={jobsHistory}
          recentLibrary={libraryItems}
        />
      )}

      {/* =====================================================================
          TOOL 1: AVATAR FALANTE (VOXA PRESENTER PÚBLICO — ATÉ 40 SEGUNDOS)
         ===================================================================== */}
      {activeTool === 'avatar_falante' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: CONFIGURATION CONTROLS */}
          <div className="lg:col-span-7 space-y-6 bg-[#14131d] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
              <div>
                <span className="text-[10px] font-orbitron font-bold text-[#FF0033] uppercase tracking-widest block">
                  ESTÚDIO CRIATIVO • AVATAR FALANTE
                </span>
                <h2 className="font-orbitron font-black text-2xl text-white tracking-tight mt-1">
                  Avatar Falante
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Faça seu avatar falar e se movimentar com sincronização labial natural e cenários de estúdio.
                </p>
              </div>
              <div className="bg-white text-black px-4 py-2 rounded-2xl text-right shadow-md">
                <span className="text-[9px] text-gray-500 font-orbitron font-bold block uppercase">Custo estimado</span>
                <span className="font-orbitron font-black text-xs text-[#FF0033]">
                  ✨ {presenterPricing.creditsCharged} créditos
                </span>
              </div>
            </div>

            {/* 1. Escolher Avatar Oficial ou Personagem Salvo */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-orbitron font-bold text-gray-300 uppercase">
                  1. Escolher Avatar Oficial ou Seu Personagem Consistente
                </label>
                <button
                  onClick={() => setActiveTool('criar_avatar')}
                  className="text-[10px] font-orbitron font-bold text-[#FF0033] hover:underline cursor-pointer"
                >
                  + Criar Novo Avatar
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {allAvatars.map((av) => {
                  const isSel = av.id === selectedAvatarId;
                  return (
                    <button
                      key={av.id}
                      onClick={() => {
                        setSelectedAvatarId(av.id);
                        setVoiceId(av.defaultVoiceId || PRESENTER_VOICES[0].id);
                        setLanguage(av.defaultLanguage || 'pt-BR');
                      }}
                      className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSel
                          ? 'bg-[#FF0033]/15 border-[#FF0033] text-white'
                          : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/30'
                      }`}
                    >
                      <div className="aspect-square rounded-xl overflow-hidden bg-zinc-900 mb-2 relative">
                        {av.avatarUrl ? (
                          <img src={av.avatarUrl} alt={av.name} className="w-full h-full object-cover" />
                        ) : null}
                        <span className="absolute bottom-1 right-1 bg-black/80 text-[8px] font-mono px-1.5 py-0.5 rounded text-white">
                          {av.isOfficial ? 'OFICIAL' : 'MEU AVATAR'}
                        </span>
                      </div>
                      <span className="font-orbitron font-bold text-[11px] text-white block truncate">{av.name}</span>
                      <span className="text-[9px] text-gray-400 block truncate">{av.style || av.roleTitle}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Duração (5s a 40s), Proporção e Canal */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1.5">
                  Duração do Vídeo (Até 40s)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([5, 10, 15, 20, 30, 40] as VideoDurationOption[]).map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setTargetDurationSec(sec)}
                      className={`py-2 rounded-xl font-mono font-bold text-xs border cursor-pointer ${
                        targetDurationSec === sec
                          ? 'bg-[#FF0033] border-[#FF0033] text-white'
                          : 'bg-black/40 border-white/10 text-gray-300'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1.5">
                  Formato / Proporção
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['9:16', '1:1', '4:5', '16:9'] as PresenterAspectRatio[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setAspectRatio(r)}
                      className={`py-2 rounded-xl font-mono font-bold text-xs border cursor-pointer ${
                        aspectRatio === r
                          ? 'bg-white text-black border-white'
                          : 'bg-black/40 border-white/10 text-gray-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1.5">
                  Destino / Rede Social
                </label>
                <select
                  value={targetChannel}
                  onChange={(e) => setTargetChannel(e.target.value as PresenterTargetChannel)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  {PRESENTER_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Roteiro + Gerador de Roteiro IA + Estimativa de Tempo de Fala */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-[11px] font-orbitron font-bold text-gray-300 uppercase">
                  3. Roteiro de Fala (Sincronização Labial + Voz Neural)
                </label>
                <span className="text-[10px] font-mono text-emerald-400">
                  Tempo estimado de fala: ~{estimatedSpeechSec}s • {continuitySegments.length} segmento(s) contínuo(s)
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiScriptTopic}
                  onChange={(e) => setAiScriptTopic(e.target.value)}
                  placeholder="Ex.: Lançamento da minha coleção na VOXA Store com 20% OFF..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white"
                />
                <button
                  onClick={handleGenerateAiScript}
                  disabled={isGeneratingScript}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-orbitron font-bold text-[10px] px-4 py-2 rounded-xl uppercase cursor-pointer shrink-0"
                >
                  {isGeneratingScript ? 'Gerando...' : 'Gerar Roteiro IA'}
                </button>
              </div>

              <textarea
                rows={4}
                value={script}
                onChange={(e) => setScript(e.target.value)}
                className="w-full bg-black/50 border border-white/15 rounded-2xl p-3.5 text-xs text-white font-sans leading-relaxed"
                placeholder="Digite o texto que o avatar vai falar olhando para a câmera..."
              />

              {continuitySegments.length > 1 && (
                <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-1.5">
                  <span className="text-[10px] font-orbitron font-bold text-amber-300 uppercase block">
                    Composição Automática Multi-Segmento ({targetDurationSec}s = {continuitySegments.length}x10s sem cortes bruscos)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {continuitySegments.map((seg) => (
                      <div key={seg.segmentIndex} className="text-[10px] text-gray-400 bg-white/5 p-2 rounded-lg truncate">
                        <strong className="text-white font-mono">Seg {seg.segmentIndex + 1} ({seg.durationSec}s):</strong> {seg.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Voz Neural, Idioma, Tom e Velocidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1">
                  Voz Neural (Gemini 3.8 TTS)
                </label>
                <select
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  {PRESENTER_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1">
                  Tom da Apresentação
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  {PRESENTER_TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1">
                  Idioma
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  {PRESENTER_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1">
                  Velocidade da Fala ({voiceSpeed.toFixed(2)}x)
                </label>
                <input
                  type="range"
                  min={0.8}
                  max={1.25}
                  step={0.05}
                  value={voiceSpeed}
                  onChange={(e) => setVoiceSpeed(Number(e.target.value))}
                  className="w-full accent-[#FF0033] mt-2"
                />
              </div>
            </div>

            {/* 5. Cenário (Preset VOXA OFFICIAL STUDIO + Upload de Fundo + Legendas) */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-orbitron font-bold text-gray-300 uppercase">
                  5. Cenário de Estúdio & Estilo de Legenda
                </label>
                <button
                  onClick={() => {
                    setSelectedScenarioId('voxa_official_studio');
                    setCustomBackgroundUrl('');
                    setShowVoxaLogo(true);
                  }}
                  className="text-[10px] font-orbitron font-black text-[#FF0033] bg-[#FF0033]/10 border border-[#FF0033]/30 px-2.5 py-1 rounded-lg cursor-pointer"
                >
                  Ativar Preset VOXA OFFICIAL STUDIO
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {allScenarios.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => {
                      setSelectedScenarioId(sc.id);
                      setCustomBackgroundUrl(sc.backgroundImageUrl || '');
                      setShowVoxaLogo(sc.showVoxaLogoDefault);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedScenarioId === sc.id
                        ? 'bg-white/10 border-[#FF0033] text-white'
                        : 'bg-black/40 border-white/10 text-gray-400'
                    }`}
                  >
                    <span className="font-orbitron font-bold text-[10px] text-white block truncate">{sc.name}</span>
                    <span className="text-[9px] text-gray-400 block truncate">{sc.category || sc.presetCode}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1">
                    Estilo da Legenda Automática
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['Clean', 'Bold', 'Social', 'Minimal'] as CaptionStyleType[]).map((st) => (
                      <button
                        key={st}
                        onClick={() => {
                          setGenerateCaptions(true);
                          setCaptionStyle(st);
                        }}
                        className={`py-2 rounded-lg font-orbitron font-bold text-[10px] border cursor-pointer ${
                          generateCaptions && captionStyle === st
                            ? 'bg-[#FF0033] border-[#FF0033] text-white'
                            : 'bg-black/40 border-white/10 text-gray-400'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1">
                    Upload de Cenário Personalizado (JPG, PNG, WEBP)
                  </label>
                  <label className="flex items-center justify-center gap-2 bg-black/50 hover:bg-white/5 border border-dashed border-white/20 rounded-xl py-2 px-3 text-xs text-gray-300 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-[#FF0033]" />
                    <span>Enviar Imagem de Fundo</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const res = await uploadFile(file, 'voxa_presenter_backgrounds');
                          if (res?.url) {
                            setCustomBackgroundUrl(res.url);
                            notify('success', 'Fundo personalizado aplicado ao estúdio!');
                          }
                        } catch {
                          const localUrl = URL.createObjectURL(file);
                          setCustomBackgroundUrl(localUrl);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/10">
              <button
                onClick={handleTogglePreview}
                className="bg-white/10 hover:bg-white/15 border border-white/20 text-white font-orbitron font-bold text-xs px-5 py-3.5 rounded-2xl flex items-center gap-2 cursor-pointer"
              >
                {isPreviewPlaying ? <Square className="w-4 h-4 text-[#FF0033]" /> : <Play className="w-4 h-4" />}
                <span>{isPreviewPlaying ? 'Parar Preview' : 'Testar Animação & Fala'}</span>
              </button>

              <button
                onClick={handleGenerateTalkingAvatarVideo}
                disabled={isProcessingJob}
                className="flex-1 bg-[#FF0033] hover:bg-red-700 disabled:opacity-50 text-white font-orbitron font-black text-xs px-6 py-3.5 rounded-2xl uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#FF0033]/25 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>
                  {isProcessingJob
                    ? `Renderizando (${jobProgressPercent}%)...`
                    : `Gerar Vídeo Animado (${targetDurationSec}s • ${presenterPricing.creditsCharged} Créditos)`}
                </span>
              </button>
            </div>
          </div>

          {/* RIGHT: REAL-TIME ANIMATED AVATAR MONITOR & EXPORT */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
            <div className="bg-[#14131d] border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-orbitron font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF0033] animate-pulse" />
                  Preview do Estúdio
                </span>
                <span className="text-xs font-mono text-gray-400 bg-black/50 px-3 py-1 rounded-full border border-white/10">
                  {aspectRatio} • {targetDurationSec}s
                </span>
              </div>

              <div className="w-full max-w-[360px] mx-auto aspect-[9/16] bg-black rounded-2xl overflow-hidden border border-white/15 flex items-center justify-center relative shadow-xl">
                <AnimatedTalkingAvatarCanvas
                  avatar={activeAvatar}
                  scenario={activeScenario}
                  customBackgroundUrl={customBackgroundUrl}
                  aspectRatio={aspectRatio}
                  showVoxaLogo={showVoxaLogo}
                  voxaWatermark={voxaWatermark}
                  companyLogoUrl={companyLogo}
                  captions={captions}
                  captionStyle={captionStyle}
                  generateCaptions={generateCaptions}
                  isPlaying={isPreviewPlaying || isProcessingJob}
                  currentTimeSec={previewCurrentSec}
                  durationSec={targetDurationSec}
                  lipSyncEnvelope={lipSyncEnvelope}
                  canvasRef={canvasRef}
                />
              </div>

              {generatedVideoUrl && (
                <div className="bg-white text-black rounded-2xl p-5 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-orbitron font-black text-black uppercase">
                      Vídeo Pronto!
                    </span>
                    <a
                      href={generatedVideoUrl}
                      download={`${videoTitle || 'voxa-avatar-video'}.webm`}
                      className="bg-[#FF0033] hover:bg-red-600 text-white font-orbitron font-black text-[10px] px-4 py-2 rounded-xl flex items-center gap-1.5 uppercase shadow-md"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar Vídeo
                    </a>
                  </div>
                  <video src={generatedVideoUrl} controls className="w-full rounded-xl max-h-64 bg-black" />
                  {onShareToFeed && (
                    <button
                      onClick={() => onShareToFeed(generatedVideoUrl, script)}
                      className="w-full bg-black hover:bg-zinc-900 text-white font-orbitron font-bold text-[10px] py-3 rounded-xl uppercase cursor-pointer"
                    >
                      Publicar na VOXA
                    </button>
                  )}
                </div>
              )}

              <div className="bg-black/40 border border-white/10 rounded-2xl p-4 flex items-center justify-between text-xs text-gray-300">
                <span>Cenário Ativo: <strong className="text-white">{activeScenario?.name || 'VOXA Official Studio'}</strong></span>
                <span className="font-mono text-[#FF0033] font-bold">✨ {presenterPricing.creditsCharged} créditos</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 2: CRIAR AVATAR CONSISTENTE
         ===================================================================== */}
      {activeTool === 'criar_avatar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-[#12111d] border border-white/10 rounded-3xl p-6 space-y-5">
            <div>
              <span className="text-[10px] font-orbitron font-bold text-[#FF0033] uppercase">
                CONSISTÊNCIA DE PERSONAGEM • SEED + REFERÊNCIA
              </span>
              <h2 className="font-orbitron font-black text-xl text-white uppercase mt-1">
                Criar Avatar Consistente
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Envie de 1 a 5 fotos de referência ou descreva o personagem. O Avatar recebe um AvatarID, Seed e metadados para manter a mesma identidade em todos os seus vídeos.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1">
                  Nome do Avatar / Personagem
                </label>
                <input
                  type="text"
                  value={newAvatarName}
                  onChange={(e) => setNewAvatarName(e.target.value)}
                  placeholder="Ex.: Sofia Tech, Dr. Rafael..."
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1">
                  Estilo do Avatar
                </label>
                <select
                  value={newAvatarStyle}
                  onChange={(e) => setNewAvatarStyle(e.target.value as AvatarCharacterStyle)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white"
                >
                  {[
                    'Humano Realista',
                    'Profissional / Executivo',
                    'Influencer / Creator',
                    'Futurista',
                    'Cyberpunk',
                    'Mascote 3D',
                    'Estilizado / Editorial'
                  ].map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1">
                Descrição Física & Expressão (Prompt)
              </label>
              <textarea
                rows={3}
                value={newAvatarPrompt}
                onChange={(e) => setNewAvatarPrompt(e.target.value)}
                className="w-full bg-black/50 border border-white/15 rounded-2xl p-3.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1.5">
                Fotos de Referência (Opcional — 1 a 5 fotos para manter consistência facial)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="bg-white/5 hover:bg-white/10 border border-dashed border-white/20 rounded-xl px-4 py-3 text-xs text-gray-300 cursor-pointer flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#FF0033]" />
                  <span>Adicionar Foto de Referência ({newAvatarRefPhotos.length}/5)</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file || newAvatarRefPhotos.length >= 5) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') {
                          setNewAvatarRefPhotos((prev) => [...prev.slice(0, 4), reader.result as string]);
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {newAvatarRefPhotos.map((src, i) => (
                  <div key={i} className="w-12 h-12 rounded-xl overflow-hidden border border-white/20 relative">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreateConsistentAvatar}
              disabled={isProcessingJob}
              className="w-full bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs py-4 rounded-2xl uppercase tracking-wider cursor-pointer"
            >
              Gerar e Salvar Avatar Consistente (20 Créditos)
            </button>
          </div>

          <div className="lg:col-span-5 bg-[#12111d] border border-white/10 rounded-3xl p-6 space-y-4">
            <h3 className="font-orbitron font-black text-sm text-white uppercase">
              Preview & Identidade do Personagem
            </h3>
            {generatedAvatarPreviewUrl ? (
              <div className="space-y-3">
                <img
                  src={generatedAvatarPreviewUrl}
                  alt="Avatar"
                  className="w-full aspect-square object-cover rounded-2xl border border-white/15"
                />
                <div className="bg-black/40 p-3 rounded-xl text-[11px] font-mono text-gray-300 space-y-1">
                  <div>Avatar salvo com sucesso!</div>
                  <div>Seed de Consistência: #{generatedAvatarSeed}</div>
                </div>
                <button
                  onClick={() => setActiveTool('avatar_falante')}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-orbitron font-black text-xs py-3 rounded-xl uppercase cursor-pointer"
                >
                  Usar Agora no Avatar Falante
                </button>
              </div>
            ) : (
              <div className="aspect-square rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-xs text-gray-500 font-orbitron">
                Gere seu avatar ao lado para visualizar
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 3 & 4: MOTION TRANSFER & CHARACTER REPLACE
         ===================================================================== */}
      {(activeTool === 'motion_transfer' || activeTool === 'character_replace') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-[#12111d] border border-white/10 rounded-3xl p-6 space-y-5">
            <div>
              <span className="text-[10px] font-orbitron font-bold text-[#FF0033] uppercase">
                {activeTool === 'character_replace'
                  ? 'SUBSTITUIÇÃO DE PERSONAGEM EM VÍDEO'
                  : 'TRANSFERÊNCIA DE MOVIMENTO CORPORAL & EXPRESSÃO'}
              </span>
              <h2 className="font-orbitron font-black text-xl text-white uppercase mt-1">
                {activeTool === 'character_replace'
                  ? 'Character Replace (Substituir Personagem)'
                  : 'Motion Transfer (Vídeo Referência → Seu Avatar)'}
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                {activeTool === 'character_replace'
                  ? 'Envie um vídeo de referência autorizado e substitua a pessoa pelo seu Avatar mantendo enquadramento, iluminação e ação.'
                  : 'Envie um vídeo de referência e transfira a postura, gestos, movimento de cabeça e câmera para o seu Avatar.'}
              </p>
            </div>

            <div>
              <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1.5">
                1. Escolha o Avatar Destino
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {allAvatars.map((av) => (
                  <button
                    key={av.id}
                    onClick={() => setMotionAvatarId(av.id)}
                    className={`p-2 rounded-xl border text-left cursor-pointer ${
                      motionAvatarId === av.id
                        ? 'bg-[#FF0033]/15 border-[#FF0033] text-white'
                        : 'bg-black/40 border-white/10 text-gray-400'
                    }`}
                  >
                    <img src={av.avatarUrl} alt={av.name} className="w-full aspect-square object-cover rounded-lg mb-1" />
                    <span className="font-orbitron font-bold text-[10px] block truncate">{av.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1.5">
                2. Enviar Vídeo de Referência (MP4, WEBM, MOV)
              </label>
              <label className="flex items-center justify-center gap-2 bg-black/50 hover:bg-white/5 border border-dashed border-white/20 rounded-2xl p-4 text-xs text-gray-300 cursor-pointer">
                <Upload className="w-4 h-4 text-[#FF0033]" />
                <span>Selecionar Vídeo de Referência de Movimento</span>
                <input type="file" accept="video/*" className="hidden" onChange={handleReferenceVideoUpload} />
              </label>
              {motionRefVideoUrl && (
                <video src={motionRefVideoUrl} controls className="w-full max-h-48 rounded-xl mt-2 bg-black" />
              )}
            </div>

            <div>
              <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1">
                3. Direção de Movimento / Ação da Cena
              </label>
              <textarea
                rows={2}
                value={motionDescription}
                onChange={(e) => setMotionDescription(e.target.value)}
                className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-xs text-white"
              />
            </div>

            {/* MANDATORY CONSENT & ETHICAL AI CHECKBOX */}
            <label className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={motionConsentConfirmed}
                onChange={(e) => setMotionConsentConfirmed(e.target.checked)}
                className="mt-1 accent-[#FF0033]"
              />
              <span className="text-xs text-amber-200 leading-relaxed">
                <strong>Declaração de Direitos e Uso Responsável (Obrigatório):</strong> Confirmo que tenho autorização legal para usar o vídeo/imagem de referência enviado e não estou utilizando terceiros sem consentimento ou para fins enganosos. O vídeo gerado receberá metadados de IA e marca d'água "Criado com VOXA AI".
              </span>
            </label>

            <button
              onClick={() => handleRunMotionOrReplace(activeTool)}
              disabled={isProcessingJob}
              className="w-full bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs py-4 rounded-2xl uppercase tracking-wider cursor-pointer"
            >
              Executar {activeTool === 'character_replace' ? 'Character Replace' : 'Motion Transfer'} (100 Créditos)
            </button>
          </div>

          <div className="lg:col-span-5 bg-[#12111d] border border-white/10 rounded-3xl p-6 space-y-4">
            <h3 className="font-orbitron font-black text-sm text-white uppercase">Resultado Sintetizado</h3>
            {motionResultVideoUrl ? (
              <div className="space-y-3">
                <video src={motionResultVideoUrl} controls className="w-full rounded-2xl bg-black" />
                <a
                  href={motionResultVideoUrl}
                  download="voxa-motion-transfer.mp4"
                  className="w-full bg-emerald-500 text-black font-orbitron font-black text-xs py-3 rounded-xl flex items-center justify-center gap-2 uppercase"
                >
                  <Download className="w-4 h-4" /> Baixar Vídeo MP4
                </a>
              </div>
            ) : motionResultKeyframeUrl ? (
              <div className="space-y-2">
                <img src={motionResultKeyframeUrl} alt="Keyframe" className="w-full rounded-2xl border border-white/15" />
                <span className="text-[11px] text-gray-400 block">
                  Quadro-chave de pose sintetizado com identidade do Avatar.
                </span>
              </div>
            ) : (
              <div className="aspect-[9/16] max-h-96 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-xs text-gray-500 font-orbitron p-6 text-center">
                Selecione o Avatar, envie o vídeo de referência e confirme o termo de autorização para gerar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 5 & 6: IMAGEM -> VÍDEO & TEXTO -> VÍDEO (VEO 3.1)
         ===================================================================== */}
      {(activeTool === 'imagem_para_video' || activeTool === 'texto_para_video') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LADO ESQUERDO: UPLOAD, PROMPT, FORMATO, DURAÇÃO E BOTÃO GERAR */}
          <div className="lg:col-span-7 bg-[#14131d] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
              <div>
                <span className="text-[10px] font-orbitron font-bold text-[#FF0033] uppercase tracking-widest block">
                  DESTAQUE DO ESTÚDIO • GOOGLE VEO 3.1
                </span>
                <h2 className="font-orbitron font-black text-2xl sm:text-3xl text-white tracking-tight mt-1">
                  {activeTool === 'imagem_para_video' ? 'Imagem → Vídeo' : 'Texto → Vídeo'}
                </h2>
                <p className="text-xs sm:text-sm text-gray-300 mt-1">
                  {activeTool === 'imagem_para_video'
                    ? 'Envie uma imagem, escreva o que deve acontecer e gere seu vídeo com inteligência artificial.'
                    : 'Descreva uma cena e gere vídeos cinematográficos com inteligência artificial.'}
                </p>
              </div>
              <div className="bg-white text-black px-4 py-2.5 rounded-2xl text-right shadow-md shrink-0">
                <span className="text-[9px] font-orbitron font-bold text-gray-500 uppercase block">Custo</span>
                <span className="font-orbitron font-black text-xs text-[#FF0033]">✨ 80 créditos</span>
              </div>
            </div>

            {activeTool === 'imagem_para_video' && (
              <div className="space-y-2.5">
                <label className="text-xs font-orbitron font-bold text-white uppercase block">
                  1. Enviar Imagem (JPG, JPEG, PNG, WEBP)
                </label>
                <label className="group flex flex-col items-center justify-center gap-3 bg-black/40 hover:bg-black/60 border-2 border-dashed border-white/20 hover:border-[#FF0033] rounded-3xl p-6 text-center transition-all cursor-pointer">
                  {veoInputImageUrl ? (
                    <div className="relative w-full max-h-64 overflow-hidden rounded-2xl flex items-center justify-center bg-black">
                      <img
                        src={veoInputImageUrl}
                        alt="Preview"
                        className="max-h-60 w-auto object-contain rounded-xl"
                      />
                      <span className="absolute bottom-3 right-3 bg-black/80 text-white font-orbitron font-bold text-[10px] px-3 py-1.5 rounded-xl border border-white/20">
                        Trocar Imagem
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-[#FF0033]/15 border border-[#FF0033]/40 flex items-center justify-center text-[#FF0033] group-hover:scale-105 transition-transform">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-orbitron font-bold text-xs text-white block">
                          Clique para enviar uma imagem do seu dispositivo
                        </span>
                        <span className="text-[11px] text-gray-400 mt-0.5 block">
                          Suporta retratos, avatares, fotos de produtos ou cenários
                        </span>
                      </div>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const r = new FileReader();
                      r.onload = () => {
                        if (typeof r.result === 'string') setVeoInputImageUrl(r.result);
                      };
                      r.readAsDataURL(f);
                      try {
                        const up = await uploadFile(f, 'voxa_ai_inputs');
                        if (up?.url) setVeoInputImageUrl(up.url);
                      } catch {
                        // fallback base64 already loaded for immediate preview
                      }
                    }}
                  />
                </label>
              </div>
            )}

            <div className="space-y-2.5">
              <label className="text-xs font-orbitron font-bold text-white uppercase block">
                {activeTool === 'imagem_para_video' ? '2. O que você quer que aconteça?' : '1. O que você quer que aconteça?'}
              </label>
              <textarea
                rows={4}
                value={veoPrompt}
                onChange={(e) => setVeoPrompt(e.target.value)}
                placeholder="Ex.: Faça o personagem olhar para a câmera e falar: 'Acesse agora, cadastre-se e venha para o futuro. Tudo está aqui na VOXA.'"
                className="w-full bg-black/50 border border-white/15 focus:border-[#FF0033] outline-none rounded-2xl p-4 text-xs sm:text-sm text-white font-sans leading-relaxed"
              />

              {/* Sugestões clicáveis de prompt */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block">
                  Sugestões rápidas de prompt:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Faça a pessoa olhar para a câmera e falar: 'Acesse agora, cadastre-se e venha para o futuro na VOXA.'",
                    'Faça o personagem caminhar em direção à câmera com expressão confiante em iluminação cinematográfica.',
                    'Transforme a imagem em cena cinematográfica com movimento suave de câmera e luz de estúdio.'
                  ].map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setVeoPrompt(sug)}
                      className="text-left text-[11px] bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 text-gray-300 hover:text-white px-3 py-2 rounded-xl transition-all cursor-pointer"
                    >
                      “{sug.slice(0, 68)}...”
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-2">
                  Formato do Vídeo
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {([
                    { ratio: '9:16', label: '9:16 Vertical (Reels/TikTok)' },
                    { ratio: '16:9', label: '16:9 Horizontal (YouTube)' }
                  ] as const).map((item) => (
                    <button
                      key={item.ratio}
                      onClick={() => setVeoAspectRatio(item.ratio)}
                      className={`py-3 px-3 rounded-2xl font-orbitron font-bold text-[11px] border transition-all cursor-pointer ${
                        veoAspectRatio === item.ratio
                          ? 'bg-[#FF0033] border-[#FF0033] text-white shadow-lg shadow-[#FF0033]/20'
                          : 'bg-black/40 border-white/10 text-gray-300 hover:border-white/25'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-2">
                  Qualidade & Duração
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['720p', '1080p'] as const).map((res) => (
                    <button
                      key={res}
                      onClick={() => setVeoResolution(res)}
                      className={`py-3 px-3 rounded-2xl font-mono font-bold text-xs border transition-all cursor-pointer ${
                        veoResolution === res
                          ? 'bg-white text-black border-white shadow-md'
                          : 'bg-black/40 border-white/10 text-gray-300 hover:border-white/25'
                      }`}
                    >
                      {res} • 8s Veo
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleRunVeoGeneration(activeTool === 'imagem_para_video')}
              disabled={isProcessingJob}
              className="w-full bg-[#FF0033] hover:bg-red-600 disabled:opacity-50 text-white font-orbitron font-black text-xs sm:text-sm py-4 rounded-2xl uppercase tracking-wider shadow-xl shadow-[#FF0033]/25 transition-all cursor-pointer flex items-center justify-center gap-2.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isProcessingJob
                  ? 'Processando Vídeo no Veo 3.1...'
                  : 'Gerar Vídeo (80 Créditos)'}
              </span>
            </button>
          </div>

          {/* LADO DIREITO: PREVIEW GRANDE, PLAYER, DOWNLOAD E PUBLICAR */}
          <div className="lg:col-span-5 bg-[#14131d] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <h3 className="font-orbitron font-black text-base text-white uppercase">
                Resultado do Estúdio
              </h3>
              <span className="text-[11px] font-mono text-gray-400">
                {veoAspectRatio} • {veoResolution}
              </span>
            </div>

            {veoOutputVideoUrl ? (
              <div className="space-y-4">
                <div className="rounded-2xl overflow-hidden bg-black border border-white/15 shadow-2xl">
                  <video src={veoOutputVideoUrl} controls autoPlay loop className="w-full max-h-[460px] object-contain" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href={veoOutputVideoUrl}
                    download="voxa-ai-video.mp4"
                    className="bg-white hover:bg-gray-100 text-black font-orbitron font-black text-xs py-3.5 rounded-2xl flex items-center justify-center gap-2 uppercase transition-all"
                  >
                    <Download className="w-4 h-4" /> Baixar Vídeo
                  </a>

                  {onShareToFeed && (
                    <button
                      onClick={() => onShareToFeed(veoOutputVideoUrl, veoPrompt)}
                      className="bg-[#FF0033] hover:bg-red-600 text-white font-orbitron font-black text-xs py-3.5 rounded-2xl flex items-center justify-center gap-2 uppercase transition-all cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" /> Publicar na VOXA
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="aspect-[9/16] max-h-[440px] rounded-3xl bg-black/50 border border-white/10 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#FF0033]">
                  <Video className="w-6 h-6" />
                </div>
                <span className="font-orbitron font-bold text-xs text-white uppercase">
                  Seu vídeo gerado aparecerá aqui
                </span>
                <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
                  Envie uma imagem ao lado, descreva a cena ou fala desejada e clique em Gerar Vídeo.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 7 & 8: GERAR IMAGEM & EDITAR IMAGEM
         ===================================================================== */}
      {activeTool === 'gerar_imagem' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-[#12111d] border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="font-orbitron font-black text-xl text-white uppercase">Gerar Imagem com IA</h2>
            <textarea
              rows={3}
              value={imgGenPrompt}
              onChange={(e) => setImgGenPrompt(e.target.value)}
              className="w-full bg-black/50 border border-white/15 rounded-2xl p-3.5 text-xs text-white"
              placeholder="Descreva a imagem que deseja criar..."
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1">Proporção</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['1:1', '4:5', '9:16', '16:9'] as PresenterAspectRatio[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setImgGenRatio(r)}
                      className={`py-2 rounded-xl font-mono text-xs border cursor-pointer ${
                        imgGenRatio === r ? 'bg-[#FF0033] border-[#FF0033] text-white' : 'bg-black/40 border-white/10 text-gray-400'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block mb-1">Estilo</label>
                <input
                  type="text"
                  value={imgGenStyle}
                  onChange={(e) => setImgGenStyle(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>
            <button
              onClick={handleGenerateImage}
              disabled={isProcessingJob}
              className="w-full bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs py-4 rounded-2xl uppercase cursor-pointer"
            >
              Gerar Imagem (16 Créditos)
            </button>
          </div>
          <div className="lg:col-span-5 bg-[#12111d] border border-white/10 rounded-3xl p-6">
            {imgGenResultUrl ? (
              <div className="space-y-3">
                <img src={imgGenResultUrl} alt="" className="w-full rounded-2xl border border-white/15" />
                <a
                  href={imgGenResultUrl}
                  download="voxa-ai-image.png"
                  className="w-full bg-emerald-500 text-black font-orbitron font-black text-xs py-3 rounded-xl flex items-center justify-center gap-2 uppercase"
                >
                  <Download className="w-4 h-4" /> Baixar Imagem
                </a>
              </div>
            ) : (
              <div className="aspect-square rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-xs text-gray-500 font-orbitron">
                Sua imagem gerada aparecerá aqui
              </div>
            )}
          </div>
        </div>
      )}

      {activeTool === 'editar_imagem' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-[#12111d] border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="font-orbitron font-black text-xl text-white uppercase">Editar Imagem com IA</h2>
            <label className="flex items-center justify-center gap-2 bg-black/50 border border-dashed border-white/20 rounded-2xl p-4 text-xs text-gray-300 cursor-pointer">
              <Upload className="w-4 h-4 text-[#FF0033]" />
              <span>Enviar Imagem para Edição</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = () => {
                    if (typeof r.result === 'string') setEditSourceImageUrl(r.result);
                  };
                  r.readAsDataURL(f);
                }}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                'Trocar fundo',
                'Trocar roupa',
                'Remover objeto',
                'Adicionar objeto',
                'Melhorar rosto',
                'Expandir imagem',
                'Mudar iluminação (Relighting)',
                'Transformar estilo'
              ].map((op) => (
                <button
                  key={op}
                  onClick={() => setEditOperation(op)}
                  className={`px-3 py-1.5 rounded-xl font-orbitron font-bold text-[10px] border cursor-pointer ${
                    editOperation === op ? 'bg-[#FF0033] border-[#FF0033] text-white' : 'bg-black/40 border-white/10 text-gray-400'
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder="Descreva a alteração desejada..."
              className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-xs text-white"
            />
            <button
              onClick={handleEditImage}
              disabled={isProcessingJob}
              className="w-full bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs py-4 rounded-2xl uppercase cursor-pointer"
            >
              Aplicar Edição IA (18 Créditos)
            </button>
          </div>
          <div className="lg:col-span-5 bg-[#12111d] border border-white/10 rounded-3xl p-6">
            {editResultUrl ? (
              <img src={editResultUrl} alt="" className="w-full rounded-2xl border border-white/15" />
            ) : editSourceImageUrl ? (
              <img src={editSourceImageUrl} alt="" className="w-full rounded-2xl border border-white/15 opacity-75" />
            ) : (
              <div className="aspect-square rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-xs text-gray-500 font-orbitron">
                Envie uma imagem para editar
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 9 & 10: CRIAR ANÚNCIO & CRIAR CENÁRIO
         ===================================================================== */}
      {activeTool === 'criar_anuncio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-[#12111d] border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="font-orbitron font-black text-xl text-white uppercase">
              Criar Anúncio Comercial / UGC
            </h2>
            <input
              type="text"
              value={adProductName}
              onChange={(e) => setAdProductName(e.target.value)}
              placeholder="Nome do produto, evento ou oferta..."
              className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white"
            />
            <textarea
              rows={3}
              value={adProductDesc}
              onChange={(e) => setAdProductDesc(e.target.value)}
              placeholder="Benefícios, preço, chamada para ação..."
              className="w-full bg-black/50 border border-white/15 rounded-xl p-3.5 text-xs text-white"
            />
            <select
              value={adFormat}
              onChange={(e) => setAdFormat(e.target.value)}
              className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white"
            >
              <option value="Vídeo Curto / Reels UGC">Vídeo Curto / Reels UGC</option>
              <option value="Story Promocional">Story Promocional</option>
              <option value="Post Feed Comercial">Post Feed Comercial</option>
              <option value="Banner de Alta Conversão">Banner de Alta Conversão</option>
            </select>
            <button
              onClick={handleCreateAd}
              disabled={isProcessingJob}
              className="w-full bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs py-4 rounded-2xl uppercase cursor-pointer"
            >
              Gerar Anúncio Completo (30 Créditos)
            </button>
          </div>
          <div className="lg:col-span-5 bg-[#12111d] border border-white/10 rounded-3xl p-6 space-y-4">
            {adResultBannerUrl && (
              <img src={adResultBannerUrl} alt="Banner Ad" className="w-full rounded-2xl border border-white/15" />
            )}
            {adResultCopy && (
              <pre className="whitespace-pre-wrap text-xs text-gray-200 bg-black/50 p-4 rounded-2xl border border-white/10 font-sans">
                {adResultCopy}
              </pre>
            )}
          </div>
        </div>
      )}

      {activeTool === 'criar_cenario' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-[#12111d] border border-white/10 rounded-3xl p-6 space-y-4">
            <h2 className="font-orbitron font-black text-xl text-white uppercase">Criar Cenário de Estúdio</h2>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="Nome do cenário (Ex.: Estúdio Podcast Neon)"
              className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white"
            />
            <select
              value={scenarioCategory}
              onChange={(e) => setScenarioCategory(e.target.value as any)}
              className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white"
            >
              {['Cenário VOXA', 'Fundo branco', 'Estúdio', 'Escritório', 'Futurista', 'Fundo escuro'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <textarea
              rows={3}
              value={scenarioPrompt}
              onChange={(e) => setScenarioPrompt(e.target.value)}
              className="w-full bg-black/50 border border-white/15 rounded-xl p-3.5 text-xs text-white"
            />
            <button
              onClick={handleGenerateScenario}
              disabled={isProcessingJob}
              className="w-full bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs py-4 rounded-2xl uppercase cursor-pointer"
            >
              Gerar e Salvar Cenário (16 Créditos)
            </button>
          </div>
          <div className="lg:col-span-5 bg-[#12111d] border border-white/10 rounded-3xl p-6">
            {scenarioGeneratedUrl ? (
              <div className="space-y-3">
                <img src={scenarioGeneratedUrl} alt="" className="w-full rounded-2xl border border-white/15" />
                <button
                  onClick={() => setActiveTool('avatar_falante')}
                  className="w-full bg-emerald-500 text-black font-orbitron font-black text-xs py-3 rounded-xl uppercase cursor-pointer"
                >
                  Usar Cenário no Avatar Falante
                </button>
              </div>
            ) : (
              <div className="aspect-video rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-xs text-gray-500 font-orbitron">
                Preview do Cenário 16:9
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 11: BIBLIOTECA IA (GALERIA CRIATIVA MODERNA)
         ===================================================================== */}
      {activeTool === 'biblioteca_ia' && (
        <div className="space-y-6">
          <div className="bg-[#14131d] border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div>
              <span className="text-[10px] font-orbitron font-bold text-[#FF0033] uppercase tracking-widest block">
                ACERVO PESSOAL • VOXA AI STUDIO
              </span>
              <h2 className="font-orbitron font-black text-2xl text-white tracking-tight mt-1">
                Minha Biblioteca ({libraryItems.length})
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Seus vídeos, avatares, imagens e anúncios criados com inteligência artificial.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 bg-black/50 p-1.5 rounded-2xl border border-white/10">
              {(['all', 'video', 'image'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setLibraryFilter(f)}
                  className={`px-4 py-2 rounded-xl font-orbitron font-bold text-[11px] uppercase transition-all cursor-pointer ${
                    libraryFilter === f
                      ? 'bg-[#FF0033] text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'Todos' : f === 'video' ? 'Vídeos' : 'Imagens & Avatares'}
                </button>
              ))}
            </div>
          </div>

          {libraryItems.length === 0 ? (
            <div className="bg-[#14131d] border border-white/10 rounded-3xl p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#FF0033] mx-auto">
                <Library className="w-6 h-6" />
              </div>
              <h3 className="font-orbitron font-bold text-base text-white uppercase">
                Sua biblioteca ainda está vazia
              </h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Todas as imagens, avatares e vídeos gerados no VOXA AI Studio são salvos automaticamente aqui para você baixar ou publicar quando quiser.
              </p>
              <button
                onClick={() => setActiveTool(null)}
                className="bg-[#FF0033] hover:bg-red-600 text-white font-orbitron font-black text-xs px-6 py-3.5 rounded-2xl uppercase tracking-wider cursor-pointer"
              >
                Começar a Criar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {libraryItems
                .filter((it) => libraryFilter === 'all' || (it.itemCategory || 'video') === libraryFilter)
                .map((item) => (
                  <div
                    key={item.id}
                    className="group bg-[#14131d] border border-white/10 hover:border-white/25 rounded-3xl overflow-hidden flex flex-col justify-between shadow-xl transition-all"
                  >
                    <div>
                      <div className="aspect-[16/10] bg-black relative flex items-center justify-center overflow-hidden">
                        {item.videoUrl ? (
                          <video src={item.videoUrl} controls className="w-full h-full object-contain" />
                        ) : (
                          <img
                            src={item.imageUrl || item.avatarUrl}
                            alt={item.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        )}
                        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/15 font-orbitron font-bold text-[9px] text-white uppercase">
                          {item.videoUrl ? 'VÍDEO' : 'IMAGEM'} • {item.aspectRatio}
                        </span>
                      </div>

                      <div className="p-5 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
                          <span>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</span>
                          <span className="text-white font-bold">✨ {item.creditsCharged || 40} créditos</span>
                        </div>
                        <h4 className="font-orbitron font-black text-sm text-white truncate">{item.title}</h4>
                        <p className="text-xs text-gray-400 line-clamp-2 font-sans">{item.script}</p>
                      </div>
                    </div>

                    <div className="px-5 pb-5 pt-3 border-t border-white/10 flex items-center gap-2">
                      <a
                        href={item.videoUrl || item.imageUrl || item.avatarUrl}
                        download={`${item.title || 'voxa-ai'}`}
                        className="flex-1 bg-white hover:bg-gray-100 text-black font-orbitron font-black text-[10px] py-2.5 rounded-xl flex items-center justify-center gap-1.5 uppercase transition-all"
                      >
                        <Download className="w-3.5 h-3.5" /> Baixar
                      </a>
                      {onShareToFeed && (
                        <button
                          onClick={() =>
                            onShareToFeed(item.videoUrl || item.imageUrl || item.avatarUrl, item.script || item.title)
                          }
                          className="flex-1 bg-[#FF0033] hover:bg-red-600 text-white font-orbitron font-black text-[10px] py-2.5 rounded-xl flex items-center justify-center gap-1.5 uppercase transition-all cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" /> Publicar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TOOL 12: MEUS PROJETOS (EM CARDS MODERNOS, SEM TABELA TÉCNICA)
         ===================================================================== */}
      {activeTool === 'meus_projetos' && (
        <div className="space-y-6">
          <div className="bg-[#14131d] border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div>
              <span className="text-[10px] font-orbitron font-bold text-[#FF0033] uppercase tracking-widest block">
                HISTÓRICO DO ESTÚDIO
              </span>
              <h2 className="font-orbitron font-black text-2xl text-white tracking-tight mt-1">
                Projetos Recentes ({jobsHistory.length})
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Acompanhe todas as suas criações, status e resultados em cards visuais.
              </p>
            </div>
            <button
              onClick={() => setActiveTool(null)}
              className="bg-[#FF0033] hover:bg-red-600 text-white font-orbitron font-black text-xs px-5 py-3 rounded-2xl uppercase tracking-wider cursor-pointer"
            >
              + Nova Criação
            </button>
          </div>

          {jobsHistory.length === 0 ? (
            <div className="bg-[#14131d] border border-white/10 rounded-3xl p-12 text-center space-y-3">
              <h3 className="font-orbitron font-bold text-base text-white uppercase">
                Nenhum projeto encontrado
              </h3>
              <p className="text-xs text-gray-400">
                Assim que você gerar um vídeo, avatar ou imagem, seu projeto aparecerá aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {jobsHistory.map((job) => {
                const isCompleted = job.status === 'COMPLETED';
                const isFailed = job.status === 'FAILED';
                return (
                  <div
                    key={job.jobId}
                    className="bg-[#14131d] border border-white/10 hover:border-white/25 rounded-3xl p-6 flex flex-col justify-between gap-4 shadow-xl transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-orbitron font-black text-sm text-white">
                          {job.toolLabel}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-orbitron font-black uppercase ${
                            isCompleted
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : isFailed
                              ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {isCompleted ? 'Concluído' : isFailed ? 'Falhou' : 'Processando'}
                        </span>
                      </div>

                      <p className="text-xs text-gray-300 font-sans line-clamp-2 leading-relaxed">
                        {job.inputSummary || 'Geração criativa no VOXA AI Studio'}
                      </p>

                      {job.outputMediaUrl && (
                        <div className="pt-1">
                          <a
                            href={job.outputMediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-[11px] font-orbitron font-bold text-[#FF0033] hover:underline"
                          >
                            <Play className="w-3.5 h-3.5" /> Abrir Resultado
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-gray-400">
                      <span>{new Date(job.createdAt).toLocaleDateString('pt-BR')}</span>
                      <span className="text-white font-bold">✨ {job.creditsCharged} créditos</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
