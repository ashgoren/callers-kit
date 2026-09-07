-- Tracks when a dance row was last modified. Set via trigger rather than app code.
alter table "public"."dances"
  add column "updated_at" timestamp with time zone not null default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_dances_updated_at
before update on public.dances
for each row
execute function public.set_updated_at();
