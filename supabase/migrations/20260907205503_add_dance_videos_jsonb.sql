-- Replaces the dance_videos child table with a jsonb array directly on dances.

alter table "public"."dances"
  add column "videos" jsonb not null default '[]'::jsonb;

-- Backfill from the existing child rows.
update public.dances d
set videos = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object('url', dv.url, 'description', dv.description)
      order by dv.created_at
    )
    from public.dance_videos dv
    where dv.dance_id = d.id
  ),
  '[]'::jsonb
);
