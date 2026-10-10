/**
 * Central currency formatter for the Lockdown platform.
 * Formats values precisely in Brazilian Real format (R$ 1.335,02)
 * with a single normal space after the "R$".
 */
export function formatBRL(value: any): string {
  if (value === null || value === undefined || value === '') {
    return 'R$ 0,00';
  }

  let numericValue = 0;
  if (typeof value === 'number') {
    numericValue = value;
  } else if (typeof value === 'string') {
    // Strip R$ and whitespaces
    let clean = value.replace(/R\$\s*/gi, '').trim();
    
    // Detect BRL formatting (comma for decimal, maybe points for thousands)
    if (clean.includes(',') && (clean.includes('.') || clean.split(',')[1]?.length === 2)) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    
    numericValue = parseFloat(clean) || 0;
  }

  // Format to standard Brazilian style (thousands with dot, decimals with comma)
  const formattedNumber = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numericValue);

  return `R$ ${formattedNumber}`;
}

/**
 * Returns raw numeric value from a BRL string or number safely.
 */
export function parseBRLToNumber(value: any): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  let clean = value.replace(/R\$\s*/gi, '').trim();
  if (clean.includes(',') && (clean.includes('.') || clean.split(',')[1]?.length === 2)) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  return parseFloat(clean) || 0;
}

/**
 * Interactive input mask to format typing into BRL standard format.
 */
export function maskBRL(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 'R$ 0,00';
  const centavos = parseFloat(digits) / 100;
  
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(centavos);
  
  return `R$ ${formatted}`;
}

