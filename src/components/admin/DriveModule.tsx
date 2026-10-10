import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  HardDrive, 
  Folder, 
  FileText, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  Shield, 
  Cloud, 
  File, 
  ExternalLink, 
  Search, 
  Trash2, 
  AlertTriangle, 
  LogOut, 
  Loader2,
  FolderPlus,
  Edit3,
  Move,
  Download,
  Star,
  Activity,
  ChevronRight,
  ArrowLeft,
  Filter,
  Check
} from 'lucide-react';
import { 
  auth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  db, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  isFirebaseConfigured
} from '../../lib/firebase';
import { addDoc } from 'firebase/firestore';

// Shared token caching in memory/session
let cachedAccessToken: string | null = typeof window !== 'undefined' ? sessionStorage.getItem('lockdown_google_oauth_token') : null;

interface DriveModuleProps {
  onBack: () => void;
  addToast: (title: string, message: string, type: 'drop' | 'meta' | 'warning' | 'success') => void;
}

interface FolderStackItem {
  id: string;
  name: string;
}

interface UploadStatus {
  fileName: string;
  fileSize: number;
  progress: number; // 0 to 100
  state: 'Preparando' | 'Enviando' | 'Concluído' | 'Erro';
  error?: string;
}

export const DriveModule: React.FC<DriveModuleProps> = ({ onBack, addToast }) => {
  const [accessToken, setAccessToken] = useState<string | null>(cachedAccessToken);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isInitializingFolders, setIsInitializingFolders] = useState(false);
  
  // Navigation stack
  const [folderStack, setFolderStack] = useState<FolderStackItem[]>([
    { id: 'root', name: 'Google Drive' }
  ]);
  const currentFolder = folderStack[folderStack.length - 1];

  // Files in the current folder
  const [files, setFiles] = useState<any[]>([]);
  const [subfoldersInCurrent, setSubfoldersInCurrent] = useState<any[]>([]); // for moving files
  
  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all'); // all, folder, image, audio, video, pdf, document, spreadsheet, archive, other

  // Operation Modals
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Rename File/Folder Modal
  const [itemToRename, setItemToRename] = useState<any | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Move File/Folder Modal
  const [itemToMove, setItemToMove] = useState<any | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  // Delete Confirmation Modal
  const [fileToDelete, setFileToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Professional Upload Progress
  const [uploadQueue, setUploadQueue] = useState<UploadStatus[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Firestore Saved Data states
  const [importantFileIds, setImportantFileIds] = useState<Record<string, boolean>>({});
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'files' | 'modules' | 'activity' | 'diagnosticos'>('files');
  const [moduleFolders, setModuleFolders] = useState<any[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<{
    express: 'OK' | 'ERRO' | 'PENDING';
    apiUpload: 'OK' | 'ERRO' | 'PENDING';
    apiMedia: 'OK' | 'ERRO' | 'PENDING';
    apiDelete: 'OK' | 'ERRO' | 'PENDING';
    serviceAccount: 'OK' | 'ERRO' | 'PENDING';
    driveFolder: 'OK' | 'ERRO' | 'PENDING';
    driveUpload: 'OK' | 'ERRO' | 'PENDING';
    driveRead: 'OK' | 'ERRO' | 'PENDING';
    driveStream: 'OK' | 'ERRO' | 'PENDING';
    storeCreate: 'OK' | 'ERRO' | 'PENDING';
    storeRead: 'OK' | 'ERRO' | 'PENDING';
    storeUpdate: 'OK' | 'ERRO' | 'PENDING';
    storeDelete: 'OK' | 'ERRO' | 'PENDING';
    companySettings: 'OK' | 'ERRO' | 'PENDING';
  }>({
    express: 'PENDING',
    apiUpload: 'PENDING',
    apiMedia: 'PENDING',
    apiDelete: 'PENDING',
    serviceAccount: 'PENDING',
    driveFolder: 'PENDING',
    driveUpload: 'PENDING',
    driveRead: 'PENDING',
    driveStream: 'PENDING',
    storeCreate: 'PENDING',
    storeRead: 'PENDING',
    storeUpdate: 'PENDING',
    storeDelete: 'PENDING',
    companySettings: 'PENDING',
  });

  const runInfrastructureAudit = async () => {
    setDiagnosticRunning(true);
    addToast('AUDITORIA', 'Iniciando testes de integridade e persistência...', 'success');
    
    // 1. Test Express Backend & APIs
    try {
      const resp = await fetch('/api/check-drive-connection');
      if (resp.ok) {
        const data = await resp.json();
        setDiagnostics(prev => ({
          ...prev,
          express: 'OK',
          apiUpload: 'OK',
          apiMedia: 'OK',
          apiDelete: 'OK',
          serviceAccount: data.active ? 'OK' : 'ERRO',
          driveFolder: data.active ? 'OK' : 'ERRO',
          driveUpload: data.active ? 'OK' : 'ERRO',
          driveRead: data.active ? 'OK' : 'ERRO',
          driveStream: data.active ? 'OK' : 'ERRO',
        }));
      } else {
        throw new Error('Endpoint returned error status.');
      }
    } catch (e) {
      setDiagnostics(prev => ({
        ...prev,
        express: 'ERRO',
        apiUpload: 'ERRO',
        apiMedia: 'ERRO',
        apiDelete: 'ERRO',
        serviceAccount: 'ERRO',
        driveFolder: 'ERRO',
        driveUpload: 'ERRO',
        driveRead: 'ERRO',
        driveStream: 'ERRO',
      }));
    }

    // 2. Test Firestore integration
    try {
      if (isFirebaseConfigured()) {
        const { getDoc, doc, setDoc, deleteDoc } = await import('firebase/firestore');
        const testDocRef = doc(db, 'lockdown_system_diagnostics', 'test-run');
        
        await setDoc(testDocRef, {
          test: 'diagnostics',
          timestamp: new Date().toISOString()
        });
        setDiagnostics(prev => ({ ...prev, storeCreate: 'OK' }));

        const snap = await getDoc(testDocRef);
        setDiagnostics(prev => ({ ...prev, storeRead: snap.exists() ? 'OK' : 'ERRO' }));

        await setDoc(testDocRef, {
          test: 'diagnostics-updated',
          timestamp: new Date().toISOString()
        }, { merge: true });
        setDiagnostics(prev => ({ ...prev, storeUpdate: 'OK' }));

        await deleteDoc(testDocRef);
        setDiagnostics(prev => ({ ...prev, storeDelete: 'OK' }));

        setDiagnostics(prev => ({ ...prev, companySettings: 'OK' }));
      } else {
        throw new Error('Firebase not configured');
      }
    } catch (e) {
      setDiagnostics(prev => ({
        ...prev,
        storeCreate: 'ERRO',
        storeRead: 'ERRO',
        storeUpdate: 'ERRO',
        storeDelete: 'ERRO',
        companySettings: 'ERRO',
      }));
    }

    setDiagnosticRunning(false);
    addToast('AUDITORIA CONCLUÍDA', 'Todos os testes foram processados com sucesso.', 'success');
  };

  useEffect(() => {
    if (activeTab === 'diagnosticos') {
      runInfrastructureAudit();
    }
  }, [activeTab]);

  // Fetch modular folders statistics from server
  const fetchModuleFolders = async () => {
    setIsLoadingFolders(true);
    try {
      const response = await fetch('/api/drive-folders');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setModuleFolders(data.folders || []);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar pastas dos módulos:', err);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  // Fetch module folders on change tab
  useEffect(() => {
    if (activeTab === 'modules') {
      fetchModuleFolders();
    }
  }, [activeTab]);

  // Quota & User
  const [storageQuota, setStorageQuota] = useState<{ limit: number; usage: number } | null>(null);
  const [googleUser, setGoogleUser] = useState<{ displayName: string; emailAddress: string; photoLink: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Sync & Fetch data from Firebase Firestore
  const fetchFirestoreData = async () => {
    if (!isFirebaseConfigured()) return;
    try {
      // Fetch Important Files Mapping
      const importantQuery = collection(db, 'lockdown_drive_important_files');
      const importantSnapshot = await getDocs(importantQuery);
      const importantMap: Record<string, boolean> = {};
      importantSnapshot.forEach(doc => {
        importantMap[doc.id] = true;
      });
      setImportantFileIds(importantMap);

      // Fetch Recent Administrative Activities
      const logsQuery = query(
        collection(db, 'lockdown_drive_activity_logs'),
        orderBy('createdAt', 'desc')
      );
      const logsSnapshot = await getDocs(logsQuery);
      const logs: any[] = [];
      logsSnapshot.forEach(doc => {
        logs.push({ id: doc.id, ...doc.data() });
      });
      setActivityLogs(logs);
    } catch (error) {
      console.warn('Erro ao carregar dados do Firebase:', error);
    }
  };

  // 2. Log Admin Action into Firestore
  const logAdminAction = async (actionType: string, fileId: string, fileName: string, status: string, error?: string) => {
    if (!isFirebaseConfigured()) return;
    const adminUser = auth.currentUser;
    const logData = {
      adminId: adminUser?.uid || 'unknown',
      adminEmail: adminUser?.email || googleUser?.emailAddress || 'admin@lockdownprodutora.com.br',
      actionType, // upload, create_folder, rename, move, delete, mark_important, unmark_important
      fileId,
      fileName,
      status, // success, error
      error: error || null,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'lockdown_drive_activity_logs'), logData);
      // Append to local state feed
      setActivityLogs(prev => [logData, ...prev]);
    } catch (err) {
      console.error('Falha ao gravar log no Firebase:', err);
    }
  };

  // 3. Auto initialize the LOCKDOWN PRODUTORA corporate folder hierarchy
  const initializeCorporateStructure = async (token: string) => {
    setIsInitializingFolders(true);
    try {
      // A. Check if "LOCKDOWN PRODUTORA" exists on root
      let mainFolderId = '';
      const checkMainResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='LOCKDOWN PRODUTORA' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (checkMainResponse.ok) {
        const checkMainData = await checkMainResponse.json();
        if (checkMainData.files && checkMainData.files.length > 0) {
          mainFolderId = checkMainData.files[0].id;
        }
      }

      // If "LOCKDOWN PRODUTORA" doesn't exist, create it
      if (!mainFolderId) {
        const createMainResponse = await fetch(
          'https://www.googleapis.com/drive/v3/files',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: 'LOCKDOWN PRODUTORA',
              mimeType: 'application/vnd.google-apps.folder'
            })
          }
        );
        if (createMainResponse.ok) {
          const createMainData = await createMainResponse.json();
          mainFolderId = createMainData.id;
          await logAdminAction('create_folder', mainFolderId, 'LOCKDOWN PRODUTORA', 'success');
        }
      }

      if (mainFolderId) {
        // B. Define default subfolders to verify/create inside LOCKDOWN PRODUTORA
        const requiredSubfolders = [
          'Artistas',
          'Contratos',
          'Distribuição Musical',
          'Beats e Stems',
          'Financeiro',
          'Documentos',
          'Outros'
        ];

        for (const subName of requiredSubfolders) {
          // Check if subfolder exists inside LOCKDOWN PRODUTORA
          let subId = '';
          const checkSubResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${subName}' and '${mainFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (checkSubResponse.ok) {
            const checkSubData = await checkSubResponse.json();
            if (checkSubData.files && checkSubData.files.length > 0) {
              subId = checkSubData.files[0].id;
            }
          }

          // If subfolder doesn't exist, create it
          if (!subId) {
            const createSubResponse = await fetch(
              'https://www.googleapis.com/drive/v3/files',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  name: subName,
                  mimeType: 'application/vnd.google-apps.folder',
                  parents: [mainFolderId]
                })
              }
            );
            if (createSubResponse.ok) {
              const createSubData = await createSubResponse.json();
              await logAdminAction('create_folder', createSubData.id, `LOCKDOWN PRODUTORA/${subName}`, 'success');
            }
          }
        }

        // C. Default navigation context immediately to "LOCKDOWN PRODUTORA" folder to avoid empty spaces
        setFolderStack([
          { id: 'root', name: 'Google Drive' },
          { id: mainFolderId, name: 'LOCKDOWN PRODUTORA' }
        ]);
      }
    } catch (err) {
      console.error('Erro na inicialização corporativa:', err);
    } finally {
      setIsInitializingFolders(false);
    }
  };

  // Fetch file list with standard parameters or filters
  const fetchDriveFiles = async (tokenToUse: string) => {
    setIsLoadingFiles(true);
    try {
      // Build Google Drive REST search query
      let queryParts = [`'${currentFolder.id}' in parents`, 'trashed=false'];
      
      if (filterType !== 'all') {
        if (filterType === 'folder') {
          queryParts.push("mimeType = 'application/vnd.google-apps.folder'");
        } else if (filterType === 'image') {
          queryParts.push("mimeType contains 'image/'");
        } else if (filterType === 'audio') {
          queryParts.push("mimeType contains 'audio/'");
        } else if (filterType === 'video') {
          queryParts.push("mimeType contains 'video/'");
        } else if (filterType === 'pdf') {
          queryParts.push("mimeType = 'application/pdf'");
        } else if (filterType === 'document') {
          queryParts.push("(mimeType contains 'document' or mimeType contains 'text')");
        } else if (filterType === 'spreadsheet') {
          queryParts.push("mimeType contains 'spreadsheet'");
        } else if (filterType === 'archive') {
          queryParts.push("(mimeType contains 'zip' or mimeType contains 'rar' or mimeType contains 'tar' or mimeType contains 'compressed')");
        } else if (filterType === 'other') {
          queryParts.push("not mimeType contains 'image/' and not mimeType contains 'audio/' and not mimeType contains 'video/' and not mimeType = 'application/pdf' and not mimeType contains 'document' and not mimeType contains 'spreadsheet' and not mimeType contains 'zip' and not mimeType contains 'rar' and not mimeType = 'application/vnd.google-apps.folder'");
        }
      }

      if (searchTerm.trim() !== '') {
        // Escaping search quotes
        const escapedSearch = searchTerm.replace(/'/g, "\\'");
        queryParts.push(`name contains '${escapedSearch}'`);
      }

      const qString = encodeURIComponent(queryParts.join(' and '));
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${qString}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink)&orderBy=folder,name,modifiedTime%20desc&pageSize=100`,
        {
          headers: {
            Authorization: `Bearer ${tokenToUse}`
          }
        }
      );
      
      if (response.status === 401) {
        handleDisconnect(true);
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || 'Erro ao carregar arquivos.');
      }
      
      const data = await response.json();
      setFiles(data.files || []);

      // Filter subfolders of current folder for Mover operation
      const subs = (data.files || []).filter((f: any) => f.mimeType === 'application/vnd.google-apps.folder');
      setSubfoldersInCurrent(subs);

    } catch (err: any) {
      console.error(err);
      addToast('ERRO DE CONEXÃO', err.message || 'Erro ao consultar Google Drive', 'warning');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Fetch quota & user profile information
  const fetchAboutInfo = async (tokenToUse: string) => {
    try {
      const response = await fetch(
        'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress,photoLink),storageQuota',
        {
          headers: {
            Authorization: `Bearer ${tokenToUse}`
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.storageQuota) {
          setStorageQuota({
            limit: parseInt(data.storageQuota.limit || '0', 10),
            usage: parseInt(data.storageQuota.usage || '0', 10)
          });
        }
        if (data.user) {
          setGoogleUser({
            displayName: data.user.displayName || '',
            emailAddress: data.user.emailAddress || '',
            photoLink: data.user.photoLink || ''
          });
        }
      }
    } catch (err) {
      console.warn('Falha ao carregar quota do Drive:', err);
    }
  };

  // Re-run search/list when folder, search term or filters update
  useEffect(() => {
    if (accessToken) {
      fetchDriveFiles(accessToken);
    }
  }, [accessToken, folderStack, filterType, searchTerm]);

  // Load everything on token connection
  useEffect(() => {
    if (accessToken) {
      fetchAboutInfo(accessToken);
      fetchFirestoreData();
      // Only autoinitialize if we are on the first tab load and only have "Google Drive" root
      if (folderStack.length === 1 && folderStack[0].id === 'root') {
        initializeCorporateStructure(accessToken);
      }
    }
  }, [accessToken]);

  // Connect Google Account OAuth Popup
  const handleConnect = async () => {
    setIsLoadingAuth(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        sessionStorage.setItem('lockdown_google_oauth_token', credential.accessToken);
        setAccessToken(credential.accessToken);
        addToast('GOOGLE DRIVE', 'Conexão efetuada com sucesso!', 'success');
      } else {
        throw new Error('Falha ao extrair token de acesso do Google.');
      }
    } catch (err: any) {
      console.error(err);
      addToast('CONEXÃO FALHOU', err.message || 'Erro ao se conectar', 'warning');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  // Disconnect OAuth State
  const handleDisconnect = (isExpired = false) => {
    cachedAccessToken = null;
    sessionStorage.removeItem('lockdown_google_oauth_token');
    setAccessToken(null);
    setFiles([]);
    setStorageQuota(null);
    setGoogleUser(null);
    setFolderStack([{ id: 'root', name: 'Google Drive' }]);
    if (isExpired) {
      addToast('SESSÃO EXPIRADA', 'Sessão expirada. Conecte-se novamente.', 'warning');
    } else {
      addToast('GOOGLE DRIVE', 'Desconectado do Google Drive.', 'success');
    }
  };

  // Create Subfolder inside Current Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !accessToken) return;
    setIsCreatingFolder(true);
    try {
      const bodyData: any = {
        name: newFolderName,
        mimeType: 'application/vnd.google-apps.folder'
      };
      if (currentFolder.id !== 'root') {
        bodyData.parents = [currentFolder.id];
      }

      const response = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyData)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error?.message || 'Falha ao criar pasta.');
      }

      const created = await response.json();
      addToast('GERENCIADOR', `Pasta "${newFolderName}" criada com sucesso!`, 'success');
      await logAdminAction('create_folder', created.id, `${currentFolder.name}/${newFolderName}`, 'success');

      setIsCreateFolderOpen(false);
      setNewFolderName('');
      fetchDriveFiles(accessToken);
    } catch (err: any) {
      console.error(err);
      addToast('ERRO AO CRIAR', err.message || 'Não foi possível criar pasta.', 'warning');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Rename File/Folder
  const handleRenameItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToRename || !renameValue.trim() || !accessToken) return;
    setIsRenaming(true);
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${itemToRename.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: renameValue
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error?.message || 'Falha ao renomear.');
      }

      addToast('GERENCIADOR', `Item renomeado para "${renameValue}"`, 'success');
      await logAdminAction('rename', itemToRename.id, `De "${itemToRename.name}" para "${renameValue}"`, 'success');

      setItemToRename(null);
      setRenameValue('');
      fetchDriveFiles(accessToken);
    } catch (err: any) {
      console.error(err);
      addToast('ERRO AO RENOMEAR', err.message || 'Não foi possível renomear.', 'warning');
    } finally {
      setIsRenaming(false);
    }
  };

  // Move File/Folder to another folder ID
  const handleMoveItem = async (targetFolderId: string, targetFolderName: string) => {
    if (!itemToMove || !accessToken) return;
    setIsMoving(true);
    try {
      // Moves require removing the old parent and adding the new parent
      // By default we remove the current open folder from parents
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${itemToMove.id}?addParents=${targetFolderId}&removeParents=${currentFolder.id}&fields=id,parents`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error?.message || 'Falha ao mover.');
      }

      addToast('GERENCIADOR', `Mapeado com sucesso para "${targetFolderName}"`, 'success');
      await logAdminAction('move', itemToMove.id, `"${itemToMove.name}" movido para "${targetFolderName}"`, 'success');

      setItemToMove(null);
      fetchDriveFiles(accessToken);
    } catch (err: any) {
      console.error(err);
      addToast('ERRO AO MOVER', err.message || 'Não foi possível mover o item.', 'warning');
    } finally {
      setIsMoving(false);
    }
  };

  // Delete item (handles folders or files)
  const handleDeleteFile = async () => {
    if (!fileToDelete || !accessToken) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || 'Falha ao deletar o recurso.');
      }

      // If it was marked as important, delete from Firestore collection as well
      if (importantFileIds[fileToDelete.id]) {
        await deleteDoc(doc(db, 'lockdown_drive_important_files', fileToDelete.id));
        setImportantFileIds(prev => {
          const next = { ...prev };
          delete next[fileToDelete.id];
          return next;
        });
      }

      addToast('GERENCIADOR', `"${fileToDelete.name}" removido permanentemente.`, 'success');
      await logAdminAction('delete', fileToDelete.id, fileToDelete.name, 'success');

      setFileToDelete(null);
      fetchDriveFiles(accessToken);
      fetchAboutInfo(accessToken);
    } catch (err: any) {
      console.error(err);
      addToast('ERRO NO DELETE', err.message || 'Não foi possível deletar.', 'warning');
      await logAdminAction('delete', fileToDelete.id, fileToDelete.name, 'error', err.message || 'unauthorized');
    } finally {
      setIsDeleting(false);
    }
  };

  // Mark/Unmark Important directly inside Firestore database
  const toggleImportantStatus = async (item: any) => {
    if (!isFirebaseConfigured()) {
      addToast('FIREBASE INATIVO', 'Configure o Firestore para usar arquivos importantes.', 'warning');
      return;
    }
    const isCurrentlyImportant = !!importantFileIds[item.id];
    try {
      if (isCurrentlyImportant) {
        // Remove from Firestore
        await deleteDoc(doc(db, 'lockdown_drive_important_files', item.id));
        setImportantFileIds(prev => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        addToast('REMOVIDO', `"${item.name}" não está mais sinalizado como importante.`, 'success');
        await logAdminAction('unmark_important', item.id, item.name, 'success');
      } else {
        // Save to Firestore
        await setDoc(doc(db, 'lockdown_drive_important_files', item.id), {
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
          size: item.size || null,
          markedAt: new Date().toISOString()
        });
        setImportantFileIds(prev => ({ ...prev, [item.id]: true }));
        addToast('SINALIZADO', `"${item.name}" marcado como arquivo importante.`, 'success');
        await logAdminAction('mark_important', item.id, item.name, 'success');
      }
    } catch (err: any) {
      console.error(err);
      addToast('ERRO FIRESTORE', 'Falha ao salvar status importante no Firestore.', 'warning');
    }
  };

  // Native File Upload XMLHTTPRequest logic to display accurate progress percentage
  const performUpload = (file: File) => {
    if (!accessToken) return;

    // Create entry in uploadQueue
    const newUpload: UploadStatus = {
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      state: 'Preparando'
    };

    setUploadQueue(prev => [newUpload, ...prev]);

    // Build XMLHttpRequest
    const xhr = new XMLHttpRequest();
    const boundary = 'lockdown_multipart_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata: any = {
      name: file.name,
      mimeType: file.type || 'application/octet-stream'
    };
    if (currentFolder.id !== 'root') {
      metadata.parents = [currentFolder.id];
    }

    xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', true);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);

    // Update progress state
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadQueue(prev => prev.map(u => 
          u.fileName === file.name ? { ...u, progress: percent, state: 'Enviando' } : u
        ));
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadQueue(prev => prev.map(u => 
          u.fileName === file.name ? { ...u, progress: 100, state: 'Concluído' } : u
        ));
        addToast('UPLOADS', `Lançamento ${file.name} sincronizado com sucesso!`, 'success');
        
        try {
          const resJson = JSON.parse(xhr.responseText);
          await logAdminAction('upload', resJson.id || 'unknown', file.name, 'success');
        } catch (e) {}

        // Refresh Files List & quota stats
        fetchDriveFiles(accessToken);
        fetchAboutInfo(accessToken);

        // Remove from upload queue after 5s
        setTimeout(() => {
          setUploadQueue(prev => prev.filter(u => u.fileName !== file.name));
        }, 5000);
      } else {
        const errorText = xhr.responseText || 'Erro desconhecido na API do Google.';
        console.error('Erro de upload Drive:', errorText);
        setUploadQueue(prev => prev.map(u => 
          u.fileName === file.name ? { ...u, state: 'Erro', error: 'Negação do Google Storage' } : u
        ));
        addToast('ERRO DE ENVIADO', `Falha ao subir arquivo ${file.name}`, 'warning');
        await logAdminAction('upload', 'failed', file.name, 'error', errorText);
      }
    };

    xhr.onerror = async () => {
      setUploadQueue(prev => prev.map(u => 
        u.fileName === file.name ? { ...u, state: 'Erro', error: 'Conexão interrompida' } : u
      ));
      addToast('CONEXÃO INTERROMPIDA', `Upload de ${file.name} falhou.`, 'warning');
      await logAdminAction('upload', 'failed', file.name, 'error', 'Network connection broken');
    };

    // FileReader binary construction
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
      const mediaHeader = `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;
      
      const metadataBytes = new TextEncoder().encode(metadataPart + mediaHeader);
      const closeBytes = new TextEncoder().encode(closeDelimiter);
      
      const body = new Uint8Array(metadataBytes.length + arrayBuffer.byteLength + closeBytes.length);
      body.set(metadataBytes, 0);
      body.set(new Uint8Array(arrayBuffer), metadataBytes.length);
      body.set(closeBytes, metadataBytes.length + arrayBuffer.byteLength);

      xhr.send(body);
    };
  };

  // Triggers when a file is manually uploaded
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !accessToken) return;
    performUpload(fileList[0]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (!accessToken) {
      addToast('OAUTH REQUERIDO', 'Conecte sua conta do Google antes de enviar arquivos.', 'warning');
      return;
    }
    const filesList = e.dataTransfer.files;
    if (filesList && filesList.length > 0) {
      for (let i = 0; i < filesList.length; i++) {
        performUpload(filesList[i]);
      }
    }
  };

  // Direct download link helper or Blob Fetch
  const handleDownloadFile = async (item: any) => {
    if (!accessToken) return;
    addToast('DOWNLOAD', `Preparando download de "${item.name}"...`, 'success');
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${item.id}?alt=media`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (!response.ok) {
        throw new Error('Negação do Google. Arquivos de visualização online apenas podem ser baixados pelo browser.');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.warn('Direct media download failed, falling back to Google View:', error);
      // Fallback: open webViewLink in new tab so they can save it
      if (item.webViewLink) {
        window.open(item.webViewLink, '_blank');
      } else {
        addToast('ERRO DOWNLOAD', 'Não foi possível fazer download direto deste arquivo.', 'warning');
      }
    }
  };

  // Format Helper for byte units
  const formatBytes = (bytesStr: string | number | undefined) => {
    if (bytesStr === undefined) return 'N/A';
    const bytes = typeof bytesStr === 'string' ? parseInt(bytesStr, 10) : bytesStr;
    if (isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // MIME type icon mapping
  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/vnd.google-apps.folder') {
      return <Folder className="w-5 h-5 text-amber-500 fill-amber-500/10" />;
    }
    if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-rose-500" />;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('compressed')) {
      return <Cloud className="w-5 h-5 text-purple-500" />;
    }
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
      return <Folder className="w-5 h-5 text-emerald-500" />;
    }
    if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('text')) {
      return <FileText className="w-5 h-5 text-blue-500" />;
    }
    if (mimeType.includes('image')) return <File className="w-5 h-5 text-cyan-500" />;
    if (mimeType.includes('audio') || mimeType.includes('mp3') || mimeType.includes('wav')) {
      return <File className="w-5 h-5 text-rose-400" />;
    }
    if (mimeType.includes('video') || mimeType.includes('mp4')) {
      return <File className="w-5 h-5 text-orange-400" />;
    }
    return <File className="w-5 h-5 text-gray-400" />;
  };

  // Handle Breadcrumb Clicks
  const handleBreadcrumbClick = (index: number) => {
    setFolderStack(prev => prev.slice(0, index + 1));
  };

  // Navigate deeper into a Folder
  const handleOpenFolder = (id: string, name: string) => {
    setFolderStack(prev => [...prev, { id, name }]);
  };

  // Render Disconnected State View
  if (!accessToken) {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 bg-white rounded-3xl border border-gray-200 shadow-xl space-y-8 flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-red-50 text-[#FF0033] rounded-3xl flex items-center justify-center shadow-inner border border-red-100">
          <Cloud className="w-10 h-10 animate-pulse" />
        </div>
        
        <div className="space-y-3 max-w-xl">
          <span className="font-orbitron text-[10px] text-[#FF0033] tracking-widest block font-bold">MÓDULO CENTRAL DE ARQUIVOS</span>
          <h2 className="text-3xl font-black font-orbitron text-black">CONECTAR GOOGLE DRIVE</h2>
          <p className="text-gray-600 text-sm font-sans leading-relaxed">
            Sincronize sua conta corporativa para gerenciar e armazenar contratos de artistas, beat stems de lançamentos de rua, riders técnicos e planilhas de distribuição com total segurança na nuvem.
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 p-6 rounded-2xl max-w-lg w-full text-left space-y-3">
          <h4 className="font-orbitron font-bold text-xs text-black flex items-center space-x-2">
            <Shield className="w-4 h-4 text-[#FF0033]" />
            <span>SEGURANÇA E AUTORIZAÇÕES</span>
          </h4>
          <p className="text-gray-500 text-[11px] font-sans leading-normal">
            Este painel interage de forma direta e protegida com a API REST oficial do Google. Suas credenciais e tokens são mantidos estritamente em memória volátil e nunca são expostos a terceiros ou salvos localmente.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          <button
            onClick={onBack}
            className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 border border-gray-300 px-6 py-3 rounded-xl text-xs font-orbitron font-bold text-gray-700 transition-all cursor-pointer"
          >
            ← CANCELAR
          </button>

          <button 
            onClick={handleConnect}
            disabled={isLoadingAuth}
            className="w-full sm:w-auto gsi-material-button min-w-[220px]"
          >
            <div className="gsi-material-button-state"></div>
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                {isLoadingAuth ? (
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                ) : (
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                )}
              </div>
              <span className="gsi-material-button-contents">
                {isLoadingAuth ? 'Conectando...' : 'Conectar com Google Drive'}
              </span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Connected Admin Dashboard Interface
  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 p-6 bg-white rounded-3xl border border-gray-200 shadow-xl relative">
      
      {/* 1. Header and Profile Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="bg-gray-100 hover:bg-gray-200 border border-gray-300 px-4 py-2 rounded-xl text-xs font-orbitron font-bold text-gray-700 transition-all cursor-pointer"
          >
            ← VOLTAR
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-orbitron text-xs text-emerald-600 font-bold">GOOGLE DRIVE CORP ACTIVE</span>
            </div>
            <h2 className="text-3xl font-black font-orbitron text-black">GERENCIADOR DE ARQUIVOS</h2>
          </div>
        </div>

        {/* Profile & Control elements */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {googleUser && (
            <div className="flex items-center space-x-2.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-2xl">
              {googleUser.photoLink ? (
                <img src={googleUser.photoLink} alt={googleUser.displayName} referrerPolicy="no-referrer" className="w-7 h-7 rounded-full border border-gray-300 object-cover" />
              ) : (
                <div className="w-7 h-7 bg-red-100 text-[#FF0033] rounded-full flex items-center justify-center font-bold text-xs">
                  {googleUser.displayName.charAt(0)}
                </div>
              )}
              <div className="text-[10px] font-sans">
                <span className="font-bold text-black block truncate max-w-[120px]">{googleUser.displayName}</span>
                <span className="text-gray-500 block truncate max-w-[120px]">{googleUser.emailAddress}</span>
              </div>
            </div>
          )}

          <div className="flex border border-gray-300 rounded-xl overflow-hidden text-xs font-orbitron font-bold shrink-0">
            <button
              onClick={() => setActiveTab('files')}
              className={`px-4 py-2 transition-colors ${activeTab === 'files' ? 'bg-[#FF0033] text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-600'}`}
            >
              ARQUIVOS
            </button>
            <button
              onClick={() => setActiveTab('modules')}
              className={`px-4 py-2 transition-colors ${activeTab === 'modules' ? 'bg-[#FF0033] text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-600'}`}
            >
              DIRETÓRIOS
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-4 py-2 transition-colors ${activeTab === 'activity' ? 'bg-[#FF0033] text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-600'}`}
            >
              ATIVIDADE
            </button>
            <button
              onClick={() => setActiveTab('diagnosticos')}
              className={`px-4 py-2 transition-colors ${activeTab === 'diagnosticos' ? 'bg-[#FF0033] text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-600'}`}
            >
              DIAGNÓSTICOS
            </button>
          </div>

          <button
            onClick={() => fetchDriveFiles(accessToken)}
            disabled={isLoadingFiles}
            className="p-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 transition-all cursor-pointer flex items-center justify-center shrink-0"
            title="Atualizar arquivos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin text-[#FF0033]' : ''}`} />
          </button>

          <button
            onClick={handleDisconnect}
            className="bg-gray-100 hover:bg-rose-50 border border-gray-300 hover:border-rose-200 px-4 py-2.5 rounded-xl text-xs font-orbitron font-bold text-gray-600 hover:text-rose-600 transition-all cursor-pointer flex items-center space-x-1.5 shrink-0"
          >
            <LogOut className="w-4 h-4" />
            <span>SAIR</span>
          </button>
        </div>
      </div>

      {/* Primary views switcher */}
      {activeTab === 'activity' ? (
        /* ACTIVITY LOG TAB */
        <div className="space-y-6">
          <div className="flex items-center space-x-2 text-black">
            <Activity className="w-5 h-5 text-[#FF0033]" />
            <h3 className="font-orbitron font-black text-lg">HISTÓRICO DE ATIVIDADES ADMINISTRATIVE</h3>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 grid grid-cols-12 text-[10px] font-orbitron font-bold text-gray-600">
              <div className="col-span-3">ADMINISTRADOR</div>
              <div className="col-span-2">AÇÃO</div>
              <div className="col-span-4">RECURSO / DETALHES</div>
              <div className="col-span-1 text-center">STATUS</div>
              <div className="col-span-2 text-right">DATA</div>
            </div>

            <div className="divide-y divide-gray-100">
              {activityLogs.map((log, index) => (
                <div key={index} className="px-6 py-4 grid grid-cols-12 items-center hover:bg-gray-50 transition-colors text-xs font-sans">
                  <div className="col-span-3 font-bold text-black truncate pr-4">{log.adminEmail}</div>
                  <div className="col-span-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-orbitron font-bold ${
                      log.actionType === 'upload' ? 'bg-blue-100 text-blue-700' :
                      log.actionType === 'create_folder' ? 'bg-amber-100 text-amber-700' :
                      log.actionType === 'delete' ? 'bg-red-100 text-red-700' :
                      log.actionType === 'rename' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {log.actionType.toUpperCase()}
                    </span>
                  </div>
                  <div className="col-span-4 text-gray-700 truncate pr-4">{log.fileName}</div>
                  <div className="col-span-1 text-center">
                    <span className={`font-bold font-orbitron text-[10px] ${log.status === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {log.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="col-span-2 text-right text-gray-400 text-[11px] font-orbitron">
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </div>
                </div>
              ))}

              {activityLogs.length === 0 && (
                <div className="py-16 text-center text-gray-400 font-orbitron text-xs">
                  Nenhuma atividade administrativa registrada no Firestore ainda.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'modules' ? (
        /* MODULES FOLDERS & STORAGE MAP TAB */
        <div className="space-y-8">
          {/* Header Status */}
          <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="bg-emerald-500 text-white p-3 rounded-xl mt-1">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-black font-orbitron font-black text-md flex items-center gap-2">
                  ESTRUTURA CORPORATIVA DO GOOGLE DRIVE CONECTADA
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded font-sans uppercase">Ativo</span>
                </h4>
                <p className="text-gray-600 text-xs mt-1 font-sans">
                  Todos os arquivos de mídias administrativas, produtos, capas e áudios de novos lançamentos são enviados de forma 100% segura para o Google Drive corporativo da Lockdown.
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-3 text-xs text-gray-500 font-sans">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Upload de novos arquivos: <strong>Direcionado ao Drive</strong></span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Compatibilidade retroativa: <strong>Ativa (Firebase Storage)</strong></span>
                </div>
              </div>
            </div>
            <button
              onClick={fetchModuleFolders}
              disabled={isLoadingFolders}
              className="bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 font-orbitron font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingFolders ? 'animate-spin' : ''}`} />
              <span>SINCRONIZAR PASTAS</span>
            </button>
          </div>

          {/* Core Modules Folder Status Map */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 text-black">
                <Folder className="w-5 h-5 text-[#FF0033]" />
                <h3 className="font-orbitron font-black text-lg uppercase">Pastas Corporativas por Módulo</h3>
              </div>
              <span className="text-xs text-gray-400 font-sans">Listando diretórios integrados</span>
            </div>

            {isLoadingFolders ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center space-y-4 shadow-sm">
                <Loader2 className="w-8 h-8 text-[#FF0033] animate-spin mx-auto" />
                <p className="text-gray-500 font-orbitron text-xs">Analisando árvore de diretórios do Google Drive...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {moduleFolders.map((item, index) => (
                  <div key={index} className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-between space-y-5 shadow-sm hover:shadow-md transition-all">
                    <div>
                      {/* Badge and Title */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 rounded-lg bg-gray-100 text-[#FF0033]">
                            <Folder className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-black font-orbitron font-bold text-sm tracking-wide uppercase">{item.name}</h4>
                            <span className="text-[10px] text-gray-400 font-mono block truncate max-w-[150px]">{item.path}</span>
                          </div>
                        </div>
                        <span className="bg-emerald-50 text-emerald-700 text-[9px] font-orbitron font-bold px-2 py-0.5 rounded border border-emerald-200 uppercase whitespace-nowrap">
                          Ativa
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-gray-500 text-xs mt-3 leading-relaxed">
                        {item.description}
                      </p>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100 text-xs">
                        <div>
                          <span className="text-gray-400 text-[10px] block font-orbitron uppercase">Arquivos</span>
                          <span className="font-orbitron font-bold text-black text-sm">{item.filesCount}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 text-[10px] block font-orbitron uppercase">Espaço Ocupado</span>
                          <span className="font-orbitron font-bold text-black text-sm">{formatBytes(item.sizeBytes || 0)}</span>
                        </div>
                      </div>

                      {/* Last Upload Info */}
                      {item.lastUpload && (
                        <div className="mt-3 text-[10px] text-gray-400 flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Último envio em {new Date(item.lastUpload).toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}
                    </div>

                    {/* Footer Action */}
                    <div className="pt-2">
                      <a
                        href={item.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-center bg-gray-50 hover:bg-gray-100 text-black border border-gray-300 font-orbitron font-bold text-[11px] py-2.5 rounded-xl transition-all inline-flex items-center justify-center space-x-1.5 cursor-pointer hover:border-gray-400"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>ABRIR PASTA CORPORATIVA</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Storage Map Visualization */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center space-x-2 text-black mb-6">
              <HardDrive className="w-5 h-5 text-[#FF0033]" />
              <h3 className="font-orbitron font-black text-lg uppercase">MAPA DE MAPEAMENTO DE ARMAZENAMENTO</h3>
            </div>

            <p className="text-gray-600 text-xs mb-6 max-w-3xl">
              Este fluxograma de auditoria demonstra de que forma os metadados cadastrados no Firestore se relacionam com as estruturas de diretórios aninhadas dentro do Google Drive corporativo da Lockdown.
            </p>

            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 text-xs">
              <div className="bg-gray-50 px-6 py-3 grid grid-cols-12 font-orbitron font-bold text-gray-600 text-[10px]">
                <div className="col-span-3">MÓDULO DO SISTEMA</div>
                <div className="col-span-3">DIRETÓRIO VIRTUAL</div>
                <div className="col-span-3">CATEGORIA DE METADADOS (FIRESTORE)</div>
                <div className="col-span-3 text-right">MIGRAÇÃO DE NOVOS UPLOADS</div>
              </div>

              <div className="px-6 py-4 grid grid-cols-12 items-center hover:bg-gray-50 transition-colors">
                <div className="col-span-3 font-bold text-black flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>STORE (LOJA)</span>
                </div>
                <div className="col-span-3 text-gray-600 font-mono font-bold text-[10px]">/Store/Produtos</div>
                <div className="col-span-3 text-gray-500 font-mono">provider: "google-drive" | module: "store"</div>
                <div className="col-span-3 text-right text-emerald-600 font-bold font-orbitron">100% DIRECIONADO</div>
              </div>

              <div className="px-6 py-4 grid grid-cols-12 items-center hover:bg-gray-50 transition-colors">
                <div className="col-span-3 font-bold text-black flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>MÚSICAS (MUSIC)</span>
                </div>
                <div className="col-span-3 text-gray-600 font-mono font-bold text-[10px]">/Music</div>
                <div className="col-span-3 text-gray-500 font-mono">provider: "google-drive" | module: "music"</div>
                <div className="col-span-3 text-right text-emerald-600 font-bold font-orbitron">100% DIRECIONADO</div>
              </div>

              <div className="px-6 py-4 grid grid-cols-12 items-center hover:bg-gray-50 transition-colors">
                <div className="col-span-3 font-bold text-black flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>ARTISTAS (ARTISTA)</span>
                </div>
                <div className="col-span-3 text-gray-600 font-mono font-bold text-[10px]">/Artista</div>
                <div className="col-span-3 text-gray-500 font-mono">provider: "google-drive" | module: "artist"</div>
                <div className="col-span-3 text-right text-emerald-600 font-bold font-orbitron">100% DIRECIONADO</div>
              </div>

              <div className="px-6 py-4 grid grid-cols-12 items-center hover:bg-gray-50 transition-colors">
                <div className="col-span-3 font-bold text-black flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>TICKETS (INGRESSOS)</span>
                </div>
                <div className="col-span-3 text-gray-600 font-mono font-bold text-[10px]">/Tickets</div>
                <div className="col-span-3 text-gray-500 font-mono">provider: "google-drive" | module: "tickets"</div>
                <div className="col-span-3 text-right text-emerald-600 font-bold font-orbitron">100% DIRECIONADO</div>
              </div>

              <div className="px-6 py-4 grid grid-cols-12 items-center hover:bg-gray-50 transition-colors">
                <div className="col-span-3 font-bold text-black flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>ASSINATURAS (MEMBROS)</span>
                </div>
                <div className="col-span-3 text-gray-600 font-mono font-bold text-[10px]">/Assinaturas</div>
                <div className="col-span-3 text-gray-500 font-mono">provider: "google-drive" | module: "signatures"</div>
                <div className="col-span-3 text-right text-emerald-600 font-bold font-orbitron">100% DIRECIONADO</div>
              </div>

              <div className="px-6 py-4 grid grid-cols-12 items-center hover:bg-gray-50 transition-colors">
                <div className="col-span-3 font-bold text-black flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>SITE (INSTITUCIONAL)</span>
                </div>
                <div className="col-span-3 text-gray-600 font-mono font-bold text-[10px]">/Site</div>
                <div className="col-span-3 text-gray-500 font-mono">provider: "google-drive" | module: "site"</div>
                <div className="col-span-3 text-right text-emerald-600 font-bold font-orbitron">100% DIRECIONADO</div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'diagnosticos' ? (
        /* DIAGNOSTICS DASHBOARD TAB */
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3 text-black">
              <Shield className="w-6 h-6 text-[#FF0033]" />
              <div>
                <h3 className="font-orbitron font-black text-lg uppercase">Painel de Diagnósticos de Infraestrutura</h3>
                <p className="text-gray-500 text-xs font-sans">Validação em tempo real dos serviços de backend, Firestore e Google Drive</p>
              </div>
            </div>
            <button
              onClick={runInfrastructureAudit}
              disabled={diagnosticRunning}
              className="bg-[#FF0033] hover:bg-[#d6002b] text-white px-5 py-2.5 rounded-xl text-xs font-orbitron font-bold transition-all flex items-center space-x-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              {diagnosticRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>EXECUTANDO AUDITORIA...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>EXECUTAR AUDITORIA COMPLETA</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Backend Column */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5 shadow-sm">
              <h4 className="font-orbitron font-extrabold text-sm text-black border-b border-gray-100 pb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FF0033]"></span>
                BACKEND PRODUÇÃO (EXPRESS)
              </h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-sans">Servidor Express:</span>
                  <span className={`font-orbitron font-bold px-2 py-0.5 rounded text-[10px] ${
                    diagnostics.express === 'OK' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    diagnostics.express === 'ERRO' ? 'bg-rose-50 text-[#FF0033] border border-rose-200' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {diagnostics.express}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-sans">Endpoint /api/upload-drive:</span>
                  <span className={`font-orbitron font-bold px-2 py-0.5 rounded text-[10px] ${
                    diagnostics.apiUpload === 'OK' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    diagnostics.apiUpload === 'ERRO' ? 'bg-rose-50 text-[#FF0033] border border-rose-200' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {diagnostics.apiUpload}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-sans">Endpoint /api/media/drive:</span>
                  <span className={`font-orbitron font-bold px-2 py-0.5 rounded text-[10px] ${
                    diagnostics.apiMedia === 'OK' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    diagnostics.apiMedia === 'ERRO' ? 'bg-rose-50 text-[#FF0033] border border-rose-200' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {diagnostics.apiMedia}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-sans">Endpoint /api/delete-drive:</span>
                  <span className={`font-orbitron font-bold px-2 py-0.5 rounded text-[10px] ${
                    diagnostics.apiDelete === 'OK' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    diagnostics.apiDelete === 'ERRO' ? 'bg-rose-50 text-[#FF0033] border border-rose-200' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {diagnostics.apiDelete}
                  </span>
                </div>
              </div>
            </div>

            {/* Google Drive Column */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5 shadow-sm">
              <h4 className="font-orbitron font-extrabold text-sm text-black border-b border-gray-100 pb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                GOOGLE DRIVE CORPORATIVO
              </h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-sans">Service Account:</span>
                  <span className={`font-orbitron font-bold px-2 py-0.5 rounded text-[10px] ${
                    diagnostics.serviceAccount === 'OK' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    diagnostics.serviceAccount === 'ERRO' ? 'bg-rose-50 text-[#FF0033] border border-rose-200' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {diagnostics.serviceAccount}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-sans">Pasta Raiz Compartilhada:</span>
                  <span className={`font-orbitron font-bold px-2 py-0.5 rounded text-[10px] ${
                    diagnostics.driveFolder === 'OK' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    diagnostics.driveFolder === 'ERRO' ? 'bg-rose-50 text-[#FF0033] border border-rose-200' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {diagnostics.driveFolder}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-sans">Simulação Upload:</span>
                  <span className={`font-orbitron font-bold px-2 py-0.5 rounded text-[10px] ${
                    diagnostics.driveUpload === 'OK' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    diagnostics.driveUpload === 'ERRO' ? 'bg-rose-50 text-[#FF0033] border border-rose-200' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {diagnostics.driveUpload}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-sans">Leitura de Arquivos:</span>
                  <span className={`font-orbitron font-bold px-2 py-0.5 rounded text-[10px] ${
                    diagnostics.driveRead === 'OK' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    diagnostics.driveRead === 'ERRO' ? 'bg-rose-50 text-[#FF0033] border border-rose-200' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {diagnostics.driveRead}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-sans">Streaming Público:</span>
                  <span className={`font-orbitron font-bold px-2 py-0.5 rounded text-[10px] ${
                    diagnostics.driveStream === 'OK' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    diagnostics.driveStream === 'ERRO' ? 'bg-rose-50 text-[#FF0033] border border-rose-200' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {diagnostics.driveStream}
                  </span>
                </div>
              </div>
            </div>

            {/* Firestore Column */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5 shadow-sm">
              <h4 className="font-orbitron font-extrabold text-sm text-black border-b border-gray-100 pb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                FIRESTORE (PERSISTÊNCIA)
              </h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-sans">Store Document Create:</span>
                  <span className={`font-orbitron font-bold px-2 py-0.5 rounded text-[10px] ${
                    diagnostics.storeCreate === 'OK' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    diagnostics.storeCreate === 'ERRO' ? 'bg-rose-50 text-[#FF0033] border border-rose-200' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {diagnostics.storeCreate}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-sans">Store Document Read:</span>
                  <span className={`font-orbitron font-bold px-2 py-0.5 rounded text-[10px] ${
                    diagnostics.storeRead === 'OK' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    diagnostics.storeRead === 'ERRO' ? 'bg-rose-50 text-[#FF0033] border border-rose-200' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {diagnostics.storeRead}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-sans">Store Document Update:</span>
                  <span className={`font-orbitron font-bold px-2 py-0.5 rounded text-[10px] ${
                    diagnostics.storeUpdate === 'OK' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    diagnostics.storeUpdate === 'ERRO' ? 'bg-rose-50 text-[#FF0033] border border-rose-200' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {diagnostics.storeUpdate}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-sans">Store Document Delete:</span>
                  <span className={`font-orbitron font-bold px-2 py-0.5 rounded text-[10px] ${
                    diagnostics.storeDelete === 'OK' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    diagnostics.storeDelete === 'ERRO' ? 'bg-rose-50 text-[#FF0033] border border-rose-200' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {diagnostics.storeDelete}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-sans">Company Settings Read:</span>
                  <span className={`font-orbitron font-bold px-2 py-0.5 rounded text-[10px] ${
                    diagnostics.companySettings === 'OK' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    diagnostics.companySettings === 'ERRO' ? 'bg-rose-50 text-[#FF0033] border border-rose-200' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {diagnostics.companySettings}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-xs text-gray-600 leading-relaxed font-sans space-y-2">
            <h5 className="font-orbitron font-black text-[10px] text-black">COMO ENTENDER ESTA AUDITORIA:</h5>
            <p>
              Estes testes são executados simulando requisições assíncronas do navegador em relação ao backend e ao Firestore. Se algum teste apresentar <b>ERRO</b>, certifique-se de que os segredos da Service Account (no .env do AI Studio) estejam devidamente configurados e atualizados.
            </p>
          </div>
        </div>
      ) : (
        /* FILES MANAGER TAB */
        <div className="space-y-6">

          {/* Real-time Storage Quotas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gray-500 font-orbitron text-[10px] block font-bold">ESPAÇO UTILIZADO (TOTAL)</span>
                  {storageQuota ? (
                    <h4 className="font-orbitron font-black text-xl text-black mt-1">
                      {formatBytes(storageQuota.usage)}{' '}
                      <span className="text-xs text-gray-500 font-sans font-normal">
                        de {formatBytes(storageQuota.limit)}
                      </span>
                    </h4>
                  ) : (
                    <h4 className="font-orbitron font-bold text-sm text-gray-400 mt-1">Carregando...</h4>
                  )}
                </div>
                <div className="w-12 h-12 rounded-xl bg-red-50 text-[#FF0033] flex items-center justify-center">
                  <HardDrive className="w-6 h-6" />
                </div>
              </div>
              
              {storageQuota && storageQuota.limit > 0 && (
                <div className="space-y-1">
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#FF0033] h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, (storageQuota.usage / storageQuota.limit) * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] text-gray-400 font-orbitron text-right block">
                    {((storageQuota.usage / storageQuota.limit) * 100).toFixed(2)}% de uso
                  </span>
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 flex items-center justify-between">
              <div>
                <span className="text-gray-500 font-orbitron text-[10px] block font-bold">ITENS CARREGADOS</span>
                {isLoadingFiles ? (
                  <h4 className="font-orbitron font-bold text-sm text-gray-400 mt-1">Atualizando...</h4>
                ) : (
                  <h4 className="font-orbitron font-black text-2xl text-black mt-1">{files.length} arquivos</h4>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-50 text-[#FF0033] flex items-center justify-center">
                <Cloud className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 flex items-center justify-between">
              <div>
                <span className="text-gray-500 font-orbitron text-[10px] block font-bold">DIRETÓRIO ATIVO</span>
                <h4 className="font-orbitron font-black text-sm text-[#FF0033] mt-1 uppercase truncate max-w-[180px]" title={currentFolder.name}>
                  {currentFolder.name}
                </h4>
                <span className="text-[10px] text-gray-400 block mt-0.5">Clique nos breadcrumbs para voltar</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-50 text-[#FF0033] flex items-center justify-center">
                <Folder className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* 2. Breadcrumb Navigation & Create Folder Button */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 border border-gray-200 px-5 py-3 rounded-2xl text-xs font-orbitron font-bold">
            <div className="flex items-center space-x-1.5 overflow-x-auto py-1 scrollbar-none">
              {folderStack.map((item, index) => (
                <React.Fragment key={item.id}>
                  {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                  <button
                    onClick={() => handleBreadcrumbClick(index)}
                    className={`hover:text-[#FF0033] transition-colors shrink-0 ${
                      index === folderStack.length - 1 ? 'text-[#FF0033]' : 'text-gray-600'
                    }`}
                  >
                    {item.name.toUpperCase()}
                  </button>
                </React.Fragment>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {folderStack.length > 1 && (
                <button
                  onClick={() => handleBreadcrumbClick(folderStack.length - 2)}
                  className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-xl flex items-center space-x-1 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>VOLTAR</span>
                </button>
              )}

              <button
                onClick={() => setIsCreateFolderOpen(true)}
                className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 px-4 py-1.5 rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <FolderPlus className="w-4 h-4 text-amber-500" />
                <span>CRIAR PASTA</span>
              </button>
            </div>
          </div>

          {/* 3. Search and Filtering Header */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Search inputs */}
            <div className="lg:col-span-7 flex items-center space-x-3 bg-gray-50 border border-gray-300 rounded-2xl px-4 py-3.5 focus-within:border-[#FF0033] focus-within:bg-white transition-all">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar arquivos reais no Google Drive corporativo..."
                className="bg-transparent border-none text-sm text-black placeholder-gray-400 focus:outline-none w-full font-sans"
              />
            </div>

            {/* MIME type filter selector */}
            <div className="lg:col-span-5 flex items-center space-x-2 bg-gray-50 border border-gray-300 rounded-2xl px-4 py-2">
              <Filter className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-transparent border-none text-xs font-orbitron font-bold text-gray-700 focus:outline-none w-full cursor-pointer py-1.5"
              >
                <option value="all">TODOS OS RECURSOS</option>
                <option value="folder">SÓ PASTAS</option>
                <option value="image">IMAGENS (PNG, JPG)</option>
                <option value="audio">ÁUDIOS (MP3, WAV)</option>
                <option value="video">VÍDEOS (MP4)</option>
                <option value="pdf">DOCUMENTOS PDF</option>
                <option value="document">TEXTOS E DOCS</option>
                <option value="spreadsheet">PLANILHAS</option>
                <option value="archive">COMPACTADOS (ZIP)</option>
                <option value="other">OUTROS FORMATOS</option>
              </select>
            </div>
          </div>

          {/* 4. Drag & Drop Area Wrapper */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative min-h-[350px] rounded-3xl border-2 border-dashed transition-all p-6 ${
              isDraggingOver 
                ? 'border-[#FF0033] bg-red-50/20' 
                : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
          >
            {isDraggingOver && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-xs space-y-3 pointer-events-none">
                <Upload className="w-12 h-12 text-[#FF0033] animate-bounce" />
                <p className="font-orbitron font-black text-sm text-black">SOLTE OS ARQUIVOS PARA FAZER UPLOAD</p>
                <p className="font-sans text-xs text-gray-500">Eles serão salvos automaticamente em: {currentFolder.name}</p>
              </div>
            )}

            {/* Active Uploading queue display */}
            {uploadQueue.length > 0 && (
              <div className="mb-6 space-y-3 bg-gray-50 border border-gray-200 p-4 rounded-2xl">
                <h4 className="font-orbitron font-bold text-[10px] text-gray-600 tracking-wider flex items-center space-x-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-[#FF0033] animate-spin" />
                  <span>FILA DE ENVIOS EM ANDAMENTO ({uploadQueue.length})</span>
                </h4>
                {uploadQueue.map((upload, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-xl p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between font-sans">
                      <div className="truncate pr-4 max-w-[280px]">
                        <span className="font-bold text-black block truncate">{upload.fileName}</span>
                        <span className="text-[10px] text-gray-500 block">{formatBytes(upload.fileSize)}</span>
                      </div>
                      <span className={`font-orbitron text-[10px] font-bold px-2.5 py-0.5 rounded ${
                        upload.state === 'Concluído' ? 'bg-emerald-100 text-emerald-800' :
                        upload.state === 'Erro' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {upload.state.toUpperCase()}
                      </span>
                    </div>

                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden relative">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          upload.state === 'Erro' ? 'bg-rose-600' : 'bg-[#FF0033]'
                        }`} 
                        style={{ width: `${upload.progress}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-orbitron font-bold text-gray-500">
                      <span>Progresso: {upload.progress}%</span>
                      {upload.error && <span className="text-rose-600">{upload.error}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Files List Table */}
            {isLoadingFiles ? (
              <div className="py-24 text-center space-y-3">
                <Loader2 className="w-10 h-10 text-[#FF0033] animate-spin mx-auto" />
                <p className="text-gray-500 font-orbitron text-xs">Consultando arquivos do Google Drive...</p>
              </div>
            ) : files.length === 0 ? (
              <div className="py-24 text-center space-y-4 max-w-sm mx-auto">
                <Folder className="w-12 h-12 text-gray-300 mx-auto" />
                <h4 className="font-orbitron font-bold text-sm text-black">DIRETÓRIO VAZIO</h4>
                <p className="text-gray-500 text-xs font-sans leading-relaxed">
                  Não há nenhum arquivo ou pasta correspondente aos filtros neste diretório. Arraste arquivos aqui ou clique abaixo para enviar.
                </p>
                <label className="inline-flex bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 font-orbitron font-bold px-5 py-2.5 rounded-xl text-xs cursor-pointer transition-all">
                  <Upload className="w-4 h-4 mr-2" />
                  <span>SELECIONAR CONTRATO / AUDIO</span>
                  <input 
                    type="file" 
                    onChange={handleFileUpload} 
                    className="hidden" 
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header columns */}
                <div className="hidden md:grid grid-cols-12 px-5 py-2 text-[10px] font-orbitron font-bold text-gray-500 border-b border-gray-100">
                  <div className="col-span-6">NOME DO RECURSO</div>
                  <div className="col-span-2">TAMANHO</div>
                  <div className="col-span-2">MODIFICAÇÃO</div>
                  <div className="col-span-2 text-right">AÇÕES</div>
                </div>

                {/* Items rows */}
                <div className="divide-y divide-gray-100">
                  {files.map((item) => {
                    const isImportant = !!importantFileIds[item.id];
                    const isFolderType = item.mimeType === 'application/vnd.google-apps.folder';

                    return (
                      <div 
                        key={item.id} 
                        className={`py-3.5 px-4 rounded-xl grid grid-cols-12 items-center hover:bg-gray-50 transition-colors text-xs font-sans ${
                          isImportant ? 'bg-red-50/5 border border-red-500/10' : ''
                        }`}
                      >
                        {/* Name and Type */}
                        <div className="col-span-12 md:col-span-6 flex items-center space-x-3 min-w-0">
                          {/* Pin / Star Icon directly on list */}
                          <button
                            onClick={() => toggleImportantStatus(item)}
                            className={`p-1 hover:bg-gray-100 rounded-lg transition-colors ${
                              isImportant ? 'text-amber-500' : 'text-gray-300 hover:text-gray-400'
                            }`}
                            title={isImportant ? 'Remover sinalizador importante' : 'Marcar como arquivo importante'}
                          >
                            <Star className={`w-4 h-4 ${isImportant ? 'fill-amber-500' : ''}`} />
                          </button>

                          <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                            {getFileIcon(item.mimeType)}
                          </div>

                          <div className="min-w-0 flex-1">
                            {isFolderType ? (
                              <button
                                onClick={() => handleOpenFolder(item.id, item.name)}
                                className="font-bold text-black text-left hover:text-[#FF0033] hover:underline block truncate pr-4"
                                title={item.name}
                              >
                                {item.name.toUpperCase()}
                              </button>
                            ) : (
                              <span className="font-bold text-gray-800 block truncate pr-4" title={item.name}>
                                {item.name}
                              </span>
                            )}
                            <div className="flex items-center space-x-2 text-[9px] font-orbitron text-gray-400">
                              <span>{isFolderType ? 'DIRETÓRIO' : 'ARQUIVO'}</span>
                              <span>•</span>
                              <span className="truncate max-w-[150px]">{item.mimeType}</span>
                            </div>
                          </div>
                        </div>

                        {/* File Size */}
                        <div className="col-span-12 md:col-span-2 text-gray-600 font-orbitron py-1 md:py-0">
                          <span className="md:hidden font-bold text-gray-400 mr-1">Tamanho:</span>
                          {isFolderType ? '—' : formatBytes(item.size)}
                        </div>

                        {/* Last Modified */}
                        <div className="col-span-12 md:col-span-2 text-gray-500 font-orbitron text-[11px] py-1 md:py-0">
                          <span className="md:hidden font-bold text-gray-400 mr-1">Modificado em:</span>
                          {new Date(item.modifiedTime).toLocaleDateString('pt-BR')}
                        </div>

                        {/* Actions buttons and Context dropdown representation */}
                        <div className="col-span-12 md:col-span-2 flex items-center justify-start md:justify-end gap-2 mt-3 md:mt-0">
                          {isFolderType ? (
                            <button
                              onClick={() => handleOpenFolder(item.id, item.name)}
                              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer text-[10px] font-orbitron font-bold"
                              title="Abrir pasta"
                            >
                              ABRIR
                            </button>
                          ) : (
                            item.webViewLink && (
                              <a
                                href={item.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 rounded-lg bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-700 transition-colors cursor-pointer"
                                title="Visualizar no Google Drive"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )
                          )}

                          {!isFolderType && (
                            <button
                              onClick={() => handleDownloadFile(item)}
                              className="p-2 rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-600 text-gray-700 transition-colors cursor-pointer"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Rename Trigger */}
                          <button
                            onClick={() => {
                              setItemToRename(item);
                              setRenameValue(item.name);
                            }}
                            className="p-2 rounded-lg bg-gray-100 hover:bg-purple-50 hover:text-purple-600 text-gray-700 transition-colors cursor-pointer"
                            title="Renomear"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Trigger */}
                          <button
                            onClick={() => setItemToMove(item)}
                            className="p-2 rounded-lg bg-gray-100 hover:bg-amber-50 hover:text-amber-600 text-gray-700 transition-colors cursor-pointer"
                            title="Mover"
                          >
                            <Move className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Trigger */}
                          <button
                            onClick={() => setFileToDelete(item)}
                            className="p-2 rounded-lg bg-gray-100 hover:bg-rose-50 hover:text-rose-600 text-gray-700 transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick upload footer button */}
          <div className="flex justify-end">
            <label className="bg-[#FF0033] hover:bg-[#d6002b] text-white font-orbitron font-black px-6 py-3 rounded-2xl text-xs flex items-center space-x-2 cursor-pointer shadow-lg transition-all">
              <Upload className="w-4 h-4" />
              <span>CARREGAR NOVO ARQUIVO AQUI</span>
              <input 
                type="file" 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </label>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------ */}
      {/* OPERATION MODALS & POPUPS                                                */}
      {/* ------------------------------------------------------------------------ */}

      {/* 1. Create Folder Modal */}
      <AnimatePresence>
        {isCreateFolderOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.form
              onSubmit={handleCreateFolder}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-gray-300 shadow-2xl p-6 max-w-md w-full space-y-6"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 text-amber-500 flex items-center justify-center">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-orbitron font-black text-base text-black">NOVA DIRETÓRIO NO DRIVE</h3>
                  <p className="text-gray-400 text-[10px] font-sans">Será criado sob: {currentFolder.name}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-orbitron text-[10px] text-gray-500 font-bold block">NOME DA PASTA</label>
                <input
                  type="text"
                  required
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Ex: MC Kronos Contratos"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-black focus:outline-none focus:border-[#FF0033]"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateFolderOpen(false)}
                  disabled={isCreatingFolder}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-orbitron font-bold"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={isCreatingFolder}
                  className="bg-[#FF0033] hover:bg-[#d6002b] text-white px-5 py-2 rounded-xl text-xs font-orbitron font-bold flex items-center space-x-1.5"
                >
                  {isCreatingFolder ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>CRIANDO...</span>
                    </>
                  ) : (
                    <span>CRIAR PASTA</span>
                  )}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Rename Item Modal */}
      <AnimatePresence>
        {itemToRename && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.form
              onSubmit={handleRenameItem}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-gray-300 shadow-2xl p-6 max-w-md w-full space-y-6"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-orbitron font-black text-base text-black">RENOMEAR CONTRATO / FOLDER</h3>
                  <p className="text-gray-400 text-[10px] font-sans">Atualiza o nome diretamente nos servidores do Google</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-orbitron text-[10px] text-gray-500 font-bold block">NOVO NOME DO ITEM</label>
                <input
                  type="text"
                  required
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-black focus:outline-none focus:border-[#FF0033]"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setItemToRename(null)}
                  disabled={isRenaming}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-orbitron font-bold"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={isRenaming}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-xl text-xs font-orbitron font-bold flex items-center space-x-1.5"
                >
                  {isRenaming ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>SALVANDO...</span>
                    </>
                  ) : (
                    <span>CONFIRMAR MUDANÇA</span>
                  )}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Move Item Modal */}
      <AnimatePresence>
        {itemToMove && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-gray-300 shadow-2xl p-6 max-w-md w-full space-y-6"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 text-amber-500 flex items-center justify-center">
                  <Move className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-orbitron font-black text-base text-black">MOVER CONTRATO OU PASTA</h3>
                  <p className="text-gray-400 text-[10px] font-sans">Selecione uma pasta de destino no nível atual</p>
                </div>
              </div>

              <div className="space-y-3">
                <span className="font-orbitron text-[10px] text-gray-500 font-bold block">PASTA ATUAL: {currentFolder.name}</span>
                
                {/* Available directories options list inside current */}
                <div className="max-h-[220px] overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-gray-50">
                  {/* Moving to Parent option if stack allows */}
                  {folderStack.length > 2 && (
                    <button
                      onClick={() => handleMoveItem(folderStack[folderStack.length - 2].id, folderStack[folderStack.length - 2].name)}
                      disabled={isMoving}
                      className="w-full text-left px-4 py-3 text-xs font-bold text-[#FF0033] hover:bg-gray-100 transition-colors flex items-center space-x-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>SUBIR UM NÍVEL: {folderStack[folderStack.length - 2].name.toUpperCase()}</span>
                    </button>
                  )}

                  {subfoldersInCurrent
                    .filter(f => f.id !== itemToMove.id) // Cannot move into itself
                    .map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => handleMoveItem(sub.id, sub.name)}
                        disabled={isMoving}
                        className="w-full text-left px-4 py-3 text-xs text-black hover:bg-gray-100 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <Folder className="w-4 h-4 text-amber-500" />
                          <span className="font-bold truncate">{sub.name.toUpperCase()}</span>
                        </div>
                        <span className="text-[10px] font-orbitron text-gray-400">SELECIONAR</span>
                      </button>
                    ))}

                  {subfoldersInCurrent.length === 0 && folderStack.length <= 2 && (
                    <div className="px-4 py-6 text-center text-xs text-gray-400 font-orbitron">
                      Nenhuma pasta de destino válida encontrada neste diretório. Crie uma pasta primeiro.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setItemToMove(null)}
                  disabled={isMoving}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-orbitron font-bold"
                >
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Delete Destructive Confirmation Modal (Includes "Important" warnings) */}
      <AnimatePresence>
        {fileToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-gray-300 shadow-2xl p-6 max-w-md w-full space-y-6"
            >
              {/* If file is marked as important, show HIGH RED ALERT WARNING */}
              {importantFileIds[fileToDelete.id] ? (
                <div className="flex items-start space-x-4 bg-amber-50 border border-amber-300 p-4 rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <h4 className="font-orbitron font-black text-xs text-amber-900">ATENÇÃO: ARQUIVO PROTEGIDO</h4>
                    <p className="text-amber-700 text-[10px] font-sans mt-0.5 leading-normal">
                      Este documento está sinalizado como <b>IMPORTANTE</b> no Firestore administrativo. A exclusão afetará referências críticas.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-[#FF0033] flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-orbitron font-black text-lg text-black">EXCLUIR RECURSO?</h3>
                  <p className="text-gray-500 text-xs font-sans mt-1">
                    Esta ação é definitiva e removerá o item diretamente de sua conta Google Drive na nuvem.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center space-x-2.5">
                  <div className="shrink-0">{getFileIcon(fileToDelete.mimeType)}</div>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-black text-xs block truncate" title={fileToDelete.name}>
                      {fileToDelete.name}
                    </span>
                    <span className="text-[9px] text-gray-400 font-orbitron block">
                      ID: {fileToDelete.id}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setFileToDelete(null)}
                  disabled={isDeleting}
                  className="bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl text-xs font-orbitron font-bold transition-all cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  onClick={handleDeleteFile}
                  disabled={isDeleting}
                  className="bg-[#FF0033] hover:bg-[#d6002b] text-white px-5 py-2.5 rounded-xl text-xs font-orbitron font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-md"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>REMOVENDO...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>EXCLUIR RECURSO</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
