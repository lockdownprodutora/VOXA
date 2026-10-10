import React, { useState, useEffect } from 'react';
import { 
  Trash2, Shield, AlertTriangle, CheckCircle, Search, 
  MessageSquare, Heart, Repeat, ArrowLeft, RefreshCw, Eye
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { 
  collection, getDocs, doc, deleteDoc, setDoc, 
  getDoc, query, where, onSnapshot 
} from 'firebase/firestore';

interface VoxModModuleProps {
  onBack: () => void;
}

export const VoxModModule: React.FC<VoxModModuleProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'reports'>('all');
  const [voxes, setVoxes] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [modToast, setModToast] = useState('');

  // Sync real-time VOXes and Reports
  useEffect(() => {
    setLoading(true);
    const unsubVox = onSnapshot(collection(db, 'voxes'), (snap) => {
      const list: any[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setVoxes(list);
      setLoading(false);
    });

    const unsubReports = onSnapshot(collection(db, 'vox_reports'), (snap) => {
      const list: any[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setReports(list);
    });

    return () => {
      unsubVox();
      unsubReports();
    };
  }, []);

  const triggerToast = (msg: string) => {
    setModToast(msg);
    setTimeout(() => setModToast(''), 3000);
  };

  // Register in admin_audit_logs
  const logAdminAction = async (action: string, targetId: string, details: string) => {
    try {
      const logId = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const savedUser = localStorage.getItem('voxa_current_user');
      const currentUser = savedUser ? JSON.parse(savedUser) : { name: 'Admin', email: 'admin@lockdownprodutora.com.br' };
      
      await setDoc(doc(db, 'admin_audit_logs', logId), {
        id: logId,
        adminName: currentUser.name,
        adminEmail: currentUser.email,
        action,
        targetId,
        details,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn("Could not log admin audit action:", e);
    }
  };

  // Delete VOX
  const handleDeleteVox = async (voxId: string, authorName: string, reason: string) => {
    if (!window.confirm(`Deseja realmente remover o VOX de "${authorName}"?`)) return;
    try {
      // 1. Delete VOX document
      await deleteDoc(doc(db, 'voxes', voxId));

      // 2. Also delete associated repost references
      const q = query(collection(db, 'voxes'), where('repostOf', '==', voxId));
      const repostsSnap = await getDocs(q);
      repostsSnap.forEach(async (d) => {
        await deleteDoc(doc(db, 'voxes', d.id));
      });

      // 3. Mark any report associated with this VOX as Resolvido
      const associatedReports = reports.filter(r => r.voxId === voxId && r.status !== 'Resolvido');
      for (const rep of associatedReports) {
        await setDoc(doc(db, 'vox_reports', rep.id), { status: 'Resolvido', resolvedAt: new Date().toISOString() }, { merge: true });
      }

      // 4. Log
      await logAdminAction('REMOÇÃO_VOX', voxId, `Remoção do VOX de ${authorName}. Motivo: ${reason}`);

      triggerToast('VOX removido e logs de auditoria gravados.');
    } catch (err: any) {
      alert('Erro ao moderar VOX: ' + err.message);
    }
  };

  // Keep VOX / Ignore report
  const handleResolveReport = async (reportId: string, reason: string) => {
    try {
      await setDoc(doc(db, 'vox_reports', reportId), { 
        status: 'Resolvido', 
        resolvedAt: new Date().toISOString(),
        resolutionDetails: reason
      }, { merge: true });

      await logAdminAction('IGNORAR_DENÚNCIA', reportId, `Denúncia marcada como resolvida (mantida). Detalhes: ${reason}`);
      triggerToast('Denúncia desconsiderada com sucesso.');
    } catch (err: any) {
      alert('Erro ao resolver denúncia: ' + err.message);
    }
  };

  // Search filtered publications
  const filteredVoxes = voxes.filter(v => {
    const q = searchQuery.toLowerCase();
    return (
      (v.text || '').toLowerCase().includes(q) ||
      (v.authorName || '').toLowerCase().includes(q) ||
      (v.authorUsername || '').toLowerCase().includes(q)
    );
  });

  const pendingReports = reports.filter(r => r.status === 'Pendente');

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 p-6 bg-white border border-gray-200 rounded-[32px] text-left shadow-xl animate-fadeIn">
      {/* Toast Notification */}
      {modToast && (
        <div className="fixed top-12 right-12 z-50 bg-[#12111d] text-white border-2 border-[#FF0033] py-3 px-5 rounded-2xl shadow-2xl flex items-center space-x-3.5 animate-bounce">
          <CheckCircle className="w-5 h-5 text-[#FF0033] shrink-0" />
          <span className="font-orbitron font-bold text-xs">{modToast}</span>
        </div>
      )}

      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-5 gap-4">
        <div className="flex items-center space-x-4">
          <button 
            onClick={onBack}
            className="p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-gray-500 hover:text-black cursor-pointer transition-all"
            title="Voltar ao Painel"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-[#FF0033]" />
              <span className="text-[#FF0033] font-orbitron text-[10px] tracking-widest block font-bold uppercase">Moderação de Conteúdo</span>
            </div>
            <h1 className="font-orbitron font-black text-2xl text-black mt-1">CONTEÚDO → VOX</h1>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex space-x-2 bg-gray-100 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 font-orbitron font-bold text-xs rounded-xl transition-all cursor-pointer ${activeTab === 'all' ? 'bg-[#FF0033] text-white shadow-md' : 'text-gray-500 hover:text-black hover:bg-white/5'}`}
          >
            TODOS OS VOX ({voxes.length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 font-orbitron font-bold text-xs rounded-xl transition-all cursor-pointer relative ${activeTab === 'reports' ? 'bg-[#FF0033] text-white shadow-md' : 'text-gray-500 hover:text-black hover:bg-white/5'}`}
          >
            DENÚNCIAS ({pendingReports.length})
            {pendingReports.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#FF0033] text-white flex items-center justify-center text-[9px] font-black animate-pulse">
                {pendingReports.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active tab content */}
      {activeTab === 'all' ? (
        <div className="space-y-6">
          {/* Search bar */}
          <div className="relative max-w-md w-full">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 pointer-events-none">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por texto, autor ou @username..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-xs text-black placeholder-gray-400 focus:outline-none focus:border-[#FF0033] font-sans"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="w-8 h-8 border-4 border-gray-200 border-t-[#FF0033] rounded-full animate-spin"></span>
            </div>
          ) : filteredVoxes.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 border border-dashed border-gray-200 rounded-[24px]">
              <p className="font-orbitron font-bold text-xs text-gray-400 uppercase tracking-widest">Nenhuma publicação encontrada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredVoxes.map(v => (
                <div key={v.id} className="bg-gray-50 border border-gray-200 p-5 rounded-[24px] flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <img src={v.authorAvatar} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-300" />
                        <div className="leading-tight text-left">
                          <span className="text-black font-bold font-orbitron text-xs block uppercase">{v.authorName}</span>
                          <span className="text-gray-500 text-[9px] block">@{v.authorUsername}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">{v.createdAt?.substring(0, 10)}</span>
                    </div>

                    <p className="text-gray-700 text-xs sm:text-sm font-sans mt-3.5 leading-relaxed break-words">
                      {v.text || <span className="italic text-gray-400 font-bold uppercase text-[9px] font-orbitron">[ REPOST DE VOX INDIRETO ]</span>}
                    </p>

                    {v.media && v.media.length > 0 && (
                      <div className="mt-3.5 grid grid-cols-2 gap-2">
                        {v.media.map((m: string, i: number) => (
                          <div key={i} className="aspect-video rounded-xl overflow-hidden bg-black border border-gray-200">
                            <img src={m} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200 mt-auto">
                    <div className="flex space-x-3 text-gray-500 text-[10px] font-mono">
                      <span>❤️ {v.likeCount || 0}</span>
                      <span>💬 {v.replyCount || 0}</span>
                      <span>🔁 {v.repostCount || 0}</span>
                    </div>

                    <button
                      onClick={() => handleDeleteVox(v.id, v.authorName, 'Moderação Direta Admin')}
                      className="bg-red-50 hover:bg-[#FF0033] text-[#FF0033] hover:text-white border border-[#FF0033]/20 hover:border-transparent rounded-xl px-4 py-2 font-orbitron font-bold text-[9px] transition-all flex items-center space-x-1.5 cursor-pointer uppercase tracking-wider"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>DELETAR VOX</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {pendingReports.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 border border-dashed border-gray-200 rounded-[24px]">
              <p className="font-orbitron font-bold text-xs text-gray-400 uppercase tracking-widest">Nenhuma denúncia pendente. Excelente trabalho!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingReports.map(rep => (
                <div key={rep.id} className="bg-amber-50/40 border border-amber-200/60 p-6 rounded-[28px] space-y-4 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                  <div className="space-y-3.5 text-left flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-amber-100 text-amber-800 font-orbitron font-extrabold text-[9px] px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>MOTIVO: {rep.reason?.toUpperCase()}</span>
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">Denunciante: {rep.reporterName}</span>
                      <span className="text-gray-400 font-mono text-[10px]">•</span>
                      <span className="text-[10px] text-gray-500 font-mono">Data: {rep.createdAt?.substring(0, 16).replace('T', ' ')}</span>
                    </div>

                    <div className="bg-white border border-gray-200 p-4 rounded-2xl space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-orbitron font-bold text-[10px] text-gray-500 uppercase block">CONTEÚDO DENUNCIADO:</span>
                      </div>
                      <p className="text-xs text-gray-800 font-sans leading-relaxed break-words italic">"{rep.voxText || '[ Conteúdo textual ausente ]'}"</p>
                    </div>
                  </div>

                  <div className="flex md:flex-col gap-2 shrink-0 justify-end">
                    <button
                      onClick={() => handleDeleteVox(rep.voxId, 'Autor', `Denunciado por ${rep.reason}`)}
                      className="bg-[#FF0033] hover:bg-red-700 text-white rounded-xl px-5 py-3 font-orbitron font-black text-[10px] transition-all flex items-center justify-center space-x-1.5 cursor-pointer uppercase tracking-wider"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>REMOVER VOX</span>
                    </button>

                    <button
                      onClick={() => handleResolveReport(rep.id, 'Mantido pelo Admin: Denúncia improcedente')}
                      className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-xl px-5 py-3 font-orbitron font-bold text-[10px] transition-all flex items-center justify-center space-x-1.5 cursor-pointer uppercase tracking-wider"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>IGNORAR DENÚNCIA</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
