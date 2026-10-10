import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import {
  TrendingUp,
  Users,
  DollarSign,
  Ticket,
  ShoppingBag,
  Activity,
  ShieldCheck,
  Calendar,
  UserCheck,
  UserX,
  Wallet,
  Download,
  MapPin,
  Globe,
  Radio,
  Gift,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Award,
  Share2
} from 'lucide-react';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { getCurrentUserRole } from '../../utils/storeDb';
import { formatBRL } from '../../utils/money';
import { isUserOnlineNow, UserPresenceRecord, resolveMacroRegion } from '../../hooks/useUserPresence';

interface DashboardOverviewProps {
  adminRole?: string;
}

/**
 * Helper to parse either ISO dates ("2026-10-05T...") or pt-BR dates ("05/10/2026")
 */
function parseFlexibleDateMs(raw: any): number | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Check DD/MM/YYYY format
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }

  const parsed = new Date(trimmed).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ adminRole }) => {
  const effectiveRole = adminRole || getCurrentUserRole();
  const canSeeFinancials = effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'ADMINISTRATOR';

  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  // Real-time presence map from user_presence/{uid}
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresenceRecord>>({});
  // Re-evaluate online threshold every 15s even if no Firestore snapshot arrives
  const [clockNow, setClockNow] = useState<number>(Date.now());

  // Raw users list from Firestore 'users'
  const [usersList, setUsersList] = useState<any[]>([]);

  // Ecosystem & Engagement state (100% real from Firestore)
  const [ecosystemStats, setEcosystemStats] = useState({
    voxCount: 0,
    pollsCount: 0,
    sussurrosCount: 0,
    followsCount: 0,
    productsCount: 0,
    showsCount: 0,
    subscriptionsCount: 0,
    adsCount: 0,
    referralsCount: 0,
    qualifiedReferralsCount: 0
  });

  const [dailyVoxData, setDailyVoxData] = useState<{ dateString: string; label: string; posts: number; activeUsers: number }[]>([]);

  // Financial & Trade metrics (only loaded if canSeeFinancials)
  const [financialStats, setFinancialStats] = useState({
    realCustodyCentavos: 0,
    promoCustodyCentavos: 0,
    activeWalletsCount: 0,
    approvedDepositsCentavos: 0,
    platformRevenueCentavos: 0,
    tradeOpenPositionsCount: 0,
    tradeTotalPositionsCount: 0,
    tradeVolumeCentavos: 0
  });

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Real-time snapshot on user_presence collection
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = onSnapshot(
      collection(db, 'user_presence'),
      (snap) => {
        const nextMap: Record<string, UserPresenceRecord> = {};
        snap.forEach((d) => {
          const data = d.data() as UserPresenceRecord;
          nextMap[d.id] = {
            ...data,
            uid: data.uid || d.id
          };
        });
        setPresenceMap(nextMap);
      },
      (err) => {
        console.warn('[Overview Presence Snapshot]', err);
      }
    );
    return () => unsub();
  }, []);

  // Load real Firestore collections
  useEffect(() => {
    let cancelled = false;

    const loadAllRealOverviewData = async () => {
      setLoading(true);
      try {
        const [
          usersSnap,
          voxesSnap,
          pollsSnap,
          sussurrosSnap,
          followsSnap,
          productsSnap,
          showsSnap,
          subsSnap,
          adsSnap,
          referralsSnap
        ] = await Promise.all([
          getDocs(collection(db, 'users')).catch(() => null),
          getDocs(collection(db, 'voxes')).catch(() => null),
          getDocs(collection(db, 'polls')).catch(() => null),
          getDocs(collection(db, 'sussurro_messages')).catch(() => null),
          getDocs(collection(db, 'follows')).catch(() => null),
          getDocs(collection(db, 'store_products')).catch(() => null),
          getDocs(collection(db, 'shows')).catch(() => null),
          getDocs(collection(db, 'subscription_plans')).catch(() => null),
          getDocs(collection(db, 'ad_campaigns')).catch(() => null),
          getDocs(collection(db, 'referrals')).catch(() => null)
        ]);

        if (cancelled) return;

        // 1. Users
        const uList: any[] = [];
        const seenUids = new Set<string>();
        usersSnap?.forEach((d) => {
          const data = d.data();
          const uid = data.uid || data.id || d.id;
          if (!seenUids.has(uid)) {
            seenUids.add(uid);
            uList.push({ ...data, id: d.id, uid });
          }
        });
        setUsersList(uList);

        // 2. Voxes & 7-day real chart
        const vList: any[] = [];
        voxesSnap?.forEach((d) => vList.push({ id: d.id, ...d.data() }));

        const last7Days = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const dateString = d.toISOString().split('T')[0];
          const label = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
          return {
            dateString,
            label: label.charAt(0).toUpperCase() + label.slice(1),
            posts: 0,
            activeUsers: 0
          };
        });

        const authorsByDay: Record<string, Set<string>> = {};
        last7Days.forEach((day) => {
          authorsByDay[day.dateString] = new Set<string>();
        });

        vList.forEach((v) => {
          if (!v.createdAt || typeof v.createdAt !== 'string') return;
          const dStr = v.createdAt.split('T')[0];
          const bucket = last7Days.find((day) => day.dateString === dStr);
          if (bucket) {
            bucket.posts += 1;
            if (v.authorId) {
              authorsByDay[dStr].add(v.authorId);
            }
          }
        });

        last7Days.forEach((day) => {
          day.activeUsers = authorsByDay[day.dateString].size;
        });
        setDailyVoxData(last7Days);

        // 3. Ecosystem counts
        const refsList: any[] = [];
        referralsSnap?.forEach((d) => refsList.push({ id: d.id, ...d.data() }));

        setEcosystemStats({
          voxCount: vList.length,
          pollsCount: pollsSnap ? pollsSnap.size : 0,
          sussurrosCount: sussurrosSnap ? sussurrosSnap.size : 0,
          followsCount: followsSnap ? followsSnap.size : 0,
          productsCount: productsSnap ? productsSnap.size : 0,
          showsCount: showsSnap ? showsSnap.size : 0,
          subscriptionsCount: subsSnap ? subsSnap.size : 0,
          adsCount: adsSnap ? adsSnap.size : 0,
          referralsCount: refsList.length,
          qualifiedReferralsCount: refsList.filter((r) => r.status === 'qualified').length
        });

        // 4. Financial & VOXA Trade stats (only for SUPER_ADMIN / ADMINISTRATOR)
        if (canSeeFinancials) {
          const [walletsSnap, txsSnap, tradeSnap] = await Promise.all([
            getDocs(collection(db, 'wallets')).catch(() => null),
            getDocs(collection(db, 'wallet_transactions')).catch(() => null),
            getDocs(collection(db, 'trade_positions')).catch(() => null)
          ]);

          let realCustodyCentavos = 0;
          let promoCustodyCentavos = 0;
          let activeWalletsCount = 0;

          walletsSnap?.forEach((d) => {
            const w = d.data();
            const avail = Number(w.availableBalance !== undefined ? w.availableBalance : (w.balance || 0));
            const blocked = Number(w.blockedBalance || 0);
            const promo = Number(w.promoBalance || 0);
            realCustodyCentavos += avail + blocked;
            promoCustodyCentavos += promo;
            if (avail > 0 || blocked > 0 || promo > 0) {
              activeWalletsCount += 1;
            }
          });

          let approvedDepositsCentavos = 0;
          let platformRevenueCentavos = 0;

          txsSnap?.forEach((d) => {
            const tx = d.data();
            const st = String(tx.status || '').toLowerCase();
            const tp = String(tx.type || '').toUpperCase();
            const amt = Math.abs(Number(tx.amount || 0));
            const fee = Math.abs(Number(tx.platformFee || 0));

            if (st === 'completed' || st === 'approved' || st === 'pago') {
              if (tp === 'DEPOSIT' || tp === 'PIX_DEPOSIT') {
                approvedDepositsCentavos += amt;
              }
              if (fee > 0) {
                platformRevenueCentavos += fee;
              }
            }
          });

          let tradeOpenPositionsCount = 0;
          let tradeTotalPositionsCount = 0;
          let tradeVolumeCentavos = 0;

          tradeSnap?.forEach((d) => {
            const pos = d.data();
            tradeTotalPositionsCount += 1;
            tradeVolumeCentavos += Number(pos.stakeAmount || 0);
            if (pos.status === 'OPEN' || pos.status === 'PENDING' || pos.status === 'SETTLING') {
              tradeOpenPositionsCount += 1;
            }
          });

          if (!cancelled) {
            setFinancialStats({
              realCustodyCentavos,
              promoCustodyCentavos,
              activeWalletsCount: activeWalletsCount || (walletsSnap ? walletsSnap.size : 0),
              approvedDepositsCentavos,
              platformRevenueCentavos,
              tradeOpenPositionsCount,
              tradeTotalPositionsCount,
              tradeVolumeCentavos
            });
          }
        }
      } catch (err) {
        console.error('[DashboardOverview Load Error]', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAllRealOverviewData();
    return () => {
      cancelled = true;
    };
  }, [canSeeFinancials, refreshTick]);

  // ==========================================================
  // COMPUTE MANDATORY USER & PRESENCE METRICS (100% REAL)
  // ==========================================================
  const nowMs = clockNow;
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();
  const ms7DaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const ms30DaysAgo = nowMs - 30 * 24 * 60 * 60 * 1000;

  const totalUsers = usersList.length;

  let newUsersToday = 0;
  let newUsers7d = 0;
  let newUsers30d = 0;
  let activeUsersToday = 0;
  let activeUsers7d = 0;
  let verifiedProfiles = 0;
  let suspendedProfiles = 0;

  // Determine online users right now from presenceMap
  const onlinePresenceRecords: UserPresenceRecord[] = (Object.values(presenceMap) as UserPresenceRecord[]).filter((p) =>
    isUserOnlineNow(p)
  );
  const onlineUidsSet = new Set(onlinePresenceRecords.map((p) => p.uid));

  usersList.forEach((u) => {
    const uid = u.uid || u.id;
    const createdMs = parseFlexibleDateMs(u.createdAt);
    if (createdMs !== null) {
      if (createdMs >= startOfTodayMs) newUsersToday += 1;
      if (createdMs >= ms7DaysAgo) newUsers7d += 1;
      if (createdMs >= ms30DaysAgo) newUsers30d += 1;
    }

    // Check last activity from presence or lastLogin/updatedAt
    const presence = uid ? presenceMap[uid] : undefined;
    const lastSeenMs =
      (presence && (presence.lastHeartbeatMs || parseFlexibleDateMs(presence.lastSeenAt))) ||
      parseFlexibleDateMs(u.lastSeenAt) ||
      parseFlexibleDateMs(u.lastLogin) ||
      parseFlexibleDateMs(u.updatedAt);

    if (onlineUidsSet.has(uid) || (lastSeenMs !== null && lastSeenMs >= startOfTodayMs)) {
      activeUsersToday += 1;
    }
    if (onlineUidsSet.has(uid) || (lastSeenMs !== null && lastSeenMs >= ms7DaysAgo)) {
      activeUsers7d += 1;
    }

    if (u.isVerified === true || u.verified === true) {
      verifiedProfiles += 1;
    }

    const st = String(u.status || '').toUpperCase();
    const accSt = String(u.accountStatus || '').toUpperCase();
    if (st === 'SUSPENSO' || st === 'SUSPENDED' || accSt === 'SUSPENDED') {
      suspendedProfiles += 1;
    }
  });

  const onlineUsersCount = onlinePresenceRecords.length;
  const offlineUsersCount = Math.max(0, totalUsers - onlineUsersCount);

  // ==========================================================
  // COMPUTE PRIVACY-SAFE GEOLOCATION ANALYTICS (REAL)
  // ==========================================================
  const regionCounts: Record<string, number> = {};
  const stateCounts: Record<string, number> = {};
  const cityCounts: Record<string, number> = {};
  let usersWithLocationCount = 0;

  usersList.forEach((u) => {
    const uid = u.uid || u.id;
    const presenceLoc = uid ? presenceMap[uid]?.approximateLocation : null;
    const userLoc = u.approximateLocation || null;
    const approx = presenceLoc || userLoc;

    if (approx && (approx.city || approx.state || approx.country)) {
      usersWithLocationCount += 1;
      const country = approx.country || 'Brasil';
      const state = approx.state || 'Não informado';
      const city = approx.city || 'Não informada';
      const region = approx.region || resolveMacroRegion(state, country);

      regionCounts[region] = (regionCounts[region] || 0) + 1;
      if (state && state !== 'Não informado') {
        stateCounts[state] = (stateCounts[state] || 0) + 1;
      }
      if (city && city !== 'Não informada') {
        const cityLabel = state && state !== 'Não informado' ? `${city} (${state})` : city;
        cityCounts[cityLabel] = (cityCounts[cityLabel] || 0) + 1;
      }
    } else if (u.deliveryAddress?.city || u.deliveryAddress?.state || u.location) {
      // Coarse fallback if user filled city/state on profile
      const rawCity = u.deliveryAddress?.city || (typeof u.location === 'string' ? u.location.split(',')[0]?.trim() : '');
      const rawState = u.deliveryAddress?.state || (typeof u.location === 'string' ? u.location.split(',')[1]?.trim() : '');
      if (rawCity || rawState) {
        usersWithLocationCount += 1;
        const reg = resolveMacroRegion(rawState || '', u.deliveryAddress?.country || 'Brasil');
        regionCounts[reg] = (regionCounts[reg] || 0) + 1;
        if (rawState) stateCounts[rawState] = (stateCounts[rawState] || 0) + 1;
        if (rawCity) {
          const label = rawState ? `${rawCity} (${rawState})` : rawCity;
          cityCounts[label] = (cityCounts[label] || 0) + 1;
        }
      }
    }
  });

  const topRegionsData = Object.entries(regionCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const topStatesData = Object.entries(stateCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topCitiesData = Object.entries(cityCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <div className="space-y-8 w-full max-w-7xl mx-auto pb-12 px-2 sm:px-4 text-left">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-orbitron text-[10px] sm:text-xs text-[#FF0033] tracking-widest font-bold uppercase">
              OPERAÇÃO EM TEMPO REAL • DADOS REAIS DO FIRESTORE
            </span>
          </div>
          <h2 className="text-xl sm:text-3xl font-black font-orbitron mt-1 text-black uppercase">
            VOXA • OVERVIEW OPERACIONAL
          </h2>
          <p className="text-xs text-gray-500 font-sans mt-1">
            Métricas auditáveis de usuários, presença online via heartbeat, geolocalização aproximada, engajamento e finanças.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start lg:self-auto">
          <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-2xl flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span className="font-orbitron font-black text-xs text-emerald-800">
              {onlineUsersCount} ONLINE AGORA
            </span>
          </div>

          <button
            onClick={() => setRefreshTick((t) => t + 1)}
            disabled={loading}
            className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-800 font-orbitron font-bold text-xs px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#FF0033]' : ''}`} />
            <span>ATUALIZAR</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: MANDATORY 10 USER METRICS */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
          <div>
            <span className="font-orbitron text-[10px] text-[#FF0033] tracking-widest block font-bold uppercase">
              BASE DE CONTAS & PRESENÇA REAL
            </span>
            <h3 className="font-orbitron font-black text-lg sm:text-xl text-black uppercase">
              INDICADORES DE USUÁRIOS VOXA
            </h3>
          </div>
          <span className="text-[11px] text-gray-500 font-sans">
            Presença calculada via heartbeat ativo (`user_presence`) nos últimos 2 minutos
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* 1. Total de usuários */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-[10px] font-orbitron font-bold uppercase">Total de Usuários</span>
              <Users className="w-4 h-4 text-black" />
            </div>
            <div className="text-2xl sm:text-3xl font-orbitron font-black text-black mt-2">
              {totalUsers.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-gray-500 font-sans mt-1">Contas registradas no banco</span>
          </div>

          {/* 2. Novos usuários hoje */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-[10px] font-orbitron font-bold uppercase">Novos Hoje</span>
              <Calendar className="w-4 h-4 text-[#FF0033]" />
            </div>
            <div className="text-2xl sm:text-3xl font-orbitron font-black text-black mt-2">
              {newUsersToday.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-gray-500 font-sans mt-1">Cadastros nas últimas 24h</span>
          </div>

          {/* 3. Novos usuários últimos 7 dias */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-[10px] font-orbitron font-bold uppercase">Novos (7 Dias)</span>
              <TrendingUp className="w-4 h-4 text-[#FF0033]" />
            </div>
            <div className="text-2xl sm:text-3xl font-orbitron font-black text-black mt-2">
              {newUsers7d.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-gray-500 font-sans mt-1">Últimos 7 dias corridos</span>
          </div>

          {/* 4. Novos usuários últimos 30 dias */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-[10px] font-orbitron font-bold uppercase">Novos (30 Dias)</span>
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-orbitron font-black text-black mt-2">
              {newUsers30d.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-gray-500 font-sans mt-1">Últimos 30 dias corridos</span>
          </div>

          {/* 5. Usuários ativos hoje */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-[10px] font-orbitron font-bold uppercase">Ativos Hoje</span>
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-orbitron font-black text-black mt-2">
              {activeUsersToday.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-gray-500 font-sans mt-1">Atividade ou sessão hoje</span>
          </div>

          {/* 6. Usuários ativos últimos 7 dias */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-[10px] font-orbitron font-bold uppercase">Ativos (7 Dias)</span>
              <Activity className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-orbitron font-black text-black mt-2">
              {activeUsers7d.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-gray-500 font-sans mt-1">Ativos na última semana</span>
          </div>

          {/* 7. Usuários online agora */}
          <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-[10px] font-orbitron font-bold uppercase">Online Agora</span>
              <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
            </div>
            <div className="text-2xl sm:text-3xl font-orbitron font-black text-emerald-700 mt-2">
              {onlineUsersCount.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-emerald-700 font-sans mt-1">Heartbeat ativo em tempo real</span>
          </div>

          {/* 8. Usuários offline */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-500">
              <span className="text-[10px] font-orbitron font-bold uppercase">Usuários Offline</span>
              <Users className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-orbitron font-black text-gray-700 mt-2">
              {offlineUsersCount.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-gray-500 font-sans mt-1">Sem heartbeat ativo no momento</span>
          </div>

          {/* 9. Perfis verificados */}
          <div className="bg-blue-50/60 border border-blue-200 p-4 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-blue-700">
              <span className="text-[10px] font-orbitron font-bold uppercase">Perfis Verificados</span>
              <UserCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-orbitron font-black text-blue-700 mt-2">
              {verifiedProfiles.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-blue-700 font-sans mt-1">Selo oficial VOXA ativo</span>
          </div>

          {/* 10. Perfis suspensos */}
          <div className="bg-red-50/60 border border-red-200 p-4 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#FF0033]">
              <span className="text-[10px] font-orbitron font-bold uppercase">Perfis Suspensos</span>
              <UserX className="w-4 h-4 text-[#FF0033]" />
            </div>
            <div className="text-2xl sm:text-3xl font-orbitron font-black text-[#FF0033] mt-2">
              {suspendedProfiles.toLocaleString('pt-BR')}
            </div>
            <span className="text-[10px] text-[#FF0033] font-sans mt-1">Bloqueados pela moderação</span>
          </div>
        </div>

        {/* Live Online Sessions Strip */}
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="font-orbitron text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              SESSÕES COM HEARTBEAT ATIVO AGORA ({onlinePresenceRecords.length})
            </span>
          </div>
          {onlinePresenceRecords.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs text-gray-500 font-sans">
              Nenhum usuário com heartbeat ativo nos últimos 2 minutos.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {onlinePresenceRecords.slice(0, 20).map((p) => (
                <div
                  key={p.uid}
                  className="bg-white border border-emerald-200 px-3 py-2 rounded-2xl flex items-center gap-2.5 shadow-2xs"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <div>
                    <span className="font-orbitron font-bold text-xs text-black block leading-tight">
                      {p.name || p.username || p.uid.substring(0, 8)}
                    </span>
                    <span className="text-[10px] text-gray-500 font-sans block">
                      {p.username ? `@${p.username} • ` : ''}
                      Aba: {p.activeTab || 'home'}
                      {p.approximateLocation?.city ? ` • ${p.approximateLocation.city}/${p.approximateLocation.state}` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: PRIVACY-SAFE GEOLOCATION ANALYTICS */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#FF0033]" />
              <span className="font-orbitron text-[10px] text-[#FF0033] tracking-widest font-bold uppercase">
                GEOLOCALIZAÇÃO APROXIMADA DA BASE
              </span>
            </div>
            <h3 className="font-orbitron font-black text-lg sm:text-xl text-black uppercase mt-1">
              REGIÕES, ESTADOS E CIDADES COM MAIS USUÁRIOS
            </h3>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-2xl flex items-center gap-2 text-emerald-800 text-[11px] font-sans">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Privacidade Ativa: Apenas País, Estado, Cidade e Região ({usersWithLocationCount} perfis mapeados). Sem endereço exato.
            </span>
          </div>
        </div>

        {usersWithLocationCount === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-8 text-center space-y-2">
            <Globe className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="font-orbitron font-bold text-xs text-gray-500 uppercase">
              Aguardando consentimento de localização aproximada dos usuários
            </p>
            <p className="text-xs text-gray-400 font-sans max-w-lg mx-auto">
              Assim que os usuários autorizarem o prompt de localização aproximada no navegador, a distribuição real por região, estado e cidade aparecerá aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Macro Regions */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
              <span className="font-orbitron text-xs font-bold text-black uppercase block">
                DISTRIBUIÇÃO POR REGIÃO
              </span>
              <div className="space-y-2.5">
                {topRegionsData.map((reg) => {
                  const pct = Math.round((reg.count / Math.max(1, usersWithLocationCount)) * 100);
                  return (
                    <div key={reg.name} className="space-y-1">
                      <div className="flex justify-between text-xs font-orbitron">
                        <span className="font-bold text-gray-800">{reg.name}</span>
                        <span className="text-[#FF0033] font-black">
                          {reg.count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#FF0033] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top States */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
              <span className="font-orbitron text-xs font-bold text-black uppercase block">
                ESTADOS COM MAIS USUÁRIOS
              </span>
              {topStatesData.length === 0 ? (
                <p className="text-xs text-gray-400 font-sans">Sem estados informados.</p>
              ) : (
                <div className="divide-y divide-gray-200">
                  {topStatesData.map((st, idx) => (
                    <div key={st.name} className="py-2 flex items-center justify-between text-xs">
                      <span className="font-orbitron font-bold text-gray-800">
                        #{idx + 1} {st.name}
                      </span>
                      <span className="bg-white border border-gray-200 px-2.5 py-0.5 rounded-full font-orbitron font-black text-black">
                        {st.count} {st.count === 1 ? 'usuário' : 'usuários'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Cities */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
              <span className="font-orbitron text-xs font-bold text-black uppercase block">
                CIDADES COM MAIS USUÁRIOS
              </span>
              {topCitiesData.length === 0 ? (
                <p className="text-xs text-gray-400 font-sans">Sem cidades informadas.</p>
              ) : (
                <div className="divide-y divide-gray-200">
                  {topCitiesData.map((ct, idx) => (
                    <div key={ct.name} className="py-2 flex items-center justify-between text-xs">
                      <span className="font-orbitron font-bold text-gray-800 truncate pr-2">
                        #{idx + 1} {ct.name}
                      </span>
                      <span className="bg-white border border-gray-200 px-2.5 py-0.5 rounded-full font-orbitron font-black text-[#FF0033] shrink-0">
                        {ct.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: FINANCIAL, PROMO WALLET & VOXA TRADE TELEMETRY (SUPER_ADMIN / ADMINISTRATOR ONLY) */}
      {canSeeFinancials && (
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
            <div>
              <span className="font-orbitron text-[10px] text-emerald-600 tracking-widest block font-bold uppercase">
                 TESOURARIA, CUSTÓDIA & MERCADOS
              </span>
              <h3 className="font-orbitron font-black text-lg sm:text-xl text-black uppercase">
                FINANCEIRO REAL, CARTEIRA PROMOCIONAL & VOXA TRADE
              </h3>
            </div>
            <span className="text-[11px] text-gray-500 font-sans">
              Saldo real separado da Carteira Promocional de indicações
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-gray-900 text-white p-5 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-orbitron font-bold text-gray-400 uppercase">Custódia Saldo Real</span>
                <Wallet className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-mono font-black text-white mt-2">
                {formatBRL(financialStats.realCustodyCentavos / 100)}
              </div>
              <span className="text-[10px] text-emerald-400 font-orbitron mt-1">
                {financialStats.activeWalletsCount} carteiras registradas
              </span>
            </div>

            <div className="bg-purple-950 text-white p-5 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-orbitron font-bold text-purple-300 uppercase">Carteira Promocional</span>
                <Gift className="w-4 h-4 text-purple-300" />
              </div>
              <div className="text-2xl font-mono font-black text-white mt-2">
                {formatBRL(financialStats.promoCustodyCentavos / 100)}
              </div>
              <span className="text-[10px] text-purple-300 font-orbitron mt-1">
                Bônus isolado do saldo real
              </span>
            </div>

            <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">Depósitos PIX Reais</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-mono font-black text-black mt-2">
                {formatBRL(financialStats.approvedDepositsCentavos / 100)}
              </div>
              <span className="text-[10px] text-gray-500 font-sans mt-1">
                Créditos aprovados via PIX
              </span>
            </div>

            <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">Volume VOXA Trade</span>
                <TrendingUp className="w-4 h-4 text-[#FF0033]" />
              </div>
              <div className="text-2xl font-mono font-black text-black mt-2">
                {formatBRL(financialStats.tradeVolumeCentavos / 100)}
              </div>
              <span className="text-[10px] text-gray-500 font-sans mt-1">
                {financialStats.tradeTotalPositionsCount} operações ({financialStats.tradeOpenPositionsCount} abertas)
              </span>
            </div>

            <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">Taxas & Comissões</span>
                <DollarSign className="w-4 h-4 text-[#FF0033]" />
              </div>
              <div className="text-2xl font-mono font-black text-[#FF0033] mt-2">
                {formatBRL(financialStats.platformRevenueCentavos / 100)}
              </div>
              <span className="text-[10px] text-gray-500 font-sans mt-1">
                Receita retida no ledger
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: ECOSSISTEMA VOXA & ENGAJAMENTO REAL */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <span className="font-orbitron text-[10px] text-[#FF0033] tracking-widest block font-bold uppercase">
              ECOSSISTEMA SOCIAL & COMÉRCIO VOXA
            </span>
            <h3 className="font-orbitron font-black text-lg sm:text-xl text-black uppercase mt-1">
              INVENTÁRIO E ENGAJAMENTO EM TEMPO REAL
            </h3>
          </div>

          <button
            onClick={() => {
              const headers = ['Data', 'Publicacoes_VOX', 'Autores_Ativos_No_Dia'];
              const rows = dailyVoxData.map((d) => [d.dateString, d.posts, d.activeUsers]);
              const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.setAttribute('href', url);
              link.setAttribute('download', `voxa_overview_${new Date().toISOString().split('T')[0]}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="bg-[#FF0033] hover:bg-[#D6002A] text-white font-orbitron font-bold text-xs px-4 py-2.5 rounded-2xl shadow-xs flex items-center space-x-2 transition-all cursor-pointer self-start"
          >
            <Download className="w-4 h-4" />
            <span>EXPORTAR CSV</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-2xl text-center">
            <MessageSquare className="w-5 h-5 text-[#FF0033] mx-auto mb-1" />
            <div className="text-[9px] font-orbitron text-gray-500 font-bold uppercase">VOX Posts</div>
            <div className="text-lg font-black text-black font-orbitron">{ecosystemStats.voxCount}</div>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-2xl text-center">
            <Activity className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <div className="text-[9px] font-orbitron text-gray-500 font-bold uppercase">Sussurros</div>
            <div className="text-lg font-black text-black font-orbitron">{ecosystemStats.sussurrosCount}</div>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-2xl text-center">
            <Users className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <div className="text-[9px] font-orbitron text-gray-500 font-bold uppercase">Conexões Follow</div>
            <div className="text-lg font-black text-black font-orbitron">{ecosystemStats.followsCount}</div>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-2xl text-center">
            <Share2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
            <div className="text-[9px] font-orbitron text-gray-500 font-bold uppercase">Indicações</div>
            <div className="text-lg font-black text-black font-orbitron">{ecosystemStats.qualifiedReferralsCount}</div>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-2xl text-center">
            <ShoppingBag className="w-5 h-5 text-gray-700 mx-auto mb-1" />
            <div className="text-[9px] font-orbitron text-gray-500 font-bold uppercase">Produtos Store</div>
            <div className="text-lg font-black text-black font-orbitron">{ecosystemStats.productsCount}</div>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-2xl text-center">
            <Ticket className="w-5 h-5 text-gray-700 mx-auto mb-1" />
            <div className="text-[9px] font-orbitron text-gray-500 font-bold uppercase">Eventos</div>
            <div className="text-lg font-black text-black font-orbitron">{ecosystemStats.showsCount}</div>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-2xl text-center">
            <Award className="w-5 h-5 text-amber-600 mx-auto mb-1" />
            <div className="text-[9px] font-orbitron text-gray-500 font-bold uppercase">Assinaturas</div>
            <div className="text-lg font-black text-black font-orbitron">{ecosystemStats.subscriptionsCount}</div>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-2xl text-center">
            <Megaphone className="w-5 h-5 text-[#FF0033] mx-auto mb-1" />
            <div className="text-[9px] font-orbitron text-gray-500 font-bold uppercase">Campanhas Ads</div>
            <div className="text-lg font-black text-black font-orbitron">{ecosystemStats.adsCount}</div>
          </div>
        </div>

        {/* Real 7-Day VOX Chart */}
        <div className="pt-4 border-t border-gray-100">
          <span className="font-orbitron text-xs text-gray-500 tracking-wider block font-bold mb-4 uppercase">
            PUBLICAÇÕES VOX & CRIADORES ATIVOS NO FEED (ÚLTIMOS 7 DIAS REAIS)
          </span>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyVoxData}>
                <XAxis dataKey="label" stroke="#666" fontSize={11} tickLine={false} />
                <YAxis stroke="#666" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#FF0033',
                    borderRadius: '12px',
                    color: '#000000',
                    fontFamily: 'Orbitron'
                  }}
                />
                <Line
                  type="monotone"
                  name="Publicações VOX"
                  dataKey="posts"
                  stroke="#FF0033"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  name="Autores no Dia"
                  dataKey="activeUsers"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
