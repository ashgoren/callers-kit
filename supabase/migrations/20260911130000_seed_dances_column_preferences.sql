-- Backfill: idempotent
INSERT INTO user_table_preferences (id, user_id, table_name)
SELECT gen_random_uuid()::text, id, 'dances'
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM user_table_preferences
  WHERE user_table_preferences.user_id = auth.users.id
  AND user_table_preferences.table_name = 'dances'
);

-- Going forward: seed the same row at signup, for every new account.
--
-- security definer + a pinned search_path since this runs during Supabase
-- Auth's own signup flow (as whatever role performs the auth.users insert),
-- not as the signing-up user - it needs to write to public.user_table_preferences
-- under the function owner's privileges, not the caller's.
create or replace function public.seed_dances_column_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_table_preferences (id, user_id, table_name)
  values (gen_random_uuid()::text, new.id, 'dances');
  return new;
end;
$$;

create trigger seed_dances_column_preferences
after insert on auth.users
for each row
execute function public.seed_dances_column_preferences();
