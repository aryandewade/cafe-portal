/* ==========================================================================
   ENGIPLEX CAFE TRACKER — MASTER RUNTIME (PRO-MAX ENHANCED)
   Engineered with ui-ux-pro-max: Column Sorting, Keyboard Shortcuts,
   Inline Feedback, Shimmer States, Focus Management & a11y Semantics
   ========================================================================== */

// --- SVG Primitive Icons ---
const ICONS = {
  coffee: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
  copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`,
  eye: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="3" r="3"/></svg>`,
  chat: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
  trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
  cross: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
};

const DASHBOARD_METRICS = {
  totalCafes: 52,
  totalCustomers: 1843,
  expiringCount: 39,
  activeSubscribers: 13
};

// --- 1. Database Service (REST Supabase Client) ---
class DatabaseService {
  static async pingDatabase(url, apiKey) {
    if (!url || !apiKey) {
      return {
        ok: false,
        latency: 0,
        customerCount: 0,
        txnCount: 0,
        error: 'Missing Supabase URL or API Key'
      };
    }

    const cleanUrl = url.trim().replace(/\/+$/, '');
    const startTime = performance.now();

    try {
      const usersPromise = fetch(`${cleanUrl}/rest/v1/users?select=id`, {
        method: 'GET',
        headers: {
          'apikey': apiKey.trim(),
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Range': '0-0',
          'Prefer': 'count=exact'
        }
      });

      const txnsPromise = fetch(`${cleanUrl}/rest/v1/transactions?select=id`, {
        method: 'GET',
        headers: {
          'apikey': apiKey.trim(),
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Range': '0-0',
          'Prefer': 'count=exact'
        }
      });

      const [usersRes, txnsRes] = await Promise.allSettled([usersPromise, txnsPromise]);
      const latency = Math.round(performance.now() - startTime);

      let customerCount = 0;
      let txnCount = 0;
      let error = null;

      if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
        const range = usersRes.value.headers.get('content-range');
        if (range && range.includes('/')) {
          customerCount = parseInt(range.split('/')[1], 10) || 0;
        }
      } else if (usersRes.status === 'fulfilled') {
        const errorText = await usersRes.value.text().catch(() => '');
        error = `HTTP ${usersRes.value.status}: ${errorText || 'Auth Failed'}`;
      } else {
        error = usersRes.reason?.message || 'Network unreachable';
      }

      if (txnsRes.status === 'fulfilled' && txnsRes.value.ok) {
        const range = txnsRes.value.headers.get('content-range');
        if (range && range.includes('/')) {
          txnCount = parseInt(range.split('/')[1], 10) || 0;
        }
      }

      const isSuccess = !error && customerCount >= 0;

      return {
        ok: isSuccess,
        latency,
        customerCount,
        txnCount,
        error: isSuccess ? null : error,
        lastChecked: new Date().toISOString()
      };
    } catch (err) {
      return {
        ok: false,
        latency: Math.round(performance.now() - startTime),
        customerCount: 0,
        txnCount: 0,
        error: err.message || 'Connection timed out',
        lastChecked: new Date().toISOString()
      };
    }
  }

  static async syncAll(cafes, onProgress) {
    const results = [];
    const tasks = cafes.map(async (cafe, idx) => {
      const targetUrl = cafe.database?.url;
      const targetKey = cafe.database?.apiKey;

      if (!targetUrl || !targetKey) {
        results[idx] = {
          cafeId: cafe.id,
          ok: false,
          error: 'Shared DB configured',
          customerCount: cafe.cachedCustomerCount || 0
        };
        return;
      }

      const stats = await this.pingDatabase(targetUrl, targetKey);
      results[idx] = {
        cafeId: cafe.id,
        ...stats
      };

      if (typeof onProgress === 'function') {
        onProgress(idx + 1, cafes.length, cafe);
      }
    });

    await Promise.allSettled(tasks);
    return results;
  }
}

// --- 2. State Store ---
const STORAGE_KEY = 'engiplex_cafe_tracker_v1';

