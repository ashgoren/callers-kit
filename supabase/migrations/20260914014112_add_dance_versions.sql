-- Replaces figures/calling_figures/notes (for the new app only - those three
-- columns are left untouched for the legacy app) with a single ordered list
-- of named versions, each carrying its own figures and notes. The first
-- entry in the array is always the dance's primary version.
alter table "public"."dances"
  add column "versions" jsonb not null default '[]'::jsonb;

-- Backfill: the existing figures/notes become the primary ("Choreography")
-- version; calling_figures, when present, becomes a second ("Calling")
-- version seeded with the same notes, since there's only one notes value to
-- copy from before anyone's had a chance to diverge the two.
update "public"."dances"
set versions = (
  select jsonb_agg(v.value order by v.ord)
  from (
    select
      1 as ord,
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'label', 'Choreography',
        'figures', figures,
        'notes', notes
      ) as value
    union all
    select
      2 as ord,
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'label', 'Calling',
        'figures', calling_figures,
        'notes', notes
      ) as value
    where calling_figures is not null
  ) v
);
