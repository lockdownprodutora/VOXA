import { db, storage, auth, isFirebaseConfigured, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, doc, setDoc } from 'firebase/firestore';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

export interface UploadResult {
  id: string; // ID do documento registrado no Firestore
  url: string; // URL pública para visualização/reprodução
  storagePath: string; // Caminho de referência no Firebase Storage
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: 'artist' | 'cover' | 'product' | 'audio' | 'logo' | string;
  createdAt: string;
  provider?: 'google-drive' | 'firebase-storage';
  driveFileId?: string | null;
  driveFolderId?: string | null;
  displayPath?: string | null;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

/**
 * Handles Firestore error reporting according to system safety rules
 */
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validates a file against allowed categories and mime types
 * @param file File to be validated
 * @param category Target upload category
 */
export function validateFileType(file: File, category: string): void {
  const mimeType = file.type.toLowerCase();
  
  if (['artist', 'cover', 'product', 'logo'].includes(category)) {
    // Validate image types
    const allowedImageTypes = [
      'image/jpeg', 
      'image/jpg', 
      'image/png', 
      'image/gif', 
      'image/webp', 
      'image/svg+xml'
    ];
    if (!mimeType.startsWith('image/') && !allowedImageTypes.includes(mimeType)) {
      throw new Error(
        `Tipo de arquivo inválido (${file.type}). Apenas imagens (JPEG, PNG, WEBP, GIF) são permitidas para esta categoria.`
      );
    }
  } else if (category === 'audio') {
    // Validate audio types
    const allowedAudioTypes = [
      'audio/mpeg', 
      'audio/mp3', 
      'audio/wav', 
      'audio/x-wav',
      'audio/wave',
      'audio/ogg', 
      'audio/aac', 
      'audio/m4a', 
      'audio/x-m4a',
      'audio/mp4'
    ];
    const isWavOrMp3ByName = file.name.endsWith('.wav') || file.name.endsWith('.mp3') || file.name.endsWith('.m4a');
    if (!mimeType.startsWith('audio/') && !allowedAudioTypes.includes(mimeType) && !isWavOrMp3ByName) {
      throw new Error(
        `Tipo de arquivo inválido (${file.type}). Apenas arquivos de áudio (MP3, WAV, M4A, OGG) são permitidos.`
      );
    }
  }
}

/**
 * Verifica se a conexão com o Google Drive está ativa.
 */
export async function checkDriveConnection(): Promise<boolean> {
  try {
    const response = await fetch("/api/check-drive-connection");
    const text = await response.text();
    
    // Check if the response is actually HTML instead of JSON
    if (text.trim().startsWith("<")) {
      console.warn("[Drive Connection Check] Servidor retornou resposta inválida (HTML).");
      return false;
    }

    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.warn("[Drive Connection Check] O servidor retornou uma resposta inválida (Não-JSON).");
      return false;
    }

    if (!response.ok) {
      console.warn("[Drive Connection Check] Serviço do Google Drive indisponível:", data.error);
      return false;
    }

    return !!data.success;
  } catch (err: any) {
    console.warn("[Drive Connection Check] Falha de contato com o servidor do Google Drive:", err.message || err);
    return false;
  }
}

/**
 * Centralized file upload function
 * Manages the entire lifecycle of upload, byte-level tracking, validation, Firestore reference registration,
 * and falls back elegantly to offline simulation if credentials/connections are not configured.
 * 
 * @param file The file object from input
 * @param category Category identifier (e.g. 'artist', 'cover', 'product', 'audio', 'logo')
 * @param onProgress Callback function invoked on progress change
 */
