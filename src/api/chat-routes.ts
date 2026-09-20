import { Router } from 'express';
import { processChatConversation } from '../ai/orchestrator.js';
import { db } from '../db/database.js';

export const chatRouter = Router();

// Main Multi-Tenant Chat Endpoint
chatRouter.post('/', async (req, res) => {
  try {
    const { websiteId, sessionId, customerName, phone, message } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ success: false, error: 'Message is required.' });
      return;
    }

    const response = await processChatConversation({
      websiteId: websiteId || 'netsocean',
      sessionId,
      customerName,
      phone,
      message
    });

    res.json({ success: true, ...response });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal AI engine error' });
  }
});

// Fetch conversation history
chatRouter.get('/history/:sessionId', (req, res) => {
  try {
    const conv = db.prepare('SELECT * FROM conversations WHERE session_id = ?').get(req.params.sessionId) as any;
    if (!conv) {
      res.status(404).json({ success: false, error: 'Conversation not found' });
      return;
    }
    res.json({ success: true, conversation: conv, messages: JSON.parse(conv.messages || '[]') });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
