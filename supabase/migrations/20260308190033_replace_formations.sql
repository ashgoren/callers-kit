-- Replace dance_types and formations with updated lists
-- dances FKs have ON DELETE SET NULL, so existing dance references will be nulled

delete from "public"."dance_types";

insert into "public"."dance_types" (name, sort_order) values
  ('Contra', 1),
  ('ECD', 2),
  ('Mixer', 3),
  ('Other', 4);

delete from "public"."formations";

insert into "public"."formations" (name, sort_order) values
  ('Duple Minor - Improper', 1),
  ('Duple Minor - Becket', 2),
  ('Duple Minor - Becket CCW', 3),
  ('Duple Minor', 4),
  ('Duple Minor - Proper', 5),
  ('Duple Minor - Indecent', 6),
  ('Duple Minor - Reverse progression improper', 7),
  ('Duple Minor - Progressed improper', 8),
  ('Duple Minor - Cross', 9),
  ('Duple Minor - Other', 10),
  ('Triple Minor', 11),
  ('Three Facing Three', 12),
  ('Four Facing Four', 13),
  ('Solo', 14),
  ('Singlet', 15),
  ('Doublet', 16),
  ('Triplet', 17),
  ('Quadruplet', 18),
  ('Longways: 5+ couples', 19),
  ('Other Longways', 20),
  ('Circle Mixer', 21),
  ('Circle of Threesomes', 22),
  ('Sicilian Circle', 23),
  ('Scatter Mixer', 24),
  ('Grid Contra', 25),
  ('Grid Square', 26),
  ('Zia', 27),
  ('other', 28);
