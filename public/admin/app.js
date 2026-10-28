/**
 * ChatGCM — Executive AI Command Center
 * Modern Omnichannel Engine & Live WhatsApp Web Controller
 * Official Meta Cloud API: +91 99123 99334
 */

// ── Global Authenticated Fetch Interceptor & Session Security ───────────────
const _nativeFetch = window.fetch;
window.fetch = async function(resource, init = {}) {
  const token = localStorage.getItem('chatgcm_token') || localStorage.getItem('adminKey') || '';
  init.headers = init.headers || {};
  if (init.headers instanceof Headers) {
    if (token && !init.headers.has('Authorization')) {
      init.headers.set('Authorization', `Bearer ${token}`);
    }
    if (token && !init.headers.has('X-Admin-Key')) {
      init.headers.set('X-Admin-Key', token);
    }
  } else if (Array.isArray(init.headers)) {
    if (token) {
      init.headers.push(['Authorization', `Bearer ${token}`]);
      init.headers.push(['X-Admin-Key', token]);
    }
  } else {
    if (token && !init.headers['Authorization']) {
      init.headers['Authorization'] = `Bearer ${token}`;
    }
    if (token && !init.headers['X-Admin-Key']) {
      init.headers['X-Admin-Key'] = token;
    }
  }

  const response = await _nativeFetch(resource, init);
  if (response.status === 401 && !String(resource).includes('/api/admin/login')) {
    localStorage.removeItem('chatgcm_token');
    localStorage.removeItem('adminKey');
    window.location.replace('/login.html');
  }
  return response;
};

window.adminSignOut = function() {
  localStorage.removeItem('chatgcm_token');
  localStorage.removeItem('adminKey');
  localStorage.removeItem('userRole');
  window.location.replace('/login.html');
};

// Global State
let currentTab = 'whatsapp-hub';
let selectedWebsite = 'all';
let allLeads = [];
let allConversations = [];
let activeChatPhone = null;
let activeChatLead = null;
let pollingInterval = null;
let noWaLeads = [];
let sseSource = null;

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
  initSSEStream();

  // Initial tab setup: ensure global stats are appropriately hidden for full-screen operational tools
  const globalStats = document.getElementById('global-stats-grid');
  const contentWrapper = document.querySelector('.content-wrapper');
  if (currentTab === 'whatsapp-hub') {
    if (globalStats) globalStats.style.display = 'none';
    if (contentWrapper) contentWrapper.classList.add('hub-mode');
  } else if (globalStats && (currentTab === 'meta-connection' || currentTab === 'catalog-syncer')) {
    globalStats.style.display = 'none';
  }

  // Smart Chat Scroll Listener: show floating scroll button when scrolled up
  const waStream = document.getElementById('wa-messages-stream');
  if (waStream) {
    waStream.addEventListener('scroll', () => {
      const scrollBtn = document.getElementById('wa-scroll-bottom-btn');
      if (!scrollBtn) return;
      const distanceFromBottom = waStream.scrollHeight - waStream.scrollTop - waStream.clientHeight;
      if (distanceFromBottom > 140) {
        scrollBtn.style.display = 'inline-flex';
      } else {
        scrollBtn.style.display = 'none';
      }
    });
  }

  // Listen for ESC key to close any modal or mobile drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
      closeMobileSidebar();
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
      'Multi-Agent Shared Inbox (Live WhatsApp Hub)',
      'Real-time team collaboration on +91 99123 99334 • AI auto-pilot & human manual takeover'
    ],
    'kanban': [
      'Sales Pipeline Kanban (5 Standardized States)',
      'Real-time drag-and-drop lead state tracking • Synchronized from incoming WhatsApp messages'
    ],
    'meta-connection': [
      'Meta Cloud API Connection & Webhooks',
      'Official WhatsApp Business Platform (WABA) connection, developer webhooks & telemetry'
    ],
    'knowledge-rag': [
      'Business Knowledge Base & RAG Engine',
      'Parse PDFs, catalogs, and pricing sheets to power automated WhatsApp replies'
    ],
    'catalog-syncer': [
      'E-Commerce Catalog Syncer',
      'Manage inventory, stock status, and dispatch product cards with 0% fee UPI QR links'
    ],
    'leads': [
      'Hot Leads Master CRM',
      'Dense customer roster across all channels (Web, Phone Call, WhatsApp, UshaLeads)'
    ],
    'quotations': [
      'Turnkey Quotations & Estimations',
      'Sequential quotations with SBI Bank A/C 44979437825 and UPI gcmenterprises@ybl'
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

  // Global Stats & full-screen workspace toggle
  const globalStats = document.getElementById('global-stats-grid');
  const contentWrapper = document.querySelector('.content-wrapper');

  if (tabId === 'whatsapp-hub') {
    if (globalStats) globalStats.style.display = 'none';
    if (contentWrapper) contentWrapper.classList.add('hub-mode');
  } else {
    if (contentWrapper) contentWrapper.classList.remove('hub-mode');
    if (globalStats) {
      if (tabId === 'meta-connection' || tabId === 'catalog-syncer') {
        globalStats.style.display = 'none';
      } else {
        globalStats.style.display = 'grid';
      }
    }
  }

  // Auto-close mobile sidebar drawer when navigating
  closeMobileSidebar();

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
  } else if (tabId === 'catalog-syncer') {
    loadCatalogItems();
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
      // Deduplicate conversations by clean 10-digit phone
      const uniqueConversations = [];
      const seenPhones = new Set();
      for (const c of data.conversations) {
        const key = (c.phone || '').replace(/\D/g, '').slice(-10);
        if (!key || seenPhones.has(key)) continue;
        seenPhones.add(key);
        uniqueConversations.push(c);
      }
      allConversations = uniqueConversations;
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


// ── Rich WhatsApp Message Parser & Clean Snippet Helpers ──────────────────────────
function formatWhatsAppText(rawText) {
  if (!rawText) return '';
  let text = escapeHtml(rawText);

  // Bold: **text** or *text*
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="msg-bold">$1</strong>');
  text = text.replace(/\*([^\*\n]+)\*/g, '<strong class="msg-bold">$1</strong>');

  // Italics: _text_
  text = text.replace(/_([^_]+)_/g, '<em class="msg-italic">$1</em>');

  // Strikethrough: ~text~
  text = text.replace(/~([^~\n]+)~/g, '<del class="msg-del">$1</del>');

  // Monospace code: `code`
  text = text.replace(/`([^`\n]+)`/g, '<code class="msg-code">$1</code>');

  // Currency highlighting: ₹12,345 or Rs 12,345
  text = text.replace(/([₹Rs\.]+[\s]*[\d,]+(?:\.\d+)?)/g, '<span class="msg-currency">$1</span>');

  // Bullets: lines starting with • or -
  text = text.replace(/^[\s]*[•\-]\s*(.*)$/gm, '<div class="msg-bullet"><span class="bullet-dot">▸</span> $1</div>');

  // Newlines to br
  text = text.replace(/\n/g, '<br>');

  return text;
}

function cleanThreadSnippet(rawText) {
  if (!rawText) return 'Connected to WhatsApp';
  let clean = String(rawText)
    .replace(/[*_~`#]/g, '')       // strip markdown markers
    .replace(/\s+/g, ' ')          // collapse multiple spaces and newlines
    .trim();
  if (clean.length > 50) {
    clean = clean.substring(0, 48) + '...';
  }
  return escapeHtml(clean);
}

