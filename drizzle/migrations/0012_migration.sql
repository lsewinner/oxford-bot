CREATE TABLE public.oxford_memory_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('identity','knowledge')),
  content text NOT NULL CHECK (char_length(content) <= 20000),
  note text,
  published boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE UNIQUE INDEX oxford_memory_one_published ON public.oxford_memory_versions(kind) WHERE published;
GRANT SELECT, INSERT, UPDATE ON public.oxford_memory_versions TO authenticated;
GRANT ALL ON public.oxford_memory_versions TO service_role;
ALTER TABLE public.oxford_memory_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage memory" ON public.oxford_memory_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));