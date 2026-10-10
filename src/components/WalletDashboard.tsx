import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Eye, 
  X, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Lock,
  Wallet,
  Gift,
  Copy,
  Check
} from 'lucide-react';
import { formatBRL } from '../utils/money';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { fetchReferralSettings, DEFAULT_REFERRAL_SETTINGS } from '../utils/leagueDb';
import { ReferralSettings } from '../types';
import { TransactionHistory } from './TransactionHistory';

interface WalletDashboardProps {
  currentUser: any;
}

export function WalletDashboard({ currentUser }: WalletDashboardProps) {
  const [wallet, setWallet] = useState<any>({
    balance: 0,
    availableBalance: 0,
    pendingBalance: 0,
    blockedBalance: 0,
    promoBalance: 0,
    totalReceived: 0,
    totalSpent: 0,
    totalWithdrawn: 0
  });
  const [referralSettings, setReferralSettings] = useState<ReferralSettings>(DEFAULT_REFERRAL_SETTINGS);
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedPixCode, setCopiedPixCode] = useState(false);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inlineFeedback, setInlineFeedback] = useState<{ type: 'success' | 'warning' | 'error'; title: string; message: string } | null>(null);

  // Deposit PIX state
  const [depositAmount, setDepositAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositPix, setDepositPix] = useState<any | null>(null);
  const [depositStatus, setDepositStatus] = useState<'IDLE' | 'PENDING' | 'APPROVED' | 'EXPIRED' | 'FAILED'>('IDLE');

  // Withdraw PIX state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPixKey, setWithdrawPixKey] = useState('');
  const [withdrawPixKeyType, setWithdrawPixKeyType] = useState<'CPF' | 'EMAIL' | 'PHONE' | 'RANDOM'>('CPF');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Filters & Pagination State
  const [activeFilter, setActiveFilter] = useState<'all' | 'in' | 'out' | 'pending' | 'completed' | 'refunded'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTx, setSelectedUserTx] = useState<any | null>(null);
  
  const itemsPerPage = 8;

  useEffect(() => {
    loadWalletData();
  }, [currentUser]);

  // Real-time listeners for `wallets/{uid}` and `wallet_transactions` so UI updates automatically without page refresh
  useEffect(() => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid || !isFirebaseConfigured()) return;

    const unsubWallet = onSnapshot(
      doc(db, 'wallets', uid),
      (wSnap) => {
        if (wSnap.exists()) {
          const wData = wSnap.data() || {};
          setWallet({
            balance: Number(wData.balance !== undefined ? wData.balance : (wData.availableBalance || 0)),
            availableBalance: Number(wData.availableBalance !== undefined ? wData.availableBalance : (wData.balance || 0)),
            pendingBalance: Number(wData.pendingBalance || 0),
            blockedBalance: Number(wData.blockedBalance || 0),
            promoBalance: Number(wData.promoBalance || 0),
            totalReceived: Number(wData.totalReceived || 0),
            totalSpent: Number(wData.totalSpent || 0),
            totalWithdrawn: Number(wData.totalWithdrawn || 0)
          });
        }
      },
      () => {}
    );

    const txQ = query(collection(db, 'wallet_transactions'), where('userId', '==', uid));
    const unsubTxs = onSnapshot(
      txQ,
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setTransactions(list);
      },
      () => {}
    );

    return () => {
      unsubWallet();
      unsubTxs();
    };
  }, [currentUser?.uid, currentUser?.id]);

  // Real-time watcher for the active PIX deposit transaction
  useEffect(() => {
    if (!depositPix?.transactionId) return;
    const matched = transactions.find((t) => t.id === depositPix.transactionId);
    if (!matched) return;

    const st = String(matched.status || '').toUpperCase();
    if (st === 'COMPLETED' || st === 'APPROVED' || st === 'APROVADO' || st === 'SUCCESS') {
      setDepositStatus('APPROVED');
      setInlineFeedback({
        type: 'success',
        title: '✓ Depósito recebido!',
        message: `${formatBRL((depositPix.amount || matched.amount || 0) / 100)} foram adicionados à sua carteira VOXA.`
      });
    } else if (st === 'EXPIRED' || st === 'EXPIRADO') {
      setDepositStatus('EXPIRED');
    } else if (st === 'FAILED' || st === 'REJECTED' || st === 'CANCELED') {
      setDepositStatus('FAILED');
    } else {
      setDepositStatus('PENDING');
    }
  }, [transactions, depositPix?.transactionId]);

  // Poll Mercado Pago check-order endpoint while a PIX deposit is PENDING so real webhook or polling confirms automatically
  useEffect(() => {
    if (!depositPix?.transactionId || depositStatus !== 'PENDING') return;
    const interval = setInterval(async () => {
      try {
        if (depositPix.paymentId && !String(depositPix.paymentId).startsWith('sim_')) {
          await fetch('/api/mercadopago/process-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentId: depositPix.paymentId })
          });
        }
      } catch {}
    }, 6000);
    return () => clearInterval(interval);
  }, [depositPix?.transactionId, depositPix?.paymentId, depositStatus]);

  const loadWalletData = async () => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) return;
    setLoading(true);
    setError('');
    try {
      const refCfg = await fetchReferralSettings().catch(() => DEFAULT_REFERRAL_SETTINGS);
      setReferralSettings(refCfg);

      let loadedFromApi = false;
      try {
        const response = await fetch(`/api/wallet/balance?userId=${uid}`);
        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (data.success) {
            let fsPromo = Number(data.promoBalance || 0);
            try {
              const wSnap = await getDoc(doc(db, 'wallets', uid));
              if (wSnap.exists() && typeof wSnap.data()?.promoBalance === 'number') {
                fsPromo = wSnap.data()!.promoBalance;
              }
            } catch {}

            setWallet({
              balance: data.balance || 0,
              availableBalance: data.availableBalance !== undefined ? data.availableBalance : (data.balance || 0),
              pendingBalance: data.pendingBalance || 0,
              blockedBalance: data.blockedBalance || 0,
              promoBalance: fsPromo,
              totalReceived: data.totalReceived || 0,
              totalSpent: data.totalSpent || 0,
              totalWithdrawn: data.totalWithdrawn || 0
            });
            setTransactions(data.transactions || []);
            loadedFromApi = true;
          }
        }
      } catch {}

      if (!loadedFromApi) {
        const [wSnap, txSnap] = await Promise.all([
          getDoc(doc(db, 'wallets', uid)),
          getDocs(query(collection(db, 'wallet_transactions'), where('userId', '==', uid)))
        ]);
        const wData = wSnap.exists() ? wSnap.data() : {};
        const txList: any[] = [];
        txSnap.forEach((d) => txList.push({ id: d.id, ...d.data() }));
        txList.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

        setWallet({
          balance: Number(wData.balance || wData.availableBalance || 0),
          availableBalance: Number(wData.availableBalance !== undefined ? wData.availableBalance : (wData.balance || 0)),
          pendingBalance: Number(wData.pendingBalance || 0),
          blockedBalance: Number(wData.blockedBalance || 0),
          promoBalance: Number(wData.promoBalance || 0),
          totalReceived: Number(wData.totalReceived || 0),
          totalSpent: Number(wData.totalSpent || 0),
          totalWithdrawn: Number(wData.totalWithdrawn || 0)
        });
        setTransactions(txList);
      }
    } catch (err: any) {
      console.error("[Wallet Dashboard Fetch Error]", err);
      setError('Não foi possível sincronizar os dados da carteira no momento.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid || !depositAmount) return;
    
    const valueCentavos = Math.round(parseFloat(depositAmount) * 100);
    if (isNaN(valueCentavos) || valueCentavos <= 0) {
      setInlineFeedback({
        type: 'warning',
        title: 'Valor inválido',
        message: 'Por favor, digite um valor de recarga maior que zero.'
      });
      return;
    }

    setIsDepositing(true);
    setDepositPix(null);
    setDepositStatus('IDLE');
    setInlineFeedback(null);
    try {
      const response = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.uid,
          amount: valueCentavos,
          buyerName: currentUser.name || "Membro VOXA",
          payerEmail: currentUser.email || "financeiro@voxa.com.br"
        })
      });

      const data = await response.json();
      if (data.success) {
        setDepositPix(data);
        setDepositStatus('PENDING');
      } else {
        setInlineFeedback({
          type: 'error',
          title: 'Erro ao gerar PIX',
          message: data.error || "Não foi possível criar a cobrança PIX no momento."
        });
      }
    } catch (err: any) {
      setInlineFeedback({
        type: 'error',
        title: 'Falha de conexão',
        message: 'Não foi possível comunicar com o serviço de pagamentos.'
      });
    } finally {
      setIsDepositing(false);
    }
  };

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid || !withdrawAmount || !withdrawPixKey.trim()) return;

    const valueCentavos = Math.round(parseFloat(withdrawAmount) * 100);
    if (isNaN(valueCentavos) || valueCentavos < 1000) {
      setInlineFeedback({
        type: 'warning',
        title: 'Valor mínimo de saque',
        message: 'O valor mínimo para solicitar saque via PIX é de R$ 10,00.'
      });
      return;
    }

    const availCentavos = Number(wallet.availableBalance || 0);
    if (valueCentavos > availCentavos) {
      setInlineFeedback({
        type: 'error',
        title: 'Saldo real insuficiente',
        message: 'Você só pode sacar valores disponíveis na sua Carteira Real.'
      });
      return;
    }

    setIsWithdrawing(true);
    setInlineFeedback(null);
    try {
      const response = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.uid,
          userName: currentUser.name || 'Membro VOXA',
          userEmail: currentUser.email || '',
          amount: valueCentavos,
          pixKey: withdrawPixKey.trim(),
          pixKeyType: withdrawPixKeyType
        })
      });

      const data = await response.json();
      if (data.success) {
        setWithdrawAmount('');
        setWithdrawPixKey('');
        setInlineFeedback({
          type: 'warning',
          title: 'Saque solicitado com sucesso',
          message: `Seu saque de ${formatBRL(valueCentavos / 100)} entrou em análise e será enviado via PIX.`
        });
      } else {
        setInlineFeedback({
          type: 'error',
          title: 'Não foi possível solicitar saque',
          message: data.error || 'Verifique seu saldo disponível e tente novamente.'
        });
      }
    } catch (err: any) {
      // Client-side Firestore fallback if backend route fails due to Admin SDK permissions
      try {
        const uid = currentUser.uid;
        const txId = `tx_withdraw_${uid}_${Date.now()}`;
        const nowIso = new Date().toISOString();
        const wRef = doc(db, 'wallets', uid);
        const wSnap = await getDoc(wRef);
        const wData = wSnap.exists() ? wSnap.data() : {};
        const curAvail = Number(wData.availableBalance !== undefined ? wData.availableBalance : (wData.balance || 0));
        if (curAvail < valueCentavos) {
          throw new Error('Saldo insuficiente na carteira real.');
        }
        await setDoc(
          wRef,
          {
            balance: curAvail - valueCentavos,
            availableBalance: curAvail - valueCentavos,
            pendingBalance: Number(wData.pendingBalance || 0) + valueCentavos,
            updatedAt: nowIso
          },
          { merge: true }
        );
        await setDoc(doc(db, 'wallet_transactions', txId), {
          id: txId,
          userId: uid,
          userName: currentUser.name || 'Membro VOXA',
          type: 'WITHDRAWAL',
          walletType: 'REAL',
          amount: -valueCentavos,
          grossAmount: valueCentavos,
          platformFee: 0,
          netAmount: valueCentavos,
          direction: 'OUT',
          status: 'pending',
          pixKey: withdrawPixKey.trim(),
          pixKeyType: withdrawPixKeyType,
          description: `Saque PIX (${withdrawPixKeyType}: ${withdrawPixKey.trim()})`,
          createdAt: nowIso
        });
        setWithdrawAmount('');
        setWithdrawPixKey('');
        setInlineFeedback({
          type: 'warning',
          title: 'Saque solicitado',
          message: `Seu pedido de saque de ${formatBRL(valueCentavos / 100)} foi registrado para envio via PIX.`
        });
      } catch (fbErr: any) {
        setInlineFeedback({
          type: 'error',
          title: 'Erro ao solicitar saque',
          message: fbErr?.message || 'Tente novamente em instantes.'
        });
      }
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Status badge formatter helper
  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'COMPLETED':
      case 'APPROVED':
      case 'APROVADO':
      case 'SUCCESS':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">Aprovado</span>;
      case 'PENDING':
      case 'PENDENTE':
      case 'PROCESSING':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">Pendente</span>;
      case 'FAILED':
      case 'REJECTED':
      case 'FALHOU':
      case 'RECUSADO':
        return <span className="bg-red-50 text-red-700 border border-red-200 text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">Recusado</span>;
      case 'REFUNDED':
      case 'REEMBOLSADO':
      case 'ESTORNO':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">Estornado</span>;
      case 'EXPIRED':
      case 'EXPIRADO':
        return <span className="bg-neutral-100 text-zinc-500 border border-[#E5E5E5] text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">Expirado</span>;
      case 'CANCELED':
      case 'CANCELADO':
        return <span className="bg-neutral-100 text-zinc-500 border border-[#E5E5E5] text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">Cancelado</span>;
      default:
        return <span className="bg-zinc-100 text-zinc-600 border border-[#E5E5E5] text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">{status}</span>;
    }
  };

  // Format ledger types for user-friendly UI presentation
  const formatLedgerType = (type: string, direction: string) => {
    const t = (type || '').toUpperCase();
    const d = (direction || '').toUpperCase();

    if (t === 'DEPOSIT' || t === 'PIX_DEPOSIT') return 'Depósito PIX';
    if (t === 'WITHDRAWAL' || t === 'SAQUE') return 'Saque via PIX';
    if (t === 'REFERRAL_BONUS') return 'Bônus de Indicação (Promocional)';
    if (t === 'TRADE_STAKE_RESERVED') return 'Reserva VOXA Trade';
    if (t === 'TRADE_PAYOUT_WON') return 'Ganho VOXA Trade';
    if (t === 'TRADE_STAKE_LOST') return 'Perda VOXA Trade';
    if (t === 'TRADE_STAKE_REFUNDED') return 'Devolução VOXA Trade';
    if (t === 'PURCHASE' || t === 'PURCHASE_STORE') return 'Compra VOXA Store';
    if (t === 'PURCHASE_TICKET') return 'Compra de Ingresso';
    if (t === 'PURCHASE_SUBSCRIPTION') return 'Assinatura de Criador';
    if (t === 'FUNDRAISER_CONTRIBUTION') return 'Contribuição em Vaquinha';
    if (t === 'SUSSURRO_REVEAL') return 'Revelação de Sussurro';
    if (t === 'SALE' || t === 'SALE_STORE' || t === 'SALE_TICKET') return 'Venda Recebida';
    if (t === 'REFUND' || t === 'ESTORNO') return 'Reembolso Creditado';
    if (t === 'ADJUSTMENT' || t === 'ADMIN_ADJUSTMENT') return 'Ajuste Administrativo';

    // Fallbacks
    if (d === 'IN') return 'Entrada de Saldo';
    return 'Saída de Saldo';
  };

  // Filter implementation
  const filteredTxs = transactions.filter(tx => {
    const d = (tx.direction || '').toUpperCase();
    const s = (tx.status || '').toUpperCase();

    if (activeFilter === 'in') return d === 'IN' || tx.amount > 0;
    if (activeFilter === 'out') return d === 'OUT' || tx.amount < 0;
    if (activeFilter === 'pending') return s === 'PENDING' || s === 'PENDENTE' || s === 'PROCESSING';
    if (activeFilter === 'completed') return s === 'COMPLETED' || s === 'SUCCESS' || s === 'APROVADO';
    if (activeFilter === 'refunded') return s === 'REFUNDED' || s === 'REEMBOLSADO' || s === 'ESTORNO';
    return true; // 'all'
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredTxs.length / itemsPerPage);
  const paginatedTxs = filteredTxs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 text-black">
      {/* Tab Header */}
      <div className="border-b border-[#E5E5E5] pb-4 text-center">
        <span className="text-[#FF0033] font-orbitron text-[10px] tracking-widest block font-bold uppercase">Sua Economia Digital</span>
        <h1 className="font-orbitron font-black text-3xl text-[#171717] mt-1">MINHA CARTEIRA</h1>
        <p className="text-xs text-gray-500 mt-1 font-sans">Controle de saldos, recargas via PIX integrado ao Mercado Pago e histórico imutável de transações.</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#E5E5E5] rounded-3xl">
          <div className="w-10 h-10 border-4 border-[#FF0033] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-xs font-orbitron text-gray-500 uppercase tracking-widest">Carregando carteira...</p>
        </div>
      ) : (
        <>
          {/* Real-time Balances Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Primary Available Balance (REAL) */}
            <div className="bg-[#171717] text-white border border-black p-6 rounded-3xl relative overflow-hidden shadow-xs flex flex-col justify-between h-44">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#FF0033] to-red-500"></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-orbitron font-black text-gray-400 uppercase tracking-widest">SALDO REAL DISPONÍVEL</span>
                <Wallet className="w-5 h-5 text-gray-400" />
              </div>
              <div className="my-auto">
                <h2 className="text-3xl font-mono font-black">{formatBRL(wallet.availableBalance)}</h2>
              </div>
              <span className="text-[8px] font-orbitron font-black text-emerald-400 tracking-wider bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full inline-block self-start">
                SALDO REAL • VOXA TRADE & PIX
              </span>
            </div>

            {/* Promotional Wallet (SEPARATE PROMO BALANCE) */}
            <div className="bg-purple-950/95 text-white border border-purple-500/30 p-6 rounded-3xl relative overflow-hidden shadow-xs flex flex-col justify-between h-44">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-orbitron font-black text-purple-300 uppercase tracking-widest">CARTEIRA PROMOCIONAL</span>
                <Gift className="w-5 h-5 text-purple-300" />
              </div>
              <div className="my-auto">
                <h2 className="text-3xl font-mono font-black text-white">{formatBRL((wallet.promoBalance || 0) / 100)}</h2>
              </div>
              <span className="text-[8px] font-orbitron font-black text-purple-200 tracking-wider bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 rounded-full inline-block self-start">
                BÔNUS DE INDICAÇÃO SEPARADO
              </span>
            </div>

            {/* Pending Balance */}
            <div className="bg-white border border-[#E5E5E5] p-6 rounded-3xl shadow-xs flex flex-col justify-between h-44">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">SALDO PENDENTE</span>
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div className="my-auto">
                <h2 className="text-3xl font-mono font-black text-[#171717]">{formatBRL(wallet.pendingBalance)}</h2>
              </div>
              <span className="text-[8px] font-orbitron font-bold text-amber-600 tracking-wider bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-block self-start">
                AGUARDANDO LIBERAÇÃO
              </span>
            </div>

            {/* Blocked / Locked Balance */}
            <div className="bg-white border border-[#E5E5E5] p-6 rounded-3xl shadow-xs flex flex-col justify-between h-44">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">SALDO BLOQUEADO</span>
                <Lock className="w-5 h-5 text-gray-400" />
              </div>
              <div className="my-auto">
                <h2 className="text-3xl font-mono font-black text-gray-400">{formatBRL(wallet.blockedBalance)}</h2>
              </div>
              <span className="text-[8px] font-orbitron font-bold text-gray-500 tracking-wider bg-gray-50 border border-[#E5E5E5] px-2 py-0.5 rounded-full inline-block self-start">
                RESERVADO EM OPERAÇÃO
              </span>
            </div>
          </div>

          {/* Promotional Wallet Rules & Referral Invite Box */}
          <div className="bg-white border border-purple-200 rounded-3xl p-5 shadow-xs space-y-4 text-left">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-purple-600" />
                  <span className="font-orbitron font-black text-xs text-purple-900 uppercase">
                    Indique Amigos & Ganhe na Carteira Promocional
                  </span>
                </div>
                <p className="text-xs text-gray-600 font-sans">
                  {referralSettings.enabled
                    ? `Ganhe ${formatBRL(referralSettings.referrerBonusAmount / 100)} de bônus promocional e +${referralSettings.referrerLeaguePoints} pts na League por cada amigo que criar conta com seu código.`
                    : 'Programa de indicações temporariamente pausado pela administração.'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="bg-purple-50 border border-purple-200 px-3.5 py-2 rounded-xl font-mono font-bold text-xs text-purple-900 uppercase">
                  {(currentUser?.referralCode || currentUser?.username || 'VOXA').toUpperCase()}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const code = (currentUser?.referralCode || currentUser?.username || '').toUpperCase();
                    const link = `${window.location.origin}/register?ref=${encodeURIComponent(code)}`;
                    navigator.clipboard.writeText(link);
                    setCopiedRef(true);
                    setTimeout(() => setCopiedRef(false), 2500);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-orbitron font-bold text-[10px] px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {copiedRef ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRef ? 'LINK COPIADO' : 'COPIAR LINK DE CONVITE'}</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2 text-[10px] font-orbitron">
              <span className="text-gray-400 font-bold uppercase">Regras da Carteira Promocional:</span>
              <span className={`px-2.5 py-0.5 rounded-full border font-bold ${referralSettings.allowWithdrawPromo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                Saque PIX: {referralSettings.allowWithdrawPromo ? 'LIBERADO' : 'BLOQUEADO'}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full border font-bold ${referralSettings.allowUseInTrade ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                VOXA Trade: {referralSettings.allowUseInTrade ? 'LIBERADO' : 'SOMENTE SALDO REAL'}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full border font-bold ${referralSettings.allowUseInStore ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                Store & Eventos: {referralSettings.allowUseInStore ? 'LIBERADO' : 'BLOQUEADO'}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full border font-bold ${referralSettings.allowUseInAds ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                VOXA Ads: {referralSettings.allowUseInAds ? 'LIBERADO' : 'BLOQUEADO'}
              </span>
            </div>
          </div>

          {/* Quick Stats Overview Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-[#E5E5E5] p-4 rounded-2xl flex items-center justify-between shadow-xs">
              <div className="text-left">
                <span className="text-[8px] text-gray-500 font-orbitron block uppercase font-bold">TOTAL RECEBIDO</span>
                <span className="text-sm font-black font-mono text-emerald-600">{formatBRL(wallet.totalReceived)}</span>
              </div>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>

            <div className="bg-white border border-[#E5E5E5] p-4 rounded-2xl flex items-center justify-between shadow-xs">
              <div className="text-left">
                <span className="text-[8px] text-gray-500 font-orbitron block uppercase font-bold">TOTAL GASTO</span>
                <span className="text-sm font-black font-mono text-red-500">{formatBRL(wallet.totalSpent)}</span>
              </div>
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>

            <div className="bg-white border border-[#E5E5E5] p-4 rounded-2xl flex items-center justify-between shadow-xs">
              <div className="text-left">
                <span className="text-[8px] text-gray-500 font-orbitron block uppercase font-bold">TOTAL SACADO</span>
                <span className="text-sm font-black font-mono text-gray-600">{formatBRL(wallet.totalWithdrawn)}</span>
              </div>
              <Wallet className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          {inlineFeedback && (
            <div
              className={`p-4 rounded-2xl border flex items-start justify-between gap-3 text-left ${
                inlineFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : inlineFeedback.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <div className="space-y-0.5">
                <h4 className="font-orbitron font-black text-xs uppercase">{inlineFeedback.title}</h4>
                <p className="text-xs font-sans">{inlineFeedback.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setInlineFeedback(null)}
                className="text-gray-500 hover:text-black p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Deposit & Withdraw PIX Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deposit PIX form section */}
            <div className="bg-white border border-[#E5E5E5] p-6 sm:p-8 rounded-3xl text-left space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <span className="text-[9px] font-orbitron font-black text-emerald-600 uppercase tracking-widest block">Recarga Instantânea</span>
                  <h3 className="text-base font-orbitron font-black text-black uppercase tracking-wider mt-0.5">Depositar via PIX</h3>
                  <p className="text-xs text-gray-500 font-sans leading-relaxed mt-1">
                    Adicione saldo real via PIX integrado ao Mercado Pago. A confirmação acontece automaticamente em tempo real sem precisar atualizar a página.
                  </p>
                </div>

                <form onSubmit={handleCreateDeposit} className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs text-gray-500 font-bold font-mono">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="Valor (Ex: 50.00)"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-[#E5E5E5] focus:border-black rounded-xl pl-9 pr-4 py-2.5 text-xs text-black focus:outline-none"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isDepositing}
                    className="bg-[#171717] hover:bg-black text-white font-orbitron font-black text-[10px] px-5 py-2.5 rounded-xl uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {isDepositing ? "Gerando..." : "Gerar PIX"}
                  </button>
                </form>
              </div>

              {depositPix && (
                <div className="bg-[#FAFAFA] border border-[#E5E5E5] p-5 rounded-2xl space-y-4 text-center animate-fadeIn text-black">
                  {/* Real-time status banner inside PIX box */}
                  {depositStatus === 'APPROVED' ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1.5 text-center">
                      <CheckCircle className="w-7 h-7 text-emerald-600 mx-auto" />
                      <h4 className="font-orbitron font-black text-sm text-emerald-900 uppercase">✓ Depósito recebido!</h4>
                      <p className="text-xs text-emerald-700 font-sans">
                        {formatBRL((depositPix.amount || 0) / 100)} foram adicionados à sua carteira VOXA.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setDepositPix(null);
                          setDepositStatus('IDLE');
                          setDepositAmount('');
                        }}
                        className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-orbitron font-black text-[10px] px-4 py-2 rounded-lg uppercase cursor-pointer"
                      >
                        Concluir
                      </button>
                    </div>
                  ) : depositStatus === 'EXPIRED' || depositStatus === 'FAILED' ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1.5 text-center">
                      <XCircle className="w-7 h-7 text-red-600 mx-auto" />
                      <h4 className="font-orbitron font-black text-sm text-red-900 uppercase">
                        {depositStatus === 'EXPIRED' ? 'PIX Expirado' : 'Pagamento não concluído'}
                      </h4>
                      <p className="text-xs text-red-700 font-sans">
                        Gere um novo código PIX caso deseje concluir sua recarga.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-xl">
                        <Clock className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
                        <div className="text-left">
                          <span className="font-orbitron font-black text-[10px] uppercase block">Pagamento pendente</span>
                          <span className="text-[10px] font-sans block">Aguardando confirmação do seu PIX em tempo real...</span>
                        </div>
                      </div>

                      <div className="p-3 bg-white border border-gray-200 rounded-xl w-44 h-44 mx-auto flex items-center justify-center">
                        <img
                          src={
                            depositPix.qrCodeBase64 && depositPix.qrCodeBase64 !== "MOCK_QR_BASE64"
                              ? `data:image/png;base64,${depositPix.qrCodeBase64}`
                              : `https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=000000&data=${encodeURIComponent(depositPix.qrCode)}`
                          }
                          alt="PIX QR Code"
                          className="w-full h-auto"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[9px] font-mono text-gray-500 block uppercase">Código PIX Copia e Cola</span>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            readOnly
                            value={depositPix.qrCode}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-[9px] font-mono text-gray-600 focus:outline-none truncate cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(depositPix.qrCode || '');
                              setCopiedPixCode(true);
                              setTimeout(() => setCopiedPixCode(false), 2500);
                            }}
                            className="bg-black text-white font-orbitron font-bold text-[9px] px-3 py-2 rounded-lg uppercase cursor-pointer shrink-0 flex items-center gap-1"
                          >
                            {copiedPixCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedPixCode ? 'Copiado' : 'Copiar'}</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Withdraw PIX form section */}
            <div className="bg-white border border-[#E5E5E5] p-6 sm:p-8 rounded-3xl text-left space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <span className="text-[9px] font-orbitron font-black text-gray-500 uppercase tracking-widest block">Transferência PIX</span>
                  <h3 className="text-base font-orbitron font-black text-black uppercase tracking-wider mt-0.5">Solicitar Saque PIX</h3>
                  <p className="text-xs text-gray-500 font-sans leading-relaxed mt-1">
                    Transfira seu Saldo Real Disponível para sua conta bancária via chave PIX. Você será notificado em tempo real assim que o saque for enviado.
                  </p>
                </div>

                <form onSubmit={handleRequestWithdrawal} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[9px] font-orbitron font-bold text-gray-500 uppercase block mb-1">Valor do Saque (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="10"
                        placeholder="Mín: R$ 10,00"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full bg-[#FAFAFA] border border-[#E5E5E5] focus:border-black rounded-xl px-3.5 py-2.5 text-xs text-black focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-orbitron font-bold text-gray-500 uppercase block mb-1">Tipo de Chave PIX</label>
                      <select
                        value={withdrawPixKeyType}
                        onChange={(e) => setWithdrawPixKeyType(e.target.value as any)}
                        className="w-full bg-[#FAFAFA] border border-[#E5E5E5] focus:border-black rounded-xl px-3.5 py-2.5 text-xs text-black focus:outline-none"
                      >
                        <option value="CPF">CPF / CNPJ</option>
                        <option value="EMAIL">E-mail</option>
                        <option value="PHONE">Telefone Celular</option>
                        <option value="RANDOM">Chave Aleatória</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-orbitron font-bold text-gray-500 uppercase block mb-1">Chave PIX de Destino</label>
                    <input
                      type="text"
                      placeholder="Informe sua chave PIX para recebimento"
                      value={withdrawPixKey}
                      onChange={(e) => setWithdrawPixKey(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-[#E5E5E5] focus:border-black rounded-xl px-3.5 py-2.5 text-xs text-black focus:outline-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isWithdrawing}
                    className="w-full bg-[#171717] hover:bg-black text-white font-orbitron font-black text-[10px] py-3 rounded-xl uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isWithdrawing ? 'Registrando saque...' : 'Solicitar Saque via PIX'}
                  </button>
                </form>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 text-[10px] text-gray-500 font-sans flex items-center justify-between">
                <span>Saldo Real Disponível para Saque:</span>
                <span className="font-mono font-black text-black">{formatBRL((wallet.availableBalance || 0) / 100)}</span>
              </div>
            </div>
          </div>

          {/* Transactions ledger section */}
          <TransactionHistory transactions={transactions} />
        </>
      )}
    </div>
  );
}
