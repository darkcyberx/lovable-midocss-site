import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HTML escape to prevent XSS in email templates
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "غير مصرح" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "رمز غير صالح" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has admin role
    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !adminRole) {
      return new Response(
        JSON.stringify({ error: "يجب أن تكون مسؤولاً لتنفيذ هذا الإجراء" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { email, customerName } = body;

    // Input validation
    if (!email || typeof email !== "string" || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "البريد الإلكتروني غير صالح" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeName = customerName && typeof customerName === "string"
      ? escapeHtml(customerName.trim().slice(0, 200))
      : "العميل";

    console.log(`Admin ${user.id} resetting password for customer`);

    // Generate a new temporary password using CSPRNG (cryptographically secure)
    const generateSecurePassword = (): string => {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      return Array.from(bytes).map(b => chars[b % chars.length]).join("");
    };

    const newPassword = generateSecurePassword();

    // Find the user by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error("Error listing users");
      throw new Error("فشل البحث عن المستخدم");
    }

    const customerUser = users.users.find((u) => u.email === email);

    if (!customerUser) {
      return new Response(
        JSON.stringify({ error: "لم يتم العثور على حساب بهذا البريد الإلكتروني" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      customerUser.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password");
      throw new Error("فشل تحديث كلمة المرور");
    }

    // Send email with new credentials using Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "خدمة البريد الإلكتروني غير مكونة" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "License Manager <onboarding@resend.dev>",
        to: [email],
        subject: "كلمة مرور جديدة لحسابك",
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">كلمة مرور جديدة</h2>
            <p>مرحباً <strong>${safeName}</strong>،</p>
            <p>تم إعادة تعيين كلمة المرور الخاصة بحسابك. يمكنك الآن تسجيل الدخول باستخدام البيانات التالية:</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>البريد الإلكتروني:</strong> ${escapeHtml(email)}</p>
              <p style="margin: 5px 0;"><strong>كلمة المرور الجديدة:</strong> <code style="background-color: #e9ecef; padding: 2px 8px; border-radius: 4px;">${newPassword}</code></p>
            </div>
            <p style="color: #dc3545;"><strong>⚠️ تنبيه:</strong> يُنصح بشدة بتغيير كلمة المرور بعد تسجيل الدخول الأول.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">هذه الرسالة تم إرسالها تلقائياً، يرجى عدم الرد عليها.</p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      console.error("Error sending email");
      // Password was updated but email failed - return success without exposing password
      return new Response(
        JSON.stringify({
          success: true,
          warning: "تم تحديث كلمة المرور ولكن فشل إرسال البريد الإلكتروني، يرجى التواصل مع العميل مباشرة",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Password reset successful for admin-initiated request`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "تم إرسال كلمة المرور الجديدة بنجاح إلى بريد العميل الإلكتروني",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in reset-customer-password:", error);
    return new Response(
      JSON.stringify({ error: "حدث خطأ في الخادم" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
