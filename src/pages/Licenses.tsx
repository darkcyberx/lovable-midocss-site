import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Copy, Trash2, Edit } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

interface Customer {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
}

const Licenses = () => {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [formData, setFormData] = useState<{
    customer_id: string;
    product_id: string;
    max_devices: string;
    expire_at: string;
    status: "active" | "expired" | "pending" | "suspended";
    notes: string;
  }>({
    customer_id: "",
    product_id: "",
    max_devices: "1",
    expire_at: "",
    status: "active",
    notes: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchLicenses();
    fetchCustomers();
    fetchProducts();
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

  const fetchCustomers = async () => {
    const { data } = await supabase.from("customers").select("id, name").order("name");
    setCustomers(data || []);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("id, name").order("name");
    setProducts(data || []);
  };

  const generateLicenseKey = async () => {
    const { data, error } = await supabase.rpc("generate_license_key");
    if (error) throw error;
    return data;
  };

  const createLicense = async () => {
    try {
      const licenseKey = await generateLicenseKey();
      const { error } = await supabase.from("licenses").insert([{
        license_key: licenseKey,
        customer_id: formData.customer_id || null,
        product_id: formData.product_id || null,
        max_devices: parseInt(formData.max_devices),
        expire_at: formData.expire_at || null,
        status: formData.status,
        notes: formData.notes || null
      }]);

      if (error) throw error;

      toast({
        title: "تم الإنشاء",
        description: "تم إنشاء الترخيص بنجاح",
      });
      handleCloseDialog();
      fetchLicenses();
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل إنشاء الترخيص",
        variant: "destructive",
      });
    }
  };

  const updateLicense = async () => {
    if (!editingLicense) return;

    try {
      const { error } = await supabase
        .from("licenses")
        .update({
          customer_id: formData.customer_id || null,
          product_id: formData.product_id || null,
          max_devices: parseInt(formData.max_devices),
          expire_at: formData.expire_at || null,
          status: formData.status,
          notes: formData.notes || null
        })
        .eq("id", editingLicense.id);

      if (error) throw error;

      toast({
        title: "تم التحديث",
        description: "تم تحديث الترخيص بنجاح",
      });
      handleCloseDialog();
      fetchLicenses();
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل تحديث الترخيص",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLicense) {
      updateLicense();
    } else {
      createLicense();
    }
  };

  const handleEdit = (license: License) => {
    setEditingLicense(license);
    setFormData({
      customer_id: (license.customer as any)?.id || "",
      product_id: (license.product as any)?.id || "",
      max_devices: license.max_devices.toString(),
      expire_at: license.expire_at ? new Date(license.expire_at).toISOString().split('T')[0] : "",
      status: license.status as "active" | "expired" | "pending" | "suspended",
      notes: ""
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingLicense(null);
    setFormData({
      customer_id: "",
      product_id: "",
      max_devices: "1",
      expire_at: "",
      status: "active",
      notes: ""
    });
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => setEditingLicense(null)}>
              <Plus className="h-4 w-4" />
              إضافة ترخيص
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingLicense ? "تعديل الترخيص" : "إضافة ترخيص جديد"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="customer">العميل</Label>
                <Select value={formData.customer_id} onValueChange={(value) => setFormData({ ...formData, customer_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر عميل" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="product">المنتج</Label>
                <Select value={formData.product_id} onValueChange={(value) => setFormData({ ...formData, product_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر منتج" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="max_devices">الحد الأقصى للأجهزة</Label>
                <Input
                  id="max_devices"
                  type="number"
                  min="1"
                  value={formData.max_devices}
                  onChange={(e) => setFormData({ ...formData, max_devices: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="expire_at">تاريخ الانتهاء</Label>
                <Input
                  id="expire_at"
                  type="date"
                  value={formData.expire_at}
                  onChange={(e) => setFormData({ ...formData, expire_at: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="status">الحالة</Label>
                <Select value={formData.status} onValueChange={(value: "active" | "expired" | "pending" | "suspended") => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="pending">قيد الانتظار</SelectItem>
                    <SelectItem value="expired">منتهي</SelectItem>
                    <SelectItem value="suspended">معلق</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  {editingLicense ? "تحديث" : "إنشاء"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  إلغاء
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
                          onClick={() => handleEdit(license)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
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
                          onClick={() => {
                            if (confirm("هل أنت متأكد من حذف هذا الترخيص؟")) {
                              deleteLicense(license.id);
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
        </CardContent>
      </Card>
    </div>
  );
};

export default Licenses;
