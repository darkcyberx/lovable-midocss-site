import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, Bell, Shield, Database, Key, Download, CheckCircle2, Loader2, Upload, Eye, EyeOff, Save, AlertTriangle, FileJson } from "lucide-react";

const EXPORT_TABLES = [
  { key: "products", label: "المنتجات" },
  { key: "customers", label: "العملاء" },
  { key: "licenses", label: "التراخيص" },
  { key: "devices", label: "الأجهزة" },
  { key: "blocked_ips", label: "IPs المحجوبة" },
  { key: "blocked_hwids", label: "HWIDs المحجوبة" },
  { key: "revoked_keys", label: "المفاتيح الملغاة" },
  { key: "notification_settings", label: "إعدادات الإشعارات" },
  { key: "rustdesk_ids", label: "معرفات RustDesk" },
  { key: "telegram_links", label: "روابط تليجرام" },
] as const;

const SECRETS_CONFIG = [
  { key: "TELEGRAM_BOT_TOKEN", label: "TELEGRAM_BOT_TOKEN", hint: "توكن البوت من @BotFather" },
  { key: "ADMIN_TELEGRAM_CHAT_ID", label: "ADMIN_TELEGRAM_CHAT_ID", hint: "معرف دردشة المسؤول" },
  { key: "IPINFO_TOKEN", label: "IPINFO_TOKEN", hint: "توكن من ipinfo.io" },
  { key: "RESEND_API_KEY", label: "RESEND_API_KEY", hint: "مفتاح API من resend.com" },
];

