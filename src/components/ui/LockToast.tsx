import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, X, Bell, Zap, CheckCircle2 } from 'lucide-react';
import { MascotDuck } from '../MascotDuck';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'drop' | 'meta' | 'warning' | 'success';
}

interface LockToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const LockToastContainer: React.FC<LockToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col space-y-3 pointer-events-none max-w-sm w-full px-4">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            className="pointer-events-auto glass-card p-4 rounded-2xl border-2 border-[#FF0033] shadow-2xl glow-red flex items-start space-x-3 bg-black/90 backdrop-blur-xl relative overflow-hidden"
          >
            {/* Glowing red accent bar */}
            <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-[#FF0033]"></div>

            <div className="flex-shrink-0 mt-0.5">
              <div className="w-10 h-10 rounded-xl bg-[#FF0033]/20 border border-[#FF0033] flex items-center justify-center text-[#FF0033]">
                {toast.type === 'drop' && <Flame className="w-5 h-5 animate-bounce" />}
                {toast.type === 'meta' && <Zap className="w-5 h-5" />}
                {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {toast.type === 'warning' && <Bell className="w-5 h-5 animate-pulse" />}
              </div>
            </div>

            <div className="flex-1 pr-4">
              <div className="flex items-center justify-between">
                <span className="font-orbitron font-extrabold text-[11px] text-[#FF0033] tracking-wider uppercase">
                  {toast.title}
                </span>
              </div>
              <p className="text-xs text-white mt-1 font-light leading-relaxed">
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
