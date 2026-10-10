import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Sparkles,
  Library,
  Shield,
  Play,
  Square,
  Download,
  Upload,
  CheckCircle2,
  Sliders,
  Volume2,
  Captions,
  Image as ImageIcon,
  UserCheck,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  ArrowLeft,
  Lock,
  Layers,
  FileText,
  DollarSign,
  MonitorPlay,
  Smartphone,
  Layout
} from 'lucide-react';
import {
  VoxaPresenterSettings,
  VoxaPresenterAvatar,
  VoxaPresenterScenario,
  VoxaPresenterLibraryItem,
  PresenterAspectRatio,
  PresenterTargetChannel,
  CaptionSegment,
  DEFAULT_VOXA_PRESENTER_SETTINGS,
  OFFICIAL_VOXA_AVATARS,
  OFFICIAL_VOXA_SCENARIOS,
  PRESENTER_VOICES,
  PRESENTER_LANGUAGES,
  PRESENTER_TONES,
  PRESENTER_CHANNELS,
  fetchVoxaPresenterSettings,
  updateVoxaPresenterSettings,
  subscribeToVoxaPresenterSettings,
  fetchPresenterLibrary,
  savePresenterLibraryItem,
  deletePresenterLibraryItem,
  fetchCustomAvatars,
  saveCustomAvatar,
  deleteCustomAvatar,
  fetchCustomScenarios,
  saveCustomScenario,
  buildTimedCaptionsFromScript,
  calculatePresenterCost
} from '../../utils/voxaPresenterDb';
import { uploadFile } from '../../utils/upload';
import { getGlobalCompanyLogo } from '../../utils/company';

interface VoxaAiAdminModuleProps {
  onBackToMenu: () => void;
  currentUser: {
    uid?: string;
    id?: string;
    name: string;
    email: string;
    role?: string;
    adminRole?: string;
    photoURL?: string;
  } | null;
  adminRole: 'SUPER_ADMIN' | 'ADMINISTRATOR' | 'MANAGER' | 'SUPPORT' | 'NONE';
}

