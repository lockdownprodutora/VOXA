/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PublicSite } from './components/PublicSite';
import { AdminPanel } from './components/AdminPanel';
import { LoginModal } from './components/auth/LoginModal';
import { VoxaGateway } from './components/VoxaGateway';
import { VoxaOnboarding } from './components/VoxaOnboarding';
import { ForcePasswordChange } from './components/auth/ForcePasswordChange';
import { fetchCompanySettings, syncUserSession } from './utils/storeDb';
import { reconcileOfficialVerificationAndFollowsOnce } from './utils/centralUserDb';
import { ensureTradeSettingsGlobalSeeded } from './utils/tradeDb';
import { ensureInvestSeeded } from './utils/investDb';
import { capturePendingReferralFromUrl } from './utils/leagueDb';
import { SussurroPublicSendPage } from './components/SussurroPublicSendPage';
import { FinancialToastProvider } from './components/FinancialToast';
import { FaviconLogger } from './components/FaviconLogger';
import { auth, db, isFirebaseConfigured, onAuthStateChanged } from './lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { SplashScreen } from './components/SplashScreen';
import { PWAInstallButton } from './components/ui/PWAInstallButton';
import { OfflineIndicator } from './components/ui/OfflineIndicator';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useUserPresence } from './hooks/useUserPresence';
import { LocationConsentBanner } from './components/LocationConsentBanner';

// Map pathname to route state
function parsePath(pathname: string): { view: 'public' | 'admin', activeTab: string, activeMusicSub: 'artistas' | 'streams' } {
  const cleanPath = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  
  if (cleanPath === 'admin') {
    return { view: 'admin', activeTab: 'home', activeMusicSub: 'artistas' };
  }
  
  if (cleanPath === '' || cleanPath === 'home') {
    return { view: 'public', activeTab: 'home', activeMusicSub: 'artistas' };
  }

  if (cleanPath === 'register' || cleanPath === 'cadastro') {
    return { view: 'public', activeTab: 'register', activeMusicSub: 'artistas' };
  }

  if (cleanPath === 'login' || cleanPath === 'entrar') {
    return { view: 'public', activeTab: 'login', activeMusicSub: 'artistas' };
  }

  const parts = cleanPath.split('/');

  if (parts[0] === 'ai' || parts[0] === 'voxa-ai' || parts[0] === 'studio-ia') return { view: 'public', activeTab: 'ai', activeMusicSub: 'artistas' };
  if (parts[0] === 'invest' || parts[0] === 'voxa-invest') return { view: 'public', activeTab: 'invest', activeMusicSub: 'artistas' };
  if (parts[0] === 'explore') return { view: 'public', activeTab: 'explore', activeMusicSub: 'artistas' };
  if (parts[0] === 'trade') return { view: 'public', activeTab: 'trade', activeMusicSub: 'artistas' };
  if (parts[0] === 'wallet') return { view: 'public', activeTab: 'wallet', activeMusicSub: 'artistas' };
  if (parts[0] === 'messages') return { view: 'public', activeTab: 'messages', activeMusicSub: 'artistas' };
  if (parts[0] === 'sussurros') return { view: 'public', activeTab: 'sussurros', activeMusicSub: 'artistas' };
  if (parts[0] === 'settings') return { view: 'public', activeTab: 'settings', activeMusicSub: 'artistas' };
  if (parts[0] === 'notifications') return { view: 'public', activeTab: 'notifications', activeMusicSub: 'artistas' };
  if (parts[0] === 'ranking') return { view: 'public', activeTab: 'ranking', activeMusicSub: 'artistas' };
  if (parts[0] === 'vaquinhas') return { view: 'public', activeTab: 'vaquinhas', activeMusicSub: 'artistas' };
  if (parts[0] === 'passagens') return { view: 'public', activeTab: 'passagens', activeMusicSub: 'artistas' };
  if (parts[0] === 'store') return { view: 'public', activeTab: 'store', activeMusicSub: 'artistas' };
  if (parts[0] === 'tickets') return { view: 'public', activeTab: 'tickets', activeMusicSub: 'artistas' };
  if (parts[0] === 'subscriptions') return { view: 'public', activeTab: 'subscriptions', activeMusicSub: 'artistas' };
  if (parts[0] === 'music') {
    const sub = parts[1] === 'streams' ? 'streams' : 'artistas';
    return { view: 'public', activeTab: 'music', activeMusicSub: sub };
  }
  if (parts[0] === 'news') return { view: 'public', activeTab: 'news', activeMusicSub: 'artistas' };
  if (parts[0] === 'services') return { view: 'public', activeTab: 'services', activeMusicSub: 'artistas' };
  if (parts[0] === 'my_business') return { view: 'public', activeTab: 'my_business', activeMusicSub: 'artistas' };
  if (parts[0] === 'dating') return { view: 'public', activeTab: 'dating', activeMusicSub: 'artistas' };
  if (parts[0] === 'ads') return { view: 'public', activeTab: 'ads', activeMusicSub: 'artistas' };
  if (parts[0] === 'support') return { view: 'public', activeTab: 'support', activeMusicSub: 'artistas' };
  
  if (parts[0] === 'vox' && parts[1]) return { view: 'public', activeTab: 'vox', activeMusicSub: 'artistas' };
  if ((parts[0] === 's' || parts[0] === 'sussurro') && parts[1]) return { view: 'public', activeTab: 'sussurro', activeMusicSub: 'artistas' };
  if (parts[0] === 'u' && parts[1]) return { view: 'public', activeTab: 'profile', activeMusicSub: 'artistas' };

  if (cleanPath === 'activate-account') return { view: 'public', activeTab: 'activate-account', activeMusicSub: 'artistas' };
  if (cleanPath === 'dashboard') return { view: 'public', activeTab: 'dashboard', activeMusicSub: 'artistas' };
  if (cleanPath === 'submit_music') return { view: 'public', activeTab: 'submit_music', activeMusicSub: 'artistas' };
  if (cleanPath === 'my_submissions') return { view: 'public', activeTab: 'my_submissions', activeMusicSub: 'artistas' };
  
  // Direct Slug Route (/:username) - Check if it's not empty and doesn't match any reserved above
  if (parts.length === 1 && parts[0]) {
    const reserved = ['admin', 'home', 'register', 'cadastro', 'login', 'entrar', 'ai', 'voxa-ai', 'studio-ia', 'invest', 'voxa-invest', 'explore', 'trade', 'wallet', 'messages', 'sussurros', 'settings', 'notifications', 'ranking', 'vaquinhas', 'passagens', 'store', 'tickets', 'subscriptions', 'music', 'news', 'services', 'my_business', 'dating', 'ads', 'support', 'activate-account', 'dashboard', 'submit_music', 'my_submissions'];
    if (!reserved.includes(parts[0])) {
      return { view: 'public', activeTab: 'profile', activeMusicSub: 'artistas' };
    }
  }
  
  return { view: 'public', activeTab: '404', activeMusicSub: 'artistas' };
}

