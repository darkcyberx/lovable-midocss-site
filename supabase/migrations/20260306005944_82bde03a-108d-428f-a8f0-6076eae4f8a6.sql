ALTER TABLE public.notification_settings 
ADD COLUMN IF NOT EXISTS telegram_message_template text DEFAULT 
'━━━━━━━━━━━━━━━━━━━━━
{urgencyEmoji} *تنبيه انتهاء ترخيص*
━━━━━━━━━━━━━━━━━━━━━

مرحباً *{customerName}*

ترخيصك لمنتج *{productName}* سينتهي قريباً!

🔑 المفتاح: `{licenseKey}`
📅 تاريخ الانتهاء: {expiryDate}
⏰ الأيام المتبقية: *{daysRemaining} يوم*

━━━━━━━━━━━━━━━━━━━━━
🔄 لتجديد الترخيص أرسل:
/renew {licenseKey}
━━━━━━━━━━━━━━━━━━━━━';