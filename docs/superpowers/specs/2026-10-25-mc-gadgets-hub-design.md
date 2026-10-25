# MC Gadgets Hub — Design Spec

Date: 2026-10-25 · Status: DRAFT for owner/freelancer review · Builder credit: "Developed by Retch Pornes"

## 1. Purpose
One live web system for MC Gadgets (Negros Occidental, PH): a public mobile-first storefront, a staff POS, an owner Vault, and a reseller hub, all on one shared live stock.

**Separation rule (hard):** MC Gadgets Hub shares NOTHING with RF Chein Gadgets: new GitHub repo, new Supabase project, new Vercel project, no RF branding, photos, stock or customers. Sample data is invented and labeled "SAMPLE".

## 2. Brand
Purple + royal blue on white; "MC GADGETS" apple-style badge logo (recreated as SVG, no RF assets). Tagline "Quality gadgets • Affordable prices • Trusted service". Slogan "Your gadget, your way!". Contacts, social links and the Facebook URL are owner-editable settings (Facebook URL unconfirmed: `joycecellphones` vs `MCGadgetsPH`).

## 3. Roles
| Role | Login | Can do |
|---|---|---|
| Customer | none | browse, reserve, apply for installment, join waitlist, check warranty/repair status |
| Staff | email+password, tied to one branch | POS sales, stock at own branch, review applications, log repairs, request transfers |
| Reseller | email+password | hold units for buyers, see own holds and payouts |
| Owner | email+password + PIN | everything, incl. settings, staff/reseller accounts, freeze terminals |

Owner account is claimed once with a one-time setup code + PIN. The code is delivered to the owner out-of-band and is never stored in the repo or in chat.

## 4. Architecture
- Static multi-page site, no framework, no build step on Vercel: `index.html` (storefront), `/pos/`, `/vault/`, `/reseller/`, plus info/track pages.
- Tailwind precompiled locally and committed; vendored libs (supabase-js 2.45.4, html5-qrcode 2.3.8, qrcode-generator 1.4.4). No runtime CDN dependency.
- Supabase: Postgres + RLS on every table, Auth, private Storage, Edge Functions, scheduled jobs.
- Vercel: new project, deployed from the new GitHub repo.
- Fast on cheap phones: small pages, lazy images, paginated lists.

## 5. Data model (all tables prefixed `mch_`, RLS on)
- `branches` (name, address, hours, maps_url, status: open | coming_soon, phone)
- `settings` (single row of owner-editable key/values: promo_line, promo_enabled, contact, social links, payment accounts, lenders, hold flags)
- `lenders` (name, requirements text, active)
- `profiles` (user id, role, branch_id, display_name, frozen)
- `products` (brand, model, category: iphone|android|laptop|printer|accessory, description)
- `units` (product, branch, condition sealed|pre-owned, battery_pct, storage, color, imei, price, cost [private], status available|reserved|sold|transfer, photo paths, is_sample)
- `reservations` (unit, name, mobile, expires_at, status)
- `sales` (unit, branch, staff, method cash|gcash|card|installment, price, customer name/mobile, released_consent, reseller_id nullable)
- `applications` (unit, lender, name, mobile, income_source, id_path [private], consent_at, status new|reviewing|approved|declined|withdrawn, notes, decided_at)
- `waitlist` (branch, name, mobile, consent_at)
- `repairs` (code, device, issue, status, branch, customer mobile)
- `warranties` (sale, imei, starts, ends)
- `swap_requests` (model, condition, contact, estimate shown, status)
- `transfers` (unit, from_branch, to_branch, status, by)
- `resellers` / `holds` / `payouts`
- `pin_state` (owner PIN hash via pgcrypto bcrypt, attempt count, lock-until)
- `audit_log` (who, action, when)

