/* ==========================================================================
   ENGIPLEX CAFE TRACKER — CAFE DETAILS & ANALYTICS DRAWER
   Slide-over panel for inspecting credentials, live DB sync & WhatsApp outreach
   ========================================================================== */

import { DatabaseService } from '../db-service.js';

export class CafeDrawer {
  constructor(store, onUpdate, showToast) {
    this.store = store;
    this.onUpdate = onUpdate;
    this.showToast = showToast;
    this.backdropEl = document.getElementById('drawer-backdrop');
    this.currentCafe = null;
    this.passwordRevealed = false;
    this.initEvents();
  }

  initEvents() {
    document.getElementById('drawer-close-btn')?.addEventListener('click', () => this.close());
    this.backdropEl?.addEventListener('click', (e) => {
      if (e.target === this.backdropEl) this.close();
    });
  }

  open(cafeId) {
    const cafe = this.store.getById(cafeId);
    if (!cafe) return;

    this.currentCafe = cafe;
    this.passwordRevealed = false;
    this.render();
    this.backdropEl?.classList.add('active');
  }

  close() {
    this.backdropEl?.classList.remove('active');
    this.currentCafe = null;
  }

  render() {
    const cafe = this.currentCafe;
    if (!cafe) return;

    const trial = this.store.getTrialInfo(cafe);
    const drawerContainer = document.getElementById('drawer-content');
    if (!drawerContainer) return;

    const cleanPhone = (cafe.phone || '').replace(/[^0-9]/g, '');
    const isDedicated = cafe.database?.type === 'dedicated_supabase';

    // Pre-crafted WhatsApp messages
    const welcomeMsg = encodeURIComponent(
      `Hi ${cafe.ownerName}! 👋 Welcome to your Engiplex Digital Loyalty Pass portal for ${cafe.name}.\n\n` +
      `🔑 Your Admin Access:\n` +
      `• Email: ${cafe.email}\n` +
      `• Password: ${cafe.rawPassword}\n` +
      `• Barista Stamp PIN: ${cafe.ownerStampPin}\n\n` +
      `Enjoy your ${cafe.totalTrialDays || 14}-day free tier! Let us know if you need any assistance.`
    );

    const expiryMsg = encodeURIComponent(
      `Hello ${cafe.ownerName}! Your ${cafe.name} Digital Loyalty Card free trial has ${trial.daysRemaining} days remaining.\n\n` +
      `Your customers have already registered ${cafe.cachedCustomerCount || 0} passes! Would you like us to activate your Pro subscription?`
    );

    drawerContainer.innerHTML = `
      <!-- Header -->
      <div class="drawer-header">
        <div style="display: flex; gap: 14px; align-items: center;">
          <div class="cafe-avatar" style="width: 52px; height: 52px; font-size: 24px;">☕</div>
          <div>
            <h3 style="font-size: 18px; font-weight: 700; color: var(--text-primary);">${this.escapeHtml(cafe.name)}</h3>
            <p style="font-size: 12px; color: var(--text-muted); font-family: var(--font-mono);">/${cafe.slug} • ${this.escapeHtml(cafe.city || 'Mumbai')}</p>
          </div>
        </div>
        <button id="drawer-close-btn" class="modal-close-btn" aria-label="Close Drawer">✕</button>
      </div>

      <!-- Body Content -->
      <div class="drawer-body">
        <!-- 1. Subscription & Free Tier Progress -->
        <div class="drawer-section">
          <div class="drawer-section-title">
            <span>⏳ Subscription & Free Tier</span>
            <span class="badge ${trial.badgeClass}" style="margin-left: auto;">${trial.label}</span>
          </div>

          <div class="drawer-info-card">
            <div class="info-item">
              <span class="label">Plan:</span>
              <span class="val" style="text-transform: capitalize;">${cafe.subscriptionPlan.replace('_', ' ')}</span>
            </div>
            <div class="info-item">
              <span class="label">Free Tier Start:</span>
              <span class="val">${new Date(cafe.freeTierStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            <div class="info-item">
              <span class="label">Free Tier Expiry:</span>
              <span class="val" style="color: ${trial.daysRemaining <= 3 ? 'var(--accent-ruby)' : 'var(--text-primary)'}">
                ${new Date(cafe.freeTierEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>

            <!-- Progress Bar -->
            <div style="margin-top: 6px;">
              <div class="progress-track">
                <div class="progress-fill ${trial.daysRemaining <= 3 ? 'fill-ruby' : trial.daysRemaining <= 7 ? 'fill-amber' : 'fill-emerald'}" style="width: ${trial.percentUsed}%"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                <span>Trial Progress</span>
                <span>${trial.percentUsed}% completed</span>
              </div>
            </div>

            <!-- Extend Trial Quick Buttons -->
            <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm extend-btn" data-days="7">+7 Days</button>
              <button class="btn btn-secondary btn-sm extend-btn" data-days="14">+14 Days</button>
              <button class="btn btn-secondary btn-sm extend-btn" data-days="30">+30 Days</button>
              <button class="btn btn-primary btn-sm" id="convert-pro-btn" style="margin-left: auto;">Mark as Pro</button>
            </div>
          </div>
        </div>

        <!-- 2. Owner & Credentials Vault -->
        <div class="drawer-section">
          <div class="drawer-section-title">
            <span>🔐 Owner Credentials Vault</span>
          </div>

          <div class="drawer-info-card">
            <div class="info-item">
              <span class="label">Owner Name:</span>
              <span class="val">${this.escapeHtml(cafe.ownerName)}</span>
            </div>
            <div class="info-item">
              <span class="label">Email:</span>
              <span class="val font-mono" style="font-size: 12px;">
                ${this.escapeHtml(cafe.email)}
                <button class="secret-btn copy-btn" data-copy="${cafe.email}" title="Copy Email">📋</button>
              </span>
            </div>
            <div class="info-item">
              <span class="label">Phone:</span>
              <span class="val">
                ${this.escapeHtml(cafe.phone)}
                <a href="https://wa.me/${cleanPhone}" target="_blank" class="contact-action-btn" title="Open WhatsApp">💬 Chat</a>
              </span>
            </div>
            <div class="info-item">
              <span class="label">Portal Password:</span>
              <div class="val">
                <span id="drawer-pwd-display" class="font-mono" style="letter-spacing: ${this.passwordRevealed ? 'normal' : '0.15em'}; font-size: 12px;">
                  ${this.passwordRevealed ? this.escapeHtml(cafe.rawPassword) : '••••••••••••'}
                </span>
                <button class="secret-btn" id="toggle-pwd-btn" title="Show/Hide">👁️</button>
                <button class="secret-btn copy-btn" data-copy="${cafe.rawPassword}" title="Copy Password">📋</button>
              </div>
            </div>
            <div class="info-item">
              <span class="label">Barista Stamp PIN:</span>
              <div class="val">
                <span class="font-mono" style="font-weight: 700; color: var(--accent-gold); font-size: 13px;">${cafe.ownerStampPin || '1234'}</span>
                <button class="secret-btn copy-btn" data-copy="${cafe.ownerStampPin || '1234'}" title="Copy PIN">📋</button>
              </div>
            </div>
            <div class="info-item">
              <span class="label">Store Address:</span>
              <span class="val" style="font-size: 12px; text-align: right; max-width: 60%;">${this.escapeHtml(cafe.address || 'Not specified')}</span>
            </div>
          </div>
        </div>

        <!-- 3. Database Connection & Live Telemetry -->
        <div class="drawer-section">
          <div class="drawer-section-title">
            <span>⚡ Database & Telemetry</span>
            <span class="db-pill" style="margin-left: auto;">
              <span class="status-dot ${cafe.dbStatus === 'online' ? 'dot-green' : 'dot-red'}"></span>
              ${isDedicated ? 'Dedicated Supabase' : 'Shared Platform DB'}
            </span>
          </div>

          <div class="drawer-info-card">
            ${isDedicated ? `
              <div class="info-item">
                <span class="label">Supabase URL:</span>
                <span class="val font-mono" style="font-size: 11.5px; word-break: break-all;">
                  ${cafe.database.url.replace('https://', '')}
                  <button class="secret-btn copy-btn" data-copy="${cafe.database.url}">📋</button>
                </span>
              </div>
              <div class="info-item">
                <span class="label">API Key:</span>
                <span class="val font-mono" style="font-size: 11px;">
                  ${cafe.database.apiKey.substring(0, 14)}...
                  <button class="secret-btn copy-btn" data-copy="${cafe.database.apiKey}">📋</button>
                </span>
              </div>
            ` : `
              <p style="font-size: 12px; color: var(--text-secondary);">
                This cafe uses your centralized Engiplex Platform database, segmented by tenant slug <code>${cafe.slug}</code>.
              </p>
            `}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px;">
              <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); text-align: center;">
                <div style="font-size: 20px; font-weight: 700; font-family: var(--font-mono); color: var(--accent-emerald);">
                  ${cafe.cachedCustomerCount || 0}
                </div>
                <div style="font-size: 11px; color: var(--text-muted);">Registered Customers</div>
              </div>

              <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); text-align: center;">
                <div style="font-size: 20px; font-weight: 700; font-family: var(--font-mono); color: var(--accent-gold);">
                  ${cafe.cachedTxnCount || 0}
                </div>
                <div style="font-size: 11px; color: var(--text-muted);">Total Transactions</div>
              </div>
            </div>

            <button class="btn btn-secondary btn-sm" id="drawer-ping-db-btn" style="margin-top: 10px; width: 100%;">
              ⚡ Test Live Connection Now
            </button>
            <div id="drawer-ping-status" style="font-size: 11.5px; text-align: center; margin-top: 4px;"></div>
          </div>
        </div>

        <!-- 4. Quick WhatsApp Outreach -->
        <div class="drawer-section">
          <div class="drawer-section-title">
            <span>💬 Direct WhatsApp Actions</span>
          </div>

          <div class="action-grid">
            <a href="https://wa.me/${cleanPhone}?text=${welcomeMsg}" target="_blank" class="action-tile">
              <span class="action-tile-icon">👋</span>
              <div class="action-tile-text">
                <h5>Send Welcome & Pass</h5>
                <p>Send login credentials</p>
              </div>
            </a>

            <a href="https://wa.me/${cleanPhone}?text=${expiryMsg}" target="_blank" class="action-tile">
              <span class="action-tile-icon">⏰</span>
              <div class="action-tile-text">
                <h5>Trial Expiry Alert</h5>
                <p>Prompt subscription renewal</p>
              </div>
            </a>
          </div>
        </div>

        <!-- 5. Destructive Zone -->
        <div style="margin-top: 12px; border-top: 1px solid var(--border-subtle); padding-top: 16px; display: flex; justify-content: space-between;">
          <button class="btn btn-ghost btn-sm" id="delete-cafe-btn" style="color: var(--accent-ruby);">
            🗑️ Delete Cafe Record
          </button>
        </div>
      </div>
    `;

    this.attachDrawerActions();
  }

