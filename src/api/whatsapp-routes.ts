/**
 * WhatsApp Cloud API Route Handlers
 * Handles Meta Webhook verification, inbound customer chat routing, test dispatch,
 * and live 2-way conversation management for the Command Center.
 */

import { Router } from 'express';
import { processChatConversation } from '../ai/orchestrator.js';
import {
  sendWhatsAppMessage,
  sendWhatsAppInteractiveButtons,
  sendWhatsAppDocument,
  markWhatsAppAsRead,
  isWhatsAppConfigured,
  formatPhoneNumber
} from '../whatsapp/whatsapp-client.js';
import { db } from '../db/database.js';

export const whatsappRouter = Router();

/**
 * 1. Webhook Verification (Meta Hub Challenge)
 */
whatsappRouter.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'gcm_whatsapp_verify_2026';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('✅ [WhatsApp Webhook] Meta challenge verified successfully!');
    res.status(200).send(challenge);
    return;
  }

  console.warn('❌ [WhatsApp Webhook] Verification token mismatch:', { received: token, expected: expectedToken });
  res.sendStatus(403);
});

/**
 * 2. Inbound Message Handler (Customer -> AI Sales Brain -> WhatsApp)
 */
whatsappRouter.post('/webhook', async (req, res) => {
  // Always return 200 OK immediately so Meta doesn't retry
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) return; // Status receipt (delivered/read), ignore

    const senderPhone = message.from; // e.g. "919912399224"
    const messageId = message.id;
    const contactProfile = value?.contacts?.[0]?.profile;
    const customerName = contactProfile?.name || 'WhatsApp Customer';

    // Extract text from text message or interactive button reply
    let incomingText = '';
    if (message.type === 'text') {
      incomingText = message.text?.body || '';
    } else if (message.type === 'interactive') {
      incomingText = message.interactive?.button_reply?.title || message.interactive?.button_reply?.id || '';
    }

    if (!incomingText.trim()) return;

    console.log(`💬 [WhatsApp Inbound] From ${customerName} (${senderPhone}): "${incomingText}"`);

    // Mark as read in WhatsApp UI
    await markWhatsAppAsRead(messageId);

    // Resolve Brand Website dynamically
    const cleanPhone = senderPhone.replace(/\D/g, '').slice(-10);
    const existingLead = db.prepare('SELECT website_id FROM leads WHERE phone LIKE ? ORDER BY created_at DESC LIMIT 1').get(`%${cleanPhone}%`) as any;
    
    let resolvedWebsiteId = existingLead?.website_id;
    if (!resolvedWebsiteId) {
      const lowerInbound = incomingText.toLowerCase();
      if (lowerInbound.includes('turnkey') || lowerInbound.includes('box cricket') || lowerInbound.includes('sports turf') || lowerInbound.includes('football')) {
        resolvedWebsiteId = 'gcm-enterprises';
      } else if (lowerInbound.includes('invisible grill') || lowerInbound.includes('ss grill')) {
        resolvedWebsiteId = 'gcminvisiblegrills';
      } else if (lowerInbound.includes('wholesale') || lowerInbound.includes('bag') || lowerInbound.includes('supply only') || lowerInbound.includes('bundles')) {
        resolvedWebsiteId = 'netsocean';
      } else if (lowerInbound.includes('bangalore')) {
        resolvedWebsiteId = 'gcmnetting';
      } else if (lowerInbound.includes('chennai')) {
        resolvedWebsiteId = 'gcmnettingsolutions';
      } else {
        resolvedWebsiteId = 'gcmsafetynets';
      }
    }

    // Call AI Sales Brain
    const aiResponse = await processChatConversation({
      websiteId: resolvedWebsiteId,
      sessionId: 'WA-' + senderPhone,
      customerName,
      phone: senderPhone,
      message: incomingText
    });

    console.log(`🤖 [WhatsApp AI Reply] To ${senderPhone}: "${aiResponse.reply.substring(0, 80)}..."`);

    // Send AI reply back to WhatsApp
    await sendWhatsAppMessage(senderPhone, aiResponse.reply);

    // If a quotation was generated, send PDF / Interactive link
    if (aiResponse.cardType === 'quotation' && aiResponse.cardData) {
      const viewUrl = aiResponse.cardData.officialViewUrl;
      if (viewUrl) {
        await sendWhatsAppInteractiveButtons(
          senderPhone,
          `📄 Your official GCM Estimation #${aiResponse.cardData.quoteNumber} is ready for download.`,
          [
            { id: 'view_quote', title: 'View Quotation PDF' },
            { id: 'confirm_order', title: 'Confirm Order' },
            { id: 'talk_engineer', title: 'Talk to Engineer' }
          ],
          'GCM Enterprises Quotation'
        );
      }
    }

  } catch (err) {
    console.error('❌ [WhatsApp Inbound Handler Error]', err);
  }
});

/**
 * 3. Status & Configuration Inspector
 */
whatsappRouter.get('/status', (req, res) => {
  const configured = isWhatsAppConfigured();
  res.json({
    success: true,
    configured,
    webhookUrl: 'https://chatgcm.in/api/whatsapp/webhook',
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
        city: r.customer_city || 'Hyderabad',
        estimatedValue: r.estimated_value || 0,
        humanTakeover: Boolean(r.human_takeover),
        updatedAt: r.updated_at,
        messageCount: parsedMessages.length,
        lastMessage: lastMsg ? {
          role: lastMsg.role,
          content: lastMsg.content,
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

    res.json({
      success: true,
      sessionId,
      phone,
      lead: lead || null,
      website: website || null,
      humanTakeover: conv ? Boolean(conv.human_takeover) : false,
      updatedAt: conv?.updated_at || new Date().toISOString(),
      messages
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

    // 2. Append to conversations table
    const sessionId = 'WA-' + phone;
    let conv = db.prepare('SELECT * FROM conversations WHERE session_id = ?').get(sessionId) as any;
    let history: any[] = [];
    if (conv) {
      try { history = JSON.parse(conv.messages || '[]'); } catch {}
    }
    
    const newMsg = {
      role: asHuman ? 'human_agent' : 'assistant',
      content: message,
      timestamp: new Date().toISOString()
    };
    history.push(newMsg);

    if (conv) {
      db.prepare(`
        UPDATE conversations 
        SET messages = ?, updated_at = CURRENT_TIMESTAMP, human_takeover = 1 
        WHERE session_id = ?
      `).run(JSON.stringify(history), sessionId);
    } else {
      db.prepare(`
        INSERT INTO conversations (id, website_id, channel, session_id, messages, human_takeover)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run('CONV-' + Date.now().toString(36), 'gcmsafetynets', 'whatsapp', sessionId, JSON.stringify(history));
    }

    res.json({ success: true, message: newMsg });
  } catch (err: any) {
    console.error('Error sending dashboard WhatsApp message:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 8. Toggle / Resume AI Autopilot
 */
whatsappRouter.post('/conversations/:phone/resume-ai', (req, res) => {
  try {
    const phone = req.params.phone.replace(/\D/g, '');
    const sessionId = 'WA-' + phone;
    db.prepare('UPDATE conversations SET human_takeover = 0 WHERE session_id = ?').run(sessionId);
    res.json({ success: true, message: 'AI Autopilot resumed successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
