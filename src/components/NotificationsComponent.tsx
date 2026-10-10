import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Heart, 
  MessageSquare, 
  User, 
  Repeat, 
  Megaphone, 
  Check, 
  CheckCheck, 
  Trash2, 
  X, 
  Sparkles,
  ShieldAlert,
  Wallet,
  TrendingUp,
  Gift
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { markNotificationAsRead, markAllNotificationsAsRead } from '../utils/storeDb';

interface NotificationItem {
  id: string;
  userId: string;
  recipientUid?: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  type?: 'like' | 'mention' | 'reply' | 'follow' | 'repost' | 'system' | 'financial';
  actionTab?: string;
  transactionId?: string;
}

interface NotificationsComponentProps {
  currentUser: any;
  onClose?: () => void;
  onNotificationClick?: (notification: NotificationItem) => void;
}

export const NotificationsComponent: React.FC<NotificationsComponentProps> = ({ 
  currentUser, 
  onClose,
  onNotificationClick 
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!currentUser?.email && !currentUser?.uid) {
      setLoading(false);
      return;
    }

    try {
      const notifRef = collection(db, 'notifications');
      const mapById = new Map<string, NotificationItem>();

      const processSnapshot = (snapshot: any) => {
        snapshot.forEach((docSnap: any) => {
          const data = docSnap.data();
          const rawTitle = (data.title || '')
            .replace(/Lockdown/gi, 'VOXA')
            .replace(/@?juniorsantti92/gi, '@jrsantti')
            .replace(/@?juniorsantti\b/gi, '@jrsantti');
          const rawMessage = (data.message || '')
            .replace(/Lockdown/gi, 'VOXA')
            .replace(/@?juniorsantti92/gi, '@jrsantti')
            .replace(/@?juniorsantti\b/gi, '@jrsantti');
          mapById.set(docSnap.id, {
            id: docSnap.id,
            userId: data.userId || '',
            recipientUid: data.recipientUid || '',
            title: rawTitle,
            message: rawMessage,
            read: !!data.read,
            createdAt: data.createdAt || new Date().toISOString(),
            type: data.type || detectNotificationType(rawTitle, rawMessage),
            actionTab: data.actionTab,
            transactionId: data.transactionId
          });
        });

        const merged = Array.from(mapById.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setNotifications(merged);
        setLoading(false);
      };

      const unsubs: Array<() => void> = [];

      if (currentUser.uid) {
        const qUid = query(notifRef, where('userId', '==', currentUser.uid));
        unsubs.push(onSnapshot(qUid, processSnapshot, () => setLoading(false)));

        const qRecip = query(notifRef, where('recipientUid', '==', currentUser.uid));
        unsubs.push(onSnapshot(qRecip, processSnapshot, () => setLoading(false)));
      }

      if (currentUser.email && currentUser.email !== currentUser.uid) {
        const qEmail = query(notifRef, where('userId', '==', currentUser.email));
        unsubs.push(onSnapshot(qEmail, processSnapshot, () => setLoading(false)));
      }

      return () => unsubs.forEach((u) => u());
    } catch (err) {
      console.warn("Error setting up notifications subscription:", err);
      setLoading(false);
    }
  }, [currentUser?.uid, currentUser?.email]);

  const detectNotificationType = (title: string, message: string): 'like' | 'mention' | 'reply' | 'follow' | 'repost' | 'system' | 'financial' => {
    const t = (title + ' ' + message).toLowerCase();
    if (
      t.includes('depósito') ||
      t.includes('pix') ||
      t.includes('saque') ||
      t.includes('carteira') ||
      t.includes('reembolso') ||
      t.includes('estorno') ||
      t.includes('venda') ||
      t.includes('compra') ||
      t.includes('bônus') ||
      t.includes('trade') ||
      t.includes('r$')
    ) {
      return 'financial';
    }
    if (t.includes('curtiu') || t.includes('❤️') || t.includes('like')) return 'like';
    if (t.includes('seguidor') || t.includes('começou a seguir') || t.includes('👤')) return 'follow';
    if (t.includes('respondeu') || t.includes('comentário') || t.includes('💬')) return 'reply';
    if (t.includes('repostou') || t.includes('citou') || t.includes('🔁')) return 'repost';
    if (t.includes('sistema') || t.includes('anúncio') || t.includes('aviso') || t.includes('📢')) return 'system';
    return 'mention';
  };

  const getIconForType = (type?: string) => {
    switch (type) {
      case 'financial':
        return <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 shrink-0"><Wallet className="w-4 h-4" /></div>;
      case 'like':
        return <div className="p-2 rounded-xl bg-red-500/10 text-red-500 shrink-0"><Heart className="w-4 h-4 fill-current" /></div>;
      case 'follow':
        return <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0"><User className="w-4 h-4" /></div>;
      case 'reply':
      case 'mention':
        return <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 shrink-0"><MessageSquare className="w-4 h-4" /></div>;
      case 'repost':
        return <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0"><Repeat className="w-4 h-4" /></div>;
      case 'system':
        return <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 shrink-0"><Megaphone className="w-4 h-4" /></div>;
      default:
        return <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 shrink-0"><Bell className="w-4 h-4" /></div>;
    }
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser?.email && !currentUser?.uid) return;
    try {
      const identifier = currentUser.email || currentUser.uid;
      await markAllNotificationsAsRead(identifier);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'notifications', id));
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="w-80 sm:w-96 rounded-3xl bg-[#0c0b16] border border-white/15 shadow-2xl overflow-hidden text-white flex flex-col backdrop-blur-2xl">
      {/* Header */}
      <div className="p-4 border-b border-white/15 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-violet-600/30">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-orbitron font-black text-xs tracking-wider uppercase flex items-center space-x-2">
              <span>Notificações</span>
              {unreadCount > 0 && (
                <span className="bg-[#FF0033] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                  {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </h3>
            <p className="text-[10px] text-gray-400 font-sans">Atualizações em tempo real</p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Action bar */}
      <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between bg-black/20">
        <div className="flex items-center space-x-1.5 bg-white/5 p-1 rounded-xl">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg text-[10px] font-orbitron font-bold transition-all cursor-pointer ${
              filter === 'all' 
                ? 'bg-white text-black shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Todas ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 rounded-lg text-[10px] font-orbitron font-bold transition-all cursor-pointer ${
              filter === 'unread' 
                ? 'bg-white text-black shadow-md' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Não lidas ({unreadCount})
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="flex items-center space-x-1 text-[10px] font-orbitron font-bold text-violet-400 hover:text-violet-300 transition-all cursor-pointer bg-violet-500/10 px-2.5 py-1.5 rounded-xl border border-violet-500/20"
            title="Marcar todas como lidas"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Ler tudo</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-[360px] overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-white/10">
        {loading ? (
          <div className="py-12 text-center">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-[11px] text-gray-400 font-sans">Carregando notificações...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-gray-500">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-white font-orbitron">Tudo limpo por aqui</p>
              <p className="text-[11px] text-gray-400 font-sans mt-0.5">Você não tem notificações {filter === 'unread' ? 'não lidas' : ''}.</p>
            </div>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const timeAgo = formatTimeAgo(n.createdAt);
            return (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.read) handleMarkAsRead(n.id);
                  if (onNotificationClick) onNotificationClick(n);
                }}
                className={`group relative p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex items-start space-x-3 text-left ${
                  n.read 
                    ? 'bg-white/[0.02] border-white/5 hover:border-white/15 text-gray-400' 
                    : 'bg-violet-950/20 border-violet-500/30 hover:border-violet-500/50 text-white shadow-lg shadow-violet-950/20'
                }`}
              >
                {/* Icon based on type */}
                {getIconForType(n.type)}

                {/* Content */}
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`text-xs truncate font-orbitron font-bold ${n.read ? 'text-gray-300' : 'text-white'}`}>
                      {n.title || 'Atualização'}
                    </h4>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-[#FF0033] shrink-0"></span>
                    )}
                  </div>
                  <p className="text-[11px] font-sans mt-1 leading-relaxed text-gray-300 line-clamp-2">
                    {n.message}
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[9px] text-gray-500 font-sans">
                    <span>{timeAgo}</span>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-2">
                      {!n.read && (
                        <button
                          onClick={(e) => handleMarkAsRead(n.id, e)}
                          className="hover:text-white flex items-center space-x-0.5"
                          title="Marcar como lida"
                        >
                          <Check className="w-3 h-3 text-violet-400" />
                          <span>Lida</span>
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDeleteNotification(n.id, e)}
                        className="hover:text-red-400"
                        title="Excluir"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-white/10 text-center bg-black/40">
        <span className="text-[9px] font-orbitron text-gray-500 uppercase tracking-widest">
          VOXA Live Notifications • Sistema Seguro
        </span>
      </div>
    </div>
  );
};

// Helper function to format time ago in Portuguese
function formatTimeAgo(isoString: string): string {
  if (!isoString) return 'Recentemente';
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Agora mesmo';
    if (diffMins < 60) return `Há ${diffMins} min`;
    if (diffHours < 24) return `Há ${diffHours} h`;
    if (diffDays < 7) return `Há ${diffDays} d`;
    return new Date(isoString).toLocaleDateString('pt-BR');
  } catch (e) {
    return 'Recentemente';
  }
}
