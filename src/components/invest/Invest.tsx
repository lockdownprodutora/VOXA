import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  ShieldAlert,
  Lock,
  Clock,
  Calendar,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Layers,
  RefreshCw,
  FileText,
  Plus,
  Settings,
  QrCode,
  Copy,
  Check,
  Calculator,
  X
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { formatBRL } from '../../utils/money';
import {
  InvestProduct,
  InvestPosition,
  InvestGlobalSettings,
  INITIAL_INVEST_GLOBAL_SETTINGS,
  INITIAL_INVEST_PRODUCTS,
  fetchInvestCatalog,
  fetchUserInvestPositions,
  calculateLockupProgress,
  applyInvestPositionClientFallback
} from '../../utils/investDb';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';

export interface InvestProps {
  currentUser: any;
  onGoToWalletDeposit: () => void;
  onOpenAdminInvest?: () => void;
  isAdmin?: boolean;
  triggerToast?: (msg: string) => void;
}

interface InvestPixOrder {
  id: string;
  productId: string;
  productName: string;
  amountCentavos: number;
  lockupMonths: number;
  lockupDays: number;
  status: 'PENDING_PAYMENT' | 'APPROVED' | 'CANCELED' | 'ERROR';
  paymentId: string;
  qrCode: string;
  qrCodeBase64?: string;
  expirationDate: string;
  positionId?: string;
}

const STANDARD_VALUE_TIERS_CENTAVOS = [
  10000,    // R$ 100
  50000,    // R$ 500
  100000,   // R$ 1.000
  500000,   // R$ 5.000
  1000000,  // R$ 10.000
  5000000,  // R$ 50.000
  10000000  // R$ 100.000
];

