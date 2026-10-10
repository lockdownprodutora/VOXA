import { db } from '../lib/firebase';
import { collection, addDoc, doc, getDoc, query, limit, getDocs, orderBy } from 'firebase/firestore';

export interface UserActivity {
  id?: string;
  userId: string;
  userName: string;
  userUsername: string;
  userAvatar: string;
  type: 'like' | 'post' | 'purchase' | 'follow' | 'comment' | 'onboarding_complete' | 'other' | 'vox_created' | 'profile_change';
  description: string;
  createdAt: string;
  details?: any;
}

/**
 * Utility for logging key user actions.
 */
export const UserActivityLogger = {
  log: async (
    userId: string,
    type: UserActivity['type'],
    description: string,
    details?: any
  ): Promise<void> => {
    if (!userId) return;
    try {
      // Fetch latest user details for denormalized storage
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      let userName = 'Membro VOXA';
      let userUsername = 'membro';
      let userAvatar = '';
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        userName = data.name || data.artisticName || userName;
        userUsername = data.username || data.slug || userUsername;
        userAvatar = data.photoURL || data.avatarUrl || data.photoUrl || '';
      }
      
      const activityData: Omit<UserActivity, 'id'> = {
        userId,
        userName,
        userUsername,
        userAvatar,
        type,
        description,
        createdAt: new Date().toISOString(),
        details: details || null
      };
      
      await addDoc(collection(db, 'activities'), activityData);
      console.log(`[USER_ACTIVITY_LOGGER] Successfully logged ${type} activity for user ${userId}`);
    } catch (err) {
      console.warn("[USER_ACTIVITY_LOGGER_ERROR] Could not log user activity:", err);
    }
  },

  /**
   * Fetches the activities for the 'Recently Active' feed
   */
  fetchRecent: async (limitCount = 10): Promise<UserActivity[]> => {
    try {
      const q = query(
        collection(db, 'activities'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      const list: UserActivity[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as UserActivity);
      });
      return list;
    } catch (err) {
      console.warn("[USER_ACTIVITY_LOGGER] Failed to fetch recent activities, attempting local fallback:", err);
      try {
        const fallback = localStorage.getItem('voxa_local_activities');
        if (fallback) {
          return JSON.parse(fallback).slice(0, limitCount);
        }
      } catch (e) {}
      return [];
    }
  }
};
