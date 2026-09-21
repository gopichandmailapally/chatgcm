import express from 'express';
import cors from 'cors';
import path from 'node:path';
import dotenv from 'dotenv';
import { initDatabase } from './db/database.js';
import { chatRouter } from './api/chat-routes.js';
import { crmRouter } from './api/crm-routes.js';
import { calculatorRouter } from './api/calculator-routes.js';
import { adminRouter } from './api/admin-routes.js';
import { whatsappRouter } from './api/whatsapp-routes.js';
import { startFollowUpScheduler } from './cron/follow-up-engine.js';

dotenv.config({ path: '/var/www/chatgcm.in/.env' });
dotenv.config();

// 1. Initialize Master Database
initDatabase();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3020;

// 2. Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 3. Static Assets (Command Center Dashboard, Widget JS, Demo)
const publicDir = path.resolve("/var/www/chatgcm.in/public");
app.use(express.static(publicDir));

// 4. API Routes
app.use('/api/chat', chatRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/chat/whatsapp-webhook', whatsappRouter); // convenient alias
app.use('/api/crm', crmRouter);
app.use('/api/calc', calculatorRouter);
app.use('/api/admin', adminRouter);

// Root redirect to Admin Dashboard
app.get('/', (req, res) => {
  res.redirect('/admin/');
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Chat GCM AI Sales Brain & Omnichannel Engine',
    version: '1.2.0',
    whatsappWebhook: 'https://chatgcm.in/api/whatsapp/webhook',
    timestamp: new Date().toISOString()
  });
});

// 5. Start Background Autonomous Schedulers
startFollowUpScheduler(15);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 Chat GCM AI Sales Brain & Omnichannel Engine Online`);
  console.log(`📡 API Server:         http://localhost:${PORT}`);
  console.log(`📊 Command Center:     http://localhost:${PORT}/admin/`);
  console.log(`📱 WhatsApp Webhook:   http://localhost:${PORT}/api/whatsapp/webhook`);
  console.log(`💬 Live Website Demo:  http://localhost:${PORT}/demo.html`);
  console.log(`🧩 Embeddable Widget:  http://localhost:${PORT}/widget/chat-gcm-widget.js`);
  console.log(`=======================================================`);
});
