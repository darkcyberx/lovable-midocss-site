import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing API key', valid: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify API key
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('user_id, is_active, expires_at')
      .eq('key', apiKey)
      .single();

    if (apiKeyError || !apiKeyData) {
      console.error('Invalid API key attempt detected');
      return new Response(
        JSON.stringify({ error: 'Invalid API key', valid: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!apiKeyData.is_active) {
      return new Response(
        JSON.stringify({ error: 'API key is inactive', valid: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'API key has expired', valid: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_used_at
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key', apiKey);

    // Get license key from request
    const { license_key, hwid } = await req.json();

    if (!license_key) {
      return new Response(
        JSON.stringify({ error: 'Missing license key', valid: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate license
    const { data: license, error: licenseError } = await supabase
      .from('licenses')
      .select(`
        *,
        customer:customers(*),
        product:products(*)
      `)
      .eq('license_key', license_key)
      .single();

    if (licenseError || !license) {
      console.log('License validation failed: key not found');
      return new Response(
        JSON.stringify({ 
          error: 'License not found', 
          valid: false 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check license status
    if (license.status !== 'active') {
      return new Response(
        JSON.stringify({ 
          error: `License is ${license.status}`, 
          valid: false,
          license: {
            key: license.license_key,
            status: license.status
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check expiration
    if (license.expire_at && new Date(license.expire_at) < new Date()) {
      return new Response(
        JSON.stringify({ 
          error: 'License has expired', 
          valid: false,
          license: {
            key: license.license_key,
            status: 'expired',
            expire_at: license.expire_at
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check device if HWID provided
    if (hwid) {
      const { data: devices } = await supabase
        .from('devices')
        .select('*')
        .eq('license_id', license.id)
        .eq('is_active', true);

      const deviceCount = devices?.length || 0;
      const existingDevice = devices?.find(d => d.hwid === hwid);

      if (!existingDevice && deviceCount >= license.max_devices) {
        return new Response(
          JSON.stringify({ 
            error: 'Maximum devices reached', 
            valid: false,
            license: {
              key: license.license_key,
              max_devices: license.max_devices,
              current_devices: deviceCount
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Register or update device
      if (existingDevice) {
        await supabase
          .from('devices')
          .update({ last_verified: new Date().toISOString() })
          .eq('id', existingDevice.id);
      } else {
        await supabase
          .from('devices')
          .insert({
            license_id: license.id,
            hwid: hwid,
            last_verified: new Date().toISOString()
          });
      }
    }

    // Log the validation
    await supabase
      .from('logs')
      .insert({
        entity_type: 'license',
        entity_id: license.id,
        action: 'validate',
        description: `License validated via API: ${license_key}`,
        user_id: apiKeyData.user_id
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage, valid: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});