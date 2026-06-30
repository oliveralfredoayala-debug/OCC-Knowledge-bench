# KB Create-inator

Internal tool for One Click Contractor ops/AM team to draft, generate, and manage Knowledge Base articles from Scribe HTML exports.

## What it does

- **Intake form** — fill in article metadata (title, category, audience, related articles, notes) and paste raw Scribe HTML
- **AI generation** — streams a Claude API call that strips Scribe branding and reformats into OCC-branded KB HTML
- **Reviewer panel** — locked behind a passcode; edit drafts, regenerate, mark reviewed, download as `.doc`, or copy HTML for SharePoint
- **Live library** — completed articles stored in browser localStorage

---

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
VITE_REVIEWER_PASS=occ
```

### 3. Run dev server

```bash
npm run dev
```

The Vite dev server proxies `/api` → the Vercel serverless function via `vite.config.js`.

> **Note:** For local dev with the API proxy, you'll need to run the API function separately or use `vercel dev` (see below).

### Option B — use Vercel CLI locally

```bash
npm install -g vercel
vercel dev
```

This runs everything together (Vite frontend + Edge Function) exactly as it will on Vercel.

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create kb-createinator --private --push
# or: git remote add origin https://github.com/YOUR_ORG/kb-createinator.git && git push -u origin main
```

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Framework preset: **Vite** (auto-detected)
4. Add environment variables:
   - `ANTHROPIC_API_KEY` → your key (server-side only, **not** prefixed with `VITE_`)
   - `VITE_REVIEWER_PASS` → your desired reviewer passcode

5. Click **Deploy**

### 3. Done

Vercel builds `dist/` from `vite build` and serves `/api/generate.js` as an Edge Function. The API key never touches the browser.

---

## Architecture

```
kb-createinator/
├── api/
│   └── generate.js        # Vercel Edge Function — Anthropic proxy (key stays server-side)
├── src/
│   ├── App.jsx             # Root — mode switcher (form / lock / review)
│   ├── main.jsx
│   ├── index.css
│   ├── constants.js        # Brand tokens, categories, REVIEWER_PASS from env
│   ├── useStorage.js       # localStorage hook (replaces window.storage)
│   ├── generateKB.js       # Streams /api/generate → onChunk / onDone / onError
│   ├── buildPrompt.js      # KB article prompt builder
│   └── components/
│       ├── UI.jsx          # Shared primitives (Inp, Sel, Ta, etc.)
│       ├── LockScreen.jsx
│       ├── IntakeForm.jsx
│       └── ReviewerPanel.jsx
├── index.html
├── vite.config.js
├── vercel.json
├── package.json
└── .env.example
```

## Environment variables reference

| Variable | Where | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel (server) | Anthropic API key — never sent to browser |
| `VITE_REVIEWER_PASS` | Vercel + `.env.local` | Reviewer panel passcode (default: `occ`) |

## Data storage

Articles and drafts are stored in **browser localStorage** under:
- `kb-drafts-v1` — pending/reviewed submissions
- `kb-completed-v1` — live/published articles

Data is per-browser. For a shared multi-user store, replace `useStorage.js` with a Vercel KV or Supabase integration.
