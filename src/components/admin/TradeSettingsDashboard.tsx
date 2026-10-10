import React, { useState, useEffect } from 'react';
import {
  Sliders,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Shield,
  DollarSign,
  Clock,
  Activity,
  RotateCcw,
  Plus,
  X
} from 'lucide-react';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { formatBRL } from '../../utils/money';
import {
  ensureTradeSettingsGlobalSeeded,
  INITIAL_SAFE_TRADE_SETTINGS_GLOBAL,
  TradeSettingsGlobalDoc
} from '../../utils/tradeDb';

const AVAILABLE_DURATIONS = [
  { seconds: 30, label: '30s' },
  { seconds: 60, label: '1m (60s)' },
  { seconds: 300, label: '5m (300s)' },
  { seconds: 900, label: '15m (900s)' },
  { seconds: 1800, label: '30m (1800s)' },
  { seconds: 3600, label: '1h (3600s)' }
];

const KNOWN_ASSETS = [
  { id: 'BTCUSDT', symbol: 'BTC/USDT', name: 'Bitcoin', category: 'CRYPTO', provider: 'BINANCE', providerPair: 'BTCUSDT', decimals: 2, currencyPrefix: 'US$ ', active: true },
  { id: 'ETHUSDT', symbol: 'ETH/USDT', name: 'Ethereum', category: 'CRYPTO', provider: 'BINANCE', providerPair: 'ETHUSDT', decimals: 2, currencyPrefix: 'US$ ', active: true },
  { id: 'SOLUSDT', symbol: 'SOL/USDT', name: 'Solana', category: 'CRYPTO', provider: 'BINANCE', providerPair: 'SOLUSDT', decimals: 2, currencyPrefix: 'US$ ', active: true },
  { id: 'XAUUSDT', symbol: 'XAU/USDT', name: 'Ouro (PAXG/Ouro Spot)', category: 'COMMODITIES', provider: 'BINANCE', providerPair: 'PAXGUSDT', decimals: 2, currencyPrefix: 'US$ ', active: true },
  { id: 'USDBRL', symbol: 'USD/BRL', name: 'Dólar Americano / Real', category: 'FOREX', provider: 'AWESOMEAPI', providerPair: 'USD-BRL', decimals: 4, currencyPrefix: 'R$ ', active: true },
  { id: 'EURBRL', symbol: 'EUR/BRL', name: 'Euro / Real', category: 'FOREX', provider: 'AWESOMEAPI', providerPair: 'EUR-BRL', decimals: 4, currencyPrefix: 'R$ ', active: true }
];

export interface TradeSettingsDashboardProps {
  onBackToMenu?: () => void;
  currentUser?: any;
  adminRole?: 'SUPER_ADMIN' | 'ADMINISTRATOR' | 'MANAGER' | 'SUPPORT' | 'NONE';
  embedded?: boolean;
}

