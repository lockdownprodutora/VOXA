import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Ticket, 
  ShoppingBag, 
  Award, 
  ArrowLeft, 
  Shield, 
  Activity,
  TrendingUp,
  Building,
  Users,
  HardDrive,
  MessageSquare,
  Gift,
  Gamepad2,
  Megaphone,
  DollarSign,
  Menu,
  X,
  LayoutGrid,
  Trophy,
  HeartHandshake,
  Video
} from 'lucide-react';
import { AdminModuleType } from '../types';
import { TicketModule } from './admin/TicketModule';
import { StoreModule } from './admin/StoreModule';
import { AssinaturaModule } from './admin/AssinaturaModule';
import { SorteiosModule } from './admin/SorteiosModule';
import { DashboardOverview } from './admin/DashboardOverview';
import { CompanyConfigModule } from './admin/CompanyConfigModule';
import { UsersModule } from './admin/UsersModule';
import { DriveModule } from './admin/DriveModule';
import { SupportRequestsModule } from './admin/SupportRequestsModule';
import { LeagueModule } from './admin/LeagueModule';
import { GamerModule } from './admin/GamerModule';
import { AdsModule } from './admin/AdsModule';
import { VoxModModule } from './admin/VoxModModule';
import { SocialDiagnosticsModule } from './admin/SocialDiagnosticsModule';
import { VaquinhasModule } from './admin/VaquinhasModule';
import { getGlobalCompanyLogo, getGlobalCompanyName } from '../utils/company';
import { fetchCompanySettings } from '../utils/storeDb';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { checkDriveConnection } from '../utils/upload';

import { FinanceiroModule } from './admin/FinanceiroModule';
import { TradeAdminModule } from './admin/TradeAdminModule';
import { TradeSettingsDashboard } from './admin/TradeSettingsDashboard';
import { InvestAdminModule } from './admin/InvestAdminModule';
import { VoxaAiAdminModule } from './admin/VoxaAiAdminModule';

interface AdminPanelProps {
  onBackToPublic: () => void;
}

