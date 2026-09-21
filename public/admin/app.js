/**
 * ChatGCM 2.0 — Executive AI Command Center
 * Modern Omnichannel Engine & Live WhatsApp Web Controller
 * Official Meta Cloud API: +91 99123 99334
 */

// Global State
let currentTab = 'whatsapp-hub';
let selectedWebsite = 'all';
let allLeads = [];
let allConversations = [];
let activeChatPhone = null;
let activeChatLead = null;
let pollingInterval = null;
let noWaLeads = [];

// Website metadata dictionary (9 Official GCM Portals)
const GCM_WEBSITES = {
  'gcmsafetynets': {
    name: 'GCM Safety Nets',
    domain: 'gcmsafetynets.in',
    color: '#059669',
    badgeClass: 'badge-green',
    city: 'Hyderabad & Regional',
    primaryProduct: 'Balcony & Pigeon Safety Nets'
  },
  'netsocean': {
    name: 'NetsOcean Wholesale',
    domain: 'netsocean.com',
    color: '#14b8a6',
    badgeClass: 'badge-cyan',
    city: 'Pan-India B2B Supply',
    primaryProduct: 'Sports Turf Nets & HDPE Bundles'
  },
  'gcm-enterprises': {
    name: 'GCM Enterprises',
    domain: 'gcm.enterprises',
    color: '#f59e0b',
    badgeClass: 'badge-amber',
    city: 'Pan-India Corporate',
    primaryProduct: 'Turnkey Sports & Construction'
  },
  'ushaleads': {
    name: 'Usha Leads',
    domain: 'ushaleads.in',
    color: '#8b5cf6',
    badgeClass: 'badge-indigo',
    city: 'Verified Portal Inquiries',
    primaryProduct: 'Residential Netting Direct Inquiries'
  },
  'netsdial': {
    name: 'NetsDial Directory',
    domain: 'netsdial.com',
    color: '#ec4899',
    badgeClass: 'badge-pink',
    city: 'Telangana & AP Network',
    primaryProduct: 'Local Safety Net Network'
  },
  'gcminvisiblegrills': {
    name: 'GCM Invisible Grills',
    domain: 'gcminvisiblegrills.com',
    color: '#6366f1',
    badgeClass: 'badge-indigo',
    city: 'Premium Residential',
    primaryProduct: 'AISI 316 Marine Invisible Grills'
  },
  'gcmnetting': {
    name: 'GCM Netting Bangalore',
    domain: 'gcmnetting.com',
    color: '#2563eb',
    badgeClass: 'badge-blue',
    city: 'Bangalore & Karnataka',
    primaryProduct: 'Apartment & Balcony Nets'
  },
  'russea': {
    name: 'RUSSEA™ Branded Nets',
    domain: 'russea.in',
    color: '#10b981',
    badgeClass: 'badge-green',
    city: 'Commercial & Export',
    primaryProduct: 'High-Tenacity ISO Branded Nets'
  },
  'gcmnettingsolutions': {
    name: 'GCM Netting Solutions',
    domain: 'gcmnettingsolutions.com',
    color: '#0284c7',
    badgeClass: 'badge-blue',
    city: 'Chennai & Tamil Nadu',
    primaryProduct: 'Balcony & Industrial Safety Nets'
  }
};

// ── Initialization ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabNavigation();
  loadAllData();
  startAutoRefresh();

  // Listen for ESC key to close any modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    }
  });
});

function initTabNavigation() {
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
  });
}

function switchTab(tabId) {
  currentTab = tabId;

  // Update nav buttons
  document.querySelectorAll('.nav-item[data-tab]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
  });

  // Update panels
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${tabId}`);
  });

  // Update Header Titles
  const headers = {
    'whatsapp-hub': [
      'Live WhatsApp Conversation Hub',
      'Autonomous AI customer engagement on +91 99123 99334 across all 9 GCM websites'
    ],
    'kanban': [
      'Omnichannel Lead Pipeline (Kanban)',
      'Visual 5-stage tracking from initial inquiry to final delivered installation'
    ],
    'leads': [
      'Hot Leads Master CRM',
      'Dense customer roster across all channels (Web, Phone Call, WhatsApp, UshaLeads)'
    ],
    'quotations': [
      'Turnkey Quotations & Estimations',
      'Sequential quotations with SBI Bank A/C 44979437825 and UPI 9912399224@sbi'
    ],
    'logistics': [
      'Logistics & Bilty Docket Tracker',
      'Consignments in-transit with automated 48-hour delivery follow-up'
    ],
    'websites': [
      '9 Official GCM Websites Sync',
      'Unified brand portfolio, real-time ingestion, and traffic status'
    ],
    'approvals': [
      'Owner Decision Queue',
      'Negotiation exceptions and discount approvals (> 4% guardrail)'
    ],
    'agent-audit': [
      'Regional Agent Performance & Real-Time Audit Trail',
      'Audit log of regional human personas defending RUSSEA™ registered trademark and driving sales'
    ]
  };

  if (headers[tabId]) {
    document.getElementById('tab-heading').textContent = headers[tabId][0];
    document.getElementById('tab-subheading').textContent = headers[tabId][1];
  }

  // Tab-specific initializations
  if (tabId === 'whatsapp-hub') {
    loadWhatsAppConversations();
  } else if (tabId === 'kanban') {
    renderKanbanBoard();
  } else if (tabId === 'leads') {
    renderLeadsTable();
  } else if (tabId === 'quotations') {
    loadQuotations();
  } else if (tabId === 'logistics') {
    renderLogisticsTable();
  } else if (tabId === 'websites') {
    renderWebsitesGrid();
  } else if (tabId === 'approvals') {
    loadApprovals();
  } else if (tabId === 'agent-audit') {
    loadAgentPerformance();
  }
}

// ── Master Data Loader ─────────────────────────────────────────────────────────
async function loadAllData() {
  try {
    await Promise.allSettled([
      fetchStats(),
      fetchLeads(),
      loadWhatsAppConversations(),
      checkNoWhatsAppAlerts(),
      loadQuotations(),
      loadApprovals(),
      loadAgentPerformance(true)
    ]);
  } catch (err) {
    console.error('Error loading master data:', err);
  }
}

function startAutoRefresh() {
  if (pollingInterval) clearInterval(pollingInterval);
  // Auto-refresh every 5 seconds for real-time live WhatsApp and lead updates
  pollingInterval = setInterval(async () => {
    if (currentTab === 'whatsapp-hub' && activeChatPhone) {
      loadActiveChatMessages(activeChatPhone, false); // silent background reload
    }
    // Periodic light refresh
    fetchStats(true);
  }, 5000);
}

// ── Brand Filtering (9 Websites) ──────────────────────────────────────────────
function filterByWebsite(siteKey) {
  selectedWebsite = siteKey;
  document.querySelectorAll('.brand-pill').forEach(pill => {
    pill.classList.toggle('active', pill.getAttribute('data-site') === siteKey);
  });

  if (currentTab === 'kanban') {
    renderKanbanBoard();
  } else if (currentTab === 'leads') {
    renderLeadsTable();
  } else if (currentTab === 'whatsapp-hub') {
    renderWhatsAppThreadsList();
  }
}

// ── 1. Live WhatsApp Hub ───────────────────────────────────────────────────────
async function loadWhatsAppConversations() {
  try {
    const res = await fetch('/api/whatsapp/conversations');
    const data = await res.json();
    if (data.success && Array.isArray(data.conversations)) {
      allConversations = data.conversations;
      document.getElementById('stat-wa-chats').textContent = allConversations.length;
      document.getElementById('wa-active-count').textContent = allConversations.length;
      renderWhatsAppThreadsList();

      // If no chat selected yet and conversations exist, select first thread
      if (!activeChatPhone && allConversations.length > 0) {
        selectConversation(allConversations[0].phone);
      }
    }
  } catch (err) {
    console.error('Failed to load WhatsApp conversations:', err);
  }
}

function renderWhatsAppThreadsList() {
  const container = document.getElementById('wa-threads-list');
  const query = (document.getElementById('wa-search-input')?.value || '').toLowerCase().trim();

  let filtered = allConversations.filter(c => {
    const custName = c.customerName || c.customer_name || '';
    const lastContent = typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.content || '');
    if (!query) return true;
    return custName.toLowerCase().includes(query) ||
           (c.phone && c.phone.includes(query)) ||
           lastContent.toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
        <i class="fab fa-whatsapp" style="font-size: 24px; opacity:0.5; margin-bottom:8px; display:block;"></i>
        No active WhatsApp conversations found
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(c => {
    const cleanPhone = (c.phone || '').replace(/\D/g, '');
    const isActive = activeChatPhone === cleanPhone;
    const custName = c.customerName || c.customer_name || ('Client +' + cleanPhone.slice(-4));
    const initial = custName.charAt(0).toUpperCase();
    const lastTime = c.lastTimestamp || c.lastMessage?.timestamp || c.updatedAt;
    const timeStr = lastTime ? formatTimestamp(lastTime) : '';
    const lastSnippet = escapeHtml(typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.content || 'Connected to WhatsApp'));
    const isOwner = (typeof c.lastMessage === 'object' ? c.lastMessage?.role : c.role) === 'assistant';
    const isHuman = c.humanTakeover || c.human_takeover;

    return `
      <div class="wa-thread-card ${isActive ? 'active' : ''}" onclick="selectConversation('${cleanPhone}')">
        <div class="wa-thread-avatar">${initial}</div>
        <div class="wa-thread-info">
          <div class="wa-thread-row">
            <span class="wa-thread-name">${escapeHtml(custName)}</span>
            <span class="wa-thread-time">${timeStr}</span>
          </div>
          <div class="wa-thread-row">
            <span class="wa-thread-snippet">${isOwner ? '<span style="color:var(--accent-green);">You: </span>' : ''}${lastSnippet}</span>
            ${isHuman ? '<span class="badge badge-amber" style="font-size:9px; padding:2px 4px;">Human Takeover</span>' : '<span class="badge badge-green" style="font-size:9px; padding:2px 4px;">AI Active</span>'}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterWhatsAppThreads() {
  renderWhatsAppThreadsList();
}

