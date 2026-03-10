-- 1. Add customer SELECT policy for renewal_requests
CREATE POLICY "Customers view own renewal requests"
ON public.renewal_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = renewal_requests.customer_id
      AND customers.user_id = auth.uid()
  )
);

-- 2. Add customer SELECT policy for rustdesk_ids
CREATE POLICY "Customers view own rustdesk ids"
ON public.rustdesk_ids
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = rustdesk_ids.customer_id
      AND customers.user_id = auth.uid()
  )
);