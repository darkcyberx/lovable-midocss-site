import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_API = "https://api.telegram.org/bot";

async function sendTelegramMessage(token: string, chatId: number, text: string, parseMode?: string) {
  const body: any = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;

  const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("Telegram sendMessage failed:", await res.text());
    return false;
  }
  return true;
}

function buildMessage(
  template: string,
  vars: {
    urgencyEmoji: string;
    customerName: string;
    productName: string;
    licenseKey: string;
    expiryDate: string;
    daysRemaining: number;
  }
): string {
  return template
    .replace(/{urgencyEmoji}/g, vars.urgencyEmoji)
    .replace(/{customerName}/g, vars.customerName)
    .replace(/{productName}/g, vars.productName)
    .replace(/{licenseKey}/g, vars.licenseKey)
    .replace(/{expiryDate}/g, vars.expiryDate)
    .replace(/{daysRemaining}/g, String(vars.daysRemaining));
}

const DEFAULT_TEMPLATE =
  `━━━━━━━━━━━━━━━━━━━━━\n` +
  `{urgencyEmoji} *تنبيه انتهاء ترخيص*\n` +
  `━━━━━━━━━━━━━━━━━━━━━\n\n` +
  `مرحباً *{customerName}*\n\n` +
  `ترخيصك لمنتج *{productName}* سينتهي قريباً!\n\n` +
  `🔑 المفتاح: \`{licenseKey}\`\n` +
  `📅 تاريخ الانتهاء: {expiryDate}\n` +
  `⏰ الأيام المتبقية: *{daysRemaining} يوم*\n\n` +
  `━━━━━━━━━━━━━━━━━━━━━\n` +
  `🔄 لتجديد الترخيص أرسل:\n` +
  `/renew {licenseKey}\n` +
  `━━━━━━━━━━━━━━━━━━━━━`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting check for expiring licenses...");

    // Fetch notification settings
    const { data: settingsData, error: settingsError } = await supabase
      .from("notification_settings")
      .select("*")
      .single();

    if (settingsError || !settingsData) {
      console.error("Error fetching notification settings:", settingsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch notification settings" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const notificationDays = settingsData.notification_days as number[];
    // Use custom template if set, otherwise fall back to default
    const messageTemplate = (settingsData as any).telegram_message_template || DEFAULT_TEMPLATE;
    const today = new Date();
    
    let emailsSent = 0;
    let telegramSent = 0;

    // Fetch all telegram links for quick lookup
    const { data: telegramLinks } = await supabase
      .from("telegram_links")
      .select("customer_id, telegram_chat_id");

    const telegramMap = new Map<string, number>();
    if (telegramLinks) {
      for (const link of telegramLinks) {
        telegramMap.set(link.customer_id, link.telegram_chat_id);
      }
    }

    for (const days of notificationDays) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + days);
      targetDate.setHours(0, 0, 0, 0);

      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      console.log(`Checking licenses expiring in ${days} days...`);

      const { data: licenses, error } = await supabase
        .from("licenses")
        .select(`
          id,
          license_key,
          expire_at,
          customer:customers(id, name, email),
          product:products(id, name)
        `)
        .eq("status", "active")
        .gte("expire_at", targetDate.toISOString())
        .lt("expire_at", nextDay.toISOString());

      if (error) {
        console.error(`Error fetching licenses for ${days} days:`, error);
        continue;
      }

      console.log(`Found ${licenses?.length || 0} licenses expiring in ${days} days`);

      if (licenses && licenses.length > 0) {
        for (const license of licenses) {
          const customerName = license.customer?.name || "عميل";
          const customerEmail = license.customer?.email;
          const customerId = license.customer?.id;
          const productName = license.product?.name || "منتج";
          const expiryDate = new Date(license.expire_at!).toLocaleDateString("ar-EG");
          const urgencyEmoji = days <= 1 ? "🚨" : days <= 3 ? "⚠️" : "📢";

          // 1) Send email notification if enabled
          if (settingsData.email_enabled && customerEmail) {
            try {
              const notificationResponse = await supabase.functions.invoke("send-expiry-notification", {
                body: {
                  customerEmail,
                  customerName,
                  licenseKey: license.license_key,
                  productName,
                  expiryDate: license.expire_at,
                  daysRemaining: days,
                },
              });

              if (!notificationResponse.error) {
                emailsSent++;
                console.log(`Email sent for license ${license.license_key}`);
              }
            } catch (e) {
              console.error(`Email error for ${license.license_key}:`, e);
            }
          }

          // 2) Send Telegram notification if linked
          if (telegramToken && customerId && telegramMap.has(customerId)) {
            const chatId = telegramMap.get(customerId)!;

            const msg = buildMessage(messageTemplate, {
              urgencyEmoji,
              customerName,
              productName,
              licenseKey: license.license_key,
              expiryDate,
              daysRemaining: days,
            });

            const sent = await sendTelegramMessage(telegramToken, chatId, msg, "Markdown");
            if (sent) {
              telegramSent++;
              console.log(`Telegram sent for license ${license.license_key} to chat ${chatId}`);
            }
          }
        }
      }
    }

    console.log(`Total: ${emailsSent} emails, ${telegramSent} telegram messages`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `تم إرسال ${emailsSent} إيميل و ${telegramSent} رسالة تليجرام`,
        emailsSent,
        telegramSent,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-expiring-licenses function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