const MODULE_LABELS: Record<string, string> = {
  menu: 'Central de Operação VOXA',
  overview: 'Overview • Inteligência em Tempo Real',
  users: 'Gestão de Usuários & RBAC',
  league: 'Indicações & League Ranking',
  ticket: 'Tickets & Eventos',
  store: 'VOXA Store & Marketplace',
  assinatura: 'Clubes & Assinaturas VIP',
  sorteios: 'Sorteios Oficiais',
  support_requests: 'Solicitações & Suporte',
  drive: 'Google Drive Cloud',
  config: 'Configurações & Mercado Pago',
  gamer: 'Arena Gamer & PlayFivers',
  ads: 'VOXA Ads • Publicidade',
  vox: 'VOX • Moderação Social',
  social_diagnostics: 'Diagnóstico da Rede Social',
  vaquinhas: 'Vaquinhas & Campanhas',
  financeiro: 'Financeiro, Carteiras & Ledger',
  trade: 'VOXA Trade • Mercado Real',
  trade_settings: 'Trade Settings • Parâmetros & Limites (trade_settings/global)',
  invest: 'VOXA Invest • Produtos Cripto & Apuração Real',
  voxa_ai: 'VOXA AI • VOXA Presenter & Biblioteca Interna'
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToPublic }) => {
  const [currentModule, setCurrentModule] = useState<AdminModuleType>('menu');
  const [hoveredModule, setHoveredModule] = useState<AdminModuleType | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [logoUrl, setLogoUrl] = useState(getGlobalCompanyLogo());
  const [companyName, setCompanyName] = useState(getGlobalCompanyName());

  // Real logged-in user state
  const [currentUser] = useState<{ uid?: string; id?: string; name: string; email: string; role?: string; adminRole?: string; photoURL?: string } | null>(() => {
    const saved = localStorage.getItem('voxa_current_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });

  const [adminRole, setAdminRole] = useState<'SUPER_ADMIN' | 'ADMINISTRATOR' | 'MANAGER' | 'SUPPORT' | 'NONE'>('NONE');
  const [adminRoleLoading, setAdminRoleLoading] = useState(true);

  React.useEffect(() => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) {
      setAdminRole('NONE');
      setAdminRoleLoading(false);
      return;
    }

    const email = (currentUser?.email || '').toLowerCase().trim();
    const isBootstrappedSuperAdmin =
      email === 'lockdownprodutora@gmail.com' ||
      email === 'admin@lockdownprodutora.com.br' ||
      email.endsWith('@lockdownprodutora.com.br') ||
      uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' ||
      uid === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1';

    const syncLocalRole = (nextRole: 'SUPER_ADMIN' | 'ADMINISTRATOR' | 'MANAGER' | 'SUPPORT' | 'NONE') => {
      setAdminRole(nextRole);
      setAdminRoleLoading(false);
      try {
        const saved = localStorage.getItem('voxa_current_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.uid === uid || parsed.id === uid) {
            parsed.adminRole = nextRole;
            parsed.isAdmin = ['SUPER_ADMIN', 'ADMINISTRATOR'].includes(nextRole);
            localStorage.setItem('voxa_current_user', JSON.stringify(parsed));
          }
        }
      } catch {}
    };

    const loadRoleFallback = async () => {
      try {
        const res = await fetch(`/api/admin/my-role?adminUid=${uid}`, {
          headers: { "x-admin-uid": uid }
        });
        const data = await res.json();
        if (data.success && data.role && data.role !== 'NONE') {
          syncLocalRole(data.role);
        } else if (isBootstrappedSuperAdmin) {
          syncLocalRole('SUPER_ADMIN');
        } else {
          syncLocalRole('NONE');
        }
      } catch {
        if (isBootstrappedSuperAdmin) {
          syncLocalRole('SUPER_ADMIN');
        } else {
          syncLocalRole('NONE');
        }
      }
    };

    let unsubSnapshot: (() => void) | undefined;

    if (isFirebaseConfigured()) {
      unsubSnapshot = onSnapshot(
        doc(db, 'admin_users', uid),
        (adminSnap) => {
          if (adminSnap.exists()) {
            const role = String(adminSnap.data()?.role || '').toUpperCase().trim();
            if (['SUPER_ADMIN', 'ADMINISTRATOR', 'MANAGER', 'SUPPORT'].includes(role)) {
              syncLocalRole(role as any);
              return;
            }
          }
          if (isBootstrappedSuperAdmin) {
            syncLocalRole('SUPER_ADMIN');
          } else {
            loadRoleFallback();
          }
        },
        () => {
          loadRoleFallback();
        }
      );
    } else {
      loadRoleFallback();
    }

    const handleRoleEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.uid === uid && detail?.role) {
        const r = String(detail.role).toUpperCase().trim();
        if (['SUPER_ADMIN', 'ADMINISTRATOR', 'MANAGER', 'SUPPORT', 'NONE'].includes(r)) {
          syncLocalRole((r === 'NONE' && isBootstrappedSuperAdmin ? 'SUPER_ADMIN' : r) as any);
        }
      }
    };
    window.addEventListener('voxa_admin_role_updated', handleRoleEvent);

    return () => {
      if (unsubSnapshot) unsubSnapshot();
      window.removeEventListener('voxa_admin_role_updated', handleRoleEvent);
    };
  }, [currentUser]);

  // Immediately revalidate active module whenever adminRole changes via Firestore snapshot
  React.useEffect(() => {
    if (adminRoleLoading) return;
    if (currentModule !== 'menu') {
      const allowed =
        adminRole === 'SUPER_ADMIN' ||
        adminRole === 'ADMINISTRATOR' ||
        (adminRole === 'MANAGER' && currentModule !== 'config' && currentModule !== 'gamer' && currentModule !== 'financeiro' && currentModule !== 'trade' && currentModule !== 'trade_settings') ||
        (adminRole === 'SUPPORT' && currentModule === 'support_requests');
      if (!allowed) {
        setCurrentModule('menu');
      }
    }
  }, [adminRole, adminRoleLoading, currentModule]);

  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await fetchCompanySettings();
        if (settings) {
          setLogoUrl(settings.logoUrl);
          setCompanyName(settings.tradeName || settings.companyName || 'VOXA');
        }
      } catch (err) {
        console.error("Failed to fetch settings in admin panel:", err);
      }
    };
    loadSettings();

    const handleSettingsUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.settings) {
        setLogoUrl(detail.settings.logoUrl || '');
        setCompanyName(detail.settings.tradeName || detail.settings.companyName || 'VOXA');
      }
    };
    window.addEventListener('company_settings_updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('company_settings_updated', handleSettingsUpdated);
    };
  }, []);

  const [driveConnected, setDriveConnected] = useState<boolean | null>(null);

  React.useEffect(() => {
    const checkConnection = async () => {
      try {
        const active = await checkDriveConnection();
        setDriveConnected(active);
      } catch {
        setDriveConnected(false);
      }
    };
    checkConnection();
  }, []);

  const addToast = (_title: string, _message: string, _type: 'drop' | 'meta' | 'warning' | 'success') => {
    // Sistema de notificações do painel Admin desativado por solicitação
  };

  const handleCardHover = (mod: AdminModuleType) => {
    setHoveredModule(mod);
  };

  const handleCardLeave = () => {
    setHoveredModule(null);
  };

  const canSeeModule = (mod: AdminModuleType) => {
    if (adminRole === 'SUPER_ADMIN' || adminRole === 'ADMINISTRATOR') return true;
    if (adminRole === 'MANAGER') {
      if (mod === 'config' || mod === 'gamer' || mod === 'financeiro' || mod === 'trade' || mod === 'trade_settings') return false;
      return true;
    }
    if (adminRole === 'SUPPORT') {
      return mod === 'support_requests';
    }
    return false;
  };

  const handleSelectModule = (mod: AdminModuleType) => {
    if (mod !== 'menu' && !canSeeModule(mod)) {
      return;
    }
    setCurrentModule(mod);
    setMobileMenuOpen(false);
  };

  const navModules: { id: AdminModuleType; label: string; icon: any; category: string }[] = [
    { id: 'voxa_ai', label: 'VOXA AI • Presenter', icon: Video, category: 'VOXA AI' },
    { id: 'overview', label: 'Overview & Presença', icon: TrendingUp, category: 'CRESCIMENTO' },
    { id: 'league', label: 'Indicações & League', icon: Trophy, category: 'CRESCIMENTO' },
    { id: 'ads', label: 'VOXA Ads', icon: Megaphone, category: 'CRESCIMENTO' },
    { id: 'users', label: 'Usuários & Cargos', icon: Users, category: 'MODERAÇÃO' },
    { id: 'vox', label: 'VOX Moderação', icon: MessageSquare, category: 'MODERAÇÃO' },
    { id: 'support_requests', label: 'Solicitações & Suporte', icon: Shield, category: 'MODERAÇÃO' },
    { id: 'social_diagnostics', label: 'Diagnóstico Social', icon: Activity, category: 'MODERAÇÃO' },
    { id: 'financeiro', label: 'Financeiro & Carteiras', icon: DollarSign, category: 'FINANÇAS' },
    { id: 'invest', label: 'VOXA Invest (Cripto)', icon: TrendingUp, category: 'FINANÇAS' },
    { id: 'trade', label: 'VOXA Trade (Real)', icon: TrendingUp, category: 'FINANÇAS' },
    { id: 'trade_settings', label: 'Trade Settings (Global)', icon: Activity, category: 'FINANÇAS' },
    { id: 'store', label: 'VOXA Store', icon: ShoppingBag, category: 'FINANÇAS' },
    { id: 'ticket', label: 'Tickets & Eventos', icon: Ticket, category: 'FINANÇAS' },
    { id: 'assinatura', label: 'Assinaturas VIP', icon: Award, category: 'FINANÇAS' },
    { id: 'sorteios', label: 'Sorteios Oficiais', icon: Gift, category: 'FINANÇAS' },
    { id: 'vaquinhas', label: 'Vaquinhas', icon: HeartHandshake, category: 'FINANÇAS' },
    { id: 'config', label: 'Empresa & Mercado Pago', icon: Building, category: 'INTEGRAÇÕES' },
    { id: 'drive', label: 'Google Drive Cloud', icon: HardDrive, category: 'INTEGRAÇÕES' },
    { id: 'gamer', label: 'Arena Gamer & PlayFivers', icon: Gamepad2, category: 'INTEGRAÇÕES' },
  ];

  const getRoleBadgeLabel = (r: string) => {
    if (r === 'SUPER_ADMIN') return 'SUPER ADMIN';
    if (r === 'ADMINISTRATOR') return 'ADMINISTRADOR';
    if (r === 'MANAGER') return 'GERENTE';
    if (r === 'SUPPORT') return 'SUPORTE';
    return r;
  };

  return (
    <div className="min-h-screen bg-gray-50 text-black relative overflow-x-hidden flex flex-col justify-between selection:bg-[#FF0033] selection:text-white">
      {/* Top Header - Responsive for Mobile & Desktop */}
      <header className="border-b border-gray-200 bg-white px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-40 shadow-sm sticky top-0">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          {adminRole !== 'NONE' && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-xl text-gray-800 hover:text-black transition-all cursor-pointer shrink-0"
              aria-label="Abrir Menu Administrativo"
              title="Menu Administrativo"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={onBackToPublic}
            className="hidden sm:flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3.5 py-2 rounded-xl text-xs font-orbitron text-gray-700 hover:text-black transition-all cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>SAIR DO PAINEL</span>
          </button>
          
          <div className="flex items-center space-x-2.5 min-w-0">
            {logoUrl && (
              <div className="w-8 h-8 rounded-xl bg-gray-100 border border-gray-300 overflow-hidden flex items-center justify-center shrink-0">
                <img src={logoUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex flex-col text-left min-w-0">
              <span className="font-orbitron font-black text-xs sm:text-sm tracking-wider text-black leading-none truncate">
                {MODULE_LABELS[currentModule] || companyName}
              </span>
              <span className="font-orbitron text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1 truncate">
                {companyName} • Painel Admin
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
          <div className={`hidden lg:flex items-center space-x-2 border px-3.5 py-2 rounded-xl text-xs font-orbitron ${
            isFirebaseConfigured() ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            <Activity className={`w-4 h-4 ${isFirebaseConfigured() ? 'text-green-600' : 'text-amber-500 animate-pulse'}`} />
            <span>{isFirebaseConfigured() ? 'CLOUD: CONECTADO' : 'MODO: LOCAL'}</span>
          </div>

          <div className={`hidden xl:flex items-center space-x-2 border px-3.5 py-2 rounded-xl text-xs font-orbitron ${
            driveConnected === true ? 'bg-green-50 border-green-200 text-green-700' : driveConnected === false ? 'bg-red-50 border-red-200 text-[#FF0033]' : 'bg-gray-50 border-gray-200 text-gray-500'
          }`}>
            <HardDrive className={`w-4 h-4 ${driveConnected === true ? 'text-green-600' : driveConnected === false ? 'text-[#FF0033]' : 'text-gray-400'}`} />
            <span>{driveConnected === true ? 'DRIVE: OK' : driveConnected === false ? 'DRIVE: OFF' : 'DRIVE...'}</span>
          </div>

          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-[#FF0033] text-white font-orbitron font-black flex items-center justify-center shadow-md shrink-0 border border-white/25">
              {currentUser?.photoURL ? (
                <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-black font-orbitron">{currentUser?.name?.charAt(0).toUpperCase() || 'A'}</span>
              )}
            </div>
            <div className="hidden md:block text-left max-w-[150px]">
              <span className="font-orbitron font-bold text-xs block text-black truncate leading-tight">{currentUser?.name || 'Administrador'}</span>
              <span className="text-[10px] text-gray-500 block truncate leading-tight">{currentUser?.email || ''}</span>
              {adminRole !== 'NONE' && (
                <span className="text-[8px] text-[#FF0033] font-orbitron font-bold uppercase tracking-widest block">
                  {getRoleBadgeLabel(adminRole)}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onBackToPublic}
            className="sm:hidden flex items-center justify-center p-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-xl text-xs font-orbitron text-gray-700 hover:text-black transition-all cursor-pointer"
            title="Sair do Painel"
            aria-label="Sair do Painel"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile & Quick Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="relative w-full max-w-[290px] bg-white border-r border-gray-200 h-full flex flex-col justify-between p-5 overflow-y-auto z-10 shadow-2xl"
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex items-center space-x-2.5">
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="w-8 h-8 rounded-xl object-cover border border-gray-200" />
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center font-orbitron font-black text-xs">V</div>
                    )}
                    <div className="text-left">
                      <span className="font-orbitron font-black text-sm text-black block leading-none">{companyName}</span>
                      <span className="font-orbitron text-[9px] text-[#FF0033] font-bold uppercase tracking-widest">Menu Admin</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:text-black cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <nav className="space-y-1 text-left">
                  <button
                    onClick={() => handleSelectModule('menu')}
                    className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl font-orbitron font-bold text-xs transition-all cursor-pointer ${
                      currentModule === 'menu'
                        ? 'bg-[#FF0033] text-white shadow-sm'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4 shrink-0" />
                    <span>Menu Principal</span>
                  </button>

                  {navModules.filter(m => canSeeModule(m.id)).map((item) => {
                    const Icon = item.icon;
                    const active = currentModule === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectModule(item.id)}
                        className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl font-orbitron font-bold text-xs transition-all cursor-pointer ${
                          active
                            ? 'bg-black text-white shadow-sm'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-gray-200 space-y-3">
                <div className="flex items-center space-x-2.5 bg-gray-50 p-3 rounded-2xl border border-gray-200 text-left">
                  <div className="w-9 h-9 rounded-xl overflow-hidden bg-[#FF0033] text-white font-orbitron font-black flex items-center justify-center shrink-0">
                    {currentUser?.photoURL ? (
                      <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs">{currentUser?.name?.charAt(0).toUpperCase() || 'A'}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-orbitron font-bold text-xs text-black block truncate">{currentUser?.name || 'Admin'}</span>
                    <span className="text-[9px] font-orbitron font-bold text-[#FF0033] uppercase block truncate">
                      {getRoleBadgeLabel(adminRole)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onBackToPublic();
                  }}
                  className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 py-3 px-4 rounded-xl text-xs font-orbitron font-bold text-gray-800 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>SAIR DO PAINEL</span>
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Workspace Area */}
      <main className="flex-1 relative flex flex-col items-center justify-start sm:justify-center p-3 sm:p-6 z-20 w-full max-w-full overflow-x-hidden">
        {adminRoleLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-[#FF0033] rounded-full animate-spin"></div>
            <span className="font-orbitron font-bold text-xs text-gray-500 uppercase tracking-widest">Verificando Credenciais VOXA...</span>
          </div>
        ) : adminRole === "NONE" ? (
          <div className="bg-white border-2 border-red-200 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-6 shadow-xl my-8">
            <span className="font-orbitron text-red-500 text-5xl sm:text-6xl block">⚠️</span>
            <h2 className="font-orbitron font-black text-xl sm:text-2xl text-black">ACESSO RESTRITO</h2>
            <p className="text-gray-600 text-xs font-sans leading-relaxed">
              Você não possui cargo cadastrado no sistema administrativo. Solicite a um Administrador a vinculação do seu UID para liberar acesso.
            </p>
            <button
              onClick={onBackToPublic}
              className="bg-[#FF0033] hover:bg-[#d6002b] text-white font-orbitron font-black text-xs py-3.5 px-6 rounded-xl transition-all w-full cursor-pointer uppercase"
            >
              VOLTAR PARA A VOXA
            </button>
          </div>
        ) : (
          <>
            {currentModule === 'menu' && (
              <div className="w-full max-w-7xl mx-auto space-y-8 sm:space-y-10 py-2 sm:py-4">
                <div className="text-center space-y-2 sm:space-y-3 px-2">
                  <span className="font-orbitron text-[10px] sm:text-xs text-[#FF0033] tracking-widest block font-bold uppercase">
                    CENTRAL DE OPERAÇÃO DO ECOSSISTEMA VOXA
                  </span>
                  <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black font-orbitron tracking-tight text-black leading-tight uppercase">
                    PAINEL DE <span className="text-[#FF0033]">OPERAÇÃO</span> VOXA
                  </h1>
                  <p className="text-gray-600 text-xs sm:text-sm max-w-2xl mx-auto font-sans">
                    Arquitetura operacional organizada em Crescimento, Moderação, Finanças & Comércio e Integrações Oficiais.
                  </p>
                </div>

                {[
                  {
                    sectionTitle: '1. CRESCIMENTO, INTELIGÊNCIA & AQUISIÇÃO',
                    sectionSubtitle: 'Presença online em tempo real, geolocalização aproximada, programa de indicações com carteira promocional e VOXA Ads.',
                    items: [
                      {
                        id: 'overview' as AdminModuleType,
                        badge: 'TEMPO REAL',
                        title: 'OVERVIEW & PRESENÇA',
                        desc: 'Usuários online agora, geolocalização aproximada por estado/cidade, cadastros e engajamento real.',
                        icon: TrendingUp,
                        accent: 'text-[#FF0033]',
                        borderHover: 'hover:border-[#FF0033]'
                      },
                      {
                        id: 'league' as AdminModuleType,
                        badge: 'INDICAÇÕES & BÔNUS',
                        title: 'INDICAÇÕES & LEAGUE',
                        desc: 'Configuração de bônus na Carteira Promocional separada, auditoria antifraude de convites e 10 divisões.',
                        icon: Trophy,
                        accent: 'text-purple-600',
                        borderHover: 'hover:border-purple-600'
                      },
                      {
                        id: 'ads' as AdminModuleType,
                        badge: 'PUBLICIDADE',
                        title: 'VOXA ADS',
                        desc: 'Campanhas patrocinadas no feed, aprovação de criativos e faturamento publicitário.',
                        icon: Megaphone,
                        accent: 'text-[#FF0033]',
                        borderHover: 'hover:border-[#FF0033]'
                      },
                      {
                        id: 'voxa_ai' as AdminModuleType,
                        badge: 'MODO INTERNO',
                        title: 'VOXA AI • PRESENTER',
                        desc: 'VOXA Presenter / Avatar Studio exclusivo Admin (presenterPublicEnabled = false), preset VOXA OFFICIAL STUDIO e Biblioteca Interna.',
                        icon: Video,
                        accent: 'text-[#FF0033]',
                        borderHover: 'hover:border-[#FF0033]'
                      }
                    ]
                  },
                  {
                    sectionTitle: '2. MODERAÇÃO, COMUNIDADE & SEGURANÇA',
                    sectionSubtitle: 'Gestão de contas, cargos administrativos (RBAC), moderação de publicações VOX, suporte e integridade do grafo social.',
                    items: [
                      {
                        id: 'users' as AdminModuleType,
                        badge: 'CONTAS & RBAC',
                        title: 'USUÁRIOS & CARGOS',
                        desc: 'Gestão de membros reais, selos de verificação, suspensão e cargos administrativos canônicos.',
                        icon: Users,
                        accent: 'text-[#FF0033]',
                        borderHover: 'hover:border-[#FF0033]'
                      },
                      {
                        id: 'vox' as AdminModuleType,
                        badge: 'FEED SOCIAL',
                        title: 'VOX MODERAÇÃO',
                        desc: 'Auditoria de posts, enquetes, denúncias e remoção de conteúdo impróprio em tempo real.',
                        icon: MessageSquare,
                        accent: 'text-[#FF0033]',
                        borderHover: 'hover:border-[#FF0033]'
                      },
                      {
                        id: 'support_requests' as AdminModuleType,
                        badge: 'ATENDIMENTO',
                        title: 'SOLICITAÇÕES & SUPORTE',
                        desc: 'Central de chamados, aprovações operacionais de vendedores, eventos e suporte ao usuário.',
                        icon: Shield,
                        accent: 'text-[#FF0033]',
                        borderHover: 'hover:border-[#FF0033]'
                      },
                      {
                        id: 'social_diagnostics' as AdminModuleType,
                        badge: 'INTEGRIDADE',
                        title: 'DIAGNÓSTICO SOCIAL',
                        desc: 'Auditoria da malha de seguidores, reconciliação de contadores e perfis oficiais.',
                        icon: Activity,
                        accent: 'text-[#FF0033]',
                        borderHover: 'hover:border-[#FF0033]'
                      }
                    ]
                  },
                  {
                    sectionTitle: '3. FINANÇAS, MERCADO REAL & COMÉRCIO',
                    sectionSubtitle: 'Livro-razão auditável, saldos reais vs. carteira promocional, operações VOXA Trade e marketplace.',
                    items: [
                      {
                        id: 'financeiro' as AdminModuleType,
                        badge: 'CAIXA & LEDGER',
                        title: 'FINANCEIRO & CARTEIRAS',
                        desc: 'Custódia real, carteira promocional separada, depósitos PIX, Sussurros e ajustes com auditoria.',
                        icon: DollarSign,
                        accent: 'text-emerald-600',
                        borderHover: 'hover:border-emerald-600'
                      },
                      {
                        id: 'invest' as AdminModuleType,
                        badge: 'CRIPTOATIVOS & LOCK-UP',
                        title: 'VOXA INVEST',
                        desc: 'Produtos configuráveis (Start, Plus, Prime, Black, Infinity), faixas de aporte, lock-up de 6 meses e registro de resultados reais.',
                        icon: TrendingUp,
                        accent: 'text-[#FF0033]',
                        borderHover: 'hover:border-[#FF0033]'
                      },
                      {
                        id: 'trade' as AdminModuleType,
                        badge: 'SALDO REAL',
                        title: 'VOXA TRADE',
                        desc: 'Operações binárias com saldo real disponível, exposição da plataforma, payouts e cotações reais.',
                        icon: TrendingUp,
                        accent: 'text-emerald-600',
                        borderHover: 'hover:border-emerald-600'
                      },
                      {
                        id: 'trade_settings' as AdminModuleType,
                        badge: 'PARÂMETROS & RISCO',
                        title: 'TRADE SETTINGS',
                        desc: 'Controle direto de trade_settings/global: status da plataforma, payout (%), taxas, stakes e limites de exposição.',
                        icon: Activity,
                        accent: 'text-[#FF0033]',
                        borderHover: 'hover:border-[#FF0033]'
                      },
                      {
                        id: 'store' as AdminModuleType,
                        badge: 'MARKETPLACE',
                        title: 'VOXA STORE',
                        desc: 'Catálogo de produtos físicos e digitais, pedidos, comissões e repasses a vendedores.',
                        icon: ShoppingBag,
                        accent: 'text-[#FF0033]',
                        borderHover: 'hover:border-[#FF0033]'
                      },
                      {
                        id: 'ticket' as AdminModuleType,
                        badge: 'BILHETERIA',
                        title: 'TICKETS & EVENTOS',
                        desc: 'Gestão de eventos, lotes de ingressos, check-in e faturamento de bilheteria.',
                        icon: Ticket,
                        accent: 'text-[#FF0033]',
                        borderHover: 'hover:border-[#FF0033]'
                      },
                      {
                        id: 'assinatura' as AdminModuleType,
                        badge: 'RECORRÊNCIA',
                        title: 'ASSINATURAS VIP',
                        desc: 'Planos de assinatura de criadores, benefícios exclusivos e receita recorrente.',
                        icon: Award,
                        accent: 'text-[#FF0033]',
                        borderHover: 'hover:border-[#FF0033]'
                      },
                      {
                        id: 'sorteios' as AdminModuleType,
                        badge: 'CAMPANHAS',
                        title: 'SORTEIOS OFICIAIS',
                        desc: 'Campanhas promocionais auditáveis, participantes e apuração de ganhadores.',
                        icon: Gift,
                        accent: 'text-[#FF0033]',
                        borderHover: 'hover:border-[#FF0033]'
                      },
                      {
                        id: 'vaquinhas' as AdminModuleType,
                        badge: 'ARRECADAÇÃO',
                        title: 'VAQUINHAS',
                        desc: 'Campanhas coletivas da comunidade, metas financeiras e transparência de apoios.',
                        icon: HeartHandshake,
                        accent: 'text-[#FF0033]',
                        borderHover: 'hover:border-[#FF0033]'
                      }
                    ]
                  },
                  {
                    sectionTitle: '4. INTEGRAÇÕES & INFRAESTRUTURA',
                    sectionSubtitle: 'Credenciais institucionais, gateway Mercado Pago PIX, armazenamento Google Drive e provedores externos.',
                    items: [
                      {
                        id: 'config' as AdminModuleType,
                        badge: 'INSTITUCIONAL & PIX',
                        title: 'CONFIGURAÇÕES & GATEWAY',
                        desc: 'Identidade da marca VOXA, chaves PIX, credenciais Mercado Pago e taxas globais.',
                        icon: Building,
                        accent: 'text-[#FF0033]',
                        borderHover: 'hover:border-[#FF0033]'
                      },
                      {
                        id: 'drive' as AdminModuleType,
                        badge: 'CLOUD STORAGE',
                        title: 'GOOGLE DRIVE',
                        desc: 'Integração OAuth para armazenamento seguro de mídias e ativos da plataforma.',
                        icon: HardDrive,
                        accent: 'text-blue-600',
                        borderHover: 'hover:border-blue-600'
                      },
                      {
                        id: 'gamer' as AdminModuleType,
                        badge: 'PROVEDOR EXTERNO',
                        title: 'ARENA GAMER',
                        desc: 'Integração de catálogo de jogos, webhooks de carteira e credenciais PlayFivers.',
                        icon: Gamepad2,
                        accent: 'text-[#FF0033]',
                        borderHover: 'hover:border-[#FF0033]'
                      }
                    ]
                  }
                ].map((section, sIdx) => {
                  const visibleItems = section.items.filter((it) => canSeeModule(it.id));
                  if (visibleItems.length === 0) return null;
                  return (
                    <div key={sIdx} className="space-y-4">
                      <div className="border-b border-gray-200 pb-2 text-left">
                        <h2 className="font-orbitron font-black text-sm sm:text-base text-black uppercase tracking-wider">
                          {section.sectionTitle}
                        </h2>
                        <p className="text-xs text-gray-500 font-sans mt-0.5">{section.sectionSubtitle}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                        {visibleItems.map((card) => {
                          const Icon = card.icon;
                          return (
                            <motion.div
                              key={card.id}
                              whileHover={{ scale: 1.015, y: -3 }}
                              whileTap={{ scale: 0.99 }}
                              onMouseEnter={() => handleCardHover(card.id)}
                              onMouseLeave={handleCardLeave}
                              onClick={() => handleSelectModule(card.id)}
                              className={`bg-white text-black p-5 sm:p-6 rounded-3xl border-2 cursor-pointer flex flex-col justify-between min-h-[200px] transition-all shadow-xs relative overflow-hidden group border-gray-200 ${card.borderHover}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className={`w-11 h-11 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center ${card.accent}`}>
                                  <Icon className="w-5 h-5" />
                                </div>
                                <span className={`font-orbitron text-[9px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full bg-gray-100 ${card.accent}`}>
                                  {card.badge}
                                </span>
                              </div>

                              <div className="my-3 text-left">
                                <h3 className="font-orbitron font-black text-lg text-black uppercase leading-snug">
                                  {card.title}
                                </h3>
                                <p className="text-xs text-gray-600 mt-1.5 font-sans leading-relaxed">
                                  {card.desc}
                                </p>
                              </div>

                              <div className={`flex items-center justify-between text-[11px] font-orbitron pt-3 border-t border-gray-100 ${card.accent}`}>
                                <span className="font-bold">ACESSAR MÓDULO</span>
                                <span>→</span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

        {currentModule === 'overview' && (
          <div className="h-full flex flex-col w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 sm:pb-6 mb-4 sm:mb-6 border-b border-gray-200 max-w-7xl mx-auto w-full px-2 sm:px-4">
              <button
                onClick={() => setCurrentModule('menu')}
                className="flex items-center space-x-2 bg-white hover:bg-gray-100 border border-gray-300 px-4 py-2.5 rounded-xl text-xs font-orbitron text-gray-700 transition-all cursor-pointer shadow-sm self-start"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>MENU PRINCIPAL</span>
              </button>

              <div className="flex items-center space-x-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF0033]"></span>
                <span className="font-orbitron font-bold text-xs sm:text-sm tracking-wider text-black">MÓDULO OVERVIEW • ESTATÍSTICAS</span>
              </div>
            </div>
            <DashboardOverview adminRole={adminRole} />
          </div>
        )}

        {currentModule === 'users' && (
          <div className="w-full max-w-7xl mx-auto">
            <UsersModule onBackToMenu={() => setCurrentModule('menu')} currentAdminRole={adminRole} />
          </div>
        )}

        {currentModule === 'ticket' && (
          <div className="w-full max-w-7xl mx-auto">
            <TicketModule onBackToMenu={() => setCurrentModule('menu')} />
          </div>
        )}

        {currentModule === 'store' && (
          <div className="w-full max-w-7xl mx-auto">
            <StoreModule onBackToMenu={() => setCurrentModule('menu')} />
          </div>
        )}

        {currentModule === 'assinatura' && (
          <div className="w-full max-w-7xl mx-auto">
            <AssinaturaModule onBackToMenu={() => setCurrentModule('menu')} />
          </div>
        )}

        {currentModule === 'config' && canSeeModule('config') && (
          <div className="w-full max-w-7xl mx-auto">
            <CompanyConfigModule onBackToMenu={() => setCurrentModule('menu')} />
          </div>
        )}

        {currentModule === 'drive' && (
          <div className="w-full max-w-7xl mx-auto">
            <DriveModule onBack={() => setCurrentModule('menu')} addToast={addToast} />
          </div>
        )}

        {currentModule === 'support_requests' && (
          <div className="w-full max-w-7xl mx-auto">
            <SupportRequestsModule onBackToMenu={() => setCurrentModule('menu')} />
          </div>
        )}

        {currentModule === 'league' && (
          <div className="w-full max-w-7xl mx-auto">
            <LeagueModule onBackToMenu={() => setCurrentModule('menu')} />
          </div>
        )}

        {currentModule === 'sorteios' && (
          <div className="w-full max-w-7xl mx-auto">
            <SorteiosModule 
              onBackToMenu={() => setCurrentModule('menu')}
              onMascotMoodChange={() => {}}
            />
          </div>
        )}

        {currentModule === 'gamer' && canSeeModule('gamer') && (
          <div className="w-full max-w-7xl mx-auto">
            <GamerModule onBackToMenu={() => setCurrentModule('menu')} />
          </div>
        )}

        {currentModule === 'ads' && (
          <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 py-4 sm:py-6">
            <button
              onClick={() => setCurrentModule('menu')}
              className="mb-6 flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-4 py-2.5 rounded-xl text-xs font-orbitron text-gray-700 hover:text-black transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>VOLTAR AO MENU</span>
            </button>
            <AdsModule />
          </div>
        )}

        {currentModule === 'vox' && (
          <div className="w-full max-w-7xl mx-auto">
            <VoxModModule onBack={() => setCurrentModule('menu')} />
          </div>
        )}

        {currentModule === 'social_diagnostics' && (
          <div className="w-full max-w-7xl mx-auto">
            <SocialDiagnosticsModule onBackToMenu={() => setCurrentModule('menu')} />
          </div>
        )}

        {currentModule === 'vaquinhas' && (
          <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 py-4 sm:py-6">
            <button
              onClick={() => setCurrentModule('menu')}
              className="mb-6 flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-4 py-2.5 rounded-xl text-xs font-orbitron text-gray-700 hover:text-black transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>VOLTAR AO MENU</span>
            </button>
            <VaquinhasModule triggerToast={() => {}} />
          </div>
        )}

        {currentModule === 'financeiro' && canSeeModule('financeiro') && (
          <div className="h-full flex flex-col w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 sm:pb-6 mb-4 sm:mb-6 border-b border-gray-200 max-w-7xl mx-auto w-full px-2 sm:px-4 text-black">
              <button
                onClick={() => setCurrentModule('menu')}
                className="flex items-center space-x-2 bg-white hover:bg-gray-100 border border-gray-300 px-4 py-2.5 rounded-xl text-xs font-orbitron text-gray-700 transition-all cursor-pointer shadow-sm self-start"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>MENU PRINCIPAL</span>
              </button>
              <div className="flex items-center space-x-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF0033]"></span>
                <span className="font-orbitron font-bold text-xs sm:text-sm tracking-wider text-black">MÓDULO FINANCEIRO • LEDGER REAL</span>
              </div>
            </div>
            <div className="max-w-7xl mx-auto w-full px-2 sm:px-4">
              <FinanceiroModule currentUser={currentUser} adminRole={adminRole === 'SUPER_ADMIN' ? 'ADMINISTRATOR' : adminRole} />
            </div>
          </div>
        )}

        {currentModule === 'trade' && canSeeModule('trade') && (
          <div className="max-w-7xl mx-auto w-full">
            <TradeAdminModule
              onBackToMenu={() => setCurrentModule('menu')}
              currentUser={currentUser}
              adminRole={adminRole}
            />
          </div>
        )}

        {currentModule === 'trade_settings' && canSeeModule('trade_settings') && (
          <div className="max-w-7xl mx-auto w-full">
            <TradeSettingsDashboard
              onBackToMenu={() => setCurrentModule('menu')}
              currentUser={currentUser}
              adminRole={adminRole}
            />
          </div>
        )}

        {currentModule === 'invest' && canSeeModule('invest') && (
          <div className="max-w-7xl mx-auto w-full">
            <InvestAdminModule
              onBackToMenu={() => setCurrentModule('menu')}
              currentUser={currentUser}
              adminRole={adminRole}
            />
          </div>
        )}

        {currentModule === 'voxa_ai' && canSeeModule('voxa_ai') && (
          <div className="max-w-7xl mx-auto w-full">
            <VoxaAiAdminModule
              onBackToMenu={() => setCurrentModule('menu')}
              currentUser={currentUser}
              adminRole={adminRole}
            />
          </div>
        )}
          </>
        )}
      </main>
    </div>
  );
};


