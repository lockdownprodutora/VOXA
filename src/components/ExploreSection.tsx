import React, { useState, useMemo } from 'react';
import { 
  Search, Compass, Users, Sparkles, ShoppingBag, Ticket, Heart, 
  Star, FileText, Headphones, Briefcase, User as UserIcon,
  Play, Pause, Calendar, MapPin, Share2, ImageIcon, BarChart3
} from 'lucide-react';
import { formatBRL } from '../utils/money';
import { DetailedArtist, MusicStream, Community, Product, Show, Fundraiser, Poll } from '../types';
import { PollCard } from './PollCard';
import { VerifiedBadge, isVerifiedUser } from './common/VerifiedBadge';

interface ExploreSectionProps {
  currentUser: any;
  posts: any[];
  voxes: any[];
  products: Product[];
  shows: Show[];
  artists: DetailedArtist[];
  streams: MusicStream[];
  subscriptionPlans: any[];
  fundraisers: Fundraiser[];
  newsArticles: any[];
  userServices: any[];
  centralUsers: any[];
  followingIds: string[];
  polls?: Poll[];
  onVotePoll?: () => void;
  triggerToast?: (msg: string) => void;
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
  onVisitProfile: (username: string) => void;
  onFollow: (uid: string) => void;
  onPlayMusic: (stream: MusicStream) => void;
  currentStream: MusicStream | null;
  isPlaying: boolean;
  onShareToFeed: (type: string, id: string) => void;
  onBuyTicket: (show: Show) => void;
  onBuyProduct: (product: Product) => void;
  onSubscribe: (plan: any) => void;
}

