import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Ticket, 
  Users, 
  DollarSign, 
  QrCode, 
  MapPin, 
  Plus, 
  Edit, 
  Trash2, 
  X, 
  Upload, 
  Check, 
  Search, 
  ShieldCheck, 
  Clock, 
  ShieldX, 
  CheckCircle, 
  AlertTriangle,
  Activity,
  TrendingUp,
  Percent,
  PiggyBank,
  CreditCard,
  ChevronRight,
  Filter,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  Cpu,
  Key,
  Clipboard,
  Server
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { db, collection, query, where, getDocs } from '../../lib/firebase';
import { fetchShows, saveShow, deleteShow, Show, fetchStoreOrders } from '../../utils/storeDb';
import { uploadFile } from '../../utils/upload';
import { formatBRL, maskBRL, parseBRLToNumber } from '../../utils/money';
import { Sector, Lot } from '../../types';

interface TicketModuleProps {
  onBackToMenu: () => void;
}

export const TicketModule: React.FC<TicketModuleProps> = ({ onBackToMenu }) => {
  // Navigation tabs
  const [activeSubTab, setActiveSubTab] = useState<'events' | 'scanner' | 'devices' | 'platform_finance'>('events');

  // Devices & Turnstiles state
  const [devicesList, setDevicesList] = useState<any[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [registeringDevice, setRegisteringDevice] = useState(false);
  const [newDeviceForm, setNewDeviceForm] = useState({
    deviceId: '',
    deviceName: '',
    gateId: '',
    eventId: 'ALL'
  });
  const [credentialsModal, setCredentialsModal] = useState<{
    isOpen: boolean;
    deviceKey: string;
    deviceId: string;
  } | null>(null);

  const fetchDevices = async () => {
    setDevicesLoading(true);
    try {
      const res = await fetch('/api/tickets/devices');
      const data = await res.json();
      if (data.success) {
        setDevicesList(data.devices || []);
      }
    } catch (err) {
      console.error("Failed to fetch devices:", err);
    } finally {
      setDevicesLoading(false);
    }
  };

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceForm.deviceId || !newDeviceForm.deviceName || !newDeviceForm.gateId) {
      triggerStatus("Por favor, preencha todos os campos obrigatórios.", "error");
      return;
    }
    setRegisteringDevice(true);
    try {
      const res = await fetch('/api/tickets/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDeviceForm)
      });
      const data = await res.json();
      if (data.success) {
        setDevicesList(prev => [...prev, {
          ...data.device,
          deviceKeyMasked: `${data.device.deviceKey.substring(0, 10)}...${data.device.deviceKey.substring(data.device.deviceKey.length - 4)}`
        }]);
        setCredentialsModal({
          isOpen: true,
          deviceKey: data.device.deviceKey,
          deviceId: data.device.deviceId
        });
        setNewDeviceForm({
          deviceId: '',
          deviceName: '',
          gateId: '',
          eventId: 'ALL'
        });
        triggerStatus("Dispositivo registrado com sucesso!", "success");
      } else {
        triggerStatus(data.error || "Erro ao registrar dispositivo.", "error");
      }
    } catch (err) {
      console.error("Error registering device:", err);
      triggerStatus("Erro de rede ao registrar dispositivo.", "error");
    } finally {
      setRegisteringDevice(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!window.confirm("Deseja realmente excluir/revogar este dispositivo? Acesso de validação bloqueado imediatamente.")) {
      return;
    }
    try {
      const res = await fetch(`/api/tickets/devices/${deviceId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setDevicesList(prev => prev.filter(d => d.deviceId !== deviceId));
        triggerStatus("Dispositivo excluído e chave revogada.", "success");
      } else {
        triggerStatus(data.error || "Erro ao remover dispositivo.", "error");
      }
    } catch (err) {
      console.error("Error deleting device:", err);
      triggerStatus("Erro de rede ao remover dispositivo.", "error");
    }
  };

  // Authentication Context & Role Verification
  const currentUser = (() => {
    const saved = localStorage.getItem('voxa_current_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  })();
  const isAdmin = currentUser?.email === 'lockdownprodutora@gmail.com' || 
                  currentUser?.email === 'admin@lockdownprodutora.com.br' || 
                  currentUser?.email === 'admin@voxa.com.br' || 
                  currentUser?.role === 'admin' || 
                  (currentUser as any)?.isAdmin === true;

  // Selected show for dashboard management
  const [selectedShowForManagement, setSelectedShowForManagement] = useState<Show | null>(null);
  const [eventManagementTab, setEventManagementTab] = useState<'overview' | 'orders' | 'sectors' | 'finance' | 'settings'>('overview');
  const [issuedTickets, setIssuedTickets] = useState<any[]>([]);

  // Platform and Event orders states
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');

  // Platform finance state
  const [financePeriod, setFinancePeriod] = useState<'today' | '7days' | '30days' | 'month' | 'all'>('month');

  // Commission settings state (per event)
  const [lockdownFeeType, setLockdownFeeType] = useState<'percent' | 'fixed' | 'both'>('percent');
  const [lockdownFeePercent, setLockdownFeePercent] = useState<number>(5);
  const [lockdownFeeFixed, setLockdownFeeFixed] = useState<number>(0);
  const [lockdownFeeApplyOn, setLockdownFeeApplyOn] = useState<'gross' | 'net_after_payment_fee'>('net_after_payment_fee');
  const [paymentFeePercent, setPaymentFeePercent] = useState<number>(4);
  const [transferredAmount, setTransferredAmount] = useState<number>(0);

  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShow, setEditingShow] = useState<Show | null>(null);

  // Form core states
  const [city, setCity] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<string>('Disponível');

  // Google Maps state
  const [predictions, setPredictions] = useState<any[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [formattedAddress, setFormattedAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [placeId, setPlaceId] = useState('');

  // Sectors & Lots state
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);

  // Temporary sector form
  const [showAddSector, setShowAddSector] = useState(false);
  const [tempSectorName, setTempSectorName] = useState('');
  const [tempSectorCapacity, setTempSectorCapacity] = useState('');

  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  // Ticket Scanner / Validador states
  const [validationInput, setValidationInput] = useState('');
  const [scannerPortaria, setScannerPortaria] = useState('Portaria Principal');
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    message: string;
    ticket?: any;
  } | null>(null);
  const [checkInLogs, setCheckInLogs] = useState<any[]>([]);

  // Advanced Scanner settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [scannerGateId, setScannerGateId] = useState('PORTÃO A');
  const [selectedEventIdFilter, setSelectedEventIdFilter] = useState('ALL');
  const [autoResetSeconds, setAutoResetSeconds] = useState(3);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const html5QrcodeInstance = useRef<Html5Qrcode | null>(null);
  const validationInputRef = useRef<HTMLInputElement | null>(null);
  const autoResetTimeoutRef = useRef<any>(null);

  const playBeep = (type: 'valid' | 'invalid' | 'warning') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'valid') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'invalid') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'warning') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn('Web Audio Context blocked or unsupported:', e);
    }
  };

  // Toast / Status state
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const googleMapsKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '';

  const triggerStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const orders = await fetchStoreOrders();
      setAllOrders(orders || []);
    } catch (err) {
      console.error("Failed to load store orders in TicketModule:", err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadIssuedTickets = async (showId: string) => {
    try {
      const q = query(collection(db, 'tickets_issued'), where('eventId', '==', showId));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(doc => {
        list.push({ ...doc.data(), id: doc.id });
      });
      setIssuedTickets(list);
    } catch (err) {
      console.warn("Notice: Failed to load issued tickets from Firestore, keeping current list:", err);
    }
  };

  const loadRealShows = async () => {
    setLoading(true);
    try {
      const data = await fetchShows();
      setShows(data || []);
      await loadOrders();
    } catch (err) {
      console.error("Failed to load shows in TicketModule:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRealShows();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'devices') {
      fetchDevices();
    }
  }, [activeSubTab]);

  useEffect(() => {
    if (activeSubTab === 'scanner') {
      const timer = setTimeout(() => {
        if (validationInputRef.current) {
          validationInputRef.current.focus();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeSubTab]);

  const openAddModal = () => {
    setEditingShow(null);
    setCity('');
    setVenue('');
    setDate('');
    setImageUrl('');
    setDescription('');
    setStatus('Disponível');
    setFormattedAddress('');
    setLatitude(null);
    setLongitude(null);
    setPlaceId('');
    setSectors([]);
    setLots([]);
    setUploadProgress(0);
    setUploadStatus('');
    
    // Default custom commission settings
    setLockdownFeeType('percent');
    setLockdownFeePercent(5);
    setLockdownFeeFixed(0);
    setLockdownFeeApplyOn('net_after_payment_fee');
    setPaymentFeePercent(4);
    setTransferredAmount(0);

    setIsModalOpen(true);
  };

  const openEditModal = (show: Show) => {
    setEditingShow(show);
    setCity(show.city);
    setVenue(show.venue);
    setDate(show.date);
    setImageUrl(show.imageUrl || '');
    setDescription(show.description || '');
    setStatus(show.status);
    setFormattedAddress(show.formattedAddress || show.address || '');
    setLatitude(show.latitude || null);
    setLongitude(show.longitude || null);
    setPlaceId(show.placeId || '');
    setSectors(show.sectors || []);
    setLots(show.lots || []);
    setUploadProgress(0);
    setUploadStatus('');

    // Load custom commission settings
    setLockdownFeeType(show.lockdownFeeType || 'percent');
    setLockdownFeePercent(show.lockdownFeePercent ?? 5);
    setLockdownFeeFixed(show.lockdownFeeFixed ?? 0);
    setLockdownFeeApplyOn(show.lockdownFeeApplyOn || 'net_after_payment_fee');
    setPaymentFeePercent(show.paymentFeePercent ?? 4);
    setTransferredAmount(show.transferredAmount ?? 0);

    setIsModalOpen(true);
  };

  // Google Maps autocomplete handler
  const handleAddressSearch = async (val: string) => {
    setVenue(val);
    if (val.length < 3) {
      setPredictions([]);
      return;
    }
    setAddressLoading(true);
    try {
      const res = await fetch(`/api/maps/autocomplete?input=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (data.predictions) {
        setPredictions(data.predictions);
      } else {
        setPredictions([]);
      }
    } catch (err) {
      console.error("Failed to fetch autocomplete predictions:", err);
    } finally {
      setAddressLoading(false);
    }
  };

  const handleSelectPrediction = async (p: any) => {
    const fullAddress = p.description;
    setVenue(fullAddress);
    setPredictions([]);
    
    try {
      const res = await fetch(`/api/maps/geocode?address=${encodeURIComponent(fullAddress)}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const loc = data.results[0].geometry.location;
        const formatted = data.results[0].formatted_address;
        setLatitude(loc.lat);
        setLongitude(loc.lng);
        setPlaceId(data.results[0].place_id || p.place_id || '');
        setFormattedAddress(formatted);
        
        // Extract city/state
        const addressComponents = data.results[0].address_components;
        const cityComp = addressComponents.find((c: any) => c.types.includes('administrative_area_level_2'));
        const stateComp = addressComponents.find((c: any) => c.types.includes('administrative_area_level_1'));
        if (cityComp && stateComp) {
          setCity(`${cityComp.long_name} - ${stateComp.short_name}`);
        }
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Preparando upload...');

    try {
      const showId = editingShow ? editingShow.id : 'show-' + Date.now();
      const result = await uploadFile(file, 'cover', (progress) => {
        setUploadProgress(progress.percentage);
        setUploadStatus(`Enviando: ${progress.percentage}%`);
      }, {
        module: 'tickets',
        entityId: showId,
        entityName: city || 'Novo Show',
        subFolder: 'Capas'
      });

      if (!result.url) {
        throw new Error('Falha no upload do armazenamento real.');
      }

      setImageUrl(result.url);
      setUploadStatus('Upload concluído!');
      triggerStatus('Capa do evento carregada com sucesso!');
    } catch (err: any) {
      console.error("Failed to upload ticket cover:", err);
      triggerStatus(err.message || 'Erro ao subir imagem da capa.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Sectors & Lots Management
  const handleAddSector = () => {
    if (!tempSectorName.trim() || !tempSectorCapacity.trim()) {
      alert("Por favor, informe o nome e a capacidade total do setor.");
      return;
    }
    const sectorId = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const newSector: Sector = {
      sectorId,
      name: tempSectorName.trim(),
      description: '',
      capacity: parseInt(tempSectorCapacity) || 0,
      active: true
    };

    setSectors(prev => [...prev, newSector]);

    // Create a default first lot for this new sector automatically to make it easy
    const lotId = `lot_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const defaultLot: Lot = {
      lotId,
      sectorId,
      name: '1º Lote',
      price: 50,
      quantity: parseInt(tempSectorCapacity) || 100,
      soldQuantity: 0,
      salesStart: new Date().toISOString().split('T')[0],
      salesEnd: '',
      active: true,
      soldOut: false
    };
    setLots(prev => [...prev, defaultLot]);

    setTempSectorName('');
    setTempSectorCapacity('');
    setShowAddSector(false);
    triggerStatus("Setor adicionado com 1º Lote padrão criado!");
  };

  const handleRemoveSector = (secId: string) => {
    setSectors(prev => prev.filter(s => s.sectorId !== secId));
    setLots(prev => prev.filter(l => l.sectorId !== secId));
  };

  const handleAddLotToSector = (secId: string) => {
    const defaultPrice = 50;
    const defaultQty = 50;
    const lotId = `lot_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    
    // Auto-name lots based on current count
    const sectorLots = lots.filter(l => l.sectorId === secId);
    const lotNum = sectorLots.length + 1;
    const lotName = `${lotNum}º Lote`;

    const newLot: Lot = {
      lotId,
      sectorId: secId,
      name: lotName,
      price: defaultPrice,
      quantity: defaultQty,
      soldQuantity: 0,
      salesStart: new Date().toISOString().split('T')[0],
      salesEnd: '',
      active: true,
      soldOut: false
    };

    setLots(prev => [...prev, newLot]);
  };

  const handleUpdateLot = (lotId: string, fields: Partial<Lot>) => {
    setLots(prev => prev.map(l => l.lotId === lotId ? { ...l, ...fields } : l));
  };

  const handleRemoveLot = (lotId: string) => {
    setLots(prev => prev.filter(l => l.lotId !== lotId));
  };

  const handleSaveShow = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!city.trim() || !venue.trim() || !date.trim()) {
      triggerStatus('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    if (sectors.length === 0) {
      triggerStatus('Por favor, cadastre pelo menos um setor com lote de ingressos.', 'error');
      return;
    }

    // Determine lowest price of all lots
    let lowestPrice = 0;
    if (lots.length > 0) {
      lowestPrice = Math.min(...lots.map(l => Number(l.price) || 0));
    }

    const showId = editingShow ? editingShow.id : 'show-' + Date.now();
    const showPayload: Show = {
      id: showId,
      city: city.trim(),
      venue: venue.trim(),
      date: date.trim(),
      price: formatBRL(lowestPrice),
      status,
      imageUrl: imageUrl.trim() || undefined,
      description: description.trim(),
      address: formattedAddress,
      formattedAddress,
      latitude: latitude || undefined,
      longitude: longitude || undefined,
      placeId: placeId || undefined,
      sectors,
      lots,
      // Organizer context
      organizerId: editingShow ? (editingShow.organizerId || 'admin') : (currentUser?.email || 'admin'),
      organizerName: editingShow ? (editingShow.organizerName || 'Lockdown Oficial') : (currentUser?.name || 'Lockdown Oficial'),
      // Commission and Gateway settings
      lockdownFeeType,
      lockdownFeePercent,
      lockdownFeeFixed,
      lockdownFeeApplyOn,
      paymentFeePercent,
      transferredAmount: editingShow ? (editingShow.transferredAmount ?? transferredAmount) : transferredAmount
    };

    try {
      await saveShow(showPayload);
      triggerStatus(editingShow ? 'Show atualizado com sucesso!' : 'Show cadastrado com sucesso!');
      setIsModalOpen(false);
      loadRealShows();
    } catch (err) {
      console.error("Failed to save show:", err);
      triggerStatus('Falha ao salvar show no banco de dados.', 'error');
    }
  };

  const handleDeleteShow = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover este show permanentemente?')) return;

    try {
      await deleteShow(id);
      triggerStatus('Show excluído com sucesso!');
      loadRealShows();
    } catch (err) {
      console.error("Failed to delete show:", err);
      triggerStatus('Falha ao excluir show do banco.', 'error');
    }
  };

  // Perform ticket check-in / validation
  const handleValidateTicket = async (e?: React.FormEvent, customInput?: string) => {
    if (e) e.preventDefault();
    const inputVal = customInput !== undefined ? customInput : validationInput;
    if (!inputVal.trim()) return;

    setValidationLoading(true);
    setValidationResult(null);

    // Clear any existing kiosk auto-reset timer
    if (autoResetTimeoutRef.current) {
      clearTimeout(autoResetTimeoutRef.current);
    }

    try {
      const isToken = inputVal.startsWith('tkt_qr_');
      const bodyPayload = {
        token: isToken ? inputVal.trim() : undefined,
        code: !isToken ? inputVal.trim() : undefined,
        checkInBy: `${scannerPortaria} (${scannerGateId})`,
        eventId: selectedEventIdFilter !== 'ALL' ? selectedEventIdFilter : undefined,
        gateId: scannerGateId
      };

      const res = await fetch('/api/tickets/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const checkInObj = {
          success: true,
          message: data.message,
          ticket: data.ticket,
          time: new Date().toLocaleTimeString('pt-BR')
        };
        setValidationResult(checkInObj);
        setCheckInLogs(prev => [checkInObj, ...prev]);
        setValidationInput('');
        playBeep('valid');
        triggerStatus("Ingresso validado! Entrada liberada.");

        // Kiosk Mode Auto-Reset
        if (isKioskMode) {
          autoResetTimeoutRef.current = setTimeout(() => {
            setValidationResult(null);
          }, autoResetSeconds * 1000);
        }
      } else {
        const isAlreadyUsed = data.error && data.error.includes("já utilizado");
        const beepType = isAlreadyUsed ? 'warning' : 'invalid';
        
        const errorObj = {
          success: false,
          message: data.error || "Código inválido ou inexistente.",
          ticket: data.ticket || null,
          time: new Date().toLocaleTimeString('pt-BR')
        };
        setValidationResult(errorObj);
        setCheckInLogs(prev => [errorObj, ...prev]);
        playBeep(beepType);

        // Kiosk Mode Auto-Reset
        if (isKioskMode) {
          autoResetTimeoutRef.current = setTimeout(() => {
            setValidationResult(null);
          }, autoResetSeconds * 1000);
        }
      }
    } catch (err: any) {
      console.error("Check-in error:", err);
      const errorObj = {
        success: false,
        message: "Erro de comunicação com o servidor de check-in."
      };
      setValidationResult(errorObj);
      playBeep('invalid');
    } finally {
      setValidationLoading(false);
      // Auto-focus physical input after a tick
      setTimeout(() => {
        if (validationInputRef.current) {
          validationInputRef.current.focus();
        }
      }, 50);
    }
  };

  // Revert a ticket check-in
  const handleRevertCheckIn = async (ticketId: string) => {
    if (!window.confirm("Deseja realmente REVERTER o check-in deste ingresso?\n\nEsta ação liberará o ingresso para entrar novamente, e será registrada no histórico de auditoria.")) {
      return;
    }

    try {
      const res = await fetch('/api/tickets/revert-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          reason: "Reversão manual pela portaria / supervisor",
          operatorId: scannerPortaria
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        playBeep('warning');
        triggerStatus("Check-in revertido! Ingresso liberado para nova entrada.");
        
        // Remove or update the ticket in the session logs if any
        setCheckInLogs(prev => prev.map(log => {
          if (log.ticket && log.ticket.ticketId === ticketId) {
            return {
              ...log,
              success: false,
              message: "Check-in Revertido / Cancelado",
              ticket: { ...log.ticket, checkedIn: false, checkedInAt: null }
            };
          }
          return log;
        }));

        if (validationResult && validationResult.ticket && validationResult.ticket.ticketId === ticketId) {
          setValidationResult(null);
        }
      } else {
        triggerStatus(data.error || "Não foi possível reverter o check-in.", "error");
      }
    } catch (err: any) {
      console.error("Revert check-in error:", err);
      triggerStatus("Erro de comunicação ao reverter o check-in.", "error");
    }
  };

  const startCameraScanner = async () => {
    setCameraError(null);
    setCameraActive(true);
    
    // We must wait for the DOM container to be fully rendered before starting the library
    setTimeout(async () => {
      try {
        const scannerElement = document.getElementById('qr-scanner-preview');
        if (!scannerElement) {
          throw new Error("Elemento de prévia da câmera não foi encontrado.");
        }

        // Instantiate Html5Qrcode if it doesn't exist
        const html5QrCode = new Html5Qrcode("qr-scanner-preview");
        html5QrcodeInstance.current = html5QrCode;

        let lastScannedCode = '';
        let scanThrottleTimeout: any = null;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (width, height) => {
              const minDim = Math.min(width, height);
              const size = Math.floor(minDim * 0.7);
              return { width: size, height: size };
            }
          },
          async (decodedText) => {
            // Debounce/Throttle to avoid double scanner triggers
            if (decodedText === lastScannedCode) {
              return; // Already scanned this code in this burst
            }
            lastScannedCode = decodedText;
            
            // Clear last scanned code after 3 seconds of cooldown
            if (scanThrottleTimeout) clearTimeout(scanThrottleTimeout);
            scanThrottleTimeout = setTimeout(() => {
              lastScannedCode = '';
            }, 3000);

            // Trigger check-in validation
            await handleValidateTicket(undefined, decodedText);
          },
          (errorMessage) => {
            // Silence console during scanning
          }
        );
      } catch (err: any) {
        console.error("Erro ao iniciar a câmera:", err);
        setCameraError(err.message || "Não foi possível acessar a câmera do dispositivo.");
        setCameraActive(false);
      }
    }, 300);
  };

  const stopCameraScanner = async () => {
    if (html5QrcodeInstance.current) {
      try {
        if (html5QrcodeInstance.current.isScanning) {
          await html5QrcodeInstance.current.stop();
        }
      } catch (err) {
        console.error("Erro ao parar câmera:", err);
      } finally {
        html5QrcodeInstance.current = null;
      }
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (html5QrcodeInstance.current) {
        html5QrcodeInstance.current.stop().catch(console.error);
      }
      if (autoResetTimeoutRef.current) {
        clearTimeout(autoResetTimeoutRef.current);
      }
    };
  }, []);

  const getShowStats = (show: Show, orders: any[]) => {
    // Capacity
    const totalAvailable = show.sectors?.reduce((acc, s) => acc + (s.capacity || 0), 0) || 0;
    
    // Orders by status
    const paid = orders.filter(o => o.status === 'Pago' || o.status === 'Aprovado');
    const pending = orders.filter(o => o.status === 'Pendente');
    const cancelled = orders.filter(o => o.status === 'Cancelado');
    const refunded = orders.filter(o => o.status === 'Reembolsado');
    
    // Ticket quantity counters
    const totalSold = paid.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0);
    const totalPending = pending.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0);
    const totalCancelled = cancelled.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0);
    const totalRefunded = refunded.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0);
    
    const remaining = Math.max(0, totalAvailable - totalSold);
    const percentSold = totalAvailable > 0 ? parseFloat(((totalSold / totalAvailable) * 100).toFixed(1)) : 0;
    const percentRemaining = parseFloat((100 - percentSold).toFixed(1));
    
    // Financial breakdowns
    const grossRevenue = paid.reduce((acc, o) => acc + (Number(o.grossValue || o.amount?.replace("R$", "").trim().replace(/\./g, "").replace(",", ".")) || 0), 0);
    
    const totalPaymentFees = paid.reduce((acc, o) => {
      const payFeePct = show.paymentFeePercent ?? 4;
      const orderFee = o.paymentFee !== undefined ? Number(o.paymentFee) : parseFloat(((o.grossValue || 0) * (payFeePct / 100)).toFixed(2));
      return acc + orderFee;
    }, 0);
    
    const isLockdownOwned = show.organizerId === 'admin' || !show.organizerId || show.organizerId === 'lockdown';
    
    const totalLockdownFees = paid.reduce((acc, o) => {
      if (isLockdownOwned) return acc;
      
      const qty = Number(o.quantity) || 1;
      const gross = Number(o.grossValue) || 0;
      const payFeePct = show.paymentFeePercent ?? 4;
      const payFee = o.paymentFee !== undefined ? Number(o.paymentFee) : parseFloat((gross * (payFeePct / 100)).toFixed(2));
      
      const feeType = show.lockdownFeeType || 'percent';
      const feePct = show.lockdownFeePercent ?? 5;
      const feeFixed = show.lockdownFeeFixed ?? 0;
      const applyOn = show.lockdownFeeApplyOn || 'net_after_payment_fee';
      
      let baseForPct = gross;
      if (applyOn === 'net_after_payment_fee') {
        baseForPct = Math.max(0, gross - payFee);
      }
      
      let orderLdFee = 0;
      if (feeType === 'percent') {
        orderLdFee = parseFloat((baseForPct * (feePct / 100)).toFixed(2));
      } else if (feeType === 'fixed') {
        orderLdFee = parseFloat((qty * feeFixed).toFixed(2));
      } else if (feeType === 'both') {
        orderLdFee = parseFloat(((baseForPct * (feePct / 100)) + (qty * feeFixed)).toFixed(2));
      }
      
      return acc + orderLdFee;
    }, 0);
    
    const organizerNetRevenue = isLockdownOwned 
      ? parseFloat((grossRevenue - totalPaymentFees).toFixed(2))
      : parseFloat((grossRevenue - totalPaymentFees - totalLockdownFees).toFixed(2));
      
    // Check-ins
    const checkInsDone = issuedTickets.filter(t => t.checkedIn === true).length;
    const checkInsPending = Math.max(0, totalSold - checkInsDone);
    
    const uniqueBuyers = new Set(orders.map(o => o.userId || o.buyerId || o.buyerEmail)).size;
    
    return {
      totalAvailable,
      totalSold,
      remaining,
      percentSold,
      percentRemaining,
      grossRevenue,
      totalPaymentFees,
      totalLockdownFees,
      organizerNetRevenue,
      orderCount: orders.length,
      uniqueBuyers,
      totalPending,
      totalCancelled,
      totalRefunded,
      checkInsDone,
      checkInsPending
    };
  };

  const handleSaveCommissionConfig = async () => {
    if (!selectedShowForManagement) return;
    
    const updatedShow = {
      ...selectedShowForManagement,
      lockdownFeeType,
      lockdownFeePercent,
      lockdownFeeFixed,
      lockdownFeeApplyOn,
      paymentFeePercent,
      transferredAmount
    };
    
    try {
      await saveShow(updatedShow);
      setSelectedShowForManagement(updatedShow);
      triggerStatus("Configurações de comissão atualizadas com sucesso!");
      loadRealShows();
    } catch (err) {
      console.error("Failed to update commission config:", err);
      triggerStatus("Erro ao salvar configurações de comissão.", "error");
    }
  };

  const totalShowsCount = shows.length;
  const availableShowsCount = shows.filter(s => s.status !== 'Esgotado').length;

  return (
    <div className="h-full flex flex-col justify-between p-4 md:p-8 max-w-7xl mx-auto w-full text-white">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-white/10 gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToMenu}
            className="flex items-center space-x-2 bg-[#161616] hover:bg-[#222] border border-white/10 px-4 py-2 rounded-xl text-xs font-orbitron text-gray-300 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>MENU</span>
          </button>

          <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF0033] animate-pulse"></span>
            <span className="font-orbitron font-bold text-xs tracking-wider">BILHETERIA REAL</span>
          </div>
        </div>

        {/* Subtabs Toggle */}
        <div className="bg-black/40 p-1 rounded-xl border border-white/10 flex flex-wrap gap-1">
          <button
            onClick={() => setActiveSubTab('events')}
            className={`px-4 py-2 rounded-lg text-xs font-orbitron font-bold transition-all cursor-pointer flex items-center space-x-2 ${
              activeSubTab === 'events' ? 'bg-[#FF0033] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>GESTÃO DE EVENTOS</span>
          </button>
          <button
            onClick={() => setActiveSubTab('scanner')}
            className={`px-4 py-2 rounded-lg text-xs font-orbitron font-bold transition-all cursor-pointer flex items-center space-x-2 ${
              activeSubTab === 'scanner' ? 'bg-[#FF0033] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>PORTARIA DIGITAL (SCANNER)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('devices')}
            className={`px-4 py-2 rounded-lg text-xs font-orbitron font-bold transition-all cursor-pointer flex items-center space-x-2 ${
              activeSubTab === 'devices' ? 'bg-[#FF0033] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>PORTÕES / DISPOSITIVOS</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`mt-4 p-4 rounded-xl font-orbitron text-xs border flex items-center justify-between transition-all ${
          statusMessage.type === 'error' 
            ? 'bg-red-950/80 border-red-500/50 text-red-200' 
            : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
        }`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeSubTab === 'events' ? (
        selectedShowForManagement ? (
          // ==========================================
          // INDIVIDUAL EVENT MANAGEMENT DASHBOARD VIEW
          // ==========================================
          (() => {
            const showOrders = allOrders.filter(o => o.showId === selectedShowForManagement.id || o.productId === `ticket-${selectedShowForManagement.id}`);
            const stats = getShowStats(selectedShowForManagement, showOrders);
            const isLockdownOwned = selectedShowForManagement.organizerId === 'admin' || 
                                    !selectedShowForManagement.organizerId || 
                                    selectedShowForManagement.organizerId === 'lockdown';
            
            // Filter orders for search query
            const filteredOrders = showOrders.filter(o => {
              if (!orderSearch.trim()) return true;
              const term = orderSearch.toLowerCase();
              return (
                (o.buyerName || '').toLowerCase().includes(term) ||
                (o.buyerEmail || '').toLowerCase().includes(term) ||
                (o.id || '').toLowerCase().includes(term)
              );
            });

            return (
              <div className="py-6 space-y-6 flex-1 w-full animate-fade-in">
                {/* Event Management Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#141414] p-6 rounded-2xl border border-white/5 shadow-2xl">
                  <div>
                    <button
                      onClick={() => setSelectedShowForManagement(null)}
                      className="text-xs font-orbitron text-gray-400 hover:text-white flex items-center space-x-2 mb-2 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>VOLTAR PARA LISTA DE EVENTOS</span>
                    </button>
                    <div className="flex items-center space-x-3">
                      <h2 className="font-orbitron font-black text-2xl text-white uppercase tracking-tight">
                        {selectedShowForManagement.city}
                      </h2>
                      <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-md text-[10px] font-orbitron font-bold uppercase text-[#FF0033]">
                        {isLockdownOwned ? "LOCKDOWN PROD." : "ORGANIZADOR EXTERNO"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-sans mt-1">
                      {selectedShowForManagement.venue} • {selectedShowForManagement.date}
                    </p>
                  </div>

                  {/* Dashboard inner navigation */}
                  <div className="flex flex-wrap gap-1 bg-black/60 p-1 rounded-xl border border-white/5">
                    <button
                      onClick={() => setEventManagementTab('overview')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-orbitron font-bold transition-all ${
                        eventManagementTab === 'overview' ? 'bg-[#FF0033] text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      PANEL GERAL
                    </button>
                    <button
                      onClick={() => setEventManagementTab('orders')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-orbitron font-bold transition-all ${
                        eventManagementTab === 'orders' ? 'bg-[#FF0033] text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      PARTICIPANTES ({showOrders.length})
                    </button>
                    <button
                      onClick={() => setEventManagementTab('finance')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-orbitron font-bold transition-all ${
                        eventManagementTab === 'finance' ? 'bg-[#FF0033] text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      FINANCEIRO DO EVENTO
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setEventManagementTab('settings');
                          // Load current settings into form variables
                          setLockdownFeeType(selectedShowForManagement.lockdownFeeType || 'percent');
                          setLockdownFeePercent(selectedShowForManagement.lockdownFeePercent ?? 5);
                          setLockdownFeeFixed(selectedShowForManagement.lockdownFeeFixed ?? 0);
                          setLockdownFeeApplyOn(selectedShowForManagement.lockdownFeeApplyOn || 'net_after_payment_fee');
                          setPaymentFeePercent(selectedShowForManagement.paymentFeePercent ?? 4);
                          setTransferredAmount(selectedShowForManagement.transferredAmount ?? 0);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-orbitron font-bold transition-all ${
                          eventManagementTab === 'settings' ? 'bg-[#FF0033] text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        COMISSÃO & CONFIG
                      </button>
                    )}
                  </div>
                </div>

                {/* Tab content rendering */}
                {eventManagementTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Key Metrics grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Available vs Sold */}
                      <div className="bg-[#111] p-5 rounded-2xl border border-white/5 space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] text-gray-400 font-orbitron uppercase font-bold">INGRESSOS DISPONÍVEIS</span>
                          <Ticket className="w-4 h-4 text-[#FF0033]" />
                        </div>
                        <div>
                          <p className="text-2xl font-orbitron font-black">{stats.totalAvailable}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-[10px] text-emerald-400 font-bold">{stats.totalSold} vendidos ({stats.percentSold}%)</span>
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-white/5 rounded-full h-1.5 mt-2">
                          <div 
                            className="bg-[#FF0033] h-1.5 rounded-full" 
                            style={{ width: `${Math.min(100, stats.percentSold)}%` }}
                          />
                        </div>
                      </div>

                      {/* Remaining / unsold */}
                      <div className="bg-[#111] p-5 rounded-2xl border border-white/5 space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] text-gray-400 font-orbitron uppercase font-bold">INGRESSOS RESTANTES</span>
                          <Users className="w-4 h-4 text-[#FF0033]" />
                        </div>
                        <div>
                          <p className="text-2xl font-orbitron font-black">{stats.remaining}</p>
                          <span className="text-[10px] text-gray-500 font-bold">{stats.percentRemaining}% restantes</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1.5 mt-2">
                          <div 
                            className="bg-gray-500 h-1.5 rounded-full" 
                            style={{ width: `${Math.min(100, stats.percentRemaining)}%` }}
                          />
                        </div>
                      </div>

                      {/* Financial values */}
                      <div className="bg-[#111] p-5 rounded-2xl border border-white/5 space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] text-gray-400 font-orbitron uppercase font-bold">VALOR BRUTO VENDIDO</span>
                          <DollarSign className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-orbitron font-black text-emerald-400">{formatBRL(stats.grossRevenue)}</p>
                          <span className="text-[10px] text-gray-400 font-sans block mt-1">
                            Líquido Org: <strong className="text-white">{formatBRL(stats.organizerNetRevenue)}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Check-ins done */}
                      <div className="bg-[#111] p-5 rounded-2xl border border-white/5 space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] text-gray-400 font-orbitron uppercase font-bold">CHECK-INS REALIZADOS</span>
                          <QrCode className="w-4 h-4 text-sky-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-orbitron font-black text-sky-400">{stats.checkInsDone}</p>
                          <span className="text-[10px] text-gray-400 font-sans block mt-1">
                            Aguardando: <strong className="text-white">{stats.checkInsPending} pessoas</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Secondary detailed metrics and status */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Ticket orders states */}
                      <div className="bg-[#111] p-6 rounded-2xl border border-white/5 space-y-4">
                        <h4 className="font-orbitron font-bold text-xs text-white border-b border-white/5 pb-2">STATUS DE INGRESSOS</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between text-xs font-sans">
                            <span className="text-gray-400 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Ingressos pagos:
                            </span>
                            <span className="font-bold text-white font-orbitron">{stats.totalSold}</span>
                          </div>
                          <div className="flex justify-between text-xs font-sans">
                            <span className="text-gray-400 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Ingressos pendentes:
                            </span>
                            <span className="font-bold text-white font-orbitron">{stats.totalPending}</span>
                          </div>
                          <div className="flex justify-between text-xs font-sans">
                            <span className="text-gray-400 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-gray-500"></span> Ingressos cancelados:
                            </span>
                            <span className="font-bold text-white font-orbitron">{stats.totalCancelled}</span>
                          </div>
                          <div className="flex justify-between text-xs font-sans">
                            <span className="text-gray-400 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-red-500"></span> Ingressos reembolsados:
                            </span>
                            <span className="font-bold text-white font-orbitron">{stats.totalRefunded}</span>
                          </div>
                          <div className="flex justify-between text-xs font-sans pt-3 border-t border-white/5">
                            <span className="text-gray-400">Total de pedidos:</span>
                            <span className="font-bold text-white font-orbitron">{stats.orderCount}</span>
                          </div>
                          <div className="flex justify-between text-xs font-sans">
                            <span className="text-gray-400">Compradores únicos:</span>
                            <span className="font-bold text-white font-orbitron">{stats.uniqueBuyers}</span>
                          </div>
                        </div>
                      </div>

                      {/* Check-ins by Gate card */}
                      {(() => {
                        const gatesCount: Record<string, number> = {};
                        issuedTickets.forEach(t => {
                          if (t.checkedIn) {
                            const gateName = t.gateId || "Portaria Principal / Web";
                            gatesCount[gateName] = (gatesCount[gateName] || 0) + 1;
                          }
                        });
                        const gatesList = Object.entries(gatesCount).sort((a, b) => b[1] - a[1]);

                        return (
                          <div className="bg-[#111] p-6 rounded-2xl border border-white/5 space-y-4">
                            <h4 className="font-orbitron font-bold text-xs text-white border-b border-white/5 pb-2 uppercase">Check-ins por Portão</h4>
                            {gatesList.length === 0 ? (
                              <div className="py-12 text-center text-xs text-gray-500 font-sans">
                                Nenhum check-in realizado neste evento ainda.
                              </div>
                            ) : (
                              <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                                {gatesList.map(([gate, count]) => {
                                  const totalCheckedIn = stats.checkInsDone || 1;
                                  const pct = Math.round((count / totalCheckedIn) * 100);
                                  return (
                                    <div key={gate} className="space-y-1">
                                      <div className="flex justify-between text-xs font-sans">
                                        <span className="text-gray-300 font-medium truncate max-w-[150px]">{gate}</span>
                                        <span className="font-bold text-white font-orbitron">{count} <span className="text-[10px] text-gray-500 font-normal">({pct}%)</span></span>
                                      </div>
                                      <div className="w-full bg-white/5 rounded-full h-1">
                                        <div 
                                          className="bg-sky-400 h-1 rounded-full" 
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Breakdown by sectors and lots */}
                      <div className="lg:col-span-3 bg-[#111] p-6 rounded-2xl border border-white/5 space-y-4">
                        <h4 className="font-orbitron font-bold text-xs text-white border-b border-white/5 pb-2">SEPARAÇÃO POR SETOR E LOTE</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="text-gray-500 font-orbitron uppercase text-[9px] border-b border-white/5">
                                <th className="pb-2">Setor</th>
                                <th className="pb-2">Lote</th>
                                <th className="pb-2">Preço</th>
                                <th className="pb-2 text-center">Capacidade/Qtd</th>
                                <th className="pb-2 text-center">Vendidos</th>
                                <th className="pb-2 text-center">Restantes</th>
                                <th className="pb-2 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedShowForManagement.sectors?.flatMap(sec => {
                                const sectorLots = selectedShowForManagement.lots?.filter(l => l.sectorId === sec.sectorId) || [];
                                return sectorLots.map((lot, idx) => {
                                  const lotSold = lot.soldQuantity || 0;
                                  const lotCap = lot.quantity || 0;
                                  const lotRem = Math.max(0, lotCap - lotSold);
                                  const isLotSoldOut = lotRem === 0 || lot.soldOut;

                                  return (
                                    <tr key={lot.lotId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                      <td className="py-2.5 font-bold font-orbitron text-[11px] text-white">
                                        {idx === 0 ? sec.name : ''}
                                      </td>
                                      <td className="py-2.5 text-gray-400">{lot.name}</td>
                                      <td className="py-2.5 text-emerald-400 font-bold font-orbitron">R$ {lot.price}</td>
                                      <td className="py-2.5 text-center font-orbitron">{lotCap}</td>
                                      <td className="py-2.5 text-center font-orbitron text-gray-300">{lotSold}</td>
                                      <td className="py-2.5 text-center font-orbitron text-gray-300">{lotRem}</td>
                                      <td className="py-2.5 text-right">
                                        {isLotSoldOut ? (
                                          <span className="text-[9px] font-orbitron font-bold bg-red-950/40 border border-red-500/30 text-red-500 px-2 py-0.5 rounded uppercase">ESGOTADO</span>
                                        ) : (
                                          <span className="text-[9px] font-orbitron font-bold bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded uppercase">ATIVO</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                });
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {eventManagementTab === 'orders' && (
                  <div className="bg-[#111] p-6 rounded-2xl border border-white/5 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4">
                      <div>
                        <h4 className="font-orbitron font-bold text-xs text-white">RELAÇÃO DE PARTICIPANTES</h4>
                        <p className="text-[10px] text-gray-400 font-sans mt-0.5">Filtre ou busque compradores de ingressos</p>
                      </div>

                      {/* Search bar */}
                      <div className="relative max-w-sm w-full">
                        <input
                          type="text"
                          placeholder="Buscar nome, email ou ID do pedido..."
                          value={orderSearch}
                          onChange={(e) => setOrderSearch(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-[#FF0033]"
                        />
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                        {orderSearch && (
                          <button onClick={() => setOrderSearch('')} className="absolute right-3 top-2.5 text-gray-500 hover:text-white">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {filteredOrders.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <p className="font-orbitron text-xs">NENHUM PEDIDO LOCALIZADO COM ESSA BUSCA</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-gray-500 font-orbitron uppercase text-[9px] border-b border-white/5 pb-2">
                              <th className="pb-2">Comprador</th>
                              <th className="pb-2">E-mail</th>
                              <th className="pb-2">Setor/Lote</th>
                              <th className="pb-2 text-center">Ingressos</th>
                              <th className="pb-2 text-right">Valor Pago</th>
                              <th className="pb-2 text-center">Status</th>
                              <th className="pb-2 text-right">Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredOrders.map(o => (
                              <tr key={o.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="py-3 font-bold text-white font-sans">{o.buyerName || 'Participante'}</td>
                                <td className="py-3 text-gray-400 font-sans">{o.buyerEmail || 'N/A'}</td>
                                <td className="py-3 text-gray-400 font-orbitron text-[10px]">{o.sectorName || 'N/A'} • {o.lotName || 'N/A'}</td>
                                <td className="py-3 text-center font-bold font-orbitron">{o.quantity || 1}</td>
                                <td className="py-3 text-right text-emerald-400 font-bold font-orbitron">
                                  {formatBRL(o.grossValue || o.ticketSubtotal || 0)}
                                </td>
                                <td className="py-3 text-center">
                                  <span className={`text-[9px] font-orbitron font-bold px-2 py-0.5 rounded border ${
                                    o.status === 'Pago' || o.status === 'Aprovado'
                                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                                      : o.status === 'Pendente'
                                        ? 'bg-amber-950/40 border-amber-500/30 text-amber-400'
                                        : 'bg-red-950/40 border-red-500/30 text-red-400'
                                  }`}>
                                    {o.status}
                                  </span>
                                </td>
                                <td className="py-3 text-right text-gray-500 font-sans">
                                  {o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {eventManagementTab === 'finance' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Financial Detailed Breakdown */}
                    <div className="lg:col-span-2 bg-[#111] p-6 rounded-2xl border border-white/5 space-y-6">
                      <h4 className="font-orbitron font-bold text-xs text-white border-b border-white/5 pb-2 uppercase tracking-wide">
                        TRANSPARÊNCIA E DEMONSTRATIVO FINANCEIRO
                      </h4>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-400">Faturamento Bruto (Ingressos Pagos):</span>
                          <span className="font-orbitron font-black text-white">{formatBRL(stats.grossRevenue)}</span>
                        </div>

                        <div className="flex justify-between items-center text-sm text-red-400">
                          <span className="flex items-center gap-1">
                            Taxas Estimadas de Meio de Pagamento ({selectedShowForManagement.paymentFeePercent || 4}%):
                          </span>
                          <span className="font-orbitron font-bold">-{formatBRL(stats.totalPaymentFees)}</span>
                        </div>

                        <div className="flex justify-between items-center text-sm font-semibold border-t border-white/5 pt-3">
                          <span className="text-gray-200">Receita Líquida após Gateway:</span>
                          <span className="font-orbitron font-black text-white">{formatBRL(stats.grossRevenue - stats.totalPaymentFees)}</span>
                        </div>

                        <div className="flex justify-between items-center text-sm text-red-500">
                          <span>Comissão / Taxa de Serviço da Lockdown:</span>
                          <span className="font-orbitron font-bold">
                            {isLockdownOwned ? "R$ 0,00 (Evento Oficial)" : `-${formatBRL(stats.totalLockdownFees)}`}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-base border-t border-white/10 pt-4 font-black">
                          <span className="text-white uppercase font-orbitron">SALDO LÍQUIDO DO ORGANIZADOR:</span>
                          <span className="font-orbitron text-emerald-400">{formatBRL(stats.organizerNetRevenue)}</span>
                        </div>
                      </div>

                      {/* Carbon Invoice graphic design */}
                      <div className="bg-black/60 p-5 rounded-xl border border-white/5 relative overflow-hidden font-mono text-[11px] text-gray-400 space-y-2">
                        <div className="absolute right-4 top-4 font-orbitron font-black text-white/5 text-4xl">LOCKDOWN</div>
                        <p className="font-bold text-white uppercase font-orbitron tracking-widest text-xs mb-3 text-[#FF0033]">### COMPROVANTE CONTÁBIL DE VENDAS ###</p>
                        <p>ID DO EVENTO: {selectedShowForManagement.id}</p>
                        <p>DATA DE FECHAMENTO: {new Date().toLocaleDateString('pt-BR')} • {new Date().toLocaleTimeString('pt-BR')}</p>
                        <p>TAXA BASE GATEWAY: {selectedShowForManagement.paymentFeePercent || 4}%</p>
                        <p>MODELO COMISSÃO LOCKDOWN: {isLockdownOwned ? 'N/A' : (selectedShowForManagement.lockdownFeeType || 'percent').toUpperCase()}</p>
                        {!isLockdownOwned && (
                          <>
                            <p>TAXA BASE LOCKDOWN: {selectedShowForManagement.lockdownFeeType === 'percent' ? `${selectedShowForManagement.lockdownFeePercent}%` : selectedShowForManagement.lockdownFeeType === 'fixed' ? `R$ ${selectedShowForManagement.lockdownFeeFixed} por tkt` : `${selectedShowForManagement.lockdownFeePercent}% + R$ ${selectedShowForManagement.lockdownFeeFixed}`}</p>
                            <p>BASE DE CÁLCULO: {selectedShowForManagement.lockdownFeeApplyOn === 'gross' ? 'Faturamento Bruto' : 'Faturamento Líquido pós Gateway'}</p>
                          </>
                        )}
                        <div className="border-t border-dashed border-white/10 my-3"></div>
                        <p className="flex justify-between font-bold text-white"><span>TOTAL LÍQUIDO A REPASSAR:</span> <span>{formatBRL(stats.organizerNetRevenue)}</span></p>
                      </div>
                    </div>

                    {/* Organizer Payout Status Card */}
                    <div className="bg-[#111] p-6 rounded-2xl border border-white/5 space-y-6 flex flex-col justify-between">
                      <div className="space-y-4">
                        <h4 className="font-orbitron font-bold text-xs text-white border-b border-white/5 pb-2 uppercase tracking-wide">
                          REPASSES FINANCEIROS
                        </h4>

                        <div className="space-y-3">
                          <div>
                            <span className="text-[10px] text-gray-400 font-sans block uppercase">Valor Total do Organizador</span>
                            <span className="font-orbitron font-bold text-lg text-white">{formatBRL(stats.organizerNetRevenue)}</span>
                          </div>

                          <div>
                            <span className="text-[10px] text-gray-400 font-sans block uppercase">Valor Já Repassado</span>
                            <span className="font-orbitron font-bold text-lg text-emerald-400">{formatBRL(selectedShowForManagement.transferredAmount || 0)}</span>
                          </div>

                          <div className="pt-2 border-t border-white/5">
                            <span className="text-[10px] text-gray-400 font-sans block uppercase">Valor Restante a Transferir</span>
                            <span className="font-orbitron font-black text-xl text-amber-500">
                              {formatBRL(Math.max(0, stats.organizerNetRevenue - (selectedShowForManagement.transferredAmount || 0)))}
                            </span>
                          </div>
                        </div>

                        {/* Transfer completion ratio */}
                        <div className="space-y-1 pt-2">
                          <div className="flex justify-between text-[10px] font-orbitron font-bold">
                            <span className="text-gray-400">Progresso do repasse:</span>
                            <span className="text-[#FF0033]">
                              {stats.organizerNetRevenue > 0 
                                ? Math.min(100, Math.round(((selectedShowForManagement.transferredAmount || 0) / stats.organizerNetRevenue) * 100))
                                : 0}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#FF0033]"
                              style={{ 
                                width: `${stats.organizerNetRevenue > 0 
                                  ? Math.min(100, Math.round(((selectedShowForManagement.transferredAmount || 0) / stats.organizerNetRevenue) * 100))
                                  : 0}%` 
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {isAdmin && !isLockdownOwned && (
                        <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-3 mt-4">
                          <label className="text-[9px] font-orbitron font-bold text-gray-300 block uppercase">REGISTRAR NOVO REPASSE PARCIAL / TOTAL</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="R$ 1.000,00"
                              value={transferredAmount || ''}
                              onChange={(e) => setTransferredAmount(parseFloat(e.target.value) || 0)}
                              className="bg-black border border-white/10 rounded-lg px-3 py-2 text-xs w-full focus:outline-none focus:border-[#FF0033]"
                            />
                            <button
                              onClick={handleSaveCommissionConfig}
                              className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold text-[10px] px-3 rounded-lg transition-colors cursor-pointer shrink-0"
                            >
                              SALVAR
                            </button>
                          </div>
                          <p className="text-[8px] text-gray-500">Isso salva o histórico de valores de repasse registrados para este parceiro.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {eventManagementTab === 'settings' && isAdmin && (
                  <div className="bg-[#111] p-6 rounded-2xl border border-white/5 space-y-6 max-w-2xl">
                    <div>
                      <h4 className="font-orbitron font-bold text-xs text-white uppercase tracking-wide">CONFIGURAÇÕES DE COMISSÃO DO EVENTO</h4>
                      <p className="text-[10px] text-gray-400 font-sans mt-1">Configure as taxas cobradas e gateway para este evento específico.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-orbitron font-bold text-gray-300 uppercase">MODELO DE COBRANÇA LOCKDOWN</label>
                          <select
                            value={lockdownFeeType}
                            onChange={(e: any) => setLockdownFeeType(e.target.value)}
                            className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-3 text-xs font-orbitron focus:outline-none focus:border-[#FF0033]"
                          >
                            <option value="percent">Percentual (%)</option>
                            <option value="fixed">Taxa Fixa por Ingresso (R$)</option>
                            <option value="both">Ambos (Percentual + Fixo)</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-orbitron font-bold text-gray-300 uppercase">CÁLCULO APLICADO SOBRE</label>
                          <select
                            value={lockdownFeeApplyOn}
                            onChange={(e: any) => setLockdownFeeApplyOn(e.target.value)}
                            className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-3 text-xs font-orbitron focus:outline-none focus:border-[#FF0033]"
                          >
                            <option value="net_after_payment_fee">Valor Líquido pós taxas gateway</option>
                            <option value="gross">Faturamento Bruto</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {(lockdownFeeType === 'percent' || lockdownFeeType === 'both') && (
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-orbitron font-bold text-gray-300 uppercase">PERCENTUAL (%)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={lockdownFeePercent}
                              onChange={(e) => setLockdownFeePercent(parseFloat(e.target.value) || 0)}
                              className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-[#FF0033]"
                            />
                          </div>
                        )}

                        {(lockdownFeeType === 'fixed' || lockdownFeeType === 'both') && (
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-orbitron font-bold text-gray-300 uppercase">TAXA FIXA (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={lockdownFeeFixed}
                              onChange={(e) => setLockdownFeeFixed(parseFloat(e.target.value) || 0)}
                              className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-[#FF0033]"
                            />
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-orbitron font-bold text-gray-300 uppercase">TAXA GATEWAY (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={paymentFeePercent}
                            onChange={(e) => setPaymentFeePercent(parseFloat(e.target.value) || 0)}
                            className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-[#FF0033]"
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5 flex justify-end">
                        <button
                          onClick={handleSaveCommissionConfig}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-orbitron font-bold py-3 px-6 rounded-xl text-[10px] transition-colors cursor-pointer"
                        >
                          SALVAR CONFIGURAÇÕES DE COMISSÃO
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          // ==========================================
          // EVENT LISTING VIEW WITH ACCESS CONTROL
          // ==========================================
          <div className="py-8 space-y-8 flex-1 w-full">
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-6 rounded-2xl border border-white/10">
                <span className="text-xs text-gray-400 font-orbitron uppercase">EVENTOS DE TOUR</span>
                <h3 className="font-orbitron font-black text-3xl mt-1">
                  {isAdmin ? shows.length : shows.filter(s => s.organizerId === currentUser?.email || (s as any).ownerId === currentUser?.email).length}
                </h3>
                <span className="text-xs text-gray-500 mt-2 block">Cadastrados no ecossistema</span>
              </div>
              <div className="glass-card p-6 rounded-2xl border border-white/10">
                <span className="text-xs text-gray-400 font-orbitron uppercase">SHOWS ATIVOS</span>
                <h3 className="font-orbitron font-black text-3xl text-[#FF0033] mt-1">
                  {shows.filter(s => s.status !== 'Esgotado' && (isAdmin || s.organizerId === currentUser?.email || (s as any).ownerId === currentUser?.email)).length}
                </h3>
                <span className="text-xs text-gray-500 mt-2 block">Com ingressos à venda</span>
              </div>
              <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col justify-between">
                <div>
                  <span className="text-xs text-gray-400 font-orbitron uppercase">MÉTODO ÚNICO</span>
                  <h3 className="font-orbitron font-black text-xl text-emerald-400 mt-1">PIX TRANSPARENTE</h3>
                </div>
                <span className="text-[10px] text-gray-400 font-sans block mt-2">Validação automática por webhook MP</span>
              </div>
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-orbitron font-bold text-xl uppercase tracking-tight">LISTA DE EVENTOS E SHOWS</h3>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {isAdmin ? "Visão Geral Administrativa (Acesso Total)" : `Painel do Organizador: ${currentUser?.name || 'Parceiro'}`}
                  </p>
                </div>
                <button
                  onClick={openAddModal}
                  className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>CRIAR NOVO EVENTO</span>
                </button>
              </div>

              {loading ? (
                <p className="text-xs font-orbitron text-gray-400">Carregando shows do banco de dados...</p>
              ) : shows.filter(s => {
                if (isAdmin) return true;
                return s.organizerId === currentUser?.email || (s as any).ownerId === currentUser?.email || (s as any).createdBy === currentUser?.email;
              }).length === 0 ? (
                <div className="py-12 text-center glass-card border border-white/10 rounded-2xl">
                  <p className="font-orbitron font-bold text-sm text-gray-500">NENHUM SHOW CADASTRADO NO SEU ACESSO</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {shows.filter(s => {
                    if (isAdmin) return true;
                    return s.organizerId === currentUser?.email || (s as any).ownerId === currentUser?.email || (s as any).createdBy === currentUser?.email;
                  }).map(show => (
                    <div key={show.id} className="glass-card p-5 rounded-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/20 transition-all">
                      <div className="flex items-center space-x-4">
                        <div className="w-20 h-12 bg-black border border-white/10 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                          {show.imageUrl ? (
                            <img src={show.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-orbitron font-bold text-[8px] text-gray-500">SEM IMAGEM</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-orbitron font-bold text-white text-lg">{show.city}</h4>
                            <span className="bg-white/5 px-2 py-0.5 rounded text-[8px] font-orbitron tracking-wider text-gray-400">
                              {show.organizerId === 'admin' || !show.organizerId || show.organizerId === 'lockdown' ? "OFFICIAL" : "PARTNER"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 font-sans">{show.venue} • {show.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end space-x-6">
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 block font-sans">A partir de</span>
                          <span className="font-orbitron text-sm text-emerald-400 font-bold">{show.price}</span>
                        </div>
                        <span className={`border text-[10px] font-orbitron px-3 py-1 rounded-lg ${
                          show.status === 'Esgotado' 
                            ? 'bg-red-950/40 border-red-500/50 text-red-400' 
                            : show.status === 'Últimos Ingressos'
                              ? 'bg-amber-950/40 border-amber-500/50 text-amber-400'
                              : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400'
                        }`}>
                          {show.status}
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedShowForManagement(show);
                              loadIssuedTickets(show.id);
                            }}
                            className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold px-3 py-2 rounded-lg text-[10px] transition-colors cursor-pointer flex items-center space-x-1.5"
                            title="Painel de Controle e Métricas"
                          >
                            <Activity className="w-3.5 h-3.5" />
                            <span>PAINEL</span>
                          </button>
                          <button
                            onClick={() => openEditModal(show)}
                            className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-lg text-gray-300 hover:text-white transition-colors cursor-pointer border border-white/5"
                            title="Editar show"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteShow(show.id)}
                            className="bg-red-950/40 hover:bg-red-900/60 p-2 rounded-lg text-red-400 hover:text-red-200 transition-colors cursor-pointer border border-red-500/20"
                            title="Excluir show"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      ) : activeSubTab === 'scanner' ? (
        /* REDESIGNED ADVANCED DIGITAL PORTARIA / TICKET SCANNER VIEW */
        <div className="py-6 space-y-6 flex-1 max-w-6xl mx-auto w-full px-4 text-left">
          
          {/* CONTROL BAR (HEADER CONTROLS) */}
          <div className="glass-card p-4 rounded-2xl border border-white/10 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
                <Activity className="w-5 h-5 text-[#FF0033] animate-pulse" />
              </div>
              <div>
                <h3 className="font-orbitron font-black text-sm tracking-wider">PORTARIA DIGITAL</h3>
                <p className="text-[10px] text-gray-400 font-sans">Validação atômica de ingressos em tempo real</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Event Filter dropdown */}
              <div className="flex items-center space-x-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
                <span className="text-[9px] font-orbitron text-gray-400 font-bold uppercase">Filtrar Evento:</span>
                <select
                  value={selectedEventIdFilter}
                  onChange={(e) => setSelectedEventIdFilter(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none max-w-[150px] font-sans"
                >
                  <option value="ALL" className="bg-[#121212]">Todos Eventos</option>
                  {shows.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#121212]">
                      {s.city} @ {s.venue}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gate Id select */}
              <div className="flex items-center space-x-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
                <span className="text-[9px] font-orbitron text-gray-400 font-bold uppercase">Portão:</span>
                <select
                  value={scannerGateId}
                  onChange={(e) => setScannerGateId(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none font-orbitron"
                >
                  <option value="PORTÃO A" className="bg-[#121212]">Portão A</option>
                  <option value="PORTÃO B" className="bg-[#121212]">Portão B</option>
                  <option value="PORTÃO C" className="bg-[#121212]">Portão C</option>
                  <option value="VIP" className="bg-[#121212]">Entrada VIP</option>
                  <option value="PISTA" className="bg-[#121212]">Pista</option>
                  <option value="CAMAROTE" className="bg-[#121212]">Camarote</option>
                </select>
              </div>

              {/* Sound toggle */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-xl transition-all cursor-pointer border ${
                  soundEnabled 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                    : 'bg-zinc-800 border-white/5 text-gray-400'
                }`}
                title={soundEnabled ? 'Silenciar BIP' : 'Ativar BIP'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Kiosk Mode Toggle */}
              <button
                onClick={() => {
                  setIsKioskMode(!isKioskMode);
                  // Clean validation results on transition
                  setValidationResult(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-orbitron font-bold flex items-center space-x-1.5 transition-all border cursor-pointer ${
                  isKioskMode 
                    ? 'bg-[#FF0033]/20 border-[#FF0033]/40 text-[#FF0033] shadow-md shadow-red-950/40' 
                    : 'bg-zinc-800 border-white/5 text-gray-300'
                }`}
              >
                {isKioskMode ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                <span>{isKioskMode ? 'SAIR MODO KIOSK' : 'MODO KIOSK'}</span>
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {isKioskMode ? (
              /* ==========================================
                 KIOSK (FULLSCREEN OPTIMIZED PORTARIA) LAYOUT
                 ========================================== */
              <motion.div
                key="kiosk"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full"
              >
                {!validationResult ? (
                  /* Waiting for scan */
                  <div className="glass-card p-8 md:p-16 rounded-3xl border border-white/10 flex flex-col items-center justify-center text-center space-y-8 min-h-[500px]">
                    
                    {/* Pulsing indicator */}
                    <div className="relative flex items-center justify-center">
                      <div className="absolute inset-0 w-32 h-32 bg-[#FF0033]/10 rounded-full animate-ping" />
                      <div className="relative bg-[#FF0033]/10 border-2 border-[#FF0033]/40 p-8 rounded-full">
                        <QrCode className="w-16 h-16 text-[#FF0033] animate-pulse" />
                      </div>
                    </div>

                    <div className="space-y-3 max-w-lg">
                      <h2 className="font-orbitron font-black text-2xl tracking-wider text-white">APRESENTE O INGRESSO QR CODE</h2>
                      <p className="text-sm text-gray-400 font-sans leading-relaxed">
                        Aponte o código para a câmera ou utilize o leitor de código de barras físico. O sistema validará a entrada automaticamente.
                      </p>
                    </div>

                    {/* Integrated mini hidden/focus input for physical USB scanners in Kiosk Mode */}
                    <div className="w-full max-w-sm relative">
                      <input
                        ref={validationInputRef}
                        type="text"
                        placeholder="Clique aqui para leitores físicos..."
                        value={validationInput}
                        onChange={(e) => setValidationInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleValidateTicket();
                          }
                        }}
                        autoFocus
                        className="w-full bg-[#121212] border border-white/5 rounded-xl px-4 py-3 text-center text-xs text-gray-400 font-sans focus:outline-none focus:border-[#FF0033]/40"
                      />
                      <div className="absolute right-3 top-3 text-[9px] font-orbitron font-bold text-gray-500 bg-black/60 px-2 py-0.5 rounded-md border border-white/5 uppercase">
                        USB ATIVO
                      </div>
                    </div>

                    {/* Quick Camera start inside Kiosk */}
                    <div className="flex flex-col items-center space-y-4 pt-4">
                      {cameraActive ? (
                        <div className="space-y-4 flex flex-col items-center">
                          <div className="relative w-80 h-60 bg-black rounded-2xl overflow-hidden border-2 border-[#FF0033] shadow-2xl shadow-red-950/20">
                            <div id="qr-scanner-preview" className="w-full h-full object-cover" />
                            {/* Scanning Guide Overlay */}
                            <div className="absolute inset-0 border-2 border-dashed border-red-500/20 m-8 rounded-xl pointer-events-none flex items-center justify-center">
                              <div className="w-full h-0.5 bg-red-500/40 animate-[bounce_2s_infinite]" />
                            </div>
                          </div>
                          <button
                            onClick={stopCameraScanner}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white font-orbitron font-bold px-4 py-2 rounded-xl text-[10px] cursor-pointer border border-white/5 flex items-center space-x-1.5"
                          >
                            <Square className="w-3.5 h-3.5" />
                            <span>DESATIVAR CÂMERA</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={startCameraScanner}
                          className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold px-6 py-3 rounded-xl text-xs cursor-pointer shadow-lg flex items-center space-x-2"
                        >
                          <Play className="w-4 h-4" />
                          <span>ATIVAR SCANNER DA CÂMERA</span>
                        </button>
                      )}
                      {cameraError && (
                        <p className="text-xs text-red-500 font-sans">{cameraError}</p>
                      )}
                    </div>

                  </div>
                ) : (
                  /* Showing Kiosk Validation Result (Flashes entire background) */
                  <motion.div
                    key="kiosk-result"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-10 md:p-16 rounded-3xl border-2 text-center flex flex-col items-center justify-center space-y-8 min-h-[500px] transition-colors duration-200 ${
                      validationResult.success 
                        ? 'bg-emerald-950/80 border-emerald-500 shadow-2xl shadow-emerald-950/60' 
                        : 'bg-red-950/80 border-red-500 shadow-2xl shadow-red-950/60'
                    }`}
                  >
                    <div className={`p-6 rounded-full ${
                      validationResult.success ? 'bg-emerald-500/10' : 'bg-red-500/10'
                    }`}>
                      {validationResult.success ? (
                        <ShieldCheck className="w-24 h-24 text-emerald-400" />
                      ) : (
                        <ShieldX className="w-24 h-24 text-red-500 animate-pulse" />
                      )}
                    </div>

                    <div className="space-y-4 max-w-2xl">
                      <h1 className={`font-orbitron font-black text-4xl md:text-5xl tracking-widest ${
                        validationResult.success ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {validationResult.success ? 'ACESSO LIBERADO!' : 'ACESSO NEGADO!'}
                      </h1>
                      <p className="text-base text-gray-200 font-sans max-w-xl mx-auto">
                        {validationResult.message}
                      </p>
                    </div>

                    {validationResult.ticket && (
                      <div className="bg-black/60 p-6 rounded-2xl border border-white/10 max-w-md w-full text-left space-y-3 font-sans">
                        <div className="flex justify-between border-b border-white/5 pb-2">
                          <span className="text-gray-400 text-xs font-orbitron font-bold">CLIENTE:</span>
                          <span className="text-white text-sm font-black uppercase">{validationResult.ticket.buyerName}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-2">
                          <span className="text-gray-400 text-xs font-orbitron font-bold">EVENTO:</span>
                          <span className="text-white text-sm font-bold text-right">{validationResult.ticket.showName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-xs font-orbitron font-bold">SETOR:</span>
                          <span className="bg-[#FF0033] text-white px-2.5 py-0.5 rounded-lg text-xs font-orbitron font-bold">
                            {validationResult.ticket.sectorName}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="pt-4 flex items-center space-x-3 text-xs text-gray-400 font-sans">
                      <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                      <span>Retornando automaticamente em {autoResetSeconds} segundos...</span>
                      <button
                        onClick={() => setValidationResult(null)}
                        className="bg-white/10 hover:bg-white/20 text-white font-orbitron font-bold px-3 py-1.5 rounded-lg ml-4 cursor-pointer text-[10px]"
                      >
                        PULAR
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              /* ==========================================
                 STANDARD SPLIT-SCREEN OPERATOR LAYOUT
                 ========================================== */
              <motion.div
                key="standard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
                
                {/* LEFT SIDE: SCANNING ENGINE & CONTROLS (cols 7) */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* Portaria Settings */}
                  <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4">
                    <h4 className="font-orbitron font-bold text-xs text-gray-400 tracking-widest uppercase">CONFIGURAÇÃO DA PORTARIA</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-orbitron font-bold text-gray-400">OPERADOR / CABINE</label>
                        <input
                          type="text"
                          required
                          value={scannerPortaria}
                          onChange={(e) => setScannerPortaria(e.target.value)}
                          className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-sans focus:outline-none focus:border-[#FF0033]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-orbitron font-bold text-gray-400">DISPOSITIVO DE LEITURA</label>
                        <div className="bg-[#161616] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-gray-300 font-sans flex items-center justify-between">
                          <span>Webcam / Teclado USB</span>
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Scanner preview / manual block */}
                  <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-6 text-center">
                    <div className="text-left flex justify-between items-center">
                      <div>
                        <h4 className="font-orbitron font-black text-sm tracking-wide">CAPTURAR CÓDIGO QR</h4>
                        <p className="text-[10px] text-gray-400 mt-0.5">Ative a câmera ou use um scanner manual</p>
                      </div>
                    </div>

                    {/* Camera view element */}
                    <div className="flex flex-col items-center justify-center py-2">
                      {cameraActive ? (
                        <div className="space-y-4 w-full max-w-md flex flex-col items-center">
                          <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-inner">
                            <div id="qr-scanner-preview" className="w-full h-full object-cover" />
                            {/* Grid Overlay / Aim indicator */}
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                              <div className="w-48 h-48 border-2 border-red-500/40 rounded-3xl relative">
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-red-500" />
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-red-500" />
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-red-500" />
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-red-500" />
                              </div>
                              <div className="absolute w-full h-0.5 bg-red-500/30 animate-[bounce_2.5s_infinite]" />
                            </div>
                          </div>
                          <button
                            onClick={stopCameraScanner}
                            className="bg-zinc-800 hover:bg-zinc-700 text-red-400 font-orbitron font-bold px-4 py-2 rounded-xl text-[10px] cursor-pointer border border-white/5 flex items-center space-x-1.5"
                          >
                            <Square className="w-3.5 h-3.5" />
                            <span>DESATIVAR CÂMERA</span>
                          </button>
                        </div>
                      ) : (
                        <div className="border border-dashed border-white/10 rounded-2xl p-8 w-full max-w-md flex flex-col items-center justify-center space-y-4 bg-black/20">
                          <div className="bg-white/5 p-4 rounded-full">
                            <QrCode className="w-10 h-10 text-gray-500" />
                          </div>
                          <div className="space-y-1">
                            <h5 className="font-orbitron font-bold text-xs text-white">Câmera de Leitura Desativada</h5>
                            <p className="text-[10px] text-gray-400 font-sans">Ideal para economia de bateria do dispositivo.</p>
                          </div>
                          <button
                            onClick={startCameraScanner}
                            className="bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold px-4 py-2.5 rounded-xl text-[10px] cursor-pointer shadow-md flex items-center space-x-1.5 transition-all hover:scale-[1.02]"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>ATIVAR CÂMERA DO DISPOSITIVO</span>
                          </button>
                        </div>
                      )}

                      {cameraError && (
                        <p className="text-xs text-red-500 font-sans mt-3">{cameraError}</p>
                      )}
                    </div>

                    {/* Manual Input form */}
                    <form onSubmit={(e) => handleValidateTicket(e)} className="space-y-4 pt-4 border-t border-white/5 text-left">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-orbitron font-bold text-gray-400 uppercase">DIGITAÇÃO MANUAL OU LEITOR FÍSICO USB</label>
                        <div className="relative">
                          <input
                            ref={validationInputRef}
                            type="text"
                            required
                            placeholder="Aponte o leitor de código de barras ou digite o tkt_qr_..."
                            value={validationInput}
                            onChange={(e) => setValidationInput(e.target.value)}
                            className="w-full bg-[#161616] border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm font-sans focus:outline-none focus:border-[#FF0033]"
                          />
                          <div className="absolute right-3 top-3 text-gray-500">
                            <QrCode className="w-5 h-5 animate-pulse" />
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={validationLoading || !validationInput.trim()}
                        className="w-full bg-[#FF0033] hover:bg-red-700 disabled:opacity-50 text-white font-orbitron font-bold py-3 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center space-x-2 shadow-lg"
                      >
                        {validationLoading ? 'VALIDANDO INGRESSO...' : 'VALIDAR ENTRADA MANUAL'}
                      </button>
                    </form>

                  </div>

                </div>

                {/* RIGHT SIDE: FEEDBACK LOG & LAST RESULT (cols 5) */}
                <div className="lg:col-span-5 space-y-6">
                  
                  {/* Last Scan Result Card */}
                  <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4 text-left min-h-[300px] flex flex-col justify-between">
                    <div>
                      <h4 className="font-orbitron font-bold text-xs text-gray-400 tracking-widest uppercase mb-4">STATUS DO ÚLTIMO INGRESSO</h4>
                      
                      <AnimatePresence mode="wait">
                        {validationResult ? (
                          <motion.div
                            key="feedback"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`p-5 rounded-2xl border ${
                              validationResult.success 
                                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' 
                                : 'bg-red-950/20 border-red-500/40 text-red-300'
                            }`}
                          >
                            <div className="flex items-start space-x-3.5">
                              <div className="mt-0.5">
                                {validationResult.success ? (
                                  <ShieldCheck className="w-8 h-8 text-emerald-400" />
                                ) : (
                                  <ShieldX className="w-8 h-8 text-red-500" />
                                )}
                              </div>
                              <div className="space-y-1 flex-1">
                                <h5 className={`font-orbitron font-black text-sm uppercase ${
                                  validationResult.success ? 'text-emerald-400' : 'text-red-400'
                                }`}>
                                  {validationResult.success ? 'AUTORIZADO ✓' : 'ACESSO NEGADO ✗'}
                                </h5>
                                <p className="text-xs text-gray-200 font-sans leading-relaxed">
                                  {validationResult.message}
                                </p>
                              </div>
                            </div>

                            {validationResult.ticket && (
                              <div className="bg-black/50 p-4 rounded-xl space-y-2 border border-white/5 text-xs font-sans mt-4">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">CLIENTE:</span>
                                  <span className="text-white font-black uppercase">{validationResult.ticket.buyerName}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">EVENTO:</span>
                                  <span className="text-white font-bold text-right">{validationResult.ticket.showName}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-400">SETOR:</span>
                                  <span className="bg-[#FF0033]/20 border border-[#FF0033]/40 text-white px-2 py-0.5 rounded-md text-[10px] font-orbitron font-bold">
                                    {validationResult.ticket.sectorName}
                                  </span>
                                </div>
                                <div className="flex justify-between border-t border-white/5 pt-2 mt-2">
                                  <span className="text-gray-400">ID INGRESSO:</span>
                                  <span className="text-gray-400 text-[10px] font-mono">{validationResult.ticket.ticketId}</span>
                                </div>

                                {/* Revert Check-in action directly on last result if valid */}
                                {validationResult.success && (
                                  <div className="pt-2 border-t border-white/5 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleRevertCheckIn(validationResult.ticket.ticketId)}
                                      className="bg-red-950/40 hover:bg-red-900/60 text-red-400 text-[9px] font-orbitron font-bold px-2 py-1 rounded-lg border border-red-500/20 flex items-center space-x-1 cursor-pointer"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>CANCELAR CHECK-IN</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        ) : (
                          <div className="h-40 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                            <Clock className="w-8 h-8 text-gray-600 animate-pulse mb-2" />
                            <p className="text-xs text-gray-500 font-sans">Aguardando leitura de ingresso...</p>
                          </div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="text-[10px] text-gray-500 text-center font-sans border-t border-white/5 pt-4">
                      Selecione um evento acima para travar validação a um show específico.
                    </div>
                  </div>

                  {/* Historical log list */}
                  <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4 text-left">
                    <div className="flex justify-between items-center">
                      <h4 className="font-orbitron font-bold text-xs text-gray-400 tracking-widest uppercase">LOGS DE CHECK-IN RECENTES</h4>
                      <span className="text-[9px] font-mono bg-white/5 text-gray-400 px-2 py-0.5 rounded-full border border-white/5">
                        {checkInLogs.length} SESSÃO
                      </span>
                    </div>

                    {checkInLogs.length === 0 ? (
                      <p className="text-xs text-gray-500 font-sans py-8 text-center border border-dashed border-white/10 rounded-2xl">
                        Nenhum ingresso validado nesta sessão.
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {checkInLogs.map((log, idx) => (
                          <div key={idx} className="bg-black/40 p-3.5 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-3 flex-1 min-w-0 mr-2">
                              {log.success ? (
                                <div className="bg-emerald-500/10 p-1.5 rounded-lg">
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                </div>
                              ) : (
                                <div className="bg-red-500/10 p-1.5 rounded-lg">
                                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-white truncate text-[11px] uppercase">
                                  {log.success ? `AUTORIZADO: ${log.ticket?.buyerName || 'Cliente'}` : 'RECUSADO'}
                                </p>
                                <p className="text-[10px] text-gray-400 font-sans truncate">
                                  {log.success 
                                    ? `${log.ticket?.showName?.split('@')[0]} • ${log.ticket?.sectorName}` 
                                    : log.message}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <span className="text-[9px] font-mono text-gray-400">{log.time}</span>
                              {log.success && log.ticket && (
                                <button
                                  onClick={() => handleRevertCheckIn(log.ticket.ticketId)}
                                  className="bg-red-950/20 hover:bg-red-900/40 p-1.5 rounded-lg text-red-400 hover:text-white border border-red-500/10 transition-colors cursor-pointer"
                                  title="Estornar entrada / Reverter Check-In"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : activeSubTab === 'devices' ? (
        /* GATES AND HARDWARE TURNSTILES MANAGEMENT SUBTAB */
        <div className="py-6 space-y-6 flex-1 max-w-6xl mx-auto w-full px-4 text-left animate-fade-in">
          {/* Header section */}
          <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="bg-[#FF0033]/10 p-2.5 rounded-xl border border-[#FF0033]/20">
                <Cpu className="w-5 h-5 text-[#FF0033]" />
              </div>
              <div>
                <h3 className="font-orbitron font-black text-sm tracking-wider">PORTÕES & DISPOSITIVOS</h3>
                <p className="text-[10px] text-gray-400 font-sans">Cadastre leitores USB, catracas de acesso ou tablets e gerencie credenciais seguras de hardware</p>
              </div>
            </div>
            
            <button
              onClick={fetchDevices}
              disabled={devicesLoading}
              className="flex items-center space-x-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 px-4 py-2 rounded-xl text-xs font-orbitron font-bold text-gray-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${devicesLoading ? 'animate-spin' : ''}`} />
              <span>ATUALIZAR LISTA</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Column */}
            <div className="lg:col-span-1 bg-[#111] p-6 rounded-2xl border border-white/5 space-y-4 h-fit">
              <div className="border-b border-white/5 pb-2">
                <h4 className="font-orbitron font-bold text-xs text-white">REGISTRAR NOVO DISPOSITIVO</h4>
                <p className="text-[9px] text-gray-400 font-sans">Adicione leitores físicos, totens de portaria ou catracas IoT</p>
              </div>

              <form onSubmit={handleRegisterDevice} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-orbitron font-bold text-gray-400 mb-1">ID ÚNICO DO DISPOSITIVO *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: catraca_01_principal"
                    value={newDeviceForm.deviceId}
                    onChange={(e) => setNewDeviceForm(prev => ({ ...prev, deviceId: e.target.value }))}
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#FF0033] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-orbitron font-bold text-gray-400 mb-1">NOME EXIBIÇÃO *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Catraca Henry 01 - Portão A"
                    value={newDeviceForm.deviceName}
                    onChange={(e) => setNewDeviceForm(prev => ({ ...prev, deviceName: e.target.value }))}
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#FF0033] font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-orbitron font-bold text-gray-400 mb-1">PORTÃO / IDENTIFICADOR DE ACESSO *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: PORTÃO A"
                    value={newDeviceForm.gateId}
                    onChange={(e) => setNewDeviceForm(prev => ({ ...prev, gateId: e.target.value }))}
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#FF0033] font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-orbitron font-bold text-gray-400 mb-1">VINCULAR AO EVENTO</label>
                  <select
                    value={newDeviceForm.eventId}
                    onChange={(e) => setNewDeviceForm(prev => ({ ...prev, eventId: e.target.value }))}
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF0033] font-sans"
                  >
                    <option value="ALL">Todos os Shows / Eventos</option>
                    {shows.map(s => (
                      <option key={s.id} value={s.id}>{s.city} - {s.date}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={registeringDevice}
                  className="w-full bg-[#FF0033] hover:bg-[#D00028] text-white font-orbitron font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{registeringDevice ? "REGISTRANDO..." : "REGISTRAR DISPOSITIVO"}</span>
                </button>
              </form>
            </div>

            {/* List Column */}
            <div className="lg:col-span-2 bg-[#111] p-6 rounded-2xl border border-white/5 space-y-4">
              <div className="border-b border-white/5 pb-2">
                <h4 className="font-orbitron font-bold text-xs text-white">DISPOSITIVOS CADASTRADOS</h4>
                <p className="text-[9px] text-gray-400 font-sans">Lista de leitores e catracas integradas com a API Lockdown</p>
              </div>

              {devicesLoading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="w-8 h-8 text-gray-600 animate-spin" />
                  <span className="text-xs text-gray-500 font-orbitron">Carregando dispositivos...</span>
                </div>
              ) : devicesList.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center space-y-2">
                  <Server className="w-8 h-8 text-gray-600" />
                  <span>Nenhum dispositivo físico registrado no momento.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-500 font-orbitron uppercase text-[9px] border-b border-white/5">
                        <th className="pb-2">Dispositivo / ID</th>
                        <th className="pb-2">Portão</th>
                        <th className="pb-2">Evento Vinculado</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Chave de Acesso</th>
                        <th className="pb-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {devicesList.map(dev => {
                        const isOnline = dev.lastSeenAt && (Date.now() - new Date(dev.lastSeenAt).getTime() < 5 * 60 * 1000);
                        const matchedShow = shows.find(s => s.id === dev.eventId);
                        
                        return (
                          <tr key={dev.deviceId} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 pr-2">
                              <p className="font-bold text-white font-sans">{dev.deviceName}</p>
                              <p className="text-[10px] text-gray-500 font-mono">{dev.deviceId}</p>
                            </td>
                            <td className="py-3">
                              <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px] font-orbitron font-bold">
                                {dev.gateId || "Portão Geral"}
                              </span>
                            </td>
                            <td className="py-3 text-gray-400">
                              {dev.eventId === 'ALL' ? 'Todos os Shows' : (matchedShow ? `${matchedShow.city}` : 'Show Específico')}
                            </td>
                            <td className="py-3">
                              <div className="flex items-center space-x-1.5">
                                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`}></span>
                                <span className={`text-[10px] font-orbitron font-bold ${isOnline ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                                </span>
                              </div>
                              <p className="text-[9px] text-gray-500 font-sans mt-0.5">
                                {dev.lastSeenAt ? `Visto: ${new Date(dev.lastSeenAt).toLocaleString('pt-BR')}` : 'Nunca visto'}
                              </p>
                            </td>
                            <td className="py-3 font-mono text-[10px] text-zinc-400">
                              <div className="flex items-center space-x-1">
                                <Key className="w-3 h-3 text-[#FF0033]/50" />
                                <span>{dev.deviceKeyMasked || "Oculta"}</span>
                              </div>
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => handleDeleteDevice(dev.deviceId)}
                                className="text-red-400 hover:text-red-300 p-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded transition-colors cursor-pointer"
                                title="Revogar e Deletar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Secure display for device credentials modal */}
          {credentialsModal && credentialsModal.isOpen && (
            <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-[#111] border border-[#FF0033]/30 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative text-left">
                <button
                  onClick={() => setCredentialsModal(null)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center space-x-3 text-emerald-400 border-b border-white/5 pb-3">
                  <ShieldCheck className="w-6 h-6" />
                  <h4 className="font-orbitron font-black text-sm tracking-wider">CHAVE DE HARDWARE GERADA</h4>
                </div>

                <p className="text-xs text-gray-300 font-sans leading-relaxed">
                  Para integrar seu leitor, catraca física ou dispositivo IoT à portaria da Lockdown, configure-o com a seguinte chave de autorização:
                </p>

                <div className="bg-black p-4 rounded-xl border border-white/10 space-y-2">
                  <span className="text-[10px] font-orbitron font-bold text-gray-500">ID DO DISPOSITIVO:</span>
                  <p className="text-xs font-mono text-white font-bold">{credentialsModal.deviceId}</p>

                  <span className="text-[10px] font-orbitron font-bold text-gray-500 block mt-2">CHAVE SECRETA (deviceKey / gateDeviceKey):</span>
                  <div className="flex items-center justify-between gap-2 bg-[#141414] px-3 py-2 rounded-lg border border-white/5">
                    <p className="text-xs font-mono text-emerald-400 select-all font-bold break-all">{credentialsModal.deviceKey}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(credentialsModal.deviceKey);
                        triggerStatus("Chave copiada para a área de transferência!", "success");
                      }}
                      className="p-1.5 bg-zinc-850 hover:bg-zinc-800 rounded-lg text-gray-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0"
                      title="Copiar Chave"
                    >
                      <Clipboard className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="bg-[#FF0033]/10 border border-[#FF0033]/25 p-3 rounded-xl flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-[#FF0033] mt-0.5 shrink-0" />
                  <p className="text-[10px] text-red-200 font-sans leading-relaxed">
                    <strong>ATENÇÃO:</strong> Por motivos de segurança, esta chave é exibida apenas uma vez. Copie e configure-a em seu dispositivo físico/catraca imediatamente. Ela nunca mais será mostrada por completo no painel.
                  </p>
                </div>

                <button
                  onClick={() => setCredentialsModal(null)}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white font-orbitron font-bold py-2.5 rounded-xl text-xs tracking-wider cursor-pointer"
                >
                  CONCLUÍDO
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // ==========================================
        // PLATFORM FINANCE DASHBOARD VIEW (ADMIN ONLY)
        // ==========================================
        (() => {
          // Filter paid ticket orders
          const ticketOrders = allOrders.filter(o => o.orderType === 'ticket' || (o.productId && o.productId.startsWith('ticket-')));
          const paidTicketOrders = ticketOrders.filter(o => o.status === 'Pago' || o.status === 'Aprovado');

          // Filter by selected period
          const filterByPeriod = (orders: any[]) => {
            const now = new Date();
            return orders.filter(o => {
              if (!o.createdAt) return false;
              const date = new Date(o.createdAt);
              if (financePeriod === 'today') {
                return date.toDateString() === now.toDateString();
              }
              if (financePeriod === '7days') {
                const diff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
                return diff <= 7;
              }
              if (financePeriod === '30days') {
                const diff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
                return diff <= 30;
              }
              if (financePeriod === 'month') {
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
              }
              return true;
            });
          };

          const periodOrders = filterByPeriod(paidTicketOrders);

          // Totals
          const totalTicketsSold = periodOrders.reduce((acc, o) => acc + (Number(o.quantity) || 0), 0);
          const totalGMV = periodOrders.reduce((acc, o) => acc + (Number(o.grossValue || o.amount?.replace("R$", "").trim().replace(/\./g, "").replace(",", ".")) || 0), 0);
          
          const totalGatewayFees = periodOrders.reduce((acc, o) => {
            return acc + (o.paymentFee !== undefined ? Number(o.paymentFee) : parseFloat(((o.grossValue || 0) * 0.04).toFixed(2)));
          }, 0);

          const totalLockdownCommissions = periodOrders.reduce((acc, o) => {
            return acc + (o.lockdownFeeAmount !== undefined ? Number(o.lockdownFeeAmount) : (o.commissionValue !== undefined ? Number(o.commissionValue) : 0));
          }, 0);

          // Calculate transferred and pending across shows
          let totalTransferred = 0;
          let totalPendingTransfer = 0;

          shows.forEach(s => {
            const isLockdown = s.organizerId === 'admin' || !s.organizerId || s.organizerId === 'lockdown';
            if (!isLockdown) {
              const showOrders = allOrders.filter(o => (o.showId === s.id || o.productId === `ticket-${s.id}`) && (o.status === 'Pago' || o.status === 'Aprovado'));
              const sStats = getShowStats(s, showOrders);
              totalTransferred += s.transferredAmount || 0;
              totalPendingTransfer += Math.max(0, sStats.organizerNetRevenue - (s.transferredAmount || 0));
            }
          });

          return (
            <div className="py-8 space-y-8 flex-1 w-full animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-6">
                <div>
                  <h3 className="font-orbitron font-black text-xl text-white uppercase tracking-tight">FINANCEIRO DA PLATAFORMA</h3>
                  <p className="text-xs text-gray-400 font-sans mt-0.5">Visão consolidada de todas as comissões, vendas e payouts.</p>
                </div>

                {/* Period filters */}
                <div className="flex bg-black/60 p-1 rounded-xl border border-white/5 gap-1">
                  {(['today', '7days', '30days', 'month', 'all'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setFinancePeriod(p)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-orbitron font-bold transition-all uppercase ${
                        financePeriod === p ? 'bg-[#FF0033] text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {p === 'today' ? 'Hoje' : p === '7days' ? '7 dias' : p === '30days' ? '30 dias' : p === 'month' ? 'Este Mês' : 'Todos'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-[#111] p-6 rounded-2xl border border-white/5 space-y-2">
                  <span className="text-[10px] text-gray-400 font-orbitron uppercase">VOLUME BRUTO (GMV)</span>
                  <p className="text-3xl font-orbitron font-black text-emerald-400">{formatBRL(totalGMV)}</p>
                  <span className="text-[10px] text-gray-500 font-sans block">{totalTicketsSold} ingressos vendidos</span>
                </div>

                <div className="bg-[#111] p-6 rounded-2xl border border-white/5 space-y-2">
                  <span className="text-[10px] text-gray-400 font-orbitron uppercase">COMISSÕES COBRADAS</span>
                  <p className="text-3xl font-orbitron font-black text-white">{formatBRL(totalLockdownCommissions)}</p>
                  <span className="text-[10px] text-gray-500 font-sans block">Taxa de serviço Lockdown</span>
                </div>

                <div className="bg-[#111] p-6 rounded-2xl border border-white/5 space-y-2">
                  <span className="text-[10px] text-gray-400 font-orbitron uppercase">TAXAS DE GATEWAY</span>
                  <p className="text-3xl font-orbitron font-black text-red-400">{formatBRL(totalGatewayFees)}</p>
                  <span className="text-[10px] text-gray-500 font-sans block">Custos de transações estimados</span>
                </div>

                <div className="bg-[#111] p-6 rounded-2xl border border-white/5 space-y-2">
                  <span className="text-[10px] text-gray-400 font-orbitron uppercase">REPASSES PENDENTES</span>
                  <p className="text-3xl font-orbitron font-black text-amber-500">{formatBRL(totalPendingTransfer)}</p>
                  <span className="text-[10px] text-gray-500 font-sans block">Já pago: {formatBRL(totalTransferred)}</span>
                </div>
              </div>

              {/* Details table */}
              <div className="bg-[#111] p-6 rounded-2xl border border-white/5 space-y-4">
                <h4 className="font-orbitron font-bold text-xs text-white uppercase tracking-wider">RELAÇÃO E APURAÇÃO POR EVENTO</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-500 font-orbitron uppercase text-[9px] border-b border-white/5">
                        <th className="pb-2">Evento</th>
                        <th className="pb-2">Organizador</th>
                        <th className="pb-2 text-right">GMV Bruto</th>
                        <th className="pb-2 text-right">Taxa Gateway</th>
                        <th className="pb-2 text-right">Comissão Lockdown</th>
                        <th className="pb-2 text-right">Líquido do Produtor</th>
                        <th className="pb-2 text-right">Repassado</th>
                        <th className="pb-2 text-right text-amber-500">A Repassar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shows.map(s => {
                        const showOrders = allOrders.filter(o => (o.showId === s.id || o.productId === `ticket-${s.id}`) && (o.status === 'Pago' || o.status === 'Aprovado'));
                        const sStats = getShowStats(s, showOrders);
                        const isLockdown = s.organizerId === 'admin' || !s.organizerId || s.organizerId === 'lockdown';
                        const pending = Math.max(0, sStats.organizerNetRevenue - (s.transferredAmount || 0));

                        return (
                          <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-3 font-bold font-orbitron text-white text-[11px]">{s.city}</td>
                            <td className="py-3 text-gray-400">{isLockdown ? 'Lockdown Oficial' : (s.organizerName || s.organizerId)}</td>
                            <td className="py-3 text-right font-bold text-white font-orbitron">{formatBRL(sStats.grossRevenue)}</td>
                            <td className="py-3 text-right text-red-400 font-bold font-orbitron">{formatBRL(sStats.totalPaymentFees)}</td>
                            <td className="py-3 text-right text-white font-bold font-orbitron">{isLockdown ? 'R$ 0,00' : formatBRL(sStats.totalLockdownFees)}</td>
                            <td className="py-3 text-right text-emerald-400 font-bold font-orbitron">{formatBRL(sStats.organizerNetRevenue)}</td>
                            <td className="py-3 text-right text-emerald-400 font-bold font-orbitron">{isLockdown ? 'N/A' : formatBRL(s.transferredAmount || 0)}</td>
                            <td className="py-3 text-right text-amber-500 font-black font-orbitron">{isLockdown ? 'N/A' : formatBRL(pending)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* Events Creator / Editor Overlay Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0f0f0f] border border-white/10 w-full max-w-4xl rounded-3xl p-6 md:p-8 overflow-y-auto max-h-[95vh] text-white shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
                <h3 className="font-orbitron font-black text-xl">
                  {editingShow ? 'EDITAR EVENTO' : 'CADASTRAR NOVO EVENTO'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveShow} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Local Search Component with Google Maps autocomplete */}
                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-orbitron font-bold text-gray-300">PESQUISAR LOCAL / ENDEREÇO *</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="Pesquise o local do show (ex: Arena Hall)"
                        value={venue}
                        onChange={(e) => handleAddressSearch(e.target.value)}
                        className="w-full bg-[#161616] border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm font-sans focus:outline-none focus:border-[#FF0033]"
                      />
                      {addressLoading && (
                        <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      )}
                    </div>

                    {predictions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full bg-zinc-950 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                        {predictions.map((p, i) => (
                          <div
                            key={i}
                            onClick={() => handleSelectPrediction(p)}
                            className="p-3 text-xs text-gray-200 hover:bg-[#FF0033] hover:text-white cursor-pointer transition-colors border-b border-white/5 text-left"
                          >
                            {p.description}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-orbitron font-bold text-gray-300">CIDADE / ESTADO *</label>
                    <input
                      type="text"
                      required
                      placeholder="Cidade - UF"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-3 text-sm font-sans focus:outline-none focus:border-[#FF0033]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-orbitron font-bold text-gray-300">DATA & HORA DO SHOW *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 25 de Outubro, 22:00"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-3 text-sm font-sans focus:outline-none focus:border-[#FF0033]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-orbitron font-bold text-gray-300">STATUS DA TOUR *</label>
                    <select
                      value={status}
                      onChange={(e: any) => setStatus(e.target.value)}
                      className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-3 text-sm font-orbitron focus:outline-none focus:border-[#FF0033]"
                    >
                      <option value="Disponível">Disponível</option>
                      <option value="Últimos Ingressos">Últimos Ingressos</option>
                      <option value="Esgotado">Esgotado</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-orbitron font-bold text-gray-300">ENDEREÇO SELECIONADO</label>
                    <input
                      type="text"
                      disabled
                      placeholder="Aguardando seleção..."
                      value={formattedAddress}
                      className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-xs font-sans text-gray-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-orbitron font-bold text-gray-300">DESCRIÇÃO DETALHADA DO SHOW</label>
                  <textarea
                    rows={2}
                    placeholder="Escreva detalhes sobre o show, atrações confirmadas..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-3 text-sm font-sans focus:outline-none focus:border-[#FF0033]"
                  />
                </div>

                {/* Google Maps Visual Preview */}
                {googleMapsKey && latitude && longitude ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-orbitron font-bold text-gray-300">GEOLOCALIZAÇÃO DO EVENTO (GOOGLE MAPS)</label>
                    <div className="w-full h-48 rounded-xl overflow-hidden border border-white/10 shadow-lg relative">
                      <APIProvider apiKey={googleMapsKey}>
                        <Map
                          defaultCenter={{ lat: latitude, lng: longitude }}
                          defaultZoom={15}
                          gestureHandling={'cooperative'}
                          disableDefaultUI={true}
                          mapId="DEMO_MAP_ID"
                          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
                        >
                          <AdvancedMarker position={{ lat: latitude, lng: longitude }} />
                        </Map>
                      </APIProvider>
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5 text-center text-xs text-gray-500">
                    Insira um endereço válido para visualizar a geolocalização no Google Maps.
                  </div>
                )}

                {/* Sectors and Lots Manager */}
                <div className="space-y-4 bg-zinc-950 p-5 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-orbitron font-bold text-xs text-white">SETORIZAÇÃO E LOTES DE INGRESSOS</h4>
                      <p className="text-[10px] text-gray-500 font-sans mt-0.5">Defina os setores do show e os preços de cada lote.</p>
                    </div>
                    {!showAddSector && (
                      <button
                        type="button"
                        onClick={() => setShowAddSector(true)}
                        className="bg-white/10 hover:bg-white/20 text-white font-orbitron font-bold px-3 py-1.5 rounded-lg text-[10px] flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>NOVO SETOR</span>
                      </button>
                    )}
                  </div>

                  {/* Add sector subform */}
                  {showAddSector && (
                    <div className="bg-[#121212] p-4 rounded-xl border border-white/10 space-y-3">
                      <span className="text-[9px] font-orbitron font-bold text-[#FF0033]">CONFIGURAR SETOR</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Nome do Setor (ex: Pista, VIP, Camarote)"
                          value={tempSectorName}
                          onChange={(e) => setTempSectorName(e.target.value)}
                          className="bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF0033]"
                        />
                        <input
                          type="number"
                          placeholder="Capacidade Total do Setor (ex: 500)"
                          value={tempSectorCapacity}
                          onChange={(e) => setTempSectorCapacity(e.target.value)}
                          className="bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF0033]"
                        />
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={handleAddSector}
                          className="bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg text-[10px] font-orbitron font-bold"
                        >
                          SALVAR SETOR
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddSector(false)}
                          className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-[10px] font-orbitron font-bold text-gray-400"
                        >
                          CANCELAR
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Configured sectors list */}
                  {sectors.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-white/10 rounded-xl text-xs text-gray-500">
                      Nenhum setor cadastrado. Você precisa adicionar setores (ex: Pista) para vender ingressos.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sectors.map(sec => {
                        const sectorLots = lots.filter(l => l.sectorId === sec.sectorId);
                        return (
                          <div key={sec.sectorId} className="bg-[#141414] p-4 rounded-xl border border-white/5 space-y-4">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              {/* Editable Sector Fields inline */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-11/12 text-left">
                                <div>
                                  <label className="block text-[8px] text-gray-400 font-orbitron uppercase mb-0.5">Nome do Setor</label>
                                  <input
                                    type="text"
                                    required
                                    value={sec.name}
                                    onChange={(e) => setSectors(prev => prev.map(s => s.sectorId === sec.sectorId ? { ...s, name: e.target.value } : s))}
                                    className="w-full bg-zinc-900 border border-white/10 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FF0033]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] text-gray-400 font-orbitron uppercase mb-0.5">Capacidade Máxima</label>
                                  <input
                                    type="number"
                                    min="1"
                                    required
                                    value={sec.capacity}
                                    onChange={(e) => setSectors(prev => prev.map(s => s.sectorId === sec.sectorId ? { ...s, capacity: parseInt(e.target.value) || 0 } : s))}
                                    className="w-full bg-zinc-900 border border-white/10 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FF0033]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[8px] text-gray-400 font-orbitron uppercase mb-0.5">Descrição Curta</label>
                                  <input
                                    type="text"
                                    value={sec.description || ''}
                                    placeholder="Ex: Próximo ao palco"
                                    onChange={(e) => setSectors(prev => prev.map(s => s.sectorId === sec.sectorId ? { ...s, description: e.target.value } : s))}
                                    className="w-full bg-zinc-900 border border-white/10 rounded-md px-2 py-1 text-xs text-white focus:outline-none"
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveSector(sec.sectorId)}
                                className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-950/20 self-center"
                                title="Remover setor"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Lots in this sector */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-orbitron font-bold text-gray-400 tracking-wider">LOTES DESTE SETOR</span>
                                <button
                                  type="button"
                                  onClick={() => handleAddLotToSector(sec.sectorId)}
                                  className="text-[#FF0033] hover:text-red-400 text-[9px] font-orbitron font-bold flex items-center space-x-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>NOVO LOTE</span>
                                </button>
                              </div>

                              <div className="grid grid-cols-1 gap-2">
                                {sectorLots.map((lot, lotIdx) => (
                                  <div key={lot.lotId} className="grid grid-cols-12 gap-2 items-center bg-black/40 p-2.5 rounded-lg border border-white/5 text-left">
                                    {/* Nome do Lote: 2 cols */}
                                    <div className="col-span-2">
                                      <label className="block text-[8px] text-gray-500 uppercase font-orbitron mb-0.5">Nome</label>
                                      <input
                                        type="text"
                                        required
                                        value={lot.name}
                                        onChange={(e) => handleUpdateLot(lot.lotId, { name: e.target.value })}
                                        className="w-full bg-zinc-900 border border-white/10 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FF0033]"
                                        placeholder="1º Lote"
                                      />
                                    </div>

                                    {/* Preço Unitário: 2 cols */}
                                    <div className="col-span-2">
                                      <label className="block text-[8px] text-gray-500 uppercase font-orbitron mb-0.5">Preço (R$)</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={lot.price}
                                        onChange={(e) => handleUpdateLot(lot.lotId, { price: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-zinc-900 border border-white/10 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FF0033]"
                                        placeholder="50.00"
                                      />
                                    </div>

                                    {/* Quantidade: 2 cols */}
                                    <div className="col-span-2">
                                      <label className="block text-[8px] text-gray-500 uppercase font-orbitron mb-0.5">Qtd Total</label>
                                      <input
                                        type="number"
                                        min="0"
                                        required
                                        value={lot.quantity}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value) || 0;
                                          const sold = lot.soldQuantity || 0;
                                          if (val < sold) {
                                            triggerStatus(`Qtd não pode ser menor que vendidos (${sold})`, "error");
                                          } else {
                                            handleUpdateLot(lot.lotId, { quantity: val });
                                          }
                                        }}
                                        className="w-full bg-zinc-900 border border-white/10 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FF0033]"
                                        placeholder="100"
                                      />
                                    </div>

                                    {/* Início das vendas: 2 cols */}
                                    <div className="col-span-2">
                                      <label className="block text-[8px] text-gray-500 uppercase font-orbitron mb-0.5">Início</label>
                                      <input
                                        type="date"
                                        required
                                        value={lot.salesStart ? lot.salesStart.split('T')[0] : ''}
                                        onChange={(e) => handleUpdateLot(lot.lotId, { salesStart: e.target.value })}
                                        className="w-full bg-zinc-900 border border-white/10 rounded-md px-1.5 py-0.5 text-[10px] text-white focus:outline-none"
                                      />
                                    </div>

                                    {/* Fim das vendas: 2 cols */}
                                    <div className="col-span-2">
                                      <label className="block text-[8px] text-gray-500 uppercase font-orbitron mb-0.5">Término</label>
                                      <input
                                        type="date"
                                        value={lot.salesEnd ? lot.salesEnd.split('T')[0] : ''}
                                        onChange={(e) => handleUpdateLot(lot.lotId, { salesEnd: e.target.value })}
                                        className="w-full bg-zinc-900 border border-white/10 rounded-md px-1.5 py-0.5 text-[10px] text-white focus:outline-none"
                                      />
                                    </div>

                                    {/* Status do Lote: 1 col */}
                                    <div className="col-span-1">
                                      <label className="block text-[8px] text-gray-500 uppercase font-orbitron mb-0.5">Status</label>
                                      <select
                                        value={lot.soldOut ? 'soldout' : lot.active ? 'active' : 'inactive'}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val === 'active') {
                                            handleUpdateLot(lot.lotId, { active: true, soldOut: false });
                                          } else if (val === 'inactive') {
                                            handleUpdateLot(lot.lotId, { active: false, soldOut: false });
                                          } else if (val === 'soldout') {
                                            handleUpdateLot(lot.lotId, { active: true, soldOut: true });
                                          }
                                        }}
                                        className="w-full bg-[#161616] border border-white/10 rounded-md px-0.5 py-1 text-[9px] text-white focus:outline-none"
                                      >
                                        <option value="active">Ativo</option>
                                        <option value="inactive">Inativo</option>
                                        <option value="soldout">Esgotado</option>
                                      </select>
                                    </div>

                                    {/* Ações (Remover): 1 col */}
                                    <div className="col-span-1 text-center pt-3">
                                      {sectorLots.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveLot(lot.lotId)}
                                          className="text-red-400 hover:text-red-300 p-1 hover:bg-red-950/20 rounded-md transition-colors"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Cover selection */}
                <div className="space-y-3 bg-[#141414] p-5 rounded-2xl border border-white/5">
                  <span className="text-[10px] font-orbitron font-bold text-gray-300 block">IMAGEM DE CAPA DO EVENTO (OPCIONAL)</span>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-40 aspect-[16/9] bg-black border border-white/10 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                      {imageUrl ? (
                        <img src={imageUrl} alt="Capa" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-[10px] font-orbitron text-gray-500 font-bold">SEM IMAGEM</div>
                      )}
                    </div>

                    <div className="flex-1 w-full space-y-3">
                      <div className="flex gap-2">
                        <label className={`flex-1 bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold py-2 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <Upload className="w-4 h-4" />
                          <span>{isUploading ? 'ENVIANDO...' : 'FAZER UPLOAD DA CAPA'}</span>
                          <input
                            type="file"
                            accept="image/png, image/jpeg, image/jpg, image/webp"
                            onChange={handleCoverUpload}
                            disabled={isUploading}
                            className="hidden"
                          />
                        </label>

                        {imageUrl && (
                          <button
                            type="button"
                            onClick={() => setImageUrl('')}
                            className="bg-zinc-800 hover:bg-zinc-700 text-gray-300 font-orbitron font-bold py-2 px-3 rounded-xl text-xs transition-colors cursor-pointer border border-white/5"
                          >
                            REMOVER CAPA
                          </button>
                        )}
                      </div>

                      {isUploading && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-orbitron">
                            <span className="text-gray-400">{uploadStatus}</span>
                            <span className="text-[#FF0033] font-bold">{uploadProgress}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#FF0033] transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="bg-zinc-900 hover:bg-zinc-800 text-gray-300 border border-white/10 font-orbitron font-bold py-3 px-6 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-orbitron font-bold py-3 px-6 rounded-xl text-xs flex items-center space-x-2 shadow-lg transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>SALVAR SHOW</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
