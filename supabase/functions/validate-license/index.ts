import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// ── Auto-block config ────────────────────────────────────────────────────────
const AUTO_BLOCK_THRESHOLD = 30;    // block IP after N failed attempts
const FORCE_SHUTDOWN_THRESHOLD = 15; // send force_shutdown:true after N failed attempts

// ── Rate limiting ────────────────────────────────────────────────────────────
const rateLimitWindow = 60000;
const maxRequestsPerWindow = 30;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) rateLimitMap.delete(key);
  }
}, 300000);

function checkRateLimit(apiKey: string): boolean {
  const now = Date.now();
  const limitData = rateLimitMap.get(apiKey);
  if (!limitData || now > limitData.resetTime) {
    rateLimitMap.set(apiKey, { count: 1, resetTime: now + rateLimitWindow });
    return true;
  }
  if (limitData.count >= maxRequestsPerWindow) return false;
  limitData.count++;
  return true;
}

function getClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

// ── Check failed attempts count for this IP ───────────────────────────────────
async function getFailedCount(
  supabase: ReturnType<typeof createClient>,
  clientIp: string
): Promise<number> {
  if (clientIp === 'unknown') return 0;
  const { count } = await supabase
    .from('logs')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', 'security')
    .eq('ip_address', clientIp);
  return count ?? 0;
}

// ── Auto-block + force_shutdown helper ──────────────────────────────────────
async function checkAndAutoBlock(
  supabase: ReturnType<typeof createClient>,
  clientIp: string
): Promise<{ forceShutdown: boolean }> {
  if (clientIp === 'unknown') return { forceShutdown: false };

  const failedCount = await getFailedCount(supabase, clientIp);
  const forceShutdown = failedCount >= FORCE_SHUTDOWN_THRESHOLD;

  if (failedCount >= AUTO_BLOCK_THRESHOLD) {
    const { error } = await supabase
      .from('blocked_ips')
      .insert({
        ip_address: clientIp,
        reason: `تم الحجب تلقائياً — ${failedCount} محاولة فاشلة (Auto-Block)`,
      });

    if (!error) {
      console.warn(`[AUTO-BLOCK] IP ${clientIp} blocked after ${failedCount} failed attempts`);
      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const adminChatId = Deno.env.get('ADMIN_TELEGRAM_CHAT_ID');
      if (botToken && adminChatId) {
        const msg =
          `🚫 *تم حجب IP تلقائياً*\n\n` +
          `🌐 العنوان: \`${clientIp}\`\n` +
          `🔢 المحاولات: *${failedCount}* محاولة فاشلة\n` +
          `⏰ الوقت: ${new Date().toLocaleString('ar-EG')}\n\n` +
          `يمكنك مراجعة وإلغاء الحجب من صفحة *إدارة الـ IP*.`;
        await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: adminChatId, text: msg, parse_mode: 'Markdown' }),
          }
        ).catch(() => {});
      }
    }
  }

  return { forceShutdown };
}

const LICENSE_KEY_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

