import React from 'react';
import { 
  Sparkles, 
  FileText, 
  Layers, 
  ShoppingBag, 
  Ticket, 
  Heart, 
  BarChart3, 
  Star, 
  Headphones, 
  Briefcase, 
  X,
  Plus
} from 'lucide-react';

export interface CreateOptionItem {
  id: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  onClick: () => void;
}

interface CreateContentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction?: (actionId: string) => void;
  onSelectOption?: (optionId: string) => void;
}

export const CreateContentMenu: React.FC<CreateContentMenuProps> = ({
  isOpen,
  onClose,
  onSelectAction,
  onSelectOption
}) => {
  if (!isOpen) return null;

  const triggerAction = (actionId: string) => {
    if (onSelectAction) onSelectAction(actionId);
    if (onSelectOption) onSelectOption(actionId);
    onClose();
  };

  const creationOptions: CreateOptionItem[] = [
    {
      id: 'vox',
      label: 'Criar VOX',
      desc: 'Pensamentos rápidos em texto até 300 caracteres',
      icon: Sparkles,
      color: 'from-violet-600 to-indigo-600',
      onClick: () => triggerAction('vox')
    },
    {
      id: 'post',
      label: 'Criar Post',
      desc: 'Publicação completa com imagens e anexos',
      icon: FileText,
      color: 'from-sky-600 to-blue-600',
      onClick: () => triggerAction('post')
    },
    {
      id: 'poll',
      label: 'Criar Enquete',
      desc: 'Pergunta comunitária com votação em tempo real',
      icon: BarChart3,
      color: 'from-purple-600 to-pink-600',
      onClick: () => triggerAction('poll')
    },
    {
      id: 'story',
      label: 'Criar Story',
      desc: 'Momentos efêmeros visíveis por 24 horas',
      icon: Layers,
      color: 'from-amber-500 to-orange-600',
      onClick: () => triggerAction('story')
    },
    {
      id: 'product',
      label: 'Criar Produto',
      desc: 'Anuncie na VOXA Store com pagamento integrado',
      icon: ShoppingBag,
      color: 'from-emerald-600 to-teal-600',
      onClick: () => triggerAction('product')
    },
    {
      id: 'event',
      label: 'Criar Ticket / Evento',
      desc: 'Venda de ingressos com QR Code e controle de acesso',
      icon: Ticket,
      color: 'from-rose-600 to-red-600',
      onClick: () => triggerAction('event')
    },
    {
      id: 'fundraiser',
      label: 'Criar Vaquinha',
      desc: 'Campanhas solidárias com metas e arrecadação via PIX',
      icon: Heart,
      color: 'from-pink-600 to-rose-600',
      onClick: () => triggerAction('fundraiser')
    },
    {
      id: 'subscription',
      label: 'Vender Assinatura',
      desc: 'Planos mensais recorrentes para apoiadores VIP',
      icon: Star,
      color: 'from-amber-400 to-yellow-600',
      onClick: () => triggerAction('subscription')
    },
    {
      id: 'music',
      label: 'Publicar Música',
      desc: 'Distribua faixas e receba streams no seu perfil',
      icon: Headphones,
      color: 'from-indigo-600 to-violet-700',
      onClick: () => triggerAction('music')
    },
    {
      id: 'news',
      label: 'Publicar Notícia',
      desc: 'Artigos, matérias e releases jornalísticos',
      icon: FileText,
      color: 'from-zinc-700 to-neutral-900',
      onClick: () => triggerAction('news')
    },
    {
      id: 'service',
      label: 'Criar Serviço',
      desc: 'Ofereça consultorias, produções e serviços',
      icon: Briefcase,
      color: 'from-cyan-600 to-blue-700',
      onClick: () => triggerAction('service')
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#12111d] border border-white/10 rounded-[32px] max-w-2xl w-full p-6 md:p-8 space-y-6 text-left shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white text-black flex items-center justify-center font-bold">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-orbitron font-extrabold text-base md:text-lg text-white uppercase tracking-wider">
                CENTRAL DE CRIAÇÃO
              </h3>
              <span className="text-[10px] text-gray-400 font-sans block">
                Escolha o formato do conteúdo que deseja publicar no ecossistema VOXA
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grid of action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {creationOptions.map((item) => {
            const ItemIcon = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className="group p-4 bg-black/40 border border-white/5 hover:border-white/20 hover:bg-white/5 rounded-2xl text-left transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${item.color} flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform`}>
                    <ItemIcon className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] font-orbitron font-bold text-gray-500 group-hover:text-white uppercase">
                    CRIAR
                  </span>
                </div>
                <div>
                  <h4 className="font-orbitron font-bold text-xs text-white uppercase group-hover:text-white">
                    {item.label}
                  </h4>
                  <p className="text-[10px] text-gray-400 font-sans mt-1 leading-snug line-clamp-2">
                    {item.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
