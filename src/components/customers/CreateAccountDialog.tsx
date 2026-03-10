import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateAccountDialogProps {
  customerId: string;
  customerName: string;
  customerEmail: string;
  onSuccess: () => void;
}

export const CreateAccountDialog = ({ customerId, customerName, customerEmail, onSuccess }: CreateAccountDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleCreateAccount = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-customer-account", {
        body: {
          customerId,
          email: customerEmail,
          name: customerName,
        },
      });

      if (error) throw error;

      // tempPassword only returned when email service not configured
      if (data.tempPassword) {
        setTempPassword(data.tempPassword);
        setShowPassword(true);
      }
      toast.success(data.message || "تم إنشاء الحساب بنجاح");
      if (!data.tempPassword) setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "فشل إنشاء الحساب");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClosePasswordDialog = () => {
    setShowPassword(false);
    setTempPassword("");
    setOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <UserPlus className="ml-2 h-4 w-4" />
            إنشاء حساب
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إنشاء حساب للعميل</DialogTitle>
            <DialogDescription>
              سيتم إنشاء حساب لـ <strong>{customerName}</strong> على البريد الإلكتروني:{" "}
              <strong>{customerEmail}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              سيتم توليد كلمة مرور مؤقتة وإرسالها للعميل عبر البريد الإلكتروني (إذا كان Resend مفعّل).
            </p>
            <p className="text-sm text-amber-600">
              ⚠️ تأكد من أن البريد الإلكتروني صحيح قبل المتابعة
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              إلغاء
            </Button>
            <Button onClick={handleCreateAccount} disabled={loading}>
              {loading ? "جاري الإنشاء..." : "إنشاء الحساب"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showPassword} onOpenChange={handleClosePasswordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تم إنشاء الحساب بنجاح! ✅</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>كلمة المرور المؤقتة للعميل:</p>
              <div className="bg-muted p-4 rounded-lg">
                <code className="text-lg font-mono select-all">{tempPassword}</code>
              </div>
              <p className="text-amber-600 font-medium">
                ⚠️ احفظ كلمة المرور هذه الآن - لن تظهر مرة أخرى!
              </p>
              <p className="text-sm">تم إرسال بيانات الدخول للعميل عبر البريد الإلكتروني.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={handleClosePasswordDialog}>حسناً، فهمت</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
