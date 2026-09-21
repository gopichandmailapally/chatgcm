let currentTab = 'dashboard';
let sandboxSessionId = 'SANDBOX-' + Math.random().toString(36).substring(2, 9).toUpperCase();

// Tab Switching
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.getAttribute('data-tab');
    switchTab(tab);
  });
});

function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tabId));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tabId}`));

  const titles = {
    dashboard: ['Executive Command Center', 'Real-time sales intelligence across all GCM websites'],
    leads: ['Hot Leads CRM', 'Full pipeline of qualified inquiries, measurements & quotes'],
    quotations: ['Estimations & GCM ERP', 'Sequential quotations with 1-click tax invoice and billing conversion'],
    approvals: ['Owner Decision Queue', 'Review custom discount and special condition requests'],
    sandbox: ['AI Sales Brain Simulator', 'Test multi-tenant intent detection and mathematical calculations'],
    products: ['Master Products & Pricing', 'Single source of truth for rates, units, and inventory'],
    integration: ['Embeddable Widget Integration', 'Deploy Chat GCM to your existing websites with 1 script'],
    whatsapp: ['WhatsApp Bot & Automation', 'Meta Cloud API webhook status, follow-up automation & live test messenger']
  };

  if (titles[tabId]) {
    document.getElementById('tab-heading').textContent = titles[tabId][0];
    document.getElementById('tab-subheading').textContent = titles[tabId][1];
  }

  // Load data for specific tab
  if (tabId === 'dashboard') loadDashboardStats();
  if (tabId === 'leads') loadLeads();
  if (tabId === 'quotations') loadQuotations();
  if (tabId === 'approvals') loadApprovals();
  if (tabId === 'products') loadProducts();
  if (tabId === 'whatsapp') loadWhatsAppStatus();
}

// 1. Dashboard Stats
async function loadDashboardStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    if (!data.success) return;

    const s = data.stats;
    document.getElementById('stat-leads').textContent = s.totalLeads;
    document.getElementById('stat-conversations').textContent = s.activeConversations;
    document.getElementById('stat-quotes').textContent = s.quotationsSent;
    document.getElementById('stat-pipeline').textContent = '₹' + Math.round(s.pipelineValue).toLocaleString('en-IN');

    // Pending approvals banner
    const approvalAlert = document.getElementById('approval-alert');
    const badge = document.getElementById('approval-badge');
    if (s.pendingApprovals > 0) {
      approvalAlert.style.display = 'flex';
      document.getElementById('approval-count-alert').textContent = s.pendingApprovals;
      badge.style.display = 'inline-block';
      badge.textContent = s.pendingApprovals;
    } else {
      approvalAlert.style.display = 'none';
      badge.style.display = 'none';
    }

    // Recent leads table
    const tbody = document.getElementById('recent-leads-tbody');
    if (s.recentLeads && s.recentLeads.length > 0) {
      tbody.innerHTML = s.recentLeads.map(lead => `
        <tr>
          <td>
            <strong>${escapeHtml(lead.customer_name)}</strong><br>
            <small style="color:#94a3b8;">${lead.phone}</small>
          </td>
          <td><span class="badge badge-primary">${escapeHtml(lead.brand_name || lead.website_id)}</span></td>
          <td><span class="badge ${getStageBadge(lead.stage)}">${lead.stage}</span></td>
          <td><strong>₹${(lead.estimated_value || 0).toLocaleString('en-IN')}</strong></td>
          <td style="color:#94a3b8;">${new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:20px;">No leads recorded yet. Try the AI Sandbox or Demo page!</td></tr>`;
    }
  } catch (err) {
    console.error('Failed to load dashboard stats:', err);
  }
}

// 2. Leads CRM
async function loadLeads() { return loadPillarLeads(); }
async function old_loadLeads() {
  try {
    const stage = document.getElementById('lead-stage-filter').value;
    const url = stage ? `/api/crm/leads?stage=${encodeURIComponent(stage)}` : '/api/crm/leads';
    const res = await fetch(url);
    const data = await res.json();
    const tbody = document.getElementById('all-leads-tbody');

    if (data.leads && data.leads.length > 0) {
      tbody.innerHTML = data.leads.map(l => `
        <tr>
          <td><code>${l.id}</code></td>
          <td><strong>${escapeHtml(l.customer_name)}</strong></td>
          <td><a href="tel:${l.phone}" style="color:#60a5fa;text-decoration:none;">${l.phone}</a></td>
          <td>${escapeHtml(l.city || 'Hyderabad')}</td>
          <td><small>${escapeHtml(l.requirement_summary || 'General Inquiry')}</small></td>
          <td><span class="badge ${getStageBadge(l.stage)}">${l.stage}</span></td>
          <td><strong>₹${(l.estimated_value || 0).toLocaleString('en-IN')}</strong></td>
          <td>
            <select onchange="updateStage('${l.id}', this.value)" style="background:#0f172a;color:white;border:1px solid #334155;border-radius:6px;padding:4px 8px;font-size:12px;">
              <option value="NEW" ${l.stage === 'NEW' ? 'selected' : ''}>NEW</option>
              <option value="QUALIFIED" ${l.stage === 'QUALIFIED' ? 'selected' : ''}>QUALIFIED</option>
              <option value="QUOTATION_SENT" ${l.stage === 'QUOTATION_SENT' ? 'selected' : ''}>QUOTATION_SENT</option>
              <option value="NEGOTIATION" ${l.stage === 'NEGOTIATION' ? 'selected' : ''}>NEGOTIATION</option>
              <option value="APPROVED" ${l.stage === 'APPROVED' ? 'selected' : ''}>APPROVED</option>
              <option value="ORDER_CONFIRMED" ${l.stage === 'ORDER_CONFIRMED' ? 'selected' : ''}>ORDER_CONFIRMED</option>
            </select>
          </td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:30px;">No leads matching filter.</td></tr>`;
    }
  } catch (err) {
    console.error('Failed to load leads:', err);
  }
}

async function updateStage(leadId, newStage) {
  await fetch(`/api/crm/leads/${leadId}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage: newStage })
  });
  loadLeads();
  loadDashboardStats();
}

// 3. Approvals Queue
async function loadApprovals() {
  try {
    const res = await fetch('/api/crm/approvals');
    const data = await res.json();
    const container = document.getElementById('approvals-container');

    if (data.approvals && data.approvals.length > 0) {
      container.innerHTML = data.approvals.map(a => `
        <div class="alert-banner" style="margin-bottom:16px;background:rgba(30,41,59,0.9);border:1px solid #475569;">
          <div class="alert-icon" style="color:#f59e0b;"><i class="fas fa-hand-holding-usd"></i></div>
          <div class="alert-text">
            <strong>${escapeHtml(a.customer_name)} (${a.phone}, ${a.city})</strong> - Quote #${a.quote_number || 'N/A'}<br>
            <span style="color:#f87171;font-size:13px;"><i class="fas fa-bell"></i> ${escapeHtml(a.reason)}</span><br>
            <small style="color:#94a3b8;">Total Quote Value: ₹${(a.grand_total || 0).toLocaleString('en-IN')}</small>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-sm btn-primary" onclick="decideApproval('${a.id}', 'APPROVED')">
              <i class="fas fa-check"></i> Approve Discount
            </button>
            <button class="btn btn-sm btn-outline" style="border-color:#ef4444;color:#ef4444;" onclick="decideApproval('${a.id}', 'REJECTED')">
              <i class="fas fa-times"></i> Reject
            </button>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = `<p class="text-center" style="padding:40px;color:#94a3b8;">✅ No pending approvals. All active quotes are within autonomous AI limits.</p>`;
    }
  } catch (err) {
    console.error('Failed to load approvals:', err);
  }
}

