/**
 * WhatsApp Cloud API Route Handlers
 * Ultra-Fast Webhook Ingestion Engine with Idempotency, Delivery Status Receipts,
 * Server-Sent Events (SSE) Live Stream, and Multi-Agent Human Takeover vs AI Autopilot.
 * 
 * Free Limited Access Edition — Valid till 01/01/2027 (No Payment Gateway / Packages required).
 */

import { Router, Response } from 'express';
import { processChatConversation } from '../ai/orchestrator.js';
import {
  sendWhatsAppMessage,
  sendWhatsAppInteractiveButtons,
  sendWhatsAppDocument,
  sendWhatsAppTemplate,
  markWhatsAppAsRead,
  isWhatsAppConfigured,
  formatPhoneNumber
} from '../whatsapp/whatsapp-client.js';
import { 
  db, 
  recordIdempotency, 
  updateIdempotencyStatus, 
  recordMessageReceipt, 
  getMessageReceiptsByPhone 
} from '../db/database.js';
import { logLeadActivity } from '../crm/lead-service.js';


export const whatsappRouter = Router();

// ── 0. Server-Sent Events (SSE) Live Broadcast Pool ─────────────────────────
const sseClients = new Set<Response>();

export function broadcastWhatsAppEvent(eventType: string, payload: any) {
  const data = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

/**
 * 0.1 SSE Stream Endpoint for Instant Live Dashboard Sync (<50ms latency)
 */
whatsappRouter.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ 
    status: 'connected', 
    edition: 'Free Limited Access Edition (Valid till 01/01/2027)',
    timestamp: new Date().toISOString() 
  })}\n\n`);

  sseClients.add(res);

  // Periodic heartbeat keepalive every 20s
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

/**
 * 1. Webhook Verification (Meta Hub Challenge)
 */
whatsappRouter.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'gcm_whatsapp_verify_2026';

  if (mode === 'subscribe' && (token === expectedToken || token === 'chatgcm_secure_webhook_token_2026' || token === 'gcm_whatsapp_verify_2026')) {
    console.log('✅ [WhatsApp Webhook] Meta challenge verified successfully!');
    res.status(200).send(challenge);
    return;
  }

  console.warn('❌ [WhatsApp Webhook] Verification token mismatch:', { received: token, expected: expectedToken });
  res.sendStatus(403);
});

/**
 * 2. Inbound Webhook Ingestion Engine
 * Handles sub-50ms acknowledgement, atomic idempotency deduplication,
 * delivery status receipts (sent/delivered/read/failed), and AI vs Human Takeover routing.
 */
whatsappRouter.post('/webhook', (req, res) => {
  // 1. Immediately return 200 OK so Meta doesn't retry
  res.status(200).send('EVENT_RECEIVED');

  // 2. Asynchronously process payload
  setImmediate(async () => {
    try {
      const body = req.body;
      if (body.object !== 'whatsapp_business_account') return;

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // ── Process Delivery Status Receipts (sent, delivered, read, failed) ──
      if (value?.statuses && Array.isArray(value.statuses)) {
        for (const st of value.statuses) {
          const wamid = st.id;
          const recipientPhone = st.recipient_id;
          const status = st.status; // 'sent' | 'delivered' | 'read' | 'failed'
          const err = st.errors?.[0];

          recordMessageReceipt(
            wamid,
            recipientPhone,
            status,
            err?.code ? String(err.code) : undefined,
            err?.title || err?.message,
            st.timestamp
          );

          // Broadcast live receipt update to all connected agents
          broadcastWhatsAppEvent('receipt_update', {
            wamid,
            recipientPhone,
            status,
            timestamp: st.timestamp,
            error: err ? { code: err.code, message: err.title || err.message } : null
          });

          console.log(`📬 [WhatsApp Receipt] ${recipientPhone} -> Status: ${status} (wamid: ${wamid.slice(-8)})`);
        }
      }

      // ── Process Inbound Customer Messages ──
      const message = value?.messages?.[0];
      if (!message) return; // Status receipt handled above, no message payload

      const senderPhone = message.from; // e.g. "919912399224"
      const messageId = message.id; // wamid
      const contactProfile = value?.contacts?.[0]?.profile;
      const customerName = contactProfile?.name || 'WhatsApp Customer';

      // ── Idempotency Check ────────────────────────────────────────────────
      const isNewMessage = recordIdempotency(messageId, senderPhone);
      if (!isNewMessage) {
        console.log(`⚡ [Idempotency] Duplicate message ${messageId} skipped.`);
        return;
      }

      // Extract message text or button payload
      let incomingText = '';
      if (message.type === 'text') {
        incomingText = message.text?.body || '';
      } else if (message.type === 'interactive') {
        incomingText = message.interactive?.button_reply?.title || message.interactive?.button_reply?.id || '';
      } else if (message.type === 'button') {
        incomingText = message.button?.text || message.button?.payload || '';
      }

      if (!incomingText.trim()) {
        updateIdempotencyStatus(messageId, 'PROCESSED');
        return;
      }

      console.log(`💬 [WhatsApp Inbound] From ${customerName} (+${senderPhone}): "${incomingText}"`);

      // Mark message as read in customer WhatsApp interface
      await markWhatsAppAsRead(messageId);

      // Session & Lead Resolution
      const cleanPhone = senderPhone.replace(/\D/g, '').slice(-10);
      const sessionId = 'WA-' + senderPhone;

      let conv = db.prepare('SELECT * FROM conversations WHERE session_id = ?').get(sessionId) as any;
      let history: any[] = [];
      if (conv) {
        try { history = JSON.parse(conv.messages || '[]'); } catch {}
      }

      const incomingMsgObj = {
        role: 'user',
        content: incomingText,
        wamid: messageId,
        timestamp: new Date().toISOString()
      };
      history.push(incomingMsgObj);

      // ── Auto-synchronize CRM Lead State based on incoming customer WhatsApp message ──
      const lowerText = incomingText.toLowerCase();
      let autoStage: string | null = null;
      if (lowerText.includes('cancel') || lowerText.includes('not interested') || lowerText.includes('no need') || lowerText.includes('dont want') || lowerText.includes('stop')) {
        autoStage = 'LOST';
      } else if (lowerText.includes('visit') || lowerText.includes('survey') || lowerText.includes('measurement') || lowerText.includes('call me') || lowerText.includes('address') || lowerText.includes('come tomorrow') || lowerText.includes('reach me') || lowerText.includes('maps.google') || lowerText.includes('goo.gl')) {
        autoStage = 'CONTACTED';
      } else {
        // Never jump straight to QUOTE_SENT or WON via keyword matching alone
        const existingLead = db.prepare('SELECT id, pipeline_stage FROM leads WHERE phone LIKE ? LIMIT 1').get(`%${cleanPhone}%`) as any;
        if (!existingLead || existingLead.pipeline_stage === 'NEW' || !existingLead.pipeline_stage) {
          autoStage = 'CONTACTED';
        }
      }

      if (autoStage) {
        const lead = db.prepare('SELECT id, pipeline_stage FROM leads WHERE phone LIKE ? LIMIT 1').get(`%${cleanPhone}%`) as any;
        if (lead && lead.pipeline_stage !== autoStage) {
          db.prepare('UPDATE leads SET pipeline_stage = ?, stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(autoStage, autoStage, lead.id);
          logLeadActivity(lead.id, 'STAGE_CHANGE', `WhatsApp AI Auto-Sync moved state to ${autoStage} based on message content`, 'AI_SYNCHRONIZER');
          broadcastWhatsAppEvent('kanban_update', { leadId: lead.id, newStage: autoStage, phone: senderPhone });
        }
      }

      // Check if Human Takeover is active on this thread
      let isHumanTakeoverActive = Boolean(conv?.human_takeover);

      // Auto-expire Human Takeover if there has been no human agent activity in the last 12 hours
      // OR if customer explicitly sends a greeting/request after > 2 hours of human inactivity
      if (isHumanTakeoverActive) {
        const lastHumanMsg = [...history].reverse().find((m: any) => m.role === 'human_agent');
        const lastHumanTime = lastHumanMsg?.timestamp ? new Date(lastHumanMsg.timestamp).getTime() : 0;
        const now = Date.now();
        const hoursSinceLastHuman = lastHumanTime > 0 ? (now - lastHumanTime) / (1000 * 60 * 60) : 999;

        const isExplicitAiRequest = /^(ai|bot|start|hi|hello|namaste|hey|help|quote|pricing|rate|need)/i.test(incomingText.trim());

        if (hoursSinceLastHuman > 12 || (hoursSinceLastHuman > 2 && isExplicitAiRequest)) {
          console.log(`⏱️ [Human Takeover Expired] Last human agent message was ${hoursSinceLastHuman.toFixed(1)}h ago for ${senderPhone}. Auto-resuming AI Autopilot.`);
          isHumanTakeoverActive = false;
          db.prepare('UPDATE conversations SET human_takeover = 0, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(sessionId);
          db.prepare('UPDATE leads SET human_takeover = 0 WHERE phone LIKE ?').run(`%${cleanPhone}%`);
          broadcastWhatsAppEvent('takeover_update', {
            phone: senderPhone,
            sessionId,
            humanTakeover: false
          });
        }
      }


      if (isHumanTakeoverActive) {
        // Human takeover active: do NOT reply with AI, notify human agents
        db.prepare(`
          UPDATE conversations 
          SET messages = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE session_id = ?
        `).run(JSON.stringify(history), sessionId);

        updateIdempotencyStatus(messageId, 'PROCESSED');

        broadcastWhatsAppEvent('new_message', {
          phone: senderPhone,
          sessionId,
          customerName,
          humanTakeover: true,
          alert: 'CUSTOMER_AWAITING_HUMAN',
          message: incomingMsgObj,
          allMessages: history
        });

        console.log(`👤 [Human Takeover Active] Customer message recorded for ${senderPhone}. AI muted, agent notified.`);
        return;
      }

      // ── AI Autopilot Execution ──────────────────────────────────────────
      const lower = incomingText.toLowerCase();
      let resolvedWebsiteId = 'gcmsafetynets';

      // Prioritize active product intent from customer's latest incoming message
      if (lower.includes('nettingteam') || senderPhone.includes('9912399334')) {
        resolvedWebsiteId = 'nettingteam';
      } else if (lower.includes('zenxa') || lower.includes('architectural')) {
        resolvedWebsiteId = 'zenxa';
      } else if (lower.includes('invisible grill') || lower.includes('ss grill') || lower.includes('wire grill')) {
        resolvedWebsiteId = 'gcminvisiblegrills';
      } else if (lower.includes('turnkey') || lower.includes('box cricket') || lower.includes('ground construction') || lower.includes('court construction') || lower.includes('cage fabrication')) {
        resolvedWebsiteId = 'gcm-enterprises';
      } else if (lower.includes('wholesale') || lower.includes('full bag') || lower.includes('half bag') || lower.includes('bundles') || lower.includes('material only') || lower.includes('supply only') || lower.includes('without installation') || lower.includes('russea')) {
        resolvedWebsiteId = 'netsocean';
      } else if (lower.includes('pigeon') || lower.includes('balcony') || lower.includes('safety net') || lower.includes('bird net') || lower.includes('cat net') || lower.includes('monkey net') || lower.includes('cloth hanger') || lower.includes('hanger') || lower.includes('drying') || lower.includes('grass') || lower.includes('turf') || lower.includes('artificial')) {
        resolvedWebsiteId = 'gcmsafetynets';
      } else if (lower.includes('bangalore') || lower.includes('bengaluru')) {
        resolvedWebsiteId = 'gcmnetting';
      } else if (lower.includes('chennai')) {
        resolvedWebsiteId = 'gcmnettingsolutions';
      } else {
        const existingLead = db.prepare('SELECT website_id FROM leads WHERE phone LIKE ? ORDER BY created_at DESC LIMIT 1').get(`%${cleanPhone}%`) as any;
        resolvedWebsiteId = existingLead?.website_id || 'gcmsafetynets';
      }

      const aiResponse = await processChatConversation({
        websiteId: resolvedWebsiteId,
        sessionId,
        customerName,
        phone: senderPhone,
        message: incomingText
      });

      console.log(`🤖 [WhatsApp AI Reply] To +${senderPhone}: "${aiResponse.reply.substring(0, 80)}..."`);

      // Send AI reply back to WhatsApp
      const sendResult = await sendWhatsAppMessage(senderPhone, aiResponse.reply);
      const outboundWamid = sendResult?.data?.messages?.[0]?.id || ('WAMID-OUT-' + Date.now());

      const aiMsgObj = {
        role: 'assistant',
        content: aiResponse.reply,
        wamid: outboundWamid,
        receipt: sendResult?.success ? 'sent' : 'failed',
        timestamp: new Date().toISOString()
      };
      history.push(aiMsgObj);

      // Save updated history
      if (conv) {
        db.prepare(`
          UPDATE conversations 
          SET messages = ?, last_receipt_status = 'sent', updated_at = CURRENT_TIMESTAMP 
          WHERE session_id = ?
        `).run(JSON.stringify(history), sessionId);
      } else {
        db.prepare(`
          INSERT INTO conversations (id, website_id, channel, session_id, messages, human_takeover, last_receipt_status)
          VALUES (?, ?, 'whatsapp', ?, ?, 0, 'sent')
        `).run('CONV-' + Date.now().toString(36), resolvedWebsiteId, sessionId, JSON.stringify(history));
      }

      // If quotation generated, send interactive action buttons
      if (aiResponse.cardType === 'quotation' && aiResponse.cardData) {
        const viewUrl = aiResponse.cardData.officialViewUrl;
        if (viewUrl) {
          await sendWhatsAppInteractiveButtons(
            senderPhone,
            `📄 Official GCM Quotation #${aiResponse.cardData.quoteNumber} is generated. Direct Bank & UPI payment accepted with 0% gateway commission.`,
            [
              { id: 'view_quote', title: 'View Quotation' },
              { id: 'confirm_order', title: 'Confirm Order' },
              { id: 'talk_engineer', title: 'Talk to Director' }
            ],
            'GCM Enterprises Quotation'
          );
        }
      }

      updateIdempotencyStatus(messageId, 'PROCESSED');

      // Live push to connected dashboard agents
      broadcastWhatsAppEvent('new_message', {
        phone: senderPhone,
        sessionId,
        customerName,
        humanTakeover: false,
        message: aiMsgObj,
        allMessages: history
      });

    } catch (err) {
      console.error('❌ [WhatsApp Inbound Handler Error]', err);
    }
  });
});

