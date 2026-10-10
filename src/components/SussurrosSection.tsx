import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, query, where, onSnapshot 
} from 'firebase/firestore';
import { 
  Ghost, Copy, Share2, MessageCircle, Eye, AlertTriangle, Trash2, Shield, 
  X, Check, Lock, ChevronRight, HelpCircle, CheckCircle2, QrCode, RefreshCw, Send
} from 'lucide-react';
import { formatBRL } from '../utils/money';

interface SussurrosSectionProps {
  currentUser: any;
  triggerToast: (msg: string) => void;
  setActiveTab: (tab: string) => void;
}

export function SussurrosSection({ currentUser, triggerToast, setActiveTab }: SussurrosSectionProps) {
  const [boxEnabled, setBoxEnabled] = useState(false);
  const [boxLoading, setBoxLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [revealPrice, setRevealPrice] = useState(0.99);

  // Modals & Actions States
  const [activeMessage, setActiveMessage] = useState<any | null>(null);
  const [isRevealModalOpen, setIsRevealModalOpen] = useState(false);
  const [isAnswerModalOpen, setIsAnswerModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  // Wallet Balance checking
  const [userBalance, setUserBalance] = useState(0);
  const [checkingBalance, setCheckingBalance] = useState(false);

  // PIX Payment States
  const [pixPaymentData, setPixPaymentData] = useState<any | null>(null);
  const [creatingPix, setCreatingPix] = useState(false);
  const [pixPollingActive, setPixPollingActive] = useState(false);

  // Answer Q&A States
  const [answerText, setAnswerText] = useState('');
  const [postingStory, setPostingStory] = useState(false);

  // Report States
  const [reportCategory, setReportCategory] = useState('assédio');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Reveal Process States
  const [revealingByWallet, setRevealingByWallet] = useState(false);
  const [revealedProfile, setRevealedProfile] = useState<any | null>(null);

  const username = currentUser?.username || currentUser?.slug || 'user';
  const publicLink = `${window.location.origin}/s/${username}`;

  // 1. Fetch Box Enabled / Disabled state
  useEffect(() => {
    if (!currentUser?.uid) return;
    setBoxLoading(true);
    const boxRef = doc(db, "sussurro_boxes", currentUser.uid);
    const unsubscribe = onSnapshot(boxRef, (snap) => {
      if (snap.exists()) {
        setBoxEnabled(snap.data().enabled ?? false);
      } else {
        setBoxEnabled(false);
      }
      setBoxLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // 2. Fetch Received Sussurro Messages (Real-time)
  useEffect(() => {
    if (!currentUser?.uid) return;
    setMessagesLoading(true);
    const messagesColl = collection(db, "sussurro_messages");
    const q = query(messagesColl, where("recipientUid", "==", currentUser.uid));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs: any[] = [];
      snap.forEach((d) => {
        msgs.push({ id: d.id, ...d.data() });
      });
      // Sort descending by creation date
      msgs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setMessages(msgs);
      setMessagesLoading(false);
    }, (err) => {
      console.error("[Sussurros Inbox Snapshot Error]", err);
      setMessagesLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 3. Fetch Configured Price on mount
  useEffect(() => {
    fetch("/api/admin/sussurro/config")
      .then(res => res.json())
      .then(data => {
        if (data.success && typeof data.revealPrice === 'number') {
          setRevealPrice(data.revealPrice);
        }
      })
      .catch(err => console.warn("Failed to fetch reveal price config:", err));
  }, []);

  // 4. Poll PIX Reveal Status
  useEffect(() => {
    if (!pixPollingActive || !activeMessage?.id) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/sussurro/${activeMessage.id}/reveal-status?userId=${currentUser.uid}`);
        if (response.ok) {
          const statusData = await response.json();
          if (statusData.success && statusData.revealed) {
            setPixPollingActive(false);
            setPixPaymentData(null);
            setRevealedProfile(statusData.senderProfile);
            triggerToast("🎉 Pagamento confirmado via PIX! Identidade revelada!");
          }
        }
      } catch (err) {
        console.warn("Error polling reveal status:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [pixPollingActive, activeMessage, currentUser]);

  // 5. Activate Box action
  const handleActivateBox = async () => {
    if (!currentUser?.uid) return;
    try {
      const boxRef = doc(db, "sussurro_boxes", currentUser.uid);
      await setDoc(boxRef, {
        userId: currentUser.uid,
        enabled: true,
        updatedAt: new Date().toISOString()
      });
      setBoxEnabled(true);
      triggerToast("👻 Sua Caixa de Sussurros está ativa! Compartilhe o link.");
    } catch (err) {
      console.error("Box activation error:", err);
    }
  };

  // 6. Disable Box action
  const handleToggleBox = async (enabledState: boolean) => {
    if (!currentUser?.uid) return;
    try {
      const boxRef = doc(db, "sussurro_boxes", currentUser.uid);
      await updateDoc(boxRef, {
        enabled: enabledState,
        updatedAt: new Date().toISOString()
      });
      triggerToast(enabledState ? "👻 Caixa de Sussurros ativada!" : "⏸️ Caixa de Sussurros pausada.");
    } catch (err) {
      console.error("Box toggle error:", err);
    }
  };

  // 7. Copy link to clipboard
  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicLink);
    triggerToast("📋 Link copiado com sucesso!");
  };

  // 8. Open Reveal process
  const handleOpenReveal = async (msg: any) => {
    setActiveMessage(msg);
    setRevealedProfile(null);
    setPixPaymentData(null);
    setPixPollingActive(false);
    setIsRevealModalOpen(true);

    // Check user balance
    setCheckingBalance(true);
    try {
      const response = await fetch(`/api/wallet/balance?userId=${currentUser.uid}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // availableBalance or balance
          setUserBalance(data.availableBalance !== undefined ? data.availableBalance : (data.balance || 0));
        }
      }
    } catch (err) {
      console.warn("Failed to check balance:", err);
    } finally {
      setCheckingBalance(false);
    }
  };

  // 9. Execute Wallet payment reveal
  const handleRevealWithWallet = async () => {
    if (!activeMessage?.id || !currentUser?.uid) return;
    setRevealingByWallet(true);
    try {
      const response = await fetch(`/api/sussurro/${activeMessage.id}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.uid })
      });
      const data = await response.json();
      if (data.success && data.revealed) {
        setRevealedProfile(data.senderProfile);
        triggerToast("🔑 Revelado com sucesso!");
      } else {
        alert(data.error || "Ocorreu um erro no débito.");
      }
    } catch (err: any) {
      alert("Erro de rede: " + err.message);
    } finally {
      setRevealingByWallet(false);
    }
  };

  // 10. Create Mercado Pago PIX Reveal charge
  const handleRevealWithPix = async () => {
    if (!activeMessage?.id || !currentUser?.uid) return;
    setCreatingPix(true);
    try {
      const response = await fetch(`/api/sussurro/${activeMessage.id}/reveal-pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.uid,
          buyerName: currentUser.name || "Membro",
          payerEmail: currentUser.email || "pix@voxa.com.br"
        })
      });
      const data = await response.json();
      if (data.success) {
        setPixPaymentData(data);
        setPixPollingActive(true);
        triggerToast("⚡ QR Code PIX gerado! Aguardando confirmação.");
      } else {
        alert(data.error || "Erro ao gerar PIX.");
      }
    } catch (err: any) {
      alert("Erro ao conectar ao MP: " + err.message);
    } finally {
      setCreatingPix(false);
    }
  };

  // 11. Delete Sussurro Message
  const handleDeleteSussurro = async (msgId: string) => {
    if (!confirm("Deseja realmente excluir este Sussurro permanentemente?")) return;
    try {
      await deleteDoc(doc(db, "sussurro_messages", msgId));
      triggerToast("🗑️ Sussurro excluído permanentemente.");
      if (activeMessage?.id === msgId) {
        setIsRevealModalOpen(false);
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // 12. Submit Moderation Report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMessage?.id || !currentUser?.uid) return;
    setSubmittingReport(true);
    try {
      const reportsColl = collection(db, "sussurro_reports");
      const reportDocRef = doc(reportsColl);
      await setDoc(reportDocRef, {
        id: reportDocRef.id,
        messageId: activeMessage.id,
        reporterId: currentUser.uid,
        category: reportCategory,
        details: reportDetails.trim(),
        status: "PENDING",
        createdAt: new Date().toISOString()
      });

      // Update message status to REPORTED
      const msgRef = doc(db, "sussurro_messages", activeMessage.id);
      await updateDoc(msgRef, { status: "REPORTED" });

      triggerToast("🛡️ Denúncia enviada para a Moderação da VOXA.");
      setIsReportModalOpen(false);
      setReportDetails('');
    } catch (err) {
      console.error("Report error:", err);
    } finally {
      setSubmittingReport(false);
    }
  };

  // 13. Create Story Card on HTML5 Canvas
  const handleGenerateShareCard = async (type: 'request' | 'answer', question?: string, answer?: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Futuristic black minimalist background
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, 1080, 1920);

    // Decorative gradient blur background elements
    const gradient = ctx.createRadialGradient(540, 960, 100, 540, 960, 800);
    gradient.addColorStop(0, 'rgba(255, 0, 51, 0.08)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Card Frame container
    const cardPadding = 80;
    const cardX = cardPadding;
    const cardY = 500;
    const cardW = 1080 - (cardPadding * 2);
    const cardH = type === 'request' ? 800 : 920;

    // Outer ring outline
    ctx.strokeStyle = '#22222a';
    ctx.lineWidth = 4;
    ctx.fillStyle = '#0a0a0f';
    
    // Draw rounded rect
    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    drawRoundedRect(cardX, cardY, cardW, cardH, 48);

    // Accent line
    ctx.fillStyle = '#FF0033';
    ctx.fillRect(cardX + 40, cardY, cardW - 80, 6);

    // 3. Draw Avatar
    const avatarR = 80;
    const avatarX = 540;
    const avatarY = cardY - 20;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.clip();

    const avatarImg = new window.Image();
    avatarImg.crossOrigin = 'anonymous';

    const loadAvatar = new Promise<void>((resolve) => {
      avatarImg.onload = () => {
        ctx.drawImage(avatarImg, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
        resolve();
      };
      avatarImg.onerror = () => {
        const grad = ctx.createLinearGradient(avatarX - avatarR, avatarY - avatarR, avatarX + avatarR, avatarY + avatarR);
        grad.addColorStop(0, '#FF0033');
        grad.addColorStop(1, '#80001A');
        ctx.fillStyle = grad;
        ctx.fillRect(avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(currentUser?.name?.charAt(0).toUpperCase() || 'V', avatarX, avatarY);
        resolve();
      };
      avatarImg.src = currentUser?.photoURL || currentUser?.avatarUrl || 'https://via.placeholder.com/150';
    });

    await loadAvatar;
    ctx.restore();

    // Outlined avatar circle border
    ctx.strokeStyle = '#FF0033';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR + 2, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Draw @Username
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`@${username.toLowerCase()}`, 540, cardY + avatarR + 30);

    // 5. Draw Content text
    if (type === 'request') {
      ctx.fillStyle = '#8A8A9D';
      ctx.font = 'bold 30px Arial';
      ctx.fillText('SUSSURRO VOXA', 540, cardY + 220);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'black 64px sans-serif';
      ctx.fillText('Me manda um', 540, cardY + 360);
      ctx.fillText('Sussurro 👀', 540, cardY + 450);

      ctx.fillStyle = '#656575';
      ctx.font = '32px sans-serif';
      ctx.fillText('Toque no link para enviar', 540, cardY + 590);
    } else {
      // Question & Answer
      ctx.fillStyle = '#FF0033';
      ctx.font = 'bold 24px Arial';
      ctx.fillText('PERGUNTA REBIDA:', 540, cardY + 200);

      // Question text box background
      ctx.fillStyle = '#0f0f15';
      drawRoundedRect(cardX + 60, cardY + 240, cardW - 120, 180, 20);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'italic bold 32px Arial';
      
      // Wrap question text
      const qWords = (question || '').split(' ');
      let qLine = '';
      let qY = cardY + 310;
      for (const word of qWords) {
        if (ctx.measureText(qLine + ' ' + word).width < cardW - 200) {
          qLine += ' ' + word;
        } else {
          ctx.fillText(qLine, 540, qY);
          qLine = word;
          qY += 45;
        }
      }
      ctx.fillText(qLine, 540, qY);

      // Answer Header
      ctx.fillStyle = '#FF0033';
      ctx.font = 'bold 24px Arial';
      ctx.fillText('MINHA RESPOSTA:', 540, cardY + 490);

      // Answer text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 42px Arial';
      const aWords = (answer || '').split(' ');
      let aLine = '';
      let aY = cardY + 560;
      for (const word of aWords) {
        if (ctx.measureText(aLine + ' ' + word).width < cardW - 140) {
          aLine += ' ' + word;
        } else {
          ctx.fillText(aLine, 540, aY);
          aLine = word;
          aY += 55;
        }
      }
      ctx.fillText(aLine, 540, aY);
    }

    // 6. Draw VOXA Footer branding
    ctx.fillStyle = '#FF0033';
    ctx.fillRect(510, 1600, 60, 4);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 45px Arial';
    ctx.fillText('VOXA', 540, 1660);

    ctx.fillStyle = '#555566';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('O QUE VOCÊ SEMPRE QUIS DIZER, SEM APARECER.', 540, 1710);

    // 7. Convert canvas to blob and share/download
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `sussurro_${type}.png`, { type: 'image/png' });
      
      // Web Share API support check
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'Sussurro VOXA',
            text: `Me manda um Sussurro na VOXA 👀 ${publicLink}`
          });
          triggerToast("📲 Compartilhado com sucesso!");
        } catch (shareErr) {
          console.warn("Share failed, falling back to download:", shareErr);
          downloadBlob(blob, `sussurro_${type}.png`);
        }
      } else {
        // Fallback downlad
        downloadBlob(blob, `sussurro_${type}.png`);
        triggerToast("💾 Imagem gerada! Salve para publicar nos stories.");
      }
    });
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 14. Post answer as a Story on VOXA internally
  const handlePostStoryOnVoxa = async () => {
    if (!answerText.trim() || !activeMessage?.text) return;
    setPostingStory(true);
    try {
      // Create a story-style post on VOXA feed
      const storiesColl = collection(db, "posts"); // "posts" is VOXA's public feed
      const storyRef = doc(storiesColl);
      
      await setDoc(storyRef, {
        id: storyRef.id,
        userId: currentUser.uid,
        userName: currentUser.name,
        userPhoto: currentUser.photoURL || currentUser.avatarUrl || "",
        content: `💬 RESPONDENDO SUSSURRO ANÔNIMO:\n\n❓ "${activeMessage.text}"\n\n👉 "${answerText.trim()}"`,
        likesCount: 0,
        likesList: [],
        createdAt: new Date().toISOString(),
        type: 'sussurro_answer'
      });

      triggerToast("💬 Resposta publicada com sucesso no Story/Feed VOXA!");
      setIsAnswerModalOpen(false);
      setAnswerText('');
    } catch (err) {
      console.error("Story post error:", err);
      alert("Ocorreu um erro ao postar sua resposta.");
    } finally {
      setPostingStory(false);
    }
  };

  // 15. Helper to share link to WhatsApp
  const handleShareWhatsApp = () => {
    const msg = encodeURIComponent(`Me manda um Sussurro na VOXA 👀 O que você sempre quis me dizer sem aparecer? Envie aqui: ${publicLink}`);
    window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
  };

  // Status mapping utility
  const getBadgeStyle = (status: string) => {
    switch (String(status).toUpperCase()) {
      case 'UNREAD': return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'READ': return 'bg-zinc-800 text-gray-400 border border-zinc-700';
      case 'REVEALED': return 'bg-amber-500/10 text-amber-400 border border-amber-500/25 animate-pulse';
      case 'REPORTED': return 'bg-amber-600/10 text-amber-500 border border-amber-600/20';
      default: return 'bg-zinc-800 text-gray-400 border border-zinc-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (String(status).toUpperCase()) {
      case 'UNREAD': return 'Não lido';
      case 'READ': return 'Lido';
      case 'REVEALED': return 'Revelado';
      case 'REPORTED': return 'Denunciado';
      default: return 'Recebido';
    }
  };

  // Mark message as READ when expanding details
  const handleMarkAsRead = async (msg: any) => {
    if (msg.status === 'UNREAD') {
      try {
        const msgRef = doc(db, "sussurro_messages", msg.id);
        await updateDoc(msgRef, {
          status: 'READ',
          readAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Failed to mark as read:", err);
      }
    }
  };

  if (boxLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-black/40 border border-white/5 rounded-3xl text-white">
        <RefreshCw className="w-10 h-10 text-[#FF0033] animate-spin mb-4" />
        <span className="font-orbitron font-bold text-xs uppercase tracking-widest text-gray-500">Acessando Caixa de Sussurros...</span>
      </div>
    );
  }

  // Activation Screen if not yet enabled or first-time
  if (!boxEnabled) {
    return (
      <div className="max-w-md mx-auto my-6 bg-[#0c0b16] border border-white/10 rounded-[32px] p-8 text-center space-y-6 text-white shadow-2xl animate-fadeIn">
        <div className="w-20 h-20 bg-[#FF0033]/10 border border-[#FF0033]/30 rounded-full flex items-center justify-center mx-auto text-[#FF0033] animate-bounce">
          <Ghost className="w-10 h-10" />
        </div>
        
        <div className="space-y-2">
          <h2 className="font-orbitron font-black text-2xl uppercase tracking-wider">Sussurro VOXA</h2>
          <span className="text-[10px] font-orbitron font-black text-gray-500 tracking-widest uppercase block">O que você sempre quis dizer, sem aparecer.</span>
        </div>

        <p className="text-xs text-gray-300 font-sans leading-relaxed">
          Ative sua caixa de mensagens anônimas integrada nativamente à VOXA. Com ela, você ganha um link pessoal para receber conselhos, elogios ou feedbacks sinceros de forma completamente protegida!
        </p>

        <button
          onClick={handleActivateBox}
          className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs tracking-widest uppercase px-6 py-4 rounded-2xl cursor-pointer w-full transition-all shadow-lg shadow-red-600/20"
        >
          ATIVAR MEU LINK DE SUSSURROS 👻
        </button>

        <div className="flex justify-center items-center space-x-2 text-[9px] text-gray-500 font-mono tracking-widest">
          <Shield className="w-3.5 h-3.5" />
          <span>RECEITA 100% SEGURA COM REVELAÇÃO PRIVATIVA</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn text-white">
      {/* Upper Dashboard header with Link status */}
      <div className="bg-[#0c0b16]/75 border border-white/10 p-6 sm:p-8 rounded-[32px] text-left space-y-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-white/5 pb-4 gap-4">
          <div className="space-y-1">
            <span className="text-[#FF0033] font-orbitron text-[9px] tracking-widest font-black uppercase">Seu link oficial Sussurros</span>
            <h2 className="font-orbitron font-black text-xl uppercase tracking-wider">SUSSURROS ATIVOS 👀</h2>
          </div>
          
          {/* Pause / Disable Box */}
          <div className="flex items-center space-x-2 self-start sm:self-auto bg-black/40 border border-white/5 px-3 py-1.5 rounded-xl">
            <span className="text-[9px] font-orbitron font-bold text-gray-500 uppercase tracking-widest">Caixa ativa:</span>
            <input 
              type="checkbox" 
              checked={boxEnabled} 
              onChange={(e) => handleToggleBox(e.target.checked)}
              className="w-4 h-4 text-[#FF0033] border-gray-700 bg-zinc-950 rounded-sm focus:ring-transparent cursor-pointer accent-[#FF0033]"
            />
          </div>
        </div>

        {/* Share card tools */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Link box */}
          <div className="space-y-2">
            <span className="text-[9px] font-orbitron font-black text-gray-500 uppercase tracking-widest block">Link de Divulgação</span>
            <div className="flex bg-black/50 border border-white/10 rounded-xl overflow-hidden font-mono text-xs">
              <input 
                type="text" 
                value={publicLink} 
                readOnly 
                className="bg-transparent text-gray-300 px-4 py-3 flex-1 select-all outline-none font-medium truncate"
              />
              <button 
                onClick={handleCopyLink}
                className="bg-white/5 hover:bg-white/10 border-l border-white/10 px-4 flex items-center text-white cursor-pointer transition-colors"
                title="Copiar Link"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick actions grid */}
          <div className="space-y-2">
            <span className="text-[9px] font-orbitron font-black text-gray-500 uppercase tracking-widest block">Compartilhar meu link</span>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => handleGenerateShareCard('request')}
                className="bg-gradient-to-tr from-purple-600/20 to-pink-600/20 hover:from-purple-600/30 hover:to-pink-600/30 border border-purple-500/20 text-white font-orbitron font-black text-[9px] py-2 px-1 rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center space-y-1"
              >
                <Share2 className="w-4 h-4 text-pink-400" />
                <span>INSTAGRAM</span>
              </button>
              <button 
                onClick={handleShareWhatsApp}
                className="bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 text-white font-orbitron font-black text-[9px] py-2 px-1 rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center space-y-1"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>WHATSAPP</span>
              </button>
              <button 
                onClick={async () => {
                  // Internal Story Vox posting
                  setPostingStory(true);
                  try {
                    const postRef = doc(collection(db, "posts"));
                    await setDoc(postRef, {
                      id: postRef.id,
                      userId: currentUser.uid,
                      userName: currentUser.name,
                      userPhoto: currentUser.photoURL || currentUser.avatarUrl || "",
                      content: `👀 ME MANDA UM SUSSURRO ANÔNIMO!\n\nEnvie uma mensagem, elogio ou conselho que você sempre quis me dizer sem se revelar. Acesse meu link 100% seguro: ${publicLink}`,
                      likesCount: 0,
                      likesList: [],
                      createdAt: new Date().toISOString(),
                      type: 'sussurro_request'
                    });
                    triggerToast("🔥 Divulgado no Story/Feed da VOXA!");
                  } catch (err) {
                    console.error("Vox request story error:", err);
                  } finally {
                    setPostingStory(false);
                  }
                }}
                className="bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 text-white font-orbitron font-black text-[9px] py-2 px-1 rounded-xl transition-all cursor-pointer flex flex-col items-center justify-center space-y-1"
              >
                <Ghost className="w-4 h-4 text-[#FF0033]" />
                <span>STORY VOXA</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Received Sussurros List */}
      <div className="space-y-4 text-left">
        <div>
          <h3 className="font-orbitron font-black text-sm text-white uppercase tracking-wider flex items-center gap-2">
            <Ghost className="w-4 h-4 text-[#FF0033]" />
            <span>Sua Caixa de Entrada ({messages.length})</span>
            {messages.filter(m => m.status === 'UNREAD').length > 0 && (
              <span className="bg-[#FF0033] text-white text-[9px] font-mono px-2 py-0.5 rounded-full font-black animate-pulse">
                {messages.filter(m => m.status === 'UNREAD').length} NOVO{messages.filter(m => m.status === 'UNREAD').length > 1 ? 'S' : ''}
              </span>
            )}
          </h3>
          <p className="text-[10px] text-gray-500 font-mono uppercase mt-0.5">Clique no Sussurro para abrir e responder</p>
        </div>

        {messagesLoading ? (
          <div className="py-12 text-center bg-[#0c0b16] border border-white/5 rounded-3xl">
            <div className="w-8 h-8 border-2 border-[#FF0033] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-xs font-orbitron text-gray-500 uppercase tracking-widest">Sincronizando sussurros recebidos...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-20 text-center bg-[#0c0b16] border border-white/5 rounded-[24px] space-y-4">
            <span className="text-4xl block">👻</span>
            <p className="font-orbitron text-gray-500 text-xs font-bold uppercase tracking-widest">Sua caixa de entrada está limpa.</p>
            <p className="text-[10px] text-gray-600 font-sans max-w-xs mx-auto">Divulgue seu link no Story do Instagram ou no WhatsApp para começar a receber sussurros!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                onClick={() => handleMarkAsRead(msg)}
                className={`bg-[#0d0d16] border border-white/10 p-5 rounded-[24px] space-y-4 hover:border-white/20 transition-all flex flex-col justify-between group relative ${msg.status === 'UNREAD' ? 'ring-1 ring-[#FF0033]/40' : ''}`}
              >
                {/* Header info */}
                <div className="flex justify-between items-center">
                  <span className={`text-[9px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full ${getBadgeStyle(msg.status)}`}>
                    {getStatusLabel(msg.status)}
                  </span>
                  
                  <span className="text-[9px] text-gray-600 font-mono">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Hoje'}
                  </span>
                </div>

                {/* Content */}
                <p className="text-gray-200 text-sm font-sans leading-relaxed select-all py-1 break-words">
                  {msg.text}
                </p>

                {/* Divider */}
                <div className="border-t border-white/5 my-1" />

                {/* Foot actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5">
                  <div className="flex gap-2">
                    {/* Responder button */}
                    <button 
                      onClick={() => { setActiveMessage(msg); setAnswerText(''); setIsAnswerModalOpen(true); }}
                      className="text-[10px] font-orbitron font-extrabold text-white bg-white/5 border border-white/10 hover:bg-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-red-500" />
                      <span>RESPONDER</span>
                    </button>

                    {/* Excluir button */}
                    <button 
                      onClick={() => handleDeleteSussurro(msg.id)}
                      className="text-gray-500 hover:text-red-500 p-1.5 rounded-xl hover:bg-red-500/5 cursor-pointer transition-colors"
                      title="Excluir sussurro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    
                    {/* Denunciar button */}
                    <button 
                      onClick={() => { setActiveMessage(msg); setReportDetails(''); setIsReportModalOpen(true); }}
                      className="text-gray-600 hover:text-amber-500 p-1.5 rounded-xl hover:bg-amber-500/5 cursor-pointer transition-colors"
                      title="Denunciar sussurro"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Reveal block action */}
                  {msg.revealAllowed && !msg.revealed && (
                    <button 
                      onClick={() => handleOpenReveal(msg)}
                      className="text-[10px] font-orbitron font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 px-3.5 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition-all uppercase tracking-wider"
                    >
                      <Lock className="w-3 h-3 text-amber-500 animate-pulse" />
                      <span>REVELAR — {formatBRL(revealPrice)}</span>
                    </button>
                  )}

                  {msg.revealed && (
                    <span className="text-[10px] font-orbitron font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-xl uppercase tracking-wider">
                      🔓 Revelado!
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 1. MODAL: REVEAL SENDER IDENTITY */}
      {isRevealModalOpen && activeMessage && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="max-w-md w-full bg-[#0c0b16] border border-white/10 rounded-[32px] p-6 sm:p-8 space-y-6 text-left relative text-white shadow-2xl">
            <button 
              onClick={() => { setIsRevealModalOpen(false); setPixPollingActive(false); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[#FF0033] font-orbitron font-black text-[9px] tracking-widest block uppercase">Desbloqueio de Identidade</span>
              <h3 className="text-lg font-orbitron font-black uppercase tracking-wide">QUEM TE ENVIOU ISSO? 👀</h3>
            </div>

            {/* Question preview inside card */}
            <div className="bg-white/3 border border-white/5 p-4 rounded-2xl">
              <span className="text-[9px] font-mono text-gray-500 block uppercase mb-1">Mensagem:</span>
              <p className="text-gray-200 text-xs italic">“{activeMessage.text}”</p>
            </div>

            {revealedProfile ? (
              // Success Revealed block
              <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-2xl text-center space-y-4 animate-fadeIn">
                <span className="text-[10px] font-orbitron font-black text-emerald-400 uppercase tracking-widest block">IDENTIDADE CONFIRMADA</span>
                
                {/* Profile block */}
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-emerald-500 ring-2 ring-black">
                    {revealedProfile.photoURL ? (
                      <img src={revealedProfile.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 text-white font-orbitron font-black text-xl flex items-center justify-center">
                        {revealedProfile.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-orbitron font-black text-white uppercase text-base">{revealedProfile.name}</h4>
                    <span className="text-xs text-gray-500 font-mono">@{revealedProfile.username}</span>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setIsRevealModalOpen(false);
                    // visit profile!
                    setActiveTab('profile');
                    window.history.pushState(null, '', `/u/${revealedProfile.username}`);
                  }}
                  className="bg-white hover:bg-neutral-200 text-black font-orbitron font-bold text-[10px] tracking-wider uppercase px-4 py-2.5 rounded-xl cursor-pointer w-full transition-all"
                >
                  Visitar Perfil da Pessoa
                </button>
              </div>
            ) : pixPaymentData ? (
              // PIX QR Code state
              <div className="bg-black/50 border border-white/5 p-5 rounded-2xl text-center space-y-5 animate-fadeIn">
                <div className="flex flex-col items-center space-y-1">
                  <QrCode className="w-6 h-6 text-sky-400 animate-pulse" />
                  <span className="text-[10px] font-orbitron font-black text-sky-400 uppercase tracking-widest block">PIX Mercado Pago Gerado</span>
                  <p className="text-[11px] text-gray-300 font-sans">Aguardando confirmação de pagamento do PIX de R$ {revealPrice.toFixed(2)}...</p>
                </div>

                {/* QR Code image */}
                <div className="bg-white p-3 rounded-2xl w-40 h-44 mx-auto flex items-center justify-center shadow-lg">
                  {pixPaymentData.qrCodeBase64 && pixPaymentData.qrCodeBase64 !== "MOCK_QR_BASE64" ? (
                    <img src={`data:image/png;base64,${pixPaymentData.qrCodeBase64}`} alt="PIX QR" className="w-full h-auto" />
                  ) : pixPaymentData.qrCode ? (
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&color=000000&data=${encodeURIComponent(pixPaymentData.qrCode)}`} alt="PIX QR" className="w-full h-auto" />
                  ) : (
                    <QrCode className="w-12 h-12 text-gray-400" />
                  )}
                </div>

                {/* PIX Copy string */}
                <div className="space-y-1 text-left">
                  <span className="text-[8px] font-orbitron font-black text-gray-500 block uppercase">Código Copia e Cola</span>
                  <div className="flex rounded-xl overflow-hidden bg-black/60 border border-white/10 text-[10px]">
                    <input 
                      type="text" 
                      value={pixPaymentData.qrCode} 
                      readOnly 
                      className="bg-transparent text-gray-400 font-mono px-3 py-2 flex-1 outline-none truncate"
                    />
                    <button 
                      onClick={() => { navigator.clipboard.writeText(pixPaymentData.qrCode); triggerToast("📋 Código copiado!"); }}
                      className="bg-white/5 hover:bg-white/10 px-3 flex items-center text-white border-l border-white/10 cursor-pointer"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1.5 text-[9px] text-[#FF0033] font-orbitron font-black uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 bg-[#FF0033] rounded-full animate-ping"></div>
                  <span>AGUARDANDO WEBHOOK DO MERCADO PAGO...</span>
                </div>
              </div>
            ) : (
              // Initial Options block (Wallet vs Pix)
              <div className="space-y-5 animate-fadeIn">
                <p className="text-xs text-gray-300 font-sans leading-relaxed">
                  O autor concordou conscientemente em poder revelar o perfil mediante o pagamento da taxa da plataforma. Escolha seu método de pagamento para liberar o nome e avatar real da pessoa na hora!
                </p>

                {checkingBalance ? (
                  <div className="py-4 text-center">
                    <RefreshCw className="w-5 h-5 text-amber-500 animate-spin mx-auto" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {/* 1. Wallet Balance Pay */}
                    <div className="bg-[#12111d] border border-white/10 hover:border-amber-500/50 rounded-2xl p-4 flex flex-col justify-between transition-all">
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <span className="text-xs font-orbitron font-extrabold text-white uppercase tracking-wider block">Saldo da Carteira VOXA 💰</span>
                          <span className="text-[10px] text-gray-500 font-sans block">Seu saldo atual: {formatBRL(userBalance / 100)}</span>
                        </div>
                        <span className="text-xs font-bold text-amber-500 font-mono">{formatBRL(revealPrice)}</span>
                      </div>

                      {userBalance >= (revealPrice * 100) ? (
                        <button
                          onClick={handleRevealWithWallet}
                          disabled={revealingByWallet}
                          className="mt-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-orbitron font-black text-[10px] tracking-widest uppercase py-2.5 rounded-xl cursor-pointer transition-all"
                        >
                          {revealingByWallet ? "PROCESSANDO DÉBITO..." : "REVELAR COM SALDO"}
                        </button>
                      ) : (
                        <span className="mt-3 text-[9px] font-orbitron font-bold text-red-500 uppercase tracking-widest bg-red-500/5 py-1.5 rounded-lg text-center block border border-red-500/10">
                          Saldo insuficiente na Carteira
                        </span>
                      )}
                    </div>

                    {/* 2. Mercado Pago PIX Pay */}
                    <div className="bg-[#12111d] border border-white/10 hover:border-sky-500/50 rounded-2xl p-4 flex flex-col justify-between transition-all">
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <span className="text-xs font-orbitron font-extrabold text-white uppercase tracking-wider block">Pagar via PIX Direto ⚡</span>
                          <span className="text-[10px] text-gray-500 font-sans block">Mercado Pago integrado com QR Code instantâneo</span>
                        </div>
                        <span className="text-xs font-bold text-sky-400 font-mono">{formatBRL(revealPrice)}</span>
                      </div>

                      <button
                        onClick={handleRevealWithPix}
                        disabled={creatingPix}
                        className="mt-3.5 bg-sky-400 hover:bg-sky-500 disabled:opacity-50 text-black font-orbitron font-black text-[10px] tracking-widest uppercase py-2.5 rounded-xl cursor-pointer transition-all"
                      >
                        {creatingPix ? "GERANDO QR CODE..." : "GERAR PIX DIRETO"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. MODAL: ANSWER SUSSURRO WITH STORIES */}
      {isAnswerModalOpen && activeMessage && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="max-w-md w-full bg-[#0c0b16] border border-white/10 rounded-[32px] p-6 sm:p-8 space-y-6 text-left relative text-white shadow-2xl">
            <button 
              onClick={() => setIsAnswerModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[#FF0033] font-orbitron font-black text-[9px] tracking-widest block uppercase">Resposta de Pergunta Anônima</span>
              <h3 className="text-lg font-orbitron font-black uppercase tracking-wide">RESPONDER NO STORY 💬</h3>
            </div>

            {/* Question card */}
            <div className="bg-white/3 border border-white/5 p-4 rounded-2xl relative">
              <span className="text-[9px] font-orbitron font-bold text-[#FF0033] block uppercase mb-1">Mensagem Recebida</span>
              <p className="text-gray-200 text-xs italic">“{activeMessage.text}”</p>
            </div>

            {/* Answer input */}
            <div className="space-y-1.5 text-left">
              <label className="text-[9px] font-orbitron font-black text-gray-400 uppercase tracking-widest">Sua Resposta</label>
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value.substring(0, 150))}
                placeholder="Escreva sua resposta de forma amigável e divertida..."
                rows={3}
                maxLength={150}
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 font-sans text-xs text-white focus:outline-none focus:border-[#FF0033] placeholder-gray-600 resize-none transition-all leading-relaxed"
                required
              />
              <div className="text-right">
                <span className="text-[9px] font-mono text-gray-600">{answerText.length}/150</span>
              </div>
            </div>

            {/* Options grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Story VOXA */}
              <button
                onClick={handlePostStoryOnVoxa}
                disabled={postingStory || !answerText.trim()}
                className="bg-[#FF0033] hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-orbitron font-black text-[10px] tracking-widest uppercase py-3 px-4 rounded-2xl cursor-pointer transition-all flex items-center justify-center space-x-2"
              >
                <Ghost className="w-4 h-4 shrink-0" />
                <span>POSTAR STORY VOXA</span>
              </button>

              {/* Option B: Generate Card for Instagram */}
              <button
                onClick={() => handleGenerateShareCard('answer', activeMessage.text, answerText)}
                disabled={!answerText.trim()}
                className="bg-gradient-to-tr from-purple-600/30 to-pink-600/30 hover:from-purple-600/40 hover:to-pink-600/40 border border-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-white font-orbitron font-black text-[10px] tracking-widest uppercase py-3 px-4 rounded-2xl cursor-pointer transition-all flex items-center justify-center space-x-2"
              >
                <Share2 className="w-4 h-4 shrink-0 text-pink-400" />
                <span>INSTAGRAM STORY</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL: REPORT INAPPROPRIATE MESSAGE */}
      {isReportModalOpen && activeMessage && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="max-w-md w-full bg-[#0c0b16] border border-white/10 rounded-[32px] p-6 sm:p-8 space-y-6 text-left relative text-white shadow-2xl">
            <button 
              onClick={() => setIsReportModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-[#FF0033] font-orbitron font-black text-[9px] tracking-widest block uppercase">Denúncia de Abuso / Assédio</span>
              <h3 className="text-lg font-orbitron font-black uppercase tracking-wide">DENUNCIAR MENSAGEM 🛡️</h3>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[9px] font-orbitron font-black text-gray-400 uppercase tracking-widest">Categoria da Infração</label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 font-sans text-xs text-white focus:outline-none"
                >
                  <option value="assédio">Assédio ou Bullying</option>
                  <option value="ameaça">Ameaça ou Coação</option>
                  <option value="discurso de ódio">Discurso de Ódio</option>
                  <option value="sexual">Conteúdo Sexual Explícito</option>
                  <option value="spam">Spam / Links Suspeitos</option>
                  <option value="golpe">Golpe ou Fraude</option>
                  <option value="bullying">Cyberbullying</option>
                  <option value="outro">Outro Motivo</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-orbitron font-black text-gray-400 uppercase tracking-widest">Detalhes do Abuso</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Forneça mais informações sobre o assédio ou infração para ajudar na moderação..."
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 font-sans text-xs text-white focus:outline-none placeholder-gray-600 resize-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={submittingReport}
                className="w-full bg-[#FF0033] hover:bg-red-700 disabled:opacity-40 text-white font-orbitron font-black text-xs py-4 px-6 rounded-2xl transition-all cursor-pointer flex items-center justify-center space-x-2 tracking-widest uppercase"
              >
                {submittingReport ? "ENVANDO DENÚNCIA..." : "ENVIAR DENÚNCIA PARA MODERAÇÃO"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
