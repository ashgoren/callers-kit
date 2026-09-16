-- Normalizes DanceVersion out of the dances.versions jsonb array into its
-- own table, and folds walkthrough/cues in alongside figures/notes so every
-- part of "how to call this dance" belongs to one specific version rather
-- than being shared dance-wide.
create table "public"."dance_versions" (
  "id" text not null default gen_random_uuid()::text,
  "dance_id" text not null,
  "order" smallint not null,
  "label" text not null,
  "figures" jsonb not null default '[]'::jsonb,
  "notes" text,
  "walkthrough" text,
  "cues" jsonb,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);

alter table "public"."dance_versions" enable row level security;

-- Primary key
CREATE UNIQUE INDEX dance_versions_pkey ON public.dance_versions USING btree (id);
alter table "public"."dance_versions" add constraint "dance_versions_pkey" PRIMARY KEY using index "dance_versions_pkey";

-- FK index
CREATE INDEX ON public.dance_versions (dance_id);

alter table "public"."dance_versions" add constraint "dance_versions_dance_id_fkey" FOREIGN KEY (dance_id) REFERENCES dances(id) ON DELETE CASCADE not valid;
alter table "public"."dance_versions" validate constraint "dance_versions_dance_id_fkey";

-- Reuses the same trigger function already set up for dances.updated_at.
create trigger set_dance_versions_updated_at
before update on public.dance_versions
for each row
execute function public.set_updated_at();

-- Grants
grant delete on table "public"."dance_versions" to "anon";
grant insert on table "public"."dance_versions" to "anon";
grant references on table "public"."dance_versions" to "anon";
grant select on table "public"."dance_versions" to "anon";
grant trigger on table "public"."dance_versions" to "anon";
grant truncate on table "public"."dance_versions" to "anon";
grant update on table "public"."dance_versions" to "anon";

grant delete on table "public"."dance_versions" to "authenticated";
grant insert on table "public"."dance_versions" to "authenticated";
grant references on table "public"."dance_versions" to "authenticated";
grant select on table "public"."dance_versions" to "authenticated";
grant trigger on table "public"."dance_versions" to "authenticated";
grant truncate on table "public"."dance_versions" to "authenticated";
grant update on table "public"."dance_versions" to "authenticated";

grant delete on table "public"."dance_versions" to "postgres";
grant insert on table "public"."dance_versions" to "postgres";
grant references on table "public"."dance_versions" to "postgres";
grant select on table "public"."dance_versions" to "postgres";
grant trigger on table "public"."dance_versions" to "postgres";
grant truncate on table "public"."dance_versions" to "postgres";
grant update on table "public"."dance_versions" to "postgres";

grant delete on table "public"."dance_versions" to "service_role";
grant insert on table "public"."dance_versions" to "service_role";
grant references on table "public"."dance_versions" to "service_role";
grant select on table "public"."dance_versions" to "service_role";
grant trigger on table "public"."dance_versions" to "service_role";
grant truncate on table "public"."dance_versions" to "service_role";
grant update on table "public"."dance_versions" to "service_role";

-- RLS policy: no user_id of its own - scoped via join to the owning dance's
-- user_id, same pattern as dances_choreographers/programs_dances.
create policy "user_access"
on "public"."dance_versions"
as permissive
for all
using (exists (
  select 1 from dances
  where dances.id = dance_id
  and dances.user_id = (select auth.uid())
))
with check (exists (
  select 1 from dances
  where dances.id = dance_id
  and dances.user_id = (select auth.uid())
));

-- Backfill: one dance_versions row per entry in the existing dances.versions
-- array, in the same order, with the primary (first) version also picking
-- up the dance's current flat walkthrough/cues values - later versions get
-- neither, since there was never a separate walkthrough/cues per version
-- before now.
insert into "public"."dance_versions" (id, dance_id, "order", label, figures, notes, walkthrough, cues, created_at, updated_at)
select
  coalesce(version.value->>'id', gen_random_uuid()::text),
  dances.id,
  (version.ord - 1)::smallint,
  version.value->>'label',
  coalesce(version.value->'figures', '[]'::jsonb),
  version.value->>'notes',
  case when version.ord = 1 then dances.walkthrough else null end,
  case when version.ord = 1 then dances.cues else null end,
  dances.created_at,
  dances.updated_at
from "public"."dances"
cross join lateral jsonb_array_elements(dances.versions) with ordinality as version(value, ord);
