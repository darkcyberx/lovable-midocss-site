import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

interface NotificationRequest {
  customerEmail: string;
  customerName: string;
  licenseKey: string;
  productName: string;
  expiryDate: string;
  daysRemaining: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { customerEmail, customerName, licenseKey, productName, expiryDate, daysRemaining }: NotificationRequest = body;

    // Input validation
    if (!customerEmail || typeof customerEmail !== "string" || customerEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return new Response(JSON.stringify({ error: "البريد الإلكتروني غير صالح" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!licenseKey || typeof licenseKey !== "string" || licenseKey.length > 50) {
      return new Response(JSON.stringify({ error: "مفتاح الترخيص غير صالح" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Sanitize all user-provided fields before embedding in HTML
    const safeCustomerName = escapeHtml(String(customerName || "").slice(0, 200));
    const safeLicenseKey = escapeHtml(String(licenseKey).slice(0, 50));
    const safeProductName = escapeHtml(String(productName || "").slice(0, 200));
    const safeDaysRemaining = Number(daysRemaining) || 0;

    console.log(`Sending expiry notification for license ${safeLicenseKey}`);

    const emailResponse = await resend.emails.send({
      from: "License Manager <onboarding@resend.dev>",
      to: [customerEmail],
      subject: `تنبيه: اقتراب انتهاء ترخيصك - ${safeProductName}`,
      html: `
        <!DOCTYPE html>
        <html dir="rtl">
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
              .content { padding: 30px; }
              .alert-box { background-color: #fff3cd; border-right: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
              .license-info { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #dee2e6; }
              .info-label { font-weight: bold; color: #495057; }
              .info-value { color: #212529; }
              .footer { text-align: center; padding: 20px; color: #6c757d; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">⚠️ تنبيه انتهاء الترخيص</h1>
              </div>
              <div class="content">
                <p style="font-size: 16px;">عزيزي/عزيزتي <strong>${safeCustomerName}</strong>،</p>
                
                <div class="alert-box">
                  <strong>⏰ تنبيه هام:</strong> سينتهي ترخيصك خلال <strong>${safeDaysRemaining}</strong> يوم!
                </div>

                <p>نود إعلامك بأن ترخيصك لمنتج <strong>${safeProductName}</strong> يقترب من تاريخ الانتهاء.</p>

                <div class="license-info">
                  <div class="info-row">
                    <span class="info-label">مفتاح الترخيص:</span>
                    <span class="info-value"><code>${safeLicenseKey}</code></span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">المنتج:</span>
                    <span class="info-value">${safeProductName}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">تاريخ الانتهاء:</span>
                    <span class="info-value">${new Date(expiryDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div class="info-row" style="border-bottom: none;">
                    <span class="info-label">الأيام المتبقية:</span>
                    <span class="info-value" style="color: #dc3545; font-weight: bold;">${safeDaysRemaining} يوم</span>
                  </div>
                </div>

                <p>للحفاظ على استمرارية الخدمة وتجنب أي انقطاع، يرجى تجديد ترخيصك في أقرب وقت ممكن.</p>

                <p style="margin-top: 30px; color: #6c757d; font-size: 14px;">
                  إذا كان لديك أي استفسارات أو تحتاج إلى مساعدة، لا تتردد في الاتصال بنا.
                </p>
              </div>
              <div class="footer">
                <p>هذه رسالة تلقائية من نظام إدارة التراخيص</p>
                <p>© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully");

    return new Response(JSON.stringify({ success: true, emailId: emailResponse.data?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending expiry notification:", error);
    return new Response(
      JSON.stringify({ error: "حدث خطأ في إرسال الإشعار" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