async function selectConversation(phone) {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  activeChatPhone = cleanPhone;
  
  // Highlight active card
  document.querySelectorAll('.wa-thread-card').forEach(el => {
    el.classList.remove('active');
  });

  // Find thread details
  const thread = allConversations.find(c => (c.phone || '').replace(/\D/g, '') === cleanPhone);
  const displayName = thread?.customerName || thread?.customer_name || ('Client +' + cleanPhone.slice(-4));
  
  document.getElementById('active-chat-name').textContent = displayName;
  document.getElementById('active-chat-phone').textContent = `+${cleanPhone}`;
  document.getElementById('active-chat-avatar').textContent = displayName.charAt(0).toUpperCase();

  // Show action bar & composer
  document.getElementById('active-chat-actions').style.display = 'flex';
  document.getElementById('wa-quick-chips').style.display = 'flex';
  document.getElementById('wa-composer-area').style.display = 'flex';

  // Update AI Autopilot Button state
  updateAutoPilotBtn(thread?.humanTakeover || thread?.human_takeover);

  // Load message stream
  await loadActiveChatMessages(cleanPhone, true);
}

async function loadActiveChatMessages(phone, shouldScroll = true) {
  const container = document.getElementById('wa-messages-stream');
  try {
    const res = await fetch(`/api/whatsapp/conversations/${phone}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.messages)) {
      activeChatLead = data.lead || null;
      renderMessages(data.messages);
      if (shouldScroll) {
        setTimeout(scrollToBottom, 50);
      }
    }
  } catch (err) {
    console.error('Failed to load active chat messages:', err);
  }
}

function renderMessages(messages) {
  const container = document.getElementById('wa-messages-stream');
  if (messages.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 40px; color:var(--text-muted);">
        <i class="fab fa-whatsapp" style="font-size: 32px; color:var(--accent-green); margin-bottom: 10px; display:block;"></i>
        New conversation initialized. Type a message below to greet this customer directly from +91 99123 99334!
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map(m => {
    const isOutbound = m.role === 'assistant' || m.role === 'user_owner';
    const isCustomer = m.role === 'user' || m.role === 'customer';
    const bubbleClass = isOutbound ? 'outgoing' : 'incoming';
    const senderLabel = isOutbound ? 'GCM AI / Owner (+91 99123 99334)' : (activeChatLead?.customer_name || 'Customer');
    const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const formattedContent = escapeHtml(m.content || '').replace(/\n/g, '<br>');

    return `
      <div class="wa-message-bubble ${bubbleClass}">
        <span class="wa-msg-sender">${senderLabel}</span>
        <div class="wa-msg-text">${formattedContent}</div>
        <span class="wa-msg-meta">${timeStr} ${isOutbound ? '✓✓' : ''}</span>
      </div>
    `;
  }).join('');
}

function scrollToBottom() {
  const container = document.getElementById('wa-messages-stream');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

async function sendManualWhatsAppReply() {
  const input = document.getElementById('wa-message-input');
  const message = input.value.trim();
  if (!message || !activeChatPhone) return;

  input.value = '';
  input.focus();

  // Optimistically append outgoing bubble
  const container = document.getElementById('wa-messages-stream');
  const tempDiv = document.createElement('div');
  tempDiv.className = 'wa-message-bubble outgoing';
  tempDiv.innerHTML = `
    <span class="wa-msg-sender">GCM Owner (+91 99123 99334)</span>
    <div class="wa-msg-text">${escapeHtml(message).replace(/\n/g, '<br>')}</div>
    <span class="wa-msg-meta">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Sending...</span>
  `;
  container.appendChild(tempDiv);
  scrollToBottom();

  try {
    const res = await fetch(`/api/whatsapp/conversations/${activeChatPhone}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    if (!data.success) {
      alert('Failed to send message: ' + (data.error || 'Unknown error'));
    }
    // Refresh conversation
    loadActiveChatMessages(activeChatPhone, true);
    loadWhatsAppConversations();
  } catch (err) {
    alert('Error sending WhatsApp message: ' + err.message);
  }
}

function sendQuickReply(text) {
  const input = document.getElementById('wa-message-input');
  if (input) {
    input.value = text;
    sendManualWhatsAppReply();
  }
}

function callActiveCustomer() {
  if (activeChatPhone) {
    window.open(`tel:+${activeChatPhone}`, '_self');
  }
}

function quickSendQuoteToActiveChat() {
  if (!activeChatPhone) return;
  const lead = activeChatLead || allLeads.find(l => l.phone && l.phone.replace(/\D/g, '') === activeChatPhone);
  if (lead) {
    openQuotationModal(lead.id);
  } else {
    // Open modal with prefilled phone
    document.getElementById('dq-lead-id').value = '';
    document.getElementById('dq-customer-info').value = `Customer (+${activeChatPhone})`;
    calculateQuoteTotal();
    openModal('modal-dispatch-quotation');
  }
}

function updateAutoPilotBtn(humanTakeover) {
  const btn = document.getElementById('btn-toggle-autopilot');
  if (!btn) return;
  if (humanTakeover) {
    btn.className = 'btn btn-danger btn-sm';
    btn.innerHTML = '<i class="fas fa-hand-paper"></i> Human Takeover: Active (Click to Resume AI)';
  } else {
    btn.className = 'btn btn-green btn-sm';
    btn.innerHTML = '<i class="fas fa-robot"></i> AI Auto-Pilot: ON';
  }
}

async function toggleAutoPilot() {
  if (!activeChatPhone) return;
  try {
    const res = await fetch(`/api/whatsapp/conversations/${activeChatPhone}/resume-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      updateAutoPilotBtn(false);
      alert('🤖 AI Auto-Pilot resumed! ChatGCM will autonomously answer client inquiries.');
      loadWhatsAppConversations();
    }
  } catch (err) {
    alert('Failed to toggle autopilot: ' + err.message);
  }
}

// ── 2. Visual 5-Stage Kanban Board ─────────────────────────────────────────────
function renderKanbanBoard() {
  const cols = {
    new: document.getElementById('cards-kanban-new'),
    engaging: document.getElementById('cards-kanban-engaging'),
    quoted: document.getElementById('cards-kanban-quoted'),
    paid: document.getElementById('cards-kanban-paid'),
    dispatched: document.getElementById('cards-kanban-dispatched')
  };

  const counts = {
    new: 0,
    engaging: 0,
    quoted: 0,
    paid: 0,
    dispatched: 0
  };

  // Clear columns
  Object.values(cols).forEach(c => { if (c) c.innerHTML = ''; });

  const filtered = allLeads.filter(lead => {
    if (selectedWebsite === 'all') return true;
    return (lead.website_id || '').toLowerCase().includes(selectedWebsite.toLowerCase()) ||
           (lead.brand_name || '').toLowerCase().includes(selectedWebsite.toLowerCase());
  });

  filtered.forEach(lead => {
    const stage = (lead.pipeline_stage || lead.stage || 'NEW').toUpperCase();
    let colKey = 'new';

    if (stage === 'NEW' || stage === 'INBOUND') {
      colKey = 'new';
    } else if (stage === 'FOLLOW_UP' || stage === 'ENGAGING' || stage === 'AI_FOLLOWUP' || stage === 'QUALIFIED' || stage === 'INSPECTION_SCHEDULED') {
      colKey = 'engaging';
    } else if (stage === 'QUOTATION_SENT' || stage === 'NEGOTIATION') {
      colKey = 'quoted';
    } else if (stage === 'APPROVED' || stage === 'ORDER_CONFIRMED' || stage === 'PAYMENT_DONE' || stage === 'ADVANCE_RECEIVED') {
      colKey = 'paid';
    } else if (stage === 'DISPATCHED_BILTY' || stage === 'IN_TRANSIT' || stage === 'DELIVERED') {
      colKey = 'dispatched';
    }

    counts[colKey]++;
    if (cols[colKey]) {
      cols[colKey].innerHTML += createKanbanCardHtml(lead);
    }
  });

  // Update counts
  document.getElementById('count-kanban-new').textContent = counts.new;
  document.getElementById('count-kanban-engaging').textContent = counts.engaging;
  document.getElementById('count-kanban-quoted').textContent = counts.quoted;
  document.getElementById('count-kanban-paid').textContent = counts.paid;
  document.getElementById('count-kanban-dispatched').textContent = counts.dispatched;

  // Empty states for empty columns
  Object.keys(cols).forEach(key => {
    if (counts[key] === 0 && cols[key]) {
      cols[key].innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 12px;">
          No leads in this stage
        </div>
      `;
    }
  });
}

