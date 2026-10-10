import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Mic2, MessageSquare, FileCheck, Flame, ArrowLeft, ExternalLink, Download, 
  Sparkles, Plus, Volume2, Edit, Trash2, Check, RefreshCw, Upload, Music, Play, 
  BarChart3, Settings, Calendar, Disc, AlertCircle, ListPlus, X, HelpCircle, HardDrive,
  Folder, FolderPlus, Loader2, Shield, Youtube, Coins
} from 'lucide-react';
import { db, storage, auth, GoogleAuthProvider, signInWithPopup } from '../../lib/firebase';
import { uploadFile, uploadFileToGoogleDrive } from '../../utils/upload';
import { 
  fetchArtists, saveArtist, deleteArtistDoc, 
  fetchMusicStreams, saveMusicStream, deleteMusicStreamDoc,
  fetchCommunities, saveCommunity, deleteCommunityDoc
} from '../../utils/musicDb';
import { fetchFirestoreUsers } from '../../utils/storeDb';
import { DetailedArtist, MusicStream, ReleaseTrack, Community } from '../../types';
import { INITIAL_RELEASES } from '../../data/mockData';
import { TikTokReleases } from './TikTokReleases';
import { MusicShareSection } from './MusicShareSection';
import { YouTubeVerificationSection } from './YouTubeVerificationSection';
import { DistributionClearanceSection } from './DistributionClearanceSection';
import { PersonSelectAutocomplete } from '../common/PersonSelectAutocomplete';

interface MusicModuleProps {
  onBackToMenu: () => void;
  onMascotMoodChange: (mood: 'normal' | 'attentive' | 'happy' | 'angry' | 'pointing', speech: string) => void;
}

