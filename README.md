# Pannel Dashboard

A mobile-first private dashboard for money tracking (IQD and USD), item inventory, and notes.

## Stack
- React + TypeScript + Vite
- Supabase Auth + PostgreSQL with Row Level Security
- Recharts and Lucide icons

## Setup
1. Install Node.js (current LTS) and run `npm install`.
2. Create a Supabase project.
3. Open the Supabase SQL Editor and run `supabase/schema.sql`.
4. Copy `.env.example` to `.env.local` and set your Supabase project URL and publishable key.
5. In Supabase Authentication settings, configure the allowed site URL and redirect URLs for your local and deployed app.
6. Run `npm run dev`. Use `npm run build` to check the production build.

## Security
- Never commit `.env.local`, database passwords, service-role keys, or other secrets.
- All user-owned tables must keep Row Level Security enabled.
- The app uses Supabase Auth; SQL policies restrict records to the authenticated owner.
- A public GitHub repository does not make the deployed app private. Set repository visibility to private if you want to keep source code private.
- Configure a strong account password and email confirmation in Supabase before storing real personal information.

## Currency
Each transaction stores its own currency (IQD or USD). Balances and summaries remain separated by currency; the app does not invent exchange rates or combine currencies into a misleading total.