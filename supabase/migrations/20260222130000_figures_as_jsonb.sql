-- Replace figures table with a jsonb column on dances
drop table if exists "public"."figures";

alter table "public"."dances" add column "figures" jsonb not null default '[]'::jsonb;
