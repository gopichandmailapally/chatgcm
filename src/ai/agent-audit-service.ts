/**
 * Agent Work Tracing & Performance Auditing Service
 * Tracks and logs all actions performed by regional sales personas in real-time.
 * Enables live inspection of who did what, when, and how each sales brain is performing.
 */

import { db } from '../db/database.js';
import crypto from 'node:crypto';

export type AgentActionType =
  | 'INQUIRY_ANSWERED'
  | 'ESTIMATE_CALCULATED'
  | 'QUOTATION_GENERATED'
  | 'DISCOUNT_APPLIED'
  | 'CALLBACK_SCHEDULED'
  | 'COMPETITOR_DEFENSE_RUSSEA'
  | 'SITE_VISIT_BOOKED'
  | 'BANK_DETAILS_SENT'
  | 'HUMAN_TAKEOVER_REQUESTED'
  | 'FOLLOWUP_SENT';

export interface AgentWorkEntry {
  persona_name: string;
  lead_id?: string | null;
  phone?: string | null;
  website_id?: string | null;
  channel?: string | null;
  city?: string | null;
  action_type: AgentActionType | string;
  action_title: string;
  work_summary: string;
  details?: any;
}

export function logAgentWork(entry: AgentWorkEntry): void {
  try {
    const id = 'LOG-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    const detailsJson = entry.details ? JSON.stringify(entry.details) : null;

    db.prepare(`
      INSERT INTO agent_work_logs (
        id, persona_name, lead_id, phone, website_id, channel, city,
        action_type, action_title, work_summary, details_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      id,
      entry.persona_name,
      entry.lead_id || null,
      entry.phone || null,
      entry.website_id || 'gcmsafetynets',
      entry.channel || 'web_chat',
      entry.city || 'Hyderabad',
      entry.action_type,
      entry.action_title,
      entry.work_summary,
      detailsJson
    );
  } catch (err) {
    console.error('Failed to log agent work audit:', err);
  }
}

export interface AgentKpi {
  name: string;
  city: string;
  region: string;
  language: string;
  avatar: string;
  totalInteractions: number;
  estimatesGiven: number;
  quotesSent: number;
  callbacksScheduled: number;
  russeaDefenses: number;
  discountsApproved: number;
  siteVisitsBooked: number;
  lastActive: string | null;
}

export function getAgentPerformanceSummary() {
  const agentDefs = [
    { name: 'Venkatesh', city: 'Hyderabad', region: 'Telangana', language: 'Telugu / English', avatar: '👨‍💼' },
    { name: 'Suresh Reddy', city: 'Vijayawada / Visakhapatnam', region: 'Andhra Pradesh', language: 'Telugu / English', avatar: '👨‍💼' },
    { name: 'Chethan Kumar', city: 'Bengaluru', region: 'Karnataka', language: 'Kannada / English', avatar: '👨‍💼' },
    { name: 'Karthik', city: 'Chennai', region: 'Tamil Nadu', language: 'Tamil / English', avatar: '👨‍💼' },
    { name: 'Rahul Kulkarni', city: 'Mumbai / Pune', region: 'Maharashtra', language: 'Hindi / Marathi / English', avatar: '👨‍💼' },
    { name: 'Rohit Sharma', city: 'Delhi NCR', region: 'North India', language: 'Hindi / English', avatar: '👨‍💼' },
  ];

  let rows: any[] = [];
  try {
    rows = db.prepare(`
      SELECT 
        persona_name,
        action_type,
        COUNT(*) as count,
        MAX(created_at) as last_action_time
      FROM agent_work_logs
      GROUP BY persona_name, action_type
    `).all() as any[];
  } catch (e) {
    rows = [];
  }

  const agents: AgentKpi[] = agentDefs.map(def => {
    const pRows = rows.filter(r => r.persona_name === def.name);
    let totalInteractions = 0;
    let estimatesGiven = 0;
    let quotesSent = 0;
    let callbacksScheduled = 0;
    let russeaDefenses = 0;
    let discountsApproved = 0;
    let siteVisitsBooked = 0;
    let lastActive: string | null = null;

    for (const r of pRows) {
      totalInteractions += r.count;
      if (!lastActive || r.last_action_time > lastActive) {
        lastActive = r.last_action_time;
      }
      if (r.action_type === 'ESTIMATE_CALCULATED') estimatesGiven += r.count;
      else if (r.action_type === 'QUOTATION_GENERATED') quotesSent += r.count;
      else if (r.action_type === 'CALLBACK_SCHEDULED') callbacksScheduled += r.count;
      else if (r.action_type === 'COMPETITOR_DEFENSE_RUSSEA') russeaDefenses += r.count;
      else if (r.action_type === 'DISCOUNT_APPLIED') discountsApproved += r.count;
      else if (r.action_type === 'SITE_VISIT_BOOKED') siteVisitsBooked += r.count;
    }

    return {
      name: def.name,
      city: def.city,
      region: def.region,
      language: def.language,
      avatar: def.avatar,
      totalInteractions,
      estimatesGiven,
      quotesSent,
      callbacksScheduled,
      russeaDefenses,
      discountsApproved,
      siteVisitsBooked,
      lastActive
    };
  });

  let recentLogs: any[] = [];
  let totalActionsCount = 0;
  let totalRusseaDefenses = 0;
  let totalQuotesSent = 0;
  let totalCallbacksScheduled = 0;

  try {
    recentLogs = db.prepare(`
      SELECT * 
      FROM agent_work_logs 
      ORDER BY created_at DESC 
      LIMIT 50
    `).all();

    totalActionsCount = (db.prepare('SELECT COUNT(*) as c FROM agent_work_logs').get() as any)?.c || 0;
    totalRusseaDefenses = (db.prepare("SELECT COUNT(*) as c FROM agent_work_logs WHERE action_type = 'COMPETITOR_DEFENSE_RUSSEA'").get() as any)?.c || 0;
    totalQuotesSent = (db.prepare("SELECT COUNT(*) as c FROM agent_work_logs WHERE action_type = 'QUOTATION_GENERATED'").get() as any)?.c || 0;
    totalCallbacksScheduled = (db.prepare("SELECT COUNT(*) as c FROM agent_work_logs WHERE action_type = 'CALLBACK_SCHEDULED'").get() as any)?.c || 0;
  } catch (e) {
    // Fresh table
  }

  return {
    agents,
    recentLogs,
    summary: {
      totalActionsCount,
      totalRusseaDefenses,
      totalQuotesSent,
      totalCallbacksScheduled
    }
  };
}

export function getAgentLogs(filter?: { persona?: string; action?: string; limit?: number; offset?: number }) {
  const limit = filter?.limit || 50;
  const offset = filter?.offset || 0;
  let query = 'SELECT * FROM agent_work_logs WHERE 1=1';
  const params: any[] = [];

  if (filter?.persona) {
    query += ' AND persona_name = ?';
    params.push(filter.persona);
  }
  if (filter?.action) {
    query += ' AND action_type = ?';
    params.push(filter.action);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  try {
    const logs = db.prepare(query).all(...params);
    let countQuery = 'SELECT COUNT(*) as c FROM agent_work_logs WHERE 1=1';
    const countParams: any[] = [];
    if (filter?.persona) {
      countQuery += ' AND persona_name = ?';
      countParams.push(filter.persona);
    }
    if (filter?.action) {
      countQuery += ' AND action_type = ?';
      countParams.push(filter.action);
    }
    const total = (db.prepare(countQuery).get(...countParams) as any)?.c || 0;
    return { total, logs, limit, offset };
  } catch (e) {
    return { total: 0, logs: [], limit, offset };
  }
}
