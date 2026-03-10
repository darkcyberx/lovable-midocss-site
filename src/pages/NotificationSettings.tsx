import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Bell, Clock, Calendar, Save, Plus, X, Send, Bot, CheckCircle2, Eye, Code2, RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface NotificationSettings {
  id: string;
  notification_days: number[];
  notification_time: string;
  email_subject: string;
  email_enabled: boolean;
  telegram_message_template?: string;
}

const DEFAULT_TEMPLATE =
  `━━━━━━━━━━━━━━━━━━━━━\n` +
  `{urgencyEmoji} *تنبيه انتهاء ترخيص*\n` +
  `━━━━━━━━━━━━━━━━━━━━━\n\n` +
  `مرحباً *{customerName}*\n\n` +
  `ترخيصك لمنتج *{productName}* سينتهي قريباً!\n\n` +
  `🔑 المفتاح: \`{licenseKey}\`\n` +
  `📅 تاريخ الانتهاء: {expiryDate}\n` +
  `⏰ الأيام المتبقية: *{daysRemaining} يوم*\n\n` +
  `━━━━━━━━━━━━━━━━━━━━━\n` +
  `🔄 لتجديد الترخيص أرسل:\n` +
  `/renew {licenseKey}\n` +
  `━━━━━━━━━━━━━━━━━━━━━`;

const VARIABLES = [
  { key: "{urgencyEmoji}", label: "إيموجي الإلحاح", desc: "🚨 أو ⚠️ أو 📢 حسب الأيام" },
  { key: "{customerName}", label: "اسم العميل", desc: "الاسم الكامل للعميل" },
  { key: "{productName}", label: "اسم المنتج", desc: "اسم المنتج المرخّص" },
  { key: "{licenseKey}", label: "مفتاح الترخيص", desc: "مثال: XXXX-XXXX-XXXX-XXXX" },
  { key: "{expiryDate}", label: "تاريخ الانتهاء", desc: "تاريخ انتهاء الترخيص" },
  { key: "{daysRemaining}", label: "الأيام المتبقية", desc: "عدد الأيام حتى الانتهاء" },
];

function renderPreview(template: string): string {
  return template
    .replace(/{urgencyEmoji}/g, "⚠️")
    .replace(/{customerName}/g, "محمد أحمد")
    .replace(/{productName}/g, "DarkCyberX Pro")
    .replace(/{licenseKey}/g, "A1B2-C3D4-E5F6-G7H8")
    .replace(/{expiryDate}/g, "١٥/٠٤/٢٠٢٦")
    .replace(/{daysRemaining}/g, "3");
}

