CREATE TABLE public.briefing_settings (
  user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  hour smallint NOT NULL DEFAULT 9,
  timezone text NOT NULL DEFAULT 'Asia/Shanghai',
  sources text[] NOT NULL DEFAULT ARRAY['trends','calendar','jira']::text[],
  telegram_account text NOT NULL DEFAULT '',
  telegram_chat_id text NOT NULL DEFAULT '',
  last_sent_on date,
  last_status text NOT NULL DEFAULT '',
  last_error text NOT NULL DEFAULT '',
  last_run_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT briefing_hour_range CHECK (hour BETWEEN 0 AND 23)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefing_settings TO authenticated;
GRANT ALL ON public.briefing_settings TO service_role;
ALTER TABLE public.briefing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own briefing select" ON public.briefing_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own briefing insert" ON public.briefing_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own briefing update" ON public.briefing_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own briefing delete" ON public.briefing_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);