## 6. Security & privacy rules
- RLS on every table. Anonymous users: read-only on a column-restricted public view of available units, branches, settings (public keys only), lenders; insert-only through SECURITY DEFINER RPCs (reserve, apply, waitlist, swap) with rate limiting and input validation; warranty and repair lookups return minimal fields (no buyer name).
- `cost`, customer details, IDs: staff/owner only; cost is owner only.
- Staff see only their branch's sales and applications; owner sees all.
- ID photos: PRIVATE bucket, signed upload URL for customers, signed read URLs for staff/owner only, short expiry.
- Applications declined or withdrawn: ID files auto-deleted after 30 days by a scheduled job; approved/completed applications follow an owner-set retention.
- Data Privacy Act (PH) notice and explicit consent checkbox before any personal data or ID is collected; consent time recorded.
- "Released today" wall shows only first-name initial + unit and only for sales flagged with customer consent.
- Owner PIN: 5 wrong tries → 15-minute lock. Owner can freeze any staff terminal.
- Promo claims ("auto approved", "zero downpayment", etc.) render only from `settings.promo_line` when `promo_enabled`; nothing hard-coded. Installment copy always says "subject to approval".
- No keys or setup code in the repo. Only the public (publishable) Supabase key is in the front end; secrets live in Supabase/Vercel settings.

## 7. Auth & email
Default (Option A): "Confirm email" off; no customer accounts; the owner creates staff and reseller accounts through an Edge Function; owner password reset via Supabase dashboard. Option B (later): custom SMTP (e.g. Resend) with a verified domain such as `mcgadgets.ph`, enabling confirmation and self-service reset. Add the new Vercel domain to Supabase redirect URLs before launch.

## 8. Features per page
- **Storefront:** live stock grid (photo, price, condition, battery %, storage, color, branch), filters (branch, category), price sort, search; reserve for pickup; installment pre-application; walk-in installment requirements; swap/trade-in estimate; branch finder (hours + Maps); coming-soon waitlist (Hinigaran, Bacolod Downtown); released-today wall; warranty by IMEI; repair tracker; privacy notice.
- **POS:** scan/enter IMEI, cart, record sale (cash/GCash/card/installment), receipt, 30-day warranty start, stock live everywhere; applications queue; repair log; transfers between branches.
- **Vault:** sales by branch/day, installment pipeline, waitlist counts, staff/reseller management, settings (promo line, payment accounts, lenders, branches, hours), freeze terminals, audit log.
- **Reseller hub:** hold unit for a buyer (expires), see holds and payouts.

## 9. Branches (to be confirmed by owner; editable in Vault)
1 Bacolod 1 "Mobile Hub" — GT 888 Chinatown Square Ph.2, ground floor, in front of Mr. DIY, 10–8 · 2 Bacolod 2 — GT 888 Chinatown Square Ph.1, 10–8 · 3 Kabankalan — Gaisano Grand, ground floor, beside Western Union, 8–8 · 4 Silay — Baldevia Bldg., Rizal cor. Burgos St., 8–7 · 5 San Carlos — address TO CONFIRM (poster: JUSA Bldg., Valdivia cor. V.F. Gustilo St., Brgy. IV, 9–6:30, unverified) · Coming soon: Hinigaran (front of Puregold), Bacolod Downtown (Fairmart).

## 10. Phases (stop and show the user after each)
1. **Plan + data model** (this spec and the plan).
2. **Storefront + sample stock, live on Vercel.** Done when: site loads on a phone, filters/search work, a reservation and a test application land in the DB, anon cannot read private data (tested), ID bucket is private. *Blocked until a Supabase project slot is free.*
3. **Staff POS + applications.** Done when: staff login scoped to branch, sale removes stock instantly everywhere, applications reviewable, ID viewable only by staff/owner.
4. **Owner Vault + settings + setup code.** Done when: owner claims account, PIN lockout works, promo line change reflects on the storefront, freeze works.
5. **Reseller hub, waitlist, released wall.**
6. **Final check:** `verification-before-completion` + `deploy-checklist`, one-page owner guide, blank stock CSV.

## 11. Assumptions / open items
- Supabase upgrade or free slot (user will do).
- Official Facebook URL, final domain, branch addresses/hours, lenders list, and who receives the owner setup code: to confirm with the owner.
- Hub address = the Vercel address for now. The old `mc-gadgets.vercel.app` alias and MC preview in the RF Chein site are removed later with the user's OK (nothing deleted without asking).
- Legal wording for installment (Recto Law) needs a lawyer's review; the system only collects pre-applications and never promises approval.

## 12. Out of scope (for now)
Online payments, customer accounts, SMS/Messenger sending, automatic Facebook posting, native mobile app.