function renderWhatsAppThreadsList() {
  const container = document.getElementById('wa-threads-list');
  const query = (document.getElementById('wa-search-input')?.value || '').toLowerCase().trim();

  let filtered = allConversations.filter(c => {
    // Team Agent Filter
    if (selectedAgentFilter !== 'ALL') {
      const assigned = c.assigned_agent || c.assignedAgent || '';
      if (selectedAgentFilter === 'UNASSIGNED') {
        if (assigned !== '') return false;
      } else {
        if (!assigned.toLowerCase().includes(selectedAgentFilter.toLowerCase())) return false;
      }
    }

    const custName = c.customerName || c.customer_name || '';
    const lastContent = typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.content || '');
    if (!query) return true;
    return custName.toLowerCase().includes(query) ||
           (c.phone && c.phone.includes(query)) ||
           lastContent.toLowerCase().includes(query);
  });

  // Client-side deduplication to guarantee no double cards
  const uniqueFiltered = [];
  const seenFilterPhones = new Set();
  for (const c of filtered) {
    const key = (c.phone || '').replace(/\D/g, '').slice(-10);
    if (!key || seenFilterPhones.has(key)) continue;
    seenFilterPhones.add(key);
    uniqueFiltered.push(c);
  }

  if (uniqueFiltered.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
        <i class="fab fa-whatsapp" style="font-size: 24px; opacity:0.5; margin-bottom:8px; display:block;"></i>
        No active WhatsApp conversations found
      </div>
    `;
    return;
  }

  container.innerHTML = uniqueFiltered.map(c => {
    const cleanPhone = (c.phone || '').replace(/\D/g, '');
    const isActive = activeChatPhone === cleanPhone;
    const custName = c.customerName || c.customer_name || ('Client +' + cleanPhone.slice(-4));
    const initial = custName.charAt(0).toUpperCase();
    const lastTime = c.lastTimestamp || c.lastMessage?.timestamp || c.updatedAt;
    const timeStr = lastTime ? formatTimestamp(lastTime) : '';
    const rawMsg = typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.content || '');
    const lastSnippet = cleanThreadSnippet(rawMsg);
    const lastRole = typeof c.lastMessage === 'object' ? c.lastMessage?.role : c.role;
    const isOutbound = lastRole === 'assistant' || lastRole === 'human_agent' || lastRole === 'user_owner';
    const isHuman = c.humanTakeover || c.human_takeover;
    const priority = (c.priority || 'P2').toUpperCase();

    // Delivery receipt tick
    const receiptStatus = (c.lastReceiptStatus || c.lastMessage?.receipt || 'sent').toLowerCase();
    let tickHtml = '';
    if (isOutbound) {
      if (receiptStatus === 'read') tickHtml = '<span class="tick-blue" title="Read by customer">✓✓ </span>';
      else if (receiptStatus === 'delivered') tickHtml = '<span title="Delivered">✓✓ </span>';
      else if (receiptStatus === 'failed') tickHtml = '<span class="tick-failed" title="Failed">⚠ </span>';
      else tickHtml = '<span title="Sent">✓ </span>';
    }

    return `
      <div class="wa-thread-card ${isActive ? 'active' : ''}" onclick="selectConversation('${cleanPhone}')" data-phone="${cleanPhone}">
        <div class="wa-thread-avatar">${initial}</div>
        <div class="wa-thread-info">
          <div class="wa-thread-row">
            <span class="wa-thread-name">${escapeHtml(custName)}</span>
            <span class="wa-thread-time">${timeStr}</span>
          </div>
          <div class="wa-thread-row">
            <span class="wa-thread-snippet">${isOutbound ? '<span style="color:var(--accent-green);">' + tickHtml + 'You: </span>' : ''}${lastSnippet}</span>
            <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
              ${c.assigned_agent ? `<span class="agent-assigned-tag"><i class="fas fa-user-check"></i> ${escapeHtml(c.assigned_agent)}</span>` : ''}
              <span class="thread-priority-tag ${priority.toLowerCase()}">${priority}</span>
              ${isHuman ? '<span class="badge badge-amber" style="font-size:9px; padding:2px 4px;">Human</span>' : '<span class="badge badge-green" style="font-size:9px; padding:2px 4px;">AI</span>'}
            </div>
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
    el.classList.toggle('active', el.getAttribute('data-phone') === cleanPhone);
  });

  // Find thread details
  const thread = allConversations.find(c => (c.phone || '').replace(/\D/g, '') === cleanPhone);
  const displayName = thread?.customerName || thread?.customer_name || ('Client +' + cleanPhone.slice(-4));
  
  document.getElementById('active-chat-name').textContent = displayName;
  document.getElementById('active-chat-phone').textContent = `+${cleanPhone}`;
  document.getElementById('active-chat-avatar').textContent = displayName.charAt(0).toUpperCase();

  // Update Header Priority Tag & Dropdowns
  const priorityEl = document.getElementById('active-priority-badge');
  const prioritySelect = document.getElementById('active-thread-priority');
  const stageSelect = document.getElementById('active-thread-stage');
  const brandEl = document.getElementById('active-chat-brand');

  const pVal = (thread?.priority || 'P2').toUpperCase();
  if (priorityEl) {
    priorityEl.style.display = 'inline-block';
    priorityEl.className = `thread-priority-tag ${pVal.toLowerCase()}`;
    priorityEl.textContent = pVal;
  }
  if (prioritySelect) {
    prioritySelect.value = pVal;
  }
  if (stageSelect) {
    stageSelect.value = thread?.pipeline_stage || thread?.leadStatus || activeChatLead?.pipeline_stage || 'NEW_LEAD';
  }
  const assignedAgentSelect = document.getElementById('active-chat-assigned-agent');
  if (assignedAgentSelect) {
    assignedAgentSelect.value = thread?.assigned_agent || thread?.assignedAgent || '';
  }
  if (brandEl) {
    brandEl.style.display = 'inline-block';
    brandEl.textContent = thread?.websiteDomain || thread?.websiteName || 'gcmsafetynets.in';
  }

  // Populate Customer Overview Panel (Region 3)
  const custPanelName = document.getElementById('cust-panel-name');
  const custPanelPhone = document.getElementById('cust-panel-phone');
  const custPanelWaLink = document.getElementById('cust-panel-wa-link');
  const custPanelWebsite = document.getElementById('cust-panel-website');
  const custPanelStage = document.getElementById('cust-panel-stage');
  const custPanelAgent = document.getElementById('cust-panel-agent');
  const custPanelProduct = document.getElementById('cust-panel-product');
  const custPanelDimensions = document.getElementById('cust-panel-dimensions');
  const custPanelPrice = document.getElementById('cust-panel-price');

  if (custPanelName) custPanelName.textContent = displayName;
  if (custPanelPhone) custPanelPhone.textContent = `+${cleanPhone}`;
  if (custPanelWaLink) custPanelWaLink.href = `https://wa.me/${cleanPhone}`;
  if (custPanelWebsite) custPanelWebsite.textContent = thread?.websiteDomain || thread?.websiteName || 'gcmsafetynets.in';
  if (custPanelStage) custPanelStage.textContent = (thread?.pipeline_stage || 'New Lead').replace('_', ' ');
  if (custPanelAgent) custPanelAgent.textContent = thread?.assigned_agent || thread?.assignedAgent || 'Gopichand (Admin)';
  if (custPanelProduct) custPanelProduct.textContent = thread?.serviceName || activeChatLead?.requirement || 'Balcony Safety Nets';
  if (custPanelDimensions) custPanelDimensions.textContent = thread?.dimensions || activeChatLead?.dimensions || 'Pending measurement';
  if (custPanelPrice) custPanelPrice.textContent = thread?.total_amount ? ('₹' + Number(thread.total_amount).toLocaleString('en-IN')) : '₹--';

  // Mobile layout switch to chat view (only if on screen <= 768px)
  const hubLayout = document.querySelector('.wa-hub-layout');
  const mobileBackBtn = document.getElementById('wa-mobile-back-btn');
  if (window.innerWidth <= 768) {
    if (hubLayout) hubLayout.classList.add('mobile-chat-open');
    if (mobileBackBtn) mobileBackBtn.style.display = 'inline-flex';
  } else {
    if (mobileBackBtn) mobileBackBtn.style.display = 'none';
  }

  loadInternalNotes(cleanPhone);

  // Show action bar, quick chips & composer
  document.getElementById('active-chat-actions').style.display = 'flex';
  document.getElementById('wa-quick-chips').style.display = 'flex';
  document.getElementById('wa-composer-area').style.display = 'flex';

  // Update AI Autopilot Button state
  updateAutoPilotBtn(thread?.humanTakeover || thread?.human_takeover);

  // Load message stream with forced scroll to bottom on thread selection
  loadActiveChatMessages(cleanPhone, true);
}

async function loadActiveChatMessages(phone, forceScroll = false) {
  const container = document.getElementById('wa-messages-stream');
  try {
    const res = await fetch(`/api/whatsapp/conversations/${phone}`);
    const data = await res.json();
    if (data.success && Array.isArray(data.messages)) {
      activeChatLead = data.lead || null;

      // Smart scroll detection: Check if user was already near bottom before rendering new messages
      const isNearBottom = container ? (container.scrollHeight - container.scrollTop - container.clientHeight <= 140) : true;

      renderMessages(data.messages);

      if (forceScroll || isNearBottom) {
        setTimeout(scrollToBottom, 50);
      } else {
        // User was reading older messages: show floating "Scroll to latest" button instead of jumping
        const scrollBtn = document.getElementById('wa-scroll-bottom-btn');
        if (scrollBtn) scrollBtn.style.display = 'inline-flex';
      }
    }
  } catch (err) {
    console.error('Failed to load active chat messages:', err);
  }
}

function scrollToBottom() {
  const container = document.getElementById('wa-messages-stream');
  if (container) {
    container.scrollTop = container.scrollHeight;
    const scrollBtn = document.getElementById('wa-scroll-bottom-btn');
    if (scrollBtn) scrollBtn.style.display = 'none';
  }
}

