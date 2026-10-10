import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Check, 
  X, 
  MessageSquare, 
  Percent, 
  Clock, 
  AlertTriangle, 
  Eye, 
  Send, 
  User, 
  Calendar, 
  DollarSign, 
  Award, 
  ShoppingBag, 
  Ticket, 
  Layers, 
  CheckCircle2, 
  XCircle,
  FileText
} from 'lucide-react';
import { 
  fetchSubscriptionPlans, 
  saveSubscriptionPlan, 
  fetchSupportTickets, 
  saveSupportTicket, 
  fetchCommissionSettings, 
  saveCommissionSettings, 
  fetchStoreProducts, 
  saveStoreProduct, 
  fetchShows, 
  saveShow,
  createNotification,
  SubscriptionPlan,
  SupportTicket,
  CommissionSettings,
  DEFAULT_COMMISSION_SETTINGS
} from '../../utils/storeDb';
import { formatBRL } from '../../utils/money';

interface SupportRequestsModuleProps {
  onBackToMenu: () => void;
}

type AdminTab = 'approvals' | 'support' | 'commissions';
type ApprovalSubTab = 'store' | 'tickets' | 'subscriptions';

export const SupportRequestsModule: React.FC<SupportRequestsModuleProps> = ({ onBackToMenu }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('approvals');
  const [approvalSubTab, setApprovalSubTab] = useState<ApprovalSubTab>('store');

  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Data states
  const [pendingProducts, setPendingProducts] = useState<any[]>([]);
  const [pendingShows, setPendingShows] = useState<any[]>([]);
  const [pendingPlans, setPendingPlans] = useState<SubscriptionPlan[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [commissions, setCommissions] = useState<CommissionSettings>(DEFAULT_COMMISSION_SETTINGS);

  // Selected item modal/view states
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  
  // Rejection modal state
  const [rejectionTarget, setRejectionTarget] = useState<{ type: ApprovalSubTab; id: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Load all data
  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [prods, shows, plans, tkts, comms] = await Promise.all([
        fetchStoreProducts(),
        fetchShows(),
        fetchSubscriptionPlans(),
        fetchSupportTickets(),
        fetchCommissionSettings()
      ]);

      // Filter to keep user requests or items with status
      setPendingProducts((prods as any[]).filter(p => p.status && p.status !== 'Aprovado'));
      setPendingShows((shows as any[]).filter(s => s.status && s.status !== 'Aprovado' && s.status !== 'Publicado'));
      setPendingPlans(plans.filter(p => p.status && p.status !== 'Aprovado'));
      setTickets(tkts);
      setCommissions(comms || DEFAULT_COMMISSION_SETTINGS);
    } catch (err: any) {
      console.warn("Notice: Failed to load requests and support data from remote database, using local fallback:", err);
      // Don't set blocking error message if local cache data is available
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Commission save
  const handleSaveCommissions = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveCommissionSettings(commissions);
      triggerSuccess("Taxas de comissão salvas e aplicadas em todo o ecossistema!");
    } catch (err: any) {
      setErrorMsg("Erro ao salvar taxas de comissão: " + err.message);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // Approvals & Rejections Actions
  const handleApprove = async (type: ApprovalSubTab, id: string) => {
    try {
      if (type === 'store') {
        const prod = pendingProducts.find(p => p.id === id);
        if (prod) {
          const updated = { ...prod, status: 'Aprovado' as const };
          await saveStoreProduct(updated);
          await createNotification(
            prod.sellerId || prod.sellerName,
            "Produto Aprovado! 🎉",
            `Seu produto "${prod.name}" foi analisado e aprovado pelo administrador. Ele já está público na Lockdown Store!`
          );
          triggerSuccess(`Produto "${prod.name}" aprovado com sucesso!`);
        }
      } else if (type === 'tickets') {
        const show = pendingShows.find(s => s.id === id);
        if (show) {
          const updated = { ...show, status: 'Aprovado' as const };
          await saveShow(updated);
          await createNotification(
            show.organizerId || show.organizerName,
            "Evento Aprovado! 🎫",
            `Seu evento "${show.city} - ${show.venue}" foi aprovado pelo administrador e já está listado para venda de ingressos!`
          );
          triggerSuccess(`Evento em "${show.city}" aprovado com sucesso!`);
        }
      } else if (type === 'subscriptions') {
        const plan = pendingPlans.find(p => p.id === id);
        if (plan) {
          const updated = { ...plan, status: 'Aprovado' as const };
          await saveSubscriptionPlan(updated);
          await createNotification(
            plan.sellerId || plan.sellerName,
            "Plano de Assinatura Aprovado! ⭐",
            `Seu plano de assinatura "${plan.name}" foi analisado e aprovado. Ele já está listado na plataforma!`
          );
          triggerSuccess(`Plano "${plan.name}" aprovado com sucesso!`);
        }
      }
      loadAdminData();
    } catch (err: any) {
      setErrorMsg("Erro ao aprovar solicitação: " + err.message);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const handleOpenRejection = (type: ApprovalSubTab, id: string) => {
    setRejectionTarget({ type, id });
    setRejectionReason('');
  };

  const handleConfirmRejection = async () => {
    if (!rejectionTarget) return;
    const { type, id } = rejectionTarget;
    if (!rejectionReason.trim()) {
      alert("Por favor, preencha o motivo da rejeição.");
      return;
    }

    try {
      if (type === 'store') {
        const prod = pendingProducts.find(p => p.id === id);
        if (prod) {
          const updated = { ...prod, status: 'Rejeitado' as const, rejectionReason };
          await saveStoreProduct(updated);
          await createNotification(
            prod.sellerId || prod.sellerName,
            "Produto Rejeitado ⚠️",
            `Sua solicitação de produto "${prod.name}" foi recusada. Motivo: ${rejectionReason}`
          );
          triggerSuccess(`Produto "${prod.name}" rejeitado.`);
        }
      } else if (type === 'tickets') {
        const show = pendingShows.find(s => s.id === id);
        if (show) {
          const updated = { ...show, status: 'Rejeitado' as const, rejectionReason };
          await saveShow(updated);
          await createNotification(
            show.organizerId || show.organizerName,
            "Evento Rejeitado ⚠️",
            `Sua solicitação de evento "${show.city} - ${show.venue}" foi recusada. Motivo: ${rejectionReason}`
          );
          triggerSuccess(`Evento rejeitado.`);
        }
      } else if (type === 'subscriptions') {
        const plan = pendingPlans.find(p => p.id === id);
        if (plan) {
          const updated = { ...plan, status: 'Rejeitado' as const, rejectionReason };
          await saveSubscriptionPlan(updated);
          await createNotification(
            plan.sellerId || plan.sellerName,
            "Plano VIP Rejeitado ⚠️",
            `Seu plano de assinatura "${plan.name}" foi recusado. Motivo: ${rejectionReason}`
          );
          triggerSuccess(`Plano de assinatura rejeitado.`);
        }
      }
      setRejectionTarget(null);
      loadAdminData();
    } catch (err: any) {
      setErrorMsg("Erro ao rejeitar solicitação: " + err.message);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // Support conversation logic
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    try {
      const updatedMessages = [
        ...selectedTicket.messages,
        {
          sender: 'admin' as const,
          message: replyMessage,
          timestamp: new Date().toLocaleTimeString('pt-BR')
        }
      ];

      const updatedTicket: SupportTicket = {
        ...selectedTicket,
        status: 'Aguardando usuário',
        messages: updatedMessages
      };

      await saveSupportTicket(updatedTicket);
      
      // Update local lists
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
      setSelectedTicket(updatedTicket);
      setReplyMessage('');
      
      // Notify user
      await createNotification(
        selectedTicket.userId,
        "Novo Retorno no Suporte! 💬",
        `O administrador respondeu ao seu chamado sobre "${selectedTicket.subject}". Verifique seu painel.`
      );
      
      triggerSuccess("Resposta enviada com sucesso!");
    } catch (err: any) {
      alert("Erro ao responder chamado: " + err.message);
    }
  };

  const handleChangeTicketStatus = async (status: SupportTicket['status']) => {
    if (!selectedTicket) return;
    try {
      const updatedTicket: SupportTicket = {
        ...selectedTicket,
        status
      };
      await saveSupportTicket(updatedTicket);
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t));
      setSelectedTicket(updatedTicket);
      triggerSuccess(`Status do chamado alterado para "${status}"`);
    } catch (err: any) {
      alert("Erro ao alterar status: " + err.message);
    }
  };

  return (
    <div className="h-full flex flex-col justify-between p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* Upper header action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-gray-200 gap-4 mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToMenu}
            className="flex items-center space-x-2 bg-white hover:bg-gray-100 border border-gray-300 px-4 py-2 rounded-xl text-xs font-orbitron text-gray-700 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>MENU PRINCIPAL</span>
          </button>
          <div>
            <span className="font-orbitron text-[10px] text-[#FF0033] tracking-widest block font-bold leading-none mb-1">MÓDULO 08</span>
            <h1 className="font-orbitron font-black text-xl text-black">SOLICITAÇÕES, SUPORTE & COMISSÕES</h1>
          </div>
        </div>

        {/* Sync button */}
        <button
          onClick={loadAdminData}
          disabled={isLoading}
          className="px-4 py-2 bg-gray-100 border border-gray-300 hover:bg-gray-200 text-black font-orbitron text-xs font-bold rounded-xl transition-all disabled:opacity-50"
        >
          {isLoading ? 'Sincronizando...' : 'Atualizar Tudo'}
        </button>
      </div>

      {/* Main feedback messages */}
      {commissions.isConfigured === false && (
        <div className="mb-6 p-5 bg-amber-50 border-2 border-amber-500/30 text-amber-900 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-sans shadow-xs">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-orbitron font-bold text-xs tracking-wider uppercase text-amber-950">Aviso: Comissões Não Configuradas</p>
              <p className="text-xs text-amber-800 mt-1">A plataforma ainda não possui taxas de comissão ativas gravadas no banco de dados. Configure as taxas para garantir o faturamento correto.</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('commissions')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-orbitron text-[10px] font-black uppercase rounded-xl tracking-wider transition-all"
          >
            Configurar Agora
          </button>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-2xl flex items-center space-x-2 text-xs font-bold font-orbitron">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-[#FF0033] rounded-2xl flex items-center space-x-2 text-xs font-bold font-orbitron">
          <XCircle className="w-5 h-5 text-[#FF0033] shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Primary tabs select */}
      <div className="flex border-b border-gray-200 pb-px mb-8 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-5 py-3 border-b-2 font-orbitron text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'approvals' 
              ? 'border-[#FF0033] text-[#FF0033]' 
              : 'border-transparent text-gray-500 hover:text-black'
          }`}
        >
          Solicitações de Publicação ({pendingProducts.length + pendingShows.length + pendingPlans.length})
        </button>
        <button
          onClick={() => setActiveTab('support')}
          className={`px-5 py-3 border-b-2 font-orbitron text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'support' 
              ? 'border-[#FF0033] text-[#FF0033]' 
              : 'border-transparent text-gray-500 hover:text-black'
          }`}
        >
          Chamados de Suporte ({tickets.filter(t => t.status === 'Aberto' || t.status === 'Em atendimento').length})
        </button>
        <button
          onClick={() => setActiveTab('commissions')}
          className={`px-5 py-3 border-b-2 font-orbitron text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'commissions' 
              ? 'border-[#FF0033] text-[#FF0033]' 
              : 'border-transparent text-gray-500 hover:text-black'
          }`}
        >
          Configurador de Comissão
        </button>
      </div>

      {/* Workspace block content */}
      <div className="flex-1 min-h-[450px]">
        
        {/* TAB 1: APPROVALS */}
        {activeTab === 'approvals' && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-4">
              <button
                onClick={() => setApprovalSubTab('store')}
                className={`px-4 py-2 rounded-xl font-orbitron text-[11px] font-bold transition-all ${
                  approvalSubTab === 'store' 
                    ? 'bg-black text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Store Products ({pendingProducts.length})
              </button>
              <button
                onClick={() => setApprovalSubTab('tickets')}
                className={`px-4 py-2 rounded-xl font-orbitron text-[11px] font-bold transition-all ${
                  approvalSubTab === 'tickets' 
                    ? 'bg-black text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Eventos & Shows ({pendingShows.length})
              </button>
              <button
                onClick={() => setApprovalSubTab('subscriptions')}
                className={`px-4 py-2 rounded-xl font-orbitron text-[11px] font-bold transition-all ${
                  approvalSubTab === 'subscriptions' 
                    ? 'bg-black text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Assinaturas VIP ({pendingPlans.length})
              </button>
            </div>

            {/* List for each approval class */}
            {approvalSubTab === 'store' && (
              <div className="space-y-4">
                {pendingProducts.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-3xl font-orbitron text-xs">
                    Nenhuma solicitação de publicação de produto pendente de análise.
                  </div>
                ) : (
                  pendingProducts.map((p) => (
                    <div key={p.id} className="bg-white border border-gray-200 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center">
                          {p.image || p.images?.[0] ? (
                            <img src={p.image || p.images?.[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <ShoppingBag className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] bg-red-150 text-[#FF0033] font-orbitron font-bold px-2 py-0.5 rounded-full uppercase leading-none">{p.category}</span>
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-orbitron font-bold px-2 py-0.5 rounded-full uppercase leading-none">{p.status}</span>
                          </div>
                          <h3 className="font-orbitron font-black text-md text-black mt-1 leading-tight">{p.name}</h3>
                          <p className="text-xs text-gray-600 font-sans mt-1 line-clamp-1">{p.shortDesc || p.description}</p>
                          <div className="flex items-center space-x-4 mt-2 text-[11px] text-gray-500 font-orbitron">
                            <span>Preço: <strong className="text-black">{p.price}</strong></span>
                            <span>Autor: <strong className="text-black">{p.sellerName || p.sellerId}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 border-t md:border-t-0 pt-4 md:pt-0 shrink-0">
                        <button
                          onClick={() => handleApprove('store', p.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-orbitron text-xs font-bold rounded-xl flex items-center space-x-1 cursor-pointer transition-all shadow-sm"
                        >
                          <Check className="w-4 h-4" />
                          <span>APROVAR & PUBLICAR</span>
                        </button>
                        <button
                          onClick={() => handleOpenRejection('store', p.id)}
                          className="px-4 py-2 bg-white border border-red-200 hover:bg-red-50 text-[#FF0033] font-orbitron text-xs font-bold rounded-xl flex items-center space-x-1 cursor-pointer transition-all shadow-sm"
                        >
                          <X className="w-4 h-4" />
                          <span>REJEITAR</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {approvalSubTab === 'tickets' && (
              <div className="space-y-4">
                {pendingShows.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-3xl font-orbitron text-xs">
                    Nenhuma solicitação de criação de evento pendente de análise.
                  </div>
                ) : (
                  pendingShows.map((s) => (
                    <div key={s.id} className="bg-white border border-gray-200 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center">
                          {s.imageUrl ? (
                            <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Ticket className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] bg-red-150 text-[#FF0033] font-orbitron font-bold px-2 py-0.5 rounded-full uppercase leading-none">SHOWS / EVENTO</span>
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-orbitron font-bold px-2 py-0.5 rounded-full uppercase leading-none">{s.status}</span>
                          </div>
                          <h3 className="font-orbitron font-black text-md text-black mt-1 leading-tight">{s.city} - {s.venue}</h3>
                          <p className="text-xs text-gray-600 font-sans mt-1 line-clamp-1">{s.description || s.info || 'Sem informações adicionais'}</p>
                          <div className="flex items-center space-x-4 mt-2 text-[11px] text-gray-500 font-orbitron">
                            <span>Data: <strong className="text-black">{s.date}</strong></span>
                            <span>Preço Base: <strong className="text-black">{formatBRL(s.price || 0)}</strong></span>
                            <span>Organizador: <strong className="text-black">{s.organizerName || s.organizerId}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 border-t md:border-t-0 pt-4 md:pt-0 shrink-0">
                        <button
                          onClick={() => handleApprove('tickets', s.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-orbitron text-xs font-bold rounded-xl flex items-center space-x-1 cursor-pointer transition-all shadow-sm"
                        >
                          <Check className="w-4 h-4" />
                          <span>APROVAR & LISTAR</span>
                        </button>
                        <button
                          onClick={() => handleOpenRejection('tickets', s.id)}
                          className="px-4 py-2 bg-white border border-red-200 hover:bg-red-50 text-[#FF0033] font-orbitron text-xs font-bold rounded-xl flex items-center space-x-1 cursor-pointer transition-all shadow-sm"
                        >
                          <X className="w-4 h-4" />
                          <span>REJEITAR</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {approvalSubTab === 'subscriptions' && (
              <div className="space-y-4">
                {pendingPlans.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-3xl font-orbitron text-xs">
                    Nenhuma solicitação de publicação de assinatura VIP pendente.
                  </div>
                ) : (
                  pendingPlans.map((plan) => (
                    <div key={plan.id} className="bg-white border border-gray-200 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
                      <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 rounded-2xl bg-red-100 text-[#FF0033] shrink-0 flex items-center justify-center font-black font-orbitron">
                          VIP
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] bg-[#FF0033] text-white font-orbitron font-bold px-2 py-0.5 rounded-full uppercase leading-none">{plan.periodicity}</span>
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-orbitron font-bold px-2 py-0.5 rounded-full uppercase leading-none">{plan.status}</span>
                          </div>
                          <h3 className="font-orbitron font-black text-md text-black mt-1 leading-tight">{plan.name}</h3>
                          <p className="text-xs text-gray-600 font-sans mt-1 line-clamp-1">{plan.benefits}</p>
                          <div className="flex items-center space-x-4 mt-2 text-[11px] text-gray-500 font-orbitron">
                            <span>Valor: <strong className="text-black">{formatBRL(plan.price)}</strong></span>
                            <span>Proponente: <strong className="text-black">{plan.sellerName}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 border-t md:border-t-0 pt-4 md:pt-0 shrink-0">
                        <button
                          onClick={() => handleApprove('subscriptions', plan.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-orbitron text-xs font-bold rounded-xl flex items-center space-x-1 cursor-pointer transition-all shadow-sm"
                        >
                          <Check className="w-4 h-4" />
                          <span>APROVAR & INICIAR</span>
                        </button>
                        <button
                          onClick={() => handleOpenRejection('subscriptions', plan.id)}
                          className="px-4 py-2 bg-white border border-red-200 hover:bg-red-50 text-[#FF0033] font-orbitron text-xs font-bold rounded-xl flex items-center space-x-1 cursor-pointer transition-all shadow-sm"
                        >
                          <X className="w-4 h-4" />
                          <span>REJEITAR</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SUPPORT TICKETS */}
        {activeTab === 'support' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Ticket List */}
            <div className="lg:col-span-4 space-y-3">
              <h3 className="font-orbitron font-black text-sm text-black mb-4">CHAMADOS RECEBIDOS</h3>
              {tickets.length === 0 ? (
                <div className="py-12 text-center text-gray-500 font-orbitron text-xs">
                  Nenhum chamado registrado no banco de dados.
                </div>
              ) : (
                tickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                      selectedTicket?.id === t.id 
                        ? 'border-[#FF0033] bg-red-50/20' 
                        : 'border-gray-200 bg-white hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full font-orbitron font-bold uppercase">{t.category}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-orbitron font-bold uppercase ${
                        t.status === 'Aberto' ? 'bg-red-100 text-[#FF0033]' :
                        t.status === 'Em atendimento' ? 'bg-sky-100 text-sky-800' :
                        t.status === 'Resolvido' ? 'bg-emerald-150 text-emerald-800' : 'bg-gray-100 text-gray-600'
                      }`}>{t.status}</span>
                    </div>
                    <h4 className="font-orbitron font-bold text-xs text-black truncate leading-tight">{t.subject}</h4>
                    <p className="text-[10px] text-gray-600 font-sans line-clamp-1 mt-1">{t.message}</p>
                    <div className="flex items-center justify-between mt-3 text-[9px] text-gray-400 font-orbitron">
                      <span>{t.userName}</span>
                      <span>{t.createdAt.split(' ')[0]}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Selected Ticket Conversation Chat Screen */}
            <div className="lg:col-span-8 bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between min-h-[480px]">
              {selectedTicket ? (
                <>
                  {/* Chat header panel */}
                  <div className="p-5 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <span className="text-[10px] bg-red-150 text-[#FF0033] font-orbitron font-bold px-2.5 py-1 rounded-full uppercase">{selectedTicket.category}</span>
                      <h3 className="font-orbitron font-black text-sm text-black mt-2 leading-tight">{selectedTicket.subject}</h3>
                      <p className="text-[10px] text-gray-600 mt-1">Aberto por: <strong>{selectedTicket.userName}</strong> ({selectedTicket.userId})</p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {(['Aberto', 'Em atendimento', 'Resolvido', 'Fechado'] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => handleChangeTicketStatus(st)}
                          className={`px-3 py-1.5 rounded-xl font-orbitron text-[9px] font-bold transition-all cursor-pointer ${
                            selectedTicket.status === st 
                              ? 'bg-black text-white' 
                              : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Messages box */}
                  <div className="p-6 flex-1 overflow-y-auto space-y-4 max-h-[300px]">
                    {selectedTicket.messages.map((m, idx) => (
                      <div key={idx} className={`flex flex-col ${m.sender === 'admin' ? 'items-end' : 'items-start'}`}>
                        <div className={`p-4 rounded-3xl max-w-[80%] text-sm ${
                          m.sender === 'admin' 
                            ? 'bg-[#FF0033] text-white rounded-tr-none' 
                            : 'bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200'
                        }`}>
                          <p className="leading-relaxed whitespace-pre-wrap">{m.message}</p>
                        </div>
                        <span className="text-[9px] text-gray-400 mt-1 font-orbitron tracking-wider">
                          {m.sender === 'admin' ? 'Administrador' : selectedTicket.userName} • {m.timestamp}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Message Input box */}
                  <form onSubmit={handleSendReply} className="p-4 border-t border-gray-100 bg-gray-50 flex items-center space-x-3">
                    <input
                      type="text"
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Digite a resposta oficial do suporte aqui..."
                      className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-xl text-xs text-black focus:border-[#FF0033] outline-none"
                    />
                    <button
                      type="submit"
                      className="p-3 bg-[#FF0033] hover:bg-red-700 text-white rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="py-24 text-center text-gray-400 space-y-3 flex flex-col items-center justify-center flex-1">
                  <MessageSquare className="w-12 h-12 text-gray-300" />
                  <p className="font-orbitron font-bold text-sm text-gray-500">SELECIONE UM CHAMADO PARA VISUALIZAR A CONVERSA</p>
                  <p className="text-xs text-gray-400 max-w-sm">Toda a comunicação com os usuários é feita em tempo real e registrada nesta central.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: COMMISSION CONFIGURATOR */}
        {activeTab === 'commissions' && (
          <div className="max-w-2xl mx-auto bg-white border border-gray-200 p-8 rounded-3xl shadow-sm text-left">
            <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-100">
              <div className="w-12 h-12 bg-red-100 text-[#FF0033] rounded-2xl flex items-center justify-center">
                <Percent className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-orbitron font-black text-lg text-black">TAXAS DE COMISSÃO DA PLATAFORMA</h3>
                <p className="text-xs text-gray-600 mt-0.5">Determine a taxa cobrada pela Lockdown para cada venda efetuada por terceiros.</p>
              </div>
            </div>

            <form onSubmit={handleSaveCommissions} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-[11px] font-orbitron font-bold text-gray-500 uppercase mb-2">Store (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={commissions.storeCommissionPercent || 0}
                      onChange={(e) => setCommissions({ ...commissions, storeCommissionPercent: Number(e.target.value) })}
                      className="w-full px-3 py-3 bg-white border border-gray-300 rounded-xl text-sm font-bold text-black focus:border-[#FF0033] outline-none"
                    />
                    <span className="absolute right-3 top-3.5 text-gray-400 text-xs font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 font-sans">Vestuário / Produtos</p>
                </div>

                <div>
                  <label className="block text-[11px] font-orbitron font-bold text-gray-500 uppercase mb-2">Ingressos (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={commissions.ticketCommissionPercent || 0}
                      onChange={(e) => setCommissions({ ...commissions, ticketCommissionPercent: Number(e.target.value) })}
                      className="w-full px-3 py-3 bg-white border border-gray-300 rounded-xl text-sm font-bold text-black focus:border-[#FF0033] outline-none"
                    />
                    <span className="absolute right-3 top-3.5 text-gray-400 text-xs font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 font-sans font-medium">Bilheteria / Ingressos</p>
                </div>

                <div>
                  <label className="block text-[11px] font-orbitron font-bold text-gray-500 uppercase mb-2">Assinaturas (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={commissions.subscriptionCommissionPercent || 0}
                      onChange={(e) => setCommissions({ ...commissions, subscriptionCommissionPercent: Number(e.target.value) })}
                      className="w-full px-3 py-3 bg-white border border-gray-300 rounded-xl text-sm font-bold text-black focus:border-[#FF0033] outline-none"
                    />
                    <span className="absolute right-3 top-3.5 text-gray-400 text-xs font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 font-sans">Clube VIP / Recorrente</p>
                </div>

                <div>
                  <label className="block text-[11px] font-orbitron font-bold text-gray-500 uppercase mb-2">Serviços (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={commissions.serviceCommissionPercent || 0}
                      onChange={(e) => setCommissions({ ...commissions, serviceCommissionPercent: Number(e.target.value) })}
                      className="w-full px-3 py-3 bg-white border border-gray-300 rounded-xl text-sm font-bold text-black focus:border-[#FF0033] outline-none"
                    />
                    <span className="absolute right-3 top-3.5 text-gray-400 text-xs font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 font-sans">Estúdio / Gravações</p>
                </div>

                <div>
                  <label className="block text-[11px] font-orbitron font-bold text-gray-500 uppercase mb-2">Outros (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={commissions.otherCommissionPercent || 0}
                      onChange={(e) => setCommissions({ ...commissions, otherCommissionPercent: Number(e.target.value) })}
                      className="w-full px-3 py-3 bg-white border border-gray-300 rounded-xl text-sm font-bold text-black focus:border-[#FF0033] outline-none"
                    />
                    <span className="absolute right-3 top-3.5 text-gray-400 text-xs font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 font-sans">Gerais / Futuros</p>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex items-start space-x-3 text-xs font-sans mt-6">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Aviso sobre Mudanças de Taxa</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">As novas alíquotas de comissão serão calculadas sobre todas as transações criadas a partir deste momento. Elas não alterarão o valor líquido de vendas já registradas retroativamente.</p>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-[#FF0033] hover:bg-red-700 text-white font-orbitron text-xs font-black rounded-xl tracking-wider uppercase cursor-pointer transition-all shadow-md"
              >
                Salvar Configurações de Comissão
              </button>
            </form>
          </div>
        )}

      </div>

      {/* REJECTION MODAL SCREEN */}
      <AnimatePresence>
        {rejectionTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-gray-200 max-w-md w-full rounded-3xl p-6 shadow-xl text-left"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <h3 className="font-orbitron font-black text-sm text-[#FF0033] uppercase">Recusar Solicitação</h3>
                <button
                  onClick={() => setRejectionTarget(null)}
                  className="p-1.5 hover:bg-gray-100 rounded-full cursor-pointer text-gray-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="py-4 space-y-4">
                <p className="text-xs text-gray-600 leading-relaxed font-sans">
                  Insira o motivo da recusa abaixo. Este detalhe será notificado na área logada do usuário, orientando quais ajustes devem ser feitos para uma aprovação futura.
                </p>
                <div>
                  <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase mb-1.5">Motivo da Rejeição</label>
                  <textarea
                    rows={4}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Ex: Resolução de imagem inadequada ou dados cadastrais de preço inconsistentes..."
                    className="w-full p-4 bg-gray-50 border border-gray-300 rounded-xl text-xs text-black focus:border-[#FF0033] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-4 border-t border-gray-100">
                <button
                  onClick={handleConfirmRejection}
                  className="flex-1 py-3 bg-[#FF0033] hover:bg-red-700 text-white font-orbitron text-xs font-bold rounded-xl cursor-pointer text-center"
                >
                  CONFIRMAR REJEIÇÃO
                </button>
                <button
                  onClick={() => setRejectionTarget(null)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron text-xs font-bold rounded-xl cursor-pointer text-center"
                >
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
