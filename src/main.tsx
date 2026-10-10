import './consolePatch';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Add global error handlers
window.addEventListener("error", (event) => {
  console.warn("[VOXA RUNTIME NOTICE]", event.error || event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  console.warn("[VOXA PROMISE NOTICE]", event.reason);
});

console.log("[VOXA BOOT] main.tsx iniciou");
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("[VOXA BOOT] ERRO: root element não encontrado");
} else {
  console.log("[VOXA BOOT] root encontrado");
  console.log("[VOXA BOOT] render iniciado");
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
  console.log("[VOXA BOOT] render finalizado");
}