function formatDateBR(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatDateTimeBR(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export const Invest: React.FC<InvestProps> = ({
  currentUser,
  onGoToWalletDeposit,
  onOpenAdminInvest,
  isAdmin,
  triggerToast
}) => {
  const [subTab, setSubTab] = useState<'products' | 'portfolio' | 'transparency'>('products');
  const [settings, setSettings] = useState<InvestGlobalSettings>(INITIAL_INVEST_GLOBAL_SETTINGS);
  const [products, setProducts] = useState<InvestProduct[]>(INITIAL_INVEST_PRODUCTS);
  const [positions, setPositions] = useState<InvestPosition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Real Wallet Balance
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [blockedBalance, setBlockedBalance] = useState<number>(0);

  // Selected product & Application Modal state
  const [selectedProduct, setSelectedProduct] = useState<InvestProduct | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'WALLET'>('PIX');
  const [amountReaisInput, setAmountReaisInput] = useState<string>('100');
  const [riskCheckbox1, setRiskCheckbox1] = useState<boolean>(false);
  const [riskCheckbox2, setRiskCheckbox2] = useState<boolean>(false);
  const [riskCheckbox3, setRiskCheckbox3] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [applyFeedback, setApplyFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // PIX Mercado Pago state inside Application Modal
  const [activePixOrder, setActivePixOrder] = useState<InvestPixOrder | null>(null);
  const [pixCopied, setPixCopied] = useState<boolean>(false);
  const [checkingPixStatus, setCheckingPixStatus] = useState<boolean>(false);

  // Position Details Modal
  const [selectedPositionDetail, setSelectedPositionDetail] = useState<InvestPosition | null>(null);

  // WCAG Keyboard Navigation: Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedPositionDetail) {
          setSelectedPositionDetail(null);
        } else if (selectedProduct) {
          setSelectedProduct(null);
          setActivePixOrder(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProduct, selectedPositionDetail]);

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, current: 'products' | 'portfolio' | 'transparency') => {
    const order: Array<'products' | 'portfolio' | 'transparency'> = ['products', 'portfolio', 'transparency'];
    const idx = order.indexOf(current);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = order[(idx + 1) % order.length];
      setSubTab(next);
      document.getElementById(`invest-tab-${next}`)?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = order[(idx - 1 + order.length) % order.length];
      setSubTab(prev);
      document.getElementById(`invest-tab-${prev}`)?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSubTab(order[0]);
      document.getElementById(`invest-tab-${order[0]}`)?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      setSubTab(order[order.length - 1]);
      document.getElementById(`invest-tab-${order[order.length - 1]}`)?.focus();
    }
  };

  // Interactive ROI Calculator State
  const [roiCalcProductId, setRoiCalcProductId] = useState<string>('voxa_prime');
  const [roiCalcAmountReais, setRoiCalcAmountReais] = useState<string>('1000');
  const [roiCalcDurationMonths, setRoiCalcDurationMonths] = useState<number>(6);

  const userUid = currentUser?.uid || currentUser?.id || '';

  const loadAll = async () => {
    setLoading(true);
    try {
      const catalog = await fetchInvestCatalog();
      setSettings(catalog.settings || INITIAL_INVEST_GLOBAL_SETTINGS);
      const activeProds = (catalog.products || INITIAL_INVEST_PRODUCTS).filter((p) => p.active);
      setProducts(activeProds.length > 0 ? activeProds : INITIAL_INVEST_PRODUCTS.filter((p) => p.active));

      if (userUid) {
        const userPositions = await fetchUserInvestPositions(userUid);
        setPositions(userPositions);
      }
    } catch (err) {
      console.warn('[VOXA INVEST LOAD]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [userUid]);

  // Real-time listeners for wallet, products & user positions
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'invest_settings', 'global'),
        (snap) => {
          if (snap.exists()) {
            setSettings((prev) => ({ ...prev, ...(snap.data() as any) }));
          }
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'invest_products'),
        (snap) => {
          if (!snap.empty) {
            const list: InvestProduct[] = [];
            snap.forEach((d) => {
              const p = { ...(d.data() as InvestProduct), id: d.id };
              if (p.active) list.push(p);
            });
            list.sort((a, b) => (a.order || 99) - (b.order || 99));
            if (list.length > 0) setProducts(list);
          }
        },
        () => {}
      )
    );

    if (userUid) {
      unsubs.push(
        onSnapshot(
          doc(db, 'wallets', userUid),
          (snap) => {
            if (snap.exists()) {
              const w = snap.data() || {};
              setAvailableBalance(
                Number(w.availableBalance !== undefined ? w.availableBalance : w.balance || 0)
              );
              setBlockedBalance(Number(w.blockedBalance || 0));
            }
          },
          () => {}
        )
      );

      const posQuery = query(collection(db, 'invest_positions'), where('userUid', '==', userUid));
      unsubs.push(
        onSnapshot(
          posQuery,
          (snap) => {
            const list: InvestPosition[] = [];
            snap.forEach((d) => {
              list.push({ ...(d.data() as InvestPosition), id: d.id });
            });
            list.sort((a, b) => new Date(b.appliedAt || 0).getTime() - new Date(a.appliedAt || 0).getTime());
            setPositions(list);
          },
          () => {}
        )
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [userUid]);

  // Real-time listener & polling for active PIX Order (Mercado Pago Webhook confirmation)
  useEffect(() => {
    if (!activePixOrder?.id || activePixOrder.status !== 'PENDING_PAYMENT') return;

    let unsubFirestore: (() => void) | null = null;
    if (isFirebaseConfigured()) {
      unsubFirestore = onSnapshot(
        doc(db, 'invest_pix_orders', activePixOrder.id),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as InvestPixOrder;
            if (data.status === 'APPROVED') {
              setActivePixOrder(data);
              setApplyFeedback({
                type: 'success',
                message: `Pagamento PIX confirmado! Sua aplicação em ${data.productName} foi ativada com sucesso.`
              });
              triggerToast?.(`PIX aprovado! Aplicação em ${data.productName} ativada.`);
              loadAll();
              setTimeout(() => {
                setSelectedProduct(null);
                setActivePixOrder(null);
                setSubTab('portfolio');
              }, 1800);
            } else if (data.status === 'CANCELED' || data.status === 'ERROR') {
              setActivePixOrder(data);
              setApplyFeedback({
                type: 'error',
                message: 'A cobrança PIX foi cancelada ou recusada pelo provedor de pagamentos.'
              });
            }
          }
        },
        () => {}
      );
    }

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/invest/pix/status/${activePixOrder.id}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.pixOrder) {
            if (json.pixOrder.status === 'APPROVED') {
              setActivePixOrder(json.pixOrder);
              setApplyFeedback({
                type: 'success',
                message: `Pagamento PIX confirmado! Sua aplicação em ${json.pixOrder.productName} foi ativada com sucesso.`
              });
              triggerToast?.(`PIX aprovado! Aplicação em ${json.pixOrder.productName} ativada.`);
              loadAll();
              setTimeout(() => {
                setSelectedProduct(null);
                setActivePixOrder(null);
                setSubTab('portfolio');
              }, 1800);
            }
          }
        }
      } catch {}
    }, 6000);

    return () => {
      if (unsubFirestore) unsubFirestore();
      clearInterval(pollInterval);
    };
  }, [activePixOrder?.id, activePixOrder?.status]);

  // Portfolio Summary Metrics (strictly from real recorded positions)
  const portfolioSummary = useMemo(() => {
    let activePrincipalCentavos = 0;
    let currentValuationCentavos = 0;
    let realizedReturnCentavos = 0;
    let activeCount = 0;

    positions.forEach((pos) => {
      if (pos.status === 'ACTIVE_LOCKED' || pos.status === 'MATURED_PENDING_SETTLEMENT') {
        activeCount++;
        activePrincipalCentavos += Number(pos.principalAmountCentavos || 0);
        currentValuationCentavos += Number(
          pos.currentValuationCentavos !== undefined
            ? pos.currentValuationCentavos
            : pos.principalAmountCentavos || 0
        );
      }
      realizedReturnCentavos += Number(pos.realizedReturnCentavos || 0);
    });

    return {
      activeCount,
      activePrincipalCentavos,
      currentValuationCentavos,
      realizedReturnCentavos
    };
  }, [positions]);

  const handleOpenProductModal = (product: InvestProduct) => {
    setSelectedProduct(product);
    setPaymentMethod('PIX');
    setAmountReaisInput(String(Math.round(product.minAmountCentavos / 100)));
    setRiskCheckbox1(false);
    setRiskCheckbox2(false);
    setRiskCheckbox3(false);
    setApplyFeedback(null);
    setActivePixOrder(null);
    setPixCopied(false);
  };

  const parsedAmountCentavos = useMemo(() => {
    const clean = String(amountReaisInput).replace(/[^\d.,]/g, '').replace(',', '.');
    const val = parseFloat(clean);
    if (isNaN(val) || val <= 0) return 0;
    return Math.round(val * 100);
  }, [amountReaisInput]);

  // Projected non-guaranteed scenarios for transparency in the application modal
  const nonGuaranteedScenarios = useMemo(() => {
    if (!selectedProduct || parsedAmountCentavos <= 0) {
      return { minTargetDeltaCentavos: 0, maxTargetDeltaCentavos: 0, maturityDateStr: '—' };
    }
    const minDelta = Math.round(parsedAmountCentavos * (selectedProduct.targetReturnMinPercent / 100));
    const maxDelta = Math.round(parsedAmountCentavos * (selectedProduct.targetReturnMaxPercent / 100));
    const mat = new Date();
    mat.setMonth(mat.getMonth() + (selectedProduct.lockupMonths || 6));

    return {
      minTargetDeltaCentavos: minDelta,
      maxTargetDeltaCentavos: maxDelta,
      maturityDateStr: mat.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    };
  }, [selectedProduct, parsedAmountCentavos]);

  // Interactive ROI Calculator Computed Scenarios (based on amount & duration)
  const roiCalcProduct = useMemo(() => {
    return products.find((p) => p.id === roiCalcProductId) || products[0] || INITIAL_INVEST_PRODUCTS[0];
  }, [products, roiCalcProductId]);

  const roiSimulation = useMemo(() => {
    const clean = String(roiCalcAmountReais).replace(/[^\d.,]/g, '').replace(',', '.');
    const valReais = parseFloat(clean);
    const principalCentavos = !isNaN(valReais) && valReais > 0 ? Math.round(valReais * 100) : 0;

    const baseMonths = Math.max(1, Number(roiCalcProduct?.lockupMonths || 6));
    const safeDurationMonths = Math.max(1, Number(roiCalcDurationMonths) || baseMonths);
    const durationFactor = safeDurationMonths / baseMonths;

    const minRoiPercent = Number(((roiCalcProduct?.targetReturnMinPercent || 0) * durationFactor).toFixed(2));
    const maxRoiPercent = Number(((roiCalcProduct?.targetReturnMaxPercent || 0) * durationFactor).toFixed(2));
    const avgPredefinedRatePercent = Number((((minRoiPercent + maxRoiPercent) / 2)).toFixed(2));
    const histMinPercent = Number(((roiCalcProduct?.historicalReturnMinPercent || 0) * durationFactor).toFixed(2));
    const histMaxPercent = Number(((roiCalcProduct?.historicalReturnMaxPercent || 0) * durationFactor).toFixed(2));

    const minReturnCentavos = Math.round(principalCentavos * (minRoiPercent / 100));
    const maxReturnCentavos = Math.round(principalCentavos * (maxRoiPercent / 100));
    const avgReturnCentavos = Math.round(principalCentavos * (avgPredefinedRatePercent / 100));

    const minTotalCentavos = principalCentavos + minReturnCentavos;
    const maxTotalCentavos = principalCentavos + maxReturnCentavos;
    const avgTotalCentavos = principalCentavos + avgReturnCentavos;

    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + safeDurationMonths);

    const totalMonths = safeDurationMonths;
    const principalReais = Number((principalCentavos / 100).toFixed(2));
    const chartData = Array.from({ length: totalMonths + 1 }, (_, monthIdx) => {
      const progress = monthIdx / totalMonths;
      const minPctAtMonth = Number((minRoiPercent * progress).toFixed(2));
      const maxPctAtMonth = Number((maxRoiPercent * progress).toFixed(2));
      const avgPctAtMonth = Number((avgPredefinedRatePercent * progress).toFixed(2));
      const minCapitalReais = Number(((principalCentavos * (1 + minPctAtMonth / 100)) / 100).toFixed(2));
      const maxCapitalReais = Number(((principalCentavos * (1 + maxPctAtMonth / 100)) / 100).toFixed(2));
      const avgCapitalReais = Number(((principalCentavos * (1 + avgPctAtMonth / 100)) / 100).toFixed(2));

      return {
        monthLabel: monthIdx === 0 ? 'Início' : `Mês ${monthIdx}`,
        monthIndex: monthIdx,
        principalReais,
        minCapitalReais,
        maxCapitalReais,
        avgCapitalReais,
        minPctAtMonth,
        maxPctAtMonth,
        avgPctAtMonth
      };
    });

    return {
      principalCentavos,
      baseMonths,
      safeDurationMonths,
      minRoiPercent,
      maxRoiPercent,
      avgPredefinedRatePercent,
      histMinPercent,
      histMaxPercent,
      minReturnCentavos,
      maxReturnCentavos,
      avgReturnCentavos,
      minTotalCentavos,
      maxTotalCentavos,
      avgTotalCentavos,
      chartData,
      maturityDateStr: maturityDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    };
  }, [roiCalcAmountReais, roiCalcDurationMonths, roiCalcProduct]);

  const handleCopyPixCode = async () => {
    if (!activePixOrder?.qrCode) return;
    try {
      await navigator.clipboard.writeText(activePixOrder.qrCode);
      setPixCopied(true);
      triggerToast?.('Código PIX Copia e Cola copiado!');
      setTimeout(() => setPixCopied(false), 3000);
    } catch {}
  };

  const handleManualCheckPix = async () => {
    if (!activePixOrder?.id) return;
    setCheckingPixStatus(true);
    try {
      const res = await fetch(`/api/invest/pix/status/${activePixOrder.id}`);
      const data = await res.json();
      if (data.success && data.pixOrder) {
        setActivePixOrder(data.pixOrder);
        if (data.pixOrder.status === 'APPROVED') {
          setApplyFeedback({
            type: 'success',
            message: `Pagamento PIX confirmado! Sua aplicação em ${data.pixOrder.productName} foi ativada.`
          });
          loadAll();
        } else {
          setApplyFeedback({
            type: 'error',
            message: 'Pagamento ainda consta como PENDENTE no Mercado Pago. Assim que o PIX for compensado, sua aplicação será ativada automaticamente.'
          });
        }
      }
    } catch {
      setApplyFeedback({
        type: 'error',
        message: 'Não foi possível consultar o status do PIX agora.'
      });
    } finally {
      setCheckingPixStatus(false);
    }
  };

  const handleConfirmApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setApplyFeedback(null);

    if (!userUid) {
      setApplyFeedback({
        type: 'error',
        message: 'Você precisa estar conectado na sua conta VOXA para realizar uma aplicação.'
      });
      return;
    }

    if (!riskCheckbox1 || !riskCheckbox2 || !riskCheckbox3) {
      setApplyFeedback({
        type: 'error',
        message: 'Confirme todas as declarações obrigatórias de ciência de risco, volatilidade e prazo de lock-up antes de prosseguir.'
      });
      return;
    }

    if (parsedAmountCentavos < selectedProduct.minAmountCentavos) {
      setApplyFeedback({
        type: 'error',
        message: `O aporte mínimo para ${selectedProduct.name} é de ${formatBRL(selectedProduct.minAmountCentavos / 100)}.`
      });
      return;
    }

    if (parsedAmountCentavos > selectedProduct.maxAmountCentavos) {
      setApplyFeedback({
        type: 'error',
        message: `O aporte máximo permitido para ${selectedProduct.name} é de ${formatBRL(selectedProduct.maxAmountCentavos / 100)}.`
      });
      return;
    }

    // FLOW A: PIX MERCADO PAGO (Application is ONLY created after webhook/backend confirms APPROVED)
    if (paymentMethod === 'PIX') {
      setIsApplying(true);
      try {
        const res = await fetch('/api/invest/pix/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-uid': userUid
          },
          body: JSON.stringify({
            userUid,
            userName: currentUser?.name || 'Investidor VOXA',
            userEmail: currentUser?.email || 'financeiro@voxaofficial.com',
            productId: selectedProduct.id,
            amountCentavos: parsedAmountCentavos,
            riskAccepted: true
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success || !data.pixOrder) {
          throw new Error(data.error || 'Não foi possível gerar a cobrança PIX no Mercado Pago.');
        }
        setActivePixOrder(data.pixOrder);
      } catch (err: any) {
        setApplyFeedback({
          type: 'error',
          message: err?.message || 'Erro ao gerar cobrança PIX no Mercado Pago.'
        });
      } finally {
        setIsApplying(false);
      }
      return;
    }

    // FLOW B: REAL WALLET BALANCE
    if (availableBalance < parsedAmountCentavos) {
      setApplyFeedback({
        type: 'error',
        message: `Saldo livre insuficiente na Carteira VOXA (${formatBRL(availableBalance / 100)} disponível). Utilize a opção PIX (Mercado Pago) acima ou deposite na carteira.`
      });
      return;
    }

    setIsApplying(true);
    try {
      let appliedSuccess = false;
      try {
        const res = await fetch('/api/invest/apply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-uid': userUid
          },
          body: JSON.stringify({
            userUid,
            userName: currentUser?.name || '',
            userEmail: currentUser?.email || '',
            productId: selectedProduct.id,
            amountCentavos: parsedAmountCentavos,
            riskAccepted: true
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          appliedSuccess = true;
        } else if (data.error) {
          throw new Error(data.error);
        }
      } catch (apiErr: any) {
        if (apiErr.message && !apiErr.message.includes('Failed to fetch')) {
          throw apiErr;
        }
        await applyInvestPositionClientFallback({
          userUid,
          userName: currentUser?.name || '',
          userEmail: currentUser?.email || '',
          productId: selectedProduct.id,
          amountCentavos: parsedAmountCentavos,
          riskAccepted: true
        });
        appliedSuccess = true;
      }

      if (appliedSuccess) {
        setApplyFeedback({
          type: 'success',
          message: `Aplicação de ${formatBRL(parsedAmountCentavos / 100)} no produto ${selectedProduct.name} registrada com sucesso! Acompanhe na aba Minhas Posições.`
        });
        triggerToast?.(`Aplicação confirmada no ${selectedProduct.name}!`);
        setTimeout(() => {
          setSelectedProduct(null);
          setSubTab('portfolio');
        }, 1400);
      }
    } catch (err: any) {
      setApplyFeedback({
        type: 'error',
        message: err?.message || 'Não foi possível concluir a aplicação.'
      });
    } finally {
      setIsApplying(false);
    }
  };

  const getRiskBadgeStyle = (risk: string) => {
    if (risk === 'MODERADO') {
      return 'bg-sky-500/10 text-sky-300 border-sky-500/30';
    }
    if (risk === 'ARROJADO') {
      return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
    }
    return 'bg-[#FF0033]/15 text-red-300 border-[#FF0033]/40';
  };

  return (
    <div className="dark space-y-8 animate-fadeIn text-left pb-12 text-[var(--invest-text-primary-dark)]">
      {/* =====================================================================
          1. HERO & REGULATORY COMPLIANCE HEADER
         ===================================================================== */}
      <div className="relative rounded-[32px] overflow-hidden border border-white/10 bg-gradient-to-br from-[#12111d] via-[#0d0c15] to-black p-6 sm:p-10 shadow-2xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#FF0033]/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="space-y-4 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-[#FF0033] animate-pulse" />
              <span className="font-orbitron font-black text-[10px] tracking-widest uppercase text-white">
                VOXA INVEST • ESTRATÉGIAS REAIS EM CRIPTOATIVOS
              </span>
            </div>

            <h1 className="font-orbitron font-black text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight uppercase leading-none">
              VOXA <span className="text-[#FF0033]">INVEST</span>
            </h1>

            <p className="text-gray-300 text-xs sm:text-sm font-sans leading-relaxed max-w-2xl">
              Participe de produtos estruturados cuja estratégia subjacente atua na compra, venda, arbitragem e gestão ativa de criptoativos. Apuração 100% transparente baseada exclusivamente em resultados financeiros reais registrados pela gestão.
            </p>

            {/* Non-Guaranteed Mandatory Notice Pill Bar */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-100/90 font-sans leading-relaxed">
                <strong className="font-orbitron text-[10px] uppercase tracking-wider text-amber-300 block mb-0.5">
                  RENTABILIDADE NÃO GARANTIDA • RENDA VARIÁVEL CRIPTO
                </strong>
                Metas indicativas, faixas históricas e cenários projetados são estritamente referenciais e{' '}
                <span className="underline font-bold text-white">NÃO constituem promessa ou garantia de retorno</span>. Nenhum valor é creditado apenas pela passagem do tempo.
              </div>
            </div>
          </div>

          {/* Right Wallet & Portfolio Summary Card */}
          <div className="bg-white text-neutral-900 rounded-3xl p-6 min-w-[290px] sm:min-w-[330px] shadow-2xl border border-white/20 space-y-4 shrink-0">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <span className="text-[9px] font-orbitron font-black uppercase tracking-widest text-neutral-500 block">
                  SALDO LIVRE NA CARTEIRA
                </span>
                <span className="font-mono font-black text-2xl text-neutral-900">
                  {formatBRL(availableBalance / 100)}
                </span>
              </div>
              <button
                type="button"
                onClick={onGoToWalletDeposit}
                aria-label="Depositar saldo livre na Carteira VOXA"
                className="bg-[var(--invest-bg-dark)] hover:bg-neutral-800 text-[var(--invest-text-primary-dark)] font-orbitron font-black text-[10px] px-3.5 py-2.5 rounded-xl transition-all cursor-pointer uppercase tracking-wider flex items-center gap-1.5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <Plus className="w-3.5 h-3.5 text-[var(--invest-accent)]" aria-hidden="true" />
                <span>Depositar</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="bg-neutral-100 rounded-2xl p-3 border border-neutral-200">
                <span className="text-[8px] font-orbitron font-bold uppercase tracking-wider text-neutral-500 block">
                  CAPITAL EM LOCK-UP
                </span>
                <span className="font-mono font-black text-sm text-neutral-900 mt-0.5 block">
                  {formatBRL(portfolioSummary.activePrincipalCentavos / 100)}
                </span>
              </div>
              <div className="bg-neutral-100 rounded-2xl p-3 border border-neutral-200">
                <span className="text-[8px] font-orbitron font-bold uppercase tracking-wider text-neutral-500 block">
                  RESULTADO REAL APURADO
                </span>
                <span
                  className={`font-mono font-black text-sm mt-0.5 block ${
                    portfolioSummary.realizedReturnCentavos > 0
                      ? 'text-emerald-600'
                      : portfolioSummary.realizedReturnCentavos < 0
                      ? 'text-red-600'
                      : 'text-neutral-700'
                  }`}
                >
                  {portfolioSummary.realizedReturnCentavos > 0 ? '+' : ''}
                  {formatBRL(portfolioSummary.realizedReturnCentavos / 100)}
                </span>
              </div>
            </div>

            {isAdmin && onOpenAdminInvest && (
              <button
                type="button"
                onClick={onOpenAdminInvest}
                aria-label="Abrir painel administrativo para gerenciar produtos e apurações do VOXA Invest"
                className="w-full bg-neutral-900 hover:bg-black text-[var(--invest-text-primary-dark)] font-orbitron font-bold text-[10px] py-2.5 px-4 rounded-xl transition-all cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <Settings className="w-3.5 h-3.5 text-[var(--invest-accent)]" aria-hidden="true" />
                <span>Gerenciar Produtos & Apurações (Admin)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. NAVIGATION TABS (WCAG ARIA TABLIST & KEYBOARD NAVIGATION)
         ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div
          role="tablist"
          aria-label="Seções do VOXA Invest"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            id="invest-tab-products"
            type="button"
            role="tab"
            aria-selected={subTab === 'products'}
            aria-controls="invest-tabpanel-products"
            tabIndex={subTab === 'products' ? 0 : -1}
            aria-label={`Aba Produtos de Investimento (${products.length} disponíveis)`}
            onClick={() => setSubTab('products')}
            onKeyDown={(e) => handleTabKeyDown(e, 'products')}
            className={`px-5 py-3 rounded-2xl font-orbitron font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--invest-bg-dark)] ${
              subTab === 'products'
                ? 'bg-[var(--invest-text-primary-dark)] text-[var(--invest-bg-dark)] shadow-lg'
                : 'bg-[var(--invest-surface-dark)] text-[var(--invest-text-secondary-dark)] hover:text-[var(--invest-text-primary-dark)] border border-white/10'
            }`}
          >
            <Layers className="w-4 h-4 text-[var(--invest-accent)]" aria-hidden="true" />
            <span>Produtos de Investimento ({products.length})</span>
          </button>

          <button
            id="invest-tab-portfolio"
            type="button"
            role="tab"
            aria-selected={subTab === 'portfolio'}
            aria-controls="invest-tabpanel-portfolio"
            tabIndex={subTab === 'portfolio' ? 0 : -1}
            aria-label={`Aba Minhas Aplicações e Lock-up (${positions.length} posições)`}
            onClick={() => setSubTab('portfolio')}
            onKeyDown={(e) => handleTabKeyDown(e, 'portfolio')}
            className={`px-5 py-3 rounded-2xl font-orbitron font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--invest-bg-dark)] ${
              subTab === 'portfolio'
                ? 'bg-[var(--invest-text-primary-dark)] text-[var(--invest-bg-dark)] shadow-lg'
                : 'bg-[var(--invest-surface-dark)] text-[var(--invest-text-secondary-dark)] hover:text-[var(--invest-text-primary-dark)] border border-white/10'
            }`}
          >
            <Lock className="w-4 h-4 text-[var(--invest-accent)]" aria-hidden="true" />
            <span>Minhas Aplicações & Lock-up ({positions.length})</span>
          </button>

          <button
            id="invest-tab-transparency"
            type="button"
            role="tab"
            aria-selected={subTab === 'transparency'}
            aria-controls="invest-tabpanel-transparency"
            tabIndex={subTab === 'transparency' ? 0 : -1}
            aria-label="Aba Regras Operacionais, Lock-up e Avisos de Risco"
            onClick={() => setSubTab('transparency')}
            onKeyDown={(e) => handleTabKeyDown(e, 'transparency')}
            className={`px-5 py-3 rounded-2xl font-orbitron font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--invest-bg-dark)] ${
              subTab === 'transparency'
                ? 'bg-[var(--invest-text-primary-dark)] text-[var(--invest-bg-dark)] shadow-lg'
                : 'bg-[var(--invest-surface-dark)] text-[var(--invest-text-secondary-dark)] hover:text-[var(--invest-text-primary-dark)] border border-white/10'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-[var(--invest-accent)]" aria-hidden="true" />
            <span>Regras, Lock-up & Riscos</span>
          </button>
        </div>

        <button
          type="button"
          onClick={loadAll}
          aria-label="Atualizar produtos, saldo e aplicações do VOXA Invest"
          className="self-start sm:self-auto px-3.5 py-2.5 rounded-xl bg-[var(--invest-surface-dark)] hover:bg-white/10 border border-white/15 text-[var(--invest-text-secondary-dark)] hover:text-[var(--invest-text-primary-dark)] text-[10px] font-orbitron font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--invest-bg-dark)]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[var(--invest-accent)]' : ''}`} aria-hidden="true" />
          <span>Atualizar</span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: PRODUTOS CONFIGURÁVEIS PELO ADMIN
         ===================================================================== */}
      {subTab === 'products' && (
        <div
          id="invest-tabpanel-products"
          role="tabpanel"
          aria-labelledby="invest-tab-products"
          className="space-y-8"
        >
          {/* Faixas de Valores de Referência */}
          <div className="bg-[var(--invest-surface-dark)] border border-white/10 rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-orbitron font-black uppercase tracking-widest text-[var(--invest-accent)] block">
                FAIXAS DE ALOCAÇÃO DISPONÍVEIS
              </span>
              <h3 className="font-orbitron font-bold text-sm sm:text-base text-[var(--invest-text-primary-dark)] uppercase">
                Escolha um produto compatível com seu aporte via PIX ou Carteira
              </h3>
              <p className="text-xs text-[var(--invest-text-secondary-dark)] font-sans">
                Prazo padrão de carência (lock-up): <strong className="text-[var(--invest-text-primary-dark)]">6 meses (180 dias)</strong> sujeito às regras de cada estratégia.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {STANDARD_VALUE_TIERS_CENTAVOS.map((tier) => (
                <span
                  key={tier}
                  className="px-3 py-1.5 rounded-xl bg-[var(--invest-bg-dark)] border border-white/10 font-mono font-bold text-xs text-[var(--invest-text-primary-dark)]"
                >
                  {formatBRL(tier / 100)}
                </span>
              ))}
            </div>
          </div>

          {/* ===============================================================
              SIMULADOR INTERATIVO DE ROI (CENÁRIOS PROJETADOS NÃO GARANTIDOS)
             =============================================================== */}
          <section
            aria-labelledby="roi-calculator-heading"
            className="bg-[var(--invest-surface-dark)] border border-white/15 rounded-[28px] p-6 sm:p-8 space-y-6 shadow-2xl"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[var(--invest-accent)]" aria-hidden="true" />
                  <span className="text-[10px] font-orbitron font-black uppercase tracking-widest text-[var(--invest-accent)]">
                    CALCULADORA EM TEMPO REAL DE RETORNO (ROI)
                  </span>
                  <span className="text-[8px] font-orbitron font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-[var(--invest-warning)] border border-amber-500/30">
                    CENÁRIO NÃO GARANTIDO
                  </span>
                </div>
                <h3
                  id="roi-calculator-heading"
                  className="font-orbitron font-black text-lg sm:text-xl text-[var(--invest-text-primary-dark)] uppercase"
                >
                  Simule seu Ganho Potencial por Valor e Duração
                </h3>
                <p className="text-xs text-[var(--invest-text-secondary-dark)] font-sans">
                  Informe o valor do aporte e a duração em meses para calcular em tempo real o ganho potencial com base na taxa indicativa pré-definida do produto.
                </p>
              </div>

              <button
                type="button"
                aria-label={`Aplicar no produto ${roiCalcProduct?.name || ''} com o valor simulado de ${formatBRL(roiSimulation.principalCentavos / 100)}`}
                onClick={() => {
                  if (roiCalcProduct) {
                    handleOpenProductModal(roiCalcProduct);
                    setAmountReaisInput(roiCalcAmountReais);
                  }
                }}
                className="self-start lg:self-auto bg-[var(--invest-accent)] hover:opacity-90 text-[var(--invest-text-primary-dark)] font-orbitron font-black text-xs px-5 py-3.5 rounded-2xl transition-all cursor-pointer uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-text-primary-dark)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--invest-surface-dark)]"
              >
                <span>Aplicar neste Cenário</span>
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Controls: Accessible Inputs for Product, Investment Amount & Duration */}
              <div className="lg:col-span-7 space-y-5 bg-[var(--invest-bg-dark)] border border-white/15 rounded-2xl p-5">
                {/* 1. Product Selector */}
                <div className="space-y-2">
                  <label
                    htmlFor="roi-product-select"
                    className="text-xs font-orbitron font-bold text-[var(--invest-text-primary-dark)] uppercase tracking-wider block"
                  >
                    1. Produto de Investimento (Taxa Pré-definida)
                  </label>
                  <select
                    id="roi-product-select"
                    value={roiCalcProduct?.id || ''}
                    onChange={(e) => {
                      const prod = products.find((p) => p.id === e.target.value);
                      if (prod) {
                        setRoiCalcProductId(prod.id);
                        setRoiCalcDurationMonths(prod.lockupMonths || 6);
                        const currentCentavos = roiSimulation.principalCentavos;
                        if (currentCentavos < prod.minAmountCentavos || currentCentavos > prod.maxAmountCentavos) {
                          setRoiCalcAmountReais(String(Math.round(prod.minAmountCentavos / 100)));
                        }
                      }
                    }}
                    aria-describedby="roi-product-rate-help"
                    className="w-full bg-[var(--invest-bg-dark)] text-[var(--invest-text-primary-dark)] border border-white/20 rounded-xl px-4 py-3 font-orbitron font-bold text-xs uppercase focus:outline-none focus:border-[var(--invest-accent)] focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)]"
                  >
                    {products.map((prod) => (
                      <option key={prod.id} value={prod.id} className="bg-black text-white">
                        {prod.name} — Taxa indicativa: {prod.targetReturnMinPercent}% a {prod.targetReturnMaxPercent}% ({prod.lockupMonths} meses)
                      </option>
                    ))}
                  </select>
                  <p id="roi-product-rate-help" className="text-[11px] text-[var(--invest-text-secondary-dark)] font-sans">
                    Taxa indicativa pré-definida do produto:{' '}
                    <strong className="text-[var(--invest-text-primary-dark)] font-mono">
                      {roiCalcProduct?.targetReturnMinPercent}% a {roiCalcProduct?.targetReturnMaxPercent}%
                    </strong>{' '}
                    (média ref.: <strong className="text-[var(--invest-warning)] font-mono">{roiSimulation.avgPredefinedRatePercent}%</strong> no período).
                  </p>
                </div>

                {/* 2. Investment Amount Input + Quick Tiers */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="roi-investment-amount-input"
                      className="text-xs font-orbitron font-bold text-[var(--invest-text-primary-dark)] uppercase tracking-wider"
                    >
                      2. Valor do Investimento (R$)
                    </label>
                    {roiCalcProduct && (
                      <span
                        id="roi-amount-range-hint"
                        className="text-[11px] font-mono text-[var(--invest-text-secondary-dark)]"
                      >
                        Mín: {formatBRL(roiCalcProduct.minAmountCentavos / 100)} • Máx:{' '}
                        {formatBRL(roiCalcProduct.maxAmountCentavos / 100)}
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center font-mono font-bold text-[var(--invest-text-secondary-dark)] pointer-events-none" aria-hidden="true">
                      R$
                    </span>
                    <input
                      id="roi-investment-amount-input"
                      name="roiInvestmentAmount"
                      type="number"
                      min="100"
                      step="100"
                      aria-describedby="roi-amount-range-hint"
                      value={roiCalcAmountReais}
                      onChange={(e) => setRoiCalcAmountReais(e.target.value)}
                      className="w-full bg-[var(--invest-bg-dark)] border border-white/20 rounded-2xl pl-12 pr-4 py-3.5 font-mono font-black text-lg text-[var(--invest-text-primary-dark)] focus:outline-none focus:border-[var(--invest-accent)] focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)]"
                      placeholder="1000"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Atalhos de valor de aporte na calculadora">
                    {STANDARD_VALUE_TIERS_CENTAVOS.map((tier) => {
                      const reais = Math.round(tier / 100);
                      const isCurrent = roiSimulation.principalCentavos === tier;
                      return (
                        <button
                          key={tier}
                          type="button"
                          aria-pressed={isCurrent}
                          aria-label={`Simular aporte de ${formatBRL(reais)}`}
                          onClick={() => setRoiCalcAmountReais(String(reais))}
                          className={`px-2.5 py-1.5 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--invest-bg-dark)] ${
                            isCurrent
                              ? 'bg-[var(--invest-accent)] text-[var(--invest-text-primary-dark)] border-[var(--invest-accent)]'
                              : 'bg-[var(--invest-surface-dark)] text-[var(--invest-text-secondary-dark)] border-white/10 hover:text-[var(--invest-text-primary-dark)] hover:border-white/30'
                          }`}
                        >
                          {formatBRL(reais)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Product Duration Input & Presets */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="roi-duration-months-input"
                      className="text-xs font-orbitron font-bold text-[var(--invest-text-primary-dark)] uppercase tracking-wider"
                    >
                      3. Duração do Produto (Meses)
                    </label>
                    <span
                      id="roi-duration-lockup-hint"
                      className="text-[11px] font-mono text-[var(--invest-warning)]"
                    >
                      Ciclo base do produto: {roiCalcProduct?.lockupMonths || 6} meses
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-4 relative">
                      <input
                        id="roi-duration-months-input"
                        name="roiDurationMonths"
                        type="number"
                        min={1}
                        max={60}
                        aria-describedby="roi-duration-lockup-hint"
                        value={roiCalcDurationMonths}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setRoiCalcDurationMonths(isNaN(val) ? 1 : Math.min(60, Math.max(1, val)));
                        }}
                        className="w-full bg-[var(--invest-bg-dark)] border border-white/20 rounded-xl px-4 py-2.5 font-mono font-black text-base text-[var(--invest-text-primary-dark)] focus:outline-none focus:border-[var(--invest-accent)] focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)]"
                      />
                    </div>

                    <div className="sm:col-span-8 grid grid-cols-4 gap-2" role="group" aria-label="Atalhos de duração em meses">
                      {[6, 12, 18, 24].map((months) => {
                        const isSelected = roiCalcDurationMonths === months;
                        return (
                          <button
                            key={months}
                            type="button"
                            aria-pressed={isSelected}
                            aria-label={`Simular duração de ${months} meses`}
                            onClick={() => setRoiCalcDurationMonths(months)}
                            className={`py-2.5 px-2 rounded-xl font-orbitron font-black text-xs uppercase transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--invest-bg-dark)] ${
                              isSelected
                                ? 'bg-[var(--invest-text-primary-dark)] text-[var(--invest-bg-dark)] border-white shadow-md'
                                : 'bg-[var(--invest-surface-dark)] text-[var(--invest-text-secondary-dark)] border-white/10 hover:text-[var(--invest-text-primary-dark)] hover:border-white/30'
                            }`}
                          >
                            {months}m
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Output: Real-time Potential Gain & ROI Breakdown */}
              <div
                aria-live="polite"
                className="lg:col-span-5 bg-[var(--invest-bg-dark)] border border-white/15 rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-5"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div>
                      <span className="text-[9px] font-orbitron font-bold text-[var(--invest-text-secondary-dark)] uppercase block">
                        PROJEÇÃO EM TEMPO REAL ({roiSimulation.safeDurationMonths} MESES)
                      </span>
                      <span className="font-orbitron font-black text-base text-[var(--invest-text-primary-dark)] uppercase">
                        {roiCalcProduct?.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-[var(--invest-text-secondary-dark)]">
                      Vencimento: <strong className="text-[var(--invest-text-primary-dark)]">{roiSimulation.maturityDateStr}</strong>
                    </span>
                  </div>

                  {/* Highlighted Potential Gain Box */}
                  <div className="bg-[var(--invest-surface-dark)] border border-white/15 rounded-2xl p-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-orbitron font-bold text-[var(--invest-text-secondary-dark)] uppercase">
                        GANHO POTENCIAL ESTIMADO (TAXA MÉDIA +{roiSimulation.avgPredefinedRatePercent}%)
                      </span>
                      <span className="text-[9px] font-mono font-bold text-[var(--invest-warning)]">
                        NÃO GARANTIDO
                      </span>
                    </div>
                    <div className="font-mono font-black text-2xl text-emerald-400">
                      +{formatBRL(roiSimulation.avgReturnCentavos / 100)}
                    </div>
                    <span className="text-[11px] font-mono text-[var(--invest-text-secondary-dark)] block">
                      Faixa de ganho potencial: +{formatBRL(roiSimulation.minReturnCentavos / 100)} a +{formatBRL(roiSimulation.maxReturnCentavos / 100)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[var(--invest-surface-dark)] border border-white/10 rounded-xl p-3.5">
                      <span className="text-[8px] font-orbitron font-bold text-[var(--invest-text-secondary-dark)] uppercase block">
                        ROI INDICATIVO MÍNIMO
                      </span>
                      <span className="font-mono font-black text-lg text-emerald-400 mt-1 block">
                        +{roiSimulation.minRoiPercent}%
                      </span>
                      <span className="font-mono text-xs text-[var(--invest-text-secondary-dark)] block mt-0.5">
                        +{formatBRL(roiSimulation.minReturnCentavos / 100)}
                      </span>
                    </div>

                    <div className="bg-[var(--invest-surface-dark)] border border-white/10 rounded-xl p-3.5">
                      <span className="text-[8px] font-orbitron font-bold text-[var(--invest-text-secondary-dark)] uppercase block">
                        ROI INDICATIVO MÁXIMO
                      </span>
                      <span className="font-mono font-black text-lg text-emerald-400 mt-1 block">
                        +{roiSimulation.maxRoiPercent}%
                      </span>
                      <span className="font-mono text-xs text-[var(--invest-text-secondary-dark)] block mt-0.5">
                        +{formatBRL(roiSimulation.maxReturnCentavos / 100)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-[#FF1744]/15 to-[#FFC107]/10 border border-[#FF1744]/30 rounded-2xl p-4 space-y-1.5">
                    <span className="text-[9px] font-orbitron font-black text-[var(--invest-warning)] uppercase tracking-wider block">
                      CAPITAL ESTIMADO NO VENCIMENTO (PRINCIPAL + GANHO POTENCIAL)
                    </span>
                    <div className="font-mono font-black text-xl sm:text-2xl text-[var(--invest-text-primary-dark)]">
                      {formatBRL(roiSimulation.minTotalCentavos / 100)}{' '}
                      <span className="text-xs font-normal text-[var(--invest-text-secondary-dark)]">a</span>{' '}
                      {formatBRL(roiSimulation.maxTotalCentavos / 100)}
                    </div>
                    <span className="text-[11px] font-mono text-[var(--invest-text-secondary-dark)] block">
                      Valor médio projetado: <strong className="text-[var(--invest-text-primary-dark)]">{formatBRL(roiSimulation.avgTotalCentavos / 100)}</strong>
                    </span>
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-[var(--invest-warning)] shrink-0 mt-0.5" />
                  <p className="text-[10px] text-[var(--invest-text-secondary-dark)] font-sans leading-relaxed">
                    <strong className="text-[var(--invest-warning)]">Aviso Legal:</strong> Esta calculadora apresenta apenas <strong>cenários referenciais NÃO GARANTIDOS</strong>. O retorno real depende exclusivamente da performance financeira apurada nas operações de criptoativos.
                  </p>
                </div>
              </div>
            </div>

            {/* Dynamic Recharts ROI Progression Chart */}
            <div className="bg-black/60 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[9px] font-orbitron font-black uppercase tracking-widest text-[#FF0033] block">
                    CURVA DE PROGRESSÃO ESTIMADA ({roiCalcDurationMonths} MESES) • NÃO GARANTIDA
                  </span>
                  <h4 className="font-orbitron font-bold text-sm sm:text-base text-white uppercase">
                    Evolução Projetada do Capital ({roiCalcProduct?.name})
                  </h4>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono">
                  <div className="flex items-center gap-1.5 text-gray-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-400 inline-block" />
                    <span>Principal Aplicado</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                    <span>Cenário Mín. (+{roiSimulation.minRoiPercent}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#FF0033]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF0033] inline-block" />
                    <span>Cenário Máx. (+{roiSimulation.maxRoiPercent}%)</span>
                  </div>
                </div>
              </div>

              <div className="w-full h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={roiSimulation.chartData}
                    margin={{ top: 10, right: 16, left: 8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="voxaMaxRoiGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF0033" stopOpacity={0.38} />
                        <stop offset="95%" stopColor="#FF0033" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="voxaMinRoiGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.32} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                    <XAxis
                      dataKey="monthLabel"
                      stroke="#9ca3af"
                      tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => `R$ ${Number(val).toLocaleString('pt-BR')}`}
                      width={88}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const point = payload[0]?.payload;
                        return (
                          <div className="bg-[#12111d] border border-white/20 rounded-2xl p-3.5 shadow-2xl space-y-2 text-xs font-mono">
                            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-1.5">
                              <span className="font-orbitron font-black text-white uppercase">{label}</span>
                              <span className="text-[9px] text-amber-300 uppercase">Projeção Ref.</span>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-4 text-gray-300">
                                <span>Principal:</span>
                                <span className="font-bold text-white">{formatBRL(point?.principalReais || 0)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-emerald-400">
                                <span>Cenário Mín. (+{point?.minPctAtMonth}%):</span>
                                <span className="font-bold">{formatBRL(point?.minCapitalReais || 0)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4 text-[#FF0033]">
                                <span>Cenário Máx. (+{point?.maxPctAtMonth}%):</span>
                                <span className="font-bold">{formatBRL(point?.maxCapitalReais || 0)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="maxCapitalReais"
                      name="Cenário Máximo"
                      stroke="#FF0033"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#voxaMaxRoiGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="minCapitalReais"
                      name="Cenário Mínimo"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#voxaMinRoiGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="principalReais"
                      name="Principal"
                      stroke="#9ca3af"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fill="none"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Grid de Produtos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className={`rounded-[28px] border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-2xl ${
                  product.featured
                    ? 'bg-gradient-to-b from-[#1a1826] to-[#111019] border-white/25 ring-1 ring-[#FF0033]/30'
                    : 'bg-[#14131d] border-white/10 hover:border-white/25'
                }`}
              >
                <div className="p-6 sm:p-7 space-y-5">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[9px] font-orbitron font-black uppercase tracking-widest px-3 py-1 rounded-full border ${getRiskBadgeStyle(
                        product.riskLevel
                      )}`}
                    >
                      RISCO {product.riskLevel}
                    </span>

                    <span className="text-[10px] font-mono font-bold text-gray-300 bg-white/5 border border-white/10 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-[#FF0033]" />
                      Lock-up: {product.lockupMonths} meses
                    </span>
                  </div>

                  {/* Product Title & Subtitle */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-orbitron font-black text-2xl text-white uppercase tracking-tight">
                        {product.name}
                      </h3>
                      {product.featured && (
                        <span className="bg-[#FF0033] text-white font-orbitron font-black text-[8px] px-2 py-0.5 rounded-md uppercase tracking-widest">
                          DESTAQUE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-300 font-sans leading-relaxed">
                      {product.subtitle}
                    </p>
                  </div>

                  {/* Underlying Crypto Assets */}
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-orbitron font-bold uppercase tracking-widest text-gray-400 block">
                      ATIVOS SUBJACENTES DA ESTRATÉGIA
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(product.underlyingAssets || ['BTC', 'ETH']).map((asset) => (
                        <span
                          key={asset}
                          className="px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 font-mono font-bold text-[10px] text-white"
                        >
                          {asset}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Indicative Return Box — Explicitly Marked NON-GUARANTEED */}
                  <div className="bg-black/60 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-orbitron font-black uppercase tracking-wider text-gray-400">
                        META INDICATIVA ({product.lockupMonths} MESES)
                      </span>
                      <span className="text-[8px] font-orbitron font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        NÃO GARANTIDO
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="font-mono font-black text-xl sm:text-2xl text-white">
                        {product.targetReturnMinPercent}% a {product.targetReturnMaxPercent}%
                      </span>
                      <span className="text-[10px] font-mono text-gray-400">cenário ref.</span>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                      <span>Faixa histórica ref.:</span>
                      <span className="text-gray-200 font-bold">
                        {product.historicalReturnMinPercent}% a {product.historicalReturnMaxPercent}% (Não garantido)
                      </span>
                    </div>
                  </div>

                  {/* Min / Max Allocation & Fees */}
                  <div className="grid grid-cols-2 gap-2.5 text-left">
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <span className="text-[8px] font-orbitron font-bold text-gray-400 uppercase block">
                        APORTE MÍNIMO
                      </span>
                      <span className="font-mono font-black text-sm text-white mt-0.5 block">
                        {formatBRL(product.minAmountCentavos / 100)}
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                      <span className="text-[8px] font-orbitron font-bold text-gray-400 uppercase block">
                        APORTE MÁXIMO
                      </span>
                      <span className="font-mono font-black text-sm text-white mt-0.5 block">
                        {formatBRL(product.maxAmountCentavos / 100)}
                      </span>
                    </div>
                  </div>

                  {/* Strategy Details */}
                  <div className="text-[11px] text-gray-400 font-sans leading-relaxed bg-white/[0.02] p-3.5 rounded-xl border border-white/5">
                    <strong className="text-white font-orbitron text-[9px] uppercase block mb-1">
                      Estratégia Subjacente:
                    </strong>
                    {product.strategyDescription}
                  </div>
                </div>

                {/* Card Footer CTA */}
                <div className="p-6 pt-0 space-y-3">
                  <button
                    type="button"
                    aria-label={`Aplicar no produto ${product.name} com PIX ou Saldo da Carteira VOXA (aporte de ${formatBRL(product.minAmountCentavos / 100)} a ${formatBRL(product.maxAmountCentavos / 100)})`}
                    onClick={() => handleOpenProductModal(product)}
                    disabled={!settings.enabled || !settings.acceptingNewApplications}
                    className="w-full bg-[var(--invest-text-primary-dark)] hover:bg-neutral-200 disabled:opacity-40 text-[var(--invest-bg-dark)] font-orbitron font-black text-xs py-4 px-5 rounded-2xl transition-all cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--invest-surface-dark)]"
                  >
                    <span>Aplicar com PIX / Carteira</span>
                    <ArrowUpRight className="w-4 h-4 text-[var(--invest-accent)]" aria-hidden="true" />
                  </button>
                  <p className="text-[9px] text-[var(--invest-text-secondary-dark)] text-center font-sans">
                    Sujeito à variação real dos criptoativos. Sem promessa de retorno fixo.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: MINHAS APLICAÇÕES & LOCK-UP (DATAS E APURAÇÃO REAL)
         ===================================================================== */}
      {subTab === 'portfolio' && (
        <div
          id="invest-tabpanel-portfolio"
          role="tabpanel"
          aria-labelledby="invest-tab-portfolio"
          className="space-y-6"
        >
          {positions.length === 0 ? (
            <div className="bg-[var(--invest-surface-dark)] border border-white/10 rounded-3xl p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-[var(--invest-accent)]">
                <Lock className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="font-orbitron font-black text-lg text-[var(--invest-text-primary-dark)] uppercase">
                Nenhuma aplicação ativa no momento
              </h3>
              <p className="text-xs text-[var(--invest-text-secondary-dark)] max-w-md mx-auto font-sans leading-relaxed">
                Escolha um dos produtos do VOXA Invest para alocar capital via PIX (Mercado Pago) ou Saldo Livre em estratégias reais de gestão de criptoativos.
              </p>
              <button
                type="button"
                aria-label="Ver produtos de investimento disponíveis na aba Produtos"
                onClick={() => setSubTab('products')}
                className="bg-[var(--invest-accent)] hover:opacity-90 text-[var(--invest-text-primary-dark)] font-orbitron font-black text-xs px-6 py-3.5 rounded-xl transition-all cursor-pointer uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-text-primary-dark)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--invest-surface-dark)]"
              >
                Ver Produtos Disponíveis
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {positions.map((pos) => {
                const lockup = calculateLockupProgress(pos.appliedAt, pos.maturityDate);
                const hasRealPerformanceEntries =
                  Array.isArray(pos.performanceHistory) && pos.performanceHistory.length > 0;

                return (
                  <div
                    key={pos.id}
                    className="bg-[var(--invest-surface-dark)] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-orbitron font-black text-xl text-[var(--invest-text-primary-dark)] uppercase">
                            {pos.productName}
                          </span>
                          <span
                            className={`text-[9px] font-orbitron font-black uppercase px-3 py-1 rounded-full border ${
                              pos.status === 'ACTIVE_LOCKED'
                                ? 'bg-amber-500/15 text-[var(--invest-warning)] border-amber-500/30'
                                : pos.status === 'MATURED_PENDING_SETTLEMENT'
                                ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                : pos.status === 'SETTLED'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-white/10 text-[var(--invest-text-secondary-dark)] border-white/20'
                            }`}
                          >
                            {pos.status === 'ACTIVE_LOCKED'
                              ? 'EM LOCK-UP ATIVO'
                              : pos.status === 'MATURED_PENDING_SETTLEMENT'
                              ? 'VENCIMENTO ATINGIDO • AGUARDANDO LIQUIDAÇÃO'
                              : pos.status === 'SETTLED'
                              ? 'LIQUIDADO NA CARTEIRA'
                              : pos.status}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--invest-text-secondary-dark)] block">
                          Contrato ID: {pos.id}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          aria-label={`Ver extrato de apurações reais da posição ${pos.productName} (Contrato ${pos.id})`}
                          onClick={() => setSelectedPositionDetail(pos)}
                          className="bg-[var(--invest-bg-dark)] hover:bg-white/10 border border-white/15 text-[var(--invest-text-primary-dark)] font-orbitron font-bold text-[10px] px-4 py-2.5 rounded-xl transition-all cursor-pointer uppercase tracking-wider flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--invest-surface-dark)]"
                        >
                          <FileText className="w-3.5 h-3.5 text-[var(--invest-accent)]" aria-hidden="true" />
                          <span>Extrato de Apurações ({pos.performanceHistory?.length || 0})</span>
                        </button>
                      </div>
                    </div>

                    {/* Financial & Date Columns */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                      <div className="bg-[var(--invest-bg-dark)] border border-white/10 rounded-2xl p-4">
                        <span className="text-[9px] font-orbitron font-bold text-[var(--invest-text-secondary-dark)] uppercase block">
                          VALOR APLICADO
                        </span>
                        <span className="font-mono font-black text-lg text-[var(--invest-text-primary-dark)] mt-1 block">
                          {formatBRL((pos.principalAmountCentavos || 0) / 100)}
                        </span>
                        <span className="text-[9px] text-[var(--invest-text-secondary-dark)] font-sans">Principal alocado</span>
                      </div>

                      <div className="bg-[var(--invest-bg-dark)] border border-white/10 rounded-2xl p-4">
                        <span className="text-[9px] font-orbitron font-bold text-[var(--invest-text-secondary-dark)] uppercase block">
                          VALOR ATUAL
                        </span>
                        <span className="font-mono font-black text-lg text-[var(--invest-text-primary-dark)] mt-1 block">
                          {formatBRL(
                            ((pos.currentValuationCentavos !== undefined
                              ? pos.currentValuationCentavos
                              : pos.principalAmountCentavos) || 0) / 100
                          )}
                        </span>
                        <span className="text-[9px] text-[var(--invest-text-secondary-dark)] font-sans">Apuração real</span>
                      </div>

                      <div className="bg-[var(--invest-bg-dark)] border border-white/10 rounded-2xl p-4">
                        <span className="text-[9px] font-orbitron font-bold text-[var(--invest-text-secondary-dark)] uppercase block">
                          RESULTADO REAL
                        </span>
                        <span
                          className={`font-mono font-black text-lg mt-1 block ${
                            (pos.realizedReturnCentavos || 0) > 0
                              ? 'text-emerald-400'
                              : (pos.realizedReturnCentavos || 0) < 0
                              ? 'text-red-400'
                              : 'text-[var(--invest-text-secondary-dark)]'
                          }`}
                        >
                          {(pos.realizedReturnCentavos || 0) > 0 ? '+' : ''}
                          {formatBRL((pos.realizedReturnCentavos || 0) / 100)} (
                          {(pos.realizedReturnPercent || 0) > 0 ? '+' : ''}
                          {pos.realizedReturnPercent || 0}%)
                        </span>
                        <span className="text-[9px] text-[var(--invest-text-secondary-dark)] font-sans">
                          {hasRealPerformanceEntries
                            ? 'Registrado pelo gestor'
                            : 'Sem variação artificial'}
                        </span>
                      </div>

                      <div className="bg-[var(--invest-bg-dark)] border border-white/10 rounded-2xl p-4">
                        <span className="text-[9px] font-orbitron font-bold text-[var(--invest-text-secondary-dark)] uppercase block">
                          DATA DA APLICAÇÃO
                        </span>
                        <span className="font-mono font-black text-base text-[var(--invest-text-primary-dark)] mt-1 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-[var(--invest-accent)]" aria-hidden="true" />
                          {formatDateBR(pos.appliedAt)}
                        </span>
                        <span className="text-[9px] text-[var(--invest-text-secondary-dark)] font-sans">Início do lock-up</span>
                      </div>

                      <div className="bg-[var(--invest-bg-dark)] border border-white/10 rounded-2xl p-4">
                        <span className="text-[9px] font-orbitron font-bold text-[var(--invest-text-secondary-dark)] uppercase block">
                          DATA DE VENCIMENTO
                        </span>
                        <span className="font-mono font-black text-base text-[var(--invest-text-primary-dark)] mt-1 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-[var(--invest-warning)]" aria-hidden="true" />
                          {formatDateBR(pos.maturityDate)}
                        </span>
                        <span className="text-[9px] text-[var(--invest-text-secondary-dark)] font-sans">
                          Lock-up de {pos.lockupMonths || 6} meses
                        </span>
                      </div>

                      <div className="bg-[var(--invest-bg-dark)] border border-white/10 rounded-2xl p-4">
                        <span className="text-[9px] font-orbitron font-bold text-[var(--invest-text-secondary-dark)] uppercase block">
                          PRAZO RESTANTE
                        </span>
                        <span className="font-mono font-black text-base text-[var(--invest-text-primary-dark)] mt-1 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-sky-400" aria-hidden="true" />
                          {pos.status === 'SETTLED'
                            ? 'Concluído'
                            : lockup.remainingDays > 0
                            ? `${lockup.remainingDays} dias`
                            : 'Prazo cumprido'}
                        </span>
                        <span className="text-[9px] text-[var(--invest-text-secondary-dark)] font-sans">
                          {lockup.elapsedDays} de {lockup.totalDays} dias decorridos
                        </span>
                      </div>
                    </div>

                    {/* Lock-up Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-mono text-[var(--invest-text-secondary-dark)]">
                        <span>Progresso temporal do período de Lock-up ({pos.lockupMonths || 6} meses)</span>
                        <span className="text-[var(--invest-text-primary-dark)] font-bold">{lockup.progressPercent}%</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={lockup.progressPercent}
                        aria-label={`Progresso do período de lock-up da posição ${pos.productName}`}
                        className="w-full h-2.5 bg-[var(--invest-bg-dark)] rounded-full overflow-hidden border border-white/10"
                      >
                        <div
                          className="h-full bg-gradient-to-r from-[var(--invest-accent)] to-[var(--invest-warning)] transition-all duration-500"
                          style={{ width: `${lockup.progressPercent}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[var(--invest-text-secondary-dark)] font-sans">
                        Durante os {pos.lockupMonths || 6} meses de lock-up o capital principal permanece alocado na estratégia. Nenhum retorno é creditado automaticamente pelo tempo.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: TRANSPARÊNCIA, LOCK-UP & AVISOS DE RISCO
         ===================================================================== */}
      {subTab === 'transparency' && (
        <div
          id="invest-tabpanel-transparency"
          role="tabpanel"
          aria-labelledby="invest-tab-transparency"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <div className="bg-[var(--invest-surface-dark)] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--invest-accent)]/15 border border-[var(--invest-accent)]/30 flex items-center justify-center text-[var(--invest-accent)]">
                <ShieldAlert className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <span className="text-[9px] font-orbitron font-black uppercase tracking-widest text-[var(--invest-accent)] block">
                  POLÍTICA DE TRANSPARÊNCIA
                </span>
                <h3 className="font-orbitron font-black text-lg text-[var(--invest-text-primary-dark)] uppercase">
                  {settings.riskWarningTitle}
                </h3>
              </div>
            </div>

            <p className="text-xs text-[var(--invest-text-secondary-dark)] font-sans leading-relaxed">
              {settings.regulatoryDisclaimer}
            </p>

            <ul className="space-y-3">
              {(settings.riskWarningBullets || []).map((bullet, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 bg-[var(--invest-bg-dark)] border border-white/10 p-3.5 rounded-2xl text-xs text-[var(--invest-text-secondary-dark)] font-sans leading-relaxed"
                >
                  <AlertTriangle className="w-4 h-4 text-[var(--invest-warning)] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[var(--invest-surface-dark)] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-[var(--invest-text-primary-dark)]">
                <Lock className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <span className="text-[9px] font-orbitron font-black uppercase tracking-widest text-[var(--invest-text-secondary-dark)] block">
                  ARQUITETURA OPERACIONAL
                </span>
                <h3 className="font-orbitron font-black text-lg text-[var(--invest-text-primary-dark)] uppercase">
                  Fluxo PIX (Mercado Pago), Lock-up e Liquidação Real
                </h3>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[var(--invest-text-secondary-dark)] font-sans leading-relaxed">
              <div className="p-4 rounded-2xl bg-[var(--invest-bg-dark)] border border-white/10 space-y-1">
                <strong className="font-orbitron text-[10px] text-[var(--invest-text-primary-dark)] uppercase block">
                  1. Ativação Somente Após Confirmação PIX (APPROVED)
                </strong>
                <p>
                  Ao gerar um PIX via Mercado Pago, o pedido aguarda confirmação real do webhook/backend. Nenhuma aplicação é ativada antes do status APPROVED.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--invest-bg-dark)] border border-white/10 space-y-1">
                <strong className="font-orbitron text-[10px] text-[var(--invest-text-primary-dark)] uppercase block">
                  2. Proibição de Rendimento Fictício por Tempo
                </strong>
                <p>
                  O VOXA Invest jamais adiciona juros automáticos pela passagem do tempo. Enquanto uma operação não tiver resultado apurado pelo gestor/backend, o valor permanece estritamente fiel à apuração real.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--invest-bg-dark)] border border-white/10 space-y-1">
                <strong className="font-orbitron text-[10px] text-[var(--invest-text-primary-dark)] uppercase block">
                  3. Vencimento e Liquidação na Carteira VOXA
                </strong>
                <p>
                  Ao atingir a data de vencimento (maturityDate), o backend executa a liquidação (settlement) com base no resultado líquido real apurado e transfere o saldo final para a Carteira VOXA disponível.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL DE APLICAÇÃO COM PIX (MERCADO PAGO) E TERMO DE RISCO
         ===================================================================== */}
      {selectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="invest-apply-modal-title"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-[var(--invest-surface-dark)] border border-white/15 rounded-[32px] max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8 text-left relative">
            <button
              type="button"
              aria-label="Fechar modal de aplicação"
              onClick={() => {
                setSelectedProduct(null);
                setActivePixOrder(null);
              }}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/15 text-[var(--invest-text-secondary-dark)] hover:text-[var(--invest-text-primary-dark)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)]"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>

            <div className="space-y-1 pr-8">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-orbitron font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[var(--invest-accent)]/20 text-[var(--invest-accent)] border border-[var(--invest-accent)]/30">
                  NOVA APLICAÇÃO EM CRIPTOATIVOS
                </span>
                <span className="text-[10px] font-mono text-[var(--invest-text-secondary-dark)]">
                  Lock-up: {selectedProduct.lockupMonths} meses
                </span>
              </div>
              <h2
                id="invest-apply-modal-title"
                className="font-orbitron font-black text-2xl text-[var(--invest-text-primary-dark)] uppercase"
              >
                {selectedProduct.name}
              </h2>
              <p className="text-xs text-[var(--invest-text-secondary-dark)] font-sans">{selectedProduct.subtitle}</p>
            </div>

            {/* IF PIX ORDER WAS GENERATED, SHOW QR CODE & PENDING_PAYMENT STATUS */}
            {activePixOrder ? (
              <div className="space-y-6">
                <div className="bg-[var(--invest-bg-dark)] border border-white/15 rounded-3xl p-6 text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[var(--invest-warning)] text-[10px] font-orbitron font-black uppercase">
                    <Clock className="w-3.5 h-3.5 animate-pulse" aria-hidden="true" />
                    <span>
                      STATUS: {activePixOrder.status === 'PENDING_PAYMENT' ? 'AGUARDANDO PAGAMENTO PIX (PENDING)' : activePixOrder.status}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-orbitron font-black text-lg text-[var(--invest-text-primary-dark)] uppercase">
                      Escaneie o QR Code PIX (Mercado Pago)
                    </h3>
                    <p className="text-xs text-[var(--invest-text-secondary-dark)] font-sans max-w-md mx-auto">
                      A aplicação de <strong className="text-[var(--invest-text-primary-dark)]">{formatBRL(activePixOrder.amountCentavos / 100)}</strong> no produto{' '}
                      <strong className="text-[var(--invest-text-primary-dark)]">{activePixOrder.productName}</strong> será ativada automaticamente assim que o webhook do Mercado Pago confirmar o status <strong>APPROVED</strong>.
                    </p>
                  </div>

                  {activePixOrder.qrCodeBase64 && activePixOrder.qrCodeBase64 !== 'MOCK_QR_BASE64' ? (
                    <div className="bg-white p-4 rounded-2xl inline-block mx-auto shadow-lg">
                      <img
                        src={`data:image/png;base64,${activePixOrder.qrCodeBase64}`}
                        alt={`QR Code PIX Mercado Pago para pagamento de ${formatBRL(activePixOrder.amountCentavos / 100)}`}
                        className="w-48 h-48 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-44 h-44 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center mx-auto p-4 gap-2 text-[var(--invest-text-secondary-dark)]">
                      <QrCode className="w-16 h-16 text-[var(--invest-accent)]" aria-hidden="true" />
                      <span className="text-[10px] font-mono text-[var(--invest-text-secondary-dark)] text-center">
                        Utilize o código PIX Copia e Cola abaixo
                      </span>
                    </div>
                  )}

                  {/* PIX Copia e Cola */}
                  <div className="space-y-2 text-left">
                    <label
                      htmlFor="invest-pix-copy-paste-input"
                      className="text-[10px] font-orbitron font-bold text-[var(--invest-text-secondary-dark)] uppercase block"
                    >
                      Código PIX Copia e Cola:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="invest-pix-copy-paste-input"
                        type="text"
                        readOnly
                        value={activePixOrder.qrCode}
                        aria-label="Código PIX Copia e Cola gerado pelo Mercado Pago"
                        className="w-full bg-[var(--invest-bg-dark)] border border-white/20 rounded-xl px-3.5 py-3 font-mono text-xs text-[var(--invest-text-primary-dark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)]"
                      />
                      <button
                        type="button"
                        aria-label={pixCopied ? 'Código PIX copiado para a área de transferência' : 'Copiar código PIX Copia e Cola'}
                        onClick={handleCopyPixCode}
                        className="shrink-0 bg-[var(--invest-text-primary-dark)] hover:bg-neutral-200 text-[var(--invest-bg-dark)] font-orbitron font-black text-[10px] px-4 py-3 rounded-xl cursor-pointer uppercase flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)]"
                      >
                        {pixCopied ? <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                        <span>{pixCopied ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {applyFeedback && (
                  <div
                    role="alert"
                    className={`p-4 rounded-2xl border text-xs font-sans flex items-center gap-3 ${
                      applyFeedback.type === 'success'
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                        : 'bg-amber-950/50 border-amber-500/40 text-amber-200'
                    }`}
                  >
                    {applyFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-[var(--invest-warning)] shrink-0" aria-hidden="true" />
                    )}
                    <span>{applyFeedback.message}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <button
                    type="button"
                    aria-label="Voltar para configuração da aplicação"
                    onClick={() => setActivePixOrder(null)}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--invest-text-secondary-dark)] hover:text-[var(--invest-text-primary-dark)] font-orbitron font-bold text-xs uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)]"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    aria-label="Verificar status do pagamento PIX no Mercado Pago"
                    onClick={handleManualCheckPix}
                    disabled={checkingPixStatus}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[var(--invest-accent)] hover:opacity-90 disabled:opacity-50 text-[var(--invest-text-primary-dark)] font-orbitron font-black text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-text-primary-dark)]"
                  >
                    <RefreshCw className={`w-4 h-4 ${checkingPixStatus ? 'animate-spin' : ''}`} aria-hidden="true" />
                    <span>Verificar Status do PIX</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmApplication} className="space-y-5">
                {/* Payment Method Selector: PIX (Mercado Pago) vs Wallet */}
                <div className="space-y-2">
                  <span
                    id="invest-payment-method-label"
                    className="text-[10px] font-orbitron font-bold text-[var(--invest-text-primary-dark)] uppercase tracking-wider block"
                  >
                    Método de Pagamento da Aplicação
                  </span>
                  <div
                    role="radiogroup"
                    aria-labelledby="invest-payment-method-label"
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={paymentMethod === 'PIX'}
                      aria-label="Selecionar pagamento via PIX Mercado Pago (Ativação após confirmação APPROVED)"
                      onClick={() => setPaymentMethod('PIX')}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)] ${
                        paymentMethod === 'PIX'
                          ? 'bg-[var(--invest-text-primary-dark)] text-[var(--invest-bg-dark)] border-white shadow-lg'
                          : 'bg-[var(--invest-bg-dark)] text-[var(--invest-text-secondary-dark)] border-white/15 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <QrCode className={`w-5 h-5 ${paymentMethod === 'PIX' ? 'text-[var(--invest-accent)]' : 'text-[var(--invest-text-secondary-dark)]'}`} aria-hidden="true" />
                        <div>
                          <span className="font-orbitron font-black text-xs uppercase block">
                            PIX (Mercado Pago)
                          </span>
                          <span className={`text-[10px] font-sans ${paymentMethod === 'PIX' ? 'text-neutral-700' : 'text-[var(--invest-text-secondary-dark)]'}`}>
                            Ativação após confirmação APPROVED
                          </span>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      role="radio"
                      aria-checked={paymentMethod === 'WALLET'}
                      aria-label={`Selecionar pagamento via Saldo Carteira VOXA (${formatBRL(availableBalance / 100)} disponível)`}
                      onClick={() => setPaymentMethod('WALLET')}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)] ${
                        paymentMethod === 'WALLET'
                          ? 'bg-[var(--invest-text-primary-dark)] text-[var(--invest-bg-dark)] border-white shadow-lg'
                          : 'bg-[var(--invest-bg-dark)] text-[var(--invest-text-secondary-dark)] border-white/15 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Wallet className={`w-5 h-5 ${paymentMethod === 'WALLET' ? 'text-[var(--invest-accent)]' : 'text-[var(--invest-text-secondary-dark)]'}`} aria-hidden="true" />
                        <div>
                          <span className="font-orbitron font-black text-xs uppercase block">
                            Saldo Carteira VOXA
                          </span>
                          <span className={`text-[10px] font-mono ${paymentMethod === 'WALLET' ? 'text-neutral-700 font-bold' : 'text-emerald-400'}`}>
                            Disponível: {formatBRL(availableBalance / 100)}
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Quick Value Tiers */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="invest-modal-amount-input"
                      className="text-[10px] font-orbitron font-bold text-[var(--invest-text-primary-dark)] uppercase tracking-wider"
                    >
                      Valor do Aporte (Mín: {formatBRL(selectedProduct.minAmountCentavos / 100)} • Máx:{' '}
                      {formatBRL(selectedProduct.maxAmountCentavos / 100)})
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2" role="group" aria-label="Atalhos de valor para aplicação">
                    {STANDARD_VALUE_TIERS_CENTAVOS.filter(
                      (t) =>
                        t >= selectedProduct.minAmountCentavos &&
                        t <= selectedProduct.maxAmountCentavos
                    ).map((tierCentavos) => {
                      const reais = Math.round(tierCentavos / 100);
                      const isSelected = parsedAmountCentavos === tierCentavos;
                      return (
                        <button
                          type="button"
                          key={tierCentavos}
                          aria-pressed={isSelected}
                          aria-label={`Selecionar valor de aporte de ${formatBRL(reais)}`}
                          onClick={() => setAmountReaisInput(String(reais))}
                          className={`px-3.5 py-2 rounded-xl font-mono font-bold text-xs transition-all cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)] ${
                            isSelected
                              ? 'bg-[var(--invest-text-primary-dark)] text-[var(--invest-bg-dark)] border-white shadow-md'
                              : 'bg-[var(--invest-bg-dark)] text-[var(--invest-text-secondary-dark)] border-white/15 hover:border-white/30'
                          }`}
                        >
                          {formatBRL(reais)}
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center font-mono font-bold text-[var(--invest-text-secondary-dark)]" aria-hidden="true">
                      R$
                    </span>
                    <input
                      id="invest-modal-amount-input"
                      type="number"
                      step="1"
                      min={Math.round(selectedProduct.minAmountCentavos / 100)}
                      max={Math.round(selectedProduct.maxAmountCentavos / 100)}
                      value={amountReaisInput}
                      onChange={(e) => setAmountReaisInput(e.target.value)}
                      className="w-full bg-[var(--invest-bg-dark)] border border-white/20 rounded-2xl pl-12 pr-4 py-3.5 font-mono font-black text-lg text-[var(--invest-text-primary-dark)] focus:outline-none focus:border-[var(--invest-accent)] focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)]"
                      placeholder="1000"
                    />
                  </div>
                </div>

                {/* Lock-up Dates & Non-Guaranteed Reference Scenarios */}
                <div className="bg-[var(--invest-bg-dark)] border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <span className="text-[10px] font-orbitron font-black text-[var(--invest-text-primary-dark)] uppercase">
                      CRONOGRAMA DE LOCK-UP & CENÁRIOS DE REFERÊNCIA
                    </span>
                    <span className="text-[8px] font-orbitron font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-[var(--invest-warning)] border border-amber-500/30">
                      NÃO GARANTIDOS
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[9px] text-[var(--invest-text-secondary-dark)] font-mono uppercase block">
                        Data da Aplicação
                      </span>
                      <span className="font-mono font-bold text-[var(--invest-text-primary-dark)]">
                        {new Date().toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[var(--invest-text-secondary-dark)] font-mono uppercase block">
                        Vencimento Previsto ({selectedProduct.lockupMonths}m)
                      </span>
                      <span className="font-mono font-bold text-[var(--invest-warning)]">
                        {nonGuaranteedScenarios.maturityDateStr}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[var(--invest-text-secondary-dark)] font-mono uppercase block">
                        Meta Indicativa (Não Garantida)
                      </span>
                      <span className="font-mono font-bold text-[var(--invest-text-primary-dark)]">
                        {selectedProduct.targetReturnMinPercent}% a {selectedProduct.targetReturnMaxPercent}%
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 text-[11px] text-[var(--invest-text-secondary-dark)] font-sans leading-relaxed">
                    Cenário projetado referencial (não garantido) sobre{' '}
                    <strong className="text-[var(--invest-text-primary-dark)]">{formatBRL(parsedAmountCentavos / 100)}</strong>: variação estimada entre{' '}
                    <span className="text-[var(--invest-text-primary-dark)] font-mono">
                      +{formatBRL((nonGuaranteedScenarios.minTargetDeltaCentavos || 0) / 100)}
                    </span>{' '}
                    e{' '}
                    <span className="text-[var(--invest-text-primary-dark)] font-mono">
                      +{formatBRL((nonGuaranteedScenarios.maxTargetDeltaCentavos || 0) / 100)}
                    </span>{' '}
                    caso a meta indicativa se concretize. <strong className="text-[var(--invest-warning)]">Atenção:</strong> o resultado real poderá ser superior, inferior, nulo ou negativo dependendo do desempenho real do mercado de criptoativos.
                  </div>
                </div>

                {/* Mandatory Risk Acceptance Checkboxes */}
                <fieldset className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-4 space-y-3">
                  <legend className="text-[10px] font-orbitron font-black text-[var(--invest-warning)] uppercase tracking-wider px-1">
                    DECLARAÇÃO OBRIGATÓRIA DE CIÊNCIA DE RISCO E LOCK-UP
                  </legend>

                  <label
                    htmlFor="invest-risk-checkbox-1"
                    className="flex items-start gap-3 cursor-pointer text-xs text-[var(--invest-text-primary-dark)] font-sans"
                  >
                    <input
                      id="invest-risk-checkbox-1"
                      type="checkbox"
                      checked={riskCheckbox1}
                      onChange={(e) => setRiskCheckbox1(e.target.checked)}
                      className="mt-1 accent-[var(--invest-accent)] w-4 h-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)]"
                    />
                    <span>
                      Compreendo que o <strong>VOXA Invest NÃO garante rentabilidade</strong> e que metas indicativas ou resultados passados não asseguram retornos futuros.
                    </span>
                  </label>

                  <label
                    htmlFor="invest-risk-checkbox-2"
                    className="flex items-start gap-3 cursor-pointer text-xs text-[var(--invest-text-primary-dark)] font-sans"
                  >
                    <input
                      id="invest-risk-checkbox-2"
                      type="checkbox"
                      checked={riskCheckbox2}
                      onChange={(e) => setRiskCheckbox2(e.target.checked)}
                      className="mt-1 accent-[var(--invest-accent)] w-4 h-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)]"
                    />
                    <span>
                      Estou ciente de que a estratégia opera criptoativos reais sujeitos à volatilidade do mercado e que os resultados dependem exclusivamente da apuração financeira real registrada pelo gestor.
                    </span>
                  </label>

                  <label
                    htmlFor="invest-risk-checkbox-3"
                    className="flex items-start gap-3 cursor-pointer text-xs text-[var(--invest-text-primary-dark)] font-sans"
                  >
                    <input
                      id="invest-risk-checkbox-3"
                      type="checkbox"
                      checked={riskCheckbox3}
                      onChange={(e) => setRiskCheckbox3(e.target.checked)}
                      className="mt-1 accent-[var(--invest-accent)] w-4 h-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)]"
                    />
                    <span>
                      Concordo com o prazo de carência (lock-up) de <strong>{selectedProduct.lockupMonths} meses</strong>, durante o qual o capital principal não poderá ser sacado antecipadamente, com vencimento previsto em <strong>{nonGuaranteedScenarios.maturityDateStr}</strong>.
                    </span>
                  </label>
                </fieldset>

                {applyFeedback && (
                  <div
                    role="alert"
                    className={`p-4 rounded-2xl border text-xs font-sans flex items-center gap-3 ${
                      applyFeedback.type === 'success'
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                        : 'bg-red-950/50 border-red-500/40 text-red-200'
                    }`}
                  >
                    {applyFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" aria-hidden="true" />
                    )}
                    <span>{applyFeedback.message}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    aria-label="Cancelar aplicação e fechar janela"
                    onClick={() => setSelectedProduct(null)}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--invest-text-secondary-dark)] hover:text-[var(--invest-text-primary-dark)] font-orbitron font-bold text-xs uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isApplying}
                    aria-label={
                      paymentMethod === 'PIX'
                        ? `Gerar cobrança PIX de ${formatBRL(parsedAmountCentavos / 100)} para o produto ${selectedProduct.name}`
                        : `Confirmar aplicação com saldo de ${formatBRL(parsedAmountCentavos / 100)} no produto ${selectedProduct.name}`
                    }
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[var(--invest-accent)] hover:opacity-90 disabled:opacity-50 text-[var(--invest-text-primary-dark)] font-orbitron font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-text-primary-dark)]"
                  >
                    {paymentMethod === 'PIX' && <QrCode className="w-4 h-4" aria-hidden="true" />}
                    <span>
                      {isApplying
                        ? 'Processando...'
                        : paymentMethod === 'PIX'
                        ? `Gerar PIX de ${formatBRL(parsedAmountCentavos / 100)}`
                        : `Confirmar com Saldo (${formatBRL(parsedAmountCentavos / 100)})`}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL DE EXTRATO REAL DE APURAÇÕES DA POSIÇÃO
         ===================================================================== */}
      {selectedPositionDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="invest-position-detail-modal-title"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-[var(--invest-surface-dark)] border border-white/15 rounded-[32px] max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8 text-left relative">
            <button
              type="button"
              aria-label="Fechar extrato de apurações da posição"
              onClick={() => setSelectedPositionDetail(null)}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/15 text-[var(--invest-text-secondary-dark)] hover:text-[var(--invest-text-primary-dark)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)]"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>

            <div className="space-y-1">
              <span className="text-[9px] font-orbitron font-black text-[var(--invest-accent)] uppercase tracking-widest block">
                RELATÓRIO DE APURAÇÃO REAL • {selectedPositionDetail.productName}
              </span>
              <h3
                id="invest-position-detail-modal-title"
                className="font-orbitron font-black text-xl text-[var(--invest-text-primary-dark)] uppercase"
              >
                Histórico de Resultados da Estratégia
              </h3>
              <p className="text-xs text-[var(--invest-text-secondary-dark)] font-mono">
                Aplicação: {formatDateTimeBR(selectedPositionDetail.appliedAt)} • Vencimento:{' '}
                {formatDateBR(selectedPositionDetail.maturityDate)}
              </p>
            </div>

            {!selectedPositionDetail.performanceHistory ||
            selectedPositionDetail.performanceHistory.length === 0 ? (
              <div className="bg-[var(--invest-bg-dark)] border border-white/10 rounded-2xl p-6 text-center space-y-2">
                <p className="text-xs text-[var(--invest-text-primary-dark)] font-sans">
                  Nenhuma apuração de resultado financeiro foi registrada pelo gestor para este contrato até o momento.
                </p>
                <p className="text-[11px] text-[var(--invest-text-secondary-dark)] font-sans">
                  O capital principal ({formatBRL(selectedPositionDetail.principalAmountCentavos / 100)}) segue alocado na estratégia de criptoativos sem acréscimos artificiais por tempo.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {selectedPositionDetail.performanceHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-[var(--invest-bg-dark)] border border-white/10 rounded-2xl p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-orbitron font-bold text-xs text-[var(--invest-text-primary-dark)] uppercase">
                        {entry.periodLabel}
                      </span>
                      <span
                        className={`font-mono font-black text-xs px-2.5 py-1 rounded-lg ${
                          entry.realReturnAmountCentavos >= 0
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-red-500/15 text-red-300'
                        }`}
                      >
                        {entry.realReturnPercent >= 0 ? '+' : ''}
                        {entry.realReturnPercent}% ({entry.realReturnAmountCentavos >= 0 ? '+' : ''}
                        {formatBRL(entry.realReturnAmountCentavos / 100)})
                      </span>
                    </div>
                    <p className="text-xs text-[var(--invest-text-secondary-dark)] font-sans leading-relaxed">
                      {entry.strategyNotes}
                    </p>
                    <div className="flex items-center justify-between text-[10px] font-mono text-[var(--invest-text-secondary-dark)] pt-2 border-t border-white/5">
                      <span>Registrado em: {formatDateTimeBR(entry.date)}</span>
                      <span>Saldo atualizado da posição: {formatBRL(entry.navAfterCentavos / 100)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                aria-label="Fechar janela de histórico de apurações"
                onClick={() => setSelectedPositionDetail(null)}
                className="px-6 py-3 rounded-xl bg-[var(--invest-text-primary-dark)] text-[var(--invest-bg-dark)] font-orbitron font-black text-xs uppercase cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--invest-accent)]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invest;