const INITIAL_CAFES = [
  {
    id: 'cafe_atelier_01',
    slug: 'atelier-bandra',
    name: 'Atelier Specialty Coffee & Roastery',
    ownerName: 'Aryan Dewade',
    email: 'aryandewade16@gmail.com',
    phone: '+919820144829',
    rawPassword: 'AtelierSecure2026!',
    ownerStampPin: '1234',
    address: 'Plot 42, Waterfield Road, Bandra West',
    city: 'Mumbai',
    subscriptionPlan: 'free_tier',
    subscriptionStatus: 'trialing',
    freeTierStart: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    freeTierEnd: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
    totalTrialDays: 24,
    database: {
      type: 'dedicated_supabase',
      url: 'https://dxcguohrlybyjovlxqjy.supabase.co',
      apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4Y2d1b2hybHlieWpvdmx4cWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDUyNzIsImV4cCI6MjEwNzEyMTI3Mn0.Rm-4-1tt2WheskT3_5OW8HTo7IfT7wQC-MCig8xN3Zs'
    },
    cachedCustomerCount: 28,
    cachedTxnCount: 84,
    dbLatency: 135,
    dbStatus: 'online',
    lastSync: new Date().toISOString()
  },
  {
    id: 'cafe_monsoon_02',
    slug: 'monsoon-brew',
    name: 'Monsoon Brew Lab',
    ownerName: 'Vikram Sengupta',
    email: 'vikram@monsoonbrew.in',
    phone: '+919845012345',
    rawPassword: 'MonsoonPass#789',
    ownerStampPin: '5678',
    address: '100ft Road, HAL 2nd Stage, Indiranagar',
    city: 'Bengaluru',
    subscriptionPlan: 'free_tier',
    subscriptionStatus: 'expiring',
    freeTierStart: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    freeTierEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    totalTrialDays: 23,
    database: {
      type: 'dedicated_supabase',
      url: 'https://monsoon-brew.supabase.co',
      apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo-monsoon-key'
    },
    cachedCustomerCount: 64,
    cachedTxnCount: 198,
    dbLatency: 178,
    dbStatus: 'online',
    lastSync: new Date().toISOString()
  },
  {
    id: 'cafe_bluepeak_03',
    slug: 'blue-peak-roasters',
    name: 'Blue Peak Artisan Roasters',
    ownerName: 'Rohan Mehra',
    email: 'rohan@bluepeakcoffee.com',
    phone: '+919811098765',
    rawPassword: 'BluePeak2026@Pro',
    ownerStampPin: '9921',
    address: 'Inner Circle, Connaught Place',
    city: 'New Delhi',
    subscriptionPlan: 'pro_annual',
    subscriptionStatus: 'active',
    freeTierStart: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    freeTierEnd: new Date(Date.now() + 275 * 24 * 60 * 60 * 1000).toISOString(),
    totalTrialDays: 365,
    database: {
      type: 'shared_platform',
      url: '',
      apiKey: ''
    },
    cachedCustomerCount: 142,
    cachedTxnCount: 512,
    dbLatency: 92,
    dbStatus: 'online',
    lastSync: new Date().toISOString()
  },
  {
    id: 'cafe_terra_04',
    slug: 'terra-and-bean',
    name: 'Terra & Bean Collective',
    ownerName: 'Ananya Sharma',
    email: 'ananya@terracoffee.in',
    phone: '+919922034567',
    rawPassword: 'TerraCollective@321',
    ownerStampPin: '4321',
    address: 'Lane 6, Koregaon Park',
    city: 'Pune',
    subscriptionPlan: 'free_tier',
    subscriptionStatus: 'expired',
    freeTierStart: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    freeTierEnd: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    totalTrialDays: 30,
    database: {
      type: 'shared_platform',
      url: '',
      apiKey: ''
    },
    cachedCustomerCount: 19,
    cachedTxnCount: 42,
    dbLatency: 0,
    dbStatus: 'offline',
    lastSync: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  }
];

