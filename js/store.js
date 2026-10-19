/* ==========================================================================
   ENGIPLEX CAFE TRACKER — STATE STORE & PERSISTENCE
   Tracks cafes, credentials, free tier countdowns, and database connections
   ========================================================================== */

const STORAGE_KEY = 'engiplex_cafe_tracker_v1';

// Initial realistic seed data with Atelier's live Supabase project
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
    subscriptionStatus: 'trialing', // trialing, active, expiring, expired, suspended
    freeTierStart: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
    freeTierEnd: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),  // 18 days left (24 day trial)
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
    freeTierEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days left!
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
    freeTierEnd: new Date(Date.now() + 275 * 24 * 60 * 60 * 1000).toISOString(), // Annual plan
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
    freeTierEnd: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // Expired 4 days ago
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

export class CafeStore {
  constructor() {
    this.cafes = this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Could not read from localStorage, using initial seed data');
    }
    this.saveToStorage(INITIAL_CAFES);
    return INITIAL_CAFES;
  }

  saveToStorage(data = this.cafes) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save to localStorage');
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
    const trialDays = parseInt(newCafe.trialDays, 10) || 14;
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
      dbStatus: 'pending',
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

  extendFreeTier(id, extraDays = 14) {
    const cafe = this.getById(id);
    if (!cafe) return null;

    const currentEnd = new Date(cafe.freeTierEnd);
    const baseTime = currentEnd.getTime() > Date.now() ? currentEnd.getTime() : Date.now();
    const newEnd = new Date(baseTime + extraDays * 24 * 60 * 60 * 1000);

    cafe.freeTierEnd = newEnd.toISOString();
    cafe.totalTrialDays = (cafe.totalTrialDays || 14) + extraDays;
    
    // Auto-update status
    if (cafe.subscriptionStatus === 'expired') {
      cafe.subscriptionStatus = 'trialing';
    }

    this.saveToStorage();
    return cafe;
  }

  /**
   * Helper to compute trial status, days left, and progress percentage
   */
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
      label = `⚠️ ${daysRemaining} days left`;
    }

    return {
      status,
      daysRemaining,
      percentUsed,
      badgeClass,
      label
    };
  }

  /**
   * Calculate top dashboard metrics
   */
  getMetrics() {
    const totalCafes = this.cafes.length;
    let totalCustomers = 0;
    let expiringCount = 0;
    let activeSubscribers = 0;
    let onlineDbCount = 0;

    this.cafes.forEach(c => {
      totalCustomers += (c.cachedCustomerCount || 0);
      const trial = this.getTrialInfo(c);

      if (trial.status === 'expiring') {
        expiringCount++;
      } else if (trial.status === 'active') {
        activeSubscribers++;
      }

      if (c.dbStatus === 'online') {
        onlineDbCount++;
      }
    });

    return {
      totalCafes,
      totalCustomers,
      expiringCount,
      activeSubscribers,
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
