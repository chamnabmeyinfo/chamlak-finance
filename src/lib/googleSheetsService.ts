import { Transaction, CurrencyType, TransactionStatus } from '../types';
import {
  WORKSHEET_HEADERS,
  normalizeWorksheetTransaction,
  DEFAULT_EXCHANGE_RATE,
  calculateWeekOfMonth,
  formatToIsoDate,
} from '../utils/worksheetUtils';

// Global in-memory storage for the OAuth access token
let cachedToken: string | null = null;

export const setCachedAccessToken = (token: string | null) => {
  cachedToken = token;
};

export const getCachedAccessToken = (): string | null => {
  return cachedToken;
};

export interface GoogleSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

/**
 * List all Google Spreadsheet files in the user's Google Drive
 */
export async function listSpreadsheets(token: string): Promise<GoogleSpreadsheetFile[]> {
  const url = `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet' and trashed = false&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to list Google Sheets.');
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Create a new Google Spreadsheet and initialize with 16 worksheet headers
 */
export async function createSpreadsheet(token: string, title: string): Promise<GoogleSpreadsheetFile> {
  const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  
  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
    }),
  });

  if (!createResponse.ok) {
    const err = await createResponse.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create a new Google Sheet.');
  }

  const sheetData = await createResponse.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetName = sheetData.properties.title;

  // Initialize spreadsheet with all 16 user worksheet headers
  const initUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1?valueInputOption=USER_ENTERED`;
  await fetch(initUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [WORKSHEET_HEADERS],
    }),
  });

  try {
    const fileUrl = `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=webViewLink`;
    const fileResponse = await fetch(fileUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (fileResponse.ok) {
      const fileData = await fileResponse.json();
      return {
        id: spreadsheetId,
        name: spreadsheetName,
        webViewLink: fileData.webViewLink,
      };
    }
  } catch (e) {
    console.error('Could not fetch webViewLink:', e);
  }

  return {
    id: spreadsheetId,
    name: spreadsheetName,
    webViewLink: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

/**
 * Overwrite the spreadsheet with the current list of transactions formatted in 16 worksheet columns
 */
export async function exportToSpreadsheet(
  token: string,
  spreadsheetId: string,
  transactions: Transaction[]
): Promise<void> {
  const dataRows = transactions.map((raw) => {
    const tx = normalizeWorksheetTransaction(raw);
    return [
      tx.date,
      tx.vendor || '',
      tx.category,
      tx.description,
      tx.paymentMethod,
      tx.currency || 'USD',
      tx.netAmount ?? 0,
      tx.taxAmount ?? 0,
      tx.amount ?? 0,
      tx.totalUSD ?? 0,
      tx.totalKHR ?? 0,
      tx.status || 'Paid',
      tx.payUnder || 'Company Account',
      tx.imageAttachmentName || (tx.imageAttachment ? 'Attached Proof' : 'None'),
      tx.weekOfMonth || calculateWeekOfMonth(tx.date),
      tx.exchangeRate || DEFAULT_EXCHANGE_RATE,
    ];
  });

  const values = [WORKSHEET_HEADERS, ...dataRows];

  // Clear existing values
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:Z10000:clear`;
  await fetch(clearUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  // Update sheet
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to sync data to spreadsheet.');
  }
}

/**
 * Helper to extract spreadsheet ID from a raw ID or full Google Sheets URL
 */
export function extractSpreadsheetId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Read transactions from a Google Sheet mapping 16 worksheet columns
 */
export async function importFromSpreadsheet(
  token: string,
  spreadsheetIdInput: string,
  tabName: string = 'Expenses'
): Promise<Omit<Transaction, 'id'>[]> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdInput);
  
  // Try with specific tab name first (e.g. 'Expenses'), fallback to default sheet if needed
  let range = tabName ? `'${tabName}'!A1:Z10000` : 'A1:Z10000';
  let url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  
  let response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Fallback to default range if tab name fails
  if (!response.ok && tabName) {
    const fallbackUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:Z10000`;
    const fallbackResp = await fetch(fallbackUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (fallbackResp.ok) {
      response = fallbackResp;
    }
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to read from spreadsheet. Ensure you have read access.');
  }

  const data = await response.json();
  const rows: string[][] = data.values || [];

  if (rows.length === 0) {
    return [];
  }

  // 1. Smart Header Row Detection
  const headerKeywords = [
    'date', 'vendor', 'supplier', 'payee', 'category', 'description', 'details',
    'memo', 'payment', 'method', 'currency', 'net', 'tax', 'vat', 'total',
    'amount', 'status', 'pay under', 'account', 'attachment', 'week', 'rate', 'notes', 'tags'
  ];

  let headerRowIdx = -1;

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    let keywordMatches = 0;
    let numericOrDateCells = 0;

    for (const cell of row) {
      if (!cell) continue;
      const str = String(cell).trim().toLowerCase();
      if (!str) continue;

      if (headerKeywords.some((k) => str === k || str.includes(k))) {
        keywordMatches++;
      }

      // Check if cell is a date or currency/numeric amount
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

  // Fallback: check if row 0 contains no numbers or dates
  if (headerRowIdx === -1 && rows[0] && rows[0].length >= 2) {
    const hasNumericInRow0 = rows[0].some((c) => /^\d+([.,]\d+)?$/.test(String(c).trim().replace(/[^0-9.]/g, '')));
    if (!hasNumericInRow0) {
      headerRowIdx = 0;
    }
  }

  const dataStartIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
  const headerRow = headerRowIdx !== -1 ? rows[headerRowIdx] : [];
  const headers = headerRow.map((h) => String(h).trim().toLowerCase());

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
  let totalIdx = findIdx(
    ['total (usd)', 'total (khr)', 'total', 'total amount', 'grand total', 'amount ($)', 'amount (khr)', 'amount', 'price', 'cost', 'sum'],
    excludeForTotal
  );

  const statusIdx = findIdx(['status', 'paid status', 'state']);
  const payUnderIdx = findIdx(['pay under', 'account', 'entity', 'paid under']);
  const attachmentIdx = findIdx(['attachment', 'receipt', 'proof', 'file', 'image']);
  const weekIdx = findIdx(['week of month', 'week', 'period']);
  const exchangeIdx = findIdx(['exchange rate', 'rate', 'fx rate', 'khr rate']);

  // Fallback to standard 16-column positional indices if header matching produced nothing
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

  const imported: Omit<Transaction, 'id'>[] = [];

  for (let i = dataStartIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Check if row is completely empty
    const fullRowText = row.join('').trim();
    if (!fullRowText) continue;

    const parseNum = (idx: number) => {
      if (idx < 0 || idx >= row.length || !row[idx]) return 0;
      const str = String(row[idx]).trim();
      if (!str || str === '-') return 0;
      // Do not parse dates as numeric amounts
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

    const rawDateStr = effDateIdx < row.length && row[effDateIdx] ? String(row[effDateIdx]).trim() : new Date().toISOString().split('T')[0];
    const dateStr = formatToIsoDate(rawDateStr);
    const vendor = effVendorIdx < row.length && row[effVendorIdx] ? String(row[effVendorIdx]).trim() : '';
    const category = effCategoryIdx < row.length && row[effCategoryIdx] ? String(row[effCategoryIdx]).trim() : 'Other_Expense';
    const description = effDescIdx < row.length && row[effDescIdx] ? String(row[effDescIdx]).trim() : (vendor || category);
    const paymentMethod = effPayMethodIdx < row.length && row[effPayMethodIdx] ? String(row[effPayMethodIdx]).trim() : 'Card';
    const currencyStr = effCurrencyIdx < row.length && row[effCurrencyIdx] ? String(row[effCurrencyIdx]).trim().toUpperCase() : 'USD';
    const currency: CurrencyType = currencyStr.includes('KHR') ? 'KHR' : 'USD';

    let netAmount = parseNum(effNetIdx);
    let taxAmount = parseNum(effTaxIdx);
    let amount = parseNum(effTotalIdx);

    if (amount === 0 && netAmount > 0) {
      amount = netAmount + taxAmount;
    }

    // If amount is still 0, scan all cells in this row for any positive number
    if (amount === 0) {
      for (let c = 0; c < row.length; c++) {
        const val = parseNum(c);
        if (val > 0) {
          amount = val;
          break;
        }
      }
    }

    // Skip only if amount is still 0 AND vendor/description are empty
    if (amount === 0 && !vendor && !description) {
      continue;
    }

    const statusStr = effStatusIdx < row.length && row[effStatusIdx] ? String(row[effStatusIdx]).trim() : 'Paid';
    const status: TransactionStatus = (['Paid', 'Pending', 'Cleared', 'Reimbursed', 'Overdue'].find(
      (s) => s.toLowerCase() === statusStr.toLowerCase()
    ) as TransactionStatus) || 'Paid';

    const payUnder = effPayUnderIdx < row.length && row[effPayUnderIdx] ? String(row[effPayUnderIdx]).trim() : 'Company Account';
    const attachmentName = effAttachmentIdx < row.length && row[effAttachmentIdx] ? String(row[effAttachmentIdx]).trim() : '';
    const weekOfMonth = effWeekIdx < row.length && row[effWeekIdx] ? String(row[effWeekIdx]).trim() : calculateWeekOfMonth(dateStr);
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

    imported.push(normalized);
  }

  return imported;
}
