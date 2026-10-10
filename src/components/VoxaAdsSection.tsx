import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Megaphone, 
  BarChart2, 
  Eye, 
  MousePointerClick, 
  DollarSign, 
  AlertTriangle, 
  X, 
  ArrowRight, 
  Image as ImageIcon 
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  serverTimestamp, 
  updateDoc 
} from 'firebase/firestore';
import { uploadFile } from '../utils/upload';
import { formatBRL } from '../utils/money';

interface VoxaAdsSectionProps {
  currentUser: any;
  triggerToast: (msg: string) => void;
  walletBalance: number;
  onRefreshWallet: () => void;
}

export function VoxaAdsSection({ currentUser, triggerToast, walletBalance, onRefreshWallet }: VoxaAdsSectionProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create'>('dashboard');
  
  // Create Campaign Multi-step Form
  const [formStep, setFormStep] = useState<number>(1);
  const [objective, setObjective] = useState<string>('visitas_perfil');
  const [mediaType, setMediaType] = useState<'image' | 'carousel' | 'video' | 'youtube'>('image');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [carouselUrls, setCarouselUrls] = useState<string[]>([]);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [ctaText, setCtaText] = useState<string>('Saiba Mais');
  const [ctaLink, setCtaLink] = useState<string>('');
  const [durationDays, setDurationDays] = useState<number>(3); // Default 3 days
  const [placements, setPlacements] = useState<string[]>(['Feed']);
  
  // Config & Prices
  const [adPrices, setAdPrices] = useState<Record<string, number>>({
    "1": 15,    // 24h = R$15
    "3": 40,    // 3d = R$40
    "7": 85,    // 7d = R$85
    "15": 160,  // 15d = R$160
    "30": 300   // 30d = R$300
  });

  // User Campaigns list
  const [myCampaigns, setMyCampaigns] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  useEffect(() => {
    loadAdPricesAndConfig();
    loadMyCampaigns();
  }, [currentUser]);

  const loadAdPricesAndConfig = async () => {
    try {
      const snap = await getDoc(doc(db, 'ad_config', 'settings'));
      if (snap.exists()) {
        const data = snap.data();
        if (data.prices) {
          setAdPrices(data.prices);
        }
      }
    } catch (e) {
      console.warn("Failed to load ad pricing configs:", e);
    }
  };

  const loadMyCampaigns = async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'ad_campaigns'), where('userId', '==', currentUser.uid));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      setMyCampaigns(list);
    } catch (e) {
      console.warn("Failed to load user campaigns:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadFile(file, 'product', (prog) => {
        setUploadProgress(Math.round(prog.percentage));
      });
      if (mediaType === 'carousel') {
        setCarouselUrls(prev => [...prev, result.url]);
      } else {
        setMediaUrl(result.url);
      }
      triggerToast("Arquivo de mídia enviado com sucesso!");
    } catch (err: any) {
      alert("Erro no upload: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const togglePlacement = (place: string) => {
    if (placements.includes(place)) {
      if (placements.length <= 1) return;
      setPlacements(prev => prev.filter(p => p !== place));
    } else {
      setPlacements(prev => [...prev, place]);
    }
  };

  const calculateTotalCost = () => {
    const basePrice = adPrices[String(durationDays)] || 40;
    const placementMultiplier = 1 + (placements.length - 1) * 0.1;
    return Number((basePrice * placementMultiplier).toFixed(2));
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) return;

    const cost = calculateTotalCost();
    const finalMediaUrl = mediaType === 'carousel' ? carouselUrls[0] : mediaType === 'youtube' ? youtubeUrl.trim() : mediaUrl;

    if (!finalMediaUrl && mediaType !== 'video') {
      alert("Por favor, envie uma imagem, vídeo ou URL do YouTube para o anúncio.");
      return;
    }

    try {
      const campaignData = {
        userId: currentUser.uid,
        userName: currentUser.name || 'Usuário VOXA',
        objective,
        mediaType,
        mediaUrl: finalMediaUrl || '',
        carouselUrls: mediaType === 'carousel' ? carouselUrls : [],
        title: title.trim(),
        description: description.trim(),
        ctaText,
        ctaLink: ctaLink.trim() || `https://links.voxa.com/${currentUser.slug || currentUser.uid}`,
        durationDays,
        placements,
        cost,
        status: 'draft',
        impressionsCount: 0,
        clicksCount: 0,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'ad_campaigns'), campaignData);
      triggerToast("Rascunho de anúncio criado com sucesso!");
      
      setMyCampaigns(prev => [{ id: docRef.id, ...campaignData }, ...prev]);
      setActiveTab('dashboard');
      resetForm();
    } catch (err: any) {
      alert("Erro ao criar anúncio: " + err.message);
    }
  };

  const handlePayCampaign = async (campaignId: string, cost: number) => {
    if (walletBalance < cost) {
      alert(`Saldo insuficiente. Custo da campanha: ${formatBRL(cost)}. Seu saldo: ${formatBRL(walletBalance)}.`);
      return;
    }

    if (!window.confirm(`Deseja pagar ${formatBRL(cost)} com seu saldo para veicular o anúncio?`)) return;

    try {
      const walletRef = doc(db, 'wallets', currentUser.uid);
      const newBalance = walletBalance - cost;
      await setDoc(walletRef, { balance: newBalance }, { merge: true });

      const txRef = collection(db, 'wallet_transactions');
      await addDoc(txRef, {
        userId: currentUser.uid,
        type: 'Débito (Anúncio VOXA Ads)',
        amount: -cost,
        status: 'Concluído',
        description: `Pagamento de campanha: ID ${campaignId}`,
        timestamp: serverTimestamp()
      });

      await updateDoc(doc(db, 'ad_campaigns', campaignId), {
        status: 'pending_review'
      });

      triggerToast("Anúncio pago com sucesso e enviado para revisão!");
      onRefreshWallet();
      await loadMyCampaigns();
    } catch (e: any) {
      alert("Erro ao debitar pagamento: " + e.message);
    }
  };

  const resetForm = () => {
    setFormStep(1);
    setObjective('visitas_perfil');
    setMediaType('image');
    setMediaUrl('');
    setCarouselUrls([]);
    setTitle('');
    setDescription('');
    setCtaText('Saiba Mais');
    setCtaLink('');
    setDurationDays(3);
    setPlacements(['Feed']);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-black">
        <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-orbitron text-gray-500 uppercase tracking-widest">Carregando VOXA Ads...</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">Ativo</span>;
      case 'pending_review':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">Em Revisão</span>;
      case 'draft':
        return <span className="bg-neutral-100 text-neutral-700 border border-neutral-300 text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">Aguardando Pagamento</span>;
      case 'approved':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black font-bold">Aprovado</span>;
      case 'rejected':
        return <span className="bg-red-50 text-red-700 border border-red-200 text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">Rejeitado</span>;
      case 'completed':
        return <span className="bg-neutral-100 text-zinc-600 border border-[#E5E5E5] text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">Finalizado</span>;
      default:
        return <span className="bg-gray-100 text-gray-600 border border-gray-200 text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 text-black">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white border border-[#E5E5E5] p-6 rounded-3xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 text-[#FF0033] rounded-full flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h2 className="text-2xl font-orbitron font-black text-[#171717] uppercase tracking-wider">VOXA Ads</h2>
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Divulgação de Anúncios na Rede</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <span className="text-[9px] text-gray-500 block uppercase font-mono tracking-wider font-bold">SALDO DISPONÍVEL</span>
            <span className="text-sm font-black text-emerald-600 font-mono">{formatBRL(walletBalance)}</span>
          </div>
          <button
            onClick={() => {
              resetForm();
              setActiveTab(activeTab === 'dashboard' ? 'create' : 'dashboard');
            }}
            className="bg-[#171717] hover:bg-black text-white font-orbitron font-black text-xs py-2.5 px-5 rounded-xl transition-all tracking-wider flex items-center gap-2 cursor-pointer uppercase shadow-xs"
          >
            {activeTab === 'dashboard' ? (
              <>
                <Plus className="w-4 h-4" />
                Criar Anúncio
              </>
            ) : (
              <>
                <BarChart2 className="w-4 h-4" />
                Seu Painel
              </>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        // --- MULTI-STEP CREATION FORM (LIGHT THEME) ---
        <div className="max-w-3xl mx-auto bg-white border border-[#E5E5E5] rounded-3xl overflow-hidden shadow-xs grid grid-cols-1 md:grid-cols-12 text-black">
          {/* Progress Left Step column */}
          <div className="md:col-span-4 bg-[#FAFAFA] border-r border-[#E5E5E5] p-6 flex flex-col justify-between">
            <div className="space-y-6 text-left">
              <span className="text-[10px] font-orbitron font-black text-[#171717] uppercase tracking-widest block">ETAPAS DO ANÚNCIO</span>
              
              <div className="space-y-4">
                {[
                  { step: 1, name: "Objetivo" },
                  { step: 2, name: "Mídia & Upload" },
                  { step: 3, name: "Texto & Conteúdo" },
                  { step: 4, name: "Duração & Local" },
                  { step: 5, name: "Preço & Resumo" }
                ].map(s => (
                  <div key={s.step} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] font-bold ${
                      formStep === s.step 
                        ? 'bg-black text-white' 
                        : formStep > s.step 
                          ? 'bg-gray-100 text-gray-500 border border-[#E5E5E5]' 
                          : 'bg-white text-gray-400 border border-[#E5E5E5]'
                    }`}>
                      {s.step}
                    </div>
                    <span className={`text-[11px] font-orbitron font-bold uppercase ${formStep === s.step ? 'text-[#171717]' : 'text-gray-400'}`}>{s.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-8 border-t border-[#E5E5E5] text-left">
              <span className="text-[9px] text-gray-500 block uppercase font-mono tracking-wider font-bold">Investimento Estimado</span>
              <span className="text-xl font-black text-emerald-600 font-mono">{formatBRL(calculateTotalCost())}</span>
            </div>
          </div>

          {/* Form Fields Right column */}
          <div className="md:col-span-8 p-8 text-left space-y-6 bg-white">
            <form onSubmit={handleCreateCampaign} className="space-y-6">
              {/* STEP 1: OBJECTIVE */}
              {formStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-orbitron font-black text-black uppercase tracking-wider">Qual seu objetivo principal?</h3>
                    <p className="text-xs text-gray-500 font-sans">Selecione o objetivo ideal para otimizar a veiculação.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'visitas_perfil', label: 'Visitas ao Perfil', desc: 'Atraia potenciais novos seguidores' },
                      { id: 'vender_produto', label: 'Vender na Store', desc: 'Promova itens e ofertas do e-commerce' },
                      { id: 'divulgar_evento', label: 'Promover Eventos', desc: 'Aumente o público de seus tickets' },
                      { id: 'receber_mensagens', label: 'Mensagens Diretas', desc: 'Inicie diálogos na rede' },
                      { id: 'divulgar_servico', label: 'Divulgar Serviços', desc: 'Promova consultorias ou assessorias' },
                      { id: 'alcance', label: 'Visibilidade Ampla', desc: 'Maximize as visualizações de imagem' }
                    ].map(obj => (
                      <button
                        key={obj.id}
                        type="button"
                        onClick={() => setObjective(obj.id)}
                        className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
                          objective === obj.id 
                            ? 'bg-neutral-50 border-black text-black font-bold' 
                            : 'bg-white border-[#E5E5E5] text-gray-700 hover:border-black'
                        }`}
                      >
                        <h4 className="text-xs font-orbitron font-bold uppercase">{obj.label}</h4>
                        <p className="text-[10px] text-gray-500 font-sans mt-1 leading-normal">{obj.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 2: MEDIA TYPE & UPLOAD */}
              {formStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-orbitron font-black text-black uppercase tracking-wider">Mídia do Anúncio</h3>
                    <p className="text-xs text-gray-500 font-sans">Envie a imagem ou material promocional de exibição.</p>
                  </div>

                  <div className="flex flex-wrap gap-3 border-b border-[#E5E5E5] pb-4">
                    {['image', 'carousel', 'video', 'youtube'].map(format => (
                      <button
                        key={format}
                        type="button"
                        onClick={() => {
                          setMediaType(format as any);
                          setMediaUrl('');
                          setYoutubeUrl('');
                          setCarouselUrls([]);
                        }}
                        className={`text-[10px] font-orbitron font-bold px-4 py-2 rounded-xl border transition-all uppercase cursor-pointer ${
                          mediaType === format 
                            ? 'bg-black text-white border-black' 
                            : 'bg-white text-gray-600 border-[#E5E5E5] hover:border-black'
                        }`}
                      >
                        {format === 'image' ? 'Imagem / GIF' : format === 'carousel' ? 'Carrossel' : format === 'video' ? 'Vídeo MP4' : 'YouTube'}
                      </button>
                    ))}
                  </div>

                  {/* Upload Card Box or YouTube Input */}
                  {mediaType === 'youtube' ? (
                    <div className="space-y-2">
                      <label className="block text-[10px] font-orbitron font-bold text-gray-700 uppercase">URL do Vídeo no YouTube</label>
                      <input
                        type="url"
                        value={youtubeUrl}
                        onChange={(e) => {
                          setYoutubeUrl(e.target.value);
                          setMediaUrl(e.target.value);
                        }}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl px-3.5 py-2.5 text-black font-sans focus:border-black outline-none text-xs"
                      />
                    </div>
                  ) : (
                  <div className="space-y-3">
                    <div className="border-2 border-dashed border-[#E5E5E5] hover:border-black rounded-2xl p-8 flex flex-col items-center justify-center bg-[#FAFAFA] text-center transition-all">
                      {isUploading ? (
                        <div className="space-y-2">
                          <div className="w-8 h-8 border-3 border-black border-t-transparent rounded-full animate-spin mx-auto"></div>
                          <span className="text-xs font-mono text-gray-500">Enviando... {uploadProgress}%</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <ImageIcon className="w-10 h-10 text-gray-400 mx-auto" />
                          <div className="space-y-1">
                            <span className="text-xs text-black font-bold block">Escolha uma mídia do anúncio</span>
                            <span className="text-[10px] text-gray-500 block">Arquivos aceitos: PNG, JPG, WEBP, GIF ou MP4 (Até 25MB)</span>
                          </div>
                          <label className="cursor-pointer bg-black hover:bg-neutral-800 text-white font-orbitron font-black text-[10px] py-2 px-4 rounded-xl inline-block mt-2 transition-all">
                            SELECIONAR ARQUIVO
                            <input 
                              type="file" 
                              accept={mediaType === 'video' ? 'video/mp4,video/*' : 'image/jpeg,image/png,image/webp,image/gif'} 
                              onChange={handleMediaUpload} 
                              className="hidden" 
                            />
                          </label>
                        </div>
                      )}
                    </div>

                    {mediaType !== 'carousel' && mediaUrl && (
                      <div className="bg-[#FAFAFA] border border-[#E5E5E5] p-3 rounded-xl flex items-center justify-between">
                        <span className="text-[10px] font-mono text-emerald-600 font-bold">✓ Upload concluído com sucesso</span>
                        <a href={mediaUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[#171717] hover:underline font-mono font-bold">Ver Mídia</a>
                      </div>
                    )}

                    {mediaType === 'carousel' && carouselUrls.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono text-gray-500 block uppercase font-bold">Carrossel de Imagens ({carouselUrls.length})</span>
                        <div className="flex gap-2 overflow-x-auto py-1">
                          {carouselUrls.map((url, idx) => (
                            <div key={idx} className="w-14 h-14 rounded-lg overflow-hidden bg-gray-50 shrink-0 border border-[#E5E5E5] relative">
                              <img src={url} alt="" className="w-full h-full object-cover" />
                              <button 
                                type="button" 
                                onClick={() => setCarouselUrls(prev => prev.filter((_, i) => i !== idx))}
                                className="absolute top-0.5 right-0.5 bg-black text-white rounded-full p-0.5 hover:bg-red-600 transition-all cursor-pointer"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              )}

              {/* STEP 3: CONTENT & TEXTS */}
              {formStep === 3 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-orbitron font-black text-black uppercase tracking-wider">Cópia do Anúncio</h3>
                    <p className="text-xs text-gray-500 font-sans">Insira o conteúdo escrito e chamadas de ação.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-orbitron font-bold text-gray-700 uppercase">Chamada / Título Principal</label>
                    <input 
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Novos beats e lançamentos exclusivos do VOXA!"
                      className="w-full bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-black font-sans focus:border-black outline-none text-xs"
                      maxLength={50}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-orbitron font-bold text-gray-700 uppercase">Descrição Auxiliar</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Fale um pouco mais do que você está oferecendo e convença o público..."
                      rows={3}
                      className="w-full bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-black font-sans focus:border-black outline-none text-xs resize-none"
                      maxLength={150}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-orbitron font-bold text-gray-700 uppercase">Botão de Ação (CTA)</label>
                      <select
                        value={ctaText}
                        onChange={(e) => setCtaText(e.target.value)}
                        className="w-full bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-black font-sans focus:border-black outline-none text-xs"
                      >
                        <option value="Saiba Mais">Saiba Mais</option>
                        <option value="Comprar Agora">Comprar Agora</option>
                        <option value="Acessar Perfil">Acessar Perfil</option>
                        <option value="Garantir Ticket">Garantir Ticket</option>
                        <option value="Enviar Mensagem">Enviar Mensagem</option>
                        <option value="Inscrever-se">Inscrever-se</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-orbitron font-bold text-gray-700 uppercase">Link de Destino</label>
                      <input 
                        type="url"
                        value={ctaLink}
                        onChange={(e) => setCtaLink(e.target.value)}
                        placeholder="Deixe em branco para apontar ao perfil"
                        className="w-full bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-black font-sans focus:border-black outline-none text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: PLACEMENT & DURATION */}
              {formStep === 4 && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-lg font-orbitron font-black text-black uppercase tracking-wider">Período & Localização</h3>
                    <p className="text-xs text-gray-500 font-sans">Defina a duração e locais de veiculação na rede.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-orbitron font-bold text-gray-700 uppercase">Tempo de Veiculação</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { days: 1, label: '24h' },
                        { days: 3, label: '3d' },
                        { days: 7, label: '7d' },
                        { days: 15, label: '15d' },
                        { days: 30, label: '30d' }
                      ].map(dur => (
                        <button
                          key={dur.days}
                          type="button"
                          onClick={() => setDurationDays(dur.days)}
                          className={`text-[10px] py-3.5 border rounded-xl font-orbitron font-black uppercase text-center transition-all cursor-pointer ${
                            durationDays === dur.days
                              ? 'bg-[#171717] text-white border-black'
                              : 'bg-white border-[#E5E5E5] text-gray-700 hover:border-black'
                          }`}
                        >
                          {dur.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-orbitron font-bold text-gray-700 uppercase">Posicionamento (Exibir em)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {['Feed', 'Explorar', 'Meu Par', 'Banner do Perfil'].map(place => {
                        const active = placements.includes(place);
                        return (
                          <button
                            key={place}
                            type="button"
                            onClick={() => togglePlacement(place)}
                            className={`p-3.5 border rounded-xl text-left transition-all flex justify-between items-center cursor-pointer ${
                              active 
                                ? 'bg-[#FAFAFA] border-black text-black font-bold' 
                                : 'bg-white border-[#E5E5E5] text-gray-500 hover:border-black'
                            }`}
                          >
                            <span className="text-[10px] font-orbitron font-bold uppercase">{place}</span>
                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                              active ? 'border-black bg-black' : 'border-gray-300'
                            }`}>
                              {active && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: RESUMO */}
              {formStep === 5 && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-lg font-orbitron font-black text-black uppercase tracking-wider">Confirmar Resumo</h3>
                    <p className="text-xs text-gray-500 font-sans">Confirme as especificações do anúncio de alta performance.</p>
                  </div>

                  <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-2xl p-5 space-y-3.5 text-black">
                    <div className="flex justify-between items-baseline border-b border-gray-200 pb-2.5">
                      <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">Anunciante</span>
                      <span className="text-xs font-bold font-mono">@{currentUser.username || 'seu_perfil'}</span>
                    </div>
                    
                    <div className="flex justify-between items-baseline border-b border-gray-200 pb-2.5">
                      <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">Título</span>
                      <span className="text-xs font-bold max-w-xs truncate">{title}</span>
                    </div>

                    <div className="flex justify-between items-baseline border-b border-gray-200 pb-2.5">
                      <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">Canais</span>
                      <span className="text-xs font-bold uppercase font-orbitron">{placements.join(', ')}</span>
                    </div>

                    <div className="flex justify-between items-baseline border-b border-gray-200 pb-2.5">
                      <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">Duração</span>
                      <span className="text-xs font-bold font-mono">{durationDays} {durationDays === 1 ? 'Dia' : 'Dias'}</span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase font-bold">Investimento Final</span>
                      <span className="text-lg font-black text-emerald-600 font-mono">{formatBRL(calculateTotalCost())}</span>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-gray-600 font-sans leading-relaxed">
                      Ao salvar seu anúncio, ele ficará guardado em formato **Rascunho (Aguardando Pagamento)**. Você precisará pagar o valor debitando de seu saldo da carteira para enviá-lo à moderação do VOXA.
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-[#E5E5E5]">
                {formStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setFormStep(prev => prev - 1)}
                    className="bg-[#FAFAFA] hover:bg-gray-100 border border-[#E5E5E5] text-black font-orbitron font-black text-[10px] py-2.5 px-5 rounded-xl transition-all uppercase tracking-wider cursor-pointer"
                  >
                    Anterior
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className="bg-[#FAFAFA] hover:bg-gray-100 border border-[#E5E5E5] text-black font-orbitron font-black text-[10px] py-2.5 px-5 rounded-xl transition-all uppercase tracking-wider cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}

                {formStep < 5 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (formStep === 2 && !mediaUrl && mediaType !== 'video' && carouselUrls.length === 0) {
                        alert("Por favor, faça o upload de uma mídia para continuar.");
                        return;
                      }
                      if (formStep === 3 && (!title || !description)) {
                        alert("Preencha o título e a descrição do seu anúncio.");
                        return;
                      }
                      setFormStep(prev => prev + 1);
                    }}
                    className="bg-[#171717] hover:bg-black text-white font-orbitron font-black text-[10px] py-2.5 px-5 rounded-xl transition-all uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                  >
                    Avançar
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-orbitron font-black text-[10px] py-2.5 px-5 rounded-xl transition-all uppercase tracking-wider cursor-pointer font-bold"
                  >
                    Salvar Campanha
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      ) : (
        // --- ADVERTISER DASHBOARD VIEW (LIGHT THEME) ---
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Anúncios Criados", value: myCampaigns.length, icon: Megaphone, color: "text-red-500", bg: "bg-red-50" },
              { label: "Visualizações", value: myCampaigns.reduce((acc, c) => acc + (c.impressionsCount || 0), 0), icon: Eye, color: "text-blue-500", bg: "bg-blue-50" },
              { label: "Cliques", value: myCampaigns.reduce((acc, c) => acc + (c.clicksCount || 0), 0), icon: MousePointerClick, color: "text-emerald-500", bg: "bg-emerald-50" },
              { label: "Total Investido", value: formatBRL(myCampaigns.filter(c => c.status !== 'draft').reduce((acc, c) => acc + (c.cost || 0), 0)), icon: DollarSign, color: "text-amber-600", bg: "bg-amber-50" }
            ].map((m, idx) => {
              const IconComp = m.icon;
              return (
                <div key={idx} className="bg-white border border-[#E5E5E5] p-5 rounded-2xl flex items-center justify-between text-left shadow-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-500 font-mono block uppercase font-bold">{m.label}</span>
                    <span className="text-xl font-black font-mono text-black block">{m.value}</span>
                  </div>
                  <div className={`w-10 h-10 rounded-full ${m.bg} flex items-center justify-center shrink-0`}>
                    <IconComp className={`w-5 h-5 ${m.color}`} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* User Campaign list tables */}
          <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 text-left shadow-xs">
            <div className="border-b border-gray-100 pb-4 mb-4 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-orbitron font-black text-black uppercase tracking-wider">Histórico de Campanhas</h3>
                <p className="text-[9px] text-gray-500 font-mono uppercase mt-1">Seus anúncios veiculados na rede</p>
              </div>
              <span className="text-[10px] font-mono text-[#FF0033] bg-red-50 border border-red-100 px-3 py-1 rounded-full uppercase font-bold">Google Ads: Pronto para Vincular</span>
            </div>

            {myCampaigns.length === 0 ? (
              <div className="py-16 text-center space-y-4">
                <Megaphone className="w-10 h-10 text-gray-300 mx-auto" />
                <p className="text-xs text-gray-500 font-sans max-w-sm mx-auto leading-relaxed">Você ainda não possui anúncios criados. Promova seus posts, Store ou shows.</p>
                <button
                  onClick={() => {
                    resetForm();
                    setActiveTab('create');
                  }}
                  className="bg-[#FAFAFA] hover:bg-gray-100 border border-[#E5E5E5] text-black font-orbitron font-black text-[10px] py-2 px-4 rounded-xl uppercase tracking-widest transition-all cursor-pointer"
                >
                  Criar Primeiro Anúncio
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 font-orbitron font-black text-[9px] text-gray-500 uppercase tracking-widest">
                      <th className="py-3 px-2">Campanha</th>
                      <th className="py-3 px-2">Objetivo</th>
                      <th className="py-3 px-2">Status</th>
                      <th className="py-3 px-2">Duração</th>
                      <th className="py-3 px-2">Desempenho</th>
                      <th className="py-3 px-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-sans text-xs">
                    {myCampaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-[#FAFAFA] transition-all">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-3">
                            {c.mediaUrl ? (
                              <img src={c.mediaUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-50 border border-gray-200 shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-200 shrink-0 text-gray-400">
                                <Megaphone className="w-4 h-4" />
                              </div>
                            )}
                            <div className="space-y-0.5">
                              <span className="font-bold text-[#171717] block uppercase max-w-xs truncate">{c.title || 'Sem título'}</span>
                              <span className="text-[9px] text-gray-400 font-orbitron uppercase tracking-wider block">{c.placements?.join(', ')}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-[10px] text-gray-500 font-mono uppercase">{String(c.objective).replace('_', ' ')}</span>
                        </td>
                        <td className="py-3 px-2">{getStatusBadge(c.status)}</td>
                        <td className="py-3 px-2 font-mono text-[10px] text-gray-600">
                          {c.durationDays} {c.durationDays === 1 ? 'Dia' : 'Dias'}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex gap-4 font-mono text-[10px]">
                            <div className="space-y-0.5">
                              <span className="text-[8px] text-gray-400 block font-sans">VISUALIZAÇÕES</span>
                              <span className="text-black block font-bold">{c.impressionsCount || 0}</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[8px] text-gray-400 block font-sans">CLIQUES</span>
                              <span className="text-black block font-bold">{c.clicksCount || 0}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          {c.status === 'draft' ? (
                            <button
                              onClick={() => handlePayCampaign(c.id, c.cost)}
                              className="bg-[#171717] hover:bg-black text-white font-orbitron font-black text-[9px] py-2 px-3 rounded-xl uppercase tracking-wider transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <DollarSign className="w-3 h-3" />
                              Pagar ({formatBRL(c.cost)})
                            </button>
                          ) : (
                            <span className="text-[10px] font-mono text-gray-400 italic">Submetido para moderação</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
