-- Only adds an id to elements that don't already have one, so it's idempotent.
update dances
set videos = (
  select jsonb_agg(
    case when elem ? 'id' then elem else elem || jsonb_build_object('id', gen_random_uuid()::text) end
    order by ordinality
  )
  from jsonb_array_elements(videos) with ordinality as t(elem, ordinality)
)
where jsonb_array_length(videos) > 0;