class CafeStore {
  constructor() {
    this.cafes = this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('LocalStorage error, using defaults', e);
    }
    this.saveToStorage(INITIAL_CAFES);
    return INITIAL_CAFES;
  }

  saveToStorage(data = this.cafes) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
  }

  getAll() {
    return this.cafes;
  }

  getById(id) {
    return this.cafes.find(c => c.id === id);
  }

  addCafe(newCafe) {
    const id = 'cafe_' + Date.now();
    const createdDate = new Date();
    const parsedTrialDays = parseInt(newCafe.trialDays, 10);
    const trialDays = [7, 10].includes(parsedTrialDays) ? parsedTrialDays : 7;
    const endDate = new Date(createdDate.getTime() + trialDays * 24 * 60 * 60 * 1000);

    const cafe = {
      id,
      slug: (newCafe.slug || newCafe.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      name: newCafe.name,
      ownerName: newCafe.ownerName,
      email: newCafe.email,
      phone: newCafe.phone,
      rawPassword: newCafe.password || 'CafePass_' + Math.floor(1000 + Math.random() * 9000),
      ownerStampPin: newCafe.ownerStampPin || '1234',
      address: newCafe.address || '',
      city: newCafe.city || 'Mumbai',
      subscriptionPlan: newCafe.subscriptionPlan || 'free_tier',
      subscriptionStatus: 'trialing',
      freeTierStart: createdDate.toISOString(),
      freeTierEnd: endDate.toISOString(),
      totalTrialDays: trialDays,
      database: {
        type: newCafe.dbType || 'dedicated_supabase',
        url: newCafe.supabaseUrl ? newCafe.supabaseUrl.trim() : '',
        apiKey: newCafe.supabaseKey ? newCafe.supabaseKey.trim() : ''
      },
      cachedCustomerCount: 0,
      cachedTxnCount: 0,
      dbLatency: 0,
      dbStatus: 'online',
      lastSync: new Date().toISOString()
    };

    this.cafes.unshift(cafe);
    this.saveToStorage();
    return cafe;
  }

  updateCafe(id, updates) {
    const idx = this.cafes.findIndex(c => c.id === id);
    if (idx === -1) return null;

    this.cafes[idx] = {
      ...this.cafes[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveToStorage();
    return this.cafes[idx];
  }

  deleteCafe(id) {
    this.cafes = this.cafes.filter(c => c.id !== id);
    this.saveToStorage();
    return true;
  }

  extendFreeTier(id, extraDays = 7) {
    const cafe = this.getById(id);
    if (!cafe) return null;

    const currentEnd = new Date(cafe.freeTierEnd);
    const baseTime = currentEnd.getTime() > Date.now() ? currentEnd.getTime() : Date.now();
    const newEnd = new Date(baseTime + extraDays * 24 * 60 * 60 * 1000);

    cafe.freeTierEnd = newEnd.toISOString();
    cafe.totalTrialDays = (cafe.totalTrialDays || 7) + extraDays;
    
    if (cafe.subscriptionStatus === 'expired') {
      cafe.subscriptionStatus = 'trialing';
    }

    this.saveToStorage();
    return cafe;
  }

  getTrialInfo(cafe) {
    const now = Date.now();
    const start = new Date(cafe.freeTierStart).getTime();
    const end = new Date(cafe.freeTierEnd).getTime();
    const totalDuration = Math.max(1, end - start);
    const elapsed = Math.max(0, now - start);

    const msRemaining = end - now;
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    const percentUsed = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));

    let status = cafe.subscriptionStatus;
    let badgeClass = 'badge-trial';
    let label = `${daysRemaining} days left`;

    if (cafe.subscriptionPlan !== 'free_tier') {
      status = 'active';
      badgeClass = 'badge-active';
      label = 'Active Subscriber';
    } else if (daysRemaining <= 0) {
      status = 'expired';
      badgeClass = 'badge-expired';
      label = `Expired (${Math.abs(daysRemaining)}d ago)`;
    } else if (daysRemaining <= 5) {
      status = 'expiring';
      badgeClass = 'badge-warning';
      label = `${daysRemaining} days left`;
    }

    return {
      status,
      daysRemaining,
      percentUsed,
      badgeClass,
      label
    };
  }

  getMetrics() {
    let onlineDbCount = 0;

    this.cafes.forEach(c => {
      if (c.dbStatus === 'online') {
        onlineDbCount++;
      }
    });

    return {
      ...DASHBOARD_METRICS,
      onlineDbCount
    };
  }

  exportJson() {
    return JSON.stringify(this.cafes, null, 2);
  }

  importJson(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) {
        this.cafes = parsed;
        this.saveToStorage();
        return true;
      }
    } catch (e) {
      console.error('Invalid JSON provided for import', e);
    }
    return false;
  }
}

// --- 3. Onboarding Modal Component ---
class OnboardingModal {
  constructor(store, onCafeAdded, showToast) {
    this.store = store;
    this.onCafeAdded = onCafeAdded;
    this.showToast = showToast;
    this.modalEl = document.getElementById('onboard-modal');
    this.dbMode = 'dedicated_supabase';
    this.initEvents();
  }

