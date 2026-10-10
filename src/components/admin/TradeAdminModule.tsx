import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Settings,
  Activity,
  DollarSign,
  Clock,
  XCircle,
  Shield,
  Sliders,
  RotateCcw
} from 'lucide-react';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { formatBRL } from '../../utils/money';
import { ensureTradeSettingsGlobalSeeded, INITIAL_SAFE_TRADE_SETTINGS_GLOBAL } from '../../utils/tradeDb';
import { TradeSettingsDashboard } from './TradeSettingsDashboard';

const DEFAULT_ADMIN_TRADE_ASSETS = [
  { id: 'BTCUSDT', symbol: 'BTC/USDT', name: 'Bitcoin', category: 'CRYPTO', provider: 'BINANCE', providerPair: 'BTCUSDT', decimals: 2, currencyPrefix: 'US$ ', active: true },
  { id: 'ETHUSDT', symbol: 'ETH/USDT', name: 'Ethereum', category: 'CRYPTO', provider: 'BINANCE', providerPair: 'ETHUSDT', decimals: 2, currencyPrefix: 'US$ ', active: true },
  { id: 'SOLUSDT', symbol: 'SOL/USDT', name: 'Solana', category: 'CRYPTO', provider: 'BINANCE', providerPair: 'SOLUSDT', decimals: 2, currencyPrefix: 'US$ ', active: true },
  { id: 'XAUUSDT', symbol: 'XAU/USDT', name: 'Ouro (PAXG/Ouro Spot)', category: 'COMMODITIES', provider: 'BINANCE', providerPair: 'PAXGUSDT', decimals: 2, currencyPrefix: 'US$ ', active: true },
  { id: 'USDBRL', symbol: 'USD/BRL', name: 'Dólar Americano / Real', category: 'FOREX', provider: 'AWESOMEAPI', providerPair: 'USD-BRL', decimals: 4, currencyPrefix: 'R$ ', active: true },
  { id: 'EURBRL', symbol: 'EUR/BRL', name: 'Euro / Real', category: 'FOREX', provider: 'AWESOMEAPI', providerPair: 'EUR-BRL', decimals: 4, currencyPrefix: 'R$ ', active: true }
];

interface TradeAdminModuleProps {
  onBackToMenu: () => void;
  currentUser: any;
  adminRole: 'SUPER_ADMIN' | 'ADMINISTRATOR' | 'MANAGER' | 'SUPPORT' | 'NONE';
  initialTab?: 'overview' | 'positions' | 'settings';
}

