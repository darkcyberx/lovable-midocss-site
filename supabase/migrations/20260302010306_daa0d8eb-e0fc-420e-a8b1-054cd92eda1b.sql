
CREATE TABLE public.telegram_user_states (
  telegram_chat_id bigint PRIMARY KEY,
  step text NOT NULL,
  data jsonb DEFAULT '{}',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_user_states ENABLE ROW LEVEL SECURITY;
-- Only accessible via service role (edge functions), no user-facing RLS needed