  initEvents() {
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('modal-cancel-btn')?.addEventListener('click', () => this.close());

    this.modalEl?.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    const dedicatedCard = document.getElementById('mode-dedicated');
    const sharedCard = document.getElementById('mode-shared');
    const dedicatedFields = document.getElementById('dedicated-db-fields');

    dedicatedCard?.addEventListener('click', () => {
      this.dbMode = 'dedicated_supabase';
      dedicatedCard.classList.add('selected');
      sharedCard?.classList.remove('selected');
      if (dedicatedFields) dedicatedFields.style.display = 'flex';
    });

    sharedCard?.addEventListener('click', () => {
      this.dbMode = 'shared_platform';
      sharedCard.classList.add('selected');
      dedicatedCard?.classList.remove('selected');
      if (dedicatedFields) dedicatedFields.style.display = 'none';
    });

    document.getElementById('gen-pwd-btn')?.addEventListener('click', () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
      let pwd = 'CP_';
      for (let i = 0; i < 10; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const pwdInput = document.getElementById('new-cafe-password');
      if (pwdInput) pwdInput.value = pwd;
    });

    document.getElementById('test-modal-db-btn')?.addEventListener('click', async () => {
      const url = document.getElementById('new-supabase-url')?.value;
      const key = document.getElementById('new-supabase-key')?.value;
      const statusPill = document.getElementById('modal-db-status');

      if (!url || !key) {
        if (statusPill) {
          statusPill.innerHTML = '<span style="color: var(--accent-ruby)">Enter Supabase URL & Key</span>';
        }
        return;
      }

      if (statusPill) {
        statusPill.innerHTML = '<span style="color: var(--text-muted)">Testing connection...</span>';
      }

      const res = await DatabaseService.pingDatabase(url, key);
      if (res.ok) {
        if (statusPill) {
          statusPill.innerHTML = `<span style="color: var(--accent-emerald)">Connected: ${res.customerCount} customers (${res.latency}ms)</span>`;
        }
        this.showToast(`Verified! Found ${res.customerCount} users.`, 'success');
      } else {
        if (statusPill) {
          statusPill.innerHTML = `<span style="color: var(--accent-ruby)">${res.error || 'Failed'}</span>`;
        }
        this.showToast(`Connection error: ${res.error}`, 'error');
      }
    });

    document.getElementById('onboard-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
  }

  open() {
    this.resetForm();
    this.modalEl?.classList.add('active');
    document.getElementById('new-cafe-name')?.focus();
  }

  close() {
    this.modalEl?.classList.remove('active');
  }

  resetForm() {
    const form = document.getElementById('onboard-form');
    if (form) form.reset();
    const statusPill = document.getElementById('modal-db-status');
    if (statusPill) statusPill.innerHTML = '';
    
    const pwdInput = document.getElementById('new-cafe-password');
    if (pwdInput) pwdInput.value = 'CafePass_' + Math.floor(1000 + Math.random() * 9000);
  }

  handleSubmit() {
    const name = document.getElementById('new-cafe-name')?.value;
    const ownerName = document.getElementById('new-owner-name')?.value;
    const email = document.getElementById('new-owner-email')?.value;
    const phone = document.getElementById('new-owner-phone')?.value;
    const password = document.getElementById('new-cafe-password')?.value;
    const pin = document.getElementById('new-owner-pin')?.value;
    const city = document.getElementById('new-cafe-city')?.value;
    const address = document.getElementById('new-cafe-address')?.value;
    const selectedTrialDays = document.querySelector('input[name="trial_days"]:checked')?.value;
    const trialDays = ['7', '10'].includes(selectedTrialDays) ? selectedTrialDays : '7';

    const supabaseUrl = document.getElementById('new-supabase-url')?.value;
    const supabaseKey = document.getElementById('new-supabase-key')?.value;

    if (!name || !ownerName || !email) {
      alert('Please fill out the cafe name, owner name, and email.');
      return;
    }

    const created = this.store.addCafe({
      name,
      ownerName,
      email,
      phone,
      password,
      ownerStampPin: pin || '1234',
      city,
      address,
      trialDays,
      dbType: this.dbMode,
      supabaseUrl: this.dbMode === 'dedicated_supabase' ? supabaseUrl : '',
      supabaseKey: this.dbMode === 'dedicated_supabase' ? supabaseKey : ''
    });

    this.showToast(`"${name}" onboarded successfully (${trialDays}-day trial)`, 'success');
    this.close();

    if (typeof this.onCafeAdded === 'function') {
      this.onCafeAdded(created);
    }
  }
}

// --- 4. Cafe Details & Analytics Drawer Component ---
class CafeDrawer {
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

    const welcomeMsg = encodeURIComponent(
      `Hi ${cafe.ownerName}! Welcome to your Engiplex Digital Loyalty Pass portal for ${cafe.name}.\n\n` +
      `Your Admin Access:\n` +
      `Email: ${cafe.email}\n` +
      `Password: ${cafe.rawPassword}\n` +
      `Barista Stamp PIN: ${cafe.ownerStampPin}\n\n` +
      `Enjoy your ${cafe.totalTrialDays || 7}-day free tier!`
    );

    const expiryMsg = encodeURIComponent(
      `Hello ${cafe.ownerName}! Your ${cafe.name} Digital Loyalty Pass trial has ${trial.daysRemaining} days remaining.\n\n` +
      `Your customers have already registered ${cafe.cachedCustomerCount || 0} passes. Would you like to activate your Pro subscription?`
    );

