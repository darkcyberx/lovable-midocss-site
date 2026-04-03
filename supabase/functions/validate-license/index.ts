import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ── PRE-BUILT STATIC RESPONSE — zero allocation per request ──────────────────
const BLOCK_BODY = '{"valid":false,"error":"Access denied","force_shutdown":true,"update_required":true}';
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Log to DB
    supabase.from('logs').insert({
      entity_type: 'legacy_tool',
      action: 'verified',
      description: `🚫 محاولة اتصال بـ endpoint القديم — IP: ${clientIp} | Key: ${keyPrefix}...`,
      ip_address: clientIp,
    }).then(() => {});

    // Telegram alert
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const adminChatId = Deno.env.get('ADMIN_TELEGRAM_CHAT_ID');
    if (botToken && adminChatId) {
      const msg =
        `🚨 *محاولة اتصال بالسيرفر القديم*\n\n` +
        `🌐 IP: \`${clientIp}\`\n` +
        `🔑 Key: \`${keyPrefix}...\`\n` +
        `⏰ ${new Date().toLocaleString('ar-EG')}\n\n` +
        `تم الصد الفوري ✅`;
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
