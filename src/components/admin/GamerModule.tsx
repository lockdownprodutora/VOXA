import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gamepad2, Coins, Search, ArrowLeft, RefreshCw, Sliders, User, Calendar, 
  DollarSign, AlertCircle, CheckCircle2, Plus, Info, Trophy, FileText, Settings, 
  ShieldCheck, Play, Trash2, Globe, Cpu, Check, XCircle, ChevronRight, HelpCircle
} from 'lucide-react';
import { CentralUser } from '../../types';
import { fetchCentralUsers } from '../../utils/centralUserDb';

interface GamerModuleProps {
  onBackToMenu: () => void;
}

interface WalletTransaction {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'GAME_PLAY' | 'GAME_WIN' | 'REFUND' | 'ADMIN_ADJUSTMENT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FAILED';
  description: string;
  reference: string;
  createdAt: string;
  sourceModule?: string;
  environment?: 'TEST' | 'PRODUCTION';
}

interface GameRound {
  id: string;
  roundId: string;
  userId: string;
  userName: string;
  gameCode: string;
  provider: string;
  betAmount: number;
  winAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  providerTxnId: string;
  status: 'STARTED' | 'FINISHED' | 'CANCELLED';
  createdAt: string;
  environment?: 'TEST' | 'PRODUCTION';
}

interface PlayFiversProvider {
  provider_code: string;
  provider_name: string;
  status: 'active' | 'maintenance' | 'disabled';
  rtp?: number;
}

interface PlayFiversGame {
  game_code: string;
  game_name: string;
  provider_code: string;
  game_original: boolean;
  game_type: string;
  status: string;
}

interface FreeSpin {
  id: string;
  userId: string;
  userName: string;
  gameCode: string;
  quantity: number;
  status: string;
  createdAt: string;
}