function createKanbanCardHtml(lead) {
  const site = GCM_WEBSITES[lead.website_id] || { name: lead.brand_name || lead.website_id || 'GCM Netting', badgeClass: 'badge-blue' };
  const val = lead.estimated_value > 0 ? `₹${Number(lead.estimated_value).toLocaleString('en-IN')}` : '₹--';
  const cleanPhone = (lead.whatsapp_number || lead.phone || '').replace(/\D/g, '');

  const callbackBadge = lead.scheduled_callback_at ? `
    <div style="font-size:11px; color:var(--accent-cyan); background:rgba(6, 182, 212, 0.1); border:1px solid rgba(6, 182, 212, 0.3); border-radius:6px; padding:3px 6px; margin-bottom:6px;">
      <i class="fas fa-clock"></i> Callback: ${escapeHtml(lead.preferred_contact_time || formatTimestamp(lead.scheduled_callback_at))}
    </div>` : '';

  const optOutBadge = lead.opt_out ? `
    <div style="font-size:11px; color:var(--accent-rose); background:rgba(244, 63, 94, 0.1); border:1px solid rgba(244, 63, 94, 0.3); border-radius:6px; padding:3px 6px; margin-bottom:6px;">
      <i class="fas fa-ban"></i> Opted Out (Follow-ups stopped)
    </div>` : '';

  return `
    <div class="kanban-card">
      <div class="kanban-card-top">
        <span class="badge ${site.badgeClass}">${escapeHtml(site.name)}</span>
        <span style="font-weight:700; color:var(--accent-green); font-size:13px;">${val}</span>
      </div>
      <div class="kanban-card-title">${escapeHtml(lead.customer_name || 'Client +' + cleanPhone.slice(-4))}</div>
      <div class="kanban-card-sub">
        <i class="fas fa-map-marker-alt" style="color:var(--text-muted);"></i> ${escapeHtml(lead.city || 'Hyderabad')} • 
        <a href="tel:${cleanPhone}" style="color:var(--text-secondary); text-decoration:none;">${lead.phone}</a>
      </div>
      ${callbackBadge}
      ${optOutBadge}
      <p style="font-size:11.5px; color:var(--text-muted); margin: 6px 0 10px 0; line-height:1.4;">
        ${escapeHtml(lead.requirement_summary || 'Balcony & Safety Netting Inquiry')}
      </p>
      <div class="kanban-card-footer">
        <div style="display:flex; gap:6px;">
          <button class="btn-action-icon" onclick="openWhatsAppChatFor('${cleanPhone}')" title="Open WhatsApp Chat">
            <i class="fab fa-whatsapp" style="color:var(--accent-green);"></i>
          </button>
          <button class="btn-action-icon" onclick="openQuotationModal('${lead.id}')" title="Dispatch Quotation">
            <i class="fas fa-file-invoice" style="color:var(--accent-amber);"></i>
          </button>
          <button class="btn-action-icon" onclick="openRecordDispatchModal('${lead.id}')" title="Record Bilty / Dispatch">
            <i class="fas fa-truck" style="color:#ec4899;"></i>
          </button>
        </div>
        <select class="form-control" style="width: auto; padding: 4px 6px; font-size: 11px;" onchange="updateLeadPipelineStage('${lead.id}', this.value)">
          <option value="NEW" ${lead.pipeline_stage === 'NEW' ? 'selected' : ''}>New</option>
          <option value="AI_FOLLOWUP" ${lead.pipeline_stage === 'AI_FOLLOWUP' ? 'selected' : ''}>Engaging</option>
          <option value="QUOTATION_SENT" ${lead.pipeline_stage === 'QUOTATION_SENT' ? 'selected' : ''}>Quoted</option>
          <option value="PAYMENT_DONE" ${lead.pipeline_stage === 'PAYMENT_DONE' ? 'selected' : ''}>Paid</option>
          <option value="DISPATCHED_BILTY" ${lead.pipeline_stage === 'DISPATCHED_BILTY' ? 'selected' : ''}>Dispatched</option>
          <option value="DELIVERED" ${lead.pipeline_stage === 'DELIVERED' ? 'selected' : ''}>Delivered</option>
        </select>
      </div>
    </div>
  `;
}

