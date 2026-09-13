-- Tracks when a program row was last modified. Set via trigger rather than app code.
alter table "public"."programs"
  add column "updated_at" timestamp with time zone not null default now();

-- Reuses the same set_updated_at() function already defined for dances
-- (20260907203620_add_dances_updated_at.sql) - it's generic, not table-specific.
create trigger set_programs_updated_at
before update on public.programs
for each row
execute function public.set_updated_at();
