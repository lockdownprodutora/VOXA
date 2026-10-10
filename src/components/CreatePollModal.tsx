import React, { useState } from 'react';
import { createPoll } from '../utils/pollDb';
import { X, Plus, Trash2, BarChart3, Clock, AlertCircle } from 'lucide-react';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onPollCreated: () => void;
  triggerToast?: (msg: string) => void;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onPollCreated,
  triggerToast
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [duration, setDuration] = useState('1d');
  const [customDate, setCustomDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length >= 10) {
      setErrorMsg('Máximo de 10 opções por enquete.');
      return;
    }
    setOptions(prev => [...prev, '']);
    setErrorMsg(null);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      setErrorMsg('A enquete precisa de no mínimo 2 opções.');
      return;
    }
    setOptions(prev => prev.filter((_, idx) => idx !== index));
    setErrorMsg(null);
  };

  const handleOptionChange = (text: string, index: number) => {
    setOptions(prev => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!question.trim()) {
      setErrorMsg('Escreva a pergunta da enquete.');
      return;
    }

    const filledOptions = options.map(o => o.trim()).filter(o => o.length > 0);
    if (filledOptions.length < 2) {
      setErrorMsg('Preencha pelo menos 2 opções de resposta.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createPoll(
        {
          uid: currentUser.uid,
          name: currentUser.name || 'Membro VOXA',
          username: currentUser.username || currentUser.slug || 'membro',
          avatarUrl: currentUser.photoURL || currentUser.avatarUrl || ''
        },
        question,
        filledOptions,
        duration,
        duration === 'custom' ? customDate : undefined
      );

      triggerToast?.('Enquete criada com sucesso! 📊');
      setQuestion('');
      setOptions(['', '']);
      setDuration('1d');
      onPollCreated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao criar enquete.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#12111d] border border-white/10 rounded-[28px] max-w-lg w-full p-6 md:p-8 space-y-6 text-left shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-orbitron font-extrabold text-base text-white uppercase tracking-wider">
                CRIAR NOVA ENQUETE
              </h3>
              <span className="text-[10px] text-gray-400 font-sans block">
                Permita que a comunidade vote e visualize os resultados
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

        {errorMsg && (
          <div className="p-3.5 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Question Input */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase tracking-wider">
              Pergunta da Enquete *
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex: Qual o próximo lançamento que vocês mais querem ver?"
              rows={2}
              required
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none leading-relaxed font-sans"
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-orbitron font-bold text-gray-400 uppercase tracking-wider">
                Opções de Resposta ({options.length}/10)
              </label>
              {options.length < 10 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="text-[10px] font-orbitron font-bold text-violet-400 hover:text-violet-300 flex items-center space-x-1 cursor-pointer uppercase"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Opção</span>
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-mono text-gray-400 font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(e.target.value, idx)}
                    placeholder={`Opção ${idx + 1}...`}
                    required={idx < 2}
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-violet-500 focus:outline-none font-sans"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                      title="Remover opção"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Duration Selector */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-400" />
              <span>Duração da Votação</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: '1h', label: '1 HORA' },
                { id: '6h', label: '6 HORAS' },
                { id: '12h', label: '12 HORAS' },
                { id: '1d', label: '1 DIA' },
                { id: '3d', label: '3 DIAS' },
                { id: '7d', label: '7 DIAS' },
                { id: '30d', label: '30 DIAS' },
                { id: 'custom', label: 'PERSONALIZADA' }
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDuration(d.id)}
                  className={`py-2 px-2.5 rounded-xl font-orbitron text-[9px] font-bold uppercase transition-all cursor-pointer text-center ${
                    duration === d.id
                      ? 'bg-violet-600 text-white font-black shadow-lg shadow-violet-600/20'
                      : 'bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {duration === 'custom' && (
              <div className="pt-2 animate-fadeIn">
                <input
                  type="datetime-local"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  required
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-white/5 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-orbitron text-xs text-gray-400 hover:text-white transition-colors cursor-pointer uppercase"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-white hover:bg-neutral-200 text-black font-orbitron font-black text-xs py-3 px-6 rounded-xl transition-all cursor-pointer uppercase tracking-wider shadow-lg disabled:opacity-40"
            >
              {isSubmitting ? 'PUBLICANDO...' : 'PUBLICAR ENQUETE'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
