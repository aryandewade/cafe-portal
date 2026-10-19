/* ==========================================================================
   ENGIPLEX CAFE TRACKER — REAL-TIME DATABASE SERVICE
   Direct REST Client for Supabase Multi-Tenant Connections
   ========================================================================== */

export class DatabaseService {
  /**
   * Test connection and retrieve live row counts from a specific Supabase instance
   * Uses low-overhead exact-count headers (no heavy payload transfer).
   */
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
      // 1. Fetch exact customer count from 'users' table
      const usersPromise = fetch(`${cleanUrl}/rest/v1/users?select=id`, {
        method: 'GET',
        headers: {
          'apikey': apiKey.trim(),
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Range': '0-0',
          'Prefer': 'count=exact'
        }
      });

      // 2. Fetch exact transaction count from 'transactions' table
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
        error = `HTTP ${usersRes.value.status}: ${errorText || 'Authentication Failed'}`;
      } else {
        error = usersRes.reason?.message || 'Network connection failed';
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

  /**
   * Sync metrics across all active cafes in parallel
   */
  static async syncAll(cafes, onProgress) {
    const results = [];
    const tasks = cafes.map(async (cafe, idx) => {
      // If cafe is in shared mode with no dedicated credentials, use default platform DB
      const targetUrl = cafe.database?.url;
      const targetKey = cafe.database?.apiKey;

      if (!targetUrl || !targetKey) {
        results[idx] = {
          cafeId: cafe.id,
          ok: false,
          error: 'Shared DB configured; standalone sync skipped',
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
