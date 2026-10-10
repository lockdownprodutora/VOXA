import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Trash2, 
  CheckCircle, 
  X, 
  ShieldAlert, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Pause, 
  Play, 
  Search,
  BarChart3,
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { Fundraiser, FundraiserContribution } from '../../types';
import { fetchFundraisers, saveFundraiser, deleteFundraiser, fetchFundraiserContributions } from '../../utils/storeDb';
import { formatBRL } from '../../utils/money';
import { FundraisingAnalyticsDashboard } from '../FundraisingAnalyticsDashboard';

interface VaquinhasModuleProps {
  triggerToast: (msg: string) => void;
}

export const VaquinhasModule: React.FC<VaquinhasModuleProps> = ({ triggerToast }) => {
  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([]);
  const [contributions, setContributions] = useState<FundraiserContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [adminViewTab, setAdminViewTab] = useState<'analytics' | 'campaigns'>('analytics');

  const load = async () => {
    setLoading(true);
    try {
      const [list, contribs] = await Promise.all([
        fetchFundraisers(),
        fetchFundraiserContributions()
      ]);
      setFundraisers(list);
      setContributions(contribs);
    } catch (err) {
      console.warn("Failed to load fundraisers in admin:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggleStatus = async (f: Fundraiser) => {
    const newStatus = f.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await saveFundraiser({ ...f, status: newStatus, updatedAt: new Date().toISOString() });
      triggerToast(`Vaquinha ${newStatus === 'ACTIVE' ? 'ativada' : 'pausada'} com sucesso.`);
      load();
    } catch (err: any) {
      alert('Erro ao alterar status: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta vaquinha?")) return;
    try {
      await deleteFundraiser(id);
      triggerToast('Vaquinha excluída com sucesso.');
      load();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const totalRaised = fundraisers.reduce((acc, f) => acc + (f.raisedAmount || 0), 0);
  const totalCommission = totalRaised * 0.05; // 5% commission

  const filtered = fundraisers.filter(f => 
    f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.ownerName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 text-white font-sans text-left">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-red-600/20 to-purple-600/20 border border-red-500/30 px-3 py-1 rounded-full text-[10px] font-orbitron font-black text-red-400 uppercase tracking-widest mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#FF0033]" />
            <span>Módulo Administrativo</span>
          </div>
          <h2 className="font-orbitron font-black text-2xl md:text-3xl text-white">Gerenciamento de Vaquinhas & Analytics</h2>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 bg-[#12111d] border border-white/10 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setAdminViewTab('analytics')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-orbitron font-bold transition-all cursor-pointer ${
              adminViewTab === 'analytics'
                ? 'bg-white text-black shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Métricas & Gráficos</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminViewTab('campaigns')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-orbitron font-bold transition-all cursor-pointer ${
              adminViewTab === 'campaigns'
                ? 'bg-white text-black shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Lista de Campanhas ({fundraisers.length})</span>
          </button>
        </div>
      </div>

      {/* ANALYTICS TAB WITH RECHARTS CHARTS */}
      {adminViewTab === 'analytics' && (
        <div className="space-y-6">
          <FundraisingAnalyticsDashboard
            fundraisers={fundraisers}
            contributions={contributions}
            onRefresh={load}
            isLoading={loading}
            showTitle={false}
            canManageGoals={true}
            onGoalUpdated={(updated) => {
              setFundraisers(prev => prev.map(f => f.id === updated.id ? updated : f));
              triggerToast(`Meta da campanha "${updated.title}" atualizada para ${formatBRL(updated.goalAmount)}!`);
            }}
          />
        </div>
      )}

      {/* CAMPAIGNS MANAGEMENT TAB */}
      {adminViewTab === 'campaigns' && (
        <div className="space-y-6">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500 pointer-events-none">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar por título ou criador..."
                className="w-full bg-[#12111d] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white font-sans"
              />
            </div>
            
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2.5 bg-[#12111d] hover:bg-white/10 border border-white/10 rounded-xl text-xs font-orbitron font-bold text-gray-300 hover:text-white transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#FF0033]' : ''}`} />
              <span>Atualizar Lista</span>
            </button>
          </div>

          {/* Table of Fundraisers */}
          <div className="bg-[#12111d] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 border-b border-white/10 font-orbitron text-[10px] text-gray-400 uppercase">
                  <tr>
                    <th className="p-4">Campanha</th>
                    <th className="p-4">Criador</th>
                    <th className="p-4">Arrecadado / Meta</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400 font-sans">Carregando vaquinhas...</td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400 font-sans">Nenhuma vaquinha encontrada.</td>
                    </tr>
                  ) : (
                    filtered.map(f => {
                      const percent = f.goalAmount > 0 ? Math.min(100, Math.round((f.raisedAmount / f.goalAmount) * 100)) : 0;
                      return (
                        <tr key={f.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-4 max-w-xs">
                            <div className="flex items-center space-x-3">
                              {f.coverUrl ? (
                                <img src={f.coverUrl} alt="" className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center font-orbitron font-bold text-xs text-white">
                                  VX
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="font-orbitron font-bold text-white block truncate uppercase">{f.title}</span>
                                <span className="text-[10px] text-gray-400 font-mono">/{f.slug}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-gray-200 block">{f.ownerName || 'Membro'}</span>
                            <span className="text-[10px] text-gray-500 font-mono">@{f.ownerUsername || 'membro'}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-mono font-bold text-white block">{formatBRL(f.raisedAmount)}</span>
                            <span className="text-[10px] text-gray-400 font-mono">Meta: {formatBRL(f.goalAmount)} ({percent}%)</span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-orbitron font-bold ${
                              f.status === 'ACTIVE' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {f.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleToggleStatus(f)}
                                className={`p-2 rounded-xl transition-all cursor-pointer ${
                                  f.status === 'ACTIVE' ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                }`}
                                title={f.status === 'ACTIVE' ? 'Pausar Vaquinha' : 'Ativar Vaquinha'}
                              >
                                {f.status === 'ACTIVE' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => handleDelete(f.id)}
                                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all cursor-pointer"
                                title="Excluir Vaquinha"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
