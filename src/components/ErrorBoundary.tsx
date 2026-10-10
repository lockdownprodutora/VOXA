import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  props: Props;
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[VOXA ERROR BOUNDARY]", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center p-6 text-center font-sans selection:bg-[#FF0033]/30 selection:text-white">
          <div className="max-w-md w-full space-y-8 bg-[#12111d]/90 border border-[#FF0033]/30 p-8 md:p-10 rounded-[32px] shadow-2xl shadow-[#FF0033]/5 animate-fadeIn">
            {/* Branding Header */}
            <div className="space-y-3">
              <div className="w-16 h-16 bg-[#FF0033]/10 border-2 border-[#FF0033] rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-[#FF0033]/20">
                <span className="font-orbitron font-black text-xl text-[#FF0033] tracking-widest">VX</span>
              </div>
              <h1 className="font-orbitron font-black text-lg text-white uppercase tracking-widest">SISTEMA VOXA</h1>
              <p className="text-[10px] font-orbitron text-gray-500 font-bold uppercase tracking-widest">NÚCLEO CRÍTICO</p>
            </div>

            {/* Error Message Box */}
            <div className="bg-[#1b1928] border border-white/5 rounded-2xl p-5 text-left space-y-2">
              <h2 className="font-orbitron font-extrabold text-xs text-[#FF0033] uppercase tracking-wider">FALHA DE INICIALIZAÇÃO / RUNTIME</h2>
              <p className="text-[11px] text-gray-300 leading-relaxed font-mono break-all whitespace-pre-wrap">
                {this.state.error?.message || "Ocorreu um erro inesperado ao renderizar a interface."}
              </p>
            </div>

            {/* Hint message */}
            <p className="text-[10px] text-gray-500 leading-relaxed max-w-sm mx-auto">
              Se você acabou de realizar uma atualização ou se deparou com este erro de inicialização, tente recarregar ou limpar o cache do navegador.
            </p>

            {/* Actions */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full bg-[#FF0033] hover:bg-[#d6002b] text-white font-orbitron font-black text-xs py-4 px-6 rounded-xl cursor-pointer transition-all uppercase tracking-widest shadow-lg shadow-[#FF0033]/20 hover:scale-102"
              >
                TENTAR NOVAMENTE
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (this.props as any).children;
  }
}
