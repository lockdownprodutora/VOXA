import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, MessageSquare, Repeat, Share2, Bookmark, MoreVertical, 
  Trash2, Edit2, AlertTriangle, Send, X, Plus, Download, Copy, 
  Check, CheckCircle2, Image, Globe, Lock, Users, Eye, HelpCircle,
  Sparkles, CheckCircle
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { 
  createVox, likeVox, repostVox, deleteVox, editVox, reportVox, 
  fetchVoxReplies, createNotification 
} from '../utils/storeDb';
import { VerifiedBadge, isVerifiedUser } from './common/VerifiedBadge';

// Central configuration limits
export const MAX_VOX_LENGTH = 500;

export interface Vox {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  authorVerified?: boolean;
  text: string;
  media?: string[];
  createdAt: string;
  updatedAt: string;
  editedAt?: string | null;
  replyTo?: string | null;
  quotedVoxId?: string | null;
  visibility: 'public' | 'followers' | 'private';
  likeCount: number;
  likesList: string[];
  replyCount: number;
  repostCount: number;
  repostsList: string[];
  isRepost?: boolean;
  repostOf?: string | null;
}

// ==========================================
// 1. VOX COMPOSER MODAL
// ==========================================
interface VoxComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  replyToId?: string | null;
  replyToVox?: Vox | null;
  quotedVoxId?: string | null;
  quotedVox?: Vox | null;
  initialText?: string;
  onSuccess: (newVox: any) => void;
  triggerToast: (msg: string) => void;
}

