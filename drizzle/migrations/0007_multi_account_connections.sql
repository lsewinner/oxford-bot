ALTER TABLE public.app_user_connections ADD COLUMN IF NOT EXISTS account_key text NOT NULL DEFAULT '';
ALTER TABLE public.app_user_connections DROP CONSTRAINT IF EXISTS app_user_connections_user_id_connector_id_key;
ALTER TABLE public.app_user_connections ADD CONSTRAINT app_user_connections_user_connector_account_key UNIQUE (user_id, connector_id, account_key);