function scrollToBottomSmooth() {
  const container = document.getElementById('wa-messages-stream');
  if (container) {
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    const scrollBtn = document.getElementById('wa-scroll-bottom-btn');
    if (scrollBtn) scrollBtn.style.display = 'none';
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
    const isHumanAgent = m.role === 'human_agent' || m.role === 'user_owner';
    const isAi = m.role === 'assistant';
    const isOutbound = isHumanAgent || isAi;
    const isCustomer = m.role === 'user' || m.role === 'customer';
    
    let bubbleClass = isOutbound ? 'outgoing' : 'incoming';
    if (isHumanAgent) bubbleClass += ' human-agent';

    let senderLabel = '';
    if (isHumanAgent) {
      senderLabel = '👤 Gopichand | Operations Admin';
    } else if (isAi) {
      senderLabel = '💼 Venkatesh | GCM Technical Consultant (+91 99123 99334)';
    } else {
      senderLabel = activeChatLead?.customer_name || 'WhatsApp Customer';
    }

    const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const formattedContent = formatWhatsAppText(m.content || '');

    // Real-Time Delivery Receipt Tick
    let tickHtml = '';
    if (isOutbound) {
      const receipt = (m.receipt || 'sent').toLowerCase();
      if (receipt === 'read') {
        tickHtml = '<span class="tick-blue" title="Read by customer">✓✓</span>';
      } else if (receipt === 'delivered') {
        tickHtml = '<span title="Delivered to device">✓✓</span>';
      } else if (receipt === 'failed') {
        tickHtml = `<span class="tick-failed" title="Delivery Failed: ${escapeHtml(m.errorCode || '')}">⚠ Failed</span>`;
      } else {
        tickHtml = '<span title="Sent to WhatsApp Cloud">✓</span>';
      }
    }

    const wamidAttr = m.wamid ? `data-wamid="${escapeHtml(m.wamid)}"` : '';

    return `
      <div class="wa-message-bubble ${bubbleClass}" ${wamidAttr}>
        <span class="wa-msg-sender">${senderLabel}</span>
        <div class="wa-msg-text">${formattedContent}</div>
        <span class="wa-msg-meta">${timeStr} ${tickHtml}</span>
      </div>
    `;
  }).join('');
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
  tempDiv.className = 'wa-message-bubble outgoing human-agent';
  tempDiv.innerHTML = `
    <span class="wa-msg-sender">👤 Human Agent (Gopichand / Staff)</span>
    <div class="wa-msg-text">${escapeHtml(message).replace(/\n/g, '<br>')}</div>
    <span class="wa-msg-meta">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Sending...</span>
  `;
  container.appendChild(tempDiv);
  scrollToBottom();

  try {
    const res = await fetch(`/api/whatsapp/conversations/${activeChatPhone}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, asHuman: true })
    });
    const data = await res.json();
    if (!data.success) {
      alert('Failed to send message: ' + (data.error || 'Unknown error'));
    }
    // Update local takeover button
    updateAutoPilotBtn(true);
    // Refresh conversation
    loadActiveChatMessages(activeChatPhone, true);
    loadWhatsAppConversations();
  } catch (err) {
    alert('Error sending WhatsApp message: ' + err.message);
  }
}

function applyMacro(type) {
  const input = document.getElementById('wa-message-input');
  if (!input) return;

  if (type === 'quote') {
    quickSendQuoteToActiveChat();
    return;
  }

  let text = '';
  if (type === 'visit') {
    text = 'Namaste! We can schedule our senior technician with our installation van to visit your site for 100% free measurement and sample demonstration today. Could you please share your exact location or Google Maps pin?';
  } else if (type === 'bank') {
    text = `Official GCM Enterprises Direct Settlement Details (0% Gateway Commission):\n\n` +
           `1. ICICI Bank Current Account:\n` +
           `   A/C No: 004805018635\n` +
           `   IFSC: ICIC0000048\n` +
           `   Name: GCM ENTERPRISES\n\n` +
           `2. State Bank of India (SBI):\n` +
           `   A/C No: 44979437825\n` +
           `   IFSC: SBIN0021462\n` +
           `   Name: GCM ENTERPRISES\n\n` +
           `3. Instant UPI (Scan & Pay with GPay / PhonePe / Paytm):\n` +
           `   UPI VPA: gcmenterprises@ybl / gcmenterprises@ybl\n` +
           `   QR Link: https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=gcmenterprises@ybl%26pn=GCM%20ENTERPRISES%26cu=INR\n\n` +
           `Please share payment screenshot / UTR number for instant dispatch and official GST bill.`;
  } else if (type === 'specs') {
    text = `Technical Material Specifications from GCM Enterprises:\n` +
           `• Balcony Safety: 100% Virgin Nylon 6 High Tenacity (1.2mm / 15-ply, 30mm mesh, 150+ kg dynamic impact, UV stabilized).\n` +
           `• Bird & Pigeon: UV Stabilized 0.8mm Monofilament (25mm mesh, near invisible from 10ft, humane).\n` +
           `• Fasteners: Heavy-Duty Marine Grade AISI 316 Stainless Steel anchor fasteners.\n` +
           `• Sports & Turf: 2.5mm Braided HDPE (40mm / 45mm mesh) with 5-year UV outdoor warranty.`;
  } else if (type === 'owner') {
    text = 'I am Founder & Managing Director Gopichand Mailapally. I am available to personally assist you at +91 99123 99224. Please feel free to call me directly anytime.';
  } else if (type === 'dimensions') {
    text = 'Namaste! Could you please share your balcony or window dimensions (Length x Height in feet)? Our engineering team will immediately prepare an exact estimation for you.';
  } else if (type === 'photo') {
    text = 'Could you please take a quick photo or short video of your balcony / installation area and send it here? Our senior technician will inspect it and advise the best setup.';
  }

  input.value = text;
  input.focus();
}

async function changeThreadPriority(priority) {
  if (!activeChatPhone) return;
  try {
    const res = await fetch(`/api/whatsapp/conversations/${activeChatPhone}/update-meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority })
    });
    const data = await res.json();
    if (data.success) {
      const priorityEl = document.getElementById('active-priority-badge');
      if (priorityEl) {
        priorityEl.className = `thread-priority-tag ${priority.toLowerCase()}`;
        priorityEl.textContent = priority;
      }
      const t = allConversations.find(c => (c.phone || '').replace(/\D/g, '') === activeChatPhone);
      if (t) t.priority = priority;
      renderWhatsAppThreadsList();
    }
  } catch (err) {
    console.error('Error changing priority:', err);
  }
}

async function changeThreadStage(pipelineStage) {
  if (!activeChatPhone) return;
  try {
    const res = await fetch(`/api/whatsapp/conversations/${activeChatPhone}/update-meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipelineStage })
    });
    const data = await res.json();
    if (data.success) {
      const t = allConversations.find(c => (c.phone || '').replace(/\D/g, '') === activeChatPhone);
      if (t) t.leadStatus = pipelineStage;
      if (activeChatLead) activeChatLead.pipeline_stage = pipelineStage;
      renderWhatsAppThreadsList();
    }
  } catch (err) {
    console.error('Error changing stage:', err);
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
    btn.className = 'chat-autopilot-btn human-mode';
    btn.innerHTML = '<span class="autopilot-dot"></span><span id="autopilot-text">Human Takeover</span>';
    btn.title = 'Human operator speaking. Click to resume autonomous AI bot.';
  } else {
    btn.className = 'chat-autopilot-btn';
    btn.innerHTML = '<span class="autopilot-dot"></span><span id="autopilot-text">AI Auto-Pilot: ON</span>';
    btn.title = 'AI is autonomously conversing using RAG knowledge. Click to take over.';
  }
}

async function toggleAutoPilot() {
  if (!activeChatPhone) return;
  try {
    const res = await fetch(`/api/whatsapp/conversations/${activeChatPhone}/toggle-takeover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      updateAutoPilotBtn(data.humanTakeover);
      const t = allConversations.find(c => (c.phone || '').replace(/\D/g, '') === activeChatPhone);
      if (t) t.humanTakeover = data.humanTakeover;
      renderWhatsAppThreadsList();
    }
  } catch (err) {
    alert('Failed to toggle autopilot: ' + err.message);
  }
}

// ── Web Audio Synthesizer Notification Chime ────────────────────────────────
function playMessageChime(isAlert = false) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (isAlert) {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08); // E5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    }
  } catch {}
}

