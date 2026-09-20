import { Router } from 'express';
import { db } from '../db/database.js';

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