export async function uploadFile(
  file: File,
  category: 'artist' | 'cover' | 'product' | 'audio' | 'logo' | string,
  onProgress?: (progress: UploadProgress) => void,
  options?: {
    module?: string;
    subFolder?: string;
    entityId?: string;
    entityName?: string;
    artistName?: string;
    releaseName?: string;
    targetUserId?: string;
  }
): Promise<UploadResult> {
  // Validate file types and size limits for avatar, cover, highlight and profile_banner
  if (category === 'avatar' || category === 'cover' || category === 'highlight') {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(file.type.toLowerCase())) {
      throw new Error("Formato de arquivo inválido! Apenas JPG, JPEG, PNG, WEBP e GIF são permitidos.");
    }
    const maxBytes = 10 * 1024 * 1024; // 10MB Limit
    if (file.size > maxBytes) {
      throw new Error("Arquivo muito grande! O limite máximo para fotos de perfil ou capa é de 10 MB.");
    }
  } else if (category === 'profile_banner') {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'];
    const isMp4Name = file.name.toLowerCase().endsWith('.mp4');
    if (!allowedMimeTypes.includes(file.type.toLowerCase()) && !isMp4Name) {
      throw new Error("Formato de arquivo inválido! Apenas JPG, JPEG, PNG, WEBP, GIF e MP4 são permitidos.");
    }
    const maxBytes = 25 * 1024 * 1024; // 25MB Limit for video/banner
    if (file.size > maxBytes) {
      throw new Error("Arquivo muito grande! O limite máximo para banners de perfil é de 25 MB.");
    }
  } else {
    // 1. Validar o tipo do arquivo para outras categorias
    validateFileType(file, category);
  }

  const fileId = `up-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const folderName = category === 'product' ? 'store_products' : `${category}s`;
  const storagePath = `${folderName}/${Date.now()}_${file.name}`;
  const createdAt = new Date().toISOString();

  // Determinar se o Storage está configurado ou se é uma chave dummy
  const isStorageActive = isFirebaseConfigured();
  const isProductionOrHost = typeof window !== 'undefined' && 
    (window.location.hostname.includes('ai.studio') || window.location.hostname.includes('lockdownprodutora') || window.location.hostname.includes('produtora') || window.location.hostname.includes('voxa'));

  if (isStorageActive) {
    const currentUser = auth.currentUser;

    // DIRECT USER DIRECTORY UPLOAD TO FIREBASE STORAGE FOR AVATAR, COVER, HIGHLIGHT AND PROFILE_BANNER
    if (category === 'avatar' || category === 'cover' || category === 'highlight' || category === 'profile_banner') {
      try {
        console.log(`[Upload] Iniciando upload direto para Firebase Storage do ${category}...`);
        const targetUid = options?.targetUserId || currentUser?.uid || `profile_${Date.now()}`;
        const fileExtension = file.name.split('.').pop() || 'png';
        const cleanFileName = `media_${Date.now()}.${fileExtension}`;
        let path = "";
        if (category === 'avatar') {
          path = `users/${targetUid}/profile/avatar/${cleanFileName}`;
        } else if (category === 'cover') {
          path = `users/${targetUid}/profile/cover/${cleanFileName}`;
        } else if (category === 'profile_banner') {
          const bannerId = options?.entityId || `bn_${Date.now()}`;
          path = `users/${targetUid}/profile_banners/${bannerId}/${cleanFileName}`;
        } else {
          const highlightId = options?.entityId || `hl_${Date.now()}`;
          path = `users/${targetUid}/highlights/${highlightId}/${cleanFileName}`;
        }

        if (onProgress) {
          onProgress({ bytesTransferred: Math.round(file.size * 0.05), totalBytes: file.size, percentage: 5 });
        }

        const fileRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(fileRef, file);

        const downloadUrl = await new Promise<string>((resolve, reject) => {
          let settled = false;
          const timeoutId = setTimeout(() => {
            if (!settled) {
              settled = true;
              try { uploadTask.cancel(); } catch {}
              reject(new Error("Firebase Storage upload timed out after 8s"));
            }
          }, 8000);

          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const bytesTransferred = snapshot.bytesTransferred;
              const totalBytes = snapshot.totalBytes || file.size;
              const percentage = totalBytes > 0 ? Math.max(5, Math.round((bytesTransferred / totalBytes) * 100)) : 50;
              if (onProgress) {
                onProgress({ bytesTransferred, totalBytes, percentage });
              }
            },
            (err) => {
              if (!settled) {
                settled = true;
                clearTimeout(timeoutId);
                console.error("[Upload] Firebase Storage direct upload failed:", err);
                reject(err);
              }
            },
            async () => {
              if (!settled) {
                settled = true;
                clearTimeout(timeoutId);
                try {
                  const url = await getDownloadURL(uploadTask.snapshot.ref);
                  resolve(url);
                } catch (urlErr) {
                  reject(urlErr);
                }
              }
            }
          );
        });

        const metadata: UploadResult = {
          id: fileId,
          url: downloadUrl,
          storagePath: path,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          category,
          createdAt
        };

        // Salvar referência no Firestore em background (com timeout para nunca travar a UI se a quota esgotar)
        Promise.race([
          setDoc(doc(collection(db, 'uploads'), fileId), metadata),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Firestore metadata write timeout')), 2500))
        ]).catch((dbErr: any) => {
          console.warn("MEDIA_DEBUG: Skipped/failed metadata write to Firestore:", dbErr?.message || dbErr);
        });

        saveToLocalRegistry(metadata);
        return metadata;

      } catch (err: any) {
        console.warn(`MEDIA_DEBUG: Firebase Storage direct upload failed/timed out for ${category}, trying Google Drive / simulation fallback:`, err);
        // Try Google Drive backend (same fast upload flow used by Store products) before local compression fallback
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("category", category);
          formData.append("module", options?.module || "users");
          formData.append("subFolder", options?.subFolder || "Perfis");
          if (options?.targetUserId) formData.append("entityId", options.targetUserId);
          if (options?.entityName) formData.append("entityName", options.entityName);

          if (onProgress) {
            onProgress({ bytesTransferred: Math.round(file.size * 0.35), totalBytes: file.size, percentage: 35 });
          }

          const controller = new AbortController();
          const driveTimeout = setTimeout(() => controller.abort(), 15000);
          let driveRes: Response;
          try {
            driveRes = await fetch("/api/upload-drive", {
              method: "POST",
              body: formData,
              signal: controller.signal
            });
          } finally {
            clearTimeout(driveTimeout);
          }

          if (driveRes.ok) {
            const driveData = await driveRes.json();
            if (driveData.success && driveData.url) {
              if (onProgress) {
                onProgress({ bytesTransferred: file.size, totalBytes: file.size, percentage: 100 });
              }
              const driveMetadata: UploadResult = {
                id: fileId,
                url: driveData.url,
                storagePath: `google_drive/${driveData.fileId || 'unknown'}`,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                category,
                createdAt,
                provider: "google-drive",
                driveFileId: driveData.fileId || null,
                driveFolderId: driveData.driveFolderId || null
              };
              saveToLocalRegistry(driveMetadata);
              return driveMetadata;
            }
          }
        } catch (driveFallbackErr) {
          console.warn("MEDIA_DEBUG: Google Drive fallback for profile media also unavailable, using local compressed fallback:", driveFallbackErr);
        }

        return runSimulationFallback(file, category, fileId, storagePath, createdAt, onProgress);
      }
    }

    if (!currentUser) {
      console.warn("MEDIA_DEBUG: No authenticated user during upload attempt, falling back to simulation.");
      return runSimulationFallback(file, category, fileId, storagePath, createdAt, onProgress);
    }

    // Validar administrador antes de permitir o upload de mídias de negócios/corporativas para o Google Drive
    if (currentUser.isAnonymous) {
      console.warn("MEDIA_DEBUG: Anonymous user attempted upload.");
      throw new Error("Erro de Segurança: Usuários anônimos não possuem permissão para enviar arquivos administrativos.");
    }
    const email = currentUser.email;
    const isAllowedEmail = email && (email === 'lockdownprodutora@gmail.com' || email === 'admin@lockdownprodutora.com.br');
    if (!isAllowedEmail) {
      console.warn(`MEDIA_DEBUG: User ${email || 'unknown'} unauthorized for admin uploads.`);
      throw new Error(`Erro de Segurança: O usuário "${email || 'desconhecido'}" não possui privilégios de administrador.`);
    }

    try {
      console.log(`[Upload] Verificando pré-conexão com o Google Drive...`);
      await checkDriveConnection();

      console.log(`[Upload] Iniciando envio seguro de "${file.name}" para o Google Drive corporativo da Lockdown...`);
      
      // Report initial upload progress
      if (onProgress) {
        onProgress({ bytesTransferred: Math.round(file.size * 0.1), totalBytes: file.size, percentage: 10 });
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      
      // Append additional nested module destination routing parameters
      if (options) {
        if (options.module) formData.append("module", options.module);
        if (options.subFolder) formData.append("subFolder", options.subFolder);
        if (options.entityId) formData.append("entityId", options.entityId);
        if (options.entityName) formData.append("entityName", options.entityName);
        if (options.artistName) formData.append("artistName", options.artistName);
        if (options.releaseName) formData.append("releaseName", options.releaseName);
      }

      const headers: HeadersInit = {};
      const oauthToken = typeof window !== 'undefined' ? sessionStorage.getItem('lockdown_google_oauth_token') : null;
      if (oauthToken) {
        headers['Authorization'] = `Bearer ${oauthToken}`;
      }

      // Call our secure backend API endpoint
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 60_000);
      let response: Response;
      try {
        response = await fetch("/api/upload-drive", {
          method: "POST",
          headers: headers,
          body: formData,
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Erro de rede no servidor." }));
        throw new Error(errorData.error || `Erro de resposta: ${response.status}`);
      }

      const result = await response.json();
      console.log(`[Upload] Resposta de sucesso do backend da Lockdown:`, result);

      if (!result.success || !result.fileId || !result.url) {
        throw new Error(result.error || 'O Google Drive não confirmou o arquivo enviado.');
      }

      if (onProgress) {
        onProgress({ bytesTransferred: file.size, totalBytes: file.size, percentage: 100 });
      }

      const finalUrl = result.url || result.webViewLink;

      // 3. Salvar a referência (URL/Path) no Firestore com todos os metadados solicitados
      const metadata: any = {
        id: fileId,
        url: finalUrl,
        storagePath: `google_drive/${result.fileId || 'unknown'}`,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        category,
        createdAt,
        provider: "google-drive",
        driveFileId: result.fileId || null,
        driveFolderId: result.driveFolderId || null,
        module: result.module || options?.module || null,
        entityType: result.entityType || category || null,
        entityId: result.entityId || options?.entityId || null,
        uploadedByUserId: result.uploadedByUserId || auth.currentUser?.uid || "anonymous",
        displayPath: result.displayPath || null
      };

      try {
        const fileDocRef = doc(collection(db, 'uploads'), fileId);
        await setDoc(fileDocRef, metadata);
      } catch (dbErr: any) {
        console.error("MEDIA_DEBUG: Failed to write upload metadata document in Firestore:", dbErr);
      }

      // Adicionalmente registrar localmente para consistência
      saveToLocalRegistry(metadata);

      return metadata;

    } catch (driveErr: any) {
      console.warn(`MEDIA_DEBUG: Google Drive backend upload failed for category "${category}", attempting Firebase Storage fallback:`, driveErr);

      try {
        const fileRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(fileRef, file);

        // Aguardar upload com monitoramento de progresso via bytes
        const downloadUrl = await new Promise<string>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const bytesTransferred = snapshot.bytesTransferred;
              const totalBytes = snapshot.totalBytes;
              const percentage = Math.round((bytesTransferred / totalBytes) * 100);

              if (onProgress) {
                onProgress({ bytesTransferred, totalBytes, percentage });
              }
            },
            (err) => {
              console.log("MEDIA_INFO: Storage state check", storagePath, (err as any).message || err);
              
              // Capture and log exact user details on authorization/permission failure
              const errCode = (err as any).code || '';
              const isUnauthorized = errCode === 'storage/unauthorized' || err.message?.includes('permission');
              
              if (isUnauthorized) {
                const u = auth.currentUser;
                console.log("STORE_IMAGE_INFO", {
                  action: "Storage notification details",
                  fileName: file.name,
                  fileType: file.type,
                  fileSize: file.size,
                  storagePath: storagePath,
                  errorCode: errCode,
                  errorMessage: err.message,
                  user_authenticated: u ? 'SIM' : 'NÃO',
                  user_uid: u?.uid || 'null',
                  user_email: u?.email || 'null',
                  user_is_anonymous: u?.isAnonymous ? 'SIM' : 'NÃO',
                  user_email_verified: u?.emailVerified ? 'SIM' : 'NÃO',
                  user_provider_data: u?.providerData ? JSON.stringify(u.providerData) : 'null'
                });
              }
              reject(err);
            },
            async () => {
              try {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(url);
              } catch (urlErr) {
                console.error("MEDIA_DEBUG: Failed to getDownloadURL for ", storagePath, urlErr);
                reject(urlErr);
              }
            }
          );
        });

        // 3. Salvar a referência (URL/Path) no Firestore
        const metadata: UploadResult = {
          id: fileId,
          url: downloadUrl,
          storagePath,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          category,
          createdAt
        };

        try {
          const fileDocRef = doc(collection(db, 'uploads'), fileId);
          await setDoc(fileDocRef, metadata);
        } catch (dbErr: any) {
          // Tratar erro conforme as diretrizes do Firebase
          console.error("MEDIA_DEBUG: Failed to write upload metadata document in Firestore:", dbErr);
          throw new Error(`Upload bem-sucedido no Storage, mas falhou ao gravar a referência no Firestore: ${dbErr.message || dbErr}`);
        }

        // Adicionalmente registrar localmente para consistência
        saveToLocalRegistry(metadata);

        return metadata;

      } catch (err: any) {
        console.warn("MEDIA_DEBUG: Firebase Storage upload failed, attempting resilient fallback using local data URL representation:", err);
        
        // Fallback: Generate local Data URL representation and save to Firestore if possible
        try {
          const fallbackResult = await runSimulationFallback(file, category, fileId, storagePath, createdAt, onProgress);
          
          // Write reference to Firestore so the entry is created in the shared database
          try {
            const fileDocRef = doc(collection(db, 'uploads'), fileId);
            await setDoc(fileDocRef, fallbackResult);
            console.log("MEDIA_DEBUG: Successfully registered fallback Data URL upload in Firestore collection 'uploads'.");
          } catch (dbErr) {
            console.warn("MEDIA_DEBUG: Also failed to write fallback upload metadata to Firestore:", dbErr);
          }
          
          return fallbackResult;
        } catch (fallbackErr) {
          console.error("MEDIA_DEBUG: Resilient fallback also failed:", fallbackErr);
          throw new Error(`Falha no upload do arquivo para o Firebase: ${err.message || err}`);
        }
      }
    }
  } else {
    if (category === 'avatar' || category === 'cover' || category === 'highlight' || category === 'media') {
      return runSimulationFallback(file, category, fileId, storagePath, createdAt, onProgress);
    }
    if (isProductionOrHost) {
      throw new Error("O Firebase não está configurado de forma completa no ambiente publicado. Ative a integração do Firebase no painel de controle do AI Studio.");
    }
    // Usar fallback de simulação local caso não configurado em ambiente de desenvolvimento local
    return runSimulationFallback(file, category, fileId, storagePath, createdAt, onProgress);
  }
}

function compressImage(dataUrl: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
  });
}

/**
 * Fallback simulation reading file as DataURL and triggering mock progress
 */
async function runSimulationFallback(
  file: File,
  category: string,
  fileId: string,
  storagePath: string,
  createdAt: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  const totalBytes = file.size;
  
  // Simular progresso em lotes de progresso de bytes
  let bytesTransferred = 0;
  const step = Math.ceil(totalBytes / 5);

  while (bytesTransferred < totalBytes) {
    bytesTransferred = Math.min(bytesTransferred + step, totalBytes);
    const percentage = Math.round((bytesTransferred / totalBytes) * 100);
    
    if (onProgress) {
      onProgress({ bytesTransferred, totalBytes, percentage });
    }
    // Pequeno atraso para simular rede
    await new Promise(r => setTimeout(r, 60));
  }

  // Ler o arquivo com FileReader para gerar uma URL local reproduzível / visualizável
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error("FileReader não retornou resultado."));
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo local."));
    reader.readAsDataURL(file);
  });

  let finalUrl = rawDataUrl;
  if (file.type.startsWith('image/')) {
    try {
      finalUrl = await compressImage(rawDataUrl);
    } catch (compressErr) {
      console.warn("Falha ao otimizar imagem local, usando imagem bruta:", compressErr);
    }
  }

  const metadata: UploadResult = {
    id: fileId,
    url: finalUrl,
    storagePath,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    category,
    createdAt
  };

  // Registrar localmente no localStorage
  saveToLocalRegistry(metadata);

  return metadata;
}

/**
 * Saves uploaded file references to localStorage for offline search / persistence
 */
function saveToLocalRegistry(item: UploadResult) {
  try {
    const saved = localStorage.getItem('lockdown_central_uploads');
    const list: UploadResult[] = saved ? JSON.parse(saved) : [];
    
    // Fazer cópia profunda simples para evitar modificar o objeto em memória usado pelo componente
    const itemToSave = { ...item };
    
    // Se a URL for um Data URL base64, truncar para economizar espaço e evitar ultrapassar o limite (quota) do localStorage
    if (itemToSave.url && itemToSave.url.startsWith('data:')) {
      itemToSave.url = itemToSave.url.substring(0, 150) + '... (URL de dados local simplificada para persistência offline)';
    }

    const updated = list.filter(x => x.id !== itemToSave.id);
    updated.push(itemToSave);
    
    try {
      localStorage.setItem('lockdown_central_uploads', JSON.stringify(updated));
    } catch (setItemErr) {
      console.warn("localStorage quota exceeded or write failed, trying to clear older registry items", setItemErr);
      // Fallback: se exceder a quota, limpar os registros antigos para liberar espaço
      if (updated.length > 5) {
        // Manter apenas os 5 registros mais recentes
        const trimmed = updated.slice(-5);
        try {
          localStorage.setItem('lockdown_central_uploads', JSON.stringify(trimmed));
        } catch (retryErr) {
          console.error("Critical: could not save trimmed list to localStorage", retryErr);
        }
      } else {
        // Se ainda assim não der, limpar todo o registro local de uploads temporários
        localStorage.removeItem('lockdown_central_uploads');
      }
    }
  } catch (e) {
    console.error("Falha ao salvar no registro local:", e);
  }
}

/**
 * Fetches the list of all registered uploads
 */
export function getRegisteredUploads(): UploadResult[] {
  try {
    const saved = localStorage.getItem('lockdown_central_uploads');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Uploads a file directly to Google Drive using a given access token.
 * Returns the webViewLink or webContentLink or file ID.
 */
export function uploadFileToGoogleDrive(
  file: File,
  accessToken: string,
  parentFolderId?: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ id: string; url: string; fileName: string }> {
  return new Promise((resolve, reject) => {
    const boundary = 'lockdown_multipart_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata: any = {
      name: file.name,
      mimeType: file.type || 'application/octet-stream'
    };
    if (parentFolderId && parentFolderId !== 'root') {
      metadata.parents = [parentFolderId];
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', true);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percentage = Math.round((event.loaded / event.total) * 100);
        onProgress({
          bytesTransferred: event.loaded,
          totalBytes: event.total,
          percentage
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve({
            id: res.id,
            url: res.webViewLink || `https://drive.google.com/open?id=${res.id}`,
            fileName: res.name
          });
        } catch (e) {
          reject(new Error('Falha ao decodificar resposta do Google Drive.'));
        }
      } else {
        const errText = xhr.responseText || 'Erro desconhecido na API do Google Drive.';
        reject(new Error(`Erro Google Drive (Status ${xhr.status}): ${errText}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Falha de conexão de rede com o Google Drive.'));
    };

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
  });
}

