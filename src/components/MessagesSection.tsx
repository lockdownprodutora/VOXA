import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, onSnapshot, orderBy, limit, Timestamp 
} from 'firebase/firestore';
import { 
  MessageCircle, Send, Search, MoreVertical, Shield, Lock, CreditCard, 
  Check, CheckCircle2, User as UserIcon, MessageSquare, X, ChevronLeft, Trash2
} from 'lucide-react';
import { formatBRL } from '../utils/money';
import { ChatThread, ChatMessage } from '../types';
import { VerifiedBadge } from './common/VerifiedBadge';
import { useResolvedUserProfile } from './VoxModule';

const ThreadListItem: React.FC<{
  thread: ChatThread;
  currentUserUid: string;
  activeThreadId: string | null;
  onSelect: (id: string) => void;
}> = ({ thread, currentUserUid, activeThreadId, onSelect }) => {
  const otherUid = thread.participants.find(p => p !== currentUserUid) || '';
  const fallbackName = thread.participantNames?.[otherUid] || 'Membro';
  const fallbackAvatar = thread.participantAvatars?.[otherUid] || '';
  const fallbackUsername = thread.participantUsernames?.[otherUid] || 'membro';
  const resolved = useResolvedUserProfile(otherUid, fallbackName, fallbackUsername, fallbackAvatar);
  const unread = thread.unreadCount?.[currentUserUid] || 0;

  return (
    <button
      onClick={() => onSelect(thread.id)}
      className={`w-full p-4 flex items-center space-x-3 transition-all hover:bg-white/5 text-left border-b border-white/5 ${activeThreadId === thread.id ? 'bg-white/5' : ''}`}
    >
      <div className="relative">
        <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 bg-zinc-900 flex items-center justify-center">
          {resolved.photoURL && typeof resolved.photoURL === 'string' && resolved.photoURL.trim() !== '' ? (
            <img src={resolved.photoURL.trim()} className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-5 h-5 text-gray-500" />
          )}
        </div>
        {unread > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF0033] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#0c0b16] animate-pulse">
            {unread}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-1">
          <span className="text-sm font-orbitron font-bold text-white truncate flex items-center gap-1">
            <span className="truncate">{resolved.name}</span>
            {resolved.verified && <VerifiedBadge size="xs" />}
          </span>
          <span className="text-[9px] text-gray-500 font-mono shrink-0">
            {thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
        <span className="text-[10px] text-gray-500 font-mono block truncate">@{resolved.username}</span>
        <p className="text-xs text-gray-500 truncate mt-0.5">{thread.lastMessage || 'Inicie uma conversa'}</p>
      </div>
    </button>
  );
};

const ActiveThreadHeaderProfile: React.FC<{ thread?: ChatThread; currentUserUid: string }> = ({ thread, currentUserUid }) => {
  const otherUid = thread?.participants.find(p => p !== currentUserUid) || '';
  const fallbackName = thread?.participantNames?.[otherUid] || 'Membro';
  const fallbackAvatar = thread?.participantAvatars?.[otherUid] || '';
  const fallbackUsername = thread?.participantUsernames?.[otherUid] || 'membro';
  const resolved = useResolvedUserProfile(otherUid, fallbackName, fallbackUsername, fallbackAvatar);

  return (
    <div
      onClick={() => {
        if (resolved.username) {
          window.history.pushState(null, '', `/${resolved.username}`);
          window.dispatchEvent(new Event('popstate'));
        }
      }}
      className="flex items-center space-x-3 cursor-pointer group"
    >
      <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 bg-zinc-900 flex items-center justify-center">
        {resolved.photoURL && typeof resolved.photoURL === 'string' && resolved.photoURL.trim() !== '' ? (
          <img src={resolved.photoURL.trim()} className="w-full h-full object-cover" />
        ) : (
          <UserIcon className="w-5 h-5 text-gray-500" />
        )}
      </div>
      <div>
        <h3 className="text-sm font-orbitron font-black text-white uppercase flex items-center gap-1 group-hover:underline">
          <span>{resolved.name}</span>
          {resolved.verified && <VerifiedBadge size="xs" />}
        </h3>
        <span className="text-[10px] text-gray-500 font-mono">@{resolved.username}</span>
      </div>
    </div>
  );
};

interface MessagesSectionProps {
  currentUser: any;
  triggerToast: (msg: string) => void;
}

export function MessagesSection({ currentUser, triggerToast }: MessagesSectionProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'ACTIVE' | 'REQUEST'>('ACTIVE');
  
  // Privacy Settings state (local copy for the UI)
  const [privacyMode, setPrivacyMode] = useState<'ANYONE' | 'FOLLOWED' | 'FOLLOWERS' | 'NONE' | 'PAID'>(currentUser.messageSettings?.privacy || 'ANYONE');
  const [messagePrice, setMessagePrice] = useState(currentUser.messageSettings?.price || 0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 1. Fetch Threads (Real-time)
  useEffect(() => {
    if (!currentUser?.uid) return;
    setLoadingThreads(true);
    const threadsColl = collection(db, "chat_threads");
    const q = query(threadsColl, where("participants", "array-contains", currentUser.uid));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: ChatThread[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as ChatThread);
      });
      // Sort by updatedAt
      list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      setThreads(list);
      setLoadingThreads(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 2. Fetch Messages for Active Thread (Real-time)
  useEffect(() => {
    if (!activeThreadId) return;
    setLoadingMessages(true);
    const msgsColl = collection(db, "chat_messages");
    const q = query(msgsColl, where("threadId", "==", activeThreadId), orderBy("createdAt", "asc"));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: ChatMessage[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as ChatMessage);
      });
      setMessages(list);
      setLoadingMessages(false);
      
      // Mark as read
      markThreadAsRead(activeThreadId);
    });

    return () => unsubscribe();
  }, [activeThreadId]);

  const markThreadAsRead = async (threadId: string) => {
    try {
      const threadRef = doc(db, "chat_threads", threadId);
      const update: any = {};
      update[`unreadCount.${currentUser.uid}`] = 0;
      await updateDoc(threadRef, update);
    } catch (e) {}
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageText.trim() || !activeThreadId) return;

    const thread = threads.find(t => t.id === activeThreadId);
    if (!thread) return;

    const recipientUid = thread.participants.find(p => p !== currentUser.uid);
    if (!recipientUid) return;

    const msgText = messageText.trim();
    setMessageText('');

    try {
      const msgsColl = collection(db, "chat_messages");
      const msgRef = doc(msgsColl);
      const now = new Date().toISOString();
      
      const newMsg: ChatMessage = {
        id: msgRef.id,
        threadId: activeThreadId,
        senderUid: currentUser.uid,
        text: msgText,
        createdAt: now,
        read: false,
        type: 'text'
      };

      await setDoc(msgRef, newMsg);

      // Update thread
      const threadRef = doc(db, "chat_threads", activeThreadId);
      const update: any = {
        lastMessage: msgText,
        lastMessageAt: now,
        updatedAt: now,
      };
      update[`unreadCount.${recipientUid}`] = (thread.unreadCount?.[recipientUid] || 0) + 1;
      await updateDoc(threadRef, update);

    } catch (err) {
      console.error("Error sending message:", err);
      triggerToast("Erro ao enviar mensagem.");
    }
  };

  const handleUpdateSettings = async () => {
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        messageSettings: {
          privacy: privacyMode,
          price: messagePrice
        }
      });
      triggerToast("Configurações de mensagens atualizadas!");
      setIsSettingsOpen(false);
    } catch (e) {
      triggerToast("Erro ao salvar configurações.");
    }
  };

  const activeThreads = threads.filter(t => t.status === inboxFilter);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] lg:h-[calc(100vh-40px)] bg-[#0c0b16] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
      <div className="flex h-full">
        {/* Sidebar: Thread List */}
        <div className={`w-full lg:w-80 border-r border-white/10 flex flex-col ${activeThreadId ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-6 border-b border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-orbitron font-black text-xl uppercase text-white">MENSAGENS</h2>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <Shield className="w-5 h-5" />
              </button>
            </div>
            
            {/* Filter Tabs */}
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setInboxFilter('ACTIVE')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-orbitron font-black uppercase transition-all ${inboxFilter === 'ACTIVE' ? 'bg-[#FF0033] text-white' : 'text-gray-500 hover:text-white'}`}
              >
                Conversas
              </button>
              <button 
                onClick={() => setInboxFilter('REQUEST')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-orbitron font-black uppercase transition-all ${inboxFilter === 'REQUEST' ? 'bg-[#FF0033] text-white' : 'text-gray-500 hover:text-white'}`}
              >
                Solicitações
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loadingThreads ? (
              <div className="p-10 text-center">
                <div className="w-6 h-6 border-2 border-[#FF0033] border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : activeThreads.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <MessageSquare className="w-8 h-8 text-gray-600 mx-auto" />
                <p className="text-xs font-orbitron text-gray-500 uppercase tracking-widest">Nenhuma conversa</p>
              </div>
            ) : (
              activeThreads.map(thread => (
                <ThreadListItem
                  key={thread.id}
                  thread={thread}
                  currentUserUid={currentUser.uid}
                  activeThreadId={activeThreadId}
                  onSelect={setActiveThreadId}
                />
              ))
            )}
          </div>
        </div>

        {/* Main: Message History */}
        <div className={`flex-1 flex flex-col bg-[#080710]/40 ${!activeThreadId ? 'hidden lg:flex' : 'flex'}`}>
          {activeThreadId ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-white/10 bg-[#0c0b16]/95 backdrop-blur-md flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => setActiveThreadId(null)}
                    className="lg:hidden p-2 -ml-2 text-gray-400 hover:text-white"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <ActiveThreadHeaderProfile
                    thread={threads.find(t => t.id === activeThreadId)}
                    currentUserUid={currentUser.uid}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-500 hover:text-white transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin flex flex-col-reverse">
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isMe = msg.senderUid === currentUser.uid;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm font-sans relative ${isMe ? 'bg-[#FF0033] text-white rounded-tr-none' : 'bg-[#12111d] text-gray-200 border border-white/5 rounded-tl-none'}`}>
                          {msg.text}
                          <div className={`text-[8px] font-mono mt-1 ${isMe ? 'text-white/60 text-right' : 'text-gray-500'}`}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {loadingMessages && <div className="text-center py-4"><div className="w-4 h-4 border-2 border-[#FF0033] border-t-transparent rounded-full animate-spin mx-auto"></div></div>}
                </div>
              </div>

              {/* Input Area */}
              <div className="p-4 bg-[#0c0b16]/95 border-t border-white/10">
                <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                  <input 
                    type="text" 
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Escreva sua mensagem..."
                    className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:outline-none focus:border-[#FF0033]/50 transition-all font-sans"
                  />
                  <button 
                    type="submit"
                    disabled={!messageText.trim()}
                    className="w-12 h-12 bg-[#FF0033] hover:bg-red-700 disabled:opacity-50 text-white rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-red-600/20"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-6">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-gray-700">
                <MessageCircle className="w-10 h-10" />
              </div>
              <div className="max-w-xs space-y-2">
                <h3 className="font-orbitron font-black text-lg text-white uppercase">Selecione uma conversa</h3>
                <p className="text-xs text-gray-500 font-sans leading-relaxed">Conecte-se com criadores, artistas e amigos em tempo real com segurança total.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4 animate-fadeIn">
          <div className="max-w-md w-full bg-[#0c0b16] border border-white/10 rounded-[32px] p-8 space-y-6 text-left relative text-white shadow-2xl">
            <button 
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[#FF0033] font-orbitron font-black text-[9px] tracking-widest block uppercase">Privacidade de Inbox</span>
              <h3 className="text-xl font-orbitron font-black uppercase tracking-wide">CONFIGURAÇÕES DE MENSAGENS</h3>
            </div>

            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-[10px] font-orbitron font-black text-gray-500 uppercase block">Quem pode me enviar mensagens?</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'ANYONE', label: 'Qualquer Pessoa' },
                    { id: 'FOLLOWED', label: 'Pessoas que sigo' },
                    { id: 'FOLLOWERS', label: 'Seguidores' },
                    { id: 'PAID', label: 'Pago para não-conexões' },
                    { id: 'NONE', label: 'Ninguém (Inbox fechado)' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setPrivacyMode(opt.id as any)}
                      className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${privacyMode === opt.id ? 'bg-[#FF0033]/10 border-[#FF0033] text-white' : 'bg-black/40 border-white/5 text-gray-500 hover:border-white/20'}`}
                    >
                      <span className="text-xs font-orbitron font-bold uppercase">{opt.label}</span>
                      {privacyMode === opt.id && <CheckCircle2 className="w-4 h-4 text-[#FF0033]" />}
                    </button>
                  ))}
                </div>
              </div>

              {privacyMode === 'PAID' && (
                <div className="space-y-2 animate-fadeIn">
                  <label className="text-[10px] font-orbitron font-black text-gray-500 uppercase block">Valor por mensagem (R$)</label>
                  <div className="flex bg-black/40 border border-white/10 rounded-2xl overflow-hidden font-mono">
                    <div className="bg-white/5 px-4 flex items-center text-gray-500 border-r border-white/10">R$</div>
                    <input 
                      type="number" 
                      value={messagePrice}
                      onChange={(e) => setMessagePrice(Number(e.target.value))}
                      className="bg-transparent text-white px-4 py-3 flex-1 outline-none text-sm"
                      placeholder="0,00"
                    />
                  </div>
                  <p className="text-[9px] text-gray-600 font-sans italic">A comissão da plataforma (20%) será descontada do valor recebido.</p>
                </div>
              )}
            </div>

            <button
              onClick={handleUpdateSettings}
              className="w-full bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs tracking-widest uppercase py-4 rounded-2xl transition-all shadow-lg shadow-red-600/20"
            >
              SALVAR CONFIGURAÇÕES
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
