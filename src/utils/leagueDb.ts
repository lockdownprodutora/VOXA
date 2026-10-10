import { db } from "../lib/firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  updateDoc 
} from "firebase/firestore";
import { 
  LeagueParticipant, 
  LeaguePointEvent, 
  LeaguePointTransaction, 
  LeagueSeason, 
  Referral, 
  ReferralSettings,
  CentralUser,
  LeagueStatus
} from "../types";
import { isFirestoreQuotaThrottled, handleFirestoreError } from "./storeDb";
import { fetchCentralUsers, saveCentralUser } from "./centralUserDb";

export const LEAGUE_PARTICIPANTS_CACHE_KEY = 'voxa_league_participants_cache';
export const LEAGUE_SEASONS_CACHE_KEY = 'voxa_league_seasons_cache';
export const REFERRALS_CACHE_KEY = 'voxa_referrals_cache';
export const REFERRAL_SETTINGS_CACHE_KEY = 'voxa_referral_settings_cache';
export const LEAGUE_TRANSACTIONS_CACHE_KEY = 'voxa_league_transactions_cache';
export const PENDING_REFERRAL_CODE_KEY = 'voxa_pending_referral_code';
export const PENDING_REFERRAL_CLICK_AT_KEY = 'voxa_pending_referral_clicked_at';

/**
 * Lê e persiste temporariamente o código de indicação da URL (?ref=ABC123 ou ?invite=ABC123)
 * até que o cadastro (formulário ou Google OAuth + Onboarding) seja concluído.
 */
export function captureAndPersistReferralCodeFromUrl(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const rawFromUrl = (params.get('ref') || params.get('invite') || params.get('code') || '').replace(/^@+/, '').trim().toUpperCase();
    if (rawFromUrl) {
      localStorage.setItem(PENDING_REFERRAL_CODE_KEY, rawFromUrl);
      sessionStorage.setItem(PENDING_REFERRAL_CODE_KEY, rawFromUrl);
      if (!localStorage.getItem(PENDING_REFERRAL_CLICK_AT_KEY)) {
        const nowIso = new Date().toISOString();
        localStorage.setItem(PENDING_REFERRAL_CLICK_AT_KEY, nowIso);
        sessionStorage.setItem(PENDING_REFERRAL_CLICK_AT_KEY, nowIso);
      }
      return rawFromUrl;
    }
    const stored = (localStorage.getItem(PENDING_REFERRAL_CODE_KEY) || sessionStorage.getItem(PENDING_REFERRAL_CODE_KEY) || '').trim().toUpperCase();
    return stored;
  } catch {
    return '';
  }
}

export const capturePendingReferralFromUrl = captureAndPersistReferralCodeFromUrl;

export function getPendingReferralCode(): string {
  try {
    return (localStorage.getItem(PENDING_REFERRAL_CODE_KEY) || sessionStorage.getItem(PENDING_REFERRAL_CODE_KEY) || '').trim().toUpperCase();
  } catch {
    return '';
  }
}

export async function trackReferralClick(code: string, source: string = 'referral_link'): Promise<void> {
  try {
    const clean = (code || '').replace(/^@+/, '').trim().toUpperCase();
    if (!clean) return;
    if (!localStorage.getItem(PENDING_REFERRAL_CLICK_AT_KEY)) {
      const nowIso = new Date().toISOString();
      localStorage.setItem(PENDING_REFERRAL_CLICK_AT_KEY, nowIso);
      sessionStorage.setItem(PENDING_REFERRAL_CLICK_AT_KEY, nowIso);
    }
    localStorage.setItem('voxa_pending_referral_source', source);
  } catch {}
}

export async function validateReferralCodeBackend(code: string): Promise<{
  valid: boolean;
  referrerUid?: string;
  referrerName?: string;
  referrerUsername?: string;
  referralCode?: string;
}> {
  const res = await validateReferralCodeExists(code);
  if (!res.valid || !res.referrer) {
    return { valid: false };
  }
  return {
    valid: true,
    referrerUid: res.referrer.uid || res.referrer.id,
    referrerName: res.referrer.name,
    referrerUsername: res.referrer.username || res.referrer.slug,
    referralCode: (res.referrer.referralCode || res.referrer.username || res.cleanCode).toUpperCase()
  };
}

