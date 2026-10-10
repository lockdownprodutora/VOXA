export function isRealLogo(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith('data:image/svg+xml')) return false;
  if (url.includes('svg')) return false;
  return true;
}

export function getGlobalCompanyLogo(): string {
  try {
    const saved = localStorage.getItem('voxa_company_settings') || localStorage.getItem('voxa_company_info') || localStorage.getItem('lockdown_company_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.logoUrl) return parsed.logoUrl;
    }
  } catch (e) {}
  return "";
}

export function getGlobalCompanyName(): string {
  try {
    const saved = localStorage.getItem('voxa_company_settings') || localStorage.getItem('voxa_company_info') || localStorage.getItem('lockdown_company_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.tradeName) return parsed.tradeName;
      if (parsed.companyName) return parsed.companyName;
    }
  } catch (e) {}
  return 'VOXA';
}

