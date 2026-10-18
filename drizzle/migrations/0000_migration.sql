CREATE TABLE public.threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '新对话',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.threads TO authenticated;
GRANT ALL ON public.threads TO service_role;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own threads select" ON public.threads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own threads insert" ON public.threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own threads update" ON public.threads FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own threads delete" ON public.threads FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX threads_user_updated ON public.threads(user_id, updated_at DESC);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  ui_id text NOT NULL,
  role text NOT NULL,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (thread_id, ui_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages select" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own messages insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
CREATE POLICY "own messages update" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own messages delete" ON public.messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX messages_thread_created ON public.messages(thread_id, created_at);