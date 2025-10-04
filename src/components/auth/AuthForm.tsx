import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Loader2 } from "lucide-react";

export const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "تم تسجيل الدخول بنجاح",
          description: "مرحباً بك في نظام إدارة التراخيص",
        });
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              username,
            },
          },
        });

        if (error) throw error;

        toast({
          title: "تم إنشاء الحساب",
          description: "يمكنك الآن تسجيل الدخول",
        });
        setIsLogin(true);
      }
    } catch (error: any) {
      toast({
        title: "حدث خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-gradient-primary rounded-2xl shadow-glow">
            <KeyRound className="h-10 w-10 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          License Manager
        </h1>
        <p className="text-muted-foreground">
          {isLogin ? "سجل دخولك لإدارة التراخيص" : "أنشئ حساب جديد"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div className="space-y-2">
            <Label htmlFor="username">اسم المستخدم</Label>
            <Input
              id="username"
              type="text"
              placeholder="أدخل اسم المستخدم"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required={!isLogin}
              disabled={loading}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input
            id="email"
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">كلمة المرور</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            minLength={6}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              جاري التحميل...
            </>
          ) : isLogin ? (
            "تسجيل الدخول"
          ) : (
            "إنشاء حساب"
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => setIsLogin(!isLogin)}
          disabled={loading}
        >
          {isLogin ? "ليس لديك حساب؟ سجل الآن" : "لديك حساب؟ سجل دخولك"}
        </Button>
      </form>
    </div>
  );
};
