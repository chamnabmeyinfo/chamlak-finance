import { jsPDF } from 'jspdf';
import { Transaction } from '../types';
import { CurrencyCode, formatAmount } from './currency';

export const exportTransactionPDF = (
  tx: Transaction,
  currency: CurrencyCode,
  companyName: string,
  tagline: string
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Background Accent - Indigo
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(0, 0, 210, 40, 'F');

  // Brand Header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(companyName.toUpperCase(), 15, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 255);
  doc.text(tagline.toUpperCase(), 15, 25);

  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('AUDITABLE TRANSACTION RECORD', 15, 32);

  // Document Info Block (Right-aligned in header)
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const printedDate = new Date().toLocaleString();
  doc.text(`Doc Ref: REF-TX-${tx.id.substring(0, 8).toUpperCase()}`, 195, 15, { align: 'right' });
  doc.text(`Generated: ${printedDate}`, 195, 22, { align: 'right' });
  doc.text('Status: Logged and Verified', 195, 29, { align: 'right' });

  // Main Card Area divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(15, 48, 195, 48);

  // Metadata Section Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('Ledger Details', 15, 56);

  const detailsY = 66;
  const col1 = 15;
  const col2 = 60;
  const col3 = 110;
  const col4 = 150;

  const drawRow = (y: number, label1: string, val1: string, label2: string, val2: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFontSize(9);
    doc.text(label1, col1, y);
    doc.text(label2, col3, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(val1, col2, y);
    doc.text(val2, col4, y);
  };

  // Row 1
  drawRow(detailsY, 'Category Group:', tx.category, 'Log Date:', tx.date);
  // Row 2
  drawRow(detailsY + 10, 'Registry Type:', tx.type.toUpperCase(), 'Payment Method:', tx.paymentMethod);
  // Row 3
  drawRow(detailsY + 20, 'Statement text:', tx.description || 'N/A', 'Recurring Interval:', tx.isRecurring ? `Yes (${tx.recurringInterval})` : 'Single Transaction');

  // Amount Highlight Banner
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(15, detailsY + 30, 180, 20, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(15, detailsY + 30, 180, 20, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL AMOUNT CARRIED:', 25, detailsY + 42);

  doc.setFontSize(15);
  if (tx.type === 'income') {
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.text(`+ ${formatAmount(tx.amount, currency)}`, 85, detailsY + 43);
  } else {
    doc.setTextColor(225, 29, 72); // rose-600
    doc.text(`- ${formatAmount(tx.amount, currency)}`, 85, detailsY + 43);
  }

  // Notes section
  let nextSectionY = detailsY + 62;
  if (tx.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Notes & Annotations:', 15, nextSectionY);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(tx.notes, 15, nextSectionY + 6, { maxWidth: 180 });
    nextSectionY += 18;
  }

  // Draw attachment proof image if it exists
  const hasAttachment = tx.imageAttachment || tx.additionalEvidence;

  if (hasAttachment) {
    const attachImg = tx.imageAttachment || tx.additionalEvidence;
    const label = tx.imageAttachment ? 'Audit Image Evidence' : 'Supplementary Proof';
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(label, 15, nextSectionY);

    try {
      if (attachImg && attachImg.startsWith('data:image/')) {
        // Determine file format
        let imgFormat = 'JPEG';
        if (attachImg.includes('image/png')) imgFormat = 'PNG';
        else if (attachImg.includes('image/webp')) imgFormat = 'WEBP';
        else if (attachImg.includes('image/gif')) imgFormat = 'GIF';

        // Fit image inside A4 nicely without overlapping margins
        doc.addImage(attachImg, imgFormat, 15, nextSectionY + 5, 110, 75);
      } else {
        // Mock boundary box if URL is a simple remote image URL or placeholder
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(250, 250, 250);
        doc.rect(15, nextSectionY + 5, 180, 50, 'F');
        doc.rect(15, nextSectionY + 5, 180, 50, 'D');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text(`Attached Proof Asset: ${attachImg || 'External Asset Url'}`, 25, nextSectionY + 30);
      }
    } catch (e) {
      console.error('Error drawing image in PDF:', e);
      // Fallback border box
      doc.setDrawColor(244, 63, 94);
      doc.setFillColor(254, 242, 242);
      doc.rect(15, nextSectionY + 5, 180, 25, 'F');
      doc.rect(15, nextSectionY + 5, 180, 25, 'D');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(225, 29, 72);
      doc.text('[Receipt Attachment exists but was not parseable as base64]', 20, nextSectionY + 18);
    }
  }

  // Footer bar
  const pageHeight = doc.internal.pageSize.height;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(0, pageHeight - 12, 210, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('This record represents a secure, encrypted financial audit statement generated from Chamlack Media Finance Hub.', 15, pageHeight - 5);

  doc.save(`ledger_report_${tx.id.substring(0, 8)}.pdf`);
};
