import { Router } from 'express';
import {
  listLeads,
  listLeadsByPillar,
  createOrUpdateLead,
  ingestLead,
  updatePipelineStage,
  assignTechnician,
  recordPayment,
  recordDispatch,
  toggleHumanTakeover,
  getLeadActivities,
  listTechnicians,
  getCRMAnalytics,
  createQuickCallLead,
  updateLeadWhatsAppNumber,
  dispatchQuotationToLead,
  dispatchShipment,
  getNoWhatsAppAlerts
} from '../crm/lead-service.js';
import { getQuotationById, createQuotation } from '../crm/quotation-service.js';
import { listPendingApprovals, decideOwnerApproval } from '../crm/approval-service.js';
import { sendWhatsAppMessage, sendWhatsAppInteractiveButtons } from '../whatsapp/whatsapp-client.js';
import { db } from '../db/database.js';

export const crmRouter = Router();

// ── 1. Executive Business Analytics ──────────────────────────────────────────
crmRouter.get('/analytics', (req, res) => {
  try {
    const data = getCRMAnalytics();
    res.json({ success: true, analytics: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 2. Technicians Fleet Roster ──────────────────────────────────────────────
crmRouter.get('/technicians', (req, res) => {
  try {
    const technicians = listTechnicians();
    res.json({ success: true, technicians });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 3. Leads Listing & Search (Omnichannel & Pillar Aware) ───────────────────
crmRouter.get('/leads', (req, res) => {
  try {
    const pillar = req.query.pillar as string | undefined;
    const stage = req.query.stage as string | undefined;
    const search = req.query.search as string | undefined;
    const zone = req.query.zone as string | undefined;
    const websiteId = req.query.websiteId as string | undefined;
    const city = req.query.city as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;

    const leads = listLeadsByPillar(pillar, stage, search, zone, websiteId, city, limit);
    res.json({ success: true, leads });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

crmRouter.get('/leads/pillar/:pillar', (req, res) => {
  try {
    const pillar = req.params.pillar;
    const stage = req.query.stage as string | undefined;
    const search = req.query.search as string | undefined;
    const zone = req.query.zone as string | undefined;
    const websiteId = req.query.websiteId as string | undefined;
    const city = req.query.city as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;

    const leads = listLeadsByPillar(pillar, stage, search, zone, websiteId, city, limit);
    res.json({ success: true, pillar, leads });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Universal Multi-Platform Lead Ingestion API ──────────────────────────────
crmRouter.post('/ingest-lead', async (req, res) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const lead = await ingestLead({
      ...req.body,
      ipAddress: req.body.ipAddress || clientIp
    });

    res.json({
      success: true,
      status: 'INGESTED',
      leadId: lead.id,
      lead
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

crmRouter.post('/leads/ingest', async (req, res) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    const lead = await ingestLead({
      ...req.body,
      ipAddress: req.body.ipAddress || clientIp
    });

    res.json({
      success: true,
      status: 'INGESTED',
      leadId: lead.id,
      lead
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

crmRouter.post('/leads', (req, res) => {
  try {
    const lead = createOrUpdateLead(req.body);
    res.json({ success: true, lead });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ── 1-Tap Quick Call Lead Creator (Owner Phone Handoff to AI) ────────────────
crmRouter.post('/quick-call-lead', async (req, res) => {
  try {
    const lead = await createQuickCallLead(req.body);
    res.json({ success: true, lead });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ── Alerts for Missing WhatsApp Numbers (Owner Dial Desk) ─────────────────────
crmRouter.get('/alerts/no-whatsapp', (req, res) => {
  try {
    const alerts = getNoWhatsAppAlerts();
    res.json({ success: true, count: alerts.length, alerts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

crmRouter.post('/leads/:id/update-whatsapp', async (req, res) => {
  try {
    const { whatsappNumber, performedBy } = req.body;
    if (!whatsappNumber) {
      res.status(400).json({ success: false, error: 'WhatsApp number is required' });
      return;
    }
    const lead = await updateLeadWhatsAppNumber(req.params.id, whatsappNumber, performedBy || 'OWNER');
    res.json({ success: true, lead });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

crmRouter.post('/leads/:id/dispatch-quotation', async (req, res) => {
  try {
    const result = await dispatchQuotationToLead({
      leadId: req.params.id,
      ...req.body
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

crmRouter.post('/leads/:id/dispatch-shipment', async (req, res) => {
  try {
    const lead = await dispatchShipment({
      leadId: req.params.id,
      ...req.body
    });
    res.json({ success: true, lead });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ── 4. Pipeline Stage Advancement ────────────────────────────────────────────
crmRouter.patch('/leads/:id/stage', (req, res) => {
  try {
    const { stage, notes, performedBy } = req.body;
    const lead = updatePipelineStage(req.params.id, stage, notes, performedBy || 'ADMIN');
    res.json({ success: true, lead });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

crmRouter.post('/leads/:id/pipeline-stage', (req, res) => {
  try {
    const { stage, notes, performedBy } = req.body;
    const lead = updatePipelineStage(req.params.id, stage, notes, performedBy || 'ADMIN');
    res.json({ success: true, lead });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ── 5. Field Van & Technician Scheduling (Doorstep Services) ────────────────
crmRouter.post('/leads/:id/assign-technician', (req, res) => {
  try {
    const { technicianId, technicianName, technicianPhone, visitDate, visitSlot, areaZone, performedBy } = req.body;
    if (!technicianName || !visitDate || !visitSlot) {
      res.status(400).json({ success: false, error: 'Technician name, visit date, and visit slot are required.' });
      return;
    }

    const lead = assignTechnician(
      req.params.id,
      technicianId || 'TECH-MANUAL',
      technicianName,
      technicianPhone || '+91 99123 99224',
      visitDate,
      visitSlot,
      areaZone,
      performedBy || 'ADMIN'
    );
    res.json({ success: true, lead });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ── 6. Payment & Collections Ledger ──────────────────────────────────────────
crmRouter.post('/leads/:id/record-payment', (req, res) => {
  try {
    const { amount, mode, ref, isAdvance, performedBy } = req.body;
    if (!amount || Number(amount) <= 0) {
      res.status(400).json({ success: false, error: 'Valid payment amount is required.' });
      return;
    }

    const lead = recordPayment(
      req.params.id,
      Number(amount),
      mode || 'UPI',
      ref,
      isAdvance !== false,
      performedBy || 'ADMIN'
    );
    res.json({ success: true, lead });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ── 7. Logistics & Bilty / LR Logging (Supply Only) ─────────────────────────
crmRouter.post('/leads/:id/record-dispatch', (req, res) => {
  try {
    const { transporter, lrNumber, dispatchDate, performedBy } = req.body;
    if (!transporter || !lrNumber) {
      res.status(400).json({ success: false, error: 'Transporter name and LR / Bilty number are required.' });
      return;
    }

    const lead = recordDispatch(
      req.params.id,
      transporter,
      lrNumber,
      dispatchDate || new Date().toISOString().slice(0, 10),
      performedBy || 'ADMIN'
    );
    res.json({ success: true, lead });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ── 8. Human Takeover Toggle ─────────────────────────────────────────────────
crmRouter.post('/leads/:id/toggle-takeover', (req, res) => {
  try {
    const { takeoverStatus, performedBy } = req.body;
    const lead = toggleHumanTakeover(req.params.id, Boolean(takeoverStatus), performedBy || 'ADMIN');
    res.json({ success: true, lead });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ── 9. Audit Activities Log ──────────────────────────────────────────────────
crmRouter.get('/leads/:id/activities', (req, res) => {
  try {
    const activities = getLeadActivities(req.params.id);
    res.json({ success: true, activities });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 10. 1-Click WhatsApp Action Buttons ──────────────────────────────────────
crmRouter.post('/leads/:id/send-whatsapp', async (req, res) => {
  try {
    const { actionType } = req.body; // 'QUOTE_LINK' | 'VAN_CONFIRM' | 'PAYMENT_QR' | 'DISPATCH_BILTY' | 'CUSTOM_MSG'
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id) as any;
    if (!lead) {
      res.status(404).json({ success: false, error: 'Lead not found.' });
      return;
    }

    let messageText = '';
    if (actionType === 'VAN_CONFIRM') {
      messageText = `Hello ${lead.customer_name},\n\n🚐 *GCM Safety Nets Doorstep Van Scheduled!*\n\nOur field technician has been assigned to your location:\n- 👨‍🔧 Technician: *${lead.technician_name || 'Senior Field Lead'}*\n- 📞 Tech Phone: *${lead.technician_phone || '+91 99123 99224'}*\n- 📅 Date: *${lead.visit_date || 'Today'}*\n- ⏰ Time Slot: *${lead.visit_slot || 'Morning (9 AM - 1 PM)'}*\n- 📍 Area: *${lead.city} (${lead.locality || ''})*\n\nHe will carry physical net samples, AISI 316 invisible grill demos, and laser measurement tools. 100% Free Doorstep Demo!`;
    } else if (actionType === 'PAYMENT_QR') {
      const bal = lead.balance_amount || lead.estimated_value || 0;
      messageText = `Hello ${lead.customer_name},\n\n💳 *Payment Request from GCM Enterprises*\n\n- Project/Order: *${lead.requirement_summary || 'Safety Netting Order'}*\n- Outstanding Amount: *₹${bal.toLocaleString('en-IN')}*\n\n📲 *UPI ID*: \`gcm.enterprises@icici\` (or pay via PhonePe/GPay to 9912399224).\n\nPlease share screenshot/UTR once transferred for instant receipt & warranty activation!`;
    } else if (actionType === 'DISPATCH_BILTY') {
      messageText = `Hello ${lead.customer_name},\n\n🚚 *NetsOcean Order Dispatched!*\n\nYour netting shipment is on the way:\n- 📦 Transporter: *${lead.dispatch_transporter || 'V-Trans Logistics'}*\n- 📄 LR / Bilty No: *${lead.lr_number || 'TRK-2026-99'}*\n- 📅 Dispatch Date: *${lead.dispatch_date || new Date().toISOString().slice(0, 10)}*\n- 📍 Destination: *${lead.city}*\n\nExpected delivery in 2-4 business days. Thank you for choosing NetsOcean!`;
    } else if (actionType === 'QUOTE_LINK') {
      const quote = db.prepare('SELECT * FROM quotations WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1').get(lead.id) as any;
      const quoteUrl = quote?.view_url || `https://gcm.enterprises/admin/view.php?id=${quote?.doc_id || 'EST-202609-045'}`;
      messageText = `Hello ${lead.customer_name},\n\n📄 *Official Estimation #${quote?.quote_number || 'GCM-QT-2026'} is Ready!*\n\n- Project: *${lead.requirement_summary || 'Netting Project'}*\n- Total: *₹${(quote?.grand_total || lead.estimated_value || 0).toLocaleString('en-IN')}*\n\n👉 Click here to view & download official stamped PDF:\n${quoteUrl}`;
    } else if (req.body.customMessage) {
      messageText = req.body.customMessage;
    } else {
      res.status(400).json({ success: false, error: 'Invalid actionType.' });
      return;
    }

    const waRes = await sendWhatsAppMessage(lead.phone, messageText);
    res.json({ success: true, waRes, messageSent: messageText });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 11. Quotations Integration ───────────────────────────────────────────────
crmRouter.get('/quotations', (req, res) => {
  try {
    const quotes = db.prepare(`
      SELECT q.*, l.customer_name, l.phone, l.city, w.brand_name
      FROM quotations q
      LEFT JOIN leads l ON q.lead_id = l.id
      LEFT JOIN websites w ON q.website_id = w.id
      ORDER BY q.created_at DESC
      LIMIT 100
    `).all();
    res.json({ success: true, quotations: quotes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

crmRouter.get('/quotations/:id', (req, res) => {
  try {
    const quote = getQuotationById(req.params.id);
    if (!quote) {
      res.status(404).json({ success: false, error: 'Quotation not found' });
      return;
    }
    res.json({ success: true, quotation: quote });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

crmRouter.post('/quotations', async (req, res) => {
  try {
    const quote = await createQuotation(req.body);
    res.json({ success: true, quotation: quote });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ── 12. Owner Approvals & Device Management ──────────────────────────────────
crmRouter.get('/approvals', (req, res) => {
  try {
    const approvals = listPendingApprovals();
    res.json({ success: true, approvals });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

crmRouter.post('/approvals/:id/decision', (req, res) => {
  try {
    const { approved, comments, deviceId } = req.body;
    const headerDeviceId = req.headers['x-device-id'] as string;
    const effectiveDeviceId = deviceId || headerDeviceId;
    const approverUser = (req as any).user?.username || 'Owner / Managing Director';

    const approval = decideOwnerApproval(
      req.params.id, 
      approved ? 'APPROVED' : 'REJECTED', 
      comments, 
      approverUser, 
      effectiveDeviceId
    );
    res.json({ success: true, approval });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

crmRouter.get('/devices', (req, res) => {
  try {
    const devices = db.prepare('SELECT device_id, device_name, device_type, owner_name, registered_at, is_active FROM authorized_devices').all();
    res.json({ success: true, devices });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ── 13. Auto-Sync from gcm.enterprises ────────────────────────────────────────
crmRouter.post('/sync-doc', (req, res) => {
  try {
    const doc = req.body;
    if (!doc || !doc.id) {
      res.status(400).json({ success: false, error: 'Document data required' });
      return;
    }
    const customer = doc.bill_to || {};
    const customerName = customer.name || 'Client';
    const phone = customer.whatsapp || customer.phone || '';
    const docId = doc.id;
    const grandTotal = Number(doc.grand_total || 0);
    const gstAmount = Number(doc.igst_amount || (Number(doc.cgst_amount || 0) + Number(doc.sgst_amount || 0)));
    const taxableAmount = Number(doc.taxable_value || doc.subtotal || 0);
    const itemsSummary = (doc.items || []).map((it: any) => `${it.description || ''} (${it.qty} ${it.unit})`).join(', ');

    let pillar = 'turnkey';
    const descLower = itemsSummary.toLowerCase();
    if (doc.estimation_subtype === 'doorstep' || descLower.includes('balcony') || descLower.includes('pigeon') || descLower.includes('invisible grill')) {
      pillar = 'doorstep_service';
    } else if (doc.sale_unit_mode === 'sqft' && !descLower.includes('erection') && !descLower.includes('civil')) {
      pillar = 'supply_only';
    }

    const leadId = 'LEAD-' + docId;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT OR REPLACE INTO leads (
        id, website_id, customer_name, phone, city, locality, requirement_summary,
        stage, estimated_value, notes, created_at, updated_at,
        pillar, pipeline_stage, payment_status, advance_amount, balance_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      leadId,
      'gcm-enterprises',
      customerName,
      phone,
      customer.city || customer.address || 'India',
      customer.address || '',
      itemsSummary.substring(0, 200) || docId,
      doc.status === 'final' ? 'WON' : 'INVOICED',
      grandTotal,
      `Doc: ${docId}. Customer GSTIN: ${customer.gstin || 'N/A'}. Terms: ${(doc.terms || []).join('; ')}`,
      doc.created_at || now,
      now,
      pillar,
      doc.status === 'final' ? 'PAYMENT_RECEIVED' : 'CONTRACT_NEGOTIATION',
      'UNPAID',
      0,
      grandTotal
    );

    db.prepare(`
      INSERT OR REPLACE INTO quotations (
        id, quote_number, lead_id, website_id, project_name, dimensions_text,
        subtotal, discount_pct, discount_amount, taxable_amount,
        gst_pct, gst_amount, transport_charges, installation_charges,
        grand_total, status, doc_id, view_url, company_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'QUOTE-' + docId,
      docId,
      leadId,
      'gcm-enterprises',
      customerName + ' - ' + docId,
      (doc.items || []).length + ' Line Items',
      taxableAmount,
      doc.discount_percent || 0,
      doc.discount_amount || 0,
      taxableAmount,
      doc.igst_rate || 5.0,
      gstAmount,
      0,
      0,
      grandTotal,
      'SENT',
      docId,
      `https://gcm.enterprises/admin/view.php?id=${encodeURIComponent(docId)}`,
      'GCM ENTERPRISES',
      now
    );

    res.json({ success: true, leadId, docId, grandTotal, pillar });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
