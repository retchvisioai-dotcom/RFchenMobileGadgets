# MC Gadgets Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the live MC Gadgets Hub: public storefront, staff POS, owner Vault and reseller hub on one shared stock, fully separate from RF Chein.

**Architecture:** Static multi-page site (no framework, no Vercel build step) talking directly to a NEW Supabase project (Postgres + RLS, Auth, private Storage, Edge Functions, cron). Deployed from a NEW GitHub repo to a NEW Vercel project. Business rules live in SECURITY DEFINER RPCs; the front end only calls them.

**Tech Stack:** HTML/JS, Tailwind 3.4.17 (precompiled, committed), supabase-js 2.45.4 (vendored), html5-qrcode 2.3.8, qrcode-generator 1.4.4, Supabase SQL/pgcrypto/pg_cron, Playwright for tests.

**Spec:** `docs/superpowers/specs/2026-10-25-mc-gadgets-hub-design.md`

## Global Constraints

- Nothing shared with RF Chein: new repo, new Supabase project, new Vercel project; no RF branding, photos, stock, customers.
- All tables prefixed `mch_`; RLS enabled on every table; every SECURITY DEFINER function has `set search_path = public`.
- Sample units carry `is_sample = true` and display a visible "SAMPLE" label.
- Promo wording ("auto approved", "zero downpayment") appears only from `mch_settings.promo_line` when `promo_enabled`; installment copy always says "subject to approval".
- ID uploads: PRIVATE bucket `mch-ids`; rejected/withdrawn applications' IDs deleted after 30 days.
- Owner PIN: bcrypt via pgcrypto, 5 wrong tries → 15-minute lock.
- No keys, owner setup code, or PIN in the repo or in chat. Only the publishable Supabase key is in front-end code.
- Footer credit: "Developed by Retch Pornes". Builder explains each step to the user in plain language and stops for review after each phase.
- No runtime CDN dependencies; libs vendored under `/vendor`.

## Review Focus

- Anon calls table endpoints directly (not via RPC) → must get nothing private (cost, customer data, IDs).
- Same IMEI sold twice / two staff selling the same unit at once → exactly one succeeds, other gets a clear "already sold" error.
- Phone numbers typed as `0975…`, `+63975…`, or with spaces/dashes → normalized to one format; garbage rejected.
- Oversized or non-image ID upload (e.g. 20 MB PDF, .exe) → rejected with a friendly message.
- Spam: the same mobile submitting dozens of applications/waitlist entries → rate limited.
- Reservation never picked up → unit returns to available automatically after expiry.
- Owner PIN brute-force and a frozen staff terminal → both blocked server-side, not just hidden in UI.

---

## Phase 2 — Storefront (live)

### Task 1: Repo, Supabase project, Vercel project (BLOCKED until user frees a Supabase slot)

**Files:** Create `README.md`, `.gitignore`, `vercel.json` (clean URLs, security headers), `package.json` (dev deps only: tailwindcss, playwright).

**Interfaces:** Produces: repo `mc-gadgets-hub`, Supabase project `mc-gadgets-hub` (region Singapore), Vercel project `mc-gadgets-hub`, file `js/config.js` exporting `SUPABASE_URL`, `SUPABASE_KEY` (publishable only).

- [ ] **Step 1:** User confirms a free Supabase slot / upgrade. Create the GitHub repo (or user creates an empty one if the session scope refuses).
- [ ] **Step 2:** Create Supabase project; fetch URL + publishable key via the Supabase tools; write `js/config.js`.
- [ ] **Step 3:** Vendor libs into `/vendor` via npm; build `css/tw.css` with local Tailwind CLI.
- [ ] **Step 4:** Create the Vercel project from the repo; deploy a placeholder `index.html`; Run: open the production URL. Expected: placeholder loads (200).
- [ ] **Step 5:** Commit and push.

### Task 2: Core schema + RLS (branches, settings, lenders, products, units)

**Files:** Create `db/001_core.sql`, `db/tests/001_core_rls.sql`.

