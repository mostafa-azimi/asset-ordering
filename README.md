# ProcureFlow (asset-ordering)

A financial **checks-and-balances** app for order requests. Every purchase moves through four validated checkpoints — **Requested → Approved → Delivered → Paid** — with a full audit trail and document uploads at each step. Data is stored in **Supabase** (Postgres + Storage), so it's shared across everyone who uses the app.

## What it does

- **Request** something to order (item, vendor, quantity, cost, justification).
- **Approve** the request in one click — authorizing the spend.
- **Validate delivery** — confirm the goods/services arrived.
- **Validate payment** — confirm the invoice was paid, closing the loop.
- **Upload** what needs to be ordered (quotes, specs, POs) and **upload receipts / delivery confirmations** — stored in Supabase Storage.
- Full **audit trail** on every order (who moved it, when).
- **Dark & light mode**, responsive, keyboard-friendly.

## Tech

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Supabase** — Postgres tables (`orders`, `attachments`) and a public Storage bucket (`attachments`) via `@supabase/supabase-js`.

## Environment variables

Set these locally in `.env.local` and in Vercel → Project → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

## Database setup

Run `supabase-schema.sql` in the Supabase SQL Editor. It creates the `orders` and `attachments` tables plus the public `attachments` storage bucket.

> Access model: the app has no login and uses the public anon key for reads and writes, so Row Level Security is intentionally left OFF. This is appropriate for an internal tool. If you later add Supabase Auth, enable RLS and add per-user policies.

## Run locally

```bash
npm install
cp .env.local.example .env.local   # fill in your values
npm run dev                          # http://localhost:3000
```

## Deploy to Vercel

1. Import this repo on [vercel.com](https://vercel.com) → Add New → Project.
2. Add the two environment variables above.
3. Deploy. Next.js is auto-detected; nothing else to configure.

## Project structure

```
app/
  layout.tsx        # theme bootstrap, metadata
  page.tsx          # dashboard, new-request + detail modals, workflow logic
  globals.css       # design system (dark/light via CSS variables)
components/
  Icons.tsx         # inline SVG icon set
  Dropzone.tsx      # drag-and-drop upload area
lib/
  types.ts          # Order model, stages, formatting helpers
  supabaseClient.ts # Supabase client + bucket name
  storage.ts        # all reads/writes against Supabase (DB + Storage)
```