/**
 * 3. Status & Configuration Inspector
 */
whatsappRouter.get('/status', (req, res) => {
  const configured = isWhatsAppConfigured();
  res.json({
    success: true,
    system: 'ChatGCM Private Company Management System',
    type: 'Internal Company Operations (Not for Public Use)',
    organization: 'GCM Enterprises',
    validTill: '01/01/2027',
    settlement: 'Direct Corporate Accounts (SBI & ICICI Bank) + 0% Fee UPI QR',
    access: 'Authorized Internal Personnel Only',
    configured,
    activeStreamClients: sseClients.size,
    webhookUrl: 'https://chatgcm.in/api/whatsapp/webhook',
    streamUrl: 'https://chatgcm.in/api/whatsapp/stream',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'gcm_whatsapp_verify_2026',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ? 'Configured (Ends with ' + process.env.WHATSAPP_PHONE_NUMBER_ID.slice(-4) + ')' : 'Not Set',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || 'Not Set'
  });
});


/**
 * 4. Manual Test Dispatcher
 */
whatsappRouter.post('/send-test', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    res.status(400).json({ success: false, error: 'Phone and message are required.' });
    return;
  }

  const result = await sendWhatsAppMessage(phone, message);
  res.json(result);
});

/**
 * 5. Get All WhatsApp Conversations (For Live Command Center)
 */
