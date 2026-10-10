import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CreditCard, QrCode, FileText, CheckCircle, AlertCircle, Loader2, Copy, ExternalLink, MapPin, Calendar, Users, ArrowRight, ShieldCheck, HeartHandshake, Wallet } from 'lucide-react';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { saveStoreOrder } from '../utils/storeDb';

interface EmbeddedCheckoutProps {
  selectedProduct: any | null;
  selectedTicket: any | null;
  currentUser: any | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const EmbeddedCheckout: React.FC<EmbeddedCheckoutProps> = ({
  selectedProduct,
  selectedTicket,
  currentUser,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'details' | 'loading' | 'gateway' | 'success' | 'error'>('details');
  const [selectedMethod, setSelectedMethod] = useState<'credit_card' | 'pix' | 'wallet'>('pix');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Wallet-specific purchase states
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  useEffect(() => {
    if (currentUser?.uid) {
      setIsLoadingBalance(true);
      fetch(`/api/wallet/balance?userId=${currentUser.uid}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setUserBalance(data.balance);
          }
        })
        .catch(err => console.warn("Could not fetch balance inside checkout:", err))
        .finally(() => setIsLoadingBalance(false));
    }
  }, [currentUser]);

  // Ticket-specific purchase states
  const [selectedSectorId, setSelectedSectorId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [issuedTickets, setIssuedTickets] = useState<any[]>([]);

  // Shipping fields for Physical Products
  const [shippingName, setShippingName] = useState(currentUser?.name || '');
  const [shippingCep, setShippingCep] = useState('');
  const [shippingStreet, setShippingStreet] = useState('');
  const [shippingNumber, setShippingNumber] = useState('');
  const [shippingComplement, setShippingComplement] = useState('');
  const [shippingNeighborhood, setShippingNeighborhood] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingRate, setShippingRate] = useState(0);
  const [cepLoading, setCepLoading] = useState(false);
  const [shippingCalculationError, setShippingCalculationError] = useState('');

  const handleCepChange = async (val: string) => {
    // clean value and format
    const cleaned = val.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 5) {
      formatted = `${cleaned.substring(0, 5)}-${cleaned.substring(5, 8)}`;
    }
    setShippingCep(formatted);

    if (cleaned.length === 8) {
      setCepLoading(true);
      setShippingCalculationError('');
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
        const data = await res.json();
        if (data.erro) {
          setShippingCalculationError('CEP não encontrado. Digite o endereço manualmente.');
        } else {
          setShippingStreet(data.logradouro || '');
          setShippingNeighborhood(data.bairro || '');
          setShippingCity(data.localidade || '');
          setShippingState(data.uf || '');
          
          // Calculate modular shipping based on destination state
          const stateRates: Record<string, number> = {
            SP: 15.00,
            RJ: 15.00,
            MG: 18.00,
            ES: 18.00,
            PR: 22.00,
            SC: 22.00,
            RS: 22.00,
            DF: 25.00,
            GO: 28.00,
            MT: 30.00,
            MS: 30.00,
            BA: 25.00,
            PE: 28.00,
            CE: 28.00,
            RN: 28.00,
            PB: 28.00,
            AL: 28.00,
            SE: 28.00,
            MA: 32.00,
            PI: 32.00,
            TO: 32.00,
            PA: 35.00,
            AM: 35.00,
            RO: 35.00,
            AC: 38.00,
            RR: 38.00,
            AP: 38.00
          };
          const rate = stateRates[data.uf] || 25.00;
          setShippingRate(rate);
        }
      } catch (err) {
        setShippingCalculationError('Erro ao consultar CEP. Digite o endereço manualmente.');
      } finally {
        setCepLoading(false);
      }
    } else {
      setShippingRate(0);
    }
  };

  // Checkout details from backend
  const [orderId, setOrderId] = useState('');
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState('');
  const [grossValue, setGrossValue] = useState(0);
  const [expirationDate, setExpirationDate] = useState('');

  // Active public key / environment
  const [mpEnv, setMpEnv] = useState('test');
  const [mpPublicKey, setMpPublicKey] = useState('');

  // Fetch Mercado Pago Config
  useEffect(() => {
    const fetchMpConfig = async () => {
      try {
        const response = await fetch('/api/mercadopago/config');
        const data = await response.json();
        if (data.success) {
          setMpEnv(data.environment || 'test');
          setMpPublicKey(data.publicKey || '');
        }
      } catch (err) {
        console.error('[Checkout] Failed to fetch MP configuration:', err);
      }
    };
    fetchMpConfig();
  }, []);

  // Format price helper
  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  // Structured sectors and lots lookup
  const sectors = selectedTicket?.sectors || [
    { sectorId: "pista_default", name: "Pista Geral", capacity: 1000, active: true }
  ];

  // Set default sector on ticket loaded
  useEffect(() => {
    if (selectedTicket && sectors.length > 0) {
      const firstActive = sectors.find((s: any) => s.active !== false);
      if (firstActive) {
        setSelectedSectorId(firstActive.sectorId);
      } else {
        setSelectedSectorId(sectors[0].sectorId);
      }
    }
  }, [selectedTicket]);

  // Helper to find active lot and price for each sector on frontend
  const getSectorPriceAndLot = (sector: any) => {
    const lots = selectedTicket?.lots || [];
    const sectorLots = lots.filter((l: any) => l.sectorId === sector.sectorId && l.active !== false);
    
    if (sectorLots.length === 0) {
      // Legacy support fallback
      const fallbackPrice = parseFloat(selectedTicket?.price?.replace('R$', '').trim().replace(/\./g, '').replace(',', '.')) || 50;
      return { 
        price: fallbackPrice, 
        lotId: 'lote_unico',
        lotName: "Lote Único", 
        isSoldOut: false, 
        label: `R$ ${fallbackPrice.toFixed(2).replace('.', ',')}` 
      };
    }
    
    // Find first non-soldout lot
    const availableLots = sectorLots.filter((l: any) => !l.soldOut && (l.soldQuantity || 0) < l.quantity);
    if (availableLots.length === 0) {
      const lastLot = sectorLots[sectorLots.length - 1];
      return { 
        price: lastLot.price, 
        lotId: lastLot.lotId,
        lotName: lastLot.name, 
        isSoldOut: true, 
        label: "Esgotado" 
      };
    }
    
    const activeLot = availableLots[0];
    return { 
      price: activeLot.price, 
      lotId: activeLot.lotId,
      lotName: activeLot.name, 
      isSoldOut: false, 
      label: `R$ ${activeLot.price.toFixed(2).replace('.', ',')}` 
    };
  };

  // Get active selected sector/lot information
  const getSelectedDetails = () => {
    if (selectedProduct) {
      const rawPrice = selectedProduct.price;
      const cleanPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace("R$", "").trim().replace(/\./g, "").replace(",", ".")) || 0;
      return {
        name: selectedProduct.name,
        price: cleanPrice,
        image: selectedProduct.image,
        seller: selectedProduct.seller || 'VOXA Oficial',
        allowInstallments: selectedProduct.allowInstallments !== false,
        maxInstallments: selectedProduct.maxInstallments || 12,
        isDigital: selectedProduct.category === 'Contas Digitais',
        isTicket: false
      };
    }
    if (selectedTicket) {
      const curSector = sectors.find((s: any) => s.sectorId === selectedSectorId) || sectors[0];
      const details = getSectorPriceAndLot(curSector);
      return {
        name: `${selectedTicket.city} - ${selectedTicket.name || 'Show'}`,
        price: details.price,
        image: selectedTicket.imageUrl || null,
        seller: selectedTicket.organizerName || 'VOXA Oficial',
        allowInstallments: false,
        maxInstallments: 1,
        isDigital: false,
        isTicket: true,
        sectorName: curSector?.name || 'Geral',
        lotName: details.lotName,
        isSoldOut: details.isSoldOut,
        venue: selectedTicket.venue,
        date: selectedTicket.date
      };
    }
    return null;
  };

  const item = getSelectedDetails();

  // Polling Firestore for payment completion
  useEffect(() => {
    if (!orderId || step !== 'gateway') return;

    console.log(`[Checkout Polling] Listening to Firestore store_orders doc: ${orderId}`);
    
    // Set up real-time listener
    const unsub = onSnapshot(doc(db, 'store_orders', orderId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        console.log('[Checkout Polling] Order update caught:', data.status, data.paymentStatus);
        
        if (data.status === 'Pago' || data.paymentStatus === 'approved') {
          unsub();
          setStep('success');
          onSuccess(`Pagamento do seu ingresso para o evento foi aprovado com sucesso!`);
        } else if (data.status === 'Recusado' || data.status === 'Cancelado') {
          unsub();
          setErrorMsg('O pagamento foi recusado ou cancelado.');
          setStep('error');
        }
      }
    }, (err) => {
      console.warn('[Checkout Polling] Snapshot listener error, continuing silently:', err);
    });

    return () => unsub();
  }, [orderId, step]);

  // Fetch real issued tickets from tickets_issued collection upon success
  useEffect(() => {
    if (!orderId || step !== 'success') return;

    const q = query(
      collection(db, 'tickets_issued'),
      where('orderId', '==', orderId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const tickets: any[] = [];
      snapshot.forEach((doc) => {
        tickets.push({ id: doc.id, ...doc.data() });
      });
      console.log('[Checkout Success] Fetched tickets:', tickets);
      setIssuedTickets(tickets);
    }, (err) => {
      console.error('[Checkout Success] Error fetching tickets:', err);
    });

    return () => unsub();
  }, [orderId, step]);

  const handleGeneratePayment = async () => {
    if (!item) return;
    
    // Validate address fields for physical products
    if (selectedProduct && selectedProduct.type === 'Físico') {
      if (!shippingName.trim() || !shippingCep.trim() || !shippingStreet.trim() || !shippingNumber.trim() || !shippingNeighborhood.trim() || !shippingPhone.trim()) {
        setErrorMsg('Por favor, preencha todos os campos obrigatórios do endereço de entrega.');
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(true);
    setStep('loading');
    setErrorMsg('');

    const totalAmount = item.price * selectedQuantity + (selectedProduct && selectedProduct.type === 'Físico' ? shippingRate : 0);
    const centsAmount = Math.round(totalAmount * 100);

    // Front-end check for wallet payment method
    if (selectedMethod === 'wallet') {
      if (!currentUser?.uid) {
        setErrorMsg('Você precisa estar autenticado para comprar com o saldo da carteira.');
        setStep('details');
        setIsSubmitting(false);
        return;
      }
      if (userBalance === null || userBalance < centsAmount) {
        setErrorMsg(`Saldo insuficiente. Você possui R$ ${((userBalance || 0) / 100).toFixed(2).replace('.', ',')} mas precisa de R$ ${totalAmount.toFixed(2).replace('.', ',')}. Recarregue sua carteira.`);
        setStep('details');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      if (selectedMethod === 'wallet') {
        const curSector = selectedTicket ? (sectors.find((s: any) => s.sectorId === selectedSectorId) || sectors[0]) : null;
        const lotDetails = curSector ? getSectorPriceAndLot(curSector) : null;

        const payload = {
          userId: currentUser.uid,
          amount: centsAmount,
          buyerName: currentUser.name || 'Cliente VOXA',
          buyerEmail: currentUser.email || 'suporte@voxa.com.br',
          orderType: selectedTicket ? 'ticket' : 'store',
          productId: selectedProduct ? selectedProduct.id : selectedTicket.id,
          itemDescription: item.name,
          metadata: selectedTicket ? {
            showId: selectedTicket.id,
            sectorId: selectedSectorId,
            quantity: selectedQuantity,
            lotId: lotDetails?.lotId || 'lote_unico'
          } : {
            shippingAddress: selectedProduct.type === 'Físico' ? {
              name: shippingName.trim(),
              cep: shippingCep.trim(),
              street: shippingStreet.trim(),
              number: shippingNumber.trim(),
              complement: shippingComplement.trim(),
              neighborhood: shippingNeighborhood.trim(),
              city: shippingCity,
              state: shippingState,
              phone: shippingPhone.trim()
            } : undefined,
            shippingValue: selectedProduct.type === 'Físico' ? shippingRate : 0,
            quantity: 1
          }
        };

        const resp = await fetch('/api/wallet/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await resp.json();
        if (data.success) {
          setOrderId(data.orderId);
          // Set to success instantly! Wallet payment is processed immediately.
          setStep('success');
          onSuccess(`Sua compra foi realizada com sucesso usando o saldo da sua carteira!`);
        } else {
          throw new Error(data.error || 'Erro ao realizar pagamento com saldo da carteira.');
        }
      } else if (selectedProduct) {
        // Direct call to store orders API
        const payload = {
          productId: selectedProduct.id,
          buyerEmail: currentUser?.email || 'visitante@voxa.com.br',
          buyerName: currentUser?.name || 'Visitante',
          buyerUid: currentUser?.uid || '',
          quantity: 1,
          shippingAddress: selectedProduct.type === 'Físico' ? {
            name: shippingName.trim(),
            cep: shippingCep.trim(),
            street: shippingStreet.trim(),
            number: shippingNumber.trim(),
            complement: shippingComplement.trim(),
            neighborhood: shippingNeighborhood.trim(),
            city: shippingCity,
            state: shippingState,
            phone: shippingPhone.trim()
          } : undefined,
          shippingValue: selectedProduct.type === 'Físico' ? shippingRate : 0
        };

        const resp = await fetch('/api/store/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await resp.json();
        if (data.success) {
          setOrderId(data.orderId);
          setPixQrCode(data.qrCode);
          setPixQrCodeBase64(data.qrCodeBase64);
          setGrossValue(data.grossValue || item.price);
          setExpirationDate(data.expirationDate);
          setStep('gateway');
        } else {
          throw new Error(data.error || 'Erro ao gerar PIX para o produto na Store.');
        }
      } else if (selectedTicket) {
        // Direct call to tickets orders API
        const payload = {
          showId: selectedTicket.id,
          sectorId: selectedSectorId,
          quantity: selectedQuantity,
          buyerEmail: currentUser?.email || 'visitante@voxa.com.br',
          buyerName: currentUser?.name || 'Visitante',
          buyerUid: currentUser?.uid || ''
        };

        const resp = await fetch('/api/tickets/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await resp.json();
        if (data.success) {
          setOrderId(data.orderId);
          setPixQrCode(data.qrCode);
          setPixQrCodeBase64(data.qrCodeBase64);
          setGrossValue(data.grossValue);
          setExpirationDate(data.expirationDate);
          setStep('gateway');
        } else {
          throw new Error(data.error || 'Erro ao criar pedido de ingressos no servidor.');
        }
      }
    } catch (err: any) {
      console.error('[Checkout Error]', err);
      setErrorMsg(err.message || 'Erro ao comunicar com o servidor de pagamentos. Verifique sua conexão e tente novamente.');
      setStep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPixCode = () => {
    if (pixQrCode) {
      navigator.clipboard.writeText(pixQrCode);
      alert('Código de pagamento PIX Copia e Cola copiado para a área de transferência!');
    }
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-lg overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card max-w-4xl w-full rounded-3xl border border-white/20 bg-black text-white relative flex flex-col md:flex-row overflow-hidden my-8 shadow-2xl"
        id="embedded_checkout_card"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 cursor-pointer z-10 transition-colors bg-white/5 hover:bg-white/10 rounded-full"
          id="btn_close_checkout"
        >
          <X className="w-5 h-5" />
        </button>

        {/* STEP: DETAILS & METHOD SELECT */}
        {step === 'details' && (
          <>
            {/* Left Column: Product/Event Summary */}
            <div className="w-full md:w-5/12 p-8 bg-[#0a0a0a] border-b md:border-b-0 md:border-r border-white/10 flex flex-col justify-between">
              <div>
                <span className="font-orbitron text-[10px] text-red-500 tracking-widest block mb-4 uppercase font-bold">DETALHES DO PEDIDO</span>
                
                {item.image && (
                  <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-neutral-900 mb-6 border border-white/10">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                )}

                <h3 className="font-orbitron font-black text-2xl text-white mb-2 leading-tight uppercase">
                  {item.name}
                </h3>
                
                <p className="text-xs text-gray-400 mb-4 flex items-center gap-1.5">
                  Organizador: <strong className="text-white">{item.seller}</strong>
                </p>

                {item.isTicket && (
                  <div className="space-y-2 mb-6 text-xs text-gray-400 bg-white/5 p-4 rounded-xl border border-white/5">
                    <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-red-500" /> {item.date}</p>
                    <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-red-500" /> {item.venue}</p>
                  </div>
                )}

                <div className="space-y-3 py-4 border-t border-b border-white/10">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 font-sans">Quantidade:</span>
                    <span className="text-white font-orbitron font-bold">{selectedQuantity}x</span>
                  </div>
                  {item.isTicket && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400 font-sans">Setor:</span>
                        <span className="text-red-500 font-orbitron font-bold uppercase text-xs">{item.sectorName}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400 font-sans">Lote:</span>
                        <span className="text-white font-orbitron font-medium text-xs">{item.lotName}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 font-sans">Preço Unitário:</span>
                    <span className="text-white font-orbitron font-bold">{formatBRL(item.price)}</span>
                  </div>
                  {selectedProduct && selectedProduct.type === 'Físico' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400 font-sans">Frete (Entrega):</span>
                      <span className="text-white font-orbitron font-bold">
                        {shippingRate === 0 ? 'Aguardando CEP' : formatBRL(shippingRate)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white/10">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-gray-400 text-xs font-orbitron">TOTAL DO PEDIDO</span>
                  <span className="text-white font-orbitron font-black text-3xl">
                    {formatBRL(item.price * selectedQuantity + (selectedProduct && selectedProduct.type === 'Físico' ? shippingRate : 0))}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 font-sans leading-relaxed">
                  Taxas de intermediação e comissões inclusas. Processamento criptografado via SSL.
                </p>
              </div>
            </div>

            {/* Right Column: Checkout Configuration */}
            <div className="w-full md:w-7/12 p-8 flex flex-col justify-between space-y-6">
              <div>
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#FF0033] text-white flex items-center justify-center font-orbitron font-black text-sm shadow-[0_0_15px_rgba(255,0,51,0.4)]">
                    VP
                  </div>
                  <div>
                    <span className="font-orbitron text-[10px] text-gray-400 tracking-widest block uppercase font-bold">PRODUTORA & TICKETS</span>
                    <h4 className="font-orbitron font-black text-lg text-white leading-none">VOXA PAY</h4>
                  </div>
                </div>

                {/* TICKET OPTIONS: SECTOR & QUANTITY */}
                {selectedTicket && (
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase mb-2 tracking-widest">Selecione o Setor do Evento</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {sectors.map((sec: any) => {
                          const details = getSectorPriceAndLot(sec);
                          const isSelected = selectedSectorId === sec.sectorId;
                          return (
                            <button
                              key={sec.sectorId}
                              disabled={details.isSoldOut || sec.active === false}
                              onClick={() => {
                                setSelectedSectorId(sec.sectorId);
                                setSelectedQuantity(1);
                              }}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? 'bg-[#FF0033]/10 border-[#FF0033] text-white shadow-[0_0_15px_rgba(255,0,51,0.1)]'
                                  : 'bg-white/5 border-white/10 hover:border-white/20 text-gray-300'
                              } ${(details.isSoldOut || sec.active === false) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-orbitron font-bold text-xs uppercase">{sec.name}</span>
                                {details.isSoldOut && (
                                  <span className="text-[9px] bg-red-950/80 text-red-500 border border-red-500/20 px-1.5 py-0.5 rounded uppercase">Esgotado</span>
                                )}
                              </div>
                              <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                                <span>{details.lotName}</span>
                                <span className="text-white font-bold">{details.label}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-[10px] font-orbitron font-bold text-gray-400 uppercase tracking-widest">Quantidade de Ingressos</label>
                        <span className="text-[10px] font-sans text-gray-400">Limite de 5 por pessoa</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {[1, 2, 3, 4, 5].map((q) => (
                          <button
                            key={q}
                            onClick={() => setSelectedQuantity(q)}
                            className={`w-10 h-10 rounded-lg border font-orbitron font-bold text-xs transition-all cursor-pointer ${
                              selectedQuantity === q
                                ? 'bg-[#FF0033] border-[#FF0033] text-white'
                                : 'bg-white/5 border-white/10 hover:border-white/25 text-gray-400'
                            }`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ADDRESS COLLECTION & SHIPPING FOR PHYSICAL PRODUCTS */}
                {selectedProduct && selectedProduct.type === 'Físico' && (
                  <div className="space-y-4 mb-6 bg-white/5 p-4 rounded-2xl border border-white/10 text-left">
                    <span className="font-orbitron text-[10px] text-red-500 tracking-widest block uppercase font-bold">ENDEREÇO DE ENTREGA</span>
                    <h4 className="font-orbitron font-black text-sm text-white uppercase mb-2">DADOS DE ENVIO</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-[9px] text-gray-400 font-orbitron uppercase mb-1">Nome Completo do Destinatário *</label>
                        <input
                          type="text"
                          required
                          value={shippingName}
                          onChange={(e) => setShippingName(e.target.value)}
                          placeholder="Quem receberá o produto"
                          className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF0033]"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] text-gray-400 font-orbitron uppercase mb-1">CEP *</label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            maxLength={9}
                            value={shippingCep}
                            onChange={(e) => handleCepChange(e.target.value)}
                            placeholder="00000-000"
                            className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF0033]"
                          />
                          {cepLoading && (
                            <div className="absolute right-2 top-2.5 w-4 h-4 border-2 border-[#FF0033]/20 border-t-[#FF0033] rounded-full animate-spin"></div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] text-gray-400 font-orbitron uppercase mb-1">Telefone *</label>
                        <input
                          type="text"
                          required
                          value={shippingPhone}
                          onChange={(e) => setShippingPhone(e.target.value)}
                          placeholder="(00) 90000-0000"
                          className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF0033]"
                        />
                      </div>

                      <div className="col-span-1 sm:col-span-2">
                        <label className="block text-[9px] text-gray-400 font-orbitron uppercase mb-1">Rua / Logradouro *</label>
                        <input
                          type="text"
                          required
                          value={shippingStreet}
                          onChange={(e) => setShippingStreet(e.target.value)}
                          placeholder="Av. Paulista, etc."
                          className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF0033]"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] text-gray-400 font-orbitron uppercase mb-1">Número *</label>
                        <input
                          type="text"
                          required
                          value={shippingNumber}
                          onChange={(e) => setShippingNumber(e.target.value)}
                          placeholder="Ex: 123"
                          className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF0033]"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] text-gray-400 font-orbitron uppercase mb-1">Complemento / Bloco</label>
                        <input
                          type="text"
                          value={shippingComplement}
                          onChange={(e) => setShippingComplement(e.target.value)}
                          placeholder="Apto 42, Bloco B"
                          className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] text-gray-400 font-orbitron uppercase mb-1">Bairro *</label>
                        <input
                          type="text"
                          required
                          value={shippingNeighborhood}
                          onChange={(e) => setShippingNeighborhood(e.target.value)}
                          placeholder="Centro, etc."
                          className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] text-gray-400 font-orbitron uppercase mb-1">Cidade / UF *</label>
                        <input
                          type="text"
                          required
                          value={shippingCity ? `${shippingCity} - ${shippingState}` : ''}
                          disabled
                          placeholder="Preenchido via CEP"
                          className="w-full bg-zinc-900 border border-white/5 text-gray-400 rounded-lg px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    {shippingCalculationError && (
                      <p className="text-[10px] text-red-400 font-sans mt-1">{shippingCalculationError}</p>
                    )}

                    {shippingRate > 0 && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#FF0033]/5 border border-[#FF0033]/10 mt-2">
                        <span className="text-[10px] text-gray-300 font-sans">Valor calculado do frete:</span>
                        <span className="text-[#FF0033] font-orbitron font-bold text-xs">{formatBRL(shippingRate)}</span>
                      </div>
                    )}
                  </div>
                )}

                <h3 className="font-orbitron font-bold text-xs text-gray-400 mb-3 uppercase tracking-widest">
                  Meios de Pagamento Disponíveis
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  {/* PIX Button */}
                  <button
                    onClick={() => setSelectedMethod('pix')}
                    className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      selectedMethod === 'pix'
                        ? 'bg-white/5 border-[#FF0033] shadow-[inset_0_0_10px_rgba(255,0,51,0.15)]'
                        : 'bg-transparent border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-neutral-900 flex items-center justify-center text-[#FF0033]">
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-orbitron font-bold text-sm block text-white uppercase">PIX SEGURO</span>
                        <span className="text-[10px] text-gray-400 font-sans block mt-0.5">
                          Aprovação instantânea 24/7 via QR Code
                        </span>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedMethod === 'pix' ? 'border-[#FF0033]' : 'border-white/20'}`}>
                      {selectedMethod === 'pix' && <div className="w-2 h-2 rounded-full bg-[#FF0033]" />}
                    </div>
                  </button>

                  {/* CARTEIRA LOCKDOWN (Only for authenticated users) */}
                  {currentUser && (
                    <button
                      onClick={() => setSelectedMethod('wallet')}
                      className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        selectedMethod === 'wallet'
                          ? 'bg-white/5 border-[#FF0033] shadow-[inset_0_0_10px_rgba(255,0,51,0.15)]'
                          : 'bg-transparent border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg bg-neutral-900 flex items-center justify-center text-emerald-400">
                          <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="font-orbitron font-bold text-sm block text-white uppercase flex items-center gap-2">
                            CARTEIRA VOXA
                            {userBalance !== null && (
                              <span className={`text-[10px] font-sans px-2 py-0.5 rounded font-bold uppercase ${
                                (userBalance < (item.price * selectedQuantity + (selectedProduct && selectedProduct.type === 'Físico' ? shippingRate : 0)) * 100)
                                  ? 'bg-red-950/80 text-red-500 border border-red-500/20'
                                  : 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {formatBRL(userBalance / 100)}
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-gray-400 font-sans block mt-0.5">
                            {isLoadingBalance 
                              ? 'Consultando saldo...' 
                              : (userBalance !== null && (userBalance < (item.price * selectedQuantity + (selectedProduct && selectedProduct.type === 'Físico' ? shippingRate : 0)) * 100))
                                ? 'Saldo insuficiente para concluir este pedido.'
                                : 'Débito instantâneo com aprovação imediata'
                            }
                          </span>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedMethod === 'wallet' ? 'border-[#FF0033]' : 'border-white/20'}`}>
                        {selectedMethod === 'wallet' && <div className="w-2 h-2 rounded-full bg-[#FF0033]" />}
                      </div>
                    </button>
                  )}

                  {/* Disable other payment methods for tickets according to guidelines */}
                  {!selectedTicket && (
                    <>
                      <button
                        onClick={() => setSelectedMethod('credit_card')}
                        className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          selectedMethod === 'credit_card'
                            ? 'bg-white/5 border-[#FF0033]'
                            : 'bg-transparent border-white/10 hover:border-white/25 opacity-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-neutral-900 flex items-center justify-center text-gray-500">
                            <CreditCard className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-orbitron font-bold text-sm block text-gray-400 uppercase">CARTÃO DE CRÉDITO</span>
                          </div>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/10">
                <button
                  disabled={
                    item.isSoldOut || 
                    (selectedMethod === 'wallet' && userBalance !== null && userBalance < (item.price * selectedQuantity + (selectedProduct && selectedProduct.type === 'Físico' ? shippingRate : 0)) * 100)
                  }
                  onClick={handleGeneratePayment}
                  className={`w-full text-white font-orbitron font-black py-4 rounded-xl text-xs tracking-wider transition-all flex items-center justify-center space-x-2 ${
                    (item.isSoldOut || (selectedMethod === 'wallet' && userBalance !== null && userBalance < (item.price * selectedQuantity + (selectedProduct && selectedProduct.type === 'Físico' ? shippingRate : 0)) * 100))
                      ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-white/5' 
                      : 'bg-[#FF0033] hover:bg-red-700 cursor-pointer shadow-[0_4px_20px_rgba(255,0,51,0.25)]'
                  }`}
                >
                  <span>
                    {item.isSoldOut 
                      ? 'SETOR ESGOTADO' 
                      : selectedMethod === 'wallet'
                        ? (userBalance !== null && userBalance < (item.price * selectedQuantity + (selectedProduct && selectedProduct.type === 'Físico' ? shippingRate : 0)) * 100)
                          ? 'SALDO INSUFICIENTE'
                          : 'PAGAR COM SALDO DA CARTEIRA'
                        : 'GERAR PIX DE PAGAMENTO'
                    }
                  </span>
                </button>
                <div className="text-[9px] text-gray-500 text-center font-sans">
                  {selectedMethod === 'wallet' 
                    ? '*O valor total será debitado do saldo interno da sua carteira VOXA instantaneamente.'
                    : '*Processado com checkout transparente do Mercado Pago Oficial. Ingressos liberados no aplicativo imediatamente após a confirmação.'
                  }
                </div>
              </div>
            </div>
          </>
        )}

        {/* STEP: LOADING GATEWAY */}
        {step === 'loading' && (
          <div className="w-full p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[450px]">
            <Loader2 className="w-12 h-12 text-[#FF0033] animate-spin" />
            <div className="space-y-2 max-w-md">
              <h3 className="font-orbitron font-black text-lg text-white uppercase">
                PREPARANDO TRANSAÇÃO PIX TRANSPARENTE
              </h3>
              <p className="text-xs text-gray-400 font-sans leading-relaxed">
                Estamos registrando seu pedido seguro, gerando a chave PIX Copia e Cola e o QR Code oficial no Mercado Pago. Por favor, aguarde alguns instantes...
              </p>
            </div>
          </div>
        )}

        {/* STEP: PIX CHECKOUT SCREEN (TRANSPARENT CHECKOUT INSIDE LOCKDOWN) */}
        {step === 'gateway' && (
          <div className="w-full flex flex-col md:flex-row min-h-[500px]">
            {/* Left side: QR Code and Copa e Cola */}
            <div className="w-full md:w-7/12 p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <div>
                    <span className="font-orbitron text-[9px] text-gray-400 tracking-wider uppercase block font-bold">PIX ATIVO GERADO</span>
                    <span className="text-xs font-mono text-gray-400">{orderId}</span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-3xl max-w-[240px] mx-auto border-4 border-[#FF0033] shadow-lg relative">
                  <img
                    src={pixQrCodeBase64 && pixQrCodeBase64 !== "MOCK_QR_BASE64"
                      ? `data:image/png;base64,${pixQrCodeBase64}`
                      : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixQrCode)}`
                    }
                    alt="PIX QR Code"
                    className="w-full aspect-square object-contain"
                  />
                </div>

                <div className="space-y-2 text-center">
                  <span className="text-xs text-gray-400 font-sans">Ou utilize o código Copia e Cola abaixo:</span>
                  <div className="flex gap-2 max-w-md mx-auto">
                    <input
                      type="text"
                      readOnly
                      value={pixQrCode}
                      className="flex-1 bg-[#121212] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-gray-300 focus:outline-none"
                    />
                    <button
                      onClick={handleCopyPixCode}
                      className="bg-[#FF0033] hover:bg-red-700 text-white p-3 rounded-xl cursor-pointer transition-colors"
                      title="Copiar PIX"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/15 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 font-orbitron uppercase block">Valor Total do PIX</span>
                  <span className="text-white font-orbitron font-black text-xl">{formatBRL(grossValue)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 font-orbitron uppercase block">Expiração em</span>
                  <span className="text-red-400 font-orbitron text-xs font-bold">15 minutos</span>
                </div>
              </div>
            </div>

            {/* Right side: Instruction & Simulation */}
            <div className="w-full md:w-5/12 p-8 bg-[#0a0a0a] border-t md:border-t-0 md:border-l border-white/10 flex flex-col justify-between">
              <div className="space-y-6">
                <div>
                  <span className="font-orbitron text-[10px] text-red-500 tracking-widest block mb-1 uppercase font-bold">COMO PAGAR</span>
                  <h4 className="font-orbitron font-black text-base text-white uppercase mb-4">INSTRUÇÕES DE ACESSO</h4>
                  
                  <ol className="text-xs text-gray-300 font-sans space-y-3 list-decimal pl-4 leading-relaxed">
                    <li>Abra o aplicativo do seu banco de preferência.</li>
                    <li>Escolha a opção pagar via <strong className="text-white">PIX / QR Code</strong>.</li>
                    <li>Aponte a câmera para o QR Code ao lado ou cole o código copia e cola.</li>
                    <li>Confirme os dados do VOXA e conclua o pagamento.</li>
                  </ol>
                </div>

                <div className="p-4 rounded-xl bg-red-950/20 border border-[#FF0033]/30">
                  <p className="text-[11px] text-gray-300 font-sans leading-relaxed flex items-start gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#FF0033] shrink-0 mt-0.5" />
                    <span>Nossos servidores estão aguardando a confirmação via webhook oficial do Mercado Pago. A aprovação é reconhecida automaticamente em poucos segundos após o pagamento.</span>
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 space-y-3">
                <div className="text-[10px] text-gray-400 text-center font-sans">
                  Não feche esta tela antes de pagar. Assim que o Mercado Pago aprovar o PIX, a confirmação será exibida automaticamente.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP: SUCCESS COMPLETED */}
        {step === 'success' && (
          <div className="w-full p-8 md:p-12 flex flex-col items-center justify-center text-center space-y-8 min-h-[500px]">
            <div className="w-16 h-16 rounded-full bg-emerald-950/40 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-bounce">
              <CheckCircle className="w-8 h-8" />
            </div>
            
            <div className="space-y-2 max-w-lg">
              <h3 className="font-orbitron font-black text-2xl sm:text-3xl text-white uppercase tracking-wider">
                COMPRA CONFIRMADA!
              </h3>
              <p className="text-xs text-gray-400 font-sans leading-relaxed">
                {item.isTicket 
                  ? 'Parabéns! O pagamento via PIX foi aprovado pelo Mercado Pago. Seu ingresso digital está liberado e ativo.' 
                  : 'Parabéns! O pagamento via PIX do seu produto foi aprovado pelo Mercado Pago. O pedido já foi registrado.'}
              </p>
            </div>

            {/* IF TICKET: SHOW DIGITAL PASS WITH QR CODES */}
            {item.isTicket ? (
              <div className="w-full max-w-xl bg-gradient-to-b from-[#121212] to-black border-2 border-white/10 rounded-3xl overflow-hidden shadow-2xl text-left">
                <div className="bg-[#FF0033] px-6 py-3 flex justify-between items-center">
                  <span className="font-orbitron text-[10px] font-black tracking-widest text-white uppercase">INGRESSO DIGITAL DE ACESSO</span>
                  <span className="font-mono text-[10px] font-bold text-white/90"># {orderId.split('_').pop()?.toUpperCase()}</span>
                </div>
                
                <div className="p-6 space-y-6">
                  <div>
                    <h4 className="font-orbitron font-black text-lg text-white uppercase leading-tight">{item.name}</h4>
                    <p className="text-xs text-gray-400 mt-1 uppercase font-semibold">{item.sectorName} — {item.lotName}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-gray-500 block">DATA DO SHOW</span>
                      <span className="text-white font-orbitron font-bold flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-red-500" /> {item.date}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-500 block">LOCALIZAÇÃO</span>
                      <span className="text-white font-sans flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" /> {item.venue}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-white/20 pt-6 flex flex-col items-center justify-center space-y-4">
                    <span className="text-[10px] font-orbitron text-gray-500 tracking-widest uppercase">APRESENTE O QR CODE ABAIXO NA ENTRADA</span>
                    
                    <div className="flex flex-wrap justify-center gap-4">
                      {issuedTickets.length > 0 ? (
                        issuedTickets.map((tkt, index) => (
                          <div key={tkt.ticketId} className="flex flex-col items-center bg-white p-3 rounded-2xl border-2 border-red-500">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(tkt.qrToken)}`}
                              alt={`Ticket ${index + 1}`}
                              className="w-28 h-28 object-contain"
                            />
                            <span className="text-[9px] text-black font-orbitron font-bold mt-1.5 uppercase">INGRESSO {index + 1}/{issuedTickets.length}</span>
                          </div>
                        ))
                      ) : (
                        Array.from({ length: selectedQuantity }).map((_, index) => (
                          <div key={index} className="flex flex-col items-center bg-white p-3 rounded-2xl border-2 border-red-500 opacity-60 animate-pulse">
                            <div className="w-28 h-28 bg-gray-200 flex items-center justify-center">
                              <span className="text-[10px] text-gray-500 font-orbitron">GERANDO...</span>
                            </div>
                            <span className="text-[9px] text-black font-orbitron font-bold mt-1.5 uppercase">INGRESSO {index + 1}/{selectedQuantity}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 p-4 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-sans flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-[#FF0033]" /> Localizado via Google Maps</span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.venue}, ${selectedTicket?.city || ''}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-400 hover:text-white font-orbitron font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    ABRIR MAPA <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              /* IF STORE PRODUCT: SHOW STORE ORDER VOUCHER */
              <div className="w-full max-w-xl bg-gradient-to-b from-[#121212] to-black border-2 border-white/10 rounded-3xl overflow-hidden shadow-2xl text-left">
                <div className="bg-[#FF0033] px-6 py-3 flex justify-between items-center">
                  <span className="font-orbitron text-[10px] font-black tracking-widest text-white uppercase">COMPROVANTE DE PEDIDO STORE</span>
                  <span className="font-mono text-[10px] font-bold text-white/90"># {orderId.split('_').pop()?.toUpperCase()}</span>
                </div>
                
                <div className="p-6 space-y-6">
                  <div>
                    <span className="text-[10px] text-gray-500 font-orbitron uppercase block mb-1">PRODUTO ADQUIRIDO</span>
                    <h4 className="font-orbitron font-black text-xl text-white uppercase leading-tight">{item.name}</h4>
                    <p className="text-xs text-gray-400 mt-1">Vendedor: <strong className="text-white">{item.seller}</strong></p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-white/5 p-4 rounded-xl border border-white/10">
                    <div className="space-y-1">
                      <span className="text-gray-500 block">TOTAL PAGO</span>
                      <span className="text-white font-orbitron font-bold text-base">{formatBRL(grossValue || item.price)}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-500 block">STATUS</span>
                      <span className="text-emerald-400 font-orbitron font-bold flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> PAGO VIA PIX</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-400 font-sans leading-relaxed border-t border-white/10 pt-4">
                    O vendedor e a equipe do VOXA já receberam a confirmação do seu pedido. Caso seja um item digital, verifique suas instruções ou entre em contato com o suporte.
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="px-8 py-3.5 bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-black text-xs rounded-xl tracking-wider cursor-pointer shadow-lg transition-all"
            >
              CONCLUIR COMPRA
            </button>
          </div>
        )}

        {/* STEP: ERROR STATE */}
        {step === 'error' && (
          <div className="w-full p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[450px]">
            <div className="w-20 h-20 rounded-full bg-red-950/40 border-2 border-red-500 flex items-center justify-center text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
              <AlertCircle className="w-10 h-10" />
            </div>

            <div className="space-y-2 max-w-md">
              <h3 className="font-orbitron font-black text-xl text-white uppercase tracking-wide">
                FALHA NO AGENDAMENTO
              </h3>
              <p className="text-xs text-red-400 font-sans leading-relaxed">
                {errorMsg || 'Não foi possível carregar o formulário de pagamento. Verifique se o setor selecionado possui vagas disponíveis e tente novamente.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center max-w-xs">
              <button
                onClick={() => setStep('details')}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-orbitron font-bold text-xs rounded-xl cursor-pointer transition-all border border-white/10"
              >
                TENTAR NOVAMENTE
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-xs rounded-xl cursor-pointer transition-all"
              >
                FECHAR JANELA
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
