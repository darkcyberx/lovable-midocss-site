
CREATE TABLE public.revoked_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text NOT NULL UNIQUE,
  reason text,
  revoked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.revoked_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage revoked keys"
  ON public.revoked_keys
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
