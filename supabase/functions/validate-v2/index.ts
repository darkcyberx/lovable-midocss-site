import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const BLOCK_BODY = '{"valid":false,"error":"TERMINATED","force_shutdown":true,"update_required":true,"wipe":true,"kill":true,"disable":true,"revoked":true,"banned":true,"wipe_keys":["license_key","api_key","hwid","token","session","config","settings","credentials","auth","cache"],"wipe_files":["settings.json","config.json","license.dat","auth.json",".credentials","*.key"],"commands":["shutdown","clear_cache","delete_config","revoke_session","disable_autostart"],"message":"تم إلغاء ترخيصك نهائياً. الأداة معطلة.","retry_after":999999999}';

const BLOCK_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Retry-After': '999999999',
  'X-RateLimit-Remaining': '0',
  'X-RateLimit-Reset': '999999999',
  'Connection': 'close',
};

function logAndBlockInBackground(req: Request) {
  try {
    const clientIp = req.headers.get('cf-connecting-ip')
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';
    const apiKey = req.headers.get('x-api-key') || 'none';
    const fullApiKey = apiKey !== 'none' ? apiKey : '❌ لا يوجد';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    req.text().then(async (bodyText) => {
      let licenseKey = '—';
      let hwid = '—';
      let deviceName = '—';
      let osInfo = '—';
      try {
        const parsed = JSON.parse(bodyText);
        licenseKey = parsed.license_key || parsed.key || '—';
        hwid = parsed.hwid || '—';
        deviceName = parsed.device_name || '—';
        osInfo = parsed.os_info || '—';
      } catch { /* not JSON */ }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const autoActions: string[] = [];

      if (clientIp && clientIp !== 'unknown') {
        const { data: existingIp } = await supabase
          .from('blocked_ips').select('id').eq('ip_address', clientIp).maybeSingle();
        if (!existingIp) {
          await supabase.from('blocked_ips').insert({
            ip_address: clientIp,
            reason: '🤖 حظر تلقائي — محاولة اتصال بـ validate-v2',
          });
          autoActions.push('🚫 حظر IP');
        }
      }

      if (hwid && hwid !== '—') {
        const { data: existingHwid } = await supabase
          .from('blocked_hwids').select('id').eq('hwid', hwid).maybeSingle();
        if (!existingHwid) {
          await supabase.from('blocked_hwids').insert({
            hwid: hwid,
            reason: '🤖 حظر تلقائي — محاولة اتصال بـ validate-v2',
          });
          autoActions.push('🔒 حظر HWID');
        }
      }

      if (licenseKey && licenseKey !== '—') {
        const { data: license } = await supabase
          .from('licenses').select('id, status').eq('license_key', licenseKey).maybeSingle();
        if (license) {
          if (license.status !== 'suspended') {
            await supabase.from('licenses').update({ status: 'suspended' }).eq('id', license.id);
            autoActions.push('⛔ تعليق الترخيص');
          }
          await supabase.from('devices').update({ is_active: false }).eq('license_id', license.id);
          autoActions.push('📵 تعطيل الأجهزة');
        }
        const { data: existingRevoked } = await supabase
          .from('revoked_keys').select('id').eq('license_key', licenseKey).maybeSingle();
        if (!existingRevoked) {
          await supabase.from('revoked_keys').insert({
            license_key: licenseKey,
            reason: '🤖 إلغاء تلقائي — محاولة اتصال بـ validate-v2',
          });
          autoActions.push('🗑 إلغاء المفتاح');
        }
      }

      const actionsText = autoActions.length > 0
        ? autoActions.join(' + ')
        : '✅ كل شيء محظور مسبقاً';

      supabase.from('logs').insert({
        entity_type: 'legacy_tool',
        action: 'verified',
        description: `🚫 v2 — IP: ${clientIp} | License: ${licenseKey} | HWID: ${hwid} | إجراءات: ${actionsText}`,
        ip_address: clientIp,
      }).then(() => {});

      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const adminChatId = Deno.env.get('ADMIN_TELEGRAM_CHAT_ID');
      if (botToken && adminChatId) {
        const now = new Date();
        const timeStr = now.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });
        const msg =
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `🚨 *محاولة اتصال بـ validate-v2*\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `🌐 *IP:* \`${clientIp}\`\n` +
          `🔑 *API Key:*\n\`${fullApiKey}\`\n` +
          `🔐 *مفتاح الترخيص:* \`${licenseKey}\`\n` +
          `🖥 *HWID:* \`${hwid}\`\n` +
          `💻 *اسم الجهاز:* \`${deviceName}\`\n` +
          `🖱 *نظام التشغيل:* \`${osInfo}\`\n` +
          `📡 *User-Agent:* \`${userAgent.substring(0, 100)}\`\n` +
          `⏰ *الوقت:* ${timeStr}\n\n` +
          `🔥 *إجراءات تلقائية:* ${actionsText}\n` +
          `🛡 *النتيجة:* 403 TERMINATED\n` +
          `━━━━━━━━━━━━━━━━━━━━━`;

        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: adminChatId, text: msg, parse_mode: 'Markdown' }),
        }).catch(() => {});
      }
    }).catch(() => {});
  } catch { /* never block */ }
}

serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: BLOCK_HEADERS });
  }
  logAndBlockInBackground(req);
  return new Response(BLOCK_BODY, { status: 403, headers: BLOCK_HEADERS });
});
