import { useState, useEffect } from 'react';
import { messaging, getToken, onMessage, db, doc, updateDoc } from '../lib/firebase';
import { auth } from '../lib/firebase';

const VAPID_KEY = 'YOUR_VAPID_KEY'; // Em produção, isto deve vir de configuração segura.

export function usePushNotifications() {
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermissionAndGetToken = async (userId: string) => {
    try {
      if (!('Notification' in window) || !messaging || VAPID_KEY === 'YOUR_VAPID_KEY') {
        return;
      }
      if (Notification.permission === 'denied') {
        return;
      }
      const perm = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted' && messaging) {
        const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (currentToken) {
          setToken(currentToken);
          await saveTokenToFirestore(userId, currentToken);
        }
      }
    } catch (error) {
      console.warn('Push notification indisponível:', error);
    }
  };

  const saveTokenToFirestore = async (userId: string, token: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        pushToken: token,
      });
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  };

  return { token, permission, requestPermissionAndGetToken };
}
