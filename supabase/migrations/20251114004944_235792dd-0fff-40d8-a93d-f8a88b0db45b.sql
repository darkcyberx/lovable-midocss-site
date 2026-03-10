-- Create notification settings table
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_days integer[] NOT NULL DEFAULT ARRAY[7, 3, 1],
  notification_time time NOT NULL DEFAULT '09:00:00',
  email_subject text NOT NULL DEFAULT 'تنبيه: اقتراب انتهاء ترخيصك',
  email_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view notification settings"
  ON public.notification_settings
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert notification settings"
  ON public.notification_settings
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update notification settings"
  ON public.notification_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete notification settings"
  ON public.notification_settings
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.notification_settings (notification_days, notification_time, email_subject)
VALUES (ARRAY[7, 3, 1], '09:00:00', 'تنبيه: اقتراب انتهاء ترخيصك')
ON CONFLICT DO NOTHING;