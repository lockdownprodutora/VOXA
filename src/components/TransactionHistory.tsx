import React, { useState, useMemo } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Eye,
  X,
  CheckCircle,
  Clock,
  XCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  Gift,
  ShoppingBag,
  Copy,
  Check,
  Search,
  Filter
} from 'lucide-react';
import { formatBRL } from '../utils/money';

export interface TransactionHistoryProps {
  transactions: any[];
}

export type TransactionTypeCategory =
  | 'ALL'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRADE'
  | 'PURCHASE'
  | 'SALE'
  | 'PROMO'
  | 'REFUND';

export type TransactionStatusFilter =
  | 'ALL'
  | 'APPROVED'
  | 'PENDING'
  | 'REJECTED'
  | 'REFUNDED';

/**
 * Converte valores monetários de transações da VOXA para Reais (R$) de forma consistente.
 * As transações persistidas pelo backend/webhook e VOXA Trade utilizam centavos inteiros.
 */
function resolveDisplayAmountReais(tx: any, field: 'amount' | 'grossAmount' | 'netAmount' | 'platformFee' = 'amount'): number {
  const rawVal = Number(tx?.[field] ?? 0);
  if (!rawVal || isNaN(rawVal)) return 0;

  const rawType = String(tx?.type || '').toUpperCase();
  const isCentavosBased =
    rawType.includes('TRADE') ||
    rawType === 'DEPOSIT' ||
    rawType === 'PIX_DEPOSIT' ||
    rawType === 'WITHDRAWAL' ||
    rawType === 'SAQUE' ||
    rawType === 'REFERRAL_BONUS' ||
    String(tx?.walletType || '').toUpperCase() === 'PROMO' ||
    tx?.source === 'VOXA_TRADE' ||
    Math.abs(rawVal) >= 100;

  return isCentavosBased ? rawVal / 100 : rawVal;
}

export function categorizeTransactionType(tx: any): TransactionTypeCategory {
  const t = String(tx?.type || '').toUpperCase().trim();
  const wType = String(tx?.walletType || '').toUpperCase().trim();

  if (t === 'DEPOSIT' || t === 'PIX_DEPOSIT') return 'DEPOSIT';
  if (t === 'WITHDRAWAL' || t === 'SAQUE') return 'WITHDRAWAL';
  if (t.includes('TRADE') || tx?.source === 'VOXA_TRADE') return 'TRADE';
  if (t === 'REFERRAL_BONUS' || wType === 'PROMO') return 'PROMO';
  if (t === 'REFUND' || t === 'ESTORNO' || String(tx?.status || '').toUpperCase() === 'REFUNDED') return 'REFUND';
  if (t.startsWith('SALE') || t === 'FUNDRAISER_RECEIVED') return 'SALE';
  if (
    t.startsWith('PURCHASE') ||
    t === 'FUNDRAISER_CONTRIBUTION' ||
    t === 'SUSSURRO_REVEAL' ||
    t === 'AD_CAMPAIGN' ||
    String(tx?.direction || '').toUpperCase() === 'OUT'
  ) {
    return 'PURCHASE';
  }
  return 'DEPOSIT';
}

