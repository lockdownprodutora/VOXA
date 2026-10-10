import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Play, Pause, ArrowLeft, RotateCcw, Volume2, Sparkles, AlertCircle, Camera, Upload, Image as ImageIcon, X } from 'lucide-react';
import { ReleaseTrack } from '../../types';
import { MascotDuck } from '../MascotDuck';

interface TikTokReleasesProps {
  releases: ReleaseTrack[];
  onUpdateStatus: (id: string, status: 'Aprovado' | 'Reprovado') => void;
  onBack: () => void;
  onMascotMoodChange: (mood: 'normal' | 'attentive' | 'happy' | 'angry' | 'pointing', speech: string) => void;
}

export const TikTokReleases: React.FC<TikTokReleasesProps> = ({
  releases: initialReleases,
  onUpdateStatus,
  onBack,
  onMascotMoodChange
}) => {
  const [releases, setReleases] = useState<ReleaseTrack[]>(initialReleases);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stampAction, setStampAction] = useState<'Aprovado' | 'Reprovado' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const pendingReleases = releases.filter(r => r.status === 'Pendente');
  const activeRelease = pendingReleases[currentIndex] || releases[0];

  const handleAction = (status: 'Aprovado' | 'Reprovado') => {
    if (!activeRelease) return;
    setStampAction(status);
    onUpdateStatus(activeRelease.id, status);

    if (status === 'Aprovado') {
      onMascotMoodChange('happy', 'Brabo! Som aprovado pra rua!');
    } else {
      onMascotMoodChange('angry', 'Reprovado! Esse som tá fraco demais!');
    }

    setTimeout(() => {
      setStampAction(null);
      if (currentIndex < pendingReleases.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setCurrentIndex(0);
      }
    }, 800);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeRelease) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setReleases(prev => prev.map(r => r.id === activeRelease.id ? { ...r, albumCover: result } : r));
          setIsCustomizeOpen(false);
          onMascotMoodChange('happy', 'Capa personalizada carregada com sucesso!');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateAICover = () => {
    if (!activeRelease) return;
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      const aiImages = [
        'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=800&auto=format&fit=crop',
      ];
      const randomImg = aiImages[Math.floor(Math.random() * aiImages.length)];
      setReleases(prev => prev.map(r => r.id === activeRelease.id ? { ...r, albumCover: randomImg } : r));
      setIsCustomizeOpen(false);
      onMascotMoodChange('happy', 'Capa gerada por IA com estilo Cyberpunk aplicada!');
    }, 1200);
  };

  return (
    <div className="h-full flex flex-col justify-between p-4 md:p-8 max-w-5xl mx-auto w-full">
      {/* Top Header inside module */}
      <div className="flex items-center justify-between pb-6 border-b border-white/10">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 bg-[#161616] hover:bg-[#222] border border-white/10 px-4 py-2 rounded-xl text-xs font-orbitron text-gray-300 hover:text-white transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>VOLTAR AOS MÓDULOS</span>
        </button>

        <div className="flex items-center space-x-3">
          <span className="w-3 h-3 rounded-full bg-[#FF0033] animate-pulse"></span>
          <span className="font-orbitron font-bold text-sm tracking-wider text-white">
            MODO TIKTOK • PENDENTES ({pendingReleases.length})
          </span>
        </div>
      </div>

      {/* Main TikTok Feed Card Area */}
      <div className="flex-1 flex items-center justify-center py-6">
        {pendingReleases.length === 0 ? (
          <div className="text-center glass-card p-12 rounded-3xl border border-[#FF0033]/40 max-w-md">
            <Sparkles className="w-12 h-12 text-[#FF0033] mx-auto mb-4 animate-bounce" />
            <h3 className="font-orbitron font-bold text-2xl text-white">FILA ZERADA!</h3>
            <p className="text-gray-400 text-sm mt-2">Todos os lançamentos foram revisados pelo Lock.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 bg-[#FF0033] text-black font-orbitron font-bold px-6 py-3 rounded-xl text-xs glow-red flex items-center space-x-2 mx-auto"
            >
              <RotateCcw className="w-4 h-4" />
              <span>REINICIAR DEMOS</span>
            </button>
          </div>
        ) : (
          <div className="relative w-full max-w-md aspect-[9/14] sm:aspect-[4/5] glass-card rounded-3xl border-2 border-[#FF0033] p-6 flex flex-col justify-between overflow-hidden shadow-2xl glow-red">
            {/* Glowing red edge border effect */}
            <div className="absolute inset-0 border-2 border-[#FF0033] rounded-3xl animate-pulse pointer-events-none"></div>

            {/* Stamp Overlay Effect */}
            <AnimatePresence>
              {stampAction && (
                <motion.div
                  initial={{ scale: 2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm`}
                >
                  <div className={`border-8 px-8 py-4 rounded-2xl transform -rotate-12 font-orbitron font-black text-4xl sm:text-5xl tracking-widest ${
                    stampAction === 'Aprovado' 
                      ? 'border-emerald-500 text-emerald-500 bg-emerald-950/80 shadow-[0_0_50px_rgba(16,185,129,0.6)]' 
                      : 'border-[#FF0033] text-[#FF0033] bg-red-950/80 shadow-[0_0_50px_rgba(255,0,51,0.6)]'
                  }`}>
                    {stampAction.toUpperCase()}!
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Top track info & Customize Cover button */}
            <div className="relative z-10 flex items-center justify-between">
              <span className="bg-black/80 border border-[#FF0033] text-[#FF0033] font-orbitron text-[10px] px-3 py-1 rounded-full">
                {activeRelease.genre}
              </span>

              <button
                onClick={() => setIsCustomizeOpen(true)}
                className="bg-[#FF0033]/20 hover:bg-[#FF0033]/40 border border-[#FF0033] text-[#FF0033] font-orbitron text-[10px] px-3 py-1 rounded-xl flex items-center space-x-1 transition-all cursor-pointer glow-red"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>EDITAR CAPA</span>
              </button>
            </div>

            {/* Center Album Cover & Visualizer */}
            <div className="relative z-10 flex flex-col items-center my-auto">
              <div className="relative w-48 h-48 sm:w-60 sm:h-60 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl group">
                <img
                  src={activeRelease.albumCover}
                  alt={activeRelease.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-16 h-16 rounded-full bg-[#FF0033] text-black flex items-center justify-center glow-red transform hover:scale-110 transition-transform cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-8 h-8 fill-black" /> : <Play className="w-8 h-8 fill-black ml-1" />}
                  </button>
                </div>
              </div>

              <div className="text-center mt-6">
                <h2 className="font-orbitron font-black text-2xl text-white tracking-wide">{activeRelease.title}</h2>
                <p className="text-gray-400 font-medium text-sm mt-1">{activeRelease.artist}</p>
                <span className="text-[10px] text-gray-500 font-orbitron mt-2 block">Adicionado: {activeRelease.dateAdded}</span>
              </div>
            </div>

            {/* Bottom Action Swipe Buttons */}
            <div className="relative z-10 grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <button
                onClick={() => handleAction('Reprovado')}
                className="bg-[#111] hover:bg-red-950/50 border-2 border-[#FF0033] text-[#FF0033] font-orbitron font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 transition-all cursor-pointer group"
              >
                <XCircle className="w-5 h-5 group-hover:scale-125 transition-transform" />
                <span>REPROVAR (←)</span>
              </button>

              <button
                onClick={() => handleAction('Aprovado')}
                className="bg-[#FF0033] hover:bg-red-600 text-black font-orbitron font-extrabold py-4 rounded-2xl flex items-center justify-center space-x-2 glow-red transition-all cursor-pointer group"
              >
                <CheckCircle2 className="w-5 h-5 group-hover:scale-125 transition-transform" />
                <span>APROVAR (→)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customize Cover Modal (Camera / File / AI Generation) */}
      <AnimatePresence>
        {isCustomizeOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card max-w-md w-full p-8 rounded-3xl border-2 border-[#FF0033] shadow-2xl relative overflow-hidden bg-black/95"
            >
              <button
                onClick={() => setIsCustomizeOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-2"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-[#FF0033]/20 border border-[#FF0033] flex items-center justify-center text-[#FF0033] glow-red">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-orbitron text-[10px] text-[#FF0033] tracking-widest block">PERSONALIZAÇÃO</span>
                  <h2 className="font-orbitron font-black text-xl text-white">CAPA DO LANÇAMENTO</h2>
                </div>
              </div>

              <div className="space-y-6">
                {/* Option 1: Upload from Device or Camera */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <span className="font-orbitron text-xs text-[#FF0033] block mb-2">1. UPLOAD OU FOTO (CÂMERA)</span>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/20 hover:border-[#FF0033] rounded-xl p-6 cursor-pointer transition-colors group">
                    <Upload className="w-8 h-8 text-gray-400 group-hover:text-[#FF0033] mb-2 transition-colors" />
                    <span className="font-orbitron text-xs text-white">CLIQUE PARA SELECIONAR OU TIRAR FOTO</span>
                    <span className="text-[10px] text-gray-500 mt-1">Suporta arquivos de imagem (PNG, JPG) ou Câmera</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Option 2: AI Cover Generator */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <span className="font-orbitron text-xs text-[#FF0033] block mb-2">2. GERAR CAPA COM IA (CYBERPUNK)</span>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Ex: Trap album cover with neon red laser and smoke..."
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-3 text-xs text-white focus:border-[#FF0033] focus:outline-none font-sans"
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleGenerateAICover}
                      disabled={isGenerating}
                      className="w-full bg-[#FF0033] hover:bg-[#d6002b] text-black font-orbitron font-bold py-3 rounded-xl text-xs flex items-center justify-center space-x-2 glow-red transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isGenerating ? 'GERANDO ARTE COM IA...' : 'GERAR CAPA VIA IA'}</span>
                    </motion.button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setIsCustomizeOpen(false)}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-orbitron font-bold py-3 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    CANCELAR
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

