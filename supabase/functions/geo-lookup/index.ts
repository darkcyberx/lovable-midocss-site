import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const ip = url.searchParams.get("ip");

    if (!ip) {
      return new Response(
        JSON.stringify({ error: "Missing ip parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate IP format
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^[0-9a-fA-F:]+$/;
    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
      return new Response(
        JSON.stringify({ error: "Invalid IP address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = Deno.env.get("IPINFO_TOKEN");
    const apiUrl = token
      ? `https://ipinfo.io/${ip}?token=${token}`
      : `https://ipinfo.io/${ip}/json`;

    const geoRes = await fetch(apiUrl);

    if (!geoRes.ok) {
      throw new Error(`ipinfo.io returned ${geoRes.status}`);
    }

    const raw = await geoRes.json();

    if (raw.error) {
      return new Response(
        JSON.stringify({ error: raw.error.message || "Lookup failed" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse loc "lat,lon" → numbers
    let lat = 0, lon = 0;
    if (raw.loc) {
      const parts = raw.loc.split(",");
      lat = parseFloat(parts[0]) || 0;
      lon = parseFloat(parts[1]) || 0;
    }

    // Normalize to match the existing GeoInfo interface in the frontend
    const data = {
      status: "success",
      query: raw.ip || ip,
      continent: "",
      continentCode: "",
      country: raw.country || "—",
      countryCode: raw.country || "—",
      region: raw.region || "—",
      regionName: raw.region || "—",
      city: raw.city || "—",
      zip: raw.postal || "—",
      lat,
      lon,
      timezone: raw.timezone || "—",
      offset: 0,
      currency: "",
      isp: raw.org || "—",
      org: raw.org || "—",
      as: raw.org || "—",
      asname: raw.org || "—",
      reverse: raw.hostname || "—",
      mobile: false,
      proxy: false,
      hosting: false,
      // Extra ipinfo fields
      hostname: raw.hostname || "—",
      anycast: raw.anycast || false,
    };

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("geo-lookup error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