whatsappRouter.get('/conversations', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        c.id,
        c.session_id,
        c.website_id,
        c.channel,
        c.messages,
        c.summary,
        c.human_takeover,
        c.priority,
        c.assigned_agent,
        c.last_receipt_status,
        c.updated_at,
        w.brand_name as website_name,
        w.domain as website_domain,
        w.primary_color as website_color,
        l.id as lead_id,
        l.customer_name,
        l.phone as customer_phone,
        l.stage as lead_stage, l.pipeline_stage,
        l.city as customer_city,
        l.estimated_value
      FROM conversations c
      LEFT JOIN websites w ON c.website_id = w.id
      LEFT JOIN leads l ON (c.session_id = 'WA-' || l.phone OR c.session_id = 'WA-' || l.whatsapp_number OR c.lead_id = l.id)
      WHERE c.channel = 'whatsapp' OR c.session_id LIKE 'WA-%'
      ORDER BY c.updated_at DESC
    `).all() as any[];

    const conversations = rows.map(r => {
      let parsedMessages: any[] = [];
      try { parsedMessages = JSON.parse(r.messages || '[]'); } catch {}
      const lastMsg = parsedMessages.length > 0 ? parsedMessages[parsedMessages.length - 1] : null;
      const phone = r.session_id.replace(/^WA-/, '') || r.customer_phone || '';
      
      return {
        id: r.id,
        sessionId: r.session_id,
        phone,
        customerName: r.customer_name || (phone === '919912399224' ? 'Gopichand (Owner Direct)' : 'WhatsApp Customer (+91 ' + phone.slice(-4) + ')'),
        websiteId: r.website_id,
        websiteName: r.website_name || 'GCM Safety Nets',
        websiteDomain: r.website_domain || 'gcmsafetynets.in',
        websiteColor: r.website_color || '#10b981',
        leadId: r.lead_id,
        leadStatus: r.lead_stage || r.pipeline_stage || 'IN_PROGRESS',
        priority: r.priority || 'P2',
        assignedAgent: r.assigned_agent || (r.human_takeover ? 'Owner Direct' : 'AI Sales Brain'),
        city: r.customer_city || 'Hyderabad',
        estimatedValue: r.estimated_value || 0,
        humanTakeover: Boolean(r.human_takeover),
        lastReceiptStatus: r.last_receipt_status || lastMsg?.receipt || 'sent',
        updatedAt: r.updated_at,
        messageCount: parsedMessages.length,
        lastMessage: lastMsg ? {
          role: lastMsg.role,
          content: lastMsg.content,
          wamid: lastMsg.wamid,
          receipt: lastMsg.receipt || 'sent',
          timestamp: lastMsg.timestamp
        } : null
      };
    });

    res.json({ success: true, conversations });
  } catch (err: any) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6. Get Single Conversation Thread by Phone
 */
whatsappRouter.get('/conversations/:phone', (req, res) => {
  try {
    const rawPhone = req.params.phone.replace(/\D/g, '');
    const sessionId = rawPhone.startsWith('WA-') ? rawPhone : 'WA-' + rawPhone;
    const phone = rawPhone.replace(/^WA-/, '');

    const conv = db.prepare('SELECT * FROM conversations WHERE session_id = ?').get(sessionId) as any;
    let messages: any[] = [];
    if (conv) {
      try { messages = JSON.parse(conv.messages || '[]'); } catch {}
    }

    const lead = db.prepare('SELECT * FROM leads WHERE phone = ? OR whatsapp_number = ? OR phone = ?').get(phone, phone, phone.slice(-10)) as any;
    const website = lead?.source_url ? db.prepare('SELECT * FROM websites WHERE domain = ?').get(lead.source_url) as any : null;
    const receipts = getMessageReceiptsByPhone(phone);

    res.json({
      success: true,
      sessionId,
      phone,
      lead: lead || null,
      website: website || null,
      humanTakeover: conv ? Boolean(conv.human_takeover) : false,
      priority: conv?.priority || lead?.priority || 'P2',
      assignedAgent: conv?.assigned_agent || (conv?.human_takeover ? 'Owner Direct' : 'AI Sales Brain'),
      lastReceiptStatus: conv?.last_receipt_status || 'sent',
      updatedAt: conv?.updated_at || new Date().toISOString(),
      messages,
      receipts
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 7. Send Manual Reply / Intervention from Dashboard
 */
whatsappRouter.post('/conversations/:phone/send', async (req, res) => {
  try {
    const phone = req.params.phone.replace(/\D/g, '');
    const { message, asHuman = true } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message content is required' });
    }

    // 1. Send via WhatsApp Meta Cloud API
    const sendResult = await sendWhatsAppMessage(phone, message);
    if (!sendResult.success) {
      return res.status(500).json({ success: false, error: 'WhatsApp delivery failed', details: sendResult });
    }

    const outboundWamid = sendResult?.data?.messages?.[0]?.id || ('WAMID-AGENT-' + Date.now());

    // 2. Append to conversations table with human_agent role
    const sessionId = 'WA-' + phone;
    let conv = db.prepare('SELECT * FROM conversations WHERE session_id = ?').get(sessionId) as any;
    let history: any[] = [];
    if (conv) {
      try { history = JSON.parse(conv.messages || '[]'); } catch {}
    }
    
    const newMsg = {
      role: asHuman ? 'human_agent' : 'assistant',
      content: message,
      wamid: outboundWamid,
      receipt: 'sent',
      timestamp: new Date().toISOString()
    };
    history.push(newMsg);

    if (conv) {
      db.prepare(`
        UPDATE conversations 
        SET messages = ?, updated_at = CURRENT_TIMESTAMP, human_takeover = 1, last_receipt_status = 'sent' 
        WHERE session_id = ?
      `).run(JSON.stringify(history), sessionId);
    } else {
      db.prepare(`
        INSERT INTO conversations (id, website_id, channel, session_id, messages, human_takeover, last_receipt_status)
        VALUES (?, ?, 'whatsapp', ?, ?, 1, 'sent')
      `).run('CONV-' + Date.now().toString(36), 'gcmsafetynets', sessionId, JSON.stringify(history));
    }

    // Broadcast live event to all agents
    broadcastWhatsAppEvent('new_message', {
      phone,
      sessionId,
      humanTakeover: true,
      message: newMsg,
      allMessages: history
    });

    res.json({ success: true, message: newMsg, wamid: outboundWamid });
  } catch (err: any) {
    console.error('Error sending dashboard WhatsApp message:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 8. Toggle Human Takeover vs AI Autopilot
 */
whatsappRouter.post('/conversations/:phone/toggle-takeover', (req, res) => {
  try {
    const phone = req.params.phone.replace(/\D/g, '');
    const sessionId = 'WA-' + phone;
    const { takeover } = req.body;

    let newStatus = 1;
    if (takeover !== undefined) {
      newStatus = takeover ? 1 : 0;
    } else {
      const conv = db.prepare('SELECT human_takeover FROM conversations WHERE session_id = ?').get(sessionId) as any;
      newStatus = conv && conv.human_takeover === 1 ? 0 : 1;
    }

    db.prepare('UPDATE conversations SET human_takeover = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(newStatus, sessionId);
    db.prepare('UPDATE leads SET human_takeover = ? WHERE phone LIKE ?').run(newStatus, `%${phone.slice(-10)}%`);

    broadcastWhatsAppEvent('takeover_update', {
      phone,
      sessionId,
      humanTakeover: Boolean(newStatus)
    });

    res.json({ 
      success: true, 
      humanTakeover: Boolean(newStatus),
      statusText: newStatus === 1 ? 'Human Takeover Active (AI Paused)' : 'AI Autopilot Resumed'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 9. Update Conversation Metadata (Priority, Stage, Assigned Agent) & Audit Logging
 */
whatsappRouter.post('/conversations/:phone/update-meta', (req, res) => {
  try {
    const phone = req.params.phone.replace(/\D/g, '');
    const clean10 = phone.slice(-10);
    const sessionId = 'WA-' + phone;
    const { priority, pipelineStage, assignedAgent, notes } = req.body;

    const lead = db.prepare('SELECT id, customer_name, pipeline_stage FROM leads WHERE phone LIKE ? LIMIT 1').get(`%${clean10}%`) as any;

    if (priority) {
      db.prepare('UPDATE conversations SET priority = ? WHERE session_id = ?').run(priority, sessionId);
      db.prepare('UPDATE leads SET priority = ? WHERE phone LIKE ?').run(priority, `%${clean10}%`);
      if (lead) {
        logLeadActivity(lead.id, 'PRIORITY_CHANGE', `Priority flagged as ${priority}`, assignedAgent || 'AGENT');
      }
    }

    if (assignedAgent) {
      db.prepare('UPDATE conversations SET assigned_agent = ? WHERE session_id = ?').run(assignedAgent, sessionId);
      db.prepare('UPDATE leads SET assigned_agent = ? WHERE phone LIKE ?').run(assignedAgent, `%${clean10}%`);
      if (lead) {
        logLeadActivity(lead.id, 'AGENT_ASSIGNED', `Assigned to ${assignedAgent}`, 'ADMIN');
      }
    }

    if (pipelineStage) {
      db.prepare('UPDATE leads SET pipeline_stage = ?, stage = ? WHERE phone LIKE ?').run(pipelineStage, pipelineStage, `%${clean10}%`);
      if (lead) {
        logLeadActivity(lead.id, 'STAGE_CHANGE', `Pipeline stage progressed to ${pipelineStage} from Command Center`, assignedAgent || 'AGENT');
      }
    }

    if (notes) {
      db.prepare('UPDATE leads SET notes = ? WHERE phone LIKE ?').run(notes, `%${clean10}%`);
      if (lead) {
        logLeadActivity(lead.id, 'NOTE_ADDED', `Internal Note: ${notes}`, assignedAgent || 'AGENT');
      }
    }

    broadcastWhatsAppEvent('lead_update', {
      phone,
      sessionId,
      priority,
      pipelineStage,
      assignedAgent
    });

    res.json({ success: true, message: 'Metadata and audit log updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 10. Get Delivery Receipts for a Phone Number
 */
whatsappRouter.get('/conversations/:phone/receipts', (req, res) => {
  try {
    const receipts = getMessageReceiptsByPhone(req.params.phone);
    res.json({ success: true, receipts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 11. Send Verified Bank & Dynamic UPI QR to Customer (Zero-Fee Direct Settlement)
 */
whatsappRouter.post('/conversations/:phone/send-bank-details', async (req, res) => {
  try {
    const rawPhone = req.params.phone.replace(/\D/g, '');
    const cleanPhone = rawPhone.slice(-10);
    const { amount, note, accountChoice } = req.body; // accountChoice: 'both' | 'sbi' | 'icici'

    const amtStr = amount ? ` (₹${Number(amount).toLocaleString('en-IN')})` : '';
    const amtParam = amount ? `%26am=${amount}` : '';
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi://pay?pa=gcmenterprises@ybl%26pn=GCM%20ENTERPRISES${amtParam}%26cu=INR`;

    let msg = `🏛️ *GCM ENTERPRISES — OFFICIAL SETTLEMENT DETAILS*\n`;
    msg += `Zero Gateway Fee • Direct Corporate Bank Settlement\n`;
    if (note) msg += `📌 *Purpose / Note*: ${note}\n`;
    if (amount) msg += `💰 *Booking / Advance Amount*: *₹${Number(amount).toLocaleString('en-IN')}*\n`;
    msg += `\n`;

    if (accountChoice !== 'icici') {
      msg += `🔹 *PRIMARY ACCOUNT: STATE BANK OF INDIA (SBI)*\n`;
      msg += `• Account Name: *GCM ENTERPRISES*\n`;
      msg += `• Current A/C No: *44979437825*\n`;
      msg += `• IFSC Code: *SBIN0021462*\n`;
      msg += `• Branch: *Greenpark Colony Branch, Hyderabad*\n\n`;
    }

    if (accountChoice !== 'sbi') {
      msg += `🔹 *SECONDARY ACCOUNT: ICICI BANK LIMITED*\n`;
      msg += `• Account Name: *GCM ENTERPRISES*\n`;
      msg += `• Current A/C No: *000805021234*\n`;
      msg += `• IFSC Code: *ICIC0000008*\n`;
      msg += `• Branch: *Banjara Hills, Hyderabad*\n\n`;
    }

    msg += `📲 *INSTANT 0% COMMISSION UPI SETTLEMENT*\n`;
    msg += `• Google Pay / PhonePe / Paytm / BHIM: *9912399224*\n`;
    msg += `• Primary UPI VPA: *gcmenterprises@ybl*\n`;
    msg += `• Alternate UPI VPA: *gcmenterprises@ybl*\n`;
    msg += `• Dynamic QR Code Link: ${qrUrl}\n\n`;
    msg += `⚠️ *Note*: After completing payment, please reply with a screenshot or UTR number in this chat for instant receipt generation and warranty registration! 🙏`;

    const sendRes = await sendWhatsAppMessage(rawPhone, msg);
    if (!sendRes.success) {
      return res.status(500).json({ success: false, error: 'Failed to send bank details via WhatsApp Cloud API', details: sendRes });
    }

    const outboundWamid = sendRes?.data?.messages?.[0]?.id || ('WAMID-BANK-' + Date.now());
    const sessionId = 'WA-' + rawPhone;
    let conv = db.prepare('SELECT * FROM conversations WHERE session_id = ?').get(sessionId) as any;
    let history: any[] = [];
    if (conv) {
      try { history = JSON.parse(conv.messages || '[]'); } catch {}
    }

    const newMsg = {
      role: 'human_agent',
      content: msg,
      wamid: outboundWamid,
      receipt: 'sent',
      timestamp: new Date().toISOString()
    };
    history.push(newMsg);

    if (conv) {
      db.prepare(`
        UPDATE conversations 
        SET messages = ?, updated_at = CURRENT_TIMESTAMP, human_takeover = 1, last_receipt_status = 'sent' 
        WHERE session_id = ?
      `).run(JSON.stringify(history), sessionId);
    } else {
      db.prepare(`
        INSERT INTO conversations (id, website_id, channel, session_id, messages, human_takeover, last_receipt_status)
        VALUES (?, 'gcmsafetynets', 'whatsapp', ?, ?, 1, 'sent')
      `).run('CONV-' + Date.now().toString(36), sessionId, JSON.stringify(history));
    }

    // Lead activity audit
    const lead = db.prepare('SELECT id FROM leads WHERE phone LIKE ? LIMIT 1').get(`%${cleanPhone}%`) as any;
    if (lead) {
      logLeadActivity(lead.id, 'BANK_DETAILS_DISPATCHED', `Official Bank Details${amtStr} & UPI QR dispatched to customer on WhatsApp`, 'AGENT');
    }

    broadcastWhatsAppEvent('new_message', {
      phone: rawPhone,
      sessionId,
      humanTakeover: true,
      message: newMsg,
      allMessages: history
    });

    res.json({ success: true, message: newMsg, qrUrl, wamid: outboundWamid });
  } catch (err: any) {
    console.error('Error dispatching bank details:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 12. Segmented Broadcast & Re-engagement Campaign Engine
 */
whatsappRouter.post('/broadcast', async (req, res) => {
  try {
    const { 
      targetFilter,      // 'all' | 'stage' | 'website' | 'selected'
      stage,             // e.g. 'NEW_INQUIRY', 'QUOTATION_SENT'
      websiteId,         // e.g. 'gcmsafetynets', 'netsocean'
      phones,            // Array of specific phone numbers
      messageText,       // Custom plain message
      templateName,      // Optional HSM template name
      languageCode = 'en'
    } = req.body;

    if (!messageText && !templateName) {
      return res.status(400).json({ success: false, error: 'Either messageText or templateName is required.' });
    }

    let query = `
      SELECT DISTINCT phone, whatsapp_number, customer_name, website_id, stage, pipeline_stage 
      FROM leads 
      WHERE (opt_out IS NULL OR opt_out = 0)
        AND phone IS NOT NULL AND phone != ''
    `;
    const params: any[] = [];

    if (targetFilter === 'stage' && stage) {
      query += ` AND (pipeline_stage = ? OR stage = ?)`;
      params.push(stage, stage);
    } else if (targetFilter === 'website' && websiteId) {
      query += ` AND website_id = ?`;
      params.push(websiteId);
    } else if (targetFilter === 'selected' && Array.isArray(phones) && phones.length > 0) {
      const placeholders = phones.map(() => '?').join(',');
      query += ` AND phone IN (${placeholders})`;
      params.push(...phones);
    }

    query += ` ORDER BY updated_at DESC LIMIT 100`;

    const recipients = db.prepare(query).all(...params) as any[];
    if (recipients.length === 0) {
      return res.json({ success: true, dispatched: 0, message: 'No eligible leads found for this segment.' });
    }

    // Process asynchronous paced delivery (80ms spacing to maintain high-throughput sub-second delivery)
    setImmediate(async () => {
      let sent = 0;
      let failed = 0;

      for (const r of recipients) {
        const targetPhone = r.whatsapp_number || r.phone;
        if (!targetPhone) continue;

        try {
          let sendResult: any;
          if (templateName) {
            sendResult = await sendWhatsAppTemplate(targetPhone, templateName, languageCode);
          } else {
            const personalized = messageText.replace(/{{name}}/gi, r.customer_name || 'Customer');
            sendResult = await sendWhatsAppMessage(targetPhone, personalized);
          }

          if (sendResult.success) {
            sent++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }

        // Pacing delay
        await new Promise(res => setTimeout(res, 80));
      }

      broadcastWhatsAppEvent('broadcast_completed', {
        total: recipients.length,
        sent,
        failed,
        timestamp: new Date().toISOString()
      });

      console.log(`📢 [Broadcast Completed] Sent: ${sent}, Failed: ${failed} of ${recipients.length}`);
    });

    res.json({
      success: true,
      message: `Broadcast initiated for ${recipients.length} segmented recipients.`,
      targetCount: recipients.length
    });
  } catch (err: any) {
    console.error('Error in broadcast engine:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 13. Assign Conversation to Team Agent (Multi-Agent Shared Inbox)
 */
whatsappRouter.post('/conversations/:phone/assign', (req, res) => {
  try {
    const rawPhone = req.params.phone.replace(/\D/g, '');
    const cleanPhone = rawPhone.slice(-10);
    const sessionId = 'WA-' + rawPhone;
    const { assignedAgent, assignedBy = 'ADMIN' } = req.body;

    if (!assignedAgent) return res.status(400).json({ success: false, error: 'Agent name is required.' });

    db.prepare('UPDATE conversations SET assigned_agent = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(assignedAgent, sessionId);
    db.prepare('UPDATE leads SET assigned_agent = ? WHERE phone LIKE ?').run(assignedAgent, `%${cleanPhone}%`);

    const lead = db.prepare('SELECT id FROM leads WHERE phone LIKE ? LIMIT 1').get(`%${cleanPhone}%`) as any;
    if (lead) {
      logLeadActivity(lead.id, 'AGENT_ASSIGNED', `Assigned to ${assignedAgent} by ${assignedBy}`, assignedBy);
    }

    try {
      db.prepare('UPDATE team_agents SET active_chats_count = active_chats_count + 1 WHERE name LIKE ?').run(`%${assignedAgent}%`);
    } catch {}

    broadcastWhatsAppEvent('lead_update', {
      phone: rawPhone,
      sessionId,
      assignedAgent,
      assignedBy,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: `Conversation assigned to ${assignedAgent}.`, assignedAgent });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 14. Internal Team Notes (Private Collaboration on WhatsApp Threads)
 */
whatsappRouter.get('/conversations/:phone/internal-notes', (req, res) => {
  try {
    const rawPhone = req.params.phone.replace(/\D/g, '');
    const sessionId = 'WA-' + rawPhone;
    const conv = db.prepare('SELECT internal_notes FROM conversations WHERE session_id = ?').get(sessionId) as any;
    let notes: any[] = [];
    if (conv?.internal_notes) {
      try { notes = JSON.parse(conv.internal_notes); } catch {}
    }
    res.json({ success: true, notes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

whatsappRouter.post('/conversations/:phone/internal-notes', (req, res) => {
  try {
    const rawPhone = req.params.phone.replace(/\D/g, '');
    const cleanPhone = rawPhone.slice(-10);
    const sessionId = 'WA-' + rawPhone;
    const { note, author = 'Gopichand' } = req.body;

    if (!note) return res.status(400).json({ success: false, error: 'Note text is required.' });

    let conv = db.prepare('SELECT internal_notes FROM conversations WHERE session_id = ?').get(sessionId) as any;
    let notes: any[] = [];
    if (conv?.internal_notes) {
      try { notes = JSON.parse(conv.internal_notes); } catch {}
    }

    const noteObj = {
      id: 'NOTE-' + Date.now().toString(36),
      author,
      note,
      timestamp: new Date().toISOString()
    };
    notes.push(noteObj);

    db.prepare('UPDATE conversations SET internal_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?')
      .run(JSON.stringify(notes), sessionId);

    const lead = db.prepare('SELECT id FROM leads WHERE phone LIKE ? LIMIT 1').get(`%${cleanPhone}%`) as any;
    if (lead) {
      logLeadActivity(lead.id, 'INTERNAL_NOTE', `[${author}] ${note}`, author);
    }

    broadcastWhatsAppEvent('internal_note_added', {
      phone: rawPhone,
      sessionId,
      note: noteObj
    });

    res.json({ success: true, note: noteObj, allNotes: notes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});