**Interfaces:** Produces: tables `mch_branches`, `mch_settings`, `mch_lenders`, `mch_products`, `mch_units`; view `mch_public_units` (no `cost`, no `imei`); function `mch_role() returns text`.

- [ ] **Step 1: Write failing test** `001_core_rls.sql` (rolled-back transaction): as `anon`, `select cost from mch_units` raises permission denied; `select * from mch_public_units` returns only `status='available'` rows; anon `insert into mch_units` fails.
- [ ] **Step 2:** Run via `execute_sql`. Expected: FAIL (tables missing).
- [ ] **Step 3:** Write `001_core.sql` per spec §5 with column-level grants for anon, RLS policies, and seed `mch_branches` (7 rows from spec §9; Hinigaran and Downtown `coming_soon`; San Carlos flagged "address to confirm") and default `mch_settings` (`promo_enabled=false`, contact info). Apply with `apply_migration`.
- [ ] **Step 4:** Re-run test. Expected: PASS. Run `get_advisors` (security); expected: no ERROR items.
- [ ] **Step 5:** Commit.

### Task 3: Sample stock

**Files:** Create `db/002_sample_stock.sql`, `assets/products/*.svg` (neutral generic phone illustrations, made by us).

**Interfaces:** Consumes: Task 2 tables. Produces: ≥24 units across all 5 categories and 5 open branches, each `is_sample=true`.

- [ ] **Step 1:** Test: `select count(*) from mch_units where is_sample` ≥ 24 and `count(distinct category)` = 5.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Write/apply seed (invented IMEIs prefixed `SAMPLE-`, no real photos). **Step 4:** Re-run; expected PASS. **Step 5:** Commit.

### Task 4: Storefront page

**Files:** Create `index.html`, `js/store.js`, `js/api.js`, `css/app.css`, `assets/logo.svg`, `tests/store.spec.js`.

**Interfaces:** Consumes: `mch_public_units`, `mch_branches`, `mch_settings`. Produces: `api.listUnits({branch, category, q, sort}) → Unit[]`, `api.listBranches()`, `api.getSettings()`.

- [ ] **Step 1: Write failing Playwright test** `store.spec.js`: loads home on 390px width; asserts ≥1 card with "SAMPLE" badge; selecting branch "Silay" shows only Silay units; category "iPhone" filters; price sort ascending is non-decreasing; search "iphone" narrows; no promo text visible while `promo_enabled=false`; page has no horizontal scroll.
- [ ] **Step 2:** Run `npx playwright test tests/store.spec.js`; expected FAIL.
- [ ] **Step 3:** Implement page + `store.js` (lazy images, debounce search). Brand colors purple/royal blue on white; footer "Developed by Retch Pornes".
- [ ] **Step 4:** Run; expected PASS. **Step 5:** Commit.

### Task 5: Reserve, branch finder, privacy notice, public lookups

**Files:** Create `db/003_public_rpcs.sql`, `js/reserve.js`, `branches.html`, `privacy.html`, `warranty.html`, `tests/reserve.spec.js`, `db/tests/003_rpcs.sql`.

**Interfaces:** Produces RPCs: `mch_reserve_unit(p_unit uuid, p_name text, p_mobile text, p_consent boolean) returns uuid`; `mch_normalize_mobile(text) returns text` (E.164 `+639XXXXXXXXX` or raises); `mch_warranty_lookup(p_imei text) returns table(model text, status text, ends date)`; `mch_expire_reservations()` (cron every 10 min, 24h hold).

- [ ] **Step 1: Write failing tests:** SQL — `mch_normalize_mobile('0975 742-5456') = '+639757425456'`, `'12345'` raises; reserving twice on the same unit second call raises "unavailable"; same mobile >3 reservations/day raises; expired reservation returns unit to `available`; warranty lookup returns no buyer name. Playwright — reserve form requires consent checkbox.
- [ ] **Step 2:** Run; expected FAIL. **Step 3:** Implement RPCs (row lock `for update` on unit), form, branch cards with Google Maps links and hours, DPA privacy page. **Step 4:** Run; expected PASS. **Step 5:** Commit.

### Task 6: Deploy and review gate for Phase 2

