import { useEffect } from 'react';
import { fetchCompanySettings } from '../utils/storeDb';

export function FaviconLogger() {
  useEffect(() => {
    fetchCompanySettings()
      .then(settings => {
        console.log("=========================================");
        console.log("🔍 DIAGNÓSTICO DO FAVICON:");
        console.log("Firestore Collection: company_settings");
        console.log("Firestore Document: settings");
        console.log("Valor de faviconUrl:", settings?.faviconUrl);
        console.log("Valor de logoUrl:", settings?.logoUrl);
        console.log("=========================================");
      })
      .catch(err => {
        console.error("❌ ERRO NO DIAGNÓSTICO DO FAVICON:", err);
      });
  }, []);

  return null;
}
