import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Users, Package, Monitor, TrendingUp, AlertCircle } from "lucide-react";

interface Stats {
  totalLicenses: number;
  activeLicenses: number;
  totalCustomers: number;
  totalProducts: number;
  totalDevices: number;
  expiringSoon: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalLicenses: 0,
    activeLicenses: 0,
    totalCustomers: 0,
    totalProducts: 0,
    totalDevices: 0,
    expiringSoon: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [licenses, customers, products, devices] = await Promise.all([
        supabase.from("licenses").select("*"),
        supabase.from("customers").select("id"),
        supabase.from("products").select("id"),
        supabase.from("devices").select("id"),
      ]);

      const activeLicenses = licenses.data?.filter((l) => l.status === "active").length || 0;
      
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const expiringSoon = licenses.data?.filter(
        (l) => l.expire_at && new Date(l.expire_at) <= thirtyDaysFromNow && l.status === "active"
      ).length || 0;

      setStats({
        totalLicenses: licenses.data?.length || 0,
        activeLicenses,
        totalCustomers: customers.data?.length || 0,
        totalProducts: products.data?.length || 0,
        totalDevices: devices.data?.length || 0,
        expiringSoon,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "إجمالي التراخيص",
      value: stats.totalLicenses,
      icon: KeyRound,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "التراخيص النشطة",
      value: stats.activeLicenses,
      icon: TrendingUp,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "العملاء",
      value: stats.totalCustomers,
      icon: Users,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "المنتجات",
      value: stats.totalProducts,
      icon: Package,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "الأجهزة المسجلة",
      value: stats.totalDevices,
      icon: Monitor,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "تنتهي قريباً",
      value: stats.expiringSoon,
      icon: AlertCircle,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">لوحة التحكم</h1>
        <p className="text-muted-foreground">نظرة عامة على نظام إدارة التراخيص</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, index) => (
          <Card
            key={card.title}
            className="hover:shadow-lg transition-all duration-300 animate-fade-in-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${card.color}`}>
                {loading ? "..." : card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
        <CardHeader>
          <CardTitle>مرحباً بك في نظام License Manager</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            نظام احترافي لإدارة التراخيص والعملاء مع ميزات متقدمة:
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>إدارة شاملة للتراخيص والعملاء</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>ربط الأجهزة بنظام HWID آمن</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>تتبع كامل للأنشطة والسجلات</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span>واجهة عصرية وسهلة الاستخدام</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
