import { db } from '../lib/firebase';
import { 
  collection, doc, getDocs, setDoc, deleteDoc, 
  query, where, serverTimestamp, getDoc 
} from 'firebase/firestore';

const RAFFLES_COLLECTION = 'raffles';
const RAFFLE_REQUESTS_COLLECTION = 'raffle_requests';
const RAFFLE_PARTICIPANTS_COLLECTION = 'raffle_participants';

export interface PrizeDefinition {
  position: number; // 1 = 1º Prêmio, 2 = 2º Prêmio, etc.
  name: string;
  description: string;
  type: 'PRODUTO' | 'BENEFÍCIO' | 'VALOR FINANCEIRO';
  value?: string; // e.g. "R$ 1.000,00"
  imageUrl?: string;
}

export interface Raffle {
  id: string;
  name: string;
  description: string;
  prizeImageUrl?: string;
  startDate: string;
  endDate: string;
  status: 'RASCUNHO' | 'PENDENTE' | 'APROVADO' | 'PUBLICADO' | 'ENCERRADO' | 'CANCELADO';
  totalNumbers: number;
  startNumber: number; // e.g. 1
  endNumber: number; // e.g. 1000
  rules: string;
  organizerUserId: string;
  organizerName: string;
  organizerPhoto?: string;
  organizerType: 'ARTISTA' | 'USUÁRIO COMUM' | 'PRODUTORA' | 'EMPRESA';
  prizes: PrizeDefinition[];
  createdAt: string;
  updatedAt: string;
  
  // Review details if requested
  reviewedBy?: string;
  reviewedAt?: string;
  reviewReason?: string;
}

export interface RaffleParticipant {
  id: string;
  userId: string;
  raffleId: string;
  number: string; // e.g. "0045"
  status: 'RESERVADO' | 'CONFIRMADO' | 'CANCELADO' | 'VENDEDOR'; // VENDEDOR = Vencedor/Winner
  createdAt: string;
  updatedAt: string;
}

// Local cache keys
const RAFFLES_CACHE_KEY = 'lockdown_raffles_cache';
const PARTICIPANTS_CACHE_KEY = 'lockdown_raffle_participants_cache';

/**
 * Fetch all raffles safely with fallback
 */
export async function fetchRaffles(): Promise<Raffle[]> {
  try {
    const q = collection(db, RAFFLES_COLLECTION);
    const snapshot = await getDocs(q);
    const list: Raffle[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as Raffle);
    });
    
    localStorage.setItem(RAFFLES_CACHE_KEY, JSON.stringify(list));
    return list;
  } catch (error) {
    console.warn("Firestore error, loading raffles from cache:", error);
    const cached = localStorage.getItem(RAFFLES_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  }
}

/**
 * Save/Update raffle
 */
export async function saveRaffle(raffle: Raffle): Promise<void> {
  try {
    const docRef = doc(db, RAFFLES_COLLECTION, raffle.id);
    const cleanData = { ...raffle };
    await setDoc(docRef, cleanData);
    
    // Update local cache
    const raffles = await fetchRaffles().catch(() => {
      const cached = localStorage.getItem(RAFFLES_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    });
    const updated = raffles.filter((r: Raffle) => r.id !== raffle.id);
    updated.push(raffle);
    localStorage.setItem(RAFFLES_CACHE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save raffle to Firestore, saving to cache:", error);
    const cached = localStorage.getItem(RAFFLES_CACHE_KEY);
    const raffles: Raffle[] = cached ? JSON.parse(cached) : [];
    const updated = raffles.filter(r => r.id !== raffle.id);
    updated.push(raffle);
    localStorage.setItem(RAFFLES_CACHE_KEY, JSON.stringify(updated));
  }
}

/**
 * Delete raffle doc safely
 */
export async function deleteRaffleDoc(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, RAFFLES_COLLECTION, id));
    
    // Update local cache
    const cached = localStorage.getItem(RAFFLES_CACHE_KEY);
    if (cached) {
      const list: Raffle[] = JSON.parse(cached);
      const filtered = list.filter(r => r.id !== id);
      localStorage.setItem(RAFFLES_CACHE_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error("Failed to delete raffle from Firestore, removing from cache:", error);
    const cached = localStorage.getItem(RAFFLES_CACHE_KEY);
    if (cached) {
      const list: Raffle[] = JSON.parse(cached);
      const filtered = list.filter(r => r.id !== id);
      localStorage.setItem(RAFFLES_CACHE_KEY, JSON.stringify(filtered));
    }
  }
}

/**
 * Fetch all participants for a raffle or globally
 */
export async function fetchRaffleParticipants(raffleId?: string): Promise<RaffleParticipant[]> {
  try {
    const q = collection(db, RAFFLE_PARTICIPANTS_COLLECTION);
    const snapshot = await getDocs(q);
    const list: RaffleParticipant[] = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() } as RaffleParticipant);
    });
    
    localStorage.setItem(PARTICIPANTS_CACHE_KEY, JSON.stringify(list));
    
    if (raffleId) {
      return list.filter(p => p.raffleId === raffleId);
    }
    return list;
  } catch (error) {
    console.warn("Firestore error, loading participants from cache:", error);
    const cached = localStorage.getItem(PARTICIPANTS_CACHE_KEY);
    const list: RaffleParticipant[] = cached ? JSON.parse(cached) : [];
    if (raffleId) {
      return list.filter(p => p.raffleId === raffleId);
    }
    return list;
  }
}

/**
 * Save/Update raffle participant (number allocation)
 */
export async function saveRaffleParticipant(participant: RaffleParticipant): Promise<void> {
  try {
    const docRef = doc(db, RAFFLE_PARTICIPANTS_COLLECTION, participant.id);
    await setDoc(docRef, participant);
    
    // Update local cache
    const list = await fetchRaffleParticipants().catch(() => {
      const cached = localStorage.getItem(PARTICIPANTS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    });
    const updated = list.filter((p: RaffleParticipant) => p.id !== participant.id);
    updated.push(participant);
    localStorage.setItem(PARTICIPANTS_CACHE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save participant to Firestore, updating local storage:", error);
    const cached = localStorage.getItem(PARTICIPANTS_CACHE_KEY);
    const list: RaffleParticipant[] = cached ? JSON.parse(cached) : [];
    const updated = list.filter(p => p.id !== participant.id);
    updated.push(participant);
    localStorage.setItem(PARTICIPANTS_CACHE_KEY, JSON.stringify(updated));
  }
}

/**
 * Delete a participant assignment (freeing a number)
 */
export async function deleteRaffleParticipantDoc(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, RAFFLE_PARTICIPANTS_COLLECTION, id));
    
    const cached = localStorage.getItem(PARTICIPANTS_CACHE_KEY);
    if (cached) {
      const list: RaffleParticipant[] = JSON.parse(cached);
      const filtered = list.filter(p => p.id !== id);
      localStorage.setItem(PARTICIPANTS_CACHE_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error("Failed to delete participant doc, removing from cache:", error);
    const cached = localStorage.getItem(PARTICIPANTS_CACHE_KEY);
    if (cached) {
      const list: RaffleParticipant[] = JSON.parse(cached);
      const filtered = list.filter(p => p.id !== id);
      localStorage.setItem(PARTICIPANTS_CACHE_KEY, JSON.stringify(filtered));
    }
  }
}