- [ ] **Step 1:** Push; deploy to Vercel production; add the new Vercel domain to Supabase redirect URLs.
- [ ] **Step 2:** Run the Playwright suite against the production URL; expected all PASS.
- [ ] **Step 3:** Show the user the live link + phone screenshots in plain language. **STOP for user review.**

---

## Phase 3 — Staff POS + installment applications

### Task 7: Auth, staff accounts, branch scoping

**Files:** Create `db/004_auth.sql`, `supabase/functions/create-user/index.ts`, `pos/index.html`, `js/auth.js`, `tests/pos_auth.spec.js`.

**Interfaces:** Produces: table `mch_profiles(user_id, role, branch_id, display_name, frozen)`; edge function `create-user` (`{email, password, role, branch_id, display_name}`; owner JWT only); `mch_role()`, `mch_branch()`; policy rule: staff rows limited to `mch_branch()`, frozen users get no access.

- [ ] **Step 1: Failing tests:** staff of Silay cannot select Bacolod sales; frozen staff gets empty results; non-owner calling `create-user` gets 403.
- [ ] **Step 2–4:** Run (FAIL) → implement → run (PASS). **Step 5:** Commit.

### Task 8: Record sale (atomic) + warranty + receipt

**Files:** Create `db/005_sales.sql`, `pos/sell.js`, `tests/sale.spec.js`, `db/tests/005_sales.sql`.

**Interfaces:** Produces: `mch_record_sale(p_unit uuid, p_method text, p_price numeric, p_name text, p_mobile text, p_release_consent boolean) returns uuid` (methods: cash|gcash|card|installment); creates warranty row (30 days).

- [ ] **Step 1: Failing tests:** selling an `available` unit sets status `sold`, creates warranty; second sale of same unit raises "already sold" (run two concurrent sessions); staff from another branch cannot sell it; storefront no longer lists it.
- [ ] **Step 2–5:** run FAIL → implement with `select … for update` → run PASS → commit. Add IMEI barcode scan input (html5-qrcode) with typed fallback.

### Task 9: Installment applications (customer form + staff review)

**Files:** Create `db/006_applications.sql`, `apply.html`, `js/apply.js`, `pos/applications.html`, `supabase/functions/upload-id/index.ts`, `tests/apply.spec.js`.

**Interfaces:** Produces: `mch_submit_application(p_unit uuid, p_lender uuid, p_name text, p_mobile text, p_income text, p_id_path text, p_consent boolean) returns uuid`; edge function `upload-id` returns signed upload URL (jpg/png/webp, ≤5 MB enforced server-side); `mch_set_application_status(p_id uuid, p_status text, p_notes text)`; cron `mch_purge_ids()` daily deleting ID objects for declined/withdrawn >30 days.

- [ ] **Step 1: Failing tests:** submit without consent raises; 20 MB file and `.exe` rejected by `upload-id`; anon cannot list bucket or read any ID object; staff reads via signed URL; staff of other branch cannot see the application; purge removes a 31-day-old declined application's file but not a 29-day-old one; form copy contains "subject to approval" and no promo text unless setting enabled; >3 applications/day per mobile rejected.
- [ ] **Step 2–5:** run FAIL → implement → PASS → commit.

### Task 10: Repairs, transfers, deploy gate

**Files:** Create `db/007_repairs_transfers.sql`, `pos/repairs.html`, `pos/transfers.html`, `track.html`, `tests/repairs.spec.js`.

**Interfaces:** Produces: `mch_log_repair(...)`, `mch_repair_status(p_code text) returns table(status text, updated_at timestamptz)` (no customer data); `mch_request_transfer(p_unit, p_to_branch)`, `mch_receive_transfer(p_id)`.

- [ ] **Step 1–5:** failing tests (tracker returns only status; transfer moves `branch_id` only after receive; unit unsellable while in transfer) → implement → pass → commit.
- [ ] **Step 6:** Deploy; **STOP for user review (Phase 3).**

---

## Phase 4 — Owner Vault

### Task 11: Owner claim, PIN, freeze

