import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { KeySquare, Shield, Zap, BarChart } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8 animate-fade-in">
          <div className="flex justify-center mb-8">
            <div className="p-6 bg-gradient-primary rounded-3xl shadow-glow animate-pulse-glow">
              <KeySquare className="h-16 w-16 text-white" />
            </div>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            License Manager Pro
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            نظام احترافي متكامل لإدارة التراخيص والعملاء مع ميزات أمان متقدمة
          </p>

          <div className="flex gap-4 justify-center pt-8">
            <Button
              size="lg"
              className="gap-2 shadow-lg hover:shadow-glow transition-all"
              onClick={() => navigate("/auth")}
            >
              ابدأ الآن
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 pt-16 max-w-4xl mx-auto">
            <div className="p-6 bg-card rounded-xl border space-y-3 hover:shadow-lg transition-all animate-fade-in-up">
              <div className="p-3 bg-primary/10 rounded-lg w-fit">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">أمان متقدم</h3>
              <p className="text-sm text-muted-foreground">
                حماية قوية للتراخيص مع نظام ربط الأجهزة HWID
              </p>
            </div>

            <div className="p-6 bg-card rounded-xl border space-y-3 hover:shadow-lg transition-all animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              <div className="p-3 bg-success/10 rounded-lg w-fit">
                <Zap className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-lg font-semibold">سهل الاستخدام</h3>
              <p className="text-sm text-muted-foreground">
                واجهة حديثة وبديهية لإدارة التراخيص بكل سهولة
              </p>
            </div>

            <div className="p-6 bg-card rounded-xl border space-y-3 hover:shadow-lg transition-all animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <div className="p-3 bg-warning/10 rounded-lg w-fit">
                <BarChart className="h-6 w-6 text-warning" />
              </div>
              <h3 className="text-lg font-semibold">تقارير شاملة</h3>
              <p className="text-sm text-muted-foreground">
                متابعة دقيقة لجميع الأنشطة والإحصائيات
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
