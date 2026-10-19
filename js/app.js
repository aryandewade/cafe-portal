/* ==========================================================================
   ENGIPLEX CAFE TRACKER — MASTER APPLICATION CONTROLLER
   Coordinates state, table rendering, live DB synchronization, search & filters
   ========================================================================== */

import { CafeStore } from './store.js';
import { DatabaseService } from './db-service.js';
import { OnboardingModal } from './components/modal.js';
import { CafeDrawer } from './components/drawer.js';

class CafeTrackerApp {
  constructor() {
    this.store = new CafeStore();
    this.activeFilter = 'all'; // all, active, trialing, expiring, expired
    this.searchQuery = '';
    this.visiblePasswords = new Set(); // track which rows have unmasked passwords

    this.modal = new OnboardingModal(
      this.store,
      () => this.render(),
      (msg, type) => this.showToast(msg, type)
    );

    this.drawer = new CafeDrawer(
      this.store,
      () => this.render(),
      (msg, type) => this.showToast(msg, type)
    );

    this.initElements();
    this.initEvents();
    this.render();

    // Auto-sync databases in background on first load
    setTimeout(() => this.syncAllDatabases(false), 800);
  }

  initElements() {
    this.tableBody = document.getElementById('cafe-table-body');
    this.searchInput = document.getElementById('search-input');
    this.filterPills = document.querySelectorAll('.filter-pill');
    this.syncBtn = document.getElementById('sync-all-btn');
    this.onboardBtn = document.getElementById('onboard-trigger-btn');
    this.exportBtn = document.getElementById('export-btn');
    this.importBtn = document.getElementById('import-btn');
    this.importFileInput = document.getElementById('import-file-input');
    this.toastContainer = document.getElementById('toast-container');
  }

