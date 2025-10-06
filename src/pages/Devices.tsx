import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Trash2, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Device = Tables<"devices">;

const Devices = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const { data: devices, isLoading } = useQuery({
    queryKey: ["devices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devices")
        .select("*, licenses(license_key)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("devices")
        .update({ is_active: !isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("تم تحديث حالة الجهاز بنجاح");
    },
    onError: () => toast.error("فشل تحديث حالة الجهاز")
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("devices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast.success("تم حذف الجهاز بنجاح");
    },
    onError: () => toast.error("فشل حذف الجهاز")
  });

  const filteredDevices = devices?.filter(device =>
    device.hwid.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.device_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.os_info?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">الأجهزة</h1>
        <p className="text-muted-foreground">إدارة الأجهزة المرتبطة بالتراخيص</p>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث عن جهاز..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>اسم الجهاز</TableHead>
              <TableHead>HWID</TableHead>
              <TableHead>نظام التشغيل</TableHead>
              <TableHead>الترخيص</TableHead>
              <TableHead>آخر تحقق</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="text-left">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">جاري التحميل...</TableCell>
              </TableRow>
            ) : filteredDevices?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">لا توجد أجهزة</TableCell>
              </TableRow>
            ) : (
              filteredDevices?.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">{device.device_name || "-"}</TableCell>
                  <TableCell className="font-mono text-sm">{device.hwid}</TableCell>
                  <TableCell>{device.os_info || "-"}</TableCell>
                  <TableCell>
                    {device.licenses ? (
                      <span className="font-mono text-sm">{device.licenses.license_key}</span>
                    ) : "-"}
                  </TableCell>
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
                          isActive: device.is_active ?? false
                        })}
                      >
                        {device.is_active ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("هل أنت متأكد من حذف هذا الجهاز؟")) {
                            deleteMutation.mutate(device.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Devices;
