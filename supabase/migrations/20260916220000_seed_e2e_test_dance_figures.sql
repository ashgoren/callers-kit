-- Seeds the e2e test dance's primary version with a known, deterministic
-- figures list, so e2e tests can assert on real rendered content (a phrase,
-- beats count, and figure description) instead of only checking that the
-- figures grid renders something.
update dance_versions
set figures = '[{"id": "e2e-figure-1", "kind": "figure", "phrase": "A1", "beats": 8, "description": "E2E Test Figure One"}]'::jsonb
where id = (
  select dance_versions.id
  from dance_versions
  where dance_versions.dance_id = '94d881b7-19e5-4554-8669-db798bdd8863'
  order by dance_versions."order" asc
  limit 1
);
