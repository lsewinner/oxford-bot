ALTER TABLE public.bot_shares
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'productivity',
  ADD COLUMN IF NOT EXISTS submission_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS creator_name text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.list_square_bots()
RETURNS TABLE(token uuid, name text, kind text, breed text, intro text, category text, creator_name text, official boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.token, s.name, s.kind, s.breed, s.intro, s.category, s.creator_name,
         (s.submission_status <> 'approved') AS official
  FROM public.bot_shares s
  WHERE s.featured AND s.revoked_at IS NULL
  ORDER BY s.featured_at DESC NULLS LAST
  LIMIT 200
$$;
GRANT EXECUTE ON FUNCTION public.list_square_bots() TO anon, authenticated;