async function syncAllWebsitesKnowledge() {
  try {
    const res = await fetch('/api/admin/ai/sync-knowledge', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert(`🧠 AI Brain successfully learned from ${data.syncedWebsitesCount} server websites!\nAll rates, products, ground setups & localities are synced.`);
      if (currentTab === 'websites') renderWebsitesGrid();
    } else {
      alert('Knowledge sync notice: ' + (data.error || 'Check server logs'));
    }
  } catch (err) {
    alert('Failed to sync knowledge: ' + err.message);
  }
}

function openWhatsAppChatFor(phone) {
  switchTab('whatsapp-hub');
  selectConversation(phone);
}

async function updateLeadPipelineStage(leadId, stage) {
  try {
    const res = await fetch(`/api/crm/leads/${leadId}/pipeline-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage })
    });
    const data = await res.json();
    if (data.success) {
      await fetchLeads();
      renderKanbanBoard();
      renderLeadsTable();
    }
  } catch (err) {
    alert('Failed to update stage: ' + err.message);
  }
}

// ── 3. Dense Hot Leads CRM Table ──────────────────────────────────────────────
function renderLeadsTable() {
  const tbody = document.getElementById('leads-table-body');
  const query = (document.getElementById('leads-filter-input')?.value || '').toLowerCase().trim();

  const filtered = allLeads.filter(l => {
    // Website filter
    if (selectedWebsite !== 'all') {
      const matchSite = (l.website_id || '').toLowerCase().includes(selectedWebsite.toLowerCase()) ||
                        (l.brand_name || '').toLowerCase().includes(selectedWebsite.toLowerCase());
      if (!matchSite) return false;
    }
    // Search query
    if (!query) return true;
    return (l.customer_name && l.customer_name.toLowerCase().includes(query)) ||
           (l.phone && l.phone.includes(query)) ||
           (l.city && l.city.toLowerCase().includes(query)) ||
           (l.requirement_summary && l.requirement_summary.toLowerCase().includes(query));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">No leads found matching criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(l => {
    const site = GCM_WEBSITES[l.website_id] || { name: l.brand_name || l.website_id || 'GCM Netting', badgeClass: 'badge-blue' };
    const cleanPhone = (l.whatsapp_number || l.phone || '').replace(/\D/g, '');
    const isNoWa = l.whatsapp_status === 'NO_WHATSAPP';
    const stage = l.pipeline_stage || l.stage || 'NEW';

    return `
      <tr>
        <td>
          <span class="badge ${site.badgeClass}">${escapeHtml(site.name)}</span>
          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${formatTimestamp(l.created_at)}</div>
        </td>
        <td>
          <strong style="color:#fff; font-size:13.5px;">${escapeHtml(l.customer_name || 'Direct Inbound')}</strong>
          <div style="font-size:11.5px; color:var(--text-secondary);"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(l.city || 'Hyderabad')}</div>
        </td>
        <td>
          <a href="tel:${cleanPhone}" style="color:#60a5fa; text-decoration:none; font-weight:600;">+91 ${cleanPhone.slice(-10)}</a>
          ${isNoWa ? 
            `<button class="badge badge-danger" onclick="openUpdateWhatsAppModal('${l.id}', '${escapeHtml(l.customer_name)}', '${cleanPhone}')" style="cursor:pointer; margin-left:6px;" title="Click to fix bounced WhatsApp">🚨 Missing WA</button>` : 
            `<span class="badge badge-green" style="margin-left:6px;"><i class="fab fa-whatsapp"></i> Live</span>`
          }
        </td>
        <td style="max-width:240px; font-size:12px; color:var(--text-secondary);">
          ${escapeHtml(l.requirement_summary || 'General Netting Inquiry')}
        </td>
        <td>
          <strong style="color:var(--accent-green); font-size:13px;">₹${(l.estimated_value || 0).toLocaleString('en-IN')}</strong>
        </td>
        <td>
          <span class="badge ${getStageClass(stage)}">${stage}</span>
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-outline btn-sm" onclick="openWhatsAppChatFor('${cleanPhone}')" title="Chat on WhatsApp">
              <i class="fab fa-whatsapp" style="color:var(--accent-green);"></i>
            </button>
            <button class="btn btn-primary btn-sm" onclick="openQuotationModal('${l.id}')" title="Send Quote">
              <i class="fas fa-file-invoice"></i>
            </button>
            <button class="btn btn-outline btn-sm" onclick="openRecordDispatchModal('${l.id}')" title="Bilty">
              <i class="fas fa-truck" style="color:#ec4899;"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterLeadsTable() {
  renderLeadsTable();
}

// ── 4. Turnkey Quotations Table ────────────────────────────────────────────────
async function loadQuotations() {
  const tbody = document.getElementById('quotations-table-body');
  try {
    const res = await fetch('/api/crm/quotations');
    const data = await res.json();
    if (data.success && Array.isArray(data.quotations)) {
      document.getElementById('stat-active-quotes').textContent = data.quotations.length;
      if (data.quotations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">No official quotations generated yet.</td></tr>`;
        return;
      }
      tbody.innerHTML = data.quotations.map(q => {
        const viewUrl = q.view_url || (q.doc_id ? `https://gcm.enterprises/admin/view.php?id=${encodeURIComponent(q.doc_id)}` : '#');
        return `
          <tr>
            <td><code>${q.quote_number || q.id}</code></td>
            <td><strong>${escapeHtml(q.customer_name || 'Client')}</strong></td>
            <td>${escapeHtml(q.project_name || 'Netting Installation')}</td>
            <td><strong style="color:var(--accent-green);">₹${Number(q.grand_total || 0).toLocaleString('en-IN')}</strong></td>
            <td>₹${Number(q.advance_amount || 0).toLocaleString('en-IN')}</td>
            <td><span class="badge badge-green">${q.status || 'SENT'}</span></td>
            <td>
              <a href="${viewUrl}" target="_blank" class="btn btn-outline btn-sm" style="text-decoration:none;">
                <i class="fas fa-file-pdf"></i> View PDF
              </a>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Failed to load quotations:', err);
  }
}

// ── 5. Logistics & Bilty Tracker Table ─────────────────────────────────────────
function renderLogisticsTable() {
  const tbody = document.getElementById('logistics-table-body');
  const dispatchedLeads = allLeads.filter(l => l.dispatch_transporter || l.pipeline_stage === 'DISPATCHED_BILTY' || l.stage === 'DISPATCHED_BILTY');

  document.getElementById('stat-dispatched-count').textContent = dispatchedLeads.length;

  if (dispatchedLeads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">No consignments currently logged in logistics transit.</td></tr>`;
    return;
  }

  tbody.innerHTML = dispatchedLeads.map(l => {
    const cleanPhone = (l.whatsapp_number || l.phone || '').replace(/\D/g, '');
    return `
      <tr>
        <td>
          <strong>${escapeHtml(l.customer_name || 'Client')}</strong>
          <div style="font-size:11.5px; color:var(--text-secondary);"><a href="tel:${cleanPhone}" style="color:#60a5fa;">${l.phone}</a></div>
        </td>
        <td><strong style="color:#fbcfe8;">${escapeHtml(l.dispatch_transporter || 'Navata Transport')}</strong></td>
        <td><code>${escapeHtml(l.lr_number || 'LR-PENDING')}</code></td>
        <td>${escapeHtml(l.parcels_count || '1 Parcel')}</td>
        <td>${l.dispatch_date || new Date().toISOString().slice(0, 10)}</td>
        <td>
          <span class="badge badge-cyan"><i class="fas fa-clock"></i> 48-Hr Auto Pilot Active</span>
        </td>
        <td>
          <button class="btn btn-green btn-sm" onclick="sendDeliveryCheckInWhatsApp('${l.id}')">
            <i class="fab fa-whatsapp"></i> Check-in Now
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function sendDeliveryCheckInWhatsApp(leadId) {
  const lead = allLeads.find(l => l.id === leadId);
  if (!lead) return;
  const phone = (lead.whatsapp_number || lead.phone || '').replace(/\D/g, '');
  const msg = `Namaste ${lead.customer_name || 'Client'}! 🙏\nChecking in from GCM Enterprises regarding your shipment via ${lead.dispatch_transporter || 'logistics'} (LR: ${lead.lr_number || ''}). Has the material reached you safely?`;
  
  try {
    const res = await fetch(`/api/whatsapp/conversations/${phone}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ Follow-up check-in sent to ${lead.customer_name} on WhatsApp!`);
    } else {
      alert('Failed: ' + (data.error || 'Check WhatsApp service'));
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ── 6. 9 Websites Sync Grid ───────────────────────────────────────────────────
function renderWebsitesGrid() {
  const grid = document.getElementById('websites-grid');
  if (!grid) return;

  grid.innerHTML = Object.entries(GCM_WEBSITES).map(([key, site]) => {
    const leadCount = allLeads.filter(l => (l.website_id || '').toLowerCase().includes(key.toLowerCase())).length;

    return `
      <div class="stat-card" style="--stat-color:${site.color}; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
              <h4 style="font-size:16px; font-weight:800; color:#fff; margin-bottom:2px;">${escapeHtml(site.name)}</h4>
              <a href="https://${site.domain}" target="_blank" style="color:${site.color}; font-size:12px; text-decoration:none;">
                https://${site.domain} <i class="fas fa-external-link-alt" style="font-size:10px;"></i>
              </a>
            </div>
            <span class="badge ${site.badgeClass}">Active Sync</span>
          </div>
          <p style="font-size:12px; color:var(--text-secondary); margin-bottom:6px;">
            <strong>Primary Focus:</strong> ${site.primaryProduct}
          </p>
          <p style="font-size:11.5px; color:var(--text-muted); margin-bottom:16px;">
            <strong>Territory:</strong> ${site.city}
          </p>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--glass-border); padding-top:12px;">
          <span style="font-size:12px; color:var(--text-secondary);">Leads Ingested: <strong style="color:#fff;">${leadCount}</strong></span>
          <button class="btn btn-outline btn-sm" onclick="filterByWebsite('${key}')">View Leads</button>
        </div>
      </div>
    `;
  }).join('');
}

// ── 7. Owner Approvals ─────────────────────────────────────────────────────────
async function loadApprovals() {
  try {
    const res = await fetch('/api/crm/approvals');
    const data = await res.json();
    const container = document.getElementById('approvals-container');
    const badge = document.getElementById('approval-badge');

    if (data.success && Array.isArray(data.approvals) && data.approvals.length > 0) {
      badge.style.display = 'inline-block';
      badge.textContent = data.approvals.length;
      container.innerHTML = data.approvals.map(app => `
        <div class="stat-card" style="margin-bottom:12px; text-align:left; border-left: 4px solid var(--accent-amber);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h4 style="color:#fff; font-size:14px;">${escapeHtml(app.customer_name || 'Client')}</h4>
              <p style="font-size:12px; color:var(--text-secondary);">${escapeHtml(app.requested_reason || 'Special Discount Request')}</p>
              <strong style="color:var(--accent-green); font-size:13px;">Proposed: ₹${(app.proposed_amount || 0).toLocaleString('en-IN')}</strong>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-green btn-sm" onclick="decideApproval('${app.id}', 'APPROVE')">Approve</button>
              <button class="btn btn-danger btn-sm" onclick="decideApproval('${app.id}', 'REJECT')">Reject</button>
            </div>
          </div>
        </div>
      `).join('');
    } else {
      badge.style.display = 'none';
      container.innerHTML = `
        <i class="fas fa-check-circle" style="font-size:36px; color:var(--accent-green); margin-bottom:10px; display:block;"></i>
        Zero pending approvals. AI is operating within autonomous parameters (maximum 4% discount).
      `;
    }
  } catch (err) {
    console.error('Failed to load approvals:', err);
  }
}

async function decideApproval(id, decision) {
  try {
    const res = await fetch(`/api/crm/approvals/${id}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision })
    });
    const data = await res.json();
    if (data.success) {
      loadApprovals();
    }
  } catch (err) {
    alert('Failed to process approval: ' + err.message);
  }
}

// ── 8. Red Alert: Missing WhatsApp Numbers ────────────────────────────────────
async function checkNoWhatsAppAlerts() {
  try {
    const res = await fetch('/api/crm/alerts/no-whatsapp');
    const data = await res.json();
    const banner = document.getElementById('no-whatsapp-alert-banner');
    const countSpan = document.getElementById('no-wa-count');

    if (data.success && data.count > 0) {
      noWaLeads = data.leads || [];
      countSpan.textContent = data.count;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  } catch (err) {
    console.error('Failed to check no-whatsapp alerts:', err);
  }
}

function filterNoWhatsAppLeads() {
  switchTab('leads');
  const input = document.getElementById('leads-filter-input');
  if (input) {
    input.value = '';
    renderLeadsTable();
  }
}

// ── 9. Fetch Master Stats & Leads ─────────────────────────────────────────────
async function fetchStats(isSilent = false) {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    if (data.success && data.stats) {
      document.getElementById('stat-total-leads').textContent = data.stats.totalLeads || 0;
      document.getElementById('count-all').textContent = data.stats.totalLeads || 0;
    }
  } catch (err) {
    if (!isSilent) console.error('Failed to fetch stats:', err);
  }
}

async function fetchLeads() {
  try {
    const res = await fetch('/api/crm/leads');
    const data = await res.json();
    if (data.success && Array.isArray(data.leads)) {
      allLeads = data.leads;
      document.getElementById('stat-total-leads').textContent = allLeads.length;
      document.getElementById('count-all').textContent = allLeads.length;

      // Also render active views
      if (currentTab === 'kanban') renderKanbanBoard();
      if (currentTab === 'leads') renderLeadsTable();
      if (currentTab === 'logistics') renderLogisticsTable();
    }
  } catch (err) {
    console.error('Failed to fetch leads:', err);
  }
}

// ── 10. Modals Management ─────────────────────────────────────────────────────
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('hidden');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('hidden');
}