**Files:** Create `db/008_owner.sql`, `vault/index.html`, `js/vault.js`, `tests/owner.spec.js`.

**Interfaces:** Produces: `mch_claim_owner(p_code text, p_pin text) returns void` (setup code hash stored in DB at provisioning, set by the builder directly in Supabase — never in repo); `mch_check_pin(p_pin text) returns boolean`; `mch_freeze_user(p_user uuid, p_frozen boolean)`.

- [ ] **Step 1: Failing tests:** wrong code rejected; correct code works once, second claim raises; 5 wrong PINs → locked, 6th correct PIN still rejected until 15 min pass; staff cannot call `mch_freeze_user`; frozen staff loses access immediately.
- [ ] **Step 2–5:** run FAIL → implement → PASS → commit.

### Task 12: Reports and settings

**Files:** Create `db/009_reports.sql`, `vault/reports.html`, `vault/settings.html`.

**Interfaces:** Produces: `mch_sales_summary(p_from date, p_to date) returns table(branch text, day date, count int, total numeric)`; owner-only settings writes (promo line, payment accounts, lenders, branches/hours, Facebook URL); audit rows for every settings change.

- [ ] **Step 1: Failing tests:** staff cannot read `cost` or call summary for other branches; toggling `promo_enabled` + setting `promo_line` shows the line on the storefront, disabling hides it; every settings change appears in `mch_audit_log`.
- [ ] **Step 2–5:** run FAIL → implement → PASS → commit. **Step 6:** deploy; **STOP for user review (Phase 4).**

---

## Phase 5 — Reseller hub, waitlist, released wall, swap

### Task 13: Resellers and holds

**Files:** Create `db/010_resellers.sql`, `reseller/index.html`, `tests/reseller.spec.js`.

**Interfaces:** Produces: `mch_hold_unit(p_unit uuid, p_buyer text, p_hours int default 48)`; `mch_mark_payout(p_reseller uuid, p_amount numeric)` (owner only); holds auto-expire via the cron from Task 5.

- [ ] **Step 1–5:** failing tests (reseller sees only own holds; cannot hold a sold unit; expired hold frees the unit; payouts visible to that reseller and owner only) → implement → pass → commit.

### Task 14: Waitlist, released-today wall, swap estimate

**Files:** Create `db/011_community.sql`, `js/waitlist.js`, `js/released.js`, `swap.html`.

**Interfaces:** Produces: `mch_join_waitlist(p_branch uuid, p_name text, p_mobile text, p_consent boolean)` (coming-soon branches only, deduped per mobile+branch); view `mch_released_today` (first-name initial + model, only `release_consent=true` sales, last 24h); `mch_request_swap(p_model text, p_condition text, p_contact text)`.

- [ ] **Step 1: Failing tests:** wall exposes no full name, mobile, or price; sales without consent never appear; duplicate waitlist entry returns friendly "already on list"; waitlist on an open branch rejected.
- [ ] **Step 2–5:** run FAIL → implement → PASS → commit. **Step 6:** deploy; **STOP for user review (Phase 5).**

---

## Phase 6 — Final check and handover

### Task 15: Verification, deploy checklist, owner guide, blank stock CSV

**Files:** Create `docs/OWNER-GUIDE.md` (one page, plain language, exported to PDF), `docs/stock-template.csv` (headers: branch, category, brand, model, storage, color, condition, battery_pct, imei, price, photo_url), `docs/auth-email-setup.md`.

- [ ] **Step 1:** Run `superpowers:verification-before-completion`; run the full Playwright suite against production; expected all PASS. Run Supabase advisors (security + performance); expected no ERROR items.
- [ ] **Step 2:** Run `engineering:deploy-checklist`; fix findings.
- [ ] **Step 3:** Confirm every Review Focus line has a passing test; list any that does not.
- [ ] **Step 4:** Deliver owner guide + CSV; document email Option A now and Option B (Resend + domain) for later. Confirm open items from spec §11 with the user.
- [ ] **Step 5:** After user OK only: remove the MC preview and `mc-gadgets` alias from RF Chein. Nothing is deleted without explicit approval.