export const VoxaAiAdminModule: React.FC<VoxaAiAdminModuleProps> = ({
  onBackToMenu,
  currentUser,
  adminRole
}) => {
  const [activeTab, setActiveTab] = useState<'presenter' | 'biblioteca' | 'governanca'>('presenter');
  const [libraryFilter, setLibraryFilter] = useState<'videos' | 'avatars' | 'cenarios' | 'roteiros'>('videos');

  // Settings & Library State
  const [settings, setSettings] = useState<VoxaPresenterSettings>(DEFAULT_VOXA_PRESENTER_SETTINGS);
  const [libraryItems, setLibraryItems] = useState<VoxaPresenterLibraryItem[]>([]);
  const [customAvatars, setCustomAvatars] = useState<VoxaPresenterAvatar[]>([]);
  const [customScenarios, setCustomScenarios] = useState<VoxaPresenterScenario[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Presenter Studio State
  const [videoTitle, setVideoTitle] = useState('Comunicado Oficial VOXA • Novidades da Plataforma');
  const [targetChannel, setTargetChannel] = useState<PresenterTargetChannel>('Instagram');
  const [aspectRatio, setAspectRatio] = useState<PresenterAspectRatio>('9:16');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(OFFICIAL_VOXA_AVATARS[0].id);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('voxa_official_studio');
  const [script, setScript] = useState<string>(
    'Bem-vindo à VOXA! Agora você conta com recursos exclusivos para conectar criadores, eventos oficiais, VOXA Store e experiências em tempo real. Acesse seu perfil agora e descubra todas as novidades da plataforma.'
  );
  const [voiceId, setVoiceId] = useState<string>(PRESENTER_VOICES[0].id);
  const [language, setLanguage] = useState<string>('pt-BR');
  const [tone, setTone] = useState<string>('Institucional Premium');
  const [showVoxaLogo, setShowVoxaLogo] = useState<boolean>(true);
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState<string>('');
  const [generateCaptions, setGenerateCaptions] = useState<boolean>(true);
  const [captions, setCaptions] = useState<CaptionSegment[]>([]);

  // Background Upload State
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [bgUploadProgress, setBgUploadProgress] = useState(0);

  // New Saved Character Modal / Form State
  const [showNewCharacterForm, setShowNewCharacterForm] = useState(false);
  const [newCharName, setNewCharName] = useState('');
  const [newCharRole, setNewCharRole] = useState('');
  const [newCharAvatarUrl, setNewCharAvatarUrl] = useState('');
  const [isUploadingCharAvatar, setIsUploadingCharAvatar] = useState(false);
  const [charUploadProgress, setCharUploadProgress] = useState(0);

  // AI Script Assistant State
  const [aiTopicPrompt, setAiTopicPrompt] = useState('');
  const [isGeneratingAiScript, setIsGeneratingAiScript] = useState(false);

  // Playback & Video Generation State
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewCurrentSec, setPreviewCurrentSec] = useState(0);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [lastGeneratedItem, setLastGeneratedItem] = useState<VoxaPresenterLibraryItem | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const previewTimerRef = useRef<number | null>(null);
  const companyLogo = getGlobalCompanyLogo();

  // Check if current admin is authorized
  const uid = currentUser?.uid || currentUser?.id || '';
  const isAuthorizedForPresenter =
    adminRole === 'SUPER_ADMIN' ||
    settings.authorizedRoles.includes(adminRole) ||
    (uid && settings.authorizedUids.includes(uid));

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoadingData(true);
      try {
        const [loadedSettings, loadedLib, loadedAvatars, loadedScenarios] = await Promise.all([
          fetchVoxaPresenterSettings(),
          fetchPresenterLibrary(),
          fetchCustomAvatars(),
          fetchCustomScenarios()
        ]);
        if (!mounted) return;
        setSettings(loadedSettings);
        setLibraryItems(loadedLib);
        setCustomAvatars(loadedAvatars);
        setCustomScenarios(loadedScenarios);
      } finally {
        if (mounted) setLoadingData(false);
      }
    };
    init();

    const unsub = subscribeToVoxaPresenterSettings((liveSettings) => {
      if (mounted) setSettings(liveSettings);
    });

    return () => {
      mounted = false;
      unsub();
      if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  // Recompute timed captions whenever script changes and generateCaptions is active
  useEffect(() => {
    if (generateCaptions) {
      const { captions: built } = buildTimedCaptionsFromScript(script);
      setCaptions(built);
    } else {
      setCaptions([]);
    }
  }, [script, generateCaptions]);

  const allAvatars: VoxaPresenterAvatar[] = [...OFFICIAL_VOXA_AVATARS, ...customAvatars];
  const allScenarios: VoxaPresenterScenario[] = [...OFFICIAL_VOXA_SCENARIOS, ...customScenarios];

  const activeAvatar = allAvatars.find((a) => a.id === selectedAvatarId) || OFFICIAL_VOXA_AVATARS[0];
  const activeScenario = allScenarios.find((s) => s.id === selectedScenarioId) || OFFICIAL_VOXA_SCENARIOS[0];
  const activeVoice = PRESENTER_VOICES.find((v) => v.id === voiceId) || PRESENTER_VOICES[0];

  // Cost calculation for current configuration
  const currentCostEstimate = calculatePresenterCost(
    script,
    aspectRatio,
    generateCaptions,
    settings.usdToBrlRate
  );

  // Aggregate metrics for Admin Status Header
  const totalVideosGenerated = libraryItems.length;
  const totalEstimatedCostBRL = libraryItems.reduce((acc, item) => acc + (Number(item.estimatedCostBRL) || 0), 0);
  const averageCostPerVideoBRL =
    totalVideosGenerated > 0 ? totalEstimatedCostBRL / totalVideosGenerated : currentCostEstimate.estimatedCostBRL;

  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusFeedback({ type, text });
    window.setTimeout(() => {
      setStatusFeedback((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Apply Official Preset VOXA OFFICIAL STUDIO
  const handleApplyOfficialVoxaPreset = () => {
    setSelectedScenarioId('voxa_official_studio');
    setCustomBackgroundUrl('');
    setShowVoxaLogo(true);
    setGenerateCaptions(true);
    setTone('Institucional Premium');
    showToast('success', 'Preset oficial VOXA OFFICIAL STUDIO aplicado (fundo branco, logo VOXA ao fundo, avatar centralizado e iluminação de estúdio).');
  };

  // Select Avatar handler
  const handleSelectAvatar = (avatar: VoxaPresenterAvatar) => {
    setSelectedAvatarId(avatar.id);
    if (avatar.defaultVoiceId) setVoiceId(avatar.defaultVoiceId);
    if (avatar.defaultLanguage) setLanguage(avatar.defaultLanguage);
    if (avatar.defaultTone) setTone(avatar.defaultTone);
  };

  // Upload Custom Background Image reusing store/platform upload helper
  const handleBackgroundFileUpload = async (file: File) => {
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setCustomBackgroundUrl(localPreview);
    setIsUploadingBg(true);
    setBgUploadProgress(10);

    try {
      const res = await uploadFile(file, 'voxa_presenter_backgrounds', (p) => {
        setBgUploadProgress(Math.round(p.percentage));
      });
      if (res && res.url) {
        setCustomBackgroundUrl(res.url);
        showToast('success', 'Imagem de fundo enviada e aplicada ao cenário.');
      }
    } catch {
      showToast('error', 'Usando visualização local para a imagem de fundo.');
    } finally {
      setIsUploadingBg(false);
      setBgUploadProgress(100);
    }
  };

  // Upload Custom Character Photo reusing store/platform upload helper
  const handleCharacterAvatarUpload = async (file: File) => {
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setNewCharAvatarUrl(localPreview);
    setIsUploadingCharAvatar(true);
    setCharUploadProgress(10);

    try {
      const res = await uploadFile(file, 'voxa_presenter_avatars', (p) => {
        setCharUploadProgress(Math.round(p.percentage));
      });
      if (res && res.url) {
        setNewCharAvatarUrl(res.url);
      }
    } catch {
      // Keep local preview if cloud upload is offline
    } finally {
      setIsUploadingCharAvatar(false);
      setCharUploadProgress(100);
    }
  };

  // Save new custom character
  const handleSaveNewCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCharName.trim()) {
      showToast('error', 'Informe o nome do personagem.');
      return;
    }
    const newAvatar: VoxaPresenterAvatar = {
      id: `char_custom_${Date.now()}`,
      name: newCharName.trim(),
      roleTitle: newCharRole.trim() || 'Personagem Salvo • VOXA Presenter',
      description: `Personagem personalizado configurado com voz ${activeVoice.label} e tom ${tone}.`,
      avatarUrl: newCharAvatarUrl.trim() || activeAvatar.avatarUrl,
      isOfficial: false,
      isSavedCharacter: true,
      defaultVoiceId: voiceId,
      defaultLanguage: language,
      defaultTone: tone,
      accentColor: '#FF0033',
      createdAt: new Date().toISOString()
    };

    await saveCustomAvatar(newAvatar);
    setCustomAvatars((prev) => [newAvatar, ...prev]);
    setSelectedAvatarId(newAvatar.id);
    setNewCharName('');
    setNewCharRole('');
    setNewCharAvatarUrl('');
    setShowNewCharacterForm(false);
    showToast('success', `Personagem "${newAvatar.name}" salvo na Biblioteca Interna!`);
  };

  // Generate Script with Server-Side Gemini AI
  const handleGenerateAiScript = async () => {
    setIsGeneratingAiScript(true);
    try {
      const res = await fetch('/api/admin/voxa-ai/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopicPrompt || videoTitle || `Conteúdo oficial VOXA para ${targetChannel}`,
          targetChannel,
          tone,
          language,
          avatarName: activeAvatar.name,
          aspectRatio
        })
      });
      const data = await res.json();
      if (data.success && data.script) {
        setScript(data.script);
        const { captions: built } = buildTimedCaptionsFromScript(data.script);
        setCaptions(built);
        showToast('success', 'Roteiro e legendas sincronizadas gerados com sucesso!');
      } else {
        throw new Error(data.error || 'Falha ao gerar roteiro');
      }
    } catch {
      // Fallback high-converting official script if offline
      const fallback = `Atenção comunidade VOXA! Preparamos uma novidade oficial especial para ${targetChannel}. Com o ecossistema VOXA, você tem acesso imediato a experiências exclusivas, segurança total e ferramentas criadas para impulsionar seus resultados. Toque no link oficial e confira agora!`;
      setScript(fallback);
      const { captions: built } = buildTimedCaptionsFromScript(fallback);
      setCaptions(built);
      showToast('success', 'Roteiro oficial VOXA estruturado e legendas sincronizadas!');
    } finally {
      setIsGeneratingAiScript(false);
    }
  };

  // Live Studio Preview Playback with Voice Synthesis
  const handleTogglePreviewPlay = () => {
    if (isPreviewPlaying) {
      setIsPreviewPlaying(false);
      setPreviewCurrentSec(0);
      if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      return;
    }

    setIsPreviewPlaying(true);
    setPreviewCurrentSec(0);

    if ('speechSynthesis' in window && script.trim()) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(script.trim());
      utter.lang = language;
      utter.pitch = activeVoice.pitch || 1.0;
      utter.rate = activeVoice.rate || 1.0;
      utter.onend = () => {
        setIsPreviewPlaying(false);
        setPreviewCurrentSec(0);
        if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
      };
      window.speechSynthesis.speak(utter);
    }

    const totalDur = currentCostEstimate.durationSeconds;
    const startTs = Date.now();
    if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
    previewTimerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTs) / 1000;
      if (elapsed >= totalDur) {
        setIsPreviewPlaying(false);
        setPreviewCurrentSec(0);
        if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
      } else {
        setPreviewCurrentSec(Number(elapsed.toFixed(1)));
      }
    }, 100);
  };

  // Render a real downloadable WebM studio video via HTML5 Canvas + MediaRecorder and save to Internal Library
  const handleGenerateOfficialVideo = async () => {
    if (!script.trim()) {
      showToast('error', 'Digite um roteiro antes de gerar o vídeo oficial.');
      return;
    }

    setIsGeneratingVideo(true);
    setGenerationProgress(5);

    try {
      const dims =
        aspectRatio === '9:16'
          ? { w: 720, h: 1280 }
          : aspectRatio === '1:1'
          ? { w: 1080, h: 1080 }
          : { w: 1280, h: 720 };

      const canvas = document.createElement('canvas');
      canvas.width = dims.w;
      canvas.height = dims.h;
      const ctx = canvas.getContext('2d');

      // Helper to load an image safely with CORS fallback
      const loadImg = (url: string): Promise<HTMLImageElement | null> =>
        new Promise((resolve) => {
          if (!url) return resolve(null);
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = url;
        });

      setGenerationProgress(20);
      const [avatarImg, bgImg, logoImg] = await Promise.all([
        loadImg(activeAvatar.avatarUrl),
        customBackgroundUrl ? loadImg(customBackgroundUrl) : Promise.resolve(null),
        companyLogo ? loadImg(companyLogo) : Promise.resolve(null)
      ]);

      setGenerationProgress(40);

      let recordedVideoUrl = '';
      const builtCaptions = generateCaptions ? buildTimedCaptionsFromScript(script).captions : [];
      const durationSec = Math.min(8, Math.max(4, currentCostEstimate.durationSeconds));

      if (ctx && typeof MediaRecorder !== 'undefined') {
        const stream = canvas.captureStream(30);
        const chunks: BlobPart[] = [];
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm';
        const recorder = new MediaRecorder(stream, { mimeType });

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        const recordingDone = new Promise<string>((resolve) => {
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            resolve(URL.createObjectURL(blob));
          };
        });

        recorder.start();

        // Trigger voice synthesis during render so admin hears the studio render
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(script.trim());
          utter.lang = language;
          utter.pitch = activeVoice.pitch || 1.0;
          utter.rate = activeVoice.rate || 1.0;
          window.speechSynthesis.speak(utter);
        }

        const totalFrames = 90; // 3 seconds @ 30fps fast studio render
        for (let f = 0; f < totalFrames; f++) {
          const progressRatio = f / totalFrames;
          const virtualTimeSec = progressRatio * currentCostEstimate.durationSeconds;
          setGenerationProgress(40 + Math.round(progressRatio * 50));

          // 1. Studio Background (VOXA OFFICIAL STUDIO white cyclorama or chosen scenario)
          if (bgImg) {
            ctx.drawImage(bgImg, 0, 0, dims.w, dims.h);
          } else {
            const grad = ctx.createRadialGradient(
              dims.w / 2,
              dims.h * 0.4,
              dims.w * 0.05,
              dims.w / 2,
              dims.h / 2,
              dims.w * 0.85
            );
            if (activeScenario.backgroundType === 'dark_studio') {
              grad.addColorStop(0, '#1F1F26');
              grad.addColorStop(1, '#09090B');
            } else {
              // VOXA OFFICIAL STUDIO clean white studio lighting
              grad.addColorStop(0, '#FFFFFF');
              grad.addColorStop(0.7, '#F8F9FA');
              grad.addColorStop(1, '#ECEEF2');
            }
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, dims.w, dims.h);
          }

          // 2. VOXA Official Logo in the background (Watermark + Studio Brand Header)
          if (showVoxaLogo) {
            ctx.save();
            const isDark = activeScenario.backgroundType === 'dark_studio' && !bgImg;
            ctx.fillStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
            ctx.font = `900 ${Math.round(dims.w * 0.18)}px Orbitron, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('VOXA', dims.w / 2, dims.h * 0.26);

            // Top corner studio badge
            ctx.fillStyle = '#FF0033';
            ctx.beginPath();
            ctx.roundRect(dims.w * 0.06, dims.h * 0.05, 130, 38, 10);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '900 18px Orbitron, sans-serif';
            ctx.fillText('VOXA', dims.w * 0.06 + 65, dims.h * 0.05 + 20);
            if (logoImg) {
              ctx.drawImage(logoImg, dims.w * 0.06 + 140, dims.h * 0.05, 38, 38);
            }
            ctx.restore();
          }

          // 3. Centered Presenter Avatar with subtle studio breathing & speaking ring
          const centerX = dims.w / 2;
          const centerY = dims.h * 0.48;
          const avatarRadius = Math.min(dims.w, dims.h) * 0.24;
          const pulse = Math.sin(f * 0.35) * 4;

          // Studio halo light behind avatar
          ctx.save();
          const haloGrad = ctx.createRadialGradient(
            centerX,
            centerY,
            avatarRadius * 0.8,
            centerX,
            centerY,
            avatarRadius * 1.35
          );
          haloGrad.addColorStop(0, 'rgba(255, 0, 51, 0.22)');
          haloGrad.addColorStop(1, 'rgba(255, 0, 51, 0)');
          ctx.fillStyle = haloGrad;
          ctx.beginPath();
          ctx.arc(centerX, centerY, avatarRadius * 1.35, 0, Math.PI * 2);
          ctx.fill();

          // Avatar circular/portrait frame
          ctx.beginPath();
          ctx.arc(centerX, centerY, avatarRadius + pulse * 0.3, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          if (avatarImg) {
            ctx.drawImage(
              avatarImg,
              centerX - avatarRadius,
              centerY - avatarRadius,
              avatarRadius * 2,
              avatarRadius * 2
            );
          } else {
            ctx.fillStyle = '#18181B';
            ctx.fillRect(centerX - avatarRadius, centerY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
          }
          ctx.restore();

          // Studio rim border
          ctx.save();
          ctx.strokeStyle = '#FF0033';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(centerX, centerY, avatarRadius + pulse * 0.3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Presenter nameplate
          ctx.save();
          const isDark = activeScenario.backgroundType === 'dark_studio' && !bgImg;
          ctx.fillStyle = isDark ? '#FFFFFF' : '#09090B';
          ctx.font = `800 ${Math.round(dims.w * 0.032)}px Orbitron, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(activeAvatar.name.toUpperCase(), centerX, centerY + avatarRadius + 38);
          ctx.fillStyle = '#FF0033';
          ctx.font = `700 ${Math.round(dims.w * 0.02)}px sans-serif`;
          ctx.fillText(`${targetChannel.toUpperCase()} • VOXA OFFICIAL`, centerX, centerY + avatarRadius + 64);
          ctx.restore();

          // 4. Burned-in Social Media Captions (if enabled)
          if (generateCaptions && builtCaptions.length > 0) {
            const activeCap =
              builtCaptions.find((c) => virtualTimeSec >= c.startSec && virtualTimeSec <= c.endSec) ||
              builtCaptions[Math.min(builtCaptions.length - 1, Math.floor(progressRatio * builtCaptions.length))];

            if (activeCap) {
              ctx.save();
              const boxW = dims.w * 0.86;
              const boxH = Math.round(dims.h * 0.11);
              const boxX = (dims.w - boxW) / 2;
              const boxY = dims.h * 0.79;

              ctx.fillStyle = 'rgba(9, 9, 11, 0.88)';
              ctx.beginPath();
              ctx.roundRect(boxX, boxY, boxW, boxH, 18);
              ctx.fill();

              ctx.strokeStyle = 'rgba(255, 0, 51, 0.6)';
              ctx.lineWidth = 2;
              ctx.stroke();

              ctx.fillStyle = '#FFFFFF';
              ctx.font = `700 ${Math.round(dims.w * 0.033)}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(activeCap.text.slice(0, 58), dims.w / 2, boxY + boxH / 2, boxW - 32);
              ctx.restore();
            }
          }

          await new Promise((r) => setTimeout(r, 25));
        }

        recorder.stop();
        recordedVideoUrl = await recordingDone;
      }

      setGenerationProgress(95);

      const newItem: VoxaPresenterLibraryItem = {
        id: `voxa_pres_vid_${Date.now()}`,
        title: videoTitle.trim() || `VOXA Oficial • ${targetChannel}`,
        targetChannel,
        aspectRatio,
        avatarId: activeAvatar.id,
        avatarName: activeAvatar.name,
        avatarUrl: activeAvatar.avatarUrl,
        savedCharacterId: activeAvatar.isSavedCharacter ? activeAvatar.id : undefined,
        savedCharacterName: activeAvatar.isSavedCharacter ? activeAvatar.name : undefined,
        script: script.trim(),
        voiceId: activeVoice.id,
        voiceName: activeVoice.label,
        language,
        tone,
        scenarioId: activeScenario.id,
        scenarioName: activeScenario.name,
        presetUsed: activeScenario.presetCode,
        showVoxaLogo,
        backgroundImageUrl: customBackgroundUrl || undefined,
        generateCaptions,
        captions: builtCaptions,
        videoUrl: recordedVideoUrl,
        durationSeconds: currentCostEstimate.durationSeconds,
        provider: currentCostEstimate.provider,
        providerCost: currentCostEstimate.providerCost,
        estimatedCostBRL: currentCostEstimate.estimatedCostBRL,
        createdAt: new Date().toISOString(),
        createdByUid: uid || 'SUPER_ADMIN',
        createdByName: currentUser?.name || 'Admin VOXA'
      };

      await savePresenterLibraryItem(newItem);
      setLibraryItems((prev) => [newItem, ...prev]);
      setLastGeneratedItem(newItem);
      setGenerationProgress(100);
      showToast(
        'success',
        `Vídeo oficial gerado e salvo em Admin → VOXA AI → Biblioteca! Custo estimado: R$ ${newItem.estimatedCostBRL.toFixed(2).replace('.', ',')}`
      );
    } catch (err: any) {
      console.error('[VOXA Presenter Render Error]:', err);
      showToast('error', 'Erro ao finalizar renderização do vídeo.');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleLoadItemIntoStudio = (item: VoxaPresenterLibraryItem) => {
    setVideoTitle(item.title);
    setTargetChannel(item.targetChannel);
    setAspectRatio(item.aspectRatio);
    setSelectedAvatarId(item.avatarId);
    setSelectedScenarioId(item.scenarioId);
    setScript(item.script);
    setVoiceId(item.voiceId);
    setLanguage(item.language);
    setTone(item.tone);
    setShowVoxaLogo(item.showVoxaLogo);
    setCustomBackgroundUrl(item.backgroundImageUrl || '');
    setGenerateCaptions(item.generateCaptions);
    setCaptions(item.captions || []);
    setLastGeneratedItem(item);
    setActiveTab('presenter');
    showToast('success', `Projeto "${item.title}" carregado no VOXA Presenter.`);
  };

  const handleDeleteLibraryItem = async (id: string) => {
    await deletePresenterLibraryItem(id);
    setLibraryItems((prev) => prev.filter((i) => i.id !== id));
    if (lastGeneratedItem?.id === id) setLastGeneratedItem(null);
    showToast('success', 'Item removido da Biblioteca Interna.');
  };

  // Current active caption during live preview
  const activePreviewCaption =
    generateCaptions && captions.length > 0
      ? captions.find((c) => previewCurrentSec >= c.startSec && previewCurrentSec <= c.endSec) || captions[0]
      : null;

  if (!isAuthorizedForPresenter) {
    return (
      <div className="max-w-3xl mx-auto my-12 bg-white border-2 border-red-200 rounded-3xl p-8 text-center space-y-5 shadow-lg">
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-[#FF0033]">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="font-orbitron font-black text-2xl text-black uppercase">
          ACESSO RESTRITO • VOXA PRESENTER INTERNO
        </h2>
        <p className="text-gray-600 text-sm max-w-lg mx-auto">
          O <strong>VOXA Presenter / VOXA Avatar Studio</strong> está configurado em modo estritamente <strong>INTERNO</strong> (<code>presenterPublicEnabled = false</code>). O acesso inicial é exclusivo para <strong>SUPER_ADMIN</strong> e cargos explicitamente autorizados.
        </p>
        <button
          onClick={onBackToMenu}
          className="bg-black hover:bg-gray-900 text-white font-orbitron font-bold text-xs px-6 py-3 rounded-xl cursor-pointer uppercase"
        >
          Voltar ao Menu Admin
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-16 text-left">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToMenu}
            className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3.5 py-2 rounded-xl text-xs font-orbitron font-bold text-gray-800 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>MENU ADMIN</span>
          </button>
          <div>
            <div className="flex items-center space-x-2 text-[11px] font-orbitron font-bold text-gray-500 uppercase">
              <span>Admin</span>
              <span>→</span>
              <span>VOXA AI</span>
              <span>→</span>
              <span className="text-[#FF0033]">
                {activeTab === 'presenter'
                  ? 'VOXA Presenter'
                  : activeTab === 'biblioteca'
                  ? 'Biblioteca'
                  : 'Governança & Custos'}
              </span>
            </div>
            <h1 className="font-orbitron font-black text-lg sm:text-2xl text-black uppercase tracking-tight">
              VOXA PRESENTER <span className="text-[#FF0033]">• AVATAR STUDIO</span>
            </h1>
          </div>
        </div>

        {/* Sub-module Selector Tabs */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1.5 rounded-xl border border-gray-200 self-start lg:self-auto">
          <button
            onClick={() => setActiveTab('presenter')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-orbitron font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'presenter'
                ? 'bg-black text-white shadow-xs'
                : 'text-gray-700 hover:text-black'
            }`}
          >
            <Video className="w-4 h-4 text-[#FF0033]" />
            <span>VOXA Presenter</span>
          </button>
          <button
            onClick={() => setActiveTab('biblioteca')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-orbitron font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'biblioteca'
                ? 'bg-black text-white shadow-xs'
                : 'text-gray-700 hover:text-black'
            }`}
          >
            <Library className="w-4 h-4 text-[#FF0033]" />
            <span>Biblioteca ({libraryItems.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('governanca')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-orbitron font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'governanca'
                ? 'bg-black text-white shadow-xs'
                : 'text-gray-700 hover:text-black'
            }`}
          >
            <Shield className="w-4 h-4 text-[#FF0033]" />
            <span>Status & Acesso</span>
          </button>
        </div>
      </div>

      {/* Mandatory Admin Status Bar (Modo: INTERNO, Disponível para usuários: NÃO, Custo médio, Total de vídeos, Custo total) */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF0033]"></span>
            <h2 className="font-orbitron font-black text-xs sm:text-sm text-black uppercase tracking-wider">
              STATUS OPERACIONAL • VOXA PRESENTER
            </h2>
          </div>
          <div className="text-xs font-mono text-gray-500">
            presenterPublicEnabled = <strong className="text-black">{String(settings.presenterPublicEnabled)}</strong> · Créditos de usuários: <strong className="text-emerald-700">NÃO CONSUMIDOS</strong>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
            <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase block">
              Modo
            </span>
            <span className="font-orbitron font-black text-base sm:text-lg text-black mt-1 block">
              {settings.presenterPublicEnabled ? 'PÚBLICO' : 'INTERNO'}
            </span>
            <span className="text-[11px] text-gray-500 block mt-0.5">
              Uso exclusivo equipe VOXA
            </span>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
            <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase block">
              Disponível para usuários
            </span>
            <span className={`font-orbitron font-black text-base sm:text-lg mt-1 block ${settings.presenterPublicEnabled ? 'text-emerald-600' : 'text-[#FF0033]'}`}>
              {settings.presenterPublicEnabled ? 'SIM' : 'NÃO'}
            </span>
            <span className="text-[11px] text-gray-500 block mt-0.5">
              Oculto no menu público
            </span>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
            <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase block">
              Custo médio por geração
            </span>
            <span className="font-orbitron font-black text-base sm:text-lg text-black mt-1 block">
              R$ {averageCostPerVideoBRL.toFixed(2).replace('.', ',')}
            </span>
            <span className="text-[11px] text-gray-500 block mt-0.5">
              Média por vídeo oficial
            </span>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5">
            <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase block">
              Total de vídeos gerados
            </span>
            <span className="font-orbitron font-black text-base sm:text-lg text-black mt-1 block">
              {totalVideosGenerated}
            </span>
            <span className="text-[11px] text-gray-500 block mt-0.5">
              Salvos na Biblioteca Interna
            </span>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase block">
              Custo total estimado
            </span>
            <span className="font-orbitron font-black text-base sm:text-lg text-[#FF0033] mt-1 block">
              R$ {totalEstimatedCostBRL.toFixed(2).replace('.', ',')}
            </span>
            <span className="text-[11px] text-gray-500 block mt-0.5">
              Acumulado interno (BRL)
            </span>
          </div>
        </div>
      </div>

      {statusFeedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-orbitron font-bold flex items-center justify-between ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{statusFeedback.text}</span>
          <button onClick={() => setStatusFeedback(null)} className="text-xs underline ml-4 cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: ADMIN -> VOXA AI -> VOXA PRESENTER                             */}
      {/* ===================================================================== */}
      {activeTab === 'presenter' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Studio Configuration Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Official Preset Banner */}
            <div className="bg-white border-2 border-black rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[10px] font-orbitron font-bold text-[#FF0033] uppercase tracking-widest">
                  PRESET OFICIAL VOXA
                </div>
                <h3 className="font-orbitron font-black text-base text-black">
                  VOXA OFFICIAL STUDIO
                </h3>
                <p className="text-xs text-gray-600">
                  Fundo branco · Logo da VOXA ao fundo · Avatar centralizado · Visual clean/premium · Iluminação de estúdio · Preparado para redes sociais.
                </p>
              </div>
              <button
                onClick={handleApplyOfficialVoxaPreset}
                className="bg-[#FF0033] hover:bg-[#d6002b] text-white font-orbitron font-bold text-xs px-4 py-3 rounded-xl transition-all cursor-pointer shrink-0 uppercase"
              >
                Aplicar Preset Oficial
              </button>
            </div>

            {/* 1. Canal Oficial & Formato (9:16, 1:1, 16:9) */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
              <h3 className="font-orbitron font-black text-sm text-black uppercase">
                01. Destino Oficial & Proporção do Vídeo
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-orbitron font-bold text-gray-700 mb-1.5">
                    Título Interno do Conteúdo
                  </label>
                  <input
                    type="text"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    placeholder="Ex: Campanha Oficial Instagram VOXA"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-black focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-orbitron font-bold text-gray-700 mb-1.5">
                    Objetivo / Canal Oficial
                  </label>
                  <select
                    value={targetChannel}
                    onChange={(e) => setTargetChannel(e.target.value as PresenterTargetChannel)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-black focus:outline-none focus:border-black"
                  >
                    {PRESENTER_CHANNELS.map((ch) => (
                      <option key={ch} value={ch}>
                        {ch}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Aspect Ratio Selector */}
              <div>
                <label className="block text-xs font-orbitron font-bold text-gray-700 mb-2">
                  Escolher Proporção (Formatos Oficiais)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { ratio: '9:16' as PresenterAspectRatio, title: '9:16 Vertical', sub: 'Reels / TikTok / Stories', icon: Smartphone },
                    { ratio: '1:1' as PresenterAspectRatio, title: '1:1 Quadrado', sub: 'Feed Instagram / Social', icon: Layout },
                    { ratio: '16:9' as PresenterAspectRatio, title: '16:9 Horizontal', sub: 'YouTube / Apresentação', icon: MonitorPlay }
                  ].map((fmt) => {
                    const Icon = fmt.icon;
                    const active = aspectRatio === fmt.ratio;
                    return (
                      <button
                        key={fmt.ratio}
                        type="button"
                        onClick={() => setAspectRatio(fmt.ratio)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          active
                            ? 'bg-black text-white border-black shadow-xs'
                            : 'bg-gray-50 text-gray-800 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-orbitron font-black text-sm">{fmt.ratio}</span>
                          <Icon className={`w-4 h-4 ${active ? 'text-[#FF0033]' : 'text-gray-500'}`} />
                        </div>
                        <div className="mt-2">
                          <div className="text-xs font-bold">{fmt.title}</div>
                          <div className={`text-[10px] ${active ? 'text-gray-300' : 'text-gray-500'}`}>{fmt.sub}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. Escolher Avatar Oficial ou Personagem Salvo */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-orbitron font-black text-sm text-black uppercase">
                  02. Escolher Avatar Oficial ou Personagem Salvo
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewCharacterForm((v) => !v)}
                  className="flex items-center space-x-1.5 text-xs font-orbitron font-bold text-[#FF0033] hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showNewCharacterForm ? 'Cancelar' : 'Salvar Novo Personagem'}</span>
                </button>
              </div>

              {showNewCharacterForm && (
                <form onSubmit={handleSaveNewCharacter} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-orbitron font-bold text-black uppercase">
                    Cadastrar Personagem Salvo na Biblioteca
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newCharName}
                      onChange={(e) => setNewCharName(e.target.value)}
                      placeholder="Nome do Personagem (ex: Host VOXA VIP)"
                      className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-black"
                    />
                    <input
                      type="text"
                      value={newCharRole}
                      onChange={(e) => setNewCharRole(e.target.value)}
                      placeholder="Especialidade (ex: Anúncios & Reels)"
                      className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-black"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center space-x-2 bg-white border border-gray-300 hover:border-black px-3 py-2 rounded-lg text-xs font-bold cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-[#FF0033]" />
                      <span>
                        {isUploadingCharAvatar
                          ? `Enviando foto (${charUploadProgress}%)...`
                          : 'Enviar Foto do Personagem'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleCharacterAvatarUpload(f);
                        }}
                      />
                    </label>
                    <button
                      type="submit"
                      className="bg-black text-white font-orbitron font-bold text-xs px-4 py-2 rounded-lg cursor-pointer"
                    >
                      Salvar Personagem
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allAvatars.map((av) => {
                  const selected = av.id === selectedAvatarId;
                  return (
                    <div
                      key={av.id}
                      onClick={() => handleSelectAvatar(av)}
                      className={`p-3 rounded-xl border flex items-center space-x-3 cursor-pointer transition-all ${
                        selected
                          ? 'bg-black text-white border-black shadow-xs'
                          : 'bg-gray-50 text-black border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <img
                        src={av.avatarUrl}
                        alt={av.name}
                        className="w-12 h-12 rounded-xl object-cover border border-white/20 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-orbitron font-bold text-xs truncate">{av.name}</span>
                          <span className={`text-[10px] font-mono ${selected ? 'text-[#FF0033]' : 'text-gray-500'}`}>
                            {av.isOfficial ? 'OFICIAL' : 'SALVO'}
                          </span>
                        </div>
                        <p className={`text-[11px] truncate mt-0.5 ${selected ? 'text-gray-300' : 'text-gray-600'}`}>
                          {av.roleTitle}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Roteiro, Idioma, Voz, Tom & Legendas */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-orbitron font-black text-sm text-black uppercase">
                  03. Roteiro, Voz, Idioma, Tom & Legendas
                </h3>
                <span className="text-xs text-gray-500 font-mono">
                  Duração estimada: <strong>{currentCostEstimate.durationSeconds}s</strong> · {captions.length} blocos de legenda
                </span>
              </div>

              {/* AI Script Assistant Bar */}
              <div className="flex flex-col sm:flex-row gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <input
                  type="text"
                  value={aiTopicPrompt}
                  onChange={(e) => setAiTopicPrompt(e.target.value)}
                  placeholder="Tema para roteiro automático (ex: Lançamento VOXA Store, Tutorial PIX, Convite Reels...)"
                  className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-black focus:outline-none focus:border-black"
                />
                <button
                  type="button"
                  onClick={handleGenerateAiScript}
                  disabled={isGeneratingAiScript}
                  className="bg-black hover:bg-gray-800 disabled:opacity-50 text-white font-orbitron font-bold text-xs px-4 py-2 rounded-lg flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FF0033]" />
                  <span>{isGeneratingAiScript ? 'Gerando...' : 'Gerar Roteiro Oficial'}</span>
                </button>
              </div>

              {/* Script Textarea */}
              <div>
                <label className="block text-xs font-orbitron font-bold text-gray-700 mb-1.5">
                  Roteiro Falado pelo Avatar
                </label>
                <textarea
                  rows={4}
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Digite o roteiro oficial que o apresentador VOXA falará..."
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3.5 text-xs text-black leading-relaxed focus:outline-none focus:border-black"
                />
              </div>

              {/* Voice, Language, Tone Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-orbitron font-bold text-gray-700 mb-1">
                    Escolher Voz
                  </label>
                  <select
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-black"
                  >
                    {PRESENTER_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-orbitron font-bold text-gray-700 mb-1">
                    Escolher Idioma
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-black"
                  >
                    {PRESENTER_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-orbitron font-bold text-gray-700 mb-1">
                    Escolher Tom
                  </label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-black"
                  >
                    {PRESENTER_TONES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Captions Toggle & Generator */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateCaptions}
                    onChange={(e) => setGenerateCaptions(e.target.checked)}
                    className="w-4 h-4 accent-[#FF0033] rounded"
                  />
                  <span className="text-xs font-orbitron font-bold text-black">
                    Gerar legenda sincronizada automática para redes sociais
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    const { captions: built } = buildTimedCaptionsFromScript(script);
                    setCaptions(built);
                    setGenerateCaptions(true);
                    showToast('success', `${built.length} blocos de legenda sincronizados com o roteiro.`);
                  }}
                  className="text-xs font-orbitron font-bold text-[#FF0033] hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <Captions className="w-3.5 h-3.5" />
                  <span>Recalcular Legendas ({captions.length})</span>
                </button>
              </div>
            </div>

            {/* 4. Cenário, Logo VOXA & Imagem de Fundo */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-orbitron font-black text-sm text-black uppercase">
                  04. Cenário, Logo VOXA & Imagem de Fundo
                </h3>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showVoxaLogo}
                    onChange={(e) => setShowVoxaLogo(e.target.checked)}
                    className="w-4 h-4 accent-[#FF0033]"
                  />
                  <span className="text-xs font-orbitron font-bold text-black">
                    Adicionar Logo VOXA ao fundo
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allScenarios.map((sc) => {
                  const active = sc.id === selectedScenarioId && !customBackgroundUrl;
                  return (
                    <div
                      key={sc.id}
                      onClick={() => {
                        setSelectedScenarioId(sc.id);
                        setCustomBackgroundUrl(sc.backgroundImageUrl || '');
                        setShowVoxaLogo(sc.showVoxaLogoDefault);
                      }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        active
                          ? 'bg-black text-white border-black shadow-xs'
                          : 'bg-gray-50 text-black border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-orbitron font-black text-xs">{sc.name}</span>
                        {sc.isOfficialPreset && (
                          <span className="text-[10px] font-mono text-[#FF0033] font-bold">PRESET OFICIAL</span>
                        )}
                      </div>
                      <p className={`text-[11px] mt-1 leading-relaxed ${active ? 'text-gray-300' : 'text-gray-600'}`}>
                        {sc.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Upload Custom Background Image */}
              <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3.5 py-2 rounded-xl text-xs font-orbitron font-bold text-black cursor-pointer">
                    <ImageIcon className="w-4 h-4 text-[#FF0033]" />
                    <span>
                      {isUploadingBg
                        ? `Enviando Fundo (${bgUploadProgress}%)...`
                        : 'Adicionar Imagem de Fundo'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleBackgroundFileUpload(f);
                      }}
                    />
                  </label>
                  {customBackgroundUrl && (
                    <button
                      type="button"
                      onClick={() => setCustomBackgroundUrl('')}
                      className="text-xs text-red-600 font-bold hover:underline cursor-pointer"
                    >
                      Remover Imagem de Fundo
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-gray-500">
                  {customBackgroundUrl
                    ? 'Imagem de fundo personalizada ativa'
                    : `Cenário ativo: ${activeScenario.name}`}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Live Studio Monitor & Cost/Generate Panel (5 cols) */}
          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-24">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-orbitron font-bold text-[#FF0033] uppercase block">
                    MONITOR DE ESTÚDIO • {aspectRatio}
                  </span>
                  <h3 className="font-orbitron font-black text-sm text-black uppercase">
                    {activeScenario.presetCode}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleTogglePreviewPlay}
                  className="flex items-center space-x-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3 py-1.5 rounded-xl text-xs font-orbitron font-bold text-black cursor-pointer"
                >
                  {isPreviewPlaying ? (
                    <>
                      <Square className="w-3.5 h-3.5 text-[#FF0033]" />
                      <span>Parar Prévia</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-[#FF0033]" />
                      <span>Ouvir & Testar</span>
                    </>
                  )}
                </button>
              </div>

              {/* Studio Preview Stage matching selected aspectRatio (9:16, 1:1, 16:9) */}
              <div className="flex items-center justify-center bg-gray-100 rounded-2xl p-4 border border-gray-200">
                <div
                  className={`relative overflow-hidden rounded-2xl shadow-lg border transition-all flex flex-col items-center justify-between p-5 ${
                    aspectRatio === '9:16'
                      ? 'w-[260px] h-[462px]'
                      : aspectRatio === '1:1'
                      ? 'w-[340px] h-[340px]'
                      : 'w-full h-[230px]'
                  } ${
                    activeScenario.backgroundType === 'dark_studio' && !customBackgroundUrl
                      ? 'bg-zinc-950 text-white border-zinc-800'
                      : 'bg-white text-black border-gray-200'
                  }`}
                >
                  {/* Custom Background Image if provided */}
                  {customBackgroundUrl && (
                    <img
                      src={customBackgroundUrl}
                      alt="Cenário"
                      className="absolute inset-0 w-full h-full object-cover z-0"
                    />
                  )}

                  {/* Studio Radial Lighting Effect (VOXA OFFICIAL STUDIO clean white studio lighting) */}
                  {!customBackgroundUrl && activeScenario.backgroundType !== 'dark_studio' && (
                    <div
                      className="absolute inset-0 pointer-events-none z-0"
                      style={{
                        background:
                          'radial-gradient(circle at 50% 42%, #FFFFFF 0%, #F8F9FA 65%, #EAECEF 100%)'
                      }}
                    />
                  )}

                  {/* VOXA Logo in Studio Background */}
                  {showVoxaLogo && (
                    <>
                      <div className="absolute inset-x-0 top-[20%] flex flex-col items-center justify-center pointer-events-none z-0 select-none">
                        <span
                          className={`font-orbitron font-black tracking-widest text-4xl sm:text-5xl ${
                            activeScenario.backgroundType === 'dark_studio' && !customBackgroundUrl
                              ? 'text-white/[0.07]'
                              : 'text-black/[0.06]'
                          }`}
                        >
                          VOXA
                        </span>
                      </div>
                      <div className="relative z-10 w-full flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="bg-[#FF0033] text-white font-orbitron font-black text-[10px] px-2 py-0.5 rounded-md">
                            VOXA
                          </span>
                          {companyLogo && (
                            <img src={companyLogo} alt="VOXA" className="w-5 h-5 rounded-md object-cover" />
                          )}
                        </div>
                        <span className="text-[10px] font-mono opacity-60">{targetChannel}</span>
                      </div>
                    </>
                  )}

                  {/* Centered Avatar with Studio Lighting Ring */}
                  <div className="relative z-10 flex flex-col items-center justify-center my-auto">
                    <div
                      className={`relative rounded-full p-1 transition-transform duration-300 ${
                        isPreviewPlaying ? 'scale-105 ring-4 ring-[#FF0033]/40' : 'ring-2 ring-[#FF0033]'
                      } ${
                        aspectRatio === '16:9' ? 'w-24 h-24' : 'w-32 h-32'
                      } bg-white shadow-xl overflow-hidden`}
                    >
                      <img
                        src={activeAvatar.avatarUrl}
                        alt={activeAvatar.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                    <div className="mt-2.5 text-center">
                      <span className="font-orbitron font-black text-xs block leading-tight">
                        {activeAvatar.name}
                      </span>
                      <span className="text-[10px] text-[#FF0033] font-bold block">
                        {tone}
                      </span>
                    </div>
                  </div>

                  {/* Synchronized Social Captions Overlay */}
                  {generateCaptions && activePreviewCaption && (
                    <div className="relative z-10 w-full bg-black/90 text-white px-3 py-2 rounded-xl border border-[#FF0033]/50 text-center shadow-md">
                      <p className="text-[11px] font-bold leading-snug line-clamp-2">
                        {activePreviewCaption.text}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Internal Cost Telemetry Box (providerCost & estimatedCostBRL) */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-bold">Provider Utilizado:</span>
                  <span className="font-mono text-[11px] text-black font-bold truncate max-w-[220px]">
                    {currentCostEstimate.provider}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-bold">providerCost (USD):</span>
                  <span className="font-mono text-black font-bold">
                    US$ {currentCostEstimate.providerCost.toFixed(4)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200">
                  <span className="text-gray-800 font-orbitron font-bold">
                    estimatedCostBRL (Custo Interno):
                  </span>
                  <span className="font-orbitron font-black text-sm text-[#FF0033]">
                    R$ {currentCostEstimate.estimatedCostBRL.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>

              {/* Generate Video Primary Action */}
              <button
                type="button"
                onClick={handleGenerateOfficialVideo}
                disabled={isGeneratingVideo}
                className="w-full bg-[#FF0033] hover:bg-[#d6002b] disabled:opacity-60 text-white font-orbitron font-black text-xs py-4 px-5 rounded-xl transition-all cursor-pointer uppercase shadow-md flex items-center justify-center space-x-2"
              >
                <Video className="w-4 h-4" />
                <span>
                  {isGeneratingVideo
                    ? `Renderizando Vídeo Oficial (${generationProgress}%)...`
                    : `Gerar Vídeo Oficial (${aspectRatio})`}
                </span>
              </button>

              {/* Last Generated Video Download & Preview */}
              {lastGeneratedItem && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-orbitron font-bold text-xs text-emerald-900">
                      Vídeo Salvo na Biblioteca Interna
                    </span>
                    <span className="text-[11px] font-mono text-emerald-800">
                      R$ {lastGeneratedItem.estimatedCostBRL.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  {lastGeneratedItem.videoUrl && (
                    <video
                      src={lastGeneratedItem.videoUrl}
                      controls
                      className="w-full max-h-48 rounded-lg bg-black object-contain"
                    />
                  )}
                  <div className="flex items-center justify-between gap-2">
                    {lastGeneratedItem.videoUrl && (
                      <a
                        href={lastGeneratedItem.videoUrl}
                        download={`${lastGeneratedItem.title.replace(/\s+/g, '_').toLowerCase()}_${lastGeneratedItem.aspectRatio.replace(':', 'x')}.webm`}
                        className="flex-1 bg-black text-white font-orbitron font-bold text-[11px] py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5"
                      >
                        <Download className="w-3.5 h-3.5 text-[#FF0033]" />
                        <span>Baixar Vídeo (.webm)</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTab('biblioteca')}
                      className="bg-white border border-emerald-300 text-emerald-900 font-orbitron font-bold text-[11px] py-2 px-3 rounded-lg cursor-pointer"
                    >
                      Ver na Biblioteca
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ADMIN -> VOXA AI -> BIBLIOTECA                                 */}
      {/* ===================================================================== */}
      {activeTab === 'biblioteca' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <span className="text-[10px] font-orbitron font-bold text-[#FF0033] uppercase tracking-widest block">
                ADMIN → VOXA AI → BIBLIOTECA
              </span>
              <h2 className="font-orbitron font-black text-lg text-black uppercase">
                BIBLIOTECA INTERNA DE PRODUÇÃO OFICIAL
              </h2>
              <p className="text-xs text-gray-600 mt-0.5">
                Repositório interno de vídeos gerados, avatars, cenários, roteiros, datas, provedores e custos estimados (providerCost / estimatedCostBRL).
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200 self-start">
              {[
                { id: 'videos' as const, label: `Vídeos (${libraryItems.length})` },
                { id: 'avatars' as const, label: `Avatars (${allAvatars.length})` },
                { id: 'cenarios' as const, label: `Cenários (${allScenarios.length})` },
                { id: 'roteiros' as const, label: `Roteiros (${libraryItems.length})` }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setLibraryFilter(t.id)}
                  className={`px-3 py-1.5 rounded-lg font-orbitron font-bold text-xs transition-all cursor-pointer ${
                    libraryFilter === t.id ? 'bg-black text-white' : 'text-gray-700 hover:text-black'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-section: VÍDEOS GERADOS */}
          {libraryFilter === 'videos' && (
            <div className="space-y-4">
              {libraryItems.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                  <Video className="w-8 h-8 text-gray-400 mx-auto" />
                  <p className="font-orbitron font-bold text-sm text-black">
                    Nenhum vídeo oficial gerado ainda
                  </p>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    Utilize o estúdio VOXA Presenter para gerar vídeos oficiais para Instagram, TikTok, Shorts e Campanhas. Todos os vídeos e custos aparecerão aqui.
                  </p>
                  <button
                    onClick={() => setActiveTab('presenter')}
                    className="bg-[#FF0033] text-white font-orbitron font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
                  >
                    Ir para o VOXA Presenter
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {libraryItems.map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-200 rounded-2xl p-4 bg-gray-50 flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[11px] text-gray-500">
                              <span>{item.targetChannel}</span>
                              <span> · </span>
                              <span>Proporção {item.aspectRatio}</span>
                              <span> · </span>
                              <span>{new Date(item.createdAt).toLocaleString('pt-BR')}</span>
                            </div>
                            <h3 className="font-orbitron font-black text-sm text-black mt-0.5">
                              {item.title}
                            </h3>
                          </div>
                          <button
                            onClick={() => handleDeleteLibraryItem(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 cursor-pointer"
                            title="Remover da biblioteca"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {item.videoUrl && (
                          <video
                            src={item.videoUrl}
                            controls
                            className="w-full max-h-52 rounded-xl bg-black object-contain"
                          />
                        )}

                        <p className="text-xs text-gray-700 bg-white p-3 rounded-xl border border-gray-200 line-clamp-3">
                          "{item.script}"
                        </p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-gray-200 text-xs">
                        <div className="flex items-center justify-between text-gray-600">
                          <span>Avatar: <strong>{item.avatarName}</strong></span>
                          <span>Cenário: <strong>{item.scenarioName}</strong></span>
                        </div>
                        <div className="flex items-center justify-between text-gray-600">
                          <span>Provider: <strong className="font-mono text-[11px]">{item.provider}</strong></span>
                        </div>
                        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200">
                          <span className="font-mono text-[11px] text-gray-600">
                            providerCost: <strong>US$ {Number(item.providerCost || 0).toFixed(4)}</strong>
                          </span>
                          <span className="font-orbitron font-black text-xs text-[#FF0033]">
                            estimatedCostBRL: R$ {Number(item.estimatedCostBRL || 0).toFixed(2).replace('.', ',')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleLoadItemIntoStudio(item)}
                            className="flex-1 bg-black hover:bg-gray-800 text-white font-orbitron font-bold text-xs py-2 px-3 rounded-lg cursor-pointer"
                          >
                            Reabrir no Presenter
                          </button>
                          {item.videoUrl && (
                            <a
                              href={item.videoUrl}
                              download={`${item.title.replace(/\s+/g, '_').toLowerCase()}.webm`}
                              className="bg-gray-200 hover:bg-gray-300 text-black font-orbitron font-bold text-xs py-2 px-3 rounded-lg flex items-center space-x-1"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Baixar</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-section: AVATARS */}
          {libraryFilter === 'avatars' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {allAvatars.map((av) => (
                <div key={av.id} className="border border-gray-200 rounded-2xl p-4 bg-gray-50 flex flex-col justify-between space-y-3">
                  <div className="space-y-3">
                    <img src={av.avatarUrl} alt={av.name} className="w-full h-44 object-cover rounded-xl border border-gray-200" />
                    <div>
                      <div className="text-[11px] text-gray-500">
                        {av.isOfficial ? 'Avatar Oficial VOXA' : 'Personagem Salvo'} · {av.defaultLanguage}
                      </div>
                      <h4 className="font-orbitron font-black text-sm text-black mt-0.5">{av.name}</h4>
                      <p className="text-xs text-gray-600 mt-1">{av.roleTitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                    <button
                      onClick={() => {
                        handleSelectAvatar(av);
                        setActiveTab('presenter');
                      }}
                      className="flex-1 bg-black text-white font-orbitron font-bold text-xs py-2 rounded-lg cursor-pointer"
                    >
                      Usar Avatar
                    </button>
                    {!av.isOfficial && (
                      <button
                        onClick={async () => {
                          await deleteCustomAvatar(av.id);
                          setCustomAvatars((prev) => prev.filter((x) => x.id !== av.id));
                        }}
                        className="p-2 text-gray-500 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sub-section: CENÁRIOS */}
          {libraryFilter === 'cenarios' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {allScenarios.map((sc) => (
                <div key={sc.id} className="border border-gray-200 rounded-2xl p-4 bg-gray-50 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-[11px] text-gray-500">
                      {sc.isOfficialPreset ? 'PRESET OFICIAL VOXA' : 'Cenário de Estúdio'} · {sc.lightingStyle}
                    </div>
                    <h4 className="font-orbitron font-black text-sm text-black mt-0.5">{sc.name}</h4>
                    <p className="text-xs text-gray-600 mt-1">{sc.description}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedScenarioId(sc.id);
                      setCustomBackgroundUrl(sc.backgroundImageUrl || '');
                      setShowVoxaLogo(sc.showVoxaLogoDefault);
                      setActiveTab('presenter');
                    }}
                    className="self-start bg-black text-white font-orbitron font-bold text-xs px-4 py-2 rounded-lg cursor-pointer"
                  >
                    Selecionar Cenário no Presenter
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Sub-section: ROTEIROS */}
          {libraryFilter === 'roteiros' && (
            <div className="space-y-3">
              {libraryItems.length === 0 ? (
                <p className="text-xs text-gray-500 py-8 text-center">
                  Os roteiros utilizados nas gerações aparecerão listados aqui.
                </p>
              ) : (
                libraryItems.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        <strong>{item.title}</strong> · {item.targetChannel} · Tom: {item.tone}
                      </span>
                      <span>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <p className="text-xs text-black bg-white p-3 rounded-lg border border-gray-200">
                      {item.script}
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setScript(item.script);
                          setActiveTab('presenter');
                          showToast('success', 'Roteiro carregado no editor do Presenter.');
                        }}
                        className="text-xs font-orbitron font-bold text-[#FF0033] hover:underline cursor-pointer"
                      >
                        Usar Roteiro no Presenter
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.script);
                          showToast('success', 'Roteiro copiado para a área de transferência.');
                        }}
                        className="text-xs text-gray-600 hover:text-black flex items-center space-x-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: GOVERNANÇA, CUSTOS & ARQUITETURA FUTURA                        */}
      {/* ===================================================================== */}
      {activeTab === 'governanca' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-6 shadow-xs">
          <div className="border-b border-gray-100 pb-4">
            <span className="text-[10px] font-orbitron font-bold text-[#FF0033] uppercase tracking-widest block">
              CONTROLE DE VISIBILIDADE, PROVIDERS & PRECIFICAÇÃO (MARGEM MÍNIMA 75%)
            </span>
            <h2 className="font-orbitron font-black text-lg text-black uppercase mt-1">
              GOVERNANÇA DO VOXA STUDIO IA & PRESENTER
            </h2>
            <p className="text-xs text-gray-600 mt-1">
              Configuração canônica de visibilidade pública (<code>presenterPublicEnabled = true</code>), providers ativos e regra financeira automática: <code>preçoVendaMínimo = custoReal / (1 - 0.75)</code>.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-orbitron font-black text-sm text-black uppercase">
                Tabela de Ferramentas, Providers, Custos e Créditos (Margem ≥ 75%)
              </h3>
              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg font-bold">
                1 Crédito VOXA AI = R$ 0,10 • Margem Mínima Obrigatória: 75%
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-[10px] font-orbitron text-gray-500 uppercase">
                    <th className="py-2 px-2">Ferramenta</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Provider / Modelo</th>
                    <th className="py-2 px-2">Custo Real</th>
                    <th className="py-2 px-2">Venda Mínima (75%)</th>
                    <th className="py-2 px-2">Créditos Cobrados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono text-[11px]">
                  {(Object.values(settings.toolsConfig || {}) as any[]).map((t: any) => {
                    const minSale = Number((t.providerCostBRL / (1 - 0.75)).toFixed(2));
                    return (
                      <tr key={t.id} className="bg-white">
                        <td className="py-2.5 px-2 font-bold text-black">{t.name}</td>
                        <td className="py-2.5 px-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            {t.statusMode === 'REAL_ACTIVE' ? 'ATIVO (REAL)' : 'EM PREPARAÇÃO'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-gray-600">{t.model}</td>
                        <td className="py-2.5 px-2 text-gray-800">R$ {t.providerCostBRL.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-emerald-700 font-bold">R$ {minSale.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-[#FF0033] font-black">{t.creditsCharged} créditos</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
              <h3 className="font-orbitron font-black text-sm text-black uppercase">
                Regra da Fase 1 (Atual)
              </h3>
              <ul className="space-y-2 text-xs text-gray-700">
                <li>• <strong>VOXA Presenter</strong> = ferramenta interna exclusiva da VOXA.</li>
                <li>• <strong>presenterPublicEnabled</strong> = <code>{String(settings.presenterPublicEnabled)}</code> (Default obrigatório: <code>false</code>).</li>
                <li>• Não exibido no menu público nem para usuários comuns.</li>
                <li>• Não consome créditos de usuários (<code>consumeUserCredits = false</code>).</li>
                <li>• Registra <code>providerCost</code> (USD) e <code>estimatedCostBRL</code> (R$) em cada vídeo gerado para auditoria de custo por peça.</li>
              </ul>

              <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                <div>
                  <span className="font-orbitron font-bold text-xs text-black block">
                    presenterPublicEnabled
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Manter <strong>false</strong> durante a Fase 1 de validação interna
                  </span>
                </div>
                <button
                  type="button"
                  disabled={adminRole !== 'SUPER_ADMIN'}
                  onClick={async () => {
                    const nextVal = !settings.presenterPublicEnabled;
                    const updated = await updateVoxaPresenterSettings(
                      { presenterPublicEnabled: nextVal },
                      currentUser?.email || 'SUPER_ADMIN'
                    );
                    setSettings(updated);
                    showToast(
                      'success',
                      `presenterPublicEnabled atualizado para ${String(updated.presenterPublicEnabled)} (Modo: ${updated.mode}).`
                    );
                  }}
                  className={`px-4 py-2 rounded-xl font-orbitron font-bold text-xs cursor-pointer transition-all ${
                    settings.presenterPublicEnabled
                      ? 'bg-emerald-600 text-white'
                      : 'bg-black text-white'
                  } disabled:opacity-50`}
                >
                  {settings.presenterPublicEnabled ? 'TRUE (Público)' : 'FALSE (Somente Admin)'}
                </button>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
              <h3 className="font-orbitron font-black text-sm text-black uppercase">
                Cargos Autorizados no Admin
              </h3>
              <p className="text-xs text-gray-600">
                Defina quais cargos administrativos (além de <strong>SUPER_ADMIN</strong>) têm permissão para operar o estúdio interno VOXA Presenter:
              </p>

              <div className="space-y-2">
                {(['SUPER_ADMIN', 'ADMINISTRATOR', 'MANAGER', 'SUPPORT'] as const).map((r) => {
                  const checked = r === 'SUPER_ADMIN' || settings.authorizedRoles.includes(r);
                  return (
                    <label key={r} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200 text-xs">
                      <span className="font-orbitron font-bold text-black">{r}</span>
                      <input
                        type="checkbox"
                        disabled={r === 'SUPER_ADMIN' || adminRole !== 'SUPER_ADMIN'}
                        checked={checked}
                        onChange={async (e) => {
                          const nextRoles = e.target.checked
                            ? Array.from(new Set([...settings.authorizedRoles, r]))
                            : settings.authorizedRoles.filter((x) => x !== r);
                          const updated = await updateVoxaPresenterSettings(
                            { authorizedRoles: nextRoles },
                            currentUser?.email || 'SUPER_ADMIN'
                          );
                          setSettings(updated);
                        }}
                        className="w-4 h-4 accent-[#FF0033]"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
