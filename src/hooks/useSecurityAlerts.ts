import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SecurityAlert {
  id: string;
  type: "suspicious_ip" | "shared_hwid" | "expiring_license" | "pending_renewal";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  count?: number;
  link: string;
  details?: AlertDetail[];
}

export interface AlertDetail {
  label: string;
  value: string;
  mono?: boolean; // monospace font for keys/IPs/HWIDs
  highlight?: boolean;
}

export function useSecurityAlerts() {
  return useQuery({
    queryKey: ["security-alerts"],
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async (): Promise<SecurityAlert[]> => {
      const alerts: SecurityAlert[] = [];

      // ── 1. Suspicious IPs ─────────────────────────────────────────────────
      const [ipLogsResult, blockedIpsResult] = await Promise.all([
        supabase
          .from("logs")
          .select("ip_address, description, created_at")
          .eq("entity_type", "security")
          .not("ip_address", "is", null),
        supabase.from("blocked_ips").select("ip_address"),
      ]);

      if (ipLogsResult.data) {
        const blockedSet = new Set(
          (blockedIpsResult.data || []).map((b) => b.ip_address)
        );

        // Count per IP + collect license keys tried
        const ipCounts: Record<string, number> = {};
        const ipLastSeen: Record<string, string> = {};
        const ipKeys: Record<string, Set<string>> = {};

        ipLogsResult.data.forEach(({ ip_address, description, created_at }) => {
          if (!ip_address || blockedSet.has(ip_address)) return;
          ipCounts[ip_address] = (ipCounts[ip_address] || 0) + 1;
          if (!ipLastSeen[ip_address] || (created_at && created_at > ipLastSeen[ip_address])) {
            ipLastSeen[ip_address] = created_at || "";
          }
          // Extract license key from description (e.g. "Invalid key: lm_xxx")
          const match = description?.match(/(?:key|مفتاح)[:\s]+(\S+)/i);
          if (match) {
            if (!ipKeys[ip_address]) ipKeys[ip_address] = new Set();
            ipKeys[ip_address].add(match[1]);
          }
        });

        Object.entries(ipCounts)
          .filter(([, count]) => count >= 20)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .forEach(([ip, count]) => {
            const lastSeen = ipLastSeen[ip]
              ? new Date(ipLastSeen[ip]).toLocaleString("ar-EG")
              : "—";
            const triedKeys = ipKeys[ip] ? [...ipKeys[ip]].slice(0, 5) : [];

            const details: AlertDetail[] = [
              { label: "عنوان الـ IP", value: ip, mono: true, highlight: true },
              { label: "عدد المحاولات", value: `${count} محاولة فاشلة`, highlight: count >= 40 },
              { label: "آخر نشاط", value: lastSeen },
              { label: "الحالة", value: "غير محظور — يحتاج إجراء فوري", highlight: true },
              ...triedKeys.map((k, i) => ({
                label: i === 0 ? "مفاتيح جُرّبت" : "",
                value: k,
                mono: true,
              })),
            ];

            alerts.push({
              id: `suspicious_ip_${ip}`,
              type: "suspicious_ip",
              severity: count >= 40 ? "high" : "medium",
              title: `IP مشبوه: ${ip}`,
              description: `${count} محاولة فاشلة ولم يتم حجبه بعد`,
              count,
              link: "/ip-management",
              details,
            });
          });
      }

      // ── 2. Shared HWIDs ────────────────────────────────────────────────────
      const { data: deviceRows } = await supabase
        .from("devices")
        .select("hwid, device_name, license_id, licenses(customer_id, license_key, customers(name, email))")
        .eq("is_active", true);

      if (deviceRows) {
        const hwidCustomers: Record<string, Set<string>> = {};
        const hwidData: Record<string, { name: string; email?: string; licenseKey?: string }[]> = {};
        const hwidDeviceNames: Record<string, string[]> = {};

        deviceRows.forEach((d) => {
          const hwid = d.hwid;
          const custId = (d.licenses as any)?.customer_id as string | undefined;
          const custName = (d.licenses as any)?.customers?.name as string | undefined;
          const custEmail = (d.licenses as any)?.customers?.email as string | undefined;
          const licKey = (d.licenses as any)?.license_key as string | undefined;
          if (!custId) return;
          if (!hwidCustomers[hwid]) {
            hwidCustomers[hwid] = new Set();
            hwidData[hwid] = [];
            hwidDeviceNames[hwid] = [];
          }
          if (!hwidCustomers[hwid].has(custId)) {
            hwidCustomers[hwid].add(custId);
            hwidData[hwid].push({ name: custName || "—", email: custEmail, licenseKey: licKey });
          }
          if (d.device_name && !hwidDeviceNames[hwid].includes(d.device_name)) {
            hwidDeviceNames[hwid].push(d.device_name);
          }
        });

        Object.entries(hwidCustomers)
          .filter(([, customers]) => customers.size >= 2)
          .slice(0, 5)
          .forEach(([hwid, customers]) => {
            const names = hwidData[hwid].map((c) => c.name).slice(0, 3).join("، ");
            const deviceNames = hwidDeviceNames[hwid].join("، ") || "—";

            const details: AlertDetail[] = [
              { label: "HWID الكامل", value: hwid, mono: true, highlight: true },
              { label: "عدد العملاء", value: `${customers.size} عملاء يشاركون هذا الجهاز`, highlight: true },
              { label: "اسم الجهاز", value: deviceNames },
              ...hwidData[hwid].flatMap((c, i) => [
                { label: i === 0 ? "العملاء" : "", value: `👤 ${c.name}${c.email ? ` — ${c.email}` : ""}` },
                ...(c.licenseKey ? [{ label: "  ترخيصه", value: c.licenseKey, mono: true }] : []),
              ]),
            ];

            alerts.push({
              id: `shared_hwid_${hwid}`,
              type: "shared_hwid",
              severity: "high",
              title: `HWID مشترك بين ${customers.size} عملاء`,
              description: `${hwid.substring(0, 12)}... — ${names}`,
              count: customers.size,
              link: "/devices",
              details,
            });
          });
      }

      // ── 3. Expiring licenses ───────────────────────────────────────────────
      const in7Days = new Date();
      in7Days.setDate(in7Days.getDate() + 7);
      const now = new Date().toISOString();

      const { data: expiringLicenses } = await supabase
        .from("licenses")
        .select("id, license_key, expire_at, customers(name, email)")
        .eq("status", "active")
        .not("expire_at", "is", null)
        .lte("expire_at", in7Days.toISOString())
        .gte("expire_at", now)
        .limit(50);

      if (expiringLicenses && expiringLicenses.length > 0) {
        const details: AlertDetail[] = expiringLicenses.flatMap((l) => {
          const daysLeft = l.expire_at
            ? Math.ceil((new Date(l.expire_at).getTime() - Date.now()) / 86400000)
            : null;
          return [
            {
              label: (l.customers as any)?.name || "—",
              value: l.license_key,
              mono: true,
            },
            {
              label: "  ينتهي",
              value: `${l.expire_at ? new Date(l.expire_at).toLocaleDateString("ar-EG") : "—"}${daysLeft !== null ? ` — بعد ${daysLeft} يوم` : ""}`,
              highlight: daysLeft !== null && daysLeft <= 2,
            },
          ];
        });

        alerts.push({
          id: "expiring_licenses",
          type: "expiring_license",
          severity: expiringLicenses.length >= 5 ? "high" : "medium",
          title: `${expiringLicenses.length} ترخيص ينتهي خلال 7 أيام`,
          description: expiringLicenses
            .slice(0, 2)
            .map((l) => `${(l.customers as any)?.name || "—"}: ${l.license_key}`)
            .join(" • "),
          count: expiringLicenses.length,
          link: "/licenses",
          details,
        });
      }

      // ── 4. Pending renewals ────────────────────────────────────────────────
      const [renewalsResult, registrationsResult] = await Promise.all([
        supabase
          .from("renewal_requests")
          .select("id, status, days, amount, created_at, customers(name)")
          .eq("status", "pending"),
        supabase
          .from("registration_requests")
          .select("id, name, email, requested_days, amount, created_at")
          .eq("status", "pending"),
      ]);

      const pendingRenewals = renewalsResult.data || [];
      const pendingRegistrations = registrationsResult.data || [];
      const totalPending = pendingRenewals.length + pendingRegistrations.length;

      if (totalPending > 0) {
        const details: AlertDetail[] = [
          ...(pendingRenewals.length > 0
            ? [{ label: "طلبات تجديد", value: `${pendingRenewals.length} طلب`, highlight: true }]
            : []),
          ...pendingRenewals.slice(0, 5).map((r) => ({
            label: (r.customers as any)?.name || "—",
            value: `${r.days} يوم — ${r.amount} ج.م — ${new Date(r.created_at).toLocaleDateString("ar-EG")}`,
          })),
          ...(pendingRegistrations.length > 0
            ? [{ label: "طلبات تسجيل", value: `${pendingRegistrations.length} طلب`, highlight: true }]
            : []),
          ...pendingRegistrations.slice(0, 5).map((r) => ({
            label: r.name,
            value: `${r.email} — ${r.requested_days ?? "—"} يوم — ${new Date(r.created_at).toLocaleDateString("ar-EG")}`,
          })),
        ];

        alerts.push({
          id: "pending_renewals",
          type: "pending_renewal",
          severity: totalPending >= 5 ? "medium" : "low",
          title: `${totalPending} طلب انتظار`,
          description: [
            pendingRenewals.length > 0 ? `${pendingRenewals.length} طلب تجديد` : "",
            pendingRegistrations.length > 0 ? `${pendingRegistrations.length} طلب تسجيل` : "",
          ]
            .filter(Boolean)
            .join(" • "),
          count: totalPending,
          link: "/renewal-orders",
          details,
        });
      }

      const order = { high: 0, medium: 1, low: 2 };
      alerts.sort((a, b) => order[a.severity] - order[b.severity]);
      return alerts;
    },
  });
}
