-- Per-user, per-table UI column layout (visibility, sorting, pinning,
-- order, and column widths), synced like any other owner table so it
-- follows a user across devices instead of living in localStorage. One row
-- per (user_id, table_name) - table_name identifies which app table's
-- layout is stored (e.g. 'dances', 'programs' later). column_state holds
-- the whole layout as one blob rather than a column per piece of state,
-- since it's UI-internal shape, not data that needs its own typed columns.
create table "public"."user_table_preferences" (
  "id" text not null default gen_random_uuid()::text,
  "user_id" uuid not null default auth.uid(),
  "table_name" text not null,
  "column_state" jsonb not null default '{}'::jsonb,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now()
);

alter table "public"."user_table_preferences" enable row level security;

-- Primary key
CREATE UNIQUE INDEX user_table_preferences_pkey ON public.user_table_preferences USING btree (id);
alter table "public"."user_table_preferences" add constraint "user_table_preferences_pkey" PRIMARY KEY using index "user_table_preferences_pkey";

-- One preferences row per user per table
CREATE UNIQUE INDEX user_table_preferences_user_table_key ON public.user_table_preferences USING btree (user_id, table_name);
alter table "public"."user_table_preferences" add constraint "user_table_preferences_user_table_key" UNIQUE using index "user_table_preferences_user_table_key";

-- FK index
CREATE INDEX ON public.user_table_preferences (user_id);

alter table "public"."user_table_preferences" add constraint "user_table_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."user_table_preferences" validate constraint "user_table_preferences_user_id_fkey";

-- Reuses the same trigger function already set up for dances.updated_at.
create trigger set_user_table_preferences_updated_at
before update on public.user_table_preferences
for each row
execute function public.set_updated_at();

-- Grants
grant delete on table "public"."user_table_preferences" to "anon";
grant insert on table "public"."user_table_preferences" to "anon";
grant references on table "public"."user_table_preferences" to "anon";
grant select on table "public"."user_table_preferences" to "anon";
grant trigger on table "public"."user_table_preferences" to "anon";
grant truncate on table "public"."user_table_preferences" to "anon";
grant update on table "public"."user_table_preferences" to "anon";

grant delete on table "public"."user_table_preferences" to "authenticated";
grant insert on table "public"."user_table_preferences" to "authenticated";
grant references on table "public"."user_table_preferences" to "authenticated";
grant select on table "public"."user_table_preferences" to "authenticated";
grant trigger on table "public"."user_table_preferences" to "authenticated";
grant truncate on table "public"."user_table_preferences" to "authenticated";
grant update on table "public"."user_table_preferences" to "authenticated";

grant delete on table "public"."user_table_preferences" to "postgres";
grant insert on table "public"."user_table_preferences" to "postgres";
grant references on table "public"."user_table_preferences" to "postgres";
grant select on table "public"."user_table_preferences" to "postgres";
grant trigger on table "public"."user_table_preferences" to "postgres";
grant truncate on table "public"."user_table_preferences" to "postgres";
grant update on table "public"."user_table_preferences" to "postgres";

grant delete on table "public"."user_table_preferences" to "service_role";
grant insert on table "public"."user_table_preferences" to "service_role";
grant references on table "public"."user_table_preferences" to "service_role";
grant select on table "public"."user_table_preferences" to "service_role";
grant trigger on table "public"."user_table_preferences" to "service_role";
grant truncate on table "public"."user_table_preferences" to "service_role";
grant update on table "public"."user_table_preferences" to "service_role";

-- RLS policy
create policy "user_access"
on "public"."user_table_preferences"
as permissive
for all
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
