-- Add payment fields to registration_requests table
ALTER TABLE public.registration_requests
  ADD COLUMN IF NOT EXISTS requested_days integer,
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS receipt_note text;