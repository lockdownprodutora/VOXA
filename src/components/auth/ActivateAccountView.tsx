import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Key, Lock, Mail, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, Loader2, Sparkles, ShieldAlert 
} from 'lucide-react';
import { auth, signInWithEmailAndPassword } from '../../lib/firebase';

interface ActivateAccountViewProps {
  setActiveTab: (tab: string) => void;
}

export const ActivateAccountView: React.FC<ActivateAccountViewProps> = ({ setActiveTab }) => {
  const [token, setToken] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(true);
  const [validationError, setValidationError] = useState<string>('');
  const [profileData, setProfileData] = useState<{ profileId: string; profileName: string; email: string } | null>(null);

  // Form states
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Parse token from search params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenVal = params.get('token') || '';
    setToken(tokenVal);

    if (!tokenVal) {
      setValidationError('O token de ativação não foi fornecido ou é inválido.');
      setIsValidating(false);
      return;
    }

    // Verify token with backend
    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/auth/verify-activation-token?token=${encodeURIComponent(tokenVal)}`);
        const result = await response.json();

        if (result.success) {
          setProfileData({
            profileId: result.profileId,
            profileName: result.profileName,
            email: result.email || ''
          });
          setEmail(result.email || '');
        } else {
          setValidationError(result.error || 'Este convite de ativação é inválido ou expirou.');
        }
      } catch (err) {
        console.error("Token verification error:", err);
        setValidationError('Não foi possível conectar ao servidor para validar seu convite. Verifique sua conexão.');
      } finally {
        setIsValidating(false);
      }
    };

    verifyToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!email.trim()) {
      setSubmitError('O endereço de e-mail é obrigatório.');
      return;
    }

    if (password.length < 6) {
      setSubmitError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('As senhas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/complete-activation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          email: email.trim(),
          password
        })
      });

      const result = await response.json();

      if (result.success) {
        setIsSuccess(true);
        // Automatic login
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password);
          setTimeout(() => {
            setActiveTab('dashboard');
            window.location.href = '/dashboard';
          }, 3000);
        } catch (loginErr) {
          console.warn("Auto-login post-activation failed:", loginErr);
          // If auto login fails, redirect to home to let them login manually
          setTimeout(() => {
            setActiveTab('home');
            window.location.href = '/';
          }, 4000);
        }
      } else {
        setSubmitError(result.error || 'Ocorreu um erro ao concluir a ativação de sua conta.');
      }
    } catch (err) {
      console.error("Activation submission error:", err);
      setSubmitError('Não foi possível processar a ativação da conta. Tente novamente mais tarde.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div id="activation-loading" className="min-h-[80vh] flex flex-col items-center justify-center bg-gray-50 px-4 py-16">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-[#FF0033] animate-spin mx-auto" />
          <h2 className="font-orbitron font-bold text-lg text-black tracking-wider uppercase">Validando link de ativação...</h2>
          <p className="text-gray-500 text-xs">Por favor, aguarde enquanto verificamos as credenciais de convite.</p>
        </div>
      </div>
    );
  }

  if (validationError) {
    return (
      <div id="activation-invalid" className="min-h-[80vh] flex flex-col items-center justify-center bg-gray-50 px-4 py-16">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl border border-gray-200 shadow-sm text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-[#FF0033] mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h2 className="font-orbitron font-black text-xl text-black tracking-wider uppercase">CONVITE INVÁLIDO</h2>
            <p className="text-gray-600 text-xs leading-relaxed">{validationError}</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-left">
            <p className="text-[10px] font-orbitron font-bold text-amber-800 uppercase">INFORMAÇÕES DE SUPORTE</p>
            <p className="text-gray-600 text-[10px] mt-1 leading-relaxed">
              Links de ativação expiram após 48 horas de sua criação ou após o primeiro uso. Entre em contato com os administradores do VOXA para obter um novo convite de acesso.
            </p>
          </div>

          <button
            onClick={() => {
              setActiveTab('home');
              window.location.href = '/';
            }}
            className="w-full bg-black hover:bg-gray-800 text-white font-orbitron font-bold text-xs py-3 rounded-2xl cursor-pointer transition-all uppercase tracking-wider"
          >
            Voltar ao Início
          </button>
        </motion.div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div id="activation-success" className="min-h-[80vh] flex flex-col items-center justify-center bg-gray-50 px-4 py-16">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl border border-emerald-200 shadow-sm text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mx-auto">
            <CheckCircle2 className="w-8 h-8 animate-bounce" />
          </div>

          <div className="space-y-2">
            <h2 className="font-orbitron font-black text-xl text-black tracking-wider uppercase">CONTA ATIVADA!</h2>
            <p className="text-gray-600 text-xs">
              Sua conta e acesso foram vinculados com sucesso ao perfil central <strong className="text-black font-semibold">"{profileData?.profileName}"</strong>.
            </p>
          </div>

          <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center justify-center space-x-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <p className="text-emerald-800 font-orbitron font-bold text-[10px] uppercase">
              Direcionando você para o Painel...
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div id="activation-form" className="min-h-[80vh] flex flex-col items-center justify-center bg-gray-50 px-4 py-16">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6"
      >
        <div className="space-y-2 text-center">
          <span className="bg-red-50 text-[#FF0033] font-orbitron font-bold text-[10px] px-3 py-1 rounded-full border border-red-200 uppercase tracking-wider">
            Ativação de Convite
          </span>
          <h2 className="font-orbitron font-black text-2xl text-black uppercase mt-2">CRIAR SEU ACESSO</h2>
          <p className="text-gray-500 text-xs">
            Olá, <strong className="text-black font-semibold">{profileData?.profileName}</strong>! Defina seu e-mail e senha para acessar o painel integrado do VOXA.
          </p>
        </div>

        {submitError && (
          <div className="bg-red-50 border border-red-200 p-3.5 rounded-2xl flex items-center space-x-2.5 text-[#FF0033]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-xs font-semibold leading-snug">{submitError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-orbitron font-bold text-gray-500 block uppercase">E-mail de Acesso</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@exemplo.com"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-xs focus:bg-white focus:ring-1 focus:ring-black outline-none transition-all font-sans"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-orbitron font-bold text-gray-500 block uppercase">Escolha sua Senha</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-xs focus:bg-white focus:ring-1 focus:ring-black outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-orbitron font-bold text-gray-500 block uppercase">Confirme a Senha</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha escolhida"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-xs focus:bg-white focus:ring-1 focus:ring-black outline-none transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs py-3.5 rounded-2xl cursor-pointer transition-all flex items-center justify-center space-x-2 shadow-md uppercase tracking-wider"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processando ativação...</span>
              </>
            ) : (
              <>
                <span>Ativar Conta & Conectar</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center">
          <p className="text-[10px] text-gray-400 font-sans">
            Seu perfil já possui cadastro unificado no banco do VOXA. A ativação apenas define suas credenciais de login individuais com total segurança.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