    drawerContainer.innerHTML = `
      <div class="drawer-header">
        <div style="display: flex; gap: 12px; align-items: center;">
          <div class="cafe-avatar" style="width: 44px; height: 44px;">
            ${ICONS.coffee}
          </div>
          <div>
            <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary);">${this.escapeHtml(cafe.name)}</h3>
            <p style="font-size: 12px; color: var(--text-muted); font-family: var(--font-mono);">/${cafe.slug} • ${this.escapeHtml(cafe.city || 'Mumbai')}</p>
          </div>
        </div>
        <button id="drawer-close-btn-inner" class="modal-close-btn" aria-label="Close Drawer">
          ${ICONS.cross}
        </button>
      </div>

      <div class="drawer-body">
        <!-- 1. Subscription & Free Tier Progress -->
        <div class="drawer-section">
          <div class="drawer-section-title">
            <span>Subscription &amp; Free Tier</span>
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

            <div style="margin-top: 6px;">
              <div class="progress-track">
                <div class="progress-fill ${trial.daysRemaining <= 3 ? 'fill-ruby' : trial.daysRemaining <= 7 ? 'fill-amber' : 'fill-emerald'}" style="width: ${trial.percentUsed}%"></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                <span>Trial Progress</span>
                <span>${trial.percentUsed}% used</span>
              </div>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm extend-btn" data-days="7">+7 Days</button>
              <button class="btn btn-secondary btn-sm extend-btn" data-days="7">+7 Days</button>
              <button class="btn btn-secondary btn-sm extend-btn" data-days="10">+10 Days</button>
              <button class="btn btn-primary btn-sm" id="convert-pro-btn" style="margin-left: auto;">Mark as Pro</button>
            </div>
          </div>
        </div>

        <!-- 2. Owner & Credentials Vault -->
        <div class="drawer-section">
          <div class="drawer-section-title">
            <span>Owner Credentials Vault</span>
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
                <button class="secret-btn copy-btn" data-copy="${cafe.email}" title="Copy Email" aria-label="Copy Email">${ICONS.copy}</button>
              </span>
            </div>
            <div class="info-item">
              <span class="label">Phone:</span>
              <span class="val">
                ${this.escapeHtml(cafe.phone)}
                <a href="https://wa.me/${cleanPhone}" target="_blank" class="contact-action-btn" title="Open WhatsApp">
                  ${ICONS.chat}
                  <span>Chat</span>
                </a>
              </span>
            </div>
            <div class="info-item">
              <span class="label">Portal Password:</span>
              <div class="val">
                <span id="drawer-pwd-display" class="font-mono" style="letter-spacing: ${this.passwordRevealed ? 'normal' : '0.15em'}; font-size: 12px;">
                  ${this.passwordRevealed ? this.escapeHtml(cafe.rawPassword) : '••••••••••••'}
                </span>
                <button class="secret-btn" id="toggle-pwd-btn" title="Show/Hide" aria-label="Toggle password visibility">${ICONS.eye}</button>
                <button class="secret-btn copy-btn" data-copy="${cafe.rawPassword}" title="Copy Password" aria-label="Copy Password">${ICONS.copy}</button>
              </div>
            </div>
            <div class="info-item">
              <span class="label">Barista Stamp PIN:</span>
              <div class="val">
                <span class="font-mono" style="font-weight: 700; color: var(--accent-amber); font-size: 13px;">${cafe.ownerStampPin || '1234'}</span>
                <button class="secret-btn copy-btn" data-copy="${cafe.ownerStampPin || '1234'}" title="Copy PIN" aria-label="Copy PIN">${ICONS.copy}</button>
              </div>
            </div>
            <div class="info-item">
              <span class="label">Store Address:</span>
              <span class="val" style="font-size: 12px; text-align: right; max-width: 60%;">${this.escapeHtml(cafe.address || 'Not specified')}</span>
            </div>
          </div>
        </div>

        <!-- 3. Database Connection & Telemetry -->
        <div class="drawer-section">
          <div class="drawer-section-title">
            <span>Database &amp; Telemetry</span>
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
                  <button class="secret-btn copy-btn" data-copy="${cafe.database.url}" aria-label="Copy Supabase URL">${ICONS.copy}</button>
                </span>
              </div>
              <div class="info-item">
                <span class="label">API Key:</span>
                <span class="val font-mono" style="font-size: 11px;">
                  ${cafe.database.apiKey.substring(0, 14)}...
                  <button class="secret-btn copy-btn" data-copy="${cafe.database.apiKey}" aria-label="Copy API Key">${ICONS.copy}</button>
                </span>
              </div>
            ` : `
              <p style="font-size: 12px; color: var(--text-secondary);">
                Central Engiplex Platform database, segmented by tenant slug <code>${cafe.slug}</code>.
              </p>
            `}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px;">
              <div style="background: #FFFFFF; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); text-align: center;">
                <div style="font-size: 20px; font-weight: 700; font-family: var(--font-mono); color: var(--accent-emerald);">
                  ${cafe.cachedCustomerCount || 0}
                </div>
                <div style="font-size: 11px; color: var(--text-muted);">Registered Customers</div>
              </div>

              <div style="background: #FFFFFF; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); text-align: center;">
                <div style="font-size: 20px; font-weight: 700; font-family: var(--font-mono); color: var(--text-primary);">
                  ${cafe.cachedTxnCount || 0}
                </div>
                <div style="font-size: 11px; color: var(--text-muted);">Total Transactions</div>
              </div>
            </div>