export function setPendingReferralCode(code: string): void {
  try {
    const clean = (code || '').replace(/^@+/, '').trim().toUpperCase();
    if (clean) {
      localStorage.setItem(PENDING_REFERRAL_CODE_KEY, clean);
      sessionStorage.setItem(PENDING_REFERRAL_CODE_KEY, clean);
      if (!localStorage.getItem(PENDING_REFERRAL_CLICK_AT_KEY)) {
        const nowIso = new Date().toISOString();
        localStorage.setItem(PENDING_REFERRAL_CLICK_AT_KEY, nowIso);
        sessionStorage.setItem(PENDING_REFERRAL_CLICK_AT_KEY, nowIso);
      }
    } else {
      localStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
      sessionStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
    }
  } catch {}
}

export function clearPendingReferralCode(): void {
  try {
    localStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
    sessionStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
    localStorage.removeItem(PENDING_REFERRAL_CLICK_AT_KEY);
    sessionStorage.removeItem(PENDING_REFERRAL_CLICK_AT_KEY);
  } catch {}
}

/**
 * Valida no backend (/api/referrals/validate) e no Firestore se o código de indicação realmente existe
 */
export async function validateReferralCodeExists(code: string): Promise<{
  valid: boolean;
  referrer?: CentralUser;
  cleanCode: string;
}> {
  const cleanCode = (code || '').replace(/^@+/, '').trim().toUpperCase();
  if (!cleanCode) return { valid: false, cleanCode: '' };

  // 1. Tenta validação no backend oficial primeiro
  try {
    const res = await fetch(`/api/referrals/validate?code=${encodeURIComponent(cleanCode)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.valid && data.referrer) {
        return {
          valid: true,
          referrer: data.referrer,
          cleanCode
        };
      } else if (data.success && data.valid === false) {
        return { valid: false, cleanCode };
      }
    }
  } catch {
    // Continua para validação direta no Firestore caso offline/dev
  }

  // 2. Validação real na coleção users do Firestore
  const users = await fetchCentralUsers();
  const referrer = users.find(
    u =>
      (u.referralCode && u.referralCode.toUpperCase() === cleanCode) ||
      (u.username && u.username.toUpperCase() === cleanCode) ||
      (u.slug && u.slug.toUpperCase() === cleanCode)
  );

  return {
    valid: Boolean(referrer),
    referrer,
    cleanCode
  };
}

export const DEFAULT_REFERRAL_SETTINGS: ReferralSettings = {
  enabled: true,
  referrerBonusAmount: 500, // R$ 5,00 in centavos (Carteira Promocional)
  referredBonusAmount: 500, // R$ 5,00 in centavos (Carteira Promocional)
  referrerLeaguePoints: 50,
  allowWithdrawPromo: false, // Saque PIX bloqueado por padrão na carteira promocional
  allowUseInTrade: false, // VOXA Trade usa apenas saldo real por padrão
  allowUseInStore: true, // Permitido na VOXA Store / Eventos / Assinaturas
  allowUseInAds: true, // Permitido em VOXA Ads
  allowPromoInStore: true,
  allowPromoInTrade: false,
  allowPromoWithdrawal: false,
  autoQualifyOnSignup: true,
  requireProfileComplete: true,
  updatedAt: new Date().toISOString()
};

/**
 * Busca ou inicializa as configurações de indicação e carteira promocional (referral_settings/global)
 */
export async function fetchReferralSettings(): Promise<ReferralSettings> {
  try {
    const docRef = doc(db, 'referral_settings', 'global');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<ReferralSettings>;
      const merged: ReferralSettings = {
        ...DEFAULT_REFERRAL_SETTINGS,
        ...data,
        enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
        referrerBonusAmount: typeof data.referrerBonusAmount === 'number' ? data.referrerBonusAmount : DEFAULT_REFERRAL_SETTINGS.referrerBonusAmount,
        referredBonusAmount: typeof data.referredBonusAmount === 'number' ? data.referredBonusAmount : DEFAULT_REFERRAL_SETTINGS.referredBonusAmount,
        referrerLeaguePoints: typeof data.referrerLeaguePoints === 'number' ? data.referrerLeaguePoints : DEFAULT_REFERRAL_SETTINGS.referrerLeaguePoints,
        allowWithdrawPromo: Boolean(data.allowWithdrawPromo),
        allowUseInTrade: Boolean(data.allowUseInTrade),
        allowUseInStore: data.allowUseInStore !== undefined ? Boolean(data.allowUseInStore) : true,
        allowUseInAds: data.allowUseInAds !== undefined ? Boolean(data.allowUseInAds) : true,
        requireProfileComplete: data.requireProfileComplete !== undefined ? Boolean(data.requireProfileComplete) : true,
        updatedAt: data.updatedAt || new Date().toISOString()
      };
      localStorage.setItem(REFERRAL_SETTINGS_CACHE_KEY, JSON.stringify(merged));
      return merged;
    } else {
      await setDoc(docRef, DEFAULT_REFERRAL_SETTINGS, { merge: true });
      localStorage.setItem(REFERRAL_SETTINGS_CACHE_KEY, JSON.stringify(DEFAULT_REFERRAL_SETTINGS));
      return DEFAULT_REFERRAL_SETTINGS;
    }
  } catch (err) {
    try {
      const saved = localStorage.getItem(REFERRAL_SETTINGS_CACHE_KEY);
      if (saved) return { ...DEFAULT_REFERRAL_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_REFERRAL_SETTINGS;
  }
}

/**
 * Salva configurações do Sistema de Indicação e Carteira Promocional no Firestore
 */
export async function saveReferralSettings(
  updates: Partial<ReferralSettings>,
  adminUid?: string
): Promise<ReferralSettings> {
  const current = await fetchReferralSettings();
  const next: ReferralSettings = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: adminUid || 'admin'
  };
  await setDoc(doc(db, 'referral_settings', 'global'), next, { merge: true });
  localStorage.setItem(REFERRAL_SETTINGS_CACHE_KEY, JSON.stringify(next));

  try {
    const auditId = `audit_ref_${Date.now()}`;
    await setDoc(doc(db, 'admin_audit_logs', auditId), {
      id: auditId,
      action: 'REFERRAL_PROMO_SETTINGS_UPDATED',
      actorUid: adminUid || 'admin',
      targetUid: 'global',
      details: `Bônus Indicador: R$ ${(next.referrerBonusAmount / 100).toFixed(2)} | Indicado: R$ ${(next.referredBonusAmount / 100).toFixed(2)} | Saque Promo: ${next.allowWithdrawPromo ? 'SIM' : 'NÃO'} | Trade Promo: ${next.allowUseInTrade ? 'SIM' : 'NÃO'}`,
      timestamp: next.updatedAt,
      createdAt: next.updatedAt
    });
  } catch {}

  return next;
}

/**
 * Credita ou debita valor exclusivamente na Carteira Promocional (promoBalance),
 * mantendo o saldo real (availableBalance) 100% isolado.
 */
export async function adjustPromoWalletBalance(params: {
  userId: string;
  amountCentavos: number; // positivo para crédito, negativo para estorno
  description: string;
  referenceId: string;
}): Promise<void> {
  if (!params.userId || params.amountCentavos === 0) return;

  try {
    const walletRef = doc(db, 'wallets', params.userId);
    const walletSnap = await getDoc(walletRef);
    const nowIso = new Date().toISOString();

    if (walletSnap.exists()) {
      const currentPromo = Number(walletSnap.data()?.promoBalance || 0);
      const nextPromo = Math.max(0, currentPromo + params.amountCentavos);
      await updateDoc(walletRef, {
        promoBalance: nextPromo,
        updatedAt: nowIso
      });
    } else {
      const nextPromo = Math.max(0, params.amountCentavos);
      await setDoc(walletRef, {
        userId: params.userId,
        balance: 0,
        availableBalance: 0,
        pendingBalance: 0,
        blockedBalance: 0,
        promoBalance: nextPromo,
        totalReceived: 0,
        totalSpent: 0,
        totalWithdrawn: 0,
        updatedAt: nowIso
      });
    }

    const txId = `tx_promo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await setDoc(doc(db, 'wallet_transactions', txId), {
      id: txId,
      userId: params.userId,
      type: 'REFERRAL_BONUS',
      walletType: 'PROMO',
      direction: params.amountCentavos >= 0 ? 'IN' : 'OUT',
      amount: Math.abs(params.amountCentavos),
      grossAmount: Math.abs(params.amountCentavos),
      platformFee: 0,
      netAmount: Math.abs(params.amountCentavos),
      status: 'completed',
      description: params.description,
      referenceId: params.referenceId,
      createdAt: nowIso
    });
  } catch (err) {
    console.warn('[PromoWallet] Failed to adjust promoBalance:', err);
  }
}

/**
 * Busca todos os participantes da League
 */
export async function fetchLeagueParticipants(): Promise<LeagueParticipant[]> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const q = collection(db, 'league_participants');
      const snapshot = await getDocs(q);
      const list: LeagueParticipant[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          userId: data.userId || docSnap.id,
          division: data.division || 10,
          status: data.status || 'PENDENTE',
          points: data.points || 0,
          seasonPoints: data.seasonPoints || 0,
          joinedAt: data.joinedAt || new Date().toISOString(),
          currentPosition: data.currentPosition,
          wins: data.wins || 0,
          losses: data.losses || 0,
          promotions: data.promotions || 0,
          relegations: data.relegations || 0
        });
      });

      localStorage.setItem(LEAGUE_PARTICIPANTS_CACHE_KEY, JSON.stringify(list));
      return list;
    } catch (err) {
      handleFirestoreError('league_participants', err);
    }
  }

  try {
    const saved = localStorage.getItem(LEAGUE_PARTICIPANTS_CACHE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

/**
 * Salva ou atualiza um participante da League
 */
export async function saveLeagueParticipant(participant: LeagueParticipant): Promise<void> {
  const cleanId = participant.id || participant.userId;
  const toSave = {
    ...participant,
    id: cleanId
  };

  try {
    const docRef = doc(db, 'league_participants', cleanId);
    await setDoc(docRef, toSave, { merge: true });
  } catch (err) {
    console.warn("Firestore save league participant failed, saving to local cache fallback:", err);
  }

  // Update localStorage cache
  try {
    const saved = localStorage.getItem(LEAGUE_PARTICIPANTS_CACHE_KEY);
    const list: LeagueParticipant[] = saved ? JSON.parse(saved) : [];
    const idx = list.findIndex(p => p.id === cleanId || p.userId === cleanId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...toSave };
    } else {
      list.push(toSave);
    }
    localStorage.setItem(LEAGUE_PARTICIPANTS_CACHE_KEY, JSON.stringify(list));
  } catch (e) {}
}

/**
 * Solicita entrada de um usuário na League (sempre entra na 10ª Divisão com status PENDENTE)
 */
export async function requestLeagueEntry(user: CentralUser): Promise<LeagueParticipant> {
  const userId = user.id || user.uid || '';
  if (!userId) throw new Error("Usuário inválido para solicitação na League.");

  const participant: LeagueParticipant = {
    id: userId,
    userId,
    division: 10, // Sempre começa na 10ª Divisão
    status: 'PENDENTE',
    points: 0,
    seasonPoints: 0,
    joinedAt: new Date().toISOString(),
    wins: 0,
    losses: 0,
    promotions: 0,
    relegations: 0
  };

  await saveLeagueParticipant(participant);

  // Atualizar dados do usuário central
  const updatedUser: CentralUser = {
    ...user,
    leagueStatus: 'PENDENTE',
    leagueDivision: 10,
    leaguePoints: 0,
    leagueJoinedAt: participant.joinedAt,
    updatedAt: new Date().toISOString()
  };
  await saveCentralUser(updatedUser);

  return participant;
}

/**
 * Aprova solicitação de entrada na League pelo Admin (Ativa na 10ª Divisão)
 */
export async function approveLeagueEntry(participantId: string): Promise<void> {
  const participants = await fetchLeagueParticipants();
  const target = participants.find(p => p.id === participantId || p.userId === participantId);
  if (!target) return;

  target.status = 'ATIVO';
  target.division = 10;
  await saveLeagueParticipant(target);

  const users = await fetchCentralUsers();
  const user = users.find(u => u.id === target.userId || u.uid === target.userId);
  if (user) {
    user.leagueStatus = 'ATIVO';
    user.leagueDivision = 10;
    user.updatedAt = new Date().toISOString();
    await saveCentralUser(user);
  }
}

/**
 * Recusa ou altera status de um participante da League
 */
export async function updateLeagueParticipantStatus(
  participantId: string, 
  status: LeagueStatus,
  division?: number
): Promise<void> {
  const participants = await fetchLeagueParticipants();
  const target = participants.find(p => p.id === participantId || p.userId === participantId);
  if (!target) return;

  target.status = status;
  if (division !== undefined && division >= 1 && division <= 10) {
    target.division = division;
  }
  await saveLeagueParticipant(target);

  const users = await fetchCentralUsers();
  const user = users.find(u => u.id === target.userId || u.uid === target.userId);
  if (user) {
    user.leagueStatus = status;
    if (division !== undefined) {
      user.leagueDivision = division;
    }
    user.updatedAt = new Date().toISOString();
    await saveCentralUser(user);
  }
}

/**
 * Ajuste administrativo de pontos na League com auditoria completa
 */
export async function adjustLeaguePoints(params: {
  userId: string;
  change: number;
  reason: string;
  type: string;
  reference: string;
  adminEmail: string;
}): Promise<void> {
  const participants = await fetchLeagueParticipants();
  const target = participants.find(p => p.id === params.userId || p.userId === params.userId);
  if (!target) throw new Error("Participante não encontrado na League.");

  const previousValue = target.points || 0;
  const finalValue = Math.max(0, previousValue + params.change);
  target.points = finalValue;
  target.seasonPoints = Math.max(0, (target.seasonPoints || 0) + params.change);

  await saveLeagueParticipant(target);

  // Registrar auditoria
  const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const tx: LeaguePointTransaction = {
    id: transactionId,
    userId: params.userId,
    previousValue,
    change: params.change,
    finalValue,
    type: params.type,
    reference: params.reference,
    reason: params.reason,
    createdAt: new Date().toISOString(),
    createdBy: params.adminEmail
  };

  try {
    const docRef = doc(db, 'league_point_transactions', transactionId);
    await setDoc(docRef, tx);
  } catch (err) {
    console.warn("Could not save point transaction to firestore:", err);
  }

  // Atualizar cache local de transações
  try {
    const saved = localStorage.getItem(LEAGUE_TRANSACTIONS_CACHE_KEY);
    const list: LeaguePointTransaction[] = saved ? JSON.parse(saved) : [];
    list.unshift(tx);
    localStorage.setItem(LEAGUE_TRANSACTIONS_CACHE_KEY, JSON.stringify(list));
  } catch (e) {}

  // Atualizar usuário central
  const users = await fetchCentralUsers();
  const user = users.find(u => u.id === params.userId || u.uid === params.userId);
  if (user) {
    user.leaguePoints = finalValue;
    user.lifetimePoints = Math.max(0, (user.lifetimePoints || 0) + params.change);
    user.updatedAt = new Date().toISOString();
    await saveCentralUser(user);
  }
}

/**
 * Registra uma indicação de cadastro seguindo o fluxo:
 * CLICKED -> REGISTERED -> QUALIFIED -> REWARDED
 * Não credita bônus somente pelo clique. Valida se o código realmente existe antes de vincular.
 */
export async function recordReferral(params: {
  referrerCode: string;
  referredUserId: string;
  source?: string;
  profileComplete?: boolean;
  qualifyImmediately?: boolean;
}): Promise<Referral | null> {
  const cleanCode = (params.referrerCode || '').replace(/^@+/, '').trim().toUpperCase();
  if (!cleanCode || !params.referredUserId) return null;

  // Valida no backend/Firestore se o código existe antes de vincular (antifraude)
  const validation = await validateReferralCodeExists(cleanCode);
  if (!validation.valid || !validation.referrer) {
    console.warn(`[Referral] Código de indicação inexistente ou inválido rejeitado: ${cleanCode}`);
    return null;
  }

  const [users, settings, referrals] = await Promise.all([
    fetchCentralUsers(),
    fetchReferralSettings(),
    fetchReferrals()
  ]);

  if (!settings.enabled) {
    return null;
  }

  const referrer = validation.referrer;
  const referrerId = referrer.id || referrer.uid || '';
  if (!referrerId || referrerId === params.referredUserId) {
    console.warn("Self-referral blocked");
    return null; // Bloqueio de auto-indicação
  }

  // Verificar se o usuário já tem indicação registrada
  const alreadyReferred = referrals.find(r => r.referredUserId === params.referredUserId);
  if (alreadyReferred) {
    // Se já estava como REGISTERED (pendente de conclusão de perfil no Google OAuth) e agora concluiu o perfil, qualifica e recompensa
    if (
      params.profileComplete === true &&
      (alreadyReferred.lifecycleStage === 'REGISTERED' || alreadyReferred.status === 'pending') &&
      !alreadyReferred.bonusCredited
    ) {
      return await qualifyPendingReferralForUser(params.referredUserId);
    }
    return alreadyReferred;
  }

  const referralId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const nowIso = new Date().toISOString();
  const clickedAt =
    localStorage.getItem(PENDING_REFERRAL_CLICK_AT_KEY) ||
    sessionStorage.getItem(PENDING_REFERRAL_CLICK_AT_KEY) ||
    nowIso;

  const isProfileComplete =
    params.qualifyImmediately !== undefined
      ? params.qualifyImmediately
      : params.profileComplete !== undefined
        ? params.profileComplete
        : true;
  const autoQualify = settings.autoQualifyOnSignup !== false;
  const shouldQualifyNow = autoQualify && (!settings.requireProfileComplete || isProfileComplete);

  const referredUser = users.find(u => u.id === params.referredUserId || u.uid === params.referredUserId);

  const refDoc: Referral = {
    id: referralId,
    referrerUserId: referrerId,
    referredUserId: params.referredUserId,
    referralCode: cleanCode,
    createdAt: nowIso,
    clickedAt,
    registeredAt: nowIso,
    status: shouldQualifyNow ? 'qualified' : 'pending',
    lifecycleStage: shouldQualifyNow ? 'REWARDED' : 'REGISTERED',
    qualifiedAt: shouldQualifyNow ? nowIso : undefined,
    rewardedAt: shouldQualifyNow ? nowIso : undefined,
    source: params.source || 'signup_referral',
    referrerName: referrer.name || referrer.username || referrerId,
    referredName: referredUser?.name || referredUser?.username || params.referredUserId,
    bonusAmountCentavos: settings.referrerBonusAmount,
    referrerBonusAmount: settings.referrerBonusAmount,
    referredBonusAmount: settings.referredBonusAmount,
    bonusCredited: shouldQualifyNow,
    promoCredited: shouldQualifyNow,
    walletType: 'PROMO'
  };

  try {
    const docRef = doc(db, 'referrals', referralId);
    await setDoc(docRef, refDoc);
  } catch (err) {
    console.warn("Firestore save referral failed, saving to local cache fallback:", err);
  }

  if (shouldQualifyNow) {
    // Creditar bônus na Carteira Promocional separada (promoBalance)
    if (settings.referrerBonusAmount > 0) {
      await adjustPromoWalletBalance({
        userId: referrerId,
        amountCentavos: settings.referrerBonusAmount,
        description: `Bônus de Indicação VOXA (Carteira Promocional) — Novo membro indicado`,
        referenceId: referralId
      });
    }

    if (settings.referredBonusAmount > 0) {
      await adjustPromoWalletBalance({
        userId: params.referredUserId,
        amountCentavos: settings.referredBonusAmount,
        description: `Bônus de Boas-Vindas por Indicação (${cleanCode}) — Carteira Promocional`,
        referenceId: referralId
      });
    }

    // Creditar pontos de League se configurado
    if (settings.referrerLeaguePoints > 0) {
      try {
        await adjustLeaguePoints({
          userId: referrerId,
          change: settings.referrerLeaguePoints,
          reason: `Indicação qualificada (${cleanCode})`,
          type: 'REFERRAL',
          reference: referralId,
          adminEmail: 'system@voxa.com.br'
        });
      } catch {}
    }

    // Limpa código temporário somente após conclusão total
    clearPendingReferralCode();
  }

  // Update localStorage cache
  try {
    const saved = localStorage.getItem(REFERRALS_CACHE_KEY);
    const list: Referral[] = saved ? JSON.parse(saved) : [];
    list.unshift(refDoc);
    localStorage.setItem(REFERRALS_CACHE_KEY, JSON.stringify(list));
  } catch (e) {}

  // Atualizar usuário indicado com referredByUserId
  if (referredUser) {
    referredUser.referredByUserId = referrerId;
    referredUser.updatedAt = nowIso;
    await saveCentralUser(referredUser);
  } else {
    try {
      await setDoc(doc(db, 'users', params.referredUserId), {
        referredByUserId: referrerId,
        updatedAt: nowIso
      }, { merge: true });
    } catch {}
  }

  return refDoc;
}

/**
 * Promove uma indicação no estado REGISTERED (ex.: criada via Google OAuth antes do Onboarding)
 * para QUALIFIED -> REWARDED assim que o novo usuário completa o cadastro/perfil.
 */
export async function qualifyPendingReferralForUser(referredUserId: string): Promise<Referral | null> {
  if (!referredUserId) return null;
  const [referrals, settings] = await Promise.all([
    fetchReferrals(),
    fetchReferralSettings()
  ]);

  const target = referrals.find(r => r.referredUserId === referredUserId);
  if (!target) {
    // Se ainda havia código salvo na sessão e não tinha sido gravado, grava e qualifica agora
    const pendingCode = captureAndPersistReferralCodeFromUrl();
    if (pendingCode) {
      return await recordReferral({
        referrerCode: pendingCode,
        referredUserId,
        source: 'onboarding_completed',
        profileComplete: true
      });
    }
    return null;
  }

  if (target.status === 'fraud_rejected' || target.bonusCredited) {
    clearPendingReferralCode();
    return target;
  }

  if (settings.autoQualifyOnSignup === false) {
    clearPendingReferralCode();
    return target;
  }

  const nowIso = new Date().toISOString();
  target.status = 'qualified';
  target.lifecycleStage = 'REWARDED';
  target.qualifiedAt = nowIso;
  target.rewardedAt = nowIso;
  target.bonusCredited = true;
  target.promoCredited = true;

  const referrerAmt = target.referrerBonusAmount ?? settings.referrerBonusAmount;
  const referredAmt = target.referredBonusAmount ?? settings.referredBonusAmount;

  if (referrerAmt > 0) {
    await adjustPromoWalletBalance({
      userId: target.referrerUserId,
      amountCentavos: referrerAmt,
      description: `Bônus de Indicação VOXA (Carteira Promocional) — Cadastro qualificado`,
      referenceId: target.id
    });
  }

  if (referredAmt > 0) {
    await adjustPromoWalletBalance({
      userId: referredUserId,
      amountCentavos: referredAmt,
      description: `Bônus de Boas-Vindas por Indicação (${target.referralCode}) — Carteira Promocional`,
      referenceId: target.id
    });
  }

  if (settings.referrerLeaguePoints > 0) {
    try {
      await adjustLeaguePoints({
        userId: target.referrerUserId,
        change: settings.referrerLeaguePoints,
        reason: `Indicação qualificada (${target.referralCode})`,
        type: 'REFERRAL',
        reference: target.id,
        adminEmail: 'system@voxa.com.br'
      });
    } catch {}
  }

  try {
    await setDoc(doc(db, 'referrals', target.id), target, { merge: true });
  } catch {}

  clearPendingReferralCode();
  return target;
}

/**
 * Permite ao Admin aprovar ou rejeitar por fraude uma indicação, estornando o saldo promocional se necessário
 */
export async function updateReferralStatusAdmin(
  referralId: string,
  newStatus: 'qualified' | 'fraud_rejected'
): Promise<void> {
  const referrals = await fetchReferrals();
  const target = referrals.find(r => r.id === referralId);
  if (!target || target.status === newStatus) return;

  const settings = await fetchReferralSettings();
  const prevStatus = target.status;
  target.status = newStatus;

  if (newStatus === 'fraud_rejected' && prevStatus === 'qualified' && target.bonusCredited) {
    const referrerAmt = target.referrerBonusAmount ?? settings.referrerBonusAmount;
    const referredAmt = target.referredBonusAmount ?? settings.referredBonusAmount;
    if (referrerAmt > 0) {
      await adjustPromoWalletBalance({
        userId: target.referrerUserId,
        amountCentavos: -referrerAmt,
        description: `Estorno de Bônus Promocional — Indicação reprovada na auditoria (${referralId})`,
        referenceId: referralId
      });
    }
    if (referredAmt > 0) {
      await adjustPromoWalletBalance({
        userId: target.referredUserId,
        amountCentavos: -referredAmt,
        description: `Estorno de Bônus Promocional — Indicação reprovada na auditoria (${referralId})`,
        referenceId: referralId
      });
    }
    target.bonusCredited = false;
  } else if (newStatus === 'qualified' && !target.bonusCredited) {
    const referrerAmt = target.referrerBonusAmount ?? settings.referrerBonusAmount;
    const referredAmt = target.referredBonusAmount ?? settings.referredBonusAmount;
    if (referrerAmt > 0) {
      await adjustPromoWalletBalance({
        userId: target.referrerUserId,
        amountCentavos: referrerAmt,
        description: `Bônus de Indicação Aprovado (${referralId}) — Carteira Promocional`,
        referenceId: referralId
      });
    }
    if (referredAmt > 0) {
      await adjustPromoWalletBalance({
        userId: target.referredUserId,
        amountCentavos: referredAmt,
        description: `Bônus de Indicação Aprovado (${referralId}) — Carteira Promocional`,
        referenceId: referralId
      });
    }
    target.bonusCredited = true;
    target.qualifiedAt = new Date().toISOString();
  }

  try {
    await setDoc(doc(db, 'referrals', referralId), target, { merge: true });
  } catch (e) {
    console.warn("Could not update referral doc:", e);
  }
}

/**
 * Busca todas as indicações
 */
export async function fetchReferrals(): Promise<Referral[]> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const q = collection(db, 'referrals');
      const snapshot = await getDocs(q);
      const list: Referral[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Referral);
      });
      localStorage.setItem(REFERRALS_CACHE_KEY, JSON.stringify(list));
      return list;
    } catch (err) {
      handleFirestoreError('referrals', err);
    }
  }

  try {
    const saved = localStorage.getItem(REFERRALS_CACHE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}
