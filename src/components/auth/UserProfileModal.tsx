import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Mail, Shield, X, Ticket, ShoppingBag, Music, Heart, LogOut, CheckCircle2, 
  Save, UserCheck, Trophy, Share2, Copy, Upload, Lock, MapPin, Phone, Star, Sparkles, RefreshCw
} from 'lucide-react';
import { CentralUser, PersonalData, DeliveryAddress, LeagueStatus } from '../../types';
import { fetchCentralUsers, saveCentralUser, updateCentralUserPhoto, generateSlug, generateReferralCode } from '../../utils/centralUserDb';
import { uploadFile } from '../../utils/upload';
import { requestLeagueEntry } from '../../utils/leagueDb';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { name: string; email: string; photoURL?: string } | null;
  onLogout: () => void;
  onUpdateUser: (updated: { name: string; email: string; photoURL?: string }) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogout,
  onUpdateUser
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'private_data' | 'league' | 'tickets' | 'history'>('profile');
  const [userDoc, setUserDoc] = useState<CentralUser | null>(null);
  
  // Profile form state
  const [name, setName] = useState(currentUser?.name || '');
  const [artisticName, setArtisticName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState('');
  const [photoURL, setPhotoURL] = useState(currentUser?.photoURL || '');
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);
  const [personalData, setPersonalData] = useState<PersonalData>({});
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress>({});
  const [referralCode, setReferralCode] = useState('');
  const [leagueStatus, setLeagueStatus] = useState<LeagueStatus>('NÃO PARTICIPA');
  const [leagueDivision, setLeagueDivision] = useState(10);
  const [leaguePoints, setLeaguePoints] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRequestingLeague, setIsRequestingLeague] = useState(false);

  // Load complete Central User doc
  useEffect(() => {
    if (isOpen && currentUser?.email) {
      setIsLoading(true);
      fetchCentralUsers().then(users => {
        const found = users.find(u => u.email?.toLowerCase() === currentUser.email.toLowerCase()) 
          || users.find(u => u.name?.toLowerCase() === currentUser.name.toLowerCase());
        if (found) {
          setUserDoc(found);
          setName(found.name || currentUser.name);
          setArtisticName(found.artisticName || found.name || '');
          setSlug(found.slug || generateSlug(found.name));
          setEmail(found.email || currentUser.email);
          setPhone(found.phone || '');
          setPhotoURL(found.photoURL || currentUser.photoURL || '');
          setGalleryPhotos(found.galleryPhotos || []);
          setPersonalData(found.personalData || {});
          setDeliveryAddress(found.deliveryAddress || {});
          setReferralCode(found.referralCode || generateReferralCode());
          setLeagueStatus(found.leagueStatus || 'NÃO PARTICIPA');
          setLeagueDivision(found.leagueDivision || 10);
          setLeaguePoints(found.leaguePoints || 0);
        } else {
          setName(currentUser.name);
          setEmail(currentUser.email);
          setSlug(generateSlug(currentUser.name));
          setReferralCode(generateReferralCode());
        }
      }).finally(() => setIsLoading(false));
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg('');
    try {
      const id = userDoc?.id || userDoc?.uid || `user_${Date.now()}`;
      const updated: CentralUser = {
        ...(userDoc || {}),
        id,
        uid: id,
        name: name.trim(),
        artisticName: artisticName.trim() || name.trim(),
        slug: slug.trim() || generateSlug(name),
        email: email.trim(),
        phone: phone.trim(),
        photoURL,
        galleryPhotos,
        personalData,
        deliveryAddress,
        referralCode: referralCode || generateReferralCode(),
        leagueStatus,
        leagueDivision,
        leaguePoints,
        role: userDoc?.role || 'USUÁRIO COMUM',
        status: userDoc?.status || 'Ativo',
        accountStatus: 'CONTA_ATIVA',
        hasAuth: true,
        updatedAt: new Date().toISOString()
      };

      await saveCentralUser(updated);
      setUserDoc(updated);
      onUpdateUser({ name: updated.name, email: updated.email, photoURL: updated.photoURL });
      setSuccessMsg('Perfil atualizado com sucesso!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isGallery = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const res = await uploadFile(file, 'user');
      if (res?.url) {
        if (isGallery) {
          if (galleryPhotos.length >= 4) {
            setErrorMsg('Limite máximo de 4 fotos secundárias atingido.');
            return;
          }
          setGalleryPhotos(prev => [...prev, res.url]);
        } else {
          setPhotoURL(res.url);
        }
      }
    } catch (err) {
      setErrorMsg('Falha ao enviar foto.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSetMainPhoto = (url: string) => {
    const oldMain = photoURL;
    const newGallery = galleryPhotos.filter(p => p !== url);
    if (oldMain) newGallery.push(oldMain);
    setPhotoURL(url);
    setGalleryPhotos(newGallery.slice(0, 4));
  };

  const handleRemoveGalleryPhoto = (url: string) => {
    setGalleryPhotos(prev => prev.filter(p => p !== url));
  };

  const handleJoinLeagueRequest = async () => {
    if (!currentUser) return;
    setIsRequestingLeague(true);
    try {
      const id = userDoc?.id || userDoc?.uid || `user_${Date.now()}`;
      const userObj: CentralUser = {
        ...(userDoc || {}),
        id,
        uid: id,
        name,
        artisticName: artisticName || name,
        photoURL,
        email,
        role: userDoc?.role || 'USUÁRIO COMUM',
        status: 'Ativo',
        accountStatus: 'CONTA_ATIVA',
        leagueStatus: 'PENDENTE',
        leagueDivision: 10,
        leaguePoints: 0
      };

      await requestLeagueEntry(userObj);
      setLeagueStatus('PENDENTE');
      setSuccessMsg('Solicitação de entrada na League enviada com sucesso! Aguarde aprovação.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao solicitar entrada na League.');
    } finally {
      setIsRequestingLeague(false);
    }
  };

  const activityHistory = [
    { id: '1', type: 'streaming', title: 'Ouviu "Lockdown Freestyle" (Prod. Cyber)', date: 'Hoje, 18:30', icon: Music },
    { id: '2', type: 'ticket', title: 'Ingressos Adquiridos: Tour SP 2026 (Pista Premium)', date: 'Ontem, 14:15', icon: Ticket },
    { id: '3', type: 'store', title: 'Compra na Loja: Moletom Oficial Lockdown', date: '3 dias atrás', icon: ShoppingBag },
    { id: '4', type: 'streaming', title: 'Adicionou "Coração de Aço" aos favoritos', date: '5 dias atrás', icon: Heart },
  ];

  const myTickets = [
    { id: 't-1', event: 'LOCKDOWN TOUR 2026 - SÃO PAULO', venue: 'Vip Club SP', date: '15 de Setembro, 22h', sector: 'Pista Premium (Setor A)', code: 'LK-99482-SP' },
    { id: 't-2', event: 'FESTIVAL RUA & SANGUE', venue: 'Circo Voador RJ', date: '28 de Outubro, 21h', sector: 'Camarote Backstage', code: 'LK-11029-RJ' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-card max-w-2xl w-full p-6 md:p-8 rounded-3xl border-2 border-[#FF0033] shadow-2xl relative overflow-hidden bg-black/95 max-h-[90vh] flex flex-col"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF0033]/10 rounded-bl-full pointer-events-none"></div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-2 cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-4 pb-4 border-b border-white/10">
          {photoURL ? (
            <img
              src={photoURL}
              alt=""
              className="w-14 h-14 rounded-2xl object-cover border-2 border-[#FF0033] glow-red shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-[#FF0033]/20 border border-[#FF0033] flex items-center justify-center text-[#FF0033] glow-red shrink-0">
              <User className="w-7 h-7" />
            </div>
          )}
          <div className="min-w-0">
            <span className="font-orbitron text-[10px] text-[#FF0033] tracking-widest block">PERFIL VOXA</span>
            <h2 className="font-orbitron font-black text-xl text-white truncate">{name || 'Meu Perfil'}</h2>
            <div className="flex items-center space-x-2 text-xs text-gray-400 font-mono">
              <span>{email}</span>
              <span>•</span>
              <span className="text-[#FF0033]">/u/{slug || generateSlug(name)}</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 pt-4 pb-3 border-b border-white/10 overflow-x-auto">
          {[
            { id: 'profile', label: '1. MEU PERFIL & FOTOS' },
            { id: 'private_data', label: '2. DADOS & ENTREGA' },
            { id: 'league', label: '3. LEAGUE & AFILIAÇÃO' },
            { id: 'tickets', label: '4. INGRESSOS' },
            { id: 'history', label: '5. HISTÓRICO' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 rounded-xl text-[11px] font-orbitron transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#FF0033] text-black font-bold glow-red'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="py-4 flex-1 overflow-y-auto space-y-4">
          {successMsg && (
            <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 p-3 rounded-xl text-xs font-orbitron flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-950/80 border border-red-500/50 text-red-300 p-3 rounded-xl text-xs font-orbitron flex items-center space-x-2">
              <X className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: PROFILE & PHOTOS */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="bg-white/5 border border-white/5 p-3 rounded-xl text-[10px] text-gray-400 font-sans leading-relaxed flex items-center space-x-2">
                <span className="text-sm">💡</span>
                <span>
                  <strong className="text-gray-300">Contas Oficiais VOXA:</strong> Toda nova conta do VOXA começa seguindo os perfis oficiais para atualizações automáticas de novidades. Você pode deixar de seguir a qualquer momento.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-orbitron text-gray-300 mb-1">NOME PRINCIPAL *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-[#FF0033] focus:outline-none font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-orbitron text-gray-300 mb-1">NOME ARTÍSTICO</label>
                  <input
                    type="text"
                    value={artisticName}
                    onChange={(e) => setArtisticName(e.target.value)}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-orbitron text-gray-300 mb-1">SLUG PÚBLICO (/u/slug)</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(generateSlug(e.target.value))}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-[#FF0033] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-orbitron text-gray-300 mb-1">WHATSAPP / CONTATO</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                  />
                </div>
              </div>

              {/* Photo Manager */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-orbitron text-xs text-white font-bold block">FOTOS DO SEU PERFIL</span>
                    <span className="text-[10px] text-gray-400 font-sans">1 foto principal + até 4 fotos secundárias (máx 5)</span>
                  </div>
                  <label className="bg-[#FF0033] hover:bg-red-700 text-black font-orbitron font-bold text-[10px] px-3 py-1.5 rounded-xl cursor-pointer flex items-center space-x-1 shadow glow-red">
                    <Upload className="w-3 h-3" />
                    <span>ENVIAR FOTO</span>
                    <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, !!photoURL)} className="hidden" />
                  </label>
                </div>

                <div className="flex items-center gap-3 overflow-x-auto pb-1">
                  {/* Main Photo */}
                  <div className="relative text-center shrink-0">
                    {photoURL ? (
                      <div className="relative group">
                        <img src={photoURL} alt="" className="w-16 h-16 rounded-xl object-cover border-2 border-[#FF0033]" referrerPolicy="no-referrer" />
                        <span className="absolute bottom-0 inset-x-0 bg-[#FF0033] text-black text-[8px] font-orbitron font-bold py-0.5 rounded-b-xl">
                          PRINCIPAL
                        </span>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-white/5 border border-dashed border-white/20 flex items-center justify-center text-gray-500">
                        <User className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  {/* Secondary Photos */}
                  {galleryPhotos.map((photo, idx) => (
                    <div key={idx} className="relative group shrink-0">
                      <img src={photo} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/20" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex flex-col items-center justify-center gap-1 p-1">
                        <button
                          type="button"
                          onClick={() => handleSetMainPhoto(photo)}
                          className="bg-emerald-500 text-black text-[8px] font-orbitron font-bold px-1 py-0.5 rounded w-full"
                        >
                          PRINCIPAL
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveGalleryPhoto(photo)}
                          className="bg-red-600 text-white text-[8px] font-orbitron font-bold px-1 py-0.5 rounded w-full"
                        >
                          EXCLUIR
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onLogout}
                  className="bg-red-950/60 hover:bg-red-900 border border-red-600/50 text-red-300 px-4 py-2.5 rounded-xl text-xs font-orbitron flex items-center space-x-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>SAIR DA CONTA</span>
                </button>

                <button
                  type="submit"
                  disabled={isSaving || isUploadingPhoto}
                  className="bg-[#FF0033] hover:bg-[#d6002b] text-black font-orbitron font-bold px-6 py-2.5 rounded-xl text-xs flex items-center space-x-2 glow-red transition-all cursor-pointer"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>SALVAR PERFIL</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: PRIVATE DATA & DELIVERY */}
          {activeTab === 'private_data' && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="bg-amber-950/40 p-3 rounded-xl border border-amber-500/30 text-amber-300 text-xs flex items-center space-x-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Dados confidenciais para emissão de notas, contratos e entrega de produtos.</span>
              </div>

              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
                <span className="font-orbitron text-xs text-white font-bold block">DADOS PESSOAIS</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-orbitron text-gray-400 mb-1">NOME COMPLETO (CIVIL)</label>
                    <input
                      type="text"
                      value={personalData.fullName || ''}
                      onChange={e => setPersonalData(prev => ({ ...prev, fullName: e.target.value }))}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-orbitron text-gray-400 mb-1">CPF</label>
                    <input
                      type="text"
                      value={personalData.cpf || ''}
                      onChange={e => setPersonalData(prev => ({ ...prev, cpf: e.target.value }))}
                      placeholder="000.000.000-00"
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-orbitron text-gray-400 mb-1">RG</label>
                    <input
                      type="text"
                      value={personalData.rg || ''}
                      onChange={e => setPersonalData(prev => ({ ...prev, rg: e.target.value }))}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-orbitron text-gray-400 mb-1">TELEFONE PESSOAL</label>
                    <input
                      type="text"
                      value={personalData.phone || ''}
                      onChange={e => setPersonalData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
                <span className="font-orbitron text-xs text-white font-bold block">ENDEREÇO DE ENTREGA (LOJA / MERCH)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-orbitron text-gray-400 mb-1">DESTINATÁRIO</label>
                    <input
                      type="text"
                      value={deliveryAddress.recipientName || ''}
                      onChange={e => setDeliveryAddress(prev => ({ ...prev, recipientName: e.target.value }))}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-orbitron text-gray-400 mb-1">CEP</label>
                    <input
                      type="text"
                      value={deliveryAddress.cep || ''}
                      onChange={e => setDeliveryAddress(prev => ({ ...prev, cep: e.target.value }))}
                      placeholder="00000-000"
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-orbitron text-gray-400 mb-1">RUA / AVENIDA</label>
                    <input
                      type="text"
                      value={deliveryAddress.street || ''}
                      onChange={e => setDeliveryAddress(prev => ({ ...prev, street: e.target.value }))}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-orbitron text-gray-400 mb-1">NÚMERO</label>
                    <input
                      type="text"
                      value={deliveryAddress.number || ''}
                      onChange={e => setDeliveryAddress(prev => ({ ...prev, number: e.target.value }))}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-orbitron text-gray-400 mb-1">COMPLEMENTO</label>
                    <input
                      type="text"
                      value={deliveryAddress.complement || ''}
                      onChange={e => setDeliveryAddress(prev => ({ ...prev, complement: e.target.value }))}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-orbitron text-gray-400 mb-1">CIDADE</label>
                    <input
                      type="text"
                      value={deliveryAddress.city || ''}
                      onChange={e => setDeliveryAddress(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-orbitron text-gray-400 mb-1">ESTADO (UF)</label>
                    <input
                      type="text"
                      value={deliveryAddress.state || ''}
                      onChange={e => setDeliveryAddress(prev => ({ ...prev, state: e.target.value }))}
                      maxLength={2}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[#FF0033] hover:bg-[#d6002b] text-black font-orbitron font-bold px-6 py-2.5 rounded-xl text-xs flex items-center space-x-2 glow-red transition-all cursor-pointer"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>SALVAR DADOS PRIVADOS</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: LEAGUE & AFFILIATION */}
          {activeTab === 'league' && (
            <div className="space-y-4">
              {/* Referral Link Card */}
              <div className="bg-emerald-950/40 p-4 rounded-2xl border border-emerald-500/40 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-orbitron text-xs font-bold">
                  <Share2 className="w-4 h-4" />
                  <span>SEU LINK DE INDICAÇÃO (AFILIAÇÃO)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/u/${slug || generateSlug(name)}?ref=${referralCode}`}
                    className="bg-black/60 border border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono w-full"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/u/${slug || generateSlug(name)}?ref=${referralCode}`);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl cursor-pointer shrink-0"
                    title="Copiar Link"
                  >
                    {copiedLink ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Acesse meu perfil na VOXA e ganhe pontos na League: ${window.location.origin}/u/${slug || generateSlug(name)}?ref=${referralCode}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-[#25D366] text-white p-2.5 rounded-xl cursor-pointer shrink-0"
                    title="Compartilhar no WhatsApp"
                  >
                    <Share2 className="w-4 h-4" />
                  </a>
                </div>
                <span className="text-[10px] text-gray-400 block font-sans">
                  Compartilhe seu link exclusivo. Novos cadastros usando seu link acumulam pontos para subir na League!
                </span>
              </div>

              {/* League Rank Status */}
              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <span className="font-orbitron text-sm font-bold text-white">SITUAÇÃO NA LEAGUE</span>
                  </div>
                  <span className="font-orbitron font-bold text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {leagueStatus}
                  </span>
                </div>

                {leagueStatus === 'ATIVO' ? (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-black/60 p-3 rounded-xl border border-white/10 text-center">
                      <span className="text-[10px] font-orbitron text-gray-400 block">SUA DIVISÃO ATUAL</span>
                      <span className="text-xl font-orbitron font-black text-amber-400">
                        {leagueDivision === 1 ? '1ª DIVISÃO (ELITE)' : `${leagueDivision}ª DIVISÃO`}
                      </span>
                    </div>
                    <div className="bg-black/60 p-3 rounded-xl border border-white/10 text-center">
                      <span className="text-[10px] font-orbitron text-gray-400 block">PONTOS ACUMULADOS</span>
                      <span className="text-xl font-orbitron font-black text-[#FF0033]">{leaguePoints} PTS</span>
                    </div>
                  </div>
                ) : leagueStatus === 'PENDENTE' ? (
                  <div className="bg-amber-950/30 p-3.5 rounded-xl border border-amber-500/30 text-xs text-amber-300 font-sans">
                    Sua solicitação de entrada na <strong>10ª Divisão</strong> está sendo analisada pela nossa equipe. Em breve seu perfil estará ativo na tabela de classificação!
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <p className="text-xs text-gray-300 font-sans">
                      Você ainda não está competindo na League da VOXA. Ao entrar, você começa na <strong>10ª Divisão com 0 pontos</strong> e pode subir de divisão conforme acumula pontos por lançamentos, indicações e engajamento.
                    </p>
                    <button
                      type="button"
                      onClick={handleJoinLeagueRequest}
                      disabled={isRequestingLeague}
                      className="bg-amber-500 hover:bg-amber-600 text-black font-orbitron font-bold text-xs px-5 py-3 rounded-xl w-full flex items-center justify-center space-x-2 shadow cursor-pointer"
                    >
                      {isRequestingLeague ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
                      <span>ENTRAR NA LEAGUE (INICIAR NA 10ª DIVISÃO)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: TICKETS */}
          {activeTab === 'tickets' && (
            <div className="space-y-4">
              <span className="font-orbitron text-xs text-gray-400 block mb-2">SEUS INGRESSOS GARANTIDOS PARA OS SHOWS</span>
              {myTickets.map(ticket => (
                <div key={ticket.id} className="p-5 rounded-2xl bg-gradient-to-r from-black via-zinc-900 to-black border-2 border-[#FF0033]/60 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#FF0033]/10 rounded-bl-full pointer-events-none"></div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-orbitron text-[10px] text-[#FF0033] tracking-widest">{ticket.venue}</span>
                    <span className="font-orbitron text-xs text-white bg-[#FF0033] px-3 py-0.5 rounded-full font-black text-black">CONFIRMADO</span>
                  </div>
                  <h3 className="font-orbitron font-black text-lg text-white mb-1">{ticket.event}</h3>
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/10 text-xs">
                    <div>
                      <span className="text-gray-400 block font-orbitron text-[10px]">DATA / HORA</span>
                      <span className="text-white font-medium">{ticket.date}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-orbitron text-[10px]">SETOR</span>
                      <span className="text-white font-medium">{ticket.sector}</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-2 flex items-center justify-between text-[11px] text-gray-400 font-mono">
                    <span>CÓDIGO: {ticket.code}</span>
                    <span className="text-[#FF0033] font-orbitron cursor-pointer hover:underline">BAIXAR QR CODE</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <span className="font-orbitron text-xs text-gray-400 block mb-2">REGISTRO DE SUAS INTERAÇÕES RECENTES NO SISTEMA</span>
              {activityHistory.map((item) => {
                const IconComp = item.icon;
                return (
                  <div key={item.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-[#FF0033]/20 border border-[#FF0033]/40 flex items-center justify-center text-[#FF0033]">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-orbitron font-bold text-sm text-white">{item.title}</h4>
                        <span className="text-[11px] text-gray-400 font-sans">{item.date}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-orbitron text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-2.5 py-1 rounded-full">CONCLUÍDO</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
