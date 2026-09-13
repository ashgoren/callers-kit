-- Backfill: idempotent
INSERT INTO user_table_preferences (id, user_id, table_name)
SELECT gen_random_uuid()::text, id, 'programs'
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM user_table_preferences
  WHERE user_table_preferences.user_id = auth.users.id
  AND user_table_preferences.table_name = 'programs'
);

-- The old trigger/function only seeded a 'dances' row - replaced here with a
-- generically named one that seeds every synced table's column-preferences
-- row at signup, now that programs needs one too.
drop trigger seed_dances_column_preferences on auth.users;
drop function public.seed_dances_column_preferences();

create or replace function public.seed_table_column_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_table_preferences (id, user_id, table_name)
  values
    (gen_random_uuid()::text, new.id, 'dances'),
    (gen_random_uuid()::text, new.id, 'programs');
  return new;
end;
$$;

create trigger seed_table_column_preferences
after insert on auth.users
for each row
execute function public.seed_table_column_preferences();
