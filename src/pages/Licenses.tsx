import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Copy, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface License {
  id: string;
  license_key: string;
  status: string;
  max_devices: number;
  expire_at: string | null;
  created_at: string;
  customer: { name: string } | null;
  product: { name: string } | null;
}

const Licenses = () => {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchLicenses();
  }, []);

  const fetchLicenses = async () => {
    try {
      const { data, error } = await supabase
        .from("licenses")
        .select(`
          *,
          customer:customers(name),
          product:products(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLicenses(data || []);
    } catch (error) {
      console.error("Error fetching licenses:", error);
      toast({
        title: "خطأ",
        description: "فشل تحميل التراخيص",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyLicenseKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: "تم النسخ",
      description: "تم نسخ مفتاح الترخيص",
    });
  };

  const deleteLicense = async (id: string) => {
    try {
      const { error } = await supabase.from("licenses").delete().eq("id", id);
      if (error) throw error;

      toast({
        title: "تم الحذف",
        description: "تم حذف الترخيص بنجاح",
      });
      fetchLicenses();
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل حذف الترخيص",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      pending: "secondary",
      expired: "destructive",
      suspended: "outline",
    };

    const labels: Record<string, string> = {
      active: "نشط",
      pending: "قيد الانتظار",
      expired: "منتهي",
      suspended: "معلق",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const filteredLicenses = licenses.filter(
    (license) =>
      license.license_key.toLowerCase().includes(search.toLowerCase()) ||
      license.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
      license.product?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">التراخيص</h1>
          <p className="text-muted-foreground">إدارة جميع التراخيص</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة ترخيص
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>البحث والفلترة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن ترخيص أو عميل أو منتج..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>مفتاح الترخيص</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>المنتج</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الأجهزة</TableHead>
                <TableHead>تاريخ الانتهاء</TableHead>
                <TableHead className="text-left">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    جاري التحميل...
                  </TableCell>
                </TableRow>
              ) : filteredLicenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    لا توجد تراخيص
                  </TableCell>
                </TableRow>
              ) : (
                filteredLicenses.map((license) => (
                  <TableRow key={license.id}>
                    <TableCell className="font-mono text-sm">
                      {license.license_key}
                    </TableCell>
                    <TableCell>{license.customer?.name || "-"}</TableCell>
                    <TableCell>{license.product?.name || "-"}</TableCell>
                    <TableCell>{getStatusBadge(license.status)}</TableCell>
                    <TableCell>{license.max_devices}</TableCell>
                    <TableCell>
                      {license.expire_at
                        ? new Date(license.expire_at).toLocaleDateString("ar")
                        : "غير محدد"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyLicenseKey(license.license_key)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteLicense(license.id)}
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
        </CardContent>
      </Card>
    </div>
  );
};

export default Licenses;
