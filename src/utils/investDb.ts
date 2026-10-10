import {
  db,
  isFirebaseConfigured,
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  where,
  isFirestoreWriteQuotaExhausted
} from '../lib/firebase';
import { runTransaction } from 'firebase/firestore';

export type InvestRiskLevel = 'MODERADO' | 'ARROJADO' | 'ALTO RISCO';

export interface InvestProduct {
  id: string;
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  strategyDescription: string;
  underlyingAssets: string[];
  active: boolean;
  featured: boolean;
  minAmountCentavos: number;
  maxAmountCentavos: number;
  suggestedTiersCentavos: number[];
  lockupMonths: number;
  lockupDays: number;
  targetReturnMinPercent: number; // Meta indicativa mínima (%) - NÃO GARANTIDA
  targetReturnMaxPercent: number; // Meta indicativa máxima (%) - NÃO GARANTIDA
  historicalReturnMinPercent: number; // Faixa histórica mínima (%) - NÃO GARANTIDA
  historicalReturnMaxPercent: number; // Faixa histórica máxima (%) - NÃO GARANTIDA
  managementFeePercent: number;
  performanceFeePercent: number;
  earlyRedemptionAllowed: boolean;
  earlyRedemptionPenaltyPercent: number;
  riskLevel: InvestRiskLevel;
  riskDisclosure: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export type InvestPositionStatus =
  | 'ACTIVE_LOCKED'
  | 'MATURED_PENDING_SETTLEMENT'
  | 'SETTLED'
  | 'EARLY_REDEEMED'
  | 'CANCELED';

export interface InvestPerformanceEntry {
  id: string;
  date: string;
  periodLabel: string;
  realReturnPercent: number;
  realReturnAmountCentavos: number;
  navAfterCentavos: number;
  strategyNotes: string;
  recordedBy: string;
}

export interface InvestPosition {
  id: string;
  userUid: string;
  userName?: string;
  userEmail?: string;
  productId: string;
  productName: string;
  principalAmountCentavos: number; // Capital aplicado em centavos
  currentValuationCentavos: number; // Valor atualizado exclusivamente por resultados reais apurados pelo backend/gestor
  realizedReturnCentavos: number; // Retorno real acumulado em centavos (pode ser positivo, zero ou negativo conforme mercado)
  realizedReturnPercent: number; // Retorno percentual real acumulado
  lockupMonths: number;
  lockupDays: number;
  appliedAt: string; // Data da aplicação (ISO)
  maturityDate: string; // Data prevista de vencimento (ISO)
  settledAt?: string | null;
  status: InvestPositionStatus;
  targetReturnMinPercentSnapshot: number; // Snapshot informativo (não garantido)
  targetReturnMaxPercentSnapshot: number; // Snapshot informativo (não garantido)
  managementFeePercentSnapshot: number;
  performanceFeePercentSnapshot: number;
  riskAcceptedAt: string;
  riskAcceptedIpOrAgent?: string;
  performanceHistory: InvestPerformanceEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface InvestGlobalSettings {
  enabled: boolean;
  acceptingNewApplications: boolean;
  defaultLockupMonths: number;
  defaultLockupDays: number;
  platformCustodyNotice: string;
  regulatoryDisclaimer: string;
  riskWarningTitle: string;
  riskWarningBullets: string[];
  updatedAt: string;
  updatedBy?: string;
}

export const INITIAL_INVEST_GLOBAL_SETTINGS: InvestGlobalSettings = {
  enabled: true,
  acceptingNewApplications: true,
  defaultLockupMonths: 6,
  defaultLockupDays: 180,
  platformCustodyNotice:
    'Os recursos alocados no VOXA Invest são direcionados a estratégias reais de aquisição, venda, arbitragem e gestão ativa de criptoativos. O resultado depende exclusivamente do desempenho real apurado nas operações.',
  regulatoryDisclaimer:
    'AVISO IMPORTANTE DE RISCO: O VOXA Invest NÃO oferece rentabilidade fixa ou garantida. Metas indicativas, faixas históricas e cenários projetados são meramente referenciais e não constituem promessa de retorno. Criptoativos possuem alta volatilidade e o capital aplicado está sujeito a variações positivas ou negativas, inclusive perda parcial do principal.',
  riskWarningTitle: 'Termo de Ciência de Risco e Lock-up (Criptoativos)',
  riskWarningBullets: [
    'Rentabilidade passada, meta indicativa ou cenário projetado NÃO representam garantia de rentabilidade futura.',
    'Os resultados financeiros decorrem exclusivamente da apuração real das operações de compra, venda e gestão de criptoativos registradas pelo gestor/backend.',
    'Nenhum rendimento é gerado ou creditado automaticamente apenas pela passagem do tempo.',
    'Durante o prazo de carência (lock-up de 6 meses / 180 dias), o capital permanece alocado na estratégia e sujeito às regras de liquidez do produto selecionado.'
  ],
  updatedAt: new Date().toISOString()
};

export const INITIAL_INVEST_PRODUCTS: InvestProduct[] = [
  {
    id: 'voxa_start',
    name: 'VOXA Start',
    slug: 'voxa-start',
    subtitle: 'Porta de entrada em estratégias ativas de criptoativos com alocação diversificada em Bitcoin e Ethereum.',
    description:
      'Produto estruturado para investidores que desejam participar da gestão ativa de criptoativos de alta liquidez (BTC e ETH), com foco em preservação relativa e captura de ciclos de mercado no médio prazo.',
    strategyDescription: 'Alocação majoritária em BTC/ETH spot, rebalanceamento tático semanal e proteção parcial em stablecoins (USDT/USDC) em momentos de alta volatilidade.',
    underlyingAssets: ['BTC', 'ETH', 'USDT'],
    active: true,
    featured: false,
    minAmountCentavos: 10000, // R$ 100,00
    maxAmountCentavos: 500000, // R$ 5.000,00
    suggestedTiersCentavos: [10000, 50000, 100000], // R$ 100, R$ 500, R$ 1.000
    lockupMonths: 6,
    lockupDays: 180,
    targetReturnMinPercent: 12,
    targetReturnMaxPercent: 28,
    historicalReturnMinPercent: 9.5,
    historicalReturnMaxPercent: 24.8,
    managementFeePercent: 1.5,
    performanceFeePercent: 15,
    earlyRedemptionAllowed: false,
    earlyRedemptionPenaltyPercent: 15,
    riskLevel: 'MODERADO',
    riskDisclosure:
      'Estratégia exposta à oscilação de preços do mercado de criptoativos. As metas indicativas (12% a 28% no ciclo de 6 meses) NÃO são garantidas e dependem do resultado real das operações.',
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'voxa_plus',
    name: 'VOXA Plus',
    slug: 'voxa-plus',
    subtitle: 'Cesta balanceada entre líderes de mercado (BTC/ETH) e redes Layer-1 de alto crescimento.',
    description:
      'Desenvolvido para participantes que buscam exposição combinada entre criptoativos consolidados e infraestrutura blockchain de primeira camada (Solana e ecossistema DeFi institucional).',
    strategyDescription: 'Gestão ativa de posição em BTC, ETH e SOL com execução de swing trade estruturado e realização parcial de lucros em picos de liquidez.',
    underlyingAssets: ['BTC', 'ETH', 'SOL', 'USDT'],
    active: true,
    featured: false,
    minAmountCentavos: 50000, // R$ 500,00
    maxAmountCentavos: 2500000, // R$ 25.000,00
    suggestedTiersCentavos: [50000, 100000, 500000], // R$ 500, R$ 1.000, R$ 5.000
    lockupMonths: 6,
    lockupDays: 180,
    targetReturnMinPercent: 16,
    targetReturnMaxPercent: 38,
    historicalReturnMinPercent: 12.0,
    historicalReturnMaxPercent: 33.4,
    managementFeePercent: 1.5,
    performanceFeePercent: 18,
    earlyRedemptionAllowed: false,
    earlyRedemptionPenaltyPercent: 18,
    riskLevel: 'MODERADO',
    riskDisclosure:
      'Criptoativos de infraestrutura Layer-1 apresentam volatilidade superior. Metas indicativas não constituem promessa ou garantia de rentabilidade.',
    order: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'voxa_prime',
    name: 'VOXA Prime',
    slug: 'voxa-prime',
    subtitle: 'Estratégia multi-ativos com arbitragem tática, captura de liquidez e gestão dinâmica de risco.',
    description:
      'Portfólio dinâmico voltado para captura de assimetrias no mercado cripto global, combinando operações direcionais em grandes ativos com arbitragem de pares e rotação setorial.',
    strategyDescription: 'Operações ativas de compra e venda em BTC, ETH, SOL e ativos de infraestrutura IA/Web3, com controle rigoroso de drawdown.',
    underlyingAssets: ['BTC', 'ETH', 'SOL', 'PAXG', 'USDT'],
    active: true,
    featured: true,
    minAmountCentavos: 100000, // R$ 1.000,00
    maxAmountCentavos: 10000000, // R$ 100.000,00
    suggestedTiersCentavos: [100000, 500000, 1000000], // R$ 1.000, R$ 5.000, R$ 10.000
    lockupMonths: 6,
    lockupDays: 180,
    targetReturnMinPercent: 22,
    targetReturnMaxPercent: 52,
    historicalReturnMinPercent: 15.4,
    historicalReturnMaxPercent: 46.2,
    managementFeePercent: 2.0,
    performanceFeePercent: 20,
    earlyRedemptionAllowed: false,
    earlyRedemptionPenaltyPercent: 20,
    riskLevel: 'ARROJADO',
    riskDisclosure:
      'Operações direcionais e setoriais possuem risco elevado de mercado. Retornos reais dependem exclusivamente da performance obtida pelo gestor no período de lock-up.',
    order: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'voxa_black',
    name: 'VOXA Black',
    slug: 'voxa-black',
    subtitle: 'Alocação de alta convicção para tickets médios e altos em ciclos de expansão de criptoativos.',
    description:
      'Desenhado para investidores qualificados na plataforma que desejam participar de operações de maior porte, com execução institucional, mesa dedicada de criptoativos e relatórios detalhados de apuração.',
    strategyDescription: 'Gestão tática intensiva em criptoativos de alta capitalização, pares sintéticos de ouro digital (PAXG) e captura de volatilidade em eventos macroeconômicos.',
    underlyingAssets: ['BTC', 'ETH', 'SOL', 'PAXG', 'USDC'],
    active: true,
    featured: true,
    minAmountCentavos: 1000000, // R$ 10.000,00
    maxAmountCentavos: 50000000, // R$ 500.000,00
    suggestedTiersCentavos: [1000000, 5000000, 10000000], // R$ 10.000, R$ 50.000, R$ 100.000
    lockupMonths: 6,
    lockupDays: 180,
    targetReturnMinPercent: 28,
    targetReturnMaxPercent: 68,
    historicalReturnMinPercent: 18.2,
    historicalReturnMaxPercent: 58.9,
    managementFeePercent: 2.0,
    performanceFeePercent: 20,
    earlyRedemptionAllowed: false,
    earlyRedemptionPenaltyPercent: 25,
    riskLevel: 'ARROJADO',
    riskDisclosure:
      'Alocação sujeita a oscilações severas de curto prazo. Nenhum retorno é pré-fixado ou garantido; todo resultado é apurado conforme o fechamento real das operações.',
    order: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'voxa_infinity',
    name: 'VOXA Infinity',
    slug: 'voxa-infinity',
    subtitle: 'Estratégia Private & Institucional de alta capacidade em tesouraria cripto e ativos globais.',
    description:
      'Nível máximo do ecossistema VOXA Invest. Estruturado para grandes alocações com acompanhamento direto de performance real, diversificação em múltiplos protocolos e execução fracionada.',
    strategyDescription: 'Mesa institucional de compra, venda, arbitragem de liquidez e posicionamento estratégico em Bitcoin, Ethereum e ativos digitais de alta liquidez.',
    underlyingAssets: ['BTC', 'ETH', 'SOL', 'PAXG', 'USDT', 'USDC'],
    active: true,
    featured: true,
    minAmountCentavos: 5000000, // R$ 50.000,00
    maxAmountCentavos: 100000000, // R$ 1.000.000,00
    suggestedTiersCentavos: [5000000, 10000000], // R$ 50.000, R$ 100.000
    lockupMonths: 6,
    lockupDays: 180,
    targetReturnMinPercent: 32,
    targetReturnMaxPercent: 85,
    historicalReturnMinPercent: 21.0,
    historicalReturnMaxPercent: 72.5,
    managementFeePercent: 1.8,
    performanceFeePercent: 20,
    earlyRedemptionAllowed: false,
    earlyRedemptionPenaltyPercent: 25,
    riskLevel: 'ALTO RISCO',
    riskDisclosure:
      'Produto de alto risco voltado a participantes com tolerância a volatilidade elevada. Projeções e faixas históricas são estritamente informativas e NÃO GARANTIDAS.',
    order: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

let seedInvestPromise: Promise<{ settings: InvestGlobalSettings; products: InvestProduct[] }> | null = null;

export async function ensureInvestSeeded(): Promise<{
  settings: InvestGlobalSettings;
  products: InvestProduct[];
}> {
  if (!isFirebaseConfigured() || isFirestoreWriteQuotaExhausted()) {
    return {
      settings: INITIAL_INVEST_GLOBAL_SETTINGS,
      products: INITIAL_INVEST_PRODUCTS
    };
  }

  if (seedInvestPromise) {
    return seedInvestPromise;
  }

  seedInvestPromise = (async () => {
    try {
      const settingsRef = doc(db, 'invest_settings', 'global');
      const settingsSnap = await getDoc(settingsRef);
      let resolvedSettings = INITIAL_INVEST_GLOBAL_SETTINGS;

      if (!settingsSnap.exists()) {
        await setDoc(settingsRef, INITIAL_INVEST_GLOBAL_SETTINGS, { merge: true });
      } else {
        const d = settingsSnap.data() || {};
        resolvedSettings = {
          ...INITIAL_INVEST_GLOBAL_SETTINGS,
          ...d,
          riskWarningBullets:
            Array.isArray(d.riskWarningBullets) && d.riskWarningBullets.length > 0
              ? d.riskWarningBullets
              : INITIAL_INVEST_GLOBAL_SETTINGS.riskWarningBullets
        };
      }

      const productsSnap = await getDocs(collection(db, 'invest_products'));
      const productsList: InvestProduct[] = [];

      if (productsSnap.empty) {
        for (const prod of INITIAL_INVEST_PRODUCTS) {
          await setDoc(doc(db, 'invest_products', prod.id), prod, { merge: true });
          productsList.push(prod);
        }
      } else {
        productsSnap.forEach((docSnap) => {
          const data = docSnap.data() as InvestProduct;
          productsList.push({ ...data, id: docSnap.id });
        });
      }

      productsList.sort((a, b) => (a.order || 99) - (b.order || 99));

      return {
        settings: resolvedSettings,
        products: productsList
      };
    } catch (err) {
      console.warn('[VOXA INVEST SEED FALLBACK]', err);
      return {
        settings: INITIAL_INVEST_GLOBAL_SETTINGS,
        products: INITIAL_INVEST_PRODUCTS
      };
    } finally {
      seedInvestPromise = null;
    }
  })();

  return seedInvestPromise;
}

export async function fetchInvestCatalog(): Promise<{
  settings: InvestGlobalSettings;
  products: InvestProduct[];
}> {
  try {
    const res = await fetch('/api/invest/products');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.products) && data.products.length > 0) {
        return {
          settings: data.settings || INITIAL_INVEST_GLOBAL_SETTINGS,
          products: data.products
        };
      }
    }
  } catch {}

