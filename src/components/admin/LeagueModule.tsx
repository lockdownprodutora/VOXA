import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Award, 
  Users, 
  TrendingUp, 
  ArrowLeft, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Plus, 
  Edit, 
  Trash2, 
  X, 
  Check, 
  Link, 
  Share2, 
  Copy, 
  Shield, 
  Sparkles, 
  ChevronRight, 
  DollarSign, 
  History, 
  UserCheck, 
  ArrowUpRight, 
  ArrowDownRight,
  Flame,
  Star,
  Activity,
  Calendar,
  Send,
  Zap,
  Info
} from 'lucide-react';
import { 
  LeagueParticipant, 
  LeaguePointTransaction, 
  Referral, 
  ReferralSettings,
  CentralUser, 
  LeagueStatus 
} from '../../types';
import { 
  fetchLeagueParticipants, 
  saveLeagueParticipant, 
  approveLeagueEntry, 
  updateLeagueParticipantStatus, 
  adjustLeaguePoints, 
  fetchReferrals,
  fetchReferralSettings,
  saveReferralSettings,
  updateReferralStatusAdmin,
  DEFAULT_REFERRAL_SETTINGS,
  LEAGUE_TRANSACTIONS_CACHE_KEY
} from '../../utils/leagueDb';
import { fetchCentralUsers, saveCentralUser } from '../../utils/centralUserDb';
import { formatBRL } from '../../utils/money';

interface LeagueModuleProps {
  onBackToMenu: () => void;
}

