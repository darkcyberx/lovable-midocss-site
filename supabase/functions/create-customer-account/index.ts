import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();

    // Input validation
    const { customerId, email, name } = body;

    if (!customerId || typeof customerId !== "string" || !/^[0-9a-f-]{36}$/i.test(customerId)) {
      return new Response(JSON.stringify({ error: "معرف العميل غير صالح" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!email || typeof email !== "string" || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "البريد الإلكتروني غير صالح" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 200) {
      return new Response(JSON.stringify({ error: "الاسم غير صالح" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const safeName = escapeHtml(name.trim());

    // Generate temporary password using CSPRNG (cryptographically secure)
    const generateSecurePassword = (): string => {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      return "T" + Array.from(bytes).map(b => chars[b % chars.length]).join("") + "!";
    };
    const tempPassword = generateSecurePassword();

    // Create user account
    const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: name.trim(),
      },
    });

    if (createError) {
      console.error("Failed to create user:", createError.message);
      throw new Error("فشل إنشاء الحساب");
    }

    // Link customer to user
    const { error: updateError } = await supabaseAdmin
      .from("customers")
      .update({
        user_id: user.user.id,
        account_created: true,
      })
      .eq("id", customerId);

    if (updateError) {
      console.error("Failed to link customer:", updateError.message);
      throw new Error("فشل ربط الحساب بالعميل");
    }

    // Assign customer role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: user.user.id,
        role: "customer",
      });

    if (roleError) {
      console.error("Role assignment error:", roleError.message);
    }

    // Send email with credentials if Resend is configured
    if (resendApiKey) {
      const emailHtml = `
        <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">مرحباً ${safeName}!</h1>
            <p style="font-size: 16px; color: #555;">تم إنشاء حسابك في بوابة العملاء بنجاح.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="color: #333; margin-top: 0;">بيانات الدخول الخاصة بك:</h2>
              <p style="margin: 10px 0;"><strong>البريد الإلكتروني:</strong> ${escapeHtml(email)}</p>
              <p style="margin: 10px 0;"><strong>كلمة المرور المؤقتة:</strong> <code style="background-color: #fff; padding: 5px 10px; border-radius: 4px;">${tempPassword}</code></p>
            </div>

            <p style="color: #d9534f; font-weight: bold;">⚠️ مهم: يرجى تغيير كلمة المرور عند أول تسجيل دخول.</p>
            
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              إذا لم تطلب هذا الحساب، يرجى تجاهل هذه الرسالة.
            </p>
          </div>
        </div>
      `;

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "نظام التراخيص <onboarding@resend.dev>",
          to: [email],
          subject: "تم إنشاء حسابك - بيانات الدخول",
          html: emailHtml,
        }),
      });

      if (!resendResponse.ok) {
        console.error("Failed to send email");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        // Return password only when email not configured so admin can share manually
        ...(resendApiKey ? {} : { tempPassword }),
        message: resendApiKey ? "تم إرسال بيانات الدخول للعميل" : "تم إنشاء الحساب بنجاح",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in create-customer-account:", error);
    return new Response(
      JSON.stringify({ error: "حدث خطأ في الخادم" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