export const MusicModule: React.FC<MusicModuleProps> = ({ onBackToMenu, onMascotMoodChange }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'artistas' | 'streams' | 'envios' | 'releases' | 'share' | 'youtube' | 'clearance' | 'acapellas' | 'stems' | 'presskit' | 'grupos' | 'config'>('overview');
  
  // Data State
  const [artists, setArtists] = useState<DetailedArtist[]>([]);
  const [streams, setStreams] = useState<MusicStream[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modals / Forms State
  const [isArtistModalOpen, setIsArtistModalOpen] = useState(false);
  const [editingArtist, setEditingArtist] = useState<DetailedArtist | null>(null);
  
  const [isStreamModalOpen, setIsStreamModalOpen] = useState(false);
  const [editingStream, setEditingStream] = useState<MusicStream | null>(null);

  // Communities State
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<Community | null>(null);
  const [communityForm, setCommunityForm] = useState({
    name: '',
    coverUrl: '',
    whatsappUrl: '',
    discordUrl: '',
    status: 'Ativo' as 'Ativo' | 'Inativo'
  });

  // Cover image preview and upload states for submitted music
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isUploadingSubCoverId, setIsUploadingSubCoverId] = useState<string | null>(null);

  // Upload Progress State
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadingField, setUploadingField] = useState<'photo' | 'cover' | 'audio' | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Google Drive State & Verification
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [isConnectingDrive, setIsConnectingDrive] = useState<boolean>(false);
  const [driveQuota, setDriveQuota] = useState<{ limit: number; usage: number } | null>(null);
  const [driveUser, setDriveUser] = useState<{ name: string; email: string } | null>(null);

  const checkDriveConnection = async (token: string) => {
    try {
      const response = await fetch(
        'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress),storageQuota',
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setDriveToken(token);
        if (data.user) {
          setDriveUser({
            name: data.user.displayName || '',
            email: data.user.emailAddress || ''
          });
        }
        if (data.storageQuota) {
          setDriveQuota({
            limit: parseInt(data.storageQuota.limit || '0', 10),
            usage: parseInt(data.storageQuota.usage || '0', 10)
          });
        }
      } else {
        sessionStorage.removeItem('lockdown_google_oauth_token');
        setDriveToken(null);
        setDriveUser(null);
        setDriveQuota(null);
      }
    } catch (err) {
      console.warn("Failed to check Google Drive about info:", err);
      setDriveToken(token);
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem('lockdown_google_oauth_token');
    if (token) {
      checkDriveConnection(token);
    }
  }, []);

  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (credential?.accessToken) {
        sessionStorage.setItem('lockdown_google_oauth_token', credential.accessToken);
        triggerToast("Google Drive conectado com sucesso!");
        onMascotMoodChange('happy', "Google Drive conectado e pronto para uso!");
        await checkDriveConnection(credential.accessToken);
      } else {
        throw new Error('Não foi possível obter o token do Drive.');
      }
    } catch (err: any) {
      console.error(err);
      triggerError(err.message || 'Erro ao conectar Google Drive.');
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = () => {
    sessionStorage.removeItem('lockdown_google_oauth_token');
    setDriveToken(null);
    setDriveUser(null);
    setDriveQuota(null);
    triggerToast("Google Drive desconectado.");
    onMascotMoodChange('normal', "Conexão com Google Drive removida.");
  };

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const artData = await fetchArtists();
      const stData = await fetchMusicStreams();
      const commData = await fetchCommunities();
      setArtists(artData);
      setStreams(stData);
      setCommunities(commData);
      try {
        const firestoreUsers = await fetchFirestoreUsers();
        setUsers(firestoreUsers);
      } catch (e) {
        console.warn("Failed to load users in music module:", e);
      }
    } catch (e) {
      console.error("Error loading music database", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const triggerToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  };

  // Helper for real Firebase Storage uploads with fallbacks using centralized uploadFile function
  const handleUploadFile = async (file: File, folder: string, fieldType: 'photo' | 'cover' | 'audio'): Promise<string> => {
    setIsUploading(true);
    setUploadingField(fieldType);
    setUploadProgress(0);

    try {
      // Map fieldType to correct categories for our centralized uploadFile function
      const category = fieldType === 'photo' ? 'artist' : fieldType;
      const subFolder = fieldType === 'photo' ? 'Artistas' : 'Streams';

      const result = await uploadFile(file, category, (progress) => {
        setUploadProgress(progress.percentage);
      }, {
        module: 'music',
        subFolder: subFolder
      });

      if (!result || !result.url) {
        throw new Error("O upload falhou e nenhuma URL válida foi retornada.");
      }

      onMascotMoodChange('happy', 'Sincronização de mídia concluída!');
      return result.url;
    } catch (err: any) {
      console.error("handleUploadFile failed in MusicModule:", err);
      onMascotMoodChange('angry', 'Não foi possível enviar o arquivo.');
      throw new Error(`Erro no envio seguro da mídia: ${err.message || 'Falha de conexão.'}`);
    } finally {
      setIsUploading(false);
      setUploadingField(null);
    }
  };

  // ----------------------------------------------------
  // ARTIST CRUD OPERATIONS
  // ----------------------------------------------------
  const [artistForm, setArtistForm] = useState({
    name: '',
    realName: '',
    artistType: 'MC',
    company: 'Lockdown',
    bio: '',
    image: '',
    spotifyUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
    youtubeUrl: '',
    monthlyListeners: 0,
    featured: false,
    status: 'Ativo' as 'Ativo' | 'Rascunho' | 'Oculto',
    driveFolderId: '',
    driveFolderName: '',
    userId: ''
  });

  const openAddArtist = () => {
    setEditingArtist(null);
    setArtistForm({
      name: '',
      realName: '',
      artistType: 'MC',
      company: 'Lockdown',
      bio: '',
      image: '',
      spotifyUrl: '',
      instagramUrl: '',
      tiktokUrl: '',
      youtubeUrl: '',
      monthlyListeners: 0,
      featured: false,
      status: 'Ativo',
      driveFolderId: '',
      driveFolderName: '',
      userId: ''
    });
    setIsArtistModalOpen(true);
  };

  const openEditArtist = (art: DetailedArtist) => {
    setEditingArtist(art);
    setArtistForm({
      name: art.name,
      realName: art.realName || '',
      artistType: art.artistType,
      company: art.company || 'Lockdown',
      bio: art.bio,
      image: art.image,
      spotifyUrl: art.spotifyUrl,
      instagramUrl: art.instagramUrl || '',
      tiktokUrl: art.tiktokUrl || '',
      youtubeUrl: art.youtubeUrl || '',
      monthlyListeners: art.monthlyListeners,
      featured: art.featured,
      status: art.status,
      driveFolderId: art.driveFolderId || '',
      driveFolderName: art.driveFolderName || '',
      userId: art.userId || ''
    });
    setIsArtistModalOpen(true);
  };

  const handleArtistPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await handleUploadFile(file, 'artists', 'photo');
      setArtistForm(prev => ({ ...prev, image: url }));
      triggerToast("Foto do artista enviada!");
      onMascotMoodChange('happy', "Ficou top essa foto! Já adicionei ao rascunho.");
    } catch (err) {
      triggerError("Falha ao enviar foto.");
    } finally {
      setIsUploading(false);
      setUploadingField(null);
    }
  };

  const [isCreatingArtistFolder, setIsCreatingArtistFolder] = useState(false);

  const handleCreateArtistFolder = async () => {
    if (!artistForm.name.trim()) {
      triggerError("Por favor, preencha o nome do artista antes de criar a pasta.");
      return;
    }

    const token = sessionStorage.getItem('lockdown_google_oauth_token');
    if (!token) {
      triggerError("O Google Drive não está conectado nesta sessão. Vá ao módulo central de arquivos do Drive e conecte sua conta Google primeiro.");
      return;
    }

    setIsCreatingArtistFolder(true);
    try {
      // Step A: Find or create LOCKDOWN PRODUTORA parent directory
      let mainFolderId = '';
      const checkMainRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='LOCKDOWN PRODUTORA' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (checkMainRes.ok) {
        const checkMainData = await checkMainRes.json();
        if (checkMainData.files && checkMainData.files.length > 0) {
          mainFolderId = checkMainData.files[0].id;
        }
      }

      if (!mainFolderId) {
        // Create LOCKDOWN PRODUTORA
        const createMainRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'LOCKDOWN PRODUTORA',
            mimeType: 'application/vnd.google-apps.folder'
          })
        });
        if (createMainRes.ok) {
          const createMainData = await createMainRes.json();
          mainFolderId = createMainData.id;
        } else {
          throw new Error("Não foi possível criar a pasta raiz LOCKDOWN PRODUTORA no Drive.");
        }
      }

      // Step B: Find or create "Artistas" folder inside LOCKDOWN PRODUTORA
      let artistsFolderId = '';
      const checkArtistsRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='Artistas' and '${mainFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (checkArtistsRes.ok) {
        const checkArtistsData = await checkArtistsRes.json();
        if (checkArtistsData.files && checkArtistsData.files.length > 0) {
          artistsFolderId = checkArtistsData.files[0].id;
        }
      }

      if (!artistsFolderId) {
        // Create Artistas inside LOCKDOWN PRODUTORA
        const createArtistsRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'Artistas',
            mimeType: 'application/vnd.google-apps.folder',
            parents: [mainFolderId]
          })
        });
        if (createArtistsRes.ok) {
          const createArtistsData = await createArtistsRes.json();
          artistsFolderId = createArtistsData.id;
        } else {
          throw new Error("Não foi possível criar a subpasta 'Artistas' no Drive.");
        }
      }

      // Step C: Create actual Artist Subfolder
      const createArtistFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: artistForm.name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [artistsFolderId]
        })
      });

      if (!createArtistFolderRes.ok) {
        throw new Error("Falha ao criar pasta do artista específica.");
      }

      const createArtistFolderData = await createArtistFolderRes.json();
      const folderId = createArtistFolderData.id;

      setArtistForm(prev => ({
        ...prev,
        driveFolderId: folderId,
        driveFolderName: artistForm.name
      }));

      triggerToast(`Pasta para "${artistForm.name}" criada com sucesso no Google Drive!`);
    } catch (err: any) {
      console.error(err);
      triggerError(err.message || "Erro de permissão ou conexão ao criar pasta de artista.");
    } finally {
      setIsCreatingArtistFolder(false);
    }
  };

  const handleSaveArtist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artistForm.name || !artistForm.spotifyUrl) {
      triggerError("Por favor, selecione um usuário central e preencha a URL do Spotify.");
      return;
    }

    // 1. Impedir duplicar o mesmo userId de artista
    if (artistForm.userId) {
      const isDuplicate = artists.some(a => a.userId === artistForm.userId && a.id !== (editingArtist?.id || ''));
      if (isDuplicate) {
        triggerError("Este usuário já está cadastrado como artista na Lockdown!");
        return;
      }
    }

    const artistId = editingArtist ? editingArtist.id : `art-${Date.now()}`;
    const resolvedImage = artistForm.image || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop";

    const newArtist: DetailedArtist = {
      id: artistId,
      name: artistForm.name,
      realName: artistForm.realName,
      artistType: artistForm.artistType,
      company: artistForm.company,
      bio: artistForm.bio,
      image: resolvedImage,
      spotifyUrl: artistForm.spotifyUrl,
      instagramUrl: artistForm.instagramUrl,
      tiktokUrl: artistForm.tiktokUrl,
      youtubeUrl: artistForm.youtubeUrl,
      monthlyListeners: editingArtist ? editingArtist.monthlyListeners : 0,
      listenersUpdatedAt: new Date().toLocaleDateString('pt-BR'),
      featured: artistForm.featured,
      status: artistForm.status,
      driveFolderId: artistForm.driveFolderId || '',
      driveFolderName: artistForm.driveFolderName || '',
      userId: artistForm.userId || '',
      createdAt: editingArtist ? editingArtist.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await saveArtist(newArtist);
      await loadData();
      setIsArtistModalOpen(false);
      triggerToast(editingArtist ? "Perfil do artista atualizado com sucesso!" : "Novo artista cadastrado!");
      onMascotMoodChange('happy', `Artista ${artistForm.name} salvo com sucesso!`);
    } catch (err) {
      triggerError("Falha ao salvar artista.");
    }
  };

  const handleDeleteArtist = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o perfil de ${name}?`)) return;
    try {
      await deleteArtistDoc(id);
      await loadData();
      triggerToast("Artista removido.");
      onMascotMoodChange('pointing', "Artista deletado do banco de dados.");
    } catch (err) {
      triggerError("Erro ao remover artista.");
    }
  };

  // ----------------------------------------------------
  // MUSIC STREAM CRUD OPERATIONS
  // ----------------------------------------------------
  const [streamForm, setStreamForm] = useState({
    title: '',
    selectedArtists: [] as string[],
    coverUrl: '',
    audioUrl: '',
    audioFormat: 'mp3',
    featured: false,
    status: 'Ativo' as 'Ativo' | 'Rascunho' | 'Oculto',
    releaseDate: '',
    spotifyUrl: '',
    youtubeUrl: '',
    appleMusicUrl: '',
    deezerUrl: '',
    amazonMusicUrl: '',
    description: '',
    // platform stream breakdown
    spotifyStream: 0,
    youtubeStream: 0,
    appleMusicStream: 0,
    deezerStream: 0,
    amazonMusicStream: 0,
    tiktokStream: 0,
    manualTotal: 0,
    usePlatformsBreakdown: true
  });

  const openAddStream = () => {
    setEditingStream(null);
    setStreamForm({
      title: '',
      selectedArtists: [],
      coverUrl: '',
      audioUrl: '',
      audioFormat: 'mp3',
      featured: false,
      status: 'Ativo',
      releaseDate: new Date().toISOString().split('T')[0],
      spotifyUrl: '',
      youtubeUrl: '',
      appleMusicUrl: '',
      deezerUrl: '',
      amazonMusicUrl: '',
      description: '',
      spotifyStream: 0,
      youtubeStream: 0,
      appleMusicStream: 0,
      deezerStream: 0,
      amazonMusicStream: 0,
      tiktokStream: 0,
      manualTotal: 0,
      usePlatformsBreakdown: true
    });
    setIsStreamModalOpen(true);
  };

  const openEditStream = (stream: MusicStream) => {
    setEditingStream(stream);
    setStreamForm({
      title: stream.title,
      selectedArtists: stream.artistIds || [],
      coverUrl: stream.coverUrl,
      audioUrl: stream.audioUrl || '',
      audioFormat: stream.audioFormat || 'mp3',
      featured: stream.featured,
      status: stream.status,
      releaseDate: stream.releaseDate || '',
      spotifyUrl: stream.spotifyUrl || '',
      youtubeUrl: stream.youtubeUrl || '',
      appleMusicUrl: stream.appleMusicUrl || '',
      deezerUrl: stream.deezerUrl || '',
      amazonMusicUrl: stream.amazonMusicUrl || '',
      description: stream.description || '',
      spotifyStream: stream.platformStreams?.spotify || 0,
      youtubeStream: stream.platformStreams?.youtube || 0,
      appleMusicStream: stream.platformStreams?.appleMusic || 0,
      deezerStream: stream.platformStreams?.deezer || 0,
      amazonMusicStream: stream.platformStreams?.amazonMusic || 0,
      tiktokStream: stream.platformStreams?.tiktok || 0,
      manualTotal: stream.totalStreams || 0,
      usePlatformsBreakdown: stream.platformStreams ? true : false
    });
    setIsStreamModalOpen(true);
  };

  const getStreamFormValidationError = () => {
    if (isUploading) {
      if (uploadingField === 'audio') return "Aguarde a conclusão do upload do áudio...";
      if (uploadingField === 'cover') return "Aguarde a conclusão do upload da capa...";
      return "Aguarde o término do upload em andamento...";
    }
    if (isSaving) return "Salvando música no banco de dados...";
    if (!streamForm.title.trim()) return "Preencha o título da música.";
    if (!streamForm.coverUrl) return "Envie a imagem da capa da música.";
    if (!streamForm.audioUrl) return "Envie o arquivo de áudio playback.";
    return null; // Valid
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await handleUploadFile(file, 'covers', 'cover');
      setStreamForm(prev => ({ ...prev, coverUrl: url }));
      triggerToast("Capa da música carregada com sucesso!");
    } catch (err) {
      triggerError("Erro ao subir imagem da capa.");
    } finally {
      setIsUploading(false);
      setUploadingField(null);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    const format = extension === 'wav' ? 'wav' : 'mp3';

    try {
      const url = await handleUploadFile(file, 'audios', 'audio');
      
      // Update form state with the new URL
      setStreamForm(prev => {
        const updated = { 
          ...prev, 
          audioUrl: url, 
          audioFormat: format 
        };
        
        // Log stream audio debug info
        console.log("STREAM_AUDIO_DEBUG", {
          fileName: file.name,
          progress: 100,
          uploadCompleted: true,
          returnedFileId: url.includes('google_drive/') ? url.split('/').pop() : 'firebase-storage',
          returnedUrl: url,
          audioUrlState: url,
          isUploading: false,
          canSave: !!(updated.title && updated.coverUrl && url)
        });

        return updated;
      });

      triggerToast(`Áudio ${format.toUpperCase()} sincronizado com sucesso!`);
      onMascotMoodChange('happy', `O arquivo de áudio de alta qualidade foi carregado.`);
    } catch (err) {
      triggerError("Erro ao subir arquivo de áudio.");
    } finally {
      setIsUploading(false);
      setUploadingField(null);
    }
  };

  const handleSaveStream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamForm.title || !streamForm.coverUrl || !streamForm.audioUrl) {
      triggerError("Nome da música, capa e áudio de playback são obrigatórios.");
      return;
    }

    setIsSaving(true);
    // Calc Total Streams
    let total = 0;
    if (streamForm.usePlatformsBreakdown) {
      total = Number(streamForm.spotifyStream) + 
              Number(streamForm.youtubeStream) + 
              Number(streamForm.appleMusicStream) + 
              Number(streamForm.deezerStream) + 
              Number(streamForm.amazonMusicStream) + 
              Number(streamForm.tiktokStream);
    } else {
      total = Number(streamForm.manualTotal);
    }

    // Artist names mapping
    const artistNames = streamForm.selectedArtists
      .map(id => artists.find(a => a.id === id)?.name || '')
      .filter(Boolean)
      .join(' & ');

    const streamId = editingStream ? editingStream.id : `st-${Date.now()}`;
    const newStream: MusicStream = {
      id: streamId,
      title: streamForm.title,
      artistIds: streamForm.selectedArtists,
      artistNames: artistNames || 'Artista Lockdown',
      coverUrl: streamForm.coverUrl,
      audioUrl: streamForm.audioUrl,
      audioFormat: streamForm.audioFormat,
      totalStreams: total,
      platformStreams: streamForm.usePlatformsBreakdown ? {
        spotify: Number(streamForm.spotifyStream),
        youtube: Number(streamForm.youtubeStream),
        appleMusic: Number(streamForm.appleMusicStream),
        deezer: Number(streamForm.deezerStream),
        amazonMusic: Number(streamForm.amazonMusicStream),
        tiktok: Number(streamForm.tiktokStream)
      } : undefined,
      releaseDate: streamForm.releaseDate,
      spotifyUrl: streamForm.spotifyUrl,
      youtubeUrl: streamForm.youtubeUrl,
      appleMusicUrl: streamForm.appleMusicUrl,
      deezerUrl: streamForm.deezerUrl,
      amazonMusicUrl: streamForm.amazonMusicUrl,
      description: streamForm.description,
      featured: streamForm.featured,
      status: streamForm.status,
      createdAt: editingStream ? editingStream.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await saveMusicStream(newStream);
      await loadData();
      setIsStreamModalOpen(false);
      triggerToast(editingStream ? "Música em streams atualizada!" : "Nova música de destaque criada!");
      onMascotMoodChange('happy', `Faixa ${streamForm.title} pronta para ser exibida.`);
    } catch (err) {
      triggerError("Falha ao salvar streams.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStream = async (id: string, title: string) => {
    if (!window.confirm(`Excluir a música "${title}" do destaque de streams?`)) return;
    try {
      await deleteMusicStreamDoc(id);
      await loadData();
      triggerToast("Música excluída com sucesso.");
      onMascotMoodChange('pointing', "Removido do portfólio de streams.");
    } catch (err) {
      triggerError("Erro ao remover música.");
    }
  };

  const toggleSelectArtist = (id: string) => {
    setStreamForm(prev => {
      const exists = prev.selectedArtists.includes(id);
      const updated = exists 
        ? prev.selectedArtists.filter(item => item !== id)
        : [...prev.selectedArtists, id];
      return { ...prev, selectedArtists: updated };
    });
  };

  // Communities Handlers
  const handleOpenNewCommunityModal = () => {
    setEditingCommunity(null);
    setCommunityForm({
      name: '',
      coverUrl: '',
      whatsappUrl: '',
      discordUrl: '',
      status: 'Ativo'
    });
    setIsCommunityModalOpen(true);
  };

  const handleEditCommunity = (comm: Community) => {
    setEditingCommunity(comm);
    setCommunityForm({
      name: comm.name || '',
      coverUrl: comm.coverUrl || '',
      whatsappUrl: comm.whatsappUrl || '',
      discordUrl: comm.discordUrl || '',
      status: comm.status || 'Ativo'
    });
    setIsCommunityModalOpen(true);
  };

  const handleCommunityCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await handleUploadFile(file, 'communities', 'cover');
      setCommunityForm(prev => ({ ...prev, coverUrl: url }));
      triggerToast("Capa do grupo carregada com sucesso!");
    } catch (err: any) {
      triggerError("Erro ao subir imagem da capa.");
    } finally {
      setIsUploading(false);
      setUploadingField(null);
    }
  };

  const handleSaveCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!communityForm.name) {
      triggerError("O nome da comunidade/grupo é obrigatório.");
      return;
    }
    if (!communityForm.coverUrl) {
      triggerError("A capa da comunidade é obrigatória.");
      return;
    }
    if (!communityForm.whatsappUrl && !communityForm.discordUrl) {
      triggerError("Cadastre ao menos um link (WhatsApp ou Discord).");
      return;
    }

    // URL Validation helpers
    const urlPattern = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
    if (communityForm.whatsappUrl && !urlPattern.test(communityForm.whatsappUrl)) {
      triggerError("URL do WhatsApp inválida.");
      return;
    }
    if (communityForm.discordUrl && !urlPattern.test(communityForm.discordUrl)) {
      triggerError("URL do Discord inválida.");
      return;
    }

    const commId = editingCommunity ? editingCommunity.id : `comm-${Date.now()}`;
    const newCommunity: Community = {
      id: commId,
      name: communityForm.name,
      coverUrl: communityForm.coverUrl,
      whatsappUrl: communityForm.whatsappUrl,
      discordUrl: communityForm.discordUrl,
      status: communityForm.status,
      createdAt: editingCommunity ? editingCommunity.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await saveCommunity(newCommunity);
      await loadData();
      setIsCommunityModalOpen(false);
      triggerToast(editingCommunity ? "Comunidade atualizada!" : "Nova comunidade criada!");
      onMascotMoodChange('happy', `Grupo ${communityForm.name} salvo com sucesso.`);
    } catch (err: any) {
      triggerError("Falha ao salvar comunidade.");
    }
  };

  const handleDeleteCommunity = async (id: string, name: string) => {
    if (!window.confirm(`Excluir a comunidade "${name}"?`)) return;
    try {
      await deleteCommunityDoc(id);
      await loadData();
      triggerToast("Comunidade excluída com sucesso.");
      onMascotMoodChange('pointing', "Removido do painel de comunidades.");
    } catch (err: any) {
      triggerError("Erro ao remover comunidade.");
    }
  };

  // Helper formatting numbers (e.g. 1.2M, 25K)
  const formatFriendlyNumber = (num: any): string => {
    const val = Number(num);
    if (isNaN(val)) return '0';
    if (val >= 1000000) {
      return (val / 1000000).toFixed(1).replace('.0', '') + ' MI';
    }
    if (val >= 1000) {
      return (val / 1000).toFixed(1).replace('.0', '') + ' mil';
    }
    return val.toString();
  };

  // Stats calculation
  const totalArtistsCount = artists.length;
  const totalStreamsCount = streams.length;
  const grandTotalStreams = streams.reduce((acc, s) => acc + s.totalStreams, 0);
  const featuredArtistsCount = artists.filter(a => a.featured).length;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-4 sm:p-6 md:p-8 bg-white text-black rounded-3xl border border-gray-200 shadow-xl">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToMenu}
            className="bg-gray-100 hover:bg-gray-200 border border-gray-300 px-4 py-2.5 rounded-xl text-xs font-orbitron font-bold text-gray-700 transition-all cursor-pointer flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>PAINEL PRINCIPAL</span>
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
              <span className="font-orbitron text-xs text-red-600 font-black">LOCKDOWN CENTRAL DE ARTISTAS</span>
            </div>
            <h2 className="text-3xl font-black font-orbitron text-black mt-1">MÚSICA</h2>
          </div>
        </div>
      </div>

      {/* Success/Error Alerts */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-4 rounded-2xl flex items-center space-x-3 text-xs font-orbitron animate-pulse">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded-2xl flex items-center space-x-3 text-xs font-orbitron">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB SYSTEM NAVIGATION */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-4">
        {[
          { id: 'overview', label: 'VISÃO GERAL', icon: BarChart3 },
          { id: 'artistas', label: 'ARTISTAS DA LOCKDOWN', icon: Users },
          { id: 'streams', label: 'STREAMS PÚBLICOS', icon: Disc },
          { id: 'envios', label: 'MÚSICAS RECEBIDAS', icon: FileCheck },
          { id: 'releases', label: 'TIKTOK RELEASES', icon: Flame },
          { id: 'share', label: 'SHARE FINANCEIRO', icon: Coins },
          { id: 'youtube', label: 'VERIFICAÇÕES YOUTUBE', icon: Youtube },
          { id: 'clearance', label: 'VOZES AUTORIZADAS', icon: Shield },
          { id: 'acapellas', label: 'ACAPELLAS', icon: Folder },
          { id: 'presskit', label: 'PRESSKITS', icon: Folder },
          { id: 'grupos', label: 'COMUNIDADE', icon: Users },
          { id: 'config', label: 'CONFIGURAÇÕES', icon: Settings },
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-[11px] font-orbitron font-bold transition-all cursor-pointer ${
                active 
                  ? 'bg-[#FF0033] text-white shadow-md shadow-red-500/20' 
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="py-24 text-center space-y-4">
          <RefreshCw className="w-10 h-10 animate-spin text-red-600 mx-auto" />
          <p className="font-orbitron text-xs text-gray-500 font-bold">CARREGANDO BANCO DE DADOS FIRESTORE...</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* =========================================================================
              TAB: VISÃO GERAL
              ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="text-gray-500 font-orbitron text-[10px] block font-bold">ARTISTAS</span>
                    <h4 className="font-orbitron font-black text-2xl text-black mt-1">
                      {totalArtistsCount} <span className="text-xs text-gray-400 font-normal">({featuredArtistsCount} em destaque)</span>
                    </h4>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="text-gray-500 font-orbitron text-[10px] block font-bold">STREAMS CADASTRADOS</span>
                    <h4 className="font-orbitron font-black text-2xl text-black mt-1">{totalStreamsCount} faixas</h4>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-red-100 text-[#FF0033] flex items-center justify-center shrink-0">
                    <Disc className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="text-gray-500 font-orbitron text-[10px] block font-bold">STREAMS TOTAIS</span>
                    <h4 className="font-orbitron font-black text-2xl text-[#FF0033] mt-1">{formatFriendlyNumber(grandTotalStreams)}</h4>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-[#FF0033]/10 text-[#FF0033] flex items-center justify-center shrink-0">
                    <Flame className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="text-gray-500 font-orbitron text-[10px] block font-bold">MÚSICAS RECEBIDAS</span>
                    <h4 className="font-orbitron font-black text-2xl text-black mt-1">
                      {JSON.parse(localStorage.getItem('lockdown_music_submissions') || '[]').length} envios
                    </h4>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <FileCheck className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* GOOGLE DRIVE CONNECTION STATUS CARD */}
              <div className="bg-gray-50 border border-gray-200 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${driveToken ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-orbitron text-[10px] text-gray-500 block font-bold">INTEGRAÇÃO GOOGLE WORKSPACE</span>
                    <h4 className="font-orbitron font-black text-lg text-black">STATUS GOOGLE DRIVE</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${driveToken ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                      <span className="font-orbitron text-xs font-bold text-gray-700">
                        {driveToken ? `CONECTADO` : `NÃO CONECTADO`}
                      </span>
                      {driveUser && (
                        <span className="text-[11px] text-gray-500 font-sans">
                          ({driveUser.name} - {driveUser.email})
                        </span>
                      )}
                    </div>
                    {driveQuota && (
                      <div className="text-[10px] text-gray-400 font-sans mt-1">
                        Espaço utilizado: {(driveQuota.usage / (1024 * 1024 * 1024)).toFixed(2)} GB de {(driveQuota.limit / (1024 * 1024 * 1024)).toFixed(0)} GB ({((driveQuota.usage / driveQuota.limit) * 100).toFixed(1)}%)
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
                  {driveToken ? (
                    <>
                      <button
                        onClick={handleConnectDrive}
                        disabled={isConnectingDrive}
                        className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-orbitron font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition-all w-full md:w-auto flex items-center justify-center space-x-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isConnectingDrive ? 'animate-spin' : ''}`} />
                        <span>RECONECTAR</span>
                      </button>
                      <button
                        onClick={handleDisconnectDrive}
                        className="bg-red-50 hover:bg-red-100 text-[#FF0033] border border-red-200 font-orbitron font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition-all w-full md:w-auto"
                      >
                        DESCONECTAR
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleConnectDrive}
                      disabled={isConnectingDrive}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-orbitron font-bold text-xs px-6 py-3 rounded-xl cursor-pointer transition-all w-full md:w-auto flex items-center justify-center space-x-1.5 shadow-sm shadow-emerald-500/20"
                    >
                      {isConnectingDrive ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>CONECTANDO...</span>
                        </>
                      ) : (
                        <>
                          <HardDrive className="w-4 h-4" />
                          <span>CONECTAR GOOGLE DRIVE</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Informative block */}
              <div className="bg-gray-50 p-8 rounded-3xl border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2">
                  <h3 className="font-orbitron font-black text-xl text-black">PAINEL PÚBLICO INTEGRADO COM FIREBASE</h3>
                  <p className="text-xs text-gray-600 max-w-3xl">
                    Os dados cadastrados nas abas de <strong>Artistas</strong> e <strong>Streams</strong> são sincronizados diretamente com o Firestore e Firebase Storage. O site público renderizará imediatamente as imagens, capas, perfis detalhados e reprodutores de áudio para os visitantes, sem máscaras ou placeholders genéricos.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('artistas')}
                  className="bg-black hover:bg-gray-800 text-white font-orbitron text-xs px-6 py-3 rounded-xl font-bold shrink-0 transition-all cursor-pointer"
                >
                  GERENCIAR ARTISTAS
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB: ARTISTAS
              ========================================================================= */}
          {activeTab === 'artistas' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-orbitron font-black text-lg text-black">ARTISTAS DA LOCKDOWN</h3>
                  <p className="text-xs text-gray-500">Crie e edite as páginas de perfis públicos dos artistas da gravadora.</p>
                </div>
                <button
                  onClick={openAddArtist}
                  className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs px-5 py-3 rounded-xl flex items-center space-x-2 cursor-pointer shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>NOVO ARTISTA</span>
                </button>
              </div>

              {/* Grid of Artists */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {artists.map(art => {
                  const matchedUser = users.find(u => u.uid === art.userId);
                  const resolvedImage = matchedUser?.photoURL || art.image;
                  const resolvedName = matchedUser?.name || art.name;

                  return (
                    <div key={art.id} className="bg-gray-50 rounded-2xl border border-gray-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow relative">
                      {art.featured && (
                        <span className="absolute top-3 left-3 bg-[#FF0033] text-white font-orbitron text-[8px] font-black px-2.5 py-1 rounded-full">
                          DESTAQUE
                        </span>
                      )}
                      <div>
                        <div className="w-full h-44 rounded-xl overflow-hidden mb-4 bg-gray-200">
                          <img src={resolvedImage} alt={resolvedName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <span className="text-[10px] font-orbitron font-bold text-[#FF0033] tracking-widest block uppercase">
                          {art.artistType} • {art.company || 'Lockdown'}
                        </span>
                        <h4 className="font-orbitron font-black text-lg text-black mt-1 truncate">{resolvedName}</h4>
                        <p className="text-xs text-gray-600 mt-2 font-sans line-clamp-2">{art.bio || 'Sem biografia cadastrada.'}</p>
                        <div className="mt-4 pt-3 border-t border-gray-200 space-y-1">
                          <span className="text-[10px] text-gray-500 font-orbitron block">
                            OUVINTES: <strong className="text-black">{art.monthlyListeners ? formatFriendlyNumber(art.monthlyListeners) : 'Não informado'}</strong>
                          </span>
                          <span className="text-[9px] text-gray-400 font-orbitron block">
                            Atualizado: {art.listenersUpdatedAt || '-'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-gray-200 flex items-center justify-between gap-2">
                        <a 
                          href={art.spotifyUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-green-600 transition-colors"
                          title="Ver no Spotify"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <div className="flex items-center space-x-1">
                          {art.driveFolderId && (
                            <a
                              href={`https://drive.google.com/drive/folders/${art.driveFolderId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg hover:bg-gray-200 text-[#FF0033] transition-colors"
                              title={`Abrir pasta de ${resolvedName} no Google Drive`}
                            >
                              <HardDrive className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => openEditArtist(art)}
                            className="p-2 rounded-lg hover:bg-gray-200 text-gray-700 transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteArtist(art.id, resolvedName)}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {artists.length === 0 && (
                  <div className="col-span-full py-12 text-center text-gray-500 font-orbitron text-xs">
                    Nenhum artista cadastrado ainda. Clique em "NOVO ARTISTA" para adicionar!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB: STREAMS PÚBLICOS
              ========================================================================= */}
          {activeTab === 'streams' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-orbitron font-black text-lg text-black">MÚSICAS & RESULTADOS DE STREAMS</h3>
                  <p className="text-xs text-gray-500">Destaque os lançamentos da Lockdown e exiba os números de reproduções das plataformas.</p>
                </div>
                <button
                  onClick={openAddStream}
                  className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs px-5 py-3 rounded-xl flex items-center space-x-2 cursor-pointer shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>NOVA MÚSICA</span>
                </button>
              </div>

              {/* Table list */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 grid grid-cols-12 text-[10px] font-orbitron font-bold text-gray-600 gap-4">
                  <div className="col-span-4">NOME / ARTISTAS</div>
                  <div className="col-span-2">STREAMS TOTAIS</div>
                  <div className="col-span-2">ÁUDIO PLAYBACK</div>
                  <div className="col-span-2">LANÇAMENTO</div>
                  <div className="col-span-2 text-right">AÇÕES</div>
                </div>

                <div className="divide-y divide-gray-100">
                  {streams.map(stream => (
                    <div key={stream.id} className="px-6 py-4 grid grid-cols-12 items-center hover:bg-gray-50 transition-colors text-xs gap-4">
                      <div className="col-span-4 flex items-center space-x-3">
                        <img 
                          src={stream.coverUrl} 
                          alt="" 
                          className="w-12 h-12 rounded-lg object-cover shrink-0 border border-gray-200" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="truncate">
                          <span className="font-orbitron font-black text-black block truncate">{stream.title}</span>
                          <span className="text-[10px] text-gray-500 font-sans block truncate">{stream.artistNames}</span>
                        </div>
                      </div>
                      
                      <div className="col-span-2">
                        <span className="font-orbitron font-black text-[#FF0033] text-sm bg-red-50 px-2.5 py-1 rounded-full">
                          {formatFriendlyNumber(stream.totalStreams)}
                        </span>
                      </div>

                      <div className="col-span-2">
                        {stream.audioUrl ? (
                          <button
                            onClick={() => {
                              const audio = new Audio(stream.audioUrl);
                              audio.play().catch(() => alert("Áudio temporário indisponível no navegador."));
                              triggerToast(`Reproduzindo prévia de ${stream.title}...`);
                              onMascotMoodChange('happy', `Curtindo o som: ${stream.title}!`);
                            }}
                            className="bg-gray-100 hover:bg-[#FF0033] hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-orbitron font-bold transition-all text-gray-700 flex items-center space-x-1"
                          >
                            <Play className="w-3 h-3 fill-current shrink-0" />
                            <span>PREVIEW</span>
                          </button>
                        ) : (
                          <span className="text-gray-400 font-orbitron text-[10px]">Sem áudio</span>
                        )}
                      </div>

                      <div className="col-span-2 font-orbitron text-gray-500">
                        {stream.releaseDate || 'Não informada'}
                      </div>

                      <div className="col-span-2 text-right flex items-center justify-end space-x-1">
                        <button
                          onClick={() => openEditStream(stream)}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteStream(stream.id, stream.title)}
                          className="p-2 rounded-lg hover:bg-red-50 text-[#FF0033]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {streams.length === 0 && (
                    <div className="py-12 text-center text-gray-500 font-orbitron text-xs">
                      Nenhuma música em streams cadastrada ainda. Clique em "NOVA MÚSICA" para começar!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB: MÚSICAS RECEBIDAS (Envios de Artistas)
              ========================================================================= */}
          {activeTab === 'envios' && (
            <div className="py-2 space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-orbitron text-xs text-[#FF0033] tracking-widest block font-bold">MÚSICAS ENVIADAS</span>
                  <h3 className="font-orbitron font-bold text-2xl text-black">ENVIOS DE MCs & DJs</h3>
                  <p className="text-xs text-gray-500">Esta área contém as músicas enviadas por artistas terceiros para análise de distribuição.</p>
                </div>
              </div>

              <div className="space-y-4">
                {(() => {
                  const subs = JSON.parse(localStorage.getItem('lockdown_music_submissions') || '[]');
                  if (subs.length === 0) {
                    return (
                      <div className="bg-gray-50 p-12 rounded-3xl text-center border border-gray-200">
                        <p className="text-gray-500 font-orbitron text-sm">Nenhuma música enviada por artistas externos no momento.</p>
                      </div>
                    );
                  }
                  return subs.map((sub: any) => (
                    <div key={sub.id} className="bg-gray-50 p-6 rounded-3xl border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center space-x-4 w-full md:w-auto">
                        {sub.coverUrl ? (
                          <img 
                            src={sub.coverUrl} 
                            alt="" 
                            className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-gray-200" 
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                            <span className="font-orbitron font-bold text-[9px] text-gray-400 uppercase">SEM CAPA</span>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-orbitron text-[10px] bg-gray-200 text-gray-800 px-2.5 py-0.5 rounded font-bold">{sub.genre || 'Funk/Trap'}</span>
                            <span className={`font-orbitron text-[10px] px-2.5 py-0.5 rounded font-black ${
                              sub.status === 'Aprovado' ? 'bg-emerald-100 text-emerald-800' :
                              sub.status === 'Em análise' ? 'bg-amber-100 text-amber-800' :
                              sub.status === 'Solicitar alteração' ? 'bg-blue-100 text-blue-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {sub.status || 'Em análise'}
                            </span>
                          </div>
                          <h4 className="font-orbitron font-black text-lg text-black">{sub.title}</h4>
                          <p className="text-xs text-gray-600 font-sans">Artista: {sub.artistName} • Empresa: {sub.companyName || 'Independente'}</p>
                          <p className="text-[10px] text-gray-400 font-orbitron mt-1">Enviado por: {sub.userEmail} em {sub.date}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                        <button
                          onClick={() => {
                            alert(`Reproduzindo áudio de: ${sub.title}`);
                            onMascotMoodChange('attentive', `Analisando faixa de ${sub.artistName}...`);
                          }}
                          className="bg-white hover:bg-gray-100 border border-gray-300 text-black font-orbitron text-xs px-4 py-2.5 rounded-xl flex items-center space-x-2 cursor-pointer"
                        >
                          <Volume2 className="w-4 h-4" />
                          <span>OUVIR</span>
                        </button>

                        <button
                          onClick={() => {
                            const allSubs = JSON.parse(localStorage.getItem('lockdown_music_submissions') || '[]');
                            const updated = allSubs.map((s: any) => s.id === sub.id ? { ...s, status: 'Aprovado' } : s);
                            localStorage.setItem('lockdown_music_submissions', JSON.stringify(updated));
                            onMascotMoodChange('happy', 'Música aprovada para a Lockdown!');
                            setActiveTab('envios'); 
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-orbitron font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
                        >
                          APROVAR
                        </button>

                        <button
                          onClick={() => {
                            const allSubs = JSON.parse(localStorage.getItem('lockdown_music_submissions') || '[]');
                            const updated = allSubs.map((s: any) => s.id === sub.id ? { ...s, status: 'Reprovado' } : s);
                            localStorage.setItem('lockdown_music_submissions', JSON.stringify(updated));
                            onMascotMoodChange('angry', 'Música recusada.');
                            setActiveTab('envios');
                          }}
                          className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
                        >
                          REPROVAR
                        </button>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB: TIKTOK RELEASES
              ========================================================================= */}
          {activeTab === 'releases' && (
            <TikTokReleases onMascotMoodChange={onMascotMoodChange} />
          )}

          {/* =========================================================================
              TAB: SHARE FINANCEIRO
              ========================================================================= */}
          {activeTab === 'share' && (
            <MusicShareSection onMascotMoodChange={onMascotMoodChange} artists={artists} />
          )}

          {/* =========================================================================
              TAB: VERIFICAÇÕES YOUTUBE
              ========================================================================= */}
          {activeTab === 'youtube' && (
            <YouTubeVerificationSection onMascotMoodChange={onMascotMoodChange} />
          )}

          {/* =========================================================================
              TAB: VOZES AUTORIZADAS / LIBERAÇÃO DE DISTRIBUIÇÃO
              ========================================================================= */}
          {activeTab === 'clearance' && (
            <DistributionClearanceSection onMascotMoodChange={onMascotMoodChange} />
          )}

          {/* =========================================================================
              TAB: ACAPELLAS
              ========================================================================= */}
          {activeTab === 'acapellas' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <span className="font-orbitron text-xs text-[#FF0033] tracking-widest block font-bold">PASTAS DO GOOGLE DRIVE</span>
                <h3 className="font-orbitron font-black text-2xl text-black">PASTAS DE ACAPELLAS</h3>
                <p className="text-xs text-gray-500">Subdiretórios dedicados a acapellas oficiais para download de produtores e DJs parceiros.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['Acapellas MC KRONOS', 'Acapellas MC LELE', 'Acapellas Funk SP 2026'].map((folder, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-200 p-6 rounded-3xl hover:border-red-600 hover:shadow-md transition-all flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                      <Folder className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-orbitron font-black text-sm text-black">{folder}</h4>
                      <span className="text-[10px] text-gray-500 font-sans block mt-0.5">Sincronizado com Google Drive</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}



          {/* =========================================================================
              TAB: PRESSKITS
              ========================================================================= */}
          {activeTab === 'presskit' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <span className="font-orbitron text-xs text-[#FF0033] tracking-widest block font-bold">PASTAS DO GOOGLE DRIVE</span>
                <h3 className="font-orbitron font-black text-2xl text-black">PASTAS DE PRESSKITS</h3>
                <p className="text-xs text-gray-500">Materiais de imprensa, artes promocionais, fotos de alta qualidade e logos da Lockdown.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['Presskit Oficial MC KRONOS', 'Logo Assets Lockdown Ciano/White', 'Flyers Editáveis PSD'].map((folder, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-200 p-6 rounded-3xl hover:border-red-600 hover:shadow-md transition-all flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <Folder className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-orbitron font-black text-sm text-black">{folder}</h4>
                      <span className="text-[10px] text-gray-500 font-sans block mt-0.5">Sincronizado com Google Drive</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB: COMUNIDADE
              ========================================================================= */}
          {activeTab === 'grupos' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="font-orbitron text-xs text-[#FF0033] tracking-widest block font-bold">GERENCIAMENTO DE COMUNIDADES</span>
                  <h3 className="font-orbitron font-black text-2xl text-black">CANAIS & COMUNIDADES OFICIAIS</h3>
                  <p className="text-xs text-gray-500">Cadastre e gerencie os grupos oficiais de WhatsApp e servidores de Discord da Lockdown.</p>
                </div>
                <button
                  onClick={handleOpenNewCommunityModal}
                  className="bg-black hover:bg-red-600 text-white hover:scale-[1.02] active:scale-[0.98] font-orbitron font-bold text-xs px-5 py-3 rounded-2xl transition-all flex items-center space-x-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#FF0033]" />
                  <span>NOVA COMUNIDADE</span>
                </button>
              </div>

              {communities.length === 0 ? (
                <div className="bg-gray-50 border border-dashed border-gray-300 p-12 text-center rounded-3xl">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <h4 className="font-orbitron font-bold text-sm text-black">Nenhuma comunidade cadastrada</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">Cadastre os links oficiais do WhatsApp e Discord para que artistas autorizados possam visualizá-los em seus painéis.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {communities.map((comm) => (
                    <div 
                      key={comm.id} 
                      className={`bg-white border p-5 rounded-3xl flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md transition-all ${
                        comm.status === 'Inativo' ? 'opacity-60 border-gray-200 bg-gray-50/50' : 'border-gray-100 hover:border-red-500/30'
                      }`}
                    >
                      <div className="flex items-start space-x-4">
                        <div className="w-16 h-16 rounded-2xl border border-gray-100 bg-gray-50 shrink-0 overflow-hidden relative flex items-center justify-center">
                          {comm.coverUrl ? (
                            <img src={comm.coverUrl} alt={comm.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 font-orbitron text-[9px] font-black text-center bg-gray-100">
                              SEM CAPA
                            </div>
                          )}
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[9px] font-orbitron px-2 py-0.5 rounded-full font-bold ${
                              comm.status === 'Ativo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}>
                              {comm.status === 'Ativo' ? 'ATIVO' : 'INATIVO'}
                            </span>
                          </div>
                          <h4 className="font-orbitron font-black text-sm text-black truncate">{comm.name}</h4>
                          <p className="text-[10px] text-gray-400 truncate font-sans">
                            {comm.whatsappUrl ? 'WhatsApp' : ''} {comm.whatsappUrl && comm.discordUrl ? '&' : ''} {comm.discordUrl ? 'Discord' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                        <div className="flex items-center space-x-2">
                          {comm.whatsappUrl && (
                            <a 
                              href={comm.whatsappUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all"
                              title="Link WhatsApp"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </a>
                          )}
                          {comm.discordUrl && (
                            <a 
                              href={comm.discordUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all"
                              title="Link Discord"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleEditCommunity(comm)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-black transition-all cursor-pointer"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCommunity(comm.id, comm.name)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-all cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB: CONFIGURAÇÕES
              ========================================================================= */}
          {activeTab === 'config' && (
            <div className="space-y-6 animate-fadeIn max-w-2xl">
              <div>
                <h3 className="font-orbitron font-black text-lg text-black">CONFIGURAÇÕES DE MÚSICA</h3>
                <p className="text-xs text-gray-500">Ajuste as preferências globais de exibição de música e distribuição.</p>
              </div>

              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200 space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div>
                    <label className="font-orbitron text-xs font-bold text-black block">REPRODUTOR DE ÁUDIO PÚBLICO</label>
                    <span className="text-[10px] text-gray-500 font-sans">Permite que qualquer visitante ouça as faixas da Lockdown.</span>
                  </div>
                  <input type="checkbox" defaultChecked className="w-5 h-5 accent-[#FF0033]" />
                </div>

                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div>
                    <label className="font-orbitron text-xs font-bold text-black block">VISUALIZAÇÃO DE STREAMS TOTAIS</label>
                    <span className="text-[10px] text-gray-500 font-sans">Exibe os milhões de streams publicamente no card da música.</span>
                  </div>
                  <input type="checkbox" defaultChecked className="w-5 h-5 accent-[#FF0033]" />
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <label className="font-orbitron text-xs font-bold text-black block">CADASTRO EXTERNO DE ARTISTAS</label>
                    <span className="text-[10px] text-gray-500 font-sans">Permite que novos artistas se cadastrem de forma independente.</span>
                  </div>
                  <input type="checkbox" className="w-5 h-5 accent-[#FF0033]" />
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* =========================================================================
          MODAL: ARTISTA (NOVO / EDITAR)
          ========================================================================= */}
      <AnimatePresence>
        {isArtistModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white border-2 border-gray-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden"
            >
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h4 className="font-orbitron font-black text-black">
                  {editingArtist ? `EDITAR ARTISTA: ${editingArtist.name}` : 'NOVO ARTISTA'}
                </h4>
                <button onClick={() => setIsArtistModalOpen(false)} className="text-gray-500 hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveArtist} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                
                {/* 1. SELEÇÃO CENTRAL DA PESSOA COM AUTOCOMPLETE */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                  <PersonSelectAutocomplete
                    label="VINCULAR / SELECIONAR PESSOA CENTRAL *"
                    required
                    selectedUserId={artistForm.userId}
                    selectedUserName={artistForm.name}
                    selectedUserPhoto={artistForm.image}
                    onSelectPerson={(person) => {
                      setArtistForm(prev => ({
                        ...prev,
                        userId: person.id || person.uid || '',
                        name: person.name,
                        realName: prev.realName || (person.artisticName ? person.name : ''),
                        image: person.photoURL || prev.image || ''
                      }));
                      onMascotMoodChange('happy', `Artista vinculado à identidade central de ${person.name}!`);
                    }}
                    onClear={() => {
                      setArtistForm(prev => ({
                        ...prev,
                        userId: '',
                        name: '',
                        image: ''
                      }));
                    }}
                    defaultRole="Artista / DJ"
                  />
                </div>

                {/* 2. INFORMAÇÕES DE EXIBIÇÃO E CADASTRO SINCRONIZADOS */}
                {artistForm.userId ? (
                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 flex items-center space-x-4">
                    {artistForm.image ? (
                      <img
                        src={artistForm.image}
                        alt={artistForm.name}
                        className="w-16 h-16 rounded-full object-cover border border-gray-300 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center shrink-0">
                        <Users className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-[#FF0033] font-orbitron font-bold tracking-widest block mb-0.5">PERFIL CENTRAL SINCRONIZADO</span>
                      <h5 className="font-orbitron font-black text-base text-black truncate">{artistForm.name || 'Sem nome artístico'}</h5>
                      <p className="text-[10px] text-gray-500 font-sans leading-tight mt-1">
                        Sincronizado automaticamente de Usuários. Para editar, gerencie o perfil central em <strong>Admin &rarr; Usuários</strong>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-center space-x-3 text-xs font-sans">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0"></span>
                    <span>⚠️ Vincule um usuário central acima para carregar automaticamente Nome e Foto.</span>
                  </div>
                )}

                <div>
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">STATUS</label>
                  <select
                    value={artistForm.status}
                    onChange={e => setArtistForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-xs font-sans text-black focus:outline-none focus:border-[#FF0033]"
                  >
                    <option value="Ativo">Ativo (Público)</option>
                    <option value="Rascunho">Rascunho</option>
                    <option value="Oculto">Oculto</option>
                  </select>
                </div>

                <div>
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">BIOGRAFIA (EXIBIDA NO PERFIL PÚBLICO)</label>
                  <textarea
                    rows={3}
                    value={artistForm.bio}
                    onChange={e => setArtistForm(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="Escreva um breve texto sobre a carreira do artista..."
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-xs font-sans text-black focus:outline-none focus:border-[#FF0033]"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-[#FF0033] font-orbitron text-[10px] block font-bold mb-1">SPOTIFY ARTIST URL *</label>
                    <input
                      type="url"
                      required
                      value={artistForm.spotifyUrl}
                      onChange={e => setArtistForm(prev => ({ ...prev, spotifyUrl: e.target.value }))}
                      placeholder="https://open.spotify.com/artist/..."
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-xs font-sans text-black focus:outline-none focus:border-green-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">INSTAGRAM URL</label>
                    <input
                      type="url"
                      value={artistForm.instagramUrl}
                      onChange={e => setArtistForm(prev => ({ ...prev, instagramUrl: e.target.value }))}
                      placeholder="https://instagram.com/..."
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-xs font-sans text-black focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">TIKTOK URL</label>
                    <input
                      type="url"
                      value={artistForm.tiktokUrl}
                      onChange={e => setArtistForm(prev => ({ ...prev, tiktokUrl: e.target.value }))}
                      placeholder="https://tiktok.com/@..."
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-xs font-sans text-black focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">YOUTUBE CANAL URL</label>
                    <input
                      type="url"
                      value={artistForm.youtubeUrl}
                      onChange={e => setArtistForm(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                      placeholder="https://youtube.com/..."
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-xs font-sans text-black focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 py-2">
                  <input
                    type="checkbox"
                    id="featCheck"
                    checked={artistForm.featured}
                    onChange={e => setArtistForm(prev => ({ ...prev, featured: e.target.checked }))}
                    className="w-4 h-4 accent-[#FF0033]"
                  />
                  <label htmlFor="featCheck" className="font-orbitron text-xs text-black font-bold cursor-pointer">
                    MARCAR COMO ARTISTA EM DESTAQUE (HOME / RECENTES)
                  </label>
                </div>

                <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsArtistModalOpen(false)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-xs font-orbitron font-bold"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    className="bg-[#FF0033] hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-xs font-orbitron font-bold"
                  >
                    SALVAR PERFIL
                  </button>
                </div>

              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          MODAL: STREAMS (NOVA MÚSICA / EDITAR)
          ========================================================================= */}
      <AnimatePresence>
        {isStreamModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white border-2 border-gray-200 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden"
            >
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h4 className="font-orbitron font-black text-black">
                  {editingStream ? `EDITAR FAIXA DE STREAM: ${editingStream.title}` : 'CADASTRAR NOVO DESTAQUE DE STREAM'}
                </h4>
                <button onClick={() => setIsStreamModalOpen(false)} className="text-gray-500 hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveStream} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">TÍTULO DA MÚSICA *</label>
                    <input
                      type="text"
                      required
                      value={streamForm.title}
                      onChange={e => setStreamForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Ex: Sangue no Asfalto"
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-xs font-sans text-black focus:outline-none focus:border-[#FF0033]"
                    />
                  </div>

                  <div>
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">DATA DE LANÇAMENTO</label>
                    <input
                      type="date"
                      value={streamForm.releaseDate}
                      onChange={e => setStreamForm(prev => ({ ...prev, releaseDate: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-xs font-sans text-black focus:outline-none"
                    />
                  </div>
                </div>

                {/* Multiselect artists */}
                <div className="space-y-2">
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold">ARTISTAS DA FAIXA * (VINCULE AOS PERFIS EXISTENTES)</label>
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-300 max-h-32 overflow-y-auto">
                    {artists.map(art => {
                      const selected = streamForm.selectedArtists.includes(art.id);
                      return (
                        <button
                          key={art.id}
                          type="button"
                          onClick={() => toggleSelectArtist(art.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-orbitron font-bold transition-all border flex items-center space-x-1 ${
                            selected 
                              ? 'bg-[#FF0033]/15 text-[#FF0033] border-[#FF0033]' 
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          {selected && <Check className="w-3 h-3 shrink-0" />}
                          <span>{art.name}</span>
                        </button>
                      );
                    })}
                    {artists.length === 0 && (
                      <span className="text-[10px] font-sans text-gray-400">Nenhum artista disponível. Cadastre o artista primeiro na aba "Artistas".</span>
                    )}
                  </div>
                </div>

                {/* Cover & Audio uploads */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Cover */}
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-2">CAPA DA MÚSICA * (PNG/JPG)</label>
                    <div className="flex items-center space-x-3">
                      {streamForm.coverUrl ? (
                        <img src={streamForm.coverUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0 border border-gray-300" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0">
                          <Disc className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <label className="bg-black hover:bg-gray-800 text-white font-orbitron font-bold px-3 py-1.5 rounded-lg text-[10px] cursor-pointer inline-block">
                          SELECIONAR CAPA
                          <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                        </label>
                        <p className="text-[8px] text-gray-400 mt-1">Cores reais coloridas.</p>
                      </div>
                    </div>
                    {isUploading && uploadingField === 'cover' && (
                      <div className="mt-3 text-[9px] font-orbitron text-red-600">Uploading cover... {uploadProgress}%</div>
                    )}
                  </div>

                  {/* Audio */}
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-2">ÁUDIO PLAYBACK (MP3/WAV)</label>
                    <div className="flex items-center space-x-3">
                      <div className="w-16 h-16 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0">
                        <Music className="w-6 h-6 text-gray-400" />
                      </div>
                      <div>
                        <label className="bg-black hover:bg-gray-800 text-white font-orbitron font-bold px-3 py-1.5 rounded-lg text-[10px] cursor-pointer inline-block">
                          SUBIR ÁUDIO REAL
                          <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                        </label>
                        <p className="text-[8px] text-gray-400 mt-1">Playbacks em MP3/WAV.</p>
                      </div>
                    </div>
                    {isUploading && uploadingField === 'audio' && (
                      <div className="mt-3 text-[9px] font-orbitron text-red-600">Uploading audio... {uploadProgress}%</div>
                    )}
                  </div>
                </div>

                {/* LINK PLATAFORMAS */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                  <span className="font-orbitron text-[10px] text-gray-500 block font-bold">LINKS DAS PLATAFORMAS</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-orbitron font-bold text-gray-500">SPOTIFY LINK</label>
                      <input
                        type="url"
                        value={streamForm.spotifyUrl}
                        onChange={e => setStreamForm(prev => ({ ...prev, spotifyUrl: e.target.value }))}
                        placeholder="https://open.spotify.com/track/..."
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs text-black focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-orbitron font-bold text-gray-500">YOUTUBE LINK</label>
                      <input
                        type="url"
                        value={streamForm.youtubeUrl}
                        onChange={e => setStreamForm(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                        placeholder="https://youtube.com/watch?v=..."
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs text-black focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* PLATFORM STREAMS DIVISION */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-orbitron text-[10px] text-gray-500 block font-bold">MÉTRICAS DE REPRODUÇÕES (STREAMS)</span>
                    <button
                      type="button"
                      onClick={() => setStreamForm(prev => ({ ...prev, usePlatformsBreakdown: !prev.usePlatformsBreakdown }))}
                      className="text-[9px] font-orbitron text-[#FF0033] hover:underline"
                    >
                      {streamForm.usePlatformsBreakdown ? 'FORNECER APENAS VALOR TOTAL' : 'SEPARAR POR PLATAFORMA'}
                    </button>
                  </div>

                  {streamForm.usePlatformsBreakdown ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] font-orbitron font-bold text-gray-500">SPOTIFY</label>
                        <input
                          type="number"
                          value={streamForm.spotifyStream}
                          onChange={e => setStreamForm(prev => ({ ...prev, spotifyStream: Number(e.target.value) }))}
                          placeholder="0"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs text-black focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-orbitron font-bold text-gray-500">YOUTUBE</label>
                        <input
                          type="number"
                          value={streamForm.youtubeStream}
                          onChange={e => setStreamForm(prev => ({ ...prev, youtubeStream: Number(e.target.value) }))}
                          placeholder="0"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs text-black focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-orbitron font-bold text-gray-500">APPLE MUSIC</label>
                        <input
                          type="number"
                          value={streamForm.appleMusicStream}
                          onChange={e => setStreamForm(prev => ({ ...prev, appleMusicStream: Number(e.target.value) }))}
                          placeholder="0"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs text-black focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-orbitron font-bold text-gray-500">DEEZER</label>
                        <input
                          type="number"
                          value={streamForm.deezerStream}
                          onChange={e => setStreamForm(prev => ({ ...prev, deezerStream: Number(e.target.value) }))}
                          placeholder="0"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs text-black focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-orbitron font-bold text-gray-500">AMAZON MUSIC</label>
                        <input
                          type="number"
                          value={streamForm.amazonMusicStream}
                          onChange={e => setStreamForm(prev => ({ ...prev, amazonMusicStream: Number(e.target.value) }))}
                          placeholder="0"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs text-black focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-orbitron font-bold text-gray-500">TIKTOK</label>
                        <input
                          type="number"
                          value={streamForm.tiktokStream}
                          onChange={e => setStreamForm(prev => ({ ...prev, tiktokStream: Number(e.target.value) }))}
                          placeholder="0"
                          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-1.5 text-xs text-black focus:outline-none"
                        />
                      </div>
                      <div className="col-span-full pt-3 border-t border-gray-200 mt-2 flex items-center justify-between">
                        <span className="text-[10px] font-orbitron font-bold text-gray-500">SOMA TOTAL DOS STREAMS:</span>
                        <span className="text-sm font-orbitron font-black text-[#FF0033] bg-red-50 px-3 py-1 rounded-full">
                          {formatFriendlyNumber(
                            Number(streamForm.spotifyStream) + 
                            Number(streamForm.youtubeStream) + 
                            Number(streamForm.appleMusicStream) + 
                            Number(streamForm.deezerStream) + 
                            Number(streamForm.amazonMusicStream) + 
                            Number(streamForm.tiktokStream)
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[9px] font-orbitron font-bold text-gray-500 block mb-1">INFORMAR QUANTIDADE TOTAL DE REPRODUÇÕES *</label>
                      <input
                        type="number"
                        required
                        value={streamForm.manualTotal}
                        onChange={e => setStreamForm(prev => ({ ...prev, manualTotal: Number(e.target.value) }))}
                        placeholder="Ex: 2450000"
                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-xs text-black focus:outline-none focus:border-[#FF0033]"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">STATUS</label>
                    <select
                      value={streamForm.status}
                      onChange={e => setStreamForm(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-xs font-sans text-black focus:outline-none"
                    >
                      <option value="Ativo">Ativo (Público)</option>
                      <option value="Rascunho">Rascunho</option>
                      <option value="Oculto">Oculto</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2 py-4">
                    <input
                      type="checkbox"
                      id="featStreamCheck"
                      checked={streamForm.featured}
                      onChange={e => setStreamForm(prev => ({ ...prev, featured: e.target.checked }))}
                      className="w-4 h-4 accent-[#FF0033]"
                    />
                    <label htmlFor="featStreamCheck" className="font-orbitron text-xs text-black font-bold cursor-pointer">
                      MARCAR COMO DESTAQUE PRINCIPAL
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1 text-left">
                    {getStreamFormValidationError() ? (
                      <div className="text-[10px] font-orbitron font-bold text-red-600 flex items-center space-x-1.5 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200/50">
                        <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                        <span>{getStreamFormValidationError()}</span>
                      </div>
                    ) : (
                      <div className="text-[10px] font-orbitron font-bold text-emerald-600 flex items-center space-x-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200/50">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        <span>Formulário válido. Pronto para publicar!</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsStreamModalOpen(false)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-xs font-orbitron font-bold"
                    >
                      CANCELAR
                    </button>
                    <button
                      type="submit"
                      disabled={!!getStreamFormValidationError() || isSaving}
                      className="bg-[#FF0033] hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-xs font-orbitron font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>SALVANDO...</span>
                        </>
                      ) : (
                        <span>SALVAR MÚSICA</span>
                      )}
                    </button>
                  </div>
                </div>

              </form>
            </motion.div>
          </motion.div>
        )}

        {/* =========================================================================
            MODAL: COMUNIDADE (NOVA / EDITAR)
            ========================================================================= */}
        {isCommunityModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white w-full max-w-xl rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative"
            >
              <button
                type="button"
                onClick={() => setIsCommunityModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <span className="font-orbitron text-[10px] text-[#FF0033] tracking-widest font-bold block uppercase">
                  {editingCommunity ? 'EDITAR COMUNIDADE' : 'NOVA COMUNIDADE'}
                </span>
                <h3 className="font-orbitron font-black text-xl text-black mt-1">
                  {editingCommunity ? 'ATUALIZAR CADASTRO' : 'CRIAR NOVO GRUPO / CANAL'}
                </h3>
              </div>

              <form onSubmit={handleSaveCommunity} className="space-y-4">
                <div>
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">NOME DA COMUNIDADE *</label>
                  <input
                    type="text"
                    required
                    value={communityForm.name}
                    onChange={e => setCommunityForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Grupo Secreto da Diretoria VIP"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-black focus:outline-none focus:border-[#FF0033]"
                  />
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-2">CAPA DO GRUPO * (PNG/JPG)</label>
                  <div className="flex items-center space-x-3">
                    {communityForm.coverUrl ? (
                      <img src={communityForm.coverUrl} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0 border border-gray-300" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0">
                        <Users className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <label className="bg-black hover:bg-gray-800 text-white font-orbitron font-bold px-3 py-1.5 rounded-lg text-[10px] cursor-pointer inline-block">
                        SELECIONAR CAPA
                        <input type="file" accept="image/*" onChange={handleCommunityCoverUpload} className="hidden" />
                      </label>
                      <p className="text-[8px] text-gray-400 mt-1">Imagem quadrada recomendada (Ex: 500x500px).</p>
                    </div>
                  </div>
                  {isUploading && uploadingField === 'cover' && (
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-[8px] font-orbitron text-gray-500">
                        <span>ENVIANDO IMAGEM DE CAPA...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden">
                        <div className="bg-[#FF0033] h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">LINK DO WHATSAPP</label>
                    <input
                      type="text"
                      value={communityForm.whatsappUrl}
                      onChange={e => setCommunityForm(prev => ({ ...prev, whatsappUrl: e.target.value }))}
                      placeholder="https://chat.whatsapp.com/..."
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-black focus:outline-none focus:border-[#FF0033]"
                    />
                  </div>
                  <div>
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">LINK DO DISCORD</label>
                    <input
                      type="text"
                      value={communityForm.discordUrl}
                      onChange={e => setCommunityForm(prev => ({ ...prev, discordUrl: e.target.value }))}
                      placeholder="https://discord.gg/..."
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-black focus:outline-none focus:border-[#FF0033]"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">STATUS</label>
                  <select
                    value={communityForm.status}
                    onChange={e => setCommunityForm(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs font-sans text-black focus:outline-none"
                  >
                    <option value="Ativo">Ativo (Público)</option>
                    <option value="Inativo">Inativo (Oculto)</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsCommunityModalOpen(false)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-xs font-orbitron font-bold"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    className="bg-[#FF0033] hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-xs font-orbitron font-bold"
                  >
                    SALVAR COMUNIDADE
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
