import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, User, Check, Plus, AlertCircle, RefreshCw, Upload, 
  Trash2, Shield, Link2, ExternalLink, X, ChevronDown, CheckCircle2 
} from 'lucide-react';
import { CentralUser } from '../../types';
import { 
  searchPeople, 
  findOrCreatePerson, 
  updateCentralUserPhoto, 
  fetchCentralUsers,
  normalizePersonName 
} from '../../utils/centralUserDb';
import { uploadFile } from '../../utils/upload';

interface PersonSelectAutocompleteProps {
  label?: string;
  placeholder?: string;
  selectedUserId?: string;
  onSelectUser?: (user: CentralUser) => void;
  onSelectPerson?: (user: CentralUser) => void;
  onClearUser?: () => void;
  onClear?: () => void;
  roleFilter?: string;
  required?: boolean;
  allowCreateInline?: boolean;
  defaultName?: string;
  isArtistContext?: boolean;
}

export const PersonSelectAutocomplete: React.FC<PersonSelectAutocompleteProps> = ({
  label = "PESSOA / ARTISTA RESPONSÁVEL (CADASTRO CENTRAL)",
  placeholder = "Digite o nome completo ou artístico para buscar...",
  selectedUserId,
  onSelectUser,
  onSelectPerson,
  onClearUser,
  onClear,
  roleFilter,
  required = false,
  allowCreateInline = true,
  defaultName = '',
  isArtistContext = false
}) => {
  const [allUsers, setAllUsers] = useState<CentralUser[]>([]);
  const [queryText, setQueryText] = useState(defaultName);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<CentralUser | null>(null);
  
  // Inline quick create state
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [quickRealName, setQuickRealName] = useState('');
  const [quickArtisticName, setQuickArtisticName] = useState('');
  const [quickRole, setQuickRole] = useState(isArtistContext ? 'Artista / DJ' : 'Usuário Comum');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickPhotoURL, setQuickPhotoURL] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Photo management modal for central user
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [photoUploadProgress, setPhotoUploadProgress] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load central users
  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const list = await fetchCentralUsers();
      setAllUsers(list);
      if (selectedUserId) {
        const found = list.find(u => u.id === selectedUserId || u.uid === selectedUserId);
        if (found) {
          setSelectedUser(found);
          setQueryText(found.artisticName || found.name);
        }
      }
    } catch (e) {
      console.warn("Failed to load central users in autocomplete:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [selectedUserId]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchResults = searchPeople(queryText, allUsers);
  const { exactMatch, similarMatches } = searchResults;

  const handleSelect = (user: CentralUser) => {
    setSelectedUser(user);
    setQueryText(user.artisticName || user.name);
    setIsOpen(false);
    if (typeof onSelectUser === 'function') onSelectUser(user);
    if (typeof onSelectPerson === 'function') onSelectPerson(user);
  };

  const handleClear = () => {
    setSelectedUser(null);
    setQueryText('');
    if (typeof onClearUser === 'function') onClearUser();
    if (typeof onClear === 'function') onClear();
  };

  const handleInlineCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRealName.trim() && !quickArtisticName.trim()) return;

    setIsCreatingInline(true);
    try {
      const created = await findOrCreatePerson({
        name: quickRealName.trim() || quickArtisticName.trim(),
        artisticName: quickArtisticName.trim(),
        role: quickRole,
        phone: quickPhone.trim(),
        photoURL: quickPhotoURL,
        origin: 'music',
        isArtist: isArtistContext || quickRole === 'Artista / DJ' || quickRole === 'Cantor'
      }, allUsers);

      // Refresh users list and select
      await loadUsers();
      handleSelect(created);
      setIsCreatingInline(false);
    } catch (err) {
      console.error("Failed to quick create central user:", err);
    } finally {
      setIsCreatingInline(false);
    }
  };

  const handlePhotoUploadDirect = async (e: React.ChangeEvent<HTMLInputElement>, forSelected = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setPhotoUploadProgress(0);
    try {
      const res = await uploadFile(file, 'user', (p) => setPhotoUploadProgress(p.percentage));
      if (res && res.url) {
        if (forSelected && selectedUser) {
          await updateCentralUserPhoto(selectedUser.id || selectedUser.uid || '', res.url);
          const updated = { ...selectedUser, photoURL: res.url };
          setSelectedUser(updated);
          if (typeof onSelectUser === 'function') onSelectUser(updated);
          if (typeof onSelectPerson === 'function') onSelectPerson(updated);
          setIsPhotoModalOpen(false);
        } else {
          setQuickPhotoURL(res.url);
        }
      }
    } catch (err) {
      console.error("Photo upload error:", err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="font-orbitron text-[10px] text-gray-500 font-bold tracking-wider block">
          {label} {required && <span className="text-[#FF0033]">*</span>}
        </label>
        {selectedUser && (
          <span className="text-[9px] font-orbitron font-bold text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            PERFIL VINCULADO
          </span>
        )}
      </div>

      {/* When a user is already selected, show prominent unified profile card */}
      {selectedUser ? (
        <div className="bg-white border-2 border-emerald-500/40 rounded-2xl p-3.5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3.5 min-w-0">
            {selectedUser.photoURL ? (
              <img 
                src={selectedUser.photoURL} 
                alt="" 
                className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center shrink-0 border border-gray-300">
                <User className="w-6 h-6 text-gray-400" />
              </div>
            )}
            
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-orbitron font-black text-sm text-black truncate">
                  {selectedUser.name}
                </span>
                {selectedUser.artisticName && (
                  <span className="bg-purple-50 text-purple-700 text-[10px] font-orbitron font-bold px-2 py-0.5 rounded-md">
                    {selectedUser.artisticName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 font-sans">
                <span>{selectedUser.role || 'Usuário Comum'}</span>
                <span>•</span>
                <span className="font-mono text-[10px]">{selectedUser.email || 'Sem e-mail cadastrado'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
            <button
              type="button"
              onClick={() => setIsPhotoModalOpen(true)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-orbitron text-[10px] font-bold px-3 py-2 rounded-xl flex items-center space-x-1 cursor-pointer transition-colors"
              title="Atualizar foto central do usuário"
            >
              <Upload className="w-3 h-3 text-[#FF0033]" />
              <span>FOTO CENTRAL</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="bg-red-50 hover:bg-red-100 text-red-600 font-orbitron text-[10px] font-bold px-3 py-2 rounded-xl flex items-center space-x-1 cursor-pointer transition-colors"
              title="Trocar pessoa selecionada"
            >
              <X className="w-3 h-3" />
              <span>TROCAR</span>
            </button>
          </div>
        </div>
      ) : (
        /* Search / Selector Input */
        <div className="relative">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={queryText}
              onChange={(e) => {
                setQueryText(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-10 py-2.5 text-xs text-black placeholder-gray-400 focus:outline-none focus:border-[#FF0033] font-sans"
            />
            {queryText && (
              <button
                type="button"
                onClick={() => {
                  setQueryText('');
                  setIsOpen(true);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-black"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown List */}
          {isOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
              
              {/* Exact or Similar Matches */}
              {(exactMatch || similarMatches.length > 0) && (
                <div className="p-2 border-b border-gray-100 bg-gray-50/80">
                  <span className="text-[9px] font-orbitron font-bold text-gray-500 px-2 block mb-1">
                    PERFIS ENCONTRADOS NO MÓDULO USUÁRIOS
                  </span>
                  
                  {exactMatch && (
                    <button
                      type="button"
                      onClick={() => handleSelect(exactMatch)}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-purple-50 transition-colors flex items-center justify-between border border-purple-200 bg-white mb-1.5 cursor-pointer"
                    >
                      <div className="flex items-center space-x-3 truncate">
                        {exactMatch.photoURL ? (
                          <img src={exactMatch.photoURL} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-200 shrink-0" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center shrink-0 border border-gray-300">
                            <User className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="truncate">
                          <span className="font-orbitron font-bold text-xs text-black block truncate">{exactMatch.name}</span>
                          <span className="text-[10px] text-purple-700 font-sans block">{exactMatch.artisticName || exactMatch.role}</span>
                        </div>
                      </div>
                      <span className="bg-[#FF0033] text-white font-orbitron font-bold text-[9px] px-2.5 py-1 rounded-lg shrink-0">
                        USAR PERFIL
                      </span>
                    </button>
                  )}

                  {similarMatches.filter(u => u.id !== exactMatch?.id).map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelect(user)}
                      className="w-full text-left p-2 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-black flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                        )}
                        <div className="truncate">
                          <span className="font-sans font-bold text-xs text-black block truncate">{user.name}</span>
                          <span className="text-[9px] text-gray-500 block truncate">{user.artisticName || user.email || user.role}</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-orbitron font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                        Vincular
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Action: Create New Central Profile */}
              {allowCreateInline && (
                <div className="p-3 bg-white">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickRealName(queryText);
                      setQuickArtisticName(queryText);
                      setIsCreatingInline(true);
                    }}
                    className="w-full bg-gray-50 hover:bg-red-50 text-[#FF0033] border border-dashed border-red-200 p-3 rounded-xl font-orbitron font-bold text-xs flex items-center justify-center space-x-2 cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>CRIAR COMO NOVO PERFIL CENTRAL "{queryText || 'PESSOA'}"</span>
                  </button>
                  <p className="text-[9px] text-gray-400 text-center font-sans mt-1">
                    Cria automaticamente a pessoa no módulo Usuários sem necessidade de e-mail/senha.
                  </p>
                </div>
              )}

              {allUsers.length === 0 && !isLoading && (
                <div className="p-4 text-center text-xs text-gray-500 font-sans">
                  Nenhum usuário cadastrado no sistema ainda.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* QUICK INLINE CREATION MODAL */}
      {isCreatingInline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border-2 border-gray-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-[#FF0033]" />
                <h4 className="font-orbitron font-black text-sm text-black">CRIAR PERFIL CENTRAL</h4>
              </div>
              <button onClick={() => setIsCreatingInline(false)} className="text-gray-400 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInlineCreateSubmit} className="space-y-3.5">
              <div>
                <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">NOME REAL / REGISTRO *</label>
                <input
                  type="text"
                  required
                  value={quickRealName}
                  onChange={e => setQuickRealName(e.target.value)}
                  placeholder="Nome de registro ou nascimento"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-black focus:outline-none focus:border-[#FF0033]"
                />
              </div>

              <div>
                <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">NOME ARTÍSTICO (SE HOUVER)</label>
                <input
                  type="text"
                  value={quickArtisticName}
                  onChange={e => setQuickArtisticName(e.target.value)}
                  placeholder="Ex: MC KRONOS, DJ LOCK"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-2 text-xs text-black focus:outline-none focus:border-[#FF0033]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">TIPO / PAPEL</label>
                  <select
                    value={quickRole}
                    onChange={e => setQuickRole(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-orbitron font-bold text-gray-700 focus:outline-none"
                  >
                    <option value="Artista / DJ">ARTISTA / DJ</option>
                    <option value="Cantor">CANTOR</option>
                    <option value="Produtora">PRODUTORA</option>
                    <option value="Empresa">EMPRESA</option>
                    <option value="Usuário Comum">USUÁRIO COMUM</option>
                  </select>
                </div>

                <div>
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">WHATSAPP / CONTATO</label>
                  <input
                    type="text"
                    value={quickPhone}
                    onChange={e => setQuickPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-black focus:outline-none"
                  />
                </div>
              </div>

              {/* Upload photo */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  {quickPhotoURL ? (
                    <img src={quickPhotoURL} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-300" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <span className="font-orbitron text-[9px] font-bold text-black block">FOTO CENTRAL</span>
                    <span className="text-[9px] text-gray-400 font-sans block">Salva na conta central</span>
                  </div>
                </div>

                <label className="bg-black hover:bg-gray-800 text-white font-orbitron font-bold text-[9px] px-3 py-1.5 rounded-lg cursor-pointer flex items-center space-x-1">
                  <Upload className="w-3 h-3" />
                  <span>ENVIAR</span>
                  <input type="file" accept="image/*" onChange={(e) => handlePhotoUploadDirect(e, false)} className="hidden" />
                </label>
              </div>

              {isUploadingPhoto && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-orbitron text-[#FF0033]">
                    <span>Enviando foto...</span>
                    <span>{photoUploadProgress}%</span>
                  </div>
                  <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-[#FF0033]" style={{ width: `${photoUploadProgress}%` }}></div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsCreatingInline(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron text-xs px-4 py-2 rounded-xl"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={isUploadingPhoto}
                  className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs px-5 py-2 rounded-xl shadow cursor-pointer"
                >
                  CRIAR & VINCULAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE CENTRAL PHOTO MODAL */}
      {isPhotoModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border-2 border-gray-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div>
                <h4 className="font-orbitron font-black text-sm text-black">GERENCIAR FOTO CENTRAL</h4>
                <p className="text-[10px] text-gray-500 font-sans">Atualiza a foto de {selectedUser.name} para todos os módulos.</p>
              </div>
              <button onClick={() => setIsPhotoModalOpen(false)} className="text-gray-400 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center py-4 space-y-3">
              {selectedUser.photoURL ? (
                <img 
                  src={selectedUser.photoURL} 
                  alt="" 
                  className="w-24 h-24 rounded-2xl object-cover border-2 border-gray-300 shadow-md"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-black flex items-center justify-center border border-gray-300">
                  <User className="w-10 h-10 text-gray-400" />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-2">
                <label className="bg-black hover:bg-gray-800 text-white font-orbitron font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer flex items-center space-x-1.5 shadow">
                  <Upload className="w-3.5 h-3.5" />
                  <span>CARREGAR NOVA FOTO</span>
                  <input type="file" accept="image/*" onChange={(e) => handlePhotoUploadDirect(e, true)} className="hidden" />
                </label>

                {selectedUser.photoURL && (
                  <button
                    type="button"
                    onClick={async () => {
                      await updateCentralUserPhoto(selectedUser.id || selectedUser.uid || '', '');
                      setSelectedUser(prev => prev ? { ...prev, photoURL: '' } : null);
                      setIsPhotoModalOpen(false);
                    }}
                    className="bg-red-50 hover:bg-red-100 text-red-600 font-orbitron font-bold text-xs px-4 py-2.5 rounded-xl flex items-center space-x-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>REMOVER FOTO</span>
                  </button>
                )}
              </div>
            </div>

            {isUploadingPhoto && (
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-orbitron text-[#FF0033]">
                  <span>Enviando para o Firebase Storage...</span>
                  <span>{photoUploadProgress}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#FF0033]" style={{ width: `${photoUploadProgress}%` }}></div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsPhotoModalOpen(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron font-bold text-xs px-5 py-2 rounded-xl"
              >
                CONCLUÍDO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
