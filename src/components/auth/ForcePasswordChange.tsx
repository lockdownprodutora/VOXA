import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { updatePassword } from 'firebase/auth';

interface ForcePasswordChangeProps {
  currentUser: { uid?: string; name: string; email: string; role?: string; isAdmin?: boolean; photoURL?: string; mustChangePassword?: boolean };
  onPasswordChanged: () => void;
}

export const ForcePasswordChange: React.FC<ForcePasswordChangeProps> = ({ currentUser, onPasswordChanged }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (password.length < 6) {
      setErrorMsg('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('As senhas não coincidem. Digite o mesmo valor em ambos os campos.');
      return;
    }

    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Usuário não autenticado no Firebase Auth.');
      }

      // Update password in Firebase Auth
      await updatePassword(user, password);

      // Call backend to clear the mustChangePassword flag in Firestore
      const token = await user.getIdToken();
      const response = await fetch('/api/auth/clear-must-change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Não foi possível atualizar o status da senha no servidor.');
      }

      setSuccessMsg('Sua senha foi atualizada com sucesso! Acessando o painel...');
      setTimeout(() => {
        onPasswordChanged();
      }, 2000);
    } catch (err: any) {
      console.error("Failed to force update password:", err);
      if (err.code === 'auth/requires-recent-login') {
        setErrorMsg('Para maior segurança, faça logout e faça login novamente para trocar a senha.');
      } else {
        setErrorMsg(err.message || 'Erro inesperado ao atualizar sua senha.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white text-black max-w-md w-full p-8 rounded-3xl border border-gray-200 shadow-2xl space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-red-50 text-[#FF0033] rounded-2xl flex items-center justify-center mx-auto border border-red-100">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>
          <span className="bg-amber-50 text-amber-800 font-orbitron font-bold text-[9px] px-2.5 py-1 rounded-full border border-amber-200 uppercase tracking-widest inline-block">
            Senha Temporária Detectada
          </span>
          <h2 className="font-orbitron font-black text-xl text-black uppercase">ALTERAÇÃO OBRIGATÓRIA</h2>
          <p className="text-gray-500 text-xs leading-relaxed">
            Olá, <strong className="text-black">{currentUser.name}</strong>. Para garantir a segurança de seus dados no VOXA, você deve definir uma nova senha pessoal antes de acessar o painel.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs flex items-start space-x-2.5 font-sans leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-[#FF0033] shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl text-xs flex items-center space-x-2.5 font-sans">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-orbitron font-bold text-gray-500 block uppercase">Nova Senha Pessoal</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="No mínimo 6 caracteres"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-4 pr-10 py-3 text-xs focus:bg-white focus:ring-1 focus:ring-black outline-none transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-orbitron font-bold text-gray-500 block uppercase">Confirme a Nova Senha</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Digite a senha novamente"
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs focus:bg-white focus:ring-1 focus:ring-black outline-none transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-black hover:bg-gray-800 text-white font-orbitron font-bold text-xs py-3.5 rounded-2xl cursor-pointer transition-all flex items-center justify-center space-x-2 uppercase tracking-wider"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Atualizando senha...</span>
              </>
            ) : (
              <span>Atualizar Senha & Liberar Painel</span>
            )}
          </button>
        </form>

        <div className="text-center">
          <p className="text-[10px] text-gray-400 leading-relaxed font-sans">
            Após trocar a senha, seu acesso definitivo será liberado automaticamente. Anote sua nova senha para acessos futuros.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
