# RF Chein Gadgets — Stock, Rent-To-Own & Reseller Hub

Single-file web app (`index.html`) backed by Supabase and hosted on Vercel (no build step).

- Public: branch selector, live catalog, swap calculator, warranty check, repair tracker
- POS: sales, rent-to-own contracts, repairs, reseller holds
- Vault (owner): dashboard, stock, resellers/payouts, swaps, sales, audit log, settings

Live: https://rfchen-gadgets.vercel.app

Backend: Supabase tables prefixed `mcg_` with Row Level Security and RPCs.
The Supabase publishable key in `index.html` is public by design; no secrets are stored here.
Demo units (IMEI `DEMO-0001`..`DEMO-0010`) must be deleted before real use.
