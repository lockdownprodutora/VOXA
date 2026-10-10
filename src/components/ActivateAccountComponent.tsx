import React, { useState, useEffect } from 'react';
import { Sparkles, AlertCircle, CheckCircle, ShieldCheck, Mail, Lock, Calendar, Check } from 'lucide-react';
import { auth, signInWithEmailAndPassword } from '../lib/firebase';

interface ActivateAccountComponentProps {
  triggerToast: (msg: string) => void;
  setActiveTab?: (tab: string) => void;
}

export const ActivateAccountComponent: React.FC<ActivateAccountComponentProps> = ({ 
  triggerToast,
  setActiveTab 
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<{
    profileId: string;
    name?: string;
    username?: string;
    photoURL?: string;
    email?: string;
  } | null>(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dob, setDob] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    setToken(tokenParam);

    if (!tokenParam) {
      setErrorMsg("Link de ativação inválido. O token de convite está ausente.");
      setLoading(false);
      return;
    }

    // Verify token on backend
    fetch('/api/activation/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenParam })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setProfileData(data);
          setEmail(data.email || '');
        } else {
          setErrorMsg(data.error || "Ocorreu um erro ao validar seu link de ativação.");
        }
      })
      .catch(err => {
        console.error("Token verification error:", err);
        setErrorMsg("Erro de conexão ao validar o token de convite.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleActivationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !profileData) return;

    if (!email.trim() || !email.includes('@')) {
      triggerToast("Por favor, informe um endereço de e-mail válido.");
      return;
    }

    if (password.length < 6) {
      triggerToast("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      triggerToast("As senhas informadas não coincidem.");
      return;
    }

    if (!agreeTerms || !agreePrivacy) {
      triggerToast("Você precisa aceitar os Termos de Uso e a Política de Privacidade para prosseguir.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/complete-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email: email.trim().toLowerCase(),
          password
        })
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        setIsCompleted(true);
        triggerToast("Acesso ativado com sucesso! Autenticando...");

        // Auto sign in user on the client side
        try {
          await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
        } catch (signInErr: any) {
          console.error("Auto sign in failed:", signInErr);
          // If auto sign-in fails (e.g. cold start/delay), redirect to login
          triggerToast("Conta criada! Por favor, realize o login.");
          setTimeout(() => {
            window.location.href = '/';
          }, 2500);
        }
      } else {
        triggerToast(resData.error || "Falha ao concluir a ativação de sua conta.");
      }
    } catch (err: any) {
      console.error("Activation completion error:", err);
      triggerToast("Erro de rede ao processar ativação de acesso.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans selection:bg-[#FF0033] selection:text-white">
      {/* Background futuristic tech grid overlays */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,0,51,0.08),transparent_70%)] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FF0033]/30 to-transparent pointer-events-none" />
      
      <div className="max-w-md w-full space-y-8 z-10">
        
        {/* LOGO BRANDING HEADER */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-full bg-gradient-to-tr from-[#FF0033]/20 via-black to-black border border-white/10 shadow-lg shadow-[#FF0033]/5 mb-2 hover:scale-105 duration-200">
            <Sparkles className="w-8 h-8 text-[#FF0033]" />
          </div>
          <h2 className="font-orbitron font-black text-4xl tracking-widest text-white uppercase">VOXA</h2>
          <p className="font-orbitron font-extrabold text-[10px] text-[#FF0033] tracking-widest uppercase">UMA NOVA DIMENSÃO SOCIAL</p>
        </div>

        {loading ? (
          <div className="bg-[#0c0b16]/80 border border-white/10 rounded-[32px] p-8 text-center space-y-4 shadow-2xl backdrop-blur-xl">
            <div className="w-12 h-12 border-2 border-t-[#FF0033] border-r-transparent border-b-[#FF0033] border-l-transparent rounded-full animate-spin mx-auto" />
            <p className="font-orbitron text-xs font-black text-gray-400 tracking-wider uppercase">Validando convite de ativação...</p>
          </div>
        ) : errorMsg ? (
          <div className="bg-[#0c0b16]/80 border border-red-500/20 rounded-[32px] p-8 text-center space-y-6 shadow-2xl backdrop-blur-xl">
            <div className="inline-flex p-3 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 mb-1">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-orbitron font-extrabold text-sm text-white uppercase tracking-wider">Falha na Ativação</h3>
              <p className="text-xs text-gray-400 leading-relaxed font-sans">{errorMsg}</p>
            </div>
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full bg-[#1b1928] hover:bg-zinc-800 text-white font-orbitron font-black text-[10px] py-3.5 rounded-xl border border-white/5 transition-all uppercase tracking-widest cursor-pointer"
            >
              Voltar ao Início
            </button>
          </div>
        ) : isCompleted ? (
          <div className="bg-[#0c0b16]/80 border border-emerald-500/20 rounded-[32px] p-8 text-center space-y-6 shadow-2xl backdrop-blur-xl">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 mb-1 animate-pulse">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="font-orbitron font-extrabold text-sm text-white uppercase tracking-wider">Acesso Liberado!</h3>
              <p className="text-xs text-gray-400 leading-relaxed font-sans">Seu perfil foi ativado com sucesso. Você está sendo redirecionado para a plataforma principal...</p>
            </div>
            <div className="w-8 h-[2px] bg-emerald-500/30 rounded-full animate-pulse mx-auto" />
          </div>
        ) : (
          <div className="bg-[#0c0b16]/75 border border-white/10 rounded-[32px] p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-xl">
            
            {/* WELCOME BANNER FOR THE RESERVED USER */}
            <div className="p-4 bg-gradient-to-tr from-[#FF0033]/10 to-[#0c0b16] rounded-2xl border border-white/5 space-y-3 text-center relative overflow-hidden flex flex-col items-center">
              <span className="block text-[9px] font-orbitron font-extrabold text-[#FF0033] tracking-widest uppercase">CONVITE EXCLUSIVO</span>
              
              {/* Profile image with fallback VOXA branding */}
              <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-[#FF0033] to-[#0c0b16] ring-1 ring-white/10 flex items-center justify-center overflow-hidden bg-zinc-950">
                {profileData?.photoURL ? (
                  <img src={profileData.photoURL} alt="" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <div className="w-full h-full bg-[#12111d] flex items-center justify-center text-white font-orbitron font-black text-lg">
                    {profileData?.name ? profileData.name.charAt(0).toUpperCase() : 'V'}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-orbitron font-black text-lg text-white uppercase truncate">
                  {profileData?.name || "Sem Nome"}
                </h3>
                <span className="block text-[10px] text-gray-400 font-mono">
                  @{profileData?.username || "user"}
                </span>
              </div>

              <p className="text-[10px] text-gray-500 font-sans leading-relaxed max-w-[250px]">
                Este perfil foi reservado para você. Defina suas credenciais abaixo para assumir sua conta.
              </p>
            </div>

            <form onSubmit={handleActivationSubmit} className="space-y-4">
              
              {/* EMAIL FIELD */}
              <div className="space-y-1 text-left">
                <label className="block text-[9px] font-orbitron font-extrabold text-gray-400 uppercase tracking-widest">Endereço de E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ex: seu-nome@provedor.com" 
                    className="w-full bg-black/45 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-xs text-white focus:border-[#FF0033] focus:outline-none placeholder-gray-600 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* PASSWORD FIELD */}
              <div className="space-y-1 text-left">
                <label className="block text-[9px] font-orbitron font-extrabold text-gray-400 uppercase tracking-widest">Criar uma Senha Forte</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres" 
                    className="w-full bg-black/45 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-xs text-white focus:border-[#FF0033] focus:outline-none placeholder-gray-600 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* CONFIRM PASSWORD FIELD */}
              <div className="space-y-1 text-left">
                <label className="block text-[9px] font-orbitron font-extrabold text-gray-400 uppercase tracking-widest">Confirmar Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha criada" 
                    className="w-full bg-black/45 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-xs text-white focus:border-[#FF0033] focus:outline-none placeholder-gray-600 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* OPTIONAL DATE OF BIRTH */}
              <div className="space-y-1 text-left">
                <label className="block text-[9px] font-orbitron font-extrabold text-gray-400 uppercase tracking-widest">Data de Nascimento (Opcional)</label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="date" 
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full bg-black/45 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-xs text-white focus:border-[#FF0033] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* LEGAL CHECKBOXES */}
              <div className="space-y-3 pt-2 text-left">
                
                {/* Terms of Use */}
                <label className="flex items-start space-x-3 cursor-pointer group select-none">
                  <button
                    type="button"
                    onClick={() => setAgreeTerms(!agreeTerms)}
                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                      agreeTerms ? 'bg-[#FF0033] border-[#FF0033]' : 'border-white/10 bg-black/50 group-hover:border-[#FF0033]'
                    }`}
                  >
                    {agreeTerms && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className="text-[10px] text-gray-400 leading-tight">
                    Eu li e concordo com os <a href="/termos" target="_blank" className="text-[#FF0033] hover:underline">Termos de Uso</a> da plataforma VOXA.
                  </span>
                </label>

                {/* Privacy Policy */}
                <label className="flex items-start space-x-3 cursor-pointer group select-none">
                  <button
                    type="button"
                    onClick={() => setAgreePrivacy(!agreePrivacy)}
                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                      agreePrivacy ? 'bg-[#FF0033] border-[#FF0033]' : 'border-white/10 bg-black/50 group-hover:border-[#FF0033]'
                    }`}
                  >
                    {agreePrivacy && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className="text-[10px] text-gray-400 leading-tight">
                    Eu li e aceito as condições da <a href="/privacidade" target="_blank" className="text-[#FF0033] hover:underline">Política de Privacidade</a> de dados.
                  </span>
                </label>

              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-[#FF0033] to-[#d6002b] hover:from-[#d6002b] hover:to-[#a80020] disabled:opacity-50 disabled:cursor-not-allowed text-white font-orbitron font-extrabold text-[10px] py-4 rounded-xl border border-white/5 transition-all uppercase tracking-widest shadow-lg shadow-red-600/10 cursor-pointer flex items-center justify-center space-x-2 mt-4"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>ATIVANDO CONTA...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>REIVINDICAR PERFIL</span>
                  </>
                )}
              </button>

            </form>
          </div>
        )}

      </div>
    </div>
  );
};