export const LeagueModule: React.FC<LeagueModuleProps> = ({ onBackToMenu }) => {
  const [participants, setParticipants] = useState<LeagueParticipant[]>([]);
  const [users, setUsers] = useState<CentralUser[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [transactions, setTransactions] = useState<LeaguePointTransaction[]>([]);
  const [referralSettings, setReferralSettings] = useState<ReferralSettings>(DEFAULT_REFERRAL_SETTINGS);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [updatingRefId, setUpdatingRefId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'divisions' | 'requests' | 'points_adjust' | 'referrals' | 'audit'>('divisions');
  const [selectedDivision, setSelectedDivision] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Points adjustment modal state
  const [selectedParticipantForPoints, setSelectedParticipantForPoints] = useState<LeagueParticipant | null>(null);
  const [pointChange, setPointChange] = useState<number>(10);
  const [pointReason, setPointReason] = useState<string>('');
  const [pointType, setPointType] = useState<string>('ACTIVITY');
  const [pointRef, setPointRef] = useState<string>('');
  const [isAdjustingPoints, setIsAdjustingPoints] = useState(false);

  // Status edit modal
  const [editingParticipant, setEditingParticipant] = useState<LeagueParticipant | null>(null);
  const [editStatus, setEditStatus] = useState<LeagueStatus>('ATIVO');
  const [editDivision, setEditDivision] = useState<number>(10);
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [partsList, usersList, refsList, refCfg] = await Promise.all([
        fetchLeagueParticipants(),
        fetchCentralUsers(),
        fetchReferrals(),
        fetchReferralSettings()
      ]);
      setParticipants(partsList);
      setUsers(usersList);
      setReferrals(refsList);
      setReferralSettings(refCfg);

      // Load local transactions cache
      try {
        const savedTx = localStorage.getItem(LEAGUE_TRANSACTIONS_CACHE_KEY);
        if (savedTx) {
          setTransactions(JSON.parse(savedTx));
        }
      } catch (e) {}
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Erro ao carregar dados da League.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveReferralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setErrorMsg('');
    try {
      const saved = await saveReferralSettings(referralSettings);
      setReferralSettings(saved);
      setSuccessMsg('Regras de Indicação & Carteira Promocional salvas no Firestore!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao salvar configurações de indicação.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAuditReferralStatus = async (refId: string, newStatus: 'qualified' | 'fraud_rejected') => {
    setUpdatingRefId(refId);
    setErrorMsg('');
    try {
      await updateReferralStatusAdmin(refId, newStatus);
      setReferrals((prev) => prev.map((r) => (r.id === refId ? { ...r, status: newStatus } : r)));
      setSuccessMsg(`Status da indicação atualizado para ${newStatus.toUpperCase()}!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao atualizar status da indicação.');
    } finally {
      setUpdatingRefId(null);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApproveEntry = async (participantId: string) => {
    try {
      await approveLeagueEntry(participantId);
      setSuccessMsg('Participante aprovado com sucesso na 10ª Divisão!');
      await loadData();
    } catch (err: any) {
      setErrorMsg('Erro ao aprovar entrada.');
    }
  };

  const handleSaveParticipantStatus = async () => {
    if (!editingParticipant) return;
    setIsSavingStatus(true);
    try {
      await updateLeagueParticipantStatus(editingParticipant.id, editStatus, editDivision);
      setSuccessMsg('Status e Divisão do participante atualizados com sucesso!');
      setEditingParticipant(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg('Erro ao atualizar participante.');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleApplyPointAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParticipantForPoints) return;
    if (!pointReason.trim()) {
      setErrorMsg('Informe o motivo do ajuste de pontos.');
      return;
    }

    setIsAdjustingPoints(true);
    setErrorMsg('');
    try {
      const adminEmail = localStorage.getItem('voxa_current_user') 
        ? JSON.parse(localStorage.getItem('voxa_current_user')!).email 
        : 'admin@voxa.com.br';

      await adjustLeaguePoints({
        userId: selectedParticipantForPoints.userId || selectedParticipantForPoints.id,
        change: Number(pointChange),
        reason: pointReason,
        type: pointType,
        reference: pointRef || `ADJ-${Date.now().toString(36).toUpperCase()}`,
        adminEmail
      });

      setSuccessMsg('Pontuação ajustada com sucesso e registrada na auditoria!');
      setSelectedParticipantForPoints(null);
      setPointReason('');
      setPointRef('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao ajustar pontos.');
    } finally {
      setIsAdjustingPoints(false);
    }
  };

  // Helper to map participant with user profile
  const getParticipantUser = (participant: LeagueParticipant): CentralUser => {
    return users.find(u => u.id === participant.userId || u.uid === participant.userId) || {
      id: participant.userId,
      name: 'Usuário',
      role: 'USUÁRIO COMUM',
      accountStatus: 'SEM_ACESSO'
    };
  };

  // Metrics
  const activeParticipants = participants.filter(p => p.status === 'ATIVO');
  const pendingRequests = participants.filter(p => p.status === 'PENDENTE');
  const totalPointsInSystem = participants.reduce((acc, curr) => acc + (curr.points || 0), 0);
  const totalReferrals = referrals.length;

  // Filtered participants by division
  const divisionParticipants = participants
    .filter(p => p.division === selectedDivision && p.status === 'ATIVO')
    .sort((a, b) => (b.points || 0) - (a.points || 0));

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-emerald-600 shadow-sm"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-orbitron text-xs font-bold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-between text-[#FF0033] shadow-sm"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-[#FF0033] shrink-0" />
              <span className="font-orbitron text-xs font-bold">{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-[#FF0033] hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToMenu}
            className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl cursor-pointer transition-colors"
            title="Voltar ao Menu"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center text-[#FF0033] shadow-md shrink-0">
            <Trophy className="w-6 h-6 text-[#FF0033]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-orbitron font-black text-xl text-black">SISTEMA LEAGUE & RANKINGS</h2>
              <span className="bg-red-50 text-[#FF0033] font-orbitron font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-red-200">
                10 DIVISÕES COMPETITIVAS
              </span>
            </div>
            <p className="text-gray-500 text-xs font-sans mt-0.5">
              Gestão de pontuações, solicitações, divisões (10ª à 1ª), indicações e auditoria de transações.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl cursor-pointer transition-colors"
            title="Recarregar"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
          <span className="text-[10px] font-orbitron font-bold text-gray-400 block">PARTICIPANTES ATIVOS</span>
          <span className="text-2xl font-orbitron font-black text-black">{activeParticipants.length}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-amber-200/70 shadow-xs">
          <span className="text-[10px] font-orbitron font-bold text-amber-600 block">SOLICITAÇÕES PENDENTES</span>
          <span className="text-2xl font-orbitron font-black text-amber-700">{pendingRequests.length}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-red-200/70 shadow-xs">
          <span className="text-[10px] font-orbitron font-bold text-[#FF0033] block">TOTAL DE PONTOS EM JOGO</span>
          <span className="text-2xl font-orbitron font-black text-[#FF0033]">{totalPointsInSystem.toLocaleString('pt-BR')}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/70 shadow-xs">
          <span className="text-[10px] font-orbitron font-bold text-emerald-600 block">INDICAÇÕES REGISTRADAS</span>
          <span className="text-2xl font-orbitron font-black text-emerald-700">{totalReferrals}</span>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex space-x-2 border-b border-gray-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('divisions')}
          className={`px-4 py-2 rounded-2xl font-orbitron font-bold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center space-x-2 ${
            activeTab === 'divisions'
              ? 'bg-black text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Trophy className="w-3.5 h-3.5 text-[#FF0033]" />
          <span>TABELA DAS DIVISÕES (1ª A 10ª)</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded-2xl font-orbitron font-bold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center space-x-2 ${
            activeTab === 'requests'
              ? 'bg-black text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5 text-amber-500" />
          <span>SOLICITAÇÕES DE ENTRADA ({pendingRequests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('referrals')}
          className={`px-4 py-2 rounded-2xl font-orbitron font-bold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center space-x-2 ${
            activeTab === 'referrals'
              ? 'bg-black text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Share2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>SISTEMA DE INDICAÇÕES</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-2xl font-orbitron font-bold text-xs transition-all cursor-pointer whitespace-nowrap flex items-center space-x-2 ${
            activeTab === 'audit'
              ? 'bg-black text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <History className="w-3.5 h-3.5 text-purple-500" />
          <span>AUDITORIA DE PONTOS</span>
        </button>
      </div>

      {/* TAB 1: DIVISIONS */}
      {activeTab === 'divisions' && (
        <div className="space-y-4">
          {/* Division Selector Pills (10 to 1) */}
          <div className="bg-white p-4 rounded-3xl border border-gray-200 shadow-xs space-y-3">
            <span className="font-orbitron text-xs font-bold text-gray-500 block">SELECIONE A DIVISÃO:</span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((div) => {
                const count = participants.filter(p => p.division === div && p.status === 'ATIVO').length;
                const isCurrent = selectedDivision === div;
                return (
                  <button
                    key={div}
                    onClick={() => setSelectedDivision(div)}
                    className={`px-4 py-2.5 rounded-2xl font-orbitron font-bold text-xs cursor-pointer transition-all shrink-0 flex items-center space-x-2 ${
                      isCurrent
                        ? 'bg-[#FF0033] text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span>{div === 1 ? '👑 1ª DIVISÃO (ELITE)' : `${div}ª DIVISÃO`}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                      isCurrent ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Division Table */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-3">
                <span className="w-3 h-3 rounded-full bg-[#FF0033]"></span>
                <h3 className="font-orbitron font-black text-base text-black">
                  {selectedDivision === 1 ? '1ª DIVISÃO • ELITE SUPREMA' : `${selectedDivision}ª DIVISÃO COMPETITIVA`}
                </h3>
              </div>
              <span className="text-xs text-gray-400 font-sans">
                {divisionParticipants.length} membros ativos nesta divisão
              </span>
            </div>

            {divisionParticipants.length === 0 ? (
              <div className="p-12 text-center text-gray-400 font-orbitron text-xs">
                Nenhum participante ativo na {selectedDivision}ª Divisão no momento.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {divisionParticipants.map((participant, index) => {
                  const user = getParticipantUser(participant);
                  return (
                    <div
                      key={participant.id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50/80 transition-colors flex-wrap"
                    >
                      <div className="flex items-center space-x-4">
                        {/* Position badge */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-orbitron font-black text-xs ${
                          index === 0 
                            ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                            : index === 1 
                            ? 'bg-slate-200 text-slate-800' 
                            : index === 2 
                            ? 'bg-amber-900/10 text-amber-900' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          #{index + 1}
                        </div>

                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            alt=""
                            className="w-12 h-12 rounded-2xl object-cover border border-gray-200 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center shrink-0">
                            <span className="font-orbitron font-bold text-sm text-white">
                              {user.name.charAt(0)}
                            </span>
                          </div>
                        )}

                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-orbitron font-black text-sm text-black">{user.name}</h4>
                            {user.artisticName && (
                              <span className="text-[11px] font-orbitron text-purple-700 font-bold">
                                ({user.artisticName})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-gray-500 font-sans mt-0.5">
                            <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-orbitron font-bold">
                              {user.role}
                            </span>
                            <span>{user.email || 'Sem e-mail'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Points & Actions */}
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <span className="font-orbitron font-black text-lg text-[#FF0033] block">
                            {(participant.points || 0).toLocaleString('pt-BR')} PTS
                          </span>
                          <span className="text-[10px] text-gray-400 font-sans block">
                            Temporada: {(participant.seasonPoints || 0).toLocaleString('pt-BR')} pts
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedParticipantForPoints(participant);
                              setPointChange(50);
                              setPointReason('');
                            }}
                            className="bg-red-50 hover:bg-red-100 text-[#FF0033] border border-red-200 font-orbitron font-bold text-xs px-3.5 py-2 rounded-xl flex items-center space-x-1 cursor-pointer transition-colors"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>AJUSTAR PONTOS</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingParticipant(participant);
                              setEditStatus(participant.status);
                              setEditDivision(participant.division);
                            }}
                            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl cursor-pointer transition-colors"
                            title="Alterar Status / Divisão"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REQUESTS */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-orbitron font-black text-base text-black">SOLICITAÇÕES DE ENTRADA NA LEAGUE</h3>
            <p className="text-gray-500 text-xs font-sans mt-0.5">
              Usuários que solicitaram participação. Todos os novos participantes ingressam exclusivamente na <strong>10ª Divisão</strong>.
            </p>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="p-12 text-center text-gray-400 font-orbitron text-xs">
              Nenhuma solicitação pendente no momento. Todas as solicitações foram avaliadas.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingRequests.map((participant) => {
                const user = getParticipantUser(participant);
                return (
                  <div key={participant.id} className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors flex-wrap">
                    <div className="flex items-center space-x-3">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="" className="w-12 h-12 rounded-2xl object-cover border border-gray-200" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center">
                          <span className="font-orbitron font-bold text-white">{user.name.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                        <h4 className="font-orbitron font-black text-sm text-black">{user.name}</h4>
                        <span className="text-xs text-gray-500 font-sans">{user.email || user.phone || 'Sem contato'}</span>
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-orbitron font-bold block mt-1 w-fit border border-amber-200">
                          SOLICITOU ENTRADA NA 10ª DIVISÃO
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleApproveEntry(participant.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-orbitron font-bold text-xs px-4 py-2.5 rounded-2xl flex items-center space-x-1.5 shadow-sm cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>APROVAR NA 10ª DIVISÃO</span>
                      </button>

                      <button
                        onClick={() => updateLeagueParticipantStatus(participant.id, 'SAIU')}
                        className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl cursor-pointer"
                        title="Recusar Solicitação"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REFERRALS & PROMOTIONAL WALLET */}
      {activeTab === 'referrals' && (
        <div className="space-y-6">
          {/* Promotional Wallet & Referral Rules Configuration Card */}
          <form onSubmit={handleSaveReferralSettings} className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <span className="font-orbitron text-[10px] text-purple-600 tracking-widest font-black uppercase block">
                  CRESCIMENTO & AQUISIÇÃO DE USUÁRIOS
                </span>
                <h3 className="font-orbitron font-black text-base sm:text-lg text-black uppercase mt-0.5">
                  REGRAS DE INDICAÇÃO & CARTEIRA PROMOCIONAL SEPARADA
                </h3>
                <p className="text-gray-500 text-xs font-sans mt-1">
                  O bônus de indicação é creditado exclusivamente em <strong>promoBalance</strong> (Carteira Promocional), mantendo o saldo real (<strong>availableBalance</strong>) 100% isolado e protegido.
                </p>
              </div>

              <label className="flex items-center space-x-2.5 bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-2xl cursor-pointer self-start">
                <input
                  type="checkbox"
                  checked={referralSettings.enabled}
                  onChange={(e) => setReferralSettings({ ...referralSettings, enabled: e.target.checked })}
                  className="w-4 h-4 accent-[#FF0033] rounded cursor-pointer"
                />
                <span className="font-orbitron font-bold text-xs text-black uppercase">
                  {referralSettings.enabled ? 'PROGRAMA ATIVO' : 'PROGRAMA PAUSADO'}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-purple-50/50 border border-purple-200 p-4 rounded-2xl">
                <label className="font-orbitron text-[10px] text-purple-900 font-bold uppercase block mb-1">
                  BÔNUS PARA QUEM INDICA (R$ PROMO)
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={(referralSettings.referrerBonusAmount / 100).toFixed(2)}
                  onChange={(e) =>
                    setReferralSettings({
                      ...referralSettings,
                      referrerBonusAmount: Math.max(0, Math.round(parseFloat(e.target.value || '0') * 100))
                    })
                  }
                  className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 text-sm font-mono font-black text-black focus:outline-none focus:border-purple-600"
                />
                <span className="text-[10px] text-purple-700 font-sans block mt-1">
                  Creditado na Carteira Promocional do indicador
                </span>
              </div>

              <div className="bg-purple-50/50 border border-purple-200 p-4 rounded-2xl">
                <label className="font-orbitron text-[10px] text-purple-900 font-bold uppercase block mb-1">
                  BÔNUS PARA NOVO MEMBRO (R$ PROMO)
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={(referralSettings.referredBonusAmount / 100).toFixed(2)}
                  onChange={(e) =>
                    setReferralSettings({
                      ...referralSettings,
                      referredBonusAmount: Math.max(0, Math.round(parseFloat(e.target.value || '0') * 100))
                    })
                  }
                  className="w-full bg-white border border-purple-300 rounded-xl px-3 py-2 text-sm font-mono font-black text-black focus:outline-none focus:border-purple-600"
                />
                <span className="text-[10px] text-purple-700 font-sans block mt-1">
                  Creditado na Carteira Promocional do convidado
                </span>
              </div>

              <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl">
                <label className="font-orbitron text-[10px] text-gray-700 font-bold uppercase block mb-1">
                  PONTOS NA LEAGUE POR INDICAÇÃO
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={referralSettings.referrerLeaguePoints}
                  onChange={(e) =>
                    setReferralSettings({
                      ...referralSettings,
                      referrerLeaguePoints: Math.max(0, parseInt(e.target.value || '0', 10))
                    })
                  }
                  className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-sm font-mono font-black text-black focus:outline-none focus:border-[#FF0033]"
                />
                <span className="text-[10px] text-gray-500 font-sans block mt-1">
                  Pontos adicionados ao ranking do indicador
                </span>
              </div>
            </div>

            {/* Promotional Wallet Usage Permissions */}
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl space-y-3">
              <span className="font-orbitron text-[10px] font-black text-gray-700 uppercase tracking-wider block">
                PERMISSÕES DE USO DO SALDO PROMOCIONAL (CONTROLE DO ADMIN)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="flex items-start space-x-2.5 bg-white p-3 rounded-xl border border-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={referralSettings.allowPromoInStore}
                    onChange={(e) => setReferralSettings({ ...referralSettings, allowPromoInStore: e.target.checked })}
                    className="w-4 h-4 accent-purple-600 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="font-orbitron font-bold text-xs text-black block">USAR EM SERVIÇOS & STORE</span>
                    <span className="text-[10px] text-gray-500 font-sans block">Permite abater em produtos, tickets e serviços internos</span>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 bg-white p-3 rounded-xl border border-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={referralSettings.allowPromoInTrade}
                    onChange={(e) => setReferralSettings({ ...referralSettings, allowPromoInTrade: e.target.checked })}
                    className="w-4 h-4 accent-purple-600 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="font-orbitron font-bold text-xs text-black block">USAR NO VOXA TRADE</span>
                    <span className="text-[10px] text-gray-500 font-sans block">Padrão desativado (VOXA Trade opera com saldo real)</span>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 bg-white p-3 rounded-xl border border-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={referralSettings.allowPromoWithdrawal}
                    onChange={(e) => setReferralSettings({ ...referralSettings, allowPromoWithdrawal: e.target.checked })}
                    className="w-4 h-4 accent-purple-600 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="font-orbitron font-bold text-xs text-black block">PERMITIR SAQUE PIX DIRETO</span>
                    <span className="text-[10px] text-gray-500 font-sans block">Padrão bloqueado contra abuso de bônus</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={referralSettings.autoQualifyOnSignup}
                  onChange={(e) => setReferralSettings({ ...referralSettings, autoQualifyOnSignup: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
                <span className="text-xs font-sans text-gray-700">
                  Aprovar e creditar Carteira Promocional automaticamente no cadastro (desmarque para exigir aprovação manual antifraude)
                </span>
              </label>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="bg-black hover:bg-gray-800 text-white font-orbitron font-bold text-xs px-5 py-2.5 rounded-2xl shadow-xs flex items-center space-x-2 cursor-pointer"
              >
                {isSavingSettings && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>SALVAR REGRAS DE INDICAÇÃO</span>
              </button>
            </div>
          </form>

          {/* Referrals List & Anti-Fraud Audit */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-orbitron font-black text-base text-black">AUDITORIA DE INDICAÇÕES & CONVITES</h3>
                <p className="text-gray-500 text-xs font-sans mt-0.5">
                  Histórico real de cadastros vinculados por código de indicação e status do bônus na Carteira Promocional.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-orbitron font-bold">
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full">
                  Qualificadas: {referrals.filter(r => r.status === 'qualified').length}
                </span>
                <span className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full">
                  Pendentes: {referrals.filter(r => r.status === 'pending').length}
                </span>
                <span className="bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full">
                  Rejeitadas: {referrals.filter(r => r.status === 'fraud_rejected').length}
                </span>
              </div>
            </div>

            {referrals.length === 0 ? (
              <div className="p-12 text-center text-gray-400 font-orbitron text-xs">
                Nenhuma indicação registrada até o momento.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {referrals.map((ref) => {
                  const referrer = users.find(u => u.id === ref.referrerUserId || u.uid === ref.referrerUserId);
                  const referred = users.find(u => u.id === ref.referredUserId || u.uid === ref.referredUserId);
                  return (
                    <div key={ref.id} className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-xs font-orbitron flex-wrap">
                          <span className="font-bold text-gray-500">INDICADOR:</span>
                          <span className="font-black text-black">{ref.referrerName || referrer?.name || ref.referrerUserId}</span>
                          <span className="text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded text-[10px] font-mono">
                            Código: {ref.referralCode}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs font-orbitron flex-wrap">
                          <span className="font-bold text-gray-500">NOVO MEMBRO:</span>
                          <span className="font-black text-emerald-700">{ref.referredName || referred?.name || ref.referredUserId}</span>
                          {typeof ref.bonusAmountCentavos === 'number' && ref.bonusAmountCentavos > 0 && (
                            <span className="text-[10px] font-mono font-bold text-purple-700">
                              • Bônus Promo: {formatBRL(ref.bonusAmountCentavos / 100)}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 font-sans block">
                          Data: {new Date(ref.createdAt).toLocaleDateString('pt-BR')} às {new Date(ref.createdAt).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {ref.status === 'qualified' && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-orbitron font-bold px-3 py-1 rounded-full">
                            QUALIFICADA {ref.promoCredited ? '• BÔNUS CREDITADO' : ''}
                          </span>
                        )}
                        {ref.status === 'pending' && (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-orbitron font-bold px-3 py-1 rounded-full">
                            PENDENTE DE AUDITORIA
                          </span>
                        )}
                        {ref.status === 'fraud_rejected' && (
                          <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-orbitron font-bold px-3 py-1 rounded-full">
                            REJEITADA / FRAUDE
                          </span>
                        )}

                        {ref.status !== 'qualified' && (
                          <button
                            type="button"
                            disabled={updatingRefId === ref.id}
                            onClick={() => handleAuditReferralStatus(ref.id, 'qualified')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-orbitron font-bold px-3 py-1.5 rounded-xl cursor-pointer disabled:opacity-50"
                          >
                            APROVAR & CREDITAR
                          </button>
                        )}

                        {ref.status !== 'fraud_rejected' && (
                          <button
                            type="button"
                            disabled={updatingRefId === ref.id}
                            onClick={() => handleAuditReferralStatus(ref.id, 'fraud_rejected')}
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-[10px] font-orbitron font-bold px-3 py-1.5 rounded-xl cursor-pointer disabled:opacity-50"
                          >
                            REJEITAR / ESTORNAR
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-orbitron font-black text-base text-black">REGISTRO DE TRANSAÇÕES DE PONTOS</h3>
            <p className="text-gray-500 text-xs font-sans mt-0.5">
              Histórico imutável de todas as adições, deduções e pontuações computadas.
            </p>
          </div>

          {transactions.length === 0 ? (
            <div className="p-12 text-center text-gray-400 font-orbitron text-xs">
              Nenhuma transação de pontos registrada nesta sessão.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {transactions.map((tx) => {
                const targetUser = users.find(u => u.id === tx.userId || u.uid === tx.userId);
                const isPositive = tx.change > 0;
                return (
                  <div key={tx.id} className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-orbitron font-bold text-xs text-black">
                          {targetUser?.name || tx.userId}
                        </span>
                        <span className="text-[10px] font-orbitron bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {tx.type}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">
                          {tx.reference}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 font-sans">{tx.reason}</p>
                      <span className="text-[10px] text-gray-400 font-sans block">
                        Por {tx.createdBy} em {new Date(tx.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className={`font-orbitron font-black text-base block ${
                        isPositive ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {isPositive ? `+${tx.change}` : tx.change} PTS
                      </span>
                      <span className="text-[10px] font-sans text-gray-400">
                        {tx.previousValue} → {tx.finalValue}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADJUST POINTS */}
      {selectedParticipantForPoints && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border-2 border-gray-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-[#FF0033]" />
                <h3 className="font-orbitron font-black text-sm text-black">AJUSTAR PONTOS NA LEAGUE</h3>
              </div>
              <button onClick={() => setSelectedParticipantForPoints(null)} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200">
              <span className="text-[10px] font-orbitron text-gray-400 block font-bold">PARTICIPANTE</span>
              <span className="font-orbitron font-black text-sm text-black">
                {getParticipantUser(selectedParticipantForPoints).name}
              </span>
              <span className="text-xs font-orbitron text-[#FF0033] block mt-0.5">
                Pontuação Atual: {selectedParticipantForPoints.points || 0} pts
              </span>
            </div>

            <form onSubmit={handleApplyPointAdjustment} className="space-y-3.5">
              <div>
                <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">
                  QUANTIDADE DE PONTOS (POSITIVO OU NEGATIVO) *
                </label>
                <input
                  type="number"
                  required
                  value={pointChange}
                  onChange={e => setPointChange(Number(e.target.value))}
                  placeholder="Ex: 50 ou -20"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-sm text-black font-orbitron font-bold focus:outline-none focus:border-[#FF0033]"
                />
              </div>

              <div>
                <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">CATEGORIA / TIPO</label>
                <select
                  value={pointType}
                  onChange={e => setPointType(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-orbitron font-bold text-gray-700 focus:outline-none"
                >
                  <option value="ACTIVITY">ATIVIDADE NA PLATAFORMA</option>
                  <option value="REFERRAL">INDICAÇÃO DE MEMBRO</option>
                  <option value="FAN_SUPPORT">ENGAJAMENTO DE FÃS</option>
                  <option value="CHALLENGE">DESAFIO CONCLUÍDO</option>
                  <option value="SALE">VENDA NA STORE</option>
                  <option value="TICKET">INGRESSOS DE SHOW</option>
                  <option value="BONUS">BÔNUS ESPECIAL</option>
                  <option value="PENALTY">PENALIDADE / DEDUÇÃO</option>
                </select>
              </div>

              <div>
                <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">MOTIVO / JUSTIFICATIVA *</label>
                <textarea
                  required
                  rows={2}
                  value={pointReason}
                  onChange={e => setPointReason(e.target.value)}
                  placeholder="Explique o motivo do ajuste para auditoria"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-black focus:outline-none focus:border-[#FF0033]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setSelectedParticipantForPoints(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron text-xs px-4 py-2 rounded-xl"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={isAdjustingPoints}
                  className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs px-5 py-2 rounded-xl shadow cursor-pointer flex items-center space-x-1.5"
                >
                  {isAdjustingPoints && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>APLICAR AJUSTE</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT STATUS / DIVISION */}
      {editingParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border-2 border-gray-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center space-x-2">
                <Edit className="w-5 h-5 text-black" />
                <h3 className="font-orbitron font-black text-sm text-black">ALTERAR PARTICIPANTE DA LEAGUE</h3>
              </div>
              <button onClick={() => setEditingParticipant(null)} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">STATUS</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as LeagueStatus)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-orbitron font-bold text-gray-700 focus:outline-none"
                >
                  <option value="ATIVO">ATIVO</option>
                  <option value="PENDENTE">PENDENTE</option>
                  <option value="SUSPENSO">SUSPENSO</option>
                  <option value="SAIU">SAIU DA LEAGUE</option>
                  <option value="NÃO PARTICIPA">NÃO PARTICIPA</option>
                </select>
              </div>

              <div>
                <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">DIVISÃO (1 A 10)</label>
                <select
                  value={editDivision}
                  onChange={e => setEditDivision(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-orbitron font-bold text-gray-700 focus:outline-none"
                >
                  {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(d => (
                    <option key={d} value={d}>{d === 1 ? '1ª DIVISÃO (ELITE)' : `${d}ª DIVISÃO`}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setEditingParticipant(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron text-xs px-4 py-2 rounded-xl"
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  onClick={handleSaveParticipantStatus}
                  disabled={isSavingStatus}
                  className="bg-black hover:bg-gray-800 text-white font-orbitron font-bold text-xs px-5 py-2 rounded-xl shadow cursor-pointer flex items-center space-x-1.5"
                >
                  {isSavingStatus && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>SALVAR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
