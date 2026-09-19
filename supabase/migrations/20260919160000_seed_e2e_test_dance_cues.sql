-- Seeds the e2e test dance's primary version with a known, deterministic
-- cues grid (one populated cell plus notes), so e2e tests can assert on
-- and edit real rendered content instead of only checking that the cues
-- page renders - matching 20260916220000_seed_e2e_test_dance_figures.sql's
-- own rationale for the figures list.
update dance_versions
set cues = '{"cells": {"A1:0:0": "E2E Test Cue"}, "notes": "E2E Test Cue Notes"}'::jsonb
where id = (
  select dance_versions.id
  from dance_versions
  where dance_versions.dance_id = '94d881b7-19e5-4554-8669-db798bdd8863'
  order by dance_versions."order" asc
  limit 1
);
