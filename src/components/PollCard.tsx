import React, { useState } from 'react';
import { Poll } from '../types';
import { votePoll } from '../utils/pollDb';
import { VerifiedBadge } from './common/VerifiedBadge';
import { useResolvedUserProfile } from './VoxModule';
import { BarChart3, CheckCircle2, Clock, Share2, Trash2, User } from 'lucide-react';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface PollCardProps {
  poll: Poll;
  currentUser?: any;
  onVoteSuccess?: () => void;
  triggerToast?: (msg: string) => void;
  onVisitProfile?: (username: string) => void;
  isAdmin?: boolean;
}

export const PollCard: React.FC<PollCardProps> = ({
  poll,
  currentUser,
  onVoteSuccess,
  triggerToast,
  onVisitProfile,
  isAdmin = false
}) => {
  const [isVoting, setIsVoting] = useState(false);
  const [selectedOptId, setSelectedOptId] = useState<string | null>(poll.userVotedOptionId || null);

  const isAuthor = currentUser?.uid === poll.authorId;
  const hasVoted = Boolean(selectedOptId || poll.userVotedOptionId);
  const isExpired = new Date(poll.endsAt).getTime() <= Date.now() || poll.status === 'ENDED';

  // Format time remaining
  const getTimeRemainingText = () => {
    if (isExpired) return 'Enquete Encerrada';
    const diffMs = new Date(poll.endsAt).getTime() - Date.now();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `Termina em ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
    }
    if (diffHours > 0) {
      return `Termina em ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    }
    const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `Termina em ${diffMinutes} min`;
  };

  const handleVote = async (optId: string) => {
    if (!currentUser?.uid) {
      triggerToast?.('Faça login para votar na enquete.');
      return;
    }
    if (hasVoted || isExpired || isVoting) return;

    try {
      setIsVoting(true);
      await votePoll(poll.id, optId, {
        uid: currentUser.uid,
        name: currentUser.name || 'Usuário VOXA'
      });
      setSelectedOptId(optId);
      triggerToast?.('Voto registrado com sucesso! 📊');
      if (onVoteSuccess) onVoteSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar voto.');
    } finally {
      setIsVoting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Deseja realmente excluir esta enquete?')) return;
    try {
      await deleteDoc(doc(db, 'polls', poll.id));
      triggerToast?.('Enquete excluída com sucesso.');
      if (onVoteSuccess) onVoteSuccess();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/?poll=${poll.id}`;
    navigator.clipboard.writeText(url);
    triggerToast?.('Link da enquete copiado!');
  };

  const totalVotes = poll.totalVotes || 0;
  const authorProfile = useResolvedUserProfile(
    poll.authorId,
    poll.authorName,
    poll.authorUsername,
    poll.authorAvatar || ''
  );

  return (
    <div className="bg-[#12111d] border border-white/10 hover:border-white/20 transition-all rounded-[24px] p-6 space-y-4 text-left shadow-lg">
      {/* Header with author info */}
      <div className="flex items-center justify-between gap-3">
        <div 
          onClick={() => onVisitProfile && onVisitProfile(authorProfile.username || poll.authorUsername || poll.authorId)}
          className="flex items-center space-x-3 cursor-pointer group min-w-0"
        >
          <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-900 border border-white/10 shrink-0 flex items-center justify-center">
            {authorProfile.photoURL && typeof authorProfile.photoURL === 'string' && authorProfile.photoURL.trim() !== '' ? (
              <img src={authorProfile.photoURL.trim()} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-gray-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="font-orbitron font-black text-xs text-white uppercase truncate group-hover:underline">
                {authorProfile.name || poll.authorName}
              </span>
              {authorProfile.verified && <VerifiedBadge size="xs" />}
            </div>
            <span className="font-mono text-[10px] text-gray-500 block truncate">
              @{authorProfile.username || poll.authorUsername || 'membro'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <span className="bg-violet-500/10 text-violet-400 border border-violet-500/20 font-orbitron font-black text-[8px] px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
            <BarChart3 className="w-3 h-3" />
            Enquete
          </span>
          {(isAuthor || isAdmin) && (
            <button
              onClick={handleDelete}
              className="text-gray-600 hover:text-red-400 p-1.5 cursor-pointer rounded-lg hover:bg-white/5 transition-colors"
              title="Excluir Enquete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Question */}
      <div>
        <h4 className="font-orbitron font-extrabold text-sm md:text-base text-white leading-snug">
          {poll.question}
        </h4>
      </div>

      {/* Options & Results */}
      <div className="space-y-2.5 pt-1">
        {poll.options.map((opt) => {
          const voteCount = opt.votesCount || 0;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isSelected = selectedOptId === opt.id;

          if (hasVoted || isExpired) {
            // Show percentage bars
            return (
              <div
                key={opt.id}
                className={`relative overflow-hidden rounded-xl border p-3 transition-all ${
                  isSelected
                    ? 'border-violet-500 bg-violet-950/20 text-white'
                    : 'border-white/5 bg-black/40 text-gray-300'
                }`}
              >
                {/* Visual progress bar fill */}
                <div
                  className={`absolute top-0 bottom-0 left-0 transition-all duration-700 ease-out ${
                    isSelected ? 'bg-violet-600/30' : 'bg-white/10'
                  }`}
                  style={{ width: `${percentage}%` }}
                />

                <div className="relative z-10 flex items-center justify-between text-xs font-sans">
                  <div className="flex items-center space-x-2 font-medium">
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                    )}
                    <span className={isSelected ? 'font-bold text-white' : ''}>{opt.text}</span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0 font-mono text-[11px]">
                    <span className="text-gray-400">{voteCount} {voteCount === 1 ? 'voto' : 'votos'}</span>
                    <span className="font-bold font-orbitron text-white text-xs">{percentage}%</span>
                  </div>
                </div>
              </div>
            );
          }

          // Show clickable options for active voting
          return (
            <button
              key={opt.id}
              onClick={() => handleVote(opt.id)}
              disabled={isVoting}
              className="w-full text-left p-3.5 rounded-xl border border-white/10 hover:border-violet-500/60 bg-black/30 hover:bg-violet-600/10 transition-all text-xs font-sans text-white hover:text-white cursor-pointer flex items-center justify-between group"
            >
              <span className="font-medium group-hover:translate-x-1 transition-transform">{opt.text}</span>
              <span className="text-[10px] font-orbitron font-bold text-gray-500 group-hover:text-violet-400 uppercase">
                Votar
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer metadata (Total votes, ends at, share) */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-gray-500 font-sans">
        <div className="flex items-center space-x-3">
          <span className="font-mono font-bold text-gray-300">
            {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}
          </span>
          <span>•</span>
          <span className="flex items-center space-x-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className={isExpired ? 'text-amber-400 font-bold' : ''}>{getTimeRemainingText()}</span>
          </span>
        </div>

        <button
          onClick={handleShare}
          className="text-gray-400 hover:text-white flex items-center space-x-1 cursor-pointer transition-colors p-1"
          title="Compartilhar Enquete"
        >
          <Share2 className="w-3 h-3" />
          <span>Compartilhar</span>
        </button>
      </div>
    </div>
  );
};