export default function NotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [newDay, setNewDay] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .single();

      if (error) throw error;
      setSettings({
        ...data,
        telegram_message_template: (data as any).telegram_message_template || DEFAULT_TEMPLATE,
      });
    } catch (error: any) {
      toast({ title: "خطأ", description: "فشل في تحميل الإعدادات", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("notification_settings")
        .update({
          notification_days: settings.notification_days,
          notification_time: settings.notification_time,
          email_subject: settings.email_subject,
          email_enabled: settings.email_enabled,
          telegram_message_template: settings.telegram_message_template,
        } as any)
        .eq("id", settings.id);

      if (error) throw error;
      toast({ title: "تم الحفظ ✅", description: "تم حفظ إعدادات الإشعارات بنجاح" });
    } catch (error: any) {
      toast({ title: "خطأ", description: "فشل في حفظ الإعدادات", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    try {
      setTesting(true);
      const { data, error } = await supabase.functions.invoke("check-expiring-licenses");
      if (error) throw error;
      toast({
        title: "تم الإرسال ✅",
        description: data?.message || "تم إرسال الإشعارات عبر التليجرام",
      });
    } catch (error: any) {
      toast({ title: "خطأ في الإرسال", description: "فشل إرسال الإشعار التجريبي", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea || !settings) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = settings.telegram_message_template || "";
    const newVal = current.substring(0, start) + variable + current.substring(end);
    setSettings({ ...settings, telegram_message_template: newVal });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const addNotificationDay = () => {
    const day = parseInt(newDay);
    if (isNaN(day) || day < 1 || day > 365) {
      toast({ title: "خطأ", description: "يرجى إدخال رقم صحيح بين 1 و 365", variant: "destructive" });
      return;
    }
    if (settings?.notification_days.includes(day)) {
      toast({ title: "تنبيه", description: "هذا اليوم موجود بالفعل", variant: "destructive" });
      return;
    }
    setSettings({ ...settings!, notification_days: [...settings!.notification_days, day].sort((a, b) => b - a) });
    setNewDay("");
  };

  const removeNotificationDay = (day: number) => {
    setSettings({ ...settings!, notification_days: settings!.notification_days.filter((d) => d !== day) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">لا توجد إعدادات</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            إعدادات الإشعارات
          </h1>
          <p className="text-muted-foreground mt-2">
            تحكم في توقيت ونص تنبيهات انتهاء التراخيص عبر بوت التليجرام
          </p>
        </div>
        <Button
          onClick={handleSendTest}
          disabled={testing}
          variant="outline"
          size="lg"
          className="gap-2 border-primary/40 text-primary hover:bg-primary/10 shrink-0"
        >
          {testing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          {testing ? "جاري الإرسال..." : "إرسال تجريبي"}
        </Button>
      </div>

      {/* Telegram Info Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4">
        <Bot className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-primary">الإشعارات تُرسل حصرياً عبر بوت التليجرام</p>
          <p className="text-sm text-muted-foreground mt-1">
            يتلقى العملاء المرتبطون بالبوت تنبيهاً تلقائياً في الأيام المحددة. العملاء غير المرتبطين يتلقون الإشعار عبر البريد الإلكتروني كبديل تلقائي.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Notification Days */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              أيام الإشعار
            </CardTitle>
            <CardDescription>الأيام قبل انتهاء الترخيص التي يتم فيها إرسال تنبيه للعميل</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {settings.notification_days.map((day) => (
                <Badge key={day} variant="secondary" className="text-base py-2 px-4 gap-2">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                  {day} {day === 1 ? "يوم" : "أيام"}
                  <button onClick={() => removeNotificationDay(day)} className="hover:text-destructive transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </Badge>
              ))}
              {settings.notification_days.length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد أيام محددة.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="عدد الأيام (مثال: 30)"
                value={newDay}
                onChange={(e) => setNewDay(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNotificationDay()}
                min="1"
                max="365"
              />
              <Button onClick={addNotificationDay} variant="outline">
                <Plus className="h-4 w-4 ml-2" />
                إضافة
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notification Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              وقت الإرسال اليومي
            </CardTitle>
            <CardDescription>الوقت الذي يتم فيه فحص التراخيص وإرسال التنبيهات يومياً</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="notification-time">الوقت</Label>
              <Input
                id="notification-time"
                type="time"
                value={settings.notification_time}
                onChange={(e) => setSettings({ ...settings, notification_time: e.target.value })}
                className="max-w-xs"
              />
              <p className="text-sm text-muted-foreground">سيتم إرسال الإشعارات يومياً عند هذا الوقت</p>
            </div>
          </CardContent>
        </Card>

        {/* Telegram Message Template */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              رسالة التليجرام
            </CardTitle>
            <CardDescription>
              خصّص نص الرسالة التي تُرسل للعملاء. استخدم المتغيرات أدناه لإدراج بيانات ديناميكية
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Variables Chips */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                المتغيرات المتاحة
                <span className="text-xs text-muted-foreground font-normal">— اضغط لإدراج في الرسالة</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key)}
                    title={v.desc}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 transition-colors"
                  >
                    {v.key}
                    <span className="text-muted-foreground font-sans">— {v.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Editor + Preview Tabs */}
            <Tabs defaultValue="edit">
              <div className="flex items-center justify-between mb-3">
                <TabsList>
                  <TabsTrigger value="edit" className="gap-2">
                    <Code2 className="h-4 w-4" />
                    تحرير
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-2">
                    <Eye className="h-4 w-4" />
                    معاينة
                  </TabsTrigger>
                </TabsList>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSettings({ ...settings, telegram_message_template: DEFAULT_TEMPLATE })}
                >
                  <RotateCcw className="h-4 w-4" />
                  استعادة الافتراضي
                </Button>
              </div>

              <TabsContent value="edit">
                <Textarea
                  ref={textareaRef}
                  value={settings.telegram_message_template || DEFAULT_TEMPLATE}
                  onChange={(e) => setSettings({ ...settings, telegram_message_template: e.target.value })}
                  rows={14}
                  className="font-mono text-sm resize-none"
                  dir="rtl"
                  placeholder="اكتب نص الرسالة هنا..."
                />
                <p className="text-xs text-muted-foreground mt-2">
                  يدعم تنسيق Markdown للتليجرام: *غامق* و `كود` و _مائل_
                </p>
              </TabsContent>

              <TabsContent value="preview">
                <div className="rounded-lg border bg-muted/30 p-4 min-h-[14rem]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">بوت التليجرام</p>
                      <p className="text-xs text-muted-foreground">معاينة بيانات تجريبية</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-background border p-3">
                    <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed" dir="rtl">
                      {renderPreview(settings.telegram_message_template || DEFAULT_TEMPLATE)}
                    </pre>
                  </div>
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    هذه معاينة بيانات افتراضية — الرسالة الفعلية ستحتوي بيانات العميل الحقيقية
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Button onClick={handleSendTest} disabled={testing} variant="outline" size="lg" className="gap-2">
            {testing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {testing ? "جاري الإرسال..." : "اختبار الإرسال الآن"}
          </Button>
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? (
              <><Loader2 className="h-5 w-5 ml-2 animate-spin" />جاري الحفظ...</>
            ) : (
              <><Save className="h-5 w-5 ml-2" />حفظ التغييرات</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
