import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gift, Users, Hash, Award, Sliders, X, Plus, Search, Filter, Calendar, 
  DollarSign, CheckCircle2, AlertTriangle, Trash2, Edit, Clock, Sparkles, 
  ShieldCheck, ArrowLeft, ArrowRight, UserCheck, ShieldAlert, Upload
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { fetchCentralUsers } from '../../utils/centralUserDb';
import { CentralUser } from '../../types';
import { PersonSelectAutocomplete } from '../common/PersonSelectAutocomplete';
import { 
  Raffle, RaffleParticipant, PrizeDefinition, 
  fetchRaffles, saveRaffle, deleteRaffleDoc,
  fetchRaffleParticipants, saveRaffleParticipant, deleteRaffleParticipantDoc 
} from '../../utils/raffleDb';
import { uploadFile } from '../../utils/upload';

interface SorteiosModuleProps {
  onBackToMenu: () => void;
  onMascotMoodChange?: (mood: 'normal' | 'attentive' | 'happy' | 'angry' | 'pointing', speech: string) => void;
}

export const SorteiosModule: React.FC<SorteiosModuleProps> = ({ onBackToMenu, onMascotMoodChange }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'sorteios' | 'solicitacoes' | 'participantes' | 'numeros' | 'premiacoes' | 'config'>('overview');
  
  // Data State
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [participants, setParticipants] = useState<RaffleParticipant[]>([]);
  const [centralUsers, setCentralUsers] = useState<CentralUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtering & Searching
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | Raffle['status']>('ALL');
  
  // Modals & Forms
  const [isRaffleModalOpen, setIsRaffleModalOpen] = useState(false);
  const [editingRaffle, setEditingRaffle] = useState<Raffle | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRaffle, setReviewRaffle] = useState<Raffle | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  
  // Manual number allocation
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [selectedRaffleIdForAllocation, setSelectedRaffleIdForAllocation] = useState('');
  const [selectedNumberForAllocation, setSelectedNumberForAllocation] = useState('');
  const [allocateUserId, setAllocateUserId] = useState('');
  const [allocateUserName, setAllocateUserName] = useState('');
  const [allocateUserPhoto, setAllocateUserPhoto] = useState('');

  // Selected raffle for visual numbers grid
  const [selectedRaffleForGridId, setSelectedRaffleForGridId] = useState('');
  const [numbersPage, setNumbersPage] = useState(0);
  const NUMBERS_PER_PAGE = 200;

  // Form State
  const [raffleForm, setRaffleForm] = useState<Partial<Raffle>>({
    name: '',
    description: '',
    prizeImageUrl: '',
    startDate: '',
    endDate: '',
    status: 'RASCUNHO',
    totalNumbers: 100,
    startNumber: 1,
    endNumber: 100,
    rules: '',
    organizerUserId: '',
    organizerName: '',
    organizerType: 'USUÁRIO COMUM',
    prizes: [
      { position: 1, name: '', description: '', type: 'PRODUTO', value: '' },
      { position: 2, name: '', description: '', type: 'PRODUTO', value: '' },
      { position: 3, name: '', description: '', type: 'PRODUTO', value: '' }
    ]
  });

  // Image Upload State for Sorteios
  const [isUploadingMain, setIsUploadingMain] = useState(false);
  const [mainUploadProgress, setMainUploadProgress] = useState(0);
  const [uploadingPrizes, setUploadingPrizes] = useState<{[key: number]: boolean}>({});
  const [prizesUploadProgress, setPrizesUploadProgress] = useState<{[key: number]: number}>({});

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingMain(true);
    setMainUploadProgress(0);
    try {
      const result = await uploadFile(file, 'cover', (progress) => {
        setMainUploadProgress(progress.percentage);
      });
      setRaffleForm(prev => ({ ...prev, prizeImageUrl: result.url }));
      setMainUploadProgress(100);
      setTimeout(() => {
        setIsUploadingMain(false);
        setMainUploadProgress(0);
      }, 1500);
    } catch (err: any) {
      console.error("Main image upload failed:", err);
      alert("Falha no upload da imagem: " + err.message);
      setIsUploadingMain(false);
      setMainUploadProgress(0);
    }
  };

  const handlePrizeImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPrizes(prev => ({ ...prev, [index]: true }));
    setPrizesUploadProgress(prev => ({ ...prev, [index]: 0 }));
    try {
      const result = await uploadFile(file, 'cover', (progress) => {
        setPrizesUploadProgress(prev => ({ ...prev, [index]: progress.percentage }));
      });
      setRaffleForm(prev => {
        const updatedPrizes = [...(prev.prizes || [])];
        updatedPrizes[index] = { ...updatedPrizes[index], imageUrl: result.url };
        return { ...prev, prizes: updatedPrizes };
      });
      setPrizesUploadProgress(prev => ({ ...prev, [index]: 100 }));
      setTimeout(() => {
        setUploadingPrizes(prev => ({ ...prev, [index]: false }));
        setPrizesUploadProgress(prev => ({ ...prev, [index]: 0 }));
      }, 1500);
    } catch (err: any) {
      console.error("Prize image upload failed for index " + index, err);
      alert("Falha no upload do prêmio: " + err.message);
      setUploadingPrizes(prev => ({ ...prev, [index]: false }));
      setPrizesUploadProgress(prev => ({ ...prev, [index]: 0 }));
    }
  };

  // Load all required data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [rafflesList, participantsList, usersList] = await Promise.all([
        fetchRaffles(),
        fetchRaffleParticipants(),
        fetchCentralUsers()
      ]);
      setRaffles(rafflesList);
      setParticipants(participantsList);
      setCentralUsers(usersList);
      
      if (rafflesList.length > 0 && !selectedRaffleForGridId) {
        setSelectedRaffleForGridId(rafflesList[0].id);
      }
    } catch (e) {
      console.error("Error loading Sorteios data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger local state updates and notify user
  const notify = (speech: string, mood: 'happy' | 'pointing' | 'normal' | 'angry' = 'happy') => {
    if (onMascotMoodChange) {
      onMascotMoodChange(mood, speech);
    }
  };

  // Visão Geral stats helper
  const totalRaffles = raffles.length;
  const activeRafflesCount = raffles.filter(r => r.status === 'PUBLICADO').length;
  const pendingRafflesCount = raffles.filter(r => r.status === 'PENDENTE').length;
  const finishedRafflesCount = raffles.filter(r => r.status === 'ENCERRADO').length;
  const canceledRafflesCount = raffles.filter(r => r.status === 'CANCELADO').length;
  const totalNumbersAssigned = participants.filter(p => p.status === 'RESERVADO' || p.status === 'CONFIRMADO' || p.status === 'VENDEDOR').length;
  
  // Uniq participants based on central userId list
  const uniqueParticipantsCount = new Set(participants.map(p => p.userId)).size;

  // Handle Form Prize field changes
  const handlePrizeChange = (index: number, field: keyof PrizeDefinition, value: any) => {
    setRaffleForm(prev => {
      const updatedPrizes = [...(prev.prizes || [])];
      updatedPrizes[index] = { ...updatedPrizes[index], [field]: value };
      return { ...prev, prizes: updatedPrizes };
    });
  };

  // Create or Update Raffle
  const handleSaveRaffle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!raffleForm.name || !raffleForm.organizerUserId) {
      alert("Por favor, preencha o Nome e o Organizador.");
      return;
    }

    const startNum = Number(raffleForm.startNumber) || 1;
    const totalNum = Number(raffleForm.totalNumbers) || 100;
    const endNum = startNum + totalNum - 1;

    if (totalNum <= 0 || totalNum > 10000) {
      alert("A quantidade de números deve ser entre 10 e 10.000 por limitações do sistema.");
      return;
    }

    const currentId = editingRaffle?.id || `sorteio_${Date.now()}`;
    const newRaffle: Raffle = {
      id: currentId,
      name: raffleForm.name || '',
      description: raffleForm.description || '',
      prizeImageUrl: raffleForm.prizeImageUrl || '',
      startDate: raffleForm.startDate || '',
      endDate: raffleForm.endDate || '',
      status: raffleForm.status as Raffle['status'] || 'RASCUNHO',
      totalNumbers: totalNum,
      startNumber: startNum,
      endNumber: endNum,
      rules: raffleForm.rules || '',
      organizerUserId: raffleForm.organizerUserId || '',
      organizerName: raffleForm.organizerName || '',
      organizerPhoto: raffleForm.organizerPhoto || '',
      organizerType: raffleForm.organizerType as Raffle['organizerType'] || 'USUÁRIO COMUM',
      prizes: raffleForm.prizes as PrizeDefinition[] || [],
      createdAt: editingRaffle?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await saveRaffle(newRaffle);
    setIsRaffleModalOpen(false);
    setEditingRaffle(null);
    notify(`Sorteio "${newRaffle.name}" salvo com sucesso!`, 'happy');
    loadAllData();
  };

  // Delete Raffle Doc Safely
  const handleDeleteRaffle = async (id: string) => {
    if (confirm("Deseja realmente excluir este sorteio? Esta ação não afetará os perfis centrais.")) {
      await deleteRaffleDoc(id);
      notify("Sorteio excluído com sucesso do sistema.", 'normal');
      loadAllData();
    }
  };

  // Open Edit Mode
  const openEditRaffle = (raffle: Raffle) => {
    setEditingRaffle(raffle);
    setRaffleForm(raffle);
    setIsRaffleModalOpen(true);
  };

  // Open Create Mode
  const openCreateRaffle = () => {
    setEditingRaffle(null);
    setRaffleForm({
      name: '',
      description: '',
      prizeImageUrl: '',
      startDate: '',
      endDate: '',
      status: 'RASCUNHO',
      totalNumbers: 100,
      startNumber: 1,
      endNumber: 100,
      rules: '',
      organizerUserId: '',
      organizerName: '',
      organizerType: 'USUÁRIO COMUM',
      prizes: [
        { position: 1, name: '', description: '', type: 'PRODUTO', value: '' },
        { position: 2, name: '', description: '', type: 'PRODUTO', value: '' },
        { position: 3, name: '', description: '', type: 'PRODUTO', value: '' }
      ]
    });
    setIsRaffleModalOpen(true);
  };

  // Handle Request Review (Approve/Reject/Request Alteration)
  const handleReviewRequest = async (status: Raffle['status']) => {
    if (!reviewRaffle) return;
    const reviewedRaffle: Raffle = {
      ...reviewRaffle,
      status,
      reviewedBy: 'admin@lockdownprodutora.com.br',
      reviewedAt: new Date().toISOString(),
      reviewReason: reviewReason,
      updatedAt: new Date().toISOString()
    };
    await saveRaffle(reviewedRaffle);
    setIsReviewModalOpen(false);
    setReviewRaffle(null);
    setReviewReason('');
    notify(`Solicitação avaliada com sucesso como: ${status}!`, 'happy');
    loadAllData();
  };

  // Manual allocation trigger
  const triggerManualAllocation = (raffleId: string, numberStr: string) => {
    setSelectedRaffleIdForAllocation(raffleId);
    setSelectedNumberForAllocation(numberStr);
    setAllocateUserId('');
    setAllocateUserName('');
    setAllocateUserPhoto('');
    setIsAllocateModalOpen(true);
  };

  // Save manual number reservation
  const handleSaveManualAllocation = async () => {
    if (!allocateUserId) {
      alert("Selecione um usuário central para vincular este número.");
      return;
    }
    const partId = `part_${selectedRaffleIdForAllocation}_${selectedNumberForAllocation}`;
    const newParticipant: RaffleParticipant = {
      id: partId,
      userId: allocateUserId,
      raffleId: selectedRaffleIdForAllocation,
      number: selectedNumberForAllocation,
      status: 'CONFIRMADO',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveRaffleParticipant(newParticipant);
    setIsAllocateModalOpen(false);
    notify(`Número ${selectedNumberForAllocation} atribuído com sucesso a ${allocateUserName}!`, 'happy');
    loadAllData();
  };

  // Release/Remove number allocation
  const handleReleaseAllocation = async (participantId: string) => {
    if (confirm("Tem certeza de que deseja liberar este número? O participante deixará de possuir este número.")) {
      await deleteRaffleParticipantDoc(participantId);
      notify("Reserva de número liberada com sucesso.", 'normal');
      loadAllData();
    }
  };

  // Mark number as Winner (VENDEDOR)
  const handleToggleWinner = async (part: RaffleParticipant) => {
    const isWinner = part.status === 'VENDEDOR';
    const updated: RaffleParticipant = {
      ...part,
      status: isWinner ? 'CONFIRMADO' : 'VENDEDOR',
      updatedAt: new Date().toISOString()
    };
    await saveRaffleParticipant(updated);
    notify(isWinner ? `Número desmarcado como vencedor.` : `Número ${part.number} consagrado como VENDEDOR! 🏆`, 'happy');
    loadAllData();
  };

  // Filter raffles list
  const filteredRaffles = raffles.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.organizerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Requests list (raffles with status PENDENTE)
  const pendingRequests = raffles.filter(r => r.status === 'PENDENTE');

  // Selected raffle details for numbers grid
  const currentRaffleForGrid = raffles.find(r => r.id === selectedRaffleForGridId);
  const activeParticipantsForGrid = participants.filter(p => p.raffleId === selectedRaffleForGridId);
  const participantsMap = activeParticipantsForGrid.reduce((acc, curr) => {
    acc[curr.number] = curr;
    return acc;
  }, {} as Record<string, RaffleParticipant>);

  return (
    <div className="h-full flex flex-col w-full bg-gray-50 text-black">
      {/* Module Title Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 border-b border-gray-200 max-w-7xl mx-auto w-full px-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToMenu}
            className="flex items-center space-x-1.5 bg-white hover:bg-gray-100 border border-gray-300 px-3 py-1.5 rounded-xl text-xs font-orbitron text-gray-700 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>PAINEL PRINCIPAL</span>
          </button>
          
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-black font-orbitron tracking-tight text-black uppercase">SORTEIOS • GESTÃO DE CAMPANHAS</h2>
              <span className="bg-[#FF0033]/10 text-[#FF0033] px-2 py-0.5 rounded-full text-[9px] font-orbitron font-extrabold tracking-widest uppercase">Módulo 07</span>
            </div>
            <p className="text-[11px] text-gray-500 font-sans mt-0.5">Definição, cadastros, solicitações e atribuição segura de números sem vendas ativas nesta etapa.</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 mt-4 md:mt-0 bg-amber-50 border border-amber-200 px-4 py-2 rounded-2xl">
          <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-[10px] text-amber-800 font-sans leading-snug">
            <strong>Proteção Regulatório-Legal:</strong> PIX, pagamentos e cobranças automáticas estão desativadas.
          </span>
        </div>
      </div>

      {/* Tabs Menu Navigation */}
      <div className="max-w-7xl mx-auto w-full px-4 mb-6">
        <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-2">
          {[
            { id: 'overview', label: 'VISÃO GERAL', icon: Gift },
            { id: 'sorteios', label: 'SORTEIOS', icon: Hash, count: raffles.length },
            { id: 'solicitacoes', label: 'SOLICITAÇÕES', icon: Clock, count: pendingRequests.length, highlight: pendingRequests.length > 0 },
            { id: 'participantes', label: 'PARTICIPANTES', icon: Users, count: participants.length },
            { id: 'numeros', label: 'GRADE DE NÚMEROS', icon: Sliders },
            { id: 'premiacoes', label: 'PREMIAÇÕES', icon: Award },
            { id: 'config', label: 'CONFIGURAÇÕES', icon: Sliders }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  notify(`Aba ${tab.label} aberta.`, 'pointing');
                }}
                className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-orbitron font-bold uppercase transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-[#FF0033] text-white shadow-md shadow-red-500/15' 
                    : 'text-gray-600 hover:text-black hover:bg-gray-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] ${
                    tab.highlight 
                      ? 'bg-amber-500 text-black font-extrabold animate-pulse' 
                      : isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Module Workspace */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-2">
        {isLoading ? (
          <div className="text-center py-24 space-y-3">
            <div className="w-8 h-8 border-4 border-[#FF0033] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <span className="font-orbitron text-xs text-gray-500 animate-pulse block uppercase tracking-widest">Sincronizando com Firestore...</span>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* 1. VISÃO GERAL TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Visual Dashboard Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { label: 'TOTAL DE SORTEIOS', val: totalRaffles, color: 'text-black' },
                    { label: 'CAMPANHAS ATIVAS', val: activeRafflesCount, color: 'text-emerald-600' },
                    { label: 'SOLICITAÇÕES PENDENTES', val: pendingRafflesCount, color: pendingRafflesCount > 0 ? 'text-amber-500' : 'text-gray-500' },
                    { label: 'NÚMEROS ATRIBUÍDOS', val: totalNumbersAssigned, color: 'text-[#FF0033]' }
                  ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between">
                      <span className="text-[10px] text-gray-500 font-orbitron tracking-widest uppercase block font-bold">{stat.label}</span>
                      <h3 className={`font-orbitron font-black text-3xl mt-2 ${stat.color}`}>{stat.val}</h3>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Informações Regulatórias e Segurança */}
                  <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4 text-left">
                    <h4 className="font-orbitron font-black text-sm text-black flex items-center space-x-2">
                      <ShieldAlert className="w-5 h-5 text-[#FF0033]" />
                      <span className="uppercase">Auditoria e Diretrizes de Conformidade</span>
                    </h4>
                    <p className="text-xs text-gray-600 leading-relaxed font-sans">
                      A realização de sorteios e atribuição de números para campanhas promocionais está sujeita a regulamentações estritas da SECAP/MFE no Brasil. 
                      Para manter a integridade jurídica e a segurança corporativa da Lockdown Produtora, os recursos financeiros reais foram intencionalmente omitidos.
                    </p>
                    <div className="space-y-2">
                      {[
                        "Sem integração de gateway de pagamento para compra de cotas nesta etapa.",
                        "Sem saldo ou saques automáticos de valores acumulados.",
                        "Não utiliza a função de randomização vulnerável Math.random() do frontend para sorteio oficial.",
                        "Vínculo exclusivo com a identidade única centralizada do módulo Usuários."
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-start space-x-2 text-[11px] text-gray-700">
                          <span className="text-[#FF0033] font-bold shrink-0">•</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Detalhes de Escalabilidade */}
                  <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4 text-left">
                    <h4 className="font-orbitron font-black text-sm text-black flex items-center space-x-2">
                      <Sliders className="w-5 h-5 text-[#FF0033]" />
                      <span className="uppercase">Estrutura e Escalabilidade da Nuvem</span>
                    </h4>
                    <p className="text-xs text-gray-600 leading-relaxed font-sans">
                      Diferente de sistemas amadores que inserem dezenas de milhares de registros vazios no banco de dados, 
                      a Lockdown implementa uma arquitetura de <strong>Alocação sob Demanda (On-Demand Reservation)</strong>.
                    </p>
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-[11px] text-gray-700 space-y-2">
                      <p><strong>Nenhum documento físico de número livre existe no Firestore.</strong></p>
                      <p>O sistema gera a faixa numérica dinamicamente de 1 a 10.000. Qualquer número que não possua uma atribuição registrada na subcoleção de participantes é renderizado automaticamente como <strong>DISPONÍVEL</strong>.</p>
                      <p>Isso economiza recursos, evita lentidão e protege contra custos abusivos de leitura e gravação na nuvem.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. SORTEIOS TAB */}
            {activeTab === 'sorteios' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex-wrap gap-2">
                  <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 w-full max-w-sm">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar sorteio ou organizador..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="bg-transparent border-none text-xs text-black focus:outline-none w-full"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value as any)}
                      className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-black font-orbitron focus:outline-none"
                    >
                      <option value="ALL">TODOS OS STATUS</option>
                      <option value="RASCUNHO">RASCUNHO</option>
                      <option value="PENDENTE">PENDENTE</option>
                      <option value="APROVADO">APROVADO</option>
                      <option value="PUBLICADO">PUBLICADO</option>
                      <option value="ENCERRADO">ENCERRADO</option>
                      <option value="CANCELADO">CANCELADO</option>
                    </select>

                    <button
                      onClick={openCreateRaffle}
                      className="bg-[#FF0033] hover:bg-[#d6002b] text-white px-4 py-2 rounded-xl text-xs font-orbitron font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-md"
                    >
                      <Plus className="w-4 h-4" />
                      <span>CRIAR SORTEIO</span>
                    </button>
                  </div>
                </div>

                {filteredRaffles.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center space-y-3">
                    <Gift className="w-12 h-12 text-gray-300 mx-auto" />
                    <h3 className="font-orbitron font-bold text-gray-600 text-sm">NENHUM SORTEIO ENCONTRADO</h3>
                    <p className="text-xs text-gray-400">Crie sua primeira campanha oficial utilizando o botão acima.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {filteredRaffles.map((raffle) => {
                      const reservedCount = participants.filter(p => p.raffleId === raffle.id).length;
                      return (
                        <div key={raffle.id} className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden flex flex-col justify-between h-[420px]">
                          {/* Card Header with image */}
                          <div className="h-32 bg-gray-100 relative">
                            {raffle.prizeImageUrl ? (
                              <img src={raffle.prizeImageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-400">
                                <Gift className="w-10 h-10" />
                              </div>
                            )}
                            {/* Status tag */}
                            <div className="absolute top-3 right-3">
                              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-orbitron font-extrabold tracking-widest ${
                                raffle.status === 'PUBLICADO' ? 'bg-emerald-500 text-white' :
                                raffle.status === 'PENDENTE' ? 'bg-amber-500 text-black animate-pulse' :
                                raffle.status === 'APROVADO' ? 'bg-blue-500 text-white' :
                                raffle.status === 'ENCERRADO' ? 'bg-gray-800 text-white' :
                                raffle.status === 'CANCELADO' ? 'bg-[#FF0033] text-white' : 'bg-gray-400 text-white'
                              }`}>
                                {raffle.status}
                              </span>
                            </div>
                          </div>

                          {/* Body details */}
                          <div className="p-5 flex-1 flex flex-col justify-between text-left">
                            <div className="space-y-1">
                              <h4 className="font-orbitron font-black text-sm text-black uppercase line-clamp-1">{raffle.name}</h4>
                              <p className="text-[11px] text-gray-500 font-sans line-clamp-2 leading-relaxed">{raffle.description}</p>
                            </div>

                            <div className="border-t border-b border-gray-100 py-3 my-3 grid grid-cols-2 gap-2 text-[10px] text-gray-600 font-sans">
                              <div>
                                <span className="block text-gray-400 text-[8px] font-orbitron uppercase">ORGANIZADOR</span>
                                <span className="font-bold truncate block">{raffle.organizerName}</span>
                              </div>
                              <div>
                                <span className="block text-gray-400 text-[8px] font-orbitron uppercase">NÚMEROS</span>
                                <span className="font-bold">{raffle.startNumber} a {raffle.endNumber} ({raffle.totalNumbers} total)</span>
                              </div>
                              <div className="mt-1">
                                <span className="block text-gray-400 text-[8px] font-orbitron uppercase">RESERVAS</span>
                                <span className="font-bold text-[#FF0033]">{reservedCount} / {raffle.totalNumbers}</span>
                              </div>
                              <div className="mt-1">
                                <span className="block text-gray-400 text-[8px] font-orbitron uppercase">PERÍODO PREVISTO</span>
                                <span className="font-bold truncate block">{raffle.startDate ? new Date(raffle.startDate).toLocaleDateString('pt-BR') : 'Sem início'} - {raffle.endDate ? new Date(raffle.endDate).toLocaleDateString('pt-BR') : 'Sem fim'}</span>
                              </div>
                            </div>

                            {/* Prizes line */}
                            <div className="space-y-1 text-left">
                              <span className="text-[8px] font-orbitron text-gray-400 uppercase font-bold">1º Prêmio:</span>
                              <span className="text-xs font-bold text-black block truncate">
                                {raffle.prizes?.[0]?.name ? `${raffle.prizes[0].name} (${raffle.prizes[0].type})` : 'Não cadastrado'}
                              </span>
                            </div>
                          </div>

                          {/* Actions Footer */}
                          <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                            <button
                              onClick={() => {
                                setSelectedRaffleForGridId(raffle.id);
                                setActiveTab('numeros');
                              }}
                              className="text-[10px] font-orbitron font-bold text-[#FF0033] hover:text-red-700 hover:underline cursor-pointer flex items-center space-x-1"
                            >
                              <span>VER GRADE</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>

                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => openEditRaffle(raffle)}
                                className="p-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg transition-all cursor-pointer"
                                title="Editar Sorteio"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRaffle(raffle.id)}
                                className="p-1.5 bg-white border border-[#FF0033]/20 hover:bg-red-50 text-[#FF0033] rounded-lg transition-all cursor-pointer"
                                title="Excluir Sorteio"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3. SOLICITAÇÕES TAB */}
            {activeTab === 'solicitacoes' && (
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden text-left">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="font-orbitron font-black text-sm text-black uppercase">Solicitações de Sorteio de Usuários</h3>
                  <p className="text-xs text-gray-500 font-sans mt-1">Aprovação oficial de campanhas promovidas por parceiros homologados.</p>
                </div>

                {pendingRequests.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <Clock className="w-12 h-12 text-gray-300 mx-auto" />
                    <h4 className="font-orbitron font-bold text-gray-600 text-sm">NENHUMA SOLICITAÇÃO PENDENTE</h4>
                    <p className="text-xs text-gray-400">Todos os envios foram auditados e processados pelos gerentes.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-gray-700">
                      <thead className="bg-gray-50 text-[10px] font-orbitron uppercase text-gray-500 tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Sorteio / Prêmio</th>
                          <th className="px-6 py-4">Organizador</th>
                          <th className="px-6 py-4">Total Números</th>
                          <th className="px-6 py-4">Data Envio</th>
                          <th className="px-6 py-4 text-center">Status</th>
                          <th className="px-6 py-4 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-sans">
                        {pendingRequests.map((request) => (
                          <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                                  {request.prizeImageUrl ? (
                                    <img src={request.prizeImageUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <Gift className="w-5 h-5 text-gray-400" />
                                  )}
                                </div>
                                <div className="text-left">
                                  <span className="font-bold text-black block truncate max-w-[180px]">{request.name}</span>
                                  <span className="text-[10px] text-gray-400 block truncate max-w-[180px]">{request.description}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-orbitron font-bold text-black">{request.organizerName}</td>
                            <td className="px-6 py-4">{request.totalNumbers} números</td>
                            <td className="px-6 py-4 text-gray-500">{new Date(request.createdAt).toLocaleDateString('pt-BR')}</td>
                            <td className="px-6 py-4 text-center">
                              <span className="bg-amber-100 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full text-[9px] font-orbitron font-extrabold animate-pulse">
                                {request.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => {
                                  setReviewRaffle(request);
                                  setReviewReason('');
                                  setIsReviewModalOpen(true);
                                }}
                                className="bg-[#FF0033] hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-orbitron font-bold transition-all cursor-pointer shadow-sm"
                              >
                                ANALISAR
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 4. PARTICIPANTES TAB */}
            {activeTab === 'participantes' && (
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden text-left">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="font-orbitron font-black text-sm text-black uppercase">Participações e Números Alocados</h3>
                  <p className="text-xs text-gray-500 font-sans mt-1">Lista centralizada de números vinculados a identidades reais do sistema.</p>
                </div>

                {participants.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <Users className="w-12 h-12 text-gray-300 mx-auto" />
                    <h4 className="font-orbitron font-bold text-gray-600 text-sm">NENHUM NÚMERO ALOCADO</h4>
                    <p className="text-xs text-gray-400">Atribua números manualmente usando a aba "Grade de Números".</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-gray-700">
                      <thead className="bg-gray-50 text-[10px] font-orbitron uppercase text-gray-500 tracking-wider">
                        <tr>
                          <th className="px-6 py-4">Sorteio</th>
                          <th className="px-6 py-4">Número</th>
                          <th className="px-6 py-4">Participante Central</th>
                          <th className="px-6 py-4">Data Vínculo</th>
                          <th className="px-6 py-4 text-center">Status</th>
                          <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-sans">
                        {participants.map((part) => {
                          const associatedRaffle = raffles.find(r => r.id === part.raffleId);
                          const userProfile = centralUsers.find(u => u.id === part.userId);
                          return (
                            <tr key={part.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 font-bold text-black">{associatedRaffle?.name || 'Sorteio Excluído'}</td>
                              <td className="px-6 py-4">
                                <span className="bg-gray-100 font-mono font-black text-[#FF0033] px-2 py-1 rounded-lg border border-gray-200 text-xs">
                                  {part.number}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                                    {userProfile?.photoURL ? (
                                      <img src={userProfile.photoURL} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <Users className="w-4 h-4 text-gray-400" />
                                    )}
                                  </div>
                                  <div className="text-left">
                                    <span className="font-bold text-black block leading-none">{userProfile?.name || 'Inexistente'}</span>
                                    <span className="text-[10px] text-gray-400 block mt-0.5">{userProfile?.email || 'N/D'}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-gray-500">{new Date(part.createdAt).toLocaleDateString('pt-BR')}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-orbitron font-extrabold tracking-widest ${
                                  part.status === 'VENDEDOR' 
                                    ? 'bg-amber-500 text-black border border-amber-300 animate-pulse' 
                                    : 'bg-emerald-100 border border-emerald-200 text-emerald-800'
                                }`}>
                                  {part.status === 'VENDEDOR' ? 'VENCEDOR 🏆' : part.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => handleToggleWinner(part)}
                                  className={`px-2 py-1 rounded-lg text-[9px] font-orbitron font-bold transition-all cursor-pointer flex items-center space-x-1 border ${
                                    part.status === 'VENDEDOR'
                                      ? 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                      : 'bg-amber-500/10 border-amber-400 text-amber-700 hover:bg-amber-500 hover:text-black shadow-sm'
                                  }`}
                                  title="Marcar como Vencedor"
                                >
                                  <Award className="w-3.5 h-3.5" />
                                  <span>{part.status === 'VENDEDOR' ? 'REMOVER PRÊMIO' : 'DEFINIR VENCEDOR'}</span>
                                </button>
                                <button
                                  onClick={() => handleReleaseAllocation(part.id)}
                                  className="p-1.5 bg-white border border-gray-200 text-[#FF0033] hover:bg-red-50 hover:border-red-200 rounded-lg transition-all cursor-pointer"
                                  title="Liberar Número"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 5. GRADE DE NÚMEROS TAB */}
            {activeTab === 'numeros' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-5 rounded-2xl border border-gray-200 shadow-sm gap-4 text-left">
                  <div className="space-y-1">
                    <span className="text-[9px] font-orbitron text-[#FF0033] tracking-wider block font-bold">SELECIONAR CAMPANHA ATIVA</span>
                    <select
                      value={selectedRaffleForGridId}
                      onChange={e => {
                        setSelectedRaffleForGridId(e.target.value);
                        setNumbersPage(0);
                      }}
                      className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-black font-orbitron focus:outline-none focus:border-[#FF0033] w-full md:w-80"
                    >
                      {raffles.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.totalNumbers} números)</option>
                      ))}
                    </select>
                  </div>

                  {currentRaffleForGrid && (
                    <div className="flex flex-wrap items-center gap-3 md:self-end">
                      <div className="flex items-center space-x-1.5 text-[10px] font-orbitron font-bold">
                        <span className="w-3 h-3 rounded bg-white border border-gray-300"></span>
                        <span className="text-gray-500">LIVRES</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-[10px] font-orbitron font-bold">
                        <span className="w-3 h-3 rounded bg-emerald-500"></span>
                        <span className="text-emerald-600">CONFIRMADOS</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-[10px] font-orbitron font-bold">
                        <span className="w-3 h-3 rounded bg-amber-500 animate-pulse"></span>
                        <span className="text-amber-600">VENDEDORES (PRÊMIO)</span>
                      </div>
                    </div>
                  )}
                </div>

                {!currentRaffleForGrid ? (
                  <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center">
                    <Hash className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-xs text-gray-400">Por favor, crie uma campanha na aba "Sorteios" para inspecionar a grade de números.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-6 text-left">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                      <div>
                        <h4 className="font-orbitron font-black text-sm text-black uppercase">{currentRaffleForGrid.name}</h4>
                        <span className="text-[10px] text-gray-500 font-sans mt-1 block">
                          Visualizando números {numbersPage * NUMBERS_PER_PAGE + currentRaffleForGrid.startNumber} até {Math.min((numbersPage + 1) * NUMBERS_PER_PAGE, currentRaffleForGrid.endNumber)}
                        </span>
                      </div>

                      {/* Pagination buttons */}
                      {currentRaffleForGrid.totalNumbers > NUMBERS_PER_PAGE && (
                        <div className="flex items-center space-x-2">
                          <button
                            disabled={numbersPage === 0}
                            onClick={() => setNumbersPage(prev => Math.max(0, prev - 1))}
                            className="p-1.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 text-xs font-bold"
                          >
                            Anterior
                          </button>
                          <span className="text-xs font-orbitron font-bold">
                            PÁG {numbersPage + 1} DE {Math.ceil(currentRaffleForGrid.totalNumbers / NUMBERS_PER_PAGE)}
                          </span>
                          <button
                            disabled={(numbersPage + 1) * NUMBERS_PER_PAGE >= currentRaffleForGrid.totalNumbers}
                            onClick={() => setNumbersPage(prev => prev + 1)}
                            className="p-1.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 text-xs font-bold"
                          >
                            Próxima
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Scale Dynamic Number Renderer */}
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                      {Array.from({ length: Math.min(NUMBERS_PER_PAGE, currentRaffleForGrid.endNumber - (numbersPage * NUMBERS_PER_PAGE)) }).map((_, index) => {
                        const actualNum = numbersPage * NUMBERS_PER_PAGE + index + currentRaffleForGrid.startNumber;
                        const numStr = String(actualNum).padStart(4, '0');
                        const associatedPart = participantsMap[numStr];

                        const isAllocated = !!associatedPart;
                        const isWinner = associatedPart?.status === 'VENDEDOR';

                        return (
                          <button
                            key={numStr}
                            onClick={() => {
                              if (isAllocated) {
                                if (confirm(`Número ${numStr} está alocado para ${centralUsers.find(u => u.id === associatedPart.userId)?.name || 'outro usuário'}. Deseja remover este vínculo?`)) {
                                  handleReleaseAllocation(associatedPart.id);
                                }
                              } else {
                                triggerManualAllocation(currentRaffleForGrid.id, numStr);
                              }
                            }}
                            className={`p-3 rounded-2xl font-mono text-xs font-black border text-center transition-all flex flex-col justify-center items-center h-16 relative cursor-pointer group hover:scale-105 hover:shadow-md ${
                              isWinner 
                                ? 'bg-amber-500 border-amber-400 text-black shadow-md shadow-amber-500/20 animate-pulse' 
                                : isAllocated 
                                ? 'bg-emerald-500 border-emerald-400 text-white' 
                                : 'bg-white border-gray-200 text-gray-700 hover:border-[#FF0033]'
                            }`}
                          >
                            <span className="text-sm block">{numStr}</span>
                            
                            {isAllocated && (
                              <span className="text-[7px] font-sans truncate max-w-full block font-normal opacity-90 mt-0.5">
                                {centralUsers.find(u => u.id === associatedPart.userId)?.name || 'Vago'}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 6. PREMIAÇÕES TAB */}
            {activeTab === 'premiacoes' && (
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 text-left space-y-6">
                <div>
                  <h3 className="font-orbitron font-black text-sm text-black uppercase">Visão Unificada de Premiações</h3>
                  <p className="text-xs text-gray-500 font-sans mt-1">Quadro unificado de prêmios cadastrados nas campanhas da Lockdown.</p>
                </div>

                {raffles.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Award className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <span>Nenhum prêmio configurado ainda.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {raffles.map(r => (
                      <div key={r.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-3">
                        <h4 className="font-orbitron font-bold text-xs text-black uppercase border-b border-gray-200 pb-2">
                          {r.name}
                        </h4>
                        
                        <div className="space-y-2">
                          {r.prizes?.map((prize, idx) => (
                            <div key={idx} className="flex items-start justify-between text-xs bg-white p-3 rounded-xl border border-gray-100">
                              <div className="flex items-center space-x-3 text-left">
                                {prize.imageUrl ? (
                                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-50 border shrink-0 flex items-center justify-center">
                                    <img src={prize.imageUrl} alt="" className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-gray-50 border border-dashed border-gray-300 shrink-0 flex items-center justify-center text-gray-400">
                                    <Gift className="w-5 h-5" />
                                  </div>
                                )}
                                <div className="space-y-1">
                                  <span className="bg-gray-100 font-orbitron font-black text-[#FF0033] px-2 py-0.5 rounded text-[8px] inline-block">
                                    {prize.position}º PRÊMIO
                                  </span>
                                  <h5 className="font-bold text-black">{prize.name || 'Prêmio não especificado'}</h5>
                                  <p className="text-[10px] text-gray-500">{prize.description || 'Sem descrição'}</p>
                                </div>
                              </div>

                              <div className="text-right flex flex-col justify-between h-full self-stretch shrink-0">
                                <span className="text-[10px] font-orbitron text-gray-500 block uppercase tracking-wider">{prize.type}</span>
                                {prize.type === 'VALOR FINANCEIRO' && (
                                  <span className="text-xs font-orbitron font-black text-emerald-600 block mt-1">{prize.value || 'R$ 0,00'}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 7. CONFIGURAÇÕES TAB */}
            {activeTab === 'config' && (
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 text-left space-y-6 max-w-2xl">
                <div>
                  <h3 className="font-orbitron font-black text-sm text-black uppercase">Configurações de Sorteios</h3>
                  <p className="text-xs text-gray-500 font-sans mt-1">Parâmetros operacionais e diretrizes para prevenção de riscos.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-orbitron font-bold text-gray-500 block">LIMITE DE NÚMEROS POR CAMPANHA</label>
                    <input
                      type="number"
                      defaultValue={10000}
                      disabled
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-black focus:outline-none cursor-not-allowed"
                    />
                    <span className="text-[9px] text-gray-400 font-sans block">Limite estático recomendado para prevenir sobrecarga de leitura e custo de infraestrutura.</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-orbitron font-bold text-gray-500 block">DURABILIDADE MÁXIMA DA CAMPANHA (DIAS)</label>
                    <input
                      type="number"
                      defaultValue={90}
                      disabled
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-black focus:outline-none cursor-not-allowed"
                    />
                    <span className="text-[9px] text-gray-400 font-sans block">Limite estipulado para encerramento automático em caso de inatividade.</span>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2">
                    <h5 className="font-orbitron font-bold text-xs text-[#FF0033] uppercase">Aviso Legal Importante</h5>
                    <p className="text-[10px] text-gray-600 leading-relaxed font-sans">
                      A Lockdown Produtora não endossa nem executa arrecadações de capitais sem regulamentação da SEAE/SRE. 
                      A ativação de vendas diretas depende de certificado de autorização, e qualquer comercialização efetuada na plataforma 
                      em desacordo com a Lei nº 5.768/71 é expressamente vedada.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* MODAL 1: ADD / EDIT RAFFLE */}
      <AnimatePresence>
        {isRaffleModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border-2 border-gray-200 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden"
            >
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h4 className="font-orbitron font-black text-black">
                  {editingRaffle ? `EDITAR SORTEIO: ${editingRaffle.name}` : 'NOVO SORTEIO'}
                </h4>
                <button onClick={() => setIsRaffleModalOpen(false)} className="text-gray-500 hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRaffle} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-left">
                
                {/* Visual Section: Capa e Informações Básicas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-orbitron font-bold text-gray-500 block mb-1">NOME DA CAMPANHA *</label>
                      <input
                        type="text"
                        value={raffleForm.name}
                        onChange={e => setRaffleForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                        required
                        placeholder="Ex: Sorteio do Moletom Lockdown Tático"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-orbitron font-bold text-gray-500 block mb-1">DESCRIÇÃO DA CAMPANHA *</label>
                      <textarea
                        value={raffleForm.description}
                        onChange={e => setRaffleForm(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none h-20"
                        required
                        placeholder="Insira os detalhes do sorteio e regulamento básico..."
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-orbitron font-bold text-gray-500 block mb-1">IMAGEM DE CAPA DO SORTEIO *</label>
                      {raffleForm.prizeImageUrl ? (
                        <div className="space-y-2">
                          <div className="relative w-full h-32 bg-zinc-950 border border-white/10 rounded-xl overflow-hidden flex items-center justify-center">
                            <img src={raffleForm.prizeImageUrl} alt="Preview" className="w-full h-full object-contain" />
                            <div className="absolute top-2 right-2 flex space-x-1.5">
                              <label className="bg-black/80 hover:bg-black text-white px-2.5 py-1 rounded-lg text-[9px] font-orbitron font-bold tracking-wider cursor-pointer border border-white/10">
                                SUBSTITUIR
                                <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleMainImageUpload} disabled={isUploadingMain} className="hidden" />
                              </label>
                              <button
                                type="button"
                                onClick={() => setRaffleForm(prev => ({ ...prev, prizeImageUrl: '' }))}
                                className="bg-[#FF0033]/80 hover:bg-[#FF0033] text-white px-2.5 py-1 rounded-lg text-[9px] font-orbitron font-bold tracking-wider cursor-pointer border border-[#FF0033]/30"
                              >
                                REMOVER
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className={`w-full bg-zinc-900 hover:bg-zinc-800 text-white font-orbitron font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 border border-white/10 cursor-pointer shadow-md transition-all ${isUploadingMain ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <Upload className="w-4 h-4 text-[#FF0033]" />
                            <span>{isUploadingMain ? 'ENVIANDO...' : 'ENVIAR IMAGEM'}</span>
                            <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleMainImageUpload} disabled={isUploadingMain} className="hidden" />
                          </label>
                          <p className="text-[9px] text-gray-400 font-sans">Formatos suportados: PNG, JPG, JPEG, WEBP.</p>
                        </div>
                      )}

                      {isUploadingMain && (
                        <div className="w-full space-y-1 bg-zinc-900 border border-white/5 rounded-xl p-2.5 mt-2">
                          <div className="flex items-center justify-between text-[9px] font-orbitron font-bold">
                            <span className="text-gray-400">Enviando imagem...</span>
                            <span className="text-[#FF0033]">{mainUploadProgress}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-black rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#FF0033] transition-all duration-300" 
                              style={{ width: `${mainUploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-orbitron font-bold text-gray-500 block mb-1">DATA INÍCIO</label>
                        <input
                          type="date"
                          value={raffleForm.startDate}
                          onChange={e => setRaffleForm(prev => ({ ...prev, startDate: e.target.value }))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-orbitron font-bold text-gray-500 block mb-1">DATA ENCERRAMENTO</label>
                        <input
                          type="date"
                          value={raffleForm.endDate}
                          onChange={e => setRaffleForm(prev => ({ ...prev, endDate: e.target.value }))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-orbitron font-bold text-gray-500 block mb-1">QUANTIDADE NÚMEROS *</label>
                        <input
                          type="number"
                          value={raffleForm.totalNumbers}
                          onChange={e => {
                            const total = Number(e.target.value);
                            setRaffleForm(prev => ({ 
                              ...prev, 
                              totalNumbers: total,
                              endNumber: (prev.startNumber || 1) + total - 1
                            }));
                          }}
                          min={10}
                          max={10000}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-orbitron font-bold text-gray-500 block mb-1">STATUS</label>
                        <select
                          value={raffleForm.status}
                          onChange={e => setRaffleForm(prev => ({ ...prev, status: e.target.value as any }))}
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                        >
                          <option value="RASCUNHO">RASCUNHO</option>
                          <option value="PENDENTE">PENDENTE</option>
                          <option value="APROVADO">APROVADO</option>
                          <option value="PUBLICADO">PUBLICADO</option>
                          <option value="ENCERRADO">ENCERRADO</option>
                          <option value="CANCELADO">CANCELADO</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-orbitron font-bold text-gray-500 block mb-1">REGRAS DE PARTICIPAÇÃO</label>
                      <textarea
                        value={raffleForm.rules}
                        onChange={e => setRaffleForm(prev => ({ ...prev, rules: e.target.value }))}
                        className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none h-16"
                        placeholder="Ex: Seguir perfil Lockdown, se inscrever na League..."
                      />
                    </div>
                  </div>
                </div>

                {/* Organizador - Autocomplete Central */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                  <PersonSelectAutocomplete
                    label="ORGANIZADOR RESPONSÁVEL (DADOS CENTRAIS) *"
                    required
                    selectedUserId={raffleForm.organizerUserId}
                    selectedUserName={raffleForm.organizerName}
                    selectedUserPhoto={raffleForm.organizerPhoto}
                    onSelectPerson={(person) => {
                      setRaffleForm(prev => ({
                        ...prev,
                        organizerUserId: person.id || person.uid || '',
                        organizerName: person.name,
                        organizerPhoto: person.photoURL || '',
                        organizerType: (person.role === 'ARTISTA' ? 'ARTISTA' : person.role === 'PRODUTORA' ? 'PRODUTORA' : person.role === 'EMPRESA' ? 'EMPRESA' : 'USUÁRIO COMUM') as any
                      }));
                    }}
                  />
                  {raffleForm.organizerUserId && (
                    <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200">
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 border shrink-0">
                        <img src={raffleForm.organizerPhoto || ''} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-[10px] text-gray-700">
                        Identidade Sincronizada: <strong className="text-black">{raffleForm.organizerName}</strong> | Tipo: <strong className="text-[#FF0033] uppercase">{raffleForm.organizerType}</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Prizes definition segment */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                  <span className="text-[10px] font-orbitron font-bold text-black block uppercase">Configuração das Premiações (1º, 2º e 3º Colocados)</span>
                  
                  <div className="space-y-3 divide-y divide-gray-200 pt-1">
                    {[0, 1, 2].map((index) => {
                      const prize = raffleForm.prizes?.[index] || { position: index + 1, name: '', description: '', type: 'PRODUTO', value: '' };
                      return (
                        <div key={index} className={`pt-3 ${index === 0 ? '' : 'mt-2'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-orbitron font-black text-[10px] text-[#FF0033]">
                              {index + 1}º COLOCADO (PRÊMIO)
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <div className="md:col-span-2">
                              <input
                                type="text"
                                value={prize.name}
                                onChange={e => handlePrizeChange(index, 'name', e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-black focus:outline-none"
                                placeholder="Ex: Moto Yamaha Factor 150"
                              />
                            </div>
                            <div>
                              <select
                                value={prize.type}
                                onChange={e => handlePrizeChange(index, 'type', e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-black focus:outline-none"
                              >
                                <option value="PRODUTO">PRODUTO</option>
                                <option value="BENEFÍCIO">BENEFÍCIO</option>
                                <option value="VALOR FINANCEIRO">VALOR FINANCEIRO</option>
                              </select>
                            </div>
                            <div>
                              <input
                                type="text"
                                value={prize.value || ''}
                                disabled={prize.type !== 'VALOR FINANCEIRO'}
                                onChange={e => handlePrizeChange(index, 'value', e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-black focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                                placeholder="Valor se dinheiro. Ex: R$ 1.500,00"
                              />
                            </div>
                          </div>
                          
                          <div className="mt-2">
                            <input
                              type="text"
                              value={prize.description || ''}
                              onChange={e => handlePrizeChange(index, 'description', e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none"
                              placeholder="Breve descrição ou detalhe específico deste prêmio..."
                            />
                          </div>

                          {/* Imagem do Prêmio */}
                          <div className="mt-2 flex items-center space-x-3 bg-white p-2.5 rounded-xl border border-gray-100">
                            {prize.imageUrl ? (
                              <div className="relative w-12 h-12 bg-gray-100 border border-gray-200 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                                <img src={prize.imageUrl} alt="" className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => handlePrizeChange(index, 'imageUrl', '')}
                                  className="absolute top-0.5 right-0.5 bg-black/70 hover:bg-black text-white p-0.5 rounded-md"
                                  title="Remover Imagem"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="w-12 h-12 bg-gray-50 border border-dashed border-gray-300 rounded-lg shrink-0 flex items-center justify-center text-gray-400">
                                <Gift className="w-5 h-5" />
                              </div>
                            )}

                            <div className="flex-1">
                              {prize.imageUrl ? (
                                <div className="flex items-center space-x-2">
                                  <label className="bg-[#FF0033]/10 hover:bg-[#FF0033]/20 text-[#FF0033] px-2.5 py-1 rounded-lg text-[9px] font-orbitron font-black tracking-wider cursor-pointer border border-[#FF0033]/10">
                                    SUBSTITUIR FOTO
                                    <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={(e) => handlePrizeImageUpload(index, e)} disabled={uploadingPrizes[index]} className="hidden" />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handlePrizeChange(index, 'imageUrl', '')}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-lg text-[9px] font-orbitron font-bold tracking-wider border border-gray-200"
                                  >
                                    REMOVER
                                  </button>
                                </div>
                              ) : (
                                <label className={`bg-black hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg text-[9px] font-orbitron font-bold tracking-wider cursor-pointer flex items-center space-x-1 w-fit border border-gray-200 ${uploadingPrizes[index] ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                  <Upload className="w-3 h-3 text-[#FF0033]" />
                                  <span>{uploadingPrizes[index] ? 'ENVIANDO...' : 'ENVIAR IMAGEM DO PRÊMIO'}</span>
                                  <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={(e) => handlePrizeImageUpload(index, e)} disabled={uploadingPrizes[index]} className="hidden" />
                                </label>
                              )}
                              
                              {uploadingPrizes[index] && (
                                <div className="w-full mt-1.5 space-y-0.5">
                                  <div className="flex items-center justify-between text-[8px] font-orbitron font-bold">
                                    <span className="text-gray-500">Enviando prêmio...</span>
                                    <span className="text-[#FF0033]">{prizesUploadProgress[index]}%</span>
                                  </div>
                                  <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-[#FF0033] transition-all duration-300" 
                                      style={{ width: `${prizesUploadProgress[index]}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsRaffleModalOpen(false)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-xl text-xs font-orbitron font-bold text-gray-700 cursor-pointer"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#FF0033] hover:bg-red-700 text-white rounded-xl text-xs font-orbitron font-bold shadow-md cursor-pointer"
                  >
                    SALVAR SORTEIO
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: ANALYZE / REVIEW REQUEST */}
      <AnimatePresence>
        {isReviewModalOpen && reviewRaffle && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border-2 border-gray-200 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4 text-left"
            >
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <h4 className="font-orbitron font-black text-black">AVALIAÇÃO DE CAMPANHA</h4>
                <button onClick={() => setIsReviewModalOpen(false)} className="text-gray-500 hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-2">
                <span className="text-[9px] font-orbitron text-gray-400 block uppercase">SOLICITAÇÃO ENVIADA POR:</span>
                <span className="font-orbitron font-bold text-xs text-black block">{reviewRaffle.organizerName} ({reviewRaffle.organizerType})</span>
                <span className="text-xs text-gray-700 block">Campanha: <strong className="text-black">{reviewRaffle.name}</strong></span>
                <span className="text-xs text-gray-500 block italic">"{reviewRaffle.description}"</span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-orbitron font-bold text-gray-500 block">MOTIVO OU FEEDBACK (OPCIONAL)</label>
                <textarea
                  value={reviewReason}
                  onChange={e => setReviewReason(e.target.value)}
                  placeholder="Explique o motivo de aprovação, alteração sugerida ou recusa técnica..."
                  className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none h-20"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between pt-4 border-t border-gray-100 gap-2">
                <button
                  onClick={() => handleReviewRequest('CANCELADO')}
                  className="px-4 py-2 bg-red-50 text-[#FF0033] border border-[#FF0033]/20 hover:bg-red-100 rounded-xl text-xs font-orbitron font-bold cursor-pointer"
                >
                  REJEITAR
                </button>
                <button
                  onClick={() => handleReviewRequest('RASCUNHO')}
                  className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-xl text-xs font-orbitron font-bold cursor-pointer"
                >
                  SOLICITAR AJUSTES
                </button>
                <button
                  onClick={() => handleReviewRequest('APROVADO')}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-orbitron font-bold shadow-md cursor-pointer"
                >
                  APROVAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: MANUAL NUMBER ALLOCATION */}
      <AnimatePresence>
        {isAllocateModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border-2 border-gray-200 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4 text-left"
            >
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <h4 className="font-orbitron font-black text-black flex items-center space-x-2">
                  <Hash className="w-4 h-4 text-[#FF0033]" />
                  <span>ATRIBUIR NÚMERO MANUALMENTE</span>
                </h4>
                <button onClick={() => setIsAllocateModalOpen(false)} className="text-gray-500 hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-[#FF0033]/5 p-4 rounded-2xl border border-[#FF0033]/15 text-left space-y-1">
                <span className="text-[10px] font-orbitron text-gray-500 block uppercase">NÚMERO DA COTA SELECIONADO</span>
                <span className="font-mono font-black text-2xl text-[#FF0033]">{selectedNumberForAllocation}</span>
              </div>

              <div className="space-y-3">
                <PersonSelectAutocomplete
                  label="BUSCAR PARTICIPANTE CENTRAL *"
                  required
                  selectedUserId={allocateUserId}
                  selectedUserName={allocateUserName}
                  selectedUserPhoto={allocateUserPhoto}
                  onSelectPerson={(person) => {
                    setAllocateUserId(person.id || person.uid || '');
                    setAllocateUserName(person.name);
                    setAllocateUserPhoto(person.photoURL || '');
                  }}
                />

                {allocateUserId && (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 border shrink-0">
                      <img src={allocateUserPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <span className="text-[10px] text-gray-700 font-bold">{allocateUserName} vinculado com sucesso!</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setIsAllocateModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-xl text-xs font-orbitron font-bold text-gray-700 cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  onClick={handleSaveManualAllocation}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-orbitron font-bold shadow-md cursor-pointer"
                >
                  CONFIRMAR NÚMERO
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
