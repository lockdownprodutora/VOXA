import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, orderBy, limit, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Poll, PollOption, PollVote } from '../types';

export const calculatePollEndsAt = (duration: string, customDate?: string): string => {
  if (customDate) return new Date(customDate).toISOString();
  
  const now = Date.now();
  switch (duration) {
    case '1h':
    case '1 hora':
      return new Date(now + 1 * 60 * 60 * 1000).toISOString();
    case '6h':
    case '6 horas':
      return new Date(now + 6 * 60 * 60 * 1000).toISOString();
    case '12h':
    case '12 horas':
      return new Date(now + 12 * 60 * 60 * 1000).toISOString();
    case '1d':
    case '1 dia':
    case '24h':
      return new Date(now + 24 * 60 * 60 * 1000).toISOString();
    case '3d':
    case '3 dias':
      return new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();
    case '7d':
    case '7 dias':
      return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
    case '30 dias':
      return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return new Date(now + 24 * 60 * 60 * 1000).toISOString();
  }
};

export const fetchPolls = async (currentUid?: string): Promise<Poll[]> => {
  try {
    let docsList: any[] = [];
    try {
      const q = query(collection(db, 'polls'), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      docsList = snap.docs;
    } catch (orderErr) {
      // Fallback in case composite/field index or order query is indexing
      const qFallback = query(collection(db, 'polls'), limit(100));
      const snapFallback = await getDocs(qFallback);
      docsList = snapFallback.docs;
    }

    const polls: Poll[] = [];

    for (const docSnap of docsList) {
      const data = docSnap.data() as Poll;
      let userVotedOptionId: string | undefined = undefined;

      if (currentUid) {
        try {
          const voteSnap = await getDoc(doc(db, 'poll_votes', `${docSnap.id}_${currentUid}`));
          if (voteSnap.exists()) {
            userVotedOptionId = voteSnap.data()?.optionId;
          }
        } catch (e) {
          // ignore vote check individual permission/network errors
        }
      }

      // Check if poll has ended by time
      const isEnded = new Date(data.endsAt || 0).getTime() <= Date.now();
      const status = isEnded && data.status === 'ACTIVE' ? 'ENDED' : data.status;

      polls.push({
        ...data,
        id: docSnap.id,
        status,
        userVotedOptionId
      });
    }

    return polls.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err: any) {
    console.warn("Notice: Polls could not be fetched (empty list returned):", err?.message || err);
    return [];
  }
};

export const createPoll = async (
  author: { uid: string; name: string; username: string; avatarUrl?: string },
  question: string,
  rawOptions: string[],
  duration: string,
  customEndsAt?: string
): Promise<Poll> => {
  const pollId = `poll_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const validOptions = rawOptions
    .map(o => o.trim())
    .filter(o => o.length > 0);

  if (validOptions.length < 2) {
    throw new Error("A enquete precisa de no mínimo 2 opções.");
  }
  if (validOptions.length > 10) {
    throw new Error("A enquete pode ter no máximo 10 opções.");
  }

  const options: PollOption[] = validOptions.map((text, idx) => ({
    id: `opt_${idx + 1}`,
    text,
    votesCount: 0
  }));

  const endsAt = calculatePollEndsAt(duration, customEndsAt);
  const now = new Date().toISOString();

  const newPoll: Poll = {
    id: pollId,
    authorId: author.uid,
    authorName: author.name,
    authorUsername: author.username,
    authorAvatar: author.avatarUrl || '',
    question: question.trim(),
    options,
    totalVotes: 0,
    duration,
    endsAt,
    status: 'ACTIVE',
    createdAt: now
  };

  await setDoc(doc(db, 'polls', pollId), newPoll);
  return newPoll;
};

export const votePoll = async (
  pollId: string,
  optionId: string,
  user: { uid: string; name: string }
): Promise<{ success: boolean; message?: string }> => {
  if (!user.uid) {
    throw new Error("Você precisa estar conectado para votar.");
  }

  const voteDocRef = doc(db, 'poll_votes', `${pollId}_${user.uid}`);
  const voteSnap = await getDoc(voteDocRef);

  if (voteSnap.exists()) {
    throw new Error("Você já votou nesta enquete.");
  }

  const pollRef = doc(db, 'polls', pollId);
  const pollSnap = await getDoc(pollRef);

  if (!pollSnap.exists()) {
    throw new Error("Enquete não encontrada.");
  }

  const pollData = pollSnap.data() as Poll;

  // Verify active status and time
  if (pollData.status !== 'ACTIVE' || new Date(pollData.endsAt).getTime() <= Date.now()) {
    throw new Error("Esta enquete já foi encerrada para novos votos.");
  }

  // Update option vote count
  const updatedOptions = pollData.options.map(opt => {
    if (opt.id === optionId) {
      return { ...opt, votesCount: (opt.votesCount || 0) + 1 };
    }
    return opt;
  });

  const totalVotes = (pollData.totalVotes || 0) + 1;

  // Persist vote document
  const voteData: PollVote = {
    id: `${pollId}_${user.uid}`,
    pollId,
    uid: user.uid,
    optionId,
    votedAt: new Date().toISOString()
  };

  await setDoc(voteDocRef, voteData);

  // Update poll document
  await updateDoc(pollRef, {
    options: updatedOptions,
    totalVotes
  });

  return { success: true };
};
