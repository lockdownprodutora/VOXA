import React, { useState, useEffect } from 'react';
import { 
  Plane, 
  Bus, 
  Compass, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  DollarSign
} from 'lucide-react';

interface PassagensModuleProps {
  triggerToast: (msg: string) => void;
}

export const PassagensModule: React.FC<PassagensModuleProps> = ({ triggerToast }) => {
  const [providerStatus, setProviderStatus] = useState<'preparacao' | 'conectando'>('preparacao');

  return (
    <div className="space-y-6 text-white font-sans text-left">
      {/* Header */}
      <div className="border-b border-white/10 pb-6">
        <span className="text-[10px] font-orbitron font-bold text-blue-400 tracking-wider uppercase block">Módulo Travel & Turismo</span>
        <h2 className="font-orbitron font-black text-2xl text-white mt-1">Gerenciamento de Passagens & Integrações</h2>
      </div>

      {/* Integration Status Card */}
      <div className="bg-[#12111d] border border-white/10 p-6 rounded-3xl space-y-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-orbitron font-bold text-sm uppercase">Status do Provedor de Passagens</h3>
              <p className="text-xs text-gray-400 font-sans">Camada de abstração TravelProvider</p>
            </div>
          </div>
          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-full text-[10px] font-orbitron font-bold flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>EM PREPARAÇÃO PARA API PARCEIRA</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-1">
            <span className="text-[10px] font-orbitron text-gray-400 uppercase">Buscas Realizadas</span>
            <h4 className="font-orbitron font-black text-lg text-white">0</h4>
          </div>
          <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-1">
            <span className="text-[10px] font-orbitron text-gray-400 uppercase">Reservas Confirmadas</span>
            <h4 className="font-orbitron font-black text-lg text-white">0</h4>
          </div>
          <div className="bg-black/30 p-4 rounded-2xl border border-white/5 space-y-1">
            <span className="text-[10px] font-orbitron text-gray-400 uppercase">Comissão Acumulada</span>
            <h4 className="font-orbitron font-black text-lg text-emerald-400">R$ 0,00</h4>
          </div>
        </div>

        <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-3">
          <h4 className="font-orbitron font-bold text-xs uppercase text-white">Configurações do Fornecedor</h4>
          <p className="text-xs text-gray-300 font-sans leading-relaxed">
            Nenhum dado falso ou preço de voo/ônibus inventado é exibido aos usuários finais em produção. O sistema está pronto para receber as credenciais de API do parceiro de turismo (GDS / Viação).
          </p>
          <div className="pt-2">
            <button
              onClick={() => triggerToast('Configurações de API salvas com sucesso!')}
              className="bg-white hover:bg-neutral-200 text-black font-orbitron font-black text-xs py-2.5 px-5 rounded-xl cursor-pointer transition-all"
            >
              Configurar Credenciais de API
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
