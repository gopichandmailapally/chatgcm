/**
 * WhatsApp Cloud API Route Handlers
 * Handles Meta Webhook verification, inbound customer chat routing, and test dispatch.
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
 * Meta calls this when you configure the Callback URL in Meta App Dashboard
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

    // Call AI Sales Brain
    const aiResponse = await processChatConversation({
      websiteId: 'netsocean', // Primary sports & technical brand default, adapts to inquiry
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
        // Send interactive buttons or document link
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
 * 4. Manual Test Dispatcher (From Admin Command Center)
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
