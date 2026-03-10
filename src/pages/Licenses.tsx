import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Copy, Trash2, Edit, FileSpreadsheet, FileText, KeyRound, Loader2, PauseCircle, PlayCircle } from "lucide-react";
import { exportToExcel, exportToCSV } from "@/lib/exportUtils";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
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
import { logActivity } from "@/lib/logger";

interface License {
  id: string;
  license_key: string;
  status: string;
  max_devices: number;
  expire_at: string | null;
  created_at: string;
  customer: { id: string; name: string } | null;
  product: { id: string; name: string } | null;
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [licenseToDelete, setLicenseToDelete] = useState<{ id: string; key: string } | null>(null);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  
  const [regenerateLicense, setRegenerateLicense] = useState<License | null>(null);
  const [isRegenerateDialogOpen, setIsRegenerateDialogOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
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
      // تحديث حالة التراخيص المنتهية تلقائياً قبل الجلب
      await supabase.rpc("auto_expire_licenses");

      const { data, error } = await supabase
        .from("licenses")
        .select(`
          *,
          customer:customers(id, name),
          product:products(id, name)
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
      const { data, error } = await supabase.from("licenses").insert([{
        license_key: licenseKey,
        customer_id: formData.customer_id || null,
        product_id: formData.product_id || null,
        max_devices: parseInt(formData.max_devices),
        expire_at: formData.expire_at || null,
        status: formData.status,
        notes: formData.notes || null
      }]).select().single();

      if (error) throw error;

      await logActivity({
        action: "created",
        entityType: "license",
        entityId: data.id,
        description: `تم إنشاء ترخيص جديد: ${licenseKey}`
      });

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
      // Auto-set status to active if expire_at is in the future (or no expiry) and current status is expired
      let resolvedStatus = formData.status;
      if (formData.status === "expired") {
        const newExpiry = formData.expire_at ? new Date(formData.expire_at) : null;
        if (!newExpiry || newExpiry > new Date()) {
          resolvedStatus = "active";
        }
      }

      const { error } = await supabase
        .from("licenses")
        .update({
          customer_id: formData.customer_id || null,
          product_id: formData.product_id || null,
          max_devices: parseInt(formData.max_devices),
          expire_at: formData.expire_at || null,
          status: resolvedStatus,
          notes: formData.notes || null
        })
        .eq("id", editingLicense.id);

      if (error) throw error;

      await logActivity({
        action: "updated",
        entityType: "license",
        entityId: editingLicense.id,
        description: `تم تحديث الترخيص: ${editingLicense.license_key}${resolvedStatus !== formData.status ? " (تم تفعيله تلقائياً)" : ""}`
      });

      toast({
        title: "تم التحديث",
        description: resolvedStatus !== formData.status
          ? "تم تحديث الترخيص وتفعيله تلقائياً لأن التاريخ في المستقبل"
          : "تم تحديث الترخيص بنجاح",
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
      customer_id: license.customer?.id || "",
      product_id: license.product?.id || "",
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

  const deleteLicense = async () => {
    if (!licenseToDelete) return;

    try {
      // Revoke the key first so old copies can't be reused
      await supabase.from("revoked_keys" as any).upsert(
        { license_key: licenseToDelete.key, reason: "تم حذف الترخيص" },
        { onConflict: "license_key" }
      );

      const { error } = await supabase.from("licenses").delete().eq("id", licenseToDelete.id);
      if (error) throw error;

      await logActivity({
        action: "deleted",
        entityType: "license",
        entityId: licenseToDelete.id,
        description: `تم حذف الترخيص: ${licenseToDelete.key}`
      });

      toast({
        title: "تم الحذف",
        description: "تم حذف الترخيص وإضافة مفتاحه للقائمة السوداء",
      });
      fetchLicenses();
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل حذف الترخيص",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setLicenseToDelete(null);
    }
  };

  const toggleSuspend = async (license: License) => {
    const isSuspended = license.status === "suspended";
    const newStatus = isSuspended ? "active" : "suspended";
    setSuspendingId(license.id);
    try {
      const { error } = await supabase
        .from("licenses")
        .update({ status: newStatus })
        .eq("id", license.id);
      if (error) throw error;

      await logActivity({
        action: "updated",
        entityType: "license",
        entityId: license.id,
        description: isSuspended
          ? `تم إعادة تفعيل الترخيص: ${license.license_key}`
          : `تم تعليق الترخيص: ${license.license_key}`,
      });

      toast({
        title: isSuspended ? "تم التفعيل" : "تم التعليق",
        description: isSuspended
          ? `تم إعادة تفعيل الترخيص ${license.license_key}`
          : `تم تعليق الترخيص ${license.license_key}`,
      });
      fetchLicenses();
    } catch {
      toast({ title: "خطأ", description: "فشل تغيير حالة الترخيص", variant: "destructive" });
    } finally {
      setSuspendingId(null);
    }
  };

  const handleRegenerate = async () => {
    if (!regenerateLicense) return;
    setIsRegenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("regenerate-license-key", {
        body: { licenseId: regenerateLicense.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;

      // Revoke the old key so it can't be reused
      if (data.oldKey) {
        await supabase.from("revoked_keys" as any).upsert(
          { license_key: data.oldKey, reason: `تم تجديد المفتاح — استُبدل بـ ${data.newKey}` },
          { onConflict: "license_key" }
        );
      }

      toast({
        title: "✅ تم تجديد المفتاح",
        description: data.notified
          ? `المفتاح الجديد: ${data.newKey} — تم إرسال إشعار للعميل عبر التليجرام`
          : `المفتاح الجديد: ${data.newKey} — العميل غير مرتبط بالبوت`,
      });
      await logActivity({
        action: "updated",
        entityType: "license",
        entityId: regenerateLicense.id,
        description: `تم تجديد مفتاح الترخيص من ${data.oldKey} إلى ${data.newKey}`,
      });
      setIsRegenerateDialogOpen(false);
      setRegenerateLicense(null);
      fetchLicenses();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل تجديد المفتاح",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
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

  const filteredLicenses = licenses
    .filter(
      (license) =>
        license.license_key.toLowerCase().includes(search.toLowerCase()) ||
        license.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
        license.product?.name?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (!a.expire_at && !b.expire_at) return 0;
      if (!a.expire_at) return 1;
      if (!b.expire_at) return -1;
      return new Date(a.expire_at).getTime() - new Date(b.expire_at).getTime();
    });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">التراخيص</h1>
          <p className="text-muted-foreground">إدارة جميع التراخيص</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => exportToExcel(filteredLicenses, "licenses")}
          >
            <FileSpreadsheet className="ml-2 h-4 w-4" />
            Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => exportToCSV(filteredLicenses, "licenses")}
          >
            <FileText className="ml-2 h-4 w-4" />
            CSV
          </Button>
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
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : filteredLicenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    لا توجد تراخيص
                  </TableCell>
                </TableRow>
              ) : (
                filteredLicenses.map((license) => (
                  <TableRow key={license.id}>
                    <TableCell>
                      <div className="font-mono text-sm">{license.license_key}</div>
                      {license.customer?.name && (
                        <div className="text-xs text-muted-foreground mt-0.5">{license.customer.name}</div>
                      )}
                    </TableCell>
                    <TableCell>{license.customer?.name || "-"}</TableCell>
                    <TableCell>{license.product?.name || "-"}</TableCell>
                    <TableCell>{getStatusBadge(license.status)}</TableCell>
                    <TableCell>{license.max_devices}</TableCell>
                    <TableCell>
                      {license.expire_at
                        ? (() => {
                            const d = new Date(license.expire_at);
                            if (isNaN(d.getTime())) return "—";
                            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                          })()
                        : "غير محدد"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(license)}
                          title="تعديل"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleSuspend(license)}
                          disabled={suspendingId === license.id || license.status === "expired"}
                          title={license.status === "suspended" ? "إعادة تفعيل" : "تعليق"}
                          className={
                            license.status === "suspended"
                              ? "text-success hover:text-success/80 hover:bg-success/10"
                              : "text-warning hover:text-warning/80 hover:bg-warning/10"
                          }
                        >
                          {suspendingId === license.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : license.status === "suspended" ? (
                            <PlayCircle className="h-4 w-4" />
                          ) : (
                            <PauseCircle className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyLicenseKey(license.license_key)}
                          title="نسخ المفتاح"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setRegenerateLicense(license); setIsRegenerateDialogOpen(true); }}
                          title="تجديد مفتاح الترخيص"
                          className="text-warning hover:text-warning/80 hover:bg-warning/10"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setLicenseToDelete({ id: license.id, key: license.license_key });
                            setIsDeleteDialogOpen(true);
                          }}
                          title="حذف"
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

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. سيتم حذف الترخيص نهائياً
              {licenseToDelete && ` (${licenseToDelete.key})`}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={deleteLicense} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate License Key Confirmation Dialog */}
      <AlertDialog open={isRegenerateDialogOpen} onOpenChange={setIsRegenerateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              تجديد مفتاح الترخيص
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-right">
              <p>سيتم إنشاء مفتاح جديد للترخيص:</p>
              {regenerateLicense && (
                <p className="font-mono bg-muted px-2 py-1 rounded text-sm">{regenerateLicense.license_key}</p>
              )}
              <p className="mt-2">⚠️ المفتاح القديم سيصبح غير صالح فوراً، وستُعطَّل جميع الأجهزة المرتبطة حتى يتم إعادة التفعيل بالمفتاح الجديد.</p>
              {regenerateLicense?.customer && (
                <p className="text-sm">📱 سيصل إشعار تلقائي للعميل <strong>{regenerateLicense.customer.name}</strong> عبر بوت التليجرام (إن كان مرتبطاً).</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRegenerating}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleRegenerate(); }}
              disabled={isRegenerating}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isRegenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin ml-2" />جارٍ التجديد...</>
              ) : (
                <><KeyRound className="h-4 w-4 ml-2" />تجديد المفتاح</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Licenses;