// Map route state to pathname
function getPathFromState(view: 'public' | 'admin', activeTab: string, activeMusicSub: 'artistas' | 'streams', targetUsername?: string | null): string {
  if (view === 'admin') return '/admin';
  if (activeTab === 'home') return '/';
  if (activeTab === 'ai') return '/ai';
  if (activeTab === 'invest') return '/invest';
  if (activeTab === 'register') return `/register${window.location.search || ''}`;
  if (activeTab === 'login') return `/login${window.location.search || ''}`;
  if (activeTab === 'profile') {
    if (targetUsername) {
      const cleanUser = targetUsername.replace(/^@+/, '').trim();
      if (cleanUser) return `/${cleanUser === 'juniorsantti' ? 'jrsantti' : cleanUser}`;
    }
    const cleanPath = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    const parts = cleanPath.split('/');
    if (parts[0] === 'u' && parts[1]) return `/${parts[1] === 'juniorsantti' ? 'jrsantti' : parts[1]}`;
    if (parts.length === 1 && parts[0] && !['admin', 'home', 'register', 'cadastro', 'login', 'entrar', 'ai', 'voxa-ai', 'studio-ia', 'invest', 'voxa-invest', 'explore', 'trade', 'wallet', 'messages', 'sussurros', 'settings', 'notifications', 'ranking', 'vaquinhas', 'passagens', 'store', 'tickets', 'subscriptions', 'music', 'news', 'services', 'my_business', 'dating', 'ads', 'support', 'activate-account', 'dashboard', 'submit_music', 'my_submissions'].includes(parts[0])) {
      return `/${parts[0] === 'juniorsantti' ? 'jrsantti' : parts[0]}`;
    }
    try {
      const saved = localStorage.getItem('voxa_current_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        const ownUser = parsed.username || parsed.slug;
        if (ownUser) return `/${ownUser === 'juniorsantti' ? 'jrsantti' : ownUser}`;
      }
    } catch {}
    return '/';
  }
  if (activeTab === 'trade') {
    if (window.location.pathname.startsWith('/trade/')) {
      return window.location.pathname;
    }
    return '/trade';
  }
  if (['ai', 'invest', 'explore', 'wallet', 'messages', 'sussurros', 'settings', 'notifications', 'ranking', 'vaquinhas', 'passagens', 'store', 'tickets', 'subscriptions', 'news', 'services', 'my_business', 'dating', 'ads', 'support', 'activate-account', 'dashboard', 'submit_music', 'my_submissions', '404'].includes(activeTab)) return `/${activeTab}`;
  if (activeTab === 'music') return activeMusicSub === 'streams' ? '/music/streams' : '/music/artistas';
  if (activeTab === 'vox' || activeTab === 'sussurro') return window.location.pathname;
  
  return '/';
}

