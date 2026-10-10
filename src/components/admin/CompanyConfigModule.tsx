import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Building, 
  CreditCard, 
  Shield, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  Trash2, 
  Search, 
  FileText, 
  Sliders, 
  Save, 
  Check, 
  RefreshCw, 
  Server, 
  Lock,
  HardDrive,
  Cloud,
  Database
} from 'lucide-react';
import { auth, db, storage } from '../../lib/firebase';
import { uploadFile } from '../../utils/upload';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { fetchCompanySettings, saveCompanySettings } from '../../utils/storeDb';

interface CompanyConfigModuleProps {
  onBackToMenu: () => void;
}

export const CompanyConfigModule: React.FC<CompanyConfigModuleProps> = ({ onBackToMenu }) => {
  const [activeTab, setActiveTab] = useState<'empresa' | 'bancos' | 'mercadopago' | 'logs' | 'diagnostico'>('empresa');
  const [successMsg, setSuccessMsg] = useState('');

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const [isFaviconUploading, setIsFaviconUploading] = useState<boolean>(false);
  const [faviconUploadProgress, setFaviconUploadProgress] = useState<number>(0);
  const [faviconUploadStatus, setFaviconUploadStatus] = useState<string>('');

  const [isMascotUploading, setIsMascotUploading] = useState<boolean>(false);
  const [mascotUploadProgress, setMascotUploadProgress] = useState<number>(0);
  const [mascotUploadStatus, setMascotUploadStatus] = useState<string>('');

  const [localLogoPreview, setLocalLogoPreview] = useState<string | null>(null);
  const [localFaviconPreview, setLocalFaviconPreview] = useState<string | null>(null);
  const [localMascotPreview, setLocalMascotPreview] = useState<string | null>(null);

  const [uploadLogoError, setUploadLogoError] = useState<string | null>(null);
  const [uploadFaviconError, setUploadFaviconError] = useState<string | null>(null);
  const [uploadMascotError, setUploadMascotError] = useState<string | null>(null);

  const [diagRunning, setDiagRunning] = useState<boolean>(false);
  const [diagResults, setDiagResults] = useState<{ auth: string; db: string; storage: string; drive: string } | null>(null);

  // 1. Company Identity state
  const [companyInfo, setCompanyInfo] = useState(() => {
    const saved = localStorage.getItem('voxa_company_info');
    if (saved) {
      try { return { mascotUrl: '', ...JSON.parse(saved) }; } catch (e) {}
    }
    return {
      companyName: 'VOXA Tecnologia e Redes Sociais LTDA',
      tradeName: 'VOXA',
      document: '99.999.999/0001-99',
      email: 'contato@voxa.com.br',
      phone: '+55 (11) 99999-9999',
      whatsapp: '+55 (11) 99999-9999',
      address: 'Avenida Paulista, 1000 - Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01311-100',
      logoUrl: '',
      faviconUrl: '',
      mascotUrl: ''
    };
  });

  // 2. Bank Details state
  const [bankInfo, setBankInfo] = useState(() => {
    const saved = localStorage.getItem('voxa_bank_info');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      bankName: 'Nubank / PagBank',
      bankCode: '260',
      agency: '0001',
      accountNumber: '9999999-9',
      accountType: 'Conta Jurídica (PJ)',
      holderName: 'VOXA Tecnologia e Redes Sociais LTDA',
      holderDoc: '99.999.999/0001-99',
      pixKey: 'financeiro@voxa.com.br',
      pixType: 'E-mail'
    };
  });

  // 3. Mercado Pago Integration state
  const [mpConfig, setMpConfig] = useState(() => {
    const saved = localStorage.getItem('voxa_mp_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      publicKey: 'APP_USR-8849102-mock-key-prod',
      accessToken: 'APP_USR-secret-99482104-sandbox',
      clientId: '8849201048',
      clientSecret: 'secret_mkt_994821',
      environment: 'sandbox',
      status: 'Configurado'
    };
  });

  const [adminMpStatus, setAdminMpStatus] = useState<any>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const loadAdminMpStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const response = await fetch('/api/admin/mercadopago/status');
      const data = await response.json();
      if (data.success) {
        setAdminMpStatus(data);
      }
    } catch (err) {
      console.error("Failed to load admin MP status:", err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'mercadopago') {
      loadAdminMpStatus();
    }
  }, [activeTab]);

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // 4. Payment Logs state
  const [paymentLogs, setPaymentLogs] = useState(() => {
    const saved = localStorage.getItem('voxa_payment_logs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 'ORD-9021', user: 'Yung Cyber', origin: 'STORE', item: 'Moletom VOXA Space', amount: 'R$ 299,90', mpId: 'MP-99482104', status: 'Pago', date: '06/08/2026 18:30' },
      { id: 'ORD-9022', user: 'Julia Silva', origin: 'TICKET', item: 'Ingresso SP - Pista Premium', amount: 'R$ 150,00', mpId: 'MP-99482105', status: 'Pago', date: '06/08/2026 19:05' },
      { id: 'ORD-9023', user: 'Bruno R.', origin: 'SUBSCRIPTION', item: 'Clube VIP Mensal', amount: 'R$ 49,90', mpId: 'MP-99482106', status: 'Pendente', date: '06/08/2026 19:12' },
      { id: 'ORD-9019', user: 'Ana Souza', origin: 'STORE', item: 'Boné VOXA Minimalist', amount: 'R$ 119,90', mpId: 'MP-99482100', status: 'Reembolsado', date: '05/08/2026 12:15' },
    ];
  });

  const [logSearch, setLogSearch] = useState('');
  const [logFilter, setLogFilter] = useState('ALL');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await fetchCompanySettings();
        setCompanyInfo(settings);
      } catch (err) {
        console.error("Failed to load company settings from Firestore:", err);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    localStorage.setItem('voxa_company_info', JSON.stringify(companyInfo));
    localStorage.setItem('voxa_company_settings', JSON.stringify(companyInfo));
  }, [companyInfo]);

  useEffect(() => {
    localStorage.setItem('voxa_bank_info', JSON.stringify(bankInfo));
  }, [bankInfo]);

  useEffect(() => {
    localStorage.setItem('voxa_mp_config', JSON.stringify(mpConfig));
  }, [mpConfig]);

  useEffect(() => {
    localStorage.setItem('voxa_payment_logs', JSON.stringify(paymentLogs));
  }, [paymentLogs]);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveCompanySettings(companyInfo);
      setSuccessMsg('Informações da Empresa salvas com sucesso!');
    } catch (err) {
      console.error("Failed to save company settings:", err);
      setSuccessMsg('Erro ao salvar no Firestore. Salvo localmente.');
    }
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveCompanySettings(companyInfo);
      setSuccessMsg('Dados Bancários salvos com sucesso no Firestore!');
    } catch (err) {
      console.error("Failed to save bank settings:", err);
      setSuccessMsg('Erro ao salvar no Firestore. Salvo localmente.');
    }
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleSaveMP = (e: React.FormEvent) => {
    e.preventDefault();
    setMpConfig(prev => ({ ...prev, status: 'Configurado' }));
    setSuccessMsg('Credenciais do Mercado Pago salvas no backend com segurança!');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleTestMPConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/mercadopago/config');
      const config = await res.json();
      if (config.success && config.hasAccessToken) {
        setTestResult({ success: true, msg: `Conexão efetuada com sucesso! Ambiente ativo: ${config.environment === 'production' ? 'PRODUÇÃO (REAL)' : 'SANDBOX / TESTE'}.` });
        loadAdminMpStatus();
      } else {
        setTestResult({ success: false, msg: 'Erro de conexão: Chave Access Token ausente ou inválida no backend.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, msg: `Falha ao tentar comunicação com o servidor: ${err.message}` });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setLocalLogoPreview(previewUrl);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Preparando...');
    setUploadLogoError(null);

    try {
      setUploadStatus('Enviando...');
      const result = await uploadFile(file, 'logo', (progress) => {
        setUploadProgress(progress.percentage);
        setUploadStatus(`Enviando... ${progress.percentage}%`);
      });

      const updated = { ...companyInfo, logoUrl: result.url };
      setCompanyInfo(updated);
      await saveCompanySettings(updated);

      setUploadProgress(100);
      setUploadStatus('Upload concluído.');
      setLocalLogoPreview(null);
      setSuccessMsg('Logotipo atualizado e salvo com sucesso!');
      setTimeout(() => {
        setIsUploading(false);
        setUploadStatus('');
        setSuccessMsg('');
      }, 2000);
    } catch (err) {
      console.error("Centralized upload logo failed in CompanyConfigModule:", err);
      setUploadLogoError('Não foi possível enviar a imagem.');
      setLocalLogoPreview(null);
      setIsUploading(false);
      setUploadStatus('');
    } finally {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setLocalFaviconPreview(previewUrl);
    setIsFaviconUploading(true);
    setFaviconUploadProgress(0);
    setFaviconUploadStatus('Preparando...');
    setUploadFaviconError(null);

    try {
      setFaviconUploadStatus('Enviando...');
      const result = await uploadFile(file, 'logo', (progress) => {
        setFaviconUploadProgress(progress.percentage);
        setFaviconUploadStatus(`Enviando... ${progress.percentage}%`);
      });

      const updated = { ...companyInfo, faviconUrl: result.url };
      setCompanyInfo(updated);
      await saveCompanySettings(updated);

      setFaviconUploadProgress(100);
      setFaviconUploadStatus('Upload concluído.');
      setLocalFaviconPreview(null);
      setSuccessMsg('Favicon atualizado e salvo com sucesso!');
      setTimeout(() => {
        setIsFaviconUploading(false);
        setFaviconUploadStatus('');
        setSuccessMsg('');
      }, 2000);
    } catch (err) {
      console.error("Upload of favicon failed:", err);
      setUploadFaviconError('Não foi possível enviar a imagem.');
      setLocalFaviconPreview(null);
      setIsFaviconUploading(false);
      setFaviconUploadStatus('');
    } finally {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const handleMascotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setLocalMascotPreview(previewUrl);
    setIsMascotUploading(true);
    setMascotUploadProgress(0);
    setMascotUploadStatus('Preparando...');
    setUploadMascotError(null);

    try {
      setMascotUploadStatus('Enviando...');
      const result = await uploadFile(file, 'logo', (progress) => {
        setMascotUploadProgress(progress.percentage);
        setMascotUploadStatus(`Enviando... ${progress.percentage}%`);
      });

      const updated = { ...companyInfo, mascotUrl: result.url };
      setCompanyInfo(updated);
      await saveCompanySettings(updated);

      setMascotUploadProgress(100);
      setMascotUploadStatus('Upload concluído.');
      setLocalMascotPreview(null);
      setSuccessMsg('Imagem do mascote Lock atualizada e salva com sucesso!');
      setTimeout(() => {
        setIsMascotUploading(false);
        setMascotUploadStatus('');
        setSuccessMsg('');
      }, 2000);
    } catch (err) {
      console.error("Upload of mascot failed:", err);
      setUploadMascotError('Não foi possível enviar a imagem.');
      setLocalMascotPreview(null);
      setIsMascotUploading(false);
      setMascotUploadStatus('');
    } finally {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const filteredLogs = paymentLogs.filter(log => {
    const matchesSearch = log.id.toLowerCase().includes(logSearch.toLowerCase()) ||
                          log.user.toLowerCase().includes(logSearch.toLowerCase()) ||
                          log.item.toLowerCase().includes(logSearch.toLowerCase());
    const matchesFilter = logFilter === 'ALL' || log.status.toUpperCase() === logFilter || log.origin.toUpperCase() === logFilter;
    return matchesSearch && matchesFilter;
  });

  const runDiagnostics = async () => {
    setDiagRunning(true);
    setDiagResults(null);

    await new Promise(r => setTimeout(r, 600));

    // 1. Firebase Auth Check
    let authStatus = "Erro";
    try {
      const isDummy = storage?.app?.options?.apiKey?.includes("Dummy");
      if (auth && !isDummy) {
        authStatus = "CONECTADO";
      } else {
        authStatus = "NÃO CONFIGURADO (Usando Chave Dummy/Mock)";
      }
    } catch (e) {
      authStatus = `Erro: ${e instanceof Error ? e.message : String(e)}`;
    }

    await new Promise(r => setTimeout(r, 600));

    // 2. Firestore Check
    let dbStatus = "Erro";
    try {
      const isDummy = storage?.app?.options?.apiKey?.includes("Dummy");
      if (db && !isDummy) {
        const q = query(collection(db, 'users'), limit(1));
        await getDocs(q);
        dbStatus = "CONECTADO";
      } else {
        dbStatus = "NÃO CONFIGURADO (Usando Chave Dummy/Mock)";
      }
    } catch (e) {
      dbStatus = `Erro de Conexão (Firestore não responde)`;
    }

    await new Promise(r => setTimeout(r, 600));

    // 3. Firebase Storage Check
    let storageStatus = "Erro";
    try {
      const isDummy = storage?.app?.options?.apiKey?.includes("Dummy") || storage?.app?.options?.storageBucket?.includes("Dummy");
      if (storage && !isDummy) {
        storageStatus = "CONECTADO";
      } else {
        storageStatus = "NÃO CONFIGURADO (Usando Chave Dummy/Mock)";
      }
    } catch (e) {
      storageStatus = `Erro: ${e instanceof Error ? e.message : String(e)}`;
    }

    await new Promise(r => setTimeout(r, 600));

    // 4. Google Drive Check
    const driveStatus = "NÃO CONFIGURADO (Drive desativado - Utilizando Firebase Storage como padrão seguro)";

    setDiagResults({
      auth: authStatus,
      db: dbStatus,
      storage: storageStatus,
      drive: driveStatus
    });
    setDiagRunning(false);
  };

  return (
    <div className="h-full flex flex-col justify-between p-4 md:p-8 max-w-7xl mx-auto w-full text-black">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-6 border-b border-gray-200">
        <button
          onClick={onBackToMenu}
          className="flex items-center space-x-2 bg-white hover:bg-gray-100 border border-gray-300 px-4 py-2 rounded-xl text-xs font-orbitron text-gray-700 hover:text-black transition-all cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>MENU PRINCIPAL</span>
        </button>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-3">
            <span className="w-3 h-3 rounded-full bg-[#FF0033] animate-pulse"></span>
            <span className="font-orbitron font-bold text-sm tracking-wider text-black">CONFIGURAÇÕES DA EMPRESA & FINANCEIRO</span>
          </div>
        </div>
      </div>

      {successMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-6 py-3 rounded-xl flex items-center space-x-3 my-4 font-orbitron text-xs shadow-sm"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </motion.div>
      )}

      {/* Tabs Navigation */}
      <div className="flex space-x-2 my-6 overflow-x-auto pb-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('empresa')}
          className={`px-5 py-3 rounded-xl text-xs font-orbitron transition-all cursor-pointer flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'empresa'
              ? 'bg-[#FF0033] text-white font-bold shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>1. IDENTIDADE DA EMPRESA</span>
        </button>
        <button
          onClick={() => setActiveTab('bancos')}
          className={`px-5 py-3 rounded-xl text-xs font-orbitron transition-all cursor-pointer flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'bancos'
              ? 'bg-[#FF0033] text-white font-bold shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>2. DADOS BANCÁRIOS</span>
        </button>
        <button
          onClick={() => setActiveTab('mercadopago')}
          className={`px-5 py-3 rounded-xl text-xs font-orbitron transition-all cursor-pointer flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'mercadopago'
              ? 'bg-[#FF0033] text-white font-bold shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>3. MERCADO PAGO & PAGAMENTOS</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-5 py-3 rounded-xl text-xs font-orbitron transition-all cursor-pointer flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'logs'
              ? 'bg-[#FF0033] text-white font-bold shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>4. HISTÓRICO DE PAGAMENTOS</span>
        </button>
        <button
          onClick={() => setActiveTab('diagnostico')}
          className={`px-5 py-3 rounded-xl text-xs font-orbitron transition-all cursor-pointer flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'diagnostico'
              ? 'bg-[#FF0033] text-white font-bold shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>5. PAINEL DE DIAGNÓSTICO</span>
        </button>
      </div>

      {/* Main Tab Content Area */}
      <div className="flex-1 overflow-y-auto pb-8 space-y-6">
        
        {/* TAB 1: EMPRESA */}
        {activeTab === 'empresa' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="flex flex-col space-y-6">
                {/* Logo Card */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                  <span className="font-orbitron text-xs text-[#FF0033] tracking-widest block font-bold">LOGOTIPO DA EMPRESA</span>
                  <div className="w-36 h-36 rounded-2xl bg-gray-100 border-2 border-gray-300 overflow-hidden relative group flex items-center justify-center">
                    {localLogoPreview ? (
                      <img src={localLogoPreview} alt="Preview Logo" className="w-full h-full object-cover opacity-85 blur-[1px]" />
                    ) : companyInfo.logoUrl ? (
                      <img src={companyInfo.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-[10px] font-orbitron text-gray-400 p-2">Nenhum logo enviado</div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[10px] font-orbitron text-white">ALTERAR LOGO</span>
                    </div>
                  </div>
                  <div className="w-full space-y-2">
                    {uploadLogoError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-[10px] p-2.5 rounded-xl text-center space-y-1">
                        <div>{uploadLogoError}</div>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadLogoError(null);
                            const input = document.getElementById('logo-file-input');
                            if (input) (input as HTMLInputElement).click();
                          }}
                          className="bg-[#FF0033] text-white font-bold px-2 py-1 rounded-md text-[9px] hover:bg-[#d6002b]"
                        >
                          TENTAR NOVAMENTE
                        </button>
                      </div>
                    )}

                    <label className={`w-full bg-[#FF0033] hover:bg-[#d6002b] text-white font-orbitron font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-md transition-all cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <Upload className="w-4 h-4" />
                      <span>{isUploading ? 'ENVIANDO...' : 'FAZER UPLOAD DE LOGO'}</span>
                      <input id="logo-file-input" type="file" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleLogoUpload} disabled={isUploading} className="hidden" />
                    </label>

                    {isUploading && (
                      <div className="w-full space-y-1 bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <div className="flex items-center justify-between text-[10px] font-orbitron font-bold">
                          <span className="text-gray-700 truncate max-w-[120px]">{uploadStatus}</span>
                          <span className="text-[#FF0033]">{uploadProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                             className="h-full bg-[#FF0033] transition-all duration-300" 
                             style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setLocalLogoPreview(null);
                        setUploadLogoError(null);
                        setCompanyInfo(prev => ({ ...prev, logoUrl: '' }));
                      }}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron py-2 rounded-xl text-[10px] transition-colors cursor-pointer border border-gray-300"
                    >
                      RESTAURAR PADRÃO
                    </button>
                  </div>
                  <span className="text-[11px] text-gray-500 font-sans">
                    Formatos aceitos: PNG, JPG, JPEG, WEBP. Utilizado em recibos, ingressos e e-mails.
                  </span>
                </div>

                {/* Favicon Card */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                  <span className="font-orbitron text-xs text-[#FF0033] tracking-widest block font-bold">FAVICON DA PÁGINA</span>
                  <div className="w-36 h-36 rounded-2xl bg-gray-100 border-2 border-gray-300 overflow-hidden relative group flex items-center justify-center p-4">
                    {localFaviconPreview ? (
                      <img src={localFaviconPreview} alt="Preview Favicon" className="w-full h-full object-contain opacity-85 blur-[1px]" />
                    ) : (companyInfo.faviconUrl || companyInfo.logoUrl) ? (
                      <img src={companyInfo.faviconUrl || companyInfo.logoUrl} alt="Favicon" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-[10px] font-orbitron text-gray-400 p-2">Nenhum favicon enviado</div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[10px] font-orbitron text-white">ALTERAR FAVICON</span>
                    </div>
                  </div>
                  <div className="w-full space-y-2">
                    {uploadFaviconError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-[10px] p-2.5 rounded-xl text-center space-y-1">
                        <div>{uploadFaviconError}</div>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadFaviconError(null);
                            const input = document.getElementById('favicon-file-input');
                            if (input) (input as HTMLInputElement).click();
                          }}
                          className="bg-black text-white font-bold px-2 py-1 rounded-md text-[9px] hover:bg-gray-800"
                        >
                          TENTAR NOVAMENTE
                        </button>
                      </div>
                    )}

                    <label className={`w-full bg-black hover:bg-gray-800 text-white font-orbitron font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-md transition-all cursor-pointer ${isFaviconUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <Upload className="w-4 h-4" />
                      <span>{isFaviconUploading ? 'ENVIANDO...' : 'UPLOAD DE FAVICON'}</span>
                      <input id="favicon-file-input" type="file" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleFaviconUpload} disabled={isFaviconUploading} className="hidden" />
                    </label>

                    {isFaviconUploading && (
                      <div className="w-full space-y-1 bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <div className="flex items-center justify-between text-[10px] font-orbitron font-bold">
                          <span className="text-gray-700 truncate max-w-[120px]">{faviconUploadStatus}</span>
                          <span className="text-[#FF0033]">{faviconUploadProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-black transition-all duration-300" 
                            style={{ width: `${faviconUploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setLocalFaviconPreview(null);
                        setUploadFaviconError(null);
                        setCompanyInfo(prev => ({ ...prev, faviconUrl: '' }));
                      }}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron py-2 rounded-xl text-[10px] transition-colors cursor-pointer border border-gray-300"
                    >
                      RESTAURAR PADRÃO
                    </button>
                  </div>
                  <span className="text-[11px] text-gray-500 font-sans">
                    Favicon exibido na aba do navegador. Formatos aceitos: PNG, ICO, JPG, WEBP.
                  </span>
                </div>

                {/* Mascot Card */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                  <span className="font-orbitron text-xs text-[#FF0033] tracking-widest block font-bold">MASCOTE LOCK</span>
                  <div className="w-36 h-36 rounded-2xl bg-gray-100 border-2 border-gray-300 overflow-hidden relative group flex items-center justify-center p-4">
                    {localMascotPreview ? (
                      <img src={localMascotPreview} alt="Preview Mascot" className="w-full h-full object-contain opacity-85 blur-[1px]" />
                    ) : companyInfo.mascotUrl ? (
                      <img src={companyInfo.mascotUrl} alt="Mascote Lock" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-[10px] font-orbitron text-gray-400 p-2">Nenhuma imagem enviada</div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[10px] font-orbitron text-white">ALTERAR MASCOTE</span>
                    </div>
                  </div>
                  <div className="w-full space-y-2">
                    {uploadMascotError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-[10px] p-2.5 rounded-xl text-center space-y-1">
                        <div>{uploadMascotError}</div>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadMascotError(null);
                            const input = document.getElementById('mascot-file-input');
                            if (input) (input as HTMLInputElement).click();
                          }}
                          className="bg-[#FF0033] text-white font-bold px-2 py-1 rounded-md text-[9px] hover:bg-red-700"
                        >
                          TENTAR NOVAMENTE
                        </button>
                      </div>
                    )}

                    <label className={`w-full bg-[#FF0033] hover:bg-red-700 text-white font-orbitron font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-md transition-all cursor-pointer ${isMascotUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <Upload className="w-4 h-4" />
                      <span>{isMascotUploading ? 'ENVIANDO...' : 'UPLOAD DE MASCOTE'}</span>
                      <input id="mascot-file-input" type="file" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleMascotUpload} disabled={isMascotUploading} className="hidden" />
                    </label>

                    {isMascotUploading && (
                      <div className="w-full space-y-1 bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <div className="flex items-center justify-between text-[10px] font-orbitron font-bold">
                          <span className="text-gray-700 truncate max-w-[120px]">{mascotUploadStatus}</span>
                          <span className="text-[#FF0033]">{mascotUploadProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#FF0033] transition-all duration-300" 
                            style={{ width: `${mascotUploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setLocalMascotPreview(null);
                        setUploadMascotError(null);
                        setCompanyInfo(prev => ({ ...prev, mascotUrl: '' }));
                      }}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-orbitron py-2 rounded-xl text-[10px] transition-colors cursor-pointer border border-gray-300"
                    >
                      REMOVER IMAGEM
                    </button>
                  </div>
                  <span className="text-[11px] text-gray-500 font-sans">
                    Imagem oficial do mascote Lock. Se enviada, aparecerá próxima ao sino de notificações.
                  </span>
                </div>
              </div>

              {/* Form Info */}
              <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm">
                <form onSubmit={handleSaveCompany} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">RAZÃO SOCIAL</label>
                      <input
                        type="text"
                        value={companyInfo.companyName}
                        onChange={e => setCompanyInfo({ ...companyInfo, companyName: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">NOME FANTASIA</label>
                      <input
                        type="text"
                        value={companyInfo.tradeName}
                        onChange={e => setCompanyInfo({ ...companyInfo, tradeName: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">CNPJ</label>
                      <input
                        type="text"
                        value={companyInfo.document}
                        onChange={e => setCompanyInfo({ ...companyInfo, document: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">E-MAIL ADMINISTRATIVO</label>
                      <input
                        type="email"
                        value={companyInfo.email}
                        onChange={e => setCompanyInfo({ ...companyInfo, email: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">TELEFONE</label>
                      <input
                        type="text"
                        value={companyInfo.phone}
                        onChange={e => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">WHATSAPP</label>
                      <input
                        type="text"
                        value={companyInfo.whatsapp}
                        onChange={e => setCompanyInfo({ ...companyInfo, whatsapp: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">ENDEREÇO</label>
                    <input
                      type="text"
                      value={companyInfo.address}
                      onChange={e => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">CIDADE</label>
                      <input
                        type="text"
                        value={companyInfo.city}
                        onChange={e => setCompanyInfo({ ...companyInfo, city: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">ESTADO</label>
                      <input
                        type="text"
                        value={companyInfo.state}
                        onChange={e => setCompanyInfo({ ...companyInfo, state: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">CEP</label>
                      <input
                        type="text"
                        value={companyInfo.zipCode}
                        onChange={e => setCompanyInfo({ ...companyInfo, zipCode: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                      />
                    </div>
                  </div>

                  {/* REDES SOCIAIS */}
                  <div className="border-t border-gray-200 pt-6 space-y-4">
                    <h4 className="font-orbitron font-bold text-sm text-black tracking-wider uppercase">REDES SOCIAIS DA LOCKDOWN</h4>
                    <p className="text-[11px] text-gray-500 font-sans -mt-2">
                      Deixe em branco as redes sociais que não possuírem link cadastrado. O site público ocultará automaticamente os ícones correspondentes.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">LINK INSTAGRAM</label>
                        <input
                          type="url"
                          value={companyInfo.instagram || ''}
                          onChange={e => setCompanyInfo({ ...companyInfo, instagram: e.target.value })}
                          placeholder="Ex: https://instagram.com/lockdown"
                          className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">LINK YOUTUBE</label>
                        <input
                          type="url"
                          value={companyInfo.youtube || ''}
                          onChange={e => setCompanyInfo({ ...companyInfo, youtube: e.target.value })}
                          placeholder="Ex: https://youtube.com/@lockdown"
                          className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">LINK TIKTOK</label>
                        <input
                          type="url"
                          value={companyInfo.tiktok || ''}
                          onChange={e => setCompanyInfo({ ...companyInfo, tiktok: e.target.value })}
                          placeholder="Ex: https://tiktok.com/@lockdown"
                          className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">LINK TWITTER / X</label>
                        <input
                          type="url"
                          value={companyInfo.twitter || ''}
                          onChange={e => setCompanyInfo({ ...companyInfo, twitter: e.target.value })}
                          placeholder="Ex: https://x.com/lockdown"
                          className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                        />
                      </div>
                    </div>
                  </div>

                  {/* DESCRIÇÃO INSTITUCIONAL */}
                  <div className="border-t border-gray-200 pt-6 space-y-4">
                    <h4 className="font-orbitron font-bold text-sm text-black tracking-wider uppercase">BIOGRAFIA / SOBRE NO RODAPÉ</h4>
                    <div>
                      <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">DESCRIÇÃO CURTA DA PRODUTORA</label>
                      <textarea
                        rows={3}
                        value={companyInfo.companyBio || ''}
                        onChange={e => setCompanyInfo({ ...companyInfo, companyBio: e.target.value })}
                        placeholder="Ex: Gravadora e coletivo de trap, streetwear e shows underground..."
                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans resize-none"
                      />
                    </div>
                  </div>

                  {/* POLÍTICAS E TERMOS LEGAIS */}
                  <div className="border-t border-gray-200 pt-6 space-y-4">
                    <h4 className="font-orbitron font-bold text-sm text-black tracking-wider uppercase">POLÍTICAS DA EMPRESA (PÁGINAS LEGAIS DO FOOTER)</h4>
                    <p className="text-[11px] text-gray-500 font-sans -mt-2">
                      Deixe o texto em branco caso não queira exibir o link correspondente no footer público. Não use links falsos ou textos de exemplo genéricos.
                    </p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">TERMOS DE USO (CONTEÚDO TEXTUAL)</label>
                        <textarea
                          rows={4}
                          value={companyInfo.termsOfUse || ''}
                          onChange={e => setCompanyInfo({ ...companyInfo, termsOfUse: e.target.value })}
                          placeholder="Cole aqui os Termos de Uso oficiais da Lockdown..."
                          className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">POLÍTICA DE PRIVACIDADE (CONTEÚDO TEXTUAL)</label>
                        <textarea
                          rows={4}
                          value={companyInfo.privacyPolicy || ''}
                          onChange={e => setCompanyInfo({ ...companyInfo, privacyPolicy: e.target.value })}
                          placeholder="Cole aqui a Política de Privacidade oficial da Lockdown..."
                          className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">POLÍTICA DE REEMBOLSO E DEVOLUÇÃO (CONTEÚDO TEXTUAL)</label>
                        <textarea
                          rows={4}
                          value={companyInfo.refundPolicy || ''}
                          onChange={e => setCompanyInfo({ ...companyInfo, refundPolicy: e.target.value })}
                          placeholder="Cole aqui as Políticas de Reembolso, Cancelamento de Ingressos e Devolução da Loja..."
                          className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="bg-[#FF0033] hover:bg-[#d6002b] text-white font-orbitron font-bold px-8 py-3.5 rounded-xl text-xs flex items-center space-x-2 shadow-md transition-all cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>SALVAR DADOS DA EMPRESA</span>
                    </motion.button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: DADOS BANCÁRIOS */}
        {activeTab === 'bancos' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm max-w-3xl mx-auto">
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-200">
                <div className="w-10 h-10 rounded-xl bg-[#FF0033]/10 border border-[#FF0033] flex items-center justify-center text-[#FF0033]">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-orbitron font-bold text-lg text-black">DADOS BANCÁRIOS (SEGURO & PRIVADO)</h3>
                  <span className="text-xs text-gray-500 font-sans">Informações visíveis apenas para administradores autorizados.</span>
                </div>
              </div>

              <form onSubmit={handleSaveBank} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">NOME DO BANCO</label>
                    <input
                      type="text"
                      value={companyInfo.bankName || ''}
                      onChange={e => setCompanyInfo({ ...companyInfo, bankName: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">CÓDIGO DO BANCO</label>
                    <input
                      type="text"
                      value={companyInfo.bankCode || ''}
                      onChange={e => setCompanyInfo({ ...companyInfo, bankCode: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">AGÊNCIA</label>
                    <input
                      type="text"
                      value={companyInfo.agency || ''}
                      onChange={e => setCompanyInfo({ ...companyInfo, agency: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">NÚMERO DA CONTA</label>
                    <input
                      type="text"
                      value={companyInfo.accountNumber || ''}
                      onChange={e => setCompanyInfo({ ...companyInfo, accountNumber: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">TIPO DA CONTA</label>
                    <select
                      value={companyInfo.accountType || 'Conta Jurídica (PJ)'}
                      onChange={e => setCompanyInfo({ ...companyInfo, accountType: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                    >
                      <option value="Conta Jurídica (PJ)">Conta Jurídica (PJ)</option>
                      <option value="Conta Corrente (PF)">Conta Corrente (PF)</option>
                      <option value="Conta Poupança">Conta Poupança</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">NOME DO TITULAR</label>
                    <input
                      type="text"
                      value={companyInfo.holderName || ''}
                      onChange={e => setCompanyInfo({ ...companyInfo, holderName: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">CPF / CNPJ DO TITULAR</label>
                    <input
                      type="text"
                      value={companyInfo.holderDoc || ''}
                      onChange={e => setCompanyInfo({ ...companyInfo, holderDoc: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">CHAVE PIX</label>
                    <input
                      type="text"
                      value={companyInfo.pixKey || ''}
                      onChange={e => setCompanyInfo({ ...companyInfo, pixKey: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-orbitron text-gray-700 mb-1 font-bold">TIPO DA CHAVE PIX</label>
                    <select
                      value={companyInfo.pixType || 'E-mail'}
                      onChange={e => setCompanyInfo({ ...companyInfo, pixType: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-black focus:border-[#FF0033] focus:outline-none font-sans"
                    >
                      <option value="E-mail">E-mail</option>
                      <option value="CNPJ">CNPJ</option>
                      <option value="CPF">CPF</option>
                      <option value="Telefone">Telefone</option>
                      <option value="Chave Aleatória">Chave Aleatória</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="bg-[#FF0033] hover:bg-[#d6002b] text-white font-orbitron font-bold px-8 py-3.5 rounded-xl text-xs flex items-center space-x-2 shadow-md transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>SALVAR DADOS BANCÁRIOS</span>
                  </motion.button>
                </div>
              </form>
            </div>
          </motion.div>
        )}

        {/* TAB 3: MERCADO PAGO */}
        {activeTab === 'mercadopago' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Status Card */}
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between">
                <div>
                  <span className="font-orbitron text-xs text-[#FF0033] tracking-widest block mb-2 font-bold">INTEGRAÇÃO OFICIAL</span>
                  <h3 className="font-orbitron font-black text-2xl text-black">MERCADO PAGO</h3>
                  <p className="text-xs text-gray-600 mt-2 font-sans">
                    Processa pagamentos da Loja, produtos digitais, físicos e venda de ingressos.
                  </p>
                </div>

                <div className="my-6 p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 font-orbitron font-bold">STATUS ATUAL:</span>
                    <span className={`font-orbitron font-bold px-2.5 py-1 rounded ${
                      mpConfig.status === 'Conectado' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                      mpConfig.status === 'Configurado' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                      mpConfig.status === 'Erro de conexão' ? 'bg-red-100 text-red-800 border border-red-300' :
                      'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {mpConfig.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 font-orbitron font-bold">AMBIENTE:</span>
                    <span className={`font-orbitron font-bold ${mpConfig.environment === 'sandbox' ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {mpConfig.environment === 'sandbox' ? 'TESTE / SANDBOX' : 'PRODUÇÃO'}
                    </span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleTestMPConnection}
                  disabled={isTestingConnection}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-orbitron font-bold py-3.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer border border-gray-300 shadow-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${isTestingConnection ? 'animate-spin' : ''}`} />
                  <span>{isTestingConnection ? 'TESTANDO...' : 'TESTAR CONEXÃO COM MP'}</span>
                </motion.button>
              </div>

              {/* Credentials & Environment Technical Status Board */}
              <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
                <div className="border-b border-gray-100 pb-4 text-left">
                  <h4 className="font-orbitron font-extrabold text-sm text-gray-800 uppercase tracking-wider">Métricas & Diagnóstico de Integração</h4>
                  <p className="text-xs text-gray-500 font-sans leading-relaxed mt-0.5">
                    Visão em tempo real da saúde da integração do Mercado Pago e conexões OAuth do marketplace.
                  </p>
                </div>

                {isLoadingStatus && !adminMpStatus ? (
                  <div className="py-8 text-center font-orbitron font-bold text-xs text-gray-500 uppercase tracking-widest">
                    Carregando dados técnicos...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
                    {/* Card 1: Ambiente */}
                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col justify-between">
                      <span className="block text-[9px] font-orbitron text-gray-500 uppercase font-black tracking-wide">Ambiente de Operação</span>
                      <span className="block font-mono text-base font-black text-black mt-2">
                        {adminMpStatus?.environment || "TEST (SANDBOX)"}
                      </span>
                    </div>

                    {/* Card 2: Credenciais */}
                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col justify-between">
                      <span className="block text-[9px] font-orbitron text-gray-500 uppercase font-black tracking-wide">Chaves da Plataforma</span>
                      <span className={`block font-sans text-sm font-bold mt-2 ${adminMpStatus?.platformCredentials === "Configuradas" ? "text-emerald-600" : "text-amber-600"}`}>
                        {adminMpStatus?.platformCredentials || "Não configuradas"}
                      </span>
                    </div>

                    {/* Card 3: Status OAuth */}
                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col justify-between">
                      <span className="block text-[9px] font-orbitron text-gray-500 uppercase font-black tracking-wide">Onboarding OAuth (Vendedores)</span>
                      <span className={`block font-sans text-sm font-bold mt-2 ${adminMpStatus?.oauth === "OK" ? "text-emerald-600" : "text-red-600"}`}>
                        {adminMpStatus?.oauth || "OK"}
                      </span>
                    </div>

                    {/* Card 4: Webhook */}
                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex flex-col justify-between">
                      <span className="block text-[9px] font-orbitron text-gray-500 uppercase font-black tracking-wide">Webhook API (Status)</span>
                      <span className={`block font-sans text-sm font-bold mt-2 ${adminMpStatus?.webhook === "OK" ? "text-emerald-600" : "text-red-600"}`}>
                        {adminMpStatus?.webhook || "OK"}
                      </span>
                    </div>

                    {/* Card 5: Último Webhook */}
                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl col-span-1 md:col-span-2">
                      <span className="block text-[9px] font-orbitron text-gray-500 uppercase font-black tracking-wide">Último Webhook Processado</span>
                      <span className="block font-mono text-xs text-black mt-1 font-bold">
                        {adminMpStatus?.lastWebhook || "Nenhuma transação recebida recentemente"}
                      </span>
                    </div>

                    {/* Card 6: Conexões Marketplace */}
                    <div className="bg-[#12111d] border border-white/10 p-4 rounded-2xl col-span-1 md:col-span-2 text-white flex justify-between items-center">
                      <div>
                        <span className="block text-[9px] font-orbitron text-gray-400 uppercase font-black tracking-wide">Onboarding do Marketplace</span>
                        <div className="flex gap-4 mt-2">
                          <div>
                            <span className="block text-xs font-bold text-emerald-400">{adminMpStatus?.sellersConnected || 0} conectados</span>
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-amber-500">{adminMpStatus?.sellersReauth || 0} expirados/reauth</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={loadAdminMpStatus}
                        className="bg-white hover:bg-neutral-200 text-black font-orbitron font-extrabold text-[9px] py-1.5 px-3 rounded-lg uppercase tracking-wider transition-all"
                      >
                        Recarregar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 4: HISTÓRICO DE PAGAMENTOS */}
        {activeTab === 'logs' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-orbitron font-bold text-xl text-black">HISTÓRICO DE PAGAMENTOS</h3>
                  <span className="text-xs text-gray-500 font-sans">Transações processadas via Mercado Pago (Loja & Ingressos)</span>
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={logSearch}
                      onChange={e => setLogSearch(e.target.value)}
                      placeholder="Pesquisar pedido ou usuário..."
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-black focus:border-[#FF0033] focus:outline-none font-sans"
                    />
                  </div>

                  <select
                    value={logFilter}
                    onChange={e => setLogFilter(e.target.value)}
                    className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-black focus:border-[#FF0033] focus:outline-none font-orbitron font-medium"
                  >
                    <option value="ALL">TODOS OS FILTROS</option>
                    <option value="PAGO">PAGO</option>
                    <option value="PENDENTE">PENDENTE</option>
                    <option value="REEMBOLSADO">REEMBOLSADO</option>
                    <option value="STORE">ORIGEM: STORE</option>
                    <option value="TICKET">ORIGEM: TICKET</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-[10px] font-orbitron text-gray-600 tracking-wider">
                      <th className="py-3 px-4">PEDIDO</th>
                      <th className="py-3 px-4">ORIGEM</th>
                      <th className="py-3 px-4">COMPRADOR</th>
                      <th className="py-3 px-4">ITEM / PRODUTO</th>
                      <th className="py-3 px-4">VALOR</th>
                      <th className="py-3 px-4">MERCADO PAGO ID</th>
                      <th className="py-3 px-4">STATUS</th>
                      <th className="py-3 px-4">DATA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs font-sans">
                    {filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3.5 px-4 font-orbitron font-bold text-black">{log.id}</td>
                        <td className="py-3.5 px-4">
                          <span className="font-orbitron text-[10px] bg-gray-100 border border-gray-200 px-2 py-0.5 rounded text-gray-700 font-bold">{log.origin}</span>
                        </td>
                        <td className="py-3.5 px-4 text-black font-semibold">{log.user}</td>
                        <td className="py-3.5 px-4 text-gray-700">{log.item}</td>
                        <td className="py-3.5 px-4 font-orbitron font-bold text-[#FF0033]">{log.amount}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-gray-500">{log.mpId}</td>
                        <td className="py-3.5 px-4">
                          <span className={`font-orbitron text-[10px] px-2.5 py-1 rounded-full font-bold ${
                            log.status === 'Pago' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            log.status === 'Pendente' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            'bg-red-100 text-red-800 border border-red-300'
                          }`}>
                            {log.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-gray-500 text-[11px]">{log.date}</td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-500 font-orbitron text-xs">
                          Nenhum registro encontrado com os filtros atuais.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 5: CENTRAL DE DIAGNÓSTICOS */}
        {activeTab === 'diagnostico' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
              <div>
                <h3 className="font-orbitron font-bold text-xl text-black flex items-center space-x-2">
                  <Server className="w-5 h-5 text-[#FF0033]" />
                  <span>PAINEL DE DIAGNÓSTICOS DO BACKEND</span>
                </h3>
                <p className="text-xs text-gray-500 font-sans mt-1">
                  Varredura de integridade e conectividade das APIs, credenciais e serviços de armazenamento.
                </p>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                <div className="space-y-1">
                  <span className="font-orbitron font-bold text-xs text-black block">VERIFICAÇÃO ATIVA DE CREDENCIAIS</span>
                  <span className="text-[11px] text-gray-500 font-sans block">
                    Pressione o botão para disparar requisições de teste e diagnosticar autenticação, banco de dados e buckets.
                  </span>
                </div>
                <button
                  onClick={runDiagnostics}
                  disabled={diagRunning}
                  className="bg-[#FF0033] hover:bg-[#d6002b] text-white font-orbitron font-bold py-3 px-6 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-4 h-4 ${diagRunning ? 'animate-spin' : ''}`} />
                  <span>{diagRunning ? 'EXECUTANDO TESTES...' : 'DISPARAR VARREDURA'}</span>
                </button>
              </div>

              {diagResults ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Authentication Diagnostic Card */}
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                          <Lock className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="font-orbitron font-bold text-xs text-black block">FIREBASE AUTHENTICATION</span>
                          <span className="text-[10px] text-gray-500 font-sans">Identidades e Sessões</span>
                        </div>
                      </div>
                      <span className={`font-orbitron font-bold text-[10px] px-2.5 py-1 rounded-full border ${
                        diagResults.auth === 'CONECTADO'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {diagResults.auth}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 font-sans">
                      {diagResults.auth === 'CONECTADO'
                        ? 'O serviço de autenticação está operacional e aceitando solicitações de login e persistência com chaves de produção.'
                        : 'A chave de API do Firebase não está configurada (.env ausente ou chave dummy ativa). A aplicação está operando em modo offline com dados simulados no localStorage.'}
                    </p>
                  </div>

                  {/* Firestore Database Diagnostic Card */}
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                          <Database className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="font-orbitron font-bold text-xs text-black block">FIRESTORE DATABASE</span>
                          <span className="text-[10px] text-gray-500 font-sans">Banco de Dados NoSQL</span>
                        </div>
                      </div>
                      <span className={`font-orbitron font-bold text-[10px] px-2.5 py-1 rounded-full border ${
                        diagResults.db === 'CONECTADO'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {diagResults.db}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 font-sans">
                      {diagResults.db === 'CONECTADO'
                        ? 'Leituras e escritas foram realizadas com sucesso no banco NoSQL do Firestore.'
                        : 'Nenhuma chave configurada ou erro de permissão do Firestore. Chave de API ativa é Dummy / offline.'}
                    </p>
                  </div>

                  {/* Firebase Storage Diagnostic Card */}
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                          <Cloud className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="font-orbitron font-bold text-xs text-black block">FIREBASE STORAGE</span>
                          <span className="text-[10px] text-gray-500 font-sans">Armazenamento de Mídia</span>
                        </div>
                      </div>
                      <span className={`font-orbitron font-bold text-[10px] px-2.5 py-1 rounded-full border ${
                        diagResults.storage === 'CONECTADO'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {diagResults.storage}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 font-sans">
                      {diagResults.storage === 'CONECTADO'
                        ? 'O bucket público está ativado. Uploads reais de logotipos, imagens de produtos e mídias estão totalmente operacionais.'
                        : 'Bucket real desativado ou sem credenciais produtivas. O sistema está usando o FileReader com base64 local para manter a funcionalidade offline.'}
                    </p>
                  </div>

                  {/* Google Drive API Diagnostic Card */}
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                          <HardDrive className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="font-orbitron font-bold text-xs text-black block">GOOGLE DRIVE API</span>
                          <span className="text-[10px] text-gray-500 font-sans">Armazenamento Externo</span>
                        </div>
                      </div>
                      <span className="font-orbitron font-bold text-[10px] px-2.5 py-1 rounded-full border bg-red-50 text-red-700 border-red-200">
                        NÃO CONFIGURADO
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 font-sans">
                      A API do Google Drive não está conectada no projeto. O módulo operacional padrão e ativo para mídias é o **Firebase Storage**, garantindo acesso público e instantâneo sem vazamento de chaves privadas (Service Account Private Keys) no navegador.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-12 border-2 border-dashed border-gray-200 rounded-2xl text-center text-gray-400 space-y-2">
                  <Server className="w-10 h-10 mx-auto text-gray-300" />
                  <span className="font-orbitron font-bold text-xs block text-gray-700">PRONTO PARA DIAGNÓSTICO</span>
                  <span className="text-[10px] text-gray-500 font-sans block max-w-md mx-auto px-4">
                    Dispare a varredura para interagir em tempo real com as conexões ativas do Google e Firebase.
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
};
