CREATE TABLE public.bot_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'general',
  breed text,
  system_prompt text NOT NULL DEFAULT '',
  intro text NOT NULL DEFAULT '',
  featured boolean NOT NULL DEFAULT false,
  featured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
GRANT SELECT ON public.bot_shares TO authenticated;
GRANT ALL ON public.bot_shares TO service_role;
ALTER TABLE public.bot_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bot shares read" ON public.bot_shares FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX bot_shares_featured_idx ON public.bot_shares (featured_at DESC) WHERE featured AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.read_bot_share(p_token uuid)
RETURNS TABLE(token uuid, name text, kind text, breed text, system_prompt text, intro text, featured boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT token, name, kind, breed, system_prompt, intro, featured FROM public.bot_shares
  WHERE token = p_token AND revoked_at IS NULL
$$;
CREATE OR REPLACE FUNCTION public.list_featured_bots()
RETURNS TABLE(token uuid, name text, kind text, breed text, intro text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT token, name, kind, breed, intro FROM public.bot_shares
  WHERE featured AND revoked_at IS NULL ORDER BY featured_at DESC NULLS LAST LIMIT 60
$$;
GRANT EXECUTE ON FUNCTION public.read_bot_share(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_featured_bots() TO anon, authenticated;