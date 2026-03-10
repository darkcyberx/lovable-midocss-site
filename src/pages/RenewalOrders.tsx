import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search, ShoppingCart, Clock, CheckCircle2, XCircle, Calendar, User, Key, DollarSign, UserPlus, Trash2,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// ─── Types ─────────────────────────────────────────────
interface RenewalRequest {
  id: string;
  days: number;
  amount: number;
  status: string;
  telegram_chat_id: number | null;
  receipt_note: string | null;
  admin_note: string | null;
  created_at: string;
  customers: { id: string; name: string; email: string } | null;
  licenses: { id: string; license_key: string; expire_at: string | null; products: { name: string } | null } | null;
}

interface RegistrationRequest {
  id: string;
  telegram_chat_id: number;
  name: string;
  email: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  requested_days: number | null;
  amount: number | null;
  receipt_note: string | null;
}

interface Product {
  id: string;
  name: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "قيد الانتظار", variant: "outline", icon: Clock },
  confirmed: { label: "مؤكد", variant: "default", icon: CheckCircle2 },
  rejected: { label: "مرفوض", variant: "destructive", icon: XCircle },
  approved: { label: "مفعّل", variant: "default", icon: CheckCircle2 },
};

// ─── Receipt Viewer Dialog ─────────────────────────────
const ReceiptDialog = ({ fileId, onClose }: { fileId: string; onClose: () => void }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("telegram-bot", {
          body: { action: "get_file", file_id: fileId },
        });
        if (fnErr || !data?.file_url) {
          setError(true);
        } else {
          setImageUrl(data.file_url);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchImage();
  }, [fileId]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>صورة الإيصال</DialogTitle>
          <DialogDescription>إيصال الدفع المرسل من العميل عبر البوت</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center min-h-[300px] bg-muted/30 rounded-lg overflow-hidden">
          {loading && <p className="text-muted-foreground text-sm">جاري تحميل الصورة...</p>}
          {error && <p className="text-destructive text-sm">تعذّر تحميل الصورة. قد تكون منتهية الصلاحية.</p>}
          {imageUrl && !loading && (
            <img src={imageUrl} alt="إيصال الدفع" className="max-w-full max-h-[500px] object-contain rounded-lg" />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
          {imageUrl && (
            <Button asChild>
              <a href={imageUrl} target="_blank" rel="noreferrer">فتح في تبويب جديد</a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Approve Registration Dialog ───────────────────────
const ApproveRegDialog = ({
  request,
  onClose,
  onApprove,
}: {
  request: RegistrationRequest;
  onClose: () => void;
  onApprove: (data: { requestId: string; maxDevices: number; productId: string | null; renewalDays: number | null }) => void;
}) => {
  const [maxDevices, setMaxDevices] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [renewalDays, setRenewalDays] = useState<string>(request.requested_days ? String(request.requested_days) : "");
  const [createLicense, setCreateLicense] = useState(true);

  const { data: products } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").eq("is_active", true);
      return data as Product[];
    },
  });

  const handleSubmit = () => {
    onApprove({
      requestId: request.id,
      maxDevices,
      productId: createLicense && selectedProduct ? selectedProduct : null,
      renewalDays: createLicense && renewalDays ? parseInt(renewalDays) : null,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>تفعيل حساب العميل</DialogTitle>
          <DialogDescription>
            سيتم إنشاء عميل جديد لـ <strong>{request.name}</strong> وإبلاغه عبر التليجرام.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="createLicense"
              checked={createLicense}
              onChange={(e) => setCreateLicense(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="createLicense" className="font-medium cursor-pointer">إنشاء ترخيص للعميل وإرسال المفتاح</Label>
          </div>

          {createLicense && (
            <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
              <div className="space-y-1.5">
                <Label>المنتج</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                >
                  <option value="">بدون منتج محدد</option>
                  {products?.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>عدد الأجهزة المسموح بها</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={maxDevices}
                  onChange={(e) => setMaxDevices(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>مدة الترخيص (أيام) — اتركه فارغاً لترخيص بلا انتهاء</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="مثال: 30"
                  value={renewalDays}
                  onChange={(e) => setRenewalDays(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSubmit}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            تفعيل الحساب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Component ────────────────────────────────────
const RenewalOrders = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rejectNote, setRejectNote] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [rejectType, setRejectType] = useState<"renewal" | "registration">("renewal");
  const [receiptFileId, setReceiptFileId] = useState<string | null>(null);
  const [approveRegRequest, setApproveRegRequest] = useState<RegistrationRequest | null>(null);
  const queryClient = useQueryClient();

  // ─── Renewal Requests Query ────────────────────────
  const { data: requests, isLoading } = useQuery({
    queryKey: ["renewal-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("renewal_requests")
        .select("*, customers(id, name, email), licenses(id, license_key, expire_at, products(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as RenewalRequest[];
    },
  });

  // ─── Registration Requests Query ───────────────────
  const { data: regRequests, isLoading: regLoading } = useQuery({
    queryKey: ["registration-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registration_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RegistrationRequest[];
    },
  });

  // ─── Total Revenue from invoices only (persists after deletion) ─
  const { data: revenueData } = useQuery({
    queryKey: ["renewal-revenue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("amount")
        .eq("status", "paid");
      return (data || []).reduce((sum, inv) => sum + Number(inv.amount), 0);
    },
  });

  // ─── Renewal Mutations ─────────────────────────────
  const confirmMutation = useMutation({
    mutationFn: async ({ requestId, action, adminNote }: { requestId: string; action: string; adminNote?: string }) => {
      const { data, error } = await supabase.functions.invoke("confirm-renewal", {
        body: { requestId, action, adminNote },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["renewal-requests"] });
      toast.success(variables.action === "confirm" ? "تم تأكيد الطلب وتجديد الترخيص" : "تم رفض الطلب");
    },
    onError: (error: any) => toast.error("حدث خطأ: " + (error.message || "فشل العملية")),
  });

  // ─── Delete Renewal Request ────────────────────────
  const deleteRenewalMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.from("renewal_requests").delete().eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["renewal-requests"] });
      toast.success("تم حذف طلب التجديد");
    },
    onError: () => toast.error("فشل حذف الطلب"),
  });

  // ─── Delete Registration Request ──────────────────
  const deleteRegMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.from("registration_requests").delete().eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registration-requests"] });
      toast.success("تم حذف طلب التسجيل");
    },
    onError: () => toast.error("فشل حذف الطلب"),
  });

  // ─── Approve Registration with License ────────────
  const approveRegMutation = useMutation({
    mutationFn: async ({ requestId, maxDevices, productId, renewalDays }: {
      requestId: string;
      maxDevices: number;
      productId: string | null;
      renewalDays: number | null;
    }) => {
      // Get the request details
      const { data: req, error: fetchErr } = await supabase
        .from("registration_requests")
        .select("*")
        .eq("id", requestId)
        .single();
      if (fetchErr) throw fetchErr;

      // Create customer
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .insert({ name: req.name, email: req.email })
        .select()
        .single();
      if (custErr) throw custErr;

      // Link telegram
      await supabase
        .from("telegram_links")
        .insert({ customer_id: customer.id, telegram_chat_id: req.telegram_chat_id });

      // Update request status
      await supabase
        .from("registration_requests")
        .update({ status: "approved" })
        .eq("id", requestId);

      let licenseKey: string | null = null;

      // Create license if requested
      if (productId !== null || renewalDays !== null) {
        const expireAt = renewalDays
          ? new Date(Date.now() + renewalDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

        // Generate license key first
        const { data: generatedKey } = await supabase.rpc("generate_license_key");

        const { data: licData, error: licErr } = await supabase
          .from("licenses")
          .insert({
            customer_id: customer.id,
            product_id: productId || null,
            max_devices: maxDevices,
            expire_at: expireAt,
            status: "active",
            license_key: generatedKey || `LIC-${Date.now()}`,
          })
          .select()
          .single();

        if (!licErr && licData) {
          licenseKey = licData.license_key;

          // Create persistent invoice record so revenue is never lost on deletion
          if (req.amount && Number(req.amount) > 0) {
            const { data: invNum } = await supabase.rpc("generate_invoice_number");
            await supabase.from("invoices").insert({
              customer_id: customer.id,
              license_id: licData.id,
              amount: req.amount,
              invoice_number: invNum || `INV-${Date.now()}`,
              status: "paid",
              paid_at: new Date().toISOString(),
              payment_method: "vodafone_cash",
              notes: `تسجيل جديد - ${req.requested_days ?? renewalDays} يوم`,
            });
          }
        }
      }

      // Notify via Telegram through edge function
      await supabase.functions.invoke("telegram-bot", {
        body: {
          action: "notify_approval",
          chat_id: req.telegram_chat_id,
          name: req.name,
          license_key: licenseKey,
          max_devices: maxDevices,
        },
      });

      return { customer, licenseKey };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["registration-requests"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      queryClient.invalidateQueries({ queryKey: ["renewal-revenue"] });
      if (data.licenseKey) {
        toast.success(`تم تفعيل الحساب وإنشاء ترخيص: ${data.licenseKey}`);
      } else {
        toast.success("تم تفعيل الحساب وإبلاغ العميل عبر التليجرام");
      }
    },
    onError: (error: any) => toast.error("حدث خطأ: " + (error.message || "فشل")),
  });

  const rejectRegMutation = useMutation({
    mutationFn: async ({ requestId, adminNote }: { requestId: string; adminNote?: string }) => {
      const { data: req } = await supabase
        .from("registration_requests")
        .select("telegram_chat_id, name")
        .eq("id", requestId)
        .single();

      await supabase
        .from("registration_requests")
        .update({ status: "rejected", admin_note: adminNote || null })
        .eq("id", requestId);

      if (req?.telegram_chat_id) {
        await supabase.functions.invoke("telegram-bot", {
          body: {
            action: "notify_rejection",
            chat_id: req.telegram_chat_id,
            reason: adminNote || null,
          },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registration-requests"] });
      toast.success("تم رفض طلب التسجيل");
    },
    onError: (error: any) => toast.error("حدث خطأ: " + (error.message || "فشل")),
  });

  // ─── Stats ─────────────────────────────────────────
  const pendingCount = requests?.filter((r) => r.status === "pending").length || 0;
  const confirmedCount = requests?.filter((r) => r.status === "confirmed").length || 0;
  const totalRevenue = revenueData ?? 0;
  const pendingRegCount = regRequests?.filter((r) => r.status === "pending").length || 0;

  const filteredRequests = requests?.filter((r) => {
    const matchesSearch =
      r.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customers?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.licenses?.license_key?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredRegRequests = regRequests?.filter((r) => {
    const matchesSearch =
      r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleReject = () => {
    if (!selectedRequestId) return;
    if (rejectType === "renewal") {
      confirmMutation.mutate({ requestId: selectedRequestId, action: "reject", adminNote: rejectNote });
    } else {
      rejectRegMutation.mutate({ requestId: selectedRequestId, adminNote: rejectNote });
    }
    setRejectDialogOpen(false);
    setRejectNote("");
    setSelectedRequestId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-primary" />
            الطلبات
          </h1>
          <p className="text-muted-foreground mt-1">إدارة طلبات التسجيل والتجديد</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-gradient-to-br from-blue-500/10 to-blue-500/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-xl bg-blue-500/15 p-3"><UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
            <div>
              <p className="text-sm text-muted-foreground">طلبات تسجيل</p>
              <p className="text-2xl font-bold">{pendingRegCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-orange-500/10 to-orange-500/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-xl bg-orange-500/15 p-3"><Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" /></div>
            <div>
              <p className="text-sm text-muted-foreground">تجديدات معلقة</p>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-green-500/10 to-green-500/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-xl bg-green-500/15 p-3"><CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" /></div>
            <div>
              <p className="text-sm text-muted-foreground">مؤكدة</p>
              <p className="text-2xl font-bold">{confirmedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-xl bg-primary/15 p-3"><DollarSign className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
              <p className="text-2xl font-bold">{totalRevenue} جنيه</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="ابحث..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pr-10" />
        </div>
        <div className="flex gap-2">
          {["all", "pending", "confirmed", "rejected"].map((s) => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
              {s === "all" ? "الكل" : statusConfig[s]?.label || s}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="renewals" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="renewals" className="gap-2">
            🔄 طلبات التجديد
            {pendingCount > 0 && <Badge variant="destructive" className="h-5 min-w-5 text-xs">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="registrations" className="gap-2">
            📝 طلبات التسجيل
            {pendingRegCount > 0 && <Badge variant="destructive" className="h-5 min-w-5 text-xs">{pendingRegCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Renewal Requests Tab */}
        <TabsContent value="renewals">
          <Card className="border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold">العميل</TableHead>
                  <TableHead className="font-semibold">الترخيص</TableHead>
                  <TableHead className="font-semibold">الأيام</TableHead>
                  <TableHead className="font-semibold">المبلغ</TableHead>
                  <TableHead className="font-semibold">إيصال الدفع</TableHead>
                  <TableHead className="font-semibold">الحالة</TableHead>
                  <TableHead className="font-semibold">التاريخ</TableHead>
                  <TableHead className="font-semibold text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : filteredRequests?.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12"><div className="flex flex-col items-center gap-2 text-muted-foreground"><ShoppingCart className="h-10 w-10 opacity-30" /><p>لا توجد طلبات</p></div></TableCell></TableRow>
                ) : (
                  filteredRequests?.map((req) => {
                    const config = statusConfig[req.status] || statusConfig.pending;
                    const StatusIcon = config.icon;
                    return (
                      <TableRow key={req.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{req.customers?.name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{req.customers?.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Key className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-mono text-xs">{req.licenses?.license_key || "—"}</p>
                              <p className="text-xs text-muted-foreground">{req.licenses?.products?.name}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">{req.days} يوم</TableCell>
                        <TableCell className="font-semibold">{req.amount} جنيه</TableCell>
                        <TableCell>
                          {req.receipt_note ? (
                            <div className="max-w-[200px] flex flex-col gap-1">
                              {req.receipt_note.startsWith("[صورة إيصال]") ? (
                                <>
                                  <Badge variant="outline" className="gap-1 text-xs">🖼️ صورة إيصال مرفقة</Badge>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => {
                                      const match = req.receipt_note!.match(/file_id:\s*(\S+)/);
                                      const fileId = match ? match[1] : req.receipt_note!.replace("[صورة إيصال] ", "").trim();
                                      setReceiptFileId(fileId);
                                    }}
                                  >
                                    🔍 عرض الصورة
                                  </Button>
                                </>
                              ) : (
                                <p className="text-xs text-muted-foreground truncate" title={req.receipt_note}>
                                  📝 {req.receipt_note}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell><Badge variant={config.variant} className="gap-1"><StatusIcon className="h-3 w-3" />{config.label}</Badge></TableCell>
                         <TableCell className="text-muted-foreground text-sm">
                          <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{(() => { const d = new Date(req.created_at); if (isNaN(d.getTime())) return "—"; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; })()}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {req.status === "pending" && (
                              <>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" className="h-8 gap-1"><CheckCircle2 className="h-4 w-4" />تأكيد</Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>تأكيد طلب التجديد</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        سيتم إضافة <strong>{req.days} يوم</strong> للترخيص وإبلاغ العميل <strong>{req.customers?.name}</strong>.
                                        <br /><br />المبلغ: <strong>{req.amount} جنيه</strong>
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => confirmMutation.mutate({ requestId: req.id, action: "confirm" })} disabled={confirmMutation.isPending}>تأكيد التجديد</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                <Button size="sm" variant="ghost" className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { setSelectedRequestId(req.id); setRejectType("renewal"); setRejectDialogOpen(true); }}>
                                  <XCircle className="h-4 w-4" />رفض
                                </Button>
                              </>
                            )}
                            {req.status !== "pending" && (
                              <span className="text-xs text-muted-foreground">{req.admin_note && `📝 ${req.admin_note}`}</span>
                            )}
                            {/* Delete button */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>حذف طلب التجديد</AlertDialogTitle>
                                  <AlertDialogDescription>هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteRenewalMutation.mutate(req.id)}>حذف</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Registration Requests Tab */}
        <TabsContent value="registrations">
          <Card className="border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold">الاسم</TableHead>
                  <TableHead className="font-semibold">البريد الإلكتروني</TableHead>
                  <TableHead className="font-semibold">الأيام</TableHead>
                  <TableHead className="font-semibold">المبلغ</TableHead>
                  <TableHead className="font-semibold">إيصال الدفع</TableHead>
                  <TableHead className="font-semibold">الحالة</TableHead>
                  <TableHead className="font-semibold">التاريخ</TableHead>
                  <TableHead className="font-semibold text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : filteredRegRequests?.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12"><div className="flex flex-col items-center gap-2 text-muted-foreground"><UserPlus className="h-10 w-10 opacity-30" /><p>لا توجد طلبات تسجيل</p></div></TableCell></TableRow>
                ) : (
                  filteredRegRequests?.map((req) => {
                    const config = statusConfig[req.status] || statusConfig.pending;
                    const StatusIcon = config.icon;
                    return (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{req.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{req.email}</TableCell>
                        <TableCell className="font-semibold">{req.requested_days ? `${req.requested_days} يوم` : "—"}</TableCell>
                        <TableCell className="font-semibold">{req.amount ? `${req.amount} جنيه` : "—"}</TableCell>
                        <TableCell>
                          {req.receipt_note ? (
                            <div className="max-w-[200px] flex flex-col gap-1">
                              {req.receipt_note.startsWith("[صورة إيصال]") ? (
                                <>
                                  <Badge variant="outline" className="gap-1 text-xs">🖼️ صورة إيصال مرفقة</Badge>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => {
                                      const match = req.receipt_note!.match(/file_id:\s*(\S+)/);
                                      const fileId = match ? match[1] : req.receipt_note!.replace("[صورة إيصال] ", "").trim();
                                      setReceiptFileId(fileId);
                                    }}
                                  >
                                    🔍 عرض الصورة
                                  </Button>
                                </>
                              ) : (
                                <p className="text-xs text-muted-foreground truncate" title={req.receipt_note}>
                                  📝 {req.receipt_note}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell><Badge variant={config.variant} className="gap-1"><StatusIcon className="h-3 w-3" />{config.label}</Badge></TableCell>
                         <TableCell className="text-muted-foreground text-sm">
                           <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{(() => { const d = new Date(req.created_at); if (isNaN(d.getTime())) return "—"; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; })()}</div>
                         </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap items-center">
                            {req.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-8 gap-1"
                                  onClick={() => setApproveRegRequest(req)}
                                >
                                  <CheckCircle2 className="h-4 w-4" />تفعيل
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => { setSelectedRequestId(req.id); setRejectType("registration"); setRejectDialogOpen(true); }}>
                                  <XCircle className="h-4 w-4" />رفض
                                </Button>
                              </>
                            )}
                            {req.status !== "pending" && (
                              <span className="text-xs text-muted-foreground">{req.admin_note && `📝 ${req.admin_note}`}</span>
                            )}
                            {/* Delete button */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>حذف طلب التسجيل</AlertDialogTitle>
                                  <AlertDialogDescription>هل أنت متأكد من حذف طلب تسجيل <strong>{req.name}</strong>؟</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteRegMutation.mutate(req.id)}>حذف</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رفض الطلب</DialogTitle>
            <DialogDescription>سيتم إبلاغ العميل بالرفض عبر التليجرام.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="سبب الرفض (اختياري)..." value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleReject} disabled={confirmMutation.isPending || rejectRegMutation.isPending}>رفض الطلب</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Image Dialog */}
      {receiptFileId && (
        <ReceiptDialog fileId={receiptFileId} onClose={() => setReceiptFileId(null)} />
      )}

      {/* Approve Registration Dialog */}
      {approveRegRequest && (
        <ApproveRegDialog
          request={approveRegRequest}
          onClose={() => setApproveRegRequest(null)}
          onApprove={(data) => approveRegMutation.mutate(data)}
        />
      )}
    </div>
  );
};

export default RenewalOrders;
