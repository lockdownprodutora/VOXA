import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload,
  Youtube,
  Image as ImageIcon,
  Film,
  ExternalLink,
  Megaphone,
  Check,
  DollarSign,
  Layers,
  ShieldCheck,
  GripVertical
} from 'lucide-react';
import { ProfileBanner, ProfileAdSettings } from '../types';
import { uploadFile } from '../utils/upload';
import { extractYouTubeVideoId } from './ProfileCover';
import { db, isFirebaseConfigured } from '../lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where
} from 'firebase/firestore';
import { formatBRL } from '../utils/money';

interface ProfileBannersManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  activeUserData: any;
  onUpdated: (banners: ProfileBanner[], adSettings: ProfileAdSettings, firstCoverUrl: string) => void;
  triggerToast: (msg: string) => void;
}

export const ProfileBannersManagerModal: React.FC<ProfileBannersManagerModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  activeUserData,
  onUpdated,
  triggerToast
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'banners' | 'voxa_ads'>('banners');
  const [banners, setBanners] = useState<ProfileBanner[]>([]);
  const [adSettings, setAdSettings] = useState<ProfileAdSettings>({
    allowBannerAds: false,
    availableSlotsCount: 1,
    price24h: 25,
    price7d: 120,
    price30d: 400,
    requireManualApproval: true
  });
  const [receivedAdRequests, setReceivedAdRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Add new banner form state
  const [newBannerType, setNewBannerType] = useState<'image' | 'gif' | 'video' | 'youtube'>('image');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newYoutubeUrl, setNewYoutubeUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newRedirectUrl, setNewRedirectUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const ownerUid = currentUser?.uid || currentUser?.id || '';

  useEffect(() => {
    if (!isOpen || !ownerUid) return;
    loadBannersAndSettings();
  }, [isOpen, ownerUid]);

  const loadBannersAndSettings = async () => {
    setLoading(true);
    try {
      let loadedBanners: ProfileBanner[] = [];
      const localKey = `voxa_profile_banners_${ownerUid}`;
      const localSaved = localStorage.getItem(localKey);
      if (localSaved) {
        try {
          loadedBanners = JSON.parse(localSaved);
        } catch {}
      }

      if (isFirebaseConfigured()) {
        const q = query(collection(db, 'profile_banners'), where('ownerUid', '==', ownerUid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          loadedBanners = [];
          snap.forEach(d => {
            const data = d.data() as ProfileBanner;
            loadedBanners.push({ ...data, bannerId: data.bannerId || d.id });
          });
        }

        const adSnap = await getDoc(doc(db, 'profile_ad_settings', ownerUid));
        if (adSnap.exists()) {
          setAdSettings(prev => ({ ...prev, ...(adSnap.data() as ProfileAdSettings) }));
        } else if (activeUserData?.profileAdSettings) {
          setAdSettings(prev => ({ ...prev, ...activeUserData.profileAdSettings }));
        }

        // Load received profile banner ad campaigns targeting this user
        const campQ = query(collection(db, 'ad_campaigns'), where('targetOwnerUid', '==', ownerUid));
        const campSnap = await getDocs(campQ);
        const reqs: any[] = [];
        campSnap.forEach(d => reqs.push({ id: d.id, ...d.data() }));
        setReceivedAdRequests(reqs);
      }

      // Compatibilidade com coverUrl atual se nenhum banner existir ainda
      const legacyCover = (activeUserData?.coverUrl || activeUserData?.coverURL || currentUser?.coverUrl || currentUser?.coverURL || '').trim();
      if (loadedBanners.length === 0 && legacyCover) {
        const isVideo = legacyCover.toLowerCase().endsWith('.mp4');
        const isGif = legacyCover.toLowerCase().endsWith('.gif');
        loadedBanners = [
          {
            bannerId: `bn_${ownerUid}_1`,
            ownerUid,
            type: isVideo ? 'video' : isGif ? 'gif' : 'image',
            mediaUrl: legacyCover,
            title: 'Capa Principal',
            redirectUrl: '',
            position: 1,
            active: true,
            createdAt: new Date().toISOString()
          }
        ];
      }

      loadedBanners.sort((a, b) => (a.position || 1) - (b.position || 1));
      setBanners(loadedBanners.slice(0, 4));
    } catch (e) {
      console.warn('Failed to load profile banners:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const res = await uploadFile(
        file,
        'profile_banner',
        (prog) => setUploadProgress(Math.round(prog.percentage)),
        { targetUserId: ownerUid }
      );
      setNewMediaUrl(res.url);
      if (file.type.toLowerCase() === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4')) {
        setNewBannerType('video');
      } else if (file.type.toLowerCase() === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
        setNewBannerType('gif');
      } else {
        setNewBannerType('image');
      }
      triggerToast('Mídia do banner enviada com sucesso!');
    } catch (err: any) {
      alert(err?.message || 'Erro ao enviar arquivo do banner.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddBanner = async () => {
    if (banners.length >= 4) {
      alert('Você pode cadastrar no máximo 4 banners no carrossel do perfil.');
      return;
    }

    let finalYoutubeId = '';
    let finalMediaUrl = newMediaUrl.trim();

    if (newBannerType === 'youtube') {
      finalYoutubeId = extractYouTubeVideoId(newYoutubeUrl);
      if (!finalYoutubeId) {
        alert('Informe uma URL válida de vídeo do YouTube.');
        return;
      }
      finalMediaUrl = `https://www.youtube.com/watch?v=${finalYoutubeId}`;
    } else {
      if (!finalMediaUrl) {
        alert('Envie um arquivo de mídia (JPG, PNG, WEBP, GIF ou MP4) para adicionar o banner.');
        return;
      }
    }

    const nowIso = new Date().toISOString();
    const bannerId = `bn_${ownerUid}_${Date.now()}`;
    const newBanner: ProfileBanner = {
      bannerId,
      ownerUid,
      type: newBannerType,
      mediaUrl: finalMediaUrl,
      youtubeVideoId: finalYoutubeId || undefined,
      redirectUrl: newRedirectUrl.trim(),
      title: newTitle.trim() || `Banner #${banners.length + 1}`,
      position: banners.length + 1,
      active: true,
      isAdvertisement: false,
      clicksCount: 0,
      impressionsCount: 0,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const nextBanners = [...banners, newBanner].slice(0, 4).map((b, idx) => ({
      ...b,
      position: idx + 1
    }));

    setBanners(nextBanners);
    setNewMediaUrl('');
    setNewYoutubeUrl('');
    setNewTitle('');
    setNewRedirectUrl('');

    await persistBannersList(nextBanners, adSettings, 'Banner adicionado ao carrossel!');
  };

  const handleRemoveBanner = async (bannerId: string) => {
    const filtered = banners
      .filter(b => b.bannerId !== bannerId)
      .map((b, idx) => ({ ...b, position: idx + 1 }));
    setBanners(filtered);

    if (isFirebaseConfigured()) {
      try {
        await deleteDoc(doc(db, 'profile_banners', bannerId));
      } catch {}
    }

    await persistBannersList(filtered, adSettings, 'Banner removido do carrossel!');
  };

  const handleMovePosition = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= banners.length) return;
    const copy = [...banners];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    const nowIso = new Date().toISOString();
    const reindexed = copy.map((b, i) => ({ ...b, position: i + 1, updatedAt: nowIso }));
    setBanners(reindexed);
    await persistBannersList(reindexed, adSettings, 'Ordem dos banners atualizada!');
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...banners];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    const nowIso = new Date().toISOString();
    const reindexed = updated.map((b, idx) => ({
      ...b,
      position: idx + 1,
      updatedAt: nowIso
    }));

    setDraggedIndex(null);
    setDragOverIndex(null);
    setBanners(reindexed);
    await persistBannersList(reindexed, adSettings, 'Ordem do carrossel atualizada!');
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleToggleBannerActive = async (bannerId: string) => {
    const nowIso = new Date().toISOString();
    const updated = banners.map(b =>
      b.bannerId === bannerId ? { ...b, active: !b.active, updatedAt: nowIso } : b
    );
    setBanners(updated);
    await persistBannersList(updated, adSettings);
  };

  const persistBannersList = async (
    listToSave: ProfileBanner[],
    settingsToSave: ProfileAdSettings,
    toastMessage?: string
  ) => {
    setSaving(true);
    try {
      const normalized = listToSave.slice(0, 4).map((b, idx) => ({
        ...b,
        position: idx + 1
      }));

      // Primeiro banner de imagem/gif/video serve como coverUrl retrocompatível
      const firstVisual = normalized.find(b => b.active && b.type !== 'youtube' && b.mediaUrl);
      const firstCoverUrl = firstVisual?.mediaUrl || (activeUserData?.coverUrl || activeUserData?.coverURL || '');

      localStorage.setItem(`voxa_profile_banners_${ownerUid}`, JSON.stringify(normalized));

      if (isFirebaseConfigured() && ownerUid) {
        for (const item of normalized) {
          await setDoc(doc(db, 'profile_banners', item.bannerId), item, { merge: true });
        }
        await setDoc(doc(db, 'profile_ad_settings', ownerUid), {
          ...settingsToSave,
          ownerUid,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        await updateDoc(doc(db, 'users', ownerUid), {
          profileBanners: normalized,
          profileAdSettings: settingsToSave,
          coverUrl: firstCoverUrl,
          coverURL: firstCoverUrl,
          updatedAt: new Date().toISOString()
        });
      }

      window.dispatchEvent(new CustomEvent('voxa_profile_banners_updated', { detail: { ownerUid } }));
      onUpdated(normalized, settingsToSave, firstCoverUrl);
      if (toastMessage) triggerToast(toastMessage);
    } catch (err: any) {
      console.warn('Error persisting profile banners:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistBannersList(banners, adSettings, 'Configurações de monetização do perfil salvas!');
  };

  const handleApproveAdRequest = async (campaign: any) => {
    if (banners.length >= 4) {
      alert('Seu carrossel já possui 4 banners ocupados. Remova ou desative um banner antes de aprovar o anúncio.');
      return;
    }
    try {
      const durationMs = (Number(campaign.durationDays) || 1) * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(Date.now() + durationMs).toISOString();
      const nowIso = new Date().toISOString();
      const bannerId = `bn_ad_${campaign.id}`;
      const newAdBanner: ProfileBanner = {
        bannerId,
        ownerUid,
        type: campaign.mediaType === 'youtube' ? 'youtube' : campaign.mediaType === 'video' ? 'video' : 'image',
        mediaUrl: campaign.mediaUrl || '',
        youtubeVideoId: campaign.youtubeVideoId || extractYouTubeVideoId(campaign.mediaUrl),
        redirectUrl: campaign.ctaLink || '',
        title: campaign.title || 'Patrocinado VOXA Ads',
        position: banners.length + 1,
        active: true,
        isAdvertisement: true,
        adCampaignId: campaign.id,
        isSponsoredAd: true,
        sponsorUid: campaign.userId,
        sponsorName: campaign.userName,
        sponsorUsername: campaign.userUsername,
        expiresAt,
        clicksCount: 0,
        impressionsCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      const nextBanners = [...banners, newAdBanner].slice(0, 4);
      setBanners(nextBanners);

      if (isFirebaseConfigured()) {
        await updateDoc(doc(db, 'ad_campaigns', campaign.id), {
          status: 'active',
          approvedByProfileOwnerAt: new Date().toISOString(),
          expiresAt
        });
      }

      setReceivedAdRequests(prev =>
        prev.map(r => (r.id === campaign.id ? { ...r, status: 'active' } : r))
      );

      await persistBannersList(nextBanners, adSettings, 'Anúncio aprovado e publicado no carrossel do seu perfil!');
    } catch (err: any) {
      alert('Erro ao aprovar anúncio: ' + err.message);
    }
  };

  const handleRejectAdRequest = async (campaign: any) => {
    try {
      if (isFirebaseConfigured()) {
        await updateDoc(doc(db, 'ad_campaigns', campaign.id), {
          status: 'rejected',
          reviewedAt: new Date().toISOString()
        });
      }
      setReceivedAdRequests(prev =>
        prev.map(r => (r.id === campaign.id ? { ...r, status: 'rejected' } : r))
      );
      triggerToast('Solicitação de anúncio recusada.');
    } catch (err: any) {
      alert('Erro ao recusar anúncio: ' + err.message);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-[#12111d] border border-white/10 max-w-2xl w-full rounded-[32px] overflow-hidden shadow-2xl text-white flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-2xl bg-[#FF0033]/15 border border-[#FF0033]/30 flex items-center justify-center text-[#FF0033]">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-orbitron font-black text-base uppercase tracking-wider text-white">
                  Carrossel de Banner do Perfil & VOXA Ads
                </h3>
                <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">
                  Até 4 banners rotativos (Imagem, GIF, MP4, YouTube) + Monetização
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sub-navigation Tabs */}
          <div className="flex border-b border-white/10 bg-black/20 px-6 pt-3 gap-4">
            <button
              type="button"
              onClick={() => setActiveSubTab('banners')}
              className={`pb-3 text-xs font-orbitron font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'banners'
                  ? 'border-[#FF0033] text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Meus Banners ({banners.length}/4)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('voxa_ads')}
              className={`pb-3 text-xs font-orbitron font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'voxa_ads'
                  ? 'border-[#FF0033] text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Megaphone className="w-4 h-4 text-[#FF0033]" />
              <span>Monetizar com VOXA Ads</span>
              {receivedAdRequests.filter(r => r.status === 'pending_review' || r.status === 'pending_owner_approval').length > 0 && (
                <span className="bg-[#FF0033] text-white text-[9px] px-1.5 py-0.5 rounded-full">
                  {receivedAdRequests.filter(r => r.status === 'pending_review' || r.status === 'pending_owner_approval').length}
                </span>
              )}
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-6 text-left flex-1">
            {loading ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-[#FF0033] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-orbitron text-gray-400 uppercase tracking-widest">Carregando banners...</p>
              </div>
            ) : activeSubTab === 'banners' ? (
              <>
                {/* Existing Banners List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-orbitron font-black uppercase tracking-widest text-gray-400">
                      Peças do Carrossel ({banners.length} de 4)
                    </span>
                    {saving && (
                      <span className="text-[10px] font-mono text-emerald-400 animate-pulse">Salvando...</span>
                    )}
                  </div>

                  {banners.length === 0 ? (
                    <div className="bg-black/40 border border-dashed border-white/10 rounded-2xl p-6 text-center space-y-1">
                      <p className="text-xs font-orbitron font-bold text-gray-400 uppercase">
                        Nenhum banner configurado
                      </p>
                      <p className="text-[11px] text-gray-500 font-sans">
                        Adicione até 4 banners (Imagem, GIF, Vídeo MP4 ou YouTube) com link de redirecionamento.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <p className="text-[10px] text-gray-500 font-sans">
                        Arraste os itens (drag-and-drop) ou use as setas para reordenar as posições de 1 a 4.
                      </p>
                      {banners.map((b, idx) => (
                        <div
                          key={b.bannerId}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDrop={() => handleDrop(idx)}
                          onDragEnd={handleDragEnd}
                          className={`bg-black/40 border rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all ${
                            dragOverIndex === idx && draggedIndex !== idx
                              ? 'border-[#FF0033] bg-[#FF0033]/10 scale-[1.01]'
                              : draggedIndex === idx
                              ? 'opacity-50 border-white/30'
                              : 'border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-white p-1 shrink-0"
                              title="Arraste para reordenar"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <span className="w-6 h-6 rounded-lg bg-white/10 font-mono text-xs font-black flex items-center justify-center shrink-0">
                              #{idx + 1}
                            </span>

                            <div className="w-16 h-10 rounded-lg overflow-hidden bg-zinc-900 border border-white/10 shrink-0 flex items-center justify-center">
                              {b.type === 'youtube' ? (
                                <Youtube className="w-5 h-5 text-red-500" />
                              ) : b.type === 'video' ? (
                                b.mediaUrl ? (
                                  <video src={b.mediaUrl} className="w-full h-full object-cover" muted />
                                ) : (
                                  <span className="text-[9px] font-mono text-gray-500">MP4</span>
                                )
                              ) : (
                                b.mediaUrl ? (
                                  <img
                                    src={b.mediaUrl}
                                    alt={b.title || `Banner #${idx + 1}`}
                                    sizes="64px"
                                    width={64}
                                    height={40}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-[9px] font-mono text-gray-500">IMG</span>
                                )
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-orbitron font-bold text-white truncate">
                                  {b.title || `Banner #${idx + 1}`}
                                </span>
                                <span className="text-[8px] font-mono uppercase px-2 py-0.5 rounded bg-white/10 text-gray-300">
                                  {b.type}
                                </span>
                                {b.isSponsoredAd && (
                                  <span className="text-[8px] font-orbitron font-black uppercase px-2 py-0.5 rounded bg-[#FF0033]/20 text-[#FF0033]">
                                    VOXA Ads
                                  </span>
                                )}
                              </div>
                              {b.redirectUrl ? (
                                <span className="text-[10px] text-emerald-400 font-mono truncate block flex items-center gap-1">
                                  <ExternalLink className="w-2.5 h-2.5 inline" /> {b.redirectUrl}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-500 font-sans block">Sem link de redirecionamento</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMovePosition(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer"
                              title="Subir posição"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMovePosition(idx, 'down')}
                              disabled={idx === banners.length - 1}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 cursor-pointer"
                              title="Descer posição"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleBannerActive(b.bannerId)}
                              className={`text-[9px] font-orbitron font-black px-2.5 py-1 rounded-lg uppercase cursor-pointer ${
                                b.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-gray-500'
                              }`}
                            >
                              {b.active ? 'Ativo' : 'Oculto'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveBanner(b.bannerId)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 cursor-pointer"
                              title="Remover banner"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add New Banner Form */}
                {banners.length < 4 && (
                  <div className="bg-black/50 border border-white/10 rounded-2xl p-5 space-y-4">
                    <span className="text-[10px] font-orbitron font-black uppercase tracking-widest text-[#FF0033] block">
                      + Adicionar Novo Banner ({banners.length + 1}/4)
                    </span>

                    {/* Format Selector */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'image', label: 'Imagem (JPG/PNG/WEBP)', icon: ImageIcon },
                        { id: 'gif', label: 'GIF Animado', icon: ImageIcon },
                        { id: 'video', label: 'Vídeo MP4', icon: Film },
                        { id: 'youtube', label: 'YouTube URL', icon: Youtube }
                      ].map(fmt => {
                        const Icon = fmt.icon;
                        return (
                          <button
                            key={fmt.id}
                            type="button"
                            onClick={() => setNewBannerType(fmt.id as any)}
                            className={`p-2.5 rounded-xl border text-[10px] font-orbitron font-bold uppercase flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                              newBannerType === fmt.id
                                ? 'bg-white text-black border-white'
                                : 'bg-black/40 text-gray-400 border-white/10 hover:border-white/30'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{fmt.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Media Input */}
                    {newBannerType === 'youtube' ? (
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                          URL do Vídeo no YouTube
                        </label>
                        <input
                          type="url"
                          value={newYoutubeUrl}
                          onChange={(e) => setNewYoutubeUrl(e.target.value)}
                          placeholder="Ex: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                          className="w-full bg-[#1b1928] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-[#FF0033] outline-none"
                        />
                        {extractYouTubeVideoId(newYoutubeUrl) && (
                          <span className="text-[10px] text-emerald-400 font-mono block">
                            ✓ Vídeo detectado (ID: {extractYouTubeVideoId(newYoutubeUrl)})
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                          Arquivo de Mídia ({newBannerType === 'video' ? 'MP4' : newBannerType === 'gif' ? 'GIF' : 'JPG, JPEG, PNG, WEBP'})
                        </label>
                        <div className="flex items-center gap-3">
                          <label className="bg-white hover:bg-neutral-200 text-black font-orbitron font-black text-[10px] px-4 py-2.5 rounded-xl cursor-pointer uppercase tracking-wider flex items-center gap-2 transition-all">
                            <Upload className="w-3.5 h-3.5" />
                            <span>{isUploading ? `Enviando ${uploadProgress}%` : 'Enviar Arquivo'}</span>
                            <input
                              type="file"
                              accept={
                                newBannerType === 'video'
                                  ? 'video/mp4'
                                  : newBannerType === 'gif'
                                  ? 'image/gif'
                                  : 'image/jpeg,image/jpg,image/png,image/webp,image/gif,video/mp4'
                              }
                              onChange={handleFileUpload}
                              className="hidden"
                              disabled={isUploading}
                            />
                          </label>
                          {newMediaUrl && (
                            <span className="text-[10px] font-mono text-emerald-400 truncate max-w-xs">
                              ✓ Mídia carregada e pronta
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Title & Redirect URL */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                          Título / Chamada (Opcional)
                        </label>
                        <input
                          type="text"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="Ex: Ouça meu novo single"
                          maxLength={40}
                          className="w-full bg-[#1b1928] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-[#FF0033] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                          Link de Redirecionamento (Opcional)
                        </label>
                        <input
                          type="text"
                          value={newRedirectUrl}
                          onChange={(e) => setNewRedirectUrl(e.target.value)}
                          placeholder="Ex: https://meusite.com ou /store"
                          className="w-full bg-[#1b1928] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-[#FF0033] outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddBanner}
                      disabled={isUploading || saving}
                      className="w-full bg-[#FF0033] hover:bg-red-700 disabled:opacity-50 text-white font-orbitron font-black text-xs py-3.5 rounded-xl uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar ao Carrossel do Perfil</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* VOXA ADS MONETIZATION TAB */
              <div className="space-y-6">
                <form onSubmit={handleSaveAdSettings} className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-orbitron font-black text-sm text-white uppercase">
                        Monetizar Banner do Meu Perfil (VOXA Ads)
                      </h4>
                      <p className="text-[11px] text-gray-400 font-sans mt-0.5">
                        Permita que marcas e outros criadores anunciem em até 4 slots do carrossel do seu perfil e receba direto na sua Carteira VOXA.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdSettings(prev => ({ ...prev, allowBannerAds: !prev.allowBannerAds }))}
                      className={`w-12 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                        adSettings.allowBannerAds ? 'bg-emerald-500' : 'bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          adSettings.allowBannerAds ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {adSettings.allowBannerAds && (
                    <div className="space-y-4 pt-3 border-t border-white/10">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                            Slots Disponíveis para Anúncios (Máx 4)
                          </label>
                          <select
                            value={adSettings.availableSlotsCount}
                            onChange={(e) =>
                              setAdSettings(prev => ({ ...prev, availableSlotsCount: Number(e.target.value) }))
                            }
                            className="w-full bg-[#1b1928] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-orbitron"
                          >
                            <option value={1}>1 Slot no Carrossel</option>
                            <option value={2}>2 Slots no Carrossel</option>
                            <option value={3}>3 Slots no Carrossel</option>
                            <option value={4}>Até 4 Slots no Carrossel</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                            Aprovação de Criativos
                          </label>
                          <select
                            value={adSettings.requireManualApproval ? 'manual' : 'auto'}
                            onChange={(e) =>
                              setAdSettings(prev => ({
                                ...prev,
                                requireManualApproval: e.target.value === 'manual'
                              }))
                            }
                            className="w-full bg-[#1b1928] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-orbitron"
                          >
                            <option value="manual">Exigir minha aprovação manual</option>
                            <option value="auto">Publicar automaticamente após pagamento</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                            Preço 24 Horas (R$)
                          </label>
                          <input
                            type="number"
                            min={5}
                            value={adSettings.price24h}
                            onChange={(e) =>
                              setAdSettings(prev => ({ ...prev, price24h: Number(e.target.value) }))
                            }
                            className="w-full bg-[#1b1928] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                            Preço 7 Dias (R$)
                          </label>
                          <input
                            type="number"
                            min={10}
                            value={adSettings.price7d}
                            onChange={(e) =>
                              setAdSettings(prev => ({ ...prev, price7d: Number(e.target.value) }))
                            }
                            className="w-full bg-[#1b1928] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                            Preço 30 Dias (R$)
                          </label>
                          <input
                            type="number"
                            min={20}
                            value={adSettings.price30d}
                            onChange={(e) =>
                              setAdSettings(prev => ({ ...prev, price30d: Number(e.target.value) }))
                            }
                            className="w-full bg-[#1b1928] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-white hover:bg-neutral-200 text-black font-orbitron font-black text-xs py-3 rounded-xl uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Salvar Configurações do VOXA Ads no Perfil
                  </button>
                </form>

                {/* Solicitações de Anúncio Recebidas neste Perfil */}
                <div className="space-y-3">
                  <h4 className="font-orbitron font-black text-xs uppercase tracking-wider text-gray-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#FF0033]" />
                    <span>Anúncios Contratados no Seu Perfil ({receivedAdRequests.length})</span>
                  </h4>

                  {receivedAdRequests.length === 0 ? (
                    <div className="bg-black/30 border border-white/5 rounded-2xl p-6 text-center text-xs text-gray-500">
                      Nenhuma solicitação de banner patrocinado recebida ainda.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {receivedAdRequests.map(req => (
                        <div
                          key={req.id}
                          className="bg-black/40 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-orbitron font-bold text-xs text-white uppercase">
                                {req.title || 'Campanha VOXA Ads'}
                              </span>
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                {formatBRL(req.ownerEarnings || req.cost || 0)}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400">
                              Anunciante: {req.userName || 'Membro VOXA'} • {req.durationDays || 1} dia(s)
                            </p>
                            {req.ctaLink && (
                              <span className="text-[10px] font-mono text-gray-500 block truncate max-w-xs">
                                Destino: {req.ctaLink}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {(req.status === 'pending_review' || req.status === 'pending_owner_approval') ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApproveAdRequest(req)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-orbitron font-black text-[10px] px-3 py-2 rounded-xl uppercase cursor-pointer flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" /> Aprovar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectAdRequest(req)}
                                  className="bg-red-600/20 hover:bg-red-600/30 text-red-400 font-orbitron font-black text-[10px] px-3 py-2 rounded-xl uppercase cursor-pointer"
                                >
                                  Recusar
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] font-orbitron uppercase px-2.5 py-1 rounded-full bg-white/10 text-gray-300">
                                {req.status === 'active' ? 'Ativo no Perfil' : req.status}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
