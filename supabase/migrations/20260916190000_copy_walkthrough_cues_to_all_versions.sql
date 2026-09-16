-- The dance_versions backfill only copied walkthrough/cues onto each
-- dance's primary version, leaving every other version's walkthrough/cues
-- null.
update "public"."dance_versions"
set walkthrough = dances.walkthrough
from "public"."dances"
where dances.id = dance_versions.dance_id
  and dance_versions.walkthrough is null
  and dances.walkthrough is not null;

update "public"."dance_versions"
set cues = dances.cues
from "public"."dances"
where dances.id = dance_versions.dance_id
  and dance_versions.cues is null
  and dances.cues is not null;
