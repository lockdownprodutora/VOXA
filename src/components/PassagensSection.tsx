import React, { useState } from 'react';
import { 
  Plane, 
  Bus, 
  Compass, 
  Search, 
  Calendar, 
  Users, 
  MapPin, 
  ShieldCheck, 
  AlertCircle,
  Sparkles,
  CheckCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { TravelBooking } from '../types';
import { saveTravelBooking, fetchTravelBookings } from '../utils/storeDb';

interface PassagensSectionProps {
  currentUser: any;
  triggerToast: (msg: string) => void;
}

export const PassagensSection: React.FC<PassagensSectionProps> = ({ currentUser, triggerToast }) => {
  const [travelType, setTravelType] = useState<'flight' | 'bus'>('flight');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [travelClass, setTravelClass] = useState('Econômica');
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim() || !departureDate) {
      alert("Preencha a origem, destino e data de partida.");
      return;
    }

    setIsSearching(true);
    setHasSearched(false);

    try {
      // TravelProvider abstraction call simulation
      const bookingId = `travel_${Date.now()}`;
      const newBooking: TravelBooking = {
        id: bookingId,
        userId: currentUser?.uid || currentUser?.email || 'visitor',
        type: travelType,
        origin,
        destination,
        departureDate,
        passengers,
        status: 'SEARCHED',
        amount: 0,
        createdAt: new Date().toISOString()
      };
      if (currentUser) {
        await saveTravelBooking(newBooking);
      }

      setTimeout(() => {
        setIsSearching(false);
        setHasSearched(true);
      }, 800);
    } catch (err) {
      setIsSearching(false);
      console.warn("Travel search error:", err);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn text-left">
      {/* Hero Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-blue-950/50 via-indigo-950/50 to-purple-950/50 border border-white/10 p-8 md:p-12 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center space-x-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/20 text-xs font-orbitron font-bold text-white">
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            <span>VOXA TRAVEL & PASSAGENS</span>
          </div>
          <h1 className="font-orbitron font-black text-3xl md:text-5xl text-white tracking-tight">
            Descubra o Mundo com Segurança
          </h1>
          <p className="text-gray-300 text-sm md:text-base font-sans leading-relaxed">
            Arquitetura preparada para integração em tempo real com parceiros globais de passagens aéreas e rodoviárias.
          </p>
        </div>
      </div>

      {/* Integration Notice Banner */}
      <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-5 flex items-start space-x-3.5 text-amber-200">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs font-sans leading-relaxed">
          <span className="font-orbitron font-bold block text-amber-300 uppercase">Serviço em Preparação para API Parceira</span>
          <p>
            O módulo de Passagens do VOXA está estruturado com a camada de abstração <code className="font-mono text-amber-300 bg-black/30 px-1 py-0.5 rounded">TravelProvider</code>. Nenhum preço ou horário fictício é inventado em produção. A emissão de bilhetes estará disponível assim que a API oficial do fornecedor for conectada.
          </p>
        </div>
      </div>

      {/* Search Engine Card */}
      <div className="bg-[#12111d] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl">
        {/* Type Tabs */}
        <div className="flex items-center space-x-2 border-b border-white/10 pb-4">
          <button
            onClick={() => setTravelType('flight')}
            className={`flex items-center space-x-2 px-5 py-3 rounded-2xl font-orbitron font-bold text-xs transition-all cursor-pointer ${
              travelType === 'flight' 
                ? 'bg-white text-black shadow-lg' 
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Plane className="w-4 h-4" />
            <span>Passagens Aéreas</span>
          </button>
          <button
            onClick={() => setTravelType('bus')}
            className={`flex items-center space-x-2 px-5 py-3 rounded-2xl font-orbitron font-bold text-xs transition-all cursor-pointer ${
              travelType === 'bus' 
                ? 'bg-white text-black shadow-lg' 
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Bus className="w-4 h-4" />
            <span>Passagens de Ônibus</span>
          </button>
        </div>

        <form onSubmit={handleSearch} className="space-y-4 text-xs font-sans">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-orbitron font-bold text-gray-300 block">Origem (Cidade ou Aeroporto/Rodoviária) *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500 pointer-events-none">
                  <MapPin className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Ex: São Paulo (GRU / Tietê)"
                  className="w-full bg-[#0c0b16] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-orbitron font-bold text-gray-300 block">Destino (Cidade ou Aeroporto/Rodoviária) *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500 pointer-events-none">
                  <MapPin className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Ex: Rio de Janeiro (GIG / Novo Rio)"
                  className="w-full bg-[#0c0b16] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="font-orbitron font-bold text-gray-300 block">Data de Ida *</label>
              <input
                type="date"
                required
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full bg-[#0c0b16] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white font-mono"
              />
            </div>

            {travelType === 'flight' && (
              <div className="space-y-1.5">
                <label className="font-orbitron font-bold text-gray-300 block">Data de Volta (Opcional)</label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full bg-[#0c0b16] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white font-mono"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-orbitron font-bold text-gray-300 block">Passageiros</label>
              <input
                type="number"
                min="1"
                max="10"
                value={passengers}
                onChange={(e) => setPassengers(parseInt(e.target.value) || 1)}
                className="w-full bg-[#0c0b16] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white font-mono"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSearching}
              className="bg-white hover:bg-neutral-200 text-black font-orbitron font-black text-xs py-3.5 px-8 rounded-2xl transition-all shadow-xl cursor-pointer flex items-center space-x-2"
            >
              {isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  <span>Consultando Provedores...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>BUSCAR PASSAGENS</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Search Result State */}
      {hasSearched && (
        <div className="bg-[#12111d] border border-white/10 rounded-3xl p-8 text-center space-y-4 animate-fadeIn">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="font-orbitron font-black text-base text-white uppercase">Busca Registrada na Camada TravelProvider</h3>
            <p className="text-xs text-gray-400 font-sans leading-relaxed">
              Origem: <strong className="text-white">{origin}</strong> → Destino: <strong className="text-white">{destination}</strong>. Para garantir 100% de precisão nos assentos e tarifas oficiais, os resultados serão exibidos assim que a API do parceiro de aéreo/ônibus for vinculada ao ambiente de produção.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
