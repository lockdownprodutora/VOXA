import { db, isFirebaseConfigured, doc, getDoc, setDoc, isFirestoreWriteQuotaExhausted, markFirestoreWriteQuotaExhausted } from '../lib/firebase';

export interface TradeAssetDefinition {
  id: string;
  symbol: string;
  name: string;
  category: 'CRYPTO' | 'FOREX' | 'COMMODITIES';
  provider: 'BINANCE' | 'AWESOMEAPI';
  providerPair: string;
  decimals: number;
  currencyPrefix: string;
  active: boolean;
}

export const INITIAL_SAFE_TRADE_ASSETS: TradeAssetDefinition[] = [
  { id: 'BTCUSDT', symbol: 'BTC/USDT', name: 'Bitcoin', category: 'CRYPTO', provider: 'BINANCE', providerPair: 'BTCUSDT', decimals: 2, currencyPrefix: 'US$ ', active: true },
  { id: 'ETHUSDT', symbol: 'ETH/USDT', name: 'Ethereum', category: 'CRYPTO', provider: 'BINANCE', providerPair: 'ETHUSDT', decimals: 2, currencyPrefix: 'US$ ', active: true },
  { id: 'SOLUSDT', symbol: 'SOL/USDT', name: 'Solana', category: 'CRYPTO', provider: 'BINANCE', providerPair: 'SOLUSDT', decimals: 2, currencyPrefix: 'US$ ', active: true },
  { id: 'XAUUSDT', symbol: 'XAU/USDT', name: 'Ouro (PAXG/Ouro Spot)', category: 'COMMODITIES', provider: 'BINANCE', providerPair: 'PAXGUSDT', decimals: 2, currencyPrefix: 'US$ ', active: true },
  { id: 'USDBRL', symbol: 'USD/BRL', name: 'Dólar Americano / Real', category: 'FOREX', provider: 'AWESOMEAPI', providerPair: 'USD-BRL', decimals: 4, currencyPrefix: 'R$ ', active: true },
  { id: 'EURBRL', symbol: 'EUR/BRL', name: 'Euro / Real', category: 'FOREX', provider: 'AWESOMEAPI', providerPair: 'EUR-BRL', decimals: 4, currencyPrefix: 'R$ ', active: true }
];

/**
 * Estrutura canônica do documento 'trade_settings/global' no Firestore
 * com valores iniciais seguros para produção.
 */
export interface CanonicalTradeSettingsGlobal {
  enabled: boolean;
  realMoneyEnabled: boolean;
  winPayoutPercent: number;
  tradeFeePercent: number;
  minimumStake: number;
  maximumStake: number;
  maximumUserExposure: number;
  maximumPlatformExposure: number;
  allowedDurations: number[];
  allowedAssets: string[];

  // Metadados adicionais e aliases de compatibilidade
  payoutPercent: number;
  platformFeePercent: number;
  minStakeCentavos: number;
  maxStakeCentavos: number;
  maxOpenPositionsPerUser: number;
  allowedDurationsSeconds: number[];
  assets: TradeAssetDefinition[];
  updatedAt: string;
  updatedBy?: string;
}

export type TradeSettingsGlobalDoc = CanonicalTradeSettingsGlobal;

/**
 * Valores iniciais seguros para produção na coleção 'trade_settings/global':
 * - enabled: true
 * - realMoneyEnabled: true
 * - winPayoutPercent: 85 (85% de retorno líquido em caso de acerto)
 * - tradeFeePercent: 0 (0% de taxa extra de abertura)
 * - minimumStake: 500 (R$ 5,00 em centavos)
 * - maximumStake: 1000000 (R$ 10.000,00 em centavos)
 * - maximumUserExposure: 2500000 (R$ 25.000,00 em posições simultâneas por usuário)
 * - maximumPlatformExposure: 20000000 (R$ 200.000,00 de exposição global máxima da plataforma)
 * - allowedDurations: [60, 300, 900, 1800, 3600] (1m, 5m, 15m, 30m, 1h)
 * - allowedAssets: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUUSDT', 'USDBRL', 'EURBRL']
 */
export const INITIAL_SAFE_TRADE_SETTINGS_GLOBAL: CanonicalTradeSettingsGlobal = {
  enabled: true,
  realMoneyEnabled: true,
  winPayoutPercent: 85,
  tradeFeePercent: 0,
  minimumStake: 500,
  maximumStake: 1000000,
  maximumUserExposure: 2500000,
  maximumPlatformExposure: 20000000,
  allowedDurations: [60, 300, 900, 1800, 3600],
  allowedAssets: INITIAL_SAFE_TRADE_ASSETS.map((a) => a.id),

  payoutPercent: 85,
  platformFeePercent: 0,
  minStakeCentavos: 500,
  maxStakeCentavos: 1000000,
  maxOpenPositionsPerUser: 10,
  allowedDurationsSeconds: [60, 300, 900, 1800, 3600],
  assets: INITIAL_SAFE_TRADE_ASSETS,
  updatedAt: new Date().toISOString()
};

let seedPromise: Promise<CanonicalTradeSettingsGlobal> | null = null;

