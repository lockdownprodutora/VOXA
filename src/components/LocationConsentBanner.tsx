import React, { useState, useEffect } from 'react';
import { MapPin, ShieldCheck, X } from 'lucide-react';
import { requestAndSaveApproximateLocation } from '../hooks/useUserPresence';

interface LocationConsentBannerProps {
  currentUser: any;
}

export const LocationConsentBanner: React.FC<LocationConsentBannerProps> = ({ currentUser }) => {
  const uid = currentUser?.uid || currentUser?.id || '';
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid || typeof window === 'undefined' || !('geolocation' in navigator)) {
      setVisible(false);
      return;
    }

    const consentStatus = localStorage.getItem(`voxa_location_consent_${uid}`);
    const savedApprox = localStorage.getItem(`voxa_approx_location_${uid}`);

    if (!consentStatus) {
      // Show discrete authorization prompt after a brief delay
      const timer = setTimeout(() => setVisible(true), 1800);
      return () => clearTimeout(timer);
    } else if (consentStatus === 'granted' && !savedApprox) {
      // Refresh coarse location silently if user already consented
      requestAndSaveApproximateLocation(uid).catch(() => {});
    }
  }, [uid]);

  if (!visible || !uid) return null;

  const handleAllow = async () => {
    setLoading(true);
    try {
      await requestAndSaveApproximateLocation(uid);
    } finally {
      setLoading(false);
      setVisible(false);
    }
  };

  const handleDecline = () => {
    localStorage.setItem(`voxa_location_consent_${uid}`, 'dismissed');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-[#12111d] border border-white/15 rounded-2xl p-4 shadow-2xl text-white animate-fadeIn">
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-[#FF0033]/15 border border-[#FF0033]/30 flex items-center justify-center text-[#FF0033] shrink-0 mt-0.5">
          <MapPin className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-orbitron font-bold text-xs text-white leading-snug">
              Permitir que a VOXA use sua localização aproximada para melhorar a experiência?
            </h4>
            <button
              onClick={handleDecline}
              className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-gray-400 font-sans mt-1.5 leading-relaxed flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Apenas país, estado, cidade e região aproximada. Nunca salvamos seu endereço exato.</span>
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleAllow}
              disabled={loading}
              className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-[10px] px-3.5 py-2 rounded-xl transition-all cursor-pointer uppercase tracking-wider disabled:opacity-50"
            >
              {loading ? 'Obtendo região...' : 'Permitir'}
            </button>
            <button
              onClick={handleDecline}
              disabled={loading}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-orbitron font-bold text-[10px] px-3.5 py-2 rounded-xl transition-all cursor-pointer uppercase tracking-wider"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
