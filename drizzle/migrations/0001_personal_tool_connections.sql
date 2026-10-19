CREATE TABLE public.app_user_connections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, connector_id text NOT NULL,
 connection_key_ciphertext text NOT NULL, enabled boolean NOT NULL DEFAULT true,
 reconnect_required boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,connector_id)
);
GRANT ALL ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.tool_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, connector_id text NOT NULL,
 operation text NOT NULL, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending',
 result jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tool_actions TO service_role;
ALTER TABLE public.tool_actions ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.app_user_connections IS 'Server-only encrypted per-user credentials; no browser grants or policies.';
COMMENT ON TABLE public.tool_actions IS 'Server-only immutable proposed writes, executed only after owner confirmation.';