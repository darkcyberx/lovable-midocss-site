import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BLOCK_BODY = '{"valid":false,"error":"Access denied","force_shutdown":true,"update_required":true}';
const BLOCK_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: BLOCK_HEADERS });
  }

  return new Response(BLOCK_BODY, { status: 403, headers: BLOCK_HEADERS });
});
