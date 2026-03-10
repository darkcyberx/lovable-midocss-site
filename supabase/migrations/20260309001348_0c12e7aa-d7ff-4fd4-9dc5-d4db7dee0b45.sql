ALTER TABLE public.notification_settings 
ADD COLUMN IF NOT EXISTS kill_switch_response TEXT DEFAULT '{"valid":false,"error":"License not found","force_shutdown":true}';