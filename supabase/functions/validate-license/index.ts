import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── TOTAL INSTANT BLOCK — validate-license is DEAD ──────────────────────────
// All legitimate clients MUST use validate-v2.
// This endpoint returns 403 in ~0.01ms with ZERO database calls.

const BLOCK_BODY = '{"valid":false,"error":"Access denied","force_shutdown":true,"update_required":true}';
const BLOCK_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

serve((req) => {
  // Allow CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: BLOCK_HEADERS });
  }

  // INSTANT 403 — no DB, no parsing, no async, no await
  return new Response(BLOCK_BODY, { status: 403, headers: BLOCK_HEADERS });
});
