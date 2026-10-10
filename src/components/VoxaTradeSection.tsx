import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  History,
  Layers,
  Plus,
  ShieldCheck,
  DollarSign,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  BarChart2,
  Sliders,
  Sparkles,
  Zap,
  Flame,
  Award,
  ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { formatBRL } from '../utils/money';
import { ensureTradeSettingsGlobalSeeded } from '../utils/tradeDb';

interface VoxaTradeSectionProps {
  currentUser: any;
  onGoToWalletDeposit: () => void;
  triggerToast?: (msg: string) => void;
}

type TradeSubTab = 'terminal' | 'market' | 'positions' | 'history';
type ChartInterval = '10s' | '30s' | '1m' | '5m' | '15m' | '1h';

function getSubTabFromPathname(pathname: string): TradeSubTab {
  const clean = pathname.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
  if (clean === 'trade/market') return 'market';
  if (clean === 'trade/positions') return 'positions';
  if (clean === 'trade/history') return 'history';
  return 'terminal';
}

function formatDurationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hrs = Math.round(seconds / 3600);
  return `${hrs} ${hrs === 1 ? 'hora' : 'horas'}`;
}

// Sound effects synthesizer using Web Audio API
function playTradeAudio(type: 'order' | 'win' | 'loss') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'order') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'win') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.3);
      });
    } else if (type === 'loss') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(329.63, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(196.00, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.32);
    }
  } catch (e) {
    // Audio context may be restricted before user interaction
  }
}

