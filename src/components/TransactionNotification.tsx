import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Wallet,
  Gift,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Ticket,
  Star,
  Heart,
  ShieldCheck,
  X,
  ArrowRight
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { formatBRL } from '../utils/money';

export interface FinancialNotificationItem {
  id: string;
  transactionId: string;
  statusKey: string;
  userId: string;
  type: string;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'FAILED' | 'REFUNDED' | 'CANCELED' | 'EXPIRED';
  variant: 'success' | 'warning' | 'error' | 'info' | 'promo';
  title: string;
  message: string;
  amountCentavos: number;
  walletType?: 'REAL' | 'PROMO';
  actionLabel?: string;
  actionTab?: string;
  createdAt: string;
}

interface TransactionNotificationProps {
  currentUser: any;
  onNavigateTab?: (tab: string) => void;
}

const SEEN_STORAGE_PREFIX = 'voxa_seen_fin_tx_states_v1_';

function loadSeenStateKeys(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${SEEN_STORAGE_PREFIX}${uid}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenStateKey(uid: string, key: string, setRef: Set<string>) {
  setRef.add(key);
  try {
    const arr = Array.from(setRef).slice(-400);
    localStorage.setItem(`${SEEN_STORAGE_PREFIX}${uid}`, JSON.stringify(arr));
  } catch {}
}

export function formatCentavosBRL(centavos: number): string {
  const absCentavos = Math.abs(Number(centavos || 0));
  return formatBRL(absCentavos / 100);
}

/**
 * Translates a real Firestore `wallet_transactions` document into a rich, human-readable
 * financial feedback notification based on its type, direction, walletType, and status.
 */
export function buildFinancialNotificationFromTx(tx: any): FinancialNotificationItem | null {
  if (!tx || !tx.id) return null;

  const rawStatus = String(tx.status || 'completed').toUpperCase().trim();
  let normalizedStatus: FinancialNotificationItem['status'] = 'COMPLETED';

  if (rawStatus === 'PENDING' || rawStatus === 'PENDENTE' || rawStatus === 'PROCESSING' || rawStatus === 'IN_PROCESS') {
    normalizedStatus = 'PENDING';
  } else if (rawStatus === 'COMPLETED' || rawStatus === 'APPROVED' || rawStatus === 'APROVADO' || rawStatus === 'SUCCESS' || rawStatus === 'PAGO') {
    normalizedStatus = 'APPROVED';
  } else if (rawStatus === 'REFUNDED' || rawStatus === 'REEMBOLSADO' || rawStatus === 'ESTORNO') {
    normalizedStatus = 'REFUNDED';
  } else if (rawStatus === 'EXPIRED' || rawStatus === 'EXPIRADO') {
    normalizedStatus = 'EXPIRED';
  } else if (rawStatus === 'CANCELED' || rawStatus === 'CANCELLED' || rawStatus === 'CANCELADO') {
    normalizedStatus = 'CANCELED';
  } else if (rawStatus === 'FAILED' || rawStatus === 'REJECTED' || rawStatus === 'FALHOU' || rawStatus === 'RECUSADO') {
    normalizedStatus = 'REJECTED';
  }

  const rawType = String(tx.type || '').toUpperCase().trim();
  const direction = String(tx.direction || (Number(tx.amount || 0) >= 0 ? 'IN' : 'OUT')).toUpperCase().trim();
  const walletType: 'REAL' | 'PROMO' = String(tx.walletType || '').toUpperCase() === 'PROMO' || rawType === 'REFERRAL_BONUS' ? 'PROMO' : 'REAL';
  const amountCentavos = Math.abs(Number(tx.netAmount !== undefined && tx.netAmount !== 0 ? tx.netAmount : (tx.amount || tx.grossAmount || 0)));
  const grossCentavos = Math.abs(Number(tx.grossAmount || tx.amount || 0));
  const formattedAmount = formatCentavosBRL(amountCentavos || grossCentavos);
  const formattedGross = formatCentavosBRL(grossCentavos || amountCentavos);
  const desc = String(tx.description || '').trim();

  const statusKey = `${tx.id}:${normalizedStatus}`;
  const createdAt = tx.processedAt || tx.updatedAt || tx.createdAt || new Date().toISOString();

  // 1. DEPÓSITO PIX
  if (rawType === 'DEPOSIT' || rawType === 'PIX_DEPOSIT') {
    if (normalizedStatus === 'PENDING') {
      return {
        id: `fin_toast_${tx.id}_PENDING`,
        transactionId: tx.id,
        statusKey,
        userId: tx.userId,
        type: rawType,
        status: 'PENDING',
        variant: 'warning',
        title: 'Pagamento pendente',
        message: `Aguardando confirmação do seu PIX de ${formattedGross}.`,
        amountCentavos: grossCentavos,
        walletType: 'REAL',
        actionLabel: 'Ver carteira',
        actionTab: 'wallet',
        createdAt
      };
    }
    if (normalizedStatus === 'APPROVED') {
      return {
        id: `fin_toast_${tx.id}_APPROVED`,
        transactionId: tx.id,
        statusKey,
        userId: tx.userId,
        type: rawType,
        status: 'APPROVED',
        variant: 'success',
        title: 'Depósito recebido!',
        message: `${formattedGross} foram adicionados à sua carteira VOXA.`,
        amountCentavos: grossCentavos,
        walletType: 'REAL',
        actionLabel: 'Ver carteira',
        actionTab: 'wallet',
        createdAt
      };
    }
    if (normalizedStatus === 'EXPIRED') {
      return {
        id: `fin_toast_${tx.id}_EXPIRED`,
        transactionId: tx.id,
        statusKey,
        userId: tx.userId,
        type: rawType,
        status: 'EXPIRED',
        variant: 'error',
        title: 'PIX expirado',
        message: `O código PIX de ${formattedGross} expirou antes da confirmação.`,
        amountCentavos: grossCentavos,
        walletType: 'REAL',
        actionLabel: 'Gerar novo PIX',
        actionTab: 'wallet',
        createdAt
      };
    }
    return {
      id: `fin_toast_${tx.id}_${normalizedStatus}`,
      transactionId: tx.id,
      statusKey,
      userId: tx.userId,
      type: rawType,
      status: normalizedStatus,
      variant: 'error',
      title: 'Pagamento não concluído',
      message: `Não foi possível confirmar seu depósito PIX de ${formattedGross}.`,
      amountCentavos: grossCentavos,
      walletType: 'REAL',
      actionLabel: 'Ver carteira',
      actionTab: 'wallet',
      createdAt
    };
  }

  // 2. SAQUES (WITHDRAWAL)
  if (rawType === 'WITHDRAWAL' || rawType === 'SAQUE') {
    if (normalizedStatus === 'PENDING') {
      return {
        id: `fin_toast_${tx.id}_PENDING`,
        transactionId: tx.id,
        statusKey,
        userId: tx.userId,
        type: rawType,
        status: 'PENDING',
        variant: 'warning',
        title: 'Saque solicitado',
        message: `Seu saque de ${formattedGross} está em análise para envio via PIX.`,
        amountCentavos: grossCentavos,
        walletType: 'REAL',
        actionLabel: 'Ver carteira',
        actionTab: 'wallet',
        createdAt
      };
    }
    if (normalizedStatus === 'APPROVED') {
      return {
        id: `fin_toast_${tx.id}_APPROVED`,
        transactionId: tx.id,
        statusKey,
        userId: tx.userId,
        type: rawType,
        status: 'APPROVED',
        variant: 'success',
        title: 'Saque enviado via PIX',
        message: `Seu saque de ${formattedAmount} foi aprovado e enviado com sucesso.`,
        amountCentavos: amountCentavos || grossCentavos,
        walletType: 'REAL',
        actionLabel: 'Ver carteira',
        actionTab: 'wallet',
        createdAt
      };
    }
    return {
      id: `fin_toast_${tx.id}_${normalizedStatus}`,
      transactionId: tx.id,
      statusKey,
      userId: tx.userId,
      type: rawType,
      status: normalizedStatus,
      variant: 'error',
      title: 'Saque recusado',
      message: desc || `Seu pedido de saque de ${formattedGross} foi recusado e o saldo estornado.`,
      amountCentavos: grossCentavos,
      walletType: 'REAL',
      actionLabel: 'Ver carteira',
      actionTab: 'wallet',
      createdAt
    };
  }

  // 3. BÔNUS DE INDICAÇÃO / CARTEIRA PROMOCIONAL
  if (rawType === 'REFERRAL_BONUS' || walletType === 'PROMO') {
    return {
      id: `fin_toast_${tx.id}_${normalizedStatus}`,
      transactionId: tx.id,
      statusKey,
      userId: tx.userId,
      type: 'REFERRAL_BONUS',
      status: 'APPROVED',
      variant: 'promo',
      title: 'Bônus de indicação creditado!',
      message: `${formattedAmount} adicionados na sua Carteira Promocional VOXA.`,
      amountCentavos: amountCentavos || grossCentavos,
      walletType: 'PROMO',
      actionLabel: 'Ver carteira promocional',
      actionTab: 'wallet',
      createdAt
    };
  }

  // 4. VOXA TRADE (RESERVA E LIQUIDAÇÃO)
  if (rawType === 'TRADE_STAKE_RESERVED') {
    return {
      id: `fin_toast_${tx.id}_${normalizedStatus}`,
      transactionId: tx.id,
      statusKey,
      userId: tx.userId,
      type: rawType,
      status: 'APPROVED',
      variant: 'info',
      title: 'Operação aberta no VOXA Trade',
      message: `${formattedGross} reservados do seu saldo disponível. ${desc.replace('Reserva VOXA Trade: ', '')}`,
      amountCentavos: grossCentavos,
      walletType: 'REAL',
      actionLabel: 'Ver posições',
      actionTab: 'trade',
      createdAt
    };
  }

  if (rawType === 'TRADE_PAYOUT_WON') {
    const totalCredited = formatCentavosBRL(Math.abs(Number(tx.amount || 0)));
    const netProfit = formatCentavosBRL(Math.abs(Number(tx.netAmount || 0)));
    return {
      id: `fin_toast_${tx.id}_${normalizedStatus}`,
      transactionId: tx.id,
      statusKey,
      userId: tx.userId,
      type: rawType,
      status: 'APPROVED',
      variant: 'success',
      title: 'Operação encerrada com ganho! 📈',
      message: `Retorno total de ${totalCredited} (Lucro líquido: +${netProfit}) creditado no seu saldo disponível.`,
      amountCentavos: Math.abs(Number(tx.amount || 0)),
      walletType: 'REAL',
      actionLabel: 'Ver carteira',
      actionTab: 'wallet',
      createdAt
    };
  }

  if (rawType === 'TRADE_STAKE_LOST') {
    return {
      id: `fin_toast_${tx.id}_${normalizedStatus}`,
      transactionId: tx.id,
      statusKey,
      userId: tx.userId,
      type: rawType,
      status: 'APPROVED',
      variant: 'error',
      title: 'Operação encerrada com perda',
      message: `${ desc || 'Posição finalizada fora da direção prevista' } (-${formattedGross}).`,
      amountCentavos: grossCentavos,
      walletType: 'REAL',
      actionLabel: 'Ver histórico Trade',
      actionTab: 'trade',
      createdAt
    };
  }

  if (rawType === 'TRADE_STAKE_REFUNDED') {
    return {
      id: `fin_toast_${tx.id}_${normalizedStatus}`,
      transactionId: tx.id,
      statusKey,
      userId: tx.userId,
      type: rawType,
      status: 'REFUNDED',
      variant: 'info',
      title: 'Valor devolvido ao saldo disponível',
      message: `${formattedGross} retornaram livremente para sua carteira (${desc || 'Empate/Cancelamento VOXA Trade'}).`,
      amountCentavos: grossCentavos,
      walletType: 'REAL',
      actionLabel: 'Ver carteira',
      actionTab: 'wallet',
      createdAt
    };
  }

  // 5. COMPRAS (STORE, TICKETS, ASSINATURAS, VAQUINHAS, SUSSURRO, ANÚNCIOS)
  if (
    rawType === 'PURCHASE' ||
    rawType === 'PURCHASE_STORE' ||
    rawType === 'PURCHASE_TICKET' ||
    rawType === 'PURCHASE_SUBSCRIPTION' ||
    rawType === 'FUNDRAISER_CONTRIBUTION' ||
    rawType === 'SUSSURRO_REVEAL' ||
    rawType === 'AD_CAMPAIGN'
  ) {
    const isTicket = rawType === 'PURCHASE_TICKET' || String(tx.referenceType || '').toLowerCase() === 'ticket';
    const isSub = rawType === 'PURCHASE_SUBSCRIPTION' || String(tx.referenceType || '').toLowerCase() === 'subscription';
    const isFundraiser = rawType === 'FUNDRAISER_CONTRIBUTION' || String(tx.referenceType || '').toLowerCase() === 'fundraiser';
    const isSussurro = rawType === 'SUSSURRO_REVEAL' || String(tx.referenceType || '').toLowerCase() === 'sussurro';

    if (normalizedStatus === 'PENDING') {
      return {
        id: `fin_toast_${tx.id}_PENDING`,
        transactionId: tx.id,
        statusKey,
        userId: tx.userId,
        type: rawType,
        status: 'PENDING',
        variant: 'warning',
        title: 'Pagamento pendente',
        message: `Aguardando confirmação do PIX de ${formattedGross} (${desc || 'Pedido VOXA'}).`,
        amountCentavos: grossCentavos,
        walletType: 'REAL',
        actionLabel: 'Ver carteira',
        actionTab: 'wallet',
        createdAt
      };
    }

    if (normalizedStatus === 'APPROVED') {
      const title = isTicket
        ? 'Ingresso emitido!'
        : isSub
        ? 'Assinatura ativada!'
        : isFundraiser
        ? 'Contribuição confirmada!'
        : isSussurro
        ? 'Sussurro revelado!'
        : 'Compra aprovada!';

      const message = isTicket
        ? `Pagamento de ${formattedGross} aprovado. Seu QR Code já está liberado (${desc}).`
        : isSub
        ? `Sua assinatura (${desc}) de ${formattedGross} está ativa.`
        : isFundraiser
        ? `Seu apoio de ${formattedGross} foi registrado com sucesso (${desc}).`
        : isSussurro
        ? `Pagamento de ${formattedGross} confirmado para revelar identidade do Sussurro.`
        : `Pagamento de ${formattedGross} confirmado (${desc || 'VOXA Store'}).`;

      return {
        id: `fin_toast_${tx.id}_APPROVED`,
        transactionId: tx.id,
        statusKey,
        userId: tx.userId,
        type: rawType,
        status: 'APPROVED',
        variant: 'success',
        title,
        message,
        amountCentavos: grossCentavos,
        walletType: 'REAL',
        actionLabel: isTicket ? 'Meus ingressos' : isSussurro ? 'Ver Sussurros' : 'Ver carteira',
        actionTab: isTicket ? 'settings' : isSussurro ? 'sussurros' : 'wallet',
        createdAt
      };
    }
  }

  // 6. VENDAS RECEBIDAS PELO VENDEDOR / CRIADOR / ORGANIZADOR
  if (
    rawType === 'SALE' ||
    rawType === 'SALE_STORE' ||
    rawType === 'SALE_TICKET' ||
    rawType === 'SALE_SUBSCRIPTION' ||
    rawType === 'FUNDRAISER_RECEIVED'
  ) {
    if (normalizedStatus === 'APPROVED') {
      return {
        id: `fin_toast_${tx.id}_APPROVED`,
        transactionId: tx.id,
        statusKey,
        userId: tx.userId,
        type: rawType,
        status: 'APPROVED',
        variant: 'success',
        title: rawType === 'FUNDRAISER_RECEIVED' ? 'Apoio recebido na Vaquinha!' : 'Nova venda recebida!',
        message: `Você recebeu ${formattedAmount} líquidos na sua carteira VOXA (${desc || 'Venda confirmada'}).`,
        amountCentavos: amountCentavos || grossCentavos,
        walletType: 'REAL',
        actionLabel: 'Ver carteira',
        actionTab: 'wallet',
        createdAt
      };
    }
  }

  // 7. REEMBOLSOS / ESTORNOS
  if (rawType === 'REFUND' || rawType === 'ESTORNO' || normalizedStatus === 'REFUNDED') {
    return {
      id: `fin_toast_${tx.id}_REFUNDED`,
      transactionId: tx.id,
      statusKey,
      userId: tx.userId,
      type: rawType || 'REFUND',
      status: 'REFUNDED',
      variant: 'info',
      title: 'Reembolso creditado',
      message: `Estorno de ${formattedGross} foi creditado de volta na sua carteira (${desc || 'Reembolso'}).`,
      amountCentavos: grossCentavos,
      walletType: 'REAL',
      actionLabel: 'Ver carteira',
      actionTab: 'wallet',
      createdAt
    };
  }

  // 8. AJUSTES ADMINISTRATIVOS
  if (rawType === 'ADMIN_ADJUSTMENT' || rawType === 'ADJUSTMENT') {
    const isCredit = direction === 'IN' || Number(tx.amount || 0) > 0;
    return {
      id: `fin_toast_${tx.id}_${normalizedStatus}`,
      transactionId: tx.id,
      statusKey,
      userId: tx.userId,
      type: 'ADMIN_ADJUSTMENT',
      status: 'APPROVED',
      variant: isCredit ? 'success' : 'warning',
      title: isCredit ? 'Crédito administrativo recebido' : 'Ajuste de débito aplicado',
      message: `${isCredit ? '+' : '-'}${formattedGross} na sua carteira VOXA (${desc || 'Ajuste Administrativo'}).`,
      amountCentavos: grossCentavos,
      walletType,
      actionLabel: 'Ver carteira',
      actionTab: 'wallet',
      createdAt
    };
  }

  return null;
}

export const TransactionNotification: React.FC<TransactionNotificationProps> = ({
  currentUser,
  onNavigateTab
}) => {
  const [activeToasts, setActiveToasts] = useState<FinancialNotificationItem[]>([]);
  const seenKeysRef = useRef<Set<string>>(new Set());
  const isInitialSnapshotRef = useRef<boolean>(true);
  const previousStatusByTxIdRef = useRef<Map<string, string>>(new Map());

  const uid = currentUser?.uid || currentUser?.id || '';

  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) return;

    seenKeysRef.current = loadSeenStateKeys(uid);
    isInitialSnapshotRef.current = true;
    previousStatusByTxIdRef.current.clear();

    const txQuery = query(
      collection(db, 'wallet_transactions'),
      where('userId', '==', uid)
    );

    const unsubscribe = onSnapshot(
      txQuery,
      (snapshot) => {
        const nowMs = Date.now();
        const newlyTriggered: FinancialNotificationItem[] = [];

        snapshot.docChanges().forEach((change) => {
          const txData = { id: change.doc.id, ...change.doc.data() } as any;
          const built = buildFinancialNotificationFromTx(txData);
          if (!built) return;

          const prevStatus = previousStatusByTxIdRef.current.get(txData.id);
          previousStatusByTxIdRef.current.set(txData.id, built.status);

          // On initial page load: mark existing historical states as seen,
          // UNLESS a transaction was just approved/updated within the last 25 seconds and hasn't been seen yet!
          const txTimeMs = new Date(built.createdAt).getTime() || 0;
          const isVeryRecent = nowMs - txTimeMs < 25000;

          if (isInitialSnapshotRef.current) {
            if (seenKeysRef.current.has(built.statusKey)) {
              return;
            }
            if (!isVeryRecent) {
              saveSeenStateKey(uid, built.statusKey, seenKeysRef.current);
              return;
            }
          }

          // Deduplication: never show the exact same (transactionId + status) twice
          if (seenKeysRef.current.has(built.statusKey)) {
            return;
          }

          // If it's a modification where status didn't change, skip
          if (change.type === 'modified' && prevStatus === built.status) {
            return;
          }

          saveSeenStateKey(uid, built.statusKey, seenKeysRef.current);
          newlyTriggered.push(built);

          // Also ensure a persistent notification entry exists in the bell center (`notifications`)
          // when a transaction transitions from PENDING or is newly created on the client
          ensureBellNotificationPersisted(uid, currentUser?.email, built).catch(() => {});
        });

        isInitialSnapshotRef.current = false;

        if (newlyTriggered.length > 0) {
          setActiveToasts((prev) => {
            // Replace any existing toast for the same transactionId (e.g. PENDING -> APPROVED)
            const filteredPrev = prev.filter(
              (item) => !newlyTriggered.some((n) => n.transactionId === item.transactionId)
            );
            return [...newlyTriggered, ...filteredPrev].slice(0, 4);
          });

          // Broadcast custom event so any open modal/drawer (e.g. WalletDashboard, VoxaTradeSection) can react immediately
          window.dispatchEvent(
            new CustomEvent('voxa_financial_transaction_event', {
              detail: { transactions: newlyTriggered }
            })
          );
        }
      },
      (err) => {
        console.warn('[TransactionNotification] Listener error:', err);
      }
    );

    return () => unsubscribe();
  }, [uid, currentUser?.email]);

  // Auto-dismiss toasts after 8 seconds (12 seconds for approved deposits/payouts)
  useEffect(() => {
    if (activeToasts.length === 0) return;
    const timers = activeToasts.map((toast) => {
      const duration = toast.status === 'APPROVED' ? 10000 : 7500;
      return setTimeout(() => {
        setActiveToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, duration);
    });
    return () => timers.forEach(clearTimeout);
  }, [activeToasts]);

  const handleDismiss = (id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[85] flex flex-col gap-3 max-w-sm w-[calc(100vw-2rem)] pointer-events-none">
      {activeToasts.map((item) => {
        const isSuccess = item.variant === 'success';
        const isWarning = item.variant === 'warning';
        const isError = item.variant === 'error';
        const isPromo = item.variant === 'promo';

        const containerClasses = isSuccess
          ? 'bg-[#0d1915]/95 border-emerald-500/60 shadow-emerald-950/50'
          : isWarning
          ? 'bg-[#1a150b]/95 border-amber-500/60 shadow-amber-950/50'
          : isError
          ? 'bg-[#1c0d12]/95 border-red-500/60 shadow-red-950/50'
          : isPromo
          ? 'bg-[#180d26]/95 border-purple-500/60 shadow-purple-950/50'
          : 'bg-[#12111d]/95 border-white/30 shadow-black/60';

        const badgeColor = isSuccess
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          : isWarning
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          : isError
          ? 'bg-red-500/20 text-red-300 border-red-500/30'
          : isPromo
          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
          : 'bg-white/10 text-gray-200 border-white/20';

        return (
          <div
            key={item.id}
            className={`pointer-events-auto border-2 rounded-2xl p-4 text-white shadow-2xl backdrop-blur-xl transition-all duration-300 animate-fadeIn ${containerClasses}`}
          >
            <div className="flex items-start gap-3.5">
              {/* Status / Category Icon */}
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${badgeColor}`}
              >
                {item.type.includes('TRADE') ? (
                  item.status === 'APPROVED' && item.variant === 'success' ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : item.variant === 'error' ? (
                    <TrendingDown className="w-5 h-5" />
                  ) : (
                    <Clock className="w-5 h-5" />
                  )
                ) : isPromo ? (
                  <Gift className="w-5 h-5" />
                ) : isSuccess ? (
                  <CheckCircle className="w-5 h-5" />
                ) : isWarning ? (
                  <Clock className="w-5 h-5 animate-pulse" />
                ) : isError ? (
                  <XCircle className="w-5 h-5" />
                ) : (
                  <RotateCcw className="w-5 h-5" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[9px] font-orbitron font-black uppercase px-2 py-0.5 rounded-full border ${badgeColor}`}
                  >
                    {item.walletType === 'PROMO'
                      ? 'Carteira Promocional'
                      : item.status === 'PENDING'
                      ? 'Status: Pendente'
                      : item.status === 'APPROVED'
                      ? 'Confirmado em Tempo Real'
                      : item.status === 'REFUNDED'
                      ? 'Estornado'
                      : 'Atualização Financeira'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDismiss(item.id)}
                    className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                    aria-label="Fechar notificação"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <h4 className="font-orbitron font-black text-sm text-white mt-1.5 leading-snug">
                  {isSuccess ? `✓ ${item.title}` : item.title}
                </h4>

                <p className="text-xs text-gray-300 font-sans mt-1 leading-relaxed">
                  {item.message}
                </p>

                <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                  <span className="font-mono font-black text-xs text-white">
                    {formatCentavosBRL(item.amountCentavos)}
                  </span>

                  {item.actionLabel && item.actionTab && onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateTab(item.actionTab!);
                        handleDismiss(item.id);
                      }}
                      className="inline-flex items-center gap-1.5 text-[10px] font-orbitron font-black uppercase px-3 py-1.5 rounded-xl bg-white text-black hover:bg-neutral-200 transition-colors cursor-pointer"
                    >
                      <Wallet className="w-3 h-3" />
                      <span>{item.actionLabel}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

async function ensureBellNotificationPersisted(
  uid: string,
  userEmail: string | undefined,
  item: FinancialNotificationItem
): Promise<void> {
  // Deterministic notification ID so backend + frontend never duplicate the same transaction status notification
  const notifDocId = `fin_notif_${item.transactionId}_${item.status}`;
  try {
    await setDoc(
      doc(db, 'notifications', notifDocId),
      {
        id: notifDocId,
        userId: uid,
        recipientUid: uid,
        userEmail: userEmail || '',
        title: item.title,
        message: item.message,
        type: 'financial',
        financialType: item.type,
        financialStatus: item.status,
        transactionId: item.transactionId,
        amountCentavos: item.amountCentavos,
        walletType: item.walletType || 'REAL',
        actionTab: item.actionTab || 'wallet',
        read: false,
        createdAt: item.createdAt || new Date().toISOString()
      },
      { merge: true }
    );
  } catch {
    // Non-blocking if rules or network prevent client write (backend also writes notifications)
  }
}
