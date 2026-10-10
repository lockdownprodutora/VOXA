import { useEffect, useRef } from 'react';
import { db, isFirebaseConfigured, doc, setDoc, isFirestoreWriteQuotaExhausted, markFirestoreWriteQuotaExhausted } from '../lib/firebase';

export const PRESENCE_ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes heartbeat timeout

export interface ApproximateLocation {
  country: string;
  state: string;
  city: string;
  region: string;
  updatedAt: string;
}

export interface UserPresenceRecord {
  uid: string;
  name?: string;
  username?: string;
  photoURL?: string;
  status: 'ONLINE' | 'OFFLINE';
  activeTab?: string;
  lastSeenAt: string;
  lastHeartbeatAt: string;
  lastHeartbeatMs?: number;
  approximateLocation?: ApproximateLocation | null;
}

/**
 * Checks whether a presence document represents an actively online user right now.
 * Never relies merely on Firebase Auth existence — requires heartbeat within threshold.
 */
export function isUserOnlineNow(presence: Partial<UserPresenceRecord> | null | undefined): boolean {
  if (!presence || presence.status !== 'ONLINE') return false;
  const heartbeatMs =
    typeof presence.lastHeartbeatMs === 'number'
      ? presence.lastHeartbeatMs
      : presence.lastHeartbeatAt
      ? new Date(presence.lastHeartbeatAt).getTime()
      : 0;
  if (!heartbeatMs || Number.isNaN(heartbeatMs)) return false;
  return Date.now() - heartbeatMs <= PRESENCE_ONLINE_THRESHOLD_MS;
}

/**
 * Maps a Brazilian state name or UF code to its macro-region for privacy-safe analytics.
 */
export function resolveMacroRegion(stateRaw: string, countryRaw: string): string {
  const country = (countryRaw || '').trim().toLowerCase();
  if (country && !country.includes('brasil') && !country.includes('brazil') && country !== 'br') {
    return 'Internacional';
  }

  const s = (stateRaw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^estado d[eo]\s+/i, '')
    .trim();

  const norte = ['ac', 'acre', 'ap', 'amapa', 'am', 'amazonas', 'pa', 'para', 'ro', 'rondonia', 'rr', 'roraima', 'to', 'tocantins'];
  const nordeste = ['al', 'alagoas', 'ba', 'bahia', 'ce', 'ceara', 'ma', 'maranhao', 'pb', 'paraiba', 'pe', 'pernambuco', 'pi', 'piaui', 'rn', 'rio grande do norte', 'se', 'sergipe'];
  const centroOeste = ['df', 'distrito federal', 'brasilia', 'go', 'goias', 'mt', 'mato grosso', 'ms', 'mato grosso do sul'];
  const sudeste = ['es', 'espirito santo', 'mg', 'minas gerais', 'rj', 'rio de janeiro', 'sp', 'sao paulo'];
  const sul = ['pr', 'parana', 'rs', 'rio grande do sul', 'sc', 'santa catarina'];

  if (sudeste.includes(s)) return 'Sudeste';
  if (sul.includes(s)) return 'Sul';
  if (nordeste.includes(s)) return 'Nordeste';
  if (centroOeste.includes(s)) return 'Centro-Oeste';
  if (norte.includes(s)) return 'Norte';
  return 'Brasil (Outras)';
}

/**
 * Converts browser GPS coordinates into coarse city/state/country/region only.
 * Never persists raw lat/lng, street address, postal code, or residential details.
 */
