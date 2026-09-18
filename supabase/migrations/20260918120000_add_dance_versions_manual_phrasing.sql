-- A version's phrase (A1/A2/B1/B2) labels are ideally derived automatically
-- from a running beat total against a fixed per-dance-type skeleton, rather
-- than stored per figure. This column is the per-version escape hatch
-- for dances that don't follow a standard skeleton.
alter table "public"."dance_versions" add column "manual_phrasing" boolean not null default false;
