import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify admin user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "رمز المصادقة غير صالح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "يجب أن تكون مسؤولاً للوصول للمساعد" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    // Gather live system stats for context
    const [
      { count: totalLicenses },
      { count: activeLicenses },
      { count: expiredLicenses },
      { count: totalCustomers },
      { count: expiringLicenses },
      { count: totalDevices },
      { data: recentLogs },
      { data: pendingRenewals },
    ] = await Promise.all([
      supabase.from("licenses").select("*", { count: "exact", head: true }),
      supabase.from("licenses").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("licenses").select("*", { count: "exact", head: true }).eq("status", "expired"),
      supabase.from("customers").select("*", { count: "exact", head: true }),
      supabase.from("licenses")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .lt("expire_at", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from("devices").select("*", { count: "exact", head: true }),
      supabase.from("logs")
        .select("action, entity_type, description, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("renewal_requests")
        .select("id, status, amount, days, created_at")
        .eq("status", "pending")
        .limit(5),
    ]);

    const systemPrompt = `أنت مساعد ذكي متخصص في إدارة نظام التراخيص (License Manager). أنت تساعد المسؤولين في إدارة التراخيص والعملاء والأجهزة وكل ما يتعلق بالنظام.

**📊 إحصائيات النظام الحالية (محدّثة للحظة):**
- إجمالي التراخيص: ${totalLicenses ?? 0}
- التراخيص النشطة: ${activeLicenses ?? 0}
- التراخيص المنتهية: ${expiredLicenses ?? 0}
- التراخيص تنتهي خلال 7 أيام: ${expiringLicenses ?? 0}
- إجمالي العملاء: ${totalCustomers ?? 0}
- إجمالي الأجهزة المسجلة: ${totalDevices ?? 0}
- طلبات التجديد المعلقة: ${pendingRenewals?.length ?? 0}

**📝 آخر 5 نشاطات في السجل:**
${recentLogs?.map(l => `- [${l.entity_type}] ${l.action}: ${l.description}`).join("\n") ?? "لا توجد نشاطات"}

**📋 طلبات التجديد المعلقة:**
${pendingRenewals?.length ? pendingRenewals.map(r => `- طلب بمبلغ ${r.amount} لمدة ${r.days} يوم`).join("\n") : "لا توجد طلبات معلقة"}

**🧭 صفحات وميزات النظام التي يمكنك توجيه المستخدم إليها:**
- /dashboard → لوحة التحكم الرئيسية مع الإحصائيات
- /licenses → إدارة التراخيص (إنشاء، تعديل، تجديد)
- /customers → إدارة العملاء وحساباتهم
- /products → إدارة المنتجات والأسعار
- /devices → مراقبة الأجهزة المسجلة
- /renewal-orders → طلبات التجديد المعلقة
- /reports → التقارير والإحصائيات
- /logs → سجل النشاطات والعمليات
- /ip-management → إدارة حظر عناوين IP
- /notification-settings → إعدادات التنبيهات
- /telegram-settings → إعدادات بوت التليجرام
- /api-credentials → مفاتيح API للتكامل الخارجي
- /settings → الإعدادات العامة

**تعليمات مهمة:**
- أجب دائماً باللغة العربية بأسلوب مهني وودود
- استخدم الإحصائيات الحالية المذكورة أعلاه في إجاباتك عند الحاجة
- إذا كان هناك تراخيص تنتهي قريباً، نبّه عليها فوراً
- قدّم توصيات عملية وقابلة للتنفيذ
- وجّه المستخدم للصفحة الصحيحة عند الحاجة`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "يتطلب رصيداً إضافياً في Lovable AI" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: "حدث خطأ في الخادم" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
