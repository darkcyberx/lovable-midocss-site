import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_API = "https://api.telegram.org/bot";

function generateLicenseKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    if (i < 3) result += "-";
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { licenseId } = await req.json();
    if (!licenseId) {
      return new Response(JSON.stringify({ error: "Missing licenseId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch license with customer and product info
    const { data: license, error: fetchError } = await supabase
      .from("licenses")
      .select("*, customers(id, name, email), products(name)")
      .eq("id", licenseId)
      .maybeSingle();

    if (fetchError || !license) {
      console.error("License fetch error:", fetchError, "licenseId:", licenseId);
      return new Response(JSON.stringify({ error: "License not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Separately fetch telegram link via customer_id
    let chatId: number | null = null;
    if (license.customer_id) {
      const { data: telegramLink } = await supabase
        .from("telegram_links")
        .select("telegram_chat_id")
        .eq("customer_id", license.customer_id)
        .maybeSingle();
      chatId = telegramLink?.telegram_chat_id ?? null;
    }

    const oldKey = license.license_key;

    // Generate new unique key (retry if collision)
    let newKey = "";
    let attempts = 0;
    while (attempts < 10) {
      newKey = generateLicenseKey();
      const { data: existing } = await supabase
        .from("licenses")
        .select("id")
        .eq("license_key", newKey)
        .maybeSingle();
      if (!existing) break;
      attempts++;
    }

    if (!newKey) {
      return new Response(JSON.stringify({ error: "Failed to generate unique key" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update license key
    const { error: updateError } = await supabase
      .from("licenses")
      .update({ license_key: newKey })
      .eq("id", licenseId);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to update license key" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deactivate all devices for this license (they need to re-verify with new key)
    await supabase
      .from("devices")
      .update({ is_active: false })
      .eq("license_id", licenseId);

    // Send Telegram notification if customer is linked
    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");

    if (telegramToken && chatId) {
      const customerName = license.customers?.name || "عزيزي العميل";
      const productName = license.products?.name || "المنتج";
      const expiryDate = license.expire_at
        ? new Date(license.expire_at).toLocaleDateString("ar-EG")
        : "غير محدد";

      const msg =
        "━━━━━━━━━━━━━━━━━━━━━\n" +
        "🔄 *تم تجديد مفتاح الترخيص*\n" +
        "━━━━━━━━━━━━━━━━━━━━━\n\n" +
        `مرحباً *${customerName}*،\n\n` +
        `تم إنشاء مفتاح ترخيص جديد لمنتج *${productName}*\n\n` +
        `🔑 *المفتاح الجديد:*\n` +
        `\`${newKey}\`\n\n` +
        `📅 تاريخ الانتهاء: ${expiryDate}\n\n` +
        `⚠️ المفتاح القديم \`${oldKey}\` لم يعد صالحاً.\n` +
        `يرجى تحديث التطبيق بالمفتاح الجديد.\n\n` +
        "━━━━━━━━━━━━━━━━━━━━━";

      await fetch(`${TELEGRAM_API}${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: msg,
          parse_mode: "Markdown",
        }),
      });
    }

    return new Response(JSON.stringify({
      success: true,
      newKey,
      oldKey,
      notified: !!chatId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Regenerate license key error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
