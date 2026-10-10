import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin pointing to the exact target database
const app = initializeApp({
  projectId: "voxa-site"
});

const db = getFirestore(app, "ai-studio-voxa-88b709d6-62fd-4a0d-b036-525f4b713a4e");

const VOXA_UID = "TkJZkTxYX0PYknDHULfr8DR7Dlw1";
const JRSANTTI_UID = "lvwWKvnHoMPDrOWTgrCZewhgcVw2";

async function run() {
  console.log("=== VOXA DATABASE RECONCILIATION START ===");
  
  try {
    const usersColl = db.collection('users');
    const followsColl = db.collection('follows');
    
    // 1. Fetch all existing users
    console.log("Fetching all users...");
    const usersSnap = await usersColl.get();
    console.log(`Found ${usersSnap.size} total users in DB.`);
    
    // 2. Resolve default follows for uninitialized users
    let followAddedCount = 0;
    for (const doc of usersSnap.docs) {
      const uid = doc.id;
      const data = doc.data();
      
      // Skip official accounts self-following
      if (uid === VOXA_UID || uid === JRSANTTI_UID) {
        continue;
      }
      
      if (data.defaultFollowsInitialized !== true) {
        console.log(`Initializing default follows for user: @${data.username || data.slug || uid} (${data.name})`);
        
        // Follow VOXA
        const voxaFollowId = `${uid}_${VOXA_UID}`;
        const voxaFollowRef = followsColl.doc(voxaFollowId);
        const voxaFollowSnap = await voxaFollowRef.get();
        if (!voxaFollowSnap.exists) {
          await voxaFollowRef.set({
            followerId: uid,
            followingId: VOXA_UID,
            createdAt: new Date().toISOString(),
            silent: true,
            source: 'default_follow'
          });
          followAddedCount++;
        }
        
        // Follow JRSANTTI
        const jrFollowId = `${uid}_${JRSANTTI_UID}`;
        const jrFollowRef = followsColl.doc(jrFollowId);
        const jrFollowSnap = await jrFollowRef.get();
        if (!jrFollowSnap.exists) {
          await jrFollowRef.set({
            followerId: uid,
            followingId: JRSANTTI_UID,
            createdAt: new Date().toISOString(),
            silent: true,
            source: 'default_follow'
          });
          followAddedCount++;
        }
        
        // Mark as initialized
        await usersColl.doc(uid).update({
          defaultFollowsInitialized: true
        });
      }
    }
    console.log(`Default follows initialization complete. Added ${followAddedCount} missing follow relations.`);
    
    // 3. Recount followers and following counts for EVERY user
    console.log("Recalculating and synchronizing follows counts with physical records...");
    const allUsersSnap = await usersColl.get();
    for (const doc of allUsersSnap.docs) {
      const uid = doc.id;
      const data = doc.data();
      
      // Count followers (people following this user)
      const followersQuery = await followsColl.where('followingId', '==', uid).get();
      const followersCount = followersQuery.size;
      
      // Count following (people this user follows)
      const followingQuery = await followsColl.where('followerId', '==', uid).get();
      const followingCount = followingQuery.size;
      
      console.log(`User @${data.username || data.slug || uid}: Followers = ${followersCount}, Following = ${followingCount}`);
      
      // Update the user document
      await usersColl.doc(uid).update({
        followersCount: followersCount,
        followingCount: followingCount
      });
    }
    
    console.log("=== VOXA DATABASE RECONCILIATION SUCCESS ===");
  } catch (err) {
    console.error("Error during reconciliation:", err);
  }
}

run();
