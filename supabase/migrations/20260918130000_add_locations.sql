-- Replaces programs.location (freeform text) with a proper locations table.
create table "public"."locations" (
  "id" text not null default gen_random_uuid()::text,
  "created_at" timestamp with time zone not null default now(),
  "name" text not null,
  "user_id" uuid not null default auth.uid()
);

alter table "public"."locations" enable row level security;

-- Primary key
CREATE UNIQUE INDEX locations_pkey ON public.locations USING btree (id);
alter table "public"."locations" add constraint "locations_pkey" PRIMARY KEY using index "locations_pkey";

-- Unique name per user
CREATE UNIQUE INDEX locations_name_user_key ON public.locations USING btree (name, user_id);
alter table "public"."locations" add constraint "locations_name_user_key" UNIQUE using index "locations_name_user_key";

-- FK index
CREATE INDEX ON public.locations (user_id);

alter table "public"."locations" add constraint "locations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."locations" validate constraint "locations_user_id_fkey";

-- Grants
grant delete on table "public"."locations" to "anon";
grant insert on table "public"."locations" to "anon";
grant references on table "public"."locations" to "anon";
grant select on table "public"."locations" to "anon";
grant trigger on table "public"."locations" to "anon";
grant truncate on table "public"."locations" to "anon";
grant update on table "public"."locations" to "anon";

grant delete on table "public"."locations" to "authenticated";
grant insert on table "public"."locations" to "authenticated";
grant references on table "public"."locations" to "authenticated";
grant select on table "public"."locations" to "authenticated";
grant trigger on table "public"."locations" to "authenticated";
grant truncate on table "public"."locations" to "authenticated";
grant update on table "public"."locations" to "authenticated";

grant delete on table "public"."locations" to "postgres";
grant insert on table "public"."locations" to "postgres";
grant references on table "public"."locations" to "postgres";
grant select on table "public"."locations" to "postgres";
grant trigger on table "public"."locations" to "postgres";
grant truncate on table "public"."locations" to "postgres";
grant update on table "public"."locations" to "postgres";

grant delete on table "public"."locations" to "service_role";
grant insert on table "public"."locations" to "service_role";
grant references on table "public"."locations" to "service_role";
grant select on table "public"."locations" to "service_role";
grant trigger on table "public"."locations" to "service_role";
grant truncate on table "public"."locations" to "service_role";
grant update on table "public"."locations" to "service_role";

-- RLS policy: owner table with its own user_id column, same pattern as
-- choreographers/key_moves/vibes.
create policy "user_access"
on "public"."locations"
as permissive
for all
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- programs.location_id: additive FK alongside the existing freeform
-- location text column. ON DELETE SET NULL rather than CASCADE - deleting a
-- location (a future management action, not built yet) should clear the
-- field on any program that used it, not delete the program itself.
ALTER TABLE programs ADD COLUMN location_id text REFERENCES public.locations(id) ON DELETE SET NULL;
CREATE INDEX ON public.programs (location_id);

-- Backfill: one locations row per distinct trimmed location value per user,
-- so existing programs get a real location_id instead of starting out all
-- null. Blank/whitespace-only location values are treated as no location.
insert into "public"."locations" (id, name, user_id)
select gen_random_uuid()::text, distinct_locations.name, distinct_locations.user_id
from (
  select distinct trim(programs.location) as name, programs.user_id as user_id
  from programs
  where programs.location is not null and trim(programs.location) <> ''
) distinct_locations;

update programs
set location_id = locations.id
from locations
where locations.user_id = programs.user_id
and locations.name = trim(programs.location)
and programs.location is not null
and trim(programs.location) <> '';