export const GamerModule: React.FC<GamerModuleProps> = ({ onBackToMenu }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'games' | 'providers' | 'players' | 'rounds' | 'transactions' | 'wallets' | 'bonus' | 'diagnostics' | 'settings'>('overview');
  
  // Data lists
  const [users, setUsers] = useState<CentralUser[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [gameRounds, setGameRounds] = useState<GameRound[]>([]);
  const [providers, setProviders] = useState<PlayFiversProvider[]>([]);
  const [games, setGames] = useState<PlayFiversGame[]>([]);
  const [freeSpins, setFreeSpins] = useState<FreeSpin[]>([]);
  
  // Agent & system configs from server
  const [agentConfig, setAgentConfig] = useState<any>({ rtp: 96.5, limit_enable: false, limit_amount: 0, limit_hours: 24, bonus_enable: false });
  const [isPlayFiversEnabled, setIsPlayFiversEnabled] = useState(false);
  const [isRealMoneyGamerEnabled, setIsRealMoneyGamerEnabled] = useState(false);
  
  // General UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProviderFilter, setSelectedProviderFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Wallet Adjust Modal state
  const [selectedUserForAdjust, setSelectedUserForAdjust] = useState<CentralUser | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustType, setAdjustType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);

  // REAL ADMIN WALLET STATES
  const [walletsList, setWalletsList] = useState<any[]>([]);
  const [searchWalletQuery, setSearchWalletQuery] = useState('');
  const [selectedWalletForAdjust, setSelectedWalletForAdjust] = useState<any | null>(null);
  const [adjustWalletAmount, setAdjustWalletAmount] = useState<string>('');
  const [adjustWalletDirection, setAdjustWalletDirection] = useState<'IN' | 'OUT'>('IN');
  const [adjustWalletReason, setAdjustWalletReason] = useState<string>('');
  const [isSubmittingWalletAdjustment, setIsSubmittingWalletAdjustment] = useState(false);

  // Free Spins Form state
  const [spinUser, setSpinUser] = useState('');
  const [spinGame, setSpinGame] = useState('');
  const [spinQty, setSpinQty] = useState('10');
  const [isSubmittingBonus, setIsSubmittingBonus] = useState(false);

  // Launch Game Modal state
  const [activeLaunchGame, setActiveLaunchGame] = useState<PlayFiversGame | null>(null);
  const [launchUser, setLaunchUser] = useState('');
  const [launchUrl, setLaunchUrl] = useState('');
  const [isLaunchingGame, setIsLaunchingGame] = useState(false);

  // Custom simulation environment state
  const [simBalance, setSimBalance] = useState<number>(0);
  const [simResultLogs, setSimResultLogs] = useState<string[]>([]);
  const [isSimulatingSpin, setIsSimulatingSpin] = useState(false);

  // Diagnostics Diagnostic testing
  const [diagnosticLog, setDiagnosticLog] = useState<string[]>([]);
  const [isTestingDiag, setIsTestingDiag] = useState(false);

  // Secure Diagnostics State
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null);
  const [isFetchingDiagnostics, setIsFetchingDiagnostics] = useState(false);
  const [testConnectionStatus, setTestConnectionStatus] = useState<'IDLE' | 'TESTING' | 'CONECTADO' | 'ERRO'>('IDLE');
  const [testConnectionError, setTestConnectionError] = useState<string>('');

  const fetchDiagnostics = async () => {
    setIsFetchingDiagnostics(true);
    try {
      const res = await fetch('/api/gamer/diagnostics');
      if (res.ok) {
        const data = await res.json();
        setDiagnosticsData(data);
      }
    } catch (err: any) {
      console.error("Failed to fetch diagnostics:", err.message);
    } finally {
      setIsFetchingDiagnostics(false);
    }
  };

  const handleTestConnection = async () => {
    setTestConnectionStatus('TESTING');
    setTestConnectionError('');
    try {
      const res = await fetch('/api/gamer/test-connection', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.status === 'CONECTADO') {
        setTestConnectionStatus('CONECTADO');
      } else {
        setTestConnectionStatus('ERRO');
        setTestConnectionError(data.message || 'Erro de conexão.');
      }
    } catch (err: any) {
      setTestConnectionStatus('ERRO');
      setTestConnectionError(err.message || 'Erro de rede.');
    } finally {
      // Refresh diagnostics summary after test
      await fetchDiagnostics();
    }
  };

  // Load all data
  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      // 1. Fetch Central Users
      const userList = await fetchCentralUsers();
      setUsers(userList);

      // 2. Fetch Wallet Transactions
      const txRes = await fetch('/api/wallet/transactions');
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.transactions || []);
      }

      // 3. Fetch Game Rounds
      const roundRes = await fetch('/api/gamer/rounds');
      if (roundRes.ok) {
        const roundData = await roundRes.json();
        setGameRounds(roundData.rounds || []);
      }

      // 4. Fetch Providers from backend
      const provRes = await fetch('/api/gamer/providers');
      if (provRes.ok) {
        const provData = await provRes.json();
        setIsPlayFiversEnabled(provData.configured || false);
        setProviders(provData.providers || []);
      }

      // 5. Fetch Games catalog
      const gamesRes = await fetch('/api/gamer/games');
      if (gamesRes.ok) {
        const gamesData = await gamesRes.json();
        setGames(gamesData.games || []);
      }

      // 6. Fetch Free Spins
      const spinRes = await fetch('/api/gamer/free-spins');
      if (spinRes.ok) {
        const spinData = await spinRes.json();
        setFreeSpins(spinData.list || []);
      }

      // 7. Fetch Agent statistics
      const agentRes = await fetch('/api/gamer/agent');
      if (agentRes.ok) {
        const agentData = await agentRes.json();
        setAgentConfig(agentData.agent || { rtp: 96.5 });
      }

      // 8. Fetch Real Wallet list
      try {
        const adminWalletsRes = await fetch('/api/admin/wallet/list');
        if (adminWalletsRes.ok) {
          const wData = await adminWalletsRes.json();
          if (wData.success) {
            setWalletsList(wData.wallets || []);
          }
        }
      } catch (wErr) {
        console.error("Error fetching admin wallets list:", wErr);
      }
    } catch (err: any) {
      setErrorMsg('Erro ao carregar dados do Módulo Gamer.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    fetchDiagnostics();
    // Simple check on process.env via client state
    fetch('/api/gamer/agent')
      .then(r => r.json())
      .then(d => {
        setIsPlayFiversEnabled(d.configured);
      }).catch(() => {});
  }, []);

  // Handle Admin Wallet Adjustment
  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForAdjust) return;
    
    const value = parseFloat(adjustAmount);
    if (isNaN(value) || value <= 0) {
      setErrorMsg('Informe um valor numérico válido maior que zero.');
      return;
    }

    if (!adjustReason.trim()) {
      setErrorMsg('Informe o motivo do ajuste.');
      return;
    }

    setIsSubmittingAdjustment(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const finalAmount = adjustType === 'CREDIT' ? value : -value;

      const response = await fetch('/api/wallet/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserForAdjust.id || selectedUserForAdjust.uid,
          amount: finalAmount,
          description: adjustReason.trim(),
          reference: `ADJ-${Date.now().toString(36).toUpperCase()}`
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSuccessMsg(`Ajuste de saldo realizado com sucesso! Novo saldo: R$ ${data.newBalance.toFixed(2)}`);
        setSelectedUserForAdjust(null);
        setAdjustAmount('');
        setAdjustReason('');
        await loadData();
      } else {
        setErrorMsg(data.error || 'Falha ao processar o ajuste de saldo no backend.');
      }
    } catch (err: any) {
      setErrorMsg('Erro na requisição com o backend.');
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  // Handle Real Admin Wallet Adjustment
  const handleAdminWalletAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWalletForAdjust) return;

    const value = parseFloat(adjustWalletAmount);
    if (isNaN(value) || value <= 0) {
      setErrorMsg('Informe um valor numérico válido maior que zero.');
      return;
    }

    if (!adjustWalletReason.trim()) {
      setErrorMsg('Informe o motivo do ajuste.');
      return;
    }

    setIsSubmittingWalletAdjustment(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const centAmount = Math.round(value * 100);

      const response = await fetch('/api/admin/wallet/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedWalletForAdjust.userId,
          amount: centAmount,
          direction: adjustWalletDirection,
          reason: adjustWalletReason.trim(),
          adminId: 'admin_lockdown'
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSuccessMsg(`Ajuste na carteira real realizado com sucesso! Novo saldo: R$ ${(data.balance / 100).toFixed(2).replace('.', ',')}`);
        setSelectedWalletForAdjust(null);
        setAdjustWalletAmount('');
        setAdjustWalletReason('');
        await loadData();
      } else {
        setErrorMsg(data.error || 'Falha ao processar o ajuste no backend.');
      }
    } catch (err: any) {
      setErrorMsg('Erro na chamada do backend.');
    } finally {
      setIsSubmittingWalletAdjustment(false);
    }
  };

  // Grant Free Spins
  const handleGrantBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spinUser || !spinGame || !spinQty) {
      setErrorMsg('Preencha todos os campos do formulário de bônus.');
      return;
    }

    const qty = parseInt(spinQty);
    if (isNaN(qty) || qty < 1 || qty > 23) {
      setErrorMsg('A quantidade de giros grátis deve ser entre 1 e 23 por rodada.');
      return;
    }

    setIsSubmittingBonus(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch('/api/gamer/free-spins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: spinUser,
          gameCode: spinGame,
          quantity: qty
        })
      });

      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(`Bônus de ${qty} Rodadas Grátis concedido com sucesso!`);
        setSpinUser('');
        setSpinGame('');
        await loadData();
      } else {
        setErrorMsg(data.error || 'Erro ao conceder bônus.');
      }
    } catch (err: any) {
      setErrorMsg('Erro na chamada de API.');
    } finally {
      setIsSubmittingBonus(false);
    }
  };

  // Delete Free Spin
  const handleDeleteFreeSpin = async (id: string) => {
    if (!confirm('Deseja realmente cancelar este bônus ativo?')) return;
    try {
      const res = await fetch(`/api/gamer/free-spins/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccessMsg('Bônus cancelado com sucesso.');
        await loadData();
      } else {
        setErrorMsg('Erro ao deletar bônus.');
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  // Launch Casino Game Session
  const handleLaunchGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLaunchGame || !launchUser) {
      setErrorMsg('Selecione um usuário para lançar o jogo.');
      return;
    }

    setIsLaunchingGame(true);
    setErrorMsg('');
    setLaunchUrl('');

    try {
      const response = await fetch('/api/gamer/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameCode: activeLaunchGame.game_code,
          provider: activeLaunchGame.provider_code,
          gameOriginal: activeLaunchGame.game_original,
          userId: launchUser
        })
      });

      const data = await response.json();
      if (response.ok && data.launchUrl) {
        setLaunchUrl(data.launchUrl);
        // Find player and fetch their initial sim balance
        const player = users.find(u => (u.id || u.uid) === launchUser);
        if (player) {
          setSimBalance(player.gameTestBalance !== undefined ? player.gameTestBalance : 5000.00);
        }
        setSimResultLogs([`[Launcher] Sessão criada com ID de jogador: ${launchUser}`]);
      } else {
        setErrorMsg(data.error || 'Não foi possível obter a URL de inicialização do jogo.');
      }
    } catch (err: any) {
      setErrorMsg('Erro de conexão ao lançar o jogo.');
    } finally {
      setIsLaunchingGame(false);
    }
  };

  // Simulated Game Spin (Interactive Local PlayFivers Testing Simulator)
  const handleSimulatedSpin = async (isWin: boolean) => {
    if (!launchUser || !activeLaunchGame) return;
    
    setIsSimulatingSpin(true);
    const betVal = 5.00;
    const winVal = isWin ? 15.00 : 0.00;
    const txnId = `txn_sim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const roundId = `round_sim_${Date.now()}`;

    try {
      // 1. Fire simulated balance check/update WinBet webhook on backend to simulate real API flow
      const response = await fetch('/api/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: "WinBet",
          user_code: launchUser,
          game_original: activeLaunchGame.game_original,
          game_type: activeLaunchGame.game_type || "slot",
          slot: {
            provider_code: activeLaunchGame.provider_code,
            game_code: activeLaunchGame.game_code,
            type: "WinBet",
            round_id: roundId,
            bet: betVal,
            win: winVal,
            txn_id: txnId,
            txn_type: "WinBet",
            buy_bonus: false,
            free_rounds: 0,
            user_before_balance: simBalance,
            user_after_balance: simBalance - betVal + winVal,
            created_at: new Date().toISOString()
          }
        })
      });

      const data = await response.json();
      if (response.ok && data.balance !== undefined) {
        setSimBalance(data.balance);
        setSimResultLogs(prev => [
          `[Webhook OK] Apostou: R$ ${betVal.toFixed(2)} | Retorno: R$ ${winVal.toFixed(2)} | Novo Saldo: R$ ${data.balance.toFixed(2)} (${isWin ? 'GANHOU 💥' : 'PERDEU 💀'})`,
          ...prev
        ]);
        await loadData(); // Reload admin databases
      } else {
        const errData = await response.json().catch(() => ({ error: 'Saldo insuficiente' }));
        setSimResultLogs(prev => [`[ERRO Webhook] ${errData.error || 'Saldo insuficiente para aposta'}`, ...prev]);
      }
    } catch (err: any) {
      setSimResultLogs(prev => [`[ERRO Interno] ${err.message}`, ...prev]);
    } finally {
      setIsSimulatingSpin(false);
    }
  };

  // Run Webhook Diagnostic Tests
  const runDiagnostics = async () => {
    setIsTestingDiag(true);
    setDiagnosticLog([]);
    const logs: string[] = [];

    const addLog = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      setDiagnosticLog([...logs]);
    };

    try {
      addLog("Iniciando bateria de testes do Módulo Gamer...");
      
      // Check system configurations
      addLog(`PLAYFIVERS_ENABLED: ${isPlayFiversEnabled ? 'ATIVO' : 'DESATIVADO (MOCK)'}`);
      addLog(`REAL_MONEY_GAMER_ENABLED: ${isRealMoneyGamerEnabled ? 'ATIVO' : 'DESATIVADO (TEST-ONLY)'}`);
      
      // Test 1: Fetch server external IP indicator or API configuration status
      addLog("Testando conexão com servidores centrais...");
      const checkRes = await fetch('/api/gamer/agent');
      if (checkRes.ok) {
        addLog("OK: Backend operacional.");
      } else {
        addLog("AVISO: Conexão direta instável ou não configurada.");
      }

      // Test 2: Webhook receiver check (BALANCE request)
      if (users.length > 0) {
        const testUser = users[0].id || users[0].uid;
        addLog(`Testando BALANCE webhook para o usuário de teste: ${testUser}...`);
        const balWebRes = await fetch('/api/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: "BALANCE",
            user_code: testUser
          })
        });

        if (balWebRes.ok) {
          const balData = await balWebRes.json();
          addLog(`SUCESSO: Webhook BALANCE respondeu status 200. Saldo retornado: R$ ${balData.balance}`);
        } else {
          addLog("ERRO: Webhook BALANCE falhou.");
        }
      } else {
        addLog("Pendente: Cadastre pelo menos 1 usuário para testar o Webhook de saldo.");
      }

      addLog("Bateria de testes finalizada.");
    } catch (err: any) {
      addLog(`ERRO CRÍTICO NO DIAGNÓSTICO: ${err.message}`);
    } finally {
      setIsTestingDiag(false);
    }
  };

  // Filter users
  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q))
    );
  });

  // Filter games
  const filteredGames = games.filter(g => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = g.game_name.toLowerCase().includes(q) || g.game_code.toLowerCase().includes(q);
    const matchesProv = selectedProviderFilter ? g.provider_code === selectedProviderFilter : true;
    return matchesQuery && matchesProv;
  });

  // Totalized stats for Overview Tab
  const totalBets = gameRounds.reduce((acc, r) => acc + (r.betAmount || 0), 0);
  const totalWins = gameRounds.reduce((acc, r) => acc + (r.winAmount || 0), 0);
  const houseGGR = totalBets - totalWins;

  return (
    <div className="space-y-6">
      {/* Messages */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-emerald-600 shadow-sm"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-orbitron text-xs font-bold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800">✖</button>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-between text-[#FF0033] shadow-sm"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-[#FF0033] shrink-0" />
              <span className="font-orbitron text-xs font-bold">{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-[#FF0033] hover:text-red-800">✖</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main HUD Banner */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm text-left">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FF0033]/10 flex items-center justify-center text-[#FF0033]">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-orbitron font-black text-lg text-black tracking-wider">MÓDULO GAMER — PLAYFIVERS</h2>
            <p className="text-xs text-gray-500 font-sans mt-0.5">
              Gestão de cassinos online, catálogos originais e Webhooks auditáveis.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-orbitron font-bold text-gray-600">
            <span className={`w-2.5 h-2.5 rounded-full ${isPlayFiversEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>PLAYFIVERS: {isPlayFiversEnabled ? 'PRODUÇÃO' : 'TESTE LOCAL'}</span>
          </div>
          <button 
            onClick={loadData}
            disabled={isLoading}
            className="p-3 bg-gray-50 border border-gray-300 rounded-2xl text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={onBackToMenu}
            className="flex items-center space-x-2 px-5 py-3 bg-[#FF0033] text-white rounded-2xl font-orbitron font-bold text-xs hover:bg-red-700 transition-all shadow-md uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>MENU</span>
          </button>
        </div>
      </div>

      {/* Menu / Tabs System */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-2">
        {[
          { id: 'overview', label: 'Visão Geral', icon: Cpu },
          { id: 'games', label: 'Jogos Catalogados', icon: Gamepad2 },
          { id: 'providers', label: 'Provedores', icon: Globe },
          { id: 'players', label: 'Jogadores', icon: User },
          { id: 'rounds', label: 'Rodadas', icon: Trophy },
          { id: 'transactions', label: 'Transações', icon: FileText },
          { id: 'wallets', label: 'Carteiras / Ledger', icon: Coins },
          { id: 'bonus', label: 'Bônus / Free Spins', icon: Sliders },
          { id: 'diagnostics', label: 'Diagnósticos', icon: ShieldCheck },
          { id: 'settings', label: 'Configurações', icon: Settings },
        ].map(tab => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSearchQuery('');
                if (tab.id === 'diagnostics') {
                  fetchDiagnostics();
                }
              }}
              className={`flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl font-orbitron text-[10px] font-bold transition-all uppercase tracking-wider ${
                isActive 
                  ? 'bg-[#FF0033] text-white' 
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <IconComponent className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab views */}
      <div className="text-left">
        {/* 1. VISÃO GERAL (Overview) */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs">
                <span className="text-[10px] font-orbitron font-bold text-gray-400 uppercase tracking-widest block">Total de Rodadas</span>
                <span className="font-orbitron font-black text-2xl text-gray-900 mt-1 block">{gameRounds.length}</span>
                <span className="text-[10px] text-gray-500 font-sans mt-1 block">Registradas em base local</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs">
                <span className="text-[10px] font-orbitron font-bold text-gray-400 uppercase tracking-widest block">Apostas Totais</span>
                <span className="font-orbitron font-black text-2xl text-[#FF0033] mt-1 block">R$ {totalBets.toFixed(2)}</span>
                <span className="text-[10px] text-gray-500 font-sans mt-1 block">Soma de stakes processados</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs">
                <span className="text-[10px] font-orbitron font-bold text-gray-400 uppercase tracking-widest block">Retorno Pago</span>
                <span className="font-orbitron font-black text-2xl text-emerald-600 mt-1 block">R$ {totalWins.toFixed(2)}</span>
                <span className="text-[10px] text-gray-500 font-sans mt-1 block">Prêmios entregues por webhook</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs">
                <span className="text-[10px] font-orbitron font-bold text-gray-400 uppercase tracking-widest block">House GGR</span>
                <span className="font-orbitron font-black text-2xl text-indigo-600 mt-1 block">R$ {houseGGR.toFixed(2)}</span>
                <span className="text-[10px] text-gray-500 font-sans mt-1 block">Ganhos líquidos da casa</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
                <h3 className="font-orbitron font-bold text-sm uppercase text-gray-800">Monitor de Integração PlayFivers API V2</h3>
                <p className="text-xs text-gray-600 leading-relaxed font-sans">
                  Essa interface centraliza a homologação de transações integradas. O provedor externo invoca os endpoints do backend para ler saldos e creditar rounds. Não são permitidos desvios ou falsificações de estado.
                </p>
                <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-400 font-bold block text-[10px] uppercase">RTP Médio Configurado</span>
                    <span className="font-orbitron font-black text-lg text-gray-900 mt-0.5 block">{agentConfig.rtp || 96.5}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold block text-[10px] uppercase">Contas Conectadas</span>
                    <span className="font-orbitron font-black text-lg text-gray-900 mt-0.5 block">{users.length}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
                <h4 className="font-orbitron font-bold text-xs uppercase text-gray-800">Limites de Aposta Ativos</h4>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500">Auto Limitação</span>
                    <span className="font-orbitron font-bold text-[#FF0033]">DESATIVADO</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500">Aposta Máxima</span>
                    <span className="font-orbitron font-bold text-gray-800">R$ 500,00</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-500">Moeda Padrão</span>
                    <span className="font-orbitron font-bold text-gray-800">BRL (R$)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. JOGOS CATALOGADOS (Games) */}
        {activeTab === 'games' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-orbitron font-bold text-sm text-gray-800 uppercase">Catálogo de Jogos PlayFivers ({games.length})</h3>
                  <p className="text-xs text-gray-500 font-sans mt-0.5">Exibindo exclusivamente slots e originais autorizados.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <select 
                    value={selectedProviderFilter} 
                    onChange={e => setSelectedProviderFilter(e.target.value)}
                    className="p-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-sans focus:outline-hidden"
                  >
                    <option value="">Filtrar Provedor...</option>
                    {providers.map(p => (
                      <option key={p.provider_code} value={p.provider_code}>{p.provider_name}</option>
                    ))}
                  </select>
                  <div className="relative flex-1 md:flex-none">
                    <input
                      type="text"
                      placeholder="Buscar jogo..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-sans focus:outline-hidden"
                    />
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              {filteredGames.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-gray-200 rounded-2xl">
                  <Info className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 font-sans">
                    {isPlayFiversEnabled 
                      ? "Nenhum jogo corresponde aos filtros." 
                      : "Sem jogos cadastrados. PlayFivers está em modo de simulação local."}
                  </p>
                  {!isPlayFiversEnabled && (
                    <button 
                      onClick={() => {
                        // Create standard simulated games list
                        setGames([
                          { game_code: "mines", game_name: "Mines Fivers", provider_code: "PGSOFT", game_original: true, game_type: "slot", status: "active" },
                          { game_code: "crash", game_name: "Crash Fivers", provider_code: "PRAGMATIC", game_original: true, game_type: "slot", status: "active" },
                          { game_code: "fortune_tiger", game_name: "Fortune Tiger", provider_code: "PGSOFT", game_original: true, game_type: "slot", status: "active" },
                        ]);
                        setProviders([
                          { provider_code: "PGSOFT", provider_name: "PG Soft", status: "active" },
                          { provider_code: "PRAGMATIC", provider_name: "Pragmatic Play", status: "active" },
                        ]);
                      }}
                      className="mt-4 px-4 py-2 bg-[#FF0033] text-white font-orbitron font-bold text-[10px] rounded-xl uppercase"
                    >
                      Injetar Catálogo de Demonstração
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {filteredGames.map(game => (
                    <div key={game.game_code} className="border border-gray-200 rounded-2xl p-4 bg-gray-50/50 hover:border-gray-300 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-gray-200 rounded-md font-orbitron font-bold text-[9px] text-gray-600 uppercase tracking-wide">
                          {game.provider_code}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-orbitron font-bold text-[8px] uppercase tracking-wide ${
                          game.game_original ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {game.game_original ? 'Original' : 'Cópia/API'}
                        </span>
                      </div>
                      <h4 className="font-orbitron font-black text-sm text-gray-800 mt-2.5">{game.game_name}</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">Código: {game.game_code}</p>
                      
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => {
                            setActiveLaunchGame(game);
                            setLaunchUser(users.length > 0 ? (users[0].id || users[0].uid) : '');
                            setLaunchUrl('');
                            setSimResultLogs([]);
                          }}
                          className="w-full py-2 bg-gray-900 hover:bg-[#FF0033] text-white font-orbitron font-bold text-[10px] uppercase rounded-xl transition-all tracking-wider flex items-center justify-center space-x-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>ABRIR/LAUNCHEAR</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Launch Game Modal View */}
            {activeLaunchGame && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white border-2 border-gray-900 rounded-3xl p-6 shadow-md space-y-4 relative"
              >
                <button 
                  onClick={() => setActiveLaunchGame(null)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-black font-bold text-sm"
                >
                  FECHAR ✖
                </button>
                <div className="flex items-center space-x-2 text-[#FF0033]">
                  <Gamepad2 className="w-5 h-5" />
                  <h3 className="font-orbitron font-black text-sm uppercase">Launcher: {activeLaunchGame.game_name}</h3>
                </div>

                {!launchUrl ? (
                  <form onSubmit={handleLaunchGame} className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-[10px] font-orbitron font-bold text-gray-500 uppercase mb-1">Selecione o Jogador</label>
                      <select
                        required
                        value={launchUser}
                        onChange={e => setLaunchUser(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-sans text-black"
                      >
                        <option value="">Selecione...</option>
                        {users.map(u => (
                          <option key={u.id || u.uid} value={u.id || u.uid}>
                            {u.name} (CPF/ID: {u.id || u.uid})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isLaunchingGame}
                      className="px-6 py-3 bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs rounded-xl uppercase tracking-wider"
                    >
                      {isLaunchingGame ? 'Gerando Sessão...' : 'INICIAR JOGO'}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 text-xs bg-gray-50 p-3 border border-gray-200 rounded-2xl justify-between">
                      <span className="font-sans text-gray-600">Sessão simulada com saldo virtual: <strong>R$ {simBalance.toFixed(2)}</strong></span>
                      <button 
                        onClick={() => setLaunchUrl('')}
                        className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-lg font-orbitron font-bold text-[10px]"
                      >
                        Trocar Conta
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Interactive Visual Play Game Simulator to Test Webhook Callback Directly */}
                      <div className="lg:col-span-2 border border-gray-300 rounded-2xl overflow-hidden bg-gray-950 p-6 flex flex-col items-center justify-center text-center text-white min-h-[300px]">
                        <span className="text-[10px] font-orbitron font-bold text-[#FF0033] uppercase tracking-widest block mb-1">PlayFivers Game Simulator Room</span>
                        <h4 className="font-orbitron font-black text-xl text-white tracking-widest mb-4 uppercase">{activeLaunchGame.game_name}</h4>
                        
                        <div className="flex gap-4 mb-6">
                          <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-center text-2xl font-black">🍒</div>
                          <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-center text-2xl font-black">💎</div>
                          <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-center text-2xl font-black">🔔</div>
                        </div>

                        <div className="space-y-2 w-full max-w-xs">
                          <button
                            onClick={() => handleSimulatedSpin(true)}
                            disabled={isSimulatingSpin}
                            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-orbitron font-black text-xs uppercase tracking-wide transition-all"
                          >
                            GIRAR (Simular Vitória + R$ 15,00)
                          </button>
                          <button
                            onClick={() => handleSimulatedSpin(false)}
                            disabled={isSimulatingSpin}
                            className="w-full py-2.5 bg-[#FF0033] hover:bg-red-800 rounded-xl font-orbitron font-black text-xs uppercase tracking-wide transition-all"
                          >
                            GIRAR (Simular Derrota - R$ 5,00)
                          </button>
                        </div>
                      </div>

                      {/* Log Console Output of Callback Actions */}
                      <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50">
                        <span className="text-[10px] font-orbitron font-bold text-gray-400 block mb-2 uppercase">Histórico do Webhook Local</span>
                        <div className="font-mono text-[10px] text-gray-700 space-y-1 h-56 overflow-y-auto">
                          {simResultLogs.map((log, i) => (
                            <p key={i} className="border-b border-gray-100 pb-1">{log}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}

        {/* 3. PROVEDORES (Providers) */}
        {activeTab === 'providers' && (
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-orbitron font-bold text-sm text-gray-800 uppercase">Provedores de Cassino Integrados</h3>
            <p className="text-xs text-gray-500 font-sans mt-0.5">Visão geral dos hubs parceiros e RTP de homologação.</p>
            
            {providers.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-gray-200 rounded-2xl text-xs text-gray-500">
                Sem provedores ativos ou cadastrados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                      <th className="py-3 px-4">Provedor</th>
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providers.map(p => (
                      <tr key={p.provider_code} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4 font-bold">{p.provider_name}</td>
                        <td className="py-3 px-4 font-mono">{p.provider_code}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded-full">ATIVO</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 4. JOGADORES (Players) */}
        {activeTab === 'players' && (
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-orbitron font-bold text-sm text-gray-800 uppercase">Lista de Jogadores Cadastrados</h3>
                <p className="text-xs text-gray-500 font-sans mt-0.5">Ledger virtual e saldos em tempo de teste.</p>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Pesquisar jogador..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full md:w-64 pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-sans focus:outline-hidden"
                />
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                    <th className="py-3 px-4">Nome</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4 text-right">Saldo de Teste (Virtual)</th>
                    <th className="py-3 px-4 text-right">Saldo Real MP</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.id || user.uid} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-bold">{user.name}</td>
                      <td className="py-3 px-4 text-gray-500">{user.email || 'Sem E-mail'}</td>
                      <td className="py-3 px-4 text-right font-orbitron font-black text-gray-900">
                        R$ {(user.gameTestBalance !== undefined ? user.gameTestBalance : 5000.00).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-orbitron font-bold text-gray-400">
                        R$ {(user.walletBalance || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedUserForAdjust(user)}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-[#FF0033] hover:text-white rounded-lg font-orbitron font-bold text-[9px] text-[#FF0033] transition-all"
                        >
                          AJUSTAR SALDO
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Adjust modal overlay */}
            {selectedUserForAdjust && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 border-2 border-[#FF0033] p-5 rounded-3xl bg-gray-50 space-y-4 max-w-md"
              >
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <h4 className="font-orbitron font-black text-xs text-[#FF0033] uppercase">Ajustar Saldo Virtual</h4>
                  <button onClick={() => setSelectedUserForAdjust(null)} className="text-gray-400 hover:text-black">✖</button>
                </div>
                <p className="text-xs text-gray-500">
                  Alterando o saldo da conta de <strong>{selectedUserForAdjust.name}</strong>.
                </p>

                <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustType('CREDIT')}
                      className={`py-2 rounded-xl font-orbitron font-bold text-xs border text-center ${
                        adjustType === 'CREDIT' ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 'bg-white'
                      }`}
                    >
                      ADICIONAR SALDO (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustType('DEBIT')}
                      className={`py-2 rounded-xl font-orbitron font-bold text-xs border text-center ${
                        adjustType === 'DEBIT' ? 'bg-red-100 border-[#FF0033] text-[#FF0033]' : 'bg-white'
                      }`}
                    >
                      REDUZIR SALDO (-)
                    </button>
                  </div>

                  <div>
                    <label className="block text-[9px] font-orbitron font-bold text-gray-400 uppercase mb-1">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={adjustAmount}
                      onChange={e => setAdjustAmount(e.target.value)}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-orbitron"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-orbitron font-bold text-gray-400 uppercase mb-1">Justificativa</label>
                    <textarea
                      required
                      placeholder="Ex: Evento de marketing, rodada premiada"
                      value={adjustReason}
                      onChange={e => setAdjustReason(e.target.value)}
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-sans"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingAdjustment}
                    className="w-full py-2.5 bg-[#FF0033] text-white font-orbitron font-bold text-xs rounded-xl uppercase"
                  >
                    {isSubmittingAdjustment ? 'Enviando...' : 'CONFIRMAR AJUSTE'}
                  </button>
                </form>
              </motion.div>
            )}
          </div>
        )}

        {/* 5. RODADAS (Rounds) */}
        {activeTab === 'rounds' && (
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-orbitron font-bold text-sm text-gray-800 uppercase">Rodadas Gravadas (Logs Oficiais)</h3>
            
            {gameRounds.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-gray-200 rounded-2xl text-xs text-gray-400">
                Nenhum round processado em banco de dados ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-4">Jogador</th>
                      <th className="py-3 px-4">Jogo</th>
                      <th className="py-3 px-4 text-right">Aposta (Stake)</th>
                      <th className="py-3 px-4 text-right">Prêmio Pago</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gameRounds.map(round => (
                      <tr key={round.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4 text-gray-400 text-[10px]">{new Date(round.createdAt).toLocaleString()}</td>
                        <td className="py-3 px-4 font-bold">{round.userName}</td>
                        <td className="py-3 px-4 font-mono text-gray-600">{round.gameCode} ({round.provider})</td>
                        <td className="py-3 px-4 text-right font-orbitron font-bold text-[#FF0033]">R$ {round.betAmount.toFixed(2)}</td>
                        <td className={`py-3 px-4 text-right font-orbitron font-bold ${round.winAmount > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                          R$ {round.winAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-[9px] font-bold">CONCLUÍDO</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 6. TRANSAÇÕES (Transactions) */}
        {activeTab === 'transactions' && (
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-orbitron font-bold text-sm text-gray-800 uppercase">Ledger Financeiro unificado (Central Ledger)</h3>
            
            {transactions.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-gray-200 rounded-2xl text-xs text-gray-400">
                Nenhuma transação gravada no ledger.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-4">Usuário</th>
                      <th className="py-3 px-4">Mecanismo</th>
                      <th className="py-3 px-4 text-right">Valor</th>
                      <th className="py-3 px-4">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-4 text-gray-400 text-[10px]">{new Date(tx.createdAt).toLocaleString()}</td>
                        <td className="py-3 px-4 font-bold">{tx.userName}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            tx.type === 'ADMIN_ADJUSTMENT' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-orbitron font-bold ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {tx.amount >= 0 ? '+' : ''} R$ {tx.amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-gray-500">{tx.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 7. CARTEIRAS / LEDGER (Wallets) */}
        {activeTab === 'wallets' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-orbitron font-black text-sm text-gray-800 uppercase">Custódia e Ledger Geral de Carteiras</h3>
                  <p className="text-xs text-gray-500 font-sans mt-0.5">
                    Visão unificada das carteiras digitais dos usuários. Toda alteração manual é auditável e registrada como transação do tipo ADJUSTMENT.
                  </p>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Pesquisar por nome ou e-mail..."
                    value={searchWalletQuery}
                    onChange={e => setSearchWalletQuery(e.target.value)}
                    className="w-full md:w-80 pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-sans focus:outline-hidden"
                  />
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                </div>
              </div>

              {walletsList.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-gray-200 rounded-2xl text-xs text-gray-400 font-sans">
                  Nenhuma carteira digital encontrada na plataforma.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                        <th className="py-3 px-4">User ID</th>
                        <th className="py-3 px-4">Nome do Usuário</th>
                        <th className="py-3 px-4">E-mail</th>
                        <th className="py-3 px-4 text-right">Saldo Disponível</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {walletsList
                        .filter(w => {
                          const q = searchWalletQuery.toLowerCase();
                          return (
                            w.userId.toLowerCase().includes(q) ||
                            (w.userName && w.userName.toLowerCase().includes(q)) ||
                            (w.userEmail && w.userEmail.toLowerCase().includes(q))
                          );
                        })
                        .map(wallet => (
                          <tr key={wallet.userId} className="hover:bg-gray-50/50">
                            <td className="py-3 px-4 font-mono text-[10px] text-gray-400">{wallet.userId.substring(0, 8)}...</td>
                            <td className="py-3 px-4 font-bold">{wallet.userName}</td>
                            <td className="py-3 px-4 text-gray-500">{wallet.userEmail}</td>
                            <td className="py-3 px-4 text-right font-orbitron font-black text-gray-900">
                              R$ {(wallet.balance / 100).toFixed(2).replace('.', ',')}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedWalletForAdjust(wallet);
                                  setAdjustWalletAmount('');
                                  setAdjustWalletReason('');
                                  setAdjustWalletDirection('IN');
                                }}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-lg font-orbitron font-bold text-[9px] text-blue-600 transition-all uppercase tracking-wider"
                              >
                                Ajustar Saldo
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Adjust modal overlay */}
            {selectedWalletForAdjust && (
              <motion.div 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-2 border-blue-500 p-6 rounded-3xl bg-blue-50/10 space-y-4 max-w-xl text-left"
              >
                <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                  <div className="flex items-center space-x-2 text-blue-600">
                    <Sliders className="w-5 h-5" />
                    <h4 className="font-orbitron font-black text-xs uppercase">Ajuste de Saldo Custodiado</h4>
                  </div>
                  <button onClick={() => setSelectedWalletForAdjust(null)} className="text-gray-400 hover:text-black font-bold">✖</button>
                </div>
                
                <p className="text-xs text-gray-600">
                  Você está efetuando uma alteração manual contábil no saldo de <strong>{selectedWalletForAdjust.userName}</strong> ({selectedWalletForAdjust.userEmail}). 
                  Esta operação gerará um registro de auditoria irrevogável e enviará uma notificação ao usuário.
                </p>

                <form onSubmit={handleAdminWalletAdjustmentSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustWalletDirection('IN')}
                      className={`py-3 rounded-xl font-orbitron font-bold text-xs border text-center transition-all ${
                        adjustWalletDirection === 'IN' 
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      ADICIONAR SALDO (CRÉDITO +)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustWalletDirection('OUT')}
                      className={`py-3 rounded-xl font-orbitron font-bold text-xs border text-center transition-all ${
                        adjustWalletDirection === 'OUT' 
                          ? 'bg-red-600 border-red-600 text-white shadow-sm' 
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      REDUZIR SALDO (DÉBITO -)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-orbitron font-bold text-gray-400 uppercase mb-1">Valor do Ajuste (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="Ex: 50.00"
                        value={adjustWalletAmount}
                        onChange={e => setAdjustWalletAmount(e.target.value)}
                        className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-orbitron text-black focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-orbitron font-bold text-gray-400 uppercase mb-1">Justificativa / Motivo</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Correção de depósito Pix pendente"
                        value={adjustWalletReason}
                        onChange={e => setAdjustWalletReason(e.target.value)}
                        className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs font-sans text-black focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedWalletForAdjust(null)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-xl font-orbitron font-bold text-[10px] uppercase"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingWalletAdjustment}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-orbitron font-bold text-[10px] uppercase rounded-xl transition-all shadow-sm"
                    >
                      {isSubmittingWalletAdjustment ? 'Processando...' : 'Confirmar e Aplicar'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </div>
        )}

        {/* 8. BÔNUS / FREE SPINS (Bonus) */}
        {activeTab === 'bonus' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 text-[#FF0033]">
                <Sliders className="w-5 h-5" />
                <h3 className="font-orbitron font-bold text-sm uppercase">Conceder Bônus (Rodadas Grátis)</h3>
              </div>
              <p className="text-xs text-gray-500 font-sans">
                Permite creditar rodadas grátis sem descontar do saldo de teste ou disponível. Limitado a no máximo 23 giros por jogador.
              </p>

              <form onSubmit={handleGrantBonus} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-orbitron font-bold text-gray-400 uppercase mb-1">Jogador Beneficiado</label>
                  <select
                    required
                    value={spinUser}
                    onChange={e => setSpinUser(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-sans"
                  >
                    <option value="">Selecione...</option>
                    {users.map(u => (
                      <option key={u.id || u.uid} value={u.id || u.uid}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-orbitron font-bold text-gray-400 uppercase mb-1">Jogo Vinculado</label>
                  <select
                    required
                    value={spinGame}
                    onChange={e => setSpinGame(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-sans"
                  >
                    <option value="">Selecione...</option>
                    {games.map(g => (
                      <option key={g.game_code} value={g.game_code}>{g.game_name} ({g.provider_code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-orbitron font-bold text-gray-400 uppercase mb-1">Quantidade de Giros (1 a 23)</label>
                  <input
                    type="number"
                    min="1"
                    max="23"
                    required
                    value={spinQty}
                    onChange={e => setSpinQty(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-orbitron"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingBonus}
                  className="w-full py-3 bg-gray-900 hover:bg-[#FF0033] text-white font-orbitron font-bold text-xs rounded-xl uppercase tracking-wider"
                >
                  {isSubmittingBonus ? 'Enviando...' : 'CONCEDER FREE SPINS'}
                </button>
              </form>
            </div>

            {/* List active free spins */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
              <h4 className="font-orbitron font-bold text-xs uppercase text-gray-800">Giros Grátis Ativos</h4>
              {freeSpins.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-gray-200 rounded-2xl text-xs text-gray-400 font-sans">
                  Nenhum bônus ou giro grátis ativo cadastrado em base local.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                        <th className="py-3 px-4">Jogador</th>
                        <th className="py-3 px-4">Jogo</th>
                        <th className="py-3 px-4">Quantidade</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {freeSpins.map(sp => (
                        <tr key={sp.id} className="hover:bg-gray-50/50">
                          <td className="py-3 px-4 font-bold">{sp.userName}</td>
                          <td className="py-3 px-4 font-mono text-gray-600">{sp.gameCode}</td>
                          <td className="py-3 px-4 font-orbitron font-bold">{sp.quantity} Giros</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleDeleteFreeSpin(sp.id)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-[#FF0033] rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 9. DIAGNÓSTICOS (Diagnostics) */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Checklist & State Statuses */}
              <div className="lg:col-span-2 bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-6">
                <div className="flex items-center space-x-2 text-[#FF0033] border-b border-gray-100 pb-3">
                  <ShieldCheck className="w-5 h-5 animate-pulse" />
                  <h3 className="font-orbitron font-bold text-sm uppercase text-gray-900">Configuração da Integração PlayFivers</h3>
                </div>

                {isFetchingDiagnostics ? (
                  <div className="flex items-center space-x-2 text-xs text-gray-500 py-6 font-orbitron">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#FF0033]" />
                    <span>Carregando parâmetros de segurança...</span>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 text-xs">
                    <div className="flex justify-between py-3">
                      <span className="font-orbitron text-gray-400 uppercase tracking-wider font-bold">PLAYFIVERS_BASE_URL:</span>
                      <span className="font-mono text-gray-800">{diagnosticsData?.PLAYFIVERS_BASE_URL || 'https://api.playfivers.com'}</span>
                    </div>

                    <div className="flex justify-between py-3 items-center">
                      <span className="font-orbitron text-gray-400 uppercase tracking-wider font-bold">AGENT TOKEN:</span>
                      <span className={`font-orbitron font-black text-[10px] px-2.5 py-1 rounded-md ${
                        diagnosticsData?.AGENT_TOKEN_CONFIGURED === 'CONFIGURADO'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-[#FF0033] border border-red-100'
                      }`}>
                        {diagnosticsData?.AGENT_TOKEN_CONFIGURED || 'NÃO CONFIGURADO'}
                      </span>
                    </div>

                    <div className="flex justify-between py-3 items-center">
                      <span className="font-orbitron text-gray-400 uppercase tracking-wider font-bold">SECRET KEY:</span>
                      <span className={`font-orbitron font-black text-[10px] px-2.5 py-1 rounded-md ${
                        diagnosticsData?.SECRET_KEY_CONFIGURED === 'CONFIGURADA'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-[#FF0033] border border-red-100'
                      }`}>
                        {diagnosticsData?.SECRET_KEY_CONFIGURED || 'NÃO CONFIGURADA'}
                      </span>
                    </div>

                    <div className="flex justify-between py-3 items-center">
                      <span className="font-orbitron text-gray-400 uppercase tracking-wider font-bold">PLAYFIVERS ENABLED:</span>
                      <span className={`font-orbitron font-black text-[10px] px-2.5 py-1 rounded-md ${
                        diagnosticsData?.PLAYFIVERS_ENABLED
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {diagnosticsData?.PLAYFIVERS_ENABLED ? 'SIM' : 'NÃO'}
                      </span>
                    </div>

                    <div className="flex justify-between py-3 items-center">
                      <span className="font-orbitron text-gray-400 uppercase tracking-wider font-bold">REAL MONEY:</span>
                      <span className={`font-orbitron font-black text-[10px] px-2.5 py-1 rounded-md ${
                        diagnosticsData?.REAL_MONEY_GAMER_ENABLED
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-[#FF0033] border border-red-100'
                      }`}>
                        {diagnosticsData?.REAL_MONEY_GAMER_ENABLED ? 'SIM' : 'NÃO'}
                      </span>
                    </div>

                    <div className="flex justify-between py-3 items-center">
                      <span className="font-orbitron text-gray-400 uppercase tracking-wider font-bold">ALLOW NON ORIGINAL:</span>
                      <span className={`font-orbitron font-black text-[10px] px-2.5 py-1 rounded-md ${
                        diagnosticsData?.ALLOW_NON_ORIGINAL_GAMES
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {diagnosticsData?.ALLOW_NON_ORIGINAL_GAMES ? 'SIM' : 'NÃO'}
                      </span>
                    </div>

                    <div className="flex justify-between py-3 items-center">
                      <span className="font-orbitron text-gray-400 uppercase tracking-wider font-bold">USER RTP OVERRIDE:</span>
                      <span className={`font-orbitron font-black text-[10px] px-2.5 py-1 rounded-md ${
                        diagnosticsData?.PLAYFIVERS_USER_RTP_OVERRIDE_ENABLED
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {diagnosticsData?.PLAYFIVERS_USER_RTP_OVERRIDE_ENABLED ? 'SIM' : 'NÃO'}
                      </span>
                    </div>

                    <div className="flex justify-between py-3 items-center">
                      <span className="font-orbitron text-gray-400 uppercase tracking-wider font-bold">WEBHOOK HMAC:</span>
                      <span className="font-orbitron font-black text-[10px] px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
                        {diagnosticsData?.PLAYFIVERS_WEBHOOK_HMAC_SUPPORTED ? 'SIM' : 'NÃO / NÃO DOCUMENTADO'}
                      </span>
                    </div>

                    <div className="flex justify-between py-3 items-center">
                      <span className="font-orbitron text-gray-400 uppercase tracking-wider font-bold">EGRESS TYPE:</span>
                      <span className={`font-orbitron font-black text-[10px] px-2.5 py-1 rounded-md ${
                        diagnosticsData?.EGRESS_TYPE === 'STATIC'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {diagnosticsData?.EGRESS_TYPE || 'DYNAMIC'}
                      </span>
                    </div>

                    <div className="flex justify-between py-3 items-center">
                      <span className="font-orbitron text-gray-400 uppercase tracking-wider font-bold">STATIC IP:</span>
                      <span className="font-mono text-gray-800 font-bold">{diagnosticsData?.STATIC_IP || 'N/A'}</span>
                    </div>

                    <div className="flex justify-between py-3 items-center">
                      <span className="font-orbitron text-gray-400 uppercase tracking-wider font-bold">CLOUD NAT:</span>
                      <span className={`font-orbitron font-black text-[10px] px-2.5 py-1 rounded-md ${
                        diagnosticsData?.CLOUD_NAT === 'CONFIGURADO'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-[#FF0033] border border-red-100'
                      }`}>
                        {diagnosticsData?.CLOUD_NAT || 'NÃO CONFIGURADO'}
                      </span>
                    </div>

                    <div className="flex justify-between py-3 items-center">
                      <span className="font-orbitron text-gray-400 uppercase tracking-wider font-bold">VPC EGRESS:</span>
                      <span className={`font-orbitron font-black text-[10px] px-2.5 py-1 rounded-md ${
                        diagnosticsData?.VPC_EGRESS === 'CONFIGURADO'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-[#FF0033] border border-red-100'
                      }`}>
                        {diagnosticsData?.VPC_EGRESS || 'NÃO CONFIGURADO'}
                      </span>
                    </div>

                    <div className="flex justify-between py-3 items-center">
                      <span className="font-orbitron text-gray-400 uppercase tracking-wider font-bold">PLAYFIVERS WHITELIST:</span>
                      <span className={`font-orbitron font-black text-[10px] px-2.5 py-1 rounded-md ${
                        diagnosticsData?.IP_WHITELIST_STATUS === 'OK'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : diagnosticsData?.IP_WHITELIST_STATUS === 'ERRO'
                          ? 'bg-red-50 text-[#FF0033] border border-red-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {diagnosticsData?.IP_WHITELIST_STATUS || 'PENDENTE'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Server IP Whitelisting & Test Connection Endpoint Trigger */}
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-6">
                <div>
                  <h4 className="font-orbitron font-bold text-xs uppercase text-gray-900 mb-1">IP de Saída do Servidor</h4>
                  <p className="text-gray-500 text-[11px] font-sans">Este é o IP de saída do backend da Lockdown. Cadastre este endereço no painel do parceiro:</p>
                  
                  <div className="mt-3 p-3.5 bg-gray-50 border border-gray-200 rounded-2xl font-mono text-center text-sm font-black text-gray-900 select-all tracking-wider break-all">
                    {diagnosticsData?.OUTBOUND_IP || 'Carregando...'}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-5 space-y-3">
                  <h4 className="font-orbitron font-bold text-xs uppercase text-gray-900">Teste de Conexão</h4>
                  <p className="text-gray-500 text-[11px] font-sans">Executa uma chamada de auditoria direta para validar se as credenciais e o IP estão autorizados na PlayFivers API.</p>
                  
                  <button
                    onClick={handleTestConnection}
                    disabled={testConnectionStatus === 'TESTING'}
                    className="w-full py-3 bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs rounded-2xl uppercase tracking-wider transition-colors shadow-sm disabled:opacity-50"
                  >
                    {testConnectionStatus === 'TESTING' ? 'CONECTANDO...' : 'TESTAR CONEXÃO PLAYFIVERS'}
                  </button>

                  {testConnectionStatus === 'CONECTADO' && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 rounded-xl text-xs font-orbitron font-bold text-center uppercase tracking-wider">
                      CONECTADO
                    </div>
                  )}

                  {testConnectionStatus === 'ERRO' && (
                    <div className="p-3.5 bg-red-50 border border-red-100 text-[#FF0033] rounded-2xl text-xs text-left space-y-1">
                      <p className="font-orbitron font-bold uppercase tracking-wider text-[10px]">ERRO</p>
                      <p className="font-sans text-[11px] leading-relaxed break-words">{testConnectionError}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Local Webhook Testing Simulator Console */}
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 text-gray-900">
                <Settings className="w-5 h-5 text-gray-400" />
                <h4 className="font-orbitron font-bold text-xs uppercase">Simular Endpoints Localmente</h4>
              </div>
              <p className="text-xs text-gray-500 font-sans">
                Para fins de testes e homologação rápida do fluxo de saldo e apostas, execute simulações simulando transações do provedor PGSOFT.
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={runDiagnostics}
                  disabled={isTestingDiag}
                  className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white font-orbitron font-bold text-[10px] rounded-xl uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  {isTestingDiag ? 'Executando...' : 'RODAR BATERIA DE TESTES DE WEBHOOK'}
                </button>
              </div>

              {diagnosticLog.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-gray-200 bg-gray-950 text-white rounded-3xl p-5 font-mono text-[10px] space-y-1 max-h-80 overflow-y-auto"
                >
                  {diagnosticLog.map((log, index) => (
                    <p key={index} className="border-b border-gray-900 pb-1.5">{log}</p>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* 10. CONFIGURAÇÕES (Settings) */}
        {activeTab === 'settings' && (
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xs space-y-6">
            <div>
              <h3 className="font-orbitron font-bold text-sm text-gray-800 uppercase">Configurações Seguras do Sistema</h3>
              <p className="text-xs text-gray-500 font-sans mt-0.5">Parâmetros confidenciais gerenciados sob criptografia backend.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-sans">
              <div className="space-y-4 p-5 bg-gray-50 border border-gray-100 rounded-2xl">
                <h4 className="font-orbitron font-bold text-[10px] uppercase text-[#FF0033]">Webhook URL para PlayFivers</h4>
                <p className="text-gray-500">Cadastre a URL de Webhook abaixo no painel de administração da PlayFivers API v2:</p>
                <div className="p-3 bg-white border border-gray-200 rounded-xl font-mono text-xs select-all break-all text-gray-800">
                  {window.location.origin}/api/webhook
                </div>
              </div>

              <div className="space-y-4 p-5 bg-gray-50 border border-gray-100 rounded-2xl">
                <h4 className="font-orbitron font-bold text-[10px] uppercase text-[#FF0033]">Guia de Chaves de Ambiente</h4>
                <p className="text-gray-500">As variáveis confidenciais devem ser definidas na aba Settings do painel de controle:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-gray-600">
                  <li><strong>PLAYFIVERS_ENABLED</strong>: true/false</li>
                  <li><strong>PLAYFIVERS_BASE_URL</strong>: https://api.playfivers.com</li>
                  <li><strong>PLAYFIVERS_AGENT_TOKEN</strong>: Chave única de agência</li>
                  <li><strong>PLAYFIVERS_SECRET_KEY</strong>: Chave secreta de autenticação</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