/**
 * Garante que o documento 'trade_settings/global' exista no Firestore com todos os
 * 10 campos obrigatórios ('enabled', 'realMoneyEnabled', 'winPayoutPercent',
 * 'tradeFeePercent', 'minimumStake', 'maximumStake', 'maximumUserExposure',
 * 'maximumPlatformExposure', 'allowedDurations', 'allowedAssets') preenchidos
 * com valores seguros para produção.
 */
export async function ensureTradeSettingsGlobalSeeded(): Promise<CanonicalTradeSettingsGlobal> {
  if (!isFirebaseConfigured() || isFirestoreWriteQuotaExhausted()) {
    return INITIAL_SAFE_TRADE_SETTINGS_GLOBAL;
  }

  if (typeof window !== 'undefined') {
    try {
      const cached = sessionStorage.getItem('voxa_trade_settings_seeded_v1');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}
  }

  if (seedPromise) {
    return seedPromise;
  }

  seedPromise = (async () => {
    try {
      const globalRef = doc(db, 'trade_settings', 'global');
      const snap = await getDoc(globalRef);

      if (!snap.exists()) {
        const payload: CanonicalTradeSettingsGlobal = {
          ...INITIAL_SAFE_TRADE_SETTINGS_GLOBAL,
          updatedAt: new Date().toISOString()
        };
        await setDoc(globalRef, payload, { merge: true });
        if (typeof window !== 'undefined') {
          try { sessionStorage.setItem('voxa_trade_settings_seeded_v1', JSON.stringify(payload)); } catch {}
        }
        return payload;
      }

      const data = snap.data() || {};
      const enabled = data.enabled !== undefined ? Boolean(data.enabled) : INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.enabled;
      const realMoneyEnabled = data.realMoneyEnabled !== undefined ? Boolean(data.realMoneyEnabled) : INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.realMoneyEnabled;
      const winPayoutPercent = Number(data.winPayoutPercent ?? data.payoutPercent ?? INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.winPayoutPercent);
      const tradeFeePercent = Number(data.tradeFeePercent ?? data.platformFeePercent ?? INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.tradeFeePercent);
      const minimumStake = Number(data.minimumStake ?? data.minStakeCentavos ?? INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.minimumStake);
      const maximumStake = Number(data.maximumStake ?? data.maxStakeCentavos ?? INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.maximumStake);
      const maximumUserExposure = Number(data.maximumUserExposure ?? INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.maximumUserExposure);
      const maximumPlatformExposure = Number(data.maximumPlatformExposure ?? INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.maximumPlatformExposure);
      const maxOpenPositionsPerUser = Number(data.maxOpenPositionsPerUser ?? INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.maxOpenPositionsPerUser);

      const allowedDurations: number[] =
        Array.isArray(data.allowedDurations) && data.allowedDurations.length > 0
          ? data.allowedDurations.map(Number).filter((n: number) => !isNaN(n) && n > 0)
          : Array.isArray(data.allowedDurationsSeconds) && data.allowedDurationsSeconds.length > 0
          ? data.allowedDurationsSeconds.map(Number).filter((n: number) => !isNaN(n) && n > 0)
          : INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.allowedDurations;

      const baseAssets: TradeAssetDefinition[] =
        Array.isArray(data.assets) && data.assets.length > 0
          ? data.assets
          : INITIAL_SAFE_TRADE_ASSETS;

      const allowedAssets: string[] =
        Array.isArray(data.allowedAssets) && data.allowedAssets.length > 0
          ? data.allowedAssets.map(String)
          : baseAssets.filter((a) => a.active).map((a) => a.id);

      const syncedAssets = baseAssets.map((a) => ({
        ...a,
        active: allowedAssets.includes(a.id)
      }));

      const resolved: CanonicalTradeSettingsGlobal = {
        enabled,
        realMoneyEnabled,
        winPayoutPercent,
        tradeFeePercent,
        minimumStake,
        maximumStake,
        maximumUserExposure,
        maximumPlatformExposure,
        allowedDurations,
        allowedAssets,
        payoutPercent: winPayoutPercent,
        platformFeePercent: tradeFeePercent,
        minStakeCentavos: minimumStake,
        maxStakeCentavos: maximumStake,
        maxOpenPositionsPerUser,
        allowedDurationsSeconds: allowedDurations,
        assets: syncedAssets,
        updatedAt: data.updatedAt || new Date().toISOString(),
        ...(data.updatedBy ? { updatedBy: data.updatedBy } : {})
      };

      const needsBackfill =
        data.enabled === undefined ||
        data.realMoneyEnabled === undefined ||
        data.winPayoutPercent === undefined ||
        data.tradeFeePercent === undefined ||
        data.minimumStake === undefined ||
        data.maximumStake === undefined ||
        data.maximumUserExposure === undefined ||
        data.maximumPlatformExposure === undefined ||
        !Array.isArray(data.allowedDurations) ||
        !Array.isArray(data.allowedAssets);

      if (needsBackfill) {
        await setDoc(globalRef, resolved, { merge: true });
      }

      return resolved;
    } catch (err) {
      console.warn('[VOXA Trade] ensureTradeSettingsGlobalSeeded fallback:', err);
      return INITIAL_SAFE_TRADE_SETTINGS_GLOBAL;
    } finally {
      seedPromise = null;
    }
  })();

  return seedPromise;
}
