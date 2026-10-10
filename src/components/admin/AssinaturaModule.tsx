import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Shield, Zap, CheckCircle2, XCircle, AlertTriangle, 
  Plus, Edit2, Trash2, Check, X, Image as ImageIcon, Sparkles, 
  FileText, Percent, Users, DollarSign, Calendar, Eye, EyeOff, Info, ExternalLink 
} from 'lucide-react';
import { formatBRL } from '../../utils/money';
import { 
  fetchSubscriptionPlans, 
  saveSubscriptionPlan, 
  deleteSubscriptionPlan, 
  fetchCommissionSettings, 
  saveCommissionSettings,
  fetchStoreOrders,
  SubscriptionPlan,
  CommissionSettings,
  StoreOrder
} from '../../utils/storeDb';
import { uploadFile } from '../../utils/upload';

interface AssinaturaModuleProps {
  onBackToMenu: () => void;
}

type AdminTab = 
  | 'overview' 
  | 'lockdown_plans' 
  | 'user_ads' 
  | 'pending_approval' 
  | 'active_plans' 
  | 'inactive_plans' 
  | 'subscribers_sales' 
  | 'settings_commissions';

export const AssinaturaModule: React.FC<AssinaturaModuleProps> = ({ onBackToMenu }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [commissions, setCommissions] = useState<CommissionSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form states for creating/editing Lockdown plans
  const [isEditing, setIsEditing] = useState(false);
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formBillingPeriod, setFormBillingPeriod] = useState<'Mensal' | 'Trimestral' | 'Semestral' | 'Anual' | 'Único'>('Mensal');
  const [formBenefits, setFormBenefits] = useState('');
  const [formCategory, setFormCategory] = useState('Exclusivo');
  const [formActive, setFormActive] = useState(true);
  const [formMaxSubscribers, setFormMaxSubscribers] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formInternalNotes, setFormInternalNotes] = useState('');
  const [formFeatured, setFormFeatured] = useState(false);
  const [formImageUrl, setFormImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Rejection/Changes state
  const [rejectionModalPlan, setRejectionModalPlan] = useState<SubscriptionPlan | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [rejectionActionType, setRejectionActionType] = useState<'rejeitar' | 'ajustes'>('rejeitar');

  // Load module data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allPlans, allOrders, commSettings] = await Promise.all([
        fetchSubscriptionPlans(),
        fetchStoreOrders(),
        fetchCommissionSettings()
      ]);
      setPlans(allPlans);
      setOrders(allOrders);
      setCommissions(commSettings);
    } catch (err: any) {
      console.error("[AssinaturaModule loadData error]", err);
      setErrorMsg("Falha ao carregar dados do Firestore. Verifique as credenciais.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadFile(file, 'cover', (progress) => {
        setUploadProgress(Math.round(progress.percentage));
      });
      if (result && result.url) {
        setFormImageUrl(result.url);
        setSuccessMsg("Imagem carregada com sucesso!");
      } else {
        throw new Error("Não foi possível obter a URL do arquivo carregado.");
      }
    } catch (err: any) {
      console.error("[FileUpload Error]", err);
      setErrorMsg("Erro ao fazer upload da capa: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPrice || !formBenefits) {
      setErrorMsg("Por favor, preencha o nome, preço e benefícios inclusos.");
      return;
    }

    try {
      const parsedPrice = parseFloat(formPrice.toString().replace(',', '.'));
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        setErrorMsg("Preço inválido.");
        return;
      }

      const planId = editPlanId || `sub-lockdown-${Date.now()}`;
      const planPayload: SubscriptionPlan = {
        id: planId,
        name: formName,
        description: formDescription,
        price: parsedPrice,
        billingPeriod: formBillingPeriod,
        benefits: formBenefits,
        imageUrl: formImageUrl || undefined,
        image: formImageUrl || undefined,
        status: 'Aprovado', // Lockdown official is auto-approved
        published: true,
        active: formActive,
        ownerType: 'lockdown',
        ownerId: 'admin',
        ownerName: 'Lockdown Oficial',
        sellerId: 'admin',
        sellerName: 'Lockdown Oficial',
        category: formCategory,
        maxSubscribers: formMaxSubscribers ? parseInt(formMaxSubscribers) : undefined,
        startDate: formStartDate || undefined,
        endDate: formEndDate || undefined,
        internalNotes: formInternalNotes || undefined,
        createdAt: editPlanId ? (plans.find(p => p.id === editPlanId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveSubscriptionPlan(planPayload);
      setSuccessMsg(editPlanId ? "Plano oficial atualizado com sucesso!" : "Plano oficial criado com sucesso!");
      resetForm();
      loadData();
    } catch (err: any) {
      console.error("[handleSavePlan error]", err);
      setErrorMsg("Erro ao salvar o plano: " + err.message);
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    try {
      const updated: SubscriptionPlan = {
        ...plan,
        active: !plan.active,
        updatedAt: new Date().toISOString()
      };
      await saveSubscriptionPlan(updated);
      setSuccessMsg(`Plano ${plan.name} foi ${updated.active ? 'ativado' : 'desativado'} com sucesso!`);
      loadData();
    } catch (err: any) {
      setErrorMsg("Falha ao alterar o status ativo: " + err.message);
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este plano permanentemente?")) return;
    try {
      await deleteSubscriptionPlan(id);
      setSuccessMsg("Plano removido com sucesso!");
      loadData();
    } catch (err: any) {
      setErrorMsg("Falha ao remover o plano: " + err.message);
    }
  };

  const handleApproveUserAd = async (plan: SubscriptionPlan) => {
    try {
      const commissionPercent = commissions?.subscriptionCommissionPercent ?? 10;
      const updated: SubscriptionPlan = {
        ...plan,
        status: 'Aprovado',
        published: true,
        active: true,
        commissionPercent,
        approvedAt: new Date().toISOString(),
        approvedBy: 'admin',
        updatedAt: new Date().toISOString()
      };
      await saveSubscriptionPlan(updated);
      setSuccessMsg(`Anúncio "${plan.name}" aprovado e publicado com comissão de ${commissionPercent}%!`);
      loadData();
    } catch (err: any) {
      setErrorMsg("Erro ao aprovar anúncio: " + err.message);
    }
  };

  const handleRejectOrAdjustAction = async () => {
    if (!rejectionModalPlan) return;
    if (!rejectionReasonInput.trim()) {
      alert("Por favor, preencha o motivo.");
      return;
    }

    try {
      const updatedStatus = rejectionActionType === 'rejeitar' ? 'Rejeitado' : 'Ajustes solicitados';
      const updated: SubscriptionPlan = {
        ...rejectionModalPlan,
        status: updatedStatus,
        published: false,
        rejectionReason: rejectionReasonInput,
        updatedAt: new Date().toISOString()
      };
      await saveSubscriptionPlan(updated);
      setSuccessMsg(`O plano "${rejectionModalPlan.name}" foi alterado para: ${updatedStatus}.`);
      setRejectionModalPlan(null);
      setRejectionReasonInput('');
      loadData();
    } catch (err: any) {
      setErrorMsg("Erro ao aplicar ação de rejeição: " + err.message);
    }
  };

  const handleSaveCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commissions) return;

    try {
      await saveCommissionSettings({
        ...commissions,
        isConfigured: true
      });
      setSuccessMsg("Taxas de comissão salvas com sucesso no Firestore!");
      loadData();
    } catch (err: any) {
      setErrorMsg("Erro ao salvar taxas: " + err.message);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditPlanId(null);
    setFormName('');
    setFormDescription('');
    setFormPrice('');
    setFormBillingPeriod('Mensal');
    setFormBenefits('');
    setFormCategory('Exclusivo');
    setFormActive(true);
    setFormMaxSubscribers('');
    setFormStartDate('');
    setFormEndDate('');
    setFormInternalNotes('');
    setFormFeatured(false);
    setFormImageUrl('');
  };

  const startEdit = (plan: SubscriptionPlan) => {
    setIsEditing(true);
    setEditPlanId(plan.id);
    setFormName(plan.name);
    setFormDescription(plan.description || '');
    setFormPrice(plan.price.toString());
    setFormBillingPeriod(plan.billingPeriod || 'Mensal');
    setFormBenefits(plan.benefits || '');
    setFormCategory(plan.category || 'Exclusivo');
    setFormActive(plan.active);
    setFormMaxSubscribers(plan.maxSubscribers?.toString() || '');
    setFormStartDate(plan.startDate || '');
    setFormEndDate(plan.endDate || '');
    setFormInternalNotes(plan.internalNotes || '');
    setFormImageUrl(plan.imageUrl || '');
  };

  // Safe Filter Logic (all real, no demo)
  const lockdownPlans = plans.filter(p => p.ownerType === 'lockdown');
  const userAds = plans.filter(p => p.ownerType === 'user');
  const pendingPlans = plans.filter(p => p.status === 'Pendente');
  const activePlans = plans.filter(p => p.status === 'Aprovado' && p.active === true);
  const inactivePlans = plans.filter(p => p.status !== 'Aprovado' || p.active === false);

  // Filter real sales from orders database which belong to subscriptions
  const subscriptionSales = orders.filter(o => {
    const isSubId = o.productId && (o.productId.startsWith('sub-') || o.productId.startsWith('subscription-'));
    const isSubItem = o.item && (o.item.toLowerCase().includes('plano') || o.item.toLowerCase().includes('clube') || o.item.toLowerCase().includes('assinatura'));
    return isSubId || isSubItem;
  });

  const totalRevenue = subscriptionSales.reduce((acc, o) => acc + (o.grossValue || 0), 0);
  const totalCommission = subscriptionSales.reduce((acc, o) => acc + (o.commissionValue || 0), 0);
  const netEarnings = totalRevenue - totalCommission;

  return (
    <div className="h-full flex flex-col justify-between p-4 md:p-8 max-w-7xl mx-auto w-full text-left">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-white/10 gap-4">
        <button
          onClick={onBackToMenu}
          className="flex items-center space-x-2 bg-[#161616] hover:bg-[#222] border border-white/10 px-4 py-2 rounded-xl text-xs font-orbitron text-gray-300 hover:text-white transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>MENU PRINCIPAL</span>
        </button>

        <div className="flex items-center space-x-3">
          <span className="w-3 h-3 rounded-full bg-[#FF0033] animate-pulse"></span>
          <span className="font-orbitron font-bold text-sm tracking-wider text-white uppercase">MÓDULO ASSINATURAS • MARKETPLACE & GESTÃO</span>
        </div>
      </div>

      {/* Global Alerts */}
      <div className="mt-4">
        {successMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center justify-between mb-2">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-white">✕</button>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center justify-between mb-2">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-white">✕</button>
          </div>
        )}
      </div>

      {/* Subscriptions Tabs navigation */}
      <div className="mt-6 flex flex-wrap gap-1 border-b border-white/5 pb-2">
        {[
          { id: 'overview', label: 'VISÃO GERAL', count: null },
          { id: 'lockdown_plans', label: 'ASSINATURAS LOCKDOWN', count: lockdownPlans.length },
          { id: 'user_ads', label: 'ANÚNCIOS DE USUÁRIOS', count: userAds.length },
          { id: 'pending_approval', label: 'PENDENTES DE APROVAÇÃO', count: pendingPlans.length, highlight: pendingPlans.length > 0 },
          { id: 'active_plans', label: 'ASSINATURAS ATIVAS', count: activePlans.length },
          { id: 'inactive_plans', label: 'ASSINATURAS INATIVAS', count: inactivePlans.length },
          { id: 'subscribers_sales', label: 'ASSINANTES / VENDAS', count: subscriptionSales.length },
          { id: 'settings_commissions', label: 'CONFIGURAÇÕES / COMISSÕES', count: null },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as AdminTab);
              resetForm();
            }}
            className={`px-4 py-2 text-[10px] font-orbitron font-black rounded-lg transition-all cursor-pointer border ${
              activeTab === tab.id
                ? 'bg-[#FF0033] border-[#FF0033] text-white'
                : 'bg-black/50 border-white/5 text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] ${
                tab.highlight 
                  ? 'bg-amber-500 text-black font-extrabold' 
                  : 'bg-white/10 text-white'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 py-8">
        {isLoading ? (
          <div className="text-center py-12">
            <span className="font-orbitron text-xs text-gray-400 animate-pulse">CARREGANDO ASSINATURAS DO FIRESTORE...</span>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* 1. OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Real Statistics Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-[#0c0c0c] p-6 rounded-3xl border border-white/5 space-y-1">
                    <span className="text-[10px] text-gray-500 font-orbitron tracking-widest uppercase">PLANS ATIVOS NO SITE</span>
                    <h3 className="font-orbitron font-black text-3xl text-white">{activePlans.length}</h3>
                    <p className="text-[9px] text-gray-400">Lockdown e parceiros homologados</p>
                  </div>
                  <div className="bg-[#0c0c0c] p-6 rounded-3xl border border-white/5 space-y-1">
                    <span className="text-[10px] text-gray-500 font-orbitron tracking-widest uppercase">PENDENTES DE ANÁLISE</span>
                    <h3 className={`font-orbitron font-black text-3xl ${pendingPlans.length > 0 ? 'text-amber-500 animate-pulse' : 'text-white'}`}>
                      {pendingPlans.length}
                    </h3>
                    <p className="text-[9px] text-gray-400">Novos envios aguardando comissão</p>
                  </div>
                  <div className="bg-[#0c0c0c] p-6 rounded-3xl border border-white/5 space-y-1">
                    <span className="text-[10px] text-gray-500 font-orbitron tracking-widest uppercase">FATURAMENTO RECENTE REAL</span>
                    <h3 className="font-orbitron font-black text-3xl text-[#FF0033]">
                      {formatBRL(totalRevenue)}
                    </h3>
                    <p className="text-[9px] text-emerald-500">Apenas transações registradas</p>
                  </div>
                  <div className="bg-[#0c0c0c] p-6 rounded-3xl border border-white/5 space-y-1">
                    <span className="text-[10px] text-gray-500 font-orbitron tracking-widest uppercase">COMISSÕES RETIDAS</span>
                    <h3 className="font-orbitron font-black text-3xl text-white">
                      {formatBRL(totalCommission)}
                    </h3>
                    <p className="text-[9px] text-gray-400">Lucro líquido da produtora</p>
                  </div>
                </div>

                {/* Subscriptions Information & Integrity */}
                <div className="bg-[#121212]/30 p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center gap-6">
                  <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-400 self-start">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <div className="space-y-2 flex-1 text-left">
                    <h4 className="font-orbitron font-black text-sm text-white uppercase">AUDITORIA DE PAGAMENTOS RECORRENTES</h4>
                    <p className="text-xs text-gray-400 leading-relaxed font-sans">
                      O faturamento e assinantes mostrados no painel administrativo são correspondentes a <strong>compras registradas de forma segura</strong>. O gateway de pagamentos recorrentes Mercado Pago se encontra em fase de homologação contratual. Assinantes não homologados não são computados para proteger a fidedignidade financeira.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 2. LOCKDOWN PLANS TAB (With Create/Edit Form) */}
            {activeTab === 'lockdown_plans' && (
              <div className="space-y-8">
                
                {/* Form Toggle Button */}
                <div className="flex justify-between items-center">
                  <h3 className="font-orbitron font-black text-sm text-white uppercase">Assinaturas Oficiais Lockdown</h3>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="bg-[#FF0033] hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-orbitron font-bold flex items-center space-x-2 transition-all cursor-pointer shadow-lg"
                    >
                      <Plus className="w-4 h-4" />
                      <span>CRIAR PLANO DA LOCKDOWN</span>
                    </button>
                  )}
                </div>

                {/* Form Panel */}
                <AnimatePresence>
                  {isEditing && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 overflow-hidden space-y-6"
                    >
                      <div className="flex justify-between items-center border-b border-white/10 pb-4">
                        <span className="font-orbitron text-xs text-[#FF0033] font-bold">
                          {editPlanId ? 'EDITANDO PLANO LOCKDOWN' : 'NOVO PLANO OFICIAL DA PRODUTORA'}
                        </span>
                        <button onClick={resetForm} className="text-gray-400 hover:text-white p-2">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <form onSubmit={handleSavePlan} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] font-orbitron font-bold text-gray-400 block mb-1">NOME DO PLANO *</label>
                            <input
                              type="text"
                              value={formName}
                              onChange={(e) => setFormName(e.target.value)}
                              placeholder="Ex: Assinatura Lockdown VIP"
                              className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-orbitron font-bold text-gray-400 block mb-1">CATEGORIA</label>
                            <input
                              type="text"
                              value={formCategory}
                              onChange={(e) => setFormCategory(e.target.value)}
                              placeholder="Ex: Exclusivo, Fã Clube, VIP"
                              className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-orbitron font-bold text-gray-400 block mb-1">PREÇO MENSAL / PERÍODO *</label>
                              <input
                                type="text"
                                value={formPrice}
                                onChange={(e) => setFormPrice(e.target.value)}
                                placeholder="R$ 29.90"
                                className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-orbitron font-bold text-gray-400 block mb-1">PERIODICIDADE *</label>
                              <select
                                value={formBillingPeriod}
                                onChange={(e) => setFormBillingPeriod(e.target.value as any)}
                                className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                              >
                                <option value="Mensal">Mensal</option>
                                <option value="Trimestral">Trimestral</option>
                                <option value="Semestral">Semestral</option>
                                <option value="Anual">Anual</option>
                                <option value="Único">Único (Pagamento Único)</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-orbitron font-bold text-gray-400 block mb-1">CANTIDADE MÁXIMA DE ASSINANTES (OPCIONAL)</label>
                            <input
                              type="number"
                              value={formMaxSubscribers}
                              onChange={(e) => setFormMaxSubscribers(e.target.value)}
                              placeholder="Sem limite"
                              className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-orbitron font-bold text-gray-400 block mb-1">DATA DE INÍCIO</label>
                              <input
                                type="date"
                                value={formStartDate}
                                onChange={(e) => setFormStartDate(e.target.value)}
                                className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-orbitron font-bold text-gray-400 block mb-1">DATA DE TÉRMINO</label>
                              <input
                                type="date"
                                value={formEndDate}
                                onChange={(e) => setFormEndDate(e.target.value)}
                                className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] font-orbitron font-bold text-gray-400 block mb-1">DESCRIÇÃO CURTA</label>
                            <input
                              type="text"
                              value={formDescription}
                              onChange={(e) => setFormDescription(e.target.value)}
                              placeholder="Resumo do que o assinante recebe."
                              className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-orbitron font-bold text-gray-400 block mb-1">BENEFÍCIOS INCLUSOS (UM POR LINHA) *</label>
                            <textarea
                              value={formBenefits}
                              onChange={(e) => setFormBenefits(e.target.value)}
                              placeholder="Grupo Exclusivo&#10;Download de Stems&#10;Ingressos com 50% de desconto"
                              rows={3}
                              className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                              required
                            />
                          </div>
                          
                          {/* Capa Image Upload Pipeline */}
                          <div>
                            <label className="text-[10px] font-orbitron font-bold text-gray-400 block mb-1">FOTO DE CAPA DO PLANO</label>
                            <div className="flex items-center space-x-3 bg-black p-3 border border-white/10 rounded-2xl">
                              {formImageUrl ? (
                                <img src={formImageUrl} alt="Capa" className="w-12 h-12 rounded-xl object-cover" />
                              ) : (
                                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-gray-500">
                                  <ImageIcon className="w-5 h-5" />
                                </div>
                              )}
                              <div className="flex-1">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleFileUpload}
                                  id="plan-cover-upload"
                                  className="hidden"
                                />
                                <label
                                  htmlFor="plan-cover-upload"
                                  className="cursor-pointer inline-block bg-white hover:bg-gray-200 text-black font-orbitron font-black text-[9px] px-3 py-1.5 rounded-lg uppercase tracking-wider"
                                >
                                  {isUploading ? `UPLOADING ${uploadProgress}%` : 'SELECIONAR CAPA'}
                                </label>
                                <p className="text-[9px] text-gray-500 mt-1 font-sans">Ideal 800x800px formato quadrado.</p>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-orbitron font-bold text-gray-400 block mb-1">NOTAS INTERNAS (SÓ VISÍVEL PARA ADMIN)</label>
                            <input
                              type="text"
                              value={formInternalNotes}
                              onChange={(e) => setFormInternalNotes(e.target.value)}
                              placeholder="Notas operacionais sobre benefícios..."
                              className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center space-x-3 pt-2">
                            <input
                              type="checkbox"
                              checked={formActive}
                              onChange={(e) => setFormActive(e.target.checked)}
                              id="form-active-check"
                              className="rounded border-white/10 text-[#FF0033] focus:ring-0 bg-black cursor-pointer"
                            />
                            <label htmlFor="form-active-check" className="text-xs font-orbitron text-gray-300 uppercase cursor-pointer select-none">
                              PUBLICAR IMEDIATAMENTE (ATIVO NO SITE)
                            </label>
                          </div>
                        </div>

                        <div className="md:col-span-2 pt-4 border-t border-white/5 flex justify-end space-x-2">
                          <button
                            type="button"
                            onClick={resetForm}
                            className="bg-white/5 hover:bg-white/10 text-white font-orbitron text-[10px] font-bold px-4 py-2.5 rounded-xl transition-all uppercase cursor-pointer"
                          >
                            CANCELAR
                          </button>
                          <button
                            type="submit"
                            className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron text-[10px] font-bold px-5 py-2.5 rounded-xl transition-all uppercase cursor-pointer"
                          >
                            {editPlanId ? 'SALVAR ALTERAÇÕES' : 'SALVAR NO FIRESTORE'}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Lockdown Plans List */}
                {lockdownPlans.length === 0 ? (
                  <div className="p-12 text-center bg-black/40 rounded-3xl border border-white/5">
                    <p className="text-xs text-gray-500 font-sans">Nenhuma assinatura oficial Lockdown foi criada ainda.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lockdownPlans.map(plan => (
                      <div key={plan.id} className="bg-[#0c0c0c] rounded-3xl border border-white/5 overflow-hidden flex flex-col justify-between hover:border-white/10 transition-all p-5 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] font-orbitron font-bold text-[#FF0033] uppercase bg-[#FF0033]/10 px-2 py-0.5 rounded-full border border-[#FF0033]/20 inline-block mb-2">
                              {plan.category || 'EXCLUSIVO'}
                            </span>
                            <h4 className="font-orbitron font-black text-sm text-white">{plan.name}</h4>
                            <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{plan.description}</p>
                          </div>
                          {plan.imageUrl && (
                            <img src={plan.imageUrl} alt={plan.name} className="w-12 h-12 rounded-xl object-cover" />
                          )}
                        </div>

                        <div className="bg-black/60 p-3 rounded-2xl border border-white/5 space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Preço:</span>
                            <span className="font-orbitron font-black text-[#FF0033]">{formatBRL(plan.price)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Cobrança:</span>
                            <span className="text-gray-300 font-orbitron text-[10px] uppercase">{plan.billingPeriod || 'Mensal'}</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-white/5 gap-2">
                          <button
                            onClick={() => handleToggleActive(plan)}
                            className={`flex-1 font-orbitron text-[9px] font-black py-2 rounded-xl uppercase tracking-wider flex items-center justify-center space-x-1 border ${
                              plan.active 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
                                : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10'
                            }`}
                          >
                            {plan.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            <span>{plan.active ? 'ATIVO NO SITE' : 'OCULTO'}</span>
                          </button>
                          
                          <button
                            onClick={() => startEdit(plan)}
                            className="bg-white/5 hover:bg-white/10 text-white p-2 rounded-xl border border-white/5 cursor-pointer"
                            title="Editar Plano"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeletePlan(plan.id)}
                            className="bg-red-950/20 hover:bg-red-900/30 text-red-400 p-2 rounded-xl border border-red-500/10 cursor-pointer"
                            title="Excluir Plano"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. USER ADS TAB */}
            {activeTab === 'user_ads' && (
              <div className="space-y-6">
                <h3 className="font-orbitron font-black text-sm text-white uppercase">Anúncios Enviados por Usuários</h3>
                
                {userAds.length === 0 ? (
                  <div className="p-12 text-center bg-black/40 rounded-3xl border border-white/5">
                    <p className="text-xs text-gray-500 font-sans">Nenhum anúncio enviado por usuários até o momento.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {userAds.map(plan => (
                      <div key={plan.id} className="bg-[#0c0c0c] rounded-3xl border border-white/5 overflow-hidden flex flex-col justify-between hover:border-white/10 transition-all p-5 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className={`text-[8px] font-orbitron font-bold px-2 py-0.5 rounded-full uppercase border inline-block mb-2 ${
                              plan.status === 'Aprovado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              plan.status === 'Rejeitado' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                              plan.status === 'Ajustes solicitados' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                              'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            }`}>
                              {plan.status || 'PENDENTE'}
                            </span>
                            <h4 className="font-orbitron font-black text-sm text-white">{plan.name}</h4>
                            <p className="text-[10px] text-gray-400 mt-1">Vendedor: {plan.ownerName || plan.sellerName}</p>
                          </div>
                          {plan.imageUrl && (
                            <img src={plan.imageUrl} alt={plan.name} className="w-12 h-12 rounded-xl object-cover" />
                          )}
                        </div>

                        <div className="bg-black/60 p-3 rounded-2xl border border-white/5 space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Cobrança:</span>
                            <span className="text-gray-300 font-orbitron text-[10px] uppercase">{plan.billingPeriod || 'Mensal'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Valor Mensal:</span>
                            <span className="font-orbitron font-black text-white">{formatBRL(plan.price)}</span>
                          </div>
                          {plan.commissionPercent !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Comissão Lockdown:</span>
                              <span className="text-[#FF0033] font-bold font-orbitron">{plan.commissionPercent}%</span>
                            </div>
                          )}
                        </div>

                        {plan.status === 'Rejeitado' && plan.rejectionReason && (
                          <div className="p-3 bg-red-950/20 border border-red-500/10 rounded-2xl text-[10px] text-red-400">
                            <strong>Motivo de rejeição:</strong> {plan.rejectionReason}
                          </div>
                        )}

                        <div className="flex space-x-2 pt-2 border-t border-white/5">
                          {plan.status === 'Pendente' && (
                            <>
                              <button
                                onClick={() => handleApproveUserAd(plan)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-orbitron text-[9px] font-black py-2 rounded-xl uppercase cursor-pointer"
                              >
                                APROVAR
                              </button>
                              <button
                                onClick={() => {
                                  setRejectionModalPlan(plan);
                                  setRejectionActionType('rejeitar');
                                }}
                                className="px-3 bg-red-950 hover:bg-red-900 text-red-400 font-orbitron text-[9px] font-black py-2 rounded-xl uppercase cursor-pointer"
                              >
                                REJEITAR
                              </button>
                            </>
                          )}
                          {plan.status === 'Aprovado' && (
                            <button
                              onClick={() => handleToggleActive(plan)}
                              className={`w-full font-orbitron text-[9px] font-black py-2 rounded-xl uppercase tracking-wider flex items-center justify-center space-x-1 border ${
                                plan.active 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
                                  : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10'
                              }`}
                            >
                              {plan.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              <span>{plan.active ? 'PUBLICADO NO SITE' : 'REMOVIDO DO SITE'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. PENDENT DE APROVAÇÃO TAB */}
            {activeTab === 'pending_approval' && (
              <div className="space-y-6">
                <div className="flex items-center space-x-2">
                  <h3 className="font-orbitron font-black text-sm text-white uppercase">Aguardando Aprovação Comercial ({pendingPlans.length})</h3>
                </div>

                {pendingPlans.length === 0 ? (
                  <div className="p-12 text-center bg-black/40 rounded-3xl border border-white/5">
                    <p className="text-xs text-gray-500 font-sans">Não há solicitações pendentes de análise comercial no momento.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingPlans.map(plan => (
                      <div key={plan.id} className="bg-[#0c0c0c] rounded-3xl border border-white/5 p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center space-x-4">
                          {plan.imageUrl ? (
                            <img src={plan.imageUrl} alt={plan.name} className="w-16 h-16 rounded-2xl object-cover shrink-0" />
                          ) : (
                            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-gray-500 shrink-0">
                              <ImageIcon className="w-6 h-6" />
                            </div>
                          )}
                          <div className="text-left space-y-1">
                            <h4 className="font-orbitron font-black text-sm text-white uppercase">{plan.name}</h4>
                            <p className="text-xs text-gray-400 leading-relaxed max-w-xl">{plan.description}</p>
                            <div className="flex flex-wrap gap-2 pt-1 text-[10px] text-gray-500">
                              <span><strong>Vendedor:</strong> {plan.ownerName} ({plan.ownerEmail || 'Email não disponível'})</span>
                              <span>•</span>
                              <span><strong>Período:</strong> {plan.billingPeriod}</span>
                              <span>•</span>
                              <span><strong>Categoria:</strong> {plan.category}</span>
                            </div>
                            <div className="p-2 bg-black/40 rounded-xl border border-white/5 text-[10px] text-gray-400 mt-2 font-sans max-w-md">
                              <strong>Benefícios inclusos:</strong> {plan.benefits}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end shrink-0 gap-3">
                          <div className="text-right">
                            <span className="text-[10px] text-gray-500 font-orbitron block">VALOR COBRADO</span>
                            <span className="font-orbitron font-black text-lg text-[#FF0033]">{formatBRL(plan.price)}</span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveUserAd(plan)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-orbitron text-[9px] font-black px-4 py-2.5 rounded-xl uppercase transition-all shadow-md cursor-pointer flex items-center space-x-1.5"
                            >
                              <Check className="w-3 h-3" />
                              <span>APROVAR & PUBLICAR</span>
                            </button>
                            <button
                              onClick={() => {
                                setRejectionModalPlan(plan);
                                setRejectionActionType('ajustes');
                              }}
                              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 font-orbitron text-[9px] font-black px-3 py-2.5 rounded-xl uppercase transition-all cursor-pointer flex items-center space-x-1.5"
                            >
                              <Info className="w-3.5 h-3.5" />
                              <span>SOLICITAR AJUSTES</span>
                            </button>
                            <button
                              onClick={() => {
                                setRejectionModalPlan(plan);
                                setRejectionActionType('rejeitar');
                              }}
                              className="bg-red-950 hover:bg-red-900 text-red-400 font-orbitron text-[9px] font-black px-3 py-2.5 rounded-xl uppercase transition-all cursor-pointer flex items-center space-x-1.5"
                            >
                              <X className="w-3 h-3" />
                              <span>REJEITAR</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 5. ACTIVE PLANS TAB */}
            {activeTab === 'active_plans' && (
              <div className="space-y-6">
                <h3 className="font-orbitron font-black text-sm text-white uppercase">Assinaturas Ativas e Expostas no Site ({activePlans.length})</h3>

                {activePlans.length === 0 ? (
                  <div className="p-12 text-center bg-black/40 rounded-3xl border border-white/5">
                    <p className="text-xs text-gray-500 font-sans">Nenhuma assinatura ativa visível para o público neste momento.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activePlans.map(plan => (
                      <div key={plan.id} className="bg-[#0c0c0c] rounded-3xl border border-white/5 p-5 flex flex-col justify-between space-y-4">
                        <div className="flex justify-between">
                          <div>
                            <span className="text-[9px] font-orbitron font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 inline-block mb-2">
                              {plan.ownerType === 'lockdown' ? 'PRODUTORA' : 'PARCEIRO'}
                            </span>
                            <h4 className="font-orbitron font-black text-sm text-white">{plan.name}</h4>
                            <p className="text-[10px] text-gray-400 mt-1">Dono: {plan.ownerName}</p>
                          </div>
                          {plan.imageUrl && (
                            <img src={plan.imageUrl} alt={plan.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                          )}
                        </div>

                        <div className="p-3 bg-black/40 rounded-2xl space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500 font-sans">Preço:</span>
                            <span className="font-orbitron font-black text-white">{formatBRL(plan.price)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 font-sans">Recorrência:</span>
                            <span className="text-gray-300 font-orbitron text-[10px] uppercase">{plan.billingPeriod}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleToggleActive(plan)}
                          className="w-full bg-[#FF0033]/15 hover:bg-[#FF0033]/35 text-[#FF0033] font-orbitron text-[9px] font-black py-2 rounded-xl border border-[#FF0033]/20 uppercase tracking-wider transition-all cursor-pointer"
                        >
                          PAUSAR / DESATIVAR
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 6. INACTIVE PLANS TAB */}
            {activeTab === 'inactive_plans' && (
              <div className="space-y-6">
                <h3 className="font-orbitron font-black text-sm text-white uppercase">Assinaturas Inativas, Pausadas ou Rejeitadas ({inactivePlans.length})</h3>

                {inactivePlans.length === 0 ? (
                  <div className="p-12 text-center bg-black/40 rounded-3xl border border-white/5">
                    <p className="text-xs text-gray-500 font-sans">Não há planos de assinatura inativos no momento.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {inactivePlans.map(plan => (
                      <div key={plan.id} className="bg-[#0c0c0c] rounded-3xl border border-white/5 p-5 flex flex-col justify-between space-y-4">
                        <div>
                          <span className={`text-[8px] font-orbitron font-bold px-2 py-0.5 rounded-full uppercase border inline-block mb-2 ${
                            plan.status === 'Rejeitado' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            plan.status === 'Ajustes solicitados' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                            'bg-gray-500/10 text-gray-400 border-gray-500/20'
                          }`}>
                            {plan.status === 'Aprovado' ? 'PAUSADO/INATIVO' : plan.status.toUpperCase()}
                          </span>
                          <h4 className="font-orbitron font-black text-sm text-white">{plan.name}</h4>
                          <p className="text-[10px] text-gray-400 mt-1">Dono: {plan.ownerName}</p>
                        </div>

                        {plan.rejectionReason && (
                          <div className="p-3 bg-red-950/20 border border-red-500/10 rounded-2xl text-[10px] text-red-400 font-sans">
                            <strong>Motivo/Ajuste:</strong> {plan.rejectionReason}
                          </div>
                        )}

                        {plan.status === 'Aprovado' && (
                          <button
                            onClick={() => handleToggleActive(plan)}
                            className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-orbitron text-[9px] font-black py-2 rounded-xl uppercase tracking-wider transition-all cursor-pointer"
                          >
                            ATIVAR / PUBLICAR
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 7. SUBSCRIBERS & SALES TAB */}
            {activeTab === 'subscribers_sales' && (
              <div className="space-y-6 text-left">
                <div className="flex justify-between items-center">
                  <h3 className="font-orbitron font-black text-sm text-white uppercase">Assinantes Ativos & Registro de Transações Reais ({subscriptionSales.length})</h3>
                </div>

                {subscriptionSales.length === 0 ? (
                  <div className="p-12 text-center bg-black/40 rounded-3xl border border-white/5 space-y-3">
                    <p className="text-xs text-gray-500 font-sans">Nenhuma transação real de assinatura processada ainda.</p>
                    <p className="text-[11px] text-gray-600 font-sans max-w-md mx-auto leading-relaxed">
                      Quando as vendas ocorrerem no site público e o webhook registrar pagamentos confirmados do Mercado Pago para os planos ativos, as transações financeiras serão exibidas aqui.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-3xl border border-white/5 bg-[#0a0a0a]">
                    <table className="w-full text-left text-xs text-gray-400 font-sans border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 font-orbitron font-bold text-gray-400 uppercase text-[9px] bg-white/5">
                          <th className="p-4">DATA</th>
                          <th className="p-4">NOME DO ASSINANTE</th>
                          <th className="p-4">PLANO ADQUIRIDO</th>
                          <th className="p-4">VALOR BRUTO</th>
                          <th className="p-4">COMISSÃO %</th>
                          <th className="p-4">VALOR COMISSÃO</th>
                          <th className="p-4">LÍQUIDO VENDEDOR</th>
                          <th className="p-4">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {subscriptionSales.map((sale) => {
                          const pct = sale.commissionPercent ?? 0;
                          const commValue = sale.commissionValue ?? (sale.grossValue * (pct / 100));
                          const netValue = sale.netValue ?? (sale.grossValue - commValue);

                          return (
                            <tr key={sale.id} className="hover:bg-white/5 transition-all">
                              <td className="p-4 text-[10px] whitespace-nowrap">
                                {new Date(sale.date).toLocaleDateString('pt-BR')} {new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="p-4 font-bold text-white whitespace-nowrap">
                                {sale.user} ({sale.userId})
                              </td>
                              <td className="p-4 text-white whitespace-nowrap">{sale.item}</td>
                              <td className="p-4 font-orbitron font-bold text-white whitespace-nowrap">
                                {formatBRL(sale.grossValue)}
                              </td>
                              <td className="p-4 font-orbitron text-gray-500 whitespace-nowrap">{pct}%</td>
                              <td className="p-4 font-orbitron text-red-400 whitespace-nowrap">
                                {formatBRL(commValue)}
                              </td>
                              <td className="p-4 font-orbitron text-emerald-400 whitespace-nowrap">
                                {formatBRL(netValue)}
                              </td>
                              <td className="p-4 whitespace-nowrap">
                                <span className={`text-[9px] font-orbitron font-bold px-2 py-0.5 rounded-full ${
                                  sale.status === 'Pago' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                  'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                }`}>
                                  {sale.status.toUpperCase()}
                                </span>
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

            {/* 8. COMMISSIONS SETTINGS TAB */}
            {activeTab === 'settings_commissions' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-orbitron font-black text-sm text-white uppercase">Taxas e Comissões do Marketplace de Assinaturas</h3>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-xl">
                    Configure a porcentagem real cobrada pela Lockdown Produtora para hospedar, processar e promover os planos de assinatura anunciados por parceiros e usuários.
                  </p>
                </div>

                {commissions ? (
                  <form onSubmit={handleSaveCommission} className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 max-w-md space-y-4">
                    <div>
                      <label className="text-[10px] font-orbitron font-bold text-gray-400 block mb-1 uppercase tracking-wider">
                        COMISSÃO DE ASSINATURAS (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={commissions.subscriptionCommissionPercent || 0}
                          onChange={(e) => setCommissions({ ...commissions, subscriptionCommissionPercent: parseFloat(e.target.value) || 0 })}
                          placeholder="10"
                          min="0"
                          max="100"
                          className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-[#FF0033] focus:outline-none font-orbitron font-bold"
                          required
                        />
                        <div className="absolute right-3 top-2.5 text-xs text-gray-500 font-orbitron font-bold">%</div>
                      </div>
                      <p className="text-[9px] text-gray-500 mt-1 font-sans">Cada nova venda processada em planos de parceiros irá reter essa taxa.</p>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex justify-end">
                      <button
                        type="submit"
                        className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron text-[10px] font-bold px-5 py-2.5 rounded-xl transition-all uppercase cursor-pointer"
                      >
                        SALVAR COMISSÃO NO FIRESTORE
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="text-xs text-gray-500 animate-pulse">Carregando formulário de comissões...</p>
                )}
              </div>
            )}

          </div>
        )}
      </div>

      {/* REJECTION / CHANGES MODAL */}
      <AnimatePresence>
        {rejectionModalPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0a0a0a] border-2 border-white/10 max-w-md w-full p-6 rounded-3xl space-y-4 text-left relative"
            >
              <h4 className="font-orbitron font-black text-sm text-white uppercase border-b border-white/5 pb-2">
                {rejectionActionType === 'rejeitar' ? 'REJEITAR ANÚNCIO DE ASSINATURA' : 'SOLICITAR AJUSTES NO ANÚNCIO'}
              </h4>
              <p className="text-xs text-gray-400 font-sans leading-relaxed">
                Insira o motivo detalhado. O proprietário <strong>{rejectionModalPlan.ownerName}</strong> visualizará esta justificativa em seu painel privado.
              </p>
              
              <textarea
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="Ex: É necessário reajustar a imagem de capa ou descrever de forma mais clara os benefícios exclusivos do fã clube."
                rows={4}
                className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white focus:border-[#FF0033] focus:outline-none"
                required
              />

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => {
                    setRejectionModalPlan(null);
                    setRejectionReasonInput('');
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white font-orbitron text-[9px] font-bold px-4 py-2 rounded-xl uppercase cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  onClick={handleRejectOrAdjustAction}
                  className="bg-red-700 hover:bg-red-800 text-white font-orbitron text-[9px] font-bold px-4 py-2 rounded-xl uppercase cursor-pointer"
                >
                  CONFIRMAR AÇÃO
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