export const VoxaTradeSection: React.FC<VoxaTradeSectionProps> = ({
  currentUser,
  onGoToWalletDeposit,
  triggerToast
}) => {
  const [subTab, setSubTab] = useState<TradeSubTab>(() => getSubTabFromPathname(window.location.pathname));
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('BTCUSDT');
  const [chartInterval, setChartInterval] = useState<ChartInterval>('1m');
  const [candles, setCandles] = useState<any[]>([]);
  const [liveQuote, setLiveQuote] = useState<any | null>(null);

  // Indicators & UI toggles
  const [showSMA, setShowSMA] = useState<boolean>(true);
  const [showEMA, setShowEMA] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isFullscreenChart, setIsFullscreenChart] = useState<boolean>(false);

  // Trade settings from backend (trade_settings/global)
  const [tradeEnabled, setTradeEnabled] = useState<boolean>(true);
  const [realMoneyEnabled, setRealMoneyEnabled] = useState<boolean>(true);
  const [payoutPercent, setPayoutPercent] = useState<number>(85);
  const [tradeFeePercent, setTradeFeePercent] = useState<number>(0);
  const [minStakeCentavos, setMinStakeCentavos] = useState<number>(500);
  const [maxStakeCentavos, setMaxStakeCentavos] = useState<number>(1000000);
  const [maxUserExposureCentavos, setMaxUserExposureCentavos] = useState<number>(2500000);
  const [allowedDurations, setAllowedDurations] = useState<number[]>([30, 60, 120, 300, 900]);

  // Wallet real balance state
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [blockedBalance, setBlockedBalance] = useState<number>(0);
  const [pendingBalance, setPendingBalance] = useState<number>(0);

  // Order form states
  const [direction, setDirection] = useState<'UP' | 'DOWN'>('UP');
  const [stakeReaisInput, setStakeReaisInput] = useState<string>('10');
  const [durationSeconds, setDurationSeconds] = useState<number>(60);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [orderFeedback, setOrderFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Positions
  const [positions, setPositions] = useState<any[]>([]);
  const [loadingMarket, setLoadingMarket] = useState<boolean>(true);
  const [loadingChart, setLoadingChart] = useState<boolean>(false);
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const prevSettledCount = useRef<number>(0);

  const userUid = currentUser?.uid || currentUser?.id || '';

  const handleSelectSubTab = (tab: TradeSubTab) => {
    setSubTab(tab);
    const nextPath =
      tab === 'terminal'
        ? '/trade'
        : tab === 'market'
        ? '/trade/market'
        : tab === 'positions'
        ? '/trade/positions'
        : '/trade/history';
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }
  };

  useEffect(() => {
    const onPopState = () => {
      if (window.location.pathname.startsWith('/trade')) {
        setSubTab(getSubTabFromPathname(window.location.pathname));
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // 1-second ticker for live countdowns on open positions
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadWalletBalance = async () => {
    if (!userUid) return;
    try {
      const res = await fetch(`/api/wallet/balance?userId=${encodeURIComponent(userUid)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        const avail = data.availableBalance !== undefined ? Number(data.availableBalance) : Number(data.balance || 0);
        setAvailableBalance(avail);
        setBlockedBalance(Number(data.blockedBalance || 0));
        setPendingBalance(Number(data.pendingBalance || 0));
      }
    } catch (e) {
      console.warn('[VOXA Trade] Wallet fetch warning:', e);
    }
  };

  const loadMarketData = async () => {
    try {
      const fsSettings = await ensureTradeSettingsGlobalSeeded().catch(() => null);
      if (fsSettings) {
        setTradeEnabled(Boolean(fsSettings.enabled));
        setRealMoneyEnabled(Boolean(fsSettings.realMoneyEnabled));
        setPayoutPercent(Number(fsSettings.winPayoutPercent ?? 85));
        setTradeFeePercent(Number(fsSettings.tradeFeePercent ?? 0));
        setMinStakeCentavos(Number(fsSettings.minimumStake ?? 500));
        setMaxStakeCentavos(Number(fsSettings.maximumStake ?? 1000000));
        setMaxUserExposureCentavos(Number(fsSettings.maximumUserExposure ?? 2500000));
        if (Array.isArray(fsSettings.allowedDurations) && fsSettings.allowedDurations.length > 0) {
          setAllowedDurations(fsSettings.allowedDurations);
        }
      }

      const res = await fetch('/api/trade/market');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setTradeEnabled(Boolean(data.enabled));
        setRealMoneyEnabled(data.realMoneyEnabled !== undefined ? Boolean(data.realMoneyEnabled) : true);
        setPayoutPercent(Number(data.winPayoutPercent ?? data.payoutPercent ?? 85));
        setTradeFeePercent(Number(data.tradeFeePercent ?? data.platformFeePercent ?? 0));
        setMinStakeCentavos(Number(data.minimumStake ?? data.minStakeCentavos ?? 500));
        setMaxStakeCentavos(Number(data.maximumStake ?? data.maxStakeCentavos ?? 1000000));
        setMaxUserExposureCentavos(Number(data.maximumUserExposure ?? 2500000));
        const durations = Array.isArray(data.allowedDurations) && data.allowedDurations.length > 0
          ? data.allowedDurations
          : data.allowedDurationsSeconds;
        if (Array.isArray(durations) && durations.length > 0) {
          setAllowedDurations(durations);
          if (!durations.includes(durationSeconds)) {
            setDurationSeconds(durations[0]);
          }
        }
        const connectedList = Array.isArray(data.assets) ? data.assets : [];
        setAssets(connectedList);
        if (connectedList.length > 0 && !connectedList.some((a: any) => a.id === selectedAssetId)) {
          setSelectedAssetId(connectedList[0].id);
        }
      }
    } catch (e) {
      console.warn('[VOXA Trade] Market data warning:', e);
    } finally {
      setLoadingMarket(false);
    }
  };

  const loadChartAndQuote = async (assetIdToLoad: string, intervalToLoad: ChartInterval, silent = false) => {
    if (!assetIdToLoad) return;
    if (!silent) setLoadingChart(true);
    try {
      const res = await fetch(`/api/trade/chart?assetId=${encodeURIComponent(assetIdToLoad)}&interval=${encodeURIComponent(intervalToLoad)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        if (data.quote) {
          setLiveQuote(data.quote);
          setAssets(prev =>
            prev.map(a =>
              a.id === assetIdToLoad
                ? {
                    ...a,
                    price: data.quote.price,
                    change24h: data.quote.change24h,
                    high24h: data.quote.high24h,
                    low24h: data.quote.low24h,
                    providerName: data.quote.provider
                  }
                : a
            )
          );
        }
        if (Array.isArray(data.candles)) {
          // Calculate SMA 9 and EMA 21 overlays on candles
          const calculatedCandles = data.candles.map((c: any, idx: number, arr: any[]) => {
            // SMA 9
            let sma = null;
            if (idx >= 8) {
              const slice = arr.slice(idx - 8, idx + 1);
              const sum = slice.reduce((acc, curr) => acc + Number(curr.close), 0);
              sma = Number((sum / 9).toFixed(4));
            }
            // EMA 14
            let ema = null;
            if (idx >= 13) {
              const slice = arr.slice(idx - 13, idx + 1);
              const k = 2 / (14 + 1);
              let prevEma = Number(slice[0].close);
              for (let i = 1; i < slice.length; i++) {
                prevEma = Number(slice[i].close) * k + prevEma * (1 - k);
              }
              ema = Number(prevEma.toFixed(4));
            }
            return {
              ...c,
              sma9: sma,
              ema14: ema
            };
          });
          setCandles(calculatedCandles);
        }
      }
    } catch (e) {
      console.warn('[VOXA Trade] Chart fetch warning:', e);
    } finally {
      if (!silent) setLoadingChart(false);
    }
  };

  const loadPositions = async () => {
    if (!userUid) return;
    try {
      const res = await fetch(`/api/trade/positions?userUid=${encodeURIComponent(userUid)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.positions)) {
        const settled = data.positions.filter((p: any) => p.status !== 'OPEN' && p.status !== 'PENDING' && p.status !== 'SETTLING');
        
        // Check if a new trade was recently settled
        if (prevSettledCount.current > 0 && settled.length > prevSettledCount.current) {
          const newest = settled[0];
          if (newest && soundEnabled) {
            if (newest.status === 'WON') playTradeAudio('win');
            else if (newest.status === 'LOST') playTradeAudio('loss');
          }
        }
        prevSettledCount.current = settled.length;
        setPositions(data.positions);
      }
    } catch (e) {
      console.warn('[VOXA Trade] Positions fetch warning:', e);
    }
  };

  useEffect(() => {
    loadWalletBalance();
    loadMarketData();
    loadPositions();

    const syncInterval = setInterval(() => {
      loadMarketData();
      loadPositions();
      loadWalletBalance();
    }, 5000);

    return () => clearInterval(syncInterval);
  }, [userUid]);

  useEffect(() => {
    loadChartAndQuote(selectedAssetId, chartInterval, false);
    const quoteInterval = setInterval(() => {
      loadChartAndQuote(selectedAssetId, chartInterval, true);
    }, 4000);
    return () => clearInterval(quoteInterval);
  }, [selectedAssetId, chartInterval]);

  const selectedAsset = useMemo(() => {
    return assets.find(a => a.id === selectedAssetId) || assets[0] || null;
  }, [assets, selectedAssetId]);

  const openPositions = useMemo(() => {
    return positions.filter(p => p.status === 'OPEN' || p.status === 'PENDING' || p.status === 'SETTLING');
  }, [positions]);

  const settledPositions = useMemo(() => {
    return positions.filter(p => p.status !== 'OPEN' && p.status !== 'PENDING' && p.status !== 'SETTLING');
  }, [positions]);

  // Open position on the currently viewed asset
  const activePositionOnCurrentAsset = useMemo(() => {
    if (!selectedAsset) return null;
    return openPositions.find(p => p.assetId === selectedAsset.id) || null;
  }, [openPositions, selectedAsset]);

  // Win rate metrics
  const winRateMetrics = useMemo(() => {
    const total = settledPositions.length;
    if (total === 0) return { winRate: 0, wins: 0, losses: 0, draws: 0, netProfit: 0 };
    const wins = settledPositions.filter(p => p.status === 'WON').length;
    const losses = settledPositions.filter(p => p.status === 'LOST').length;
    const draws = settledPositions.filter(p => p.status === 'DRAW' || p.status === 'CANCELED').length;
    const netProfit = settledPositions.reduce((acc, p) => acc + Number(p.netResult || 0), 0);
    const winRate = Math.round((wins / (total - draws || 1)) * 100);
    return { winRate, wins, losses, draws, netProfit };
  }, [settledPositions]);

  // Automatically trigger settlement when an open position's countdown reaches 0
  useEffect(() => {
    const hasExpiredOpen = openPositions.some(p => {
      if (!p.expiryTimestamp) return false;
      return new Date(p.expiryTimestamp).getTime() <= nowTick;
    });
    if (hasExpiredOpen) {
      fetch('/api/trade/positions/settle', { method: 'POST' })
        .then(() => {
          loadPositions();
          loadWalletBalance();
        })
        .catch(() => {});
    }
  }, [nowTick, openPositions]);

  const stakeCentavos = useMemo(() => {
    const parsed = parseFloat(stakeReaisInput.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 100);
  }, [stakeReaisInput]);

  const estimatedProfitCentavos = useMemo(() => {
    return Math.round(stakeCentavos * (payoutPercent / 100));
  }, [stakeCentavos, payoutPercent]);

  const handleOpenPosition = async (chosenDirection: 'UP' | 'DOWN') => {
    setDirection(chosenDirection);
    setOrderFeedback(null);

    if (!userUid) {
      setOrderFeedback({ type: 'error', message: 'Faça login na sua conta VOXA para operar.' });
      return;
    }

    if (!selectedAsset) {
      setOrderFeedback({ type: 'error', message: 'Selecione um ativo conectado.' });
      return;
    }

    if (stakeCentavos < minStakeCentavos) {
      setOrderFeedback({
        type: 'error',
        message: `O valor mínimo por operação é ${formatBRL(minStakeCentavos / 100)}.`
      });
      return;
    }

    if (stakeCentavos > maxStakeCentavos) {
      setOrderFeedback({
        type: 'error',
        message: `O valor máximo por operação é ${formatBRL(maxStakeCentavos / 100)}.`
      });
      return;
    }

    if (stakeCentavos > availableBalance) {
      setOrderFeedback({
        type: 'error',
        message: `Saldo disponível insuficiente (${formatBRL(availableBalance / 100)}). Adicione saldo via PIX na sua Carteira VOXA.`
      });
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const res = await fetch('/api/trade/positions/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userUid,
          assetId: selectedAsset.id,
          direction: chosenDirection,
          stakeCentavos,
          durationSeconds
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setOrderFeedback({
          type: 'error',
          message: data.error || 'Não foi possível abrir a posição.'
        });
        return;
      }

      if (soundEnabled) {
        playTradeAudio('order');
      }

      if (data.wallet) {
        setAvailableBalance(Number(data.wallet.availableBalance || 0));
        setBlockedBalance(Number(data.wallet.blockedBalance || 0));
      }

      setOrderFeedback({
        type: 'success',
        message: `Posição ${chosenDirection === 'UP' ? 'CALL (ALTA)' : 'PUT (BAIXA)'} executada! Entrada: ${selectedAsset.currencyPrefix || 'US$ '}${Number(data.position.entryPrice).toFixed(selectedAsset.decimals || 2)}`
      });

      if (triggerToast) {
        triggerToast(`Ordem ${chosenDirection === 'UP' ? 'ALTA' : 'BAIXA'} aberta em ${selectedAsset.symbol}!`);
      }

      loadPositions();
      loadWalletBalance();
    } catch (err: any) {
      setOrderFeedback({
        type: 'error',
        message: 'Falha de comunicação com o servidor de negociação.'
      });
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const formatAssetPrice = (price: number | null | undefined, assetObj?: any) => {
    if (price === null || price === undefined || isNaN(Number(price))) return '—';
    const decimals = assetObj?.decimals ?? selectedAsset?.decimals ?? 2;
    const prefix = assetObj?.currencyPrefix ?? selectedAsset?.currencyPrefix ?? 'US$ ';
    return `${prefix}${Number(price).toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })}`;
  };

  const currentPrice = liveQuote?.price ?? selectedAsset?.price ?? 0;
  const currentChange24h = liveQuote?.change24h ?? selectedAsset?.change24h ?? 0;
  const isPositiveChange = Number(currentChange24h) >= 0;

  // Active position live status calculation
  const activePositionLiveStatus = useMemo(() => {
    if (!activePositionOnCurrentAsset) return null;
    const entry = Number(activePositionOnCurrentAsset.entryPrice);
    const curr = Number(currentPrice);
    const dir = activePositionOnCurrentAsset.direction;
    const isWinning = dir === 'UP' ? curr > entry : curr < entry;
    const isDraw = curr === entry;
    const expiryMs = new Date(activePositionOnCurrentAsset.expiryTimestamp).getTime();
    const remainingSec = Math.max(0, Math.ceil((expiryMs - nowTick) / 1000));
    const profitReais = (Number(activePositionOnCurrentAsset.stakeAmount) * (activePositionOnCurrentAsset.payoutPercent / 100)) / 100;
    const diffPct = entry ? (((curr - entry) / entry) * 100) : 0;

    return {
      isWinning,
      isDraw,
      remainingSec,
      entry,
      curr,
      dir,
      profitReais,
      diffPct
    };
  }, [activePositionOnCurrentAsset, currentPrice, nowTick]);

  return (
    <div className="space-y-6 text-left">
      {/* TOP HEADER & REAL WALLET BAR */}
      <div className="bg-[#12111d] border border-white/10 rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-orbitron font-bold text-[10px] tracking-widest text-emerald-400 uppercase">
              VOXA TRADE PRO • COTAÇÕES EM TEMPO REAL & LIQUIDAÇÃO INSTANTÂNEA
            </span>
          </div>
          <h1 className="font-orbitron font-black text-xl sm:text-2xl text-white tracking-wide uppercase flex items-center space-x-3">
            <span>TERMINAL DE NEGOCIAÇÃO</span>
            <span className="bg-red-600/20 text-red-400 border border-red-500/30 text-[10px] font-orbitron font-black px-2.5 py-0.5 rounded-full">
              LIVE
            </span>
          </h1>
          <p className="text-xs text-gray-400 font-sans">
            Opere diretamente com seu saldo VOXA. Preços oficiais e execução transparente na nuvem.
          </p>
        </div>

        {/* WALLET BALANCES & QUICK DEPOSIT */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-black/50 border border-white/10 rounded-2xl px-4 py-2.5">
            <span className="text-[9px] font-orbitron font-bold text-gray-400 uppercase block">
              Saldo Disponível (Operável)
            </span>
            <span className="font-mono font-black text-base sm:text-lg text-emerald-400">
              {formatBRL(availableBalance / 100)}
            </span>
          </div>

          <div className="bg-black/50 border border-white/10 rounded-2xl px-4 py-2.5">
            <span className="text-[9px] font-orbitron font-bold text-gray-400 uppercase block">
              Reservado em Posições
            </span>
            <span className="font-mono font-bold text-sm sm:text-base text-amber-400">
              {formatBRL(blockedBalance / 100)}
            </span>
          </div>

          <button
            onClick={onGoToWalletDeposit}
            className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs px-4 py-3.5 rounded-2xl transition-all cursor-pointer flex items-center space-x-2 shadow-lg shadow-[#FF0033]/25 uppercase"
          >
            <Plus className="w-4 h-4" />
            <span>Depositar PIX</span>
          </button>
        </div>
      </div>

      {/* WIN RATE & STATS METRICS RIBBON */}
      {settledPositions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#12111d] border border-white/10 rounded-2xl p-3.5 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-orbitron font-bold text-gray-400 uppercase block">Taxa de Acerto</span>
              <span className="font-mono font-black text-base text-white">{winRateMetrics.winRate}%</span>
            </div>
          </div>

          <div className="bg-[#12111d] border border-white/10 rounded-2xl p-3.5 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-orbitron font-bold text-gray-400 uppercase block">Vitórias</span>
              <span className="font-mono font-black text-base text-emerald-400">{winRateMetrics.wins} trades</span>
            </div>
          </div>

          <div className="bg-[#12111d] border border-white/10 rounded-2xl p-3.5 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center font-bold">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-orbitron font-bold text-gray-400 uppercase block">Derrotas</span>
              <span className="font-mono font-black text-base text-red-400">{winRateMetrics.losses} trades</span>
            </div>
          </div>

          <div className="bg-[#12111d] border border-white/10 rounded-2xl p-3.5 flex items-center space-x-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${winRateMetrics.netProfit >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[9px] font-orbitron font-bold text-gray-400 uppercase block">Resultado Acumulado</span>
              <span className={`font-mono font-black text-base ${winRateMetrics.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {winRateMetrics.netProfit >= 0 ? '+' : ''}{formatBRL(winRateMetrics.netProfit / 100)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SUB-NAVIGATION TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'terminal' as TradeSubTab, label: 'Terminal de Operação', icon: Activity },
          { id: 'market' as TradeSubTab, label: `Mercado (${assets.length})`, icon: Layers },
          { id: 'positions' as TradeSubTab, label: `Posições Abertas (${openPositions.length})`, icon: Clock },
          { id: 'history' as TradeSubTab, label: `Histórico (${settledPositions.length})`, icon: History }
        ].map(tab => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleSelectSubTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-orbitron font-bold text-xs transition-all cursor-pointer shrink-0 ${
                active
                  ? 'bg-white text-black shadow-md'
                  : 'bg-[#12111d] text-gray-400 hover:text-white border border-white/10'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {!tradeEnabled && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center space-x-3 text-amber-300 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Novas aberturas de posição estão temporariamente pausadas pelo Administrador. Posições em aberto continuam sendo liquidadas normalmente.</span>
        </div>
      )}

      {/* SUBTAB 1: TERMINAL DE OPERAÇÃO */}
      {subTab === 'terminal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT/CENTER: ASSET BAR + PROFESSIONAL CHART */}
          <div className="lg:col-span-8 space-y-6">
            {/* Asset Selector Pills */}
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
              {loadingMarket && assets.length === 0 ? (
                <div className="text-xs text-gray-400 font-orbitron py-2">Conectando aos provedores de cotação em tempo real...</div>
              ) : (
                assets.map(asset => {
                  const isSel = asset.id === selectedAsset?.id;
                  const pos = Number(asset.change24h || 0) >= 0;
                  return (
                    <button
                      key={asset.id}
                      onClick={() => setSelectedAssetId(asset.id)}
                      className={`px-4 py-2.5 rounded-2xl border text-left transition-all cursor-pointer shrink-0 flex items-center space-x-3 ${
                        isSel
                          ? 'bg-white/15 border-white text-white shadow-lg ring-1 ring-white/30'
                          : 'bg-[#12111d] border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      <div>
                        <span className="font-orbitron font-black text-xs block">{asset.symbol}</span>
                        <span className="text-[10px] font-mono block text-gray-300">
                          {formatAssetPrice(asset.price, asset)}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg ${
                          pos ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {pos ? '+' : ''}
                        {Number(asset.change24h || 0).toFixed(2)}%
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Main Chart Card */}
            <div className={`bg-[#12111d] border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5 transition-all ${isFullscreenChart ? 'fixed inset-4 z-50 overflow-y-auto max-h-[95vh] shadow-2xl' : ''}`}>
              {selectedAsset ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-orbitron font-black text-lg sm:text-xl text-white">
                          {selectedAsset.name} ({selectedAsset.symbol})
                        </span>
                        <span className="text-[10px] font-orbitron font-bold px-2 py-0.5 rounded bg-white/10 text-gray-300 uppercase">
                          {selectedAsset.category}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 mt-1.5">
                        <span className="font-mono font-black text-2xl sm:text-3xl text-white">
                          {formatAssetPrice(currentPrice, selectedAsset)}
                        </span>
                        <span
                          className={`flex items-center space-x-1 text-xs font-mono font-bold px-2.5 py-1 rounded-xl ${
                            isPositiveChange
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-red-500/15 text-red-400'
                          }`}
                        >
                          {isPositiveChange ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {isPositiveChange ? '+' : ''}
                            {Number(currentChange24h).toFixed(2)}% (24h)
                          </span>
                        </span>

                        {/* LIVE ACTIVE POSITION IN-THE-MONEY BADGE ON ASSET */}
                        {activePositionLiveStatus && (
                          <div
                            className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-orbitron font-black animate-pulse ${
                              activePositionLiveStatus.isWinning
                                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                                : 'bg-red-500/20 border border-red-500/40 text-red-400'
                            }`}
                          >
                            <span>
                              {activePositionLiveStatus.isWinning ? 'EM LUCRO (+R$ ' + activePositionLiveStatus.profitReais.toFixed(2) + ')' : 'EM DESFAVOR'}
                            </span>
                            <span className="text-[10px] opacity-80">({activePositionLiveStatus.remainingSec}s)</span>
                          </div>
                        )}
                      </div>

                      <span className="text-[10px] text-gray-500 font-mono block mt-1">
                        Provedor: {liveQuote?.provider || selectedAsset.providerName || selectedAsset.provider} • Retorno Base: +{payoutPercent}%
                      </span>
                    </div>

                    {/* Chart Toolbar: Timeframe & Indicators */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Indicators Toggles */}
                      <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                        <button
                          type="button"
                          onClick={() => setShowSMA(!showSMA)}
                          className={`px-2 py-1 rounded-lg text-[9px] font-orbitron font-bold transition-all ${
                            showSMA ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-gray-400 hover:text-white'
                          }`}
                          title="Média Móvel Simples (SMA 9)"
                        >
                          SMA 9
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowEMA(!showEMA)}
                          className={`px-2 py-1 rounded-lg text-[9px] font-orbitron font-bold transition-all ${
                            showEMA ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-gray-400 hover:text-white'
                          }`}
                          title="Média Móvel Exponencial (EMA 14)"
                        >
                          EMA 14
                        </button>
                      </div>

                      {/* Sound FX Button */}
                      <button
                        type="button"
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer ${
                          soundEnabled ? 'bg-white/10 border-white/20 text-white' : 'bg-black/40 border-white/10 text-gray-500'
                        }`}
                        title={soundEnabled ? 'Sons Ativados' : 'Sons Desativados'}
                      >
                        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      </button>

                      {/* Fullscreen Button */}
                      <button
                        type="button"
                        onClick={() => setIsFullscreenChart(!isFullscreenChart)}
                        className="p-2 rounded-xl bg-black/40 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white cursor-pointer transition-all"
                        title={isFullscreenChart ? 'Restaurar' : 'Tela Cheia'}
                      >
                        {isFullscreenChart ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </button>

                      {/* Timeframe intervals */}
                      <div className="flex items-center gap-1 bg-black/40 p-1 rounded-2xl border border-white/10">
                        {(['10s', '30s', '1m', '5m', '15m', '1h'] as ChartInterval[]).map(tf => (
                          <button
                            key={tf}
                            onClick={() => setChartInterval(tf)}
                            className={`px-2.5 py-1.5 rounded-xl font-orbitron font-bold text-[10px] transition-all cursor-pointer ${
                              chartInterval === tf
                                ? 'bg-white text-black font-black shadow-md'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Chart Container with Indicators and Active Position Reference Line */}
                  <div className={`${isFullscreenChart ? 'h-[500px]' : 'h-72 sm:h-84'} w-full relative`}>
                    {loadingChart && candles.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs font-orbitron text-gray-500 space-x-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-red-500" />
                        <span>Carregando gráfico em tempo real...</span>
                      </div>
                    ) : candles.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs font-orbitron text-gray-500">
                        Histórico gráfico indisponível neste intervalo.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={candles} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="tradeColorPrice" x1="0" y1="0" x2="0" y2="1">
                              <stop
                                offset="5%"
                                stopColor={isPositiveChange ? '#10b981' : '#ef4444'}
                                stopOpacity={0.35}
                              />
                              <stop
                                offset="95%"
                                stopColor={isPositiveChange ? '#10b981' : '#ef4444'}
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis
                            dataKey="label"
                            stroke="#6b7280"
                            tick={{ fill: '#9ca3af', fontSize: 10 }}
                            minTickGap={28}
                          />
                          <YAxis
                            domain={['auto', 'auto']}
                            stroke="#6b7280"
                            tick={{ fill: '#9ca3af', fontSize: 10 }}
                            width={75}
                            tickFormatter={(val: number) =>
                              Number(val).toLocaleString('pt-BR', {
                                minimumFractionDigits: selectedAsset.decimals || 2,
                                maximumFractionDigits: selectedAsset.decimals || 2
                              })
                            }
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0c0b16',
                              borderColor: 'rgba(255,255,255,0.2)',
                              borderRadius: '16px',
                              fontSize: '12px',
                              color: '#fff',
                              boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
                            }}
                            formatter={(value: any, name: string) => {
                              if (name === 'close') return [formatAssetPrice(Number(value), selectedAsset), 'Cotação'];
                              if (name === 'sma9') return [formatAssetPrice(Number(value), selectedAsset), 'SMA 9'];
                              if (name === 'ema14') return [formatAssetPrice(Number(value), selectedAsset), 'EMA 14'];
                              return [value, name];
                            }}
                          />

                          {/* Render Active Position Line on the chart if user has open position on this asset */}
                          {activePositionOnCurrentAsset && (
                            <ReferenceLine
                              y={Number(activePositionOnCurrentAsset.entryPrice)}
                              stroke={activePositionOnCurrentAsset.direction === 'UP' ? '#10b981' : '#ef4444'}
                              strokeDasharray="4 4"
                              strokeWidth={2}
                              label={{
                                value: `ENTRADA ${activePositionOnCurrentAsset.direction === 'UP' ? 'CALL ▲' : 'PUT ▼'} (${formatBRL(Number(activePositionOnCurrentAsset.stakeAmount) / 100)})`,
                                fill: activePositionOnCurrentAsset.direction === 'UP' ? '#10b981' : '#ef4444',
                                fontSize: 10,
                                fontWeight: 'bold',
                                position: 'insideTopRight'
                              }}
                            />
                          )}

                          {/* Main Price Area */}
                          <Area
                            type="monotone"
                            dataKey="close"
                            stroke={isPositiveChange ? '#10b981' : '#ef4444'}
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#tradeColorPrice)"
                            isAnimationActive={false}
                          />

                          {/* SMA 9 Indicator Line */}
                          {showSMA && (
                            <Line
                              type="monotone"
                              dataKey="sma9"
                              stroke="#f59e0b"
                              strokeWidth={1.5}
                              dot={false}
                              isAnimationActive={false}
                            />
                          )}

                          {/* EMA 14 Indicator Line */}
                          {showEMA && (
                            <Line
                              type="monotone"
                              dataKey="ema14"
                              stroke="#06b6d4"
                              strokeWidth={1.5}
                              dot={false}
                              isAnimationActive={false}
                            />
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-gray-400 text-xs font-orbitron">
                  Nenhum ativo com provedor de cotação conectado no momento.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: PROFESSIONAL ORDER EXECUTION PANEL */}
          <div className="lg:col-span-4 bg-[#12111d] border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-orbitron font-bold text-gray-400 uppercase block">
                  Boleta de Operação
                </span>
                <h3 className="font-orbitron font-black text-base text-white uppercase flex items-center space-x-2">
                  <span>{selectedAsset ? selectedAsset.symbol : 'Selecione um Ativo'}</span>
                  <span className="text-emerald-400 text-xs font-mono">• Oficial</span>
                </h3>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-orbitron font-bold text-emerald-400 uppercase block">
                  Retorno Payout
                </span>
                <span className="font-mono font-black text-xl text-emerald-400">+{payoutPercent}%</span>
              </div>
            </div>

            {/* Stake Amount Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-orbitron font-bold text-gray-300 uppercase text-[10px]">
                  Valor da Operação (R$)
                </label>
                <span className="text-[10px] text-gray-400 font-mono">
                  Mín: {formatBRL(minStakeCentavos / 100)} • Máx: {formatBRL(maxStakeCentavos / 100)}
                </span>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center font-mono font-bold text-gray-400 text-sm">
                  R$
                </span>
                <input
                  type="number"
                  min={(minStakeCentavos / 100).toFixed(2)}
                  step="1"
                  value={stakeReaisInput}
                  onChange={e => setStakeReaisInput(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-2xl pl-10 pr-4 py-3 text-white font-mono font-bold text-base focus:outline-none focus:border-white focus:ring-1 focus:ring-white/30"
                />
              </div>

              {/* Quick Stake Multipliers and Presets */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[
                  { label: '+R$10', action: () => setStakeReaisInput(prev => String(Math.max(5, (parseFloat(prev) || 0) + 10))) },
                  { label: '+R$50', action: () => setStakeReaisInput(prev => String(Math.max(5, (parseFloat(prev) || 0) + 50))) },
                  { label: '2x', action: () => setStakeReaisInput(prev => String(Math.max(5, (parseFloat(prev) || 10) * 2))) },
                  { label: '1/2', action: () => setStakeReaisInput(prev => String(Math.max(5, Math.floor((parseFloat(prev) || 10) / 2)))) }
                ].map((btn, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={btn.action}
                    className="bg-white/5 hover:bg-white/15 border border-white/10 rounded-xl py-1.5 text-[11px] font-mono font-bold text-gray-200 cursor-pointer transition-all"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expiration Duration Selector */}
            <div className="space-y-2">
              <label className="font-orbitron font-bold text-gray-300 uppercase text-[10px] block">
                Tempo de Expiração
              </label>
              <div className="grid grid-cols-3 gap-2">
                {allowedDurations.map(sec => {
                  const active = durationSeconds === sec;
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setDurationSeconds(sec)}
                      className={`py-2.5 px-2 rounded-xl font-orbitron font-bold text-xs border transition-all cursor-pointer ${
                        active
                          ? 'bg-white text-black border-white shadow-sm font-black'
                          : 'bg-black/40 text-gray-300 border-white/10 hover:border-white/30'
                      }`}
                    >
                      {formatDurationLabel(sec)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-black/50 border border-white/10 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Valor Investido:</span>
                <span className="font-mono font-bold text-white">{formatBRL(stakeCentavos / 100)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Lucro Estimado (+{payoutPercent}%):</span>
                <span className="font-mono font-bold text-emerald-400">
                  +{formatBRL(estimatedProfitCentavos / 100)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-gray-300 font-bold">Retorno Total:</span>
                <span className="font-mono font-black text-sm text-emerald-400">
                  {formatBRL((stakeCentavos + estimatedProfitCentavos) / 100)}
                </span>
              </div>
            </div>

            {/* Feedback Banner */}
            {orderFeedback && (
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-start space-x-2.5 ${
                  orderFeedback.type === 'success'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/15 border-red-500/30 text-red-300'
                }`}
              >
                {orderFeedback.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                )}
                <span>{orderFeedback.message}</span>
              </div>
            )}

            {/* Action Buttons: ALTA (CALL) / BAIXA (PUT) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                disabled={isSubmittingOrder || !tradeEnabled || !selectedAsset}
                onClick={() => handleOpenPosition('UP')}
                className="bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-40 text-white font-orbitron font-black py-4 px-4 rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 shadow-lg shadow-emerald-600/25 active:scale-95"
              >
                <TrendingUp className="w-6 h-6" />
                <span className="text-sm tracking-wider">ALTA (CALL)</span>
                <span className="text-[9px] font-sans opacity-80">Preço Subirá ▲</span>
              </button>

              <button
                type="button"
                disabled={isSubmittingOrder || !tradeEnabled || !selectedAsset}
                onClick={() => handleOpenPosition('DOWN')}
                className="bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-40 text-white font-orbitron font-black py-4 px-4 rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 shadow-lg shadow-red-600/25 active:scale-95"
              >
                <TrendingDown className="w-6 h-6" />
                <span className="text-sm tracking-wider">BAIXA (PUT)</span>
                <span className="text-[9px] font-sans opacity-80">Preço Cairá ▼</span>
              </button>
            </div>

            <div className="text-[10px] text-gray-500 font-sans leading-relaxed flex items-center space-x-2 pt-1">
              <ShieldCheck className="w-4 h-4 text-gray-400 shrink-0" />
              <span>
                Cotações fornecidas via feed oficial auditado. Em caso de empate na saída, 100% do saldo retorna à sua conta.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: MERCADO (/trade/market) */}
      {subTab === 'market' && (
        <div className="bg-[#12111d] border border-white/10 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-orbitron font-black text-lg text-white uppercase">
                Ativos Conectados em Tempo Real
              </h2>
              <p className="text-xs text-gray-400">
                Somente ativos com provedor de mercado online são listados para operação.
              </p>
            </div>
            <button
              onClick={loadMarketData}
              className="bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-2 rounded-xl text-xs font-orbitron font-bold text-white flex items-center space-x-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Atualizar</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                  <th className="py-3 px-4">Ativo</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Cotação Atual</th>
                  <th className="py-3 px-4">Variação 24h</th>
                  <th className="py-3 px-4">Máxima / Mínima 24h</th>
                  <th className="py-3 px-4">Provedor</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {assets.map(asset => {
                  const pos = Number(asset.change24h || 0) >= 0;
                  return (
                    <tr key={asset.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-orbitron font-bold text-white block">{asset.symbol}</span>
                        <span className="text-[11px] text-gray-400">{asset.name}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] font-orbitron px-2 py-0.5 rounded bg-white/10 text-gray-300">
                          {asset.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {formatAssetPrice(asset.price, asset)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded ${
                            pos ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                          }`}
                        >
                          {pos ? '+' : ''}
                          {Number(asset.change24h || 0).toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-gray-400">
                        {formatAssetPrice(asset.high24h, asset)} / {formatAssetPrice(asset.low24h, asset)}
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-gray-400 font-mono">
                        {asset.providerName || asset.provider}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedAssetId(asset.id);
                            handleSelectSubTab('terminal');
                          }}
                          className="bg-white hover:bg-gray-200 text-black font-orbitron font-bold text-[10px] px-3.5 py-2 rounded-xl cursor-pointer uppercase"
                        >
                          Operar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3 & BOTTOM OF TERMINAL: OPEN POSITIONS */}
      {(subTab === 'positions' || subTab === 'terminal') && (
        <div className="bg-[#12111d] border border-white/10 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="font-orbitron font-black text-sm sm:text-base text-white uppercase">
                Posições Abertas ({openPositions.length})
              </h3>
            </div>
            <button
              onClick={() => {
                fetch('/api/trade/positions/settle', { method: 'POST' })
                  .then(() => {
                    loadPositions();
                    loadWalletBalance();
                  })
                  .catch(() => {});
              }}
              className="text-[10px] font-orbitron font-bold text-gray-400 hover:text-white flex items-center space-x-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Sincronizar</span>
            </button>
          </div>

          {openPositions.length === 0 ? (
            <p className="text-xs text-gray-500 py-4">Nenhuma posição aberta no momento.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                    <th className="py-2.5 px-3">Ativo</th>
                    <th className="py-2.5 px-3">Direção</th>
                    <th className="py-2.5 px-3">Valor Reservado</th>
                    <th className="py-2.5 px-3">Preço de Entrada</th>
                    <th className="py-2.5 px-3">Cotação Atual</th>
                    <th className="py-2.5 px-3">Payout</th>
                    <th className="py-2.5 px-3">Tempo Restante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {openPositions.map(pos => {
                    const assetObj = assets.find(a => a.id === pos.assetId);
                    const liveP = assetObj?.price ?? pos.entryPrice;
                    const expiryMs = new Date(pos.expiryTimestamp).getTime();
                    const remainingSec = Math.max(0, Math.ceil((expiryMs - nowTick) / 1000));
                    const isWinningNow =
                      pos.direction === 'UP' ? liveP > pos.entryPrice : liveP < pos.entryPrice;

                    return (
                      <tr key={pos.id} className="hover:bg-white/5">
                        <td className="py-3 px-3 font-orbitron font-bold text-white">
                          {pos.assetSymbol}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg font-orbitron font-bold text-[10px] ${
                              pos.direction === 'UP'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-red-500/15 text-red-400'
                            }`}
                          >
                            {pos.direction === 'UP' ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            <span>{pos.direction === 'UP' ? 'ALTA' : 'BAIXA'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-white">
                          {formatBRL(Number(pos.stakeAmount || 0) / 100)}
                        </td>
                        <td className="py-3 px-3 font-mono text-gray-300">
                          {formatAssetPrice(pos.entryPrice, assetObj)}
                        </td>
                        <td
                          className={`py-3 px-3 font-mono font-bold ${
                            isWinningNow ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {formatAssetPrice(liveP, assetObj)}
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-400 font-bold">
                          +{pos.payoutPercent}%
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-amber-400">
                          {remainingSec > 0 ? `${remainingSec}s` : 'Liquidando...'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 4 & BOTTOM OF TERMINAL: SETTLED HISTORY */}
      {(subTab === 'history' || subTab === 'terminal') && (
        <div className="bg-[#12111d] border border-white/10 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <History className="w-4 h-4 text-gray-400" />
              <h3 className="font-orbitron font-black text-sm sm:text-base text-white uppercase">
                Histórico de Operações Liquidadas ({settledPositions.length})
              </h3>
            </div>
          </div>

          {settledPositions.length === 0 ? (
            <p className="text-xs text-gray-500 py-4">Nenhuma operação liquidada até o momento.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-orbitron font-bold text-gray-400 uppercase">
                    <th className="py-2.5 px-3">Data / Hora</th>
                    <th className="py-2.5 px-3">Ativo</th>
                    <th className="py-2.5 px-3">Direção</th>
                    <th className="py-2.5 px-3">Valor</th>
                    <th className="py-2.5 px-3">Entrada → Saída</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Resultado Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {settledPositions.slice(0, subTab === 'terminal' ? 10 : 100).map(pos => {
                    const assetObj = assets.find(a => a.id === pos.assetId);
                    const net = Number(pos.netResult || 0);
                    return (
                      <tr key={pos.id} className="hover:bg-white/5">
                        <td className="py-3 px-3 font-mono text-[11px] text-gray-400">
                          {pos.settledAt
                            ? new Date(pos.settledAt).toLocaleString('pt-BR')
                            : new Date(pos.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-3 font-orbitron font-bold text-white">
                          {pos.assetSymbol}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded font-orbitron font-bold text-[10px] ${
                              pos.direction === 'UP'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-red-500/15 text-red-400'
                            }`}
                          >
                            {pos.direction === 'UP' ? 'ALTA' : 'BAIXA'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-white">
                          {formatBRL(Number(pos.stakeAmount || 0) / 100)}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-gray-300">
                          {formatAssetPrice(pos.entryPrice, assetObj)} →{' '}
                          {formatAssetPrice(pos.exitPrice, assetObj)}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-orbitron font-bold text-[10px] ${
                              pos.status === 'WON'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : pos.status === 'DRAW' || pos.status === 'CANCELED'
                                ? 'bg-gray-500/20 text-gray-300'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {pos.status === 'WON'
                              ? 'VENCEU'
                              : pos.status === 'LOST'
                              ? 'PERDEU'
                              : pos.status === 'DRAW'
                              ? 'EMPATE'
                              : pos.status}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-3 font-mono font-bold text-right ${
                            net > 0 ? 'text-emerald-400' : net < 0 ? 'text-red-400' : 'text-gray-300'
                          }`}
                        >
                          {net > 0 ? '+' : ''}
                          {formatBRL(net / 100)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
