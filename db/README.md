# Database notes

The schema lives in the Supabase project's migration history (not duplicated here):
`mch_001_core`, `mch_002_sample_stock`, `mch_003_staff_sales_applications`, `mch_004_fix_null_role_checks`, `mch_005_fix_id_read_policy` (applied as `mch_ids_read_v2`).

- Every MC table and function is prefixed `mch_`. Other apps in this Supabase project are not touched.
- Customer ID photos: private bucket `mch-ids` (5 MB, JPG/PNG/WebP). Only the branch's staff and the owner can read them.
- Known cleanup: the unused policy `mch_ids_read` on `storage.objects` (matches nothing) can be dropped when convenient.
- Auto-deletion of declined/withdrawn applications' IDs after 30 days is wired up in Phase 4.
