import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Key, Mail, Copy, RefreshCw, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ViewCredentialsDialogProps {
  customerName: string;
  customerEmail: string;
}

export const ViewCredentialsDialog = ({
  customerName,
  customerEmail,
}: ViewCredentialsDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(customerEmail);
    toast.success("تم نسخ البريد الإلكتروني");
  };

  const handleCopyPassword = () => {
    if (generatedPassword) {
      navigator.clipboard.writeText(generatedPassword);
      toast.success("تم نسخ كلمة المرور");
    }
  };

  const handleGenerateNewPassword = async () => {
    setIsResending(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke("reset-customer-password", {
        body: {
          email: customerEmail,
          customerName: customerName,
        },
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      // Store the generated password to display it
      if (data?.newPassword) {
        setGeneratedPassword(data.newPassword);
        setShowPassword(true);
      }

      toast.success("تم إنشاء كلمة مرور جديدة وإرسالها للعميل");
    } catch (error: any) {
      console.error("Error generating password:", error);
      toast.error(error.message || "فشل إنشاء كلمة مرور جديدة");
    } finally {
      setIsResending(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Clear password when dialog closes
      setGeneratedPassword(null);
      setShowPassword(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Key className="h-3 w-3" />
          بيانات الدخول
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>بيانات دخول العميل</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Email Section */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>البريد الإلكتروني:</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={customerEmail}
                readOnly
                className="flex-1 bg-background"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopyEmail}
                title="نسخ البريد الإلكتروني"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Password Section */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Key className="h-4 w-4" />
              <span>كلمة المرور:</span>
            </div>
            
            {generatedPassword ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={showPassword ? generatedPassword : "••••••••••••"}
                    readOnly
                    className="flex-1 bg-background font-mono"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "إخفاء" : "إظهار"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleCopyPassword}
                    title="نسخ كلمة المرور"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400">
                  ✓ تم إرسال كلمة المرور أيضاً إلى بريد العميل
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  اضغط على الزر لإنشاء كلمة مرور جديدة وعرضها
                </p>
                <Button
                  onClick={handleGenerateNewPassword}
                  disabled={isResending}
                  className="w-full"
                  variant="secondary"
                >
                  <RefreshCw className={`ml-2 h-4 w-4 ${isResending ? "animate-spin" : ""}`} />
                  {isResending ? "جاري الإنشاء..." : "إنشاء كلمة مرور جديدة"}
                </Button>
              </div>
            )}
          </div>

          {generatedPassword && (
            <Button
              onClick={handleGenerateNewPassword}
              disabled={isResending}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className={`ml-2 h-4 w-4 ${isResending ? "animate-spin" : ""}`} />
              إنشاء كلمة مرور أخرى
            </Button>
          )}

          <div className="text-xs text-muted-foreground border-t pt-3">
            <p>⚠️ كلمة المرور المعروضة مؤقتة ولن تظهر مرة أخرى بعد إغلاق هذه النافذة</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