export function formatLedgerTypeLabel(type: string, direction?: string): string {
  const t = (type || '').toUpperCase().trim();
  const d = (direction || '').toUpperCase().trim();

  if (t === 'DEPOSIT' || t === 'PIX_DEPOSIT') return 'Depósito PIX';
  if (t === 'WITHDRAWAL' || t === 'SAQUE') return 'Saque via PIX';
  if (t === 'REFERRAL_BONUS') return 'Bônus de Indicação (Promocional)';
  if (t === 'TRADE_STAKE_RESERVED') return 'Abertura / Reserva VOXA Trade';
  if (t === 'TRADE_PAYOUT_WON') return 'Ganho Liquidado VOXA Trade';
  if (t === 'TRADE_STAKE_LOST') return 'Perda Liquidada VOXA Trade';
  if (t === 'TRADE_STAKE_REFUNDED') return 'Empate / Devolução VOXA Trade';
  if (t === 'PURCHASE' || t === 'PURCHASE_STORE') return 'Compra VOXA Store';
  if (t === 'PURCHASE_TICKET') return 'Compra de Ingresso';
  if (t === 'PURCHASE_SUBSCRIPTION') return 'Assinatura VIP / Criador';
  if (t === 'FUNDRAISER_CONTRIBUTION') return 'Apoio em Vaquinha';
  if (t === 'SUSSURRO_REVEAL') return 'Revelação de Sussurro';
  if (t === 'AD_CAMPAIGN') return 'Impulsionamento VOXA Ads';
  if (t === 'SALE' || t === 'SALE_STORE' || t === 'SALE_TICKET' || t === 'SALE_SUBSCRIPTION') return 'Venda Recebida';
  if (t === 'FUNDRAISER_RECEIVED') return 'Doação Recebida (Vaquinha)';
  if (t === 'REFUND' || t === 'ESTORNO') return 'Reembolso / Estorno';
  if (t === 'ADJUSTMENT' || t === 'ADMIN_ADJUSTMENT') return 'Ajuste Administrativo';

  return d === 'IN' ? 'Entrada de Saldo' : 'Saída de Saldo';
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ transactions }) => {
  const [typeCategory, setTypeCategory] = useState<TransactionTypeCategory>('ALL');
  const [statusFilter, setStatusFilter] = useState<TransactionStatusFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const itemsPerPage = 8;

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase().trim();
    switch (s) {
      case 'COMPLETED':
      case 'APPROVED':
      case 'APROVADO':
      case 'SUCCESS':
      case 'PAGO':
        return (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">
            Aprovado
          </span>
        );
      case 'PENDING':
      case 'PENDENTE':
      case 'PROCESSING':
      case 'IN_PROCESS':
        return (
          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">
            Pendente
          </span>
        );
      case 'FAILED':
      case 'REJECTED':
      case 'FALHOU':
      case 'RECUSADO':
        return (
          <span className="bg-red-50 text-red-700 border border-red-200 text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">
            Recusado
          </span>
        );
      case 'REFUNDED':
      case 'REEMBOLSADO':
      case 'ESTORNO':
        return (
          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">
            Estornado
          </span>
        );
      case 'EXPIRED':
      case 'EXPIRADO':
        return (
          <span className="bg-neutral-100 text-zinc-500 border border-[#E5E5E5] text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">
            Expirado
          </span>
        );
      case 'CANCELED':
      case 'CANCELLED':
      case 'CANCELADO':
        return (
          <span className="bg-neutral-100 text-zinc-500 border border-[#E5E5E5] text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">
            Cancelado
          </span>
        );
      default:
        return (
          <span className="bg-zinc-100 text-zinc-600 border border-[#E5E5E5] text-[9px] font-orbitron uppercase px-2.5 py-0.5 rounded-full font-black">
            {status || 'Concluído'}
          </span>
        );
    }
  };

  const getCategoryIcon = (tx: any, isIncoming: boolean) => {
    const cat = categorizeTransactionType(tx);
    if (cat === 'TRADE') {
      return isIncoming ? (
        <TrendingUp className="w-4 h-4" />
      ) : (
        <TrendingDown className="w-4 h-4" />
      );
    }
    if (cat === 'PROMO') return <Gift className="w-4 h-4" />;
    if (cat === 'PURCHASE') return <ShoppingBag className="w-4 h-4" />;
    if (cat === 'REFUND') return <RotateCcw className="w-4 h-4" />;
    return isIncoming ? (
      <ArrowDownLeft className="w-4 h-4" />
    ) : (
      <ArrowUpRight className="w-4 h-4" />
    );
  };

  // Contadores por categoria para exibir nos filtros
  const categoryCounts = useMemo(() => {
    const counts: Record<TransactionTypeCategory, number> = {
      ALL: transactions.length,
      DEPOSIT: 0,
      WITHDRAWAL: 0,
      TRADE: 0,
      PURCHASE: 0,
      SALE: 0,
      PROMO: 0,
      REFUND: 0
    };
    transactions.forEach((tx) => {
      const cat = categorizeTransactionType(tx);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Filtro por Tipo de Transação
      if (typeCategory !== 'ALL') {
        const txCat = categorizeTransactionType(tx);
        if (txCat !== typeCategory) return false;
      }

      // 2. Filtro por Status
      if (statusFilter !== 'ALL') {
        const s = String(tx.status || '').toUpperCase().trim();
        if (statusFilter === 'APPROVED' && !['COMPLETED', 'APPROVED', 'APROVADO', 'SUCCESS', 'PAGO'].includes(s)) {
          return false;
        }
        if (statusFilter === 'PENDING' && !['PENDING', 'PENDENTE', 'PROCESSING', 'IN_PROCESS'].includes(s)) {
          return false;
        }
        if (statusFilter === 'REJECTED' && !['FAILED', 'REJECTED', 'FALHOU', 'RECUSADO', 'EXPIRED', 'CANCELED'].includes(s)) {
          return false;
        }
        if (statusFilter === 'REFUNDED' && !['REFUNDED', 'REEMBOLSADO', 'ESTORNO'].includes(s)) {
          return false;
        }
      }

      // 3. Busca textual (ID, descrição, chave PIX, referência)
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim();
        const idStr = String(tx.id || '').toLowerCase();
        const descStr = String(tx.description || '').toLowerCase();
        const typeLabel = formatLedgerTypeLabel(tx.type, tx.direction).toLowerCase();
        const refStr = String(tx.referenceId || '').toLowerCase();
        if (!idStr.includes(q) && !descStr.includes(q) && !typeLabel.includes(q) && !refStr.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, typeCategory, statusFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedTxs = filteredTransactions.slice(
    (safeCurrentPage - 1) * itemsPerPage,
    safeCurrentPage * itemsPerPage
  );

  const typeFilterTabs: { id: TransactionTypeCategory; label: string }[] = [
    { id: 'ALL', label: 'Todas' },
    { id: 'DEPOSIT', label: 'Depósitos PIX' },
    { id: 'WITHDRAWAL', label: 'Saques' },
    { id: 'TRADE', label: 'VOXA Trade' },
    { id: 'PURCHASE', label: 'Compras' },
    { id: 'SALE', label: 'Vendas' },
    { id: 'PROMO', label: 'Bônus Promo' },
    { id: 'REFUND', label: 'Reembolsos' }
  ];

  const statusFilterTabs: { id: TransactionStatusFilter; label: string }[] = [
    { id: 'ALL', label: 'Todos Status' },
    { id: 'APPROVED', label: 'Aprovadas' },
    { id: 'PENDING', label: 'Pendentes' },
    { id: 'REJECTED', label: 'Recusadas / Expiradas' },
    { id: 'REFUNDED', label: 'Estornadas' }
  ];

  return (
    <>
      <div className="bg-white border border-[#E5E5E5] p-6 rounded-3xl text-left space-y-5 shadow-xs">
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-100 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#FF0033]" />
              <h3 className="font-orbitron font-black text-sm text-[#171717] uppercase tracking-wider">
                Histórico de Transações
              </h3>
            </div>
            <p className="text-[10px] text-gray-500 font-mono uppercase mt-0.5">
              Livro-Razão (Ledger) em tempo real • Depósitos, Saques, VOXA Trade e Compras
            </p>
          </div>

          {/* Search input */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por descrição ou ID..."
              className="w-full bg-[#FAFAFA] border border-[#E5E5E5] focus:border-black rounded-xl pl-9 pr-3 py-2 text-xs text-black focus:outline-none font-sans"
            />
          </div>
        </div>

        {/* Filter by Transaction Type */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-[9px] font-orbitron font-bold text-gray-400 uppercase tracking-wider">
            <Filter className="w-3 h-3" />
            <span>Filtrar por Tipo de Movimentação</span>
          </div>
          <div className="flex flex-wrap gap-1.5 bg-[#FAFAFA] border border-[#E5E5E5] p-1.5 rounded-2xl">
            {typeFilterTabs.map((tab) => {
              const count = categoryCounts[tab.id] || 0;
              const isActive = typeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setTypeCategory(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-orbitron font-bold transition-all cursor-pointer uppercase flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[#171717] text-white shadow-xs'
                      : 'text-gray-600 hover:text-black hover:bg-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[8px] font-mono ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-200/80 text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Filter by Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-1">
            {statusFilterTabs.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setStatusFilter(st.id);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-orbitron font-bold uppercase transition-colors cursor-pointer border ${
                  statusFilter === st.id
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-black'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <span className="text-[10px] font-mono text-gray-400 uppercase font-bold">
            {filteredTransactions.length}{' '}
            {filteredTransactions.length === 1 ? 'movimentação' : 'movimentações'}
          </span>
        </div>

        {/* Transactions List */}
        <div className="space-y-2.5">
          {paginatedTxs.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl text-gray-400 text-xs font-sans space-y-2">
              <p>Nenhuma transação financeira encontrada para os filtros selecionados.</p>
              {(typeCategory !== 'ALL' || statusFilter !== 'ALL' || searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setTypeCategory('ALL');
                    setStatusFilter('ALL');
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="text-[10px] font-orbitron font-bold uppercase text-[#FF0033] hover:underline cursor-pointer"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            paginatedTxs.map((tr) => {
              const isIncoming =
                String(tr.direction || '').toUpperCase() === 'IN' || Number(tr.amount || 0) > 0;
              const isPromo =
                String(tr.walletType || '').toUpperCase() === 'PROMO' ||
                String(tr.type || '').toUpperCase() === 'REFERRAL_BONUS';
              const displayAmount = Math.abs(resolveDisplayAmountReais(tr, 'amount'));
              const txCat = categorizeTransactionType(tr);

              return (
                <div
                  key={tr.id}
                  onClick={() => setSelectedTx(tr)}
                  className="bg-[#FAFAFA] hover:bg-gray-50 border border-[#E5E5E5] hover:border-black p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans transition-all cursor-pointer text-black shadow-xs group"
                >
                  <div className="flex items-start sm:items-center gap-3.5 text-left min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        isPromo
                          ? 'bg-purple-50 text-purple-600 border-purple-200'
                          : isIncoming
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-red-50 text-red-500 border-red-200'
                      }`}
                    >
                      {getCategoryIcon(tr, isIncoming)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-extrabold text-[#171717] uppercase truncate">
                          {tr.description || formatLedgerTypeLabel(tr.type, tr.direction)}
                        </span>
                        <span className="text-[8px] font-orbitron font-bold uppercase px-2 py-0.5 rounded-md bg-gray-200/70 text-gray-700">
                          {txCat === 'DEPOSIT'
                            ? 'Depósito'
                            : txCat === 'WITHDRAWAL'
                            ? 'Saque'
                            : txCat === 'TRADE'
                            ? 'Trade'
                            : txCat === 'PURCHASE'
                            ? 'Compra'
                            : txCat === 'SALE'
                            ? 'Venda'
                            : txCat === 'PROMO'
                            ? 'Promocional'
                            : 'Reembolso'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-gray-500 font-mono">
                        <span>
                          {tr.createdAt
                            ? new Date(tr.createdAt).toLocaleString('pt-BR')
                            : 'Sem data'}
                        </span>
                        <span>•</span>
                        <span>
                          ID: {String(tr.id).substring(Math.max(0, String(tr.id).length - 8)).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200/60 shrink-0">
                    <div className="text-left sm:text-right">
                      <span
                        className={`font-mono font-black text-sm block ${
                          isPromo
                            ? 'text-purple-700'
                            : isIncoming
                            ? 'text-emerald-600'
                            : 'text-red-500'
                        }`}
                      >
                        {isIncoming ? '+' : '-'} {formatBRL(displayAmount)}
                      </span>
                      <span className="text-[8px] text-gray-400 font-orbitron uppercase tracking-wider font-bold">
                        {isPromo ? 'Carteira Promo' : 'Carteira Real'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusBadge(tr.status)}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTx(tr);
                        }}
                        className="p-2 rounded-xl border border-gray-200 group-hover:border-black bg-white text-gray-600 group-hover:text-black transition-colors cursor-pointer"
                        title="Ver detalhes da transação"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-black shrink-0">
            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider font-bold">
              PÁGINA {safeCurrentPage} DE {totalPages} ({filteredTransactions.length} ITENS)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
                className="p-1.5 border border-[#E5E5E5] hover:border-black rounded-lg transition-all text-black hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage === totalPages}
                className="p-1.5 border border-[#E5E5E5] hover:border-black rounded-lg transition-all text-black hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-[90] p-4 animate-fadeIn"
          onClick={() => setSelectedTx(null)}
        >
          <div
            className="max-w-md w-full bg-white border border-[#E5E5E5] rounded-3xl p-6 space-y-5 text-left relative text-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedTx(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-black p-1 rounded-lg cursor-pointer transition-colors"
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1.5 pr-6">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-orbitron font-black text-[#FF0033] uppercase tracking-widest">
                  COMPROVANTE / DETALHES DA MOVIMENTAÇÃO
                </span>
                {getStatusBadge(selectedTx.status)}
              </div>
              <h3 className="text-base font-orbitron font-black text-black uppercase tracking-wide leading-snug">
                {selectedTx.description || formatLedgerTypeLabel(selectedTx.type, selectedTx.direction)}
              </h3>
            </div>

            {/* Highlighted Amount Card */}
            <div className="bg-[#171717] text-white p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[9px] font-orbitron uppercase tracking-widest text-gray-400 block">
                  Valor Movimentado
                </span>
                <span className="text-2xl font-mono font-black">
                  {(String(selectedTx.direction || '').toUpperCase() === 'IN' || Number(selectedTx.amount || 0) > 0) ? '+' : '-'}{' '}
                  {formatBRL(Math.abs(resolveDisplayAmountReais(selectedTx, 'amount')))}
                </span>
              </div>
              <span className="text-[9px] font-orbitron font-bold uppercase px-2.5 py-1 rounded-full bg-white/10 text-gray-200 border border-white/15">
                {String(selectedTx.walletType || '').toUpperCase() === 'PROMO' ||
                String(selectedTx.type || '').toUpperCase() === 'REFERRAL_BONUS'
                  ? 'Carteira Promocional'
                  : 'Carteira Real'}
              </span>
            </div>

            {/* Detailed Ledger Breakdown */}
            <div className="bg-[#FAFAFA] border border-[#E5E5E5] p-4 rounded-2xl space-y-3 text-xs">
              <div className="flex justify-between items-center border-b border-gray-200 pb-2.5 gap-2">
                <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase shrink-0">
                  ID da Transação
                </span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono font-bold text-black truncate select-all">
                    {selectedTx.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(String(selectedTx.id || ''));
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 2000);
                    }}
                    className="p-1 rounded-md hover:bg-gray-200 text-gray-600 cursor-pointer shrink-0"
                    title="Copiar ID"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-baseline border-b border-gray-200 pb-2.5">
                <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                  Categoria
                </span>
                <span className="font-sans font-bold text-black">
                  {formatLedgerTypeLabel(selectedTx.type, selectedTx.direction)}
                </span>
              </div>

              <div className="flex justify-between items-baseline border-b border-gray-200 pb-2.5">
                <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                  Data de Criação
                </span>
                <span className="font-mono text-black font-semibold">
                  {selectedTx.createdAt
                    ? new Date(selectedTx.createdAt).toLocaleString('pt-BR')
                    : 'Sem data'}
                </span>
              </div>

              {selectedTx.processedAt && (
                <div className="flex justify-between items-baseline border-b border-gray-200 pb-2.5">
                  <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                    Confirmado em
                  </span>
                  <span className="font-mono text-emerald-700 font-semibold">
                    {new Date(selectedTx.processedAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-baseline border-b border-gray-200 pb-2.5">
                <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                  Valor Bruto
                </span>
                <span className="font-mono text-black font-black">
                  {formatBRL(
                    Math.abs(
                      resolveDisplayAmountReais(
                        selectedTx,
                        selectedTx.grossAmount !== undefined ? 'grossAmount' : 'amount'
                      )
                    )
                  )}
                </span>
              </div>

              <div className="flex justify-between items-baseline border-b border-gray-200 pb-2.5">
                <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                  Taxa da Plataforma
                </span>
                <span className="font-mono text-red-500 font-black">
                  {formatBRL(Math.abs(resolveDisplayAmountReais(selectedTx, 'platformFee')))}
                </span>
              </div>

              <div className="flex justify-between items-baseline border-b border-gray-200 pb-2.5">
                <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                  Valor Líquido
                </span>
                <span className="font-mono text-emerald-600 font-black">
                  {formatBRL(
                    Math.abs(
                      resolveDisplayAmountReais(
                        selectedTx,
                        selectedTx.netAmount !== undefined ? 'netAmount' : 'amount'
                      )
                    )
                  )}
                </span>
              </div>

              {selectedTx.pixKey && (
                <div className="flex justify-between items-baseline border-b border-gray-200 pb-2.5">
                  <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                    Chave PIX ({selectedTx.pixKeyType || 'PIX'})
                  </span>
                  <span className="font-mono text-black font-semibold truncate max-w-[200px]">
                    {selectedTx.pixKey}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-orbitron font-bold text-gray-500 uppercase">
                  Referência / Origem
                </span>
                <span className="font-mono text-gray-700 font-semibold truncate max-w-[220px]">
                  {selectedTx.referenceId || selectedTx.source || 'VOXA Ledger'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedTx(null)}
              className="w-full bg-[#171717] hover:bg-black text-white font-orbitron font-black text-xs py-3 rounded-xl transition-all uppercase cursor-pointer"
            >
              Fechar Detalhes
            </button>
          </div>
        </div>
      )}
    </>
  );
};