export default function App() {
  console.log("[VOXA BOOT] App renderizou");
  const [view, setView] = useState<'public' | 'admin'>('public');
  const [activeTab, setActiveTabState] = useState<string>('home');
  const [activeMusicSub, setActiveMusicSubState] = useState<'artistas' | 'streams'>('artistas');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [visitedUsername, setVisitedUsername] = useState<string | null>(null);
  const { requestPermissionAndGetToken } = usePushNotifications();
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem('voxa_current_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });

  useEffect(() => {
    if (currentUser && currentUser.id) {
      requestPermissionAndGetToken(currentUser.id);
    }
  }, [currentUser]);

  // Real-time presence heartbeat & approximate location sync
  useUserPresence(currentUser, view === 'admin' ? 'admin' : activeTab);

  const [authInitialized, setAuthInitialized] = useState(false);
  const [settingsInitialized, setSettingsInitialized] = useState(false);

  // Safety fallback: force initialization complete after max 2.5 seconds to prevent hanging splash screen
  useEffect(() => {
    const timer = setTimeout(() => {
      setAuthInitialized(true);
      setSettingsInitialized(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Synchronize router state on mount and popstate
  useEffect(() => {
    const syncRouteFromLocation = () => {
      // Capture and persist referral code if present in URL (?ref=ABC123)
      capturePendingReferralFromUrl();

      const parsed = parsePath(window.location.pathname);
      setView(parsed.view);
      setActiveTabState(parsed.activeTab);
      setActiveMusicSubState(parsed.activeMusicSub);

      const cleanPath = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
      const parts = cleanPath.split('/');
      let resolvedSlug: string | null = null;

      if (parts[0] === 'u' && parts[1]) {
        resolvedSlug = decodeURIComponent(parts[1]).replace(/^@+/, '');
      } else if ((parts[0] === 's' || parts[0] === 'sussurro') && parts[1]) {
        resolvedSlug = decodeURIComponent(parts[1]).replace(/^@+/, '');
      } else if (parts[0] === 'ai' || parts[0] === 'voxa-ai' || parts[0] === 'studio-ia' || parts[0] === 'invest' || parts[0] === 'voxa-invest' || parts[0] === 'explore' || parts[0] === 'trade' || parts[0] === 'wallet' || parts[0] === 'messages' || parts[0] === 'sussurros' || parts[0] === 'settings' || parts[0] === 'register' || parts[0] === 'cadastro' || parts[0] === 'login' || parts[0] === 'entrar') {
        resolvedSlug = null;
      } else if (parts.length === 1 && parts[0] && !['admin', 'home', 'register', 'cadastro', 'login', 'entrar', 'ai', 'voxa-ai', 'studio-ia', 'invest', 'voxa-invest', 'activate-account', 'tickets', 'store', 'vaquinhas', 'passagens', 'artistas', 'music', 'assinaturas', 'dashboard', 'submit_music', 'my_submissions', 'explore', 'trade', 'wallet', 'messages', 'sussurros', 'settings', 'notifications', 'ranking', 'subscriptions', 'news', 'services', 'my_business', 'dating', 'ads', 'support'].includes(parts[0])) {
        resolvedSlug = decodeURIComponent(parts[0]).replace(/^@+/, '');
      }

      if (resolvedSlug && (resolvedSlug.toLowerCase() === 'juniorsantti' || resolvedSlug.toLowerCase() === 'juniorsantti92')) {
        resolvedSlug = 'jrsantti';
        if (parts[0] === 's' || parts[0] === 'sussurro') {
          window.history.replaceState(null, '', `/s/jrsantti`);
        } else {
          window.history.replaceState(null, '', `/jrsantti`);
        }
      } else if (parts[0] === 'u' && resolvedSlug) {
        window.history.replaceState(null, '', `/${resolvedSlug}`);
      }

      setVisitedUsername(resolvedSlug);
    };

    const handlePopState = () => {
      syncRouteFromLocation();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    syncRouteFromLocation();

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    reconcileOfficialVerificationAndFollowsOnce().catch(err => console.warn('[VOXA RECONCILE]', err));
    ensureTradeSettingsGlobalSeeded().catch(err => console.warn('[VOXA TRADE SETTINGS SEED]', err));
    ensureInvestSeeded().catch(err => console.warn('[VOXA INVEST SEED]', err));
  }, [currentUser?.uid]);

  // Real-time snapshot listener on admin_users/{uid} for immediate route & RBAC revalidation
  useEffect(() => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid || !isFirebaseConfigured()) return;

    const email = String(currentUser?.email || '').toLowerCase().trim();
    const isBootstrappedSuperAdmin =
      email === 'lockdownprodutora@gmail.com' ||
      email === 'admin@lockdownprodutora.com.br' ||
      email === 'admin@voxa.com.br' ||
      email.endsWith('@lockdownprodutora.com.br') ||
      uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' ||
      uid === 'TkJZkTxYX0PYknDHULfr8DR7Dlw1';

    const unsub = onSnapshot(
      doc(db, 'admin_users', uid),
      (snap) => {
        let nextRole = 'NONE';
        if (snap.exists()) {
          const r = String(snap.data()?.role || '').toUpperCase().trim();
          if (['SUPER_ADMIN', 'ADMINISTRATOR', 'MANAGER', 'SUPPORT'].includes(r)) {
            nextRole = r;
          }
        }
        if (nextRole === 'NONE' && isBootstrappedSuperAdmin) {
          nextRole = 'SUPER_ADMIN';
        }

        const hasAdminAccess = ['SUPER_ADMIN', 'ADMINISTRATOR', 'MANAGER', 'SUPPORT'].includes(nextRole);

        setCurrentUser((prev: any) => {
          if (!prev) return prev;
          if (prev.adminRole === nextRole && prev.isAdmin === ['SUPER_ADMIN', 'ADMINISTRATOR'].includes(nextRole)) {
            return prev;
          }
          const updated = {
            ...prev,
            adminRole: nextRole,
            isAdmin: ['SUPER_ADMIN', 'ADMINISTRATOR'].includes(nextRole),
            role: ['SUPER_ADMIN', 'ADMINISTRATOR'].includes(nextRole) ? 'ADMINISTRADOR' : (prev.role === 'ADMINISTRADOR' ? 'USUÁRIO COMUM' : prev.role)
          };
          try {
            localStorage.setItem('voxa_current_user', JSON.stringify(updated));
          } catch {}
          return updated;
        });

        // If user is currently on /admin route and loses admin privileges, immediately redirect to public home
        if (!hasAdminAccess && window.location.pathname.replace(/^\/+/, '').startsWith('admin')) {
          setView('public');
          setActiveTabState('home');
          window.history.replaceState(null, '', '/');
        }
      },
      () => {}
    );

    return () => unsub();
  }, [currentUser?.uid, currentUser?.id, currentUser?.email]);

  useEffect(() => {
    const handleProfileUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.newUsername) {
        setVisitedUsername(prev => {
          if (!prev || prev.toLowerCase() === (detail.oldUsername || '').toLowerCase() || prev.toLowerCase() === 'juniorsantti') {
            return detail.newUsername;
          }
          return prev;
        });
      }
      try {
        const saved = localStorage.getItem('voxa_current_user');
        if (saved) setCurrentUser(JSON.parse(saved));
      } catch {}
    };
    window.addEventListener('voxa_profile_cache_invalidated', handleProfileUpdated);
    return () => window.removeEventListener('voxa_profile_cache_invalidated', handleProfileUpdated);
  }, []);

  const updateUrl = (newView: 'public' | 'admin', newTab: string, newSub: 'artistas' | 'streams', targetUsername?: string | null) => {
    const newPath = getPathFromState(newView, newTab, newSub, targetUsername);
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  };

  const handleSetView = (newView: 'public' | 'admin') => {
    setView(newView);
    updateUrl(newView, activeTab, activeMusicSub, visitedUsername);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSetActiveTab = (newTab: string) => {
    setActiveTabState(newTab);
    if (newTab === 'profile') {
      const rawOwn = currentUser?.username || currentUser?.slug || null;
      const ownUsername = (currentUser?.uid === 'lvwWKvnHoMPDrOWTgrCZewhgcVw2' || rawOwn === 'juniorsantti' || rawOwn === 'juniorsantti92')
        ? 'jrsantti'
        : rawOwn;
      setVisitedUsername(ownUsername);
      updateUrl(view, 'profile', activeMusicSub, ownUsername);
    } else {
      setVisitedUsername(null);
      updateUrl(view, newTab, activeMusicSub, null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleVisitProfile = (username: string) => {
    const clean = (username || '').replace(/^@+/, '').trim();
    const canonical = (clean.toLowerCase() === 'juniorsantti' || clean.toLowerCase() === 'juniorsantti92') ? 'jrsantti' : clean;
    if (!canonical) return;
    setView('public');
    setVisitedUsername(canonical);
    setActiveTabState('profile');
    const newPath = `/${canonical}`;
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSetActiveMusicSub = (newSub: 'artistas' | 'streams') => {
    setActiveMusicSubState(newSub);
    updateUrl(view, activeTab, newSub);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          try {
            const syncedUser = await syncUserSession(firebaseUser);
            setCurrentUser(syncedUser);
          } catch (e: any) {
            console.error("Auth sync error:", e);
            setCurrentUser(null);
            localStorage.removeItem('voxa_current_user');
            if (e.message === 'CONTA_BLOQUEADA') {
              alert("Esta conta foi suspensa ou desativada pelo Administrador. Para mais informações, entre em contato com o suporte do VOXA.");
            } else if (e.message === 'CADASTRO_NAO_ENCONTRADO') {
              alert("Seu cadastro no VOXA não foi encontrado. Faça seu cadastro novamente ou entre em contato com o suporte.");
            } else {
              alert("Falha de autenticação ou erro de rede. Tente novamente mais tarde.");
            }
          }
        } else {
          setCurrentUser(null);
          localStorage.removeItem('voxa_current_user');
        }
      } finally {
        setAuthInitialized(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Proactively fetch company settings from Firestore on app startup
    fetchCompanySettings()
      .then(settings => {
        if (settings) {
          const targetFaviconUrl = settings.faviconUrl || settings.logoUrl;
          if (targetFaviconUrl) {
            // Determine matching mime-type
            let type = 'image/png';
            const lowerUrl = targetFaviconUrl.toLowerCase();
            if (lowerUrl.includes('.ico')) type = 'image/x-icon';
            else if (lowerUrl.includes('.svg')) type = 'image/svg+xml';
            else if (lowerUrl.includes('.webp')) type = 'image/webp';
            else if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg')) type = 'image/jpeg';

            // Generate deterministic version hash from URL to enforce cache invalidation only on changes
            let hash = 0;
            for (let i = 0; i < targetFaviconUrl.length; i++) {
              hash = (hash << 5) - hash + targetFaviconUrl.charCodeAt(i);
              hash |= 0;
            }
            const ver = Math.abs(hash).toString(36);

            // Safely append search parameter, keeping other parameters intact
            let finalUrl = targetFaviconUrl;
            try {
              const urlObj = new URL(targetFaviconUrl, window.location.origin);
              urlObj.searchParams.set('v', ver);
              finalUrl = urlObj.toString();
            } catch (e) {
              if (targetFaviconUrl.includes('?')) {
                finalUrl = `${targetFaviconUrl}&v=${ver}`;
              } else {
                finalUrl = `${targetFaviconUrl}?v=${ver}`;
              }
            }

            // Locate and update or create all favicon link elements
            const existingLinks = document.querySelectorAll("link[rel*='icon']");
            if (existingLinks.length > 0) {
              existingLinks.forEach(link => {
                link.setAttribute('href', finalUrl);
                link.setAttribute('type', type);
              });
            } else {
              const newLink = document.createElement('link');
              newLink.rel = 'icon';
              newLink.type = type;
              newLink.href = finalUrl;
              document.head.appendChild(newLink);
            }
          }
          const name = settings.tradeName || settings.companyName;
          if (name) {
            document.title = `${name} | Uma nova dimensão social`;
          }
        }
      })
      .catch(err => console.warn("App startup settings fetch failed:", err))
      .finally(() => {
        setSettingsInitialized(true);
      });
  }, []);

  if (!authInitialized || !settingsInitialized) {
    return <SplashScreen />;
  }

  return (
    <FinancialToastProvider
      currentUser={currentUser}
      onNavigateTab={(tab) => {
        setView('public');
        handleSetActiveTab(tab);
      }}
    >
      <div>
        <FaviconLogger />
        <div className="fixed top-4 right-4 z-50">
          <PWAInstallButton />
        </div>
        <OfflineIndicator />
        {currentUser && <LocationConsentBanner currentUser={currentUser} />}
        {activeTab === 'sussurro' && !currentUser ? (
          <div className="min-h-screen bg-[#080710] flex flex-col justify-center py-8 px-4 font-sans text-white">
            <SussurroPublicSendPage
              visitedUsername={visitedUsername}
              visitedUser={null}
              currentUser={null}
              triggerToast={() => {}}
              onBackToHome={() => {
                window.location.href = '/register';
              }}
            />
          </div>
        ) : (!currentUser && activeTab !== 'activate-account' && activeTab !== 'sussurro' && !(activeTab === 'profile' && Boolean(visitedUsername))) || (!currentUser && (activeTab === 'register' || activeTab === 'login')) ? (
          <VoxaGateway 
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              localStorage.setItem('voxa_current_user', JSON.stringify(user));
              if (user.email === 'admin@voxa.com.br' || user.email === 'admin@lockdownprodutora.com.br' || user.email === 'lockdownprodutora@gmail.com' || user.role === 'admin' || user.isAdmin === true) {
                handleSetView('admin');
              } else {
                setActiveTabState('home');
                window.history.replaceState(null, '', '/');
                handleSetView('public');
              }
            }}
          />
        ) : (currentUser && currentUser.profileComplete === false && activeTab !== 'activate-account') ? (
          <VoxaOnboarding 
            currentUser={currentUser}
            onComplete={(updated) => {
              setCurrentUser(updated);
              localStorage.setItem('voxa_current_user', JSON.stringify(updated));
              setActiveTabState('home');
              window.history.replaceState(null, '', '/');
              handleSetView('public');
            }}
          />
        ) : view === 'public' || activeTab === 'activate-account' ? (
          <PublicSite 
            onOpenAdmin={() => handleSetView('admin')} 
            onOpenLogin={() => {}}
            activeTab={activeTab === 'register' || activeTab === 'login' ? 'home' : activeTab}
            setActiveTab={handleSetActiveTab}
            activeMusicSub={activeMusicSub}
            setActiveMusicSub={handleSetActiveMusicSub}
            visitedUsername={visitedUsername}
            onVisitProfile={handleVisitProfile}
          />
        ) : (
          <AdminPanel onBackToPublic={() => handleSetView('public')} />
        )}

        {currentUser?.mustChangePassword === true && (
          <ForcePasswordChange 
            currentUser={currentUser}
            onPasswordChanged={() => {
              const updatedUser = { ...currentUser, mustChangePassword: false };
              setCurrentUser(updatedUser);
              localStorage.setItem('voxa_current_user', JSON.stringify(updatedUser));
            }}
          />
        )}
      </div>
    </FinancialToastProvider>
  );
}