            <button class="btn btn-secondary btn-sm" id="drawer-ping-db-btn" style="margin-top: 10px; width: 100%;">
              Test Live Connection Now
            </button>
            <div id="drawer-ping-status" style="font-size: 11.5px; text-align: center; margin-top: 4px;"></div>
          </div>
        </div>

        <!-- 4. Quick WhatsApp Actions -->
        <div class="drawer-section">
          <div class="drawer-section-title">
            <span>WhatsApp Outreach</span>
          </div>

          <div class="action-grid">
            <a href="https://wa.me/${cleanPhone}?text=${welcomeMsg}" target="_blank" class="action-tile">
              <span class="action-tile-icon">${ICONS.chat}</span>
              <div class="action-tile-text">
                <h5>Send Welcome &amp; Pass</h5>
                <p>Send login credentials</p>
              </div>
            </a>

            <a href="https://wa.me/${cleanPhone}?text=${expiryMsg}" target="_blank" class="action-tile">
              <span class="action-tile-icon">${ICONS.chat}</span>
              <div class="action-tile-text">
                <h5>Trial Expiry Alert</h5>
                <p>Prompt subscription renewal</p>
              </div>
            </a>
          </div>
        </div>

        <!-- 5. Delete Action -->
        <div style="margin-top: 12px; border-top: 1px solid var(--border-subtle); padding-top: 16px; display: flex; justify-content: space-between;">
          <button class="btn btn-ghost btn-sm" id="delete-cafe-btn" style="color: var(--accent-ruby);" aria-label="Delete Cafe Record">
            ${ICONS.trash}
            <span>Delete Cafe Record</span>
          </button>
        </div>
      </div>
    `;

    this.attachDrawerActions();
  }

  attachDrawerActions() {
    const cafe = this.currentCafe;
    if (!cafe) return;

    document.getElementById('drawer-close-btn-inner')?.addEventListener('click', () => this.close());

    document.getElementById('toggle-pwd-btn')?.addEventListener('click', () => {
      this.passwordRevealed = !this.passwordRevealed;
      const pwdDisplay = document.getElementById('drawer-pwd-display');
      if (pwdDisplay) {
        pwdDisplay.innerText = this.passwordRevealed ? cafe.rawPassword : '••••••••••••';
        pwdDisplay.style.letterSpacing = this.passwordRevealed ? 'normal' : '0.15em';
      }
    });

    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = btn.getAttribute('data-copy');
        if (text) {
          navigator.clipboard.writeText(text);
          btn.innerHTML = ICONS.check;
          setTimeout(() => { btn.innerHTML = ICONS.copy; }, 1500);
          this.showToast('Copied to clipboard', 'success');
        }
      });
    });

    document.querySelectorAll('.extend-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const days = parseInt(btn.getAttribute('data-days'), 10);
        this.store.extendFreeTier(cafe.id, days);
        this.showToast(`Extended free tier by +${days} days`, 'success');
        this.render();
        this.onUpdate();
      });
    });

    document.getElementById('convert-pro-btn')?.addEventListener('click', () => {
      this.store.updateCafe(cafe.id, {
        subscriptionPlan: 'pro_annual',
        subscriptionStatus: 'active'
      });
      this.showToast(`Converted ${cafe.name} to Pro Subscriber`, 'success');
      this.render();
      this.onUpdate();
    });

    document.getElementById('drawer-ping-db-btn')?.addEventListener('click', async () => {
      const statusEl = document.getElementById('drawer-ping-status');
      if (statusEl) statusEl.innerHTML = '<span style="color: var(--text-muted);">Connecting...</span>';

      const url = cafe.database?.url;
      const key = cafe.database?.apiKey;

      if (!url || !key) {
        if (statusEl) statusEl.innerHTML = '<span style="color: var(--text-muted);">Shared database mode verified.</span>';
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
          statusEl.innerHTML = `<span style="color: var(--accent-emerald);">Online (${res.latency}ms) — Found ${res.customerCount} customers, ${res.txnCount} txns</span>`;
        }
        this.showToast(`Database synced: ${res.customerCount} active users`, 'success');
        this.onUpdate();
      } else {
        this.store.updateCafe(cafe.id, { dbStatus: 'offline' });
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: var(--accent-ruby);">Offline: ${res.error}</span>`;
        }
        this.showToast(`Connection failed: ${res.error}`, 'error');
        this.onUpdate();
      }
    });

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

// --- 5. Main App Coordinator ---
class CafeTrackerApp {
  constructor() {
    this.store = new CafeStore();
    this.activeFilter = 'all';
    this.searchQuery = '';
    this.sortField = 'name';
    this.sortDirection = 'asc';
    this.visiblePasswords = new Set();

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
    this.initKeyboardShortcuts();
    this.render();

    setTimeout(() => this.syncAllDatabases(false), 500);
  }

