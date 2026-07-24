import { Transaction, TransactionStatus, CurrencyType } from '../types';

export const DEFAULT_EXCHANGE_RATE = 4000; // Default KHR per 1 USD

/**
 * Converts various date formats (e.g. "May/9/2026", "2026-05-09", "09/05/2026") into standard "YYYY-MM-DD"
 */
export function formatToIsoDate(rawDate: string): string {
  const todayIso = new Date().toISOString().split('T')[0];
  if (!rawDate) return todayIso;
  const str = rawDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // Try parsing Date directly or with space/dash replacements
  let parsed = new Date(str);
  if (isNaN(parsed.getTime())) {
    parsed = new Date(str.replace(/\//g, ' '));
  }
  if (isNaN(parsed.getTime())) {
    parsed = new Date(str.replace(/\//g, '-'));
  }

  // If Date constructor couldn't handle month abbreviations e.g. "May/9/2026", "Jun/30/2026"
  if (isNaN(parsed.getTime())) {
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const parts = str.split(/[/ -]+/);
    if (parts.length === 3) {
      let yr = 0, mo = -1, day = 0;
      parts.forEach((p) => {
        const lower = p.toLowerCase();
        const mIdx = monthNames.findIndex((m) => lower.startsWith(m));
        if (mIdx !== -1) {
          mo = mIdx;
        } else if (p.length === 4 && !isNaN(Number(p))) {
          yr = parseInt(p, 10);
        } else if (!isNaN(Number(p))) {
          const val = parseInt(p, 10);
          if (val > 31) yr = val;
          else day = val;
        }
      });
      if (yr > 0 && mo !== -1 && day > 0) {
        parsed = new Date(yr, mo, day);
      }
    }
  }

  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Fallback to todayIso so invalid date strings never contaminate transactions
  return todayIso;
}

/**
 * Calculates Week of Month from a YYYY-MM-DD date string
 */
export function calculateWeekOfMonth(dateStr: string): string {
  if (!dateStr) return 'Week 1';
  try {
    const parts = dateStr.split('-');
    if (parts.length >= 3) {
      const day = parseInt(parts[2], 10);
      if (isNaN(day)) return 'Week 1';
      if (day <= 7) return 'Week 1';
      if (day <= 14) return 'Week 2';
      if (day <= 21) return 'Week 3';
      if (day <= 28) return 'Week 4';
      return 'Week 5';
    }
  } catch (e) {
    console.error('Error calculating week of month:', e);
  }
  return 'Week 1';
}

/**
 * Normalizes a transaction record to ensure all 16 worksheet fields are populated
 */
export function normalizeWorksheetTransaction(raw: Partial<Transaction>): Transaction {
  const currency: CurrencyType = raw.currency === 'KHR' ? 'KHR' : 'USD';
  const exchangeRate = raw.exchangeRate && raw.exchangeRate > 0 ? Number(raw.exchangeRate) : DEFAULT_EXCHANGE_RATE;
  
  const taxAmount = raw.taxAmount !== undefined && !isNaN(Number(raw.taxAmount)) ? Math.max(0, Number(raw.taxAmount)) : 0;
  
  let totalAmount = raw.amount !== undefined && !isNaN(Number(raw.amount)) ? Math.max(0, Number(raw.amount)) : 0;
  let netAmount = raw.netAmount !== undefined && !isNaN(Number(raw.netAmount)) ? Math.max(0, Number(raw.netAmount)) : 0;

  if (totalAmount > 0 && netAmount === 0) {
    netAmount = Math.max(0, totalAmount - taxAmount);
  } else if (netAmount > 0 && totalAmount === 0) {
    totalAmount = netAmount + taxAmount;
  } else if (netAmount === 0 && totalAmount === 0) {
    totalAmount = 0;
    netAmount = 0;
  }

  let totalUSD = 0;
  let totalKHR = 0;

  if (currency === 'KHR') {
    totalKHR = Math.round(totalAmount);
    totalUSD = Number((totalAmount / exchangeRate).toFixed(2));
  } else {
    // USD
    totalUSD = Number(totalAmount.toFixed(2));
    totalKHR = Math.round(totalAmount * exchangeRate);
  }

  const dateStr = raw.date || new Date().toISOString().split('T')[0];
  const weekOfMonth = raw.weekOfMonth || calculateWeekOfMonth(dateStr);

  return {
    id: raw.id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 7)}-${Math.floor(Math.random() * 10000)}`,
    type: raw.type || 'expense',
    date: dateStr,
    vendor: raw.vendor || '',
    category: raw.category || 'Food',
    description: raw.description || raw.vendor || raw.category || 'Transaction Record',
    paymentMethod: raw.paymentMethod || 'Card',
    currency,
    netAmount,
    taxAmount,
    amount: totalAmount,
    totalUSD,
    totalKHR,
    status: (raw.status as TransactionStatus) || 'Paid',
    payUnder: raw.payUnder || 'Company Account',
    imageAttachment: raw.imageAttachment || undefined,
    imageAttachmentName: raw.imageAttachmentName || undefined,
    additionalEvidence: raw.additionalEvidence || undefined,
    additionalEvidenceName: raw.additionalEvidenceName || undefined,
    weekOfMonth,
    exchangeRate,
    isRecurring: raw.isRecurring || false,
    recurringInterval: raw.recurringInterval,
    notes: raw.notes || undefined,
    tags: raw.tags || undefined,
  };
}

/**
 * 16 Columns matching user's exact worksheet order:
 * 1. Date
 * 2. Vendor
 * 3. Category
 * 4. Description
 * 5. Payment Method
 * 6. Currency
 * 7. Amount (Net)
 * 8. Tax / VAT
 * 9. Total
 * 10. Total (USD)
 * 11. Total (KHR)
 * 12. Status
 * 13. Pay Under
 * 14. Attachment
 * 15. Week of Month
 * 16. Exchange Rate
 */
export const WORKSHEET_HEADERS = [
  'Date',
  'Vendor',
  'Category',
  'Description',
  'Payment Method',
  'Currency',
  'Amount (Net)',
  'Tax / VAT',
  'Total',
  'Total (USD)',
  'Total (KHR)',
  'Status',
  'Pay Under',
  'Attachment',
  'Week of Month',
  'Exchange Rate',
];

/**
 * Converts transactions into CSV string conforming to the 16 worksheet columns
 */
export function exportWorksheetCSV(transactions: Transaction[]): string {
  const escapeCsv = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = transactions.map((raw) => {
    const tx = normalizeWorksheetTransaction(raw);
    return [
      escapeCsv(tx.date),
      escapeCsv(tx.vendor || ''),
      escapeCsv(tx.category),
      escapeCsv(tx.description),
      escapeCsv(tx.paymentMethod),
      escapeCsv(tx.currency || 'USD'),
      tx.netAmount ?? 0,
      tx.taxAmount ?? 0,
      tx.amount ?? 0,
      tx.totalUSD ?? 0,
      tx.totalKHR ?? 0,
      escapeCsv(tx.status || 'Paid'),
      escapeCsv(tx.payUnder || 'Company Account'),
      escapeCsv(tx.imageAttachmentName || (tx.imageAttachment ? 'Attached Proof' : 'None')),
      escapeCsv(tx.weekOfMonth || calculateWeekOfMonth(tx.date)),
      tx.exchangeRate || DEFAULT_EXCHANGE_RATE,
    ].join(',');
  });

  return [WORKSHEET_HEADERS.join(','), ...rows].join('\n');
}

/**
 * Parses CSV text with support for auto-delimiter detection, multi-line quoted fields,
 * and robust header row detection so that ALL rows are imported properly.
 */
export function parseWorksheetCSV(csvText: string): Omit<Transaction, 'id'>[] {
  if (!csvText) return [];
  const cleanedText = csvText.replace(/^\uFEFF/, ''); // Strip UTF-8 BOM
  if (!cleanedText.trim()) return [];

  // Normalize all line breaks (\r\n and \r -> \n)
  const normalizedText = cleanedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Auto-detect delimiter: check first line outside quotes
  let delimiter = ',';
  const firstLine = normalizedText.split('\n')[0] || '';
  let commaCount = 0;
  let semiCount = 0;
  let tabCount = 0;
  let inQ = false;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') inQ = !inQ;
    else if (!inQ) {
      if (ch === ',') commaCount++;
      else if (ch === ';') semiCount++;
      else if (ch === '\t') tabCount++;
    }
  }
  if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
  else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

  // Character-by-character CSV tokenizer with robust quote handling
  const parsedLines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];
    const nextChar = normalizedText[i + 1];

    if (char === '"') {
      if (!inQuotes && currentField.trim().length === 0) {
        // Field starts with a quote -> enter quoted mode
        inQuotes = true;
      } else if (inQuotes) {
        if (nextChar === '"') {
          // Escaped quote inside quoted field ("")
          currentField += '"';
          i++; // skip next quote
        } else {
          // Closing quote
          inQuotes = false;
        }
      } else {
        // Unquoted quote inside middle of a field -> treat as literal character
        currentField += '"';
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        parsedLines.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      parsedLines.push(currentRow);
    }
  }

  if (parsedLines.length === 0) return [];

  // 1. Smart Header Row Detection
  const headerKeywords = [
    'date', 'vendor', 'supplier', 'payee', 'category', 'description', 'details',
    'memo', 'payment', 'method', 'currency', 'net', 'tax', 'vat', 'total',
    'amount', 'status', 'pay under', 'account', 'attachment', 'week', 'rate', 'notes', 'tags'
  ];

  let headerRowIdx = -1;

  for (let i = 0; i < Math.min(parsedLines.length, 10); i++) {
    const cols = parsedLines[i];
    if (!cols || cols.length === 0) continue;

    let keywordMatches = 0;
    let numericOrDateCells = 0;

    for (const cell of cols) {
      if (!cell) continue;
      const str = cell.trim().toLowerCase();
      if (!str) continue;

      if (headerKeywords.some((k) => str === k || str.includes(k))) {
        keywordMatches++;
      }

      if (
        /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(str) ||
        /^[a-z]{3}[-/.]\d{1,2}[-/.]\d{2,4}$/i.test(str) ||
        (/^\$?\d+([.,]\d+)?$/.test(str.replace(/[\s\u1780-\u17FF]/g, '')) && str.length < 12)
      ) {
        numericOrDateCells++;
      }
    }

    if (keywordMatches >= 2 && numericOrDateCells === 0) {
      headerRowIdx = i;
      break;
    }

    if (keywordMatches >= 3 && numericOrDateCells <= 1) {
      headerRowIdx = i;
      break;
    }
  }

  // Fallback: Check if row 0 contains no numbers or dates at all
  if (headerRowIdx === -1 && parsedLines[0] && parsedLines[0].length >= 2) {
    const hasNumericInRow0 = parsedLines[0].some((c) => /^\d+([.,]\d+)?$/.test(c.trim().replace(/[^0-9.]/g, '')));
    if (!hasNumericInRow0) {
      headerRowIdx = 0;
    }
  }

  const dataStartIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
  const headerRow = headerRowIdx !== -1 ? parsedLines[headerRowIdx] : [];
  const headers = headerRow.map((h) => h.trim().toLowerCase());

  const findIdx = (names: string[], excludeIndices: number[] = []) => {
    if (headers.length === 0) return -1;
    for (const name of names) {
      const idx = headers.findIndex((h, i) => !excludeIndices.includes(i) && h === name.toLowerCase());
      if (idx !== -1) return idx;
    }
    for (const name of names) {
      const idx = headers.findIndex((h, i) => !excludeIndices.includes(i) && h.includes(name.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const dateIdx = findIdx(['date']);
  const vendorIdx = findIdx(['vendor', 'supplier', 'payee', 'merchant', 'store', 'company']);
  const categoryIdx = findIdx(['category', 'expense category', 'group', 'type']);
  const descIdx = findIdx(['description', 'details', 'memo', 'note', 'item', 'title']);
  const payMethodIdx = findIdx(['payment method', 'payment', 'method', 'paid via']);
  const currencyIdx = findIdx(['currency', 'curr', 'unit']);

  const netIdx = findIdx(['amount (net)', 'net amount', 'net price', 'net']);
  const taxIdx = findIdx(['tax / vat', 'vat', 'tax amount', 'tax', 'gst']);

  const excludeForTotal = [netIdx, taxIdx].filter((i) => i !== -1);
  const totalIdx = findIdx(
    ['total (usd)', 'total (khr)', 'total', 'total amount', 'grand total', 'amount ($)', 'amount (khr)', 'amount', 'price', 'cost', 'sum'],
    excludeForTotal
  );

  const statusIdx = findIdx(['status', 'paid status', 'state']);
  const payUnderIdx = findIdx(['pay under', 'account', 'entity', 'paid under']);
  const attachmentIdx = findIdx(['attachment', 'receipt', 'proof', 'file', 'image']);
  const weekIdx = findIdx(['week of month', 'week', 'period']);
  const exchangeIdx = findIdx(['exchange rate', 'rate', 'fx rate', 'khr rate']);

  const effDateIdx = dateIdx !== -1 ? dateIdx : 0;
  const effVendorIdx = vendorIdx !== -1 ? vendorIdx : 1;
  const effCategoryIdx = categoryIdx !== -1 ? categoryIdx : 2;
  const effDescIdx = descIdx !== -1 ? descIdx : 3;
  const effPayMethodIdx = payMethodIdx !== -1 ? payMethodIdx : 4;
  const effCurrencyIdx = currencyIdx !== -1 ? currencyIdx : 5;
  const effNetIdx = netIdx !== -1 ? netIdx : 6;
  const effTaxIdx = taxIdx !== -1 ? taxIdx : 7;
  const effTotalIdx = totalIdx !== -1 ? totalIdx : 8;
  const effStatusIdx = statusIdx !== -1 ? statusIdx : 11;
  const effPayUnderIdx = payUnderIdx !== -1 ? payUnderIdx : 12;
  const effAttachmentIdx = attachmentIdx !== -1 ? attachmentIdx : 13;
  const effWeekIdx = weekIdx !== -1 ? weekIdx : 14;
  const effExchangeIdx = exchangeIdx !== -1 ? exchangeIdx : 15;

  const parsedRecords: Omit<Transaction, 'id'>[] = [];

  for (let i = dataStartIdx; i < parsedLines.length; i++) {
    const cols = parsedLines[i];
    if (!cols || cols.length === 0) continue;

    const fullText = cols.join('').trim();
    if (!fullText) continue;

    const parseNum = (idx: number) => {
      if (idx < 0 || idx >= cols.length || !cols[idx]) return 0;
      const str = cols[idx].trim();
      if (!str || str === '-') return 0;
      if (/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(str)) return 0;
      let isNegative = str.includes('-') || (str.startsWith('(') && str.endsWith(')'));
      let cleaned = str.replace(/[^0-9.,]/g, '');
      if (!cleaned) return 0;

      if (cleaned.includes(',') && cleaned.includes('.')) {
        if (cleaned.indexOf(',') < cleaned.indexOf('.')) {
          cleaned = cleaned.replace(/,/g, '');
        } else {
          cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        }
      } else if (cleaned.includes(',')) {
        if (/^\d+,\d{2}$/.test(cleaned)) {
          cleaned = cleaned.replace(',', '.');
        } else {
          cleaned = cleaned.replace(/,/g, '');
        }
      }
      const val = parseFloat(cleaned);
      if (isNaN(val)) return 0;
      return isNegative ? -Math.abs(val) : val;
    };

    const rawDateStr = effDateIdx < cols.length && cols[effDateIdx] ? cols[effDateIdx] : new Date().toISOString().split('T')[0];
    const dateStr = formatToIsoDate(rawDateStr);
    const vendor = effVendorIdx < cols.length && cols[effVendorIdx] ? cols[effVendorIdx] : '';
    const category = effCategoryIdx < cols.length && cols[effCategoryIdx] ? cols[effCategoryIdx] : 'Other_Expense';
    const description = effDescIdx < cols.length && cols[effDescIdx] ? cols[effDescIdx] : (vendor || category);
    const paymentMethod = effPayMethodIdx < cols.length && cols[effPayMethodIdx] ? cols[effPayMethodIdx] : 'Card';
    const currencyStr = effCurrencyIdx < cols.length && cols[effCurrencyIdx] ? cols[effCurrencyIdx].toUpperCase() : 'USD';
    const currency: CurrencyType = currencyStr.includes('KHR') ? 'KHR' : 'USD';

    let netAmount = parseNum(effNetIdx);
    let taxAmount = parseNum(effTaxIdx);
    let amount = parseNum(effTotalIdx);

    if (amount === 0 && netAmount > 0) {
      amount = netAmount + taxAmount;
    }

    if (amount === 0) {
      for (let c = 0; c < cols.length; c++) {
        if (c === effDateIdx || c === effExchangeIdx) continue;
        const val = parseNum(c);
        if (val > 0) {
          amount = val;
          break;
        }
      }
    }

    if (amount === 0 && !vendor && !description) {
      continue;
    }

    const statusStr = effStatusIdx < cols.length && cols[effStatusIdx] ? cols[effStatusIdx] : 'Paid';
    const status: TransactionStatus = (['Paid', 'Pending', 'Cleared', 'Reimbursed', 'Overdue'].find(
      (s) => s.toLowerCase() === statusStr.toLowerCase()
    ) as TransactionStatus) || 'Paid';

    const payUnder = effPayUnderIdx < cols.length && cols[effPayUnderIdx] ? cols[effPayUnderIdx] : 'Company Account';
    const attachmentName = effAttachmentIdx < cols.length && cols[effAttachmentIdx] ? cols[effAttachmentIdx] : '';
    const weekOfMonth = effWeekIdx < cols.length && cols[effWeekIdx] ? cols[effWeekIdx] : calculateWeekOfMonth(dateStr);
    const exchangeRate = parseNum(effExchangeIdx) || DEFAULT_EXCHANGE_RATE;

    const normalized = normalizeWorksheetTransaction({
      date: dateStr,
      vendor,
      category,
      description,
      paymentMethod,
      currency,
      netAmount,
      taxAmount,
      amount,
      status,
      payUnder,
      imageAttachmentName: attachmentName && attachmentName !== 'None' ? attachmentName : undefined,
      weekOfMonth,
      exchangeRate,
      type: 'expense',
    });

    parsedRecords.push(normalized);
  }

  return parsedRecords;
}