export function ExploreSection({
  currentUser, posts, voxes, products, shows, artists, streams, 
  subscriptionPlans, fundraisers, newsArticles, userServices, 
  centralUsers, followingIds, polls = [], onVotePoll, triggerToast, activeFilter, setActiveFilter,
  onVisitProfile, onFollow, onPlayMusic, currentStream, isPlaying,
  onShareToFeed, onBuyTicket, onBuyProduct, onSubscribe
}: ExploreSectionProps) {
  const [localQuery, setLocalQuery] = useState('');
  
  const filters = [
    { id: 'foryou', label: 'Para Você', icon: Sparkles },
    { id: 'people', label: 'Pessoas', icon: Users },
    { id: 'vox', label: 'VOX', icon: Sparkles },
    { id: 'polls', label: 'Enquetes', icon: BarChart3 },
    { id: 'media', label: 'Mídia', icon: ImageIcon },
    { id: 'store', label: 'Store', icon: ShoppingBag },
    { id: 'tickets', label: 'Tickets', icon: Ticket },
    { id: 'vaquinhas', label: 'Vaquinhas', icon: Heart },
    { id: 'passagens', label: 'Passagens', icon: Compass },
    { id: 'subscriptions', label: 'Assinaturas', icon: Star },
    { id: 'news', label: 'Notícias', icon: FileText },
    { id: 'music', label: 'Música', icon: Headphones },
    { id: 'services', label: 'Serviços', icon: Briefcase }
  ];

  const getCanonicalUsername = (u: any) => {
    const raw = u?.username || u?.slug || 'user';
    if (u?.uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || u?.id === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || raw === 'juniorsantti' || raw === 'juniorsantti92') {
      return 'jrsantti';
    }
    if (u?.uid === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1' || u?.id === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1') {
      return 'voxa';
    }
    return raw;
  };

  const filteredCentralUsers = useMemo(() => {
    const q = localQuery.trim().toLowerCase().replace(/^@/, '');
    if (!q) return centralUsers;
    return centralUsers.filter(u => {
      const uname = getCanonicalUsername(u).toLowerCase();
      const name = (u.name || '').toLowerCase();
      return uname.includes(q) || name.includes(q);
    });
  }, [centralUsers, localQuery]);

  const mixedContent = useMemo(() => {
    const items: any[] = [];
    
    // Mix everything
    filteredCentralUsers.slice(0, 10).forEach(u => items.push({ type: 'user', data: u, sort: 100 }));
    voxes.slice(0, 12).forEach(v => items.push({ type: 'vox', data: v, sort: 90 }));
    products.slice(0, 10).forEach(p => items.push({ type: 'product', data: p, sort: 80 }));
    shows.slice(0, 5).forEach(s => items.push({ type: 'show', data: s, sort: 70 }));
    fundraisers.slice(0, 5).forEach(f => items.push({ type: 'fundraiser', data: f, sort: 60 }));
    subscriptionPlans.slice(0, 5).forEach(p => items.push({ type: 'plan', data: p, sort: 50 }));
    newsArticles.slice(0, 5).forEach(n => items.push({ type: 'news', data: n, sort: 40 }));
    streams.slice(0, 10).forEach(s => items.push({ type: 'music', data: s, sort: 30 }));
    
    return items;
  }, [filteredCentralUsers, voxes, products, shows, fundraisers, subscriptionPlans, newsArticles, streams]);

  const renderContent = () => {
    switch (activeFilter) {
      case 'people':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredCentralUsers.map(u => {
              const canonUser = getCanonicalUsername(u);
              return (
                <div key={u.uid || u.id} className="bg-[#12111d] border border-white/10 p-5 rounded-[24px] text-center flex flex-col items-center justify-between group">
                  <div 
                    onClick={() => onVisitProfile(canonUser)}
                    className="cursor-pointer space-y-3 flex flex-col items-center"
                  >
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/5 bg-zinc-900 flex items-center justify-center">
                      {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <UserIcon className="w-8 h-8 text-gray-600" />}
                    </div>
                    <div>
                      <h3 className="font-orbitron font-black text-sm text-white uppercase truncate max-w-[170px] flex items-center justify-center gap-1 group-hover:underline">
                        <span className="truncate">{u.name}</span>
                        {isVerifiedUser(u) && <VerifiedBadge user={u} size="xs" accountType={u.accountType} />}
                      </h3>
                      <span className="text-[10px] text-gray-500 font-mono">@{canonUser}</span>
                    </div>
                    <span className="bg-white/5 px-2.5 py-1 rounded-full text-[9px] font-orbitron font-bold text-gray-400 uppercase tracking-widest">{u.categoryName || 'Membro'}</span>
                  </div>
                  <button 
                    onClick={() => onFollow(u.uid || u.id)}
                    className={`mt-4 w-full py-2 rounded-xl text-[10px] font-orbitron font-black transition-all cursor-pointer ${followingIds.includes(u.uid || u.id) ? 'bg-white/5 text-white border border-white/10' : 'bg-[#FF0033] text-white'}`}
                  >
                    {followingIds.includes(u.uid || u.id) ? 'SEGUINDO' : 'SEGUIR'}
                  </button>
                </div>
              );
            })}
          </div>
        );

      case 'vox':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {voxes.map((v, idx) => {
              const author = centralUsers.find(u => (u.uid || u.id) === (v.authorId || v.userId));
              const dispName = author?.name || v.authorName;
              const rawUser = author?.username || author?.slug || v.authorUsername || 'user';
              const dispUser = ((v.authorId || v.userId) === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || rawUser === 'juniorsantti' || rawUser === 'juniorsantti92') ? 'jrsantti' : rawUser;
              const dispAvatar = author?.photoURL || author?.avatarUrl || v.authorAvatar;
              const dispVerified = author ? isVerifiedUser(author) : true;
              return (
                <div key={v.id || `vox_exp_${idx}`} className="bg-[#12111d] border border-white/10 p-5 rounded-[28px] space-y-4">
                  <div 
                    onClick={() => dispUser && onVisitProfile(dispUser)}
                    className="flex items-center space-x-2.5 cursor-pointer group"
                  >
                    {dispAvatar ? (
                      <img src={dispAvatar} className="w-9 h-9 rounded-full border border-white/10 object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full border border-white/10 bg-zinc-800 flex items-center justify-center"><UserIcon className="w-4 h-4 text-gray-500" /></div>
                    )}
                    <div>
                      <span className="text-white font-orbitron font-bold text-xs flex items-center gap-1 truncate group-hover:underline">
                        <span className="truncate">{dispName}</span>
                        {dispVerified && <VerifiedBadge user={author || { isVerified: true }} size="xs" />}
                      </span>
                      <span className="text-gray-500 text-[10px] font-mono block">@{dispUser}</span>
                    </div>
                  </div>
                  <p className="text-gray-200 text-sm font-sans leading-relaxed">{v.text}</p>
                  <div className="flex items-center space-x-4 text-[10px] text-gray-500 font-mono">
                    <span>❤️ {v.likeCount || 0}</span>
                    <span>💬 {v.replyCount || 0}</span>
                    <span>🔁 {v.repostCount || 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        );

      case 'polls':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {polls.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-[#12111d] border border-white/10 rounded-[24px]">
                <p className="font-orbitron font-bold text-xs text-gray-500 uppercase tracking-widest">Nenhuma enquete ativa no momento.</p>
              </div>
            ) : (
              polls.map(poll => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  currentUser={currentUser}
                  onVoteSuccess={onVotePoll}
                  triggerToast={triggerToast}
                  onVisitProfile={onVisitProfile}
                />
              ))
            )}
          </div>
        );

      case 'tickets':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shows.map(show => (
              <div key={show.id} className="bg-[#12111d] border border-white/10 p-6 rounded-[32px] space-y-4 hover:border-white/30 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-orbitron font-black bg-white/5 px-2 py-0.5 rounded text-white">{show.date}</span>
                  <span className="text-[9px] font-orbitron font-black text-emerald-400">DISPONÍVEL</span>
                </div>
                <div>
                  <h3 className="text-xl font-orbitron font-black text-white">{show.city}</h3>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 font-sans"><MapPin className="w-3.5 h-3.5" /> {show.venue}</p>
                </div>
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="font-orbitron font-black text-white">{formatBRL(show.price)}</span>
                  <button onClick={() => onBuyTicket(show)} className="bg-white text-black font-orbitron font-black text-[10px] px-4 py-2.5 rounded-xl uppercase">Comprar</button>
                </div>
              </div>
            ))}
          </div>
        );

      case 'store':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map(p => (
              <div key={p.id} className="bg-[#12111d] border border-white/10 rounded-[28px] overflow-hidden group hover:border-white/30 transition-all">
                <div className="aspect-square relative overflow-hidden bg-zinc-900">
                  {p.image ? <img src={p.image} className="w-full h-full object-cover transition-transform group-hover:scale-110" /> : <ShoppingBag className="w-10 h-10 text-gray-800 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-white font-orbitron font-black text-[9px] tracking-widest">{p.category}</div>
                </div>
                <div className="p-5 space-y-3">
                  <h3 className="text-white font-orbitron font-black text-sm truncate uppercase">{p.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-mono font-bold text-sm">{formatBRL(p.price)}</span>
                    <button onClick={() => onBuyProduct(p)} className="bg-white text-black font-orbitron font-black text-[10px] px-4 py-2 rounded-xl transition-all hover:bg-neutral-200">COMPRAR</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'subscriptions':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subscriptionPlans.map(plan => (
              <div key={plan.id} className="bg-[#12111d] border border-white/10 p-6 rounded-[32px] space-y-4 hover:border-violet-500/30 transition-all relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center text-violet-400">
                    <Star className="w-6 h-6" />
                  </div>
                  <span className="text-[9px] font-orbitron font-black bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full uppercase">ATIVO</span>
                </div>
                <div>
                  <h3 className="text-xl font-orbitron font-black text-white uppercase">{plan.name}</h3>
                  <p className="text-xs text-gray-500 mt-2 font-sans line-clamp-2">{plan.description}</p>
                </div>
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="leading-none">
                    <span className="text-xl font-mono font-black text-white">{formatBRL(plan.price)}</span>
                    <span className="text-[10px] text-gray-500 ml-1">/ {plan.billingPeriod || 'mês'}</span>
                  </div>
                  <button onClick={() => onSubscribe(plan)} className="bg-violet-600 hover:bg-violet-700 text-white font-orbitron font-black text-[10px] px-5 py-3 rounded-2xl uppercase tracking-widest transition-all">ASSINAR</button>
                </div>
              </div>
            ))}
          </div>
        );

      case 'music':
        return (
          <div className="space-y-4">
            {streams.map(track => (
              <div key={track.id} className="bg-[#12111d] border border-white/10 p-4 rounded-2xl flex items-center justify-between group hover:border-white/20 transition-all">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl overflow-hidden relative group/play flex items-center justify-center bg-zinc-900 border border-white/5">
                    <img src={track.coverUrl} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => onPlayMusic(track)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover/play:opacity-100 transition-opacity flex items-center justify-center text-white"
                    >
                      {currentStream?.id === track.id && isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                    </button>
                  </div>
                  <div>
                    <h4 className="text-sm font-orbitron font-bold text-white uppercase">{track.title}</h4>
                    <span className="text-[10px] text-gray-500 block">MC Kronos • Hits de Verão</span>
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <span className="text-[10px] text-gray-500 font-mono hidden md:block">03:45</span>
                  <button onClick={() => onShareToFeed('music', track.id)} className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-all"><Share2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        );

      case 'news':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {newsArticles.map(art => (
              <div key={art.id} className="bg-[#12111d] border border-white/10 p-6 rounded-[32px] space-y-4 hover:border-white/20 transition-all flex flex-col justify-between text-left">
                <div className="space-y-3">
                  <span className="text-[9px] font-orbitron font-black text-[#FF0033] bg-[#FF0033]/10 px-2.5 py-1 rounded-full uppercase tracking-widest">{art.category || 'Geral'}</span>
                  <h3 className="text-xl font-orbitron font-black text-white leading-tight uppercase">{art.title}</h3>
                  <p className="text-sm text-gray-400 font-sans line-clamp-3 leading-relaxed">{art.content}</p>
                </div>
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-zinc-800 border border-white/10" />
                    <span className="text-[10px] text-gray-500 font-mono">Por {art.authorName || 'VOXA News'}</span>
                  </div>
                  <span className="text-[10px] text-gray-600 font-mono uppercase">HÁ 2 HORAS</span>
                </div>
              </div>
            ))}
          </div>
        );

      case 'services':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {userServices.map(svc => (
              <div key={svc.id} className="bg-[#12111d] border border-white/10 rounded-[28px] overflow-hidden group hover:border-white/30 transition-all">
                <div className="h-40 bg-zinc-900 relative overflow-hidden flex items-center justify-center">
                  {svc.image ? <img src={svc.image} className="w-full h-full object-cover" /> : <Briefcase className="w-10 h-10 text-gray-800" />}
                </div>
                <div className="p-5 space-y-2">
                  <h3 className="text-white font-orbitron font-black text-sm uppercase truncate">{svc.name}</h3>
                  <p className="text-xs text-gray-500 font-sans line-clamp-2">{svc.description}</p>
                  <div className="pt-4 flex items-center justify-between border-t border-white/5 mt-2">
                    <span className="text-emerald-400 font-mono font-bold text-xs">SOB CONSULTA</span>
                    <button className="bg-white/5 hover:bg-white/10 text-white text-[9px] font-orbitron font-black px-3 py-1.5 rounded-lg uppercase transition-all">Saber Mais</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'foryou':
      default:
        return (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
            {mixedContent.map((item, idx) => {
              if (item.type === 'user') {
                const u = item.data;
                const canonUser = getCanonicalUsername(u);
                return (
                  <div key={`mixed_user_${u.uid || u.id || idx}`} className="break-inside-avoid bg-[#12111d] border border-white/10 p-5 rounded-[28px] flex items-center justify-between gap-3">
                    <div 
                      onClick={() => onVisitProfile(canonUser)}
                      className="flex items-center space-x-3 min-w-0 cursor-pointer group"
                    >
                      <div className="w-11 h-11 rounded-full overflow-hidden border border-white/10 bg-zinc-900 shrink-0 flex items-center justify-center">
                        {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-gray-500" />}
                      </div>
                      <div className="min-w-0">
                        <span className="text-white font-orbitron font-bold text-xs flex items-center gap-1 truncate group-hover:underline uppercase">
                          <span className="truncate">{u.name}</span>
                          {isVerifiedUser(u) && <VerifiedBadge user={u} size="xs" accountType={u.accountType} />}
                        </span>
                        <span className="text-gray-500 text-[10px] font-mono block truncate">@{canonUser}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => onFollow(u.uid || u.id)}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-orbitron font-black transition-all shrink-0 cursor-pointer ${followingIds.includes(u.uid || u.id) ? 'bg-white/5 text-white border border-white/10' : 'bg-[#FF0033] text-white'}`}
                    >
                      {followingIds.includes(u.uid || u.id) ? 'SEGUINDO' : 'SEGUIR'}
                    </button>
                  </div>
                );
              }
              if (item.type === 'vox') {
                const v = item.data;
                const author = centralUsers.find(u => (u.uid || u.id) === (v.authorId || v.userId));
                const dispName = author?.name || v.authorName;
                const rawUser = author?.username || author?.slug || v.authorUsername || 'user';
                const dispUser = ((v.authorId || v.userId) === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || rawUser === 'juniorsantti' || rawUser === 'juniorsantti92') ? 'jrsantti' : rawUser;
                const dispAvatar = author?.photoURL || author?.avatarUrl || v.authorAvatar;
                const dispVerified = author ? isVerifiedUser(author) : true;
                return (
                  <div key={`mixed_${idx}`} className="break-inside-avoid bg-[#12111d] border border-white/5 p-5 rounded-[28px] space-y-4">
                    <div 
                      onClick={() => dispUser && onVisitProfile(dispUser)}
                      className="flex items-center space-x-2.5 cursor-pointer group"
                    >
                      {dispAvatar ? (
                        <img src={dispAvatar} className="w-8 h-8 rounded-full border border-white/10 object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full border border-white/10 bg-zinc-800 flex items-center justify-center"><UserIcon className="w-4 h-4 text-gray-500" /></div>
                      )}
                      <div>
                        <span className="text-white font-orbitron font-bold text-[10px] flex items-center gap-1 truncate group-hover:underline">
                          <span className="truncate">{dispName}</span>
                          {dispVerified && <VerifiedBadge user={author || { isVerified: true }} size="xs" />}
                        </span>
                        <span className="text-gray-500 text-[9px] font-mono block">@{dispUser}</span>
                      </div>
                    </div>
                    <p className="text-gray-200 text-sm font-sans leading-relaxed">{v.text}</p>
                    <div className="flex items-center space-x-4 text-[10px] text-gray-500 font-mono">
                      <span>❤️ {v.likeCount || 0}</span>
                      <span>💬 {v.replyCount || 0}</span>
                      <span>🔁 {v.repostCount || 0}</span>
                    </div>
                  </div>
                );
              }
              if (item.type === 'product') {
                const p = item.data;
                return (
                  <div key={`mixed_${idx}`} className="break-inside-avoid bg-[#12111d] border border-white/5 rounded-[28px] overflow-hidden group">
                    <div className="aspect-square relative overflow-hidden bg-zinc-900">
                      {p.image ? <img src={p.image} className="w-full h-full object-cover transition-transform group-hover:scale-110" /> : <ShoppingBag className="w-10 h-10 text-gray-800 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-white font-orbitron font-black text-[9px] tracking-widest">{p.category}</div>
                    </div>
                    <div className="p-4 space-y-2">
                      <h3 className="text-white font-orbitron font-black text-sm truncate uppercase">{p.name}</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-400 font-mono font-bold text-xs">{formatBRL(p.price)}</span>
                        <button onClick={() => onBuyProduct(p)} className="bg-white/5 hover:bg-white/10 text-white p-1.5 rounded-lg transition-all"><ShoppingBag className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                );
              }
              // ... handle other types
              return null;
            })}
          </div>
        );
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn text-left">
      <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <span className="text-[#FF0033] font-orbitron text-[10px] tracking-widest block font-black uppercase">Descoberta Global</span>
          <h1 className="font-orbitron font-black text-3xl text-white">EXPLORAR</h1>
          <p className="text-xs text-gray-500 font-sans max-w-md">O multiverso VOXA em um só lugar: pessoas, VOX, produtos, eventos, vaquinhas e conteúdos exclusivos.</p>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input 
            type="text" 
            value={localQuery}
            onChange={(e) => {
              setLocalQuery(e.target.value);
              if (e.target.value.trim() && activeFilter === 'foryou') {
                setActiveFilter('people');
              }
            }}
            placeholder="Buscar no VOXA..." 
            className="w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-[#FF0033]/50 transition-all font-sans"
          />
        </div>
      </div>

      {/* Filter Tabs Scroller */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-4 scrollbar-none">
        {filters.map(f => {
          const Icon = f.icon;
          const isActive = activeFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-full whitespace-nowrap font-orbitron font-black text-[10px] uppercase transition-all tracking-wider ${isActive ? 'bg-[#FF0033] text-white shadow-lg shadow-red-600/20' : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{f.label}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-[400px]">
        {renderContent()}
      </div>
    </div>
  );
}
