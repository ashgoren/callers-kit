-- Set dance_type_id to Contra for all existing dances

update "public"."dances"
set dance_type_id = (select id from "public"."dance_types" where name = 'Contra');
