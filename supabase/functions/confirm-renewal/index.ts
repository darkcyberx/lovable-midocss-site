import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_API = "https://api.telegram.org/bot";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    const body = await req.json();
    const { requestId, action, adminNote } = body;

    // Input validation
    if (!requestId || typeof requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(requestId)) {
      return new Response(JSON.stringify({ error: "معرف الطلب غير صالح" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!action || !["confirm", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "الإجراء غير صالح" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: request, error: fetchError } = await supabase
      .from("renewal_requests")
      .select("*, licenses(id, license_key, expire_at, status, products(name)), customers(name)")
      .eq("id", requestId)
      .eq("status", "pending")
      .maybeSingle();

    if (fetchError || !request) {
      return new Response(JSON.stringify({ error: "الطلب غير موجود أو تمت معالجته مسبقاً" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "confirm") {
      const currentExpiry = request.licenses?.expire_at ? new Date(request.licenses.expire_at) : new Date();
      const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
      baseDate.setDate(baseDate.getDate() + request.days);

      const { error: licenseError } = await supabase
        .from("licenses")
        .update({ status: "active", expire_at: baseDate.toISOString() })
        .eq("id", request.license_id);

      if (licenseError) {
        console.error("License update error:", licenseError.message);
        return new Response(JSON.stringify({ error: "حدث خطأ في الخادم" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("renewal_requests")
        .update({ status: "confirmed", admin_note: adminNote || null })
        .eq("id", requestId);

      // Save invoice so revenue is preserved even after deleting the request
      const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number");
      await supabase.from("invoices").insert({
        customer_id: request.customer_id,
        license_id: request.license_id,
        amount: request.amount,
        status: "paid",
        paid_at: new Date().toISOString(),
        payment_method: "vodafone_cash",
        invoice_number: invoiceNumber || `INV-${Date.now()}`,
        notes: `تجديد ترخيص - ${request.days} يوم`,
      });

      const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
      if (telegramToken && request.telegram_chat_id) {
        const msg =
          "━━━━━━━━━━━━━━━━━━━━━\n" +
          "✅ *تم تأكيد تجديد ترخيصك!*\n" +
          "━━━━━━━━━━━━━━━━━━━━━\n\n" +
          `🔑 المنتج: *${request.licenses?.products?.name || "منتج"}*\n` +
          `📅 تم إضافة: *${request.days} يوم*\n` +
          `📅 تاريخ الانتهاء الجديد: *${baseDate.toLocaleDateString("ar-EG")}*\n` +
          `📊 الحالة: نشط 🟢\n\n` +
          "شكراً لك! 🙏\n" +
          "━━━━━━━━━━━━━━━━━━━━━";

        await fetch(`${TELEGRAM_API}${telegramToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: request.telegram_chat_id, text: msg, parse_mode: "Markdown" }),
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: `تم تأكيد التجديد - ${request.days} يوم`,
        newExpiry: baseDate.toISOString(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else if (action === "reject") {
      await supabase
        .from("renewal_requests")
        .update({ status: "rejected", admin_note: adminNote || null })
        .eq("id", requestId);

      const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
      if (telegramToken && request.telegram_chat_id) {
        const msg =
          "━━━━━━━━━━━━━━━━━━━━━\n" +
          "❌ *تم رفض طلب التجديد*\n" +
          "━━━━━━━━━━━━━━━━━━━━━\n\n" +
          `🔑 المنتج: *${request.licenses?.products?.name || "منتج"}*\n` +
          (adminNote ? `📝 السبب: ${adminNote}\n\n` : "\n") +
          "يرجى التواصل مع الإدارة للمزيد من المعلومات.\n" +
          "━━━━━━━━━━━━━━━━━━━━━";

        await fetch(`${TELEGRAM_API}${telegramToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: request.telegram_chat_id, text: msg, parse_mode: "Markdown" }),
        });
      }

      return new Response(JSON.stringify({ success: true, message: "تم رفض الطلب" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "إجراء غير صالح" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Confirm renewal error:", error);
    return new Response(JSON.stringify({ error: "حدث خطأ في الخادم" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
