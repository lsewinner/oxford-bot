CREATE TABLE public.wechat_kf_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT '',
  corp_id text NOT NULL,
  open_kfid text NOT NULL DEFAULT '',
  secret_ciphertext text NOT NULL,
  token_ciphertext text NOT NULL,
  aes_key_ciphertext text NOT NULL,
  bot_name text NOT NULL DEFAULT 'Oxonian',
  bot_prompt text NOT NULL DEFAULT '',
  cursor text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wechat_kf_accounts TO service_role;
ALTER TABLE public.wechat_kf_accounts ENABLE ROW LEVEL SECURITY;
CREATE INDEX wechat_kf_accounts_user_idx ON public.wechat_kf_accounts(user_id);