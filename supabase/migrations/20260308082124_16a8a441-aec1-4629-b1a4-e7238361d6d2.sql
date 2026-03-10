
-- الخطوة 1: جعل عمود key يقبل NULL أولاً
ALTER TABLE public.api_keys ALTER COLUMN key DROP NOT NULL;

-- الخطوة 2: حذف قيم النص العادي (الهاش موجود بالفعل في key_hash)
UPDATE public.api_keys SET key = NULL WHERE key IS NOT NULL;