  initEvents() {
    // Search
    this.searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderTable();
    });

    // Filter Pills
    this.filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        this.filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeFilter = pill.getAttribute('data-filter') || 'all';
        this.renderTable();
      });
    });

    // Open Onboard Modal
    this.onboardBtn?.addEventListener('click', () => this.modal.open());

    // Sync All
    this.syncBtn?.addEventListener('click', () => this.syncAllDatabases(true));

    // Export
    this.exportBtn?.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(this.store.exportJson());
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `engiplex_cafe_tracker_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      this.showToast('Cafe database exported successfully!', 'success');
    });

    // Import
    this.importBtn?.addEventListener('click', () => this.importFileInput?.click());
    this.importFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const success = this.store.importJson(event.target.result);
        if (success) {
          this.showToast('Imported cafe records successfully!', 'success');
          this.render();
        } else {
          this.showToast('Invalid JSON file format', 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  render() {
    this.renderKPIs();
    this.renderTable();
  }

  renderKPIs() {
    const metrics = this.store.getMetrics();

    const totalCafesEl = document.getElementById('kpi-total-cafes');
    if (totalCafesEl) totalCafesEl.innerText = metrics.totalCafes;

    const totalCustomersEl = document.getElementById('kpi-total-customers');
    if (totalCustomersEl) totalCustomersEl.innerText = metrics.totalCustomers.toLocaleString();

    const expiringTrialsEl = document.getElementById('kpi-expiring-trials');
    if (expiringTrialsEl) expiringTrialsEl.innerText = metrics.expiringCount;

    const activeSubsEl = document.getElementById('kpi-active-subs');
    if (activeSubsEl) activeSubsEl.innerText = metrics.activeSubscribers;

    // Update filter pill counters
    const countAll = this.store.getAll().length;
    let countActive = 0;
    let countTrial = 0;
    let countExpiring = 0;
    let countExpired = 0;

    this.store.getAll().forEach(c => {
      const trial = this.store.getTrialInfo(c);
      if (trial.status === 'active') countActive++;
      else if (trial.status === 'trialing') countTrial++;
      else if (trial.status === 'expiring') countExpiring++;
      else if (trial.status === 'expired') countExpired++;
    });

    document.getElementById('pill-count-all').innerText = countAll;
    document.getElementById('pill-count-active').innerText = countActive;
    document.getElementById('pill-count-trialing').innerText = countTrial;
    document.getElementById('pill-count-expiring').innerText = countExpiring;
    document.getElementById('pill-count-expired').innerText = countExpired;
  }

  getFilteredCafes() {
    const all = this.store.getAll();
    return all.filter(cafe => {
      // 1. Text Search Filter
      const q = this.searchQuery;
      const matchesSearch = !q || (
        cafe.name.toLowerCase().includes(q) ||
        cafe.ownerName.toLowerCase().includes(q) ||
        cafe.city.toLowerCase().includes(q) ||
        cafe.email.toLowerCase().includes(q) ||
        cafe.phone.includes(q) ||
        cafe.slug.includes(q)
      );

      if (!matchesSearch) return false;

      // 2. Status Pill Filter
      if (this.activeFilter === 'all') return true;

      const trial = this.store.getTrialInfo(cafe);
      if (this.activeFilter === 'active') return trial.status === 'active';
      if (this.activeFilter === 'trialing') return trial.status === 'trialing';
      if (this.activeFilter === 'expiring') return trial.status === 'expiring';
      if (this.activeFilter === 'expired') return trial.status === 'expired';

      return true;
    });
  }

  renderTable() {
    const filtered = this.getFilteredCafes();
    if (!this.tableBody) return;

    if (filtered.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
            <div style="font-size: 32px; margin-bottom: 12px;">☕</div>
            <p style="font-size: 15px; font-weight: 600; color: var(--text-secondary);">No cafes found</p>
            <p style="font-size: 13px;">Try adjusting your search terms or filter criteria.</p>
          </td>
        </tr>
      `;
      return;
    }

    this.tableBody.innerHTML = filtered.map(cafe => {
      const trial = this.store.getTrialInfo(cafe);
      const cleanPhone = (cafe.phone || '').replace(/[^0-9]/g, '');
      const isPwdVisible = this.visiblePasswords.has(cafe.id);
      const isDedicated = cafe.database?.type === 'dedicated_supabase';

      return `
        <tr data-cafe-id="${cafe.id}">
          <!-- 1. Cafe & Brand -->
          <td>
            <div class="cafe-cell">
              <div class="cafe-avatar">☕</div>
              <div class="cafe-name-group">
                <span class="cafe-name">${this.escapeHtml(cafe.name)}</span>
                <span class="cafe-slug">/${cafe.slug}</span>
                <span class="cafe-location">📍 ${this.escapeHtml(cafe.city || 'Mumbai')}</span>
              </div>
            </div>
          </td>

          <!-- 2. Owner & Contact -->
          <td>
            <div class="owner-cell">
              <span class="owner-name">${this.escapeHtml(cafe.ownerName)}</span>
              <div class="owner-contact">
                <span>${this.escapeHtml(cafe.email)}</span>
                <a href="https://wa.me/${cleanPhone}" target="_blank" class="contact-action-btn" title="Chat on WhatsApp" onclick="event.stopPropagation();">
                  💬 ${this.escapeHtml(cafe.phone)}
                </a>
              </div>
            </div>
          </td>

          <!-- 3. Database Mode & Status -->
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span class="db-pill">
                <span class="status-dot ${cafe.dbStatus === 'online' ? 'dot-green' : 'dot-red'}"></span>
                ${isDedicated ? 'Dedicated Supabase' : 'Shared Platform DB'}
              </span>
              <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">
                ${cafe.dbLatency ? `Ping: ${cafe.dbLatency}ms` : 'No ping yet'}
              </span>
            </div>
          </td>

          <!-- 4. Live Customer Count -->
          <td>
            <div class="customer-metric-cell">
              <div class="customer-count">
                ${cafe.cachedCustomerCount || 0}
                <span class="pulse-badge">Live</span>
              </div>
              <span class="customer-subtext">${cafe.cachedTxnCount || 0} transactions</span>
            </div>
          </td>

          <!-- 5. Free Tier Countdown -->
          <td>
            <div class="trial-cell">
              <div class="trial-time">
                <span class="badge ${trial.badgeClass}">${trial.label}</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill ${trial.daysRemaining <= 3 ? 'fill-ruby' : trial.daysRemaining <= 7 ? 'fill-amber' : 'fill-emerald'}" style="width: ${trial.percentUsed}%"></div>
              </div>
            </div>
          </td>

          <!-- 6. Password & Stamp PIN -->
          <td onclick="event.stopPropagation();">
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div class="secret-mask-box">
                <span class="secret-text" style="letter-spacing: ${isPwdVisible ? 'normal' : '0.15em'}">
                  ${isPwdVisible ? this.escapeHtml(cafe.rawPassword) : '••••••••'}
                </span>
                <button class="secret-btn toggle-row-pwd-btn" data-id="${cafe.id}" title="Toggle Password View">👁️</button>
                <button class="secret-btn copy-secret-btn" data-val="${cafe.rawPassword}" title="Copy Password">📋</button>
              </div>
              <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
                <span>PIN:</span>
                <strong style="color: var(--accent-gold); font-family: var(--font-mono);">${cafe.ownerStampPin || '1234'}</strong>
                <button class="secret-btn copy-secret-btn" data-val="${cafe.ownerStampPin || '1234'}" title="Copy PIN" style="padding: 0;">📋</button>
              </div>
            </div>
          </td>

          <!-- 7. Actions -->
          <td onclick="event.stopPropagation();">
            <div class="row-actions">
              <button class="btn btn-secondary btn-sm open-drawer-btn" data-id="${cafe.id}">
                Inspect ➔
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.attachTableEvents();
  }

  attachTableEvents() {
    // Row click opens drawer
    this.tableBody.querySelectorAll('tr[data-cafe-id]').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-cafe-id');
        if (id) this.drawer.open(id);
      });
    });

    // Inspect buttons
    this.tableBody.querySelectorAll('.open-drawer-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id) this.drawer.open(id);
      });
    });

    // Toggle row password visibility
    this.tableBody.querySelectorAll('.toggle-row-pwd-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (this.visiblePasswords.has(id)) {
          this.visiblePasswords.delete(id);
        } else {
          this.visiblePasswords.add(id);
        }
        this.renderTable();
      });
    });

    // Copy secrets
    this.tableBody.querySelectorAll('.copy-secret-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = btn.getAttribute('data-val');
        if (val) {
          navigator.clipboard.writeText(val);
          this.showToast('Copied to clipboard!', 'success');
        }
      });
    });
  }

  async syncAllDatabases(userInitiated = false) {
    if (this.syncBtn) {
      this.syncBtn.innerHTML = '⚡ Syncing Databases...';
      this.syncBtn.disabled = true;
    }

    const cafes = this.store.getAll();
    const results = await DatabaseService.syncAll(cafes);

    results.forEach(res => {
      if (res && res.cafeId) {
        if (res.ok) {
          this.store.updateCafe(res.cafeId, {
            cachedCustomerCount: res.customerCount,
            cachedTxnCount: res.txnCount,
            dbLatency: res.latency,
            dbStatus: 'online'
          });
        } else {
          // If offline or error
          this.store.updateCafe(res.cafeId, {
            dbStatus: res.error?.includes('Shared DB') ? 'online' : 'offline'
          });
        }
      }
    });

    if (this.syncBtn) {
      this.syncBtn.innerHTML = '🔄 Sync All Databases';
      this.syncBtn.disabled = false;
    }

    this.render();

    if (userInitiated) {
      this.showToast('All partner databases synchronized with live stats!', 'success');
    }
  }

  showToast(message, type = 'success') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : '✕'}</span>
      <span>${this.escapeHtml(message)}</span>
    `;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new CafeTrackerApp();
});
