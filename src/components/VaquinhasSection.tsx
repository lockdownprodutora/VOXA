import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, 
  Plus, 
  Search, 
  Share2, 
  CheckCircle, 
  X, 
  Target, 
  Users, 
  Sparkles, 
  ShieldCheck, 
  Calendar,
  DollarSign,
  TrendingUp,
  Award,
  Upload,
  Image as ImageIcon,
  Trash2,
  Edit,
  AlertCircle,
  RefreshCw,
  Clock,
  ExternalLink,
  BarChart3
} from 'lucide-react';
import { Fundraiser, FundraiserContribution, PublicCategoryItem } from '../types';
import { fetchFundraisers, saveFundraiser, deleteFundraiser, contributeFundraiser, fetchPublicCategories, fetchFundraiserContributions } from '../utils/storeDb';
import { uploadFile } from '../utils/upload';
import { formatBRL } from '../utils/money';
import { FundraisingAnalyticsDashboard } from './FundraisingAnalyticsDashboard';

interface VaquinhasSectionProps {
  currentUser: any;
  triggerToast: (msg: string) => void;
  onVisitProfile?: (username: string) => void;
}

const DEFAULT_VAQUINHA_COVER = 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb9?auto=format&fit=crop&q=80&w=800';

export const VaquinhasSection: React.FC<VaquinhasSectionProps> = ({ 
  currentUser, 
  triggerToast,
  onVisitProfile 
}) => {
  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([]);
  const [contributions, setContributions] = useState<FundraiserContribution[]>([]);
  const [categories, setCategories] = useState<PublicCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'destaques' | 'recentes' | 'apoiadas' | 'meta' | 'metricas'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingFundraiser, setEditingFundraiser] = useState<Fundraiser | null>(null);
  const [selectedFundraiser, setSelectedFundraiser] = useState<Fundraiser | null>(null);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [contribAmount, setContribAmount] = useState('50');
  const [contribPaymentMethod, setContribPaymentMethod] = useState<'wallet' | 'pix'>('wallet');
  const [isContributing, setIsContributing] = useState(false);

  // New fundraiser form fields
  const [newTitle, setNewTitle] = useState('');
  const [newCoverUrl, setNewCoverUrl] = useState('');
  const [newShortDesc, setNewShortDesc] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newGoalAmount, setNewGoalAmount] = useState('5000');
  const [newCategoryId, setNewCategoryId] = useState('solidariedade');
  const [newEndsAt, setNewEndsAt] = useState('');
  const [newShowOnProfile, setNewShowOnProfile] = useState(true);
  const [newAllowSharing, setNewAllowSharing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Upload states (Create)
  const [createCoverPreview, setCreateCoverPreview] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Upload states (Edit)
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [isUploadingEditCover, setIsUploadingEditCover] = useState(false);
  const [isDraggingEditCover, setIsDraggingEditCover] = useState(false);
  const [editUploadProgress, setEditUploadProgress] = useState(0);
  const [editUploadStatus, setEditUploadStatus] = useState<string | null>(null);
  const [editUploadError, setEditUploadError] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async () => {
    try {
      const [list, cats, contribs] = await Promise.all([
        fetchFundraisers(),
        fetchPublicCategories(),
        fetchFundraiserContributions()
      ]);
      
      const params = new URLSearchParams(window.location.search);
      const userFilter = params.get('user');
      
      let filtered = list.filter(f => f.status === 'ACTIVE' || f.status === 'COMPLETED');
      if (userFilter) {
        filtered = filtered.filter(f => 
          (f.ownerUsername || '').toLowerCase() === userFilter.toLowerCase() || 
          (f.ownerUid || '').toLowerCase() === userFilter.toLowerCase()
        );
      }
      
      setFundraisers(filtered);
      setCategories(cats);
      setContributions(contribs || []);
    } catch (err) {
      console.warn("Error loading fundraisers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Shared file processing for Create Cover
  const processCoverFile = async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Formato inválido. Use JPG, JPEG, PNG ou WEBP.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setUploadError('A imagem não pode ultrapassar 15MB.');
      return;
    }

    setUploadError(null);
    const previewUrl = URL.createObjectURL(file);
    setCreateCoverPreview(previewUrl);
    setIsUploadingCover(true);
    setUploadProgress(15);
    setUploadStatus('Enviando capa — 15%');

    try {
      const res = await uploadFile(
        file,
        'cover',
        (p) => {
          const prog = Math.max(15, p.percentage);
          setUploadProgress(prog);
          setUploadStatus(prog < 100 ? `Enviando capa — ${prog}%` : 'Finalizando processamento...');
        }
      );

      if (res && res.url) {
        setUploadProgress(100);
        setUploadStatus('Capa enviada com sucesso!');
        setNewCoverUrl(res.url);
      } else {
        throw new Error('Falha ao obter URL permanente da imagem.');
      }
    } catch (err: any) {
      console.error('[VaquinhasSection] Erro no upload da capa:', err);
      setUploadError(err.message || 'Falha ao enviar imagem. Tente novamente.');
      setCreateCoverPreview(null);
      setNewCoverUrl('');
    } finally {
      setIsUploadingCover(false);
    }
  };

  // Cover upload for Create Modal (File Input)
  const handleCoverFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await processCoverFile(file);
  };

  // Shared file processing for Edit Cover
  const processEditCoverFile = async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setEditUploadError('Formato inválido. Use JPG, JPEG, PNG ou WEBP.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setEditUploadError('A imagem não pode ultrapassar 15MB.');
      return;
    }

    setEditUploadError(null);
    const previewUrl = URL.createObjectURL(file);
    setEditCoverPreview(previewUrl);
    setIsUploadingEditCover(true);
    setEditUploadProgress(15);
    setEditUploadStatus('Enviando capa — 15%');

    try {
      const res = await uploadFile(
        file,
        'cover',
        (p) => {
          const prog = Math.max(15, p.percentage);
          setEditUploadProgress(prog);
          setEditUploadStatus(prog < 100 ? `Enviando capa — ${prog}%` : 'Finalizando processamento...');
        }
      );

      if (res && res.url) {
        setEditUploadProgress(100);
        setEditUploadStatus('Capa atualizada com sucesso!');
        setEditCoverUrl(res.url);
      } else {
        throw new Error('Falha ao obter URL da imagem.');
      }
    } catch (err: any) {
      console.error('[VaquinhasSection] Erro no upload da capa na edição:', err);
      setEditUploadError(err.message || 'Falha ao enviar imagem.');
      setEditCoverPreview(null);
    } finally {
      setIsUploadingEditCover(false);
    }
  };

  // Cover upload for Edit Modal (File Input)
  const handleEditCoverFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await processEditCoverFile(file);
  };

  const handleCreateFundraiser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Você precisa estar conectado para criar uma vaquinha.");
      return;
    }
    if (isUploadingCover) {
      alert("Aguarde a conclusão do envio da capa da vaquinha antes de salvar.");
      return;
    }
    if (!newTitle.trim() || !newGoalAmount) {
      alert("Preencha o título e a meta de arrecadação.");
      return;
    }

    setIsSaving(true);
    try {
      const id = `fund_${Date.now()}`;
      const slug = newTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      const finalCover = newCoverUrl || DEFAULT_VAQUINHA_COVER;

      const newFundraiser: Fundraiser = {
        id,
        ownerUid: currentUser.uid || currentUser.id || currentUser.email,
        ownerName: currentUser.name || "Membro VOXA",
        ownerUsername: currentUser.username || currentUser.slug || 'membro',
        ownerAvatar: currentUser.photoURL || currentUser.avatarUrl || '',
        title: newTitle.trim(),
        slug: `${slug}-${Date.now().toString().slice(-4)}`,
        coverUrl: finalCover,
        shortDescription: newShortDesc.trim(),
        description: newDescription.trim(),
        goalAmount: parseFloat(newGoalAmount) || 1000,
        raisedAmount: 0,
        status: 'ACTIVE',
        categoryId: newCategoryId,
        showOnProfile: newShowOnProfile,
        allowSharing: newAllowSharing,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        endsAt: newEndsAt || undefined,
        supporterCount: 0
      };

      await saveFundraiser(newFundraiser);
      triggerToast('Vaquinha criada com sucesso! ❤️');
      setShowCreateModal(false);
      // Reset form
      setNewTitle('');
      setNewCoverUrl('');
      setCreateCoverPreview(null);
      setUploadStatus(null);
      setUploadError(null);
      setNewShortDesc('');
      setNewDescription('');
      setNewGoalAmount('5000');
      loadData();
    } catch (err: any) {
      alert('Erro ao criar vaquinha: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEditedFundraiser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFundraiser) return;
    if (isUploadingEditCover) {
      alert("Aguarde a conclusão do envio da capa antes de salvar.");
      return;
    }

    setIsSaving(true);
    try {
      const updated: Fundraiser = {
        ...editingFundraiser,
        coverUrl: editCoverUrl || editingFundraiser.coverUrl || DEFAULT_VAQUINHA_COVER,
        updatedAt: new Date().toISOString()
      };
      await saveFundraiser(updated);
      triggerToast('Vaquinha atualizada com sucesso!');
      setEditingFundraiser(null);
      if (selectedFundraiser?.id === updated.id) {
        setSelectedFundraiser(updated);
      }
      loadData();
    } catch (err: any) {
      alert('Erro ao atualizar vaquinha: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFundraiser = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta vaquinha permanentemente?")) return;
    try {
      await deleteFundraiser(id);
      triggerToast('Vaquinha excluída.');
      setEditingFundraiser(null);
      setSelectedFundraiser(null);
      loadData();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Você precisa estar conectado para contribuir.");
      return;
    }
    if (!selectedFundraiser) return;
    const val = parseFloat(contribAmount);
    if (!val || val <= 0) {
      alert("Insira um valor válido de contribuição.");
      return;
    }

    setIsContributing(true);
    try {
      await contributeFundraiser({
        fundraiserId: selectedFundraiser.id,
        contributorId: currentUser.uid || currentUser.id || currentUser.email,
        contributorName: currentUser.name || "Apoiador VOXA",
        amount: val,
        paymentMethod: contribPaymentMethod
      });
      triggerToast(`Contribuição de ${formatBRL(val)} realizada com sucesso! ❤️`);
      setShowContributeModal(false);
      setSelectedFundraiser(null);
      loadData();
    } catch (err: any) {
      alert('Erro ao processar contribuição: ' + err.message);
    } finally {
      setIsContributing(false);
    }
  };

  const isUserOwnerOrAdmin = (f: Fundraiser) => {
    if (!currentUser) return false;
    const uid = currentUser.uid || currentUser.id || currentUser.email;
    const isAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMINISTRATOR' || currentUser.isAdmin;
    return isAdmin || f.ownerUid === uid || (f.ownerUsername && f.ownerUsername === currentUser.username);
  };

  const filteredFundraisers = fundraisers.filter(f => {
    const matchesSearch = searchQuery === '' || 
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.ownerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.ownerUsername?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCat = selectedCategory === 'all' || f.categoryId === selectedCategory;

    if (!matchesSearch || !matchesCat) return false;

    if (activeTab === 'destaques') return f.raisedAmount > (f.goalAmount * 0.5);
    if (activeTab === 'recentes') return true;
    if (activeTab === 'apoiadas') return (f.supporterCount || 0) > 0;
    if (activeTab === 'meta') return f.raisedAmount >= f.goalAmount;
    return true;
  });

  return (
    <div className="space-y-8 animate-fadeIn text-left">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        onChange={handleCoverFileSelected}
      />
      <input
        ref={editFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
        onChange={handleEditCoverFileSelected}
      />

      {/* Hero Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-red-950/40 via-purple-950/40 to-indigo-950/40 border border-white/10 p-8 md:p-12 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center space-x-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/20 text-xs font-orbitron font-bold text-white">
            <Sparkles className="w-3.5 h-3.5 text-red-400" />
            <span>VOXA CROWDFUNDING</span>
          </div>
          <h1 className="font-orbitron font-black text-3xl md:text-5xl text-white tracking-tight">
            Vaquinhas & Campanhas
          </h1>
          <p className="text-gray-300 text-sm md:text-base font-sans leading-relaxed">
            Apoie causas, projetos artísticos, sonhos e iniciativas solidárias com total transparência e segurança garantida pelo VOXA.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <button
              onClick={() => {
                if (!currentUser) {
                  alert("Entre na VOXA para criar uma vaquinha.");
                  return;
                }
                setShowCreateModal(true);
              }}
              className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs py-3.5 px-6 rounded-2xl transition-all shadow-lg shadow-red-600/20 cursor-pointer flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>CRIAR VAQUINHA</span>
            </button>

            <button
              onClick={() => setActiveTab(activeTab === 'metricas' ? 'all' : 'metricas')}
              className={`font-orbitron font-bold text-xs py-3.5 px-6 rounded-2xl transition-all cursor-pointer flex items-center space-x-2 border ${
                activeTab === 'metricas'
                  ? 'bg-white text-black border-white shadow-lg'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>{activeTab === 'metricas' ? 'VER CAMPANHAS' : 'MÉTRICAS & GRÁFICOS'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'Todas' },
            { id: 'destaques', label: 'Destaques' },
            { id: 'recentes', label: 'Mais Recentes' },
            { id: 'apoiadas', label: 'Mais Apoiadas' },
            { id: 'meta', label: 'Próximas da Meta' },
            { id: 'metricas', label: '📊 Métricas Recharts' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-orbitron font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id 
                  ? 'bg-white text-black shadow-md' 
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== 'metricas' && (
          <div className="flex items-center space-x-3">
            <div className="relative flex-1 md:w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 pointer-events-none">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar vaquinhas..."
                className="w-full bg-[#12111d] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white font-sans"
              />
            </div>
          </div>
        )}
      </div>

      {/* CONDITIONAL: METRICS DASHBOARD OR CAMPAIGN GRID */}
      {activeTab === 'metricas' ? (
        <div className="space-y-6">
          <FundraisingAnalyticsDashboard
            fundraisers={fundraisers}
            contributions={contributions}
            onRefresh={loadData}
            isLoading={loading}
            showTitle={true}
            canManageGoals={Boolean(currentUser)}
            onGoalUpdated={(updated) => {
              setFundraisers(prev => prev.map(f => f.id === updated.id ? updated : f));
              triggerToast(`Meta atualizada para ${formatBRL(updated.goalAmount)}!`);
            }}
          />
        </div>
      ) : loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-gray-400 font-sans">Carregando campanhas...</p>
        </div>
      ) : filteredFundraisers.length === 0 ? (
        <div className="py-24 text-center space-y-4 bg-[#12111d] rounded-3xl border border-white/10 p-8">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-gray-500">
            <Heart className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-orbitron font-bold text-base text-white">Nenhuma vaquinha encontrada</h3>
            <p className="text-xs text-gray-400 font-sans mt-1">Seja o primeiro a criar uma campanha solidária no VOXA!</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-white text-black font-orbitron font-bold text-xs py-2.5 px-5 rounded-xl cursor-pointer hover:bg-neutral-200 transition-all"
          >
            Criar Vaquinha Agora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFundraisers.map(f => {
            const percent = Math.min(100, Math.round((f.raisedAmount / f.goalAmount) * 100));
            const isOwner = isUserOwnerOrAdmin(f);
            return (
              <div 
                key={f.id}
                onClick={() => setSelectedFundraiser(f)}
                className="group bg-[#12111d] border border-white/10 hover:border-white/20 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-red-600/10 flex flex-col justify-between cursor-pointer relative"
              >
                <div>
                  {/* Cover Image with fallbacks */}
                  <div className="relative h-48 w-full overflow-hidden bg-black/40">
                    <img 
                      src={f.coverUrl || (f as any).image || (f as any).imageUrl || DEFAULT_VAQUINHA_COVER} 
                      alt={f.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = DEFAULT_VAQUINHA_COVER;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#12111d] via-transparent to-black/30"></div>
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-orbitron font-bold text-white uppercase">
                      {f.categoryId || 'Solidariedade'}
                    </div>

                    {isOwner && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFundraiser(f);
                          setEditCoverUrl(f.coverUrl || '');
                          setEditCoverPreview(f.coverUrl || null);
                          setEditUploadStatus(null);
                          setEditUploadError(null);
                        }}
                        className="absolute top-3 right-3 bg-black/70 hover:bg-white text-white hover:text-black p-2 rounded-xl border border-white/20 transition-all text-xs font-orbitron font-bold flex items-center space-x-1"
                        title="Editar Vaquinha"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="font-orbitron font-black text-base text-white group-hover:text-red-400 transition-colors line-clamp-1">
                        {f.title}
                      </h3>
                      <p className="text-xs text-gray-400 font-sans line-clamp-2 mt-1.5 leading-relaxed">
                        {f.shortDescription || f.description}
                      </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs font-orbitron">
                        <span className="font-bold text-white">{formatBRL(f.raisedAmount)}</span>
                        <span className="text-gray-400">Meta: {formatBRL(f.goalAmount)}</span>
                      </div>
                      <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/10">
                        <div 
                          className="h-full bg-gradient-to-r from-red-600 to-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-2 flex items-center justify-between border-t border-white/5 text-xs">
                  <span className="text-gray-400 font-sans flex items-center space-x-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>{f.supporterCount || 0} apoiadores</span>
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFundraiser(f);
                      setShowContributeModal(true);
                    }}
                    className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs py-2 px-4 rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    CONTRIBUIR
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE FUNDRAISER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0c0b16] border border-white/15 rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-6 text-white relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 font-bold">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-orbitron font-black text-sm uppercase">Criar Nova Vaquinha</h3>
                  <p className="text-[10px] text-gray-400 font-sans">Arrecadação solidária ou de projetos</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFundraiser} className="space-y-4 text-xs font-sans">
              <div className="space-y-1.5">
                <label className="font-orbitron font-bold text-gray-300 block">Título da Vaquinha *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Cirurgia de Emergência do Pet / Gravação do Álbum"
                  className="w-full bg-[#12111d] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white"
                />
              </div>

              {/* REAL COVER UPLOAD (STORE-STYLE) */}
              <div className="space-y-2">
                <label className="font-orbitron font-bold text-gray-300 block">
                  Enviar capa da Vaquinha
                </label>

                {createCoverPreview || newCoverUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-black/40 h-44 group">
                    <img 
                      src={createCoverPreview || newCoverUrl} 
                      alt="Prévia da Capa" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white text-black font-orbitron font-bold text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-lg"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Trocar Capa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateCoverPreview(null);
                          setNewCoverUrl('');
                          setUploadStatus(null);
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white font-orbitron font-bold text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingCover(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDraggingCover(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingCover(false);
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile) {
                        processCoverFile(droppedFile);
                      }
                    }}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 flex flex-col items-center justify-center ${
                      isDraggingCover
                        ? 'border-red-500 bg-red-500/10 scale-[1.01] ring-2 ring-red-500/30'
                        : 'border-white/15 hover:border-white/40 bg-[#12111d]'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-colors ${
                      isDraggingCover
                        ? 'bg-red-500/20 border-red-500/40 text-red-400'
                        : 'bg-white/5 border-white/10 text-gray-400 group-hover:text-white'
                    }`}>
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-orbitron font-bold text-xs text-white">
                        {isDraggingCover ? 'Solte a imagem aqui' : 'Arraste a imagem ou clique para escolher'}
                      </p>
                      <p className="text-[10px] text-gray-400 font-sans mt-0.5">JPG, PNG ou WEBP (máx. 15MB)</p>
                    </div>
                    <button
                      type="button"
                      className="bg-white/10 hover:bg-white/20 text-white font-orbitron font-bold text-[10px] px-3.5 py-1.5 rounded-lg pointer-events-none mt-1"
                    >
                      Selecionar Arquivo
                    </button>
                  </div>
                )}

                {/* Progress bar during upload */}
                {isUploadingCover && (
                  <div className="space-y-1.5 bg-black/40 p-3 rounded-xl border border-white/10">
                    <div className="flex items-center justify-between text-[11px] font-orbitron">
                      <span className="text-gray-300">{uploadStatus || 'Enviando capa...'}</span>
                      <span className="text-red-400 font-bold">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-red-600 to-indigo-500 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {uploadStatus && !isUploadingCover && (
                  <p className="text-[11px] text-emerald-400 font-orbitron flex items-center space-x-1">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{uploadStatus}</span>
                  </p>
                )}

                {uploadError && (
                  <p className="text-[11px] text-red-400 font-sans flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{uploadError}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-orbitron font-bold text-gray-300 block">Meta (R$) *</label>
                  <input
                    type="number"
                    required
                    min="10"
                    step="10"
                    value={newGoalAmount}
                    onChange={(e) => setNewGoalAmount(e.target.value)}
                    className="w-full bg-[#12111d] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-orbitron font-bold text-gray-300 block">Categoria</label>
                  <select
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                    className="w-full bg-[#12111d] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    <option value="solidariedade">Solidariedade</option>
                    <option value="musica">Música & Cultura</option>
                    <option value="emergencia">Emergência</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-orbitron font-bold text-gray-300 block">Resumo Curto (1 frase)</label>
                <input
                  type="text"
                  value={newShortDesc}
                  onChange={(e) => setNewShortDesc(e.target.value)}
                  placeholder="Explique o objetivo de forma direta para a listagem"
                  className="w-full bg-[#12111d] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-orbitron font-bold text-gray-300 block">História & Detalhes da Campanha</label>
                <textarea
                  rows={4}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Conte os detalhes da vaquinha, o motivo da arrecadação e como o valor será utilizado..."
                  className="w-full bg-[#12111d] border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-orbitron font-bold text-xs cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploadingCover}
                  className="px-6 py-3 rounded-xl bg-[#FF0033] hover:bg-red-700 disabled:opacity-50 text-white font-orbitron font-black text-xs cursor-pointer transition-all shadow-lg shadow-red-600/30"
                >
                  {isSaving ? 'Salvando...' : isUploadingCover ? 'Enviando Imagem...' : 'Publicar Vaquinha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT FUNDRAISER MODAL */}
      {editingFundraiser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0c0b16] border border-white/15 rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-6 text-white relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400 font-bold">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-orbitron font-black text-sm uppercase">Editar Vaquinha</h3>
                  <p className="text-[10px] text-gray-400 font-sans">Atualize informações ou altere a capa</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingFundraiser(null)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedFundraiser} className="space-y-4 text-xs font-sans">
              <div className="space-y-1.5">
                <label className="font-orbitron font-bold text-gray-300 block">Título *</label>
                <input
                  type="text"
                  required
                  value={editingFundraiser.title}
                  onChange={(e) => setEditingFundraiser({ ...editingFundraiser, title: e.target.value })}
                  className="w-full bg-[#12111d] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white"
                />
              </div>

              {/* COVER UPLOAD & REPLACE IN EDIT */}
              <div className="space-y-2">
                <label className="font-orbitron font-bold text-gray-300 block">
                  Capa da Vaquinha
                </label>

                {editCoverPreview || editCoverUrl || editingFundraiser.coverUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-white/20 bg-black/40 h-44 group">
                    <img 
                      src={editCoverPreview || editCoverUrl || editingFundraiser.coverUrl || DEFAULT_VAQUINHA_COVER} 
                      alt="Capa da Vaquinha" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-3">
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        className="bg-white text-black font-orbitron font-bold text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-lg"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Trocar Capa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditCoverPreview(null);
                          setEditCoverUrl('');
                          setEditingFundraiser({ ...editingFundraiser, coverUrl: '' });
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white font-orbitron font-bold text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => editFileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingEditCover(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDraggingEditCover(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingEditCover(false);
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile) {
                        processEditCoverFile(droppedFile);
                      }
                    }}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 flex flex-col items-center justify-center ${
                      isDraggingEditCover
                        ? 'border-red-500 bg-red-500/10 scale-[1.01] ring-2 ring-red-500/30'
                        : 'border-white/15 hover:border-white/40 bg-[#12111d]'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-colors ${
                      isDraggingEditCover
                        ? 'bg-red-500/20 border-red-500/40 text-red-400'
                        : 'bg-white/5 border-white/10 text-gray-400 group-hover:text-white'
                    }`}>
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-orbitron font-bold text-xs text-white">
                        {isDraggingEditCover ? 'Solte a imagem aqui' : 'Arraste a nova capa ou clique para selecionar'}
                      </p>
                      <p className="text-[10px] text-gray-400 font-sans mt-0.5">JPG, PNG ou WEBP (máx. 15MB)</p>
                    </div>
                  </div>
                )}

                {isUploadingEditCover && (
                  <div className="space-y-1.5 bg-black/40 p-3 rounded-xl border border-white/10">
                    <div className="flex items-center justify-between text-[11px] font-orbitron">
                      <span className="text-gray-300">{editUploadStatus || 'Enviando nova capa...'}</span>
                      <span className="text-red-400 font-bold">{editUploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-red-600 to-indigo-500 transition-all duration-300"
                        style={{ width: `${editUploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {editUploadStatus && !isUploadingEditCover && (
                  <p className="text-[11px] text-emerald-400 font-orbitron flex items-center space-x-1">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{editUploadStatus}</span>
                  </p>
                )}

                {editUploadError && (
                  <p className="text-[11px] text-red-400 font-sans flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{editUploadError}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-orbitron font-bold text-gray-300 block">Meta (R$) *</label>
                  <input
                    type="number"
                    required
                    min="10"
                    step="10"
                    value={editingFundraiser.goalAmount}
                    onChange={(e) => setEditingFundraiser({ ...editingFundraiser, goalAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#12111d] border border-white/10 rounded-xl px-4 py-3 text-white font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-orbitron font-bold text-gray-300 block">Categoria</label>
                  <select
                    value={editingFundraiser.categoryId || 'solidariedade'}
                    onChange={(e) => setEditingFundraiser({ ...editingFundraiser, categoryId: e.target.value })}
                    className="w-full bg-[#12111d] border border-white/10 rounded-xl px-4 py-3 text-white"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    <option value="solidariedade">Solidariedade</option>
                    <option value="musica">Música & Cultura</option>
                    <option value="emergencia">Emergência</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-orbitron font-bold text-gray-300 block">Resumo Curto</label>
                <input
                  type="text"
                  value={editingFundraiser.shortDescription || ''}
                  onChange={(e) => setEditingFundraiser({ ...editingFundraiser, shortDescription: e.target.value })}
                  className="w-full bg-[#12111d] border border-white/10 rounded-xl px-4 py-3 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-orbitron font-bold text-gray-300 block">História & Detalhes</label>
                <textarea
                  rows={4}
                  value={editingFundraiser.description || ''}
                  onChange={(e) => setEditingFundraiser({ ...editingFundraiser, description: e.target.value })}
                  className="w-full bg-[#12111d] border border-white/10 rounded-xl p-4 text-white"
                />
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleDeleteFundraiser(editingFundraiser.id)}
                  className="px-4 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 font-orbitron font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingFundraiser(null)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 text-gray-300 font-orbitron font-bold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || isUploadingEditCover}
                    className="px-6 py-2.5 rounded-xl bg-[#FF0033] hover:bg-red-700 disabled:opacity-50 text-white font-orbitron font-black text-xs cursor-pointer"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FUNDRAISER DETAILS & CONTRIBUTION MODAL */}
      {selectedFundraiser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0c0b16] border border-white/15 rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 text-white relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <button 
              onClick={() => {
                setSelectedFundraiser(null);
                setShowContributeModal(false);
              }}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-6">
              {/* Cover Header */}
              <div className="relative h-64 sm:h-72 -mx-6 md:-mx-8 -mt-6 md:-mt-8 rounded-t-3xl overflow-hidden bg-black/60">
                <img 
                  src={selectedFundraiser.coverUrl || (selectedFundraiser as any).image || (selectedFundraiser as any).imageUrl || DEFAULT_VAQUINHA_COVER} 
                  alt={selectedFundraiser.title} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = DEFAULT_VAQUINHA_COVER;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0b16] via-black/20 to-transparent"></div>
                <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 text-xs font-orbitron font-bold text-white uppercase">
                  {selectedFundraiser.categoryId || 'Solidariedade'}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full text-[10px] font-orbitron font-bold">
                    ID: {selectedFundraiser.slug}
                  </span>
                  <span className="text-xs text-gray-400 font-sans">
                    Criado em {new Date(selectedFundraiser.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <h2 className="font-orbitron font-black text-xl md:text-2xl text-white uppercase">
                  {selectedFundraiser.title}
                </h2>
                
                {/* Creator anchor */}
                <div className="flex items-center space-x-3 py-2 bg-white/5 px-4 rounded-2xl border border-white/10">
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20 bg-zinc-800 flex items-center justify-center">
                    {selectedFundraiser.ownerAvatar ? (
                      <img src={selectedFundraiser.ownerAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-bold text-white block">{selectedFundraiser.ownerName}</span>
                    <span className="text-[10px] text-gray-400 block">@{selectedFundraiser.ownerUsername}</span>
                  </div>
                  {selectedFundraiser.ownerUsername && onVisitProfile && (
                    <button
                      onClick={() => {
                        onVisitProfile(selectedFundraiser.ownerUsername!);
                        setSelectedFundraiser(null);
                      }}
                      className="text-xs font-orbitron font-bold text-red-400 hover:underline cursor-pointer flex items-center space-x-1"
                    >
                      <span>Ver Perfil</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Progress */}
                <div className="bg-[#12111d] p-5 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-orbitron block">Arrecadado</span>
                      <span className="font-orbitron font-black text-xl text-white">{formatBRL(selectedFundraiser.raisedAmount)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 uppercase font-orbitron block">Meta</span>
                      <span className="font-orbitron font-bold text-base text-gray-300">{formatBRL(selectedFundraiser.goalAmount)}</span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/10">
                    <div 
                      className="h-full bg-gradient-to-r from-red-600 to-indigo-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.round((selectedFundraiser.raisedAmount / selectedFundraiser.goalAmount) * 100))}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                    <span>{selectedFundraiser.supporterCount || 0} apoiadores</span>
                    <span>{Math.min(100, Math.round((selectedFundraiser.raisedAmount / selectedFundraiser.goalAmount) * 100))}% da meta</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-orbitron font-bold text-xs text-gray-300 uppercase">Sobre a Campanha</h4>
                  <p className="text-xs text-gray-300 font-sans leading-relaxed whitespace-pre-line bg-white/5 p-4 rounded-2xl border border-white/10">
                    {selectedFundraiser.description || selectedFundraiser.shortDescription || "Nenhuma descrição detalhada fornecida."}
                  </p>
                </div>
              </div>

              {/* Contribute Box */}
              {!showContributeModal ? (
                <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                  <button
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(window.location.origin + `/vaquinha/${selectedFundraiser.slug}`);
                        triggerToast('Link da vaquinha copiado!');
                      }
                    }}
                    className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 text-white font-orbitron font-bold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer border border-white/10"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Compartilhar</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    {isUserOwnerOrAdmin(selectedFundraiser) && (
                      <button
                        onClick={() => {
                          setEditingFundraiser(selectedFundraiser);
                          setEditCoverUrl(selectedFundraiser.coverUrl || '');
                          setEditCoverPreview(selectedFundraiser.coverUrl || null);
                          setEditUploadStatus(null);
                          setEditUploadError(null);
                        }}
                        className="bg-white/10 hover:bg-white/20 text-white font-orbitron font-bold text-xs py-3.5 px-5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                    )}

                    <button
                      onClick={() => setShowContributeModal(true)}
                      className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs py-3.5 px-8 rounded-xl transition-all shadow-lg shadow-red-600/30 cursor-pointer"
                    >
                      CONTRIBUIR AGORA
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleContribute} className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-4 animate-fadeIn">
                  <h4 className="font-orbitron font-bold text-xs uppercase text-white">Escolha o valor da contribuição</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {['20', '50', '100', '250'].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setContribAmount(val)}
                        className={`py-2 rounded-xl font-mono font-bold text-xs transition-all cursor-pointer ${
                          contribAmount === val 
                            ? 'bg-red-600 text-white shadow-md' 
                            : 'bg-black/40 text-gray-300 hover:bg-white/10 border border-white/10'
                        }`}
                      >
                        R$ {val}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-orbitron text-gray-400 block">Outro valor (R$)</label>
                    <input
                      type="number"
                      min="5"
                      step="5"
                      required
                      value={contribAmount}
                      onChange={(e) => setContribAmount(e.target.value)}
                      className="w-full bg-[#12111d] border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-orbitron text-gray-400 block">Forma de Pagamento</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setContribPaymentMethod('wallet')}
                        className={`p-3 rounded-xl border text-xs font-orbitron font-bold flex items-center justify-center space-x-2 cursor-pointer ${
                          contribPaymentMethod === 'wallet' 
                            ? 'bg-white text-black border-white' 
                            : 'bg-black/40 text-gray-400 border-white/10'
                        }`}
                      >
                        <span>Saldo VOXA</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setContribPaymentMethod('pix')}
                        className={`p-3 rounded-xl border text-xs font-orbitron font-bold flex items-center justify-center space-x-2 cursor-pointer ${
                          contribPaymentMethod === 'pix' 
                            ? 'bg-white text-black border-white' 
                            : 'bg-black/40 text-gray-400 border-white/10'
                        }`}
                      >
                        <span>PIX Mercado Pago</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowContributeModal(false)}
                      className="px-4 py-2 rounded-xl bg-white/5 text-xs font-orbitron text-gray-300 cursor-pointer"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={isContributing}
                      className="px-6 py-2.5 rounded-xl bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs cursor-pointer shadow-lg shadow-red-600/30"
                    >
                      {isContributing ? 'Processando...' : `Confirmar Contribuição de ${formatBRL(parseFloat(contribAmount) || 0)}`}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
