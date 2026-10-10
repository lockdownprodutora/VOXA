import React from 'react';
import {
  Sparkles,
  Video,
  UserCheck,
  Wand2,
  Image as ImageIcon,
  Film,
  Type,
  Megaphone,
  Layers,
  Library,
  FolderKanban,
  ArrowRight,
  Play,
  Sliders,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { VoxaAiToolId, VoxaAiJobRecord, VoxaPresenterLibraryItem } from '../utils/voxaPresenterDb';

interface VoxaStudioIaDashboardProps {
  onSelectTool: (toolId: VoxaAiToolId) => void;
  recentJobs?: VoxaAiJobRecord[];
  recentLibrary?: VoxaPresenterLibraryItem[];
}

interface StudioCardMeta {
  id: VoxaAiToolId;
  title: string;
  subtitle: string;
  badge: 'NOVO' | 'POPULAR' | 'PREMIUM' | 'BETA';
  creditsLabel: string;
  thumbnail: string;
  icon: any;
  featured?: boolean;
}

const STUDIO_CARDS: StudioCardMeta[] = [
  {
    id: 'imagem_para_video',
    title: 'Imagem → Vídeo',
    subtitle: 'Transforme uma imagem em vídeo com IA. Envie uma imagem, escreva o que deve acontecer e gere seu vídeo.',
    badge: 'POPULAR',
    creditsLabel: '80 créditos',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=85',
    icon: Video,
    featured: true
  },
  {
    id: 'avatar_falante',
    title: 'Avatar Falante',
    subtitle: 'Faça seu avatar falar e se movimentar com sincronização labial e cenários de estúdio.',
    badge: 'PREMIUM',
    creditsLabel: 'A partir de 40 créditos',
    thumbnail: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
    icon: Video
  },
  {
    id: 'criar_avatar',
    title: 'Criar Avatar',
    subtitle: 'Crie seu personagem digital consistente para vídeos, campanhas e conteúdos.',
    badge: 'POPULAR',
    creditsLabel: '20 créditos',
    thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    icon: UserCheck
  },
  {
    id: 'gerar_imagem',
    title: 'Gerar Imagem',
    subtitle: 'Crie imagens em alta definição a partir de texto nos formatos 1:1, 4:5, 9:16 e 16:9.',
    badge: 'NOVO',
    creditsLabel: '16 créditos',
    thumbnail: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=800&q=80',
    icon: ImageIcon
  },
  {
    id: 'editar_imagem',
    title: 'Editar Imagem',
    subtitle: 'Transforme imagens usando IA: troque fundo, roupas, iluminação e estilo.',
    badge: 'NOVO',
    creditsLabel: '18 créditos',
    thumbnail: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
    icon: Sliders
  },
  {
    id: 'texto_para_video',
    title: 'Texto → Vídeo',
    subtitle: 'Transforme ideias em cenas cinematográficas geradas por inteligência artificial.',
    badge: 'PREMIUM',
    creditsLabel: '80 créditos',
    thumbnail: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80',
    icon: Type
  },
  {
    id: 'criar_anuncio',
    title: 'Criar Anúncio',
    subtitle: 'Gere criativos, roteiros UGC e peças comerciais para redes sociais.',
    badge: 'POPULAR',
    creditsLabel: '30 créditos',
    thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
    icon: Megaphone
  },
  {
    id: 'motion_transfer',
    title: 'Motion Transfer',
    subtitle: 'Use movimentos de um vídeo de referência para animar seu avatar com precisão.',
    badge: 'BETA',
    creditsLabel: '100 créditos',
    thumbnail: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=800&q=80',
    icon: Film
  },
  {
    id: 'character_replace',
    title: 'Character Replace',
    subtitle: 'Substitua o personagem de um vídeo autorizado pelo seu Avatar mantendo cena e luz.',
    badge: 'BETA',
    creditsLabel: '100 créditos',
    thumbnail: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&q=80',
    icon: Wand2
  },
  {
    id: 'criar_cenario',
    title: 'Criar Cenário',
    subtitle: 'Gere cenários de estúdio exclusivos ou personalize o ambiente das suas gravações.',
    badge: 'NOVO',
    creditsLabel: '16 créditos',
    thumbnail: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80',
    icon: Layers
  }
];

const INSPIRATION_ITEMS: Array<{
  id: string;
  category: 'Vídeo' | 'Avatar' | 'Anúncio' | 'Imagem' | 'Personagem';
  title: string;
  prompt: string;
  thumbnail: string;
  targetTool: VoxaAiToolId;
}> = [
  {
    id: 'insp_1',
    category: 'Vídeo',
    title: 'Apresentação Oficial em Estúdio Clean',
    prompt: 'Faça a apresentadora olhar para a câmera no estúdio branco VOXA e falar com expressão natural.',
    thumbnail: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=700&q=80',
    targetTool: 'imagem_para_video'
  },
  {
    id: 'insp_2',
    category: 'Avatar',
    title: 'Executivo Digital Consistente',
    prompt: 'Retrato de apresentador executivo moderno, iluminação de estúdio suave, olhar confiante.',
    thumbnail: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=700&q=80',
    targetTool: 'criar_avatar'
  },
  {
    id: 'insp_3',
    category: 'Anúncio',
    title: 'Campanha Comercial Sneaker Red Edition',
    prompt: 'Criativo comercial de alto impacto com iluminação vermelha e branca estilo estúdio VOXA.',
    thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80',
    targetTool: 'criar_anuncio'
  },
  {
    id: 'insp_4',
    category: 'Personagem',
    title: 'Creator Cyberpunk Neo-Tokyo',
    prompt: 'Personagem digital futurista com iluminação volumétrica neon vermelha e grafite.',
    thumbnail: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=700&q=80',
    targetTool: 'avatar_falante'
  },
  {
    id: 'insp_5',
    category: 'Imagem',
    title: 'Editorial Moda Minimalista',
    prompt: 'Fotografia editorial em fundo infinito branco com luz de recorte dramática.',
    thumbnail: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=700&q=80',
    targetTool: 'gerar_imagem'
  }
];

function getBadgeStyle(badge: StudioCardMeta['badge']) {
  switch (badge) {
    case 'POPULAR':
      return 'bg-[#FF0033] text-white border-[#FF0033]';
    case 'PREMIUM':
      return 'bg-white text-black border-white';
    case 'NOVO':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    case 'BETA':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  }
}

export const VoxaStudioIaDashboard: React.FC<VoxaStudioIaDashboardProps> = ({
  onSelectTool,
  recentJobs = []
}) => {
  const featuredTool = STUDIO_CARDS[0];
  const standardTools = STUDIO_CARDS.slice(1);

  return (
    <div className="space-y-12 pb-8 text-left">
      {/* 1. HERO PRINCIPAL DO VOXA AI STUDIO */}
      <section className="relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#14131d] via-[#0c0b12] to-[#09090b] p-7 sm:p-10 lg:p-12 shadow-2xl">
        <div className="absolute -top-28 -right-28 w-96 h-96 rounded-full bg-[#FF0033]/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 rounded-full bg-white/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/15">
              <Sparkles className="w-3.5 h-3.5 text-[#FF0033]" />
              <span className="font-orbitron font-bold text-[10px] tracking-widest uppercase text-white">
                ESTÚDIO CRIATIVO OFICIAL • VOXA AI
              </span>
            </div>

            <h1 className="font-orbitron font-black text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-[1.05]">
              VOXA <span className="text-[#FF0033]">AI Studio</span>
            </h1>

            <p className="text-gray-300 font-sans text-sm sm:text-base max-w-xl leading-relaxed">
              Crie imagens, avatares, vídeos e conteúdos com inteligência artificial.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                onClick={() => onSelectTool('imagem_para_video')}
                className="bg-[#FF0033] hover:bg-red-600 text-white font-orbitron font-black text-xs uppercase tracking-wider px-7 py-4 rounded-2xl shadow-lg shadow-[#FF0033]/25 transition-all hover:scale-[1.01] flex items-center gap-2.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Começar a criar</span>
              </button>

              <button
                onClick={() => onSelectTool('biblioteca_ia')}
                className="bg-white hover:bg-gray-100 text-black font-orbitron font-black text-xs uppercase tracking-wider px-6 py-4 rounded-2xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <Library className="w-4 h-4" />
                <span>Minha Biblioteca</span>
              </button>
            </div>
          </div>

          {/* Right Highlight Card: VOXA Official Studio Preset Preview */}
          <div className="lg:col-span-5">
            <div
              onClick={() => onSelectTool('avatar_falante')}
              className="group bg-white text-black rounded-3xl p-5 border border-white/20 shadow-2xl cursor-pointer transition-all hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF0033]" />
                  <span className="font-orbitron font-black text-[10px] tracking-widest uppercase text-black">
                    PRESET DESTAQUE • VOXA OFFICIAL STUDIO
                  </span>
                </div>
                <span className="bg-black text-white font-orbitron font-bold text-[9px] px-2.5 py-0.5 rounded-full uppercase">
                  FUNDO BRANCO PREMIUM
                </span>
              </div>

              <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-gradient-to-b from-gray-50 to-gray-200 border border-gray-200 flex items-center justify-center">
                <span className="absolute top-3 font-orbitron font-black text-4xl tracking-widest text-black/10 select-none">
                  VOXA
                </span>
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80"
                  alt="VOXA Official Studio"
                  loading="lazy"
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end justify-between p-4">
                  <div>
                    <span className="text-[10px] font-orbitron font-bold text-[#FF0033] uppercase block">
                      Avatar Falante • Até 40s
                    </span>
                    <span className="text-xs font-orbitron font-black text-white">
                      Fundo Branco + Logo VOXA + Lip-Sync Real
                    </span>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-[#FF0033] text-white flex items-center justify-center shadow-lg">
                    <Play className="w-4 h-4 fill-current" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. DESTAQUE PRINCIPAL: IMAGEM -> VÍDEO */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-orbitron font-bold text-[#FF0033] uppercase tracking-widest block">
              FERRAMENTA PRINCIPAL
            </span>
            <h2 className="font-orbitron font-black text-xl sm:text-2xl text-white uppercase">
              Destaque do Estúdio
            </h2>
          </div>
        </div>

        <div
          onClick={() => onSelectTool(featuredTool.id)}
          className="group relative rounded-3xl overflow-hidden border border-white/15 bg-[#14131d] hover:border-[#FF0033] transition-all duration-300 shadow-2xl cursor-pointer grid grid-cols-1 lg:grid-cols-12"
        >
          <div className="lg:col-span-7 relative min-h-[260px] sm:min-h-[320px] overflow-hidden bg-black">
            <img
              src={featuredTool.thumbnail}
              alt={featuredTool.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent" />
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#FF0033] text-white font-orbitron font-black text-[10px] uppercase tracking-wider">
                {featuredTool.badge}
              </span>
              <span className="px-3 py-1 rounded-full bg-black/75 backdrop-blur-md text-white font-mono font-bold text-[10px] border border-white/15">
                Google Veo 3.1
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between bg-gradient-to-br from-[#181724] to-[#0f0e17]">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FF0033]/15 border border-[#FF0033]/40 flex items-center justify-center text-[#FF0033]">
                <Video className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-orbitron font-black text-2xl sm:text-3xl text-white tracking-tight">
                  {featuredTool.title}
                </h3>
                <p className="text-gray-300 text-xs sm:text-sm font-sans mt-2 leading-relaxed">
                  Envie uma imagem, escreva o que deve acontecer e gere seu vídeo. Suporte a fala, movimento corporal, expressões e câmera cinematográfica em 9:16 ou 16:9.
                </p>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-orbitron text-gray-400 uppercase block">Custo por geração</span>
                <span className="font-mono font-bold text-xs text-white">{featuredTool.creditsLabel}</span>
              </div>
              <span className="inline-flex items-center gap-2 bg-[#FF0033] group-hover:bg-red-600 text-white font-orbitron font-black text-xs px-5 py-3 rounded-xl uppercase tracking-wider transition-all">
                <span>Abrir Ferramenta</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. GRID VISUAL DE TODAS AS FERRAMENTAS */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="text-[10px] font-orbitron font-bold text-[#FF0033] uppercase tracking-widest block">
              SUITE CRIATIVA COMPLETA
            </span>
            <h2 className="font-orbitron font-black text-xl sm:text-2xl text-white uppercase">
              Ferramentas de Inteligência Artificial
            </h2>
          </div>
          <p className="text-xs text-gray-400 font-sans">
            Selecione uma ferramenta para abrir o estúdio dedicado com preview em tempo real.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {standardTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                onClick={() => onSelectTool(tool.id)}
                className="group bg-[#14131d] border border-white/10 hover:border-[#FF0033]/70 rounded-3xl overflow-hidden flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 shadow-xl cursor-pointer"
              >
                <div>
                  <div className="relative aspect-[16/10] bg-zinc-900 overflow-hidden">
                    <img
                      src={tool.thumbnail}
                      alt={tool.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#14131d] via-black/20 to-transparent" />

                    <div className="absolute top-3 left-3">
                      <div className="w-10 h-10 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 flex items-center justify-center text-[#FF0033]">
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="absolute top-3 right-3">
                      <span
                        className={`px-2.5 py-1 rounded-full font-orbitron font-black text-[9px] uppercase tracking-wider border ${getBadgeStyle(
                          tool.badge
                        )}`}
                      >
                        {tool.badge}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 space-y-2">
                    <h3 className="font-orbitron font-black text-lg text-white group-hover:text-[#FF0033] transition-colors">
                      {tool.title}
                    </h3>
                    <p className="text-xs text-gray-300 font-sans leading-relaxed line-clamp-2">
                      {tool.subtitle}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-gray-400">{tool.creditsLabel}</span>
                  <span className="inline-flex items-center gap-1.5 font-orbitron font-bold text-[11px] text-white group-hover:text-[#FF0033] uppercase">
                    <span>Criar agora</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. SEÇÃO "INSPIRAÇÕES" (CRIAÇÕES EM DESTAQUE OFICIAIS VOXA) */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <span className="text-[10px] font-orbitron font-bold text-[#FF0033] uppercase tracking-widest block">
              GALERIA OFICIAL VOXA
            </span>
            <h2 className="font-orbitron font-black text-xl sm:text-2xl text-white uppercase">
              Inspirações & Criações em Destaque
            </h2>
          </div>
          <span className="text-xs text-gray-400">
            Clique em qualquer exemplo para abrir a ferramenta correspondente.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {INSPIRATION_ITEMS.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectTool(item.targetTool)}
              className="group relative rounded-2xl overflow-hidden border border-white/10 bg-[#14131d] hover:border-white/30 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="aspect-[4/5] relative overflow-hidden bg-zinc-900">
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white text-black font-orbitron font-black text-[9px] uppercase">
                  {item.category}
                </span>
                <div className="absolute bottom-3 left-3 right-3 space-y-1">
                  <h4 className="font-orbitron font-bold text-xs text-white leading-snug">{item.title}</h4>
                  <p className="text-[10px] text-gray-300 line-clamp-2 font-sans">"{item.prompt}"</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. PROJETOS RECENTES (EM CARDS MODERNOS) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-orbitron font-bold text-[#FF0033] uppercase tracking-widest block">
              ATIVIDADE DO ESTÚDIO
            </span>
            <h2 className="font-orbitron font-black text-xl text-white uppercase">
              Projetos Recentes
            </h2>
          </div>
          <button
            onClick={() => onSelectTool('meus_projetos')}
            className="text-xs font-orbitron font-bold text-[#FF0033] hover:underline cursor-pointer"
          >
            Ver todos os projetos →
          </button>
        </div>

        {recentJobs.length === 0 ? (
          <div className="bg-[#14131d] border border-white/10 rounded-3xl p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-orbitron font-bold text-sm text-white uppercase">
                Nenhum projeto recente ainda
              </h3>
              <p className="text-xs text-gray-400">
                Suas gerações de vídeos, avatares e imagens aparecerão aqui com status em tempo real.
              </p>
            </div>
            <button
              onClick={() => onSelectTool('imagem_para_video')}
              className="bg-white text-black font-orbitron font-black text-xs px-5 py-3 rounded-xl uppercase cursor-pointer shrink-0"
            >
              Criar Primeiro Projeto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentJobs.slice(0, 3).map((job) => {
              const isCompleted = job.status === 'COMPLETED';
              const isFailed = job.status === 'FAILED';
              return (
                <div
                  key={job.jobId}
                  onClick={() => onSelectTool('meus_projetos')}
                  className="bg-[#14131d] border border-white/10 hover:border-white/25 rounded-2xl p-5 flex flex-col justify-between gap-4 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-orbitron font-black text-xs text-white block">
                        {job.toolLabel}
                      </span>
                      <span className="text-[11px] text-gray-400 font-sans line-clamp-1 mt-0.5">
                        {job.inputSummary || job.model}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-orbitron font-black uppercase ${
                        isCompleted
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : isFailed
                          ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : isFailed ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      <span>
                        {isCompleted ? 'Concluído' : isFailed ? 'Falhou' : 'Processando'}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/10 text-[11px] font-mono text-gray-400">
                    <span>{new Date(job.createdAt).toLocaleDateString('pt-BR')}</span>
                    <span className="text-white font-bold">✨ {job.creditsCharged} créditos</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