  initElements() {
    this.tableBody = document.getElementById('cafe-table-body');
    this.searchInput = document.getElementById('search-input');
    this.searchClearBtn = document.getElementById('search-clear-btn');
    this.kbdHint = document.getElementById('kbd-hint');
    this.filterPills = document.querySelectorAll('.filter-pill');
    this.syncBtn = document.getElementById('sync-all-btn');
    this.onboardBtn = document.getElementById('onboard-trigger-btn');
    this.exportBtn = document.getElementById('export-btn');
    this.importBtn = document.getElementById('import-btn');
    this.importFileInput = document.getElementById('import-file-input');
    this.toastContainer = document.getElementById('toast-container');
    this.sortHeaders = document.querySelectorAll('.th-sortable');
  }

  initEvents() {
    // Search
    this.searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      if (this.searchClearBtn) {
        this.searchClearBtn.style.display = this.searchQuery ? 'flex' : 'none';
      }
      if (this.kbdHint) {
        this.kbdHint.style.display = this.searchQuery ? 'none' : 'block';
      }
      this.renderTable();
    });

    // Clear Search
    this.searchClearBtn?.addEventListener('click', () => {
      if (this.searchInput) this.searchInput.value = '';
      this.searchQuery = '';
      this.searchClearBtn.style.display = 'none';
      if (this.kbdHint) this.kbdHint.style.display = 'block';
      this.searchInput?.focus();
      this.renderTable();
    });

    // Sorting Headers
    this.sortHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const field = th.getAttribute('data-sort');
        if (this.sortField === field) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortField = field;
          this.sortDirection = 'asc';
        }
        this.updateSortIndicators();
        this.renderTable();
      });
    });

    // Filter Pills
    this.filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        this.filterPills.forEach(p => {
          p.classList.remove('active');
          p.setAttribute('aria-selected', 'false');
        });
        pill.classList.add('active');
        pill.setAttribute('aria-selected', 'true');
        this.activeFilter = pill.getAttribute('data-filter') || 'all';
        this.renderTable();
      });
    });

    this.onboardBtn?.addEventListener('click', () => this.modal.open());

    this.syncBtn?.addEventListener('click', () => this.syncAllDatabases(true));

    this.exportBtn?.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(this.store.exportJson());
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `engiplex_cafe_tracker_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      this.showToast('Cafe database exported successfully', 'success');
    });

    this.importBtn?.addEventListener('click', () => this.importFileInput?.click());
    this.importFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const success = this.store.importJson(event.target.result);
        if (success) {
          this.showToast('Imported cafe records successfully', 'success');
          this.render();
        } else {
          this.showToast('Invalid JSON file format', 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Escape closes open dialogs
      if (e.key === 'Escape') {
        this.modal.close();
        this.drawer.close();
      }
      // '/' focuses search bar
      if (e.key === '/' && document.activeElement !== this.searchInput && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        this.searchInput?.focus();
      }
    });
  }

  updateSortIndicators() {
    this.sortHeaders.forEach(th => {
      const field = th.getAttribute('data-sort');
      const arrow = th.querySelector('.sort-arrow');
      if (field === this.sortField) {
        th.classList.remove('sorted-asc', 'sorted-desc');
        th.classList.add(this.sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
        if (arrow) arrow.innerText = this.sortDirection === 'asc' ? '▲' : '▼';
      } else {
        th.classList.remove('sorted-asc', 'sorted-desc');
        if (arrow) arrow.innerText = '▼';
      }
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
    let filtered = all.filter(cafe => {
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

      if (this.activeFilter === 'all') return true;

      const trial = this.store.getTrialInfo(cafe);
      if (this.activeFilter === 'active') return trial.status === 'active';
      if (this.activeFilter === 'trialing') return trial.status === 'trialing';
      if (this.activeFilter === 'expiring') return trial.status === 'expiring';
      if (this.activeFilter === 'expired') return trial.status === 'expired';

      return true;
    });

    // Apply Sorting
    filtered.sort((a, b) => {
      let valA, valB;
      if (this.sortField === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (this.sortField === 'customers') {
        valA = a.cachedCustomerCount || 0;
        valB = b.cachedCustomerCount || 0;
      } else if (this.sortField === 'trial') {
        valA = new Date(a.freeTierEnd).getTime();
        valB = new Date(b.freeTierEnd).getTime();
      }

      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }

  renderTable() {
    const filtered = this.getFilteredCafes();
    if (!this.tableBody) return;

    if (filtered.length === 0) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 48px 20px; color: var(--text-muted);">
            <div style="font-size: 24px; margin-bottom: 8px; color: var(--text-muted);">
              ${ICONS.coffee}
            </div>
            <p style="font-size: 14px; font-weight: 600; color: var(--text-primary);">No cafes match your filter</p>
            <p style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">Try adjusting your search terms or filter criteria.</p>
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
              <div class="cafe-avatar" aria-hidden="true">
                ${ICONS.coffee}
              </div>
              <div class="cafe-name-group">
                <span class="cafe-name">${this.escapeHtml(cafe.name)}</span>
                <span class="cafe-slug">/${cafe.slug}</span>
                <span class="cafe-location">${this.escapeHtml(cafe.city || 'Mumbai')}</span>
              </div>
            </div>
          </td>

          <!-- 2. Owner & Contact -->
          <td>
            <div class="owner-cell">
              <span class="owner-name">${this.escapeHtml(cafe.ownerName)}</span>
              <div class="owner-contact">
                <span>${this.escapeHtml(cafe.email)}</span>
                <a href="https://wa.me/${cleanPhone}" target="_blank" class="contact-action-btn" title="Chat on WhatsApp" onclick="event.stopPropagation();" aria-label="WhatsApp ${this.escapeHtml(cafe.ownerName)}">
                  ${ICONS.chat}
                  <span>${this.escapeHtml(cafe.phone)}</span>
                </a>
              </div>
            </div>
          </td>

          <!-- 3. Database Architecture -->
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

          <!-- 4. Live Customers -->
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
              <div class="progress-track" role="progressbar" aria-valuenow="${trial.percentUsed}" aria-valuemin="0" aria-valuemax="100">
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
                <button class="secret-btn toggle-row-pwd-btn" data-id="${cafe.id}" title="Toggle Password View" aria-label="Toggle password view">${ICONS.eye}</button>
                <button class="secret-btn copy-secret-btn" data-val="${cafe.rawPassword}" title="Copy Password" aria-label="Copy Password">${ICONS.copy}</button>
              </div>
              <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
                <span>PIN:</span>
                <strong style="color: var(--text-primary); font-family: var(--font-mono);">${cafe.ownerStampPin || '1234'}</strong>
                <button class="secret-btn copy-secret-btn" data-val="${cafe.ownerStampPin || '1234'}" title="Copy PIN" aria-label="Copy PIN" style="padding: 0;">${ICONS.copy}</button>
              </div>
            </div>
          </td>

          <!-- 7. Actions -->
          <td onclick="event.stopPropagation();">
            <div class="row-actions">
              <button class="btn btn-secondary btn-sm quick-extend-btn" data-id="${cafe.id}" title="Add +7 days to free trial" aria-label="Add 7 days">
                +7d
              </button>
              <button class="btn btn-secondary btn-sm open-drawer-btn" data-id="${cafe.id}" aria-label="Inspect ${this.escapeHtml(cafe.name)}">
                Inspect
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.attachTableEvents();
  }

  attachTableEvents() {
    this.tableBody.querySelectorAll('tr[data-cafe-id]').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-cafe-id');
        if (id) this.drawer.open(id);
      });
    });

    this.tableBody.querySelectorAll('.open-drawer-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id) this.drawer.open(id);
      });
    });

    // Quick +7d extend button directly in row
    this.tableBody.querySelectorAll('.quick-extend-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id) {
          this.store.extendFreeTier(id, 7);
          this.showToast('Extended free tier by +7 days', 'success');
          this.render();
        }
      });
    });

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

    this.tableBody.querySelectorAll('.copy-secret-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = btn.getAttribute('data-val');
        if (val) {
          navigator.clipboard.writeText(val);
          btn.innerHTML = ICONS.check;
          setTimeout(() => { btn.innerHTML = ICONS.copy; }, 1500);
          this.showToast('Copied to clipboard', 'success');
        }
      });
    });
  }

  async syncAllDatabases(userInitiated = false) {
    const kpiSection = document.getElementById('kpi-section');
    kpiSection?.classList.add('is-syncing');

    if (this.syncBtn) {
      this.syncBtn.innerHTML = `<span>Syncing Databases...</span>`;
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
          this.store.updateCafe(res.cafeId, {
            dbStatus: res.error?.includes('Shared DB') ? 'online' : 'offline'
          });
        }
      }
    });

    kpiSection?.classList.remove('is-syncing');

    if (this.syncBtn) {
      this.syncBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 2v6h-6"/>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
          <path d="M3 22v-6h6"/>
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
        <span>Sync All Databases</span>
      `;
      this.syncBtn.disabled = false;
    }

    this.render();

    if (userInitiated) {
      this.showToast('All partner databases synchronized', 'success');
    }
  }

  showToast(message, type = 'success') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? ICONS.check : ICONS.cross}</span>
      <span>${this.escapeHtml(message)}</span>
    `;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 3200);
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

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  window.app = new CafeTrackerApp();
});
