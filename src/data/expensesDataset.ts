import { Transaction } from '../types';
import { parseWorksheetCSV } from '../utils/worksheetUtils';

export const RAW_EXPENSES_CSV = `Date,Vendor,Category,Description,Payment Method,Currency,Amount (Net),Tax / VAT,Total,Total (USD),Total (KHR),Status,Pay Under,Attachment,Week of Month,Exchange Rate`;

export const INITIAL_EXPENSES_DATASET: Transaction[] = parseWorksheetCSV(RAW_EXPENSES_CSV).map((item, idx) => ({
  ...item,
  id: `tx-dataset-${idx + 1}`,
}));
