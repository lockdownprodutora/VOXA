import React, { useState, useEffect } from 'react';
import { Key, Mail, User, ShieldCheck, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { updateDoc, doc, getDocs, collection } from 'firebase/firestore';

interface SettingsSectionProps {
  currentUser: {
    uid?: string;
    id?: string;
    name: string;
    email: string;
    photoURL?: string;
    categoryId?: string;
    categoryName?: string;
  };
  setCurrentUser: (user: any) => void;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ currentUser, setCurrentUser }) => {
  const [name, setName] = useState(currentUser.name || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(currentUser.categoryId || '');

  // Status/Loading States
  const [profileLoading, setProfileLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });
  const [emailMsg, setEmailMsg] = useState({ text: '', type: '' });
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' });

  const userId = currentUser.uid || currentUser.id;

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const snap = await getDocs(collection(db, 'profile_categories'));
        const list: any[] = [];
        snap.forEach(d => {
          const data = d.data();
          if (data.active) {
            list.push({ id: d.id, ...data });
          }
        });
        list.sort((a, b) => (a.order || 0) - (b.order || 0));
        setCategories(list);
      } catch (err) {
        console.error("[SettingsSection] Error loading categories:", err);
      }
    };
    loadCategories();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setProfileMsg({ text: 'O nome não pode estar vazio.', type: 'error' });
      return;
    }

    setProfileLoading(true);
    setProfileMsg({ text: '', type: '' });

    try {
      const response = await fetch('/api/user/update-profile-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userId, name: name.trim(), categoryId: selectedCategory })
      });
      const data = await response.json();
      if (data.success) {
        const updated = { 
          ...currentUser, 
          name: name.trim(),
          categoryId: data.categoryId || '',
          categoryName: data.categoryName || 'Sem categoria'
        };
        setCurrentUser(updated);
        localStorage.setItem('voxa_current_user', JSON.stringify(updated));
        setProfileMsg({ text: 'Perfil atualizado com sucesso!', type: 'success' });
      } else {
        setProfileMsg({ text: data.error || 'Erro ao atualizar dados.', type: 'error' });
      }
    } catch (err: any) {
      console.error(err);
      setProfileMsg({ text: 'Erro ao conectar ao servidor.', type: 'error' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setEmailMsg({ text: 'O e-mail não pode estar vazio.', type: 'error' });
      return;
    }

    setEmailLoading(true);
    setEmailMsg({ text: '', type: '' });

    try {
      const response = await fetch('/api/user/update-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userId, email: email.trim().toLowerCase() })
      });
      const data = await response.json();
      if (data.success) {
        const updated = { ...currentUser, email: email.trim().toLowerCase() };
        setCurrentUser(updated);
        localStorage.setItem('voxa_current_user', JSON.stringify(updated));
        setEmailMsg({ text: 'E-mail atualizado com sucesso tanto no Firebase Auth quanto no Perfil!', type: 'success' });
      } else {
        setEmailMsg({ text: data.error || 'Erro ao atualizar e-mail.', type: 'error' });
      }
    } catch (err: any) {
      console.error(err);
      setEmailMsg({ text: 'Erro ao processar alteração de e-mail.', type: 'error' });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setPasswordMsg({ text: 'A nova senha não pode estar vazia.', type: 'error' });
      return;
    }
    if (password.length < 6) {
      setPasswordMsg({ text: 'A senha deve conter no mínimo 6 caracteres.', type: 'error' });
      return;
    }
    if (password !== confirmPassword) {
      setPasswordMsg({ text: 'As senhas não coincidem.', type: 'error' });
      return;
    }

    setPasswordLoading(true);
    setPasswordMsg({ text: '', type: '' });

    try {
      const response = await fetch('/api/user/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userId, password })
      });
      const data = await response.json();
      if (data.success) {
        setPassword('');
        setConfirmPassword('');
        setPasswordMsg({ text: 'Senha alterada com sucesso! (Não armazenada no Firestore)', type: 'success' });
      } else {
        setPasswordMsg({ text: data.error || 'Erro ao redefinir senha.', type: 'error' });
      }
    } catch (err: any) {
      console.error(err);
      setPasswordMsg({ text: 'Erro de conexão.', type: 'error' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Alterar Perfil Geral */}
      <div className="bg-black/35 p-6 rounded-2xl border border-white/5 space-y-4">
        <div className="flex items-center space-x-2">
          <User className="w-5 h-5 text-white" />
          <h4 className="font-orbitron font-bold text-sm text-white uppercase">Dados do Perfil</h4>
        </div>
        
        {profileMsg.text && (
          <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 border ${
            profileMsg.type === 'success' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20' : 'bg-red-950/40 text-red-400 border-red-500/20'
          }`}>
            {profileMsg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{profileMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-[10px] font-orbitron font-bold text-gray-400 mb-1.5">NOME / NOME ARTÍSTICO</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-orbitron font-bold text-gray-400 mb-1.5">CATEGORIA PÚBLICA</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white/20 focus:outline-none"
            >
              <option value="NONE">Sem Categoria</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={profileLoading}
            className="w-max bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold px-5 py-2.5 rounded-xl text-[10px] transition-all cursor-pointer flex items-center space-x-1.5"
          >
            {profileLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{profileLoading ? 'SALVANDO...' : 'ATUALIZAR PERFIL'}</span>
          </button>
        </form>
      </div>

      {/* 2. Alterar E-mail */}
      <div className="bg-black/35 p-6 rounded-2xl border border-white/5 space-y-4">
        <div className="flex items-center space-x-2">
          <Mail className="w-5 h-5 text-white" />
          <h4 className="font-orbitron font-bold text-sm text-white uppercase">E-mail de Acesso</h4>
        </div>

        {emailMsg.text && (
          <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 border ${
            emailMsg.type === 'success' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20' : 'bg-red-950/40 text-red-400 border-red-500/20'
          }`}>
            {emailMsg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{emailMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleUpdateEmail} className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-[10px] font-orbitron font-bold text-gray-400 mb-1.5">ENDEREÇO DE E-MAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white/20 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={emailLoading}
            className="w-max bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold px-5 py-2.5 rounded-xl text-[10px] transition-all cursor-pointer flex items-center space-x-1.5"
          >
            {emailLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{emailLoading ? 'SALVANDO...' : 'ALTERAR E-MAIL'}</span>
          </button>
        </form>
      </div>

      {/* 3. Alterar Senha Secundária */}
      <div className="bg-black/35 p-6 rounded-2xl border border-white/5 space-y-4">
        <div className="flex items-center space-x-2">
          <Key className="w-5 h-5 text-white" />
          <h4 className="font-orbitron font-bold text-sm text-white uppercase">Segurança (Senha)</h4>
        </div>

        {passwordMsg.text && (
          <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 border ${
            passwordMsg.type === 'success' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20' : 'bg-red-950/40 text-red-400 border-red-500/20'
          }`}>
            {passwordMsg.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{passwordMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-orbitron font-bold text-gray-400 mb-1.5">NOVA SENHA</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 caracteres"
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-orbitron font-bold text-gray-400 mb-1.5">CONFIRMAR NOVA SENHA</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirme a nova senha"
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-white/20 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={passwordLoading}
              className="w-max bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold px-5 py-2.5 rounded-xl text-[10px] transition-all cursor-pointer flex items-center space-x-1.5"
            >
              {passwordLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{passwordLoading ? 'ALTERANDO...' : 'ALTERAR SENHA'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