// Quick Call Modal
function openQuickCallModal() {
  document.getElementById('qc-phone').value = '';
  document.getElementById('qc-name').value = '';
  document.getElementById('qc-req').value = '';
  openModal('modal-quick-call');
  setTimeout(() => document.getElementById('qc-phone')?.focus(), 100);
}

function fillQuickCallReq(text) {
  document.getElementById('qc-req').value = text;
}

async function submitQuickCallLead() {
  const phone = document.getElementById('qc-phone').value.trim();
  const customerName = document.getElementById('qc-name').value.trim() || 'Direct Caller';
  const websiteId = document.getElementById('qc-website').value;
  const requirementSummary = document.getElementById('qc-req').value.trim() || 'Balcony Netting Inquiry';

  if (!phone || phone.replace(/\D/g, '').length < 10) {
    alert('Please enter a valid 10-digit customer phone number.');
    document.getElementById('qc-phone').focus();
    return;
  }

  try {
    const res = await fetch('/api/crm/quick-call-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        customerName,
        websiteId,
        requirementSummary,
        service: requirementSummary
      })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to submit quick call lead');

    closeModal('modal-quick-call');
    await fetchLeads();
    await loadWhatsAppConversations();

    alert(`🚀 Success! AI Coordinator connected on WhatsApp with ${customerName} (+91 ${phone.replace(/\D/g, '').slice(-10)}).`);
    // Jump straight to conversation
    selectConversation(phone);
    switchTab('whatsapp-hub');
  } catch (err) {
    alert('Error creating lead: ' + err.message);
  }
}

