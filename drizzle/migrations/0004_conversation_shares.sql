CREATE TABLE public.conversation_shares (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, thread_id uuid REFERENCES public.threads(id) ON DELETE SET NULL, token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(), title text NOT NULL, messages jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_shares TO authenticated;
GRANT ALL ON public.conversation_shares TO service_role;
ALTER TABLE public.conversation_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage conversation shares" ON public.conversation_shares FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE FUNCTION public.read_conversation_share(p_token uuid) RETURNS TABLE(title text, messages jsonb, created_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT s.title, s.messages, s.created_at FROM public.conversation_shares s WHERE s.token = p_token AND s.revoked_at IS NULL LIMIT 1 $$;
REVOKE ALL ON FUNCTION public.read_conversation_share(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_conversation_share(uuid) TO anon, authenticated;