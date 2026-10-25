# Database notes

The schema lives in the Supabase project's migration history (not duplicated here):
`mch_001_core`, `mch_002_sample_stock`, `mch_003_staff_sales_applications`, `mch_004_fix_null_role_checks`, `mch_005_fix_id_read_policy` (applied as `mch_ids_read_v2`).

- Every MC table and function is prefixed `mch_`. Other apps in this Supabase project are not touched.
- Customer ID photos: private bucket `mch-ids` (5 MB, JPG/PNG/WebP). Only the branch's staff and the owner can read them.
- Known cleanup: the unused policy `mch_ids_read` on `storage.objects` (matches nothing) can be dropped when convenient.
- Phase 4 (owner PIN, owner-only settings/stock/people, reports) was applied directly as SQL, not through migration history. Edge functions: `mch-create-user`, `mch-purge-ids` (deletes IDs of declined/withdrawn applications 30 days after the decision, plus unused uploads; runs whenever the owner opens the Vault).
- Not built yet: a "remove sample stock" button (needs a DELETE; to be done with the owner present).