async function decideApproval(id, decision) {
  await fetch(`/api/crm/approvals/${id}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision })
  });
  loadApprovals();
  loadDashboardStats();
}

// 4. Products & Pricing
async function loadProducts() {
  try {
    const res = await fetch('/api/calc/products');
    const data = await res.json();
    const tbody = document.getElementById('products-tbody');

    if (data.products) {
      tbody.innerHTML = data.products.map(p => `
        <tr>
          <td><code>${p.id}</code></td>
          <td><span class="badge badge-purple">${p.brand}</span></td>
          <td>${p.category}</td>
          <td><strong>${p.product_name}</strong></td>
          <td>${p.material} (${p.thickness}, ${p.mesh_size})</td>
          <td>${p.unit}</td>
          <td><span class="badge badge-success">${p.warranty_years} Yrs</span></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load products:', err);
  }
}

// 5. Sandbox Chat
function setSandboxText(text) {
  document.getElementById('sandbox-input').value = text;
  document.getElementById('sandbox-chat-form').dispatchEvent(new Event('submit'));
}

function clearSandboxChat() {
  sandboxSessionId = 'SANDBOX-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  document.getElementById('sandbox-chat-history').innerHTML = `
    <div class="chat-bubble assistant">
      Chat cleared. New session started (${sandboxSessionId}). What dimensions or product can I help you quote?
    </div>
  `;
}

async function sendSandboxMessage(e) {
  e.preventDefault();
  const input = document.getElementById('sandbox-input');
  const msg = input.value.trim();
  if (!msg) return;

  const websiteId = document.getElementById('sandbox-website').value;
  const customerName = document.getElementById('sandbox-name').value;
  const phone = document.getElementById('sandbox-phone').value;

  const history = document.getElementById('sandbox-chat-history');

  // Append user message
  const userDiv = document.createElement('div');
  userDiv.className = 'chat-bubble user';
  userDiv.textContent = msg;
  history.appendChild(userDiv);
  input.value = '';

  // Typing
  const typing = document.createElement('div');
  typing.className = 'chat-bubble assistant';
  typing.textContent = 'Orchestrator calculating approved rates...';
  history.appendChild(typing);
  history.scrollTop = history.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        websiteId,
        sessionId: sandboxSessionId,
        customerName,
        phone,
        message: msg
      })
    });

    const data = await res.json();
    typing.remove();

    if (data.success) {
      const astDiv = document.createElement('div');
      astDiv.className = 'chat-bubble assistant';
      astDiv.innerHTML = data.reply.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
      history.appendChild(astDiv);
      loadDashboardStats(); // refresh counts
    }
  } catch (err) {
    typing.textContent = 'Error connecting to Chat GCM orchestrator.';
  }
  history.scrollTop = history.scrollHeight;
}

// 2B. Quotations & GCM ERP
async function loadQuotations() {
  const tbody = document.getElementById('all-quotations-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="9" class="text-center">Loading synchronized ERP quotations...</td></tr>';
  try {
    const res = await fetch('/api/crm/quotations');
    const data = await res.json();
    if (!data.success || !data.quotations || data.quotations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center">No quotations generated yet. Test in AI Sandbox to generate one!</td></tr>';
      return;
    }

    tbody.innerHTML = data.quotations.map(q => {
      const docBadge = q.doc_id 
        ? `<span class="badge" style="background:#0284c7;color:#fff;font-weight:700;">${escapeHtml(q.doc_id)}</span>`
        : `<span class="badge" style="background:#64748b;color:#fff;">Internal Draft</span>`;
      
      const docLink = q.view_url 
        ? `<a href="${q.view_url}" target="_blank" class="btn btn-sm btn-outline" style="padding:4px 8px;font-size:0.75rem;white-space:nowrap;" title="View Official Stamped Estimation">
             <i class="fas fa-eye me-1"></i> View ERP Doc
           </a>`
        : '';
        
      const convertInvBtn = q.doc_id
        ? `<a href="https://gcm.enterprises/admin/ajax.php?action=convert&id=${encodeURIComponent(q.doc_id)}&to=tax_invoice" target="_blank" class="btn btn-sm btn-primary" style="padding:4px 8px;font-size:0.75rem;background:#16a34a;border-color:#16a34a;white-space:nowrap;" title="Convert to Official Tax Invoice (INV)">
             <i class="fas fa-file-invoice me-1"></i> &rarr; Invoice
           </a>`
        : '';

      const convertBillBtn = q.doc_id
        ? `<a href="https://gcm.enterprises/admin/ajax.php?action=convert&id=${encodeURIComponent(q.doc_id)}&to=bill" target="_blank" class="btn btn-sm btn-outline" style="padding:4px 8px;font-size:0.75rem;white-space:nowrap;" title="Convert to Bill (BILL)">
             <i class="fas fa-receipt me-1"></i> &rarr; Bill
           </a>`
        : '';

      return `
        <tr>
          <td><strong style="color:var(--primary);">${escapeHtml(q.quote_number)}</strong></td>
          <td>${docBadge} <small style="display:block;color:#64748b;font-size:0.75rem;">${escapeHtml(q.company_name || 'GCM Enterprises')}</small></td>
          <td><strong>${escapeHtml(q.customer_name || 'Prospect')}</strong></td>
          <td>${escapeHtml(q.phone || 'N/A')}<br><small style="color:#64748b;">${escapeHtml(q.city || 'Hyderabad')}</small></td>
          <td>${escapeHtml(q.project_name || 'General Netting')}</td>
          <td>₹${Math.round(q.subtotal).toLocaleString('en-IN')}</td>
          <td><strong>₹${Math.round(q.grand_total).toLocaleString('en-IN')}</strong></td>
          <td><span class="badge ${q.status === 'SENT' ? 'badge-sent' : 'badge-new'}">${q.status}</span></td>
          <td>
            <div style="display:flex;flex-wrap:nowrap;gap:4px;">
              ${docLink}
              ${convertInvBtn}
              ${convertBillBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="color:#ef4444;">Failed to load quotations: ${err.message}</td></tr>`;
  }
}

// Helpers
function getStageBadge(stage) {
  switch (stage) {
    case 'NEW': return 'badge-primary';
    case 'QUALIFIED': return 'badge-purple';
    case 'QUOTATION_SENT': return 'badge-warning';
    case 'APPROVED': case 'ORDER_CONFIRMED': return 'badge-success';
    default: return 'badge-primary';
  }
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

// 8. WhatsApp Automation
async function loadWhatsAppStatus() {
  try {
    const res = await fetch('/api/whatsapp/status');
    const data = await res.json();
    const badge = document.getElementById('wa-status-badge');
    if (!badge) return;

    if (data.configured) {
      badge.textContent = 'Active & Connected';
      badge.style.background = '#dcfce7';
      badge.style.color = '#166534';
    } else {
      badge.textContent = 'Webhook Verified (Awaiting Access Token)';
      badge.style.background = '#fef3c7';
      badge.style.color = '#b45309';
    }
  } catch (err) {
    console.error('Failed to load WhatsApp status:', err);
  }
}

async function sendTestWhatsApp() {
  const phone = document.getElementById('wa-test-phone').value.trim();
  const message = document.getElementById('wa-test-message').value.trim();
  const resultDiv = document.getElementById('wa-test-result');
  const sendBtn = document.getElementById('wa-send-btn');

  if (!phone || !message) return;

  sendBtn.disabled = true;
  sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending WhatsApp message...';
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<span style="color:#64748b;">Connecting to Meta WhatsApp API...</span>';

  try {
    const res = await fetch('/api/whatsapp/send-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message })
    });
    const data = await res.json();

    if (data.success) {
      resultDiv.innerHTML = `<span style="color:#16a34a; font-weight:700;">✅ Message Sent Successfully! Meta Message ID: ${data.data?.messages?.[0]?.id || 'OK'}</span>`;
    } else if (data.reason === 'WHATSAPP_NOT_CONFIGURED') {
      resultDiv.innerHTML = `<span style="color:#b45309; font-weight:600;">⚠️ Notice: WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is not configured in .env yet. Follow the 4-step setup instructions on the left to activate instant sending!</span>`;
    } else {
      resultDiv.innerHTML = `<span style="color:#dc2626; font-weight:600;">❌ Meta Error: ${JSON.stringify(data.error?.error?.message || data.error || 'Failed')}</span>`;
    }
  } catch (err) {
    resultDiv.innerHTML = `<span style="color:#dc2626;">❌ Network error: ${err.message}</span>`;
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Send WhatsApp Test';
  }
}

// Initialize on page load
loadDashboardStats();




// =========================================================================
// GCM 3-PILLAR ENTERPRISE CRM ENGINE
// =========================================================================

let currentPillar = 'all';
let currentLeadsData = [];
let searchDebounceTimer = null;

const STAGE_CONFIG = {
  turnkey: [
    { value: 'INQUIRY', label: '1. New Inquiry' },
    { value: 'BOQ_SHARED', label: '2. 3D BOQ Shared' },
    { value: 'SITE_FEASIBILITY', label: '3. Site Feasibility Inspection' },
    { value: 'CONTRACT_NEGOTIATION', label: '4. Contract & Owner Review' },
    { value: 'ADVANCE_PAID', label: '5. Mobilization Advance Paid' },
    { value: 'IN_CONSTRUCTION', label: '6. Civil / Steel / Turf in Progress' },
    { value: 'HANDOVER_COMPLETED', label: '7. Handover & Settled' },
    { value: 'LOST', label: 'Dropped / Lost' }
  ],
  doorstep_service: [
    { value: 'NEW_INQUIRY', label: '1. New Balcony/Pigeon Inquiry' },
    { value: 'VAN_SCHEDULED', label: '2. Doorstep Van Scheduled' },
    { value: 'MEASURED_QUOTED', label: '3. On-Site Measured & Quoted' },
    { value: 'INSTALLING', label: '4. Installation in Progress' },
    { value: 'COMPLETED_COLLECTED', label: '5. Completed & Payment Collected' },
    { value: 'WARRANTY_ISSUED', label: '6. 5-Yr Warranty Certificate Sent' },
    { value: 'CANCELLED', label: 'Cancelled' }
  ],
  supply_only: [
    { value: 'NET_INQUIRY', label: '1. Bag / Panel Cut Inquiry' },
    { value: 'PI_SENT', label: '2. Proforma Invoice & Freight Shared' },
    { value: 'PAYMENT_RECEIVED', label: '3. 100% Advance Received' },
    { value: 'PACKED_IN_BAGS', label: '4. Packed in Woven Bags' },
    { value: 'DISPATCHED_BILTY', label: '5. Dispatched (LR Bilty Generated)' },
    { value: 'DELIVERED', label: '6. Delivered to Buyer' },
    { value: 'CANCELLED', label: 'Cancelled' }
  ],
  all: [
    { value: 'NEW', label: 'New Lead' },
    { value: 'QUALIFIED', label: 'Qualified' },
    { value: 'QUOTATION_SENT', label: 'Quotation Sent' },
    { value: 'VAN_SCHEDULED', label: 'Van Scheduled' },
    { value: 'ADVANCE_PAID', label: 'Advance Paid' },
    { value: 'DISPATCHED_BILTY', label: 'Dispatched Bilty' },
    { value: 'ORDER_CONFIRMED', label: 'Order Confirmed' }
  ]
};

function selectPillar(pillar) {
  currentPillar = pillar;

  // Update pills UI
  document.querySelectorAll('.pillar-pill').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`pill-btn-${pillar}`) || document.getElementById('pill-btn-all');
  if (activeBtn) activeBtn.classList.add('active');

  // Update stage filter dropdown options
  updateStageFilterOptions();

  // Load leads
  loadPillarLeads();
}

function updateStageFilterOptions() {
  const stageFilter = document.getElementById('crm-stage-filter');
  if (!stageFilter) return;

  const stages = STAGE_CONFIG[currentPillar] || STAGE_CONFIG.all;
  let html = '<option value="all">All Stages</option>';
  stages.forEach(st => {
    html += `<option value="${st.value}">${st.label}</option>`;
  });
  stageFilter.innerHTML = html;
}

function debounceSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadPillarLeads();
  }, 350);
}

async function loadPillarLeads() {
  const tbody = document.getElementById('all-leads-tbody');
  if (!tbody) return;

  try {
    const search = document.getElementById('crm-search-input')?.value || '';
    const stage = document.getElementById('crm-stage-filter')?.value || 'all';
    const brand = document.getElementById('crm-brand-filter')?.value || 'all';
    const city = document.getElementById('crm-city-filter')?.value || 'all';

    let url = `/api/crm/leads?pillar=${encodeURIComponent(currentPillar)}`;
    if (stage !== 'all') url += `&stage=${encodeURIComponent(stage)}`;
    if (brand !== 'all') url += `&websiteId=${encodeURIComponent(brand)}`;
    if (city !== 'all') url += `&city=${encodeURIComponent(city)}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

    const res = await fetch(url);
    const data = await res.json();
    currentLeadsData = data.leads || [];

    // Also fetch real-time analytics & no-whatsapp alerts
    loadCrmAnalytics();
    checkNoWhatsAppAlerts();

    renderCrmTable(currentLeadsData);
  } catch (err) {
    console.error('Error loading CRM leads:', err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:#ef4444; padding:30px;">Failed to load leads: ${err.message}</td></tr>`;
  }
}

async function loadCrmAnalytics() {
  try {
    const res = await fetch('/api/crm/analytics');
    const data = await res.json();
    if (!data.success) return;

    const a = data.analytics;

    // Update counts on pillar pills
    let totalAll = a.overall?.total_leads || 0;
    let turnkeyCount = 0, doorstepCount = 0, supplyCount = 0;

    (a.pillarStats || []).forEach(p => {
      if (p.pillar === 'turnkey') turnkeyCount = p.count;
      else if (p.pillar === 'doorstep_service') doorstepCount = p.count;
      else if (p.pillar === 'supply_only') supplyCount = p.count;
    });

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('count-all', totalAll);
    setTxt('count-turnkey', turnkeyCount);
    setTxt('count-doorstep', doorstepCount);
    setTxt('count-supply', supplyCount);
    setTxt('count-owner', a.takeoverAlertsCount || 0);

    // Active metrics strip based on pillar
    let pVal = a.overall?.total_pipeline_value || 0;
    let advVal = a.overall?.total_advance_collected || 0;
    let balVal = a.overall?.total_balance_due || 0;

    if (currentPillar !== 'all' && currentPillar !== 'owner_desk') {
      const matchPillar = (a.pillarStats || []).find(p => p.pillar === currentPillar);
      if (matchPillar) {
        pVal = matchPillar.total_pipeline_value;
        advVal = matchPillar.total_advance_collected;
        balVal = matchPillar.total_balance_due;
      }
    }

    setTxt('crm-stat-pipeline', '₹' + Math.round(pVal).toLocaleString('en-IN'));
    setTxt('crm-stat-advance', '₹' + Math.round(advVal).toLocaleString('en-IN'));
    setTxt('crm-stat-balance', '₹' + Math.round(balVal).toLocaleString('en-IN'));
    setTxt('crm-stat-visits', a.visitsTodayCount || 0);

  } catch (err) {
    console.error('Failed to load CRM analytics:', err);
  }
}

function renderCrmTable(leads) {
  const tbody = document.getElementById('all-leads-tbody');
  if (!tbody) return;

  if (!leads || leads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:40px; color:#94a3b8;">
      <i class="fas fa-inbox" style="font-size:24px; margin-bottom:8px; display:block;"></i>
      No leads found for this pillar filter. Click <strong>+ New Inquiry</strong> to add one!
    </td></tr>`;
    return;
  }

  tbody.innerHTML = leads.map(l => {
    const isDoorstep = l.pillar === 'doorstep_service';
    const isTurnkey = l.pillar === 'turnkey';
    const isSupply = l.pillar === 'supply_only';

    // 1. Pillar Badge
    const pillarBadge = isTurnkey 
      ? '<span class="badge" style="background:rgba(99,102,241,0.2);color:#818cf8;border:1px solid rgba(99,102,241,0.4);">Turnkey Sports</span>'
      : isSupply 
      ? '<span class="badge" style="background:rgba(16,185,129,0.2);color:#34d399;border:1px solid rgba(16,185,129,0.4);">Supply Only</span>'
      : '<span class="badge" style="background:rgba(59,130,246,0.2);color:#60a5fa;border:1px solid rgba(59,130,246,0.4);">Doorstep Installation</span>';

    // 2. Stage selector options
    const stages = STAGE_CONFIG[l.pillar] || STAGE_CONFIG.doorstep_service;
    const stageSelectHtml = `
      <select onchange="updateLeadPipelineStage('${l.id}', this.value)" style="background:#0f172a;color:#f8fafc;border:1px solid #334155;border-radius:6px;padding:4px 8px;font-size:12px;width:100%;max-width:180px;">
        ${stages.map(st => `<option value="${st.value}" ${ (l.pipeline_stage === st.value || l.stage === st.value) ? 'selected' : '' }>${st.label}</option>`).join('')}
      </select>
    `;

    // 3. Operational Column
    let opsHtml = '';
    if (isDoorstep) {
      if (l.technician_name) {
        opsHtml = `
          <div style="font-size:12px;">
            <strong><i class="fas fa-van-shuttle" style="color:#3b82f6;"></i> ${escapeHtml(l.technician_name)}</strong><br>
            <span style="color:#94a3b8;">📅 ${l.visit_date || 'Today'} (${l.visit_slot || 'Slot N/A'})</span>
          </div>
        `;
      } else {
        opsHtml = `<button class="btn btn-xs btn-outline" onclick="openAssignVanModal('${l.id}')"><i class="fas fa-plus"></i> Assign Van</button>`;
      }
    } else if (isSupply) {
      if (l.lr_number) {
        opsHtml = `
          <div style="font-size:12px;">
            <strong><i class="fas fa-truck" style="color:#10b981;"></i> ${escapeHtml(l.dispatch_transporter || 'V-Trans')}</strong><br>
            <span style="color:#94a3b8;">LR: <code>${escapeHtml(l.lr_number)}</code></span>
          </div>
        `;
      } else {
        opsHtml = `<button class="btn btn-xs btn-outline" onclick="openDispatchModal('${l.id}')"><i class="fas fa-box"></i> Log Bilty</button>`;
      }
    } else {
      // Turnkey
      opsHtml = `<span style="font-size:12px; color:#cbd5e1;"><i class="fas fa-drafting-compass" style="color:#818cf8;"></i> Full BOQ & 3D Ground Specs</span>`;
    }

    // 4. Commercials & Payment Status
    const estVal = Number(l.estimated_value || 0);
    const advVal = Number(l.advance_amount || 0);
    const balVal = Number(l.balance_amount || (estVal - advVal));
    const payStatus = l.payment_status || (advVal > 0 ? (balVal <= 0 ? 'PAID_FULL' : 'PARTIAL_ADVANCE') : 'UNPAID');

    const payBadge = payStatus === 'PAID_FULL'
      ? '<span class="badge-paid-full">PAID IN FULL</span>'
      : payStatus === 'PARTIAL_ADVANCE'
      ? `<span class="badge-partial">ADV: ₹${advVal.toLocaleString('en-IN')}</span>`
      : '<span class="badge-unpaid">UNPAID</span>';

    const commHtml = `
      <div style="font-size:12.5px;">
        <strong>₹${estVal.toLocaleString('en-IN')}</strong><br>
        <div style="display:flex; align-items:center; gap:6px; margin-top:3px;">
          ${payBadge}
          <button class="btn-icon-sm" title="Record Payment" onclick="openPaymentModal('${l.id}', ${estVal}, ${advVal})"><i class="fas fa-wallet"></i></button>
        </div>
      </div>
    `;

    // 5. Takeover Icon State
    const takeoverIcon = l.human_takeover 
      ? `<button class="btn-icon-sm" style="background:#ef4444; color:white;" title="Human Takeover Active (Click to resume AI)" onclick="toggleTakeover('${l.id}', 0)"><i class="fas fa-user-shield"></i></button>`
      : `<button class="btn-icon-sm" title="Takeover Conversation from AI" onclick="toggleTakeover('${l.id}', 1)"><i class="fas fa-robot"></i></button>`;

    const targetWa = l.whatsapp_number || l.phone;
    const isNoWa = l.whatsapp_status === 'NO_WHATSAPP';

    return `
      <tr style="${isNoWa ? 'background:rgba(239,68,68,0.06);' : ''}">
        <td>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <strong style="font-size:13.5px;">${escapeHtml(l.customer_name)}</strong>
            <span class="badge" style="font-size:10px;padding:2px 6px;background:rgba(255,255,255,0.08);color:#94a3b8;border:1px solid rgba(255,255,255,0.12);" title="Channel: ${l.channel || 'web_form'}">
              ${l.channel === 'phone_call' ? '<i class="fas fa-phone-alt" style="color:#60a5fa;"></i> Call' : l.channel === 'whatsapp' ? '<i class="fab fa-whatsapp" style="color:#22c55e;"></i> WA' : l.channel === 'ushaleads' ? '<i class="fas fa-bolt" style="color:#a855f7;"></i> UshaLeads' : '<i class="fas fa-globe" style="color:#38bdf8;"></i> Web'}
            </span>
            ${isNoWa ? `<span class="badge" style="background:#ef4444;color:white;font-weight:700;font-size:10px;padding:2px 6px;" title="Meta: Recipient is not on WhatsApp!"><i class="fas fa-exclamation-triangle"></i> No WA</span>` : ''}
          </div>
          <div style="display:flex; align-items:center; gap:8px; margin-top:3px;">
            <a href="tel:${l.phone}" style="color:#60a5fa; font-size:12px; text-decoration:none;"><i class="fas fa-phone-alt"></i> ${l.phone}</a>
            ${isNoWa 
              ? `<button class="btn btn-xs btn-outline" style="border-color:#22c55e; color:#22c55e; padding:1px 6px; font-size:11px; font-weight:700;" onclick="openUpdateWhatsAppModal('${l.id}','${escapeHtml(l.customer_name)}','${l.phone}')"><i class="fab fa-whatsapp"></i> Add WA</button>`
              : `<a href="https://wa.me/91${targetWa}" target="_blank" style="color:#22c55e; font-size:13px;" title="Chat on WhatsApp"><i class="fab fa-whatsapp"></i></a>`
            }
          </div>
          <small style="color:#94a3b8; font-size:11.5px;">${escapeHtml(l.city || 'Hyderabad')}${l.locality ? ` • ${escapeHtml(l.locality)}` : ''}</small>
        </td>
        <td>
          ${pillarBadge}<br>
          <small style="color:#94a3b8; font-size:11px;">${escapeHtml(l.brand_name || l.website_id)}</small>
        </td>
        <td style="max-width:220px;">
          <div style="font-size:12px; line-height:1.4; color:#e2e8f0;">${escapeHtml(l.requirement_summary || 'General Inquiry')}</div>
          ${l.notes ? `<div style="font-size:11px; color:#f59e0b; margin-top:3px;">📝 ${escapeHtml(l.notes)}</div>` : ''}
        </td>
        <td>${stageSelectHtml}</td>
        <td>${opsHtml}</td>
        <td>${commHtml}</td>
        <td>
          <div class="crm-btn-group">
            ${takeoverIcon}
            <button class="btn-icon-sm" title="Dispatch Quotation & Payment Details via WhatsApp" onclick="openDispatchQuotationModal('${l.id}')"><i class="fas fa-file-invoice-dollar" style="color:#818cf8;"></i></button>
            <button class="btn-icon-sm" title="Dispatch Bilty / LR via WhatsApp" onclick="openDispatchModal('${l.id}')"><i class="fas fa-truck" style="color:#10b981;"></i></button>
            <button class="btn-icon-sm" title="View Audit Trail" onclick="openActivitiesModal('${l.id}')"><i class="fas fa-history"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ── Modals & Actions ──────────────────────────────────────────────────────────

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.style.display = 'none';
}

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.style.display = 'flex';
}

// Assign Van Modal
function openAssignVanModal(leadId) {
  const lead = currentLeadsData.find(l => l.id === leadId);
  if (!lead) return;

  document.getElementById('van-lead-id').value = lead.id;
  document.getElementById('van-customer-info').value = `${lead.customer_name} (${lead.phone}) — ${lead.city || 'Hyderabad'}`;
  document.getElementById('van-locality').value = lead.locality || '';

  // Default date to tomorrow
  const tmrw = new Date();
  tmrw.setDate(tmrw.getDate() + 1);
  document.getElementById('van-visit-date').value = tmrw.toISOString().slice(0, 10);

  openModal('modal-assign-van');
}

async function submitAssignVan() {
  const leadId = document.getElementById('van-lead-id').value;
  const select = document.getElementById('van-tech-select');
  const opt = select.options[select.selectedIndex];
  const techId = opt.value;
  const techName = opt.getAttribute('data-name');
  const techPhone = opt.getAttribute('data-phone');
  const visitDate = document.getElementById('van-visit-date').value;
  const visitSlot = document.getElementById('van-visit-slot').value;
  const locality = document.getElementById('van-locality').value;
  const sendWa = document.getElementById('van-send-wa').checked;

  try {
    const res = await fetch(`/api/crm/leads/${leadId}/assign-technician`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        technicianId: techId,
        technicianName: techName,
        technicianPhone: techPhone,
        visitDate,
        visitSlot,
        areaZone: locality
      })
    });

    if (sendWa) {
      await fetch(`/api/crm/leads/${leadId}/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType: 'VAN_CONFIRM' })
      });
    }

    closeModal('modal-assign-van');
    loadPillarLeads();
  } catch (err) {
    alert('Failed to assign technician van: ' + err.message);
  }
}

// Payment Modal
function openPaymentModal(leadId, estValue, currAdvance) {
  const lead = currentLeadsData.find(l => l.id === leadId);
  if (!lead) return;

  const total = Number(estValue || lead.estimated_value || 0);
  const adv = Number(currAdvance || lead.advance_amount || 0);
  const bal = Math.max(0, total - adv);

  document.getElementById('pay-lead-id').value = leadId;
  document.getElementById('pay-total-val').value = '₹' + total.toLocaleString('en-IN');
  document.getElementById('pay-curr-balance').value = '₹' + bal.toLocaleString('en-IN');
  document.getElementById('pay-amount').value = bal > 0 ? bal : total;

  openModal('modal-record-payment');
}

async function submitPayment() {
  const leadId = document.getElementById('pay-lead-id').value;
  const amount = Number(document.getElementById('pay-amount').value);
  const mode = document.getElementById('pay-mode').value;
  const ref = document.getElementById('pay-ref').value;
  const sendWa = document.getElementById('pay-send-wa').checked;

  if (!amount || amount <= 0) {
    alert('Please enter a valid payment amount.');
    return;
  }

  try {
    await fetch(`/api/crm/leads/${leadId}/record-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, mode, ref, isAdvance: true })
    });

    if (sendWa) {
      await fetch(`/api/crm/leads/${leadId}/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'CUSTOM_MSG',
          customMessage: `Payment Received! Thank you for paying ₹${amount.toLocaleString('en-IN')} via ${mode}${ref ? ` (Ref: ${ref})` : ''}. Your receipt is recorded in GCM ERP.`
        })
      });
    }

    closeModal('modal-record-payment');
    loadPillarLeads();
  } catch (err) {
    alert('Failed to record payment: ' + err.message);
  }
}

// Dispatch Modal
function openDispatchModal(leadId) {
  const lead = currentLeadsData.find(l => l.id === leadId);
  if (!lead) return;

  document.getElementById('disp-lead-id').value = leadId;
  document.getElementById('disp-transporter').value = lead.dispatch_transporter || 'V-Trans Logistics';
  document.getElementById('disp-lr-number').value = lead.lr_number || '';
  document.getElementById('disp-parcels').value = lead.parcels_count || '1 Bundle / Parcel';
  document.getElementById('disp-date').value = lead.dispatch_date || new Date().toISOString().slice(0, 10);

  const expDate = new Date();
  expDate.setDate(expDate.getDate() + 3);
  document.getElementById('disp-expected-date').value = lead.expected_delivery_date || expDate.toISOString().slice(0, 10);

  openModal('modal-record-dispatch');
}

async function submitDispatch() {
  const leadId = document.getElementById('disp-lead-id').value;
  const transporter = document.getElementById('disp-transporter').value;
  const lrNumber = document.getElementById('disp-lr-number').value.trim();
  const parcelsCount = document.getElementById('disp-parcels').value.trim();
  const dispatchDate = document.getElementById('disp-date').value;
  const expectedDeliveryDate = document.getElementById('disp-expected-date').value;

  if (!lrNumber) {
    alert('Please enter a valid LR / Bilty / Docket number.');
    return;
  }

  try {
    const res = await fetch(`/api/crm/leads/${leadId}/dispatch-shipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transporter,
        lrNumber,
        dispatchDate,
        expectedDeliveryDate,
        parcelsCount
      })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to dispatch shipment');

    closeModal('modal-record-dispatch');
    loadPillarLeads();
    alert('🚚 Shipment Dispatched! WhatsApp tracking notification sent to customer.');
  } catch (err) {
    alert('Failed to record dispatch: ' + err.message);
  }
}

