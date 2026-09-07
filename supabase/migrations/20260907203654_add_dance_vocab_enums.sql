-- Replaces dance_type_id/formation_id/progression_id (FKs into the
-- dance_types/formations/progressions lookup tables) with plain enum columns
-- for the new app. These three vocabularies are fixed, admin-managed-only.

create type "public"."dance_type" as enum (
  'Contra',
  'Square',
  'ECD',
  'Mixer',
  'Other'
);

create type "public"."formation" as enum (
  'Duple Minor - Improper',
  'Duple Minor - Becket',
  'Duple Minor - Becket CCW',
  'Duple Minor',
  'Duple Minor - Proper',
  'Duple Minor - Indecent',
  'Duple Minor - Reverse progression improper',
  'Duple Minor - Progressed improper',
  'Duple Minor - Cross',
  'Duple Minor - Other',
  'Triple Minor',
  'Three Facing Three',
  'Four Facing Four',
  'Solo',
  'Singlet',
  'Doublet',
  'Triplet',
  'Quadruplet',
  'Longways: 5+ couples',
  'Other Longways',
  'Circle Mixer',
  'Circle of Threesomes',
  'Sicilian Circle',
  'Scatter Mixer',
  'Grid Contra',
  'Grid Square',
  'Zia',
  'other'
);

create type "public"."progression" as enum (
  'Single',
  'Double',
  'Triple',
  'None',
  'Other'
);

alter table "public"."dances"
  add column "dance_type" public.dance_type,
  add column "formation" public.formation,
  add column "progression" public.progression;

CREATE INDEX ON public.dances (dance_type);
CREATE INDEX ON public.dances (formation);
CREATE INDEX ON public.dances (progression);

-- Backfill from the existing FK + lookup-table joins, matching on name —
-- the enum labels above were copied verbatim from each table's current rows
-- (plus the new 'Square' value, which has no existing rows to backfill).
update public.dances d
set dance_type = dt.name::public.dance_type
from public.dance_types dt
where d.dance_type_id = dt.id;

update public.dances d
set formation = f.name::public.formation
from public.formations f
where d.formation_id = f.id;

update public.dances d
set progression = p.name::public.progression
from public.progressions p
where d.progression_id = p.id;