// ── Legacy API key prefixes — blocked in-memory, ZERO DB calls ────────────
const LEGACY_KEY_PREFIXES = ['lm_s3hzo'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp = getClientIp(req);
    const apiKey = req.headers.get('x-api-key');

    // ══════════════════════════════════════════════════════════════════════════
    // ⚡ INSTANT LEGACY BLOCK — no DB, no parsing, sub-millisecond rejection
    // ══════════════════════════════════════════════════════════════════════════
    if (apiKey) {
      for (const prefix of LEGACY_KEY_PREFIXES) {
        if (apiKey.startsWith(prefix)) {
          // Fire-and-forget: log + notify in background after response
          const supabaseBg = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          );

          // Parse body in background for logging only
          const bgLog = async () => {
            let licenseKey = 'unknown';
            let hwid: string | null = null;
            try {
              const body = await req.clone().json();
              licenseKey = body?.license_key?.toString()?.substring(0, 50) ?? 'unknown';
              hwid = body?.hwid?.toString()?.substring(0, 50) ?? null;
            } catch { /* ignore */ }

            await supabaseBg.from('logs').insert({
              entity_type: 'legacy_tool',
              action: 'verified',
              description: `⚡ صد فوري | مفتاح: ${licenseKey} | HWID: ${hwid ?? 'غير محدد'} | IP: ${clientIp}`,
              ip_address: clientIp,
            });

            const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
            const adminChatId = Deno.env.get('ADMIN_TELEGRAM_CHAT_ID');
            if (botToken && adminChatId) {
              await fetch(
                `https://api.telegram.org/bot${botToken}/sendMessage`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: adminChatId,
                    text: `🔴 *صد فوري — أداة قديمة*\n\n🌐 IP: \`${clientIp}\`\n⏰ ${new Date().toLocaleString('ar-EG')}`,
                    parse_mode: 'Markdown',
                  }),
                }
              ).catch(() => {});
            }
          };
          bgLog().catch(() => {});

          // Return IMMEDIATELY — tool gets killed before anything else
          return new Response(
            JSON.stringify({
              valid: false,
              error: 'Access denied',
              force_shutdown: true,
              update_required: true,
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // ── Normal flow starts here (non-legacy requests) ─────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── Kill Switch: if old endpoint is disabled, reject all requests ─────────
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('kill_old_endpoint, kill_switch_response')
      .limit(1)
      .single();

    if (settings?.kill_old_endpoint === true) {
      console.warn(`[KILL SWITCH] Old endpoint blocked request from ${clientIp}`);
      // Use custom response if set, otherwise default
      let killBody: object = { error: 'Service discontinued. Please update your tool.', valid: false, force_shutdown: true };
      if (settings.kill_switch_response) {
        try { killBody = JSON.parse(settings.kill_switch_response); } catch { /* keep default */ }
      }
      return new Response(
        JSON.stringify(killBody),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── HWID Block Check (FIRST — before everything) ──────────────────────────
    // Read body early to extract hwid for immediate hardware-level blocking
    let rawBody: Record<string, unknown> = {};
    try {
      const cloned = req.clone();
      rawBody = await cloned.json();
    } catch { /* ignore parse errors here, handled later */ }

    const earlyHwid = rawBody?.hwid && typeof rawBody.hwid === 'string'
      ? (rawBody.hwid as string).slice(0, 255)
      : null;

    if (earlyHwid) {
      const { data: blockedHwid } = await supabase
        .from('blocked_hwids')
        .select('id')
        .eq('hwid', earlyHwid)
        .maybeSingle();

      if (blockedHwid) {
        console.warn(`[HWID BLOCK] Blocked hardware attempted access: ${earlyHwid.substring(0, 16)}...`);
        supabase.from('logs').insert({
          entity_type: 'security',
          action: 'verified',
          description: `جهاز محظور حاول التفعيل (HWID Block)`,
          ip_address: clientIp,
        }).then(() => {}).catch(() => {});
        return new Response(
          JSON.stringify({ error: 'Access denied', valid: false, force_shutdown: true }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── IP Block Check ────────────────────────────────────────────────────────
    const { data: blockedIp } = await supabase
      .from('blocked_ips')
      .select('id, reason')
      .eq('ip_address', clientIp)
      .maybeSingle();

    if (blockedIp) {
      console.warn(`Blocked IP attempted access: ${clientIp}`);
      supabase.from('logs').insert({
        entity_type: 'security',
        action: 'verified',
        description: `Blocked IP attempted license validation`,
        ip_address: clientIp,
      }).then(() => {}).catch(() => {});
      return new Response(
        JSON.stringify({ error: 'Access denied', valid: false, force_shutdown: true }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      // Fire log in background — respond immediately
      supabase.from('logs').insert({
        entity_type: 'security',
        action: 'verified',
        description: 'محاولة تفعيل بدون مفتاح API',
        ip_address: clientIp,
      }).then(() => checkAndAutoBlock(supabase, clientIp)).catch(() => {});
      return new Response(
        JSON.stringify({ error: 'Missing API key', valid: false, force_shutdown: true }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!checkRateLimit(apiKey)) {
      console.warn(`Rate limit exceeded for API key prefix: ${apiKey.substring(0, 8)}...`);
      supabase.from('logs').insert({
        entity_type: 'security',
        action: 'verified',
        description: `تجاوز حد الطلبات - مفتاح: ${apiKey.substring(0, 8)}...`,
        ip_address: clientIp,
      }).then(() => checkAndAutoBlock(supabase, clientIp)).catch(() => {});
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.', valid: false, force_shutdown: true }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: apiKeyData, error: apiKeyError } = await supabase
      .rpc('validate_api_key_by_value', { api_key_value: apiKey })
      .single();

    if (apiKeyError || !apiKeyData) {
      console.error('Invalid API key attempt detected');
      supabase.from('logs').insert({
        entity_type: 'security',
        action: 'verified',
        description: `محاولة تفعيل بمفتاح API غير صالح - البادئة: ${apiKey.substring(0, 8)}...`,
        ip_address: clientIp,
      }).then(() => checkAndAutoBlock(supabase, clientIp)).catch(() => {});
      return new Response(
        JSON.stringify({ error: 'Invalid API key', valid: false, force_shutdown: true }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!apiKeyData.is_active) {
      supabase.from('logs').insert({
        entity_type: 'security',
        action: 'verified',
        description: `محاولة تفعيل بمفتاح API معطّل - البادئة: ${apiKey.substring(0, 8)}...`,
        ip_address: clientIp,
      }).then(() => checkAndAutoBlock(supabase, clientIp)).catch(() => {});
      return new Response(
        JSON.stringify({ error: 'API key is inactive', valid: false, force_shutdown: true }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
      supabase.from('logs').insert({
        entity_type: 'security',
        action: 'verified',
        description: `محاولة تفعيل بمفتاح API منتهي الصلاحية - البادئة: ${apiKey.substring(0, 8)}...`,
        ip_address: clientIp,
      }).then(() => checkAndAutoBlock(supabase, clientIp)).catch(() => {});
      return new Response(
        JSON.stringify({ error: 'API key has expired', valid: false, force_shutdown: true }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.rpc('update_api_key_last_used', { api_key_value: apiKey });


    let body: Record<string, unknown>;
    try {
      body = rawBody && Object.keys(rawBody).length > 0 ? rawBody : await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid request body', valid: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { license_key, hwid, device_name, os_info } = body;

    if (!license_key || typeof license_key !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing license key', valid: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!LICENSE_KEY_PATTERN.test(license_key)) {
      return new Response(
        JSON.stringify({ error: 'Invalid license key format', valid: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Revoked Key Check ─────────────────────────────────────────────────────
    // Keys that were deleted or regenerated are blacklisted here.
    // Treat them as security threats (403) to trigger Auto-Block.
    const { data: revokedKey } = await supabase
      .from('revoked_keys')
      .select('id, reason')
      .eq('license_key', license_key)
      .maybeSingle();

    if (revokedKey) {
      console.warn(`[REVOKED KEY] Attempt with revoked key: ${license_key}`);
      await supabase.from('logs').insert({
        entity_type: 'security',
        action: 'verified',
        description: `محاولة تفعيل بمفتاح ملغى: ${license_key}`,
        ip_address: clientIp,
      });
      // Trigger auto-block check in background (don't await)
      checkAndAutoBlock(supabase, clientIp).catch(() => {});
      // Always return force_shutdown: true immediately for revoked keys
      return new Response(
        JSON.stringify({ error: 'Access denied', valid: false, force_shutdown: true }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const safeHwid = hwid && typeof hwid === 'string' ? hwid.slice(0, 255) : undefined;
    const safeDeviceName = device_name && typeof device_name === 'string' ? device_name.slice(0, 200) : undefined;
    const safeOsInfo = os_info && typeof os_info === 'string' ? os_info.slice(0, 200) : undefined;

    const { data: license, error: licenseError } = await supabase
      .from('licenses')
      .select(`*, customer:customers(*), product:products(*)`)
      .eq('license_key', license_key)
      .single();

    if (licenseError || !license) {
      console.log('License validation failed: key not found');
      // Fire log + auto-block in background — don't await to respond immediately
      supabase.from('logs').insert({
        entity_type: 'security',
        action: 'verified',
        description: `محاولة تفعيل بمفتاح غير موجود: ${license_key}`,
        ip_address: clientIp,
      }).then(() => checkAndAutoBlock(supabase, clientIp)).catch(() => {});
      // Immediate force_shutdown for any unknown key — no delay
      return new Response(
        JSON.stringify({ error: 'License not found', valid: false, force_shutdown: true }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (license.status !== 'active') {
      // Suspended/expired licenses → force shutdown immediately
      return new Response(
        JSON.stringify({
          error: `License is ${license.status}`,
          valid: false,
          force_shutdown: license.status === 'suspended',
          license: { key: license.license_key, status: license.status }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (license.expire_at && new Date(license.expire_at) < new Date()) {
      return new Response(
        JSON.stringify({
          error: 'License has expired',
          valid: false,
          license: { key: license.license_key, status: 'expired', expire_at: license.expire_at }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (safeHwid) {
      const { data: blockedDevice } = await supabase
        .from('devices')
        .select('id, is_active')
        .eq('license_id', license.id)
        .eq('hwid', safeHwid)
        .eq('is_active', false)
        .maybeSingle();

      if (blockedDevice) {
        console.warn(`Blocked device attempted validation: ${safeHwid.substring(0, 16)}...`);
        await supabase.from('logs').insert({
          entity_type: 'security',
          action: 'verified',
          description: `Blocked device attempted license validation`,
          ip_address: clientIp,
        });
        return new Response(
          JSON.stringify({ error: 'Device is blocked. Please contact support.', valid: false }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: devices } = await supabase
        .from('devices')
        .select('*')
        .eq('license_id', license.id)
        .eq('is_active', true);

      const deviceCount = devices?.length || 0;
      const existingDevice = devices?.find(d => d.hwid === safeHwid);

      if (!existingDevice && deviceCount >= license.max_devices) {
        return new Response(
          JSON.stringify({
            error: 'Maximum devices reached',
            valid: false,
            license: { key: license.license_key, max_devices: license.max_devices, current_devices: deviceCount }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (existingDevice) {
        await supabase
          .from('devices')
          .update({
            last_verified: new Date().toISOString(),
            device_name: safeDeviceName || existingDevice.device_name,
            os_info: safeOsInfo || existingDevice.os_info
          })
          .eq('id', existingDevice.id);
      } else {
        await supabase
          .from('devices')
          .insert({
            license_id: license.id,
            hwid: safeHwid,
            device_name: safeDeviceName,
            os_info: safeOsInfo,
            last_verified: new Date().toISOString()
          });
      }
    }

    await supabase.from('logs').insert({
      entity_type: 'license',
      entity_id: license.id,
      action: 'verified',
      description: `License validated via API`,
      user_id: apiKeyData.user_id,
      ip_address: clientIp,
    });

    return new Response(
      JSON.stringify({
        valid: true,
        license: {
          key: license.license_key,
          status: license.status,
          expire_at: license.expire_at,
          max_devices: license.max_devices,
          customer: license.customer?.name,
          product: license.product?.name
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in validate-license function:', error instanceof Error ? error.message : 'Unknown error');
    return new Response(
      JSON.stringify({ error: 'Internal server error', valid: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
