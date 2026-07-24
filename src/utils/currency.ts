export type CurrencyCode = 'USD' | 'KHR';

export const getCurrencySymbol = (code: CurrencyCode) => {
  switch (code) {
    case 'KHR': return '៛';
    default: return '$';
  }
};

export const formatAmount = (amount: number, code: CurrencyCode) => {
  const symbol = getCurrencySymbol(code);
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  const isKhr = code === 'KHR';
  return `${isNegative ? '-' : ''}${symbol}${absVal.toLocaleString(undefined, {
    minimumFractionDigits: isKhr ? 0 : 2,
    maximumFractionDigits: isKhr ? 0 : 2,
  })}`;
};

export const formatAmountNoCents = (amount: number, code: CurrencyCode) => {
  const symbol = getCurrencySymbol(code);
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  return `${isNegative ? '-' : ''}${symbol}${absVal.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
};
