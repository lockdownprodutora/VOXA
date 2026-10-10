import { initializeApp, getApps, setLogLevel } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInAnonymously, sendPasswordResetEmail } from "firebase/auth";
import { getFirestore, initializeFirestore, setLogLevel as setFirestoreLogLevel, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, limit } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { getMessaging, getToken, onMessage, isSupported as isMessagingSupported, Messaging } from "firebase/messaging";
import firebaseAppletConfig from "../../firebase-applet-config.json";

if (typeof window !== "undefined") {
  setLogLevel("silent");
  setFirestoreLogLevel("silent");
}

// Strict VOXA environment check
const hasCustomEnv = 
  !!(import.meta as any).env?.VITE_FIREBASE_PROJECT_ID && 
  (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID !== "lockdownhot";

// If in production/build outside AI Studio and no custom env is present, log a warning instead of crashing
if (!hasCustomEnv && (import.meta as any).env?.PROD) {
  console.warn("[VOXA Firebase] Usando as credenciais de fallback do applet (firebase-applet-config.json).");
}

const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || firebaseAppletConfig?.apiKey || "",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig?.authDomain || "",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig?.projectId || "",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig?.storageBucket || "",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig?.messagingSenderId || "",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || firebaseAppletConfig?.appId || ""
};

// Check if we are running in the AI Studio cloud sandbox preview
export const isSandbox = (): boolean => {
  return !hasCustomEnv && firebaseConfig.projectId === "lockdownhot";
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn("[VOXA Firebase] Chaves de configuração do Firebase ausentes.");
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export let messaging: Messaging | null = null;
if (typeof window !== "undefined") {
  isMessagingSupported()
    .then((supported) => {
      if (supported) {
        try {
          messaging = getMessaging(app);
        } catch (e) {
          console.warn("[VOXA Firebase] Messaging não suportado neste contexto:", e);
        }
      }
    })
    .catch(() => {});
}

const dbId = (firebaseAppletConfig as any)?.firestoreDatabaseId;
export const db = dbId && dbId !== "(default)"
  ? initializeFirestore(app, { experimentalForceLongPolling: true }, dbId)
  : initializeFirestore(app, { experimentalForceLongPolling: true });

export const storage = getStorage(app);

let _globalWriteQuotaCircuitUntil = 0;

export function isFirestoreWriteQuotaExhausted(): boolean {
  if (Date.now() < _globalWriteQuotaCircuitUntil) return true;
  if (typeof window !== "undefined") {
    try {
      const savedUntil = Number(sessionStorage.getItem("voxa_fs_write_quota_until") || 0);
      if (savedUntil > Date.now()) {
        _globalWriteQuotaCircuitUntil = savedUntil;
        return true;
      }
    } catch {}
  }
  return false;
}

export function markFirestoreWriteQuotaExhausted(): void {
  const until = Date.now() + 15 * 60 * 1000; // Pause client writes for 15 minutes
  _globalWriteQuotaCircuitUntil = until;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem("voxa_fs_write_quota_until", String(until));
    } catch {}
  }
}

function isQuotaExceededError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err);
  return err.code === "resource-exhausted" || msg.includes("Quota") || msg.includes("quota") || msg.includes("resource-exhausted");
}

const setDocSafe: typeof setDoc = (async (reference: any, data: any, options?: any) => {
  if (isFirestoreWriteQuotaExhausted()) return;
  try {
    return options !== undefined ? await setDoc(reference, data, options) : await setDoc(reference, data);
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreWriteQuotaExhausted();
      return;
    }
    throw err;
  }
}) as typeof setDoc;

const updateDocSafe: typeof updateDoc = (async (reference: any, data: any, ...moreFields: any[]) => {
  if (isFirestoreWriteQuotaExhausted()) return;
  try {
    return await (updateDoc as any)(reference, data, ...moreFields);
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreWriteQuotaExhausted();
      return;
    }
    throw err;
  }
}) as typeof updateDoc;

const deleteDocSafe: typeof deleteDoc = (async (reference: any) => {
  if (isFirestoreWriteQuotaExhausted()) return;
  try {
    return await deleteDoc(reference);
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreWriteQuotaExhausted();
      return;
    }
    throw err;
  }
}) as typeof deleteDoc;

function isFirebaseConfigured(): boolean {
  return !!firebaseConfig.apiKey && !!firebaseConfig.projectId;
}

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  sendPasswordResetEmail,
  collection,
  doc,
  setDocSafe as setDoc,
  getDoc,
  getDocs,
  updateDocSafe as updateDoc,
  deleteDocSafe as deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  getMessaging,
  getToken,
  onMessage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  isFirebaseConfigured
};