// ── Server-Sent Events (SSE) Live Stream Listener ────────────────────────────
function initSSEStream() {
  if (!window.EventSource) return;
  if (sseSource) {
    try { sseSource.close(); } catch {}
  }

  const streamToken = localStorage.getItem('chatgcm_token') || localStorage.getItem('adminKey') || '';
  sseSource = new EventSource('/api/whatsapp/stream?token=' + encodeURIComponent(streamToken));

  sseSource.onopen = () => {
    const statusEl = document.getElementById('live-sse-status');
    const textEl = document.getElementById('sse-status-text');
    if (statusEl) statusEl.className = 'live-sse-badge';
    if (textEl) textEl.textContent = '🟢 Live Stream Connected';
  };

  sseSource.addEventListener('new_message', (e) => {
    try {
      const data = JSON.parse(e.data);
      handleIncomingLiveMessage(data);
    } catch (err) {
      console.error('Error handling SSE new_message:', err);
    }
  });

  sseSource.addEventListener('receipt_update', (e) => {
    try {
      const data = JSON.parse(e.data);
      handleLiveReceiptUpdate(data);
    } catch (err) {
      console.error('Error handling SSE receipt_update:', err);
    }
  });

  sseSource.addEventListener('takeover_update', (e) => {
    try {
      const data = JSON.parse(e.data);
      handleLiveTakeoverUpdate(data);
    } catch (err) {
      console.error('Error handling SSE takeover_update:', err);
    }
  });

    sseSource.addEventListener('kanban_update', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (currentTab === 'kanban') loadKanbanBoard();
      showToastNotification(`Pipeline auto-synced: Lead shifted to ${data.newStage}`);
    } catch (err) {
      console.error('Error handling SSE kanban_update:', err);
    }
  });

  sseSource.addEventListener('agent_assigned', (e) => {
    try {
      loadWhatsAppConversations();
    } catch (err) {}
  });

  sseSource.addEventListener('new_internal_note', (e) => {
    try {
      const data = JSON.parse(e.data);
      const clean = (data.phone || '').replace(/\D/g, '');
      if (activeChatPhone === clean) {
        loadInternalNotes(clean);
      }
    } catch (err) {}
  });
  sseSource.addEventListener('lead_update', (e) => {
    try {
      const data = JSON.parse(e.data);
      handleLiveLeadUpdate(data);
    } catch (err) {
      console.error('Error handling SSE lead_update:', err);
    }
  });

  sseSource.onerror = () => {
    const statusEl = document.getElementById('live-sse-status');
    const textEl = document.getElementById('sse-status-text');
    if (statusEl) statusEl.className = 'live-sse-badge reconnecting';
    if (textEl) textEl.textContent = '🟡 Reconnecting Stream...';
  };
}

function handleIncomingLiveMessage(data) {
  const cleanPhone = (data.phone || '').replace(/\D/g, '');
  const isCurrentChat = activeChatPhone === cleanPhone;

  // Play audio chime
  playMessageChime(Boolean(data.humanTakeover));

  if (isCurrentChat) {
    // If full history is provided, render it; otherwise append single message
    if (data.allMessages && Array.isArray(data.allMessages)) {
      renderMessages(data.allMessages);
    } else if (data.message) {
      const container = document.getElementById('wa-messages-stream');
      const isCustomer = data.message.role === 'user' || data.message.role === 'customer';
      const isHuman = data.message.role === 'human_agent';
      let bubbleClass = isCustomer ? 'incoming' : 'outgoing';
      if (isHuman) bubbleClass += ' human-agent';

      const div = document.createElement('div');
      div.className = `wa-message-bubble ${bubbleClass}`;
      if (data.message.wamid) div.setAttribute('data-wamid', data.message.wamid);
      div.innerHTML = `
        <span class="wa-msg-sender">${isCustomer ? (activeChatLead?.customer_name || 'Customer') : (isHuman ? '👤 Gopichand | Direct' : '💼 Venkatesh | GCM Technical Consultant')}</span>
        <div class="wa-msg-text">${escapeHtml(data.message.content || '').replace(/\n/g, '<br>')}</div>
        <span class="wa-msg-meta">${new Date(data.message.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${isCustomer ? '' : '✓'}</span>
      `;
      container.appendChild(div);
    }
    setTimeout(scrollToBottom, 50);
  }

  // Update in-memory threads list and UI
  let thread = allConversations.find(c => (c.phone || '').replace(/\D/g, '') === cleanPhone);
  if (thread) {
    thread.lastMessage = data.message || { content: data.message?.content || 'New Message' };
    thread.updatedAt = new Date().toISOString();
    if (data.humanTakeover !== undefined) thread.humanTakeover = data.humanTakeover;
  } else {
    // Reload full list if new thread
    loadWhatsAppConversations();
  }
  renderWhatsAppThreadsList();
}

function handleLiveReceiptUpdate(data) {
  const wamid = data.wamid;
  const status = (data.status || '').toLowerCase();

  // Find message in active chat window if displayed
  if (wamid) {
    const bubble = document.querySelector(`.wa-message-bubble[data-wamid="${wamid}"]`);
    if (bubble) {
      const meta = bubble.querySelector('.wa-msg-meta');
      if (meta) {
        const timePart = meta.textContent.split(' ')[0] || '';
        let tick = '✓';
        if (status === 'read') tick = '<span class="tick-blue">✓✓</span>';
        else if (status === 'delivered') tick = '✓✓';
        else if (status === 'failed') tick = '<span class="tick-failed">⚠ Failed</span>';
        meta.innerHTML = `${timePart} ${tick}`;
      }
    }
  }

  // Update in thread card snippet
  const cleanPhone = (data.recipientPhone || '').replace(/\D/g, '');
  const thread = allConversations.find(c => (c.phone || '').replace(/\D/g, '') === cleanPhone);
  if (thread) {
    thread.lastReceiptStatus = status;
    renderWhatsAppThreadsList();
  }
}

function handleLiveTakeoverUpdate(data) {
  const cleanPhone = (data.phone || '').replace(/\D/g, '');
  if (activeChatPhone === cleanPhone) {
    updateAutoPilotBtn(data.humanTakeover);
  }
  const thread = allConversations.find(c => (c.phone || '').replace(/\D/g, '') === cleanPhone);
  if (thread) {
    thread.humanTakeover = data.humanTakeover;
    renderWhatsAppThreadsList();
  }
}

function handleLiveLeadUpdate(data) {
  const cleanPhone = (data.phone || '').replace(/\D/g, '');
  const thread = allConversations.find(c => (c.phone || '').replace(/\D/g, '') === cleanPhone);
  if (thread) {
    if (data.priority) thread.priority = data.priority;
    if (data.pipelineStage) thread.leadStatus = data.pipelineStage;
    renderWhatsAppThreadsList();
  }
  if (activeChatPhone === cleanPhone) {
    if (data.priority) {
      const priorityEl = document.getElementById('active-priority-badge');
      const prioritySelect = document.getElementById('active-thread-priority');
      if (priorityEl) {
        priorityEl.className = `thread-priority-tag ${data.priority.toLowerCase()}`;
        priorityEl.textContent = data.priority;
      }
      if (prioritySelect) prioritySelect.value = data.priority;
    }
    if (data.pipelineStage) {
      const stageSelect = document.getElementById('active-thread-stage');
      if (stageSelect) stageSelect.value = data.pipelineStage;
    }
  }
}

// ── 2. Visual 5-Stage Kanban Board ─────────────────────────────────────────────
function renderKanbanBoard() {
  loadKanbanBoard();
  return;
  // Legacy implementation bypassed for 5-stage B2B Kanban

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

// ── Direct Corporate Bank Transfer & Zero-Fee UPI Settlement Handlers ─────────
function openBankDetailsModal() {
  const modal = document.getElementById('modal-bank-details');
  if (modal) modal.classList.remove('hidden');
}

function updateBankModalQR(amt) {
  const qrImg = document.getElementById('modal-bank-qr-img');
  if (!qrImg) return;
  const num = Number(amt) || 0;
  const amtParam = num > 0 ? `%26am=${num}` : '';
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=gcmenterprises@ybl%26pn=GCM%20ENTERPRISES${amtParam}%26cu=INR`;
}

function copyText(str) {
  navigator.clipboard.writeText(str).then(() => {
    alert(`Copied to clipboard: ${str}`);
  }).catch(() => {
    prompt('Copy to clipboard:', str);
  });
}

function copyFullBankDetails() {
  const text = `🏛️ GCM ENTERPRISES — OFFICIAL SETTLEMENT DETAILS\n` +
    `Zero Gateway Fee • Direct Corporate Bank Settlement\n\n` +
    `🔹 STATE BANK OF INDIA (PRIMARY)\n` +
    `• Account Name: GCM ENTERPRISES\n` +
    `• Current A/C No: 44979437825\n` +
    `• IFSC Code: SBIN0021462\n` +
    `• Branch: Greenpark Colony Branch, Hyderabad\n\n` +
    `🔹 ICICI BANK LIMITED\n` +
    `• Account Name: GCM ENTERPRISES\n` +
    `• Current A/C No: 000805021234\n` +
    `• IFSC Code: ICIC0000008\n` +
    `• Branch: Banjara Hills, Hyderabad\n\n` +
    `📲 0% COMMISSION UPI HANDLES:\n` +
    `• PhonePe / Google Pay: 9912399224\n` +
    `• UPI VPA: gcmenterprises@ybl / gcmenterprises@ybl\n` +
    `• QR Link: https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=gcmenterprises@ybl%26pn=GCM%20ENTERPRISES%26cu=INR\n`;

  navigator.clipboard.writeText(text).then(() => {
    alert('Complete GCM Bank & UPI credentials copied to clipboard!');
  }).catch(() => {
    prompt('Copy credentials:', text);
  });
}

async function dispatchBankDetailsToChat() {
  if (!activeChatPhone) {
    alert('Please select an active WhatsApp conversation first.');
    return;
  }

  const amtInput = document.getElementById('bank-qr-custom-amount');
  const amount = amtInput ? amtInput.value : '';

  try {
    const res = await fetch(`/api/whatsapp/conversations/${activeChatPhone}/send-bank-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount || undefined,
        note: 'Order Booking / Advance Settlement'
      })
    });

    const data = await res.json();
    if (data.success) {
      closeModal('modal-bank-details');
      playChime('sent');
      loadActiveChatMessages(activeChatPhone, true);
    } else {
      alert('Error sending bank details: ' + (data.error || 'Failed'));
    }
  } catch (err) {
    console.error('Failed to send bank details:', err);
    alert('Network error while dispatching bank details.');
  }
}

