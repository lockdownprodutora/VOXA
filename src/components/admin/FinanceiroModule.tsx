import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Wallet, 
  Clock, 
  Lock, 
  ArrowDownLeft, 
  ArrowUpRight, 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  Ticket, 
  Plus, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle,
  FileText,
  ShieldCheck,
  RefreshCw,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, getDocs, getDoc, doc, setDoc, addDoc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { formatBRL } from '../../utils/money';

interface FinanceiroModuleProps {
  currentUser: any;
  adminRole: 'ADMINISTRATOR' | 'MANAGER' | 'SUPPORT' | 'NONE';
}

export function FinanceiroModule({ currentUser, adminRole }: FinanceiroModuleProps) {
  // If Manager or Support accesses, show strict 403 Acesso Negado
  if (adminRole !== 'ADMINISTRATOR') {
    return (
      <div className="bg-white rounded-3xl border border-red-200 p-12 max-w-md mx-auto text-center space-y-6 shadow-xl text-black my-12">
        <span className="font-orbitron text-red-500 text-6xl block">⚠️</span>
        <h2 className="font-orbitron font-black text-2xl text-black uppercase tracking-wider">Acesso Negado</h2>
        <p className="text-xs text-gray-500 font-sans leading-relaxed">
          Sua conta administrativa possui o cargo de **{adminRole}**. 
          Permissões e relatórios financeiros confidenciais são restritos exclusivamente a **Administradores** do sistema.
        </p>
      </div>
    );
  }

  const [subTab, setSubTab] = useState<'overview' | 'wallets' | 'transactions' | 'adjustments'>('overview');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Overview metrics
  const [metrics, setMetrics] = useState({
    platformGrossRevenue: 0,
    platformNetRevenue: 0,
    totalUserDeposits: 0,
    userWalletsLiability: 0,
    userPendingLiability: 0,
    userBlockedLiability: 0,
    userPromoLiability: 0,
    totalStoreSales: 0,
    totalTicketSales: 0,
    totalSubscriptions: 0,
    totalVoxAds: 0,
    totalPaidMessages: 0,
    totalRefunds: 0,
    walletsCount: 0,
    sussurroRevenueTotal: 0,
    sussurroRevealsCount: 0,
    sussurroWalletPays: 0,
    sussurroPixPays: 0
  });

  const [revealPriceConfig, setRevealPriceConfig] = useState('0.99');
  const [savingPrice, setSavingPrice] = useState(false);

  // Wallet list
  const [wallets, setWallets] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Transactions ledger list
  const [transactions, setTransactions] = useState<any[]>([]);

  // Filters State
  const [txUserFilter, setTxUserFilter] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState('ALL');
  const [txStatusFilter, setTxStatusFilter] = useState('ALL');
  
  // Manual Adjustment Form States
  const [adjUserEmail, setAdjUserEmail] = useState('');
  const [adjType, setAdjType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);

  const handleSavePriceConfig = async () => {
    setSavingPrice(true);
    try {
      const response = await fetch("/api/admin/sussurro/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revealPrice: revealPriceConfig })
      });
      const data = await response.json();
      if (data.success) {
        alert("Preço de revelação do Sussurro atualizado com sucesso!");
      } else {
        alert("Erro ao atualizar preço: " + data.error);
      }
    } catch (err: any) {
      alert("Erro ao conectar ao servidor: " + err.message);
    } finally {
      setSavingPrice(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, []);

  const loadFinancialData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const uid = currentUser?.uid || currentUser?.id || '';
      let apiOverviewLoaded = false;

      try {
        const response = await fetch(`/api/admin/wallet/overview?adminUid=${encodeURIComponent(uid)}`, {
          headers: {
            'x-admin-uid': uid
          }
        });

        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (data && data.success) {
            setMetrics({
              platformGrossRevenue: data.platformGrossRevenue || 0,
              platformNetRevenue: data.platformNetRevenue || 0,
              totalUserDeposits: data.grossDeposits || 0,
              userWalletsLiability: data.totalLiability || 0,
              userPendingLiability: data.userPendingLiability || 0,
              userBlockedLiability: data.userBlockedLiability || 0,
              totalStoreSales: data.totalPurchases || 0,
              totalTicketSales: data.totalTickets || 0,
              totalSubscriptions: data.totalSubscriptions || 0,
              totalVoxAds: data.totalVoxAds || 0,
              totalPaidMessages: data.totalPaidMessages || 0,
              totalRefunds: data.totalRefunds || 0,
              walletsCount: data.totalWalletsCount || 0,
              sussurroRevenueTotal: data.sussurroRevenueTotal || 0,
              sussurroRevealsCount: data.sussurroRevealsCount || 0,
              sussurroWalletPays: data.sussurroWalletPays || 0,
              sussurroPixPays: data.sussurroPixPays || 0
            });
            apiOverviewLoaded = true;
          }
        }
      } catch {
        // Fallback to direct Firestore aggregation below
      }

      // Fetch Sussurros Config
      try {
        const configRes = await fetch("/api/admin/sussurro/config");
        if (configRes.ok) {
          const configData = await configRes.json();
          if (configData.success) {
            setRevealPriceConfig(String(configData.revealPrice));
          }
        }
      } catch {}

      // Fetch user lists and wallet documents directly from Firestore
      const usersSnap = await getDocs(collection(db, 'users'));
      const uList: any[] = [];
      usersSnap.forEach(d => {
        uList.push({ id: d.id, ...d.data() });
      });
      setAllUsers(uList);

      const walletsSnap = await getDocs(collection(db, 'wallets'));
      const wList: any[] = [];
      let totalLiability = 0;
      let userPendingLiability = 0;
      let userBlockedLiability = 0;
      let userPromoLiability = 0;

      walletsSnap.forEach(d => {
        const wData = d.data();
        const userObj = uList.find(u => u.uid === d.id || u.id === d.id);
        const avail = Number(wData.availableBalance !== undefined ? wData.availableBalance : (wData.balance || 0));
        const pend = Number(wData.pendingBalance || 0);
        const block = Number(wData.blockedBalance || 0);
        const promo = Number(wData.promoBalance || 0);
        totalLiability += avail;
        userPendingLiability += pend;
        userBlockedLiability += block;
        userPromoLiability += promo;
        wList.push({
          id: d.id,
          name: userObj?.name || 'Membro VOXA',
          username: userObj?.username || 'desconhecido',
          balance: wData.balance || 0,
          availableBalance: avail,
          pendingBalance: pend,
          blockedBalance: block,
          promoBalance: promo,
          totalReceived: wData.totalReceived || 0,
          totalSpent: wData.totalSpent || 0,
          totalWithdrawn: wData.totalWithdrawn || 0,
          updatedAt: wData.updatedAt || 'N/A'
        });
      });
      setWallets(wList);

      const txsSnap = await getDocs(collection(db, 'wallet_transactions'));
      const tList: any[] = [];
      let grossDeposits = 0;
      let totalPurchases = 0;
      let totalTickets = 0;
      let totalSubscriptions = 0;
      let totalVoxAds = 0;
      let totalPaidMessages = 0;
      let totalRefunds = 0;
      let sussurroRevenueTotal = 0;
      let sussurroRevealsCount = 0;
      let sussurroWalletPays = 0;
      let sussurroPixPays = 0;
      let platformNetRevenue = 0;

      txsSnap.forEach(d => {
        const txData = d.data();
        const userObj = uList.find(u => u.uid === txData.userId || u.id === txData.userId);
        tList.push({
          id: d.id,
          userName: userObj?.name || 'Membro VOXA',
          username: userObj?.username || 'user',
          ...txData
        });

        const amt = Math.abs(Number(txData.grossAmount || txData.amount || 0));
        const fee = Math.abs(Number(txData.platformFee || 0));
        const txType = String(txData.type || '').toUpperCase();
        platformNetRevenue += fee;

        if (txType === 'PIX_DEPOSIT' || txType === 'DEPOSIT') {
          grossDeposits += amt;
        } else if (txType.includes('STORE')) {
          totalPurchases += amt;
        } else if (txType.includes('TICKET')) {
          totalTickets += amt;
        } else if (txType.includes('SUBSCRIPTION')) {
          totalSubscriptions += amt;
        } else if (txType.includes('AD')) {
          totalVoxAds += amt;
        } else if (txType.includes('MESSAGE') || txType.includes('CHAT')) {
          totalPaidMessages += amt;
        } else if (txType.includes('REFUND')) {
          totalRefunds += amt;
        } else if (txType.includes('SUSSURRO')) {
          sussurroRevenueTotal += amt;
          sussurroRevealsCount++;
          if (String(txData.source || '').toUpperCase().includes('PIX')) {
            sussurroPixPays++;
          } else {
            sussurroWalletPays++;
          }
        }
      });

      // Sort descending by date
      tList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setTransactions(tList);

      if (!apiOverviewLoaded) {
        const platformGrossRevenue = totalPurchases + totalTickets + totalSubscriptions + totalVoxAds + totalPaidMessages + sussurroRevenueTotal;
        setMetrics({
          platformGrossRevenue,
          platformNetRevenue: platformNetRevenue + sussurroRevenueTotal,
          totalUserDeposits: grossDeposits,
          userWalletsLiability: totalLiability,
          userPendingLiability,
          userBlockedLiability,
          userPromoLiability,
          totalStoreSales: totalPurchases,
          totalTicketSales: totalTickets,
          totalSubscriptions,
          totalVoxAds,
          totalPaidMessages,
          totalRefunds,
          walletsCount: wList.length,
          sussurroRevenueTotal,
          sussurroRevealsCount,
          sussurroWalletPays,
          sussurroPixPays
        });
      } else {
        setMetrics((prev) => ({
          ...prev,
          userPromoLiability
        }));
      }

    } catch (err: any) {
      console.warn("[FinanceiroModule] Fallback metrics loaded:", err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjUserEmail || !adjAmount || !adjReason) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    const valueCentavos = Math.round(parseFloat(adjAmount) * 100);
    if (isNaN(valueCentavos) || valueCentavos <= 0) {
      alert("O valor de ajuste deve ser um número positivo maior que zero.");
      return;
    }

    const targetUser = allUsers.find(u => (u.email || '').toLowerCase().trim() === adjUserEmail.toLowerCase().trim() || (u.username || '').toLowerCase().trim() === adjUserEmail.toLowerCase().trim());
    if (!targetUser) {
      alert("Usuário não encontrado na base VOXA. Digite o e-mail ou @username exato.");
      return;
    }

    if (!window.confirm(`Confirma aplicar o ajuste manual de ${formatBRL(valueCentavos)} de ${adjType === 'CREDIT' ? 'Crédito' : 'Débito'} para @${targetUser.username}?`)) {
      return;
    }

    setIsSubmittingAdjustment(true);
    try {
      const adminUid = currentUser?.uid || currentUser?.id;
      // Post to secure backend adjust route
      const response = await fetch("/api/admin/wallet/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminUid,
          targetUserId: targetUser.uid || targetUser.id,
          type: adjType,
          amount: valueCentavos,
          reason: adjReason.trim()
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`Ajuste de ${adjType === 'CREDIT' ? 'Crédito' : 'Débito'} aplicado com sucesso!`);
        setAdjAmount('');
        setAdjReason('');
        setAdjUserEmail('');
        await loadFinancialData();
      } else {
        alert(data.error || "Erro ao executar ajuste financeiro.");
      }
    } catch (err) {
      alert("Erro de conexão ao processar ajuste manual.");
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  // Filter transactions ledger
  const filteredTxs = transactions.filter(tx => {
    const d = (tx.direction || '').toUpperCase();
    const s = (tx.status || '').toUpperCase();
    const t = (tx.type || '').toUpperCase();
    const u = (tx.userName || '').toLowerCase() + ' ' + (tx.username || '').toLowerCase() + ' ' + (tx.userId || '').toLowerCase();

    const matchesUser = !txUserFilter || u.includes(txUserFilter.toLowerCase());
    const matchesStatus = txStatusFilter === 'ALL' || s === txStatusFilter;
    const matchesType = txTypeFilter === 'ALL' || t === txTypeFilter;

    return matchesUser && matchesStatus && matchesType;
  });

  return (
    <div className="w-full space-y-8 text-black">
      {/* Upper Module Panel Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white border border-gray-200 p-6 rounded-3xl shadow-sm gap-4">
        <div className="flex items-center gap-3 text-left">
          <div className="w-12 h-12 bg-red-50 text-[#FF0033] rounded-full flex items-center justify-center shrink-0 shadow-sm">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-orbitron font-black text-black uppercase tracking-wider">Módulo Financeiro</h2>
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest font-bold">Livro-Razão & Controle de Caixa da Plataforma</p>
          </div>
        </div>

        <button
          onClick={loadFinancialData}
          className="bg-gray-100 hover:bg-gray-200 border border-gray-300 px-4 py-2 rounded-xl text-xs font-orbitron text-gray-700 flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Recarregar Livro
        </button>
      </div>

      {/* Mini tabs Menu */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {[
          { id: 'overview', label: 'Visão Geral do Caixa' },
          { id: 'wallets', label: 'Saldos de Clientes' },
          { id: 'transactions', label: 'Histórico Global (Ledger)' },
          { id: 'adjustments', label: 'Ajuste Manual de Saldo' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as any)}
            className={`px-4 py-2.5 rounded-xl font-orbitron font-extrabold text-[10px] tracking-wider uppercase transition-all border cursor-pointer ${
              subTab === t.id
                ? 'bg-black text-white border-black'
                : 'bg-white text-gray-600 border-gray-200 hover:border-black'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-gray-200 rounded-3xl shadow-xs">
          <RefreshCw className="w-10 h-10 text-[#FF0033] animate-spin mb-4" />
          <span className="font-orbitron font-bold text-xs text-gray-500 uppercase">Sincronizando livro financeiro...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW METRICS */}
          {subTab === 'overview' && (
            <div className="space-y-8 animate-fadeIn">
              {/* Box Platform Revenues (Real Revenue) vs Liabilities */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Platform Real Earnings Block */}
                <div className="bg-emerald-50/50 border border-emerald-200 p-6 rounded-3xl text-left space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                    <span className="text-[10px] font-orbitron font-black text-emerald-800 uppercase tracking-widest">FATURAMENTO REAL VOXA</span>
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <span className="text-[8px] text-gray-500 font-orbitron uppercase block font-bold">RECEITA BRUTA</span>
                      <span className="text-2xl font-black font-mono text-emerald-800">{formatBRL(metrics.platformGrossRevenue)}</span>
                      <p className="text-[9px] text-emerald-600 font-sans mt-1">Volume de transações mediadas</p>
                    </div>

                    <div>
                      <span className="text-[8px] text-gray-500 font-orbitron uppercase block font-bold">RECEITA LÍQUIDA (TAXAS)</span>
                      <span className="text-2xl font-black font-mono text-emerald-600">{formatBRL(metrics.platformNetRevenue)}</span>
                      <p className="text-[9px] text-emerald-600 font-sans mt-1">Soma das comissões creditadas</p>
                    </div>
                  </div>
                </div>

                {/* Platform User Wallet Liability Block */}
                <div className="bg-amber-50/40 border border-amber-200 p-6 rounded-3xl text-left space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                    <span className="text-[10px] font-orbitron font-black text-amber-800 uppercase tracking-widest">PASSIVO FINANCEIRO (CARTEIRAS)</span>
                    <Wallet className="w-5 h-5 text-amber-600" />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div>
                      <span className="text-[8px] text-gray-500 font-orbitron uppercase block font-bold">DISPONÍVEL REAL</span>
                      <span className="text-lg font-black font-mono text-amber-800">{formatBRL(metrics.userWalletsLiability)}</span>
                      <p className="text-[9px] text-amber-600 font-sans mt-1">Saldos reais livres</p>
                    </div>

                    <div>
                      <span className="text-[8px] text-gray-500 font-orbitron uppercase block font-bold">SAQUES / PENDENTES</span>
                      <span className="text-lg font-black font-mono text-amber-800">{formatBRL(metrics.userPendingLiability)}</span>
                      <p className="text-[9px] text-amber-600 font-sans mt-1">Aguardando processamento</p>
                    </div>

                    <div>
                      <span className="text-[8px] text-gray-500 font-orbitron uppercase block font-bold">BLOQUEADO (TRADE)</span>
                      <span className="text-lg font-black font-mono text-gray-500">{formatBRL(metrics.userBlockedLiability)}</span>
                      <p className="text-[9px] text-gray-500 font-sans mt-1">Reservado em operações</p>
                    </div>

                    <div>
                      <span className="text-[8px] text-purple-700 font-orbitron uppercase block font-bold">CARTEIRA PROMOCIONAL</span>
                      <span className="text-lg font-black font-mono text-purple-700">{formatBRL(metrics.userPromoLiability)}</span>
                      <p className="text-[9px] text-purple-600 font-sans mt-1">Bônus isolado do caixa real</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* platform-specific sales split */}
              <div className="bg-white border border-gray-200 rounded-3xl p-6 text-left space-y-6 shadow-xs">
                <div>
                  <h3 className="font-orbitron font-black text-xs text-black uppercase tracking-wider">Origem das Receitas</h3>
                  <p className="text-[9px] text-gray-500 font-mono uppercase mt-0.5">Vendas faturadas por sub-módulo</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  {[
                    { label: "Vendido na Store", value: metrics.totalStoreSales, icon: ShoppingBag, color: "text-blue-500", bg: "bg-blue-50" },
                    { label: "Vendido em Tickets", value: metrics.totalTicketSales, icon: Ticket, color: "text-red-500", bg: "bg-red-50" },
                    { label: "Assinaturas VIP", value: metrics.totalSubscriptions, icon: Users, color: "text-amber-500", bg: "bg-amber-50" },
                    { label: "VOXA Ads", value: metrics.totalVoxAds, icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-50" },
                    { label: "Mensagens Pagas", value: metrics.totalPaidMessages, icon: DollarSign, color: "text-purple-500", bg: "bg-purple-50" },
                    { label: "Sussurros VOXA", value: metrics.sussurroRevenueTotal, icon: DollarSign, color: "text-red-600", bg: "bg-red-50" }
                  ].map((m, idx) => {
                    const Icon = m.icon;
                    return (
                      <div key={idx} className="border border-gray-100 p-4 rounded-2xl bg-gray-50/50 flex flex-col justify-between h-28">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] text-gray-500 font-orbitron block uppercase font-bold">{m.label}</span>
                          <div className={`w-7 h-7 rounded-full ${m.bg} flex items-center justify-center`}>
                            <Icon className={`w-3.5 h-3.5 ${m.color}`} />
                          </div>
                        </div>
                        <h4 className="text-base font-black font-mono text-black mt-2">{formatBRL(m.value)}</h4>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SUSSURRO VOXA DETAILS & CONFIG */}
              <div className="bg-[#171717] text-white border border-black p-6 rounded-3xl text-left space-y-5 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800 pb-3 gap-2">
                  <div>
                    <span className="text-[#FF0033] font-orbitron text-[9px] tracking-widest font-black uppercase">Módulo Social Pago</span>
                    <h3 className="font-orbitron font-black text-sm text-white uppercase tracking-wider mt-0.5">Sussurro VOXA — Finanças & Configurações</h3>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/30 px-3 py-1 rounded-full self-start md:self-auto">
                    <span className="text-[9px] font-orbitron font-bold text-red-400 tracking-wider uppercase">Receita 100% VOXA</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-2">
                  <div>
                    <span className="text-[8px] text-gray-400 font-orbitron uppercase block font-bold">RECEITA TOTAL SUSSURROS</span>
                    <span className="text-xl font-black font-mono text-white">{formatBRL(metrics.sussurroRevenueTotal)}</span>
                    <p className="text-[9px] text-gray-500 font-sans mt-0.5">Faturamento acumulado</p>
                  </div>

                  <div>
                    <span className="text-[8px] text-gray-400 font-orbitron uppercase block font-bold">REVELAÇÕES VENDIDAS</span>
                    <span className="text-xl font-black font-mono text-white">{metrics.sussurroRevealsCount}</span>
                    <p className="text-[9px] text-gray-500 font-sans mt-0.5">Quantidade de revelações</p>
                  </div>

                  <div>
                    <span className="text-[8px] text-gray-400 font-orbitron uppercase block font-bold">PAGAMENTOS VIA CARTEIRA</span>
                    <span className="text-xl font-black font-mono text-emerald-400">{formatBRL(metrics.sussurroWalletPays)}</span>
                    <p className="text-[9px] text-gray-500 font-sans mt-0.5">Débito do saldo</p>
                  </div>

                  <div>
                    <span className="text-[8px] text-gray-400 font-orbitron uppercase block font-bold">PAGAMENTOS VIA PIX</span>
                    <span className="text-xl font-black font-mono text-sky-400">{formatBRL(metrics.sussurroPixPays)}</span>
                    <p className="text-[9px] text-gray-500 font-sans mt-0.5">Mercado Pago Direto</p>
                  </div>
                </div>

                <div className="border-t border-gray-800 pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-left">
                    <span className="text-[9px] font-orbitron font-black text-gray-400 uppercase tracking-widest block">Ajuste de Preço de Revelação (revealPrice)</span>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed font-sans">
                      Defina o valor cobrado para o destinatário descobrir quem enviou um Sussurro (Anônimo Revelável). Valor padrão: R$ 0,99.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 self-stretch md:self-auto">
                    <div className="relative rounded-xl border border-gray-700 bg-black/40 px-3 py-1.5 flex items-center font-mono">
                      <span className="text-xs text-gray-500 mr-1.5">R$</span>
                      <input 
                        type="number" 
                        step="0.01"
                        value={revealPriceConfig}
                        onChange={(e) => setRevealPriceConfig(e.target.value)}
                        className="bg-transparent text-white font-bold font-mono outline-none text-xs w-16"
                      />
                    </div>
                    <button 
                      onClick={handleSavePriceConfig}
                      disabled={savingPrice}
                      className="bg-[#FF0033] hover:bg-red-700 disabled:opacity-50 text-white font-orbitron font-bold text-[10px] tracking-wider uppercase px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
                    >
                      {savingPrice ? 'Salvando...' : 'Salvar Preço'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WALLET LIST */}
          {subTab === 'wallets' && (
            <div className="bg-white border border-gray-200 rounded-3xl p-6 text-left shadow-xs space-y-4 animate-fadeIn">
              <div>
                <h3 className="font-orbitron font-black text-xs text-black uppercase tracking-wider">Carteiras dos Usuários</h3>
                <p className="text-[9px] text-gray-500 font-mono uppercase mt-0.5">Lista de saldos disponíveis, pendentes e bloqueados por conta</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">
                      <th className="py-3.5 px-4">Usuário / @Username</th>
                      <th className="py-3.5 px-4">Disponível Real</th>
                      <th className="py-3.5 px-4">Carteira Promo</th>
                      <th className="py-3.5 px-4">Pendente</th>
                      <th className="py-3.5 px-4">Bloqueado</th>
                      <th className="py-3.5 px-4">Total Recebido</th>
                      <th className="py-3.5 px-4">Total Gasto</th>
                      <th className="py-3.5 px-4 text-right">Último Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-sans text-xs">
                    {wallets.map((w, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-all text-black">
                        <td className="py-3 px-4">
                          <div>
                            <span className="font-bold text-[#171717] block">{w.name}</span>
                            <span className="text-[9px] text-gray-400 font-mono block">@{w.username}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-600">{formatBRL(w.availableBalance)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-purple-700">{formatBRL(w.promoBalance || 0)}</td>
                        <td className="py-3 px-4 font-mono text-gray-600">{formatBRL(w.pendingBalance)}</td>
                        <td className="py-3 px-4 font-mono text-red-500">{formatBRL(w.blockedBalance)}</td>
                        <td className="py-3 px-4 font-mono text-[#171717]">{formatBRL(w.totalReceived)}</td>
                        <td className="py-3 px-4 font-mono text-red-500">{formatBRL(w.totalSpent)}</td>
                        <td className="py-3 px-4 text-right font-mono text-[10px] text-gray-400">
                          {w.updatedAt ? new Date(w.updatedAt).toLocaleDateString('pt-BR') : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: GLOBAL TRANSACTIONS (LEDGER) */}
          {subTab === 'transactions' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Interactive search and Filters bar */}
              <div className="bg-white border border-gray-200 rounded-3xl p-5 text-left flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar por usuário, ID..."
                    value={txUserFilter}
                    onChange={(e) => setTxUserFilter(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs font-sans text-black focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Filter Type select */}
                  <select
                    value={txTypeFilter}
                    onChange={(e) => setTxTypeFilter(e.target.value)}
                    className="bg-gray-100 border border-gray-200 rounded-xl text-xs font-orbitron font-bold text-gray-700 px-3 py-2 cursor-pointer focus:outline-none"
                  >
                    <option value="ALL">TODOS OS TIPOS</option>
                    <option value="DEPOSIT">DEPÓSITOS</option>
                    <option value="PURCHASE">COMPRAS</option>
                    <option value="SALE">VENDAS</option>
                    <option value="ADMIN_ADJUSTMENT">AJUSTES ADMINISTRATIVOS</option>
                    <option value="WITHDRAWAL">SAQUES</option>
                    <option value="SUSSURRO_REVEAL">SUSSURRO VOXA</option>
                  </select>

                  {/* Filter Status select */}
                  <select
                    value={txStatusFilter}
                    onChange={(e) => setTxStatusFilter(e.target.value)}
                    className="bg-gray-100 border border-gray-200 rounded-xl text-xs font-orbitron font-bold text-gray-700 px-3 py-2 cursor-pointer focus:outline-none"
                  >
                    <option value="ALL">TODOS OS STATUS</option>
                    <option value="COMPLETED">CONCLUÍDOS</option>
                    <option value="PENDING">PENDENTES</option>
                    <option value="FAILED">FALHOU</option>
                    <option value="REFUNDED">ESTORNADOS</option>
                  </select>
                </div>
              </div>

              {/* Ledger Table */}
              <div className="bg-white border border-gray-200 rounded-3xl p-6 text-left shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">
                        <th className="py-3.5 px-4">ID Transação</th>
                        <th className="py-3.5 px-4">Usuário</th>
                        <th className="py-3.5 px-4">Tipo</th>
                        <th className="py-3.5 px-4">Valor Bruto</th>
                        <th className="py-3.5 px-4">Taxa</th>
                        <th className="py-3.5 px-4">Líquido</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Data / Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-sans text-xs">
                      {filteredTxs.map((t, idx) => {
                        const isPendingWithdrawal =
                          (String(t.type || '').toUpperCase() === 'WITHDRAWAL' || String(t.type || '').toUpperCase() === 'SAQUE') &&
                          String(t.status || '').toUpperCase() === 'PENDING';
                        return (
                          <tr key={idx} className="hover:bg-gray-50 transition-all text-black">
                            <td className="py-3 px-4 font-mono text-[10px] text-gray-400 select-all">
                              {t.id}
                            </td>
                            <td className="py-3 px-4">
                              <div>
                                <span className="font-bold text-[#171717] block">{t.userName}</span>
                                <span className="text-[9px] text-gray-400 font-mono block">@{t.username}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-gray-600 uppercase text-[10px]">
                              {t.type}
                              {t.pixKey && (
                                <span className="block text-[9px] text-gray-400 font-normal truncate max-w-[160px]">
                                  PIX: {t.pixKey}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-black">{formatBRL(t.grossAmount || t.amount || 0)}</td>
                            <td className="py-3 px-4 font-mono text-red-500">{t.platformFee !== undefined ? formatBRL(t.platformFee) : formatBRL(0)}</td>
                            <td className="py-3 px-4 font-mono text-emerald-600">
                              {t.netAmount !== undefined ? formatBRL(t.netAmount) : formatBRL(t.amount || 0)}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                                t.status === 'completed' || t.status === 'approved' || t.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                t.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                'bg-red-50 text-red-500 border border-red-100'
                              }`}>
                                {t.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-[10px] text-gray-400">
                              <div className="flex items-center justify-end gap-1.5">
                                <span>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</span>
                                {isPendingWithdrawal && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          const nowIso = new Date().toISOString();
                                          const amt = Math.abs(Number(t.grossAmount || t.amount || 0));
                                          await setDoc(doc(db, 'wallet_transactions', t.id), {
                                            status: 'completed',
                                            processedAt: nowIso
                                          }, { merge: true });
                                          if (t.userId) {
                                            const wRef = doc(db, 'wallets', t.userId);
                                            const wSnap = await getDoc(wRef);
                                            if (wSnap.exists()) {
                                              const wd = wSnap.data() || {};
                                              await setDoc(wRef, {
                                                pendingBalance: Math.max(0, Number(wd.pendingBalance || 0) - amt),
                                                totalWithdrawn: Number(wd.totalWithdrawn || 0) + amt,
                                                updatedAt: nowIso
                                              }, { merge: true });
                                            }
                                            await setDoc(doc(db, 'notifications', `fin_notif_${t.id}_APPROVED`), {
                                              id: `fin_notif_${t.id}_APPROVED`,
                                              userId: t.userId,
                                              recipientUid: t.userId,
                                              type: 'financial',
                                              financialType: 'WITHDRAWAL',
                                              financialStatus: 'APPROVED',
                                              transactionId: t.id,
                                              amountCentavos: amt,
                                              walletType: 'REAL',
                                              actionTab: 'wallet',
                                              title: 'Saque enviado via PIX',
                                              message: `Seu saque de ${formatBRL(amt / 100)} foi aprovado e enviado via PIX.`,
                                              read: false,
                                              createdAt: nowIso
                                            }, { merge: true });
                                          }
                                          loadFinancialData();
                                        } catch (err) {
                                          console.error('Erro ao aprovar saque:', err);
                                        }
                                      }}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-orbitron font-black text-[9px] px-2 py-1 rounded-lg uppercase cursor-pointer"
                                    >
                                      Aprovar PIX
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          const nowIso = new Date().toISOString();
                                          const amt = Math.abs(Number(t.grossAmount || t.amount || 0));
                                          await setDoc(doc(db, 'wallet_transactions', t.id), {
                                            status: 'rejected',
                                            processedAt: nowIso
                                          }, { merge: true });
                                          if (t.userId) {
                                            const wRef = doc(db, 'wallets', t.userId);
                                            const wSnap = await getDoc(wRef);
                                            if (wSnap.exists()) {
                                              const wd = wSnap.data() || {};
                                              const curAvail = Number(wd.availableBalance !== undefined ? wd.availableBalance : (wd.balance || 0));
                                              await setDoc(wRef, {
                                                balance: curAvail + amt,
                                                availableBalance: curAvail + amt,
                                                pendingBalance: Math.max(0, Number(wd.pendingBalance || 0) - amt),
                                                updatedAt: nowIso
                                              }, { merge: true });
                                            }
                                            await setDoc(doc(db, 'notifications', `fin_notif_${t.id}_REJECTED`), {
                                              id: `fin_notif_${t.id}_REJECTED`,
                                              userId: t.userId,
                                              recipientUid: t.userId,
                                              type: 'financial',
                                              financialType: 'WITHDRAWAL',
                                              financialStatus: 'REJECTED',
                                              transactionId: t.id,
                                              amountCentavos: amt,
                                              walletType: 'REAL',
                                              actionTab: 'wallet',
                                              title: 'Saque recusado',
                                              message: `Seu pedido de saque de ${formatBRL(amt / 100)} foi recusado e o saldo estornado para sua carteira.`,
                                              read: false,
                                              createdAt: nowIso
                                            }, { merge: true });
                                          }
                                          loadFinancialData();
                                        } catch (err) {
                                          console.error('Erro ao recusar saque:', err);
                                        }
                                      }}
                                      className="bg-red-600 hover:bg-red-700 text-white font-orbitron font-black text-[9px] px-2 py-1 rounded-lg uppercase cursor-pointer"
                                    >
                                      Recusar
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MANUAL ADJUSTMENT */}
          {subTab === 'adjustments' && (
            <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-3xl p-8 text-left shadow-xs space-y-6 animate-fadeIn">
              <div className="space-y-1.5 border-b border-gray-100 pb-3">
                <h3 className="font-orbitron font-black text-sm text-[#171717] uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-red-600" />
                  Ajuste de Saldo com Auditoria (Ledger)
                </h3>
                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest font-bold">RECURSO RESTRITO A ADMINISTRADORES AUTORIZADOS</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-gray-600 font-sans leading-relaxed">
                  **AVISO DE COMPLIANCE**: Saldo não pode ser alterado diretamente no banco. 
                  Todo ajuste manual gera obrigatoriamente um lançamento contábil `ADMIN_ADJUSTMENT` no ledger imutável e grava uma auditoria com o motivo especificado em `admin_audit_logs`.
                </p>
              </div>

              <form onSubmit={handleManualAdjustment} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-orbitron text-gray-600 font-bold uppercase tracking-wider">E-mail ou @Username do Cliente</label>
                  <input
                    type="text"
                    placeholder="Ex: pedro@voxa.com.br"
                    value={adjUserEmail}
                    onChange={(e) => setAdjUserEmail(e.target.value)}
                    className="w-full bg-[#FAFAFA] border border-[#E5E5E5] focus:border-black rounded-xl px-4 py-2.5 text-xs text-black focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-orbitron text-gray-600 font-bold uppercase tracking-wider">Tipo do Ajuste</label>
                    <select
                      value={adjType}
                      onChange={(e) => setAdjType(e.target.value as any)}
                      className="w-full bg-[#FAFAFA] border border-[#E5E5E5] focus:border-black rounded-xl px-3 py-2.5 text-xs text-black focus:outline-none cursor-pointer"
                    >
                      <option value="CREDIT">CRÉDITO (+ Adicionar Saldo)</option>
                      <option value="DEBIT">DÉBITO (- Remover Saldo)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-orbitron text-gray-600 font-bold uppercase tracking-wider">Valor do Ajuste (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="Ex: 100.00"
                      value={adjAmount}
                      onChange={(e) => setAdjAmount(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-[#E5E5E5] focus:border-black rounded-xl px-4 py-2.5 text-xs text-black focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-orbitron text-gray-600 font-bold uppercase tracking-wider">Motivo Obrigatório do Ajuste</label>
                  <textarea
                    placeholder="Especifique detalhadamente por que este ajuste contábil está sendo executado..."
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    rows={3}
                    className="w-full bg-[#FAFAFA] border border-[#E5E5E5] focus:border-black rounded-xl px-4 py-2.5 text-xs text-black focus:outline-none resize-none"
                    maxLength={250}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingAdjustment}
                  className="w-full bg-[#171717] hover:bg-black text-white font-orbitron font-black text-xs py-3.5 rounded-xl transition-all uppercase tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingAdjustment ? "Gravando Ajuste..." : "Aplicar Ajuste Contábil"}
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
