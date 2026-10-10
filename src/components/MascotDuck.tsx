import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Zap, Award, Sparkles } from 'lucide-react';

interface MascotDuckProps {
  mood?: 'normal' | 'attentive' | 'happy' | 'angry' | 'pointing';
  speechText?: string;
  size?: 'sm' | 'md' | 'lg' | 'hologram';
  className?: string;
  onClick?: () => void;
  mascotUrl?: string;
}

export const MascotDuck: React.FC<MascotDuckProps> = ({
  mood = 'normal',
  speechText,
  size = 'md',
  className = '',
  onClick,
  mascotUrl
}) => {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-28 h-28',
    lg: 'w-44 h-44',
    hologram: 'w-36 h-36 md:w-48 md:h-48'
  };

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Speech Bubble */}
      {speechText && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute -top-16 md:-top-20 z-30 bg-[#111111] border-2 border-[#FF0033] text-white px-4 py-2 rounded-xl text-xs md:text-sm font-bold shadow-2xl max-w-[240px] text-center glow-red"
        >
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#111111] border-r-2 border-b-2 border-[#FF0033] transform rotate-45"></div>
          <p className="font-orbitron tracking-wide text-[#8B5CF6] mb-0.5 text-[10px]">VOXA AI</p>
          <span>{speechText}</span>
        </motion.div>
      )}

      {/* Hologram base effect if hologram size */}
      {size === 'hologram' && (
        <div className="absolute -bottom-4 w-40 h-8 bg-gradient-to-r from-transparent via-[#8B5CF6]/40 to-transparent rounded-full blur-md animate-pulse"></div>
      )}

      {/* Mascot Avatar Container */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className={`${sizeClasses[size]} relative cursor-pointer group flex items-center justify-center`}
      >
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-full bg-[#8B5CF6]/15 blur-xl group-hover:bg-[#8B5CF6]/30 transition-all"></div>
        
        {/* Cyber hud ring */}
        <div className="absolute inset-0 rounded-full border border-[#8B5CF6]/40 border-dashed animate-spin-slow"></div>

        {/* Mascot Illustration representation (Cyber Duck with Hoodie & Cap backwards) */}
        <div className="relative w-full h-full rounded-2xl bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border-2 border-[#8B5CF6] flex flex-col items-center justify-center overflow-hidden shadow-2xl">
          
          {/* Cyber grid bg inside avatar */}
          <div className="absolute inset-0 cyber-grid opacity-30"></div>

          {mascotUrl ? (
            <img 
              src={mascotUrl} 
              alt="Mascote Lock" 
              className="w-full h-full object-contain p-2 z-10" 
              referrerPolicy="no-referrer"
            />
          ) : (
            /* Duck Head / Hood */
            <div className="relative z-10 flex flex-col items-center">
              {/* Backward Cap */}
              <div className="absolute -top-3 w-14 h-5 bg-[#8B5CF6] rounded-t-lg transform -rotate-12 border-b border-black">
                <div className="absolute -left-2 top-1 w-3 h-3 bg-[#8B5CF6] rounded-sm transform -rotate-45"></div>
              </div>

              {/* Hood */}
              <div className="w-20 h-16 bg-[#161616] rounded-t-2xl border-t border-x border-[#333] relative flex items-center justify-center">
                
                {/* Glowing Red Cyber Eyes */}
                <div className="flex space-x-3 my-2 z-20">
                  <motion.div
                    animate={mood === 'angry' ? { rotate: [0, -10, 0] } : { opacity: [1, 0.7, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className={`w-3.5 h-2 rounded-full ${mood === 'angry' ? 'bg-[#8B5CF6] h-2.5 transform -rotate-12' : 'bg-[#8B5CF6]'} glow-red`}
                  ></motion.div>
                  <motion.div
                    animate={mood === 'angry' ? { rotate: [0, 10, 0] } : { opacity: [1, 0.7, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className={`w-3.5 h-2 rounded-full ${mood === 'angry' ? 'bg-[#8B5CF6] h-2.5 transform rotate-12' : 'bg-[#8B5CF6]'} glow-red`}
                  ></motion.div>
                </div>

                {/* Duck Beak (Cyber Metallic Gold/Orange) */}
                <div className="absolute top-9 w-7 h-4 bg-gradient-to-r from-amber-500 to-amber-600 rounded-b-md border border-amber-700 shadow-md"></div>

                {/* Sunglasses if happy */}
                {mood === 'happy' && (
                  <div className="absolute top-6 z-30 w-16 h-4 bg-black border border-[#8B5CF6] rounded flex items-center justify-center">
                    <span className="text-[8px] font-orbitron text-[#8B5CF6]">THUG</span>
                  </div>
                )}
              </div>

              {/* Hoodie Collar with VOXA Logo mark */}
              <div className="w-24 h-8 bg-black border-t-2 border-[#8B5CF6] rounded-b-xl flex items-center justify-center">
                <span className="font-orbitron text-[9px] font-black text-[#8B5CF6] tracking-widest">VOXA</span>
              </div>
            </div>
          )}

          {/* Mood indicator badge */}
          <div className="absolute bottom-1 right-1 bg-black/80 border border-[#FF0033] rounded px-1 text-[8px] font-orbitron text-[#FF0033]">
            {mood === 'happy' ? '😎 FLEX' : mood === 'angry' ? '😡 BRABO' : mood === 'attentive' ? '⚡ ATENÇÃO' : '🤖 ONLINE'}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
