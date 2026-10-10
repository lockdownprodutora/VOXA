import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, ShieldCheck, Search, Plus, Edit, Trash2, X, Check,
  User, Sparkles, CheckCircle2, AlertCircle
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { DistributionClearance, CentralUser } from '../../types';
import { fetchCentralUsers } from '../../utils/centralUserDb';
import { PersonSelectAutocomplete } from '../common/PersonSelectAutocomplete';

interface DistributionClearanceSectionProps {
  onMascotMoodChange: (mood: 'normal' | 'attentive' | 'happy' | 'angry' | 'pointing', speech: string) => void;
}

const LOCAL_STORAGE_KEY = 'lockdown_distribution_clearance';

export const DistributionClearanceSection: React.FC<DistributionClearanceSectionProps> = ({ onMascotMoodChange }) => {
  const [clearances, setClearances] = useState<DistributionClearance[]>([]);
  const [centralUsers, setCentralUsers] = useState<CentralUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClearance, setEditingClearance] = useState<DistributionClearance | null>(null);
  const [userId, setUserId] = useState('');
  const [image, setImage] = useState('');
  const [artistName, setArtistName] = useState('');
  const [status, setStatus] = useState<'Aprovado' | 'Pendente'>('Pendente');
  const [notes, setNotes] = useState('');

  const fetchClearancesAndUsers = async () => {
    setIsLoading(true);
    try {
      const [uList, snapshot] = await Promise.all([
        fetchCentralUsers(),
        getDocs(collection(db, 'distribution_clearances'))
      ]);
      setCentralUsers(uList);

      const list: DistributionClearance[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as DistributionClearance);
      });
      setClearances(list);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn("Firestore fetch distribution_clearances failed, fallback to local storage:", err);
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setClearances(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
          setClearances([]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClearancesAndUsers();
  }, []);

  const handleSaveClearance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artistName) {
      onMascotMoodChange('attentive', 'Selecione ou cadastre a pessoa para autorização de voz.');
      return;
    }

    const id = editingClearance?.id || `clearance-${Date.now()}`;
    const newClearance: DistributionClearance = {
      id,
      image: image || '',
      artistName,
      status,
      notes,
      userId: userId || '',
      createdAt: editingClearance?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      const docRef = doc(db, 'distribution_clearances', id);
      await setDoc(docRef, newClearance);
    } catch (err) {
      console.warn("Firestore save distribution_clearance failed, using local fallback:", err);
    }

    const updatedList = clearances.filter(c => c.id !== id);
    updatedList.push(newClearance);
    setClearances(updatedList);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));

    setIsModalOpen(false);
    setEditingClearance(null);
    resetForm();
    onMascotMoodChange('happy', 'Autorização de voz/distribuição salva com sucesso!');
  };

  const handleDeleteClearance = async (id: string, name: string) => {
    if (window.confirm(`Excluir liberação de distribuição para ${name}?`)) {
      try {
        const docRef = doc(db, 'distribution_clearances', id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn("Firestore delete failed, using local fallback:", err);
      }
      const updatedList = clearances.filter(c => c.id !== id);
      setClearances(updatedList);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
      onMascotMoodChange('angry', 'Liberação de voz removida.');
    }
  };

  const openAddModal = () => {
    resetForm();
    setEditingClearance(null);
    setIsModalOpen(true);
  };

  const openEditModal = (c: DistributionClearance) => {
    setEditingClearance(c);
    setImage(c.image || '');
    setArtistName(c.artistName);
    setStatus(c.status);
    setNotes(c.notes || '');
    setUserId(c.userId || '');
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setImage('');
    setArtistName('');
    setStatus('Pendente');
    setNotes('');
    setUserId('');
  };

  const filteredClearances = clearances.filter(c => {
    const matchesSearch = c.artistName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'All' || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="font-orbitron font-black text-xl text-black">VOZES LIBERADAS • DISTRIBUIÇÃO</h3>
            <span className="bg-emerald-50 text-emerald-700 font-orbitron font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-emerald-200">
              IDENTIDADE CENTRAL
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Gestão de autorizações de voz, samples e direitos de distribuição com vínculo à pessoa central.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs px-5 py-3 rounded-2xl flex items-center space-x-2 cursor-pointer shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>NOVA AUTORIZAÇÃO DE VOZ</span>
        </button>
      </div>

      {/* Filters bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-white p-4 rounded-3xl border border-gray-200 shadow-xs">
        <div className="sm:col-span-8 relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por DJ, MC ou Produtor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2 text-xs font-sans text-black focus:outline-none focus:border-[#FF0033]"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-orbitron font-bold text-gray-700 focus:outline-none"
          >
            <option value="All">STATUS: TODOS</option>
            <option value="Aprovado">APROVADO / LIBERADO</option>
            <option value="Pendente">PENDENTE</option>
          </select>
        </div>
      </div>

      {/* Grid of Clearances */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClearances.length === 0 ? (
          <div className="col-span-full bg-white rounded-3xl border border-gray-200 p-12 text-center text-gray-400 font-orbitron text-xs">
            NENHUMA AUTORIZAÇÃO DE VOZ ENCONTRADA.
          </div>
        ) : (
          filteredClearances.map(item => {
            const matchedUser = centralUsers.find(u => u.id === item.userId || u.uid === item.userId);
            const resolvedPhoto = matchedUser?.photoURL || item.image;
            const resolvedName = matchedUser?.name || item.artistName;

            return (
              <div key={item.id} className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-all">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      {resolvedPhoto ? (
                        <img 
                          src={resolvedPhoto} 
                          alt={resolvedName} 
                          className="w-12 h-12 rounded-2xl object-cover border border-gray-200 shrink-0" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center shrink-0 border border-gray-200">
                          <User className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-orbitron font-black text-sm text-black">{resolvedName}</h4>
                        {matchedUser?.artisticName && (
                          <span className="text-[10px] text-purple-700 font-orbitron font-bold block">
                            {matchedUser.artisticName}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 font-sans block">
                          {matchedUser ? 'Perfil Central Vinculado' : 'Sem vínculo direto'}
                        </span>
                      </div>
                    </div>

                    <span className={`font-orbitron text-[9px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                      item.status === 'Aprovado' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                    }`}>
                      {item.status === 'Aprovado' ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                      {item.status === 'Aprovado' ? 'LIBERADO' : 'PENDENTE'}
                    </span>
                  </div>

                  {item.notes && (
                    <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-2xl border border-gray-100 font-sans">
                      {item.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 mt-3 border-t border-gray-100">
                  <button
                    onClick={() => openEditModal(item)}
                    className="p-2 rounded-xl hover:bg-gray-100 text-gray-700 transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClearance(item.id, item.artistName)}
                    className="p-2 rounded-xl hover:bg-red-50 text-red-600 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: New / Edit Clearance */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-gray-200 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <h4 className="font-orbitron font-black text-black">
                  {editingClearance ? 'EDITAR LIBERAÇÃO DE VOZ' : 'NOVA LIBERAÇÃO DE VOZ'}
                </h4>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveClearance} className="space-y-4">
                {/* 1. SELEÇÃO CENTRAL DA PESSOA COM AUTOCOMPLETE */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                  <PersonSelectAutocomplete
                    label="MC / DJ / CANTOR (IDENTIDADE CENTRAL)"
                    required
                    selectedUserId={userId}
                    selectedUserName={artistName}
                    selectedUserPhoto={image}
                    onSelectPerson={(person) => {
                      setUserId(person.id || person.uid || '');
                      setArtistName(person.name);
                      setImage(person.photoURL || '');
                      onMascotMoodChange('happy', `Pessoa ${person.name} vinculada com foto central!`);
                    }}
                    onClear={() => {
                      setUserId('');
                      setArtistName('');
                      setImage('');
                    }}
                    defaultRole="Artista / DJ"
                  />
                </div>

                <div>
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">STATUS DE LIBERAÇÃO</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs font-sans text-black focus:outline-none"
                  >
                    <option value="Pendente">Pendente (Em análise jurídica)</option>
                    <option value="Aprovado">Aprovado (Voz e Samples Liberados)</option>
                  </select>
                </div>

                <div>
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">OBSERVAÇÕES / TERMOS DE AUTORIZAÇÃO</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Ex: Autorização para fonogramas do EP 2026, sem restrição de território."
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-xs font-sans text-black focus:outline-none focus:border-[#FF0033]"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron text-xs px-4 py-2.5 rounded-2xl"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs px-6 py-2.5 rounded-2xl shadow-md cursor-pointer"
                  >
                    SALVAR LIBERAÇÃO
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
