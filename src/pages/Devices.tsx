import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, Trash2, Power, PowerOff, Monitor, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { logActivity } from "@/lib/logger";

type Device = Tables<"devices">;

const Devices = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const toggleGroup = (licenseId: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(licenseId)) next.delete(licenseId);
      else next.add(licenseId);
      return next;
    });
  };

  const { data: devices, isLoading } = useQuery({
    queryKey: ["devices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("*, licenses(license_key, customers(name))")
        .order("license_id", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive, deviceName }: { id: string; isActive: boolean; deviceName: string }) => {
      const { error } = await supabase
        .from("devices")
        .update({ is_active: !isActive })
        .eq("id", id);
      if (error) throw error;
      return { isActive: !isActive, deviceName };
    },
    onSuccess: async ({ isActive, deviceName }) => {
      await logActivity({
        action: isActive ? "activated" : "deactivated",
        entityType: "device",
        description: `تم ${isActive ? "تفعيل" : "تعطيل"} الجهاز: ${deviceName}`
      });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("تم تحديث حالة الجهاز بنجاح");
    },
    onError: () => toast.error("فشل تحديث حالة الجهاز")
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, deviceName }: { id: string; deviceName: string }) => {
      const { error } = await supabase.from("devices").delete().eq("id", id);
      if (error) throw error;
      return deviceName;
    },
    onSuccess: async (deviceName) => {
      await logActivity({
        action: "deleted",
        entityType: "device",
        description: `تم حذف الجهاز: ${deviceName}`
      });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("تم حذف الجهاز بنجاح");
    },
    onError: () => toast.error("فشل حذف الجهاز")
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("devices")
        .delete()
        .in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: async (count) => {
      await logActivity({
        action: "deleted",
        entityType: "device",
        description: `تم حذف ${count} جهاز`
      });
      setSelectedDevices(new Set());
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success(`تم حذف ${count} جهاز بنجاح`);
    },
    onError: () => toast.error("فشل حذف الأجهزة")
  });

  const filteredDevices = devices?.filter(device =>
    device.hwid.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.device_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.os_info?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (device.licenses as any)?.license_key?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group devices by license_id
  const groupedDevices = filteredDevices?.reduce((groups, device) => {
    const key = device.license_id || "no-license";
    if (!groups[key]) groups[key] = [];
    groups[key].push(device);
    return groups;
  }, {} as Record<string, typeof filteredDevices>);

  const handleSelectDevice = (deviceId: string, checked: boolean) => {
    const newSelected = new Set(selectedDevices);
    if (checked) newSelected.add(deviceId);
    else newSelected.delete(deviceId);
    setSelectedDevices(newSelected);
  };

  const handleSelectGroup = (groupDevices: typeof filteredDevices, checked: boolean) => {
    const newSelected = new Set(selectedDevices);
    groupDevices?.forEach(d => {
      if (checked) newSelected.add(d.id);
      else newSelected.delete(d.id);
    });
    setSelectedDevices(newSelected);
  };

  const handleSelectAll = () => {
    if (filteredDevices) {
      setSelectedDevices(new Set(filteredDevices.map(d => d.id)));
      toast.success(`تم تحديد ${filteredDevices.length} جهاز`);
    }
  };

  const handleBulkDelete = () => {
    if (selectedDevices.size === 0) return;
    if (confirm(`هل أنت متأكد من حذف ${selectedDevices.size} جهاز؟`)) {
      bulkDeleteMutation.mutate(Array.from(selectedDevices));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">الأجهزة</h1>
        <p className="text-muted-foreground">إدارة الأجهزة المرتبطة بالتراخيص</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن جهاز أو ترخيص..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>

        {selectedDevices.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              تم تحديد {selectedDevices.size} جهاز
            </span>
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              تحديد الكل ({filteredDevices?.length || 0})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 ml-2" />
              حذف المحدد
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead>اسم الجهاز</TableHead>
                <TableHead>HWID</TableHead>
                <TableHead>نظام التشغيل</TableHead>
                <TableHead>آخر تحقق</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-left">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableSkeleton rows={10} columns={7} />
            </TableBody>
          </Table>
        </div>
      ) : !groupedDevices || Object.keys(groupedDevices).length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          لا توجد أجهزة
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedDevices).map(([licenseId, groupDevices]) => {
            const firstDevice = groupDevices?.[0];
            const licenseKey = (firstDevice?.licenses as any)?.license_key;
            const customerName = (firstDevice?.licenses as any)?.customers?.name;
            const isGroupSelected = groupDevices?.every(d => selectedDevices.has(d.id)) ?? false;
            const isGroupPartial = (groupDevices?.some(d => selectedDevices.has(d.id)) && !isGroupSelected) ?? false;
            const isCollapsed = !openGroups.has(licenseId);

            return (
              <Collapsible key={licenseId} open={openGroups.has(licenseId)} onOpenChange={() => toggleGroup(licenseId)}>
                <div className="rounded-lg border bg-card overflow-hidden">
                  {/* License Group Header */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-muted/40 border-b">
                    <Checkbox
                      checked={isGroupSelected}
                      ref={(el) => {
                        if (el) (el as any).indeterminate = isGroupPartial;
                      }}
                      onCheckedChange={(checked) => handleSelectGroup(groupDevices, checked as boolean)}
                    />
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 flex-1 text-right hover:opacity-70 transition-opacity">
                        {isCollapsed
                          ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        }
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                        <div className="flex items-center gap-2 flex-1">
                          {licenseKey ? (
                            <>
                              <span className="font-mono text-sm font-semibold">{licenseKey}</span>
                              {customerName && (
                                <span className="text-sm text-muted-foreground">— {customerName}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">بدون ترخيص</span>
                          )}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <Badge variant="outline" className="text-xs">
                      {groupDevices?.length} جهاز
                    </Badge>
                  </div>

                  <CollapsibleContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12" />
                          <TableHead>اسم الجهاز</TableHead>
                          <TableHead>HWID</TableHead>
                          <TableHead>نظام التشغيل</TableHead>
                          <TableHead>آخر تحقق</TableHead>
                          <TableHead>الحالة</TableHead>
                          <TableHead className="text-left">الإجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupDevices?.map((device) => (
                          <TableRow key={device.id} className={selectedDevices.has(device.id) ? "bg-muted/50" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={selectedDevices.has(device.id)}
                                onCheckedChange={(checked) => handleSelectDevice(device.id, checked as boolean)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{device.device_name || "-"}</TableCell>
                            <TableCell className="font-mono text-sm">{device.hwid}</TableCell>
                            <TableCell>{device.os_info || "-"}</TableCell>
                            <TableCell>
                              {device.last_verified
                                ? format(new Date(device.last_verified), "dd MMM yyyy، HH:mm", { locale: ar })
                                : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={device.is_active ? "default" : "secondary"}>
                                {device.is_active ? "نشط" : "معطل"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toggleActiveMutation.mutate({
                                    id: device.id,
                                    isActive: device.is_active ?? false,
                                    deviceName: device.device_name || device.hwid
                                  })}
                                >
                                  {device.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm("هل أنت متأكد من حذف هذا الجهاز؟")) {
                                      deleteMutation.mutate({
                                        id: device.id,
                                        deviceName: device.device_name || device.hwid
                                      });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Devices;

