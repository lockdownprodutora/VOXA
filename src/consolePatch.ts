// Suppress benign/harmless Firestore long-polling idle disconnect warnings from cluttering logs
const originalConsoleError = console.error;
console.error = (...args) => {
  const isBenignFirestoreLog = args.some(arg => {
    if (!arg) return false;
    const str = typeof arg === "string" ? arg : (arg.message || arg.stack || String(arg));
    return typeof str === "string" && (
      str.includes("Disconnecting idle stream") || 
      str.includes("Timed out waiting for new targets") || 
      str.includes("RPC 'Listen' stream") ||
      str.includes("idle stream")
    );
  }) || args.map(arg => {
    if (!arg) return "";
    return typeof arg === "string" ? arg : (arg.message || arg.stack || String(arg));
  }).join(" ").includes("Disconnecting idle stream");

  if (isBenignFirestoreLog) {
    return;
  }
  originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  const isBenignFirestoreLog = args.some(arg => {
    if (!arg) return false;
    const str = typeof arg === "string" ? arg : (arg.message || arg.stack || String(arg));
    return typeof str === "string" && (
      str.includes("Disconnecting idle stream") || 
      str.includes("Timed out waiting for new targets") || 
      str.includes("RPC 'Listen' stream") ||
      str.includes("idle stream")
    );
  }) || args.map(arg => {
    if (!arg) return "";
    return typeof arg === "string" ? arg : (arg.message || arg.stack || String(arg));
  }).join(" ").includes("Disconnecting idle stream");

  if (isBenignFirestoreLog) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};