// Activities Audit Trail
async function openActivitiesModal(leadId) {
  openModal('modal-lead-activities');
  const container = document.getElementById('activities-timeline');
  container.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Loading timeline...</div>';

  try {
    const res = await fetch(`/api/crm/leads/${leadId}/activities`);
    const data = await res.json();
    if (!data.activities || data.activities.length === 0) {
      container.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8;">No activity recorded yet.</div>';
      return;
    }

    container.innerHTML = data.activities.map(a => `
      <div class="timeline-item">
        <div class="time">${new Date(a.created_at).toLocaleString()} • <strong>${a.performed_by || 'SYSTEM'}</strong></div>
        <div class="desc"><strong>[${a.activity_type}]</strong> ${escapeHtml(a.description)}</div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:20px;">Failed to load activities: ${err.message}</div>`;
  }
}

// Quick WhatsApp Action
async function sendWhatsAppAction(leadId, actionType) {
  try {
    const res = await fetch(`/api/crm/leads/${leadId}/send-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType })
    });
    const data = await res.json();
    if (data.success) {
      alert('WhatsApp message queued & sent successfully!');
    } else {
      alert('WhatsApp notice: ' + (data.error || 'Failed'));
    }
  } catch (err) {
    alert('WhatsApp action failed: ' + err.message);
  }
}

// Takeover Toggle
async function toggleTakeover(leadId, newStatus) {
  try {
    await fetch(`/api/crm/leads/${leadId}/toggle-takeover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ takeoverStatus: newStatus })
    });
    loadPillarLeads();
  } catch (err) {
    alert('Failed to toggle takeover: ' + err.message);
  }
}

