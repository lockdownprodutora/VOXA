import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Megaphone,
  Upload,
  Youtube,
  Image as ImageIcon,
  Film,
  DollarSign,
  CheckCircle2
} from 'lucide-react';
import { uploadFile } from '../utils/upload';
import { extractYouTubeVideoId } from './ProfileCover';
import { formatBRL } from '../utils/money';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ProfileBanner } from '../types';

interface ProfileAdSponsorModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetProfile: any;
  currentUser: any;
  walletBalance: number;
  onSuccess: () => void;
  triggerToast: (msg: string) => void;
}

export const ProfileAdSponsorModal: React.FC<ProfileAdSponsorModalProps> = ({
  isOpen,
  onClose,
  targetProfile,
  currentUser,
  walletBalance,
  onSuccess,
  triggerToast
}) => {
  const [mediaType, setMediaType] = useState<'image' | 'gif' | 'video' | 'youtube'>('image');
  const [mediaUrl, setMediaUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [title, setTitle] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [durationDays, setDurationDays] = useState<1 | 7 | 30>(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !targetProfile) return null;

  const adSettings = targetProfile.profileAdSettings || {
    allowBannerAds: false,
    availableSlotsCount: 1,
    price24h: 25,
    price7d: 120,
    price30d: 400,
    requireManualApproval: true
  };

  const getSelectedCost = () => {
    if (durationDays === 1) return Number(adSettings.price24h || 25);
    if (durationDays === 7) return Number(adSettings.price7d || 120);
    return Number(adSettings.price30d || 400);
  };

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
        { targetUserId: currentUser?.uid || 'sponsor' }
      );
      setMediaUrl(res.url);
      if (file.type.toLowerCase() === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4')) {
        setMediaType('video');
      } else if (file.type.toLowerCase() === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
        setMediaType('gif');
      } else {
        setMediaType('image');
      }
      triggerToast('Criativo carregado com sucesso!');
    } catch (err: any) {
      alert(err?.message || 'Erro no upload da mídia.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmitSponsorBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) {
      alert('Faça login na sua conta VOXA para anunciar neste perfil.');
      return;
    }

    const cost = getSelectedCost();
    if (walletBalance < cost) {
      alert(`Saldo insuficiente na carteira. Valor do anúncio: ${formatBRL(cost)}. Seu saldo: ${formatBRL(walletBalance)}.`);
      return;
    }

    let finalYoutubeId = '';
    let finalMediaUrl = mediaUrl.trim();

    if (mediaType === 'youtube') {
      finalYoutubeId = extractYouTubeVideoId(youtubeUrl);
      if (!finalYoutubeId) {
        alert('Informe uma URL válida de vídeo do YouTube.');
        return;
      }
      finalMediaUrl = `https://www.youtube.com/watch?v=${finalYoutubeId}`;
    } else if (!finalMediaUrl) {
      alert('Envie uma imagem, GIF ou vídeo MP4 para o seu banner patrocinado.');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetOwnerUid = targetProfile.uid || targetProfile.id;
      const ownerShare = Number((cost * 0.8).toFixed(2));
      const platformFee = Number((cost - ownerShare).toFixed(2));
      const autoApprove = adSettings.requireManualApproval === false;
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      if (isFirebaseConfigured()) {
        // 1. Debitar carteira do anunciante
        const sponsorWalletRef = doc(db, 'wallets', currentUser.uid);
        await setDoc(sponsorWalletRef, { balance: walletBalance - cost }, { merge: true });

        await addDoc(collection(db, 'wallet_transactions'), {
          userId: currentUser.uid,
          type: 'AD_PURCHASE',
          amount: -cost,
          status: 'APPROVED',
          description: `Banner VOXA Ads no perfil @${targetProfile.username || targetProfile.slug}`,
          timestamp: serverTimestamp()
        });

        // 2. Registrar campanha em ad_campaigns
        const campDoc = await addDoc(collection(db, 'ad_campaigns'), {
          userId: currentUser.uid,
          userName: currentUser.name || 'Anunciante VOXA',
          userUsername: currentUser.username || currentUser.slug || '',
          targetOwnerUid,
          targetOwnerUsername: targetProfile.username || targetProfile.slug || '',
          objective: 'banner_perfil',
          placements: ['Banner do Perfil'],
          mediaType,
          mediaUrl: finalMediaUrl,
          youtubeVideoId: finalYoutubeId || null,
          title: title.trim() || `Patrocinado por @${currentUser.username || 'membro'}`,
          description: `Banner no perfil @${targetProfile.username || targetProfile.slug}`,
          ctaText: 'Acessar Link',
          ctaLink: redirectUrl.trim(),
          durationDays,
          cost,
          ownerEarnings: ownerShare,
          platformFee,
          status: autoApprove ? 'active' : 'pending_owner_approval',
          impressionsCount: 0,
          clicksCount: 0,
          expiresAt,
          createdAt: new Date().toISOString()
        });

        // 3. Se o dono do perfil configurou publicação automática, inserir direto em profile_banners
        if (autoApprove) {
          const bannerId = `bn_ad_${campDoc.id}`;
          const newBanner: ProfileBanner = {
            bannerId,
            ownerUid: targetOwnerUid,
            type: mediaType,
            mediaUrl: finalMediaUrl,
            youtubeVideoId: finalYoutubeId || undefined,
            redirectUrl: redirectUrl.trim(),
            title: title.trim() || `VOXA Ads • @${currentUser.username || 'anuncio'}`,
            position: 4,
            active: true,
            isSponsoredAd: true,
            sponsorUid: currentUser.uid,
            sponsorName: currentUser.name,
            sponsorUsername: currentUser.username || currentUser.slug,
            expiresAt,
            clicksCount: 0,
            impressionsCount: 0,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'profile_banners', bannerId), newBanner, { merge: true });
          window.dispatchEvent(new CustomEvent('voxa_profile_banners_updated', { detail: { ownerUid: targetOwnerUid } }));
        }
      }

      triggerToast(
        autoApprove
          ? 'Seu banner VOXA Ads já está ativo no carrossel deste perfil!'
          : 'Anúncio enviado para aprovação do dono do perfil!'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Erro ao contratar banner no perfil: ' + (err?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-[#12111d] border border-white/10 max-w-lg w-full rounded-[32px] overflow-hidden shadow-2xl text-white flex flex-col max-h-[90vh]"
        >
          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-2xl bg-[#FF0033]/15 border border-[#FF0033]/30 flex items-center justify-center text-[#FF0033]">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-orbitron font-black text-sm uppercase tracking-wider text-white">
                  Anunciar no Banner de @{targetProfile.username || targetProfile.slug}
                </h3>
                <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">
                  VOXA Ads • Carrossel do Perfil
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmitSponsorBanner} className="p-6 overflow-y-auto space-y-5 text-left">
            {/* Period Selection */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                Escolha o Período de Exibição no Carrossel
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { days: 1 as const, label: '24 Horas', price: adSettings.price24h || 25 },
                  { days: 7 as const, label: '7 Dias', price: adSettings.price7d || 120 },
                  { days: 30 as const, label: '30 Dias', price: adSettings.price30d || 400 }
                ].map(opt => (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => setDurationDays(opt.days)}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      durationDays === opt.days
                        ? 'bg-[#FF0033]/15 border-[#FF0033] text-white'
                        : 'bg-black/40 border-white/10 text-gray-400 hover:border-white/30'
                    }`}
                  >
                    <span className="block font-orbitron font-black text-xs uppercase">{opt.label}</span>
                    <span className="block font-mono text-xs text-emerald-400 font-bold mt-1">
                      {formatBRL(opt.price)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Format Selection */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                Formato do Banner
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'image', label: 'Imagem', icon: ImageIcon },
                  { id: 'gif', label: 'GIF', icon: ImageIcon },
                  { id: 'video', label: 'MP4', icon: Film },
                  { id: 'youtube', label: 'YouTube', icon: Youtube }
                ].map(fmt => {
                  const Icon = fmt.icon;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setMediaType(fmt.id as any)}
                      className={`p-2.5 rounded-xl border text-[10px] font-orbitron font-bold uppercase flex flex-col items-center gap-1 cursor-pointer ${
                        mediaType === fmt.id
                          ? 'bg-white text-black border-white'
                          : 'bg-black/40 text-gray-400 border-white/10'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{fmt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {mediaType === 'youtube' ? (
              <div className="space-y-1">
                <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                  URL do Vídeo no YouTube
                </label>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-[#1b1928] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-[#FF0033] outline-none"
                  required
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                  Upload da Peça Publicitária
                </label>
                <div className="flex items-center gap-3">
                  <label className="bg-white hover:bg-neutral-200 text-black font-orbitron font-black text-[10px] px-4 py-2.5 rounded-xl cursor-pointer uppercase tracking-wider flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploading ? `Enviando ${uploadProgress}%` : 'Selecionar Mídia'}</span>
                    <input
                      type="file"
                      accept={
                        mediaType === 'video'
                          ? 'video/mp4'
                          : mediaType === 'gif'
                          ? 'image/gif'
                          : 'image/jpeg,image/jpg,image/png,image/webp,image/gif,video/mp4'
                      }
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                  {mediaUrl && (
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Pronto
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                Título / Chamada do Anúncio
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Conheça nossa nova coleção"
                maxLength={40}
                className="w-full bg-[#1b1928] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-[#FF0033] outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                Link de Redirecionamento
              </label>
              <input
                type="text"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="Ex: https://seusite.com.br"
                className="w-full bg-[#1b1928] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-[#FF0033] outline-none"
                required
              />
            </div>

            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-orbitron text-gray-400 uppercase block">Total a Pagar</span>
                <span className="text-lg font-mono font-black text-emerald-400">{formatBRL(getSelectedCost())}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-orbitron text-gray-400 uppercase block">Seu Saldo</span>
                <span className="text-xs font-mono font-bold text-white">{formatBRL(walletBalance)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="w-full bg-[#FF0033] hover:bg-red-700 disabled:opacity-50 text-white font-orbitron font-black text-xs py-4 rounded-2xl uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              <span>{isSubmitting ? 'Processando...' : `Pagar ${formatBRL(getSelectedCost())} e Anunciar`}</span>
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
