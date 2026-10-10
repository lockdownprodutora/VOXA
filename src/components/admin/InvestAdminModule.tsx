import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Plus,
  Edit3,
  Layers,
  Lock,
  TrendingUp,
  DollarSign,
  Save,
  X
} from 'lucide-react';
import { formatBRL } from '../../utils/money';
import {
  InvestProduct,
  InvestPosition,
  InvestGlobalSettings,
  INITIAL_INVEST_PRODUCTS,
  INITIAL_INVEST_GLOBAL_SETTINGS,
  ensureInvestSeeded
} from '../../utils/investDb';
import { db, isFirebaseConfigured } from '../../lib/firebase';
import { doc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

interface InvestAdminModuleProps {
  onBackToMenu: () => void;
  currentUser: any;
  adminRole: 'SUPER_ADMIN' | 'ADMINISTRATOR' | 'MANAGER' | 'SUPPORT' | 'NONE';
}

export const InvestAdminModule: React.FC<InvestAdminModuleProps> = ({
  onBackToMenu,
  currentUser,
  adminRole
}) => {
  const [activeTab, setActiveTab] = useState<'products' | 'positions' | 'settings'>('products');
  const [loading, setLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [settings, setSettings] = useState<InvestGlobalSettings>(INITIAL_INVEST_GLOBAL_SETTINGS);
  const [products, setProducts] = useState<InvestProduct[]>(INITIAL_INVEST_PRODUCTS);
  const [positions, setPositions] = useState<InvestPosition[]>([]);

  // Product Editor Modal
  const [editingProduct, setEditingProduct] = useState<InvestProduct | null>(null);
  const [minReais, setMinReais] = useState<string>('100');
  const [maxReais, setMaxReais] = useState<string>('5000');
  const [savingProduct, setSavingProduct] = useState<boolean>(false);

  // Record Real Result Modal
  const [targetPosition, setTargetPosition] = useState<InvestPosition | null>(null);
  const [periodLabel, setPeriodLabel] = useState<string>('Fechamento Mensal da Estratégia Cripto');
  const [realReturnPercent, setRealReturnPercent] = useState<string>('4.2');
  const [strategyNotes, setStrategyNotes] = useState<string>(
    'Resultado real apurado nas operações de compra, venda e arbitragem em BTC/ETH/SOL no período.'
  );
  const [recordingResult, setRecordingResult] = useState<boolean>(false);

  const adminUid = currentUser?.uid || currentUser?.id || '';

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/invest/overview', {
        headers: { 'x-admin-uid': adminUid }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSettings(data.settings || INITIAL_INVEST_GLOBAL_SETTINGS);
          setProducts(data.products || INITIAL_INVEST_PRODUCTS);
          setPositions(data.positions || []);
          setLoading(false);
          return;
        }
      }
    } catch {}

    // Fallback to direct Firestore
    try {
      const seeded = await ensureInvestSeeded();
      setSettings(seeded.settings);
      setProducts(seeded.products);
      if (isFirebaseConfigured()) {
        const snap = await getDocs(collection(db, 'invest_positions'));
        const list: InvestPosition[] = [];
        snap.forEach((d) => list.push({ ...(d.data() as InvestPosition), id: d.id }));
        list.sort((a, b) => new Date(b.appliedAt || 0).getTime() - new Date(a.appliedAt || 0).getTime());
        setPositions(list);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadOverview();
  }, []);

  if (adminRole !== 'SUPER_ADMIN' && adminRole !== 'ADMINISTRATOR') {
    return (
      <div className="bg-white rounded-3xl border border-red-200 p-8 max-w-md mx-auto text-center space-y-4 shadow-xl text-black my-8">
        <h2 className="font-orbitron font-black text-xl text-black uppercase">Acesso Restrito</h2>
        <p className="text-xs text-gray-600 font-sans">
          Apenas Administradores podem configurar produtos e registrar resultados reais do VOXA Invest.
        </p>
        <button
          onClick={onBackToMenu}
          className="bg-black text-white font-orbitron font-bold text-xs py-3 px-6 rounded-xl cursor-pointer uppercase"
        >
          Voltar ao Menu
        </button>
      </div>
    );
  }

  const handleOpenEditProduct = (prod: InvestProduct) => {
    setEditingProduct({ ...prod });
    setMinReais(String(Math.round(prod.minAmountCentavos / 100)));
    setMaxReais(String(Math.round(prod.maxAmountCentavos / 100)));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setSavingProduct(true);
    setFeedback(null);

    const minAmountCentavos = Math.max(1000, Math.round(Number(minReais) * 100));
    const maxAmountCentavos = Math.max(minAmountCentavos, Math.round(Number(maxReais) * 100));

    const payload: InvestProduct = {
      ...editingProduct,
      minAmountCentavos,
      maxAmountCentavos,
      updatedAt: new Date().toISOString(),
      updatedBy: adminUid
    };

    try {
      const res = await fetch('/api/admin/invest/product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-uid': adminUid
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok && isFirebaseConfigured()) {
        await setDoc(doc(db, 'invest_products', payload.id), payload, { merge: true });
      }
      setFeedback({
        type: 'success',
        text: `Produto ${payload.name} atualizado com sucesso!`
      });
      setEditingProduct(null);
      await loadOverview();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro ao salvar produto.' });
    } finally {
      setSavingProduct(false);
    }
  };

  const handleToggleProductActive = async (prod: InvestProduct) => {
    const updated = { ...prod, active: !prod.active, updatedAt: new Date().toISOString() };
    try {
      await fetch('/api/admin/invest/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-uid': adminUid },
        body: JSON.stringify(updated)
      });
      if (isFirebaseConfigured()) {
        await setDoc(doc(db, 'invest_products', prod.id), updated, { merge: true });
      }
      setProducts((prev) => prev.map((p) => (p.id === prod.id ? updated : p)));
      setFeedback({
        type: 'success',
        text: `Produto ${prod.name} ${updated.active ? 'ATIVADO' : 'DESATIVADO'} com sucesso.`
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Falha ao alternar status.' });
    }
  };

  const handleRecordRealResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPosition) return;
    setRecordingResult(true);
    setFeedback(null);

    try {
      const pct = parseFloat(String(realReturnPercent).replace(',', '.'));
      if (isNaN(pct)) throw new Error('Percentual inválido.');

      const res = await fetch(`/api/admin/invest/positions/${targetPosition.id}/record-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-uid': adminUid
        },
        body: JSON.stringify({
          periodLabel,
          realReturnPercent: pct,
          strategyNotes
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao registrar resultado real.');
      }

      setFeedback({
        type: 'success',
        text: `Resultado real (${pct >= 0 ? '+' : ''}${pct}%) registrado na posição ${targetPosition.id}!`
      });
      setTargetPosition(null);
      await loadOverview();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro ao registrar apuração.' });
    } finally {
      setRecordingResult(false);
    }
  };

  const handleSettlePosition = async (pos: InvestPosition) => {
    try {
      const res = await fetch(`/api/admin/invest/positions/${pos.id}/settle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-uid': adminUid
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao liquidar posição.');
      }
      setFeedback({
        type: 'success',
        text: `Posição ${pos.id} liquidada e creditada no saldo disponível do usuário!`
      });
      await loadOverview();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Erro na liquidação.' });
    }
  };

  return (
    <div className="space-y-6 text-left text-black pb-12">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMenu}
            className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-4 py-2.5 rounded-xl text-xs font-orbitron text-gray-800 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>MENU ADMIN</span>
          </button>
          <div>
            <span className="text-[10px] font-orbitron font-black text-[#FF0033] uppercase tracking-widest block">
              GESTÃO DE PRODUTOS CRIPTO & APURAÇÃO REAL
            </span>
            <h2 className="font-orbitron font-black text-xl text-black uppercase">
              VOXA INVEST • ADMINISTRAÇÃO
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2.5 rounded-xl font-orbitron font-bold text-xs uppercase cursor-pointer ${
              activeTab === 'products'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Produtos ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-4 py-2.5 rounded-xl font-orbitron font-bold text-xs uppercase cursor-pointer ${
              activeTab === 'positions'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Posições & Apuração Real ({positions.length})
          </button>
          <button
            onClick={loadOverview}
            className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-300 cursor-pointer"
            title="Recarregar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#FF0033]' : ''}`} />
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-sans flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold underline">
            Fechar
          </button>
        </div>
      )}

      {/* TAB 1: CONFIGURABLE PRODUCTS */}
      {activeTab === 'products' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((prod) => (
            <div
              key={prod.id}
              className="bg-white border border-gray-200 rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[9px] font-orbitron font-black px-2.5 py-1 rounded-full uppercase ${
                      prod.active
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {prod.active ? 'ATIVO NO SITE' : 'INATIVO'}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-gray-500">
                    Lock-up: {prod.lockupMonths} meses
                  </span>
                </div>

                <h3 className="font-orbitron font-black text-xl text-black uppercase">
                  {prod.name}
                </h3>
                <p className="text-xs text-gray-600 font-sans leading-relaxed">{prod.subtitle}</p>

                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Mínimo / Máximo:</span>
                    <span className="font-mono font-bold text-black">
                      {formatBRL(prod.minAmountCentavos / 100)} — {formatBRL(prod.maxAmountCentavos / 100)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Meta Indicativa (Não garantida):</span>
                    <span className="font-mono font-bold text-[#FF0033]">
                      {prod.targetReturnMinPercent}% a {prod.targetReturnMaxPercent}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Risco:</span>
                    <span className="font-orbitron font-bold text-black">{prod.riskLevel}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleOpenEditProduct(prod)}
                  className="flex-1 bg-black hover:bg-neutral-800 text-white font-orbitron font-bold text-[10px] py-3 px-4 rounded-xl cursor-pointer uppercase flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Configurar</span>
                </button>
                <button
                  onClick={() => handleToggleProductActive(prod)}
                  className={`px-4 py-3 rounded-xl font-orbitron font-bold text-[10px] uppercase cursor-pointer border ${
                    prod.active
                      ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  {prod.active ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: POSITIONS & REAL FINANCIAL RESULT RECORDING */}
      {activeTab === 'positions' && (
        <div className="bg-white border border-gray-200 rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="border-b border-gray-200 pb-4">
            <h3 className="font-orbitron font-black text-base text-black uppercase">
               Registro de Resultados Financeiros Reais (Sem Rendimento Automático por Tempo)
            </h3>
            <p className="text-xs text-gray-600 font-sans mt-1">
              Utilize o botão <strong>"Registrar Resultado Real"</strong> para lançar a variação real apurada pela gestão de criptoativos em cada contrato, ou <strong>"Liquidar p/ Carteira"</strong> no vencimento.
            </p>
          </div>

          {positions.length === 0 ? (
            <p className="text-xs text-gray-500 py-8 text-center">
              Nenhuma aplicação registrada até o momento.
            </p>
          ) : (
            <div className="space-y-4">
              {positions.map((pos) => (
                <div
                  key={pos.id}
                  className="border border-gray-200 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gray-50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-orbitron font-black text-sm text-black uppercase">
                        {pos.productName}
                      </span>
                      <span className="text-[10px] font-mono bg-white border border-gray-300 px-2 py-0.5 rounded">
                        {pos.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 font-sans">
                      Investidor: <strong>{pos.userName || pos.userUid}</strong> ({pos.userEmail || '—'})
                    </p>
                    <p className="text-[11px] font-mono text-gray-500">
                      Aplicado em: {new Date(pos.appliedAt).toLocaleDateString('pt-BR')} • Vencimento:{' '}
                      {new Date(pos.maturityDate).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-right">
                      <span className="text-[9px] font-orbitron text-gray-500 uppercase block">
                        Principal / Atual
                      </span>
                      <span className="font-mono font-black text-sm text-black">
                        {formatBRL((pos.principalAmountCentavos || 0) / 100)} →{' '}
                        {formatBRL((pos.currentValuationCentavos || pos.principalAmountCentavos || 0) / 100)}
                      </span>
                      <span className="block text-[10px] font-mono text-emerald-700 font-bold">
                        Resultado Real: {(pos.realizedReturnPercent || 0) >= 0 ? '+' : ''}
                        {pos.realizedReturnPercent || 0}%
                      </span>
                    </div>

                    {pos.status !== 'SETTLED' && pos.status !== 'CANCELED' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setTargetPosition(pos);
                            setRealReturnPercent('3.5');
                          }}
                          className="bg-black hover:bg-neutral-800 text-white font-orbitron font-bold text-[10px] px-3.5 py-2.5 rounded-xl cursor-pointer uppercase"
                        >
                          Registrar Resultado Real
                        </button>
                        <button
                          onClick={() => handleSettlePosition(pos)}
                          className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-[10px] px-3.5 py-2.5 rounded-xl cursor-pointer uppercase"
                        >
                          Liquidar p/ Carteira
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: EDIT PRODUCT */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 text-black shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h3 className="font-orbitron font-black text-lg uppercase">
                Editar Produto: {editingProduct.name}
              </h3>
              <button onClick={() => setEditingProduct(null)} className="p-1 text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div>
                <label className="font-orbitron font-bold uppercase block mb-1">Nome do Produto</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-orbitron font-bold uppercase block mb-1">Valor Mínimo (R$)</label>
                  <input
                    type="number"
                    value={minReais}
                    onChange={(e) => setMinReais(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-orbitron font-bold uppercase block mb-1">Valor Máximo (R$)</label>
                  <input
                    type="number"
                    value={maxReais}
                    onChange={(e) => setMaxReais(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-orbitron font-bold uppercase block mb-1">Lock-up (Meses)</label>
                  <input
                    type="number"
                    value={editingProduct.lockupMonths}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        lockupMonths: Number(e.target.value),
                        lockupDays: Number(e.target.value) * 30
                      })
                    }
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-orbitron font-bold uppercase block mb-1">Meta Mín % (Ref.)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingProduct.targetReturnMinPercent}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        targetReturnMinPercent: Number(e.target.value)
                      })
                    }
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-orbitron font-bold uppercase block mb-1">Meta Máx % (Ref.)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingProduct.targetReturnMaxPercent}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        targetReturnMaxPercent: Number(e.target.value)
                      })
                    }
                    className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-orbitron font-bold uppercase block mb-1">
                  Descrição da Estratégia Cripto
                </label>
                <textarea
                  rows={3}
                  value={editingProduct.strategyDescription}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, strategyDescription: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-orbitron font-bold uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-6 py-2.5 rounded-xl bg-[#FF0033] text-white font-orbitron font-black uppercase cursor-pointer"
                >
                  {savingProduct ? 'Salvando...' : 'Salvar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD REAL STRATEGY RESULT */}
      {targetPosition && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 text-black shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h3 className="font-orbitron font-black text-base uppercase">
                Registrar Resultado Real ({targetPosition.productName})
              </h3>
              <button onClick={() => setTargetPosition(null)} className="p-1 text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordRealResult} className="space-y-4 text-xs">
              <div>
                <label className="font-orbitron font-bold uppercase block mb-1">
                  Período / Identificação da Apuração
                </label>
                <input
                  type="text"
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 font-sans"
                />
              </div>

              <div>
                <label className="font-orbitron font-bold uppercase block mb-1">
                  Resultado Financeiro Real no Período (%) — Pode ser positivo ou negativo
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={realReturnPercent}
                  onChange={(e) => setRealReturnPercent(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 font-mono font-bold text-base"
                />
              </div>

              <div>
                <label className="font-orbitron font-bold uppercase block mb-1">
                  Relatório das Operações Realizadas
                </label>
                <textarea
                  rows={3}
                  value={strategyNotes}
                  onChange={(e) => setStrategyNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTargetPosition(null)}
                  className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-orbitron font-bold uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={recordingResult}
                  className="px-6 py-2.5 rounded-xl bg-black text-white font-orbitron font-black uppercase cursor-pointer"
                >
                  {recordingResult ? 'Registrando...' : 'Confirmar Apuração Real'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