  return ensureInvestSeeded();
}

export async function fetchUserInvestPositions(userUid: string): Promise<InvestPosition[]> {
  if (!userUid) return [];

  try {
    const res = await fetch(`/api/invest/positions?userUid=${encodeURIComponent(userUid)}`, {
      headers: { 'x-user-uid': userUid }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.positions)) {
        return data.positions;
      }
    }
  } catch {}

  if (!isFirebaseConfigured()) return [];

  try {
    const q = query(collection(db, 'invest_positions'), where('userUid', '==', userUid));
    const snap = await getDocs(q);
    const list: InvestPosition[] = [];
    snap.forEach((d) => {
      list.push({ ...(d.data() as InvestPosition), id: d.id });
    });
    list.sort((a, b) => new Date(b.appliedAt || 0).getTime() - new Date(a.appliedAt || 0).getTime());
    return list;
  } catch (err) {
    console.warn('[fetchUserInvestPositions]', err);
    return [];
  }
}

export function calculateLockupProgress(appliedAtIso: string, maturityDateIso: string) {
  const now = Date.now();
  const start = new Date(appliedAtIso).getTime();
  const end = new Date(maturityDateIso).getTime();

  if (isNaN(start) || isNaN(end) || end <= start) {
    return {
      elapsedDays: 0,
      remainingDays: 180,
      totalDays: 180,
      progressPercent: 0,
      isMatured: false
    };
  }

  const totalMs = end - start;
  const elapsedMs = Math.max(0, now - start);
  const remainingMs = Math.max(0, end - now);

  const totalDays = Math.max(1, Math.round(totalMs / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.min(totalDays, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
  const progressPercent = Math.min(100, Math.max(0, Number(((elapsedMs / totalMs) * 100).toFixed(1))));

  return {
    elapsedDays,
    remainingDays,
    totalDays,
    progressPercent,
    isMatured: now >= end
  };
}

/**
 * Fallback client-side transaction if backend route is unreachable.
 * Strictly validates real wallet balance and creates position with 0 initial return (no fake time-based yield).
 */
export async function applyInvestPositionClientFallback(params: {
  userUid: string;
  userName: string;
  userEmail: string;
  productId: string;
  amountCentavos: number;
  riskAccepted: boolean;
}): Promise<InvestPosition> {
  const { userUid, userName, userEmail, productId, amountCentavos, riskAccepted } = params;
  if (!userUid) throw new Error('Faça login na sua conta VOXA para realizar uma aplicação.');
  if (!riskAccepted) throw new Error('É obrigatório aceitar o Termo de Ciência de Risco e Lock-up.');

  const { settings, products } = await ensureInvestSeeded();
  if (!settings.enabled || !settings.acceptingNewApplications) {
    throw new Error('Novas aplicações no VOXA Invest estão temporariamente suspensas pelo gestor.');
  }

  const product = products.find((p) => p.id === productId);
  if (!product || !product.active) {
    throw new Error('Produto de investimento indisponível ou inativo.');
  }

  const amountInt = Math.round(Number(amountCentavos));
  if (amountInt < product.minAmountCentavos) {
    throw new Error(`O valor mínimo para o produto ${product.name} é de R$ ${(product.minAmountCentavos / 100).toFixed(2).replace('.', ',')}.`);
  }
  if (amountInt > product.maxAmountCentavos) {
    throw new Error(`O valor máximo permitido para o produto ${product.name} é de R$ ${(product.maxAmountCentavos / 100).toFixed(2).replace('.', ',')}.`);
  }

  const now = new Date();
  const appliedAt = now.toISOString();
  const maturity = new Date(now.getTime());
  maturity.setMonth(maturity.getMonth() + (product.lockupMonths || 6));
  const maturityDate = maturity.toISOString();

  const positionId = `inv_pos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const txId = `tx_invest_app_${positionId}`;

  const walletRef = doc(db, 'wallets', userUid);
  const posRef = doc(db, 'invest_positions', positionId);
  const txRef = doc(db, 'wallet_transactions', txId);

  const createdPosition: InvestPosition = {
    id: positionId,
    userUid,
    userName,
    userEmail,
    productId: product.id,
    productName: product.name,
    principalAmountCentavos: amountInt,
    currentValuationCentavos: amountInt, // Starts strictly at principal; only changes when real strategy results are recorded
    realizedReturnCentavos: 0,
    realizedReturnPercent: 0,
    lockupMonths: product.lockupMonths || 6,
    lockupDays: product.lockupDays || 180,
    appliedAt,
    maturityDate,
    settledAt: null,
    status: 'ACTIVE_LOCKED',
    targetReturnMinPercentSnapshot: product.targetReturnMinPercent,
    targetReturnMaxPercentSnapshot: product.targetReturnMaxPercent,
    managementFeePercentSnapshot: product.managementFeePercent,
    performanceFeePercentSnapshot: product.performanceFeePercent,
    riskAcceptedAt: appliedAt,
    performanceHistory: [],
    createdAt: appliedAt,
    updatedAt: appliedAt
  };

  await runTransaction(db, async (transaction) => {
    const wSnap = await transaction.get(walletRef);
    if (!wSnap.exists()) {
      throw new Error('Saldo disponível insuficiente na Carteira VOXA. Realize um depósito via PIX.');
    }
    const wData = wSnap.data() || {};
    const availableBalance = Number(
      wData.availableBalance !== undefined ? wData.availableBalance : wData.balance || 0
    );
    const blockedBalance = Number(wData.blockedBalance || 0);
    const pendingBalance = Number(wData.pendingBalance || 0);

    if (availableBalance < amountInt) {
      throw new Error(
        `Saldo livre insuficiente na Carteira VOXA. Disponível: R$ ${(availableBalance / 100)
          .toFixed(2)
          .replace('.', ',')}.`
      );
    }

    const nextAvailable = availableBalance - amountInt;
    const nextBlocked = blockedBalance + amountInt;
    const nextTotal = nextAvailable + nextBlocked + pendingBalance;

    transaction.update(walletRef, {
      availableBalance: nextAvailable,
      blockedBalance: nextBlocked,
      balance: nextTotal,
      updatedAt: appliedAt
    });

    transaction.set(posRef, createdPosition);

    transaction.set(txRef, {
      id: txId,
      userId: userUid,
      type: 'INVEST_APPLICATION_LOCKED',
      amount: -amountInt,
      grossAmount: amountInt,
      platformFee: 0,
      netAmount: amountInt,
      direction: 'OUT',
      status: 'completed',
      source: 'VOXA_INVEST',
      referenceId: positionId,
      referenceType: 'invest_position',
      description: `Aplicação VOXA Invest: ${product.name} (Lock-up ${product.lockupMonths} meses)`,
      createdAt: appliedAt,
      processedAt: appliedAt
    });
  });

  return createdPosition;
}
