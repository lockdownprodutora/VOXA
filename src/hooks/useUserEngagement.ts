import { useEffect, useRef, useEffectEvent } from 'react';
import { db, doc, setDoc, isFirestoreWriteQuotaExhausted, markFirestoreWriteQuotaExhausted } from '../lib/firebase';

export interface EngagementData {
  timeSpentPerTab: { [tab: string]: number };
  interactionCounts: { [action: string]: number };
  lastActive: string;
  updatedAt: string;
}

/**
 * Tracks user engagement metrics in real-time and persists them to the 'analytics/{uid}' Firestore collection.
 */
export function useUserEngagement(userId: string | undefined, activeTab: string) {
  // Use refs to avoid continuous hook re-registrations or re-running on ticker
  const tabSpentRef = useRef<{ [tab: string]: number }>({});
  const interactionsRef = useRef<{ [action: string]: number }>({});
  const lastActiveTabRef = useRef<string>(activeTab);
  const tabStartTimeRef = useRef<number>(Date.now());
  const pendingSaveRef = useRef<boolean>(false);

  // Initialize refs
  useEffect(() => {
    if (activeTab) {
      lastActiveTabRef.current = activeTab;
      tabStartTimeRef.current = Date.now();
    }
  }, [activeTab]);

  const saveEngagementToDb = useEffectEvent(async () => {
    if (!userId || isFirestoreWriteQuotaExhausted()) return;

    // Accumulate the current tab's time before saving
    const now = Date.now();
    const elapsedSeconds = Math.round((now - tabStartTimeRef.current) / 1000);
    const currentTab = lastActiveTabRef.current;

    if (elapsedSeconds > 0 && currentTab) {
      tabSpentRef.current[currentTab] = (tabSpentRef.current[currentTab] || 0) + elapsedSeconds;
      tabStartTimeRef.current = now; // reset start time for next increment
    }

    try {
      const docRef = doc(db, 'analytics', userId);
      const payload: EngagementData = {
        timeSpentPerTab: tabSpentRef.current,
        interactionCounts: interactionsRef.current,
        lastActive: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(docRef, payload, { merge: true });
      pendingSaveRef.current = false;
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (err?.code === 'resource-exhausted' || msg.includes('Quota') || msg.includes('quota')) {
        markFirestoreWriteQuotaExhausted();
        return;
      }
      console.warn("[ENGAGEMENT_ANALYTICS_ERROR] Could not save engagement metrics:", err);
    }
  });

  // Track tab time accumulation when activeTab changes
  useEffect(() => {
    const prevTab = lastActiveTabRef.current;
    const now = Date.now();
    const elapsedSeconds = Math.round((now - tabStartTimeRef.current) / 1000);

    if (elapsedSeconds > 0 && prevTab) {
      tabSpentRef.current[prevTab] = (tabSpentRef.current[prevTab] || 0) + elapsedSeconds;
      pendingSaveRef.current = true;
    }

    // Switch tab reference
    lastActiveTabRef.current = activeTab;
    tabStartTimeRef.current = now;
  }, [activeTab]);

  // Periodic persistence ticker (every 5 minutes if changes are pending)
  useEffect(() => {
    if (!userId) return;

    const interval = setInterval(() => {
      if (isFirestoreWriteQuotaExhausted()) return;
      // Always count active time of the current tab in the ticker
      const now = Date.now();
      const elapsedSeconds = Math.round((now - tabStartTimeRef.current) / 1000);
      const currentTab = lastActiveTabRef.current;

      if (elapsedSeconds > 0 && currentTab) {
        tabSpentRef.current[currentTab] = (tabSpentRef.current[currentTab] || 0) + elapsedSeconds;
        tabStartTimeRef.current = now;
        pendingSaveRef.current = true;
      }

      if (pendingSaveRef.current) {
        saveEngagementToDb();
      }
    }, 300000);

    return () => {
      clearInterval(interval);
      // Try a final save on unmount if pending
      if (pendingSaveRef.current) {
        saveEngagementToDb();
      }
    };
  }, [userId, saveEngagementToDb]);

  // Track page exit or visibility change to save metrics instantly
  useEffect(() => {
    if (!userId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveEngagementToDb();
      }
    };

    const handleBeforeUnload = () => {
      saveEngagementToDb();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userId, saveEngagementToDb]);

  // Helper method to increment an interaction pattern
  const trackInteraction = (action: string) => {
    interactionsRef.current[action] = (interactionsRef.current[action] || 0) + 1;
    pendingSaveRef.current = true;
  };

  return {
    trackInteraction,
    timeSpent: tabSpentRef.current,
    interactions: interactionsRef.current
  };
}
