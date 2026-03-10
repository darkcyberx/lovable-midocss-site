
CREATE TABLE public.rustdesk_ids (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  rustdesk_id text NOT NULL,
  device_label text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.rustdesk_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rustdesk_ids"
  ON public.rustdesk_ids
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE UNIQUE INDEX rustdesk_ids_customer_id_idx ON public.rustdesk_ids (customer_id);
