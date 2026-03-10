CREATE TABLE public.blocked_hwids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hwid text NOT NULL UNIQUE,
  reason text,
  blocked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_hwids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage blocked hwids"
  ON public.blocked_hwids
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_blocked_hwids_hwid ON public.blocked_hwids(hwid);