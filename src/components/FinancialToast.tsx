import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle,
  Clock,
  XCircle,
  RotateCcw,
  Wallet,
  Gift,
  TrendingUp,
  TrendingDown,
  Sparkles,
  X,
  ArrowRight
} from 'lucide-react';
import { onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured, collection, query, where, doc, setDoc } from '../lib/firebase';
import {
  FinancialNotificationItem,
  buildFinancialNotificationFromTx,
  formatCentavosBRL
} from './TransactionNotification';

export interface FinancialToastContextValue {
  /** Lista de toasts financeiros atualmente visíveis na tela */
  activeToasts: FinancialNotificationItem[];
  /** Lista completa de transações reais do usuário ouvidas em tempo real via onSnapshot no Firestore */
  transactions: any[];
  /** Saldo real disponível ouvido em tempo real (em centavos) */
  availableBalanceCentavos: number;
  /** Saldo promocional ouvido em tempo real (em centavos) */
  promoBalanceCentavos: number;
  /** Callback de navegação configurado no Provider para os botões de ação (ex: 'Ver Carteira') */
  navigateToTab: (tab: string) => void;
  /** Dispara manualmente um toast financeiro a partir de uma transação real ou objeto de notificação */
  pushFinancialToast: (item: FinancialNotificationItem) => void;
  /** Remove um toast específico da fila visível */
  dismissToast: (id: string) => void;
  /** Limpa todos os toasts visíveis */
  clearAllToasts: () => void;
}

const FinancialToastContext = createContext<FinancialToastContextValue | undefined>(undefined);

export function useFinancialToast(): FinancialToastContextValue {
  const ctx = useContext(FinancialToastContext);
  if (!ctx) {
    return {
      activeToasts: [],
      transactions: [],
      availableBalanceCentavos: 0,
      promoBalanceCentavos: 0,
      navigateToTab: () => {},
      pushFinancialToast: () => {},
      dismissToast: () => {},
      clearAllToasts: () => {}
    };
  }
  return ctx;
}

const SEEN_STORAGE_PREFIX = 'voxa_seen_fin_tx_states_v1_';

let sharedAudioContext: AudioContext | null = null;
let lastChimePlayedAtMs = 0;

/**
 * Toca um aviso sonoro sutil e distinto via Web Audio API conforme o tipo/status da transação financeira:
 * - 'success' / 'promo': acorde ascendente cristalino (C5 -> E5 -> G5/B5)
 * - 'warning' (PENDING): pulso suave duplo (A4 -> E5)
 * - 'error' (REJECTED/EXPIRED/LOST): dois tons graves discretos (E4 -> C4)
 * - 'info' (REFUND/RESERVE): arpejo neutro limpo (D5 -> A5)
 */
export function playFinancialChime(variant: FinancialNotificationItem['variant'] = 'success'): void {
  if (typeof window === 'undefined') return;
  const nowMs = Date.now();
  if (nowMs - lastChimePlayedAtMs < 400) return; // Evita sobreposição se múltiplos eventos chegarem no mesmo frame
  lastChimePlayedAtMs = nowMs;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!sharedAudioContext) {
      sharedAudioContext = new AudioCtx();
    }
    const ctx = sharedAudioContext;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const baseTime = ctx.currentTime + 0.01;

    const scheduleTone = (
      freq: number,
      startOffset: number,
      duration: number,
      peakGain: number,
      oscType: OscillatorType = 'sine'
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = oscType;
      osc.frequency.setValueAtTime(freq, baseTime + startOffset);

      gain.gain.setValueAtTime(0.0001, baseTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(peakGain, baseTime + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, baseTime + startOffset + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(baseTime + startOffset);
      osc.stop(baseTime + startOffset + duration + 0.02);
    };

    if (variant === 'success' || variant === 'promo') {
      // Acorde ascendente sutil estilo fintech/cash-in (C5 -> E5 -> G5 -> C6)
      scheduleTone(523.25, 0, 0.16, 0.065, 'sine');
      scheduleTone(659.25, 0.07, 0.18, 0.075, 'sine');
      scheduleTone(783.99, 0.14, 0.24, 0.085, 'triangle');
      scheduleTone(1046.5, 0.21, 0.36, 0.06, 'sine');
    } else if (variant === 'warning') {
      // Toque suave de aguardando confirmação (A4 -> E5)
      scheduleTone(440.0, 0, 0.14, 0.05, 'sine');
      scheduleTone(659.25, 0.09, 0.22, 0.055, 'sine');
    } else if (variant === 'error') {
      // Toque discreto descendente de alerta/falha (E4 -> C4)
      scheduleTone(329.63, 0, 0.16, 0.06, 'triangle');
      scheduleTone(261.63, 0.11, 0.26, 0.065, 'sine');
    } else {
      // Toque informativo limpo (D5 -> A5)
      scheduleTone(587.33, 0, 0.14, 0.055, 'sine');
      scheduleTone(880.0, 0.08, 0.22, 0.06, 'sine');
    }
  } catch {
    // Ignora silenciosamente se o navegador bloquear autoplay antes de interação do usuário
  }
}

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

