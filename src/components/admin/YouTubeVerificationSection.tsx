import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Youtube, Search, Filter, Check, Edit2, AlertCircle, ExternalLink, X, Trash2
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { YouTubeVerificationRequest } from '../../types';

interface YouTubeVerificationSectionProps {
  onMascotMoodChange: (mood: 'normal' | 'attentive' | 'happy' | 'angry' | 'pointing', speech: string) => void;
}

const LOCAL_STORAGE_KEY = 'lockdown_youtube_verifications';

export const YouTubeVerificationSection: React.FC<YouTubeVerificationSectionProps> = ({ onMascotMoodChange }) => {
  const [requests, setRequests] = useState<YouTubeVerificationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  // Modal / Editing State
  const [editingReq, setEditingReq] = useState<YouTubeVerificationRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [status, setStatus] = useState<'Enviado' | 'Em processamento' | 'Concluido' | 'Rejeitado'>('Enviado');

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const collRef = collection(db, 'youtube_verification_requests');
      const snapshot = await getDocs(collRef);
      const list: YouTubeVerificationRequest[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as YouTubeVerificationRequest);
      });
      setRequests(list);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn("Firestore fetch youtube_verification_requests failed, fallback to local storage:", err);
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setRequests(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
          setRequests([]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleSaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReq) return;

    const updated: YouTubeVerificationRequest = {
      ...editingReq,
      status,
      adminNotes,
      updatedAt: new Date().toISOString()
    };

    try {
      const docRef = doc(db, 'youtube_verification_requests', updated.id);
      await setDoc(docRef, updated);
    } catch (err) {
      console.warn("Firestore save youtube_verification_requests failed, fallback to local:", err);
    }

    // Update state
    const updatedList = requests.map(r => r.id === updated.id ? updated : r);
    setRequests(updatedList);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));

    setEditingReq(null);
    if (status === 'Concluido') {
      onMascotMoodChange('happy', 'Canal do YouTube verificado com sucesso!');
    } else if (status === 'Rejeitado') {
      onMascotMoodChange('angry', 'Solicitação de verificação rejeitada.');
    } else {
      onMascotMoodChange('normal', 'Solicitação atualizada.');
    }
  };

  const handleDeleteRequest = async (id: string, name: string) => {
    if (window.confirm(`Deseja remover o pedido de verificação de ${name}?`)) {
      try {
        const docRef = doc(db, 'youtube_verification_requests', id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn("Firestore delete failed, fallback to local:", err);
      }
      const updatedList = requests.filter(r => r.id !== id);
      setRequests(updatedList);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
      onMascotMoodChange('normal', 'Solicitação excluída.');
    }
  };

  const openEditModal = (req: YouTubeVerificationRequest) => {
    setEditingReq(req);
    setStatus(req.status);
    setAdminNotes(req.adminNotes || '');
  };

  // Filter & Search
  const filteredRequests = requests.filter(r => {
    const matchesSearch = r.channelName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          r.contactEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'All' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h3 className="font-orbitron font-black text-xl text-black">VERIFICAÇÃO DE CANAIS YOUTUBE (OAC)</h3>
        <p className="text-xs text-gray-500">
          Gerencie e ative as solicitações de selo de Canal Oficial do Artista (OAC) enviadas pelos artistas vinculados à Lockdown.
        </p>
      </div>

      {/* Filters bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
        <div className="sm:col-span-8 relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome do canal, e-mail de contato ou e-mail de envio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2 text-xs font-sans text-black focus:outline-none focus:border-[#FF0033]"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-orbitron font-bold text-gray-700 focus:outline-none"
          >
            <option value="All">STATUS: TODOS</option>
            <option value="Enviado">Enviado / Novo</option>
            <option value="Em processamento">Em Processamento</option>
            <option value="Concluido">Concluído</option>
            <option value="Rejeitado">Rejeitado</option>
          </select>
        </div>
      </div>

      {/* Table list of Requests */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 grid grid-cols-12 text-[10px] font-orbitron font-bold text-gray-600 gap-4">
          <div className="col-span-4">NOME DO CANAL • CONTATO</div>
          <div className="col-span-2 text-center">INSCRITOS (EST.)</div>
          <div className="col-span-2">DISTRIBUIDORA</div>
          <div className="col-span-2 text-center">STATUS</div>
          <div className="col-span-2 text-right">AÇÕES</div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredRequests.map(req => (
            <div key={req.id} className="px-6 py-4 grid grid-cols-12 items-center hover:bg-gray-50 transition-colors text-xs gap-4">
              <div className="col-span-4 space-y-1">
                <div className="flex items-center space-x-2">
                  <Youtube className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="font-orbitron font-black text-black text-sm">{req.channelName}</span>
                </div>
                <div className="text-gray-500 font-sans text-[10px] space-y-0.5 pl-6">
                  <div>Contato: {req.contactEmail}</div>
                  <div>Enviado por: {req.userEmail}</div>
                </div>
              </div>

              <div className="col-span-2 text-center font-orbitron font-black text-gray-800">
                {new Intl.NumberFormat('pt-BR').format(req.subscriberCount)}
              </div>

              <div className="col-span-2 font-orbitron font-bold text-gray-700">
                {req.currentDistributor}
              </div>

              <div className="col-span-2 text-center">
                <span className={`font-orbitron text-[9px] font-bold px-2.5 py-1 rounded-full ${
                  req.status === 'Concluido' ? 'bg-emerald-50 text-emerald-600' :
                  req.status === 'Rejeitado' ? 'bg-red-50 text-red-600' : 
                  req.status === 'Em processamento' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {req.status === 'Concluido' ? 'CONCLUÍDO' : 
                   req.status === 'Rejeitado' ? 'REJEITADO' : 
                   req.status === 'Em processamento' ? 'EM PROCESSAMENTO' : 'RECEBIDO'}
                </span>
              </div>

              <div className="col-span-2 flex items-center justify-end space-x-2">
                <a 
                  href={req.channelLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-red-50 text-[#FF0033] transition-colors"
                  title="Abrir Canal no YouTube"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => openEditModal(req)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
                  title="Análise / Retorno"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteRequest(req.id, req.channelName)}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {filteredRequests.length === 0 && (
            <div className="py-12 text-center text-gray-400 font-orbitron text-xs">
              {isLoading ? 'Carregando solicitações...' : 'Nenhum pedido de verificação pendente.'}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: ADMIN EVALUATION */}
      <AnimatePresence>
        {editingReq && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-gray-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <span className="font-orbitron text-[9px] text-red-600 block tracking-widest font-bold">AVALIAÇÃO DE SELO OAC</span>
                  <h4 className="font-orbitron font-black text-black">RETORNO DO PEDIDO • {editingReq.channelName}</h4>
                </div>
                <button onClick={() => setEditingReq(null)} className="text-gray-500 hover:text-black">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRequest} className="p-6 space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl text-xs space-y-1 border border-gray-200">
                  <div className="font-sans"><strong className="font-orbitron">Canal:</strong> {editingReq.channelName}</div>
                  <div className="font-sans"><strong className="font-orbitron">Link:</strong> <a href={editingReq.channelLink} target="_blank" rel="noreferrer" className="text-red-600 hover:underline inline-flex items-center space-x-1">{editingReq.channelLink} <ExternalLink className="w-3 h-3 ml-1" /></a></div>
                  <div className="font-sans"><strong className="font-orbitron">Distribuidora:</strong> {editingReq.currentDistributor}</div>
                  <div className="font-sans"><strong className="font-orbitron">Sua mensagem:</strong> "{editingReq.notes || 'Sem observações.'}"</div>
                </div>

                <div>
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">ALTERAR STATUS</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-black focus:outline-none"
                  >
                    <option value="Enviado">Enviado (Novo)</option>
                    <option value="Em processamento">Em Processamento / Análise da Google</option>
                    <option value="Concluido">Concluído (Verificado!)</option>
                    <option value="Rejeitado">Rejeitado</option>
                  </select>
                </div>

                <div>
                  <label className="font-orbitron text-[10px] text-gray-500 block font-bold mb-1">NOTAS DE RETORNO PARA O ARTISTA</label>
                  <textarea
                    rows={4}
                    value={adminNotes}
                    onChange={e => setAdminNotes(e.target.value)}
                    placeholder="Pedido encaminhado para a equipe da Believe para liberação direta junto ao YouTube. Prazo estimado: 5 a 10 dias úteis..."
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs font-sans text-black focus:outline-none focus:border-[#FF0033]"
                  />
                </div>

                <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingReq(null)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-xs font-orbitron font-bold"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    className="bg-[#FF0033] hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-xs font-orbitron font-bold shadow"
                  >
                    ATUALIZAR SOLICITAÇÃO
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
