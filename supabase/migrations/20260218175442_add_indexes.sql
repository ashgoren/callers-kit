-- Index FK columns on join table (used in eager-load queries and RLS EXISTS checks)
CREATE INDEX ON public.dances_choreographers (dance_id);
CREATE INDEX ON public.dances_choreographers (choreographer_id);

-- Index user_id FK columns (used for FK constraint enforcement on user deletion)
CREATE INDEX ON public.dances (user_id);
CREATE INDEX ON public.programs (user_id);
CREATE INDEX ON public.choreographers (user_id);