// Update Stage Direct
async function updateLeadPipelineStage(leadId, newStage) {
  try {
    await fetch(`/api/crm/leads/${leadId}/pipeline-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage })
    });
    loadPillarLeads();
  } catch (err) {
    alert('Failed to update stage: ' + err.message);
  }
}

// New Lead Modal
function openNewLeadModal() {
  openModal('modal-new-lead');
}

async function submitNewLead() {
  const customerName = document.getElementById('new-lead-name').value.trim();
  const phone = document.getElementById('new-lead-phone').value.trim();
  const pillar = document.getElementById('new-lead-pillar').value;
  const city = document.getElementById('new-lead-city').value.trim();
  const requirementSummary = document.getElementById('new-lead-req').value.trim();
  const estimatedValue = Number(document.getElementById('new-lead-val').value || 0);

  if (!customerName || !phone) {
    alert('Customer name and phone number are required.');
    return;
  }

  let websiteId = 'gcmsafetynets';
  if (pillar === 'turnkey') websiteId = 'gcm-enterprises';
  else if (pillar === 'supply_only') websiteId = 'netsocean';

  try {
    await fetch('/api/crm/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        websiteId,
        pillar,
        customerName,
        phone,
        city,
        requirementSummary,
        estimatedValue
      })
    });

    closeModal('modal-new-lead');
    loadPillarLeads();
  } catch (err) {
    alert('Failed to create lead: ' + err.message);
  }
}

// ── Missing WhatsApp Red Alert Desk ──────────────────────────────────────────
async function checkNoWhatsAppAlerts() {
  const container = document.getElementById('no-whatsapp-alert-container');
  if (!container) return;

  try {
    const res = await fetch('/api/crm/alerts/no-whatsapp');
    const data = await res.json();
    if (!data.success || !data.alerts || data.alerts.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    const alerts = data.alerts;
    container.style.display = 'block';
    container.innerHTML = `
      <div style="background:linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(185,28,28,0.12) 100%); border: 1.5px solid #ef4444; border-radius: 12px; padding: 16px 20px; box-shadow: 0 4px 20px rgba(239,68,68,0.25);">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:50%; background:#ef4444; color:white; font-size:16px;">
              <i class="fas fa-exclamation-triangle"></i>
            </span>
            <div>
              <strong style="font-size:15px; color:#fecaca;">🚨 ACTION REQUIRED FOR OWNER: ${alerts.length} Inbound Lead(s) Do Not Have WhatsApp!</strong>
              <div style="font-size:12.5px; color:#f87171;">Call customer directly to collect their active WhatsApp number. Once saved, AI Auto-Pilot will resume and dispatch greeting/quote!</div>
            </div>
          </div>
          <span class="badge" style="background:#ef4444; color:white; font-weight:800; font-size:12px; padding:5px 12px;">${alerts.length} PENDING CALLS</span>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap:12px;">
          ${alerts.map(a => `
            <div style="background:#0f172a; border:1px solid #334155; border-radius:8px; padding:12px; display:flex; flex-direction:column; justify-content:space-between; gap:8px;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <strong style="font-size:14px; color:#f8fafc;">${escapeHtml(a.customer_name)}</strong>
                  <span class="badge" style="font-size:10px; background:rgba(255,255,255,0.08); color:#94a3b8;">${escapeHtml(a.brand_name || a.website_id)}</span>
                </div>
                <div style="font-size:12px; color:#94a3b8; margin-top:2px;">
                  📍 ${escapeHtml(a.city || 'Hyderabad')}${a.locality ? ` • ${escapeHtml(a.locality)}` : ''}
                </div>
                <div style="font-size:12px; color:#cbd5e1; margin-top:4px; line-height:1.3;">
                  ${escapeHtml(a.requirement_summary || 'Netting Inquiry')}
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px; margin-top:6px; border-top:1px solid #1e293b; padding-top:8px;">
                <a href="tel:${a.phone}" class="btn btn-sm btn-outline" style="border-color:#60a5fa; color:#60a5fa; flex:1; text-align:center; font-size:12px; font-weight:700;">
                  <i class="fas fa-phone-alt"></i> Call ${a.phone}
                </a>
                <button class="btn btn-sm btn-primary" style="background:#22c55e; border-color:#16a34a; flex:1.2; font-size:12px; font-weight:700;" onclick="openUpdateWhatsAppModal('${a.id}','${escapeHtml(a.customer_name)}','${a.phone}')">
                  <i class="fab fa-whatsapp"></i> Add WA Number
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Error checking no-whatsapp alerts:', err);
  }
}

// ── 1-Tap Quick Call Lead Creator ─────────────────────────────────────────────
function openQuickCallModal() {
  document.getElementById('qc-phone').value = '';
  document.getElementById('qc-name').value = '';
  document.getElementById('qc-city').value = 'Hyderabad (Telangana)';
  document.getElementById('qc-website').value = 'gcmsafetynets';
  document.getElementById('qc-service').value = 'Balcony Safety Nets Installation';
  document.getElementById('qc-custom-req-group').style.display = 'none';
  document.getElementById('qc-custom-req').value = '';
  document.getElementById('qc-val').value = '';
  document.getElementById('qc-notes').value = '';

  openModal('modal-quick-call');
  setTimeout(() => {
    document.getElementById('qc-phone')?.focus();
  }, 100);
}

function onQuickCallBrandChange() {
  const brand = document.getElementById('qc-website').value;
  const cityInput = document.getElementById('qc-city');
  if (brand === 'gcmnetting') cityInput.value = 'Bangalore (Karnataka)';
  else if (brand === 'gcmnettingsolutions') cityInput.value = 'Chennai (Tamil Nadu)';
  else if (brand === 'gcmsafetynets') cityInput.value = 'Hyderabad (Telangana)';
  else if (brand === 'gcm-enterprises') cityInput.value = 'Pan-India (Sports Turnkey)';
  else if (brand === 'netsocean') cityInput.value = 'Pan-India (Wholesale)';
  else cityInput.value = 'Hyderabad';
}

function onQuickCallServiceChange() {
  const s = document.getElementById('qc-service').value;
  const grp = document.getElementById('qc-custom-req-group');
  if (s === 'Other') {
    grp.style.display = 'block';
  } else {
    grp.style.display = 'none';
  }
}

async function submitQuickCallLead() {
  const phone = document.getElementById('qc-phone').value.trim();
  const websiteId = document.getElementById('qc-website').value;
  const customerName = document.getElementById('qc-name').value.trim() || 'Valued Client';
  const city = document.getElementById('qc-city').value.trim();
  const serviceSelect = document.getElementById('qc-service').value;
  const customReq = document.getElementById('qc-custom-req').value.trim();
  const service = serviceSelect === 'Other' && customReq ? customReq : serviceSelect;
  const estimatedValue = Number(document.getElementById('qc-val').value || 0);
  const notes = document.getElementById('qc-notes').value.trim();

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
        websiteId,
        customerName,
        city,
        service,
        requirementSummary: service,
        estimatedValue,
        notes
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create lead');

    closeModal('modal-quick-call');
    loadPillarLeads();

    if (data.lead && data.lead.whatsapp_status === 'NO_WHATSAPP') {
      alert(`⚠️ Lead Saved! Note: Meta reported that ${phone} does not have WhatsApp. An alert has been flagged in your Owner Desk to collect their WhatsApp number.`);
    } else {
      alert(`🚀 Success! AI Project Coordinator has connected with ${customerName} on WhatsApp.`);
    }
  } catch (err) {
    alert('Failed to save quick call lead: ' + err.message);
  }
}

// ── Update WhatsApp Number Modal ──────────────────────────────────────────────
function openUpdateWhatsAppModal(leadId, customerName, phone) {
  document.getElementById('upwa-lead-id').value = leadId;
  document.getElementById('upwa-customer-name').textContent = customerName || 'Customer';
  document.getElementById('upwa-calling-phone').textContent = phone;
  const callLink = document.getElementById('upwa-call-link');
  if (callLink) {
    callLink.href = 'tel:' + phone;
    callLink.textContent = phone;
  }
  document.getElementById('upwa-new-phone').value = '';
  openModal('modal-update-whatsapp');
  setTimeout(() => {
    document.getElementById('upwa-new-phone')?.focus();
  }, 100);
}

async function submitUpdateWhatsApp() {
  const leadId = document.getElementById('upwa-lead-id').value;
  const newPhone = document.getElementById('upwa-new-phone').value.trim();

  if (!newPhone || newPhone.replace(/\D/g, '').length < 10) {
    alert('Please enter a valid 10-digit customer WhatsApp number.');
    document.getElementById('upwa-new-phone').focus();
    return;
  }

  try {
    const res = await fetch(`/api/crm/leads/${leadId}/update-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsappNumber: newPhone })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update WhatsApp number');

    closeModal('modal-update-whatsapp');
    loadPillarLeads();
    alert(`✅ WhatsApp Connected! AI Agent has resumed auto-pilot and dispatched the welcome message to +91 ${newPhone}.`);
  } catch (err) {
    alert('Failed to update WhatsApp: ' + err.message);
  }
}

// ── Dispatch Quotation with Bank Details & UPI ────────────────────────────────
function openDispatchQuotationModal(leadId) {
  const lead = currentLeadsData.find(l => l.id === leadId);
  if (!lead) return;

  document.getElementById('dq-lead-id').value = leadId;
  document.getElementById('dq-customer-info').value = `${lead.customer_name} (${lead.whatsapp_number || lead.phone}) — ${lead.city || 'Hyderabad'}`;
  
  const rand = Math.floor(1000 + Math.random() * 9000);
  document.getElementById('dq-quote-num').value = `GCM-EST-2026-${rand}`;
  document.getElementById('dq-project-name').value = lead.requirement_summary || 'Netting Installation Project';
  document.getElementById('dq-grand-total').value = lead.estimated_value > 0 ? lead.estimated_value : 12000;
  document.getElementById('dq-view-url').value = `https://gcm.enterprises/admin/view.php?id=GCM-EST-2026-${rand}`;
  document.getElementById('dq-inc-bank').checked = true;
  document.getElementById('dq-inc-upi').checked = true;

  openModal('modal-dispatch-quotation');
}

async function submitDispatchQuotation() {
  const leadId = document.getElementById('dq-lead-id').value;
  const quoteNumber = document.getElementById('dq-quote-num').value.trim();
  const projectName = document.getElementById('dq-project-name').value.trim();
  const grandTotal = Number(document.getElementById('dq-grand-total').value || 0);
  const viewUrl = document.getElementById('dq-view-url').value.trim();
  const includeBankDetails = document.getElementById('dq-inc-bank').checked;
  const includeUpi = document.getElementById('dq-inc-upi').checked;

  if (!grandTotal || grandTotal <= 0) {
    alert('Please enter a valid Grand Total amount.');
    return;
  }

  try {
    const res = await fetch(`/api/crm/leads/${leadId}/dispatch-quotation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteNumber,
        projectName,
        grandTotal,
        viewUrl,
        includeBankDetails,
        includeUpi
      })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to dispatch quotation');

    closeModal('modal-dispatch-quotation');
    loadPillarLeads();

    if (data.waStatus === 'FAILED_NO_WHATSAPP') {
      alert(`⚠️ Quotation created! However, customer does not have WhatsApp on this number. An alert has been flagged in your Owner Desk.`);
    } else {
      alert(`🚀 Quotation Dispatched! Sent estimation #${quoteNumber} for ₹${grandTotal.toLocaleString('en-IN')} with Bank & UPI details to customer on WhatsApp.`);
    }
  } catch (err) {
    alert('Failed to dispatch quotation: ' + err.message);
  }
}

