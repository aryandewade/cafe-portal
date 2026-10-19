# Engiplex Cafe Tracker — Command Center

Multi-tenant loyalty card tracking portal, live database telemetry, and partner credentials dashboard.

---

## 🚀 Vercel Deployment Guide

This project is a high-performance, zero-build static single-page application (SPA). It deploys to Vercel in seconds with zero configuration required.

### Option 1: Automatic Deployment via Git (Recommended)

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Configure Vercel deployment"
   git push origin main
   ```
2. Open the [Vercel Dashboard](https://vercel.com/new).
3. Click **"Import Project"** and select **`aryandewade/cafe-portal`**.
4. Settings will be auto-detected from [`vercel.json`](./vercel.json):
   - **Framework Preset**: *Other*
   - **Build Command**: *None* (or `npm run build`)
   - **Output Directory**: `.` (root directory)
5. Click **Deploy**. Your command center is now live worldwide with instant edge caching!

---

### Option 2: Deploy from Terminal via Vercel CLI

Run the following command directly from this folder:

```bash
npx vercel
```

- When asked `Set up and deploy?`, press **Y**.
- Select your Vercel account/team.
- Link to existing project or create new: **Create new**.
- Project name: `cafe-portal` (or your choice).
- In which directory is your code located? `./`
- Want to modify these settings? **N**

To deploy directly to production:
```bash
npx vercel --prod
```

---

## 🛠 Local Development

To run locally using Bun:
```bash
bun start
```
Or with Node.js:
```bash
node dev-server.js
```
Then visit `http://localhost:5050`.

---

## 🔒 Security & Headers

The included [`vercel.json`](./vercel.json) configures:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- Cache-Control headers for CSS and JS assets
