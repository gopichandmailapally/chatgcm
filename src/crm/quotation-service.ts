/**
 * Quotation Generation & Line Item Management Service
 */

import { db } from '../db/database.js';
import crypto from 'node:crypto';
import { updateLeadStage } from './lead-service.js';
import { createOwnerApprovalRequest } from './approval-service.js';

export interface QuoteLineItemInput {
  productId?: string;
  itemName: string;
  specification?: string;
  quantity: number;
  unit: string;
  unitRate: number;
}

export interface CreateQuotationInput {
  leadId: string;
  websiteId: string;
  projectName: string;
  dimensionsText?: string;
  items: QuoteLineItemInput[];
  discountPct?: number;
  transportCharges?: number;
  installationCharges?: number;
}

import { generateOfficialEstimation } from './gcm-bridge-client.js';

export async function createQuotation(input: CreateQuotationInput) {
  const { leadId, websiteId, projectName, dimensionsText, items } = input;
  const discountPct = input.discountPct || 0;
  const transportCharges = input.transportCharges || 0;
  const installationCharges = input.installationCharges || 0;

  if (!items || items.length === 0) {
    throw new Error('Quotation must contain at least one line item.');
  }

  // Generate serial number: GCM-QT-2026-XXXX
  const randomSerial = Math.floor(1000 + Math.random() * 9000);
  const quoteNumber = `GCM-QT-2026-${randomSerial}`;
  const quoteId = 'QT-' + crypto.randomBytes(4).toString('hex').toUpperCase();

  // Calculate financials
  let subtotal = 0;
  const calculatedItems = items.map(item => {
    const amount = Math.round(item.quantity * item.unitRate * 100) / 100;
    subtotal += amount;
    return { ...item, amount };
  });

  const discountAmount = Math.round(subtotal * (discountPct / 100) * 100) / 100;
  const taxableAmount = subtotal - discountAmount + installationCharges;
  const gstPct = 18.0;
  const gstAmount = Math.round(taxableAmount * (gstPct / 100) * 100) / 100;
  const grandTotal = Math.round((taxableAmount + gstAmount + transportCharges) * 100) / 100;

  // Insert quotation into SQLite
  db.prepare(`
    INSERT INTO quotations (
      id, quote_number, lead_id, website_id, project_name, dimensions_text,
      subtotal, discount_pct, discount_amount, taxable_amount, gst_pct, gst_amount,
      transport_charges, installation_charges, grand_total, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SENT')
  `).run(
    quoteId,
    quoteNumber,
    leadId,
    websiteId,
    projectName,
    dimensionsText || null,
    subtotal,
    discountPct,
    discountAmount,
    taxableAmount,
    gstPct,
    gstAmount,
    transportCharges,
    installationCharges,
    grandTotal
  );

  // Insert quote line items
  const insertItem = db.prepare(`
    INSERT INTO quote_items (id, quotation_id, product_id, item_name, specification, quantity, unit, unit_rate, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const it of calculatedItems) {
    const itemId = 'QTI-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    insertItem.run(
      itemId,
      quoteId,
      it.productId || null,
      it.itemName,
      it.specification || null,
      it.quantity,
      it.unit,
      it.unitRate,
      it.amount
    );
  }

  // Progress Lead Stage in CRM
  updateLeadStage(leadId, 'QUOTATION_SENT', `Quotation ${quoteNumber} generated for ${grandTotal.toLocaleString('en-IN')}`);

  // Check if discount exceeded 5% -> Flag for Owner Approval
  let requiresApproval = false;
  let approvalId: string | null = null;
  if (discountPct > 5.0) {
    requiresApproval = true;
    const approval = createOwnerApprovalRequest({
      leadId,
      quotationId: quoteId,
      reason: `Customer requested ${discountPct}% discount on quotation ${quoteNumber} (exceeds 5% autonomous limit)`,
      requestedDiscountPct: discountPct
    });
    approvalId = approval.id;
  }

  // 🚀 Bridge directly to gcm.enterprises estimation engine
  let officialDoc: any = null;
  try {
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as any;
    const companyId = websiteId === 'netsocean' ? 'COMP-0001' : (websiteId === 'gcmsafetynets' ? 'COMP-0001' : 'COMP-0001');
    const bridgeItems = calculatedItems.map(it => ({
      description: it.itemName,
      qty: it.quantity,
      unit: it.unit,
      rate: it.unitRate,
      specs: it.specification ? [it.specification] : []
    }));

    officialDoc = await generateOfficialEstimation({
      company_id: companyId,
      customer: {
        name: lead?.customer_name || 'Prospective Client',
        phone: lead?.phone || '',
        city: lead?.city || 'Hyderabad, Telangana'
      },
      items: bridgeItems,
      discount_percent: discountPct,
      notes: `Generated via Chat GCM AI Brain (${projectName || 'Quotation'})`
    });

    if (officialDoc && officialDoc.success) {
      db.prepare(`
        UPDATE quotations 
        SET doc_id = ?, view_url = ?, pdf_url = ?, convert_invoice_url = ?, company_name = ?
        WHERE id = ?
      `).run(
        officialDoc.doc_id,
        officialDoc.view_url,
        officialDoc.pdf_url,
        officialDoc.convert_invoice_url,
        officialDoc.company_name,
        quoteId
      );
    }
  } catch (bridgeErr: any) {
    console.warn('[QuotationService] GCM Bridge generation warning:', bridgeErr.message);
  }

  return {
    quoteId,
    quoteNumber,
    officialDocId: officialDoc?.doc_id || null,
    officialViewUrl: officialDoc?.view_url || null,
    officialPdfUrl: officialDoc?.pdf_url || null,
    convertInvoiceUrl: officialDoc?.convert_invoice_url || null,
    companyName: officialDoc?.company_name || 'GCM ENTERPRISES',
    projectName,
    dimensionsText,
    items: calculatedItems,
    financials: {
      subtotal,
      discountPct,
      discountAmount,
      taxableAmount,
      gstPct,
      gstAmount,
      transportCharges,
      installationCharges,
      grandTotal
    },
    requiresApproval,
    approvalId
  };
}

export function getQuotationById(quoteId: string) {
  const quote = db.prepare('SELECT q.*, l.customer_name, l.phone, l.city FROM quotations q JOIN leads l ON q.lead_id = l.id WHERE q.id = ?').get(quoteId) as any;
  if (!quote) return null;

  const items = db.prepare('SELECT * FROM quote_items WHERE quotation_id = ?').all(quoteId);
  return { ...quote, items };
}
