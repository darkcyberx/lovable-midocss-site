import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Shield, ShieldOff, Search, Ban, Globe, Activity, AlertTriangle, Clock,
  Trash2, Copy, RefreshCw, User, Eye, FileText, Key, Monitor, Cpu,
  MapPin, Building2, Flag, Wifi, CheckCircle2, XCircle, BarChart3,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface BlockedIp {
  id: string;
  ip_address: string;
  reason: string | null;
  created_at: string;
}

interface IpActivity {
  ip_address: string;
  request_count: number;
  last_seen: string;
  is_blocked: boolean;
  customer_name: string | null;
  attempted_keys: string[];
}

interface IpLog {
  id: string;
  action: string;
  entity_type: string;
  description: string;
  created_at: string;
}

interface GeoInfo {
  country: string;
  countryCode: string;
  continent: string;
  city: string;
  regionName: string;
  zip: string;
  isp: string;
  org: string;
  as: string;
  asname: string;
  reverse: string;
  timezone: string;
  currency: string;
  lat: number;
  lon: number;
  mobile: boolean;
  proxy: boolean;
  hosting: boolean;
}

interface DeviceInfo {
  device_name: string | null;
  os_info: string | null;
  hwid: string;
  last_verified: string | null;
  is_active: boolean | null;
  license_key: string | null;
  customer_name: string | null;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

const getLogIcon = (entityType: string, description: string) => {
  if (entityType === "security") return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  if (description.toLowerCase().includes("license") || description.includes("ترخيص") || description.includes("مفتاح")) return <Key className="h-3.5 w-3.5 text-primary" />;
  return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
};

const getLogBadgeVariant = (entityType: string): "destructive" | "secondary" | "outline" => {
  if (entityType === "security") return "destructive";
  return "secondary";
};

// ─── IP Detail Drawer ─────────────────────────────────
function IpDetailDrawer({ ip, isOpen, onClose }: { ip: IpActivity | null; isOpen: boolean; onClose: () => void }) {
  // Fetch logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["ip-logs", ip?.ip_address],
    enabled: isOpen && !!ip?.ip_address,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logs")
        .select("id, action, entity_type, description, created_at, entity_id")
        .eq("ip_address", ip!.ip_address)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as (IpLog & { entity_id: string | null })[];
    },
  });

  // Fetch geo info via Edge Function → ip-api.com (server-side, no CORS, full data)
  const { data: geoInfo, isLoading: geoLoading } = useQuery({
    queryKey: ["geo-info", ip?.ip_address],
    enabled: isOpen && !!ip?.ip_address,
    staleTime: 1000 * 60 * 60,
    retry: 1,
    queryFn: async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/geo-lookup?ip=${encodeURIComponent(ip!.ip_address)}`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        );
        if (!res.ok) return null;
        const d = await res.json();
        if (d.error || d.status !== "success") return null;
        return {
          country: d.country ?? "—",
          countryCode: d.countryCode ?? "—",
          continent: d.continent ?? "—",
          city: d.city ?? "—",
          regionName: d.regionName ?? "—",
          zip: d.zip ?? "—",
          isp: d.isp ?? "—",
          org: d.org ?? "—",
          as: d.as ?? "—",
          asname: d.asname ?? "—",
          reverse: d.reverse ?? "—",
          timezone: d.timezone ?? "—",
          currency: d.currency ?? "—",
          lat: d.lat ?? 0,
          lon: d.lon ?? 0,
          mobile: d.mobile ?? false,
          proxy: d.proxy ?? false,
          hosting: d.hosting ?? false,
        } as GeoInfo;
      } catch { return null; }
    },
  });

  // Fetch devices linked to licenses accessed from this IP
  const { data: devices } = useQuery({
    queryKey: ["ip-devices", ip?.ip_address, logs?.length],
    enabled: isOpen && !!logs?.length,
    queryFn: async () => {
      const licenseIds = [...new Set(
        (logs || []).filter(l => l.entity_type === "license" && l.entity_id).map(l => l.entity_id!)
      )];
      if (!licenseIds.length) return [] as DeviceInfo[];
      const { data } = await supabase
        .from("devices")
        .select("device_name, os_info, hwid, last_verified, is_active, license_id, licenses!inner(license_key, customers(name))")
        .in("license_id", licenseIds);
      return (data || []).map((d: any) => ({
        device_name: d.device_name,
        os_info: d.os_info,
        hwid: d.hwid,
        last_verified: d.last_verified,
        is_active: d.is_active,
        license_key: d.licenses?.license_key ?? null,
        customer_name: d.licenses?.customers?.name ?? null,
      })) as DeviceInfo[];
    },
  });

  const licKeyRegex = /([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/g;
  const securityLogs = logs?.filter(l => l.entity_type === "security") || [];
  const successLogs = logs?.filter(l => l.entity_type === "license") || [];
  const allKeys = new Set<string>();
  logs?.forEach(l => { const m = l.description.matchAll(licKeyRegex); for (const x of m) allKeys.add(x[1]); });

  // Activity per hour (last 24h bar chart)
  const hourlyActivity = (() => {
    if (!logs) return [];
    const now = Date.now();
    const counts: Record<number, number> = {};
    logs.forEach(l => {
      const h = Math.floor((now - new Date(l.created_at).getTime()) / (1000 * 60 * 60));
      if (h < 24) counts[h] = (counts[h] || 0) + 1;
    });
    return Array.from({ length: 24 }, (_, i) => ({ h: 23 - i, c: counts[23 - i] || 0 })).reverse();
  })();
  const maxHourly = Math.max(...hourlyActivity.map(x => x.c), 1);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="p-5 pb-3 border-b bg-muted/20">
          <SheetTitle className="flex items-center gap-2 text-base flex-wrap">
            <Globe className="h-5 w-5 text-primary shrink-0" />
            <code className="font-mono text-lg">{ip?.ip_address}</code>
            {ip?.is_blocked && <Badge variant="destructive" className="text-xs gap-1"><Ban className="h-3 w-3" />محظور</Badge>}
            {geoInfo?.proxy && <Badge variant="outline" className="text-xs gap-1 border-orange-300 text-orange-600">Proxy/VPN</Badge>}
            {geoInfo?.hosting && <Badge variant="outline" className="text-xs gap-1 border-yellow-300 text-yellow-600"><Building2 className="h-3 w-3" />Hosting</Badge>}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-4">

            {/* ── Stats ── */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">إجمالي الطلبات</p>
                <p className="text-2xl font-bold">{ip?.request_count ?? 0}</p>
              </div>
              <div className="rounded-xl border bg-destructive/10 p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">محاولات فاشلة</p>
                <p className="text-2xl font-bold text-destructive">{securityLogs.length}</p>
              </div>
              <div className="rounded-xl border bg-primary/5 p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">تفعيلات ناجحة</p>
                <p className="text-2xl font-bold text-primary">{successLogs.length}</p>
              </div>
            </div>

            {/* ── Geo Info ── */}
            <div className="rounded-xl border overflow-hidden">
              <div className="bg-muted/40 px-4 py-2.5 flex items-center gap-2 border-b">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">الموقع الجغرافي</span>
                {geoInfo && (
                  <div className="flex items-center gap-1.5 mr-auto">
                    {geoInfo.proxy && <Badge variant="outline" className="text-[10px] h-5 border-orange-300 text-orange-600">🛡️ Proxy/VPN</Badge>}
                    {geoInfo.hosting && <Badge variant="outline" className="text-[10px] h-5 border-yellow-300 text-yellow-600">🖥️ Hosting</Badge>}
                    {geoInfo.mobile && <Badge variant="outline" className="text-[10px] h-5 border-blue-300 text-blue-600">📱 موبايل</Badge>}
                  </div>
                )}
              </div>
              {geoLoading ? (
                <div className="p-4 text-center text-muted-foreground text-sm animate-pulse">جاري جلب معلومات الموقع...</div>
              ) : !geoInfo ? (
                <div className="p-4 text-center text-muted-foreground text-sm">تعذّر جلب معلومات الموقع</div>
              ) : (
                <div className="p-4 space-y-3">
                  {/* Row 1: Country + City */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <Flag className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">الدولة / القارة</p>
                        <p className="text-sm font-semibold">{geoInfo.country} ({geoInfo.countryCode})</p>
                        <p className="text-xs text-muted-foreground">{geoInfo.continent}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">المدينة / المنطقة</p>
                        <p className="text-sm font-semibold">{geoInfo.city}, {geoInfo.regionName}</p>
                        {geoInfo.zip && geoInfo.zip !== "—" && <p className="text-xs text-muted-foreground">ZIP: {geoInfo.zip}</p>}
                      </div>
                    </div>
                  </div>
                  {/* Row 2: ISP + Org */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <Wifi className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">مزود الإنترنت (ISP)</p>
                        <p className="text-sm font-medium">{geoInfo.isp}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">المنظمة</p>
                        <p className="text-sm font-medium truncate">{geoInfo.org}</p>
                      </div>
                    </div>
                  </div>
                  {/* Row 3: ASN + Timezone */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">رقم الشبكة (ASN)</p>
                        <p className="text-sm font-medium">{geoInfo.asname || geoInfo.as}</p>
                        <p className="text-xs text-muted-foreground">{geoInfo.as}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">المنطقة الزمنية</p>
                        <p className="text-sm font-medium">{geoInfo.timezone}</p>
                        {geoInfo.currency && geoInfo.currency !== "—" && (
                          <p className="text-xs text-muted-foreground">العملة: {geoInfo.currency}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Reverse DNS */}
                  {geoInfo.reverse && geoInfo.reverse !== "—" && (
                    <div className="flex items-start gap-2 pt-1 border-t">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Reverse DNS</p>
                        <p className="text-sm font-mono text-muted-foreground">{geoInfo.reverse}</p>
                      </div>
                    </div>
                  )}
                  {/* Coordinates + Embedded Map */}
                  <div className="pt-1 border-t space-y-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {geoInfo.lat.toFixed(4)}, {geoInfo.lon.toFixed(4)}
                    </p>
                    <div className="rounded-lg overflow-hidden border h-[220px] w-full">
                      <iframe
                        title="ip-map"
                        src={`https://maps.google.com/maps?q=${geoInfo.lat},${geoInfo.lon}&z=12&output=embed`}
                        style={{ width: "100%", height: "100%", border: 0 }}
                        loading="lazy"
                        allowFullScreen
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <a href={`https://maps.google.com/maps?q=${geoInfo.lat},${geoInfo.lon}&z=12`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">🗺️ Google Maps ↗</a>
                      <span className="text-xs text-muted-foreground">|</span>
                      <a href={`https://www.openstreetmap.org/?mlat=${geoInfo.lat}&mlon=${geoInfo.lon}#map=12/${geoInfo.lat}/${geoInfo.lon}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">🌍 OpenStreetMap ↗</a>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* ── Customer ── */}
            <div className="rounded-xl border p-4 flex items-center gap-3">
              {ip?.customer_name ? (
                <>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base shrink-0">
                    {ip.customer_name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">العميل المرتبط</p>
                    <p className="font-semibold text-base">{ip.customer_name}</p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-primary ml-auto" />
                </>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">التصنيف</p>
                    <p className="font-semibold text-destructive">سبام / غير معروف</p>
                  </div>
                  <XCircle className="h-5 w-5 text-destructive ml-auto" />
                </>
              )}
            </div>

            {/* ── Devices ── */}
            {devices && devices.length > 0 && (
              <div className="rounded-xl border overflow-hidden">
                <div className="bg-muted/40 px-4 py-2.5 flex items-center gap-2 border-b">
                  <Monitor className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">الأجهزة المرتبطة ({devices.length})</span>
                </div>
                <div className="divide-y">
                  {devices.map((dev, i) => (
                    <div key={i} className="p-3 flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${dev.is_active ? "bg-primary/10" : "bg-muted"}`}>
                        <Cpu className={`h-4 w-4 ${dev.is_active ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{dev.device_name || "جهاز غير مسمى"}</p>
                          {dev.is_active
                            ? <Badge variant="outline" className="text-[10px] h-4 text-primary border-primary/30">نشط</Badge>
                            : <Badge variant="outline" className="text-[10px] h-4 text-destructive border-destructive/30">موقوف</Badge>}
                        </div>
                        {dev.os_info && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Monitor className="h-3 w-3" />{dev.os_info}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-1">
                          {dev.license_key && (
                            <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border">{dev.license_key}</code>
                          )}
                          {dev.customer_name && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <User className="h-2.5 w-2.5" />{dev.customer_name}
                            </span>
                          )}
                          {dev.last_verified && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />آخر تحقق: {formatDate(dev.last_verified)}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground/50 mt-0.5 truncate" title={dev.hwid}>HWID: {dev.hwid}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Attempted Keys ── */}
            {allKeys.size > 0 && (
              <div className="rounded-xl border overflow-hidden">
                <div className="bg-muted/40 px-4 py-2.5 flex items-center gap-2 border-b">
                  <Key className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">مفاتيح الترخيص المحاوَلة ({allKeys.size})</span>
                </div>
                <div className="p-3 flex flex-wrap gap-1.5">
                  {Array.from(allKeys).map(k => (
                    <code key={k} className="text-xs font-mono bg-muted border rounded px-2 py-1">{k}</code>
                  ))}
                </div>
              </div>
            )}

            {/* ── Activity Chart (24h) ── */}
            {hourlyActivity.some(x => x.c > 0) && (
              <div className="rounded-xl border overflow-hidden">
                <div className="bg-muted/40 px-4 py-2.5 flex items-center gap-2 border-b">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">النشاط خلال آخر 24 ساعة</span>
                </div>
                <div className="p-4">
                  <div className="flex items-end gap-0.5 h-16">
                    {hourlyActivity.map((x, i) => (
                      <div key={i} className="flex-1 flex flex-col justify-end" title={`منذ ${x.h} ساعة: ${x.c} طلب`}>
                        <div
                          className="w-full rounded-sm bg-primary/60 hover:bg-primary transition-all"
                          style={{ height: `${Math.max((x.c / maxHourly) * 100, x.c > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">24 ساعة مضت</span>
                    <span className="text-[10px] text-muted-foreground">الآن</span>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* ── Full Log ── */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">سجل النشاط الكامل ({logs?.length ?? 0} حدث)</p>
              </div>
              {logsLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">جاري التحميل...</div>
              ) : !logs?.length ? (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد سجلات</div>
              ) : (
                <div className="space-y-1.5">
                  {logs.map((log) => (
                    <div key={log.id} className={`rounded-lg border p-3 text-sm ${log.entity_type === "security" ? "border-destructive/30 bg-destructive/5" : "bg-muted/20"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <div className="mt-0.5 shrink-0">{getLogIcon(log.entity_type, log.description)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground leading-relaxed break-words">{log.description}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Badge variant={getLogBadgeVariant(log.entity_type)} className="text-[10px] h-4 px-1.5">{log.entity_type}</Badge>
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5">{log.action}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                          {formatDateTime(log.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

const IpManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [addIpOpen, setAddIpOpen] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [newReason, setNewReason] = useState("");
  const [selectedIp, setSelectedIp] = useState<IpActivity | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch blocked IPs
  const { data: blockedIps, isLoading: blockedLoading } = useQuery({
    queryKey: ["blocked-ips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_ips")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BlockedIp[];
    },
  });

  // Fetch IP activity from logs
  const { data: ipActivity, isLoading: activityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ["ip-activity"],
    queryFn: async () => {
      const [logsRes, blockedRes, licensesRes] = await Promise.all([
        supabase
          .from("logs")
          .select("ip_address, created_at, entity_id, entity_type, description")
          .not("ip_address", "is", null)
          .neq("ip_address", "unknown")
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase.from("blocked_ips").select("ip_address"),
        supabase.from("licenses").select("id, license_key, customers(id, name)"),
      ]);

      const logs = logsRes.data || [];
      const blockedSet = new Set((blockedRes.data || []).map(b => b.ip_address));

      const licenseToCustomer = new Map<string, string>();
      for (const lic of licensesRes.data || []) {
        const customer = lic.customers as { id: string; name: string } | null;
        if (customer?.name) {
          licenseToCustomer.set(lic.id, customer.name);
          licenseToCustomer.set(lic.license_key, customer.name);
        }
      }

      const licKeyRegex = /([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/;

      const ipMap = new Map<string, { count: number; lastSeen: string; entityIds: Set<string>; attemptedKeys: Set<string> }>();
      for (const log of logs) {
        if (!log.ip_address) continue;
        const existing = ipMap.get(log.ip_address);
        const keyMatch = log.description ? licKeyRegex.exec(log.description) : null;
        const extractedKey = keyMatch ? keyMatch[1] : null;

        if (!existing) {
          const ids = new Set<string>();
          const keys = new Set<string>();
          if (log.entity_id) ids.add(log.entity_id);
          if (extractedKey) keys.add(extractedKey);
          ipMap.set(log.ip_address, { count: 1, lastSeen: log.created_at || "", entityIds: ids, attemptedKeys: keys });
        } else {
          existing.count++;
          if (log.entity_id) existing.entityIds.add(log.entity_id);
          if (extractedKey) existing.attemptedKeys.add(extractedKey);
          if ((log.created_at || "") > existing.lastSeen) existing.lastSeen = log.created_at || "";
        }
      }

      return Array.from(ipMap.entries())
        .map(([ip, { count, lastSeen, entityIds, attemptedKeys }]) => {
          let customerName: string | null = null;
          for (const id of entityIds) {
            const name = licenseToCustomer.get(id);
            if (name) { customerName = name; break; }
          }
          return {
            ip_address: ip,
            request_count: count,
            last_seen: lastSeen,
            is_blocked: blockedSet.has(ip),
            customer_name: customerName,
            attempted_keys: Array.from(attemptedKeys),
          };
        })
        .sort((a, b) => b.request_count - a.request_count) as IpActivity[];
    },
  });

  const blockMutation = useMutation({
    mutationFn: async ({ ip, reason }: { ip: string; reason?: string }) => {
      const { error } = await supabase.from("blocked_ips").insert({ ip_address: ip.trim(), reason: reason?.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-ips"] });
      queryClient.invalidateQueries({ queryKey: ["ip-activity"] });
      toast.success("تم حظر الـ IP بنجاح");
      setAddIpOpen(false);
      setNewIp("");
      setNewReason("");
    },
    onError: (e: any) => toast.error(e.message?.includes("unique") ? "هذا الـ IP محظور بالفعل" : "فشل حظر الـ IP"),
  });

  const unblockMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blocked_ips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-ips"] });
      queryClient.invalidateQueries({ queryKey: ["ip-activity"] });
      toast.success("تم رفع الحظر بنجاح");
    },
    onError: () => toast.error("فشل رفع الحظر"),
  });

  const copyIp = (ip: string) => {
    navigator.clipboard.writeText(ip);
    toast.success("تم نسخ الـ IP");
  };

  const openDetail = (item: IpActivity) => {
    setSelectedIp(item);
    setDrawerOpen(true);
  };

  const filteredBlocked = blockedIps?.filter(b =>
    b.ip_address.includes(searchTerm) || b.reason?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredActivity = ipActivity?.filter(a =>
    a.ip_address.includes(searchTerm) ||
    (a.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalRequests = ipActivity?.reduce((s, a) => s + a.request_count, 0) || 0;
  const uniqueIps = ipActivity?.length || 0;
  const blockedCount = blockedIps?.length || 0;
  const blockedRequestCount = ipActivity?.filter(a => a.is_blocked).reduce((s, a) => s + a.request_count, 0) || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Detail Drawer */}
      <IpDetailDrawer
        ip={selectedIp}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            إدارة الـ IP
          </h1>
          <p className="text-muted-foreground mt-1">مراقبة وحظر عناوين IP المشبوهة</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchActivity()}>
            <RefreshCw className="h-4 w-4 ml-1" />
            تحديث
          </Button>
          <Dialog open={addIpOpen} onOpenChange={setAddIpOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Ban className="h-4 w-4 ml-1" />
                حظر IP يدوي
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>حظر عنوان IP</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>عنوان IP</Label>
                  <Input placeholder="مثال: 192.168.1.1" value={newIp} onChange={(e) => setNewIp(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>سبب الحظر (اختياري)</Label>
                  <Textarea placeholder="مثال: نشاط مشبوه، هجوم brute force..." value={newReason} onChange={(e) => setNewReason(e.target.value)} rows={3} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setAddIpOpen(false)}>إلغاء</Button>
                  <Button
                    onClick={() => blockMutation.mutate({ ip: newIp, reason: newReason })}
                    disabled={!newIp.trim() || blockMutation.isPending}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    <Ban className="h-4 w-4 ml-1" />
                    حظر
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-xl bg-primary/15 p-2.5"><Globe className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">IPs فريدة</p><p className="text-2xl font-bold">{uniqueIps}</p></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-blue-500/10 to-blue-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-xl bg-blue-500/15 p-2.5"><Activity className="h-5 w-5 text-blue-500" /></div>
            <div><p className="text-xs text-muted-foreground">إجمالي الطلبات</p><p className="text-2xl font-bold">{totalRequests}</p></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-destructive/10 to-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-xl bg-destructive/15 p-2.5"><Ban className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">IPs محظورة</p><p className="text-2xl font-bold">{blockedCount}</p></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-orange-500/10 to-orange-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-xl bg-orange-500/15 p-2.5"><AlertTriangle className="h-5 w-5 text-orange-500" /></div>
            <div><p className="text-xs text-muted-foreground">طلبات محظورة</p><p className="text-2xl font-bold">{blockedRequestCount}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ابحث بعنوان IP أو اسم العميل..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            نشاط الـ IPs
            {uniqueIps > 0 && <Badge variant="secondary" className="h-5 min-w-5 text-xs">{uniqueIps}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="blocked" className="gap-2">
            <Ban className="h-4 w-4" />
            IPs المحظورة
            {blockedCount > 0 && <Badge variant="destructive" className="h-5 min-w-5 text-xs">{blockedCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card className="border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold">عنوان IP</TableHead>
                  <TableHead className="font-semibold">العميل</TableHead>
                  <TableHead className="font-semibold">عدد الطلبات</TableHead>
                  <TableHead className="font-semibold">آخر نشاط</TableHead>
                  <TableHead className="font-semibold">الحالة</TableHead>
                  <TableHead className="font-semibold text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activityLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : !filteredActivity?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Globe className="h-10 w-10 opacity-30" />
                        <p>لا توجد بيانات IP بعد</p>
                        <p className="text-xs">ستظهر هنا عند استخدام API التفعيل</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredActivity.map((item) => (
                    <TableRow key={item.ip_address} className={`group ${item.is_blocked ? "bg-destructive/5" : ""}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                          <code className="font-mono text-sm font-medium">{item.ip_address}</code>
                          <button
                            onClick={() => copyIp(item.ip_address)}
                            className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.customer_name ? (
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="text-sm font-medium">{item.customer_name}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="gap-1 text-xs text-destructive border-destructive/30 bg-destructive/5 w-fit">
                              <AlertTriangle className="h-3 w-3" />
                              سبام
                            </Badge>
                            {(item.attempted_keys || []).length > 0 && (
                              <div className="flex flex-col gap-0.5">
                                {(item.attempted_keys || []).slice(0, 2).map(key => (
                                  <code key={key} className="text-[10px] font-mono text-muted-foreground bg-muted px-1 py-0.5 rounded w-fit">
                                    {key}
                                  </code>
                                ))}
                                {(item.attempted_keys || []).length > 2 && (
                                  <span className="text-[10px] text-muted-foreground">+{(item.attempted_keys || []).length - 2} أخرى</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 rounded-full bg-primary/60"
                            style={{ width: `${Math.min((item.request_count / (Math.max(...(filteredActivity?.map(a => a.request_count) || [1]))) * 80), 80)}px` }}
                          />
                          <span className="font-semibold tabular-nums">{item.request_count}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(item.last_seen)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.is_blocked ? (
                          <Badge variant="destructive" className="gap-1 text-xs">
                            <Ban className="h-3 w-3" />محظور
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs text-green-600 border-green-200">
                            <Shield className="h-3 w-3" />نشط
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          {/* Detail Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-xs"
                            onClick={() => openDetail(item)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">تفاصيل</span>
                          </Button>

                          {item.is_blocked ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-xs"
                              onClick={() => {
                                const found = blockedIps?.find(b => b.ip_address === item.ip_address);
                                if (found) unblockMutation.mutate(found.id);
                              }}
                              disabled={unblockMutation.isPending}
                            >
                              <ShieldOff className="h-3.5 w-3.5" />
                              رفع الحظر
                            </Button>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                                  <Ban className="h-3.5 w-3.5" />
                                  حظر
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>حظر عنوان IP</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    هل تريد حظر <code className="font-mono bg-muted px-1 rounded">{item.ip_address}</code>؟
                                    {item.customer_name && <><br /><span className="text-orange-600">⚠️ هذا الـ IP مرتبط بالعميل: {item.customer_name}</span></>}
                                    <br />سيتم رفض جميع طلبات التفعيل من هذا الـ IP فوراً.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => blockMutation.mutate({ ip: item.ip_address, reason: "محظور من لوحة التحكم" })}
                                  >
                                    حظر
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Blocked Tab */}
        <TabsContent value="blocked">
          <Card className="border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold">عنوان IP</TableHead>
                  <TableHead className="font-semibold">سبب الحظر</TableHead>
                  <TableHead className="font-semibold">تاريخ الحظر</TableHead>
                  <TableHead className="font-semibold text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blockedLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : !filteredBlocked?.length ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Shield className="h-10 w-10 opacity-30" />
                        <p>لا توجد IPs محظورة</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBlocked.map((blocked) => (
                    <TableRow key={blocked.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Ban className="h-4 w-4 text-destructive shrink-0" />
                          <code className="font-mono text-sm font-medium">{blocked.ip_address}</code>
                          <button
                            onClick={() => copyIp(blocked.ip_address)}
                            className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {blocked.reason || <span className="text-muted-foreground/50 italic">بدون سبب</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(blocked.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-xs"
                            onClick={() => unblockMutation.mutate(blocked.id)}
                            disabled={unblockMutation.isPending}
                          >
                            <ShieldOff className="h-3.5 w-3.5" />
                            رفع الحظر
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>حذف من القائمة المحظورة</AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم حذف <code className="font-mono bg-muted px-1 rounded">{blocked.ip_address}</code> من قائمة الحظر.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => unblockMutation.mutate(blocked.id)}
                                >
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IpManagement;
