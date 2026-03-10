import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Download,
  Upload,
  Key,
  Globe,
  Bot,
  TestTube2,
  Trash2,
  RefreshCw,
  ExternalLink,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "done" | "skipped";

interface SubTask {
  id: string;
  label: string;
  hint?: string;
  link?: { label: string; href: string };
}

interface Step {
  id: string;
  phase: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  subtasks: SubTask[];
  warning?: string;
  tip?: string;
}

// ─── Steps Data ──────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    id: "export",
    phase: "المرحلة 1",
    title: "تصدير البيانات من المشروع الحالي",
    description: "احفظ نسخة من جميع بياناتك قبل أي تغيير",
    icon: Download,
    color: "text-blue-500",
    subtasks: [
      { id: "export-1", label: "اذهب إلى الإعدادات ← تصدير البيانات" },
      { id: "export-2", label: "اضغط زر \"تصدير جميع البيانات (JSON)\"" },
      { id: "export-3", label: "تأكد أن الملف نزل على جهازك بنجاح", hint: "اسم الملف: project-export-YYYY-MM-DD.json" },
      { id: "export-4", label: "احتفظ بالملف في مكان آمن" },
    ],
    tip: "الملف يحتوي على: العملاء، التراخيص، المنتجات، الأجهزة، وباقي الجداول — بدون الأسرار.",
  },
  {
    id: "secrets",
    phase: "المرحلة 2",
    title: "جمع قيم الأسرار",
    description: "اجمع قيم الـ API Keys قبل فتح المشروع الجديد",
    icon: Key,
    color: "text-yellow-500",
    subtasks: [
      {
        id: "secrets-1",
        label: "احصل على TELEGRAM_BOT_TOKEN من @BotFather",
        link: { label: "افتح تليجرام → @BotFather", href: "https://t.me/BotFather" },
      },
      {
        id: "secrets-2",
        label: "احصل على ADMIN_TELEGRAM_CHAT_ID عبر @userinfobot",
        link: { label: "افتح @userinfobot", href: "https://t.me/userinfobot" },
      },
      {
        id: "secrets-3",
        label: "احصل على IPINFO_TOKEN من لوحة ipinfo.io",
        link: { label: "ipinfo.io/account", href: "https://ipinfo.io/account" },
      },
      {
        id: "secrets-4",
        label: "احصل على RESEND_API_KEY من لوحة resend.com",
        link: { label: "resend.com/api-keys", href: "https://resend.com/api-keys" },
      },
    ],
    warning: "لا تشارك هذه القيم مع أحد — احفظها مؤقتاً في مكان خاص.",
  },
  {
    id: "new-project",
    phase: "المرحلة 3",
    title: "إعداد المشروع الجديد",
    description: "استيراد البيانات وإدخال الأسرار في المشروع الجديد",
    icon: Upload,
    color: "text-green-500",
    subtasks: [
      { id: "new-1", label: "افتح المشروع الجديد وسجّل الدخول كـ Admin" },
      { id: "new-2", label: "اذهب إلى الإعدادات ← تصدير ← استيراد بيانات" },
      { id: "new-3", label: "ارفع ملف JSON الذي صدّرته في المرحلة 1" },
      { id: "new-4", label: "تأكد من ظهور نتائج الاستيراد بدون أخطاء" },
      { id: "new-5", label: "اذهب إلى الإعدادات ← الأسرار وأدخل قيم الـ API Keys" },
      { id: "new-6", label: "احفظ الأسرار وتأكد من ظهور علامة ✓ محفوظ لكل منها" },
    ],
  },
  {
    id: "webhook",
    phase: "المرحلة 4",
    title: "تحديث Webhook البوت",
    description: "ربط البوت بالمشروع الجديد",
    icon: Bot,
    color: "text-purple-500",
    subtasks: [
      { id: "wh-1", label: "انسخ رابط المشروع الجديد (Supabase Project URL)" },
      {
        id: "wh-2",
        label: "شغّل الأمر التالي لتحديث Webhook",
        hint: "https://api.telegram.org/bot{TOKEN}/setWebhook?url={NEW_PROJECT_URL}/functions/v1/telegram-bot",
      },
      { id: "wh-3", label: "اذهب لصفحة بوت التليجرام في المشروع الجديد وتأكد أن حالة الـ Webhook = active" },
    ],
    tip: "يمكنك من صفحة بوت التليجرام الضغط على \"اختبار الاتصال\" للتحقق.",
  },
  {
    id: "clients",
    phase: "المرحلة 5",
    title: "تحديث رابط الـ API في تطبيقات العملاء",
    description: "كل عميل لازم يغيّر الـ URL في برنامجه",
    icon: Globe,
    color: "text-orange-500",
    subtasks: [
      { id: "cl-1", label: "انسخ الـ API URL الجديد من صفحة بيانات الاعتماد في المشروع الجديد" },
      { id: "cl-2", label: "حدّث الـ URL في أكواد تطبيقاتك (validate-license endpoint)" },
      { id: "cl-3", label: "تأكد أن license_key للعملاء لم تتغيّر (يجب أن تكون نفس القيم)" },
    ],
    warning: "العملاء لن يحتاجوا مفاتيح جديدة — فقط تغيير الـ URL في برامجهم.",
  },
  {
    id: "test",
    phase: "المرحلة 6",
    title: "اختبار المشروع الجديد",
    description: "تحقق من أن كل شيء يعمل قبل إيقاف المشروع القديم",
    icon: TestTube2,
    color: "text-cyan-500",
    subtasks: [
      { id: "test-1", label: "اختبر تفعيل ترخيص واحد على الأقل عبر validate-license API" },
      { id: "test-2", label: "اختبر البوت: أرسل رسالة وتأكد أنه يردّ" },
      { id: "test-3", label: "تحقق من ظهور البيانات المستوردة في لوحة التحكم" },
      { id: "test-4", label: "اختبر إرسال إشعار تجريبي من الإعدادات" },
      { id: "test-5", label: "تأكد من عمل صفحة التقارير والإحصائيات" },
    ],
    tip: "لا تغلق المشروع القديم قبل إنهاء هذه المرحلة بالكامل.",
  },
  {
    id: "shutdown",
    phase: "المرحلة 7",
    title: "إيقاف المشروع القديم",
    description: "بعد التأكد من أن كل شيء شغّال في المشروع الجديد",
    icon: Trash2,
    color: "text-destructive",
    subtasks: [
      { id: "sd-1", label: "تأكد أن المشروع الجديد يعمل بشكل كامل (المراحل 1-6 مكتملة)" },
      { id: "sd-2", label: "أخبر العملاء بإيقاف المشروع القديم (إن لزم)" },
      { id: "sd-3", label: "عطّل نشر المشروع القديم من الإعدادات" },
    ],
    warning: "هذه الخطوة لا رجعة فيها. تأكد من اكتمال جميع المراحل السابقة أولاً.",
  },
];

