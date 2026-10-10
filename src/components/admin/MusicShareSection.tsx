import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Plus, Trash2, Edit, Check, Search, Filter, Calendar, DollarSign, 
  PlusCircle, FileText, Upload, CheckCircle2, AlertTriangle, X, Loader2, ArrowLeft,
  User, Sparkles
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { ArtistShare, ShareParticipant, ShareHistory, DetailedArtist, CentralUser } from '../../types';
import { fetchCentralUsers } from '../../utils/centralUserDb';
import { PersonSelectAutocomplete } from '../common/PersonSelectAutocomplete';
import { formatBRL } from '../../utils/money';

interface MusicShareSectionProps {
  onMascotMoodChange: (mood: 'normal' | 'attentive' | 'happy' | 'angry' | 'pointing', speech: string) => void;
  artists?: DetailedArtist[];
}

const LOCAL_STORAGE_KEY = 'lockdown_music_shares';

export const MusicShareSection: React.FC<MusicShareSectionProps> = ({ onMascotMoodChange }) => {
  const [shares, setShares] = useState<ArtistShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDistributor, setFilterDistributor] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShare, setEditingShare] = useState<ArtistShare | null>(null);
  const [centralUsers, setCentralUsers] = useState<CentralUser[]>([]);
  
  // New/Edit Share Form Fields
  const [artistPhoto, setArtistPhoto] = useState('');
  const [artistName, setArtistName] = useState('');
  const [artistEmail, setArtistEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [paymentEmail, setPaymentEmail] = useState('');
  const [artistPercentage, setArtistPercentage] = useState<number>(100);
  const [distributor, setDistributor] = useState('Believe');
  const [status, setStatus] = useState<'Pendente' | 'Concluido' | 'Recusado'>('Pendente');
  const [notes, setNotes] = useState('');
  
  // Participants Subform Fields
  const [participants, setParticipants] = useState<ShareParticipant[]>([]);
  const [newPartType, setNewPartType] = useState<'Empresário' | 'Produtora' | 'Produtor Musical' | 'Empresa' | 'Outros'>('Empresário');
  const [newPartName, setNewPartName] = useState('');
  const [newPartEmail, setNewPartEmail] = useState('');
  const [newPartPercentage, setNewPartPercentage] = useState<number>(0);

  // History / Earning entry Fields
  const [history, setHistory] = useState<ShareHistory[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<ArtistShare | null>(null);
  const [historyDate, setHistoryDate] = useState('');
  const [historyDesc, setHistoryDesc] = useState('');
  const [historyAmount, setHistoryAmount] = useState<number>(0);

  // Load Shares & Central Users
  const fetchSharesAndUsers = async () => {
    setIsLoading(true);
    try {
      const [uList, snapshot] = await Promise.all([
        fetchCentralUsers(),
        getDocs(collection(db, 'lockdown_music_shares'))
      ]);
      setCentralUsers(uList);

      const list: ArtistShare[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ArtistShare);
      });
      setShares(list);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn("Firestore fetch lockdown_music_shares failed, fallback to local storage:", err);
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setShares(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
          setShares([]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSharesAndUsers();
  }, []);

  const saveShareToDb = async (shareItem: ArtistShare) => {
    try {
      const docRef = doc(db, 'lockdown_music_shares', shareItem.id);
      await setDoc(docRef, shareItem);
    } catch (err) {
      console.warn("Firestore save lockdown_music_shares failed, using local storage fallback:", err);
    }
    const updated = shares.filter(s => s.id !== shareItem.id);
    updated.push(shareItem);
    setShares(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  };

  const deleteShareFromDb = async (id: string) => {
    try {
      const docRef = doc(db, 'lockdown_music_shares', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn("Firestore delete lockdown_music_shares failed, using local storage fallback:", err);
    }
    const updated = shares.filter(s => s.id !== id);
    setShares(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  };

  // Participant math validations
  const calculateTotalShare = (artPct: number, parts: ShareParticipant[]) => {
    const partsTotal = parts.reduce((acc, p) => acc + Number(p.percentage || 0), 0);
    return Number(artPct || 0) + partsTotal;
  };

  const totalPercentageSum = calculateTotalShare(artistPercentage, participants);

  const handleAddParticipant = () => {
    if (!newPartName || !newPartEmail) {
      onMascotMoodChange('attentive', 'Informe o nome e e-mail do participante.');
      return;
    }
    if (newPartPercentage <= 0) {
      onMascotMoodChange('attentive', 'A porcentagem deve ser maior que 0.');
      return;
    }

    const testSum = calculateTotalShare(artistPercentage, [...participants, {
      type: newPartType,
      name: newPartName,
      email: newPartEmail,
      percentage: Number(newPartPercentage)
    }]);

    if (testSum > 100) {
      onMascotMoodChange('angry', 'Erro: A soma das participações ultrapassará 100%!');
      return;
    }

    setParticipants([
      ...participants,
      {
        type: newPartType,
        name: newPartName,
        email: newPartEmail,
        percentage: Number(newPartPercentage)
      }
    ]);

    setNewPartName('');
    setNewPartEmail('');
    setNewPartPercentage(0);
    onMascotMoodChange('happy', 'Participante adicionado à divisão.');
  };

  const handleRemoveParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
    onMascotMoodChange('normal', 'Participante removido da divisão.');
  };

  // Save artist share registry
  const handleSaveShare = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!artistName) {
      onMascotMoodChange('attentive', 'Selecione ou cadastre o artista principal.');
      return;
    }

    if (totalPercentageSum !== 100) {
      onMascotMoodChange('angry', 'Bloqueado: A soma total de todas as participações deve ser de EXATAMENTE 100%!');
      return;
    }

    if (artistPercentage < 0 || participants.some(p => p.percentage < 0)) {
      onMascotMoodChange('angry', 'Bloqueado: Porcentagens não podem ser negativas!');
      return;
    }

    const id = editingShare?.id || `share-${Date.now()}`;
    const newShare: ArtistShare = {
      id,
      artistPhoto: artistPhoto || '',
      artistName,
      artistEmail: artistEmail || '',
      artistPercentage: Number(artistPercentage),
      distributor,
      status,
      notes,
      participants,
      history: editingShare?.history || [],
      userId: userId || '',
      paymentEmail: paymentEmail || '',
      createdAt: editingShare?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await saveShareToDb(newShare);
    setIsModalOpen(false);
    setEditingShare(null);
    resetForm();
    onMascotMoodChange('happy', 'Registro financeiro do artista salvo com sucesso!');
  };

  const resetForm = () => {
    setArtistPhoto('');
    setArtistName('');
    setArtistEmail('');
    setUserId('');
    setPaymentEmail('');
    setArtistPercentage(100);
    setDistributor('Believe');
    setStatus('Pendente');
    setNotes('');
    setParticipants([]);
  };

  const openAddModal = () => {
    resetForm();
    setEditingShare(null);
    setIsModalOpen(true);
  };

  const openEditModal = (shareItem: ArtistShare) => {
    setEditingShare(shareItem);
    setArtistPhoto(shareItem.artistPhoto || '');
    setArtistName(shareItem.artistName);
    setArtistEmail(shareItem.artistEmail || '');
    setUserId(shareItem.userId || '');
    setPaymentEmail(shareItem.paymentEmail || '');
    setArtistPercentage(shareItem.artistPercentage);
    setDistributor(shareItem.distributor);
    setStatus(shareItem.status);
    setNotes(shareItem.notes || '');
    setParticipants(shareItem.participants || []);
    setIsModalOpen(true);
  };

  const handleDeleteShare = async (id: string, name: string) => {
    if (window.confirm(`Deseja mesmo excluir o registro financeiro de ${name}?`)) {
      await deleteShareFromDb(id);
      onMascotMoodChange('angry', 'Registro excluído permanentemente.');
    }
  };

  // History operations
  const handleAddHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showHistoryModal) return;
    if (!historyDate || !historyDesc || historyAmount <= 0) {
      onMascotMoodChange('attentive', 'Todos os campos de faturamento devem ser preenchidos corretamente.');
      return;
    }

    const newHistItem: ShareHistory = {
      id: `hist-${Date.now()}`,
      date: historyDate,
      description: historyDesc,
      amount: Number(historyAmount)
    };

    const updatedHistory = [...(showHistoryModal.history || []), newHistItem];
    const updatedShare = { ...showHistoryModal, history: updatedHistory };

    await saveShareToDb(updatedShare);
    setShowHistoryModal(updatedShare);
    setHistoryDate('');
    setHistoryDesc('');
    setHistoryAmount(0);
    onMascotMoodChange('happy', 'Lançamento de faturamento registrado!');
  };

  const handleRemoveHistory = async (histId: string) => {
    if (!showHistoryModal) return;
    const updatedHistory = (showHistoryModal.history || []).filter(h => h.id !== histId);
    const updatedShare = { ...showHistoryModal, history: updatedHistory };

    await saveShareToDb(updatedShare);
    setShowHistoryModal(updatedShare);
    onMascotMoodChange('normal', 'Lançamento de faturamento removido.');
  };

  // Filter and search logic
  const filteredShares = shares.filter(s => {
    const matchesSearch = s.artistName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (s.artistEmail && s.artistEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (s.paymentEmail && s.paymentEmail.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDistributor = filterDistributor === 'All' ? true :
                               filterDistributor === 'Outras' ? !['Symphonic', 'ONErpm', 'WMD', 'Believe', 'Som Livre', 'Sound'].includes(s.distributor) :
                               s.distributor === filterDistributor;
    const matchesStatus = filterStatus === 'All' || s.status === filterStatus;
    return matchesSearch && matchesDistributor && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="font-orbitron font-black text-xl text-black">DIVISÃO FINANCEIRA • SHARE</h3>
            <span className="bg-emerald-50 text-emerald-700 font-orbitron font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-emerald-200">
              IDENTIDADE CENTRAL
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Controle e audite a porcentagem de receita de cada artista e seus coprodutores vinculados ao cadastro central.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs px-5 py-3 rounded-2xl flex items-center space-x-2 cursor-pointer shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>NOVO LANÇAMENTO FINANCEIRO</span>
        </button>
      </div>

      {/* Filters bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-white p-4 rounded-3xl border border-gray-200 shadow-xs">
        <div className="sm:col-span-6 relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por artista, e-mail ou chave PIX..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2 text-xs font-sans text-black focus:outline-none focus:border-[#FF0033]"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={filterDistributor}
            onChange={(e) => setFilterDistributor(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-orbitron font-bold text-gray-700 focus:outline-none"
          >
            <option value="All">DISTRIBUIDORA: TODAS</option>
            <option value="Symphonic">Symphonic</option>
            <option value="ONErpm">ONErpm</option>
            <option value="WMD">WMD</option>
            <option value="Believe">Believe</option>
            <option value="Som Livre">Som Livre</option>
            <option value="Sound">Sound</option>
            <option value="Outras">Outras</option>
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-orbitron font-bold text-gray-700 focus:outline-none"
          >
            <option value="All">STATUS: TODOS</option>
            <option value="Pendente">Pendente</option>
            <option value="Concluido">Concluído</option>
            <option value="Recusado">Recusado</option>
          </select>
        </div>
      </div>

      {/* Main List Table */}
      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-xs">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 grid grid-cols-12 text-[10px] font-orbitron font-bold text-gray-600 gap-4">
          <div className="col-span-4">ARTISTA • IDENTIDADE CENTRAL</div>
          <div className="col-span-2">DISTRIBUIDORA</div>
          <div className="col-span-2 text-center">DIVISÃO (SHARE)</div>
          <div className="col-span-2 text-center">STATUS</div>
          <div className="col-span-2 text-right">AÇÕES</div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredShares.length === 0 ? (
            <div className="p-12 text-center text-gray-400 font-orbitron text-xs">
              NENHUM REGISTRO DE SHARE FINANCEIRO ENCONTRADO.
            </div>
          ) : (
            filteredShares.map(share => {
              const sum = calculateTotalShare(share.artistPercentage, share.participants || []);
              const matchedUser = centralUsers.find(u => u.id === share.userId || u.uid === share.userId);
              const resolvedPhoto = matchedUser?.photoURL || share.artistPhoto;
              const resolvedName = matchedUser?.name || share.artistName;
              const resolvedEmail = matchedUser?.email || share.artistEmail;
              const resolvedPaymentEmail = share.paymentEmail || '';

              return (
                <div key={share.id} className="px-6 py-5 grid grid-cols-12 items-center hover:bg-gray-50/80 transition-colors text-xs gap-4">
                  <div className="col-span-4 flex items-center space-x-3">
                    {resolvedPhoto ? (
                      <img 
                        src={resolvedPhoto} 
                        alt={resolvedName} 
                        className="w-11 h-11 rounded-2xl object-cover border border-gray-200 shrink-0" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-2xl bg-black flex items-center justify-center shrink-0 border border-gray-200">
                        <User className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="font-orbitron font-black text-black block text-sm truncate">{resolvedName}</span>
                      {matchedUser?.artisticName && (
                        <span className="text-[10px] text-purple-700 font-orbitron font-bold block truncate">
                          {matchedUser.artisticName}
                        </span>
                      )}
                      {resolvedPaymentEmail ? (
                        <span className="text-[10px] text-emerald-600 font-mono font-bold block truncate">
                          PIX: {resolvedPaymentEmail}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-sans text-[10px] block truncate">{resolvedEmail || 'Sem e-mail'}</span>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 font-orbitron font-bold text-gray-700">
                    {share.distributor}
                  </div>

                  <div className="col-span-2 text-center">
                    <div className="font-orbitron font-black text-sm text-[#FF0033]">
                      {share.artistPercentage}% <span className="text-[9px] text-gray-400 font-normal">Artista</span>
                    </div>
                    {share.participants && share.participants.length > 0 && (
                      <span className="text-[10px] text-gray-500 font-sans block mt-0.5">
                        +{share.participants.length} parceiros ({sum}%)
                      </span>
                    )}
                  </div>

                  <div className="col-span-2 text-center">
                    <span className={`font-orbitron text-[9px] font-bold px-2.5 py-1 rounded-full ${
                      share.status === 'Concluido' ? 'bg-emerald-50 text-emerald-600' :
                      share.status === 'Recusado' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {share.status === 'Concluido' ? 'CONCLUÍDO' : share.status === 'Recusado' ? 'RECUSADO' : 'PENDENTE'}
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center justify-end space-x-1.5">
                    <button
                      onClick={() => setShowHistoryModal(share)}
                      className="p-2 rounded-xl hover:bg-red-50 text-[#FF0033] transition-colors"
                      title="Lançamentos / Histórico"
                    >
                      <DollarSign className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(share)}
                      className="p-2 rounded-xl hover:bg-gray-100 text-gray-700 transition-colors"
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteShare(share.id, share.artistName)}
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
      </div>

      {/* Modal: New / Edit Share */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-gray-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden"
            >
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h4 className="font-orbitron font-black text-black">
                  {editingShare ? `EDITAR PARTICIPAÇÃO FINANCEIRA` : 'CADASTRAR NOVA PARTILHA • SHARE'}
                </h4>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveShare} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* 1. SELEÇÃO CENTRAL DO ARTISTA / PESSOA */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                  <PersonSelectAutocomplete
                    label="ARTISTA PRINCIPAL (IDENTIDADE CENTRAL)"
                    required
                    selectedUserId={userId}
                    selectedUserName={artistName}
                    selectedUserPhoto={artistPhoto}
                    onSelectPerson={(person) => {
                      setUserId(person.id || person.uid || '');
                      setArtistName(person.name);
                      setArtistPhoto(person.photoURL || '');
                      setArtistEmail(person.email || '');
                      onMascotMoodChange('happy', `Artista ${person.name} selecionado com foto central unificada!`);
                    }}
                    onClear={() => {
                      setUserId('');
                      setArtistName('');
                      setArtistPhoto('');
                      setArtistEmail('');
                    }}
                    defaultRole="Artista / DJ"
                  />

                  <div>
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">
                      EMAIL / CHAVE PIX PARA RECEBER PAGAMENTO (INDEPENDENTE DO LOGIN)
                    </label>
                    <input
                      type="text"
                      value={paymentEmail}
                      onChange={e => setPaymentEmail(e.target.value)}
                      placeholder="Ex: pix-kronos@gmail.com ou chave aleatória"
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-xs font-sans text-black focus:outline-none focus:border-[#FF0033]"
                    />
                    <p className="text-[9px] text-gray-400 mt-1">
                      Conforme regra de negócio, o e-mail de pagamento financeiro é independente do e-mail de login da Lockdown.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">PORCENTAGEM DO ARTISTA (%) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={artistPercentage}
                      onChange={e => setArtistPercentage(Number(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-xs font-sans text-black focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">DISTRIBUIDORA</label>
                    <select
                      value={!['Symphonic', 'ONErpm', 'WMD', 'Believe', 'Som Livre', 'Sound'].includes(distributor) ? 'Outra' : distributor}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'Outra') {
                          setDistributor('');
                        } else {
                          setDistributor(val);
                        }
                      }}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-xs font-sans text-black focus:outline-none"
                    >
                      <option value="Symphonic">Symphonic</option>
                      <option value="ONErpm">ONErpm</option>
                      <option value="WMD">WMD</option>
                      <option value="Believe">Believe</option>
                      <option value="Som Livre">Som Livre</option>
                      <option value="Sound">Sound</option>
                      <option value="Outra">Outra (Especificar)</option>
                    </select>

                    {!['Symphonic', 'ONErpm', 'WMD', 'Believe', 'Som Livre', 'Sound'].includes(distributor) && (
                      <div className="mt-2">
                        <input
                          type="text"
                          required
                          placeholder="Digite o nome da distribuidora..."
                          value={distributor}
                          onChange={e => setDistributor(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-xs font-sans text-black focus:outline-none border-[#FF0033]/40"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">STATUS DE CONVITE</label>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as any)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2 text-xs font-sans text-black focus:outline-none"
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Concluido">Concluído</option>
                      <option value="Recusado">Recusado</option>
                    </select>
                  </div>
                </div>

                {/* Subform: Multiple Participants */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-orbitron text-xs font-bold text-black">COPRODUTORES / PARCEIROS</span>
                    <span className={`font-orbitron text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      totalPercentageSum === 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}>
                      Soma: {totalPercentageSum}% {totalPercentageSum === 100 ? '✓ (100%)' : `(Faltam ${100 - totalPercentageSum}%)`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div>
                      <select
                        value={newPartType}
                        onChange={e => setNewPartType(e.target.value as any)}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-[11px] font-sans text-black focus:outline-none"
                      >
                        <option value="Empresário">Empresário</option>
                        <option value="Produtora">Produtora</option>
                        <option value="Produtor Musical">Produtor Musical</option>
                        <option value="Empresa">Empresa</option>
                        <option value="Outros">Outros</option>
                      </select>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Nome do parceiro"
                        value={newPartName}
                        onChange={e => setNewPartName(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-[11px] font-sans text-black focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="email"
                        placeholder="E-mail ou PIX"
                        value={newPartEmail}
                        onChange={e => setNewPartEmail(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-[11px] font-sans text-black focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="%"
                        min="1"
                        max="100"
                        value={newPartPercentage || ''}
                        onChange={e => setNewPartPercentage(Number(e.target.value))}
                        className="w-16 bg-white border border-gray-300 rounded-xl px-2 py-2 text-[11px] font-sans text-black focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddParticipant}
                        className="bg-black hover:bg-gray-800 text-white font-orbitron text-[10px] px-3 py-2 rounded-xl flex-1 cursor-pointer"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>

                  {participants.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      {participants.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-gray-200 text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="bg-gray-100 text-gray-700 text-[10px] font-orbitron px-2 py-0.5 rounded">
                              {p.type}
                            </span>
                            <span className="font-bold text-black">{p.name}</span>
                            <span className="text-gray-400 text-[11px]">({p.email})</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-orbitron font-black text-[#FF0033]">{p.percentage}%</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveParticipant(idx)}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-2 pt-4 border-t border-gray-200">
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
                    SALVAR PARTILHA
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: History / Earnings */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-gray-200 rounded-3xl w-full max-w-xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-orbitron font-black text-black">HISTÓRICO FINANCEIRO • {showHistoryModal.artistName}</h4>
                </div>
                <button onClick={() => setShowHistoryModal(null)} className="text-gray-500 hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddHistory} className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-gray-50 p-3.5 rounded-2xl border border-gray-200">
                <div>
                  <label className="text-[9px] font-orbitron text-gray-500 font-bold block mb-1">DATA</label>
                  <input
                    type="date"
                    required
                    value={historyDate}
                    onChange={e => setHistoryDate(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-sans text-black"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-orbitron text-gray-500 font-bold block mb-1">DESCRIÇÃO</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Repasse Março/2026"
                    value={historyDesc}
                    onChange={e => setHistoryDesc(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-sans text-black"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-orbitron text-gray-500 font-bold block mb-1">VALOR BRUTO (R$)</label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={historyAmount || ''}
                      onChange={e => setHistoryAmount(Number(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs font-sans text-black"
                    />
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-orbitron text-[10px] px-3 py-1.5 rounded-xl cursor-pointer"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(!showHistoryModal.history || showHistoryModal.history.length === 0) ? (
                  <div className="text-center py-6 text-gray-400 text-xs font-orbitron">
                    NENHUM LANÇAMENTO REGISTRADO ATÉ O MOMENTO.
                  </div>
                ) : (
                  showHistoryModal.history.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                      <div>
                        <span className="font-bold text-black block">{item.description}</span>
                        <span className="text-gray-400 text-[10px]">{item.date}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-orbitron font-black text-emerald-600">
                          {formatBRL(item.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveHistory(item.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-orbitron text-xs px-5 py-2.5 rounded-xl"
                >
                  FECHAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