export const TradeSettingsDashboard: React.FC<TradeSettingsDashboardProps> = ({
  onBackToMenu,
  currentUser,
  adminRole = 'SUPER_ADMIN',
  embedded = false
}) => {
  // Core 10 fields from trade_settings/global
  const [enabled, setEnabled] = useState<boolean>(INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.enabled);
  const [realMoneyEnabled, setRealMoneyEnabled] = useState<boolean>(INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.realMoneyEnabled);
  const [winPayoutPercent, setWinPayoutPercent] = useState<string>(String(INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.winPayoutPercent));
  const [tradeFeePercent, setTradeFeePercent] = useState<string>(String(INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.tradeFeePercent));
  const [minimumStakeReais, setMinimumStakeReais] = useState<string>(
    (INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.minimumStake / 100).toFixed(2)
  );
  const [maximumStakeReais, setMaximumStakeReais] = useState<string>(
    (INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.maximumStake / 100).toFixed(2)
  );
  const [maximumUserExposureReais, setMaximumUserExposureReais] = useState<string>(
    (INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.maximumUserExposure / 100).toFixed(2)
  );
  const [maximumPlatformExposureReais, setMaximumPlatformExposureReais] = useState<string>(
    (INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.maximumPlatformExposure / 100).toFixed(2)
  );
  const [allowedDurations, setAllowedDurations] = useState<number[]>(
    INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.allowedDurations
  );
  const [allowedAssets, setAllowedAssets] = useState<string[]>(
    INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.allowedAssets
  );

  // Additional custom duration / asset inputs
  const [customDurationInput, setCustomDurationInput] = useState<string>('');
  const [customAssetInput, setCustomAssetInput] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastUpdatedMeta, setLastUpdatedMeta] = useState<{ updatedAt?: string; updatedBy?: string }>({});

  const adminUid = currentUser?.uid || currentUser?.id || 'admin';

  const applyDocToForm = (data: Partial<TradeSettingsGlobalDoc> & Record<string, any>) => {
    if (!data) return;
    setEnabled(data.enabled !== undefined ? Boolean(data.enabled) : true);
    setRealMoneyEnabled(data.realMoneyEnabled !== undefined ? Boolean(data.realMoneyEnabled) : true);
    setWinPayoutPercent(String(data.winPayoutPercent ?? data.payoutPercent ?? 85));
    setTradeFeePercent(String(data.tradeFeePercent ?? data.platformFeePercent ?? 0));

    const minCentavos = Number(data.minimumStake ?? data.minStakeCentavos ?? 500);
    const maxCentavos = Number(data.maximumStake ?? data.maxStakeCentavos ?? 1000000);
    const maxUserExpCentavos = Number(data.maximumUserExposure ?? 2500000);
    const maxPlatExpCentavos = Number(data.maximumPlatformExposure ?? 20000000);

    setMinimumStakeReais((minCentavos / 100).toFixed(2));
    setMaximumStakeReais((maxCentavos / 100).toFixed(2));
    setMaximumUserExposureReais((maxUserExpCentavos / 100).toFixed(2));
    setMaximumPlatformExposureReais((maxPlatExpCentavos / 100).toFixed(2));

    const rawDurations = Array.isArray(data.allowedDurations)
      ? data.allowedDurations
      : Array.isArray(data.allowedDurationsSeconds)
        ? data.allowedDurationsSeconds
        : INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.allowedDurations;
    setAllowedDurations(
      rawDurations
        .map((n: any) => Math.round(Number(n)))
        .filter((n: number) => Number.isFinite(n) && n >= 10)
        .sort((a: number, b: number) => a - b)
    );

    const rawAssets = Array.isArray(data.allowedAssets)
      ? data.allowedAssets
      : Array.isArray(data.assets)
        ? data.assets.filter((a: any) => a.active !== false).map((a: any) => String(a.id))
        : INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.allowedAssets;
    setAllowedAssets(
      rawAssets
        .map((s: any) => String(s || '').trim().toUpperCase())
        .filter(Boolean)
    );

    setLastUpdatedMeta({
      updatedAt: data.updatedAt,
      updatedBy: data.updatedBy
    });
  };

  const fetchSettingsFromFirestore = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      if (!isFirebaseConfigured()) {
        applyDocToForm(INITIAL_SAFE_TRADE_SETTINGS_GLOBAL);
        return;
      }
      const ref = doc(db, 'trade_settings', 'global');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        applyDocToForm(snap.data() as any);
      } else {
        const seeded = await ensureTradeSettingsGlobalSeeded();
        applyDocToForm(seeded);
      }
    } catch {
      try {
        const res = await fetch(`/api/trade/admin/overview?adminUid=${encodeURIComponent(adminUid)}`);
        const json = await res.json();
        if (res.ok && json.settings) {
          applyDocToForm(json.settings);
        }
      } catch {
        setFeedback({
          type: 'error',
          text: 'Não foi possível carregar trade_settings/global do Firestore.'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsFromFirestore();

    if (!isFirebaseConfigured()) return;
    const unsub = onSnapshot(
      doc(db, 'trade_settings', 'global'),
      (snap) => {
        if (snap.exists()) {
          applyDocToForm(snap.data() as any);
          setLoading(false);
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  if (adminRole !== 'SUPER_ADMIN' && adminRole !== 'ADMINISTRATOR') {
    return (
      <div className="bg-white rounded-3xl border border-red-200 p-8 sm:p-12 max-w-md mx-auto text-center space-y-5 shadow-xl text-black my-8">
        <span className="font-orbitron text-red-500 text-5xl block">⚠️</span>
        <h2 className="font-orbitron font-black text-xl sm:text-2xl text-black uppercase">
          Acesso Restrito
        </h2>
        <p className="text-xs text-gray-600 font-sans leading-relaxed">
          O painel Trade Settings (`trade_settings/global`) é restrito a Super Administradores e Administradores.
        </p>
        {onBackToMenu && (
          <button
            onClick={onBackToMenu}
            className="bg-black text-white font-orbitron font-bold text-xs py-3 px-6 rounded-xl cursor-pointer uppercase"
          >
            Voltar ao Menu
          </button>
        )}
      </div>
    );
  }

  const toggleDuration = (sec: number) => {
    setAllowedDurations((prev) => {
      if (prev.includes(sec)) {
        if (prev.length <= 1) return prev; // Keep at least 1 duration active
        return prev.filter((d) => d !== sec);
      }
      return [...prev, sec].sort((a, b) => a - b);
    });
  };

  const handleAddCustomDuration = () => {
    const val = Math.round(Number(customDurationInput));
    if (!Number.isFinite(val) || val < 10 || val > 86400) return;
    if (!allowedDurations.includes(val)) {
      setAllowedDurations((prev) => [...prev, val].sort((a, b) => a - b));
    }
    setCustomDurationInput('');
  };

  const toggleAsset = (assetId: string) => {
    const normalized = assetId.trim().toUpperCase();
    setAllowedAssets((prev) => {
      if (prev.includes(normalized)) {
        if (prev.length <= 1) return prev; // Keep at least 1 asset active
        return prev.filter((id) => id !== normalized);
      }
      return [...prev, normalized];
    });
  };

  const handleAddCustomAsset = () => {
    const normalized = customAssetInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!normalized) return;
    if (!allowedAssets.includes(normalized)) {
      setAllowedAssets((prev) => [...prev, normalized]);
    }
    setCustomAssetInput('');
  };

  const handleQuickToggle = async (field: 'enabled' | 'realMoneyEnabled', nextVal: boolean) => {
    if (field === 'enabled') setEnabled(nextVal);
    if (field === 'realMoneyEnabled') setRealMoneyEnabled(nextVal);
    try {
      const nowIso = new Date().toISOString();
      await setDoc(
        doc(db, 'trade_settings', 'global'),
        {
          [field]: nextVal,
          updatedAt: nowIso,
          updatedBy: adminUid
        },
        { merge: true }
      );
      setFeedback({
        type: 'success',
        text: `Campo '${field}' atualizado para ${nextVal ? 'true' : 'false'} em trade_settings/global.`
      });
    } catch {
      setFeedback({
        type: 'error',
        text: `Erro ao atualizar '${field}' em trade_settings/global.`
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const parsedWinPayout = Math.max(1, Math.min(100, Number(winPayoutPercent) || 85));
    const parsedTradeFee = Math.max(0, Math.min(25, Number(tradeFeePercent) || 0));
    const minimumStake = Math.max(100, Math.round((Number(minimumStakeReais) || 5) * 100));
    const maximumStake = Math.max(minimumStake, Math.round((Number(maximumStakeReais) || 10000) * 100));
    const maximumUserExposure = Math.max(maximumStake, Math.round((Number(maximumUserExposureReais) || 25000) * 100));
    const maximumPlatformExposure = Math.max(
      maximumUserExposure,
      Math.round((Number(maximumPlatformExposureReais) || 200000) * 100)
    );
    const cleanDurations =
      allowedDurations.length > 0 ? allowedDurations : INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.allowedDurations;
    const cleanAssets =
      allowedAssets.length > 0 ? allowedAssets : INITIAL_SAFE_TRADE_SETTINGS_GLOBAL.allowedAssets;

    const syncedAssetsMeta = KNOWN_ASSETS.map((a) => ({
      ...a,
      active: cleanAssets.includes(a.id)
    }));

    const nowIso = new Date().toISOString();
    const payload = {
      enabled,
      realMoneyEnabled,
      winPayoutPercent: parsedWinPayout,
      payoutPercent: parsedWinPayout,
      tradeFeePercent: parsedTradeFee,
      platformFeePercent: parsedTradeFee,
      minimumStake,
      minStakeCentavos: minimumStake,
      maximumStake,
      maxStakeCentavos: maximumStake,
      maximumUserExposure,
      maximumPlatformExposure,
      allowedDurations: cleanDurations,
      allowedDurationsSeconds: cleanDurations,
      allowedAssets: cleanAssets,
      assets: syncedAssetsMeta,
      updatedAt: nowIso,
      updatedBy: adminUid
    };

    try {
      // Save directly to Firestore trade_settings/global
      if (isFirebaseConfigured()) {
        await setDoc(doc(db, 'trade_settings', 'global'), payload, { merge: true });
      }

      // Also notify backend endpoint if available
      try {
        await fetch('/api/trade/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminUid,
            enabled,
            realMoneyEnabled,
            winPayoutPercent: parsedWinPayout,
            payoutPercent: parsedWinPayout,
            tradeFeePercent: parsedTradeFee,
            platformFeePercent: parsedTradeFee,
            minimumStake,
            minStakeCentavos: minimumStake,
            maximumStake,
            maxStakeCentavos: maximumStake,
            maximumUserExposure,
            maximumPlatformExposure,
            allowedDurations: cleanDurations,
            allowedDurationsSeconds: cleanDurations,
            allowedAssets: cleanAssets,
            assets: syncedAssetsMeta
          })
        });
      } catch {
        // Firestore setDoc already persisted
      }

      setFeedback({
        type: 'success',
        text: 'Configurações salvas com sucesso em trade_settings/global!'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Erro ao salvar configurações em trade_settings/global.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const nowIso = new Date().toISOString();
      const safeDoc = {
        ...INITIAL_SAFE_TRADE_SETTINGS_GLOBAL,
        updatedAt: nowIso,
        updatedBy: adminUid
      };
      if (isFirebaseConfigured()) {
        await setDoc(doc(db, 'trade_settings', 'global'), safeDoc, { merge: true });
      }
      applyDocToForm(safeDoc);
      setFeedback({
        type: 'success',
        text: 'Padrões seguros de produção restaurados em trade_settings/global!'
      });
    } catch {
      setFeedback({
        type: 'error',
        text: 'Falha ao restaurar padrões seguros.'
      });
    } finally {
      setSaving(false);
    }
  };

  // Live preview calculation for R$ 100.00 stake
  const sampleStakeCentavos = 10000;
  const sampleFeeCentavos = Math.round(sampleStakeCentavos * ((Number(tradeFeePercent) || 0) / 100));
  const sampleWinProfitCentavos = Math.round(sampleStakeCentavos * ((Number(winPayoutPercent) || 85) / 100));
  const sampleTotalReturnCentavos = sampleStakeCentavos + sampleWinProfitCentavos - sampleFeeCentavos;

  return (
    <div className={embedded ? 'space-y-6 text-black' : 'p-4 sm:p-6 space-y-6 text-black'}>
      {/* Header */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3">
            {onBackToMenu && (
              <button
                onClick={onBackToMenu}
                className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-[#FF0033]" />
                <h1 className="font-orbitron font-black text-lg sm:text-xl text-black uppercase tracking-wider">
                  Trade Settings Dashboard
                </h1>
                <span
                  className={`px-2.5 py-0.5 text-[10px] font-orbitron font-bold rounded-full uppercase ${
                    enabled && realMoneyEnabled
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {enabled && realMoneyEnabled ? 'OPERACIONAL' : 'PAUSADO'}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-sans mt-0.5">
                Gerenciamento direto da coleção Firestore <code className="font-mono text-gray-700">trade_settings/global</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={saving || loading}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron font-bold text-[10px] uppercase cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrões</span>
            </button>
            <button
              type="button"
              onClick={fetchSettingsFromFirestore}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron font-bold text-[10px] uppercase cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sincronizar</span>
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center space-x-2 text-xs font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-bold underline ml-4 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="bg-white rounded-3xl border border-gray-200 shadow-sm p-5 sm:p-8 space-y-8"
      >
        {/* Top Metadata Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-[#FF0033]" />
              <h2 className="font-orbitron font-black text-sm sm:text-base text-black uppercase">
                Documento Firestore: trade_settings/global
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Todos os 10 parâmetros abaixo são validados em cada abertura de operação no VOXA Trade.
              {lastUpdatedMeta.updatedAt && (
                <span className="ml-2 text-gray-400">
                  • Última atualização: {new Date(lastUpdatedMeta.updatedAt).toLocaleString('pt-BR')}
                </span>
              )}
            </p>
          </div>
          {embedded && (
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={saving}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron font-bold text-[10px] uppercase cursor-pointer self-start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Padrões Seguros</span>
            </button>
          )}
        </div>

        {/* 1. STATUS TOGGLES: enabled & realMoneyEnabled */}
        <div className="space-y-3">
          <h3 className="font-orbitron font-bold text-xs uppercase text-gray-700 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#FF0033]" />
            <span>1. Status Operacional da Plataforma</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* enabled */}
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between transition-colors ${
                enabled ? 'bg-emerald-50/60 border-emerald-200' : 'bg-red-50/60 border-red-200'
              }`}
            >
              <div className="pr-4">
                <div className="flex items-center gap-2">
                  <span className="font-orbitron font-bold text-xs text-black uppercase">
                    Módulo VOXA Trade Ativo
                  </span>
                  <code className="text-[10px] font-mono bg-white/80 px-1.5 py-0.5 rounded border border-gray-200 text-gray-600">
                    enabled
                  </code>
                </div>
                <p className="text-[11px] text-gray-600 mt-1">
                  Habilita ou bloqueia globalmente o acesso e novas ordens no módulo VOXA Trade.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => handleQuickToggle('enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* realMoneyEnabled */}
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between transition-colors ${
                realMoneyEnabled ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'
              }`}
            >
              <div className="pr-4">
                <div className="flex items-center gap-2">
                  <span className="font-orbitron font-bold text-xs text-black uppercase">
                    Operações com Saldo Real
                  </span>
                  <code className="text-[10px] font-mono bg-white/80 px-1.5 py-0.5 rounded border border-gray-200 text-gray-600">
                    realMoneyEnabled
                  </code>
                </div>
                <p className="text-[11px] text-gray-600 mt-1">
                  Permite débito e liquidação financeira em saldo real da carteira principal (`wallets`).
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={realMoneyEnabled}
                  onChange={(e) => handleQuickToggle('realMoneyEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* 2. PAYOUT & FEE CONTROLS: winPayoutPercent & tradeFeePercent */}
        <div className="space-y-3">
          <h3 className="font-orbitron font-bold text-xs uppercase text-gray-700 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#FF0033]" />
            <span>2. Percentuais de Payout & Taxa Operacional</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* winPayoutPercent */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-orbitron font-bold text-gray-600 uppercase">
                  Payout de Vitória (%)
                </label>
                <code className="text-[10px] font-mono text-gray-500">winPayoutPercent</code>
              </div>
              <input
                type="number"
                step="1"
                min="1"
                max="100"
                value={winPayoutPercent}
                onChange={(e) => setWinPayoutPercent(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white font-orbitron font-bold text-sm text-black"
              />
              <input
                type="range"
                min="50"
                max="98"
                value={Math.min(98, Math.max(50, Number(winPayoutPercent) || 85))}
                onChange={(e) => setWinPayoutPercent(e.target.value)}
                className="w-full mt-2 accent-[#FF0033] cursor-pointer"
              />
            </div>

            {/* tradeFeePercent */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-orbitron font-bold text-gray-600 uppercase">
                  Taxa por Operação (%)
                </label>
                <code className="text-[10px] font-mono text-gray-500">tradeFeePercent</code>
              </div>
              <input
                type="number"
                step="0.1"
                min="0"
                max="25"
                value={tradeFeePercent}
                onChange={(e) => setTradeFeePercent(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white font-orbitron font-bold text-sm text-black"
              />
              <p className="text-[10px] text-gray-500 mt-2">
                0% = isento de taxa extra na abertura da ordem.
              </p>
            </div>

            {/* Simulation Preview */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-orbitron font-bold text-emerald-800 uppercase">
                  Simulação (Ordem de R$ 100,00)
                </p>
                <p className="text-lg font-orbitron font-black text-emerald-700 mt-1">
                  Retorno: {formatBRL(sampleTotalReturnCentavos)}
                </p>
              </div>
              <div className="text-[11px] text-emerald-700 space-y-0.5 mt-2">
                <p>Lucro Líquido (WON): +{formatBRL(sampleWinProfitCentavos)}</p>
                <p>Taxa Retida: {formatBRL(sampleFeeCentavos)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. STAKE & EXPOSURE LIMITS: minimumStake, maximumStake, maximumUserExposure, maximumPlatformExposure */}
        <div className="space-y-3">
          <h3 className="font-orbitron font-bold text-xs uppercase text-gray-700 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#FF0033]" />
            <span>3. Limites de Stake & Exposição de Risco (Armazenados em Centavos)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* minimumStake */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-orbitron font-bold text-gray-600 uppercase">
                  Stake Mínimo (R$)
                </label>
                <code className="text-[10px] font-mono text-gray-500">minimumStake</code>
              </div>
              <input
                type="number"
                step="0.50"
                min="1"
                value={minimumStakeReais}
                onChange={(e) => setMinimumStakeReais(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white font-orbitron font-bold text-sm text-black"
              />
              <p className="text-[10px] text-gray-500 mt-1.5 font-mono">
                = {Math.round((Number(minimumStakeReais) || 0) * 100).toLocaleString('pt-BR')} centavos
              </p>
            </div>

            {/* maximumStake */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-orbitron font-bold text-gray-600 uppercase">
                  Stake Máximo (R$)
                </label>
                <code className="text-[10px] font-mono text-gray-500">maximumStake</code>
              </div>
              <input
                type="number"
                step="10"
                min="1"
                value={maximumStakeReais}
                onChange={(e) => setMaximumStakeReais(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white font-orbitron font-bold text-sm text-black"
              />
              <p className="text-[10px] text-gray-500 mt-1.5 font-mono">
                = {Math.round((Number(maximumStakeReais) || 0) * 100).toLocaleString('pt-BR')} centavos
              </p>
            </div>

            {/* maximumUserExposure */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-orbitron font-bold text-gray-600 uppercase">
                  Exposição Máx. Usuário (R$)
                </label>
                <code className="text-[10px] font-mono text-gray-500">maximumUserExposure</code>
              </div>
              <input
                type="number"
                step="100"
                min="10"
                value={maximumUserExposureReais}
                onChange={(e) => setMaximumUserExposureReais(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white font-orbitron font-bold text-sm text-black"
              />
              <p className="text-[10px] text-gray-500 mt-1.5 font-mono">
                = {Math.round((Number(maximumUserExposureReais) || 0) * 100).toLocaleString('pt-BR')} centavos
              </p>
            </div>

            {/* maximumPlatformExposure */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-orbitron font-bold text-gray-600 uppercase">
                  Exposição Máx. Plataforma (R$)
                </label>
                <code className="text-[10px] font-mono text-gray-500">maximumPlatformExposure</code>
              </div>
              <input
                type="number"
                step="500"
                min="100"
                value={maximumPlatformExposureReais}
                onChange={(e) => setMaximumPlatformExposureReais(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white font-orbitron font-bold text-sm text-black"
              />
              <p className="text-[10px] text-gray-500 mt-1.5 font-mono">
                = {Math.round((Number(maximumPlatformExposureReais) || 0) * 100).toLocaleString('pt-BR')} centavos
              </p>
            </div>
          </div>
        </div>

        {/* 4. ALLOWED DURATIONS: allowedDurations */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-orbitron font-bold text-xs uppercase text-gray-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FF0033]" />
              <span>4. Tempos de Expiração Permitidos</span>
              <code className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                allowedDurations
              </code>
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="10"
                max="86400"
                placeholder="Segundos (ex: 120)"
                value={customDurationInput}
                onChange={(e) => setCustomDurationInput(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-gray-300 text-xs font-mono w-36"
              />
              <button
                type="button"
                onClick={handleAddCustomDuration}
                className="px-3 py-1.5 rounded-xl bg-gray-900 text-white font-orbitron font-bold text-[10px] uppercase flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Adicionar</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {AVAILABLE_DURATIONS.map((d) => {
              const isSelected = allowedDurations.includes(d.seconds);
              return (
                <button
                  key={d.seconds}
                  type="button"
                  onClick={() => toggleDuration(d.seconds)}
                  className={`px-4 py-2.5 rounded-xl font-orbitron font-bold text-xs border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-black text-white border-black shadow-sm'
                      : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}

            {/* Render any custom durations not in preset list */}
            {allowedDurations
              .filter((sec) => !AVAILABLE_DURATIONS.some((d) => d.seconds === sec))
              .map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => toggleDuration(sec)}
                  className="px-3.5 py-2.5 rounded-xl font-orbitron font-bold text-xs border bg-black text-white border-black flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{sec}s</span>
                  <X className="w-3 h-3 text-gray-300" />
                </button>
              ))}
          </div>
        </div>

        {/* 5. ALLOWED ASSETS: allowedAssets */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-orbitron font-bold text-xs uppercase text-gray-700 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#FF0033]" />
              <span>5. Ativos de Mercado Permitidos</span>
              <code className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                allowedAssets
              </code>
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Novo ativo (ex: BNBUSDT)"
                value={customAssetInput}
                onChange={(e) => setCustomAssetInput(e.target.value.toUpperCase())}
                className="px-3 py-1.5 rounded-xl border border-gray-300 text-xs font-mono w-44 uppercase"
              />
              <button
                type="button"
                onClick={handleAddCustomAsset}
                className="px-3 py-1.5 rounded-xl bg-gray-900 text-white font-orbitron font-bold text-[10px] uppercase flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Adicionar</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {KNOWN_ASSETS.map((asset) => {
              const isAllowed = allowedAssets.includes(asset.id);
              return (
                <div
                  key={asset.id}
                  onClick={() => toggleAsset(asset.id)}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                    isAllowed
                      ? 'bg-emerald-50/50 border-emerald-300'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-orbitron font-black text-xs text-black">{asset.symbol}</span>
                      <span className="text-[9px] font-orbitron font-bold px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                        {asset.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {asset.name} • ID: <code className="font-mono">{asset.id}</code>
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isAllowed}
                    onChange={() => {}}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>
              );
            })}

            {/* Custom asset IDs not in KNOWN_ASSETS */}
            {allowedAssets
              .filter((id) => !KNOWN_ASSETS.some((k) => k.id === id))
              .map((id) => (
                <div
                  key={id}
                  onClick={() => toggleAsset(id)}
                  className="p-3.5 rounded-2xl border bg-emerald-50/50 border-emerald-300 flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <span className="font-orbitron font-black text-xs text-black">{id}</span>
                    <p className="text-[11px] text-gray-500 mt-0.5">Ativo Personalizado</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={() => {}}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </div>
              ))}
          </div>
        </div>

        {/* Submit Footer */}
        <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-gray-500 font-mono">
            Ativos ativos ({allowedAssets.length}): {allowedAssets.join(', ')} | Durações ({allowedDurations.length}):{' '}
            {allowedDurations.map((s) => `${s}s`).join(', ')}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3.5 rounded-2xl bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Salvando em trade_settings/global...' : 'Salvar em trade_settings/global'}
          </button>
        </div>
      </form>
    </div>
  );
};