type ImportStatus = { table: string; label: string; count: number; status: "done" | "error"; error?: string };

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState<Record<string, "idle" | "loading" | "done" | "error">>({});
  const [importLoading, setImportLoading] = useState(false);
  const [importResults, setImportResults] = useState<ImportStatus[] | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [secretsValues, setSecretsValues] = useState<Record<string, string>>(
    Object.fromEntries(SECRETS_CONFIG.map(s => [s.key, ""]))
  );
  const [secretsVisible, setSecretsVisible] = useState<Record<string, boolean>>(
    Object.fromEntries(SECRETS_CONFIG.map(s => [s.key, false]))
  );
  const [secretsSaving, setSecretsSaving] = useState(false);
  const [profile, setProfile] = useState({
    username: "",
    full_name: "",
  });
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    licenseExpiry: true,
    newDevices: true,
    systemUpdates: false,
  });
  const { toast } = useToast();

  const exportAllData = async () => {
    setExportLoading(true);
    const result: Record<string, unknown[]> = {};
    const progress: Record<string, "idle" | "loading" | "done" | "error"> = {};
    EXPORT_TABLES.forEach(t => { progress[t.key] = "loading"; });
    setExportProgress({ ...progress });

    for (const table of EXPORT_TABLES) {
      try {
        const { data, error } = await (supabase.from(table.key as any).select("*").limit(5000));
        if (error) throw error;
        result[table.key] = data || [];
        progress[table.key] = "done";
      } catch {
        result[table.key] = [];
        progress[table.key] = "error";
      }
      setExportProgress({ ...progress });
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      version: "1.0",
      tables: result,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setExportLoading(false);
    toast({ title: "✅ تم التصدير بنجاح", description: "تم تنزيل ملف JSON يحتوي على جميع البيانات" });
  };

  // ── Import ──────────────────────────────────────────────────────────────
  const IMPORT_CONFLICT_STRATEGY: Record<string, string> = {
    products: "id",
    customers: "id",
    licenses: "id",
    devices: "id",
    blocked_ips: "id",
    blocked_hwids: "id",
    revoked_keys: "id",
    notification_settings: "id",
    rustdesk_ids: "id",
    telegram_links: "id",
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (!json.tables) throw new Error("صيغة الملف غير صحيحة — لا يحتوي على حقل tables");
        await runImport(json.tables);
      } catch (err: any) {
        toast({ title: "خطأ في الاستيراد", description: err.message || "تعذّر قراءة الملف", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    // reset input so same file can be re-selected
    e.target.value = "";
  };

  const runImport = async (tables: Record<string, any[]>) => {
    setImportLoading(true);
    setImportResults(null);
    const results: ImportStatus[] = [];

    for (const table of EXPORT_TABLES) {
      const rows: any[] = tables[table.key];
      if (!rows || rows.length === 0) {
        results.push({ table: table.key, label: table.label, count: 0, status: "done" });
        continue;
      }
      // strip created_at/updated_at to let DB defaults apply, keep all other fields
      const cleaned = rows.map(r => {
        const { created_at: _c, updated_at: _u, ...rest } = r;
        return rest;
      });
      const conflict = IMPORT_CONFLICT_STRATEGY[table.key] || "id";
      const { error } = await (supabase
        .from(table.key as any)
        .upsert(cleaned, { onConflict: conflict, ignoreDuplicates: false }) as any);
      if (error) {
        results.push({ table: table.key, label: table.label, count: 0, status: "error", error: error.message });
      } else {
        results.push({ table: table.key, label: table.label, count: cleaned.length, status: "done" });
      }
    }

    setImportResults(results);
    setImportLoading(false);
    const errorCount = results.filter(r => r.status === "error").length;
    if (errorCount === 0) {
      toast({ title: "✅ تم الاستيراد بنجاح", description: `تمّ استيراد بيانات ${results.filter(r => r.count > 0).length} جداول` });
    } else {
      toast({ title: `⚠️ اكتمل مع ${errorCount} أخطاء`, description: "راجع النتائج أدناه", variant: "destructive" });
    }
  };

  // Load existing secrets from DB
  const { data: existingSecrets, refetch: refetchSecrets } = useQuery({
    queryKey: ["project-config-secrets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_config" as any)
        .select("key, value");
      if (error) throw error;
      return (data as unknown as { key: string; value: string }[]) || [];
    },
  });

  useEffect(() => {
    if (existingSecrets?.length) {
      const vals: Record<string, string> = { ...Object.fromEntries(SECRETS_CONFIG.map(s => [s.key, ""])) };
      existingSecrets.forEach(r => { if (r.key in vals) vals[r.key] = r.value; });
      setSecretsValues(vals);
    }
  }, [existingSecrets]);

  const saveSecrets = async () => {
    setSecretsSaving(true);
    try {
      const upserts = SECRETS_CONFIG
        .filter(s => secretsValues[s.key]?.trim())
        .map(s => ({ key: s.key, value: secretsValues[s.key].trim() }));

      if (upserts.length === 0) {
        toast({ title: "لا يوجد شيء للحفظ", description: "أدخل قيمة واحدة على الأقل" });
        return;
      }

      for (const item of upserts) {
        const { error } = await (supabase.from("project_config" as any).upsert(item, { onConflict: "key" }));
        if (error) throw error;
      }

      refetchSecrets();
      toast({ title: "✅ تم الحفظ", description: `تم حفظ ${upserts.length} سر بنجاح` });
    } catch {
      toast({ title: "خطأ", description: "فشل حفظ الأسرار", variant: "destructive" });
    } finally {
      setSecretsSaving(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);


  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      if (data) {
        setProfile({
          username: data.username || "",
          full_name: data.full_name || "",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const updateProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const { error } = await supabase
        .from("profiles")
        .update({
          username: profile.username,
          full_name: profile.full_name,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "تم التحديث",
        description: "تم تحديث معلومات الملف الشخصي بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل تحديث الملف الشخصي",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "تم التحديث",
        description: "تم تغيير كلمة المرور بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل تغيير كلمة المرور",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">الإعدادات</h1>
        <p className="text-muted-foreground">إدارة إعدادات الحساب والنظام</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            الملف الشخصي
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            الأمان
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            الإشعارات
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Database className="h-4 w-4" />
            النظام
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Download className="h-4 w-4" />
            تصدير
          </TabsTrigger>
          <TabsTrigger value="secrets" className="gap-2">
            <Key className="h-4 w-4" />
            الأسرار
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>معلومات الملف الشخصي</CardTitle>
              <CardDescription>
                قم بتحديث معلومات حسابك الشخصية
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم</Label>
                <Input
                  id="username"
                  value={profile.username}
                  onChange={(e) =>
                    setProfile({ ...profile, username: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">الاسم الكامل</Label>
                <Input
                  id="full_name"
                  value={profile.full_name}
                  onChange={(e) =>
                    setProfile({ ...profile, full_name: e.target.value })
                  }
                />
              </div>
              <Button onClick={updateProfile} disabled={loading}>
                حفظ التغييرات
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>تغيير كلمة المرور</CardTitle>
              <CardDescription>
                حافظ على أمان حسابك بتحديث كلمة المرور بانتظام
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">كلمة المرور الحالية</Label>
                <Input
                  id="current-password"
                  type="password"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                />
              </div>
              <Button disabled={loading}>
                <Key className="h-4 w-4 ml-2" />
                تغيير كلمة المرور
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>جلسات النشطة</CardTitle>
              <CardDescription>
                إدارة الأجهزة التي تم تسجيل الدخول منها
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">الجلسة الحالية</p>
                    <p className="text-sm text-muted-foreground">
                      آخر نشاط: الآن
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    تسجيل الخروج من الأجهزة الأخرى
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات الإشعارات</CardTitle>
              <CardDescription>
                اختر الإشعارات التي تريد استلامها
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>إشعارات البريد الإلكتروني</Label>
                  <p className="text-sm text-muted-foreground">
                    تلقي الإشعارات عبر البريد الإلكتروني
                  </p>
                </div>
                <Switch
                  checked={notifications.emailNotifications}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, emailNotifications: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>تنبيهات انتهاء التراخيص</Label>
                  <p className="text-sm text-muted-foreground">
                    إشعار عند اقتراب انتهاء ترخيص
                  </p>
                </div>
                <Switch
                  checked={notifications.licenseExpiry}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, licenseExpiry: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>إشعارات الأجهزة الجديدة</Label>
                  <p className="text-sm text-muted-foreground">
                    إشعار عند تسجيل جهاز جديد
                  </p>
                </div>
                <Switch
                  checked={notifications.newDevices}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, newDevices: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>تحديثات النظام</Label>
                  <p className="text-sm text-muted-foreground">
                    إشعار بالتحديثات والميزات الجديدة
                  </p>
                </div>
                <Switch
                  checked={notifications.systemUpdates}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, systemUpdates: checked })
                  }
                />
              </div>
              <Button>حفظ الإعدادات</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>معلومات النظام</CardTitle>
              <CardDescription>
                تفاصيل حول نظام إدارة التراخيص
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    إصدار النظام
                  </p>
                  <p className="text-lg font-bold">v1.0.0</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    آخر تحديث
                  </p>
                  <p className="text-lg font-bold">2025-01-18</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    حالة النظام
                  </p>
                  <p className="text-lg font-bold text-success">متصل</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    البيئة
                  </p>
                  <p className="text-lg font-bold">Production</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">منطقة الخطر</CardTitle>
              <CardDescription>
                إجراءات لا يمكن التراجع عنها
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-destructive/50 rounded-lg">
                <div>
                  <p className="font-medium">حذف الحساب</p>
                  <p className="text-sm text-muted-foreground">
                    حذف حسابك وجميع البيانات بشكل نهائي
                  </p>
                </div>
                <Button variant="destructive" size="sm">
                  حذف الحساب
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4">

          {/* ── EXPORT ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                تصدير بيانات المشروع
              </CardTitle>
              <CardDescription>
                تصدير جميع البيانات (بدون الأسرار) كملف JSON لاستيرادها في مشروع جديد
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {EXPORT_TABLES.map((table) => {
                  const status = exportProgress[table.key];
                  return (
                    <div key={table.key} className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                      {status === "loading" && <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />}
                      {status === "done" && <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
                      {status === "error" && <span className="h-4 w-4 text-destructive shrink-0 text-xs font-bold">✕</span>}
                      {!status && <Database className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <span className="text-sm font-medium">{table.label}</span>
                    </div>
                  );
                })}
              </div>
              <Separator />
              <div className="flex flex-col gap-3">
                <div className="p-3 rounded-lg bg-muted border border-border text-sm">
                  ⚠️ <strong>ملاحظة:</strong> الملف لا يحتوي على الأسرار (TELEGRAM_BOT_TOKEN، RESEND_API_KEY، إلخ) — يجب إدخالها يدوياً في المشروع الجديد.
                </div>
                <Button onClick={exportAllData} disabled={exportLoading} className="w-full sm:w-auto gap-2" size="lg">
                  {exportLoading ? <><Loader2 className="h-4 w-4 animate-spin" />جاري التصدير...</> : <><Download className="h-4 w-4" />تصدير جميع البيانات (JSON)</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── IMPORT ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                استيراد بيانات من مشروع آخر
              </CardTitle>
              <CardDescription>
                ارفع ملف JSON الذي صدّرته من مشروعك القديم لاستيراد بياناته هنا
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Drop zone / file picker */}
              <div
                className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                onClick={() => importFileRef.current?.click()}
              >
                <FileJson className="h-10 w-10 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium">اضغط لاختيار ملف JSON</p>
                  {importFileName
                    ? <p className="text-sm text-primary mt-1 font-mono">{importFileName}</p>
                    : <p className="text-sm text-muted-foreground mt-1">project-export-YYYY-MM-DD.json</p>
                  }
                </div>
                <input
                  ref={importFileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </div>

              {/* Import in progress */}
              {importLoading && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                  <span className="text-sm font-medium">جاري الاستيراد، يرجى الانتظار...</span>
                </div>
              )}

              {/* Results */}
              {importResults && !importLoading && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">نتائج الاستيراد:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {importResults.map((r) => (
                      <div key={r.table} className={`flex items-center justify-between gap-2 p-3 rounded-lg border text-sm ${r.status === "error" ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/20"}`}>
                        <div className="flex items-center gap-2">
                          {r.status === "done"
                            ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                            : <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                          }
                          <span className="font-medium">{r.label}</span>
                        </div>
                        {r.status === "done"
                          ? <Badge variant="secondary">{r.count} سجل</Badge>
                          : <span className="text-xs text-destructive truncate max-w-[120px]" title={r.error}>{r.error}</span>
                        }
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm">
                ⚠️ <strong>تحذير:</strong> الاستيراد سيستبدل البيانات الموجودة بنفس المعرّف (upsert). تأكد من النسخ الاحتياطي قبل المتابعة.
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* Secrets Tab */}
        <TabsContent value="secrets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                استيراد / تحديث الأسرار
              </CardTitle>
              <CardDescription>
                أدخل قيم الأسرار المطلوبة وسيتم حفظها بشكل آمن في قاعدة البيانات
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {SECRETS_CONFIG.map((secret) => {
                const isVisible = secretsVisible[secret.key];
                const isSaved = existingSecrets?.some(s => s.key === secret.key);
                return (
                  <div key={secret.key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={secret.key} className="font-mono text-sm">
                        {secret.label}
                        {isSaved && (
                          <span className="mr-2 text-xs font-sans text-success font-normal">
                            ✓ محفوظ
                          </span>
                        )}
                      </Label>
                      <span className="text-xs text-muted-foreground">{secret.hint}</span>
                    </div>
                    <div className="relative">
                      <Input
                        id={secret.key}
                        type={isVisible ? "text" : "password"}
                        placeholder={isSaved ? "••••••••••••••• (مخزّن)" : "أدخل القيمة..."}
                        value={secretsValues[secret.key] || ""}
                        onChange={(e) =>
                          setSecretsValues({ ...secretsValues, [secret.key]: e.target.value })
                        }
                        className="pr-10 font-mono text-sm"
                      />
                      <button
                        type="button"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setSecretsVisible({ ...secretsVisible, [secret.key]: !isVisible })
                        }
                      >
                        {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}

              <Separator />

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
                🔒 <strong>أمان:</strong> الأسرار مخزّنة في قاعدة البيانات بصلاحيات المسؤول فقط. لا تظهر في الكود أو السجلات.
              </div>

              <Button
                onClick={saveSecrets}
                disabled={secretsSaving}
                className="w-full sm:w-auto gap-2"
                size="lg"
              >
                {secretsSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    حفظ الأسرار
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
