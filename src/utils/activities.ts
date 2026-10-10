import { db } from '../lib/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';

export interface ActivityItem {
  id?: string;
  userId: string;
  userName: string;
  userUsername: string;
  userAvatar: string;
  type: 'profile_change' | 'music_submission' | 'social_interaction' | 'vox_created' | 'like' | 'follow' | 'other';
  description: string;
  createdAt: string;
  details?: any;
}

/**
 * Logs a new user activity into the 'activities' Firestore collection.
 * It automatically fetches user profile details to keep the document denormalized and fast.
 */
export async function logActivity(
  userId: string,
  type: ActivityItem['type'],
  description: string,
  details?: any
): Promise<void> {
  if (!userId) return;
  try {
    // Fetch the user's latest name, username, and photoURL
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
    
    const activityData: Omit<ActivityItem, 'id'> = {
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
    console.log(`[ACTIVITY_LOG] Successfully logged ${type} activity for ${userId}`);
  } catch (err) {
    console.warn("[ACTIVITY_LOG_ERROR] Could not log activity:", err);
  }
}