// Explicit window bindings for inline HTML onclick handlers
window.openBankDetailsModal = openBankDetailsModal;
window.updateBankModalQR = updateBankModalQR;
window.copyText = copyText;
window.copyFullBankDetails = copyFullBankDetails;
window.dispatchBankDetailsToChat = dispatchBankDetailsToChat;



// ==============================================================================
// B2B SAAS PILLAR 1: META CLOUD API CONNECTION MODULE
// ==============================================================================

async function loadMetaConnections() {
  try {
    const res = await fetch('/api/admin/meta/connections');
    const data = await res.json();
    if (data.success) {
      if (document.getElementById('meta-webhook-url')) {
        document.getElementById('meta-webhook-url').value = data.webhookEndpoint || 'https://chatgcm.in/api/whatsapp/webhook';
      }
      if (document.getElementById('meta-verify-token')) {
        document.getElementById('meta-verify-token').value = data.verifyToken || 'gcm_whatsapp_verify_2026';
      }
    }
  } catch (err) {
    console.error('Failed to load Meta connections:', err);
  }
}

function copyMetaText(text, btnElement) {
  navigator.clipboard.writeText(text).then(() => {
    const origHtml = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fas fa-check" style="color:#10b981;"></i> Copied!';
    btnElement.classList.add('btn-green');
    setTimeout(() => {
      btnElement.innerHTML = origHtml;
      btnElement.classList.remove('btn-green');
    }, 2000);
  }).catch(() => {
    prompt('Copy value:', text);
  });
}

async function sendMetaTestPing() {
  const phoneInput = document.getElementById('meta-ping-phone');
  const outPre = document.getElementById('meta-ping-output');
  const btn = document.getElementById('btn-meta-test-ping');

  const phone = phoneInput ? phoneInput.value.trim() : '';
  if (!phone) {
    alert('Please enter a recipient phone number (e.g. +91 99123 99334)');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Dispatching Handshake...';
  outPre.textContent = `Connecting to Meta Cloud API graph node via srv1629697.hstgr.cloud...
Target: ${phone}`;

  try {
    const res = await fetch('/api/admin/meta/test-ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();

    if (data.success) {
      outPre.textContent = `⚡ HANDSHAKE SUCCESSFUL (200 OK)
Timestamp: ${new Date().toISOString()}
WAMID: ${data.details?.data?.messages?.[0]?.id || 'Verified'}
Recipient: ${phone}
Status: Enqueued on WhatsApp Business Platform`;
      playChime('sent');
      loadMetaTelemetry();
    } else {
      outPre.textContent = `❌ HANDSHAKE FAILED
Response: ${JSON.stringify(data, null, 2)}`;
    }
  } catch (err) {
    outPre.textContent = `❌ NETWORK ERROR: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-bolt"></i> Send Meta Cloud Test Ping';
  }
}

async function loadMetaTelemetry() {
  const tbody = document.getElementById('meta-telemetry-tbody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/admin/meta/telemetry');
    const data = await res.json();
    if (data.success) {
      const receipts = data.receipts || [];
      if (receipts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">No webhook telemetry events recorded yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = receipts.map(r => {
        let statusClass = 'badge-green';
        if (r.receipt_status === 'failed') statusClass = 'badge-red';
        else if (r.receipt_status === 'sent') statusClass = 'badge-cyan';
        else if (r.receipt_status === 'read') statusClass = 'badge-indigo';

        return `
          <tr>
            <td style="font-size:12px; color:var(--text-secondary);">${formatTimestamp(r.created_at)}</td>
            <td style="font-family:monospace; font-size:11px; color:#38bdf8;">${escapeHtml(r.wamid || '--')}</td>
            <td style="font-size:12px; font-weight:600;">${escapeHtml(r.phone_number || '--')}</td>
            <td><span class="badge ${statusClass}">${(r.receipt_status || 'UNKNOWN').toUpperCase()}</span></td>
            <td style="font-family:monospace; font-size:10.5px; color:var(--text-muted);">${escapeHtml(r.idempotency_key ? r.idempotency_key.substring(0, 16) + '...' : '--')}</td>
            <td><span style="color:#10b981; font-size:11px;"><i class="fas fa-check-double"></i> Verified</span></td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Failed to load telemetry:', err);
  }
}


// ==============================================================================
// B2B SAAS PILLAR 2: MULTI-AGENT SHARED INBOX & PRIVATE TEAM NOTES
// ==============================================================================

let selectedAgentFilter = 'ALL';

function filterThreadsByAgent(agentName) {
  selectedAgentFilter = agentName;
  filterWhatsAppThreads();
}

async function changeActiveAssignedAgent(agentName) {
  if (!activeChatPhone) return;

  try {
    const res = await fetch(`/api/whatsapp/conversations/${activeChatPhone}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentName })
    });
    const data = await res.json();
    if (data.success) {
      showToastNotification(`Conversation assigned to ${agentName || 'Unassigned'}`);
      loadWhatsAppConversations();
    }
  } catch (err) {
    console.error('Failed to assign agent:', err);
  }
}

function toggleInternalNotesDrawer() {
  const drawer = document.getElementById('wa-internal-notes-drawer');
  if (!drawer) return;

  if (drawer.style.display === 'none' || drawer.style.display === '') {
    drawer.style.display = 'flex';
    if (activeChatPhone) {
      loadInternalNotes(activeChatPhone);
    }
  } else {
    drawer.style.display = 'none';
  }
}

async function loadInternalNotes(phone) {
  const listEl = document.getElementById('active-internal-notes-list');
  const badgeEl = document.getElementById('active-notes-count');
  const panelStream = document.getElementById('cust-panel-notes-stream');
  const panelBadge = document.getElementById('cust-panel-notes-badge');
  if (!listEl && !panelStream) return;

  try {
    const res = await fetch(`/api/whatsapp/conversations/${phone}/internal-notes`);
    const data = await res.json();
    if (data.success) {
      const notes = data.notes || [];
      if (badgeEl) {
        badgeEl.textContent = notes.length;
        badgeEl.style.display = notes.length > 0 ? 'inline-block' : 'none';
      }
      if (panelBadge) {
        panelBadge.textContent = notes.length;
      }

      const emptyDrawerHtml = `
        <div style="text-align:center; padding:24px; color:var(--text-muted); font-size:12px;">
          <i class="fas fa-lock" style="font-size:24px; color:#f59e0b; margin-bottom:8px; display:block;"></i>
          No private notes yet. Write handover instructions or internal customer preferences below.
        </div>
      `;

      const emptyPanelHtml = `
        <div style="font-size:11.5px; color:var(--text-muted); text-align:center; padding:12px 0;">
          No private notes yet. Add one below.
        </div>
      `;

      if (notes.length === 0) {
        if (listEl) listEl.innerHTML = emptyDrawerHtml;
        if (panelStream) panelStream.innerHTML = emptyPanelHtml;
        return;
      }

      const notesHtml = notes.map(n => `
        <div class="internal-note-card">
          <div class="internal-note-meta">
            <span style="font-weight:700; color:#f59e0b;"><i class="fas fa-user-shield"></i> ${escapeHtml(n.author || 'Team Member')}</span>
            <span>${formatTimestamp(n.created_at)}</span>
          </div>
          <div class="internal-note-text">${escapeHtml(n.note || '')}</div>
        </div>
      `).join('');

      if (listEl) {
        listEl.innerHTML = notesHtml;
        listEl.scrollTop = listEl.scrollHeight;
      }
      if (panelStream) {
        panelStream.innerHTML = notesHtml;
        panelStream.scrollTop = panelStream.scrollHeight;
      }
    }
  } catch (err) {
    console.error('Failed to load internal notes:', err);
  }
}

async function submitInternalTeamNote() {
  if (!activeChatPhone) {
    alert('Please select an active conversation first.');
    return;
  }

  const inputEl = document.getElementById('internal-note-input');
  const note = inputEl ? inputEl.value.trim() : '';
  if (!note) return;

  try {
    const res = await fetch(`/api/whatsapp/conversations/${activeChatPhone}/internal-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note,
        author: 'Gopichand (Master Admin)'
      })
    });
    const data = await res.json();
    if (data.success) {
      inputEl.value = '';
      loadInternalNotes(activeChatPhone);
      showToastNotification('Private internal note saved.');
    }
  } catch (err) {
    console.error('Failed to save internal note:', err);
  }
}