export const VoxComposerModal: React.FC<VoxComposerModalProps> = ({
  isOpen, onClose, currentUser, replyToId = null, replyToVox = null,
  quotedVoxId = null, quotedVox = null, initialText = '', onSuccess, triggerToast
}) => {
  const [text, setText] = useState(initialText || '');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMediaInput, setShowMediaInput] = useState(false);

  const replyToProfile = useResolvedUserProfile(
    replyToVox ? replyToVox.authorId : '',
    replyToVox ? replyToVox.authorName : '',
    replyToVox ? replyToVox.authorUsername : '',
    replyToVox ? replyToVox.authorAvatar : ''
  );

  const quotedProfile = useResolvedUserProfile(
    quotedVox ? quotedVox.authorId : '',
    quotedVox ? quotedVox.authorName : '',
    quotedVox ? quotedVox.authorUsername : '',
    quotedVox ? quotedVox.authorAvatar : ''
  );

  useEffect(() => {
    if (isOpen) {
      setText(initialText || '');
      setMediaUrls([]);
      setMediaInput('');
      setVisibility('public');
      setShowMediaInput(false);
    }
  }, [isOpen, initialText]);

  if (!isOpen) return null;

  const charactersLeft = MAX_VOX_LENGTH - text.length;

  const handleAddMedia = () => {
    if (mediaInput.trim()) {
      setMediaUrls(prev => [...prev, mediaInput.trim()]);
      setMediaInput('');
      setShowMediaInput(false);
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handlePublish = async () => {
    if (!text.trim() && mediaUrls.length === 0) return;
    if (text.length > MAX_VOX_LENGTH) {
      triggerToast('O texto excede o limite de caracteres!');
      return;
    }

    setIsSubmitting(true);
    try {
      let cleanUsername = currentUser.username || currentUser.slug;
      if (currentUser.uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || cleanUsername === 'juniorsantti' || cleanUsername === 'juniorsantti92') {
        cleanUsername = 'jrsantti';
      } else if (currentUser.uid === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1') {
        cleanUsername = 'voxa';
      }
      if (!cleanUsername || cleanUsername === 'user') {
        cleanUsername = currentUser.name ? currentUser.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'user';
      }
      const created = await createVox({
        authorId: currentUser.uid,
        authorName: currentUser.name || 'Membro',
        authorUsername: cleanUsername,
        authorAvatar: currentUser.photoURL || currentUser.avatarUrl || '',
        authorVerified: isVerifiedUser(currentUser),
        text: text.trim(),
        media: mediaUrls,
        replyTo: replyToId,
        quotedVoxId: quotedVoxId,
        visibility: visibility
      });

      triggerToast(replyToId ? 'Resposta publicada!' : 'Seu VOX foi publicado!');
      onSuccess(created);
      onClose();
    } catch (err: any) {
      console.error(err);
      triggerToast('Erro ao publicar: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#12111d] border border-white/10 w-full max-w-xl rounded-[28px] overflow-hidden flex flex-col shadow-2xl relative">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-white" />
            <span className="font-orbitron font-bold text-xs tracking-wider text-white">
              {replyToId ? 'RESPONDER VOX' : quotedVoxId ? 'CITAR VOX' : 'NOVO VOX'}
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/5 text-gray-400 hover:text-white cursor-pointer transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reply/Quote Context indicator */}
        {replyToVox && (
          <div className="bg-white/5 px-6 py-3 border-b border-white/5 flex items-center space-x-3 text-xs text-gray-400">
            <span className="font-bold text-white">Respondendo a:</span>
            <span className="truncate">@{replyToProfile.username}: "{replyToVox.text}"</span>
          </div>
        )}

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="flex items-start space-x-4">
            {/* User Avatar */}
            <div className="w-11 h-11 rounded-full overflow-hidden border border-white/20 bg-zinc-800 flex items-center justify-center text-gray-400 shrink-0">
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-orbitron font-bold text-xs">{currentUser.name?.charAt(0).toUpperCase()}</span>
              )}
            </div>

            {/* Editing Field */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center space-x-1.5">
                <span className="text-white font-bold font-orbitron text-xs">{currentUser.name}</span>
                {isVerifiedUser(currentUser) && (
                  <VerifiedBadge user={currentUser} size="xs" />
                )}
                <span className="text-gray-500 text-[10px]">@{currentUser.uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' ? 'jrsantti' : (currentUser.username || currentUser.slug || 'user')}</span>
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={replyToId ? "Escreva sua resposta..." : "O que você quer dizer? Espalhe sua voz..."}
                maxLength={MAX_VOX_LENGTH}
                rows={5}
                className="w-full bg-transparent border-0 resize-none text-sm text-white placeholder-gray-500 focus:ring-0 focus:outline-none leading-relaxed font-sans mt-1"
              />
            </div>
          </div>

          {/* Quoted Preview */}
          {quotedVox && (
            <div className="ml-15 bg-black/40 border border-white/10 p-4 rounded-2xl space-y-2 text-xs text-left">
              <div className="flex items-center space-x-1.5">
                {quotedProfile.photoURL ? (
                  <img src={quotedProfile.photoURL} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-zinc-800 text-[8px] flex items-center justify-center text-white">
                    {quotedProfile.name?.charAt(0) || 'U'}
                  </div>
                )}
                <span className="font-bold text-white">{quotedProfile.name}</span>
                <span className="text-gray-500">@{quotedProfile.username}</span>
              </div>
              <p className="text-gray-300 font-sans line-clamp-3 leading-relaxed">{quotedVox.text}</p>
            </div>
          )}

          {/* Attached Media Previews */}
          {mediaUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pl-15">
              {mediaUrls.map((url, idx) => (
                <div key={idx} className="relative aspect-video bg-zinc-950 rounded-xl overflow-hidden border border-white/10 group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => handleRemoveMedia(idx)}
                    className="absolute top-1.5 right-1.5 p-1 bg-black/75 hover:bg-red-600 text-white rounded-full transition-all cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Media link */}
          {showMediaInput && (
            <div className="pl-15 space-y-2 animate-fadeIn">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={mediaInput}
                  onChange={(e) => setMediaInput(e.target.value)}
                  placeholder="Cole a URL da imagem aqui..."
                  className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3.5 py-1.5 text-xs text-white focus:outline-none focus:border-white/20"
                />
                <button
                  onClick={handleAddMedia}
                  className="bg-white hover:bg-neutral-200 text-black font-semibold text-white px-3 py-1.5 rounded-xl text-[10px] font-orbitron font-bold cursor-pointer"
                >
                  ADICIONAR
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-black/40 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowMediaInput(!showMediaInput)}
              className="text-gray-400 hover:text-white transition-all cursor-pointer p-1.5 rounded-lg hover:bg-white/5"
              title="Anexar Imagem"
            >
              <Image className="w-4 h-4" />
            </button>

            {/* Visibility Settings */}
            <div className="flex items-center bg-white/5 rounded-xl px-2.5 py-1 border border-white/5 space-x-1.5">
              {visibility === 'public' ? (
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
              ) : visibility === 'followers' ? (
                <Users className="w-3.5 h-3.5 text-sky-400" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-amber-500" />
              )}
              <select
                value={visibility}
                onChange={(e: any) => setVisibility(e.target.value)}
                className="bg-transparent text-[10px] text-gray-300 font-orbitron font-bold border-none focus:ring-0 cursor-pointer pr-5 py-0"
              >
                <option value="public" className="bg-[#12111d] text-white">Público</option>
                <option value="followers" className="bg-[#12111d] text-white">Seguidores</option>
                <option value="private" className="bg-[#12111d] text-white">Privado</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Countdown Indicator */}
            {charactersLeft <= 100 && (
              <span className={`text-[10px] font-mono font-bold ${charactersLeft <= 20 ? 'text-red-500 animate-pulse' : 'text-amber-500'}`}>
                {charactersLeft}
              </span>
            )}

            <button
              onClick={handlePublish}
              disabled={isSubmitting || (!text.trim() && mediaUrls.length === 0)}
              className="bg-white hover:bg-neutral-200 text-black font-semibold disabled:opacity-50 text-white font-orbitron font-black text-xs py-2 px-5 rounded-full transition-all cursor-pointer flex items-center space-x-1.5"
            >
              {isSubmitting ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <Send className="w-3 h-3" />
                  <span>PUBLICAR VOX</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};


// Globally cache resolved user profiles to avoid redundant Firestore reads
export const userProfilesCache: { [uid: string]: { name: string; username: string; photoURL: string; verified?: boolean } } = {};

export const invalidateUserProfileCache = (userId?: string) => {
  if (userId) {
    delete userProfilesCache[userId];
    try {
      sessionStorage.removeItem(`vox_profile_${userId}`);
    } catch (e) {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vox_profile_invalidated', { detail: { userId } }));
    }
  } else {
    Object.keys(userProfilesCache).forEach(k => delete userProfilesCache[k]);
    try {
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith('vox_profile_') || k.startsWith('voxa_')) {
          sessionStorage.removeItem(k);
        }
      });
    } catch (e) {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vox_profile_invalidated', { detail: { userId: '' } }));
    }
  }
  try {
    localStorage.removeItem('lockdown_central_users_cache');
    localStorage.removeItem('lockdown_registered_users_firestore_backup');
  } catch (e) {}
};

if (typeof window !== 'undefined') {
  (window as any).invalidateUserProfileCache = invalidateUserProfileCache;
}

export function useResolvedUserProfile(userId: string, fallbackName: string, fallbackUsername: string, fallbackAvatar: string) {
  const [profile, setProfile] = useState(() => {
    if (!userId) {
      return {
        name: fallbackName,
        username: fallbackUsername === 'user' ? 'user' : fallbackUsername,
        photoURL: fallbackAvatar,
        verified: false
      };
    }

    // 1. Try memory cache first
    if (userProfilesCache[userId]) {
      return userProfilesCache[userId];
    }

    // 2. Try sessionStorage cache next
    try {
      const cached = sessionStorage.getItem(`vox_profile_${userId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        userProfilesCache[userId] = parsed;
        return parsed;
      }
    } catch (e) {}

    // Derivar um username fallback inicial decent se for "user"
    let cleanFallbackUsername = fallbackUsername;
    if (userId === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || cleanFallbackUsername === 'juniorsantti' || cleanFallbackUsername === 'juniorsantti92') {
      cleanFallbackUsername = 'jrsantti';
    } else if (userId === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1') {
      cleanFallbackUsername = 'voxa';
    } else if ((!fallbackUsername || fallbackUsername === 'user') && fallbackName) {
      cleanFallbackUsername = fallbackName.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    return {
      name: fallbackName,
      username: cleanFallbackUsername || 'user',
      photoURL: fallbackAvatar,
      verified: true
    };
  });

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;

    const fetchProfile = async (force = false) => {
      if (!force && userProfilesCache[userId]) {
        setProfile(userProfilesCache[userId]);
        return;
      }

      if (!force) {
        try {
          const cached = sessionStorage.getItem(`vox_profile_${userId}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (userId === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || parsed.username === 'juniorsantti' || parsed.username === 'juniorsantti92') {
              parsed.username = 'jrsantti';
            }
            userProfilesCache[userId] = parsed;
            setProfile(parsed);
            return;
          }
        } catch (e) {}
      }

      try {
        const userRef = doc(db, 'users', userId);
        const snap = await getDoc(userRef);
        if (snap.exists() && isMounted) {
          const data = snap.data();
          const name = data.name || data.artisticName || fallbackName;
          
          // Busca canônica no users/{uid}.username
          let resolvedUsername = data.username || data.slug;
          if (userId === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || resolvedUsername === 'juniorsantti' || resolvedUsername === 'juniorsantti92') {
            resolvedUsername = 'jrsantti';
          } else if (userId === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1') {
            resolvedUsername = 'voxa';
          }
          
          // Fallback se for vazio ou "user"
          if (!resolvedUsername || resolvedUsername === 'user') {
            resolvedUsername = fallbackUsername && fallbackUsername !== 'user' ? fallbackUsername : '';
          }
          if (!resolvedUsername || resolvedUsername === 'user') {
            resolvedUsername = name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'user';
          }

          const photoURL = data.photoURL || data.avatarUrl || data.photoUrl || fallbackAvatar;
          const verified = isVerifiedUser(data);

          const newProfile = {
            name,
            username: resolvedUsername,
            photoURL,
            verified: !!verified
          };

          userProfilesCache[userId] = newProfile;
          try {
            sessionStorage.setItem(`vox_profile_${userId}`, JSON.stringify(newProfile));
          } catch (e) {}

          setProfile(newProfile);
        } else if (isMounted) {
          let resolvedUsername = fallbackUsername && fallbackUsername !== 'user' ? fallbackUsername : '';
          if (userId === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || resolvedUsername === 'juniorsantti' || resolvedUsername === 'juniorsantti92') {
            resolvedUsername = 'jrsantti';
          } else if (userId === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1') {
            resolvedUsername = 'voxa';
          } else if (!resolvedUsername || resolvedUsername === 'user') {
            resolvedUsername = fallbackName ? fallbackName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'user';
          }
          const finalProfile = {
            name: fallbackName,
            username: resolvedUsername,
            photoURL: fallbackAvatar,
            verified: true
          };
          userProfilesCache[userId] = finalProfile;
          setProfile(finalProfile);
        }
      } catch (err) {
        console.warn(`Failed to resolve user profile for ${userId}:`, err);
      }
    };

    fetchProfile();

    const handleInvalidate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !detail.userId || detail.userId === userId) {
        fetchProfile(true);
      }
    };

    window.addEventListener('vox_profile_invalidated', handleInvalidate);

    return () => {
      isMounted = false;
      window.removeEventListener('vox_profile_invalidated', handleInvalidate);
    };
  }, [userId, fallbackName, fallbackUsername, fallbackAvatar]);

  return profile;
}


// ==========================================
// 2. VOX CARD
// ==========================================
interface VoxCardProps {
  vox: Vox;
  currentUser: any;
  onSelect: (vox: Vox) => void;
  onReplyClick: (vox: Vox) => void;
  onQuoteClick: (vox: Vox) => void;
  onShareClick: (vox: Vox) => void;
  onUpdate: () => void;
  triggerToast: (msg: string) => void;
  isAdmin: boolean;
}

export const VoxCard: React.FC<VoxCardProps> = ({
  vox, currentUser, onSelect, onReplyClick, onQuoteClick, onShareClick, onUpdate, triggerToast, isAdmin
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(vox.text);
  const [originalVox, setOriginalVox] = useState<Vox | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // If this card is a repost, fetch original VOX details
  useEffect(() => {
    if (vox.isRepost && vox.repostOf) {
      onSnapshot(doc(db, 'voxes', vox.repostOf), (snap) => {
        if (snap.exists()) {
          setOriginalVox({ id: snap.id, ...snap.data() } as Vox);
        } else {
          setOriginalVox(null);
        }
      });
    }
  }, [vox.isRepost, vox.repostOf]);

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  const likedByMe = vox.likesList?.includes(currentUser.uid) || false;
  const repostedByMe = vox.repostsList?.includes(currentUser.uid) || false;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLiking) return;
    setIsLiking(true);
    try {
      await likeVox(vox.id, currentUser.uid);
      onUpdate();
    } catch (err: any) {
      triggerToast('Erro de curtida: ' + err.message);
    } finally {
      setIsLiking(false);
    }
  };

  const handleRepost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReposting) return;
    setIsReposting(true);
    try {
      await repostVox(vox.id, currentUser.uid, currentUser);
      triggerToast(repostedByMe ? 'Repost desfeito.' : 'VOX repostado com sucesso!');
      onUpdate();
    } catch (err: any) {
      triggerToast('Erro ao repostar: ' + err.message);
    } finally {
      setIsReposting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Deseja realmente remover este VOX? Esta ação é irreversível.")) return;
    try {
      await deleteVox(vox.id, currentUser.uid, isAdmin);
      triggerToast('VOX deletado com sucesso.');
      onUpdate();
    } catch (err: any) {
      triggerToast('Erro ao deletar: ' + err.message);
    }
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    try {
      await editVox(vox.id, editText, currentUser.uid);
      setIsEditing(false);
      triggerToast('VOX editado com sucesso.');
      onUpdate();
    } catch (err: any) {
      triggerToast('Erro ao editar: ' + err.message);
    }
  };

  const handleSendReport = async () => {
    if (!reportReason) return;
    try {
      await reportVox({
        voxId: vox.id,
        reporterId: currentUser.uid,
        reporterName: currentUser.name,
        reason: reportReason,
        details: 'Denunciado na interface VOX'
      });
      setShowReportModal(false);
      setReportReason('');
      triggerToast('Denúncia enviada para moderação da VOXA.');
    } catch (err: any) {
      triggerToast('Erro ao denunciar: ' + err.message);
    }
  };

  // Human friendly relative time
  const getRelativeTime = (isoString: string) => {
    try {
      const past = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - past.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHrs / 24);

      if (diffMins < 1) return 'Agora mesmo';
      if (diffMins < 60) return `${diffMins}min`;
      if (diffHrs < 24) return `${diffHrs}h`;
      if (diffDays < 7) return `${diffDays}d`;
      return past.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  };

  // Render original or reposted card
  const renderedVox = vox.isRepost && originalVox ? originalVox : vox;

  // Dynamically resolve author profile and reposter profile
  const authorProfile = useResolvedUserProfile(
    renderedVox.authorId,
    renderedVox.authorName,
    renderedVox.authorUsername,
    renderedVox.authorAvatar
  );

  const reposterProfile = useResolvedUserProfile(
    vox.isRepost ? vox.authorId : '',
    vox.authorName,
    vox.authorUsername,
    vox.authorAvatar
  );

  if (vox.isRepost && !originalVox) {
    // Parent was deleted
    return (
      <div className="bg-[#12111d]/40 border border-white/5 p-4 rounded-2xl text-xs text-gray-500 font-sans italic">
        Esta publicação não está mais disponível.
      </div>
    );
  }

  return (
    <div 
      onClick={() => onSelect(renderedVox)}
      className="bg-[#12111d] border border-white/10 p-5 rounded-[24px] hover:border-white/20/20 transition-all text-left cursor-pointer space-y-3 relative group"
    >
      {/* Repost Header Marker */}
      {vox.isRepost && (
        <div className="flex items-center space-x-1.5 text-gray-500 text-[10px] font-orbitron font-bold pb-1 ml-11">
          <Repeat className="w-3.5 h-3.5 text-emerald-500" />
          <span>@{reposterProfile.username} repostou</span>
        </div>
      )}

      <div className="flex items-start space-x-3.5">
        {/* User avatar */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (authorProfile.username) {
              window.history.pushState(null, '', `/${authorProfile.username}`);
              window.dispatchEvent(new Event('popstate'));
            }
          }}
          className="w-11 h-11 rounded-full overflow-hidden border border-white/20 bg-zinc-800 flex items-center justify-center shrink-0 cursor-pointer hover:ring-2 hover:ring-white/40 transition-all"
        >
          {authorProfile.photoURL ? (
            <img src={authorProfile.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-orbitron font-bold text-xs">{authorProfile.name?.charAt(0).toUpperCase()}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* User info & Timestamp */}
          <div className="flex items-center justify-between">
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (authorProfile.username) {
                  window.history.pushState(null, '', `/${authorProfile.username}`);
                  window.dispatchEvent(new Event('popstate'));
                }
              }}
              className="flex items-center space-x-1.5 min-w-0 cursor-pointer group/author"
            >
              <span className="text-white font-bold font-orbitron text-xs truncate max-w-[120px] sm:max-w-none group-hover/author:underline">
                {authorProfile.name}
              </span>
              {authorProfile.verified && (
                <VerifiedBadge size="sm" />
              )}
              <span className="text-gray-500 text-[10px] truncate max-w-[80px] sm:max-w-none group-hover/author:text-gray-300">
                @{authorProfile.username}
              </span>
              <span className="text-gray-600 text-[10px]">•</span>
              <span className="text-gray-500 text-[10px] shrink-0">
                {getRelativeTime(renderedVox.createdAt)}
              </span>
              {renderedVox.editedAt && (
                <span className="text-[9px] bg-white/5 border border-white/5 px-1.5 py-0.5 text-gray-400 font-orbitron rounded-md shrink-0">
                  EDITADO
                </span>
              )}
            </div>

            {/* Actions button */}
            <div className="relative" ref={menuRef}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-all cursor-pointer"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-1 w-36 bg-[#181726] border border-white/10 rounded-xl py-1.5 shadow-2xl z-20 text-left">
                  {renderedVox.authorId === currentUser.uid ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEditing(true);
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-[10px] font-orbitron text-gray-300 hover:bg-white/5 hover:text-white"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-sky-400" />
                        <span>EDITAR VOX</span>
                      </button>

                      <button
                        onClick={handleDelete}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-[10px] font-orbitron text-red-400 hover:bg-white/5 hover:text-red-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>REMOVER</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowReportModal(true);
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-[10px] font-orbitron text-amber-400 hover:bg-white/5 hover:text-amber-300"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>DENUNCIAR</span>
                      </button>

                      {isAdmin && (
                        <button
                          onClick={handleDelete}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-[10px] font-orbitron text-red-400 hover:bg-white/5 hover:text-red-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>MODERAR (REMOVER)</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Text Content */}
          {isEditing ? (
            <div className="mt-2 space-y-2" onClick={e => e.stopPropagation()}>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                maxLength={MAX_VOX_LENGTH}
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/20"
                rows={3}
              />
              <div className="flex justify-end space-x-2">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="bg-white/5 hover:bg-white/10 text-[9px] font-orbitron font-bold py-1.5 px-3 rounded-lg"
                >
                  CANCELAR
                </button>
                <button 
                  onClick={handleSaveEdit}
                  className="bg-white hover:bg-neutral-200 text-black font-semibold text-white text-[9px] font-orbitron font-bold py-1.5 px-3 rounded-lg"
                >
                  SALVAR
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-200 text-xs sm:text-sm font-sans mt-2 leading-relaxed break-words whitespace-pre-wrap">
              {renderedVox.text}
            </p>
          )}

          {/* Media Content */}
          {renderedVox.media && renderedVox.media.length > 0 && (
            <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {renderedVox.media.map((url, idx) => (
                <div key={idx} className="aspect-video bg-zinc-950 rounded-2xl border border-white/5 overflow-hidden">
                  <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-all duration-500" />
                </div>
              ))}
            </div>
          )}

          {/* Render Quoted Reference Inside If Quote */}
          {renderedVox.quotedVoxId && (
            <VoxQuoteEmbed quotedVoxId={renderedVox.quotedVoxId} triggerToast={triggerToast} />
          )}

          {/* Interactive footer counts */}
          <div className="flex items-center justify-between text-gray-500 text-xs mt-4 pt-3 border-t border-white/5 max-w-sm">
            {/* 1. Reply Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReplyClick(renderedVox);
              }}
              className="flex items-center space-x-1.5 hover:text-white transition-all cursor-pointer p-1 rounded-lg hover:bg-white/5"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="font-mono text-[10px]">{renderedVox.replyCount || 0}</span>
            </button>

            {/* 2. Repost Options */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRepost}
                className={`flex items-center space-x-1.5 transition-all cursor-pointer p-1 rounded-lg hover:bg-white/5 ${repostedByMe ? 'text-emerald-500' : 'hover:text-emerald-400'}`}
                title="Repostar VOX"
              >
                <Repeat className="w-4 h-4" />
                <span className="font-mono text-[10px]">{renderedVox.repostCount || 0}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuoteClick(renderedVox);
                }}
                className="text-[9px] font-orbitron font-bold border border-white/10 text-gray-400 hover:text-white px-2 py-0.5 rounded-md hover:bg-white/5"
                title="Citar este VOX"
              >
                CITAR
              </button>
            </div>

            {/* 3. Like Button */}
            <button
              onClick={handleLike}
              className={`flex items-center space-x-1.5 transition-all cursor-pointer p-1 rounded-lg hover:bg-white/5 ${likedByMe ? 'text-white' : 'hover:text-white'}`}
            >
              <Heart className={`w-4 h-4 ${likedByMe ? 'fill-[#FF0033] text-white' : ''}`} />
              <span className="font-mono text-[10px]">{renderedVox.likeCount || 0}</span>
            </button>

            {/* 4. Share Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShareClick(renderedVox);
              }}
              className="flex items-center space-x-1.5 hover:text-sky-400 transition-all cursor-pointer p-1 rounded-lg hover:bg-white/5"
              title="Compartilhar VOX"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {/* Mini Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={e => e.stopPropagation()}>
          <div className="bg-[#12111d] border border-white/10 rounded-3xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-orbitron font-extrabold text-sm text-white">DENUNCIAR VOX</h3>
            <p className="text-[10px] text-gray-400 font-sans">Selecione o motivo principal para a denúncia deste conteúdo para que os moderadores possam analisar.</p>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none"
            >
              <option value="">Selecione o motivo...</option>
              <option value="spam">Spam / Links indesejados</option>
              <option value="assédio">Assédio / Bullying</option>
              <option value="discurso_de_ódio">Discurso de Ódio / Intolerância</option>
              <option value="golpe">Golpe / Fraude</option>
              <option value="conteúdo_impróprio">Conteúdo impróprio / Explícito</option>
              <option value="informação_enganosa">Informação enganosa / Fake news</option>
              <option value="outro">Outro motivo</option>
            </select>
            <div className="flex justify-end space-x-2 pt-2">
              <button 
                onClick={() => setShowReportModal(false)}
                className="bg-white/5 hover:bg-white/10 text-xs font-orbitron px-4 py-2 rounded-xl"
              >
                CANCELAR
              </button>
              <button 
                onClick={handleSendReport}
                disabled={!reportReason}
                className="bg-white hover:bg-neutral-200 text-black font-semibold disabled:opacity-50 text-white text-xs font-orbitron font-bold px-4 py-2 rounded-xl"
              >
                DENUNCIAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// ==========================================
// 2A. VOX QUOTE EMBED
// ==========================================
const VoxQuoteEmbed: React.FC<{ quotedVoxId: string; triggerToast: (msg: string) => void }> = ({ quotedVoxId, triggerToast }) => {
  const [quoted, setQuoted] = useState<Vox | null>(null);

  useEffect(() => {
    onSnapshot(doc(db, 'voxes', quotedVoxId), (snap) => {
      if (snap.exists()) {
        setQuoted({ id: snap.id, ...snap.data() } as Vox);
      } else {
        setQuoted(null);
      }
    });
  }, [quotedVoxId]);

  const authorProfile = useResolvedUserProfile(
    quoted ? quoted.authorId : '',
    quoted ? quoted.authorName : '',
    quoted ? quoted.authorUsername : '',
    quoted ? quoted.authorAvatar : ''
  );

  if (!quoted) {
    return (
      <div className="mt-2.5 bg-black/40 border border-white/5 p-3.5 rounded-2xl text-[10px] text-gray-500 font-sans italic">
        VOX citado indisponível.
      </div>
    );
  }

  return (
    <div className="mt-2.5 bg-black/40 border border-white/10 p-3.5 rounded-2xl space-y-1.5 text-xs text-left">
      <div className="flex items-center space-x-1.5">
        {authorProfile.photoURL ? (
          <img src={authorProfile.photoURL} alt="" className="w-4 h-4 rounded-full object-cover border border-white/10" />
        ) : (
          <div className="w-4 h-4 rounded-full bg-zinc-800 text-[8px] flex items-center justify-center text-white border border-white/10">
            {authorProfile.name?.charAt(0) || 'U'}
          </div>
        )}
        <span className="font-bold text-white font-orbitron text-[10px]">{authorProfile.name}</span>
        {authorProfile.verified && <VerifiedBadge size="xs" />}
        <span className="text-gray-500 text-[9px]">@{authorProfile.username}</span>
      </div>
      <p className="text-gray-300 font-sans leading-relaxed text-[11px] line-clamp-3">{quoted.text}</p>
    </div>
  );
};


// ==========================================
// 3. VOX SHARE MODAL & CANVAS CARD GENERATOR
// ==========================================
interface VoxShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  vox: Vox | null;
  triggerToast: (msg: string) => void;
}

export const VoxShareModal: React.FC<VoxShareModalProps> = ({
  isOpen, onClose, vox, triggerToast
}) => {
  const [themeStyle, setThemeStyle] = useState<'light' | 'dark'>(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });
  const [generating, setGenerating] = useState(false);

  // Dynamically resolve author profile for the share modal
  const authorProfile = useResolvedUserProfile(
    vox ? vox.authorId : '',
    vox ? vox.authorName : '',
    vox ? vox.authorUsername : '',
    vox ? vox.authorAvatar : ''
  );

  if (!isOpen || !vox) return null;

  const voxUrl = `${window.location.origin}/vox/${vox.id}`;
  const shareText = `Veja este VOX de @${authorProfile.username} na VOXA: "${vox.text.substring(0, 100)}"`;

  const copyLink = () => {
    navigator.clipboard.writeText(voxUrl);
    triggerToast('Link copiado para a área de transferência! 🔗');
  };

  const copyText = () => {
    navigator.clipboard.writeText(`"${vox.text}" — @${authorProfile.username} na VOXA: ${voxUrl}`);
    triggerToast('Conteúdo do VOX copiado! 📋');
  };

  // Modern HTML5 Canvas sharing card generator (Compact Threads-like card with ample Story background)
  const handleGenerateCard = async (format: 'story' | 'square'): Promise<Blob | null> => {
    const width = 1080;
    const height = format === 'story' ? 1920 : 1080;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const isDark = themeStyle === 'dark';

    // 1. Draw Background with subtle radial depth for Instagram Stories composition
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 120, width / 2, height / 2, Math.max(width, height) * 0.75);
    if (isDark) {
      bgGrad.addColorStop(0, '#14141A');
      bgGrad.addColorStop(1, '#07070A');
    } else {
      bgGrad.addColorStop(0, '#F5F6F8');
      bgGrad.addColorStop(1, '#E5E7EB');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Compact Central Card Container (Threads-style proportions)
    const cardW = 740;
    const cardPadding = 44;

    ctx.font = '400 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    const maxTextWidth = cardW - (cardPadding * 2);
    const lineHeight = 42;

    const paragraphs = (vox.text || '').split('\n');
    const lines: string[] = [];
    for (const para of paragraphs) {
      const words = para.split(' ');
      let line = '';
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxTextWidth && n > 0) {
          lines.push(line.trimEnd());
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line.trimEnd());
    }

    const headerHeight = 116;
    const textHeight = Math.max(1, lines.length) * lineHeight;
    const footerHeight = 76;
    const cardH = headerHeight + textHeight + footerHeight;

    const cardX = (width - cardW) / 2;
    const cardY = (height - cardH) / 2;

    // Subtle soft shadow behind the compact card
    ctx.save();
    ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.10)';
    ctx.shadowBlur = 48;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 18;

    ctx.fillStyle = isDark ? '#101014' : '#FFFFFF';
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 2;

    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    drawRoundedRect(cardX, cardY, cardW, cardH, 36);
    ctx.restore();

    // 3. Draw User Avatar
    const avatarR = 32;
    const avatarX = cardX + cardPadding + avatarR;
    const avatarY = cardY + cardPadding + avatarR;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.clip();

    const avatarImg = new window.Image();
    avatarImg.crossOrigin = 'anonymous';
    const loadAvatarPromise = new Promise<void>((resolve) => {
      avatarImg.onload = () => {
        ctx.drawImage(avatarImg, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
        resolve();
      };
      avatarImg.onerror = () => {
        const grad = ctx.createLinearGradient(avatarX - avatarR, avatarY - avatarR, avatarX + avatarR, avatarY + avatarR);
        grad.addColorStop(0, '#1D9BF0');
        grad.addColorStop(1, '#0D6EFD');
        ctx.fillStyle = grad;
        ctx.fillRect(avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(authorProfile.name?.charAt(0).toUpperCase() || 'V', avatarX, avatarY);
        resolve();
      };
      avatarImg.src = authorProfile.photoURL || 'https://via.placeholder.com/150';
    });

    await loadAvatarPromise;
    ctx.restore();

    // 4. Draw Name, Blue Verified Badge & @username
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const textX = cardX + cardPadding;
    const infoX = avatarX + avatarR + 18;
    const nameY = cardY + cardPadding + 4;

    ctx.fillStyle = isDark ? '#FFFFFF' : '#111827';
    ctx.font = '700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    ctx.fillText(authorProfile.name, infoX, nameY);

    const nameWidth = ctx.measureText(authorProfile.name).width;
    if (authorProfile.verified) {
      const badgeX = infoX + nameWidth + 16;
      const badgeY = nameY + 13;
      ctx.fillStyle = '#1D9BF0';
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(badgeX - 4.5, badgeY + 0.5);
      ctx.lineTo(badgeX - 1.2, badgeY + 3.8);
      ctx.lineTo(badgeX + 4.8, badgeY - 3.2);
      ctx.stroke();
    }

    ctx.fillStyle = isDark ? '#9CA3AF' : '#6B7280';
    ctx.font = '400 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    ctx.fillText(`@${authorProfile.username}`, infoX, nameY + 31);

    // 5. Draw VOX text lines
    let lineY = cardY + headerHeight + 8;
    ctx.fillStyle = isDark ? '#F3F4F6' : '#111827';
    ctx.font = '400 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], textX, lineY);
      lineY += lineHeight;
    }

    // 6. Discreet VOXA watermark in bottom-right of card
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(17, 24, 39, 0.28)';
    ctx.font = '800 18px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('VOXA', cardX + cardW - cardPadding, cardY + cardH - 26);

    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });
  };

  const handleShareCard = async (format: 'story' | 'square') => {
    setGenerating(true);
    try {
      const blob = await handleGenerateCard(format);
      if (!blob) {
        triggerToast('Não foi possível gerar a imagem.');
        return;
      }

      const file = new File([blob], `vox_card_${vox.id}_${format}.png`, { type: 'image/png' });
      
      // Native sharing checking support
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `@${authorProfile.username} na VOXA`,
            text: shareText,
            url: voxUrl
          });
          triggerToast('Compartilhado com sucesso!');
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            handleDownloadBlob(blob, format);
          }
        }
      } else {
        handleDownloadBlob(blob, format);
      }
    } catch (e: any) {
      console.error(e);
      triggerToast('Erro de geração do Card: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadBlob = (blob: Blob, format: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voxa_vox_${vox.id}_${format}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerToast('Imagem salva no dispositivo! Pronta para compartilhar.');
  };

  const shareWhatsApp = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + voxUrl)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#12111d] border border-white/10 w-full max-w-sm rounded-[28px] overflow-hidden flex flex-col shadow-2xl p-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center space-x-2">
            <Share2 className="w-4 h-4 text-white" />
            <span className="font-orbitron font-bold text-xs tracking-wider text-white">COMPARTILHAR VOX</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white cursor-pointer transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compact Threads-Style Story Card Preview */}
        <div className={`w-full rounded-3xl p-7 flex items-center justify-center border transition-all ${
          themeStyle === 'dark'
            ? 'bg-gradient-to-b from-[#14141A] to-[#07070A] border-white/10'
            : 'bg-gradient-to-b from-[#F5F6F8] to-[#E5E7EB] border-black/10'
        }`}>
          <div className={`w-full max-w-[260px] rounded-[22px] p-4 shadow-xl border text-left space-y-2.5 transition-all ${
            themeStyle === 'dark'
              ? 'bg-[#101014] border-white/15 text-white'
              : 'bg-white border-black/10 text-gray-900'
          }`}>
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center border border-black/10">
                {authorProfile.photoURL ? (
                  <img src={authorProfile.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-xs text-white">{authorProfile.name?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0 leading-tight">
                <div className="flex items-center space-x-1">
                  <span className="font-bold text-xs truncate">{authorProfile.name}</span>
                  {authorProfile.verified && <VerifiedBadge size="xs" />}
                </div>
                <span className={`text-[10px] block truncate ${themeStyle === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  @{authorProfile.username}
                </span>
              </div>
            </div>
            <p className={`text-xs font-sans leading-relaxed line-clamp-5 whitespace-pre-wrap ${themeStyle === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
              {vox.text}
            </p>
            <div className="pt-1 flex justify-end">
              <span className={`text-[9px] font-orbitron font-black tracking-widest uppercase ${themeStyle === 'dark' ? 'text-white/30' : 'text-gray-900/30'}`}>
                VOXA
              </span>
            </div>
          </div>
        </div>

        {/* Customizable Style Selector */}
        <div className="space-y-2.5">
          <span className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider text-left">ESTILO DO CARD</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setThemeStyle('light')}
              className={`py-2 px-3 rounded-xl font-orbitron font-bold text-[9px] border transition-all cursor-pointer ${themeStyle === 'light' ? 'bg-white text-black border-white' : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'}`}
            >
              CLARO
            </button>
            <button
              onClick={() => setThemeStyle('dark')}
              className={`py-2 px-3 rounded-xl font-orbitron font-bold text-[9px] border transition-all cursor-pointer ${themeStyle === 'dark' ? 'bg-[#FF0033] border-white/20 text-white' : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'}`}
            >
              ESCURO
            </button>
          </div>
        </div>

        {/* Generate Card Buttons */}
        <div className="space-y-2">
          <span className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider text-left">GERAR IMAGEM PREMIUM</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleShareCard('story')}
              disabled={generating}
              className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-3.5 flex flex-col items-center justify-center space-y-1 text-xs cursor-pointer transition-all disabled:opacity-50"
            >
              <span className="font-orbitron font-black text-white">STORY 9:16</span>
              <span className="text-[8px] font-orbitron text-gray-500 font-bold uppercase">Instagram / Status</span>
            </button>

            <button
              onClick={() => handleShareCard('square')}
              disabled={generating}
              className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-3.5 flex flex-col items-center justify-center space-y-1 text-xs cursor-pointer transition-all disabled:opacity-50"
            >
              <span className="font-orbitron font-black text-white">SQUARE 1:1</span>
              <span className="text-[8px] font-orbitron text-gray-500 font-bold uppercase">Feed / Feed Post</span>
            </button>
          </div>
        </div>

        {/* Social Sharing & Fallback Panel */}
        <div className="space-y-2 border-t border-white/5 pt-4">
          <span className="block text-[9px] font-orbitron text-gray-400 font-bold uppercase tracking-wider text-left">COMPARTILHAR DIRETO</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={shareWhatsApp}
              className="bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-2xl py-2.5 text-[10px] font-orbitron font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
            >
              <span>WHATSAPP</span>
            </button>

            <button
              onClick={() => {
                triggerToast('Toque em "STORY 9:16" para baixar o card e postar no Instagram!');
              }}
              className="bg-pink-600/15 border border-pink-500/30 text-pink-400 hover:bg-pink-500 hover:text-white rounded-2xl py-2.5 text-[10px] font-orbitron font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
            >
              <span>INSTAGRAM STORY</span>
            </button>
          </div>
        </div>

        {/* Copier Actions */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={copyLink}
            className="bg-white/5 hover:bg-white/10 text-white rounded-xl py-2 text-[10px] font-orbitron font-bold flex items-center justify-center space-x-1.5 cursor-pointer transition-all"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>COPIAR LINK</span>
          </button>
          <button
            onClick={copyText}
            className="bg-white/5 hover:bg-white/10 text-white rounded-xl py-2 text-[10px] font-orbitron font-bold flex items-center justify-center space-x-1.5 cursor-pointer transition-all"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>COPIAR TEXTO</span>
          </button>
        </div>

      </div>
    </div>
  );
};


// ==========================================
// 4. VOX CONVERSATION / THREAD DETAILS MODAL
// ==========================================
interface VoxConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  vox: Vox | null;
  currentUser: any;
  onReplyClick: (vox: Vox) => void;
  onQuoteClick: (vox: Vox) => void;
  onShareClick: (vox: Vox) => void;
  onUpdate: () => void;
  triggerToast: (msg: string) => void;
  isAdmin: boolean;
}

const VoxReplyItem: React.FC<{ reply: any; currentUser: any; isAdmin: boolean; triggerToast: (msg: string) => void; onUpdate: () => void }> = ({ reply, currentUser, isAdmin, triggerToast, onUpdate }) => {
  const replyProfile = useResolvedUserProfile(
    reply.authorId,
    reply.authorName,
    reply.authorUsername,
    reply.authorAvatar
  );

  return (
    <div className="bg-white/5 border border-white/5 p-4 rounded-2xl space-y-2 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          {replyProfile.photoURL ? (
            <img src={replyProfile.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-zinc-800 text-[10px] flex items-center justify-center text-white font-bold">
              {replyProfile.name?.charAt(0) || 'U'}
            </div>
          )}
          <span className="text-white font-bold font-orbitron text-[10px]">{replyProfile.name}</span>
          {replyProfile.verified && <VerifiedBadge size="xs" />}
          <span className="text-gray-500 text-[9px]">@{replyProfile.username}</span>
        </div>
        {reply.authorId === currentUser.uid && (
          <button
            onClick={async () => {
              if (window.confirm("Remover esta resposta?")) {
                await deleteVox(reply.id, currentUser.uid, isAdmin);
                triggerToast('Resposta removida.');
                onUpdate();
              }
            }}
            className="text-gray-500 hover:text-red-400 p-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <p className="text-gray-200 text-xs font-sans leading-relaxed break-words">{reply.text}</p>
    </div>
  );
};

export const VoxConversationModal: React.FC<VoxConversationModalProps> = ({
  isOpen, onClose, vox, currentUser, onReplyClick, onQuoteClick, onShareClick, onUpdate, triggerToast, isAdmin
}) => {
  const [replies, setReplies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const mainAuthorProfile = useResolvedUserProfile(
    vox ? vox.authorId : '',
    vox ? vox.authorName : '',
    vox ? vox.authorUsername : '',
    vox ? vox.authorAvatar : ''
  );

  useEffect(() => {
    if (isOpen && vox) {
      setLoading(true);
      const unsubscribe = onSnapshot(
        doc(db, 'voxes', vox.id),
        async (snap) => {
          if (snap.exists()) {
            const list = await fetchVoxReplies(vox.id);
            setReplies(list);
          }
          setLoading(false);
        }
      );
      return () => unsubscribe();
    }
  }, [isOpen, vox]);

  if (!isOpen || !vox) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-40 animate-fadeIn">
      <div className="bg-[#12111d] border border-white/10 w-full max-w-2xl rounded-[32px] overflow-hidden flex flex-col shadow-2xl h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-white" />
            <span className="font-orbitron font-bold text-xs tracking-wider text-white">DISCUSSÃO / CONVERSA</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/5 text-gray-400 hover:text-white cursor-pointer transition-all"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Scrollable conversation thread */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Main Original VOX */}
          <div className="space-y-4">
            <div className="flex items-start space-x-3.5">
              {mainAuthorProfile.photoURL ? (
                <img src={mainAuthorProfile.photoURL} alt="" className="w-11 h-11 rounded-full object-cover border border-white/10 shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-zinc-800 text-xs flex items-center justify-center text-white font-bold border border-white/10 shrink-0">
                  {mainAuthorProfile.name?.charAt(0) || 'U'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="text-white font-bold font-orbitron text-xs">{mainAuthorProfile.name}</span>
                  {mainAuthorProfile.verified && <VerifiedBadge size="sm" />}
                  <span className="text-gray-500 text-[10px]">@{mainAuthorProfile.username}</span>
                </div>
                <p className="text-white text-sm sm:text-base font-sans mt-2.5 leading-relaxed break-words whitespace-pre-wrap">{vox.text}</p>
                
                {vox.media && vox.media.length > 0 && (
                  <div className="mt-3.5 grid grid-cols-1 gap-2">
                    {vox.media.map((url, idx) => (
                      <div key={idx} className="rounded-2xl overflow-hidden border border-white/5">
                        <img src={url} alt="" className="w-full h-auto object-cover" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Main Card Actions */}
                <div className="flex items-center justify-between text-gray-500 text-xs mt-4 pt-4 border-t border-white/5 max-w-sm">
                  <button onClick={() => onReplyClick(vox)} className="flex items-center space-x-1.5 hover:text-white cursor-pointer">
                    <MessageSquare className="w-4 h-4" />
                    <span>{vox.replyCount || 0}</span>
                  </button>
                  <button onClick={() => onQuoteClick(vox)} className="flex items-center space-x-1.5 hover:text-emerald-400 cursor-pointer">
                    <Repeat className="w-4 h-4" />
                    <span>{vox.repostCount || 0}</span>
                  </button>
                  <button onClick={() => likeVox(vox.id, currentUser.uid).then(onUpdate)} className="flex items-center space-x-1.5 hover:text-white cursor-pointer">
                    <Heart className={`w-4 h-4 ${vox.likesList?.includes(currentUser.uid) ? 'fill-[#FF0033] text-white' : ''}`} />
                    <span>{vox.likeCount || 0}</span>
                  </button>
                  <button onClick={() => onShareClick(vox)} className="flex items-center space-x-1.5 hover:text-sky-400 cursor-pointer">
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Divider with replies count */}
          <div className="border-t border-white/5 pt-4 flex items-center justify-between text-[10px] font-orbitron text-gray-400 font-bold uppercase tracking-wider">
            <span>RESPOSTAS ({replies.length})</span>
            <button
              onClick={() => onReplyClick(vox)}
              className="text-white hover:underline cursor-pointer"
            >
              Responder ao VOX
            </button>
          </div>

          {/* Replies Thread List */}
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <span className="w-6 h-6 border-2 border-white/20 border-t-[#FF0033] rounded-full animate-spin"></span>
            </div>
          ) : replies.length === 0 ? (
            <p className="text-center py-8 text-xs text-gray-500 font-sans">Seja o primeiro a expressar sua voz nesta discussão!</p>
          ) : (
            <div className="space-y-4 pl-4 border-l border-white/5">
              {replies.map((reply) => (
                <VoxReplyItem 
                  key={reply.id} 
                  reply={reply} 
                  currentUser={currentUser} 
                  isAdmin={isAdmin} 
                  triggerToast={triggerToast} 
                  onUpdate={onUpdate} 
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