export async function reverseGeocodeApproximate(lat: number, lon: number): Promise<ApproximateLocation> {
  // Round coordinates before querying external geocoder to further protect privacy
  const coarseLat = Math.round(lat * 100) / 100;
  const coarseLon = Math.round(lon * 100) / 100;

  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coarseLat}&longitude=${coarseLon}&localityLanguage=pt`
    );
    if (res.ok) {
      const data = await res.json();
      const country = data.countryName || 'Brasil';
      const state = data.principalSubdivision || 'Não informado';
      const city = data.city || data.locality || 'Não informada';
      const region = resolveMacroRegion(state, country);
      return {
        country,
        state,
        city,
        region,
        updatedAt: new Date().toISOString()
      };
    }
  } catch {}

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coarseLat}&lon=${coarseLon}&zoom=10&accept-language=pt-BR`
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const country = addr.country || 'Brasil';
      const state = addr.state || addr.region || 'Não informado';
      const city = addr.city || addr.town || addr.municipality || addr.village || 'Não informada';
      const region = resolveMacroRegion(state, country);
      return {
        country,
        state,
        city,
        region,
        updatedAt: new Date().toISOString()
      };
    }
  } catch {}

  return {
    country: 'Brasil',
    state: 'Não informado',
    city: 'Não informada',
    region: 'Brasil',
    updatedAt: new Date().toISOString()
  };
}

/**
 * Requests browser Geolocation permission and persists only coarse approximate location.
 */
export async function requestAndSaveApproximateLocation(uid: string): Promise<ApproximateLocation | null> {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const approx = await reverseGeocodeApproximate(
            position.coords.latitude,
            position.coords.longitude
          );
          localStorage.setItem(`voxa_approx_location_${uid}`, JSON.stringify(approx));
          localStorage.setItem(`voxa_location_consent_${uid}`, 'granted');

          if (isFirebaseConfigured() && uid) {
            const nowIso = new Date().toISOString();
            await Promise.allSettled([
              setDoc(
                doc(db, 'user_presence', uid),
                {
                  uid,
                  approximateLocation: approx,
                  lastSeenAt: nowIso
                },
                { merge: true }
              ),
              setDoc(
                doc(db, 'users', uid),
                {
                  approximateLocation: approx,
                  updatedAt: nowIso
                },
                { merge: true }
              )
            ]);
          }
          resolve(approx);
        } catch {
          resolve(null);
        }
      },
      () => {
        localStorage.setItem(`voxa_location_consent_${uid}`, 'denied');
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 600000
      }
    );
  });
}

/**
 * Real-time presence & heartbeat hook for logged-in VOXA users.
 */
export function useUserPresence(currentUser: any, activeTab: string) {
  const uid = currentUser?.uid || currentUser?.id || '';
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) return;

    const sendHeartbeat = async (status: 'ONLINE' | 'OFFLINE') => {
      if (isFirestoreWriteQuotaExhausted()) return;
      try {
        const now = Date.now();
        const nowIso = new Date(now).toISOString();
        let approxLoc: ApproximateLocation | null = null;
        try {
          const rawLoc = localStorage.getItem(`voxa_approx_location_${uid}`);
          if (rawLoc) approxLoc = JSON.parse(rawLoc);
        } catch {}

        const payload: Record<string, any> = {
          uid,
          name: currentUser?.name || 'Usuário',
          username: currentUser?.username || currentUser?.slug || '',
          photoURL: currentUser?.photoURL || '',
          status,
          activeTab: activeTabRef.current || 'home',
          lastSeenAt: nowIso,
          lastHeartbeatAt: nowIso,
          lastHeartbeatMs: now
        };

        if (approxLoc) {
          payload.approximateLocation = approxLoc;
        }

        await setDoc(doc(db, 'user_presence', uid), payload, { merge: true });
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (err?.code === 'resource-exhausted' || msg.includes('Quota') || msg.includes('quota')) {
          markFirestoreWriteQuotaExhausted();
        }
      }
    };

    // Initial online heartbeat
    sendHeartbeat('ONLINE');

    // Periodic heartbeat every 150s while tab is visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !isFirestoreWriteQuotaExhausted()) {
        sendHeartbeat('ONLINE');
      }
    }, 150000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat('ONLINE');
      } else {
        sendHeartbeat('OFFLINE');
      }
    };

    const handleBeforeUnload = () => {
      sendHeartbeat('OFFLINE');
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [uid, currentUser?.name, currentUser?.username, currentUser?.photoURL]);
}
