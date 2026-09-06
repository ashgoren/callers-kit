-- Add share tokens to dances and programs
ALTER TABLE dances   ADD COLUMN share_token uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE programs ADD COLUMN share_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX dances_share_token_idx   ON dances(share_token);
CREATE UNIQUE INDEX programs_share_token_idx ON programs(share_token);

-- RPC: single dance (returns null if token not found)
CREATE FUNCTION get_shared_dance(token uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'title',          d.title,
    'choreographers', (
      SELECT json_agg(c.name ORDER BY c.name)
      FROM dances_choreographers dc
      JOIN choreographers c ON c.id = dc.choreographer_id
      WHERE dc.dance_id = d.id
    ),
    'dance_type',  dt.name,
    'formation',   f.name,
    'progression', p.name,
    'figures',     d.figures
  )
  FROM dances d
  LEFT JOIN dance_types  dt ON dt.id = d.dance_type_id
  LEFT JOIN formations   f  ON f.id  = d.formation_id
  LEFT JOIN progressions p  ON p.id  = d.progression_id
  WHERE d.share_token = token;
$$;

-- RPC: full program with ordered dances and their choreography
CREATE FUNCTION get_shared_program(token uuid)
RETURNS json LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'location', pr.location,
    'date',     pr.date,
    'dances', (
      SELECT json_agg(
        json_build_object(
          'order',          pd.order,
          'title',          d.title,
          'choreographers', (
            SELECT json_agg(c.name ORDER BY c.name)
            FROM dances_choreographers dc
            JOIN choreographers c ON c.id = dc.choreographer_id
            WHERE dc.dance_id = d.id
          ),
          'dance_type',  dt.name,
          'formation',   f.name,
          'progression', p.name,
          'figures',     d.figures
        )
        ORDER BY pd.order
      )
      FROM programs_dances pd
      JOIN dances d ON d.id = pd.dance_id
      LEFT JOIN dance_types  dt ON dt.id = d.dance_type_id
      LEFT JOIN formations   f  ON f.id  = d.formation_id
      LEFT JOIN progressions p  ON p.id  = d.progression_id
      WHERE pd.program_id = pr.id
    )
  )
  FROM programs pr
  WHERE pr.share_token = token;
$$;

GRANT EXECUTE ON FUNCTION get_shared_dance(uuid)  TO anon;
GRANT EXECUTE ON FUNCTION get_shared_program(uuid) TO anon;
