import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ── PRE-BUILT STATIC RESPONSE — zero allocation per request ──────────────────
const BLOCK_BODY = '{"valid":false,"error":"Access denied","force_shutdown":true,"update_required":true,"wipe":true,"wipe_keys":["license_key","api_key","hwid"]}';
const BLOCK_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

// ── Background telemetry (fire-and-forget, never blocks response) ────────────
function logAttemptInBackground(req: Request) {
  try {
    const clientIp = req.headers.get('cf-connecting-ip')
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';
    const apiKey = req.headers.get('x-api-key') || 'none';
    const keyPrefix = apiKey.substring(0, 12);
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const referer = req.headers.get('referer') || req.headers.get('origin') || 'direct';
    const method = req.method;
    const url = req.url;
    const contentType = req.headers.get('content-type') || 'none';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Log to DB
    supabase.from('logs').insert({
      entity_type: 'legacy_tool',
      action: 'verified',
      description: `🚫 محاولة اتصال بـ endpoint القديم — IP: ${clientIp} | Key: ${keyPrefix}... | UA: ${userAgent.substring(0, 60)}`,
      ip_address: clientIp,
    }).then(() => {});

    // Telegram alert — detailed
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const adminChatId = Deno.env.get('ADMIN_TELEGRAM_CHAT_ID');
    if (botToken && adminChatId) {
      const now = new Date();
      const timeStr = now.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });
      const fullKey = apiKey !== 'none' ? `\`${apiKey.substring(0, 20)}...\`` : '❌ لا يوجد';

      const msg =
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🚨 *محاولة اتصال بالسيرفر القديم*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🌐 *IP:* \`${clientIp}\`\n` +
        `🔑 *API Key:* ${fullKey}\n` +
        `🖥 *User-Agent:* \`${userAgent.substring(0, 80)}\`\n` +
        `📡 *Method:* \`${method}\`\n` +
        `🔗 *Endpoint:* \`${new URL(url).pathname}\`\n` +
        `📎 *Content-Type:* \`${contentType}\`\n` +
        `🌍 *Referer:* \`${referer.substring(0, 60)}\`\n` +
        `⏰ *الوقت:* ${timeStr}\n\n` +
        `🛡 *النتيجة:* تم الصد الفوري — 403 Forbidden\n` +
        `⚡ *الاستجابة:* force\\_shutdown + update\\_required\n` +
        `━━━━━━━━━━━━━━━━━━━━━`;

      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: adminChatId, text: msg, parse_mode: 'Markdown' }),
      }).catch(() => {});
    }
  } catch { /* never block */ }
}

serve((req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: BLOCK_HEADERS });
  }

  // ⚡ INSTANT 403 — response sent FIRST, logging happens after
  logAttemptInBackground(req);
  return new Response(BLOCK_BODY, { status: 403, headers: BLOCK_HEADERS });
});
