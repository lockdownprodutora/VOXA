import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Check, 
  X, 
  Trash2, 
  Eye, 
  DollarSign, 
  BarChart2, 
  Settings, 
  ShieldCheck, 
  Clock, 
  AlertTriangle,
  Play,
  Pause
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { formatBRL } from '../../utils/money';

export function AdsModule() {
  const [loading, setLoading] = useState<boolean>(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  
  // Config States (system_config/ads)
  const [datingAdInterval, setDatingAdInterval] = useState<number>(5);
  const [voxaAdsEnabled, setVoxaAdsEnabled] = useState<boolean>(true);
  const [googleAdsEnabled, setGoogleAdsEnabled] = useState<boolean>(false);
  const [prices, setPrices] = useState<Record<string, number>>({
    "1": 15,
    "3": 40,
    "7": 85,
    "15": 160,
    "30": 300
  });

  useEffect(() => {
    loadAllAdsData();
  }, []);

  const loadAllAdsData = async () => {
    setLoading(true);
    try {
      // 1. Load Campaigns
      const campSnap = await getDocs(collection(db, 'ad_campaigns'));
      const campList: any[] = [];
      campSnap.forEach(d => {
        campList.push({ id: d.id, ...d.data() });
      });
      setCampaigns(campList);

      // 2. Load Configs
      const configSnap = await getDoc(doc(db, 'ad_config', 'settings'));
      if (configSnap.exists()) {
        const data = configSnap.data();
        if (data.datingAdInterval) setDatingAdInterval(Number(data.datingAdInterval));
        if (data.prices) setPrices(data.prices);
        if (data.voxaAdsEnabled !== undefined) setVoxaAdsEnabled(data.voxaAdsEnabled);
        if (data.googleAdsEnabled !== undefined) setGoogleAdsEnabled(data.googleAdsEnabled);
      }
    } catch (e) {
      console.error("Error loading admin ads data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'ad_config', 'settings'), {
        datingAdInterval: Number(datingAdInterval),
        prices,
        voxaAdsEnabled,
        googleAdsEnabled
      }, { merge: true });
      alert("Configurações de anúncios salvas com sucesso!");
    } catch (err: any) {
      alert("Erro ao salvar configurações: " + err.message);
    }
  };

  const handleSetStatus = async (campaignId: string, status: 'active' | 'rejected' | 'completed') => {
    try {
      await updateDoc(doc(db, 'ad_campaigns', campaignId), {
        status,
        reviewedAt: new Date().toISOString()
      });
      alert(`Campanha atualizada para o status: ${status}`);
      // update locally
      setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status } : c));
    } catch (err: any) {
      alert("Erro ao moderar anúncio: " + err.message);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!window.confirm("Deseja realmente remover esta campanha do banco de dados definitivamente?")) return;
    try {
      await deleteDoc(doc(db, 'ad_campaigns', campaignId));
      alert("Campanha excluída permanentemente.");
      setCampaigns(prev => prev.filter(c => c.id !== campaignId));
    } catch (err: any) {
      alert("Erro ao excluir campanha: " + err.message);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono uppercase px-2.5 py-1 rounded-full font-bold">Ativo</span>;
      case 'pending_review':
        return <span className="bg-amber-500/15 text-amber-400 border border-amber-500/20 text-[9px] font-mono uppercase px-2.5 py-1 rounded-full font-bold">Aguardando Moderação</span>;
      case 'draft':
        return <span className="bg-neutral-600/20 text-neutral-400 border border-neutral-600/20 text-[9px] font-mono uppercase px-2.5 py-1 rounded-full">Aguardando Pagamento</span>;
      case 'rejected':
        return <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-mono uppercase px-2.5 py-1 rounded-full">Rejeitado</span>;
      case 'completed':
        return <span className="bg-neutral-700 text-gray-400 text-[9px] font-mono uppercase px-2.5 py-1 rounded-full">Encerrado / Expirado</span>;
      default:
        return <span className="bg-zinc-800 text-gray-300 text-[9px] font-mono uppercase px-2.5 py-1 rounded-full">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white">
        <div className="w-10 h-10 border-4 border-[#FF0033] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-mono text-gray-400">Carregando Moderação de Anúncios...</p>
      </div>
    );
  }

  // Split campaigns
  const pendingCampaigns = campaigns.filter(c => c.status === 'pending_review');
  const otherCampaigns = campaigns.filter(c => c.status !== 'pending_review');

  return (
    <div className="space-y-8 animate-fadeIn text-left">
      {/* Module Title */}
      <div>
        <span className="text-[#FF0033] font-orbitron text-[10px] tracking-widest block font-bold uppercase">Painel de Publicidade e Monetização</span>
        <h1 className="font-orbitron font-black text-3xl text-white mt-1 uppercase">Central de Anúncios VOXA</h1>
        <p className="text-xs text-gray-400 mt-1 font-sans">Gerencie anúncios nativos do VOXA Ads e configure parâmetros gerais de publicidade da plataforma.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Moderation Lists */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. Pending Moderation */}
          <div className="bg-[#12111d] border border-white/10 rounded-3xl p-6">
            <h3 className="font-orbitron font-black text-base text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              Campanhas em Moderação ({pendingCampaigns.length})
            </h3>
            <p className="text-[10px] text-gray-500 font-mono uppercase mb-4">Revisão obrigatória antes da veiculação pública</p>

            {pendingCampaigns.length === 0 ? (
              <p className="text-xs text-gray-500 py-8 text-center font-sans">Nenhuma campanha pendente de revisão no momento.</p>
            ) : (
              <div className="space-y-4">
                {pendingCampaigns.map(c => (
                  <div key={c.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex gap-4 min-w-0">
                      {c.mediaUrl ? (
                        <img src={c.mediaUrl} alt="" className="w-16 h-16 rounded-xl object-cover bg-zinc-800 border border-white/5 shrink-0" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center border border-white/5 shrink-0 text-gray-600">
                          <Megaphone className="w-6 h-6" />
                        </div>
                      )}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="font-extrabold text-white uppercase text-sm block truncate">{c.title || 'Sem título'}</span>
                          <span className="bg-amber-400/10 text-amber-400 font-mono text-[8px] uppercase font-bold px-1.5 py-0.5 rounded">R$ {c.cost}</span>
                        </div>
                        <p className="text-xs text-gray-400 font-sans line-clamp-2 leading-relaxed">{c.description || 'Sem descrição'}</p>
                        <div className="flex flex-wrap gap-2 text-[9px] text-neutral-500 font-mono uppercase">
                          <span>Anunciante: {c.userName || 'Membro'}</span>
                          <span>•</span>
                          <span>Canais: {c.placements?.join(', ')}</span>
                          <span>•</span>
                          <span>Período: {c.durationDays} dias</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Admin Actions */}
                    <div className="flex gap-2 shrink-0 self-end md:self-auto">
                      <button
                        onClick={() => handleSetStatus(c.id, 'active')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-orbitron font-black text-[9px] py-2 px-3 rounded-xl transition-all uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleSetStatus(c.id, 'rejected')}
                        className="bg-red-600/10 hover:bg-red-600/20 text-red-400 font-orbitron font-black text-[9px] py-2 px-3 rounded-xl transition-all uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Recusar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. All Other campaigns */}
          <div className="bg-[#12111d] border border-white/10 rounded-3xl p-6">
            <h3 className="font-orbitron font-black text-base text-white uppercase tracking-wider mb-1">Todas as Outras Campanhas</h3>
            <p className="text-[10px] text-gray-500 font-mono uppercase mb-4">Campanhas ativas, encerradas, recusadas ou rascunhos</p>

            {otherCampaigns.length === 0 ? (
              <p className="text-xs text-gray-500 py-8 text-center font-sans">Nenhuma outra campanha registrada no banco.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 font-orbitron font-black text-[9px] text-gray-500 uppercase tracking-widest">
                      <th className="py-2.5 px-2">Anúncio</th>
                      <th className="py-2.5 px-2">Custo</th>
                      <th className="py-2.5 px-2">Status</th>
                      <th className="py-2.5 px-2">Cliques/Imp</th>
                      <th className="py-2.5 px-2 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-sans">
                    {otherCampaigns.map(c => (
                      <tr key={c.id} className="hover:bg-white/5 transition-all text-xs">
                        <td className="py-3 px-2">
                          <div className="space-y-0.5">
                            <span className="font-bold text-white block uppercase max-w-xs truncate">{c.title || 'Sem título'}</span>
                            <span className="text-[9px] text-gray-500 font-mono">Por: {c.userName || 'Membro'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 font-mono text-[11px] text-gray-300">
                          {formatBRL(c.cost || 0)}
                        </td>
                        <td className="py-3 px-2">
                          {getStatusLabel(c.status)}
                        </td>
                        <td className="py-3 px-2 font-mono text-[10px]">
                          {c.clicksCount || 0} / {c.impressionsCount || 0}
                        </td>
                        <td className="py-3 px-2 text-right space-x-1.5">
                          {c.status === 'active' ? (
                            <button
                              onClick={() => handleSetStatus(c.id, 'completed')}
                              className="text-amber-500 hover:text-white p-1 rounded hover:bg-white/5 transition-all"
                              title="Pausar/Encerrar"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          ) : c.status === 'completed' || c.status === 'rejected' ? (
                            <button
                              onClick={() => handleSetStatus(c.id, 'active')}
                              className="text-emerald-500 hover:text-white p-1 rounded hover:bg-white/5 transition-all"
                              title="Reativar"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          ) : null}
                          <button
                            onClick={() => handleDeleteCampaign(c.id)}
                            className="text-neutral-500 hover:text-red-500 p-1 rounded hover:bg-white/5 transition-all"
                            title="Deletar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Config & pricing */}
        <div className="lg:col-span-4 space-y-6">
          <form onSubmit={handleUpdateConfig} className="bg-[#12111d] border border-white/10 rounded-3xl p-6 space-y-5">
            <h3 className="font-orbitron font-black text-base text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#FF0033]" />
              Parâmetros de Publicidade
            </h3>
            
            {/* Toggle systems */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-orbitron font-bold text-gray-300 uppercase">Habilitar VOXA Ads</span>
                <button
                  type="button"
                  onClick={() => setVoxaAdsEnabled(!voxaAdsEnabled)}
                  className={`w-10 h-5.5 rounded-full transition-colors relative focus:outline-none cursor-pointer ${
                    voxaAdsEnabled ? 'bg-red-600' : 'bg-neutral-800 border border-white/10'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 bg-white w-4.5 h-4.5 rounded-full transition-transform ${
                    voxaAdsEnabled ? 'translate-x-4.5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <div className="text-left">
                  <span className="text-xs font-orbitron font-bold text-gray-300 uppercase block">Habilitar Google Ads</span>
                  <span className="text-[8px] text-gray-500 font-mono uppercase block">Aguardando Aprovação Google</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGoogleAdsEnabled(!googleAdsEnabled)}
                  className={`w-10 h-5.5 rounded-full transition-colors relative focus:outline-none cursor-pointer ${
                    googleAdsEnabled ? 'bg-red-600' : 'bg-neutral-800 border border-white/10'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 bg-white w-4.5 h-4.5 rounded-full transition-transform ${
                    googleAdsEnabled ? 'translate-x-4.5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            {/* Interval settings */}
            <div className="space-y-1.5 border-t border-white/5 pt-4 text-left">
              <label className="block text-[10px] font-mono text-gray-400 uppercase">Intervalo no Meu Par (Perfis por AdSlot)</label>
              <input 
                type="number"
                min="1"
                max="20"
                value={datingAdInterval}
                onChange={(e) => setDatingAdInterval(Number(e.target.value))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-xs focus:border-[#FF0033] outline-none"
                required
              />
              <p className="text-[9px] text-gray-500 leading-normal">Ex: Definir "5" exibirá publicidade de anúncios após visualizar 5 perfis.</p>
            </div>

            {/* Campaign Price configurations */}
            <div className="space-y-3 border-t border-white/5 pt-4 text-left">
              <span className="block text-[10px] font-mono text-gray-400 uppercase">Preços fixos por período (R$)</span>
              
              {[
                { key: '1', label: '24 Horas' },
                { key: '3', label: '3 Dias' },
                { key: '7', label: '7 Dias' },
                { key: '15', label: '15 Dias' },
                { key: '30', label: '30 Dias' }
              ].map(dur => (
                <div key={dur.key} className="flex items-center justify-between gap-4">
                  <span className="text-xs text-gray-400 font-sans">{dur.label}:</span>
                  <div className="relative max-w-[120px] w-full">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[10px] text-gray-500 font-mono">R$</span>
                    <input 
                      type="number"
                      value={prices[dur.key] || 0}
                      onChange={(e) => setPrices(prev => ({ ...prev, [dur.key]: Number(e.target.value) }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-white font-mono text-xs text-right focus:border-[#FF0033] outline-none"
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="w-full bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs py-3 rounded-xl transition-all uppercase tracking-widest cursor-pointer"
            >
              Salvar Parâmetros
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
