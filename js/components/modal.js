/* ==========================================================================
   ENGIPLEX CAFE TRACKER — ONBOARDING MODAL COMPONENT
   Collects cafe details, credentials, trial duration, and database keys
   ========================================================================== */

import { DatabaseService } from '../db-service.js';

export class OnboardingModal {
  constructor(store, onCafeAdded, showToast) {
    this.store = store;
    this.onCafeAdded = onCafeAdded;
    this.showToast = showToast;
    this.modalEl = document.getElementById('onboard-modal');
    this.dbMode = 'dedicated_supabase'; // or 'shared_platform'
    this.initEvents();
  }

  initEvents() {
    // Close button
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('modal-cancel-btn')?.addEventListener('click', () => this.close());

    // Backdrop click
    this.modalEl?.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    // DB Mode Switchers
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

    // Auto-generate Password
    document.getElementById('gen-pwd-btn')?.addEventListener('click', () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
      let pwd = 'CP_';
      for (let i = 0; i < 10; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const pwdInput = document.getElementById('new-cafe-password');
      if (pwdInput) pwdInput.value = pwd;
    });

    // Test DB connection button inside modal
    document.getElementById('test-modal-db-btn')?.addEventListener('click', async () => {
      const url = document.getElementById('new-supabase-url')?.value;
      const key = document.getElementById('new-supabase-key')?.value;
      const statusPill = document.getElementById('modal-db-status');

      if (!url || !key) {
        if (statusPill) {
          statusPill.innerHTML = '<span style="color: var(--accent-ruby)">✕ Please enter both Supabase URL & Key</span>';
        }
        return;
      }

      if (statusPill) {
        statusPill.innerHTML = '<span style="color: var(--accent-gold)">⚡ Pinging Supabase REST API...</span>';
      }

      const res = await DatabaseService.pingDatabase(url, key);
      if (res.ok) {
        if (statusPill) {
          statusPill.innerHTML = `<span style="color: var(--accent-emerald)">✓ Connected! Found ${res.customerCount} customers (${res.latency}ms)</span>`;
        }
        this.showToast(`Supabase Connection Verified! Found ${res.customerCount} users.`, 'success');
      } else {
        if (statusPill) {
          statusPill.innerHTML = `<span style="color: var(--accent-ruby)">✕ Connection Failed: ${res.error || 'Network error'}</span>`;
        }
        this.showToast(`Connection error: ${res.error}`, 'error');
      }
    });

    // Form Submit
    document.getElementById('onboard-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
  }

  open() {
    this.resetForm();
    this.modalEl?.classList.add('active');
  }

  close() {
    this.modalEl?.classList.remove('active');
  }

  resetForm() {
    const form = document.getElementById('onboard-form');
    if (form) form.reset();
    const statusPill = document.getElementById('modal-db-status');
    if (statusPill) statusPill.innerHTML = '';
    
    // Auto-generate strong initial password
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
      alert('Please fill out the required cafe and owner information.');
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

    this.showToast(`🎉 "${name}" onboarded with a ${trialDays}-day free tier!`, 'success');
    this.close();

    if (typeof this.onCafeAdded === 'function') {
      this.onCafeAdded(created);
    }
  }
}
