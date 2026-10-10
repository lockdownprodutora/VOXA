import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, setDoc, query, where, writeBatch } from 'firebase/firestore';
import { SOCIAL_CONFIG } from '../../utils/socialConfig';
import { recalculateFollowCounters, followVoxaUser } from '../../utils/storeDb';
import { Activity, ShieldAlert, RefreshCw, Sparkles, CheckCircle2, Terminal } from 'lucide-react';

interface SocialDiagnosticsModuleProps {
  onBackToMenu: () => void;
}

export const SocialDiagnosticsModule: React.FC<SocialDiagnosticsModuleProps> = ({ onBackToMenu }) => {
  const [loading, setLoading] = useState(false);
  const [totalFollows, setTotalFollows] = useState<number | null>(null);
  const [inconsistentProfiles, setInconsistentProfiles] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [migrationStatus, setMigrationStatus] = useState<string>("Pronto para diagnóstico");

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 99)]);
  };

  const runDiagnostic = async () => {
    setLoading(true);
    addLog("Iniciando diagnóstico social...");
    try {
      // 1. Fetch all follows
      const followsSnap = await getDocs(collection(db, 'follows'));
      setTotalFollows(followsSnap.size);
      addLog(`Total de relações de follow registradas: ${followsSnap.size}`);

      // 2. Fetch all users
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersList: any[] = [];
      usersSnap.forEach(d => {
        usersList.push({ uid: d.id, ...d.data() });
      });
      addLog(`Analisando consistência de contadores para ${usersList.length} usuários...`);

      // 3. Find followers and following realities
      const followsList: any[] = [];
      followsSnap.forEach(d => {
        const data = d.data();
        followsList.push({
          followerId: data.followerId || data.followerUid,
          followingId: data.followingId || data.followingUid
        });
      });

      const inconsistent: any[] = [];

      for (const user of usersList) {
        const actualFollowers = followsList.filter(f => f.followingId === user.uid).length;
        const actualFollowing = followsList.filter(f => f.followerId === user.uid).length;

        const reportedFollowers = user.followersCount || 0;
        const reportedFollowing = user.followingCount || 0;

        if (actualFollowers !== reportedFollowers || actualFollowing !== reportedFollowing) {
          inconsistent.push({
            uid: user.uid,
            name: user.name || "Sem Nome",
            username: user.username || user.slug || "user",
            reportedFollowers,
            actualFollowers,
            reportedFollowing,
            actualFollowing
          });
        }
      }

      setInconsistentProfiles(inconsistent);
      if (inconsistent.length > 0) {
        addLog(`🚨 Encontrados ${inconsistent.length} perfis com inconsistência nos contadores!`);
        setMigrationStatus("Inconsistências encontradas!");
      } else {
        addLog("✨ Excelente! Todos os perfis estão com contadores 100% consistentes!");
        setMigrationStatus("Banco de dados consistente");
      }

    } catch (err: any) {
      addLog(`❌ Erro no diagnóstico: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    setLoading(true);
    addLog("Iniciando recálculo geral de contadores...");
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      let count = 0;
      for (const d of usersSnap.docs) {
        await recalculateFollowCounters(d.id);
        count++;
        if (count % 10 === 0) {
          addLog(`Processados ${count} usuários...`);
        }
      }
      addLog(`✨ Sucesso! Recálculo concluído para todos os ${count} perfis.`);
      await runDiagnostic(); // refresh numbers
    } catch (err: any) {
      addLog(`❌ Erro ao recalcular: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeOfficial = async () => {
    setLoading(true);
    addLog("Inicializando contas oficiais da plataforma...");
    try {
      const batch = writeBatch(db);

      // 1. Sync voxa account
      const voxaRef = doc(db, 'users', SOCIAL_CONFIG.VOXA_UID);
      batch.set(voxaRef, {
        username: "voxa",
        slug: "voxa",
        name: "VOXA",
        email: "lockdownprodutora@gmail.com",
        accountType: "Empresa",
        role: "ADMINISTRADOR",
        status: "Ativo",
        isVerified: true,
        verified: true,
        defaultFollowsInitialized: true // official accounts don't self-follow
      }, { merge: true });
      addLog("Conta oficial @voxa sincronizada no batch...");

      // 2. Sync founder account
      const founderRef = doc(db, 'users', SOCIAL_CONFIG.JUNIORSANTTI92_UID);
      batch.set(founderRef, {
        username: "jrsantti",
        slug: "jrsantti",
        name: "Junior Santti",
        email: "juniorsantti92@gmail.com",
        accountType: "Artista",
        status: "Ativo",
        isVerified: true,
        verified: true,
        defaultFollowsInitialized: true // official accounts don't self-follow
      }, { merge: true });
      addLog("Conta do fundador @jrsantti sincronizada no batch...");

      await batch.commit();
      addLog("✅ Batch de contas oficiais gravado com sucesso!");

      // 3. Migrate and auto-follow for users who haven't initialized default follows
      addLog("Iniciando varredura para auto-follow inicial de usuários existentes...");
      const usersSnap = await getDocs(collection(db, 'users'));
      let migratedCount = 0;

      for (const d of usersSnap.docs) {
        const uid = d.id;
        const data = d.data();
        if (uid === SOCIAL_CONFIG.VOXA_UID || uid === SOCIAL_CONFIG.JUNIORSANTTI92_UID) {
          continue;
        }

        if (data.defaultFollowsInitialized !== true) {
          addLog(`Aplicando auto-follow para: ${data.name || uid}...`);
          
          // Follow VOXA
          await followVoxaUser(uid, SOCIAL_CONFIG.VOXA_UID, { silent: true, source: 'default_follow' });
          // Follow Founder
          await followVoxaUser(uid, SOCIAL_CONFIG.JUNIORSANTTI92_UID, { silent: true, source: 'default_follow' });

          // Set marked
          await setDoc(doc(db, 'users', uid), { defaultFollowsInitialized: true }, { merge: true });
          migratedCount++;
        }
      }

      addLog(`✨ Varredura finalizada! ${migratedCount} perfis receberam os auto-follows oficiais silenciosamente.`);

      // 4. Recount and reconcile followersCount and followingCount for EVERY user in the database
      addLog("Iniciando recalculador e sincronização de contadores de seguidores com base nas relações reais...");
      let recountCount = 0;
      for (const d of usersSnap.docs) {
        const uid = d.id;
        const data = d.data();
        
        // Query physical followers
        const followersSnap = await getDocs(query(collection(db, 'follows'), where('followingId', '==', uid)));
        const followersCount = followersSnap.size;
        
        // Query physical followings
        const followingSnap = await getDocs(query(collection(db, 'follows'), where('followerId', '==', uid)));
        const followingCount = followingSnap.size;
        
        await setDoc(doc(db, 'users', uid), {
          followersCount,
          followingCount
        }, { merge: true });
        
        recountCount++;
      }
      addLog(`✨ Recalculador finalizado! Sincronizados os contadores de ${recountCount} perfis baseados em follows reais.`);

      await runDiagnostic();
    } catch (err: any) {
      addLog(`❌ Erro ao inicializar contas oficiais: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-200">
        <div>
          <span className="font-orbitron text-xs text-[#FF0033] tracking-widest block font-bold">MÓDULO 14</span>
          <h1 className="text-3xl font-black font-orbitron tracking-tight text-black">DIAGNÓSTICO SOCIAL</h1>
          <p className="text-gray-500 text-xs mt-1">Ferramenta central de auditoria e consistência atômica da rede de follows.</p>
        </div>
        <button
          onClick={onBackToMenu}
          className="mt-4 md:mt-0 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-orbitron font-bold text-xs py-2 px-5 rounded-xl transition-all cursor-pointer shadow-sm"
        >
          MENU PRINCIPAL
        </button>
      </div>

      {/* Grid Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Status Card */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
          <span className="font-orbitron text-[10px] text-gray-400 tracking-widest block font-bold">STATUS DA REDE</span>
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${inconsistentProfiles.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
            <span className="font-orbitron font-black text-lg uppercase text-black">{migrationStatus}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 text-xs">
            <div>
              <span className="text-gray-400 block font-mono text-[9px] uppercase">Relações Follow</span>
              <span className="text-black font-bold font-mono text-base">{totalFollows !== null ? totalFollows : 'Carregando...'}</span>
            </div>
            <div>
              <span className="text-gray-400 block font-mono text-[9px] uppercase">Inconsistentes</span>
              <span className={`font-bold font-mono text-base ${inconsistentProfiles.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {inconsistentProfiles.length}
              </span>
            </div>
          </div>
        </div>

        {/* Actions Card */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4 md:col-span-2 flex flex-col justify-between">
          <span className="font-orbitron text-[10px] text-[#FF0033] tracking-widest block font-bold">AÇÕES DISPONÍVEIS</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            <button
              onClick={runDiagnostic}
              disabled={loading}
              className="bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 font-orbitron font-bold text-xs py-3 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>RODAR SCAN</span>
            </button>

            <button
              onClick={handleRecalculate}
              disabled={loading}
              className="bg-black hover:bg-zinc-800 text-white font-orbitron font-bold text-xs py-3 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              <span>RECALCULAR TUDO</span>
            </button>

            <button
              onClick={handleInitializeOfficial}
              disabled={loading}
              className="bg-[#FF0033] hover:bg-[#d6002b] text-white font-orbitron font-bold text-xs py-3 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-red-600/10 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>CONTA OFICIAL</span>
            </button>

          </div>
        </div>

      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left column: Inconsistencies List */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col h-[450px]">
          <span className="font-orbitron text-[10px] text-gray-400 tracking-widest block font-bold mb-4">PERFIS INCONSISTENTES</span>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {inconsistentProfiles.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 font-sans space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <span className="text-xs font-semibold uppercase font-orbitron text-gray-500">Banco Saudável!</span>
                <p className="text-[11px] max-w-xs">Nenhum perfil com desvio ou contagem errônea de seguidores na rede.</p>
              </div>
            ) : (
              inconsistentProfiles.map(u => (
                <div key={u.uid} className="bg-amber-50/60 border border-amber-200 p-3 rounded-2xl flex items-center justify-between text-xs font-sans">
                  <div>
                    <h4 className="font-bold text-gray-800 uppercase font-orbitron text-[11px]">{u.name}</h4>
                    <span className="text-gray-500 block">@{u.username}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-white border border-amber-300 px-2.5 py-1 rounded-xl">
                      <span className="block text-[8px] text-gray-400 uppercase font-bold">Seguidores</span>
                      <span className="font-mono font-bold text-red-500">{u.reportedFollowers}</span>
                      <span className="text-gray-400 mx-1">→</span>
                      <span className="font-mono font-bold text-emerald-600">{u.actualFollowers}</span>
                    </div>
                    <div className="bg-white border border-amber-300 px-2.5 py-1 rounded-xl">
                      <span className="block text-[8px] text-gray-400 uppercase font-bold">Seguindo</span>
                      <span className="font-mono font-bold text-red-500">{u.reportedFollowing}</span>
                      <span className="text-gray-400 mx-1">→</span>
                      <span className="font-mono font-bold text-emerald-600">{u.actualFollowing}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column: Logs */}
        <div className="bg-black/95 p-6 rounded-3xl border border-white/15 flex flex-col h-[450px]">
          <div className="flex items-center justify-between mb-4">
            <span className="font-orbitron text-[10px] text-gray-400 tracking-widest block font-bold flex items-center space-x-1.5 text-red-500">
              <Terminal className="w-4 h-4 text-red-500" />
              <span>LOG CONSOLE</span>
            </span>
            <button
              onClick={() => setLogs([])}
              className="text-[9px] font-orbitron text-gray-500 hover:text-white"
            >
              LIMPAR
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[10px] text-green-400 bg-black p-3.5 rounded-2xl border border-white/5 scrollbar-none">
            {logs.length === 0 ? (
              <span className="text-gray-600 italic">Nenhum log gravado nesta sessão. Execute uma ação acima para iniciar logs.</span>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="leading-relaxed border-b border-zinc-900/50 pb-0.5 whitespace-pre-wrap">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
