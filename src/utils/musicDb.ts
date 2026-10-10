import { db, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, isFirebaseConfigured } from '../lib/firebase';
import { DetailedArtist, MusicStream, Community } from '../types';
import { isFirestoreQuotaThrottled, handleFirestoreError } from './storeDb';

const ARTISTS_LOCAL_KEY = 'lockdown_music_artists';
const STREAMS_LOCAL_KEY = 'lockdown_music_streams';
const COMMUNITIES_LOCAL_KEY = 'lockdown_music_communities';

// Static default seed data
const DEFAULT_ARTISTS: DetailedArtist[] = [];

const DEFAULT_STREAMS: MusicStream[] = [];

// LocalStorage helpers
function getLocalArtists(): DetailedArtist[] {
  const saved = localStorage.getItem(ARTISTS_LOCAL_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }
  // Initialize with seed data
  localStorage.setItem(ARTISTS_LOCAL_KEY, JSON.stringify(DEFAULT_ARTISTS));
  return DEFAULT_ARTISTS;
}

function saveLocalArtists(artists: DetailedArtist[]) {
  localStorage.setItem(ARTISTS_LOCAL_KEY, JSON.stringify(artists));
}

function getLocalStreams(): MusicStream[] {
  const saved = localStorage.getItem(STREAMS_LOCAL_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }
  localStorage.setItem(STREAMS_LOCAL_KEY, JSON.stringify(DEFAULT_STREAMS));
  return DEFAULT_STREAMS;
}

function saveLocalStreams(streams: MusicStream[]) {
  localStorage.setItem(STREAMS_LOCAL_KEY, JSON.stringify(streams));
}

// Public API
export async function fetchArtists(): Promise<DetailedArtist[]> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const q = collection(db, 'artists');
      const snapshot = await getDocs(q);
      const list: DetailedArtist[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as DetailedArtist);
      });
      // Sync local storage for speed/robustness
      saveLocalArtists(list);
      return list;
    } catch (err) {
      handleFirestoreError('artists', err);
    }
  }
  return getLocalArtists();
}

export async function saveArtist(artist: DetailedArtist): Promise<void> {
  // Save to Firestore if configured
  try {
    if (isFirebaseConfigured()) {
      await setDoc(doc(db, 'artists', artist.id), artist);
    } else {
      console.warn("O Firebase não está ativo ou configurado. Salvando artista em cache local.");
    }
  } catch (err: any) {
    console.error("Firestore artist save failed, fallback to local storage:", err);
  }

  // Always sync local storage to keep UI updated
  const list = getLocalArtists().filter(a => a.id !== artist.id);
  list.push(artist);
  saveLocalArtists(list);
}

export async function deleteArtistDoc(id: string): Promise<void> {
  // Delete from Firestore if configured
  try {
    if (isFirebaseConfigured()) {
      await deleteDoc(doc(db, 'artists', id));
    } else {
      console.warn("O Firebase não está ativo ou configurado. Removendo artista do cache local.");
    }
  } catch (err: any) {
    console.error("Firestore artist delete failed, fallback to local storage:", err);
  }

  // Always sync local storage to keep UI updated
  const list = getLocalArtists().filter(a => a.id !== id);
  saveLocalArtists(list);
}

export async function fetchMusicStreams(): Promise<MusicStream[]> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const q = collection(db, 'music_streams');
      const snapshot = await getDocs(q);
      const list: MusicStream[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as MusicStream);
      });
      saveLocalStreams(list);
      return list;
    } catch (err) {
      handleFirestoreError('music_streams', err);
    }
  }
  return getLocalStreams();
}

export async function saveMusicStream(stream: MusicStream): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("O Firebase não está conectado ou configurado no ambiente. O cadastro de músicas exige que a integração em nuvem esteja ativa para que fiquem visíveis para todos os visitantes.");
  }

  try {
    await setDoc(doc(db, 'music_streams', stream.id), stream);

    // Log activity
    try {
      const { logActivity } = await import('./activities');
      const actorId = stream.artistIds && stream.artistIds.length > 0 ? stream.artistIds[0] : '';
      if (actorId) {
        await logActivity(actorId, 'music_submission', `lançou a música "${stream.title}"`, { streamId: stream.id });
      }
    } catch (actErr) {
      console.warn("Could not log activity for music submission:", actErr);
    }
  } catch (err: any) {
    console.error("Firestore stream save failed:", err);
    throw new Error(`Falha ao salvar música no Firestore: ${err.message || err}`);
  }

  const list = getLocalStreams().filter(s => s.id !== stream.id);
  list.push(stream);
  saveLocalStreams(list);
}

export async function deleteMusicStreamDoc(id: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("O Firebase não está conectado ou configurado no ambiente. A remoção de músicas exige que a integração em nuvem esteja ativa.");
  }

  try {
    await deleteDoc(doc(db, 'music_streams', id));
  } catch (err: any) {
    console.error("Firestore stream delete failed:", err);
    throw new Error(`Falha ao remover música do Firestore: ${err.message || err}`);
  }

  const list = getLocalStreams().filter(s => s.id !== id);
  saveLocalStreams(list);
}

// Communities LocalStorage helpers
function getLocalCommunities(): Community[] {
  const saved = localStorage.getItem(COMMUNITIES_LOCAL_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }
  return [];
}

function saveLocalCommunities(communities: Community[]) {
  localStorage.setItem(COMMUNITIES_LOCAL_KEY, JSON.stringify(communities));
}

// Communities Cloud / DB operations
export async function fetchCommunities(): Promise<Community[]> {
  if (!isFirestoreQuotaThrottled()) {
    try {
      const q = collection(db, 'communities');
      const snapshot = await getDocs(q);
      const list: Community[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as Community);
      });
      saveLocalCommunities(list);
      return list;
    } catch (err) {
      handleFirestoreError('communities', err);
    }
  }
  return getLocalCommunities();
}

export async function saveCommunity(community: Community): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("O Firebase não está conectado ou configurado no ambiente. O cadastro de comunidades exige que a integração em nuvem esteja ativa.");
  }

  try {
    await setDoc(doc(db, 'communities', community.id), community);
  } catch (err: any) {
    console.error("Firestore community save failed:", err);
    throw new Error(`Falha ao salvar comunidade no Firestore: ${err.message || err}`);
  }

  const list = getLocalCommunities().filter(c => c.id !== community.id);
  list.push(community);
  saveLocalCommunities(list);
}

export async function deleteCommunityDoc(id: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("O Firebase não está conectado ou configurado no ambiente. A remoção de comunidades exige que a integração em nuvem esteja ativa.");
  }

  try {
    await deleteDoc(doc(db, 'communities', id));
  } catch (err: any) {
    console.error("Firestore community delete failed:", err);
    throw new Error(`Falha ao remover comunidade do Firestore: ${err.message || err}`);
  }

  const list = getLocalCommunities().filter(c => c.id !== id);
  saveLocalCommunities(list);
}
