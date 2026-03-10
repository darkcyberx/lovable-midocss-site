
-- Create renewal_requests table for tracking customer renewal orders
CREATE TABLE public.renewal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  days INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  telegram_chat_id BIGINT,
  receipt_note TEXT,
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.renewal_requests ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage renewal requests"
ON public.renewal_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_renewal_requests_updated_at
BEFORE UPDATE ON public.renewal_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
