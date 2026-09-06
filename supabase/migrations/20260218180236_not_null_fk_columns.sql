ALTER TABLE dances_choreographers ALTER COLUMN dance_id SET NOT NULL;
ALTER TABLE dances_choreographers ALTER COLUMN choreographer_id SET NOT NULL;

ALTER TABLE programs_dances ALTER COLUMN program_id SET NOT NULL;
ALTER TABLE programs_dances ALTER COLUMN "order" SET NOT NULL;