export const TradeAdminModule: React.FC<TradeAdminModuleProps> = ({
  onBackToMenu,
  currentUser,
  adminRole,
  initialTab = 'overview'
}) => {
  if (adminRole !== 'SUPER_ADMIN' && adminRole !== 'ADMINISTRATOR') {
    return (
      <div className="bg-white rounded-3xl border border-red-200 p-8 sm:p-12 max-w-md mx-auto text-center space-y-5 shadow-xl text-black my-8">
        <span className="font-orbitron text-red-500 text-5xl block">⚠️</span>
        <h2 className="font-orbitron font-black text-xl sm:text-2xl text-black uppercase">
          Acesso Restrito
        </h2>
        <p className="text-xs text-gray-600 font-sans leading-relaxed">
          O módulo administrativo do VOXA Trade envolve parâmetros financeiros sensíveis e está restrito a Administradores.
        </p>
        <button
          onClick={onBackToMenu}
          className="bg-black text-white font-orbitron font-bold text-xs py-3 px-6 rounded-xl cursor-pointer uppercase"
        >
          Voltar ao Menu
        </button>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'overview' | 'positions' | 'settings'>(initialTab);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastUpdatedMeta, setLastUpdatedMeta] = useState<{ updatedAt?: string; updatedBy?: string }>({});

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [metrics, setMetrics] = useState({
    totalPositions: 0,
    openCount: 0,
    wonCount: 0,
    lostCount: 0,
    drawCount: 0,
    totalVolumeCentavos: 0,
    openExposureCentavos: 0,
    platformNetResultCentavos: 0
  });

  const [positions, setPositions] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Settings form state
  const [enabled, setEnabled] = useState<boolean>(true);
  const [realMoneyEnabled, setRealMoneyEnabled] = useState<boolean>(true);
  const [payoutPercent, setPayoutPercent] = useState<string>('85');
  const [platformFeePercent, setPlatformFeePercent] = useState<string>('0');
  const [minStakeReais, setMinStakeReais] = useState<string>('5');
  const [maxStakeReais, setMaxStakeReais] = useState<string>('10000');
  const [maxUserExposureReais, setMaxUserExposureReais] = useState<string>('25000');
  const [maxPlatformExposureReais, setMaxPlatformExposureReais] = useState<string>('200000');
  const [maxOpenPositions, setMaxOpenPositions] = useState<string>('10');
  const [allowedDurations, setAllowedDurations] = useState<number[]>([60, 300, 900, 1800, 3600]);
  const [assetsConfig, setAssetsConfig] = useState<any[]>(DEFAULT_ADMIN_TRADE_ASSETS);

  const adminUid = currentUser?.uid || currentUser?.id || '';

  const applySettingsToState = (s: any) => {
    if (!s) return;
    setEnabled(s.enabled !== undefined ? Boolean(s.enabled) : true);
    setRealMoneyEnabled(s.realMoneyEnabled !== undefined ? Boolean(s.realMoneyEnabled) : true);
    setPayoutPercent(String(s.winPayoutPercent ?? s.payoutPercent ?? 85));
    setPlatformFeePercent(String(s.tradeFeePercent ?? s.platformFeePercent ?? 0));
    setMinStakeReais(String((Number(s.minimumStake ?? s.minStakeCentavos ?? 500) / 100).toFixed(2)));
    setMaxStakeReais(String((Number(s.maximumStake ?? s.maxStakeCentavos ?? 1000000) / 100).toFixed(2)));
    setMaxUserExposureReais(String((Number(s.maximumUserExposure ?? 2500000) / 100).toFixed(2)));
    setMaxPlatformExposureReais(String((Number(s.maximumPlatformExposure ?? 20000000) / 100).toFixed(2)));
    setMaxOpenPositions(String(s.maxOpenPositionsPerUser ?? 10));
    setLastUpdatedMeta({
      updatedAt: s.updatedAt,
      updatedBy: s.updatedBy
    });
    const durations = s.allowedDurations ?? s.allowedDurationsSeconds;
    if (Array.isArray(durations) && durations.length > 0) {
      setAllowedDurations(durations.map(Number));
    }
    if (Array.isArray(s.assets) && s.assets.length > 0) {
      const allowedList = Array.isArray(s.allowedAssets) ? s.allowedAssets : null;
      setAssetsConfig(
        s.assets.map((a: any) => ({
          ...a,
          active: allowedList ? allowedList.includes(a.id) : Boolean(a.active)
        }))
      );
    } else if (Array.isArray(s.allowedAssets)) {
      setAssetsConfig(
        DEFAULT_ADMIN_TRADE_ASSETS.map(a => ({
          ...a,
          active: s.allowedAssets.includes(a.id)
        }))
      );
    }
  };

  // Real-time listener on trade_settings/global so any changes sync live across admin sessions
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = onSnapshot(
      doc(db, 'trade_settings', 'global'),
      (snap) => {
        if (snap.exists()) {
          applySettingsToState(snap.data());
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  const handleQuickToggleStatus = async (field: 'enabled' | 'realMoneyEnabled', nextValue: boolean) => {
    if (field === 'enabled') setEnabled(nextValue);
    if (field === 'realMoneyEnabled') setRealMoneyEnabled(nextValue);

    try {
      const nowIso = new Date().toISOString();
      await setDoc(
        doc(db, 'trade_settings', 'global'),
        {
          [field]: nextValue,
          updatedAt: nowIso,
          updatedBy: adminUid || 'admin'
        },
        { merge: true }
      );
      setFeedback({
        type: 'success',
        text:
          field === 'enabled'
            ? `Status da plataforma VOXA Trade atualizado para ${nextValue ? 'ATIVO' : 'PAUSADO'} em trade_settings/global.`
            : `Modo de Saldo Real atualizado para ${nextValue ? 'ATIVO' : 'PAUSADO'} em trade_settings/global.`
      });
    } catch {
      setFeedback({ type: 'error', text: 'Não foi possível atualizar o status em tempo real.' });
    }
  };

  const handleResetSafeDefaults = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const nowIso = new Date().toISOString();
      const safePayload = {
        ...INITIAL_SAFE_TRADE_SETTINGS_GLOBAL,
        updatedAt: nowIso,
        updatedBy: adminUid || 'admin'
      };
      await setDoc(doc(db, 'trade_settings', 'global'), safePayload, { merge: true });
      applySettingsToState(safePayload);
      setFeedback({
        type: 'success',
        text: 'Valores padrão seguros de produção restaurados em trade_settings/global!'
      });
    } catch {
      setFeedback({ type: 'error', text: 'Falha ao restaurar padrões seguros.' });
    } finally {
      setSaving(false);
    }
  };

  const loadFromFirestoreFallback = async () => {
    try {
      const seededSettings = await ensureTradeSettingsGlobalSeeded();
      applySettingsToState(seededSettings);

      const posSnap = await getDocs(collection(db, 'trade_positions'));
      const posList: any[] = [];
      let totalVolumeCentavos = 0;
      let openExposureCentavos = 0;
      let wonCount = 0;
      let lostCount = 0;
      let drawCount = 0;
      let openCount = 0;
      let platformNetResultCentavos = 0;

      posSnap.forEach(d => {
        const pData: any = d.data() || {};
        posList.push({ id: d.id, ...pData });
        const stake = Number(pData.stakeAmount || 0);
        totalVolumeCentavos += stake;
        if (pData.status === 'OPEN' || pData.status === 'SETTLING') {
          openCount++;
          openExposureCentavos += stake;
        } else if (pData.status === 'WON') {
          wonCount++;
          platformNetResultCentavos -= Number(pData.netResult || 0);
        } else if (pData.status === 'LOST') {
          lostCount++;
          platformNetResultCentavos += stake;
        } else if (pData.status === 'DRAW') {
          drawCount++;
        }
      });

      posList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setPositions(posList);
      setMetrics({
        totalPositions: posList.length,
        openCount,
        wonCount,
        lostCount,
        drawCount,
        totalVolumeCentavos,
        openExposureCentavos,
        platformNetResultCentavos
      });
    } catch (fbErr) {
      console.warn('[TradeAdminModule] Firestore fallback warning:', fbErr);
    }
  };

  const loadAdminTradeData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/trade/overview?adminUid=${encodeURIComponent(adminUid)}`, {
        headers: { 'x-admin-uid': adminUid }
      });
      if (!res.ok) {
        await loadFromFirestoreFallback();
        return;
      }
      const data = await res.json();
      if (data.success) {
        if (data.metrics) setMetrics(data.metrics);
        if (Array.isArray(data.positions)) setPositions(data.positions);
        if (data.settings) {
          applySettingsToState(data.settings);
        }
      } else {
        await loadFromFirestoreFallback();
      }
    } catch {
      await loadFromFirestoreFallback();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminTradeData();
  }, []);

  const handleToggleDuration = (sec: number) => {
    setAllowedDurations(prev => {
      if (prev.includes(sec)) {
        if (prev.length <= 1) return prev;
        return prev.filter(s => s !== sec);
      }
      return [...prev, sec].sort((a, b) => a - b);
    });
  };

  const handleToggleAsset = (assetId: string) => {
    setAssetsConfig(prev =>
      prev.map(a => (a.id === assetId ? { ...a, active: !a.active } : a))
    );
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    const minimumStake = Math.max(100, Math.round(parseFloat(minStakeReais.replace(',', '.')) * 100));
    const maximumStake = Math.max(minimumStake, Math.round(parseFloat(maxStakeReais.replace(',', '.')) * 100));
    const maximumUserExposure = Math.max(minimumStake, Math.round(parseFloat(maxUserExposureReais.replace(',', '.')) * 100));
    const maximumPlatformExposure = Math.max(maximumUserExposure, Math.round(parseFloat(maxPlatformExposureReais.replace(',', '.')) * 100));
    const allowedAssets = assetsConfig.filter(a => a.active).map(a => a.id);
    const nowIso = new Date().toISOString();

    const payload = {
      adminUid,
      enabled,
      realMoneyEnabled,
      winPayoutPercent: parseFloat(payoutPercent),
      tradeFeePercent: parseFloat(platformFeePercent),
      minimumStake,
      maximumStake,
      maximumUserExposure,
      maximumPlatformExposure,
      allowedDurations,
      allowedAssets,
      payoutPercent: parseFloat(payoutPercent),
      platformFeePercent: parseFloat(platformFeePercent),
      minStakeCentavos: minimumStake,
      maxStakeCentavos: maximumStake,
      maxOpenPositionsPerUser: parseInt(maxOpenPositions, 10) || 10,
      allowedDurationsSeconds: allowedDurations,
      assets: assetsConfig,
      updatedAt: nowIso,
      updatedBy: adminUid || 'admin'
    };

    try {
      // Write directly to Firestore trade_settings/global so it is guaranteed persisted
      await setDoc(doc(db, 'trade_settings', 'global'), payload, { merge: true });

      try {
        await fetch('/api/admin/trade/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-uid': adminUid
          },
          body: JSON.stringify(payload)
        });
      } catch {}

      setFeedback({ type: 'success', text: 'Configurações globais (trade_settings/global) salvas e auditadas com sucesso!' });
      loadAdminTradeData();
    } catch (err: any) {
      setFeedback({ type: 'error', text: 'Erro ao salvar configurações no Firestore.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPosition = async (posId: string) => {
    if (!confirm('Deseja cancelar esta posição e estornar 100% do valor reservado para o saldo disponível do usuário?')) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/trade/positions/${encodeURIComponent(posId)}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-uid': adminUid
        },
        body: JSON.stringify({ adminUid })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', text: data.message || 'Posição cancelada e estornada.' });
        loadAdminTradeData();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Falha ao cancelar posição.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Erro de comunicação ao cancelar posição.' });
    }
  };

  const filteredPositions = positions.filter(p => {
    if (statusFilter === 'ALL') return true;
    return p.status === statusFilter;
  });

  const durationOptions = [
    { sec: 60, label: '1 Minuto' },
    { sec: 300, label: '5 Minutos' },
    { sec: 900, label: '15 Minutos' },
    { sec: 1800, label: '30 Minutos' },
    { sec: 3600, label: '1 Hora' }
  ];

  return (
    <div className="space-y-6 text-left text-black p-2 sm:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToMenu}
            className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-800 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="font-orbitron font-bold text-[10px] text-[#FF0033] tracking-widest uppercase block">
              GESTÃO FINANCEIRA & RISCO
            </span>
            <h1 className="font-orbitron font-black text-lg sm:text-2xl text-black uppercase">
              VOXA TRADE • PAINEL ADMIN
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'overview' as const, label: 'Visão Geral', icon: Activity },
            { id: 'positions' as const, label: `Posições (${positions.length})`, icon: Clock },
            { id: 'settings' as const, label: 'Configurações & Limites', icon: Settings }
          ].map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-orbitron font-bold text-xs transition-all cursor-pointer ${
                  active
                    ? 'bg-[#FF0033] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
          <button
            onClick={loadAdminTradeData}
            className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 cursor-pointer"
            title="Atualizar Dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-orbitron font-bold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs underline ml-4 cursor-pointer">
            Fechar
          </button>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-1">
              <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                Volume Total Operado
              </span>
              <div className="text-2xl font-mono font-black text-black">
                {formatBRL(metrics.totalVolumeCentavos / 100)}
              </div>
              <span className="text-[11px] text-gray-500 block">
                {metrics.totalPositions} posições registradas
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-1">
              <span className="text-[10px] font-orbitron font-bold text-amber-600 uppercase">
                Exposição Atual (Posições Abertas)
              </span>
              <div className="text-2xl font-mono font-black text-amber-600">
                {formatBRL(metrics.openExposureCentavos / 100)}
              </div>
              <span className="text-[11px] text-gray-500 block">
                {metrics.openCount} posições em andamento
              </span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-1">
              <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                Placar de Liquidações
              </span>
              <div className="text-lg font-mono font-black text-black flex items-center space-x-3 pt-1">
                <span className="text-emerald-600">{metrics.wonCount} WON</span>
                <span>•</span>
                <span className="text-red-600">{metrics.lostCount} LOST</span>
                <span>•</span>
                <span className="text-gray-500">{metrics.drawCount} DRAW</span>
              </div>
              <span className="text-[11px] text-gray-500 block">Liquidação automática via API real</span>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-1">
              <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                Resultado Líquido da Casa
              </span>
              <div
                className={`text-2xl font-mono font-black ${
                  metrics.platformNetResultCentavos >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {formatBRL(metrics.platformNetResultCentavos / 100)}
              </div>
              <span className="text-[11px] text-gray-500 block">
                Payout Configurado: +{payoutPercent}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: POSITIONS TABLE */}
      {(activeTab === 'positions' || activeTab === 'overview') && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-orbitron font-black text-sm sm:text-base text-black uppercase">
              Auditoria de Posições VOXA Trade ({filteredPositions.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {['ALL', 'OPEN', 'WON', 'LOST', 'DRAW', 'CANCELED'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl font-orbitron font-bold text-[10px] cursor-pointer ${
                    statusFilter === st
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                  <th className="py-3 px-3">ID / Data</th>
                  <th className="py-3 px-3">Usuário UID</th>
                  <th className="py-3 px-3">Ativo / Direção</th>
                  <th className="py-3 px-3">Stake</th>
                  <th className="py-3 px-3">Entrada → Saída</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Resultado Usuário</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredPositions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400 font-orbitron text-xs">
                      Nenhuma posição encontrada para este filtro.
                    </td>
                  </tr>
                ) : (
                  filteredPositions.map(pos => (
                    <tr key={pos.id} className="hover:bg-gray-50">
                      <td className="py-3 px-3 font-mono text-[11px]">
                        <span className="font-bold text-black block">{pos.id.slice(0, 16)}...</span>
                        <span className="text-gray-500">
                          {new Date(pos.createdAt).toLocaleString('pt-BR')}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-gray-700">
                        {pos.userUid}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-orbitron font-bold text-black block">
                          {pos.assetSymbol}
                        </span>
                        <span
                          className={`inline-block text-[10px] font-orbitron font-bold px-2 py-0.5 rounded ${
                            pos.direction === 'UP'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {pos.direction === 'UP' ? 'ALTA' : 'BAIXA'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-black">
                        {formatBRL(Number(pos.stakeAmount || 0) / 100)}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-gray-700">
                        {pos.entryPrice} → {pos.exitPrice ?? 'Em aberto'}
                        <span className="block text-[10px] text-gray-400">
                          {pos.marketDataProvider}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-1 rounded-full font-orbitron font-bold text-[10px] ${
                            pos.status === 'WON'
                              ? 'bg-emerald-100 text-emerald-800'
                              : pos.status === 'LOST'
                              ? 'bg-red-100 text-red-800'
                              : pos.status === 'OPEN'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {pos.status}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-3 font-mono font-bold ${
                          Number(pos.netResult) > 0
                            ? 'text-emerald-600'
                            : Number(pos.netResult) < 0
                            ? 'text-red-600'
                            : 'text-gray-600'
                        }`}
                      >
                        {formatBRL(Number(pos.netResult || 0) / 100)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {(pos.status === 'OPEN' || pos.status === 'PENDING' || pos.status === 'SETTLING') && (
                          <button
                            onClick={() => handleCancelPosition(pos.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-orbitron font-bold text-[10px] px-2.5 py-1.5 rounded-xl cursor-pointer"
                          >
                            Cancelar / Estornar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SETTINGS (TRADE SETTINGS DASHBOARD) */}
      {activeTab === 'settings' && (
        <TradeSettingsDashboard
          currentUser={currentUser}
          adminRole={adminRole}
          embedded={true}
        />
      )}
    </div>
  );
};
