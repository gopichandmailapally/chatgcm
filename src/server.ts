import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { initDatabase } from './db/database.js';
import { chatRouter } from './api/chat-routes.js';
import { crmRouter } from './api/crm-routes.js';
import { calculatorRouter } from './api/calculator-routes.js';
import { adminRouter } from './api/admin-routes.js';
import { whatsappRouter } from './api/whatsapp-routes.js';
import { startFollowUpScheduler } from './cron/follow-up-engine.js';
import { requireAuth, requireTenantScope } from './middleware/auth.js';

dotenv.config({ path: '/var/www/chatgcm.in/.env' });
dotenv.config();

// 1. Initialize Master Database
initDatabase();

export const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3020;

// 2. Multi-Tenant Strict CORS Configuration
const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*chatgcm\.in(?::\d+)?$/,
  /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*gcm\.enterprises(?::\d+)?$/,
  /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*gcmsafetynets\.in(?::\d+)?$/,
  /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*gcminvisiblegrills\.com(?::\d+)?$/,
  /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*nettingteam\.com(?::\d+)?$/,
  /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*netsocean\.com(?::\d+)?$/,
  /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*russea\.in(?::\d+)?$/,
  /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*zenxa\.in(?::\d+)?$/,
  /^https?:\/\/localhost(?::\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser agents, curl, mobile apps, or local scripts (where origin is undefined)
    if (!origin) return callback(null, true);
    const isAllowed = ALLOWED_ORIGIN_PATTERNS.some(pattern => pattern.test(origin));
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key', 'X-API-Key', 'X-Bridge-Token', 'X-Website-Id']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 3. Static Assets (Command Center Dashboard, Widget JS, Demo)
const publicDir = process.env.PUBLIC_DIR || (fs.existsSync('/var/www/chatgcm.in/public') ? '/var/www/chatgcm.in/public' : path.resolve(process.cwd(), 'public'));
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// 4. Public API Routes (Customer Chat & WhatsApp Webhook)
app.use('/api/chat', chatRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/chat/whatsapp-webhook', whatsappRouter); // convenient alias
app.use('/api/calc', calculatorRouter);

// 5. Protected Administrative & CRM Routes (Enforces Authentication & RBAC Tenant Scope)
app.use('/api/crm', requireAuth, requireTenantScope, crmRouter);
app.use('/api/admin', requireAuth, adminRouter);

// Root landing page (Phase 13: Serves public landing page, not redirecting to /admin/)
app.get('/', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      status: 'online',
      service: 'Chat GCM — Centralized Multi-Tenant AI Sales & Operations Platform',
      version: '1.2.0'
    });
  }
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

// 5. Start Background Autonomous Schedulers (Only in runtime mode, not during testing)
if (process.env.NODE_ENV !== 'test') {
  startFollowUpScheduler(15);
}

// 6. Start Web Server (Only in runtime mode, not during testing)
if (process.env.NODE_ENV !== 'test') {
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
}