const STORAGE_KEY = "migration-guide-progress";

// ─── Component ────────────────────────────────────────────────────────────────

const MigrationGuide = () => {
  const navigate = useNavigate();

  // Load saved progress
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ export: true });

  // Persist progress
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  }, [checked]);

  const toggleCheck = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleExpand = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // Compute per-step completion
  const stepDone = (step: Step): StepStatus => {
    const all = step.subtasks.every((s) => checked[s.id]);
    return all ? "done" : "pending";
  };

  const totalSubtasks = STEPS.flatMap((s) => s.subtasks).length;
  const doneSubtasks = STEPS.flatMap((s) => s.subtasks).filter((s) => checked[s.id]).length;
  const progressPct = Math.round((doneSubtasks / totalSubtasks) * 100);

  const resetAll = () => {
    if (confirm("هل أنت متأكد من إعادة تعيين التقدم؟")) {
      setChecked({});
      setExpanded({ export: true });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">دليل نقل المشروع</h1>
          <p className="text-muted-foreground">خطوات مرتّبة لنقل بياناتك وإعداداتك لمشروع Lovable جديد</p>
        </div>
        <Button variant="outline" size="sm" onClick={resetAll} className="gap-2 shrink-0">
          <RefreshCw className="h-4 w-4" />
          إعادة تعيين
        </Button>
      </div>

      {/* Progress overview */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">التقدم الكلي</span>
            <span className="text-muted-foreground">{doneSubtasks} / {totalSubtasks} خطوة</span>
          </div>
          <Progress value={progressPct} className="h-3" />
          <div className="flex items-center gap-3 flex-wrap">
            {STEPS.map((step) => {
              const done = stepDone(step) === "done";
              return (
                <div key={step.id} className="flex items-center gap-1.5 text-xs">
                  {done
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    : <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                  <span className={done ? "text-success font-medium" : "text-muted-foreground"}>
                    {step.phase}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      {STEPS.map((step, idx) => {
        const isOpen = expanded[step.id];
        const done = stepDone(step) === "done";
        const StepIcon = step.icon;
        const doneCount = step.subtasks.filter((s) => checked[s.id]).length;

        return (
          <Card
            key={step.id}
            className={cn(
              "transition-all border",
              done && "border-success/40 bg-success/5"
            )}
          >
            {/* Step header — clickable */}
            <CardHeader
              className="cursor-pointer select-none pb-3"
              onClick={() => toggleExpand(step.id)}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full border-2 shrink-0",
                  done ? "border-success bg-success/10" : "border-border bg-muted/30"
                )}>
                  {done
                    ? <CheckCircle2 className="h-5 w-5 text-success" />
                    : <StepIcon className={cn("h-5 w-5", step.color)} />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs font-mono shrink-0">
                      {step.phase}
                    </Badge>
                    <CardTitle className="text-base">{step.title}</CardTitle>
                    {done && <Badge className="bg-success/20 text-success border-success/30 text-xs">مكتملة ✓</Badge>}
                  </div>
                  <CardDescription className="mt-0.5">{step.description}</CardDescription>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{doneCount}/{step.subtasks.length}</span>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            </CardHeader>

            {/* Step content */}
            {isOpen && (
              <CardContent className="space-y-4 pt-0">
                <Separator />

                {/* Subtasks */}
                <div className="space-y-2">
                  {step.subtasks.map((sub) => {
                    const isChecked = !!checked[sub.id];
                    return (
                      <div
                        key={sub.id}
                        onClick={() => toggleCheck(sub.id)}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                          isChecked
                            ? "bg-success/8 border-success/30 opacity-80"
                            : "hover:bg-muted/40 border-transparent hover:border-border"
                        )}
                      >
                        <div className="mt-0.5 shrink-0">
                          {isChecked
                            ? <CheckCircle2 className="h-5 w-5 text-success" />
                            : <Circle className="h-5 w-5 text-muted-foreground" />
                          }
                        </div>
                        <div className="space-y-1 flex-1">
                          <p className={cn("text-sm font-medium leading-snug", isChecked && "line-through text-muted-foreground")}>
                            {sub.label}
                          </p>
                          {sub.hint && (
                            <p className="text-xs text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1 break-all">
                              {sub.hint}
                            </p>
                          )}
                          {sub.link && (
                            <a
                              href={sub.link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {sub.link.label}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Warning */}
                {step.warning && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/8 border border-destructive/20 text-sm">
                    <span className="text-destructive shrink-0 mt-0.5">⚠️</span>
                    <p className="text-destructive/90">{step.warning}</p>
                  </div>
                )}

                {/* Tip */}
                {step.tip && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                    <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-muted-foreground">{step.tip}</p>
                  </div>
                )}

                {/* Quick actions */}
                {step.id === "export" && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/settings")}>
                    <Download className="h-4 w-4" />
                    اذهب لصفحة الإعدادات ← تصدير
                  </Button>
                )}
                {step.id === "secrets" && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/settings")}>
                    <Key className="h-4 w-4" />
                    اذهب لصفحة الإعدادات ← الأسرار
                  </Button>
                )}
                {step.id === "webhook" && (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/telegram-settings")}>
                    <Bot className="h-4 w-4" />
                    اذهب لصفحة بوت التليجرام
                  </Button>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Done banner */}
      {progressPct === 100 && (
        <Card className="border-success bg-success/10">
          <CardContent className="pt-5 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <h3 className="text-xl font-bold text-success">🎉 تم النقل بنجاح!</h3>
            <p className="text-muted-foreground text-sm">جميع المراحل مكتملة — المشروع الجديد جاهز للعمل.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MigrationGuide;