// Quotation Modal
function openQuotationModal(leadId) {
  let lead = null;
  if (leadId) {
    lead = allLeads.find(l => l.id === leadId);
  }

  if (lead) {
    document.getElementById('dq-lead-id').value = lead.id;
    document.getElementById('dq-customer-info').value = `${lead.customer_name || 'Client'} (+91 ${(lead.whatsapp_number || lead.phone || '').replace(/\D/g, '').slice(-10)}) — ${lead.city || 'Hyderabad'}`;
    document.getElementById('dq-item-desc').value = lead.requirement_summary || 'RUSSEA™ High-Tenacity Balcony Netting with SS Fasteners';
  } else {
    document.getElementById('dq-lead-id').value = '';
    document.getElementById('dq-customer-info').value = 'New Client Quotation';
    document.getElementById('dq-item-desc').value = 'RUSSEA™ High-Tenacity Balcony Netting with SS Fasteners';
  }

  document.getElementById('dq-qty').value = '300';
  document.getElementById('dq-rate').value = '22';
  document.getElementById('dq-discount').value = '0';
  calculateQuoteTotal();

  openModal('modal-dispatch-quotation');
}

function calculateQuoteTotal() {
  const qty = Number(document.getElementById('dq-qty').value || 0);
  const rate = Number(document.getElementById('dq-rate').value || 0);
  const discount = Math.min(4, Math.max(0, Number(document.getElementById('dq-discount').value || 0))); // 4% guardrail

  const subtotal = qty * rate;
  const discounted = subtotal * (1 - (discount / 100));
  const finalTotal = Math.round(discounted);

  document.getElementById('dq-total').value = `₹ ${finalTotal.toLocaleString('en-IN')}`;
  return finalTotal;
}