async function ensureBellNotificationPersisted(
  uid: string,
  userEmail: string | undefined,
  item: FinancialNotificationItem
): Promise<void> {
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
    // Non-blocking fallback
  }
}

export interface FinancialToastProps {
  onNavigateTab?: (tab: string) => void;
}

/**
 * Componente de overlay global (`FinancialToast`) seguindo o design futurista da VOXA:
 * - Posicionado fixamente no topo no mobile (`top-16 left-3 right-3`) e no canto superior direito no desktop (`sm:top-20 sm:right-5`).
 * - Animações fluidas de entrada/saída e layout via `motion/react` (`AnimatePresence` + `motion.div`).
 * - Exibe dinamicamente o título, a mensagem, o valor formatado e o botão de ação (ex: "Ver Carteira") vindos do contexto.
 */
export const FinancialToast: React.FC<FinancialToastProps> = ({ onNavigateTab }) => {
  const { activeToasts, dismissToast, navigateToTab } = useFinancialToast();
  const handleActionNavigate = onNavigateTab || navigateToTab;

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notificações financeiras em tempo real"
      className="fixed top-16 left-3 right-3 sm:left-auto sm:top-20 sm:right-6 z-[95] flex flex-col gap-3 sm:w-full sm:max-w-[380px] pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {activeToasts.map((item) => {
          const isSuccess = item.variant === 'success';
          const isWarning = item.variant === 'warning';
          const isError = item.variant === 'error';
          const isPromo = item.variant === 'promo';

          const accentBarColor = isSuccess
            ? 'from-emerald-400 via-emerald-500 to-teal-400'
            : isWarning
            ? 'from-amber-400 via-amber-500 to-orange-400'
            : isError
            ? 'from-rose-500 via-[#FF0033] to-red-500'
            : isPromo
            ? 'from-fuchsia-400 via-purple-500 to-indigo-400'
            : 'from-white/80 via-gray-300 to-white/60';

          const cardThemeClasses = isSuccess
            ? 'bg-[#090d11]/95 border-emerald-500/40 shadow-[0_20px_50px_rgba(16,185,129,0.18)]'
            : isWarning
            ? 'bg-[#0e0c09]/95 border-amber-500/40 shadow-[0_20px_50px_rgba(245,158,11,0.16)]'
            : isError
            ? 'bg-[#12080c]/95 border-rose-500/45 shadow-[0_20px_50px_rgba(244,63,94,0.2)]'
            : isPromo
            ? 'bg-[#100919]/95 border-purple-500/45 shadow-[0_20px_50px_rgba(168,85,247,0.22)]'
            : 'bg-[#0c0b14]/95 border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.65)]';

          const badgeClasses = isSuccess
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            : isWarning
            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            : isError
            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
            : isPromo
            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
            : 'bg-white/10 text-gray-200 border-white/20';

          const actionButtonClasses = isSuccess
            ? 'bg-emerald-400 text-[#05110c] hover:bg-emerald-300'
            : isPromo
            ? 'bg-purple-400 text-[#11061c] hover:bg-purple-300'
            : 'bg-white text-black hover:bg-neutral-200';

          const resolvedActionLabel = item.actionLabel || 'Ver Carteira';
          const resolvedActionTab = item.actionTab || 'wallet';

          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.94, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: 40, scale: 0.92, filter: 'blur(4px)' }}
              transition={{
                type: 'spring',
                stiffness: 420,
                damping: 30,
                mass: 0.8
              }}
              className={`pointer-events-auto relative overflow-hidden border rounded-2xl p-4 text-white backdrop-blur-2xl ${cardThemeClasses}`}
            >
              {/* Top Neon Accent Line */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accentBarColor}`}
              />

              <div className="flex items-start gap-3.5 pt-0.5">
                {/* Status / Category Icon */}
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${badgeClasses}`}
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

                {/* Dynamic Title, Message & Action Button */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[9px] font-orbitron font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeClasses}`}
                    >
                      {isPromo && <Sparkles className="w-2.5 h-2.5" />}
                      {item.walletType === 'PROMO'
                        ? 'Carteira Promocional'
                        : item.status === 'PENDING'
                        ? 'Pagamento Pendente'
                        : item.status === 'APPROVED'
                        ? 'Confirmado • VOXA Pay'
                        : item.status === 'REFUNDED'
                        ? 'Reembolso'
                        : item.status === 'EXPIRED'
                        ? 'PIX Expirado'
                        : 'VOXA Financeiro'}
                    </span>

                    <button
                      type="button"
                      onClick={() => dismissToast(item.id)}
                      className="text-gray-400 hover:text-white hover:bg-white/10 p-1 rounded-lg transition-colors cursor-pointer"
                      aria-label="Fechar notificação"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Dynamic Title */}
                  <h4 className="font-orbitron font-black text-sm text-white mt-1.5 leading-snug tracking-tight">
                    {isSuccess && !item.title.startsWith('✓') ? `✓ ${item.title}` : item.title}
                  </h4>

                  {/* Dynamic Message */}
                  <p className="text-xs text-gray-300 font-sans mt-1 leading-relaxed">
                    {item.message}
                  </p>

                  {/* Footer with Formatted Amount & Action CTA (e.g. 'Ver Carteira') */}
                  <div className="mt-3.5 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-orbitron uppercase tracking-widest text-gray-400">
                        Valor
                      </span>
                      <span className="font-mono font-black text-xs text-white">
                        {formatCentavosBRL(item.amountCentavos)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handleActionNavigate(resolvedActionTab);
                        dismissToast(item.id);
                      }}
                      className={`inline-flex items-center gap-1.5 text-[10px] font-orbitron font-black uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all shadow-md cursor-pointer ${actionButtonClasses}`}
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>{resolvedActionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export interface FinancialToastProviderProps {
  currentUser: any;
  onNavigateTab?: (tab: string) => void;
  children: React.ReactNode;
}

/**
 * Provider global que mantém os listeners em tempo real (`onSnapshot`) para `wallet_transactions`
 * e `wallets` do usuário autenticado, alimenta o contexto e renderiza o `<FinancialToast />` fixo.
 */
export const FinancialToastProvider: React.FC<FinancialToastProviderProps> = ({
  currentUser,
  onNavigateTab,
  children
}) => {
  const [activeToasts, setActiveToasts] = useState<FinancialNotificationItem[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [availableBalanceCentavos, setAvailableBalanceCentavos] = useState<number>(0);
  const [promoBalanceCentavos, setPromoBalanceCentavos] = useState<number>(0);

  const seenKeysRef = useRef<Set<string>>(new Set());
  const isInitialSnapshotRef = useRef<boolean>(true);
  const previousStatusByTxIdRef = useRef<Map<string, string>>(new Map());

  const uid = currentUser?.uid || currentUser?.id || '';

  const navigateToTab = useCallback(
    (tab: string) => {
      if (onNavigateTab) {
        onNavigateTab(tab);
      } else if (typeof window !== 'undefined') {
        window.history.pushState(null, '', `/${tab}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    },
    [onNavigateTab]
  );

  const pushFinancialToast = useCallback((item: FinancialNotificationItem) => {
    playFinancialChime(item.variant);
    setActiveToasts((prev) => {
      const filteredPrev = prev.filter((t) => t.transactionId !== item.transactionId);
      return [item, ...filteredPrev].slice(0, 4);
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setActiveToasts([]);
  }, []);

  // 1. Real-time onSnapshot listener on `wallets/{uid}`
  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) {
      setAvailableBalanceCentavos(0);
      setPromoBalanceCentavos(0);
      return;
    }

    const walletRef = doc(db, 'wallets', uid);
    const unsubscribeWallet = onSnapshot(
      walletRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() || {};
          const avail = Number(
            data.availableBalance !== undefined ? data.availableBalance : data.balance || 0
          );
          const promo = Number(data.promoBalance || 0);
          setAvailableBalanceCentavos(avail);
          setPromoBalanceCentavos(promo);
        }
      },
      () => {}
    );

    return () => unsubscribeWallet();
  }, [uid]);

  // 2. Real-time onSnapshot listener on `wallet_transactions` for current user
  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) {
      setTransactions([]);
      setActiveToasts([]);
      return;
    }

    seenKeysRef.current = loadSeenStateKeys(uid);
    isInitialSnapshotRef.current = true;
    previousStatusByTxIdRef.current.clear();

    const txQuery = query(
      collection(db, 'wallet_transactions'),
      where('userId', '==', uid)
    );

    const unsubscribeTx = onSnapshot(
      txQuery,
      (snapshot) => {
        const nowMs = Date.now();
        const newlyTriggered: FinancialNotificationItem[] = [];
        const allDocs: any[] = [];

        snapshot.forEach((docSnap) => {
          allDocs.push({ id: docSnap.id, ...docSnap.data() });
        });

        allDocs.sort((a, b) => {
          const tA = new Date(a.processedAt || a.updatedAt || a.createdAt || 0).getTime() || 0;
          const tB = new Date(b.processedAt || b.updatedAt || b.createdAt || 0).getTime() || 0;
          return tB - tA;
        });
        setTransactions(allDocs);

        snapshot.docChanges().forEach((change) => {
          const txData = { id: change.doc.id, ...change.doc.data() } as any;
          const built = buildFinancialNotificationFromTx(txData);
          if (!built) return;

          const prevStatus = previousStatusByTxIdRef.current.get(txData.id);
          previousStatusByTxIdRef.current.set(txData.id, built.status);

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

          if (seenKeysRef.current.has(built.statusKey)) {
            return;
          }

          if (change.type === 'modified' && prevStatus === built.status) {
            return;
          }

          saveSeenStateKey(uid, built.statusKey, seenKeysRef.current);
          newlyTriggered.push(built);

          ensureBellNotificationPersisted(uid, currentUser?.email, built).catch(() => {});
        });

        isInitialSnapshotRef.current = false;

        if (newlyTriggered.length > 0) {
          // Prioriza o chime de aprovação/sucesso caso múltiplos eventos cheguem juntos
          const primaryToast =
            newlyTriggered.find((t) => t.variant === 'success' || t.variant === 'promo') ||
            newlyTriggered[0];
          playFinancialChime(primaryToast.variant);

          setActiveToasts((prev) => {
            const filteredPrev = prev.filter(
              (item) => !newlyTriggered.some((n) => n.transactionId === item.transactionId)
            );
            return [...newlyTriggered, ...filteredPrev].slice(0, 4);
          });

          window.dispatchEvent(
            new CustomEvent('voxa_financial_transaction_event', {
              detail: { transactions: newlyTriggered }
            })
          );
        }
      },
      (err) => {
        console.warn('[FinancialToastProvider] Listener error:', err);
      }
    );

    return () => unsubscribeTx();
  }, [uid, currentUser?.email]);

  // Auto-dismiss active toasts after timeout
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

  return (
    <FinancialToastContext.Provider
      value={{
        activeToasts,
        transactions,
        availableBalanceCentavos,
        promoBalanceCentavos,
        navigateToTab,
        pushFinancialToast,
        dismissToast,
        clearAllToasts
      }}
    >
      {children}
      <FinancialToast onNavigateTab={navigateToTab} />
    </FinancialToastContext.Provider>
  );
};