  attachDrawerActions() {
    const cafe = this.currentCafe;
    if (!cafe) return;

    // Close button
    document.getElementById('drawer-close-btn')?.addEventListener('click', () => this.close());

    // Password toggle
    document.getElementById('toggle-pwd-btn')?.addEventListener('click', () => {
      this.passwordRevealed = !this.passwordRevealed;
      const pwdDisplay = document.getElementById('drawer-pwd-display');
      if (pwdDisplay) {
        pwdDisplay.innerText = this.passwordRevealed ? cafe.rawPassword : '••••••••••••';
        pwdDisplay.style.letterSpacing = this.passwordRevealed ? 'normal' : '0.15em';
      }
    });

    // Copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = btn.getAttribute('data-copy');
        if (text) {
          navigator.clipboard.writeText(text);
          this.showToast('Copied to clipboard!', 'success');
        }
      });
    });

    // Extend buttons
    document.querySelectorAll('.extend-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const days = parseInt(btn.getAttribute('data-days'), 10);
        this.store.extendFreeTier(cafe.id, days);
        this.showToast(`Extended free tier by +${days} days!`, 'success');
        this.render();
        this.onUpdate();
      });
    });

    // Mark as Pro
    document.getElementById('convert-pro-btn')?.addEventListener('click', () => {
      this.store.updateCafe(cafe.id, {
        subscriptionPlan: 'pro_annual',
        subscriptionStatus: 'active'
      });
      this.showToast(`Converted ${cafe.name} to Pro Subscriber!`, 'success');
      this.render();
      this.onUpdate();
    });

    // Ping DB
    document.getElementById('drawer-ping-db-btn')?.addEventListener('click', async () => {
      const statusEl = document.getElementById('drawer-ping-status');
      if (statusEl) statusEl.innerHTML = '<span style="color: var(--accent-gold);">⚡ Connecting...</span>';

      const url = cafe.database?.url;
      const key = cafe.database?.apiKey;

      if (!url || !key) {
        if (statusEl) statusEl.innerHTML = '<span style="color: var(--text-muted);">Shared database mode; ping completed locally.</span>';
        return;
      }

      const res = await DatabaseService.pingDatabase(url, key);
      if (res.ok) {
        this.store.updateCafe(cafe.id, {
          cachedCustomerCount: res.customerCount,
          cachedTxnCount: res.txnCount,
          dbLatency: res.latency,
          dbStatus: 'online'
        });
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: var(--accent-emerald);">✓ Online (${res.latency}ms) — Found ${res.customerCount} customers, ${res.txnCount} txns</span>`;
        }
        this.showToast(`Database synced: ${res.customerCount} customers active`, 'success');
        this.onUpdate();
      } else {
        this.store.updateCafe(cafe.id, { dbStatus: 'offline' });
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: var(--accent-ruby);">✕ Offline: ${res.error}</span>`;
        }
        this.showToast(`Connection failed: ${res.error}`, 'error');
        this.onUpdate();
      }
    });

    // Delete Cafe
    document.getElementById('delete-cafe-btn')?.addEventListener('click', () => {
      if (confirm(`Are you sure you want to remove "${cafe.name}" from your tracker?`)) {
        this.store.deleteCafe(cafe.id);
        this.showToast(`Removed "${cafe.name}"`, 'success');
        this.close();
        this.onUpdate();
      }
    });
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
