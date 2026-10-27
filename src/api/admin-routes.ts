import { 
  INSTALLED_SAFETY_NET_QUALITIES,
  BRAIDED_BAG_RATES,
  TURF_ACCESSORIES_CATALOG,
  calculateInstalledSafetyNet,
  calculateCricketBraidedBags,
  calculateTwisted15Netting,
  calculateTurfAccessory,
  calculateUnifiedTurfEstimate
} from '../pricing/universal-pricing-engine.js';
import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/database.js';
import { knowledgeEngine } from '../ai/knowledge-engine.js';
import { getAgentPerformanceSummary, getAgentLogs } from '../ai/agent-audit-service.js';
import { sendWhatsAppMessage, formatPhoneNumber } from '../whatsapp/whatsapp-client.js';
import { broadcastWhatsAppEvent } from './whatsapp-routes.js';
import { logLeadActivity } from '../crm/lead-service.js';

export const adminRouter = Router();

// ── 1. Master System Stats ───────────────────────────────────────────────────
adminRouter.get('/stats', (req, res) => {
  try {
    const totalLeads = (db.prepare('SELECT COUNT(*) as count FROM leads').get() as any)?.count || 0;
    const activeConversations = (db.prepare('SELECT COUNT(*) as count FROM conversations').get() as any)?.count || 0;
    const quotationsSent = (db.prepare('SELECT COUNT(*) as count FROM quotations').get() as any)?.count || 0;
    const pendingApprovals = (db.prepare("SELECT COUNT(*) as count FROM owner_approvals WHERE status = 'PENDING'").get() as any)?.count || 0;
    const pipelineValue = (db.prepare("SELECT SUM(grand_total) as total FROM quotations WHERE status != 'REJECTED'").get() as any)?.total || 0;

    const leadsByStage = db.prepare(`
      SELECT stage, COUNT(*) as count 
      FROM leads 
      GROUP BY stage
    `).all();

    const recentLeads = db.prepare(`
      SELECT l.*, w.brand_name 
      FROM leads l 
      LEFT JOIN websites w ON l.website_id = w.id 
      ORDER BY l.created_at DESC 
      LIMIT 8
    `).all();

    res.json({
      success: true,
      stats: {
        totalLeads,
        activeConversations,
        quotationsSent,
        pendingApprovals,
        pipelineValue,
        leadsByStage,
        recentLeads
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 2. Meta Cloud API Connection Module ──────────────────────────────────────
adminRouter.get('/meta/connections', (req, res) => {
  try {
    const connections = db.prepare('SELECT * FROM whatsapp_connections ORDER BY is_default DESC, created_at ASC').all();
    res.json({
      success: true,
      connections,
      webhookEndpoint: 'https://chatgcm.in/api/whatsapp/webhook',
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'gcm_whatsapp_verify_2026',
      activeStreamUrl: 'https://chatgcm.in/api/whatsapp/stream'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.post('/meta/connections', (req, res) => {
  try {
    const { phoneNumber, displayName, phoneNumberId, wabaId, accessToken, webhookVerifyToken } = req.body;
    if (!phoneNumber || !phoneNumberId || !wabaId) {
      return res.status(400).json({ success: false, error: 'Phone number, Phone ID, and WABA ID are required.' });
    }

    const id = 'CONN-' + Date.now().toString(36);
    db.prepare(`
      INSERT INTO whatsapp_connections (id, phone_number, display_name, phone_number_id, waba_id, access_token, webhook_verify_token, quality_rating, status, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'GREEN', 'CONNECTED', 0)
    `).run(id, phoneNumber, displayName || phoneNumber, phoneNumberId, wabaId, accessToken || null, webhookVerifyToken || 'gcm_whatsapp_verify_2026');

    res.json({ success: true, message: 'WhatsApp Business connection added.', connectionId: id });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.post('/meta/test-ping', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Recipient phone number is required.' });
    }
    const clean = formatPhoneNumber(phone);
    const msg = `⚡ *ChatGCM Meta Cloud API Test*\nConnection verified with host https://chatgcm.in\nTimestamp: ${new Date().toISOString()}`;
    const result = await sendWhatsAppMessage(clean, msg);

    // Provide friendly diagnostic help for Meta 24-hr customer window restriction
    let policyNote = null;
    if (!result.success && result.error?.error?.code === 100) {
      policyNote = 'Meta Cloud API (#100) indicates the recipient has not initiated a conversation within 24 hours. For out-of-window messages, an approved HSM template is required.';
    }

    res.json({ success: result.success, details: result, policyNote });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.get('/meta/telemetry', (req, res) => {
  try {
    const receipts = db.prepare('SELECT * FROM message_receipts ORDER BY created_at DESC LIMIT 30').all();
    const idempotency = db.prepare('SELECT * FROM webhook_idempotency ORDER BY received_at DESC LIMIT 30').all();
    res.json({ success: true, receipts, idempotency });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 3. Multi-Agent Shared Inbox Team Management ──────────────────────────────
adminRouter.get('/agents', (req, res) => {
  try {
    const agents = db.prepare('SELECT * FROM team_agents ORDER BY role ASC, name ASC').all();
    res.json({ success: true, agents });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.post('/agents', (req, res) => {
  try {
    const { name, email, role, phone, avatar, status } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Agent name is required.' });

    const id = 'AGT-' + Date.now().toString(36);
    db.prepare(`
      INSERT INTO team_agents (id, name, email, role, phone, avatar, status, active_chats_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(id, name, email || null, role || 'SALES_AGENT', phone || null, avatar || '👤', status || 'ONLINE');

    res.json({ success: true, message: 'Team agent registered successfully.', agentId: id });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.post('/agents/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    db.prepare('UPDATE team_agents SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true, message: 'Agent status updated.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 4. Business Knowledge Base & RAG Engine ──────────────────────────────────
adminRouter.get('/knowledge/documents', (req, res) => {
  try {
    const documents = db.prepare(`
      SELECT d.*, COUNT(c.id) as chunk_count 
      FROM knowledge_documents d 
      LEFT JOIN knowledge_chunks c ON d.id = c.document_id 
      GROUP BY d.id 
      ORDER BY d.created_at DESC
    `).all();
    res.json({ success: true, documents });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.post('/knowledge/upload', (req, res) => {
  try {
    const { filename, fileType, content, summary } = req.body;
    if (!filename || !content) {
      return res.status(400).json({ success: false, error: 'Filename and text content are required.' });
    }

    const docId = 'DOC-' + Date.now().toString(36);
    const docDir = '/var/www/chatgcm.in/data/knowledge_docs';
    if (!fs.existsSync(docDir)) {
      fs.mkdirSync(docDir, { recursive: true });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(docDir, `${docId}_${safeName}`);
    fs.writeFileSync(filePath, content, 'utf-8');

    // Split text into chunks (around 400-600 characters each)
    const paragraphs = content.split(/\n\s*\n/).filter((p: string) => p.trim().length > 30);
    const chunks = paragraphs.length > 0 ? paragraphs : [content];

    const insertChunk = db.prepare(`
      INSERT INTO knowledge_chunks (id, document_id, title, content, category)
      VALUES (?, ?, ?, ?, ?)
    `);

    chunks.forEach((chunk: string, idx: number) => {
      const chunkId = `CHK-${docId}-${idx + 1}`;
      const title = `${safeName} (Part ${idx + 1})`;
      insertChunk.run(chunkId, docId, title, chunk.trim(), fileType || 'DOCUMENT');
    });

    db.prepare(`
      INSERT INTO knowledge_documents (id, filename, original_name, file_type, file_size, file_path, summary, chunks_count, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'INDEXED')
    `).run(docId, safeName, filename, fileType || 'txt', Buffer.byteLength(content, 'utf-8'), filePath, summary || `Indexed document with ${chunks.length} chunks.`, chunks.length);

    res.json({
      success: true,
      message: `Document indexed successfully with ${chunks.length} RAG knowledge chunks.`,
      docId,
      chunksCount: chunks.length
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.delete('/knowledge/documents/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT file_path FROM knowledge_documents WHERE id = ?').get(req.params.id) as any;
    if (doc?.file_path && fs.existsSync(doc.file_path)) {
      try { fs.unlinkSync(doc.file_path); } catch {}
    }
    db.prepare('DELETE FROM knowledge_chunks WHERE document_id = ?').run(req.params.id);
    db.prepare('DELETE FROM knowledge_documents WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Document and RAG chunks removed.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.get('/knowledge/system-config', (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM ai_system_configs ORDER BY updated_at DESC LIMIT 1').get() as any;
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.post('/knowledge/system-config', (req, res) => {
  try {
    const { businessName, systemInstruction, personaTone, fallbackReply } = req.body;
    db.prepare(`
      INSERT INTO ai_system_configs (id, business_name, system_instruction, persona_tone, fallback_reply, enable_auto_quotes, enable_human_escalation)
      VALUES ('CFG-MASTER', ?, ?, ?, ?, 1, 1)
      ON CONFLICT(id) DO UPDATE SET 
        business_name = excluded.business_name,
        system_instruction = excluded.system_instruction,
        persona_tone = excluded.persona_tone,
        fallback_reply = excluded.fallback_reply,
        updated_at = CURRENT_TIMESTAMP
    `).run(businessName || 'GCM Enterprises', systemInstruction, personaTone || 'Authoritative and courteous', fallbackReply || null);

    res.json({ success: true, message: 'AI system prompt and business instructions updated.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.post('/knowledge/test-rag', (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ success: false, error: 'Query is required.' });

    const terms = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
    let chunks: any[] = [];

    if (terms.length > 0) {
      const conditions = terms.map(() => '(LOWER(content) LIKE ? OR LOWER(title) LIKE ?)').join(' OR ');
      const params: any[] = [];
      terms.forEach((t: string) => {
        params.push(`%${t}%`, `%${t}%`);
      });
      chunks = db.prepare(`
        SELECT c.*, d.original_name as document_name 
        FROM knowledge_chunks c 
        LEFT JOIN knowledge_documents d ON c.document_id = d.id 
        WHERE ${conditions}
        LIMIT 6
      `).all(...params);
    }

    if (chunks.length === 0) {
      chunks = db.prepare(`
        SELECT c.*, d.original_name as document_name 
        FROM knowledge_chunks c 
        LEFT JOIN knowledge_documents d ON c.document_id = d.id 
        ORDER BY c.created_at DESC 
        LIMIT 3
      `).all();
    }

    // Synthesize preview reply based on matched chunks
    let preview = `Namaste! Based on our verified company specifications:\n\n`;
    if (chunks.length > 0) {
      preview += `• ${chunks[0].content.slice(0, 180)}...\n\n`;
      preview += `We guarantee 100% genuine RUSSEA™ UV polymers with official warranty and direct bank settlement (0% commission).`;
    } else {
      preview += `Our technical sales engineer is reviewing your query to provide exact specifications and custom rates.`;
    }

    res.json({
      success: true,
      query,
      matchedChunks: chunks,
      synthesizedReplyPreview: preview
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 5. E-Commerce Catalog Syncer & Inventory ─────────────────────────────────
adminRouter.get('/catalog/items', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM products ORDER BY category ASC, product_name ASC').all();
    res.json({ success: true, items });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.post('/catalog/items', (req, res) => {
  try {
    const { id, productName, brand, category, sku, price, unit, gstPct, stockStatus, specification, warrantyYears } = req.body;
    if (!productName || !category) {
      return res.status(400).json({ success: false, error: 'Product name and category are required.' });
    }

    const prodId = id || ('PROD-' + Date.now().toString(36).toUpperCase());
    const prodSku = sku || ('SKU-' + prodId.replace('PROD-', ''));

    db.prepare(`
      INSERT INTO products (id, brand, category, product_name, material, thickness, mesh_size, color, unit, sku, price, gst_pct, stock_status, specification, warranty_years, is_active)
      VALUES (?, ?, ?, ?, 'HDPE Braided / Marine Grade', '2.5mm', '40mm', 'Green/Steel', ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET 
        product_name = excluded.product_name,
        brand = excluded.brand,
        category = excluded.category,
        unit = excluded.unit,
        sku = excluded.sku,
        price = excluded.price,
        gst_pct = excluded.gst_pct,
        stock_status = excluded.stock_status,
        specification = excluded.specification,
        warranty_years = excluded.warranty_years
    `).run(prodId, brand || 'GCM', category, productName, unit || 'SFT', prodSku, price || 0, gstPct || 18, stockStatus || 'IN_STOCK', specification || null, warrantyYears || 5);

    res.json({ success: true, message: 'Catalog product saved successfully.', productId: prodId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.delete('/catalog/items/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Product removed from catalog.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.post('/catalog/send-product', async (req, res) => {
  try {
    const { phone, productId, quantity = 1 } = req.body;
    if (!phone || !productId) {
      return res.status(400).json({ success: false, error: 'Phone and productId are required.' });
    }

    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
    if (!prod) return res.status(404).json({ success: false, error: 'Product not found.' });

    const total = (prod.price || 0) * quantity;
    const gstAmt = total * ((prod.gst_pct || 18) / 100);
    const grandTotal = Math.round(total + gstAmt);

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=upi://pay?pa=gcmenterprises@ybl%26pn=GCM%20ENTERPRISES%26am=${grandTotal}%26cu=INR`;

    let msg = `📦 *${prod.product_name.toUpperCase()}*\n`;
    msg += `• SKU: *${prod.sku || prod.id}*\n`;
    msg += `• Category: ${prod.category} (${prod.brand})\n`;
    msg += `• Price: *₹${prod.price}/${prod.unit}* (+${prod.gst_pct}% GST)\n`;
    msg += `• Quantity: *${quantity} ${prod.unit}*\n`;
    msg += `• Total Payable: *₹${grandTotal.toLocaleString('en-IN')}*\n`;
    if (prod.warranty_years) msg += `• Warranty: *${prod.warranty_years} Years Replacement Guarantee*\n`;
    msg += `\n`;
    msg += `🏛️ *DIRECT CORPORATE SETTLEMENT (0% GATEWAY FEE)*\n`;
    msg += `• SBI Current A/C: *44979437825* (IFSC: *SBIN0021462*)\n`;
    msg += `• ICICI Current A/C: *000805021234* (IFSC: *ICIC0000008*)\n`;
    msg += `• Instant UPI ID: *gcmenterprises@ybl* (GPay/PhonePe: *9912399224*)\n`;
    msg += `• Dynamic QR Code: ${qrUrl}\n\n`;
    msg += `Please transfer advance and reply with screenshot/UTR for immediate dispatch! 🙏`;

    const sendRes = await sendWhatsAppMessage(phone, msg);
    if (!sendRes.success) {
      return res.status(500).json({ success: false, error: 'WhatsApp delivery failed', details: sendRes });
    }

    // Record into conversation
    const sessionId = 'WA-' + phone.replace(/\D/g, '');
    let conv = db.prepare('SELECT messages FROM conversations WHERE session_id = ?').get(sessionId) as any;
    let history: any[] = [];
    if (conv) {
      try { history = JSON.parse(conv.messages || '[]'); } catch {}
    }
    const newMsg = {
      role: 'human_agent',
      content: msg,
      wamid: sendRes?.data?.messages?.[0]?.id || ('WAMID-PROD-' + Date.now()),
      receipt: 'sent',
      timestamp: new Date().toISOString()
    };
    history.push(newMsg);

    db.prepare('UPDATE conversations SET messages = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(JSON.stringify(history), sessionId);

    broadcastWhatsAppEvent('new_message', {
      phone,
      sessionId,
      message: newMsg,
      allMessages: history
    });

    res.json({ success: true, message: newMsg, grandTotal, qrUrl });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 6. Sales Pipeline Kanban Board (5 Standard States) ──────────────────────
adminRouter.get('/crm/kanban-leads', (req, res) => {
  try {
    const rawLeads = db.prepare(`
      SELECT l.*, w.brand_name 
      FROM leads l 
      LEFT JOIN websites w ON l.website_id = w.id 
      ORDER BY l.updated_at DESC
    `).all() as any[];

    // Normalize into 5 B2B SaaS CRM stages
    const kanban = {
      NEW_LEAD: [] as any[],
      CONTACTED: [] as any[],
      QUOTE_SENT: [] as any[],
      WON: [] as any[],
      LOST: [] as any[]
    };

    rawLeads.forEach(lead => {
      const stage = (lead.pipeline_stage || lead.stage || 'NEW_LEAD').toUpperCase();

      if (stage.includes('WON') || stage.includes('PAID') || stage.includes('CONFIRMED') || stage.includes('DISPATCHED') || stage.includes('COMPLETED')) {
        kanban.WON.push(lead);
      } else if (stage.includes('LOST') || stage.includes('REJECT') || stage.includes('COLD')) {
        kanban.LOST.push(lead);
      } else if (stage.includes('QUOTE') || stage.includes('ESTIMATE')) {
        kanban.QUOTE_SENT.push(lead);
      } else if (stage.includes('VISIT') || stage.includes('CONTACT') || stage.includes('ENGAG')) {
        kanban.CONTACTED.push(lead);
      } else {
        kanban.NEW_LEAD.push(lead);
      }
    });

    res.json({ success: true, kanban, totalLeads: rawLeads.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.post('/crm/leads/:id/stage', (req, res) => {
  try {
    const { stage, performedBy } = req.body;
    if (!stage) return res.status(400).json({ success: false, error: 'Target stage is required.' });

    const lead = db.prepare('SELECT id, phone, customer_name, pipeline_stage FROM leads WHERE id = ?').get(req.params.id) as any;
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found.' });

    db.prepare(`
      UPDATE leads 
      SET pipeline_stage = ?, stage = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(stage, stage, req.params.id);

    logLeadActivity(lead.id, 'STAGE_CHANGE', `Kanban card dragged/updated to ${stage}`, performedBy || 'AGENT');

    broadcastWhatsAppEvent('kanban_update', {
      leadId: lead.id,
      phone: lead.phone,
      newStage: stage,
      updatedAt: new Date().toISOString()
    });

    res.json({ success: true, message: `Lead moved to ${stage}`, leadId: lead.id, newStage: stage });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── 7. Universal Pricing Matrix Management & Previews ────────────────────────
adminRouter.get('/pricing/matrix', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products ORDER BY category ASC, product_name ASC').all();
    const pricingRules = db.prepare('SELECT * FROM pricing_rules ORDER BY product_id ASC').all();
    const overrides = db.prepare('SELECT * FROM pricing_overrides ORDER BY tenant_id ASC').all();
    
    res.json({
      success: true,
      matrix: {
        installedSafetyNetQualities: INSTALLED_SAFETY_NET_QUALITIES,
        cricketBraidedBagRates: BRAIDED_BAG_RATES,
        twisted15CricketSlabs: [
          { minSft: 500, maxSft: 3300, ratePerSft: 5.00, customizationPerSft: 0.50, gstPct: 5.0 },
          { minSft: 3301, maxSft: 5000, ratePerSft: 4.75, customizationPerSft: 0.50, gstPct: 5.0 },
          { minSft: 5001, maxSft: 10000, ratePerSft: 4.50, customizationPerSft: 0.50, gstPct: 5.0 },
          { minSft: 10001, maxSft: null, ratePerSft: 4.25, customizationPerSft: 0.50, gstPct: 5.0 }
        ],
        turfAccessories: TURF_ACCESSORIES_CATALOG,
        products,
        pricingRules,
        overrides
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.post('/pricing/update', (req, res) => {
  try {
    const { productId, tenantId = 'ALL', field, newValue, changedBy = 'ADMIN_USER', effectiveFrom } = req.body;
    if (!productId || !field || newValue === undefined) {
      return res.status(400).json({ success: false, error: 'productId, field, and newValue are required.' });
    }

    const currentProd = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
    if (!currentProd) return res.status(404).json({ success: false, error: 'Product not found.' });

    const oldValue = currentProd[field] ?? '';
    const effDate = effectiveFrom || new Date().toISOString().split('T')[0];

    if (['price', 'gst_pct', 'warranty_years', 'unit', 'specification', 'is_active'].includes(field)) {
      db.prepare(`UPDATE products SET ${field} = ? WHERE id = ?`).run(newValue, productId);
    }

    if (field === 'price') {
      db.prepare(`UPDATE pricing_rules SET rate_per_unit = ?, effective_from = ? WHERE product_id = ? AND customer_type = 'retail'`).run(newValue, effDate, productId);
    }

    const historyId = 'HIST-' + Date.now().toString(36).toUpperCase();
    db.prepare(`
      INSERT INTO price_history (id, product_id, tenant_id, field_changed, old_value, new_value, changed_by, effective_from)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(historyId, productId, tenantId, field, String(oldValue), String(newValue), changedBy, effDate);

    logLeadActivity('SYSTEM-PRICING', 'PRICE_CHANGE_AUDIT', `Updated ${field} of ${productId} from ${oldValue} to ${newValue} (effective ${effDate})`, changedBy);

    res.json({
      success: true,
      message: `Pricing updated for ${productId}`,
      auditId: historyId,
      oldValue,
      newValue,
      effectiveFrom: effDate
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.post('/pricing/preview', (req, res) => {
  try {
    const { calculationType, params } = req.body;
    if (!calculationType || !params) {
      return res.status(400).json({ success: false, error: 'calculationType and params are required.' });
    }

    let result: any;
    switch (calculationType) {
      case 'installed_net':
        result = calculateInstalledSafetyNet(params.qualityKey || '2.0mm_45mm', Number(params.actualAreaSft), params.rateMode || 'standard');
        break;
      case 'cricket_braided':
        result = calculateCricketBraidedBags({
          variant: params.variant || '2.5mm_45mm',
          fullBags: Number(params.fullBags || 0),
          halfBags: Number(params.halfBags || 0),
          mixedBagPolicy: params.mixedBagPolicy || 'SEPARATE_TIERS',
          gstRate: params.gstRate !== undefined ? Number(params.gstRate) : 5.0
        });
        break;
      case 'cricket_twisted_15':
        result = calculateTwisted15Netting(Number(params.sft), params.includeCustomization !== false);
        break;
      case 'turf_accessory':
        result = calculateTurfAccessory(params.accessoryKey, Number(params.quantity));
        break;
      case 'unified_turf':
        result = calculateUnifiedTurfEstimate({
          turfSft: params.turfSft ? Number(params.turfSft) : undefined,
          turfRatePerSft: params.turfRatePerSft ? Number(params.turfRatePerSft) : undefined,
          turfGstPct: params.turfGstPct ? Number(params.turfGstPct) : undefined,
          silicaSandKg: params.silicaSandKg ? Number(params.silicaSandKg) : undefined,
          rubberGranulesKg: params.rubberGranulesKg ? Number(params.rubberGranulesKg) : undefined,
          glueLiters: params.glueLiters ? Number(params.glueLiters) : undefined,
          seamingTapeMeters: params.seamingTapeMeters ? Number(params.seamingTapeMeters) : undefined,
          transportCharges: params.transportCharges ? Number(params.transportCharges) : undefined,
          transportGstPct: params.transportGstPct !== undefined ? Number(params.transportGstPct) : undefined
        });
        break;
      default:
        return res.status(400).json({ success: false, error: `Unsupported calculationType: ${calculationType}` });
    }

    res.json({ success: true, calculationType, result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.get('/pricing/history', (req, res) => {
  try {
    const history = db.prepare('SELECT h.*, p.product_name FROM price_history h LEFT JOIN products p ON h.product_id = p.id ORDER BY h.created_at DESC LIMIT 50').all();
    res.json({ success: true, history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.post('/pricing/rollback', (req, res) => {
  try {
    const { auditId, revertedBy = 'ADMIN_ROLLBACK' } = req.body;
    if (!auditId) {
      return res.status(400).json({ success: false, error: 'auditId is required for rollback.' });
    }

    const historyRecord = db.prepare('SELECT * FROM price_history WHERE id = ?').get(auditId) as any;
    if (!historyRecord) {
      return res.status(404).json({ success: false, error: `Audit record not found: ${auditId}` });
    }

    const { product_id, field_changed, old_value, new_value, tenant_id } = historyRecord;
    if (old_value === undefined || old_value === null) {
      return res.status(400).json({ success: false, error: 'Historical record has no old value to restore.' });
    }

    // Restore on products table
    if (['price', 'gst_pct', 'warranty_years', 'unit', 'specification', 'is_active'].includes(field_changed)) {
      db.prepare(`UPDATE products SET ${field_changed} = ? WHERE id = ?`).run(old_value, product_id);
    }

    // Restore on pricing_rules table if price changed
    if (field_changed === 'price') {
      db.prepare(`UPDATE pricing_rules SET rate_per_unit = ? WHERE product_id = ? AND customer_type = 'retail'`).run(Number(old_value), product_id);
    }

    const rollbackAuditId = 'HIST-RB-' + Date.now().toString(36).toUpperCase();
    const effDate = new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO price_history (id, product_id, tenant_id, field_changed, old_value, new_value, changed_by, effective_from)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(rollbackAuditId, product_id, tenant_id || 'ALL', `${field_changed} (ROLLBACK)`, String(new_value), String(old_value), revertedBy, effDate);

    logLeadActivity('SYSTEM-PRICING', 'PRICE_ROLLBACK', `Rolled back ${field_changed} of ${product_id} from ${new_value} to ${old_value}`, revertedBy);

    res.json({
      success: true,
      message: `Rolled back ${field_changed} of ${product_id} to ${old_value}`,
      rollbackAuditId,
      productId: product_id,
      restoredField: field_changed,
      restoredValue: old_value
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.post('/pricing/tenant-override', (req, res) => {
  try {
    const { tenantId, productId, overrideRate, gstPct, notes, effectiveFrom } = req.body;
    if (!tenantId || !productId || overrideRate === undefined) {
      return res.status(400).json({ success: false, error: 'tenantId, productId, and overrideRate are required.' });
    }

    const overrideId = `OVR-${tenantId}-${productId}`;
    const effDate = effectiveFrom || new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO pricing_overrides (id, tenant_id, product_id, override_rate, gst_pct, effective_from, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        override_rate = excluded.override_rate,
        gst_pct = excluded.gst_pct,
        effective_from = excluded.effective_from,
        notes = excluded.notes
    `).run(overrideId, tenantId, productId, overrideRate, gstPct ?? null, effDate, notes || null);

    res.json({ success: true, message: `Tenant override set for ${tenantId}`, overrideId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
