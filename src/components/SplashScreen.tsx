import React from 'react';

export function SplashScreen() {
  console.log("[VOXA BOOT] SplashScreen renderizou");
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-neutral-950 text-white z-50">
      <div className="text-center space-y-6 px-4">
        {/* Typographic Voxa Title */}
        <h1 className="text-6xl md:text-8xl font-black tracking-wider text-white select-none animate-pulse">
          VOXA
        </h1>
        {/* Slogan */}
        <p className="text-sm md:text-base text-neutral-400 font-medium tracking-widest uppercase select-none max-w-md mx-auto leading-relaxed">
          Uma nova dimensão social
        </p>
        {/* Discrete Red Loader */}
        <div className="flex justify-center pt-8">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    </div>
  );
}
