CREATE OR REPLACE FUNCTION public.generate_license_key()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  part1 TEXT := '';
  part2 TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    part1 := part1 || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  FOR i IN 1..8 LOOP
    part2 := part2 || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN 'DCX-' || part1 || '-' || part2;
END;
$function$;