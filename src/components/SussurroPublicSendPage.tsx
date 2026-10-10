import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { Send, CheckCircle2, Shield, Loader, AlertCircle, AlertTriangle } from 'lucide-react';

interface SussurroPublicSendPageProps {
  visitedUsername: string | null;
  visitedUser: any;
  currentUser: any;
  triggerToast: (msg: string) => void;
  onBackToHome: () => void;
}

export function SussurroPublicSendPage({
  visitedUsername,
  visitedUser,
  currentUser,
  triggerToast,
  onBackToHome
}: SussurroPublicSendPageProps) {
  const [recipient, setRecipient] = useState<any>(visitedUser || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [text, setText] = useState('');
  const [anonymousMode, setAnonymousMode] = useState<'absolute' | 'revealable'>('absolute');
  const [agreeReveal, setAgreeReveal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Self-contained profile resolution on mount
  useEffect(() => {
    const resolveProfile = async () => {
      if (!visitedUsername) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);

        const usersRef = collection(db, "users");
        const cleanUsername = visitedUsername.trim().toLowerCase();

        // 1. Query by slug
        let q = query(usersRef, where("slug", "==", cleanUsername), limit(1));
        let snap = await getDocs(q);

        // 2. Query by username if empty
        if (snap.empty) {
          q = query(usersRef, where("username", "==", cleanUsername), limit(1));
          snap = await getDocs(q);
        }

        // 3. Query by exact username case-sensitive if still empty
        if (snap.empty) {
          q = query(usersRef, where("username", "==", visitedUsername.trim()), limit(1));
          snap = await getDocs(q);
        }

        if (!snap.empty) {
          const docData = snap.docs[0].data();
          setRecipient({
            id: snap.docs[0].id,
            uid: snap.docs[0].id,
            ...docData
          });
        } else {
          setRecipient(null);
        }
      } catch (err: any) {
        console.error("[Sussurro Resolver Error]", err);
        setError("Não foi possível carregar a Caixa de Sussurros neste momento.");
      } finally {
        setLoading(false);
      }
    };

    resolveProfile();
  }, [visitedUsername]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !recipient) return;

    if (anonymousMode === 'revealable' && !agreeReveal) {
      alert("Para enviar no modo revelável, você deve concordar explicitamente com os termos de revelação.");
      return;
    }

    setIsSending(true);
    try {
      // 1. Generate unique document references
      const messagesColl = collection(db, "sussurro_messages");
      const messageDocRef = doc(messagesColl);
      const messageId = messageDocRef.id;

      const isRevealAllowed = anonymousMode === 'revealable' && !!currentUser;

      // 2. Save public message metadata
      const publicDoc = {
        id: messageId,
        recipientUid: recipient.uid || recipient.id,
        text: text.trim(),
        anonymousMode,
        revealAllowed: isRevealAllowed,
        revealed: false,
        createdAt: new Date().toISOString(),
        readAt: null,
        status: "UNREAD",
        moderationStatus: "PENDING"
      };
      await setDoc(messageDocRef, publicDoc);

      // 3. Save secure private identity link (only if revealable)
      if (isRevealAllowed) {
        const privateDocRef = doc(db, "sussurro_private", messageId);
        await setDoc(privateDocRef, {
          messageId,
          recipientUid: recipient.uid || recipient.id,
          senderUid: currentUser.uid || currentUser.id,
          createdAt: new Date().toISOString()
        });
      }

      // 4. Send secure real-time notification (without disclosing text)
      const notifId = `notif_sussurro_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await setDoc(doc(db, "notifications", notifId), {
        id: notifId,
        userId: recipient.uid || recipient.id,
        title: "Você recebeu um novo Sussurro 👻",
        message: "Abra sua Caixa de Sussurros no perfil para ler o que te enviaram.",
        read: false,
        createdAt: new Date().toISOString()
      });

      setSentSuccess(true);
      setText('');
      triggerToast('Sussurro enviado com sucesso!');
    } catch (err: any) {
      console.error("[Sussurro Send Error]", err);
      alert("Ocorreu um erro ao enviar seu Sussurro. Tente novamente mais tarde.");
    } finally {
      setIsSending(false);
    }
  };

  // State 1: Loading recipient profile
  if (loading) {
    return (
      <div className="max-w-md mx-auto my-16 bg-[#0c0b16] border border-white/10 rounded-[32px] p-12 text-center space-y-4 text-white shadow-2xl">
        <Loader className="w-10 h-10 text-[#FF0033] animate-spin mx-auto" />
        <h3 className="font-orbitron font-extrabold text-sm uppercase tracking-widest text-gray-300">Buscando perfil na rede VOXA...</h3>
        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Aguarde um instante</p>
      </div>
    );
  }

  // State 2: Error loading profile
  if (error) {
    return (
      <div className="max-w-md mx-auto my-16 bg-[#0c0b16] border border-white/10 rounded-[32px] p-8 text-center space-y-6 text-white shadow-2xl">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-amber-500">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="font-orbitron font-black text-lg uppercase tracking-wider">Erro de Carregamento</h2>
        <p className="text-xs text-gray-400 font-sans leading-relaxed">
          {error}
        </p>
        <button
          onClick={onBackToHome}
          className="bg-white hover:bg-neutral-200 text-black font-orbitron font-bold text-[10px] tracking-widest uppercase px-6 py-3.5 rounded-xl cursor-pointer w-full transition-all"
        >
          Voltar para a VOXA
        </button>
      </div>
    );
  }

  // State 3: Recipient not found
  if (!recipient) {
    return (
      <div className="max-w-md mx-auto my-16 bg-[#0c0b16] border border-white/10 rounded-[32px] p-8 text-center space-y-6 text-white shadow-2xl">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-[#FF0033] text-2xl font-bold">
          👻
        </div>
        <h2 className="font-orbitron font-black text-xl uppercase tracking-wider text-white">Este link de Sussurro não está disponível</h2>
        <p className="text-xs text-gray-400 font-sans leading-relaxed">
          O perfil @{visitedUsername || 'user'} não existe, alterou seu slug ou desativou o recebimento de Sussurros.
        </p>
        <button
          onClick={() => {
            window.location.href = '/register';
          }}
          className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-[10px] tracking-widest uppercase px-6 py-3.5 rounded-xl cursor-pointer w-full transition-all shadow-lg shadow-red-600/10"
        >
          Conhecer a VOXA
        </button>
      </div>
    );
  }

  // State 4: Recipient has disabled receiving sussurros
  if (recipient.sussurrosDisabled === true) {
    return (
      <div className="max-w-md mx-auto my-16 bg-[#0c0b16] border border-white/10 rounded-[32px] p-8 text-center space-y-6 text-white shadow-2xl">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-[#FF0033]">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="font-orbitron font-black text-lg uppercase tracking-wider text-white">Sussurros Desativados</h2>
        <p className="text-xs text-gray-400 font-sans leading-relaxed">
          @{recipient.username || recipient.slug || 'user'} não está recebendo Sussurros no momento.
        </p>
        <button
          onClick={onBackToHome}
          className="bg-white hover:bg-neutral-200 text-black font-orbitron font-bold text-[10px] tracking-widest uppercase px-6 py-3.5 rounded-xl cursor-pointer w-full transition-all"
        >
          Ir para a VOXA
        </button>
      </div>
    );
  }

  // State 5: Success after sending message
  if (sentSuccess) {
    const recipientReferralCode = (recipient.referralCode || recipient.username || recipient.slug || '').toUpperCase();
    const registerUrl = recipientReferralCode
      ? `/register?ref=${encodeURIComponent(recipientReferralCode)}&source=sussurro`
      : '/register?source=sussurro';

    return (
      <div className="max-w-md mx-auto my-16 bg-[#0c0b16] border border-white/10 rounded-[32px] p-8 text-center space-y-6 text-white shadow-2xl animate-fadeIn">
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div>
          <h2 className="font-orbitron font-black text-xl uppercase tracking-wider text-white">Sussurro Enviado! 👻</h2>
          <p className="text-[10px] text-gray-500 font-mono mt-1 uppercase">Sua mensagem chegou com segurança.</p>
        </div>
        
        <p className="text-xs text-gray-300 font-sans leading-relaxed">
          Sua mensagem foi entregue com sucesso para @{(recipient.username || recipient.slug || 'user').toLowerCase()}.
        </p>

        <div className="border-t border-white/10 pt-6 space-y-3">
          <span className="block text-xs font-orbitron font-black text-[#FF0033] uppercase tracking-widest">
            Quer receber Sussurros também?
          </span>
          <button
            type="button"
            onClick={() => {
              window.location.href = registerUrl;
            }}
            className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs py-4 px-6 rounded-2xl cursor-pointer w-full transition-all shadow-lg shadow-red-600/10 uppercase tracking-widest"
          >
            Criar minha conta na VOXA
          </button>
          {!currentUser && (
            <button
              type="button"
              onClick={() => {
                window.location.href = recipientReferralCode
                  ? `/login?ref=${encodeURIComponent(recipientReferralCode)}`
                  : '/login';
              }}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-orbitron font-bold text-xs py-3.5 px-6 rounded-2xl cursor-pointer w-full transition-all uppercase tracking-widest"
            >
              Entrar
            </button>
          )}
          <span className="block text-[10px] text-gray-500 font-orbitron tracking-widest uppercase pt-1">
            Uma nova dimensão social.
          </span>
        </div>
        
        <div className="pt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setSentSuccess(false)}
            className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer font-orbitron uppercase tracking-wider underline"
          >
            Enviar outro Sussurro
          </button>
        </div>
      </div>
    );
  }

  // State 6: Main message composition form
  const recipientName = recipient.name || recipient.displayName || "Usuário VOXA";
  const recipientUsername = recipient.username || recipient.slug || "user";
  const recipientAvatar = recipient.photoURL || recipient.avatarUrl || null;

  return (
    <div className="max-w-md mx-auto my-8 text-white px-4 animate-fadeIn text-center">
      <div className="mb-4">
        <h1 className="font-orbitron font-black text-2xl tracking-widest text-white">VOXA</h1>
        <p className="text-[9px] text-[#FF0033] font-orbitron font-black uppercase tracking-widest mt-0.5">Uma nova dimensão social.</p>
      </div>

      <div className="bg-[#0c0b16] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl relative text-center pb-8">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#FF0033] to-red-500"></div>
        
        {/* Cover space */}
        <div className="h-24 bg-gradient-to-tr from-black to-red-950/20 relative"></div>
        
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-[#0c0b16] ring-1 ring-white/10 bg-zinc-900 mx-auto -mt-10 flex items-center justify-center">
          {recipientAvatar ? (
            <img src={recipientAvatar} alt={recipientName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-zinc-800 text-white font-orbitron font-black text-2xl flex items-center justify-center">
              {recipientName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* User Info & Title */}
        <div className="mt-3 px-6 space-y-1">
          <h2 className="font-orbitron font-black text-lg text-white uppercase tracking-tight">{recipientName}</h2>
          <span className="text-[11px] text-[#FF0033] font-mono tracking-widest block font-bold">@{recipientUsername}</span>
          <h3 className="font-orbitron font-black text-base text-white uppercase tracking-wider pt-2">
            Envie um Sussurro
          </h3>
        </div>

        {/* Form */}
        <form onSubmit={handleSend} className="mt-5 mx-6 text-left space-y-5">
          <div className="space-y-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.substring(0, 300))}
              placeholder="Escreva sua mensagem secreta aqui..."
              rows={4}
              maxLength={300}
              className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 font-sans text-xs text-white focus:outline-none focus:border-[#FF0033] placeholder-gray-500 resize-none transition-all leading-relaxed"
              required
            />
            <div className="text-right">
              <span className="text-[9px] font-mono text-gray-600">{text.length}/300 caracteres</span>
            </div>
          </div>

          {/* Anonymity settings based on login */}
          <div className="space-y-3">
            <span className="text-[9px] font-orbitron font-black text-gray-400 uppercase tracking-widest block">Confidencialidade</span>
            
            <div className="grid grid-cols-1 gap-3">
              <div 
                onClick={() => setAnonymousMode('absolute')}
                className={`border rounded-2xl p-4 cursor-pointer transition-all flex items-start space-x-3 text-left ${anonymousMode === 'absolute' ? 'bg-[#FF0033]/5 border-[#FF0033] shadow-md shadow-[#FF0033]/5' : 'bg-black/20 border-white/10 hover:border-white/20'}`}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${anonymousMode === 'absolute' ? 'border-[#FF0033]' : 'border-gray-500'}`}>
                  {anonymousMode === 'absolute' && <div className="w-2 h-2 rounded-full bg-[#FF0033]" />}
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-orbitron font-extrabold text-white uppercase tracking-wider block">Anônimo Absoluto 👻</span>
                  <p className="text-[10px] text-gray-400 font-sans leading-relaxed">
                    Sua identidade nunca poderá ser revelada ao destinatário. Anônimo absoluto.
                  </p>
                </div>
              </div>

              {currentUser && (
                <div 
                  onClick={() => setAnonymousMode('revealable')}
                  className={`border rounded-2xl p-4 cursor-pointer transition-all flex items-start space-x-3 text-left ${anonymousMode === 'revealable' ? 'bg-amber-500/5 border-amber-500 shadow-md shadow-amber-500/5' : 'bg-black/20 border-white/10 hover:border-white/20'}`}
                >
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${anonymousMode === 'revealable' ? 'border-amber-500' : 'border-gray-500'}`}>
                    {anonymousMode === 'revealable' && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs font-orbitron font-extrabold text-white uppercase tracking-wider block">Anônimo Revelável 👀</span>
                    <p className="text-[10px] text-gray-400 font-sans leading-relaxed">
                      Seu nome ficará oculto inicialmente, mas o destinatário poderá pagar para revelar seu perfil VOXA.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Consent terms if revealable */}
          {anonymousMode === 'revealable' && currentUser && (
            <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl flex items-start space-x-3 text-left animate-fadeIn">
              <input
                type="checkbox"
                id="agreeReveal"
                checked={agreeReveal}
                onChange={(e) => setAgreeReveal(e.target.checked)}
                className="w-4 h-4 text-amber-500 border-gray-700 bg-zinc-900 rounded-sm focus:ring-transparent shrink-0 mt-0.5 cursor-pointer accent-amber-500"
                required
              />
              <label htmlFor="agreeReveal" className="text-[10px] text-gray-300 font-sans leading-relaxed cursor-pointer">
                <strong className="text-white font-bold block mb-0.5">TERMO DE REVELAÇÃO</strong>
                Aceito que o destinatário poderá revelar meu perfil real de usuário mediante pagamento da taxa da plataforma.
              </label>
            </div>
          )}

          {/* Send Button */}
          <button
            type="submit"
            disabled={isSending || (anonymousMode === 'revealable' && !agreeReveal)}
            className="w-full bg-[#FF0033] hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-orbitron font-black text-xs py-4 px-6 rounded-2xl transition-all cursor-pointer flex items-center justify-center space-x-2 tracking-widest uppercase shadow-lg shadow-red-600/10 hover:scale-101"
          >
            {isSending ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>ENVIANDO SUSSURRO...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Enviar Sussurro</span>
              </>
            )}
          </button>
        </form>
      </div>
      
      {/* Footer */}
      <div className="mt-6 flex justify-center items-center space-x-2 text-[9px] text-gray-500 uppercase tracking-widest">
        <Shield className="w-3.5 h-3.5" />
        <span>Sussurro VOXA • Criptografado & Seguro</span>
      </div>
    </div>
  );
}