async function submitDispatchQuotation() {
  let leadId = document.getElementById('dq-lead-id').value;
  const itemDesc = document.getElementById('dq-item-desc').value.trim();
  const grandTotal = calculateQuoteTotal();

  if (!leadId) {
    if (activeChatLead && activeChatLead.id) {
      leadId = activeChatLead.id;
    } else if (activeChatPhone) {
      const chatL = allLeads.find(l => (l.phone || '').replace(/\D/g, '') === activeChatPhone);
      if (chatL) leadId = chatL.id;
    } else if (allLeads.length > 0) {
      leadId = allLeads[0].id;
    }
  }

  if (!leadId) {
    alert('Please select or create a lead before dispatching an official quotation.');
    return;
  }

  try {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const quoteNumber = `GCM-EST-2026-${rand}`;
    const viewUrl = `https://gcm.enterprises/admin/view.php?id=${quoteNumber}`;

    const res = await fetch(`/api/crm/leads/${leadId}/dispatch-quotation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteNumber,
        projectName: itemDesc,
        grandTotal,
        viewUrl,
        includeBankDetails: true,
        includeUpi: true
      })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to dispatch quotation');

    closeModal('modal-dispatch-quotation');
    await fetchLeads();
    await loadQuotations();

    alert(`🚀 Quotation Dispatched! Sent estimation #${quoteNumber} for ₹${grandTotal.toLocaleString('en-IN')} with Bank & UPI details to customer on WhatsApp.`);
  } catch (err) {
    alert('Failed to dispatch quotation: ' + err.message);
  }
}

// Record Dispatch / Bilty Modal
function openRecordDispatchModal(leadId) {
  const lead = allLeads.find(l => l.id === leadId);
  if (!lead) return;

  document.getElementById('rd-lead-id').value = lead.id;
  document.getElementById('rd-customer-info').value = `${lead.customer_name || 'Client'} (${lead.phone}) — ${lead.city || 'Hyderabad'}`;
  document.getElementById('rd-lr-number').value = '';
  document.getElementById('rd-parcels').value = '1';
  document.getElementById('rd-delivery-date').value = '';

  openModal('modal-record-dispatch');
}

async function submitRecordDispatch() {
  const leadId = document.getElementById('rd-lead-id').value;
  const transporter = document.getElementById('rd-transporter').value;
  const lrNumber = document.getElementById('rd-lr-number').value.trim();
  const parcels = document.getElementById('rd-parcels').value;
  const expectedDate = document.getElementById('rd-delivery-date').value;

  if (!lrNumber) {
    alert('Please enter the LR / Bilty Docket Number.');
    document.getElementById('rd-lr-number').focus();
    return;
  }

  try {
    const res = await fetch(`/api/crm/leads/${leadId}/dispatch-shipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transporter,
        lrNumber,
        parcelsCount: `${parcels} Parcel(s)`,
        expectedDeliveryDate: expectedDate
      })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to record dispatch');

    closeModal('modal-record-dispatch');
    await fetchLeads();
    renderLogisticsTable();

    alert(`🚚 Shipment recorded! Official WhatsApp Bilty docket delivered to customer. 48-Hour delivery follow-up armed!`);
  } catch (err) {
    alert('Failed to record dispatch: ' + err.message);
  }
}

// Update WhatsApp Number Modal
function openUpdateWhatsAppModal(leadId, name, phone) {
  document.getElementById('uw-lead-id').value = leadId;
  document.getElementById('uw-customer-info').value = `${name} (Call: +91 ${phone.slice(-10)})`;
  document.getElementById('uw-phone').value = '';
  openModal('modal-update-whatsapp');
  setTimeout(() => document.getElementById('uw-phone')?.focus(), 100);
}

async function submitUpdateWhatsApp() {
  const leadId = document.getElementById('uw-lead-id').value;
  const newPhone = document.getElementById('uw-phone').value.trim();

  if (!newPhone || newPhone.replace(/\D/g, '').length < 10) {
    alert('Please enter a valid 10-digit WhatsApp phone number.');
    document.getElementById('uw-phone').focus();
    return;
  }

  try {
    const res = await fetch(`/api/crm/leads/${leadId}/update-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsappNumber: newPhone.replace(/\D/g, '').slice(-10) })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update WhatsApp number');

    closeModal('modal-update-whatsapp');
    await fetchLeads();
    await checkNoWhatsAppAlerts();
    await loadWhatsAppConversations();

    alert('✅ WhatsApp number connected! AI Auto-Pilot has engaged the customer.');
  } catch (err) {
    alert('Failed to update WhatsApp: ' + err.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTimestamp(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getStageClass(stage) {
  const s = (stage || '').toUpperCase();
  if (s === 'NEW' || s === 'INBOUND') return 'badge-indigo';
  if (s.includes('ENGAGING') || s.includes('FOLLOWUP') || s.includes('QUALIFIED')) return 'badge-cyan';
  if (s.includes('QUOTATION') || s.includes('QUOTED')) return 'badge-amber';
  if (s.includes('PAID') || s.includes('APPROVED') || s.includes('ORDER')) return 'badge-green';
  if (s.includes('DISPATCH') || s.includes('TRANSIT')) return 'badge-pink';
  return 'badge-blue';
}

// ── 8. Agent Performance & Audit Trail ──────────────────────────────────────────
let cachedAgentLogs = [];

async function loadAgentPerformance(silent = false) {
  try {
    const res = await fetch('/api/admin/agents/performance');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success) return;

    // Update KPI metrics
    const summary = data.summary || {};
    if (document.getElementById('kpi-agent-actions')) {
      document.getElementById('kpi-agent-actions').textContent = summary.totalActionsCount || 0;
    }
    if (document.getElementById('kpi-russea-defenses')) {
      document.getElementById('kpi-russea-defenses').textContent = summary.totalRusseaDefenses || 0;
    }
    if (document.getElementById('kpi-quotes-issued')) {
      document.getElementById('kpi-quotes-issued').textContent = summary.totalQuotesSent || 0;
    }
    if (document.getElementById('kpi-callbacks-scheduled')) {
      document.getElementById('kpi-callbacks-scheduled').textContent = summary.totalCallbacksScheduled || 0;
    }
    if (document.getElementById('agent-actions-badge')) {
      document.getElementById('agent-actions-badge').textContent = summary.totalActionsCount || 0;
    }
    if (document.getElementById('agent-logs-count')) {
      document.getElementById('agent-logs-count').textContent = `${summary.totalActionsCount || 0} logged`;
    }

    // Render Persona Cards
    renderAgentPersonaCards(data.agents || []);

    // Cache logs and render table
    cachedAgentLogs = data.recentLogs || [];
    renderAgentLogsTable(cachedAgentLogs);
  } catch (err) {
    console.error('Failed to load agent performance:', err);
  }
}

function renderAgentPersonaCards(agents) {
  const container = document.getElementById('agent-personas-grid');
  if (!container) return;

  if (!agents || agents.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:13px;">No agents active.</div>';
    return;
  }

  container.innerHTML = agents.map(agent => {
    const lastActiveText = agent.lastActive ? formatAgentTimestamp(agent.lastActive) : 'Standing by';
    return `
      <div class="stat-card" style="padding: 16px; border: 1px solid var(--glass-border); border-radius: var(--radius-md); background: var(--bg-card);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="font-size:26px; width:42px; height:42px; display:flex; align-items:center; justify-content:center; background:rgba(16,185,129,0.15); border-radius:50%; border:1px solid rgba(16,185,129,0.3);">
              ${agent.avatar || '👨‍💼'}
            </div>
            <div>
              <div style="font-weight:700; font-size:14px; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                ${escapeHtml(agent.name)}
                <span class="status-indicator online" style="width:7px; height:7px;"></span>
              </div>
              <div style="font-size:11px; color:var(--text-secondary);">${escapeHtml(agent.city)} (${escapeHtml(agent.region)})</div>
            </div>
          </div>
          <span class="badge badge-green" style="font-size:10px;">Live Sales Brain</span>
        </div>

        <div style="font-size:11px; color:var(--text-muted); margin-bottom:12px; display:flex; align-items:center; gap:4px;">
          <i class="fas fa-language" style="color:var(--accent-cyan);"></i> ${escapeHtml(agent.language)}
        </div>

        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; background:rgba(0,0,0,0.25); padding:10px 8px; border-radius:6px; margin-bottom:10px; text-align:center;">
          <div>
            <div style="font-size:15px; font-weight:800; color:var(--text-primary);">${agent.totalInteractions || 0}</div>
            <div style="font-size:9px; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em;">Actions</div>
          </div>
          <div>
            <div style="font-size:15px; font-weight:800; color:#10b981;">${agent.russeaDefenses || 0}</div>
            <div style="font-size:9px; text-transform:uppercase; color:#10b981; letter-spacing:0.04em;">Defenses</div>
          </div>
          <div>
            <div style="font-size:15px; font-weight:800; color:var(--accent-amber);">${agent.quotesSent || 0}</div>
            <div style="font-size:9px; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em;">Quotes</div>
          </div>
          <div>
            <div style="font-size:15px; font-weight:800; color:var(--accent-cyan);">${agent.callbacksScheduled || 0}</div>
            <div style="font-size:9px; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em;">Callbacks</div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--text-muted);">
          <span>Last Active: <strong style="color:var(--text-secondary);">${lastActiveText}</strong></span>
          <button class="btn btn-outline btn-sm" style="padding:2px 8px; font-size:10px;" onclick="filterLogsByAgent('${escapeHtml(agent.name)}')">
            <i class="fas fa-filter"></i> View Logs
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderAgentLogsTable(logs) {
  const tbody = document.getElementById('agent-logs-tbody');
  if (!tbody) return;

  if (!logs || logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:35px; color:var(--text-muted);">
          <i class="fas fa-clipboard-check" style="font-size:28px; color:var(--accent-green); display:block; margin-bottom:8px;"></i>
          No actions logged matching current filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = logs.map(log => {
    const actionBadge = getActionBadge(log.action_type);
    const timeStr = formatAgentTimestamp(log.created_at);
    const phoneClean = (log.phone || '').replace(/\D/g, '').slice(-10);
    const phoneDisplay = phoneClean ? `+91 ${phoneClean}` : 'Web Lead';
    const city = log.city || 'Hyderabad';
    const channel = log.channel || 'web_chat';

    return `
      <tr>
        <td style="white-space:nowrap; font-size:11px; color:var(--text-secondary);">${timeStr}</td>
        <td>
          <div style="display:flex; align-items:center; gap:6px; font-weight:600; color:var(--text-primary);">
            <i class="fas fa-user-tie" style="color:#10b981; font-size:12px;"></i>
            ${escapeHtml(log.persona_name)}
          </div>
        </td>
        <td>${actionBadge}</td>
        <td>
          <div style="font-weight:600; color:var(--text-primary);">${phoneDisplay}</div>
          <div style="font-size:10px; color:var(--text-muted);">${escapeHtml(log.website_id || 'gcmsafetynets')}</div>
        </td>
        <td>
          <span class="badge badge-blue" style="font-size:10px;">${escapeHtml(city)}</span>
          <span style="font-size:10px; color:var(--text-muted); margin-left:4px;">${escapeHtml(channel)}</span>
        </td>
        <td style="max-width:320px;">
          <div style="font-weight:600; font-size:12px; color:var(--text-primary); margin-bottom:2px;">${escapeHtml(log.action_title || '')}</div>
          <div style="font-size:11px; color:var(--text-secondary); line-height:1.4;">${escapeHtml(log.work_summary || '')}</div>
        </td>
        <td>
          ${phoneClean ? `
            <button class="btn btn-outline btn-sm" style="padding:4px 8px; font-size:11px; color:var(--accent-green);" onclick="openWhatsAppForPhone('${phoneClean}')" title="Inspect conversation in Live WhatsApp">
              <i class="fab fa-whatsapp"></i> Chat
            </button>
          ` : `<span style="color:var(--text-muted); font-size:11px;">—</span>`}
        </td>
      </tr>
    `;
  }).join('');
}

function getActionBadge(actionType) {
  const t = (actionType || '').toUpperCase();
  if (t === 'COMPETITOR_DEFENSE_RUSSEA') {
    return `<span class="badge" style="background:rgba(16,185,129,0.2); color:#10b981; border:1px solid #10b981;"><i class="fas fa-shield-alt"></i> RUSSEA™ Defense</span>`;
  }
  if (t === 'QUOTATION_GENERATED') {
    return `<span class="badge badge-amber"><i class="fas fa-file-invoice-dollar"></i> Quote Sent</span>`;
  }
  if (t === 'ESTIMATE_CALCULATED') {
    return `<span class="badge badge-blue"><i class="fas fa-calculator"></i> Calculation</span>`;
  }
  if (t === 'CALLBACK_SCHEDULED') {
    return `<span class="badge badge-green"><i class="fas fa-phone-alt"></i> Callback</span>`;
  }
  if (t === 'SITE_VISIT_BOOKED') {
    return `<span class="badge" style="background:rgba(139,92,246,0.2); color:#a78bfa; border:1px solid #a78bfa;"><i class="fas fa-map-marker-alt"></i> Site Visit</span>`;
  }
  if (t === 'DISCOUNT_APPLIED') {
    return `<span class="badge" style="background:rgba(245,158,11,0.2); color:#f59e0b; border:1px solid #f59e0b;"><i class="fas fa-tag"></i> 4% Discount</span>`;
  }
  if (t === 'INQUIRY_ANSWERED') {
    return `<span class="badge badge-indigo"><i class="fas fa-comment-dots"></i> Inquired</span>`;
  }
  if (t === 'FOLLOWUP_SENT') {
    return `<span class="badge badge-cyan"><i class="fas fa-paper-plane"></i> Follow-Up</span>`;
  }
  return `<span class="badge badge-blue">${escapeHtml(actionType)}</span>`;
}

function formatAgentTimestamp(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function applyAgentAuditFilters() {
  const persona = document.getElementById('filter-agent-persona')?.value || '';
  const action = document.getElementById('filter-agent-action')?.value || '';

  try {
    const params = new URLSearchParams();
    if (persona) params.append('persona', persona);
    if (action) params.append('action', action);

    const res = await fetch(`/api/admin/agents/logs?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        renderAgentLogsTable(data.logs || []);
        if (document.getElementById('agent-logs-count')) {
          document.getElementById('agent-logs-count').textContent = `${data.total || (data.logs || []).length} logged`;
        }
        return;
      }
    }
  } catch (e) {
    console.error('Error filtering agent logs:', e);
  }

  // Fallback to client-side filtering
  let filtered = cachedAgentLogs;
  if (persona) filtered = filtered.filter(l => l.persona_name === persona);
  if (action) filtered = filtered.filter(l => l.action_type === action);
  renderAgentLogsTable(filtered);
}

function filterLogsByAgent(agentName) {
  const select = document.getElementById('filter-agent-persona');
  if (select) {
    select.value = agentName;
    applyAgentAuditFilters();
  }
}

function openWhatsAppForPhone(phoneClean) {
  switchTab('whatsapp-hub');
  loadActiveChatMessages(phoneClean, true);
}