async function submitCustomerPanelNote() {
  if (!activeChatPhone) {
    alert('Please select an active conversation first.');
    return;
  }

  const inputEl = document.getElementById('cust-panel-note-input');
  const note = inputEl ? inputEl.value.trim() : '';
  if (!note) return;

  try {
    const res = await fetch(`/api/whatsapp/conversations/${activeChatPhone}/internal-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note,
        author: 'Gopichand (Master Admin)'
      })
    });
    const data = await res.json();
    if (data.success) {
      inputEl.value = '';
      loadInternalNotes(activeChatPhone);
      showToastNotification('Private note added to customer profile.');
    }
  } catch (err) {
    console.error('Failed to save customer panel note:', err);
  }
}

function toggleCustomerPanel() {
  const hub = document.querySelector('.wa-hub-layout');
  if (hub) {
    hub.classList.toggle('details-collapsed');
    hub.classList.toggle('details-open');
  }
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar') || document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.toggle('mobile-open');
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar') || document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.remove('mobile-open');
  }
}

function closeMobileChat() {
  const hub = document.querySelector('.wa-hub-layout');
  if (hub) hub.classList.remove('mobile-chat-open');
  const mobileBackBtn = document.getElementById('wa-mobile-back-btn');
  if (mobileBackBtn) mobileBackBtn.style.display = 'none';
}

function toggleTokenMask(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
  } else {
    input.type = 'password';
    if (btn) btn.innerHTML = '<i class="fas fa-eye"></i>';
  }
}


// ==============================================================================
// B2B SAAS PILLAR 3: BUSINESS KNOWLEDGE BASE & RAG ENGINE
// ==============================================================================

async function loadKnowledgeDocuments() {
  const tbody = document.getElementById('kb-documents-tbody');
  const countBadge = document.getElementById('kb-doc-count-badge');
  if (!tbody) return;

  try {
    const res = await fetch('/api/admin/knowledge/documents');
    const data = await res.json();
    if (data.success) {
      const docs = data.documents || [];
      if (countBadge) countBadge.textContent = `${docs.length} Documents`;

      if (docs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">No documents indexed yet. Ingest your first document above.</td></tr>`;
        return;
      }

      tbody.innerHTML = docs.map(d => `
        <tr>
          <td>
            <div style="font-weight:700; color:#fff;">${escapeHtml(d.original_name || d.filename)}</div>
            <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(d.summary || '')}</div>
          </td>
          <td><span class="badge badge-amber">${escapeHtml(d.file_type || 'DOCUMENT')}</span></td>
          <td style="font-weight:700; color:#10b981;">${d.chunk_count || d.chunks_count || 1} chunks</td>
          <td><span class="badge badge-green"><i class="fas fa-check"></i> INDEXED</span></td>
          <td>
            <button class="btn btn-danger btn-xs" onclick="deleteKnowledgeDocument('${d.id}')" title="Delete Document">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load documents:', err);
  }
}

async function uploadKnowledgeDocument() {
  const title = document.getElementById('kb-doc-title').value.trim();
  const fileType = document.getElementById('kb-doc-type').value;
  const summary = document.getElementById('kb-doc-summary').value.trim();
  const content = document.getElementById('kb-doc-content').value.trim();

  if (!title || !content) {
    alert('Please enter a Document Title and paste the Content.');
    return;
  }

  try {
    const res = await fetch('/api/admin/knowledge/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: title, fileType, summary, content })
    });
    const data = await res.json();

    if (data.success) {
      alert(`Success: ${data.message}`);
      document.getElementById('kb-doc-title').value = '';
      document.getElementById('kb-doc-summary').value = '';
      document.getElementById('kb-doc-content').value = '';
      loadKnowledgeDocuments();
    } else {
      alert('Upload failed: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Failed to upload document:', err);
  }
}

async function deleteKnowledgeDocument(docId) {
  if (!confirm('Are you sure you want to delete this document and all its indexed RAG knowledge chunks?')) return;

  try {
    const res = await fetch(`/api/admin/knowledge/documents/${docId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadKnowledgeDocuments();
    }
  } catch (err) {
    console.error('Failed to delete document:', err);
  }
}

async function loadSystemConfig() {
  try {
    const res = await fetch('/api/admin/knowledge/system-config');
    const data = await res.json();
    if (data.success && data.config) {
      const c = data.config;
      if (document.getElementById('kb-sys-business-name')) document.getElementById('kb-sys-business-name').value = c.business_name || '';
      if (document.getElementById('kb-sys-tone')) document.getElementById('kb-sys-tone').value = c.persona_tone || '';
      if (document.getElementById('kb-sys-instruction')) document.getElementById('kb-sys-instruction').value = c.system_instruction || '';
      if (document.getElementById('kb-sys-fallback')) document.getElementById('kb-sys-fallback').value = c.fallback_reply || '';
    }
  } catch (err) {
    console.error('Failed to load system config:', err);
  }
}

async function saveSystemConfig() {
  const businessName = document.getElementById('kb-sys-business-name').value.trim();
  const personaTone = document.getElementById('kb-sys-tone').value.trim();
  const systemInstruction = document.getElementById('kb-sys-instruction').value.trim();
  const fallbackReply = document.getElementById('kb-sys-fallback').value.trim();

  try {
    const res = await fetch('/api/admin/knowledge/system-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName, personaTone, systemInstruction, fallbackReply })
    });
    const data = await res.json();
    if (data.success) {
      alert('AI System Prompt & Business Instructions successfully saved.');
    }
  } catch (err) {
    console.error('Failed to save system config:', err);
  }
}

async function testRAGQuery() {
  const query = document.getElementById('rag-test-query').value.trim();
  if (!query) return;

  const container = document.getElementById('rag-test-results-container');
  const chunksList = document.getElementById('rag-matched-chunks-list');
  const previewBox = document.getElementById('rag-synthesized-preview');

  try {
    const res = await fetch('/api/admin/knowledge/test-rag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await res.json();

    if (data.success) {
      container.style.display = 'block';
      const chunks = data.matchedChunks || [];
      chunksList.innerHTML = chunks.map(c => `
        <div style="background:rgba(245, 158, 11, 0.1); border:1px solid rgba(245, 158, 11, 0.25); border-radius:6px; padding:8px; font-size:11px;">
          <strong style="color:#f59e0b;">${escapeHtml(c.title || c.document_name || 'Chunk')}:</strong>
          <span style="color:#e2e8f0;">${escapeHtml((c.content || '').substring(0, 150))}...</span>
        </div>
      `).join('');

      previewBox.textContent = data.synthesizedReplyPreview || 'Reply generated.';
    }
  } catch (err) {
    console.error('Failed to test RAG:', err);
  }
}


// ==============================================================================
// B2B SAAS PILLAR 4: SALES PIPELINE KANBAN (5 STANDARDIZED STATES)
// ==============================================================================

let draggedLeadId = null;

async function loadKanbanBoard() {
  const cols = {
    NEW_LEAD: document.getElementById('cards-kanban-new-lead'),
    CONTACTED: document.getElementById('cards-kanban-contacted'),
    QUOTE_SENT: document.getElementById('cards-kanban-quote-sent'),
    WON: document.getElementById('cards-kanban-won'),
    LOST: document.getElementById('cards-kanban-lost')
  };

  const badgeCounts = {
    NEW_LEAD: document.getElementById('count-kanban-new-lead'),
    CONTACTED: document.getElementById('count-kanban-contacted'),
    QUOTE_SENT: document.getElementById('count-kanban-quote-sent'),
    WON: document.getElementById('count-kanban-won'),
    LOST: document.getElementById('count-kanban-lost')
  };

  // Clear columns
  Object.values(cols).forEach(c => { if (c) c.innerHTML = ''; });

  try {
    const res = await fetch('/api/admin/crm/kanban-leads');
    const data = await res.json();

    if (data.success && data.kanban) {
      const kanban = data.kanban;

      Object.keys(cols).forEach(stage => {
        const leads = kanban[stage] || [];
        if (badgeCounts[stage]) badgeCounts[stage].textContent = leads.length;

        if (cols[stage]) {
          if (leads.length === 0) {
            cols[stage].innerHTML = `
              <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 12px;">
                No leads in this stage
              </div>
            `;
          } else {
            cols[stage].innerHTML = leads.map(l => createKanbanCard5Html(l, stage)).join('');
          }
        }
      });
    }
  } catch (err) {
    console.error('Failed to load Kanban board:', err);
  }
}

function createKanbanCard5Html(lead, currentStage) {
  const site = GCM_WEBSITES[lead.website_id] || { name: lead.brand_name || lead.website_id || 'GCM Netting', badgeClass: 'badge-blue' };
  const val = lead.estimated_value > 0 ? `₹${Number(lead.estimated_value).toLocaleString('en-IN')}` : '₹--';
  const cleanPhone = (lead.whatsapp_number || lead.phone || '').replace(/\D/g, '');

  let nextStageBtn = '';
  if (currentStage === 'NEW_LEAD') {
    nextStageBtn = `<button class="kanban-btn-advance" onclick="moveKanbanLeadStage('${lead.id}', 'CONTACTED')">Contact &rarr;</button>`;
  } else if (currentStage === 'CONTACTED') {
    nextStageBtn = `<button class="kanban-btn-advance" onclick="moveKanbanLeadStage('${lead.id}', 'QUOTE_SENT')">Quote &rarr;</button>`;
  } else if (currentStage === 'QUOTE_SENT') {
    nextStageBtn = `<button class="kanban-btn-advance" style="color:#10b981; border-color:rgba(16,185,129,0.3);" onclick="moveKanbanLeadStage('${lead.id}', 'WON')">Won 🏆</button>`;
  }

  return `
    <div class="kanban-card" draggable="true" ondragstart="handleKanbanDragStart(event, '${lead.id}')" onclick="openWhatsAppChat('${cleanPhone}')">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
        <span class="badge ${site.badgeClass}" style="font-size:10px;">${escapeHtml(site.name)}</span>
        <span style="font-size:12px; font-weight:800; color:var(--accent-amber);">${val}</span>
      </div>

      <div style="font-weight:700; color:#fff; font-size:13.5px; margin-bottom:2px;">
        ${escapeHtml(lead.customer_name || 'Inbound Prospect')}
      </div>

      <div style="font-size:11.5px; color:var(--text-muted); display:flex; align-items:center; gap:6px; margin-bottom:6px;">
        <i class="fab fa-whatsapp" style="color:var(--accent-green);"></i> +91 ${cleanPhone.slice(-10)}
        ${lead.city ? `&bull; <span>${escapeHtml(lead.city)}</span>` : ''}
      </div>

      <div style="font-size:12px; color:var(--text-secondary); line-height:1.3; margin-bottom:8px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
        ${escapeHtml(lead.requirement_summary || lead.message || 'Requirements pending')}
      </div>

      <div class="kanban-quick-actions" onclick="event.stopPropagation()">
        ${nextStageBtn}
        ${currentStage !== 'WON' ? `<button class="kanban-btn-advance" onclick="moveKanbanLeadStage('${lead.id}', 'WON')">Won</button>` : ''}
        ${currentStage !== 'LOST' ? `<button class="kanban-btn-advance" onclick="moveKanbanLeadStage('${lead.id}', 'LOST')">Lost</button>` : ''}
        <button class="kanban-btn-advance" onclick="openWhatsAppChat('${cleanPhone}')"><i class="fab fa-whatsapp" style="color:var(--accent-green);"></i> Chat</button>
      </div>
    </div>
  `;
}

function handleKanbanDragStart(event, leadId) {
  draggedLeadId = leadId;
  event.dataTransfer.setData('text/plain', leadId);
}

function allowKanbanDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.add('drag-over');
}

function handleKanbanDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}

async function handleKanbanDrop(event, targetStage) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');

  const leadId = event.dataTransfer.getData('text/plain') || draggedLeadId;
  if (!leadId) return;

  await moveKanbanLeadStage(leadId, targetStage);
}

async function moveKanbanLeadStage(leadId, targetStage) {
  try {
    const res = await fetch(`/api/admin/crm/leads/${leadId}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: targetStage,
        performedBy: 'Gopichand (Master Admin)'
      })
    });
    const data = await res.json();
    if (data.success) {
      loadKanbanBoard();
      playChime('ping');
    }
  } catch (err) {
    console.error('Failed to move lead stage:', err);
  }
}


// ==============================================================================
// B2B SAAS PILLAR 5: E-COMMERCE CATALOG SYNCER
// ==============================================================================

let catalogItemsCache = [];
let selectedCatalogCategory = 'ALL';
let catalogSearchQuery = '';

async function loadCatalogItems() {
  const tbody = document.getElementById('catalog-table-tbody');
  const countAll = document.getElementById('cat-count-all');
  const inStockBadge = document.getElementById('cat-in-stock-val');
  const warrantyBadge = document.getElementById('cat-warranty-val');
  if (!tbody) return;

  // Render animated loading skeleton while fetching
  tbody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align:center; padding:36px; color:var(--text-secondary);">
        <i class="fas fa-spinner fa-spin" style="font-size:22px; color:var(--accent-indigo); margin-bottom:10px; display:block;"></i>
        Fetching live inventory from database...
      </td>
    </tr>
  `;

  try {
    const res = await fetch('/api/admin/catalog/items');
    const data = await res.json();

    if (data.success) {
      catalogItemsCache = data.items || [];
      if (countAll) countAll.textContent = catalogItemsCache.length;

      // Compute inventory counts
      const inStockCount = catalogItemsCache.filter(item => item.stock_status !== 'OUT_OF_STOCK').length;
      const warrantyCount = catalogItemsCache.filter(item => Number(item.warranty_years || 0) > 0).length;
      if (inStockBadge) inStockBadge.textContent = inStockCount;
      if (warrantyBadge) warrantyBadge.textContent = warrantyCount;

      renderCatalogTable();
    } else {
      throw new Error(data.error || 'Server returned unsuccessful response');
    }
  } catch (err) {
    console.error('Failed to load catalog items:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:36px; color:var(--text-secondary);">
          <i class="fas fa-exclamation-triangle" style="font-size:24px; color:#ef4444; margin-bottom:10px; display:block;"></i>
          Unable to connect to Catalog API (${escapeHtml(err.message)}).
          <div style="margin-top:12px;">
            <button class="btn btn-outline btn-sm" onclick="loadCatalogItems()">
              <i class="fas fa-sync-alt"></i> Retry Connection
            </button>
          </div>
        </td>
      </tr>
    `;
  }
}

function filterCatalogCategory(category) {
  selectedCatalogCategory = category;
  document.querySelectorAll('#tab-catalog-syncer .brand-pill').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(category) || (category === 'ALL' && btn.textContent.includes('All')));
  });
  renderCatalogTable();
}

function filterCatalogSearch(query) {
  catalogSearchQuery = (query || '').toLowerCase().trim();
  renderCatalogTable();
}

function renderCatalogTable() {
  const tbody = document.getElementById('catalog-table-tbody');
  if (!tbody) return;

  const filtered = catalogItemsCache.filter(item => {
    const matchesCategory = selectedCatalogCategory === 'ALL' || (item.category || '').toUpperCase().includes(selectedCatalogCategory);
    if (!matchesCategory) return false;

    if (!catalogSearchQuery) return true;
    const nameMatch = (item.product_name || '').toLowerCase().includes(catalogSearchQuery);
    const skuMatch = (item.sku || item.id || '').toLowerCase().includes(catalogSearchQuery);
    const catMatch = (item.category || '').toLowerCase().includes(catalogSearchQuery);
    const brandMatch = (item.brand || '').toLowerCase().includes(catalogSearchQuery);
    const specMatch = (item.specification || '').toLowerCase().includes(catalogSearchQuery);
    return nameMatch || skuMatch || catMatch || brandMatch || specMatch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:36px; color:var(--text-muted);">
          <i class="fas fa-box-open" style="font-size:24px; color:var(--text-muted); margin-bottom:8px; display:block;"></i>
          No products found matching the selected filter or search term.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    let stockClass = 'in';
    let stockText = 'In Stock';
    if (item.stock_status === 'LOW_STOCK') { stockClass = 'low'; stockText = 'Low Stock'; }
    else if (item.stock_status === 'OUT_OF_STOCK') { stockClass = 'out'; stockText = 'Out of Stock'; }

    return `
      <tr>
        <td>
          <div style="font-weight:700; color:#fff;">${escapeHtml(item.product_name)}</div>
          <div style="font-family:monospace; font-size:11px; color:#38bdf8;">SKU: ${escapeHtml(item.sku || item.id)}</div>
        </td>
        <td>
          <span class="badge badge-indigo">${escapeHtml(item.category)}</span>
          <span style="font-size:11px; color:var(--text-muted); display:block; margin-top:2px;">${escapeHtml(item.brand || 'GCM')}</span>
        </td>
        <td style="font-weight:700; color:#10b981; font-size:13px;">₹${Number(item.price || 0).toLocaleString('en-IN')}/${escapeHtml(item.unit || 'SFT')}</td>
        <td><span class="badge badge-amber">+${item.gst_pct || 18}%</span></td>
        <td><span class="stock-pill ${stockClass}">${stockText}</span></td>
        <td>${item.warranty_years || 5} Years</td>
        <td>
          <button class="btn btn-green btn-xs" onclick="openSendCatalogModal('${item.id}')" title="Send WhatsApp Message with Dynamic 0% Fee UPI QR">
            <i class="fab fa-whatsapp"></i> Send to Chat
          </button>
        </td>
        <td>
          <button class="btn btn-outline btn-xs" onclick="editCatalogProduct('${item.id}')"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-xs" onclick="deleteCatalogProduct('${item.id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddCatalogModal(item = null) {
  document.getElementById('prod-edit-id').value = item ? item.id : '';
  document.getElementById('prod-name').value = item ? item.product_name : '';
  document.getElementById('prod-brand').value = item ? item.brand : 'RUSSEA';
  document.getElementById('prod-category').value = item ? item.category : 'SAFETY_NETS';
  document.getElementById('prod-price').value = item ? item.price : 28;
  document.getElementById('prod-unit').value = item ? item.unit : 'SFT';
  document.getElementById('prod-gst').value = item ? item.gst_pct : 18;
  document.getElementById('prod-stock').value = item ? item.stock_status : 'IN_STOCK';
  document.getElementById('prod-warranty').value = item ? item.warranty_years : 5;
  document.getElementById('prod-spec').value = item ? item.specification : '';

  document.getElementById('modal-catalog-title').innerHTML = item ?
    '<i class="fas fa-edit" style="color:var(--accent-indigo);"></i> Edit Catalog Product' :
    '<i class="fas fa-box-open" style="color:var(--accent-indigo);"></i> Add Product to Catalog';

  openModal('modal-catalog-item');
}

function editCatalogProduct(id) {
  const item = catalogItemsCache.find(x => x.id === id);
  if (item) openAddCatalogModal(item);
}

async function saveCatalogProduct() {
  const id = document.getElementById('prod-edit-id').value;
  const productName = document.getElementById('prod-name').value.trim();
  const brand = document.getElementById('prod-brand').value.trim();
  const category = document.getElementById('prod-category').value;
  const price = parseFloat(document.getElementById('prod-price').value) || 0;
  const unit = document.getElementById('prod-unit').value.trim();
  const gstPct = parseFloat(document.getElementById('prod-gst').value) || 18;
  const stockStatus = document.getElementById('prod-stock').value;
  const warrantyYears = parseInt(document.getElementById('prod-warranty').value) || 5;
  const specification = document.getElementById('prod-spec').value.trim();

  if (!productName) {
    alert('Please enter a product name');
    return;
  }

  try {
    const res = await fetch('/api/admin/catalog/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: id || undefined,
        productName,
        brand,
        category,
        price,
        unit,
        gstPct,
        stockStatus,
        warrantyYears,
        specification
      })
    });
    const data = await res.json();
    if (data.success) {
      closeModal('modal-catalog-item');
      loadCatalogItems();
      showToastNotification('Product saved to catalog.');
    }
  } catch (err) {
    console.error('Failed to save product:', err);
  }
}

async function deleteCatalogProduct(id) {
  if (!confirm('Are you sure you want to remove this product from the inventory catalog?')) return;

  try {
    const res = await fetch(`/api/admin/catalog/items/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadCatalogItems();
    }
  } catch (err) {
    console.error('Failed to delete product:', err);
  }
}

function openSendCatalogModal(productId = null) {
  const phoneInput = document.getElementById('dispatch-prod-phone');
  const selectEl = document.getElementById('dispatch-prod-select');

  if (phoneInput) {
    phoneInput.value = activeChatPhone ? `+91 ${activeChatPhone.replace(/\D/g, '').slice(-10)}` : '';
  }

  if (selectEl && catalogItemsCache.length > 0) {
    selectEl.innerHTML = catalogItemsCache.map(p => `
      <option value="${p.id}" ${p.id === productId ? 'selected' : ''}>
        ${escapeHtml(p.product_name)} — ₹${p.price}/${p.unit} (+${p.gst_pct}% GST)
      </option>
    `).join('');
  }

  updateDispatchTotal();
  openModal('modal-send-catalog');
}

function updateDispatchTotal() {
  const selectEl = document.getElementById('dispatch-prod-select');
  const qtyEl = document.getElementById('dispatch-prod-qty');
  const totalEl = document.getElementById('dispatch-calc-total');

  if (!selectEl || !qtyEl || !totalEl) return;

  const prodId = selectEl.value;
  const qty = parseFloat(qtyEl.value) || 1;
  const prod = catalogItemsCache.find(x => x.id === prodId);

  if (prod) {
    const subtotal = (prod.price || 0) * qty;
    const gst = subtotal * ((prod.gst_pct || 18) / 100);
    const grand = Math.round(subtotal + gst);
    totalEl.textContent = `₹${grand.toLocaleString('en-IN')}`;
  }
}

async function dispatchCatalogProductToActiveChat() {
  const phoneInput = document.getElementById('dispatch-prod-phone');
  const selectEl = document.getElementById('dispatch-prod-select');
  const qtyEl = document.getElementById('dispatch-prod-qty');

  const phone = phoneInput ? phoneInput.value.trim() : '';
  const productId = selectEl ? selectEl.value : '';
  const quantity = qtyEl ? parseFloat(qtyEl.value) || 1 : 1;

  if (!phone || !productId) {
    alert('Please enter a target phone number and select a product.');
    return;
  }

  try {
    const res = await fetch('/api/admin/catalog/send-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, productId, quantity })
    });
    const data = await res.json();

    if (data.success) {
      closeModal('modal-send-catalog');
      playChime('sent');
      showToastNotification('Product card and 0% fee UPI QR dispatched to WhatsApp!');
      if (activeChatPhone && activeChatPhone.includes(phone.replace(/\D/g, '').slice(-10))) {
        loadActiveChatMessages(activeChatPhone, true);
      }
    } else {
      alert('Failed to send product: ' + (data.error || 'Check WhatsApp API connection'));
    }
  } catch (err) {
    console.error('Failed to dispatch product:', err);
  }
}


// ==============================================================================
// TOAST NOTIFICATIONS & GLOBAL BINDINGS
// ==============================================================================

function showToastNotification(msg) {
  let toast = document.getElementById('live-toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'live-toast-notification';
    toast.style.cssText = 'position:fixed; bottom:24px; right:24px; background:#0f172a; border:1px solid #10b981; color:#fff; padding:12px 18px; border-radius:8px; font-size:12.5px; z-index:9999; box-shadow:0 10px 25px rgba(0,0,0,0.5); display:flex; align-items:center; gap:8px; transition:all 0.3s;';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fas fa-check-circle" style="color:#10b981;"></i> ${msg}`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
  }, 3500);
}

// Attach all B2B SaaS methods to window for inline HTML onclick/onchange/ondrag
window.loadMetaConnections = loadMetaConnections;
window.copyMetaText = copyMetaText;
window.sendMetaTestPing = sendMetaTestPing;
window.loadMetaTelemetry = loadMetaTelemetry;

window.filterThreadsByAgent = filterThreadsByAgent;
window.changeActiveAssignedAgent = changeActiveAssignedAgent;
window.toggleInternalNotesDrawer = toggleInternalNotesDrawer;
window.loadInternalNotes = loadInternalNotes;
window.submitInternalTeamNote = submitInternalTeamNote;

window.loadKnowledgeDocuments = loadKnowledgeDocuments;
window.uploadKnowledgeDocument = uploadKnowledgeDocument;
window.deleteKnowledgeDocument = deleteKnowledgeDocument;
window.loadSystemConfig = loadSystemConfig;
window.saveSystemConfig = saveSystemConfig;
window.testRAGQuery = testRAGQuery;

window.loadKanbanBoard = loadKanbanBoard;
window.handleKanbanDragStart = handleKanbanDragStart;
window.allowKanbanDrop = allowKanbanDrop;
window.handleKanbanDragLeave = handleKanbanDragLeave;
window.handleKanbanDrop = handleKanbanDrop;
window.moveKanbanLeadStage = moveKanbanLeadStage;

window.loadCatalogItems = loadCatalogItems;
window.filterCatalogCategory = filterCatalogCategory;
window.openAddCatalogModal = openAddCatalogModal;
window.editCatalogProduct = editCatalogProduct;
window.saveCatalogProduct = saveCatalogProduct;
window.deleteCatalogProduct = deleteCatalogProduct;
window.openSendCatalogModal = openSendCatalogModal;
window.updateDispatchTotal = updateDispatchTotal;
window.dispatchCatalogProductToActiveChat = dispatchCatalogProductToActiveChat;

window.openWhatsAppChat = openWhatsAppChatFor;
window.renderKanbanBoard = loadKanbanBoard;

window.toggleCustomerPanel = toggleCustomerPanel;
window.toggleMobileSidebar = toggleMobileSidebar;
window.closeMobileSidebar = closeMobileSidebar;
window.closeMobileChat = closeMobileChat;
window.toggleTokenMask = toggleTokenMask;
window.submitCustomerPanelNote = submitCustomerPanelNote;
window.filterCatalogSearch = filterCatalogSearch;
window.scrollToBottomSmooth = scrollToBottomSmooth;
