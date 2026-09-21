import { Router } from 'express';
import { db } from '../db/database.js';
import { knowledgeEngine } from '../ai/knowledge-engine.js';
import { getAgentPerformanceSummary, getAgentLogs } from '../ai/agent-audit-service.js';

export const adminRouter = Router();

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

adminRouter.post('/ai/sync-knowledge', (req, res) => {
  try {
    knowledgeEngine.crawlServerWebsites();
    const all = knowledgeEngine.getAllWebsitesKnowledge();
    res.json({
      success: true,
      syncedWebsitesCount: all.length,
      websites: all.map(w => ({
        id: w.websiteId,
        brand: w.brandName,
        domain: w.domain,
        pillar: w.primaryPillar,
        focus: w.primaryFocus,
        cities: w.serviceCities,
        lastIndexed: w.lastIndexed
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.get('/ai/knowledge', (req, res) => {
  try {
    const all = knowledgeEngine.getAllWebsitesKnowledge();
    const rateCards = knowledgeEngine.getRateCards();
    res.json({
      success: true,
      websites: all,
      rateCards
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.get('/agents/performance', (req, res) => {
  try {
    const summary = getAgentPerformanceSummary();
    res.json({
      success: true,
      ...summary
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

adminRouter.get('/agents/logs', (req, res) => {
  try {
    const { persona, action, limit, offset } = req.query;
    const result = getAgentLogs({
      persona: persona ? String(persona) : undefined,
      action: action ? String(action) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 50,
      offset: offset ? parseInt(String(offset), 10) : 0
    });
    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

